/**
 * v0 contract score.
 *
 * The score is a product of smooth quality factors in [0, 1]:
 *
 *   score = 1000
 *         * axis_quality       // exp(-rms(axis_error) / AXIS_QUALITY_TOLERANCE)
 *         * drift_quality      // exp(-rms(landed_excess) / SYNC_TOLERANCE)
 *         * missing_quality    // exp(-missing_count / MISSING_CONTACT_TOLERANCE)
 *         * off_beat_quality   // exp(-off_beat_count / OFF_BEAT_TOLERANCE)
 *         * survival_quality   // terminus.frame / total_frames (1 on endOfSpec)
 *
 * Two design principles shape the contact terms:
 *   - drift (contact landed, just outside ±1 frame) → smooth RMS over
 *     landed contacts; a near-miss in a 30-contact spec contributes
 *     proportionally less than in a 10-contact spec, which is correct
 *     because the contact *did* land.
 *   - missing (contact never landed) → count-based, NOT averaged. Missing
 *     one contact in a 50-spec is the same severity as missing one in a
 *     10-spec — a missed contact is a missed contact.
 *
 * `sync_quality` is reported as `drift_quality * missing_quality` for
 * convenience; the score uses the factors directly (mathematically identical).
 *
 * Hard contract violations no longer zero the score; they degrade their
 * respective quality factor smoothly so the optimizer always has gradient.
 * `contract_passed` is reported as a separate boolean for engineering
 * acceptance.
 */

import type { ContactReport, DriftReport } from "./types.ts";

/**
 * Mean normalized axis error at which a valid run keeps e^-1 ≈ 37% of its
 * axis-quality credit. Loss is computed as RMS(axis_error) / TOLERANCE.
 */
export const AXIS_QUALITY_TOLERANCE = 0.25;
/** Back-compat alias for older scripts; scoring no longer has zero-credit cutoff. */
export const AXIS_ZERO_CREDIT_ERROR = AXIS_QUALITY_TOLERANCE;

/** RMS landed-contact frame-error excess (beyond the ±1 frame tolerance) at
 *  which drift_quality decays to e^-1 ≈ 37%. Only contacts that actually
 *  landed are aggregated here; missing contacts are handled by their own
 *  count-based term so spec size cannot wash them out. */
export const SYNC_TOLERANCE = 1.0;
/** Missing-contact count at which missing_quality decays to e^-1 ≈ 37%.
 *  Count-based by design: missing one contact is missing one contact,
 *  whether the spec has 6 or 60 of them. */
export const MISSING_CONTACT_TOLERANCE = 1.0;
/** Off-beat landing count at which off_beat_quality decays to e^-1. */
export const OFF_BEAT_TOLERANCE = 1.0;

export type AxisDetail = {
  section_index: number;
  axis: string;
  target: number;
  achieved: number;
  error: number;
};

export type WorstContact = {
  t_target: number;
  t_actual: number | null;
  frame_error: number | null;
  status: ContactReport["status"];
};

export type V0ContractScore = {
  score: number;
  /** True iff every hard-contract invariant held (contacts ±1 frame, no
   *  off-beat landings, survived through endOfSpec). Reporting only —
   *  does not gate the score. */
  contract_passed: boolean;
  /** Back-compat alias of `contract_passed`. */
  passed: boolean;
  /** Back-compat alias of `contract_passed`. */
  valid_contract: boolean;
  hard_failures: string[];
  contacts: number;
  hits: number;
  drift: number;
  missing: number;
  sync_score: number;
  /** Smooth quality for *landed* contacts that drifted past ±1 frame. */
  drift_quality: number;
  /** Smooth quality keyed on missing-contact count (not averaged by spec size). */
  missing_quality: number;
  /** Convenience aggregate: `drift_quality * missing_quality`. */
  sync_quality: number;
  off_beat_landings: number;
  off_beat_quality: number;
  died: number;
  survival_quality: number;
  axis_count: number;
  axis_error_total: number;
  axis_error_mean: number;
  axis_error_max: number;
  axis_error_rms: number;
  axis_loss: number;
  axis_quality: number;
  /** Back-compat alias of `axis_quality`. */
  axis_score: number;
};

export type RuntimeBudget = {
  elapsed_ms: number;
  soft_ms: number;
  hard_ms: number;
};

export type V0TimedContractScore = V0ContractScore & RuntimeBudget & {
  score_without_time: number;
  time_multiplier: number;
};

export type ScoreOptions = {
  /** Total frames in the spec (used to compute survival_quality). If
   *  omitted, survival_quality is 1 on `endOfSpec` and 0 otherwise. */
  totalFrames?: number;
};

export function axisDetails(report: DriftReport): AxisDetail[] {
  const out: AxisDetail[] = [];
  for (const section of report.sections) {
    for (const [axis, value] of Object.entries(section.axes)) {
      out.push({
        section_index: section.section_index,
        axis,
        target: value.target,
        achieved: value.achieved,
        error: value.error,
      });
    }
  }
  return out;
}

export function worstContacts(report: DriftReport, limit = 3): WorstContact[] {
  return [...report.contacts]
    .filter((c) => c.status !== "hit")
    .sort((a, b) => contactSeverity(b) - contactSeverity(a))
    .slice(0, limit)
    .map((c) => ({
      t_target: c.t_target,
      t_actual: c.t_actual,
      frame_error: c.frame_error,
      status: c.status,
    }));
}

