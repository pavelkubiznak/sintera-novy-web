/* ============================================================
   SINTERA web · chování, portováno z Claude Design prototypu v5.
   3 moduly: (A) chování + render, (B) hero searchlight, (C) nit.
   Data: window.SINTERA_DATA (reference-data.js) + POZICE (pozice-data.js).
   ============================================================ */

/* ============================================================
   A) NAV + RENDER (reference / klienti / rotor / case / pozice)
   ============================================================ */
(function () {
  "use strict";
  var docEl = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var DATA = window.SINTERA_DATA || { references: [], cases: [], rotor: [], clients: [] };

  /* ---------- nav scrolled + mobilní menu ---------- */
  var nav = document.getElementById("nav");
  function onScroll() { if (nav) nav.classList.toggle("scrolled", window.scrollY > 24); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  var navToggle = document.getElementById("nav-toggle");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () { nav.classList.remove("nav-open"); navToggle.setAttribute("aria-expanded", "false"); });
    });
  }

  /* ---------- scroll-spy ---------- */
  var spyMap = [
    ["problem", "#trh"], ["trh", "#trh"], ["zadani", "#trh"], ["infra", "#trh"], ["presnost", "#trh"],
    ["cases", "#cases"], ["reference", "#reference"], ["clovek", "#reference"],
    ["pozice", "#pozice"], ["kontakt", "#kontakt"]
  ];
  var spySections = spyMap.map(function (m) { return { el: document.getElementById(m[0]), href: m[1] }; }).filter(function (s) { return s.el; });
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  function spy() {
    var y = window.scrollY + window.innerHeight * 0.32, current = null;
    spySections.forEach(function (s) { if (s.el.offsetTop <= y) current = s.href; });
    navLinks.forEach(function (a) { a.classList.toggle("active", !!current && a.getAttribute("href") === current); });
  }
  window.addEventListener("scroll", spy, { passive: true }); spy();

  /* ---------- scroll reveals ---------- */
  function observeReveals(scope) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.16 });
    (scope || document).querySelectorAll(".rv:not(.in)").forEach(function (el) { io.observe(el); });
  }
  observeReveals();

  /* ---------- reference ---------- */
  function renderReferences(data) {
    var grid = document.getElementById("refs-grid");
    if (!grid) return;
    grid.innerHTML = "";
    data.forEach(function (r) {
      var art = document.createElement("article");
      art.className = "ref-card rv";
      art.setAttribute("role", "button");
      art.setAttribute("tabindex", "0");
      art.setAttribute("aria-label", "Reference: " + r.company);
      var logo = '<div class="ref-logo">' + (r.logo ? '<img src="' + esc(r.logo) + '" alt="' + esc(r.company) + '" loading="lazy" />' : '<span class="ref-logo-name">' + esc(r.company) + "</span>") + "</div>";
      art.innerHTML = logo +
        "<blockquote>„" + esc(r.quote) + "“</blockquote>" +
        '<div class="who"><strong>' + esc(r.company) + "</strong>" + (r.role ? "<span>" + esc(r.role) + "</span>" : "") + "</div>" +
        '<span class="ref-more">Číst celé →</span>';
      function open() { openModalHTML(refDetailHTML(r), art); }
      art.addEventListener("click", open);
      art.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      grid.appendChild(art);
    });
    observeReveals(grid);
  }

  /* ---------- klienti: pohyblivý pás ---------- */
  function clientNode(c) {
    return c.logo
      ? '<span class="logo-slot"><img src="' + esc(c.logo) + '" alt="' + esc(c.name) + '" loading="lazy" /></span>'
      : '<span class="client-name">' + esc(c.name) + "</span>";
  }
  function renderMarquee(data) {
    var el = document.getElementById("marquee-track");
    if (!el) return;
    var group = '<div class="mq-group">' + data.map(clientNode).join("") + "</div>";
    el.innerHTML = group + group;
    el.style.animationDuration = Math.max(30, Math.round(data.length * 2.5)) + "s";
  }

  /* ---------- rotující výroky o přesnosti ---------- */
  function renderRotor(data) {
    var el = document.getElementById("presnost-rotor");
    if (!el || !data.length) return;
    el.innerHTML = data.map(function (r, i) {
      return '<figure class="rotor-item' + (i === 0 ? " active" : "") + '"><blockquote>„' + esc(r.q) + "“</blockquote>" + (r.c ? "<figcaption>" + esc(r.c) + "</figcaption>" : "") + "</figure>";
    }).join("");
    var items = el.querySelectorAll(".rotor-item");
    if (items.length < 2 || reduced) return;
    var idx = 0, timer;
    function tick() {
      if (docEl.dataset.motion === "jemne") return;
      var cur = items[idx];
      cur.classList.remove("active"); cur.classList.add("exit");
      idx = (idx + 1) % items.length;
      items[idx].classList.add("active");
      setTimeout(function () { cur.classList.remove("exit"); }, 800);
    }
    function start() { clearInterval(timer); timer = setInterval(tick, 7700); }
    el.addEventListener("mouseenter", function () { clearInterval(timer); });
    el.addEventListener("mouseleave", start);
    start();
  }

  /* ---------- case studies ---------- */
  function caseDetailHTML(c) {
    return '<div class="case-modal-meta">' + esc(c.meta) + "</div>" +
      '<dl class="case-dl">' +
      "<div><dt>Situace</dt><dd>" + esc(c.situ) + "</dd></div>" +
      "<div><dt>Proč běžný nábor nestačil</dt><dd>" + esc(c.why) + "</dd></div>" +
      "<div><dt>Co jsme změnili</dt><dd>" + esc(c.change) + "</dd></div>" +
      '<div><dt>Výsledek</dt><dd class="win">' + esc(c.win) + "</dd></div></dl>";
  }
  function refDetailHTML(r) {
    var tags = (r.tags || "").split(";").map(function (t) { return t.trim(); }).filter(Boolean);
    return '<div class="ref-modal-quote">„' + esc(r.long || r.quote) + "“</div>" +
      '<div class="ref-modal-who"><strong>' + esc(r.company) + "</strong>" + (r.role ? "<span>" + esc(r.role) + "</span>" : "") + "</div>" +
      (tags.length ? '<p class="ref-modal-ctx">' + tags.map(esc).join(" · ") + "</p>" : "");
  }

  var caseModal = document.getElementById("case-modal");
  var caseModalBody = document.getElementById("case-modal-body");
  var modalLastFocus = null;
  function bgInert(on) {
    document.querySelectorAll("#nav, main, footer").forEach(function (el) { if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
  }
  function openModalHTML(html, trigger) {
    if (!caseModal) return;
    modalLastFocus = trigger || null;
    caseModalBody.innerHTML = html;
    caseModal.hidden = false;
    bgInert(true);
    docEl.style.overflow = "hidden";
    requestAnimationFrame(function () { caseModal.classList.add("open"); });
    var x = caseModal.querySelector(".case-modal-x");
    if (x) x.focus();
  }
  function closeModal() {
    if (!caseModal) return;
    caseModal.classList.remove("open");
    docEl.style.overflow = "";
    bgInert(false);
    setTimeout(function () { caseModal.hidden = true; }, 320);
    if (modalLastFocus) modalLastFocus.focus();
  }
  if (caseModal) {
    caseModal.querySelectorAll("[data-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !caseModal.hidden) closeModal(); });
    caseModal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || caseModal.hidden) return;
      var f = caseModal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function renderCases(data) {
    var grid = document.getElementById("cases-grid");
    if (!grid) return;
    grid.innerHTML = "";
    data.forEach(function (c) {
      var art = document.createElement("article");
      art.className = "case-card rv";
      art.setAttribute("role", "button");
      art.setAttribute("tabindex", "0");
      art.setAttribute("aria-label", "Příběh: " + (c.name || c.meta));
      art.innerHTML = '<div class="case-meta">' + esc(c.meta) + "</div>" +
        '<p class="case-hook">' + esc(c.situ) + "</p>" +
        '<span class="case-more">Číst příběh →</span>';
      function open() { openModalHTML(caseDetailHTML(c), art); }
      art.addEventListener("click", open);
      art.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      grid.appendChild(art);
    });
    observeReveals(grid);
  }

  /* ---------- pozice: filtr + detail + formulář ---------- */
  var OB = window.OBORY || {}, SEN = window.SENIORITY || {}, KR = window.KRAJE || [];
  // kurátorský výběr rolí pro homepage (max 9). Všechny pozice zůstávají v datech i na vlastních stránkách pozice/<id>.html.
  var HOMEPAGE_POS = [830, 856, 862, 853, 805, 833, 795, 827, 832];
  var byId = {}; (window.POZICE || []).forEach(function (p) { byId[p.id] = p; });
  var POS = HOMEPAGE_POS.map(function (id) { return byId[id]; }).filter(Boolean).slice(0, 9).map(function (p) {
    return { id: p.id, title: p.t, field: OB[p.o] || p.o, level: SEN[p.s] || p.s, loc: (p.k || []).join(" / "), bonus: p.bonus || "" };
  });
  var list = document.getElementById("pos-list");
  var empty = document.getElementById("pos-empty");

  function renderPositions() {
    if (!list) return;
    list.innerHTML = "";
    POS.forEach(function (p, i) {
      var wrap = document.createElement("div");
      wrap.className = "pos-item";
      var row = document.createElement("div");
      row.className = "pos-row";
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-expanded", "false");
      row.style.animationDelay = Math.min(i * 40, 320) + "ms";
      var bonus = p.bonus ? ' <span class="pos-bonus">+ příspěvek ' + esc(p.bonus) + "</span>" : "";
      row.innerHTML =
        '<span class="t">' + esc(p.title) + bonus + "</span>" +
        '<span class="m field">' + esc(p.field) + "</span>" +
        '<span class="m level">' + esc(p.level) + "</span>" +
        '<span class="m loc">' + esc(p.loc) + "</span>" +
        '<span class="arr">→</span>';
      var detail = document.createElement("div");
      detail.className = "pos-detail";
      var subj = "Reakce na pozici: " + p.title + " (" + p.loc + ")";
      detail.innerHTML =
        '<div class="pos-detail-inner"><div class="pos-detail-pad">' +
          '<div class="pos-desc">' +
            "<h3>" + esc(p.title) + "</h3>" +
            "<p>Roli upřesníme při prvním hovoru, řekněte nám, co od ní čekáte. Detaily a požadavky pošleme obratem.</p>" +
            '<div class="pos-tags"><span>' + esc(p.field) + "</span><span>" + esc(p.level) + "</span><span>" + esc(p.loc) + "</span></div>" +
            '<p style="margin-top:16px"><a class="ref-more" href="pozice/' + p.id + '.html">Otevřít stránku pozice →</a></p>' +
          "</div>" +
          '<form class="apply-form" data-subject="' + esc(subj) + '">' +
            '<span class="af-title">Reagovat na pozici</span>' +
            '<input type="text" name="name" placeholder="Jméno a příjmení" autocomplete="name" aria-label="Jméno a příjmení" />' +
            '<input type="text" name="contact" placeholder="E-mail nebo telefon" autocomplete="email" aria-label="E-mail nebo telefon" />' +
            '<textarea name="note" placeholder="Pár vět o vás, nebo odkaz na profil. CV doplníme později." aria-label="Zpráva"></textarea>' +
            '<button type="submit" class="btn btn-primary">Odeslat reakci</button>' +
            '<span class="af-note">Odesláním se otevře e-mail na info@sintera.cz s předvyplněnou pozicí.</span>' +
          "</form>" +
        "</div></div>";
      wrap.appendChild(row); wrap.appendChild(detail); list.appendChild(wrap);
      function toggle() { var open = detail.classList.toggle("open"); row.setAttribute("aria-expanded", open ? "true" : "false"); }
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
      var form = detail.querySelector(".apply-form");
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var fd = new FormData(form);
        var body = "Pozice: " + p.title + ", " + p.loc + "\nJméno: " + (fd.get("name") || "") + "\nKontakt: " + (fd.get("contact") || "") + "\n\n" + (fd.get("note") || "");
        window.location.href = "mailto:info@sintera.cz?subject=" + encodeURIComponent(form.dataset.subject) + "&body=" + encodeURIComponent(body);
      });
    });
    if (empty) empty.hidden = POS.length !== 0;
  }

  /* ---------- render vše ---------- */
  renderMarquee(DATA.clients || []);
  renderRotor(DATA.rotor || []);
  renderReferences((DATA.references || []).slice(0, 9));
  renderCases((DATA.cases || []).slice(0, 6));
  renderPositions();
  var yr = document.getElementById("yr"); if (yr) yr.textContent = new Date().getFullYear();
  window.dispatchEvent(new Event("sintera:rendered"));
})();

