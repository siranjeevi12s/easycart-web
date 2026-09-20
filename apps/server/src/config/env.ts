import dotenv from 'dotenv';
import path from 'path';
// Load root .env first, then apps/server/.env with override so Atlas URI in either file wins
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../apps/server/.env'), override: true });
dotenv.config({ override: true });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/easycart',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-me-32-chars-min',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
};
