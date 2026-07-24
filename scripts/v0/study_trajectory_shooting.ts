/**
 * Observation-only contact-transition prototype study.
 *
 * This is deliberately not a compiler lane. It rebuilds a physical prefix,
 * proposes a small state-relative polyline family, and submits every proposal
 * to the existing exact evaluator. It does not fit a response surface, rank a
 * survivor pool, or resume a suffix: those operations would turn this small
 * falsification study into an unvalidated search policy.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import frontier4 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import frontier5 from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import frontier6 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts";
import frontier7 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  clearImpactTemplateMarker,
  snapshotArcPlacementStats,
} from "./arc_placement.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import {
  disableLandingWindowProbe,
  drainLandingWindowProbe,
  enableLandingWindowProbe,
  type LandingWindowProbeRecord,
} from "./landing_probe.ts";
import {
  compileHandoff,
  setForwardEvalContext,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import { nextContactGap } from "./optimizer/objective.ts";
import {
  getCandidateProbe,
  observeOneCandidate,
  type Candidate,
  type SpecContext,
} from "./optimizer/sample.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { scoreDriftReport } from "./score.ts";
import {
  CALIB,
  FPS,
  secToFrame,
  type AxisValues,
  type Gap,
  type Spec,
  type TrackLine,
} from "./types.ts";
import {
  deriveTrajectoryIntent,
  makeLowDiscrepancyControls,
  makePrototypeProbeControls,
  type ContactPrimitiveControl,
  type TrajectoryIntent,
} from "./trajectory/primitive.ts";
import { realizeContactPrimitive } from "./trajectory/realizer.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import {
  makePhysicalPrefixFixture,
  rebuildPhysicalPrefixEngine,
  type PhysicalPrefixFixture,
} from "./trajectory/study_fixture.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_trajectory_shooting.ts [--case=dense] [--seed=N] [--target-gap=N] [--budget=N]",
    "       [--phase-lookback=N] [--normal-attempts=N] [--out=FILE]",
    "",
    "Cases: dense, dense240, pickup, frontier4, frontier5, frontier6, frontier7, countercurrent, believer.",
    "The requested target must occur exactly on the selected physical prefix; there is no fallback.",
    "The legacy --normal-pool=N spelling is accepted as an alias for --normal-attempts=N.",
    "This study reports exact local admission only. It does not fit, select, or resume candidates.",
  ].join("\n") + "\n");
  process.exit(0);
}

type CaseSetup = {
  spec: Spec;
  sourcePath: string;
  seed: number;
  targetGap: number | null;
  /** Explicit outgoing interval assertion for duration-bound diagnostic rows. */
  expectedOutgoingFrames?: number;
};
const CASES: Record<string, CaseSetup> = {
  dense: {
    spec: dense,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
    seed: 3057130498,
    targetGap: 69,
  },
  dense240: {
    spec: dense240,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts",
    seed: 3057130496,
    targetGap: 86,
  },
  pickup: {
    spec: pickupShifted,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts",
    seed: 27,
    targetGap: 90,
  },
  frontier4: {
    spec: frontier4,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts",
    seed: 24,
    targetGap: 54,
    expectedOutgoingFrames: 160,
  },
  frontier5: {
    spec: frontier5,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
    seed: 24,
    targetGap: 54,
    expectedOutgoingFrames: 200,
  },
  frontier6: {
    spec: frontier6,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts",
    seed: 24,
    targetGap: 54,
    expectedOutgoingFrames: 240,
  },
  frontier7: {
    spec: frontier7,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts",
    seed: 24,
    targetGap: 54,
    expectedOutgoingFrames: 280,
  },
  countercurrent: {
    spec: countercurrent,
    sourcePath: "benchmark/v2/cases/normative/representative/countercurrent.ts",
    seed: 24,
    targetGap: null,
  },
  believer: {
    spec: believer,
    sourcePath: "benchmark/v2/cases/normative/development_music/believer_56_6s.ts",
    seed: 24,
    targetGap: null,
  },
};

