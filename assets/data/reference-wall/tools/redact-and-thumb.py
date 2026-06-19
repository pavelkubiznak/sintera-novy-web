#!/usr/bin/env python3
"""
Sintera · příprava nové reference pro „Zeď referencí".

Z jednoho skenu (obrázek nebo stránka PDF) vyrobí:
  1) plný sken se ZAKRYTÝM telefonem u kontaktní osoby (pixelace + terakotový rámeček),
  2) rozostřený náhled do mřížky (osobní údaje nečitelné).

Telefon hledá v horní části listu (řádek „Kontaktní osoba"). Firemní/patičková čísla
nechává být (to jsou veřejná čísla). PO VYGENEROVÁNÍ SKEN VŽDY OČIMA ZKONTROLUJ
(OCR není stoprocentní) a teprve pak ho zveřejni.

Potřebuje: tesseract, imagemagick (convert), a u PDF i poppler-utils (pdftoppm).

Použití:
  python3 redact-and-thumb.py vstup.jpg --slug skoda
  python3 redact-and-thumb.py reference.pdf --page 12 --slug skoda
  (volitelně --outdir ../../  ... kořen, kam se uloží reference-wall/full a /thumbs)
"""
import argparse, csv, os, re, subprocess, sys, tempfile, glob

def render_pdf_page(pdf, page, tmp):
    out = os.path.join(tmp, "page")
    subprocess.run(["pdftoppm", "-png", "-r", "150", "-f", str(page), "-l", str(page), pdf, out],
                   stderr=subprocess.DEVNULL, check=False)
    c = glob.glob(out + "-*.png")
    if not c:
        sys.exit("Nepodařilo se vyrenderovat stránku PDF (je nainstalovaný poppler-utils?).")
    return c[0]

def redact_contact_phone(png, tmp):
    base = os.path.join(tmp, "ocr")
    subprocess.run(["tesseract", png, base, "tsv"], stderr=subprocess.DEVNULL, check=False)
    tsv = base + ".tsv"
    if not os.path.exists(tsv):
        return False
    ws = [r for r in csv.DictReader(open(tsv), delimiter="\t")
          if r.get("level") == "5" and r.get("text", "").strip()]
    if not ws:
        return False
    H = max(int(w["top"]) + int(w["height"]) for w in ws)
    lines = {}
    for w in ws:
        if int(w["top"]) > 0.62 * H:   # jen horní část = kontaktní oblast
            continue
        lines.setdefault((w["block_num"], w["par_num"], w["line_num"]), []).append(w)
    boxes = []
    for _, row in lines.items():
        txt = " ".join(w["text"] for w in row).lower()
        if ("420" in txt) or re.search(r"tel\.?\s*:?", txt) or re.search(r"\b\d{3}\s?\d{3}\s?\d{3}\b", txt):
            phs = [w for w in row if w["text"].lower().startswith("tel") or "420" in w["text"]
                   or re.match(r"^\+?\d{2,}$", w["text"].strip().strip(",."))]
            if phs:
                x0 = min(int(w["left"]) for w in phs) - 5; y0 = min(int(w["top"]) for w in phs) - 4
                x1 = max(int(w["left"]) + int(w["width"]) for w in phs) + 8
                y1 = max(int(w["top"]) + int(w["height"]) for w in phs) + 4
                boxes.append((x0, y0, x1, y1))
    if not boxes:
        return False
    args = ["convert", png]
    for (x0, y0, x1, y1) in boxes:
        w = x1 - x0; h = y1 - y0
        args += ["(", "-clone", "0", "-crop", "%dx%d+%d+%d" % (w, h, x0, y0), "+repage",
                 "-scale", "8%", "-scale", "1250%", ")", "-geometry", "+%d+%d" % (x0, y0), "-composite",
                 "-fill", "none", "-stroke", "#c8704f", "-strokewidth", "2",
                 "-draw", "rectangle %d,%d %d,%d" % (x0, y0, x1, y1)]
    args.append(png)
    subprocess.run(args, check=False)
    return True

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--slug", required=True, help="název souboru bez přípony, např. skoda")
    ap.add_argument("--page", type=int, help="číslo stránky (jen u PDF vstupu)")
    ap.add_argument("--outdir", default=".", help="kořen, kam patří složka reference-wall/")
    a = ap.parse_args()
    full_dir = os.path.join(a.outdir, "reference-wall", "full")
    thumb_dir = os.path.join(a.outdir, "reference-wall", "thumbs")
    os.makedirs(full_dir, exist_ok=True); os.makedirs(thumb_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        if a.input.lower().endswith(".pdf"):
            if not a.page:
                sys.exit("U PDF zadej --page.")
            png = render_pdf_page(a.input, a.page, tmp)
        else:
            png = os.path.join(tmp, "in.png")
            subprocess.run(["convert", a.input, png], check=False)
        red = redact_contact_phone(png, tmp)
        full_out = os.path.join(full_dir, "full-%s.jpg" % a.slug)
        thumb_out = os.path.join(thumb_dir, "wall-%s.jpg" % a.slug)
        subprocess.run(["convert", png, "-resize", "1000x", "-quality", "86", full_out], check=False)
        subprocess.run(["convert", png, "-resize", "180x", "-blur", "0x0.8", "-quality", "82", thumb_out], check=False)
    print("Hotovo:")
    print("  plný sken:", full_out, "(telefon u kontaktu " + ("zakryt" if red else "NENALEZEN – zkontroluj ručně") + ")")
    print("  náhled:   ", thumb_out)
    print("Pak doplň řádek do listu reference_zed v Sheetu (scan = full-%s.jpg) a spusť build." % a.slug)
    print("!!! Před zveřejněním sken VŽDY zkontroluj očima, OCR není stoprocentní. !!!")

if __name__ == "__main__":
    main()
