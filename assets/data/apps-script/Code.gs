/**
 * Sintera · Apps Script endpoint.
 *
 * Dvě role v jednom web appu:
 *  A) Zápis obsahu do Sheetu (pozice / reference / case) — CHRÁNĚNO tokenem, volá custom GPT.
 *  B) Žádost o reference z webu — VEŘEJNÉ (bez tokenu), volá formulář na webu.
 *  B2) Měření návštěvnosti z webu — VEŘEJNÉ (bez tokenu), volá beacon. Loguje do "navstevy".
 *
 * Nasazení: Rozšíření → Apps Script → vlož kód → Nasadit → Webová aplikace
 *   - "Spustit jako": já,  "Kdo má přístup": Kdokoli.
 *
 * Tajemství NEDÁVEJ do kódu. Projektová nastavení → Vlastnosti skriptu (Script Properties):
 *   TOKEN, LANDING_URL, FROM_EMAIL (volit.), REPLY_TO (volit.), GH_TOKEN
 */

function prop_(key, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (v === null || v === undefined || v === '') ? (fallback || '') : v;
}

/* ============ NEVEŘEJNÁ TABULKA (osobní údaje + měření) ============
   Hlavní tabulka MUSÍ být veřejně čitelná, protože z ní build tahá obsah webu.
   Proto do ní nepatří nic osobního: leady z formuláře i log návštěvnosti žijí
   v samostatné tabulce, kterou tenhle skript založí pod účtem majitele
   (nové tabulky jsou soukromé, nikdo jiný se k nim nedostane).
   Migrace proběhne sama při prvním požadavku po nasazení a je idempotentní. */
var PUBLIC_SS_ID = '14KteI4GZ58x5kj2MAWhSDb7gS5aLUhi9IEXRPH0cCHs';
var PRIVATE_SS_KEY = 'PRIVATE_SS_ID';

function verejnaTabulka_() {
  try { var a = SpreadsheetApp.getActiveSpreadsheet(); if (a) return a; } catch (e) {}
  return SpreadsheetApp.openById(PUBLIC_SS_ID);
}

function neverejnaTabulka_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PRIVATE_SS_KEY);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* smazaná → založ znovu */ }
  }
  var ss = SpreadsheetApp.create('Sintera – leady a měření (NEVEŘEJNÉ)');
  props.setProperty(PRIVATE_SS_KEY, ss.getId());
  try { presunNeverejneListy_(ss); } catch (e) {}
  return ss;
}

// Jednorázově přenese listy s osobními údaji a měřením z veřejné tabulky do neveřejné.
function presunNeverejneListy_(cil) {
  var zdroj = verejnaTabulka_();
  if (!zdroj || zdroj.getId() === cil.getId()) return;
  ['leady_reference', 'navstevy'].forEach(function (name) {   // navstevy před statistikami (vzorce na ně odkazují)
    var sh = zdroj.getSheetByName(name);
    if (!sh || cil.getSheetByName(name)) return;
    sh.copyTo(cil).setName(name);
    zdroj.deleteSheet(sh);
  });
  var staraStat = zdroj.getSheetByName('statistiky');         // statistiky postavíme v neveřejné tabulce znovu
  if (staraStat) zdroj.deleteSheet(staraStat);
  var prazdny = cil.getSheetByName('Sheet1') || cil.getSheetByName('List1');
  if (prazdny && cil.getSheets().length > 1) cil.deleteSheet(prazdny);
  try { vytvorStatistiky(); } catch (e) {}
}

/* ---------- brzdy proti zneužití veřejných akcí ---------- */
// Formulář referencí: strop nezávislý na e-mailu (limit 120 s per e-mail sám o sobě
// nebrání útočníkovi rozesílat poštu jménem Sintery na cizí adresy).
function lzeOdeslatReferenci_() {
  var cache = CacheService.getScriptCache();
  var hod = 'send:h:' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyyMMddHH');
  var zaHodinu = Number(cache.get(hod) || 0);
  if (zaHodinu >= 20) return false;

  var props = PropertiesService.getScriptProperties();
  var den = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyyMMdd');
  var ulozeno = String(props.getProperty('send_count') || '').split(':');
  var zaDen = (ulozeno[0] === den) ? Number(ulozeno[1] || 0) : 0;
  if (zaDen >= 50) return false;

  cache.put(hod, String(zaHodinu + 1), 3900);
  props.setProperty('send_count', den + ':' + (zaDen + 1));
  return true;
}

// Měření: strop zápisů za minutu, ať nejde vyčerpat denní kvótu skriptu a zaplnit tabulku.
function lzeZapsatHit_() {
  var cache = CacheService.getScriptCache();
  var k = 'hits:' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyyMMddHHmm');
  var n = Number(cache.get(k) || 0);
  if (n >= 120) return false;
  cache.put(k, String(n + 1), 120);
  return true;
}

/* ====================== A) ZÁPIS OBSAHU (token) ====================== */

var list = function (v) { return Array.isArray(v) ? v.join('\n') : (v || ''); };
var consent = function (v) { return v === true || v === 'ano' ? 'ano' : 'ne'; };

var TARGETS = {
  pozice: {
    sheet: 'pozice',
    headers: ['nazev','obor','seniorita','kraj','uvazek','rezim','bonus','mzda_rozsah','mzda_pozn',
      'uvod','proc_mluvit','naplne','must','vyhoda','nabizime','cta','stav',
      'datum_zverejneni','platnost_do'],
    build: function (p) {
      return {
        nazev: p.title || '', obor: p.category || '', seniorita: p.seniority || '',
        kraj: p.region || '', uvazek: p.employmentType || 'FULL_TIME', rezim: p.workMode || 'onsite',
        bonus: p.bonus || '', mzda_rozsah: p.salaryRange || '', mzda_pozn: p.salaryNote || '',
        uvod: p.intro || '', proc_mluvit: list(p.whyTalk), naplne: list(p.responsibilities),
        must: list(p.mustHave), vyhoda: list(p.niceToHave), nabizime: list(p.offer),
        cta: p.cta || '', stav: STAV.NE, _highlight: !!p.featured,
        datum_zverejneni: p.datePosted || '', platnost_do: p.validThrough || ''
      };
    }
  },
  reference: {
    sheet: 'reference',
    headers: ['firma','role','citace_kratka','text_web','stitky','logo_slug','zverejnit','souhlas'],
    build: function (r) {
      return {
        firma: r.company || '', role: r.role || '', citace_kratka: r.quote || '',
        text_web: r.long || '', stitky: list(r.tags), logo_slug: r.logo_slug || r.logoSlug || '',
        zverejnit: 'ne', souhlas: consent(r.consent)
      };
    }
  },
  case: {
    sheet: 'case_studies',
    headers: ['nazev','role','typ_firmy','region','situace','proc_nestacil_nabor',
      'co_jsme_udelali','vysledek','zverejnit'],
    build: function (c) {
      return {
        nazev: c.name || '', role: c.role || '', typ_firmy: c.typ_firmy || c.companyType || '',
        region: c.region || '', situace: c.situ || c.situace || '',
        proc_nestacil_nabor: c.why || '', co_jsme_udelali: c.change || '',
        vysledek: c.win || '', zverejnit: 'ne'
      };
    }
  }
};

function handleContentWrite_(body) {
  // fail-closed: bez nastavené Script Property TOKEN se zápis vždy odmítne
  var token = prop_('TOKEN', '');
  if (!token || body.token !== token) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  var target = body.target || (body.position ? 'pozice' : '');
  var record = body.record || body.position || {};
  var def = TARGETS[target];
  if (!def) return json_({ ok: false, error: 'unknown target: ' + target });

  var publish = (body.publish === true || body.publish === 'ano' || body.publish === 'true');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (target === 'pozice') migrujStavPozic_();   // starý formát (featured + zverejnit) → sloupec stav
  var sh = ss.getSheetByName(def.sheet) || ss.insertSheet(def.sheet);
  if (sh.getLastRow() === 0) sh.appendRow(def.headers);

  var map = def.build(record);
  if (publish && def.headers.indexOf('zverejnit') !== -1) map.zverejnit = 'ano';
  if (publish && def.headers.indexOf('stav') !== -1) map.stav = map._highlight ? STAV.HL : STAV.VYS;
  // hodnoty podle SKUTEČNÉ hlavičky listu (ne podle pořadí v def.headers): list má navíc vlastní sloupce
  // (popis, konzultant…) a pořadí se může měnit, pozicí by se data zapsala do cizích sloupců
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var values = head.map(function (h) { return map.hasOwnProperty(h) && h.charAt(0) !== '_' ? map[h] : ''; });
  // nový záznam navrch: vlož řádek hned pod hlavičku (newest-first v Sheetu i na webu)
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, values.length).setValues([values]);
  var row = 2;

  // homepage zobrazuje max 9 featured — nejstarší nad limit se automaticky vypnou
  var featuredVypnuto = 0;
  if (target === 'pozice') featuredVypnuto = enforceFeaturedLimit_();

  var built = false, buildDetail = '';
  if (publish) { var r = triggerBuild_(); built = r.ok; buildDetail = r.detail || ''; if (built) try { oznacPublikovano_(); } catch (e) {} }
  return json_({ ok: true, target: target, sheet: def.sheet, row: row,
                 published: publish, build_triggered: built, build_detail: buildDetail,
                 featured_auto_off: featuredVypnuto });
}

