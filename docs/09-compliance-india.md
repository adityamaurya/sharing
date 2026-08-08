# India Compliance

> Read this before you spend money. One number in here (₹5,00,000) has killed
> more Indian mobility startups than any competitor.

Not legal advice. Get a transport lawyer before you take your first rupee in-app.

---

## 1. You are an "aggregator", and that has a price

Under **§2(1A) of the Motor Vehicles Act, 1988**, an aggregator is *"a digital
intermediary or marketplace for a passenger to connect with a driver for the
purpose of transportation."* That is exactly what Sharing does.

The **Motor Vehicles Aggregator Guidelines (MVAG) 2025**, notified by MoRTH,
therefore apply:

| Requirement | Detail |
|---|---|
| **State licence** | **₹5,00,000** fresh application, ₹25,000 renewal, from the state Competent Authority |
| **Driver share** | Minimum **80%** of the fare when the driver owns the vehicle (60% if you own it) |
| **Driver vetting** | Police verification, medical test, **psychological assessment** before onboarding |
| **Training** | Induction training plus an annual refresher |
| **Pooling** | Permitted, but **pre-booked through the app only**, with fare transparency, and **never exceeding seat capacity** |
| **Women's safety** | Women-only pooling options contemplated and encouraged |
| **Data** | Must be stored in India; specified retention periods |

Maharashtra has its own **draft Aggregator Rules 2025** layered on top. Check
their current status with the Maharashtra Transport Department before you rely
on anything here — draft rules move.

### Where Sharing already complies by design

- **Seat cap** — three passengers, enforced by a database constraint, not a
  policy document (`supabase/migrations/…_initial_schema.sql`).
- **Driver share** — the driver receives 100% of the ride fare; the platform's
  cut is charged to the passenger as a separate, disclosed fee. Above the 80%
  floor, and asserted by a test in `pricing.test.ts`.
- **Pre-booked only** — there is no street-hail flow in the product.
- **Fare transparency** — fixed published fares, itemised before booking, no surge.
- **Driver vetting** — `driver_is_eligible()` refuses to match any driver
  missing a police, medical, psych or induction record, or with an expired
  licence or insurance.
- **Women-only pools** — a first-class flag on passes and requests.

---

## 2. The staged path — start where you can afford to

**Do not begin at V1.** These three stages are ordered by cost and by what each
one actually teaches you.

### V0 — Matching only (months 1–4). No licence needed.

The app does **matching, scheduling, attendance and reliability**. It handles no
money at all: the passenger pays the driver directly in cash or a person-to-person
UPI transfer, and the platform charges nothing.

**Why this is not aggregation in the sense that triggers licensing:** you are
not intermediating the transaction, taking a commission, or setting a fare that
you collect. You are a noticeboard. Several Indian carpool products have operated
in this space for years.

**But be careful about two things**, and this is where people get it wrong:

1. **Take no commission, in any form.** No convenience fee, no "tip", no
   subscription that is really a fare. The moment money flows through you, you
   are an aggregator.
2. **Don't set the price as a term of service.** Publish a *suggested* fair
   split. Let the parties agree it.

This is where the app's payments feature flag matters. Everything money-related
sits behind one interface, so V0 is a config change and not a rewrite.

**What V0 buys you:** the answer to the only question that matters — will people
pool reliably? — for the cost of a Play Store account.

### V1-alt — Operate under someone else's licence (months 5–10)

Partner with an entity that already holds an aggregator permit, or with a
**registered auto-rickshaw union or co-operative society**. Mumbai has several
with thousands of members. You supply the software and take a software fee from
the licensed partner; they hold the permit and the driver relationship.

**This is the fastest legitimate route to real transactions**, and the union
route has a second benefit that is worth more than the licence: **it solves the
stand-cartel problem politically instead of by confrontation.** A union that has
endorsed you is not a union that blocks you.

### V1 — Your own licence (month 10+)

Apply to the Maharashtra Competent Authority. Budget **₹5,00,000** for the
licence plus roughly ₹2–4 lakh for legal and compliance setup. Only do this once
V0 has proven retention above 65% — the licence is not the hard part, product-market
fit is.

---

## 3. Payments — RBI e-mandate rules

For weekly and monthly passes on UPI AutoPay, under the RBI e-mandate framework:

| Rule | What it means for you |
|---|---|
| **₹15,000 cap** per auto-debit without re-authentication | Never a problem — a monthly pass is about ₹1,340 |
| **One-time AFA** to set the mandate up | The user approves once with their UPI PIN |
| **24-hour pre-debit notification**, mandatory | Must state merchant, amount, date, mandate reference and reason. Your PSP (Razorpay) sends it, but **you are responsible for it happening** |
| **User can pause or cancel any time** | Must be doable from inside your app, not only from their bank app |
| **Banks may not charge extra** for e-mandate | — |
| **Post-debit notification** required | Send your own too; it costs nothing and prevents disputes |

