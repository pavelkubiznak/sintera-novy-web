# AI nástroj: raw zadání pozice → publikovatelná verze

Zákazník dá syrové zadání (odrážky, kusy textu, e-mail). Tenhle nástroj z toho udělá
strukturovanou pozici podle vzorce Sintery. Je to v jádru **prompt + pevné schéma**,
takže běží stejně v ChatGPT (custom GPT), v Claude (skill/projekt) i přes API v buildu.

---

## Jak to může fungovat (tři úrovně, lze stavět postupně)

Důležité: web je řízený daty (Google Sheets → build → statické stránky). „Nahrát na web"
tedy znamená **zapsat řádek do Sheetu** (zdroj pravdy), build ho pak vystaví živě.

**Úroveň 1 — Skill + ruční vložení (doporučený start).**
GPT/skill vezme raw text, doptá se na chybějící klíčové údaje a vrátí hotový řádek
(JSON nebo rovnou sloupce do Sheetu). Ten vložíš do Google Sheetu, build → živě.
Nulová infrastruktura, plná kontrola, 90 % hodnoty.

**Úroveň 2 — Skill, který zapíše do Sheetu sám.**
Custom GPT dostane „Action" (nebo Apps Script webové URL u Sheetu), která přidá řádek
do listu `pozice`. Pak stačí spustit build (ručně, nebo automaticky denně / po zápisu).
Tohle je ono „nahraje to rovnou": GPT → Sheet → build → web. Vyžaduje malý endpoint a token.

**Úroveň 3 — Editor přímo na webu.**
Admin stránka na webu s polem „vlož raw", která zavolá LLM API a zapíše do Sheetu/repa.
Nejintegrovanější, ale nejvíc práce a hlídání (API klíč, přihlášení, náklady, bezpečnost).

Doporučení: postav **Úroveň 1** (skill níže), používej ji a teprve podle potřeby přidej
Úroveň 2 (jedno odpoledne práce: Apps Script + token). Úroveň 3 jen když to fakt chceš mít v adminu.

---

## Strukturované schéma pozice (výstup nástroje)

Jeden objekt na pozici. Tohle je zároveň cílová podoba dat na webu (řeší i náš dřívější
spor „strukturovaná pole vs. jeden HTML blok": jdeme do polí).

```json
{
  "title": "Servisní technik",
  "region": "Praha a Středočeský kraj",
  "category": "servis",
  "seniority": "spec",
  "employmentType": "FULL_TIME",
  "workMode": "onsite",
  "bonus": "",
  "salaryRange": "42 000 – 52 000 Kč",
  "salaryNote": "",
  "intro": "Když se zastaví stroj, čeká celá výroba na vás. Tady je vaše práce hned vidět.",
  "whyTalk": [
    "Konkrétní technika: svářecí roboty, jednoúčelové stroje i lisy.",
    "Stabilní mezinárodní firma s dlouhodobými projekty.",
    "Prostor růst a zaškolení od zkušenějších."
  ],
  "responsibilities": [
    "Udržíte v chodu svářecí a jednoúčelová zařízení i mechanické lisy.",
    "Opravíte stroje po elektrické i mechanické stránce.",
    "Provedete preventivní údržbu podle plánu."
  ],
  "mustHave": [
    "Vyučení nebo SŠ technického směru.",
    "Orientujete se ve výkresech a pracujete samostatně."
  ],
  "niceToHave": [
    "Siemens Simatic, roboti FANUC nebo KUKA.",
    "Vyhláška 50 §6."
  ],
  "offer": [
    "Mzda 42 000 – 52 000 Kč podle zkušeností + příplatky.",
    "Plně hrazené stravenky, Multisport.",
    "Odborné zaškolení a prostor růst."
  ],
  "cta": "Ozvěte se i bez životopisu. Nejdřív si v klidu řekneme, o jakou firmu jde. Vše diskrétně.",
  "public": true,
  "featured": false,
  "datePosted": "",
  "validThrough": ""
}
```

Mapování na Google Sheets (list `pozice`): každé pole = jeden sloupec. Pole se seznamem
(`whyTalk`, `responsibilities`, `mustHave`, `niceToHave`, `offer`) se v buňce píšou jako
odrážky oddělené novým řádkem nebo středníkem; build je rozseká. `build.mjs` se upraví,
aby tahle pole četl a vykreslil (dnes čte jen `popis`).

---

## Systémový prompt nástroje (zkopíruj do custom GPT nebo Claude skillu)

> Jsi editor pracovních pozic pro Sinteru (executive a přímé vyhledávání kandidátů).
> Z dodaného syrového zadání vytvoříš jednu strukturovanou pozici přesně podle pravidel níže.
> Sintera oslovuje i lidi, kteří práci mají a sami se nehlásí. Text proto musí dát rychlý,
> konkrétní důvod, proč o roli mluvit, ne jen výčet úkolů.
>
> POSTUP:
> 1. Z raw textu vytěž vše, co jde, a zařaď do schématu.
> 2. Pokud chybí něco klíčového, ZEPTEJ SE (max 5 cílených otázek najednou), než finalizuješ:
>    mzda/rozpětí, přesná lokalita, úvazek, směny (u dělnických), a co je must-have vs. výhoda.
>    Nikdy si mzdu ani fakta nevymýšlej.
> 3. Vrať výstup ve dvou částech: (a) čitelný náhled pozice, (b) JSON přesně dle schématu.
> 4. (Úroveň 2) Po odsouhlasení uživatelem zavolej akci `createPosition` s tělem
>    `{ "token": "...", "position": { ...JSON... } }`. Pozice se uloží jako koncept
>    (`zverejnit = ne`); ke zveřejnění ji člověk přepne a spustí build. Bez potvrzení nezapisuj.
>
> PRAVIDLA PSANÍ:
> - Titulek = jen název role. Žádné CAPS, vykřičníky, bonusy ani angličtina navíc.
>   Bonus patří do pole `bonus`, ne do názvu.
> - Mluv na „vy". Genderově neutrálně: „Budete…", „Máte…", „Hledáme někoho, kdo…";
>   vyhni se „Hledáme muže/člověka, který…" jako jediné formě a zbytečně mužským slovům.
> - `intro`: 1–3 věty, konkrétní háček, proč o roli stojí za to mluvit. Žádná klišé
>   („dynamický tým", „rodinná firma", „zajímavá práce").
> - `responsibilities`: 4–7 bodů, začínají slovesem, jen to podstatné.
> - `mustHave` vs `niceToHave`: oddělit; do niceToHave dej vše, co je „výhodou".
> - `offer`: nejdřív mzda a to, co rozhoduje (růst, smysl, samostatnost, stabilita),
>   pak konkrétní benefity. Nikdy „nadstandardní/atraktivní ohodnocení" bez čísla.
> - Mzda: vždy `salaryRange` (od–do). Když ji opravdu nelze uvést, nech `salaryRange` prázdné
>   a do `salaryNote` dej: „Mzdové podmínky řekneme otevřeně v prvním hovoru."
> - `cta`: přímé, věcné, diskrétní pozvání k rozhovoru (low barrier, „i bez životopisu").
> - Délka celkem 250–450 slov. Kratší a konkrétní je lepší. Bez překlepů.
> - Nepoužívej dlouhou pomlčku „—" (tečka, dvojtečka, středník). Nepoužívej zakázané fráze:
>   prémiová agentura, lovíme talenty, špičkoví kandidáti, prázdný „individuální přístup",
>   srovnávání s levnější/horší konkurencí.
> - `category` jeden z: vyroba, auto, tech, kvalita, logistika, servis, projekty, finance, hr, obchod.
>   `seniority` jeden z: spec, man, top. `employmentType`: FULL_TIME / PART_TIME.
> - Zachovej jazyk zadání (česky, případně anglicky u mezinárodních rolí).
>
> Když je vstup velmi stručný, doplň jen formulačně (tón, struktura), ne nová fakta.

---

## Worked příklad

**Raw vstup (jak to typicky přijde od zákazníka):**

> hledáme údržbáře na Vysočinu, opravy a údržba strojů, preventivní prohlídky, zámečnické
> práce, vrtání svařování. vyučený, praxe výhodou, svářečák výhodou, manuální zručnost.
> nabízíme atraktivní mzdu, náborák 50000, cafeterie 12000/rok, stravenky, akce. nástup ihned

**Doptání nástroje (příklad):**
„Doplníte prosím: 1) mzdové rozpětí (měsíčně), 2) jednosměnný nebo vícesměnný provoz,
3) přesnější lokalitu/dojezd?"

