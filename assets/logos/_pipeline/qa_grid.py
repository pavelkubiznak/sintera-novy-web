#!/usr/bin/env python3
"""Quick visual-QA grid: each logo shown as
 [original on dark] [original on cream] [mono-light on dark] [mono-dark on cream]."""
import sys, json
from PIL import Image, ImageDraw

DARK = (14, 18, 48); CREAM = (242, 239, 231)
results = json.load(open(sys.argv[1]))
out = sys.argv[2]
results = [r for r in results if "error" not in r]

cellw, cellh = 410, 170
labw = 150
cols = 4
rows = len(results)
W = labw + cols * cellw
H = rows * cellh
canvas = Image.new("RGB", (W, H), (30, 30, 36))
d = ImageDraw.Draw(canvas)

def paste(bg_color, img_path, x, y):
    tile = Image.new("RGBA", (cellw - 10, cellh - 10), bg_color + (255,))
    try:
        im = Image.open(img_path).convert("RGBA")  # already 400x160
        ox = (tile.size[0] - im.size[0]) // 2
        oy = (tile.size[1] - im.size[1]) // 2
        tile.alpha_composite(im, (ox, oy))
    except Exception as e:
        ImageDraw.Draw(tile).text((10, 10), f"ERR {e}", fill=(255, 80, 80))
    canvas.paste(tile.convert("RGB"), (x + 5, y + 5))

for i, r in enumerate(results):
    y = i * cellh
    d.text((8, y + cellh // 2 - 20), r["slug"], fill=(240, 240, 240))
    d.text((8, y + cellh // 2 + 0), f"{r.get('class','')}", fill=(150, 150, 160))
    d.text((8, y + cellh // 2 + 16), f"{r.get('placed','')}", fill=(150, 150, 160))
    x = labw
    paste(DARK,  r.get("png", ""),        x + 0 * cellw, y)
    paste(CREAM, r.get("png", ""),        x + 1 * cellw, y)
    paste(DARK,  r.get("mono_light", ""), x + 2 * cellw, y)
    paste(CREAM, r.get("mono_dark", ""),  x + 3 * cellw, y)

# column headers
for ci, t in enumerate(["original / dark", "original / cream", "mono-light / dark", "mono-dark / cream"]):
    d.text((labw + ci * cellw + 8, 2), t, fill=(255, 230, 120))
canvas.save(out)
print("saved", out, canvas.size)
