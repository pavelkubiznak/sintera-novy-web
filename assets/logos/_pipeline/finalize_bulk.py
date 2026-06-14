#!/usr/bin/env python3
import json, os, glob, csv
OUT="/tmp/sintera_logos/out"
REMOVE={"cotinental","mangna","mub","vitesco-technologies","vitesco-technologies2","zf1","zf2"}

res=[r for r in json.load(open(f"{OUT}/results_bulk.json")) if "error" not in r]
meta=json.load(open("/tmp/sintera_logos/bulk_meta.json"))

# delete dup outputs
for slug in REMOVE:
    for pat in [f"{OUT}/processed/png/{slug}-*", f"{OUT}/processed/webp/{slug}-*",
                f"{OUT}/processed/mono-light/{slug}-*", f"{OUT}/processed/mono-dark/{slug}-*",
                f"{OUT}/processed/svg/{slug}.svg", f"{OUT}/raw/{slug}.*"]:
        for f in glob.glob(pat):
            try: os.remove(f)
            except OSError: pass
res=[r for r in res if r["slug"] not in REMOVE]
json.dump(res, open(f"{OUT}/results_bulk.json","w"), ensure_ascii=False, indent=1)

def rel(p): return ("processed/"+p.split("/processed/")[-1]) if p and "/processed/" in p else ""
def rawrel(slug):
    g=glob.glob(f"{OUT}/raw/{slug}.*")
    return "raw/"+os.path.basename(g[0]) if g else ""

internal=[]
for r in res:
    slug=r["slug"]; m=meta.get(slug,{})
    badge = r.get("mono_resolved")=="original"
    notes=["Interní logo Sintery (rastr); název odvozen z názvu souboru — ověřit."]
    if m.get("reasons"): notes += m["reasons"]
    if badge: notes.append("mono ponecháno v barvě (plné/odznakové logo)")
    rec={
        "client_display_name": m.get("display",slug),
        "legal_entity_name_if_known": "",
        "domain": "",
        "logo_source_url": f"(interní) PR SINTERA/Loga klientů/{m.get('source_file','')}",
        "source_type": "other_public_source",
        "original_file": rawrel(slug),
        "svg_file": rel(r.get("svg","")),
        "png_file": rel(r.get("png","")),
        "webp_file": rel(r.get("webp","")),
        "mono_light_file": rel(r.get("mono_light_svg","")) or rel(r.get("mono_light","")),
        "mono_dark_file": rel(r.get("mono_dark_svg","")) or rel(r.get("mono_dark","")),
        "confidence_score": m.get("confidence","low"),
        "permission_status": "needs_client_approval",
        "brand_notes": " | ".join(notes),
        "needs_manual_review": "yes" if m.get("needs_review") else "no",
        "recommended_for_homepage": "no",
        "recommended_for_reference_page": "yes",
        "_set":"internal",
    }
    internal.append(rec)

internal.sort(key=lambda r: r["client_display_name"].lower())

# premium 14
prem=json.load(open(f"{OUT}/metadata/site_data.json"))
for p in prem: p["_set"]="premium"

COLS=["client_display_name","legal_entity_name_if_known","domain","logo_source_url","source_type",
      "original_file","svg_file","png_file","webp_file","mono_light_file","mono_dark_file",
      "confidence_score","permission_status","brand_notes","needs_manual_review",
      "recommended_for_homepage","recommended_for_reference_page"]
allrecs=prem+internal
with open(f"{OUT}/metadata/client-logos.csv","w",newline="",encoding="utf-8") as f:
    w=csv.DictWriter(f,fieldnames=COLS,extrasaction="ignore"); w.writeheader()
    for r in allrecs: w.writerow(r)
json.dump(allrecs, open(f"{OUT}/metadata/site_data.json","w"), ensure_ascii=False, indent=2)

print(f"TOTAL clients in pack: {len(allrecs)}  (premium {len(prem)} + internal {len(internal)})")
print(f"needs_manual_review=yes: {sum(1 for r in allrecs if r['needs_manual_review']=='yes')}")
print(f"removed dups: {sorted(REMOVE)}")
