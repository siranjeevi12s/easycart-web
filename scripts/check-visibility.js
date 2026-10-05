// Diagnose: recent orders vs restaurant owners + Razorpay test-mode ledger.
// Run: node scripts/check-visibility.js
const mongoose = require('mongoose');
const path = require('path');
const DIST = path.join(__dirname, '..', 'apps', 'server', 'dist');
// npm workspaces hoist deps to repo root
const M = require(path.join(DIST, '..', '..', '..', 'node_modules', 'mongoose'));
const { Order } = require(path.join(DIST, 'models', 'Order'));
const { Restaurant } = require(path.join(DIST, 'models', 'Restaurant'));
const { User } = require(path.join(DIST, 'models', 'User'));

(async () => {
  await M.connect(process.env.MONGODB_URI);
  const orders = await Order.find({}).sort({ createdAt: -1 }).limit(10);
  console.log(`latest ${orders.length} orders:`);
  for (const o of orders) {
    const r = await Restaurant.findById(o.restaurantId).select('name ownerId');
    const owner = r ? await User.findById(r.ownerId).select('email') : null;
    console.log(`- ${o.orderNumber} pay=${o.paymentStatus} status=${o.orderStatus} rest=[${r?.name}] owner=${owner?.email} cust=${o.customerId}`);
  }
  console.log('\nowners with restaurants:');
  const rests = await Restaurant.find({ isDeleted: { $ne: true } }).select('name ownerId');
  const byOwner = new Map();
  for (const r of rests) {
    const k = r.ownerId.toString();
    if (!byOwner.has(k)) {
      const u = await User.findById(r.ownerId).select('email');
      byOwner.set(k, { email: u?.email, names: [] });
    }
    byOwner.get(k).names.push(r.name);
  }
  for (const v of byOwner.values()) console.log(`- ${v.email}: ${v.names.slice(0, 5).join(', ')}${v.names.length > 5 ? ` (+${v.names.length - 5} more)` : ''}`);
  await M.disconnect();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
