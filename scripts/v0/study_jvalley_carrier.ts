/**
 * J-Valley Carrier assay (calibration-only, WASM/500k believer-energy fixtures).
 *
 * Terminal question for the both-bad-tail energy-bank chain (campaign, 2026-07-16,
 * "Declared Mechanism: Deficit-Pressured Energy-Launch Descent" DISCARD and its
 * catch-toll identity): from a frozen believer SLOW state, does a J-VALLEY
 * post-contact profile — catch preserved, tail DESCENDING THEN FLATTENING —
 * produce admitted candidates whose RELEASE SPEED and NEXT-BEAT ARRIVAL beat the
 * normal sampler's? The energy-launch descent was discarded because a steeper
 * flight dive arrives faster but STEEPER and the catch's v·Δθ redirect toll eats
 * the gain. The untested geometry is a downhill support that curves LEVEL before
 * release, converting drop into horizontal exit speed with no arrival-angle toll.
 * This asks whether that geometry banks energy PHYSICALLY, through admission, at
 * these exact states.
 *
 * Method: from each frozen believer prefix state (believer36 entering gap 36 at
 * 6.84 px/f over a 19-frame gap; believer69 at 9.98 px/f, speed ask 1.0), run two
 * equal-treatment families. (1) RAW-NORMAL control: the production sampler
 * (sampleArcPlacementGeometry, "normal") — the normal pool's achieved reference.
 * (2) J-VALLEY: take a genuine raw-normal sampler output at attempt index s as a
 * base, PRESERVE its entry/catch cluster plus L_keep px of post-contact tail, and
 * REPLACE ONLY THE TAIL beyond that cut with a J-profile (descend to a sampled
 * valley angle, then flatten to a near-horizontal exit). Admit every candidate of
 * both families through the UNCHANGED tryCandidateLines, then extend the prefix
 * engine with the admitted fit and ride to the next beat to measure the chain.
 * Every engine touch is bracketed with getSimFrames().
 *
 * This is study-only code OUTSIDE the compiler identity boundary. It reads the
 * frozen fixtures and shared primitives; no compiler source imports it, and it
 * selects/promotes nothing. Geometry is built from continuous physical inputs
 * only; no case identity enters the construction.
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

const SCHEMA = "line.study-jvalley-carrier.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/believer-energy-2026-07-16/v3";
const FIXTURES = {
  believer36: "believer36.json",
  believer69: "believer69.json",
} as const;
type StateId = keyof typeof FIXTURES;
type Family = "j-valley" | "raw-normal";

// ── Sampled J-valley geometry space (declared ranges) ────────────────────────
// L_keep is measured ALONG the polyline forward from the contact point; the
// entry/catch cluster and this much post-contact support are preserved verbatim
// from the base normal geometry, and only the tail beyond is replaced.
const L_KEEP_PX = [20, 45] as const;
// Valley angle below horizontal (screen coords: +y is down; descending = +deg).
const THETA_VALLEY_DEG = [15, 55] as const;
const L_DESCEND_PX = [30, 120] as const;
// Exit angle near horizontal, slightly up (−5) to slightly down (+10).
const THETA_EXIT_DEG = [-5, 10] as const;
const L_FLATTEN_PX = [25, 90] as const;
const DESCEND_SEGMENTS = [3, 8] as const; // integer inclusive
const FLATTEN_SEGMENTS = [3, 8] as const; // integer inclusive

// ── Study budgets and thresholds ─────────────────────────────────────────────
const J_VALLEY_SAMPLES_DEFAULT = 600;
const CONTROL_SAMPLES_DEFAULT = 200;
const STATE_FRAME_BUDGET = 4_000_000;
const CHAIN_MIN_AIRBORNE = MIN_LANDING_AIRBORNE_FRAMES; // the detector's landing floor (=6)

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_jvalley_carrier.ts [--case=believer36|believer69|all] [--out-dir=DIR] [--samples=N]",
    "",
    "J-valley carrier assay (calibration-only). Requires LR_ENGINE=wasm.",
    "From each frozen believer slow state, compares a raw-normal control stream",
    "against a J-valley family (catch preserved, tail descending-then-flattening)",
    "on admission, release speed, and next-beat arrival speed/angle. --samples caps",
    "the J-valley sample count (and control to at most that) for smoke runs.",
  ].join("\n") + "\n");
  process.exit(0);
}

assertExactEnvironment();
const supportedOptions = ["--case=", "--out-dir=", "--samples=", "--help", "-h"];
const unknownOptions = argv.filter((value) => !supportedOptions.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknownOptions.length > 0) throw new Error(`unsupported option(s): ${unknownOptions.join(", ")}`);

const requestedCase = argument("case") ?? "all";
const stateIds: readonly StateId[] = ["believer36", "believer69"];
if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
  throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
}
const selected: readonly StateId[] = requestedCase === "all" ? stateIds : [requestedCase as StateId];
const outDir = argument("out-dir") ?? "generated/studies/jvalley-carrier/v1";

const samplesOverrideRaw = argument("samples");
let jValleySamples = J_VALLEY_SAMPLES_DEFAULT;
let controlSamples = CONTROL_SAMPLES_DEFAULT;
if (samplesOverrideRaw !== undefined) {
  const parsed = Number(samplesOverrideRaw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--samples must be a positive integer; received ${samplesOverrideRaw}`);
  jValleySamples = parsed;
  controlSamples = Math.min(CONTROL_SAMPLES_DEFAULT, parsed);
}

const sourceIdentity = studySourceIdentity("scripts/v0/study_jvalley_carrier.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "jvalley-carrier.v1",
  captureBudget: 500_000,
  space: {
    lKeepPx: L_KEEP_PX,
    thetaValleyDeg: THETA_VALLEY_DEG,
    lDescendPx: L_DESCEND_PX,
    thetaExitDeg: THETA_EXIT_DEG,
    lFlattenPx: L_FLATTEN_PX,
    descendSegments: DESCEND_SEGMENTS,
    flattenSegments: FLATTEN_SEGMENTS,
  },
  base: "raw-normal sampleArcPlacementGeometry('normal') at attempt=s; entry/catch cluster + L_keep px post-contact preserved, tail replaced",
  budgets: { jValleySamples, controlSamples, STATE_FRAME_BUDGET },
  chainability: `>=${CHAIN_MIN_AIRBORNE} consecutive airborne frames immediately before the next beat AND survived to the beat`,
  admission: "tryCandidateLines (survival, +/-1 landing, no off-beat; unchanged)",
}));

const started = performance.now();
let grandTotalFrames = 0;
const runResults = selected.map((id) => runState(id));

const summaryLines: string[] = [
  `j-valley carrier: ${runResults.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; total charged frames ${grandTotalFrames}`,
];
for (const result of runResults) summaryLines.push(...formatStateSummary(result));
process.stdout.write(summaryLines.join("\n") + "\n");

// Positive control: the raw-normal stream must produce at least one admission on
// every run state. Zero admissions = broken observation path, not a physics
// result — report it as such instead of proceeding.
const brokenControl = runResults.filter((result) => result.summary.families["raw-normal"].admitted === 0);
if (brokenControl.length > 0) {
  process.stdout.write(
    `\nCONTROL FAILURE: raw-normal produced zero admissions on ${brokenControl.map((r) => r.id).join(", ")}; ` +
    "the observation path is broken (not a physics result).\n",
  );
  process.exitCode = 2;
}

// ─────────────────────────────────────────────────────────────────────────────

type JValleyParams = {
  baseAttempt: number;
  lKeepPx: number;
  thetaValleyDeg: number;
  lDescendPx: number;
  thetaExitDeg: number;
  lFlattenPx: number;
  descendSegments: number;
  flattenSegments: number;
};

type JValleyGeometry = {
  contactVertexIndex: number;
  postContactLengthAvailablePx: number;
  cutAngleDeg: number;
  keptVertexCount: number;
  totalLineCount: number;
};

type ChainMeasure = {
  rideFrames: number;
  survivedToBeat: boolean;
  terminusFrame: number;
  terminusReason: string;
  airborneMarginBeforeBeat: number;
  /** Landing events strictly inside the open interval (current beat, next beat),
   *  outside +/-1 of both — each is an off-beat landing in the exact scorer. */
  offBeatLandingsBetween: number;
  lastOwnTouchOffset: number | null;
  arrivalSpeed: number | null;
  arrivalAngleDeg: number | null;
};

