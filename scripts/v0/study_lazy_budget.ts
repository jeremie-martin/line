/**
 * Step 1 — lazy-pool budget breakdown.
 *
 * Compiles a few golden specs at canonical budgets and reports where charged
 * physics frames go: per-candidate pool-eval rides (sampleOneCandidate, metered
 * via getPoolEvalFrames) vs aim-lane probes (aim.joint_probe_frames_charged +
 * rank_readiness_arrival_frames_charged) vs everything else (forward-eval
 * rollouts, metered reads, repair). Calibrates how much lazy evaluation can win.
 *
 *   tsx scripts/v0/study_lazy_budget.ts [budget...] [--specs=a,b,c]
 */
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { getPoolEvalFrames } from "./optimizer/sample.ts";
import type { Spec } from "./types.ts";

const argv = process.argv.slice(2);
const budgets = argv.filter((a) => /^\d+$/.test(a)).map(Number);
const budgetList = budgets.length > 0 ? budgets : [300_000, 50_000];
const specsArg = argv.find((a) => a.startsWith("--specs="));
const specDir = resolve(process.cwd(), "specs/golden");
const allSpecs = readdirSync(specDir).filter((n) => n.endsWith(".ts")).sort();
const specNames = specsArg
  ? specsArg.slice("--specs=".length).split(",")
  : ["drums_signature", "swoop_dive", "leap_cadence", "rolling_hills"];

function pct(n: number, d: number): string {
  return d > 0 ? `${((100 * n) / d).toFixed(1)}%` : "—";
}

for (const budget of budgetList) {
  console.log(`\n===== BUDGET ${budget.toLocaleString()} =====`);
  let totSim = 0, totPool = 0, totProbe = 0, totArrival = 0;
  for (const name of specNames) {
    const file = allSpecs.find((f) => f === `${name}.ts` || f.startsWith(name));
    if (!file) { console.log(`  ${name}: NOT FOUND`); continue; }
    const mod = await import(resolve(specDir, file));
    const spec: Spec = mod.default;
    const ck = compileHandoff(spec, 0, { budget }) as any;
    const sim = ck.stats?.sim_frames ?? 0;
    const pool = getPoolEvalFrames();
    const aim = ck.stats?.aim ?? {};
    const probe = aim.joint_probe_frames_charged ?? 0;
    const arrival = aim.rank_readiness_arrival_frames_charged ?? 0;
    const other = sim - pool - probe - arrival;
    totSim += sim; totPool += pool; totProbe += probe; totArrival += arrival;
    console.log(
      `  ${name.padEnd(18)} sim=${sim.toString().padStart(9)}  ` +
      `pool=${pct(pool, sim).padStart(6)}  probe=${pct(probe, sim).padStart(6)}  ` +
      `arrival=${pct(arrival, sim).padStart(6)}  other=${pct(other, sim).padStart(6)}`,
    );
    if (process.env.LR_LAZY_POOL === "1" && aim.lazy_pool_builds > 0) {
      const L = aim;
      console.log(
        `      lazy: builds=${L.lazy_pool_builds} sampled=${L.lazy_pool_sampled} ridden=${L.lazy_pool_ridden}` +
        ` (skip ${pct(L.lazy_pool_sampled - L.lazy_pool_ridden, L.lazy_pool_sampled)})` +
        ` survived=${L.lazy_pool_survived} gateFail=${L.lazy_pool_gate_fail}` +
        ` quotaExh=${L.lazy_pool_quota_exhausted} unranked=${L.lazy_pool_unranked}` +
        ` estSaved=${L.lazy_pool_est_saved_frames}`,
      );
      console.log(
        `      predBest: ridden=${L.lazy_pool_pred_best_ridden} survived=${L.lazy_pool_pred_best_survived}` +
        ` (${pct(L.lazy_pool_pred_best_survived, L.lazy_pool_pred_best_ridden)})` +
        ` stayedBest=${L.lazy_pool_pred_best_stayed_best}` +
        ` (${pct(L.lazy_pool_pred_best_stayed_best, L.lazy_pool_pred_best_ridden)})`,
      );
    }
  }
  const totOther = totSim - totPool - totProbe - totArrival;
  console.log(
    `  ${"TOTAL".padEnd(18)} sim=${totSim.toString().padStart(9)}  ` +
    `pool=${pct(totPool, totSim).padStart(6)}  probe=${pct(totProbe, totSim).padStart(6)}  ` +
    `arrival=${pct(totArrival, totSim).padStart(6)}  other=${pct(totOther, totSim).padStart(6)}`,
  );
}