/* ====================== B) ŽÁDOST O REFERENCE (veřejné) ====================== */

var FREE_DOMAINS = [
  'seznam.cz','email.cz','post.cz','centrum.cz','atlas.cz','volny.cz','tiscali.cz','quick.cz',
  'chello.cz','iol.cz','sweb.cz','mybox.cz','raz-dva.cz','email.com',
  'azet.sk','zoznam.sk','post.sk','centrum.sk','pobox.sk','inmail.sk',
  'gmail.com','googlemail.com',
  'outlook.com','outlook.cz','hotmail.com','hotmail.cz','live.com','live.cz','msn.com',
  'yahoo.com','yahoo.co.uk','yahoo.cz','ymail.com','rocketmail.com',
  'icloud.com','me.com','mac.com',
  'proton.me','protonmail.com','pm.me',
  'gmx.com','gmx.net','gmx.de','mail.com','aol.com','zoho.com',
  'yandex.com','yandex.ru','web.de','freenet.de','fastmail.com','tutanota.com','tuta.io','hey.com'
];

function emailDomain_(email) {
  if (typeof email !== 'string') return '';
  var m = email.trim().toLowerCase().match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  return m ? m[1] : '';
}

function handleReferenceRequest_(body) {
  if (body.website) return json_({ ok: true });

  var email = (body.email || '').trim();
  var domain = emailDomain_(email);

  if (!domain) return json_({ ok: false, error: 'invalid_email' });

  if (!(body.consent === true || body.consent === 'ano')) {
    return json_({ ok: false, error: 'consent_required' });
  }

  if (FREE_DOMAINS.indexOf(domain) !== -1) {
    return json_({ ok: false, error: 'free_domain' });
  }

  var cache = CacheService.getScriptCache();
  var ck = 'ref:' + email.toLowerCase();
  if (cache.get(ck)) return json_({ ok: true, note: 'already_sent' });
  cache.put(ck, '1', 120);

  logLead_({
    email: email, domain: domain,
    phone: String(body.phone || '').trim().slice(0, 40), name: String(body.name || '').trim().slice(0, 80),
    position: String(body.position || '').trim().slice(0, 120), source: String(body.source || '').trim().slice(0, 200),
    referral: String(body.referral || '').trim().slice(0, 80),   // „Odkud nás znáte?" (select na webu)
    consent: 'ano'
  });

  var landing = prop_('LANDING_URL', '');
  if (!landing) return json_({ ok: false, error: 'missing_landing_url' });
  // strop odeslaných e-mailů (proti zneužití endpointu k rozesílání jménem Sintery)
  if (!lzeOdeslatReferenci_()) return json_({ ok: true, note: 'rate_limited' });

  var send = sendReferenceEmail_(email, body.name || '', landing);
  if (!send.ok) { console.error('sendReferenceEmail_: ' + send.detail); return json_({ ok: false, error: 'send_failed' }); }

  return json_({ ok: true });
}

// Text od návštěvníka webu do buňky. Začíná-li na = + - @, Sheets ho při appendRow spustí jako VZOREC:
// např. =IMPORTXML("https://utocnik/?"&B2:B50;"//a") by při otevření tabulky poslal kontakty z listu ven.
// Apostrof na začátku = „tohle je text" (v buňce není vidět). Bonus: telefon „+420 …" už není #ERROR!.
function bunka_(v) {
  var s = String(v == null ? '' : v);
  return /^\s*[=+\-@]/.test(s) ? "'" + s : s;
}

function logLead_(d) {
  var ss = neverejnaTabulka_();                 // osobní údaje NIKDY do veřejné tabulky
  var sh = ss.getSheetByName('leady_reference') || ss.insertSheet('leady_reference');
  var headers = ['cas','email','firma_domena','telefon','jmeno','pozice','zdroj','souhlas','odkud_nas_znate'];
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  // list založený před přidáním sloupce „odkud_nas_znate": doplnit hlavičku, data se nepřepisují
  else if (sh.getRange(1, headers.length).getValue() === '') sh.getRange(1, headers.length).setValue(headers[headers.length - 1]);
  sh.appendRow([
    new Date(), bunka_(d.email), bunka_(d.domain), bunka_(d.phone), bunka_(d.name), bunka_(d.position), bunka_(d.source), d.consent, bunka_(d.referral || '')
  ]);
}

