# Secure Mesh Messenger

Privacy-first encrypted messenger based on the **Secure Mesh Messenger** product blueprint (ChatGPT master document).

This repository ships a **working MVP 1.0** you can run today:

- Cryptographic identity (no phone number)
- Secure ID + optional username + QR
- Friend requests
- One-to-one **end-to-end encrypted** text chat
- Encrypted local message storage
- Internet message relay (server stores **ciphertext only**)
- Offline queue when network is down
- Delivery status indicators
- Live location sharing (encrypted envelopes) + Ghost Mode
- Privacy dashboard
- App PIN lock + Secure Store key storage

Deferred (per blueprint MVP guidance): blockchain DID, multi-hop mesh BLE, video calls, MLS groups, ZK proofs.

## Architecture

```text
Expo mobile app  --E2EE ciphertext-->  Node relay API + WebSocket  --ciphertext-->  recipient device
       |                                         |
  Secure Store / AsyncStorage              SQLite (envelopes only)
```

## Requirements

- Node.js 20+
- Expo Go app on a phone **or** iOS Simulator / Android Emulator

## Quick start

```bash
cd secure-mesh-messenger
npm install
npm run shared:build
npm run server
```

In another terminal:

```bash
cd secure-mesh-messenger
npm run mobile
```

Scan the Expo QR code, or press `i` / `a` for simulator.

### Physical device networking

Set your computer LAN IP so the phone can reach the API:

```bash
EXPO_PUBLIC_API_HOST=192.168.1.20 npm run mobile
```

## Test with two users

1. Start the server.
2. Open the app on two devices/simulators (or clear app data between accounts).
3. Create identity A (`@alice`) and identity B (`@bob`).
4. On Alice → Friends → add `@bob` (or paste Bob’s Secure ID).
5. On Bob → accept request.
6. Chat — messages are encrypted before upload.
7. Map → enable “Share with friends” / temporary share to send encrypted location updates.

## API

- `GET /api/health`
- `POST /api/identity/register`
- `POST /api/identity/login`
- `GET /api/identity/lookup?q=`
- `POST /api/friends/request`
- `GET /api/friends`
- `POST /api/messages/send`
- `POST /api/location/update`
- `WS /ws` (auth + realtime envelopes)

Default port: `8787`

## Security notes

- Message and location payloads use **X25519 + NaCl box** (authenticated encryption).
- Private keys never leave the device.
- Backend cannot read plaintext messages or GPS coordinates.
- This is an MVP cryptographic design suitable for demos and iteration — production hardening would add Signal/Double Ratchet, safety numbers, sealed sender, and professional audit.

## Project layout

```text
secure-mesh-messenger/
  apps/mobile   Expo React Native client
  apps/server   Express + WebSocket + SQLite relay
  packages/shared  Shared crypto/types
```
