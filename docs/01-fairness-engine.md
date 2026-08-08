# The Fairness Engine

> How **Sharing** keeps a promise to two people whose interests look opposed:
> the passenger who might fall sick tomorrow, and the driver whose family eats
> from tomorrow's fare.

This is the document to get right. Everything else in the app is plumbing.

---

## 1. The trap

Here is the problem in its purest form, the one you kept returning to:

> A passenger holds a monthly Pass. On Tuesday night he gets a fever. On Wednesday morning
> ₹46 leaves his account for a ride he did not take.
>
> If we refund him, the driver — who woke at 6am, drove to the gate, and waited — loses
> ₹46 he had counted on.
>
> If we don't refund him, he feels robbed, tells four neighbours, and the corridor dies.

Every ride-commitment product in the world hits this wall. Most of them pick a side:
gyms and OTT pick the merchant (no refunds, ever), food delivery picks the customer
(refund freely, eat the cost). **Both answers are wrong here**, because both sides of this
market are price-sensitive individuals and we need both to trust us.

### Why "just ask for a reason" fails

The obvious answer — let people cancel free with a genuine reason — is the one that
looks fair and is actually the worst option available. You already identified why:

> *"There are so many reasons that people have been given and just fooled the system.
> I don't want that to happen!"*

Exactly right. A reason-based system has three fatal properties:

1. **It cannot be verified.** You will not collect doctor's notes for a ₹46 rickshaw ride.
2. **It taxes honesty.** The honest person cancels twice and feels guilty. The dishonest
   person cancels twelve times and feels clever. You have built a machine that transfers
   money from honest users to dishonest ones.
3. **It makes you the judge.** Every rejected reason is a support ticket and a one-star
   review. At 10,000 users this is a full-time team arbitrating fevers.

**So we never ask why.** Not once, anywhere in the product. That is a design commitment.

---

## 2. The four mechanisms

Instead of judging intent, we make the outcome fair regardless of intent.

```
┌─ 1. GRACE DAYS ──────────────────────────────────────────────────┐
│  A fixed budget of free, no-questions cancellations per Pass.    │
│  Weekly: 1.  Monthly: 4.  Usable at ANY notice, even 5 min.      │
│  You don't explain. We don't ask. It's yours, it's counted,      │
│  and you can see how many are left.                              │
└──────────────────────────────────────────────────────────────────┘
┌─ 2. RESEAT MARKET ───────────────────────────────────────────────┐
│  A cancelled seat is immediately offered to NOW/LATER riders on   │
│  the same corridor + window. If it sells, everyone is whole.     │
│  This is the mechanism that makes generosity affordable.         │
└──────────────────────────────────────────────────────────────────┘
┌─ 3. NOTICE LADDER ───────────────────────────────────────────────┐
│  Once Grace Days are spent, refund scales with how much warning  │
│  you gave — because notice is exactly what determines whether    │
│  we can reseat.                                                  │
└──────────────────────────────────────────────────────────────────┘
┌─ 4. GUARANTEE FUND ──────────────────────────────────────────────┐
│  A 4% levy on every fare. Pays the driver whenever a seat goes   │
│  unsold and the passenger wasn't charged. The driver's income    │
│  never depends on anyone's health.                               │
└──────────────────────────────────────────────────────────────────┘
```

### Why Grace Days are the right primitive

A Grace Day is honest about what it is: *we have budgeted for the fact that you are a
human being.* Four sick/WFH/holiday days a month is roughly what real life costs, and
it's cheap to fund because most people won't use all four.

It converts an unbounded, unverifiable liability into a **known, priced, capped** one.
You can put it on a pricing page. You can show a counter in the app: `Grace Days: 3 of 4
left`. A user who can see the counter *self-rations* — which is the whole trick. Nobody
argues with a budget they can see; everybody argues with a judgement.

It's the same insight behind airline change-fee waivers and PTO: **give people a visible
allowance and they behave better than if you police them.**

---

## 3. The cancellation ladder

When a passenger declares an absence, we resolve in this exact order:

