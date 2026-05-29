/**
 * Step 4 — greedy_v2 K-sweep harness.
 *
 * One process per (K, seed) cell. Runs all 13 golden specs serially
 * at the given K and seed; writes per-spec results to a JSON file.
 *
 * Usage:
 *   tsx scripts/v0/optimizer/_sweep_k.ts <K> <seed> <outpath>
 *
 * Output: array of { spec, seed, K, status, axis_quality,
 * contract_passed, ... }. Status is "ok" | "contract_fail" | "throw".
 *
 * This harness is investigation-only; deleted in Step 9.
 */

import { writeFileSync } from "node:fs";
import { compileGreedy_v2 } from "./greedy.ts";
import { GOLDEN_SPECS, loadGoldenSpec } from "../golden_suite.ts";
import { scoreDriftReport } from "../score.ts";

type Row = {
  spec: string;
  seed: number;
  K: number;
  status: "ok" | "contract_fail" | "throw";
  axis_quality: number;
  contract_passed: boolean;
  hits: number;
  drift: number;
  missing: number;
  off_beat: number;
  terminus_reason: string;
  elapsed_ms: number;
  total_committed_cost: number;
  error_message: string | null;
};

async function main() {
  const K = Number(process.argv[2]);
  const seed = Number(process.argv[3]);
  const outpath = process.argv[4];
  if (!Number.isInteger(K) || K < 1 || !Number.isInteger(seed) || seed < 0 || !outpath) {
    console.error("usage: tsx _sweep_k.ts <K> <seed> <outpath>");
    process.exit(2);
  }

  const rows: Row[] = [];
  for (const name of GOLDEN_SPECS) {
    const spec = await loadGoldenSpec(name as never, "base");
    const t0 = Date.now();
    try {
      const r = compileGreedy_v2(spec, seed, { K });
      const elapsed_ms = Date.now() - t0;
      const axis_quality = scoreDriftReport(r.report).axis_quality;
      const hits = r.report.contacts.filter((c) => c.status === "hit").length;
      const drift = r.report.contacts.filter((c) => c.status === "drift").length;
      const missing = r.report.contacts.filter((c) => c.status === "missing").length;
      const off_beat = r.report.off_beat_landings.length;
      const contract_passed =
        drift === 0 && missing === 0 && off_beat === 0
        && r.report.terminus.reason === "endOfSpec";
      rows.push({
        spec: name, seed, K,
        status: contract_passed ? "ok" : "contract_fail",
        axis_quality, contract_passed,
        hits, drift, missing, off_beat,
        terminus_reason: r.report.terminus.reason,
        elapsed_ms,
        total_committed_cost: r.stats.total_committed_cost,
        error_message: null,
      });
      console.error(`[K=${K} s=${seed}] ${name.padEnd(24)} ${contract_passed ? "ok" : "FAIL"} q=${axis_quality.toFixed(3)} ${elapsed_ms}ms`);
    } catch (e: unknown) {
      const elapsed_ms = Date.now() - t0;
      rows.push({
        spec: name, seed, K, status: "throw",
        axis_quality: 0, contract_passed: false,
        hits: 0, drift: 0, missing: 0, off_beat: 0,
        terminus_reason: "thrown",
        elapsed_ms,
        total_committed_cost: 0,
        error_message: String(e).slice(0, 200),
      });
      console.error(`[K=${K} s=${seed}] ${name.padEnd(24)} THROW ${elapsed_ms}ms`);
    }
  }
  writeFileSync(outpath, JSON.stringify(rows, null, 2));
  console.error(`[K=${K} s=${seed}] wrote ${rows.length} rows`);
}

main().catch((e) => { console.error(e); process.exit(1); });
