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
import {
  makePhysicalPrefixFixtureAtGap,
  replayHandoffPrefix,
  rebuildPhysicalPrefixEngine,
  type PhysicalPrefixFixture,
} from "./study_fixture.ts";
import {
  PHYSICAL_PREFIX_DONOR_SELECTION_RULE,
  type PhysicalPrefixProjection,
} from "./prefix_projection_contract.ts";
import { extractPlanningState, type PlanningState } from "./state.ts";
import {
  materializeTrajectoryCaptureInput,
  type MaterializedTrajectoryCaptureInput,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";
import { sha256, stableJson } from "./postimpact_study_inputs.ts";

type Visit = { ordinal: number; node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };

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
  projection: PhysicalPrefixProjection;
  baseline: {
    contractPassed: boolean;
    score: number;
    deepestGap: number | null;
    /** Null when tail completion did not emit a standalone target callback. */
    targetPrefixSimFrames: number | null;
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
      visits.push({ ordinal: visits.length + 1, node, key, event });
    },
  });
  const deepest = deepestUnskippedVisit(visits);
  if (deepest === null) throw new Error(`${panel.id}: no unskipped prefix was captured`);
  if (panel.targetGap > deepest.node.search.gapIndex) {
    throw new Error(
      `${panel.id}: declared g${panel.targetGap} exceeds selected deepest clean path g${deepest.node.search.gapIndex}`,
    );
  }
  const current = setup.gaps[panel.targetGap];
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

  const physicalPrefix = makePhysicalPrefixFixtureAtGap(deepest.node, panel.targetGap);
  const physicalPrefixFingerprint = sha256(stableJson(physicalPrefix));
  const projectedSearch = replayHandoffPrefix(deepest.node, panel.targetGap);
  if (
    projectedSearch.prefixNextLineId !== physicalPrefix.prefixNextLineId ||
    projectedSearch.cumulativeCost !== physicalPrefix.cumulativeCost
  ) {
    throw new Error(`${panel.id}: projected prefix bookkeeping disagrees with its serialized fixture`);
  }
  const projectedPathEngine = projectedSearch.prefixEngine;
  const replayEngine = rebuildPhysicalPrefixEngine(physicalPrefix);
  const projectedPathProbe = getCandidateProbe(projectedPathEngine, current, {
    allContactFrames: setup.allContactFrames,
    durationFrames: setup.durationFrames,
    gapAxisTargets: setup.gapAxisTargets,
  });
  const replayProbe = getCandidateProbe(replayEngine, current, {
    allContactFrames: setup.allContactFrames,
    durationFrames: setup.durationFrames,
    gapAxisTargets: setup.gapAxisTargets,
  });
  const targetPlanningState = requirePlanningState(projectedPathEngine, current.endFrame, `${panel.id} projected path`);
  const replayState = requirePlanningState(replayEngine, current.endFrame, `${panel.id} replay`);
  const preTargetSledTrace = projectedPathProbe.preTargetSledTrace();
  const replayTrace = replayProbe.preTargetSledTrace();
  assertStableEqual(`${panel.id} target planning state`, targetPlanningState, replayState);
  assertStableEqual(`${panel.id} target probe state`, projectedPathProbe.targetState, replayProbe.targetState);
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
    targetProbeState: projectedPathProbe.targetState,
    preTargetSledTrace: [...preTargetSledTrace],
    projection: {
      rule: PHYSICAL_PREFIX_DONOR_SELECTION_RULE,
      donorGap: deepest.node.search.gapIndex,
      donorPhase: deepest.event.phase,
      donorCallbackOrdinal: deepest.ordinal,
      donorSimFrames: deepest.event.simFrames,
      projectedTargetGap: panel.targetGap,
      directTargetCallbackOrdinal: deepest.node.search.gapIndex === panel.targetGap
        ? deepest.ordinal
        : null,
    },
    baseline: {
      contractPassed: report.contract_passed,
      score: round(report.score),
      deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
      targetPrefixSimFrames: deepest.node.search.gapIndex === panel.targetGap
        ? deepest.event.simFrames
        : null,
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
