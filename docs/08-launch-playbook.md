# Launch Playbook

> Written for someone who has never shipped an app. No step assumes you can code.
> Where you must type something, the exact command is given. Where you must click
> something, the exact screen is named.

**Read §0 first.** It will save you months.

---

## 0. Do this before you spend a single rupee on software

You already have the app. What you do not yet have is proof that people will
actually pool. Those are very different problems, and the second one is the one
that kills companies.

### The two-week paper pilot

**Cost: ₹0. Tools: one WhatsApp group and a notebook.**

1. Pick **one corridor only** — Palava Casa Bella Gate 2 → Dombivli East Station,
   09:00–09:30. The one you actually commute.
2. Make a WhatsApp group. Get **12 neighbours** into it who leave at roughly that
   time. Your building's society group is the recruiting ground.
3. Find **2 drivers** who will commit to 09:15 daily. Offer the real deal:
   ₹150/trip guaranteed, paid by you upfront weekly, whether or not three people
   show up. Yes, you personally absorb the gap. It will cost you a few thousand
   rupees and it is the cheapest research you will ever buy.
4. Every morning, post: *"9:15 rickshaw — who's in?"* Match people by hand.
   Collect ₹50 each by UPI.
5. In your notebook, write down every single day:
   - How many people said yes the night before
   - How many actually turned up
   - How many pools filled all three seats
   - Every time somebody cancelled, and how much notice they gave
   - Every time a driver didn't come
   - What the stand guys said or did about it

**After 14 days, look at your notebook and answer one question:**

> Of the people who rode in week 1, how many rode again in week 2?

- **Below 50%** — the product does not work yet. Do not build. Find out why
  people stopped. It is usually timing, not price.
- **50–65%** — promising. Run two more weeks and fix the top complaint first.
- **Above 65%** — you have something real. Proceed to §1 and build.

You will also learn the three things no amount of code can tell you: what the
real fill rate is, what the real cancellation rate is, and whether the stand
tolerates you. Those three numbers determine whether the Guarantee Fund in
`01-fairness-engine.md` is solvent or a money pit.

> **The V0 version of the app in this repo is built for exactly this.** Payments
> are behind a feature flag. You can run the pilot with the app doing matching
> and attendance only, cash between rider and driver, and you are not an
> "aggregator" under the Motor Vehicles Act — so there is no ₹5 lakh licence in
> your way. See [`09-compliance-india.md`](./09-compliance-india.md).

---

## 1. Accounts you need, with real prices

Set these up in this order. Prices are as of August 2026.

| # | What | Cost | Time | Notes |
|---|---|---|---|---|
| 1 | **Google Play Developer** | **$25 once** (~₹2,100) | 1–3 days to verify | Register as an **Organisation**, not an individual — see the warning below |
| 2 | **Apple Developer Program** | **$99/year** (~₹8,300) | 1–14 days | Organisation enrolment needs a **D-U-N-S number** (free, ~2 weeks) |
| 3 | **Expo (EAS)** | Free to start; **$19/mo** Production | 5 min | Free tier builds are queued and slow; pay once you're iterating daily |
| 4 | **Supabase** | Free tier; **$25/mo** Pro | 5 min | Free tier is genuinely enough for the pilot |
| 5 | **Razorpay** | 2% per transaction | 2–7 days KYC | Needs a registered business + current account |
| 6 | **Google Maps Platform** | $200/mo free credit | 10 min | Curated hotspots keep you inside the free credit for a long time |
| 7 | **A registered business** | ₹7,000–15,000 | 10–20 days | Private Limited. Do this first — steps 1, 2 and 5 all want it |

> ### ⚠️ Register the Play account as an Organisation
>
> A **personal** Play developer account created after 13 November 2023 must run
> **closed testing with 12 testers, continuously opted in for 14 days**, before
> you may apply for production access. Organisation accounts skip this.
>
> An organisation account needs a D-U-N-S number, which is free but takes about
> two weeks. **Start that application today** — it is the longest lead time in
> this entire list, and if you get it wrong you lose a month.
>
> If you end up on a personal account anyway, see §6 — it is survivable, just slower.

---

## 2. Get the app running on your own phone

You need: a computer (any OS), and your phone.

### 2.1 Install the tools — once

