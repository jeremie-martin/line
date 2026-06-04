import { resolve } from "node:path";
import { AXES, type Spec } from "./types.ts";

export const GOLDEN_SPECS = [
  "drums_signature",
  "drums_pendulum",
  "drums_crescendo",
  "dense_sprint",
  "syncopated_switchback",
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
] as const;

export const REPORT_VARIANTS = [
  "contact_phase_plus_25ms",
  "time_stretch_102",
] as const;

export const GOLDEN_SEEDS = [100, 101, 102] as const;

/** Default compute checkpoints for the golden budget curve, in simulated rider
 * frames (the honest work unit; see `optimizer/sim_frames.ts`). */
export const DEFAULT_BUDGETS = [
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
 * Committed fingerprint of the "ruler" — `score.ts` + every `specs/golden/*.ts`
 * (first 12 hex of their concatenated sha256; see `golden.ts evaluatorFingerprint`).
 * The harness prints the live fingerprint each run and warns on drift, so an
 * accidental (or sneaky) edit to the scorer or specs is visible — scores after a
 * drift are not comparable to history. A DELIBERATE ruler change (a charter
 * revision) updates this constant in the same commit. Soft tripwire, not a gate.
 */
export const EVALUATOR_FINGERPRINT = "185b212a3045";

/**
 * Worker-timeout (hang-detection safety cap) for the compile. The compiler
 * checkpoints by sim-frame budgets, so normal runs scale off the maximum
 * requested budget. Checkpoint verification runs one additional standalone
 * compile per checkpoint, so its timeout scales by that extra budget work too.
 * golden.ts further multiplies this by --jobs, since parallel contention
 * stretches wall-clock. Safety net, not a quality term.
 */
export const HANDOFF_MS_PER_PHYSFRAME = 0.35; // measured upper bound
export const HANDOFF_WORKER_SAFETY = 3;
export const HANDOFF_WORKER_TIMEOUT_FLOOR_MS = 120_000;
export const HANDOFF_WORKER_TIMEOUT_CAP_MS = 600_000;

export function compilerWorkerTimeoutBudget(
  budgets: readonly number[],
  verifyCheckpoints: boolean,
): number {
  if (budgets.length === 0) {
    throw new Error("compilerWorkerTimeoutBudget: budgets must not be empty");
  }
  const maxBudget = Math.max(...budgets);
  const checkpointVerificationBudget = verifyCheckpoints
    ? budgets.reduce((sum, budget) => sum + budget, 0)
    : 0;
  return maxBudget + checkpointVerificationBudget;
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