```
                          ┌──────────────────────┐
   passenger cancels ───► │ Try to RESEAT        │
                          │ (offer to NOW/LATER) │
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┴─────────────────┐
                    ▼                                  ▼
              RESEAT SOLD                        NOT RESEATED
                    │                                  │
      passenger: +1.0 Credit Day           ┌───────────┴────────────┐
      driver:    paid by replacement       ▼                        ▼
      fund:      +0                  GRACE DAY LEFT?          NO GRACE LEFT
      ✅ everyone whole              │                        │
                                     ▼                        ▼
                        passenger: +1.0 Credit Day     apply NOTICE LADDER
                        driver:    paid by fund        (table below)
                        fund:      −₹46                driver: always paid
                        grace:     −1
```

**Reseat is always attempted first, before Grace Days are spent.** This matters: it means
a well-organised passenger who cancels the night before usually keeps their Grace Days for
the emergency they'll actually need. The system rewards notice without punishing crisis.

### The notice ladder (only reached when reseat failed AND no Grace Days remain)

| Notice before departure | Credit to passenger | Driver receives | Funded by |
|---|---|---|---|
| **≥ 12 h** (i.e. by 21:00 the night before, for an 09:00 ride) | **100%** — 1.0 Credit Day | Full seat fare | Guarantee Fund |
| **3–12 h** | **75%** — 0.75 Credit Day | Full seat fare | 75% fund / 25% forfeit |
| **1–3 h** | **50%** — 0.5 Credit Day | Full seat fare | 50% fund / 50% forfeit |
| **< 1 h or no-show** | **0%** | Full seat fare | Forfeited fare |

The ladder is steep on purpose, and the steepness is *justified*, not punitive: at 12 hours
we can reseat ~70% of seats, at 1 hour ~15%, at 5 minutes ~0%. **The refund tracks our
actual ability to resell the seat.** You can explain that sentence to an angry user and
they will accept it. You cannot explain an arbitrary 50%.

### The one thing the ladder never does

**The driver is paid in full at every single rung.** There is no row in that table where
the driver eats the loss. Read the table again — the "Driver receives" column is constant.

That constancy is the product. It's what you tell a driver in the 90 seconds you have to
recruit him at a stand:

