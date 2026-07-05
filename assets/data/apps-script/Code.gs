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

/* ====================== A) ZÁPIS OBSAHU (token) ====================== */

var list = function (v) { return Array.isArray(v) ? v.join('\n') : (v || ''); };
var consent = function (v) { return v === true || v === 'ano' ? 'ano' : 'ne'; };

var TARGETS = {
  pozice: {
    sheet: 'pozice',
    headers: ['nazev','obor','seniorita','kraj','uvazek','rezim','bonus','mzda_rozsah','mzda_pozn',
      'uvod','proc_mluvit','naplne','must','vyhoda','nabizime','cta','featured','zverejnit',
      'datum_zverejneni','platnost_do'],
    build: function (p) {
      return {
        nazev: p.title || '', obor: p.category || '', seniorita: p.seniority || '',
        kraj: p.region || '', uvazek: p.employmentType || 'FULL_TIME', rezim: p.workMode || 'onsite',
        bonus: p.bonus || '', mzda_rozsah: p.salaryRange || '', mzda_pozn: p.salaryNote || '',
        uvod: p.intro || '', proc_mluvit: list(p.whyTalk), naplne: list(p.responsibilities),
        must: list(p.mustHave), vyhoda: list(p.niceToHave), nabizime: list(p.offer),
        cta: p.cta || '', featured: p.featured ? 'ano' : 'ne', zverejnit: 'ne',
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
  var sh = ss.getSheetByName(def.sheet) || ss.insertSheet(def.sheet);
  if (sh.getLastRow() === 0) sh.appendRow(def.headers);

  var map = def.build(record);
  if (publish && def.headers.indexOf('zverejnit') !== -1) map.zverejnit = 'ano';
  var values = def.headers.map(function (h) { return map[h]; });
  // nový záznam navrch: vlož řádek hned pod hlavičku (newest-first v Sheetu i na webu)
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, values.length).setValues([values]);
  var row = 2;

  // homepage zobrazuje max 9 featured — nejstarší nad limit se automaticky vypnou
  var featuredVypnuto = 0;
  if (target === 'pozice') featuredVypnuto = enforceFeaturedLimit_();

  var built = false, buildDetail = '';
  if (publish) { var r = triggerBuild_(); built = r.ok; buildDetail = r.detail || ''; }
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
    phone: (body.phone || '').trim(), name: (body.name || '').trim(),
    position: (body.position || '').trim(), source: (body.source || '').trim(),
    consent: 'ano'
  });

  var landing = prop_('LANDING_URL', '');
  if (!landing) return json_({ ok: false, error: 'missing_landing_url' });
  var send = sendReferenceEmail_(email, body.name || '', landing);
  if (!send.ok) return json_({ ok: false, error: 'send_failed', detail: send.detail });

  return json_({ ok: true });
}

function logLead_(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('leady_reference') || ss.insertSheet('leady_reference');
  var headers = ['cas','email','firma_domena','telefon','jmeno','pozice','zdroj','souhlas'];
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  sh.appendRow([
    new Date(), d.email, d.domain, d.phone, d.name, d.position, d.source, d.consent
  ]);
}

function sendReferenceEmail_(to, name, landing) {
  var from = prop_('FROM_EMAIL', '');
  var replyTo = prop_('REPLY_TO', 'info@sintera.cz');

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
    var t = body.t === 'event' ? 'event' : 'pageview';
    var path = String(body.path || '').slice(0, 200);
    var name = String(body.name || '').slice(0, 80);
    var zdroj = refHost_(body.ref);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('navstevy') || ss.insertSheet('navstevy');
    if (sh.getLastRow() === 0) sh.appendRow(['cas', 'typ', 'stranka', 'zdroj', 'akce']);
    var cas = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH:mm:ss');
    sh.appendRow([cas, t, path, zdroj, name]);
  } catch (e) {}
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
    return handleContentWrite_(body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'sintera', targets: Object.keys(TARGETS), actions: ['reference_request', 'hit'] });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ====================== C) Publikace na web (tlačítko v Sheetu) ====================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sintera')
    .addItem('Publikovat na web', 'publishSite')
    .addItem('Statistiky návštěvnosti (vytvořit/obnovit)', 'vytvorStatistiky')
    .addItem('Obory: dropdown + sjednotit', 'nastavOboryDropdown')
    .addToUi();
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
  var extra = vypnuto ? ' Pozn.: featured nad limit 9 — u ' + vypnuto + ' starší pozice automaticky přepnuto na ne.' : '';
  if (r.ok) ui.alert('Spuštěno. Web se přebuilduje, za 1 až 2 minuty bude aktuální.' + extra);
  else ui.alert('Build se nepodařilo spustit: ' + (r.detail || 'neznámá chyba'));
}

/* ====================== C2) Featured: max 9 nejnovějších ====================== */
// Homepage zobrazuje max 9 featured pozic (bere je v pořadí Sheetu, nové jsou nahoře).
// Tahle funkce projde list pozice shora dolů a u ZVEŘEJNĚNÝCH pozic nad limit 9
// automaticky přepne featured na 'ne' (tj. vypadne vždy ta nejstarší zařazená).
// Volá se automaticky při zápisu z GPT a při kliknutí na Sintera → Publikovat na web.
function enforceFeaturedLimit_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('pozice');
  if (!sh) return 0;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return 0;
  var head = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
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

