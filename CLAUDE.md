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
- Web má Content-Security-Policy (`<meta>`, vkládá build přes `withCsp`): skripty jen z vlastní
  domény, inline `<script>` bloky jen s hashem, který build spočítá sám. Nový inline skript nebo
  nový externí zdroj (CDN, obrázky z cizí domény, fetch na jiný server) bez úpravy `withCsp`
  v `build/build.mjs` prohlížeč zablokuje. Po ruční úpravě HTML spusť build.
- AI viditelnost (ChatGPT/Claude/Perplexity nespouštějí JS): výpis `/pozice/` build vkládá přímo
  do HTML (markery `POZICE_LIST_*`), `llms.txt` = úvod z `assets/data/ai-legibility/llms.txt`
  + seznam pozic generovaný buildem. Po deployi `build/indexnow.mjs` ohlásí změněné stránky
  Bingu/Seznamu (klíč = soubor `<hex>.txt` v kořeni, nemazat).
- Stránky oborů `/obory/<slug>/` a case studies `/case-studies/<slug>/` generuje build
  (`writeOboryACases`). Texty oborů = `assets/data/obory-stranky.json` (ručně, pravidla obsahu
  platí); role, otevřené pozice, kraje, case studies a reference doplní build ze Sheetu.
  Case studies se berou z listu case_studies, slug = id bez `case_`. Složky jsou plně generované.
- Apps Script: každý text od návštěvníka do tabulky přes `bunka_()` (jinak `=…` spustí vzorec).
- Anglická verze `/en/` (čtenář = klient, ne uchazeč; pozice se NEpřekládají, jen odkaz na české `/pozice/`):
  build (`prerenderEn`) přeloží českou šablonu podle `assets/data/i18n/en.json` (klíč = přesný český úsek
  šablony). Změníš-li český text v šabloně, build spadne s výpisem neplatných klíčů: uprav i překlad.
  Build spadne i při zbylé češtině v EN stránce (výjimky `_allow`). Reference/case studies ze Sheetu se
  překládají podle id; nepřeložené se na `/en/` nezobrazí (build vypíše „! /en/ bez anglického textu").
  JS texty: `T` v app.js a `EN` v apply-form.js podle `<html lang>`.
- Anglické podstránky (fáze 2, `writeEnPages`): `/en/industries/` + 8 oborů, `/en/roles/`, `/en/faq/`, přes
  `pageShell({ lang: "en", alt })`. Texty v `en.json`: `industries` (klíč = český slug, `_zdroj` = otisk české
  předlohy v obory-stranky.json), `roles` (anglické názvy rolí z katalogu /co-obsazujeme/; bez překladu se role
  nezobrazí a build ji vypíše), `labels` (obory, úrovně, kraje u pozic), `ui` (nav, patička, nadpisy). FAQ =
  `assets/data/ai-legibility/faq.en.md` (řádek `zdroj: faq.md @ <otisk>`). **Změníš-li českou předlohu oboru
  nebo faq.md, build spadne a vypíše nový otisk:** uprav překlad a otisk. Názvy pozic zůstávají česky
  s `lang="cs"`, firmy v referencích mají `translate="no"`: obojí kontrola zbylé češtiny přeskočí.
  Jazykové páry (`jazykovePary`) řídí hreflang v `<head>`, přepínač CZ/EN i `xhtml:link` v sitemap.xml.
  Odkaz na jinou EN stránku z `/en/` úvodu piš jako `./roles/` (upLevel ho nepřepíše).
- Anglické case studies (fáze 3): `/en/case-studies/` + stránka na příběh (`casePageEn`), text = `en.json → cases[id]`
  (id ze Sheetu, `slug` = anglická adresa, `_zdroj` = otisk české verze ze Sheetu). Příběhy edituje tým v Sheetu,
  proto změna češtiny build NEzastaví, jen vypíše „! česká case study se změnila“: uprav překlad a otisk.
  Příběh bez překladu na /en/ není. Modal na `/en/` vede na anglickou stránku přes `url` v reference-data.en.js.
- Anglický llms.txt (fáze 4, `writeLlmsTxtEn`): `/en/llms.txt` = úvod `ai-legibility/llms.en.txt` + „Does Sintera
  fill X? Yes.“ z `ai-legibility/profese.en.md` + obory, case studies, FAQ a pozice (názvy česky, popisky anglicky).
  Kořenový `/llms.txt` má hned za úvodem krátkou sekci „In English“ (`anglickaSekceLlms`), protože AI čtou hlavně ten.
  **Změníš-li `llms.txt` (úvod) nebo `profese.md`, build spadne a vypíše nový otisk:** uprav anglickou verzi
  a řádek `zdroj: … @ <otisk>` (v llms.en.txt je v HTML komentáři, do výstupu se nepíše).

## Build

```bash
cp build/config.example.json build/config.json
node build/build.mjs
```

## Definition of done

Viz `00-HANDOFF-START-HERE.md` (sekce „Hotovo, když"). Stručně: responsivní web s
obsahem ze Sheets v HTML, SEO (meta + OG + JobPosting + sitemap), nasazený na
www.sintera.cz přes HTTPS, s návodem na editaci pro klienta.
