/**
 * Observation-only normal-pool comparison.  It asks whether anchoring a catch
 * at the velocity-leading sled point exposes a broad physical candidate basis.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import lowAir from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import denseDialogueImpact from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import offgrid from "../../benchmark/v2/cases/normative/representative/offgrid_conversation.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { getRiderMetered, SLED_POINT_ORDER, sledPoseDegFromRider } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { sampleArcPlacementGeometry, type ImpactFrameTargetState } from "./arc_placement.ts";
import { axisLookaheadEndFrame, tryCandidateGeometry } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import { compileHandoff, setHandoffFrontierNodeProbeHook, type HandoffNode } from "./optimizer/handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import { getCandidateProbe, sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const BUDGET = 500_000;
type FrameMode = "velocity-leading" | "sled-pose";
const CASES = [
  { id: "frontier_dense_recovery", regime: "dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense", spec: denseDialogueImpact },
  { id: "countercurrent", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", regime: "development_music", spec: believer },
  { id: "frontier_low_air_endurance_4s", regime: "low_air", spec: lowAir },
  { id: "offgrid_conversation", regime: "pickup", spec: offgrid },
] as const satisfies readonly { id: string; regime: string; spec: Spec }[];

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_velocity_leading_anchor_normal_pool.ts [--mode=velocity-leading|sled-pose] --case=ID [--seed=discovery|heldout] [--out=PATH] | --batch=0|1 [--seed=discovery|heldout] | --aggregate [--seed=discovery|heldout]\n");
  process.exit(0);
}
const argument = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseId = argument("case");
const batchArg = argument("batch");
const aggregate = argv.includes("--aggregate");
const mode = (argument("mode") ?? "velocity-leading") as FrameMode;
const unknown = argv.filter((value) => value !== "--aggregate" && !value.startsWith("--case=") && !value.startsWith("--seed=") && !value.startsWith("--batch=") && !value.startsWith("--out=") && !value.startsWith("--mode="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
if (mode !== "velocity-leading" && mode !== "sled-pose") throw new Error(`unknown --mode=${mode}`);
const discoverySeed = discoverySeedFor(mode);
const heldOutSeed = heldOutSeedFor(mode);
const seed = Number(argument("seed") ?? discoverySeed);
if (seed !== discoverySeed && seed !== heldOutSeed) throw new Error(`--seed must be ${discoverySeed} or ${heldOutSeed}`);
if (caseId !== undefined && !CASES.some((definition) => definition.id === caseId)) throw new Error(`unknown --case=${caseId}`);
const outPath = argument("out") ?? `generated/studies/${mode === "velocity-leading" ? "velocity-leading-anchor-normal-pool" : "sled-pose-normal-frame"}/v1/seed-${seed}/result.json`;
if (aggregate) {
  if (caseId !== undefined || batchArg !== undefined) throw new Error("--aggregate accepts neither --case nor --batch");
  aggregateStates(seed, mode, outPath);
  process.exit(0);
}
if (batchArg !== undefined) {
  if (caseId !== undefined) throw new Error("--batch cannot combine with --case");
  const batch = Number(batchArg);
  if (!Number.isSafeInteger(batch) || batch < 0 || batch > 1) throw new Error("--batch must be 0 or 1");
  runBatch(seed, mode, batch, outPath);
  process.exit(0);
}
if (caseId === undefined) throw new Error("require --case, --batch, or --aggregate");

type Regime = typeof CASES[number]["regime"];
type Setup = { gaps: Gap[]; ctx: SpecContext };
type RawPool = { seed: number; count: number; candidates: Array<{ attempt: number; hash: string }> };
type CandidateDigest = { attempt: number; hash: string; cost: number; axisRms: number; qualityObjective: number | null };
type Arm = { attempts: number; viable: number; bestCost: number | null; bestAxisRms: number | null; bestQualityObjective: number | null; candidates: CandidateDigest[] };
type State = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpointGapIndex: number;
  captureAvailable: boolean;
  replayEquivalent: boolean | null;
  replayMessage: string | null;
  ordinaryAnchor: string | null;
  velocityLeadingAnchor: string | null;
  anchorsDiffer: boolean | null;
  frameDeltaDeg: number | null;
  ordinary: Arm | null;
  velocityLeading: Arm | null;
  deltas: { viable: number | null; bestAxisRms: number | null; bestQualityObjective: number | null; bestCost: number | null } | null;
};

const definition = CASES.find((entry) => entry.id === caseId)!;
const started = performance.now();
const state = runCase(definition, seed, mode);
const output = {
  schema: schemaFor(mode),
  purpose: [
    mode === "velocity-leading"
      ? "Compare the ordinary lowest-world-y sled anchor with the velocity-leading sled point at the exact same target state."
      : "Compare the ordinary COM-velocity tangent frame with the closest-direction physical sled-axis tangent at the exact same target state.",
    "The comparator preserves ordinary coordinates, COM tangent, attempts, exact gates, and pool scoring; it is not a source lane or selector.",
  ],
  frozenConfig: config(seed, mode),
  elapsedMs: round(performance.now() - started),
  rows: [state],
  summary: summarize([state]),
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ schema: output.schema, output: outPath, summary: output.summary }, null, 2)}\n`);

function runCase(definition: typeof CASES[number], seed: number, mode: FrameMode): State {
  const setup = buildSetup(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed);
  const checkpointGapIndex = oneThirdContactGap(setup.gaps);
  let captured: HandoffNode | null = null;
  const pools = new WeakMap<object, RawPool>();
  setHandoffFrontierNodeProbeHook(({ selected }) => {
    if (captured === null && selected.skippedContacts === 0 && selected.search.gapIndex === checkpointGapIndex) captured = selected;
  });
  setNormalPoolSnapshotHook((record) => snapshotRawPool(pools, record));
  try {
    compileHandoff(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed, { budget: BUDGET });
  } finally {
    setHandoffFrontierNodeProbeHook(null);
    setNormalPoolSnapshotHook(null);
  }
  if (captured === null) return unavailable(definition, seed, checkpointGapIndex, "ordinary frontier state unavailable");
  const raw = pools.get(captured.search);
  const gap = setup.gaps[checkpointGapIndex];
  if (raw === undefined || raw.count <= 0 || gap === undefined || !gap.endsWithContact) {
    return unavailable(definition, seed, checkpointGapIndex, raw === undefined ? "generation-time ordinary pool snapshot unavailable" : "checkpoint is not a contact gap");
  }
  const rngSeed = (Math.imul(raw.seed | 0, 1_000_003) + gap.index + 1) | 0;
  const ordinary = sampleOrdinary(captured, gap, setup, raw.count, rngSeed);
  const replay = compareReplay(raw.candidates, ordinary.candidates);
  const frame = readFrame(captured.search.prefixEngine, gap, setup.ctx, mode);
  const velocityLeading = sampleVelocityLeading(captured, gap, setup, raw.count, rngSeed, frame.targetState);
  const deltas = {
    viable: velocityLeading.viable - ordinary.viable,
    bestAxisRms: pairedImprovement(ordinary.bestAxisRms, velocityLeading.bestAxisRms, false),
    bestQualityObjective: pairedImprovement(ordinary.bestQualityObjective, velocityLeading.bestQualityObjective, true),
    bestCost: pairedImprovement(ordinary.bestCost, velocityLeading.bestCost, false),
  };
  process.stderr.write(`${definition.id}/s${seed}/${mode}: g${gap.index}, raw=${raw.count}, ordinary=${ordinary.viable}, comparator=${velocityLeading.viable}, ${frame.ordinaryAnchor}->${frame.velocityLeadingAnchor}\n`);
  return {
    caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex,
    captureAvailable: true, replayEquivalent: replay.ok, replayMessage: replay.message,
    ordinaryAnchor: frame.ordinaryAnchor, velocityLeadingAnchor: frame.velocityLeadingAnchor,
    anchorsDiffer: frame.frameDifferent,
    frameDeltaDeg: frame.frameDeltaDeg,
    ordinary, velocityLeading, deltas,
  };
}

function unavailable(definition: typeof CASES[number], seed: number, checkpointGapIndex: number, message: string): State {
  return {
    caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex,
    captureAvailable: false, replayEquivalent: null, replayMessage: message,
    ordinaryAnchor: null, velocityLeadingAnchor: null, anchorsDiffer: null,
    frameDeltaDeg: null,
    ordinary: null, velocityLeading: null, deltas: null,
  };
}

function snapshotRawPool(pools: WeakMap<object, RawPool>, record: { node: object; seed: number; nCand: number; sampleOrder: readonly Candidate[] }): void {
  const prior = pools.get(record.node);
  if (prior === undefined || prior.seed !== record.seed || record.nCand < prior.count) {
    pools.set(record.node, {
      seed: record.seed,
      count: record.nCand,
      candidates: record.sampleOrder.map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, hash: geometryHash(candidate) })),
    });
    return;
  }
  if (record.nCand > prior.count) {
    prior.candidates.push(...record.sampleOrder
      .filter((candidate) => (candidate.sampleAttempt ?? -1) >= prior.count)
      .map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, hash: geometryHash(candidate) })));
    prior.count = record.nCand;
  }
}

function sampleOrdinary(node: HandoffNode, gap: Gap, setup: Setup, count: number, seed: number): Arm {
  const rng = makeRng(seed);
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const candidate = sampleOneCandidate(node.search.prefixEngine, gap, rng, setup.ctx, node.search.prefixNextLineId, attempt);
    if (candidate !== null) candidates.push(candidate);
  }
  return summarizeArm(count, candidates, node, gap, setup);
}

function sampleVelocityLeading(node: HandoffNode, gap: Gap, setup: Setup, count: number, seed: number, targetState: ImpactFrameTargetState): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, setup.ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const geometry = sampleArcPlacementGeometry(rng, probe.refX, probe.refY, gap.targets, targetState, attempt, gap, node.search.prefixNextLineId, "normal", setup.ctx.allContactFrames);
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      setup.ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal", probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: targetState.sledX, y: targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(fit);
    }
  }
  return summarizeArm(count, candidates, node, gap, setup);
}

function summarizeArm(attempts: number, candidates: Candidate[], node: HandoffNode, gap: Gap, setup: Setup): Arm {
  const digests = candidates.map((candidate) => ({
    attempt: candidate.sampleAttempt ?? -1,
    hash: geometryHash(candidate),
    cost: round(candidate.cost),
    axisRms: round(axisRms(candidate, setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets)),
    qualityObjective: nullable(candidateQualityObjective(node.search.prefixEngine, candidate, gap, setup.gaps, setup.ctx)),
  }));
  return {
    attempts,
    viable: digests.length,
    bestCost: min(digests.map((candidate) => candidate.cost)),
    bestAxisRms: min(digests.filter((candidate) => Number.isFinite(candidate.axisRms)).map((candidate) => candidate.axisRms)),
    bestQualityObjective: max(digests.flatMap((candidate) => candidate.qualityObjective === null ? [] : [candidate.qualityObjective])),
    candidates: digests,
  };
}

function readFrame(engine: unknown, gap: Gap, ctx: SpecContext, mode: FrameMode): { targetState: ImpactFrameTargetState; ordinaryAnchor: string; velocityLeadingAnchor: string; frameDifferent: boolean; frameDeltaDeg: number | null } {
  const probe = getCandidateProbe(engine, gap, ctx);
  const rider = getRiderMetered(engine, gap.endFrame);
  if (mode === "sled-pose") {
    const pose = sledPoseDegFromRider(rider);
    if (pose === null || !Number.isFinite(pose)) {
      return { targetState: probe.targetState, ordinaryAnchor: "com_velocity", velocityLeadingAnchor: "sled_axis_unavailable", frameDifferent: false, frameDeltaDeg: null };
    }
    const alignedPose = nearestAxisAngle(pose, probe.targetState.angleDeg);
    const delta = wrapDeg(alignedPose - probe.targetState.angleDeg);
    return {
      targetState: { ...probe.targetState, angleDeg: alignedPose },
      ordinaryAnchor: "com_velocity",
      velocityLeadingAnchor: "sled_axis",
      frameDifferent: Math.abs(delta) > 0.5,
      frameDeltaDeg: round(delta),
    };
  }
  const velocity = probe.targetState.velocity;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= 1e-9) return { targetState: probe.targetState, ordinaryAnchor: "rider", velocityLeadingAnchor: "rider", frameDifferent: false, frameDeltaDeg: null };
  const direction = { x: velocity.x / speed, y: velocity.y / speed };
  let lowest: { name: string; x: number; y: number } | null = null;
  let leading: { name: string; x: number; y: number; projection: number } | null = null;
  for (const name of SLED_POINT_ORDER) {
    const position = rider?.get?.(name)?.pos;
    if (!finiteVec(position)) continue;
    if (lowest === null || position.y > lowest.y) lowest = { name, x: position.x, y: position.y };
    const projection = position.x * direction.x + position.y * direction.y;
    if (leading === null || projection > leading.projection) leading = { name, x: position.x, y: position.y, projection };
  }
  if (leading === null) return { targetState: probe.targetState, ordinaryAnchor: lowest?.name ?? "rider", velocityLeadingAnchor: lowest?.name ?? "rider", frameDifferent: false, frameDeltaDeg: null };
  return {
    targetState: { ...probe.targetState, sledX: leading.x, sledY: leading.y },
    ordinaryAnchor: lowest?.name ?? "rider",
    velocityLeadingAnchor: leading.name,
    frameDifferent: (lowest?.name ?? "rider") !== leading.name,
    frameDeltaDeg: null,
  };
}

function compareReplay(expected: readonly { attempt: number; hash: string }[], actual: readonly CandidateDigest[]): { ok: boolean; message: string } {
  const left = [...expected].sort((a, b) => a.attempt - b.attempt);
  const right = [...actual].map(({ attempt, hash }) => ({ attempt, hash })).sort((a, b) => a.attempt - b.attempt);
  if (left.length !== right.length) return { ok: false, message: `viable count ${right.length} does not match generation-time ${left.length}` };
  for (let index = 0; index < left.length; index++) {
    if (left[index].attempt !== right[index].attempt || left[index].hash !== right[index].hash) {
      return { ok: false, message: `mismatch at viable index ${index}` };
    }
  }
  return { ok: true, message: "ordinary attempts and geometry hashes match generation-time pool" };
}

function axisRms(candidate: Candidate, targets: AxisValues): number {
  const achieved = candidate.achieved;
  const squares = (Object.keys(targets) as Array<keyof AxisValues>).flatMap((axis) => {
    const target = targets[axis];
    const value = achieved[axis];
    return finite(target) && finite(value) ? [(value - target) ** 2] : [];
  });
  return squares.length === 0 ? Infinity : Math.sqrt(squares.reduce((sum, value) => sum + value, 0) / squares.length);
}

function oneThirdContactGap(gaps: readonly Gap[]): number {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  const value = contacts[Math.floor((contacts.length - 1) / 3)];
  if (value === undefined) throw new Error("source has fewer than one contact");
  return value;
}

function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5) };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impacts = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impacts.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) { gap.targets.impact = impact; gapAxisTargets[gap.index].impact = impact; }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (gaps[index].endsWithContact && gaps[index + 1].endsWithContact && gaps[index + 1].targets.impact !== undefined) gaps[index].nextImpact = gaps[index + 1].targets.impact;
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function runBatch(seed: number, mode: FrameMode, batch: number, aggregateOut: string): void {
  const cases = CASES.slice(batch * 3, batch * 3 + 3);
  const stateDir = `${dirname(aggregateOut)}/states`;
  mkdirSync(stateDir, { recursive: true });
  for (const definition of cases) {
    const stateOut = `${stateDir}/${definition.id}-s${seed}.json`;
    execFileSync(process.execPath, ["--expose-gc", "--import", "tsx", process.argv[1], `--mode=${mode}`, `--case=${definition.id}`, `--seed=${seed}`, `--out=${stateOut}`], { encoding: "utf8", env: { ...process.env, LR_ENGINE: "wasm" }, stdio: ["ignore", "pipe", "inherit"] });
  }
  process.stdout.write(`${JSON.stringify({ schema: schemaFor(mode), mode, seed, batch, states: cases.map((entry) => entry.id) }, null, 2)}\n`);
}

function aggregateStates(seed: number, mode: FrameMode, aggregateOut: string): void {
  const stateDir = `${dirname(aggregateOut)}/states`;
  const states = CASES.map((definition) => {
    const path = `${stateDir}/${definition.id}-s${seed}.json`;
    const document = JSON.parse(readFileSync(path, "utf8")) as { rows: State[] };
    if (document.rows.length !== 1 || document.rows[0].caseId !== definition.id || document.rows[0].seed !== seed) throw new Error(`state artifact ${path} does not match frozen scope`);
    return document.rows[0];
  });
  const output = { schema: schemaFor(mode), purpose: [mode === "velocity-leading" ? "Aggregate of sealed memory-isolated velocity-leading anchor states." : "Aggregate of sealed memory-isolated sled-pose normal-frame states."], frozenConfig: config(seed, mode), rows: states, summary: summarize(states) };
  mkdirSync(dirname(aggregateOut), { recursive: true });
  writeFileSync(aggregateOut, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ schema: output.schema, output: aggregateOut, summary: output.summary }, null, 2)}\n`);
}

function config(seed: number, mode: FrameMode) {
  return {
    budget: BUDGET, seed, role: seed === discoverySeedFor(mode) ? "discovery" : "held-out validation", joltMs: benchmarkPolicy.transform.joltMs,
    cases: CASES.map(({ id, regime }) => ({ id, regime })), checkpoint: "first ordinary frontier state at one-third authored-contact index",
    control: mode === "velocity-leading" ? "ordinary lowest-world-y sled-point anchor" : "ordinary COM-velocity tangent frame",
    comparator: mode === "velocity-leading"
      ? "max dot(sledPointPosition, normalized incoming COM velocity), with ordinary COM tangent and all raw normal coordinates unchanged"
      : "closest-direction TAIL-to-NOSE sled-axis tangent modulo 180 degrees, with ordinary lowest-point anchor, COM velocity, and all raw normal coordinates unchanged",
    evaluator: "unchanged exact candidate gates and current quality-times-readiness pool metric",
    discard: { requireExactOrdinaryReplay: true, requireMaterialAnchorDifference: true, requireJointPositiveRegimeBalancedViableObjectiveAndAxisRms: true, noMaterialDensePickupLowAirPoolLoss: true },
  };
}

function summarize(states: readonly State[]) {
  const usable = states.filter((state) => state.replayEquivalent === true && state.deltas !== null && state.ordinary !== null && state.velocityLeading !== null);
  const byRegime = Object.fromEntries([...new Set(CASES.map((entry) => entry.regime))].map((regime) => {
    const rows = usable.filter((state) => state.regime === regime);
    return [regime, {
      states: rows.length,
      viableDelta: mean(rows.map((state) => state.deltas!.viable)),
      bestAxisRmsImprovement: mean(rows.map((state) => state.deltas!.bestAxisRms).filter(finite)),
      bestQualityObjectiveImprovement: mean(rows.map((state) => state.deltas!.bestQualityObjective).filter(finite)),
      bestCostImprovement: mean(rows.map((state) => state.deltas!.bestCost).filter(finite)),
    }];
  }));
  const regimeRows = Object.values(byRegime) as Array<{ viableDelta: number | null; bestAxisRmsImprovement: number | null; bestQualityObjectiveImprovement: number | null; bestCostImprovement: number | null }>;
  return {
    declaredStates: states.length,
    captureAvailable: states.filter((state) => state.captureAvailable).length,
    exactOrdinaryReplay: states.filter((state) => state.replayEquivalent === true).length,
    comparatorFrameDifferent: states.filter((state) => state.anchorsDiffer === true).length,
    meanComparatorFrameDeltaDeg: mean(states.flatMap((state) => state.frameDeltaDeg === null ? [] : [Math.abs(state.frameDeltaDeg)])),
    usableStates: usable.length,
    regimeBalanced: {
      viableDelta: mean(regimeRows.map((row) => row.viableDelta).filter(finite)),
      bestAxisRmsImprovement: mean(regimeRows.map((row) => row.bestAxisRmsImprovement).filter(finite)),
      bestQualityObjectiveImprovement: mean(regimeRows.map((row) => row.bestQualityObjectiveImprovement).filter(finite)),
      bestCostImprovement: mean(regimeRows.map((row) => row.bestCostImprovement).filter(finite)),
    },
    byRegime,
  };
}

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [round(line.x1), round(line.y1), round(line.x2), round(line.y2), line.flipped]))).digest("hex");
}
function pairedImprovement(control: number | null, candidate: number | null, higherIsBetter: boolean): number | null { return control === null || candidate === null ? null : round(higherIsBetter ? candidate - control : control - candidate); }
function finite(value: number | undefined | null): value is number { return value !== undefined && value !== null && Number.isFinite(value); }
function finiteVec(value: unknown): value is { x: number; y: number } { return typeof value === "object" && value !== null && finite((value as { x?: number }).x) && finite((value as { y?: number }).y); }
function nearestAxisAngle(poseDeg: number, directionDeg: number): number {
  const alternatives = [poseDeg, poseDeg + 180, poseDeg - 180];
  return alternatives.reduce((best, value) => Math.abs(wrapDeg(value - directionDeg)) < Math.abs(wrapDeg(best - directionDeg)) ? value : best);
}
function wrapDeg(value: number): number { return ((value + 180) % 360 + 360) % 360 - 180; }
function schemaFor(mode: FrameMode): string { return mode === "velocity-leading" ? "line.study-velocity-leading-anchor-normal-pool.v1" : "line.study-sled-pose-normal-frame.v1"; }
function discoverySeedFor(mode: FrameMode): number { return mode === "velocity-leading" ? 36 : 38; }
function heldOutSeedFor(mode: FrameMode): number { return mode === "velocity-leading" ? 37 : 39; }
function min(values: readonly number[]): number | null { return values.length === 0 ? null : round(Math.min(...values)); }
function max(values: readonly number[]): number | null { return values.length === 0 ? null : round(Math.max(...values)); }
function mean(values: readonly number[]): number | null { return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length); }
function nullable(value: number | null): number | null { return value === null || !Number.isFinite(value) ? null : round(value); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
