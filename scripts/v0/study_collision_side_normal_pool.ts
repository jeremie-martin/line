/**
 * Frozen observation-only comparison of production normal geometry against
 * the same raw proposals with either every one-way collision side inverted or
 * the final post-contact collision endpoint extended.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_collision_side_normal_pool.ts \
 *     --terminal-end-extension --out=generated/studies/terminal-endpoint-normal-pool/v1/result.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { sampleArcPlacementGeometry } from "./arc_placement.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import { compileHandoff, setHandoffFrontierNodeProbeHook, type HandoffNode } from "./optimizer/handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import { getCandidateProbe, sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { axisLookaheadEndFrame, tryCandidateGeometry } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_collision_side_normal_pool.ts [--terminal-end-extension] [--case=ID ...] [--out=PATH]\n");
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = argument("out");
const terminalEndExtension = argv.includes("--terminal-end-extension");
const requestedCaseIds = argv.filter((value) => value.startsWith("--case=")).map((value) => value.slice("--case=".length));
const unknown = argv.filter((value) => value !== "--terminal-end-extension" && !value.startsWith("--out=") && !value.startsWith("--case="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

const BUDGET = 500_000;
const SEEDS = [28, 29] as const;
const CASES = [
  { id: "frontier_dense_recovery", regime: "dense" },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense" },
  { id: "countercurrent", regime: "representative" },
  { id: "offgrid_conversation", regime: "pickup" },
  { id: "frontier_low_air_endurance_4s", regime: "low_air" },
  { id: "believer_56_6s", regime: "development_music" },
] as const;
const ACTIVE_CASES = requestedCaseIds.length === 0
  ? CASES
  : CASES.filter((entry) => requestedCaseIds.includes(entry.id));
if (new Set(requestedCaseIds).size !== requestedCaseIds.length || ACTIVE_CASES.length !== requestedCaseIds.length) {
  throw new Error(`unknown or duplicate --case selection: ${requestedCaseIds.join(", ")}`);
}

type Regime = typeof CASES[number]["regime"];
type Checkpoint = "one_third" | "two_thirds";
type Captured = { checkpoint: Checkpoint; gapIndex: number; node: HandoffNode };
type RawPool = { seed: number; count: number; candidates: Array<{ attempt: number; hash: string }> };
type Digest = { attempt: number; hash: string; cost: number; axisRms: number; objective: number | null };
type Arm = {
  attempts: number;
  viable: number;
  bestCost: number | null;
  bestAxisRms: number | null;
  bestObjective: number | null;
  candidates: Digest[];
};
type Row = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpoint: Checkpoint;
  gapIndex: number;
  candidateCount: number | null;
  captureAvailable: boolean;
  replayEquivalent: boolean | null;
  replayMessage: string | null;
  production: Arm | null;
  alternative: Arm | null;
  deltas: { viable: number | null; bestAxisRms: number | null; bestObjective: number | null; bestCost: number | null } | null;
};

const catalog = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case]));
const definitions = ACTIVE_CASES.map((entry) => {
  const found = catalog.get(entry.id);
  if (found === undefined) throw new Error(`frozen case ${entry.id} is absent from development catalog`);
  return { ...entry, spec: found.spec };
});

const rows: Row[] = [];
for (const definition of definitions) {
  for (const seed of SEEDS) {
    const setup = buildSetup(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed);
    const checkpoints = checkpointGapIndices(setup.gaps);
    const captured = new Map<number, Captured>();
    const rawPools = new WeakMap<object, RawPool>();
    setHandoffFrontierNodeProbeHook(({ selected }) => {
      if (selected.skippedContacts !== 0 || selected.search.gapIndex === setup.gaps.length) return;
      const checkpoint = checkpoints.get(selected.search.gapIndex);
      if (checkpoint !== undefined && !captured.has(selected.search.gapIndex)) {
        captured.set(selected.search.gapIndex, { checkpoint, gapIndex: selected.search.gapIndex, node: selected });
      }
    });
    setNormalPoolSnapshotHook((record) => snapshotRawPool(rawPools, record));
    const started = performance.now();
    try {
      compileHandoff(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed, { budget: BUDGET });
    } finally {
      setHandoffFrontierNodeProbeHook(null);
      setNormalPoolSnapshotHook(null);
    }
    for (const [gapIndex, checkpoint] of checkpoints) {
      const state = captured.get(gapIndex);
      rows.push(state === undefined
        ? unavailable(definition.id, definition.regime, seed, checkpoint, gapIndex, "frontier state unavailable")
        : replay(definition.id, definition.regime, seed, state, rawPools.get(state.node.search) ?? null, setup));
    }
    process.stderr.write(`${definition.id}/s${seed}: ${captured.size}/${checkpoints.size} checkpoints captured in ${((performance.now() - started) / 1000).toFixed(1)}s\n`);
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const result = {
  schema: terminalEndExtension
    ? "line.study-terminal-endpoint-continuation-normal-pool.v1"
    : "line.study-collision-side-normal-pool.v1",
  purpose: [
    "observation-only exact normal-pool replay from immutable frontier states",
    terminalEndExtension
      ? "same PRNG coordinates, attempts, candidate count, gates, and scoring; production bounded endpoints versus only the final post-contact line with its right endpoint extended"
      : "same PRNG coordinates, attempts, candidate count, gates, and scoring; production collision side versus every-line inverted side",
    "no alternate compiler run, normal-source change, or V2 evaluation",
  ],
  frozenConfig: {
    budget: BUDGET,
    joltMs: benchmarkPolicy.transform.joltMs,
    seeds: SEEDS,
    cases: ACTIVE_CASES,
    checkpoints: "first ordinary frontier state at one-third and two-thirds authored-contact gap indices",
    comparator: terminalEndExtension
      ? "set rightExtended=true only on the final proposed normal line after identical raw geometry generation"
      : "invert the flipped bit on every proposed normal line after identical raw geometry generation",
  },
  rows,
  summary: summarize(rows),
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`${JSON.stringify({ ...result, rows: undefined }, null, 2)}\n`);
}

function snapshotRawPool(
  pools: WeakMap<object, RawPool>,
  record: { node: object; seed: number; nCand: number; sampleOrder: readonly Candidate[] },
): void {
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

function replay(caseId: string, regime: Regime, seed: number, captured: Captured, rawPool: RawPool | null, setup: Setup): Row {
  if (rawPool === null || rawPool.count <= 0) {
    return unavailable(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "generation-time ordinary pool snapshot unavailable");
  }
  const gap = setup.gaps[captured.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    return unavailable(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "checkpoint is not a contact gap");
  }
  const rngSeed = (Math.imul(rawPool.seed | 0, 1_000_003) + gap.index + 1) | 0;
  const production = sampleProduction(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed);
  const alternative = terminalEndExtension
    ? sampleTerminalEndpointExtended(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed)
    : sampleFlipped(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed);
  const check = compareRawReplay(rawPool.candidates, production.candidates);
  return {
    caseId, regime, seed, checkpoint: captured.checkpoint, gapIndex: captured.gapIndex,
    candidateCount: rawPool.count, captureAvailable: true,
    replayEquivalent: check.ok, replayMessage: check.message, production, alternative,
    deltas: {
      viable: alternative.viable - production.viable,
      bestAxisRms: improvement(production.bestAxisRms, alternative.bestAxisRms, false),
      bestObjective: improvement(production.bestObjective, alternative.bestObjective, true),
      bestCost: improvement(production.bestCost, alternative.bestCost, false),
    },
  };
}

function unavailable(caseId: string, regime: Regime, seed: number, checkpoint: Checkpoint, gapIndex: number, message: string): Row {
  return {
    caseId, regime, seed, checkpoint, gapIndex, candidateCount: null,
    captureAvailable: false, replayEquivalent: null, replayMessage: message,
    production: null, alternative: null, deltas: null,
  };
}

function sampleProduction(node: HandoffNode, gap: Gap, ctx: SpecContext, gaps: Gap[], count: number, seed: number): Arm {
  const rng = makeRng(seed);
  const candidates: Digest[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const candidate = sampleOneCandidate(node.search.prefixEngine, gap, rng, ctx, node.search.prefixNextLineId, attempt);
    if (candidate !== null) candidates.push(digest(candidate, node, gap, gaps, ctx));
  }
  return summarizeArm(count, candidates);
}

function sampleFlipped(node: HandoffNode, gap: Gap, ctx: SpecContext, gaps: Gap[], count: number, seed: number): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const geometry = { ...rawGeometry, lines: rawGeometry.lines.map((line) => ({ ...line, flipped: !line.flipped })) };
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal", probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx));
    }
  }
  return summarizeArm(count, candidates);
}

function sampleTerminalEndpointExtended(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const lines = rawGeometry.lines.map((line, index) => ({
      ...line,
      rightExtended: index === rawGeometry.lines.length - 1 ? true : line.rightExtended,
    }));
    if (lines.length === 0) throw new Error("normal proposal has no terminal line to extend");
    const fit = tryCandidateGeometry(
      node.search.prefixEngine,
      gap,
      { ...rawGeometry, lines },
      node.search.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx));
    }
  }
  return summarizeArm(count, candidates);
}

function summarizeArm(attempts: number, candidates: Digest[]): Arm {
  const finiteAxis = candidates.filter((candidate) => Number.isFinite(candidate.axisRms));
  const finiteObjective = candidates.filter((candidate) => candidate.objective !== null);
  return {
    attempts,
    viable: candidates.length,
    bestCost: minOrNull(candidates.map((candidate) => candidate.cost)),
    bestAxisRms: minOrNull(finiteAxis.map((candidate) => candidate.axisRms)),
    bestObjective: maxOrNull(finiteObjective.map((candidate) => candidate.objective!)),
    candidates,
  };
}

function digest(candidate: Candidate, node: HandoffNode, gap: Gap, gaps: Gap[], ctx: SpecContext): Digest {
  return {
    attempt: candidate.sampleAttempt ?? -1,
    hash: geometryHash(candidate),
    cost: round(candidate.cost),
    axisRms: round(axisRms(candidate, ctx.gapAxisTargets?.[gap.index] ?? gap.targets)),
    objective: nullableRound(candidateQualityObjective(node.search.prefixEngine, candidate, gap, gaps, ctx)),
  };
}

function axisRms(candidate: Candidate, targets: AxisValues): number {
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors = Object.entries(targets).flatMap(([axis, target]) => {
    const value = achieved[axis as keyof AxisValues];
    return typeof target === "number" && typeof value === "number" && Number.isFinite(value) ? [(value - target) ** 2] : [];
  });
  return errors.length === 0 ? Infinity : Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length);
}

function compareRawReplay(generated: readonly { attempt: number; hash: string }[], replayed: readonly Digest[]): { ok: boolean; message: string } {
  const expected = [...generated].sort((a, b) => a.attempt - b.attempt);
  const actual = [...replayed].map(({ attempt, hash }) => ({ attempt, hash })).sort((a, b) => a.attempt - b.attempt);
  if (expected.length !== actual.length) return { ok: false, message: `viable count ${actual.length} does not match generation-time ${expected.length}` };
  for (let index = 0; index < expected.length; index++) {
    if (expected[index].attempt !== actual[index].attempt || expected[index].hash !== actual[index].hash) {
      return { ok: false, message: `candidate mismatch at viable index ${index}: expected a${expected[index].attempt}/${expected[index].hash.slice(0, 12)}, got a${actual[index].attempt}/${actual[index].hash.slice(0, 12)}` };
    }
  }
  return { ok: true, message: "sample attempts and coordinate-plus-side hashes match generation-time raw-normal pool" };
}

function checkpointGapIndices(gaps: readonly Gap[]): Map<number, Checkpoint> {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  if (contacts.length < 3) throw new Error("frozen source has fewer than three contact gaps");
  const first = contacts[Math.floor((contacts.length - 1) / 3)];
  const second = contacts[Math.floor((2 * (contacts.length - 1)) / 3)];
  if (first === undefined || second === undefined || first === second) throw new Error("unable to derive distinct one-third/two-thirds checkpoint gaps");
  return new Map([[first, "one_third"], [second, "two_thirds"]]);
}

type Setup = { gaps: Gap[]; ctx: SpecContext };
function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5) };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const current = gaps[index];
    const next = gaps[index + 1];
    if (current.endsWithContact && next.endsWithContact && next.targets.impact !== undefined) current.nextImpact = next.targets.impact;
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2), Boolean(line.flipped),
  ]))).digest("hex");
}

function summarize(rows: readonly Row[]) {
  const usable = rows.filter((row) => row.replayEquivalent === true && row.deltas !== null);
  const byRegime = Object.fromEntries([...new Set(ACTIVE_CASES.map((entry) => entry.regime))].map((regime) =>
    [regime, summarizeRows(usable.filter((row) => row.regime === regime))]
  ));
  const summaries = Object.values(byRegime) as ReturnType<typeof summarizeRows>[];
  return {
    declaredRows: rows.length,
    captureAvailable: rows.filter((row) => row.captureAvailable).length,
    replayEquivalent: rows.filter((row) => row.replayEquivalent === true).length,
    replayFailures: rows.filter((row) => row.replayEquivalent === false).length,
    usableRows: usable.length,
    alternativeViableRows: usable.filter((row) => (row.alternative?.viable ?? 0) > 0).length,
    byRegime,
    regimeBalanced: {
      viableDelta: mean(summaries.map((row) => row.viableDelta).filter(isFiniteNumber)),
      bestAxisRmsImprovement: mean(summaries.map((row) => row.bestAxisRmsImprovement).filter(isFiniteNumber)),
      bestObjectiveImprovement: mean(summaries.map((row) => row.bestObjectiveImprovement).filter(isFiniteNumber)),
      bestCostImprovement: mean(summaries.map((row) => row.bestCostImprovement).filter(isFiniteNumber)),
    },
  };
}

function summarizeRows(rows: readonly Row[]) {
  return {
    rows: rows.length,
    viableDelta: mean(rows.map((row) => row.deltas!.viable)),
    bestAxisRmsImprovement: mean(rows.map((row) => row.deltas!.bestAxisRms).filter(isFiniteNumber)),
    bestObjectiveImprovement: mean(rows.map((row) => row.deltas!.bestObjective).filter(isFiniteNumber)),
    bestCostImprovement: mean(rows.map((row) => row.deltas!.bestCost).filter(isFiniteNumber)),
  };
}

function improvement(production: number | null, comparator: number | null, higherIsBetter: boolean): number | null {
  return production === null || comparator === null ? null : round(higherIsBetter ? comparator - production : production - comparator);
}
function minOrNull(values: readonly number[]): number | null { return values.length === 0 ? null : round(Math.min(...values)); }
function maxOrNull(values: readonly number[]): number | null { return values.length === 0 ? null : round(Math.max(...values)); }
function mean(values: readonly number[]): number | null { return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length); }
function nullableRound(value: number | null): number | null { return value === null || !Number.isFinite(value) ? null : round(value); }
function isFiniteNumber(value: number | null): value is number { return value !== null && Number.isFinite(value); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
