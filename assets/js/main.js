/* SINTERA — shared UI */
(function(){
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* nav */
  var nav = document.getElementById("nav");
  function navState(){ nav.classList.toggle("scrolled", window.scrollY > 36); }
  window.addEventListener("scroll", navState, {passive:true});
  navState();

  /* mobile menu */
  var burger = document.getElementById("burger");
  if(burger){
    burger.addEventListener("click", function(){
      document.body.classList.toggle("menu-open");
    });
    document.querySelectorAll(".mobile-menu a").forEach(function(a){
      a.addEventListener("click", function(){ document.body.classList.remove("menu-open"); });
    });
  }

  /* reveal on scroll */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, {threshold:.16, rootMargin:"0px 0px -30px 0px"});
  document.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });

  /* gentle parallax for floating cards + hero dashes */
  var px = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var ticking = false;
  function parallax(){
    px.forEach(function(el){
      var sp = parseFloat(el.dataset.parallax);
      var r = el.getBoundingClientRect();
      var mid = r.top + r.height/2 - window.innerHeight/2;
      el.style.transform = "translateY(" + (-mid*sp).toFixed(1) + "px)";
    });
    ticking = false;
  }
  if(!reduced && px.length){
    window.addEventListener("scroll", function(){
      if(!ticking){ requestAnimationFrame(parallax); ticking = true; }
    }, {passive:true});
    parallax();
  }

  /* counters */
  function ease(t){ return 1 - Math.pow(1-t,3); }
  function runCounter(el){
    var to = parseFloat(el.dataset.to);
    if(reduced){ el.textContent = to; return; }
    var t0=null, dur=1400;
    function f(ts){
      if(!t0) t0=ts;
      var p=Math.min((ts-t0)/dur,1);
      el.textContent = Math.round(to*ease(p));
      if(p<1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }
  var cio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ runCounter(e.target); cio.unobserve(e.target); }
    });
  }, {threshold:.6});
  document.querySelectorAll("[data-to]").forEach(function(el){ cio.observe(el); });

  /* quick-find v hero → pozice.html?q= */
  var qf = document.getElementById("quickFind");
  if(qf){
    qf.addEventListener("submit", function(ev){
      ev.preventDefault();
      var q = (document.getElementById("quickQ").value || "").trim();
      window.location.href = "pozice.html" + (q ? "?q=" + encodeURIComponent(q) : "");
    });
  }

  /* rok */
  var yr = document.getElementById("yr");
  if(yr) yr.textContent = new Date().getFullYear();
})();
