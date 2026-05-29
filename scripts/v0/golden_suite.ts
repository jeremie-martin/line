import { resolve } from "node:path";
import type { Spec } from "./types.ts";
import type { Budget } from "./optimizer/types.ts";

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
] as const;

export const REPORT_VARIANTS = [
  "contact_phase_plus_25ms",
  "time_stretch_102",
] as const;

export const GOLDEN_SEEDS = [0, 1, 2] as const;

/**
 * Default compute budget for the LDS compiler, in PHYSICS frames (the honest
 * work unit — frames the engine actually integrates; see
 * `optimizer/sim_frames.ts`).
 *
 * FLAT, deliberately. Parity does NOT depend on this value — the floor leaf is
 * the legacy greedy descent, so goal_score >= greedy_v1 and contract-pass =
 * 65/65 at ANY budget; the budget only buys the bonus above greedy. The data
 * (docs/optimizer/08_budget_curves.md + floor-cost measurement) says:
 *   - every spec's greedy floor costs 33k–134k physics (≤38 s); none are huge,
 *     and floor cost does NOT scale cleanly with contacts or frames;
 *   - most of the LDS bonus is *cheap* — the d=0 leaf + polish already lifts
 *     e.g. rhythm_ladder 460→532; deviations add only a little more;
 *   - on dense specs (drums family, solo_run) LDS deviations dead-end, so any
 *     budget above the floor is wasted wall-clock.
 * An affine-in-contacts budget therefore handed big specs 5–8× their floor and
 * burned 10–20× greedy's wall-clock for ZERO quality gain. A flat budget a
 * modest headroom above the largest floor captures the cheap bonus on solvable
 * specs while bounding the waste on dead-end specs. wall ≈ 0.27 ms/physframe,
 * so 200k ≈ a ~55 s ceiling per (spec,seed) before the one-leaf overshoot.
 *
 * (Tighter bounding of dead-end specs needs an algorithm change — finer-grained
 * budget checks or LDS early-stop / completion — tracked as the big-spec speed
 * item in docs/optimizer/07_remaining_work.md, deferred until it can be made
 * safe without regressing any spec.)
 */
export const LDS_BUDGET_PHYS = 200_000;

export function budgetFor(_spec: Spec): Budget {
  return { kind: "work", units: LDS_BUDGET_PHYS };
}

/**
 * Fast inner-loop preset (`golden.ts --fast`). A small, diverse subset of specs
 * with CHEAP base floors (no drums/dense/solo — their budget-exempt backtracking
 * floor dominates regardless of budget, so they can't be made fast), one seed,
 * and a reduced budget. Gives a ~30-45 s signal for iterating, NOT the canonical
 * goal_score — the harness labels fast runs as indicative and refuses to print
 * GOAL_SCORE for them. Use the full run before trusting a result or committing.
 */
export const FAST_SPECS: GoldenSpecName[] = [
  "tiny_dance",
  "mini_burst",
  "cold_start",
  "rhythm_ladder",
];
export const FAST_BUDGET_PHYS = 40_000;
export const FAST_SEED = 0;

/**
 * Committed fingerprint of the "ruler" — `score.ts` + every `specs/golden/*.ts`
 * (first 12 hex of their concatenated sha256; see `golden.ts evaluatorFingerprint`).
 * The harness prints the live fingerprint each run and warns on drift, so an
 * accidental (or sneaky) edit to the scorer or specs is visible — scores after a
 * drift are not comparable to history. A DELIBERATE ruler change (a charter
 * revision) updates this constant in the same commit. Soft tripwire, not a gate.
 */
export const EVALUATOR_FINGERPRINT = "e159a6bc5e41";

/**
 * Worker-timeout (hang-detection safety cap) for the compile. LDS spends its
 * physics budget exploring (≈0.3 ms per physics frame, so a 200k budget ≈ 60-70 s
 * wall, up to ~2× under the one-leaf overshoot), so the cap is scaled off the
 * budget with generous safety — a normal compile is never killed mid-search
 * (which would score 0, a false failure). golden.ts further multiplies this by
 * --jobs, since parallel contention stretches wall-clock. Safety net, not a
 * quality term (the budget unit is sim-frames, which is wall-clock-independent).
 */
export const LDS_MS_PER_PHYSFRAME = 0.35; // measured 0.25-0.37; upper bound
export const LDS_WORKER_SAFETY = 3;
export const LDS_WORKER_TIMEOUT_FLOOR_MS = 120_000;
export const LDS_WORKER_TIMEOUT_CAP_MS = 600_000;

export function ldsWorkerTimeoutMs(budgetUnits: number): number {
  const raw = Math.round(budgetUnits * LDS_MS_PER_PHYSFRAME * LDS_WORKER_SAFETY);
  return Math.min(LDS_WORKER_TIMEOUT_CAP_MS, Math.max(LDS_WORKER_TIMEOUT_FLOOR_MS, raw));
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
    sections: spec.sections.map((section) => ({ ...section })),
    ...(spec.defaults ? { defaults: { ...spec.defaults } } : {}),
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
  for (const section of spec.sections) {
    if (
      !Number.isFinite(section.t0) ||
      !Number.isFinite(section.t1) ||
      section.t0 < 0 ||
      section.t1 > spec.duration ||
      section.t1 <= section.t0
    ) {
      throw new Error(`${label}: invalid section ${section.t0}-${section.t1}`);
    }
  }
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
    const scaled: Spec = {
      ...spec,
      duration: Number((spec.duration * factor).toFixed(3)),
      contacts: spec.contacts.map((contact) => ({
        t: Number((contact.t * factor).toFixed(3)),
      })),
      sections: spec.sections.map((section) => ({
        ...section,
        t0: Number((section.t0 * factor).toFixed(3)),
        t1: Number((section.t1 * factor).toFixed(3)),
      })),
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
