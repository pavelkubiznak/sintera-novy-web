#!/usr/bin/env node
/* =====================================================================
   Sintera web · build (Google Sheets → statické HTML + SEO).
   Node 18+ (globální fetch).  Spuštění:  node build/build.mjs

   1) Načte publikované Google Sheets (CSV) pro pozice / reference / cases / klienty.
   2) Při výpadku nebo prázdné URL použije commitnutý JSON (fallback) · web se nikdy nerozbije.
   3) Zapíše snapshoty do assets/data/ a reference-data.js (zdroj pro klientský JS).
   4) Prerender: z build/templates/index.template.html vyrobí index.html (obsah v HTML, SEO).
   5) Vygeneruje samostatné stránky pozic pozice/<id>.html s JobPosting JSON-LD
      (každá pozice má vlastní URL → Google for Jobs), sitemap.xml, robots.txt, .nojekyll.

   Konfigurace: build/config.json (zkopíruj z config.example.json a doplň URL).
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "assets", "data");
const TPL = path.join(__dirname, "templates", "index.template.html");
const POZICE_DIR = path.join(ROOT, "pozice");
const LOGO_BASE = "assets/logos/processed";

const cfgPath = path.join(__dirname, "config.json");
if (!fs.existsSync(cfgPath)) fs.copyFileSync(path.join(__dirname, "config.example.json"), cfgPath);
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const BASE = cfg.site.baseUrl.replace(/\/$/, "");

/* ---------- util ---------- */
const yes = v => String(v || "").trim().toLowerCase() === "ano";
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- AI čitelnost (GEO): jediný zdroj = assets/data/ai-legibility/ ---------- */
const AILEG = path.join(DATA, "ai-legibility");
const ldScript = obj => `<script type="application/ld+json">\n${JSON.stringify(obj)}\n</script>`;
// Organization/ProfessionalService do <head> všech stránek; URL pole odvozená z baseUrl.
const ORG_LD = (() => {
  const o = JSON.parse(fs.readFileSync(path.join(AILEG, "schema-organization.json"), "utf8"));
  o.url = BASE + "/";
  if (o.logo) o.logo = BASE + "/assets/img/og-cover.png";
  if (o.image) o.image = BASE + "/assets/img/og-cover.png";
  return ldScript(o);
})();
// faq.md → [{q, a}]; H1 + úvodní odstavec (meta) se přeskočí, sekce ## = otázka, text pod ní = odpověď.
function parseFaq(md) {
  const qa = []; let cur = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) { cur = { q: line.slice(3).trim(), a: [] }; qa.push(cur); }
    else if (line.startsWith("# ")) { cur = null; }
    else if (cur && line) { cur.a.push(line); }
  }
  return qa.map(x => ({ q: x.q, a: x.a.join(" ") }));
}
const FAQ_QA = parseFaq(fs.readFileSync(path.join(AILEG, "faq.md"), "utf8"));
// FAQPage JSON-LD ze STEJNÉHO zdroje (faq.md), aby strukturovaná data vždy odpovídala viditelné stránce.
// (Pozn.: schema-faqpage.json je tím nahrazeno — měl o 1 otázku méně než faq.md.)
const FAQ_LD = ldScript({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_QA.map(x => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
});
// First-party cookieless měření návštěvnosti (assets/data/analytics/sintera-analytics.js) → inline do <head> všech stránek.
// POZOR: případný doslovný </script> v obsahu (i v komentáři) by inline skript předčasně ukončil → escapujeme na <\/script>.
const ANALYTICS = "<script>\n" + fs.readFileSync(path.join(DATA, "analytics", "sintera-analytics.js"), "utf8").trim().replace(/<\/script>/gi, "<\\/script>") + "\n</script>";

function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) { if (c === '"' && n === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(v => v.trim() !== "")).map(r => { const o = {}; head.forEach((h, i) => o[h] = (r[i] || "").trim()); return o; });
}
async function loadSheet(url) {
  if (!url) return null;
  try {
    let text;
    if (url.startsWith("file:")) text = fs.readFileSync(fileURLToPath(url), "utf8"); // lokální CSV (testování buildu)
    else { const res = await fetch(url); if (!res.ok) throw new Error("HTTP " + res.status); text = await res.text(); }
    const rows = parseCSV(text);
    return rows.length ? rows : null;
  }
  catch (e) { console.warn("  ! Sheet nedostupný, fallback:", e.message); return null; }
}
function fallback(name, key) { try { return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"))[key]; } catch { return []; } }

/* ---------- pozice z pozice-data.js (fallback zdroj) ---------- */
function loadPozice() {
  const src = fs.readFileSync(path.join(ROOT, "assets", "js", "pozice-data.js"), "utf8");
  const fn = new Function(src + "\nreturn { POZICE, OBORY, SENIORITY, KRAJE };");
  return fn();
}
const PZ = loadPozice();

/* ---------- registr stabilních ID: název pozice → existující id (zachová URL pozice/<id>.html) ----------
   Sheet nemá sloupec id, ale názvy 1:1 odpovídají dosavadnímu pozice-data.js. Díky tomu se ze Sheetu
   bere obsah, ale URL detailů zůstávají stabilní. Nový/přejmenovaný název dostane slug-id. */
const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

// Obory sladěné s jobs.cz (kód → label je v assets/js/pozice-data.js OBORY).
// Pozici zařadíme podle oboru v Sheetu (je-li to už nový kód, má přednost),
// jinak automaticky podle názvu role. Tím se starý hrubý kód (vyroba/auto/tech/
// logistika) rozdělí do jemnějších oborů (Strojírenství vs Výroba a průmysl, …).
const OBORY_CODES = new Set(["stroj", "prumysl", "elektro", "technika", "kvalita", "servis", "doprava", "nakup", "projekty", "obchod", "finance", "hr"]);
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");
const deburr = s => String(s || "").toLowerCase().normalize("NFD").replace(COMBINING, "");
// Mapování čitelného názvu oboru → kód (kvůli dropdownu v Sheetu, kde se vybírá název).
const OBOR_BY_LABEL = {};
for (const [code, label] of Object.entries(PZ.OBORY || {})) OBOR_BY_LABEL[deburr(label).trim()] = code;
function classifyObor(sheetObor, title) {
  const o = deburr(sheetObor).trim();
  if (OBORY_CODES.has(o)) return o;                       // Sheet už používá nový kód → má přednost
  if (OBOR_BY_LABEL[o]) return OBOR_BY_LABEL[o];          // Sheet má čitelný název z dropdownu (např. „Strojírenství")
  const t = deburr(title);
  if (/\bcnc\b|frez|soustruh|soustruz|zamec|svar|serizov|obrab|horizontk|karusel/.test(t)) return "stroj";
  if (/electric|elektro|\bplc\b|robot|converter|automat/.test(t)) return "elektro";
  if (/technolog|konstrukt|vyvoj|testovac|process engineer/.test(t)) return "technika";
  if (/procure|nakup/.test(t)) return "nakup";
  if (/logist|dispec|zasob|sklad|doprav/.test(t)) return "doprava";
  if (/vyrob|montaz|operations|operator|procesn|vedouci|mistr|smen/.test(t)) return "prumysl";
  const legacy = { vyroba: "stroj", auto: "elektro", tech: "technika", logistika: "doprava" };
  return legacy[o] || o || "prumysl";
}
// title → seznam id (occurrence-aware). Stabilní registr v build/pozice-id-registry.json. Původních 76 (8 neunikátních
// názvů) má svá id; NOVÉ pozice ze Sheetu (název není v registru) dostanou číselné id (max+1) a build je do registru DOPLNÍ
// (commitne se), takže /pozice/<id>.html zůstává stejná i po dalších buildech.
const REGISTRY_PATH = path.join(__dirname, "pozice-id-registry.json");
const ID_REG = (() => {
  try { return new Map(Object.entries(JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")))); }
  catch { const m = new Map(); for (const p of PZ.POZICE) { const k = norm(p.t); if (!m.has(k)) m.set(k, []); m.get(k).push(p.id); } return m; }
})();
let MAX_ID = 0; // nejvyšší dosavadní číselné id = základ pro přidělování nových
for (const ids of ID_REG.values()) for (const v of ids) { const n = Number(v); if (Number.isFinite(n) && n > MAX_ID) MAX_ID = n; }
let REGISTRY_DIRTY = false;

/* ---------- popisy pozic (descHtml překlopené ze sintera.cz) ---------- */
const POPISY = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "pozice-popisy.json"), "utf8")); } catch { return {}; } })();

