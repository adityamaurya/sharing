# Matching and Pools

Implementation: [`packages/core/src/matching/score.ts`](../packages/core/src/matching/score.ts)

---

## 1. Pool lifecycle

```
forming ──── 3rd seat taken, or deadline reached ────► locked
   │                                                     │
   │ deadline, under-filled                              │ driver accepts
   ▼                                                     ▼
short-fill offer ──── everyone declines ──► cancelled  assigned
   │ someone accepts                                     │
   └──────────────────────────────────────────────────► boarding
                                                         │ all seats scanned
                                                         ▼
                                                      running ──► completed
```

Seats are held for **90 seconds** while a passenger confirms, then released.
`expire_held_seats()` runs every minute so a half-finished booking never blocks
a seat somebody else could use.

The three-seat cap is a **database constraint with row-level locking**, not an
application check. Two people tapping "join" at the same instant on a pool with
two seats is a real race, and the consequence of losing it is four people in a
three-person rickshaw — a safety and legal failure, not a bug report.

---

## 2. The density switch

One engine, three interfaces. The interface is chosen by measured density, not
by preference:

| Candidate density (14-day) | Mode | What the user sees |
|---|---|---|
| < 8 | `manual` | A list of up to 10 people; you pick. "Tinder for your commute." |
| 8–25 | `assisted` | Top 3 suggested, one tap to accept |
| > 25 | `auto` | Nothing. You're just in a pool. |

**Why swiping is right when the pool is small.** With six candidates a list is
manageable and the human does the filtering for free. More importantly it builds
the social layer: you start recognising the same four faces from your building,
and that recognition is exactly the trust that makes daily pooling stick. A
stranger's rickshaw is a risk; Meera from B-wing's rickshaw is a lift.

**Why swiping must die when the pool is large.** With 200 candidates it is pure
friction, and friction at 8:40am loses to just taking a full-fare rickshaw. The
best matching UI is no matching UI.

Density comes from `corridor_density()` in SQL — distinct passengers who actually
completed a ride on this corridor within ±7 minutes of this time in the last 14
days. Bookings that never happened don't count, because a number that can be
inflated will be.

---

## 3. Match score

| Signal | Weight | Why |
|---|---|---|
| Departure time proximity | 35% | The binding constraint. ±7 min is one pool. |
| Pickup proximity | 20% | Same gate beats same society beats same 400m |
| Drop proximity | 15% | Detour cost |
| Reliability | 15% | Protects committed riders from flaky ones |
| Repeat co-rider | 10% | People like riding with people they know |
| Gender preference | 5% | Opt-in women-only pools |

**Hard filters run before scoring** — no score rescues an ineligible match:
pickup > 400m, drop > 800m, departure more than 14 minutes apart, or a
women-only mismatch.

A **new** user scores 0.5 on reliability, not 0. If new users can't be matched,
nobody can ever start, and the corridor never reaches density.

---

## 4. The reseat market

The mechanism that makes the fairness engine affordable. When a seat is
cancelled it is immediately offered to NOW and LATER riders on the same corridor
and window, at the **spot** rate.

Reseat rate by notice, which is what the notice ladder's percentages are actually
tracking:

| Notice | Expected reseat rate |
|---|---|
| ≥ 12 h | ~70% |
| 3–12 h | ~45% |
| 1–3 h | ~25% |
| < 1 h | ~5% |

Reseat rate is **the highest-leverage number in the business**. Moving it from
55% to 75% takes the Guarantee Fund from a ₹0.89/seat deficit to a surplus, with
no price change and no policy change. Everything that raises density raises it.

---

## 5. Women-only pools

An opt-in flag on passes and on NOW/LATER requests. A women-only pool matches
only women passengers. Driver gender is not filtered in v1 — the supply simply
isn't there — but the pool is flagged to the driver and trip-sharing is enabled
automatically.

MVAG 2025 explicitly contemplates women-only pooling, so this is aligned with
regulation rather than a risk under it.

---

## 6. Honest demand

`assessDemand()` returns one of three verdicts, and the app says the true one:

- **good** — "4 others going your way. Pool should fill quickly."
- **thin** — "Only 1 other rider so far. It may not fill."
- **none** — "Nobody else is going this way right now. You may prefer another
  service for this trip."

That last message sends a user to a competitor, and it should. An app that fakes
demand dies in one week at a Mumbai station: word travels along a rickshaw queue
faster than any push notification. Telling somebody the truth costs one ride and
buys a user who believes the next thing you tell them.