**Výstup (JSON, po doplnění mzdy 38–46k a jednosměnného provozu):**

```json
{
  "title": "Technik údržby",
  "region": "Vysočina",
  "category": "servis",
  "seniority": "spec",
  "employmentType": "FULL_TIME",
  "workMode": "onsite",
  "bonus": "náborový příspěvek 50 000 Kč",
  "salaryRange": "38 000 – 46 000 Kč",
  "salaryNote": "",
  "intro": "Stroje musí běžet a vy jste ten, kdo to zajistí. Stabilní firma, jednosměnný provoz a práce, kde je výsledek hned vidět.",
  "whyTalk": [
    "Jednosměnný provoz a jasné podmínky.",
    "Stabilní a rostoucí firma.",
    "Náborový příspěvek 50 000 Kč."
  ],
  "responsibilities": [
    "Opravíte a budete udržovat strojní zařízení.",
    "Provedete preventivní prohlídky.",
    "Připravíte náhradní díly.",
    "Zvládnete zámečnické práce, vrtání a svařování."
  ],
  "mustHave": [
    "Vyučení nebo SŠ technického směru.",
    "Manuální zručnost."
  ],
  "niceToHave": [
    "Praxe na obdobné pozici.",
    "Svářečský průkaz."
  ],
  "offer": [
    "Mzda 38 000 – 46 000 Kč podle zkušeností.",
    "Náborový příspěvek 50 000 Kč.",
    "Cafeterie Benefit Plus 12 000 Kč/rok, stravenkový paušál.",
    "Stabilní firma, firemní akce a další benefity."
  ],
  "cta": "Pošlete nám kontakt, klidně i bez životopisu. Ozveme se s detaily směn, mzdy a pracoviště.",
  "public": true,
  "featured": false,
  "datePosted": "",
  "validThrough": ""
}
```

---

## Co je potřeba k jednotlivým úrovním

- **Úroveň 1:** jen tenhle prompt vložit do custom GPT (nebo použít jako Claude skill).
  Hotovo hned. Výstup ručně do Sheetu.
- **Úroveň 2:** Google Apps Script na Sheetu (webové URL, které přijme JSON a přidá řádek)
  + v GPT nastavit „Action" na to URL s tokenem. Pak GPT zapíše rovnou do listu `pozice`.
  Build spustit ručně nebo nechat běžet automaticky.
- **Úroveň 3:** stránka v adminu webu + serverless funkce s LLM API klíčem, zápis do Sheetu/repa.
  Řešit až nakonec.

Ke každé úrovni umím dodat konkrétní kód (Apps Script pro Úroveň 2, úprava `build.mjs`
na strukturovaná pole, případně admin formulář pro Úroveň 3).
