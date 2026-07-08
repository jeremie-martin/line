import { resolve } from "node:path";
import { AXES, type Spec } from "./types.ts";

export const GOLDEN_SPECS = [
  "drums_signature",
  "drums_pendulum",
  "drums_crescendo",
  "dense_sprint",
  "syncopated_switchback",
  // opening_burst RESTORED 2026-06-04. It is a catastrophically-fragile chain (a
  // tiny placement perturbation flips it valid↔~all-missing, and which seed breaks
  // moves run to run). This is handled honestly by the metric rather than as a
  // coin-flip: an invalid run already scores ~0, and the per-budget multi-seed
  // aggregation (shifted geomean over seeds, then specs) absorbs that bimodality
  // into a smooth score — so validity is reported as a diagnostic, never gates, and
  // the headline is the budget-value-weighted average of those per-budget scores.
  // Hardening its forward-dependency chain (chain-aware selection / multi-gap
  // rollout) remains a real search/scheduler work item.
  "opening_burst",
  "grain_staircase",
  "rhythm_ladder",
  "cold_start",
  "mini_burst",
  "tiny_dance",
  "solo_run",
  "verse_chorus",
  "drums_swell",
  "drums_crosscut",
  "drums_tide",
  "drums_dropout",
  "drums_breath",
  "drums_pulse",
  "drums_zigzag",
  // Creative non-dense axis specs (added 2026-06-07): sparse/mixed cadence specs
  // exercising the elevation and amplitude axes (air + speed always, no grain),
  // where the arc-length / climb / pop levers have room to express. The original
  // 20 specs are ~98% dense (median gap 19f), starving any longer-arc DOF; these
  // give the optimization campaign signal. 5 elevation + 5 amplitude.
  "climb_terrace",
  "swoop_dive",
  "rolling_hills",
  "summit_push",
  "mixed_grade",
  "big_air_ramp",
  "pop_train",
  "soar_settle",
  "leap_cadence",
  "float_bounds",
  // Combined elevation + amplitude specs (added 2026-06-08): every row targets
  // air + speed + elevation + amplitude with jitter=0.05. The contact grids mix
  // dense, sparse, and syncopated cadences so the active non-grain axes are
  // exercised both under tight beat pressure and with longer arc room.
  "canyon_steps",
  "ridge_pulse",
  "valley_bounce",
  "switchback_pop",
  "terrace_sprint",
  "glide_stairs",
  "dense_echo_climb",
  "rolling_drop",
  "skyline_push",
  "syncopated_lift",
] as const;

export const REPORT_VARIANTS = [
  "contact_phase_plus_25ms",
  "time_stretch_102",
] as const;

// Canonical seed slots. Each slot expands to a different actual seed per budget
// (`actualSeed = seedSlot + budgetIndex * seedsPerBudget`), so the benchmark never
// reuses one random stream across budget rungs.
export const GOLDEN_SEEDS = [
  0, 1, 2, 3, 4, 5,
  6, 7, 8, 9, 10, 11,
] as const;

export const PROBE_SEEDS = [
  0, 1, 2, 3, 4, 5,
] as const;

/** Canonical budget grid, in simulated rider frames (the honest work unit; see
 * `optimizer/sim_frames.ts`). Each budget is an INDEPENDENT full run from scratch
 * (no anytime sharing) — passing N budgets means N runs. This grid is a fixed
 * ESTIMATOR for a wider budget distribution, not "the only budgets we care about".
 * NOTE: changing this redefines what a "canonical run" is, but does NOT affect
 * EVALUATOR_FINGERPRINT (which hashes the per-run ruler, not the budget grid) — so
 * a grid change still requires a fresh, like-with-like baseline. */
export const DEFAULT_BUDGETS: readonly number[] = [
  75_000,
  150_000,
  225_000,
  350_000,
  475_000,
  550_000,
];

/** Probe grid: a normalized, lower-power preview. It is intentionally not a
 * canonical promotion gate; compare probe archives against probe baselines. */
export const FAST_PROBE_BUDGETS: readonly number[] = [75_000, 200_000, 500_000];
export const PROBE_BUDGETS = FAST_PROBE_BUDGETS;

export const FULL_SEEDS_PER_BUDGET = GOLDEN_SEEDS.length;
export const PROBE_SEEDS_PER_BUDGET = PROBE_SEEDS.length;
export const BUDGET_DISJOINT_SEED_POLICY_KIND = "budget_disjoint_contiguous" as const;

export type BudgetDisjointSeedPolicy = {
  kind: typeof BUDGET_DISJOINT_SEED_POLICY_KIND;
  seed_base: number;
  seeds_per_budget: number;
  seed_slots: number[];
  budget_seeds: Array<{ budget: number; seeds: number[] }>;
};

