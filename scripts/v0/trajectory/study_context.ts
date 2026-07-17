/**
 * Shared frozen-prefix preparation for trajectory studies.
 *
 * The function validates the declared source/transform/prefix contract before
 * returning an immutable engine and target-frame state. It is intentionally
 * study-only: no compiler candidate source imports this module.
 */
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import { fingerprintFiles } from "../benchmark_v2/suite_model.ts";
import { MIN_LANDING_AIRBORNE_FRAMES } from "../../lib/detector.ts";
import { setForwardEvalContext } from "../optimizer/handoff.ts";
import { getCandidateProbe, type CandidateProbe, type SpecContext } from "../optimizer/sample.ts";
import type { Gap } from "../types.ts";
import {
  deriveSupportEnvelopeIntent,
  type IncomingTargetFrame,
  type SupportEnvelopeIntent,
} from "./envelope/model.ts";
import { sha256, stableJson, type FrozenTrajectoryFixture } from "./frozen_fixture.ts";
import { outgoingIntervalFromGap } from "./outgoing_interval.ts";
import {
  buildTrajectoryPanelSetup,
  assertActiveTrajectoryPanel,
  assertTrajectoryCalibrationProtocol,
  getTrajectoryPanelCase,
  materializeTrajectoryPanelInput,
} from "./panel.ts";
import {
  buildRecursiveTransientHeldoutSetup,
  getRecursiveTransientHeldoutCase,
} from "./recursive_transient_heldout_panel.ts";
import {
  buildRecursiveTransientFourControlSetup,
  getRecursiveTransientFourControlCase,
} from "./recursive_transient_four_control_panel.ts";
import {
  buildAcceleratedTransientHeldoutSetup,
  getAcceleratedTransientHeldoutCase,
} from "./accelerated_transient_heldout_panel.ts";
import {
  buildCompactForceComparisonSetup,
  getCompactForceComparisonCase,
} from "./compact_force_comparison_panel.ts";
import type { TrajectoryCaptureCase, TrajectoryCaptureSetup } from "./capture_input.ts";
import { extractPlanningState, type PlanningState } from "./state.ts";
import { rebuildPhysicalPrefixEngine } from "./study_fixture.ts";
import { activeStudyEngine } from "./study_runtime.ts";
import { targetFrameFromPlanningState } from "./target_frame.ts";

/**
 * Validated frozen physical state with no interpretation of outgoing support
 * policy.  State-coupled studies use this form so historical envelope planning
 * cannot become an accidental input to a new formulation.
 */
export type PreparedTrajectoryFixtureCore = {
  fixture: {
    captureBudget: number;
    captureEngine: string;
    captureEnvironment: Record<string, string>;
    baselineContractPassed: boolean;
    baselineScore: number;
    baselineDeepestGap: number | null;
  };
  panel: {
    id: string;
    cohort: "calibration" | "validation" | "quarantined";
    category: "dense" | "ordinary" | "low_air";
    sourcePath: string;
    seed: number;
    currentGap: number;
    outgoingGap: number;
    currentFrame: number;
    outgoingFrame: number;
    outgoingIntervalFrames: number;
    expectedOutgoingFrames: number | null;
  };
  setup: TrajectoryCaptureSetup;
  ctx: SpecContext;
  // deno-lint-ignore no-explicit-any
  engine: any;
  current: Gap;
  outgoing: Gap;
  lineIdStart: number;
  probe: CandidateProbe;
  state: PlanningState;
  frame: IncomingTargetFrame;
  replay: {
    physicalPrefixFingerprint: string;
    targetPlanningStateFingerprint: string;
    targetProbeStateFingerprint: string;
    preTargetSledTraceFingerprint: string;
    matches: true;
  };
};

/** Legacy-envelope studies additionally request this historical intent. */
export type PreparedTrajectoryFixture = PreparedTrajectoryFixtureCore & {
  intent: SupportEnvelopeIntent;
};

