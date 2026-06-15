/**
 * Sintera · endpoint pro zápis nové pozice do Google Sheetu.
 * Nasazení: Apps Script (přímo v Sheetu: Rozšíření → Apps Script) → Nasadit → Webová aplikace.
 *   - "Spustit jako": já
 *   - "Kdo má přístup": Kdokoli
 * Výsledné URL .../exec vlož do schématu akce (openapi.yaml) pro custom GPT.
 *
 * Bezpečnost: jednoduchý sdílený token (níže) + nové pozice se ukládají jako KONCEPT
 * (zverejnit = "ne"). Na web jdou, až je člověk přepne na "ano" a spustí build.
 */

var SHEET_NAME = 'pozice';
var TOKEN = 'ZMENME_na_dlouhy_nahodny_retezec'; // <-- nastav vlastní tajný token

var HEADERS = [
  'nazev','obor','seniorita','kraj','uvazek','rezim','bonus',
  'mzda_rozsah','mzda_pozn','uvod','proc_mluvit','naplne','must','vyhoda',
  'nabizime','cta','featured','zverejnit','datum_zverejneni','platnost_do'
];

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.token !== TOKEN) return json_({ ok: false, error: 'unauthorized' });
    var p = body.position || body;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) sh.appendRow(HEADERS);

    var list = function (v) { return Array.isArray(v) ? v.join('\n') : (v || ''); };
    var map = {
      nazev: p.title || '',
      obor: p.category || '',
      seniorita: p.seniority || '',
      kraj: p.region || '',
      uvazek: p.employmentType || 'FULL_TIME',
      rezim: p.workMode || 'onsite',
      bonus: p.bonus || '',
      mzda_rozsah: p.salaryRange || '',
      mzda_pozn: p.salaryNote || '',
      uvod: p.intro || '',
      proc_mluvit: list(p.whyTalk),
      naplne: list(p.responsibilities),
      must: list(p.mustHave),
      vyhoda: list(p.niceToHave),
      nabizime: list(p.offer),
      cta: p.cta || '',
      featured: p.featured ? 'ano' : 'ne',
      zverejnit: 'ne',            // vždy koncept, člověk schválí
      datum_zverejneni: p.datePosted || '',
      platnost_do: p.validThrough || ''
    };
    var row = HEADERS.map(function (h) { return map[h]; });
    sh.appendRow(row);
    return json_({ ok: true, row: sh.getLastRow(), nazev: map.nazev });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'sintera-pozice' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
