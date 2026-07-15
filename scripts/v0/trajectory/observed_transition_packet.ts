/**
 * Final-output binding for read-only transition observations.
 *
 * A trajectory study must never substitute a deep or locally attractive search
 * visit for the track the compiler actually emitted. This small leaf binds an
 * observation to the final best-so-far node and partitions only that node's
 * geometry around a declared authored contact.
 */
import type { GapFit } from "../core/substrate.ts";
import type { HandoffNode, HandoffNodeSnapshot } from "../optimizer/handoff.ts";
import type { TrackLine } from "../types.ts";

export type FinalOutputBinding =
  | { status: "bound"; snapshot: HandoffNodeSnapshot; lines: TrackLine[] }
  | { status: "invalid_output_binding"; reason: "final_snapshot_does_not_match_emitted_lines" };

export type SelectedTransitionLineGroups = {
  prior: TrackLine[];
  current: TrackLine[];
  next: TrackLine[];
  later: TrackLine[];
  all: TrackLine[];
  ids: {
    prior: number[];
    current: number[];
    next: number[];
    later: number[];
  };
};

export type SelectedTransitionAvailability =
  | { status: "available"; groups: SelectedTransitionLineGroups }
  | {
    status: "unavailable";
    reason: "target_gap_not_reached_on_final_clean_path";
    groups: SelectedTransitionLineGroups;
  };

/** Return only when the final improving snapshot reconstructs the emitted track exactly. */
export function bindFinalOutputSnapshot(
  snapshot: HandoffNodeSnapshot | null,
  finalLines: readonly TrackLine[],
): FinalOutputBinding {
  if (snapshot === null) {
    return { status: "invalid_output_binding", reason: "final_snapshot_does_not_match_emitted_lines" };
  }
  const lines = linesForHandoffNode(snapshot.node);
  if (!sameTrackLines(lines, finalLines)) {
    return { status: "invalid_output_binding", reason: "final_snapshot_does_not_match_emitted_lines" };
  }
  return { status: "bound", snapshot, lines };
}

/** Assemble lines exactly as the normal handoff output builder does. */
export function linesForHandoffNode(node: Pick<HandoffNode, "startLines" | "search">): TrackLine[] {
  return [
    ...node.startLines.map(cloneLine),
    ...node.search.prefixFits.flatMap((fit) => fit === null ? [] : fit.lines.map(cloneLine)),
  ];
}

/**
 * Partition the emitted path around one contact. Missing fits, skipped
 * contacts, and targets at the final frontier are unavailable, not invitations
 * to borrow a different search visit.
 */
export function selectedTransitionAvailability(
  node: Pick<HandoffNode, "startLines" | "search" | "skippedContacts">,
  targetGap: number,
): SelectedTransitionAvailability {
  if (!Number.isSafeInteger(targetGap) || targetGap < 0) {
    throw new Error(`target gap must be a non-negative safe integer, got ${targetGap}`);
  }
  const groups = lineGroups(node.startLines, node.search.prefixFits, targetGap);
  const clean = node.skippedContacts === 0 &&
    targetGap < node.search.gapIndex &&
    targetGap < node.search.prefixFits.length &&
    node.search.prefixFits.slice(0, targetGap + 1).every((fit) => fit !== null);
  return clean
    ? { status: "available", groups }
    : { status: "unavailable", reason: "target_gap_not_reached_on_final_clean_path", groups };
}

function lineGroups(
  startLines: readonly TrackLine[],
  fits: readonly (GapFit | null)[],
  targetGap: number,
): SelectedTransitionLineGroups {
  const prior = [...startLines.map(cloneLine), ...flattenFits(fits.slice(0, Math.min(targetGap, fits.length)))];
  const current = targetGap < fits.length ? linesForFit(fits[targetGap]) : [];
  const next = targetGap + 1 < fits.length ? linesForFit(fits[targetGap + 1]) : [];
  const later = targetGap + 2 < fits.length ? flattenFits(fits.slice(targetGap + 2)) : [];
  const all = [...prior, ...current, ...next, ...later];
  assertUniqueLineIds(all);
  return {
    prior,
    current,
    next,
    later,
    all,
    ids: {
      prior: ids(prior),
      current: ids(current),
      next: ids(next),
      later: ids(later),
    },
  };
}

function flattenFits(fits: readonly (GapFit | null)[]): TrackLine[] {
  return fits.flatMap(linesForFit);
}

function linesForFit(fit: GapFit | null | undefined): TrackLine[] {
  return fit === null || fit === undefined ? [] : fit.lines.map(cloneLine);
}

function assertUniqueLineIds(lines: readonly TrackLine[]): void {
  const seen = new Set<number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.id)) throw new Error(`selected output has non-integer line id ${line.id}`);
    if (seen.has(line.id)) throw new Error(`selected output reuses line id ${line.id}`);
    seen.add(line.id);
  }
}

function sameTrackLines(left: readonly TrackLine[], right: readonly TrackLine[]): boolean {
  return left.length === right.length && left.every((line, index) => sameLine(line, right[index]!));
}

function sameLine(left: TrackLine, right: TrackLine): boolean {
  return left.id === right.id && left.type === right.type &&
    left.x1 === right.x1 && left.y1 === right.y1 && left.x2 === right.x2 && left.y2 === right.y2 &&
    left.flipped === right.flipped && left.leftExtended === right.leftExtended &&
    left.rightExtended === right.rightExtended;
}

function cloneLine(line: TrackLine): TrackLine {
  return { ...line };
}

function ids(lines: readonly TrackLine[]): number[] {
  return lines.map((line) => line.id);
}
