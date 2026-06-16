/**
 * Find the most metric-DIVERGENT track in the golden suite — the one where the leading
 * impact candidates (REDIR·on, DECEL, DECEL·on, …) most disagree on which landings are
 * hard. That track is the most discriminative thing to label next: its felt labels will
 * separate redirection-flavoured metrics from force-flavoured ones. Pure stats, no labels.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_divergence.ts [--budget=40000] [spec ...]
 *
 * Normalizes each metric by the corpus p99 (corpus_percentiles.json) so the per-beat spread
 * is apples-to-apples. Reports, per track: #landings, magnitude divergence (mean per-beat
 * stdev across the candidates), rank divergence (1 − mean pairwise Spearman), and the
 * headline REDIR·on-vs-DECEL disagreement.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileHandoff } from "./optimizer/handoff.ts";
import { type Spec } from "./types.ts";
import * as SS from "./impact_support.ts";

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const budget = Number(arg("budget") ?? "40000");

const corpus = JSON.parse(readFileSync(resolve("generated/impact-study/corpus_percentiles.json"), "utf8"));
const cap = (k: string) => corpus.metrics[k].capP99 as number;
const norm = (k: string, v: number) => Math.min(1, v / cap(k));

// The competing leads, spanning the two families (redirection vs force).
const CAND: { key: string; fn: (s: SS.Sim, f: number) => number }[] = [
  { key: "redirDec", fn: (s, f) => SS.redirDecayPx(s, f) },
  { key: "comDecel", fn: (s, f) => SS.comDecelNormalPx(s, f) },
  { key: "decelDec", fn: (s, f) => SS.comDecelDecayPx(s, f) },
  { key: "snap",     fn: (s, f) => SS.snapPx(s, f) },
];

const names = argv.filter((a) => !a.startsWith("--"));
const SPECS = names.length ? names : readdirSync(resolve("specs/golden")).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).map((f) => f.replace(/\.ts$/, "")).sort();

async function loadSpec(name: string): Promise<Spec> {
  const p = [resolve(`specs/golden/${name}.ts`), resolve(`scripts/v0/specs/${name}.ts`)].find(existsSync);
  if (!p) throw new Error(`spec ${name} not found`);
  return (await import(pathToFileURL(p).href)).default as Spec;
}
const stdev = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };

type Row = { name: string; n: number; mag: number; rankDiv: number; rdVsDecel: number };
const rows: Row[] = [];
for (const name of SPECS) {
  try {
    const spec = await loadSpec(name);
    const { track } = compileHandoff(spec, 0, { budget });
    const sim = SS.simulateTrack(track);
    const perMetric: Record<string, number[]> = Object.fromEntries(CAND.map((c) => [c.key, []]));
    const landings: number[] = [];
    for (const e of sim.det.events) {
      if (e.type !== "landing" || e.frame < 3 || e.frame > sim.last - 2) continue;
      if (SS.pointImpactPx(sim, e.frame) === undefined) continue;
      landings.push(e.frame);
      for (const c of CAND) perMetric[c.key].push(norm(c.key, c.fn(sim, e.frame)));
    }
    const n = landings.length;
    if (n < 6) { console.log(`  ${name.padEnd(22)} ${n} landings (skip — too few)`); continue; }
    // magnitude divergence: how spread the candidates are per beat (mean over beats)
    const mag = landings.map((_, i) => stdev(CAND.map((c) => perMetric[c.key][i]))).reduce((a, b) => a + b, 0) / n;
    // rank divergence: 1 − mean pairwise Spearman (low agreement = high divergence)
    let sp = 0, pairs = 0;
    for (let a = 0; a < CAND.length; a++) for (let b = a + 1; b < CAND.length; b++) { sp += SS.spearman(perMetric[CAND[a].key], perMetric[CAND[b].key]); pairs++; }
    const rankDiv = 1 - sp / pairs;
    const rdVsDecel = 1 - SS.spearman(perMetric["redirDec"], perMetric["comDecel"]); // headline: redirection vs force
    rows.push({ name, n, mag, rankDiv, rdVsDecel });
    console.log(`  ${name.padEnd(22)} ${String(n).padStart(3)} landings`);
  } catch (e) { console.log(`  ${name.padEnd(22)} FAILED ${String(e).slice(0, 60)}`); }
}

rows.sort((a, b) => b.rankDiv - a.rankDiv);
console.log(`\n=== golden tracks ranked by metric DIVERGENCE (most discriminative to label first) ===`);
console.log(`  spec                    n   rankDiv  magDiv  REDIR·on↔DECEL`);
for (const r of rows) console.log(`  ${r.name.padEnd(22)} ${String(r.n).padStart(3)}   ${r.rankDiv.toFixed(3)}  ${r.mag.toFixed(3)}   ${r.rdVsDecel.toFixed(3)}`);
console.log(`\n(rankDiv = 1 − mean pairwise Spearman among ${CAND.map((c) => c.key).join("/")}; higher = the leads disagree more.`);
console.log(` The top track + enough landings is the best next thing to render + label.)`);