function contactSeverity(c: ContactReport): number {
  if (c.status === "missing") return Infinity;
  return c.frame_error === null ? 0 : Math.abs(c.frame_error);
}

export function runtimeMultiplier(elapsedMs: number, softMs: number, hardMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  if (!Number.isFinite(softMs) || !Number.isFinite(hardMs) || hardMs <= softMs) {
    throw new Error(`invalid runtime budget: soft=${softMs} hard=${hardMs}`);
  }
  if (elapsedMs <= softMs) return 1;
  if (elapsedMs >= hardMs) return 0;

  const x = (elapsedMs - softMs) / (hardMs - softMs);
  const smoothstep = x * x * (3 - 2 * x);
  return 1 - smoothstep;
}

export function shiftedGeometricMean(values: number[], shift = 1): number {
  if (values.length === 0) return 0;
  if (!Number.isFinite(shift) || shift <= 0) {
    throw new Error(`shift must be positive, got ${shift}`);
  }
  const logMean = values.reduce((sum, value) => {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    return sum + Math.log(safe + shift);
  }, 0) / values.length;
  return Math.exp(logMean) - shift;
}

/** Per-contact frame-error excess past the ±1 tolerance, for *landed*
 *  contacts only. Missing contacts are excluded — they contribute to
 *  missing_quality instead. */
function landedExcessFrames(c: ContactReport): number {
  if (c.status === "missing") return 0;
  if (c.frame_error === null) return 0;
  return Math.max(0, Math.abs(c.frame_error) - 1);
}

export function scoreDriftReport(
  report: DriftReport,
  opts: ScoreOptions = {},
): V0ContractScore {
  const contacts = report.contacts.length;
  const hits = report.contacts.filter((c) => c.status === "hit").length;
  const drift = report.contacts.filter((c) => c.status === "drift").length;
  const missing = report.contacts.filter((c) => c.status === "missing").length;
  const sync_score = contacts > 0 ? hits / contacts : 1;

  const landed = report.contacts.filter((c) => c.status !== "missing");
  const driftRms = landed.length > 0
    ? Math.sqrt(
        landed.reduce((sum, c) => {
          const e = landedExcessFrames(c);
          return sum + e * e;
        }, 0) / landed.length,
      )
    : 0;
  const drift_quality = Math.exp(-driftRms / SYNC_TOLERANCE);
  const missing_quality = Math.exp(-missing / MISSING_CONTACT_TOLERANCE);
  const sync_quality = drift_quality * missing_quality;

  const axes = axisDetails(report);
  const axis_count = axes.length;
  const axis_error_total = axes.reduce((sum, a) => sum + Math.abs(a.error), 0);
  const axis_error_mean = axis_count > 0 ? axis_error_total / axis_count : 0;
  const axis_error_max = axes.reduce((max, a) => Math.max(max, Math.abs(a.error)), 0);
  const axis_error_rms = axis_count > 0
    ? Math.sqrt(axes.reduce((sum, a) => sum + a.error * a.error, 0) / axis_count)
    : 0;
  const axis_loss = axis_count > 0 ? axis_error_rms / AXIS_QUALITY_TOLERANCE : 0;
  const axis_quality = Math.exp(-axis_loss);

  const off_beat_landings = report.off_beat_landings.length;
  const off_beat_quality = Math.exp(-off_beat_landings / OFF_BEAT_TOLERANCE);

  const reachedEnd = report.terminus.reason === "endOfSpec";
  const died = reachedEnd ? 0 : 1;
  let survival_quality: number;
  if (reachedEnd) {
    survival_quality = 1;
  } else if (opts.totalFrames !== undefined && opts.totalFrames > 0) {
    survival_quality = Math.min(1, Math.max(0, report.terminus.frame / opts.totalFrames));
  } else {
    survival_quality = 0;
  }

  const hard_failures: string[] = [];
  if (drift > 0 || missing > 0) hard_failures.push(`sync:${drift}drift/${missing}missing`);
  if (died) hard_failures.push(`died:${report.terminus.reason}@${report.terminus.frame}`);
  if (off_beat_landings > 0) hard_failures.push(`offBeat:${off_beat_landings}`);

  const contract_passed = hard_failures.length === 0;
  const score = 1000
    * axis_quality
    * drift_quality
    * missing_quality
    * off_beat_quality
    * survival_quality;

  return {
    score,
    contract_passed,
    passed: contract_passed,
    valid_contract: contract_passed,
    hard_failures,
    contacts,
    hits,
    drift,
    missing,
    sync_score,
    drift_quality,
    missing_quality,
    sync_quality,
    off_beat_landings,
    off_beat_quality,
    died,
    survival_quality,
    axis_count,
    axis_error_total,
    axis_error_mean,
    axis_error_max,
    axis_error_rms,
    axis_loss,
    axis_quality,
    axis_score: axis_quality,
  };
}

export function scoreTimedDriftReport(
  report: DriftReport,
  budget: RuntimeBudget,
  opts: ScoreOptions = {},
): V0TimedContractScore {
  const base = scoreDriftReport(report, opts);
  const time_multiplier = runtimeMultiplier(budget.elapsed_ms, budget.soft_ms, budget.hard_ms);
  const score_without_time = base.score;
  return {
    ...base,
    score: score_without_time * time_multiplier,
    score_without_time,
    time_multiplier,
    elapsed_ms: budget.elapsed_ms,
    soft_ms: budget.soft_ms,
    hard_ms: budget.hard_ms,
  };
}
