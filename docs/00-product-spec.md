# Sharing — Product Specification

> **Sharing** is a rickshaw pooling app for India. Three people, one rickshaw, one fixed
> fare each, a seat you can count on tomorrow morning.

**Status:** v1 specification · **Owner:** Aditya Maurya · **Last updated:** 2026-08-08

---

## 1. The problem, stated precisely

There are four distinct problems here. They look like one problem but they are not, and
they need different solutions.

| # | Problem | Who feels it | What it costs today |
|---|---|---|---|
| P1 | **No pooling supply.** Stand cartels refuse to run shared rickshaws; you pay full fare or you walk. | Passenger | 2–3× the fair share fare |
| P2 | **Queue time.** You stand in line at the station for 10–40 minutes after an hour-long commute. | Passenger | 20–60 min/day |
| P3 | **No commitment mechanism.** A driver who promises to pick you up at 10:30 daily has no reason to actually show up. Nor do you. | Both | Broken arrangements, wasted trips |
| P4 | **Income volatility.** The driver has no guaranteed baseline. Every empty seat is a real loss for a person earning ₹600–900/day. | Driver | The reason P1 exists |

**P1 is caused by P4.** The cartel behaviour is not malice, it's rational risk management:
a driver who waits to fill three seats and fails has lost the trip. A driver who insists on
full fare has certainty. Any product that tries to fix P1 by scolding drivers will fail.

**The only durable fix is to remove the driver's downside risk.** Everything in this spec
follows from that one sentence.

---

## 2. What we are building (and what we are not)

**We are building:** a pre-booked, fixed-fare, 3-seat rickshaw pooling app for repeat
commutes on fixed corridors (society ↔ station, station ↔ college, station ↔ office park).

**We are not building** (v1): general point-to-point ride hailing, cabs, bikes, intercity,
parcel, or anything that competes with Uber/Ola/Rapido head-on. We win by being the only
app that makes a *shared* rickshaw *reliable*. That is a different market.

### The one-line pitch, in three languages

- **EN:** "Your seat. Same time. Same fare. Every day."
- **HI:** "आपकी सीट। वही समय। वही किराया। हर दिन।"
- **MR:** "तुमची सीट. तीच वेळ. तेच भाडं. रोज."

---

## 3. Core objects

```
Hotspot      A curated, geofenced pickup/drop point. Not a free-text address.
             e.g. "Palava Casa Bella Gate 2", "Dombivli East Station Auto Stand".

Corridor     An ordered pair of Hotspots (A → B) with a published fare table.
             e.g. Palava Gate 2 → Dombivli East Station.

Pool         One rickshaw trip on one Corridor at one departure time.
             Hard cap: 3 passenger seats. Never 4. Safety and legal (MVAG 2025:
             pooling "must not exceed seat capacity").

Seat         One passenger's place in one Pool. The atomic billable unit.

Pass         A recurring right to a Seat on a Corridor at a time window,
             for N service days. Weekly (6 days) or Monthly (26 days).

Credit       One unpaid-for future Seat, earned when you cancel with good notice.
             Denominated in *days*, not rupees. Extends your Pass end date.

Ledger       Append-only money record. Every rupee in, out, held, or credited.
```

### The 3-seat rule is not negotiable

Three passengers is the legal seating capacity of a standard Bajaj/Piaggio passenger
autorickshaw in Maharashtra. It is also the safety floor: a pool is never one passenger
alone with a driver at an odd hour. We enforce it in the database with a check constraint,
not just in the app.

---

## 4. The three ways to ride

Every screen, every table, every price rolls up into exactly three modes. If a feature
does not belong to one of these three, it does not ship in v1.

### 4.1 NOW — "I'm at the stand, get me a pool"

You are physically at a Hotspot. You open the app, it already knows where you are, you tap
your destination, you're in a pool. If two others are already waiting, you leave in under a
minute.

```
Open app  →  Hotspot auto-detected (GPS inside geofence)
          →  Pick destination (3 most-used corridors shown first)
          →  See live: "2 waiting · needs 1 more · ~4 min"
          →  Join  →  Seat held 90s  →  Pool fills  →  Driver assigned
          →  Walk to plate MH-05-XX-1234  →  Scan  →  Go
```

**If the pool doesn't fill** (this is the make-or-break case — see §6.4):
we never silently charge you 3× fare. At the departure deadline you choose:
wait another 5 min, ride at the **Short-Fill price** (capped), or leave free.

### 4.2 LATER — "I'll be at Khandeshwar at 1:45pm"

