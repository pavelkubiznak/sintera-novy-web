#!/usr/bin/env python3
"""Produce web-grade assets for ALL clients:
   web/<slug>.svg  (when a clean vector exists)
   web/<slug>.png  (transparent, ~800px wide, tight crop, no frame)  -- always
Source priority: sourced SVG > premium existing SVG > sourced transparent PNG > internal raster."""
import importlib.util, os, glob, json, shutil
spec = importlib.util.spec_from_file_location("p", "/tmp/sintera_logos/process.py")
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
from PIL import Image

OUT = "/tmp/sintera_logos/out"
UPRAW = "/tmp/sintera_logos/up_raw"
WEB = f"{OUT}/web"
os.makedirs(WEB, exist_ok=True)
TARGET_W = 800
MAX_H = 520

PREMIUM = ["siemens-energy","panasonic","zf","nestle","safran-cabin","vitesco","secheron-hasler",
           "winning-group","alstom","linet","edwards","aisan","sitel","vuz"]
internal_slugs = [r["slug"] for r in json.load(open(f"{OUT}/results_bulk.json")) if "error" not in r]
SLUGS = PREMIUM + internal_slugs

up = {}
upj = "/tmp/sintera_logos/up_results.json"
if os.path.exists(upj):
    for r in json.load(open(upj)): up[r["slug"]] = r

def tight_png_from_master(master, out_png):
    m = p.trim(master)
    w, h = m.size
    scale = TARGET_W / w
    if h * scale > MAX_H: scale = MAX_H / h
    nw, nh = max(1, round(w*scale)), max(1, round(h*scale))
    m = m.resize((nw, nh), Image.LANCZOS)
    m.save(out_png)
    return (nw, nh)

def from_svg(svg_path, slug, svg_out, png_out):
    shutil.copy(svg_path, svg_out)
    # render big, trim, scale to 800w
    master = p.svg_rasterize(svg_path, f"web_{slug}", render_w=1600)
    size = tight_png_from_master(master, png_out)
    return size

def from_raster(raw_path, slug, png_out, white_key=False):
    im = Image.open(raw_path).convert("RGBA")
    if white_key or p.is_opaque(im):
        im = p.white_key(im)
    return tight_png_from_master(im, png_out)

results = []
for slug in SLUGS:
    svg_out = f"{WEB}/{slug}.svg"; png_out = f"{WEB}/{slug}.png"
    rec = {"slug": slug, "svg": "", "png": "", "source": "", "src_w": 0}
    try:
        sourced_svg = f"{UPRAW}/{slug}.svg"
        sourced_png = f"{UPRAW}/{slug}.png"
        premium_svg = f"{OUT}/raw/{slug}.svg"
        if os.path.exists(sourced_svg):
            from_svg(sourced_svg, slug, svg_out, png_out); rec.update(source="sourced_svg", svg="Y")
        elif slug in PREMIUM and os.path.exists(premium_svg):
            from_svg(premium_svg, slug, svg_out, png_out); rec.update(source="premium_svg", svg="Y")
        elif os.path.exists(sourced_png):
            im = Image.open(sourced_png); rec["src_w"] = im.size[0]
            from_raster(sourced_png, slug, png_out); rec.update(source="sourced_png")
        else:
            # internal raster fallback
            g = glob.glob(f"{OUT}/raw/{slug}.*")
            g = [x for x in g if not x.endswith(".svg")] or g
            if not g:
                rec["source"] = "MISSING"; results.append(rec); print("MISS", slug); continue
            raw = g[0]; im = Image.open(raw); rec["src_w"] = im.size[0]
            from_raster(raw, slug, png_out); rec.update(source="internal")
        rec["svg"] = svg_out if os.path.exists(svg_out) else ""
        rec["png"] = png_out if os.path.exists(png_out) else ""
        # final png width
        if rec["png"]:
            rec["png_w"] = Image.open(rec["png"]).size[0]
        results.append(rec)
    except Exception as e:
        rec["source"] = f"ERR:{e}"; results.append(rec); print("ERR", slug, e)

json.dump(results, open(f"{OUT}/web_results.json", "w"), indent=1)
from collections import Counter
print("web assets built:", len(results))
print("by source:", dict(Counter(r["source"] for r in results)))
print("with SVG:", sum(1 for r in results if r["svg"]))
print("low-res png (<700w final or src<500):", sum(1 for r in results if r.get("png_w",0) < 700 or (0 < r.get("src_w",9999) < 500)))
