/** Candidate-prefix H-1 full-sled state diversity measurement. */
import type { PlanningState, Vec2 } from "./state.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

export type CandidatePrecontactStateDiversityUnavailable = {
  status: "unavailable";
  reason: "missing_full_sled_state" | "empty_candidate_states";
};

export type CandidatePrecontactStateDiversityReady = {
  status: "ready";
  candidateStates: number;
  meanCentroidShiftPx: number;
  maxCentroidShiftPx: number;
  meanCollectiveVelocityShiftPxPerFrame: number;
  maxCollectiveVelocityShiftPxPerFrame: number;
  meanPairDistanceChangePx: number;
  maxPairDistanceChangePx: number;
};

export type CandidatePrecontactStateDiversity =
  | CandidatePrecontactStateDiversityUnavailable
  | CandidatePrecontactStateDiversityReady;

/**
 * Compare every raw candidate's exact H-1 sled configuration against the
 * immutable prefix state at that frame.  This is an observation of approach
 * dynamics only: no target-frame collision or candidate quality is read.
 */
export function characterizeCandidatePrecontactStateDiversity(
  baseline: PlanningState,
  candidates: readonly PlanningState[],
): CandidatePrecontactStateDiversity {
  if (candidates.length === 0) return { status: "unavailable", reason: "empty_candidate_states" };
  const base = snapshot(baseline);
  const compared = candidates.map(snapshot);
  if (base === null || compared.some((entry) => entry === null)) {
    return { status: "unavailable", reason: "missing_full_sled_state" };
  }
  const values = compared as FullSledSnapshot[];
  const centroidShift = values.map((state) => length(subtract(state.centroid, base.centroid)));
  const collectiveVelocityShift = values.map((state) => length(subtract(state.collectiveVelocity, base.collectiveVelocity)));
  const pairDistanceChange = values.map((state) => rms(state.pairDistances.map((distance, index) => distance - base.pairDistances[index]!)));
  return {
    status: "ready",
    candidateStates: values.length,
    meanCentroidShiftPx: mean(centroidShift),
    maxCentroidShiftPx: Math.max(...centroidShift),
    meanCollectiveVelocityShiftPxPerFrame: mean(collectiveVelocityShift),
    maxCollectiveVelocityShiftPxPerFrame: Math.max(...collectiveVelocityShift),
    meanPairDistanceChangePx: mean(pairDistanceChange),
    maxPairDistanceChangePx: Math.max(...pairDistanceChange),
  };
}

type FullSledSnapshot = { centroid: Vec2; collectiveVelocity: Vec2; pairDistances: number[] };

function snapshot(state: PlanningState): FullSledSnapshot | null {
  const points = SLED_POINTS.map((name) => state.points[name]);
  if (points.some((point) => point === undefined || point.velocity === null)) return null;
  const readable = points as Array<NonNullable<typeof points[number]>>;
  const pairDistances: number[] = [];
  for (let left = 0; left < readable.length; left++) {
    for (let right = left + 1; right < readable.length; right++) {
      pairDistances.push(length(subtract(readable[left]!.position, readable[right]!.position)));
    }
  }
  return {
    centroid: mean(readable.map((point) => point.position)),
    collectiveVelocity: mean(readable.map((point) => point.velocity!)),
    pairDistances,
  };
}

function mean(values: readonly Vec2[]): Vec2;
function mean(values: readonly number[]): number;
function mean(values: readonly Vec2[] | readonly number[]): Vec2 | number {
  if (typeof values[0] === "number") return (values as readonly number[]).reduce((sum, value) => sum + value / values.length, 0);
  return (values as readonly Vec2[]).reduce(
    (sum, value) => ({ x: sum.x + value.x / values.length, y: sum.y + value.y / values.length }),
    { x: 0, y: 0 },
  );
}

function rms(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value / values.length, 0));
}

function subtract(left: Vec2, right: Vec2): Vec2 { return { x: left.x - right.x, y: left.y - right.y }; }
function length(value: Vec2): number { return Math.hypot(value.x, value.y); }
