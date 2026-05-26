/**
 * Official v0 benchmark specs.
 *
 * Shared by the serial benchmark, parallel benchmark, and goal metric so the
 * suite cannot drift between tools.
 */

export const V0_GOAL_SPECS = [
  "sanity",
  "first",
  "quick_multi_axis",
] as const;

export const V0_FULL_BENCHMARK_SPECS = [
  "drums_baseline",
  "drums_aerial",
  "drums_chunky",
  "drums_grounded",
  "drums_speed_test",
] as const;

export const V0_KNOWN_SPECS = [
  ...V0_GOAL_SPECS,
  ...V0_FULL_BENCHMARK_SPECS,
] as const;

export type V0GoalSpecName = typeof V0_GOAL_SPECS[number];
export type V0FullBenchmarkSpecName = typeof V0_FULL_BENCHMARK_SPECS[number];
export type V0KnownSpecName = typeof V0_KNOWN_SPECS[number];