/* ---------- GDPR text k formuláři reakce (právně ověřeno; zákon 110/2019 Sb. + GDPR) ---------- */
const GDPR_NOTE = "Odesláním reakce poskytujete své osobní údaje (jméno, kontaktní údaje a informace o sobě) správci Sintera Czech s.r.o., IČ 29130336, se sídlem Uhelná 160/24, Hradec Králové, za účelem vyřízení Vaší reakce a zprostředkování zaměstnání, včetně případného předání potenciálnímu zaměstnavateli v rámci náborového procesu. Zpracování probíhá v souladu se zákonem č. 110/2019 Sb. a nařízením (EU) 2016/679 (GDPR). Máte právo na přístup k údajům, jejich opravu nebo výmaz a kdykoli odvolat svůj souhlas; podrobnosti Vám poskytneme na vyžádání na info@sintera.cz.";

/* ---------- popis pozice: strukturovaná pole (Sheet) → descHtml (popisy) → fallback ---------- */
function splitList(s) { return String(s || "").split(/\r?\n|;|·/).map(x => x.trim()).filter(Boolean); }
function listUL(arr) { return arr && arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""; }
function structuredBody(p) {
  let h = "";
  if (p.intro) h += `<p>${esc(p.intro)}</p>`;
  if (p.whyTalk) h += `<p>${esc(p.whyTalk)}</p>`;
  if (p.responsibilities && p.responsibilities.length) h += `<h4>Co bude vaším úkolem</h4>${listUL(p.responsibilities)}`;
  if (p.mustHave && p.mustHave.length) h += `<h4>Koho hledáme</h4>${listUL(p.mustHave)}`;
  if (p.niceToHave && p.niceToHave.length) h += `<h4>Výhodou</h4>${listUL(p.niceToHave)}`;
  if (p.offer && p.offer.length) h += `<h4>Co nabízíme</h4>${listUL(p.offer)}`;
  if (p.salaryRange) h += `<p><strong>Mzdové rozpětí:</strong> ${esc(p.salaryRange)}${p.salaryNote ? " (" + esc(p.salaryNote) + ")" : ""}</p>`;
  if (p.cta) h += `<p>${esc(p.cta)}</p>`;
  return h;
}
function positionBodyHTML(p, labels) {
  const structured = structuredBody(p);
  if (structured) return structured;
  if (p.descHtml) return p.descHtml;                                      // popis (HTML) ze Sheetu
  if (POPISY[p.id] && POPISY[p.id].descHtml) return POPISY[p.id].descHtml; // záloha z pozice-popisy.json
  return jobDescription(p, labels);
}
function salaryLD(s) {
  if (!s) return null;
  const nums = (String(s).replace(/ |\s/g, "").match(/\d{4,7}/g) || []).map(Number);
  if (!nums.length) return null;
  const value = nums.length >= 2
    ? { "@type": "QuantitativeValue", minValue: Math.min(...nums), maxValue: Math.max(...nums), unitText: "MONTH" }
    : { "@type": "QuantitativeValue", value: nums[0], unitText: "MONTH" };
  return { "@type": "MonetaryAmount", currency: "CZK", value };
}

