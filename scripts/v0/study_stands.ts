/**
 * STAND-DEFINITION STUDY — characterize how "what counts as a tail/nose-stand"
 * changes as we vary the criteria, over a corpus of compiled tracks. The goal is
 * NOT to optimize a number; it is to understand the design space so we can nail
 * down a definition with evidence. Read-only over the tracks.
 *
 * Axes studied (see VARIANTS):
 *   1. Reference frame — sled angle vs WORLD HORIZONTAL (gravity) vs PERPENDICULAR
 *      TO TRAVEL. The travel frame is meant to NOT flag a steep downhill ride
 *      (sled parallel to a steep slope ⇒ far from horizontal, but ~0° from travel).
 *   2. Hysteresis — enter on a strict CORE band around vertical, sustain while
 *      within a looser EXIT band, end only when we leave the exit band (fall flat /
 *      rotate away). A brief wobble past the core doesn't break the stand.
 *   3. % of the span in the core band (vs strict-contiguous).
 *   4. Tolerance width (stability sweep).
 *   5. Min landings (bounce requirement) — and we report airborne fraction so a
 *      grounded "slide on an end" is distinguishable from a real bounce.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_stands.ts \
 *     --dir=generated/luna_stands [--limit=100] [--out=generated/luna_stands/study.json]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { extractTrace } from "./core/trace.ts";
import { wrapDeg, uprightDegFromHorizontal } from "../lib/rotation.ts";
import { FPS } from "./types.ts";

// ───────────────────────── per-frame track signal ─────────────────────────
type FrameSig = { sled: number; air: boolean; heading: number; speed: number };

function loadFrames(trackPath: string): FrameSig[] {
  const track = JSON.parse(readFileSync(trackPath, "utf8"));
  const tr = extractTrace(track);
  return tr.frames.map((f) => ({
    sled: f.sledPoseDeg == null ? NaN : f.sledPoseDeg,
    air: f.airborne,
    heading: f.comHeadingDeg,
    speed: f.speed,
  }));
}

// ───────────────────────── generalized stand detector ─────────────────────────
type RefFrame = "horizontal" | "travel";
type StandDef = {
  ref: RefFrame;
  /** Enter the stand when deviation-from-upright ≤ this (the strict CORE band, deg). */
  enterTolDeg: number;
  /** Sustain the stand while deviation ≤ this (the looser EXIT band, deg ≥ enter). */
  exitTolDeg: number;
  /** Require this fraction of the span inside the CORE band. */
  minCoreFraction: number;
  /** Require ≥ this many landings (air→ground touch-downs). */
  minLandings: number;
  /** Require ≥ this many frames. */
  minFrames: number;
};

type Detected = {
  a: number; b: number; len: number; side: "tail" | "nose";
  landings: number; coreFraction: number; airFraction: number; meanDevDeg: number; meanSpeed: number;
};

/** Deviation from "perfectly upright" (0 = vertical / perpendicular-to-travel), and
 *  which end is down (+1 tail, −1 nose). NaN sled ⇒ dev = +∞. */
function deviation(s: FrameSig, ref: RefFrame): { dev: number; sideDown: 1 | -1 } {
  if (!Number.isFinite(s.sled)) return { dev: Infinity, sideDown: 1 };
  if (ref === "horizontal") {
    const upright = uprightDegFromHorizontal(s.sled); // [0,90], 90 = vertical
    const sideDown: 1 | -1 = Math.sin((s.sled * Math.PI) / 180) < 0 ? 1 : -1; // nose-up ⇒ tail down
    return { dev: 90 - upright, sideDown };
  }
  // travel: how far the sled is from PERPENDICULAR to the direction of motion.
  const rel = wrapDeg(s.sled - s.heading); // (−180,180]
  const arel = Math.abs(rel);
  const perp = Math.min(arel, 180 - arel); // [0,90], 90 = perpendicular to travel
  const sideDown: 1 | -1 = Math.sin((rel * Math.PI) / 180) < 0 ? 1 : -1;
  return { dev: 90 - perp, sideDown };
}

