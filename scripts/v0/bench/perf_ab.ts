/**
 * perf_ab — interleaved A/B decision gate for engine-rs (WASM) perf changes.
 *
 * THE QUESTION IT ANSWERS
 *   Not "did the mean drop by >X%" but: given the measurements, what is the
 *   probability this change is genuinely faster? We accept a change when that
 *   probability is high — which keeps small-but-real wins and rejects
 *   large-but-noisy ones, replacing the arbitrary flat threshold.
 *
 * WHY THIS DESIGN (and why it's simple)
 *   - Per-run noise is large (~5% σ, GC/scheduling) but slow machine drift across
 *     minutes is small. INTERLEAVING base and candidate runs close together
 *     cancels that drift — so we compare them PAIRED, round by round.
 *   - To avoid any environment bias we do NOT use two directories. We run every
 *     timed pass in the SAME working dir and swap only the WASM BYTES at the
 *     engine load path between passes. Same JS, same cwd, identical everything
 *     except the kernel under test.
 *   - We don't reduce the decision to the mean. The data is the per-round paired
 *     difference; we report (a) a SIGN TEST — how many rounds the candidate won —
 *     and (b) P(candidate faster) from a paired bootstrap. Both are robust and
 *     directly interpretable.
 *
 * SCOPE: two modes.
 *   - default (WASM): swaps the built kernel between arms — measures engine-rs
 *     (Rust) changes. Builds the base kernel from `--ref` in a throwaway worktree.
 *   - `--js`: swaps the changed *.ts/*.js source files between arms (base =
 *     `git show <ref>:file`, cand = working copy), sharing the committed WASM for
 *     both arms — measures JS hot-path changes (detector/wrapper/compiler) with no
 *     rebuild. Same dir, so no environment bias either way.
 * Bit-identity is a SEPARATE gate (`LR_ENGINE=wasm npm run verify`); this only
 * decides speed once correctness is established.
 *
 * USAGE
 *   1. build your candidate kernel:  npm run build:wasm   (WASM mode only)
 *   2. tsx scripts/v0/bench/perf_ab.ts                  # base = HEAD, cand = working tree
 *      tsx scripts/v0/bench/perf_ab.ts --ref=HEAD~1 --rounds=100 --reps=8
 *      tsx scripts/v0/bench/perf_ab.ts --js --rounds=100               # JS/TS change A/B
 *      tsx scripts/v0/bench/perf_ab.ts --ref=<old-baseline> --rounds=100 --p=0.9987  # cumulative 3σ confirm
 */
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const arg = (k: string, d: string) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k: string) => process.argv.includes(`--${k}`);

const rounds = Number(arg("rounds", "100"));
const reps = Number(arg("reps", "8"));
const warmup = Number(arg("warmup", "1"));
const specs = arg("specs", "mini_burst");
const budget = arg("budget", "50000");
const ref = arg("ref", "HEAD");
const keepThreshold = Number(arg("p", "0.95")); // accept if P(faster) ≥ this
const jsMode = flag("js"); // A/B a JS/TS change by swapping source files (no WASM rebuild)
const bootIters = 50000;

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const LOAD_PATH = resolve(
  repoRoot,
  "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm",
);

// ── prepare the two kernels as plain files; all timed passes run in repoRoot ──
const tmp = mkdtempSync(join(tmpdir(), "perf_ab_"));
const candWasm = join(tmp, "cand.wasm");
const baseWasm = join(tmp, "base.wasm");

function buildBase() {
  // Build HEAD's (or --ref's) kernel in a throwaway worktree, copy the artifact
  // out, then discard the worktree. The worktree is only used to COMPILE the base
  // kernel — never to run a timed pass — so it cannot introduce an env bias.
  const wt = join(tmp, "wt");
  execSync(`git worktree add --detach --force ${wt} ${ref}`, { cwd: repoRoot, stdio: "inherit" });
  try {
    execSync("cargo build --release --target wasm32-unknown-unknown --manifest-path engine-rs/Cargo.toml", { cwd: wt, stdio: "ignore" });
    const raw = join(wt, "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm");
    execSync(`wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext -O3 ${raw} -o ${baseWasm}`, { stdio: "ignore" });
  } finally {
    execSync(`git worktree remove --force ${wt}`, { cwd: repoRoot, stdio: "ignore" });
  }
}

