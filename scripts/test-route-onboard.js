// Route onboarding probe: register owner, restaurant w/ payout, then create linked account.
// Run: node scripts/test-route-onboard.js
const BASE = process.env.TEST_BASE || 'http://localhost:5000';

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
  const tag = Date.now().toString(36);
  let r = await api('POST', '/api/auth/register', null, { name: 'Route Owner', email: `route_${tag}@test.local`, password: 'password123', role: 'restaurant', phone: '9876500001' });
  const tok = r.json?.token;
  console.log('register:', r.status);
  r = await api('POST', '/api/restaurants', tok, { name: `Route Kitchen ${tag}`, address: 'Test Street, Pune', phone: '9876500001' });
  const restId = r.json?._id;
  console.log('restaurant:', r.status, restId);
  r = await api('PUT', `/api/restaurants/${restId}/payout`, tok, { payoutMode: 'BANK', payoutAccountHolder: 'Route Kitchen', payoutAccountNumber: `410200${String(Date.now()).slice(-6)}`, payoutIfsc: 'HDFC0001234', payoutBankName: 'HDFC Bank' });
  console.log('payout:', r.status);
  r = await api('POST', `/api/restaurants/${restId}/route-account`, tok, { pan: 'AFDHK1234F' });
  console.log('route-account:', r.status);
  console.log(JSON.stringify(r.json, null, 1)?.slice(0, 900));
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
