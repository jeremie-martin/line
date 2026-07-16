/**
 * Catch-Geometry Frontier (calibration-only, WASM/500k fixtures).
 *
 * Terminal question for the selection-side falsification chain (declared by the
 * campaign coordinator, 2026-07-16): does the engine's physics ADMIT catch
 * geometry that delivers windowed redirection (measured impact) at equilibrium
 * collateral (small |speed err| + |air err|) AND chains (>= MIN_LANDING_AIRBORNE_FRAMES
 * airborne frames before the next beat, survived to the beat)? Every previously
 * falsified form was a human-designed shape; none searched the raw geometry
 * space, and none enforced the chainability constraint at design time.
 *
 * Method: from three exact frozen prefix states (dense240 / ordinary /
 * frontier5), sample a ~12-parameter raw catch polyline family (entry segment
 * angle/length, 3-6 post-contact segments with per-segment turn, total post
 * length, contact y-offset, mirror orientation), admit each sample through the
 * UNCHANGED `tryCandidateLines` (survival, +/-1-frame landings, no off-beat),
 * then extend the engine with the admitted fit and ride to the next beat to
 * measure chainability. An equal-treatment raw-normal control stream (the
 * production sampler) runs first on the same state, giving the normal pool's
 * achieved reference. Every engine touch is bracketed with getSimFrames().
 *
 * This is study-only code OUTSIDE the compiler identity boundary. It reads the
 * frozen fixtures and shared primitives; no compiler source imports it, and it
 * selects/promotes nothing.
 */
import { MIN_LANDING_AIRBORNE_FRAMES } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { makeSolidLine } from "./arc.ts";
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
  velocityAt,
  type GapFit,
} from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import type { AxisValues, TrackLine } from "./types.ts";
import { contactKinematicFrameFromPlanningState, type ContactKinematicFrame } from "./trajectory/contact_kinematic_frame.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import {
  prepareStateCoupledTrajectoryFixture,
  type PreparedTrajectoryFixtureCore,
} from "./trajectory/study_context.ts";
import {
  allocateStudyArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./trajectory/study_artifact.ts";

const SCHEMA = "line.study-catch-frontier.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
  frontier5: "frontier5-b500000-c39d45c390ff.json",
} as const;
type StateId = keyof typeof FIXTURES;
type Family = "param" | "raw-normal";

// ── Sampled geometry space (declared ranges) ────────────────────────────────
const THETA_PRE_DEG = [-10, 60] as const;
const L_PRE_PX = [4, 60] as const;
const POST_SEGMENTS = [3, 6] as const; // integer inclusive
const L_POST_PX = [10, 140] as const;
const DELTA_DEG = [-15, 15] as const;
const CONTACT_Y_OFFSET_PX = [-3, 3] as const;
const MAX_POST_SEGMENTS = 6;

// ── Study budgets and thresholds ────────────────────────────────────────────
const PARAM_SAMPLES_MAX = 2_500;
const CONTROL_SAMPLES = 300;
const STATE_FRAME_BUDGET = 2_000_000; // ~6M total across three states
const CHAIN_MIN_AIRBORNE = MIN_LANDING_AIRBORNE_FRAMES; // the floor identity (=6)
const LOW_COLLATERAL = 0.03;
const ASK_TOLERANCE = 0.05;
const FRONTIER_TOP = 20;

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_catch_frontier.ts [--case=dense240|ordinary|frontier5|all] [--out-dir=DIR]",
    "",
    "Catch-geometry frontier assay (calibration-only). Requires LR_ENGINE=wasm.",
    "Samples a raw parameterized catch family per frozen state, admits via the",
    "unchanged tryCandidateLines, measures chainability to the next beat, and",
    "reports the empirical Pareto frontier of (impact, -|speed err|, -|air err|)",
    "among chainable samples vs the ask and the raw-normal control stream.",
  ].join("\n") + "\n");
  process.exit(0);
}

assertExactEnvironment();
const supportedOptions = ["--case=", "--out-dir=", "--help", "-h"];
const unknownOptions = argv.filter((value) => !supportedOptions.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknownOptions.length > 0) throw new Error(`unsupported option(s): ${unknownOptions.join(", ")}`);