/* ---------- mapování loga ze slugu (tmavé pozadí = mono-light) ---------- */
const ML_SVG = new Set(["aisan","alstom","edwards","nestle","panasonic","safran-cabin","siemens-energy","vitesco","winning-group","zf"]);
function logoPath(slug) {
  if (!slug) return "";
  if (slug === "sitel") return `${LOGO_BASE}/png/sitel-400x160.png`;
  return ML_SVG.has(slug) ? `${LOGO_BASE}/mono-light/${slug}-mono-light.svg` : `${LOGO_BASE}/mono-light/${slug}-mono-light.png`;
}
function slugify(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
/* odstraní interní pole (_status, _risk, _companyFull…) z veřejného JS */
function stripInternal(v) {
  if (Array.isArray(v)) return v.map(stripInternal);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) if (k[0] !== "_") o[k] = stripInternal(v[k]); return o; }
  return v;
}

/* ---------- mapování listů ---------- */
function mapReferences(rows) {
  return rows.filter(r => yes(r.zverejnit)).map(r => ({
    company: r.firma, role: r.role, quote: r.citace_kratka, long: r.text_web || r.citace_kratka,
    logo: logoPath(r.logo_slug), tags: r.stitky || "", id: "ref_" + slugify(r.firma), _logoSlug: r.logo_slug || "",
  }));
}
function mapCases(rows) {
  return rows.filter(r => yes(r.zverejnit)).map(r => ({
    meta: [r.role, r.typ_firmy, r.region].filter(Boolean).join(" · "), name: r.nazev,
    situ: r.situace, why: r.proc_nestacil_nabor, change: r.co_jsme_udelali, win: r.vysledek, id: "case_" + slugify(r.nazev),
  }));
}
function mapClients(rows) {
  return rows.filter(r => yes(r.ve_stripu)).sort((a, b) => (+a.poradi || 0) - (+b.poradi || 0))
    .map(r => ({ name: r.nazev, logo: logoPath(r.logo_slug), _logoSlug: r.logo_slug || "" }));
}
// zeď referencí (list reference_zed): scan → full/thumb, scan2 → full2, štítky podle ";"
function mapReferenceWall(rows) {
  return rows.filter(r => yes(r.zverejnit)).map(r => ({
    firma: r.firma || "", sektor: r.sektor || "", obor: r.obor || "", role: r.role || "", kontakt: r.kontakt || "",
    stitky: String(r.stitky || "").split(";").map(s => s.trim()).filter(Boolean),
    thumb: "thumbs/" + String(r.scan || "").replace(/^full-/, "wall-"),
    full: "full/" + (r.scan || ""),
    full2: r.scan2 ? "full/" + r.scan2 : "",
  }));
}
function mapPositions(rows) {
  const seen = new Map();
  return rows.filter(r => yes(r.zverejnit)).map((r, i) => {
    let id = (r.id || "").trim();                               // pokud Sheet má sloupec id, použij ho
    if (!id) {
      const k = norm(r.nazev), occ = seen.get(k) || 0; seen.set(k, occ + 1);
      let ids = ID_REG.get(k);
      if (!ids) { ids = []; ID_REG.set(k, ids); }
      if (ids[occ] != null) {
        id = ids[occ];                                          // existující registrované id (původních 76 i dříve přidané)
      } else {
        id = ++MAX_ID;                                          // NOVÁ pozice → stabilní číselné id (max+1)
        ids[occ] = id; REGISTRY_DIRTY = true;                   // doplň do registru (occurrence-aware) → stálá URL
      }
    }
    return {
      id, t: r.nazev, o: classifyObor(r.obor, r.nazev), s: r.seniorita, k: (r.kraj || "").split("/").map(s => s.trim()).filter(Boolean),
      bonus: r.bonus || "", rezim: r.rezim || "", datePosted: r.datum_zverejneni || "", validThrough: r.platnost_do || "", employmentType: r.uvazek || "FULL_TIME",
      intro: r.uvod || "", whyTalk: r.proc_mluvit || "",
      responsibilities: splitList(r.naplne), mustHave: splitList(r.must), niceToHave: splitList(r.vyhoda), offer: splitList(r.nabizime),
      salaryRange: r.mzda_rozsah || "", salaryNote: r.mzda_pozn || "", cta: r.cta || "",
      descHtml: (r.popis || "").trim(), featured: yes(r.featured),
    };
  });
}

