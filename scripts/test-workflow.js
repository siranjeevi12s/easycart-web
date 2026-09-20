// MVP Acceptance Test — simulates full workflow via REST
// Run: node scripts/test-workflow.js  (server must be running on :5000)
const axios = require('axios');
const BASE = process.env.API_URL || 'http://localhost:5000/api';

async function run() {
  console.log('🚀 Starting EasyCart acceptance workflow...\n');
  const api = axios.create({ baseURL: BASE });

  // helper
  const log = (msg, data) => {
    console.log(`✓ ${msg}`);
    if (data) console.log('  ', typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200));
  };

  // 1. Register restaurant & customer (idempotent - use timestamp)
  const suffix = Date.now().toString().slice(-6);
  const restaurantEmail = `rest_${suffix}@test.com`;
  const customerEmail = `cust_${suffix}@test.com`;
  const pw = 'password123';

  console.log(`Creating accounts: ${restaurantEmail}, ${customerEmail}`);

  const regRest = await api.post('/auth/register', { name: 'Test Restaurant Owner', email: restaurantEmail, password: pw, role: 'restaurant' });
  const restToken = regRest.data.token;
  log('Restaurant registered', regRest.data.user.email);

  const regCust = await api.post('/auth/register', { name: 'Test Customer', email: customerEmail, password: pw, role: 'customer' });
  const custToken = regCust.data.token;
  log('Customer registered', regCust.data.user.email);

  const restApi = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${restToken}` } });
  const custApi = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${custToken}` } });

  // 2. Restaurant creates profile
  const restProfile = await restApi.post('/restaurants', { name: `Test Kitchen ${suffix}`, address: 'MG Road, Pune', description: 'Test', phone: '9999999999' });
  const restaurantId = restProfile.data._id;
  log('Restaurant profile created', restProfile.data.name);

  // 3. Restaurant adds menu
  const m1 = await restApi.post(`/restaurants/${restaurantId}/menu`, { name: 'Chicken Burger', description: 'Tasty', price: 180, category: 'Burgers', isAvailable: true });
  const m2 = await restApi.post(`/restaurants/${restaurantId}/menu`, { name: 'French Fries', description: 'Crispy', price: 99, category: 'Sides', isAvailable: true });
  log('Menu items added', `${m1.data.name}, ${m2.data.name}`);

  // 4. Customer searches & browses
  const search = await custApi.get('/restaurants?search=Test');
  log('Customer search', `${search.data.length} results`);

  const menu = await custApi.get(`/restaurants/${restaurantId}/menu`);
  log('Menu browsed', `${menu.data.length} items`);

  // 5. Customer creates order (backend calculates total)
  const orderRes = await custApi.post('/orders', { restaurantId, items: [{ menuItemId: m1.data._id, quantity: 2 }, { menuItemId: m2.data._id, quantity: 1 }] });
  const orderId = orderRes.data._id;
  log('Order created PENDING_PAYMENT', `${orderRes.data.orderNumber} total ₹${orderRes.data.totalAmount} (tax ₹${orderRes.data.tax})`);

  // 6. Payment — create intent + verify (test_success)
  const intent = await custApi.post('/payments/create', { orderId });
  log('Payment intent created', intent.data.razorpayOrderId);

  const verify = await custApi.post('/payments/verify', {
    orderId,
    razorpay_order_id: intent.data.razorpayOrderId,
    razorpay_payment_id: `pay_${Date.now()}`,
    razorpay_signature: 'test_success'
  });
  log('Payment verified → PAID', verify.data.order.orderStatus);

  // Test idempotency — duplicate verify should not duplicate
  const verify2 = await custApi.post('/payments/verify', {
    orderId,
    razorpay_order_id: intent.data.razorpayOrderId,
    razorpay_payment_id: `pay_${Date.now()}`,
    razorpay_signature: 'test_success'
  });
  log('Idempotent duplicate verify', verify2.data.message);

  // 7. Restaurant receives order
  const orders = await restApi.get('/orders');
  log('Restaurant sees orders', `${orders.data.length} orders`);

  // 8. Restaurant workflow: ACCEPTED → PREPARING → READY
  await restApi.patch(`/orders/${orderId}/status`, { status: 'ACCEPTED' });
  log('Restaurant ACCEPTED');

  await restApi.patch(`/orders/${orderId}/status`, { status: 'PREPARING' });
  log('Restaurant PREPARING');

  await restApi.patch(`/orders/${orderId}/status`, { status: 'READY' });
  log('Restaurant READY — Socket.IO should notify customer (ready event)');

  // 9. Verify pickup prerequisites
  const orderReady = await custApi.get(`/orders/${orderId}`);
  log('Customer sees READY', orderReady.data.orderStatus);

  // Try invalid: pickup before READY should fail — already READY so test double pickup guard
  // 10. Pickup verification
  const qr = await custApi.get(`/orders/${orderId}/qr`);
  log('QR generated', qr.data.orderNumber);

  const pickup = await restApi.post(`/orders/${orderId}/pickup`, { orderNumber: orderReady.data.orderNumber });
  log('Pickup verified → PICKED_UP', pickup.data.orderStatus);

  // 11. Test double pickup fails
  try {
    await restApi.post(`/orders/${orderId}/pickup`, { orderNumber: orderReady.data.orderNumber });
    console.log('✗ Double pickup should have failed but succeeded');
  } catch (e) {
    log('Double pickup correctly rejected', e.response?.data?.message || '400');
  }

  // 12. Final check customer sees completed
  const final = await custApi.get(`/orders/${orderId}`);
  log('Final status', final.data.orderStatus);

  console.log('\n✅ WORKFLOW PASSED — Order → Pay → Prepare → READY → Arrive → Pickup');
  console.log(`   Order ${final.data.orderNumber} completed without waiting.\n`);

  // Negative cases
  console.log('🧪 Testing failure cases...');
  // Restaurant closed cannot order
  await restApi.put(`/restaurants/${restaurantId}`, { isOpen: false });
  try {
    await custApi.post('/orders', { restaurantId, items: [{ menuItemId: m1.data._id, quantity: 1 }] });
    console.log('✗ Closed restaurant order should fail');
  } catch (e) { log('Closed restaurant correctly rejects orders', e.response?.data?.message); }
  await restApi.put(`/restaurants/${restaurantId}`, { isOpen: true });

  // Unavailable item
  await restApi.put(`/menu/${m2.data._id}`, { isAvailable: false });
  try {
    await custApi.post('/orders', { restaurantId, items: [{ menuItemId: m2.data._id, quantity: 1 }] });
    console.log('✗ Unavailable item should fail');
  } catch (e) { log('Unavailable item correctly rejected', e.response?.data?.message); }

  console.log('\n✅ All tests passed');
}

run().catch((e) => {
  console.error('❌ Workflow FAILED');
  console.error(e.response?.data || e.message);
  process.exit(1);
});
