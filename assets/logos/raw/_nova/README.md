# Nová loga – sem to dej

Když přibude **nový klient**, kterého ještě nemáme v balíku log, postup je jednoduchý:

1. **Vlož sem jeho logo.** Nejlepší je čisté **SVG**, jinak velké **PNG** nebo **PDF**.
2. **Pojmenuj soubor „slugem" klienta** – malá písmena, bez mezer a diakritiky.
   - Příklad: firma „ACME Tools" → soubor `acme-tools.svg`
   - **Stejný slug** pak použij i v referenci (pole `logo_slug` v ChatGPT / Sheetu).
3. **Otevři Cowork (Claude) a napiš:** „Zpracuj nová loga ze složky `_nova`."
   - Claude logo vyčistí a vyrobí všechny varianty:
     - `processed/mono-light/` (jednobarevná pro homepage logo strip na tmavém pozadí)
     - `web/` (čisté SVG + transparentní PNG pro referenční kartu)
   - a zařadí je do balíku.

## Důležité

- Dokud logo nedoplníme, reference se na webu ukáže s **názvem firmy jako textem**. Nic se nerozbije.
- **Souhlas** se zobrazením loga je smluvně ošetřený v rámcové smlouvě SINTERA. U zobrazených klientů měj příslušnou smlouvu po ruce; pokud by ji konkrétní klient s touto klauzulí neměl, z prezentace ho vynech.
- Plně automatický vkladač **záměrně neděláme**: loga chodí v různé kvalitě a potřebují ruční doladění (ořez, barva, mono varianta na tmavém pozadí). Proto ten krok přes Claude.

Podrobnosti o celém balíku log: `../../README.md` (složka `assets/logos`).
