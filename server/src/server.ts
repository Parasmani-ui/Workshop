/**
 * @fileoverview Entry point — creates the HTTP server, attaches Socket.IO,
 * connects to MongoDB, and starts listening.
 */

import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { config } from './config/env';
import { connectDB } from './config/db';
import { initSockets } from './sockets/index';
import { setIO } from './socketInstance';

const server = http.createServer(app);

const ioAllowedOrigins = config.CLIENT_URL
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ioAllowedOrigins.includes('*')) return cb(null, true);
      if (ioAllowedOrigins.includes(origin)) return cb(null, true);
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setIO(io);
initSockets(io);

connectDB().then(() => {
  server.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
});

export default server;