> *"आप गाड़ी लेकर आए, तो आपका पैसा पक्का। सवारी आए या न आए, वो हमारा सिरदर्द है, आपका नहीं।"*
> *("If you show up with the rickshaw, your money is certain. Whether the passenger comes
> is our headache, not yours.")*

---

## 4. Credit Days, not refunds

When a passenger is made whole, they receive a **Credit Day**, not rupees.

```
1.0 Credit Day  =  the Pass end date moves forward by one service day
0.5 Credit Day  =  half a day banked; two halves make a whole day
```

You described this exactly: *"that person who is not going will get one day plus in the
application."* Right. Here's why it's better than a cash refund for everyone involved:

| | Cash refund | Credit Day |
|---|---|---|
| Passenger feels | "I got my money back" | "I didn't lose my day" — *slightly better*, it's a day of travel, not ₹46 |
| Retention | Neutral, sometimes negative | Positive — extends the relationship |
| Cash flow | Money leaves | Money stays; liability is a future seat |
| Payment fees | Refund fees, 3–7 day settlement, disputes | Zero |
| Fraud surface | Real (refund farming) | Near zero — credits are non-transferable and expire |

**Credit rules, kept deliberately simple:**

- Credits attach to the Pass, extend its end date, and are shown as a date, not a balance:
  *"Your pass now runs to 12 Sept"* — not *"you have 2.5 credits"*. Dates are concrete;
  balances feel like a video game.
- Credits expire **60 days** after issue, or when the Pass lapses without renewal + 30 days.
- Credits are **not** transferable, not refundable to cash, not sellable.
- Max **8 Credit Days** may be banked at once. Beyond that, the passenger is told plainly:
  *"You've missed a lot of rides. Want to switch to Weekly, or pause?"* — which is the
  honest, kind thing to say to someone who is over-buying.
- A Pass on which >50% of days were cancelled auto-suggests a downgrade at renewal.
  Selling someone a plan they don't use is how you get churn and a bad reputation.

---

## 5. The Guarantee Fund

The 4% levy. This is what turns a nice policy into a solvent one.

### Inflows

```
4% of every seat fare, on every ride, every mode.
At an average ₹48/seat that is ₹1.92/seat → ₹5.76 per full pool.
```

### Outflows, in priority order

1. Driver make-whole when a seat is cancelled with notice and can't be reseat (§3).
2. Short-Fill subsidy when a pool runs at 1 or 2 seats (spec §6.4).
3. Driver make-whole when *we* cancel (system error, no driver found, corridor suspended).

### Solvency model

Let, with an average seat fare of ₹48 across spot and pass riders:
- `c` = cancellation rate (fraction of committed seats cancelled) — assume **8%**
- `r` = reseat success rate on cancelled seats — assume **55%**
- `s` = short-fill rate (pools departing under-filled) — assume **12%**
- average fund top-up on an under-filled pool — **₹27**

```
Fund income per 100 seats  = 100 × ₹48 × 0.04                = ₹192.00

Cancellation payouts       = 100 × 0.08 × (1 − 0.55) × ₹48   = ₹172.80
                             (8 cancels, 4.4 reseated, 3.6 paid from fund)

Short-fill subsidy         = 33.3 pools × 0.12 × ₹27          = ₹108.00

Total outflow                                                 = ₹280.80
Net per 100 seats                                             = −₹88.80   ⚠️
```

These are not illustrative figures — they come from
[`projectFund()`](../packages/core/src/fairness/guaranteeFund.ts) and are asserted in
[`guarantee-fund.test.ts`](../packages/core/src/fairness/__tests__/guarantee-fund.test.ts).
Change an assumption and the model recomputes.

**The fund does not self-fund at launch.** Say that out loud now rather than discovering it
in month four. Three levers, and you will need all three:

| Lever | Effect | When |
|---|---|---|
| Reseat rate 55% → 75% | Cancellation payout ₹172.80 → ₹96.00 | Comes free with density. The single highest-leverage number in the business. |
| Short-fill 12% → 5% | Subsidy ₹108 → ₹45 | Comes with density + not launching thin corridors |
| Levy 4% → 5% | Income ₹192 → ₹240 | Last resort. Only if the first two stall. |

At **75% reseat and 5% short-fill**, income ₹192 vs outflow ₹141 — the fund runs a ₹51
surplus per 100 seats and you can *lower* the levy, which is a genuinely good story to tell
users.

**Until then, the deficit is a subsidy line in your budget: ₹0.89 per seat.**
At 500 seats/day that is ₹445/day, ~₹13,400/month. That is a *knowable, boundable* cold-start
cost, and it is far cheaper than the discount-war alternative. Budget it in `10-roadmap-and-costs.md`.

**Hard rule:** the fund is a real ring-fenced ledger with a floor. If its balance drops
below 14 days of projected outflow, **NOW mode is disabled on the weakest corridors first**
(automatic, in code) rather than letting the fund go negative. Degrade gracefully, never
insolvently.

---

## 6. Symmetry: what happens when the *driver* flakes

A fairness engine that only disciplines passengers is a fairness engine passengers won't
trust. The obligations are mirrored.

| Driver event | Passenger gets | Driver consequence |
|---|---|---|
| Cancels ≥ 12h before | Auto-rematched, no charge | None. Life happens. |
| Cancels 3–12h before | Auto-rematched + **1 Credit Day** if we can't rematch | Reliability −2 |
| Cancels < 3h | 1 Credit Day + **₹30 inconvenience credit** | Reliability −5, paid from driver's earnings |
| No-show | Full Credit Day + ₹30 + free alternative ride booked | Reliability −10, 1 strike |
| 3 strikes in 30 days | — | Removed from Pass matching for 14 days |

Note the shape: **early notice is free for the driver too.** We are not trying to punish
drivers, we're trying to make late surprises rare on both sides. A driver who tells us at
9pm that he can't come tomorrow has done us a favour, and the system should feel like it
knows that.

Drivers also get their own Grace Days: **2 per month**, same principle, same visibility.

---

## 7. Anti-abuse

The mechanisms above are generous. Generous systems get farmed. Guardrails:

| Pattern | Detection | Response |
|---|---|---|
| Serial late-canceller | >30% cancel rate over 14 days, ≥6 rides | Grace Days halved next cycle; shown a message explaining why |
| Grace-Day farming across accounts | Same device / UPI VPA / phone across accounts | Grace Days shared across the cluster, not multiplied |
| Cancel-and-rejoin (cancel to dodge a co-rider, rejoin the same pool) | Same corridor + window rebooked within 30 min | Second booking pays full, no Credit issued |
| Reseat collusion (friend "buys" your seat) | Reseat buyer has >70% overlap with canceller's history | Credit issued but flagged; 3 flags → manual review |
| Phantom Pass (buy a Pass, never ride, claim credits) | 0 rides in first 5 service days | Pass auto-paused, money returned as cash, account reviewed |
| Fake no-show claim by passenger ("driver didn't come" when he did) | Driver GPS inside geofence at departure ± 5 min | Claim auto-rejected with the GPS evidence shown |

Every one of these is computed server-side from data we already have. **None of them
require a human to judge a story**, which is the same principle as §1.

---

## 8. Worked examples

Concrete cases, using Palava Gate 2 → Dombivli East Station. The monthly pass seat fare
is **₹46** (₹50 spot, less the 8% pass discount); the driver is owed that ₹46 in every
single case below. These five cases exist verbatim as tests.

### Case A — the fever, with notice

> Ravi has a Monthly Pass (4 Grace Days, 0 used). Tuesday 21:40, he feels feverish and
> cancels Wednesday's 09:15 ride. Notice: 11 h 35 m.

```
1. Reseat attempted → a LATER rider going to the 09:15 pool takes it.  SOLD ✅
2. Ravi:   +1.0 Credit Day. Pass end date 04 Sep → 05 Sep.
3. Driver: paid by the replacement rider, who books at the ₹50 spot rate.
4. Fund:   ₹0 out. Actually +₹1.96 in, from the replacement's levy.
5. Grace:  still 4 of 4. Not spent — reseat succeeded first.
```

Ravi opens the app and sees: **"Wednesday cancelled. Your pass now runs to 5 Sept.
Grace days: 4 of 4 still available."** He feels looked after. He is.

### Case B — the fever, no notice, no reseat

> Same Ravi, but he wakes at 09:05 already ill and cancels 10 minutes before the ride.

```
1. Reseat attempted → 10 min notice, nobody available.  UNSOLD ❌
2. Grace Day available? YES (4 left).
3. Ravi:   +1.0 Credit Day.  Grace Days 4 → 3.
4. Driver: paid ₹46 from the Guarantee Fund.
5. Fund:   −₹46.
```

App says: **"Get well soon. Grace day used — 3 left this month. Your pass runs to 5 Sept."**
No form. No reason. No proof. He used a thing he was told he had.

### Case C — the fifth absence

> Later that month Ravi cancels a 5th time, 2 hours before, and the seat doesn't reseat.

```
1. Reseat → UNSOLD ❌
2. Grace Days: 0 left.
3. Notice ladder: 2 h → the 1–3 h rung → 50%.
4. Ravi:   +0.5 Credit Day banked — another half makes a full day of travel.
5. Driver: paid ₹46 in full — ₹23 from the fund, ₹23 from Ravi's forfeited fare.
6. Fund:   −₹23.
```

App says, before he confirms — **this is shown as a preview, never as a surprise after**:

> *"You've used all 4 grace days this month. Cancelling now, 2 hours ahead, returns half a
> day (₹23 of ₹46) to your pass. Cancel anyway?"*

He may be annoyed. He will not be *surprised*, and he won't feel cheated, because he saw
the number before he tapped. **Surprise is what generates one-star reviews, not cost.**

### Case D — the driver oversleeps

> The young driver you actually dealt with — the one who kept sleeping in. He doesn't show
> at 09:15. Three passengers are standing at the gate.

```
1. 09:20 no driver in geofence → auto-detected, no passenger complaint needed.
2. System books a replacement from the corridor's standby pool.
3. Each passenger: +1.0 Credit Day AND ₹30 inconvenience credit.
4. Driver: no earnings; Reliability −10; strike 1 of 3.
5. Replacement driver: paid full corridor fare from the fund.
6. All three passengers get a push at 09:20:
   "Driver delayed. New rickshaw MH-05-BC-7788 arriving 09:26. Today is on us."
```

This is the single most important case in the whole document. **This is the failure that
made your real-world arrangement collapse**, and here the passenger's morning is saved in
six minutes without a phone call, an argument, or a rupee out of their pocket.

### Case E — the pool that never fills

> Wednesday 14:20, Khandeshwar → college. Only Priya has booked by the 14:20 deadline.

```
1. 14:15 (5 min before): "Only you so far. Waiting for 1 more until 14:25?"
   Priya taps "Wait".
2. 14:25: still alone.
3. Offer: "Ride solo for ₹85 (instead of ₹50), or cancel free."
   [ Ride solo ₹85 ]  [ Cancel — no charge ]
4. Priya cancels.
5. Priya: charged ₹0. Reliability: unaffected. No penalty of any kind.
6. Driver: paid ₹40 standby compensation from the fund for holding the slot.
7. Corridor: 14:20 slot flagged low-density; if it fails 3× in 7 days it's
   removed from the schedule and Priya is told which slots actually work.
```

Note step 5. **Declining a bad offer is always free.** If a user is ever penalised for our
failure to build enough supply, the product is lying about whose fault it is.

---

## 9. What the passenger actually sees

The whole engine, in the UI, is four things. No user ever reads this document.

```
┌─────────────────────────────────────────┐
│  Palava Gate 2 → Dombivli East          │
│  Mon–Sat · 9:15 AM                      │
│                                         │
│  Pass runs to     5 Sept  (+1 day)      │
│  Grace days       ●●●○   3 of 4 left    │
│  Next ride        Tomorrow 9:15 AM      │
│                                         │
│  [   I'm not going tomorrow   ]         │
└─────────────────────────────────────────┘
```

Tapping the button shows the consequence **before** confirming, always:

```
┌─────────────────────────────────────────┐
│  Skip tomorrow, 9:15 AM?                │
│                                         │
│  You get a full day back.               │
│  Your pass will run to 6 Sept.          │
│  Grace days stay at 3 — we'll try to    │
│  give your seat to someone else first.  │
│                                         │
│  [ Yes, skip tomorrow ]   [ Never mind ]│
└─────────────────────────────────────────┘
```

Four rules for this screen, and they are non-negotiable:

1. **Always show the outcome before the tap.** Never after.
2. **Never ask why.** No reason field, no dropdown, no "optional feedback".
3. **State it in days and dates**, never in percentages or credit balances.
4. **One tap to do it.** The night-before cancel is the single most-used action in the
   whole app by committed users. It must be reachable from the home screen, always.

---

## 10. Implementation

The rules above are implemented as pure, tested functions — no rules live only in prose:

| Rule | Code |
|---|---|
| Notice ladder & tier resolution | [`packages/core/src/fairness/cancellation.ts`](../packages/core/src/fairness/cancellation.ts) |
| Grace Day accounting | [`packages/core/src/fairness/grace.ts`](../packages/core/src/fairness/grace.ts) |
| Credit Days & Pass extension | [`packages/core/src/fairness/credits.ts`](../packages/core/src/fairness/credits.ts) |
| Guarantee Fund solvency | [`packages/core/src/fairness/guaranteeFund.ts`](../packages/core/src/fairness/guaranteeFund.ts) |
| Full resolution pipeline | [`packages/core/src/fairness/resolve.ts`](../packages/core/src/fairness/resolve.ts) |

Cases A–E in §8 exist verbatim as test cases in
[`packages/core/src/fairness/__tests__/worked-examples.test.ts`](../packages/core/src/fairness/__tests__/worked-examples.test.ts).
If you ever change a policy number, a test will fail and tell you which promise you just
broke. That is deliberate: **these numbers are promises to real people with thin margins,
and they should be hard to change by accident.**
