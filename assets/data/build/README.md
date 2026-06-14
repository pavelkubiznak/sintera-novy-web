# Build skript (Google Sheets → web)

Vygeneruje datové JSON pro web, sitemap a robots z publikovaných Google Sheets.
Když Sheety nejsou nastavené nebo selžou, použije commitnutý JSON (web se nerozbije).

## Spuštění

```bash
cp build/config.example.json build/config.json   # jednou
# do config.json vlož publikované CSV URL listů (nepovinné, jinak fallback)
node build/build.mjs
```

Vyžaduje Node 18+ (globální `fetch`). Bez závislostí.

## Co vznikne

- `assets/data/site-data.json` — kompletní snapshot (pozice, reference, cases, klienti, rotor, homepage).
- `assets/data/reference-data.json` + `reference-data.js` — přegenerováno ze Sheets.
- `assets/data/jobposting-ld.json` — JSON-LD JobPosting pro SEO (vlož do `<head>`).
- `sitemap.xml`, `robots.txt` — v kořeni webu.

## Co dodělat (TODO v build.mjs)

`prerender()` zatím jen loguje. Doplň vkládání sekcí do `index.html` (značky
`<!--REFS-->`, `<!--CASES-->`, `<!--ROTOR-->`, `<!--MARQUEE-->`, `<!--POZICE-->`,
`<!--JSONLD-->`), aby byl obsah v HTML kvůli SEO a Google for Jobs.

## Umístění

Tyto soubory jsou v `assets/data/build/` jako součást handoffu. Pro ostrý provoz
je doporučeno přesunout `build/` do kořene repozitáře a v `build.mjs` upravit
konstantu `ROOT` (komentář u ní). `config.json` přidej do `.gitignore`.
