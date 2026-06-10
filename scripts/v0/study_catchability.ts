/**
 * R0 — catchability ground-truth study (docs/READINESS_ROADMAP.md). Read-only.
 *
 * Question: does SLED POSE at arrival (internal rotation, TAIL→NOSE) predict
 * whether the next gap's catch succeeds — BEYOND what speed and CoM velocity
 * angle already predict? Pose is the readiness component generation is blind
 * to today; this study decides whether it earns a place in the readiness
 * model (roadmap R1) or gets parked with a verdict.
 *
 * Committed tracks alone cannot answer this: the compiler only commits
 * passing catches (~100% gate pass, no outcome variation). So we GENERATE
 * diverse arrivals: per gap k of each compiled track, truncate to arcs ≤ k
 * (generation fidelity), sweep arc k with the two validated knob families
 * (exit pitch, whole-arc rotation — the rotation family decorrelates pose
 * from CoM angle across sweep points), and measure, per arrival:
 *
 *   ARRIVAL (at gap k+1's beat frame): speed, CoM velocity angle, sled pose,
 *   pose rate (pose(F) − pose(F−1), wrap detection).
 *
 *   OUTCOME tier A (fixed catch): ride through the COMMITTED arc k+1 —
 *   landing within ±1 frame of the beat (production hard-gate-2 semantics)
 *   + achieved impact via production measureGapAxes. Biased (the committed
 *   catch was built for the ORIGINAL arrival — the coupling law says most
 *   perturbed arrivals break it), kept as the fixed-surface reference.
 *
 *   OUTCOME tier B (production re-fit — the readiness ground truth): sample
 *   K fresh catches for gap k+1 with the PRODUCTION sampler conditioned on
 *   the perturbed arrival (exactly what generation does), and record the
 *   viable fraction (sampleOneCandidate's hard gates: survival, on-beat
 *   landing ±1f, no off-beat) + best achieved impact. "From this arrival,
 *   can production build a converting catch?"
 *
 * Analysis: catch rate by |pose − comAngle| bins; stratified by
 * (comAngle × speed) to control the confound; OLS R² of tier-B catch rate
 * for features (speed, comAngle) vs + pose terms — the RESIDUAL question.
 *
 *   LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_catchability.ts [--specs=..] [--seeds=0,1] [--budget=300000] \
 *     [--k=8] [--max-gaps=N] [--out=path.jsonl]
 *
 * Read-only: production compile paths untouched; nothing scored or written
 * back; the study's own RNG never touches production draws.
 */
import { writeFileSync } from "node:fs";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import {
  detect,
  extractRawTrajectory,
  getRiderMetered,
  sledPoseDegFromRider,
} from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { axisLookaheadEndFrame } from "./core/candidate.ts";
import { measureGapAxes } from "./core/measure.ts";
import { solveOneGap } from "./optimizer/solver.ts";
import type { SpecContext } from "./optimizer/sample.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { FPS, type AxisValues, type Gap } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = "dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout";
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1").split(",").map(Number);
const budget = Number(argValue("budget") ?? "300000");
const K_REFITS = Number(argValue("k") ?? "8");
const maxGapsPerTrack = Number(argValue("max-gaps") ?? "0") || Infinity;
const outPath = argValue("out");
for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}