const requestedCase = argument("case") ?? "all";
const stateIds: readonly StateId[] = ["dense240", "ordinary", "frontier5"];
if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
  throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
}
const selected: readonly StateId[] = requestedCase === "all" ? stateIds : [requestedCase as StateId];
const outDir = argument("out-dir") ?? "generated/studies/catch-frontier/v1";

const sourceIdentity = studySourceIdentity("scripts/v0/study_catch_frontier.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "catch-geometry-frontier.v1",
  captureBudget: 500_000,
  space: {
    thetaPreDeg: THETA_PRE_DEG,
    lPrePx: L_PRE_PX,
    postSegments: POST_SEGMENTS,
    lPostPx: L_POST_PX,
    deltaDeg: DELTA_DEG,
    contactYOffsetPx: CONTACT_Y_OFFSET_PX,
    orientation: [-1, 1],
  },
  budgets: { PARAM_SAMPLES_MAX, CONTROL_SAMPLES, STATE_FRAME_BUDGET },
  chainability: `>=${CHAIN_MIN_AIRBORNE} consecutive airborne frames immediately before the next beat AND survived to the beat`,
  admission: "tryCandidateLines (survival, +/-1 landing, no off-beat; unchanged)",
}));

const started = performance.now();
let grandTotalFrames = 0;
const runResults = selected.map((id) => runState(id));

const summaryLines: string[] = [
  `catch-geometry frontier: ${runResults.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; total charged frames ${grandTotalFrames}`,
];
for (const result of runResults) summaryLines.push(...formatStateSummary(result));
process.stdout.write(summaryLines.join("\n") + "\n");

// Positive control: the raw-normal stream must produce at least one admission on
// the ordinary state (calibration history). Zero admissions = broken observation
// path, not a physics result.
const ordinary = runResults.find((result) => result.id === "ordinary");
if (ordinary !== undefined && ordinary.summary.families["raw-normal"].admitted === 0) {
  process.stdout.write("\nCONTROL FAILURE: ordinary raw-normal produced zero admissions; the observation path is broken.\n");
  process.exitCode = 2;
}

// ─────────────────────────────────────────────────────────────────────────────

type CatchParams = {
  orient: -1 | 1;
  thetaPreDeg: number;
  lPrePx: number;
  segments: number;
  lPostPx: number;
  deltasDeg: number[]; // MAX_POST_SEGMENTS sampled; first `segments` used
  contactYOffsetPx: number;
};

type ChainMeasure = {
  rideFrames: number;
  survivedToBeat: boolean;
  terminusFrame: number;
  terminusReason: string;
  airborneMarginBeforeBeat: number;
  /** Landing events strictly inside the open interval (current beat, next beat),
   *  outside +/-1 of both — each would be an off-beat landing in the exact scorer.
   *  Not part of the DECLARED chainability definition; recorded for the strict
   *  variant because a mid-interval bounce is score-fatal in a real track. */
  offBeatLandingsBetween: number;
  lastOwnTouchOffset: number | null;
  arrivalSpeed: number | null;
  arrivalAngleDeg: number | null;
};

type Row = {
  index: number;
  family: Family;
  label: string;
  params: CatchParams | null;
  admitted: boolean;
  admissionFrames: number;
  impactTarget: number | null;
  impactAchieved: number | null;
  impactErrSigned: number | null;
  speedErrAbs: number | null;
  airErrAbs: number | null;
  collateral: number | null;
  achievedAtEnd: { air: number | null; speed: number | null; impact: number | null } | null;
  release: { speed: number | null; velocityY: number | null; airborne: boolean | null; groundedFrames: number | null } | null;
  chain: ChainMeasure | null;
  chainable: boolean;
  /** chainable AND zero off-beat landings inside the interval (score-real chaining). */
  chainableStrict: boolean;
  totalFrames: number;
  error: string | null;
};

type FamilySummary = {
  attempted: number;
  admitted: number;
  chainable: number;
  chainableStrict: number;
  chainableLowCollateral: number;
  bestImpactChainableStrictLowCollateral: number | null;
  bestImpactAdmitted: number | null;
  bestImpactChainable: number | null;
  bestImpactChainableLowCollateral: number | null;
  totalChargedFrames: number;
};

