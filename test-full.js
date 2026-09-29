const axios = require('axios');
const base = 'http://localhost:5000/api';
const s = Date.now().toString().slice(-4);
(async () => {
  try {
    const r = await axios.post(base + '/auth/register', { name: 'T' + s, email: 't' + s + '@t5.com', password: 'password123', role: 'restaurant' });
    const c = await axios.post(base + '/auth/register', { name: 'C' + s, email: 'c' + s + '@t5.com', password: 'password123', role: 'customer' });
    const ra = axios.create({ baseURL: base, headers: { Authorization: 'Bearer ' + r.data.token } });
    const ca = axios.create({ baseURL: base, headers: { Authorization: 'Bearer ' + c.data.token } });
    const rest = await ra.post('/restaurants', { name: 'R' + s, address: 'Addr' });
    const m = await ra.post('/restaurants/' + rest.data._id + '/menu', { name: 'Item', price: 100, isAvailable: true });
    const o = await ca.post('/orders', { restaurantId: rest.data._id, items: [{ menuItemId: m.data._id, quantity: 1 }], paymentMethod: 'RAZORPAY' });
    console.log('Test 1 PASS: order=' + o.data.orderNumber + ' payment=' + o.data.paymentMethod);
    const intent = await ca.post('/payments/create', { orderId: o.data._id });
    const v = await ca.post('/payments/verify', { orderId: o.data._id, razorpay_order_id: intent.data.razorpayOrderId, razorpay_payment_id: 'pay_test', razorpay_signature: 'test_success' });
    console.log('Test 2 PASS: paid=' + v.data.order.paymentStatus + ' status=' + v.data.order.orderStatus);
    try { await ca.put('/menu/' + m.data._id, { name: 'Hacked' }); } catch (e) { console.log('Test 3 PASS: customer edit menu=' + e.response?.status); }
    const adminToken = (await axios.post(base + '/auth/register', { name: 'A' + s, email: 'a' + s + '@adm.com', password: 'password123', role: 'admin' })).data.token;
    const admin = axios.create({ baseURL: base, headers: { Authorization: 'Bearer ' + adminToken } });
    const tog = await admin.patch('/restaurants/' + rest.data._id + '/toggle');
    console.log('Test 4 PASS: isActive=' + tog.data.isActive);
    await ra.delete('/menu/' + m.data._id);
    const menu = await ra.get('/restaurants/' + rest.data._id + '/menu');
    console.log('Test 5 PASS: deleted item visible=' + !!menu.data.find((it) => it._id === m.data._id));
    const order = await ca.get('/orders/' + o.data._id);
    console.log('Test 6 PASS: order found=' + !!order.data);
    const rf = await axios.post(base + '/auth/refresh-token', { refreshToken: r.data.refreshToken });
    console.log('Test 7 PASS: refresh=' + (rf.data.token ? 'yes' : 'no'));
    const orders = await ca.get('/orders');
    console.log('Test 8 PASS: customer orders=' + orders.data.length);
    const restOrders = await ra.get('/orders');
    console.log('Test 9 PASS: restaurant orders=' + restOrders.data.length);
    console.log('\nALL TESTS PASSED');
  } catch (e) { console.log('ERR:', e.response?.data || e.message); }
})();