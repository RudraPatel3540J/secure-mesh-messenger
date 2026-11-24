import { Request, Response, NextFunction } from 'express';
import { randomToken } from '@smm/shared';
import { db } from './db';

export type AuthedRequest = Request & {
  secureId?: string;
};

const challenges = new Map<string, { nonce: string; expiresAt: number }>();

export function issueToken(): string {
  return `tok_${randomToken(32)}`;
}

export function createLoginChallenge(secureId: string): { nonce: string; expiresAt: string } {
  const nonce = randomToken(24);
  const expiresAtMs = Date.now() + 5 * 60 * 1000;
  challenges.set(secureId, { nonce, expiresAt: expiresAtMs });
  return { nonce, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function consumeLoginChallenge(secureId: string, nonce: string): boolean {
  const entry = challenges.get(secureId);
  challenges.delete(secureId);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) return false;
  return entry.nonce === nonce;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const row = db
    .prepare('SELECT secure_id FROM identities WHERE device_token = ?')
    .get(token) as { secure_id: string } | undefined;
  if (!row) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
  req.secureId = row.secure_id;
  next();
}

export function areBlocked(a: string, b: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM blocks WHERE
        (blocker_secure_id = ? AND blocked_secure_id = ?) OR
        (blocker_secure_id = ? AND blocked_secure_id = ?)`,
    )
    .get(a, b, b, a);
  return Boolean(row);
}

export function areFriends(a: string, b: string): boolean {
  const row = db
    .prepare(
      `SELECT id FROM friendships WHERE
        (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)`,
    )
    .get(a, b, b, a);
  return Boolean(row);
}

export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
