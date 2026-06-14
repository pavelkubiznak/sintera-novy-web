# Pipeline (reprodukovatelnost)

Skripty, kterými byl asset pack vytvořen. Vyžaduje: macOS s Google Chrome (headless render SVG→PNG) a Python 3 s Pillow (WebP zapnuto).

- `process.py` — z `manifest.json` vytvoří všechny varianty (svg/png/webp/mono-light/mono-dark), optické vyvážení na canvas 400×160. Chrome se spouští neblokujícím způsobem (počká na zápis PNG a pak ho ukončí — jinak na macOS visí, když běží uživatelův Chrome).
- `build_site.py` — sloučí `wf_results.json` (ověření) + výstup `process.py` → `metadata/client-logos.csv` + `site_data.json`.
- `build_html.py` — vygeneruje `contact-sheet/client-logos.html` a `logo-strip-demo.html`.
- `render_pngs.py` — отrendruje contact sheet do PNG přes Chrome.
- `qa_grid.py` — vizuální QA mřížka.
- `manifest.json` — vstup (slug, zdrojový soubor, formát, optické úpravy: scale/white_key/mono_mode).
- `wf_results.json` — výstup ověřovacího workflow (zdrojové URL, confidence, permission, brand notes, review).

## Přidání dalšího klienta
1. Stáhni ověřený zdroj loga do `raw/<slug>.<ext>` (preferuj oficiální SVG / Wikimedia).
2. Přidej řádek do `manifest.json`.
3. `python3 process.py manifest.json <out_base> <out_base>/results.json`
4. Doplň záznam do `wf_results.json`, pak `build_site.py` + `build_html.py` + `render_pngs.py`.
