/**
 * Bench v2 aggregate metrics — operates on PerBeatRecord arrays produced by
 * `attribution.ts`. These are diagnostic aggregates that the OLD music
 * benchmark didn't expose: drift histograms, per-spacing on-beat%, and
 * cross-strategy "hard beat" maps.
 *
 * NOT a replacement for `scripts/lib/metrics.ts` — that owns the core
 * geometric / behavioral / music metrics (coolScore inputs etc.) which we
 * continue to use as-is. This module sits ABOVE those, consuming the
 * per-beat records that have no analog in the old metrics.
 */

import type { PerBeatRecord } from "./attribution.ts";

// ────────── Drift histogram ──────────

/** Buckets are by |signedOffset|. Last bucket is "overflow" (>25f or unmatched). */
export const DRIFT_BUCKET_EDGES = [0, 1, 2, 3, 5, 8, 12, 17, 25] as const;
//          buckets:  [0,1)  [1,2)  [2,3)  [3,5)  [5,8)  [8,12)  [12,17)  [17,25)  >=25/unmatched
// Choice rationale: dense buckets near 0 (where most beats live), wide
// buckets in the long tail. The ≥25 / unmatched bucket is one signal —
// either an event fired but >25f away, or no event at all; either way
// the beat is missed by any reasonable musical tolerance.

export type DriftHistogram = {
  /** Bucket counts, length = DRIFT_BUCKET_EDGES.length. Last bucket = unmatched + ≥25f. */
  buckets: number[];
  /** Total beats counted. */
  total: number;
  /** Beats counted in [0, 5) — the "on-beat" definition shared with on_beat_5. */
  onBeat5Count: number;
};

export function driftHistogram(recs: PerBeatRecord[]): DriftHistogram {
  const buckets = new Array<number>(DRIFT_BUCKET_EDGES.length).fill(0);
  let onBeat5Count = 0;
  for (const r of recs) {
    if (r.signedOffsetFrames === null) {
      buckets[buckets.length - 1]++;
      continue;
    }
    const abs = Math.abs(r.signedOffsetFrames);
    if (r.onBeat5) onBeat5Count++;
    let placed = false;
    for (let i = 0; i < DRIFT_BUCKET_EDGES.length - 1; i++) {
      if (abs >= DRIFT_BUCKET_EDGES[i] && abs < DRIFT_BUCKET_EDGES[i + 1]) {
        buckets[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) buckets[buckets.length - 1]++;
  }
  return { buckets, total: recs.length, onBeat5Count };
}

/** Render a drift histogram as ASCII bars. Width=barWidth chars max. */
export function renderDriftHistogram(h: DriftHistogram, barWidth = 30): string {
  const labels: string[] = [];
  for (let i = 0; i < DRIFT_BUCKET_EDGES.length - 1; i++) {
    labels.push(`[${DRIFT_BUCKET_EDGES[i]},${DRIFT_BUCKET_EDGES[i + 1]})`);
  }
  labels.push(`≥${DRIFT_BUCKET_EDGES[DRIFT_BUCKET_EDGES.length - 1]} / —`);
  const maxCount = Math.max(...h.buckets, 1);
  const lines: string[] = [];
  for (let i = 0; i < h.buckets.length; i++) {
    const count = h.buckets[i];
    const barLen = Math.round((count / maxCount) * barWidth);
    const bar = "█".repeat(barLen);
    lines.push(`  ${labels[i].padEnd(10)} ${bar.padEnd(barWidth)} ${count}`);
  }
  return lines.join("\n");
}

// ────────── Per-spacing on-beat% ──────────

/** Spacing buckets in frames. Mirrors PROBLEM.md's "≥30f minimum chainable spacing". */
export const SPACING_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "≤20f",   min: 0,         max: 20  },
  { label: "20-40f", min: 20,        max: 40  },
  { label: "40-80f", min: 40,        max: 80  },
  { label: ">80f",   min: 80,        max: Infinity },
];