const DEG = 180 / Math.PI;
const wrap180 = (deg: number): number => {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

type Line = {
  id: number; type: number; x1: number; y1: number; x2: number; y2: number;
  flipped?: boolean; leftExtended?: boolean; rightExtended?: boolean;
};
type TrackJson = {
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: Line[];
};

// ─────────── arc grouping + knob families (as validated in study_arc_sensitivity) ───────────

function chainArcGroups(lines: Line[]): Line[][] {
  const groups: Line[][] = [];
  let current: Line[] = [];
  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev !== undefined && line.x1 === prev.x2 && line.y1 === prev.y2) {
      current.push(line);
    } else {
      if (current.length > 0) groups.push(current);
      current = [line];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function rotateAbout(lines: Line[], pivot: { x: number; y: number }, deg: number): Line[] {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const rot = (x: number, y: number): [number, number] => {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    return [pivot.x + dx * c - dy * s, pivot.y + dx * s + dy * c];
  };
  return lines.map((l) => {
    const [x1, y1] = rot(l.x1, l.y1);
    const [x2, y2] = rot(l.x2, l.y2);
    return { ...l, x1, y1, x2, y2 };
  });
}

function perturbExitPitch(arc: Line[], deg: number): Line[] {
  const m = Math.max(1, Math.ceil(arc.length / 3));
  const head = arc.slice(0, arc.length - m);
  const tail = arc.slice(arc.length - m);
  return [...head, ...rotateAbout(tail, { x: tail[0].x1, y: tail[0].y1 }, deg)];
}

function perturbArcRotate(arc: Line[], deg: number): Line[] {
  return rotateAbout(arc, { x: arc[0].x1, y: arc[0].y1 }, deg);
}

type SweepPoint = { family: "baseline" | "exit_pitch" | "arc_rotate"; delta: number };
const SWEEP: SweepPoint[] = [
  { family: "baseline", delta: 0 },
  ...[-10, -6, -3, 3, 6, 10].map((d) => ({ family: "exit_pitch", delta: d }) as SweepPoint),
  ...[-4, -2, 2, 4].map((d) => ({ family: "arc_rotate", delta: d }) as SweepPoint),
];

// ─────────── simulation helpers ───────────

function buildEngine(track: TrackJson, lines: Line[]): LineRiderEngine {
  let engine = new LineRiderEngine();
  engine = engine.setStart(
    track.startPosition ?? { x: 0, y: 0 },
    track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
  );
  const converted = lines.map(createLineFromJson);
  if (converted.length > 0) engine = engine.addLine(converted);
  return engine;
}

type Arrival = {
  ok: boolean;
  speed: number;
  comAngleDeg: number;
  poseDeg: number | null;
  /** pose(F) − pose(F−1), wrapped — spin/wrap detector. */
  poseRateDeg: number | null;
};

// deno-lint-ignore no-explicit-any
function readArrival(engine: any, frame: number): Arrival {
  const rider = getRiderMetered(engine, frame);
  const pos = rider.position ?? { x: NaN, y: NaN };
  const vel = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(vel.x, vel.y);
  let broken = false;
  let ejected = false;
  try {
    broken = rider.get?.("SLED_INTACT")?.isBinded?.() === false;
    ejected = rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false;
  } catch { /* intact */ }
  const poseDeg = sledPoseDegFromRider(rider);
  // F−1 is already simulated — free read.
  const posePrev = sledPoseDegFromRider(getRiderMetered(engine, Math.max(0, frame - 1)));
  return {
    ok: !broken && !ejected && Number.isFinite(pos.x) && Number.isFinite(pos.y) && speed > 0,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vel.y, vel.x) * DEG : 0,
    poseDeg,
    poseRateDeg: poseDeg !== null && posePrev !== null ? wrap180(poseDeg - posePrev) : null,
  };
}

/** Tier A: ride through the committed catch; production hard-gate-2 landing
 *  semantics + production impact measurement against the fixed surface. */
function measureFixedCatch(
  track: TrackJson,
  lines: Line[],
  catchLines: Line[],
  gap: Gap,
  lookEnd: number,
): { gate: boolean; impact: number | null } {
  const engine = buildEngine(track, [...lines, ...catchLines]);
  const raw = extractRawTrajectory(engine, lookEnd + 2);
  const det = detect(raw);
  const events = det.events as { type: string; frame: number }[];
  let landed = false;
  for (const e of events) {
    if (e.type === "landing" && Math.abs(e.frame - gap.endFrame) <= 1) {
      landed = true;
      break;
    }
  }
  if (!landed) return { gate: false, impact: null };
  const achieved = measureGapAxes(
    det,
    gap,
    catchLines as never,
    lookEnd,
  );
  return { gate: true, impact: achieved.impact ?? null };
}

// ─────────── rows ───────────

type Row = {
  spec: string;
  seed: number;
  gapIndex: number; // gap k (the perturbed launch); outcomes are at k+1
  family: string;
  delta: number;
  // arrival at gap k+1's beat frame
  speed: number;
  comAngleDeg: number;
  poseDeg: number | null;
  poseRelDeg: number | null; // wrap180(pose − comAngle): the catchability angle
  poseRateDeg: number | null;
  // next-gap context
  impactAsk: number | null;
  // tier A — fixed committed catch
  fixedGate: boolean;
  fixedImpact: number | null;
  // tier B — production re-fit (the readiness ground truth)
  refitViable: number;
  refitAttempts: number;
  refitBestImpact: number | null;
  refitBestCost: number | null;
};

const rows: Row[] = [];
let sims = 0;
const yieldMaybe = async (): Promise<void> => {
  if (sims % 10 === 0) {
    (globalThis as { gc?: () => void }).gc?.();
    await new Promise((r) => setImmediate(r));
  }
};

// ─────────── main ───────────

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const t0 = Date.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const track = checkpoint.track as TrackJson;
    const report = checkpoint.report;
    const lines = track.lines ?? [];
    const groups = chainArcGroups(lines);

    const nContacts = report.contacts.length;
    const startX = track.startPosition?.x ?? 0;
    const hasStartArc = groups.length > 0 && groups[0][0].x1 <= startX;
    const offset = hasStartArc ? 1 : 0;
    if (groups.length !== nContacts + offset) {
      console.error(
        `  ${specName}/s${seed}: arc pairing not confident (${groups.length} arcs vs ${nContacts} contacts) — skipped`,
      );
      continue;
    }

    const frameOfGap = new Map<number, number>();
    const targetsOfGap = new Map<number, AxisValues>();
    for (const g of report.gaps) {
      if (g.t_end !== undefined && g.t_end !== null) {
        frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));
      }
      const targets: AxisValues = {};
      for (const [axis, v] of Object.entries(g.axes ?? {})) {
        const t = (v as { target?: number | null }).target;
        if (t !== undefined && t !== null) (targets as Record<string, number>)[axis] = t;
      }
      targetsOfGap.set(g.gap_index, targets);
    }
    const contactFrames = [...frameOfGap.values()].sort((a, b) => a - b);
    const maxLineId = lines.reduce((m, l) => Math.max(m, l.id), 0);
    const ctx: SpecContext = {
      allContactFrames: contactFrames,
      durationFrames: Math.max(...contactFrames) + FPS,
    };

    let gapsDone = 0;
    for (let k = 0; k + 1 < nContacts && gapsDone < maxGapsPerTrack; k++) {
      const frameK = frameOfGap.get(k);
      const frameNext = frameOfGap.get(k + 1);
      const targetsNext = targetsOfGap.get(k + 1);
      if (frameK === undefined || frameNext === undefined || targetsNext === undefined) continue;
      if (Object.keys(targetsNext).length === 0) continue;
      const arcK = groups[offset + k];
      const arcNext = groups[offset + k + 1];
      const before = groups.slice(0, offset + k).flat();

      const pseudoGapNext = {
        index: k + 1,
        startFrame: frameK,
        endFrame: frameNext,
        endsWithContact: true,
        targets: targetsNext,
        nextImpact: targetsOfGap.get(k + 2)?.impact,
      } as unknown as Gap;
      const lookEnd = axisLookaheadEndFrame(pseudoGapNext, contactFrames);

      let producedAny = false;
      for (const point of SWEEP) {
        const perturbed = point.family === "baseline"
          ? arcK
          : point.family === "exit_pitch"
          ? perturbExitPitch(arcK, point.delta)
          : perturbArcRotate(arcK, point.delta);
        const prefixLines = [...before, ...perturbed];

        const engine = buildEngine(track, prefixLines);
        const arrival = readArrival(engine, frameNext);
        sims++;
        await yieldMaybe();
        if (!arrival.ok) continue; // no arrival — nothing to catch

        const fixed = measureFixedCatch(track, prefixLines, arcNext, pseudoGapNext, lookEnd);
        sims++;
        await yieldMaybe();

        // Tier B: production sampler conditioned on the perturbed arrival.
        // Study-only RNG (never touches production draws); deterministic per
        // (spec, seed, gap, family, delta).
        const famId = point.family === "baseline" ? 0 : point.family === "exit_pitch" ? 1 : 2;
        const rng = makeRng(
          (Math.imul(seed + 1, 2654435761) ^ Math.imul(k + 1, 40503) ^
            Math.imul(famId * 64 + (point.delta + 32), 2246822519)) | 0,
        );
        const cands = solveOneGap(engine, pseudoGapNext, rng, K_REFITS, ctx, maxLineId + 1000);
        sims += K_REFITS;
        await yieldMaybe();
        let bestImpact: number | null = null;
        let bestCost: number | null = null;
        for (const c of cands) {
          const imp = c.achieved.impact;
          if (imp !== undefined && (bestImpact === null || imp > bestImpact)) bestImpact = imp;
          if (bestCost === null || c.cost < bestCost) bestCost = c.cost;
        }

        rows.push({
          spec: specName,
          seed,
          gapIndex: k,
          family: point.family,
          delta: point.delta,
          speed: arrival.speed,
          comAngleDeg: arrival.comAngleDeg,
          poseDeg: arrival.poseDeg,
          poseRelDeg: arrival.poseDeg !== null ? wrap180(arrival.poseDeg - arrival.comAngleDeg) : null,
          poseRateDeg: arrival.poseRateDeg,
          impactAsk: targetsNext.impact ?? null,
          fixedGate: fixed.gate,
          fixedImpact: fixed.impact,
          refitViable: cands.length,
          refitAttempts: K_REFITS,
          refitBestImpact: bestImpact,
          refitBestCost: bestCost,
        });
        producedAny = true;
      }
      if (producedAny) gapsDone++;
    }
    console.error(
      `  ${specName}/s${seed}: ${gapsDone} gaps, ${rows.length} rows, ${sims} sims, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}

// ─────────── analysis ───────────

const mean = (xs: number[]): number => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f2 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : "n/a");
const f3 = (x: number): string => (Number.isFinite(x) ? x.toFixed(3) : "n/a");
const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(0)}%` : "n/a");