type Row = {
  index: number;
  family: Family;
  label: string;
  params: JValleyParams | null;
  geometry: JValleyGeometry | null;
  admitted: boolean;
  admissionFrames: number;
  achievedAtEnd: { air: number | null; speed: number | null; impact: number | null } | null;
  currentGapErr: { speedAbs: number | null; airAbs: number | null; impactSigned: number | null } | null;
  finalLineCount: number | null;
  release: { speed: number | null; velocityY: number | null; airborne: boolean | null; groundedFrames: number | null } | null;
  chain: ChainMeasure | null;
  chained: boolean; // admitted AND survived to the beat with a measured arrival
  chainableWithMargin: boolean; // survived AND >= CHAIN_MIN_AIRBORNE airborne before the beat
  totalFrames: number;
  error: string | null;
};

type Dist = { count: number; median: number | null; p90: number | null; max: number | null };

type FamilySummary = {
  attempted: number;
  admitted: number;
  admissionRate: number;
  chained: number;
  chainableWithMargin: number;
  arrivalSpeed: Dist;
  arrivalAngleMedianDeg: number | null;
  currentGapImpactAchievedMedian: number | null;
  currentGapAirAchievedMedian: number | null;
  currentGapImpactErrMedian: number | null;
  currentGapAirErrMedian: number | null;
  currentGapSpeedErrMedian: number | null;
  releaseSpeedMedian: number | null;
  totalChargedFrames: number;
};

