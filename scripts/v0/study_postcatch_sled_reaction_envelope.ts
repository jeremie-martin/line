/**
 * Calibration-only feasibility assay for a post-catch full-sled reaction
 * envelope.  Every response contour starts from an exact H+1 state of an
 * already-admitted ordinary catch; it is never a source lane or a selector.
 */
import { makeRng } from "../lib/rng.ts";
import { clearImpactTemplateMarker, sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import { airborneAt, engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import type { TrackLine } from "./types.ts";
import { postimpactEngineCollisionWitnessesForLineIds } from "./trajectory/postimpact_trace.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import { prepareStateCoupledTrajectoryFixture, type PreparedTrajectoryFixtureCore } from "./trajectory/study_context.ts";
import { allocateStudyArtifactPath, studyArtifactIdentity, studySourceIdentity, writeImmutableJsonArtifact } from "./trajectory/study_artifact.ts";
import { realizePostcatchSledReactionEnvelope, type PostcatchSledReactionEnvelope } from "./trajectory/postcatch_sled_reaction_envelope.ts";
import { realizePostcatchSledFluxMembrane, type PostcatchSledFluxMembrane } from "./trajectory/postcatch_sled_flux_membrane.ts";

const SCHEMA = "line.study-postcatch-sled-reaction-envelope.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
} as const;
const RAW_ATTEMPTS = 16;
const NORMAL_RETURN_ATTEMPTS = 8;
const MIN_SLED_ZERO_FRICTION_UPDATES = 3;
const MIN_ENVELOPE_SLED_ZERO_FRICTION_UPDATES = 2;
const MIN_RETURN_AIRBORNE_FRAMES = 6;

type StateId = keyof typeof FIXTURES;
type Form = "reaction-envelope" | "flux-membrane";
type Realization = PostcatchSledReactionEnvelope | PostcatchSledFluxMembrane;
type Topology = { peg: number; sledZeroFriction: number; feetZeroFriction: number; total: number };
type ReturnMeasure = { replayFrames: number; survivedToBeat: boolean; terminusFrame: number; terminusReason: string; airborneMarginBeforeBeat: number };
type NextNormal = { attempted: number; available: number; admitted: number; frames: number; errors: string[] };
type AttemptResult = {
  attempt: number;
  raw: { admitted: boolean; admissionFrames: number; targetTopology: Topology | null; error: string | null };
  envelope: Realization | null;
  stateReadFrames: number;
  augmented: {
    admitted: boolean;
    admissionFrames: number;
    impactTarget: number | null;
    impactAchieved: number | null;
    impactErrSigned: number | null;
    rawTargetTopology: Topology | null;
    envelopeInboundTopology: Topology | null;
    envelopeResponseTopology: Topology | null;
    error: string | null;
  } | null;
  return: ReturnMeasure | null;
  nextNormal: NextNormal | null;
  coherent: boolean;
  reasons: string[];
  chargedFrames: number;
};
type StateResult = {
  id: StateId;
  artifactPath: string;
  attempts: AttemptResult[];
  chargedFrames: number;
  verdict: "pass" | "retire";
  reasons: string[];
};

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_postcatch_sled_reaction_envelope.ts [--form=reaction-envelope|flux-membrane] [--case=dense240|ordinary|all] [--out-dir=DIR]\\n");
  process.exit(0);
}
if (process.env.LR_ENGINE !== "wasm") throw new Error(`study requires LR_ENGINE=wasm; received ${process.env.LR_ENGINE ?? "(unset)"}`);
const allowed = ["--form=", "--case=", "--out-dir=", "--help", "-h"];
const unknown = argv.filter((value) => !allowed.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);
const requested = argument("case") ?? "all";
const requestedForm = argument("form") ?? "reaction-envelope";
const forms: readonly Form[] = ["reaction-envelope", "flux-membrane"];
if (!forms.includes(requestedForm as Form)) throw new Error(`unknown --form=${requestedForm}`);
const form = requestedForm as Form;
const ids: readonly StateId[] = ["dense240", "ordinary"];
if (requested !== "all" && !ids.includes(requested as StateId)) throw new Error(`unknown --case=${requested}`);
const selected: readonly StateId[] = requested === "all" ? ids : [requested as StateId];
const outDir = argument("out-dir") ?? (form === "reaction-envelope"
  ? "generated/studies/postcatch-sled-reaction-envelope/v1"
  : "generated/studies/postcatch-sled-flux-membrane/v1");