type RegionStat = { min: number; max: number; median: number; iqr: number; rangeShare: number };

type StateSummary = {
  ask: number;
  trueTargets: { air: number | null; speed: number | null; impact: number | null };
  families: Record<Family, FamilySummary>;
  frontier: Array<{
    index: number;
    family: Family;
    impactAchieved: number;
    speedErrAbs: number;
    airErrAbs: number;
    collateral: number;
    airborneMargin: number;
    params: CatchParams | null;
  }>;
  reachesAskMinusTolerance: boolean;
  maxChainableImpactAtLowCollateral: number | null;
  winningRegion: {
    definition: string;
    count: number;
    orientSplit: { minus: number; plus: number } | null;
    stats: Record<string, RegionStat> | null;
  };
  verdict: string;
};

type StateResult = {
  id: StateId;
  artifactPath: string;
  panel: PreparedTrajectoryFixtureCore["panel"];
  summary: StateSummary;
  stateFrames: number;
  paramSamplesRun: number;
  budgetExhausted: boolean;
};

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  // prepareStateCoupledTrajectoryFixture fails closed on any replay mismatch.
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") {
    throw new Error(`catch frontier accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
  }
  const trueTargets = prepared.ctx.gapAxisTargets[prepared.current.index] ?? {};
  const ask = trueTargets.impact ?? prepared.current.targets.impact;
  if (ask === undefined) {
    throw new Error(`fixture ${id} target gap ${prepared.current.index} does not author impact; the frontier question is undefined here`);
  }
  const allContactFrames = prepared.ctx.allContactFrames;
  const axisEnd = axisLookaheadEndFrame(prepared.current, allContactFrames);
  const kinematic = contactKinematicFrameFromPlanningState(prepared.state, prepared.frame, prepared.current.targets);

  let stateFrames = 0;
  const charge = (frames: number): void => {
    stateFrames += frames;
    grandTotalFrames += frames;
  };

  const rows: Row[] = [];
  let rowIndex = 0;

  // 1) Raw-normal control stream first (never starved by the frame budget).
  const controlRng = makeRng(controlStreamSeed(prepared));
  for (let attempt = 0; attempt < CONTROL_SAMPLES; attempt++) {
    clearImpactTemplateMarker();
    let lines: TrackLine[] | null = null;
    let error: string | null = null;
    try {
      const geometry = sampleArcPlacementGeometry(
        controlRng,
        prepared.probe.refX,
        prepared.probe.refY,
        prepared.current.targets,
        prepared.probe.targetState,
        attempt,
        prepared.current,
        prepared.lineIdStart,
        "normal",
        allContactFrames,
      );
      lines = geometry.lines;
    } catch (err) {
      error = errorMessage(err);
    }
    rows.push(evaluateRow(
      prepared, "raw-normal", `normal_${attempt}`, rowIndex++, null, lines, error,
      axisEnd, allContactFrames, trueTargets, charge,
    ));
  }

  // 2) Parameterized catch family until the sample cap or the frame budget.
  const paramRng = makeRng(paramStreamSeed(prepared));
  let paramSamplesRun = 0;
  let budgetExhausted = false;
  for (let sample = 0; sample < PARAM_SAMPLES_MAX; sample++) {
    if (stateFrames >= STATE_FRAME_BUDGET) {
      budgetExhausted = true;
      break;
    }
    const params = sampleCatchParams(paramRng);
    let lines: TrackLine[] | null = null;
    let error: string | null = null;
    try {
      lines = buildCatchLines(kinematic, params, prepared.lineIdStart);
    } catch (err) {
      error = errorMessage(err);
    }
    rows.push(evaluateRow(
      prepared, "param", `param_${sample}`, rowIndex++, params, lines, error,
      axisEnd, allContactFrames, trueTargets, charge,
    ));
    paramSamplesRun++;
  }

  const summary = summarizeState(rows, ask, trueTargets, id);
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
      "Terminal selection-chain question: does engine physics admit catch geometry delivering windowed redirection at equilibrium collateral AND chainability, anywhere in a raw sampled geometry space no human-designed family covered?",
      "Admission is the unchanged tryCandidateLines; chainability is measured on the extended engine to the next beat; every engine touch is charged via getSimFrames().",
      "Retain every row; no control, candidate, source default, or promotion is selected here.",
    ],
    status: {
      productionIntegration: "forbidden: calibration study outside the compiler identity boundary; not a candidate source, selector, or promotion command",
      cohortPolicy: "calibration only; a separately frozen validation cohort is required before any predictive claim",
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
      space: {
        thetaPreDeg: THETA_PRE_DEG,
        lPrePx: L_PRE_PX,
        postSegments: POST_SEGMENTS,
        lPostPx: L_POST_PX,
        deltaDeg: DELTA_DEG,
        contactYOffsetPx: CONTACT_Y_OFFSET_PX,
        orientation: [-1, 1],
        anchoring: "contact point = fixture target-frame reference (sled contact point) + sampled screen-y offset; entry incidence relative to CoM heading (impact is a CoM-redirection metric)",
      },
      budgets: { PARAM_SAMPLES_MAX, CONTROL_SAMPLES, STATE_FRAME_BUDGET },
      chainability: {
        minAirborneFrames: CHAIN_MIN_AIRBORNE,
        rule: "consecutive airborne frames immediately before the next beat (the detector's landing floor identity) AND terminus at/after the beat",
      },
      thresholds: { LOW_COLLATERAL, ASK_TOLERANCE },
      admission: "tryCandidateLines(engine, gap, lines, lineIdStart, allContactFrames, axisLookaheadEndFrame, gap.targets, true, undefined, probe.preTargetSledTrace)",
      errorsMeasuredAgainst: "true per-gap axis targets (ctx.gapAxisTargets), matching the exact scorer",
    },
    stateFrames,
    paramSamplesRun,
    budgetExhausted,
    summary,
    rows,
  };

  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, document, "catch-frontier artifact");
  return { id, artifactPath, panel: prepared.panel, summary, stateFrames, paramSamplesRun, budgetExhausted };
}

// ─────────────────────────────────────────────────────────────────────────────

function sampleCatchParams(rng: () => number): CatchParams {
  const uniform = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const orient: -1 | 1 = rng() < 0.5 ? -1 : 1;
  const thetaPreDeg = uniform(THETA_PRE_DEG[0], THETA_PRE_DEG[1]);
  const lPrePx = uniform(L_PRE_PX[0], L_PRE_PX[1]);
  const segments = POST_SEGMENTS[0] + Math.floor(rng() * (POST_SEGMENTS[1] - POST_SEGMENTS[0] + 1));
  const lPostPx = uniform(L_POST_PX[0], L_POST_PX[1]);
  const deltasDeg: number[] = [];
  for (let index = 0; index < MAX_POST_SEGMENTS; index++) deltasDeg.push(uniform(DELTA_DEG[0], DELTA_DEG[1]));
  const contactYOffsetPx = uniform(CONTACT_Y_OFFSET_PX[0], CONTACT_Y_OFFSET_PX[1]);
  return { orient, thetaPreDeg, lPrePx, segments: Math.min(segments, POST_SEGMENTS[1]), lPostPx, deltasDeg, contactYOffsetPx };
}

/**
 * Realize the sampled catch as a travel-ordered polyline: one pre-contact entry
 * segment ending at the contact point, then `segments` chained post-contact
 * segments with cumulative per-segment turns. Angles follow the house
 * convention (heading degrees, unit = (cos, sin) in screen coords); `orient`
 * makes both mirror responses explicit rather than hiding one in the formula
 * (the capture-arc lesson).
 */
function buildCatchLines(frame: ContactKinematicFrame, params: CatchParams, lineIdStart: number): TrackLine[] {
  const heading = frame.com.headingDeg;
  const contact = {
    x: frame.anchor.reference.x,
    y: frame.anchor.reference.y + params.contactYOffsetPx,
  };
  const entryAngleDeg = heading + params.orient * params.thetaPreDeg;
  const entryTangent = unit(entryAngleDeg);
  const entryStart = {
    x: contact.x - entryTangent.x * params.lPrePx,
    y: contact.y - entryTangent.y * params.lPrePx,
  };
  const lines: TrackLine[] = [];
  lines.push(makeSolidLine(lineIdStart + lines.length, entryStart.x, entryStart.y, contact.x, contact.y));
  const segmentPx = params.lPostPx / params.segments;
  let point = { ...contact };
  let angleDeg = entryAngleDeg;
  for (let index = 0; index < params.segments; index++) {
    angleDeg += params.orient * params.deltasDeg[index];
    const tangent = unit(angleDeg);
    const next = { x: point.x + tangent.x * segmentPx, y: point.y + tangent.y * segmentPx };
    lines.push(makeSolidLine(lineIdStart + lines.length, point.x, point.y, next.x, next.y));
    point = next;
  }
  for (const line of lines) {
    for (const value of [line.x1, line.y1, line.x2, line.y2]) {
      if (!Number.isFinite(value)) throw new Error("catch geometry produced a non-finite coordinate");
    }
  }
  return lines;
}

function evaluateRow(
  prepared: PreparedTrajectoryFixtureCore,
  family: Family,
  label: string,
  index: number,
  params: CatchParams | null,
  lines: TrackLine[] | null,
  geometryError: string | null,
  axisEnd: number,
  allContactFrames: number[],
  trueTargets: AxisValues,
  charge: (frames: number) => void,
): Row {
  const empty: Row = {
    index, family, label, params,
    admitted: false, admissionFrames: 0,
    impactTarget: trueTargets.impact ?? null,
    impactAchieved: null, impactErrSigned: null,
    speedErrAbs: null, airErrAbs: null, collateral: null,
    achievedAtEnd: null, release: null, chain: null, chainable: false, chainableStrict: false,
    totalFrames: 0, error: geometryError,
  };
  if (lines === null) return empty;

  const before = getSimFrames();
  const fit = tryCandidateLines(
    prepared.engine,
    prepared.current,
    lines,
    prepared.lineIdStart,
    allContactFrames,
    axisEnd,
    prepared.current.targets,
    true,
    undefined,
    prepared.probe.preTargetSledTrace,
  ) as GapFit | null;
  const admissionFrames = getSimFrames() - before;
  charge(admissionFrames);

  if (fit === null) {
    return { ...empty, admissionFrames, totalFrames: admissionFrames };
  }

  const achieved = fit.achievedAtEnd ?? fit.achieved;
  const impactAchieved = achieved.impact ?? null;
  const impactTarget = trueTargets.impact ?? null;
  const speedErrAbs = trueTargets.speed !== undefined && achieved.speed !== undefined
    ? Math.abs(achieved.speed - trueTargets.speed)
    : null;
  const airErrAbs = trueTargets.air !== undefined && achieved.air !== undefined
    ? Math.abs(achieved.air - trueTargets.air)
    : null;
  const collateral = Math.max(speedErrAbs ?? 0, airErrAbs ?? 0);

  const chain = measureChain(prepared, fit, charge);
  const chainable = chain.survivedToBeat && chain.airborneMarginBeforeBeat >= CHAIN_MIN_AIRBORNE;
  const chainableStrict = chainable && chain.offBeatLandingsBetween === 0;

  return {
    index, family, label, params,
    admitted: true,
    admissionFrames,
    impactTarget,
    impactAchieved: impactAchieved === null ? null : round(impactAchieved),
    impactErrSigned: impactAchieved !== null && impactTarget !== null ? round(impactAchieved - impactTarget) : null,
    speedErrAbs: speedErrAbs === null ? null : round(speedErrAbs),
    airErrAbs: airErrAbs === null ? null : round(airErrAbs),
    collateral: round(collateral),
    achievedAtEnd: {
      air: achieved.air === undefined ? null : round(achieved.air),
      speed: achieved.speed === undefined ? null : round(achieved.speed),
      impact: achieved.impact === undefined ? null : round(achieved.impact),
    },
    release: {
      speed: fit.releaseSpeed === undefined ? null : round(fit.releaseSpeed),
      velocityY: fit.releaseVelocityY === undefined ? null : round(fit.releaseVelocityY),
      airborne: fit.releaseAirborne ?? null,
      groundedFrames: fit.releaseGroundedFrames ?? null,
    },
    chain,
    chainable,
    chainableStrict,
    totalFrames: admissionFrames + chain.rideFrames,
    error: null,
  };
}

/** Extend the immutable prefix engine with the admitted fit and ride to the
 *  next beat. The chainability margin is the count of consecutive airborne
 *  frames immediately before the beat — the detector's landing floor identity
 *  (MIN_LANDING_AIRBORNE_FRAMES) decides whether the NEXT catch is possible. */
function measureChain(
  prepared: PreparedTrajectoryFixtureCore,
  fit: GapFit,
  charge: (frames: number) => void,
): ChainMeasure {
  const engine2 = prepared.engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
  const beat = prepared.outgoing.endFrame;
  const before = getSimFrames();
  const detection = detectWindow(engine2, prepared.current.endFrame, beat + 1);
  const rideFrames = getSimFrames() - before;
  charge(rideFrames);

  const survivedToBeat = detection.terminus.frame >= beat || detection.terminus.reason === "endOfSpec";
  let airborneMarginBeforeBeat = 0;
  for (let frame = beat - 1; frame > prepared.current.endFrame; frame--) {
    if (airborneAt(detection, frame) === true) airborneMarginBeforeBeat++;
    else break;
  }
  const ownedIds = new Set(fit.lines.map((line: TrackLine) => line.id));
  let lastOwnTouch: number | null = null;
  for (let frame = prepared.current.endFrame; frame < beat; frame++) {
    if (contactLineIdsAt(detection, frame).some((id) => ownedIds.has(id))) lastOwnTouch = frame;
  }
  const offBeatLandingsBetween = detection.events.filter((event: { type: string; frame: number }) =>
    event.type === "landing" && event.frame > prepared.current.endFrame + 1 && event.frame < beat - 1
  ).length;
  const arrival = velocityAt(detection, beat);
  return {
    rideFrames,
    survivedToBeat,
    terminusFrame: detection.terminus.frame,
    terminusReason: detection.terminus.reason,
    airborneMarginBeforeBeat,
    offBeatLandingsBetween,
    lastOwnTouchOffset: lastOwnTouch === null ? null : lastOwnTouch - prepared.current.endFrame,
    arrivalSpeed: arrival === undefined ? null : round(Math.hypot(arrival.x, arrival.y)),
    arrivalAngleDeg: arrival === undefined ? null : round((Math.atan2(arrival.y, arrival.x) * 180) / Math.PI),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function summarizeState(rows: readonly Row[], ask: number, trueTargets: AxisValues, id: StateId): StateSummary {
  const families: Record<Family, FamilySummary> = {
    "param": emptyFamilySummary(),
    "raw-normal": emptyFamilySummary(),
  };
  for (const row of rows) {
    const summary = families[row.family];
    summary.attempted++;
    summary.totalChargedFrames += row.totalFrames;
    if (!row.admitted) continue;
    summary.admitted++;
    if (row.impactAchieved !== null) {
      summary.bestImpactAdmitted = maxOrNull(summary.bestImpactAdmitted, row.impactAchieved);
    }
    if (!row.chainable) continue;
    summary.chainable++;
    if (row.chainableStrict) summary.chainableStrict++;
    if (row.impactAchieved !== null) {
      summary.bestImpactChainable = maxOrNull(summary.bestImpactChainable, row.impactAchieved);
    }
    if (row.collateral !== null && row.collateral <= LOW_COLLATERAL) {
      summary.chainableLowCollateral++;
      if (row.impactAchieved !== null) {
        summary.bestImpactChainableLowCollateral = maxOrNull(summary.bestImpactChainableLowCollateral, row.impactAchieved);
        if (row.chainableStrict) {
          summary.bestImpactChainableStrictLowCollateral = maxOrNull(summary.bestImpactChainableStrictLowCollateral, row.impactAchieved);
        }
      }
    }
  }

  // Pareto frontier among CHAINABLE samples on (impact ↑, |speed err| ↓, |air err| ↓).
  const chainableRows = rows.filter((row) =>
    row.chainable && row.impactAchieved !== null && row.speedErrAbs !== null && row.airErrAbs !== null,
  );
  const frontierRows = chainableRows.filter((candidate) =>
    !chainableRows.some((other) =>
      other !== candidate &&
      other.impactAchieved! >= candidate.impactAchieved! &&
      other.speedErrAbs! <= candidate.speedErrAbs! &&
      other.airErrAbs! <= candidate.airErrAbs! &&
      (other.impactAchieved! > candidate.impactAchieved! ||
        other.speedErrAbs! < candidate.speedErrAbs! ||
        other.airErrAbs! < candidate.airErrAbs!)
    ),
  );
  const frontier = frontierRows
    .slice()
    .sort((left, right) => right.impactAchieved! - left.impactAchieved!)
    .slice(0, FRONTIER_TOP)
    .map((row) => ({
      index: row.index,
      family: row.family,
      impactAchieved: row.impactAchieved!,
      speedErrAbs: row.speedErrAbs!,
      airErrAbs: row.airErrAbs!,
      collateral: row.collateral!,
      airborneMargin: row.chain!.airborneMarginBeforeBeat,
      params: row.params,
    }));

  const lowCollateralChainable = chainableRows.filter((row) => row.collateral! <= LOW_COLLATERAL);
  const maxChainLow = lowCollateralChainable.length > 0
    ? Math.max(...lowCollateralChainable.map((row) => row.impactAchieved!))
    : null;
  const reaches = maxChainLow !== null && maxChainLow >= ask - ASK_TOLERANCE;

  // Winning region: the chainable low-collateral samples within ASK_TOLERANCE of
  // the best such impact — is that region compact/describable in parameter space?
  const winners = lowCollateralChainable.filter((row) =>
    maxChainLow !== null && row.impactAchieved! >= maxChainLow - ASK_TOLERANCE && row.params !== null,
  );
  const winningRegion = {
    definition: `chainable AND collateral<=${LOW_COLLATERAL} AND impact >= bestChainableLowCollateral-${ASK_TOLERANCE}, param family only`,
    count: winners.length,
    orientSplit: winners.length > 0
      ? {
        minus: winners.filter((row) => row.params!.orient === -1).length,
        plus: winners.filter((row) => row.params!.orient === 1).length,
      }
      : null,
    stats: winners.length > 0 ? regionStats(winners.map((row) => row.params!)) : null,
  };

  const verdict = maxChainLow === null
    ? `no chainable low-collateral sample exists in ${chainableRows.length} chainable / ${rows.filter((r) => r.admitted).length} admitted samples — the frontier confirms the equilibrium (ask ${round(ask)})`
    : reaches
      ? `physics admits it: max chainable impact at <=${LOW_COLLATERAL} collateral = ${round(maxChainLow)} vs ask ${round(ask)} (>= ask-${ASK_TOLERANCE}); winning region count ${winners.length}`
      : `the frontier confirms the equilibrium: max chainable impact at <=${LOW_COLLATERAL} collateral = ${round(maxChainLow)} vs ask ${round(ask)} (short by ${round(ask - maxChainLow)})`;

  return {
    ask: round(ask),
    trueTargets: {
      air: trueTargets.air === undefined ? null : round(trueTargets.air),
      speed: trueTargets.speed === undefined ? null : round(trueTargets.speed),
      impact: trueTargets.impact === undefined ? null : round(trueTargets.impact),
    },
    families,
    frontier,
    reachesAskMinusTolerance: reaches,
    maxChainableImpactAtLowCollateral: maxChainLow === null ? null : round(maxChainLow),
    winningRegion,
    verdict: `${id}: ${verdict}`,
  };
}

function regionStats(params: readonly CatchParams[]): Record<string, RegionStat> {
  const dims: Record<string, { values: number[]; range: [number, number] }> = {
    thetaPreDeg: { values: params.map((p) => p.thetaPreDeg), range: [THETA_PRE_DEG[0], THETA_PRE_DEG[1]] },
    lPrePx: { values: params.map((p) => p.lPrePx), range: [L_PRE_PX[0], L_PRE_PX[1]] },
    segments: { values: params.map((p) => p.segments), range: [POST_SEGMENTS[0], POST_SEGMENTS[1]] },
    lPostPx: { values: params.map((p) => p.lPostPx), range: [L_POST_PX[0], L_POST_PX[1]] },
    meanDeltaDeg: {
      values: params.map((p) => p.deltasDeg.slice(0, p.segments).reduce((sum, value) => sum + value, 0) / p.segments),
      range: [DELTA_DEG[0], DELTA_DEG[1]],
    },
    totalTurnDeg: {
      values: params.map((p) => p.deltasDeg.slice(0, p.segments).reduce((sum, value) => sum + value, 0)),
      range: [DELTA_DEG[0] * POST_SEGMENTS[1], DELTA_DEG[1] * POST_SEGMENTS[1]],
    },
    contactYOffsetPx: { values: params.map((p) => p.contactYOffsetPx), range: [CONTACT_Y_OFFSET_PX[0], CONTACT_Y_OFFSET_PX[1]] },
  };
  const out: Record<string, RegionStat> = {};
  for (const [name, dim] of Object.entries(dims)) {
    const sorted = dim.values.slice().sort((a, b) => a - b);
    const quantile = (q: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
    const iqr = quantile(0.75) - quantile(0.25);
    out[name] = {
      min: round(sorted[0]),
      max: round(sorted[sorted.length - 1]),
      median: round(quantile(0.5)),
      iqr: round(iqr),
      rangeShare: round(iqr / (dim.range[1] - dim.range[0])),
    };
  }
  return out;
}

function formatStateSummary(result: StateResult): string[] {
  const s = result.summary;
  const p = s.families["param"];
  const n = s.families["raw-normal"];
  const top = s.frontier.slice(0, 5)
    .map((f) => `imp ${round3(f.impactAchieved)} sp ${round3(f.speedErrAbs)} air ${round3(f.airErrAbs)} margin ${f.airborneMargin} (${f.family})`)
    .join(" | ") || "none";
  return [
    `STATE ${result.id} (gap ${result.panel.currentGap}->${result.panel.outgoingGap}, interval ${result.panel.outgoingIntervalFrames}f, ask ${s.ask}):`,
    `  param:      attempted ${p.attempted}, admitted ${p.admitted}, chainable ${p.chainable} (strict ${p.chainableStrict}), chainable@lowCol ${p.chainableLowCollateral}; best impact adm/chain/chain@lowCol/strict@lowCol = ${fmt(p.bestImpactAdmitted)}/${fmt(p.bestImpactChainable)}/${fmt(p.bestImpactChainableLowCollateral)}/${fmt(p.bestImpactChainableStrictLowCollateral)}`,
    `  raw-normal: attempted ${n.attempted}, admitted ${n.admitted}, chainable ${n.chainable} (strict ${n.chainableStrict}), chainable@lowCol ${n.chainableLowCollateral}; best impact adm/chain/chain@lowCol/strict@lowCol = ${fmt(n.bestImpactAdmitted)}/${fmt(n.bestImpactChainable)}/${fmt(n.bestImpactChainableLowCollateral)}/${fmt(n.bestImpactChainableStrictLowCollateral)}`,
    `  frontier top-5: ${top}`,
    `  VERDICT: ${s.verdict}`,
    `  frames: ${result.stateFrames} (param samples run ${result.paramSamplesRun}${result.budgetExhausted ? ", frame budget exhausted" : ""})`,
    `  artifact: ${result.artifactPath}`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

function emptyFamilySummary(): FamilySummary {
  return {
    attempted: 0,
    admitted: 0,
    chainable: 0,
    chainableStrict: 0,
    chainableLowCollateral: 0,
    bestImpactChainableStrictLowCollateral: null,
    bestImpactAdmitted: null,
    bestImpactChainable: null,
    bestImpactChainableLowCollateral: null,
    totalChargedFrames: 0,
  };
}

/** Deterministic stream seeds keyed on the fixture's public seed and gap. */
function controlStreamSeed(prepared: PreparedTrajectoryFixtureCore): number {
  return (Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.current.index + 1) | 0;
}

function paramStreamSeed(prepared: PreparedTrajectoryFixtureCore): number {
  return (Math.imul(controlStreamSeed(prepared), 998_244_353) + 17) | 0;
}

function unit(angleDeg: number): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function maxOrNull(current: number | null, value: number): number {
  return current === null ? value : Math.max(current, value);
}

function fmt(value: number | null): string {
  return value === null ? "n/a" : String(round3(value));
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

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
