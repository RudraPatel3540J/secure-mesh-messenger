# Secure Mesh Messenger — product alignment

Source: ChatGPT shared blueprint (“SECURE MESH MESSENGER — Complete Product Blueprint…”).

## Built in this MVP

| Blueprint item | Status |
|---|---|
| No phone-number identity | Done |
| Secure ID + optional username | Done |
| QR / share Secure ID | Done |
| Friend requests | Done |
| One-to-one E2EE text | Done |
| Encrypted local chat storage | Done |
| Internet relay (ciphertext only) | Done |
| Message queue + delivery states | Done |
| Live location + Ghost Mode + temporary share | Done |
| Privacy dashboard | Done |
| Device PIN + secure key storage | Done |
| Recovery phrase shown at signup | Done |
| 5-tab navigation (Chats / Map / Nearby / Friends / Settings) | Done |

## Deferred (explicitly postponed by blueprint §41)

- Blockchain / decentralized identity registry
- Multi-hop mesh networking
- Full BLE / Wi‑Fi Direct nearby chat
- MLS group encryption
- Voice / video calls
- SOS hardware / long-range radio
- Zero-knowledge proofs

## Network & GPS

- App monitors network and GPS readiness continuously.
- Messaging works over Wi‑Fi or cellular; offline messages queue locally.
- Location sharing requires GPS permission and is **off by default** (Ghost Mode default on).
