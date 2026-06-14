#!/usr/bin/env python3
import json, os, sys
from PIL import Image, ImageDraw
res = {r["slug"]: r for r in json.load(open("/tmp/sintera_logos/out/results_bulk.json")) if "error" not in r}
meta = json.load(open("/tmp/sintera_logos/bulk_meta.json"))
slugs = list(res.keys())
# order: flagged first
slugs.sort(key=lambda s: (not meta.get(s,{}).get("needs_review"), s))

part = sys.argv[1] if len(sys.argv)>1 else "all"
if part!="all":
    a,b = map(int, part.split(":")); slugs = slugs[a:b]

cols=4; cw=300; ch=92
rows=(len(slugs)+cols-1)//cols
canvas=Image.new("RGB",(cols*cw, rows*ch),(35,35,40))
d=ImageDraw.Draw(canvas)
for i,slug in enumerate(slugs):
    r,c=divmod(i,cols); x,y=c*cw,r*ch
    # split bg: left dark navy, right cream
    d.rectangle([x,y,x+cw//2,y+ch],fill=(14,18,48))
    d.rectangle([x+cw//2,y,x+cw,y+ch],fill=(242,239,231))
    png=res[slug].get("png","")
    if png and os.path.exists(png):
        im=Image.open(png).convert("RGBA"); im.thumbnail((cw-20,ch-20))
        canvas.paste(im,(x+(cw-im.size[0])//2,y+(ch-im.size[1])//2),im)
    flag = "⚠" if meta.get(slug,{}).get("needs_review") else ""
    col = (255,210,90) if flag else (170,170,180)
    d.text((x+3,y+2),f"{flag}{slug}",fill=col)
canvas.save(f"/tmp/sintera_logos/out/bulk_montage_{part.replace(':','_')}.png")
print("saved", f"bulk_montage_{part.replace(':','_')}.png", canvas.size, "n=",len(slugs))
