import { Router } from 'express';
import { nanoid } from 'nanoid';
import {
  conversationIdFor,
  deriveSecureId,
  isValidUsername,
  loginChallengePayload,
  normalizeUsername,
  registerProofPayload,
  verifyPayload,
  type PublicIdentity,
} from '@smm/shared';
import { db } from './db';
import {
  areBlocked,
  areFriends,
  AuthedRequest,
  canonicalPair,
  consumeLoginChallenge,
  createLoginChallenge,
  issueToken,
  requireAuth,
} from './auth';
import { sendToUser } from './wsHub';

export const router = Router();

function mapIdentity(row: any): PublicIdentity {
  return {
    secureId: row.secure_id,
    username: row.username,
    identityPublicKey: row.identity_public_key,
    signingPublicKey: row.signing_public_key,
    createdAt: row.created_at,
  };
}

const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1,
};

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'secure-mesh-messenger', version: '1.1.0' });
});

router.post('/identity/register', (req, res) => {
  const { secureId, username, identityPublicKey, signingPublicKey, proofSignature } = req.body || {};
  if (!secureId || !identityPublicKey || !signingPublicKey || !proofSignature) {
    return res.status(400).json({
      error: 'secureId, identityPublicKey, signingPublicKey, proofSignature required',
    });
  }

  let derived: string;
  try {
    derived = deriveSecureId(identityPublicKey);
  } catch {
    return res.status(400).json({ error: 'Invalid identityPublicKey' });
  }
  if (derived !== secureId) {
    return res.status(400).json({ error: 'secureId does not match identityPublicKey' });
  }

  const proof = registerProofPayload(secureId, identityPublicKey, signingPublicKey);
  if (!verifyPayload(proof, proofSignature, signingPublicKey)) {
    return res.status(401).json({ error: 'Invalid registration proof signature' });
  }

  const existing = db.prepare('SELECT secure_id FROM identities WHERE secure_id = ?').get(secureId);
  if (existing) {
    return res.status(409).json({ error: 'Identity already registered' });
  }

  const keyTaken = db
    .prepare('SELECT secure_id FROM identities WHERE identity_public_key = ?')
    .get(identityPublicKey);
  if (keyTaken) {
    return res.status(409).json({ error: 'Identity public key already registered' });
  }

  let cleanUsername: string | null = null;
  if (username) {
    cleanUsername = normalizeUsername(username);
    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    const taken = db
      .prepare('SELECT secure_id FROM identities WHERE username = ? COLLATE NOCASE')
      .get(cleanUsername);
    if (taken) return res.status(409).json({ error: 'Username taken' });
  }

  const token = issueToken();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO identities (secure_id, username, identity_public_key, signing_public_key, device_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(secureId, cleanUsername, identityPublicKey, signingPublicKey, token, createdAt);

  res.status(201).json({
    token,
    identity: {
      secureId,
      username: cleanUsername,
      identityPublicKey,
      signingPublicKey,
      createdAt,
    },
  });
});

router.post('/identity/challenge', (req, res) => {
  const secureId = String(req.body?.secureId || '');
  if (!secureId) return res.status(400).json({ error: 'secureId required' });
  const row = db.prepare('SELECT secure_id FROM identities WHERE secure_id = ?').get(secureId);
  if (!row) return res.status(404).json({ error: 'Identity not found' });
  const challenge = createLoginChallenge(secureId);
  res.json({
    secureId,
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
    payload: loginChallengePayload(secureId, challenge.nonce),
  });
});

router.post('/identity/login', (req, res) => {
  const { secureId, nonce, signature } = req.body || {};
  if (!secureId || !nonce || !signature) {
    return res.status(400).json({ error: 'secureId, nonce, signature required' });
  }
  const row = db.prepare('SELECT * FROM identities WHERE secure_id = ?').get(secureId) as any;
  if (!row) {
    return res.status(401).json({ error: 'Identity not found' });
  }
  if (!consumeLoginChallenge(secureId, nonce)) {
    return res.status(401).json({ error: 'Invalid or expired challenge' });
  }
  const payload = loginChallengePayload(secureId, nonce);
  if (!verifyPayload(payload, signature, row.signing_public_key)) {
    return res.status(401).json({ error: 'Invalid login signature' });
  }
  const token = issueToken();
  db.prepare('UPDATE identities SET device_token = ? WHERE secure_id = ?').run(token, secureId);
  res.json({ token, identity: mapIdentity(row) });
});

router.get('/identity/me', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM identities WHERE secure_id = ?').get(req.secureId) as any;
  res.json({ identity: mapIdentity(row) });
});

