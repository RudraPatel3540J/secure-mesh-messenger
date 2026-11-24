# Secure Mesh Messenger — QA & Platform Review

Date: 2026-11-24  
Scope: MVP codebase + Android emulators (`SMM_Phone_A` / `SMM_Phone_B`) + API suite  
iOS: **not runnable** (full Xcode / `simctl` not installed — only Command Line Tools)

## Executive verdict

| Area | Verdict |
|---|---|
| Backend E2EE relay | Strong for MVP — **29/29 API edge-case tests passed** |
| Android (2 AVDs) | Emulators boot; Expo Go installed; **Metro must be running** or app shows Expo error |
| iOS Simulator | **Blocked** — install Xcode from App Store to test |
| Client product completeness vs blueprint MVP | Partial — core chat works; several “Done” items are incomplete or stubbed |
| Production readiness | Not ready — security/crypto/queue/reconnect gaps remain |

---

## Feature matrix (blueprint MVP vs reality)

| Feature | Claimed | Actual | Android | iOS |
|---|---|---|---|---|
| Crypto identity / Secure ID | Done | Works | Yes (code) | Same code; untested |
| Optional username | Done | Works | Yes | Untested |
| QR / share Secure ID | Done | QR render + share | Yes | Untested |
| Friend requests | Done | Works | Yes | Untested |
| 1:1 E2EE text | Done | NaCl box E2EE | Yes | Untested |
| Encrypted local storage | Done | AsyncStorage for messages (not encrypted DB) | Partial | Partial |
| Internet relay ciphertext-only | Done | Verified in API tests | Yes | Yes |
| Message queue + delivery | Done | **Queue marks `queued` but never auto-retries** | Bug | Bug |
| Live map / location E2EE | Done | Encrypted envelopes work; **map is fake lat/lon projection, not MapLibre** | Partial | Partial |
| Ghost Mode / temporary share | Done | UI + privacy flags | Yes | Untested |
| Privacy dashboard | Done | Settings toggles | Yes | Untested |
| PIN + Secure Store | Done | Works | Yes | Untested |
| Recovery phrase | Done | Shown at signup; **no restore flow** | Incomplete | Incomplete |
| Nearby tab | UI present | **Stub only** (BLE not implemented) | Stub | Stub |
| Photo / voice / groups (blueprint MVP list) | Mentioned in blueprint | **Not implemented** | Missing | Missing |

Deferred (correctly postponed): blockchain, multi-hop mesh, MLS groups, calls, SOS radio, ZK.

---

## Platform findings

### Android (tested environment)

- AVDs `SMM_Phone_A` / `SMM_Phone_B` online as `emulator-5554` / `emulator-5556`
- Expo Go installed on both
- Cleartext HTTP enabled (`usesCleartextTraffic`) — required for local `http://10.0.2.2:8787`
- Host resolution: emulator → `10.0.2.2`; physical device → Expo LAN IP (auto-detect in `config.ts`)
- **P0 runtime issue observed:** when Metro is down, Expo Go shows *UpdateFailedToLoad* / ErrorActivity — not an app logic bug, but blocks UI QA until `npx expo start` is running
- **P0 runtime issue (fixed during QA):** old Expo Go APK was incompatible with SDK 58. Installed **Expo Go 58.0.5** on both AVDs; onboarding UI (“Create Secure Identity”) now loads.

### iOS (blocked)

- No `/Applications/Xcode.app`, no `simctl`
- `app.json` lacks `NSAppTransportSecurity` / `NSAllowsArbitraryLoads` for local HTTP — **will fail talking to `http://localhost:8787` on device/simulator until fixed**
- KeyboardAvoidingView already has iOS-specific behavior in chat
- Need Xcode + iOS Simulator + Expo Go for iOS before claiming parity

---

## Bugs & gaps (prioritized)

Deep audits: [Mobile audit](b70464a1-196c-4b5f-9666-02806abe5d1b) · [Server audit](ce6dad11-ec14-4e7f-a57c-fa1da393b826)

### P0 — security / reliability blockers

1. **Account takeover via public key** — `POST /identity/login` accepts `secureId` + `identityPublicKey` with **no private-key proof**. Public keys are returned by lookup/friends; anyone can mint a token and rotate the real user out (`routes.ts`).
2. **Registration unbound** — server does not verify `secureId === deriveSecureId(publicKey)` or possession of private/signing keys.
3. **Failed register strands device** — identity/PIN saved before API succeeds; unlock then always fails (no token, no reset) (`AppContext.setupAccount`).
4. **Offline queue never flushes** — `queued` status with no online retry loop.
5. **WebSocket no reconnect** — no `onclose` / backoff; realtime dies after blips.
6. **WS typing bypasses friends/blocks** — peer taken from attacker-controlled `conversationId`; friendship query discarded (`index.ts`).
7. **Block does not stop chat/location** — only blocks new friend requests; messages/location/typing still allowed.
8. **`INSERT OR REPLACE` on message/location IDs** — known ID can overwrite another user’s envelope.
9. **“Delivered” on WS send loses pending** — open socket marks delivered before client ACK; crash = message gone from `/messages/pending`.
10. **iOS ATS missing** — local HTTP will fail without Info.plist exception.
11. **Recovery phrase is not recovery** — random words unrelated to keys; cannot restore identity.

