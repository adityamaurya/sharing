# Safety and Trust

Three strangers share a small vehicle daily. Everything here follows from that.

---

## 1. Boarding without shouting a code

You were right that calling a four-digit code across a station forecourt is bad.
It is also how the wrong person gets into the rickshaw. Three mechanisms, in
order of preference:

1. **Driver scans the passenger's QR.** Rotating HMAC-TOTP over a seed issued at
   booking, 30-second window. Works **fully offline** — station basements have no
   signal, and that is exactly when you need your ticket. Doubles as the
   attendance punch-in.
2. **Plate confirmation.** Before boarding, the plate is the largest thing on the
   screen (34sp, on a yellow plate-shaped badge), with the driver's name and
   photo. One tap confirms, one tap reports a mismatch and cancels free.
3. **Spoken PIN** — fallback only, for a dead camera.

Getting into the wrong vehicle is the failure we most want to prevent, which is
why `PlateBadge` is a dedicated component with its own type scale rather than
just another line of text.

## 2. Verification

**Drivers** cannot be matched at all until `driver_is_eligible()` passes:
police verification, medical, psychological assessment, induction training, a
current licence, and current insurance. All five are MVAG 2025 requirements and
all are enforced in SQL rather than in a checklist somebody might skip.

**Passengers** verify a phone number. Full KYC on a ₹56 ride would kill adoption
for no real safety gain — the accountability that matters here is that everyone
in the pool has a persistent identity and a reliability record.

## 3. What co-riders can see about each other

**First name and a reliability badge. Nothing else.**

Not surnames, not phone numbers, not exact reliability scores, not home pickup
points. The `pool_co_riders` view is the only path to co-rider data and it
returns exactly those two fields.

This matters more than it looks. **A pooling app that leaks where a woman is
picked up at 9:15 every morning is a safety incident waiting to happen**, and it
would leak from precisely that view. It is commented in the schema so nobody
widens it casually.

## 4. In-trip

- **Share trip** — a live link to chosen contacts. Automatic for women-only pools.
- **Silent SOS** — long-press, no sound, no on-screen change. Sends location,
  plate, driver ID and co-rider list to emergency contacts and to the operations
  desk.
- **Masked calling** — driver and passenger can call through a relay number. No
  chat. Chat is a moderation liability with no upside on a 22-minute ride.
- **Route deviation** — a significant departure from the expected corridor pings
  the passenger: *"Still on your way?"* One tap says yes; no tap escalates.

## 5. Reliability, not star ratings

Reliability is 0–100 internally, shown only as **New / Silver / Gold**.

Star ratings out of five are a bad fit here. They compress into "5 or complaint",
they punish drivers for traffic, and in a repeated-daily-interaction market they
create social pressure between neighbours. What actually matters for pooling is
one thing: **did you turn up when you said you would.** So that is the only thing
measured.

Raw scores are never shown, because a visible number invites gaming and, when it
drops, shames somebody in front of the neighbours they ride with.

## 6. The stand cartel

The real-world blocker you named. Four mechanisms, none of which put the
passenger in the argument:

1. **Prepaid, fixed, in-app.** There is nothing to negotiate at the kerb. The
   cartel's entire leverage is the roadside negotiation and we delete it.
2. **Virtual queue.** Drivers hold a FIFO position from their phone, from
   wherever they're parked. This replaces the physical line — which is what the
   cartel polices — with a digital one it can't stand in front of.
3. **Buy the drivers.** A driver with eight monthly pass seats has ₹10,000+ of
   guaranteed income before the month starts. Recruit the **stand leader** first;
   in every Mumbai stand there is one, and if he earns, the stand follows.
4. **Never make the passenger the enforcer.** If a driver refuses a pooled ride,
   the passenger taps one button, is rebooked free, and the incident is logged.
   They never have to argue with anybody.

The union partnership route in [`09-compliance-india.md`](./09-compliance-india.md)
is also a safety strategy, not only a legal one — a union that has endorsed you
is not a union that blocks you.

## 7. Incidents

| Severity | Response |
|---|---|
| Wrong vehicle / driver refuses pooling | Free rebook, logged, driver contacted same day |
| No-show (either side) | Auto-detected from GPS, auto-compensated, no complaint needed |
| Harassment report | Immediate suspension of the accused pending review; the reporter is never matched with them again, permanently and silently |
| Accident | Ops desk alerted, emergency contacts notified, insurance claim opened |

**The reporter is never asked to justify themselves, and never matched with that
person again — even if the report is unproven.** The cost of a wrong permanent
unmatch is one slightly smaller candidate pool. The cost of getting this wrong in
the other direction does not have a rupee value.
