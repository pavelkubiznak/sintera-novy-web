/**
 * Sintera · render „Zdi referencí".
 * Data: window.REFERENCE_WALL = [{firma,sektor,obor,role,kontakt,stitky[],thumb,full,full2}]
 *   (generuje build ze Sheetu / z assets/data/reference-wall.json).
 * Cesty k obrázkům: window.WALL_BASE (default '../../assets/reference-wall/').
 * HTML: <div id="rw-grid"></div> + spodní modal vloží skript sám.
 *
 * Telefon kontaktní osoby je na skenech už zakrytý (děje se mimo web, viz tools/).
 */
(function () {
  var DATA = window.REFERENCE_WALL || [];
  var BASE = window.WALL_BASE || '../../assets/reference-wall/';
  var grid = document.getElementById('rw-grid');
  var nEl = document.getElementById('rw-n'); if (nEl) nEl.textContent = DATA.length;
  if (!grid || !DATA.length) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // dlaždice
  grid.innerHTML = DATA.map(function (d, i) {
    return '<button class="rw__tile" data-i="' + i + '" aria-label="' + esc(d.firma) + '">' +
      '<span class="th"><img loading="lazy" src="' + BASE + esc(d.thumb) + '" alt=""></span>' +
      '<span class="cap"><b>' + esc(d.firma) + '</b><i>' + esc(d.sektor || '') + '</i></span>' +
    '</button>';
  }).join('');

  // modal
  var ov = document.createElement('div');
  ov.className = 'rw__ov'; ov.id = 'rw-ov';
  ov.innerHTML =
    '<button class="rw__x" id="rw-x" aria-label="Zavřít">×</button>' +
    '<div class="rw__card">' +
      '<div class="rw__scan" id="rw-scan"></div>' +
      '<div class="rw__cap2">' +
        '<p class="co" id="rw-co"></p><p class="sec" id="rw-sec"></p>' +
        '<p class="role" id="rw-role"></p><p class="who" id="rw-who"></p>' +
        '<div class="rw__tags" id="rw-tags"></div>' +
      '</div>' +
      '<p class="rw__hint">Telefon kontaktní osoby je u všech referencí skrytý.</p>' +
    '</div>';
  document.body.appendChild(ov);

  var elScan = ov.querySelector('#rw-scan'), elCo = ov.querySelector('#rw-co'),
      elSec = ov.querySelector('#rw-sec'), elRole = ov.querySelector('#rw-role'),
      elWho = ov.querySelector('#rw-who'), elTags = ov.querySelector('#rw-tags');

  function open(i) {
    var d = DATA[i]; if (!d) return;
    var imgs = [d.full]; if (d.full2) imgs.push(d.full2);
    elScan.innerHTML = imgs.map(function (u) {
      return '<img src="' + BASE + esc(u) + '" alt="Sken reference ' + esc(d.firma) + '">'; }).join('');
    elCo.textContent = d.firma || '';
    elSec.textContent = d.sektor || '';
    elRole.textContent = d.role ? ('Hledaná pozice: ' + d.role) : '';
    elWho.textContent = d.kontakt ? ('Referuje: ' + d.kontakt) : '';
    elTags.innerHTML = (d.stitky || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    ov.classList.add('on'); ov.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function close() { ov.classList.remove('on'); document.body.style.overflow = ''; }

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.rw__tile'); if (b) open(+b.dataset.i);
  });
  ov.querySelector('#rw-x').addEventListener('click', close);
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
