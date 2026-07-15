/**
 * Polish as clone-and-test variants.
 *
 * Mirrors the `work` branch's `polishLeafVariant`: instead of refactoring the
 * 14 in-place polish helpers to return-new-fits (laborious, error-prone), we
 * CLONE a leaf's fits, run the existing mutating helpers on the clone, and —
 * if the geometry changed — offer the result as a NEW leaf to the best-so-far
 * register. The original leaf is never touched, so polish can only ever
 * improve best-so-far; it cannot break monotonicity (adopt-iff-strictly-better)
 * and cannot corrupt the prefix-superset invariant (it adds leaves, never
 * reorders `E`).
 *
 * We run the four air/contact helpers in a fixed order. They each rebuild an
 * engine and extract internally, so their physics cost is metered honestly via
 * the detector.
 *
 * Determinism: cloneFits is a pure deep copy; the helpers are deterministic
 * functions of (fits, spec, gaps, contactFrames, durationFrames); the fixed
 * call order is part of `E`.
 */

import {
  type GapFit,
  type ResolvedStart,
} from "../core/substrate.ts";
import {
  makePolishRebuildEngine,
  polishAirRideOut,
  polishAirContactEntry,
  polishAirBriefContacts,
  polishExcessContact,
} from "../core/polish.ts";
import type { Gap, TrackLine } from "../types.ts";
import type { Spec } from "./types.ts";

/** Optional fit fields whose values become stale when polish mutates geometry:
 *  `aimed` describes the original proposer, `ref` is tied to the original
 *  landing pose, and `releaseArrivalState` is a trajectory read that polish does
 *  not recompute. Keep dropping them to preserve the old polished-leaf contract;
 *  clone every other field generically so new GapFit metadata is not silently
 *  lost. */
function cloneFitForPolish(fit: GapFit): GapFit {
  const clone = structuredClone(fit) as GapFit;
  delete clone.aimed;
  delete clone.ref;
  delete clone.releaseArrivalState;
  return clone;
}

/** Deep-clone a fits array so in-place polish helpers can't mutate the source
 *  leaf. */
export function cloneFits(fits: (GapFit | null)[]): (GapFit | null)[] {
  return fits.map((fit) => fit === null ? null : cloneFitForPolish(fit));
}

/** Stable fingerprint of fits geometry — the line endpoints that polish can
 *  move. Used to detect "polish changed nothing" so we skip a redundant
 *  rescore. */
export function fingerprintFits(fits: (GapFit | null)[]): string {
  return JSON.stringify(
    fits.map((fit) =>
      fit === null ? null : fit.lines.map((l) => [l.x1, l.y1, l.x2, l.y2]),
    ),
  );
}

export type PolishedVariant = {
  fits: (GapFit | null)[];
  // deno-lint-ignore no-explicit-any
  engine: any;
};

/**
 * Produce a polished variant of a leaf's fits, or null if polish changed
 * nothing. The returned variant carries a freshly rebuilt engine so the caller
 * can score it with the exact oracle.
 *
 * The rebuild closure captures this leaf's `startState` and is threaded through
 * each mutating helper, so concurrent or interleaved polish passes cannot share
 * stale module state.
 */
export function polishLeafVariant(
  fits: (GapFit | null)[],
  spec: Spec,
  gaps: Gap[],
  contactFrames: number[],
  durationFrames: number,
  startState: ResolvedStart,
  startLines: readonly TrackLine[] = [],
): PolishedVariant | null {
  const clone = cloneFits(fits);
  const before = fingerprintFits(clone);
  // deno-lint-ignore no-explicit-any
  const s = spec as any;
  const rebuildEngine = makePolishRebuildEngine(startState, startLines);
  polishAirRideOut(clone, gaps, s, contactFrames, durationFrames, rebuildEngine);
  polishAirContactEntry(clone, gaps, s, contactFrames, durationFrames, rebuildEngine);
  polishAirBriefContacts(clone, gaps, s, contactFrames, durationFrames, rebuildEngine);
  polishExcessContact(clone, gaps, s, contactFrames, durationFrames, rebuildEngine);
  if (fingerprintFits(clone) === before) return null;
  const engine = rebuildEngine(clone, gaps.length);
  return { fits: clone, engine };
}
