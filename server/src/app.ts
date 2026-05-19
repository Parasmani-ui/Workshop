/**
 * @fileoverview Express application setup.
 * Configures middleware, mounts route modules, and attaches the global error handler.
 * Does NOT call listen() — that is handled by server.ts.
 */

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import { authRouter } from './routes/auth.routes';
import { gamesRouter } from './routes/games.routes';
import { scenariosRouter } from './routes/scenarios.routes';
import { engineRouter } from './routes/engine.routes';

const app = express();

// --------------- Middleware ---------------
const allowedOrigins = config.CLIENT_URL
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes('*')) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------- Health Check ---------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '1.0.0',
    engine: {
      modules: 10,
      implemented: 0,
      status: 'stubs only — ready for implementation',
    },
  });
});

// --------------- Routes ---------------
// Auth (register, login, me, join-game)
app.use('/api/auth', authRouter);

// Games (nests /teams, /decisions, /reports, /leaderboard sub-routes)
app.use('/api/games', gamesRouter);

// Standalone routes
app.use('/api/scenarios', scenariosRouter);
app.use('/api/engine', engineRouter);

// --------------- Global Error Handler ---------------
app.use(errorHandler);

export default app;