function sendReferenceEmail_(to, name, landing) {
  var from = prop_('FROM_EMAIL', '');
  var replyTo = prop_('REPLY_TO', 'info@sintera.cz');

  // Jméno jde do e-mailu odesílaného jménem Sintery na cizí adresu: krátké, jeden řádek, bez odkazů
  // a adres (jinak by šel endpoint zneužít k doručení vlastního textu z důvěryhodného odesílatele).
  name = String(name || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60);
  if (/https?:|www\.|@|\.[a-z]{2,4}\//i.test(name)) name = '';
  var hello = name ? ('Dobrý den, ' + name + ',') : 'Dobrý den,';
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">' +
      '<p>' + escapeHtml_(hello) + '</p>' +
      '<p>děkujeme za zájem o reference Sintery. Připravili jsme je pro vás na jedné stránce, ' +
      'spolu s ukázkami konkrétních případů a čísly.</p>' +
      '<p style="margin:28px 0">' +
        '<a href="' + landing + '" ' +
        'style="background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block">' +
        'Zobrazit reference</a>' +
      '</p>' +
      '<p style="font-size:13px;color:#555">Kdyby odkaz nešel otevřít, zkopírujte si jej:<br>' +
      '<span style="color:#1a1a1a">' + landing + '</span></p>' +
      '<p style="font-size:13px;color:#555">Když budete chtít probrat konkrétní pozici, ' +
      'stačí odpovědět na tento e-mail.</p>' +
      '<p>Sintera Czech</p>' +
    '</div>';

  var plain = (name ? ('Dobrý den, ' + name + ',') : 'Dobrý den,') + '\n\n' +
    'děkujeme za zájem o reference Sintery. Najdete je zde:\n' + landing + '\n\n' +
    'Když budete chtít probrat konkrétní pozici, stačí odpovědět na tento e-mail.\n\nSintera Czech';

  var options = { htmlBody: html, name: 'Sintera Czech', replyTo: replyTo };
  if (from) options.from = from;

  try {
    GmailApp.sendEmail(to, 'Reference Sintery', plain, options);
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============ B2) Měření návštěvnosti (first-party, bez cookies) ============ */
function handleHit_(body) {
  try {
    if (!lzeZapsatHit_()) return json_({ ok: true, note: 'rate_limited' });
    var t = body.t === 'event' ? 'event' : 'pageview';
    var path = String(body.path || '').slice(0, 200);
    var name = String(body.name || '').slice(0, 80);
    var zdroj = refHost_(body.ref);
    var ss = neverejnaTabulka_();               // měření mimo veřejnou tabulku
    var sh = ss.getSheetByName('navstevy') || ss.insertSheet('navstevy');
    if (sh.getLastRow() === 0) sh.appendRow(['cas', 'typ', 'stranka', 'zdroj', 'akce']);
    var cas = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH:mm:ss');
    sh.appendRow([cas, t, bunka_(path), bunka_(zdroj), bunka_(name)]);
  } catch (e) {}
  return json_({ ok: true });
}

/* ============ B3) Reakce na pozici (formulář na webu) ============
   Web pošle { action:'application', id, position, loc, name, contact, note, website, source,
   files?: [{ name, data(base64) }] }.
   Zapíše řádek do neveřejné tabulky (list "reakce_pozice"), pošle e-mail do Sintery
   (APPLY_TO, výchozí info@sintera.cz) a uchazeči potvrzení, pokud uvedl e-mail.
   Životopis (až 5 souborů) jede jako PŘÍLOHA toho interního e-mailu: e-mail je zároveň
   upozornění, nic se neukládá do složky, kterou by nikdo nehlídal. Odpověď nese
   `prilohy` = kolik souborů opravdu odešlo; web podle toho uchazeči řekne, když ne všechny. */
function handleApplication_(body) {
  if (body.website) return json_({ ok: true });                       // honeypot: skryté pole vyplní jen robot

  var name = String(body.name || '').trim().slice(0, 120);
  var contact = String(body.contact || '').trim().slice(0, 160);
  var note = String(body.note || '').trim().slice(0, 4000);
  var position = String(body.position || '').trim().slice(0, 200);
  var loc = String(body.loc || '').trim().slice(0, 120);
  var id = String(body.id || '').trim().slice(0, 20);
  var source = String(body.source || '').trim().slice(0, 200);
  if (!name || !contact) return json_({ ok: false, error: 'missing_fields' });

  // stejný člověk, stejná pozice, do 2 minut = dvojklik, nezapisovat dvakrát
  var cache = CacheService.getScriptCache();
  // (počet příloh je v klíči: když pošle reakci a hned znovu už se životopisem, druhá projde)
  var ck = 'app:' + id + ':' + contact.toLowerCase() + ':' + (Array.isArray(body.files) ? body.files.length : 0);
  if (cache.get(ck)) return json_({ ok: true, note: 'duplicate' });
  cache.put(ck, '1', 120);

  var cas = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH:mm:ss');
  var prilohy = prilohyZWebu_(body.files, name);
  var odeslano = 0;                                                    // kolik příloh opravdu odešlo e-mailem

  // Interní upozornění má vlastní strop (40/h), aby záplava robotů nevyčerpala denní kvótu Gmailu.
  // Reakce je v tabulce i tehdy, když se e-mail neposlal.
  var applyTo = prop_('APPLY_TO', 'info@sintera.cz');
  var contactEmail = emailDomain_(contact) ? contact.toLowerCase() : '';
  if (lzeOdeslatInterni_()) {
    var subject = 'Reakce na pozici: ' + position + (loc ? ' (' + loc + ')' : '') + (prilohy.length ? ' · životopis v příloze' : '');
    var text =
      'Nová reakce z webu sintera.cz\n\n' +
      'Pozice: ' + position + (loc ? ' (' + loc + ')' : '') + (id ? '  [id ' + id + ']' : '') + '\n' +
      'Jméno: ' + name + '\n' +
      'Kontakt: ' + contact + '\n' +
      'Čas: ' + cas + '\n' +
      (prilohy.length ? 'Přílohy (' + prilohy.length + '): ' + prilohy.map(function (b) { return b.getName(); }).join(', ') + '\n' : '') +
      (prilohy.chyby.length ? 'Nepřijato: ' + prilohy.chyby.join(', ') + '\n' : '') +
      '\n' + (note ? note + '\n\n' : '(bez zprávy)\n\n') +
      'Záznam je i v tabulce, list "reakce_pozice".';
    var opt = { name: 'Sintera web' };
    if (contactEmail) opt.replyTo = contactEmail;                     // Odpovědět = rovnou uchazeči
    if (prilohy.length) opt.attachments = prilohy;
    try { GmailApp.sendEmail(applyTo, subject, text, opt); odeslano = prilohy.length; } catch (e) {
      // e-mail s přílohou neprošel (třeba vadný soubor): upozornění pošli aspoň bez ní, ať reakce nezapadne
      delete opt.attachments;
      try { GmailApp.sendEmail(applyTo, subject.replace(' · životopis v příloze', ' · PŘÍLOHU SE NEPODAŘILO PŘIPOJIT'), text, opt); } catch (e2) {}
    }
  }

  logApplication_({ cas: cas, id: id, position: position, loc: loc, name: name, contact: contact, note: note, source: source,
    prilohy: prilohy.length ? prilohy.map(function (b) { return b.getName(); }).join('\n') + (odeslano ? '\n(v e-mailu na ' + applyTo + ')' : '\n(NEODESLÁNO, chybí v e-mailu)') : '' });

  // potvrzení uchazeči: jen když dal e-mail, a jen v rámci společného stropu (chrání před rozesíláním jménem Sintery)
  if (contactEmail && lzeOdeslatReferenci_()) {
    var from = prop_('FROM_EMAIL', '');
    var replyTo = prop_('REPLY_TO', 'info@sintera.cz');
    var potvrzeni =
      'Dobrý den,\n\n' +
      'děkujeme za vaši reakci na pozici ' + position + (loc ? ' (' + loc + ')' : '') + '. ' +
      (odeslano ? 'Váš životopis jsme přijali. ' : '') +
      'Dorazila k nám a ozveme se vám.\n\n' +
      'Kdybyste chtěli cokoli doplnit, stačí odpovědět na tento e-mail.\n\n' +
      'Sintera Czech\n+420 499 599 861';
    var o2 = { name: 'Sintera Czech', replyTo: replyTo };
    if (from) o2.from = from;
    try { GmailApp.sendEmail(contactEmail, 'Vaše reakce na pozici ' + position, potvrzeni, o2); } catch (e) {}
  }

  return json_({ ok: true, prilohy: odeslano });
}

function logApplication_(d) {
  var ss = neverejnaTabulka_();                 // osobní údaje NIKDY do veřejné tabulky
  var sh = ss.getSheetByName('reakce_pozice') || ss.insertSheet('reakce_pozice');
  if (sh.getLastRow() === 0) sh.appendRow(['cas', 'pozice_id', 'pozice', 'misto', 'jmeno', 'kontakt', 'zprava', 'zdroj', 'prilohy']);
  else if (sh.getRange(1, 9).getValue() !== 'prilohy') sh.getRange(1, 9).setValue('prilohy');   // starší list: doplnit sloupec
  sh.appendRow([d.cas, bunka_(d.id), bunka_(d.position), bunka_(d.loc), bunka_(d.name), bunka_(d.contact), bunka_(d.note), bunka_(d.source), bunka_(d.prilohy)]);
}

/* Přílohy z formuláře → pole blobů pro GmailApp (+ .chyby = co se odmítlo).
   Typ se určuje podle přípony, ne podle toho, co tvrdí prohlížeč. Limity drží i web
   (apply-form.js): 5 souborů, 10 MB na soubor, 15 MB celkem (Gmail bere přílohy do 25 MB). */
var PRILOHY_TYPY = { pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf', txt: 'text/plain',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

function prilohyZWebu_(files, jmeno) {
  var out = [], celkem = 0;
  out.chyby = [];
  if (!Array.isArray(files)) return out;
  var predpona = String(jmeno || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim().slice(0, 60);
  files.slice(0, 5).forEach(function (f) {
    var nazev = String((f && f.name) || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim().slice(-120);
    var m = /\.([a-z0-9]+)$/i.exec(nazev), typ = m && PRILOHY_TYPY[m[1].toLowerCase()];
    if (!typ || !f.data) { out.chyby.push(nazev || '(bez názvu)'); return; }
    var bajty;
    try { bajty = Utilities.base64Decode(String(f.data)); } catch (e) { out.chyby.push(nazev); return; }
    if (bajty.length > 10 * 1024 * 1024 || celkem + bajty.length > 15 * 1024 * 1024) { out.chyby.push(nazev + ' (moc velký)'); return; }
    celkem += bajty.length;
    // jméno uchazeče do názvu souboru, ať se v poště nesejde deset „CV.pdf“
    var cil = predpona && nazev.toLowerCase().indexOf(predpona.toLowerCase()) === -1 ? predpona + ' - ' + nazev : nazev;
    out.push(Utilities.newBlob(bajty, typ, cil));
  });
  return out;
}

// Interní upozornění na reakce: strop za hodinu (nezávislý na stropu pro e-maily ven)
function lzeOdeslatInterni_() {
  var cache = CacheService.getScriptCache();
  var k = 'app:h:' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyyMMddHH');
  var n = Number(cache.get(k) || 0);
  if (n >= 40) return false;
  cache.put(k, String(n + 1), 3900);
  return true;
}

/* ============ B4) Poptávka od klienta („Pošlete nám pozici") ============
   Web pošle { action:'inquiry', company, name, contact, note, website, source }.
   Zapíše řádek do neveřejné tabulky (list "poptavky"), pošle e-mail do Sintery
   (INQUIRY_TO, jinak APPLY_TO, jinak info@sintera.cz; Reply-To je klient)
   a klientovi potvrzení, pokud uvedl e-mail. */
function handleInquiry_(body) {
  if (body.website) return json_({ ok: true });                       // honeypot: skryté pole vyplní jen robot

  var company = String(body.company || '').trim().slice(0, 160);
  var name = String(body.name || '').trim().slice(0, 120);
  var contact = String(body.contact || '').trim().slice(0, 160);
  var note = String(body.note || '').trim().slice(0, 6000);
  var source = String(body.source || '').trim().slice(0, 200);
  var en = body.lang === 'en';                                        // poptávka z anglické verze webu (/en/)
  if (!company || !contact) return json_({ ok: false, error: 'missing_fields' });

  // stejná firma i kontakt do 2 minut = dvojklik, nezapisovat dvakrát
  var cache = CacheService.getScriptCache();
  var ck = 'inq:' + company.toLowerCase() + ':' + contact.toLowerCase();
  if (cache.get(ck)) return json_({ ok: true, note: 'duplicate' });
  cache.put(ck, '1', 120);

  var cas = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH:mm:ss');
  var ss = neverejnaTabulka_();                 // kontakty klientů NIKDY do veřejné tabulky
  var sh = ss.getSheetByName('poptavky') || ss.insertSheet('poptavky');
  if (sh.getLastRow() === 0) sh.appendRow(['cas', 'firma', 'jmeno', 'kontakt', 'popis', 'zdroj']);
  sh.appendRow([cas, bunka_(company), bunka_(name), bunka_(contact), bunka_(note), bunka_(source)]);

  var kam = prop_('INQUIRY_TO', prop_('APPLY_TO', 'info@sintera.cz'));
  var contactEmail = emailDomain_(contact) ? contact.toLowerCase() : '';
  if (lzeOdeslatInterni_()) {
    var text =
      'Nová poptávka z webu sintera.cz' + (en ? ' (ANGLICKÁ verze webu, klientovi odpovídat anglicky)' : '') + '\n\n' +
      'Firma: ' + company + '\n' +
      (name ? 'Jméno: ' + name + '\n' : '') +
      'Kontakt: ' + contact + '\n' +
      'Čas: ' + cas + '\n\n' +
      (note ? note + '\n\n' : '(bez popisu pozice)\n\n') +
      'Záznam je i v tabulce, list "poptavky".';
    var opt = { name: 'Sintera web' };
    if (contactEmail) opt.replyTo = contactEmail;                     // Odpovědět = rovnou klientovi
    try { GmailApp.sendEmail(kam, (en ? '[EN] ' : '') + 'Poptávka z webu: ' + company, text, opt); } catch (e) {}
  }

  if (contactEmail && lzeOdeslatReferenci_()) {
    var from = prop_('FROM_EMAIL', '');
    var replyTo = prop_('REPLY_TO', 'info@sintera.cz');
    var potvrzeni = en ?
      'Hello,\n\n' +
      'thank you for your enquiry. It has reached us and we will reply within two working days.\n\n' +
      'If you would like to add anything, simply reply to this email, ' +
      'or call us on +420 499 599 861.\n\n' +
      'Sintera Czech' :
      'Dobrý den,\n\n' +
      'děkujeme za poptávku. Dorazila k nám a ozveme se vám do druhého pracovního dne.\n\n' +
      'Kdybyste chtěli cokoli doplnit, stačí odpovědět na tento e-mail. ' +
      'Nebo rovnou zavolejte na +420 499 599 861.\n\n' +
      'Sintera Czech';
    var o2 = { name: 'Sintera Czech', replyTo: replyTo };
    if (from) o2.from = from;
    try { GmailApp.sendEmail(contactEmail, en ? 'Your enquiry to Sintera' : 'Vaše poptávka pro Sinteru', potvrzeni, o2); } catch (e) {}
  }

  return json_({ ok: true });
}

function refHost_(ref) {
  if (!ref) return '(přímo)';
  var m = String(ref).match(/^https?:\/\/([^\/]+)/i);
  var host = m ? m[1].toLowerCase() : '';
  if (!host) return '(přímo)';
  if (host.indexOf('sintera.cz') !== -1) return '(interní)';
  return host.replace(/^www\./, '');
}

/* ====================== Router ====================== */

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'reference_request') return handleReferenceRequest_(body);
    if (body.action === 'hit') return handleHit_(body);
    if (body.action === 'application') return handleApplication_(body);
    if (body.action === 'inquiry') return handleInquiry_(body);
    return handleContentWrite_(body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  // ?sync=1 volá každých 5 minut časovač na serveru (viz C4): změněný a ustálený Sheet → build webu
  if (e && e.parameter && e.parameter.sync) {
    var st = 'chyba';
    try { st = synchronizujWeb_(); } catch (err) { st = 'chyba: ' + err; }
    return json_({ ok: true, sync: st });
  }
  var privateOk = false;
  try { privateOk = !!neverejnaTabulka_(); } catch (e2) {}   // založí/zmigruje neveřejnou tabulku při prvním volání
  try { migrujStavPozic_(); } catch (e2) {}                    // jednorázově: featured + zverejnit → stav
  try { vlozTlacitkoPublikovat_(); } catch (e2) {}             // jednorázově: barevné tlačítko v listu pozice
  try { vytvorArchivNavrh_(); } catch (e2) {}                  // jednorázově: list ARCHIV – rozhodnutí pro Šárku
  return json_({ ok: true, service: 'sintera', private_data: privateOk });   // health-check; nic o konfiguraci ven
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ====================== C) Publikace na web (tlačítko v Sheetu) ====================== */

function onOpen() {
  // samostatné, na první pohled viditelné menu jen s publikací (Šárka ho v menu Sintera nehledala)
  SpreadsheetApp.getUi().createMenu('▶ PUBLIKOVAT WEB').addItem('Publikovat na web teď', 'publishSite')
    .addItem('Použít výběr do archivu (list ARCHIV – rozhodnutí)', 'pouzijArchivNavrh').addToUi();
  SpreadsheetApp.getUi()
    .createMenu('Sintera')
    .addItem('Publikovat na web', 'publishSite')
    .addItem('Statistiky návštěvnosti (vytvořit/obnovit)', 'vytvorStatistiky')
    .addItem('Obory: dropdown + sjednotit', 'nastavOboryDropdown')
    .addToUi();
  // samoúdržba při otevření Sheetu: převod na sloupec stav (jednorázově) + highlight max 9
  try { migrujStavPozic_(); } catch (e) {}
  try { enforceFeaturedLimit_(); } catch (e) {}
  // statistiky teď žijí v neveřejné tabulce (osobní údaje a měření mimo veřejnou);
  // staví se na vyžádání z menu Sintera, protože k nim má přístup jen majitel.
}

function triggerBuild_() {
  var token = prop_('GH_TOKEN', '');
  if (!token) return { ok: false, detail: 'missing GH_TOKEN' };
  var owner = prop_('GH_OWNER', 'pavelkubiznak');
  var repo = prop_('GH_REPO', 'sintera-novy-web');
  var workflow = prop_('GH_WORKFLOW', 'deploy.yml');
  var branch = prop_('GH_BRANCH', 'main');
  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/actions/workflows/' + workflow + '/dispatches';
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
                 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sintera-sheet' },
      payload: JSON.stringify({ ref: branch }), muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 204) return { ok: true };
    return { ok: false, detail: 'github ' + code + ': ' + res.getContentText() };
  } catch (err) { return { ok: false, detail: String(err) }; }
}

function publishSite() {
  var ui = SpreadsheetApp.getUi();
  var vypnuto = enforceFeaturedLimit_();
  var r = triggerBuild_();
  if (r.ok) try { oznacPublikovano_(); } catch (e) {}
  var extra = vypnuto ? ' Pozn.: highlight nad limit 9 — u ' + vypnuto + ' starší pozice automaticky přepnuto na „vystaveno".' : '';
  if (r.ok) ui.alert('Spuštěno. Web se přebuilduje, za 1 až 2 minuty bude aktuální.' + extra);
  else ui.alert('Build se nepodařilo spustit: ' + (r.detail || 'neznámá chyba'));
}

/* ====================== C2) Stav pozice: jeden sloupec místo featured + zverejnit ====================== */
// Od 6. 10. 2026 řídí viditelnost pozice jediný sloupec `stav` s rozbalovacím seznamem:
//   vystaveno + highlight → na webu i na homepage (max 9)
//   vystaveno             → na webu v seznamu pozic
//   nevystaveno           → nikde (koncept, důvěrné, stažené)
//   archiv                → v archivu pozic jako ukázka práce pro firmy, nedá se na ni reagovat
var STAV = { HL: 'vystaveno + highlight', VYS: 'vystaveno', NE: 'nevystaveno', ARCH: 'archiv' };
var STAVY = [STAV.HL, STAV.VYS, STAV.NE, STAV.ARCH];

// Jednorázový převod (idempotentní): vloží sloupec stav na místo featured, naplní ho z featured/zverejnit,
// nastaví dropdown + barvy a staré dva sloupce smaže. Když už stav existuje, jen obnoví dropdown.
// Spouští se z doGet (web appka běží pod majitelem), při zápisu z GPT a při otevření Sheetu majitelem.
function migrujStavPozic_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('pozice');
  if (!sh || sh.getLastRow() < 1) return 'bez listu';
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var si = head.indexOf('stav');
  if (si >= 0) return 'uz hotovo';
  var fi = head.indexOf('featured'), zi = head.indexOf('zverejnit');
  if (fi < 0 && zi < 0) return 'chybi sloupce';
  var n = sh.getLastRow() - 1;
  var fv = n > 0 && fi >= 0 ? sh.getRange(2, fi + 1, n, 1).getValues() : [];
  var zv = n > 0 && zi >= 0 ? sh.getRange(2, zi + 1, n, 1).getValues() : [];
  var ano = function (v) { return String(v).trim().toLowerCase() === 'ano'; };
  var nove = [];
  for (var r = 0; r < n; r++) {
    var pub = zi < 0 || ano(zv[r][0]);
    nove.push([!pub ? STAV.NE : (fi >= 0 && ano(fv[r][0])) ? STAV.HL : STAV.VYS]);
  }
  var kam = Math.min(fi >= 0 ? fi : zi, zi >= 0 ? zi : fi);        // 0-based sloupec, kam stav přijde
  sh.insertColumnBefore(kam + 1);
  sh.getRange(1, kam + 1).setValue('stav').setFontWeight('bold');
  if (n > 0) sh.getRange(2, kam + 1, n, 1).setValues(nove);
  // staré sloupce se po vložení posunuly o 1 doprava; mazat od vyššího indexu
  var stare = [fi, zi].filter(function (i) { return i >= 0; }).map(function (i) { return i + 2; }).sort(function (a, b) { return b - a; });
  stare.forEach(function (c) { sh.deleteColumn(c); });
  nastavStavDropdown_(sh, kam);
  try { vytvorNavod(); } catch (e) {}   // návod v Sheetu popisuje nový sloupec
  return 'prevedeno ' + n + ' radku';
}

function nastavStavDropdown_(sh, ci) {
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  var range = sh.getRange(2, ci + 1, rows, 1);
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STAVY, true)
    .setAllowInvalid(false).setHelpText('vystaveno + highlight = web i homepage · vystaveno = web · nevystaveno = nikde · archiv = archiv pozic pro firmy').build());
  // barvy, ať je stav vidět na první pohled (stará pravidla pro tento sloupec nahradit, ostatní nechat)
  var col = ci + 1;
  var ostatni = sh.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (rg) { return rg.getColumn() === col && rg.getNumColumns() === 1; });
  });
  var barva = function (text, bg, fg) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setBackground(bg).setFontColor(fg).setRanges([range]).build();
  };
  sh.setConditionalFormatRules(ostatni.concat([
    barva(STAV.HL, '#f4d9cc', '#7a3518'), barva(STAV.VYS, '#d9ead3', '#274e13'),
    barva(STAV.NE, '#eeeeee', '#666666'), barva(STAV.ARCH, '#dfe3f3', '#1e2456')
  ]));
}

