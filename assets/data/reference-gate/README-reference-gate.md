# Hlídaný přístup k referencím (firemní e-mail → odkaz na landing)

Návštěvník zadá **pracovní e-mail** → ověří se, že není z free schránky (Seznam, Gmail…)
→ lead se zaloguje do Sheetu → e-mail s odkazem na **neveřejnou landing page** s referencemi
přijde **přímo přes Google (GmailApp)**, žádná externí služba.

Web je statický (GitHub Pages), proto logiku obstará **Google Apps Script** (stejný web app
jako pro zápis obsahu). Apps Script ověří doménu, zapíše lead a odešle e-mail přes GmailApp
z účtu, který skript vlastní. Žádný Resend, žádný nový hosting, žádná platba.

```
formulář na webu  ──POST──▶  Apps Script (/exec)
                                 │  ověří doménu + souhlas
                                 │  zaloguje lead → list "leady_reference"
                                 └─ GmailApp ──▶ e-mail s odkazem ──▶ /reference/<slug>/
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

## A) Tvoje část (jen Google, žádný Resend)

### 1. Apps Script — nastavení a nasazení
V Google Sheetu: Rozšíření → Apps Script. Kód je v `apps-script/Code.gs` (už hotový,
odesílá přes GmailApp). Do *Projektová nastavení → Vlastnosti skriptu* dej:

| Klíč | Hodnota |
|---|---|
| `TOKEN` | dlouhý náhodný řetězec (pro zápis obsahu z GPT, viz úroveň 2) |
| `LANDING_URL` | `https://www.sintera.cz/reference/<neuhodnutelny-slug>/` |
| `FROM_EMAIL` | volitelné: ověřený alias odesílatele (např. `info@sintera.cz`). Viz níže. |
| `REPLY_TO` | volitelné, default `info@sintera.cz` |

Pak: Nasadit → Webová aplikace → „Spustit jako: já", „Kdo má přístup: Kdokoli".
Při prvním spuštění Google vyžádá oprávnění k odesílání e-mailu (GmailApp), schval ho.
Zkopíruj URL `…/exec` (dáš ji Claude Code do `reference-gate.js`).

### 2. Odesílatel e-mailu (volitelné, ale doporučené)
E-mail odejde z účtu, který skript vlastní (tedy vlastník Sheetu). Pokud je to osobní
`@gmail.com`, bude odesílatel vypadat neprofesionálně. Dvě možnosti pro adresu `@sintera.cz`:
- V Gmailu daného účtu přidej `info@sintera.cz` jako *Nastavení → Účty → Odesílat jako*
  (ověř ho). Pak do `FROM_EMAIL` dej `info@sintera.cz`.
- Nebo měj Sheet i skript pod účtem `@sintera.cz` (Google Workspace); pak odesílatel sedí sám.

Limit Gmailu na odeslané e-maily: osobní účet ~100/den, Workspace ~1 500/den. Pro žádosti
o reference bohatě stačí.

### 3. Slug landing page
Vymysli neuhodnutelnou část adresy (např. `reference-2026-x7k9q`). Stejný slug dej
do `LANDING_URL` (krok 1) i Claude Code (krok B). Reference nejsou tajné, slug + noindex
je tu rozumný kompromis (netvoříme tvrdý zámek na netajný obsah).

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
- **Cooldown 120 s** na stejný e-mail (CacheService), brání rychlému opakování.
- **Denní limit Gmailu** (osobní ~100/den, Workspace ~1 500/den) přirozeně stropuje i zneužití.
- Mez: formulář je veřejný (nemůže mít tajný token, byl by vidět ve zdroji webu).
  Teoreticky lze poslat odkaz na cizí firemní e-mail. Obsah ale není citlivý a objem je
  omezen. Když bude potřeba přitvrdit, přidáme captcha/Turnstile nebo potvrzení 1 klikem.

## GDPR

- Sbíráme: e-mail (povinný), volitelně telefon, jméno, pozici; firmu odvodíme z domény.
- Formulář má **povinný souhlas** s odkazem na zásady ochrany osobních údajů.
- Účel: zaslání referencí a navázání kontaktu. Leady jsou v listu `leady_reference`.
- Zpracovatel je **Google** (Workspace/Apps Script/Gmail). **Resend se nepoužívá** — v zásadách
  ochrany osobních údajů ho odeber ze seznamu zpracovatelů (zůstává jen Google).

## Seznam free domén — držet v souladu

Stejný seznam je na **třech místech**: `free-domains.js` (zdroj pravdy), `reference-gate.js`
(rychlá hláška v prohlížeči) a `Code.gs` → `FREE_DOMAINS` (rozhoduje server). Když přidáš
doménu, uprav všechny tři.