function runPerf(): number {
  const out = execFileSync(
    "node",
    ["--max-semi-space-size=64", "--import", "tsx", "scripts/v0/bench/perf.ts",
     `--specs=${specs}`, `--budget=${budget}`, `--reps=${reps}`, `--warmup=${warmup}`],
    { cwd: repoRoot, env: { ...process.env, LR_ENGINE: "wasm" }, encoding: "utf8", maxBuffer: 1 << 24 },
  );
  const line = out.split("\n").find((l) => l.startsWith("PERF "));
  if (!line) throw new Error("no PERF line");
  return JSON.parse(line.slice(5)).ns_per_frame_mean as number;
}
// JS mode: A/B a JS/TS change with no WASM rebuild. We snapshot every source file
// that differs from `ref` (base = `git show ref:file`, cand = working copy) and
// swap them in place between passes — same dir, same committed WASM for both arms,
// so only the changed JS differs. tsx reads sources at process start, so swapping
// before each spawned `perf` pass is sufficient.
const jsFiles: string[] = [];
const baseSrc: Record<string, string> = {};
const candSrc: Record<string, string> = {};
function setupJs() {
  const out = execSync(`git diff --name-only ${ref} -- '*.ts' '*.js' '*.mjs'`, { cwd: repoRoot }).toString().trim();
  for (const f of out.split("\n").filter(Boolean)) {
    jsFiles.push(f);
    baseSrc[f] = execSync(`git show ${ref}:${f}`, { cwd: repoRoot, maxBuffer: 1 << 26 }).toString();
    candSrc[f] = readFileSync(resolve(repoRoot, f), "utf8");
  }
}
function restoreJs() {
  for (const f of jsFiles) writeFileSync(resolve(repoRoot, f), candSrc[f]);
}
function measure(which: "base" | "cand"): number {
  if (jsMode) {
    for (const f of jsFiles) writeFileSync(resolve(repoRoot, f), which === "base" ? baseSrc[f] : candSrc[f]);
  } else {
    copyFileSync(which === "base" ? baseWasm : candWasm, LOAD_PATH);
  }
  return runPerf();
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
let _seed = 0x2545f491;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };

