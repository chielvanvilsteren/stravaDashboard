'use strict';

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import webhookRouter from './routes/webhook.js';
import activitiesRouter from './routes/activities.js';
import setupRouter from './routes/setup.js';
import { authRateLimiter } from './middleware/rateLimiter.js';
import { requireAuth } from './middleware/requireAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://dgalywyr863hv.cloudfront.net'], // Strava avatars
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

// ── CORS — alleen eigen origin in productie ───────────────────────────────────
const allowedOrigin = process.env.APP_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET not set');
  process.exit(1);
}
app.use(cookieParser(process.env.SESSION_SECRET));

// ── Routes ────────────────────────────────────────────────────────────────────
// Auth endpoints — rate-limited
app.use('/auth', authRateLimiter, authRouter);

// Strava OAuth setup (eenmalig)
app.use('/setup', setupRouter);

// Strava webhook — geen auth (Strava belt ons op)
app.use('/webhook', webhookRouter);

// Protected API — requireAuth middleware
app.use('/api', requireAuth, activitiesRouter);

// Health check — voor Render
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve frontend (dist/) voor alle overige routes ───────────────────────────
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// ── Error handler — lekt nooit stack traces in productie ──────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  res.status(statusCode).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV})`);
});

export default app;
