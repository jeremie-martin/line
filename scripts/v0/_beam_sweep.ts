/**
 * Phase 4 beam-width sweep harness.
 *
 * Usage: tsx scripts/v0/_beam_sweep.ts <width> <seed> [outpath]
 *
 * For one (width, seed) combination, runs `compileBeam` on every golden
 * spec and writes a JSON record per spec to `outpath`. Designed to be
 * launched in parallel as multiple processes per (width, seed) cell.
 *
 * Failure modes captured:
 *   - "error" — compileBeam threw (beam death)
 *   - "contract_fail" — completed but contract violated (missing
 *     contacts, off-beat landings, early death)
 *   - "ok" — completed with contract_passed=true
 *
 * Investigation-only — removed in Phase 9 cleanup.
 */
import { writeFileSync } from "node:fs";
import { compileBeam } from "./compile_beam.ts";
import { loadGoldenSpec, GOLDEN_SPECS } from "./golden_suite.ts";
import { AXIS_QUALITY_TOLERANCE } from "./score.ts";

type Row = {
  spec: string;
  seed: number;
  width: number;
  status: "ok" | "contract_fail" | "error";
  wall_ms: number;
  axis_quality: number;
  axis_error_rms: number;
  contract_passed: boolean;
  hits: number;
  drift: number;
  missing: number;
  off_beat: number;
  total_committed_cost: number;
  error_message: string | null;
};

function computeAxisErrorRms(report: ReturnType<typeof compileBeam>["report"]): number {
  const errs: number[] = [];
  for (const section of report.sections) {
    for (const v of Object.values(section.axes ?? {})) {
      const e = (v as { error?: number }).error;
      if (typeof e === "number") errs.push(e);
    }
  }
  if (errs.length === 0) return 0;
  return Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
}

async function main() {
  const width = Number(process.argv[2]);
  const seed = Number(process.argv[3]);
  const outpath = process.argv[4] ?? `/tmp/beam_sweep_w${width}_s${seed}.json`;
  if (!Number.isInteger(width) || width < 1) {
    console.error(`bad width: ${process.argv[2]}`);
    process.exit(1);
  }
  if (!Number.isInteger(seed) || seed < 0) {
    console.error(`bad seed: ${process.argv[3]}`);
    process.exit(1);
  }

  const rows: Row[] = [];
  console.error(`[w=${width} s=${seed}] sweeping ${GOLDEN_SPECS.length} specs...`);
  for (const name of GOLDEN_SPECS) {
    const spec = await loadGoldenSpec(name as never, "base");
    const t0 = Date.now();
    try {
      const r = compileBeam(spec, seed, { beamWidth: width });
      const wall_ms = Date.now() - t0;
      const report = r.report;
      const hits = report.contacts.filter((c) => c.status === "hit").length;
      const drift = report.contacts.filter((c) => c.status === "drift").length;
      const missing = report.contacts.filter((c) => c.status === "missing").length;
      const off_beat = report.off_beat_landings.length;
      const contract_passed =
        drift === 0 && missing === 0 && off_beat === 0
        && report.terminus.reason === "endOfSpec";
      const rms = computeAxisErrorRms(report);
      rows.push({
        spec: name, seed, width,
        status: contract_passed ? "ok" : "contract_fail",
        wall_ms,
        axis_quality: Math.exp(-rms / AXIS_QUALITY_TOLERANCE),
        axis_error_rms: rms,
        contract_passed,
        hits, drift, missing, off_beat,
        total_committed_cost: r.stats.total_committed_cost,
        error_message: null,
      });
      console.error(`[w=${width} s=${seed}] ${name.padEnd(24)} ${contract_passed ? "ok" : "contract_fail"} ${wall_ms}ms q=${Math.exp(-rms/AXIS_QUALITY_TOLERANCE).toFixed(3)}`);
    } catch (e: unknown) {
      const wall_ms = Date.now() - t0;
      rows.push({
        spec: name, seed, width,
        status: "error",
        wall_ms,
        axis_quality: 0,
        axis_error_rms: NaN,
        contract_passed: false,
        hits: 0, drift: 0, missing: 0, off_beat: 0,
        total_committed_cost: 0,
        error_message: String(e).slice(0, 200),
      });
      console.error(`[w=${width} s=${seed}] ${name.padEnd(24)} ERROR ${wall_ms}ms`);
    }
  }

  writeFileSync(outpath, JSON.stringify(rows, null, 2));
  console.error(`[w=${width} s=${seed}] wrote ${rows.length} rows to ${outpath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
