/**
 * Corpus calibration for the impact metrics — PURE STATS, no felt labels involved.
 *
 * Compiles a representative corpus of specs, measures every kept candidate metric at every
 * landing, and reports each metric's distribution + a percentile mapping. The percentile
 * map ("this raw value sits at the Nth percentile of all landings the compiler makes")
 * gives an apples-to-apples [0,1] scale across metrics with no hand-picked cap, and answers
 * "what are the typical values?". Felt labels are NOT used here — they are a separate
 * yardstick applied afterward (study_impact_labels.ts / the felt overlay).
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_corpus.ts [--budget=40000] [spec ...]
 *
 * Writes generated/impact-study/corpus_percentiles.json (per-metric sorted raw values +
 * percentile breakpoints + suggested caps) for the dashboard / scorer to map against.
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileHandoff } from "./optimizer/handoff.ts";
import { type Spec } from "./types.ts";
import * as SS from "./impact_support.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const budget = Number(arg("budget") ?? "40000");

// Default corpus: golden specs purpose-built to span density × speed × air (wide range),
// plus all believer + shelter production specs (the real/recent tracks). Probe/diagnostic
// specs are deliberately excluded — they'd skew the distribution with artificial impacts.
const DEFAULT_CORPUS = [
  "big_air_ramp", "swoop_dive", "skyline_push", "rolling_drop", "leap_cadence", "summit_push",
  "dense_sprint", "dense_echo_climb", "syncopated_switchback", "tiny_dance", "mini_burst",
  "rolling_hills", "valley_bounce", "float_bounds", "mixed_grade", "climb_terrace",
  "drums_signature", "drums_pulse",
  "believer_curves", "believer_impact",
  "shelter_amp", "shelter_curves", "shelter_impact", "shelter_impact_sync",
];
// --all globs every real spec in the repo (both spec dirs), excluding _-prefixed and the
// narrow diagnostic rigs that would skew the distribution.
const DIAG = /^(probe_|sanity$|first$|elev_bench$|drums_speed_test$)/;
function allSpecs(): string[] {
  const names = new Set<string>();
  for (const dir of [resolve("scripts/v0/specs"), resolve("specs/golden")]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".ts") || f.startsWith("_")) continue;
      const n = f.replace(/\.ts$/, "");
      if (!DIAG.test(n)) names.add(n);
    }
  }
  return [...names].sort();
}
const SPECS = argv.filter((a) => !a.startsWith("--"));
const CORPUS = argv.includes("--all") ? allSpecs() : (SPECS.length ? SPECS : DEFAULT_CORPUS);

async function loadSpec(name: string): Promise<Spec> {
  const p = [resolve(`scripts/v0/specs/${name}.ts`), resolve(`specs/golden/${name}.ts`), resolve(`specs/${name}.ts`)].find(existsSync);
  if (!p) throw new Error(`spec ${name} not found`);
  return (await import(pathToFileURL(p).href)).default as Spec;
}

// The six live contenders, raw units (the dashboard/build_impact_study mirror this set).
const METRICS: { key: string; label: string; unit: string; fn: (s: SS.Sim, f: number) => number }[] = [
  { key: "redir",    label: "REDIR",    unit: "px/f",  fn: (s, f) => SS.redirPx(s, f) },
  { key: "redirArc", label: "REDIRarc", unit: "px/f",  fn: (s, f) => SS.redirArcPx(s, f) },
  { key: "redirDec", label: "REDIR·on", unit: "px/f",  fn: (s, f) => SS.redirDecayPx(s, f) },
  { key: "snap",     label: "SNAP",     unit: "px/f²", fn: (s, f) => SS.snapPx(s, f) },
  { key: "turn",     label: "TURN",     unit: "deg",   fn: (s, f) => SS.turnNetDeg(s, f) },
  { key: "comDecel", label: "DECEL",    unit: "px/f²", fn: (s, f) => SS.comDecelNormalPx(s, f) },
  { key: "decelDec", label: "DECEL·on", unit: "px/f²", fn: (s, f) => SS.comDecelDecayPx(s, f) },
];

const vals: Record<string, number[]> = Object.fromEntries(METRICS.map((m) => [m.key, []]));
let totalLandings = 0;
console.log(`corpus calibration — ${CORPUS.length} specs, budget ${budget}, W=${SS.IMPACT_WINDOW}\n`);
for (const name of CORPUS) {
  let n = 0;
  try {
    const spec = await loadSpec(name);
    const { track } = compileHandoff(spec, 0, { budget });
    const sim = SS.simulateTrack(track);
    for (const e of sim.det.events) {
      if (e.type !== "landing" || e.frame < 3 || e.frame > sim.last - 2) continue;
      if (SS.pointImpactPx(sim, e.frame) === undefined) continue;
      for (const m of METRICS) vals[m.key].push(m.fn(sim, e.frame));
      n++;
    }
  } catch (e) { console.log(`  ${name.padEnd(24)} FAILED: ${String(e).slice(0, 80)}`); continue; }
  totalLandings += n;
  console.log(`  ${name.padEnd(24)} ${String(n).padStart(4)} landings`);
}

const P = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const PCTS = [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
console.log(`\n=== distribution across ${totalLandings} landings (raw units) ===`);
console.log(`  metric      unit   ` + PCTS.map((p) => `p${Math.round(p * 100)}`.padStart(7)).join("") + `${"max".padStart(8)}`);
const out: Record<string, { unit: string; sorted: number[]; pcts: Record<string, number>; capP95: number; capP99: number }> = {};
for (const m of METRICS) {
  const s = [...vals[m.key]].sort((a, b) => a - b);
  console.log(`  ${m.label.padEnd(10)} ${m.unit.padEnd(6)} ` + PCTS.map((p) => P(s, p).toFixed(2).padStart(7)).join("") + s[s.length - 1].toFixed(2).padStart(8));
  out[m.key] = {
    unit: m.unit, sorted: s.map((x) => Math.round(x * 1000) / 1000),
    pcts: Object.fromEntries(PCTS.map((p) => [`p${Math.round(p * 100)}`, Math.round(P(s, p) * 1000) / 1000])),
    capP95: Math.round(P(s, 0.95) * 1000) / 1000, capP99: Math.round(P(s, 0.99) * 1000) / 1000,
  };
}

const outDir = resolve("generated/impact-study");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "corpus_percentiles.json");
writeFileSync(outPath, JSON.stringify({ budget, corpus: CORPUS, window: SS.IMPACT_WINDOW, totalLandings, metrics: out }, null, 2) + "\n");
console.log(`\nwrote ${outPath}`);
console.log(`  (percentile map = fraction of corpus ≤ a raw value; gives one apples-to-apples [0,1] scale per metric.`);
console.log(`   absolute-cap option: divide by capP95 or capP99 above. Felt overlay is a separate step.)`);