/* ====================== C4) Automatická publikace (bez tlačítka) ====================== */
// Kdokoli (Šárka, ChatGPT vyplňující Sheet) stačí změnit obsah; tlačítko není nutné. Časovač na serveru
// sintera-radar volá každých 5 minut /exec?sync=1. Build se spustí, když se obsah listů, ze kterých web
// čte, ZMĚNIL a pak se aspoň 4 minuty NEHÝBAL (rozepsaný řádek tak nejde ven v půlce psaní).
// Proč ne časovač přímo v Apps Scriptu: ScriptApp přidá nové oprávnění a web appka (formuláře na webu)
// by do nového odsouhlasení majitelem nefungovala.
var SYNC_LISTY = ['pozice', 'reference', 'case_studies', 'klienti', 'reference_zed'];
var SYNC_KLID_MS = 4 * 60 * 1000;
function otiskObsahu_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = SYNC_LISTY.map(function (n) { var sh = ss.getSheetByName(n); return sh ? sh.getDataRange().getDisplayValues() : null; });
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data), Utilities.Charset.UTF_8));
}
function oznacPublikovano_() {
  var h = otiskObsahu_(), pr = PropertiesService.getScriptProperties();
  pr.setProperties({ SYNC_BUILT: h, SYNC_SEEN: h, SYNC_SEEN_AT: String(Date.now()) });
}
function synchronizujWeb_() {
  var pr = PropertiesService.getScriptProperties();
  var h = otiskObsahu_(), now = Date.now();
  var built = pr.getProperty('SYNC_BUILT');
  if (!built) { pr.setProperties({ SYNC_BUILT: h, SYNC_SEEN: h, SYNC_SEEN_AT: String(now) }); return 'start'; } // první běh: výchozí stav
  if (h === built) return 'beze zmen';
  if (h !== pr.getProperty('SYNC_SEEN')) { pr.setProperties({ SYNC_SEEN: h, SYNC_SEEN_AT: String(now) }); return 'zmena, cekam na klid'; }
  if (now - Number(pr.getProperty('SYNC_SEEN_AT') || 0) < SYNC_KLID_MS) return 'cekam na klid';
  try { enforceFeaturedLimit_(); } catch (e) {}
  h = otiskObsahu_();   // limit highlightů mohl změnit list
  var r = triggerBuild_();
  if (!r.ok) return 'build se nespustil: ' + (r.detail || '');
  pr.setProperties({ SYNC_BUILT: h, SYNC_SEEN: h, SYNC_SEEN_AT: String(now) });
  return 'build spusten';
}

