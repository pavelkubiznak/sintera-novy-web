# CLAUDE.md — Sintera web

> Umísti tento soubor do **kořene repozitáře** (`sintera-novy-web/CLAUDE.md`), aby ho
> Claude Code načítal automaticky. Tady v `assets/data/` je jako součást handoffu.

## Co je tento projekt

Statický web personální agentury Sintera Czech (executive / přímé vyhledávání).
Obsah (pozice, reference, case studies, loga) se edituje v **Google Sheets** a
**build krok** ho zapeče do statického HTML kvůli SEO. Žádný framework: čisté
HTML + CSS + vanilla JS.

## Architektura

Google Sheets (4 listy) → `build/build.mjs` → JSON v `assets/data/` + prerender do
`index.html` + `sitemap.xml`/`robots.txt` → nasazení statických souborů na hosting
(www.sintera.cz). Fallback: když Sheety selžou, použije se commitnutý JSON.

## Mapa repozitáře

- `index.html` — hlavní stránka (kořen). Sekce: hero, trh/přesnost, cases, reference, pozice, kontakt.
- `assets/css/styles.css` — styl, tmavé téma, responsivní (media queries).
- `assets/js/main.js` — nav, mobilní menu (`#burger`/`.menu-open`), reveal, parallax.
- `assets/js/pozice.js` + `pozice-data.js` — výpis a filtr pozic.
- `assets/js/reference.js` — (DOPLNIT) render referencí, cases, rotor, marquee z dat.
- `assets/data/reference-data.js|json` — obsah referencí/cases/rotor/clients/homepage.
- `assets/data/site-data.json` — snapshot ze Sheets (po buildu).
- `assets/data/sheets-templates/*.csv` — startovací data pro Google Sheets (schéma + obsah).
- `assets/logos/processed/` — 131 zpracovaných log (png/webp/mono-light/mono-dark; 10 barevných svg).
- `build/` — build skript (zatím v `assets/data/build/`, přesunout do kořene).

## Zdroje

- **Vzhled (design):** Claude Design file „Sintera - Live prototyp v5" (prototyp). Předloha
  pro layout, sekce, typografii, animace. Neimplementovat jako bundle, jen z něj čerpat vzhled.
- **Obsah + architektura (řídící):** tato složka `assets/data/`. Kde se liší od designu, řídí tato složka.

## Klíčové dokumenty (čti v tomto pořadí)

0. `assets/data/01-KICKOFF-PROMPT.md` — úvodní zadání, jak spojit design a handoff.
1. `assets/data/00-HANDOFF-START-HERE.md` — přehled, stav, plán prací, definition of done.
2. `assets/data/BRIEF-implementace-webu-pro-claude-code.md` — detailní zadání (Sheets, build, SEO, deploy).
3. `assets/data/README-pro-claude-code.md` — jak napojit data a loga, varianty log.

## Pravidla pro obsah (DODRŽET)

- Veřejný text nesmí znít jako interní poznámka: žádné „klient zmiňuje / oceňuje /
  podle klienta / klientovi vyhovuje". Reference = přirozená citace nebo redakční popis.
- Nepoužívat: prémiová personální agentura, lovíme talenty, headhunting jako hlavní
  pojem, levnější agentury, jsme lepší než konkurence, špičkoví kandidáti, prázdný
  „individuální přístup".
- Nepoužívat dlouhou pomlčku „—" (místo ní tečka, dvojtečka, středník, nová věta).
- Nevymýšlet fakta ani čísla. Číselné claimy (např. „99 %") jen po souhlasu klienta.

## Pravidla pro kód

- Bez frameworku a bez build-bundleru pro runtime; vanilla JS, progresivní vylepšení.
- Obsah musí být v HTML (prerender), ne jen dotažený JS — kvůli SEO a Google for Jobs.
- Loga: na tmavém pozadí `mono-light`, na světlém `mono-dark`, SITEL barevně.
  Vždy `alt` = název firmy, `loading="lazy"`.
- Respektovat `prefers-reduced-motion`.

## Build

```bash
cp build/config.example.json build/config.json
node build/build.mjs
```

## Definition of done

Viz `00-HANDOFF-START-HERE.md` (sekce „Hotovo, když"). Stručně: responsivní web s
obsahem ze Sheets v HTML, SEO (meta + OG + JobPosting + sitemap), nasazený na
www.sintera.cz přes HTTPS, s návodem na editaci pro klienta.
