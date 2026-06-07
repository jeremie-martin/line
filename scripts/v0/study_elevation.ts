/**
 * Elevation study harness.
 *
 * For each benchmark spec (scripts/v0/specs/elev_bench.ts): compile it, then
 * RE-SIMULATE the produced track to recover the rider's true per-frame positions
 * (the compiler's candidate detections drop `position`, so we rebuild a full
 * trajectory here). For every contact gap we line up three things:
 *   - the authored elevation TARGET,
 *   - the reported ACHIEVED (and CEILING),
 *   - the TRUE net altitude change Δy (px) the rider physically made,
 * plus an ASCII altitude profile so you can SEE the path and judge whether the
 * axis value matches what the rider actually did. This is the semantic check:
 * does "elevation 0.8" look like a climb in the real path?
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_elevation.ts [nameFilter] [--budget=N]
 */
import { ELEV_BENCH } from "./specs/elev_bench.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { extractRawTrajectory, detect } from "../lib/detector.ts";
import { scoreDriftReport } from "./score.ts";
import { FPS, secToFrame, netDyToElevation, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
const nameFilter = argv.find((a) => !a.startsWith("--")) ?? "";
const budget = Number((argv.find((a) => a.startsWith("--budget=")) ?? "--budget=200000").split("=")[1]);

const BLOCKS = "▁▂▃▄▅▆▇█";
const COLS = 64;

function sparkline(values: number[], lo: number, hi: number, cols = COLS): string {
  if (values.length === 0) return "";
  const span = hi - lo || 1;
  let out = "";
  for (let c = 0; c < cols; c++) {
    const idx = Math.min(values.length - 1, Math.round((c / (cols - 1)) * (values.length - 1)));
    const norm = Math.max(0, Math.min(1, (values[idx] - lo) / span));
    out += BLOCKS[Math.min(BLOCKS.length - 1, Math.round(norm * (BLOCKS.length - 1)))];
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? NaN : sxy / d;
}

function trackStart(track: any): { position: { x: number; y: number }; velocity: { x: number; y: number } } {
  const r = track.riders?.[0];
  return {
    position: { x: track.startPosition?.x ?? 0, y: track.startPosition?.y ?? 0 },
    velocity: { x: r?.startVelocity?.x ?? 0.4, y: r?.startVelocity?.y ?? 0 },
  };
}

type GapRow = {
  t: number; target: number; achieved: number; ceiling: number | undefined;
  trueDy: number; fromTrueDy: number; speed: number;
};

function studyOne(name: string, note: string, spec: Spec) {
  const { track, report } = compileHandoff(spec, 0, { budget });
  const score = scoreDriftReport(report, { totalFrames: track.duration });

  // Re-simulate for true positions.
  const start = trackStart(track);
  let engine: any = new LineRiderEngine().setStart(start.position, start.velocity);
  for (const line of track.lines ?? []) engine = engine.addLine(createLineFromJson(line));
  const det = detect(extractRawTrajectory(engine, track.duration));
  const pos = det.measurements.position;
  const vel = det.measurements.velocity;
  const lastF = det.terminus.frame;

  const contactFrames = spec.contacts.map((c) => secToFrame(c.t));
  const rows: GapRow[] = [];
  for (const g of report.gaps) {
    const e = g.axes.elevation;
    if (!e) continue;
    const j = g.gap_index;
    const endFrame = contactFrames[j];
    const startFrame = j === 0 ? 0 : contactFrames[j - 1];
    if (endFrame === undefined || endFrame > lastF || startFrame > lastF) continue;
    const ps = pos[startFrame], pe = pos[endFrame], vs = vel[startFrame];
    if (!ps || !pe || !vs) continue;
    const trueDy = pe.y - ps.y; // down = +
    const speed = Math.hypot(vs.x, vs.y);
    rows.push({
      t: endFrame / FPS, target: e.target, achieved: e.achieved, ceiling: e.ceiling,
      trueDy, fromTrueDy: netDyToElevation(trueDy, speed, endFrame - startFrame), speed,
    });
  }

  // Altitude profile (up = +, so negate y), over the live ride.
  const altitude: number[] = [];
  for (let f = 0; f <= lastF && f < pos.length; f++) altitude.push(-pos[f].y);
  const aLo = Math.min(...altitude), aHi = Math.max(...altitude);
  const netDy = pos[lastF] ? pos[lastF].y - pos[0].y : 0; // down = +

  // Target curve sampled across the same columns.
  const targetCurve: number[] = [];
  for (let c = 0; c < COLS; c++) {
    const t = (c / (COLS - 1)) * (lastF / FPS);
    targetCurve.push(spec.axes.elevation?.(t) ?? 0.5);
  }

  const elevErr = rows.length ? rows.reduce((s, r) => s + Math.abs(r.target - r.achieved), 0) / rows.length : NaN;
  const corr = pearson(rows.map((r) => r.target), rows.map((r) => r.achieved));
  const measErr = rows.length ? rows.reduce((s, r) => s + Math.abs(r.achieved - r.fromTrueDy), 0) / rows.length : NaN;
  const hits = report.contacts.filter((c) => c.status === "hit").length;

  console.log(`\n### ${name} — ${note}`);
  console.log(
    `score ${score.score.toFixed(0)} | ${det.terminus.reason}@${lastF}/${track.duration} | ` +
    `${hits}/${report.contacts.length} hit | elev mean|err| ${elevErr.toFixed(3)} | ` +
    `corr(tgt,ach) ${isNaN(corr) ? "n/a" : corr.toFixed(2)} | meas|ach−fromΔy| ${measErr.toFixed(3)} | ` +
    `net Δy ${netDy <= 0 ? "↑" : "↓"}${Math.abs(netDy).toFixed(0)}px`,
  );
  console.log(`  altitude ${sparkline(altitude, aLo, aHi)}  (range ${(aHi - aLo).toFixed(0)}px)`);
  console.log(`  elev tgt ${sparkline(targetCurve, 0, 1)}`);
  // Sample up to 8 gap rows evenly.
  const step = Math.max(1, Math.floor(rows.length / 8));
  const sampled = rows.filter((_, i) => i % step === 0).slice(0, 9);
  for (const r of sampled) {
    console.log(
      `   t=${r.t.toFixed(1).padStart(4)}  tgt ${r.target.toFixed(2)} → ach ${r.achieved.toFixed(2)} ` +
      `(ceil ${r.ceiling !== undefined ? r.ceiling.toFixed(2) : "?"})  trueΔy ${r.trueDy <= 0 ? "↑" : "↓"}${Math.abs(r.trueDy).toFixed(0).padStart(3)}px  v=${r.speed.toFixed(1)}`,
    );
  }
  return { name, score: score.score, elevErr, corr, survived: det.terminus.reason === "endOfSpec", netDy };
}

const cases = ELEV_BENCH.filter((c) => !nameFilter || c.name.includes(nameFilter));
console.log(`elevation study — ${cases.length} cases @ budget ${budget}`);
const summary = cases.map((c) => studyOne(c.name, c.note, c.spec));

console.log(`\n=== summary ===`);
console.log(`${"case".padEnd(18)} ${"score".padStart(6)} ${"elevErr".padStart(8)} ${"corr".padStart(6)} ${"survived".padStart(9)} ${"netΔy".padStart(7)}`);
for (const s of summary) {
  console.log(
    `${s.name.padEnd(18)} ${s.score.toFixed(0).padStart(6)} ${s.elevErr.toFixed(3).padStart(8)} ` +
    `${(isNaN(s.corr) ? "n/a" : s.corr.toFixed(2)).padStart(6)} ${String(s.survived).padStart(9)} ${(s.netDy <= 0 ? "↑" : "↓") + Math.abs(s.netDy).toFixed(0)}`.padStart(0),
  );
}