async function main() {
  if (!existsSync(LOAD_PATH)) throw new Error(`no kernel at ${LOAD_PATH} — run 'npm run build:wasm' first`);
  console.log(`perf_ab: base=${ref}  cand=working-tree   rounds=${rounds} reps=${reps} specs=${specs} budget=${budget}` + (jsMode ? "  [JS mode]" : ""));
  if (jsMode) {
    setupJs();
    if (jsFiles.length === 0) throw new Error(`--js: no changed *.ts/*.js files vs ${ref}`);
    console.log(`swapping ${jsFiles.length} source file(s): ${jsFiles.join(", ")}  (shared WASM for both arms)`);
  } else {
    copyFileSync(LOAD_PATH, candWasm); // snapshot the current (candidate) build
    console.log(`building base kernel (${ref}) …`);
    buildBase();
    const h = (f: string) => execSync(`md5sum ${f}`).toString().slice(0, 12);
    const sameBytes = h(baseWasm) === h(candWasm);
    console.log(`kernels: base=${h(baseWasm)} cand=${h(candWasm)}` +
      (sameBytes ? "  (BYTE-IDENTICAL — zero build-layout floor; this is a null)" : ""));
  }

  // warmup (untimed) one of each
  measure("base"); measure("cand");

  const diffPct: number[] = [];
  let candWins = 0;
  const baseAll: number[] = [], candAll: number[] = [];
  for (let r = 0; r < rounds; r++) {
    let b: number, c: number;
    if (r % 2 === 0) { b = measure("base"); c = measure("cand"); }
    else { c = measure("cand"); b = measure("base"); }
    baseAll.push(b); candAll.push(c);
    const d = (100 * (c - b)) / b;
    diffPct.push(d);
    if (c < b) candWins++;
    console.log(`round ${String(r + 1).padStart(2)}: base=${b.toFixed(1)}  cand=${c.toFixed(1)}  Δ=${d >= 0 ? "+" : ""}${d.toFixed(2)}%  ${c < b ? "cand✓" : "base✓"}`);
  }
  if (jsMode) restoreJs(); else copyFileSync(candWasm, LOAD_PATH); // restore working state

  // paired bootstrap over rounds → P(candidate truly faster) and 95% CI on Δ
  let pFaster = 0;
  const bootMeans: number[] = [];
  for (let i = 0; i < bootIters; i++) {
    let s = 0;
    for (let j = 0; j < rounds; j++) s += diffPct[(rnd() * rounds) | 0];
    const m = s / rounds;
    bootMeans.push(m);
    if (m < 0) pFaster++;
  }
  pFaster /= bootIters;
  bootMeans.sort((a, b) => a - b);
  const lo = bootMeans[(0.025 * bootIters) | 0], hi = bootMeans[(0.975 * bootIters) | 0];

  // sign test: P(observed win-count or more extreme | coin flip), two-sided
  const binomTail = (k: number, n: number) => { // P(X>=k) for fair coin
    let p = 0; const logC = (n: number, r: number) => { let s = 0; for (let i = 0; i < r; i++) s += Math.log(n - i) - Math.log(i + 1); return s; };
    for (let i = k; i <= n; i++) p += Math.exp(logC(n, i) + n * Math.log(0.5)); return p;
  };
  const wins = Math.max(candWins, rounds - candWins);
  const signP = Math.min(1, 2 * binomTail(wins, rounds));

  console.log(`\n── decision (Δ = candidate vs base; negative = candidate faster) ──`);
  console.log(`base mean        : ${mean(baseAll).toFixed(1)} ns/frame`);
  console.log(`cand mean        : ${mean(candAll).toFixed(1)} ns/frame`);
  console.log(`Δ median / mean  : ${median(diffPct).toFixed(2)}% / ${mean(diffPct).toFixed(2)}%`);
  console.log(`Δ 95% CI         : [${lo.toFixed(2)}%, ${hi.toFixed(2)}%]`);
  console.log(`sign test        : candidate won ${candWins}/${rounds} rounds  (two-sided p=${signP.toFixed(3)})`);
  console.log(`P(candidate faster): ${(100 * pFaster).toFixed(1)}%   [paired bootstrap, ${bootIters} resamples]`);
  // Keep requires BOTH a high P(faster) (mean-bootstrap favorable) AND a negative
  // median Δ — the latter guards against heavy-tailed cases where a few large-Δ
  // rounds pull the mean favorable while the typical round is actually slower.
  const medNeg = median(diffPct) < 0;
  const keep = pFaster >= keepThreshold && medNeg;
  const reject = (1 - pFaster) >= keepThreshold;
  console.log(`verdict          : ${keep ? `✓ KEEP — P(faster)=${(100 * pFaster).toFixed(1)}% ≥ ${(100 * keepThreshold).toFixed(0)}% and median Δ<0, ~${(-median(diffPct)).toFixed(2)}% faster`
    : reject ? `✗ REJECT — likely a regression (P(faster)=${(100 * pFaster).toFixed(1)}%)`
    : pFaster >= keepThreshold && !medNeg ? `~ INCONCLUSIVE — P(faster)=${(100 * pFaster).toFixed(1)}% but median Δ≥0 (heavy-tailed; not kept)`
    : `~ INCONCLUSIVE — P(faster)=${(100 * pFaster).toFixed(1)}% (need more rounds, or effect ≈ 0)`}`);

  rmSync(tmp, { recursive: true, force: true });
}
main().catch((e) => { try { if (jsMode) restoreJs(); else copyFileSync(candWasm, LOAD_PATH); } catch {} console.error(e); process.exit(1); });
