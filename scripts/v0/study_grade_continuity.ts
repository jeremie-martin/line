/**
 * Grade-continuity assay (calibration only, WASM/500k believer fixtures).
 *
 * The campaign's next declared trajectory-synthesis falsifier is deliberately
 * modest: does retaining a shallow post-contact grade across several ordinary
 * contacts physically hold speed through the slow believer clusters where
 * independently sampled grades regress to the mean?  This is not a compiler
 * candidate.  It replays frozen prefixes, admits every proposed line set with
 * the ordinary tryCandidateLines gate, and compares two otherwise-identical
 * streams:
 *
 *   - independent: production normal geometry at every attempt;
 *   - grade-continuous: on a deterministic 25% attempt span, blend only the
 *     post-contact terminal grade toward the previous committed terminal grade.
 *
 * The previous grade is a continuous measured property of the committed line
 * set.  No source, case, duration class, target identity, or outcome feeds the
 * construction.  Candidate choice is the ordinary local exact cost minimum;
 * this assay does not install a ranker, choose a source default, or claim a
 * full-compiler result.
 */
import { makeRng } from "../lib/rng.ts";
import { sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getCandidateProbe, type SpecContext } from "./optimizer/sample.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { authoredSpeedToPx, type Gap, type TrackLine } from "./types.ts";
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

const SCHEMA = "line.study-grade-continuity.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/grade-continuity-2026-07-17/v3";
const FIXTURES = {
  believer36: "believer36-b500000-d7aec722a976.json",
  believer69: "believer69-b500000-24448183619b.json",
} as const;
type StateId = keyof typeof FIXTURES;
type Family = "independent" | "grade-continuous";

// The physical hypothesis is persistent shallow grades, not a one-off rail.
// Every fourth low-discrepancy attempt receives the correlated terminal grade;
// the other 75% remain byte-for-byte normal proposals.
const CHAIN_CONTACTS = 5;
const CANDIDATES_PER_CONTACT = 24;
const CONTINUITY_SHARE = 0.25;
const TERMINAL_GRADE_BLEND = 0.70;
const SHALLOW_GRADE_FULL_DEG = 8;
const SHALLOW_GRADE_ZERO_DEG = 22;
const SPEED_DEFICIT_START_PX_PER_FRAME = 0.35;
const SPEED_DEFICIT_SPAN_PX_PER_FRAME = 2.0;
const DEFAULT_TRIALS = 24;
const STATE_FRAME_BUDGET = 3_000_000;

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_grade_continuity.ts [--case=believer36|believer69|all] [--trials=N] [--out-dir=DIR]",
    "",
    "Calibration-only grade-continuity assay. Requires LR_ENGINE=wasm and the",
    "frozen believer-energy V3 fixtures. It compares ordinary local-cost chains",
    "against an attempt-spanned previous-grade-correlated normal stream.",
  ].join("\n") + "\n");
  process.exit(0);
}

if (process.env.LR_ENGINE !== "wasm") {
  throw new Error("grade-continuity assay requires LR_ENGINE=wasm");
}
const supported = ["--case=", "--trials=", "--out-dir=", "--help", "-h"];
const unknown = argv.filter((value) => !supported.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);

const stateIds: readonly StateId[] = ["believer36", "believer69"];
const requestedCase = argument("case") ?? "all";
if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
  throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
}
const requestedTrials = argument("trials") ?? `${DEFAULT_TRIALS}`;
const trials = Number(requestedTrials);
if (!Number.isInteger(trials) || trials <= 0 || trials > 256) {
  throw new Error(`--trials must be an integer in [1, 256]; received ${requestedTrials}`);
}
const selected: readonly StateId[] = requestedCase === "all" ? stateIds : [requestedCase as StateId];
const outDir = argument("out-dir") ?? "generated/studies/grade-continuity/v1";

const sourceIdentity = studySourceIdentity("scripts/v0/study_grade_continuity.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "grade-continuity.v1",
  captureBudget: 500_000,
  stream: {
    baseline: "sampleArcPlacementGeometry(normal)",
    correlated: "on deterministic low-discrepancy 25% attempt span, blend terminal post grade toward previous committed terminal grade",
    normalCandidatesPreserved: true,
    selection: "minimum ordinary exact GapFit.cost at each contact",
  },
  constants: {
    chainContacts: CHAIN_CONTACTS,
    candidatesPerContact: CANDIDATES_PER_CONTACT,
    continuityShare: CONTINUITY_SHARE,
    terminalGradeBlend: TERMINAL_GRADE_BLEND,
    shallowGradeFullDeg: SHALLOW_GRADE_FULL_DEG,
    shallowGradeZeroDeg: SHALLOW_GRADE_ZERO_DEG,
    speedDeficitStartPxPerFrame: SPEED_DEFICIT_START_PX_PER_FRAME,
    speedDeficitSpanPxPerFrame: SPEED_DEFICIT_SPAN_PX_PER_FRAME,
    trials,
    stateFrameBudget: STATE_FRAME_BUDGET,
  },
}));

