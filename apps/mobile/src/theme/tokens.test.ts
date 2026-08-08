import { describe, expect, it } from 'vitest';

import {
  CONTRAST_FLOOR,
  MIN_FONT_SIZE,
  colors,
  contrastRatio,
  palette,
  touch,
  type,
} from './tokens';

/**
 * The accessibility rules in docs/00-product-spec.md §11 are promises to a
 * 55-year-old in bright sunlight on a cheap phone. Promises that aren't checked
 * decay — someone adds a grey-on-grey caption six months from now and nobody
 * notices until a review says the app is unreadable. So they're checked.
 */

describe('contrast', () => {
  it('sets body text on background above WCAG AAA', () => {
    expect(contrastRatio(colors.text, colors.bg)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.body);
    expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.body);
  });

  it('keeps muted text readable, not decorative', () => {
    expect(contrastRatio(colors.textMuted, colors.bg)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.other);
    expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR.other,
    );
  });

  it('makes the primary button label legible on taxi yellow', () => {
    expect(contrastRatio(colors.textOnPrimary, colors.primary)).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR.body,
    );
  });

  it('keeps every status colour readable on its own soft background', () => {
    const pairs: [string, string][] = [
      [colors.success, colors.successSoft],
      [colors.warning, colors.warningSoft],
      [colors.danger, colors.dangerSoft],
      [colors.info, colors.infoSoft],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.other);
    }
  });

  it('proves yellow is a surface colour and never a text colour', () => {
    // This is the trap in a kaali-peeli palette: peeli on white is ~1.7:1.
    // The assertion documents *why* text on yellow is always kaali.
    expect(contrastRatio(palette.peeli, colors.surface)).toBeLessThan(CONTRAST_FLOOR.other);
  });
});

describe('type scale', () => {
  it('has no text below the 15sp floor', () => {
    for (const [name, style] of Object.entries(type)) {
      expect(style.fontSize, `${name} is below the readable floor`).toBeGreaterThanOrEqual(
        MIN_FONT_SIZE,
      );
    }
  });

  it('sets body at 17sp, not the 14sp that looks tidy in a mockup', () => {
    expect(type.body.fontSize).toBe(17);
  });

  it('renders the numbers that matter — fare, plate, time — at 24sp or more', () => {
    expect(type.figure.fontSize).toBeGreaterThanOrEqual(24);
    expect(type.plate.fontSize).toBeGreaterThanOrEqual(24);
    expect(type.display.fontSize).toBeGreaterThanOrEqual(24);
  });

  it('gives every style enough line height to stay readable', () => {
    for (const [name, style] of Object.entries(type)) {
      expect(style.lineHeight / style.fontSize, `${name} is too tight`).toBeGreaterThanOrEqual(1.1);
    }
  });
});

describe('touch targets', () => {
  it('never goes below Android’s 48dp accessibility minimum', () => {
    expect(touch.min).toBeGreaterThanOrEqual(48);
    expect(touch.comfortable).toBeGreaterThanOrEqual(touch.min);
    expect(touch.primary).toBeGreaterThanOrEqual(touch.comfortable);
  });
});
