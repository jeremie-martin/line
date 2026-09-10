/**
 * Exact paired pool observation for the ordinary normal carrier's curve
 * resolution. The comparator preserves every sampled coordinate and all gate
 * inputs, refining only a generic non-template post curve to the existing
 * geometry tolerance when its sampled chord count is too low.
 *
 * LR_ENGINE=wasm npx tsx scripts/v0/study_normal_post_curve_resolution.ts \
 *   --out=generated/studies/normal-post-curve-resolution/v1/result.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { setNormalPostCurveResolutionHook } from "./arc_placement.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import {
  compileLegacyHandoff,
  setHandoffFrontierNodeProbeHook,
  type HandoffNode,
} from "./optimizer/legacy_handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { adaptiveCurveSegmentCount } from "./trajectory/curve_resolution.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_normal_post_curve_resolution.ts [--out=generated/studies/normal-post-curve-resolution/v1/result.json]\n",
  );
  process.exit(0);
}
const argumentValue = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = argumentValue("out");
const unknownArgs = argv.filter((value) => !value.startsWith("--out="));
if (unknownArgs.length > 0) throw new Error(`unknown argument(s): ${unknownArgs.join(", ")}`);

const BUDGET = 500_000;
const SEEDS = [30, 31] as const;
const CASES = [
  { id: "frontier_dense_recovery_240ms_figures", regime: "dense" },
  { id: "open_hook_amplitude_plus_8", regime: "high_air" },
  { id: "rising_switch", regime: "representative" },
  { id: "pickup_lattice_speed_minus_4", regime: "pickup" },
  { id: "frontier_low_air_endurance_7s", regime: "low_air" },
  { id: "believer_56_6s_impact_relief", regime: "development_music" },
] as const;

type Regime = typeof CASES[number]["regime"];
type Checkpoint = "one_third" | "two_thirds";
type Captured = { checkpoint: Checkpoint; gapIndex: number; node: HandoffNode };
type RawPoolSnapshot = {
  seed: number;
  count: number;
  candidates: Array<{ attempt: number; geometryHash: string }>;
};
type CandidateDigest = {
  attempt: number;
  geometryHash: string;
  lineCount: number;
  cost: number;
  axisRms: number;
  qualityObjective: number | null;
};
type ResolutionRecord = {
  attempt: number;
  nominalSegments: number;
  resolvedSegments: number;
  addedSegments: number;
  postTurnDeg: number;
  curveBias: number;
};
type ArmSummary = {
  attempts: number;
  viable: number;
  admissionFrames: number;
  bestCost: number | null;
  bestAxisRms: number | null;
  bestQualityObjective: number | null;
  meanLineCount: number | null;
  candidates: CandidateDigest[];
  resolution: {
    eligibleCurves: number;
    refinedCurves: number;
    addedSegments: number;
    meanNominalSegments: number | null;
    meanResolvedSegments: number | null;
    records: ResolutionRecord[];
  } | null;
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
  production: ArmSummary | null;
  toleranceResolved: ArmSummary | null;
  deltas: {
    viable: number | null;
    admissionFrames: number | null;
    bestAxisRms: number | null;
    bestQualityObjective: number | null;
    bestCost: number | null;
  } | null;
};
type Setup = { gaps: Gap[]; ctx: SpecContext };

const catalog = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case]));
const definitions = CASES.map((entry) => {
  const spec = catalog.get(entry.id)?.spec;
  if (spec === undefined) throw new Error(`frozen case ${entry.id} is absent from development catalog`);
  return { ...entry, spec };
});

const rows: Row[] = [];
for (const definition of definitions) {
  for (const seed of SEEDS) {
    const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
    const setup = buildSetup(spec, seed);
    const checkpoints = checkpointGapIndices(setup.gaps);
    const captured = new Map<number, Captured>();
    const rawSnapshots = new WeakMap<object, RawPoolSnapshot>();
    setNormalPostCurveResolutionHook(null);
    setHandoffFrontierNodeProbeHook(({ selected }) => {
      if (selected.skippedContacts !== 0 || selected.search.gapIndex === setup.gaps.length) return;
      const checkpoint = checkpoints.get(selected.search.gapIndex);
      if (checkpoint !== undefined && !captured.has(selected.search.gapIndex)) {
        captured.set(selected.search.gapIndex, { checkpoint, gapIndex: selected.search.gapIndex, node: selected });
      }
    });
    setNormalPoolSnapshotHook((record) => captureRawPool(rawSnapshots, record));
    const started = performance.now();
    try {
      compileLegacyHandoff(spec, seed, { budget: BUDGET });
    } finally {
      setHandoffFrontierNodeProbeHook(null);
      setNormalPoolSnapshotHook(null);
      setNormalPostCurveResolutionHook(null);
    }

    for (const [gapIndex, checkpoint] of checkpoints) {
      const state = captured.get(gapIndex);
      if (state === undefined) {
        rows.push(unavailableRow(definition.id, definition.regime, seed, checkpoint, gapIndex, "frontier state unavailable"));
        continue;
      }
      rows.push(replayCapturedState(
        definition.id,
        definition.regime,
        seed,
        state,
        rawSnapshots.get(state.node.search) ?? null,
        setup,
      ));
    }
    process.stderr.write(
      `${definition.id}/s${seed}: ${captured.size}/${checkpoints.size} checkpoints captured in ` +
      `${((performance.now() - started) / 1000).toFixed(1)}s\n`,
    );
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const result = {
  schema: "line.study-normal-post-curve-resolution.v1",
  purpose: [
    "exact paired raw-normal pool comparison at immutable frontier states",
    "preserve sampled PRNG coordinates, targets, contact capture, gate, evaluator, and rank; refine only generic non-template post-curve chord count",
    "the fixed 2px and 5 degree tolerance is already the trajectory geometry contract, not a source-specific sweep",
  ],
  frozenConfig: {
    budget: BUDGET,
    joltMs: benchmarkPolicy.transform.joltMs,
    seeds: SEEDS,
    cases: CASES,
    checkpoints: "first ordinary frontier state at one-third and two-thirds authored-contact gap indices",
    resolution: {
      maxChordErrorPx: 2,
      maxTurnDegPerSegment: 5,
      curvaturePower: "1 + abs(curveBias)",
      rule: "max(nominalSegments, adaptiveCurveSegmentCount(...))",
      templatePolicy: "unchanged",
    },
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

function captureRawPool(
  snapshots: WeakMap<object, RawPoolSnapshot>,
  record: { node: object; seed: number; nCand: number; sampleOrder: readonly Candidate[] },
): void {
  const prior = snapshots.get(record.node);
  if (prior === undefined || prior.seed !== record.seed || record.nCand < prior.count) {
    snapshots.set(record.node, {
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
      .map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, geometryHash: geometryHash(candidate) })));
    prior.count = record.nCand;
  }
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
  const rngSeed = (Math.imul(rawPool.seed | 0, 1_000_003) + gap.index + 1) | 0;
  const production = sampleArm(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed, false);
  const replay = compareGeneratedRawReplay(rawPool.candidates, production.candidates);
  const toleranceResolved = sampleArm(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed, true);
  return {
    caseId,
    regime,
    seed,
    checkpoint: captured.checkpoint,
    gapIndex: captured.gapIndex,
    candidateCount: rawPool.count,
    captureAvailable: true,
    replayEquivalent: replay.ok,
    replayMessage: replay.message,
    production,
    toleranceResolved,
    deltas: {
      viable: toleranceResolved.viable - production.viable,
      admissionFrames: production.admissionFrames - toleranceResolved.admissionFrames,
      bestAxisRms: pairedImprovement(production.bestAxisRms, toleranceResolved.bestAxisRms, false),
      bestQualityObjective: pairedImprovement(production.bestQualityObjective, toleranceResolved.bestQualityObjective, true),
      bestCost: pairedImprovement(production.bestCost, toleranceResolved.bestCost, false),
    },
  };
}

function unavailableRow(
  caseId: string,
  regime: Regime,
  seed: number,
  checkpoint: Checkpoint,
  gapIndex: number,
  message: string,
): Row {
  return {
    caseId, regime, seed, checkpoint, gapIndex,
    candidateCount: null,
    captureAvailable: false,
    replayEquivalent: null,
    replayMessage: message,
    production: null,
    toleranceResolved: null,
    deltas: null,
  };
}

function sampleArm(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
  toleranceResolved: boolean,
): ArmSummary {
  const rng = makeRng(seed);
  const candidates: CandidateDigest[] = [];
  const records: ResolutionRecord[] = [];
  let admissionFrames = 0;
  if (toleranceResolved) {
    setNormalPostCurveResolutionHook((input) => {
      const resolvedSegments = Math.max(
        input.nominalSegments,
        adaptiveCurveSegmentCount(
          input.postLengthPx,
          input.endAngleDeg - input.startAngleDeg,
          1 + Math.abs(input.curveBias),
          { maxChordErrorPx: 2, maxTurnDegPerSegment: 5 },
        ),
      );
      records.push({
        attempt: input.attempt,
        nominalSegments: input.nominalSegments,
        resolvedSegments,
        addedSegments: resolvedSegments - input.nominalSegments,
        postTurnDeg: round(input.endAngleDeg - input.startAngleDeg),
        curveBias: round(input.curveBias),
      });
      return resolvedSegments;
    });
  }
  try {
    for (let attempt = 0; attempt < count; attempt++) {
      const before = getSimFrames();
      const candidate = sampleOneCandidate(node.search.prefixEngine, gap, rng, ctx, node.search.prefixNextLineId, attempt);
      admissionFrames += getSimFrames() - before;
      if (candidate !== null) candidates.push(digestCandidate(candidate, node, gap, gaps, ctx));
    }
  } finally {
    setNormalPostCurveResolutionHook(null);
  }
  const finiteAxis = candidates.filter((candidate) => Number.isFinite(candidate.axisRms));
  const finiteObjective = candidates.filter((candidate) => candidate.qualityObjective !== null);
  return {
    attempts: count,
    viable: candidates.length,
    admissionFrames,
    bestCost: minOrNull(candidates.map((candidate) => candidate.cost)),
    bestAxisRms: minOrNull(finiteAxis.map((candidate) => candidate.axisRms)),
    bestQualityObjective: maxOrNull(finiteObjective.map((candidate) => candidate.qualityObjective!)),
    meanLineCount: mean(candidates.map((candidate) => candidate.lineCount)),
    candidates,
    resolution: toleranceResolved ? summarizeResolution(records) : null,
  };
}

function summarizeResolution(records: readonly ResolutionRecord[]): ArmSummary["resolution"] {
  return {
    eligibleCurves: records.length,
    refinedCurves: records.filter((record) => record.addedSegments > 0).length,
    addedSegments: records.reduce((sum, record) => sum + record.addedSegments, 0),
    meanNominalSegments: mean(records.map((record) => record.nominalSegments)),
    meanResolvedSegments: mean(records.map((record) => record.resolvedSegments)),
    records: [...records],
  };
}

function digestCandidate(candidate: Candidate, node: HandoffNode, gap: Gap, gaps: Gap[], ctx: SpecContext): CandidateDigest {
  return {
    attempt: candidate.sampleAttempt ?? -1,
    geometryHash: geometryHash(candidate),
    lineCount: candidate.lines.length,
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
  const expected = [...generated].sort((left, right) => left.attempt - right.attempt);
  const actual = [...replayed]
    .map((candidate) => ({ attempt: candidate.attempt, geometryHash: candidate.geometryHash }))
    .sort((left, right) => left.attempt - right.attempt);
  if (expected.length !== actual.length) {
    return { ok: false, message: `viable count ${actual.length} does not match generation-time ${expected.length}` };
  }
  for (let index = 0; index < expected.length; index++) {
    if (expected[index]!.attempt !== actual[index]!.attempt || expected[index]!.geometryHash !== actual[index]!.geometryHash) {
      return {
        ok: false,
        message: `candidate mismatch at viable index ${index}: expected a${expected[index]!.attempt}/${expected[index]!.geometryHash.slice(0, 12)}, ` +
          `got a${actual[index]!.attempt}/${actual[index]!.geometryHash.slice(0, 12)}`,
      };
    }
  }
  return { ok: true, message: "sample attempts and geometry hashes match generation-time raw-normal pool" };
}

function checkpointGapIndices(gaps: readonly Gap[]): Map<number, Checkpoint> {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  if (contacts.length < 3) throw new Error("frozen source has fewer than three contact gaps");
  const first = contacts[Math.floor((contacts.length - 1) / 3)];
  const second = contacts[Math.floor((2 * (contacts.length - 1)) / 3)];
  if (first === undefined || second === undefined || first === second) throw new Error("unable to derive distinct checkpoint gaps");
  return new Map([[first, "one_third"], [second, "two_thirds"]]);
}

function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((left, right) => left - right);
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
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (!gaps[index]!.endsWithContact) continue;
    const next = gaps[index + 1]!;
    if (next.endsWithContact && next.targets.impact !== undefined) gaps[index]!.nextImpact = next.targets.impact;
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function summarize(rows: readonly Row[]) {
  const usable = rows.filter((row) => row.replayEquivalent === true && row.deltas !== null && row.toleranceResolved !== null);
  const byRegime = Object.fromEntries([...new Set(CASES.map((entry) => entry.regime))].map((regime) => {
    const regimeRows = usable.filter((row) => row.regime === regime);
    return [regime, summarizeRows(regimeRows)];
  }));
  const regimeSummaries = Object.values(byRegime) as ReturnType<typeof summarizeRows>[];
  const toleranceRows = usable.map((row) => row.toleranceResolved!);
  return {
    declaredRows: rows.length,
    captureAvailable: rows.filter((row) => row.captureAvailable).length,
    replayEquivalent: rows.filter((row) => row.replayEquivalent === true).length,
    replayFailures: rows.filter((row) => row.replayEquivalent === false).length,
    usableRows: usable.length,
    byRegime,
    regimeBalanced: {
      viableDelta: mean(regimeSummaries.map((row) => row.viableDelta).filter(isFiniteNumber)),
      admissionFrameImprovement: mean(regimeSummaries.map((row) => row.admissionFrameImprovement).filter(isFiniteNumber)),
      bestAxisRmsImprovement: mean(regimeSummaries.map((row) => row.bestAxisRmsImprovement).filter(isFiniteNumber)),
      bestQualityObjectiveImprovement: mean(regimeSummaries.map((row) => row.bestQualityObjectiveImprovement).filter(isFiniteNumber)),
      bestCostImprovement: mean(regimeSummaries.map((row) => row.bestCostImprovement).filter(isFiniteNumber)),
    },
    resolutionFootprint: {
      eligibleCurves: toleranceRows.reduce((sum, arm) => sum + arm.resolution!.eligibleCurves, 0),
      refinedCurves: toleranceRows.reduce((sum, arm) => sum + arm.resolution!.refinedCurves, 0),
      addedSegments: toleranceRows.reduce((sum, arm) => sum + arm.resolution!.addedSegments, 0),
    },
  };
}

function summarizeRows(rows: readonly Row[]) {
  return {
    rows: rows.length,
    viableDelta: mean(rows.map((row) => row.deltas!.viable)),
    admissionFrameImprovement: mean(rows.map((row) => row.deltas!.admissionFrames)),
    bestAxisRmsImprovement: mean(rows.map((row) => row.deltas!.bestAxisRms).filter(isFiniteNumber)),
    bestQualityObjectiveImprovement: mean(rows.map((row) => row.deltas!.bestQualityObjective).filter(isFiniteNumber)),
    bestCostImprovement: mean(rows.map((row) => row.deltas!.bestCost).filter(isFiniteNumber)),
  };
}

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2),
  ]))).digest("hex");
}

function pairedImprovement(production: number | null, alternative: number | null, higherIsBetter: boolean): number | null {
  if (production === null || alternative === null) return null;
  return round(higherIsBetter ? alternative - production : production - alternative);
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
function nullableRound(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value);
}
function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}
function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
