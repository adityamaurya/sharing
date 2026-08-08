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

## 2. Detection

Nobody fills in a form voluntarily. The prompt is triggered:

```
driver dwelt ≥ 120s inside a mapped fuel-station geofence
  AND is on shift
  AND has completed ≥ 1 trip since the last log
→ prompt: "What did you fill?"
```

Foreground location only, during an active shift. `ACCESS_BACKGROUND_LOCATION` is
in `blockedPermissions` in `app.json` — we do not follow drivers around when the
app is closed, and it would be a DPDP problem as well as a trust problem.

## 3. Guardrails

Each one closes a specific way to turn this into an income stream.

| Guardrail | Value | Closes |
|---|---|---|
| Rewarded logs per rolling 7 days | **2** | Grinding the reward all day |
| Minimum gap between rewards | 6 h | Logging one fill twice |
| Dwell before prompting | 120 s | Idling at a pump without buying |
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

## 4. Accept the data, gate the reward

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

## 5. Emissions

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

## 6. Why it's worth ₹20

- **For drivers:** live prices across every station in the area. Knowing where
  gas is ₹2/kg cheaper today is worth more than the reward itself.
- **For passengers:** a real, defensible number for what sharing saves.
- **For you:** primary fuel-price and emissions data for a whole city, collected
  at ₹20 a data point. That is the cheapest transport dataset in India, and it is
  worth considerably more to a transport department or an investor than it costs
  to gather.
