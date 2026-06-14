#!/usr/bin/env python3
import json, os, re, unicodedata, shutil
inv = json.load(open("/tmp/sintera_logos/inventory.json"))
todo = [r for r in inv if not r["done"]]

def display_name(path):
    s = os.path.splitext(os.path.basename(path))[0]
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[_]+", " ", s)
    s = re.sub(r"(?i)\b(new|nove|nová|nove|nový|nové|kopie|copy|logo|ořez|orez|final|group1)\b", "", s)
    s = re.sub(r"\s*-\s*new\b", "", s, flags=re.I)
    s = re.sub(r"\s{2,}", " ", s).strip(" -")
    # Title-case but keep existing uppercase acronyms
    out = []
    for w in s.split():
        out.append(w if (w.isupper() and len(w) <= 4) else (w[:1].upper() + w[1:]))
    return " ".join(out) or s

manifest = []; meta = {}
for r in todo:
    slug = r["slug"]; ext = r["ext"]
    fmt = "svg" if ext == ".svg" else "raster"
    transparent = r["transparent"]; white = r["white_corners"]; h = r["h"]
    white_key = (not transparent) and white and fmt != "svg"
    colored_bg = (not transparent) and (not white) and fmt != "svg"
    lowres = h < 120
    reasons = []
    if colored_bg: reasons.append("barevné/ne-bílé pozadí (nutný ruční ořez)")
    if lowres: reasons.append(f"nízké rozlišení ({r['w']}x{h})")
    conf = "medium" if ((transparent or white) and h >= 170) else "low"
    review = bool(colored_bg or lowres)
    manifest.append({"slug":slug, "display":display_name(r["file"]), "raw":r["file"],
                     "fmt":fmt, "white_key":white_key, "mono_mode":"auto"})
    meta[slug] = {"display":display_name(r["file"]), "source_file":os.path.basename(r["file"]),
                  "confidence":conf, "needs_review":review, "reasons":reasons,
                  "colored_bg":colored_bg, "lowres":lowres, "w":r["w"], "h":r["h"]}

json.dump(manifest, open("/tmp/sintera_logos/bulk_manifest.json","w"), ensure_ascii=False, indent=1)
json.dump(meta, open("/tmp/sintera_logos/bulk_meta.json","w"), ensure_ascii=False, indent=1)
# copy raws into out/raw
os.makedirs("/tmp/sintera_logos/out/raw", exist_ok=True)
for r in todo:
    ext = r["ext"]
    dst = f"/tmp/sintera_logos/out/raw/{r['slug']}{ext}"
    try: shutil.copy(r["file"], dst)
    except Exception as e: print("copy fail", r["slug"], e)
print(f"bulk manifest: {len(manifest)} items | white_key: {sum(1 for m in manifest if m['white_key'])} | colored_bg flagged: {sum(1 for s in meta if meta[s]['colored_bg'])} | lowres flagged: {sum(1 for s in meta if meta[s]['lowres'])}")
