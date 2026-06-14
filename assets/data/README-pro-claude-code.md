# Sintera: reference a case studies pro web (podklad pro Claude Code)

Tady jsou hotová data referencí a case studies pro nový web, připravená k napojení.
Texty řeší **jen reference, case studies, rotující věty, homepage proof a logo strip**.
Ostatní obsah webu neřešit.

## Soubory v této složce

- `reference-data.js` — datový modul. Nastavuje `window.SINTERA_DATA` s poli
  `references`, `cases`, `rotor`, `clients`, `homepage`.
- `reference-data.json` — stejný obsah jako JSON (pro CMS, Google Sheets nebo build).
- `README-pro-claude-code.md` — tento soubor.

Texty splňují jazyková pravidla v2 (viz níže). Pole s prefixem `_` jsou interní
(stav ověření, riziko, zdroj). Render je má ignorovat, slouží k redakci a QA.

## Jak to napojit

Web (`Sintera v5`) renderuje obsah z polí `REFERENCES`, `CASES`, `ROTOR`, `CLIENTS`
a umí načítat i z Google Sheets (CSV). Stačí přidat `window.SINTERA_DATA` jako zdroj.

1. Načti datový modul **před** hlavním app skriptem:

   ```html
   <script src="assets/data/reference-data.js"></script>
   <!-- až potom app skript, který obsahuje renderReferences/renderCases/renderRotor -->
   ```

2. V app skriptu použij `window.SINTERA_DATA` jako výchozí data (fallback).
   Stačí těsně za definici zabudovaných polí přidat:

   ```js
   if (window.SINTERA_DATA) {
     REFERENCES = SINTERA_DATA.references || REFERENCES;
     CASES      = SINTERA_DATA.cases      || CASES;
     ROTOR      = SINTERA_DATA.rotor      || ROTOR;
     CLIENTS    = SINTERA_DATA.clients    || CLIENTS;
   }
   ```

   (Pozn.: v současné appce jsou `REFERENCES`, `CLIENTS`, `ROTOR` deklarované jako
   `var`, takže přepis funguje. Případně rovnou nahraď obsah těch polí daty odsud.)

Tvar polí přesně odpovídá tomu, co render funkce už používají:

- `references[]`: `company`, `role`, `quote` (krátká citace na kartě),
  `long` (2 až 4 věty do modalu), `logo` (cesta nebo ""), `tags` (důkazní štítky).
- `cases[]`: `meta` (popisný řádek), `situ`, `why`, `change`, `win`
  (+ interní `name`, `_verify`, `_risk`).
- `rotor[]`: `q` (věta), `c` (kategorie do popisku).
- `clients[]`: `name`, `logo`.
- `homepage[]`: `text`, `type`, `source` — hero proof věta a proof cards;
  zde nejsou navázané na render, použij dle layoutu homepage.

## Loga

Web je tmavý (`#0e1230`), proto jsou napojené **mono-light** varianty
(u SITELu barevná verze, mono je u jeho odznaku nečitelná). Cesty jsou relativní
k rootu webu (kde je `index.html`), tj. `assets/logos/processed/...`.

Pro každého klienta existují varianty (slug = např. `zf`, `nestle`):

| Varianta | Cesta | Pro pozadí |
|----------|-------|------------|
| mono-light | `assets/logos/processed/mono-light/<slug>-mono-light.svg` (nebo `.png`) | tmavé (web teď) |
| mono-dark | `assets/logos/processed/mono-dark/<slug>-mono-dark.svg` (nebo `.png`) | světlé |
| barevné SVG | `assets/logos/processed/svg/<slug>.svg` | světlé/neutrální |
| barevné PNG | `assets/logos/processed/png/<slug>-400x160.png` | univerzální |
| WebP | `assets/logos/processed/webp/<slug>-400x160.webp` | web (rychlé) |

Pokud sekce referencí poběží na světlém podkladu, přepni v datech logo cesty
z `mono-light` na `mono-dark` (stejný název, jiná složka).

### Napojeno (zpracováno 131 log)

Mezitím se zpracovala téměř všechna loga (131 ve `processed/`, varianty png/webp/mono-light/mono-dark;
barevné SVG zatím u 10 značek). V datech je napojeno:

V referencích (17 z 18): ZF Passive Safety, SITEL, ALSTOM, JTEKT, Nestlé, Aisan, Siemens Energy,
TRW Carr, ZF Electronics (logo ZF), R+S Automotive, SANBORN, SpofaDental, M.A.S. Automation,
Konplan, Vitesco, LINET, Výzkumný ústav železniční.
V logo stripu (marquee, 12 dle doporučení): Nestlé, Siemens Energy, Panasonic, ZF,
Safran, Alstom, Vitesco, Edwards, Aisan, LINET, Sécheron Hasler, Winning Group.

Pozn.: nové reference dostaly variantu `mono-light` PNG (na tmavé pozadí). Pokud některé
mono logo (silueta) není dobře čitelné, přepni u dané reference na barevnou variantu
(`processed/webp/<slug>-400x160.webp` nebo `processed/png/...`).

### Doplnit (zbývá)

- **Windmöller & Hölscher**: jediná reference bez loga (`logo:""`). Dohledat oficiální logo,
  protáhnout pipeline (`assets/logos/_pipeline/`) a doplnit cestu.
- **Logo strip lze rozšířit**: ve `processed/` je teď 131 log, marquee zatím používá
  kurátorských 12. Stačí přidat další klienty do listu `klienti` (sloupec `ve_stripu`).

Po zpracování doplň cestu do `logo` u příslušné reference v obou souborech
(`.js` i `.json`). V `assets/logos/raw/` je přes 100 dalších log klientů, takže
strip i reference jdou rozšiřovat dál.

## Jazyková pravidla (v2) — dodržet při jakékoli úpravě textů

Veřejný text **nesmí** znít jako interní poznámka o klientovi. Zakázané obraty
ve zveřejněném textu: „klient zmiňuje", „klient oceňuje", „klient říká",
„podle klienta", „klientovi vyhovuje". Reference má znít buď jako **přirozená
citace**, nebo jako **redakční webový popis**. (Slovo „klient" smí zůstat jen
v interních polích `_`.)

Dál nepoužívat: prémiová personální agentura, lovíme talenty, headhunting jako
hlavní pojem, levnější agentury, jsme lepší než konkurence, špičkoví kandidáti,
prázdný „individuální přístup". Nepoužívat dlouhou pomlčku „—" (místo ní tečka,
dvojtečka, středník nebo nová věta).

## Publikační checklist (před zveřejněním)

- Ověřit souhlas klienta se zveřejněním názvu i citace (platí pro všechny).
- Odstranit kontakty (telefony, e-maily) a osobní údaje.
- U scanů začernit podpisy, razítka a interní značky.
- Z veřejných citací vypustit jména konkrétních konzultantů, pokud je klient neschválí.
- Citace z OCR porovnat s originálním scanem; u poškozených přepisů použít parafrázi.
- Číselné claimy (např. „99 % kandidátů na pohovor") publikovat jen po výslovném souhlasu.
- Reference z let 2013 až 2016 spíš anonymizovaně nebo po potvrzení aktuálnosti.
- Loga jsou ochranné známky klientů: před zobrazením vyžádat souhlas.

Stav u jednotlivých položek je v interních polích `_status` a v master přehledu
referencí (samostatný Excel z předchozího kroku).
