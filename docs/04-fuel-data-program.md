# Fuel Data Programme

Implementation: [`packages/core/src/fuel/`](../packages/core/src/fuel/)

---

## 1. What it is

Drivers log what they fill — type, quantity, amount, plate photo — and earn **₹20
in platform credit**. The output is live per-station fuel prices and a credible
per-passenger-km CO₂e figure built from primary data rather than a spreadsheet
assumption.

**The reward is credit against platform fees, never cash.** Cash-out is how these
programmes get farmed. Credit is worth real money to a working driver and nothing
at all to somebody running twelve burner accounts.

## 2. How long is a CNG queue, actually?

The campaign's timing is set by this, so it is worth stating with sources.

| Condition | Reported wait | Source |
|---|---|---|
| Normal day, Mumbai | **15–30 min** | [The Federal](https://thefederal.com/category/states/west/maharashtra/cng-crisis-mumbai-queues-fare-surge-chaos-216690) |
| Normal day, Kolkata (union figure) | 10–15 min | [Bengal Info](https://bengalinfo.com/newsdetail.php?newsid=468677) |
| Supply squeeze, Mumbai | 2–4 hours | [The Week](https://www.theweek.in/news/biz-tech/2025/11/18/mumbai-cng-shortage-update.html), [Outlook](https://www.outlookindia.com/national/mumbais-lifeline-stalls-how-a-cng-breakdown-brought-the-citys-auto-rickshaws-to-a-halt) |
| Supply squeeze, Chennai / Kolkata | ~2 hr / 4 hr | [Morung Express](https://morungexpress.com/lpg-cng-shortage-hits-chennai-auto-rickshaws-long-queues-at-fuel-stations), [Bengal Info](https://bengalinfo.com/newsdetail.php?newsid=468677) |
| Sustained shortage, Udupi | 4–5 hr daily | [Deccan Herald](https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Fudupi-cng-fuel-shortage-long-queues-of-vehicles-has-become-a-common-sight-3000195) |
| Quietest hours (Delhi) | 11am–4pm and late evening | [CNGWALA](https://www.cngwala.com/city/delhi) |

Two caveats on this evidence, because it should not be over-read. All of it is
press reporting and union quotes, not a measured study — we found no formal survey
of average daily queue time for Indian auto-rickshaws. And crisis coverage is
inherently over-represented: a normal Tuesday at a CNG pump is not news. Treat
**15–30 minutes as the planning figure** and the multi-hour numbers as the tail
risk, then replace both with our own data, which the programme generates by month
two.

### What that implies for the product

The reported norm is longer than the time a driver needs to answer two questions.
That single fact restructures the campaign:

1. **Five minutes inside the fence means the driver is still in the queue.** They
   have not filled anything, so "how much did you fill?" is unanswerable. Asking
   then trains people to dismiss the prompt.
2. **A driver in a queue is the most attentive they will ever be** — stationary,
   engine off, phone already in hand, 15 minutes to kill. There is no better
   moment to reach them, and it is a moment no other app is using.
3. **Queue length is the thing they want to know**, and other drivers' dwell times
   already tell us. That makes the exchange a trade rather than a survey.

## 3. Detection

Nobody fills in a form voluntarily. So the prompt splits in two — arm in the
queue, ask on the way out:

```
STAGE 1 — ARM  (dwell ≥ 300s, speed ≤ 8 km/h, on shift)
  → "You have been at Dombivli MIDC 12 minutes.
     Others here are taking about 24 min.
     ₹20 is being held for you."
  No question asked yet. Shows the live queue estimate.

STAGE 2 — ASK  (exited the fence, dwell > 90s, within 45 min of exit)
  → "Did you fill gas?"  Two fields. ~25 seconds.

PASS-THROUGH  (dwell ≤ 90s, or speed > 8 km/h inside the fence)
  → nothing at all.
```

The speed test is checked before the dwell test. Crawling through a congested
forecourt can otherwise accumulate five minutes without the driver ever joining a
queue, and a reward prompt for a fill that never happened is worse than no prompt.

Geofence radius is **140 m**, chosen from the queue rather than the forecourt: at
Dombivli MIDC the morning line spills over a hundred metres down the service road,
and a tight 50 m fence around the pump island would miss the entire wait — the
part we most want to measure.

`GEOFENCE_DWELL_SECONDS` stays at 120 as the *reward* floor while the *ask*
triggers at 300. These are deliberately different: we ask when somebody has
plainly queued, but we still pay a driver who genuinely filled in three minutes at
an empty pump at 2pm.

## 4. Making ₹20 worth answering

₹20 is not much money. What makes it worth 25 seconds:

| Lever | Implementation |
|---|---|
| Say what it buys, in their units | "Covers the app fee on your next 5 rides" — not "₹20 credit" |
| State the cost up front | "Two questions. About 25 seconds." |
| Give something back first | Live queue estimate, above the form, before any input |
| Reward consistency | 4 consecutive logs → **+₹10**, capped |
| Money before form | The figure is at display size at the top of the screen |

What is deliberately absent, and should stay absent:

- No countdown timer on the offer.
- No "3 drivers near you claimed theirs".
- No streak that *resets* punitively — the bonus is additive, so a driver who
  takes Sunday off has simply not earned it yet rather than having lost it.

Loss-framing converts better in the short run. It also breeds precisely the
resentment you cannot afford among drivers who spend every morning talking to each
other in a queue.

## 5. Queue estimation

The by-product that makes the programme worth more than its data:

- Median, not mean, of completed dwells at that station in the last two hours. One
  driver who parked for lunch would otherwise add twenty minutes to the estimate.
- Dwells under 90 s are excluded as pass-throughs.
- **Under three drivers we say we do not know.** A confident wrong number sends
  somebody four kilometres to a longer queue, and they remember that.

## 6. Privacy

Foreground location only, during an active shift. `ACCESS_BACKGROUND_LOCATION` is
in `blockedPermissions` in `app.json` — we do not follow drivers around when the
app is closed, and it would be a DPDP problem as well as a trust problem.

## 7. Guardrails

Each one closes a specific way to turn this into an income stream.

| Guardrail | Value | Closes |
|---|---|---|
| Rewarded logs per rolling 7 days | **2** | Grinding the reward all day |
| Minimum gap between rewards | 6 h | Logging one fill twice |
| Dwell before a reward is possible | 120 s | Idling at a pump without buying |
| Trips since last log | ≥ 1 | A parked rickshaw farming logs |
| CNG quantity band | 1.5–9.0 kg | Invented quantities |
| Petrol quantity band | 2.0–10.0 L | Invented quantities |
| Unit price vs station daily median | ±15% | Inflated amounts |
| Plate OCR must match registered plate | Levenshtein ≤ 1 | One rickshaw, several accounts |
| Substitute-vehicle declarations | 3/month, half reward | The friend's-rickshaw loophole |
| Same device + plate on two accounts | Blocked and flagged | Account farming |

**Plate OCR forgives one character.** A dusty plate at a petrol pump is our
camera's problem, not the driver's, and punishing him for it teaches him to stop
logging.

## 8. Accept the data, gate the reward

A log that fails a check is **still stored**. It may be perfectly honest, the
data is still useful, and rejecting it outright teaches drivers that logging is
a waste of time — which is the one outcome that makes the programme worthless.

Three outcomes:

- **Rewarded** — everything checks out, ₹20 credited immediately.
- **Held for review** — price is an outlier for that station that day. Accepted,
  reward pending, and the message says *"this looks different from others at this
  pump today"* rather than accusing anybody.
- **Unrewarded** — a guardrail tripped. Stored, and the driver is told plainly
  why, with the fix where there is one.

The first driver at a station with no price history is never penalised for being
first: with no median to compare against, the check is skipped.

## 9. Emissions

```
kg CO₂e = quantity × factor        CNG 2.75/kg · petrol 2.31/L · electric 0 (tank-to-wheel)
per-passenger = total / passengers
saving = (1 − 1/passengers) × 100  →  66.7% for a full rickshaw
```

Electric is reported **tank-to-wheel zero**, with grid emissions stated as a
separate and honest conversation. Overclaiming here would be easy and would
poison the one asset this programme is meant to produce: data a city transport
department will actually believe.

Savings are phrased in something a person can picture — *"63 kg of CO₂ saved,
about 3 tree-years of work"* — because grams of CO₂ mean nothing to anybody.

## 10. Why it's worth ₹20

- **For drivers:** live prices across every station in the area. Knowing where
  gas is ₹2/kg cheaper today is worth more than the reward itself.
- **For passengers:** a real, defensible number for what sharing saves.
- **For you:** primary fuel-price and emissions data for a whole city, collected
  at ₹20 a data point. That is the cheapest transport dataset in India, and it is
  worth considerably more to a transport department or an investor than it costs
  to gather.
