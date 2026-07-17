/**
 * Calibration-only feasibility assay for one full-state guide ribbon.
 *
 * The ribbon is a time-ordered, full-sled state-to-geometry construction. It
 * is not a source lane, a selector, a contact-class filter, or a benchmark
 * attempt.  A fixed ordinary-normal stream at the next contact is only the
 * declared return test.
 */
import { makeRng } from "../lib/rng.ts";
import { clearImpactTemplateMarker, hasPreTargetSledProximityFromTrace, sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import { airborneAt, engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import type { TrackLine } from "./types.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { postimpactEngineCollisionWitnessesForLineIds } from "./trajectory/postimpact_trace.ts";
import { prepareStateCoupledTrajectoryFixture, type PreparedTrajectoryFixtureCore } from "./trajectory/study_context.ts";
import { allocateStudyArtifactPath, studyArtifactIdentity, studySourceIdentity, writeImmutableJsonArtifact } from "./trajectory/study_artifact.ts";
import { realizeFullStateGuideRibbon, type FullStateGuideRibbon } from "./trajectory/full_state_guide_ribbon.ts";

const SCHEMA = "line.study-full-state-guide-ribbon.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
} as const;
const NORMAL_RETURN_ATTEMPTS = 24;
const MIN_SLED_ZERO_FRICTION_UPDATES = 3;
const MIN_RETURN_AIRBORNE_FRAMES = 6;

type StateId = keyof typeof FIXTURES;
type Topology = { peg: number; sledZeroFriction: number; feetZeroFriction: number; total: number };
type ReturnMeasure = { replayFrames: number; survivedToBeat: boolean; terminusFrame: number; terminusReason: string; airborneMarginBeforeBeat: number };
type NextNormal = { attempted: number; available: number; admitted: number; frames: number; errors: string[] };
type StateResult = {
  id: StateId;
  artifactPath: string;
  ribbon: FullStateGuideRibbon;
  current: {
    admitted: boolean;
    preTargetPreclearRejected: boolean | null;
    admissionFrames: number;
    impactTarget: number | null;
    impactAchieved: number | null;
    impactErrSigned: number | null;
    targetTopology: Topology | null;
    error: string | null;
  };
  return: ReturnMeasure | null;
  nextNormal: NextNormal | null;
  chargedFrames: number;
  verdict: "pass" | "retire";
  reasons: string[];
};

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_full_state_guide_ribbon.ts [--case=dense240|ordinary|all] [--out-dir=DIR]\\n");
  process.exit(0);
}
if (process.env.LR_ENGINE !== "wasm") throw new Error(`study requires LR_ENGINE=wasm; received ${process.env.LR_ENGINE ?? "(unset)"}`);
const allowed = ["--case=", "--out-dir=", "--help", "-h"];
const unknown = argv.filter((value) => !allowed.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);
const requested = argument("case") ?? "all";
const ids: readonly StateId[] = ["dense240", "ordinary"];
if (requested !== "all" && !ids.includes(requested as StateId)) throw new Error(`unknown --case=${requested}`);
const selected: readonly StateId[] = requested === "all" ? ids : [requested as StateId];
const outDir = argument("out-dir") ?? "generated/studies/full-state-guide-ribbon/v1";
const sourceIdentity = studySourceIdentity("scripts/v0/study_full_state_guide_ribbon.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "full-state-guide-ribbon.v1",
  fixtures: FIXTURES,
  stateInput: "all native sled positions and velocities plus measured angular rate",
  geometry: "H-1..H+6 time-ordered centroid trajectory with full-sled RMS gravity-normal radius",
  response: "authored catchable turn over exact impact window; sign from measured angular rate",
  currentAdmission: "unchanged tryCandidateLines",
  return: { minimumAirborneFrames: MIN_RETURN_AIRBORNE_FRAMES, normalAttempts: NORMAL_RETURN_ATTEMPTS, nextAdmission: "unchanged tryCandidateLines" },
  topology: { minimumZeroFrictionSledUpdates: MIN_SLED_ZERO_FRICTION_UPDATES },
}));