You are on a train. You know when you'll arrive. You post an *intent* and the system
matches you to other people arriving in the same 15-minute window.

This is the student flow, and it is the most under-served and most defensible part of the
product. Nobody serves it today because nobody knows who is arriving. We do, because
people tell us.

```
On the train  →  "Arriving Khandeshwar 13:45, going to college gate"
              →  System shows: "4 others arriving 13:38–13:52 for this corridor"
              →  Pre-commit  →  Pool forms before anyone lands
              →  Off the train, walk straight to the rickshaw, no queue
```

**The honesty rule:** if there is genuinely nobody, the app says so, plainly:
*"Only you so far for 13:45. Chance of a pool: low. Try 14:10 (3 others) or book solo."*
An app that fakes demand dies in one week in this market. Word travels fast at a station.

### 4.3 DAILY — "Lock my 10:30 seat for a month"

The core business. You commit to a Corridor + time window for a week or a month. You get
the same driver where possible, a guaranteed seat, and a lower per-ride price. The driver
gets a guaranteed, pre-funded baseline income.

```
Pick corridor + departure window + days (Mon–Fri / Mon–Sat / custom)
  →  See total, per-ride price, and your Grace Day allowance
  →  Pay upfront (UPI/card) OR set a UPI AutoPay mandate
  →  Matched to a driver who has committed to that corridor+window
  →  Every service day: 08:00 reminder → seat confirmed → ride
```

This is what you were negotiating manually with that young driver: ₹150/side, lump-sum for
the month, so he feels committed and you stop dealing with fare fluctuation. **Daily mode
is that handshake, made enforceable and repeatable.** That is the entire company.

---

## 5. Matching: swipe now, auto later

You were right that the mechanic has to change as the pool grows. But it should be **one
engine with a density switch**, not two products.

```
candidate_density = matched-capable users on this corridor+window in last 14 days

density < 8      →  MANUAL  (swipe/pick your co-riders — "Tinder for your commute")
density 8–25     →  ASSISTED (top 3 suggested, one tap to accept, swipe available)
density > 25     →  AUTO    (instant assignment, no swiping, matching is invisible)
```

**Why swiping works when the pool is small:** with 6 candidates, showing a list is fine and
the human does the filtering for free. It also builds the social layer — you recognise the
same four faces from your building, which is exactly the trust that makes daily pooling
stick.

**Why swiping must die when the pool is large:** with 200 candidates, swiping is friction,
and friction at 8:40am loses to just taking a full-fare rickshaw. Auto-match must be the
end state. Uber Pool's history is instructive here — every manual step they removed
increased completion rate.

### Match score

Passengers are matched on a weighted score, not first-come-first-served:

| Signal | Weight | Why |
|---|---|---|
| Departure time proximity | 35% | The binding constraint. ±7 min is one pool. |
| Pickup point proximity | 20% | Same gate > same society > same 400m |
| Drop point proximity | 15% | Detour cost |
| Reliability score | 15% | Protects committed riders from flaky ones |
| Repeat co-rider history | 10% | People like riding with people they know |
| Gender preference match | 5% | Opt-in women-only pools (MVAG 2025 encourages) |

Reliability score is public as a badge (Gold/Silver/New), never as a raw number. Raw
numbers invite gaming and shame.

### Women-only pools

Opt-in flag on the Pass and on NOW/LATER requests. A women-only pool matches only
women passengers; driver gender is not filtered in v1 (supply reality), but the pool is
flagged to the driver and trip-sharing is auto-enabled. MVAG 2025 explicitly contemplates
women-only pooling, so this is aligned with regulation, not a risk.

---

## 6. Pricing

### 6.1 The formula

```
corridor_full_fare       Published, fixed per corridor. Derived from the RTO meter
                         rate for the distance, cross-checked against what drivers
                         actually charge. NOT dynamic, NOT surge. Fixed.

seat_fare  = ceil( corridor_full_fare / 3 )        rounded UP to the nearest ₹1
driver_pay = corridor_full_fare                    the driver always gets the full trip fare
platform_fee = seat_fare × 0.08                    charged ON TOP, shown separately
guarantee_levy = seat_fare × 0.04                  charged ON TOP, funds §7.3

passenger_pays = seat_fare + platform_fee + guarantee_levy
```

**Worked example — Palava Gate 2 → Dombivli East Station:**

```
corridor_full_fare        ₹150      (your real negotiated rate)
seat_fare                 ₹50       (150 / 3)
platform_fee              ₹4        (8%)
guarantee_levy            ₹2        (4%)
─────────────────────────────────────
passenger pays            ₹56
driver receives           ₹150      (3 × 50) — 100% of the trip fare
platform receives         ₹12       (3 × 4)
guarantee fund receives   ₹6        (3 × 2)
```