**Design consequences already built into the product:**

- Pass renewal is debited **24+ hours after** the pre-debit notice, never sooner.
- "Pause pass" is a first-class action in the app, not buried in settings.
- A failed mandate must never strand a rider mid-week: the pass stays active
  until the cycle ends, and you chase payment separately. Cutting off someone's
  commute over a bank glitch is how you lose a neighbourhood.

Use **Razorpay Subscriptions** (or PayU/Cashfree) for UPI AutoPay. Do not build
mandate handling yourself.

---

## 4. DPDP Act, 2023

The Digital Personal Data Protection Act applies fully. This app handles
location, which makes it sensitive in practice even where the Act doesn't grade
it that way.

**Obligations:**

- **Notice and consent** in clear language, per purpose, before collection.
- **Purpose limitation** — location for matching and pickup only. Not for ads,
  not for "analytics", not sold.
- **Erasure on request**, and deletion when the purpose ends.
- **Breach notification** to the Data Protection Board and to affected users.
- **Consent Manager** registration may apply as you grow.
- Children under 18 need verifiable parental consent — a real issue for the
  student flow. **Set the minimum age at 18 in V1** and revisit properly later.

**What the product already does about it:**

- Background location is in `blockedPermissions` — we never track a driver or
  passenger when the app is closed. The fuel geofence works on foreground
  location during an active shift only.
- `pool_co_riders` exposes a first name and a badge, and nothing else. Never a
  surname, phone number, exact reliability score, or home pickup point. **A
  pooling app that leaks where a woman is picked up every morning is a safety
  incident waiting to happen**, and that view is where it would leak from.
- Data resides in the Mumbai (ap-south-1) region.
- The cancellations table has **no reason column** — we never ask why somebody
  missed a ride, so there is no health information to protect in the first place.
  The cheapest way to secure data is not to hold it.

---

## 5. Insurance and other duties

| Item | Requirement |
|---|---|
| Vehicle insurance | Valid third-party cover is the driver's legal duty; verify and store the expiry — the schema has the column |
| Passenger cover | MVAG expects aggregators to arrange cover. Group personal-accident cover runs roughly ₹15–40 per driver per month |
| GST | Register once turnover crosses ₹20 lakh. Passenger transport by autorickshaw through an ECO has specific treatment — get a CA to structure this |
| TDS | §194-O applies to e-commerce operators paying participants. 1% on gross driver payouts |
| Grievance officer | Named, with contact details published in-app and on your site |
| Accessibility | Reasonable accommodation obligations under the RPwD Act 2016 |

---

## 6. The one-page checklist

**Before the pilot (V0):**
- [ ] No money flows through the platform
- [ ] Privacy policy and terms published
- [ ] Consent notice at first launch, per purpose
- [ ] Age gate at 18
- [ ] Grievance contact published

**Before taking money (V1):**
- [ ] Company registered, current account, GST if applicable
- [ ] Aggregator licence obtained **or** a licensed partner agreement signed
- [ ] Every driver: police verification, medical, psych, induction on file
- [ ] Insurance verified for every vehicle, expiry tracked
- [ ] Razorpay live, UPI AutoPay mandates with 24h pre-debit notices working
- [ ] Passenger accident cover in place
- [ ] Grievance officer named and reachable
- [ ] DPDP consent, erasure and breach-notification processes actually tested

---

## Sources

- [Motor Vehicles Aggregator Guidelines 2025 (MoRTH)](https://morth.nic.in/sites/default/files/circulars_document/MV-Aggregators-Guidelines-2025%20-%20English%20and%20Hindi.pdf)
- [MVAG 2025 — key highlights](https://authbridge.com/blog/motor-vehicles-aggregator-guidelines-2025-key-highlights/)
- [Maharashtra draft Aggregator Rules 2025](https://www.newsonair.gov.in/maharashtra-drafts-motor-vehicle-aggregator-rules-2025-for-app-based-taxi-services)
- [RBI e-mandate framework 2026 — compliance checklist](https://amlegals.com/upi-autopay-and-recurring-payments-compliance-checklist-under-rbis-e-mandate-framework-2026/)
- [RBI auto-debit rules explained](https://www.businesstoday.in/amp/personal-finance/news/story/rbi-auto-debit-rules-explained-what-new-changes-mean-for-your-upi-and-card-payments-528507-2026-05-02)
