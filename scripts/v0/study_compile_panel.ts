/** Run a deterministic compiler panel and persist score/residual telemetry. */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { scoreDriftReport } from "./score.ts";
import { REPORT_ONLY_AXIS_SET, secToFrame } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const defaultSpecs = [
  "drums_pendulum", "drums_dropout", "dense_echo_climb", "skyline_push",
  "drums_pulse", "drums_signature", "rhythm_ladder", "solo_run",
  "drums_crescendo", "ridge_pulse", "canyon_steps", "float_bounds",
].join(",");
const specArg = argValue("specs") ?? defaultSpecs;
const specs = (specArg === "all" ? [...GOLDEN_SPECS] : specArg.split(",")) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const label = argValue("label") ?? "panel";
const outPath = argValue("out");

if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`invalid budget ${budget}`);
for (const seed of seeds) {
  if (!Number.isSafeInteger(seed)) throw new Error(`invalid seed ${seed}`);
}
for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) {
    throw new Error(`unknown spec "${spec}"`);
  }
}

type AxisResidual = {
  count: number;
  rms: number;
  meanSigned: number;
  underFraction: number;
};

type Row = {
  spec: GoldenSpecName;
  seed: number;
  score: number;
  axisQuality: number;
  axisErrorRms: number;
  contractPassed: boolean;
  trackHash: string;
  accelerationLines: number;
  simFrames: number;
  candidatesSampled: number;
  selectedSources: Record<string, number>;
  selectedAxes: Record<string, number>;
  repair: unknown;
  axes: Record<string, AxisResidual>;
};

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

const rows: Row[] = [];
for (const specName of specs) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const started = Date.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const score = scoreDriftReport(checkpoint.report, { totalFrames: secToFrame(spec.duration) });
    const axisValues = new Map<string, number[]>();
    for (const gap of checkpoint.report.gaps) {
      for (const [axis, value] of Object.entries(gap.axes)) {
        if (REPORT_ONLY_AXIS_SET.has(axis) || !Number.isFinite(value.error)) continue;
        const values = axisValues.get(axis) ?? [];
        values.push(value.achieved - value.target);
        axisValues.set(axis, values);
      }
    }
    const axes = Object.fromEntries([...axisValues].map(([axis, values]) => {
      const sse = values.reduce((sum, value) => sum + value * value, 0);
      const signed = values.reduce((sum, value) => sum + value, 0);
      return [axis, {
        count: values.length,
        rms: round(Math.sqrt(sse / values.length)),
        meanSigned: round(signed / values.length),
        underFraction: round(values.filter((value) => value < 0).length / values.length),
      }];
    }));
    rows.push({
      spec: specName,
      seed,
      score: round(score.score),
      axisQuality: round(score.axis_quality),
      axisErrorRms: round(score.axis_error_rms),
      contractPassed: score.contract_passed,
      trackHash: createHash("sha256").update(JSON.stringify(checkpoint.track)).digest("hex"),
      accelerationLines: checkpoint.track.lines.filter((line) => line.type === 2).length,
      simFrames: checkpoint.stats.sim_frames,
      candidatesSampled: checkpoint.stats.candidates_sampled,
      selectedSources: checkpoint.stats.handoff_selected_candidate_by_source ?? {},
      selectedAxes: checkpoint.stats.handoff_selected_axis_quality_by_axis ?? {},
      repair: checkpoint.stats.repair ?? null,
      axes,
    });
    console.error(
      `  ${specName}/s${seed}: ${score.score.toFixed(2)} ` +
        `${score.contract_passed ? "pass" : "fail"} ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

const mean = (values: number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
const result = {
  label,
  budget,
  specs,
  seeds,
  summary: {
    rows: rows.length,
    meanScore: round(mean(rows.map((row) => row.score))),
    meanAxisQuality: round(mean(rows.map((row) => row.axisQuality))),
    valid: rows.filter((row) => row.contractPassed).length,
    changedTracks: new Set(rows.map((row) => row.trackHash)).size,
  },
  rows,
};

console.log(JSON.stringify(result.summary, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`rows -> ${outPath}`);
}