const usable = rows.filter((r) => r.poseRelDeg !== null);
console.log(`\n=== R0 catchability ground truth (budget ${budget}, K=${K_REFITS} re-fits/point) ===`);
console.log(`rows: ${rows.length} (${usable.length} with pose) · sims ${sims}\n`);

// 1. Catch rate by |poseRel| bin (with confound levels shown per bin).
const BINS: [number, number][] = [[0, 5], [5, 10], [10, 20], [20, 40], [40, 90], [90, 180]];
console.log("tier-B catch rate (production re-fit viable fraction) by |pose − comAngle|:");
console.log("  |poseRel|    n     catchRate  fixedGate  speed(mean)  comAngle(mean)  bestImpact(mean)");
for (const [lo, hi] of BINS) {
  const bin = usable.filter((r) => Math.abs(r.poseRelDeg as number) >= lo && Math.abs(r.poseRelDeg as number) < hi);
  if (bin.length === 0) continue;
  const catchRate = mean(bin.map((r) => r.refitViable / r.refitAttempts));
  const fixedRate = mean(bin.map((r) => (r.fixedGate ? 1 : 0)));
  const impacts = bin.filter((r) => r.refitBestImpact !== null).map((r) => r.refitBestImpact as number);
  console.log(
    `  ${`${lo}–${hi}°`.padEnd(10)} ${String(bin.length).padStart(5)} ${pct(catchRate).padStart(10)} ` +
      `${pct(fixedRate).padStart(9)} ${f2(mean(bin.map((r) => r.speed))).padStart(12)} ` +
      `${f2(mean(bin.map((r) => r.comAngleDeg))).padStart(15)} ${f3(mean(impacts)).padStart(17)}`,
  );
}

