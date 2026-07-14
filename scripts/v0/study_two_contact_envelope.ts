/**
 * Sealed observation-only two-contact feasibility assay.
 *
 * It compares a fixed compact state-derived stencil against a broad diagnostic
 * oracle. Both construct only from the current event and the outgoing
 * non-event interval. The next contact is an exact replay endpoint, never an
 * input to construction or an outcome-derived selection rule.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import frontier5 from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import frontier7 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { MIN_LANDING_AIRBORNE_FRAMES } from "../lib/detector.ts";
import { snapshotArcPlacementStats } from "./arc_placement.ts";
import {
  assertCompilerSourcesCommitted,
  compilerCandidateIdentity,
} from "./benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import { airborneAt } from "./core/substrate.ts";
import { extendNodeCached, getCandidatesSorted, type SearchNode } from "./optimizer/node.ts";
import type { Candidate, SpecContext } from "./optimizer/sample.ts";
import type { AxisValues, Gap, TrackLine } from "./types.ts";
import {
  buildTrajectoryCaptureSetup,
  materializeTrajectoryCaptureInput,
  type TrajectoryCaptureCase,
} from "./trajectory/capture_input.ts";
import { prepareTrajectoryPrefix, TrajectoryPrefixUnavailableError } from "./trajectory/prefix_capture_core.ts";
import { sha256, stableJson } from "./trajectory/postimpact_study_inputs.ts";
import { rebuildPhysicalPrefixEngine } from "./trajectory/study_fixture.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import {
  makeCompactTwoContactControls,
  makeOracleTwoContactControls,
  realizeTwoContactPhase,
  type TwoContactOutgoingIntent,
  type TwoContactPhaseControl,
} from "./trajectory/two_contact_phase.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_two_contact_envelope.ts --out=FILE [--case=all|ID] [--budget=500000]",
    "       [--oracle-controls=1024] [--next-pool=32]",
    "",
    "Runs a sealed observation-only exact-replay assay. It requires a clean committed",
    "compiler tree, LR_ENGINE=wasm only, and an evidence path outside the repository.",
    "It does not score, rank, select, resume a suffix, or alter compiler behavior.",
  ].join("\n") + "\n");
  process.exit(0);
}

type ScenarioKind = "dense" | "pickup" | "ordinary" | "low_air" | "impact_led";
type Scenario = {
  id: string;
  kind: ScenarioKind;
  capture: TrajectoryCaptureCase;
};

const scenarios: readonly Scenario[] = [
  {
    id: "dense",
    kind: "dense",
    capture: {
      id: "two_contact_dense",
      cohort: "calibration",
      category: "dense",
      spec: dense,
      sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
      seed: 3_057_130_498,
      targetGap: 69,
      selectionRationale: "Predeclared dense phase boundary immediately before the g70 dead end.",
    },
  },
  {
    id: "dense240",
    kind: "dense",
    capture: {
      id: "two_contact_dense240",
      cohort: "calibration",
      category: "dense",
      spec: dense240,
      sourcePath: "benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts",
      seed: 3_057_130_496,
      targetGap: 86,
      selectionRationale: "Independent 240ms dense phase boundary used only as a second physical state.",
    },
  },
  {
    id: "pickup",
    kind: "pickup",
    capture: {
      id: "two_contact_pickup",
      cohort: "calibration",
      category: "ordinary",
      spec: pickupShifted,
      sourcePath: "benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts",
      seed: 27,
      targetGap: 90,
      selectionRationale: "Predeclared shifted-pickup boundary; unavailability is retained rather than replaced.",
    },
  },
  {
    id: "ordinary",
    kind: "ordinary",
    capture: {
      id: "two_contact_ordinary",
      cohort: "calibration",
      category: "ordinary",
      spec: countercurrent,
      sourcePath: "benchmark/v2/cases/normative/representative/countercurrent.ts",
      seed: 24,
      targetGap: 20,
      selectionRationale: "Predeclared ordinary contact-to-contact transition, independent of failure localization.",
    },
  },
  {
    id: "frontier3",
    kind: "low_air",
    capture: {
      id: "two_contact_frontier3",
      cohort: "calibration",
      category: "low_air",
      spec: frontier5,
      sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
      seed: 24,
      targetGap: 32,
      expectedOutgoingFrames: 120,
      selectionRationale: "Three-second member of the low-air duration family; diagnostic only, never separately weighted.",
    },
  },
  {
    id: "frontier5",
    kind: "low_air",
    capture: {
      id: "two_contact_frontier5",
      cohort: "calibration",
      category: "low_air",
      spec: frontier5,
      sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
      seed: 24,
      targetGap: 54,
      expectedOutgoingFrames: 200,
      selectionRationale: "Five-second low-air parent; a duration diagnostic, not a five-second policy target.",
    },
  },
  {
    id: "frontier7",
    kind: "low_air",
    capture: {
      id: "two_contact_frontier7",
      cohort: "calibration",
      category: "low_air",
      spec: frontier7,
      sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts",
      seed: 24,
      targetGap: 54,
      expectedOutgoingFrames: 280,
      selectionRationale: "Seven-second low-air variant; retained as a correlated duration diagnostic only.",
    },
  },
  {
    id: "impact_led",
    kind: "impact_led",
    capture: {
      id: "two_contact_impact_led",
      cohort: "calibration",
      category: "ordinary",
      spec: believer,
      sourcePath: "benchmark/v2/cases/normative/development_music/believer_56_6s.ts",
      seed: 24,
      targetGap: 72,
      selectionRationale: "Predeclared high-impact music boundary; no local impact score is used for selection.",
    },
  },
];

const STUDY_SOURCE_FILES = [
  "scripts/v0/study_two_contact_envelope.ts",
  "scripts/v0/trajectory/two_contact_phase.ts",
  "scripts/v0/trajectory/capture_input.ts",
  "scripts/v0/trajectory/prefix_capture_core.ts",
  "scripts/v0/trajectory/study_fixture.ts",
  "scripts/v0/trajectory/state.ts",
  "scripts/v0/trajectory/postimpact_study_inputs.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/optimizer/node.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/objective.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/types.ts",
  "scripts/v0/benchmark_v2/compiler_identity.ts",
  "scripts/v0/benchmark_v2/suite_model.ts",
  "benchmark/v2/policy.ts",
  ...scenarios.map((scenario) => scenario.capture.sourcePath),
] as const;

const outputPath = requiredPath("out");
const requestedCase = argument("case") ?? "all";
const budget = positiveInteger("budget", 500_000);
const oracleControls = positiveInteger("oracle-controls", 1_024);
const nextPool = positiveInteger("next-pool", 32);
assertNoUnknownOptions();
assertExactEnvironment();
assertExternalEvidencePath(outputPath);
assertStudySourcesCommitted(STUDY_SOURCE_FILES);
assertCompilerSourcesCommitted();
if (existsSync(outputPath)) throw new Error(`evidence path already exists and is immutable: ${outputPath}`);

const selected = requestedCase === "all"
  ? scenarios
  : scenarios.filter((scenario) => scenario.id === requestedCase);
if (selected.length !== 1 && requestedCase !== "all") {
  throw new Error(`unknown --case=${requestedCase}; expected all or ${scenarios.map((scenario) => scenario.id).join("|")}`);
}

const compiler = compilerCandidateIdentity("wasm");
const studySourceFingerprint = fingerprintFiles(STUDY_SOURCE_FILES);
const started = performance.now();
const results = selected.map((scenario) => runScenario(scenario));
const document = {
  schema: "line.study-two-contact-envelope.v1",
  purpose: [
    "Falsify whether a fixed compact state-derived capture/release stencil reaches two-contact feasibility across a mixed physical panel.",
    "Compare it with a broad diagnostic oracle without selecting oracle controls or turning any local proxy into a compiler objective.",
    "Retain unavailable prefixes and every exact rejection; no headline, score, suffix, or promotion result is produced.",
  ],
  protocol: {
    engine: "wasm",
    relevantEnvironment: { LR_ENGINE: "wasm" },
    captureBudget: budget,
    nextPool,
    compactControls: 9,
    oracleControls,
    currentConstructionInputs: ["current impact", "observed pre-contact state", "outgoing interval length", "outgoing air/speed/amplitude when authored"],
    excludedConstructionInputs: ["next impact", "later contacts", "case id", "seed", "candidate score", "oracle outcomes"],
    endpoint: "current exact admission plus detector runway and at least one exact ordinary next-contact candidate",
  },
  identity: {
    head: compiler.head,
    candidateFingerprint: compiler.candidateFingerprint,
    compilerSourceFingerprint: compiler.compilerSourceFingerprint,
    engineArtifactFingerprint: compiler.engineArtifactFingerprint,
    studySourceFingerprint,
    transform: benchmarkPolicy.transform,
    transformFingerprint: sha256(stableJson(benchmarkPolicy.transform)),
  },
  elapsedMs: round(performance.now() - started),
  results,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, { flag: "wx" });
process.stdout.write(formatSummary(document) + "\n");

function runScenario(scenario: Scenario) {
  const setup = buildTrajectoryCaptureSetup(scenario.capture, benchmarkPolicy.transform);
  try {
    const prepared = prepareTrajectoryPrefix(scenario.capture, setup, budget);
    const baseEngine = rebuildPhysicalPrefixEngine(prepared.physicalPrefix);
    const initialState = requireState(baseEngine, prepared.current.endFrame, `${scenario.id} current target`);
    const outgoing = outgoingIntent(prepared.outgoing);
    const compactControls = makeCompactTwoContactControls({
      currentImpact: prepared.current.targets.impact,
      observedSpeed: initialState.speed,
      outgoing,
    });
    const oracle = makeOracleTwoContactControls(oracleControls, outgoing);
    const context: SpecContext = {
      allContactFrames: setup.allContactFrames,
      durationFrames: setup.durationFrames,
      gapAxisTargets: setup.gapAxisTargets,
    };
    const root = exactPrefixSearchNode(baseEngine, prepared.current, prepared.physicalPrefix);
    const compact = evaluateFamily("compact", compactControls, root, prepared.current, prepared.outgoing, context, setup.gaps, scenario.capture.seed, prepared.preTargetSledTrace);
    const broad = evaluateFamily("oracle", oracle, root, prepared.current, prepared.outgoing, context, setup.gaps, scenario.capture.seed, prepared.preTargetSledTrace);
    return {
      id: scenario.id,
      kind: scenario.kind,
      status: "available" as const,
      capture: summarizeCapture(scenario.capture, prepared, setup),
      currentState: summarizeState(initialState),
      outgoingIntent: outgoing,
      compact,
      oracle: broad,
      interpretation: {
        compactMatchesOracleBridge: compact.summary.bridging > 0 && broad.summary.bridging > 0,
        oracleOnlyReachability: compact.summary.bridging === 0 && broad.summary.bridging > 0,
        noObservedOracleBridge: broad.summary.bridging === 0,
      },
    };
  } catch (error) {
    if (error instanceof TrajectoryPrefixUnavailableError) {
      return {
        id: scenario.id,
        kind: scenario.kind,
        status: "unavailable" as const,
        code: error.code,
        message: error.message,
      };
    }
    throw error;
  }
}

function evaluateFamily(
  family: "compact" | "oracle",
  controls: readonly TwoContactPhaseControl[],
  root: SearchNode,
  current: Gap,
  outgoing: Gap,
  context: SpecContext,
  gaps: readonly Gap[],
  seed: number,
  preTargetSledTrace: readonly number[],
) {
  const rows = controls.map((control, index) => evaluateControl({
    family,
    index,
    control,
    root,
    current,
    outgoing,
    context,
    gaps,
    seed,
    preTargetSledTrace,
  }));
  return {
    controls: rows,
    summary: summarizeRows(rows),
  };
}

function evaluateControl(input: {
  family: "compact" | "oracle";
  index: number;
  control: TwoContactPhaseControl;
  root: SearchNode;
  current: Gap;
  outgoing: Gap;
  context: SpecContext;
  gaps: readonly Gap[];
  seed: number;
  preTargetSledTrace: readonly number[];
}) {
  const state = requireState(
    input.root.prefixEngine,
    input.current.endFrame - input.control.phaseLookbackFrames,
    `${input.family}[${input.index}] placement state`,
  );
  const realized = realizeTwoContactPhase(state, input.control, input.root.prefixNextLineId);
  const before = snapshotArcPlacementStats().by_sample_mode.normal;
  const fit = tryCandidateLines(
    input.root.prefixEngine,
    input.current,
    realized.lines,
    input.root.prefixNextLineId,
    input.context.allContactFrames,
    axisLookaheadEndFrame(input.current, input.context.allContactFrames),
    input.current.targets,
    true,
    "normal",
    () => [...input.preTargetSledTrace],
  ) as Candidate | null;
  const after = snapshotArcPlacementStats().by_sample_mode.normal;
  if (fit === null) {
    return {
      index: input.index,
      control: roundControl(input.control),
      realized: summarizeRealized(realized),
      currentFit: false,
      failure: failureStage(before, after),
      next: null,
    };
  }

  const child = advanceToGap(extendNodeCached(input.root, fit), input.outgoing.index);
  const transition = transitionSummary(child.prefixEngine, input.current, input.outgoing);
  const nextCandidates = getCandidatesSorted(child, [...input.gaps], input.context, input.seed, nextPool);
  const nextState = requireState(child.prefixEngine, input.outgoing.endFrame - 1, `${input.family}[${input.index}] next state`);
  return {
    index: input.index,
    control: roundControl(input.control),
    realized: summarizeRealized(realized),
    currentFit: true,
    failure: null,
    current: {
      cost: round(fit.cost),
      achieved: roundAxes(fit.achieved),
      achievedAtEnd: fit.achievedAtEnd === undefined ? null : roundAxes(fit.achievedAtEnd),
      lineHash: lineHash(fit.lines),
    },
    next: {
      detectorRunwayFrames: transition.airborneRunAtNext,
      detectorRunwaySatisfied: transition.detectorRunwaySatisfied,
      lastGroundedFrame: transition.lastGroundedFrame,
      exactPoolCandidates: nextCandidates.length,
      bestCandidateCost: nextCandidates[0] === undefined ? null : round(nextCandidates[0].cost),
      stateBeforeArrival: summarizeState(nextState),
    },
  };
}

function exactPrefixSearchNode(
  engine: unknown,
  current: Gap,
  fixture: { prefixNextLineId: number; cumulativeCost: number },
): SearchNode {
  // `getCandidatesSorted` requires a SearchNode for cache ownership, but its
  // next-gap construction reads the exact engine, index, and line-ID state.
  // Historical fit measurements are intentionally unavailable in a physical
  // fixture, so null placeholders preserve the node invariant without
  // manufacturing prior achieved-axis values.
  return {
    gapIndex: current.index,
    prefixFits: Array.from({ length: current.index }, () => null),
    prefixEngine: engine,
    prefixNextLineId: fixture.prefixNextLineId,
    cumulativeCost: fixture.cumulativeCost,
    _candidatesCache: null,
    _childrenCache: undefined,
  };
}

function advanceToGap(node: SearchNode, targetGap: number): SearchNode {
  let current = node;
  while (current.gapIndex < targetGap) current = extendNodeCached(current, null);
  if (current.gapIndex !== targetGap) {
    throw new Error(`cannot advance study node from g${node.gapIndex} to g${targetGap}`);
  }
  return current;
}

function transitionSummary(engine: unknown, current: Gap, outgoing: Gap) {
  const detection = detectWindow(engine, current.endFrame, outgoing.endFrame);
  let lastGroundedFrame: number | null = null;
  for (let frame = current.endFrame; frame < outgoing.endFrame; frame++) {
    if (airborneAt(detection, frame) === false) lastGroundedFrame = frame;
  }
  let airborneRunAtNext = 0;
  for (let frame = outgoing.endFrame - 1; frame >= current.endFrame; frame--) {
    if (airborneAt(detection, frame) !== true) break;
    airborneRunAtNext++;
  }
  return {
    lastGroundedFrame,
    airborneRunAtNext,
    detectorRunwaySatisfied: airborneRunAtNext >= MIN_LANDING_AIRBORNE_FRAMES,
  };
}

function summarizeRows(rows: readonly ReturnType<typeof evaluateControl>[]) {
  const currentAccepted = rows.filter((row) => row.currentFit).length;
  const runwayReady = rows.filter((row) => row.next?.detectorRunwaySatisfied === true).length;
  const nextPoolAvailable = rows.filter((row) => (row.next?.exactPoolCandidates ?? 0) > 0).length;
  const bridging = rows.filter((row) =>
    row.next?.detectorRunwaySatisfied === true && (row.next?.exactPoolCandidates ?? 0) > 0,
  ).length;
  return { attempted: rows.length, currentAccepted, runwayReady, nextPoolAvailable, bridging };
}

function summarizeCapture(
  capture: TrajectoryCaptureCase,
  prepared: ReturnType<typeof prepareTrajectoryPrefix>,
  setup: ReturnType<typeof buildTrajectoryCaptureSetup>,
) {
  const materialized = materializeTrajectoryCaptureInput(setup);
  return {
    sourcePath: capture.sourcePath,
    sourceFingerprint: fingerprintFiles([capture.sourcePath]),
    seed: capture.seed,
    targetGap: prepared.current.index,
    targetFrame: prepared.current.endFrame,
    outgoingGap: prepared.outgoing.index,
    outgoingFrame: prepared.outgoing.endFrame,
    outgoingFrames: prepared.outgoingIntervalFrames,
    physicalPrefixFingerprint: prepared.physicalPrefixFingerprint,
    materializedFingerprint: sha256(stableJson(materialized)),
    projection: prepared.projection,
    currentAxes: { ...prepared.current.targets },
    outgoingAxes: outgoingIntent(prepared.outgoing),
  };
}

function outgoingIntent(gap: Gap): TwoContactOutgoingIntent {
  return {
    intervalFrames: gap.endFrame - gap.startFrame,
    ...(gap.targets.air === undefined ? {} : { air: gap.targets.air }),
    ...(gap.targets.speed === undefined ? {} : { speed: gap.targets.speed }),
    ...(gap.targets.amplitude === undefined ? {} : { amplitude: gap.targets.amplitude }),
  };
}

function requireState(engine: unknown, frame: number, label: string): PlanningState {
  const state = extractPlanningState(engine, frame);
  if (state === null) throw new Error(`${label}: unable to read planning state at frame ${frame}`);
  return state;
}

function failureStage(
  before: ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"],
  after: ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"],
): "preclear" | "survival" | "landing" | "offbeat" | "unknown" {
  if (after.preclear_rejected > before.preclear_rejected) return "preclear";
  if (after.direct_survival_failed > before.direct_survival_failed) return "survival";
  if (after.direct_landing_failed > before.direct_landing_failed) return "landing";
  if (after.direct_offbeat_failed > before.direct_offbeat_failed) return "offbeat";
  return "unknown";
}

function summarizeRealized(realized: ReturnType<typeof realizeTwoContactPhase>) {
  return {
    lineHash: lineHash(realized.lines),
    lineCount: realized.lines.length,
    lineLength: round(lineLength(realized.lines)),
    segmentCount: realized.segmentCount,
    entryAngleDeg: round(realized.entryAngleDeg),
    exitAngleDeg: round(realized.exitAngleDeg),
  };
}

function summarizeState(state: PlanningState) {
  return {
    frame: state.frame,
    reference: roundPoint(state.reference),
    velocity: roundPoint(state.velocity),
    speed: round(state.speed),
    velocityAngleDeg: round(state.velocityAngleDeg),
    referencePointName: state.referencePointName,
    phase: { ...state.phase },
  };
}

function roundControl(control: TwoContactPhaseControl) {
  return {
    phaseLookbackFrames: control.phaseLookbackFrames,
    approachDeltaDeg: round(control.approachDeltaDeg),
    turnDeg: round(control.turnDeg),
    normalOffsetPx: round(control.normalOffsetPx),
    tangentFrames: round(control.tangentFrames),
    preFrames: round(control.preFrames),
    postFrames: round(control.postFrames),
    flipped: control.flipped,
  };
}

function roundAxes(axes: AxisValues): AxisValues {
  return Object.fromEntries(Object.entries(axes).map(([name, value]) => [name, round(value)]));
}

function lineHash(lines: readonly TrackLine[]): string {
  return sha256(stableJson(lines.map((line) => ({
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

function requiredPath(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") throw new Error(`--${name}=FILE is required`);
  return resolve(value);
}

function positiveInteger(name: string, fallback: number): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

function assertNoUnknownOptions(): void {
  const supported = ["--out=", "--case=", "--budget=", "--oracle-controls=", "--next-pool="];
  const unknown = argv.filter((value) => !supported.some((prefix) => value.startsWith(prefix)));
  if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);
}

function assertExactEnvironment(): void {
  const relevant = Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)));
  if (stableJson(relevant) !== stableJson({ LR_ENGINE: "wasm" })) {
    throw new Error(`study requires exactly LR_ENGINE=wasm; received ${stableJson(relevant)}`);
  }
}

function assertStudySourcesCommitted(paths: readonly string[]): void {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ...paths], { stdio: "ignore" });
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...paths], { stdio: "ignore" });
  } catch {
    throw new Error("two-contact study sources and panel definitions must be tracked, committed, and clean");
  }
}

function assertExternalEvidencePath(path: string): void {
  const workspace = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const canonical = canonicalProspectivePath(path);
  if (canonical === workspace || relative(workspace, canonical) === "" || !relative(workspace, canonical).startsWith("..")) {
    throw new Error(`study evidence must be outside the repository: ${path}`);
  }
}

function canonicalProspectivePath(path: string): string {
  let existing = resolve(path);
  const suffix: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) throw new Error(`cannot resolve evidence parent for ${path}`);
    suffix.unshift(basename(existing));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...suffix);
}

function formatSummary(document: { results: readonly ReturnType<typeof runScenario>[]; elapsedMs: number }) {
  const lines = [
    `two-contact envelope: ${document.results.length} scenario(s), ${round(document.elapsedMs)}ms`,
  ];
  for (const result of document.results) {
    if (result.status === "unavailable") {
      lines.push(`${result.id}: unavailable (${result.code})`);
      continue;
    }
    const compact = result.compact.summary;
    const oracle = result.oracle.summary;
    lines.push(
      `${result.id}: compact ${compact.currentAccepted}/${compact.attempted} current, ` +
      `${compact.bridging} bridge; oracle ${oracle.currentAccepted}/${oracle.attempted} current, ${oracle.bridging} bridge`,
    );
  }
  return lines.join("\n");
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundPoint(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}
