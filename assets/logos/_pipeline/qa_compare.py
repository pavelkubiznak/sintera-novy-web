#!/usr/bin/env python3
import json, os, sys
from PIL import Image, ImageDraw
up = {r["slug"]: r for r in json.load(open("/tmp/sintera_logos/up_results.json"))}
clients = {c["slug"]: c for c in json.load(open("/tmp/sintera_logos/up_clients.json"))}
web = {r["slug"]: r for r in json.load(open("/tmp/sintera_logos/out/web_results.json"))}

# only sourced ones (status != none)
sourced = [s for s,r in up.items() if r["status"] != "none"]
# order: no, unsure, yes
rank = {"no":0,"unsure":1,"yes":2}
sourced.sort(key=lambda s: (rank.get(up[s]["brand_match"],3), s))

part = sys.argv[1] if len(sys.argv)>1 else "0:40"
a,b = map(int, part.split(":")); sourced = sourced[a:b]

cw=520; ch=120; cols=2
rows=(len(sourced)+cols-1)//cols
canvas=Image.new("RGB",(cols*cw, rows*ch),(245,245,245)); d=ImageDraw.Draw(canvas)
def put(img_path, x, y, w, h, bg):
    cell=Image.new("RGBA",(w,h),bg+(255,))
    if img_path and os.path.exists(img_path):
        try:
            im=Image.open(img_path).convert("RGBA")
            # composite over white if it has transparency for visibility
            base=Image.new("RGBA",im.size,(255,255,255,255)); base.alpha_composite(im); im=base
            im.thumbnail((w-12,h-12)); cell.paste(im.convert("RGB"),((w-im.size[0])//2,(h-im.size[1])//2))
        except Exception as e:
            ImageDraw.Draw(cell).text((6,6),f"ERR{e}",fill=(200,0,0))
    canvas.paste(cell.convert("RGB"),(x,y))

for i,slug in enumerate(sourced):
    r,c=divmod(i,cols); x=c*cw; y=r*ch
    bm=up[slug]["brand_match"]; col={"no":(200,0,0),"unsure":(200,130,0),"yes":(0,120,0)}[bm]
    internal=clients.get(slug,{}).get("internal","")
    neww=web.get(slug,{}).get("png","")
    d.rectangle([x,y,x+cw-2,y+ch-2],outline=col,width=2)
    d.text((x+4,y+2),f"{slug}  [{bm}]  {up[slug]['status']}",fill=col)
    # left: internal (ground truth), right: new web asset
    put(internal, x+4, y+18, (cw-12)//2, ch-24, (235,235,235))
    put(neww,     x+4+(cw-12)//2, y+18, (cw-12)//2, ch-24, (235,235,235))
    d.text((x+8,y+ch-14),"INTERNÍ (vzor)",fill=(120,120,120))
    d.text((x+8+(cw-12)//2,y+ch-14),"NOVÉ (web)",fill=(120,120,120))
canvas.save(f"/tmp/sintera_logos/out/cmp_{part.replace(':','_')}.png")
print("saved", part, "n=", len(sourced))
