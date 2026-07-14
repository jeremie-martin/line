/**
 * Self-contained physical-prefix fixtures for trajectory studies.
 *
 * A fixture records exactly the state needed to rebuild an immutable engine:
 * start state, start lines, and each committed line group in order. It does not
 * serialize ranking policy or claim to replay search decisions.
 */
import {
  engineLineFromTrackLine,
  makeBaseEngine,
  type ResolvedStart,
} from "../core/substrate.ts";
import type { HandoffNode } from "../optimizer/handoff.ts";
import { extendNode, makeRootNode, type SearchNode } from "../optimizer/node.ts";
import type { TrackLine } from "../types.ts";

export type PhysicalPrefixFixture = {
  schema: "line.trajectory-physical-prefix.v1";
  gapIndex: number;
  prefixNextLineId: number;
  cumulativeCost: number;
  searchSeed: number;
  startState: ResolvedStart;
  startLines: TrackLine[];
  /** Preserved as groups so line ordering and gap ownership remain auditable. */
  prefixFitLines: Array<TrackLine[] | null>;
};

export function makePhysicalPrefixFixture(node: HandoffNode): PhysicalPrefixFixture {
  return makePhysicalPrefixFixtureAtGap(node, node.search.gapIndex);
}

/**
 * Project a selected search path onto an earlier declared prefix boundary.
 *
 * Traversal may batch-complete a suffix, so an otherwise valid deepest path
 * need not emit a register event at every intermediate contact. The projected
 * fixture preserves exactly the physical fits committed before `gapIndex`;
 * callers must still certify that this prefix reproduces the selected path at
 * their target frame.
 */
export function makePhysicalPrefixFixtureAtGap(node: HandoffNode, gapIndex: number): PhysicalPrefixFixture {
  assertProjectionRequest(node, gapIndex);
  const prefixFits = node.search.prefixFits.slice(0, gapIndex);
  assertDonorAccounting(node);
  return {
    schema: "line.trajectory-physical-prefix.v1",
    gapIndex,
    prefixNextLineId: 1 + node.startLines.length + fitLineCount(prefixFits),
    cumulativeCost: prefixFits.reduce((sum, fit) => sum + (fit?.cost ?? 0), 0),
    searchSeed: node.searchSeed,
    startState: {
      position: { ...node.startState.position },
      velocity: { ...node.startState.velocity },
    },
    startLines: cloneLines(node.startLines),
    prefixFitLines: prefixFits.map((fit) => fit === null ? null : cloneLines(fit.lines)),
  };
}

/**
 * Rebuild the selected donor's own search ancestry through an earlier boundary.
 *
 * This deliberately does not read the donor's final engine: tail-completion
 * terrain after the target is installed from frame zero and is not evidence of
 * the target prefix. The reconstruction uses the same root-plus-extend
 * transition as compiler traversal and checks the donor's full bookkeeping
 * before returning the requested ancestor.
 */
export function replayHandoffPrefix(node: HandoffNode, gapIndex: number): SearchNode {
  assertProjectionRequest(node, gapIndex);
  assertDonorAccounting(node);
  return replayPrefixUnchecked(node, gapIndex);
}

/** Rebuild only the physical engine encoded by a fixture. */
// deno-lint-ignore no-explicit-any
export function rebuildPhysicalPrefixEngine(fixture: PhysicalPrefixFixture): any {
  let engine = makeBaseEngine(fixture.startState);
  if (fixture.startLines.length > 0) {
    engine = engine.addLine(fixture.startLines.map((line) => engineLineFromTrackLine(line)));
  }
  for (const lines of fixture.prefixFitLines) {
    if (lines === null || lines.length === 0) continue;
    engine = engine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  }
  return engine;
}

function cloneLines(lines: readonly TrackLine[]): TrackLine[] {
  return lines.map((line) => ({ ...line }));
}

function fitLineCount(fits: readonly ({ lines: readonly TrackLine[] } | null)[]): number {
  return fits.reduce((count, fit) => count + (fit?.lines.length ?? 0), 0);
}

function assertProjectionRequest(node: HandoffNode, gapIndex: number): void {
  if (
    !Number.isSafeInteger(gapIndex) ||
    gapIndex < 0 ||
    gapIndex > node.search.gapIndex ||
    node.search.prefixFits.length !== node.search.gapIndex
  ) {
    throw new Error(`cannot project physical prefix at g${gapIndex} from selected g${node.search.gapIndex} path`);
  }
}

function assertDonorAccounting(node: HandoffNode): void {
  const full = replayPrefixUnchecked(node, node.search.gapIndex);
  if (
    full.gapIndex !== node.search.gapIndex ||
    full.prefixNextLineId !== node.search.prefixNextLineId ||
    full.cumulativeCost !== node.search.cumulativeCost
  ) {
    throw new Error(`selected g${node.search.gapIndex} donor violates root-plus-extend accounting`);
  }
}

function replayPrefixUnchecked(node: HandoffNode, gapIndex: number): SearchNode {
  let engine = makeBaseEngine(node.startState);
  if (node.startLines.length > 0) {
    engine = engine.addLine(node.startLines.map((line) => engineLineFromTrackLine(line)));
  }
  let prefix: SearchNode = {
    ...makeRootNode(engine, node.search.prefixFits.length),
    prefixNextLineId: 1 + node.startLines.length,
  };
  for (const fit of node.search.prefixFits.slice(0, gapIndex)) {
    prefix = extendNode(prefix, fit);
  }
  return prefix;
}
