export type PublicIdentity = {
  secureId: string;
  username: string | null;
  identityPublicKey: string;
  signingPublicKey: string;
  createdAt: string;
};

export type FriendEntry = {
  friendshipId: string;
  createdAt: string;
  friend: PublicIdentity;
};

export type AttachmentKind = 'image' | 'video' | 'document';

export type AttachmentPayload = {
  type: 'attachment';
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  dataBase64: string;
};

export type TextPayload = {
  type: 'text';
  text: string;
};

export type MessagePayload = TextPayload | AttachmentPayload;

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderSecureId: string;
  recipientSecureId: string;
  plaintext: string;
  ciphertext: string;
  nonce: string;
  createdAt: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  mine: boolean;
  kind?: 'text' | AttachmentKind;
  fileName?: string;
  mime?: string;
};

export type FriendLocation = {
  secureId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  updatedAt: string;
  username: string | null;
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

export type FriendRequestItem = {
  id: string;
  fromSecureId: string;
  toSecureId: string;
  status: string;
  createdAt: string;
  from: PublicIdentity;
};

export function parseMessagePayload(plaintext: string): MessagePayload {
  try {
    const parsed = JSON.parse(plaintext);
    if (parsed?.type === 'attachment' && parsed.dataBase64) {
      return parsed as AttachmentPayload;
    }
    if (parsed?.type === 'text' && typeof parsed.text === 'string') {
      return parsed as TextPayload;
    }
  } catch {
    /* plain legacy text */
  }
  return { type: 'text', text: plaintext };
}

export function previewForMessage(plaintext: string): string {
  const payload = parseMessagePayload(plaintext);
  if (payload.type === 'attachment') {
    if (payload.kind === 'image') return 'Photo';
    if (payload.kind === 'video') return 'Video';
    return payload.name || 'Document';
  }
  return payload.text;
}
