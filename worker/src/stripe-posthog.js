// Stripe → PostHog relay for the cadencerun.app web funnel.
//
// The web funnel ends at the Superwall hand-off: the browser can see a runner
// reach checkout and nothing after it. Trial starts and charges happen on
// Stripe's side, so the last two steps of the funnel can only arrive here, from
// a server that has never seen the link that produced them.
//
// Which is why the join key matters more than anything else in this file.
//
// The primary key is PostHog's own visitor id. The browser hands it to Superwall
// as `app_user_id` at the checkout boundary; Superwall copies it into Stripe's
// `client_reference_id` and subscription metadata; it arrives back here on the
// webhook. No email, no name, no personal data crosses the boundary — the same
// id that counted the click counts the charge. Email remains as a fallback for
// sessions that never went through the web funnel, such as the app's own
// paywall, where no visitor id was ever passed.
//
// Either way the event merges onto a person who already carries `ref` and
// `utm_source` as person properties. Build the funnel breakdown on the PERSON
// property, not the event property: these events do not carry the link, they
// inherit it.
//
// No Stripe SDK. The only call back to Stripe is the customer lookup, and only
// when both ids above came up empty.

const TOLERANCE_SECONDS = 300;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight first, before any route that could reject it. A CORS preflight
    // carries no Authorization header by design, so letting it reach /stats
    // means answering the browser's permission question with 401 — and the
    // browser then refuses to send the real request at all.
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), origin);
    }

    // The admin page's read side. Kept on this Worker rather than in the page
    // because answering it needs a PostHog PERSONAL api key — full read access
    // to the project — which must never be shipped to a browser. That reason
    // still holds even though the endpoint itself is now unauthenticated: what
    // it returns is aggregate counts for one tag, not the key that produced them.
    if (url.pathname === '/stats') {
      return withCors(await stats(url, env), origin);
    }

    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }

    // The raw body, byte for byte. Stripe signs the exact bytes it sent, so
    // this must be read before any JSON parsing and never re-serialised.
    const raw = await request.text();
    const signature = request.headers.get('Stripe-Signature') || '';

    const ok = await verify(raw, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!ok) {
      // Anyone who can reach this URL can otherwise mint fake revenue in the
      // funnel, so an unverified body is refused before it is even parsed.
      return new Response('bad signature', { status: 400 });
    }

    let event;
    try {
      event = JSON.parse(raw);
    } catch (e) {
      return new Response('bad json', { status: 400 });
    }

    const captures = translate(event);

    // Invoices do not always inline the address — `customer_email` is null on a
    // real paid invoice whenever the customer record holds the email instead.
    // Dropping those would lose exactly the events the funnel exists to count,
    // so the customer is looked up when, and only when, the payload came up
    // short. Without STRIPE_SECRET_KEY this degrades to the old behaviour.
    // Resolution order matters. The visitor id is exact and free; the email is
    // a guess that happens to be usually right; the lookup costs a round trip
    // to Stripe. Try them in that order and stop at the first that works.
    const resolved = [];
    for (const c of captures) {
      const id = c.visitorId || c.email || (await lookupEmail(c.customer, env));
      if (id) resolved.push({ ...c, distinctId: id, joined_by: c.visitorId ? 'visitor_id' : 'email' });
    }

    // Nothing to report is a success. Stripe retries anything non-2xx, and an
    // event type we do not care about would otherwise be retried forever.
    if (!resolved.length) {
      return new Response('ignored', { status: 200 });
    }

    try {
      await Promise.all(resolved.map((c) => send(c, event, env)));
    } catch (e) {
      // A 500 asks Stripe to retry. PostHog dedupes on the uuid below, so a
      // retry that partially succeeded the first time cannot double-count.
      return new Response('relay failed', { status: 500 });
    }

    return new Response('ok', { status: 200 });
  }
};

// ---------------------------------------------------------------------------
// Admin stats
// ---------------------------------------------------------------------------

// The admin page carries no credential, so the origin allowlist is the only
// thing standing between this endpoint and every other site on the internet.
// It is a weak lock — curl ignores CORS entirely — but it does stop a page the
// operator did not write from reading these numbers in their browser.
const ALLOWED_ORIGINS = [
  'https://cadencerun.app',
  'http://localhost:4173'
];