/* ---------- generátory HTML sekcí (prerender) ---------- */
function rotorHTML(rotor) {
  return rotor.map((r, i) =>
    `<figure class="rotor-item${i === 0 ? " active" : ""}"><blockquote>„${esc(r.q)}“</blockquote>${r.c ? `<figcaption>${esc(r.c)}</figcaption>` : ""}</figure>`
  ).join("\n");
}
function casesHTML(cases, n = 6) {
  return cases.slice(0, n).map(c =>
    `<article class="case-card rv" data-id="${esc(c.id)}" role="button" tabindex="0" aria-label="Příběh: ${esc(c.name)}">` +
    `<div class="case-meta">${esc(c.meta)}</div>` +
    `<p class="case-hook">${esc(c.situ)}</p>` +
    `<span class="case-more">Číst příběh →</span></article>`
  ).join("\n");
}
function refsHTML(refs, n = 9) {
  return refs.slice(0, n).map(r => {
    const logo = `<div class="ref-logo">${r.logo ? `<img src="${esc(r.logo)}" alt="${esc(r.company)}" loading="lazy">` : `<span class="ref-logo-name">${esc(r.company)}</span>`}</div>`;
    return `<article class="ref-card rv" data-id="${esc(r.id)}" role="button" tabindex="0" aria-label="Reference: ${esc(r.company)}">` +
      logo +
      `<blockquote>„${esc(r.quote)}“</blockquote>` +
      `<div class="who"><strong>${esc(r.company)}</strong>${r.role ? `<span>${esc(r.role)}</span>` : ""}</div>` +
      `<span class="ref-more">Číst celé →</span></article>`;
  }).join("\n");
}
function marqueeHTML(clients) {
  const node = c => c.logo
    ? `<span class="logo-slot"><img src="${esc(c.logo)}" alt="${esc(c.name)}" loading="lazy" /></span>`
    : `<span class="client-name">${esc(c.name)}</span>`;
  const group = `<div class="mq-group">${clients.map(node).join("")}</div>`;
  return group + group; // dvě identické skupiny pro plynulou smyčku bez mezery
}
const HOMEPAGE_POS = [830, 856, 862, 853, 805, 833, 795, 827, 832]; // záložní kurátorský výběr (když Sheet nemá featured); jinak řídí homepage sloupec featured
// Oranžový chip s příspěvkem (prerender fallback). Stejná logika jako v app.js:
// prefix „+ příspěvek" jen u čistých částek; když hodnota slovo „příspěvek" už obsahuje, vypíše se tak, jak je.
function bonusChip(v) {
  v = String(v == null ? "" : v).trim();
  if (!v) return "";
  const label = /příspěvek/i.test(v) ? v : `+ příspěvek ${v}`;
  return `<span class="pos-bonus" title="${esc(label)}">${esc(label)}</span>`;
}
function positionsHTML(positions, labels) {
  const byId = new Map(positions.map(p => [p.id, p]));
  const featured = positions.filter(p => p.featured);
  const curated = (featured.length ? featured : HOMEPAGE_POS.map(id => byId.get(id)).filter(Boolean)).slice(0, 9);
  return curated.map(p => {
    const bonus = bonusChip(p.bonus);
    return `<div class="pos-item"><a class="pos-row" href="pozice/${esc(p.id)}.html">` +
      `<span class="t">${esc(p.t)}${bonus}</span>` +
      `<span class="m field">${esc(labels.OBORY[p.o] || p.o)}</span>` +
      `<span class="m level">${esc(labels.SENIORITY[p.s] || p.s)}</span>` +
      `<span class="m loc">${esc((p.k || []).join(" / "))}</span>` +
      `<span class="arr">→</span></a></div>`;
  }).join("\n");
}

