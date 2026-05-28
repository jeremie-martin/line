/**
 * Single source of truth for "is track A better than track B".
 *
 * The optimizer's envelope, explorer ranking, and final selection all
 * use this one function so we cannot accidentally compare with two
 * different criteria. It thinly wraps `scoreDriftReport` from
 * `../score.ts` and returns its `axis_quality` field.
 *
 * Why a separate wrapper rather than calling scoreDriftReport
 * directly: when (not if) we want to refine the comparison — say,
 * include sync_quality or off_beat_quality as secondary keys — we
 * change exactly one file, and the change can be empirically tested
 * against the frozen `baselines/greedy_v1.json`.
 */

import { scoreDriftReport } from "../score.ts";
import type { CompileOutput, DriftReport, Score } from "./types.ts";

/** Score a completed track. Returns a number in [0, 1] where higher
 *  is better. Equivalent to the scorer's `axis_quality` field. */
export function scoreTrack(out: CompileOutput): Score {
  return scoreReport(out.report);
}

/** Score a DriftReport directly (useful when we don't have a full
 *  CompileOutput yet — e.g. during partial-track evaluation). */
export function scoreReport(report: DriftReport): Score {
  return scoreDriftReport(report).axis_quality;
}

/** Strict "better than" comparison. Used by the envelope to decide
 *  whether to swap the best-so-far. Strict so that ties don't churn
 *  the result based on iteration order. */
export function isStrictlyBetter(a: Score, b: Score): boolean {
  return a > b;
}
