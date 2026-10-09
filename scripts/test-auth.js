// JWT production audit: register/login/refresh/rotation/revocation/roles/tampering.
// Run: node scripts/test-auth.js (server must be running; TEST_BASE optional)
const crypto = require('crypto');

const BASE = process.env.TEST_BASE || 'http://localhost:5001';
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
  console.log('— JWT auth audit —');
  const tag = Date.now().toString(36);
  const email = `auth_${tag}@test.local`;

  console.log('[1] registration');
  let r = await api('POST', '/api/auth/register', null, { name: 'Auth T', email, password: 'password123', role: 'customer' });
  ok('register 201 + token pair', r.status === 201 && !!r.json?.token && !!r.json?.refreshToken, `status=${r.status}`);
  r = await api('POST', '/api/auth/register', null, { name: 'Dup', email, password: 'password123' });
  ok('duplicate → 409', r.status === 409, `status=${r.status}`);
  r = await api('POST', '/api/auth/register', null, { name: 'X', email: `admin_${tag}@test.local`, password: 'password123', role: 'admin' });
  ok('admin self-register blocked → 400/403', r.status === 400 || r.status === 403, `status=${r.status}`);
  r = await api('POST', '/api/auth/register', null, { name: 'X', email: 'not-an-email', password: 'password123' });
  ok('bad email → 400', r.status === 400, `status=${r.status}`);
  r = await api('POST', '/api/auth/register', null, { name: 'X', email: `short_${tag}@test.local`, password: '123' });
  ok('short password → 400', r.status === 400, `status=${r.status}`);

  console.log('[2] login');
  r = await api('POST', '/api/auth/login', null, { email, password: 'wrongpw123' });
  ok('wrong password → 401 generic', r.status === 401 && r.json?.message === 'Invalid credentials', `status=${r.status}`);
  r = await api('POST', '/api/auth/login', null, { email: `nobody_${tag}@test.local`, password: 'password123' });
  ok('unknown user → 401 identical (no enumeration)', r.status === 401 && r.json?.message === 'Invalid credentials', `status=${r.status}`);
  r = await api('POST', '/api/auth/login', null, { email, password: 'password123' });
  ok('login 200 + pair', r.status === 200 && !!r.json?.token && !!r.json?.refreshToken, `status=${r.status}`);
  const token = r.json.token;
  let refresh = r.json.refreshToken;

  console.log('[3] token acceptance');
  r = await api('GET', '/api/auth/me', null);
  ok('no token → 401', r.status === 401, `status=${r.status}`);
  r = await api('GET', '/api/auth/me', 'garbage.token.here');
  ok('malformed → 401', r.status === 401, `status=${r.status}`);
  r = await api('GET', '/api/auth/me', token);
  ok('valid → 200, no hashes', r.status === 200 && !r.json?.passwordHash && !r.json?.refreshToken, `hasHash=${!!r.json?.passwordHash} hasRT=${!!r.json?.refreshToken}`);

  console.log('[4] refresh rotation');
  r = await api('POST', '/api/auth/refresh-token', null, { refreshToken: refresh });
  ok('valid refresh → 200 new pair', r.status === 200 && !!r.json?.token && !!r.json?.refreshToken && r.json.refreshToken !== refresh, `status=${r.status}`);
  const token2 = r.json.token;
  r = await api('POST', '/api/auth/refresh-token', null, { refreshToken: refresh });
  ok('old refresh replay → 401 (rotation enforced)', r.status === 401, `status=${r.status}`);
  r = await api('GET', '/api/auth/me', token2);
  ok('rotated access works', r.status === 200, `status=${r.status}`);

  console.log('[5] authorization boundaries');
  r = await api('GET', '/api/admin/restaurants', token2);
  ok('customer on admin route → 403', r.status === 403, `status=${r.status}`);

  console.log('[6] password change revokes sessions');
  // Fresh live refresh token (rotation in [4] already killed the original)
  r = await api('POST', '/api/auth/login', null, { email, password: 'password123' });
  const liveRT = r.json.refreshToken;
  r = await api('POST', '/api/auth/change-password', token2, { currentPassword: 'password123', newPassword: 'password456' });
  ok('change ok + new refresh issued', r.status === 200 && !!r.json?.refreshToken, `status=${r.status}`);
  r = await api('POST', '/api/auth/refresh-token', null, { refreshToken: liveRT });
  ok('pre-change refresh dead → 401', r.status === 401, `status=${r.status}`);
  r = await api('POST', '/api/auth/login', null, { email, password: 'password123' });
  ok('old password dead → 401', r.status === 401, `status=${r.status}`);
  r = await api('POST', '/api/auth/login', null, { email, password: 'password456' });
  ok('new password works', r.status === 200, `status=${r.status}`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
