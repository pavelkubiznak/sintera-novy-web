# Handoff pro Claude Code: AI čitelnost webu (GEO)

Cíl: aby web sintera.cz dobře četly a citovaly AI nástroje (ChatGPT, Perplexity, Gemini, Google AI Overviews), když se HR/personální ředitelé ptají na výběr search agentury. Žádný separátní „web pro AI", jen zpřístupnění stávajícího webu strojům.

Obsah už je hotový v `assets/data/ai-legibility/`:
- `llms.txt` — hotový text k umístění do kořene webu.
- `faq.md` — Q&A pro FAQ stránku.
- `schema-organization.json` — JSON-LD (ProfessionalService) pro hlavičku.
- `schema-faqpage.json` — JSON-LD (FAQPage) pro FAQ stránku.

## Co zapojit do buildu

1. **llms.txt do kořene.** Zajisti, aby se `llms.txt` servíroval na `https://www.sintera.cz/llms.txt` (HTTP 200, text/plain nebo text/markdown). Zkopíruj obsah z `assets/data/ai-legibility/llms.txt` do kořene výstupu buildu (vedle robots.txt a sitemap.xml). Nech ho být indexovatelný (nezakazovat v robots.txt).

2. **Organization/ProfessionalService schema do hlavičky.** Vlož obsah `schema-organization.json` jako `<script type="application/ld+json">` do `<head>` aspoň homepage, ideálně všech stránek. Nesmí kolidovat s existujícím JobPosting JSON-LD na detailech pozic (může být víc bloků JSON-LD na stránce).

3. **FAQ stránka.** Vytvoř stránku (např. `/faq/` nebo `/caste-dotazy/`) z obsahu `faq.md` (sekce = otázka, odstavec = odpověď). Na tuto stránku vlož `schema-faqpage.json` jako `<script type="application/ld+json">`. Přidej odkaz do patičky (a klidně do nav). Přidej URL do `sitemap.xml`.

4. **Kontrola.** Po buildu ověř:
   - `/llms.txt` vrací 200 a správný text,
   - FAQ stránka se renderuje a odkaz v patičce funguje,
   - JSON-LD projde validátorem (Google Rich Results Test / validator.schema.org) bez chyb.

## Pozn. (volitelné, do budoucna)
- FAQ se dá později řídit ze Sheetu (nový list `faq` se sloupci `otazka`, `odpoved`), aby ho šlo upravovat stejně jako pozice/reference. Není to teď nutné.
- Až bude hotovo, stojí za to znění llms.txt a FAQ promítnout i do `assets/PROVOZ.md` / listu NÁVOD, aby konzultanti věděli, že to existuje.

## Hlas a pravidla obsahu (dodržet při úpravách)
- Bez dlouhé pomlčky „—". Bez frází: prémiová agentura, lovíme talenty, špičkoví kandidáti, prázdný „individuální přístup". Žádné srovnávání s konkurencí. Fakta neměnit ani nenadsazovat.
