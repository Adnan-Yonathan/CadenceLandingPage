(function () {
  'use strict';

  var APP_ID = '6783027833';
  var APP_STORE_WEB = 'https://apps.apple.com/us/app/cadence-run-coach/id' + APP_ID;
  var APP_STORE_NATIVE = 'itms-apps://apps.apple.com/us/app/cadence-run-coach/id' + APP_ID;
  var ua = navigator.userAgent || '';
  var params;

  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }

  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMobile = isIOS || isAndroid || /Windows Phone|Mobile/i.test(ua);
  var isInstagram = /Instagram/i.test(ua);
  var device = isIOS ? 'ios' : isAndroid ? 'android' : isMobile ? 'mobile' : 'desktop';

  function campaignParams() {
    var result = new URLSearchParams();
    if (!params) return result;

    ['pt', 'ct', 'mt'].forEach(function (key) {
      var value = params.get(key);
      if (value) result.set(key, value);
    });

    // Apple campaign links require a provider token. If one is supplied on the
    // landing-page URL, turn the existing campaign/source tag into Apple's ct.
    if (result.has('pt') && !result.has('ct')) {
      var campaign = params.get('utm_campaign') || params.get('utm_source');
      if (campaign) result.set('ct', campaign.slice(0, 30));
    }
    if (result.has('pt') && !result.has('mt')) result.set('mt', '8');
    return result;
  }

  function withCampaign(base) {
    var attribution = campaignParams().toString();
    return attribution ? base + '?' + attribution : base;
  }

  var webStoreUrl = withCampaign(APP_STORE_WEB);
  var nativeStoreUrl = withCampaign(APP_STORE_NATIVE);

  function track(eventName, method) {
    var detail = {
      event: eventName,
      app_store_id: APP_ID,
      device: device,
      in_app_browser: isInstagram ? 'instagram' : 'none',
      handoff_method: method,
      campaign: params && (params.get('ct') || params.get('utm_campaign') || ''),
      source: params && (params.get('utm_source') || '')
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(detail);
    try { document.dispatchEvent(new CustomEvent('cadence:app-store-open', { detail: detail })); } catch (e) {}
  }

  function wireStoreLinks() {
    var links = document.querySelectorAll('a');
    Array.prototype.forEach.call(links, function (link) {
      if (link.href.indexOf('apps.apple.com') < 0 || link.href.indexOf('id' + APP_ID) < 0) return;
      link.href = webStoreUrl;
      link.addEventListener('click', function () { track('app_store_open', 'link'); });
    });

    var smartBanner = document.querySelector('meta[name=apple-itunes-app]');
    var attribution = campaignParams().toString();
    if (smartBanner && attribution) {
      smartBanner.content = 'app-id=' + APP_ID + ', affiliate-data=' + attribution;
    }
  }

  function showInstagramPrompt() {
    var prompt = document.getElementById('storeHandoff');
    if (!prompt) return;

    var instructions = prompt.querySelector('[data-handoff-instructions]');
    var button = prompt.querySelector('[data-handoff-open]');
    if (instructions) {
      instructions.textContent = isIOS
        ? 'Tap three dots in Instagram, then Open in external browser.'
        : 'Tap the menu in Instagram, then Open in external browser or Open in Chrome.';
    }
    if (button) {
      button.href = isIOS ? nativeStoreUrl : webStoreUrl;
      button.addEventListener('click', function () {
        track('app_store_open', isIOS ? 'native_scheme' : 'web_from_instagram');
      });
    }
    prompt.hidden = false;
    document.body.classList.add('store-handoff-visible');
    track('app_store_prompt_view', 'instagram_prompt');
  }

  function start() {
    wireStoreLinks();

    // ?stay=1 keeps the landing page available for mobile QA and sharing.
    if (params && params.get('stay') === '1') return;

    if (isMobile && isInstagram) {
      showInstagramPrompt();
      return;
    }

    // Cadence is currently an iOS app. Android visitors keep the mobile page;
    // iPhone and iPad visitors outside Instagram go straight to the App Store.
    if (isIOS) {
      var alreadySent = false;
      try {
        alreadySent = sessionStorage.getItem('cadence:sentToAppStore') === '1';
        if (!alreadySent) sessionStorage.setItem('cadence:sentToAppStore', '1');
      } catch (e) {}
      if (!alreadySent) {
        track('app_store_open', 'automatic');
        window.location.replace(webStoreUrl);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