### P1 — incorrect or incomplete MVP claims

12. **Local messages not encrypted at rest** — AsyncStorage stores plaintext.
13. **PIN does not encrypt keys** — only gates UI; SecureStore readable without PIN.
14. **Map is not a real map** — lat/lon projection only.
15. **Nearby is stub** — no BLE/Wi‑Fi P2P.
16. **Stale location can win** — pending ingest order can overwrite newer coords with older.
17. **Ghost Mode does not revoke** already-shared location.
18. **No read receipts** — only `delivered` ACK; unread badges never clear via read.
19. **Reverse friend requests** can create duplicate directional friendships.
20. **Rejected requests cannot be retried** (UNIQUE on from/to all statuses).
21. **Tokens use `Math.random()`** — weak, no expiry; plaintext in SQLite.
22. **PRODUCT.md overstates** encrypted storage and message queue.

### P2 — polish / abuse / edge cases

23. No rate limiting; CORS wide open; listen on `0.0.0.0` without TLS.
24. No safety-number / key-change warnings; signing keys unused.
25. Username case rules inconsistent (register vs patch vs NOCASE lookup).
26. No unblock / unfriend / logout / multi-device session APIs.
27. No pagination on pending messages/friends.
28. App never auto-locks on background.
29. QR scanner missing despite camera permission copy.
30. Mobile `tsc` type errors around message status / API inference.

---

## API automated results (2026-11-24)

Ran against `http://127.0.0.1:8787/api`:

**29 passed / 0 failed**, including:

- register / duplicate / incomplete body
- auth required / bad token
- lookup, self-friend reject, friend request/accept, already-friends
- message reject when not friends
- E2EE encrypt → server ciphertext → decrypt
- wrong-key decrypt fails
- ack, location friends / not-friends / expired pending filter
- login rotates token (old invalid)
- block prevents request
- short username reject

---

## Manual test cases (execute on 2 Android AVDs)

### P0

| ID | Steps | Expected |
|---|---|---|
| A1 | Metro + API up; open Expo on both AVDs | Create identity screens load |
| A2 | Register `@alice` / `@bob` | Both succeed; recovery alert shown |
| A3 | Alice adds bob; Bob accepts | Friendship both sides |
| A4 | Send text both ways | Ciphertext on server; plaintext only on devices |
| A5 | Kill API mid-chat; send; restore API | Today: stays queued (bug). Desired: auto-send |
| A6 | Toggle airplane on A; send; restore | Desired: flush queue + WS reconnect |
| A7 | Unlock wrong PIN | Reject; no unlock |
| A8 | Login same identity on B while A online | Today: A token dies (known) |

### P1

| ID | Steps | Expected |
|---|---|---|
| B1 | Map → Share with friends | GPS permission; friend receives encrypted update |
| B2 | Ghost Mode ON | Stops outbound location |
| B3 | Temporary 1 hour share | Stops after expiry |
| B4 | Nearby toggles | UI only until BLE shipped |
| B5 | Share Secure ID / QR | Other device can add by Secure ID |
| B6 | Block user | Cannot message / request |

### P2

| ID | Steps | Expected |
|---|---|---|
| C1 | Empty message send | No-op |
| C2 | Very long message | Accept or graceful error |
| C3 | Rotate username | Unique enforcement |
| C4 | App background 10m | WS may drop; should reconnect |
| C5 | Clear app data | Requires re-register (keys lost) |

### iOS (after Xcode)

| ID | Steps | Expected |
|---|---|---|
| I1 | Install Xcode + iOS Simulator + Expo Go | App loads |
| I2 | Hit local HTTP API | Needs ATS exception or HTTPS |
| I3 | Keyboard in chat | Composer not covered |
| I4 | Secure Store / Keychain | Keys persist across relaunch |
| I5 | Location permission strings | System dialog uses Info.plist copy |

---

## Recommended next fixes (order)

1. Start Metro reliably + document `scripts/qa-android.sh`
2. WS reconnect + queued message flush on online
3. iOS ATS / cleartext config
4. Encrypt local message store or stop claiming it
5. Recovery restore flow or remove phrase claim
6. Real MapLibre map
7. Multi-device tokens (don’t clobber session)

---

## How to re-run

```bash
# API
cd secure-mesh-messenger && npm run server

# Metro
cd apps/mobile && npx expo start --lan

# Emulators
open scripts/SMM_Phone_A.command
open scripts/SMM_Phone_B.command
```