// 2. Stratified contrast: |poseRel| < 15 vs ≥ 15 within (comAngle × speed) strata.
console.log("\nstratified contrast (controls the speed/angle confound):");
console.log("  stratum                       n(<15°) rate(<15°)  n(≥15°) rate(≥15°)   Δ");
const angleBins: [number, number][] = [[-90, 0], [0, 10], [10, 20], [20, 90]];
const speedBins: [number, number][] = [[0, 6], [6, 9], [9, 99]];
let pooledDiff = 0;
let pooledW = 0;
for (const [alo, ahi] of angleBins) {
  for (const [slo, shi] of speedBins) {
    const stratum = usable.filter((r) =>
      r.comAngleDeg >= alo && r.comAngleDeg < ahi && r.speed >= slo && r.speed < shi
    );
    const aligned = stratum.filter((r) => Math.abs(r.poseRelDeg as number) < 15);
    const skewed = stratum.filter((r) => Math.abs(r.poseRelDeg as number) >= 15);
    if (aligned.length < 10 || skewed.length < 10) continue;
    const ra = mean(aligned.map((r) => r.refitViable / r.refitAttempts));
    const rs = mean(skewed.map((r) => r.refitViable / r.refitAttempts));
    const w = Math.min(aligned.length, skewed.length);
    pooledDiff += (ra - rs) * w;
    pooledW += w;
    console.log(
      `  angle ${`${alo}..${ahi}`.padEnd(7)} speed ${`${slo}..${shi}`.padEnd(5)} ` +
        `${String(aligned.length).padStart(8)} ${pct(ra).padStart(10)} ${String(skewed.length).padStart(8)} ` +
        `${pct(rs).padStart(10)} ${pct(ra - rs).padStart(6)}`,
    );
  }
}
console.log(`  pooled (weighted) Δ catch rate, aligned − skewed: ${pooledW > 0 ? pct(pooledDiff / pooledW) : "n/a"}`);

