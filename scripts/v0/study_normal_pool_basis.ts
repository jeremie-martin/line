/**
 * Frozen observation-only comparison of two coordinate sequences for the
 * existing eight-draw normal sampler. It never installs an alternate source
 * or changes a compiler traversal: it first captures ordinary immutable
 * frontier states, then replays raw-normal candidate pools from those states.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_normal_pool_basis.ts \
 *     --out=generated/studies/normal-pool-basis/v1/result.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import {
  compileHandoff,
  setHandoffFrontierNodeProbeHook,
  type HandoffNode,
} from "./optimizer/handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import { sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import {
  effectiveAxes,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_normal_pool_basis.ts [--out=generated/studies/normal-pool-basis/v1/result.json]\n",
  );
  process.exit(0);
}
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = arg("out");
const unknownArgs = argv.filter((value) => !value.startsWith("--out="));
if (unknownArgs.length > 0) throw new Error(`unknown argument(s): ${unknownArgs.join(", ")}`);

const BUDGET = 500_000;
const SEEDS = [24, 25] as const;
const CASES = [
  { id: "frontier_dense_recovery", regime: "dense" },
  { id: "frontier_dense_recovery_240ms_figures", regime: "dense" },
  { id: "frontier_pickup_progression_shifted", regime: "pickup" },
  { id: "frontier_low_air_endurance_7s", regime: "low_air" },
  { id: "countercurrent", regime: "representative" },
  { id: "believer_56_6s", regime: "development_music" },
] as const;
const HALTON_BASES = [2, 3, 5, 7, 11, 13, 17, 19] as const;

type Regime = typeof CASES[number]["regime"];
type Arm = "prng" | "halton";
type Captured = {
  checkpoint: "one_third" | "two_thirds";
  gapIndex: number;
  node: HandoffNode;
};
type RawPoolSnapshot = {
  seed: number;
  count: number;
  candidates: Array<{ attempt: number; geometryHash: string }>;
};
type PoolCensusSnapshot = {
  gapIndex: number;
  requestedAttempts: number;
  viableCandidates: number;
  uniqueRepresentations: number;
  duplicateCandidates: number;
  duplicateGroups: number;
  maxMultiplicity: number;
};
type CompileCensusRow = {
  caseId: string;
  regime: Regime;
  seed: number;
  pools: number;
  poolsWithDuplicates: number;
  requestedAttempts: number;
  viableCandidates: number;
  uniqueRepresentations: number;
  duplicateCandidates: number;
  duplicateGroups: number;
  maxPoolDuplicates: number;
  maxMultiplicity: number;
};
type CandidateDigest = {
  attempt: number;
  geometryHash: string;
  cost: number;
  axisRms: number;
  qualityObjective: number | null;
};
type ArmSummary = {
  attempts: number;
  viable: number;
  bestCost: number | null;
  bestAxisRms: number | null;
  bestQualityObjective: number | null;
  candidates: CandidateDigest[];
};
type Row = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpoint: Captured["checkpoint"];
  gapIndex: number;
  candidateCount: number | null;
  captureAvailable: boolean;
  replayEquivalent: boolean | null;
  replayMessage: string | null;
  prng: ArmSummary | null;
  halton: ArmSummary | null;
  deltas: {
    viable: number | null;
    bestAxisRms: number | null;
    bestQualityObjective: number | null;
    bestCost: number | null;
  } | null;
};

const catalog = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case]));
const definitions = CASES.map((entry) => {
  const value = catalog.get(entry.id);
  if (value === undefined) throw new Error(`frozen case ${entry.id} is absent from development catalog`);
  return { ...entry, spec: value.spec };
});

const rows: Row[] = [];
const compilerPoolCensus: CompileCensusRow[] = [];
for (const definition of definitions) {
  for (const seed of SEEDS) {
    const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
    const setup = buildSetup(spec, seed);
    const checkpointGaps = checkpointGapIndices(setup.gaps);
    const captured = new Map<number, Captured>();
    const rawSnapshots = new WeakMap<object, RawPoolSnapshot>();
    const poolCensus = new Map<object, PoolCensusSnapshot>();
    setHandoffFrontierNodeProbeHook(({ selected }) => {
      if (selected.skippedContacts !== 0 || selected.search.gapIndex === setup.gaps.length) return;
      const checkpoint = checkpointGaps.get(selected.search.gapIndex);
      if (checkpoint !== undefined && !captured.has(selected.search.gapIndex)) {
        const state: Captured = {
          checkpoint,
          gapIndex: selected.search.gapIndex,
          node: selected,
        };
        captured.set(selected.search.gapIndex, state);
      }
    });
    setNormalPoolSnapshotHook((record) => {
      const censusPrior = poolCensus.get(record.node);
      if (censusPrior === undefined || record.nCand >= censusPrior.requestedAttempts) {
        poolCensus.set(record.node, censusSnapshot(record.gapIndex, record.nCand, record.sampleOrder));
      }
      const prior = rawSnapshots.get(record.node);
      if (prior === undefined || prior.seed !== record.seed || record.nCand < prior.count) {
        rawSnapshots.set(record.node, {
          seed: record.seed,
          count: record.nCand,
          candidates: record.sampleOrder.map((candidate) => ({
            attempt: candidate.sampleAttempt ?? -1,
            geometryHash: geometryHash(candidate),
          })),
        });
        return;
      }
      if (record.nCand > prior.count) {
        prior.candidates.push(...record.sampleOrder
          .filter((candidate) => (candidate.sampleAttempt ?? -1) >= prior.count)
          .map((candidate) => ({
          attempt: candidate.sampleAttempt ?? -1,
          geometryHash: geometryHash(candidate),
          })));
        prior.count = record.nCand;
      }
    });
    const started = performance.now();
    try {
      compileHandoff(spec, seed, { budget: BUDGET });
    } finally {
      setHandoffFrontierNodeProbeHook(null);
      setNormalPoolSnapshotHook(null);
    }
    compilerPoolCensus.push(summarizeCompilerPools(
      definition.id,
      definition.regime,
      seed,
      [...poolCensus.values()],
    ));

    for (const [gapIndex, checkpoint] of checkpointGaps) {
      const capturedState = captured.get(gapIndex);
      if (capturedState === undefined) {
        rows.push(unavailableRow(definition.id, definition.regime, seed, checkpoint, gapIndex, "frontier state unavailable"));
        continue;
      }
      rows.push(replayCapturedState(
        definition.id,
        definition.regime,
        seed,
        capturedState,
        rawSnapshots.get(capturedState.node.search) ?? null,
        setup,
      ));
    }
    process.stderr.write(
      `${definition.id}/s${seed}: ${captured.size}/${checkpointGaps.size} checkpoints captured in ` +
      `${((performance.now() - started) / 1000).toFixed(1)}s\n`,
    );
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const result = {
  schema: "line.study-normal-pool-basis.v1",
  purpose: [
    "observation-only replay of ordinary normal candidate pools from immutable frontier states",
    "same candidate count and attempt indices; PRNG versus seeded Cranley-Patterson-rotated Halton coordinates",
    "no alternate compiler run, no V2 evaluation, and no production source change",
  ],
  frozenConfig: {
    budget: BUDGET,
    joltMs: benchmarkPolicy.transform.joltMs,
    seeds: SEEDS,
    cases: CASES,
    checkpoints: "first ordinary frontier state at one-third and two-thirds authored-contact gap indices",
    rawDrawDimensions: HALTON_BASES.length,
    haltonBases: HALTON_BASES,
  },
  rows,
  compilerPoolCensus,
  summary: {
    ...summarize(rows),
    duplicateCensus: summarizeDuplicateCensus(compilerPoolCensus),
  },
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`${JSON.stringify({ ...result, rows: undefined }, null, 2)}\n`);
}

function replayCapturedState(
  caseId: string,
  regime: Regime,
  seed: number,
  captured: Captured,
  rawPool: RawPoolSnapshot | null,
  setup: Setup,
): Row {
  if (rawPool === null || rawPool.count <= 0) {
    return unavailableRow(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "generation-time ordinary pool snapshot unavailable");
  }
  const gap = setup.gaps[captured.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    return unavailableRow(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "checkpoint is not a contact gap");
  }
  const count = rawPool.count;
  const rngSeed = (Math.imul(rawPool.seed | 0, 1_000_003) + gap.index + 1) | 0;
  const prng = sampleArm("prng", captured.node, gap, setup.ctx, setup.gaps, count, rngSeed);
  const halton = sampleArm("halton", captured.node, gap, setup.ctx, setup.gaps, count, rngSeed);
  const replay = compareGeneratedRawReplay(rawPool.candidates, prng.candidates);
  return {
    caseId,
    regime,
    seed,
    checkpoint: captured.checkpoint,
    gapIndex: captured.gapIndex,
    candidateCount: count,
    captureAvailable: true,
    replayEquivalent: replay.ok,
    replayMessage: replay.message,
    prng,
    halton,
    deltas: {
      viable: halton.viable - prng.viable,
      bestAxisRms: pairedImprovement(prng.bestAxisRms, halton.bestAxisRms, false),
      bestQualityObjective: pairedImprovement(prng.bestQualityObjective, halton.bestQualityObjective, true),
      bestCost: pairedImprovement(prng.bestCost, halton.bestCost, false),
    },
  };
}

function unavailableRow(
  caseId: string,
  regime: Regime,
  seed: number,
  checkpoint: Captured["checkpoint"],
  gapIndex: number,
  message: string,
): Row {
  return {
    caseId,
    regime,
    seed,
    checkpoint,
    gapIndex,
    candidateCount: null,
    captureAvailable: false,
    replayEquivalent: null,
    replayMessage: message,
    prng: null,
    halton: null,
    deltas: null,
  };
}

function sampleArm(
  arm: Arm,
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): ArmSummary {
  const rng = arm === "prng" ? makeRng(seed) : makeScrambledHaltonRng(seed);
  const candidates: CandidateDigest[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const candidate = sampleOneCandidate(
      node.search.prefixEngine,
      gap,
      rng,
      ctx,
      node.search.prefixNextLineId,
      attempt,
    );
    if (candidate !== null) candidates.push(digestCandidate(candidate, node, gap, gaps, ctx));
  }
  const finiteAxis = candidates.filter((candidate) => Number.isFinite(candidate.axisRms));
  const finiteObjective = candidates.filter((candidate) => candidate.qualityObjective !== null);
  return {
    attempts: count,
    viable: candidates.length,
    bestCost: minOrNull(candidates.map((candidate) => candidate.cost)),
    bestAxisRms: minOrNull(finiteAxis.map((candidate) => candidate.axisRms)),
    bestQualityObjective: maxOrNull(finiteObjective.map((candidate) => candidate.qualityObjective!)),
    candidates,
  };
}

function digestCandidate(
  candidate: Candidate,
  node: HandoffNode,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
): CandidateDigest {
  return {
    attempt: candidate.sampleAttempt ?? -1,
    geometryHash: geometryHash(candidate),
    cost: round(candidate.cost),
    axisRms: round(axisRms(candidate, ctx.gapAxisTargets?.[gap.index] ?? gap.targets)),
    qualityObjective: nullableRound(candidateQualityObjective(node.search.prefixEngine, candidate, gap, gaps, ctx)),
  };
}

function axisRms(candidate: Candidate, targets: AxisValues): number {
  const achieved = candidate.achieved;
  const errors = Object.entries(targets).flatMap(([axis, target]) => {
    const value = achieved[axis as keyof AxisValues];
    return typeof target === "number" && typeof value === "number" && Number.isFinite(value)
      ? [(value - target) ** 2]
      : [];
  });
  return errors.length === 0 ? Infinity : Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length);
}

function compareGeneratedRawReplay(
  generated: readonly { attempt: number; geometryHash: string }[],
  replayed: readonly CandidateDigest[],
): { ok: boolean; message: string } {
  const expected = [...generated].sort((a, b) => a.attempt - b.attempt);
  const actual = [...replayed]
    .map((candidate) => ({ attempt: candidate.attempt, geometryHash: candidate.geometryHash }))
    .sort((a, b) => a.attempt - b.attempt);
  if (expected.length !== actual.length) {
    return { ok: false, message: `viable count ${actual.length} does not match generation-time ${expected.length}` };
  }
  for (let index = 0; index < expected.length; index++) {
    if (expected[index].attempt !== actual[index].attempt || expected[index].geometryHash !== actual[index].geometryHash) {
      return {
        ok: false,
        message: `candidate mismatch at viable index ${index}: ` +
          `expected a${expected[index].attempt}/${expected[index].geometryHash.slice(0, 12)}, ` +
          `got a${actual[index].attempt}/${actual[index].geometryHash.slice(0, 12)}`,
      };
    }
  }
  return { ok: true, message: "sample attempts and geometry hashes match generation-time raw-normal pool" };
}

function checkpointGapIndices(gaps: readonly Gap[]): Map<number, Captured["checkpoint"]> {
  const contactIndices = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  if (contactIndices.length < 3) throw new Error("frozen source has fewer than three contact gaps");
  const first = contactIndices[Math.floor((contactIndices.length - 1) / 3)];
  const second = contactIndices[Math.floor((2 * (contactIndices.length - 1)) / 3)];
  if (first === undefined || second === undefined || first === second) {
    throw new Error("unable to derive distinct one-third/two-thirds checkpoint gaps");
  }
  return new Map([[first, "one_third"], [second, "two_thirds"]]);
}

type Setup = { gaps: Gap[]; ctx: SpecContext };
function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const],
  ));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  // Match the compiler's generation-only lookahead: a gap's launch also sees
  // the following authored impact ask. Omitting this changes the normal
  // post-contact delivery adjustment and invalidates a raw replay even when
  // the PRNG stream itself is exact.
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (!gaps[index].endsWithContact) continue;
    const next = gaps[index + 1];
    if (next.endsWithContact && next.targets.impact !== undefined) {
      gaps[index].nextImpact = next.targets.impact;
    }
  }
  return {
    gaps,
    ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets, gaps },
  };
}

function makeScrambledHaltonRng(seed: number): () => number {
  let draw = 0;
  return () => {
    const dimension = draw % HALTON_BASES.length;
    const point = Math.floor(draw / HALTON_BASES.length) + 1;
    draw++;
    return fract(radicalInverse(point, HALTON_BASES[dimension]) + unitHash(seed, dimension));
  };
}

function radicalInverse(index: number, base: number): number {
  let value = 0;
  let factor = 1 / base;
  let remaining = index;
  while (remaining > 0) {
    value += (remaining % base) * factor;
    remaining = Math.floor(remaining / base);
    factor /= base;
  }
  return value;
}

function unitHash(seed: number, dimension: number): number {
  let value = (seed ^ Math.imul(dimension + 1, 0x9e3779b9)) | 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2),
  ]))).digest("hex");
}

function representationHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    line.id,
    line.type,
    line.x1,
    line.y1,
    line.x2,
    line.y2,
    line.flipped,
    line.leftExtended,
    line.rightExtended,
  ]))).digest("hex");
}

function censusSnapshot(
  gapIndex: number,
  requestedAttempts: number,
  candidates: readonly Candidate[],
): PoolCensusSnapshot {
  const multiplicities = new Map<string, number>();
  for (const candidate of candidates) {
    const hash = representationHash(candidate);
    multiplicities.set(hash, (multiplicities.get(hash) ?? 0) + 1);
  }
  const counts = [...multiplicities.values()];
  return {
    gapIndex,
    requestedAttempts,
    viableCandidates: candidates.length,
    uniqueRepresentations: multiplicities.size,
    duplicateCandidates: candidates.length - multiplicities.size,
    duplicateGroups: counts.filter((count) => count > 1).length,
    maxMultiplicity: counts.length === 0 ? 0 : Math.max(...counts),
  };
}

function summarizeCompilerPools(
  caseId: string,
  regime: Regime,
  seed: number,
  pools: readonly PoolCensusSnapshot[],
): CompileCensusRow {
  return {
    caseId,
    regime,
    seed,
    pools: pools.length,
    poolsWithDuplicates: pools.filter((pool) => pool.duplicateCandidates > 0).length,
    requestedAttempts: sum(pools.map((pool) => pool.requestedAttempts)),
    viableCandidates: sum(pools.map((pool) => pool.viableCandidates)),
    uniqueRepresentations: sum(pools.map((pool) => pool.uniqueRepresentations)),
    duplicateCandidates: sum(pools.map((pool) => pool.duplicateCandidates)),
    duplicateGroups: sum(pools.map((pool) => pool.duplicateGroups)),
    maxPoolDuplicates: pools.length === 0 ? 0 : Math.max(...pools.map((pool) => pool.duplicateCandidates)),
    maxMultiplicity: pools.length === 0 ? 0 : Math.max(...pools.map((pool) => pool.maxMultiplicity)),
  };
}

function summarizeDuplicateCensus(rows: readonly CompileCensusRow[]) {
  const pools = sum(rows.map((row) => row.pools));
  const viableCandidates = sum(rows.map((row) => row.viableCandidates));
  const duplicateCandidates = sum(rows.map((row) => row.duplicateCandidates));
  return {
    compilerRuns: rows.length,
    pools,
    poolsWithDuplicates: sum(rows.map((row) => row.poolsWithDuplicates)),
    requestedAttempts: sum(rows.map((row) => row.requestedAttempts)),
    viableCandidates,
    uniqueRepresentations: sum(rows.map((row) => row.uniqueRepresentations)),
    duplicateCandidates,
    duplicateGroups: sum(rows.map((row) => row.duplicateGroups)),
    duplicateCandidateRate: viableCandidates === 0 ? null : round(duplicateCandidates / viableCandidates),
    maxPoolDuplicates: rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.maxPoolDuplicates)),
    maxMultiplicity: rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.maxMultiplicity)),
  };
}

function summarize(rows: readonly Row[]) {
  const usable = rows.filter((row) => row.replayEquivalent === true && row.deltas !== null);
  const byRegime = Object.fromEntries([...new Set(CASES.map((entry) => entry.regime))].map((regime) => {
    const regimeRows = usable.filter((row) => row.regime === regime);
    return [regime, summarizeRows(regimeRows)];
  }));
  const regimeSummaries = Object.values(byRegime) as ReturnType<typeof summarizeRows>[];
  return {
    declaredRows: rows.length,
    captureAvailable: rows.filter((row) => row.captureAvailable).length,
    replayEquivalent: rows.filter((row) => row.replayEquivalent === true).length,
    replayFailures: rows.filter((row) => row.replayEquivalent === false).length,
    usableRows: usable.length,
    byRegime,
    regimeBalanced: {
      viableDelta: mean(regimeSummaries.map((row) => row.viableDelta).filter(isFiniteNumber)),
      bestAxisRmsImprovement: mean(regimeSummaries.map((row) => row.bestAxisRmsImprovement).filter(isFiniteNumber)),
      bestQualityObjectiveImprovement: mean(regimeSummaries.map((row) => row.bestQualityObjectiveImprovement).filter(isFiniteNumber)),
      bestCostImprovement: mean(regimeSummaries.map((row) => row.bestCostImprovement).filter(isFiniteNumber)),
    },
  };
}

function summarizeRows(rows: readonly Row[]) {
  return {
    rows: rows.length,
    viableDelta: mean(rows.map((row) => row.deltas!.viable)),
    bestAxisRmsImprovement: mean(rows.map((row) => row.deltas!.bestAxisRms).filter(isFiniteNumber)),
    bestQualityObjectiveImprovement: mean(rows.map((row) => row.deltas!.bestQualityObjective).filter(isFiniteNumber)),
    bestCostImprovement: mean(rows.map((row) => row.deltas!.bestCost).filter(isFiniteNumber)),
  };
}

function pairedImprovement(prng: number | null, halton: number | null, higherIsBetter: boolean): number | null {
  if (prng === null || halton === null) return null;
  return round(higherIsBetter ? halton - prng : prng - halton);
}

function minOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(Math.min(...values));
}

function maxOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(Math.max(...values));
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function nullableRound(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value);
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
