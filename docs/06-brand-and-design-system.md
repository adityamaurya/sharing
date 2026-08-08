# Brand and Design System

Tokens: [`apps/mobile/src/theme/tokens.ts`](../apps/mobile/src/theme/tokens.ts) ·
Icons: [`brand/`](../brand/) ·
Tests: [`tokens.test.ts`](../apps/mobile/src/theme/tokens.test.ts)

---

## 1. Kaali-peeli

Black and yellow. Every Mumbai commuter can identify that livery from fifty
metres, and that recognition is free — it would be foolish to spend it on a
trendier palette.

| Token | Hex | Role |
|---|---|---|
| `peeli` | `#FFC531` | Taxi yellow. The primary. One action per screen. |
| `kaali` | `#141210` | Soft black. Pure `#000` reads as a hole on OLED and glares in sun. |
| `paper` | `#FAF8F5` | Background |
| `go` | `#0F7A4A` | Confirmed |
| `warn` | `#A34A08` | Attention |
| `stop` | `#B4231F` | Problem |

**Yellow is a surface colour, never a text colour.** Peeli on white measures
about 1.7:1. There is a test that asserts this failure, so the reason text on
yellow is always kaali is documented in code rather than in somebody's memory.

## 2. The icon

A front-elevation autorickshaw — domed canopy, single front wheel, mirror stalks
— with the first letter of the local word for "sharing" set into the windscreen.

**Mumbai gets Devanagari शे.** The same motif carries a different letter in each
region, which is the whole idea: the icon should look like it belongs to the
street it's used on.

| Region | Letter | Word |
|---|---|---|
| Hindi / Marathi (Mumbai) | **शे** | शेअरिंग |
| Telugu (Hyderabad) | **షే** | షేరింగ్ |
| Tamil (Chennai) | **ஷே** | ஷேரிங் |
| Kannada (Bengaluru) | **ಶೇ** | ಶೇರಿಂಗ್ |

The letters are **real vector outlines**, extracted from Noto Sans and shaped
with HarfBuzz so the matra sits where a typesetter would put it. They are not
live text, so the icon renders identically everywhere with no font to install and
nothing to break at build time.

Regenerate with:

```bash
python3 brand/scripts/build-icons.py    # SVGs
node brand/scripts/build-png.mjs        # store PNGs
```

The dome and the single front wheel are load-bearing: without them the silhouette
reads as a bus. That was the first draft's actual mistake.

## 3. Type

Nothing below **15sp** exists. Body is **17sp**. Fares, plates and times are
**24sp and up**, because those are the numbers that decide whether somebody gets
into the right rickshaw.

| Style | Size | Use |
|---|---|---|
| `plate` | 34 | Number plates, tabular, letter-spaced |
| `display` | 34 | The one thing this screen is about |
| `figure` | 28 | Fares and times |
| `title` | 22 | Section heads |
| `subtitle` | 19 | Card heads |
| `body` | 17 | Everything else |
| `caption` | 15 | Labels only — never a full sentence |

OS font scaling is respected up to **1.6×**. Uncapped, a 200% setting pushes the
primary button off the bottom of the screen, which is worse for the person who
set it than a slightly smaller font.

## 4. Touch and layout

- **48dp** minimum tap target. **60dp** for primary actions — they get pressed on
  a moving train.
- One full-width primary action per screen, pinned to the bottom in `Screen`'s
  `footer`, always reachable without scrolling.
- 4px spacing scale.

## 5. Status is never colour alone

Roughly 1 in 12 men has some colour-vision deficiency, and in bright sunlight on
a cheap LCD everybody does. Every `Pill` carries **an icon, a word, and a colour**,
so the meaning survives losing any one of them.

## 6. The 55-year-old test

> A 55-year-old with reading glasses, in bright Mumbai sunlight, on a ₹8,000
> Android phone, holding a bag in one hand, who has never used Uber.

Every token above is answerable to that sentence. If a value makes that person's
life harder it is the wrong value, however good it looks in a Figma frame at
200% zoom.

The rules are enforced by tests, not by discipline — contrast floors, the 15sp
minimum, line-height ratios, and the 48dp target. One of them already caught a
real failure: `warn` was `#B45309`, which measured 4.47:1 against its background,
just under the AA floor. Nobody would have noticed by eye. The test did.

## 7. Language

Hindi and Marathi from day one, chosen on first launch, changeable in one tap.
**Get a native speaker to review the 200 strings that matter** — machine
translation produces text that is technically correct and socially wrong, and in
a product built on trust between neighbours that is expensive.

Voice matters as much as accuracy. The app talks like a person who respects you:
*"Get well soon. Grace day used — 3 left this month."* Not
*"Cancellation processed. Penalty waived per policy 4.2."*