const sourceIdentity = studySourceIdentity("scripts/v0/study_postcatch_sled_reaction_envelope.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: `postcatch-sled-state-geometry.${form}.v1`,
  fixtures: FIXTURES,
  rawStream: { kind: "normal", attempts: RAW_ATTEMPTS, purpose: "fixed input stream, never a chooser" },
  stateInput: "exact H+1 full PEG/TAIL/NOSE/STRING positions and velocities plus angular rate after an admitted raw catch",
  geometry: form === "reaction-envelope"
    ? "H+1..H+6 full-sled gravity-support configuration envelope under measured collective velocity, gravity, and angular rate"
    : "one H+1 full-sled collective-flow-facing forward-support cross-section",
  boundary: "response lines must not collide at H-1 or H; native raw catch must retain distributed zero-friction sled contact at H",
  response: { minimumEnvelopeSledZeroFrictionUpdates: MIN_ENVELOPE_SLED_ZERO_FRICTION_UPDATES, frame: "H+1" },
  currentAdmission: "unchanged tryCandidateLines",
  return: { minimumAirborneFrames: MIN_RETURN_AIRBORNE_FRAMES, normalAttempts: NORMAL_RETURN_ATTEMPTS, nextAdmission: "unchanged tryCandidateLines" },
}));

const started = performance.now();
let totalFrames = 0;
const results = selected.map(runState);
process.stdout.write([
  `post-catch ${form}: ${results.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; charged frames ${totalFrames}`,
  ...results.map((result) => {
    const raw = result.attempts.filter((attempt) => attempt.raw.admitted).length;
    const augmented = result.attempts.filter((attempt) => attempt.augmented?.admitted).length;
    const coherent = result.attempts.filter((attempt) => attempt.coherent).length;
    return `${result.id}: ${result.verdict}; raw=${raw}/${RAW_ATTEMPTS}, augmented=${augmented}/${RAW_ATTEMPTS}, coherent=${coherent}/${RAW_ATTEMPTS}; ${result.reasons.join("; ") || "all declared checks passed"}`;
  }),
].join("\n") + "\n");

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") throw new Error(`fixture ${id} is not calibration`);
  let chargedFrames = 0;
  const charge = (frames: number): void => { chargedFrames += frames; totalFrames += frames; };
  const attempts = runAttempts(prepared, charge, form);
  const coherent = attempts.filter((attempt) => attempt.coherent).length;
  const reasons: string[] = [];
  if (coherent === 0) reasons.push("no exact raw-catch-preserving multi-contact reaction return");
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
      `Falsify one finite post-catch ${form} state-to-geometry component derived from the exact full sled configuration after an already-admitted native catch.`,
      "Every raw and ordinary-return stream member is evaluated independently; no result selects, alters, or feeds back into the state-to-geometry construction.",
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
      form,
      component: form === "reaction-envelope"
        ? "H+1..H+6 full-sled gravity-support configuration envelope from the exact raw-catch response state"
        : "one H+1 full-sled collective-flow-facing forward-support membrane from the exact raw-catch response state",
      continuousInputs: form === "reaction-envelope"
        ? "all PEG/TAIL/NOSE/STRING positions and velocities, angular rate, collective ballistic state"
        : "all PEG/TAIL/NOSE/STRING positions and velocities, collective flow, and full-cloud normal/tangent support functions",
      exclusions: "no named-point anchor, raw coordinate edit, score, rank, source, case, seed, duration branch, contact-class feedback, parameter menu, or source delivery",
      rawCatch: { attempts: RAW_ATTEMPTS, generator: "unchanged normal", admission: "unchanged tryCandidateLines" },
      temporalBoundary: "response line collision prohibited at H-1 and H; response must activate at H+1 through native zero-friction sled contact",
      currentAdmission: "unchanged tryCandidateLines",
      return: { normalAttempts: NORMAL_RETURN_ATTEMPTS, minimumAirborneFrames: MIN_RETURN_AIRBORNE_FRAMES, nextAdmission: "unchanged tryCandidateLines" },
      topology: { rawTargetMinimum: MIN_SLED_ZERO_FRICTION_UPDATES, responseMinimum: MIN_ENVELOPE_SLED_ZERO_FRICTION_UPDATES },
    },
    result: { id, attempts, chargedFrames, verdict, reasons },
  }, "post-catch sled reaction envelope artifact");
  return { id, artifactPath, attempts, chargedFrames, verdict, reasons };
}

