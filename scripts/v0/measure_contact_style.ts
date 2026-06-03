/**
 * contact_style re-measure probe.
 *
 * The current `contact_style = min(1, slide_distance/median_segment)` is bimodal
 * (99% of spec targets fall in its unreachable middle). This probe samples viable
 * landing catches (isolated sweep) and, for each, computes several CANDIDATE
 * continuous definitions, then reports for each candidate:
 *   - its distribution (is it bimodal or continuous across the reachable set?),
 *   - controllability: correlation with the realized contact ANGLE (the steerable
 *     quantity the contact_shape work showed we can set) — a candidate that tracks
 *     the contact angle is one the optimizer can actually drive,
 *   - intent preservation: correlation with the OLD contact_style.
 *
 * Goal: pick a measure that is continuous, full-range, and controllable.
 *
 * Usage: npx tsx scripts/v0/measure_contact_style.ts [--specs=a,b] [--seed=0]
 *        [--entries-attempts=4] [--max-gaps=8]
 */
import { resolve } from "node:path";
import { makeRng } from "../lib/rng.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import {
  airborneAt,
  contactLineIdsAt,
  effectiveAxes,
  engineLineFromTrackLine,
  makeBaseEngine,
  sampleGapTargets,
  sliceTimeline,
  speedAt,
  velocityAt,
} from "./core/substrate.ts";
import { axisLookaheadEndFrame, readTargetState, sampleArcParams, tryCandidate } from "./core/candidate.ts";
import { CALIB, secToFrame, type Gap, type Spec, type TrackLine } from "./types.ts";

const DEFAULT_SPECS = ["drums_pendulum", "rhythm_ladder", "syncopated_switchback", "dense_sprint"];
const ENTRY_SPEEDS = [3, 6, 9, 12];
const ENTRY_ANGLES = [0, 20, 40, 60];

