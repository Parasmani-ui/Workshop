import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const serverUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket(): Socket {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket(): void {
  socket?.disconnect()
}

export const socketEvents = {
  joinGame: (gameId: string) =>
    getSocket().emit('join:game', gameId),

  leaveGame: (gameId: string) =>
    getSocket().emit('leave:game', gameId),

  lockQuarter: (gameId: string, quarterNo: number) =>
    getSocket().emit('facilitator:lockQuarter', { gameId, quarterNo }),

  processQuarter: (gameId: string, quarterNo: number) =>
    getSocket().emit('facilitator:processQuarter', { gameId, quarterNo }),

  publishResults: (gameId: string, quarterNo: number) =>
    getSocket().emit('facilitator:publishResults', { gameId, quarterNo }),

  submitDecision: (gameId: string, teamNo: number, quarterNo: number) =>
    getSocket().emit('team:submitDecision', { gameId, teamNo, quarterNo }),

  broadcast: (gameId: string, message: string) =>
    getSocket().emit('facilitator:broadcast', { gameId, message }),
}
