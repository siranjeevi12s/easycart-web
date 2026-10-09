import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';

import authRoutes from './routes/auth';
import restaurantRoutes from './routes/restaurants';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import { notFound, errorHandler } from './middleware/error';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
  // Our hosted checkout pages run inline scripts + load the Razorpay SDK
  // and bank/3DS frames. Helmet's default script-src 'self' would
  // silently kill them (dead Pay button, no error on screen).
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
      'connect-src': ["'self'", 'https://checkout.razorpay.com', 'https://api.razorpay.com'],
      'frame-src': ["'self'", 'https://checkout.razorpay.com', 'https://api.razorpay.com'],
      'form-action': ["'self'", 'https://checkout.razorpay.com'],
      'img-src': ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if ((env.CORS_ORIGIN as any).includes(origin) || origin.startsWith('exp://') || origin.startsWith('http://10.') || origin.startsWith('http://192.168.')) return cb(null, true);
    return cb(null, true);
  },
  credentials: true
}));
// Webhook HMACs are computed over RAW bytes — capture before express.json().
// body-parser skips already-parsed requests, so later express.json() is unaffected.
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});
app.use(limiter);

// Credential endpoints get their own tight bucket. Only FAILURES count —
// legitimate users log in once and never trip it; password spraying (all 401/400)
// burns through 30 attempts per 15min per IP and gets cut off.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many auth attempts, please try again in 15 minutes' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;