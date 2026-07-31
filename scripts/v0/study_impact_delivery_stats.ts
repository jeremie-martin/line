/**
 * Impact delivery DISTRIBUTIONS (2026-07-31) — the full statistical picture behind
 * the mean-only band table in docs/impact_contract.md.
 *
 * Means hide the thing we actually want to know: not "what do we typically get"
 * but "what are we SOMETIMES able to get" — the p90/p99 tail is the evidence for
 * how much headroom the compiler has, and the spread is the evidence for how
 * reliable a given ask is.
 *
 * Reads the saved dataset from `study_impact_error_split.ts` (no recompile):
 *   generated/benchmark-v2/impact_error_split.json
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_delivery_stats.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("generated/benchmark-v2/impact_error_split.json");
if (!existsSync(path)) {
  console.error(`missing ${path} — run study_impact_error_split.ts first`);
  process.exit(1);
}
type Row = { src: string; seed: number; ask: number; achieved: number; bound: number; ceiling: number };
const { rows, seeds, budget } = JSON.parse(readFileSync(path, "utf8")) as
  { rows: Row[]; seeds: number[]; budget: number };
console.log(`${rows.length} authored impact contacts · ${new Set(rows.map((r) => r.src)).size} sources · seeds [${seeds.join(",")}] @${budget}`);

// ── stats helpers ─────────────────────────────────────────────────────────────
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length));
};
function describe(label: string, xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  console.log(
    `  ${label.padEnd(22)} n=${String(xs.length).padStart(5)}  mean ${mean(xs).toFixed(3)}  sd ${sd(xs).toFixed(3)}  ` +
    `min ${s[0].toFixed(2)}  p10 ${pct(s, 0.10).toFixed(2)}  p25 ${pct(s, 0.25).toFixed(2)}  p50 ${pct(s, 0.50).toFixed(2)}  ` +
    `p75 ${pct(s, 0.75).toFixed(2)}  p90 ${pct(s, 0.90).toFixed(2)}  p95 ${pct(s, 0.95).toFixed(2)}  p99 ${pct(s, 0.99).toFixed(2)}  max ${s[s.length - 1].toFixed(2)}`,
  );
}

console.log(`\n=== overall distributions ===`);
describe("AUTHORED ask", rows.map((r) => r.ask));
describe("ACHIEVED", rows.map((r) => r.achieved));
describe("gap (ask − ach)", rows.map((r) => r.ask - r.achieved));
describe("|error|", rows.map((r) => Math.abs(r.ask - r.achieved)));

// ── histograms ────────────────────────────────────────────────────────────────
function histogram(label: string, xs: number[], width = 54) {
  const bins = new Array(20).fill(0);
  for (const x of xs) bins[Math.min(19, Math.max(0, Math.floor(x * 20)))]++;
  const top = Math.max(...bins);
  console.log(`\n=== ${label} (n=${xs.length}) ===`);
  for (let i = 0; i < 20; i++) {
    const lo = (i / 20).toFixed(2), hi = ((i + 1) / 20).toFixed(2);
    const shareOfTotal = (100 * bins[i] / xs.length).toFixed(1).padStart(4);
    console.log(`  ${lo}–${hi} ${String(bins[i]).padStart(5)} ${shareOfTotal}%  ${"#".repeat(Math.round(width * bins[i] / Math.max(1, top)))}`);
  }
}
histogram("AUTHORED ask distribution", rows.map((r) => r.ask));
histogram("ACHIEVED distribution", rows.map((r) => r.achieved));

// ── per ask band: the spread, not just the mean ───────────────────────────────
console.log(`\n=== achieved, per authored-ask band (the tail is the headroom evidence) ===`);
console.log(`   band          n   mean±sd        p10   p50   p90   p95   p99   max   %hitting the ask`);
for (let lo = 0; lo < 1; lo += 0.125) {
  const hi = lo + 0.125;
  const rs = rows.filter((r) => r.ask >= lo && r.ask < hi + (hi >= 1 ? 1e-9 : 0));
  if (!rs.length) continue;
  const a = [...rs.map((r) => r.achieved)].sort((x, y) => x - y);
  const hitting = 100 * rs.filter((r) => r.achieved >= r.ask - 0.05).length / rs.length;
  console.log(
    `  [${lo.toFixed(3)},${hi.toFixed(3)}) ${String(rs.length).padStart(5)}  ${mean(a).toFixed(2)}±${sd(a).toFixed(2)}   ` +
    `${pct(a, 0.10).toFixed(2)}  ${pct(a, 0.50).toFixed(2)}  ${pct(a, 0.90).toFixed(2)}  ${pct(a, 0.95).toFixed(2)}  ${pct(a, 0.99).toFixed(2)}  ${a[a.length - 1].toFixed(2)}   ${hitting.toFixed(0)}%`,
  );
}

// ── reachability: how often is a given level reached AT ALL? ──────────────────
console.log(`\n=== reachability — share of ALL landings that achieved at least X ===`);
const ach = [...rows.map((r) => r.achieved)].sort((a, b) => a - b);
for (const x of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
  const n = ach.filter((a) => a >= x).length;
  console.log(`  ≥ ${x.toFixed(2)}   ${String(n).padStart(5)}  ${(100 * n / ach.length).toFixed(1).padStart(5)}%`);
}

// ── the soft end, specifically (the authoring range the user wants to open up) ─
console.log(`\n=== the soft end (what happens when we DO ask gently) ===`);
for (const [lo, hi] of [[0, 0.05], [0.05, 0.1], [0.1, 0.15], [0.15, 0.2], [0.2, 0.3]] as const) {
  const rs = rows.filter((r) => r.ask >= lo && r.ask < hi);
  if (!rs.length) { console.log(`  ask [${lo},${hi})  — none authored`); continue; }
  const a = [...rs.map((r) => r.achieved)].sort((x, y) => x - y);
  console.log(`  ask [${lo},${hi})  n=${String(rs.length).padStart(4)}  achieved mean ${mean(a).toFixed(3)}  p10 ${pct(a, 0.1).toFixed(2)}  p50 ${pct(a, 0.5).toFixed(2)}  p90 ${pct(a, 0.9).toFixed(2)}  min ${a[0].toFixed(2)}`);
}
console.log(`\n  How soft CAN a landing be? Softest achieved anywhere in the corpus: ${ach[0].toFixed(3)}`);
console.log(`  Share of all landings under 0.10 achieved: ${(100 * ach.filter((a) => a < 0.1).length / ach.length).toFixed(1)}%`);
console.log(`  Share under 0.05: ${(100 * ach.filter((a) => a < 0.05).length / ach.length).toFixed(1)}%`);
