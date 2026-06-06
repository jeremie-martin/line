/**
 * compile_bench — single-core, in-process compile timing + profiling.
 *
 * sim_bench isolates the engine primitive. THIS runs a real compile (search +
 * extraction + detection + engine) in-process so a CPU profile can attribute
 * time between vendor/lr-core (the engine) and scripts/ (how WE drive it:
 * extraction, detector, search). Runs one spec/seed/budget, no worker pool.
 *
 *   taskset -c 0 npm run cbench -- --spec=tiny_dance --seed=0 --budget=50000
 *   npm run cbench:prof -- --spec=tiny_dance --seed=0 --budget=50000
 */
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";

function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

async function main() {
  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args.set(m[1], m[2]);
  }
  const specName = args.get("spec") ?? "tiny_dance";
  const variant = args.get("variant") ?? "base";
  const seed = Number(args.get("seed") ?? 0);
  const budget = Number(args.get("budget") ?? 50000);
  const reps = Number(args.get("reps") ?? 5);
  const warmup = Number(args.get("warmup") ?? 1);

  // deno-lint-ignore no-explicit-any
  const spec = await loadGoldenSpec(specName as any, variant as any);

  for (let i = 0; i < warmup; i++) compileHandoff(spec, seed, { budget });

  const times: number[] = [];
  let trackHash = "";
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    const res = compileHandoff(spec, seed, { budget });
    const t1 = process.hrtime.bigint();
    times.push(Number(t1 - t0) / 1e6);
    // stable signature of the result so we can confirm determinism across reps
    const sig = JSON.stringify(res.track ?? res).length + ":" + (res.track?.lines?.length ?? 0);
    if (i === 0) trackHash = sig;
    else if (sig !== trackHash) throw new Error(`nondeterministic compile result: ${sig} !== ${trackHash}`);
  }

  times.sort((a, b) => a - b);
  console.log("");
  console.log(`compile_bench  spec=${specName}/${variant}  seed=${seed}  budget=${budget}  reps=${reps}`);
  console.log(`  result_sig   ${trackHash}`);
  console.log(`  min          ${fmt(times[0])} ms`);
  console.log(`  median       ${fmt(times[Math.floor(times.length / 2)])} ms`);
  console.log(`  max          ${fmt(times[times.length - 1])} ms`);
  console.log(`BENCH ${JSON.stringify({ spec: specName, seed, budget, reps, min_ms: times[0], median_ms: times[Math.floor(times.length / 2)] })}`);
}

main();
