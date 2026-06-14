# Doporučení log pro homepage — Sintera Czech

_Vytvořeno 2026-06-13. Vstup: 14 prioritních klientů, ověřená a zpracovaná loga (viz `client-logos.csv` a kontrolní arch `contact-sheet/client-logos.png`)._

> **✅ Souhlas s referencí je smluvně ošetřen** — rámcová smlouva SINTERA obsahuje klauzuli: *„Zákazník souhlasí s eventuálním umístěním svého loga jako referenčního zákazníka pro účely webové a tištěné prezentace SINTERA CZECH s.r.o."* `permission_status` je proto u všech `public_reference_confirmed`. Ověřuj už jen **správnost loga** (`needs_manual_review`), ne souhlas. Pro pořádek měj příslušnou rámcovou smlouvu daného klienta po ruce.

## Doporučený výběr pro homepage logo strip (12 log)

Strip používá **mono-light** varianty na tmavém pozadí `#0e1230` (viz `logo-strip-demo.html`). Výběr je seřazený podle důvěryhodnosti značky, relevance a vizuální rovnováhy stripu.

### Tier 1 — kotvy důvěry (vždy zobrazit, 6)
| # | Klient | Confidence | Pozn. |
|---|--------|-----------|-------|
| 1 | **Nestlé** | high | globálně nejsilnější značka, čistý wordmark |
| 2 | **Siemens Energy** | high | marquee značka, aktuální dvoubarevný wordmark |
| 3 | **Panasonic** | high | marquee značka |
| 4 | **ZF** | medium | silná automotive značka (ověřit aktuálnost verze) |
| 5 | **Safran (Cabin)** | high | aktuální Safran branding (ne Zodiac) |
| 6 | **Alstom** | high | aktuální Alstom branding (ne Bombardier) |

### Tier 2 — doplnění do vyvážené řady (6)
| # | Klient | Confidence | Pozn. |
|---|--------|-----------|-------|
| 7 | **Vitesco Technologies** | medium | monochromní zdroj; ověřit aktuálnost (Schaeffler 2024) |
| 8 | **Edwards** | high | Edwards Vacuum (Atlas Copco) |
| 9 | **Aisan Industry** | high | čistý wordmark z oficiálního webu |
| 10 | **LINET** | medium | silná česká značka |
| 11 | **Sécheron Hasler** | medium | rail; ověřit „Sécheron Hasler Group" |
| 12 | **Winning Group** | high | česká značka (ověřit entitu + souhlas) |

**Doporučené pořadí ve stripu** (vizuální rovnováha — round emblémy proložené wordmarky):
`Nestlé · Siemens Energy · Panasonic · ZF · Safran · Alstom · Vitesco · Edwards · Aisan · LINET · Sécheron · Winning`

Pokud chceš jen **8 log** (klidnější strip), vezmi Tier 1 + Edwards + Aisan.

## Jen na stránku Reference (ne homepage strip)
| Klient | Důvod |
|--------|-------|
| **SITEL** | barevný odznak (bílý text na modrém poli) — monochromní silueta zničí čitelnost; funguje jen barevně. Pro strip nevhodné, na Reference výborné. |
| **Výzkumný ústav železniční (VUZ)** | nika; jediný zdroj je bílé logo z patičky webu — chybí plnobarevný/vektorový podklad. Vhodné na Reference (mono-dark na světlém). |

## Priority při finálním výběru (dle zadání)
1. **Důvěryhodnost značky** → Tier 1 jsou neoddiskutovatelné taháky.
2. **Relevance k referencím** → všech 12 jsou reální klienti s doloženou spoluprací.
3. **Správnost a kvalita loga** → 10/12 je čistý vektor; LINET a Sécheron jsou kvalitní rastr.
4. **Vizuální rovnováha** → doporučené pořadí střídá šířkové wordmarky a kompaktní emblémy (ZF, Safran swirl).
5. **Bezpečnost publikování** → souhlas je smluvně ošetřen (rámcová smlouva); stačí mít smlouvu daného klienta po ruce.

## Než půjde strip live — checklist
- [x] Souhlas s referencí — smluvně ošetřeno (rámcová smlouva SINTERA, klauzule o umístění loga referenčního zákazníka).
- [ ] Dořešit položky `needs_manual_review = yes` (viz `manual-review.md`) — týká se správnosti loga, ne souhlasu.
- [ ] Volitelně doplnit oficiální vektory pro LINET a Sécheron (teď kvalitní rastr).
- [ ] Ověřit aktuálnost verze loga u ZF a Vitesco.
