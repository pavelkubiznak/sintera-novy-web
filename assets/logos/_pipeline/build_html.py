#!/usr/bin/env python3
# Build contact sheet, logo-strip demo, and recommendation docs from site_data.json
import json, os, html, datetime

OUT = "/tmp/sintera_logos/out"
recs = json.load(open(f"{OUT}/metadata/site_data.json"))
by = {(r.get("slug") or r.get("_slug")): r for r in recs}
DATE = "2026-06-13"

CONF_COLOR = {"high":"#3fae7a","medium":"#d9a13a","low":"#cf5a52"}

def esc(s): return html.escape(s or "")

# ---------------- CONTACT SHEET ----------------
cards = []
for r in [x for x in recs if x.get("_set") == "premium"]:
    ml = "../" + r["_mono_light_png"]
    md = "../" + r["_mono_dark_png"]
    conf = r["confidence_score"]; cc = CONF_COLOR.get(conf, "#888")
    review = r["needs_manual_review"] == "yes"
    homepage = r["recommended_for_homepage"] == "yes"
    badges = [f'<span class="badge" style="background:{cc}1a;color:{cc};border-color:{cc}55">confidence: {esc(conf)}</span>']
    if review: badges.append('<span class="badge warn">⚠ ruční kontrola</span>')
    badges.append(f'<span class="badge tag">{esc(r["source_type"])}</span>')
    badges.append('<span class="badge home">★ homepage</span>' if homepage else '<span class="badge ref">jen reference</span>')
    note = r["_mono_kept_original"] and '<div class="kept">mono = originál (barevný odznak)</div>' or ''
    cards.append(f'''
    <article class="card">
      <div class="swatches">
        <div class="sw dark"><img src="{esc(ml)}" alt="{esc(r['client_display_name'])} mono-light"></div>
        <div class="sw cream"><img src="{esc(md)}" alt="{esc(r['client_display_name'])} mono-dark"></div>
      </div>
      <div class="meta">
        <div class="name">{esc(r['client_display_name'])}{note}</div>
        <div class="entity">{esc(r['legal_entity_name_if_known'])} · {esc(r['domain'])}</div>
        <div class="badges">{''.join(badges)}</div>
        <div class="src">{esc(r['permission_status'])} · <a href="{esc(r['logo_source_url'])}" target="_blank">zdroj</a></div>
      </div>
    </article>''')

contact = f'''<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sintera — kontrolní arch klientských log</title>
<style>
  :root{{--navy:#0e1230;--cream:#f2efe7}}
  *{{box-sizing:border-box}}
  body{{margin:0;background:#0b0d12;color:#e8e6df;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}}
  header{{padding:34px 40px 10px}}
  h1{{font-size:23px;margin:0 0 4px}}
  .sub{{color:#9a9aa6;font-size:13.5px;max-width:900px}}
  .legend{{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 4px}}
  .legend span{{font-size:12px;color:#b8b8c2;border:1px solid #2a2e3a;border-radius:20px;padding:3px 10px}}
  .grid{{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px 40px 48px}}
  .card{{background:#161a22;border:1px solid #232838;border-radius:14px;overflow:hidden}}
  .swatches{{display:grid;grid-template-columns:1fr 1fr}}
  .sw{{height:128px;display:flex;align-items:center;justify-content:center}}
  .sw.dark{{background:var(--navy)}}
  .sw.cream{{background:var(--cream)}}
  .sw img{{width:300px;height:120px;object-fit:contain}}
  .meta{{padding:14px 16px 16px}}
  .name{{font-weight:700;font-size:16.5px;display:flex;align-items:center;gap:10px}}
  .kept{{font-weight:500;font-size:11px;color:#d9a13a;border:1px solid #d9a13a55;border-radius:10px;padding:1px 7px}}
  .entity{{color:#9a9aa6;font-size:12.5px;margin:3px 0 9px}}
  .badges{{display:flex;gap:6px;flex-wrap:wrap}}
  .badge{{font-size:11px;border:1px solid #2a2e3a;border-radius:20px;padding:2px 9px;color:#c8c8d2;background:#10131a}}
  .badge.warn{{color:#d9a13a;border-color:#d9a13a66;background:#d9a13a14}}
  .badge.home{{color:#7fb8ff;border-color:#7fb8ff55;background:#7fb8ff12}}
  .badge.ref{{color:#9a9aa6}}
  .badge.tag{{color:#8fd0a8}}
  .src{{margin-top:10px;font-size:12px;color:#7d7d8a}}
  .src a{{color:#7fb8ff;text-decoration:none}}
</style></head><body>
<header>
  <h1>Sintera Czech — kontrolní arch klientských log</h1>
  <div class="sub">Každé logo na tmavém pozadí <b>#0e1230</b> (mono-light) a krémovém <b>#f2efe7</b> (mono-dark), v reálné velikosti pro web. {DATE} · 14 prémiových klientů. <b>Souhlas s referencí je smluvně ošetřen</b> (rámcová smlouva SINTERA, klauzule o umístění loga referenčního zákazníka) → <code>public_reference_confirmed</code>. Ověřuj už jen <b>správnost loga</b> u označených ⚠.</div>
  <div class="legend">
    <span style="color:{CONF_COLOR['high']}">● high confidence</span>
    <span style="color:{CONF_COLOR['medium']}">● medium</span>
    <span style="color:{CONF_COLOR['low']}">● low</span>
    <span style="color:#d9a13a">⚠ vyžaduje ruční kontrolu</span>
    <span style="color:#7fb8ff">★ doporučeno na homepage</span>
  </div>
</header>
<div class="grid">{''.join(cards)}</div>
</body></html>'''

