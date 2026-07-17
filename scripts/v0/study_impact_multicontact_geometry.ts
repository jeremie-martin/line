/**
 * Fixed, observation-only decomposition of the multi-contact geometry behind
 * same-speed impact repairs.  It never changes the compiler: candidate line
 * and engine reads are deferred until each complete search has returned.
 *
 *   LR_ENGINE=wasm node --expose-gc --import tsx \
 *     scripts/v0/study_impact_multicontact_geometry.ts [--out=PATH]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import denseDialogueImpact from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import lowAir from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import offgrid from "../../benchmark/v2/cases/normative/representative/offgrid_conversation.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeContactGeometry,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import type { AxisName, AxisValues, Spec } from "./types.ts";

const BUDGET = 500_000;
const SEEDS = [28, 29] as const;
const MATERIAL_IMPACT_GAIN = 0.025;
const AXES: readonly AxisName[] = ["impact", "speed", "air", "elevation"];
const ZERO_FRICTION_POINTS = ["TAIL", "NOSE", "STRING"] as const;

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
    "Usage: study_impact_multicontact_geometry.ts [--out=PATH]\n" +
      "Runs the fixed 6-case x 2-seed V2-jolt/500k deferred multi-contact geometry diagnostic. Observation only.\n",
  );
  process.exit(0);
}
const outPath = argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length);
const unknown = argv.filter((arg) => !arg.startsWith("--out="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

type CandidatePoint = {
  candidate: HandoffPoolProbeCandidate;
  impactError: number;
  speedError: number;
};

type GeometryMetrics = {
  meanClearance: number;
  maxClearance: number;
  tangentSpanDeg: number;
  velocityMismatchDeg: number | null;
  bodyChordMismatchDeg: number;
  targetSledPointCoverage: number;
  targetSledUpdateCount: number;
};

type PairRow = {
  id: string;
  role: "impact" | "guard";
  regime: string;
  seed: number;
  gapIndex: number;
  impactGain: number;
  speedCost: number;
  selected: GeometryMetrics | null;
  repair: GeometryMetrics | null;
};

type DeferredPair = {
  id: string;
  role: "impact" | "guard";
  regime: string;
  seed: number;
  gapIndex: number;
  impactGain: number;
  speedCost: number;
  selectedRank: number;
  repairRank: number;
  read: HandoffPoolProbeRecord["contactGeometryAtQualityRank"];
};

type RunRow = {
  id: string;
  seed: number;
  elapsedMs: number;
};

let active: typeof CASES[number] = CASES[0]!;
let activeSeed: typeof SEEDS[number] = SEEDS[0]!;
const deferred: DeferredPair[] = [];
const pairs: PairRow[] = [];
const runs: RunRow[] = [];

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
  schema: "line.study-impact-multicontact-geometry.v1",
  purpose: "fixed post-completion observation of exact candidate geometry and sled state; not a compiler source, selector, or promotion result",
  fixedConfig: {
    budget: BUDGET,
    seeds: [...SEEDS],
    joltMs: benchmarkPolicy.transform.joltMs,
    materialImpactGain: MATERIAL_IMPACT_GAIN,
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
const resolvedOutPath = outPath ?? "generated/studies/impact-multicontact-geometry/v1/result.json";
mkdirSync(dirname(resolvedOutPath), { recursive: true });
writeFileSync(resolvedOutPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: resolvedOutPath, summary: output.summary }, null, 2)}\n`);

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
    read: record.contactGeometryAtQualityRank,
  });
}

function resolveDeferredPairs(): void {
  for (const trace of deferred.splice(0)) {
    const selected = trace.read(trace.selectedRank);
    const repair = trace.read(trace.repairRank);
    pairs.push({
      id: trace.id,
      role: trace.role,
      regime: trace.regime,
      seed: trace.seed,
      gapIndex: trace.gapIndex,
      impactGain: trace.impactGain,
      speedCost: trace.speedCost,
      selected: selected === null ? null : geometryMetrics(selected),
      repair: repair === null ? null : geometryMetrics(repair),
    });
  }
}

function candidatePoint(
  candidate: HandoffPoolProbeCandidate,
  targets: AxisValues,
  axes: readonly AxisName[],
): CandidatePoint[] {
  if (!finite(candidate.handoffScore)) return [];
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors: Partial<Record<AxisName, number>> = {};
  for (const axis of axes) {
    const target = targets[axis];
    const value = achieved[axis];
    if (!finite(target) || !finite(value)) return [];
    errors[axis] = Math.abs(value - target);
  }
  return [{
    candidate,
    impactError: errors.impact!,
    speedError: errors.speed!,
  }];
}

function geometryMetrics(observation: HandoffPoolProbeContactGeometry): GeometryMetrics | null {
  const pointMetrics = ZERO_FRICTION_POINTS.map((name) => {
    const point = observation.points[name];
    return point === undefined ? null : nearestLine(point.x, point.y, observation.lines);
  });
  if (pointMetrics.some((metric) => metric === null)) return null;
  const nearest = pointMetrics as Array<{ clearance: number; tangentDeg: number }>;
  const chordTail = observation.points.TAIL!;
  const chordNose = observation.points.NOSE!;
  const chordAngle = Math.atan2(chordNose.y - chordTail.y, chordNose.x - chordTail.x) * 180 / Math.PI;
  const velocities = ZERO_FRICTION_POINTS.map((name) => observation.points[name]!)
    .filter((point) => point.vx !== null && point.vy !== null);
  const meanVelocityAngle = velocities.length === ZERO_FRICTION_POINTS.length
    ? Math.atan2(
      velocities.reduce((sum, point) => sum + point.vy!, 0),
      velocities.reduce((sum, point) => sum + point.vx!, 0),
    ) * 180 / Math.PI
    : null;
  const sledPointIds = new Set(ZERO_FRICTION_POINTS);
  const contacted = observation.targetContacts.flatMap((contact) => contact.pointIds)
    .filter((point) => sledPointIds.has(point as typeof ZERO_FRICTION_POINTS[number]));
  return {
    meanClearance: round(mean(nearest.map((metric) => metric.clearance))),
    maxClearance: round(Math.max(...nearest.map((metric) => metric.clearance))),
    tangentSpanDeg: round(unorientedSpan(nearest.map((metric) => metric.tangentDeg))),
    velocityMismatchDeg: meanVelocityAngle === null
      ? null
      : round(mean(nearest.map((metric) => unorientedDelta(metric.tangentDeg, meanVelocityAngle)))),
    bodyChordMismatchDeg: round(mean(nearest.map((metric) => unorientedDelta(metric.tangentDeg, chordAngle)))),
    targetSledPointCoverage: new Set(contacted).size,
    targetSledUpdateCount: contacted.length,
  };
}

function nearestLine(
  x: number,
  y: number,
  lines: HandoffPoolProbeContactGeometry["lines"],
): { clearance: number; tangentDeg: number } | null {
  let best: { clearance: number; tangentDeg: number } | null = null;
  for (const line of lines) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const lengthSquared = dx * dx + dy * dy;
    if (!finite(lengthSquared) || lengthSquared <= 1e-12) continue;
    const t = Math.max(0, Math.min(1, ((x - line.x1) * dx + (y - line.y1) * dy) / lengthSquared));
    const clearance = Math.hypot(x - (line.x1 + t * dx), y - (line.y1 + t * dy));
    if (best === null || clearance < best.clearance) {
      best = { clearance, tangentDeg: Math.atan2(dy, dx) * 180 / Math.PI };
    }
  }
  return best;
}

function summarizePairs(rows: PairRow[]) {
  return {
    materialPairs: rows.length,
    geometryAvailable: rows.filter((row) => row.selected !== null && row.repair !== null).length,
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

function summarizeGroup(rows: PairRow[]) {
  const complete = rows.filter((row): row is PairRow & { selected: GeometryMetrics; repair: GeometryMetrics } =>
    row.selected !== null && row.repair !== null);
  const metrics: Array<keyof GeometryMetrics> = [
    "meanClearance",
    "maxClearance",
    "tangentSpanDeg",
    "velocityMismatchDeg",
    "bodyChordMismatchDeg",
    "targetSledPointCoverage",
    "targetSledUpdateCount",
  ];
  const paired = Object.fromEntries(metrics.map((key) => {
    const values = complete.flatMap((row) => {
      const selected = row.selected[key];
      const repair = row.repair[key];
      return typeof selected === "number" && typeof repair === "number" ? [[selected, repair] as const] : [];
    });
    return [key, {
      samples: values.length,
      selectedMean: values.length === 0 ? null : round(mean(values.map(([selected]) => selected))),
      repairMean: values.length === 0 ? null : round(mean(values.map(([, repair]) => repair))),
      repairMinusSelectedMean: values.length === 0 ? null : round(mean(values.map(([selected, repair]) => repair - selected))),
    }];
  }));
  return {
    materialPairs: rows.length,
    geometryAvailable: complete.length,
    impactGainMean: rows.length === 0 ? null : round(mean(rows.map((row) => row.impactGain))),
    speedCostMean: rows.length === 0 ? null : round(mean(rows.map((row) => row.speedCost))),
    paired,
  };
}

function unorientedSpan(angles: readonly number[]): number {
  let span = 0;
  for (let left = 0; left < angles.length; left++) {
    for (let right = left + 1; right < angles.length; right++) {
      span = Math.max(span, unorientedDelta(angles[left]!, angles[right]!));
    }
  }
  return span;
}

function unorientedDelta(left: number, right: number): number {
  let delta = (left - right) % 180;
  if (delta < -90) delta += 180;
  if (delta > 90) delta -= 180;
  return Math.abs(delta);
}

function minBy<T>(values: readonly T[], metric: (value: T) => number): T {
  return values.reduce((best, value) => metric(value) < metric(best) ? value : best);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
