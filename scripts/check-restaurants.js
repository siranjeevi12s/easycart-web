// Read-only diagnostic: list restaurants and their payout/payment readiness.
// Run: node scripts/check-restaurants.js
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.collection('restaurants');
  const list = await col.find({}).project({ name: 1, isOpen: 1, isActive: 1, isDeleted: 1, payoutEnabled: 1, payoutMode: 1, payoutUpiId: 1, razorpayLinkedAccountId: 1, ownerId: 1 }).toArray();
  console.log(`total restaurants: ${list.length}`);
  for (const r of list) {
    console.log(`- ${r.name} | open=${r.isOpen} active=${r.isActive} deleted=${r.isDeleted} | payout=${!!r.payoutEnabled} mode=${r.payoutMode || '-'} upi=${r.payoutUpiId || '-'} route=${r.razorpayLinkedAccountId || '-'}`);
  }
  const items = await mongoose.connection.collection('menuitems').aggregate([
    { $group: { _id: '$restaurantId', count: { $sum: 1 }, available: { $sum: { $cond: ['$isAvailable', 1, 0] } } } },
  ]).toArray();
  console.log(`\nrestaurants with menu: ${items.length}`);
  for (const m of items) console.log(`- rest=${m._id} items=${m.count} available=${m.available}`);
  await mongoose.disconnect();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
