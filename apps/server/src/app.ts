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
// Permissive CORS for MVP dev — allow Expo, localhost, and device IPs. Tighten for prod.
app.use(cors({ 
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // React Native has no origin
    if ((env.CORS_ORIGIN as any).includes(origin) || origin.startsWith('exp://') || origin.startsWith('http://10.') || origin.startsWith('http://192.168.')) return cb(null, true);
    return cb(null, true); // allow all in dev to avoid login blocked
  }, 
  credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));

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