/* ============================================================
   B) HERO · searchlight přes anonymní profilové karty (skrytý trh)
   ============================================================ */
(function () {
  "use strict";
  var docEl = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var field = document.querySelector(".hero-net .search-field");
  if (!field) return;
  var light = field.querySelector(".searchlight");

  var heroProfiles = [
    { name: "Tomáš V.", loc: "Hradec Králové", role: "Vedoucí údržby", proof: "Snížil neplánované odstávky. Vede tým 28 techniků.", status: "práci má" },
    { name: "Jana M.", loc: "Brno", role: "Quality Manager", proof: "Připravila zákaznický audit. Stabilizovala reklamace.", status: "aktivně nehledá" },
    { name: "Petr K.", loc: "Plzeň", role: "Vedoucí výroby", proof: "Rozjel novou linku. Stabilizoval třísměnný provoz.", status: "na inzerát by nereagoval" },
    { name: "Martin S.", loc: "Liberec", role: "Technolog", proof: "Zkrátil náběh nových projektů. Zná automotive i kusovou výrobu.", status: "dává smysl oslovit" },
    { name: "Eva R.", loc: "Pardubice", role: "Nákup pro výrobu", proof: "Vyjednala nové dodavatele. Drží termíny i při výpadcích.", status: "práci má" },
    { name: "Michal D.", loc: "Ostrava", role: "Svařovací inženýr", proof: "Zavedl nové postupy. Pomohl projít zákaznickým auditem.", status: "aktivně nehledá" },
    { name: "Lucie B.", loc: "Olomouc", role: "HR Business Partner", proof: "Zrychlila nábor technických rolí. Nastavila spolupráci s manažery.", status: "práci má" },
    { name: "Radek P.", loc: "Kolín", role: "CNC specialista", proof: "Zkrátil seřizovací časy. Školí mladší operátory.", status: "na trhu není vidět" },
    { name: "Kateřina H.", loc: "Praha", role: "B2B obchod", proof: "Otevřela nové zákaznické účty. Zná technický prodej.", status: "aktivně nehledá" },
    { name: "David N.", loc: "Jihlava", role: "Operations Manager", proof: "Sjednotil plánování výroby. Zlepšil dostupnost kapacit.", status: "dává smysl oslovit" },
    { name: "Ondřej T.", loc: "Zlín", role: "Údržbář automatizace", proof: "Zkrátil prostoje linky. Zná PLC i mechaniku.", status: "práci má" },
    { name: "Veronika S.", loc: "České Budějovice", role: "Plánování výroby", proof: "Sladila kapacity s odbytem. Snížila zpoždění zakázek.", status: "aktivně nehledá" },
    { name: "Filip H.", loc: "Mladá Boleslav", role: "Kvalitář", proof: "Vedl 8D reklamace. Zlepšil first pass yield.", status: "dává smysl oslovit" },
    { name: "Marek L.", loc: "Ústí nad Labem", role: "Mistr výroby", proof: "Vede dvě směny. Zaškolil nové operátory.", status: "na inzerát by nereagoval" },
    { name: "Hana P.", loc: "Zlín", role: "Procesní inženýr", proof: "Zavedla měření taktů. Odstranila úzká místa.", status: "práci má" },
    { name: "Jakub N.", loc: "Třinec", role: "Konstruktér", proof: "Navrhl přípravky pro montáž. Zkrátil čas sestavení.", status: "na trhu není vidět" }
  ];
  // 3 řady × 3 sloupce, rovnoměrné rozprostření s jitterem a hloubkou (organické, ne mřížka)
  var LAYOUT = [
    { p: 0, left: "5%",  top: "7%",  d: 1 }, { p: 1, left: "37%", top: "13%", d: 3 }, { p: 9, right: "3%", top: "5%",  d: 2 },
    { p: 4, left: "2%",  top: "40%", d: 2 }, { p: 7, left: "31%", top: "37%", d: 1 }, { p: 3, right: "2%", top: "39%", d: 3 },
    { p: 6, left: "7%",  top: "73%", d: 2 }, { p: 8, left: "39%", top: "67%", d: 3 }, { p: 2, right: "4%", top: "74%", d: 2 }
  ];
  var DEPTH = { 1: { o: 0.92, s: 1.0, b: 0, z: 7, amp: 3.5 }, 2: { o: 0.56, s: 0.92, b: 0.6, z: 4, amp: 5 }, 3: { o: 0.32, s: 0.82, b: 1.6, z: 2, amp: 7 } };

  var shown = {};
  function fill(el, idx) {
    var pr = heroProfiles[idx];
    el.innerHTML = '<span class="pc-dot"></span><span class="pc-name">' + pr.name + '</span><span class="pc-loc">' + pr.loc + '</span><span class="pc-role">' + pr.role + '</span><span class="pc-proof">' + pr.proof + '</span><span class="pc-status">' + pr.status + '</span>';
  }
  function rnd(seed) { var x = Math.sin((seed + 1) * 99.7) * 43758.5; return x - Math.floor(x); }
  var cards = [];
  LAYOUT.forEach(function (it, i) {
    var dp = DEPTH[it.d];
    var el = document.createElement("article");
    el.className = "pcard";
    if (it.left) el.style.left = it.left;
    if (it.right) el.style.right = it.right;
    el.style.top = it.top;
    el.style.setProperty("--o", dp.o); el.style.setProperty("--s", dp.s); el.style.setProperty("--b", dp.b + "px");
    el.style.zIndex = dp.z;
    fill(el, it.p); shown[it.p] = true; field.appendChild(el);
    cards.push({ el: el, depth: it.d, scale: dp.s, amp: dp.amp, sp: 0.16 + rnd(i) * 0.14, ph: rnd(i + 3) * 6.28, profile: it.p });
  });

  var centers = [];
  function refresh() { centers = cards.map(function (c) { return { x: c.el.offsetLeft + c.el.offsetWidth / 2, y: c.el.offsetTop + c.el.offsetHeight / 2, el: c.el }; }); }
  refresh(); window.addEventListener("resize", refresh);
  function ctaSpark() { var s = document.querySelector("#hero-cta .cta-spark"); if (s) { s.classList.remove("spark"); void s.offsetWidth; s.classList.add("spark"); } }
  function place(x, y) { if (light) light.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)"; }

  var MATCHABLE = cards.map(function (c, i) { return i; });
  var FOCUS_R = 150;
  if (reduced) { var m0 = centers[MATCHABLE[0]]; if (m0) { m0.el.classList.add("match"); place(m0.x, m0.y); } return; }

  var rc = 0;
  function recycle() {
    if (docEl.dataset.motion === "jemne") return;
    var cand = [];
    cards.forEach(function (c, i) { if (!c.el.classList.contains("match") && !c.el.classList.contains("focus")) cand.push(i); });
    if (!cand.length) return;
    var ci = cand[(rnd(rc++) * cand.length) | 0];
    var card = cards[ci], next = -1;
    for (var k = 1; k <= heroProfiles.length; k++) { var idx = (card.profile + k) % heroProfiles.length; if (!shown[idx]) { next = idx; break; } }
    if (next < 0) return;
    card.el.style.opacity = "0";
    setTimeout(function () {
      delete shown[card.profile]; fill(card.el, next); card.profile = next; shown[next] = true;
      var fw = field.clientWidth, fh = field.clientHeight, cw = card.el.offsetWidth, chh = card.el.offsetHeight;
      var maxL = Math.max(14, fw - cw - 14), maxT = Math.max(14, fh - chh - 14);
      card.el.style.right = "";
      card.el.style.left = ((14 + rnd(rc + 7) * (maxL - 14)) / fw * 100).toFixed(1) + "%";
      card.el.style.top = ((14 + rnd(rc + 11) * (maxT - 14)) / fh * 100).toFixed(1) + "%";
      card.el.style.opacity = ""; refresh();
    }, 560);
  }
  setInterval(recycle, 3000);

  var lastIdx = -1, lx = field.clientWidth * 0.5, ly = field.clientHeight * 0.42;
  var tx = lx, ty = ly, phase = "move", dwellUntil = 0, matchEl = null, cur = null, ti = 0;
  function nextTarget() { var idx; do { idx = (rnd(ti++) * cards.length) | 0; } while (cards.length > 1 && idx === lastIdx); lastIdx = idx; cur = centers[idx]; if (cur) { tx = cur.x; ty = cur.y; } phase = "move"; }
  nextTarget();
  function loop(now) {
    var jemne = docEl.dataset.motion === "jemne", T = now / 1000;
    if (!jemne) cards.forEach(function (c) {
      if (c.el.classList.contains("match")) return;
      var dx = Math.sin(T * c.sp + c.ph) * c.amp, dy = Math.cos(T * c.sp * 0.82 + c.ph) * c.amp * 0.7;
      c.el.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + c.scale + ")";
    });
    if (jemne) { if (!matchEl) { var mm = centers[MATCHABLE[0]]; if (mm) { matchEl = mm.el; matchEl.classList.add("match"); place(mm.x, mm.y); } } requestAnimationFrame(loop); return; }
    lx += (tx - lx) * 0.055; ly += (ty - ly) * 0.055; place(lx, ly);
    centers.forEach(function (c) { var d = Math.hypot(c.x - lx, c.y - ly); c.el.classList.toggle("focus", d < FOCUS_R && c.el !== matchEl); });
    if (phase === "move") {
      if (cur && Math.hypot(tx - lx, ty - ly) < 5) { phase = "dwell"; dwellUntil = now + 2900; matchEl = cur.el; matchEl.classList.add("match"); matchEl.classList.remove("focus"); ctaSpark(); }
    } else if (now >= dwellUntil) { if (matchEl) { matchEl.classList.remove("match"); matchEl = null; } nextTarget(); }
    requestAnimationFrame(loop);
  }
  if (document.readyState === "complete") requestAnimationFrame(loop);
  else window.addEventListener("load", function () { requestAnimationFrame(loop); });
})();