Compare: ₹56 vs ₹150 solo. **You save 63%.** The driver earns exactly what he earns today.
Nobody is asked to sacrifice. That is why this can actually get adopted.

> **MVAG 2025 compliance:** the guidelines require the driver to receive **≥80%** of the
> fare when driving their own vehicle. Our structure gives the driver 100% of the ride fare
> and charges the platform's cut to the passenger as a separate, disclosed convenience fee.
> This is compliant and simpler to explain to drivers, which matters enormously for
> onboarding. Do not "improve" this later by taking a cut from the driver side.

### 6.2 Pass pricing

| Plan | Service days | Seat fare | Per-ride total | Discount | Grace Days | Upfront |
|---|---|---|---|---|---|---|
| Daily | 1 | ₹50 | ₹56 | — | — | ₹56 |
| **Weekly** | 6 | ₹48 | ₹53.76 | 4% | **1** | **₹322.56** |
| **Monthly** | 26 | ₹46 | ₹51.52 | 8% | **4** | **₹1,339.52** |

A monthly pass saves ₹116 against paying the daily rate — but the discount is *not* why
people buy it. They buy it for the guaranteed seat. Keep that in mind before anyone
suggests deepening the discount to drive conversion; it won't, and it comes straight out of
a driver's income.

**Who funds the pass discount?** The driver does, and that needs saying plainly rather than
hiding in a spreadsheet. A pass seat pays him ₹46 instead of ₹50. In exchange he gets
income that is guaranteed, prepaid, and pre-scheduled — no empty running, no waiting in a
queue, no negotiating. That is precisely the trade you were making by hand when you offered
that driver a lump sum for the month, and drivers already understand it. It is also why the
discounts are deliberately small: **every point comes out of a ₹600/day income, and a
driver who feels squeezed leaves.** The cap is enforced by a test — pass seats may never
pay the driver more than 10% below spot.

Round-trip passes are two Passes on two corridors (A→B and B→A), bundled in the UI with a
further 3% off, because the return leg is where the other ₹150 was also going.

**No yearly plan.** You were right to be unsure. A year of prepaid rickshaw rides is a
₹15,000 upfront ask from someone who is optimising a ₹150 fare, it's a customer-support
nightmare when someone changes jobs in month 3, and under RBI rules a long mandate invites
disputes. Revisit at 50,000 monthly actives, not before.

**No day pass beyond "Daily".** A day pass and a daily booking are the same thing. Don't
build two words for one concept — it's the kind of thing that makes an app feel confusing
to a 55-year-old user.

### 6.3 Why fares are fixed, not surged

Surge would earn more per ride and destroy the product. The entire value proposition to
your user is *"I no longer negotiate and I no longer get fare-shocked."* The moment the
9am price is ₹78 instead of ₹56, you have become the thing you replaced. Fixed fares are a
feature, and they're also what the state Competent Authority will most want to see.

Fares change by **published revision**, quarterly at most, with 7 days' in-app notice, and
never mid-Pass. A Pass locks its price for its whole duration.

### 6.4 Short-Fill: when the pool doesn't fill

The cold-start killer. Handled explicitly:

```
Seats filled at departure deadline (seat fare ₹50, driver owed ₹150):

3 of 3  →  each pays ₹50.  Fund pays ₹0.  Normal.

2 of 3  →  each pays ₹50 + ₹20 top-up = ₹70
           guarantee fund pays the remaining ₹10 to the driver
           (cap: top-up never exceeds 40% of seat fare)

1 of 3  →  passenger is OFFERED solo at ₹85 (capped at 1.7× seat fare),
           guarantee fund covers ₹65.
           Passenger may decline at no cost, no penalty, no reliability hit.
           Declining is free. Always. This is a promise, not a policy.

0 of 3  →  driver still receives ₹40 standby compensation from the fund
           for holding the slot.
```

The guarantee fund subsidy per corridor is budgeted monthly. When a corridor burns its
budget it drops out of NOW mode and stays in LATER/DAILY only, where fill rates are
predictable. **This is how you avoid the classic marketplace death spiral of subsidising
routes that will never have density.**

---

## 7. The Fairness Engine

> This is the heart of the product and the hardest thing in it. It is specified in full,
> with worked examples and the exact numbers, in **[`01-fairness-engine.md`](./01-fairness-engine.md)**.

The three-sentence version:

