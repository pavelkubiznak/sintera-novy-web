/* SINTERA · stránka /pozice/ — výpis všech pozic + filtry (vanilla JS, bez závislostí).
   Data z assets/js/pozice-data.js (window.POZICE, OBORY, SENIORITY, KRAJE).
   Každý řádek je odkaz na detail pozice. Odkazy jsou relativní ke složce stránky;
   pokud stránka NENÍ ve složce pozice/, nastav na kontejneru data-detail-base
   (např. data-detail-base="pozice/"). */
(function () {
  "use strict";
  var POZICE = window.POZICE || [];
  var OB = window.OBORY || {}, SEN = window.SENIORITY || {};

  var list = document.getElementById("pos-all-list");
  if (!list) return;
  var countEl = document.getElementById("pos-all-count");
  var emptyEl = document.getElementById("pos-all-empty");
  var filtersEl = document.getElementById("pos-all-filters");
  var DETAIL_BASE = list.getAttribute("data-detail-base") || "";

  var state = { o: "", s: "", k: "", q: "" };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function uniqKraje() {
    var seen = {}, out = [];
    POZICE.forEach(function (p) {
      (p.k || []).forEach(function (kr) { if (kr && !seen[kr]) { seen[kr] = 1; out.push(kr); } });
    });
    return out.sort(function (a, b) { return a.localeCompare(b, "cs"); });
  }
  function uniqObory() {
    var seen = {}, out = [];
    POZICE.forEach(function (p) { if (p.o && !seen[p.o]) { seen[p.o] = 1; out.push(p.o); } });
    return out.sort(function (a, b) { return (OB[a] || a).localeCompare(OB[b] || b, "cs"); });
  }

  function matches(p) {
    if (state.o && p.o !== state.o) return false;
    if (state.s && p.s !== state.s) return false;
    if (state.k && (p.k || []).indexOf(state.k) < 0) return false;
    if (state.q) { if ((p.t || "").toLowerCase().indexOf(state.q.toLowerCase()) < 0) return false; }
    return true;
  }

  function render() {
    var rows = POZICE.filter(matches);
    list.innerHTML = rows.map(function (p, i) {
      var bonus = p.bonus ? ' <span class="pos-bonus">+ příspěvek ' + esc(p.bonus) + "</span>" : "";
      return '<a class="pos-row" href="' + DETAIL_BASE + p.id + '.html" style="animation-delay:' + Math.min(i * 22, 420) + 'ms">' +
        '<span class="t">' + esc(p.t) + bonus + "</span>" +
        '<span class="m field">' + esc(OB[p.o] || p.o) + "</span>" +
        '<span class="m level">' + esc(SEN[p.s] || p.s) + "</span>" +
        '<span class="m loc">' + esc((p.k || []).join(" / ")) + "</span>" +
        '<span class="arr" aria-hidden="true">→</span></a>';
    }).join("");
    if (emptyEl) emptyEl.hidden = rows.length !== 0;
    if (countEl) {
      var active = state.o || state.s || state.k || state.q;
      countEl.textContent = active
        ? "Zobrazeno " + rows.length + " z " + POZICE.length + " pozic"
        : POZICE.length + " otevřených pozic";
    }
  }

  /* ---- filtry: chips (details/summary) ---- */
  function buildChip(key, label, options) {
    // options: [{val, text}]
    var d = document.createElement("details");
    d.className = "f-chip";
    var sum = document.createElement("summary");
    sum.innerHTML = label + ': <b>vše</b>';
    d.appendChild(sum);
    var menu = document.createElement("div");
    menu.className = "f-menu";
    var all = [{ val: "", text: "vše" }].concat(options);
    all.forEach(function (opt) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = opt.text;
      if (state[key] === opt.val) b.classList.add("sel");
      b.addEventListener("click", function () {
        state[key] = opt.val;
        sum.querySelector("b").textContent = opt.text;
        d.dataset.active = opt.val ? "true" : "false";
        d.removeAttribute("open");
        menu.querySelectorAll("button").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        render();
      });
      menu.appendChild(b);
    });
    d.appendChild(menu);
    // zavři ostatní chipy při otevření
    d.addEventListener("toggle", function () {
      if (d.open) filtersEl.querySelectorAll("details.f-chip[open]").forEach(function (o) { if (o !== d) o.removeAttribute("open"); });
    });
    return d;
  }

  function buildFilters() {
    if (!filtersEl) return;
    filtersEl.innerHTML = "";

    var q = document.createElement("input");
    q.type = "search";
    q.className = "f-search";
    q.placeholder = "Hledat pozici…";
    q.setAttribute("aria-label", "Hledat pozici");
    q.addEventListener("input", function () { state.q = q.value; render(); });
    filtersEl.appendChild(q);

    filtersEl.appendChild(buildChip("o", "Obor", uniqObory().map(function (o) { return { val: o, text: OB[o] || o }; })));
    filtersEl.appendChild(buildChip("s", "Seniorita", Object.keys(SEN).map(function (s) { return { val: s, text: SEN[s] }; })));
    filtersEl.appendChild(buildChip("k", "Kraj", uniqKraje().map(function (k) { return { val: k, text: k }; })));

    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "f-reset";
    reset.textContent = "Zrušit filtry";
    reset.addEventListener("click", function () {
      state = { o: "", s: "", k: "", q: "" };
      q.value = "";
      buildFilters();
      render();
    });
    filtersEl.appendChild(reset);

    var cnt = document.createElement("span");
    cnt.className = "f-count";
    cnt.id = "pos-all-count";
    filtersEl.appendChild(cnt);
    countEl = cnt;
  }

  // zavři otevřené chipy při kliknutí mimo
  document.addEventListener("click", function (ev) {
    if (filtersEl && !ev.target.closest(".f-chip")) {
      filtersEl.querySelectorAll("details.f-chip[open]").forEach(function (o) { o.removeAttribute("open"); });
    }
  });

  buildFilters();
  render();
})();
