/**
 * study_impact_staircase — the achievable-range evidence for impact calibration.
 *
 * Authors a staircase of beats stepping authored impact 0.0 → 1.0 (several beats per level),
 * on uniform geometry at a few speeds, compiles with the CURRENT metric, and measures the RAW
 * redirArc (px/frame) the compiler actually DELIVERS at each authored level. This is the
 * anchor-independent evidence for: (a) the reliably-achievable range (floor & ceiling), (b)
 * where it SATURATES (→ the "reasonable, not rare-max" ceiling), and (c) whether the response
 * is monotone/discriminating across [0.1,1.0].
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_staircase.ts [--budget=150000] [--seeds=3]
 *
 * Run it with anchors at their default (LR_IMPACT_SOFT/VSTRONG unset) — what matters is the
 * raw redirArc curve, which the report then maps under several candidate anchor sets.
 */
import { compileHandoff } from "./optimizer/handoff.ts";
import { type Spec, type Contact, secToFrame } from "./types.ts";
import { constant } from "./core/curves.ts";
import * as SS from "./impact_support.ts";

const argv = process.argv.slice(2);
const arg = (n: string, d: number) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? Number(a.slice(n.length + 3)) : d; };
const BUDGET = arg("budget", 150000);
const NSEEDS = arg("seeds", 3);
const SPACING = 0.7;                 // s between beats (~28 frames — room to turn, not dense-capped)
const PER = 6;                       // beats per impact level
const LEVELS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const SPEEDS = [0.5, 0.7, 0.9];

function buildSpec(speed: number): { spec: Spec; levelOfFrame: Map<number, number> } {
  const contacts: Contact[] = [];
  const levelOfFrame = new Map<number, number>();
  let t = 1.0;
  for (const lv of LEVELS) {
    for (let i = 0; i < PER; i++) {
      const tt = Number(t.toFixed(3));
      contacts.push(lv === 0 ? { t: tt } : { t: tt, impact: lv });
      levelOfFrame.set(secToFrame(tt), lv);
      t += SPACING;
    }
  }
  const spec: Spec = { duration: Math.ceil(t + 1), contacts, axes: { air: constant(0.5), speed: constant(speed) }, preroll: 5 };
  return { spec, levelOfFrame };
}

const P = (xs: number[], p: number) => xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : NaN;
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

// candidate anchor sets to preview how the raw curve would normalize
const ANCHORS: [string, number, number][] = [["S2.0/V6.5(shipped)", 2.0, 6.5], ["S2.8/V5.5", 2.8, 5.5], ["S2.8/V5.0", 2.8, 5.0], ["S2.5/V5.0", 2.5, 5.0]];
const norm = (px: number, s: number, v: number) => Math.max(0, Math.min(1, (px - s) / (v - s)));

console.log(`staircase: levels ${LEVELS.join(",")} x ${PER} beats x speeds ${SPEEDS.join(",")} x ${NSEEDS} seeds, budget ${BUDGET}\n`);
for (const speed of SPEEDS) {
  const { spec, levelOfFrame } = buildSpec(speed);
  const byLevel = new Map<number, number[]>();
  for (const lv of LEVELS) byLevel.set(lv, []);
  for (let seed = 0; seed < NSEEDS; seed++) {
    let track;
    try { ({ track } = compileHandoff(spec, seed, { budget: BUDGET })); }
    catch (e) { console.log(`  speed ${speed} seed ${seed}: compile failed`); continue; }
    const sim = SS.simulateTrack(track);
    for (const e of sim.det.events) {
      if (e.type !== "landing") continue;
      // match landing to nearest authored beat frame (±4 frames)
      let best = -1, bestD = 5;
      for (const f of levelOfFrame.keys()) { const d = Math.abs(f - e.frame); if (d < bestD) { bestD = d; best = f; } }
      if (best < 0) continue;
      const px = SS.redirArcPx(sim, e.frame);
      if (px !== undefined && Number.isFinite(px)) byLevel.get(levelOfFrame.get(best)!)!.push(px);
    }
  }
  console.log(`──────── speed ${speed} (≈${(0.0 + speed).toFixed(2)} authored) ────────`);
  console.log(`  authored  n   redirArc: p25   p50   p75    | normImpact under candidate anchors`);
  for (const lv of LEVELS) {
    const xs = byLevel.get(lv)!;
    const p50 = P(xs, 0.5);
    const cells = ANCHORS.map(([, s, v]) => norm(p50, s, v).toFixed(2)).join("  ");
    console.log(`    ${lv.toFixed(1)}    ${String(xs.length).padStart(3)}   ${P(xs, 0.25).toFixed(2).padStart(5)} ${p50.toFixed(2).padStart(5)} ${P(xs, 0.75).toFixed(2).padStart(5)}    | ${cells}`);
  }
  console.log(`  anchor legend: ${ANCHORS.map(([n]) => n).join("   ")}\n`);
}
