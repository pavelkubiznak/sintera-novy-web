#!/usr/bin/env python3
"""Sintera client-logo processing pipeline.
Reads a JSON manifest, emits normalized 400x160 variants:
 original PNG/WebP, mono-light, mono-dark (+ original/mono SVG when source is clean vector).
Optical sizing: height-normalized per shape-class with per-logo manual `scale`.
"""
import os, sys, json, re, subprocess, shutil, time, signal, xml.etree.ElementTree as ET
from PIL import Image

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CANVAS = (400, 160)
MONO_LIGHT = (242, 239, 231)   # #f2efe7
MONO_DARK  = (14, 18, 48)      # #0e1230
TMP = "/tmp/sintera_logos"

# shape-class boxes (max optical w,h) + base render height on the 160 canvas
CLASS = {
    "wide":   {"maxw":320, "maxh":70, "h":60},   # AR >= 4.5
    "normal": {"maxw":300, "maxh":80, "h":70},   # 2.2..4.5
    "compact":{"maxw":300, "maxh":80, "h":76},   # 1.6..2.2
    "square": {"maxw":180, "maxh":92, "h":84},   # AR < 1.6
}

def classify(ar):
    if ar >= 4.5: return "wide"
    if ar >= 2.2: return "normal"
    if ar >= 1.6: return "compact"
    return "square"

