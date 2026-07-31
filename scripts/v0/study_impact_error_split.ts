/**
 * Impact error SPLIT (2026-07-31) — the measurement that decides whether any form
 * of target bounding deserves to come back (docs/impact_contract.md "Scoring").
 *
 * Production scores the AUTHORED impact target unmodified: error = |ask − achieved|.
 * The feasibility bound and the ceiling ride alongside as diagnostics and change
 * nothing. So today's impact error is a mix of two very different things:
 *
 *   IRREDUCIBLE  the part of the ask that sits ABOVE the feasibility bound — the
 *                spec asking for more than the beat's timing budget allows.
 *                No compiler improvement can retire it; only re-authoring can.
 *   SHORTFALL    the part BELOW the bound — the beat allowed it and we missed it.
 *                This is the honest compiler-improvement headroom.
 *
 * It also counts BOUND-BEATERS: landings that achieved MORE than the bound said
 * was possible. Those falsify the bound model, and their rate is the reason to
 * trust or distrust the split above.
 *
 * Reads the drift report directly (target / achieved / feasibility_bound / ceiling
 * are all already per-gap fields), so it measures exactly what the scorer saw.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_error_split.ts [--seeds=0,1,2] [--budget=750000]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./impact_support.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { loadSourceManifest, resolveSources, loadSourceSpec } from "./benchmark_v2/model.ts";

const argv = process.argv.slice(2);
const arg = (n: string, d: string) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SEEDS = arg("seeds", "0,1,2").split(",").map(Number);
const BUDGET = Number(arg("budget", "750000"));
const MANIFEST = arg("manifest", "benchmark/v2/compat/source-manifest.json");

type Row = { src: string; seed: number; ask: number; achieved: number; bound: number; ceiling: number };
const rows: Row[] = [];
const sources = resolveSources(loadSourceManifest(MANIFEST));
console.log(`${sources.length} sources × ${SEEDS.length} seeds @${BUDGET}`);
const t0 = Date.now();
for (const source of sources) {
  let spec;
  try { spec = await loadSourceSpec(source); } catch (e) { console.log(`  SKIP ${source.id}: ${String(e).slice(0, 80)}`); continue; }
  for (const seed of SEEDS) {
    let report;
    try { ({ report } = compileHandoff(spec, seed, { budget: BUDGET })); } catch (e) { console.log(`  FAIL ${source.id} s${seed}`); continue; }
    for (const g of report.gaps) {
      const a = g.axes.impact;
      if (a === undefined || a.achieved === undefined) continue;
      rows.push({
        src: source.id, seed, ask: a.target, achieved: a.achieved,
        bound: a.feasibility_bound ?? 1, ceiling: a.ceiling ?? 1,
      });
    }
  }
  console.log(`  ${source.id} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
mkdirSync(resolve("generated/benchmark-v2"), { recursive: true });
writeFileSync(resolve("generated/benchmark-v2/impact_error_split.json"), JSON.stringify({ seeds: SEEDS, budget: BUDGET, rows }));
console.log(`\n${rows.length} authored impact contacts`);

// ── the split ─────────────────────────────────────────────────────────────────
const irreducible = (r: Row) => Math.max(0, r.ask - r.bound);            // ask above the bound
const shortfall = (r: Row) => Math.max(0, Math.min(r.ask, r.bound) - r.achieved); // missed inside the bound
const overshoot = (r: Row) => Math.max(0, r.achieved - r.ask);          // delivered harder than asked
const err = (r: Row) => Math.abs(r.ask - r.achieved);
const beatsBound = (r: Row) => r.achieved > r.bound + 1e-9;

const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);
const mean = (f: (r: Row) => number) => sum(f) / Math.max(1, rows.length);
console.log(`\n=== error decomposition (mean per authored contact) ===`);
console.log(`  |ask − achieved|                     ${mean(err).toFixed(3)}`);
console.log(`  ├─ IRREDUCIBLE (ask above bound)     ${mean(irreducible).toFixed(3)}  (${(100 * sum(irreducible) / Math.max(1e-9, sum(err))).toFixed(0)}% of total error)`);
console.log(`  ├─ SHORTFALL   (missed inside bound) ${mean(shortfall).toFixed(3)}  (${(100 * sum(shortfall) / Math.max(1e-9, sum(err))).toFixed(0)}%)`);
console.log(`  └─ OVERSHOOT   (harder than asked)   ${mean(overshoot).toFixed(3)}  (${(100 * sum(overshoot) / Math.max(1e-9, sum(err))).toFixed(0)}%)`);
console.log(`\n  asks above their bound: ${rows.filter((r) => r.ask > r.bound + 1e-9).length}/${rows.length} ` +
  `(${(100 * rows.filter((r) => r.ask > r.bound + 1e-9).length / rows.length).toFixed(1)}%)`);
console.log(`  BOUND-BEATERS (achieved > bound):  ${rows.filter(beatsBound).length}/${rows.length} ` +
  `(${(100 * rows.filter(beatsBound).length / rows.length).toFixed(1)}%) — the model's falsification rate`);
const overCeil = rows.filter((r) => r.achieved > r.ceiling + 1e-9).length;
console.log(`  achieved above the CEILING (actual-speed bound): ${overCeil}/${rows.length} (${(100 * overCeil / rows.length).toFixed(1)}%)`);

// ── by ask band: where does each part live? ───────────────────────────────────
console.log(`\n=== by authored ask band ===`);
console.log(`   band        n   mean ask  mean bound  mean ach   irreducible  shortfall`);
for (let lo = 0; lo < 1; lo += 0.125) {
  const hi = lo + 0.125;
  const rs = rows.filter((r) => r.ask >= lo && r.ask < hi + (hi >= 1 ? 1e-9 : 0));
  if (!rs.length) continue;
  const m = (f: (r: Row) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  console.log(`  [${lo.toFixed(3)},${hi.toFixed(3)}) ${String(rs.length).padStart(5)}    ${m((r) => r.ask).toFixed(2)}       ${m((r) => r.bound).toFixed(2)}      ${m((r) => r.achieved).toFixed(2)}       ${m(irreducible).toFixed(3)}      ${m(shortfall).toFixed(3)}`);
}

// ── what the headline would look like if the bound were restored as a clamp ───
const clampedErr = rows.map((r) => Math.abs(Math.min(r.ask, r.bound) - r.achieved));
console.log(`\n=== counterfactual: if min(ask, bound) came back as the scored target ===`);
console.log(`  mean |err| today (authored target):  ${mean(err).toFixed(3)}`);
console.log(`  mean |err| under a restored clamp:   ${(clampedErr.reduce((a, b) => a + b, 0) / clampedErr.length).toFixed(3)}`);
console.log(`  rms today ${Math.sqrt(mean((r) => err(r) ** 2)).toFixed(3)}  ·  rms clamped ${Math.sqrt(clampedErr.reduce((a, b) => a + b * b, 0) / clampedErr.length).toFixed(3)}`);
console.log(`  (axis_quality = exp(−rms/0.25), so the rms line is the headline-relevant one)`);

// ── per-source worst offenders (authoring signal) ─────────────────────────────
const bySrc = new Map<string, Row[]>();
for (const r of rows) (bySrc.get(r.src) ?? bySrc.set(r.src, []).get(r.src)!).push(r);
const ranked = [...bySrc].map(([src, rs]) => ({
  src, n: rs.length,
  irr: rs.reduce((s, r) => s + irreducible(r), 0) / rs.length,
  sf: rs.reduce((s, r) => s + shortfall(r), 0) / rs.length,
})).sort((a, b) => b.irr - a.irr);
console.log(`\n=== specs asking furthest past their own bound (re-authoring candidates) ===`);
for (const x of ranked.slice(0, 8)) console.log(`  ${x.src.padEnd(38)} n=${String(x.n).padStart(4)}  irreducible ${x.irr.toFixed(3)}  shortfall ${x.sf.toFixed(3)}`);
console.log(`\n=== specs with the most reachable-but-missed impact (compiler headroom) ===`);
for (const x of [...ranked].sort((a, b) => b.sf - a.sf).slice(0, 8)) console.log(`  ${x.src.padEnd(38)} n=${String(x.n).padStart(4)}  shortfall ${x.sf.toFixed(3)}  irreducible ${x.irr.toFixed(3)}`);
