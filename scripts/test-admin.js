// Admin backend E2E: lists+pagination, approvals+enforcement, suspend, audit, stats.
// Run: node scripts/test-admin.js (server must be running; TEST_BASE optional)
// Needs an admin account: ADMIN_EMAIL/ADMIN_PASSWORD env (defaults to seeded admin).
const BASE = process.env.TEST_BASE || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@easycart.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

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
  console.log('— Admin backend E2E —');
  const tag = Date.now().toString(36);

  console.log('[1] admin auth');
  let r = await api('POST', '/api/auth/login', null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  ok('admin login', r.status === 200 && r.json?.user?.role === 'admin', `status=${r.status}`);
  if (r.status !== 200) throw new Error('no admin — seed one (role admin) to run this suite');
  const adminTok = r.json.token;
  r = await api('POST', '/api/auth/register', null, { name: 'Cust', email: `adcust_${tag}@test.local`, password: 'password123', role: 'customer' });
  const custTok = r.json?.token;

  console.log('[2] RBAC');
  r = await api('GET', '/api/admin/customers', custTok);
  ok('customer blocked from admin → 403', r.status === 403, `status=${r.status}`);
  r = await api('GET', '/api/admin/customers', null);
  ok('anonymous blocked → 401', r.status === 401, `status=${r.status}`);

  console.log('[3] lists + pagination');
  r = await api('GET', '/api/admin/customers?limit=2', adminTok);
  ok('customers paginated', r.status === 200 && Array.isArray(r.json?.data) && typeof r.json?.total === 'number', `total=${r.json?.total}`);
  ok('no password hashes leak', !(r.json?.data || []).some((u) => u.passwordHash || u.refreshToken), 'clean');
  r = await api('GET', `/api/admin/customers?search=adcust_${tag}`, adminTok);
  ok('customer search', r.status === 200 && (r.json?.data || []).some((u) => u.email === `adcust_${tag}@test.local`), `total=${r.json?.total}`);
  r = await api('GET', '/api/admin/owners?limit=5', adminTok);
  ok('owners with counts', r.status === 200 && Array.isArray(r.json?.data), `total=${r.json?.total}`);
  r = await api('GET', '/api/admin/restaurants?status=approved&limit=3', adminTok);
  ok('restaurants filtered', r.status === 200 && Array.isArray(r.json?.data), `total=${r.json?.total}`);
  r = await api('GET', '/api/admin/orders?limit=5', adminTok);
  ok('orders paginated', r.status === 200 && Array.isArray(r.json?.data), `total=${r.json?.total}`);
  r = await api('GET', '/api/admin/payments?limit=5', adminTok);
  ok('payments ledger', r.status === 200 && Array.isArray(r.json?.data), `total=${r.json?.total}`);

  console.log('[4] approval workflow + enforcement');
  r = await api('POST', '/api/auth/register', null, { name: 'Own', email: `adown_${tag}@test.local`, password: 'password123', role: 'restaurant' });
  const ownerTok = r.json?.token;
  r = await api('POST', '/api/restaurants', ownerTok, { name: `Ad Kitchen ${tag}`, address: 'Test St' });
  const restId = r.json?._id;
  ok('new restaurant starts pending', r.status === 201 && r.json?.approvalStatus === 'pending', r.json?.approvalStatus);
  r = await api('GET', '/api/restaurants', null);
  ok('pending hidden publicly', !(r.json || []).some((x) => x._id === restId), 'hidden');
  r = await api('PATCH', `/api/admin/restaurants/${restId}/approval`, adminTok, { status: 'rejected' });
  ok('reject without reason → 400', r.status === 400, `status=${r.status}`);
  r = await api('PATCH', `/api/admin/restaurants/${restId}/approval`, custTok, { status: 'approved', note: 'x' });
  ok('non-admin approval → 403', r.status === 403, `status=${r.status}`);
  r = await api('PATCH', `/api/admin/restaurants/${restId}/approval`, adminTok, { status: 'approved', note: 'looks good' });
  ok('approve works', r.status === 200 && r.json?.approvalStatus === 'approved', r.json?.approvalStatus);
  r = await api('GET', '/api/restaurants', null);
  ok('approved visible publicly', (r.json || []).some((x) => x._id === restId), 'visible');
  r = await api('PATCH', `/api/admin/restaurants/${restId}/approval`, adminTok, { status: 'suspended', note: 'health violation (test)' });
  ok('suspend works', r.status === 200 && r.json?.approvalStatus === 'suspended', r.json?.approvalStatus);
  r = await api('GET', '/api/restaurants', null);
  ok('suspended hidden publicly', !(r.json || []).some((x) => x._id === restId), 'hidden');

  console.log('[5] suspend user');
  // suspend the test customer created above
  const custId = (await api('GET', `/api/admin/customers?search=adcust_${tag}`, adminTok)).json?.data?.[0]?._id;
  r = await api('PATCH', `/api/admin/users/${custId}/suspend`, adminTok, { suspend: true });
  ok('suspend needs reason → 400', r.status === 400, `status=${r.status}`);
  r = await api('PATCH', `/api/admin/users/${custId}/suspend`, adminTok, { suspend: true, reason: 'test abuse' });
  ok('suspend works', r.status === 200 && r.json?.isSuspended === true, `status=${r.status}`);
  r = await api('POST', '/api/auth/login', null, { email: `adcust_${tag}@test.local`, password: 'password123' });
  ok('suspended login → 403', r.status === 403, `status=${r.status}`);
  r = await api('GET', '/api/auth/me', custTok);
  ok('suspended token → 403', r.status === 403, `status=${r.status}`);
  r = await api('PATCH', `/api/admin/users/${custId}/suspend`, adminTok, { suspend: false });
  ok('reactivate works', r.status === 200 && r.json?.isSuspended === false, `status=${r.status}`);

  console.log('[6] audit + stats');
  r = await api('GET', '/api/admin/audit?limit=5', adminTok);
  ok('audit readable', r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length > 0, `entries=${r.json?.data?.length}`);
  ok('audit has approval entry', (r.json?.data || []).some((a) => String(a.action || '').startsWith('restaurant.')), 'found');
  r = await api('POST', '/api/admin/audit', adminTok, { action: 'x' });
  ok('audit write blocked (read-only) → 404', r.status === 404, `status=${r.status}`);
  r = await api('GET', '/api/admin/stats', adminTok);
  ok('stats shape', r.status === 200 && typeof r.json?.gmv === 'number' && Array.isArray(r.json?.ordersByDay) && Array.isArray(r.json?.topRestaurants), `gmv=${r.json?.gmv}`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
