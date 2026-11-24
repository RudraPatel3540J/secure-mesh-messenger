import { API_BASE } from '../config';
import type { FriendEntry, FriendRequestItem, PublicIdentity } from '../types';

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function registerIdentity(body: {
  secureId: string;
  username?: string;
  identityPublicKey: string;
  signingPublicKey: string;
  proofSignature: string;
}) {
  return request<{ token: string; identity: PublicIdentity }>('/identity/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function requestLoginChallenge(secureId: string) {
  return request<{ secureId: string; nonce: string; expiresAt: string; payload: string }>(
    '/identity/challenge',
    {
      method: 'POST',
      body: JSON.stringify({ secureId }),
    },
  );
}

export function loginIdentity(body: { secureId: string; nonce: string; signature: string }) {
  return request<{ token: string; identity: PublicIdentity }>('/identity/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function lookupIdentity(token: string, q: string) {
  return request<{ identity: PublicIdentity }>(`/identity/lookup?q=${encodeURIComponent(q)}`, {
    token,
  });
}

export function setUsername(token: string, username: string) {
  return request<{ identity: PublicIdentity }>('/identity/username', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ username }),
  });
}

export function sendFriendRequest(token: string, toSecureId: string) {
  return request('/friends/request', {
    method: 'POST',
    token,
    body: JSON.stringify({ toSecureId }),
  });
}

export function listFriendRequests(token: string) {
  return request<{ requests: FriendRequestItem[] }>('/friends/requests', { token });
}

export function respondFriendRequest(token: string, requestId: string, accept: boolean) {
  return request('/friends/respond', {
    method: 'POST',
    token,
    body: JSON.stringify({ requestId, accept }),
  });
}

export function listFriends(token: string) {
  return request<{ friends: FriendEntry[] }>('/friends', { token });
}

export function sendMessageEnvelope(
  token: string,
  envelope: {
    id: string;
    conversationId: string;
    recipientSecureId: string;
    ciphertext: string;
    nonce: string;
    createdAt: string;
  },
) {
  return request<{ envelope: { id: string; status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' } }>(
    '/messages/send',
    {
      method: 'POST',
      token,
      body: JSON.stringify(envelope),
    },
  );
}

export function pendingMessages(token: string) {
  return request<{ envelopes: any[] }>('/messages/pending', { token });
}

export function ackMessage(token: string, messageId: string, status: 'delivered' | 'read') {
  return request('/messages/ack', {
    method: 'POST',
    token,
    body: JSON.stringify({ messageId, status }),
  });
}

export function sendLocationEnvelope(token: string, envelope: any) {
  return request('/location/update', {
    method: 'POST',
    token,
    body: JSON.stringify(envelope),
  });
}

export function pendingLocations(token: string) {
  return request<{ envelopes: any[] }>('/location/pending', { token });
}

export async function healthCheck() {
  return request<{ ok: boolean }>('/health');
}
