/**
 * Latent-response error decomposition (read-only; consumes a JSONL dump from
 * study_joint_arc_model.ts --out).
 *
 * Question (docs/ARC_AIMING_FORMALIZATION.md, "Response Target"): is fitting
 * `knobs -> exit latents` and reducing afterward better or worse than fitting
 * the reducer-completed final outputs directly — and WHERE does each lose?
 * Both paths share the same short probe; the difference is only where the
 * fast-physics reducer sits relative to the fit.
 *
 * For each held-out eval row with full-sim truth, four pipelines:
 *
 *   direct        : fit(finals)            -> prediction        (outputs mode)
 *   latent_total  : reduce(fit(latents))   -> prediction        (latent mode)
 *   reduce_truth  : reduce(MEASURED latents)                    (reducer alone)
 *   latent_fit    : fit(latents) vs measured latents            (fit layer alone)
 *
 * Error identity per output:
 *   latent_total - truth = [reduce(L_pred) - reduce(L_meas)]   (fit error, amplified)
 *                        + [reduce(L_meas) - truth]            (reducer/summarization error)
 *
 * Buckets: clean vs dirty airborne suffix, gate-clean vs gate-failed rows,
 * and pitch at/inside the probe boundary — the circumstances where the two
 * response targets could differ.
 *
 * Run (after producing dumps):
 *   npm run study:joint-arc -- ... --out=generated/analysis/latent_decomp_cross5.jsonl
 *   node --import tsx scripts/v0/study_latent_decomposition.ts \
 *     generated/analysis/latent_decomp_cross5.jsonl
 */
import { readFileSync } from "node:fs";
import {
  fitJointArcResponseModel,
  isArcAngleOutput,
  normalizeAngleDeg,
  predictJointArcOutputs,
  reduceLatentJointArcOutputs,
  type ArcKnobs,
  type ArcProbeDesignName,
  type JointArcProbeRow,
  type JointArcResponseContext,
} from "./optimizer/arc_model.ts";

type SampleRow = {
  kind: string;
  spec: string;
  seed: number;
  gapIndex: number;
  split: "probe" | "eval";
  pitchDeg: number;
  rotateDeg: number;
  gate: { currentOk: boolean; nextStateOk: boolean };
  outputs: Record<string, number>;
  latentOutputs?: Record<string, number>;
  truthOutputs?: Record<string, number>;
  cleanAirborneSuffix: boolean | null;
  modelContext: JointArcResponseContext;
};

const path = process.argv[2];
if (!path) {
  console.error("usage: study_latent_decomposition.ts <dump.jsonl from study_joint_arc_model --out>");
  process.exit(1);
}

const lines = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const config = lines.find((l) => l.kind === "config");
const probeDesign: ArcProbeDesignName = config?.probeDesign ?? "cross5";
const rows = lines.filter((l): l is SampleRow => l.kind === "sample");

const PITCH_SPANS: Record<ArcProbeDesignName, number> = { cross5: 8.5, grid9: 9 };
const pitchSpan = PITCH_SPANS[probeDesign];

/** Outputs the reducer can derive (plus their error twins); everything else is
 *  direct-fallback in latent mode and identical between pipelines. */
const REDUCED_OUTPUTS = [
  "current.axis.air",
  "current.axis.speed",
  "current.axis.elevation",
  "next.x",
  "next.y",
  "next.vx",
  "next.vy",
  "next.speed",
  "next.comAngleDeg",
  "next.sledPoseDeg",
  "next.sledPoseRateDegPerFrame",
] as const;

const LATENT_KEYS = [
  "latent.suffix.frame",
  "latent.suffix.x",
  "latent.suffix.y",
  "latent.suffix.vx",
  "latent.suffix.vy",
  "latent.suffix.sledPoseDeg",
  "latent.suffix.sledPoseRateDegPerFrame",
  "latent.prefix.airFraction",
  "latent.prefix.speedMeanPx",
  "latent.prefix.dy",
  "latent.prefix.v0SpeedPx",
] as const;

type Pipeline = "direct" | "latent_total" | "reduce_truth" | "fit_amplified";
type Bucket = "all" | "clean" | "dirty" | "gate_ok" | "gate_fail" | "pitch_boundary" | "pitch_inner";
const samples = new Map<string, number[]>();

function add(pipeline: Pipeline | "latent_fit", bucket: Bucket, output: string, abs: number): void {
  const key = `${pipeline}\0${bucket}\0${output}`;
  const xs = samples.get(key) ?? [];
  xs.push(abs);
  samples.set(key, xs);
}

function absErr(output: string, pred: number | undefined, actual: number | undefined): number | null {
  if (pred === undefined || actual === undefined || !Number.isFinite(pred) || !Number.isFinite(actual)) return null;
  return Math.abs(isArcAngleOutput(output) ? normalizeAngleDeg(pred - actual) : pred - actual);
}

function bucketsOf(row: SampleRow): Bucket[] {
  const out: Bucket[] = ["all"];
  out.push(row.cleanAirborneSuffix === true ? "clean" : "dirty");
  out.push(row.gate.currentOk ? "gate_ok" : "gate_fail");
  out.push(Math.abs(row.pitchDeg) >= 0.8 * pitchSpan ? "pitch_boundary" : "pitch_inner");
  return out;
}

