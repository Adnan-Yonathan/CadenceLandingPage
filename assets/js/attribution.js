// PostHog + campaign attribution for cadencerun.app.
//
// Every inbound link is tracked by its query string. The canonical shape is the
// standard UTM five:
//
//   https://cadencerun.app/?utm_source=tiktok&utm_medium=bio&utm_campaign=aug26
//
// PostHog reads those off the URL on its own and stores them as person
// properties ($initial_utm_source and friends). That alone only labels the
// FIRST event of a session, which is not enough here: the funnel is a
// single-page flow whose interesting events all happen after the landing view.
// So this file also registers the campaign as super properties, meaning every
// event this site sends — every onboarding step, the checkout hand-off —
// carries the source that produced it. That is what makes a PostHog funnel
// breakdown by `utm_source` actually work end to end.
//
// Two horizons are kept:
//
//   utm_*           last touch — the link that produced THIS visit
//   first_utm_*     first touch — the link that first brought them here, ever
//
// A runner who arrives from a TikTok bio, leaves, then comes back from a Reddit
// comment and converts should be legible as both. `register_once` is what makes
// first touch stick across visits.
//
// Apple's own campaign parameters (`pt`, `ct`, `mt`) ride along untouched —
// onboarding.js forwards the whole query string to Superwall, so App Store
// attribution is unaffected by anything here.
(function () {
  'use strict';

  // Project key for the same PostHog project the iOS app reports to, so web and
  // app events land in one funnel. Publishable by design: PostHog project keys
  // are write-only and meant to ship in client code.
  var POSTHOG_KEY = 'phc_pcHpeonjW8rkPZghWeBP34s8wofjH4qvKK6xeTwAGVGa';
  var POSTHOG_HOST = 'https://us.i.posthog.com';

  var STORE = 'cadence_attr_v1';
  // `ref` is the shorthand for hand-written links — /?ref=tiktok_bio is far
  // easier to paste into a bio than four utm params, and is normalised to
  // utm_source below so both spellings land in the same PostHog property.
  var FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function params() {
    try { return new URLSearchParams(location.search); } catch (e) { return null; }
  }

  // The campaign for this visit. Absent params are simply absent — never
  // written as empty strings, which would otherwise overwrite a stored first
  // touch with nothing.
  function currentTouch() {
    var q = params(), touch = {};
    if (!q) return touch;
    FIELDS.forEach(function (f) {
      var v = (q.get(f) || '').trim();
      if (v) touch[f] = v;
    });
    var ref = (q.get('ref') || '').trim();
    if (ref && !touch.utm_source) touch.utm_source = ref;
    if (ref) touch.ref = ref;
    // Apple's campaign token doubles as a source when nothing else is given, so
    // App Store links stay attributable without a second set of params.
    var ct = (q.get('ct') || '').trim();
    if (ct && !touch.utm_campaign) touch.utm_campaign = ct;
    return touch;
  }

  function stored() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
  }

  // Last touch persists so the campaign survives the landing page → onboarding
  // navigation even for a visitor who lands on a link that carries the params
  // and then walks a flow that does not.
  function remember(touch) {
    var prev = stored();
    var next = { first: prev.first, last: Object.keys(touch).length ? touch : prev.last };
    if (!next.first && Object.keys(touch).length) next.first = touch;
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch (e) {}
    return next;
  }

  var touch = currentTouch();
  var attr = remember(touch);

  // The official PostHog browser snippet, verbatim apart from formatting.
  !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);

  window.posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Anonymous visitors are counted but not given a person profile until the
    // funnel identifies them by email, which keeps the billable person count to
    // people who actually entered the flow.
    person_profiles: 'identified_only',
    // The landing page fires its own view event below, and onboarding.html is a
    // single URL for thirty steps, so PostHog's automatic pageview says almost
    // nothing here. Step events carry the funnel instead.
    capture_pageview: false,
    disable_session_recording: true
  });

  var superProps = {};
  FIELDS.concat(['ref']).forEach(function (f) {
    if (attr.last && attr.last[f]) superProps[f] = attr.last[f];
  });
  // Landing pages carry no campaign when someone types the domain directly.
  // Labelling those `direct` rather than leaving the property missing keeps the
  // PostHog breakdown from collapsing them into "none" alongside genuine gaps.
  if (!superProps.utm_source) superProps.utm_source = 'direct';
  window.posthog.register(superProps);

  var firstProps = {};
  FIELDS.concat(['ref']).forEach(function (f) {
    if (attr.first && attr.first[f]) firstProps['first_' + f] = attr.first[f];
  });
  if (Object.keys(firstProps).length) window.posthog.register_once(firstProps);

  // The one seam the rest of the site uses. Analytics must never be able to
  // break the funnel, so every call is wrapped.
  window.cadenceTrack = function (event, props) {
    try { window.posthog.capture(event, props || {}); } catch (e) {}
  };

  // The campaign, for anything that needs to forward it (the checkout hand-off,
  // the answer stash) rather than just report it.
  window.cadenceAttribution = function () {
    return { first: attr.first || {}, last: attr.last || {} };
  };

  // PostHog's own id for this browser. It is handed to Superwall as
  // `app_user_id` at the checkout boundary, which puts it into Stripe's
  // `client_reference_id` and into subscription metadata as `_sw_app_user_id` —
  // so the payment webhook comes back carrying the exact id the web session
  // used. That is what lets a link be followed all the way to a charge without
  // ever collecting an email or matching a name.
  window.cadenceVisitorId = function () {
    try { return window.posthog.get_distinct_id() || ''; } catch (e) { return ''; }
  };

  // Called at the checkout hand-off. Identifying on the id the visitor already
  // has is not a rename — it exists to create the person profile, which
  // `person_profiles: 'identified_only'` otherwise withholds. Without a profile
  // there is nowhere for the campaign to live, and the Stripe events that
  // arrive later would have nothing to attach to.
  //
  // The campaign is copied onto the PERSON, not just the event. Everything past
  // this point happens off the web: Stripe posts the trial and the charge from
  // a server that never saw the link. Those events can only carry the campaign
  // if it lives on the person they merge into — so a funnel ending in a payment
  // must be broken down by the PERSON property (`ref` / `utm_source`), not the
  // event property of the same name. First touch is $set_once so a later visit
  // on a different link cannot rewrite who originally earned the runner.
  window.cadenceIdentify = function () {
    try {
      var id = window.cadenceVisitorId();
      if (id) window.posthog.identify(id, superProps, firstProps);
    } catch (e) {}
  };
})();