function withCors(res, origin) {
  const h = new Headers(res.headers);
  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Vary', 'Origin');
  }
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return new Response(res.body, { status: res.status, headers: h });
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// The funnel for one link, counted straight out of PostHog.
//
// `ref` lives in two different places depending on who sent the event: as an
// event property on everything the browser fires, and as a person property on
// the Stripe event, which inherits it from the person rather than carrying it.
// Keeping those branches event-specific matters: a person's current ref can
// change, and must not retroactively relabel their earlier browser events.
async function stats(url, env) {
  const ref = (url.searchParams.get('ref') || '').trim();
  // Whitelist rather than escape. The ref is interpolated into a query, and the
  // set of characters a link tag ever legitimately needs is small enough that
  // refusing everything else is simpler than getting quoting right.
  //
  // Checked before the config below so a malformed ref always answers 400,
  // whether or not PostHog credentials happen to be present — an endpoint whose
  // rejection reason depends on unrelated config is a bad thing to debug.
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(ref)) {
    return json({ error: 'bad ref' }, 400);
  }

  if (!env.POSTHOG_PERSONAL_KEY || !env.POSTHOG_PROJECT_ID) {
    return json({ error: 'stats not configured: POSTHOG_PERSONAL_KEY / POSTHOG_PROJECT_ID unset' }, 503);
  }
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);

  const query = `
    SELECT event, count() AS c
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
      AND (
        (
          event IN ('web_tracking_link_click', 'web_landing_view', 'web_app_store_click', 'web_checkout_started')
          AND properties.ref = '${ref}'
        )
        OR (
          event IN ('trial_started', 'subscription_paid')
          AND person.properties.ref = '${ref}'
        )
      )
    GROUP BY event
  `;

  let res;
  try {
    res = await fetch(`https://us.posthog.com/api/projects/${env.POSTHOG_PROJECT_ID}/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.POSTHOG_PERSONAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } })
    });
  } catch (e) {
    return json({ error: 'posthog unreachable' }, 502);
  }

  if (!res.ok) {
    return json({ error: `posthog ${res.status}`, detail: (await res.text()).slice(0, 400) }, 502);
  }

  const data = await res.json();
  const counts = {};
  for (const row of data.results || []) counts[row[0]] = row[1];

  return json({
    ref,
    days,
    counts,
    // Named so the admin page does not have to know the event vocabulary.
    funnel: {
      // New links emit one common event on every supported destination. Older
      // links fall back to the strongest available pre-deployment signal.
      clicks: counts.web_tracking_link_click || counts.web_landing_view || counts.web_app_store_click || 0,
      // Apple does not report a confirmed install to this static website, so
      // "downloads" is the observable handoff into the App Store.
      downloads: counts.web_app_store_click || 0,
      paywall_views: counts.web_checkout_started || 0,
      // checkout.session.completed emits trial_started for every subscription,
      // including plans without a trial; this is the historical subscription
      // creation event name and keeps existing data reportable.
      subscriptions: counts.trial_started || 0,
      // Every non-zero invoice reported by Stripe, including renewals. The
      // billing_reason property on the underlying event can separate first
      // payments from renewal revenue in PostHog when needed.
      payments: counts.subscription_paid || 0
    }
  });
}

// Stripe's scheme: the header is `t=<unix>,v1=<hex hmac>`, and the signed
// payload is the timestamp and the raw body joined by a period. The timestamp
// is inside the signature, which is what makes the freshness check below
// meaningful rather than decorative.
// STRIPE_WEBHOOK_SECRET may hold several comma-separated secrets. Stripe signs
// with the secret of the endpoint that sent the event, so the test-mode and
// live endpoints have different ones — accepting a list is what lets both point
// at this Worker at once, and makes rotating a secret a two-step with no gap
// where events are being rejected.
async function verify(raw, header, secretList) {
  if (!secretList || !header) return false;
  const secrets = String(secretList).split(',').map((s) => s.trim()).filter(Boolean);
  for (const secret of secrets) {
    if (await verifyOne(raw, header, secret)) return true;
  }
  return false;
}

async function verifyOne(raw, header, secret) {
  if (!secret || !header) return false;

  let timestamp = '';
  const signatures = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    // Stripe sends one v1 per active signing secret during a secret rotation,
    // so every candidate has to be tried, not just the first.
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || !signatures.length) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${raw}`)
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some((s) => timingSafeEqual(s, expected));
}

