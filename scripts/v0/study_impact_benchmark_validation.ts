/**
 * Benchmark-dataset revalidation (2026-07-31): compile the CANONICAL Benchmark V2
 * development inventory (the benchmark's own manifest → resolveSources →
 * loadSourceSpec chain, compileHandoff, no jolt) across seeds, and rerun the
 * whole impact-calibration battery on that dataset:
 *
 *   0. authored-ask histogram (sanity vs the catalog distribution)
 *   A. asked → achieved response per ask band (old norm + cArc/V_NEW) + miss rate
 *   B. meaning-shift audit: V* re-derived on THIS corpus; shift at the old anchor
 *      (7.29), the shipped anchor (V_NEW = REDIRARC.VERY_STRONG), 7.85 and 11.3
 *   C. ceiling law: in-window turn (cArc/speedIn) distribution + violations > 1.0 rad
 *   D. redirArc reversal pathology census (net turn > 2.5 rad) — the old metric's
 *      failure mode frequency on canonical content
 *   E. per-seed envelope stability
 *   F. visible-divergence rate |newNorm − oldNorm| > 0.1
 *
 * "old norm" throughout = clamp(redirArc / OLD_VSTRONG) with OLD_VSTRONG frozen at the
 * PRE-promotion 7.29 — deliberately not the live REDIRARC.VERY_STRONG, so the drift is
 * measured against what shipped before the cArc promotion rather than against itself.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_benchmark_validation.ts \
 *     [--seeds=0,1,2] [--budget=750000] [--manifest=benchmark/v2/compat/source-manifest.json]
 *
 * Writes generated/benchmark-v2/impact_validation_dataset.json (per-landing rows).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./impact_support.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { loadSourceManifest, resolveSources, loadSourceSpec } from "./benchmark_v2/model.ts";
import { REDIRARC } from "./types.ts";

const argv = process.argv.slice(2);
const arg = (name: string, dflt: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
const SEEDS = arg("seeds", "0,1,2").split(",").map(Number);
const BUDGET = Number(arg("budget", "750000"));
const MANIFEST = arg("manifest", "benchmark/v2/compat/source-manifest.json");
const V_NEW = REDIRARC.VERY_STRONG; // the SHIPPED cArc anchor (docs/impact_definition.md Calibration)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Pre-promotion `REDIRARC.VERY_STRONG` — the baseline this validation measures drift AGAINST.
 *  Frozen on purpose: it must NOT follow the live anchor, or the meaning-shift audit compares
 *  the new metric against a baseline that already absorbed the new anchor (self-referential V*). */
const OLD_VSTRONG = 7.29;
/** The pre-promotion `normImpact`: SOFT was 0 before and after, so the divide is exact. */
const oldNorm = (px: number) => clamp01(px / OLD_VSTRONG);

const sources = resolveSources(loadSourceManifest(MANIFEST));
console.log(`${sources.length} canonical sources · seeds [${SEEDS.join(",")}] · budget ${BUDGET}`);

type Land = {
  src: string; seed: number; frame: number;
  ask: number | null; hit: boolean;
  speedIn: number; redirArc: number; cArc: number; contact14: number;
};
const lands: Land[] = [];
const askAll: number[] = [];
const missByAsk: { ask: number }[] = [];
const t0 = Date.now();

