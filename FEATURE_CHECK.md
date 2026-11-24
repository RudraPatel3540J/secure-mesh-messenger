# Feature & bug-fix check (2026-11-24)

## Automated API (post-fix)

**19/19 passed**, including:

| Check | Result |
|---|---|
| Reject mismatched secureId on register | Pass |
| Reject missing registration proof | Pass |
| Signed registration | Pass |
| Reject public-key-only login (account takeover) | Pass |
| Reject attacker login signature | Pass |
| Signed challenge login | Pass |
| Old token invalidated after login | Pass |
| Friends request/accept | Pass |
| Message stays `sent` until client ACK | Pass |
| Pending retains until ACK | Pass |
| E2EE decrypt | Pass |
| Reject status downgrade | Pass |
| Block stops messaging | Pass |
| Reject duplicate message id | Pass |
| Reject expired location | Pass |

Earlier suite (pre-hardening) was 29/29 on basic flows; auth model changed intentionally.

## Fixes applied this round

### Auth / identity
- Registration requires Ed25519 proof + `secureId === deriveSecureId(pubkey)`
- Login requires challenge nonce + signature (no public-key-only login)
- Cryptographically strong tokens (`nacl.randomBytes`)
- Register saves local identity **only after** server success (no stranded account)
- Username validation/normalization consistent; case-insensitive uniqueness

### Messaging
- Messages stay `sent` until recipient ACK (no premature delivered)
- `INSERT` (no overwrite) for message/location IDs
- Block removes friendship and blocks further messages/location
- Canonical `conversationId` enforced
- Monotonic status (no read→delivered downgrade)
- Client: WebSocket reconnect with backoff
- Client: flush queued messages when back online
- Client: mark conversation read when opening chat

### Location / GPS
- Catch unavailable GPS (no unhandled rejection)
- Check location services enabled
- Reject expired location on server
- Pending returns newest-per-sender only
- Client ignores expired / older location overwrites

### Other
- WS typing requires friendship + not blocked + canonical conversation id
- iOS ATS local networking / cleartext flags added for next Simulator run
- Recovery phrase UX clarified as demo-only (restore not enabled)

## Feature status (detailed)

| Feature | Status | Notes |
|---|---|---|
| Create identity | Working | Signed register |
| PIN unlock | Working | Relogin via challenge when online |
| Add friend (username/Secure ID) | Working | |
| Accept/reject request | Working | Boolean accept required |
| QR / share Secure ID | Working | Scanner still missing |
| E2EE text chat | Working | Ciphertext-only on server |
| Delivery states | Working | sent → delivered → read |
| Offline queue | Improved | Now flushes when online |
| Live location share | Working* | *Needs GPS enabled on emulator |
| Ghost Mode / 1h share | Working | Stops future shares |
| Nearby | Stub | UI only |
| Map tiles | Stub | Projection pins only |
| Photo/voice/groups | Missing | Deferred |
| Real recovery restore | Missing | Phrase is demo |
| iOS Simulator | Blocked | Needs Xcode |
| Blockchain / mesh | Deferred | By design |

## Manual Android checklist (2 emulators)

1. Reload Expo Go on both AVDs (Metro must be running).
2. Create `@alice` / `@bob` (clear app data if old stranded identities).
3. Friend + chat both ways — confirm status updates.
4. Airplane mode → send → restore — confirm queued then flush.
5. Extended controls → set GPS → Map → Share with friends / Share now.
6. Ghost Mode ON — Share now should explain sharing is off.

## Still open (not claiming fixed)

- Encrypt messages at rest (AsyncStorage still plaintext)
- Multi-device concurrent sessions
- Real MapLibre map + BLE nearby
- Rate limits / TLS in production
- Full recovery from phrase
- QR scanner
- iOS device/simulator live QA
