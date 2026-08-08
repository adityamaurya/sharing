/**
 * @sharing/core — the rules of Sharing, as pure functions.
 *
 * Nothing in here imports React, React Native, Supabase, or any platform API.
 * That is deliberate: the same code runs in the mobile app (to show a price
 * before you tap) and on the server (to charge it). The server is always the
 * authority for money — the client copy exists so the number on screen and the
 * number on the receipt come from one source of truth.
 */

export * from './money.js';
export * from './policy.js';
export * from './types.js';

export * from './pricing/fares.js';
export * from './pricing/passes.js';

export * from './fairness/cancellation.js';
export * from './fairness/credits.js';
export * from './fairness/grace.js';
export * from './fairness/guaranteeFund.js';
export * from './fairness/resolve.js';

export * from './matching/score.js';

export * from './fuel/emissions.js';
export * from './fuel/guardrails.js';