function runAttempts(prepared: PreparedTrajectoryFixtureCore, charge: (frames: number) => void, form: Form): AttemptResult[] {
  const beforeProbe = getSimFrames();
  const probe = getCandidateProbe(prepared.engine, prepared.current, prepared.ctx);
  charge(getSimFrames() - beforeProbe);
  const axisEnd = axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames);
  const target = prepared.ctx.gapAxisTargets[prepared.current.index] ?? prepared.current.targets;
  const rng = makeRng((Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.current.index + 0x5e71) | 0);
  const results: AttemptResult[] = [];
  for (let attempt = 0; attempt < RAW_ATTEMPTS; attempt++) {
    const startedFrames = getSimFrames();
    const reasons: string[] = [];
    clearImpactTemplateMarker();
    let raw: GapFit | null = null;
    let rawAdmissionFrames = 0;
    try {
      const lines = sampleArcPlacementGeometry(
        rng, probe.refX, probe.refY, prepared.current.targets, probe.targetState, attempt,
        prepared.current, prepared.lineIdStart, "normal", prepared.ctx.allContactFrames,
      ).lines;
      const before = getSimFrames();
      raw = tryCandidateLines(
        prepared.engine, prepared.current, lines, prepared.lineIdStart, prepared.ctx.allContactFrames,
        axisEnd, prepared.current.targets, true, undefined, probe.preTargetSledTrace,
      ) as GapFit | null;
      rawAdmissionFrames = getSimFrames() - before;
      charge(rawAdmissionFrames);
    } catch (error) {
      const chargedFrames = getSimFrames() - startedFrames;
      chargeUnaccounted(charge, startedFrames, chargedFrames, rawAdmissionFrames);
      results.push(failedAttempt(attempt, rawAdmissionFrames, errorMessage(error), chargedFrames));
      continue;
    }
    if (raw === null) {
      results.push({
        attempt,
        raw: { admitted: false, admissionFrames: rawAdmissionFrames, targetTopology: null, error: "unchanged raw current gate rejected normal proposal" },
        envelope: null, stateReadFrames: 0, augmented: null, return: null, nextNormal: null,
        coherent: false, reasons: ["raw catch not admitted"], chargedFrames: rawAdmissionFrames,
      });
      continue;
    }
    const rawEngine = prepared.engine.addLine(raw.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
    const rawIds = new Set(raw.lines.map((line: TrackLine) => line.id));
    const rawTopology = topology(rawEngine, prepared.current.endFrame, rawIds);
    const beforeState = getSimFrames();
    const responseState = extractPlanningState(rawEngine, prepared.current.endFrame + 1);
    const stateReadFrames = getSimFrames() - beforeState;
    charge(stateReadFrames);
    if (responseState === null) {
      results.push({
        attempt,
        raw: { admitted: true, admissionFrames: rawAdmissionFrames, targetTopology: rawTopology, error: null },
        envelope: null, stateReadFrames, augmented: null, return: null, nextNormal: null,
        coherent: false, reasons: ["exact H+1 state unavailable"], chargedFrames: rawAdmissionFrames + stateReadFrames,
      });
      continue;
    }
    const envelope = realize(form, responseState, prepared.lineIdStart + raw.lines.length);
    if (envelope.status !== "ready") {
      results.push({
        attempt,
        raw: { admitted: true, admissionFrames: rawAdmissionFrames, targetTopology: rawTopology, error: null },
        envelope, stateReadFrames, augmented: null, return: null, nextNormal: null,
        coherent: false, reasons: [`post-catch state geometry unavailable: ${envelope.reason}`], chargedFrames: rawAdmissionFrames + stateReadFrames,
      });
      continue;
    }
    const envelopeIds = new Set(envelope.lines.map((line) => line.id));
    let augmented: GapFit | null = null;
    const beforeAugmented = getSimFrames();
    try {
      augmented = tryCandidateLines(
        prepared.engine, prepared.current, [...raw.lines, ...envelope.lines], prepared.lineIdStart,
        prepared.ctx.allContactFrames, axisEnd, prepared.current.targets, true, undefined, probe.preTargetSledTrace,
      ) as GapFit | null;
    } catch (error) {
      const admissionFrames = getSimFrames() - beforeAugmented;
      charge(admissionFrames);
      results.push({
        attempt,
        raw: { admitted: true, admissionFrames: rawAdmissionFrames, targetTopology: rawTopology, error: null },
        envelope, stateReadFrames,
        augmented: {
          admitted: false, admissionFrames, impactTarget: target.impact ?? null, impactAchieved: null, impactErrSigned: null,
          rawTargetTopology: null, envelopeInboundTopology: null, envelopeResponseTopology: null, error: errorMessage(error),
        },
        return: null, nextNormal: null, coherent: false, reasons: ["augmented current gate threw"],
        chargedFrames: rawAdmissionFrames + stateReadFrames + admissionFrames,
      });
      continue;
    }
    const augmentedAdmissionFrames = getSimFrames() - beforeAugmented;
    charge(augmentedAdmissionFrames);
    if (augmented === null) {
      results.push({
        attempt,
        raw: { admitted: true, admissionFrames: rawAdmissionFrames, targetTopology: rawTopology, error: null },
        envelope, stateReadFrames,
        augmented: {
          admitted: false, admissionFrames: augmentedAdmissionFrames, impactTarget: target.impact ?? null, impactAchieved: null, impactErrSigned: null,
          rawTargetTopology: null, envelopeInboundTopology: null, envelopeResponseTopology: null, error: "unchanged augmented current gate rejected complete geometry",
        },
        return: null, nextNormal: null, coherent: false, reasons: ["augmented catch not admitted"],
        chargedFrames: rawAdmissionFrames + stateReadFrames + augmentedAdmissionFrames,
      });
      continue;
    }
    const full = prepared.engine.addLine(augmented.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
    const rawTargetTopology = topology(full, prepared.current.endFrame, rawIds);
    const envelopeInboundTopology = sumTopology(
      topology(full, Math.max(0, prepared.current.endFrame - 1), envelopeIds),
      topology(full, prepared.current.endFrame, envelopeIds),
    );
    const envelopeResponseTopology = topology(full, prepared.current.endFrame + 1, envelopeIds);
    const achieved = augmented.achieved;
    const impactAchieved = achieved.impact ?? null;
    const impactErrSigned = impactAchieved === null || target.impact === undefined ? null : round(impactAchieved - target.impact);
    if ((rawTargetTopology?.sledZeroFriction ?? 0) < MIN_SLED_ZERO_FRICTION_UPDATES) reasons.push(`raw target topology below ${MIN_SLED_ZERO_FRICTION_UPDATES}`);
    if ((envelopeInboundTopology?.total ?? 0) !== 0) reasons.push("post-catch state geometry intrudes before H+1");
    if ((envelopeResponseTopology?.sledZeroFriction ?? 0) < MIN_ENVELOPE_SLED_ZERO_FRICTION_UPDATES) reasons.push(`reaction topology below ${MIN_ENVELOPE_SLED_ZERO_FRICTION_UPDATES} at H+1`);
    if (impactErrSigned === null || Math.abs(impactErrSigned) > .05) reasons.push("current impact is not accurate");
    const returnMeasure = measureReturn(prepared, full, charge);
    if (!returnMeasure.survivedToBeat || returnMeasure.airborneMarginBeforeBeat < MIN_RETURN_AIRBORNE_FRAMES) reasons.push("no six-frame airborne return to next beat");
    const nextNormal = measureNextNormal(prepared, full, prepared.lineIdStart + augmented.lines.length, charge);
    if (nextNormal.admitted === 0) reasons.push("no normal next-contact admission");
    const coherent = reasons.length === 0;
    results.push({
      attempt,
      raw: { admitted: true, admissionFrames: rawAdmissionFrames, targetTopology: rawTopology, error: null },
      envelope, stateReadFrames,
      augmented: {
        admitted: true, admissionFrames: augmentedAdmissionFrames,
        impactTarget: target.impact ?? null, impactAchieved: impactAchieved === null ? null : round(impactAchieved), impactErrSigned,
        rawTargetTopology, envelopeInboundTopology, envelopeResponseTopology, error: null,
      },
      return: returnMeasure, nextNormal, coherent, reasons,
      chargedFrames: getSimFrames() - startedFrames,
    });
  }
  return results;
}

function realize(
  form: Form,
  state: NonNullable<ReturnType<typeof extractPlanningState>>,
  lineIdStart: number,
): Realization {
  return form === "reaction-envelope"
    ? realizePostcatchSledReactionEnvelope(state, lineIdStart)
    : realizePostcatchSledFluxMembrane(state, lineIdStart);
}

function failedAttempt(attempt: number, admissionFrames: number, error: string, chargedFrames: number): AttemptResult {
  return {
    attempt,
    raw: { admitted: false, admissionFrames, targetTopology: null, error },
    envelope: null, stateReadFrames: 0, augmented: null, return: null, nextNormal: null,
    coherent: false, reasons: ["raw normal construction threw"], chargedFrames,
  };
}

function chargeUnaccounted(charge: (frames: number) => void, started: number, charged: number, known: number): void {
  const observed = getSimFrames() - started;
  const extra = Math.max(0, observed - known);
  if (extra > 0 && charged === observed) charge(extra);
}

function topology(engine: unknown, frame: number, ids: ReadonlySet<number>): Topology | null {
  try {
    const points = postimpactEngineCollisionWitnessesForLineIds(engine, frame, ids).flatMap((hit) => hit.pointIds);
    return summarizeTopology(points);
  } catch { return null; }
}

function sumTopology(left: Topology | null, right: Topology | null): Topology | null {
  if (left === null || right === null) return null;
  return {
    peg: left.peg + right.peg,
    sledZeroFriction: left.sledZeroFriction + right.sledZeroFriction,
    feetZeroFriction: left.feetZeroFriction + right.feetZeroFriction,
    total: left.total + right.total,
  };
}

function summarizeTopology(points: readonly string[]): Topology {
  return {
    peg: points.filter((point) => point === "PEG").length,
    sledZeroFriction: points.filter((point) => point === "TAIL" || point === "NOSE" || point === "STRING").length,
    feetZeroFriction: points.filter((point) => point === "LFOOT" || point === "RFOOT").length,
    total: points.length,
  };
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
  const rng = makeRng((Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.outgoing.index + 0x5e72) | 0);
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
