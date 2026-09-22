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
  // Formulář reakce na pozici (markup i odesílání) žije v assets/js/apply-form.js → window.SINTERA_APPLY.

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
  var HOMEPAGE_POS = [830, 856, 862, 853, 805, 833, 795, 827, 832]; // záloha, když data nemají featured
  var allPos = window.POZICE || [];
  var byId = {}; allPos.forEach(function (p) { byId[p.id] = p; });
  var picked = allPos.filter(function (p) { return p.featured; });          // homepage řídí sloupec featured ze Sheetu
  if (!picked.length) picked = HOMEPAGE_POS.map(function (id) { return byId[id]; }).filter(Boolean);
  var POS = picked.slice(0, 9).map(function (p) {
    return { id: p.id, title: p.t, field: OB[p.o] || p.o, level: SEN[p.s] || p.s, loc: (p.k || []).join(" / "), bonus: p.bonus || "", salary: p.sal || "" };
  });
  var list = document.getElementById("pos-list");
  var empty = document.getElementById("pos-empty");

  // celý popis pozice (stejný obsah jako detailová stránka) z pozice-popisy.js podle id; v .body kvůli stejnému stylu
  function posBodyHTML(p) {
    var popis = (window.POZICE_POPISY || {})[p.id];
    if (popis && popis.descHtml) return '<div class="body">' + popis.descHtml + "</div>";
    return '<div class="body"><p>Kompletní popis role, požadavky i co nabízíme najdete na samostatné stránce pozice.</p></div>';
  }
  // meta: mzda (když je vyplněná), kraj, štítky (obor, seniorita)
  function metaTagsHTML(p) {
    var t = [];
    if (p.salary) t.push('<span class="pos-tag-mzda">' + esc(p.salary) + "</span>");
    if (p.field) t.push("<span>" + esc(p.field) + "</span>");
    if (p.level) t.push("<span>" + esc(p.level) + "</span>");
    if (p.loc) t.push("<span>" + esc(p.loc) + "</span>");
    return '<div class="pos-tags">' + t.join("") + "</div>";
  }
  // formulář je sdílený se stránkami pozic (assets/js/apply-form.js); tady se jen vloží a navěsí
  function applyFormHTML(p) { return window.SINTERA_APPLY ? window.SINTERA_APPLY.formHTML(p) : ""; }
  function wireApplyForm(form) { if (form && window.SINTERA_APPLY) window.SINTERA_APPLY.wire(form); }
  // rozbalovací položka pozice (accordion); sdíleno homepage seznamem i /pozice/.
  // p = { id, title, field, level, loc, bonus, salary }. opts.lazy = panel se postaví až při prvním rozbalení
  // (kvůli výkonu na /pozice/ se 76 položkami). opts.detailBase = prefix odkazu na detail (homepage "pozice/", /pozice/ "").
  // Oranžový chip s příspěvkem. Prefix „+ příspěvek" jen u čistých částek;
  // když hodnota sama obsahuje slovo „příspěvek", vypíše se tak, jak je (bez zdvojení).
  function bonusChip(v) {
    v = String(v == null ? "" : v).trim();
    if (!v) return "";
    var label = /příspěvek/i.test(v) ? v : "+ příspěvek " + v;
    return ' <span class="pos-bonus" title="' + esc(label) + '">' + esc(label) + "</span>";
  }

  function buildPosItem(p, opts) {
    opts = opts || {};
    var detailBase = (opts.detailBase != null) ? opts.detailBase : "pozice/";
    var wrap = document.createElement("div");
    wrap.className = "pos-item";
    var rowId = "pos-row-" + p.id, detailId = "pos-detail-" + p.id;
    var row = document.createElement("div");
    row.className = "pos-row";
    row.id = rowId;
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-expanded", "false");
    row.setAttribute("aria-controls", detailId);
    var bonus = bonusChip(p.bonus);
    row.innerHTML =
      '<span class="t">' + esc(p.title) + bonus + "</span>" +
      '<span class="m field">' + esc(p.field) + "</span>" +
      '<span class="m level">' + esc(p.level) + "</span>" +
      '<span class="m loc">' + esc(p.loc) + "</span>" +
      '<span class="arr">→</span>';
    var detail = document.createElement("div");
    detail.className = "pos-detail";
    detail.id = detailId;
    detail.setAttribute("role", "region");
    detail.setAttribute("aria-labelledby", rowId);
    var built = false;
    function fillDetail() {
      if (built) return; built = true;
      detail.innerHTML =
        '<div class="pos-detail-inner"><div class="pos-detail-pad">' +
          '<div class="pos-desc">' +
            posBodyHTML(p) +
            metaTagsHTML(p) +
            '<p class="pos-detail-link"><a class="ref-more" href="' + esc(detailBase + p.id) + '.html">Otevřít jako samostatnou stránku →</a></p>' +
          "</div>" +
          applyFormHTML(p) +
        "</div></div>";
      wireApplyForm(detail.querySelector(".apply-form"));
    }
    if (!opts.lazy) fillDetail();
    wrap.appendChild(row);
    wrap.appendChild(detail);
    function toggle() {
      fillDetail();
      void detail.offsetHeight; // vynuť layout (hlavně u lazy obsahu), ať grid-template-rows:1fr má finální výšku a animace nezůstane na nule
      var open = detail.classList.toggle("open");
      row.setAttribute("aria-expanded", open ? "true" : "false");
      // až po doběhnutí výškové animace přepočítej dekorativní nit (finální výška + geometrie)
      var fired = false, fb;
      function done(e) {
        if (e && e.propertyName && e.propertyName !== "grid-template-rows") return;
        if (fired) return; fired = true;
        detail.removeEventListener("transitionend", done);
        clearTimeout(fb);
        window.dispatchEvent(new Event("sintera:rendered"));
      }
      detail.addEventListener("transitionend", done);
      fb = setTimeout(done, 480);
    }
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
    return wrap;
  }
  window.SINTERA_buildPosItem = buildPosItem;

  function renderPositions() {
    if (!list) return;
    list.innerHTML = "";
    POS.forEach(function (p, i) {
      var item = buildPosItem(p);
      item.querySelector(".pos-row").style.animationDelay = Math.min(i * 40, 320) + "ms";
      list.appendChild(item);
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
   B) HERO · reflektor hledá v síti skrytého trhu
   Uzly a vazby jsou v HTML (viz .hero-net v šabloně), JS jen přesouvá světlo
   a rozsvěcuje nalezený uzel. Bez JS i při reduced-motion svítí uzel .lead z CSS.
   ============================================================ */
(function () {
  "use strict";
  var docEl = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var field = document.querySelector(".hero-net .search-field");
  if (!field) return;
  var light = field.querySelector(".searchlight");
  var dots = [].slice.call(field.querySelectorAll(".net-dot:not(.faint)"));
  var labels = [].slice.call(field.querySelectorAll(".net-label"));
  if (!dots.length || dots.length !== labels.length) return;   // markup se rozešel s JS → nech statický stav

  var centers = [];
  function refresh() {
    centers = dots.map(function (d) { return { x: d.offsetLeft + d.offsetWidth / 2, y: d.offsetTop + d.offsetHeight / 2 }; });
  }
  refresh();
  window.addEventListener("resize", refresh);

  if (reduced) return;                                         // statický stav z CSS, nic se nehýbe

  function place(x, y) { if (light) light.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)"; }
  function ctaSpark() { var s = document.querySelector("#hero-cta .cta-spark"); if (s) { s.classList.remove("spark"); void s.offsetWidth; s.classList.add("spark"); } }
  function found(i) {
    dots.forEach(function (d, k) { d.classList.toggle("found", k === i); });
    labels.forEach(function (l, k) { l.classList.toggle("on", k === i); });
  }
  function rnd(seed) { var x = Math.sin((seed + 1) * 99.7) * 43758.5; return x - Math.floor(x); }

  var FOCUS_R = 140;
  var lx = field.clientWidth * 0.5, ly = field.clientHeight * 0.45, tx = lx, ty = ly;
  var phase = "move", dwellUntil = 0, cur = -1, last = -1, ti = 0, live = false;

  function nextTarget() {
    var idx; do { idx = (rnd(ti++) * dots.length) | 0; } while (dots.length > 1 && idx === last);
    last = cur = idx;
    var c = centers[idx]; if (c) { tx = c.x; ty = c.y; }
    phase = "move"; found(-1);
  }

  function loop(now) {
    // přepínač „jemné animace": reflektor stojí, platí statický stav z CSS
    if (docEl.dataset.motion === "jemne") {
      if (live) { live = false; field.classList.remove("net-live"); found(-1); }
      requestAnimationFrame(loop); return;
    }
    if (!live) { live = true; field.classList.add("net-live"); nextTarget(); }

    lx += (tx - lx) * 0.055; ly += (ty - ly) * 0.055;
    place(lx, ly);
    dots.forEach(function (d, k) {
      var c = centers[k]; if (!c) return;
      d.classList.toggle("near", k !== cur && Math.hypot(c.x - lx, c.y - ly) < FOCUS_R);
    });
    if (phase === "move") {
      if (Math.hypot(tx - lx, ty - ly) < 5) { phase = "dwell"; dwellUntil = now + 2800; found(cur); ctaSpark(); }
    } else if (now >= dwellUntil) { nextTarget(); }
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
    if (spec.x === "gutter") x = 30; else if (spec.x === "center") x = docEl().clientWidth / 2; else x = r.left + (spec.dx || 0);
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
   D) Rotující klientské citace (.mcite-rotor): interval 6 s, jemný fade.
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
