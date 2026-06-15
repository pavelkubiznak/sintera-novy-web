#!/usr/bin/env node
/* =====================================================================
   Sintera web · build skript (Google Sheets → statické JSON + SEO).
   Node 18+ (používá globální fetch). Spuštění:  node build/build.mjs

   Co dělá:
   1) Načte publikované Google Sheets (CSV) pro pozice, reference, case studies, klienty.
   2) Naparsuje, odfiltruje řádky se „zverejnit=ne", namapuje na datové tvary webu.
   3) Doplní cesty k logům ze slugů.
   4) Zapíše data do assets/data/ (+ aktualizuje reference-data.js wrapper).
   5) Vygeneruje sitemap.xml a robots.txt.
   6) prerender(): doplní obsah do index.html (SEO) · viz TODO níže.
   7) Fallback: když Sheet selže, použije commitnutý JSON, web se nikdy nerozbije.

   Konfigurace: build/config.json (zkopíruj z config.example.json a doplň URL).
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, ".."); // kořen webu (uprav podle umístění build/)
const DATA = path.join(ROOT, "assets", "data");
const LOGO_BASE = "assets/logos/processed";

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

/* ---------- CSV parser (kompatibilní s prototypem) ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) {
      if (c === '"' && n === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(v => v.trim() !== "")).map(r => {
    const o = {}; head.forEach((h, i) => o[h] = (r[i] || "").trim()); return o;
  });
}

async function loadSheet(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = parseCSV(await res.text());
    return rows.length ? rows : null;
  } catch (e) { console.warn("  ! Sheet nedostupný, fallback:", e.message); return null; }
}

const yes = v => String(v || "").trim().toLowerCase() === "ano";

/* ---------- mapování loga ze slugu (tmavé pozadí = mono-light) ---------- */
const ML_SVG = new Set(["aisan","alstom","edwards","nestle","panasonic","safran-cabin","siemens-energy","vitesco","winning-group","zf"]);
function logoPath(slug) {
  if (!slug) return "";
  if (slug === "sitel") return `${LOGO_BASE}/png/sitel-400x160.png`; // barevně, mono nečitelné
  return ML_SVG.has(slug) ? `${LOGO_BASE}/mono-light/${slug}-mono-light.svg`
                          : `${LOGO_BASE}/mono-light/${slug}-mono-light.png`;
}

/* ---------- mapování listů na datové tvary ---------- */
function mapReferences(rows) {
  return rows.filter(r => yes(r.zverejnit)).map(r => ({
    company: r.firma, role: r.role, quote: r.citace_kratka, long: r.text_web,
    logo: logoPath(r.logo_slug), tags: r.stitky, _logoSlug: r.logo_slug || "",
  }));
}
function mapCases(rows) {
  return rows.filter(r => yes(r.zverejnit)).map(r => ({
    meta: [r.role, r.typ_firmy, r.region].filter(Boolean).join(" · "),
    name: r.nazev, situ: r.situace, why: r.proc_nestacil_nabor,
    change: r.co_jsme_udelali, win: r.vysledek,
  }));
}
function mapClients(rows) {
  return rows.filter(r => yes(r.ve_stripu)).sort((a,b)=>(+a.poradi||0)-(+b.poradi||0))
    .map(r => ({ name: r.nazev, logo: logoPath(r.logo_slug), _logoSlug: r.logo_slug || "" }));
}
function splitList(v) {
  return String(v || "").split(/\r?\n|;/).map(s => s.replace(/^[-•\s]+/, "").trim()).filter(Boolean);
}
function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function descHtmlFromStructured(r) {
  const sec = (title, items) => items.length
    ? `<h4>${escHtml(title)}</h4><ul>${items.map(i => `<li>${escHtml(i)}</li>`).join("")}</ul>` : "";
  let h = "";
  if (r.uvod) h += `<p>${escHtml(r.uvod)}</p>`;
  h += sec("Proč o té roli mluvit", splitList(r.proc_mluvit));
  h += sec("Co budete dělat", splitList(r.naplne));
  h += sec("Co opravdu potřebujeme", splitList(r.must));
  h += sec("Co je výhoda, ne podmínka", splitList(r.vyhoda));
  h += sec("Co nabízíme", splitList(r.nabizime));
  return h;
}
function mapPositions(rows) {
  return rows.filter(r => yes(r.zverejnit)).map((r, i) => {
    const structured = !!(r.uvod || r.naplne || r.nabizime);
    return {
      id: i + 1, t: r.nazev, o: r.obor, s: r.seniorita,
      k: (r.kraj || "").split("/").map(s => s.trim()).filter(Boolean),
      bonus: r.bonus || "", workMode: r.rezim || "onsite",
      salaryRange: r.mzda_rozsah || "", salaryNote: r.mzda_pozn || "",
      intro: r.uvod || "",
      whyTalk: splitList(r.proc_mluvit),
      responsibilities: splitList(r.naplne),
      mustHave: splitList(r.must),
      niceToHave: splitList(r.vyhoda),
      offer: splitList(r.nabizime),
      cta: r.cta || "",
      desc: structured ? descHtmlFromStructured(r) : (r.popis || ""),
      datePosted: r.datum_zverejneni || "", validThrough: r.platnost_do || "",
      employmentType: r.uvazek || "FULL_TIME",
      featured: yes(r.featured),
    };
  });
}

