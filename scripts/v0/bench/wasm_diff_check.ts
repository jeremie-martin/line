/**
 * Differential harness — the Phase-2b workhorse. Generates a seeded sequence of
 * engine operations (mirroring the compiler: build a chain, FORK from earlier
 * instances to add candidates, interleave reads at varied frames, keep old
 * instances live), then executes the SAME ops on the vendored JS engine (ground
 * truth) and the WASM engine, asserting parity after every read:
 *   - getStateMapAtFrame  → bit-identical (non-scarf entities)
 *   - getUpdatesAtFrame   → identical folded sequence (type + collision line-id)
 *   - getLastFrameIndex   → equal (the physics-frame budget driver)
 *
 * Failures are categorized (STATE / UPDATES / LFI). Pre-Phase-2b, STATE/UPDATES
 * should pass; LFI is expected to fail on mid-stream addLine + forking — that's
 * the gap. Post-Phase-2b: all green. Deterministic via --seed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadTrackJson } from "./_fixture.ts";
import { LineRiderEngine as WasmEngine, createLineFromJson as wasmLine } from "../../lib/_lr_engine_wasm.ts";
import { jsGroundTruth, extractState, extractUpdates } from "./_engine_probe.ts";

const TRACK = "scripts/v0/bench/tracks/long_track.json";

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Op =
  | { kind: "add"; src: number; line: number }
  | { kind: "lfi"; inst: number }
  | { kind: "state"; inst: number; frame: number }
  | { kind: "updates"; inst: number; frame: number };

// Generate an engine-independent op list mirroring the compiler's access pattern.
function genOps(rng: () => number, nLines: number, count: number): Op[] {
  const ops: Op[] = [];
  let nInst = 1; // instance 0 = base (created + setStart by the executor)
  let nextLine = 0;
  const maxFrame = 700;
  for (let i = 0; i < count && nextLine < nLines; i++) {
    const r = rng();
    if (r < 0.45) {
      // extend the latest instance (build the prefix chain)
      ops.push({ kind: "add", src: nInst - 1, line: nextLine++ });
      nInst++;
    } else if (r < 0.65 && nInst > 3) {
      // FORK: add a candidate to an EARLIER instance, keeping it live
      const src = Math.floor(rng() * (nInst - 1));
      ops.push({ kind: "add", src, line: nextLine++ });
      nInst++;
    } else {
      // read some instance at some frame
      const inst = Math.floor(rng() * nInst);
      const frame = Math.floor(rng() * maxFrame);
      const k = rng();
      ops.push(k < 0.5 ? { kind: "state", inst, frame } : k < 0.85 ? { kind: "updates", inst, frame } : { kind: "lfi", inst });
    }
  }
  return ops;
}

// deno-lint-ignore no-explicit-any
function exec(ops: Op[], Engine: any, createLine: any, lines: any[], start: any, vel: any): string[] {
  const inst: any[] = [new Engine().setStart(start, vel)];
  const results: string[] = [];
  for (const op of ops) {
    if (op.kind === "add") {
      inst.push(inst[op.src].addLine(createLine(lines[op.line])));
      results.push(""); // adds produce no comparable result
    } else if (op.kind === "lfi") {
      results.push("L" + inst[op.inst].getLastFrameIndex());
    } else if (op.kind === "state") {
      results.push(extractState(inst[op.inst], op.frame));
    } else {
      results.push(extractUpdates(inst[op.inst], op.frame));
    }
  }
  return results;
}

async function main() {
  const seed = Number(process.argv.find((a) => a.startsWith("--seed="))?.slice(7) ?? 1);
  const count = Number(process.argv.find((a) => a.startsWith("--ops="))?.slice(6) ?? 300);
  const json = JSON.parse(readFileSync(resolve(TRACK), "utf8"));
  const src = loadTrackJson("long_track", json);
  const lines = src.lines.slice(0, 220);

  const ops = genOps(mulberry32(seed), lines.length, count);
  const js = await jsGroundTruth();
  const jsRes = exec(ops, js.Engine, js.createLine, lines, src.start, src.velocity);
  const wRes = exec(ops, WasmEngine, wasmLine, lines, src.start, src.velocity);

  const fail = { state: 0, updates: 0, lfi: 0 };
  const firstFail: Record<string, string> = {};
  let reads = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.kind === "add") continue;
    reads++;
    if (jsRes[i] !== wRes[i]) {
      fail[op.kind as "state" | "updates" | "lfi"]++;
      const key = op.kind;
      if (!firstFail[key]) {
        firstFail[key] = `op#${i} ${op.kind} inst=${(op as any).inst}${"frame" in op ? ` frame=${op.frame}` : ""}\n        js  =${jsRes[i].slice(0, 80)}\n        wasm=${wRes[i].slice(0, 80)}`;
      }
    }
  }

  console.log("");
  console.log(`wasm_diff_check  seed=${seed}  ops=${ops.length}  reads=${reads}  lines=${lines.length}`);
  console.log(`  STATE   mismatches: ${fail.state}   ${fail.state === 0 ? "✓ bit-identical" : "gap"}`);
  console.log(`  UPDATES mismatches: ${fail.updates}   ${fail.updates === 0 ? "✓" : "gap"}`);
  console.log(`  LFI     mismatches: ${fail.lfi}   ${fail.lfi === 0 ? "✓ budget parity" : "gap"}`);
  for (const k of ["state", "updates", "lfi"]) if (firstFail[k]) console.log(`  first ${k}: ${firstFail[k]}`);
  console.log("");
  if (fail.state === 0 && fail.updates === 0 && fail.lfi === 0) {
    console.log("WASM-DIFF: PASS — full parity (state, updates, budget) across forking + mid-stream addLine.");
  } else {
    // Pre-Phase-2b, the WASM wrapper's addLine is in-place (instances alias), so
    // all three categories diverge once an op forks or reads an old instance.
    // `npm run trace` already proves the per-frame physics; these are the
    // forking + invalidation + budget targets Phase 2b must drive to zero.
    console.log("WASM-DIFF: gaps above are the Phase-2b target (immutable forking + exact invalidation + budget). Not a physics regression — trace is green.");
    process.exit(2); // distinct code: known gap, not a regression
  }
}

main();
