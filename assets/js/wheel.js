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

  var passes = 5;
  var spinDuration = 5200;
  var strand = document.getElementById('reel-strand');
  var button = document.getElementById('spin-button');
  var result = document.getElementById('result');
  var band = document.querySelector('.landing-band');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var landingIndex = Math.floor(Math.random() * entries.length);
  var hasSpun = false;
  var audioContext = null;
  var lastTickRow = null;
  var lastTickAt = 0;

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
      ? 'transform ' + spinDuration + 'ms cubic-bezier(.08,.72,.04,1.03), filter ' + spinDuration + 'ms ease-out'
      : 'none';
    strand.style.transform = 'translateY(' + (-offset * rowHeight()) + 'px)';
  }

  function prepareAudio() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function tick() {
    if (!audioContext || audioContext.state !== 'running') return;

    var now = audioContext.currentTime;
    var oscillator = audioContext.createOscillator();
    var gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1120, now);
    oscillator.frequency.exponentialRampToValueAtTime(760, now + .018);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.075, now + .002);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .026);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + .03);
  }

  function trackTicks(startedAt) {
    if (!hasSpun) return;

    var matrix = new DOMMatrixReadOnly(window.getComputedStyle(strand).transform);
    var currentRow = Math.floor(Math.abs(matrix.m42) / rowHeight());
    var now = performance.now();

    if (currentRow !== lastTickRow && now - lastTickAt > 38) {
      tick();
      lastTickRow = currentRow;
      lastTickAt = now;
    }

    if (now - startedAt < spinDuration) {
      requestAnimationFrame(function () { trackTicks(startedAt); });
    }
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
    prepareAudio();
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
        lastTickRow = null;
        lastTickAt = 0;
        trackTicks(performance.now());
      });
    });
    window.setTimeout(finish, spinDuration);
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
