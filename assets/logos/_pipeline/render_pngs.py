#!/usr/bin/env python3
import importlib.util, os
from PIL import Image
spec = importlib.util.spec_from_file_location("p","/tmp/sintera_logos/process.py")
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
OUT="/tmp/sintera_logos/out"

def render(html_path, out_png, w, h, slug):
    p.chrome_shot(os.path.abspath(html_path), out_png, (w,h), slug, wait=30)
    return Image.open(out_png).convert("RGB")

def trim_bottom(img, bg, pad=24):
    px = img.load(); W,H = img.size
    def is_bg_row(y):
        for x in range(0, W, 7):
            r,g,b = px[x,y][:3]
            if abs(r-bg[0])+abs(g-bg[1])+abs(b-bg[2]) > 24: return False
        return True
    last = H-1
    while last > 0 and is_bg_row(last): last -= 1
    return img.crop((0,0,W,min(H, last+pad)))

# contact sheet (tall) -> trim
cs = render(f"{OUT}/contact-sheet/client-logos.html", f"{OUT}/contact-sheet/_cs_raw.png", 1240, 2700, "contactsheet")
cs = trim_bottom(cs, (11,13,18))
cs.save(f"{OUT}/contact-sheet/client-logos.png")
print("contact sheet PNG:", cs.size)

# strip demo preview (for QA only)
st = render(f"{OUT}/contact-sheet/logo-strip-demo.html", f"{OUT}/contact-sheet/_strip_preview.png", 1200, 320, "stripdemo")
st.save(f"{OUT}/contact-sheet/_strip_preview.png")
print("strip preview:", st.size)
os.remove(f"{OUT}/contact-sheet/_cs_raw.png")
