# CadenceLandingPage

Landing page for [cadencerun.app](https://cadencerun.app) — an adaptive running coach.

A static, dependency-free page. Open `index.html` directly, or serve the folder:

```sh
npx serve .
```

## Layout

```
index.html              markup + icon sprite
assets/
  css/tokens.css        design tokens (colors)
  css/styles.css        page styles
images/
  logo.png              app icon — nav, footer, favicon, og:image
  recovery.png          hero + "Your body sets the pace"
  plan.png              "A plan that rewrites itself daily"
  coach.png             "A coach in your pocket"
  ghost.png             "Race a ghost"
  explore.png           "Explore routes"
  profile.png           "Streaks & ranks"
```

`images/IMG_9897.png`, `IMG_9899.png`, and `IMG_9902.png` are unused. `IMG_9899`
is a wordmark lockup (mark + "Cadence" on near-black) if you ever want to swap it
in for the separate icon-plus-text nav treatment.

Type is Hanken Grotesk with Nunito for the wordmark; icons are Material Symbols
Rounded. All three load from Google Fonts.

## Source

Ported from the Claude Design project [_"I want to create a landing page for
cadence"_](https://claude.ai/design/p/0c7e1580-75f8-498d-82a3-84480ed409d2),
specifically `Cadence.dc.html` — of which `Cadence-standalone.html` is the
compiled bundle.

Two things changed in the port:

- The design-doc runtime (`<x-dc>`, `<helmet>`, `dc-import`, `support.js`) is
  gone. The `PhoneShot` component is now the `.phone` block in `styles.css`.
- The source is fixed-width desktop. Type uses `clamp()` and the grids collapse
  at 1080px and 760px, so the page works on a phone.

Color values come from the project's design-system tokens and are reproduced
verbatim in `assets/css/tokens.css`.

The screenshots and logo in `images/` were supplied directly — they exceed the
design API's 256 KiB file-read limit, so they could not be pulled from the design
project programmatically.

The phone frame crops with `object-fit: cover` at a 1320×2760 ratio, anchored to
the top. The supplied screenshots are 1320px wide and slightly taller than that,
so a few pixels are trimmed off the bottom of each.

## App Store handoff

`assets/js/store-handoff.js` owns device detection and App Store links:

- Every mobile visitor outside an in-app browser goes immediately to the App
  Store product page. `?stay=1` disables the automatic handoff for QA.
- Instagram on iOS attempts the native App Store immediately and falls back to
  the standard HTTPS product page. Instagram on Android attempts to open that
  page in Chrome. App Store buttons use the native Store scheme on iOS so a
  user tap remains a reliable fallback. No intermediate prompt is shown.
- Incoming Apple campaign parameters (`pt`, `ct`, and `mt`) carry through to
  every store handoff URL. With `pt` present, an
  incoming `utm_campaign` or `utm_source` supplies `ct` when omitted.
- Handoffs push `app_store_open` to `window.dataLayer` and dispatch a
  `cadence:app-store-open` DOM event for the site's analytics tag to consume.

Apple attribution needs the provider token from App Store Connect. Example:
`https://cadencerun.app/?pt=PROVIDER_TOKEN&ct=instagram_reels&mt=8`.

## Notes

- Section reveals use scroll-driven animations (`animation-timeline: view()`),
  which no-op on browsers without support and are disabled under
  `prefers-reduced-motion`.
- Privacy and Terms point at the [CadenceLegal](https://adnan-yonathan.github.io/CadenceLegal/)
  GitHub Pages site.
