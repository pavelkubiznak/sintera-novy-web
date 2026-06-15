# Popisy pozic (text z sintera.cz) — pokyny

Texty jednotlivých pozic překlopené ze starého webu `sintera.cz/cz/pozice/<id>`.

## Soubory

- `pozice-popisy.json` — klíč = id pozice (stejné jako v `pozice-data.js`), hodnota `{ "descHtml": "…" }`.
  `descHtml` je čisté HTML: úvodní `<p>`, sekce `<h4>` (Co bude vaším úkolem / Koho hledáme /
  Co nabízíme apod.) a odrážky `<ul><li>`. Bez kontaktního formuláře a bez GDPR textu.
- `pozice-popisy.js` — totéž jako `window.POZICE_POPISY` (kdyby se popisy braly na klientovi).

## Stav

- Hotovo 9 pozic (ty z homepage): 830, 856, 862, 853, 805, 833, 795, 827, 832.
- Zbývá 67. Id: 822, 829, 834, 835, 836, 838, 839, 840, 843, 844, 846, 847, 848, 849, 852,
  855, 857, 858, 859, 861, 863, 803, 824, 787, 845, 814, 813, 798, 766, 790, 792, 793, 784,
  781, 777, 778, 776, 772, 764, 754, 744, 680, 736, 735, 694, 695, 723, 719, 670, 700, 691,
  688, 683, 634, 623, 620, 602, 603, 592, 574, 570, 571, 539, 540, 541, 465, 521.

## Jak doplnit zbylé (pro Claude Code)

Pro každé chybějící id:
1. Stáhni `https://sintera.cz/cz/pozice/<id>` (server-rendered, jde fetchnout přímo).
2. Vezmi obsah mezi nadpisem pozice (`<h2>` + řádek s krajem) a formulářem
   „Napište nám pro více informací". To je popis.
3. Vynech závěrečnou generickou větu „Pokud Vás tato pozice zaujala…" a celý formulář + GDPR.
4. Převeď na čisté HTML jako u hotových: úvodní odstavce `<p>`, tučné mezititulky → `<h4>`,
   odrážky → `<ul><li>`. Drž se původního textu (neměň smysl), nepoužívej dlouhou pomlčku „—".
5. Zapiš jako `"<id>": { "descHtml": "…" }` do `pozice-popisy.json` (a přegeneruj `pozice-popisy.js`).

(Pozn.: některé stránky občas vrátí prázdně, stačí zopakovat. Pár pozic je v angličtině,
např. 795, to je v pořádku, ponech jazyk originálu.)

## Jak zobrazit popis na webu

- **Detail pozice** `pozice/<id>.html`: na místo zástupného textu vlož `descHtml` daného id.
  Pokud detail generuje build, načti `pozice-popisy.json` a vlož HTML do popisové části.
- **Homepage rozbalení** (`app.js`, sekce pozic) a **stránka `/pozice/`**: nechávají odkaz
  na detail, takže není nutné měnit. Volitelně lze do rozbalení vložit úvodní odstavec z `descHtml`.
- Až poběží obsah z Google Sheets, popis může jít do sloupce `popis` listu `pozice`
  a build ho použije místo tohoto souboru.