type CandidateRow = {
  attempt: number;
  transformed: boolean;
  previousGradeDeg: number | null;
  rawTerminalGradeDeg: number | null;
  proposedTerminalGradeDeg: number | null;
  admitted: boolean;
  cost: number | null;
  simFrames: number;
};

type ContactStep = {
  gapIndex: number;
  authored: { speed: number | null; air: number | null; impact: number | null };
  entry: { speed: number; angleDeg: number };
  candidates: CandidateRow[];
  chosen: {
    attempt: number;
    transformed: boolean;
    cost: number;
    terminalGradeDeg: number;
    achieved: { speed: number | null; air: number | null; impact: number | null };
  } | null;
  result: "committed" | "no-admitted-candidate" | "missing-contact";
};

type Trial = {
  family: Family;
  trial: number;
  completedContacts: number;
  chargedFrames: number;
  steps: ContactStep[];
  terminal: {
    speed: number | null;
    velocityAngleDeg: number | null;
    meanAchievedSpeed: number | null;
    meanTerminalGradeDeg: number | null;
  };
};

type FamilySummary = {
  trials: number;
  completeChains: number;
  meanCompletedContacts: number;
  terminalSpeed: Summary;
  meanAchievedSpeed: Summary;
  meanTerminalGradeDeg: Summary;
  transformedChosen: number;
  transformedAdmitted: number;
};

type Summary = { count: number; mean: number | null; median: number | null; min: number | null; max: number | null };

let totalFrames = 0;
const started = performance.now();
const results = selected.map((id) => runState(id));
for (const result of results) {
  const independent = result.summary.families.independent;
  const correlated = result.summary.families["grade-continuous"];
  const delta = difference(correlated.terminalSpeed.mean, independent.terminalSpeed.mean);
  process.stdout.write(
    `${result.id}: complete ${correlated.completeChains}/${correlated.trials} vs ${independent.completeChains}/${independent.trials}; ` +
    `terminal speed ${fmt(correlated.terminalSpeed.mean)} vs ${fmt(independent.terminalSpeed.mean)} ` +
    `(delta ${signed(delta)}); chosen transformed ${correlated.transformedChosen}; frames ${result.chargedFrames}\n`,
  );
}
process.stdout.write(`grade continuity: ${results.length} state(s), ${Math.round(performance.now() - started)}ms; charged frames ${totalFrames}\n`);

