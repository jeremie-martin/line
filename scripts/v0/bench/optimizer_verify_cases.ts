export const VERIFY_OPTIMIZER_BUDGET = 40_000;

export type VerifyOptimizerCase = readonly [spec: string, seed: number];

// Small/medium/large (mirrors v0_determinism.test.ts) + the perf spec.
export const SMOKE_VERIFY_CASES: readonly VerifyOptimizerCase[] = [
  ["tiny_dance", 0],
  ["syncopated_switchback", 1],
  ["drums_signature", 2],
  ["mini_burst", 0],
];

// Wider second-tier sample: simple, dense, fragile, drum-heavy, syncopated,
// elevation, amplitude, and combined geometry specs.
export const WIDE_VERIFY_CASES: readonly VerifyOptimizerCase[] = [
  ["tiny_dance", 0],
  ["mini_burst", 0],
  ["cold_start", 1],
  ["syncopated_switchback", 1],
  ["rhythm_ladder", 2],
  ["drums_signature", 2],
  ["drums_dropout", 3],
  ["drums_swell", 4],
  ["opening_burst", 1],
  ["climb_terrace", 5],
  ["big_air_ramp", 6],
  ["skyline_push", 7],
];
