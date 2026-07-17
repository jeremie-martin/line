/**
 * Charged Two-Contact Shooting (calibration-only, WASM/500k).
 *
 * Declared in docs/compiler-improvement-campaign.md ("Declared Study: Charged
 * Two-Contact Shooting (2026-07-16)"). Question: from an exact committed prefix
 * at a dense/rung state, can a JOINTLY constructed pair -- an engine-admitted
 * catch at contact k and a chained catch at contact k+1 on the extended engine
 * -- close both contacts where the normal pool fails, at physics-frame cost
 * comparable to what the normal sampler spends failing?
 *
 * This is study-only code OUTSIDE the compiler identity boundary. It reads the
 * frozen fixtures and the shared primitives, but no compiler source imports it,
 * and it selects/promotes nothing. Admission at both contacts is the unchanged
 * `tryCandidateLines` (survival, +/-1-frame landings, no off-beat). Every row
 * retains both fits' outcomes and `getSimFrames()` charges per segment.
 */
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import {
  clearImpactTemplateMarker,
  sampleArcPlacementGeometry,
} from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import {
  airborneAt,
  contactLineIdsAt,
  engineLineFromTrackLine,
  type GapFit,
} from "./core/substrate.ts";
import { getCandidateProbe, type CandidateProbe, type SpecContext } from "./optimizer/sample.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import {
  disableLandingWindowProbe,
  drainLandingWindowProbe,
  enableLandingWindowProbe,
  type LandingWindowProbeRecord,
} from "./landing_probe.ts";
import { ELEVATION, type AxisValues, type Gap, type TrackLine } from "./types.ts";
import {
  realizeContactCaptureArc,
  resolveContactCaptureArc,
} from "./trajectory/contact_capture_arc.ts";
import { makeMirroredContactCaptureArcScreen } from "./trajectory/contact_capture_arc_design.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import {
  readFrozenTrajectoryFixture,
  sha256,
  stableJson,
  type FrozenTrajectoryFixture,
} from "./trajectory/frozen_fixture.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import {
  prepareStateCoupledTrajectoryFixture,
  type PreparedTrajectoryFixtureCore,
} from "./trajectory/study_context.ts";
import {
  studyArtifactIdentity,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./trajectory/study_artifact.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";

const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense: "dense-b500000-0552802c01e1.json",
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
} as const;
type StateId = keyof typeof FIXTURES;
type Family = "capture-arc" | "raw-normal";
const HELD_OUT_PANEL_IDS = [
  "heldout_open_hook_dense",
  "heldout_meter_exchange_ordinary",
  "heldout_pickup_low_air",
] as const;
const FOUR_CONTROL_HELD_OUT_PANEL_IDS = [
  "four_control_split_signal_dense",
  "four_control_wide_breaths_ordinary",
  "four_control_pickup_shifted_low_air",
] as const;
const DISTRIBUTED_FORWARD_FOUR_LABELS = new Set([
  "negative_distributed_half_frame_forward",
  "negative_distributed_one_frame_forward",
  "positive_distributed_half_frame_forward",
  "positive_distributed_one_frame_forward",
]);

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const argumentsFor = (name: string): string[] =>
  argv.filter((value) => value.startsWith(`--${name}=`)).map((value) => value.slice(name.length + 3));
const returnNormal = argv.includes("--return-normal");
const ballisticRelease = argv.includes("--ballistic-release");
const transientBridge = argv.includes("--transient-bridge");
const arrivalGateDiagnosis = argv.includes("--arrival-gates");
const recursiveTransient = argv.includes("--recursive-transient");
const recursiveReturn = argv.includes("--recursive-return");
const distributedForwardFour = argv.includes("--distributed-forward-four");
const heldOut = argv.includes("--held-out") || distributedForwardFour;
const CONTROL_MEMBER_COUNT = distributedForwardFour ? 4 : 24;
const SCHEMA = distributedForwardFour
  ? "line.study-recursive-transient-distributed-four-heldout.v1"
  : heldOut
  ? "line.study-recursive-transient-heldout.v1"
  : recursiveReturn
  ? "line.study-recursive-transient-k3-normal-return.v1"
  : recursiveTransient
  ? "line.study-recursive-transient-bridge.v1"
  : arrivalGateDiagnosis
  ? "line.study-transient-arrival-normal-gates.v1"
  : transientBridge
  ? "line.study-transient-c1-to-ballistic-bridge.v1"
  : ballisticRelease
  ? "line.study-capture-preserving-ballistic-release.v1"
  : returnNormal
  ? "line.study-two-contact-shooting-return-boundary.v1"
  : "line.study-two-contact-shooting.v1";

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_two_contact_shooting.ts [--case=dense|dense240|ordinary|all] [--return-normal] [--ballistic-release|--transient-bridge] [--arrival-gates|--recursive-transient|--recursive-return] [--out-dir=DIR]",
    "",
    "Charged two-contact shooting assay. Requires LR_ENGINE=wasm.",
    "Without --return-normal, writes the archived two-contact protocol under",
    "generated/studies/two-contact-shooting/v1/. The return-boundary mode",
    "materializes capture->capture pairs and measures the normal stream at k+2.",
    "--ballistic-release requires --return-normal and appends a finite launch scoop",
    "after the second exact capture before testing the k+2 normal stream.",
    "--transient-bridge requires --return-normal and replaces the second static",
    "C1 response with an immediate C1-to-ballistic contact bridge at k+1.",
    "--arrival-gates requires --transient-bridge and records the unchanged k+2",
    "normal stream's clearance/survival/landing-window gate outcome per attempt.",
    "--recursive-transient requires --transient-bridge and tests a third fixed",
    "transient component from the exact k+2 bridge arrival state.",
    "--recursive-return requires --recursive-transient and observes the unchanged",
    "k+3 normal stream from every byte-stable transient triple.",
    "--held-out requires exactly the three declared --fixture=PATH inputs and the",
    "recursive-return transient protocol; it accepts only the sealed validation roster.",
    "--distributed-forward-four is the fresh V4 held-out mode: it applies only",
    "the fixed mirrored distributed half/one-frame controls at every stage.",
  ].join("\n") + "\n");
  process.exit(0);
}

assertExactEnvironment();
const supportedOptions = ["--case=", "--fixture=", "--held-out", "--distributed-forward-four", "--out-dir=", "--return-normal", "--ballistic-release", "--transient-bridge", "--arrival-gates", "--recursive-transient", "--recursive-return", "--help", "-h"];
const unknownOptions = argv.filter((value) => !supportedOptions.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknownOptions.length > 0) throw new Error(`unsupported option(s): ${unknownOptions.join(", ")}`);
if ((ballisticRelease || transientBridge) && !returnNormal) {
  throw new Error("--ballistic-release and --transient-bridge require --return-normal");
}
if (ballisticRelease && transientBridge) {
  throw new Error("--ballistic-release and --transient-bridge are mutually exclusive");
}
if (arrivalGateDiagnosis && !transientBridge) {
  throw new Error("--arrival-gates requires --transient-bridge");
}
if (recursiveTransient && !transientBridge) {
  throw new Error("--recursive-transient requires --transient-bridge");
}
if (arrivalGateDiagnosis && recursiveTransient) {
  throw new Error("--arrival-gates and --recursive-transient are mutually exclusive");
}
if (recursiveReturn && !recursiveTransient) {
  throw new Error("--recursive-return requires --recursive-transient");
}
if (distributedForwardFour && argv.includes("--held-out")) {
  throw new Error("--distributed-forward-four is its own sealed held-out mode; do not combine it with --held-out");
}
if (distributedForwardFour && (!returnNormal || !transientBridge || !recursiveTransient || !recursiveReturn || ballisticRelease || arrivalGateDiagnosis)) {
  throw new Error("--distributed-forward-four requires --return-normal --transient-bridge --recursive-transient --recursive-return only");
}

const stateIds: readonly StateId[] = ["dense", "dense240", "ordinary"];
const heldOutFixturePaths = argumentsFor("fixture");
if (heldOut && (!returnNormal || !transientBridge || !recursiveTransient || !recursiveReturn || ballisticRelease || arrivalGateDiagnosis)) {
  throw new Error("--held-out requires --return-normal --transient-bridge --recursive-transient --recursive-return only");
}
const selected: readonly StateSelection[] = heldOut
  ? selectHeldOutFixtures(heldOutFixturePaths)
  : selectCalibrationFixtures(argument("case") ?? "all", heldOutFixturePaths);
const outDir = argument("out-dir") ?? (heldOut
  ? distributedForwardFour
    ? "generated/studies/two-contact-shooting/recursive-distributed-four-heldout-v1"
    : "generated/studies/two-contact-shooting/recursive-heldout-v1"
  : recursiveReturn
  ? "generated/studies/two-contact-shooting/recursive-return-v1"
  : recursiveTransient
  ? "generated/studies/two-contact-shooting/recursive-transient-v1"
  : arrivalGateDiagnosis
  ? "generated/studies/two-contact-shooting/transient-arrival-gates-v1"
  : transientBridge
  ? "generated/studies/two-contact-shooting/transient-bridge-v1"
  : ballisticRelease
  ? "generated/studies/two-contact-shooting/ballistic-release-v1"
  : returnNormal
  ? "generated/studies/two-contact-shooting/return-boundary-v1"
  : "generated/studies/two-contact-shooting/v1");