1. **Grace Days.** Every Pass includes a fixed budget of no-questions-asked cancellations
   (1/week, 4/month). You never explain why. There is no sick-note, no reason dropdown, no
   judgement — because *any* system that asks for reasons will be defeated by people who
   lie, and will punish the honest ones who don't.
2. **Reseat first.** When you cancel, we try to sell your seat to someone else on the same
   corridor and window. If we reseat it, everyone is whole: you get a full Credit Day, the
   driver gets paid by the replacement, the platform pays nothing.
3. **Guarantee Fund.** When we can't reseat and you used a Grace Day, the 4% levy pays the
   driver. **The driver is paid for every trip that runs, without exception, from someone.**
   His income never depends on your health.

That third point is the answer to the question you kept circling: *"the rickshaw guy's
livelihood depends on this — if one person doesn't come, his ₹120 is gone."* It isn't gone.
It comes from the fund that all riders paid into, which is exactly what insurance is.

---

## 8. Boarding: no shouting OTPs

You were right that calling out a 4-digit code across a station forecourt is bad. Three
mechanisms, in order of preference:

1. **Driver scans passenger's QR.** Rotating code (HMAC-TOTP, 30s window, works fully
   offline — the seed is issued at booking). Driver's phone camera, one scan per passenger.
   This doubles as the attendance punch-in you described.
2. **Plate confirmation.** Before boarding, the app shows the plate in huge type
   (`MH 05 XX 1234`) plus vehicle colour and driver photo. Passenger taps "Plate matches".
   Mismatch → one tap reports it and cancels free.
3. **Spoken PIN** — fallback only, for a dead phone or a broken camera.

**Number-plate OCR** is used on the driver side at shift start and at fuel logging (§9), to
confirm which physical vehicle is being driven. This is the check that makes the
"I'm driving my friend's rickshaw today" case honest instead of a loophole.

---

## 9. Fuel & emissions data programme

Specified in full in **[`04-fuel-data-program.md`](./04-fuel-data-program.md)**.

Drivers optionally log fuel fills (type, quantity, amount, plate photo) and earn ₹15–20 in
**platform credit** (never cash — cash-out is how these programmes get farmed). Detection
is geofence-dwell based: ≥2 minutes inside a mapped fuel station polygon, on-shift, with at
least one completed trip since the last log.

Guardrails, because you asked for them and they matter:

- Max **2 rewarded logs per rolling 7 days**, min 6 hours apart.
- Quantity plausibility bands (CNG 1.5–9.0 kg; petrol 2.0–10.0 L for a 3-wheeler).
- Computed ₹/unit must sit within ±15% of that station's crowdsourced daily median,
  else the log is accepted but held for review and pays nothing until cleared.
- Plate OCR must match the registered vehicle, or the driver declares a substitute
  vehicle — allowed max 3×/month, at half reward.
- One (device + GPS + plate) triple may not appear under two driver accounts.

The output is real: live CNG/petrol price data per station, and a credible per-passenger-km
CO₂e figure. Pooling three people into one rickshaw is a genuine ~66% emissions cut per
passenger-km, and being able to *prove* it with primary data is worth more to a city
transport department — and to your eventual fundraising — than the ₹20 it costs.

---

## 10. Breaking the stand cartel

You named this as the real-world blocker. It is, and it's a product problem, not just a
policy one. Four mechanisms:

1. **Prepaid, fixed, in-app.** There is nothing to negotiate at the kerb. The cartel's
   entire leverage is the roadside negotiation, and we delete it.
2. **Virtual queue.** Drivers hold a FIFO position at a Hotspot from their phone, from
   wherever they're parked. This replaces the physical line — which is what the cartel
   polices — with a digital one it can't stand in front of.
3. **Buy the drivers, don't fight them.** A driver with 8 monthly Pass seats has ₹10k+ of
   guaranteed income before the month starts. That is a better deal than cartel membership,
   and it converts the cartel's own members one at a time. Recruit the *stand leader* first;
   in every Mumbai stand there is one, and if he's earning, the stand follows.
4. **Never ask a passenger to argue.** If a driver refuses a pooled ride at the stand, the
   passenger taps one button, gets rebooked free, and the incident is logged. The passenger
   is never the enforcement mechanism.

Do not launch a corridor until you have ≥6 committed drivers on it. A corridor launched
with 2 drivers hands the cartel an easy win and burns the neighbourhood's goodwill
permanently.

---

## 11. Accessibility: the 55-year-old test

Every screen must pass this: *a 55-year-old with reading glasses, in bright sunlight, on a
₹8,000 Android phone, with one hand, on 3G, who has never used Uber.*