for (const source of sources) {
  let spec;
  try { spec = await loadSourceSpec(source); } catch (e) { console.log(`  SKIP ${source.id}: ${String(e).slice(0, 90)}`); continue; }
  const askByT = new Map(spec.contacts.filter((c) => c.impact !== undefined).map((c) => [c.t.toFixed(3), c.impact!]));
  for (const c of spec.contacts) if (c.impact !== undefined) askAll.push(c.impact);
  for (const seed of SEEDS) {
    const tc = Date.now();
    let compiled;
    try { compiled = compileHandoff(spec, seed, { budget: BUDGET }); } catch (e) { console.log(`  FAIL ${source.id} s${seed}: ${String(e).slice(0, 90)}`); continue; }
    const { track, report } = compiled;
    const sim = SS.simulateTrack(track);
    const claimed = new Set<number>();
    for (const c of report.contacts) {
      const ask = askByT.get(c.t_target.toFixed(3)) ?? null;
      if (c.status !== "hit") { if (ask !== null) missByAsk.push({ ask }); continue; }
      const lf = SS.landingNear(sim, Math.round(c.t_actual * 40));
      if (lf < 0) { if (ask !== null) missByAsk.push({ ask }); continue; }
      claimed.add(lf);
      lands.push(measure(source.id, seed, sim, lf, ask, true));
    }
    for (const e of sim.det.events) { // unauthored landings join the corpus rows (ask null)
      if (e.type !== "landing" || e.frame < 2 || e.frame > sim.last - 1 || claimed.has(e.frame)) continue;
      lands.push(measure(source.id, seed, sim, e.frame, null, false));
    }
    console.log(`  ${source.id} s${seed}: ${report.contacts.length} contacts (${((Date.now() - tc) / 1000).toFixed(1)}s)`);
  }
}
function measure(src: string, seed: number, sim: SS.Sim, lf: number, ask: number | null, hit: boolean): Land {
  const v = sim.vel[lf - 1] ?? sim.vel[lf];
  let contact14 = 0;
  for (let f = lf; f <= Math.min(sim.last, lf + 14); f++) if ((sim.cids[f] ?? []).length > 0) contact14++;
  return {
    src, seed, frame: lf, ask, hit,
    speedIn: v ? Math.hypot(v.x, v.y) : 0,
    redirArc: SS.redirArcPx(sim, lf), cArc: SS.contactRedirArcPx(sim, lf), contact14,
  };
}
console.log(`\ndataset: ${lands.length} landings (${lands.filter((l) => l.ask !== null).length} authored) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
mkdirSync(resolve("generated/benchmark-v2"), { recursive: true });
writeFileSync(resolve("generated/benchmark-v2/impact_validation_dataset.json"), JSON.stringify({ seeds: SEEDS, budget: BUDGET, lands }));

// ── 0: ask histogram sanity ───────────────────────────────────────────────────
console.log(`\n=== 0: authored-ask distribution (this inventory) ===`);
console.log(`  n=${askAll.length}  mean ${SS.mean(askAll).toFixed(3)}  p10 ${SS.pct(askAll, 0.1).toFixed(2)}  p50 ${SS.pct(askAll, 0.5).toFixed(2)}  p90 ${SS.pct(askAll, 0.9).toFixed(2)}`);

// ── A: asked → achieved ───────────────────────────────────────────────────────
const authored = lands.filter((l) => l.ask !== null);
console.log(`\n=== A: asked → achieved (median per ask band; miss rate incl.) ===`);
console.log(`   band        n  miss%   old-norm  cArc/${V_NEW}`);
for (let lo = 0; lo < 1; lo += 0.125) {
  const rs = authored.filter((l) => l.ask! >= lo && l.ask! < lo + 0.125 + (lo >= 0.875 ? 1e-9 : 0));
  const misses = missByAsk.filter((m) => m.ask >= lo && m.ask < lo + 0.125 + (lo >= 0.875 ? 1e-9 : 0)).length;
  if (!rs.length && !misses) continue;
  const mOld = rs.length ? SS.pct(rs.map((r) => oldNorm(r.redirArc)), 0.5) : NaN;
  const mNew = rs.length ? SS.pct(rs.map((r) => clamp01(r.cArc / V_NEW)), 0.5) : NaN;
  console.log(`  [${lo.toFixed(3)},${(lo + 0.125).toFixed(3)}) ${String(rs.length).padStart(5)}  ${(100 * misses / Math.max(1, rs.length + misses)).toFixed(0).padStart(4)}%   ${mOld.toFixed(2).padStart(7)}  ${mNew.toFixed(2).padStart(8)}`);
}

// ── B: meaning shift ──────────────────────────────────────────────────────────
const shiftAt = (V: number) => {
  const ds = lands.map((r) => Math.abs(clamp01(r.cArc / V) - oldNorm(r.redirArc)));
  return { mean: SS.mean(ds), p90: SS.pct(ds, 0.9) };
};
let bestV = OLD_VSTRONG, bestMean = Infinity;
for (let V = 6; V <= 13; V += 0.05) { const { mean } = shiftAt(V); if (mean < bestMean) { bestMean = mean; bestV = V; } }
console.log(`\n=== B: meaning shift vs anchor V (this corpus) ===`);
// old anchor · shipped anchor · 7.85 (historical calibration candidate) · this corpus' V* · atlas top
for (const V of [...new Set([OLD_VSTRONG, V_NEW, 7.85, bestV, 11.3])].sort((a, b) => a - b)) {
  const { mean, p90 } = shiftAt(V);
  console.log(`  V=${V.toFixed(2).padStart(5)}  mean ${mean.toFixed(3)}  p90 ${p90.toFixed(3)}${Math.abs(V - bestV) < 0.03 ? "   ← V* on this corpus" : ""}`);
}

// ── C: ceiling law ────────────────────────────────────────────────────────────
const withSpeed = lands.filter((l) => l.speedIn > 1e-6);
const turns = withSpeed.map((l) => l.cArc / l.speedIn);
const over = withSpeed.filter((l) => l.cArc / l.speedIn > 1.0).sort((a, b) => b.cArc / b.speedIn - a.cArc / a.speedIn);
console.log(`\n=== C: ceiling law — in-window turn (rad) on ${withSpeed.length} landings ===`);
console.log(`  p50 ${SS.pct(turns, 0.5).toFixed(2)}  p90 ${SS.pct(turns, 0.9).toFixed(2)}  p99 ${SS.pct(turns, 0.99).toFixed(2)}  max ${Math.max(...turns).toFixed(2)}  · >1.0 rad: ${over.length} (${(100 * over.length / withSpeed.length).toFixed(2)}%)`);
for (const r of over.slice(0, 5)) console.log(`    ${r.src} s${r.seed} f${r.frame}: speed ${r.speedIn.toFixed(1)} cArc ${r.cArc.toFixed(2)} turn ${(r.cArc / r.speedIn).toFixed(2)} contact14 ${r.contact14}`);

// ── D: redirArc reversal pathology census ─────────────────────────────────────
const reversals = withSpeed.filter((l) => l.speedIn > 1e-6 && l.redirArc / l.speedIn > 2.5);
console.log(`\n=== D: redirArc net-turn > 2.5 rad (reversal pathology): ${reversals.length}/${withSpeed.length} ===`);
for (const r of reversals.slice(0, 5)) console.log(`    ${r.src} s${r.seed} f${r.frame}: netturn ${(r.redirArc / r.speedIn).toFixed(2)} rad — oldnorm ${oldNorm(r.redirArc).toFixed(2)} vs newnorm ${clamp01(r.cArc / V_NEW).toFixed(2)}`);

// ── E: per-seed envelope ──────────────────────────────────────────────────────
console.log(`\n=== E: cArc envelope by seed ===`);
for (const seed of SEEDS) {
  const xs = lands.filter((l) => l.seed === seed).map((l) => l.cArc);
  console.log(`  seed ${seed}: n=${xs.length}  p50 ${SS.pct(xs, 0.5).toFixed(2)}  p90 ${SS.pct(xs, 0.9).toFixed(2)}  p99 ${SS.pct(xs, 0.99).toFixed(2)}`);
}

// ── F: visible-divergence rate ────────────────────────────────────────────────
const div = lands.filter((r) => Math.abs(clamp01(r.cArc / V_NEW) - oldNorm(r.redirArc)) > 0.1);
console.log(`\n=== F: landings where |newNorm − oldNorm| > 0.1: ${div.length}/${lands.length} (${(100 * div.length / lands.length).toFixed(1)}%) ===`);
