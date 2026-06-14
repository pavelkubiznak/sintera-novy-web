# Sintera web: implementační brief pro Claude Code

Cíl: z hotového designu (prototyp `Sintera v5`) a hotového obsahu postavit ostrý web,
kde se **pozice, reference, case studies a loga editují v Google Sheets**, web je
**responzivní** (desktop i mobil), **SEO optimalizovaný** a **nasazený na www.sintera.cz**.

Zvolená architektura: **build krok**. Obsah se z Google Sheets jednou za čas „zapeče"
do statického HTML (prerender). Tím získáme pohodlnou editaci v Sheets i plné SEO,
protože obsah je přímo v HTML, ne až dotažený v prohlížeči.

---

## 1. Současný stav (co už existuje)

Pracovní zdroj webu je ve složce `assets/`:

- `css/styles.css` — hlavní styl, tmavé téma, už obsahuje 4 media queries (responzivní základ).
- `js/main.js` — sdílené UI: sticky nav, mobilní menu (`#burger`, `.menu-open`), reveal on scroll, parallax.
- `js/pozice.js` + `js/pozice-data.js` — výpis a filtrování pozic (obor, seniorita, kraj, hledání). Pozice mají vlastní taxonomii.
- `data/reference-data.js` + `data/reference-data.json` — hotový obsah: 18 referencí, 8 case studies, 12 rotujících vět, 12 klientů do logo stripu, 7 homepage proof bloků. Tvar polí odpovídá render funkcím (viz `data/README-pro-claude-code.md`).
- `logos/` — 14 zpracovaných log (svg/png/webp + mono-light/mono-dark) a přes 100 zdrojových log v `logos/raw/` + pipeline v `logos/_pipeline/`.
- `img/`, `fonts/` — logo Sintery, favicon, fonty.

Design (přesný vzhled, animace hero, sekce, modaly) je v prototypu
`Sintera v5 - standalone-7.html`. Je to ale **zabundlovaný** jednosouborový export
(HTML + CSS + JS jsou uvnitř gzip/base64 manifestu). Slouží jako **vizuální referenční
předloha**, ne jako produkční zdroj. Render logiku referencí, case studies, rotoru a
marquee je potřeba doplnit do `assets/js/` (pozice už takhle hotové jsou).

Na `www.sintera.cz` aktuálně neběží reálný obsah (prázdná odpověď).

---

## 2. Cílová struktura projektu

```
sintera-novy-web/
  index.html              ← prerenderovaný (sekce s obsahem přímo v HTML)
  pozice.html (volitelně) ← samostatná stránka pozic, nebo sekce v index
  assets/
    css/styles.css
    js/main.js, pozice.js, reference.js (NOVÉ: render referencí/cases/rotor/marquee)
    data/*.json           ← vygenerováno buildem ze Sheets (commitnutý fallback)
    logos/, img/, fonts/
  build/
    build.mjs             ← build skript (Sheets → JSON + prerender HTML)
    templates/            ← HTML šablony se zástupnými značkami
  dist/                   ← výstup k nasazení (to se nahrává na hosting)
  sitemap.xml, robots.txt ← generováno buildem
```

---

## 3. Datový model: Google Sheets (4 listy)

Jeden Google Sheet, 4 listy. Každý list publikovat přes `Soubor → Sdílet → Publikovat
na webu → konkrétní list → CSV`. Vzniklé URL build skript načte. Názvy sloupců (první
řádek) musí přesně sedět, build podle nich mapuje.

### List `pozice`
Mapuje na současný `pozice-data.js` a navíc na SEO strukturovaná data (JobPosting).

| sloupec | povinné | význam |
|---------|---------|--------|
| `nazev` | ano | název pozice |
| `obor` | ano | jeden z: vyroba, auto, tech, kvalita, logistika, servis, projekty, finance, hr, obchod |
| `seniorita` | ano | spec, man, top |
| `kraj` | ano | kraj/lokalita (zobrazení) |
| `popis` | ano | 1 až 3 věty, popis role |
| `bonus` | ne | ano/ne (náborový příspěvek) |
| `datum_zverejneni` | ne | YYYY-MM-DD (pro JobPosting `datePosted`) |
| `platnost_do` | ne | YYYY-MM-DD (pro JobPosting `validThrough`) |
| `uvazek` | ne | FULL_TIME / PART_TIME (pro JobPosting `employmentType`) |
| `zverejnit` | ano | ano/ne (řídí, zda jde na web) |

### List `reference`
Mapuje na `reference-data` → `references[]`.