export function seedSlots(seedBase: number, seedsPerBudget: number): number[] {
  if (!Number.isSafeInteger(seedBase)) {
    throw new Error(`seed base must be a safe integer, got ${seedBase}`);
  }
  if (!Number.isSafeInteger(seedsPerBudget) || seedsPerBudget < 1) {
    throw new Error(`seeds per budget must be a positive safe integer, got ${seedsPerBudget}`);
  }
  return Array.from({ length: seedsPerBudget }, (_, i) => seedBase + i);
}

export function actualSeedForBudgetSlot(
  seedSlot: number,
  budgetIndex: number,
  seedsPerBudget: number,
): number {
  if (!Number.isSafeInteger(seedSlot)) {
    throw new Error(`seed slot must be a safe integer, got ${seedSlot}`);
  }
  if (!Number.isSafeInteger(budgetIndex) || budgetIndex < 0) {
    throw new Error(`budget index must be a non-negative safe integer, got ${budgetIndex}`);
  }
  if (!Number.isSafeInteger(seedsPerBudget) || seedsPerBudget < 1) {
    throw new Error(`seeds per budget must be a positive safe integer, got ${seedsPerBudget}`);
  }
  return seedSlot + budgetIndex * seedsPerBudget;
}

export function budgetSeedSchedule(
  budgets: readonly number[],
  seedBase: number,
  seedsPerBudget: number,
): BudgetDisjointSeedPolicy {
  const slots = seedSlots(seedBase, seedsPerBudget);
  return {
    kind: BUDGET_DISJOINT_SEED_POLICY_KIND,
    seed_base: seedBase,
    seeds_per_budget: seedsPerBudget,
    seed_slots: slots,
    budget_seeds: budgets.map((budget, budgetIndex) => ({
      budget,
      seeds: slots.map((slot) => actualSeedForBudgetSlot(slot, budgetIndex, seedsPerBudget)),
    })),
  };
}

/** Headline decision weights, keyed by budget and proportional to budget value
 * (higher-quality expensive runs matter more; lower budgets still count). Stored
 * keyed by budget — not position — so `decide` recomputes safely on intersections /
 * probe tiers without ordering drift. Principled (a function of budget value), not
 * tuned to flatter a result. `weightedBudgetScore` divides by the sum of the weights
 * it actually uses, so an intersection subset renormalizes automatically. */
export function budgetWeights(
  budgets: readonly number[],
): { budget: number; weight: number }[] {
  const sum = budgets.reduce((s, b) => s + b, 0);
  return [...budgets].sort((a, b) => a - b).map((budget) => ({ budget, weight: budget / sum }));
}

export const CANONICAL_BUDGET_WEIGHTS = budgetWeights(DEFAULT_BUDGETS);

/**
 * Lightweight grid for the exploratory oracle/probe scripts (portfolio_oracle).
 * Those are cheap exploration tools, NOT the canonical decision, so they use
 * their own dense low-budget grid (distinct from the canonical `DEFAULT_BUDGETS`)
 * to keep a no-arg run fast.
 */
export const EXPLORATORY_BUDGETS = [
  35_000,
  40_000,
  45_000,
  50_000,
  55_000,
  60_000,
  65_000,
  70_000,
  75_000,
] as const;

/**
 * Committed fingerprint of the evaluator ruler — `score.ts`, the authored-speed
 * ruler/conversions, target-axis/report assembly, per-axis measurement
 * reductions, impact anchors/migration, and every `specs/golden/*.ts` (first 12
 * hex of their delimited sha256; see `golden.ts evaluatorFingerprint`).
 * Compiler-only speed policy constants are intentionally excluded. The harness
 * prints the live fingerprint each run and warns on drift, so an accidental
 * scorer, speed-ruler, report, impact-migration, or spec edit is visible. A
 * DELIBERATE ruler change updates this constant in the same commit. Soft
 * tripwire, not a gate.
 */
export const EVALUATOR_FINGERPRINT = "de24a421f751"; // 2026-06-24: sentinel refreshed to the live locked impact-calibration fingerprint; no scorer/spec/ruler change in the budget-grid rebaseline (was stale 2a9954c8defb)

/**
 * Worker-timeout (hang-detection safety cap) for a row of independent budget
 * runs. golden.ts schedules budgets as separate workers, but the safety budget is
 * still computed from the full row's budget grid and multiplied by --jobs to stay
 * conservative under parallel contention. Safety net, not a quality term.
 */
