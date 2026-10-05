// Read-only: paid orders vs settlement state.
// Run: node scripts/check-settlements.js
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const orders = await mongoose.connection.collection('orders')
    .find({ paymentStatus: 'PAID' }).sort({ createdAt: -1 }).limit(15)
    .project({ orderNumber: 1, totalAmount: 1, platformFee: 1, restaurantAmount: 1, paymentId: 1, restaurantId: 1, payoutStatus: 1, createdAt: 1 }).toArray();
  console.log(`PAID orders (latest ${orders.length}):`);
  for (const o of orders) {
    const st = await mongoose.connection.collection('settlements').findOne({ orderId: o._id });
    const rest = await mongoose.connection.collection('restaurants').findOne({ _id: o.restaurantId });
    console.log(`- ${o.orderNumber} ₹${o.totalAmount} (rest ₹${o.restaurantAmount ?? '?'} fee ₹${o.platformFee ?? '?'}) pay=${(o.paymentId || '-')?.toString().slice(0, 20)} rest=[${rest?.name}] settle=${st ? `${st.status} transfer=${st.transferId || '-'}` : 'NONE'} payoutStatus=${o.payoutStatus}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
