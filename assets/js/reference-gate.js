/**
 * Sintera · odeslání formuláře „Získat reference".
 * Posílá na Apps Script web app a zobrazuje stavy.
 *
 * NASTAV: ENDPOINT = URL nasazeného Apps Scriptu (.../exec).
 *
 * Pozn. CORS: Apps Script nemá rád preflight. Posíláme proto jako "text/plain"
 * (tzv. simple request), tělo je stejně JSON. Server čte e.postData.contents.
 */
(function () {
  // TODO (Pavel): nastav na URL nasazeného Apps Scriptu (…/exec); viz README-reference-gate.md, krok A2.
  // Dokud je tu placeholder, formulář se neodešle (zobrazí chybovou hlášku); zbytek webu funguje normálně.
  var ENDPOINT = 'NASTAV_URL_APPS_SCRIPTU/exec'; // TODO: Apps Script web app /exec URL

  // Zrcadlo seznamu z free-domains.js (kvůli rychlé hlášce ještě před odesláním).
  var FREE_DOMAINS = [
    'seznam.cz','email.cz','post.cz','centrum.cz','atlas.cz','volny.cz','tiscali.cz','quick.cz',
    'chello.cz','iol.cz','sweb.cz','mybox.cz','raz-dva.cz','email.com',
    'azet.sk','zoznam.sk','post.sk','centrum.sk','pobox.sk','inmail.sk',
    'gmail.com','googlemail.com',
    'outlook.com','outlook.cz','hotmail.com','hotmail.cz','live.com','live.cz','msn.com',
    'yahoo.com','yahoo.co.uk','yahoo.cz','ymail.com','rocketmail.com',
    'icloud.com','me.com','mac.com',
    'proton.me','protonmail.com','pm.me',
    'gmx.com','gmx.net','gmx.de','mail.com','aol.com','zoho.com',
    'yandex.com','yandex.ru','web.de','freenet.de','fastmail.com','tutanota.com','tuta.io','hey.com'
  ];

  function domainOf(email) {
    var m = String(email || '').trim().toLowerCase().match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
    return m ? m[1] : '';
  }

  var form = document.getElementById('rg-form');
  if (!form) return;
  var msg = document.getElementById('rg-msg');
  var btn = document.getElementById('rg-submit');

  function show(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = 'rg__msg rg__msg--' + (kind || 'info');
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var data = {
      action: 'reference_request',
      email: form.email.value,
      phone: form.phone.value,
      name: form.name.value,
      position: form.position.value,
      website: form.website.value, // honeypot
      consent: form.consent.checked,
      source: location.pathname + location.search
    };

    var dom = domainOf(data.email);
    if (!dom) { show('Zadejte prosím platný e-mail.', 'err'); form.email.focus(); return; }
    if (!data.consent) { show('Potvrďte prosím souhlas se zpracováním údajů.', 'err'); return; }
    if (FREE_DOMAINS.indexOf(dom) !== -1) {
      show('Reference posíláme jen na firemní e-mail. Zadejte prosím adresu vaší společnosti.', 'err');
      form.email.focus();
      return;
    }

    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = 'Odesílám…';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          form.reset();
          show('Hotovo. Zkontrolujte prosím schránku ' + data.email + ', poslali jsme vám odkaz na reference.', 'ok');
        } else if (res && res.error === 'free_domain') {
          show('Reference posíláme jen na firemní e-mail. Zadejte prosím adresu vaší společnosti.', 'err');
        } else if (res && res.error === 'consent_required') {
          show('Potvrďte prosím souhlas se zpracováním údajů.', 'err');
        } else if (res && res.error === 'invalid_email') {
          show('Zadejte prosím platný e-mail.', 'err');
        } else {
          show('Něco se nepovedlo. Zkuste to prosím za chvíli znovu, nebo nám napište.', 'err');
        }
      })
      .catch(function () {
        show('Něco se nepovedlo. Zkuste to prosím za chvíli znovu, nebo nám napište.', 'err');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = original;
      });
  });
})();
