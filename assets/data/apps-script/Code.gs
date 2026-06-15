/**
 * Sintera · endpoint pro zápis obsahu do Google Sheetu (pozice / reference / case studies).
 * Nasazení: v Sheetu Rozšíření → Apps Script → vlož tento kód → Nasadit → Webová aplikace
 *   - "Spustit jako": já,  "Kdo má přístup": Kdokoli.
 * URL .../exec vlož do openapi.yaml (akce pro custom GPT).
 *
 * Vstup (POST JSON): { "token": "...", "target": "pozice"|"reference"|"case", "record": { ... } }
 *   (zpětně kompatibilní: { "token": "...", "position": { ... } } = target "pozice")
 * Bezpečnost: sdílený token + vše se ukládá jako KONCEPT (zverejnit = "ne").
 */

var TOKEN = 'ZMENME_na_dlouhy_nahodny_retezec'; // <-- vlastní tajný token

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

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.token !== TOKEN) return json_({ ok: false, error: 'unauthorized' });

    var target = body.target || (body.position ? 'pozice' : '');
    var record = body.record || body.position || {};
    var def = TARGETS[target];
    if (!def) return json_({ ok: false, error: 'unknown target: ' + target });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(def.sheet) || ss.insertSheet(def.sheet);
    if (sh.getLastRow() === 0) sh.appendRow(def.headers);

    var map = def.build(record);
    sh.appendRow(def.headers.map(function (h) { return map[h]; }));
    return json_({ ok: true, target: target, sheet: def.sheet, row: sh.getLastRow() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() { return json_({ ok: true, service: 'sintera-content', targets: Object.keys(TARGETS) }); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
