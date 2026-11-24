import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { conversationIdFor, type WsClientMessage, type WsServerMessage } from '@smm/shared';
import { db } from './db';
import { areBlocked, areFriends } from './auth';
import { router } from './routes';
import { registerSocket, sendToUser } from './wsHub';

const PORT = Number(process.env.PORT || 8787);
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (_req, res) => {
  res.redirect('/dual.html');
});
app.use('/api', router);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let secureId: string | null = null;

  ws.on('message', (raw) => {
    let msg: WsClientMessage;
    try {
      const parsed = JSON.parse(String(raw));
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message' } satisfies WsServerMessage));
        return;
      }
      msg = parsed;
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' } satisfies WsServerMessage));
      return;
    }

    if (msg.type === 'auth') {
      const row = db
        .prepare('SELECT secure_id FROM identities WHERE secure_id = ? AND device_token = ?')
        .get(msg.secureId, msg.token) as { secure_id: string } | undefined;
      if (!row) {
        secureId = null;
        ws.send(JSON.stringify({ type: 'auth.error', error: 'Unauthorized' } satisfies WsServerMessage));
        return;
      }
      secureId = row.secure_id;
      registerSocket(secureId, ws);
      ws.send(JSON.stringify({ type: 'auth.ok' } satisfies WsServerMessage));
      return;
    }

    if (!secureId) {
      ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' } satisfies WsServerMessage));
      return;
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' } satisfies WsServerMessage));
      return;
    }

    if (msg.type === 'typing') {
      const parts = String(msg.conversationId || '').split(':');
      const peer = parts.find((p) => p && p !== secureId);
      if (!peer) return;
      if (conversationIdFor(secureId, peer) !== msg.conversationId) return;
      if (!areFriends(secureId, peer) || areBlocked(secureId, peer)) return;
      sendToUser(peer, {
        type: 'typing',
        conversationId: msg.conversationId,
        fromSecureId: secureId,
        isTyping: Boolean(msg.isTyping),
      });
      return;
    }

    if (msg.type === 'message.ack') {
      if (!['delivered', 'read'].includes(msg.status)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid ack status' } satisfies WsServerMessage));
        return;
      }
      const row = db.prepare('SELECT * FROM message_envelopes WHERE id = ?').get(msg.messageId) as any;
      if (!row || row.recipient_secure_id !== secureId) return;
      const currentRank = STATUS_RANK[row.status] ?? 0;
      const nextRank = STATUS_RANK[msg.status] ?? 0;
      if (nextRank < currentRank) return;
      db.prepare('UPDATE message_envelopes SET status = ? WHERE id = ?').run(msg.status, msg.messageId);
      sendToUser(row.sender_secure_id, {
        type: 'message.status',
        messageId: msg.messageId,
        status: msg.status,
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Secure Mesh Messenger API listening on http://0.0.0.0:${PORT}`);
  console.log(`Local:     http://localhost:${PORT}/api/health`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});
