#!/usr/bin/env node
/* =====================================================================
   Sintera web — build (Google Sheets → statické HTML + SEO).
   Node 18+ (globální fetch).  Spuštění:  node build/build.mjs

   1) Načte publikované Google Sheets (CSV) pro pozice / reference / cases / klienty.
   2) Při výpadku nebo prázdné URL použije commitnutý JSON (fallback) — web se nikdy nerozbije.
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
  try { const res = await fetch(url); if (!res.ok) throw new Error("HTTP " + res.status); const rows = parseCSV(await res.text()); return rows.length ? rows : null; }
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
function mapPositions(rows) {
  return rows.filter(r => yes(r.zverejnit)).map((r, i) => ({
    id: 1000 + i, t: r.nazev, o: r.obor, s: r.seniorita, k: (r.kraj || "").split("/").map(s => s.trim()).filter(Boolean),
    desc: r.popis || "", bonus: r.bonus || "", datePosted: r.datum_zverejneni || "", validThrough: r.platnost_do || "", employmentType: r.uvazek || "FULL_TIME",
  }));
}

/* ---------- generátory HTML sekcí (prerender) ---------- */
function rotorHTML(rotor) {
  return rotor.map((r, i) =>
    `<figure class="rotor-item${i === 0 ? " active" : ""}"><blockquote>${esc(r.q)}</blockquote><figcaption>${esc(r.c)}</figcaption></figure>`
  ).join("\n");
}
function casesHTML(cases, n = 4) {
  return cases.slice(0, n).map((c, i) =>
    `<article class="case-card rv${i % 3 ? " d" + (i % 3) : ""}" data-id="${esc(c.id)}" role="button" tabindex="0" aria-label="Příběh: ${esc(c.name)}">` +
    `<div class="case-meta">${esc(c.meta)}</div>` +
    `<p class="case-hook">${esc(c.situ)}</p>` +
    `<span class="case-more">Číst příběh →</span></article>`
  ).join("\n");
}
function refsHTML(refs) {
  return refs.map((r, i) => {
    const head = r.logo
      ? `<div class="ref-logo"><img src="${esc(r.logo)}" alt="${esc(r.company)}" loading="lazy" height="34"></div>`
      : `<div class="ref-name">${esc(r.company)}</div>`;
    return `<article class="ref-card rv${i % 3 ? " d" + (i % 3) : ""}" data-id="${esc(r.id)}" role="button" tabindex="0" aria-label="Reference: ${esc(r.company)}">` +
      head +
      `<blockquote>${esc(r.quote)}</blockquote>` +
      `<div class="who"><strong>${esc(r.company)}</strong>${r.role ? `<span>${esc(r.role)}</span>` : ""}</div>` +
      `<span class="ref-more">Číst celé →</span></article>`;
  }).join("\n");
}
function marqueeHTML(clients) {
  const slot = c => c.logo
    ? `<span class="slot"><img src="${esc(c.logo)}" alt="${esc(c.name)}" loading="lazy" height="42"></span>`
    : `<span class="slot"><span class="txt">${esc(c.name)}</span></span>`;
  const one = clients.map(slot).join("");
  return one + one; // zdvojeno pro plynulou smyčku
}
function positionsHTML(positions, labels) {
  const sorted = positions.slice().sort((a, b) => b.id - a.id);
  return sorted.map(p => {
    const bonus = p.bonus ? `<span class="bonus">Příspěvek ${esc(p.bonus)}</span>` : "";
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
  return {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: p.t, identifier: { "@type": "PropertyValue", name: "Sintera", value: String(p.id) },
    datePosted: p.datePosted || posted, validThrough: p.validThrough || through,
    employmentType: p.employmentType || "FULL_TIME",
    description: jobDescription(p, labels),
    hiringOrganization: { "@type": "Organization", name: "Sintera Czech s.r.o.", sameAs: BASE + "/", logo: BASE + "/assets/img/logo-color.png" },
    jobLocation: jobLocations(p.k),
    applicantLocationRequirements: applicantCountries(p.k),
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
  const bonus = p.bonus ? `<span class="bonus">Náborový příspěvek ${esc(p.bonus)}</span>` : "";
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
</head>
<body>
<header class="nav scrolled" id="nav">
  <div class="wrap nav-in">
    <a class="brand" href="../index.html" aria-label="Sintera Czech, úvod"><img src="../assets/img/logo-white-mark.png" alt="Sintera Czech"></a>
    <nav class="nav-links" aria-label="Hlavní navigace">
      <a href="../index.html#problem">Jak hledáme</a>
      <a href="../index.html#reference">Reference</a>
      <a href="../index.html#pozice">Pozice</a>
      <a href="../index.html#kontakt">Kontakt</a>
    </nav>
    <a class="btn btn-acc btn-nav-cta" href="mailto:info@sintera.cz?subject=${subj}">Reagovat</a>
  </div>
</header>
<main id="top">
<section class="sec" style="padding-top:140px">
  <div class="wrap" style="max-width:840px">
    <a class="ref-more" href="../index.html#pozice" style="display:inline-flex;margin-bottom:24px">← Zpět na pozice</a>
    <div class="kicker">${esc(obor)} · ${esc(sen)}</div>
    <h1 class="h-claim">${esc(p.t)}</h1>
    <div class="pos-tags" style="margin-top:18px"><span>${esc(loc)}</span><span>${esc(obor)}</span><span>${esc(sen)}</span></div>
    ${bonus ? `<p style="margin-top:14px">${bonus}</p>` : ""}
    <div class="lead" style="margin-top:28px">${jobDescription(p, labels)}</div>
    <div class="hero-cta" style="margin-top:36px">
      <a class="btn btn-acc" href="mailto:info@sintera.cz?subject=${subj}&body=${encodeURIComponent("Jméno:\nKontakt:\n\nPár vět o vás nebo odkaz na profil:")}">Reagovat na pozici</a>
      <a class="btn btn-ghost" href="tel:+420499599861">Zavolat Šárce · +420 499 599 861</a>
    </div>
  </div>
</section>
</main>
<footer>
  <div class="wrap"><div class="foot-base">
    <span>© ${new Date().getFullYear()} Sintera Czech s.r.o. · IČ 29130336 · Praha &amp; Hradec Králové</span>
    <span><a href="mailto:info@sintera.cz">info@sintera.cz</a></span>
  </div></div>
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
  };
  for (const [marker, content] of Object.entries(repl)) html = html.replace(marker, content);
  fs.writeFileSync(path.join(ROOT, "index.html"), html);
  console.log("  ✓ index.html (prerender)");
}

function writeDetailPages(positions, labels) {
  fs.mkdirSync(POZICE_DIR, { recursive: true });
  for (const p of positions) fs.writeFileSync(path.join(POZICE_DIR, `${p.id}.html`), detailPage(p, labels));
  console.log(`  ✓ ${positions.length} stránek pozic (pozice/<id>.html)`);
}

/* ---------- SEO výstupy ---------- */
function writeSitemap(positions) {
  const sections = ["/", "/#problem", "/#cases", "/#reference", "/#pozice", "/#kontakt"];
  const jobs = positions.map(p => `/pozice/${p.id}.html`);
  const urls = sections.concat(jobs).map(u => `  <url><loc>${BASE}${u}</loc><changefreq>weekly</changefreq></url>`).join("\n");
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
  fs.writeFileSync(path.join(ROOT, ".nojekyll"), "");
  console.log("  ✓ sitemap.xml, robots.txt, .nojekyll");
}

/* ---------- main ---------- */
async function main() {
  console.log("Sintera build…");
  const [pz, rf, cs, kl] = await Promise.all([
    loadSheet(cfg.sheets.pozice), loadSheet(cfg.sheets.reference), loadSheet(cfg.sheets.casestudies), loadSheet(cfg.sheets.klienti),
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

  prerender(site, labels);
  writeDetailPages(site.positions, labels);
  writeSitemap(site.positions);
  console.log(`Hotovo: ${site.positions.length} pozic, ${site.references.length} referencí, ${site.cases.length} cases, ${site.clients.length} klientů, ${site.rotor.length} rotor vět.`);
}
main().catch(e => { console.error(e); process.exit(1); });
