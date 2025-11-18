import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io('/', {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: localStorage.getItem('token') || '' }
  });
  return socket;
}
