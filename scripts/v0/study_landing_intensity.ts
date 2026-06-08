/**
 * Landing-intensity study harness (exploration — NOT wired into the compiler).
 *
 * Goal: find a rock-solid, intuitive *measurement* of "how hard a landing is",
 * before we add it as an authorable per-bit target. We compile specs that
 * visibly differ in landing character (aerial taps vs grounded glides vs big
 * sparse soars), re-simulate to recover the true per-frame trajectory, locate
 * every detector `landing` event, and compute several CANDIDATE intensity
 * measures at each one so we can see which definition tracks intuition.
 *
 * Candidate measures at a landing on frame f (airborne over [airborneFrom, f-1]):
 *   speedIn     |v| on the last airborne frame (f-1)
 *   vyIn        downward velocity at impact (down = +), px/frame
 *   descDeg     flight-path descent angle at impact, deg (90 = straight down)
 *   dv1         |v[f] - v[f-1]|  — one-frame velocity change across contact
 *   dvPeak      max |v[k] - v[k-1]| over the settle window [f, f+SETTLE]
 *   normalIn    |v_in| component normal to the post-landing slide direction
 *               (= the speed killed by the surface) — the "shock"
 *   kickDeg     largest detector kick angle within the settle window, deg
 *
 * Usage:
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_landing_intensity.ts \
 *       drums_grounded drums_baseline drums_aerial probe_amplitude_sparse [--budget=N]
 */
import { compileHandoff } from "./optimizer/handoff.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { extractRawTrajectory, detect, type DetEvent } from "../lib/detector.ts";
import { scoreDriftReport } from "./score.ts";
import { FPS, CALIB, type Spec } from "./types.ts";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const budget = Number((argv.find((a) => a.startsWith("--budget=")) ?? "--budget=200000").split("=")[1]);
const names = argv.filter((a) => !a.startsWith("--"));
const SETTLE = 5; // frames after first contact to watch the velocity settle

type Vec = { x: number; y: number };
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const mag = (a: Vec): number => Math.hypot(a.x, a.y);

function trackStart(track: any) {
  const r = track.riders?.[0];
  return {
    position: { x: track.startPosition?.x ?? 0, y: track.startPosition?.y ?? 0 },
    velocity: { x: r?.startVelocity?.x ?? 0.4, y: r?.startVelocity?.y ?? 0 },
  };
}

type Row = {
  frame: number; airRun: number; speedIn: number; vyIn: number; descDeg: number;
  dv1: number; dvPeak: number; normalIn: number; kickDeg: number;
  /** measureImpact's placed-line-geometry normal impact (px) for this gap, ×CAP back from the report. */
  reportPx: number;
};