const started = performance.now();
let totalFrames = 0;
const results = selected.map(runState);
process.stdout.write([
  `full-state guide ribbon: ${results.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; charged frames ${totalFrames}`,
  ...results.map((result) => `${result.id}: ${result.verdict}; current=${result.current.admitted ? "admitted" : "rejected"}, preclear=${result.current.preTargetPreclearRejected ?? "n/a"}, sled0=${result.current.targetTopology?.sledZeroFriction ?? "n/a"}, airReturn=${result.return?.airborneMarginBeforeBeat ?? "n/a"}, nextNormal=${result.nextNormal?.admitted ?? "n/a"}/${NORMAL_RETURN_ATTEMPTS}; ${result.reasons.join("; ") || "all declared checks passed"}`),
].join("\n") + "\n");

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") throw new Error(`fixture ${id} is not calibration`);
  const kinematic = contactKinematicFrameFromPlanningState(prepared.state, prepared.frame, prepared.current.targets);
  const ribbon = realizeFullStateGuideRibbon(prepared.state, kinematic, prepared.lineIdStart);
  let chargedFrames = 0;
  const charge = (frames: number): void => { chargedFrames += frames; totalFrames += frames; };
  const target = prepared.ctx.gapAxisTargets[prepared.current.index] ?? prepared.current.targets;
  let current: StateResult["current"] = {
    admitted: false, preTargetPreclearRejected: null, admissionFrames: 0,
    impactTarget: target.impact ?? null, impactAchieved: null, impactErrSigned: null, targetTopology: null, error: null,
  };
  let returnMeasure: ReturnMeasure | null = null;
  let nextNormal: NextNormal | null = null;
  const reasons: string[] = [];

  if (ribbon.status !== "ready") {
    reasons.push(`construction unavailable: ${ribbon.reason}`);
  } else {
    const preTargetPreclearRejected = hasPreTargetSledProximityFromTrace(prepared.probe.preTargetSledTrace(), ribbon.lines);
    const before = getSimFrames();
    const fit = tryCandidateLines(
      prepared.engine, prepared.current, ribbon.lines, prepared.lineIdStart, prepared.ctx.allContactFrames,
      axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames), prepared.current.targets,
      true, undefined, prepared.probe.preTargetSledTrace,
    ) as GapFit | null;
    const admissionFrames = getSimFrames() - before;
    charge(admissionFrames);
    if (fit === null) {
      current = {
        ...current, admissionFrames, preTargetPreclearRejected,
        error: preTargetPreclearRejected ? "pre-target proximity guard rejects the complete inbound ribbon" : "unchanged current gate rejected ribbon after preclear",
      };
      reasons.push("current ribbon not admitted");
    } else {
      const achieved = fit.achievedAtEnd ?? fit.achieved;
      const impactAchieved = achieved.impact ?? null;
      const currentEngine = prepared.engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
      const topology = targetTopology(currentEngine, prepared.current.endFrame, fit.lines);
      current = {
        admitted: true, preTargetPreclearRejected, admissionFrames,
        impactTarget: target.impact ?? null,
        impactAchieved: impactAchieved === null ? null : round(impactAchieved),
        impactErrSigned: impactAchieved === null || target.impact === undefined ? null : round(impactAchieved - target.impact),
        targetTopology: topology, error: null,
      };
      if ((topology?.sledZeroFriction ?? 0) < MIN_SLED_ZERO_FRICTION_UPDATES) reasons.push(`target zero-friction sled topology below ${MIN_SLED_ZERO_FRICTION_UPDATES}`);
      returnMeasure = measureReturn(prepared, currentEngine, charge);
      if (!returnMeasure.survivedToBeat || returnMeasure.airborneMarginBeforeBeat < MIN_RETURN_AIRBORNE_FRAMES) reasons.push("no six-frame airborne return to next beat");
      nextNormal = measureNextNormal(prepared, currentEngine, prepared.lineIdStart + fit.lines.length, charge);
      if (nextNormal.admitted === 0) reasons.push("no normal next-contact admission");
    }
  }
  const verdict: StateResult["verdict"] = reasons.length === 0 ? "pass" : "retire";
  const artifactIdentity = studyArtifactIdentity({
    schema: SCHEMA, fixtureFingerprint: fixture.fixtureFingerprint,
    studySourceFingerprint: sourceIdentity.studySourceFingerprint,
    observationCandidateFingerprint: observationCompiler.candidateFingerprint, protocolFingerprint,
  });
  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, {
    schema: SCHEMA, artifactIdentity,
    purpose: [
      "Falsify one time-ordered continuous multi-contact state-to-geometry guide ribbon derived symmetrically from the full sled state.",
      "The fixed post-ribbon normal stream is a return test only and cannot select, alter, or feed back into the ribbon.",
      "Calibration-only observation; it cannot create a compiler source, selector, rank term, or benchmark attempt.",
    ],
    status: { productionIntegration: "forbidden", cohortPolicy: "calibration only" }, argv: [...argv],
    provenance: {
      fixturePath, fixtureFingerprint: fixture.fixtureFingerprint, captureCompiler: fixture.captureCompiler,
      observationCompiler, runtime: { node: process.version, engine: "wasm" },
      studySourceFingerprint: sourceIdentity.studySourceFingerprint, studySourceFiles: sourceIdentity.sourceFiles,
    },
    panel: prepared.panel, fixtureReplay: prepared.replay,
    protocol: {
      component: "finite H-1..H+6 time-ordered guide path; center = full-sled centroid; tangent = full-sled mean velocity; offset = full-sled RMS gravity-normal radius; response side = measured angular-rate sign",
      continuousInputs: "all PEG/TAIL/NOSE/STRING positions and velocities, sled angular rate, authored current impact",
      exclusions: "no named-point anchor, hull vertex, raw candidate coordinate, score, rank, source, case, seed, duration branch, or contact-class feedback",
      currentAdmission: "unchanged tryCandidateLines",
      return: { normalAttempts: NORMAL_RETURN_ATTEMPTS, minimumAirborneFrames: MIN_RETURN_AIRBORNE_FRAMES, nextAdmission: "unchanged tryCandidateLines" },
      topologyMinimum: MIN_SLED_ZERO_FRICTION_UPDATES,
    },
    result: { id, ribbon, current, return: returnMeasure, nextNormal, chargedFrames, verdict, reasons },
  }, "full-state guide ribbon artifact");
  return { id, artifactPath, ribbon, current, return: returnMeasure, nextNormal, chargedFrames, verdict, reasons };
}

