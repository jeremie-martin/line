/**
 * Tier-3 end-to-end gate: compile each spec under the JS engine and the WASM
 * engine (separate processes — LR_ENGINE is read at module load) and assert the
 * resulting TRACK HASH is identical. This is the ultimate acceptance test: it
 * proves bit-identical physics + matching physics-frame budget ⇒ an identical
 * compiled track. RED until Phase 2b (the WASM engine can't yet fork engines as
 * the search requires); GREEN is the definition of done.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SPECS = ["mini_burst", "tiny_dance"];
const SEED = 0;
const BUDGET = 20000;
const TIMEOUT_MS = 240_000;

function compileHash(spec: string, engine: "js" | "wasm"): { hash: string | null; note: string } {
  const env = { ...process.env };
  if (engine === "wasm") env.LR_ENGINE = "wasm";
  else delete env.LR_ENGINE;
  const r = spawnSync(
    "npx",
    ["tsx", resolve("scripts/v0/bench/compile_hash.ts"), `--spec=${spec}`, `--seed=${SEED}`, `--budget=${BUDGET}`],
    { env, encoding: "utf8", timeout: TIMEOUT_MS },
  );
  if (r.error && (r.error as any).code === "ETIMEDOUT") return { hash: null, note: "TIMEOUT" };
  if (r.status !== 0) return { hash: null, note: `exit ${r.status}${r.stderr ? ": " + r.stderr.trim().split("\n").pop() : ""}` };
  const line = (r.stdout || "").split("\n").find((l) => l.startsWith("HASH "));
  if (!line) return { hash: null, note: "no HASH line" };
  const m = line.match(/lines=(\S+) ([0-9a-f]+)$/);
  return { hash: m ? m[2] : null, note: m ? `lines=${m[1]}` : "parse failed" };
}

function main() {
  let anyGap = false;
  console.log("");
  console.log(`Tier-3 compile-level track-hash (seed=${SEED}, budget=${BUDGET})`);
  for (const spec of SPECS) {
    const js = compileHash(spec, "js");
    const wasm = compileHash(spec, "wasm");
    const ok = js.hash !== null && js.hash === wasm.hash;
    if (!ok) anyGap = true;
    console.log(`  ${spec.padEnd(12)} js=${(js.hash ?? js.note).padEnd(18)} wasm=${(wasm.hash ?? wasm.note).padEnd(18)} ${ok ? "✓ identical" : "✗ gap"}`);
  }
  console.log("");
  if (!anyGap) {
    console.log("WASM-COMPILE: PASS — compiler produces an identical track under both engines.");
  } else {
    console.log("WASM-COMPILE: gap (expected pre-Phase-2b — the WASM engine can't yet fork as the search requires). This is the acceptance gate for Phase 2b.");
    process.exit(2);
  }
}

main();
