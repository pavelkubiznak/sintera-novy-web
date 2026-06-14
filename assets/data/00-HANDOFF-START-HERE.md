# Sintera web — HANDOFF (start zde)

Tohle je předávací balíček pro Claude Code k postavení a nasazení webu Sintera.
Design i obsah jsou hotové, tady je vše potřebné, aby šlo z toho udělat ostrý,
editovatelný a indexovatelný web na **www.sintera.cz**.

## TL;DR co je hotovo a co se má udělat

Hotovo: design (prototyp), texty referencí a case studies (dle pravidel v2),
131 zpracovaných log, pozice, datové soubory pro web, schéma Google Sheets,
startovací CSV a kostra build skriptu.

Udělat: překlopit design prototypu do čistého `index.html` + napojit data + build
ze Sheets + SEO + responzivita + nasazení na hosting. Detailní postup je v
`BRIEF-implementace-webu-pro-claude-code.md`.

**Jak začít s Claude Code:** vlož mu úvodní zadání z `01-KICKOFF-PROMPT.md`. Spojí
design (vzhled) a tento handoff (obsah, data, build, SEO, deploy) a nastaví priority.
Vzhled = design file z Claude Design. Obsah a architektura = tato složka. Kde se liší,
řídí tato složka.

## Současný stav

- **Design:** prototyp `Sintera v5 - standalone-7.html` (zabundlovaný jednosoubor,
  slouží jako vizuální předloha). Pracovní zdroj webu se skládá v `assets/`
  (`css/styles.css`, `js/main.js`, `js/pozice*.js`).
- **Obsah:** 18 referencí, 8 case studies, 12 rotujících vět, 12 klientů do stripu,
  7 homepage proof bloků. Vše dle jazykových pravidel v2 (žádné „klient zmiňuje…",
  žádné zakázané fráze, žádná dlouhá pomlčka).
- **Loga:** 131 zpracovaných v `assets/logos/processed/`. V datech napojeno 17/18
  referencí a 12 klientů ve stripu. Chybí jen logo Windmöller & Hölscher.
- **Pozice:** 76 aktuálních pozic v `assets/js/pozice-data.js`.
- **Doména:** na www.sintera.cz teď neběží reálný obsah.

## Index souborů v tomto balíčku (assets/data/)

| Soubor | K čemu |
|--------|--------|
| `00-HANDOFF-START-HERE.md` | tento přehled |
| `01-KICKOFF-PROMPT.md` | úvodní zadání pro Claude Code (spojí design + handoff) |
| `CLAUDE.md` | kontext a pravidla pro Claude Code (přesunout do kořene repa) |
| `BRIEF-implementace-webu-pro-claude-code.md` | detailní zadání: Sheets, build, SEO, responzivita, deploy |
| `README-pro-claude-code.md` | jak napojit data a loga, varianty a cesty log |
| `reference-data.js` / `reference-data.json` | obsah pro web (references/cases/rotor/clients/homepage) |
| `sheets-templates/*.csv` | startovací data pro Google Sheets (4 listy, schéma + obsah) |
| `build/build.mjs` | build skript Sheets → JSON + sitemap/robots (+ TODO prerender) |
| `build/config.example.json` | konfigurace (baseUrl + CSV URL listů) |
| `build/README.md` | jak build spustit |

Mimo balíček: master tabulka všech ~98 referencí je v Excelu z dřívějška
(`Sintera_Master_tabulka_referenci.xlsx`) pro redakci a kontrolu citací.

## Doporučené pořadí prací

1. **Skeleton:** překlop design z prototypu do čistého `index.html` + `styles.css`
   (vizuální předloha = otevřený standalone-7.html). Použij existující `assets/`.
2. **Data:** doplň `assets/js/reference.js` a vykresli reference, cases, rotor, marquee
   a pozice z `reference-data` / `pozice-data`. Pozice už mají filtr v `pozice.js`.
3. **Google Sheets:** založ Sheet ze 4 CSV v `sheets-templates/`, publikuj listy jako
   CSV, URL vlož do `build/config.json`.
4. **Build:** dotáhni `prerender()` v `build/build.mjs`, ať vkládá obsah do `index.html`
   (značky `<!--REFS-->` atd.). Ověř generování `sitemap.xml`, `robots.txt`, JSON-LD.
5. **SEO:** meta + OG/Twitter, JSON-LD Organization + JobPosting (pozice), canonical,
   `lang=cs`, alt texty log.
6. **Responzivita + výkon:** breakpointy, mobilní nav, WebP loga, fonty, minifikace.
7. **Deploy:** build → nahrát výstup na hosting (FTP/SFTP), HTTPS, www/non-www redirect.
8. **Předání:** klientovi Google Sheet + krátký návod na editaci a re-deploy.

## Hotovo, když

- Web je responzivní (desktop i mobil), obsah je přímo v HTML (ne jen z JS).
- Pozice, reference a case studies jdou editovat v Google Sheets a po buildu se projeví.
- SEO: title/description, OG, JSON-LD JobPosting, sitemap.xml, robots.txt, canonical.
- Loga se zobrazují správně (mono-light na tmavém), s alt texty.
- Web běží na https://www.sintera.cz s přesměrováním http→https a www sjednocením.
- Klient má návod, jak přidat pozici/referenci/logo a web přegenerovat.

## Co je potřeba doplnit / potvrdit (blokuje deploy)

- **Hosting:** který provider + přístupy (FTP/SFTP host, login, cílová složka).
- **DNS:** kdo spravuje doménu sintera.cz (kvůli nasměrování na hosting + HTTPS).
- **Google účet** pro Sheet (vlastník, sdílení, publikace listů jako CSV).
- **Souhlasy klientů** se zveřejněním názvů, citací a log (zatím neověřeno).
- **OG obrázek** 1200×630 a kontrola faviconu (`assets/img/favicon.svg` existuje).
- **Logo Windmöller & Hölscher** (jediné chybějící) + texty mimo reference
  (hero, o nás, kontakt, GDPR/cookies), pokud ještě nejsou.
