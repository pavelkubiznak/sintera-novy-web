# Zeď referencí — integrace a přidávání (pro Claude Code)

Galerie skutečných referencí (skeny) na **neveřejné** stránce `/reference/<slug>/`,
za e-mailovou bránou. Dlaždice = rozostřený náhled + firma a sektor; klik = velký
scrollovatelný sken + popisek (firma, sektor, hledaná pozice, referující osoba).

## Co je hotové v repu

- `assets/reference-wall/full/full-NN.jpg` — plné skeny (telefon u kontaktu **zakrytý**),
  103 souborů (98 referencí + 5 druhých stran `full-NNb.jpg`). Rozlišení 1000 px.
- `assets/reference-wall/thumbs/wall-NN.jpg` — rozostřené náhledy (98), údaje nečitelné.
- `assets/data/reference-wall.json` — data (firma, sektor, obor, role, kontakt, stitky, thumb, full, full2).
- `assets/css/reference-wall.css`, `assets/js/reference-wall.js` — komponenta (mřížka + modal).
- `assets/data/sheets-templates/reference_zed.csv` — 98 řádků pro nový list v Sheetu (CMS).
- `assets/data/reference-wall/tools/redact-and-thumb.py` — nástroj na nové skeny.

## A) Integrace do stránky `/reference/<slug>/`

1. Do `<head>` přidej `assets/css/reference-wall.css`.
2. Do těla (pod manifest/úvod) vlož sekci:
   ```html
   <section class="rw">
     <h2>Reference, které nekončí</h2>
     <p class="rw__count"><b id="rw-n"></b> doložených referencí</p>
     <div class="rw__grid" id="rw-grid"></div>
   </section>
   ```
3. Před `</body>`: nastav cestu k obrázkům + data + renderer:
   ```html
   <script>window.WALL_BASE = '../../assets/reference-wall/';</script>
   <script src="../../assets/data/reference-wall.js"></script>   <!-- window.REFERENCE_WALL = [...] -->
   <script src="../../assets/js/reference-wall.js"></script>
   ```
   (`reference-wall.js` renderer čte `window.REFERENCE_WALL`. Naplň `#rw-n` délkou pole.)
   Cesty `../../` odpovídají hloubce `/reference/<slug>/`; uprav, pokud změníš umístění.

4. **Zeď patří jen na tuhle neveřejnou stránku**, ne na homepage. Stránka zůstává
   `noindex`, mimo `sitemap.xml`, `Disallow: /reference/` v robots.

## B) Datové řízení ze Sheetu (CMS)

Cíl: reference jdou přidávat/editovat bez sahání do kódu.

1. V Sheetu vytvoř list **`reference_zed`** importem `sheets-templates/reference_zed.csv`
   (sloupce: `firma, sektor, obor, role, kontakt, stitky, scan, scan2, zverejnit`).
2. V `build/config.json` přidej k tomu listu CSV URL (jako u ostatních listů).
3. V `build/build.mjs` přidej krok, který z listu `reference_zed` (řádky `zverejnit=ano`)
   vygeneruje `assets/data/reference-wall.js` s `window.REFERENCE_WALL = [...]`, kde
   `thumb = "thumbs/wall-…"`, `full = "full/" + scan`, `full2 = scan2 ? "full/"+scan2 : ""`,
   `stitky` rozsekej podle `;`. (Fallback: commitnutý `assets/data/reference-wall.json`.)
   Pozn.: názvy souborů ve `scan`/`scan2` musí odpovídat souborům v `assets/reference-wall/full/`.

## C) Přidání nové reference (běžný provoz)

1. Přijde sken (obrázek nebo PDF). Projeď ho nástrojem:
   `python3 assets/data/reference-wall/tools/redact-and-thumb.py vstup.jpg --slug skoda --outdir assets/`
   → vyrobí `full/full-skoda.jpg` (telefon u kontaktu zakrytý) a `thumbs/wall-skoda.jpg`.
2. **Sken očima zkontroluj** (OCR není 100%), pak ho nech v repu.
3. Přidej řádek do listu `reference_zed` (`scan = full-skoda.jpg`, vyplň firma/sektor/…).
4. Build → reference je na zdi. (Časem může řádek psát i custom GPT.)

## Soukromí (důležité)

Repo je veřejné, takže plné skeny jsou fakticky veřejně dostupné (přes adresu souboru
i prohlížením repa), ne jen za bránou. Tak to Pavel vědomě schválil. Zakrytý je **telefon
u kontaktní osoby**; firemní/patičková čísla, jména a podpisy zůstávají (veřejná, resp.
souhlas klienta s referencí). Skeny drž jen pod `/reference/<slug>/` (noindex). Nové skeny
vždy projeď nástrojem a zkontroluj očima.

## Pozn. k rozlišení
Skeny jsou 1000 px (čitelné, lehce měkké). Pokud chcete ostřejší, dají se přerenderovat
z PDF ve vyšším DPI — ale redakci telefonu pak znovu ověřit (neposílat nezkontrolované).
