# Stránka všech pozic /pozice/ — pokyny pro Claude Code

Cíl: tlačítko „Zobrazit všechny otevřené pozice" nemá vést na `#pozice` (stejná sekce),
ale na samostatnou stránku se všemi 76 pozicemi a filtry.

Většina je hotová a leží v `assets/` (kam mám přístup). Zbývá pár kroků v kořeni repa.

## Co už je hotové (v assets/)

- `assets/js/pozice-list.js` — výpis všech pozic z `pozice-data.js` jako odkazy na detail,
  filtry obor / seniorita / kraj + fulltext, počítadlo, reset. Nic neměň, jen nalinkuj.
- `assets/css/styles.css` — doplněn styl `.f-search` (vyhledávací pole). `.pos-row`,
  `.filters`, `.f-chip` už styl mají.
- `assets/data/pozice-page/index.html` — hotová šablona stránky (SEO head + sekce filtrů a seznamu).

## Kroky (v kořeni repa, kam nemám přístup)

1. **Vytvoř stránku** `pozice/index.html` (do stejné složky jako `pozice/<id>.html`):
   zkopíruj `assets/data/pozice-page/index.html` tam.
   - Cesty jsou už nastavené relativně ke složce `pozice/` (`../assets/...`).
   - Seznam má `data-detail-base=""`, takže odkazy míří na `<id>.html` ve stejné složce.

2. **Doplň hlavičku a patičku:** na vyznačená místa v šabloně vlož `<header>/<nav>`
   a `<footer>` zkopírované z kořenového `index.html`, ať je to 1:1 se zbytkem webu.
   Zkontroluj i `<link>` na fonty/CSS v `<head>` — musí sedět s `index.html`
   (předpokládám `../assets/css/fonts.css` a `../assets/css/styles.css`; uprav podle reality).

3. **Přesměruj tlačítko:** v `index.html` v sekci „Aktuálně hledáme" změň odkaz
   `Zobrazit všechny otevřené pozice` z `href="#pozice"` na `href="pozice/"`.
   (Homepage výběr 9 pozic nech být, jen tlačítko teď vede na plný seznam.)

4. **Detaily pozic:** ověř, že existují stránky `pozice/<id>.html` pro všechna id
   z `pozice-data.js` (seznam na ně odkazuje). Pokud je generuje build, spusť ho.

5. **Sitemap (volitelné, SEO):** přidej `https://www.sintera.cz/pozice/` do `sitemap.xml`
   (nebo do `writeSitemap` v `build/build.mjs`).

## Pozn.

- Canonical/OG v šabloně míří na produkční doménu `www.sintera.cz`. Na GitHub Pages
  náhledu je adresa jiná; až poběží na ostré doméně, sedí. Případně sjednoť s `index.html`.
- Pokud bys stránku chtěl jinde než ve složce `pozice/`, nastav na elementu
  `#pos-all-list` atribut `data-detail-base="pozice/"` (cesta k detailům).
