# Handoff pro Claude Code: first-party měření návštěvnosti

Cookieless, first-party počítadlo. Beacon na webu posílá data do Apps Scriptu (stejná /exec
adresa jako formulář referencí), ten je loguje do listu `navstevy` v Sheetu. Žádné cookies,
žádná cookie lišta, neukládá se IP ani identifikátory.

## 1) Vložit beacon do webu
Obsah `sintera-analytics.js` vlož jako `<script>` do `<head>` všech stránek (inline je
nejjednodušší, bez extra requestu). Endpoint je v souboru už vyplněný (/exec). Beacon
automaticky měří:
- pageview při načtení stránky,
- klik na odkaz `mailto:` → akce `email-klik`,
- klik na odkaz `tel:` → akce `telefon-klik`,
- odeslání formuláře → akce `formular-odeslano`.
(Volitelně lze ručně: `window.sterk('nazev-akce')`.)

## 2) Apps Script (dělá uživatel)
Uživatel přidá do Code.gs handler `handleHit_` + řádek v routeru `doPost` (action 'hit') a
znovu nasadí web app novou verzí. Pro CC tu není nic, jen ať s tím počítá.

## 3) Zásady ochrany osobních údajů
Na stránku /ochrana-osobnich-udaju/ přidej odstavec:
"Statistika návštěvnosti: Pro základní přehled o návštěvnosti používáme vlastní cookieless
měření. Ukládáme navštívenou stránku, zdroj návštěvy a čas. Neukládáme IP adresu ani jiné
identifikátory a nepoužíváme cookies. Data jsou uložena v našem Google Sheetu a slouží jen
ke zlepšování webu."

## 5) Vyloučení vlastních návštěv (už je v beaconu)
Beacon umí opt-out: kdo jednou otevře web s `?nosterk=1` (např. https://www.sintera.cz/?nosterk=1),
uloží si do localStorage příznak a jeho návštěvy se dál nepočítají. Znovu zapnout: `?nosterk=0`.
Každý člen týmu to udělá jednou na každém svém prohlížeči/zařízení. (IP filtrovat nelze, web app
ji nevidí, proto tahle cesta.)

## 4) Kontrola
Po nasazení otevři pár stránek webu a v Sheetu v listu `navstevy` musí přibývat řádky
(cas, typ, stranka, zdroj, akce). Pozn.: beacon běží jen v prohlížeči, takže většina robotů
se nezapočítá (to je v pořádku).
