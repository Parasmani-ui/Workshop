/**
 * @fileoverview Socket.IO event handler registration.
 * Defines real-time communication events between facilitator clients, team clients, and the server.
 * Each handler is a stub with TODO comments explaining the intended real logic.
 */

import { Server, Socket } from 'socket.io';

export function initSockets(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });

    /**
     * Facilitator locks a quarter so teams can no longer submit/edit decisions.
     * TODO: Validate facilitator auth, update game.currentQuarter status to 'locked' in DB,
     *       broadcast lock state to all team sockets in the game room.
     */
    socket.on('facilitator:lockQuarter', (data: { gameId: string; quarterNo: number }) => {
      console.log(`[Socket] facilitator:lockQuarter received`, data);
      io.to(data.gameId).emit('game:quarterLocked', {
        gameId: data.gameId,
        quarterNo: data.quarterNo,
      });
    });

    /**
     * Facilitator triggers quarter processing (runs the simulation engine).
     * TODO: Validate facilitator auth, invoke SimulationEngine.processQuarter(),
     *       stream progress updates via socket events, handle engine errors gracefully.
     */
    socket.on('facilitator:processQuarter', (data: { gameId: string; quarterNo: number }) => {
      console.log(`[Socket] facilitator:processQuarter received`, data);
      io.to(data.gameId).emit('game:processingStarted', {
        gameId: data.gameId,
        quarterNo: data.quarterNo,
      });
    });

    /**
     * Facilitator publishes processed results so teams can view their reports.
     * TODO: Validate facilitator auth, flip game quarter status to 'published',
     *       notify all team sockets that reports are now available.
     */
    socket.on('facilitator:publishResults', (data: { gameId: string; quarterNo: number }) => {
      console.log(`[Socket] facilitator:publishResults received`, data);
      io.to(data.gameId).emit('game:resultsPublished', {
        gameId: data.gameId,
        quarterNo: data.quarterNo,
      });
    });

    /**
     * Team submits their quarterly decision form.
     * TODO: Validate team auth, validate decision data against Zod schema,
     *       persist to decisions collection, notify facilitator of submission status.
     */
    socket.on('team:submitDecision', (data: { gameId: string; teamNo: number }) => {
      console.log(`[Socket] team:submitDecision received`, data);
      socket.emit('team:decisionReceived', {
        gameId: data.gameId,
        teamNo: data.teamNo,
        status: 'received',
      });
    });

    /**
     * Facilitator broadcasts an arbitrary message to all teams in a game room.
     * TODO: Validate facilitator auth, optionally persist message to a chat/log collection.
     */
    socket.on('facilitator:broadcast', (data: { gameId: string; message: string }) => {
      console.log(`[Socket] facilitator:broadcast received`, data);
      io.to(data.gameId).emit('facilitator:broadcast', {
        message: data.message,
      });
    });
  });
}