const STUDY_SOURCE_FILES = [
  "scripts/v0/study_trajectory_shooting.ts",
  "scripts/v0/trajectory/primitive.ts",
  "scripts/v0/trajectory/realizer.ts",
  "scripts/v0/trajectory/state.ts",
  "scripts/v0/trajectory/study_fixture.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/optimizer/objective.ts",
  "scripts/v0/landing_probe.ts",
  "scripts/produce/seed.ts",
  "benchmark/v2/policy.ts",
  "scripts/v0/score.ts",
] as const;

const caseId = argument("case") ?? "dense";
const selectedCase = CASES[caseId];
if (selectedCase === undefined) throw new Error(`unknown --case=${caseId}`);
const seed = numberArgument("seed", selectedCase.seed);
const budget = numberArgument("budget", 250_000);
const targetGapArgument = argument("target-gap");
const targetGap = targetGapArgument === undefined
  ? selectedCase.targetGap
  : parseInteger("target-gap", targetGapArgument);
const phaseLookback = numberArgument("phase-lookback", 4);
const normalAttempts = numberArgument(
  "normal-attempts",
  numberArgument("normal-pool", 7),
);
const outPath = argument("out");
for (const [name, value] of Object.entries({ seed, budget, phaseLookback, normalAttempts })) {
  if (!Number.isSafeInteger(value) || value < 0 || (name === "budget" && value === 0)) {
    throw new Error(`invalid --${name}=${value}`);
  }
}
if (targetGap !== null && (!Number.isSafeInteger(targetGap) || targetGap < 0)) {
  throw new Error(`invalid --target-gap=${targetGap}`);
}

const spec = applyJolt(selectedCase.spec, benchmarkPolicy.transform.joltMs);
const setup = buildSetup(spec, seed);
setForwardEvalContext(setup.spec, setup.gapAxisTargets);
type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };
const visits: Visit[] = [];
const started = performance.now();
const baseline = compileHandoff(spec, seed, {
  budget,
  onNode(node, key, event) {
    visits.push({ node, key, event });
  },
});
const elapsedMs = performance.now() - started;
const baselineScore = scoreDriftReport(baseline.report, { totalFrames: Math.round(spec.duration * FPS) });
const deepest = deepestUnskippedVisit(visits);
if (deepest === null) throw new Error("baseline produced no unskipped prefix");
const defaultContactVisit = deepestContactVisit(visits, setup.gaps, deepest);
if (defaultContactVisit === null) throw new Error("baseline produced no eligible contact prefix");
const resolvedTargetGap = targetGap ?? defaultContactVisit.node.search.gapIndex;
const parentSelection = selectExactParentVisit(visits, deepest, resolvedTargetGap);
if (parentSelection === null) {
  throw new Error(`requested target gap ${resolvedTargetGap} is unavailable on the selected prefix`);
}
const parent = parentSelection.visit;
const gap = setup.gaps[parent.node.search.gapIndex];
if (gap === undefined || !gap.endsWithContact) {
  throw new Error(`gap ${parent.node.search.gapIndex} is not a contact gap`);
}
const outgoingGap = nextContactGap(gap, setup.gaps);
if (selectedCase.expectedOutgoingFrames !== undefined) {
  if (outgoingGap === null) throw new Error(`${caseId}: target g${gap.index} has no outgoing contact interval`);
  const observedOutgoingFrames = outgoingGap.endFrame - gap.endFrame;
  if (observedOutgoingFrames !== selectedCase.expectedOutgoingFrames) {
    throw new Error(
      `${caseId}: g${gap.index} outgoing interval is ${observedOutgoingFrames} frames, ` +
      `expected ${selectedCase.expectedOutgoingFrames}`,
    );
  }
}