// Barevné tlačítko „▶ PUBLIKOVAT NA WEB" v levém horním rohu listu pozice (obrázek s přiřazeným skriptem).
// Hlavička se kvůli němu zvýší a text sloupců se zarovná dolů, takže ho tlačítko nezakryje.
var TLACITKO_PNG = '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';
function vlozTlacitkoPublikovat_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('pozice');
  if (!sh) return 'bez listu';
  var uz = sh.getImages().some(function (im) { return im.getAltTextTitle() === 'publikovat'; });
  if (uz) return 'uz je';
  sh.setRowHeight(1, 64);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setVerticalAlignment('bottom');
  var blob = Utilities.newBlob(Utilities.base64Decode(TLACITKO_PNG), 'image/png', 'publikovat.png');
  var img = sh.insertImage(blob, 1, 1, 6, 4);
  img.setWidth(230).setHeight(34).setAltTextTitle('publikovat')
     .setAltTextDescription('Klikni: web se hned přestaví ze Sheetu (jinak se to stane samo do 10 minut).');
  img.assignScript('publishSite');
  return 'vlozeno';
}

/* ====================== C3) Highlight: max 9 nejnovějších ====================== */
// Homepage zobrazuje max 9 pozic ve stavu „vystaveno + highlight" (v pořadí Sheetu, nové jsou nahoře).
// Tahle funkce projde list pozice shora dolů a u pozic nad limit 9 automaticky přepne stav
// na „vystaveno" (tj. z homepage vypadne vždy ta nejstarší zařazená, na webu zůstane).
// Volá se automaticky při zápisu z GPT a při kliknutí na Sintera → Publikovat na web.
function enforceFeaturedLimit_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('pozice');
  if (!sh) return 0;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return 0;
  var head = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var si = head.indexOf('stav');
  if (si >= 0) {
    var hl = 0, zmeneno = 0;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][si]).trim().toLowerCase() !== STAV.HL) continue;
      hl++;
      if (hl > 9) { sh.getRange(i + 1, si + 1).setValue(STAV.VYS); zmeneno++; }
    }
    return zmeneno;
  }
  // starý formát (před migrací): featured + zverejnit
  var fi = head.indexOf('featured'), zi = head.indexOf('zverejnit');
  if (fi < 0) return 0;
  var kept = 0, changed = 0;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][fi]).trim().toLowerCase() !== 'ano') continue;
    var published = zi < 0 || String(data[r][zi]).trim().toLowerCase() === 'ano';
    if (!published) continue; // koncepty do limitu nepočítáme a nevypínáme
    kept++;
    if (kept > 9) { sh.getRange(r + 1, fi + 1).setValue('ne'); changed++; }
  }
  return changed;
}