os.makedirs(f"{OUT}/contact-sheet", exist_ok=True)
open(f"{OUT}/contact-sheet/client-logos.html","w",encoding="utf-8").write(contact)

# ---------------- LOGO STRIP DEMO ----------------
HOMEPAGE_ORDER = ["nestle","siemens-energy","panasonic","zf","safran-cabin","alstom",
                  "vitesco","edwards","aisan","linet","secheron-hasler","winning-group"]
items = "".join(
    f'<li><img src="../{by[s]["_mono_light_png"]}" alt="{esc(by[s]["client_display_name"])}" loading="lazy"></li>'
    for s in HOMEPAGE_ORDER)
strip = f'''<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sintera — logo strip (demo)</title>
<style>
  *{{box-sizing:border-box}}
  body{{margin:0;background:#0e1230;color:#cfd2e6;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}}
  .page{{max-width:1200px;margin:0 auto;padding:64px 24px}}
  .kicker{{text-align:center;letter-spacing:.16em;text-transform:uppercase;font-size:12px;color:#8a90b8;margin:0 0 30px}}

  /* --- desktop: very slow marquee --- */
  .strip{{position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}}
  .track{{display:flex;width:max-content;animation:scroll 60s linear infinite}}
  .strip:hover .track{{animation-play-state:paused}}
  .track ul{{display:flex;align-items:center;gap:54px;margin:0;padding:0 27px;list-style:none}}
  .track img{{height:34px;width:auto;max-width:170px;opacity:.78;transition:opacity .25s ease;display:block}}
  .track li:hover img{{opacity:1}}
  @keyframes scroll{{from{{transform:translateX(0)}}to{{transform:translateX(-50%)}}}}
  @media (prefers-reduced-motion: reduce){{.track{{animation:none}}}}

  /* --- mobile: horizontal scroll, no animation --- */
  @media (max-width:640px){{
    .strip{{-webkit-mask-image:none;mask-image:none}}
    .track{{width:auto;animation:none;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}}
    .track .dup{{display:none}}
    .track ul{{gap:36px;padding:4px 20px}}
    .track img{{height:30px}}
  }}
</style></head><body>
<div class="page">
  <p class="kicker">Vybíráme talenty pro nejlepší firmy</p>
  <div class="strip">
    <div class="track">
      <ul>{items}</ul>
      <ul class="dup" aria-hidden="true">{items}</ul>
    </div>
  </div>
</div>
</body></html>'''
open(f"{OUT}/contact-sheet/logo-strip-demo.html","w",encoding="utf-8").write(strip)
print("contact sheet + strip demo written")
