/* ============================================================
   SINTERA · formuláře, které se odesílají rovnou z webu (jeden zdroj pro celý web).
   1) „Reagovat na pozici" (data-action="application") · homepage, výpis /pozice/
      (staví ho app.js za běhu) i stránky pozice/<id>.html (v HTML z buildu).
   2) „Pošlete nám pozici" pro klienty (data-action="inquiry") · sekce Kontakt.
   Povinná pole nese samo HTML ([required] + data-msg s hláškou).

   Odesílá se rovnou z webu na Apps Script (akce "application"), ne přes
   poštovní program uchazeče: ten často chybí a reakce se dřív ztrácela.
   Když odeslání selže, otevře se e-mail s předvyplněnou reakcí jako záloha.
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
      '<textarea name="note" placeholder="Pár vět o vás, nebo odkaz na profil. CV doplníme později." aria-label="Zpráva"></textarea>' +
      '<div class="af-hp" aria-hidden="true"><label>Web<input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>' +
      '<button type="submit" class="btn btn-primary">Odeslat reakci</button>' +
      '<p class="af-msg" role="status" aria-live="polite" hidden></p>' +
      '<span class="af-note">Reakce přijde přímo k nám do Sintery. Když uvedete e-mail, pošleme vám potvrzení.</span>' +
      '<span class="af-note af-gdpr">' + GDPR_NOTE + "</span>" +
      "</form>";
  }

  function wire(form) {
    if (!form || form.dataset.wired === "1") return;          // ať se posluchač nenavěsí dvakrát
    form.dataset.wired = "1";
    var d = form.dataset;
    var msg = form.querySelector(".af-msg"), btn = form.querySelector('button[type="submit"]');
    if (!msg || !btn) return;
    var POLE = ["name", "contact", "note", "company"];

    function show(html, kind) { msg.innerHTML = html; msg.hidden = false; msg.className = "af-msg af-msg--" + kind; }
    function mailtoFallback(data) {
      var body = (d.position ? "Pozice: " + d.position + (d.loc ? ", " + d.loc : "") + "\n" : "") +
        (data.company ? (EN ? "Company: " : "Firma: ") + data.company + "\n" : "") +
        (EN ? "Name: " : "Jméno: ") + (data.name || "") + (EN ? "\nContact: " : "\nKontakt: ") + (data.contact || "") + "\n\n" + (data.note || "");
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
      btn.textContent = EN ? "Sending…" : "Odesílám…";
      // Content-Type text/plain = "simple request" bez CORS preflightu (Apps Script ho neumí); tělo je JSON, server čte e.postData.contents.
      fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) {
            form.reset();
            btn.textContent = EN ? "Sent" : "Odesláno";
            show(d.ok || "Děkujeme, vaše reakce k nám dorazila. Ozveme se vám.", "ok");
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
