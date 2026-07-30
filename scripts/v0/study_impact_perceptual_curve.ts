/**
 * Perceptual-curve study (2026-07-31, docs/impact_definition.md Phase 1 / Study 2).
 *
 * Question: between the physical endpoints, is felt intensity LINEAR in raw cArc
 * (px/frame), or curved? Method honors the relative-labels doctrine (felt levels
 * are comparable within a track; the same vocabulary is only softly comparable
 * across tracks):
 *
 *   - per-track AND pooled isotonic regression (PAVA) of felt level vs raw cArc,
 *     compared against the best linear fit: the R² gap is the evidence for
 *     curvature (isotonic ≥ linear always; a small gap ⇒ linear suffices);
 *   - the isotonic step function is printed so any bend is visible and locatable;
 *   - per-felt-level raw medians with bootstrap 90% CIs (the uniformity view).
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_perceptual_curve.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./impact_support.ts";

const SETS = ["impact_lab_v2", "climb_terrace", "rolling_drop", "staircase", "shelter_impact_2m", "believer_impact_2m"];
const firstExisting = (...paths: string[]) => paths.map((p) => resolve(p)).find(existsSync);

type Pt = { set: string; raw: number; felt: number };
const pts: Pt[] = [];
for (const name of SETS) {
  const trackPath = firstExisting(`generated/${name}.track.json`, `labels/impact/${name}.track.json`);
  const labelPath = firstExisting(`generated/impact-study/${name}.labels.json`, `labels/impact/${name}.labels.json`);
  if (!trackPath || !labelPath) continue;
  const sim = SS.simulateTrack(JSON.parse(readFileSync(trackPath, "utf8")));
  const raw = (JSON.parse(readFileSync(labelPath, "utf8")).labels ?? {}) as Record<string, { ordinal?: string | null }>;
  const levelsPath = firstExisting(`labels/impact/${name}.levels.json`);
  const overlay = levelsPath ? (JSON.parse(readFileSync(levelsPath, "utf8")).levels ?? {}) as Record<string, { felt: number }> : {};
  for (const [frameKey, a] of Object.entries(raw)) {
    const felt = a?.ordinal != null ? SS.FELT_ORDINAL[a.ordinal] : overlay[frameKey]?.felt;
    if (felt === undefined) continue;
    const lf = SS.landingNear(sim, Number(frameKey));
    if (lf < 0) continue;
    pts.push({ set: name, raw: SS.contactRedirArcPx(sim, lf), felt });
  }
}
console.log(`${pts.length} leveled beats across ${new Set(pts.map((p) => p.set)).size} tracks`);

// ── PAVA isotonic regression: fit monotone-nondecreasing ŷ(x) minimizing SSE ──
function isotonic(xs: number[], ys: number[]): number[] {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const y = idx.map((i) => ys[i]);
  const blocks: { sum: number; n: number }[] = y.map((v) => ({ sum: v, n: 1 }));
  let i = 0;
  while (i < blocks.length - 1) {
    if (blocks[i].sum / blocks[i].n > blocks[i + 1].sum / blocks[i + 1].n + 1e-12) {
      blocks[i] = { sum: blocks[i].sum + blocks[i + 1].sum, n: blocks[i].n + blocks[i + 1].n };
      blocks.splice(i + 1, 1);
      if (i > 0) i--;
    } else i++;
  }
  const fitSorted: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.n; k++) fitSorted.push(b.sum / b.n);
  const fit = new Array(xs.length);
  idx.forEach((orig, pos) => (fit[orig] = fitSorted[pos]));
  return fit;
}
function linFit(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length, mx = SS.mean(xs), my = SS.mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx > 1e-12 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}
const r2 = (ys: number[], fit: number[]) => {
  const my = SS.mean(ys);
  const ssTot = ys.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = ys.reduce((s, v, i) => s + (v - fit[i]) ** 2, 0);
  return ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;
};

// ── pooled + per-track fits ───────────────────────────────────────────────────
console.log(`\n=== isotonic vs linear R² (gap = evidence for curvature) ===`);
console.log(`  scope                      n   R²-linear  R²-isotonic   gap`);
function report(scope: string, sel: Pt[]) {
  if (sel.length < 5) return;
  const xs = sel.map((p) => p.raw), ys = sel.map((p) => p.felt);
  const { a, b } = linFit(xs, ys);
  const lin = xs.map((x) => a + b * x);
  const iso = isotonic(xs, ys);
  const rl = r2(ys, lin), ri = r2(ys, iso);
  console.log(`  ${scope.padEnd(24)} ${String(sel.length).padStart(4)}   ${rl.toFixed(3).padStart(8)}  ${ri.toFixed(3).padStart(10)}  ${(ri - rl).toFixed(3).padStart(6)}`);
}
report("POOLED (all tracks)", pts);
for (const s of SETS) report(s, pts.filter((p) => p.set === s));

// ── pooled isotonic steps: where does the curve bend? ────────────────────────
{
  const xs = pts.map((p) => p.raw), ys = pts.map((p) => p.felt);
  const iso = isotonic(xs, ys);
  const pairs = xs.map((x, i) => ({ x, y: iso[i] })).sort((u, v) => u.x - v.x);
  const steps: { from: number; to: number; y: number }[] = [];
  for (const p of pairs) {
    const last = steps[steps.length - 1];
    if (last && Math.abs(last.y - p.y) < 1e-9) last.to = p.x;
    else steps.push({ from: p.x, to: p.x, y: p.y });
  }
  console.log(`\n=== pooled isotonic step function (raw cArc px → felt level) ===`);
  for (const s of steps) console.log(`  raw ${s.from.toFixed(2).padStart(6)} – ${s.to.toFixed(2).padStart(6)}  →  felt ${s.y.toFixed(2)}`);
}

// ── per-level medians with bootstrap 90% CI ──────────────────────────────────
console.log(`\n=== per-felt-level raw cArc median [bootstrap 90% CI] ===`);
const bucket = (f: number) => Math.round(f * 2) / 2;
const levels = [...new Set(pts.map((p) => bucket(p.felt)))].sort((a, b) => a - b);
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (const lv of levels) {
  const xs = pts.filter((p) => bucket(p.felt) === lv).map((p) => p.raw);
  const meds: number[] = [];
  for (let b = 0; b < 1000; b++) {
    const rs = Array.from({ length: xs.length }, () => xs[Math.floor(rnd() * xs.length)]);
    meds.push(SS.pct(rs, 0.5));
  }
  console.log(`  felt ${String(lv).padStart(3)}  n=${String(xs.length).padStart(3)}  median ${SS.pct(xs, 0.5).toFixed(2).padStart(6)}  [${SS.pct(meds, 0.05).toFixed(2)}, ${SS.pct(meds, 0.95).toFixed(2)}]`);
}
