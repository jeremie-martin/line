/**
 * study_impact_fullrange — the EXPRESSIVENESS test (the fixed staircase).
 *
 * Authors a fresh spec NATIVELY on the new felt scale (impact 0.1→1.0), with SETUP that scales
 * with the ask — soft beats get tight gaps, hard hits get the room (vertical-velocity budget) they
 * physically need. This is the honest test of the mission's core goal: given a well-authored spec,
 * can the author dial impact across the WHOLE range and get a meaningful, discriminating result?
 * (The earlier uniform staircase starved the setup and was rightly rejected.)
 *
 *   LR_ENGINE=wasm LR_IMPACT_SOFT=2.8 LR_IMPACT_VSTRONG=6.5 npx tsx scripts/v0/study_impact_fullrange.ts [--budget=150000] [--seeds=4]
 *
 * Run with anchor-A anchors set (native new-scale authoring => NO rescale). Reports, per authored
 * level: achieved redirArc px and achieved impact (normImpact under the live anchors), so we see
 * whether achieved tracks authored monotonically across [0.1,1.0].
 */
import { compileHandoff } from "./optimizer/handoff.ts";
import { type Spec, type Contact, secToFrame, normImpact, REDIRARC } from "./types.ts";
import { constant } from "./core/curves.ts";
import * as SS from "./impact_support.ts";

const argv = process.argv.slice(2);
const arg = (n: string, d: number) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? Number(a.slice(n.length + 3)) : d; };
const BUDGET = arg("budget", 150000);
const NSEEDS = arg("seeds", 4);
const LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const PER = 5;
const SPEED = 0.7;                          // ~10.4 px/f — moderate-fast
// setup scales with the ask: gap seconds grow with impact, so a hard hit has the vy budget it needs.
const gapSecForLevel = (lv: number) => 0.5 + 0.8 * lv;

function buildSpec(): { spec: Spec; levelOfFrame: Map<number, number> } {
  const contacts: Contact[] = [];
  const levelOfFrame = new Map<number, number>();
  let t = 1.0;
  for (const lv of LEVELS) {
    for (let i = 0; i < PER; i++) {
      const tt = Number(t.toFixed(3));
      contacts.push({ t: tt, impact: lv });
      levelOfFrame.set(secToFrame(tt), lv);
      t += gapSecForLevel(lv);
    }
  }
  return { spec: { duration: Math.ceil(t + 1), contacts, axes: { air: constant(0.5), speed: constant(SPEED) }, preroll: 5 }, levelOfFrame };
}

const P = (xs: number[], p: number) => xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : NaN;
const { spec, levelOfFrame } = buildSpec();
const byLevel = new Map<number, number[]>();
for (const lv of LEVELS) byLevel.set(lv, []);
for (let seed = 0; seed < NSEEDS; seed++) {
  let track;
  try { ({ track } = compileHandoff(spec, seed, { budget: BUDGET })); }
  catch { console.log(`seed ${seed}: compile failed`); continue; }
  const sim = SS.simulateTrack(track);
  for (const e of sim.det.events) {
    if (e.type !== "landing") continue;
    let best = -1, bestD = 5;
    for (const f of levelOfFrame.keys()) { const d = Math.abs(f - e.frame); if (d < bestD) { bestD = d; best = f; } }
    if (best < 0) continue;
    const px = SS.redirArcPx(sim, e.frame);
    if (px !== undefined && Number.isFinite(px)) byLevel.get(levelOfFrame.get(best)!)!.push(px);
  }
}
console.log(`full-range expressiveness — anchors SOFT=${REDIRARC.SOFT}/VSTRONG=${REDIRARC.VERY_STRONG}, native new-scale authoring (no rescale), budget ${BUDGET}, ${NSEEDS} seeds\n`);
console.log(`  authored  gap(s)  n   redirArc p50   achieved-impact p50   (want: achieved-impact ≈ authored, monotone)`);
let prev = -1, mono = true;
for (const lv of LEVELS) {
  const xs = byLevel.get(lv)!; const p50 = P(xs, 0.5); const ai = normImpact(p50);
  if (ai + 1e-9 < prev) mono = false;
  prev = ai;
  console.log(`    ${lv.toFixed(1)}    ${gapSecForLevel(lv).toFixed(2)}  ${String(xs.length).padStart(3)}   ${p50.toFixed(2).padStart(6)}        ${ai.toFixed(2).padStart(6)}   err ${(lv - ai >= 0 ? "+" : "") + (ai - lv).toFixed(2)}`);
}
console.log(`\n  monotone achieved-impact across [0.1,1.0]: ${mono ? "YES" : "NO"}`);
