// Getting out of Instagram's browser and into the App Store.
//
// A link opened from an Instagram bio does not run in Safari. It runs in a
// WKWebView that Instagram owns, and that webview has no concept of a second
// window: `target="_blank"` is ignored and `window.open()` returns null. So the
// App Store badge looks broken — the tap registers and nothing happens. Same
// story in Facebook, TikTok and most other in-app browsers.
//
// The way out is not a new window at all. `itms-apps://` is a scheme the
// webview cannot render itself, so iOS takes it and hands it to the native App
// Store app, leaving the webview behind. That is a system-level handoff, which
// is exactly why it escapes a sandbox that `window.open` cannot.
//
// It is not guaranteed. Instagram changes this webview often, and a scheme that
// works today can be swallowed tomorrow. So every path here is timed: if the
// page is still visible shortly after the attempt, nothing happened, and the
// runner is shown how to escape by hand. The prompt is the floor, not the plan.
(function () {
  'use strict';

  var APP_ID = '6783027833';
  var WEB_URL = 'https://apps.apple.com/us/app/cadence-run-coach/id' + APP_ID;
  var SCHEME_URL = 'itms-apps://apps.apple.com/app/id' + APP_ID;

  // Matching on the app's own token rather than on "not Safari". The set of
  // real browsers is open-ended and misjudging one would send a perfectly
  // capable browser down the fallback path for no reason.
  var IN_APP = [
    ['instagram', /Instagram/i],
    ['facebook', /FBAN|FBAV|FB_IAB/i],
    ['tiktok', /musical_ly|BytedanceWebview|TikTok/i],
    ['snapchat', /Snapchat/i],
    ['twitter', /Twitter/i],
    ['linkedin', /LinkedInApp/i],
    ['pinterest', /Pinterest/i]
  ];

  function inAppBrowser() {
    var ua = navigator.userAgent || '';
    for (var i = 0; i < IN_APP.length; i++) {
      if (IN_APP[i][1].test(ua)) return IN_APP[i][0];
    }
    return '';
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    // iPadOS 13+ reports itself as a Mac, and the touch-point count is the
    // usual way to tell a real Mac from an iPad that is lying.
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  function track(props) {
    if (window.cadenceTrack) window.cadenceTrack('web_app_store_click', props);
  }

  // The escape hatch, shown only after an attempt has demonstrably failed.
  // Instagram's menu is the three dots in the corner; naming the exact control
  // matters more than any wording here, because the runner is being asked to
  // do something they have no reason to expect.
  function showPrompt(app) {
    if (document.getElementById('cad-escape')) return;

    var host = document.createElement('div');
    host.id = 'cad-escape';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-label', 'Open in your browser');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-end;' +
      'justify-content:center;background:rgba(7,16,9,.72);backdrop-filter:blur(3px);' +
      'font-family:Manrope,system-ui,sans-serif';

    var menu = app === 'instagram' || app === 'facebook' ? 'the ⋯ menu, top right' : 'the browser menu';

    host.innerHTML =
      '<div style="width:100%;max-width:460px;background:linear-gradient(145deg,#24401f,#1e3320);' +
      'border:1px solid rgba(241,240,228,.14);border-radius:22px 22px 0 0;padding:24px 22px ' +
      'max(24px,env(safe-area-inset-bottom));color:#f1f0e4;box-shadow:0 -20px 60px rgba(0,0,0,.5)">' +
      '<p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#a3d13a">One more tap</p>' +
      '<h2 style="margin:0 0 10px;font-size:22px;line-height:1.2;letter-spacing:-.03em">Open this in your browser</h2>' +
      '<p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#94a894">' +
      'This in-app browser can\'t open the App Store. Tap ' + menu + ', then <b style="color:#f1f0e4">Open in browser</b> — ' +
      'or copy the link and paste it into Safari.</p>' +
      '<button id="cad-escape-copy" style="width:100%;border:0;border-radius:999px;min-height:52px;' +
      'background:#a3d13a;color:#10200c;font:inherit;font-weight:800;font-size:16px;cursor:pointer">Copy link</button>' +
      '<button id="cad-escape-close" style="width:100%;margin-top:8px;border:0;background:none;' +
      'color:#94a894;font:inherit;font-weight:700;font-size:14px;padding:12px;cursor:pointer">Not now</button>' +
      '</div>';

    document.body.appendChild(host);

    document.getElementById('cad-escape-close').onclick = function () { host.remove(); };
    document.getElementById('cad-escape-copy').onclick = function () {
      var btn = this;
      var done = function () { btn.textContent = 'Copied — paste in Safari'; };
      // Clipboard access is not granted in every in-app webview, so the
      // execCommand path stays as a fallback rather than being assumed dead.
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(WEB_URL).then(done, function () { legacyCopy(WEB_URL, done); });
      } else {
        legacyCopy(WEB_URL, done);
      }
    };

    if (window.cadenceTrack) window.cadenceTrack('web_app_store_blocked', { app: app });
  }

  function legacyCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch (e) { /* the link is on screen either way */ }
  }

  // Returns true when it has taken over navigation, so the caller knows to
  // suppress the link's own default.
  function openStore(position) {
    var app = inAppBrowser();
    track({ position: position || 'unlabelled', in_app_browser: app || 'none' });

    if (!app || !isIOS()) return false;

    // If the handoff works, the App Store comes to the foreground and this page
    // goes hidden. Still being visible after the delay is the only trustworthy
    // sign it failed, because a webview that swallows a scheme reports no error.
    //
    // Checked at the moment the timer fires, rather than cancelled early by a
    // `pagehide` listener. `pagehide` is the wrong signal: it says the document
    // is being unloaded, not that the App Store opened, and an attempt that
    // fails can still tear the page down far enough to fire it. Cancelling on
    // it risks suppressing the prompt in exactly the case that needs it,
    // leaving a dead button and no way out. Visibility at fire time answers the
    // question actually being asked — is the runner still sitting here?
    setTimeout(function () {
      if (!document.hidden) showPrompt(app);
    }, 1500);

    try {
      window.location.href = SCHEME_URL;
    } catch (e) {
      showPrompt(app);
    }
    return true;
  }

  window.cadenceOpenAppStore = openStore;
  window.cadenceInAppBrowser = inAppBrowser;

  // Every App Store link on the page routes through the same logic, so a badge
  // added later needs no wiring of its own.
  window.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href*="apps.apple.com"]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        if (openStore(a.getAttribute('data-cta'))) ev.preventDefault();
      });
    });
  });
})();