function studyOne(name: string) {
  const specPath = resolve(`scripts/v0/specs/${name}.ts`);
  return import(specPath).then((mod) => {
    const spec: Spec = mod.default;
    const { track, report } = compileHandoff(spec, 0, { budget });
    const score = scoreDriftReport(report, { totalFrames: track.duration });

    // Re-simulate to recover true per-frame velocity (compiler detections drop position).
    const start = trackStart(track);
    let engine: any = new LineRiderEngine().setStart(start.position, start.velocity);
    for (const line of track.lines ?? []) engine = engine.addLine(createLineFromJson(line));
    const det = detect(extractRawTrajectory(engine, track.duration));
    const vel = det.measurements.velocity;
    const lastF = det.terminus.frame;

    const kicks = det.events.filter((e): e is Extract<DetEvent, { type: "kick" }> => e.type === "kick");
    const landings = det.events.filter((e) => e.type === "landing");

    // Cross-check source: the compiler's own measureImpact (placed-line geometry),
    // recovered from the report's per-gap achieved impact (×IMPACT_CAP → px),
    // keyed by the gap's contact frame.
    const reportPxByFrame = new Map<number, number>();
    for (const g of report.gaps) {
      const a = g.axes.impact;
      if (a) reportPxByFrame.set(Math.round(g.t_end * FPS), a.achieved * CALIB.IMPACT_CAP);
    }

    const rows: Row[] = [];
    for (const e of landings) {
      const f = e.frame;
      if (f < 1 || f > lastF) continue;
      const vIn = vel[f - 1];
      const vLand = vel[f];
      if (!vIn || !vLand) continue;
      // Settled slide direction = average velocity over the GROUNDED run right
      // after contact (stops at the next takeoff), so it isn't contaminated by the
      // next arc's launch on sparse high-amplitude gaps. This is the robust form of
      // the velocity reference; the placed-line reduction is the authority.
      let sx = 0, sy = 0;
      for (let k = f; k <= Math.min(f + SETTLE, lastF); k++) {
        if (det.measurements.airborne[k]) break; // left the ground → stop
        if (vel[k]) { sx += vel[k].x; sy += vel[k].y; }
      }
      const vOut = (sx || sy) ? { x: sx, y: sy } : vLand;
      const speedIn = mag(vIn);
      const tHat = mag(vOut) > 1e-6 ? { x: vOut.x / mag(vOut), y: vOut.y / mag(vOut) } : { x: 1, y: 0 };
      // component of vIn normal to slide direction = |vIn x tHat|
      const normalIn = Math.abs(vIn.x * tHat.y - vIn.y * tHat.x);
      const dv1 = mag(sub(vLand, vIn));
      let dvPeak = 0;
      for (let k = f; k <= Math.min(f + SETTLE, lastF); k++) {
        if (vel[k] && vel[k - 1]) dvPeak = Math.max(dvPeak, mag(sub(vel[k], vel[k - 1])));
      }
      const descDeg = Math.atan2(vIn.y, Math.abs(vIn.x)) * (180 / Math.PI);
      const kickDeg = Math.max(0, ...kicks.filter((k) => k.frame >= f && k.frame <= f + SETTLE).map((k) => Math.abs(k.angleDeg)));
      const reportPx = reportPxByFrame.get(f) ?? reportPxByFrame.get(f - 1) ?? reportPxByFrame.get(f + 1) ?? NaN;
      rows.push({ frame: f, airRun: f - (e as any).airborneFrom, speedIn, vyIn: vIn.y, descDeg, dv1, dvPeak, normalIn, kickDeg, reportPx });
    }

    const stat = (xs: number[]) => {
      if (xs.length === 0) return { min: NaN, med: NaN, max: NaN, mean: NaN };
      const s = [...xs].sort((a, b) => a - b);
      return { min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1], mean: xs.reduce((a, b) => a + b, 0) / xs.length };
    };
    const col = (k: keyof Row) => stat(rows.map((r) => r[k] as number));

    console.log(`\n### ${name}  score ${score.score.toFixed(0)}  ${det.terminus.reason}@${lastF}/${track.duration}  landings=${rows.length}`);
    const fmt = (s: ReturnType<typeof stat>) => `min ${s.min.toFixed(2)}  med ${s.med.toFixed(2)}  max ${s.max.toFixed(2)}  mean ${s.mean.toFixed(2)}`;
    console.log(`  speedIn   ${fmt(col("speedIn"))}`);
    console.log(`  vyIn  (↓+)${fmt(col("vyIn"))}`);
    console.log(`  descDeg   ${fmt(col("descDeg"))}`);
    console.log(`  dv1       ${fmt(col("dv1"))}`);
    console.log(`  dvPeak    ${fmt(col("dvPeak"))}`);
    console.log(`  normalIn  ${fmt(col("normalIn"))}   (velocity-settle reference)`);
    console.log(`  reportPx  ${fmt(col("reportPx"))}   (measureImpact placed-line, px)`);
    console.log(`  kickDeg   ${fmt(col("kickDeg"))}`);
    // Cross-check: how closely the in-window placed-line reduction tracks the
    // full-resim velocity-settle reference. Only landings with a report value.
    const paired = rows.filter((r) => Number.isFinite(r.reportPx));
    if (paired.length) {
      const diffs = paired.map((r) => Math.abs(r.normalIn - r.reportPx));
      const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const refMean = paired.reduce((a, r) => a + r.normalIn, 0) / paired.length;
      console.log(`  CROSS-CHECK |placed−settle|  mean ${meanDiff.toFixed(2)}px  (${(100 * meanDiff / Math.max(1e-6, refMean)).toFixed(0)}% of settle mean ${refMean.toFixed(2)})  n=${paired.length}`);
    }
    // Per-landing detail (up to 12 evenly spaced).
    const step = Math.max(1, Math.floor(rows.length / 12));
    console.log(`  frame airRun speedIn  vyIn descDeg   dv1 dvPeak normalIn reportPx kickDeg`);
    for (let i = 0; i < rows.length; i += step) {
      const r = rows[i];
      console.log(`  ${String(r.frame).padStart(5)} ${String(r.airRun).padStart(6)} ${r.speedIn.toFixed(2).padStart(7)} ${r.vyIn.toFixed(2).padStart(5)} ${r.descDeg.toFixed(1).padStart(7)} ${r.dv1.toFixed(2).padStart(5)} ${r.dvPeak.toFixed(2).padStart(6)} ${r.normalIn.toFixed(2).padStart(8)} ${(Number.isFinite(r.reportPx) ? r.reportPx.toFixed(2) : "—").padStart(8)} ${r.kickDeg.toFixed(1).padStart(7)}`);
    }
    return { name, rows };
  });
}

const targets = names.length ? names : ["drums_grounded", "drums_baseline", "drums_aerial", "probe_amplitude_sparse"];
console.log(`landing-intensity study — ${targets.length} specs @ budget ${budget}, settle ${SETTLE}f`);
for (const n of targets) {
  await studyOne(n);
}
