// Scrubs the "How it works" carousel against scroll position: the track is
// three screens tall and the phones slide, scale and fade as it passes.
//
// Ported from the design handoff with two changes for production:
//   1. The animation loop only runs while the track is on screen. The handoff
//      ran an unconditional requestAnimationFrame loop for the life of the page,
//      which keeps a core busy (and a laptop fan going) long after the section
//      has scrolled away.
//   2. It stands down under Reduce Motion. The stylesheet collapses the track
//      into a plain stacked list there, and inline transforms would fight it.
(function () {
  var slides, caps, dots, track, ready = false, last = -1, running = false;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function frame() {
    if (!ready) return;
    var r = track.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    var p = span > 0 ? (-r.top) / span : 0;
    p = Math.max(0, Math.min(1, p));

    var n = slides.length;
    var pos = p * (n - 1);
    var gap = (slides[0].offsetWidth || 260) * 0.88;

    for (var i = 0; i < n; i++) {
      var d = i - pos;
      var a = Math.min(Math.abs(d), 1.6);
      slides[i].style.transform = 'translateX(' + (d * gap).toFixed(2) + 'px) scale(' + (1 - Math.min(a, 1) * 0.18).toFixed(3) + ')';
      slides[i].style.opacity = Math.abs(d) > 1.7 ? 0 : (1 - Math.min(a, 1) * 0.6).toFixed(3);
      slides[i].style.zIndex = 10 - Math.round(Math.abs(d) * 10);
    }
    for (var j = 0; j < caps.length; j++) {
      var o = Math.max(0, 1 - Math.abs(j - pos) * 1.9);
      caps[j].style.opacity = o.toFixed(3);
      caps[j].style.transform = 'translateY(' + ((1 - o) * 12).toFixed(1) + 'px)';
    }
    var near = Math.round(pos);
    if (near !== last) {
      last = near;
      for (var k = 0; k < dots.length; k++) {
        dots[k].style.width = k === near ? '28px' : '8px';
        dots[k].style.background = k === near ? '#a3d13a' : 'rgba(241,240,228,0.24)';
      }
    }
  }

  function loop() {
    if (!running) return;
    frame();
    requestAnimationFrame(loop);
  }

  function init() {
    if (ready) return true;
    track = document.querySelector('.cad-track');
    slides = document.querySelectorAll('.cad-slide');
    caps = document.querySelectorAll('.cad-cap');
    dots = document.querySelectorAll('.cad-dot');
    if (!track || !slides.length || !caps.length) return false;
    ready = true;

    // Scroll and resize keep it correct; the rAF loop only smooths the frames
    // in between, so it is only worth running while the section is visible.
    window.addEventListener('scroll', frame, { passive: true });
    document.addEventListener('scroll', frame, { passive: true, capture: true });
    window.addEventListener('resize', frame);

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        var visible = entries[0].isIntersecting;
        if (visible && !running) { running = true; loop(); }
        else if (!visible) { running = false; frame(); }
      }, { rootMargin: '200px 0px' }).observe(track);
    } else {
      running = true;
      loop();
    }
    frame();
    return true;
  }

  var tries = 0;
  var iv = setInterval(function () {
    if (init() || ++tries > 200) clearInterval(iv);
  }, 100);
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
