# Provoz webu sintera.cz — návod

Web se staví **automaticky z Google Sheetu „Sintera-obsah"**. Co je v listech `pozice`,
`reference` a `case_studies` a má `zverejnit = ano`, to je na webu. Sestavení webu (build)
trvá 1 až 2 minuty.

> Tento návod je i přímo v Sheetu jako list **„NÁVOD"** (vlevo dole mezi záložkami).

## 1) Přidat obsah přes ChatGPT (nejrychlejší)

Otevři firemní ChatGPT a custom GPT **„Sintera – obsah na web"**. Vlož syrové zadání
(pozice, reference nebo case study). GPT připraví náhled a zeptá se: *uložit jako koncept,
nebo zveřejnit na web?* U pozice také: *má být vypíchnutá na homepage (featured)?*

Když potvrdíš „zveřejnit", záznam se zapíše do Sheetu a hned se spustí build. Za 1 až 2
minuty je živý. „Koncept" se uloží s `zverejnit = ne` (na webu zatím není).

## 2) Koncept vs. zveřejnění (a stažení z webu)

- Sloupec **`zverejnit`**: `ano` = na webu, `ne` = koncept (na webu není).
- **Zveřejnit ručně:** přepni `zverejnit` na `ano` a klikni **Sintera → Publikovat na web**.
- **Stáhnout z webu:** přepni `zverejnit` na `ne` a Publikovat. Řádek nemaž, zůstane ti jako archiv.

## 3) Tlačítko Sintera → Publikovat na web

Po jakékoli ruční změně v Sheetu (text, `zverejnit`, `featured`, pořadí) klikni nahoře
**Sintera → Publikovat na web**. Spustí se build, za 1 až 2 minuty se to projeví.

## 4) Pořadí pozic (nové nahoře)

Nové záznamy z ChatGPT se vkládají na **řádek 2 (nahoru)**, takže jsou nahoře i na webu.
Pořadí na webu = pořadí v Sheetu. Když chceš pořadí změnit ručně, přesuň řádky a dej Publikovat.

## 5) Featured (homepage)

Sloupec **`featured = ano`** → pozice se ukáže i na homepage v sekci „Aktuálně hledáme".
`ne` → je jen v úplném výpisu na /pozice/.

## 6) Formulář na reference (na webu)

Návštěvník zadá firemní e-mail a přijde mu odkaz na neveřejnou stránku s referencemi.
Volné e-maily (gmail, seznam apod.) jsou blokované. Každá žádost se zaloguje do listu
**`leady_reference`** (čas, e-mail, doména, telefon, jméno, pozice). E-mail odchází přes
Gmail účtu, na kterém běží skript (kopie je ve složce Odeslané).

## 6b) Reakce uchazečů na pozice

Formulář „Reagovat na pozici" (u každé pozice na webu) odesílá reakci rovnou z webu:
přijde e-mail na **info@sintera.cz** (tlačítko Odpovědět jde přímo uchazeči) a uchazeči
s e-mailem přijde potvrzení. Každá reakce je zároveň v neveřejné tabulce v listu
**`reakce_pozice`** (čas, pozice, jméno, kontakt, zpráva), kdyby e-mail zapadl.
Jinou adresu pro příjem nastavíš v Apps Scriptu ve vlastnostech skriptu jako `APPLY_TO`.

## 7) Loga nových klientů

- Existující klient (logo už máme) → v referenci stačí `logo_slug` a logo se ukáže.
- Nový klient → zatím se ukáže **název firmy textem** (nic se nerozbije).
- **Přidat logo:** hoď soubor do `assets/logos/raw/_nova/`, pojmenuj ho slugem klienta,
  a v Coworku (Claude) řekni „Zpracuj nová loga ze složky `_nova`".
  Detailní návod: `assets/logos/raw/_nova/README.md`.

## 8) Tokeny a bezpečnost

Tajné tokeny (zápis obsahu z GPT, GitHub token) jsou uložené **v Apps Scriptu →
Projektová nastavení → Vlastnosti skriptu**. NEJSOU v Sheetu ani na webu. Nikam je nekopíruj
a nesdílej.

## 9) Kde co najdu

- **Web:** https://www.sintera.cz
- **Zdrojový kód (repo):** https://github.com/pavelkubiznak/sintera-novy-web
- **Apps Script** (tlačítko Publikovat, odesílání e-mailů): v Sheetu menu **Rozšíření → Apps Script**
- **Návod na loga:** `assets/logos/raw/_nova/README.md`
- **Tento návod:** `assets/PROVOZ.md` (v repu) a list **NÁVOD** v Sheetu

## 10) Větší úpravy webu

Na změny vzhledu, struktury nebo buildu použij **Claude Code / Cowork (Claude)**. Běžný
provoz (přidávání a úpravy obsahu) zvládneš odsud ze Sheetu a z ChatGPT.
