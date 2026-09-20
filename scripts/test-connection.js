require('ts-node').register({ transpileOnly: true });
const mongoose = require('mongoose');

async function test() {
  // Load env from both locations (same logic as server)
  const path = require('path');
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../apps/server/.env'), override: true });
  dotenv.config({ override: true });

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/easycart';
  console.log('Testing URI:', uri.replace(/:\/\/.*@/, '://***:***@'));

  try {
    const conn = await mongoose.connect(uri);
    console.log('✅ Connected — host:', conn.connection.host, 'db:', conn.connection.name);

    const db = conn.connection.db;
    const existing = await db.listCollections().toArray();
    console.log('Existing collections:', existing.map(c => c.name).join(', ') || '(none)');

    // Ensure 4 collections exist (Mongoose auto-creates on first insert, but we create explicitly)
    const required = ['users', 'restaurants', 'menuitems', 'orders'];
    for (const name of required) {
      if (!existing.find(c => c.name === name)) {
        await db.createCollection(name);
        console.log(`Created collection: ${name}`);
      } else {
        console.log(`Collection exists: ${name}`);
      }
    }

    // Show counts and indexes
    for (const name of required) {
      const count = await db.collection(name).countDocuments();
      const indexes = await db.collection(name).indexes();
      console.log(`- ${name}: ${count} docs, indexes: ${indexes.map(i=>JSON.stringify(i.key)).join(', ')}`);
    }

    // Quick query test (raw collection, no TS import)
    const sample = await db.collection('users').findOne({}, { projection: { email: 1, role: 1 } });
    console.log('Sample user:', sample || '(none — run seed)');

    await mongoose.disconnect();
    console.log('✅ Test passed — collections ready. Run seed to populate: npx ts-node --transpile-only apps/server/src/utils/seed.ts');
  } catch (e) {
    console.error('❌ CONNECT_FAIL:', e.message);
    if (e.message.includes('authentication')) console.log('→ Check Atlas username/password & URL-encode special chars');
    if (e.message.includes('IP')) console.log('→ Atlas Network Access: Add IP 0.0.0.0/0');
    if (e.message.includes('ENOTFOUND')) console.log('→ Check cluster hostname in URI');
    process.exit(1);
  }
}
test();