router.get('/identity/lookup', requireAuth, (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q required' });
  const row = db
    .prepare(
      `SELECT * FROM identities WHERE secure_id = ? OR username = ? COLLATE NOCASE LIMIT 1`,
    )
    .get(q, normalizeUsername(q)) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ identity: mapIdentity(row) });
});

router.patch('/identity/username', requireAuth, (req: AuthedRequest, res) => {
  const username = normalizeUsername(String(req.body?.username || ''));
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  const taken = db
    .prepare('SELECT secure_id FROM identities WHERE username = ? COLLATE NOCASE')
    .get(username) as any;
  if (taken && taken.secure_id !== req.secureId) {
    return res.status(409).json({ error: 'Username taken' });
  }
  db.prepare('UPDATE identities SET username = ? WHERE secure_id = ?').run(username, req.secureId);
  const row = db.prepare('SELECT * FROM identities WHERE secure_id = ?').get(req.secureId) as any;
  res.json({ identity: mapIdentity(row) });
});

router.post('/friends/request', requireAuth, (req: AuthedRequest, res) => {
  const toSecureId = String(req.body?.toSecureId || '');
  if (!toSecureId || toSecureId === req.secureId) {
    return res.status(400).json({ error: 'Invalid recipient' });
  }
  const target = db.prepare('SELECT * FROM identities WHERE secure_id = ?').get(toSecureId) as any;
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (areBlocked(req.secureId!, toSecureId)) {
    return res.status(403).json({ error: 'Blocked' });
  }
  if (areFriends(req.secureId!, toSecureId)) {
    return res.status(409).json({ error: 'Already friends' });
  }

  const existingPending = db
    .prepare(
      `SELECT id FROM friend_requests WHERE from_secure_id = ? AND to_secure_id = ? AND status = 'pending'`,
    )
    .get(req.secureId, toSecureId);
  if (existingPending) return res.status(409).json({ error: 'Request already exists' });

  // Allow retry after reject by deleting old rejected row
  db.prepare(
    `DELETE FROM friend_requests WHERE from_secure_id = ? AND to_secure_id = ? AND status = 'rejected'`,
  ).run(req.secureId, toSecureId);

  const id = nanoid();
  const createdAt = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO friend_requests (id, from_secure_id, to_secure_id, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
    ).run(id, req.secureId, toSecureId, createdAt);
  } catch {
    return res.status(409).json({ error: 'Request already exists' });
  }

  const request = {
    id,
    fromSecureId: req.secureId!,
    toSecureId,
    status: 'pending' as const,
    createdAt,
  };
  const from = mapIdentity(
    db.prepare('SELECT * FROM identities WHERE secure_id = ?').get(req.secureId) as any,
  );
  sendToUser(toSecureId, { type: 'friend.request', request, from });
  res.status(201).json({ request });
});

