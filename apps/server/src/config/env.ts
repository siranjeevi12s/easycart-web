import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../apps/server/.env'), override: true });
dotenv.config({ override: true });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/easycart',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-me-32-chars-min',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-32-chars-min',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  // Marketplace / commission settings
  // Example: ₹500 order @ 5% -> platform ₹25, restaurant ₹475
  PLATFORM_FEE_PERCENT: parseFloat(process.env.PLATFORM_FEE_PERCENT || '5'),
  // When true AND restaurant has razorpayLinkedAccountId, orders are created
  // with Route transfers[] so Razorpay auto-splits to the linked account.
  RAZORPAY_ROUTE_ENABLED: (process.env.RAZORPAY_ROUTE_ENABLED || 'false').toLowerCase() === 'true',
  // Deep-link scheme the hosted checkout page redirects to after payment
  APP_DEEP_SCHEME: process.env.APP_DEEP_SCHEME || 'easycart',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
};