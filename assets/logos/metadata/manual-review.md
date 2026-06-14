# Seznam položek k ruční kontrole

_Vytvořeno 2026-06-13. Zdroj: adversariální verifikace (workflow) + vizuální QA + zpracování._

## A) Právní / oprávnění k publikaci — ✅ VYŘEŠENO (smluvně)
- `permission_status = public_reference_confirmed` u všech log.
- Souhlas plyne z rámcové smlouvy SINTERA: *„Zákazník souhlasí s eventuálním umístěním svého loga jako referenčního zákazníka pro účely webové a tištěné prezentace SINTERA CZECH s.r.o."* (ověřeno např. ve smlouvě s Bosch, `FIRMY - NÁBOR/<klient>/…Rámcová Smlouva….docx`).
- **Akce:** žádná navíc — jen měj příslušnou rámcovou smlouvu daného klienta po ruce. Pokud by konkrétní klient rámcovou smlouvu s touto klauzulí neměl, vyřaď ho z prezentace.
- Položky níže (B/C) se týkají **správnosti a kvality loga**, nikoli souhlasu.

## B) Konkrétní položky s příznakem `needs_manual_review = yes`

### 1. ZF — `confidence: medium`
- **Proč:** verifikace označila možnou **starší verzi** loga (soubor `ZF_logo_STD_Blue_3CC.svg` z Wikimedia).
- **Akce:** ověřit aktuální modrý roundel ZF. V interních podkladech Sintery je oficiální EPS: `ANALYTIKA/ZF Klášterec/podklady ZF/ZF logo STD Blue 4C.eps` — lze z něj získat čistý aktuální vektor.
- Entita: ZF Passive Safety Czech s.r.o. (dříve TRW) — značka ZF je správná.

### 2. Nestlé — `confidence: high`
- **Proč:** použit **čistý wordmark „Nestlé"** (bez ptačího hnízda). Pro strip je to čistší, ale nejde o kompletní emblém.
- **Akce:** rozhodnout, zda je wordmark dostačující, nebo chceš variantu s hnízdem (k dispozici na Wikimedia). Entita Nestlé Česko s.r.o.

### 3. Vitesco Technologies — `confidence: medium`
- **Proč:** **aktuálnost značky** — Vitesco dokončilo fúzi se Schaefflerem (10/2024), probíhá rebranding. Navíc zdrojové SVG je **monochromní** (tmavě šedá `#4a4944`), ne značková žlutá.
- **Akce:** ověřit, zda se značka Vitesco ještě používá; případně doplnit barevnou (žlutou) variantu. Pro strip je mono-light v pořádku.

### 4. Sécheron Hasler — `confidence: medium`
- **Proč:** zdroj je transparentní PNG (Wikimedia), zobrazuje „**Sécheron**". Ověřit, zda se dnes nepoužívá novější značka „**Sécheron Hasler Group**".
- **Akce:** porovnat s aktuálním brandingem na secheron.com. Entita Sécheron Hasler CZ s.r.o.

### 5. Winning Group — `confidence: high`
- **Proč:** **ambiguita entity** — ověřit, že jde o správnou „Winning Group a.s." (logo z winninggroup.cz). „group" má světlejší odstín (dvoubarevný wordmark).
- **Akce:** potvrdit, že winninggroup.cz = klient Sintery, a získat souhlas.

### 6. LINET — `confidence: medium`
- **Proč:** zdroj je **JPG s bílým pozadím** (z linet.com); pozadí odstraněno algoritmicky (white-key). Kvalita dobrá, ale není to nativní vektor/transparent.
- **Akce:** ideálně vyžádat oficiální SVG/transparentní PNG z linet.com. Entita LINET spol. s r.o.

### 7. Výzkumný ústav železniční (VUZ) — `confidence: medium`
- **Proč:** jediný nalezený zdroj je **bílé logo z patičky** webu — barevná varianta funguje jen na tmavém pozadí.
- **Akce:** získat plnobarevný / vektorový podklad od VUZ. Na světlé pozadí použít dodanou mono-dark variantu. Entita Výzkumný Ústav Železniční, a.s.

## C) Zpracovatelské poznámky (bez příznaku review, ale dobré vědět)

### SITEL — `confidence: high`, ale pozor na povahu loga
- **Barevný odznak** (bílý text na modrém poli). Monochromní silueta by zničila čitelnost, proto je `mono-light`/`mono-dark` = **originál v barvě** (dle zadání „ponech originál a zapiš poznámku").
- **Doporučení:** použít na stránce Reference (barevně), **ne** v mono homepage stripu.
- Entita: **SITEL, spol. s r.o.** (kabeláž / datová centra) — NE globální call-centrum Sitel/Foundever.

### Edwards — `confidence: high`
- Z oficiálního webu edwardsvacuum.com; ze zdrojového SVG **odstraněn bílý podkladový obdélník**. 
- Správná entita: **Edwards Vacuum** (skupina Atlas Copco) — NE Edwards Lifesciences (zdravotnictví).

## D) Položky bez výhrad (high confidence, ověřeno)
Siemens Energy · Panasonic · Safran Cabin · Alstom · Edwards · Aisan Industry — správná značka, správná entita, aktuální verze, čistý vektor. Zbývá jen souhlas klienta (sekce A).
