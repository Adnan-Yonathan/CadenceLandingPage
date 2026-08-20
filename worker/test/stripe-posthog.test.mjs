import worker from '../src/stripe-posthog.js';

const SECRET = 'whsec_testsecret123';
const env = {
  STRIPE_WEBHOOK_SECRET: SECRET,
  POSTHOG_HOST: 'https://posthog.test',
  POSTHOG_KEY: 'phc_test',
  POSTHOG_PERSONAL_KEY: 'phx_test',
  POSTHOG_PROJECT_ID: '12345'
};

let posted = [];
let stripeLookups = [];
let stripeCustomerEmail = null;
let posthogQueryResults = [];
let posthogQueries = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.stripe.com/')) {
    stripeLookups.push(String(url));
    if (!stripeCustomerEmail) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => ({ email: stripeCustomerEmail }) };
  }
  if (String(url).includes('/api/projects/') && String(url).endsWith('/query/')) {
    posthogQueries.push(JSON.parse(init.body).query.query);
    return { ok: true, status: 200, json: async () => ({ results: posthogQueryResults }) };
  }
  posted.push({ url, body: JSON.parse(init.body) });
  return { ok: true, status: 200 };
};

async function sign(raw, ts, secret = SECRET) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${raw}`));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function post(event, { badSig = false, ageSeconds = 0, secretKey = null } = {}) {
  posted = [];
  stripeLookups = [];
  env.STRIPE_SECRET_KEY = secretKey;
  const raw = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000) - ageSeconds;
  const sig = badSig ? 'deadbeef'.repeat(8) : await sign(raw, ts);
  const res = await worker.fetch(new Request('https://w.test', {
    method: 'POST',
    body: raw,
    headers: { 'Stripe-Signature': `t=${ts},v1=${sig}` }
  }), env);
  return { status: res.status, text: await res.text(), posted: [...posted] };
}

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

// 1. Valid trial-start checkout session
let r = await post({
  id: 'evt_1', type: 'checkout.session.completed', created: 1786551000, livemode: true,
  data: { object: { mode: 'subscription', subscription: 'sub_123', currency: 'usd',
    amount_total: 2999, customer_details: { email: '  Runner@Example.COM ' } } }
});
check('trial: 200', r.status === 200, r.text);
check('trial: event name', r.posted[0]?.body.event === 'trial_started', r.posted[0]?.body.event);
check('trial: email lowercased+trimmed', r.posted[0]?.body.distinct_id === 'runner@example.com', r.posted[0]?.body.distinct_id);
check('trial: amount in dollars', r.posted[0]?.body.properties.amount_committed === 29.99, r.posted[0]?.body.properties.amount_committed);
const uuid1 = r.posted[0]?.body.uuid;

// 2. Same event replayed -> identical uuid (dedupe)
r = await post({
  id: 'evt_1', type: 'checkout.session.completed', created: 1786551000, livemode: true,
  data: { object: { mode: 'subscription', subscription: 'sub_123', currency: 'usd',
    amount_total: 2999, customer_details: { email: 'runner@example.com' } } }
});
check('retry: stable uuid', r.posted[0]?.body.uuid === uuid1, `${uuid1} vs ${r.posted[0]?.body.uuid}`);

// 3. Zero-amount trial invoice must NOT count as paid
r = await post({
  id: 'evt_2', type: 'invoice.payment_succeeded', created: 1786551100, livemode: true,
  data: { object: { id: 'in_1', amount_paid: 0, currency: 'usd',
    billing_reason: 'subscription_create', customer_email: 'runner@example.com' } }
});
check('zero invoice: ignored', r.status === 200 && r.posted.length === 0, `posted ${r.posted.length}`);

// 4. Real charge -> subscription_paid
r = await post({
  id: 'evt_3', type: 'invoice.payment_succeeded', created: 1786551200, livemode: true,
  data: { object: { id: 'in_2', amount_paid: 2999, currency: 'usd', subscription: 'sub_123',
    billing_reason: 'subscription_create', customer_email: 'Runner@Example.com' } }
});
check('paid: event name', r.posted[0]?.body.event === 'subscription_paid', r.posted[0]?.body.event);
check('paid: same distinct_id as trial', r.posted[0]?.body.distinct_id === 'runner@example.com', r.posted[0]?.body.distinct_id);
check('paid: amount', r.posted[0]?.body.properties.amount === 29.99, r.posted[0]?.body.properties.amount);
check('paid: billing_reason', r.posted[0]?.body.properties.billing_reason === 'subscription_create', '');
check('paid: stripe timestamp used', r.posted[0]?.body.timestamp.startsWith('2026-08-12'), r.posted[0]?.body.timestamp);

// 5. Bad signature rejected
r = await post({ id: 'evt_4', type: 'checkout.session.completed', created: 1, data: { object: {} } }, { badSig: true });
check('bad signature: 400', r.status === 400 && r.posted.length === 0, `${r.status} ${r.text}`);

// 6. Replay outside tolerance rejected
r = await post({ id: 'evt_5', type: 'checkout.session.completed', created: 1, data: { object: {} } }, { ageSeconds: 900 });
check('stale timestamp: 400', r.status === 400, `${r.status}`);

// 7. Unhandled event type acknowledged, not retried
r = await post({ id: 'evt_6', type: 'customer.created', created: 1786551300, data: { object: { email: 'x@y.com' } } });
check('unhandled type: 200 + no post', r.status === 200 && r.posted.length === 0, `${r.status} ${r.posted.length}`);

// 8. Missing email -> nothing posted (cannot join, must not invent a person)
r = await post({
  id: 'evt_7', type: 'invoice.payment_succeeded', created: 1786551400,
  data: { object: { id: 'in_3', amount_paid: 2999, billing_reason: 'subscription_cycle' } }
});
check('no email: ignored', r.status === 200 && r.posted.length === 0, `posted ${r.posted.length}`);

// 9. Real Superwall session shape: client_reference_id is an alias, NOT an email.
//    Must never be used as distinct_id; alias is recorded as a property instead.
r = await post({
  id: 'evt_8', type: 'checkout.session.completed', created: 1786551500,
  data: { object: {
    mode: 'subscription', subscription: 'sub_9', currency: 'usd', amount_total: 0,
    client_reference_id: '$SuperwallAlias:D559F08A-2BBC-419F-A80D-D3308DC5373B',
    customer_details: { email: 'runner@example.com' },
    metadata: {
      _sw_app_user_id: '$SuperwallAlias:D559F08A-2BBC-419F-A80D-D3308DC5373B',
      _sw_offer_kind: 'trial', _sw_trial_period_days: '3'
    }
  } }
});
check('superwall: joins on email not alias', r.posted[0]?.body.distinct_id === 'runner@example.com', r.posted[0]?.body.distinct_id);
check('superwall: alias prefix stripped', r.posted[0]?.body.properties.superwall_alias === 'D559F08A-2BBC-419F-A80D-D3308DC5373B', r.posted[0]?.body.properties.superwall_alias);
check('superwall: trial metadata kept', r.posted[0]?.body.properties.superwall_trial_days === '3', '');

// 10. Alias present but no email -> refuse to invent a person from the alias
r = await post({
  id: 'evt_9', type: 'checkout.session.completed', created: 1786551600,
  data: { object: { mode: 'subscription', subscription: 'sub_10',
    client_reference_id: '$SuperwallAlias:ABC-123', customer_details: null } }
});
check('alias without email: ignored', r.posted.length === 0, `posted ${r.posted.length}`);

// 11. The real CLI-fixture shape: paid invoice, customer_email null, customer set.
//     With a key, the email is recovered by lookup and the payment is counted.
const invoiceNoEmail = {
  id: 'evt_10', type: 'invoice.payment_succeeded', created: 1786553533, livemode: false,
  data: { object: { id: 'in_1U3fNu', amount_paid: 2000, currency: 'usd',
    billing_reason: 'manual', customer_email: null, customer: 'cus_V3mxswVJSWNHwv' } }
};
stripeCustomerEmail = 'Recovered@Example.com';
r = await post(invoiceNoEmail, { secretKey: 'rk_test_x' });
check('lookup: called stripe', r.posted.length === 1 && stripeLookups[0].includes('cus_V3mxswVJSWNHwv'), stripeLookups[0]);
check('lookup: email recovered + normalised', r.posted[0]?.body.distinct_id === 'recovered@example.com', r.posted[0]?.body.distinct_id);

// 12. Same event with no key configured -> degrades quietly, still 200
r = await post(invoiceNoEmail);
check('no key: no lookup, no post, 200', r.status === 200 && stripeLookups.length === 0 && r.posted.length === 0, `${r.status}`);

// 13. Customer lookup fails (deleted customer / bad key) -> must not 500
stripeCustomerEmail = null;
r = await post(invoiceNoEmail, { secretKey: 'rk_test_x' });
check('lookup failure: 200 not retry-loop', r.status === 200 && r.posted.length === 0, `${r.status}`);
stripeCustomerEmail = 'Recovered@Example.com';

// 14. Zero-amount trial invoice must not trigger a lookup at all
r = await post({
  id: 'evt_11', type: 'invoice.payment_succeeded', created: 1786553600,
  data: { object: { id: 'in_x', amount_paid: 0, customer: 'cus_V3mxswVJSWNHwv' } }
}, { secretKey: 'rk_test_x' });
check('zero invoice: no lookup', stripeLookups.length === 0 && r.posted.length === 0, `${stripeLookups.length}`);

// 15. Visitor id passed via app_user_id wins over email — no personal data used
r = await post({
  id: 'evt_12', type: 'checkout.session.completed', created: 1786556000,
  data: { object: { mode: 'subscription', subscription: 'sub_v', currency: 'usd', amount_total: 2999,
    client_reference_id: '019ff6bf-f0e3-7b84-b942-4080f5502a54',
    customer_details: { email: 'someone@example.com' },
    metadata: { _sw_app_user_id: '019ff6bf-f0e3-7b84-b942-4080f5502a54', _sw_offer_kind: 'trial' } } }
});
check('visitor id wins over email', r.posted[0]?.body.distinct_id === '019ff6bf-f0e3-7b84-b942-4080f5502a54', r.posted[0]?.body.distinct_id);
check('joined_by recorded', r.posted[0]?.body.properties.joined_by === 'visitor_id', r.posted[0]?.body.properties.joined_by);

// 16. Invoice nests it under subscription_details — the paid step must find it
r = await post({
  id: 'evt_13', type: 'invoice.payment_succeeded', created: 1786556100,
  data: { object: { id: 'in_v', amount_paid: 2999, currency: 'usd', billing_reason: 'subscription_create',
    customer_email: null, customer: 'cus_x',
    subscription_details: { metadata: { _sw_app_user_id: '019ff6bf-f0e3-7b84-b942-4080f5502a54' } } } }
}, { secretKey: 'rk_test_x' });
check('invoice: finds nested visitor id', r.posted[0]?.body.distinct_id === '019ff6bf-f0e3-7b84-b942-4080f5502a54', r.posted[0]?.body.distinct_id);
check('invoice: no lookup needed', stripeLookups.length === 0, `${stripeLookups.length} lookups`);

// 17. Superwall's own alias (app paywall, no app_user_id) must NOT become a person
r = await post({
  id: 'evt_14', type: 'checkout.session.completed', created: 1786556200,
  data: { object: { mode: 'subscription', subscription: 'sub_a',
    client_reference_id: '$SuperwallAlias:D559F08A-2BBC-419F-A80D-D3308DC5373B',
    customer_details: { email: 'appuser@example.com' },
    metadata: { _sw_app_user_id: '$SuperwallAlias:D559F08A-2BBC-419F-A80D-D3308DC5373B' } } }
});
check('alias rejected, falls back to email', r.posted[0]?.body.distinct_id === 'appuser@example.com', r.posted[0]?.body.distinct_id);
check('joined_by = email on fallback', r.posted[0]?.body.properties.joined_by === 'email', r.posted[0]?.body.properties.joined_by);

// 18. Admin stats expose the four person-link metrics.
posthogQueryResults = [
  ['web_tracking_link_click', 42],
  ['web_app_store_click', 30],
  ['web_checkout_started', 8],
  ['trial_started', 3]
];
const statsRes = await worker.fetch(new Request('https://w.test/stats?ref=creator_jane&days=30'), env);
const statsBody = await statsRes.json();
check('stats: 200', statsRes.status === 200, `${statsRes.status}`);
check('stats: four attribution counts',
  statsBody.funnel?.clicks === 42 &&
  statsBody.funnel?.downloads === 30 &&
  statsBody.funnel?.paywall_views === 8 &&
  statsBody.funnel?.subscriptions === 3,
  JSON.stringify(statsBody.funnel));
check('stats: only four dashboard fields', Object.keys(statsBody.funnel || {}).length === 4,
  JSON.stringify(Object.keys(statsBody.funnel || {})));
check('stats: browser and subscription attribution stay separate',
  posthogQueries[0]?.includes("event IN ('web_tracking_link_click'") &&
  posthogQueries[0]?.includes("event = 'trial_started' AND person.properties.ref"),
  posthogQueries[0]);

// 19. Unmatched GET rejected
const getRes = await worker.fetch(new Request('https://w.test', { method: 'GET' }), env);
check('GET: 405', getRes.status === 405, `${getRes.status}`);

let failed = 0;
for (const t of results) {
  if (!t.pass) failed++;
  console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.name}${t.pass ? '' : `   -> ${t.detail}`}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