/* ====================== G) Archiv: list k rozhodnutí (které pozice do archivu) ====================== */
// Jednorázový pomocník (6. 10. 2026): list se zaškrtávacími políčky u všech vystavených pozic.
// Předškrtnuté = nejstarší inzeráty ze starého webu. Tlačítko / menu „Použít výběr do archivu"
// přepne zaškrtnuté na stav archiv (odškrtnuté archivní vrátí na vystaveno) a spustí build.
// Párování na řádky listu pozice: název + pořadí výskytu stejného názvu (stejně jako build přiděluje id)
// + kontrola kraje. Po rozhodnutí jde list smazat; znovu se sám nezaloží (Script Property ARCHIV_NAVRH_V1).
var ARCHIV_NAVRH_LIST = 'ARCHIV – rozhodnutí';
var ARCHIV_NAVRH = [{"id":465,"t":"Zkušební technik","kr":"Praha / Středočeský kraj","occ":1,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":521,"t":"Servisní technik","kr":"Praha / Středočeský kraj","occ":2,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":539,"t":"Frézař – CNC","kr":"Plzeňský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":540,"t":"Horizontkář CNC","kr":"Plzeňský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":541,"t":"Programátor CNC","kr":"Plzeňský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":570,"t":"Manager vývojového a testovacího centra","kr":"Vysočina","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":571,"t":"Electrical Designer","kr":"Praha","occ":1,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":574,"t":"Specialista elektroúdržby","kr":"Pardubický kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":592,"t":"Vývojový konstruktér","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":602,"t":"Testovací technik","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":603,"t":"Zkušební specialista","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":620,"t":"Servisní technik","kr":"Praha / Středočeský kraj","occ":1,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":623,"t":"Technolog","kr":"Plzeňský kraj","occ":2,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":634,"t":"CNC Frézař","kr":"Plzeňský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":670,"t":"Technik údržby","kr":"Vysočina / Jihomoravský kraj","occ":2,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":680,"t":"Dispečer/ka logistiky","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":683,"t":"Converter Engineer","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":688,"t":"Electrical Engineer","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":691,"t":"Electrical Designer","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":694,"t":"Seřizovač CNC soustruhu","kr":"Jihomoravský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":695,"t":"Seřizovač CNC karuselu","kr":"Jihomoravský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":700,"t":"Svářeč","kr":"Jihomoravský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":719,"t":"Strojní zámečník","kr":"Plzeňský kraj","occ":1,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":723,"t":"Seřizovač CNC strojů","kr":"Plzeňský kraj / Karlovarský kraj","occ":1,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":735,"t":"Technik údržby","kr":"Vysočina","occ":1,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":736,"t":"Project Manager (AJ + NJ)","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":744,"t":"Seřizovač CNC soustruh/frézka","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":754,"t":"Technolog","kr":"Plzeňský kraj","occ":1,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":764,"t":"Projektový manažer","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":766,"t":"Electrical Designer Senior/Junior","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":772,"t":"Seřizovač CNC strojů","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":776,"t":"Servisní technik","kr":"Praha / Středočeský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":777,"t":"Zkušební technik","kr":"Praha","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":778,"t":"Elektromechanik","kr":"Praha / Středočeský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":781,"t":"Process Engineer – Automatisation and Robotics","kr":"Vysočina","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":784,"t":"Strojní zámečník","kr":"Jihomoravský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":787,"t":"Inženýr kvality","kr":"Plzeňský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší), má nový popis, asi ještě běží","pre":false},{"id":790,"t":"Stavbyvedoucí","kr":"Celá ČR","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":792,"t":"Field Service & Site Manager","kr":"Německo","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":793,"t":"Project Manager","kr":"Německo","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":795,"t":"Project Procurement Manager","kr":"Celá ČR / Německo","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":798,"t":"Specialista technologie","kr":"Plzeňský kraj","occ":0,"g":"A","rec":"archivovat (nejstarší)","pre":true},{"id":803,"t":"Service Manager","kr":"Olomoucký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":805,"t":"Supplier Quality Engineer","kr":"Praha","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":813,"t":"Sales Manager für Deutschland","kr":"Německo","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":814,"t":"CNC Programátor – špičková přesná výroba","kr":"Liberecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":822,"t":"Programátor robotů","kr":"Plzeňský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":824,"t":"International Talent Acquisition Partner","kr":"Praha / Středočeský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":827,"t":"Manažer technické a analytické laboratoře","kr":"Celá ČR","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":829,"t":"Logistics Coordinator","kr":"Praha","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":830,"t":"Vedoucí výroby","kr":"Pardubický kraj","occ":0,"g":"B","rec":"rozhodnout, má nový popis, asi ještě běží","pre":false},{"id":832,"t":"Obchodní manažer – technická řešení (B2B)","kr":"Olomoucký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":833,"t":"Technolog","kr":"Praha","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":834,"t":"Manažer CNC výroby – strategická role","kr":"Liberecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":835,"t":"CNC specialista – CAM + výroba","kr":"Liberecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":836,"t":"CNC Programátor / Specialista","kr":"Liberecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":838,"t":"Finanční Controller","kr":"Liberecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":839,"t":"Project Financial Controller","kr":"Liberecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":840,"t":"Vedoucí týmu","kr":"Vysočina","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":843,"t":"Seřizovač","kr":"Plzeňský kraj","occ":0,"g":"B","rec":"rozhodnout, má nový popis, asi ještě běží","pre":false},{"id":844,"t":"Talent Acquisition Specialist (specialisté & management)","kr":"Královéhradecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":845,"t":"Specialista údržby výrobních linek a zařízení","kr":"Plzeňský kraj","occ":1,"g":"B","rec":"rozhodnout","pre":false},{"id":846,"t":"Specialista zařízení","kr":"Praha / Středočeský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":847,"t":"Specialista údržby výrobních linek a zařízení","kr":"Královéhradecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":848,"t":"Vedoucí výrobního úseku","kr":"Liberecký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":849,"t":"Analytik logistických procesů","kr":"Praha","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":852,"t":"Vedoucí montáže","kr":"Olomoucký kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":853,"t":"PLC Specialista","kr":"Praha / Středočeský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":855,"t":"HR Partner pro mezinárodní prostředí","kr":"Praha / Středočeský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":856,"t":"Operations Manager | strategická výrobní role","kr":"Jihomoravský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":857,"t":"Servisní specialista","kr":"Jihomoravský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":858,"t":"Technik údržby","kr":"Vysočina","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":859,"t":"Specialista výrobních technologií","kr":"Vysočina / Jihomoravský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":861,"t":"People & HR Specialist","kr":"Vysočina / Jihomoravský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":862,"t":"Obchodně-technický ředitel","kr":"Jihomoravský kraj / Vysočina","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":863,"t":"Procesní manažer","kr":"Vysočina / Jihomoravský kraj","occ":0,"g":"B","rec":"rozhodnout","pre":false},{"id":864,"t":"Projektant","kr":"Pardubický kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":865,"t":"Procurement Specialist","kr":"Liberecký kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":866,"t":"Specialista logistiky","kr":"Praha / Středočeský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":867,"t":"Nástrojař","kr":"Královéhradecký kraj / Pardubický kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":868,"t":"Seřizovač","kr":"Královéhradecký kraj / Pardubický kraj","occ":1,"g":"C","rec":"nechat (novější)","pre":false},{"id":869,"t":"Mistr","kr":"Vysočina","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":870,"t":"Quality Leader","kr":"Praha / Středočeský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":871,"t":"Specialista kvality","kr":"Praha / Středočeský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":872,"t":"Skladník / skladnice","kr":"Pardubický kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":873,"t":"IT specialista / specialistka pro systémy a technologie","kr":"Pardubický kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":874,"t":"Projektový inženýr / projektová inženýrka","kr":"Pardubický kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":875,"t":"Vedoucí výroby","kr":"Plzeňský kraj","occ":1,"g":"C","rec":"nechat (novější)","pre":false},{"id":876,"t":"Inženýr kvality","kr":"Liberecký kraj","occ":1,"g":"C","rec":"nechat (novější)","pre":false},{"id":877,"t":"Procurement Manager","kr":"Plzeňský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":878,"t":"Technický projektový manažer R&D","kr":"Ostravský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":879,"t":"Manažer výroby","kr":"Zlínský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":880,"t":"Financial Controller","kr":"Plzeňský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":881,"t":"Procesní inženýr","kr":"Vysočina / Jihomoravský kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":882,"t":"Inženýr kvality","kr":"Vysočina / Jihomoravský kraj","occ":2,"g":"C","rec":"nechat (novější)","pre":false},{"id":883,"t":"Seřizovač","kr":"Vysočina","occ":2,"g":"C","rec":"nechat (novější)","pre":false},{"id":884,"t":"SAP Application Owner","kr":"Pardubický kraj","occ":0,"g":"C","rec":"nechat (novější)","pre":false},{"id":885,"t":"Supplier Quality & Development Manager","kr":"Plzeňský kraj","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":887,"t":"HR specialista","kr":"Jihomoravský kraj / Vysočina","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":889,"t":"HR specialista / recruiter","kr":"Jihomoravský kraj / Vysočina","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":891,"t":"Mistr výroby","kr":"Jihomoravský kraj / Vysočina","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":892,"t":"Vedoucí oddělení Pozemní stavby","kr":"Praha","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":893,"t":"Vedoucí oddělení Statika a dynamika staveb","kr":"Praha / Zlínský kraj","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":894,"t":"Vedoucí oddělení Vodohospodářské stavby a TZB","kr":"Praha","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":895,"t":"Vedoucí požární ochrany a BOZP","kr":"Praha","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false},{"id":896,"t":"Key Account Manager / Business Development Manager","kr":"Liberecký kraj","occ":0,"g":"C","rec":"nechat (novější), je na homepage","pre":false}];
var POUZIT_PNG = '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';
var normNazev_ = function (s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); };

function vytvorArchivNavrh_() {
  var pr = PropertiesService.getScriptProperties();
  if (pr.getProperty('ARCHIV_NAVRH_V1')) return 'uz bylo';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(ARCHIV_NAVRH_LIST)) { pr.setProperty('ARCHIV_NAVRH_V1', '1'); return 'uz je'; }
  var sh = ss.insertSheet(ARCHIV_NAVRH_LIST, 1);
  sh.getRange(1, 1).setValue('Které pozice dát do archivu?').setFontSize(15).setFontWeight('bold');
  sh.getRange(2, 1).setValue('✔ zaškrtnuto = do archivu (na webu v Archivu pozic jako ukázka naší práce pro firmy, nedá se na ni reagovat). ' +
    'Prázdné = zůstává vystavená. Předškrtnuté jsou nejstarší inzeráty ze starého webu, uprav podle toho, co ještě běží. ' +
    'Až budeš hotová, klikni na modré tlačítko POUŽÍT VÝBĚR → ARCHIV. Za 2 minuty je to na webu. Kdykoli jde změnit: přeškrtni a klikni znovu. ' +
    'Inzerát, který nesmí vidět nikdo (důvěrné), sem nepatří: ten dej v listu pozice na nevystaveno.');
  sh.getRange(2, 1, 1, 6).merge().setWrap(true).setVerticalAlignment('top');
  sh.setRowHeight(2, 64); sh.setRowHeight(3, 46);
  var head = ['Do archivu', 'Pozice', 'Kraj', 'Skupina', 'Doporučení', 'Na webu', 'id', 'vyskyt'];
  sh.getRange(4, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#1e2456').setFontColor('#ffffff');
  var skup = { A: 'A · nejstarší', B: 'B · starší', C: 'C · novější' };
  var rows = ARCHIV_NAVRH.map(function (x) { return [x.pre, x.t, x.kr, skup[x.g], x.rec, '', x.id, x.occ]; });
  var r0 = 5, n = rows.length;
  sh.getRange(r0, 1, n, head.length).setValues(rows);
  sh.getRange(r0, 1, n, 1).insertCheckboxes();
  sh.getRange(r0, 1, n, 1).setValues(ARCHIV_NAVRH.map(function (x) { return [x.pre]; }));
  sh.getRange(r0, 6, n, 1).setRichTextValues(ARCHIV_NAVRH.map(function (x) {
    var url = 'https://www.sintera.cz/pozice/' + x.id + '.html';
    return [SpreadsheetApp.newRichTextValue().setText('otevřít inzerát').setLinkUrl(url).build()];
  }));
  var barvy = { A: '#fbeee8', B: '#fff8e1', C: '#eef6ea' };
  sh.getRange(r0, 1, n, 6).setBackgrounds(ARCHIV_NAVRH.map(function (x) { var b = barvy[x.g]; return [b, b, b, b, b, b]; }));
  sh.setFrozenRows(4);
  sh.setColumnWidth(1, 90); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 230); sh.setColumnWidth(4, 110);
  sh.setColumnWidth(5, 300); sh.setColumnWidth(6, 120);
  sh.hideColumns(7, 2);
  sh.getRange(r0, 1, n, 1).setHorizontalAlignment('center');
  var img = sh.insertImage(Utilities.newBlob(Utilities.base64Decode(POUZIT_PNG), 'image/png', 'pouzit.png'), 2, 3, 0, 6);
  img.setWidth(250).setHeight(34).setAltTextTitle('pouzit-archiv');
  img.assignScript('pouzijArchivNavrh');
  pr.setProperty('ARCHIV_NAVRH_V1', '1');
  return 'vytvoreno ' + n;
}

