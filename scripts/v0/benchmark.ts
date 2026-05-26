/**
 * v0 benchmark — compile all benchmark specs at seed=0, emit the same
 * DriftReport-based contract score used by `npm run goal`.
 *
 *   npx tsx scripts/v0/benchmark.ts
 *   npx tsx scripts/v0/benchmark.ts --json   # JSON output, no progress logs
 *
 * Per-spec score:
 *   hard gates: survival and zero off-beat landings
 *   score = 1000 * (hits/contactCount) * axisScore
 *   axisScore = clamp(1 - meanAxisError / 0.25, 0, 1)
 *
 * Goal score = mean score across specs. See GOAL.md.
 */

import { resolve } from "node:path";
import { compile } from "./compile.ts";
import type { Spec } from "./types.ts";
import { V0_FULL_BENCHMARK_SPECS } from "./bench_specs.ts";
import { scoreDriftReport } from "./score.ts";

const SEED = 0;

const argv = process.argv.slice(2);
const jsonOnly = argv.includes("--json");
const log = jsonOnly ? () => {} : (msg: string) => process.stderr.write(msg + "\n");

type PerSpec = {
  name: string;
  contacts: number;
  hits: number;
  drift: number;
  missing: number;
  off_beat_landings: number;
  died: number;
  axis_error_total: number;
  axis_error_mean: number;
  axis_score: number;
  sync_score: number;
  passed: boolean;
  hard_failures: string[];
  score: number;
  elapsed_ms: number;
};

const runStart = Date.now();
const perSpec: PerSpec[] = [];

for (const name of V0_FULL_BENCHMARK_SPECS) {
  log(`▸ ${name}`);
  const specPath = resolve(`scripts/v0/specs/${name}.ts`);
  const specMod = await import(specPath);
  const spec: Spec = specMod.default;

  const t0 = Date.now();
  const { report } = compile(spec, SEED);
  const elapsed_ms = Date.now() - t0;

  const s = scoreDriftReport(report);
  perSpec.push({
    name,
    contacts: report.contacts.length,
    hits: s.hits,
    drift: s.drift,
    missing: s.missing,
    off_beat_landings: s.off_beat_landings,
    died: s.died,
    axis_error_total: Number(s.axis_error_total.toFixed(4)),
    axis_error_mean: Number(s.axis_error_mean.toFixed(4)),
    axis_score: Number(s.axis_score.toFixed(4)),
    sync_score: Number(s.sync_score.toFixed(4)),
    passed: s.passed,
    hard_failures: s.hard_failures,
    score: Number(s.score.toFixed(2)),
    elapsed_ms,
  });

  log(
    `  hits=${s.hits}/${report.contacts.length} drift=${s.drift} miss=${s.missing} ` +
    `offBeat=${s.off_beat_landings} died=${s.died} axMean=${s.axis_error_mean.toFixed(3)} ` +
    `→ score=${s.score.toFixed(2)} (${elapsed_ms}ms)`
  );
}

const goal_score = perSpec.reduce((a, b) => a + b.score, 0) / Math.max(perSpec.length, 1);
const total_elapsed_ms = Date.now() - runStart;
const total_hits = perSpec.reduce((a, b) => a + b.hits, 0);
const total_contacts = perSpec.reduce((a, b) => a + b.contacts, 0);
const total_off_beats = perSpec.reduce((a, b) => a + b.off_beat_landings, 0);
const total_died = perSpec.reduce((a, b) => a + b.died, 0);
const total_axis_err = perSpec.reduce((a, b) => a + b.axis_error_total, 0);
const failed_specs = perSpec.filter((s) => !s.passed).length;

const result = {
  goal_score: Number(goal_score.toFixed(2)),
  total_hits,
  total_contacts,
  total_off_beats,
  total_died,
  total_axis_error: Number(total_axis_err.toFixed(4)),
  total_elapsed_ms,
  failed_specs,
  seed: SEED,
  specs: perSpec,
};

if (jsonOnly) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} else {
  log("");
  log(`Total: goal=${result.goal_score}  hits=${total_hits}/${total_contacts}  offBeat=${total_off_beats}  died=${total_died}  axErr=${total_axis_err.toFixed(3)}  failed=${failed_specs}/${perSpec.length}  (${total_elapsed_ms}ms)`);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
