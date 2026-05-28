/**
 * Stage B — polish as clone-and-test leaf variants.
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
 * We run the four phase-1 air/contact helpers, in the same fixed order the
 * legacy compiler applies them — the high-value set `work` used to reach
 * +27…+62% over greedy_v1. They each rebuild an engine and extract internally,
 * so their physics cost is metered honestly via the detector.
 *
 * Determinism: cloneFits is a pure deep copy; the helpers are deterministic
 * functions of (fits, spec, gaps, contactFrames, durationFrames); the fixed
 * call order is part of `E`.
 */

import {
  type GapFit,
  polishAirRideOut,
  polishAirContactEntry,
  polishAirBriefContacts,
  polishExcessContact,
  rebuildEngine,
} from "../compile.ts";
import type { Gap } from "../types.ts";
import type { Spec } from "./types.ts";

/** Deep-clone a fits array so in-place polish helpers can't mutate the source
 *  leaf. Clones arc (incl. anchor), lines, and achieved; cost is a scalar. */
export function cloneFits(fits: (GapFit | null)[]): (GapFit | null)[] {
  return fits.map((fit) =>
    fit === null
      ? null
      : {
          arc: { ...fit.arc, anchor: { ...fit.arc.anchor } },
          lines: fit.lines.map((l) => ({ ...l })),
          achieved: { ...fit.achieved },
          cost: fit.cost,
        },
  );
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
 */
export function polishLeafVariant(
  fits: (GapFit | null)[],
  spec: Spec,
  gaps: Gap[],
  contactFrames: number[],
  durationFrames: number,
): PolishedVariant | null {
  const clone = cloneFits(fits);
  const before = fingerprintFits(clone);
  // deno-lint-ignore no-explicit-any
  const s = spec as any;
  polishAirRideOut(clone, gaps, s, contactFrames, durationFrames);
  polishAirContactEntry(clone, gaps, s, contactFrames, durationFrames);
  polishAirBriefContacts(clone, gaps, s, contactFrames, durationFrames);
  polishExcessContact(clone, gaps, s, contactFrames, durationFrames);
  if (fingerprintFits(clone) === before) return null;
  const engine = rebuildEngine(clone, gaps.length);
  return { fits: clone, engine };
}
