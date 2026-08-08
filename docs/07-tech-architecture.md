# Technical Architecture

---

## 1. The stack, and why each piece

| Layer | Choice | Why this one |
|---|---|---|
| App | **Expo SDK 57** (React Native 0.86, TypeScript) | One codebase for iOS and Android. **EAS builds iOS in the cloud, so you never need a Mac.** OTA updates ship JS fixes in minutes without a store review. |
| Navigation | **expo-router** | File-based routing — the folder structure *is* the app structure, which is far easier to reason about when you're learning. |
| Backend | **Supabase** (Postgres + PostGIS + Auth + Realtime + Edge Functions) | Managed Postgres with real geospatial support and row-level security, a dashboard you can click around in, and a Mumbai region. Not a toy, and not a lock-in — it's just Postgres underneath. |
| Domain logic | **`@sharing/core`**, pure TypeScript | Runs unchanged in the app and on the server. |
| Payments | **Razorpay** (UPI, cards, netbanking, UPI AutoPay) | The only real option for UPI AutoPay mandates in India. |
| Maps | react-native-maps; Google on Android, Apple on iOS | Curated hotspots mean almost no geocoding calls, which keeps you inside the free tier. |
| Push | Expo Push → FCM / APNs | One API for both platforms. |

### What was deliberately not chosen

- **Flutter** — fine technology, but the JS ecosystem and OTA updates matter more
  for a solo non-coder founder than raw render performance for a form-and-map app.
- **Native iOS + Android separately** — two codebases, two skill sets, twice the
  work. Not defensible at this stage.
- **A custom Node/Nest backend** — you'd spend three months building auth,
  migrations and row-level security that Supabase gives you on day one.
- **Firebase** — no relational integrity, and this domain is deeply relational.
  The three-seat cap is a row-locked constraint; expressing that in Firestore is
  painful and fragile.

## 2. Shape

```
┌──────────────────────────────┐
│  Expo app (iOS + Android)    │
│  expo-router · @sharing/core │   core computes the *preview* price
└──────────────┬───────────────┘
               │ HTTPS + JWT
┌──────────────▼───────────────┐
│  Supabase                    │
│  Postgres + PostGIS          │   RLS: default deny, opened per table
│  Auth (phone OTP)            │
│  Realtime (pool fill state)  │
│  Edge Functions (Deno)       │   core computes the *actual* settlement
└──────────────┬───────────────┘
               │
      Razorpay · FCM/APNs · Maps
```

## 3. One source of truth for money

`@sharing/core` is imported by both the app and the Edge Functions. The app uses
it to show you what will happen before you tap; the server uses the same
functions to decide what actually happens and write the ledger.

**The server is always the authority.** The client copy exists so the number on
screen and the number on the receipt cannot disagree — not so the client can
decide anything. `settle-cancellation` re-derives every figure server-side and
calls `assertFundingBalances()` before writing a single row.

## 4. Data model rules

- **Money is `bigint` paise.** Never numeric, never float, anywhere.
- **The ledger is append-only** — enforced by Postgres rules that make UPDATE and
  DELETE into no-ops. Corrections are new rows. When a driver asks why he was
  paid ₹138 you need the history, not the current state.
- **Double-entry.** Every movement writes a debit and a credit sharing an
  `entry_group`, and `assert_ledger_balanced()` refuses an unbalanced group.
- **The seat cap is a database constraint** with row-level locking, because two
  simultaneous joins on a two-seat pool is a real race and the consequence is
  four people in a three-person rickshaw.
- **RLS is default-deny.** Every table is locked and opened deliberately.
- **The cancellations table has no reason column.** We never ask why, so there is
  nothing to store, leak, or subpoena. The cheapest way to secure data is not to
  hold it.

## 5. Scaling

The honest answer: **you will not need to think about this for a long time.**

| Stage | Load | What's needed |
|---|---|---|
| Pilot | 1 corridor, ~50 rides/day | Supabase free tier |
| One city | 50 corridors, ~5k rides/day | Supabase Pro ($25/mo). Add indexes on `pools(corridor_id, departure_at)` — already present |
| Multi-city | ~50k rides/day | Read replicas; move matching to a queue; partition `ledger` by month |
| Beyond | — | Shard by city. Corridors never cross cities, so city is a clean shard key |

Postgres will comfortably carry you to the third row. Do not pre-optimise for
the fourth — the failure mode of Indian mobility startups is running out of
runway, never running out of database.

## 6. Offline

Station basements and lift lobbies have no signal, and that is exactly when
somebody needs their ticket.

- The boarding QR is **HMAC-TOTP over a seed issued at booking** — it generates
  offline, indefinitely.
- Today's booked seat, plate, and driver name are cached locally.
- Cancellations queue and sync when signal returns. The notice window is
  timestamped at the moment the user tapped, not the moment the server received
  it — losing somebody a grace day because of a dead spot would be indefensible.

## 7. Verification

```bash
npm run verify     # typecheck both packages + 110 tests
```

110 tests, covering: money arithmetic, fare and pass pricing, the full
cancellation ladder across every notice/grace/reseat combination, credit-day
maths and pass extension, guarantee-fund solvency and shedding, match scoring
and hard filters, every fuel guardrail, emissions, and the design-token
accessibility floors.

The five worked examples in the fairness doc exist verbatim as tests. Change a
policy number in `policy.ts` and a test will fail and name the promise you just
altered — deliberately, because those numbers are commitments to people with
thin margins and should be hard to change by accident.