// Comparing hex with === leaks where the first mismatch is by returning early.
// The difference is small over a network, but the fix is three lines.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Which Stripe events are worth a funnel step, and what each one is really
// saying. The email may be absent here; the caller resolves it before sending,
// so a capture is emitted whenever the event itself is interesting.
function translate(event) {
  const obj = (event.data && event.data.object) || {};
  const out = [];

  if (event.type === 'checkout.session.completed') {
    // The runner finished Stripe's checkout. For a trial-first price this is
    // the trial starting, not money moving — `invoice.payment_succeeded` below
    // is the one that means paid.
    {
      out.push({
        event: obj.subscription ? 'trial_started' : 'checkout_completed',
        email: emailOf(obj),
        visitorId: visitorIdOf(obj),
        customer: typeof obj.customer === 'string' ? obj.customer : '',
        properties: {
          ...superwallProps(obj),
          stripe_mode: obj.mode || '',
          stripe_subscription: obj.subscription || '',
          currency: obj.currency || '',
          // `amount_total` is what they agreed to, which on a trial is the
          // post-trial price rather than anything charged today.
          amount_committed: cents(obj.amount_total)
        }
      });
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    // Trial invoices are real invoices for zero. Letting those through would
    // report every trial as revenue and make the paid step meaningless.
    const paid = cents(obj.amount_paid);
    if (paid > 0) {
      out.push({
        event: 'subscription_paid',
        email: emailOf(obj),
        visitorId: visitorIdOf(obj),
        customer: typeof obj.customer === 'string' ? obj.customer : '',
        properties: {
          amount: paid,
          currency: obj.currency || '',
          // `subscription_create` is the first real charge — the conversion off
          // trial. `subscription_cycle` is a renewal. Same event, and this
          // property is what separates new revenue from recurring.
          billing_reason: obj.billing_reason || '',
          stripe_subscription: obj.subscription || '',
          stripe_invoice: obj.id || ''
        }
      });
    }
  }

  return out;
}

// The PostHog distinct id this event belongs to.
//
// First choice is the visitor id the web funnel handed to Superwall as
// `app_user_id`, which Superwall copies into `client_reference_id` and into
// metadata as `_sw_app_user_id`. When that is present the join is exact and
// needs no personal data at all: the same id that counted the click counts the
// charge.
//
// `$SuperwallAlias:<uuid>` is what that field holds when NOTHING was passed —
// Superwall's own generated alias, seen on sessions started from the mobile
// app. It is a real id but not one PostHog has ever seen, so joining on it
// would invent a person rather than find one. Rejected here, and the caller
// falls back to the email path for those.
// Checkout sessions carry it at the top level; invoices do not. Superwall writes
// it to the SUBSCRIPTION metadata, which an invoice exposes under
// `subscription_details`. Missing that nesting is what would quietly send every
// paid event down the email fallback while the trial events joined perfectly.
function visitorIdOf(obj) {
  const subMeta = (obj.subscription_details && obj.subscription_details.metadata) || {};
  const meta = obj.metadata || {};
  const raw =
    meta._sw_app_user_id ||
    subMeta._sw_app_user_id ||
    obj.client_reference_id ||
    '';
  const id = String(raw).trim();
  if (!id || id.startsWith('$SuperwallAlias:')) return '';
  return id;
}

// The fallback for sessions that never went through the web funnel — an app
// paywall, or a Superwall config that dropped the parameter. Stripe only has
// the address once the session completes; it is null while open or expired.
function emailOf(obj) {
  const candidate = (obj.customer_details && obj.customer_details.email) || obj.customer_email || '';
  return candidate ? String(candidate).trim().toLowerCase() : '';
}

// The one call back to Stripe, made only when the payload had no address of its
// own. A restricted key with read access to Customers is enough — nothing here
// writes, and a key that cannot write is a key worth far less if the Worker is
// ever compromised. Absent key means no lookup, not a failure: a missing email
// costs one unattributed sale, while throwing here would make Stripe retry a
// webhook that can never succeed.
async function lookupEmail(customerId, env) {
  if (!customerId || !env.STRIPE_SECRET_KEY) return '';
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    if (!res.ok) return '';
    const customer = await res.json();
    return customer.email ? String(customer.email).trim().toLowerCase() : '';
  } catch (e) {
    return '';
  }
}

// Superwall's identifiers, recorded on every event so a payment that failed to
// join by email can still be traced back by hand — and so the same alias can be
// used later if the join is ever moved off email.
function superwallProps(obj) {
  const meta = obj.metadata || {};
  const alias = meta._sw_app_user_id || obj.client_reference_id || '';
  return {
    superwall_alias: String(alias).replace(/^\$SuperwallAlias:/, ''),
    superwall_offer_kind: meta._sw_offer_kind || '',
    superwall_trial_days: meta._sw_trial_period_days || ''
  };
}

function cents(v) {
  return typeof v === 'number' ? v / 100 : 0;
}

async function send(capture, event, env) {
  const res = await fetch(`${env.POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.POSTHOG_KEY,
      event: capture.event,
      distinct_id: capture.distinctId,
      // Stripe retries on any non-2xx, and a retry after a partial success
      // would otherwise post the same charge twice. PostHog treats a repeated
      // uuid as the same event, so the id has to be derived from Stripe's event
      // id rather than generated fresh on each attempt.
      uuid: await uuidFrom(`${event.id}:${capture.event}`),
      // Stripe's own timestamp, so a retry an hour later still lands the event
      // at the moment the money actually moved.
      timestamp: new Date((event.created || Date.now() / 1000) * 1000).toISOString(),
      properties: {
        ...capture.properties,
        source: 'stripe',
        // Which seam carried this event home. If `email` starts showing up on
        // web-originated sales, Superwall has stopped forwarding app_user_id.
        joined_by: capture.joined_by,
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        livemode: !!event.livemode
      }
    })
  });
  if (!res.ok) throw new Error(`posthog ${res.status}`);
}

// A stable UUIDv5-shaped id: same input, same id, on every retry.
async function uuidFrom(seed) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const b = [...new Uint8Array(digest)].slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
