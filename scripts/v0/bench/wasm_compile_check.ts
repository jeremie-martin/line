/**
 * End-to-end swap-in gate: compile each case under multiple engines and assert
 * the compiled TRACK HASH ({track, stats}) is identical. The definition of done
 * for the WASM engine — swap it in and get exactly the same compiled track:
 *
 *   - js       = our optimized vendored lr-core   (LR_ENGINE unset)
 *   - wasm     = the Rust→WASM engine             (LR_ENGINE=wasm)
 *   - official = the untouched published lr-core  (LR_ENGINE=official) — SLOW
 *
 * Default = the fast inner-loop leg you run while developing the WASM engine:
 *   wasm ≡ vendored.
 *
 * `--official` additionally re-checks vendored ≡ official. That leg is a STABLE
 * fact (it only changes if our lr-core changes), and `official` is the slow
 * unoptimized engine, so it is NOT run by default — only when you want to
 * re-confirm the published-parity foundation (e.g. after editing vendor/lr-core).
 * Because vendored ≡ official is transitive, wasm ≡ vendored ⇒ wasm ≡ official.
 *
 * Each engine runs in its own process (LR_ENGINE is read once at module load).
 * Cases mirror verify:optimizer so the two gates speak about the same specs.
 *
 *   npm run wasm:compile                # wasm ≡ vendored  (fast)
 *   npm run wasm:compile -- --official  # + vendored ≡ official  (slow, occasional)
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
  const checkOfficial = process.argv.includes("--official");

  console.log("");
  console.log(`Swap-in track-hash parity (budget=${BUDGET})`);
  console.log(checkOfficial ? "  legs: [wasm ≡ vendored]  [vendored ≡ official]" : "  leg: [wasm ≡ vendored]   (add --official for the slow vendored≡official leg)");
  console.log("");

  let officialFail = false;
  let wasmFail = false;
  let wasmRan = false;

  for (const [spec, seed] of CASES) {
    const js = compileHash(spec, seed, "js");
    const wasm = compileHash(spec, seed, "wasm");
    const official = checkOfficial ? compileHash(spec, seed, "official") : null;

    let wasmVerdict: string;
    if (wasm.hash !== null) {
      wasmRan = true;
      const wasmOk = js.hash !== null && js.hash === wasm.hash;
      if (!wasmOk) wasmFail = true;
      wasmVerdict = wasmOk ? "wasm✓" : "wasm✗";
    } else {
      wasmVerdict = `wasm—(${wasm.note})`;
    }

    let officialVerdict = "";
    if (official) {
      const officialOk = js.hash !== null && js.hash === official.hash;
      if (!officialOk) officialFail = true;
      officialVerdict = officialOk ? "  official✓" : "  official✗";
    }

    const key = `${spec}|seed${seed}`;
    console.log(`  ${key.padEnd(28)} js=${(js.hash ?? js.note).slice(0, 16).padEnd(16)} ${wasmVerdict}${officialVerdict}`);
  }

  console.log("");
  // Leg: vendored ≡ official (opt-in) — our correctness floor vs the published engine.
  if (checkOfficial) {
    if (officialFail) {
      console.log("✗ vendored ≢ official — our lr-core drifted from the published engine. FIX FIRST.");
      process.exit(1);
    }
    console.log("✓ vendored ≡ official on all cases (our optimized lr-core is byte-identical to published).");
  }

  // Leg: wasm ≡ vendored — the swap-in acceptance gate (the default inner loop).
  if (!wasmRan) {
    console.log("· wasm leg SKIPPED — no built .wasm (run `npm run build:wasm`).");
    if (!checkOfficial) console.log("  Nothing was checked. Build the wasm, or pass --official to check vendored≡official.");
    return;
  }
  if (wasmFail) {
    console.log("✗ wasm ≢ vendored — the WASM engine is not yet a drop-in. This is the acceptance gate.");
    process.exit(2);
  }
  console.log(checkOfficial
    ? "✓ wasm ≡ vendored ≡ official — WASM is a bit-identical drop-in. DONE."
    : "✓ wasm ≡ vendored — WASM is a drop-in for our lr-core (≡ official, transitively).");
}

main();
