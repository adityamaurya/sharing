/**
 * Money in Sharing is always an integer number of **paise**.
 *
 * Never floats. `0.1 + 0.2 !== 0.3`, and a rounding error that loses a driver
 * ten paise a ride loses him ₹70 a year. Every amount that crosses a function
 * boundary in this codebase is `Paise`.
 */

declare const PaiseBrand: unique symbol;

/** An integer number of paise. 100 paise = ₹1. */
export type Paise = number & { readonly [PaiseBrand]: true };

/** Construct Paise from an integer paise value. Throws on non-integers. */
export function paise(value: number): Paise {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Paise must be an integer, received ${value}`);
  }
  return value as Paise;
}

/** Construct Paise from whole rupees. `rupees(50)` → 5000 paise. */
export function rupees(value: number): Paise {
  if (!Number.isFinite(value)) {
    throw new RangeError(`rupees() needs a finite number, received ${value}`);
  }
  return paise(Math.round(value * 100));
}

export const ZERO: Paise = 0 as Paise;

export function add(...amounts: readonly Paise[]): Paise {
  return paise(amounts.reduce<number>((sum, a) => sum + a, 0));
}

export function subtract(a: Paise, b: Paise): Paise {
  return paise(a - b);
}

/** Multiply by a scalar, rounding half-up to the nearest paisa. */
export function scale(amount: Paise, factor: number): Paise {
  return paise(Math.round(amount * factor));
}

/** Multiply and round **up** to the nearest whole rupee. Used for seat fares. */
export function scaleToWholeRupeeUp(amount: Paise, factor: number): Paise {
  return paise(Math.ceil((amount * factor) / 100) * 100);
}

/** Divide into `n` parts, rounding each part up to a whole rupee. */
export function splitCeilToRupee(amount: Paise, n: number): Paise {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`Cannot split into ${n} parts`);
  }
  return paise(Math.ceil(amount / n / 100) * 100);
}

export function max(a: Paise, b: Paise): Paise {
  return a >= b ? a : b;
}

export function min(a: Paise, b: Paise): Paise {
  return a <= b ? a : b;
}

/** Clamp to a range. */
export function clamp(amount: Paise, lo: Paise, hi: Paise): Paise {
  return min(max(amount, lo), hi);
}

/** Format for display: `5000` → `"₹50"`, `5650` → `"₹56.50"`. */
export function formatINR(amount: Paise): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  // Indian digit grouping: 1,00,000 not 100,000.
  const grouped = whole.toLocaleString('en-IN');
  const body = fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, '0')}`;
  return `${negative ? '-' : ''}₹${body}`;
}

/** Whole rupees, for compact UI where paise are never present. */
export function toRupees(amount: Paise): number {
  return amount / 100;
}
