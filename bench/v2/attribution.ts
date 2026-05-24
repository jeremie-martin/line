/**
 * Per-beat attribution for bench v2.
 *
 * Reconstructs "which event matched which beat" from the public
 * `Detection.events` stream + the strategy's `beatFrames` — no changes to
 * `scripts/lib/search.ts` required. This keeps Phase 1 (bench rebuild)
 * decoupled from Phase 2/3 (optimizer redesign) so the baseline numbers
 * remain comparable across phases.
 *
 * Matching policy:
 *   - For each beat frame `B`, scan landings and bounces within
 *     ±MATCH_WINDOW_FRAMES (=20).
 *   - Prefer landings over bounces (landings are the visual punctuation —
 *     see PROBLEM.md §Event types).
 *   - Within the preferred type, pick the event with smallest |offset|.
 *   - Greedy matching across beats: once an event matches a beat, it can't
 *     match another. (This is the same matching policy `musicMetrics` uses;
 *     we re-implement here to also emit per-beat records, not just
 *     aggregates.)
 */

import type { Detection, DetEvent } from "../../scripts/lib/detector.ts";

/** Beats with no matching event within this many frames are recorded as
 *  unmatched (signedOffset = null). Mirrors metrics.ts MATCH_WINDOW_FRAMES. */
export const MATCH_WINDOW_FRAMES = 20;

export type PerBeatRecord = {
  /** Position of this beat in the spec's sorted beat list (0-indexed). */
  beatIdx: number;
  /** Target frame (the beat's intended event time). */
  targetFrame: number;
  /** Spacing to previous beat in frames (Infinity for the first beat). */
  spacingToPrevFrames: number;
  /** Actual event frame this beat matched, or null if no event in window. */
  actualEventFrame: number | null;
  /** signedOffset = actual - target. Positive = late. Null if unmatched. */
  signedOffsetFrames: number | null;
  /** Matched event type, or null if unmatched. */
  matchedEventType: "landing" | "bounce" | null;
  /** Convenience flags (recomputable, but cheap and useful in the CSV). */
  onBeat1: boolean;
  onBeat2: boolean;
  onBeat5: boolean;
  onBeat10: boolean;
};

/**
 * Build per-beat records from a strategy's detection + beat frames.
 *
 * `beatFrames` should already be sorted ascending. We do a greedy match:
 * for each beat in order, find the best unclaimed landing/bounce within
 * the match window; landings preferred over bounces.
 */
export function perBeatAttribution(
  det: Detection,
  beatFrames: number[],
): PerBeatRecord[] {
  // Partition events by type. Kicks deliberately excluded — they fire on
  // angle changes mid-slide and don't correspond to musical beats.
  const landings: DetEvent[] = [];
  const bounces: DetEvent[] = [];
  for (const e of det.events) {
    if (e.type === "landing") landings.push(e);
    else if (e.type === "bounce") bounces.push(e);
  }
  landings.sort((a, b) => a.frame - b.frame);
  bounces.sort((a, b) => a.frame - b.frame);

  const claimedLandings = new Set<number>(); // event indexes already taken
  const claimedBounces = new Set<number>();

  const records: PerBeatRecord[] = [];
  for (let i = 0; i < beatFrames.length; i++) {
    const target = beatFrames[i];
    const spacingToPrev = i === 0 ? Infinity : target - beatFrames[i - 1];

    // Find best landing within window, preferring landings over bounces.
    let bestEventFrame: number | null = null;
    let bestOffset = Infinity;
    let bestType: "landing" | "bounce" | null = null;
    let bestClaimSet: Set<number> | null = null;
    let bestEventIdx = -1;

    for (let j = 0; j < landings.length; j++) {
      if (claimedLandings.has(j)) continue;
      const off = Math.abs(landings[j].frame - target);
      if (off > MATCH_WINDOW_FRAMES) continue;
      if (off < bestOffset) {
        bestOffset = off;
        bestEventFrame = landings[j].frame;
        bestType = "landing";
        bestClaimSet = claimedLandings;
        bestEventIdx = j;
      }
    }

    // Only fall through to bounces if NO landing matched at all (landing
    // preferred over any bounce, even a closer one — bounces are noise
    // relative to the visual punctuation of a landing).
    if (bestType === null) {
      for (let j = 0; j < bounces.length; j++) {
        if (claimedBounces.has(j)) continue;
        const off = Math.abs(bounces[j].frame - target);
        if (off > MATCH_WINDOW_FRAMES) continue;
        if (off < bestOffset) {
          bestOffset = off;
          bestEventFrame = bounces[j].frame;
          bestType = "bounce";
          bestClaimSet = claimedBounces;
          bestEventIdx = j;
        }
      }
    }

    if (bestClaimSet !== null && bestEventIdx >= 0) {
      bestClaimSet.add(bestEventIdx);
    }

    const signedOffset = bestEventFrame === null ? null : bestEventFrame - target;
    const absOff = signedOffset === null ? Infinity : Math.abs(signedOffset);
    records.push({
      beatIdx: i,
      targetFrame: target,
      spacingToPrevFrames: spacingToPrev,
      actualEventFrame: bestEventFrame,
      signedOffsetFrames: signedOffset,
      matchedEventType: bestType,
      onBeat1: absOff <= 1,
      onBeat2: absOff <= 2,
      onBeat5: absOff <= 5,
      onBeat10: absOff <= 10,
    });
  }
  return records;
}