/* ---------- JobPosting (na samostatné stránce pozice) ---------- */
const FOREIGN = { "Německo": "DE" };
function jobLocations(krList) {
  return (krList || []).map(kr => {
    if (kr === "Celá ČR") return { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "CZ" } };
    if (FOREIGN[kr]) return { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: FOREIGN[kr] } };
    return { "@type": "Place", address: { "@type": "PostalAddress", addressRegion: kr, addressCountry: "CZ" } };
  });
}
function applicantCountries(krList) {
  const set = new Set((krList || []).map(kr => FOREIGN[kr] || "CZ"));
  const arr = [...set];
  return arr.length === 1 ? { "@type": "Country", name: arr[0] } : arr.map(c => ({ "@type": "Country", name: c }));
}
function jobDescription(p, labels) {
  const obor = labels.OBORY[p.o] || "", sen = labels.SENIORITY[p.s] || "", loc = (p.k || []).join(", ");
  const bonus = p.bonus ? ` Náborový příspěvek ${esc(p.bonus)}.` : "";
  return `<p>${esc(p.t)} v oboru ${esc(obor)} (${esc(sen)}), lokalita: ${esc(loc)}.${bonus}</p>` +
    `<p>Tuto roli obsazujeme přímým vyhledáváním (direct search): aktivně oslovujeme odborníky, kteří se sami nehlásí. Konkrétní náplň práce, požadavky i podmínky upřesníme při prvním hovoru.</p>`;
}
function jobPosting(p, labels) {
  const now = new Date();
  const posted = now.toISOString().slice(0, 10);
  const through = new Date(now.getTime() + 90 * 864e5).toISOString().slice(0, 10);
  const sal = salaryLD(p.salaryRange);
  return {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: p.t, identifier: { "@type": "PropertyValue", name: "Sintera", value: String(p.id) },
    datePosted: p.datePosted || posted, validThrough: p.validThrough || through,
    employmentType: p.employmentType || "FULL_TIME",
    description: positionBodyHTML(p, labels),
    hiringOrganization: { "@type": "Organization", name: "Sintera Czech s.r.o.", sameAs: BASE + "/", logo: BASE + "/assets/img/logo-color.png" },
    jobLocation: jobLocations(p.k),
    applicantLocationRequirements: applicantCountries(p.k),
    ...(sal ? { baseSalary: sal } : {}),
    directApply: false, url: `${BASE}/pozice/${p.id}.html`,
  };
}
function itemListLD(positions) {
  const list = {
    "@context": "https://schema.org", "@type": "ItemList",
    itemListElement: positions.slice().sort((a, b) => b.id - a.id).map((p, i) => ({
      "@type": "ListItem", position: i + 1, name: p.t, url: `${BASE}/pozice/${p.id}.html`,
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(list)}\n</script>`;
}

/* ---------- samostatná stránka pozice ---------- */
function detailPage(p, labels) {
  const obor = labels.OBORY[p.o] || p.o, sen = labels.SENIORITY[p.s] || p.s, loc = (p.k || []).join(" / ");
  const bonus = p.bonus ? `<span>Příspěvek ${esc(p.bonus)}</span>` : "";
  const title = `${esc(p.t)} · ${esc(loc)} · Sintera Czech`;
  const desc = `${esc(p.t)} (${esc(obor)}, ${esc(sen)}), lokalita ${esc(loc)}. Obsazujeme přímým vyhledáváním. Reagujte e-mailem na info@sintera.cz.`;
  const subj = encodeURIComponent(`Reakce na pozici: ${p.t} (${loc})`);
  const url = `${BASE}/pozice/${p.id}.html`;
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0e1230">
<meta property="og:type" content="website">
<meta property="og:locale" content="cs_CZ">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/assets/img/og-cover.png">
<link rel="icon" type="image/svg+xml" href="../assets/img/favicon.svg">
<link rel="stylesheet" href="../assets/css/fonts.css">
<link rel="stylesheet" href="../assets/css/styles.css">
<script type="application/ld+json">
${JSON.stringify(jobPosting(p, labels))}
</script>
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
  { "@type": "ListItem", position: 1, name: "Sintera", item: BASE + "/" },
  { "@type": "ListItem", position: 2, name: "Aktuální pozice", item: BASE + "/#pozice" },
  { "@type": "ListItem", position: 3, name: p.t, item: url },
] })}
</script>
${ORG_LD}
${ANALYTICS}
</head>
<body>
<div class="grain" aria-hidden="true"></div>
<nav id="nav" class="scrolled">
  <a class="nav-logo nav-wordmark" href="../index.html">Sintera<span>.</span></a>
  <div class="nav-links">
    <a href="../index.html#trh">Jak pracujeme</a>
    <a href="../index.html#reference">Reference</a>
    <a href="../index.html#pozice">Pozice</a>
    <a href="../index.html#kontakt">Kontakt</a>
  </div>
  <a class="nav-cta" href="mailto:info@sintera.cz?subject=${subj}">Reagovat</a>
</nav>
<main>
<section class="block" style="padding-top:clamp(140px,16vw,180px)">
  <div class="block-inner narrow">
    <a class="ref-more" href="../index.html#pozice" style="display:inline-flex;margin-bottom:28px">← Zpět na pozice</a>
    <div class="kicker">${esc(obor)} · ${esc(sen)}</div>
    <h1 class="lead">${esc(p.t)}</h1>
    <div class="pos-tags" style="margin-top:22px"><span>${esc(loc)}</span><span>${esc(obor)}</span><span>${esc(sen)}</span>${bonus}</div>
    <div class="body" style="margin-top:28px">${positionBodyHTML(p, labels)}</div>
    <div class="hero-ctas" style="margin-top:40px;flex-wrap:wrap">
      <a class="btn btn-primary" href="mailto:info@sintera.cz?subject=${subj}&body=${encodeURIComponent("Jméno:\nKontakt:\n\nPár vět o vás nebo odkaz na profil:")}">Reagovat na pozici</a>
      <a class="btn btn-line" href="tel:+420499599861">Zavolejte nám · +420 499 599 861</a>
    </div>
    <p style="margin-top:24px;max-width:680px;font-size:12.5px;line-height:1.6;color:var(--dim)">${GDPR_NOTE}</p>
  </div>
</section>
</main>
<footer>
  <a class="nav-logo nav-wordmark" href="../index.html">Sintera<span>.</span></a>
  <div class="foot-col"><strong>Kontakt</strong>Uhelná 160/24, Hradec Králové<br><a href="tel:+420499599861">+420 499 599 861</a><br><a href="mailto:info@sintera.cz">info@sintera.cz</a></div>
  <span class="copy">© ${new Date().getFullYear()} Sintera Czech s.r.o. · IČ 29130336 · <a href="../faq/">Časté dotazy</a> · <a href="../ochrana-osobnich-udaju/">Ochrana osobních údajů</a></span>
</footer>
</body>
</html>
`;
}

/* ---------- prerender ---------- */
function prerender(site, labels) {
  let html = fs.readFileSync(TPL, "utf8");
  const repl = {
    "<!--ROTOR-->": rotorHTML(site.rotor),
    "<!--CASES-->": casesHTML(site.cases),
    "<!--REFS-->": refsHTML(site.references),
    "<!--MARQUEE-->": marqueeHTML(site.clients),
    "<!--POSITIONS-->": positionsHTML(site.positions, labels),
    "<!--JSONLD-->": itemListLD(site.positions),
    "<!--ORG-->": ORG_LD,
    "<!--ANALYTICS-->": ANALYTICS,
  };
  for (const [marker, content] of Object.entries(repl)) html = html.replace(marker, content);
  html = html.split("%%BASE%%").join(BASE); // canonical/og/JSON-LD se odvodí z baseUrl (github.io teď, sintera.cz po Fázi 2)
  fs.writeFileSync(path.join(ROOT, "index.html"), html);
  console.log("  ✓ index.html (prerender)");
}

function writeDetailPages(positions, labels) {
  fs.mkdirSync(POZICE_DIR, { recursive: true });
  // úklid: smaž staré detailní stránky (kromě index.html), ať nezůstanou osiřelé po změně sady pozic
  for (const f of fs.readdirSync(POZICE_DIR)) {
    if (f.endsWith(".html") && f !== "index.html") fs.unlinkSync(path.join(POZICE_DIR, f));
  }
  for (const p of positions) fs.writeFileSync(path.join(POZICE_DIR, `${p.id}.html`), detailPage(p, labels));
  console.log(`  ✓ ${positions.length} stránek pozic (pozice/<id>.html)`);
}

/* ---------- SEO výstupy ---------- */
function writeSitemap(positions) {
  const sections = ["/", "/pozice/", "/faq/", "/reference-info/"]; // bez #kotev — vyhledávače fragmenty v sitemap ignorují
  const jobs = positions.map(p => `/pozice/${p.id}.html`);
  const urls = sections.concat(jobs).map(u => `  <url><loc>${BASE}${u}</loc><changefreq>weekly</changefreq></url>`).join("\n");
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /reference/\nDisallow: /assets/reference-wall/\nSitemap: ${BASE}/sitemap.xml\n`);
  fs.writeFileSync(path.join(ROOT, ".nojekyll"), "");
  console.log("  ✓ sitemap.xml, robots.txt, .nojekyll");
}

/* ---------- 404.html: přesměrování JEN starých odkazů na POZICE ----------
   GitHub Pages je statický hosting bez serverových přesměrování; 404.html je
   univerzální „chytač" pro každou neexistující cestu. Přesměrováváme ZÁMĚRNĚ jen
   staré odkazy na pozice (kandidáti je dostali) + starou homepage; zbytek webu
   necháváme být — jiná neexistující adresa (např. blog detail-novinky) ukáže
   normální „Stránka nenalezena" s odkazy Domů / Pozice, bez přesměrování.
   Staré číslování pozic = shodné s novým (registr převzal web4u id):
   /cz/pozice/<id> → /pozice/<id>.html (živé), uzavřené → výpis /pozice/;
   staré výpisy /cz|/cs/pracovni-pozice* a /cs/j/* → /pozice/;
   stará homepage /cz/ (i /cz) → nový úvod / (rychle, anti-flash bez 404).
   Anti-flash: při přesměrování schováme stránku, ať nebliká 404. */
function writeRedirects(positions) {
  const idMap = "{" + positions.map(p => `"${p.id}":1`).join(",") + "}";
  const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<script>
(function () {
  var IDS = ${idMap};
  var p = (location.pathname || "").toLowerCase();
  var to = null, m = p.match(/^\\/(?:cz|cs)\\/pozice\\/(\\d+)/);
  if (m) { to = IDS[m[1]] ? "/pozice/" + m[1] + ".html" : "/pozice/"; }
  else if (/^\\/(?:cz|cs)\\/(?:pracovni-pozice|j)\\b/.test(p)) { to = "/pozice/"; }
  else if (/^\\/(?:cz|cs)\\/?$/.test(p)) { to = "/"; } // stará homepage /cz/ → nový úvod (rychle, bez 404)
  if (to) { document.documentElement.style.display = "none"; location.replace(to); }
})();
</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Stránka nenalezena — Sintera Czech</title>
<style>
  :root { --navy:#0e1230; --ter:#c8704f; }
  html, body { margin:0; height:100%; }
  body { background:var(--navy); color:#f5f3ee; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; display:flex; align-items:center; justify-content:center; text-align:center; padding:24px; }
  .box { max-width:560px; }
  h1 { font-size:28px; font-weight:600; margin:0 0 12px; letter-spacing:-0.01em; }
  p { font-size:16px; line-height:1.6; color:#cfcbe0; margin:0 0 28px; }
  .btns { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
  a.btn { display:inline-block; padding:13px 22px; border-radius:999px; text-decoration:none; font-weight:600; font-size:15px; }
  a.primary { background:var(--ter); color:#1a0e08; }
  a.ghost { border:1px solid rgba(245,243,238,.35); color:#f5f3ee; }
</style>
</head>
<body>
  <div class="box">
    <h1>Stránka nenalezena</h1>
    <p>Tahle adresa na webu Sintera neexistuje. Přejděte prosím na úvod nebo na otevřené pozice.</p>
    <div class="btns">
      <a class="btn primary" href="/">Domů</a>
      <a class="btn ghost" href="/pozice/">Otevřené pozice</a>
    </div>
  </div>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, "404.html"), html);
  console.log(`  ✓ 404.html (jen pozice: /cz/pozice/<id> → /pozice/<id>.html, ${positions.length} živých id; zbytek = normální „nenalezeno")`);
}

/* ---------- AI čitelnost: FAQ stránka, llms.txt, schema do statických stránek ---------- */
function faqPage() {
  const url = `${BASE}/faq/`;
  const title = "Časté dotazy · Sintera Czech";
  const desc = "Odpovědi na časté otázky o přímém vyhledávání (direct a executive search) se Sinterou: obory, regiony, rychlost, průběh spolupráce a reference.";
  const items = FAQ_QA.map(x =>
    `        <div class="faq-item">\n          <h3 class="faq-q">${esc(x.q)}</h3>\n          <p class="faq-a">${esc(x.a)}</p>\n        </div>`
  ).join("\n");
  return `<!DOCTYPE html>
<html lang="cs" data-theme="dark" data-motion="plne" data-reading="pasy">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#0e1230" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="cs_CZ" />
  <meta property="og:site_name" content="Sintera Czech" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${BASE}/assets/img/og-cover.png" />
  <link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="../assets/css/fonts.css" />
  <link rel="stylesheet" href="../assets/css/styles.css" />
  ${ORG_LD}
  ${FAQ_LD}
  ${ANALYTICS}
</head>
<body>
  <a class="skip-link" href="#faq">Přeskočit na obsah</a>
  <div class="grain" aria-hidden="true"></div>

  <nav id="nav">
    <a class="nav-logo nav-wordmark" href="../index.html">Sintera<span>.</span></a>
    <div class="nav-links">
      <a href="../index.html#trh">Jak pracujeme</a>
      <a href="../index.html#reference">Reference</a>
      <a href="../pozice/">Pozice</a>
      <a href="../index.html#kontakt">Kontakt</a>
    </div>
    <a class="nav-cta" href="../index.html#kontakt">Marně hledáte lidi?</a>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Menu" aria-expanded="false">
      <i></i><i></i><i></i>
    </button>
  </nav>

  <main>
    <section class="block" id="faq">
      <div class="block-inner narrow">
        <span class="kicker">Časté dotazy</span>
        <div class="sect-head">
          <h2>Časté dotazy</h2>
        </div>
        <p class="positions-lead">Faktické odpovědi na otázky, které řeší personální ředitelé a HR při výběru search partnera.</p>
        <div class="faq-list">
${items}
        </div>
        <p style="margin-top:40px">
          <a class="btn btn-line" href="../index.html#kontakt">Máte jinou otázku? Ozvěte se →</a>
        </p>
      </div>
    </section>
  </main>

  <footer>
    <a class="nav-logo nav-wordmark" href="../index.html">Sintera<span>.</span></a>
    <div class="foot-col">
      <strong>Kontakt</strong>
      Uhelná 160/24, Hradec Králové<br>
      <a href="tel:+420499599861">+420 499 599 861</a><br>
      <a href="mailto:info@sintera.cz">info@sintera.cz</a>
    </div>
    <div class="foot-col">
      <strong>Sledujte nás</strong>
      <a href="https://www.linkedin.com/company/sintera-czech-s-r-o-" target="_blank" rel="noopener">LinkedIn</a>
    </div>
    <span class="copy">© <span id="yr">${new Date().getFullYear()}</span> Sintera Czech s.r.o. · <a href="../faq/">Časté dotazy</a> · <a href="../ochrana-osobnich-udaju/">Ochrana osobních údajů</a></span>
  </footer>

  <script src="../assets/js/app.js"></script>
</body>
</html>
`;
}
function writeFaqPage() {
  const dir = path.join(ROOT, "faq");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), faqPage());
  console.log(`  ✓ faq/ (${FAQ_QA.length} otázek, FAQPage + Organization JSON-LD)`);
}
function writeLlmsTxt() {
  fs.copyFileSync(path.join(AILEG, "llms.txt"), path.join(ROOT, "llms.txt"));
  console.log("  ✓ llms.txt (kořen, indexovatelný)");
}
// Org JSON-LD + měření do statických stránek (idempotentně přes markery; jediný zdroj = source soubory).
function injectIntoStatic(relFiles) {
  const blocks = [
    { tag: "ORG_LD", content: ORG_LD },
    { tag: "ANALYTICS", content: ANALYTICS },
  ];
  let n = 0;
  for (const rel of relFiles) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    let html = fs.readFileSync(fp, "utf8");
    for (const b of blocks) {
      const wrapped = `<!--${b.tag}_START-->\n${b.content}\n<!--${b.tag}_END-->`;
      const re = new RegExp(`<!--${b.tag}_START-->[\\s\\S]*?<!--${b.tag}_END-->`);
      if (re.test(html)) html = html.replace(re, wrapped);
      else html = html.replace("</head>", `${wrapped}\n</head>`);
    }
    fs.writeFileSync(fp, html); n++;
  }
  console.log(`  ✓ Org JSON-LD + měření do statických stránek (${n})`);
}

/* ---------- main ---------- */
async function main() {
  console.log("Sintera build…");
  const [pz, rf, cs, kl, rw] = await Promise.all([
    loadSheet(cfg.sheets.pozice), loadSheet(cfg.sheets.reference), loadSheet(cfg.sheets.casestudies), loadSheet(cfg.sheets.klienti), loadSheet(cfg.sheets.reference_zed),
  ]);

  const site = {
    positions: pz ? mapPositions(pz) : PZ.POZICE.map(p => ({ ...p })),
    references: rf ? mapReferences(rf) : fallback("reference-data.json", "references"),
    cases:      cs ? mapCases(cs)      : fallback("reference-data.json", "cases"),
    clients:    kl ? mapClients(kl)    : fallback("reference-data.json", "clients"),
    rotor:      fallback("reference-data.json", "rotor"),
    homepage:   fallback("reference-data.json", "homepage"),
  };
  const labels = { OBORY: PZ.OBORY, SENIORITY: PZ.SENIORITY, KRAJE: PZ.KRAJE };

  fs.writeFileSync(path.join(DATA, "site-data.json"), JSON.stringify(site, null, 2));
  const refData = { references: site.references, cases: site.cases, rotor: site.rotor, clients: site.clients, homepage: site.homepage };
  fs.writeFileSync(path.join(DATA, "reference-data.json"), JSON.stringify(refData, null, 2));
  fs.writeFileSync(path.join(DATA, "reference-data.js"),
    "/* AUTO-GENEROVÁNO buildem (build/build.mjs). Needituj ručně. Interní pole (_*) odstraněna. */\nwindow.SINTERA_DATA = " + JSON.stringify(stripInternal(refData), null, 2) + ";\n");

  // Zeď referencí: z listu reference_zed (zverejnit=ano), fallback na commitnutý reference-wall.json
  const wall = rw ? mapReferenceWall(rw)
    : (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "reference-wall.json"), "utf8")); } catch { return []; } })();
  fs.writeFileSync(path.join(DATA, "reference-wall.js"),
    "/* AUTO: zeď referencí (build/build.mjs z listu reference_zed; fallback reference-wall.json). Needituj ručně. */\nwindow.REFERENCE_WALL = " + JSON.stringify(wall) + ";\n");
  console.log(`  ✓ reference-wall.js (${wall.length} referencí, ${rw ? "ze Sheetu reference_zed" : "fallback reference-wall.json"})`);

  // Pozice ze Sheetu → přegeneruj klientská data, aby homepage seznam (/), stránka /pozice/ i popisy detailů jely ze Sheetu
  if (pz) {
    const posOut = site.positions.map(p => {
      const o = { id: p.id, t: p.t, k: p.k, o: p.o, s: p.s };
      if (p.bonus) o.bonus = p.bonus;
      if (p.salaryRange) o.sal = p.salaryRange;
      if (p.featured) o.featured = true;
      return o;
    });
    fs.writeFileSync(path.join(ROOT, "assets", "js", "pozice-data.js"),
      "/* AUTO-GENEROVÁNO buildem z Google Sheetu (build/build.mjs). Needituj ručně. */\n" +
      "var OBORY = " + JSON.stringify(PZ.OBORY, null, 2) + ";\n" +
      "var SENIORITY = " + JSON.stringify(PZ.SENIORITY, null, 2) + ";\n" +
      "var KRAJE = " + JSON.stringify(PZ.KRAJE) + ";\n" +
      "var POZICE = " + JSON.stringify(posOut) + ";\n");
    const popisi = {};
    for (const p of site.positions) { const body = positionBodyHTML(p, labels); if (body) popisi[p.id] = { descHtml: body }; }
    const sortedKeys = Object.keys(popisi).sort((a, b) => (!isNaN(+a) && !isNaN(+b)) ? (+a - +b) : String(a).localeCompare(String(b)));
    const sortedPopisi = {}; for (const k of sortedKeys) sortedPopisi[k] = popisi[k];
    fs.writeFileSync(path.join(DATA, "pozice-popisy.json"), JSON.stringify(sortedPopisi, null, 2) + "\n");
    fs.writeFileSync(path.join(DATA, "pozice-popisy.js"), "window.POZICE_POPISY = " + JSON.stringify(sortedPopisi) + ";\n");
    console.log("  ✓ pozice-data.js + pozice-popisy.{json,js} přegenerováno ze Sheetu");
    if (REGISTRY_DIRTY) {
      const obj = {}; for (const [k, v] of ID_REG) obj[k] = v;
      fs.writeFileSync(REGISTRY_PATH, JSON.stringify(obj, null, 2) + "\n");
      console.log("  ✓ pozice-id-registry.json doplněn o nové pozice (stabilní id)");
    }
  }

  prerender(site, labels);
  writeDetailPages(site.positions, labels);
  writeSitemap(site.positions);
  writeRedirects(site.positions);
  writeFaqPage();
  writeLlmsTxt();
  injectIntoStatic(["pozice/index.html", "reference-info/index.html", "ochrana-osobnich-udaju/index.html", "reference/reference-2026-c5219413a491/index.html"]);
  console.log(`Hotovo: ${site.positions.length} pozic, ${site.references.length} referencí, ${site.cases.length} cases, ${site.clients.length} klientů, ${site.rotor.length} rotor vět.`);
}
main().catch(e => { console.error(e); process.exit(1); });
