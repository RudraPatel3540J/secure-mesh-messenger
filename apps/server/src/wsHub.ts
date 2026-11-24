import { WebSocket } from 'ws';
import type { WsServerMessage } from '@smm/shared';

const sockets = new Map<string, Set<WebSocket>>();

export function registerSocket(secureId: string, ws: WebSocket) {
  const set = sockets.get(secureId) || new Set();
  set.add(ws);
  sockets.set(secureId, set);
  ws.on('close', () => {
    set.delete(ws);
    if (set.size === 0) sockets.delete(secureId);
  });
}

export function sendToUser(secureId: string, message: WsServerMessage) {
  const set = sockets.get(secureId);
  if (!set) return false;
  const payload = JSON.stringify(message);
  let delivered = false;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      delivered = true;
    }
  }
  return delivered;
}

export function isOnline(secureId: string): boolean {
  const set = sockets.get(secureId);
  if (!set) return false;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) return true;
  }
  return false;
}
