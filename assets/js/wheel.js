(function () {
  'use strict';

  var entries = [
    { main: '5K', note: 'Steady effort' },
    { main: '10K', note: 'Hold the pace' },
    { main: '1 hour', note: 'Time on feet' },
    { main: '8K', note: 'Comfortably hard' },
    { main: '15K', note: 'Bring water' },
    { main: '6K', note: 'One more than usual' },
    { main: '45 min', note: 'Hills if you have them' },
    { main: '12K', note: 'Settle in early' }
  ];

  var passes = 3;
  var strand = document.getElementById('reel-strand');
  var button = document.getElementById('spin-button');
  var result = document.getElementById('result');
  var band = document.querySelector('.landing-band');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var landingIndex = Math.floor(Math.random() * entries.length);
  var hasSpun = false;

  function row(entry) {
    var node = document.createElement('div');
    node.className = 'reel-row';
    var main = document.createElement('div');
    main.className = 'reel-main';
    main.textContent = entry.main;
    var note = document.createElement('div');
    note.className = 'reel-note';
    note.textContent = entry.note;
    node.appendChild(main);
    node.appendChild(note);
    return node;
  }

  for (var pass = 0; pass < passes + 4; pass += 1) {
    entries.forEach(function (entry) { strand.appendChild(row(entry)); });
  }

  function rowHeight() {
    return strand.firstElementChild
      ? strand.firstElementChild.getBoundingClientRect().height
      : 106;
  }

  function moveTo(offset, animate) {
    strand.style.transition = animate
      ? 'transform 3.2s cubic-bezier(.08,.72,.04,1.03), filter 3.2s ease-out'
      : 'none';
    strand.style.transform = 'translateY(' + (-offset * rowHeight()) + 'px)';
  }

  function restingOffset() { return entries.length + landingIndex - 1; }
  function spinOffset() { return entries.length * (passes + 1) + landingIndex - 1; }

  moveTo(restingOffset(), false);
  window.addEventListener('resize', function () {
    moveTo(hasSpun ? spinOffset() : restingOffset(), false);
  });

  button.addEventListener('click', function () {
    if (hasSpun) return;
    hasSpun = true;
    button.disabled = true;
    button.querySelector('span').textContent = 'Spinning…';
    result.textContent = '';

    if (window.cadenceTrack) window.cadenceTrack('web_wheel_spin');

    if (reducedMotion.matches) {
      moveTo(spinOffset(), false);
      finish();
      return;
    }

    strand.style.filter = 'blur(3px)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        strand.style.filter = 'blur(0)';
        moveTo(spinOffset(), true);
      });
    });
    window.setTimeout(finish, 3200);
  });

  function finish() {
    var landed = entries[landingIndex];
    band.classList.add('flash');
    result.textContent = landed.main + ' — ' + landed.note;
    button.classList.add('is-done');
    button.disabled = true;
    if (navigator.vibrate) navigator.vibrate(45);
    if (window.cadenceTrack) {
      window.cadenceTrack('web_wheel_landed', {
        target: landed.main,
        note: landed.note,
        tier: 'joe'
      });
    }
  }
}());
