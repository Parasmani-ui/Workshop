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

export const io = new Server(server, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ['GET', 'POST'],
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