function prepareFrozenTrajectoryFixtureCore(input: FrozenTrajectoryFixture): PreparedTrajectoryFixtureCore {
  if (input.schema === "line.frozen-trajectory-prefix.v3" && !input.capture.identityCheck.stable) {
    throw new Error("forensic V3 fixture has source or compiler identity drift and cannot be replayed as study input");
  }
  const { panel, setup } = resolveFixturePanel(input);
  const materialized = materializeTrajectoryPanelInput(setup);
  const sourceFingerprint = fingerprintFiles([panel.sourcePath]);
  const transformFingerprint = sha256(stableJson(benchmarkPolicy.transform));
  const materializedFingerprint = sha256(stableJson(materialized));
  if (input.panel.sourcePath !== panel.sourcePath || input.panel.sourceFingerprint !== sourceFingerprint) {
    throw new Error("fixture source input no longer matches its declared panel");
  }
  assertFixturePanelDeclaration(input.panel, panel);
  if (input.transform.fingerprint !== transformFingerprint) {
    throw new Error("fixture transform no longer matches the active panel transform");
  }
  if (input.materializedFingerprint !== materializedFingerprint || stableJson(input.materialized) !== stableJson(materialized)) {
    throw new Error("fixture materialized targets no longer match the declared source and seed");
  }
  const engineName = activeStudyEngine();
  if (input.capture.runtime.engine !== engineName) {
    throw new Error(`fixture engine ${input.capture.runtime.engine} does not match active ${engineName}`);
  }
  if (stableJson(input.capture.runtime.relevantEnvironment) !== stableJson(relevantEnvironment())) {
    throw new Error("fixture LR_* environment does not match the active study environment");
  }
  const current = setup.gaps[panel.targetGap];
  const outgoing = setup.gaps[panel.targetGap + 1];
  if (
    current === undefined || outgoing === undefined ||
    current.index !== panel.targetGap ||
    !current.endsWithContact || !outgoing.endsWithContact ||
    outgoing.startFrame !== current.endFrame
  ) {
    throw new Error("fixture target/outgoing gap contract no longer matches the declared panel");
  }
  const outgoingIntervalFrames = outgoing.endFrame - outgoing.startFrame;
  if (!Number.isSafeInteger(outgoingIntervalFrames) || outgoingIntervalFrames < 0) {
    throw new Error("fixture outgoing interval has invalid frame bounds");
  }
  assertFixtureTargetFrames(input.panel, panel, current, outgoing, outgoingIntervalFrames);
  if (input.physicalPrefix.gapIndex !== current.index) {
    throw new Error("fixture physical prefix does not end at the declared current gap");
  }
  if (sha256(stableJson(input.physicalPrefix)) !== input.physicalPrefixFingerprint) {
    throw new Error("fixture physical-prefix fingerprint does not match its payload");
  }

  setForwardEvalContext(setup.spec, setup.gapAxisTargets);
  const ctx: SpecContext = {
    allContactFrames: setup.allContactFrames,
    durationFrames: setup.durationFrames,
    gapAxisTargets: setup.gapAxisTargets,
  };
  const engine = rebuildPhysicalPrefixEngine(input.physicalPrefix);
  const state = extractPlanningState(engine, current.endFrame);
  if (state === null || sha256(stableJson(state)) !== input.checkpoints.targetPlanningStateFingerprint) {
    throw new Error("frozen physical prefix does not replay its target planning state");
  }
  const probe = getCandidateProbe(engine, current, ctx);
  const trace = probe.preTargetSledTrace();
  if (
    sha256(stableJson(probe.targetState)) !== input.checkpoints.targetProbeStateFingerprint ||
    sha256(stableJson(trace)) !== input.checkpoints.preTargetSledTraceFingerprint
  ) {
    throw new Error("frozen physical prefix does not replay its target probe checkpoint");
  }
  const frame = targetFrameFromPlanningState(state);
  return {
    fixture: {
      captureBudget: input.capture.captureBudget,
      captureEngine: input.capture.runtime.engine,
      captureEnvironment: { ...input.capture.runtime.relevantEnvironment },
      baselineContractPassed: input.baseline.contractPassed,
      baselineScore: input.baseline.score,
      baselineDeepestGap: input.baseline.deepestGap,
    },
    panel: {
      id: panel.id,
      cohort: panel.cohort,
      category: panel.category,
      sourcePath: panel.sourcePath,
      seed: panel.seed,
      currentGap: current.index,
      outgoingGap: outgoing.index,
      currentFrame: current.endFrame,
      outgoingFrame: outgoing.endFrame,
      outgoingIntervalFrames,
      expectedOutgoingFrames: panel.expectedOutgoingFrames ?? null,
    },
    setup,
    ctx,
    engine,
    current,
    outgoing,
    lineIdStart: input.physicalPrefix.prefixNextLineId,
    probe,
    state,
    frame,
    replay: {
      physicalPrefixFingerprint: input.physicalPrefixFingerprint,
      targetPlanningStateFingerprint: input.checkpoints.targetPlanningStateFingerprint,
      targetProbeStateFingerprint: input.checkpoints.targetProbeStateFingerprint,
      preTargetSledTraceFingerprint: input.checkpoints.preTargetSledTraceFingerprint,
      matches: true,
    },
  };
}

/**
 * Historical envelope studies retain their explicit support-intent adapter.
 * It intentionally sits outside the physical fixture preparation used by the
 * measured-state formulation.
 */