// Treat a physical prefix as data, not as a live search-node capability. All
// study evaluations below use the rebuilt engine, proving their actual input.
const physicalPrefix = makePhysicalPrefixFixture(parent.node);
const physicalPrefixFingerprint = sha256(stableJson(physicalPrefix));
const originalProbe = getCandidateProbe(parent.node.search.prefixEngine, gap, setup.ctx);
const replayEngine = rebuildPhysicalPrefixEngine(physicalPrefix);
const replayProbe = getCandidateProbe(replayEngine, gap, setup.ctx);
assertSameTargetCheckpoint("physical-prefix replay", originalProbe.targetState, replayProbe.targetState);
const originalPreTargetTrace = originalProbe.preTargetSledTrace();
const replayPreTargetTrace = replayProbe.preTargetSledTrace();
assertSameNumberArray("physical-prefix pre-target trace", originalPreTargetTrace, replayPreTargetTrace);
const originalPhaseState = extractPlanningState(parent.node.search.prefixEngine, gap.endFrame - phaseLookback);
const phaseState = extractPlanningState(replayEngine, gap.endFrame - phaseLookback);
const originalContactAnchorState = extractPlanningState(parent.node.search.prefixEngine, gap.endFrame);
const contactAnchorState = extractPlanningState(replayEngine, gap.endFrame);
if (
  originalPhaseState === null || phaseState === null ||
  originalContactAnchorState === null || contactAnchorState === null
) {
  throw new Error(`unable to read planning state at g${gap.index}`);
}
assertSamePlanningState("physical-prefix phase replay", originalPhaseState, phaseState);
assertSamePlanningState("physical-prefix target replay", originalContactAnchorState, contactAnchorState);
const intent = deriveTrajectoryIntent(
  phaseState,
  gap,
  outgoingGap,
  contactAnchorState,
);
const materialized = materializedInput(setup);
const provenance = makeStudyProvenance({
  selectedCase,
  budget,
  resolvedTargetGap,
  gap,
  materialized,
  physicalPrefix,
  physicalPrefixFingerprint,
});

const prototypeControls = makePrototypeProbeControls(intent.center, intent.bounds);
if (normalAttempts !== prototypeControls.length) {
  throw new Error(
    `--normal-attempts must equal the ${prototypeControls.length} direct prototype controls ` +
    `for a fair local-admission comparison (got ${normalAttempts})`,
  );
}
const lowDiscrepancyControls = makeLowDiscrepancyControls(
  intent.center,
  intent.bounds,
  prototypeControls.length,
);
let prototypeRecords: DirectRecord[] = [];
let lowDiscrepancyRecords: DirectRecord[] = [];
let rawNormalRecords: RawNormalRecord[] = [];
enableLandingWindowProbe();
try {
  prototypeRecords = prototypeControls.map((control, index) => evaluateDirectPrimitive({
    family: "prototype_probe",
    index,
    control,
    engine: replayEngine,
    gap,
    setup,
    lineIdStart: physicalPrefix.prefixNextLineId,
    contactAnchorState,
    preTargetSledTrace: replayProbe.preTargetSledTrace,
  }));
  lowDiscrepancyRecords = lowDiscrepancyControls.map((control, index) => evaluateDirectPrimitive({
    family: "low_discrepancy_control",
    index,
    control,
    engine: replayEngine,
    gap,
    setup,
    lineIdStart: physicalPrefix.prefixNextLineId,
    contactAnchorState,
    preTargetSledTrace: replayProbe.preTargetSledTrace,
  }));
  rawNormalRecords = sampleRawNormalAttempts({
    engine: replayEngine,
    gap,
    setup,
    seed,
    count: normalAttempts,
    lineIdStart: physicalPrefix.prefixNextLineId,
  });
} finally {
  disableLandingWindowProbe();
}

