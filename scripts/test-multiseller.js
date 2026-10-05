// Multi-seller batch test: 3 restaurants, ONE Razorpay payment, all PAID + settlements.
// Run: node scripts/test-multiseller.js
// Needs RAZORPAY_KEY_ID/SECRET in env for signature simulation + REST checks.
const crypto = require('crypto');

const BASE = process.env.TEST_BASE || 'http://localhost:5000';
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function api(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
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

const hmac = (o, p) => crypto.createHmac('sha256', KEY_SECRET).update(`${o}|${p}`).digest('hex');

(async () => {
  console.log('— EasyCart multi-seller Razorpay batch test —');
  const tag = Date.now().toString(36);

  console.log('[1] users');
  let r = await api('POST', '/api/auth/register', null, { name: 'MS Customer', email: `mscust_${tag}@test.local`, password: 'password123', role: 'customer' });
  ok('customer registered', r.status === 201, `status=${r.status}`);
  const custToken = r.json?.token;
  r = await api('POST', '/api/auth/register', null, { name: 'MS Owner', email: `msowner_${tag}@test.local`, password: 'password123', role: 'restaurant' });
  ok('owner registered', r.status === 201, `status=${r.status}`);
  const ownerToken = r.json?.token;
  if (!custToken || !ownerToken) throw new Error('auth failed');

  console.log('[2] three restaurants A/B/C with payouts');
  const specs = [
    { name: `MS-A ${tag}`, price: 400 },
    { name: `MS-B ${tag}`, price: 350 },
    { name: `MS-C ${tag}`, price: 150 },
  ];
  const picks = [];
  for (const s of specs) {
    let x = await api('POST', '/api/restaurants', ownerToken, { name: s.name, address: 'Test Street, Pune' });
    const restId = x.json?._id;
    await api('PUT', `/api/restaurants/${restId}/payout`, ownerToken, { payoutMode: 'UPI', payoutUpiId: `ms${tag}@okhdfcbank` });
    x = await api('POST', `/api/restaurants/${restId}/menu`, ownerToken, { name: `Dish ${s.name}`, price: s.price, category: 'Mains' });
    picks.push({ restId, itemId: x.json?._id, price: s.price, name: s.name });
  }
  ok('3 restaurants + menus', picks.every((p) => p.restId && p.itemId), picks.map((p) => `${p.name}=₹${p.price}`).join(' '));

  console.log('[3] batch order (one per seller)');
  r = await api('POST', '/api/orders', custToken, {
    items: picks.map((p) => ({ restaurantId: p.restId, menuItemId: p.itemId, quantity: 1 })),
  });
  ok('batch created', r.status === 201 && r.json?.orders?.length === 3, `status=${r.status} orders=${r.json?.orders?.length}`);
  const { batchId, orders } = r.json;
  ok('shared batchId', orders.every((o) => o.batchId === batchId), batchId);
  const combined = orders.reduce((s, o) => s + o.totalAmount, 0);
  console.log(`    totals: ${orders.map((o) => `${o.orderNumber}=₹${o.totalAmount}`).join(' ')} combined=₹${combined}`);
  ok('backend totals sane', orders.every((o) => o.totalAmount === Math.round(o.subtotal * 1.05)), 'subtotal+5%tax each');

  console.log('[4] single Razorpay intent for combined total');
  r = await api('POST', '/api/payments/create', custToken, { orderIds: orders.map((o) => o._id), batchId });
  ok('intent created', r.status === 200, `status=${r.status} provider=${r.json?.provider}`);
  const intent = r.json;
  ok('provider=razorpay', intent?.provider === 'razorpay', intent?.provider);
  ok('mode=test (real keys)', intent?.mode === 'test', intent?.mode);
  ok('combined amount', intent?.amount === combined * 100, `${intent?.amount} paise`);
  ok('splits per seller', (intent?.splits || []).length === 3, JSON.stringify((intent?.splits || []).map((s) => s.restaurantAmount)));
  const rzp = await rzpGET(`/orders/${intent?.razorpayOrderId}`);
  ok('order exists at Razorpay', rzp.status === 200 && rzp.json?.amount === combined * 100, `₹${(rzp.json?.amount || 0) / 100}`);
  ok('platform retains remainder', combined - (intent?.splits || []).reduce((s, x) => s + x.restaurantAmount, 0) === (intent?.splits || []).reduce((s, x) => s + x.platformFee, 0), `fee total=₹${(intent?.splits || []).reduce((s, x) => s + x.platformFee, 0)}`);

  console.log('[5] verify once -> all three PAID');
  const payId = `pay_ms_${tag}`;
  r = await api('POST', '/api/payments/verify', custToken, {
    orderIds: orders.map((o) => o._id),
    razorpay_order_id: intent.razorpayOrderId,
    razorpay_payment_id: payId,
    razorpay_signature: hmac(intent.razorpayOrderId, payId),
  });
  ok('batch verified', r.status === 200 && (r.json?.orders || []).length === 3, `status=${r.status}`);
  ok('all PAID', (r.json?.orders || []).every((o) => o.paymentStatus === 'PAID' && o.orderStatus === 'PAID'), (r.json?.orders || []).map((o) => o.orderNumber).join(','));

  console.log('[6] settlements + batch status');
  r = await api('GET', `/api/payments/batch/${batchId}`, custToken);
  ok('batch allPaid', r.json?.allPaid === true && r.json?.orders?.length === 3, `allPaid=${r.json?.allPaid}`);
  ok('per-seller settlements', (r.json?.orders || []).every((o) => o.settlement && ['PENDING', 'PROCESSING'].includes(o.settlement.status)), JSON.stringify((r.json?.orders || []).map((o) => o.settlement?.status)));
  ok('seller shares add up', (r.json?.orders || []).reduce((s, o) => s + (o.restaurantAmount || 0), 0) + (r.json?.platformFee || 0) === r.json?.total, `total=₹${r.json?.total}`);

  console.log('[7] legacy single-order shape still works');
  r = await api('POST', '/api/orders', custToken, { restaurantId: picks[0].restId, items: [{ menuItemId: picks[0].itemId, quantity: 1 }] });
  ok('legacy create', r.status === 201 && r.json?.orders?.length === 1, `status=${r.status}`);
  const solo = r.json.orders[0];
  r = await api('POST', '/api/payments/create', custToken, { orderId: solo._id });
  ok('legacy intent has compat fields', r.status === 200 && r.json?.order?._id === solo._id && !!r.json?.checkoutPath, `provider=${r.json?.provider}`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