function pouzijArchivNavrh() {
  var ui = null; try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  var hlas = function (t) { if (ui) ui.alert(t); return t; };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nav = ss.getSheetByName(ARCHIV_NAVRH_LIST);
  if (!nav || nav.getLastRow() < 5) return hlas('List „' + ARCHIV_NAVRH_LIST + '" nenalezen.');
  var chtene = {};
  nav.getRange(5, 1, nav.getLastRow() - 4, 8).getValues().forEach(function (r) {
    if (r[1] === '') return;
    chtene[normNazev_(r[1]) + '#' + r[7]] = { archiv: r[0] === true, kraj: String(r[2]).trim(), nazev: r[1], hotovo: false };
  });
  var sh = ss.getSheetByName('pozice');
  var data = sh.getDataRange().getValues();
  var head = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var ni = head.indexOf('nazev'), ki = head.indexOf('kraj'), si = head.indexOf('stav');
  if (si < 0) return hlas('V listu pozice chybí sloupec stav.');
  var vyskyt = {}, doArchivu = 0, zpet = 0, nesedi = [];
  for (var i = 1; i < data.length; i++) {
    var st = String(data[i][si]).trim().toLowerCase();
    if (st.indexOf(STAV.VYS) !== 0 && st !== STAV.ARCH) continue;      // jen viditelné (jako build), nevystaveno se nepočítá
    var k = normNazev_(data[i][ni]), o = vyskyt[k] || 0; vyskyt[k] = o + 1;
    var c = chtene[k + '#' + o]; if (!c) continue;
    if (String(data[i][ki]).trim() !== c.kraj) { nesedi.push(c.nazev); continue; }
    c.hotovo = true;
    var novy = c.archiv ? STAV.ARCH : (st === STAV.ARCH ? STAV.VYS : st);
    if (novy === st) continue;
    sh.getRange(i + 1, si + 1).setValue(novy);
    if (c.archiv) doArchivu++; else zpet++;
  }
  Object.keys(chtene).forEach(function (k) { if (!chtene[k].hotovo && nesedi.indexOf(chtene[k].nazev) < 0) nesedi.push(chtene[k].nazev); });
  var r = (doArchivu || zpet) ? triggerBuild_() : { ok: true };
  if (r.ok && (doArchivu || zpet)) try { oznacPublikovano_(); } catch (e) {}
  var archivCelkem = sh.getRange(2, si + 1, sh.getLastRow() - 1, 1).getValues()
    .filter(function (v) { return String(v[0]).trim().toLowerCase() === STAV.ARCH; }).length;
  return hlas('Hotovo. Do archivu přesunuto: ' + doArchivu + ', vráceno mezi vystavené: ' + zpet + '. V archivu je teď ' + archivCelkem + ' pozic.' +
    ((doArchivu || zpet) ? (r.ok ? ' Web se aktualizuje, za 1 až 2 minuty: www.sintera.cz/pozice/archiv/' : ' POZOR: build se nespustil (' + (r.detail || '') + '), web se aktualizuje sám do 10 minut.') : ' Nic se neměnilo.') +
    (nesedi.length ? ' Nenašla jsem v listu pozice (asi přejmenované nebo smazané): ' + nesedi.join(', ') + '.' : ''));
}

/* ====================== D) Návod v Sheetu (list NÁVOD) ====================== */
function vytvorNavod() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('NÁVOD');
  if (!sh) sh = ss.insertSheet('NÁVOD', 0);
  sh.clear();

  var lines = [
    'PROVOZ WEBU sintera.cz — návod',
    'Web se staví automaticky z tohoto Sheetu. Pozice řídí sloupec stav, reference a case studies sloupec zverejnit = ano. Build trvá 1 až 2 minuty.',
    '',
    '1) Přidat obsah přes ChatGPT (nejrychlejší)',
    'Otevři firemní ChatGPT, custom GPT „Sintera – obsah na web". Vlož syrové zadání (pozice, reference nebo case study).',
    'GPT připraví náhled a zeptá se: uložit jako koncept, nebo zveřejnit na web? U pozice i: má být na homepage (highlight)?',
    'Když potvrdíš „zveřejnit", zapíše se to sem a hned se spustí build. Za 1 až 2 minuty je živý.',
    '',
    '2) Stav pozice (sloupec stav, rozbalovací seznam)',
    'vystaveno + highlight = na webu i na homepage (max 9) · vystaveno = na webu v seznamu pozic · nevystaveno = nikde (koncept, důvěrné, stažené) · archiv = v archivu pozic.',
    'Archiv je pro firmy: ukazuje, jaké pozice jsme obsazovali (bez mzdy, bez data, nedá se na ně reagovat). Inzerát, který nesmí vidět nikdo (třeba kvůli klientovi), dej na nevystaveno, ne do archivu.',
    'Skončil nábor? Přepni stav na archiv. Řádek nemaž.',
    'Reference a case studies dál řídí sloupec zverejnit: ano = na webu, ne = koncept.',
    '',
    '3) Publikace na web: sama, nebo oranžovým tlačítkem',
    'Web se po změně v Sheetu přestaví SÁM: když se obsah 5 minut nemění, do dalších 5 minut se spustí build. Nic se nemusí mačkat (ani ChatGPT, který Sheet vyplňuje).',
    'Hned teď: oranžové tlačítko ▶ PUBLIKOVAT NA WEB vlevo nahoře v listu pozice, nebo horní menu ▶ PUBLIKOVAT WEB. Za 1 až 2 minuty se to projeví.',
    '',
    '4) Pořadí pozic (nové nahoře)',
    'Nové záznamy z ChatGPT se vkládají na řádek 2 (nahoru), takže jsou nahoře i na webu. Pořadí na webu = pořadí v Sheetu. Ručně: přesuň řádky a dej Publikovat.',
    '',
    '5) Highlight (homepage) — max 9, nejnovější',
    'Stav vystaveno + highlight → pozice se ukáže i na homepage. Homepage zobrazuje max 9; při přidání desáté se ta nejstarší zařazená automaticky přepne na vystaveno (při zápisu z GPT i při Publikovat).',
    '',
    '6) Formulář na reference (na webu)',
    'Návštěvník zadá firemní e-mail a přijde mu odkaz na neveřejnou stránku s referencemi. Volné e-maily (gmail, seznam) jsou blokované.',
    'Každá žádost se loguje do listu leady_reference. E-mail odchází přes Gmail účtu, kde běží skript (kopie v Odeslané).',
    '',
    '7) Loga nových klientů',
    'Existující klient (logo máme) → v referenci stačí logo_slug a logo se ukáže. Nový klient → zatím se ukáže název firmy textem (nic se nerozbije).',
    'Přidat logo: hoď soubor do repo složky assets/logos/raw/_nova/, pojmenuj slugem klienta, a v Coworku řekni „Zpracuj nová loga ze složky _nova". Detaily: assets/logos/raw/_nova/README.md.',
    '',
    '8) Statistika návštěvnosti',
    'Měří se vlastním cookieless počítadlem do listu navstevy (čas, typ, stránka, zdroj, akce). Bez cookies a bez ukládání IP. Souhrny: list statistiky (menu Sintera → Statistiky návštěvnosti).',
    'Vlastní návštěvy nepočítat: na každém svém zařízení jednou otevři https://www.sintera.cz/?nosterk=1 (zpět zapneš přes ?nosterk=0).',
    '',
    '9) Tokeny a bezpečnost',
    'Tajné tokeny (zápis z GPT, GitHub) jsou v Apps Scriptu → Projektová nastavení → Vlastnosti skriptu. NEJSOU v Sheetu ani na webu. Nikam je nekopíruj a nesdílej.',
    '',
    '10) Kde co najdu',
    'Web: https://www.sintera.cz',
    'Repo: https://github.com/pavelkubiznak/sintera-novy-web',
    'Apps Script: v Sheetu menu Rozšíření → Apps Script',
    'Návod na loga: assets/logos/raw/_nova/README.md. Tento návod: assets/PROVOZ.md',
    '',
    '11) Větší úpravy webu',
    'Na změny vzhledu, struktury nebo buildu použij Claude Code / Cowork. Běžný provoz (obsah) zvládneš odsud ze Sheetu a z ChatGPT.'
  ];

  var values = lines.map(function (t) { return [t]; });
  sh.getRange(1, 1, values.length, 1).setValues(values);
  sh.setColumnWidth(1, 820);
  sh.getRange(1, 1, values.length, 1).setWrap(true).setVerticalAlignment('top');
  for (var i = 0; i < lines.length; i++) {
    if (i === 0 || /^\d+\)/.test(lines[i])) sh.getRange(i + 1, 1).setFontWeight('bold');
  }
  sh.getRange(1, 1).setFontSize(13);
  sh.setFrozenRows(1);
  try { ss.setActiveSheet(sh); ss.moveActiveSheet(1); } catch (e) {}
  try { SpreadsheetApp.getUi().alert('Hotovo. Vlevo dole je nový list „NÁVOD".'); } catch (e) {}
}

