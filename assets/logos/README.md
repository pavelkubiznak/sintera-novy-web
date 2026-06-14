# Klientská loga — asset pack pro web Sintera

Jednotně zpracovaný balík log **131 klientů**. Připraveno pro logo strip na homepage a stránku Reference.

## 👉 Primární web asset = složka `web/`
Pro každého klienta:
- **`web/<slug>.svg`** — čistý vektor (má ho **73 ze 131** klientů). **Toto používej přednostně.**
- **`web/<slug>.png`** — transparentní PNG, **šířka ~800 px**, těsně oříznuté, bez rámečku (má **všech 131**). Záložní varianta + retina rezerva.
- **`web/<slug>.webp`** — totéž jako PNG, menší datově.

To přesně odpovídá doporučení „1 hlavní SVG + záložní PNG 800 px transparentní". Velikost 800 px pokryje referenční kartu, carousel i case-study na retině.

Odkud loga jsou (sloupec `source_type` v CSV): **34× Wikimedia, 40× oficiální web klienta, 57× interní podklad Sintery** (kde se čistý veřejný zdroj nenašel — u nich je `needs_manual_review = yes`, doporučeno vyžádat vektor od klienta). Přehled všech: `contact-sheet/all-logos-overview.png` (★ = homepage, ˢᵛᵍ = má vektor, ⚠ = ke kontrole).

Dvě úrovně kvality (sloupce `confidence_score` + `recommended_for_homepage`):
- **Prémiový set (14)** — adversariálně ověřené, pro **homepage logo strip**. Detail: `contact-sheet/client-logos.png`.
- **Zbytek (117)** — pro **stránku Reference**. 75 má nově čistý web zdroj (SVG/transparentní PNG), zbytek je interní rastr k doplnění.

## ✅ Souhlas s referencí (vyřešeno)
Souhlas s umístěním loga je **smluvně ošetřen** v rámcové smlouvě SINTERA: *„Zákazník souhlasí s eventuálním umístěním svého loga jako referenčního zákazníka pro účely webové a tištěné prezentace SINTERA CZECH s.r.o."* Proto je `permission_status` u všech `public_reference_confirmed`. Zbývá ověřit už jen **správnost loga** (`needs_manual_review`) — viz `metadata/manual-review.md`. Doporučení: u zobrazených klientů měj příslušnou rámcovou smlouvu po ruce; pokud by ji konkrétní klient s touto klauzulí neměl, z prezentace ho vynech.

## Struktura
```
web/      <slug>.svg / .png / .webp   ⭐ PRIMÁRNÍ web assety: SVG + transparentní PNG 800px + WebP
raw/                      originální stažené/interní zdroje + zdrojová URL v CSV
processed/                (sekundární — pro homepage logo strip)
  svg/                    barevný originál jako vektor (jen u vektorových zdrojů, 10×)
  png/    <slug>-400x160.png   normalizováno na canvas 400×160, transparentní, opticky vyvážené
  webp/   <slug>-400x160.webp  totéž jako WebP (lossless)
  mono-light/             jednobarevná #f2efe7 varianta pro TMAVÉ pozadí (SVG + PNG)
  mono-dark/              jednobarevná #0e1230 varianta pro SVĚTLÉ pozadí (SVG + PNG)
contact-sheet/
  client-logos.html       kontrolní arch (každé logo na tmavém i krémovém pozadí + metadata)
  client-logos.png        rendrovaná verze archu pro rychlé schválení
  logo-strip-demo.html    hotová ukázka homepage logo stripu (mono-light, pomalý marquee)
metadata/
  client-logos.csv        zdrojová pravda: entity, URL, soubory, confidence, permission, review
  homepage-logo-recommendation.md   doporučených 12 log + pořadí + priority
  manual-review.md        seznam položek k ruční kontrole
  site_data.json          strojově čitelná data (pro generování webu)
_pipeline/                skripty, kterými byl balík vytvořen (reprodukovatelnost)
```

## Jak použít ve webu
- **Referenční karta / carousel / case study:** použij `web/<slug>.svg`, a kde není, `web/<slug>.png` (800 px). To je ten univerzální asset dle doporučení.
- **Logo strip (homepage):** použij `processed/mono-light/<slug>-mono-light.png` na pozadí `#0e1230`. Hotová ukázka i CSS jsou v `contact-sheet/logo-strip-demo.html`. Výběr a pořadí v `metadata/homepage-logo-recommendation.md`.
- **Tmavá loga na tmavém pozadí:** světlá/inverzní varianta je `processed/mono-light/`.
- PNG/WebP v `processed/` jsou na canvasu **400×160** s optickým vyvážením (pro strip). Assety ve `web/` jsou těsně oříznuté v přirozeném poměru (pro volné použití).

## Velikosti / pravidla (dodrženo)
- Canvas 400×160, transparentní, logo centrované, bez deformace, bez ořezu, bez bílých obdélníků.
- Optické maximum dle tvaru loga (široké / běžné / čtvercové) — round emblémy (ZF, Safran) jsou záměrně menší, aby vizuálně „vážily" stejně.

## Pozn. ke speciálním případům
- **SITEL** = barevný odznak → mono varianty ponechány v barvě (silueta by zničila text). Vhodné na Reference, ne do mono stripu.
- **VUZ** = jen bílé logo z patičky → barva funguje na tmavém pozadí, na světlé použij mono-dark.
- **Vitesco** = monochromní zdroj (ne značková žlutá). **ZF, Vitesco, Sécheron** = ověřit aktuálnost verze (viz manual-review).
