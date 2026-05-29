import type { CandidateKey, SectionAxes, TrackLine } from "./types.ts";

export type AvoidConstraint = {
  kind: "off_beat_landing" | "missed_contact";
  frame: number;
  responsibleGapIndex: number;
};

export type GapFit = {
  candidateKey: CandidateKey;
  lines: TrackLine[];
  achieved: SectionAxes;
  cost: number;
  geometryHash: string;
  lookaheadSurvivors?: number;
  lookaheadBestCost?: number;
};

export type PrefixState = {
  gapIndex: number;
  fits: readonly (GapFit | null)[];
  prefixHash: string;
  nextLineId: number;
  cumulativeCost: number;
  candidateCursorByGap: ReadonlyMap<number, number>;
  validationAvoids: readonly AvoidConstraint[];
};

export function initialPrefixState(gapCount: number): PrefixState {
  return {
    gapIndex: 0,
    fits: new Array(gapCount).fill(null),
    prefixHash: "root",
    nextLineId: 1,
    cumulativeCost: 0,
    candidateCursorByGap: new Map(),
    validationAvoids: [],
  };
}
