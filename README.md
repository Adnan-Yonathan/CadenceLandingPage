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

- Mobile visitors to the root page go directly to the App Store before the
  landing page renders.
- `landing-mobile.html` remains available for old inbound links but immediately
  redirects every visitor to the same App Store product page.
- Incoming Apple campaign parameters (`pt`, `ct`, and `mt`) carry through to
  the redirect URL. With `pt` present, an
  incoming `utm_campaign` or `utm_source` supplies `ct` when omitted.

Apple attribution needs the provider token from App Store Connect. Example:
`https://cadencerun.app/?pt=PROVIDER_TOKEN&ct=instagram_reels&mt=8`.

## Campaign links and PostHog

`assets/js/attribution.js` reports to the same PostHog project as the iOS app,
so a web visit and the install it produced sit in one funnel. Every link you
hand out is tracked by its query string — no per-link setup, no redirect table.

Full form, for anything paid or worth breaking down by placement:

```
https://cadencerun.app/?utm_source=tiktok&utm_medium=bio&utm_campaign=aug26_morning
```

Short form, for links typed by hand into a bio or a QR code. `ref` is recorded
verbatim and also fills `utm_source`, so both spellings group together:

```
https://cadencerun.app/?ref=tiktok_bio
```

Both work on the root page and on `onboarding.html` directly. The campaign is
remembered in `localStorage`, so a visitor who arrives on a tracked link, leaves,
and returns by typing the domain still converts against the campaign that
originally paid for them.

Two horizons land on every event:

| Property | Meaning |
| --- | --- |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `ref` | last touch — the link that produced this visit |
| `first_utm_source`, … | first touch — the link that first brought them here, ever |
| `utm_source: direct` | typed the domain; keeps those apart from genuine gaps |

Events:

| Event | Fired when |
| --- | --- |
| `web_landing_view` | the desktop page renders (mobile redirects before this) |
| `web_app_store_click` | an App Store link is clicked, with `position` |
| `web_onboarding_step` | each step is first reached, with `step`, `index`, `chapter` |
| `web_checkout_started` | the hand-off to Superwall, after `identify` by email |
| `trial_started` | Stripe `checkout.session.completed` — from the Worker |
| `subscription_paid` | Stripe `invoice.payment_succeeded` with a non-zero amount |

The campaign also rides to Superwall: `checkout()` forwards the whole query
string and tops it up from the remembered campaign when the current URL carries
none. Apple's `pt`/`ct`/`mt` are untouched by any of this.

### Break the funnel down by PERSON property

The last two steps come from Stripe, via a server that has never seen the link
that produced the sale. They carry no `ref` of their own. What makes them
attributable is that `cadenceIdentify()` copies the campaign onto the *person*
at checkout, and the Worker posts with `distinct_id` set to the same lowercased
email, so PostHog merges them onto that person.

So in the PostHog funnel, choose the breakdown under **Person properties → `ref`**
(or `utm_source`). Picking the identically named *event* property instead will
show every payment dropping out of the funnel — the events genuinely do not have
it. This is the single easiest thing to get wrong here.

### The Stripe relay

`worker/` holds a Cloudflare Worker that turns Stripe webhooks into the last two
events. It verifies Stripe's signature, needs no Stripe API key (every event it
handles carries the customer email in its own payload), and derives each
PostHog `uuid` from the Stripe event id so a webhook retry cannot double-count a
charge. Trial invoices are billed at zero and are filtered out of
`subscription_paid`, which is what keeps trials from reading as revenue.

Deployed at:

```
https://cadence-stripe-posthog.cadencerunningsupport.workers.dev
```

It runs on workers.dev rather than `cadencerun.app/stripe-webhook`. The apex
resolves straight to GitHub Pages with Cloudflare proxying off, and a Workers
route only fires on a proxied record — an apex route deploys without complaint
and then silently never runs. Moving it would mean putting Cloudflare in front
of the live site, which is not worth doing to receive a webhook.

Redeploy:

```
cd worker
npx wrangler deploy
node test/stripe-posthog.test.mjs
```

Secrets (`wrangler secret put <NAME>`):

| Secret | Purpose |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` | signature verification; accepts a comma-separated list so the test and live endpoints, which have different secrets, can both point here |
| `STRIPE_SECRET_KEY` | restricted key, Customers read only, for the email lookup |

Stripe endpoints subscribe to exactly two events — `checkout.session.completed`
and `invoice.payment_succeeded`. Creating one returns its `whsec_…` in the API
response, so it never has to be copied out of the dashboard by hand.

| Endpoint | Mode |
| --- | --- |
| `we_1U3g6vHkvkV1RG4MiL7AeLzP` | live |
| `we_1U3frLHkvkV1RG4MrCMTX6IT` | test |

Both point at the same Worker, which is why `STRIPE_WEBHOOK_SECRET` holds two
comma-separated secrets.

### The admin page

`admin.html` builds campaign links and shows the funnel for each one. It is
served from the public static host, so it is marked `noindex` and contains no
credential of any kind: link building runs entirely in the browser, and the
stats side is gated behind a token the operator pastes in, held in
`localStorage`.

Saved links live in `localStorage` too — this is a tool, not a database, and a
link needs no registering to work. Re-saving a tag replaces the old entry rather
than stacking a duplicate, since the tag is the identity.

Stats come from `GET /stats?ref=…&days=…` on the Worker, which needs three
secrets beyond the webhook ones:

| Secret | Purpose |
| --- | --- |
| `ADMIN_TOKEN` | bearer token the admin page sends; anything reachable from a public page has to prove itself |
| `POSTHOG_PERSONAL_KEY` | personal API key (`phx_…`), scope `query:read` — full project read, which is exactly why it lives here and never in the page |
| `POSTHOG_PROJECT_ID` | numeric project id |

The query counts `ref` as an event property OR a person property in one pass,
because browser events carry it directly while the Stripe events inherit it from
the person.

### How a link reaches a payment

No email and no name cross the paywall. `attribution.js` exposes PostHog's
visitor id, onboarding appends it to the Superwall URL as `app_user_id`, and
Superwall copies it into Stripe's `client_reference_id` and subscription
metadata. The Worker reads it back and posts under the same id, so the click and
the charge are the same person in PostHog.

Two shapes to know, both covered by tests:

- Checkout sessions carry the id at the top level; invoices nest it under
  `subscription_details.metadata`. Missing the nesting sends every *paid* event
  down the email fallback while trials join correctly.
- `$SuperwallAlias:<uuid>` is what the field holds when nothing was passed —
  Superwall's own alias, seen on app-paywall sessions. It is rejected as a join
  key, because joining on it invents a person instead of finding one.

Every relayed event carries `joined_by`. If `email` starts appearing on
web-originated sales, Superwall has stopped forwarding `app_user_id`.

## Notes

- Section reveals use scroll-driven animations (`animation-timeline: view()`),
  which no-op on browsers without support and are disabled under
  `prefers-reduced-motion`.
- Privacy and Terms point at the [CadenceLegal](https://adnan-yonathan.github.io/CadenceLegal/)
  GitHub Pages site.
