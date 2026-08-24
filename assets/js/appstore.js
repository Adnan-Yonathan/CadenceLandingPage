// App Store links, and what is left of the Instagram problem.
//
// There used to be one: a link opened from an Instagram bio runs in a WKWebView
// Instagram owns, and for a long time that webview refused to hand off to the
// App Store — `target="_blank"` ignored, `window.open()` null, the badge dead.
// This file existed to route around it with the `itms-apps://` scheme and, when
// even that was swallowed, to teach the two taps out of the webview by hand.
//
// Instagram fixed it. A plain `apps.apple.com` link opens the store from inside
// the in-app browser like it does anywhere else, so there is nothing left to
// route around: links navigate normally and this file only records the tap.
// The in-app browser is still detected, because which app a tap came from is
// worth knowing — but it no longer changes what happens.
(function () {
  'use strict';

  // Matching on the app's own token rather than on "not Safari". The set of
  // real browsers is open-ended and misjudging one would mislabel it.
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

  // Kept returning false — callers still ask whether navigation was taken over,
  // and now the answer is always no.
  function openStore(position) {
    if (window.cadenceTrack) {
      window.cadenceTrack('web_app_store_click', {
        position: position || 'unlabelled',
        in_app_browser: inAppBrowser() || 'none'
      });
    }
    return false;
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
