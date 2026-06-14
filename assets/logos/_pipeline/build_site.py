#!/usr/bin/env python3
# Assemble final deliverables (CSV, contact sheet, strip demo, recommendations) from
# the verification (wf_results.json) + processing (out/results.json) data.
import json, csv, os, shutil, html

OUT = "/tmp/sintera_logos/out"
RAWSRC = "/tmp/sintera_logos/raw"
wf = {r["slug"]: r for r in json.load(open("/tmp/sintera_logos/wf_results.json"))}
pr = {r["slug"]: r for r in json.load(open(f"{OUT}/results.json")) if "error" not in r}

DISPLAY = {
 "siemens-energy":"Siemens Energy","panasonic":"Panasonic","zf":"ZF","nestle":"Nestlé",
 "safran-cabin":"Safran Cabin","vitesco":"Vitesco Technologies","secheron-hasler":"Sécheron Hasler",
 "winning-group":"Winning Group","alstom":"Alstom","linet":"LINET","edwards":"Edwards",
 "aisan":"Aisan Industry","sitel":"SITEL","vuz":"Výzkumný ústav železniční",
}
ORDER = ["siemens-energy","panasonic","zf","nestle","safran-cabin","alstom","vitesco",
         "edwards","aisan","linet","secheron-hasler","winning-group","sitel","vuz"]
HOMEPAGE = {"siemens-energy","panasonic","zf","nestle","safran-cabin","alstom","vitesco",
            "edwards","aisan","linet","secheron-hasler","winning-group"}
# the 6 already publicly named with a live testimonial on sintera.cz/reference.html
PUBLIC_NAMED = {"siemens-energy","panasonic","zf","safran-cabin","sitel","secheron-hasler"}

PROC_NOTE = {
 "nestle":"Použit čistý wordmark „Nestlé\" (bez ptačího hnízda) — vhodnější pro logo strip.",
 "vitesco":"Zdrojové SVG je monochromní (tmavě šedá #4a4944); barevná varianta je na tmavém pozadí nevýrazná — pro strip používej mono-light.",
 "secheron-hasler":"Zdroj = transparentní PNG (Wikimedia). Ověřit, zda se dnes nepoužívá novější značka „Sécheron Hasler Group\".",
 "linet":"Zdroj JPG s bílým pozadím — pozadí odstraněno (white-key). Ideálně doplnit oficiální vektor z linet.com.",
 "edwards":"Z oficiálního webu edwardsvacuum.com; odstraněn bílý podkladový obdélník z SVG. Edwards VACUUM (Atlas Copco), NE Edwards Lifesciences.",
 "sitel":"Barevný odznak (bílý text na modrém poli) — mono silueta by zničila detail; ponechána originální barva (mono = originál). Spíše na stránku Reference. SITEL spol. s r.o. (kabeláž/datová centra), NE call-centrum Sitel/Foundever.",
 "vuz":"Zdroj = bílé logo z patičky vuz.cz — barva funguje jen na tmavém pozadí; na světlé použij mono-dark. Ideálně získat plnobarevný vektor.",
 "zf":"Ověřit aktuálnost verze (verifikace upozornila na možnou starší variantu). Modrý roundel ZF; oficiální EPS je i v interních podkladech Sintery (ANALYTIKA/ZF Klášterec).",
 "winning-group":"Ověřit přesnou entitu (Winning Group a.s.) a oprávnění; logo z winninggroup.cz. „group\" má světlejší odstín (dvoubarevný wordmark).",
 "aisan":"Z oficiálního webu aisan-ind.co.jp; čistý wordmark „Aisan\". Entita Aisan Industry Czech s.r.o.",
}

def relpath(p):
    return p.split("/processed/")[-1] and "processed/" + p.split("/processed/")[-1] if "/processed/" in p else p

# ---- copy chosen raw files into out/raw ----
RAWEXT = {"siemens-energy":"svg","panasonic":"svg","zf":"svg","nestle":"svg","safran-cabin":"svg",
 "vitesco":"svg","secheron-hasler":"png","winning-group":"svg","alstom":"svg","linet":"jpg",
 "edwards":"svg","aisan":"svg","sitel":"png","vuz":"png"}
os.makedirs(f"{OUT}/raw", exist_ok=True)
for slug, ext in RAWEXT.items():
    src = f"{RAWSRC}/{slug}.{ext}"
    if os.path.exists(src):
        shutil.copy(src, f"{OUT}/raw/{slug}.{ext}")

# ---- build merged records ----
recs = []
for slug in ORDER:
    s = (wf.get(slug) or {}).get("source") or {}
    v = (wf.get(slug) or {}).get("verify") or {}
    p = pr.get(slug, {})
    def rel(x): return ("processed/" + x.split("/processed/")[-1]) if x and "/processed/" in x else ""
    svg_file = rel(p.get("svg",""))
    png_file = rel(p.get("png",""))
    webp_file = rel(p.get("webp",""))
    ml = rel(p.get("mono_light_svg","")) or rel(p.get("mono_light",""))
    md = rel(p.get("mono_dark_svg","")) or rel(p.get("mono_dark",""))
    raw_file = f"raw/{slug}.{RAWEXT[slug]}"
    notes = (s.get("brand_notes","") or "").strip()
    # shorten very long agent notes to first 2 sentences
    short = " ".join(notes.replace("\n"," ").split())
    if len(short) > 260: short = short[:257] + "…"
    pieces = [short]
    if slug in PROC_NOTE: pieces.append("ZPRACOVÁNÍ: " + PROC_NOTE[slug])
    if slug in PUBLIC_NAMED: pieces.append("Jméno + reference už zveřejněny na sintera.cz/reference.html (ale to není souhlas s užitím loga).")
    brand_notes = " | ".join(x for x in pieces if x)
    rec = {
        "slug": slug,
        "client_display_name": DISPLAY[slug],
        "legal_entity_name_if_known": s.get("legal_entity",""),
        "domain": s.get("domain",""),
        "logo_source_url": s.get("source_url",""),
        "source_type": s.get("source_type",""),
        "original_file": raw_file,
        "svg_file": svg_file,
        "png_file": png_file,
        "webp_file": webp_file,
        "mono_light_file": ml,
        "mono_dark_file": md,
        "confidence_score": v.get("final_confidence", s.get("confidence","")),
        "permission_status": s.get("permission_status","needs_client_approval"),
        "brand_notes": brand_notes,
        "needs_manual_review": "yes" if v.get("final_needs_manual_review") else "no",
        "recommended_for_homepage": "yes" if slug in HOMEPAGE else "no",
        "recommended_for_reference_page": "yes",
        # extra (not in CSV) for HTML build
        "_mono_light_png": rel(p.get("mono_light","")),
        "_mono_dark_png": rel(p.get("mono_dark","")),
        "_png": png_file,
        "_mono_kept_original": p.get("mono_kept_original", False),
    }
    recs.append(rec)

# ---- CSV ----
COLS = ["client_display_name","legal_entity_name_if_known","domain","logo_source_url","source_type",
        "original_file","svg_file","png_file","webp_file","mono_light_file","mono_dark_file",
        "confidence_score","permission_status","brand_notes","needs_manual_review",
        "recommended_for_homepage","recommended_for_reference_page"]
os.makedirs(f"{OUT}/metadata", exist_ok=True)
with open(f"{OUT}/metadata/client-logos.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
    w.writeheader()
    for r in recs: w.writerow(r)

json.dump(recs, open(f"{OUT}/metadata/site_data.json","w"), ensure_ascii=False, indent=2)
print(f"CSV + site_data written ({len(recs)} rows)")