export function prepareFrozenTrajectoryFixture(input: FrozenTrajectoryFixture): PreparedTrajectoryFixture {
  const prepared = prepareFrozenTrajectoryFixtureCore(input);
  const intent = deriveSupportEnvelopeIntent(
    outgoingIntervalFromGap(prepared.outgoing),
    prepared.frame.speedPxPerFrame,
    MIN_LANDING_AIRBORNE_FRAMES,
  );
  return { ...prepared, intent };
}

/** Prepare a fixture under the one declared comparable calibration protocol. */
export function prepareComparableTrajectoryFixture(input: FrozenTrajectoryFixture): PreparedTrajectoryFixture {
  const prepared = prepareFrozenTrajectoryFixture(input);
  assertTrajectoryCalibrationProtocol({
    engine: prepared.fixture.captureEngine,
    captureBudget: prepared.fixture.captureBudget,
    relevantEnvironment: prepared.fixture.captureEnvironment,
  }, "trajectory calibration fixture");
  return prepared;
}

/**
 * Comparable preparation for exact state-shot studies.  This deliberately
 * stops at the physical prefix/state contract and does not construct an
 * outgoing-envelope intent.
 */
export function prepareStateCoupledTrajectoryFixture(
  input: FrozenTrajectoryFixture,
): PreparedTrajectoryFixtureCore {
  const prepared = prepareFrozenTrajectoryFixtureCore(input);
  assertTrajectoryCalibrationProtocol({
    engine: prepared.fixture.captureEngine,
    captureBudget: prepared.fixture.captureBudget,
    relevantEnvironment: prepared.fixture.captureEnvironment,
  }, "state-coupled trajectory fixture");
  return prepared;
}

export function assertFixturePanelDeclaration(
  input: FrozenTrajectoryFixture["panel"],
  panel: TrajectoryCaptureCase,
): void {
  if (
    input.cohort !== panel.cohort ||
    input.selectionRationale !== panel.selectionRationale ||
    input.publicSeed !== panel.seed ||
    input.requestedTargetGap !== panel.targetGap ||
    input.selectedTargetGap !== panel.targetGap ||
    input.outgoingGap !== panel.targetGap + 1 ||
    input.expectedOutgoingFrames !== (panel.expectedOutgoingFrames ?? null)
    || (input.studyScope ?? null) !== (panel.studyScope ?? null)
  ) {
    throw new Error("fixture panel selection declaration no longer matches its declared panel");
  }
}

function assertFixtureTargetFrames(
  input: FrozenTrajectoryFixture["panel"],
  panel: TrajectoryCaptureCase,
  current: Gap,
  outgoing: Gap,
  outgoingIntervalFrames: number,
): void {
  if (
    input.currentFrame !== current.endFrame ||
    input.outgoingFrame !== outgoing.endFrame ||
    input.outgoingIntervalFrames !== outgoingIntervalFrames ||
    (panel.expectedOutgoingFrames !== undefined && outgoingIntervalFrames !== panel.expectedOutgoingFrames)
  ) {
    throw new Error("fixture target/outgoing frame declaration no longer matches its declared panel");
  }
}

/** Resolve only the declared roster that owns an immutable fixture. */
function resolveFixturePanel(
  input: FrozenTrajectoryFixture,
): { panel: TrajectoryCaptureCase; setup: TrajectoryCaptureSetup } {
  if (input.panel.cohort === "validation" && input.panel.studyScope === "recursive-transient-heldout-v1") {
    const panel = getRecursiveTransientHeldoutCase(input.panel.id);
    return { panel, setup: buildRecursiveTransientHeldoutSetup(panel) };
  }
  if (input.panel.cohort === "validation" && input.panel.studyScope === "recursive-transient-distributed-four-v4") {
    const panel = getRecursiveTransientFourControlCase(input.panel.id);
    return { panel, setup: buildRecursiveTransientFourControlSetup(panel) };
  }
  if (input.panel.cohort === "validation" && input.panel.studyScope === "transient-accelerated-release-heldout-v1") {
    const panel = getAcceleratedTransientHeldoutCase(input.panel.id);
    return { panel, setup: buildAcceleratedTransientHeldoutSetup(panel) };
  }
  if (input.panel.cohort === "validation" && input.panel.studyScope === "transient-compact-force-comparison-v1") {
    const panel = getCompactForceComparisonCase(input.panel.id);
    return { panel, setup: buildCompactForceComparisonSetup(panel) };
  }
  const panel = getTrajectoryPanelCase(input.panel.id);
  assertActiveTrajectoryPanel(panel, "trajectory fixture replay");
  return { panel, setup: buildTrajectoryPanelSetup(panel) };
}

function relevantEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
      .map(([name, value]) => [name, value!])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}
