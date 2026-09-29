import mongoose from 'mongoose';
import { env } from './env';

export const connectDB = async (retries = 5) => {
  if (!env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing in .env');
    process.exit(1);
  }
  const masked = env.MONGODB_URI.replace(/:\/\/.+@/, '://***:***@');
  console.log(`Connecting to MongoDB: ${masked}`);

  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  mongoose.connection.on('close', () => console.warn('MongoDB connection closed'));

  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000,
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
        heartbeatFrequencyMS: 10000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host} / db: ${conn.connection.name}`);
      return conn;
    } catch (err: any) {
      console.error(`❌ Attempt ${i}/${retries} failed: ${err.message}`);
      if (err.message.includes('authentication')) console.error('→ Check Atlas username/password (URL-encode @, :)');
      if (err.message.includes('ENOTFOUND') || err.message.includes('querySrv')) console.error('→ Check cluster hostname & internet');
      if (err.message.includes('IP') || err.message.includes('whitelist')) console.error('→ Atlas Network Access: Add IP 0.0.0.0/0');
      if (i === retries) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
};