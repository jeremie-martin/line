/**
 * Calibration-only feasibility assay for the body-conformal swept sled
 * envelope declared in compiler-improvement-campaign.md.
 *
 * It has exactly one deterministic current-contact construction per frozen
 * state.  A fixed normal stream at the following contact is a return probe,
 * never a chooser or feedback channel for the contour.
 */
import { makeRng } from "../lib/rng.ts";
import {
  clearImpactTemplateMarker,
  hasPreTargetSledProximityFromTrace,
  sampleArcPlacementGeometry,
} from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import { airborneAt, engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import type { AxisValues, TrackLine } from "./types.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { postimpactEngineCollisionWitnessesForLineIds } from "./trajectory/postimpact_trace.ts";
import { prepareStateCoupledTrajectoryFixture, type PreparedTrajectoryFixtureCore } from "./trajectory/study_context.ts";
import {
  allocateStudyArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./trajectory/study_artifact.ts";
import { realizeSweptSledEnvelope, type SweptSledEnvelope } from "./trajectory/swept_sled_envelope.ts";

const SCHEMA = "line.study-swept-sled-envelope.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
} as const;
const NORMAL_RETURN_ATTEMPTS = 24;
const MIN_SLED_ZERO_FRICTION_UPDATES = 3;

type StateId = keyof typeof FIXTURES;

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_swept_sled_envelope.ts [--case=dense240|ordinary|all] [--out-dir=DIR]\\n" +
    "One deterministic body-conformal swept-sled contour plus a fixed normal return probe.\\n",
  );
  process.exit(0);
}
assertExactEnvironment();
const supportedOptions = ["--case=", "--out-dir=", "--help", "-h"];
const unknownOptions = argv.filter((value) => !supportedOptions.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknownOptions.length > 0) throw new Error(`unsupported option(s): ${unknownOptions.join(", ")}`);
const requestedCase = argument("case") ?? "all";
const stateIds: readonly StateId[] = ["dense240", "ordinary"];
if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
  throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
}
const selected = requestedCase === "all" ? stateIds : [requestedCase as StateId];
const outDir = argument("out-dir") ?? "generated/studies/swept-sled-envelope/v1";
const sourceIdentity = studySourceIdentity("scripts/v0/study_swept_sled_envelope.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "body-conformal-swept-sled-envelope.v1",
  fixtures: FIXTURES,
  inboundContactFrame: -1,
  responseHorizonFrames: 6,
  currentAdmission: "unchanged tryCandidateLines",
  return: {
    normalAttempts: NORMAL_RETURN_ATTEMPTS,
    admission: "unchanged tryCandidateLines from exact current-contour engine state",
  },
  topology: { minimumZeroFrictionSledUpdates: MIN_SLED_ZERO_FRICTION_UPDATES },
}));

const started = performance.now();
let totalFrames = 0;
const results = selected.map((id) => runState(id));
process.stdout.write([
  `swept sled envelope: ${results.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; charged frames ${totalFrames}`,
  ...results.map(formatResult),
].join("\n") + "\n");

type ContactTopology = {
  peg: number;
  sledZeroFriction: number;
  feetZeroFriction: number;
  total: number;
};

type ReturnMeasure = {
  replayFrames: number;
  survivedToBeat: boolean;
  terminusFrame: number;
  terminusReason: string;
  airborneMarginBeforeBeat: number;
};

type NextNormalMeasure = {
  attempted: number;
  available: number;
  admitted: number;
  frames: number;
  firstAdmittedAttempt: number | null;
  errors: string[];
};