const sourceIdentity = studySourceIdentity("scripts/v0/study_two_contact_shooting.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "charged-two-contact-shooting.v1",
  captureBudget: 500_000,
  segment1Families: ["mirrored-24-control-capture-arc", "equal-count-raw-normal"],
  segment2Families: ["mirrored-24-control-capture-arc", "equal-count-raw-normal"],
  admission: "tryCandidateLines (survival, +/-1 landing, no off-beat; unchanged)",
  chaining: "engine.addLine(fit.lines) -> getCandidateProbe(outgoing) -> same screen at k+1",
  returnBoundary: returnNormal
    ? "capture->capture only; materialize both admitted line sets on the immutable k prefix; equal-count production-normal screen at k+2"
    : "disabled",
  ballisticRelease: ballisticRelease
    ? "after a sequentially admitted second C1 capture, append a finite concave hop scoop from its exact release speed to vy=-g*N/2, re-admit the complete second line set, then materialize and observe k+2"
    : "disabled",
  transientBridge: transientBridge
    ? "retain the first C1 capture, then derive a k+1 one-segment C1 approach and immediate three-segment concave ballistic launch from exact state; materialize and observe k+2"
    : "disabled",
  arrivalGateDiagnosis: arrivalGateDiagnosis
    ? "for every transient-bridge k+2 raw-normal member, use the existing study-only landing-window hook to classify preclear, survival, first lockstep acceptance width 1-5, or no acceptance through width 5"
    : "disabled",
  recursiveTransient: recursiveTransient
    ? "after materialized first-C1 plus k+1 transient pairs, derive the same fixed transient law from exact k+2 state and require one-shot triple materialization at k"
    : "disabled",
  recursiveReturn: recursiveReturn
    ? "for every byte-stable transient triple, observe the unchanged equal-count raw-normal stream from exact k+3 state"
    : "disabled",
  heldOut: heldOut
    ? distributedForwardFour
      ? "require exactly the sealed V4 distributed-four dense, ordinary, and low-air fixtures; no selection or outcome branch"
      : "require exactly the sealed dense, ordinary, and low-air recursive-transient-heldout-v1 V3 fixtures; do not select or branch by fixture outcome"
    : "disabled",
  controlScreen: distributedForwardFour
    ? "distributed allocation, both orientations, half/one-frame forward phase only (4 controls) at each C1/transient stage; equal 4-member k+3 normal stream"
    : "mirrored 24-control study screen; equal 24-member k+3 normal stream",
}));

const started = performance.now();
const runResults = selected.map((selection) => runState(selection));

const summaryLines: string[] = [
  `charged two-contact shooting: ${runResults.length} state(s), ${round(performance.now() - started)}ms; engine=wasm`,
];
for (const result of runResults) summaryLines.push(...formatStateSummary(result));
process.stdout.write(summaryLines.join("\n") + "\n");

