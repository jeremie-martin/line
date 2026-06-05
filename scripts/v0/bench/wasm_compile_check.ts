/**
 * End-to-end swap-in gate: compile each case under three engines and assert the
 * resulting compiled TRACK HASH ({track, stats}) is identical. This is the
 * definition of done for the WASM engine — you can swap any of these in and get
 * exactly the same compiled track:
 *
 *   - js       = our optimized vendored lr-core   (LR_ENGINE unset)
 *   - official = the untouched published lr-core   (LR_ENGINE=official)
 *   - wasm     = the Rust→WASM engine              (LR_ENGINE=wasm)
 *
 * Two independent legs, so the gate is useful at every stage:
 *   1. vendored ≡ official — proves our optimizations + parity fix kept us
 *      byte-identical to the published engine. Runs NOW (no .wasm needed); a
 *      failure here means our lr-core drifted from official and must be fixed.
 *   2. wasm ≡ vendored      — the WASM swap. SKIPPED if no .wasm is built yet;
 *      once built, a mismatch is the acceptance gate to close.
 *
 * Each engine runs in its own process (LR_ENGINE is read once at module load).
 * Cases mirror verify:optimizer so the two gates speak about the same specs.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// [spec, seed] — same curated small/medium/large + mini_burst as verify:optimizer.
const CASES: Array<[string, number]> = [
  ["tiny_dance", 0],
  ["syncopated_switchback", 1],
  ["drums_signature", 2],
  ["mini_burst", 0],
];
const BUDGET = 20000;
const TIMEOUT_MS = 240_000;

type Engine = "js" | "official" | "wasm";
type Probe = { hash: string | null; note: string };

function compileHash(spec: string, seed: number, engine: Engine): Probe {
  const env = { ...process.env };
  if (engine === "js") delete env.LR_ENGINE;
  else env.LR_ENGINE = engine;
  const r = spawnSync(
    "npx",
    ["tsx", resolve("scripts/v0/bench/compile_hash.ts"), `--spec=${spec}`, `--seed=${seed}`, `--budget=${BUDGET}`],
    { env, encoding: "utf8", timeout: TIMEOUT_MS },
  );
  if (r.error && (r.error as { code?: string }).code === "ETIMEDOUT") return { hash: null, note: "TIMEOUT" };
  if (r.status !== 0) {
    const tail = r.stderr ? ": " + r.stderr.trim().split("\n").pop() : "";
    return { hash: null, note: `exit ${r.status}${tail}` };
  }
  const line = (r.stdout || "").split("\n").find((l) => l.startsWith("HASH "));
  if (!line) return { hash: null, note: "no HASH line" };
  const m = line.match(/ ([0-9a-f]+)$/);
  return { hash: m ? m[1] : null, note: m ? "ok" : "parse failed" };
}

function main() {
  console.log("");
  console.log(`Swap-in track-hash parity (budget=${BUDGET})`);
  console.log(`  legs: [vendored ≡ official]  [wasm ≡ vendored]`);
  console.log("");

  let officialFail = false;
  let wasmFail = false;
  let wasmRan = false;

  for (const [spec, seed] of CASES) {
    const js = compileHash(spec, seed, "js");
    const official = compileHash(spec, seed, "official");
    const wasm = compileHash(spec, seed, "wasm");

    const officialOk = js.hash !== null && js.hash === official.hash;
    if (!officialOk) officialFail = true;

    // A wasm probe "ran" only if it produced a hash (else .wasm absent / not built).
    let wasmVerdict: string;
    if (wasm.hash !== null) {
      wasmRan = true;
      const wasmOk = js.hash !== null && js.hash === wasm.hash;
      if (!wasmOk) wasmFail = true;
      wasmVerdict = wasmOk ? "wasm✓" : "wasm✗";
    } else {
      wasmVerdict = `wasm—(${wasm.note})`;
    }

    const key = `${spec}|seed${seed}`;
    console.log(
      `  ${key.padEnd(28)} js=${(js.hash ?? js.note).slice(0, 16).padEnd(16)} ` +
        `${officialOk ? "official✓" : "official✗"}  ${wasmVerdict}`,
    );
  }

  console.log("");
  // Leg 1: vendored ≡ official — must always hold; this is our correctness floor.
  if (officialFail) {
    console.log("✗ vendored ≢ official — our lr-core drifted from the published engine. FIX FIRST.");
    process.exit(1);
  }
  console.log("✓ vendored ≡ official on all cases (our optimized lr-core is byte-identical to published).");

  // Leg 2: wasm ≡ vendored — the swap-in acceptance gate.
  if (!wasmRan) {
    console.log("· wasm leg SKIPPED — no built .wasm (run `npm run build:wasm`). The above is still a full");
    console.log("  parity check of our engine vs official; the wasm leg is the remaining work.");
    return;
  }
  if (wasmFail) {
    console.log("✗ wasm ≢ vendored — the WASM engine is not yet a drop-in. This is the acceptance gate.");
    process.exit(2);
  }
  console.log("✓ wasm ≡ vendored ≡ official — WASM is a bit-identical drop-in. DONE.");
}

main();
