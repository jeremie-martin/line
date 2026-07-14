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
  return {
    schema: "line.trajectory-physical-prefix.v1",
    gapIndex: node.search.gapIndex,
    prefixNextLineId: node.search.prefixNextLineId,
    cumulativeCost: node.search.cumulativeCost,
    searchSeed: node.searchSeed,
    startState: {
      position: { ...node.startState.position },
      velocity: { ...node.startState.velocity },
    },
    startLines: cloneLines(node.startLines),
    prefixFitLines: node.search.prefixFits.map((fit) => fit === null ? null : cloneLines(fit.lines)),
  };
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
