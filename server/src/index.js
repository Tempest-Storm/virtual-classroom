import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { initSockets } from './sockets/classroom.js';
import { UPLOAD_DIR } from './middleware/upload.js';

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));   // face descriptors are ~4 KB each
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

app.use('/api', rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }));

// Socket.IO instance made available to controllers for realtime pushes.
const io = initSockets(server);
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(async () => {
    // On a fresh hosted database, load the demo data once (SEED_ON_START=true).
    if (env.seedOnStart) {
      try {
        const { seedIfEmpty } = await import('./utils/seed.js');
        await seedIfEmpty();
      } catch (err) {
        console.error('[seed] auto-seed failed:', err.message);
      }
    }
    server.listen(env.port, () => {
      console.log(`[api] http://localhost:${env.port}/api  (${env.nodeEnv})`);
    });
  })
  .catch((err) => {
    console.error('[db] connection failed:', err.message);
    process.exit(1);
  });

const shutdown = (signal) => () => {
  console.log(`\n[api] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));

export { app, server, io };