function arg(name: string, fb: string): string {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : fb;
}
async function loadSpec(name: string): Promise<Spec> {
  return (await import(resolve("specs/golden", `${name}.ts`))).default as Spec;
}
function buildGaps(spec: Spec, seed: number): Gap[] {
  const df = secToFrame(spec.duration);
  const cf = [...spec.contacts].map((c) => secToFrame(c.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(cf, df);
  const rng = makeRng(seed);
  for (const g of gaps) g.targets = sampleGapTargets(effectiveAxes(g, spec), spec.jitter ?? CALIB.SIGMA, rng);
  return gaps;
}
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length; if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
function pct(a: number[], p: number): number { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; }
function shape(a: number[]): string { // bimodality on a [0,1]-normalized series
  const lo = a.filter((v) => v < 0.15).length, mid = a.filter((v) => v >= 0.15 && v <= 0.85).length, hi = a.filter((v) => v > 0.85).length;
  return `near0=${(100 * lo / a.length).toFixed(0)}% mid=${(100 * mid / a.length).toFixed(0)}% near1=${(100 * hi / a.length).toFixed(0)}%`;
}
function foldAngle(aDeg: number, bDeg: number): number { // undirected line vs velocity, [0,90]
  let d = Math.abs(aDeg - bDeg) % 180; if (d > 90) d = 180 - d; return d;
}

const seed = parseInt(arg("seed", "0"), 10);
const attemptsPerEntry = parseInt(arg("entries-attempts", "4"), 10);
const maxGaps = parseInt(arg("max-gaps", "8"), 10);
const specs = arg("specs", DEFAULT_SPECS.join(",")).split(",");

// candidate series
const C = {
  old: [] as number[],            // current contact_style
  angle: [] as number[],          // contact angle deg / 90  (0=glancing/parallel, 1=head-on)
  contactFrac: [] as number[],    // post-contact grounded frames / gap frames
  slideSegFrac: [] as number[],   // slide-segment frames / gap frames
  speedRetain: [] as number[],    // exit speed / incoming speed (clamped 0..1.5 ->/1.5)
};
const angleRaw: number[] = []; // for controllability correlations
let viable = 0;

for (const specName of specs) {
  const spec = await loadSpec(specName);
  const gaps = buildGaps(spec, seed).filter((g) => g.endsWithContact);
  const stride = Math.max(1, Math.floor(gaps.length / maxGaps));
  const sampled = gaps.filter((_, i) => i % stride === 0).slice(0, maxGaps);
  for (const gap of sampled) {
    const durFrames = Math.max(1, gap.endFrame - gap.startFrame);
    const local: Gap = { index: gap.index, startFrame: 0, endFrame: durFrames, endsWithContact: true, targets: { ...gap.targets } };
    const rng = makeRng((seed | 0) * 2_654_435_761 + gap.index * 40_503 + 1);
    for (const sp of ENTRY_SPEEDS) for (const ang of ENTRY_ANGLES) {
      const rad = (ang * Math.PI) / 180;
      const engine = makeBaseEngine({ position: { x: 0, y: 0 }, velocity: { x: sp * Math.cos(rad), y: sp * Math.sin(rad) } });
      const ts = readTargetState(engine, durFrames, 0, 0);
      const axisMeasureEnd = axisLookaheadEndFrame(local, [durFrames]);
      for (let a = 0; a < attemptsPerEntry; a++) {
        const sweep = { air: rng(), speed: rng(), contact_style: rng(), grain: rng() };
        const sweptGap: Gap = { ...local, targets: sweep };
        const arc = sampleArcParams(rng, ts.sledX, ts.sledY, sweep, ts, a, sweptGap);
        const fit = tryCandidate(engine, sweptGap, arc, 1, [durFrames], axisMeasureEnd, sweep, true);
        if (fit === null) continue;
        // Re-detect to read contact geometry.
        let eng = engine;
        for (const ln of fit.lines) eng = eng.addLine(engineLineFromTrackLine(ln));
        const det = detect(extractRawTrajectory(eng, durFrames + 30));
        const lf = durFrames; // catch lands at gap.endFrame by hard gate
        const inV = velocityAt(det, Math.max(0, lf - 1)) ?? { x: 0, y: 0 };
        const inSpeed = Math.hypot(inV.x, inV.y);
        const inAngle = (Math.atan2(inV.y, inV.x) * 180) / Math.PI;
        // contact line tangent
        const owned = new Set(fit.lines.map((l) => l.id));
        const cids = contactLineIdsAt(det, lf).filter((id) => owned.has(id));
        let lineAngle = inAngle; // fallback: no angle -> 0 contact angle
        if (cids.length > 0) {
          const ln = fit.lines.find((l) => l.id === cids[0]) as TrackLine;
          lineAngle = (Math.atan2(ln.y2 - ln.y1, ln.x2 - ln.x1) * 180) / Math.PI;
        }
        const contactAngle = foldAngle(inAngle, lineAngle); // 0..90
        // post-contact grounded frames
        let pf = 0;
        for (let f = lf; f <= durFrames + 25; f++) { if (airborneAt(det, f) === false) pf++; else if (f > lf) break; }
        // slide segment containing lf
        let segFrames = 0;
        for (const s of det.summary.slideSegments) if (s.start <= lf && lf <= s.end + 1) { segFrames = s.durationFrames; break; }
        const exitSpeed = speedAt(det, Math.min(durFrames + 10, lf + 6)) ?? inSpeed;

        viable++;
        C.old.push(fit.achieved.contact_style ?? 0);
        C.angle.push(contactAngle / 90);
        C.contactFrac.push(Math.min(1, pf / durFrames));
        C.slideSegFrac.push(Math.min(1, segFrames / durFrames));
        C.speedRetain.push(Math.min(1, (inSpeed > 0 ? exitSpeed / inSpeed : 0) / 1.5));
        angleRaw.push(contactAngle);
      }
    }
  }
}

console.log(`specs=${specs.join(",")} seed=${seed} viable=${viable}`);
console.log("\n=== candidate distributions (normalized [0,1]) ===");
const cand: [string, number[]][] = [["old_cs", C.old], ["contactAngle/90", C.angle], ["contactFrac", C.contactFrac], ["slideSegFrac", C.slideSegFrac], ["speedRetain", C.speedRetain]];
for (const [name, a] of cand) {
  console.log(`${name.padEnd(16)} min=${pct(a, 0).toFixed(2)} p10=${pct(a, 0.1).toFixed(2)} p50=${pct(a, 0.5).toFixed(2)} p90=${pct(a, 0.9).toFixed(2)} max=${pct(a, 1).toFixed(2)}  ${shape(a)}`);
}
console.log("\n=== controllability (corr with realized contact angle) & intent (corr with old_cs) ===");
for (const [name, a] of cand) {
  console.log(`${name.padEnd(16)} corr(angle)=${pearson(angleRaw, a).toFixed(3)}  corr(old_cs)=${pearson(C.old, a).toFixed(3)}`);
}
