import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(path.join(dataDir, 'smm.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS identities (
    secure_id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    identity_public_key TEXT NOT NULL,
    signing_public_key TEXT NOT NULL,
    device_token TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    from_secure_id TEXT NOT NULL,
    to_secure_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(from_secure_id, to_secure_id)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    user_a TEXT NOT NULL,
    user_b TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_a, user_b)
  );

  CREATE TABLE IF NOT EXISTS message_envelopes (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_secure_id TEXT NOT NULL,
    recipient_secure_id TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS location_envelopes (
    id TEXT PRIMARY KEY,
    sender_secure_id TEXT NOT NULL,
    recipient_secure_id TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_secure_id TEXT NOT NULL,
    blocked_secure_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_secure_id, blocked_secure_id)
  );
`);