function runState(id: StateId): { id: StateId; artifactPath: string; summary: { families: Record<Family, FamilySummary>; comparison: Record<string, number | null> }; chargedFrames: number } {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") throw new Error(`${id} is not a calibration fixture`);

  let chargedFrames = 0;
  const charge = (frames: number): void => {
    chargedFrames += frames;
    totalFrames += frames;
  };
  const rows: Trial[] = [];
  for (let trial = 0; trial < trials; trial++) {
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    const prefixTerminalGradeDeg = prefixTerminalGrade(fixture);
    rows.push(runTrial(prepared, "independent", trial, charge, prefixTerminalGradeDeg));
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    rows.push(runTrial(prepared, "grade-continuous", trial, charge, prefixTerminalGradeDeg));
  }
  const families: Record<Family, FamilySummary> = {
    independent: summarize(rows.filter((row) => row.family === "independent")),
    "grade-continuous": summarize(rows.filter((row) => row.family === "grade-continuous")),
  };
  const comparison = {
    terminalSpeedMeanDelta: difference(families["grade-continuous"].terminalSpeed.mean, families.independent.terminalSpeed.mean),
    meanAchievedSpeedDelta: difference(families["grade-continuous"].meanAchievedSpeed.mean, families.independent.meanAchievedSpeed.mean),
    completeChainDelta: families["grade-continuous"].completeChains - families.independent.completeChains,
  };
  const artifactIdentity = studyArtifactIdentity({
    schema: SCHEMA,
    fixtureFingerprint: fixture.fixtureFingerprint,
    studySourceFingerprint: sourceIdentity.studySourceFingerprint,
    observationCandidateFingerprint: observationCompiler.candidateFingerprint,
    protocolFingerprint,
  });
  const artifact = {
    schema: SCHEMA,
    artifactIdentity,
    purpose: "Fixture-only falsifier for the grade-continuity trajectory mechanism. Every candidate remains subject to the ordinary exact admission gate and the two streams differ only by a deterministic, attempt-spanned terminal-grade correlation toward the previous committed grade.",
    status: {
      productionIntegration: "forbidden: calibration study only; it does not modify compiler candidates, selection, or promotion",
      resultEligibility: "physical/executable evidence only; a source-default lane requires its own scope panel and normal V2 funnel",
    },
    argv: [...argv],
    elapsedMs: Math.round(performance.now() - started),
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
      chainContacts: CHAIN_CONTACTS,
      candidatesPerContact: CANDIDATES_PER_CONTACT,
      selection: "ordinary GapFit.cost minimum; stable attempt order resolves ties",
      correlatedAttemptRule: "lowDiscrepancyRoll(attempt, 41) >= 0.75; independent stream never transforms",
      gradeRule: "terminal post grade blends toward the prior committed terminal line grade only while that prior grade is shallow and the authored speed exceeds measured entry speed; capture-side geometry through the contact vertex is byte-preserved",
      admission: "unchanged tryCandidateLines with exact survival, landing, off-beat, and target-axis gates",
      sourceInputs: "continuous previous committed terminal grade, authored speed deficit, existing sampled geometry, and attempt coordinate only",
    },
    chargedFrames,
    budgetExhausted: chargedFrames >= STATE_FRAME_BUDGET,
    summary: { families, comparison },
    rows,
  };
  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, artifact, "grade-continuity artifact");
  return { id, artifactPath, summary: { families, comparison }, chargedFrames };
}

