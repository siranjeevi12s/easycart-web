// End-to-end Razorpay TEST-mode workflow for EasyCart.
// Run: node scripts/test-razorpay.js  (server must be running on PORT)
// Covers: order pricing + split, real Razorpay order create (REST-verified),
// hosted checkout page, HMAC verify -> PAID, idempotent duplicate, bad-signature
// failure, cancel-unpaid, signed webhook captured/failed, invalid-signature reject.
const crypto = require('crypto');

const BASE = process.env.TEST_BASE || 'http://localhost:5000';
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || KEY_SECRET;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function api(method, path, token, body, raw) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function rzpGET(path) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64') },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const hmac = (msg, secret) => crypto.createHmac('sha256', secret).update(msg).digest('hex');

(async () => {
  console.log('— EasyCart Razorpay test workflow —');
  const tag = Date.now().toString(36);

  // 1. Register fresh users
  console.log('[1] users');
  let r = await api('POST', '/api/auth/register', null, { name: 'Test Customer', email: `cust_${tag}@test.local`, password: 'password123', role: 'customer' });
  ok('customer registered', r.status === 201, `status=${r.status}`);
  const custToken = r.json?.token;
  r = await api('POST', '/api/auth/register', null, { name: 'Test Owner', email: `owner_${tag}@test.local`, password: 'password123', role: 'restaurant' });
  ok('owner registered', r.status === 201, `status=${r.status}`);
  const ownerToken = r.json?.token;
  if (!custToken || !ownerToken) throw new Error('auth setup failed: ' + JSON.stringify([r.status, r.json]));

  // 2. Restaurant + payout + menu
  console.log('[2] restaurant setup');
  r = await api('POST', '/api/restaurants', ownerToken, { name: `Test Kitchen ${tag}`, address: 'Test Street, Pune', phone: '9876500001' });
  ok('restaurant created', r.status === 201, `status=${r.status}`);
  const restId = r.json?._id;
  r = await api('PUT', `/api/restaurants/${restId}/payout`, ownerToken, { payoutMode: 'UPI', payoutUpiId: `testkitchen${tag}@okhdfcbank` });
  ok('payout enabled', r.status === 200 && r.json?.payoutEnabled === true, JSON.stringify(r.json));
  r = await api('POST', '/api/auth/login', null, { email: process.env.ADMIN_EMAIL || 'admin@easycart.local', password: process.env.ADMIN_PASSWORD || 'password123' });
  await api('PATCH', `/api/admin/restaurants/${restId}/approval`, r.json?.token, { status: 'approved', note: 'test suite' });
  r = await api('POST', `/api/restaurants/${restId}/menu`, ownerToken, { name: 'Test Thali', price: 475, category: 'Mains' });
  ok('menu item added', r.status === 201, `status=${r.status} price=${r.json?.price}`);
  const itemId = r.json?._id;

  // 3. Order with backend pricing + split (fee 0% -> restaurant keeps 100%)
  console.log('[3] order + split');
  r = await api('POST', '/api/orders', custToken, { restaurantId: restId, items: [{ menuItemId: itemId, quantity: 1 }] });
  ok('order created', r.status === 201, `status=${r.status}`);
  const order = r.json?.orders?.[0] || r.json;
  ok('backend totals', order?.subtotal === 475 && order?.tax === 10 && order?.totalAmount === 485, `sub=${order?.subtotal} tax=${order?.tax} total=${order?.totalAmount}`);
  ok('split stored (0% fee)', order?.platformFee === 0 && order?.restaurantAmount === 485, `fee=${order?.platformFee} rest=${order?.restaurantAmount}`);

  // 4. Real Razorpay order
  console.log('[4] payment intent (real Razorpay TEST order)');
  r = await api('POST', '/api/payments/create', custToken, { orderId: order._id });
  ok('intent created', r.status === 200, `status=${r.status} mode=${r.json?.mode}`);
  const intent = r.json;
  ok('mode=test (real keys)', intent?.mode === 'test', `mode=${intent?.mode}`);
  if (!intent?.checkoutPath) throw new Error('intent failed, cannot continue: ' + JSON.stringify({ status: r.status, json: r.json }));
  ok('checkout path issued', typeof intent?.checkoutPath === 'string', intent?.checkoutPath);
  // 4b. Prove the order really exists at Razorpay
  const rzp = await rzpGET(`/orders/${intent?.razorpayOrderId}`);
  ok('order exists at Razorpay', rzp.status === 200 && rzp.json?.amount === 48500, `amount=${rzp.json?.amount} status=${rzp.status}`);
  // 4c. Hosted checkout page (public key only)
  const page = await fetch(`${BASE}${intent.checkoutPath}`);
  const html = await page.text();
  ok('checkout page loads', page.status === 200 && html.includes('checkout.razorpay.com'), `status=${page.status}`);
  ok('no secret in page', !html.includes(KEY_SECRET) && html.includes(KEY_ID), 'key_id present, secret absent');

  // 5. Simulate successful checkout return (valid HMAC, as checkout.js handler would send)
  console.log('[5] verify -> PAID');
  const payId = `pay_test_${tag}`;
  const sig = hmac(`${intent.razorpayOrderId}|${payId}`, KEY_SECRET);
  r = await api('POST', '/api/payments/verify', custToken, { orderId: order._id, razorpay_order_id: intent.razorpayOrderId, razorpay_payment_id: payId, razorpay_signature: sig });
  ok('verified PAID', r.status === 200 && r.json?.order?.paymentStatus === 'PAID', `status=${r.status} pay=${r.json?.order?.paymentStatus}`);
  r = await api('GET', `/api/payments/status/${order._id}`, custToken);
  ok('status endpoint: PAID + settlement queued', r.json?.paymentStatus === 'PAID' && r.json?.settlement?.status === 'PENDING', JSON.stringify({ p: r.json?.paymentStatus, s: r.json?.settlement?.status }));

  // 6. Duplicate verify (idempotent)
  console.log('[6] duplicates');
  r = await api('POST', '/api/payments/verify', custToken, { orderId: order._id, razorpay_order_id: intent.razorpayOrderId, razorpay_payment_id: payId, razorpay_signature: sig });
  ok('duplicate verify idempotent', r.status === 200 && /Already/.test(r.json?.message || ''), r.json?.message);
  r = await api('POST', '/api/payments/create', custToken, { orderId: order._id });
  ok('no new intent after paid', r.status === 400 && r.json?.code === 'ALREADY_PAID', `${r.status} ${r.json?.message}`);

  // 7. Bad signature -> FAILED (order stays retryable)
  console.log('[7] failure path');
  r = await api('POST', '/api/orders', custToken, { restaurantId: restId, items: [{ menuItemId: itemId, quantity: 1 }] });
  const order2 = r.json?.orders?.[0] || r.json;
  r = await api('POST', '/api/payments/create', custToken, { orderId: order2._id });
  const intent2 = r.json;
  r = await api('POST', '/api/payments/verify', custToken, { orderId: order2._id, razorpay_order_id: intent2.razorpayOrderId, razorpay_payment_id: `pay_bad_${tag}`, razorpay_signature: 'tampered' });
  ok('bad signature rejected', r.status === 400, `status=${r.status}`);
  r = await api('GET', `/api/payments/status/${order2._id}`, custToken);
  ok('order marked FAILED', r.json?.paymentStatus === 'FAILED', r.json?.paymentStatus);
  r = await api('POST', '/api/payments/refund', ownerToken, { orderId: order2._id });
  ok('refund blocked when not PAID', r.status === 400, `status=${r.status}`);

  // 8. Cancel unpaid order
  console.log('[8] cancel unpaid');
  r = await api('POST', '/api/orders', custToken, { restaurantId: restId, items: [{ menuItemId: itemId, quantity: 1 }] });
  const order3 = r.json?.orders?.[0] || r.json;
  r = await api('POST', '/api/payments/cancel', custToken, { orderId: order3._id });
  ok('unpaid order cancelled', r.status === 200 && r.json?.order?.paymentStatus === 'CANCELLED', r.json?.order?.paymentStatus);
  r = await api('POST', '/api/payments/cancel', custToken, { orderId: order._id });
  ok('paid order cancel blocked', r.status === 400 && r.json?.code === 'ALREADY_PAID', `status=${r.status}`);

  // 9. Webhook: signed payment.captured confirms a fresh order (no verify call)
  console.log('[9] webhook captured');
  r = await api('POST', '/api/orders', custToken, { restaurantId: restId, items: [{ menuItemId: itemId, quantity: 1 }] });
  const order4 = r.json?.orders?.[0] || r.json;
  r = await api('POST', '/api/payments/create', custToken, { orderId: order4._id });
  const intent4 = r.json;
  const wpay = `pay_wh_${tag}`;
  const whBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: wpay, order_id: intent4.razorpayOrderId, amount: 48500, status: 'captured' } } } });
  // sign over the exact raw bytes Razorpay would sign
  const whSig = hmac(whBody, WEBHOOK_SECRET);
  r = await fetch(`${BASE}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': whSig }, body: whBody }).then(async (res) => ({ status: res.status, json: await res.json().catch(() => null) }));
  ok('webhook accepted', r.status === 200, `status=${r.status}`);
  r = await api('GET', `/api/payments/status/${order4._id}`, custToken);
  ok('webhook marked PAID', r.json?.paymentStatus === 'PAID', r.json?.paymentStatus);

  // 10. Webhook: invalid signature rejected + payment.failed recorded
  console.log('[10] webhook security');
  r = await fetch(`${BASE}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'forged' }, body: whBody }).then(async (res) => ({ status: res.status }));
  ok('forged webhook rejected', r.status === 400, `status=${r.status}`);
  r = await api('POST', '/api/orders', custToken, { restaurantId: restId, items: [{ menuItemId: itemId, quantity: 1 }] });
  const order5 = r.json?.orders?.[0] || r.json;
  r = await api('POST', '/api/payments/create', custToken, { orderId: order5._id });
  const intent5 = r.json;
  const failBody = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: `pay_fail_${tag}`, order_id: intent5.razorpayOrderId, error_reason: 'payment_failed', error_description: 'Insufficient funds (test)' } } } });
  const failSig = hmac(failBody, WEBHOOK_SECRET);
  await fetch(`${BASE}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': failSig }, body: failBody });
  r = await api('GET', `/api/payments/status/${order5._id}`, custToken);
  ok('failed webhook recorded', r.json?.paymentStatus === 'FAILED', r.json?.paymentStatus);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
