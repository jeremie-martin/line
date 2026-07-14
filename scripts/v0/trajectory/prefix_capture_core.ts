/**
 * Shared physical-prefix capture algorithm.
 *
 * Entry points own their roster, provenance identity, and publication policy.
 * This core owns the compiler traversal and exact replay checks so a dedicated
 * validation capture cannot drift from the established prefix semantics.
 */
import { getCandidateProbe } from "../optimizer/sample.ts";
import {
  compileHandoff,
  setForwardEvalContext,
  type HandoffNode,
  type HandoffNodeEvent,
} from "../optimizer/handoff.ts";
import type { LeafKey } from "../optimizer/register.ts";
import { nextContactGap } from "../optimizer/objective.ts";
import { scoreDriftReport } from "../score.ts";
import { FPS, type Gap } from "../types.ts";
import { makePhysicalPrefixFixture, rebuildPhysicalPrefixEngine, type PhysicalPrefixFixture } from "./study_fixture.ts";
import { extractPlanningState, type PlanningState } from "./state.ts";
import {
  materializeTrajectoryCaptureInput,
  type MaterializedTrajectoryCaptureInput,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";
import { sha256, stableJson } from "./postimpact_study_inputs.ts";

type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };

export type CapturedTrajectoryPrefix = {
  current: Gap;
  outgoing: Gap;
  outgoingIntervalFrames: number;
  materialized: MaterializedTrajectoryCaptureInput;
  materializedFingerprint: string;
  physicalPrefix: PhysicalPrefixFixture;
  physicalPrefixFingerprint: string;
  targetPlanningState: PlanningState;
  targetProbeState: unknown;
  preTargetSledTrace: number[];
  baseline: {
    contractPassed: boolean;
    score: number;
    deepestGap: number | null;
    targetPrefixSimFrames: number;
  };
};

export function captureTrajectoryPrefix(
  panel: TrajectoryCaptureCase,
  setup: TrajectoryCaptureSetup,
  captureBudget: number,
): CapturedTrajectoryPrefix {
  setForwardEvalContext(setup.spec, setup.gapAxisTargets);
  const visits: Visit[] = [];
  const baseline = compileHandoff(setup.spec, panel.seed, {
    budget: captureBudget,
    onNode(node, key, event) {
      visits.push({ node, key, event });
    },
  });
  const deepest = deepestUnskippedVisit(visits);
  if (deepest === null) throw new Error(`${panel.id}: no unskipped prefix was captured`);
  const visit = exactVisitOnDeepestPath(visits, deepest, panel.targetGap);
  if (visit === null) {
    throw new Error(`${panel.id}: requested g${panel.targetGap} is not on the captured deepest path`);
  }
  const current = setup.gaps[visit.node.search.gapIndex];
  if (current === undefined || !current.endsWithContact) {
    throw new Error(`${panel.id}: selected g${panel.targetGap} is not a contact gap`);
  }
  const outgoing = nextContactGap(current, setup.gaps);
  if (outgoing === null || outgoing.startFrame !== current.endFrame || !outgoing.endsWithContact) {
    throw new Error(`${panel.id}: g${current.index} has no contiguous outgoing contact interval`);
  }
  const outgoingIntervalFrames = outgoing.endFrame - outgoing.startFrame;
  if (panel.expectedOutgoingFrames !== undefined && outgoingIntervalFrames !== panel.expectedOutgoingFrames) {
    throw new Error(
      `${panel.id}: outgoing interval ${outgoingIntervalFrames} != declared ${panel.expectedOutgoingFrames}`,
    );
  }

  const physicalPrefix = makePhysicalPrefixFixture(visit.node);
  const physicalPrefixFingerprint = sha256(stableJson(physicalPrefix));
  const originalEngine = visit.node.search.prefixEngine;
  const replayEngine = rebuildPhysicalPrefixEngine(physicalPrefix);
  const originalProbe = getCandidateProbe(originalEngine, current, {
    allContactFrames: setup.allContactFrames,
    durationFrames: setup.durationFrames,
    gapAxisTargets: setup.gapAxisTargets,
  });
  const replayProbe = getCandidateProbe(replayEngine, current, {
    allContactFrames: setup.allContactFrames,
    durationFrames: setup.durationFrames,
    gapAxisTargets: setup.gapAxisTargets,
  });
  const targetPlanningState = requirePlanningState(originalEngine, current.endFrame, `${panel.id} original`);
  const replayState = requirePlanningState(replayEngine, current.endFrame, `${panel.id} replay`);
  const preTargetSledTrace = originalProbe.preTargetSledTrace();
  const replayTrace = replayProbe.preTargetSledTrace();
  assertStableEqual(`${panel.id} target planning state`, targetPlanningState, replayState);
  assertStableEqual(`${panel.id} target probe state`, originalProbe.targetState, replayProbe.targetState);
  assertStableEqual(`${panel.id} pre-target sled trace`, preTargetSledTrace, replayTrace);

  const materialized = materializeTrajectoryCaptureInput(setup);
  const report = scoreDriftReport(baseline.report, { totalFrames: Math.round(setup.spec.duration * FPS) });
  return {
    current,
    outgoing,
    outgoingIntervalFrames,
    materialized,
    materializedFingerprint: sha256(stableJson(materialized)),
    physicalPrefix,
    physicalPrefixFingerprint,
    targetPlanningState,
    targetProbeState: originalProbe.targetState,
    preTargetSledTrace: [...preTargetSledTrace],
    baseline: {
      contractPassed: report.contract_passed,
      score: round(report.score),
      deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
      targetPrefixSimFrames: visit.event.simFrames,
    },
  };
}

function deepestUnskippedVisit(visits: readonly Visit[]): Visit | null {
  return visits.reduce<Visit | null>((best, record) =>
    record.node.skippedContacts === 0 &&
      (best === null || record.node.search.gapIndex > best.node.search.gapIndex)
      ? record
      : best,
  );
}

function exactVisitOnDeepestPath(
  visits: readonly Visit[],
  deepest: Visit,
  targetGap: number,
): Visit | null {
  return visits.filter((record) =>
    record.node.skippedContacts === 0 &&
      record.node.search.gapIndex === targetGap &&
      isPrefix(record.node.search.prefixFits, deepest.node.search.prefixFits),
  ).at(-1) ?? null;
}

function isPrefix<T>(prefix: readonly T[], whole: readonly T[]): boolean {
  return prefix.length <= whole.length && prefix.every((item, index) => item === whole[index]);
}

function requirePlanningState(engine: unknown, frame: number, label: string): PlanningState {
  const state = extractPlanningState(engine, frame);
  if (state === null) throw new Error(`${label}: unable to read planning state at frame ${frame}`);
  return state;
}

function assertStableEqual(label: string, left: unknown, right: unknown): void {
  if (stableJson(left) !== stableJson(right)) throw new Error(`${label}: physical replay mismatch`);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
