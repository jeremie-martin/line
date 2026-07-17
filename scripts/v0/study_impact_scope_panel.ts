/**
 * Impact-undershoot scope panel (study-only, outside the compiler identity
 * boundary). Compiles a fixed cross-regime V2 panel at the benchmark jolt and
 * reports per-source impact/air/speed RMS, signed impact error by ask bucket,
 * and score — so a candidate mechanism (or an LR_ env probe such as
 * LR_IMPACT_LOCAL_W) can be judged on the axis it targets rather than only on
 * the scalar score.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_impact_scope_panel.ts \
 *     [--cases=NAME,...] [--seeds=N,...] [--budget=N] [--out=FILE]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import denseDialogue from "../../benchmark/v2/cases/normative/representative/dense_dialogue.ts";
import denseDialogueIC from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import splitSignal from "../../benchmark/v2/cases/normative/representative/split_signal.ts";
import riverReentry from "../../benchmark/v2/cases/normative/representative/river_reentry.ts";
import openHook from "../../benchmark/v2/cases/normative/representative/open_hook.ts";
import meterExchange from "../../benchmark/v2/cases/normative/representative/meter_exchange.ts";
import loosePocket from "../../benchmark/v2/cases/normative/representative/loose_pocket.ts";
import pickup from "../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import frontier5 from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { scoreDriftReport } from "./score.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { FPS, type Spec } from "./types.ts";

const catalog: Record<string, Spec> = {
  dense_dialogue: denseDialogue,
  dense_dialogue_ic: denseDialogueIC,
  split_signal: splitSignal,
  river_reentry: riverReentry,
  open_hook: openHook,
  meter_exchange: meterExchange,
  loose_pocket: loosePocket,
  pickup,
  dense,
  dense240,
  frontier5,
  believer,
};

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const names = (arg("cases") ?? Object.keys(catalog).join(",")).split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "24").split(",").map(Number);
const budget = Number(arg("budget") ?? "500000");
const out = arg("out");
for (const seed of seeds) if (!Number.isSafeInteger(seed)) throw new Error(`bad seed ${seed}`);
if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`bad budget ${budget}`);

type GapAxisRow = { target: number; achieved: number };

const rows = [] as object[];
for (const name of names) {
  const source = catalog[name];
  if (source === undefined) throw new Error(`unknown case ${name}`);
  for (const seed of seeds) {
    const spec = applyJolt(source, benchmarkPolicy.transform.joltMs);
    const started = performance.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const elapsedMs = Math.round(performance.now() - started);
    const score = scoreDriftReport(checkpoint.report, {
      totalFrames: Math.round(spec.duration * FPS),
    });
    const perAxis: Record<string, GapAxisRow[]> = {};
    for (const gap of checkpoint.report.gaps) {
      const axes = (gap as { axes?: Record<string, { target?: number; achieved?: number }> }).axes;
      if (axes === undefined) continue;
      for (const [axis, detail] of Object.entries(axes)) {
        if (detail?.target === undefined || detail?.achieved === undefined) continue;
        (perAxis[axis] ??= []).push({ target: detail.target, achieved: detail.achieved });
      }
    }
    const axisSummary: Record<string, object> = {};
    for (const [axis, values] of Object.entries(perAxis)) {
      const errors = values.map((row) => row.achieved - row.target);
      const rms = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
      const mean = errors.reduce((sum, e) => sum + e, 0) / errors.length;
      axisSummary[axis] = { n: values.length, rms: round(rms), meanSigned: round(mean) };
    }
    // Signed impact error by ask bucket (0.1 resolution), the undershoot fingerprint.
    const impactBuckets: Record<string, { n: number; meanSigned: number }> = {};
    for (const row of perAxis.impact ?? []) {
      const bucket = (Math.round(row.target * 10) / 10).toFixed(1);
      const entry = (impactBuckets[bucket] ??= { n: 0, meanSigned: 0 });
      entry.n += 1;
      entry.meanSigned += row.achieved - row.target;
    }
    for (const entry of Object.values(impactBuckets)) {
      entry.meanSigned = round(entry.meanSigned / entry.n);
    }
    rows.push({
      name,
      seed,
      valid: score.contract_passed,
      score: round(score.score),
      axisSummary,
      impactBuckets,
      simFrames: checkpoint.stats.sim_frames,
      firstCompletionFrame: checkpoint.stats.first_completion_frame ?? null,
      elapsedMs,
    });
    process.stderr.write(`${name} seed=${seed}: score=${round(score.score)} valid=${score.contract_passed} ` +
      `impactRms=${(axisSummary.impact as { rms?: number } | undefined)?.rms ?? "-"} (${elapsedMs}ms)\n`);
  }
}

function round(x: number): number {
  return Number(x.toFixed(4));
}

const output = {
  schema: "line.study-impact-scope-panel.v1",
  joltMs: benchmarkPolicy.transform.joltMs,
  budget,
  seeds,
  env: {
    LR_AIM_BOW: process.env.LR_AIM_BOW ?? null,
    LR_IMPACT_LOCAL_W: process.env.LR_IMPACT_LOCAL_W ?? null,
    LR_GRADE_CONTINUITY: process.env.LR_GRADE_CONTINUITY ?? null,
  },
  rows,
};
if (out !== undefined) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
