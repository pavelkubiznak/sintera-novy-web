/* SINTERA — filtrování pozic (čistý klientský JS, bez závislostí) */
(function(){
  "use strict";

  var state = { q:"", obory:new Set(), kraj:"", sen:"" };

  /* --- elementy --- */
  var elQ      = document.getElementById("fQ");
  var elKraj   = document.getElementById("fKraj");
  var elChips  = document.getElementById("fChips");
  var elSeg    = document.getElementById("fSeg");
  var elGrid   = document.getElementById("posGrid");
  var elCnt    = document.getElementById("posCnt");
  var elEmpty  = document.getElementById("posEmpty");
  var elReset  = document.getElementById("fReset");
  var elReset2 = document.getElementById("fReset2");

  /* --- URL parametry (q, obor, kraj, sen) --- */
  var params = new URLSearchParams(window.location.search);
  if(params.get("q"))    { state.q = params.get("q"); elQ.value = state.q; }
  if(params.get("obor") && OBORY[params.get("obor")]) state.obory.add(params.get("obor"));
  if(params.get("kraj") && KRAJE.indexOf(params.get("kraj")) > -1) state.kraj = params.get("kraj");
  if(params.get("sen") && SENIORITY[params.get("sen")]) state.sen = params.get("sen");

  /* --- normalizace (bez diakritiky, lowercase) --- */
  function norm(s){
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  }

  /* --- filtr --- */
  function matches(p){
    if(state.q && norm(p.t + " " + p.k.join(" ") + " " + OBORY[p.o]).indexOf(norm(state.q)) === -1) return false;
    if(state.obory.size && !state.obory.has(p.o)) return false;
    if(state.kraj && p.k.indexOf(state.kraj) === -1) return false;
    if(state.sen && p.s !== state.sen) return false;
    return true;
  }

  function active(){
    return !!(state.q || state.obory.size || state.kraj || state.sen);
  }

  /* --- render --- */
  function esc(s){
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function pinIcon(){
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  }

  function card(p, i){
    var tags = '<span class="p-tag cop">' + esc(OBORY[p.o]) + '</span>' +
               '<span class="p-tag">' + esc(SENIORITY[p.s]) + '</span>';
    var bonus = p.bonus ? '<span class="bonus">Příspěvek ' + esc(p.bonus) + '</span>' : '';
    return '<article class="pos reveal in" style="transition-delay:' + Math.min(i*40,240) + 'ms">' +
      bonus +
      '<div class="p-tags">' + tags + '</div>' +
      '<h3>' + esc(p.t) + '</h3>' +
      '<div class="p-meta">' + pinIcon() + '<span>' + esc(p.k.join(" / ")) + '</span></div>' +
      '<a class="p-go" href="pozice-detail.html?id=' + p.id + '">Detail pozice <span class="arr">→</span></a>' +
    '</article>';
  }

  var sorted = POZICE.slice().sort(function(a,b){ return b.id - a.id; });

  function render(){
    var res = sorted.filter(matches);
    elGrid.innerHTML = res.map(card).join("");
    elCnt.innerHTML = res.length === POZICE.length
      ? 'Aktuálně obsazujeme <em>' + POZICE.length + '</em> pozic'
      : 'Nalezeno <em>' + res.length + '</em> z ' + POZICE.length + ' pozic';
    elEmpty.style.display = res.length ? "none" : "block";
    elGrid.style.display = res.length ? "" : "none";
    elReset.classList.toggle("show", active());
    renderChips();
    renderSeg();
  }

  /* --- obory chips (s počty) --- */
  function countObor(key){
    return POZICE.filter(function(p){ return p.o === key; }).length;
  }
  function renderChips(){
    var html = "";
    Object.keys(OBORY).forEach(function(key){
      var on = state.obory.has(key);
      html += '<button class="chip' + (on ? " on" : "") + '" data-obor="' + key + '">' +
              esc(OBORY[key]) + ' <span class="c">' + countObor(key) + '</span></button>';
    });
    elChips.innerHTML = html;
  }
  elChips.addEventListener("click", function(ev){
    var b = ev.target.closest("[data-obor]");
    if(!b) return;
    var key = b.dataset.obor;
    state.obory.has(key) ? state.obory.delete(key) : state.obory.add(key);
    render();
  });

  /* --- seniorita segmented --- */
  function renderSeg(){
    var html = '<button data-sen="" class="' + (state.sen === "" ? "on" : "") + '">Vše</button>';
    Object.keys(SENIORITY).forEach(function(key){
      html += '<button data-sen="' + key + '" class="' + (state.sen === key ? "on" : "") + '">' + SENIORITY[key] + '</button>';
    });
    elSeg.innerHTML = html;
  }
  elSeg.addEventListener("click", function(ev){
    var b = ev.target.closest("[data-sen]");
    if(!b) return;
    state.sen = b.dataset.sen;
    render();
  });

  /* --- kraj select --- */
  KRAJE.forEach(function(k){
    var o = document.createElement("option");
    o.value = k; o.textContent = k;
    if(k === state.kraj) o.selected = true;
    elKraj.appendChild(o);
  });
  elKraj.addEventListener("change", function(){ state.kraj = elKraj.value; render(); });

  /* --- fulltext --- */
  var deb;
  elQ.addEventListener("input", function(){
    clearTimeout(deb);
    deb = setTimeout(function(){ state.q = elQ.value.trim(); render(); }, 160);
  });

  /* --- reset --- */
  function reset(){
    state.q = ""; state.obory.clear(); state.kraj = ""; state.sen = "";
    elQ.value = ""; elKraj.value = "";
    render();
  }
  elReset.addEventListener("click", reset);
  if(elReset2) elReset2.addEventListener("click", reset);

  render();
})();
