/**
 * Compile one spec/seed/budget and print a hash of the resulting track. The
 * engine is whatever LR_ENGINE selects (wasm/default, js, or official). Used by
 * wasm_compile_check to assert the COMPILED TRACK is identical under both
 * engines — the ultimate end-to-end proof that bit-identical physics + matching
 * physics-frame budget ⇒ an identical compiled track.
 */
import { createHash } from "node:crypto";
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";

async function main() {
  const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const specName = arg("spec", "mini_burst");
  const variant = arg("variant", "base");
  const seed = Number(arg("seed", "0"));
  const budget = Number(arg("budget", "20000"));
  const engine = process.env.LR_ENGINE === "js"
    ? "js"
    : process.env.LR_ENGINE === "official"
      ? "official"
      : "wasm";

  // deno-lint-ignore no-explicit-any
  const spec = await loadGoldenSpec(specName as any, variant as any);
  const cp = compileHandoff(spec, seed, { budget });
  const track = cp.track;
  // Hash the COMPILED TRACK *and* the deterministic search stats. For the
  // handoff path cp.track.lines is often empty — the meaningful, fully
  // deterministic output is cp.stats (candidates sampled/viable/landed,
  // sim_frames, improvements, …; all integer/float counts, no timing). Hashing
  // both makes this a real end-to-end behavioral fingerprint: any change in the
  // engine's physics or budget accounting shifts the search trajectory → hash.
  const hash = createHash("sha256")
    .update(JSON.stringify({ track, stats: cp.stats }))
    .digest("hex").slice(0, 16);
  const lineCount = track?.lines?.length ?? -1;
  const simFrames = cp.stats?.sim_frames ?? -1;
  console.log(`HASH spec=${specName} seed=${seed} budget=${budget} engine=${engine} lines=${lineCount} sim_frames=${simFrames} ${hash}`);
}

main();