/* ====================== D) Návod v Sheetu (list NÁVOD) ====================== */
function vytvorNavod() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('NÁVOD');
  if (!sh) sh = ss.insertSheet('NÁVOD', 0);
  sh.clear();

  var lines = [
    'PROVOZ WEBU sintera.cz — návod',
    'Web se staví automaticky z tohoto Sheetu. Co je v listech pozice / reference / case_studies a má zverejnit = ano, je na webu. Build trvá 1 až 2 minuty.',
    '',
    '1) Přidat obsah přes ChatGPT (nejrychlejší)',
    'Otevři firemní ChatGPT, custom GPT „Sintera – obsah na web". Vlož syrové zadání (pozice, reference nebo case study).',
    'GPT připraví náhled a zeptá se: uložit jako koncept, nebo zveřejnit na web? U pozice i: má být na homepage (featured)?',
    'Když potvrdíš „zveřejnit", zapíše se to sem a hned se spustí build. Za 1 až 2 minuty je živý.',
    '',
    '2) Koncept vs. zveřejnění (a stažení z webu)',
    'Sloupec zverejnit: ano = na webu, ne = koncept (na webu není).',
    'Zveřejnit ručně: přepni zverejnit na ano a klikni Sintera → Publikovat na web.',
    'Stáhnout z webu: přepni zverejnit na ne a Publikovat. Řádek nemaž, zůstane jako archiv.',
    '',
    '3) Tlačítko Sintera → Publikovat na web',
    'Po jakékoli ruční změně v Sheetu (text, zverejnit, featured, pořadí) klikni Sintera → Publikovat na web. Za 1 až 2 minuty se to projeví.',
    '',
    '4) Pořadí pozic (nové nahoře)',
    'Nové záznamy z ChatGPT se vkládají na řádek 2 (nahoru), takže jsou nahoře i na webu. Pořadí na webu = pořadí v Sheetu. Ručně: přesuň řádky a dej Publikovat.',
    '',
    '5) Featured (homepage) — max 9, nejnovější',
    'Sloupec featured = ano → pozice se ukáže i na homepage. Homepage zobrazuje max 9 featured; při přidání desáté se ta nejstarší zařazená automaticky přepne na ne (při zápisu z GPT i při Publikovat).',
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('statistiky');
  if (!sh) sh = ss.insertSheet('statistiky');
  sh.clear();

  sh.getRange('A1').setValue('STATISTIKY NÁVŠTĚVNOSTI').setFontWeight('bold').setFontSize(14);
  sh.getRange('A2').setValue('Živé vzorce nad listem navstevy — aktualizují se samy. Časy jsou pražské.').setFontColor('#888888');

  var kpi = [
    ['Dnes (zobrazení + akce)', '=COUNTIFS(navstevy!A:A,">="&TODAY(),navstevy!A:A,"<"&(TODAY()+1))'],
    ['Posledních 7 dní', '=COUNTIFS(navstevy!A:A,">="&(TODAY()-6))'],
    ['Posledních 30 dní', '=COUNTIFS(navstevy!A:A,">="&(TODAY()-29))'],
    ['30 dní jen zvenku (bez interních prokliků)', '=COUNTIFS(navstevy!A:A,">="&(TODAY()-29),navstevy!D:D,"<>(interní)")'],
    ['Celkem zobrazení stránek (od začátku měření)', '=COUNTIF(navstevy!B:B,"pageview")'],
    ['Celkem akcí (kliky na e-mail/telefon, formuláře)', '=COUNTIF(navstevy!B:B,"event")']
  ];
  for (var i = 0; i < kpi.length; i++) {
    sh.getRange(4 + i, 1).setValue(kpi[i][0]).setFontWeight('bold');
    sh.getRange(4 + i, 2).setFormula(kpi[i][1]).setHorizontalAlignment('left');
  }

  sh.getRange('A11').setValue('NÁVŠTĚVY PO DNECH (posledních 30)').setFontWeight('bold');
  sh.getRange('A12').setFormula('=QUERY(navstevy!A2:E,"select toDate(A), count(B) where A is not null group by toDate(A) order by toDate(A) desc limit 30 label toDate(A) \'Den\', count(B) \'Návštěv\'",0)');

  sh.getRange('D11').setValue('NEJNAVŠTĚVOVANĚJŠÍ STRÁNKY (30 dní)').setFontWeight('bold');
  sh.getRange('D12').setFormula('=QUERY(navstevy!A2:E,"select C, count(B) where B=\'pageview\' and A >= date \'"&TEXT(TODAY()-29,"yyyy-mm-dd")&"\' group by C order by count(B) desc limit 20 label C \'Stránka\', count(B) \'Zobrazení\'",0)');

  sh.getRange('G11').setValue('ODKUD LIDÉ PŘICHÁZEJÍ (30 dní)').setFontWeight('bold');
  sh.getRange('G12').setFormula('=QUERY(navstevy!A2:E,"select D, count(B) where B=\'pageview\' and A >= date \'"&TEXT(TODAY()-29,"yyyy-mm-dd")&"\' group by D order by count(B) desc limit 15 label D \'Zdroj\', count(B) \'Návštěv\'",0)');

  sh.getRange('J11').setValue('AKCE (kliky a formuláře)').setFontWeight('bold');
  sh.getRange('J12').setFormula('=QUERY(navstevy!A2:E,"select E, count(B) where B=\'event\' group by E order by count(B) desc limit 15 label E \'Akce\', count(B) \'Počet\'",0)');

  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 110);
  sh.setColumnWidth(4, 260); sh.setColumnWidth(5, 100);
  sh.setColumnWidth(7, 220); sh.setColumnWidth(8, 100);
  sh.setColumnWidth(10, 200); sh.setColumnWidth(11, 90);
  sh.setColumnWidth(3, 30); sh.setColumnWidth(6, 30); sh.setColumnWidth(9, 30);
  sh.setFrozenRows(3);
  try { ss.setActiveSheet(sh); } catch (e) {}
  try { SpreadsheetApp.getUi().alert('Hotovo. List „statistiky" je vytvořený a aktualizuje se sám.'); } catch (e) {}
}