const output = {
  schema: "line.study-trajectory-prototype.v3",
  purpose: [
    "Falsify a retired state-relative contact-polyline prototype under exact current-gap admission.",
    "Compare equal-count direct proposals with raw normal sampler calls while retaining every failure.",
    "Do not fit a response model, select a winner, or infer continuation quality.",
  ],
  status: {
    prototype: "retired: its entry residual moves the contact point and its probe design is clipped and one-sided.",
    prefixFixture: "current-prefix snapshot: replayed within this run, not a cross-revision frozen fixture.",
    primaryEndpoint: "base exact current-gap admission stage only",
  },
  case: caseId,
  seed,
  budget,
  phaseLookback,
  normalAttempts,
  elapsedMs: round(elapsedMs),
  provenance,
  baseline: {
    valid: baselineScore.contract_passed,
    score: round(baselineScore.score),
    deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
    requestedTargetGap: resolvedTargetGap,
    selectedTargetGap: parent.node.search.gapIndex,
    exactTargetPrefix: parentSelection.exact,
    parentSimFrames: parent.event.simFrames,
  },
  selectedPrefix: {
    localStudyEligible: true,
    reason: "The selected target is an exact unskipped node on the deepest current search path; the full track may still fail later.",
    globalFinalContractPassed: baselineScore.contract_passed,
    outgoingInterval: outgoingGap === null ? null : {
      gapIndex: outgoingGap.index,
      frames: outgoingGap.endFrame - gap.endFrame,
      expectedFrames: selectedCase.expectedOutgoingFrames ?? null,
    },
    physicalReplay: {
      targetCheckpointMatches: true,
      preTargetTraceFingerprint: sha256(stableJson(replayPreTargetTrace)),
      phaseStateFingerprint: sha256(stableJson(phaseState)),
      targetStateFingerprint: sha256(stableJson(contactAnchorState)),
    },
  },
  materialized,
  physicalPrefix,
  physicalPrefixFingerprint,
  fixtureReplay: {
    targetCheckpointMatches: true,
    targetFrame: summarizeTargetFrame(replayProbe.targetState),
    preTargetTraceFingerprint: sha256(stableJson(replayPreTargetTrace)),
    phaseStateFingerprint: sha256(stableJson(phaseState)),
    targetStateFingerprint: sha256(stableJson(contactAnchorState)),
  },
  planningState: summarizeState(phaseState),
  contactAnchorState: summarizeState(contactAnchorState),
  intent: summarizeIntent(intent),
  controlCoverage: {
    prototype: summarizeControlCoverage(prototypeControls, intent.bounds),
    lowDiscrepancy: summarizeControlCoverage(lowDiscrepancyControls, intent.bounds),
  },
  responseModel: {
    enabled: false,
    reason: "The prior six-control response fit was underdetermined and unvalidated; this study intentionally emits no proposals from observations.",
  },
  comparisons: {
    directPrototype: prototypeRecords,
    lowDiscrepancyControl: lowDiscrepancyRecords,
    rawNormalAttempts: rawNormalRecords,
  },
  aggregate: {
    directPrototype: aggregateRecords(prototypeRecords),
    lowDiscrepancyControl: aggregateRecords(lowDiscrepancyRecords),
    rawNormalAttempts: aggregateRecords(rawNormalRecords),
  },
  caveats: [
    "The retired direct prototype is not the target-frame contact-strip design. A failure here does not count against that replacement direction.",
    "Raw normal rows are one call each to the same atomic sampler and preserve null outcomes; they are not survivor-sorted pool rows.",
    "Direct rows disable optional legacy ride-out polish. Raw normal rows disclose their generated and returned geometry separately; final cost, axes, and release fields are descriptive only, never the primary endpoint.",
    "No unspecified axis is invented by this study. The envelope contract is studied separately from this near-contact primitive.",
  ],
};
const json = `${JSON.stringify(output, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  console.error(`study -> ${outPath}`);
}

type EvaluationStage = "accepted" | "preclear" | "survival" | "landing" | "offbeat" | "unknown";
type Counter = ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"];
type CandidateSummary = {
  cost: number;
  achieved: AxisValues;
  finalLineCount: number;
  finalLineHash: string;
  geometry: Candidate["geometry"];
  release: ReturnType<typeof summarizeRelease>;
};
type CommonRecord = {
  index: number;
  stage: EvaluationStage;
  counters: Record<string, number>;
  landingProbe: ReturnType<typeof summarizeLandingProbe>;
  landingProbeDropped: number;
  finalCandidate: CandidateSummary | null;
};
type DirectRecord = CommonRecord & {
  family: "prototype_probe" | "low_discrepancy_control";
  control: Record<string, number>;
  proposed: {
    lineCount: number;
    lineHash: string;
    supportLengthPx: number;
  };
  rideOutPolish: "disabled";
};
type RawNormalRecord = CommonRecord & {
  family: "raw_normal";
  sampleAttempt: number;
  proposed: {
    lineCount: number;
    lineHash: string;
  };
  rideOutPolish: "not_applicable" | "none" | "legacy_rideout";
};

function evaluateDirectPrimitive(input: {
  family: DirectRecord["family"];
  index: number;
  control: ContactPrimitiveControl;
  // deno-lint-ignore no-explicit-any
  engine: any;
  gap: Gap;
  setup: ReturnType<typeof buildSetup>;
  lineIdStart: number;
  contactAnchorState: PlanningState;
  preTargetSledTrace: () => number[];
}): DirectRecord {
  const realized = realizeContactPrimitive(input.contactAnchorState, input.control, input.lineIdStart);
  clearImpactTemplateMarker();
  drainLandingWindowProbe();
  const before = snapshotArcPlacementStats().by_sample_mode.normal;
  const fit = tryCandidateLines(
    input.engine,
    input.gap,
    realized.lines,
    input.lineIdStart,
    input.setup.ctx.allContactFrames,
    axisLookaheadEndFrame(input.gap, input.setup.ctx.allContactFrames),
    input.gap.targets,
    true,
    "normal",
    input.preTargetSledTrace,
    { allowRideOutPolish: false },
  ) as Candidate | null;
  const after = snapshotArcPlacementStats().by_sample_mode.normal;
  const probe = drainLandingWindowProbe();
  return {
    family: input.family,
    index: input.index,
    control: roundControl(input.control),
    proposed: {
      lineCount: realized.lines.length,
      lineHash: lineHash(realized.lines),
      supportLengthPx: round(lineLength(realized.lines.slice(1))),
    },
    stage: fit === null ? failureStage(before, after) : "accepted",
    counters: counterDelta(before, after),
    landingProbe: summarizeLandingProbe(probe.records),
    landingProbeDropped: probe.dropped,
    finalCandidate: summarizeCandidate(fit),
    rideOutPolish: "disabled",
  };
}

function sampleRawNormalAttempts(input: {
  // deno-lint-ignore no-explicit-any
  engine: any;
  gap: Gap;
  setup: ReturnType<typeof buildSetup>;
  seed: number;
  count: number;
  lineIdStart: number;
}): RawNormalRecord[] {
  const rng = makeRng((Math.imul(input.seed | 0, 1_000_003) + input.gap.index + 1) | 0);
  const records: RawNormalRecord[] = [];
  for (let attempt = 0; attempt < input.count; attempt++) {
    clearImpactTemplateMarker();
    drainLandingWindowProbe();
    const before = snapshotArcPlacementStats().by_sample_mode.normal;
    const observed = observeOneCandidate(
      input.engine,
      input.gap,
      rng,
      input.setup.ctx,
      input.lineIdStart,
      attempt,
    );
    const fit = observed.fit;
    const after = snapshotArcPlacementStats().by_sample_mode.normal;
    const probe = drainLandingWindowProbe();
    records.push({
      family: "raw_normal",
      index: attempt,
      sampleAttempt: attempt,
      proposed: {
        lineCount: observed.geometry.lines.length,
        lineHash: lineHash(observed.geometry.lines),
      },
      stage: fit === null ? failureStage(before, after) : "accepted",
      counters: counterDelta(before, after),
      landingProbe: summarizeLandingProbe(probe.records),
      landingProbeDropped: probe.dropped,
      finalCandidate: summarizeCandidate(fit),
      rideOutPolish: fit === null
        ? "not_applicable"
        : sameLineGeometry(fit.lines, observed.geometry.lines) ? "none" : "legacy_rideout",
    });
  }
  return records;
}

function aggregateRecords(records: readonly CommonRecord[]) {
  const count = (stage: EvaluationStage) => records.filter((record) => record.stage === stage).length;
  return {
    attempted: records.length,
    accepted: count("accepted"),
    preclear: count("preclear"),
    survival: count("survival"),
    landing: count("landing"),
    offbeat: count("offbeat"),
    unknown: count("unknown"),
    probeRecordsDropped: records.reduce((sum, record) => sum + record.landingProbeDropped, 0),
  };
}

function summarizeCandidate(fit: Candidate | null): CandidateSummary | null {
  if (fit === null) return null;
  return {
    cost: round(fit.cost),
    achieved: roundAxes(fit.achieved),
    finalLineCount: fit.lines.length,
    finalLineHash: lineHash(fit.lines),
    geometry: fit.geometry,
    release: summarizeRelease(fit),
  };
}

function summarizeRelease(fit: Candidate): {
  frame: number;
  vx: number;
  vy: number;
  airborne: boolean;
  grounded: number;
  poseDeg: number | null;
  poseRateDegPerFrame: number | null;
} | null {
  const launch = fit.ballisticLaunch;
  const release = launch?.state;
  return release === undefined ? null : {
    frame: launch!.anchorFrame,
    vx: round(release.vx),
    vy: round(release.vy),
    airborne: launch!.airborne,
    grounded: launch!.groundedFrames,
    poseDeg: release.sledPoseDeg === null ? null : round(release.sledPoseDeg),
    poseRateDegPerFrame: release.sledPoseRateDegPerFrame === null
      ? null
      : round(release.sledPoseRateDegPerFrame),
  };
}

function failureStage(before: Counter, after: Counter): Exclude<EvaluationStage, "accepted"> {
  if (after.preclear_rejected > before.preclear_rejected) return "preclear";
  if (after.direct_survival_failed > before.direct_survival_failed) return "survival";
  if (after.direct_offbeat_failed > before.direct_offbeat_failed) return "offbeat";
  if (after.direct_landing_failed > before.direct_landing_failed) return "landing";
  return "unknown";
}

function buildSetup(userSpec: Spec, publicSeed: number): {
  spec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  ctx: SpecContext;
} {
  const feasibleContacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5);
  const normalized: Spec = { ...userSpec, preroll: undefined, contacts: feasibleContacts };
  const durationFrames = secToFrame(normalized.duration);
  const contactFrames = normalized.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const gapAxisTargets = gaps.map((candidate) => effectiveAxes(candidate, normalized));
  const rng = makeRng(publicSeed);
  for (const candidate of gaps) {
    candidate.targets = sampleGapTargets(gapAxisTargets[candidate.index], normalized.jitter ?? CALIB.SIGMA, rng);
  }
  const impactByFrame = new Map(
    normalized.contacts.flatMap((contact) => contact.impact === undefined
      ? []
      : [[secToFrame(contact.t), contact.impact] as const]),
  );
  for (const candidate of gaps) {
    const impact = impactByFrame.get(candidate.endFrame);
    if (!candidate.endsWithContact || impact === undefined) continue;
    candidate.targets.impact = impact;
    gapAxisTargets[candidate.index].impact = impact;
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const next = gaps[index + 1];
    if (gaps[index].endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      gaps[index].nextImpact = next.targets.impact;
    }
  }
  return {
    spec: normalized,
    gaps,
    gapAxisTargets,
    ctx: { allContactFrames: contactFrames, durationFrames, gapAxisTargets },
  };
}

function materializedInput(setup: ReturnType<typeof buildSetup>) {
  return {
    contactFrames: [...setup.ctx.allContactFrames],
    durationFrames: setup.ctx.durationFrames,
    gaps: setup.gaps.map((candidate) => ({
      index: candidate.index,
      startFrame: candidate.startFrame,
      endFrame: candidate.endFrame,
      endsWithContact: candidate.endsWithContact,
      targets: { ...candidate.targets },
      nextImpact: candidate.nextImpact ?? null,
    })),
    gapAxisTargets: setup.gapAxisTargets.map((targets) => ({ ...targets })),
  };
}

function deepestUnskippedVisit(visits: readonly Visit[]): Visit | null {
  return visits.reduce<Visit | null>((best, record) =>
    record.node.skippedContacts === 0 &&
      (best === null || record.node.search.gapIndex > best.node.search.gapIndex)
      ? record
      : best,
    null,
  );
}

function deepestContactVisit(
  visits: readonly Visit[],
  gaps: readonly Gap[],
  deepest: Visit,
): Visit | null {
  return visits.reduce<Visit | null>((best, record) =>
    record.node.skippedContacts === 0 &&
      gaps[record.node.search.gapIndex]?.endsWithContact === true &&
      isPrefix(record.node.search.prefixFits, deepest.node.search.prefixFits) &&
      (best === null || record.node.search.gapIndex > best.node.search.gapIndex)
      ? record
      : best,
    null,
  );
}

function selectExactParentVisit(
  visits: readonly Visit[],
  deepest: Visit,
  target: number,
): { visit: Visit; exact: true } | null {
  const exact = visits.filter((record) =>
    record.node.skippedContacts === 0 &&
      record.node.search.gapIndex === target &&
      isPrefix(record.node.search.prefixFits, deepest.node.search.prefixFits),
  ).at(-1);
  return exact === undefined ? null : { visit: exact, exact: true };
}

function isPrefix<T>(prefix: readonly T[], whole: readonly T[]): boolean {
  return prefix.length <= whole.length && prefix.every((item, index) => item === whole[index]);
}

function makeStudyProvenance(input: {
  selectedCase: CaseSetup;
  budget: number;
  resolvedTargetGap: number;
  gap: Gap;
  materialized: ReturnType<typeof materializedInput>;
  physicalPrefix: PhysicalPrefixFixture;
  physicalPrefixFingerprint: string;
}) {
  const engine = process.env.LR_ENGINE ?? "js";
  const compiler = compilerCandidateIdentity(engine);
  const materializedFingerprint = sha256(stableJson(input.materialized));
  const studySourceFingerprint = fingerprintFiles(STUDY_SOURCE_FILES);
  const identity = {
    argv: [...argv],
    runtime: { node: process.version, engine },
    budget: input.budget,
    case: {
      sourcePath: input.selectedCase.sourcePath,
      sourceFingerprint: fingerprintFiles([input.selectedCase.sourcePath]),
      requestedTargetGap: input.resolvedTargetGap,
      selectedTargetGap: input.gap.index,
      targetFrame: input.gap.endFrame,
    },
    transform: {
      value: benchmarkPolicy.transform,
      fingerprint: sha256(stableJson(benchmarkPolicy.transform)),
    },
    materializedFingerprint,
    physicalPrefix: {
      schema: input.physicalPrefix.schema,
      fingerprint: input.physicalPrefixFingerprint,
      committedFits: input.physicalPrefix.prefixFitLines.length,
      prefixNextLineId: input.physicalPrefix.prefixNextLineId,
    },
    compiler: {
      head: compiler.head,
      compilerDiffSha256: compiler.compilerDiffSha256,
      compilerSourceFingerprint: compiler.compilerSourceFingerprint,
      candidateFingerprint: compiler.candidateFingerprint,
      engineArtifactFingerprint: compiler.engineArtifactFingerprint,
      compilerEnvironment: compiler.compilerEnvironment,
      trackedChanges: compiler.trackedChanges,
    },
    studySourceFingerprint,
  };
  return {
    ...identity,
    studySourceFiles: [...STUDY_SOURCE_FILES],
    fingerprint: sha256(stableJson(identity)),
  };
}

function assertSameTargetCheckpoint(
  label: string,
  left: { sledX: number; sledY: number; speed: number; angleDeg: number; velocity: { x: number; y: number } },
  right: { sledX: number; sledY: number; speed: number; angleDeg: number; velocity: { x: number; y: number } },
): void {
  for (const key of ["sledX", "sledY", "speed", "angleDeg"] as const) {
    if (Math.abs(left[key] - right[key]) > 1e-9) {
      throw new Error(`${label} changed ${key}`);
    }
  }
  for (const key of ["x", "y"] as const) {
    if (Math.abs(left.velocity[key] - right.velocity[key]) > 1e-9) {
      throw new Error(`${label} changed velocity.${key}`);
    }
  }
}

function assertSameNumberArray(label: string, left: readonly number[], right: readonly number[]): void {
  if (left.length !== right.length) throw new Error(`${label} changed length`);
  for (let index = 0; index < left.length; index++) {
    if (Math.abs(left[index] - right[index]) > 1e-9) {
      throw new Error(`${label} changed at ${index}`);
    }
  }
}

function assertSamePlanningState(label: string, left: PlanningState, right: PlanningState): void {
  if (stableJson(left) !== stableJson(right)) throw new Error(`${label} changed`);
}

function summarizeState(state: PlanningState) {
  return {
    frame: state.frame,
    position: roundPoint(state.position),
    velocity: roundPoint(state.velocity),
    speed: round(state.speed),
    velocityAngleDeg: round(state.velocityAngleDeg),
    reference: roundPoint(state.reference),
    sledPoseDeg: state.sledPoseDeg === null ? null : round(state.sledPoseDeg),
    sledPoseRateDegPerFrame: state.sledPoseRateDegPerFrame === null
      ? null
      : round(state.sledPoseRateDegPerFrame),
    phase: { ...state.phase },
  };
}

function summarizeTargetFrame(value: {
  sledX: number;
  sledY: number;
  speed: number;
  angleDeg: number;
  velocity: { x: number; y: number };
}) {
  return {
    reference: roundPoint({ x: value.sledX, y: value.sledY }),
    speed: round(value.speed),
    headingDeg: round(value.angleDeg),
    velocity: roundPoint(value.velocity),
  };
}

function summarizeIntent(intent: TrajectoryIntent) {
  return {
    nextSpanFrames: intent.nextSpanFrames,
    authoredAirTarget: intent.authoredAirTarget === null ? null : round(intent.authoredAirTarget),
    authoredFlightFrames: intent.authoredFlightFrames === null ? null : round(intent.authoredFlightFrames),
    supportPriorFrames: round(intent.supportPriorFrames),
    impactTurnDeg: round(intent.impactTurnDeg),
    center: roundControl(intent.center),
    bounds: intent.bounds,
  };
}

function summarizeLandingProbe(records: readonly LandingWindowProbeRecord[]) {
  return records.map((record) => ({
    failure: record.failure ?? null,
    acceptedAtW: record.acceptedAtW,
    offset: record.offset,
    entryAngleDeg: record.entryAngleDeg === null ? null : round(record.entryAngleDeg),
    turnDeg: record.turnDeg === null ? null : round(record.turnDeg),
    isTemplate: record.isTemplate,
  }));
}

function counterDelta<T extends Record<string, number>>(before: T, after: T): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, after[key] - before[key]]));
}

function lineHash(lines: readonly TrackLine[]): string {
  return sha256(stableJson(lines.map((line) => ({
    id: line.id,
    type: line.type,
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
    flipped: Boolean(line.flipped),
    leftExtended: Boolean(line.leftExtended),
    rightExtended: Boolean(line.rightExtended),
  }))));
}

function lineLength(lines: readonly TrackLine[]): number {
  return lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0);
}

function sameLineGeometry(left: readonly TrackLine[], right: readonly TrackLine[]): boolean {
  return left.length === right.length && left.every((line, index) => {
    const other = right[index];
    return other !== undefined && line.id === other.id &&
      line.x1 === other.x1 && line.y1 === other.y1 &&
      line.x2 === other.x2 && line.y2 === other.y2;
  });
}

function summarizeControlCoverage(
  controls: readonly ContactPrimitiveControl[],
  bounds: TrajectoryIntent["bounds"],
) {
  const exactKeys = controls.map((control) => stableJson(control));
  const clippedControls = controls.filter((control) =>
    Object.entries(bounds).some(([key, range]) => {
      const value = control[key as keyof ContactPrimitiveControl];
      return value === range[0] || value === range[1];
    }),
  ).length;
  return {
    proposed: controls.length,
    unique: new Set(exactKeys).size,
    controlsAtAnyBound: clippedControls,
    controls: controls.map(roundControl),
  };
}

function roundAxes(axes: AxisValues): AxisValues {
  return Object.fromEntries(Object.entries(axes).map(([key, value]) => [key, round(value)]));
}

function roundControl(control: ContactPrimitiveControl): Record<string, number> {
  return Object.fromEntries(Object.entries(control).map(([key, value]) => [key, round(value)]));
}

function roundPoint(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function numberArgument(name: string, fallback: number): number {
  const value = argument(name);
  return value === undefined ? fallback : parseInteger(name, value);
}

function parseInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`invalid --${name}=${value}`);
  return parsed;
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    ).join(",")}}`;
  }
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error(`cannot fingerprint non-JSON value (${typeof value})`);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("cannot fingerprint non-finite number");
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
