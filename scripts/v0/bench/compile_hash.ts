/**
 * Compile one spec/seed/budget and print a hash of the resulting track. The
 * engine is whatever LR_ENGINE selects (js default, or wasm). Used by
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
  const engine = process.env.LR_ENGINE === "wasm" ? "wasm" : "js";

  // deno-lint-ignore no-explicit-any
  const spec = await loadGoldenSpec(specName as any, variant as any);
  const res = compileHandoff(spec, seed, { budgets: [budget] });
  const cp = res.checkpoints[res.checkpoints.length - 1];
  const track = cp.track;
  const hash = createHash("sha256").update(JSON.stringify(track)).digest("hex").slice(0, 16);
  const lineCount = track?.lines?.length ?? -1;
  console.log(`HASH spec=${specName} seed=${seed} budget=${budget} engine=${engine} lines=${lineCount} ${hash}`);
}

main();
