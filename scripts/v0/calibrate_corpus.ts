/**
 * calibrate_corpus — the clean calibration tool. Builds the impact-metric [0,1] scale from a
 * LARGE, DIVERSE sample: it takes every working spec in the repo and generates many perturbed
 * variants on the fly (each axis curve scaled by a few %, each impact target jittered, and
 * optionally a varied seed), compiles them all, measures every candidate metric at every
 * landing, and writes the percentile distribution. More + more-varied tracks ⇒ a more stable,
 * representative scale than raw single-seed compiles. Pure stats — no felt labels.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/calibrate_corpus.ts [--count=200] [--perturb=5] \
 *     [--budget=20000] [--seed-vary] [--out=generated/impact-study/corpus_percentiles.json]
 *
 *   --count    total variants across all specs (distributed round-robin)
 *   --perturb  per-value perturbation, percent (Gaussian σ); 0 = raw specs
 *   --seed-vary  also vary the compile seed per variant (else seed 0)
 *
 * Extensible to other axes later; for now it calibrates the impact-metric candidates.
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileHandoff } from "./optimizer/handoff.ts";
import { type Spec, type Curve } from "./types.ts";
import * as SS from "./study_support.ts";

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const COUNT = Number(arg("count") ?? "200");
const PCT = Number(arg("perturb") ?? "5") / 100;
const BUDGET = Number(arg("budget") ?? "20000");
const SEED_VARY = argv.includes("--seed-vary");
const OUT = resolve(arg("out") ?? "generated/impact-study/corpus_percentiles.json");

// deterministic RNG (reproducible runs) — Math.random/Date avoided on purpose.
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(rng: () => number, sigma: number) { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma; }
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const DIAG = /^(probe_|sanity$|first$|elev_bench$|drums_speed_test$)/;
function allSpecFiles(): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [];
  for (const dir of [resolve("scripts/v0/specs"), resolve("specs/golden")]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".ts") || f.startsWith("_")) continue;
      const name = f.replace(/\.ts$/, "");
      if (!DIAG.test(name) && !out.some((o) => o.name === name)) out.push({ name, path: resolve(dir, f) });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// candidate metrics (same set the dashboard/build use)
const METRICS: { key: string; unit: string; fn: (s: SS.Sim, f: number) => number }[] = [
  { key: "redir",    unit: "px/f",  fn: (s, f) => SS.redirPx(s, f) },
  { key: "redirArc", unit: "px/f",  fn: (s, f) => SS.redirArcPx(s, f) },
  { key: "redirDec", unit: "px/f",  fn: (s, f) => SS.redirDecayPx(s, f) },
  { key: "snap",     unit: "px/f²", fn: (s, f) => SS.snapPx(s, f) },
  { key: "turn",     unit: "deg",   fn: (s, f) => SS.turnNetDeg(s, f) },
  { key: "comDecel", unit: "px/f²", fn: (s, f) => SS.comDecelNormalPx(s, f) },
  { key: "decelDec", unit: "px/f²", fn: (s, f) => SS.comDecelDecayPx(s, f) },
];

// perturb a spec: per-axis coherent scale + per-contact impact jitter (curves are opaque
// functions, so axes are WRAPPED; contacts are plain numbers, so jittered directly).
function perturb(spec: Spec, rng: () => number): Spec {
  if (PCT <= 0) return spec;
  const axes: Record<string, Curve> = {};
  for (const [k, curve] of Object.entries(spec.axes)) {
    if (!curve) continue;
    const scale = clamp(1 + gauss(rng, PCT), 0.4, 1.8);
    axes[k] = (t: number) => { const v = curve(t); return v == null ? v : clamp(v * scale, 0, 0.99); };
  }
  const contacts = spec.contacts.map((c) => ({
    t: c.t,
    impact: c.impact == null ? undefined : clamp(c.impact * (1 + gauss(rng, PCT)), 0, 1),
  }));
  return { ...spec, axes, contacts };
}

const specs = allSpecFiles();
const perSpec = Math.max(1, Math.round(COUNT / specs.length));
console.log(`calibrate_corpus — ${specs.length} specs × ${perSpec} variants ≈ ${specs.length * perSpec} (perturb ±${PCT * 100}%, budget ${BUDGET}, seed-vary ${SEED_VARY})\n`);

const vals: Record<string, number[]> = Object.fromEntries(METRICS.map((m) => [m.key, []]));
let okVariants = 0, failVariants = 0, totalLandings = 0;
for (const { name, path } of specs) {
  let base: Spec;
  try { base = (await import(pathToFileURL(path).href)).default as Spec; }
  catch (e) { console.log(`  ${name.padEnd(24)} SPEC LOAD FAILED — skip`); continue; }
  let specOk = 0, specLand = 0;
  for (let i = 0; i < perSpec; i++) {
    const rng = mulberry32(hashStr(name) ^ (i * 0x9e3779b1));
    try {
      const { track } = compileHandoff(perturb(base, rng), SEED_VARY ? i : 0, { budget: BUDGET });
      const sim = SS.simulateTrack(track);
      let n = 0;
      for (const e of sim.det.events) {
        if (e.type !== "landing" || e.frame < 3 || e.frame > sim.last - 2) continue;
        if (SS.pointImpactPx(sim, e.frame) === undefined) continue;
        for (const m of METRICS) vals[m.key].push(m.fn(sim, e.frame));
        n++;
      }
      okVariants++; specOk++; specLand += n; totalLandings += n;
    } catch { failVariants++; }
  }
  console.log(`  ${name.padEnd(24)} ${String(specOk).padStart(2)}/${perSpec} variants  ${String(specLand).padStart(4)} landings`);
}

const P = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const PCTS = [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
console.log(`\n=== distribution across ${totalLandings} landings (${okVariants} variants ok, ${failVariants} failed) ===`);
console.log(`  metric      unit   ` + PCTS.map((p) => `p${Math.round(p * 100)}`.padStart(7)).join("") + `${"max".padStart(8)}`);
const out: Record<string, unknown> = {};
for (const m of METRICS) {
  const s = [...vals[m.key]].sort((a, b) => a - b);
  console.log(`  ${m.key.padEnd(10)} ${m.unit.padEnd(6)} ` + PCTS.map((p) => P(s, p).toFixed(2).padStart(7)).join("") + s[s.length - 1].toFixed(2).padStart(8));
  out[m.key] = {
    unit: m.unit, sorted: s.map((x) => Math.round(x * 1000) / 1000),
    pcts: Object.fromEntries(PCTS.map((p) => [`p${Math.round(p * 100)}`, Math.round(P(s, p) * 1000) / 1000])),
    capP95: Math.round(P(s, 0.95) * 1000) / 1000, capP99: Math.round(P(s, 0.99) * 1000) / 1000,
  };
}
mkdirSync(resolve(OUT, ".."), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: "calibrate_corpus", count: COUNT, perturb: PCT, budget: BUDGET, seedVary: SEED_VARY, window: SS.IMPACT_WINDOW, okVariants, failVariants, totalLandings, metrics: out }, null, 2) + "\n");
console.log(`\nwrote ${OUT}`);
