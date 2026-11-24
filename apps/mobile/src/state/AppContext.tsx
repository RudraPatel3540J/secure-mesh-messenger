import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { nanoid } from 'nanoid/non-secure';
import { WS_URL } from '../config';
import {
  conversationIdFor,
  createIdentity,
  decryptMessage,
  encryptMessage,
  hashPin,
  loginChallengePayload,
  registerProofPayload,
  signPayload,
  type IdentityBundle,
} from '../lib/crypto';
import * as api from '../lib/api';
import {
  defaultPrivacy,
  loadFriendsCache,
  loadIdentity,
  loadLocations,
  loadMessages,
  loadPinSecrets,
  loadPrivacy,
  loadToken,
  saveFriendsCache,
  saveIdentity,
  saveLocations,
  saveMessages,
  savePinHash,
  savePrivacy,
  saveToken,
} from '../lib/storage';
import type {
  ChatMessage,
  FriendEntry,
  FriendLocation,
  FriendRequestItem,
  PrivacySettings,
  PublicIdentity,
} from '../types';

type AppContextValue = {
  ready: boolean;
  unlocked: boolean;
  identity: IdentityBundle | null;
  username: string | null;
  token: string | null;
  friends: FriendEntry[];
  requests: FriendRequestItem[];
  messages: Record<string, ChatMessage[]>;
  locations: Record<string, FriendLocation>;
  privacy: PrivacySettings;
  online: boolean;
  cellularRequiredOk: boolean;
  gpsRequiredOk: boolean;
  connectionLabel: string;
  unlock: (pin: string) => Promise<boolean>;
  setupAccount: (opts: { username?: string; pin: string }) => Promise<{ recoveryPhrase: string; secureId: string }>;
  refreshFriends: () => Promise<void>;
  addFriendByQuery: (q: string) => Promise<PublicIdentity>;
  respondRequest: (id: string, accept: boolean) => Promise<void>;
  sendText: (friend: PublicIdentity, text: string) => Promise<void>;
  sendAttachment: (
    friend: PublicIdentity,
    attachment: {
      kind: 'image' | 'video' | 'document';
      name: string;
      mime: string;
      dataBase64: string;
      size: number;
    },
  ) => Promise<void>;
  updatePrivacy: (patch: Partial<PrivacySettings>) => Promise<void>;
  shareMyLocationOnce: () => Promise<{ ok: boolean; error?: string }>;
  startLocationLoop: () => void;
  stopLocationLoop: () => void;
  markConversationRead: (conversationId: string) => Promise<void>;
  flushQueuedMessages: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [identity, setIdentity] = useState<IdentityBundle | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [locations, setLocations] = useState<Record<string, FriendLocation>>({});
  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacy);
  const [online, setOnline] = useState(true);
  const [cellularRequiredOk, setCellularRequiredOk] = useState(true);
  const [gpsRequiredOk, setGpsRequiredOk] = useState(false);
  const [connectionLabel, setConnectionLabel] = useState('Checking…');
  const wsRef = useRef<WebSocket | null>(null);
  const locationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const identityRef = useRef(identity);
  const tokenRef = useRef(token);
  const friendsRef = useRef(friends);
  const privacyRef = useRef(privacy);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);
  useEffect(() => {
    privacyRef.current = privacy;
  }, [privacy]);

  const persistMessages = useCallback(async (next: Record<string, ChatMessage[]>) => {
    setMessages(next);
    await saveMessages(next);
  }, []);

  const ingestEnvelope = useCallback(
    async (envelope: any, mine = false) => {
      const idBundle = identityRef.current;
      if (!idBundle) return;
      const friend = friendsRef.current.find(
        (f) =>
          f.friend.secureId === envelope.senderSecureId ||
          f.friend.secureId === envelope.recipientSecureId,
      );
      const peerKey = mine
        ? friend?.friend.identityPublicKey
        : friendsRef.current.find((f) => f.friend.secureId === envelope.senderSecureId)?.friend
            .identityPublicKey;
      if (!peerKey && !mine) return;

      let plaintext = '[encrypted]';
      try {
        if (mine) {
          // already have plaintext path for outbound
          return;
        }
        plaintext = decryptMessage(
          envelope.ciphertext,
          envelope.nonce,
          peerKey!,
          idBundle.identity.secretKey,
        );
      } catch {
        plaintext = '[unable to decrypt]';
      }

      let kind: ChatMessage['kind'] = 'text';
      let fileName: string | undefined;
      let mime: string | undefined;
      try {
        const parsed = JSON.parse(plaintext);
        if (parsed?.type === 'attachment') {
          kind = parsed.kind || 'document';
          fileName = parsed.name;
          mime = parsed.mime;
        }
      } catch {
        /* legacy plain text */
      }

      const msg: ChatMessage = {
        id: envelope.id,
        conversationId: envelope.conversationId,
        senderSecureId: envelope.senderSecureId,
        recipientSecureId: envelope.recipientSecureId,
        plaintext,
        ciphertext: envelope.ciphertext,
        nonce: envelope.nonce,
        createdAt: envelope.createdAt,
        status: envelope.status || 'delivered',
        mine: false,
        kind,
        fileName,
        mime,
      };

      setMessages((prev) => {
        const list = prev[msg.conversationId] || [];
        if (list.some((m) => m.id === msg.id)) return prev;
        const next = { ...prev, [msg.conversationId]: [...list, msg] };
        void saveMessages(next);
        return next;
      });

      const tok = tokenRef.current;
      if (tok) {
        try {
          await api.ackMessage(tok, msg.id, 'delivered');
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  const ingestLocation = useCallback(async (envelope: any) => {
    const idBundle = identityRef.current;
    if (!idBundle) return;
    if (envelope.expiresAt && new Date(envelope.expiresAt).getTime() <= Date.now()) return;
    const sender = friendsRef.current.find((f) => f.friend.secureId === envelope.senderSecureId);
    if (!sender) return;
    try {
      const plaintext = decryptMessage(
        envelope.ciphertext,
        envelope.nonce,
        sender.friend.identityPublicKey,
        idBundle.identity.secretKey,
      );
      const parsed = JSON.parse(plaintext) as {
        latitude: number;
        longitude: number;
        accuracy: number;
        updatedAt: string;
      };
      setLocations((prev) => {
        const existing = prev[envelope.senderSecureId];
        if (existing && new Date(existing.updatedAt).getTime() >= new Date(parsed.updatedAt).getTime()) {
          return prev;
        }
        const next = {
          ...prev,
          [envelope.senderSecureId]: {
            secureId: envelope.senderSecureId,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: parsed.accuracy,
            updatedAt: parsed.updatedAt,
            username: sender.friend.username,
          },
        };
        void saveLocations(next);
        return next;
      });
    } catch {
      /* ignore bad envelope */
    }
  }, []);

  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWs = useCallback(() => {
    const idBundle = identityRef.current;
    const tok = tokenRef.current;
    if (!idBundle || !tok) return;
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {
        /* ignore */
      }
    }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      reconnectAttempt.current = 0;
      ws.send(JSON.stringify({ type: 'auth', secureId: idBundle.secureId, token: tok }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === 'message') void ingestEnvelope(msg.envelope);
        if (msg.type === 'location') void ingestLocation(msg.envelope);
        if (msg.type === 'friend.request') {
          setRequests((prev) => {
            if (prev.some((r) => r.id === msg.request.id)) return prev;
            return [{ ...msg.request, from: msg.from }, ...prev];
          });
        }
        if (msg.type === 'message.status') {
          setMessages((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              next[key] = next[key].map((m) =>
                m.id === msg.messageId ? { ...m, status: msg.status } : m,
              );
            }
            void saveMessages(next);
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      /* onclose handles reconnect */
    };
    ws.onclose = () => {
      if (!identityRef.current || !tokenRef.current) return;
      const attempt = Math.min(reconnectAttempt.current + 1, 6);
      reconnectAttempt.current = attempt;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => connectWs(), delay);
    };
  }, [ingestEnvelope, ingestLocation]);

  const refreshNetworkAndGps = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(isOnline);
      // Product rule from earlier chat: prefer cellular; Wi‑Fi also allowed for MVP usability.
      const cellularOk = state.type === Network.NetworkStateType.CELLULAR || state.type === Network.NetworkStateType.WIFI;
      setCellularRequiredOk(isOnline && cellularOk);
      setConnectionLabel(
        !isOnline
          ? 'Offline — messages queue locally'
          : state.type === Network.NetworkStateType.CELLULAR
            ? 'Mobile network'
            : state.type === Network.NetworkStateType.WIFI
              ? 'Wi‑Fi'
              : 'Connected',
      );
    } catch {
      setOnline(false);
      setCellularRequiredOk(false);
      setConnectionLabel('Network unknown');
    }

    try {
      const services = await Location.hasServicesEnabledAsync();
      const perm = await Location.getForegroundPermissionsAsync();
      setGpsRequiredOk(services && perm.granted);
    } catch {
      setGpsRequiredOk(false);
    }
  }, []);

  const refreshFriends = useCallback(async () => {
    const tok = tokenRef.current;
    if (!tok) return;
    const [f, r] = await Promise.all([api.listFriends(tok), api.listFriendRequests(tok)]);
    setFriends(f.friends);
    await saveFriendsCache(f.friends);
    setRequests(r.requests);
  }, []);

  useEffect(() => {
    (async () => {
      const [id, tok, priv, msgs, locs, cachedFriends] = await Promise.all([
        loadIdentity(),
        loadToken(),
        loadPrivacy(),
        loadMessages<Record<string, ChatMessage[]>>(),
        loadLocations<Record<string, FriendLocation>>(),
        loadFriendsCache<FriendEntry[]>(),
      ]);
      setIdentity(id);
      setToken(tok);
      setPrivacy(priv);
      if (msgs) setMessages(msgs);
      if (locs) setLocations(locs);
      if (cachedFriends) setFriends(cachedFriends);
      setReady(true);
      await refreshNetworkAndGps();
    })();
  }, [refreshNetworkAndGps]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshNetworkAndGps();
    });
    const t = setInterval(() => void refreshNetworkAndGps(), 15000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, [refreshNetworkAndGps]);

  useEffect(() => {
    if (unlocked && identity && token) {
      connectWs();
      void (async () => {
        try {
          await refreshFriends();
          const pending = await api.pendingMessages(token);
          for (const env of pending.envelopes) {
            await ingestEnvelope(env);
          }
          const locs = await api.pendingLocations(token);
          for (const env of locs.envelopes) {
            await ingestLocation(env);
          }
        } catch {
          /* offline bootstrap */
        }
      })();
    }
    return () => {
      wsRef.current?.close();
    };
  }, [unlocked, identity, token, connectWs, refreshFriends, ingestEnvelope, ingestLocation]);

  const unlock = useCallback(async (pin: string) => {
    const secrets = await loadPinSecrets();
    const id = await loadIdentity();
    const tok = await loadToken();
    if (!secrets || !id) return false;
    if (!tok) return false;
    if (hashPin(pin, secrets.salt) !== secrets.hash) return false;
    setIdentity(id);
    setToken(tok);
    setUnlocked(true);
    try {
      const challenge = await api.requestLoginChallenge(id.secureId);
      const signature = signPayload(
        loginChallengePayload(id.secureId, challenge.nonce),
        id.signing.secretKey,
      );
      const me = await api.loginIdentity({
        secureId: id.secureId,
        nonce: challenge.nonce,
        signature,
      });
      setToken(me.token);
      await saveToken(me.token);
      setUsername(me.identity.username);
    } catch {
      /* keep stored token if offline */
    }
    return true;
  }, []);

  const setupAccount = useCallback(async ({ username: u, pin }: { username?: string; pin: string }) => {
    const bundle = createIdentity();
    const salt = nanoid(12);
    const pinHash = hashPin(pin, salt);
    const proofSignature = signPayload(
      registerProofPayload(bundle.secureId, bundle.identity.publicKey, bundle.signing.publicKey),
      bundle.signing.secretKey,
    );
    // Register with server FIRST so a failed network call never strands local identity
    const registered = await api.registerIdentity({
      secureId: bundle.secureId,
      username: u,
      identityPublicKey: bundle.identity.publicKey,
      signingPublicKey: bundle.signing.publicKey,
      proofSignature,
    });
    await saveIdentity(bundle);
    await savePinHash(pinHash, salt);
    await saveToken(registered.token);
    setIdentity(bundle);
    setToken(registered.token);
    setUsername(registered.identity.username);
    setUnlocked(true);
    return { recoveryPhrase: bundle.recoveryPhrase, secureId: bundle.secureId };
  }, []);

  const addFriendByQuery = useCallback(async (q: string) => {
    const tok = tokenRef.current;
    if (!tok) throw new Error('Not authenticated');
    const { identity: found } = await api.lookupIdentity(tok, q);
    await api.sendFriendRequest(tok, found.secureId);
    await refreshFriends();
    return found;
  }, [refreshFriends]);

  const respondRequest = useCallback(async (id: string, accept: boolean) => {
    const tok = tokenRef.current;
    if (!tok) return;
    await api.respondFriendRequest(tok, id, accept);
    await refreshFriends();
  }, [refreshFriends]);

  const flushQueuedMessages = useCallback(async () => {
    const idBundle = identityRef.current;
    const tok = tokenRef.current;
    if (!idBundle || !tok) return;
    const snapshot = messages;
    for (const convId of Object.keys(snapshot)) {
      for (const msg of snapshot[convId] || []) {
        if (!msg.mine || msg.status !== 'queued') continue;
        const friend = friendsRef.current.find((f) => f.friend.secureId === msg.recipientSecureId)
          ?.friend;
        if (!friend) continue;
        try {
          const res = await api.sendMessageEnvelope(tok, {
            id: msg.id,
            conversationId: convId,
            recipientSecureId: msg.recipientSecureId,
            ciphertext: msg.ciphertext,
            nonce: msg.nonce,
            createdAt: msg.createdAt,
          });
          setMessages((prev) => {
            const next = {
              ...prev,
              [convId]: (prev[convId] || []).map((m) =>
                m.id === msg.id
                  ? { ...m, status: res.envelope.status as ChatMessage['status'] }
                  : m,
              ),
            };
            void saveMessages(next);
            return next;
          });
        } catch {
          /* keep queued */
        }
      }
    }
  }, [messages]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    const tok = tokenRef.current;
    if (!tok) return;
    const list = messages[conversationId] || [];
    const unread = list.filter((m) => !m.mine && m.status !== 'read');
    for (const msg of unread) {
      try {
        await api.ackMessage(tok, msg.id, 'read');
      } catch {
        /* ignore */
      }
    }
    if (unread.length === 0) return;
    setMessages((prev) => {
      const next = {
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          !m.mine ? { ...m, status: 'read' as const } : m,
        ),
      };
      void saveMessages(next);
      return next;
    });
  }, [messages]);

  const sendEncryptedPayload = useCallback(
    async (
      friend: PublicIdentity,
      plaintext: string,
      meta?: { kind?: ChatMessage['kind']; fileName?: string; mime?: string },
    ) => {
      const idBundle = identityRef.current;
      const tok = tokenRef.current;
      if (!idBundle || !tok) throw new Error('Not ready');
      const convId = conversationIdFor(idBundle.secureId, friend.secureId);
      const { ciphertext, nonce } = encryptMessage(
        plaintext,
        friend.identityPublicKey,
        idBundle.identity.secretKey,
      );
      const initialStatus: ChatMessage['status'] = online ? 'sent' : 'queued';
      const msg: ChatMessage = {
        id: nanoid(),
        conversationId: convId,
        senderSecureId: idBundle.secureId,
        recipientSecureId: friend.secureId,
        plaintext,
        ciphertext,
        nonce,
        createdAt: new Date().toISOString(),
        status: initialStatus,
        mine: true,
        kind: meta?.kind || 'text',
        fileName: meta?.fileName,
        mime: meta?.mime,
      };

      setMessages((prev) => {
        const next = { ...prev, [convId]: [...(prev[convId] || []), msg] };
        void saveMessages(next);
        return next;
      });

      if (!online) return;
      try {
        const res = await api.sendMessageEnvelope(tok, {
          id: msg.id,
          conversationId: convId,
          recipientSecureId: friend.secureId,
          ciphertext,
          nonce,
          createdAt: msg.createdAt,
        });
        setMessages((prev) => {
          const next = {
            ...prev,
            [convId]: (prev[convId] || []).map((m) =>
              m.id === msg.id
                ? { ...m, status: res.envelope.status as ChatMessage['status'] }
                : m,
            ),
          };
          void saveMessages(next);
          return next;
        });
      } catch {
        setMessages((prev) => {
          const next = {
            ...prev,
            [convId]: (prev[convId] || []).map((m) =>
              m.id === msg.id ? { ...m, status: 'queued' as const } : m,
            ),
          };
          void saveMessages(next);
          return next;
        });
      }
    },
    [online],
  );

  const sendText = useCallback(
    async (friend: PublicIdentity, text: string) => {
      const payload = JSON.stringify({ type: 'text', text });
      await sendEncryptedPayload(friend, payload, { kind: 'text' });
    },
    [sendEncryptedPayload],
  );

  const sendAttachment = useCallback(
    async (
      friend: PublicIdentity,
      attachment: {
        kind: 'image' | 'video' | 'document';
        name: string;
        mime: string;
        dataBase64: string;
        size: number;
      },
    ) => {
      const maxBytes = attachment.kind === 'image' ? 2_500_000 : 4_000_000;
      if (attachment.size > maxBytes) {
        throw new Error(
          `File too large (${Math.round(attachment.size / 1024)} KB). Max ~${Math.round(maxBytes / 1024)} KB for ${attachment.kind}.`,
        );
      }
      const payload = JSON.stringify({
        type: 'attachment',
        kind: attachment.kind,
        name: attachment.name,
        mime: attachment.mime,
        size: attachment.size,
        dataBase64: attachment.dataBase64,
      });
      await sendEncryptedPayload(friend, payload, {
        kind: attachment.kind,
        fileName: attachment.name,
        mime: attachment.mime,
      });
    },
    [sendEncryptedPayload],
  );

  const updatePrivacy = useCallback(async (patch: Partial<PrivacySettings>) => {
    setPrivacy((prev) => {
      const next = { ...prev, ...patch };
      if (patch.ghostMode === true) {
        next.locationSharing = 'ghost';
      }
      void savePrivacy(next);
      return next;
    });
  }, []);

  const shareMyLocationOnce = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const idBundle = identityRef.current;
    const tok = tokenRef.current;
    const priv = privacyRef.current;
    if (!idBundle || !tok) {
      return { ok: false, error: 'Not signed in' };
    }
    if (priv.ghostMode || priv.locationSharing === 'off' || priv.locationSharing === 'ghost') {
      return { ok: false, error: 'Location sharing is off (Ghost Mode or disabled)' };
    }
    if (priv.locationSharing === 'temporary' && priv.temporaryShareUntil) {
      if (new Date(priv.temporaryShareUntil).getTime() < Date.now()) {
        return { ok: false, error: 'Temporary share expired' };
      }
    }

    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setGpsRequiredOk(false);
        return {
          ok: false,
          error: 'Location services are off. Enable GPS/location in the emulator or device settings.',
        };
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsRequiredOk(false);
        return { ok: false, error: 'Location permission denied' };
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGpsRequiredOk(true);

      const payload = JSON.stringify({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy || 0,
        updatedAt: new Date().toISOString(),
      });
      const expiresAt =
        priv.locationSharing === 'temporary' && priv.temporaryShareUntil
          ? priv.temporaryShareUntil
          : new Date(Date.now() + 60 * 60 * 1000).toISOString();

      for (const entry of friendsRef.current) {
        const { ciphertext, nonce } = encryptMessage(
          payload,
          entry.friend.identityPublicKey,
          idBundle.identity.secretKey,
        );
        try {
          await api.sendLocationEnvelope(tok, {
            id: nanoid(),
            recipientSecureId: entry.friend.secureId,
            ciphertext,
            nonce,
            createdAt: new Date().toISOString(),
            expiresAt,
          });
        } catch {
          /* ignore per-friend failure */
        }
      }
      return { ok: true };
    } catch (e: any) {
      setGpsRequiredOk(false);
      const message =
        e?.message ||
        'Current location is unavailable. Enable location services and try again.';
      return { ok: false, error: message };
    }
  }, []);

  const startLocationLoop = useCallback(() => {
    if (locationTimer.current) clearInterval(locationTimer.current);
    void shareMyLocationOnce();
    locationTimer.current = setInterval(() => void shareMyLocationOnce(), 45000);
  }, [shareMyLocationOnce]);

  const stopLocationLoop = useCallback(() => {
    if (locationTimer.current) {
      clearInterval(locationTimer.current);
      locationTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const priv = privacy;
    if (
      unlocked &&
      !priv.ghostMode &&
      (priv.locationSharing === 'friends' || priv.locationSharing === 'temporary')
    ) {
      startLocationLoop();
    } else {
      stopLocationLoop();
    }
    return () => stopLocationLoop();
  }, [privacy, unlocked, startLocationLoop, stopLocationLoop]);

  useEffect(() => {
    if (unlocked && online) {
      void flushQueuedMessages();
    }
  }, [unlocked, online, flushQueuedMessages]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      unlocked,
      identity,
      username,
      token,
      friends,
      requests,
      messages,
      locations,
      privacy,
      online,
      cellularRequiredOk,
      gpsRequiredOk,
      connectionLabel,
      unlock,
      setupAccount,
      refreshFriends,
      addFriendByQuery,
      respondRequest,
      sendText,
      sendAttachment,
      updatePrivacy,
      shareMyLocationOnce,
      startLocationLoop,
      stopLocationLoop,
      markConversationRead,
      flushQueuedMessages,
    }),
    [
      ready,
      unlocked,
      identity,
      username,
      token,
      friends,
      requests,
      messages,
      locations,
      privacy,
      online,
      cellularRequiredOk,
      gpsRequiredOk,
      connectionLabel,
      unlock,
      setupAccount,
      refreshFriends,
      addFriendByQuery,
      respondRequest,
      sendText,
      sendAttachment,
      updatePrivacy,
      shareMyLocationOnce,
      startLocationLoop,
      stopLocationLoop,
      markConversationRead,
      flushQueuedMessages,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