/* ============================================================
   C) NIT · linka kreslená scrollem + body u zastávek
   ============================================================ */
(function () {
  "use strict";
  var NODE_SPEC = [
    { sel: ".hero-sub", x: "left", dx: -30 }, { sel: "#proof .proof-pill", x: "gutter" },
    { sel: ".marquee-label", x: "gutter" }, { sel: "#problem .kicker", x: "gutter" },
    { sel: "#problem .pull p", x: "center", dy: -40 }, { sel: "#trh .kicker", x: "gutter" },
    { sel: "#zadani .kicker", x: "gutter" }, { sel: "#infra .kicker", x: "gutter" },
    { sel: "#presnost .kicker", x: "gutter" }, { sel: "#cases .kicker", x: "gutter" },
    { sel: "#reference .kicker", x: "gutter" }, { sel: "#clovek .kicker", x: "gutter" },
    { sel: "#pozice .kicker", x: "gutter" }, { sel: "#kontakt h2", x: "gutter" },
    { sel: ".cta .btn-big", x: "center", dy: 64 }
  ];
  var svg = null, line = null, base = null, nodeEls = [], samples = [], totalLen = 0;
  var NS = "http://www.w3.org/2000/svg";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function anchorPoint(spec) {
    var el = document.querySelector(spec.sel); if (!el) return null;
    var r = el.getBoundingClientRect(), top = r.top + window.scrollY, y = top + r.height / 2 + (spec.dy || 0), x;
    if (document.documentElement.clientWidth <= 640) x = 18; // mobil: nit rovně do levého gutteru
    else if (spec.x === "gutter") x = 30; else if (spec.x === "center") x = docEl().clientWidth / 2; else x = r.left + (spec.dx || 0);
    return { x: x, y: y };
  }
  function docEl() { return document.documentElement; }
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    var d = "M " + pts[0].x + " " + pts[0].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6, c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += " C " + c1x + " " + c1y + ", " + c2x + " " + c2y + ", " + p2.x + " " + p2.y;
    }
    return d;
  }
  function build() {
    var pts = NODE_SPEC.map(anchorPoint).filter(Boolean);
    if (pts.length < 2) return;
    if (svg) svg.remove();
    svg = document.createElementNS(NS, "svg"); svg.id = "thread-svg";
    var w = document.documentElement.clientWidth, h = document.documentElement.scrollHeight;
    svg.setAttribute("width", w); svg.setAttribute("height", h); svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("aria-hidden", "true");
    var d = smoothPath(pts);
    base = document.createElementNS(NS, "path"); base.setAttribute("class", "thread-base"); base.setAttribute("d", d); svg.appendChild(base);
    line = document.createElementNS(NS, "path"); line.setAttribute("class", "thread-line"); line.setAttribute("d", d); svg.appendChild(line);
    nodeEls = [];
    pts.forEach(function (p) {
      var g = document.createElementNS(NS, "g"); g.setAttribute("class", "thread-node");
      var ring = document.createElementNS(NS, "circle"); ring.setAttribute("class", "ring"); ring.setAttribute("cx", p.x); ring.setAttribute("cy", p.y); ring.setAttribute("r", 11);
      var dot = document.createElementNS(NS, "circle"); dot.setAttribute("class", "dot"); dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); dot.setAttribute("r", 5);
      g.appendChild(ring); g.appendChild(dot); svg.appendChild(g); nodeEls.push({ g: g, y: p.y });
    });
    document.body.appendChild(svg);
    totalLen = line.getTotalLength(); line.style.strokeDasharray = totalLen + " " + totalLen;
    samples = []; var N = 360;
    for (var i = 0; i <= N; i++) { var pp = line.getPointAtLength((totalLen * i) / N); samples.push({ len: (totalLen * i) / N, y: pp.y }); }
    update(true);
  }
  function lenAtY(targetY) { var best = 0; for (var i = 0; i < samples.length; i++) if (samples[i].y <= targetY) best = Math.max(best, samples[i].len); return best; }
  function update() {
    if (!line) return;
    var jemne = document.documentElement.dataset.motion === "jemne";
    if (reduced || jemne) { line.style.strokeDashoffset = 0; nodeEls.forEach(function (n) { n.g.classList.add("on"); }); return; }
    var targetY = window.scrollY + window.innerHeight * 0.62, len = lenAtY(targetY);
    line.style.strokeDashoffset = totalLen - len;
    nodeEls.forEach(function (n) { n.g.classList.toggle("on", n.y <= targetY); });
  }
  var ticking = false;
  window.addEventListener("scroll", function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { update(); ticking = false; }); }, { passive: true });
  var resizeT; window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(build, 250); });
  window.addEventListener("sintera:rendered", function () { setTimeout(build, 120); });
  if (document.readyState === "complete") setTimeout(build, 80);
  else window.addEventListener("load", function () { setTimeout(build, 80); });
})();

/* ============================================================
   D) Rotující klientské citace (.mcite-rotor) — interval 6 s, jemný fade.
      Při reduced-motion zůstává jen první citace.
   ============================================================ */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-mcite-rotor]").forEach(function (rotor) {
    var items = Array.prototype.slice.call(rotor.querySelectorAll(".mcite"));
    if (!items.length) return;
    items.forEach(function (it, i) { it.classList.toggle("active", i === 0); it.setAttribute("aria-hidden", i === 0 ? "false" : "true"); });
    if (items.length < 2 || reduced) return;
    var idx = 0, timer;
    function go() {
      var cur = items[idx];
      cur.classList.remove("active"); cur.classList.add("exit"); cur.setAttribute("aria-hidden", "true");
      idx = (idx + 1) % items.length;
      items[idx].classList.add("active"); items[idx].setAttribute("aria-hidden", "false");
      setTimeout(function () { cur.classList.remove("exit"); }, 800);
    }
    function start() { clearInterval(timer); timer = setInterval(go, 7700); }
    rotor.addEventListener("mouseenter", function () { clearInterval(timer); });
    rotor.addEventListener("mouseleave", start);
    start();
  });
})();
