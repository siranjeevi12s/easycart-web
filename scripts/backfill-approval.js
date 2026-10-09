// One-time backfill: pre-approval restaurants were implicitly live — mark them
// approved so the new public-listing gate changes nothing for existing kitchens.
// New restaurants still start 'pending'. Run: node scripts/backfill-approval.js
// (Run locally AND against production data after deploying the admin build.)
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

try {
  const envPath = path.join(__dirname, '..', 'apps', 'server', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch {}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection;
  const r = await db.collection('restaurants').updateMany(
    { approvalStatus: { $exists: false } },
    { $set: { approvalStatus: 'approved' } }
  );
  console.log(`restaurants backfilled to approved: ${r.modifiedCount}`);
  const pending = await db.collection('restaurants').countDocuments({ approvalStatus: { $ne: 'approved' } });
  console.log(`restaurants NOT approved (new/pending queue): ${pending}`);
  await mongoose.disconnect();
  console.log('done');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
