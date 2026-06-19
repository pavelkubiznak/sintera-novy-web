/**
 * Sintera · Apps Script endpoint.
 *
 * Dvě role v jednom web appu:
 *  A) Zápis obsahu do Sheetu (pozice / reference / case) — CHRÁNĚNO tokenem, volá custom GPT.
 *     Vstup: { "token": "...", "target": "pozice"|"reference"|"case", "record": { ... } }
 *  B) Žádost o reference z webu — VEŘEJNÉ (bez tokenu), volá formulář na webu.
 *     Vstup: { "action": "reference_request", "email": "...", "phone": "...",
 *              "name": "...", "position": "...", "source": "...", "consent": true, "website": "" }
 *     Ověří firemní doménu, zaloguje lead do listu "leady_reference",
 *     pošle e-mail (přes Gmail / GmailApp) s odkazem na neveřejnou landing page.
 *
 * Nasazení: v Sheetu Rozšíření → Apps Script → vlož tento kód → Nasadit → Webová aplikace
 *   - "Spustit jako": já,  "Kdo má přístup": Kdokoli.
 *   - Při prvním spuštění Google vyžádá oprávnění k odesílání e-mailu (GmailApp). Schval.
 *
 * E-maily se posílají PŘÍMO přes Google z účtu, který skript vlastní. Žádný Resend ani
 * externí služba. Kopie každého odeslaného e-mailu je ve složce Odeslané daného účtu.
 *
 * Tajemství NEDÁVEJ do kódu. Projektová nastavení → Vlastnosti skriptu (Script Properties):
 *   TOKEN        = dlouhý náhodný řetězec (pro zápis obsahu z GPT)
 *   LANDING_URL  = https://www.sintera.cz/reference/<neuhodnutelny-slug>/
 *   FROM_EMAIL   = (volitelné) ověřený alias odesílatele, např. "info@sintera.cz".
 *                  Musí být v Gmailu účtu nastaven jako "Odesílat jako / Send mail as".
 *                  Když prázdné, odešle se z adresy účtu, pod kterým skript běží.
 *   REPLY_TO     = (volitelné) kam mají chodit odpovědi, default info@sintera.cz
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
  if (body.token !== prop_('TOKEN', 'ZMENME_na_dlouhy_nahodny_retezec')) {
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
  sh.appendRow(def.headers.map(function (h) { return map[h]; }));
  var row = sh.getLastRow();

  var built = false, buildDetail = '';
  if (publish) { var r = triggerBuild_(); built = r.ok; buildDetail = r.detail || ''; }
  return json_({ ok: true, target: target, sheet: def.sheet, row: row,
                 published: publish, build_triggered: built, build_detail: buildDetail });
}

/* ====================== B) ŽÁDOST O REFERENCE (veřejné) ====================== */

// Zrcadlo seznamu z assets/data/reference-gate/free-domains.js — držet v souladu.
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
  // 1) Honeypot: roboti vyplní skryté pole "website". Tváříme se, že OK, ale nic neuděláme.
  if (body.website) return json_({ ok: true });

  var email = (body.email || '').trim();
  var domain = emailDomain_(email);

  // 2) Formát e-mailu
  if (!domain) return json_({ ok: false, error: 'invalid_email' });

  // 3) Souhlas GDPR
  if (!(body.consent === true || body.consent === 'ano')) {
    return json_({ ok: false, error: 'consent_required' });
  }

  // 4) Firemní doména
  if (FREE_DOMAINS.indexOf(domain) !== -1) {
    return json_({ ok: false, error: 'free_domain' });
  }

  // 5) Cooldown proti opakovanému odesílání na stejný e-mail (120 s)
  var cache = CacheService.getScriptCache();
  var ck = 'ref:' + email.toLowerCase();
  if (cache.get(ck)) return json_({ ok: true, note: 'already_sent' });
  cache.put(ck, '1', 120);

  // 6) Log leadu
  logLead_({
    email: email, domain: domain,
    phone: (body.phone || '').trim(), name: (body.name || '').trim(),
    position: (body.position || '').trim(), source: (body.source || '').trim(),
    consent: 'ano'
  });

  // 7) Odeslání e-mailu přes Gmail (GmailApp)
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
  var from = prop_('FROM_EMAIL', '');                 // volitelně ověřený alias (Send mail as)
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
  if (from) options.from = from;                      // funguje jen pokud je to ověřený alias

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

/* ====================== Router ====================== */

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'reference_request') return handleReferenceRequest_(body);
    return handleContentWrite_(body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'sintera', targets: Object.keys(TARGETS), actions: ['reference_request'] });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ====================== C) Publikace na web (tlačítko v Sheetu) ====================== */
// Menu „Sintera → Publikovat na web" spustí build na GitHubu (workflow_dispatch).
// Do Script Properties přidej: GH_TOKEN = fine-grained GitHub token (Actions: Read and write).
// Volitelně: GH_OWNER, GH_REPO, GH_WORKFLOW, GH_BRANCH (mají rozumné výchozí hodnoty níže).

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sintera')
    .addItem('Publikovat na web', 'publishSite')
    .addToUi();
}

// Spustí build webu přes GitHub workflow_dispatch. Sdílí menu „Publikovat"
// i publikace přímo z chatu (createRecord s publish:true).
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
  var r = triggerBuild_();
  if (r.ok) ui.alert('Spuštěno. Web se přebuilduje, za 1 až 2 minuty bude aktuální.');
  else ui.alert('Build se nepodařilo spustit: ' + (r.detail || 'neznámá chyba'));
}