export const HANDOFF_MS_PER_PHYSFRAME = 0.35; // measured upper bound
export const HANDOFF_WORKER_SAFETY = 3;
export const HANDOFF_WORKER_TIMEOUT_FLOOR_MS = 120_000;
export const HANDOFF_WORKER_TIMEOUT_CAP_MS = 600_000;

export function compilerWorkerTimeoutBudget(budgets: readonly number[]): number {
  if (budgets.length === 0) {
    throw new Error("compilerWorkerTimeoutBudget: budgets must not be empty");
  }
  return budgets.reduce((sum, budget) => sum + budget, 0);
}

export function compilerWorkerTimeoutMs(workBudget: number): number {
  const raw = Math.round(workBudget * HANDOFF_MS_PER_PHYSFRAME * HANDOFF_WORKER_SAFETY);
  return Math.min(
    HANDOFF_WORKER_TIMEOUT_CAP_MS,
    Math.max(HANDOFF_WORKER_TIMEOUT_FLOOR_MS, raw),
  );
}

export type GoldenSpecName = typeof GOLDEN_SPECS[number];
export type VariantName = "base" | typeof REPORT_VARIANTS[number];
export type SuiteCase = { specName: GoldenSpecName; variant: VariantName };

export function headlineCases(): SuiteCase[] {
  return GOLDEN_SPECS.map((specName) => ({ specName, variant: "base" }));
}

export function variantCases(): SuiteCase[] {
  return GOLDEN_SPECS.flatMap((specName) =>
    REPORT_VARIANTS.map((variant) => ({ specName, variant })),
  );
}

function cloneSpec(spec: Spec): Spec {
  return {
    duration: spec.duration,
    contacts: spec.contacts.map((contact) => ({ ...contact })),
    // Axis curves are immutable pure functions, so a shallow copy is a safe clone.
    ...(spec.axes ? { axes: { ...spec.axes } } : {}),
    ...(spec.start ? { start: { ...spec.start } } : {}),
    ...(spec.preroll !== undefined ? { preroll: spec.preroll } : {}),
    ...(spec.jitter !== undefined ? { jitter: spec.jitter } : {}),
  };
}

export function assertValidSpec(spec: Spec, label: string): void {
  if (!Number.isFinite(spec.duration) || spec.duration <= 0) {
    throw new Error(`${label}: invalid duration ${spec.duration}`);
  }
  let lastContact = -Infinity;
  for (const contact of spec.contacts) {
    if (!Number.isFinite(contact.t) || contact.t < 0 || contact.t > spec.duration) {
      throw new Error(`${label}: contact outside duration at ${contact.t}`);
    }
    if (contact.t < lastContact) {
      throw new Error(`${label}: contacts must be sorted`);
    }
    lastContact = contact.t;
  }
  // Axis-range validation lives in validateSpec (substrate); the suite only
  // checks the timeline shape here.
}

export function applyVariant(base: Spec, variant: VariantName): Spec {
  const spec = cloneSpec(base);
  if (variant === "base") {
    assertValidSpec(spec, "base");
    return spec;
  }

  if (variant === "contact_phase_plus_25ms") {
    const shifted: Spec = {
      ...spec,
      contacts: spec.contacts.map((contact) => ({
        ...contact,
        t: Number((contact.t + 0.025).toFixed(3)),
      })),
    };
    assertValidSpec(shifted, variant);
    return shifted;
  }

  if (variant === "time_stretch_102") {
    const factor = 1.02;
    // Stretch curves by composing: a curve defined in original seconds is
    // evaluated at t/factor, so the same shape spans the stretched timeline —
    // general for any curve, no per-keyframe rescaling needed.
    const stretchedAxes: NonNullable<Spec["axes"]> = {};
    if (spec.axes) {
      for (const name of AXES) {
        const curve = spec.axes[name];
        if (curve !== undefined) stretchedAxes[name] = (t: number) => curve(t / factor);
      }
    }
    const scaled: Spec = {
      ...spec,
      duration: Number((spec.duration * factor).toFixed(3)),
      contacts: spec.contacts.map((contact) => ({
        ...contact,
        t: Number((contact.t * factor).toFixed(3)),
      })),
      ...(spec.axes ? { axes: stretchedAxes } : {}),
    };
    assertValidSpec(scaled, variant);
    return scaled;
  }

  const exhaustive: never = variant;
  throw new Error(`unknown variant ${exhaustive}`);
}

export async function loadGoldenSpec(name: GoldenSpecName, variant: VariantName): Promise<Spec> {
  const mod = await import(resolve(`specs/golden/${name}.ts`));
  return applyVariant(mod.default as Spec, variant);
}