router.get('/friends/requests', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE to_secure_id = ? AND status = 'pending'
       ORDER BY created_at DESC`,
    )
    .all(req.secureId) as any[];
  const requests = rows.map((r) => ({
    id: r.id,
    fromSecureId: r.from_secure_id,
    toSecureId: r.to_secure_id,
    status: r.status,
    createdAt: r.created_at,
    from: mapIdentity(
      db.prepare('SELECT * FROM identities WHERE secure_id = ?').get(r.from_secure_id) as any,
    ),
  }));
  res.json({ requests });
});

router.post('/friends/respond', requireAuth, (req: AuthedRequest, res) => {
  const { requestId, accept } = req.body || {};
  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'accept must be boolean' });
  }
  const row = db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(requestId) as any;
  if (!row || row.to_secure_id !== req.secureId) {
    return res.status(404).json({ error: 'Request not found' });
  }
  if (row.status !== 'pending') {
    return res.status(409).json({ error: 'Already handled' });
  }
  if (areBlocked(req.secureId!, row.from_secure_id)) {
    db.prepare(`UPDATE friend_requests SET status = 'rejected' WHERE id = ?`).run(requestId);
    return res.status(403).json({ error: 'Blocked' });
  }

  if (accept) {
    const [userA, userB] = canonicalPair(row.from_secure_id, row.to_secure_id);
    const tx = db.transaction(() => {
      db.prepare(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`).run(requestId);
      // Cancel reverse pending request if any
      db.prepare(
        `UPDATE friend_requests SET status = 'accepted'
         WHERE from_secure_id = ? AND to_secure_id = ? AND status = 'pending'`,
      ).run(row.to_secure_id, row.from_secure_id);
      const existing = db
        .prepare(
          `SELECT id FROM friendships WHERE
            (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)`,
        )
        .get(userA, userB, userB, userA) as { id: string } | undefined;
      if (existing) return existing.id;
      const friendshipId = nanoid();
      db.prepare(
        `INSERT INTO friendships (id, user_a, user_b, created_at) VALUES (?, ?, ?, ?)`,
      ).run(friendshipId, userA, userB, new Date().toISOString());
      return friendshipId;
    });
    const friendshipId = tx();
    return res.json({ status: 'accepted', friendshipId });
  }
  db.prepare(`UPDATE friend_requests SET status = 'rejected' WHERE id = ?`).run(requestId);
  res.json({ status: 'rejected' });
});

router.get('/friends', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM friendships WHERE user_a = ? OR user_b = ? ORDER BY created_at DESC`,
    )
    .all(req.secureId, req.secureId) as any[];
  const friends = rows
    .map((r) => {
      const otherId = r.user_a === req.secureId ? r.user_b : r.user_a;
      if (areBlocked(req.secureId!, otherId)) return null;
      return {
        friendshipId: r.id,
        createdAt: r.created_at,
        friend: mapIdentity(
          db.prepare('SELECT * FROM identities WHERE secure_id = ?').get(otherId) as any,
        ),
      };
    })
    .filter(Boolean);
  res.json({ friends });
});

router.post('/friends/block', requireAuth, (req: AuthedRequest, res) => {
  const blockedSecureId = String(req.body?.blockedSecureId || '');
  if (!blockedSecureId || blockedSecureId === req.secureId) {
    return res.status(400).json({ error: 'blockedSecureId required' });
  }
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO blocks (blocker_secure_id, blocked_secure_id, created_at)
       VALUES (?, ?, ?)`,
    ).run(req.secureId, blockedSecureId, new Date().toISOString());
    db.prepare(
      `DELETE FROM friendships WHERE
        (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)`,
    ).run(req.secureId, blockedSecureId, blockedSecureId, req.secureId);
    db.prepare(
      `UPDATE friend_requests SET status = 'rejected'
       WHERE status = 'pending' AND
         ((from_secure_id = ? AND to_secure_id = ?) OR (from_secure_id = ? AND to_secure_id = ?))`,
    ).run(req.secureId, blockedSecureId, blockedSecureId, req.secureId);
  });
  tx();
  res.json({ ok: true });
});

router.get('/messages/pending', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM message_envelopes
       WHERE recipient_secure_id = ? AND status IN ('queued', 'sent')
       ORDER BY created_at ASC`,
    )
    .all(req.secureId) as any[];
  const envelopes = rows
    .filter((r) => !areBlocked(req.secureId!, r.sender_secure_id))
    .map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      senderSecureId: r.sender_secure_id,
      recipientSecureId: r.recipient_secure_id,
      ciphertext: r.ciphertext,
      nonce: r.nonce,
      createdAt: r.created_at,
      status: r.status,
    }));
  res.json({ envelopes });
});

router.post('/messages/send', requireAuth, (req: AuthedRequest, res) => {
  const { id, conversationId, recipientSecureId, ciphertext, nonce, createdAt } = req.body || {};
  if (!id || !conversationId || !recipientSecureId || !ciphertext || !nonce) {
    return res.status(400).json({ error: 'Missing envelope fields' });
  }
  if (areBlocked(req.secureId!, recipientSecureId)) {
    return res.status(403).json({ error: 'Blocked' });
  }
  if (!areFriends(req.secureId!, recipientSecureId)) {
    return res.status(403).json({ error: 'Not friends' });
  }
  const expectedConv = conversationIdFor(req.secureId!, recipientSecureId);
  if (conversationId !== expectedConv) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  const envelope = {
    id,
    conversationId: expectedConv,
    senderSecureId: req.secureId!,
    recipientSecureId,
    ciphertext,
    nonce,
    createdAt: createdAt || new Date().toISOString(),
    status: 'sent' as 'sent' | 'delivered',
  };

  try {
    db.prepare(
      `INSERT INTO message_envelopes
        (id, conversation_id, sender_secure_id, recipient_secure_id, ciphertext, nonce, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      envelope.id,
      envelope.conversationId,
      envelope.senderSecureId,
      envelope.recipientSecureId,
      envelope.ciphertext,
      envelope.nonce,
      envelope.createdAt,
      envelope.status,
    );
  } catch {
    return res.status(409).json({ error: 'Message id already exists' });
  }

  // Push realtime hint but keep status=sent until recipient ACK (prevents lost pending)
  sendToUser(recipientSecureId, { type: 'message', envelope });
  res.status(201).json({ envelope });
});

