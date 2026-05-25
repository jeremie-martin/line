/**
 * v0 benchmark — compile all benchmark specs at seed=0, emit a single
 * machine-readable score per spec + total.
 *
 *   npx tsx scripts/v0/benchmark.ts
 *   npx tsx scripts/v0/benchmark.ts --json   # JSON output, no progress logs
 *
 * Score per spec:
 *
 *   score = hits − 5·axis_error_total − 100·off_beat_landings − 100·died
 *
 * Where:
 *   - hits             = number of Contacts with status "hit" (±1 frame)
 *   - axis_error_total = Σ |achieved − target| over all spec-specified axes
 *                        in all sections
 *   - off_beat_landings = count of landings not aligned with any Contact
 *   - died             = 1 if terminus.reason !== "endOfSpec", else 0
 *
 * Total score = Σ score across all benchmark specs.
 *
 * This file is part of the metric contract — do NOT change to "improve" the
 * score. See GOAL.md.
 */

import { resolve } from "node:path";
import { compile } from "./compile.ts";
import type { Spec, DriftReport } from "./types.ts";

const BENCHMARK_SPECS = [
  "drums_baseline",
  "drums_aerial",
  "drums_chunky",
  "drums_grounded",
  "drums_speed_test",
] as const;

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
  off_beats: number;
  died: number;
  axis_error_total: number;
  score: number;
  elapsed_ms: number;
};

function scoreReport(report: DriftReport): { hits: number; drift: number; missing: number; off_beats: number; died: number; axis_error_total: number; score: number } {
  const hits = report.contacts.filter((c) => c.status === "hit").length;
  const drift = report.contacts.filter((c) => c.status === "drift").length;
  const missing = report.contacts.filter((c) => c.status === "missing").length;
  const off_beats = report.off_beat_landings.length;
  const died = report.terminus.reason !== "endOfSpec" ? 1 : 0;
  let axis_error_total = 0;
  for (const sec of report.sections) {
    for (const ax of Object.values(sec.axes)) {
      axis_error_total += ax.error;
    }
  }
  const score = hits - 5 * axis_error_total - 100 * off_beats - 100 * died;
  return { hits, drift, missing, off_beats, died, axis_error_total, score };
}

const runStart = Date.now();
const perSpec: PerSpec[] = [];

for (const name of BENCHMARK_SPECS) {
  log(`▸ ${name}`);
  const specPath = resolve(`scripts/v0/specs/${name}.ts`);
  const specMod = await import(specPath);
  const spec: Spec = specMod.default;

  const t0 = Date.now();
  const { report } = compile(spec, SEED);
  const elapsed_ms = Date.now() - t0;

  const s = scoreReport(report);
  perSpec.push({
    name,
    contacts: report.contacts.length,
    hits: s.hits,
    drift: s.drift,
    missing: s.missing,
    off_beats: s.off_beats,
    died: s.died,
    axis_error_total: Number(s.axis_error_total.toFixed(4)),
    score: Number(s.score.toFixed(2)),
    elapsed_ms,
  });

  log(
    `  hits=${s.hits}/${report.contacts.length} drift=${s.drift} miss=${s.missing} ` +
    `offBeat=${s.off_beats} died=${s.died} axErr=${s.axis_error_total.toFixed(3)} ` +
    `→ score=${s.score.toFixed(2)} (${elapsed_ms}ms)`
  );
}

const total_score = perSpec.reduce((a, b) => a + b.score, 0);
const total_elapsed_ms = Date.now() - runStart;
const total_hits = perSpec.reduce((a, b) => a + b.hits, 0);
const total_contacts = perSpec.reduce((a, b) => a + b.contacts, 0);
const total_off_beats = perSpec.reduce((a, b) => a + b.off_beats, 0);
const total_died = perSpec.reduce((a, b) => a + b.died, 0);
const total_axis_err = perSpec.reduce((a, b) => a + b.axis_error_total, 0);

const result = {
  total_score: Number(total_score.toFixed(2)),
  total_hits,
  total_contacts,
  total_off_beats,
  total_died,
  total_axis_error: Number(total_axis_err.toFixed(4)),
  total_elapsed_ms,
  seed: SEED,
  specs: perSpec,
};

if (jsonOnly) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} else {
  log("");
  log(`Total: score=${result.total_score}  hits=${total_hits}/${total_contacts}  offBeat=${total_off_beats}  died=${total_died}  axErr=${total_axis_err.toFixed(3)}  (${total_elapsed_ms}ms)`);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
