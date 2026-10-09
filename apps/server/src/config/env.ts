import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/easycart',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-me-32-chars-min',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret-change-me-32-chars',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  RAZORPAY_ROUTE_ENABLED: (process.env.RAZORPAY_ROUTE_ENABLED || 'false') === 'true',
  PLATFORM_FEE_PERCENT: Number(process.env.PLATFORM_FEE_PERCENT || '0'),
  APP_DEEP_SCHEME: process.env.APP_DEEP_SCHEME || 'easycart',
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
};

// Production fail-fast: booting with dev-default secrets means anyone holding
// this repo can forge tokens. Crash loudly instead of running insecure.
if (env.NODE_ENV === 'production') {
  const required: Array<[string, string]> = [
    ['JWT_SECRET', env.JWT_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
    ['MONGODB_URI', env.MONGODB_URI],
  ];
  for (const [name, value] of required) {
    if (!value || /dev-|dummy|change-me|localhost/.test(value)) {
      throw new Error(`[env] ${name} must be set to a real value in production (refusing to boot with dev default)`);
    }
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('[env] JWT_SECRET and JWT_REFRESH_SECRET must differ in production');
  }
}
