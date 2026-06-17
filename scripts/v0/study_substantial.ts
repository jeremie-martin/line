/**
 * SUBSTANTIAL-STAND-DEFINITION STUDY — given the CANONICAL stands (rank_stands.ts →
 * canonical.json), characterize how the "this counts as real standing" filter behaves
 * as we vary the duration / landing thresholds and the combination logic. Pure
 * post-processing on the detected stands (the detection definition is fixed), so it's
 * instant — no recompile, no engine.
 *
 *   npx tsx scripts/v0/study_substantial.ts [--in=generated/luna_stands/canonical.json]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Span = { seed: number; durS: number; landings: number; side: "tail" | "nose" };
const argv = process.argv.slice(2);
const inPath = argv.find((a) => a.startsWith("--in="))?.slice(5) ?? "generated/luna_stands/canonical.json";
const data = JSON.parse(readFileSync(resolve(inPath), "utf8"));
const all: Span[] = data.all;
const nTracks: number = data.nTracks;

type Filter = { name: string; fn: (d: number, l: number) => boolean };
const VARIANTS: Filter[] = [
  { name: "all (no filter)", fn: () => true },
  { name: "dur>=0.4", fn: (d) => d >= 0.4 },
  { name: "dur>=0.5", fn: (d) => d >= 0.5 },
  { name: "dur>=0.6", fn: (d) => d >= 0.6 },
  { name: "dur>=0.7", fn: (d) => d >= 0.7 },
  { name: "dur>=0.8", fn: (d) => d >= 0.8 },
  { name: "dur>=1.0", fn: (d) => d >= 1.0 },
  { name: "land>=2", fn: (_d, l) => l >= 2 },
  { name: "land>=3", fn: (_d, l) => l >= 3 },
  { name: "land>=4", fn: (_d, l) => l >= 4 },
  { name: "land>=5", fn: (_d, l) => l >= 5 },
  { name: "OR(0.5|3)", fn: (d, l) => d >= 0.5 || l >= 3 },
  { name: "OR(0.6|3)", fn: (d, l) => d >= 0.6 || l >= 3 },
  { name: "OR(0.6|4)", fn: (d, l) => d >= 0.6 || l >= 4 },
  { name: "AND(0.5&3)", fn: (d, l) => d >= 0.5 && l >= 3 },
  { name: "AND(0.6&3)", fn: (d, l) => d >= 0.6 && l >= 3 },
];

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
/** Per-track total substantial-stand time, as a seed→seconds map. */
function perTrackTotal(f: Filter): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of all) if (f.fn(s.durS, s.landings)) m.set(s.seed, (m.get(s.seed) ?? 0) + s.durS);
  return m;
}
function rankedSeeds(m: Map<number, number>): number[] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([seed]) => seed);
}
function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb || 1);
}

console.log(`substantial-definition study over ${all.length} canonical stands / ${nTracks} tracks (${inPath})\n`);
console.log(`${"variant".padEnd(16)} ${"nSub".padStart(5)} ${"tracks".padStart(6)} ${"total_s".padStart(7)} ${"medDur".padStart(6)} ${"maxDur".padStart(6)}   top5 tracks (seed:total_s)`);
const totalsByVariant = new Map<string, Map<number, number>>();
for (const v of VARIANTS) {
  const sub = all.filter((s) => v.fn(s.durS, s.landings));
  const perTrack = perTrackTotal(v);
  totalsByVariant.set(v.name, perTrack);
  const durs = sub.map((s) => s.durS);
  const top5 = [...perTrack.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([seed, t]) => `${seed}:${t.toFixed(2)}`).join(" ");
  console.log(`${v.name.padEnd(16)} ${String(sub.length).padStart(5)} ${String(perTrack.size).padStart(6)} ` +
    `${sub.reduce((a, s) => a + s.durS, 0).toFixed(1).padStart(7)} ${median(durs).toFixed(2).padStart(6)} ` +
    `${(Math.max(0, ...durs)).toFixed(2).padStart(6)}   ${top5}`);
}

// Ranking stability vs the current OR(0.5|3): does relaxing/tightening reshuffle which
// tracks "stand the most"? Compare per-track total-substantial-time across the corpus.
const refName = "OR(0.5|3)";
const ref = totalsByVariant.get(refName)!;
const seeds = [...new Set(all.map((s) => s.seed))];
const refVec = seeds.map((s) => ref.get(s) ?? 0);
const refTop10 = new Set(rankedSeeds(ref).slice(0, 10));
console.log(`\n=== ranking stability vs ${refName} (per-track total substantial time) ===`);
console.log(`${"variant".padEnd(16)} ${"pearson".padStart(7)} ${"top10∩".padStart(7)} ${"#1 seed".padStart(8)}`);
for (const v of VARIANTS) {
  if (v.name === refName || v.name === "all (no filter)") continue;
  const m = totalsByVariant.get(v.name)!;
  const vec = seeds.map((s) => m.get(s) ?? 0);
  const top10 = rankedSeeds(m).slice(0, 10);
  const overlap = top10.filter((s) => refTop10.has(s)).length;
  console.log(`${v.name.padEnd(16)} ${pearson(refVec, vec).toFixed(2).padStart(7)} ${String(overlap).padStart(5)}/10 ${String(rankedSeeds(m)[0] ?? "-").padStart(8)}`);
}