const groups = new Map<string, SampleRow[]>();
for (const row of rows) {
  const key = `${row.spec}\0${row.seed}\0${row.gapIndex}`;
  const xs = groups.get(key) ?? [];
  xs.push(row);
  groups.set(key, xs);
}

let evalRows = 0;
let groupsUsed = 0;
for (const groupRows of groups.values()) {
  const probeRows: JointArcProbeRow[] = groupRows
    .filter((r) => r.split === "probe")
    .map((r) => ({
      knobs: { pitchDeg: r.pitchDeg, rotateDeg: r.rotateDeg },
      outputs: r.outputs,
      ...(r.latentOutputs === undefined ? {} : { latentOutputs: r.latentOutputs }),
    }));
  if (probeRows.length === 0) continue;
  const context = groupRows[0].modelContext;
  const direct = fitJointArcResponseModel(probeRows, probeDesign, "hybrid", { responseMode: "outputs" });
  const latent = fitJointArcResponseModel(probeRows, probeDesign, "hybrid", { responseMode: "latent", context });
  groupsUsed++;

  for (const row of groupRows) {
    if (row.split !== "eval" || row.truthOutputs === undefined) continue;
    evalRows++;
    const knobs: ArcKnobs = { pitchDeg: row.pitchDeg, rotateDeg: row.rotateDeg };
    const buckets = bucketsOf(row);
    const directPred = predictJointArcOutputs(direct, knobs);
    const latentPred = predictJointArcOutputs(latent, knobs);
    const reduceTruth = row.latentOutputs === undefined
      ? {}
      : reduceLatentJointArcOutputs(row.latentOutputs, context);

    for (const output of REDUCED_OUTPUTS) {
      const truth = row.truthOutputs[output];
      for (const bucket of buckets) {
        const eDirect = absErr(output, directPred[output], truth);
        if (eDirect !== null) add("direct", bucket, output, eDirect);
        const eTotal = absErr(output, latentPred[output], truth);
        if (eTotal !== null) add("latent_total", bucket, output, eTotal);
        const eReduce = absErr(output, reduceTruth[output], truth);
        if (eReduce !== null) add("reduce_truth", bucket, output, eReduce);
        const eAmp = absErr(output, latentPred[output], reduceTruth[output]);
        if (eAmp !== null) add("fit_amplified", bucket, output, eAmp);
      }
    }

    // Fit quality on the latent layer itself: predicted latents vs the row's
    // MEASURED latents, key by key.
    if (row.latentOutputs !== undefined) {
      for (const key of LATENT_KEYS) {
        const meas = row.latentOutputs[key];
        if (!Number.isFinite(meas)) continue;
        const fitted = latent.latentModels.get(key);
        if (fitted === undefined) continue;
        // absErr wraps angle differences, so no unwrap needed for magnitude.
        const e = absErr(key, fitted.model.predict(knobs), meas);
        if (e === null) continue;
        for (const bucket of buckets) add("latent_fit", bucket, key, e);
      }
    }
  }
}

function mean(xs: number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function pctl(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
function fmt(x: number): string {
  return Number.isFinite(x) ? (Math.abs(x) >= 100 ? x.toFixed(1) : x.toFixed(3)) : "n/a";
}
function cell(pipeline: string, bucket: Bucket, output: string): string {
  const xs = samples.get(`${pipeline}\0${bucket}\0${output}`) ?? [];
  return xs.length === 0 ? "n/a" : `${fmt(mean(xs))}`;
}

console.log(`=== latent decomposition · ${path}`);
console.log(`probe=${probeDesign} groups=${groupsUsed} eval_truth_rows=${evalRows}\n`);

console.log("MAE vs full-sim truth per pipeline (all eval rows)");
console.log("output                          direct  latent_total  reduce_truth  fit_amplified");
for (const output of REDUCED_OUTPUTS) {
  console.log(
    `${output.padEnd(30)} ${cell("direct", "all", output).padStart(7)}` +
      ` ${cell("latent_total", "all", output).padStart(12)}` +
      ` ${cell("reduce_truth", "all", output).padStart(12)}` +
      ` ${cell("fit_amplified", "all", output).padStart(13)}`,
  );
}

console.log("\nWhere the pipelines differ — MAE vs truth by bucket (direct | latent_total)");
console.log("output                          clean         dirty         gate_ok       gate_fail     pitch_inner   pitch_boundary");
for (const output of REDUCED_OUTPUTS) {
  const pair = (b: Bucket): string => `${cell("direct", b, output)}|${cell("latent_total", b, output)}`;
  console.log(
    `${output.padEnd(30)} ${pair("clean").padStart(13)} ${pair("dirty").padStart(13)}` +
      ` ${pair("gate_ok").padStart(13)} ${pair("gate_fail").padStart(13)}` +
      ` ${pair("pitch_inner").padStart(13)} ${pair("pitch_boundary").padStart(14)}`,
  );
}

console.log("\nLatent-layer fit quality (predicted vs measured latents, all eval rows)");
console.log("latent key                                MAE        p90");
for (const key of LATENT_KEYS) {
  const xs = samples.get(`latent_fit\0all\0${key}`) ?? [];
  console.log(`${key.padEnd(40)} ${fmt(mean(xs)).padStart(8)} ${fmt(pctl(xs, 0.9)).padStart(10)}`);
}