| sloupec | význam |
|---------|--------|
| `firma` | zobrazený název (např. „ZF Passive Safety") |
| `role` | pozice/spolupráce |
| `citace_kratka` | krátká citace na kartě (`quote`) |
| `text_web` | 2 až 4 věty do detailu (`long`) |
| `stitky` | důkazní štítky, oddělené `;` |
| `logo_slug` | slug loga (např. `zf`), nebo prázdné |
| `zverejnit` | ano/ne |
| `souhlas` | ano/ne (interní, nejde na web) |

### List `case_studies`
Mapuje na `cases[]`.

| sloupec | význam |
|---------|--------|
| `nazev` | pracovní název (interní/nadpis) |
| `role` | typ role |
| `typ_firmy` | typ společnosti |
| `region` | region |
| `situace` | výchozí problém (`situ`) |
| `proc_nestacil_nabor` | `why` |
| `co_jsme_udelali` | `change` |
| `vysledek` | `win` |
| `zverejnit` | ano/ne |

### List `klienti`
Mapuje na `clients[]` (logo strip / marquee).

| sloupec | význam |
|---------|--------|
| `nazev` | zobrazený název |
| `logo_slug` | slug loga (soubor v `assets/logos/processed/`) |
| `ve_stripu` | ano/ne |
| `poradi` | číslo pro řazení |
| `souhlas` | ano/ne (interní) |

Build z log slugů sestaví cesty k souborům (viz mapování variant v `README-pro-claude-code.md`:
tmavé pozadí = `mono-light`, světlé = `mono-dark`, SITEL barevně).

---

## 4. Build pipeline (Sheets → statické HTML)

Skript `build/build.mjs` (Node, bez těžkých závislostí):

1. **Načte** publikované CSV pro 4 listy (URL v `build/config.json` nebo env proměnných).
2. **Naparsuje** CSV (stejný princip jako parser v prototypu), odfiltruje `zverejnit = ne`.
3. **Namapuje** na datové tvary (`references`, `cases`, `rotor`, `clients`, `positions`),
   doplní cesty k logům ze slugů.
4. **Fallback:** když je Sheet nedostupný nebo prázdný, použije commitnuté
   `assets/data/*.json` (web se nikdy nerozbije).
5. **Zapíše** `assets/data/*.json` (aktualizovaný snapshot, commitne se do repa).
6. **Prerender:** do `index.html` vloží hotové HTML sekcí (reference cards, case cards,
   rotor, marquee, pozice) místo zástupných značek v šabloně. Tím je obsah v HTML kvůli SEO.
   Klientský JS pak slouží jen na interakce (filtr pozic, modaly, rotace), ne na první vykreslení.
7. **Vygeneruje** `sitemap.xml` (vč. kotev sekcí a případných detailních URL pozic) a `robots.txt`.
8. **Vloží JSON-LD** (viz SEO) s aktuálními pozicemi a údaji o firmě.
9. **Výstup** složí do `dist/` (HTML + assets připravené k nahrání).

Spouštění: `node build/build.mjs`. Workflow editace: klient upraví Sheet → spustí se
build → nahraje se `dist/`. Build lze pustit ručně, nebo ho zautomatizovat (denní
přegenerování přes cron/CI, nebo „publikovat" tlačítko). Pro malý web stačí ruční nebo
denní rebuild; pozice se nemění po minutách.

---

## 5. Doplnění render logiky (z prototypu do assets/js)

Z prototypu přenést do `assets/js/reference.js` (nové) chování pro:
`renderReferences`, `renderCases` + modaly, `renderRotor`, `renderMarquee`.
Data brát z `window.SINTERA_DATA` (viz `data/reference-data.js`) nebo z prerenderovaného
HTML. Pozice už řeší `pozice.js`; jen napojit data z buildu a doplnit JobPosting.

---

## 6. SEO checklist

- **Title + meta description** pro každou stránku, česky, s klíčovými slovy
  (executive search, přímé vyhledávání kandidátů, nábor mimo aktivní trh, obor, region).
- **Open Graph + Twitter card** (title, description, `og:image` 1200×630 — připravit grafiku).
- **JSON-LD strukturovaná data:**
  - `Organization` (Sintera Czech, logo, kontakt, sídlo, sameAs).
  - `JobPosting` pro každou zveřejněnou pozici (title, description, datePosted, validThrough,
    employmentType, hiringOrganization, jobLocation). **Velká výhra: pozice se mohou
    zobrazit v Google for Jobs.** Proto je důležitý build/prerender, ne runtime fetch.
  - volitelně `BreadcrumbList`.
- **sitemap.xml** + **robots.txt** (odkaz na sitemapu), generované buildem.
- **Canonical** URL, `lang="cs"`, `hreflang` cs (pokud bude i EN, doplnit).
- **Sémantické HTML** (`<header> <nav> <main> <section> <article> <footer>`, `<h1>` jednou).
- **Alt texty** u všech log a obrázků (název firmy), `loading="lazy"` u log.
- **Výkon (Core Web Vitals):** viz sekce 8. Rychlost je SEO faktor.

---

## 7. Responzivita

- Mobilní navigace už je (`#burger`, `.menu-open` v `main.js` + styles.css) — dotáhnout a otestovat.
- Breakpointy: ověřit a doplnit pro ~360, 480, 768, 1024, 1280 px. `styles.css` má 4 media queries, pravděpodobně rozšířit.
- Fluidní typografie (`clamp()`), mřížky referencí/cases na 1 sloupec na mobilu.
- Touch targety min. 44×44 px (filtry pozic, karty, CTA).
- Hero animace (searchlight přes profily): na mobilu zjednodušit nebo zklidnit,
  respektovat `prefers-reduced-motion` (prototyp to už zohledňuje).
- Otestovat na reálných šířkách (DevTools device toolbar) a na skutečném telefonu.

---

## 8. Výkon a extrakce designu z prototypu

- Prototyp je jeden 1,5MB soubor s celým Reactem a Babelem. **Na produkci ne.** Cílem je
  lehký statický web: čisté HTML + `styles.css` + pár malých JS souborů (vanilla, už to tak
  začalo v `assets/js`). Design (rozvržení, barvy, sekce, animace) překlopit z prototypu
  do těchto čistých souborů. Vizuální předloha = otevřený `standalone-7.html`.
- Loga servírovat jako **WebP** (už připravené v `logos/processed/webp/`) s `lazy` načítáním.
- Fonty: `font-display: swap`, subset jen na použité znaky (vč. české diakritiky), preload klíčového řezu.
- Minifikace CSS/JS v buildu, cache hlavičky na statické assety.

---

## 9. Nasazení na www.sintera.cz (stávající hosting / FTP)

Web je statický, takže nasazení = nahrát obsah `dist/` na hosting.

1. **Potvrdit hosting a přístupy** (viz sekce 11). Postup se mírně liší podle providera
   (Wedos, Forpsi, vlastní VPS…).
2. **Upload** přes FTP/SFTP do veřejné složky (typicky `www/`, `public_html/` nebo `htdocs/`).
   Build může mít deploy skript (`lftp`/`rsync` přes SFTP) nebo nahrávat ručně.
3. **HTTPS** zapnout (Let's Encrypt u většiny hostingů zdarma), vynutit přesměrování http→https.
4. **www vs non-www:** zvolit hlavní (doporučeno `www.sintera.cz`) a druhé 301 přesměrovat.
5. **.htaccess** (pokud Apache): https redirect, www redirect, cache hlavičky, gzip/brotli,
   custom 404. Žádné SPA rewrite není potřeba (klasické statické stránky).
6. **Re-deploy při změně obsahu:** po editaci Sheets pustit build a nahrát `dist/`.
   Volitelně zautomatizovat (cron na serveru, který stáhne repo, pustí build a nahraje).

DNS: pokud doména směřuje jinam, u registrátora nastavit A/CNAME záznam na cílový hosting.
Tohle je potřeba dořešit podle toho, kde doména a hosting jsou (viz sekce 11).

---

## 10. Workflow editace obsahu (pro klienta)

1. Klient otevře Google Sheet a přidá/upraví řádek (pozice, reference, case study, logo).
2. U citlivých polí drží pravidla: žádné „klient zmiňuje/oceňuje", žádné zakázané fráze,
   žádná dlouhá pomlčka (viz `README-pro-claude-code.md`).
3. Spustí se build (ručně, denně, nebo tlačítkem) → web se přegeneruje a nahraje.
4. Loga: nové logo nahrát do `logos/raw/`, protáhnout pipeline, do Sheetu zadat slug.

---

## 11. Co je potřeba potvrdit / doplnit

- **Hosting:** který provider a přístupové údaje (FTP/SFTP host, uživatel, heslo/klíč, cílová složka). Bez toho nelze finalizovat deploy skript.
- **Doména:** u koho je registrovaná `sintera.cz` a kdo může měnit DNS.
- **Google účet** pro Sheet (kdo ho vlastní, sdílení, publikování listů jako CSV).
- **Souhlasy klientů** se zveřejněním názvů, citací a log (zatím u všech `needs_client_approval`).
- **OG obrázek** (1200×630) a kontrola faviconu (`img/favicon.svg` existuje).
- **Texty mimo reference** (hero, o nás, kontakt, GDPR/cookies) — zda jsou hotové, nebo je doplnit.
- **Jazyk:** jen čeština, nebo i anglická verze (ovlivní hreflang a build).

---

## 12. Doporučené pořadí prací (milníky)

1. Extrahovat design z prototypu do čistého `index.html` + `styles.css` + JS (reference.js).
2. Napojit `data/reference-data.*` → vykreslit reference, case studies, rotor, marquee, pozice.
3. Doladit responzivitu a výkon (WebP loga, fonty, minifikace).
4. Postavit build skript Sheets → JSON + prerender + sitemap/robots, s fallbackem.
5. Doplnit SEO (meta, OG, JSON-LD JobPosting, canonical).
6. Nasadit na www.sintera.cz přes FTP, HTTPS, přesměrování.
7. Předat klientovi Google Sheet + krátký návod na editaci a re-deploy.

---

### Poznámka k volbě build vs runtime
Runtime načítání z Sheets je sice jednodušší, ale Google by obsah (hlavně pozice) v HTML
nemusel vidět a přišli bychom o Google for Jobs i o část SEO. Proto je zvolený build krok.
Pokud bude potřeba „okamžitá" změna bez buildu, lze později doplnit hybrid: prerender pro
SEO a k tomu lehký runtime refresh.