/* ====================== E) Obory: dropdown + sjednocení názvů ====================== */
function nastavOboryDropdown() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('pozice');
  if (!sh) { SpreadsheetApp.getUi().alert('List "pozice" nenalezen.'); return; }
  var OBORY = {
    stroj: 'Strojírenství',
    prumysl: 'Výroba a průmysl',
    elektro: 'Elektrotechnika a energetika',
    technika: 'Technika a vývoj',
    kvalita: 'Kvalita a kontrola jakosti',
    servis: 'Servis a údržba',
    doprava: 'Doprava, logistika a zásobování',
    nakup: 'Nákup',
    projekty: 'Projekty a stavebnictví',
    obchod: 'Prodej a obchod',
    finance: 'Ekonomika a podnikové finance',
    hr: 'Personalistika a HR'
  };
  var labels = Object.keys(OBORY).map(function (k) { return OBORY[k]; });
  function deburr(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var byLabel = {}; labels.forEach(function (l) { byLabel[deburr(l)] = l; });
  function classify(obor, title) {
    var o = deburr(obor).trim();
    if (byLabel[o]) return byLabel[o];
    if (OBORY[o]) return OBORY[o];
    var t = deburr(title);
    if (/\bcnc\b|frez|soustruh|soustruz|zamec|svar|serizov|obrab|horizontk|karusel/.test(t)) return OBORY.stroj;
    if (/electric|elektro|\bplc\b|robot|converter|automat/.test(t)) return OBORY.elektro;
    if (/technolog|konstrukt|vyvoj|testovac|process engineer/.test(t)) return OBORY.technika;
    if (/procure|nakup/.test(t)) return OBORY.nakup;
    if (/logist|dispec|zasob|sklad|doprav/.test(t)) return OBORY.doprava;
    if (/vyrob|montaz|operations|operator|procesn|vedouci|mistr|smen/.test(t)) return OBORY.prumysl;
    var legacy = { vyroba: OBORY.stroj, auto: OBORY.elektro, tech: OBORY.technika, logistika: OBORY.doprava };
    return legacy[o] || OBORY.prumysl;
  }
  var data = sh.getDataRange().getValues();
  var head = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var ci = head.indexOf('obor'), ni = head.indexOf('nazev');
  if (ci < 0) { SpreadsheetApp.getUi().alert('Sloupec "obor" nenalezen.'); return; }
  for (var r = 1; r < data.length; r++) {
    var title = ni >= 0 ? data[r][ni] : '';
    if (!title && !data[r][ci]) continue;
    sh.getRange(r + 1, ci + 1).setValue(classify(data[r][ci], title));
  }
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(labels, true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, ci + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  SpreadsheetApp.getUi().alert('Hotovo: sloupec „obor" má dropdown a existující řádky jsou doplněné názvy.');
}

/* ====================== F) Jednorázová oprava starých časů v "navstevy" ====================== */
// Staré řádky (před opravou pásma) mají čas o 9 h vzadu v českém formátu.
// Posune je na pražský čas a převede do stejného ISO formátu jako nové.
// RYCHLÉ: jedno čtení + jeden zápis (žádné vypršení). Opakovatelné: už opravené (ISO) řádky přeskočí.
function opravStareCasy() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('navstevy');
  if (!sh) { SpreadsheetApp.getUi().alert('List "navstevy" nenalezen.'); return; }
  var n = sh.getLastRow();
  if (n < 2) { SpreadsheetApp.getUi().alert('Žádná data k opravě.'); return; }
  var rng = sh.getRange(1, 1, n, 1);
  var disp = rng.getDisplayValues();
  var pad = function (x) { return x < 10 ? '0' + x : '' + x; };
  var opraveno = 0;
  var out = disp.map(function (row) {
    var s = String(row[0]);
    var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/);
    if (!m) return [s];
    var d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
    d.setHours(d.getHours() + 9);
    opraveno++;
    return [d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())];
  });
  rng.setValues(out);
  SpreadsheetApp.getUi().alert('Opraveno řádků: ' + opraveno);
}

/* ====================== G) Statistiky návštěvnosti (list "statistiky") ====================== */
// Vytvoří/obnoví list "statistiky" se ŽIVÝMI vzorci nad listem navstevy — čísla se
// aktualizují sama s každou návštěvou, nic dalšího se nemusí spouštět.
// Spuštění: menu Sintera → Statistiky návštěvnosti (nebo Run → vytvorStatistiky).
// Opakované spuštění list jen znovu postaví (bezpečné).
function vytvorStatistiky() {
  var ss = neverejnaTabulka_();                 // statistiky patří k datům měření, ne do veřejné tabulky
  var sh = ss.getSheetByName('statistiky');
  if (!sh) sh = ss.insertSheet('statistiky');
  sh.clear();

  sh.getRange('A1').setValue('STATISTIKY NÁVŠTĚVNOSTI').setFontWeight('bold').setFontSize(14);
  sh.getRange('A2').setValue('Živé vzorce nad listem navstevy — aktualizují se samy. Časy jsou pražské.').setFontColor('#888888');

  // POZOR: středníky jako oddělovače argumentů — česká locale Sheetu čárky nebere (parse error);
  // středník funguje ve všech locale. Čárky UVNITŘ query stringu jsou syntaxe QUERY, ty zůstávají.
  var kpi = [
    ['Dnes (zobrazení + akce)', '=COUNTIFS(navstevy!A:A;">="&TODAY();navstevy!A:A;"<"&(TODAY()+1))'],
    ['Posledních 7 dní', '=COUNTIFS(navstevy!A:A;">="&(TODAY()-6))'],
    ['Posledních 30 dní', '=COUNTIFS(navstevy!A:A;">="&(TODAY()-29))'],
    ['30 dní jen zvenku (bez interních prokliků)', '=COUNTIFS(navstevy!A:A;">="&(TODAY()-29);navstevy!D:D;"<>(interní)")'],
    ['Celkem zobrazení stránek (od začátku měření)', '=COUNTIF(navstevy!B:B;"pageview")'],
    ['Celkem akcí (kliky na e-mail/telefon, formuláře)', '=COUNTIF(navstevy!B:B;"event")']
  ];
  for (var i = 0; i < kpi.length; i++) {
    sh.getRange(4 + i, 1).setValue(kpi[i][0]).setFontWeight('bold');
    sh.getRange(4 + i, 2).setFormula(kpi[i][1]).setHorizontalAlignment('left');
  }

  sh.getRange('A11').setValue('NÁVŠTĚVY PO DNECH (posledních 30)').setFontWeight('bold');
  sh.getRange('A12').setFormula('=QUERY(navstevy!A2:E;"select toDate(A), count(B) where A is not null group by toDate(A) order by toDate(A) desc limit 30 label toDate(A) \'Den\', count(B) \'Návštěv\'";0)');

  sh.getRange('D11').setValue('NEJNAVŠTĚVOVANĚJŠÍ STRÁNKY (30 dní)').setFontWeight('bold');
  sh.getRange('D12').setFormula('=QUERY(navstevy!A2:E;"select C, count(B) where B=\'pageview\' and A >= date \'"&TEXT(TODAY()-29;"yyyy-mm-dd")&"\' group by C order by count(B) desc limit 20 label C \'Stránka\', count(B) \'Zobrazení\'";0)');

  sh.getRange('G11').setValue('ODKUD LIDÉ PŘICHÁZEJÍ (30 dní)').setFontWeight('bold');
  sh.getRange('G12').setFormula('=QUERY(navstevy!A2:E;"select D, count(B) where B=\'pageview\' and A >= date \'"&TEXT(TODAY()-29;"yyyy-mm-dd")&"\' group by D order by count(B) desc limit 15 label D \'Zdroj\', count(B) \'Návštěv\'";0)');

  sh.getRange('J11').setValue('AKCE (kliky a formuláře)').setFontWeight('bold');
  sh.getRange('J12').setFormula('=QUERY(navstevy!A2:E;"select E, count(B) where B=\'event\' group by E order by count(B) desc limit 15 label E \'Akce\', count(B) \'Počet\'";0)');

  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 110);
  sh.setColumnWidth(4, 260); sh.setColumnWidth(5, 100);
  sh.setColumnWidth(7, 220); sh.setColumnWidth(8, 100);
  sh.setColumnWidth(10, 200); sh.setColumnWidth(11, 90);
  sh.setColumnWidth(3, 30); sh.setColumnWidth(6, 30); sh.setColumnWidth(9, 30);
  sh.setFrozenRows(3);
  try { ss.setActiveSheet(sh); } catch (e) {}
  try { SpreadsheetApp.getUi().alert('Hotovo. List „statistiky" je vytvořený a aktualizuje se sám.'); } catch (e) {}
}
