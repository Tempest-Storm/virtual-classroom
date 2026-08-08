import { io } from 'socket.io-client';
import { tokenStore, getServerBase } from './client.js';

let socket = null;

// Follows the same runtime-configurable origin as the REST client.
function socketUrl() {
  return getServerBase() || import.meta.env.VITE_SOCKET_URL || '/';
}

export function getSocket() {
  if (socket?.connected || socket?.connecting) return socket;

  const url = socketUrl();
  const bypass = /\bloca\.lt\b/.test(url);

  socket = io(url, {
    auth: { token: tokenStore.get() },
    // Poll first so the handshake carries the tunnel-bypass header, then
    // upgrade to websocket on the established session.
    transports: bypass ? ['polling', 'websocket'] : ['websocket', 'polling'],
    ...(bypass ? { extraHeaders: { 'Bypass-Tunnel-Reminder': 'true' } } : {}),
    reconnectionAttempts: 5,
  });

  socket.on('connect_error', (err) => console.warn('[socket]', err.message));
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