type StateResult = {
  id: StateId;
  artifactPath: string;
  panel: PreparedTrajectoryFixtureCore["panel"];
  envelope: SweptSledEnvelope;
  current: {
    admitted: boolean;
    admissionFrames: number;
    preTargetPreclearRejected: boolean | null;
    impactTarget: number | null;
    impactAchieved: number | null;
    impactErrSigned: number | null;
    targetContact: ContactTopology | null;
    error: string | null;
  };
  return: ReturnMeasure | null;
  nextNormal: NextNormalMeasure | null;
  chargedFrames: number;
  verdict: "pass" | "retire" | "inconclusive";
  reasons: string[];
};

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") throw new Error(`fixture ${id} is not calibration`);
  const kinematic = contactKinematicFrameFromPlanningState(prepared.state, prepared.frame, prepared.current.targets);
  const envelope = realizeSweptSledEnvelope(prepared.state, kinematic, prepared.lineIdStart);
  let chargedFrames = 0;
  const charge = (frames: number): void => {
    chargedFrames += frames;
    totalFrames += frames;
  };
  const target = prepared.ctx.gapAxisTargets[prepared.current.index] ?? prepared.current.targets;
  const emptyCurrent: StateResult["current"] = {
    admitted: false, admissionFrames: 0,
    preTargetPreclearRejected: null,
    impactTarget: target.impact ?? null, impactAchieved: null, impactErrSigned: null,
    targetContact: null, error: null,
  };
  let current = emptyCurrent;
  let returnMeasure: ReturnMeasure | null = null;
  let nextNormal: NextNormalMeasure | null = null;
  const reasons: string[] = [];

  if (envelope.status !== "ready") {
    reasons.push(`construction unavailable: ${envelope.reason}`);
  } else {
    const axisEnd = axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames);
    const preTargetPreclearRejected = hasPreTargetSledProximityFromTrace(
      prepared.probe.preTargetSledTrace(),
      envelope.lines,
    );
    const before = getSimFrames();
    const fit = tryCandidateLines(
      prepared.engine,
      prepared.current,
      envelope.lines,
      prepared.lineIdStart,
      prepared.ctx.allContactFrames,
      axisEnd,
      prepared.current.targets,
      true,
      undefined,
      prepared.probe.preTargetSledTrace,
    ) as GapFit | null;
    const admissionFrames = getSimFrames() - before;
    charge(admissionFrames);
    if (fit === null) {
      current = {
        ...emptyCurrent,
        admissionFrames,
        preTargetPreclearRejected,
        error: preTargetPreclearRejected
          ? "pre-target proximity guard rejects swept contour before physics replay"
          : "unchanged current gate rejected contour after preclear",
      };
      reasons.push("current contour not admitted");
    } else {
      const achieved = fit.achievedAtEnd ?? fit.achieved;
      const achievedImpact = achieved.impact ?? null;
      const topology = measureTargetTopology(prepared, fit);
      current = {
        admitted: true,
        admissionFrames,
        preTargetPreclearRejected,
        impactTarget: target.impact ?? null,
        impactAchieved: achievedImpact === null ? null : round(achievedImpact),
        impactErrSigned: achievedImpact === null || target.impact === undefined ? null : round(achievedImpact - target.impact),
        targetContact: topology,
        error: null,
      };
      if (topology === null || topology.sledZeroFriction < MIN_SLED_ZERO_FRICTION_UPDATES) {
        reasons.push(`target zero-friction sled topology below ${MIN_SLED_ZERO_FRICTION_UPDATES}`);
      }
      const afterCurrent = prepared.engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
      returnMeasure = measureReturn(prepared, afterCurrent, charge);
      if (!returnMeasure.survivedToBeat || returnMeasure.airborneMarginBeforeBeat < 6) {
        reasons.push("no six-frame airborne return to next beat");
      }
      nextNormal = measureNextNormal(prepared, afterCurrent, fit.lines.length, charge);
      if (nextNormal.admitted === 0) reasons.push("no normal next-contact admission");
    }
  }

  const denseOrOrdinaryFailure = reasons.length > 0;
  const verdict: StateResult["verdict"] = denseOrOrdinaryFailure ? "retire" : "pass";
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
      "Falsify one deterministic body-conformal, swept full-sled terrain contour as a new continuous multi-contact state-to-geometry component.",
      "The post-contour normal stream is a fixed return test only and cannot select or modify the contour.",
      "Calibration-only observation: it does not create a compiler candidate source, selector, rank term, or benchmark attempt.",
    ],
    status: { productionIntegration: "forbidden", cohortPolicy: "calibration only" },
    argv: [...argv],
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
      component: "full sled pose swept from H-1 through the six-frame state-predicted response, gravity-facing upper monotone hull, one finite one-way polyline",
      noCandidateFeedback: true,
      currentAdmission: "unchanged tryCandidateLines",
      return: { normalAttempts: NORMAL_RETURN_ATTEMPTS, currentToNextReplay: "charged detectWindow", nextAdmission: "unchanged tryCandidateLines" },
      topologyMinimum: MIN_SLED_ZERO_FRICTION_UPDATES,
    },
    result: { id, envelope, current, return: returnMeasure, nextNormal, chargedFrames, verdict, reasons },
  };
  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, document, "swept sled envelope artifact");
  return { id, artifactPath, panel: prepared.panel, envelope, current, return: returnMeasure, nextNormal, chargedFrames, verdict, reasons };
}

