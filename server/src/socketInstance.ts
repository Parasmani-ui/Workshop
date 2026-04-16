/**
 * Singleton Socket.IO server instance.
 * Separated from server.ts to avoid circular dependency:
 * server.ts → app.ts → routes → controllers → io
 */

import { Server } from 'socket.io';

let _io: Server;

export function setIO(io: Server): void {
  _io = io;
}

export function getIO(): Server {
  if (!_io) throw new Error('Socket.IO not initialized — call setIO first');
  return _io;
}