def chrome_shot(html_path, out_path, win, slug, wait=25):
    """Chrome writes the screenshot fast but hangs on exit when the user's Chrome
    is running. So: launch non-blocking, poll until the PNG is fully written, then
    SIGKILL only our own process group (never the user's Chrome)."""
    if os.path.exists(out_path):
        try: os.remove(out_path)
        except OSError: pass
    p = subprocess.Popen(
        [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         "--no-default-browser-check", f"--user-data-dir={TMP}/cr_{slug}",
         "--default-background-color=00000000", "--force-device-scale-factor=1",
         f"--window-size={win[0]},{win[1]}", f"--screenshot={out_path}", f"file://{html_path}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    t0 = time.time(); ok = False; last = -1
    while time.time() - t0 < wait:
        if os.path.exists(out_path):
            sz = os.path.getsize(out_path)
            if sz > 200 and sz == last:   # size stable -> fully written
                ok = True; break
            last = sz
        if p.poll() is not None:
            ok = os.path.exists(out_path) and os.path.getsize(out_path) > 200; break
        time.sleep(0.3)
    try: os.killpg(os.getpgid(p.pid), signal.SIGKILL)
    except Exception: pass
    if not ok:
        raise RuntimeError(f"chrome screenshot failed/timeout for {slug}")

def svg_rasterize(svg_path, slug, render_w=1600):
    abs_svg = os.path.abspath(svg_path)
    html = (f'<body style="margin:0;background:transparent">'
            f'<img src="file://{abs_svg}" style="width:{render_w}px;height:auto;display:block"></body>')
    hp = f"{TMP}/_r_{slug}.html"; op = f"{TMP}/_r_{slug}.png"
    open(hp, "w").write(html)
    chrome_shot(hp, op, (render_w + 40, render_w + 40), slug)
    return Image.open(op).convert("RGBA")

def white_key(im, thr_hi=250, thr_lo=232):
    """Make white background transparent (smooth ramp). Keeps original colors."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = max(r, g, b)            # whiteness proxy
            if lum >= thr_hi:
                na = 0
            elif lum <= thr_lo:
                na = a
            else:
                na = int(a * (thr_hi - lum) / (thr_hi - thr_lo))
            if na != a:
                px[x, y] = (r, g, b, na)
    return im

def trim(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

def is_opaque(im):
    if im.mode != "RGBA":
        return True
    a = im.getchannel("A")
    return a.getextrema()[0] >= 250   # min alpha ~255 -> no real transparency

def get_master(raw, fmt, slug, white_bg=False):
    if fmt == "svg":
        im = svg_rasterize(raw, slug)
    else:
        im = Image.open(raw).convert("RGBA")
    if fmt != "svg":
        if white_bg or is_opaque(im):
            im = white_key(im)
    return trim(im)

def make_mono(master, color):
    """Silhouette in `color` using master's alpha as the ink mask."""
    alpha = master.getchannel("A")
    solid = Image.new("RGBA", master.size, color + (0,))
    solid.putalpha(alpha)
    return solid

def fit_size(master, cls, scale, max_override=None):
    w, h = master.size
    ar = w / h
    c = CLASS[cls]
    target_h = c["h"] * scale
    target_w = target_h * ar
    maxw = c["maxw"]; maxh = c["maxh"]
    if target_w > maxw:
        target_w = maxw; target_h = maxw / ar
    if target_h > maxh:
        target_h = maxh; target_w = maxh * ar
    return max(1, round(target_w)), max(1, round(target_h))

def place(master, size, valign="center", dy=0):
    scaled = master.resize(size, Image.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    x = (CANVAS[0] - size[0]) // 2
    if valign == "center":
        y = (CANVAS[1] - size[1]) // 2
    elif valign == "top":
        y = 8
    else:
        y = CANVAS[1] - size[1] - 8
    canvas.alpha_composite(scaled, (x, y + dy))
    return canvas

# ---- SVG mono recolor (best-effort, validated by render compare) ----
def svg_recolor(svg_path, color_hex, out_path):
    """Recolor every paintable fill/stroke to color_hex, PRESERVING 'none'
    (so invisible bounding rects and outline-only shapes stay correct)."""
    try:
        data = open(svg_path, "r", encoding="utf-8", errors="ignore").read()
    except Exception:
        return False

    def is_none(v):
        return v.strip().lower() == "none"

    # 1) presentation attributes: fill="..", stroke="..", stop-color=".." (keep none)
    def repl_attr(m):
        name, q, val = m.group(1), m.group(2), m.group(3)
        return m.group(0) if is_none(val) else f'{name}={q}{color_hex}{q}'
    data = re.sub(r'\b(fill|stroke|stop-color)=(["\'])(.*?)\2', repl_attr, data)

    # 2) inline style="fill:..;stroke:.." and CSS inside <style>..</style> (keep none)
    def repl_decls(css):
        return re.sub(r'(fill|stroke|stop-color)\s*:\s*([^;}\"\']*)',
                      lambda mm: mm.group(0) if is_none(mm.group(2)) else f'{mm.group(1)}:{color_hex}',
                      css)
    data = re.sub(r'style=(["\'])(.*?)\1', lambda m: f'style={m.group(1)}{repl_decls(m.group(2))}{m.group(1)}', data)
    data = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda m: m.group(1) + repl_decls(m.group(2)) + m.group(3), data, flags=re.S)

    # 3) give root a default fill so elements WITHOUT any fill inherit the color (not black)
    data = re.sub(r'<svg\b', f'<svg fill="{color_hex}"', data, count=1, flags=re.I)

    open(out_path, "w", encoding="utf-8").write(data)
    return True

def alpha_iou(a, b):
    from PIL import ImageChops
    # downscale for speed; binarize alpha
    tw = 300
    def prep(im):
        s = im.getchannel("A")
        h = max(1, round(tw * s.size[1] / s.size[0]))
        s = s.resize((tw, h)).point(lambda p: 255 if p > 40 else 0).convert("1")
        return s
    A = prep(a); B = prep(b)
    inter = ImageChops.logical_and(A, B)
    union = ImageChops.logical_or(A, B)
    ic = sum(1 for p in inter.getdata() if p)
    uc = sum(1 for p in union.getdata() if p)
    return ic / uc if uc else 0.0

def normalize_svg_viewbox(src, dst):
    """Copy SVG ensuring it has a viewBox and no hard pixel width/height (so it scales)."""
    try:
        data = open(src, "r", encoding="utf-8", errors="ignore").read()
    except Exception:
        shutil.copy(src, dst); return
    def repl(m):
        tag = m.group(0)
        has_vb = re.search(r'viewBox\s*=', tag, re.I)
        wm = re.search(r'\bwidth\s*=\s*"([\d.]+)', tag)
        hm = re.search(r'\bheight\s*=\s*"([\d.]+)', tag)
        if not has_vb and wm and hm:
            tag = tag[:-1] + f' viewBox="0 0 {wm.group(1)} {hm.group(1)}">'
        return tag
    data = re.sub(r"<svg[^>]*>", repl, data, count=1, flags=re.I)
    open(dst, "w", encoding="utf-8").write(data)

def process(item, dirs):
    slug = item["slug"]; raw = item["raw"]; fmt = item["fmt"]
    scale = item.get("scale", 1.0); valign = item.get("valign", "center"); dy = item.get("dy", 0)
    white_bg = item.get("white_key", False)
    master = get_master(raw, fmt, slug, white_bg)
    w, h = master.size; ar = w / h
    cls = item.get("class") or classify(ar)
    size = fit_size(master, cls, scale)

    out = {"slug": slug, "class": cls, "ar": round(ar, 2), "placed": size, "master": master.size}

    # color original PNG + WebP
    color_canvas = place(master, size, valign, dy)
    png = f"{dirs['png']}/{slug}-400x160.png"
    webp = f"{dirs['webp']}/{slug}-400x160.webp"
    color_canvas.save(png)
    color_canvas.save(webp, "WEBP", lossless=True, quality=100, method=6)
    out["png"] = png; out["webp"] = webp

    # ink coverage (opaque fraction of the trimmed master) -> badge detection
    ahist = master.getchannel("A").histogram()
    coverage = sum(ahist[129:]) / float(master.size[0] * master.size[1] or 1)
    out["coverage"] = round(coverage, 3)
    mode = item.get("mono_mode", "silhouette")
    if mode == "auto":
        mode = "original" if coverage > 0.6 else "silhouette"   # solid/badge logos keep colour
    out["mono_resolved"] = mode

    # mono variants (PNG, always)
    ml_png = f"{dirs['mono_light']}/{slug}-mono-light.png"
    md_png = f"{dirs['mono_dark']}/{slug}-mono-dark.png"
    if mode == "original":
        # badge/colored logos where a flat silhouette would destroy detail:
        # keep the original colours (brief: "ponech originál a zapiš poznámku")
        color_canvas.save(ml_png)
        color_canvas.save(md_png)
        out["mono_kept_original"] = True
    else:
        ml = make_mono(master, MONO_LIGHT); md = make_mono(master, MONO_DARK)
        place(ml, size, valign, dy).save(ml_png)
        place(md, size, valign, dy).save(md_png)
        out["mono_kept_original"] = False
    out["mono_light"] = ml_png; out["mono_dark"] = md_png

    # SVG outputs when source is vector
    out["svg"] = ""; out["mono_light_svg"] = ""; out["mono_dark_svg"] = ""
    if fmt == "svg":
        svg_out = f"{dirs['svg']}/{slug}.svg"
        normalize_svg_viewbox(raw, svg_out); out["svg"] = svg_out
        # recolor mono SVGs directly (fast; validated visually in contact sheet)
        for color, key, dstdir, suff in [("#f2efe7", "mono_light_svg", dirs['mono_light'], "mono-light"),
                                          ("#0e1230", "mono_dark_svg", dirs['mono_dark'], "mono-dark")]:
            final = f"{dstdir}/{slug}-{suff}.svg"
            if svg_recolor(svg_out, color, final):
                out[key] = final
    return out

def main():
    manifest = json.load(open(sys.argv[1]))
    base = sys.argv[2]
    dirs = {
        "svg": f"{base}/processed/svg", "png": f"{base}/processed/png",
        "webp": f"{base}/processed/webp", "mono_light": f"{base}/processed/mono-light",
        "mono_dark": f"{base}/processed/mono-dark", "raw": f"{base}/raw",
    }
    results = []
    for item in manifest:
        try:
            r = process(item, dirs)
            print(f"OK  {item['slug']:20} class={r['class']:7} ar={r['ar']:<5} placed={r['placed']} svg={'Y' if r['svg'] else '-'} monoSVG={'Y' if r['mono_light_svg'] else '-'}")
            results.append(r)
        except Exception as e:
            print(f"ERR {item['slug']:20} {e}")
            results.append({"slug": item["slug"], "error": str(e)})
    json.dump(results, open(sys.argv[3], "w"), indent=2)

if __name__ == "__main__":
    main()