function measureTargetTopology(prepared: PreparedTrajectoryFixtureCore, fit: GapFit): ContactTopology | null {
  try {
    const engine = prepared.engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
    const lineIds = new Set(fit.lines.map((line: TrackLine) => line.id));
    const points = postimpactEngineCollisionWitnessesForLineIds(engine, prepared.current.endFrame, lineIds)
      .flatMap((hit) => hit.pointIds);
    return {
      peg: points.filter((point) => point === "PEG").length,
      sledZeroFriction: points.filter((point) => point === "TAIL" || point === "NOSE" || point === "STRING").length,
      feetZeroFriction: points.filter((point) => point === "LFOOT" || point === "RFOOT").length,
      total: points.length,
    };
  } catch {
    return null;
  }
}

function measureReturn(
  prepared: PreparedTrajectoryFixtureCore,
  engine: unknown,
  charge: (frames: number) => void,
): ReturnMeasure {
  const before = getSimFrames();
  const detection = detectWindow(engine, prepared.current.endFrame, prepared.outgoing.endFrame + 1);
  const replayFrames = getSimFrames() - before;
  charge(replayFrames);
  const survivedToBeat = detection.terminus.frame >= prepared.outgoing.endFrame || detection.terminus.reason === "endOfSpec";
  let airborneMarginBeforeBeat = 0;
  for (let frame = prepared.outgoing.endFrame - 1; frame > prepared.current.endFrame; frame--) {
    if (airborneAt(detection, frame) === true) airborneMarginBeforeBeat++;
    else break;
  }
  return {
    replayFrames,
    survivedToBeat,
    terminusFrame: detection.terminus.frame,
    terminusReason: detection.terminus.reason,
    airborneMarginBeforeBeat,
  };
}

function measureNextNormal(
  prepared: PreparedTrajectoryFixtureCore,
  engine: any,
  currentLineCount: number,
  charge: (frames: number) => void,
): NextNormalMeasure {
  const errors: string[] = [];
  const beforeProbe = getSimFrames();
  let nextProbe: ReturnType<typeof getCandidateProbe>;
  try {
    nextProbe = getCandidateProbe(engine, prepared.outgoing, prepared.ctx);
  } catch (error) {
    charge(getSimFrames() - beforeProbe);
    return { attempted: 0, available: 0, admitted: 0, frames: 0, firstAdmittedAttempt: null, errors: [errorMessage(error)] };
  }
  const probeFrames = getSimFrames() - beforeProbe;
  charge(probeFrames);
  const rng = makeRng((Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.outgoing.index + 0x51ed) | 0);
  const axisEnd = axisLookaheadEndFrame(prepared.outgoing, prepared.ctx.allContactFrames);
  let available = 0;
  let admitted = 0;
  let attemptFrames = 0;
  let firstAdmittedAttempt: number | null = null;
  const lineIdStart = prepared.lineIdStart + currentLineCount;
  for (let attempt = 0; attempt < NORMAL_RETURN_ATTEMPTS; attempt++) {
    clearImpactTemplateMarker();
    let lines: TrackLine[];
    try {
      lines = sampleArcPlacementGeometry(
        rng,
        nextProbe.refX,
        nextProbe.refY,
        prepared.outgoing.targets,
        nextProbe.targetState,
        attempt,
        prepared.outgoing,
        lineIdStart,
        "normal",
        prepared.ctx.allContactFrames,
      ).lines;
      available++;
    } catch (error) {
      errors.push(errorMessage(error));
      continue;
    }
    const before = getSimFrames();
    const fit = tryCandidateLines(
      engine,
      prepared.outgoing,
      lines,
      lineIdStart,
      prepared.ctx.allContactFrames,
      axisEnd,
      prepared.outgoing.targets,
      true,
      undefined,
      nextProbe.preTargetSledTrace,
    ) as GapFit | null;
    const frames = getSimFrames() - before;
    attemptFrames += frames;
    charge(frames);
    if (fit !== null) {
      admitted++;
      if (firstAdmittedAttempt === null) firstAdmittedAttempt = attempt;
    }
  }
  return {
    attempted: NORMAL_RETURN_ATTEMPTS,
    available,
    admitted,
    frames: probeFrames + attemptFrames,
    firstAdmittedAttempt,
    errors,
  };
}

function formatResult(result: StateResult): string {
  const topology = result.current.targetContact?.sledZeroFriction ?? null;
  return `${result.id}: ${result.verdict}; current=${result.current.admitted ? "admitted" : "rejected"}, ` +
    `preclear=${result.current.preTargetPreclearRejected ?? "n/a"}, sled0=${topology ?? "n/a"}, airReturn=${result.return?.airborneMarginBeforeBeat ?? "n/a"}, ` +
    `nextNormal=${result.nextNormal?.admitted ?? "n/a"}/${NORMAL_RETURN_ATTEMPTS}; ${result.reasons.join("; ") || "all declared checks passed"}`;
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
