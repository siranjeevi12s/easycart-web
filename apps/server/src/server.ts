import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { initSocket } from './sockets';

const start = async () => {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${env.PORT}`);
    console.log(`   Health: http://localhost:${env.PORT}/health`);
    console.log(`   DB: ${env.MONGODB_URI.includes('mongodb+srv') ? 'Atlas' : 'localhost'} -> ${env.MONGODB_URI.split('@')[1]?.split('/')[0] || 'local'}`);
  });
  // Promo scheduler: activate due campaigns + expire finished ones (every 5 min)
  const sweep = () =>
    import('./controllers/promoController')
      .then((m) => m.sweepPromos())
      .then((r) => {
        if (r.activated || r.expired) console.log(`[promos] sweep: +${r.activated} active, -${r.expired} expired`);
      })
      .catch((e) => console.error('[promos] sweep failed:', e?.message || e));
  const sweepTimer = setInterval(sweep, 5 * 60 * 1000);
  sweepTimer.unref?.();
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') console.error(`❌ Port ${env.PORT} in use — run: taskkill /F /IM node.exe`);
    else console.error('Server error:', err);
    process.exit(1);
  });
};

start().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await import('mongoose').then((m) => m.default.disconnect());
  process.exit(0);
});
