// Promo backend E2E: packages, checkout guards, featured ranking, events.
// Run: node scripts/test-promos.js (TEST_BASE optional, default localhost:5000)
// Safe read-only checks always run. Write flow (creates 1 package + 1 owner +
// 1 restaurant + 1 unpaid campaign, no money moves) runs only with
// PROMO_E2E_WRITE=1. Admin creds: ADMIN_EMAIL/ADMIN_PASSWORD env.
const BASE = process.env.TEST_BASE || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@easycart.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';
const WRITE = process.env.PROMO_E2E_WRITE === '1';

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
  return { status: res.status, json };
}

(async () => {
  console.log(`— Promo backend E2E (${BASE}) —`);

  console.log('[1] route presence + auth');
  let r = await api('GET', '/api/promos/featured');
  ok('featured reachable (200 array)', r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  r = await api('GET', '/api/promos/packages');
  ok('packages require auth (401, not 404)', r.status === 401, `status=${r.status}`);

  console.log('[2] validation (no-auth writes rejected, no state change)');
  r = await api('POST', '/api/promos/events', null, { events: [] });
  ok('events rejects empty (401 before 400 = auth first)', r.status === 401, `status=${r.status}`);

  if (!WRITE) {
    console.log('(write flow skipped — set PROMO_E2E_WRITE=1 to run it)');
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }

  const tag = Date.now().toString(36);
  console.log('[3] admin login + package create');
  r = await api('POST', '/api/auth/login', null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  ok('admin login', r.status === 200 && r.json?.user?.role === 'admin', `status=${r.status}`);
  if (r.status !== 200) throw new Error('no admin — cannot run write flow');
  const adminTok = r.json.token;
  r = await api('POST', '/api/promos/admin/packages', adminTok, { name: `E2E ${tag}`, durationDays: 7, price: 199, priority: 5 });
  ok('package created', r.status === 201 && r.json?._id, `status=${r.status}`);
  const pkgId = r.json?._id;

  console.log('[4] owner sees package, cannot use admin APIs');
  r = await api('POST', '/api/auth/register', null, { name: 'PromoOwn', email: `promoown_${tag}@test.local`, password: 'password123', role: 'restaurant' });
  const ownerTok = r.json?.token;
  ok('owner registered', r.status === 201 && !!ownerTok, `status=${r.status}`);
  r = await api('GET', '/api/promos/admin/packages', ownerTok);
  ok('owner blocked from admin packages (403)', r.status === 403, `status=${r.status}`);
  r = await api('GET', '/api/promos/packages', ownerTok);
  const seen = (r.json || []).some((p) => String(p._id) === String(pkgId) && p.price === 199 && p.durationDays === 7);
  ok('owner lists new package with fields', r.status === 200 && seen, `status=${r.status}`);

  console.log('[5] checkout + guards (no money moves)');
  r = await api('POST', '/api/restaurants', ownerTok, { name: `Promo Kitchen ${tag}`, address: 'Test St' });
  const restId = r.json?._id;
  ok('restaurant created', r.status === 201 && !!restId, `status=${r.status}`);
  r = await api('POST', '/api/promos/checkout', ownerTok, { packageId: pkgId, restaurantId: restId, offerText: 'E2E deal' });
  ok('checkout intent', r.status === 201 && r.json?.checkoutPath?.startsWith('/api/promos/checkout/'), `status=${r.status}`);
  const campId = r.json?.campaignId;
  r = await api('POST', '/api/promos/verify', ownerTok, { campaignId: campId, razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'forged' });
  ok('forged signature rejected (400)', r.status === 400, `status=${r.status}`);
  r = await api('POST', `/api/promos/admin/campaigns/${campId}/decide`, adminTok, { action: 'approve' });
  ok('unpaid approve blocked (400)', r.status === 400, `status=${r.status}`);
  r = await api('GET', `/api/promos/campaigns/${campId}`, ownerTok);
  ok('detail + analytics shape', r.status === 200 && r.json?.analytics && typeof r.json.analytics.impressions === 'number', `status=${r.status}`);
  r = await api('POST', `/api/promos/campaigns/${campId}/cancel`, ownerTok, {});
  ok('unpaid cancel', r.status === 200 && r.json?.campaign?.status === 'cancelled', `status=${r.status}`);

  console.log('[6] disable package hides it from owners');
  await api('PATCH', `/api/promos/admin/packages/${pkgId}`, adminTok, { isActive: false });
  r = await api('GET', '/api/promos/packages', ownerTok);
  ok('disabled hidden', r.status === 200 && !(r.json || []).some((p) => String(p._id) === String(pkgId)), `status=${r.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message); process.exit(1); });
