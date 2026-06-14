#!/usr/bin/env python3
import json, os, csv, glob
from PIL import Image
OUT="/tmp/sintera_logos/out"; WEB=f"{OUT}/web"
recs=json.load(open(f"{OUT}/metadata/site_data.json"))
up={r["slug"]:r for r in json.load(open("/tmp/sintera_logos/up_results.json"))}
webr={r["slug"]:r for r in json.load(open(f"{OUT}/web_results.json"))}
PREMIUM={"siemens-energy","panasonic","zf","nestle","safran-cabin","vitesco","secheron-hasler",
         "winning-group","alstom","linet","edwards","aisan","sitel","vuz"}

def slug_of(r):
    of=r.get("original_file","")
    if of.startswith("raw/"): return os.path.splitext(os.path.basename(of))[0]
    return r.get("slug","")

# generate web webp from web png
for png in glob.glob(f"{WEB}/*.png"):
    wp=png[:-4]+".webp"
    try: Image.open(png).convert("RGBA").save(wp,"WEBP",lossless=True,quality=100,method=6)
    except Exception as e: print("webp fail",png,e)

def short(s,n=300):
    s=" ".join((s or "").split()); return s[:n-1]+"…" if len(s)>n else s

for r in recs:
    slug=slug_of(r); r["_slug"]=slug
    has_svg=os.path.exists(f"{WEB}/{slug}.svg")
    has_png=os.path.exists(f"{WEB}/{slug}.png")
    if has_svg: r["svg_file"]=f"web/{slug}.svg"
    if has_png:
        r["png_file"]=f"web/{slug}.png"; r["webp_file"]=f"web/{slug}.webp"
    u=up.get(slug)
    if slug in PREMIUM:
        # premium kept its verified metadata; if a retry upgraded it (secheron/linet/sitel/vuz), refresh source
        if u and u["status"]!="none" and slug in ("secheron-hasler","linet","sitel","vuz"):
            r["source_type"]=u["source_type"]; r["logo_source_url"]=u["source_url"]
            r["brand_notes"]=short(("UPGRADE web: "+(u.get("notes","")))+" | "+r.get("brand_notes",""))
        continue
    # internal set
    if u and u["status"]!="none":
        r["source_type"]=u["source_type"]; r["logo_source_url"]=u["source_url"]
        r["confidence_score"]=u["confidence"]
        bm=u.get("brand_match","yes")
        note=f"Web zdroj ({u['status']}, shoda se vzorem: {bm}). "+short(u.get("notes",""),220)
        r["brand_notes"]=short(note)
        r["needs_manual_review"]="yes" if bm in ("unsure","no") else r.get("needs_manual_review","no")
    else:
        # kept internal raster
        r["source_type"]="other_public_source"
        base=r.get("brand_notes","")
        r["brand_notes"]=short("Čistý veřejný zdroj nenalezen — použit interní rastr Sintery (doporučeno vyžádat vektor/transparentní PNG od klienta). "+base)
        r["needs_manual_review"]="yes"

COLS=["client_display_name","legal_entity_name_if_known","domain","logo_source_url","source_type",
      "original_file","svg_file","png_file","webp_file","mono_light_file","mono_dark_file",
      "confidence_score","permission_status","brand_notes","needs_manual_review",
      "recommended_for_homepage","recommended_for_reference_page"]
with open(f"{OUT}/metadata/client-logos.csv","w",newline="",encoding="utf-8") as f:
    w=csv.DictWriter(f,fieldnames=COLS,extrasaction="ignore"); w.writeheader()
    for r in recs: w.writerow(r)
json.dump(recs, open(f"{OUT}/metadata/site_data.json","w"), ensure_ascii=False, indent=2)

n_svg=sum(1 for r in recs if r["svg_file"])
print(f"rows={len(recs)}  with SVG={n_svg}  with web PNG={sum(1 for r in recs if r['png_file'].startswith('web/'))}")
print("source_type:", {t:sum(1 for r in recs if r['source_type']==t) for t in set(r['source_type'] for r in recs)})
print("needs_review=yes:", sum(1 for r in recs if r['needs_manual_review']=='yes'))
