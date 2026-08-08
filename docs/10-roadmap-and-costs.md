# Roadmap and Costs

Real rupees, not a slide. All figures August 2026.

---

## 1. Twelve months

| Phase | Weeks | Goal | Done when |
|---|---|---|---|
| **0 · Paper pilot** | 1–3 | Prove people actually pool | 14 days of notebook data, >50% week-2 retention |
| **1 · One corridor** | 4–12 | App live, Palava ↔ Dombivli | 30 daily riders, 6+ committed drivers |
| **2 · Prove the pass** | 13–24 | Commitment works | 40% of riders on a weekly or monthly pass; >65% weekly retention |
| **3 · One node** | 25–36 | All corridors from Dombivli East | 5 corridors, 300 rides/day, fund near break-even |
| **4 · Second node** | 37–52 | The model transfers | Kalyan or Thane live, reseat rate >70% |

The gate between every phase is **weekly committed retention**. Below 50%, stop
and fix. Above 65%, expand. Downloads, GMV and MAU are distractions at this stage.

## 2. What it costs to get live

| Item | One-off | Monthly |
|---|---|---|
| Private Limited registration | ₹12,000 | — |
| Trademark, Class 39 (composite mark) | ₹4,500 | — |
| Google Play developer | ₹2,100 | — |
| Apple Developer Program | — | ₹700 |
| Expo EAS Production | — | ₹1,600 |
| Supabase Pro | — | ₹2,100 |
| Razorpay | — | 2% of volume |
| Domain + email | ₹1,500 | ₹200 |
| Legal review (terms, privacy, DPDP) | ₹25,000 | — |
| **Total to be live** | **₹45,100** | **₹4,600 + 2%** |

You can genuinely reach a live app for **under ₹50,000**. That is the good news
and it is unusual.

## 3. Running one corridor

At 30 riders/day, ₹56 average, 26 days:

```
Monthly gross bookings          ₹43,680
Platform fee (8% of seat fare)   ₹3,120
Guarantee levy (4%)              ₹1,560
─────────────────────────────────────────
Platform revenue                 ₹4,680

Guarantee fund payouts          −₹2,340   (cold-start assumptions)
Infrastructure                  −₹4,600
─────────────────────────────────────────
Monthly net                     −₹2,260
```

**One corridor loses about ₹2,300/month.** That is the cost of the experiment,
and it is small enough to self-fund while you learn.

Break-even is around **five corridors at 30 riders each**, because infrastructure
is fixed and the guarantee fund improves with density.

## 4. Then the real number arrives

| Item | Cost |
|---|---|
| **Aggregator licence (Maharashtra)** | **₹5,00,000** |
| Compliance setup, legal | ₹2–4,00,000 |
| Driver verification (police, medical, psych) — ₹2,500 × 50 | ₹1,25,000 |
| Passenger accident cover | ₹25/driver/month |

This is why [`09-compliance-india.md`](./09-compliance-india.md) recommends
starting at V0 and considering the union-partnership route. **Do not spend ₹5
lakh to discover that afternoon pools don't fill.**

## 5. When to hire, and who

Do not hire until phase 2. Then, in this order:

1. **Operations lead (Dombivli).** The single highest-leverage hire. Recruits
   drivers, handles stand politics, is physically present at 8am. This person
   decides whether you have a company. Pay well — ₹35–45k.
2. **React Native developer**, part-time or contract. Only once you know what to
   build. ₹60–90k/month full-time.
3. **Support**, one person, Hindi and Marathi. From ~500 rides/day.

You do not need a CTO to run one corridor. You need somebody who knows the
drivers at Dombivli East station by name.

## 6. Unit economics at scale

At 5,000 rides/day, mature (75% reseat, 5% short-fill):

```
Daily gross                    ₹2,80,000
Platform fee                     ₹20,000
Guarantee levy                   ₹10,000
Fund payouts                     −₹7,000
─────────────────────────────────────────
Daily contribution               ₹23,000
Monthly contribution           ₹6,90,000
Ops + eng + support           −₹4,50,000
─────────────────────────────────────────
Monthly profit                 ₹2,40,000
```

Thin margins on a small fare — which is exactly why the guarantee fund's reseat
rate matters so much. **Every point of reseat rate is worth more than any pricing
change you could make.**

## 7. What could kill this

| Risk | Severity | What reduces it |
|---|---|---|
| Stand cartels block drivers | **High** | Union partnership; recruit the stand leader first |
| Pools don't fill at off-peak | **High** | Launch peak-only; shed weak corridors automatically (already in code) |
| ₹5 lakh licence before revenue | **High** | V0 first; partner route |
| Ola/Uber/Rapido copy it | Medium | They optimise for utilisation, not commitment. Passes and the guarantee fund are structurally awkward for them — but not impossible |
| Drivers churn to full-fare rides | Medium | Guaranteed prepaid income beats a gamble. Watch it monthly |
| Regulatory change | Medium | Stay close to the transport department. Be the compliant one |
| Founder burnout | **High** | One corridor. One city. Hire the ops lead before you break |

That last row is not filler. You said this project is dear to you and that you
don't want it to leave you burning. **The design that protects you is scope:**
one corridor, one city, one metric. Everything in this repository is built so
that you can stop at any phase boundary with something that works, rather than
having to finish everything before anything is useful.

## 8. The only dashboard you need

Check weekly. Four numbers.

| Metric | Target | Where from |
|---|---|---|
| **Weekly committed retention** | > 65% | passes active week N and N+1 |
| **Fill rate** | > 80% | seats sold ÷ seats offered |
| **Reseat rate** | > 70% | `cancellations.reseated` |
| **Fund days of cover** | > 28 | `reserveStatus()` |

If those four are healthy the business is healthy. If retention is falling,
nothing else matters.
