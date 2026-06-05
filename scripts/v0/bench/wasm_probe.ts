/**
 * Phase-0a smoke test: prove the cargo→wasm→Node pipeline + f64 bit-identity.
 *
 * Loads the Rust kernel via raw WebAssembly.instantiate (the loader pattern the
 * real engine will use — no wasm-bindgen), then checks that (a) f64.sqrt and
 * (b) a representative stick-solve op-chain produce BIT-IDENTICAL results to V8.
 * Exact-double comparison (JS === on doubles is exact).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WASM = "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm";

// deterministic varied f64 generator (mulberry32-ish, scaled across ranges)
function* values(n: number): Generator<number> {
  let s = 0x9e3779b9 >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // include exact physics-relevant constants first
  for (const v of [0, 0.175, 0.4, 5, 10, 15, 17.5, -5.5, 1e-12, 1e6]) yield v;
  for (let i = 0; i < n; i++) {
    const r = next();
    const scale = [1e-6, 1, 14, 100, 3000, 1e5][i % 6];
    yield (r - 0.5) * 2 * scale;
  }
}

function main() {
  const bytes = readFileSync(resolve(WASM));
  const mod = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(mod, {});
  const ex = instance.exports as {
    memory: WebAssembly.Memory;
    buf_ptr: () => number;
    buf_len: () => number;
    probe_sqrt: (x: number) => number;
    probe_chain: (n: number) => void;
  };

  // ── 1. scalar sqrt bit-identity ──
  let sqrtChecked = 0;
  let sqrtMismatch = 0;
  for (const v of values(50000)) {
    const x = Math.abs(v); // sqrt domain
    const w = ex.probe_sqrt(x);
    const j = Math.sqrt(x);
    sqrtChecked++;
    // exact bit compare (handles -0/NaN edge via Object.is)
    if (!Object.is(w, j)) {
      sqrtMismatch++;
      if (sqrtMismatch <= 3) console.log(`  sqrt mismatch: x=${x}  wasm=${w}  js=${j}`);
    }
  }

  // ── 2. representative op-chain bit-identity ──
  const buf = new Float64Array(ex.memory.buffer, ex.buf_ptr(), ex.buf_len());
  const groups = 1000;
  const n = groups * 4;
  const input: number[] = [];
  const gen = values(n + 16);
  for (let i = 0; i < n; i++) input.push(gen.next().value as number);
  for (let i = 0; i < n; i++) buf[i] = input[i];

  ex.probe_chain(n);

  // JS reference mirroring lib.rs probe_chain exactly
  const rest = 10.0;
  let chainChecked = 0;
  let chainMismatch = 0;
  for (let g = 0; g < groups; g++) {
    const i = g * 4;
    const x1 = input[i], y1 = input[i + 1], x2 = input[i + 2], y2 = input[i + 3];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const diff = (len === 0 ? 0 : (len - rest) / len) * 0.5;
    const ex1 = x1 - (x1 - x2) * diff;
    const ey1 = y1 - (y1 - y2) * diff;
    chainChecked += 2;
    if (!Object.is(buf[i], ex1)) { chainMismatch++; if (chainMismatch <= 3) console.log(`  chain.x mismatch g=${g}: wasm=${buf[i]} js=${ex1}`); }
    if (!Object.is(buf[i + 1], ey1)) { chainMismatch++; if (chainMismatch <= 3) console.log(`  chain.y mismatch g=${g}: wasm=${buf[i + 1]} js=${ey1}`); }
  }

  console.log("");
  console.log(`sqrt   : ${sqrtChecked} checked, ${sqrtMismatch} bit-mismatches`);
  console.log(`chain  : ${chainChecked} checked, ${chainMismatch} bit-mismatches`);
  console.log("");
  if (sqrtMismatch === 0 && chainMismatch === 0) {
    console.log("WASM-PROBE: PASS — f64 arithmetic + sqrt are bit-identical to V8. Pipeline works.");
  } else {
    console.log("WASM-PROBE: FAIL — bit divergence detected (see above).");
    process.exit(1);
  }
}

main();
