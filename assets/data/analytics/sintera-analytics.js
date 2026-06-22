/* Sintera · first-party měření návštěvnosti (cookieless).
 * Vlož do <head> všech stránek jako <script>...</script> (inline je nejjednodušší).
 * Posílá pageview a akce (klik na e-mail/telefon, odeslání formuláře) do Apps Scriptu,
 * který je loguje do listu "navstevy". Neukládá cookies, IP ani identifikátory.
 */
(function () {
  var EP = 'https://script.google.com/macros/s/AKfycbyoSQr6qvQhGBTQo9LohaiUf5ph1zc4T9z9c3uXcYEudgOu85Yg-gJzhw6tCu1D2pZY/exec';
  function send(t, name) {
    try {
      var data = JSON.stringify({
        action: 'hit', t: t, path: location.pathname, ref: document.referrer, name: name || ''
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(EP, new Blob([data], { type: 'text/plain;charset=UTF-8' }));
      } else {
        fetch(EP, { method: 'POST', body: data, keepalive: true, mode: 'no-cors' });
      }
    } catch (e) {}
  }
  send('pageview');
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = (a.getAttribute('href') || '').toLowerCase();
    if (href.indexOf('mailto:') === 0) send('event', 'email-klik');
    else if (href.indexOf('tel:') === 0) send('event', 'telefon-klik');
  }, true);
  document.addEventListener('submit', function () { send('event', 'formular-odeslano'); }, true);
  window.sterk = function (name) { send('event', name); }; // ruční sledování akce
})();