function runTrial(
  prepared: PreparedTrajectoryFixtureCore,
  family: Family,
  trial: number,
  charge: (frames: number) => void,
  initialPreviousGrade: number | null,
): Trial {
  let engine = prepared.engine;
  let lineIdStart = prepared.lineIdStart;
  // The first studied gap also has a committed predecessor: the frozen prefix
  // retains its exact chosen line set.  Starting at null would silently turn
  // the mechanism off precisely at the slow-episode onset.
  let previousGrade: number | null = initialPreviousGrade;
  const steps: ContactStep[] = [];

  for (let offset = 0; offset < CHAIN_CONTACTS; offset++) {
    const gap = prepared.setup.gaps[prepared.current.index + offset];
    if (gap === undefined || !gap.endsWithContact) {
      steps.push({
        gapIndex: prepared.current.index + offset,
        authored: { speed: null, air: null, impact: null },
        entry: { speed: 0, angleDeg: 0 }, candidates: [], chosen: null, result: "missing-contact",
      });
      break;
    }
    const probe = getCandidateProbe(engine, gap, prepared.ctx);
    const rng = makeRng((Math.imul((trial + 1) | 0, 1000003) + gap.index + 1) | 0);
    const axisEnd = axisLookaheadEndFrame(gap, prepared.ctx.allContactFrames);
    const candidates: CandidateRow[] = [];
    let chosen: { fit: GapFit; attempt: number; transformed: boolean; terminalGradeDeg: number } | null = null;

    for (let attempt = 0; attempt < CANDIDATES_PER_CONTACT; attempt++) {
      const geometry = sampleArcPlacementGeometry(
        rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap, lineIdStart, "normal",
        prepared.ctx.allContactFrames,
      );
      const rawTerminalGradeDeg = terminalGrade(geometry.lines);
      const speedDeficit = gap.targets.speed === undefined
        ? 0
        : smoothstep((authoredSpeedToPx(gap.targets.speed) - probe.targetState.speed - SPEED_DEFICIT_START_PX_PER_FRAME) /
          SPEED_DEFICIT_SPAN_PX_PER_FRAME);
      const transformed = family === "grade-continuous" && previousGrade !== null && speedDeficit > 0 && isContinuityAttempt(attempt);
      const lines = transformed
        ? correlateTerminalGrade(
          geometry.lines, { x: probe.targetState.sledX, y: probe.targetState.sledY }, previousGrade!, speedDeficit,
        )
        : geometry.lines;
      const proposedTerminalGradeDeg = terminalGrade(lines);
      const before = getSimFrames();
      const fit = tryCandidateLines(
        engine, gap, lines, lineIdStart, prepared.ctx.allContactFrames, axisEnd,
        gap.targets, true, undefined, probe.preTargetSledTrace,
      ) as GapFit | null;
      const frames = getSimFrames() - before;
      charge(frames);
      candidates.push({
        attempt, transformed, previousGradeDeg: previousGrade, rawTerminalGradeDeg,
        proposedTerminalGradeDeg, admitted: fit !== null, cost: fit === null ? null : round(fit.cost), simFrames: frames,
      });
      if (fit !== null && (chosen === null || fit.cost < chosen.fit.cost)) {
        chosen = { fit, attempt, transformed, terminalGradeDeg: proposedTerminalGradeDeg ?? 0 };
      }
    }

    const authored = {
      speed: gap.targets.speed ?? null,
      air: gap.targets.air ?? null,
      impact: gap.targets.impact ?? null,
    };
    if (chosen === null) {
      steps.push({ gapIndex: gap.index, authored, entry: { speed: round(probe.targetState.speed), angleDeg: round(probe.targetState.angleDeg) }, candidates, chosen: null, result: "no-admitted-candidate" });
      break;
    }
    const achieved = chosen.fit.achievedAtEnd ?? chosen.fit.achieved;
    steps.push({
      gapIndex: gap.index,
      authored,
      entry: { speed: round(probe.targetState.speed), angleDeg: round(probe.targetState.angleDeg) },
      candidates,
      chosen: {
        attempt: chosen.attempt,
        transformed: chosen.transformed,
        cost: round(chosen.fit.cost),
        terminalGradeDeg: round(chosen.terminalGradeDeg),
        achieved: { speed: achieved.speed ?? null, air: achieved.air ?? null, impact: achieved.impact ?? null },
      },
      result: "committed",
    });
    engine = engine.addLine(chosen.fit.lines.map((line) => engineLineFromTrackLine(line)));
    lineIdStart += chosen.fit.lines.length;
    previousGrade = chosen.terminalGradeDeg;
  }

  const committed = steps.filter((step) => step.result === "committed");
  const last = committed.at(-1);
  const terminalGap = last === undefined ? null : prepared.setup.gaps[last.gapIndex + 1];
  const terminalProbe = terminalGap === null || terminalGap === undefined
    ? null
    : getCandidateProbe(engine, terminalGap, prepared.ctx).targetState;
  const chosenSpeeds = committed
    .map((step) => step.chosen?.achieved.speed)
    .filter((value): value is number => value !== null && value !== undefined);
  const grades = committed
    .map((step) => step.chosen?.terminalGradeDeg)
    .filter((value): value is number => value !== null && value !== undefined);
  const chargedFrames = steps.flatMap((step) => step.candidates).reduce((sum, candidate) => sum + candidate.simFrames, 0);
  return {
    family, trial, completedContacts: committed.length, chargedFrames, steps,
    terminal: {
      speed: terminalProbe === null ? null : round(terminalProbe.speed),
      velocityAngleDeg: terminalProbe === null ? null : round(terminalProbe.angleDeg),
      meanAchievedSpeed: mean(chosenSpeeds),
      meanTerminalGradeDeg: mean(grades),
    },
  };
}

/** A deterministic 25% attempt span, equivalent in role to the normal sampler's
 * low-discrepancy attempt lanes. */
function isContinuityAttempt(attempt: number): boolean {
  return lowDiscrepancyRoll(attempt, 41) >= 1 - CONTINUITY_SHARE;
}

function lowDiscrepancyRoll(attempt: number, salt: number): number {
  const stride = 0.6180339887498949;
  const offset = (salt + 1) * 0.137503523749935;
  const raw = (Math.max(0, attempt) + 1) * stride + offset;
  return raw - Math.floor(raw);
}

/**
 * Preserve every pre-contact/capture-side segment and re-realize only the
 * terminal post profile.  The target terminal heading is a continuous blend of
 * the sampled terminal heading and the previous committed heading.  A shallow
 * gate prevents a steep prior release from becoming a hidden rescue lane.
 */