Install **Node.js 22 LTS** from [nodejs.org](https://nodejs.org). Then open
Terminal (Mac) or PowerShell (Windows) and check it worked:

```bash
node --version    # should print v22.something
```

### 2.2 Get the code and run it

```bash
git clone https://github.com/adityamaurya/sharing.git
cd sharing
npm install
npm run verify        # runs the typechecks and 110 tests — all should pass
npm run mobile        # starts the app
```

A QR code appears in your terminal.

### 2.3 See it on your phone

1. Install **Expo Go** from the Play Store or App Store.
2. Android: scan the QR from inside Expo Go. iPhone: scan with the Camera app.
3. The app opens on your phone. Edit any file in `apps/mobile/app/` and it
   updates on the phone within a second.

**If the QR doesn't work:** your phone and computer must be on the same Wi-Fi.
Failing that, run `npm run mobile -- --tunnel` — slower, but works anywhere.

---

## 3. Turn on the backend

The app runs on demo data until you do this. That's deliberate — you can demo it
to drivers and neighbours today, with no backend at all.

1. Create a project at [supabase.com](https://supabase.com). Choose the
   **Mumbai (ap-south-1)** region — data residency matters under the DPDP Act,
   and latency matters at a station gate.
2. In the dashboard: **SQL Editor → New query**. Paste the contents of
   `supabase/migrations/20260808000100_initial_schema.sql`, press Run.
3. Repeat with `supabase/migrations/20260808000200_functions.sql`.
4. **Settings → API.** Copy the Project URL and the `anon` key.
5. Create `apps/mobile/.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

> **Never put the `service_role` key in the app.** It bypasses every security
> rule in the database. It belongs only in Supabase Edge Functions. If it ever
> lands in the app bundle, anyone can read every user's data — the app bundle is
> not secret, it's just a zip file on a phone.

---

## 4. Build the real app files

Expo builds on their Macs and Linux machines in the cloud, so **you do not need
a Mac to build for iPhone.** This is the single biggest reason to use Expo.

```bash
npm install -g eas-cli
eas login                      # create a free Expo account when prompted
cd apps/mobile
eas init                       # links this folder to an Expo project
```

`eas init` prints a project ID. Paste it into `apps/mobile/app.json`, replacing
`REPLACE_AFTER_EAS_INIT`.

### First builds

```bash
eas build --platform android --profile preview
```

Takes 10–20 minutes. You get a link to an `.apk` you can install directly on any
Android phone — this is what you send to your 12 testers.

```bash
eas build --platform android --profile production   # .aab for the Play Store
eas build --platform ios --profile production       # .ipa for the App Store
```

For iOS, EAS asks for your Apple ID and offers to create signing certificates
for you. **Say yes.** Certificate management by hand is the single most
frustrating part of iOS development, and letting EAS do it removes it entirely.

---

## 5. Ship to the Play Store

### 5.1 Create the listing

**Play Console → Create app.** Then fill in, in order:

| Field | What to put |
|---|---|
| App name | `Sharing: Rickshaw Pooling` (see the naming note in §8) |
| Short description (80 chars) | `Share a rickshaw on your daily route. Fixed fare, guaranteed seat.` |
| Full description | Lead with the problem: queues, full fares, no shared autos |
| Category | Maps & Navigation |
| Screenshots | At least 2 phone screenshots. Take them from a real device |
| Feature graphic | 1024×500. Use the kaali-peeli palette |
| App icon | `apps/mobile/assets/icon.png` — already generated |
| Privacy policy URL | **Required.** You must have one before you can submit |

### 5.2 The forms that trip people up

- **Data safety.** You collect location, phone number, and payment info. Declare
  all of it. Google cross-checks against what your app actually does, and a
  mismatch gets you rejected and slows every future update.
- **Content rating.** Fill in the questionnaire honestly. This app rates "Everyone".
- **Target audience.** 18+. Do **not** tick anything that includes children — it
  pulls you into the Families policy programme, which is a large extra compliance burden.
- **App access.** Reviewers must be able to log in. Give them a test phone number
  and a fixed OTP, and write instructions in the notes field. **This is the most
  common cause of rejection for Indian apps with phone-OTP login** — the reviewer
  is in another country and cannot receive an Indian SMS.
- **Financial features.** You process payments, so declare it and be ready to
  show your Razorpay merchant details.

### 5.3 Upload and submit

```bash
eas submit --platform android --latest
```

Or upload the `.aab` by hand under **Release → Production → Create new release**.

**Review takes 1–7 days** for a new developer account. First submissions are
slower than updates. Expect at least one rejection; it is normal, not a verdict.

---

## 6. If you're on a personal Play account: the 12-tester rule

If your account is personal and was created after 13 November 2023:

1. **Release → Testing → Closed testing → Create track.**
2. Add **12 real people** by their Gmail addresses. Real phones, real Google
   accounts — emulators, duplicate accounts and bots are detected and don't count.
3. All 12 must **accept the invite and install**. The 14-day clock starts only
   once 12 are opted in simultaneously.
4. **They must keep the app installed and actually use it for 14 continuous
   days.** If one person uninstalls on day 7, you drop below 12 and the counter
   resets to zero.
5. Since April 2026, Google also rejects applications for *insufficient testing
   engagement* — testers who install but never open the app. Ask your 12 people
   to open it every day or two and tap through real screens.
6. After 14 clean days: **Apply for production access.**

Practical advice: recruit **16–18 people**, not 12. Some will drop out, and every
dropout costs you a fortnight. Your pilot WhatsApp group is exactly the right
place to find them — they are already invested in this working.

---

## 7. Ship to the App Store

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps → +**.
2. Bundle ID: `in.sharing.app` (already set in `app.json`).
3. Fill in the listing, then:

```bash
eas submit --platform ios --latest
```

**What Apple rejects Indian ride apps for, in order of frequency:**

1. **Reviewer can't log in.** Same fix as Play: a demo account with a fixed OTP,
   spelled out in App Review notes. Test it yourself from a signed-out device first.
2. **Guideline 5.1.1 — asking for location before explaining why.** Your
   permission strings in `app.json` already explain the reason. Do not shorten them.
3. **Guideline 3.1.1 — In-App Purchase.** Apple sometimes challenges apps selling
   passes. You are selling a **physical real-world service** (a rickshaw ride),
   which is explicitly exempt from IAP. Reply citing 3.1.3(e) and explain that
   the pass is prepaid transport, not digital content. This is a winnable argument
   and people win it routinely — do not panic and do not add IAP.
4. **Missing privacy policy or incomplete privacy nutrition labels.**

**Review takes 24–48 hours** typically.

---

## 8. About the name

You want the first word people search to be **"Sharing"**, and the instinct is
right — it is the word people actually say at a Mumbai stand. Two honest problems
you should know about before you commit:

1. **You cannot trademark a generic English word** for a service that literally
   is sharing. Under §9(1)(b) of the Trade Marks Act, descriptive marks are
   refused. What you *can* register — and should — is a **composite mark**: the
   kaali-peeli rickshaw logo together with the word. That is protectable, and
   it's also what people will actually recognise.
2. **App Store search will bury a generic word.** Search "sharing" today and you
   get file-sharing apps, screen-sharing apps, and photo apps. You will not rank.

**The fix costs you nothing and keeps your word:** the store title is
`Sharing: Rickshaw Pooling`, the icon says शे, and people still say "Sharing".
Store titles get 30 characters on iOS and 30 on Android — that one fits. You keep
the spoken name, and you rank for "rickshaw", "auto", "pooling" and "sharing auto",
which is what people actually type.

File the composite trademark in **Class 39** (transport). Around ₹4,500 in
government fees for a small entity, plus an attorney if you use one.

---

## 9. The order to do everything in

```
Week 0     Start the D-U-N-S application (2 weeks, blocks Apple)
           Start company registration (2-3 weeks, blocks Razorpay)
Week 1-2   Run the paper pilot. NO CODE. Fill your notebook.
Week 3     Read your notebook. Decide honestly whether to continue.
Week 4     Play + Apple developer accounts. Supabase project.
Week 5     Get the app on your own phone. Then on 3 neighbours' phones.
Week 6     Privacy policy, terms, listing copy, screenshots.
Week 7     Internal testing track. Fix what breaks on real cheap phones.
Week 8-10  Closed testing, 12+ testers, 14 continuous days.
Week 11    Apply for production. Submit to Apple in parallel.
Week 12    Live on one corridor. Not two. One.
```

**Do not launch corridor #2 until corridor #1 has above 65% weekly retention.**
Two half-working corridors is worse than one good one — you halve your density,
which is the single number that makes the Guarantee Fund solvent.

---

## 10. What will actually go wrong

Named in advance so they don't feel like disasters when they happen.

| Problem | What to do |
|---|---|
| Nobody at the stand will drive for you | Recruit the **stand leader** first, not the youngest driver. In every Mumbai stand there is one man everyone defers to. If he earns, the stand follows. |
| Drivers accept, then don't show | Exactly what happened to you with the young driver. This is why the app has reliability scores and standby drivers. Never run a corridor with fewer than 6 committed drivers. |
| Pools don't fill | Narrow the time window, don't widen it. Three people at 9:15 beats nine people spread 8:30–10:00. |
| Play rejects you | Read the exact policy they cite, fix that one thing, resubmit. Nearly always the Data Safety form or the demo login. |
| Apple rejects you | Reply in Resolution Center with a clear explanation. Most Indian transport apps get through on the second try. |
| You run out of money on the Guarantee Fund | Automatic — the code sheds NOW mode on the weakest corridors before the fund goes negative. Check `reserveStatus()` weekly. |
| A driver's family emergency strands three people | The system rematches in six minutes and credits everyone. This is Case D in the fairness doc, and it's already handled. |

---

## 11. Every command, in one place

```bash
# Day to day
npm install                  # after pulling changes
npm run verify               # typecheck + all 110 tests
npm run mobile               # run on your phone via Expo Go

# Brand assets (only when you change the logo)
python3 brand/scripts/build-icons.py     # regenerate SVGs
node brand/scripts/build-png.mjs         # regenerate PNGs for the stores

# Building
cd apps/mobile
eas build --platform android --profile preview      # APK for testers
eas build --platform android --profile production   # AAB for Play
eas build --platform ios --profile production       # IPA for App Store

# Shipping
eas submit --platform android --latest
eas submit --platform ios --latest

# Pushing a JavaScript-only fix without a store review (minutes, not days)
eas update --branch production --message "Fixed fare display"
```

That last one is worth understanding: **`eas update` ships JavaScript changes to
everyone's phone in minutes, with no store review.** Text fixes, price display
bugs, layout problems — all of it. You only need a full store build when you
change native code or app permissions. For a solo founder this is the difference
between fixing a bug today and fixing it next week.