function detectStands(frames: FrameSig[], def: StandDef): Detected[] {
  const n = frames.length;
  const out: Detected[] = [];
  let inStand = false, start = 0, side: 1 | -1 = 1;

  const close = (a: number, b: number) => {
    const len = b - a + 1;
    if (len < def.minFrames) return;
    let core = 0, landings = 0, airF = 0, sumDev = 0, sumSpeed = 0;
    let prevAir: boolean | null = null;
    for (let f = a; f <= b; f++) {
      const { dev } = deviation(frames[f], def.ref);
      if (dev <= def.enterTolDeg) core++;
      if (Number.isFinite(dev)) sumDev += dev;
      if (frames[f].air) airF++;
      sumSpeed += frames[f].speed;
      if (prevAir === true && !frames[f].air) landings++;
      prevAir = frames[f].air;
    }
    const coreFraction = core / len;
    if (coreFraction < def.minCoreFraction || landings < def.minLandings) return;
    out.push({
      a, b, len, side: side === 1 ? "tail" : "nose",
      landings, coreFraction, airFraction: airF / len, meanDevDeg: sumDev / len, meanSpeed: sumSpeed / len,
    });
  };

  for (let f = 0; f < n; f++) {
    const { dev, sideDown } = deviation(frames[f], def.ref);
    if (!inStand) {
      if (dev <= def.enterTolDeg) { inStand = true; start = f; side = sideDown; }
    } else {
      // sustain while within the exit band AND on the same end; otherwise close.
      if (dev <= def.exitTolDeg && sideDown === side) continue;
      close(start, f - 1);
      inStand = false;
      if (dev <= def.enterTolDeg) { inStand = true; start = f; side = sideDown; } // a new stand may start here
    }
  }
  if (inStand) close(start, n - 1);
  return out;
}

// ───────────────────────── variants ─────────────────────────
const VARIANTS: Record<string, StandDef> = {
  // shipped-like: single 20° band, strict-contiguous-ish (90% core), horizontal.
  shipped:    { ref: "horizontal", enterTolDeg: 20, exitTolDeg: 20, minCoreFraction: 0.9, minLandings: 2, minFrames: 12 },
  // hysteresis (the proposal): strict 10° core, sustain to 20°, 70% core.
  hyst_10_20: { ref: "horizontal", enterTolDeg: 10, exitTolDeg: 20, minCoreFraction: 0.7, minLandings: 2, minFrames: 12 },
  hyst_15_30: { ref: "horizontal", enterTolDeg: 15, exitTolDeg: 30, minCoreFraction: 0.6, minLandings: 2, minFrames: 12 },
  // travel-relative reference (steep-slope guard), strict and hysteresis.
  travel_20:  { ref: "travel", enterTolDeg: 20, exitTolDeg: 20, minCoreFraction: 0.9, minLandings: 2, minFrames: 12 },
  travel_hyst:{ ref: "travel", enterTolDeg: 10, exitTolDeg: 20, minCoreFraction: 0.7, minLandings: 2, minFrames: 12 },
  // tolerance stability sweep (single band, horizontal).
  tol_12:     { ref: "horizontal", enterTolDeg: 12, exitTolDeg: 12, minCoreFraction: 0.9, minLandings: 2, minFrames: 12 },
  tol_16:     { ref: "horizontal", enterTolDeg: 16, exitTolDeg: 16, minCoreFraction: 0.9, minLandings: 2, minFrames: 12 },
  tol_24:     { ref: "horizontal", enterTolDeg: 24, exitTolDeg: 24, minCoreFraction: 0.9, minLandings: 2, minFrames: 12 },
  tol_28:     { ref: "horizontal", enterTolDeg: 28, exitTolDeg: 28, minCoreFraction: 0.9, minLandings: 2, minFrames: 12 },
  // landing requirement on the hysteresis base.
  hyst_land1: { ref: "horizontal", enterTolDeg: 10, exitTolDeg: 20, minCoreFraction: 0.7, minLandings: 1, minFrames: 12 },
  hyst_land3: { ref: "horizontal", enterTolDeg: 10, exitTolDeg: 20, minCoreFraction: 0.7, minLandings: 3, minFrames: 12 },
};

