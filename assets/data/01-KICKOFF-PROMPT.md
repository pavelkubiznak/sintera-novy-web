# Kickoff prompt pro Claude Code (vlož jako první zprávu)

Tímto se spojí **design** (z Claude Design) a **handoff** (tahle složka) dohromady.
Zkopíruj celý blok níže do Claude Code jako úvodní zadání.

---

Stavíš produkční web pro Sinteru (personální agentura, přímé vyhledávání kandidátů).
Máš dva vstupy a jasné priority.

**1) DESIGN = jak má web vypadat (vizuální předloha):**
Fetchni design file a přečti jeho readme:
`https://api.anthropic.com/v1/design/h/VE23-Bw5uhJbRzNW8Wdlqw?open_file=Sintera+-+Live+prototyp+v5.html`
Je to prototyp (zabundlovaný React/Babel jednosoubor). Ber z něj vzhled, layout, sekce,
typografii a animace. **Neimplementuj ho doslova jako bundle.**

**2) SPEC + OBSAH + DATA = co a jak (řídící dokumenty):**
Začni v `assets/data/`:
- `00-HANDOFF-START-HERE.md` — přehled, stav, pořadí prací, definition of done.
- `CLAUDE.md` — pravidla (přesuň do kořene repa).
- `BRIEF-implementace-webu-pro-claude-code.md` — Sheets, build, SEO, responzivita, deploy.
- `README-pro-claude-code.md` — napojení dat a log.

**Priority, když se design a dokumenty liší:**
- Vzhled řídí design. **Obsah, datový model, build, SEO, responzivita a deploy řídí `assets/data/`.**
- **Nepoužívej placeholder obsah z prototypu** (má jen 3 reference a 3 case studies a prázdné
  Sheets URL). Skutečný obsah je v `assets/data/reference-data.json` (18 referencí, 8 case
  studies, 12 log do stripu, rotující věty, homepage proof) a pozice v `assets/js/pozice-data.js`.
- Výstup musí být **lehký statický web** (čisté HTML + CSS + vanilla JS), ne 1,5MB bundle.
- Obsah musí být **přímo v HTML** (prerender přes `build/build.mjs`), ne jen dotažený v
  prohlížeči — kvůli SEO a Google for Jobs.
- Drž jazyková pravidla a SEO checklist z `CLAUDE.md` (žádné „klient zmiňuje…", žádné
  zakázané fráze, žádná dlouhá pomlčka, JSON-LD JobPosting pro pozice).
- Loga: na tmavém pozadí `mono-light`, alt = název firmy, lazy-load. Je jich 131 v
  `assets/logos/processed/`.

**Postup:** drž se „Doporučené pořadí prací" v `00-HANDOFF-START-HERE.md`
(skeleton z designu → napojení dat → Google Sheets → build/prerender → SEO →
responzivita/výkon → deploy na www.sintera.cz). Než začneš, projdi „Co je potřeba
doplnit / potvrdit" a vyžádej si chybějící (hosting/FTP, DNS, Google účet, souhlasy).

---

## Proč to takhle

Design file a tento handoff jsou komplementární: prototyp řeší vzhled, handoff řeší
obsah, architekturu a nasazení. Bez téhle instrukce hrozí, že se prototyp zabuduje
i s ukázkovým obsahem, jako těžký bundle a bez SEO/Sheets. S ní na sebe obě části navážou.
