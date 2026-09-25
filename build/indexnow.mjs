#!/usr/bin/env node
/* IndexNow: ohlásí změněné stránky vyhledávačům (Bing, Seznam, Yandex, Naver…) hned po deployi.
   Proč: ChatGPT (a Copilot) vyhledávají přes index Bingu. Bez ohlášení Bing nové pozice najde
   až při dalším procházení (dny až týdny); takhle se o nich dozví během minut. Seznam je bonus pro ČR.
   Spouští ho .github/workflows/deploy.yml po commitu. Argument = git revize, od které se změny počítají.
   Klíč: soubor <KEY>.txt v kořeni webu (IndexNow si ho stáhne a ověří, že web patří nám).
   Nikdy neshodí deploy: při jakékoli chybě jen vypíše varování a skončí 0. */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEY = "fce9505d93a500aee9ce5717701f0bab";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "build", "config.json"), "utf8"));
const BASE = cfg.site.baseUrl.replace(/\/$/, "");
const HOST = new URL(BASE).host;

// soubor v repu → veřejná URL (jen to, co má smysl indexovat)
function toUrl(f) {
  if (f === "index.html") return BASE + "/";
  if (f === "llms.txt") return BASE + "/llms.txt";
  if (/^(pozice|faq|reference-info|ochrana-osobnich-udaju)\/index\.html$/.test(f)) return BASE + "/" + f.replace(/index\.html$/, "");
  if (/^pozice\/\d+\.html$/.test(f)) return BASE + "/" + f;   // i smazané (uzavřené pozice): IndexNow tím hlásí 404
  return null;
}

try {
  const since = process.argv[2] || "HEAD~1";
  const files = execSync(`git diff --name-only ${since} HEAD`, { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const urlList = [...new Set(files.map(toUrl).filter(Boolean))];
  if (!urlList.length) { console.log("IndexNow: žádná změněná stránka, nic se neohlašuje."); process.exit(0); }
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList: urlList.slice(0, 10000) }),
  });
  console.log(`IndexNow: ${urlList.length} URL → HTTP ${res.status}`);   // 200/202 = přijato
  if (res.status >= 400) console.log("  ! " + (await res.text()).slice(0, 300));
} catch (e) {
  console.log("IndexNow: ! přeskočeno (" + e.message + ")");
}