// ───────────────────────── aggregation + comparison ─────────────────────────
type Span = { seed: number; a: number; b: number } & Detected;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((p, q) => p - q);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
const sec = (frames: number) => frames / FPS;

/** Fraction of A-spans that overlap (in time, same seed) at least one B-span. */
function overlapRate(A: Span[], B: Span[]): number {
  if (!A.length) return 1;
  const bySeed = new Map<number, Span[]>();
  for (const b of B) { const g = bySeed.get(b.seed) ?? []; g.push(b); bySeed.set(b.seed, g); }
  let hit = 0;
  for (const a of A) {
    const g = bySeed.get(a.seed) ?? [];
    if (g.some((b) => Math.min(a.b, b.b) >= Math.max(a.a, b.a))) hit++;
  }
  return hit / A.length;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
  const dir = arg("dir") ?? "generated/luna_stands";
  const limit = Number(arg("limit") ?? "1000");
  const outPath = arg("out") ?? join(dir, "study.json");

  const files = readdirSync(resolve(dir)).filter((f) => /^seed\d+\.track\.json$/.test(f)).slice(0, limit);
  console.log(`extracting traces for ${files.length} tracks from ${dir} ...`);

  const perTrack: { seed: number; frames: FrameSig[] }[] = [];
  for (let i = 0; i < files.length; i++) {
    const seed = Number(files[i].match(/seed(\d+)/)![1]);
    perTrack.push({ seed, frames: loadFrames(join(dir, files[i])) });
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${files.length}`);
  }

  // Detect under every variant.
  const spansByVariant = new Map<string, Span[]>();
  for (const [name, def] of Object.entries(VARIANTS)) {
    const spans: Span[] = [];
    for (const { seed, frames } of perTrack) {
      for (const d of detectStands(frames, def)) spans.push({ seed, ...d });
    }
    spansByVariant.set(name, spans);
  }

  console.log(`\n=== per-variant summary (${perTrack.length} tracks) ===`);
  console.log(`${"variant".padEnd(12)} ${"#stands".padStart(7)} ${"tracks".padStart(6)} ${"durMed".padStart(6)} ${"durMax".padStart(6)} ${"total_s".padStart(7)} ${"core%".padStart(5)} ${"air%".padStart(5)} ${"tail".padStart(4)} ${"nose".padStart(4)}`);
  const report: Record<string, unknown> = { dir, nTracks: perTrack.length, variants: {} as Record<string, unknown> };
  for (const [name, spans] of spansByVariant) {
    const durs = spans.map((s) => sec(s.len));
    const tracks = new Set(spans.map((s) => s.seed)).size;
    const tail = spans.filter((s) => s.side === "tail").length;
    const totalS = durs.reduce((a, b) => a + b, 0);
    const meanCore = spans.length ? spans.reduce((a, s) => a + s.coreFraction, 0) / spans.length : 0;
    const meanAir = spans.length ? spans.reduce((a, s) => a + s.airFraction, 0) / spans.length : 0;
    console.log(`${name.padEnd(12)} ${String(spans.length).padStart(7)} ${String(tracks).padStart(6)} ` +
      `${median(durs).toFixed(2).padStart(6)} ${(Math.max(0, ...durs)).toFixed(2).padStart(6)} ${totalS.toFixed(1).padStart(7)} ` +
      `${(meanCore * 100).toFixed(0).padStart(5)} ${(meanAir * 100).toFixed(0).padStart(5)} ${String(tail).padStart(4)} ${String(spans.length - tail).padStart(4)}`);
    (report.variants as Record<string, unknown>)[name] = {
      nStands: spans.length, tracksWithStand: tracks, durMedianS: median(durs), durMaxS: Math.max(0, ...durs),
      totalStandS: totalS, meanCoreFraction: meanCore, meanAirFraction: meanAir, tail, nose: spans.length - tail,
    };
  }

  // Reference-frame disagreement: horizontal-only stands the travel frame rejects
  // (candidate steep-slope false positives) and vice versa.
  const horiz = spansByVariant.get("shipped")!;
  const travel = spansByVariant.get("travel_20")!;
  console.log(`\n=== reference-frame agreement (shipped[horizontal] vs travel_20) ===`);
  console.log(`  horizontal stands overlapped by travel: ${(overlapRate(horiz, travel) * 100).toFixed(0)}%  (${horiz.length} horiz, ${travel.length} travel)`);
  console.log(`  travel stands overlapped by horizontal: ${(overlapRate(travel, horiz) * 100).toFixed(0)}%`);
  const bySeedT = new Map<number, Span[]>();
  for (const t of travel) { const g = bySeedT.get(t.seed) ?? []; g.push(t); bySeedT.set(t.seed, g); }
  const horizOnly = horiz.filter((h) => !(bySeedT.get(h.seed) ?? []).some((t) => Math.min(h.b, t.b) >= Math.max(h.a, t.a)));
  console.log(`  HORIZONTAL-ONLY stands (travel rejects — candidate steep-slope FPs): ${horizOnly.length}`);
  for (const h of horizOnly.sort((a, b) => b.len - a.len).slice(0, 8)) {
    console.log(`    seed ${h.seed}  ${sec(h.a).toFixed(1)}–${sec(h.b).toFixed(1)}s  ${sec(h.len).toFixed(2)}s  ${h.side}  air ${(h.airFraction * 100).toFixed(0)}%`);
  }

  // Hysteresis effect vs shipped strict band.
  console.log(`\n=== hysteresis vs strict (hyst_10_20 vs shipped) ===`);
  const hyst = spansByVariant.get("hyst_10_20")!;
  console.log(`  shipped overlapped by hyst: ${(overlapRate(horiz, hyst) * 100).toFixed(0)}%   hyst overlapped by shipped: ${(overlapRate(hyst, horiz) * 100).toFixed(0)}%`);
  console.log(`  median duration: shipped ${median(horiz.map((s) => sec(s.len))).toFixed(2)}s  hyst ${median(hyst.map((s) => sec(s.len))).toFixed(2)}s   (hysteresis should extend/merge ⇒ longer)`);

  // Sliding analysis: a real stand BOUNCES (airborne fraction high). A steep-slope
  // RIDE would be grounded (low air) + fast. Test whether any horizontal stands look
  // like grounded slope-rides rather than bounces.
  console.log(`\n=== sliding analysis (shipped[horizontal] stands) ===`);
  const airs = horiz.map((s) => s.airFraction).sort((a, b) => a - b);
  const grounded = horiz.filter((s) => s.airFraction < 0.2);
  console.log(`  airborne fraction: min ${(airs[0] * 100).toFixed(0)}%  median ${(median(airs) * 100).toFixed(0)}%  ` +
    `max ${(airs[airs.length - 1] * 100).toFixed(0)}%`);
  console.log(`  grounded stands (air<20% — candidate slope-slides, not bounces): ${grounded.length} of ${horiz.length}`);
  for (const g of grounded.sort((a, b) => b.meanSpeed - a.meanSpeed).slice(0, 6)) {
    console.log(`    seed ${g.seed}  ${sec(g.a).toFixed(1)}–${sec(g.b).toFixed(1)}s  air ${(g.airFraction * 100).toFixed(0)}%  speed ${g.meanSpeed.toFixed(1)}px/f  ${g.side}`);
  }

  writeFileSync(resolve(outPath), JSON.stringify(report, null, 2));
  console.log(`\nstudy → ${outPath}`);
}

await main();