// Positive control: on the ordinary fixture the raw-normal family must produce
// at least one segment-1 admission (calibration history). Zero is a broken
// observation path, not a physics result.
const ordinary = heldOut ? undefined : runResults.find((result) => result.id === "ordinary");
if (ordinary !== undefined) {
  const rawSeg1Admitted = ordinary.summary.segment1AdmissionByFamily["raw-normal"].admitted;
  if (rawSeg1Admitted === 0) {
    process.stdout.write(
      "\nCONTROL FAILURE: ordinary raw-normal produced zero segment-1 admissions; the observation path is broken.\n",
    );
    process.exitCode = 2;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

type ContactForm = "static-c1" | "transient-c1-to-ballistic" | "raw-normal";
type CandidateMember = {
  index: number;
  label: string;
  form: ContactForm;
  lines: TrackLine[] | null;
  error: string | null;
};
type FailureClass =
  | "geometry-error"
  | "not-admitted-k"
  | "no-airborne-arrival"
  | "segment2-family-unavailable"
  | "not-admitted-k1"
  | "joint-admitted";

type Segment2Row = {
  family: Family;
  label: string;
  contactForm: ContactForm;
  admitted: boolean;
  admissionFrames: number;
  landingFrameOffset: number | null;
  landingProbeFrames: number;
  achieved: ReturnType<typeof roundAxes>;
  achievedAtEnd: ReturnType<typeof roundAxes>;
  finalLineCount: number | null;
  error: string | null;
  returnBoundary: ReturnBoundary | null;
  ballisticRelease: BallisticRelease | null;
};

type BallisticRelease = {
  launchAngleDeg: number | null;
  scoopLengthPx: number | null;
  scoopSegments: number | null;
  reAdmissionFrames: number;
  retainedSecondCapture: boolean;
  error: string | null;
};

type BallisticReleaseGeometry = Omit<BallisticRelease, "reAdmissionFrames" | "retainedSecondCapture"> & {
  lines: TrackLine[];
};

type ReturnAttempt = {
  index: number;
  admitted: boolean;
  admissionFrames: number;
  error: string | null;
  gateDiagnosis: ReturnGateDiagnosis | null;
};

type ReturnGateDiagnosis = {
  classification:
    | "geometry-unavailable"
    | "pre-target-clearance"
    | "survival"
    | "accepted-w1"
    | "accepted-w2-to-w5"
    | "no-lockstep-acceptance-through-w5";
  acceptedAtW: number | null;
  offset: number | null;
};

type ReturnArrivalState = {
  speed: number;
  velocityAngleDeg: number;
  sledPoseDeg: number | null;
  contactNow: boolean;
  groundedAgeFrames: number;
  airborneAgeFrames: number;
};

/**
 * The component-level boundary: both sequential captures must survive as the
 * exact same one-shot line set before the unchanged normal generator is read
 * from the next authored contact. This is observation only, never selection.
 */
type ReturnBoundary = {
  jointAdmissionFrames: number;
  materialized: boolean;
  materializationError: string | null;
  k2ProbeFrames: number;
  k2ArrivalState: ReturnArrivalState | null;
  rawNormalAttempted: number;
  rawNormalGeometryAvailable: number;
  rawNormalAdmitted: number;
  rawNormalAdmissionFrames: number;
  rawNormalControlAvailable: boolean;
  attempts: ReturnAttempt[];
  recursiveTransient: RecursiveTransient | null;
  chargedFrames: number;
};

type RecursiveTransientRow = {
  index: number;
  label: string;
  admitted: boolean;
  admissionFrames: number;
  materialized: boolean;
  materializationFrames: number;
  error: string | null;
  normalReturn: RecursiveNormalReturn | null;
};

type RecursiveNormalReturn = {
  k3ProbeFrames: number;
  k3ArrivalState: ReturnArrivalState | null;
  rawNormalAttempted: number;
  rawNormalGeometryAvailable: number;
  rawNormalAdmitted: number;
  rawNormalAdmissionFrames: number;
  rawNormalControlAvailable: boolean;
  attempts: ReturnAttempt[];
  chargedFrames: number;
};

type RecursiveTransient = {
  available: boolean;
  attempted: number;
  admitted: number;
  materialized: number;
  materializationFailures: number;
  admissionFrames: number;
  materializationFrames: number;
  chargedFrames: number;
  error: string | null;
  rows: RecursiveTransientRow[];
};

type ReturnBoundarySummary = {
  capturePairsAttempted: number;
  pairsMaterialized: number;
  materializationFailures: number;
  rawNormalControlUnavailable: number;
  pairsWithNormalReturn: number;
  totalNormalReturns: number;
  chargedFrames: number;
  recursiveTransient: {
    pairsObserved: number;
    attempted: number;
    admitted: number;
    materialized: number;
    materializationFailures: number;
    chargedFrames: number;
    normalReturnTriples: number;
    normalReturnControlUnavailable: number;
    triplesWithNormalReturn: number;
    totalNormalReturns: number;
    normalReturnFrames: number;
  } | null;
};

type Row = {
  index: number;
  family: Family;
  controlId: string;
  failureClass: FailureClass;
  jointAdmitted: boolean;
  totalChargedFrames: number;
  segment1: {
    admitted: boolean;
    admissionFrames: number;
    landingFrameOffset: number | null;
    landingProbeFrames: number;
    achieved: ReturnType<typeof roundAxes>;
    achievedAtEnd: ReturnType<typeof roundAxes>;
    finalLineCount: number | null;
    error: string | null;
  };
  segment2:
    | null
    | {
      available: boolean;
      probeFrames: number;
      attempted: number;
      admitted: number;
      admittedByFamily: Record<Family, number>;
      admissionFrames: number;
      landingProbeFrames: number;
      returnFrames: number;
      error: string | null;
      rows: Segment2Row[];
    };
};

type StateResult = {
  id: string;
  artifactPath: string;
  panel: PreparedTrajectoryFixtureCore["panel"];
  rows: Row[];
  summary: StateSummary;
};

type StateSelection = {
  fixturePath: string;
  fixture: FrozenTrajectoryFixture | null;
  heldOut: boolean;
};

function selectCalibrationFixtures(requestedCase: string, fixturePaths: readonly string[]): readonly StateSelection[] {
  if (fixturePaths.length > 0) throw new Error("--fixture is only valid with --held-out");
  if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
    throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
  }
  const selectedIds: readonly StateId[] = requestedCase === "all" ? stateIds : [requestedCase as StateId];
  return selectedIds.map((id) => ({
    fixturePath: `${FIXTURE_DIR}/${FIXTURES[id]}`,
    fixture: null,
    heldOut: false,
  }));
}

function selectHeldOutFixtures(fixturePaths: readonly string[]): readonly StateSelection[] {
  if (argument("case") !== undefined) throw new Error("--held-out uses the sealed --fixture roster, not --case");
  const requiredIds = requiredHeldOutPanelIds();
  if (fixturePaths.length !== requiredIds.length) {
    throw new Error(`held-out mode requires exactly ${requiredIds.length} --fixture paths`);
  }
  const selected = fixturePaths.map((fixturePath) => {
    const fixture = readFrozenTrajectoryFixture(fixturePath);
    assertHeldOutFixtureDeclaration(fixture);
    return { fixturePath, fixture, heldOut: true };
  });
  const actualIds = selected.map((selection) => selection.fixture.panel.id).sort();
  const expectedIds = [...requiredIds].sort();
  if (stableJson(actualIds) !== stableJson(expectedIds)) {
    throw new Error(`--held-out fixture roster must be exactly ${expectedIds.join(", ")}`);
  }
  return selected;
}

function assertHeldOutFixtureDeclaration(fixture: FrozenTrajectoryFixture): void {
  if (fixture.schema !== "line.frozen-trajectory-prefix.v3") {
    throw new Error("held-out recursive transient study requires a stable V3 fixture");
  }
  if (fixture.panel.cohort !== "validation" || fixture.panel.studyScope !== requiredHeldOutScope()) {
    throw new Error(`fixture ${fixture.panel.id} is not a declared recursive-transient held-out input`);
  }
  if (!fixture.capture.identityCheck.stable || fixture.capture.captureBudget !== 500_000 || fixture.capture.runtime.engine !== "wasm") {
    throw new Error(`fixture ${fixture.panel.id} lacks the required stable WASM/500k capture provenance`);
  }
  if (fixture.capture.studySourceFiles.includes("scripts/v0/trajectory/panel.ts")) {
    throw new Error(`fixture ${fixture.panel.id} capture imports the legacy trajectory panel`);
  }
}

function assertHeldOutFixture(
  fixture: FrozenTrajectoryFixture,
  prepared: PreparedTrajectoryFixtureCore,
): void {
  assertHeldOutFixtureDeclaration(fixture);
  if (!requiredHeldOutPanelIds().includes(prepared.panel.id)) {
    throw new Error(`unexpected held-out recursive-transient panel ${prepared.panel.id}`);
  }
}

function requiredHeldOutPanelIds(): readonly string[] {
  return distributedForwardFour ? FOUR_CONTROL_HELD_OUT_PANEL_IDS : HELD_OUT_PANEL_IDS;
}

function requiredHeldOutScope(): string {
  return distributedForwardFour
    ? "recursive-transient-distributed-four-v4"
    : "recursive-transient-heldout-v1";
}

type FamilyClosure = {
  segment1Attempted: number;
  segment1Admitted: number;
  jointPairs: number;
  segment1WithJoint: number;
  totalChargedFrames: number;
  jointPairsPerMillionFrames: number | null;
};
type StateSummary = {
  segment1AdmissionByFamily: Record<Family, { attempted: number; admitted: number }>;
  jointByFamilyPair: Record<string, number>;
  jointPairsTotal: number;
  totalChargedFramesByFamily: Record<Family, number>;
  failureClassCounts: Record<string, number>;
  byFamily: Record<Family, FamilyClosure>;
  returnBoundary: ReturnBoundarySummary | null;
};

type ReturnContext = {
  // deno-lint-ignore no-explicit-any
  baseEngine: any;
  current: Gap;
  currentAxisEnd: number;
  firstLines: TrackLine[];
  firstLineId: number;
  preTargetSledTrace: () => number[];
  next: Gap;
  afterNext: Gap | null;
  ctx: SpecContext;
  seed: number;
  rowIndex: number;
};

function runState(selection: StateSelection): StateResult {
  const fixturePath = selection.fixturePath;
  const fixture = selection.fixture ?? readFrozenTrajectoryFixture(fixturePath);
  // prepareStateCoupledTrajectoryFixture fails closed on any replay mismatch;
  // that error is surfaced, never suppressed.
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (!selection.heldOut && prepared.panel.cohort !== "calibration") {
    throw new Error(`two-contact shooting accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
  }
  if (selection.heldOut) assertHeldOutFixture(fixture, prepared);
  const next = prepared.setup.gaps[prepared.outgoing.index + 1];
  const afterNext = next === undefined ? undefined : prepared.setup.gaps[next.index + 1];
  if (returnNormal && (next === undefined || !next.endsWithContact || next.startFrame !== prepared.outgoing.endFrame)) {
    throw new Error(`return-boundary protocol requires an authored contact immediately after gap ${prepared.outgoing.index}`);
  }
  if (recursiveTransient && (afterNext === undefined || !afterNext.endsWithContact || afterNext.startFrame !== next!.endFrame)) {
    throw new Error(`recursive-transient protocol requires an authored contact immediately after gap ${next!.index}`);
  }
  const allContactFrames = prepared.ctx.allContactFrames;
  const axisEnd1 = axisLookaheadEndFrame(prepared.current, allContactFrames);

  const kinematic1 = contactKinematicFrameFromPlanningState(prepared.state, prepared.frame, prepared.current.targets);
  const captureMembers1 = buildCaptureMembers(kinematic1, prepared.lineIdStart);
  const rawMembers1 = buildRawMembers(
    makeRng(rawStreamSeed(prepared, prepared.current.index)),
    prepared.probe,
    prepared.current,
    prepared.lineIdStart,
    allContactFrames,
    captureMembers1.length,
  );

  const families1: Array<{ family: Family; members: CandidateMember[] }> = [
    { family: "capture-arc", members: captureMembers1 },
    { family: "raw-normal", members: rawMembers1 },
  ];

  const rows: Row[] = [];
  let rowIndex = 0;
  for (const { family, members } of families1) {
    for (const member of members) {
      rows.push(evaluateRow(prepared, family, member, rowIndex, axisEnd1, allContactFrames, next ?? null, afterNext ?? null));
      rowIndex++;
    }
  }

  const summary = summarizeState(rows);
  const artifactIdentity = studyArtifactIdentity({
    schema: SCHEMA,
    fixtureFingerprint: fixture.fixtureFingerprint,
    studySourceFingerprint: sourceIdentity.studySourceFingerprint,
    observationCandidateFingerprint: observationCompiler.candidateFingerprint,
    protocolFingerprint,
  });
  const document = {
    schema: SCHEMA,
    artifactIdentity,
    purpose: [
      "Test whether a jointly constructed capture at contact k and a chained catch at contact k+1 close both contacts where the normal pool fails.",
      "Charge every admission and probe with getSimFrames() and compare joint closure cost against the equal-count raw-normal stream.",
      "Retain every row; no control, candidate, source default, or promotion is selected here.",
    ],
    status: {
      productionIntegration: "forbidden: trajectory observation outside the compiler identity boundary; not a candidate source, selector, or promotion command",
      cohortPolicy: selection.heldOut
        ? "sealed recursive-transient held-out validation only; no compiler source, selector, promotion, or V2 evaluation is authorized"
        : "calibration only; a separately frozen validation cohort is required before any predictive claim",
    },
    argv: [...argv],
    elapsedMs: round(performance.now() - started),
    provenance: {
      fixturePath,
      fixtureFingerprint: fixture.fixtureFingerprint,
      captureCompiler: fixture.captureCompiler,
      observationCompiler,
      runtime: { node: process.version, engine: "wasm" },
      studySourceFingerprint: sourceIdentity.studySourceFingerprint,
      studySourceFiles: sourceIdentity.sourceFiles,
    },
    panel: prepared.panel,
    fixtureReplay: prepared.replay,
    protocol: {
      captureBudget: prepared.fixture.captureBudget,
      captureEngine: prepared.fixture.captureEngine,
      captureEnvironment: prepared.fixture.captureEnvironment,
      segment1CaptureArcControls: captureMembers1.length,
      segment1RawNormalControls: rawMembers1.length,
      admission: "tryCandidateLines(engine, gap, lines, lineIdStart, allContactFrames, axisLookaheadEndFrame, gap.targets, true, undefined, probe.preTargetSledTrace)",
      returnBoundary: returnNormal
        ? {
          pairFamily: transientBridge
            ? "capture-arc->transient-c1-to-ballistic only"
            : "capture-arc->capture-arc only",
          materialization: "combined sequentially admitted lines must equal a one-shot current-gap admission",
          nextGap: next!.index,
          normalAttemptsPerMaterializedPair: captureMembers1.length,
          normalSeed: "deterministic fixture seed + k+2 gap + pair row",
        }
        : null,
      ballisticRelease: ballisticRelease
        ? {
          scope: "capture-arc->capture-arc only after the sequential second C1 admission",
          captureInvariant: "the original second C1 lines must remain byte-stable after complete-line-set re-admission and still own its contact",
          scoop: "three equal-length solid segments; first tangent equals the second C1 exit tangent; tangent turns uniformly to the ballistic launch angle",
          scoopLength: "three measured second-C1 release-speed frames",
          launchAngle: "atan2(-0.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * literal k+2 interval frames, max(1, measured second-C1 release speed))",
          reAdmission: "unchanged tryCandidateLines at k+1 on the complete second line set; its simulation frames are charged",
        }
        : null,
      transientBridge: transientBridge
        ? {
          scope: "first C1 capture followed by a transient k+1 C1-to-ballistic bridge only",
          secondContact: "one approach segment ends at the exact predicted k+1 point; its first scoop tangent equals the approach tangent and the surface stops after the third uniformly turning scoop segment",
          controls: "the fixed mirrored 24-control C1 screen supplies only k+1 approach point and entry tangent from the exact extended-engine state",
          launchAngle: "atan2(-0.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * literal k+2 interval frames, max(1, exact k+1 incoming speed))",
          materialization: "the first C1 plus complete transient bridge must equal a one-shot current-gap admission; the second contact is deliberately not compared with the static C1 response",
        }
        : null,
      arrivalGateDiagnosis: arrivalGateDiagnosis
        ? {
          scope: "transient-bridge k+2 raw-normal attempts only",
          hook: "existing landing-window probe around each unchanged tryCandidateLines call",
          classes: ["pre-target-clearance", "survival", "accepted-w1", "accepted-w2-to-w5", "no-lockstep-acceptance-through-w5"],
          accounting: "exactly one hook record or an explicit pre-target-clearance classification per generated member; no gate is changed",
        }
        : null,
      recursiveTransient: recursiveTransient
        ? {
          scope: selection.heldOut
            ? "every sealed held-out fixture: materialized first-C1 plus k+1 transient pairs only"
            : "dense-240 calibration: materialized first-C1 plus k+1 transient pairs only",
          thirdContact: "same mirrored approach controls and one-approach/three-scoop law from exact k+2 state",
          launchAngle: "atan2(-0.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * literal k+3 interval frames, max(1, exact k+2 incoming speed))",
          materialization: "each admitted third component is re-admitted with the complete three-contact line set on the immutable k prefix",
        }
        : null,
      recursiveReturn: recursiveReturn
        ? {
          scope: selection.heldOut
            ? "every byte-stable held-out first-C1 plus two-transient triple"
            : "every byte-stable dense-240 first-C1 plus two-transient triple",
          returnGap: afterNext!.index,
          normalAttemptsPerTriple: captureMembers1.length,
          normalSeed: "deterministic fixture seed + k+3 gap + first-control row + third-control index",
        }
        : null,
    },
    summary,
    rows,
  };

  const artifactPath = `${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`;
  writeImmutableJsonArtifact(artifactPath, document, "two-contact-shooting artifact");
  return { id: prepared.panel.id, artifactPath, panel: prepared.panel, rows, summary };
}

function evaluateRow(
  prepared: PreparedTrajectoryFixtureCore,
  family: Family,
  member: CandidateMember,
  rowIndex: number,
  axisEnd1: number,
  allContactFrames: number[],
  next: Gap | null,
  afterNext: Gap | null,
): Row {
  const base = {
    index: rowIndex,
    family,
    controlId: member.label,
  };
  if (member.lines === null) {
    return {
      ...base,
      failureClass: "geometry-error",
      jointAdmitted: false,
      totalChargedFrames: 0,
      segment1: emptySegment1(member.error),
      segment2: null,
    };
  }

  const s1Before = getSimFrames();
  const fit1 = tryCandidateLines(
    prepared.engine,
    prepared.current,
    member.lines,
    prepared.lineIdStart,
    allContactFrames,
    axisEnd1,
    prepared.current.targets,
    true,
    undefined,
    prepared.probe.preTargetSledTrace,
  ) as GapFit | null;
  const s1Frames = getSimFrames() - s1Before;

  if (fit1 === null) {
    return {
      ...base,
      failureClass: "not-admitted-k",
      jointAdmitted: false,
      totalChargedFrames: s1Frames,
      segment1: { ...emptySegment1(null), admissionFrames: s1Frames },
      segment2: null,
    };
  }

  const engine2 = prepared.engine.addLine(fit1.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
  const lineId2 = prepared.lineIdStart + fit1.lines.length;

  // Segment-1 landing offset (bracketed probe on the extended engine).
  const l1Before = getSimFrames();
  const det1 = detectWindow(engine2, prepared.current.startFrame, prepared.current.endFrame + PERSISTENCE_FRAMES);
  const s1LandingOffset = ownedLandingFrameOffset(det1, prepared.current.endFrame, new Set(fit1.lines.map((line: TrackLine) => line.id)));
  const l1Frames = getSimFrames() - l1Before;

  const segment1 = {
    admitted: true,
    admissionFrames: s1Frames,
    landingFrameOffset: s1LandingOffset,
    landingProbeFrames: l1Frames,
    achieved: roundAxes(fit1.achieved),
    achievedAtEnd: roundAxes(fit1.achievedAtEnd),
    finalLineCount: fit1.lines.length,
    error: null,
  };

  // Segment-2 probe: extend the immutable engine, read the new exact probe state.
  const p2Before = getSimFrames();
  const probe2 = getCandidateProbe(engine2, prepared.outgoing, prepared.ctx);
  const state2 = extractPlanningState(engine2, prepared.outgoing.endFrame);
  const p2Frames = getSimFrames() - p2Before;

  const unavailable = (failureClass: FailureClass, error: string | null): Row => ({
    ...base,
    failureClass,
    jointAdmitted: false,
    totalChargedFrames: s1Frames + l1Frames + p2Frames,
    segment1,
    segment2: { available: false, probeFrames: p2Frames, attempted: 0, admitted: 0, admittedByFamily: { "capture-arc": 0, "raw-normal": 0 }, admissionFrames: 0, landingProbeFrames: 0, returnFrames: 0, error, rows: [] },
  });

  if (state2 === null) return unavailable("no-airborne-arrival", null);

  // Segment-2 candidate families from engine2's exact state at contact k+1.
  let captureMembers2: CandidateMember[];
  try {
    const frame2 = targetFrameFromPlanningState(state2);
    const kinematic2 = contactKinematicFrameFromPlanningState(state2, frame2, prepared.outgoing.targets);
    captureMembers2 = transientBridge
      ? buildTransientBridgeMembers(kinematic2, lineId2, next!.endFrame - prepared.outgoing.endFrame)
      : buildCaptureMembers(kinematic2, lineId2);
  } catch (error) {
    return unavailable("segment2-family-unavailable", errorMessage(error));
  }
  const rawMembers2 = buildRawMembers(
    makeRng(rawStreamSeed2(prepared, prepared.outgoing.index, rowIndex)),
    probe2,
    prepared.outgoing,
    lineId2,
    allContactFrames,
    captureMembers2.length,
  );

  const axisEnd2 = axisLookaheadEndFrame(prepared.outgoing, allContactFrames);
  const families2: Array<{ family: Family; members: CandidateMember[] }> = [
    { family: "capture-arc", members: captureMembers2 },
    { family: "raw-normal", members: rawMembers2 },
  ];

  const seg2Rows: Segment2Row[] = [];
  let admissionFrames2 = 0;
  let landingProbes2 = 0;
  let returnFrames2 = 0;
  for (const { family: family2, members } of families2) {
    for (const member2 of members) {
      const row = evaluateSegment2(engine2, prepared.outgoing, member2, family2, lineId2, axisEnd2, allContactFrames, probe2,
        returnNormal && family === "capture-arc" && family2 === "capture-arc" && next !== null
          ? {
            baseEngine: prepared.engine,
            current: prepared.current,
            currentAxisEnd: axisEnd1,
            firstLines: fit1.lines,
            firstLineId: prepared.lineIdStart,
            preTargetSledTrace: prepared.probe.preTargetSledTrace,
            next,
            afterNext,
            ctx: prepared.ctx,
            seed: prepared.panel.seed,
            rowIndex,
          }
          : null,
        (frames) => {
        admissionFrames2 += frames.admission;
        landingProbes2 += frames.landing;
        },
      );
      returnFrames2 += row.returnBoundary?.chargedFrames ?? 0;
      seg2Rows.push(row);
    }
  }

  const admittedByFamily: Record<Family, number> = { "capture-arc": 0, "raw-normal": 0 };
  for (const s2 of seg2Rows) if (s2.admitted) admittedByFamily[s2.family]++;
  const admitted = admittedByFamily["capture-arc"] + admittedByFamily["raw-normal"];
  const jointAdmitted = admitted > 0;

  return {
    ...base,
    failureClass: jointAdmitted ? "joint-admitted" : "not-admitted-k1",
    jointAdmitted,
    totalChargedFrames: s1Frames + l1Frames + p2Frames + admissionFrames2 + landingProbes2 + returnFrames2,
    segment1,
    segment2: {
      available: true,
      probeFrames: p2Frames,
      attempted: seg2Rows.length,
      admitted,
      admittedByFamily,
      admissionFrames: admissionFrames2,
      landingProbeFrames: landingProbes2,
      returnFrames: returnFrames2,
      error: null,
      rows: seg2Rows,
    },
  };
}

function evaluateSegment2(
  engine2: unknown,
  outgoing: Gap,
  member: CandidateMember,
  family: Family,
  lineId2: number,
  axisEnd2: number,
  allContactFrames: number[],
  probe2: CandidateProbe,
  returnContext: ReturnContext | null,
  charge: (frames: { admission: number; landing: number }) => void,
): Segment2Row {
  if (member.lines === null) {
    charge({ admission: 0, landing: 0 });
    return { family, label: member.label, contactForm: member.form, admitted: false, admissionFrames: 0, landingFrameOffset: null, landingProbeFrames: 0, achieved: null, achievedAtEnd: null, finalLineCount: null, error: member.error, returnBoundary: null, ballisticRelease: null };
  }
  const before = getSimFrames();
  const fit2 = tryCandidateLines(
    engine2 as any,
    outgoing,
    member.lines,
    lineId2,
    allContactFrames,
    axisEnd2,
    outgoing.targets,
    true,
    undefined,
    probe2.preTargetSledTrace,
  ) as GapFit | null;
  const admissionFrames = getSimFrames() - before;
  if (fit2 === null) {
    charge({ admission: admissionFrames, landing: 0 });
    return { family, label: member.label, contactForm: member.form, admitted: false, admissionFrames, landingFrameOffset: null, landingProbeFrames: 0, achieved: null, achievedAtEnd: null, finalLineCount: null, error: null, returnBoundary: null, ballisticRelease: null };
  }
  let finalFit2 = fit2;
  let ballistic: BallisticRelease | null = null;
  if (ballisticRelease && returnContext !== null) {
    const release = appendBallisticRelease(fit2.lines, lineId2, fit2.releaseSpeed, returnContext.next.endFrame - outgoing.endFrame);
    if (release.error !== null) {
      charge({ admission: admissionFrames, landing: 0 });
      return {
        family, label: member.label, contactForm: member.form, admitted: false, admissionFrames, landingFrameOffset: null, landingProbeFrames: 0,
        achieved: null, achievedAtEnd: null, finalLineCount: null, error: release.error, returnBoundary: null,
        ballisticRelease: { ...release, reAdmissionFrames: 0, retainedSecondCapture: false },
      };
    }
    const releaseBefore = getSimFrames();
    const releaseFit = tryCandidateLines(
      engine2 as any,
      outgoing,
      [...fit2.lines, ...release.lines],
      lineId2,
      allContactFrames,
      axisEnd2,
      outgoing.targets,
      true,
      undefined,
      probe2.preTargetSledTrace,
    ) as GapFit | null;
    const reAdmissionFrames = getSimFrames() - releaseBefore;
    if (releaseFit === null) {
      charge({ admission: admissionFrames + reAdmissionFrames, landing: 0 });
      return {
        family, label: member.label, contactForm: member.form, admitted: false, admissionFrames: admissionFrames + reAdmissionFrames,
        landingFrameOffset: null, landingProbeFrames: 0, achieved: null, achievedAtEnd: null, finalLineCount: null,
        error: "ballistic release line set is not admitted at k+1", returnBoundary: null,
        ballisticRelease: { ...release, reAdmissionFrames, retainedSecondCapture: false, error: "ballistic release line set is not admitted at k+1" },
      };
    }
    const retainedSecondCapture = stableJson(releaseFit.lines.slice(0, fit2.lines.length)) === stableJson(fit2.lines);
    if (!retainedSecondCapture) {
      charge({ admission: admissionFrames + reAdmissionFrames, landing: 0 });
      return {
        family, label: member.label, contactForm: member.form, admitted: false, admissionFrames: admissionFrames + reAdmissionFrames,
        landingFrameOffset: null, landingProbeFrames: 0, achieved: null, achievedAtEnd: null, finalLineCount: null,
        error: "ballistic release changed the second C1 capture geometry", returnBoundary: null,
        ballisticRelease: { ...release, reAdmissionFrames, retainedSecondCapture, error: "ballistic release changed the second C1 capture geometry" },
      };
    }
    finalFit2 = releaseFit;
    ballistic = { ...release, reAdmissionFrames, retainedSecondCapture, error: null };
  }
  const engine3 = (engine2 as any).addLine(finalFit2.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
  const lBefore = getSimFrames();
  const det2 = detectWindow(engine3, outgoing.startFrame, outgoing.endFrame + PERSISTENCE_FRAMES);
  const landingFrameOffset = ownedLandingFrameOffset(det2, outgoing.endFrame, new Set(fit2.lines.map((line: TrackLine) => line.id)));
  const landingProbeFrames = getSimFrames() - lBefore;
  charge({
    admission: admissionFrames + (ballistic?.reAdmissionFrames ?? 0),
    landing: landingProbeFrames,
  });
  if (ballistic !== null && landingFrameOffset === null) {
    return {
      family,
      label: member.label,
      contactForm: member.form,
      admitted: false,
      admissionFrames: admissionFrames + ballistic.reAdmissionFrames,
      landingFrameOffset: null,
      landingProbeFrames,
      achieved: null,
      achievedAtEnd: null,
      finalLineCount: null,
      error: "ballistic release displaced the owned second C1 capture",
      returnBoundary: null,
      ballisticRelease: {
        ...ballistic,
        retainedSecondCapture: false,
        error: "ballistic release displaced the owned second C1 capture",
      },
    };
  }
  const returnBoundary = returnContext === null
    ? null
    : evaluateReturnBoundary(returnContext, finalFit2, allContactFrames);
  const finalAdmissionFrames = admissionFrames + (ballistic?.reAdmissionFrames ?? 0);
  return {
    family,
    label: member.label,
    contactForm: member.form,
    admitted: true,
    admissionFrames: finalAdmissionFrames,
    landingFrameOffset,
    landingProbeFrames,
    achieved: roundAxes(fit2.achieved),
    achievedAtEnd: roundAxes(fit2.achievedAtEnd),
    finalLineCount: finalFit2.lines.length,
    error: null,
    returnBoundary,
    ballisticRelease: ballistic,
  };
}

/**
 * Append a fixed three-segment, constant-turn scoop whose first tangent is the
 * exact second-C1 exit tangent and whose last tangent is the symmetric launch
 * angle that would make the next contact after N literal physics frames.  It
 * introduces no target, case, or source-default parameters: the only inputs
 * are the admitted capture geometry, its measured release speed, and k+2's
 * authored interval.
 */
function appendBallisticRelease(
  captureLines: readonly TrackLine[],
  lineIdStart: number,
  releaseSpeed: number | undefined,
  nextIntervalFrames: number,
): BallisticReleaseGeometry {
  const unavailable = (error: string): BallisticReleaseGeometry => ({
    lines: [],
    launchAngleDeg: null,
    scoopLengthPx: null,
    scoopSegments: null,
    error,
  });
  if (captureLines.length === 0) return unavailable("ballistic release requires a non-empty second C1 capture");
  if (!Number.isSafeInteger(lineIdStart)) return unavailable("ballistic release line id must be a safe integer");
  if (!Number.isFinite(releaseSpeed) || !(releaseSpeed > 0)) {
    return unavailable("ballistic release requires a finite positive exact release speed");
  }
  if (!Number.isSafeInteger(nextIntervalFrames) || !(nextIntervalFrames > 0)) {
    return unavailable("ballistic release requires a positive integral k+2 interval");
  }

  const exit = captureLines[captureLines.length - 1]!;
  const dx = exit.x2 - exit.x1;
  const dy = exit.y2 - exit.y1;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) <= 1e-9) {
    return unavailable("ballistic release requires a finite non-zero second C1 exit tangent");
  }

  const launchVy = -0.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * nextIntervalFrames;
  const launchAngleDeg = (Math.atan2(launchVy, Math.max(1, releaseSpeed)) * 180) / Math.PI;
  const exitAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const turnDeg = signedAngleDelta(exitAngleDeg, launchAngleDeg);
  const scoopSegments = 3;
  const scoopLengthPx = releaseSpeed * scoopSegments;
  const segmentLengthPx = scoopLengthPx / scoopSegments;
  const lines: TrackLine[] = [];
  let point = { x: exit.x2, y: exit.y2 };
  for (let index = 0; index < scoopSegments; index++) {
    // The initial tangent is exactly the C1 exit tangent; subsequent equal
    // turns form one finite concave response, ending at the ballistic launch.
    const fraction = scoopSegments === 1 ? 0 : index / (scoopSegments - 1);
    const angleDeg = exitAngleDeg + turnDeg * fraction;
    const radians = (angleDeg * Math.PI) / 180;
    const next = {
      x: point.x + Math.cos(radians) * segmentLengthPx,
      y: point.y + Math.sin(radians) * segmentLengthPx,
    };
    lines.push({
      id: lineIdStart + captureLines.length + index,
      type: 0,
      x1: point.x,
      y1: point.y,
      x2: next.x,
      y2: next.y,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    });
    point = next;
  }
  return { lines, launchAngleDeg, scoopLengthPx, scoopSegments, error: null };
}

function signedAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = (toDeg - fromDeg) % 360;
  if (delta <= -180) delta += 360;
  if (delta > 180) delta -= 360;
  return delta;
}

function evaluateReturnBoundary(
  context: ReturnContext,
  fit2: GapFit,
  allContactFrames: number[],
): ReturnBoundary {
  const combined = [...context.firstLines, ...fit2.lines];
  const jointBefore = getSimFrames();
  const jointFit = tryCandidateLines(
    context.baseEngine,
    context.current,
    combined,
    context.firstLineId,
    allContactFrames,
    context.currentAxisEnd,
    context.current.targets,
    true,
    undefined,
    context.preTargetSledTrace,
  ) as GapFit | null;
  const jointAdmissionFrames = getSimFrames() - jointBefore;
  if (jointFit === null) {
    return emptyReturnBoundary(jointAdmissionFrames, "combined line set is not admitted at k");
  }
  if (stableJson(jointFit.lines) !== stableJson(combined)) {
    return emptyReturnBoundary(jointAdmissionFrames, "one-shot admission changed the sequentially admitted line set");
  }

  const pairEngine = context.baseEngine.addLine(combined.map((line: TrackLine) => engineLineFromTrackLine(line)));
  let nextProbe: CandidateProbe;
  let k2ProbeFrames = 0;
  try {
    const probeBefore = getSimFrames();
    nextProbe = getCandidateProbe(pairEngine, context.next, context.ctx);
    const nextState = extractPlanningState(pairEngine, context.next.endFrame);
    const k2ArrivalState = nextState === null ? null : {
      speed: round(nextState.speed),
      velocityAngleDeg: round(nextState.velocityAngleDeg),
      sledPoseDeg: nextState.sledPoseDeg === null ? null : round(nextState.sledPoseDeg),
      contactNow: nextState.phase.contactNow,
      groundedAgeFrames: nextState.phase.groundedAgeFrames,
      airborneAgeFrames: nextState.phase.airborneAgeFrames,
    };
    k2ProbeFrames = getSimFrames() - probeBefore;
    const normalBoundary = evaluateReturnNormalStream(
      context,
      pairEngine,
      nextProbe,
      k2ArrivalState,
      jointAdmissionFrames,
      k2ProbeFrames,
      context.firstLineId + combined.length,
      allContactFrames,
    );
    if (!recursiveTransient) return normalBoundary;
    if (nextState === null || context.afterNext === null) {
      return {
        ...normalBoundary,
        recursiveTransient: unavailableRecursiveTransient("exact k+2 planning state or authored k+3 contact unavailable"),
      };
    }
    const recurrence = evaluateRecursiveTransient(
      context,
      pairEngine,
      combined,
      nextProbe,
      nextState,
      allContactFrames,
    );
    return {
      ...normalBoundary,
      recursiveTransient: recurrence,
      chargedFrames: normalBoundary.chargedFrames + recurrence.chargedFrames,
    };
  } catch (error) {
    return {
      ...emptyReturnBoundary(jointAdmissionFrames, `k+2 probe unavailable: ${errorMessage(error)}`),
      k2ProbeFrames,
      chargedFrames: jointAdmissionFrames + k2ProbeFrames,
    };
  }
}

function evaluateReturnNormalStream(
  context: ReturnContext,
  pairEngine: any,
  nextProbe: CandidateProbe,
  k2ArrivalState: ReturnArrivalState | null,
  jointAdmissionFrames: number,
  k2ProbeFrames: number,
  nextLineIdStart: number,
  allContactFrames: number[],
): ReturnBoundary {
  const members = buildRawMembers(
    makeRng(rawStreamSeed3(context.seed, context.next.index, context.rowIndex)),
    nextProbe,
    context.next,
    nextLineIdStart,
    allContactFrames,
    CONTROL_MEMBER_COUNT,
  );
  const attempts: ReturnAttempt[] = [];
  let rawNormalAdmissionFrames = 0;
  if (arrivalGateDiagnosis) enableLandingWindowProbe();
  try {
    for (const member of members) {
      if (member.lines === null) {
        attempts.push({
          index: member.index,
          admitted: false,
          admissionFrames: 0,
          error: member.error,
          gateDiagnosis: arrivalGateDiagnosis
            ? { classification: "geometry-unavailable", acceptedAtW: null, offset: null }
            : null,
        });
        continue;
      }
      const before = getSimFrames();
      const fit = tryCandidateLines(
        pairEngine,
        context.next,
        member.lines,
        nextLineIdStart,
        allContactFrames,
        axisLookaheadEndFrame(context.next, allContactFrames),
        context.next.targets,
        true,
        undefined,
        nextProbe.preTargetSledTrace,
      ) as GapFit | null;
      const admissionFrames = getSimFrames() - before;
      rawNormalAdmissionFrames += admissionFrames;
      const gateDiagnosis = arrivalGateDiagnosis
        ? diagnoseReturnGateAttempt(drainLandingWindowProbe().records, fit !== null)
        : null;
      attempts.push({ index: member.index, admitted: fit !== null, admissionFrames, error: null, gateDiagnosis });
    }
  } finally {
    if (arrivalGateDiagnosis) disableLandingWindowProbe();
  }
  const rawNormalGeometryAvailable = members.filter((member) => member.lines !== null).length;
  const rawNormalAdmitted = attempts.filter((attempt) => attempt.admitted).length;
  return {
    jointAdmissionFrames,
    materialized: true,
    materializationError: null,
    k2ProbeFrames,
    k2ArrivalState,
    rawNormalAttempted: members.length,
    rawNormalGeometryAvailable,
    rawNormalAdmitted,
    rawNormalAdmissionFrames,
    rawNormalControlAvailable: rawNormalGeometryAvailable > 0,
    attempts,
    recursiveTransient: null,
    chargedFrames: jointAdmissionFrames + k2ProbeFrames + rawNormalAdmissionFrames,
  };
}

function diagnoseReturnGateAttempt(
  records: readonly LandingWindowProbeRecord[],
  admitted: boolean,
): ReturnGateDiagnosis {
  if (records.length === 0) {
    return { classification: "pre-target-clearance", acceptedAtW: null, offset: null };
  }
  if (records.length !== 1) {
    throw new Error(`arrival-gate diagnosis expected one hook record per attempt, got ${records.length}`);
  }
  const record = records[0]!;
  if (record.failure === "survival") {
    return { classification: "survival", acceptedAtW: null, offset: null };
  }
  if (record.acceptedAtW === null) {
    if (admitted) throw new Error("arrival-gate diagnosis saw an admitted candidate without lockstep acceptance");
    return { classification: "no-lockstep-acceptance-through-w5", acceptedAtW: null, offset: null };
  }
  if (admitted !== (record.acceptedAtW === 1)) {
    throw new Error(`arrival-gate diagnosis disagrees with admission at width ${record.acceptedAtW}`);
  }
  return {
    classification: record.acceptedAtW === 1 ? "accepted-w1" : "accepted-w2-to-w5",
    acceptedAtW: record.acceptedAtW,
    offset: record.offset,
  };
}

/**
 * Test only whether the exact k+2 arrival can admit the same state-relative
 * transient law again. It deliberately stops before k+3 normal return: a
 * nonzero, prefix-stable triple is merely the falsifiable component evidence
 * required before declaring that downstream question.
 */
function evaluateRecursiveTransient(
  context: ReturnContext,
  pairEngine: any,
  combined: readonly TrackLine[],
  nextProbe: CandidateProbe,
  nextState: PlanningState,
  allContactFrames: number[],
): RecursiveTransient {
  const afterNext = context.afterNext;
  if (afterNext === null) return unavailableRecursiveTransient("authored k+3 contact unavailable");
  let members: CandidateMember[];
  try {
    const frame = targetFrameFromPlanningState(nextState);
    const kinematic = contactKinematicFrameFromPlanningState(nextState, frame, context.next.targets);
    members = buildTransientBridgeMembers(
      kinematic,
      context.firstLineId + combined.length,
      afterNext.endFrame - context.next.endFrame,
    );
  } catch (error) {
    return unavailableRecursiveTransient(`k+2 transient geometry unavailable: ${errorMessage(error)}`);
  }

  const rows: RecursiveTransientRow[] = [];
  let admissionFrames = 0;
  let materializationFrames = 0;
  for (const member of members) {
    if (member.lines === null) {
      rows.push({
        index: member.index,
        label: member.label,
        admitted: false,
        admissionFrames: 0,
        materialized: false,
        materializationFrames: 0,
        error: member.error,
        normalReturn: null,
      });
      continue;
    }
    const before = getSimFrames();
    const fit = tryCandidateLines(
      pairEngine,
      context.next,
      member.lines,
      context.firstLineId + combined.length,
      allContactFrames,
      axisLookaheadEndFrame(context.next, allContactFrames),
      context.next.targets,
      true,
      undefined,
      nextProbe.preTargetSledTrace,
    ) as GapFit | null;
    const thisAdmissionFrames = getSimFrames() - before;
    admissionFrames += thisAdmissionFrames;
    if (fit === null) {
      rows.push({
        index: member.index,
        label: member.label,
        admitted: false,
        admissionFrames: thisAdmissionFrames,
        materialized: false,
        materializationFrames: 0,
        error: null,
        normalReturn: null,
      });
      continue;
    }

    const fullLines = [...combined, ...fit.lines];
    const materializeBefore = getSimFrames();
    const fullFit = tryCandidateLines(
      context.baseEngine,
      context.current,
      fullLines,
      context.firstLineId,
      allContactFrames,
      context.currentAxisEnd,
      context.current.targets,
      true,
      undefined,
      context.preTargetSledTrace,
    ) as GapFit | null;
    const thisMaterializationFrames = getSimFrames() - materializeBefore;
    materializationFrames += thisMaterializationFrames;
    const materialized = fullFit !== null && stableJson(fullFit.lines) === stableJson(fullLines);
    const normalReturn = recursiveReturn && materialized
      ? evaluateRecursiveNormalReturn(
        context,
        context.baseEngine.addLine(fullLines.map((line: TrackLine) => engineLineFromTrackLine(line))),
        fullLines,
        member.index,
        allContactFrames,
      )
      : null;
    rows.push({
      index: member.index,
      label: member.label,
      admitted: true,
      admissionFrames: thisAdmissionFrames,
      materialized,
      materializationFrames: thisMaterializationFrames,
      error: materialized ? null : "complete transient triple is not a byte-stable k admission",
      normalReturn,
    });
  }

  const admitted = rows.filter((row) => row.admitted).length;
  const materialized = rows.filter((row) => row.materialized).length;
  return {
    available: true,
    attempted: members.length,
    admitted,
    materialized,
    materializationFailures: admitted - materialized,
    admissionFrames,
    materializationFrames,
    chargedFrames: admissionFrames + materializationFrames + rows.reduce(
      (sum, row) => sum + (row.normalReturn?.chargedFrames ?? 0),
      0,
    ),
    error: null,
    rows,
  };
}

function unavailableRecursiveTransient(error: string): RecursiveTransient {
  return {
    available: false,
    attempted: 0,
    admitted: 0,
    materialized: 0,
    materializationFailures: 0,
    admissionFrames: 0,
    materializationFrames: 0,
    chargedFrames: 0,
    error,
    rows: [],
  };
}

function evaluateRecursiveNormalReturn(
  context: ReturnContext,
  tripleEngine: any,
  fullLines: readonly TrackLine[],
  thirdControlIndex: number,
  allContactFrames: number[],
): RecursiveNormalReturn {
  const afterNext = context.afterNext;
  if (afterNext === null) throw new Error("recursive normal return requires an authored k+3 contact");
  const probeBefore = getSimFrames();
  const probe = getCandidateProbe(tripleEngine, afterNext, context.ctx);
  const state = extractPlanningState(tripleEngine, afterNext.endFrame);
  const k3ProbeFrames = getSimFrames() - probeBefore;
  const k3ArrivalState = state === null ? null : {
    speed: round(state.speed),
    velocityAngleDeg: round(state.velocityAngleDeg),
    sledPoseDeg: state.sledPoseDeg === null ? null : round(state.sledPoseDeg),
    contactNow: state.phase.contactNow,
    groundedAgeFrames: state.phase.groundedAgeFrames,
    airborneAgeFrames: state.phase.airborneAgeFrames,
  };
  const nextLineIdStart = context.firstLineId + fullLines.length;
  const members = buildRawMembers(
    makeRng(rawStreamSeed4(context.seed, afterNext.index, context.rowIndex, thirdControlIndex)),
    probe,
    afterNext,
    nextLineIdStart,
    allContactFrames,
    CONTROL_MEMBER_COUNT,
  );
  const attempts: ReturnAttempt[] = [];
  let rawNormalAdmissionFrames = 0;
  for (const member of members) {
    if (member.lines === null) {
      attempts.push({
        index: member.index,
        admitted: false,
        admissionFrames: 0,
        error: member.error,
        gateDiagnosis: null,
      });
      continue;
    }
    const before = getSimFrames();
    const fit = tryCandidateLines(
      tripleEngine,
      afterNext,
      member.lines,
      nextLineIdStart,
      allContactFrames,
      axisLookaheadEndFrame(afterNext, allContactFrames),
      afterNext.targets,
      true,
      undefined,
      probe.preTargetSledTrace,
    ) as GapFit | null;
    const admissionFrames = getSimFrames() - before;
    rawNormalAdmissionFrames += admissionFrames;
    attempts.push({ index: member.index, admitted: fit !== null, admissionFrames, error: null, gateDiagnosis: null });
  }
  const rawNormalGeometryAvailable = members.filter((member) => member.lines !== null).length;
  return {
    k3ProbeFrames,
    k3ArrivalState,
    rawNormalAttempted: members.length,
    rawNormalGeometryAvailable,
    rawNormalAdmitted: attempts.filter((attempt) => attempt.admitted).length,
    rawNormalAdmissionFrames,
    rawNormalControlAvailable: rawNormalGeometryAvailable > 0,
    attempts,
    chargedFrames: k3ProbeFrames + rawNormalAdmissionFrames,
  };
}

function emptyReturnBoundary(jointAdmissionFrames: number, materializationError: string): ReturnBoundary {
  return {
    jointAdmissionFrames,
    materialized: false,
    materializationError,
    k2ProbeFrames: 0,
    k2ArrivalState: null,
    rawNormalAttempted: 0,
    rawNormalGeometryAvailable: 0,
    rawNormalAdmitted: 0,
    rawNormalAdmissionFrames: 0,
    rawNormalControlAvailable: false,
    attempts: [],
    recursiveTransient: null,
    chargedFrames: jointAdmissionFrames,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function buildCaptureMembers(
  kinematic: ReturnType<typeof contactKinematicFrameFromPlanningState>,
  lineIdStart: number,
): CandidateMember[] {
  const entries = selectedCaptureArcEntries(kinematic);
  return entries.map((entry, index) => {
    try {
      const realized = realizeContactCaptureArc(resolveContactCaptureArc(kinematic, entry.control), lineIdStart);
      return { index, label: entry.label, form: "static-c1", lines: realized.lines, error: null };
    } catch (error) {
      return { index, label: entry.label, form: "static-c1", lines: null, error: errorMessage(error) };
    }
  });
}

/**
 * A different k+1 component from the static C1 response: the fixed capture
 * screen supplies only the exact approach point and tangent, then the surface
 * immediately turns into a finite ballistic launch. The first C1 capture is
 * still admitted and later materialized unchanged by the pair boundary.
 */
function buildTransientBridgeMembers(
  kinematic: ReturnType<typeof contactKinematicFrameFromPlanningState>,
  lineIdStart: number,
  nextIntervalFrames: number,
): CandidateMember[] {
  const entries = selectedCaptureArcEntries(kinematic);
  return entries.map((entry, index) => {
    try {
      const resolved = resolveContactCaptureArc(kinematic, entry.control);
      const lines = realizeTransientBridge(resolved, kinematic.com.speedPxPerFrame, nextIntervalFrames, lineIdStart);
      return {
        index,
        label: `${entry.label}_transient`,
        form: "transient-c1-to-ballistic",
        lines,
        error: null,
      };
    } catch (error) {
      return {
        index,
        label: `${entry.label}_transient`,
        form: "transient-c1-to-ballistic",
        lines: null,
        error: errorMessage(error),
      };
    }
  });
}

function selectedCaptureArcEntries(
  kinematic: ReturnType<typeof contactKinematicFrameFromPlanningState>,
) {
  const entries = makeMirroredContactCaptureArcScreen(kinematic);
  const selected = distributedForwardFour
    ? entries.filter((entry) => DISTRIBUTED_FORWARD_FOUR_LABELS.has(entry.label))
    : entries;
  if (selected.length !== CONTROL_MEMBER_COUNT) {
    throw new Error(`configured capture screen has ${selected.length}, expected ${CONTROL_MEMBER_COUNT} controls`);
  }
  return selected;
}

function realizeTransientBridge(
  capture: ReturnType<typeof resolveContactCaptureArc>,
  incomingSpeed: number,
  nextIntervalFrames: number,
  lineIdStart: number,
): TrackLine[] {
  if (!Number.isFinite(incomingSpeed) || !(incomingSpeed > 0)) {
    throw new Error("transient bridge requires a finite positive exact k+1 incoming speed");
  }
  if (!Number.isSafeInteger(nextIntervalFrames) || !(nextIntervalFrames > 0)) {
    throw new Error("transient bridge requires a positive integral k+2 interval");
  }
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("transient bridge line id must be a safe integer");

  const launchAngleDeg = (Math.atan2(
    -0.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * nextIntervalFrames,
    Math.max(1, incomingSpeed),
  ) * 180) / Math.PI;
  const turnDeg = signedAngleDelta(capture.entryAngleDeg, launchAngleDeg);
  const scoopSegments = 3;
  const scoopLengthPx = incomingSpeed * scoopSegments;
  const segmentLengthPx = scoopLengthPx / scoopSegments;
  const lines: TrackLine[] = [solidLine(lineIdStart, capture.approachPoint, capture.capturePoint)];
  let point = { ...capture.capturePoint };
  for (let index = 0; index < scoopSegments; index++) {
    // The first scoop segment shares the approach tangent exactly. Uniform
    // turn then reaches the derived ballistic launch without a runway/hold.
    const fraction = scoopSegments === 1 ? 0 : index / (scoopSegments - 1);
    const angleDeg = capture.entryAngleDeg + turnDeg * fraction;
    const radians = (angleDeg * Math.PI) / 180;
    const next = {
      x: point.x + Math.cos(radians) * segmentLengthPx,
      y: point.y + Math.sin(radians) * segmentLengthPx,
    };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  return lines;
}

function solidLine(
  id: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
): TrackLine {
  return {
    id,
    type: 0,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

function buildRawMembers(
  rng: () => number,
  probe: CandidateProbe,
  gap: Gap,
  lineIdStart: number,
  allContactFrames: number[],
  count: number,
): CandidateMember[] {
  const members: CandidateMember[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    // Mirror the normal sampler's per-attempt state exactly (matches
    // study_local_contact_closure's raw-normal stream).
    clearImpactTemplateMarker();
    try {
      const geometry = sampleArcPlacementGeometry(
        rng,
        probe.refX,
        probe.refY,
        gap.targets,
        probe.targetState,
        attempt,
        gap,
        lineIdStart,
        "normal",
        allContactFrames,
      );
      members.push({ index: attempt, label: `normal_${attempt}`, form: "raw-normal", lines: geometry.lines, error: null });
    } catch (error) {
      members.push({ index: attempt, label: `normal_${attempt}`, form: "raw-normal", lines: null, error: errorMessage(error) });
    }
  }
  return members;
}

/** Owned landing near a contact = airborne at f-1, grounded at f with an owned
 *  line contacted. Best-effort telemetry; admission (not this) is the authority. */
function ownedLandingFrameOffset(
  detection: ReturnType<typeof detectWindow>,
  contactFrame: number,
  ownedLineIds: ReadonlySet<number>,
): number | null {
  let nearestOwned: number | null = null;
  for (let frame = contactFrame - 3; frame <= contactFrame + 3; frame++) {
    if (!contactLineIdsAt(detection, frame).some((id) => ownedLineIds.has(id))) continue;
    if (nearestOwned === null || Math.abs(frame - contactFrame) < Math.abs(nearestOwned - contactFrame)) {
      nearestOwned = frame;
    }
    if (airborneAt(detection, frame - 1) === true && airborneAt(detection, frame) === false) {
      return frame - contactFrame;
    }
  }
  return nearestOwned === null ? null : nearestOwned - contactFrame;
}

function summarizeState(rows: readonly Row[]): StateSummary {
  const segment1AdmissionByFamily: Record<Family, { attempted: number; admitted: number }> = {
    "capture-arc": { attempted: 0, admitted: 0 },
    "raw-normal": { attempted: 0, admitted: 0 },
  };
  const jointByFamilyPair: Record<string, number> = {};
  const totalChargedFramesByFamily: Record<Family, number> = { "capture-arc": 0, "raw-normal": 0 };
  const failureClassCounts: Record<string, number> = {};
  const byFamily: Record<Family, FamilyClosure> = {
    "capture-arc": emptyClosure(),
    "raw-normal": emptyClosure(),
  };

  let jointPairsTotal = 0;
  for (const row of rows) {
    segment1AdmissionByFamily[row.family].attempted++;
    if (row.segment1.admitted) segment1AdmissionByFamily[row.family].admitted++;
    totalChargedFramesByFamily[row.family] += row.totalChargedFrames;
    failureClassCounts[row.failureClass] = (failureClassCounts[row.failureClass] ?? 0) + 1;

    const closure = byFamily[row.family];
    closure.segment1Attempted++;
    if (row.segment1.admitted) closure.segment1Admitted++;
    closure.totalChargedFrames += row.totalChargedFrames;
    if (row.jointAdmitted) closure.segment1WithJoint++;

    if (row.segment2 !== null) {
      for (const key of ["capture-arc", "raw-normal"] as Family[]) {
        const n = row.segment2.admittedByFamily[key];
        if (n > 0) {
          const pair = `${row.family}->${key}`;
          jointByFamilyPair[pair] = (jointByFamilyPair[pair] ?? 0) + n;
          jointPairsTotal += n;
          closure.jointPairs += n;
        }
      }
    }
  }
  for (const key of ["capture-arc", "raw-normal"] as Family[]) {
    const closure = byFamily[key];
    closure.jointPairsPerMillionFrames = closure.totalChargedFrames > 0
      ? round((closure.jointPairs * 1_000_000) / closure.totalChargedFrames)
      : null;
  }

  const returnRows = rows.flatMap((row) => row.segment2?.rows
    .map((segment) => segment.returnBoundary)
    .filter((boundary): boundary is ReturnBoundary => boundary !== null) ?? []);
  const returnBoundary: ReturnBoundarySummary | null = returnRows.length === 0 ? null : {
    capturePairsAttempted: returnRows.length,
    pairsMaterialized: returnRows.filter((boundary) => boundary.materialized).length,
    materializationFailures: returnRows.filter((boundary) => !boundary.materialized).length,
    rawNormalControlUnavailable: returnRows.filter((boundary) => boundary.materialized && !boundary.rawNormalControlAvailable).length,
    pairsWithNormalReturn: returnRows.filter((boundary) => boundary.rawNormalAdmitted > 0).length,
    totalNormalReturns: returnRows.reduce((sum, boundary) => sum + boundary.rawNormalAdmitted, 0),
    chargedFrames: returnRows.reduce((sum, boundary) => sum + boundary.chargedFrames, 0),
    recursiveTransient: (() => {
      const recurrences = returnRows
        .map((boundary) => boundary.recursiveTransient)
        .filter((recurrence): recurrence is RecursiveTransient => recurrence !== null);
      if (recurrences.length === 0) return null;
      return {
        pairsObserved: recurrences.length,
        attempted: recurrences.reduce((sum, recurrence) => sum + recurrence.attempted, 0),
        admitted: recurrences.reduce((sum, recurrence) => sum + recurrence.admitted, 0),
        materialized: recurrences.reduce((sum, recurrence) => sum + recurrence.materialized, 0),
        materializationFailures: recurrences.reduce((sum, recurrence) => sum + recurrence.materializationFailures, 0),
        chargedFrames: recurrences.reduce((sum, recurrence) => sum + recurrence.chargedFrames, 0),
        normalReturnTriples: recurrences.reduce(
          (sum, recurrence) => sum + recurrence.rows.filter((row) => row.normalReturn !== null).length,
          0,
        ),
        normalReturnControlUnavailable: recurrences.reduce(
          (sum, recurrence) => sum + recurrence.rows.filter((row) => row.normalReturn !== null && !row.normalReturn.rawNormalControlAvailable).length,
          0,
        ),
        triplesWithNormalReturn: recurrences.reduce(
          (sum, recurrence) => sum + recurrence.rows.filter((row) => (row.normalReturn?.rawNormalAdmitted ?? 0) > 0).length,
          0,
        ),
        totalNormalReturns: recurrences.reduce(
          (sum, recurrence) => sum + recurrence.rows.reduce((rowSum, row) => rowSum + (row.normalReturn?.rawNormalAdmitted ?? 0), 0),
          0,
        ),
        normalReturnFrames: recurrences.reduce(
          (sum, recurrence) => sum + recurrence.rows.reduce((rowSum, row) => rowSum + (row.normalReturn?.chargedFrames ?? 0), 0),
          0,
        ),
      };
    })(),
  };

  return { segment1AdmissionByFamily, jointByFamilyPair, jointPairsTotal, totalChargedFramesByFamily, failureClassCounts, byFamily, returnBoundary };
}

function formatStateSummary(result: StateResult): string[] {
  const s = result.summary;
  const ca = s.segment1AdmissionByFamily["capture-arc"];
  const rn = s.segment1AdmissionByFamily["raw-normal"];
  const caC = s.byFamily["capture-arc"];
  const rnC = s.byFamily["raw-normal"];
  const pairs = Object.entries(s.jointByFamilyPair).sort(([a], [b]) => a.localeCompare(b))
    .map(([pair, n]) => `${pair} ${n}`).join(", ") || "none";
  const fails = Object.entries(s.failureClassCounts).sort(([a], [b]) => a.localeCompare(b))
    .map(([cls, n]) => `${cls} ${n}`).join(", ");
  const returned = s.returnBoundary;
  return [
    `STATE ${result.id} (gap ${result.panel.currentGap}->${result.panel.outgoingGap}, interval ${result.panel.outgoingIntervalFrames}f):`,
    `  segment-1 admitted:  capture-arc ${ca.admitted}/${ca.attempted},  raw-normal ${rn.admitted}/${rn.attempted}`,
    `  joint pairs:         total ${s.jointPairsTotal}  (${pairs})`,
    `  seg-1 fits w/ joint: capture-arc ${caC.segment1WithJoint}/${caC.segment1Admitted},  raw-normal ${rnC.segment1WithJoint}/${rnC.segment1Admitted}`,
    `  charged frames:      capture-arc ${caC.totalChargedFrames},  raw-normal ${rnC.totalChargedFrames}`,
    `  joint/1e6 frames:    capture-arc ${caC.jointPairsPerMillionFrames ?? "n/a"},  raw-normal ${rnC.jointPairsPerMillionFrames ?? "n/a"}`,
    `  raw-normal joint closure @ equal frames: ${rnC.jointPairs} pairs over ${rnC.totalChargedFrames} charged frames`,
    ...(returned === null ? [] : [
      `  return boundary:     pairs ${returned.pairsMaterialized}/${returned.capturePairsAttempted}, normal-return pairs ${returned.pairsWithNormalReturn}, admissions ${returned.totalNormalReturns}`,
      `  return control:      unavailable ${returned.rawNormalControlUnavailable}, materialization failures ${returned.materializationFailures}, frames ${returned.chargedFrames}`,
      ...(returned.recursiveTransient === null ? [] : [
        `  recursive bridge:    admitted ${returned.recursiveTransient.admitted}/${returned.recursiveTransient.attempted}, materialized ${returned.recursiveTransient.materialized}, failures ${returned.recursiveTransient.materializationFailures}, frames ${returned.recursiveTransient.chargedFrames}`,
        ...(returned.recursiveTransient.normalReturnTriples === 0 ? [] : [
          `  recursive return:    normal-return triples ${returned.recursiveTransient.triplesWithNormalReturn}/${returned.recursiveTransient.normalReturnTriples}, admissions ${returned.recursiveTransient.totalNormalReturns}, unavailable ${returned.recursiveTransient.normalReturnControlUnavailable}, frames ${returned.recursiveTransient.normalReturnFrames}`,
        ]),
      ]),
    ]),
    `  failure classes:     ${fails}`,
    `  artifact: ${result.artifactPath}`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

function emptySegment1(error: string | null) {
  return {
    admitted: false,
    admissionFrames: 0,
    landingFrameOffset: null,
    landingProbeFrames: 0,
    achieved: null,
    achievedAtEnd: null,
    finalLineCount: null,
    error,
  };
}

function emptyClosure(): FamilyClosure {
  return {
    segment1Attempted: 0,
    segment1Admitted: 0,
    jointPairs: 0,
    segment1WithJoint: 0,
    totalChargedFrames: 0,
    jointPairsPerMillionFrames: null,
  };
}

/** Deterministic raw-stream seed keyed on the fixture's search seed and gap. */
function rawStreamSeed(prepared: PreparedTrajectoryFixtureCore, gapIndex: number): number {
  return (Math.imul(prepared.panel.seed | 0, 1_000_003) + gapIndex + 1) | 0;
}

/** Distinct deterministic seed per admitted segment-1 prefix at contact k+1. */
function rawStreamSeed2(prepared: PreparedTrajectoryFixtureCore, gapIndex: number, rowIndex: number): number {
  return (Math.imul(rawStreamSeed(prepared, gapIndex), 1_000_003) + rowIndex + 1) | 0;
}

/** Independent deterministic raw stream for the k+2 return observation. */
function rawStreamSeed3(seed: number, gapIndex: number, rowIndex: number): number {
  return (Math.imul((Math.imul(seed | 0, 1_000_003) + gapIndex + 1) | 0, 1_000_003) + rowIndex + 1) | 0;
}

/** Independent deterministic stream for each materialized k+3 triple return. */
function rawStreamSeed4(seed: number, gapIndex: number, rowIndex: number, thirdControlIndex: number): number {
  return (Math.imul(rawStreamSeed3(seed, gapIndex, rowIndex), 1_000_003) + thirdControlIndex + 1) | 0;
}

function roundAxes(axes: AxisValues | undefined): { air: number | null; speed: number | null; impact: number | null } | null {
  if (axes === undefined) return null;
  return {
    air: axes.air === undefined ? null : round(axes.air),
    speed: axes.speed === undefined ? null : round(axes.speed),
    impact: axes.impact === undefined ? null : round(axes.impact),
  };
}

function assertExactEnvironment(): void {
  if (process.env.LR_ENGINE !== "wasm") {
    throw new Error(`study requires LR_ENGINE=wasm; received LR_ENGINE=${process.env.LR_ENGINE ?? "(unset)"}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
