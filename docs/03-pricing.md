# Pricing

Implementation: [`packages/core/src/pricing/`](../packages/core/src/pricing/) ·
Tests: [`pricing.test.ts`](../packages/core/src/pricing/__tests__/pricing.test.ts)

---

## 1. The formula

```
seat_fare       = ceil(corridor_full_fare / 3)     rounded UP to a whole rupee
platform_fee    = seat_fare × 8%                   charged on top, shown separately
guarantee_levy  = seat_fare × 4%                   charged on top, funds driver make-whole
passenger_pays  = seat_fare + platform_fee + guarantee_levy
driver_receives = sum of the seat fares sold on the trip
```

Rounding is always **up** to the whole rupee on the seat share. ₹100 ÷ 3 becomes
₹34, not ₹33.33, so three seats collect ₹102 and the driver gains two rupees
rather than losing one. Rounding should never cost the person with the thinnest
margin.

Money is integer **paise** everywhere in the code. A ten-paise float error per
ride is ₹70 a year out of a driver's pocket.

## 2. Palava Gate 2 → Dombivli East, in full

| Line | Amount |
|---|---|
| Corridor full fare | ₹150 |
| Seat fare (÷3) | **₹50** |
| Platform fee (8%) | ₹4 |
| Guarantee levy (4%) | ₹2 |
| **Passenger pays** | **₹56** |
| Driver receives | **₹150** |
| Platform receives | ₹12 |
| Fund receives | ₹6 |

Passenger saves 63%. Driver earns exactly what he earns today. Nobody is asked
to sacrifice, which is why this can be adopted rather than argued for.

## 3. Passes

| Plan | Days | Seat fare | Per ride | Upfront | Grace | Saving |
|---|---|---|---|---|---|---|
| Daily | 1 | ₹50 | ₹56 | ₹56 | — | — |
| Weekly | 6 | ₹48 | ₹53.76 | ₹322.56 | 1 | ₹13.44 |
| Monthly | 26 | ₹46 | ₹51.52 | ₹1,339.52 | 4 | ₹116.48 |

Round trip bundles both legs at a further 3% off.

**Who funds the discount: the driver.** A pass seat pays ₹46 instead of ₹50. In
exchange he gets income that is guaranteed, prepaid and pre-scheduled — no empty
running, no queueing, no negotiating. That is the trade you were making by hand
when you offered a driver a lump sum for the month, and drivers understand it
immediately.

It is capped at **10%** by a test. Every point comes out of a ₹600/day income,
and a driver who feels squeezed leaves. Nobody should be allowed to "improve
conversion" by deepening this later.

**The driver pitch, as one number:** three monthly pass holders on one daily slot
is **₹3,588 guaranteed** before the month starts. Four slots is over ₹14,000.

## 4. No surge, ever

Surge would earn more per ride and destroy the product. The entire promise is
*"I no longer negotiate and I no longer get fare-shocked."* The moment the 9am
price is ₹78 instead of ₹56, you have become the thing you replaced.

Fares change by published revision, quarterly at most, with 7 days' in-app
notice, and **never mid-pass**. A pass locks its fare for its whole duration —
that's a database column, not a policy.

## 5. Short-fill

| Seats | Each pays | Fund pays | Driver gets |
|---|---|---|---|
| 3 | ₹50 | ₹0 | ₹150 |
| 2 | ₹70 (₹50 + ₹20 cap) | ₹10 | ₹150 |
| 1 | ₹85 (1.7× cap) | ₹65 | ₹150 |
| 0 | — | ₹40 | ₹40 standby |

**Declining is always free.** No charge, no penalty, no reliability hit, at every
fill level — asserted in a test. If a user is ever penalised for our failure to
build enough supply, the product is lying about whose fault it is.

## 6. What a corridor needs before it opens

- ≥ 6 committed drivers (`POLICY.corridor.MIN_DRIVERS_TO_LAUNCH`)
- A fare cross-checked against the RTO meter rate *and* what drivers actually charge
- A projected fill rate above 60% at the intended time slots

A corridor launched with two drivers hands the stand cartel an easy win and burns
that neighbourhood's goodwill permanently. There is no second first impression at
a rickshaw stand.