function correlateTerminalGrade(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  previousGradeDeg: number,
  speedDeficitPressure: number,
): TrackLine[] {
  const vertices = polylineVertices(lines);
  if (vertices.length < 3) return [...lines];
  let contact = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const distance = Math.hypot(vertices[i].x - contactAnchor.x, vertices[i].y - contactAnchor.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      contact = i;
    }
  }
  const postSegments = vertices.length - 1 - contact;
  if (postSegments < 2) return [...lines];
  const rawTerminal = heading(vertices.at(-2)!, vertices.at(-1)!);
  const shallow = 1 - smoothstep((Math.abs(previousGradeDeg) - SHALLOW_GRADE_FULL_DEG) /
    (SHALLOW_GRADE_ZERO_DEG - SHALLOW_GRADE_FULL_DEG));
  const terminal = lerpAngle(
    rawTerminal, previousGradeDeg, TERMINAL_GRADE_BLEND * shallow * clamp(speedDeficitPressure, 0, 1),
  );
  const rebuilt = vertices.slice(0, contact + 1).map((point) => ({ ...point }));
  let point = { ...vertices[contact] };
  for (let index = 1; index <= postSegments; index++) {
    const from = vertices[contact + index - 1];
    const to = vertices[contact + index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const rawHeading = heading(from, to);
    // Preserve the contact side exactly; the terminal release direction carries
    // the correlated component, fading in continuously across the post profile.
    const progress = index / postSegments;
    const angle = lerpAngle(rawHeading, terminal, progress * progress);
    const radians = angle * Math.PI / 180;
    point = { x: point.x + Math.cos(radians) * length, y: point.y + Math.sin(radians) * length };
    rebuilt.push(point);
  }
  return rebuilt.slice(1).map((end, index) => ({
    ...lines[index],
    x1: rebuilt[index].x,
    y1: rebuilt[index].y,
    x2: end.x,
    y2: end.y,
  }));
}

function polylineVertices(lines: readonly TrackLine[]): Array<{ x: number; y: number }> {
  if (lines.length === 0) return [];
  return [{ x: lines[0].x1, y: lines[0].y1 }, ...lines.map((line) => ({ x: line.x2, y: line.y2 }))];
}

function terminalGrade(lines: readonly TrackLine[]): number | null {
  const last = lines.at(-1);
  return last === undefined ? null : round(heading(last, last));
}

function prefixTerminalGrade(fixture: ReturnType<typeof readFrozenTrajectoryFixture>): number | null {
  const prefix = fixture.physicalPrefix as unknown as { prefixFitLines?: readonly (readonly TrackLine[])[] };
  const previousFit = prefix.prefixFitLines?.at(-1);
  return previousFit === undefined ? null : terminalGrade(previousFit);
}

function heading(from: { x1: number; y1: number; x2: number; y2: number } | { x: number; y: number }, to: { x: number; y: number } | { x1: number; y1: number; x2: number; y2: number }): number {
  const start = "x" in from ? from : { x: from.x1, y: from.y1 };
  const end = "x" in to ? to : { x: to.x2, y: to.y2 };
  return Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
}

function lerpAngle(from: number, to: number, amount: number): number {
  let delta = ((to - from + 180) % 360 + 360) % 360 - 180;
  return from + delta * clamp(amount, 0, 1);
}

function smoothstep(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function summarize(rows: readonly Trial[]): FamilySummary {
  const committed = rows.flatMap((row) => row.steps.filter((step) => step.result === "committed"));
  return {
    trials: rows.length,
    completeChains: rows.filter((row) => row.completedContacts === CHAIN_CONTACTS).length,
    meanCompletedContacts: mean(rows.map((row) => row.completedContacts)) ?? 0,
    terminalSpeed: distribution(rows.map((row) => row.terminal.speed)),
    meanAchievedSpeed: distribution(rows.map((row) => row.terminal.meanAchievedSpeed)),
    meanTerminalGradeDeg: distribution(rows.map((row) => row.terminal.meanTerminalGradeDeg)),
    transformedChosen: committed.filter((step) => step.chosen?.transformed).length,
    transformedAdmitted: committed.flatMap((step) => step.candidates).filter((candidate) => candidate.transformed && candidate.admitted).length,
  };
}

function distribution(values: readonly (number | null)[]): Summary {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  return {
    count: finite.length,
    mean: mean(finite),
    median: finite.length === 0 ? null : round(finite[Math.floor(finite.length / 2)]),
    min: finite.length === 0 ? null : round(finite[0]),
    max: finite.length === 0 ? null : round(finite.at(-1)!),
  };
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function difference(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : round(left - right);
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function fmt(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(3);
}

function signed(value: number | null): string {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}
