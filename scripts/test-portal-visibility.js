// Portal visibility E2E: paid order must appear in owner's /orders + realtime socket.
// Run: node scripts/test-portal-visibility.js
const crypto = require('crypto');
const { io } = require('socket.io-client');

const BASE = process.env.TEST_BASE || 'http://localhost:5000';

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

(async () => {
  console.log('— Portal visibility E2E —');
  const tag = Date.now().toString(36);

  let r = await api('POST', '/api/auth/register', null, { name: 'Vis Owner', email: `visowner_${tag}@test.local`, password: 'password123', role: 'restaurant', phone: '9876500001' });
  const ownerToken = r.json?.token;
  ok('owner registered', r.status === 201, `status=${r.status}`);
  r = await api('POST', '/api/auth/register', null, { name: 'Vis Cust', email: `viscust_${tag}@test.local`, password: 'password123', role: 'customer' });
  const custToken = r.json?.token;

  r = await api('POST', '/api/restaurants', ownerToken, { name: `Vis Kitchen ${tag}`, address: 'Test St, Pune' });
  const restId = r.json?._id;
  ok('restaurant created', r.status === 201, restId);
  await api('PUT', `/api/restaurants/${restId}/payout`, ownerToken, { payoutMode: 'UPI', payoutUpiId: `vis${tag}@okhdfcbank` });
  r = await api('POST', `/api/restaurants/${restId}/menu`, ownerToken, { name: 'Vis Thali', price: 300, category: 'Mains' });
  const itemId = r.json?._id;

  r = await api('POST', '/api/orders', custToken, { restaurantId: restId, items: [{ menuItemId: itemId, quantity: 1 }] });
  const order = r.json?.orders?.[0] || r.json;
  ok('order created', r.status === 201 && !!order?._id, `${order?.orderNumber} total=₹${order?.totalAmount}`);

  // Owner socket BEFORE payment — must receive live order:new
  const sock = io(BASE, { auth: { token: ownerToken }, transports: ['websocket', 'polling'] });
  await new Promise((res) => sock.on('connect', res));
  sock.emit('join:restaurant', restId);
  const gotLive = new Promise((res) => {
    const t = setTimeout(() => res(null), 15000);
    sock.on('order:new', (o) => { clearTimeout(t); res(o); });
  });

  r = await api('POST', '/api/payments/create', custToken, { orderId: order._id });
  ok('intent created', r.status === 200 && !!r.json?.razorpayOrderId, `rzpOrder=${r.json?.razorpayOrderId}`);
  const intent = r.json;
  // Test-mode verify: signature computed locally; gateway fetch is best-effort
  const payId = `pay_vis_${tag}`;
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${intent.razorpayOrderId}|${payId}`).digest('hex');
  await api('POST', '/api/payments/verify', custToken, { orderId: order._id, razorpay_order_id: intent.razorpayOrderId, razorpay_payment_id: payId, razorpay_signature: sig });

  const live = await gotLive;
  ok('realtime order:new received', !!live && live.orderNumber === order.orderNumber, live ? live.orderNumber : 'timeout — no socket event');

  r = await api('GET', '/api/restaurants/my', ownerToken);
  ok('my-restaurants lists it', r.status === 200 && (r.json || []).some((x) => x._id === restId), `count=${(r.json || []).length}`);
  r = await api('GET', '/api/orders', ownerToken);
  const found = (r.json || []).find((x) => x._id === order._id);
  ok('owner /orders contains paid order', !!found && found.paymentStatus === 'PAID', found ? `${found.orderNumber} ${found.paymentStatus}` : 'missing');
  r = await api('GET', '/api/orders?status=PAID', ownerToken);
  ok('status filter finds it', (r.json || []).some((x) => x._id === order._id), `count=${(r.json || []).length}`);

  // Cross-owner isolation: another owner must NOT see it
  r = await api('POST', '/api/auth/register', null, { name: 'Other', email: `other_${tag}@test.local`, password: 'password123', role: 'restaurant' });
  const otherTok = r.json?.token;
  r = await api('GET', '/api/orders', otherTok);
  ok('other owner does NOT see it', !(r.json || []).some((x) => x._id === order._id), `their count=${(r.json || []).length}`);

  sock.disconnect();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
