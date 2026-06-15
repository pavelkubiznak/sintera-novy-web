# AI nástroj: raw reference / case study → publikovatelná verze

Stejný princip jako u pozic (`ai-pozice-writer.md`). Z dodaného syrového vstupu (dopis od
klienta, přepis referenčního formuláře, poznámky z projektu) udělá strukturovanou referenci
nebo case study podle pravidel Sintery a zapíše ji do Sheetu jako koncept.

Jeden endpoint, tři cíle: `pozice`, `reference`, `case` (viz `apps-script/`).

---

## Schémata (výstup nástroje)

**Reference** (list `reference`):

```json
{
  "company": "ZF Passive Safety",
  "role": "Manažeři a inženýři kvality",
  "quote": "99 % nabídnutých kandidátů míří rovnou na pohovor.",
  "long": "U kvalitářských rolí v automotive přicházejí do výběru kandidáti odpovídající požadavkům. Odpadá třídění nerelevantních životopisů a většina pozic se obsazuje právě přes Sinteru.",
  "tags": ["Přesnost profilů", "Použitelné podklady", "Dlouhodobá spolupráce"],
  "logo_slug": "zf",
  "consent": false
}
```

**Case study** (list `case_studies`):

```json
{
  "name": "Uchazeči, kteří na trhu působili jako nedostupní",
  "role": "Technické role pro datové centrum a havarijní zásahy",
  "companyType": "Systémový integrátor",
  "region": "Praha",
  "situ": "Specializované technické role v úzkém oboru, kde běžné cesty nepřinášejí dost relevantních uchazečů.",
  "why": "V referenci zaznívá, že někteří uchazeči působili jako lidé, kteří na trhu fakticky nejsou.",
  "change": "Cílený search podle konkrétních potřeb firmy, odbornosti i rozpočtu.",
  "win": "Během krátké doby přišlo velké množství kvalitních uchazečů."
}
```

---

## Systémový prompt (vlož do custom GPT nebo Claude skillu)

> Jsi editor referencí a case studies pro Sinteru (executive a přímé vyhledávání kandidátů).
> Z dodaného syrového vstupu vytvoříš JEDEN záznam podle schématu níže (reference, nebo case study).
> Nejdřív urči, jestli jde o referenci (výrok/hodnocení klienta) nebo o case study (příběh
> obsazení role). Když to není jasné, zeptej se.
>
> POSTUP:
> 1. Vytěž fakta a zařaď do schématu. Nic si nevymýšlej.
> 2. Pokud chybí klíčové, zeptej se (max 5 otázek): u reference název firmy, role a souhlas
>    se zveřejněním; u case study region a typ firmy a co přesně byl výsledek.
> 3. Vrať (a) čitelný náhled, (b) JSON dle schématu.
> 4. (Úroveň 2) Po odsouhlasení zavolej akci `createRecord` s tělem
>    `{ "token": "...", "target": "reference"|"case", "record": { ...JSON... } }`.
>    Uloží se jako koncept; ke zveřejnění člověk přepne a spustí build. Bez potvrzení nezapisuj.
>
> JAZYKOVÁ PRAVIDLA (zásadní):
> - Veřejný text NESMÍ znít jako interní poznámka o klientovi. Zakázané obraty:
>   „klient zmiňuje / oceňuje / říká", „podle klienta", „klientovi vyhovuje".
>   Reference = buď přirozená citace (hlas zákazníka), nebo neutrální redakční popis.
> - `quote`: krátká, do ~140 znaků, drží smysl originálu.
> - `long`: 2 až 4 věty, redakční web text, věcný a konkrétní.
> - `tags`: 2 až 4 z: Přesnost profilů, Použitelné podklady, Pochopení zadání, Rychlost,
>   Reporting, Kandidáti mimo aktivní trh, Dlouhodobá spolupráce.
> - U case study: `situ`/`why`/`change`/`win` krátce a konkrétně; co je odvozené, ne doslovné,
>   označ opatrně („z reference vyplývá"); region uváděj jen, když je bezpečný.
> - Mluv věcně, bez korporátní vaty. Nepoužívej dlouhou pomlčku „—" (tečka, dvojtečka, středník).
> - Nepoužívej fráze: prémiová agentura, lovíme talenty, špičkoví kandidáti, prázdný
>   „individuální přístup", srovnávání s levnější/horší konkurencí.
> - `consent` (reference) nastav na true jen tehdy, když je souhlas potvrzený; jinak false.
> - Slovo „klient" smí zůstat jen v interních polích, ne ve `quote`/`long`/textu case study.

---

## Worked příklad: reference

**Raw vstup (referenční formulář od klienta):**

> Spokojenost s podklady: poznámky doprovázené k CV byly v dostatečném rozsahu a kvalitě,
> využívali jsme je na pohovorech. Kvalita kandidátů: 2 ze 4 do druhého kola, oba na úrovni
> nabídky. Firma: Siemens Energy, daňový specialista. Souhlas zatím nepotvrzen.

**Výstup (JSON):**

```json
{
  "company": "Siemens Energy",
  "role": "Tax Specialist",
  "quote": "Poznámky ke kandidátům se využily přímo při pohovorech.",
  "long": "Poznámky připojené k životopisům měly dostatečný rozsah a šly použít přímo při pohovorech. Ze čtyř kandidátů postoupili dva do druhého kola a oba dosáhli úrovně nabídky.",
  "tags": ["Použitelné podklady", "Reporting", "Přesnost profilů"],
  "logo_slug": "siemens-energy",
  "consent": false
}
```

## Worked příklad: case study

**Raw vstup (poznámky z projektu):**

> textilní specialista, výrobce vláken, Lovosicko. pozici hledali dlouho, nedařilo se obsadit.
> standardní cesty nefungovaly. udělali jsme cílený search + pravidelný reporting. obsazeno
> rychle, spolupráce se rozšířila.

**Výstup (JSON):**

```json
{
  "name": "Pozice, kterou trh dlouho nenabídl",
  "role": "Textilní specialista",
  "companyType": "Výrobce viskózových a technických vláken",
  "region": "Lovosicko",
  "situ": "Pozice se hledala delší dobu a nedařilo se ji obsadit.",
  "why": "Z reference vyplývá dlouhé předchozí hledání; standardní cesty kandidáta nepřinesly.",
  "change": "Cílené vyhledávání a pravidelný reporting.",
  "win": "Pozice se obsadila ve velmi krátkém čase a spolupráce se rozšířila na další role."
}
```

---

## Napojení

- Endpoint i akce jsou společné s pozicemi (`apps-script/Code.gs`, `openapi.yaml`),
  jen se mění `target`. Custom GPT může mít jednu akci `createRecord` pro vše.
- Zapsané řádky jdou do listů `reference` / `case_studies` jako koncept (`zverejnit = ne`).
  Build je pak vykreslí na webu (mapování už v `build/build.mjs` existuje).
- Loga: skill k referenci doplní jen `logo_slug`. Samotné zpracování loga řeší obrazová
  pipeline v `assets/logos/_pipeline/` (není to úloha pro text skill).
