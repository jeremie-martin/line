// Global resource planning — the up-front, spec-level pre-pass.
// =============================================================================
// See docs/planning-campaign.md. The compiler is otherwise purely LOCAL: each gap's
// arc is chosen to match THAT gap's literal axis targets, judged over a 1–2 gap
// lookahead. This pre-pass runs ONCE over the resolved gaps (analytic, NO simulation
// — trivially obeys the minimal-simulation rule) to recognize spec structure the
// lookahead cannot see (e.g. a run of high-impact beats degrades downstream air),
// and may write a deliberately MODIFIED aim onto each gap.
//
// Mechanism: `aimTargets(gap)` is what GENERATION and the ranking OBJECTIVE chase;
// it defaults to the literal `gap.targets` and is overridden only when this pre-pass
// sets `gap.plannedTargets`. The official scorer (buildDriftReport → gapAxisTargets)
// and the scorer-mirroring local `axisCost` NEVER read the planned aim — so re-aiming
// changes only WHAT the search pursues, never how the result is scored.
//
// SCAFFOLD STATE: this pass computes the spec-structure FEATURES (the oracle's inputs)
// but does NOT yet bias anything — `plannedTargets` is left unset, so `aimTargets`
// falls back to `targets` and the compiler is byte-identical to the no-planning build.
// A bias v0 (see docs) sets `gap.plannedTargets` here based on `SpecPlan.features`.

import { type AxisValues, type Gap } from "../types.ts";

/** The aim target a candidate's GEOMETRY and the ranking OBJECTIVE should chase for
 *  this gap. Defaults to the literal spec target; the planning pre-pass may override
 *  per gap. The scorer and the scorer-mirroring `axisCost` never call this. */
export function aimTargets(gap: Gap): AxisValues {
  return gap.plannedTargets ?? gap.targets;
}

/** Per-gap features computed from the SPEC ALONE (no simulator). These are the
 *  inputs a bias rule would consume; empirically (docs/planning-campaign.md) the
 *  lookahead-blind predictor of downstream error is `trailingHiImpactDensity`. */
export type GapPlanFeatures = {
  index: number;
  /** Gap duration in frames (shorter ⇒ closer beats ⇒ harder). */
  gapFrames: number;
  /** This gap's (bounded) impact ask, 0 if none. */
  impactTarget: number;
  /** Fraction of the previous `HI_RUN_LOOKBACK` CONTACT gaps whose impact ask
   *  was ≥ `HI_IMPACT_THRESH` — the trailing high-impact-run signal. */
  trailingHiImpactDensity: number;
};

export type SpecPlan = {
  features: GapPlanFeatures[];
  /** Telemetry: # gaps flagged as inside a high-impact run (density ≥ 0.5). */
  hiImpactRunGaps: number;
};

const HI_RUN_LOOKBACK = 4;
const HI_IMPACT_THRESH = 0.7;
const HI_RUN_DENSITY_FLAG = 0.5;

/** Compute the spec-structure features up front. Pure read over the resolved gaps:
 *  mutates NOTHING (does not set `plannedTargets`), so it is byte-identical-safe. */
export function planSpec(gaps: readonly Gap[]): SpecPlan {
  const features: GapPlanFeatures[] = [];
  let hiImpactRunGaps = 0;
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    let hi = 0;
    let seen = 0;
    for (let j = i - 1; j >= 0 && seen < HI_RUN_LOOKBACK; j--) {
      if (!gaps[j].endsWithContact) continue;
      seen++;
      if ((gaps[j].targets.impact ?? 0) >= HI_IMPACT_THRESH) hi++;
    }
    const trailingHiImpactDensity = seen > 0 ? hi / seen : 0;
    if (trailingHiImpactDensity >= HI_RUN_DENSITY_FLAG) hiImpactRunGaps++;
    features.push({
      index: gap.index,
      gapFrames: Math.max(1, gap.endFrame - gap.startFrame),
      impactTarget: gap.targets.impact ?? 0,
      trailingHiImpactDensity,
    });
    // SCAFFOLD: no bias — `gap.plannedTargets` stays unset ⇒ aimTargets() == targets.
  }
  return { features, hiImpactRunGaps };
}
