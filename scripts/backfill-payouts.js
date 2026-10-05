// One-time backfill: enable demo payouts on restaurants created before the
// payout feature existed. ONLY touches docs where payoutEnabled != true.
// Never overwrites existing payout details. Run: node scripts/backfill-payouts.js
const mongoose = require('mongoose');

const slug = (s) => String(s || 'shop').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'shop';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.collection('restaurants');
  const missing = await col.find({ $or: [{ payoutEnabled: false }, { payoutEnabled: { $exists: false } }], isDeleted: { $ne: true } })
    .project({ name: 1 }).toArray();
  console.log(`restaurants needing payouts: ${missing.length}`);
  let updated = 0;
  for (const r of missing) {
    const upi = `${slug(r.name)}@okhdfcbank`;
    const res = await col.updateOne({ _id: r._id, payoutEnabled: { $ne: true } }, {
      $set: {
        payoutMode: 'UPI',
        payoutUpiId: upi,
        payoutEnabled: true,
        payoutVerified: true,
        payoutUpdatedAt: new Date(),
      },
    });
    if (res.modifiedCount > 0) { updated++; console.log(`  ✅ ${r.name} -> ${upi}`); }
  }
  console.log(`done: ${updated} updated, ${missing.length - updated} skipped (already set)`);
  await mongoose.disconnect();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
