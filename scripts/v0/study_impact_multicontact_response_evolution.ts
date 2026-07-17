/**
 * Fixed observation of the exact full-sled response evolution behind
 * same-speed impact repairs. It is deliberately post-completion and cannot
 * change candidate generation, ranking, or compiler output.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import lowAir from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import denseDialogueImpact from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import offgrid from "../../benchmark/v2/cases/normative/representative/offgrid_conversation.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeContactResponse,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import type { AxisName, AxisValues, Spec } from "./types.ts";

const BUDGET = 500_000;
const SEEDS = [28, 29] as const;
const MATERIAL_IMPACT_GAIN = .025;
const AXES: readonly AxisName[] = ["impact", "speed", "air", "elevation"];
const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

const CASES = [
  { id: "frontier_dense_recovery", role: "impact", regime: "capability_dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", role: "impact", regime: "representative_dense", spec: denseDialogueImpact },
  { id: "countercurrent", role: "impact", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", role: "impact", regime: "development_music", spec: believer },
  { id: "frontier_low_air_endurance_4s", role: "guard", regime: "capability_low_air", spec: lowAir },
  { id: "offgrid_conversation", role: "guard", regime: "representative_pickup", spec: offgrid },
] as const satisfies readonly { id: string; role: "impact" | "guard"; regime: string; spec: Spec }[];

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_impact_multicontact_response_evolution.ts [--out=PATH]\n" +
      "Runs the fixed 6-case x 2-seed deferred full-sled response evolution diagnostic. Observation only.\n",
  );
  process.exit(0);
}
const outPath = argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length) ??
  "generated/studies/impact-multicontact-response-evolution/v1/result.json";
const unknown = argv.filter((arg) => !arg.startsWith("--out="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

type CandidatePoint = { candidate: HandoffPoolProbeCandidate; impactError: number; speedError: number };
type ResponseMetrics = {
  rigidRotationDeg: number;
  pairDistanceRmsChangePx: number;
  collectiveSpeedChange: number | null;
  collectiveVelocityTurnDeg: number | null;
  sledContactFrames: number;
  sledUpdateCount: number;
  sledPointCoverage: number;
};
type PairRow = {
  id: string;
  role: "impact" | "guard";
  regime: string;
  seed: number;
  gapIndex: number;
  impactGain: number;
  speedCost: number;
  selected: ResponseMetrics | null;
  repair: ResponseMetrics | null;
};
type DeferredPair = Omit<PairRow, "selected" | "repair"> & {
  selectedRank: number;
  repairRank: number;
  read: HandoffPoolProbeRecord["contactResponseAtQualityRank"];
};

let active: typeof CASES[number] = CASES[0]!;
let activeSeed: typeof SEEDS[number] = SEEDS[0]!;
const deferred: DeferredPair[] = [];
const pairs: PairRow[] = [];
const runs: Array<{ id: string; seed: number; elapsedMs: number }> = [];

setHandoffPoolProbeHook((record) => observePool(record));
try {
  for (const definition of CASES) {
    for (const seed of SEEDS) {
      active = definition;
      activeSeed = seed;
      const started = performance.now();
      compileHandoff(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed, { budget: BUDGET });
      resolveDeferredPairs();
      const elapsedMs = Math.round(performance.now() - started);
      runs.push({ id: definition.id, seed, elapsedMs });
      process.stderr.write(`${definition.id}/s${seed}: pairs=${pairs.length} (${(elapsedMs / 1000).toFixed(1)}s)\n`);
      (globalThis as { gc?: () => void }).gc?.();
    }
  }
} finally {
  setHandoffPoolProbeHook(null);
}

const compiler = compilerCandidateIdentity(process.env.LR_ENGINE ?? "wasm");
const output = {
  schema: "line.study-impact-multicontact-response-evolution.v1",
  purpose: "fixed post-completion observation of exact candidate-resolved full-sled response evolution; not a compiler source, selector, or promotion result",
  fixedConfig: {
    budget: BUDGET,
    seeds: [...SEEDS],
    joltMs: benchmarkPolicy.transform.joltMs,
    materialImpactGain: MATERIAL_IMPACT_GAIN,
    responseWindow: "H..H+6 inclusive",
    cases: CASES.map(({ id, role, regime }) => ({ id, role, regime })),
  },
  execution: {
    compilerCandidateFingerprint: compiler.candidateFingerprint,
    compilerSourceFingerprint: compiler.compilerSourceFingerprint,
    engine: process.env.LR_ENGINE ?? "wasm",
  },
  runs,
  pairs,
  summary: summarizePairs(pairs),
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: outPath, summary: output.summary }, null, 2)}\n`);

function observePool(record: HandoffPoolProbeRecord): void {
  const authored = AXES.filter((axis) => finite(record.targets[axis]));
  if (!authored.includes("impact") || !authored.includes("speed")) return;
  const points = record.candidates.flatMap((candidate) => candidatePoint(candidate, record.targets, authored));
  if (points.length === 0) return;
  const selected = minBy(points, (point) => point.candidate.handoffScore!);
  const repair = points
    .filter((point) => point.speedError <= selected.speedError + 1e-12)
    .sort((left, right) => left.impactError - right.impactError ||
      left.candidate.handoffScore! - right.candidate.handoffScore! ||
      left.candidate.qualityRank - right.candidate.qualityRank)[0];
  if (repair === undefined) return;
  const impactGain = selected.impactError - repair.impactError;
  if (impactGain + 1e-12 < MATERIAL_IMPACT_GAIN) return;
  deferred.push({
    id: active.id,
    role: active.role,
    regime: active.regime,
    seed: activeSeed,
    gapIndex: record.gapIndex,
    impactGain: round(impactGain),
    speedCost: round(repair.speedError - selected.speedError),
    selectedRank: selected.candidate.qualityRank,
    repairRank: repair.candidate.qualityRank,
    read: record.contactResponseAtQualityRank,
  });
}

function resolveDeferredPairs(): void {
  for (const trace of deferred.splice(0)) {
    pairs.push({
      id: trace.id,
      role: trace.role,
      regime: trace.regime,
      seed: trace.seed,
      gapIndex: trace.gapIndex,
      impactGain: trace.impactGain,
      speedCost: trace.speedCost,
      selected: responseMetrics(trace.read(trace.selectedRank)),
      repair: responseMetrics(trace.read(trace.repairRank)),
    });
  }
}

function candidatePoint(candidate: HandoffPoolProbeCandidate, targets: AxisValues, axes: readonly AxisName[]): CandidatePoint[] {
  if (!finite(candidate.handoffScore)) return [];
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors: Partial<Record<AxisName, number>> = {};
  for (const axis of axes) {
    const target = targets[axis];
    const value = achieved[axis];
    if (!finite(target) || !finite(value)) return [];
    errors[axis] = Math.abs(value - target);
  }
  return [{ candidate, impactError: errors.impact!, speedError: errors.speed! }];
}

function responseMetrics(response: HandoffPoolProbeContactResponse | null): ResponseMetrics | null {
  const first = response?.samples[0];
  const last = response?.samples[response.samples.length - 1];
  if (first === undefined || last === undefined) return null;
  const initial = SLED_POINTS.map((name) => first.points[name]);
  const terminal = SLED_POINTS.map((name) => last.points[name]);
  if (initial.some((point) => point === undefined) || terminal.some((point) => point === undefined)) return null;
  const start = initial as Array<NonNullable<typeof initial[number]>>;
  const end = terminal as Array<NonNullable<typeof terminal[number]>>;
  const startCenter = meanPoint(start);
  const endCenter = meanPoint(end);
  let dot = 0;
  let cross = 0;
  for (let index = 0; index < start.length; index++) {
    const px = start[index]!.x - startCenter.x;
    const py = start[index]!.y - startCenter.y;
    const qx = end[index]!.x - endCenter.x;
    const qy = end[index]!.y - endCenter.y;
    dot += px * qx + py * qy;
    cross += px * qy - py * qx;
  }
  const pairs = start.flatMap((point, left) => end.slice(left + 1).map((_other, offset) => {
    const right = left + offset + 1;
    const startDistance = Math.hypot(point.x - start[right]!.x, point.y - start[right]!.y);
    const endDistance = Math.hypot(end[left]!.x - end[right]!.x, end[left]!.y - end[right]!.y);
    return endDistance - startDistance;
  }));
  const startVelocity = meanVelocity(start);
  const endVelocity = meanVelocity(end);
  const contactPointIds = new Set<string>();
  let sledUpdateCount = 0;
  let sledContactFrames = 0;
  for (const sample of response.samples) {
    let frameHasContact = false;
    for (const contact of sample.sledContacts) {
      for (const pointId of contact.pointIds) {
        contactPointIds.add(pointId);
        sledUpdateCount++;
        frameHasContact = true;
      }
    }
    if (frameHasContact) sledContactFrames++;
  }
  return {
    rigidRotationDeg: round(Math.atan2(cross, dot) * 180 / Math.PI),
    pairDistanceRmsChangePx: round(Math.sqrt(mean(pairs.map((value) => value * value)))),
    collectiveSpeedChange: startVelocity === null || endVelocity === null
      ? null
      : round(Math.hypot(endVelocity.x, endVelocity.y) - Math.hypot(startVelocity.x, startVelocity.y)),
    collectiveVelocityTurnDeg: startVelocity === null || endVelocity === null
      ? null
      : round(signedAngleDeg(Math.atan2(startVelocity.y, startVelocity.x) * 180 / Math.PI,
        Math.atan2(endVelocity.y, endVelocity.x) * 180 / Math.PI)),
    sledContactFrames,
    sledUpdateCount,
    sledPointCoverage: contactPointIds.size,
  };
}

function summarizePairs(rows: readonly PairRow[]) {
  return {
    materialPairs: rows.length,
    responseAvailable: rows.filter((row) => row.selected !== null && row.repair !== null).length,
    all: summarizeGroup(rows),
    bySource: Object.fromEntries(CASES.map((definition) => [
      definition.id,
      summarizeGroup(rows.filter((row) => row.id === definition.id)),
    ])),
    byRegime: Object.fromEntries([...new Set(CASES.map((definition) => definition.regime))].map((regime) => [
      regime,
      summarizeGroup(rows.filter((row) => row.regime === regime)),
    ])),
  };
}

function summarizeGroup(rows: readonly PairRow[]) {
  const complete = rows.filter((row): row is PairRow & { selected: ResponseMetrics; repair: ResponseMetrics } =>
    row.selected !== null && row.repair !== null);
  const metrics: Array<keyof ResponseMetrics> = [
    "rigidRotationDeg", "pairDistanceRmsChangePx", "collectiveSpeedChange", "collectiveVelocityTurnDeg",
    "sledContactFrames", "sledUpdateCount", "sledPointCoverage",
  ];
  return {
    materialPairs: rows.length,
    responseAvailable: complete.length,
    impactGainMean: rows.length === 0 ? null : round(mean(rows.map((row) => row.impactGain))),
    speedCostMean: rows.length === 0 ? null : round(mean(rows.map((row) => row.speedCost))),
    paired: Object.fromEntries(metrics.map((metric) => {
      const values = complete.flatMap((row) => {
        const selected = row.selected[metric];
        const repair = row.repair[metric];
        return typeof selected === "number" && typeof repair === "number" ? [[selected, repair] as const] : [];
      });
      return [metric, {
        samples: values.length,
        selectedMean: values.length === 0 ? null : round(mean(values.map(([selected]) => selected))),
        repairMean: values.length === 0 ? null : round(mean(values.map(([, repair]) => repair))),
        repairMinusSelectedMean: values.length === 0 ? null : round(mean(values.map(([selected, repair]) => repair - selected))),
      }];
    })),
  };
}

function meanPoint(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  return { x: mean(points.map((point) => point.x)), y: mean(points.map((point) => point.y)) };
}

function meanVelocity(points: readonly { vx: number | null; vy: number | null }[]): { x: number; y: number } | null {
  if (points.some((point) => point.vx === null || point.vy === null)) return null;
  return {
    x: mean(points.map((point) => point.vx!)),
    y: mean(points.map((point) => point.vy!)),
  };
}

function signedAngleDeg(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta <= -180) delta += 360;
  if (delta > 180) delta -= 360;
  return delta;
}

function minBy<T>(values: readonly T[], metric: (value: T) => number): T {
  return values.reduce((best, value) => metric(value) < metric(best) ? value : best);
}
function mean(values: readonly number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function round(value: number): number { return Number(value.toFixed(6)); }
