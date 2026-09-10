/**
 * Dense-first assay for the native-capture impulse-latched suffix field.
 * It deliberately preserves the raw target-contact prefix and lets the exact
 * candidate gate decide whether the collision-resolved downstream field has a
 * viable continuation basin. Observation only.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import pickup from "../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import regression from "../../benchmark/v2/cases/normative/regression/regression_transition_mosaic.ts";
import river from "../../benchmark/v2/cases/normative/representative/river_reentry.ts";
import denseDialogue from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { getRiderMetered } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import { compileLegacyHandoff, setHandoffFrontierNodeProbeHook, type HandoffNode } from "./optimizer/legacy_handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, engineLineFromTrackLine, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { getCandidateProbe, sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { realizeNativeCaptureImpulseSuffix } from "./trajectory/native_capture_impulse_suffix.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec, type TrackLine } from "./types.ts";

const BUDGET = 500_000;
const ZERO_FRICTION_POINTS = new Set(["TAIL", "NOSE", "STRING"]);
const DENSE_CASES = [
  { id: "frontier_dense_recovery_240ms_figures", regime: "capability_dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", regime: "representative_dense", spec: denseDialogue },
] as const;
const SPREAD_CASES = [
  { id: "river_reentry", regime: "representative_regular", spec: river },
  { id: "dense_dialogue_impact_contrast_10", regime: "representative_dense", spec: denseDialogue },
  { id: "frontier_pickup_progression", regime: "capability_pickup", spec: pickup },
  { id: "frontier_dense_recovery_240ms_figures", regime: "capability_dense", spec: dense },
  { id: "regression_transition_mosaic", regime: "legacy_transition", spec: regression },
  { id: "believer_56_6s", regime: "development_music", spec: believer },
] as const;

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_native_capture_impulse_suffix.ts [--panel=dense|spread] [--seeds=58,59] [--doses=0.25,0.5,0.75,1] [--out=PATH]\n" +
      "Runs frozen dense first-state raw normal pools with a post-native-capture impulse-latched suffix transport. Observation only.\n",
  );
  process.exit(0);
}
const outPath = argv.find((value) => value.startsWith("--out="))?.slice("--out=".length) ??
  "generated/studies/native-capture-impulse-suffix/v1/dense.json";
const panel = argv.find((value) => value.startsWith("--panel="))?.slice("--panel=".length) ?? "dense";
if (panel !== "dense" && panel !== "spread") throw new Error(`--panel must be dense or spread; got ${panel}`);
const DOSES = [...new Set(
  (argv.find((value) => value.startsWith("--doses="))?.slice("--doses=".length) ?? "1")
    .split(",")
    .map(Number),
)].sort((left, right) => left - right);
if (DOSES.length === 0 || DOSES.some((dose) => !Number.isFinite(dose) || !(dose > 0) || dose > 1)) {
  throw new Error(`--doses must be a non-empty comma list in (0,1]; got ${DOSES.join(",")}`);
}
const unknown = argv.filter((value) =>
  !value.startsWith("--out=") && !value.startsWith("--panel=") &&
  !value.startsWith("--doses=") && !value.startsWith("--seeds=")
);
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
const CASES = panel === "dense" ? DENSE_CASES : SPREAD_CASES;
const SEEDS = (argv.find((value) => value.startsWith("--seeds="))?.slice("--seeds=".length) ??
    (panel === "dense" ? "56,57" : "58,59"))
  .split(",")
  .map(Number);
if (SEEDS.length === 0 || SEEDS.some((seed) => !Number.isSafeInteger(seed))) {
  throw new Error(`--seeds must be a non-empty comma list of safe integers; got ${SEEDS.join(",")}`);
}

type Setup = { gaps: Gap[]; ctx: SpecContext };
type RawPool = { seed: number; count: number; candidates: Array<{ attempt: number; hash: string }> };
type Metrics = { axisRms: number; objective: number | null; cost: number };
type DoseTrial = {
  dose: number;
  transported: Metrics | null;
  transportedTargetZeroFrictionUpdates: number | null;
  targetTopologyPreserved: boolean | null;
  evaluationFrames: number;
  terminalDisplacementPx: number;
};
type Trial = {
  attempt: number;
  raw: Metrics;
  availability: string | null;
  lastTargetContactIndex: number | null;
  rawTargetZeroFrictionUpdates: number;
  transported: Metrics | null;
  transportedTargetZeroFrictionUpdates: number | null;
  targetTopologyPreserved: boolean | null;
  stateReadFrames: number;
  evaluationFrames: number;
  impulse: { x: number; y: number } | null;
  terminalDisplacementPx: number | null;
  doses: DoseTrial[];
};
type Row = {
  id: string;
  regime: string;
  seed: number;
  checkpoint: "one_third" | "two_thirds";
  gapIndex: number | null;
  replayEquivalent: boolean | null;
  replayMessage: string | null;
  rawViable: number;
  trials: Trial[];
  summary: ReturnType<typeof summarizeTrials>;
};

const rows: Row[] = [];
for (const definition of CASES) {
  for (const seed of SEEDS) {
    const setup = buildSetup(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed);
    const checkpoints = checkpointIndices(setup.gaps);
    const captures = new Map<number, { label: "one_third" | "two_thirds"; node: HandoffNode }>();
    const rawPools = new WeakMap<object, RawPool>();
    const started = performance.now();
    setHandoffFrontierNodeProbeHook(({ selected }) => {
      if (selected.skippedContacts !== 0) return;
      const label = checkpoints.get(selected.search.gapIndex);
      if (label !== undefined && !captures.has(selected.search.gapIndex)) captures.set(selected.search.gapIndex, { label, node: selected });
    });
    setNormalPoolSnapshotHook((record) => snapshotRawPool(rawPools, record));
    try {
      compileLegacyHandoff(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed, { budget: BUDGET });
    } finally {
      setHandoffFrontierNodeProbeHook(null);
      setNormalPoolSnapshotHook(null);
    }
    for (const [gapIndex, label] of checkpoints) {
      const capture = captures.get(gapIndex);
      if (capture === undefined) {
        rows.push({ id: definition.id, regime: definition.regime, seed, checkpoint: label, gapIndex: null, replayEquivalent: null, replayMessage: "frontier state unavailable", rawViable: 0, trials: [], summary: summarizeTrials([]) });
        continue;
      }
      const gap = setup.gaps[gapIndex]!;
      const sampled = sampleAndTransport(capture.node, gap, setup, rawPools.get(capture.node.search) ?? null);
      rows.push({
        id: definition.id, regime: definition.regime, seed, checkpoint: label, gapIndex,
        replayEquivalent: sampled.replay.ok, replayMessage: sampled.replay.message,
        rawViable: sampled.trials.length, trials: sampled.trials, summary: summarizeTrials(sampled.trials),
      });
    }
    process.stderr.write(`${definition.id}/s${seed}: ${captures.size}/${checkpoints.size} dense states in ${((performance.now() - started) / 1000).toFixed(1)}s\n`);
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const result = {
  schema: "line.study-native-capture-impulse-suffix.v1",
  purpose: "fixed dense-first exact raw-capture suffix transport; neither compiler source nor selector",
  frozenConfig: {
    panel,
    doses: DOSES,
    budget: BUDGET,
    seeds: [...SEEDS],
    joltMs: benchmarkPolicy.transform.joltMs,
    cases: CASES.map(({ id, regime }) => ({ id, regime })),
    checkpoints: "first ordinary frontier states at one-third and two-thirds authored contact depth",
    rawPopulation: "exact generation-time normal-pool attempt count and coordinate-plus-side hashes at each captured frontier node",
    field: "preserve lines through last candidate-owned target zero-friction contact; shift remaining endpoints by (meanZeroFrictionV(H+1)-meanZeroFrictionV(H-1))*arclength/|meanZeroFrictionV(H+1)|",
    topologyRule: "transformed H zero-friction update count must equal the raw count exactly",
  },
  rows,
  summary: summarizeRows(rows),
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: outPath, summary: result.summary }, null, 2)}\n`);

function sampleAndTransport(node: HandoffNode, gap: Gap, setup: Setup, rawPool: RawPool | null): {
  trials: Trial[];
  replay: { ok: boolean; message: string };
} {
  if (rawPool === null || rawPool.count <= 0) return { trials: [], replay: { ok: false, message: "generation-time raw normal pool unavailable" } };
  const rng = makeRng((Math.imul(rawPool.seed | 0, 1_000_003) + gap.index + 1) | 0);
  const raw: Candidate[] = [];
  for (let attempt = 0; attempt < rawPool.count; attempt++) {
    const candidate = sampleOneCandidate(node.search.prefixEngine, gap, rng, setup.ctx, node.search.prefixNextLineId, attempt);
    if (candidate !== null) raw.push(candidate);
  }
  const replay = compareRawReplay(rawPool.candidates, raw);
  return { trials: raw.map((candidate) => evaluateTransport(node, gap, setup, candidate)), replay };
}

function evaluateTransport(node: HandoffNode, gap: Gap, setup: Setup, raw: Candidate): Trial {
  const rawMetrics = metrics(node, gap, setup, raw);
  const beforeState = getSimFrames();
  const rawEngine = node.search.prefixEngine.addLine(raw.lines.map(engineLineFromTrackLine));
  const pre = aggregateVelocity(getRiderMetered(rawEngine, Math.max(0, gap.endFrame - 1)));
  const post = aggregateVelocity(getRiderMetered(rawEngine, gap.endFrame + 1));
  const targetContactLineIds = new Set<number>();
  const rawTargetZeroFrictionUpdates = targetZeroFrictionUpdates(rawEngine, gap.endFrame, new Set(raw.lines.map((line) => line.id)), targetContactLineIds);
  const stateReadFrames = getSimFrames() - beforeState;
  if (pre === null || post === null) {
    return unavailableTrial(raw, rawMetrics, "missing_three_point_velocity", rawTargetZeroFrictionUpdates, stateReadFrames);
  }
  const transport = realizeNativeCaptureImpulseSuffix(raw.lines, targetContactLineIds, { preVelocity: pre, postVelocity: post });
  if (transport.status !== "ready") {
    return unavailableTrial(raw, rawMetrics, transport.reason, rawTargetZeroFrictionUpdates, stateReadFrames);
  }
  const fullTerminalDisplacementPx = Math.hypot(
    transport.terminalDisplacement.x,
    transport.terminalDisplacement.y,
  );
  const doses = DOSES.map((dose): DoseTrial => {
    const lines = dose === 1 ? transport.lines : blendLines(raw.lines, transport.lines, dose);
    const beforeEvaluation = getSimFrames();
    const fit = tryCandidateLines(
      node.search.prefixEngine, gap, lines, node.search.prefixNextLineId,
      setup.ctx.allContactFrames, axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
      setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets, true, "normal",
      getCandidateProbe(node.search.prefixEngine, gap, setup.ctx).preTargetSledTrace,
    ) as Candidate | null;
    const evaluationFrames = getSimFrames() - beforeEvaluation;
    const transportedTargetZeroFrictionUpdates = fit === null
      ? null
      : targetZeroFrictionUpdates(
        node.search.prefixEngine.addLine(fit.lines.map(engineLineFromTrackLine)), gap.endFrame,
        new Set(fit.lines.map((line) => line.id)), new Set<number>(),
      );
    return {
      dose,
      transported: fit === null ? null : metrics(node, gap, setup, fit),
      transportedTargetZeroFrictionUpdates,
      targetTopologyPreserved: transportedTargetZeroFrictionUpdates === null
        ? null
        : transportedTargetZeroFrictionUpdates === rawTargetZeroFrictionUpdates,
      evaluationFrames,
      terminalDisplacementPx: fullTerminalDisplacementPx * dose,
    };
  });
  const primary = doses.find((trial) => trial.dose === 1) ?? doses[doses.length - 1]!;
  return {
    attempt: raw.sampleAttempt ?? -1,
    raw: rawMetrics,
    availability: null,
    lastTargetContactIndex: transport.lastTargetContactIndex,
    rawTargetZeroFrictionUpdates,
    transported: primary.transported,
    transportedTargetZeroFrictionUpdates: primary.transportedTargetZeroFrictionUpdates,
    targetTopologyPreserved: primary.targetTopologyPreserved,
    stateReadFrames,
    evaluationFrames: doses.reduce((sum, trial) => sum + trial.evaluationFrames, 0),
    impulse: transport.impulse,
    terminalDisplacementPx: fullTerminalDisplacementPx,
    doses,
  };
}

function unavailableTrial(raw: Candidate, rawMetrics: Metrics, reason: string, rawUpdates: number, stateReadFrames: number): Trial {
  return {
    attempt: raw.sampleAttempt ?? -1, raw: rawMetrics, availability: reason, lastTargetContactIndex: null,
    rawTargetZeroFrictionUpdates: rawUpdates, transported: null, transportedTargetZeroFrictionUpdates: null,
    targetTopologyPreserved: null, stateReadFrames, evaluationFrames: 0, impulse: null, terminalDisplacementPx: null,
    doses: [],
  };
}

function targetZeroFrictionUpdates(engine: any, frame: number, ids: ReadonlySet<number>, outLineIds: Set<number>): number {
  const updates = engine.getUpdatesAtFrame(frame);
  if (!Array.isArray(updates)) return 0;
  let count = 0;
  for (const update of updates) {
    const lineId = (update as { id?: unknown }).id;
    const points = (update as { updated?: unknown }).updated;
    if (typeof lineId !== "number" || !ids.has(lineId) || !Array.isArray(points)) continue;
    const hits = points.map((point) => (point as { id?: unknown } | null)?.id)
      .filter((point): point is string => typeof point === "string" && ZERO_FRICTION_POINTS.has(point));
    if (hits.length > 0) outLineIds.add(lineId);
    count += hits.length;
  }
  return count;
}

function aggregateVelocity(rider: any): { x: number; y: number } | null {
  const velocities = [...ZERO_FRICTION_POINTS].map((name) => rider?.get?.(name)?.vel ?? rider?.get?.(name)?.velocity)
    .filter((velocity): velocity is { x: number; y: number } =>
      typeof velocity?.x === "number" && Number.isFinite(velocity.x) &&
      typeof velocity?.y === "number" && Number.isFinite(velocity.y));
  if (velocities.length !== ZERO_FRICTION_POINTS.size) return null;
  return velocities.reduce((sum, velocity) => ({ x: sum.x + velocity.x / velocities.length, y: sum.y + velocity.y / velocities.length }), { x: 0, y: 0 });
}

function metrics(node: HandoffNode, gap: Gap, setup: Setup, candidate: Candidate): Metrics {
  const targets = setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const achieved = candidate.achieved;
  const errors = Object.entries(targets).flatMap(([axis, target]) => {
    const value = achieved[axis as keyof AxisValues];
    return typeof target === "number" && typeof value === "number" && Number.isFinite(value) ? [(value - target) ** 2] : [];
  });
  return {
    axisRms: errors.length === 0 ? Infinity : round(Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length)),
    objective: nullable(candidateQualityObjective(node.search.prefixEngine, candidate, gap, setup.gaps, setup.ctx)),
    cost: round(candidate.cost),
  };
}

function summarizeTrials(trials: readonly Trial[]) {
  const ready = trials.filter((trial) => trial.availability === null);
  const preserved = ready.filter((trial) => trial.targetTopologyPreserved === true && trial.transported !== null);
  const rawReady = ready.map((trial) => trial.raw);
  const transported = preserved.map((trial) => trial.transported!);
  return {
    rawViable: trials.length,
    fieldAvailable: ready.length,
    topologyChanged: ready.filter((trial) => trial.targetTopologyPreserved === false).length,
    transportedViableWithRawTopology: preserved.length,
    rawReadyBestAxisRms: minimum(rawReady.map((metric) => metric.axisRms)),
    transportedBestAxisRms: minimum(transported.map((metric) => metric.axisRms)),
    rawReadyBestObjective: maximum(rawReady.map((metric) => metric.objective)),
    transportedBestObjective: maximum(transported.map((metric) => metric.objective)),
    meanTerminalDisplacementPx: nullableMean(ready.map((trial) => trial.terminalDisplacementPx)),
    stateReadFrames: trials.reduce((sum, trial) => sum + trial.stateReadFrames, 0),
    evaluationFrames: trials.reduce((sum, trial) => sum + trial.evaluationFrames, 0),
    byDose: Object.fromEntries(DOSES.map((dose) => [String(dose), summarizeDose(trials, dose)])),
  };
}

function summarizeDose(trials: readonly Trial[], dose: number) {
  const variants = trials.flatMap((trial) => {
    const variant = trial.doses.find((candidate) => candidate.dose === dose);
    return variant === undefined ? [] : [{ raw: trial.raw, variant }];
  });
  const preserved = variants.filter(({ variant }) =>
    variant.targetTopologyPreserved === true && variant.transported !== null
  );
  const objectivePairs = preserved.filter(({ raw, variant }) =>
    raw.objective !== null && variant.transported!.objective !== null
  );
  return {
    fieldAvailable: variants.length,
    topologyChanged: variants.filter(({ variant }) => variant.targetTopologyPreserved === false).length,
    transportedViableWithRawTopology: preserved.length,
    axisRmsImproved: preserved.filter(({ raw, variant }) =>
      variant.transported!.axisRms < raw.axisRms
    ).length,
    objectiveImproved: objectivePairs.filter(({ raw, variant }) =>
      variant.transported!.objective! > raw.objective!
    ).length,
    bothImproved: objectivePairs.filter(({ raw, variant }) =>
      variant.transported!.axisRms < raw.axisRms &&
      variant.transported!.objective! > raw.objective!
    ).length,
    meanAxisRmsImprovement: nullableMean(preserved.map(({ raw, variant }) =>
      raw.axisRms - variant.transported!.axisRms
    )),
    meanObjectiveImprovement: nullableMean(objectivePairs.map(({ raw, variant }) =>
      variant.transported!.objective! - raw.objective!
    )),
    bestAxisRms: minimum(preserved.map(({ variant }) => variant.transported!.axisRms)),
    bestObjective: maximum(preserved.map(({ variant }) => variant.transported!.objective)),
  };
}

function summarizeRows(rows: readonly Row[]) {
  return {
    states: rows.length,
    exactRawReplays: rows.filter((row) => row.replayEquivalent === true).length,
    rawViable: rows.reduce((sum, row) => sum + row.rawViable, 0),
    fieldAvailable: rows.reduce((sum, row) => sum + row.summary.fieldAvailable, 0),
    topologyChanged: rows.reduce((sum, row) => sum + row.summary.topologyChanged, 0),
    transportedViableWithRawTopology: rows.reduce((sum, row) => sum + row.summary.transportedViableWithRawTopology, 0),
    byDose: Object.fromEntries(DOSES.map((dose) => [
      String(dose),
      summarizeDose(rows.flatMap((row) => row.trials), dose),
    ])),
    bySource: Object.fromEntries(CASES.map((definition) => [definition.id, rows.filter((row) => row.id === definition.id).map((row) => row.summary)])),
  };
}

function blendLines(
  raw: readonly TrackLine[],
  transported: readonly TrackLine[],
  dose: number,
): TrackLine[] {
  if (raw.length !== transported.length) throw new Error("transport changed line count");
  return raw.map((line, index) => {
    const target = transported[index]!;
    return {
      ...line,
      x1: line.x1 + (target.x1 - line.x1) * dose,
      y1: line.y1 + (target.y1 - line.y1) * dose,
      x2: line.x2 + (target.x2 - line.x2) * dose,
      y2: line.y2 + (target.y2 - line.y2) * dose,
    };
  });
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
      candidates: record.sampleOrder.map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, hash: geometryHash(candidate.lines) })),
    });
    return;
  }
  if (record.nCand > prior.count) {
    prior.candidates.push(...record.sampleOrder
      .filter((candidate) => (candidate.sampleAttempt ?? -1) >= prior.count)
      .map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, hash: geometryHash(candidate.lines) })));
    prior.count = record.nCand;
  }
}

function compareRawReplay(expected: readonly { attempt: number; hash: string }[], actual: readonly Candidate[]): { ok: boolean; message: string } {
  const left = [...expected].sort((a, b) => a.attempt - b.attempt);
  const right = actual.map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, hash: geometryHash(candidate.lines) }))
    .sort((a, b) => a.attempt - b.attempt);
  if (left.length !== right.length) return { ok: false, message: `raw viable count ${right.length} differs from generation-time ${left.length}` };
  for (let index = 0; index < left.length; index++) {
    if (left[index]!.attempt !== right[index]!.attempt || left[index]!.hash !== right[index]!.hash) {
      return { ok: false, message: `raw hash mismatch at viable index ${index}` };
    }
  }
  return { ok: true, message: "production raw normal attempt and coordinate-plus-side hashes replay exactly" };
}

function geometryHash(lines: readonly TrackLine[]): string {
  return createHash("sha256").update(JSON.stringify(lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2), Boolean(line.flipped),
  ]))).digest("hex");
}

function checkpointIndices(gaps: readonly Gap[]): Map<number, "one_third" | "two_thirds"> {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  const first = contacts[Math.floor((contacts.length - 1) / 3)];
  const second = contacts[Math.floor((2 * (contacts.length - 1)) / 3)];
  if (first === undefined || second === undefined || first === second) throw new Error("dense source lacks distinct frontier checkpoints");
  return new Map([[first, "one_third"], [second, "two_thirds"]]);
}

function buildSetup(source: Spec, seed: number): Setup {
  const spec: Spec = { ...source, preroll: undefined, contacts: source.contacts.filter((contact) => secToFrame(contact.t) >= 5) };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((left, right) => left - right);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impacts = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impacts.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const current = gaps[index]!;
    const next = gaps[index + 1]!;
    if (current.endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      current.nextImpact = next.targets.impact;
    }
  }
  return {
    gaps,
    ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets, gaps },
  };
}

function minimum(values: readonly number[]): number | null { return values.length === 0 ? null : round(Math.min(...values)); }
function maximum(values: readonly (number | null)[]): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length === 0 ? null : round(Math.max(...finite));
}
function nullableMean(values: readonly (number | null)[]): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length === 0 ? null : round(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}
function nullable(value: number | null): number | null { return value === null || !Number.isFinite(value) ? null : round(value); }
function round(value: number): number { return Number(value.toFixed(6)); }
