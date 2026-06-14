/* ============================================================
   SINTERA · web v5.3 · chování (vanilla JS, bez závislostí)
   Data: window.SINTERA_DATA (reference-data.js) + POZICE (pozice-data.js).
   Obsah je v HTML (prerender). JS jen vylepšuje: nit, hero síť,
   rotor, modaly referencí/case studies, filtr pozic.
   ============================================================ */
(function () {
  "use strict";
  var docEl = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function jemne() { return docEl.dataset.motion === "jemne"; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var DATA = window.SINTERA_DATA || { references: [], cases: [], rotor: [], clients: [] };

  /* ---------- nav: scrolled + mobilní menu ---------- */
  var nav = document.getElementById("nav");
  function onScroll() { if (nav) nav.classList.toggle("scrolled", window.scrollY > 28); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  var burger = document.getElementById("burger");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll("#mobileMenu a").forEach(function (a) {
      a.addEventListener("click", function () { document.body.classList.remove("nav-open"); burger.setAttribute("aria-expanded", "false"); });
    });
  }

  /* ---------- scroll-spy ---------- */
  var spy = [["problem", "#problem"], ["zadani", "#problem"], ["nastroj", "#problem"], ["presnost", "#problem"],
            ["cases", "#cases"], ["reference", "#reference"], ["clovek", "#reference"],
            ["pozice", "#pozice"], ["kontakt", "#kontakt"]]
    .map(function (m) { return { el: document.getElementById(m[0]), href: m[1] }; })
    .filter(function (s) { return s.el; });
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  function runSpy() {
    var y = window.scrollY + window.innerHeight * 0.34, cur = null;
    spy.forEach(function (s) { if (s.el.offsetTop <= y) cur = s.href; });
    navLinks.forEach(function (a) { a.classList.toggle("active", !!cur && a.getAttribute("href") === cur); });
  }
  window.addEventListener("scroll", runSpy, { passive: true }); runSpy();

  /* ---------- reveal ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });
  function observeReveals(scope) { (scope || document).querySelectorAll(".rv:not(.in)").forEach(function (el) { io.observe(el); }); }
  observeReveals();

  /* ---------- nit (scroll thread) ---------- */
  var thread = document.getElementById("thread");
  var threadPath, threadTip, threadLen = 0, mainEl = document.getElementById("top");
  function buildThread() {
    if (!thread || !mainEl) return;
    var H = mainEl.offsetHeight;
    thread.setAttribute("viewBox", "0 0 100 " + H);
    thread.style.height = H + "px";
    // jemně meandrující svislá nit kolem středu
    var pts = [], n = Math.max(6, Math.round(H / 520));
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var x = 50 + Math.sin(t * Math.PI * 2.4) * 26 + (i % 2 ? 6 : -6);
      pts.push([Math.max(8, Math.min(92, x)), t * H]);
    }
    var d = "M" + pts[0][0] + " " + pts[0][1];
    for (var j = 1; j < pts.length; j++) {
      var p0 = pts[j - 1], p1 = pts[j], my = (p0[1] + p1[1]) / 2;
      d += " C" + p0[0] + " " + my + " " + p1[0] + " " + my + " " + p1[0] + " " + p1[1];
    }
    thread.innerHTML = '<path d="' + d + '"/><circle class="node on" r="3.2"/>';
    threadPath = thread.querySelector("path");
    threadTip = thread.querySelector("circle");
    threadLen = threadPath.getTotalLength();
    threadPath.style.setProperty("--len", threadLen);
    drawThread();
  }
  function drawThread() {
    if (!threadPath) return;
    var top = mainEl.getBoundingClientRect().top + window.scrollY;
    var p = (window.scrollY + window.innerHeight * 0.62 - top) / mainEl.offsetHeight;
    p = Math.max(0, Math.min(1, p));
    if (reduced) p = 1;
    threadPath.style.strokeDashoffset = threadLen * (1 - p);
    if (threadTip) {
      var pt = threadPath.getPointAtLength(threadLen * p);
      threadTip.setAttribute("cx", pt.x); threadTip.setAttribute("cy", pt.y);
      threadTip.style.opacity = p > 0.005 && p < 0.995 ? ".9" : "0";
    }
  }
  window.addEventListener("scroll", drawThread, { passive: true });

  /* ---------- hero síť (organická) + paprsek ---------- */
  (function heroNet() {
    var canvas = document.getElementById("heroNet");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var nodes = [], links = [], target = null, beam = { t: 0, paused: 0 }, ctaLit = false;
    var cta = document.getElementById("heroCta");

    function size() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    function build() {
      nodes = []; links = [];
      var clusters = 5, per = 14;
      for (var c = 0; c < clusters; c++) {
        var cx = (0.18 + 0.64 * pseudo(c * 7)) * W;
        var cy = (0.16 + 0.66 * pseudo(c * 13)) * H;
        for (var i = 0; i < per; i++) {
          var a = pseudo(c * 100 + i) * Math.PI * 2, rr = pseudo(c * 31 + i * 3) * 0.16 * Math.min(W, H);
          nodes.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, b: 0.18 + pseudo(i * c + 5) * 0.5 });
        }
      }
      // pár osamělých teček na krajích
      for (var k = 0; k < 8; k++) nodes.push({ x: pseudo(k * 9 + 1) * W, y: pseudo(k * 17 + 2) * H, b: 0.12 });
      // cílový uzel: mimo střed, vpravo dole
      target = { x: W * (0.74 + pseudo(99) * 0.12), y: H * (0.62 + pseudo(77) * 0.18), b: 1 };
      nodes.push(target);
      // linky k nejbližším sousedům (řídce)
      nodes.forEach(function (nd, i) {
        var ds = nodes.map(function (o, j) { return { j: j, d: dist(nd, o) }; }).filter(function (o) { return o.j !== i; }).sort(function (a, b) { return a.d - b.d; });
        for (var m = 0; m < 2; m++) if (ds[m] && ds[m].d < Math.min(W, H) * 0.34) links.push([i, ds[m].j, ds[m].d]);
      });
    }
    function pseudo(n) { var x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return x - Math.floor(x); }
    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
    function edgeAlpha(x, y) { // vyblednutí na krajích
      var dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2; var r = Math.sqrt(dx * dx + dy * dy);
      return Math.max(0, 1 - Math.pow(r, 2.2));
    }
    function frame(now) {
      ctx.clearRect(0, 0, W, H);
      // beam point podél jemné dráhy
      if (!reduced && !jemne()) beam.t += 0.0016;
      var bt = beam.t % 1;
      var bx = W * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(bt * Math.PI * 2)));
      var by = H * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(bt * Math.PI * 2 * 1.3 + 1)));
      // dotažení k cíli ke konci cyklu
      var near = bt > 0.86;
      if (near) { bx = bx + (target.x - bx) * (bt - 0.86) / 0.14; by = by + (target.y - by) * (bt - 0.86) / 0.14; }
      // linky
      links.forEach(function (l) {
        var a = nodes[l[0]], b = nodes[l[1]];
        var al = 0.07 * edgeAlpha((a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.strokeStyle = "rgba(174,180,210," + al.toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      // uzly
      nodes.forEach(function (nd) {
        if (nd === target) return;
        var lit = dist(nd, { x: bx, y: by }) < Math.min(W, H) * 0.12;
        var al = (nd.b * 0.5 + (lit ? 0.4 : 0)) * edgeAlpha(nd.x, nd.y);
        ctx.fillStyle = lit ? "rgba(230,145,105," + Math.min(0.9, al + 0.2).toFixed(3) + ")" : "rgba(200,206,235," + al.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(nd.x, nd.y, lit ? 2.4 : 1.6, 0, 6.2832); ctx.fill();
      });
      // cesta k cíli (skoro neviditelná)
      ctx.strokeStyle = "rgba(210,122,81,.16)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(target.x, target.y); ctx.stroke();
      // beam
      var bg = ctx.createRadialGradient(bx, by, 0, bx, by, 60);
      bg.addColorStop(0, "rgba(230,145,105,.16)"); bg.addColorStop(1, "rgba(230,145,105,0)");
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, 60, 0, 6.2832); ctx.fill();
      // cílový uzel (pulz)
      var pulse = near ? 1 : 0.55 + 0.25 * Math.sin(now / 700);
      ctx.fillStyle = "rgba(210,122,81," + pulse.toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(target.x, target.y, 4.2, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "rgba(230,145,105,.5)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(target.x, target.y, 9 + (near ? 4 : 0), 0, 6.2832); ctx.stroke();
      if (near && !ctaLit && cta) { ctaLit = true; cta.classList.add("lit"); }
      if (bt < 0.1) ctaLit = false;
      if (!reduced && !jemne()) raf = requestAnimationFrame(frame);
    }
    var raf;
    size();
    if (reduced || jemne()) { frame(0); if (cta) cta.classList.add("lit"); }
    else raf = requestAnimationFrame(frame);
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 200); });
  })();

  /* ---------- rotor (přesnost) ---------- */
  (function rotor() {
    var el = document.getElementById("rotor");
    if (!el) return;
    var items = Array.prototype.slice.call(el.querySelectorAll(".rotor-item"));
    if (!items.length) return;
    var dotsWrap = document.getElementById("rotorDots"), idx = 0, timer;
    if (dotsWrap) {
      dotsWrap.innerHTML = items.map(function (_, i) { return '<button type="button" aria-label="Citace ' + (i + 1) + '"' + (i === 0 ? ' class="on"' : '') + '></button>'; }).join("");
      dotsWrap.querySelectorAll("button").forEach(function (b, i) { b.addEventListener("click", function () { go(i); restart(); }); });
    }
    function go(n) {
      items[idx].classList.remove("active");
      idx = (n + items.length) % items.length;
      items[idx].classList.add("active");
      if (dotsWrap) dotsWrap.querySelectorAll("button").forEach(function (b, i) { b.classList.toggle("on", i === idx); });
    }
    function tick() { if (!jemne()) go(idx + 1); }
    function pause() { clearInterval(timer); }
    function restart() { clearInterval(timer); if (!reduced) timer = setInterval(tick, 4600); }
    el.addEventListener("mouseenter", pause); el.addEventListener("mouseleave", restart);
    if (dotsWrap) {
      dotsWrap.addEventListener("mouseenter", pause); dotsWrap.addEventListener("mouseleave", restart);
      dotsWrap.addEventListener("focusin", pause); dotsWrap.addEventListener("focusout", restart);
    }
    restart();
  })();

  /* ---------- modal (reference + case studies) ---------- */
  var modal, modalBody, lastFocus;
  function bgInert(on) {
    document.querySelectorAll("header.nav, main, footer, .motion-toggle").forEach(function (el) {
      if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert");
    });
  }
  function ensureModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.className = "modal"; modal.id = "modal"; modal.hidden = true;
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    modal.innerHTML = '<div class="modal-back" data-close></div><div class="modal-box"><button class="modal-x" data-close aria-label="Zavřít">✕</button><div id="modalBody"></div></div>';
    document.body.appendChild(modal);
    modalBody = modal.querySelector("#modalBody");
    modal.querySelectorAll("[data-close]").forEach(function (e) { e.addEventListener("click", closeModal); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
    modal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || modal.hidden) return;
      var f = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  function openModal(html, trigger) {
    ensureModal();
    lastFocus = trigger || null;
    modalBody.innerHTML = html;
    modal.hidden = false;
    bgInert(true);
    docEl.style.overflow = "hidden";
    requestAnimationFrame(function () { modal.classList.add("open"); });
    modal.querySelector(".modal-x").focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    docEl.style.overflow = "";
    bgInert(false);
    setTimeout(function () { modal.hidden = true; }, 320);
    if (lastFocus) lastFocus.focus();
  }
  function refById(id) { return DATA.references.filter(function (r) { return r.id === id; })[0]; }
  function caseById(id) { return DATA.cases.filter(function (c) { return c.id === id; })[0]; }
  function refModalHTML(r) {
    var logo = r.logo ? '<div class="ref-modal-logo"><img src="' + esc(r.logo) + '" alt="' + esc(r.company) + '"></div>' : "";
    var tags = (r.tags || "").split(";").map(function (t) { return t.trim(); }).filter(Boolean)
      .map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
    return logo +
      '<div class="ref-modal-quote">„' + esc(r.long || r.quote) + "“</div>" +
      '<div class="ref-modal-who"><strong>' + esc(r.company) + "</strong>" + (r.role ? "<span>" + esc(r.role) + "</span>" : "") + "</div>" +
      (tags ? '<div class="ref-modal-tags">' + tags + "</div>" : "");
  }
  function caseModalHTML(c) {
    return '<div class="case-modal-meta">' + esc(c.meta) + "</div>" +
      '<dl class="case-dl">' +
      "<div><dt>Situace</dt><dd>" + esc(c.situ) + "</dd></div>" +
      "<div><dt>Proč běžný nábor nestačil</dt><dd>" + esc(c.why) + "</dd></div>" +
      "<div><dt>Co jsme změnili</dt><dd>" + esc(c.change) + "</dd></div>" +
      '<div><dt>Výsledek</dt><dd class="win">' + esc(c.win) + "</dd></div></dl>";
  }
  function bindCards() {
    document.querySelectorAll(".ref-card[data-id]").forEach(function (card) {
      function open() { var r = refById(card.dataset.id); if (r) openModal(refModalHTML(r), card); }
      card.addEventListener("click", open);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    document.querySelectorAll(".case-card[data-id]").forEach(function (card) {
      function open() { var c = caseById(card.dataset.id); if (c) openModal(caseModalHTML(c), card); }
      card.addEventListener("click", open);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  bindCards();

  /* ---------- reference: zobrazit všechny ---------- */
  (function refsToggle() {
    var btn = document.getElementById("refsToggle");
    var cards = Array.prototype.slice.call(document.querySelectorAll("#refsGrid .ref-card"));
    var SHOW = 9;
    if (!btn || cards.length <= SHOW) return;
    cards.forEach(function (c, i) { if (i >= SHOW) c.hidden = true; });
    btn.hidden = false;
    btn.addEventListener("click", function () {
      var expand = cards.some(function (c) { return c.hidden; });
      cards.forEach(function (c, i) { if (i >= SHOW) c.hidden = !expand ? true : false; });
      btn.innerHTML = expand ? 'Zobrazit méně' : 'Zobrazit všechny reference <span class="arr">→</span>';
      if (!expand) document.getElementById("reference").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
  })();

  /* ---------- pozice: filtr + rozbalovací detail ---------- */
  (function positions() {
    if (typeof POZICE === "undefined") return;
    var state = { q: "", obory: new Set(), kraj: "", sen: "" };
    var elQ = document.getElementById("fQ"), elKraj = document.getElementById("fKraj"),
        elChips = document.getElementById("fChips"), elSeg = document.getElementById("fSeg"),
        elList = document.getElementById("posList"), elCnt = document.getElementById("posCnt"),
        elEmpty = document.getElementById("posEmpty"), elReset = document.getElementById("fReset");
    if (!elList) return;
    var sorted = POZICE.slice().sort(function (a, b) { return b.id - a.id; });

    var params = new URLSearchParams(window.location.search);
    if (params.get("q")) { state.q = params.get("q"); if (elQ) elQ.value = state.q; }
    if (params.get("obor") && OBORY[params.get("obor")]) state.obory.add(params.get("obor"));
    if (params.get("kraj") && KRAJE.indexOf(params.get("kraj")) > -1) state.kraj = params.get("kraj");
    if (params.get("sen") && SENIORITY[params.get("sen")]) state.sen = params.get("sen");

    function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function matches(p) {
      if (state.q && norm(p.t + " " + p.k.join(" ") + " " + OBORY[p.o]).indexOf(norm(state.q)) === -1) return false;
      if (state.obory.size && !state.obory.has(p.o)) return false;
      if (state.kraj && p.k.indexOf(state.kraj) === -1) return false;
      if (state.sen && p.s !== state.sen) return false;
      return true;
    }
    function active() { return !!(state.q || state.obory.size || state.kraj || state.sen); }

    function row(p) {
      var subj = "Reakce na pozici: " + p.t + " (" + p.k.join(" / ") + ")";
      var bonus = p.bonus ? '<span class="bonus">Příspěvek ' + esc(p.bonus) + "</span>" : "";
      return '<div class="pos-item">' +
        '<button class="pos-row" type="button" aria-expanded="false">' +
          '<span class="t">' + esc(p.t) + bonus + "</span>" +
          '<span class="m field">' + esc(OBORY[p.o]) + "</span>" +
          '<span class="m level">' + esc(SENIORITY[p.s]) + "</span>" +
          '<span class="m loc">' + esc(p.k.join(" / ")) + "</span>" +
          '<span class="arr">→</span>' +
        "</button>" +
        '<div class="pos-detail"><div class="pos-detail-inner"><div class="pos-detail-pad">' +
          '<div class="pos-desc"><h3>' + esc(p.t) + "</h3>" +
            "<p>Roli upřesníme při prvním hovoru. Napište nám pár vět o sobě nebo odkaz na profil, ozveme se s detaily.</p>" +
            '<div class="pos-tags"><span>' + esc(OBORY[p.o]) + "</span><span>" + esc(SENIORITY[p.s]) + "</span><span>" + esc(p.k.join(" / ")) + "</span></div>" +
          "</div>" +
          '<form class="apply-form" data-subject="' + esc(subj) + '">' +
            '<span class="af-title">Reagovat na pozici</span>' +
            '<input type="text" name="name" placeholder="Jméno a příjmení" autocomplete="name">' +
            '<input type="text" name="contact" placeholder="E-mail nebo telefon" autocomplete="email">' +
            '<textarea name="note" placeholder="Pár vět o vás, nebo odkaz na profil. CV doplníme později."></textarea>' +
            '<button type="submit" class="btn btn-acc btn-sm">Odeslat reakci</button>' +
            '<span class="af-note">Odesláním se otevře e-mail na info@sintera.cz s předvyplněnou pozicí.</span>' +
          "</form>" +
        "</div></div></div></div>";
    }

    function render() {
      var res = sorted.filter(matches);
      elList.innerHTML = res.map(row).join("");
      elCnt.innerHTML = res.length === POZICE.length
        ? 'Aktuálně obsazujeme <em>' + POZICE.length + "</em> pozic"
        : "Nalezeno <em>" + res.length + "</em> z " + POZICE.length + " pozic";
      elEmpty.style.display = res.length ? "none" : "block";
      elList.style.display = res.length ? "" : "none";
      if (elReset) elReset.classList.toggle("show", active());
      bindRows();
      renderChips(); renderSeg();
    }
    function bindRows() {
      elList.querySelectorAll(".pos-item").forEach(function (item) {
        var btn = item.querySelector(".pos-row"), det = item.querySelector(".pos-detail");
        btn.addEventListener("click", function () {
          var open = det.classList.toggle("open");
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
        var form = item.querySelector(".apply-form");
        form.addEventListener("submit", function (ev) {
          ev.preventDefault();
          var fd = new FormData(form);
          var body = "Jméno: " + (fd.get("name") || "") + "\nKontakt: " + (fd.get("contact") || "") + "\n\n" + (fd.get("note") || "");
          window.location.href = "mailto:info@sintera.cz?subject=" + encodeURIComponent(form.dataset.subject) + "&body=" + encodeURIComponent(body);
        });
      });
    }
    function countObor(k) { return POZICE.filter(function (p) { return p.o === k; }).length; }
    function renderChips() {
      elChips.innerHTML = Object.keys(OBORY).map(function (k) {
        return '<button class="chip' + (state.obory.has(k) ? " on" : "") + '" data-obor="' + k + '" type="button">' + esc(OBORY[k]) + ' <span class="c">' + countObor(k) + "</span></button>";
      }).join("");
    }
    function renderSeg() {
      var h = '<button data-sen="" type="button" class="' + (state.sen === "" ? "on" : "") + '">Vše</button>';
      Object.keys(SENIORITY).forEach(function (k) { h += '<button data-sen="' + k + '" type="button" class="' + (state.sen === k ? "on" : "") + '">' + esc(SENIORITY[k]) + "</button>"; });
      elSeg.innerHTML = h;
    }
    elChips.addEventListener("click", function (ev) { var b = ev.target.closest("[data-obor]"); if (!b) return; var k = b.dataset.obor; state.obory.has(k) ? state.obory.delete(k) : state.obory.add(k); render(); });
    elSeg.addEventListener("click", function (ev) { var b = ev.target.closest("[data-sen]"); if (!b) return; state.sen = b.dataset.sen; render(); });
    KRAJE.forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = k; if (k === state.kraj) o.selected = true; elKraj.appendChild(o); });
    elKraj.addEventListener("change", function () { state.kraj = elKraj.value; render(); });
    var deb; if (elQ) elQ.addEventListener("input", function () { clearTimeout(deb); deb = setTimeout(function () { state.q = elQ.value.trim(); render(); }, 160); });
    if (elReset) elReset.addEventListener("click", function () { state = { q: "", obory: new Set(), kraj: "", sen: "" }; if (elQ) elQ.value = ""; elKraj.value = ""; render(); });
    render();
  })();

  /* ---------- motion toggle ---------- */
  (function motion() {
    var btn = document.getElementById("motionToggle"), label = document.getElementById("motionLabel");
    if (!btn) return;
    try { if (localStorage.getItem("sintera-motion") === "jemne") docEl.dataset.motion = "jemne"; } catch (e) {}
    function sync() { var on = docEl.dataset.motion === "jemne"; btn.setAttribute("aria-pressed", on ? "true" : "false"); if (label) label.textContent = on ? "Pohyb" : "Klid"; }
    sync();
    btn.addEventListener("click", function () {
      if (docEl.dataset.motion === "jemne") delete docEl.dataset.motion; else docEl.dataset.motion = "jemne";
      try { localStorage.setItem("sintera-motion", docEl.dataset.motion || ""); } catch (e) {}
      sync();
    });
  })();

  /* ---------- rok + nit po načtení ---------- */
  var yr = document.getElementById("yr"); if (yr) yr.textContent = new Date().getFullYear();
  function relayout() { buildThread(); }
  window.addEventListener("load", relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  setTimeout(relayout, 300);
  var rzt; window.addEventListener("resize", function () { clearTimeout(rzt); rzt = setTimeout(buildThread, 250); });
})();
