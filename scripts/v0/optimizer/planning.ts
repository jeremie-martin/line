// Long-term planning — outcome-gated impact re-aiming (v1).
// =============================================================================
// See docs/planning-campaign.md. The compiler is otherwise purely LOCAL: each gap's arc is
// chosen to match THAT gap's literal axis targets over a 1–2 gap lookahead, and the
// non-revising frontier-DFS never revisits an early commit. This module adds a small,
// outcome-gated correction inside the repair phase: where the completed track UNDERSHOT a
// beat's impact (impact is chronically undershot), aim that gap's impact higher so the
// repair re-search pursues a steeper catch — kept ONLY if the true score improves.
//
// THE SEAM: generation and the ranking objective read `aimTargets(gap)`; the official
// scorer and the scorer-mirroring local cost read the real `gap.targets`/`gapAxisTargets`.
// So re-aiming changes only WHAT the search pursues, never how the result is scored — and
// when no re-aim is set, aimTargets falls back to the real target (byte-identical).
//
// STATUS: v1 — the FIRST working implementation of the long-term-planning idea (canonical
// ACCEPT, Δheadline +1.1). Deliberately simple; clear room to grow (see the doc's "Where
// v1 can grow": proportional-to-undershoot, re-aim beyond the single weakest gap, a learned
// conducive-state model, other systematically-biased axes). Earlier exploratory probes
// (up-front speed/impact/air biases) were studied and REJECTED — removed; the campaign log
// keeps the record.

import { impactEnvNum as envNum, type AxisValues, type Gap } from "../types.ts";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The aim target a candidate's GEOMETRY and the ranking OBJECTIVE chase for this gap.
 *  Defaults to the literal spec target; the repair-phase loop (maybeReaimImpactGap) may
 *  override it per gap via `plannedTargets`. The scorer and the scorer-mirroring axisCost
 *  never call this, so re-aiming changes only what the search pursues, never the score. */
export function aimTargets(gap: Gap): AxisValues {
  return gap.plannedTargets ?? gap.targets;
}

/** This gap's mutable planned-aim bag, cloned from `targets` on first touch. Only called
 *  when a re-aim actually applies, so an un-re-aimed gap keeps `plannedTargets` unset ⇒
 *  aimTargets() falls back to `targets` ⇒ byte-identical to the no-planning compiler. */
function plannedFor(gap: Gap): AxisValues {
  return (gap.plannedTargets ??= { ...gap.targets });
}

/** Outcome-gated impact re-aim. Called from handoff.ts's repair phase for the gap it is
 *  about to re-search (its weakest affordable gap). If THAT gap is an impact gap that
 *  actually UNDERSHOT, aim its impact higher so the restart pursues a steeper catch;
 *  air/other-weak gaps are left to clean repair. Impact is chronically undershot, so aiming
 *  higher pulls achieved UP toward the true target rather than adding error. The restart's
 *  accept/reject keeps the re-aim only where the TRUE score improves.
 *    LR_PLAN_LOOP_BUMP      multiplicative impact-aim bump (default 0.2)
 *    LR_PLAN_IMPACT_AIM_MIN only gaps whose impact ask ≥ this (default 0.3)
 *    LR_PLAN_LOOP_DEADBAND  |undershoot| ≤ this ⇒ "already met" → skip (default 0.03)
 *  Returns true iff it re-aimed this gap. */
export function maybeReaimImpactGap(gap: Gap, achievedImpact: number | undefined): boolean {
  const ask = gap.targets.impact;
  const minAsk = envNum("LR_PLAN_IMPACT_AIM_MIN", 0.3);
  if (ask === undefined || ask < minAsk) return false;
  const deadband = envNum("LR_PLAN_LOOP_DEADBAND", 0.03);
  if (achievedImpact !== undefined && achievedImpact >= ask - deadband) return false; // already meeting it
  const bump = envNum("LR_PLAN_LOOP_BUMP", 0.2);
  plannedFor(gap).impact = clamp01(ask * (1 + bump));
  return true;
}