function targetTopology(engine: any, frame: number, lines: readonly TrackLine[]): Topology | null {
  try {
    const ids = new Set(lines.map((line) => line.id));
    const points = postimpactEngineCollisionWitnessesForLineIds(engine, frame, ids).flatMap((hit) => hit.pointIds);
    return {
      peg: points.filter((point) => point === "PEG").length,
      sledZeroFriction: points.filter((point) => point === "TAIL" || point === "NOSE" || point === "STRING").length,
      feetZeroFriction: points.filter((point) => point === "LFOOT" || point === "RFOOT").length,
      total: points.length,
    };
  } catch { return null; }
}

function measureReturn(prepared: PreparedTrajectoryFixtureCore, engine: any, charge: (frames: number) => void): ReturnMeasure {
  const before = getSimFrames();
  const detection = detectWindow(engine, prepared.current.endFrame, prepared.outgoing.endFrame + 1);
  const replayFrames = getSimFrames() - before;
  charge(replayFrames);
  const survivedToBeat = detection.terminus.frame >= prepared.outgoing.endFrame || detection.terminus.reason === "endOfSpec";
  let airborneMarginBeforeBeat = 0;
  for (let frame = prepared.outgoing.endFrame - 1; frame > prepared.current.endFrame; frame--) {
    if (airborneAt(detection, frame) !== true) break;
    airborneMarginBeforeBeat++;
  }
  return { replayFrames, survivedToBeat, terminusFrame: detection.terminus.frame, terminusReason: detection.terminus.reason, airborneMarginBeforeBeat };
}

function measureNextNormal(prepared: PreparedTrajectoryFixtureCore, engine: any, lineIdStart: number, charge: (frames: number) => void): NextNormal {
  const errors: string[] = [];
  const beforeProbe = getSimFrames();
  let probe: ReturnType<typeof getCandidateProbe>;
  try { probe = getCandidateProbe(engine, prepared.outgoing, prepared.ctx); } catch (error) {
    charge(getSimFrames() - beforeProbe);
    return { attempted: 0, available: 0, admitted: 0, frames: 0, errors: [errorMessage(error)] };
  }
  const probeFrames = getSimFrames() - beforeProbe;
  charge(probeFrames);
  const rng = makeRng((Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.outgoing.index + 0x7ab1) | 0);
  const axisEnd = axisLookaheadEndFrame(prepared.outgoing, prepared.ctx.allContactFrames);
  let available = 0;
  let admitted = 0;
  let attemptFrames = 0;
  for (let attempt = 0; attempt < NORMAL_RETURN_ATTEMPTS; attempt++) {
    clearImpactTemplateMarker();
    try {
      const lines = sampleArcPlacementGeometry(rng, probe.refX, probe.refY, prepared.outgoing.targets, probe.targetState, attempt, prepared.outgoing, lineIdStart, "normal", prepared.ctx.allContactFrames).lines;
      available++;
      const before = getSimFrames();
      const fit = tryCandidateLines(engine, prepared.outgoing, lines, lineIdStart, prepared.ctx.allContactFrames, axisEnd, prepared.outgoing.targets, true, undefined, probe.preTargetSledTrace) as GapFit | null;
      const frames = getSimFrames() - before;
      attemptFrames += frames;
      charge(frames);
      if (fit !== null) admitted++;
    } catch (error) { errors.push(errorMessage(error)); }
  }
  return { attempted: NORMAL_RETURN_ATTEMPTS, available, admitted, frames: probeFrames + attemptFrames, errors };
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
