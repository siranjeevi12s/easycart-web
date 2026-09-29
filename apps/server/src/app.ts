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

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if ((env.CORS_ORIGIN as any).includes(origin) || origin.startsWith('exp://') || origin.startsWith('http://10.') || origin.startsWith('http://192.168.')) return cb(null, true);
    return cb(null, true);
  },
  credentials: true
}));
// Razorpay signs the RAW webhook bytes — capture them before express.json().
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