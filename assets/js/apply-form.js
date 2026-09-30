/* ============================================================
   SINTERA · formuláře, které se odesílají rovnou z webu (jeden zdroj pro celý web).
   1) „Reagovat na pozici" (data-action="application") · homepage, výpis /pozice/
      (staví ho app.js za běhu) i stránky pozice/<id>.html (v HTML z buildu).
   2) „Pošlete nám pozici" pro klienty (data-action="inquiry") · sekce Kontakt.
   Povinná pole nese samo HTML ([required] + data-msg s hláškou).

   Odesílá se rovnou z webu na Apps Script (akce "application"), ne přes
   poštovní program uchazeče: ten často chybí a reakce se dřív ztrácela.
   Když odeslání selže, otevře se e-mail s předvyplněnou reakcí jako záloha.

   Přílohy (životopis, klidně CZ + EN verze): jeden řádek s kancelářskou sponkou,
   vybrané soubory se v něm skládají jako štítky. Vkládá ho sem wire() jen do
   reakce na pozici, takže HTML z buildu i z formHTML zůstává beze změny.
   Soubory jdou v tom samém JSONu jako base64; server je uloží na neveřejný Disk.
   ============================================================ */
(function () {
  "use strict";

  var EN = document.documentElement.lang === "en";           // anglická verze /en/: hlášky formuláře anglicky
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbyoSQr6qvQhGBTQo9LohaiUf5ph1zc4T9z9c3uXcYEudgOu85Yg-gJzhw6tCu1D2pZY/exec";
  var GDPR_NOTE = "Odesláním reakce poskytujete své osobní údaje (jméno, kontaktní údaje a informace o sobě) správci Sintera Czech s.r.o., IČ 29130336, se sídlem Uhelná 160/24, Hradec Králové, za účelem vyřízení Vaší reakce a zprostředkování zaměstnání, včetně případného předání potenciálnímu zaměstnavateli v rámci náborového procesu. Zpracování probíhá v souladu se zákonem č. 110/2019 Sb. a nařízením (EU) 2016/679 (GDPR). Máte právo na přístup k údajům, jejich opravu nebo výmaz a kdykoli odvolat svůj souhlas; podrobnosti Vám poskytneme na vyžádání na info@sintera.cz.";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // p = { id, title, loc }. Stejné markup vyrábí i build pro stránky pozic (build/build.mjs).
  function formHTML(p) {
    var subj = "Reakce na pozici: " + p.title + (p.loc ? " (" + p.loc + ")" : "");
    return '<form class="apply-form" novalidate data-id="' + esc(p.id) + '" data-position="' + esc(p.title) + '" data-loc="' + esc(p.loc || "") + '" data-subject="' + esc(subj) + '">' +
      '<span class="af-title">Reagovat na pozici</span>' +
      '<input type="text" name="name" placeholder="Jméno a příjmení" autocomplete="name" aria-label="Jméno a příjmení" required data-msg="Napište prosím své jméno." />' +
      '<input type="text" name="contact" placeholder="E-mail nebo telefon" autocomplete="email" aria-label="E-mail nebo telefon" required data-msg="Napište prosím e-mail nebo telefon, ať se vám můžeme ozvat." />' +
      '<textarea name="note" placeholder="Pár vět o vás, nebo odkaz na profil." aria-label="Zpráva"></textarea>' +
      '<div class="af-hp" aria-hidden="true"><label>Web<input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>' +
      '<button type="submit" class="btn btn-primary">Odeslat reakci</button>' +
      '<p class="af-msg" role="status" aria-live="polite" hidden></p>' +
      '<span class="af-note">Reakce přijde přímo k nám do Sintery. Když uvedete e-mail, pošleme vám potvrzení.</span>' +
      '<span class="af-note af-gdpr">' + GDPR_NOTE + "</span>" +
      "</form>";
  }

  /* ---------- přílohy ---------- */
  var MAX_FILES = 5, MAX_FILE = 10 * 1024 * 1024, MAX_TOTAL = 15 * 1024 * 1024;
  var FILE_OK = /\.(pdf|docx?|odt|rtf|txt|jpe?g|png)$/i;               // stejný seznam hlídá server (Code.gs)
  var ACCEPT = ".pdf,.doc,.docx,.odt,.rtf,.txt,.jpg,.jpeg,.png";
  var CLIP = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false"><path d="M21 11.5l-8.6 8.6a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.5 3.5 0 0 1 4.9 4.9l-8.6 8.6a1.7 1.7 0 0 1-2.5-2.5l8-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function velikost(b) { return b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " kB" : (b / 1048576).toFixed(1).replace(".", ",") + " MB"; }
  function base64(file) {
    return new Promise(function (ok, fail) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).replace(/^data:[^,]*,/, "")); };
      r.onerror = function () { fail(r.error); };
      r.readAsDataURL(file);
    });
  }

  // Vloží řádek s přílohami před tlačítko; vrací { list(), clear() }. report(text) ukáže chybu ve formuláři.
  function attachFiles(form, report) {
    var box = document.createElement("div");
    box.className = "af-files";
    box.innerHTML =
      '<input type="file" multiple accept="' + ACCEPT + '" hidden />' +
      '<ul class="af-files__list"></ul>' +
      '<button type="button" class="af-files__add">' + CLIP + '<span>Přiložit životopis</span></button>' +
      '<span class="af-files__hint">PDF nebo Word · až 5 souborů</span>';
    form.insertBefore(box, form.querySelector(".af-hp") || form.querySelector('button[type="submit"]'));
    var input = box.querySelector("input"), ul = box.querySelector("ul"), add = box.querySelector(".af-files__add");
    var files = [];

    function render() {
      ul.innerHTML = files.map(function (f, i) {
        return '<li class="af-chip"><span class="af-chip__name" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
          '<span class="af-chip__size">' + velikost(f.size) + '</span>' +
          '<button type="button" class="af-chip__x" data-i="' + i + '" aria-label="Odebrat ' + esc(f.name) + '">&times;</button></li>';
      }).join("");
      box.classList.toggle("has-files", files.length > 0);
      add.hidden = files.length >= MAX_FILES;
      add.querySelector("span").textContent = files.length ? "Další" : "Přiložit životopis";
    }
    function pridej(list) {
      var chyba = "";
      Array.prototype.forEach.call(list || [], function (f) {
        var celkem = files.reduce(function (a, x) { return a + x.size; }, 0);
        if (files.length >= MAX_FILES) chyba = "Přiložit jde nejvýš 5 souborů.";
        else if (!FILE_OK.test(f.name)) chyba = "Soubor „" + f.name + "“ nejde přiložit. Pošlete prosím PDF, Word nebo obrázek.";
        else if (f.size > MAX_FILE) chyba = "Soubor „" + f.name + "“ je větší než 10 MB.";
        else if (celkem + f.size > MAX_TOTAL) chyba = "Přílohy dohromady můžou mít nejvýš 15 MB.";
        else if (!files.some(function (x) { return x.name === f.name && x.size === f.size; })) files.push(f);
      });
      render();
      report(chyba);                                            // prázdný text = schovat starou chybu
    }

    add.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () { pridej(input.files); input.value = ""; });
    ul.addEventListener("click", function (ev) {
      var x = ev.target.closest(".af-chip__x");
      if (!x) return;
      files.splice(Number(x.dataset.i), 1);
      render();
      add.focus();
    });
    ["dragenter", "dragover"].forEach(function (t) { box.addEventListener(t, function (ev) { ev.preventDefault(); box.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (t) { box.addEventListener(t, function (ev) { ev.preventDefault(); box.classList.remove("is-drag"); }); });
    box.addEventListener("drop", function (ev) { pridej(ev.dataTransfer && ev.dataTransfer.files); });

    render();
    return { list: function () { return files.slice(); }, clear: function () { files = []; render(); } };
  }

  function wire(form) {
    if (!form || form.dataset.wired === "1") return;          // ať se posluchač nenavěsí dvakrát
    form.dataset.wired = "1";
    var d = form.dataset;
    var msg = form.querySelector(".af-msg"), btn = form.querySelector('button[type="submit"]');
    if (!msg || !btn) return;
    var POLE = ["name", "contact", "note", "company"];

    function show(html, kind) { msg.innerHTML = html; msg.hidden = false; msg.className = "af-msg af-msg--" + kind; }
    // životopis jen u reakce na pozici (poptávka klienta ho nepotřebuje)
    var prilohy = (d.action || "application") === "application" ? attachFiles(form, function (t) { if (t) show(esc(t), "err"); else if (msg.className.indexOf("err") > -1) msg.hidden = true; }) : null;
    function mailtoFallback(data) {
      var body = (d.position ? "Pozice: " + d.position + (d.loc ? ", " + d.loc : "") + "\n" : "") +
        (data.company ? (EN ? "Company: " : "Firma: ") + data.company + "\n" : "") +
        (EN ? "Name: " : "Jméno: ") + (data.name || "") + (EN ? "\nContact: " : "\nKontakt: ") + (data.contact || "") + "\n\n" + (data.note || "") +
        (data.soubory ? "\n\n(Životopis prosím přiložte k tomuto e-mailu.)" : "");
      return "mailto:info@sintera.cz?subject=" + encodeURIComponent(d.subject || "Zpráva z webu") + "&body=" + encodeURIComponent(body);
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      var data = { action: d.action || "application", source: location.pathname, website: fd.get("website") || "", lang: EN ? "en" : "cs" };
      POLE.forEach(function (k) { if (fd.get(k) != null) data[k] = String(fd.get(k)).trim(); });
      if (data.action === "application") { data.id = d.id || ""; data.position = d.position || ""; data.loc = d.loc || ""; }

      var chybi = null;                                       // co je povinné, říká HTML ([required])
      form.querySelectorAll("[required]").forEach(function (el) { if (!chybi && !String(el.value || "").trim()) chybi = el; });
      if (chybi) { show(chybi.dataset.msg || (EN ? "Please fill in this field." : "Vyplňte prosím toto pole."), "err"); chybi.focus(); return; }

      btn.disabled = true;
      var original = btn.textContent;
      var soubory = prilohy ? prilohy.list() : [];
      data.soubory = soubory.length;
      btn.textContent = EN ? "Sending…" : (soubory.length ? "Nahrávám životopis…" : "Odesílám…");
      // Content-Type text/plain = "simple request" bez CORS preflightu (Apps Script ho neumí); tělo je JSON, server čte e.postData.contents.
      Promise.all(soubory.map(base64))
        .then(function (obsah) {
          if (obsah.length) data.files = soubory.map(function (f, i) { return { name: f.name, data: obsah[i] }; });
          return fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) });
        })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) {
            form.reset();
            if (prilohy) prilohy.clear();
            btn.textContent = EN ? "Sent" : "Odesláno";
            // reakce dorazila, ale přílohy ne (např. starší verze serveru): neztratit životopis potichu
            if (soubory.length && !(Number(res.prilohy) >= soubory.length)) {
              show('Vaše reakce k nám dorazila, jen se nepodařilo přenést životopis. Pošlete ho prosím na <a href="mailto:info@sintera.cz?subject=' +
                encodeURIComponent(d.subject || "Životopis") + '">info@sintera.cz</a>.', "err");
            } else {
              show(d.ok || (soubory.length ? "Děkujeme, vaše reakce i životopis k nám dorazily. Ozveme se vám." : "Děkujeme, vaše reakce k nám dorazila. Ozveme se vám."), "ok");
            }
          } else {
            throw new Error((res && res.error) || "send_failed");
          }
        })
        .catch(function () {
          // záložní cesta (výpadek sítě): otevřít e-mail s předvyplněným textem + odkaz v hlášce
          btn.disabled = false;
          btn.textContent = original;
          var mailto = mailtoFallback(data);
          show(EN
            ? 'Sending through the website failed. We have opened an email with your message filled in. If it did not open, write to us at <a href="' + esc(mailto) + '">info@sintera.cz</a>.'
            : 'Odeslání přes web se nepovedlo. Otevřeli jsme vám e-mail s předvyplněnou zprávou; kdyby se neotevřel, napište nám na <a href="' + esc(mailto) + '">info@sintera.cz</a>.', "err");
          window.location.href = mailto;
        });
    });
  }

  function wireAll(scope) { (scope || document).querySelectorAll("form.apply-form").forEach(wire); }

  window.SINTERA_APPLY = { formHTML: formHTML, wire: wire, wireAll: wireAll, GDPR_NOTE: GDPR_NOTE };

  // formuláře napevno v HTML (stránky pozic) se navěsí samy; app.js si po vykreslení volá wire()
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { wireAll(); });
  else wireAll();
})();
