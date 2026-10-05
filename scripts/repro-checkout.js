// Repro: real seed restaurant checkout path (what the app does on Pay tap).
// Run: node scripts/repro-checkout.js
const BASE = process.env.TEST_BASE || 'http://localhost:5000';

async function api(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

(async () => {
  const tag = Date.now().toString(36);
  let r = await api('POST', '/api/auth/register', null, { name: 'Repro', email: `repro_${tag}@test.local`, password: 'password123', role: 'customer' });
  const tok = r.json?.token;
  console.log('register:', r.status);

  r = await api('GET', '/api/restaurants');
  const rest = r.json?.find((x) => x.name === 'Spice Paradise') || r.json?.[0];
  console.log('restaurant:', rest?.name, rest?._id, 'payout=', rest?.payoutEnabled);
  if (!rest) throw new Error('no restaurants');

  r = await api('GET', `/api/restaurants/${rest._id}/menu`);
  const items = Array.isArray(r.json) ? r.json : r.json?.items || [];
  const item = items.find((i) => i.isAvailable);
  console.log('menu item:', item?.name, item?._id, item?.price);
  if (!item) throw new Error('no available items');

  r = await api('POST', '/api/orders', tok, { restaurantId: rest._id, items: [{ menuItemId: item._id, quantity: 1 }] });
  console.log('order:', r.status, JSON.stringify(r.json)?.slice(0, 200));
  if (r.status !== 201) return;
  const order = r.json;

  r = await api('POST', '/api/payments/create', tok, { orderId: order._id });
  console.log('intent:', r.status);
  console.log(JSON.stringify(r.json, null, 1)?.slice(0, 800));
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
