#!/usr/bin/env python3
# Inventory + dedupe internal Sintera client logos -> one best source file per client.
import os, glob, json, unicodedata, re
from PIL import Image

SRC = "/Users/pavelkubiznak/Library/CloudStorage/GoogleDrive-pavel.kubiznak@gmail.com/Můj disk/SINTERA"
FOLDERS = [
    f"{SRC}/PR SINTERA/Loga klientů",
    f"{SRC}/PR SINTERA/Loga klientů/loga navíc do refernčního listu",
    f"{SRC}/PR SINTERA/nový web/DK lab/Loga klientů - jpg",
]
# the 14 already done with curated/vector sources -> skip these slugs from internal pass
DONE = {"siemens-energy","panasonic","zf","nestle","safran-cabin","vitesco","secheron-hasler",
        "winning-group","alstom","linet","edwards","aisan","sitel","vuz",
        # internal aliases that map to the done set:
        "safran","zodiac-aerospace","secheron","nestle-cesko"}

def deaccent(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

def slugify(fname):
    s = os.path.splitext(fname)[0]
    s = deaccent(s).lower()
    s = s.replace("_", " ").replace("-", " ")
    # drop version/qualifier tokens
    s = re.sub(r"\b(new|nove|nova|novy|nový|nové|kopie|copy|logo|group1|1|2|3|final|ořez|orez)\b", " ", s)
    s = re.sub(r"\(.*?\)", " ", s)         # (zodiac), (cz)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s

EXT_SCORE = {".svg":5, ".png":4, ".gif":2, ".jpeg":1, ".jpg":1, ".JPG":1}

def probe(path):
    try:
        im = Image.open(path)
        w, h = im.size
        mode = im.mode
        rgba = im.convert("RGBA")
        alpha = rgba.getchannel("A")
        amin = alpha.getextrema()[0]
        transparent = amin < 250
        # corner whiteness (are 4 corners ~white?) on the composited-over-white image
        bg = Image.new("RGBA", rgba.size, (255,255,255,255)); bg.alpha_composite(rgba); flat = bg.convert("RGB")
        cs = [flat.getpixel((1,1)), flat.getpixel((w-2,1)), flat.getpixel((1,h-2)), flat.getpixel((w-2,h-2))]
        white_corners = sum(1 for c in cs if min(c) > 238) >= 3
        return {"w":w,"h":h,"mode":mode,"transparent":transparent,"white_corners":white_corners,
                "px":w*h}
    except Exception as e:
        return {"error":str(e)}

# collect files per slug
groups = {}
for folder in FOLDERS:
    for path in glob.glob(folder + "/*"):
        if os.path.isdir(path): continue
        ext = os.path.splitext(path)[1].lower()
        if ext not in (".svg",".png",".jpg",".jpeg",".gif"): continue
        slug = slugify(os.path.basename(path))
        if not slug: continue
        groups.setdefault(slug, []).append(path)

def best(paths):
    scored = []
    for p in paths:
        ext = os.path.splitext(p)[1].lower()
        pr = probe(p)
        if "error" in pr: continue
        score = EXT_SCORE.get(ext,0)*10_000_000 + (5_000_000 if pr["transparent"] else 0) + pr["px"]
        scored.append((score, p, pr))
    if not scored: return None
    scored.sort(reverse=True)
    return scored[0]

inv = []
for slug, paths in sorted(groups.items()):
    b = best(paths)
    if not b: continue
    score, path, pr = b
    inv.append({"slug":slug, "file":path, "ext":os.path.splitext(path)[1].lower(),
                "variants":len(paths), **pr, "done":slug in DONE})

todo = [r for r in inv if not r["done"]]
print(f"unique client slugs: {len(inv)}  | already-done (skip): {sum(1 for r in inv if r['done'])}  | TO PROCESS: {len(todo)}")
print(f"  transparent source: {sum(1 for r in todo if r['transparent'])}")
print(f"  white-bg raster:    {sum(1 for r in todo if not r['transparent'] and r['white_corners'])}")
print(f"  colored-bg / other: {sum(1 for r in todo if not r['transparent'] and not r['white_corners'])}")
print(f"  low-res (<150px h): {sum(1 for r in todo if r['h']<150)}")
json.dump(inv, open("/tmp/sintera_logos/inventory.json","w"), ensure_ascii=False, indent=1)

print("\n=== colored-bg / problematic (need attention) ===")
for r in todo:
    if not r["transparent"] and not r["white_corners"]:
        print(f"  {r['slug']:24} {r['w']}x{r['h']} {r['mode']} {os.path.basename(r['file'])}")