// 3. OLS R²: does pose add residual predictive power for tier-B catch rate?
function olsR2(ys: number[], xss: number[][]): number {
  const n = ys.length;
  const p = xss[0].length;
  // normal equations XtX b = Xty, Gaussian elimination with partial pivoting
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += xss[i][a] * ys[i];
      for (let b = a; b < p; b++) XtX[a][b] += xss[i][a] * xss[i][b];
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
  const A = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < p; col++) {
    let piv = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    if (Math.abs(A[col][col]) < 1e-12) return NaN;
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let cc = col; cc <= p; cc++) A[r][cc] -= f * A[col][cc];
    }
  }
  const beta = A.map((row, i) => row[p] / row[i]);
  const yMean = mean(ys);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let a = 0; a < p; a++) pred += beta[a] * xss[i][a];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : NaN;
}

const ys = usable.map((r) => r.refitViable / r.refitAttempts);
const base = usable.map((r) => [1, r.speed, r.comAngleDeg, r.comAngleDeg * r.comAngleDeg]);
const withPose = usable.map((r, i) => {
  const pr = Math.abs(r.poseRelDeg as number);
  return [...base[i], pr, pr * pr];
});
const r2Base = olsR2(ys, base);
const r2Pose = olsR2(ys, withPose);
console.log(`\nOLS R² for tier-B catch rate:`);
console.log(`  speed + comAngle (+²):           ${f3(r2Base)}`);
console.log(`  + |poseRel| (+²):                ${f3(r2Pose)}   (Δ ${f3(r2Pose - r2Base)})`);

// 4. Impact conversion among catchable arrivals on impact-ask gaps.
const impactRows = usable.filter((r) =>
  (r.impactAsk ?? 0) >= 0.3 && r.refitViable > 0 && r.refitBestImpact !== null
);
console.log(`\nimpact conversion (ask ≥ 0.3, ≥1 viable re-fit; n=${impactRows.length}):`);
console.log("  |poseRel|    n     bestImpact(mean)");
for (const [lo, hi] of BINS) {
  const bin = impactRows.filter((r) => Math.abs(r.poseRelDeg as number) >= lo && Math.abs(r.poseRelDeg as number) < hi);
  if (bin.length === 0) continue;
  console.log(
    `  ${`${lo}–${hi}°`.padEnd(10)} ${String(bin.length).padStart(5)} ${f3(mean(bin.map((r) => r.refitBestImpact as number))).padStart(17)}`,
  );
}

// 5. Pose-wrap incidence (roadmap caveat).
const rates = usable.filter((r) => r.poseRateDeg !== null).map((r) => Math.abs(r.poseRateDeg as number));
console.log(`\npose rate |Δ/frame|: p50 ${f2(rates.sort((a, b) => a - b)[Math.floor(rates.length / 2)] ?? NaN)}° · ` +
  `>45°/f (fast-spin/wrap risk): ${pct(rates.filter((x) => x > 45).length / Math.max(1, rates.length))}`);

if (outPath !== undefined) {
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`\nper-arrival rows → ${outPath}`);
}
