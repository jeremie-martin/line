/**
 * One-off harness to freeze the legacy compiler's per-(spec, seed)
 * results into `baselines/greedy_v1.json`. This is the historical
 * anchor for quality non-regression checks across the rebuild.
 *
 * Usage:
 *   tsx scripts/v0/optimizer/_freeze_baseline.ts
 *
 * Behavior:
 *   - Runs the legacy `compile()` on every spec in `GOLDEN_SPECS`
 *     across seeds {0, 1, 2, 3, 4}.
 *   - Captures: axis_quality, axis_error_rms, contract_passed,
 *     hits/drift/missing, off_beat_landings, terminus.reason,
 *     elapsed_ms (informational only — not used for gate checks).
 *   - Writes a stable-sorted JSON file with a `goal_score` aggregate
 *     mirroring `golden.ts`'s shifted geometric mean.
 *
 * The output file is committed; do not regenerate without intent.
 *
 * NOTE: This is an investigation tool that will be retained for
 * baseline regeneration if we ever need to refresh. It is not part
 * of the public optimizer surface.
 */

import { writeFileSync } from "node:fs";
import { compile } from "../compile.ts";
import { GOLDEN_SPECS, loadGoldenSpec } from "../golden_suite.ts";
import { scoreReport } from "./scorer.ts";
import { shiftedGeometricMean } from "../score.ts";

type Row = {
  spec: string;
  seed: number;
  axis_quality: number;
  axis_error_rms: number;
  axis_error_max: number;
  contract_passed: boolean;
  hits: number;
  drift: number;
  missing: number;
  off_beat: number;
  terminus_reason: string;
  elapsed_ms: number;
};

const SEEDS = [0, 1, 2, 3, 4];

async function main() {
  const rows: Row[] = [];
  const total = GOLDEN_SPECS.length * SEEDS.length;
  let i = 0;
  for (const name of GOLDEN_SPECS) {
    for (const seed of SEEDS) {
      i++;
      const spec = await loadGoldenSpec(name as never, "base");
      const t0 = Date.now();
      const { report } = compile(spec, seed);
      const elapsed_ms = Date.now() - t0;

      // Mirror the scorer's per-row breakdown for completeness.
      // (We re-run scoreDriftReport via scoreReport to read
      // axis_quality; for other fields, derive directly from report.)
      const axis_quality = scoreReport(report);

      // Re-compute axis_error_rms exactly as score.ts does.
      const errs: number[] = [];
      for (const section of report.sections) {
        for (const v of Object.values(section.axes ?? {})) {
          const err = (v as { error?: number }).error;
          if (typeof err === "number") errs.push(err);
        }
      }
      const axis_error_rms = errs.length === 0
        ? 0
        : Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
      const axis_error_max = errs.reduce((m, e) => Math.max(m, Math.abs(e)), 0);

      const hits = report.contacts.filter((c) => c.status === "hit").length;
      const drift = report.contacts.filter((c) => c.status === "drift").length;
      const missing = report.contacts.filter((c) => c.status === "missing").length;
      const off_beat = report.off_beat_landings.length;
      const contract_passed =
        drift === 0 && missing === 0 && off_beat === 0
        && report.terminus.reason === "endOfSpec";

      const row: Row = {
        spec: name,
        seed,
        axis_quality,
        axis_error_rms,
        axis_error_max,
        contract_passed,
        hits,
        drift,
        missing,
        off_beat,
        terminus_reason: report.terminus.reason,
        elapsed_ms,
      };
      rows.push(row);
      console.error(
        `[${i}/${total}] ${name.padEnd(24)} seed=${seed} ` +
        `q=${axis_quality.toFixed(4)} ` +
        `${contract_passed ? "pass" : "FAIL"} ${elapsed_ms}ms`,
      );
    }
  }

  // Aggregate goal_score with the same shape as golden.ts:
  //   per-spec shifted geomean across seeds, then geomean across specs.
  const perSpec: { name: string; score: number }[] = [];
  for (const name of GOLDEN_SPECS) {
    const seedScores = rows
      .filter((r) => r.spec === name)
      .map((r) => (r.contract_passed ? r.axis_quality : 0) * 1000);
    perSpec.push({ name, score: shiftedGeometricMean(seedScores) });
  }
  const goal_score = shiftedGeometricMean(perSpec.map((s) => s.score));

  const out = {
    generated_at: new Date().toISOString().slice(0, 10),
    seeds: SEEDS,
    specs: [...GOLDEN_SPECS],
    goal_score,
    per_spec: perSpec.map((s) => ({ name: s.name, score: Number(s.score.toFixed(4)) })),
    rows: rows.map((r) => ({
      ...r,
      axis_quality: Number(r.axis_quality.toFixed(6)),
      axis_error_rms: Number(r.axis_error_rms.toFixed(6)),
      axis_error_max: Number(r.axis_error_max.toFixed(6)),
    })),
  };

  const path = "baselines/greedy_v1.json";
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.error(`\nWrote ${rows.length} rows to ${path}`);
  console.error(`goal_score (frozen): ${goal_score.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
