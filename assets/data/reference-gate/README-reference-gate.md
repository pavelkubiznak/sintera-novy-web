# Hlídaný přístup k referencím (firemní e-mail → odkaz na landing)

Návštěvník zadá **pracovní e-mail** → ověří se, že není z free schránky (Seznam, Gmail…)
→ lead se zaloguje do Sheetu → přes **Resend** přijde e-mail s odkazem na **neveřejnou
landing page** s referencemi, ukázkami případů a pozvánkou k hovoru.

Web je statický (GitHub Pages), proto logiku obstará **Google Apps Script** (stejný web app
jako pro zápis obsahu). Apps Script ověří doménu, zapíše lead a zavolá Resend API. Žádný
nový hosting není potřeba.

```
formulář na webu  ──POST──▶  Apps Script (/exec)
                                 │  ověří doménu + souhlas
                                 │  zaloguje lead → list "leady_reference"
                                 └─ Resend API ──▶ e-mail s odkazem ──▶ /reference/<slug>/
```

## Tok (dvě stránky)

1. Na konci sekce Reference na homepage je výrazný blok s tlačítkem **Získat reference**.
2. Tlačítko vede na **veřejnou** stránku `/reference-info/` (manifest + čísla + formulář).
3. Po odeslání přijde e-mail s odkazem na **neveřejnou** `/reference/<slug>/` se samotnými referencemi.

## Soubory (v tomto adresáři)

- `reference-info-template.html` — VEŘEJNÁ stránka `/reference-info/` (manifest osobním tónem,
  proužek čísel, formulář). Hlavní vstup. Tohle je to, co reassuruje při vyplňování.
- `form.html` — samostatná verze jen formuláře (kdyby ses ho rozhodl vložit i jinam jako sekci).
- `reference-gate.js` — odeslání formuláře (nastav `ENDPOINT`). Sdílí obě varianty.
- `reference-gate.css` — styl formuláře (ladí s `styles.css`).
- `landing-template.html` — NEVEŘEJNÁ stránka s referencemi (nasaď na `/reference/<slug>/`).
- `free-domains.js` — sdílený seznam free domén (zdroj pravdy).
- `../apps-script/Code.gs` — backend (už obsahuje větev `reference_request`).

---

## A) Tvoje část (účty Resend + Google)

### 1. Resend — doména a API klíč
- V Resendu přidej doménu **sintera.cz** (Domains → Add Domain) a nastav v DNS záznamy,
  které Resend ukáže (SPF/DKIM, příp. DMARC). Účet můžeš použít stejný jako pro sarkaogrocka.cz.
- Vytvoř **druhý API klíč** (API Keys → Create), ať je oddělený od Šárky. Free tier
  (3 000 e-mailů/měsíc) na začátek stačí.
- Zvol odesílací adresu, např. `reference@sintera.cz`.

### 2. Apps Script — nastavení tajemství a nasazení
V Google Sheetu: Rozšíření → Apps Script. Kód je v `apps-script/Code.gs` (už hotový).
Tajemství **nedávej do kódu**, ale do *Projektová nastavení → Vlastnosti skriptu*:

| Klíč | Hodnota |
|---|---|
| `TOKEN` | dlouhý náhodný řetězec (pro zápis obsahu z GPT, viz úroveň 2) |
| `RESEND_API_KEY` | `re_…` (ten druhý klíč pro sintera.cz) |
| `FROM_EMAIL` | `Sintera <reference@sintera.cz>` |
| `LANDING_URL` | `https://www.sintera.cz/reference/<neuhodnutelny-slug>/` |
| `REPLY_TO` | volitelné, např. `info@sintera.cz` |

Pak: Nasadit → Webová aplikace → „Spustit jako: já", „Kdo má přístup: Kdokoli".
Zkopíruj URL `…/exec` (dáš ji Claude Code do `reference-gate.js`).

### 3. Slug landing page
Vymysli neuhodnutelnou část adresy (např. `reference-2026-x7k9q`). Stejný slug dej
do `LANDING_URL` (krok 2) i Claude Code (krok B). Reference nejsou tajné, slug + noindex
je tu rozumný kompromis — netvoříme tvrdý zámek na netajný obsah.

---

## B) Claude Code (repo)

1. **Vstupní stránka + formulář:** ulož `reference-info-template.html` jako
   `reference-info/index.html`. Přidej `reference-gate.css` do stylů a `reference-gate.js`
   do `assets/js/`. V `reference-gate.js` nastav `ENDPOINT` na URL Apps Scriptu (`…/exec`).
   Na konci sekce Reference na homepage nahraď nenápadnou větu „Archiv více než 100 referencí
   poskytujeme na vyžádání." výrazným blokem s tlačítkem **Získat reference** vedoucím na
   `/reference-info/`. (`form.html` je jen samostatná verze formuláře, kdyby se hodila jinam.)
2. **Neveřejná stránka s referencemi:** ulož `landing-template.html` jako
   `reference/<slug>/index.html` (stejný slug jako v `LANDING_URL`).
3. **Skrytí před vyhledávači:** `/reference/` **nedávej do `sitemap.xml`** a do `robots.txt`
   přidej `Disallow: /reference/`. (Landing má i `<meta robots noindex>`.) Nikam na ni neodkazuj.
4. **Privacy:** formulář odkazuje na `/ochrana-osobnich-udaju/`. Pokud stránka ještě není,
   vytvoř ji (je to i samostatný bod backlogu: GDPR 110/2019 + GDPR).
5. Commit + nech proběhnout auto-deploy.

> CORS: `reference-gate.js` posílá `Content-Type: text/plain` schválně (Apps Script nezvládá
> preflight u `application/json`). Tělo je stejně JSON, server ho čte z `e.postData.contents`.
> Kdyby prohlížeč přesto hlásil CORS, fallback je odeslání přes skrytý `<iframe>` (no-cors).

---

## Ochrana proti zneužití (a její meze)

- **Honeypot** (`website`): boti vyplní skryté pole, žádost se tiše zahodí.
- **Cooldown 120 s** na stejný e-mail (CacheService) — brání rychlému opakování.
- **Strop Resend free tier** (3 000/měsíc) omezuje i případné zneužití.
- Mez: formulář je veřejný (nemůže mít tajný token, byl by vidět ve zdroji webu).
  Teoreticky lze poslat odkaz na cizí firemní e-mail. Obsah ale není citlivý a objem je
  omezen. Když bude potřeba přitvrdit, přidáme captcha/Turnstile nebo potvrzení 1 klikem.

## GDPR

- Sbíráme: e-mail (povinný), volitelně telefon, jméno, pozici; firmu odvodíme z domény.
- Formulář má **povinný souhlas** s odkazem na zásady ochrany osobních údajů.
- Účel: zaslání referencí a navázání kontaktu. Leady jsou v listu `leady_reference`.
- Doplnit do privacy stránky: účel, doba uchování, právo na výmaz, správce údajů.

## Seznam free domén — držet v souladu

Stejný seznam je na **třech místech**: `free-domains.js` (zdroj pravdy), `reference-gate.js`
(rychlá hláška v prohlížeči) a `Code.gs` → `FREE_DOMAINS` (rozhoduje server). Když přidáš
doménu, uprav všechny tři.
