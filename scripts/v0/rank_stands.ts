/**
 * Re-rank already-compiled tracks by their stands using the CANONICAL detector
 * (rotation.ts::computeStands with shipped defaults) — no recompile, just re-read
 * each track, extract its trace, and detect. Confirms the baked-in definition's
 * results over a corpus.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/rank_stands.ts \
 *     --dir=generated/luna_stands [--top=15] [--out=generated/luna_stands/canonical.json]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { extractTrace } from "./core/trace.ts";
import { computeStands } from "../lib/rotation.ts";
import { FPS } from "./types.ts";

const argv = process.argv.slice(2);
const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const dir = arg("dir") ?? "generated/luna_stands";
const top = Number(arg("top") ?? "15");
const outPath = arg("out") ?? join(dir, "canonical.json");
const sec = (f: number) => f / FPS;
// A "substantial" stand is real, sustained standing — not a one-gap blip: it bounces
// ≥ minLandings times AND lasts ≥ minDur. (The detector already guarantees ≥2 landings,
// so with the defaults this reduces to dur≥0.5 — but the AND keeps it correct if the
// detector's landing floor ever changes.) Total substantial-stand time per track
// answers "how much do we REALLY stay straight" (vs the single longest stand).
const MIN_DUR_S = Number(arg("min-dur") ?? "0.7");
const MIN_LAND = Number(arg("min-landings") ?? "2");
const substantial = (durS: number, landings: number) => durS >= MIN_DUR_S && landings >= MIN_LAND;

const files = readdirSync(resolve(dir)).filter((f) => /^seed\d+\.track\.json$/.test(f));
console.log(`canonical computeStands over ${files.length} tracks from ${dir} ...`);

type Span = { seed: number; startS: number; endS: number; durS: number; side: "tail" | "nose"; landings: number; gaps: number; uprightDeg: number; lockedPct: number; airPct: number };
const all: Span[] = [];
const perSeed: { seed: number; longestS: number; count: number; totalS: number; substantialCount: number; substantialTotalS: number }[] = [];
for (let i = 0; i < files.length; i++) {
  const seed = Number(files[i].match(/seed(\d+)/)![1]);
  const track = JSON.parse(readFileSync(join(dir, files[i]), "utf8"));
  const tr = extractTrace(track);
  const sled = tr.frames.map((f) => (f.sledPoseDeg == null ? NaN : f.sledPoseDeg));
  const air = tr.frames.map((f) => f.airborne);
  const stands = computeStands(sled, air); // <-- canonical defaults = the agreed definition
  for (const s of stands) {
    all.push({
      seed, startS: sec(s.startFrame), endS: sec(s.endFrame), durS: sec(s.lengthFrames),
      side: s.side, landings: s.landings, gaps: s.landings - 1, uprightDeg: s.meanUprightDeg,
      lockedPct: s.inBandFraction * 100, airPct: s.airborneFraction * 100,
    });
  }
  const subStands = stands.filter((s) => substantial(s.lengthFrames / FPS, s.landings));
  perSeed.push({
    seed,
    longestS: stands.reduce((m, s) => Math.max(m, s.lengthFrames / FPS), 0),
    count: stands.length,
    totalS: stands.reduce((a, s) => a + s.lengthFrames / FPS, 0),
    substantialCount: subStands.length,
    substantialTotalS: subStands.reduce((a, s) => a + s.lengthFrames / FPS, 0),
  });
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${files.length}`);
}

const durs = all.map((s) => s.durS).sort((a, b) => a - b);
const med = durs.length ? (durs.length % 2 ? durs[(durs.length - 1) / 2] : (durs[durs.length / 2 - 1] + durs[durs.length / 2]) / 2) : 0;
const tail = all.filter((s) => s.side === "tail").length;
const tracksWith = perSeed.filter((p) => p.count > 0).length;
const meanAir = all.length ? all.reduce((a, s) => a + s.airPct, 0) / all.length : 0;
const meanLocked = all.length ? all.reduce((a, s) => a + s.lockedPct, 0) / all.length : 0;

console.log(`\n=== CANONICAL stands over ${files.length} tracks ===`);
console.log(`  total stands ${all.length}   tracks with ≥1 stand ${tracksWith}/${files.length}`);
console.log(`  duration: median ${med.toFixed(2)}s  max ${(Math.max(0, ...durs)).toFixed(2)}s  total ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`);
console.log(`  side: ${tail} tail / ${all.length - tail} nose    mean locked ${meanLocked.toFixed(0)}%    mean airborne ${meanAir.toFixed(0)}%`);

console.log(`\n=== top ${top} tracks by longest stand ===`);
const ranked = [...perSeed].sort((a, b) => b.longestS - a.longestS).slice(0, top);
for (let r = 0; r < ranked.length; r++) {
  const p = ranked[r];
  const spans = all.filter((s) => s.seed === p.seed).sort((a, b) => b.durS - a.durS);
  console.log(`#${String(r + 1).padStart(2)}  seed ${String(p.seed).padStart(3)}  longest ${p.longestS.toFixed(2)}s  ${p.count} stands  total ${p.totalS.toFixed(2)}s`);
  for (const s of spans.slice(0, 4)) {
    console.log(`        ${s.startS.toFixed(1)}–${s.endS.toFixed(1)}s  ${s.durS.toFixed(2)}s  ${s.side}  ${s.gaps} gap/${s.landings} land  ${s.uprightDeg.toFixed(0)}° flat  ${s.lockedPct.toFixed(0)}% lock  ${s.airPct.toFixed(0)}% air`);
  }
}

// "How much do we REALLY stay straight" — total substantial-stand time per track.
const subAll = all.filter((s) => substantial(s.durS, s.landings));
const subTracks = perSeed.filter((p) => p.substantialCount > 0).length;
console.log(`\n=== SUBSTANTIAL stands (≥${MIN_DUR_S}s AND ≥${MIN_LAND} landings) — "real standing" ===`);
console.log(`  ${subAll.length} of ${all.length} stands substantial   tracks with ≥1: ${subTracks}/${files.length}   ` +
  `total ${subAll.reduce((a, s) => a + s.durS, 0).toFixed(1)}s`);
console.log(`\n=== top ${top} tracks by TOTAL substantial stand-time (repeated standing) ===`);
const rankedSub = [...perSeed].sort((a, b) => b.substantialTotalS - a.substantialTotalS).slice(0, top);
for (let r = 0; r < rankedSub.length; r++) {
  const p = rankedSub[r];
  const spans = all.filter((s) => s.seed === p.seed && substantial(s.durS, s.landings)).sort((a, b) => b.durS - a.durS);
  const desc = spans.map((s) => `${s.durS.toFixed(2)}s/${s.gaps}g/${s.side[0]}`).join("  ");
  console.log(`#${String(r + 1).padStart(2)}  seed ${String(p.seed).padStart(3)}  total ${p.substantialTotalS.toFixed(2)}s  (${p.substantialCount} substantial)   ${desc}`);
}

writeFileSync(resolve(outPath), JSON.stringify({
  dir, nTracks: files.length, totalStands: all.length, tracksWith,
  substantial: { minDurS: MIN_DUR_S, minLandings: MIN_LAND, count: subAll.length, tracksWith: subTracks },
  rankedByLongest: ranked, rankedBySubstantialTotal: rankedSub, all,
}, null, 2));
console.log(`\n→ ${outPath}`);