export type PerSpacingStats = Array<{
  bucket: string;
  beats: number;
  onBeat5: number;
  onBeat5Pct: number;
  meanAbsOffset: number;
}>;

export function perSpacingStats(recs: PerBeatRecord[]): PerSpacingStats {
  const out: PerSpacingStats = SPACING_BUCKETS.map((b) => ({
    bucket: b.label, beats: 0, onBeat5: 0, onBeat5Pct: 0, meanAbsOffset: 0,
  }));
  // First beat has spacingToPrev = Infinity — skip from spacing analysis
  // (it's the "lead-in", not a chain spacing).
  const sumAbs = new Array<number>(SPACING_BUCKETS.length).fill(0);
  const matchedCount = new Array<number>(SPACING_BUCKETS.length).fill(0);
  for (const r of recs) {
    if (!Number.isFinite(r.spacingToPrevFrames)) continue;
    for (let i = 0; i < SPACING_BUCKETS.length; i++) {
      const b = SPACING_BUCKETS[i];
      if (r.spacingToPrevFrames >= b.min && r.spacingToPrevFrames < b.max) {
        out[i].beats++;
        if (r.onBeat5) out[i].onBeat5++;
        if (r.signedOffsetFrames !== null) {
          sumAbs[i] += Math.abs(r.signedOffsetFrames);
          matchedCount[i]++;
        }
        break;
      }
    }
  }
  for (let i = 0; i < out.length; i++) {
    out[i].onBeat5Pct = out[i].beats > 0 ? (out[i].onBeat5 / out[i].beats) * 100 : 0;
    out[i].meanAbsOffset = matchedCount[i] > 0 ? sumAbs[i] / matchedCount[i] : 0;
  }
  return out;
}

// ────────── Sims-per-hit ──────────

/** sims-per-hit = totalSims / (beats with offset ≤ 5f). High = compute is
 *  being burned on misses. Low = compute is well-targeted. */
export function simsPerHit(totalSims: number, recs: PerBeatRecord[]): number {
  const hits = recs.filter((r) => r.onBeat5).length;
  return hits > 0 ? totalSims / hits : Infinity;
}

// ────────── Hard-beat map ──────────

/** A "hard beat" is one that EVERY strategy missed (signedOffset > 5f or
 *  unmatched). Useful diagnostic: if a beat is hard for everyone, the spec
 *  is likely over-constrained (e.g. the previous beat left the rider in an
 *  infeasible state for the next landing).
 *
 *  An "easy beat" is one EVERY strategy hit (signedOffset ≤ 1f). Useful as
 *  the inverse signal: if everyone trivially hits this beat, the search
 *  shouldn't be burning compute on it. */
export type HardBeatMap = {
  hardBeatIndices: number[];
  easyBeatIndices: number[];
  totalBeats: number;
  perStrategyAttempts: number;
};

export function hardBeatMap(
  perStrategy: Array<PerBeatRecord[]>,
): HardBeatMap {
  if (perStrategy.length === 0) {
    return { hardBeatIndices: [], easyBeatIndices: [], totalBeats: 0, perStrategyAttempts: 0 };
  }
  const totalBeats = perStrategy[0].length;
  const hardBeatIndices: number[] = [];
  const easyBeatIndices: number[] = [];
  for (let b = 0; b < totalBeats; b++) {
    let allMissed = true;
    let allHit = true;
    for (const recs of perStrategy) {
      const r = recs[b];
      if (!r) { allMissed = false; allHit = false; continue; }
      if (r.onBeat5) allMissed = false;
      const tight = r.signedOffsetFrames !== null && Math.abs(r.signedOffsetFrames) <= 1;
      if (!tight) allHit = false;
    }
    if (allMissed) hardBeatIndices.push(b);
    if (allHit) easyBeatIndices.push(b);
  }
  return {
    hardBeatIndices,
    easyBeatIndices,
    totalBeats,
    perStrategyAttempts: perStrategy.length,
  };
}
