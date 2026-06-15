# Úroveň 2: custom GPT zapíše pozici rovnou do Sheetu

Tok: napíšeš raw zadání do GPT → GPT z něj udělá strukturovanou pozici (skill v
`ai-pozice-writer.md`) → na potvrzení zavolá akci `createPosition`, která přidá řádek
do listu `pozice` jako **koncept** → člověk řádek zkontroluje, přepne `zverejnit` na `ano`
→ spustí se build → pozice je živě.

## Nastavení (jednorázově, ~30 minut)

1. **Sheet:** v Google Sheetu měj list `pozice`. Hlavička (první řádek) přesně:
   `nazev, obor, seniorita, kraj, uvazek, rezim, bonus, mzda_rozsah, mzda_pozn, uvod,
   proc_mluvit, naplne, must, vyhoda, nabizime, cta, featured, zverejnit,
   datum_zverejneni, platnost_do`
   (Stačí, když list bude prázdný; skript hlavičku doplní sám při prvním zápisu.)

2. **Apps Script:** v Sheetu `Rozšíření → Apps Script`, vlož obsah `Code.gs`.
   - Změň `TOKEN` na vlastní dlouhý náhodný řetězec.
   - `Nasadit → Nové nasazení → Webová aplikace`: „Spustit jako: já",
     „Kdo má přístup: Kdokoli". Zkopíruj URL `.../exec`.

3. **Custom GPT (ChatGPT):**
   - Do instrukcí GPT vlož systémový prompt z `ai-pozice-writer.md`
     a na konec doplň token (viz níže).
   - `Configure → Actions → Create new action`: vlož `openapi.yaml`,
     v `servers.url` nahraď `NASAD_ID` svým deployment ID (z URL `.../s/NASAD_ID/exec`).
   - Authentication: None (token jde v těle požadavku).

4. **Token v GPT:** na konec instrukcí GPT přidej řádek:
   `Při volání akce createPosition použij token: "TVUJ_TOKEN".`
   (GPT je soukromý; token je sdílené tajemství. Přenos je přes HTTPS. Token kdykoli změň
   v Code.gs i v instrukcích.)

5. **Build a deploy:** po schválení pozic spusť build (`node build/build.mjs`) a nahraj web.
   Volitelně build pouštěj automaticky (cron / po commitu).

## Proč je to bezpečné dost

- Nové pozice se ukládají jako **koncept** (`zverejnit = ne`). Nic nejde živě bez člověka.
- Token brání náhodnému/cizímu zápisu.
- I kdyby token unikl, maximum škody je koncept v Sheetu, který nikdo neschválil.

## Test

- `doGet` (otevři URL `.../exec` v prohlížeči) vrátí `{"ok":true,...}` = web app běží.
- V GPT řekni „ulož tuhle pozici" po vytvoření; v Sheetu přibude řádek se `zverejnit = ne`.

## Soubory

- `Code.gs` — endpoint (doPost zapíše řádek, doGet health-check).
- `openapi.yaml` — schéma akce pro custom GPT.
- `../ai-pozice-writer.md` — systémový prompt skillu (raw → strukturovaná pozice).