/* ---------- fallback: commitnutý JSON ---------- */
function fallback(name, key) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"))[key]; }
  catch { return []; }
}

/* ---------- SEO výstupy ---------- */
function writeSitemap(positions) {
  const base = cfg.site.baseUrl.replace(/\/$/, "");
  const urls = [base + "/", base + "/#reference", base + "/#pozice", base + "/#kontakt"];
  const body = urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n");
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  fs.writeFileSync(path.join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
}

function jobPostingLD(positions) {
  return positions.map(p => ({
    "@context": "https://schema.org", "@type": "JobPosting",
    title: p.t, datePosted: p.datePosted || undefined, validThrough: p.validThrough || undefined,
    employmentType: p.employmentType,
    hiringOrganization: { "@type": "Organization", name: "Sintera Czech s.r.o.", sameAs: cfg.site.baseUrl },
    jobLocation: (p.k || []).map(kr => ({ "@type": "Place", address: { "@type": "PostalAddress", addressRegion: kr, addressCountry: "CZ" } })),
    description: p.desc || p.t,
  }));
}

/* ---------- prerender do index.html (SEO) ----------
   TODO (Claude Code): načti build/templates/index.template.html (nebo stávající
   index.html se značkami), nahraď zástupné značky vygenerovaným HTML sekcí a zapiš
   do dist/index.html. Značky např.:
     <!--REFS-->   ... karty referencí
     <!--CASES-->  ... karty case studies
     <!--ROTOR-->  ... rotující věty
     <!--MARQUEE--> ... logo strip
     <!--POZICE--> ... seznam pozic (server-render pro SEO; filtr pak na klientovi)
     <!--JSONLD--> ... <script type="application/ld+json"> s JobPosting + Organization
   Tím je obsah v HTML kvůli SEO; klientský JS řeší jen interakce.
*/
function prerender(site) {
  console.log("  (prerender) TODO: vlož sekce do index.html · viz komentář v build.mjs");
}

/* ---------- main ---------- */
async function main() {
  console.log("Sintera build: načítám Google Sheets…");
  const [pz, rf, cs, kl] = await Promise.all([
    loadSheet(cfg.sheets.pozice), loadSheet(cfg.sheets.reference),
    loadSheet(cfg.sheets.casestudies), loadSheet(cfg.sheets.klienti),
  ]);

  const site = {
    positions: pz ? mapPositions(pz) : fallback("site-data.json", "positions"),
    references: rf ? mapReferences(rf) : fallback("reference-data.json", "references"),
    cases:      cs ? mapCases(cs)      : fallback("reference-data.json", "cases"),
    clients:    kl ? mapClients(kl)    : fallback("reference-data.json", "clients"),
    rotor:      fallback("reference-data.json", "rotor"),     // rotor zatím staticky
    homepage:   fallback("reference-data.json", "homepage"),
  };

  // zápis JSON snapshotů
  fs.writeFileSync(path.join(DATA, "site-data.json"), JSON.stringify(site, null, 2));
  const refData = { references: site.references, cases: site.cases, rotor: site.rotor, clients: site.clients, homepage: site.homepage };
  fs.writeFileSync(path.join(DATA, "reference-data.json"), JSON.stringify(refData, null, 2));
  const head = "/* AUTO-GENEROVÁNO buildem (build/build.mjs). Needituj ručně. */\nwindow.SINTERA_DATA = ";
  fs.writeFileSync(path.join(DATA, "reference-data.js"), head + JSON.stringify(refData, null, 2) + ";\n");

  writeSitemap(site.positions);
  fs.writeFileSync(path.join(DATA, "jobposting-ld.json"), JSON.stringify(jobPostingLD(site.positions), null, 2));
  prerender(site);

  console.log(`Hotovo: ${site.positions.length} pozic, ${site.references.length} referencí, ${site.cases.length} case studies, ${site.clients.length} klientů ve stripu.`);
}
main().catch(e => { console.error(e); process.exit(1); });