Concretely, enforced in the design system:

- Minimum body text **17sp**, minimum tap target **48×48dp**, no text below 15sp anywhere.
- Contrast ≥ 7:1 for body text (WCAG AAA), ≥ 4.5:1 for everything else.
- **Never colour alone** to convey state — always icon + text too.
- Full Hindi and Marathi from day one, chosen on first launch, changeable in one tap.
  Not machine-translated: get a native speaker to review the 200 strings that matter.
- The primary action on every screen is a single, full-width, high-contrast button.
- Numbers that matter (fare, plate, time) render at 24sp+ minimum.
- Every flow completable with TalkBack/VoiceOver; every icon has a label.
- Works offline for the boarding QR and the day's booked seat. Station basements have no
  signal and that is exactly when you need your ticket.

---

## 12. Regulatory reality — read this before writing a cheque

**This app is an "aggregator" under s.2(1A) of the Motor Vehicles Act, 1988.** Under the
Motor Vehicles Aggregator Guidelines (MVAG) 2025, aggregators need a licence from the state
Competent Authority: **₹5,00,000 for a fresh application**, ₹25,000 renewal, plus driver
police verification, medical and psychological assessment, induction training, and
prescribed insurance.

That is a real number and you should not discover it in month six. Full detail and the
staged path is in **[`09-compliance-india.md`](./09-compliance-india.md)**. The short
version — three legitimate routes, in the order I'd take them:

| Stage | What you run | Money flow | Licence needed |
|---|---|---|---|
| **V0 pilot** (months 1–4) | Matching + attendance + reliability only. No payments in app. | Passenger pays driver directly, cash/UPI P2P. Platform charges ₹0. | **None** — you are not an aggregator if you don't aggregate the transaction. Validate the actual question: *will people pool reliably?* |
| **V1** (months 5–10) | Full product, one city | In-app, escrow, passes | Maharashtra aggregator licence, or operate under a partner |
| **V1-alt** | Same, faster | In-app | Partner with a **licensed aggregator or a registered auto-rickshaw union/co-operative** who holds the permit; you supply software |

**Start with V0.** It costs almost nothing, it's legal, and it answers the only question
that matters. Everything in this repo is built so V0 is a feature flag away from V1 — the
payments layer is isolated behind one interface (`packages/core/src/payments`) precisely so
you can ship without it.

---

## 13. What v1 does not include

Named explicitly so they don't creep in:

- Cabs, bikes, buses, intercity. (The bus-style fixed-route idea in your notes is good —
  it's v3, and it needs a completely different permit.)
- Yearly passes.
- In-app chat. (Masked calling only. Chat is a moderation liability with no upside here.)
- Ratings out of 5. (Reliability badges only.)
- Referral cash. (Credit days only.)
- Any second city until corridor #1 has >60% weekly retention.

---

## 14. The metric that decides everything

**Weekly Committed Retention:** of the passengers who held a Pass in week *N*, how many
hold one in week *N+1*.

Below 50% → the product is not working; do not spend on growth.
50–65% → fixable; find the churn reason and fix it.
Above 65% → this is a real business; raise money and expand corridors.

Every other number (downloads, GMV, MAU) is a distraction at this stage.

---

## Document map

| Doc | Contents |
|---|---|
| [`01-fairness-engine.md`](./01-fairness-engine.md) | Cancellations, Grace Days, Credits, Guarantee Fund — with worked examples |
| [`02-matching-and-pools.md`](./02-matching-and-pools.md) | Pool state machine, match scoring, reseat market |
| [`03-pricing.md`](./03-pricing.md) | Fare tables, Pass maths, Short-Fill economics |
| [`04-fuel-data-program.md`](./04-fuel-data-program.md) | Fuel logging, anti-abuse guardrails, emissions model |
| [`05-safety-and-trust.md`](./05-safety-and-trust.md) | Boarding, SOS, verification, incident handling |
| [`06-brand-and-design-system.md`](./06-brand-and-design-system.md) | Kaali-peeli identity, tokens, the regional icon system |
| [`07-tech-architecture.md`](./07-tech-architecture.md) | Stack choices and why, data model, scaling path |
| [`08-launch-playbook.md`](./08-launch-playbook.md) | **Step-by-step, zero-coding-knowledge path to both app stores** |
| [`09-compliance-india.md`](./09-compliance-india.md) | MVAG 2025, RBI e-mandate, DPDP Act, insurance |
| [`10-roadmap-and-costs.md`](./10-roadmap-and-costs.md) | 12-month plan, real rupee costs, hiring |