type StateSummary = {
  currentTargets: { air: number | null; speed: number | null; impact: number | null };
  nextSpeedAsk: number | null;
  entrySpeedPxPerFrame: number;
  families: Record<Family, FamilySummary>;
  comparison: {
    definition: string;
    arrivalSpeedMaxDelta: number | null;
    arrivalSpeedMedianDelta: number | null;
    releaseSpeedMedianDelta: number | null;
  };
  verdict: string;
};

type StateResult = {
  id: StateId;
  artifactPath: string;
  panel: PreparedTrajectoryFixtureCore["panel"];
  summary: StateSummary;
  stateFrames: number;
  jValleySamplesRun: number;
  budgetExhausted: boolean;
};

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  // prepareStateCoupledTrajectoryFixture fails closed on any replay mismatch.
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") {
    throw new Error(`j-valley carrier accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
  }
  const trueTargets = prepared.ctx.gapAxisTargets[prepared.current.index] ?? {};
  const nextTargets = prepared.ctx.gapAxisTargets[prepared.outgoing.index] ?? {};
  const allContactFrames = prepared.ctx.allContactFrames;
  const axisEnd = axisLookaheadEndFrame(prepared.current, allContactFrames);
  const contactAnchor = {
    x: prepared.probe.targetState.sledX,
    y: prepared.probe.targetState.sledY,
  };
  const entrySpeed = prepared.probe.targetState.speed;

  let stateFrames = 0;
  const charge = (frames: number): void => {
    stateFrames += frames;
    grandTotalFrames += frames;
  };

  const rows: Row[] = [];
  let rowIndex = 0;

  // 1) Raw-normal control stream first (never starved by the frame budget).
  const controlRng = makeRng(controlStreamSeed(prepared));
  for (let attempt = 0; attempt < controlSamples; attempt++) {
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
      prepared, "raw-normal", `normal_${attempt}`, rowIndex++, null, null, lines, error,
      axisEnd, allContactFrames, trueTargets, charge,
    ));
  }

  // 2) J-valley family until the sample cap or the frame budget. The base is a
  //    genuine raw-normal sampler output drawn from an independent stream at
  //    attempt=s; only the post-contact tail beyond the preserved cut is replaced.
  const baseRng = makeRng(baseNormalSeed(prepared));
  const jValleyRng = makeRng(jValleySeed(prepared));
  let jValleySamplesRun = 0;
  let budgetExhausted = false;
  for (let sample = 0; sample < jValleySamples; sample++) {
    if (stateFrames >= STATE_FRAME_BUDGET) {
      budgetExhausted = true;
      break;
    }
    // Draw the base normal geometry first (advancing baseRng), then the J params
    // (advancing jValleyRng): two independent, deterministic streams.
    clearImpactTemplateMarker();
    let baseLines: TrackLine[] | null = null;
    let baseError: string | null = null;
    try {
      baseLines = sampleArcPlacementGeometry(
        baseRng,
        prepared.probe.refX,
        prepared.probe.refY,
        prepared.current.targets,
        prepared.probe.targetState,
        sample,
        prepared.current,
        prepared.lineIdStart,
        "normal",
        allContactFrames,
      ).lines;
    } catch (err) {
      baseError = errorMessage(err);
    }
    const params = sampleJValleyParams(jValleyRng, sample);

    let lines: TrackLine[] | null = null;
    let geometry: JValleyGeometry | null = null;
    let error: string | null = baseError;
    if (baseLines !== null) {
      try {
        const built = buildJValleyLines(baseLines, contactAnchor, params, prepared.lineIdStart);
        lines = built.lines;
        geometry = built.geometry;
      } catch (err) {
        error = errorMessage(err);
      }
    }
    rows.push(evaluateRow(
      prepared, "j-valley", `jvalley_${sample}`, rowIndex++, params, geometry, lines, error,
      axisEnd, allContactFrames, trueTargets, charge,
    ));
    jValleySamplesRun++;
  }

  const summary = summarizeState(rows, trueTargets, nextTargets, entrySpeed, id);
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
      "Both-bad-tail energy-bank question: from a frozen believer slow state, does a J-valley post-contact profile (catch preserved, tail descending-then-flattening) produce admitted candidates whose release speed and next-beat arrival beat the normal sampler's — i.e. does the energy bank physically, through admission, at these exact states?",
      "Admission is the unchanged tryCandidateLines; the chain is measured on the extended engine to the next beat; every engine touch is charged via getSimFrames().",
      "Retain every row; no control, candidate, source default, or promotion is selected here. Geometry is built from continuous physical inputs only; no case identity enters the construction.",
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
        lKeepPx: L_KEEP_PX,
        thetaValleyDeg: THETA_VALLEY_DEG,
        lDescendPx: L_DESCEND_PX,
        thetaExitDeg: THETA_EXIT_DEG,
        lFlattenPx: L_FLATTEN_PX,
        descendSegments: DESCEND_SEGMENTS,
        flattenSegments: FLATTEN_SEGMENTS,
        anchoring: "contact point = the polyline vertex nearest the fixture sled contact reference (targetState.sledX/sledY); L_keep is measured forward along the base polyline from that vertex; the J-profile continues from the cut point at the cut segment's heading (screen coords, +y down)",
        base: "genuine raw-normal sampleArcPlacementGeometry('normal') output at attempt=s from an independent stream; entry/catch cluster + L_keep px of post-contact tail preserved verbatim; only the tail beyond the cut is replaced",
      },
      budgets: { jValleySamples, controlSamples, STATE_FRAME_BUDGET },
      chainability: {
        minAirborneFrames: CHAIN_MIN_AIRBORNE,
        rule: "consecutive airborne frames immediately before the next beat (the detector's landing floor identity) AND terminus at/after the beat",
      },
      admission: "tryCandidateLines(engine, gap, lines, lineIdStart, allContactFrames, axisLookaheadEndFrame, gap.targets, true, undefined, probe.preTargetSledTrace)",
      errorsMeasuredAgainst: "true per-gap axis targets (ctx.gapAxisTargets), matching the exact scorer",
    },
    stateFrames,
    jValleySamplesRun,
    budgetExhausted,
    summary,
    rows,
  };

  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, document, "j-valley carrier artifact");
  return { id, artifactPath, panel: prepared.panel, summary, stateFrames, jValleySamplesRun, budgetExhausted };
}

// ─────────────────────────────────────────────────────────────────────────────

function sampleJValleyParams(rng: () => number, baseAttempt: number): JValleyParams {
  const uniform = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const integer = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
  return {
    baseAttempt,
    lKeepPx: uniform(L_KEEP_PX[0], L_KEEP_PX[1]),
    thetaValleyDeg: uniform(THETA_VALLEY_DEG[0], THETA_VALLEY_DEG[1]),
    lDescendPx: uniform(L_DESCEND_PX[0], L_DESCEND_PX[1]),
    thetaExitDeg: uniform(THETA_EXIT_DEG[0], THETA_EXIT_DEG[1]),
    lFlattenPx: uniform(L_FLATTEN_PX[0], L_FLATTEN_PX[1]),
    descendSegments: Math.min(DESCEND_SEGMENTS[1], integer(DESCEND_SEGMENTS[0], DESCEND_SEGMENTS[1])),
    flattenSegments: Math.min(FLATTEN_SEGMENTS[1], integer(FLATTEN_SEGMENTS[0], FLATTEN_SEGMENTS[1])),
  };
}

/**
 * Realize a J-valley candidate from a base normal polyline: locate the contact
 * vertex (nearest the sled contact reference), preserve the entry/catch cluster
 * plus L_keep px of post-contact tail measured forward along the polyline, then
 * from the cut point append a descend phase (heading lerps from the cut segment's
 * angle down to +thetaValley) and a flatten phase (heading lerps from +thetaValley
 * to thetaExit). The whole result is re-emitted as one travel-ordered polyline
 * with sequential ids from lineIdStart.
 */
function buildJValleyLines(
  baseLines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  params: JValleyParams,
  lineIdStart: number,
): { lines: TrackLine[]; geometry: JValleyGeometry } {
  const verts = polylineVertices(baseLines);
  if (verts.length < 2) throw new Error("base normal geometry has no polyline");

  // Contact vertex = the vertex nearest the sled contact reference. Contact jitter
  // is <= ~2px while adjacent vertices are >= a segment length away, so this
  // reliably locates the pre/post junction.
  let contactVertexIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const d = Math.hypot(verts[i].x - contactAnchor.x, verts[i].y - contactAnchor.y);
    if (d < bestDist) {
      bestDist = d;
      contactVertexIndex = i;
    }
  }

  // Walk forward from the contact vertex, preserving L_keep px of post-contact
  // tail. Kept vertices run from the polyline start through the cut point.
  const kept: Array<{ x: number; y: number }> = verts.slice(0, contactVertexIndex + 1).map((v) => ({ ...v }));
  let remaining = params.lKeepPx;
  let cutPoint = { ...verts[contactVertexIndex] };
  let cutAngleDeg: number | null = null;
  for (let i = contactVertexIndex; i < verts.length - 1 && remaining > 1e-9; i++) {
    const from = verts[i];
    const to = verts[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-9) continue;
    const segAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (remaining >= segLen) {
      kept.push({ ...to });
      cutPoint = { ...to };
      cutAngleDeg = segAngle;
      remaining -= segLen;
    } else {
      const t = remaining / segLen;
      cutPoint = { x: from.x + dx * t, y: from.y + dy * t };
      kept.push({ ...cutPoint });
      cutAngleDeg = segAngle;
      remaining = 0;
    }
  }
  const postContactLengthAvailable = polylineLengthFrom(verts, contactVertexIndex);

  if (cutAngleDeg === null) {
    // Degenerate: no post-contact segment consumed. Fall back to the heading of
    // the segment arriving at the contact vertex (the entry heading), else 0.
    if (contactVertexIndex >= 1) {
      const a = verts[contactVertexIndex - 1];
      const b = verts[contactVertexIndex];
      cutAngleDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    } else {
      cutAngleDeg = 0;
    }
  }

  // J-profile from the cut point. Screen coords: +y down, so a descending heading
  // is a POSITIVE angle; the valley angle is +thetaValley below horizontal.
  const jVerts: Array<{ x: number; y: number }> = [];
  let point = { ...cutPoint };
  const descendLen = params.lDescendPx / params.descendSegments;
  for (let i = 0; i < params.descendSegments; i++) {
    const frac = (i + 1) / params.descendSegments;
    const angleDeg = lerp(cutAngleDeg, params.thetaValleyDeg, frac);
    const tangent = unit(angleDeg);
    point = { x: point.x + tangent.x * descendLen, y: point.y + tangent.y * descendLen };
    jVerts.push({ ...point });
  }
  const flattenLen = params.lFlattenPx / params.flattenSegments;
  for (let i = 0; i < params.flattenSegments; i++) {
    const frac = (i + 1) / params.flattenSegments;
    const angleDeg = lerp(params.thetaValleyDeg, params.thetaExitDeg, frac);
    const tangent = unit(angleDeg);
    point = { x: point.x + tangent.x * flattenLen, y: point.y + tangent.y * flattenLen };
    jVerts.push({ ...point });
  }

  const fullVerts = [...kept, ...jVerts];
  const lines: TrackLine[] = [];
  for (let i = 0; i < fullVerts.length - 1; i++) {
    const a = fullVerts[i];
    const b = fullVerts[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) continue; // drop duplicate vertices
    lines.push(makeSolidLine(lineIdStart + lines.length, a.x, a.y, b.x, b.y));
  }
  if (lines.length === 0) throw new Error("j-valley geometry collapsed to zero lines");
  for (const line of lines) {
    for (const value of [line.x1, line.y1, line.x2, line.y2]) {
      if (!Number.isFinite(value)) throw new Error("j-valley geometry produced a non-finite coordinate");
    }
  }
  return {
    lines,
    geometry: {
      contactVertexIndex,
      postContactLengthAvailablePx: round(postContactLengthAvailable),
      cutAngleDeg: round(cutAngleDeg),
      keptVertexCount: kept.length,
      totalLineCount: lines.length,
    },
  };
}

function polylineVertices(lines: readonly TrackLine[]): Array<{ x: number; y: number }> {
  const verts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0) verts.push({ x: line.x1, y: line.y1 });
    verts.push({ x: line.x2, y: line.y2 });
  }
  return verts;
}

function polylineLengthFrom(verts: readonly { x: number; y: number }[], startIndex: number): number {
  let total = 0;
  for (let i = startIndex; i < verts.length - 1; i++) {
    total += Math.hypot(verts[i + 1].x - verts[i].x, verts[i + 1].y - verts[i].y);
  }
  return total;
}

function evaluateRow(
  prepared: PreparedTrajectoryFixtureCore,
  family: Family,
  label: string,
  index: number,
  params: JValleyParams | null,
  geometry: JValleyGeometry | null,
  lines: TrackLine[] | null,
  geometryError: string | null,
  axisEnd: number,
  allContactFrames: number[],
  trueTargets: AxisValues,
  charge: (frames: number) => void,
): Row {
  const empty: Row = {
    index, family, label, params, geometry,
    admitted: false, admissionFrames: 0,
    achievedAtEnd: null, currentGapErr: null, finalLineCount: null,
    release: null, chain: null, chained: false, chainableWithMargin: false,
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
  const speedErrAbs = trueTargets.speed !== undefined && achieved.speed !== undefined
    ? Math.abs(achieved.speed - trueTargets.speed)
    : null;
  const airErrAbs = trueTargets.air !== undefined && achieved.air !== undefined
    ? Math.abs(achieved.air - trueTargets.air)
    : null;
  const impactSigned = trueTargets.impact !== undefined && achieved.impact !== undefined
    ? achieved.impact - trueTargets.impact
    : null;

  const chain = measureChain(prepared, fit, charge);
  const chained = chain.survivedToBeat && chain.arrivalSpeed !== null;
  const chainableWithMargin = chain.survivedToBeat && chain.airborneMarginBeforeBeat >= CHAIN_MIN_AIRBORNE;

  return {
    index, family, label, params, geometry,
    admitted: true,
    admissionFrames,
    achievedAtEnd: {
      air: achieved.air === undefined ? null : round(achieved.air),
      speed: achieved.speed === undefined ? null : round(achieved.speed),
      impact: achieved.impact === undefined ? null : round(achieved.impact),
    },
    currentGapErr: {
      speedAbs: speedErrAbs === null ? null : round(speedErrAbs),
      airAbs: airErrAbs === null ? null : round(airErrAbs),
      impactSigned: impactSigned === null ? null : round(impactSigned),
    },
    finalLineCount: fit.lines.length,
    release: {
      speed: fit.releaseSpeed === undefined ? null : round(fit.releaseSpeed),
      velocityY: fit.releaseVelocityY === undefined ? null : round(fit.releaseVelocityY),
      airborne: fit.releaseAirborne ?? null,
      groundedFrames: fit.releaseGroundedFrames ?? null,
    },
    chain,
    chained,
    chainableWithMargin,
    totalFrames: admissionFrames + chain.rideFrames,
    error: null,
  };
}

/** Extend the immutable prefix engine with the admitted fit and ride to the next
 *  beat. Arrival speed/angle at the beat is the energy-bank quantity of interest;
 *  the airborne margin is the detector's landing-floor identity for the NEXT catch. */
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

function summarizeState(
  rows: readonly Row[],
  trueTargets: AxisValues,
  nextTargets: AxisValues,
  entrySpeed: number,
  id: StateId,
): StateSummary {
  const families: Record<Family, FamilySummary> = {
    "j-valley": summarizeFamily(rows.filter((r) => r.family === "j-valley")),
    "raw-normal": summarizeFamily(rows.filter((r) => r.family === "raw-normal")),
  };
  const j = families["j-valley"];
  const n = families["raw-normal"];
  const arrivalSpeedMaxDelta = deltaOrNull(j.arrivalSpeed.max, n.arrivalSpeed.max);
  const arrivalSpeedMedianDelta = deltaOrNull(j.arrivalSpeed.median, n.arrivalSpeed.median);
  const releaseSpeedMedianDelta = deltaOrNull(j.releaseSpeedMedian, n.releaseSpeedMedian);

  const verdict = j.chained === 0
    ? `no j-valley candidate chained (admitted ${j.admitted}/${j.attempted}); no arrival comparison possible`
    : n.chained === 0
      ? `raw-normal produced zero chained candidates; broken control reference`
      : (arrivalSpeedMedianDelta ?? 0) > 0
        ? `j-valley banks: median arrival speed +${round3(arrivalSpeedMedianDelta!)} px/f over raw-normal (max ${arrivalSpeedMaxDelta === null ? "n/a" : (arrivalSpeedMaxDelta >= 0 ? "+" : "") + round3(arrivalSpeedMaxDelta)})`
        : `j-valley does not bank through admission: median arrival speed ${round3(arrivalSpeedMedianDelta!)} px/f vs raw-normal`;

  return {
    currentTargets: {
      air: trueTargets.air === undefined ? null : round(trueTargets.air),
      speed: trueTargets.speed === undefined ? null : round(trueTargets.speed),
      impact: trueTargets.impact === undefined ? null : round(trueTargets.impact),
    },
    nextSpeedAsk: nextTargets.speed === undefined ? null : round(nextTargets.speed),
    entrySpeedPxPerFrame: round(entrySpeed),
    families,
    comparison: {
      definition: "over admitted+survivedToBeat rows with a measured arrival: j-valley minus raw-normal",
      arrivalSpeedMaxDelta: arrivalSpeedMaxDelta === null ? null : round(arrivalSpeedMaxDelta),
      arrivalSpeedMedianDelta: arrivalSpeedMedianDelta === null ? null : round(arrivalSpeedMedianDelta),
      releaseSpeedMedianDelta: releaseSpeedMedianDelta === null ? null : round(releaseSpeedMedianDelta),
    },
    verdict: `${id}: ${verdict}`,
  };
}

function summarizeFamily(rows: readonly Row[]): FamilySummary {
  const attempted = rows.length;
  const admitted = rows.filter((r) => r.admitted).length;
  const chainedRows = rows.filter((r) => r.chained);
  const marginRows = rows.filter((r) => r.chainableWithMargin);
  const releaseSpeeds = rows.filter((r) => r.admitted && r.release?.speed !== null && r.release?.speed !== undefined)
    .map((r) => r.release!.speed!);

  const arrivalSpeeds = chainedRows.map((r) => r.chain!.arrivalSpeed!).filter((v) => v !== null);
  const arrivalAngles = chainedRows.map((r) => r.chain!.arrivalAngleDeg).filter((v): v is number => v !== null);
  const impactAchieved = chainedRows.map((r) => r.achievedAtEnd?.impact).filter((v): v is number => v !== null && v !== undefined);
  const airAchieved = chainedRows.map((r) => r.achievedAtEnd?.air).filter((v): v is number => v !== null && v !== undefined);
  const impactErr = chainedRows.map((r) => r.currentGapErr?.impactSigned).filter((v): v is number => v !== null && v !== undefined).map((v) => Math.abs(v));
  const airErr = chainedRows.map((r) => r.currentGapErr?.airAbs).filter((v): v is number => v !== null && v !== undefined);
  const speedErr = chainedRows.map((r) => r.currentGapErr?.speedAbs).filter((v): v is number => v !== null && v !== undefined);

  return {
    attempted,
    admitted,
    admissionRate: attempted > 0 ? round(admitted / attempted) : 0,
    chained: chainedRows.length,
    chainableWithMargin: marginRows.length,
    arrivalSpeed: dist(arrivalSpeeds),
    arrivalAngleMedianDeg: medianOrNull(arrivalAngles),
    currentGapImpactAchievedMedian: medianOrNull(impactAchieved),
    currentGapAirAchievedMedian: medianOrNull(airAchieved),
    currentGapImpactErrMedian: medianOrNull(impactErr),
    currentGapAirErrMedian: medianOrNull(airErr),
    currentGapSpeedErrMedian: medianOrNull(speedErr),
    releaseSpeedMedian: medianOrNull(releaseSpeeds),
    totalChargedFrames: rows.reduce((sum, r) => sum + r.totalFrames, 0),
  };
}

function formatStateSummary(result: StateResult): string[] {
  const s = result.summary;
  const j = s.families["j-valley"];
  const n = s.families["raw-normal"];
  const line = (name: string, f: FamilySummary): string =>
    `  ${name.padEnd(11)} att ${String(f.attempted).padStart(4)}  adm ${String(f.admitted).padStart(4)} (${pct(f.admissionRate)})  ` +
    `chn ${String(f.chained).padStart(4)}  medArr ${fmt(f.arrivalSpeed.median)}  maxArr ${fmt(f.arrivalSpeed.max)}  ` +
    `medArrAng ${fmt(f.arrivalAngleMedianDeg)}  medRel ${fmt(f.releaseSpeedMedian)}  medAirErr ${fmt(f.currentGapAirErrMedian)}  medImpErr ${fmt(f.currentGapImpactErrMedian)}`;
  const c = s.comparison;
  return [
    `STATE ${result.id} (gap ${result.panel.currentGap}->${result.panel.outgoingGap}, interval ${result.panel.outgoingIntervalFrames}f, entry ${s.entrySpeedPxPerFrame} px/f; ` +
      `current asks air/speed/impact ${fmt(s.currentTargets.air)}/${fmt(s.currentTargets.speed)}/${fmt(s.currentTargets.impact)}; next speed ask ${fmt(s.nextSpeedAsk)}):`,
    line("raw-normal", n),
    line("j-valley", j),
    `  arrival-speed delta (j-valley - raw-normal): max ${signed(c.arrivalSpeedMaxDelta)}, median ${signed(c.arrivalSpeedMedianDelta)}; release-speed median delta ${signed(c.releaseSpeedMedianDelta)}`,
    `  VERDICT: ${s.verdict}`,
    `  frames: ${result.stateFrames} (j-valley samples run ${result.jValleySamplesRun}${result.budgetExhausted ? ", frame budget exhausted" : ""})`,
    `  artifact: ${result.artifactPath}`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

function dist(values: readonly number[]): Dist {
  if (values.length === 0) return { count: 0, median: null, p90: null, max: null };
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    count: sorted.length,
    median: round(quantile(sorted, 0.5)),
    p90: round(quantile(sorted, 0.9)),
    max: round(sorted[sorted.length - 1]),
  };
}

function quantile(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = q * (sortedAsc.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return round(quantile(sorted, 0.5));
}

function deltaOrNull(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a - b;
}

/** Deterministic stream seeds keyed on the fixture's public seed and gap. */
function controlStreamSeed(prepared: PreparedTrajectoryFixtureCore): number {
  return (Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.current.index + 1) | 0;
}

function baseNormalSeed(prepared: PreparedTrajectoryFixtureCore): number {
  return (Math.imul(controlStreamSeed(prepared), 2_246_822_519) + 7) | 0;
}

function jValleySeed(prepared: PreparedTrajectoryFixtureCore): number {
  return (Math.imul(controlStreamSeed(prepared), 998_244_353) + 17) | 0;
}

function unit(angleDeg: number): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pct(rate: number): string {
  return `${round3(rate * 100)}%`;
}

function signed(value: number | null): string {
  if (value === null) return "n/a";
  return (value >= 0 ? "+" : "") + round3(value);
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