router.post('/messages/ack', requireAuth, (req: AuthedRequest, res) => {
  const { messageId, status } = req.body || {};
  if (!messageId || !['delivered', 'read'].includes(status)) {
    return res.status(400).json({ error: 'Invalid ack' });
  }
  const row = db.prepare('SELECT * FROM message_envelopes WHERE id = ?').get(messageId) as any;
  if (!row || row.recipient_secure_id !== req.secureId) {
    return res.status(404).json({ error: 'Message not found' });
  }
  const currentRank = STATUS_RANK[row.status] ?? 0;
  const nextRank = STATUS_RANK[status] ?? 0;
  if (nextRank < currentRank) {
    return res.status(409).json({ error: 'Cannot downgrade status' });
  }
  db.prepare('UPDATE message_envelopes SET status = ? WHERE id = ?').run(status, messageId);
  sendToUser(row.sender_secure_id, { type: 'message.status', messageId, status });
  res.json({ ok: true });
});

router.post('/location/update', requireAuth, (req: AuthedRequest, res) => {
  const { id, recipientSecureId, ciphertext, nonce, createdAt, expiresAt } = req.body || {};
  if (!id || !recipientSecureId || !ciphertext || !nonce || !expiresAt) {
    return res.status(400).json({ error: 'Missing location envelope fields' });
  }
  if (new Date(expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ error: 'expiresAt must be in the future' });
  }
  if (areBlocked(req.secureId!, recipientSecureId)) {
    return res.status(403).json({ error: 'Blocked' });
  }
  if (!areFriends(req.secureId!, recipientSecureId)) {
    return res.status(403).json({ error: 'Not friends' });
  }

  const created = createdAt || new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO location_envelopes
        (id, sender_secure_id, recipient_secure_id, ciphertext, nonce, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, req.secureId, recipientSecureId, ciphertext, nonce, created, expiresAt);
  } catch {
    return res.status(409).json({ error: 'Location id already exists' });
  }

  const envelope = {
    id,
    senderSecureId: req.secureId!,
    recipientSecureId,
    ciphertext,
    nonce,
    createdAt: created,
    expiresAt,
  };
  sendToUser(recipientSecureId, { type: 'location', envelope });
  res.status(201).json({ envelope });
});

router.get('/location/pending', requireAuth, (req: AuthedRequest, res) => {
  const now = new Date().toISOString();
  // Keep only newest unexpired per sender for this recipient
  const rows = db
    .prepare(
      `SELECT * FROM location_envelopes
       WHERE recipient_secure_id = ? AND expires_at > ?
       ORDER BY created_at DESC`,
    )
    .all(req.secureId, now) as any[];

  const seen = new Set<string>();
  const envelopes = [];
  for (const r of rows) {
    if (areBlocked(req.secureId!, r.sender_secure_id)) continue;
    if (seen.has(r.sender_secure_id)) continue;
    seen.add(r.sender_secure_id);
    envelopes.push({
      id: r.id,
      senderSecureId: r.sender_secure_id,
      recipientSecureId: r.recipient_secure_id,
      ciphertext: r.ciphertext,
      nonce: r.nonce,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    });
  }
  res.json({ envelopes });
});
