export type PublicIdentity = {
  secureId: string;
  username: string | null;
  identityPublicKey: string;
  signingPublicKey: string;
  createdAt: string;
};

export type FriendRequest = {
  id: string;
  fromSecureId: string;
  toSecureId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};

export type Friendship = {
  id: string;
  userA: string;
  userB: string;
  createdAt: string;
};

export type MessageEnvelope = {
  id: string;
  conversationId: string;
  senderSecureId: string;
  recipientSecureId: string;
  ciphertext: string;
  nonce: string;
  createdAt: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
};

export type LocationEnvelope = {
  id: string;
  senderSecureId: string;
  recipientSecureId: string;
  ciphertext: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
};

export type LocationShareMode = 'off' | 'friends' | 'temporary' | 'ghost';

export type PrivacySettings = {
  locationSharing: LocationShareMode;
  ghostMode: boolean;
  temporaryShareUntil: string | null;
  nearbyDiscovery: boolean;
  relayParticipation: boolean;
  readReceipts: boolean;
  typingIndicator: boolean;
  publicUsernameDiscovery: boolean;
};

export type WsClientMessage =
  | { type: 'auth'; secureId: string; token: string }
  | { type: 'ping' }
  | { type: 'message.send'; envelope: Omit<MessageEnvelope, 'status'> }
  | { type: 'message.ack'; messageId: string; status: 'delivered' | 'read' }
  | { type: 'location.update'; envelope: LocationEnvelope }
  | { type: 'typing'; conversationId: string; isTyping: boolean };

export type WsServerMessage =
  | { type: 'auth.ok' }
  | { type: 'auth.error'; error: string }
  | { type: 'pong' }
  | { type: 'message'; envelope: MessageEnvelope }
  | { type: 'message.status'; messageId: string; status: MessageEnvelope['status'] }
  | { type: 'friend.request'; request: FriendRequest; from: PublicIdentity }
  | { type: 'location'; envelope: LocationEnvelope }
  | { type: 'typing'; conversationId: string; fromSecureId: string; isTyping: boolean }
  | { type: 'error'; error: string };
