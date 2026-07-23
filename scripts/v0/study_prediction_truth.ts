/**
 * Prediction-truth agreement study for the aim-knob prediction architectures
 * (read-only; does not touch production search/ranking).
 *
 * Question (Jérémie): for the variables of interest — the rider state at the
 * next contact (`next.*`), the current-gap axes/errors (`current.axis.*` /
 * `current.error.*` incl. impact), and the exit launch state (`exit.*`) — how
 * well do the two short-probe prediction ARCHITECTURES agree with each other
 * and with full-simulation truth?
 *
 *   latent architecture : reduce(fit(latents))   — probe rows carry latentOutputs.
 *                          predictJointArcOutputs follows the latent path.
 *   direct architecture : fit(reduce(row))        — the study reduces measured
 *                          latents into exit/next outputs per row, then strips
 *                          latentOutputs so the fit runs knobs → reduced outputs
 *                          directly with no latent models.
 *
 * Per (gap, base-arc) sweep:
 *   1. Ride the probe design (cross5, optionally pitch3) in short mode with
 *      includeTruth. Each probe row then has short current outputs, latents,
 *      AND the full-sim truth observation.
 *   2. Fit BOTH architectures from the SAME rows.
 *   3. Evaluate at held-out knobs (pitch ∈ {±2, ±4, ±6}, rotate 0 — not in the
 *      cross5/pitch3 design). For each held-out knob ride ONE extra short+truth
 *      probe and record per output key:
 *        - latent prediction   = predictJointArcOutputs(latentModel, knobs)
 *        - direct prediction    = predictJointArcOutputs(directModel, knobs)
 *        - shortRead measured   = the row's OWN short reduction
 *            (latent path: reduceLatentJointArcOutputs(row.latentOutputs);
 *             direct path: the study's per-row direct reduction)
 *        - full-sim truth        = row.truth.outputs
 *   4. Accumulate, per output key:
 *        mean|latent−truth|, mean|direct−truth|, mean|latent−direct|,
 *        mean|shortRead−truth|  (the reduction's own error floor: fit layer vs
 *                                 reduction layer).
 *      Angles use wrapped absolute difference.
 *
 * Also: argmax-disagreement — over the held-out pitch grid, do latent and direct
 * pick a DIFFERENT best knob when scored by |arrival-speed error| (proxy
 * |next.speed − truth.next.speed|)? This asks whether the two architectures even
 * disagree where it would change the search decision.
 *
 * The report additionally stratifies measured-latent next-vy residuals by
 * launch-read window and cross-validates constant/timing/pose/kinematic
 * corrections across seeds. These are counterfactual diagnostics only; they
 * do not alter the production estimator.
 *
 * Run (LR_ENGINE=wasm npx tsx scripts/v0/study_prediction_truth.ts):
 *   [--specs=a,b,...] [--seeds=0,1] [--budget=120000]
 *   [--designs=cross5,pitch3] [--max-gaps=0]
 */
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { axisLookaheadEndFrame } from "./core/candidate.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { AXES, FPS, type AxisValues, type Gap, type TrackLine } from "./types.ts";
import {
  arcKnobKey,
  arcProbeDesign,
  fitJointArcResponseModel,
  fitLinearLeastSquares,
  isArcAngleOutput,
  normalizeAngleDeg,
  parseArcProbeDesignName,
  predictJointArcOutputs,
  predictLinearModel,
  reduceLatentJointArcOutputs,
  type ArcKnobs,
  type ArcProbeDesignName,
  type JointArcProbeRow,
  type JointArcResponseContext,
} from "./optimizer/arc_model.ts";
import { evaluateJointArcKnobs } from "./optimizer/arc_probe.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { LAUNCH_VY_OFFSET_PX } from "./core/launch_read.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = "swoop_dive,big_air_ramp,tiny_dance,drums_signature,opening_burst,dense_sprint";
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",").filter(Boolean) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1").split(",").filter(Boolean).map(Number);
const budget = Number(argValue("budget") ?? "120000");
const designNames = (argValue("designs") ?? "cross5,pitch3")
  .split(",").filter(Boolean).map(parseArcProbeDesignName);
const maxGapsPerTrack = Number(argValue("max-gaps") ?? "0") || Infinity;

// Held-out evaluation knobs: pitch sweep not present in either probe design.
const HELD_OUT_KNOBS: ArcKnobs[] = [-6, -4, -2, 2, 4, 6].map((pitchDeg) => ({ pitchDeg, rotateDeg: 0 }));

for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}
if (!Number.isFinite(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);

type TrackJson = {
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: TrackLine[];
};

// The output keys we care about, grouped.
const NEXT_KEYS = [
  "next.x", "next.y", "next.vx", "next.vy",
  "next.speed", "next.comAngleDeg", "next.sledPoseDeg", "next.sledPoseRateDegPerFrame",
] as const;
const EXIT_KEYS = [
  "exit.x", "exit.y", "exit.vx", "exit.vy",
  "exit.speed", "exit.comAngleDeg", "exit.sledPoseDeg", "exit.sledPoseRateDegPerFrame",
] as const;
function currentKeys(): string[] {
  const out: string[] = [];
  for (const axis of AXES) out.push(`current.axis.${axis}`);
  for (const axis of AXES) out.push(`current.error.${axis}`);
  return out;
}
function groupOf(key: string): "next.state" | "exit.state" | "current.axes" | "other" {
  if (key.startsWith("next.")) return "next.state";
  if (key.startsWith("exit.")) return "exit.state";
  if (key.startsWith("current.axis.") || key.startsWith("current.error.")) return "current.axes";
  return "other";
}

type Stat = { latentVsTruth: number[]; directVsTruth: number[]; latentVsDirect: number[]; shortReadVsTruth: number[] };
function emptyStat(): Stat {
  return { latentVsTruth: [], directVsTruth: [], latentVsDirect: [], shortReadVsTruth: [] };
}

function absDiff(key: string, a: number | undefined, b: number | undefined): number | null {
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(isArcAngleOutput(key) ? normalizeAngleDeg(a - b) : a - b);
}

function mkEngine(track: TrackJson, lines: TrackLine[]): any {
  let engine = new LineRiderEngine();
  engine = engine.setStart(
    track.startPosition ?? { x: 0, y: 0 },
    track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
  );
  if (lines.length > 0) engine = engine.addLine(lines.map(createLineFromJson));
  return engine;
}

function chainArcGroups(lines: TrackLine[]): TrackLine[][] {
  const groups: TrackLine[][] = [];
  let current: TrackLine[] = [];
  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev !== undefined && line.x1 === prev.x2 && line.y1 === prev.y2) current.push(line);
    else {
      if (current.length > 0) groups.push(current);
      current = [line];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function targetsFromGapReport(gapReport: { axes?: Record<string, { target?: number }> } | undefined): AxisValues {
  const targets: AxisValues = {};
  if (gapReport === undefined) return targets;
  for (const axis of AXES) {
    const target = gapReport.axes?.[axis]?.target;
    if (target !== undefined && Number.isFinite(target)) targets[axis] = target;
  }
  return targets;
}

// ---- accumulators -----------------------------------------------------------
// keyed by `${design}\0${outputKey}`
const stats = new Map<string, Stat>();
const nextVySignedErrors: number[] = [];
type VyCalibrationRow = {
  spec: string;
  seed: number;
  error: number;
  dt: number;
  launchReadFrames: number;
  vx: number;
  vy: number;
  sledPoseDeg: number;
  sledPoseRateDegPerFrame: number;
};
const vyCalibrationRows: VyCalibrationRow[] = [];
function statFor(design: string, key: string): Stat {
  const k = `${design}\0${key}`;
  let s = stats.get(k);
  if (s === undefined) { s = emptyStat(); stats.set(k, s); }
  return s;
}
// per-spec breakdown for the priority keys
type SpecKey = `${string}\0${string}\0${string}`; // design \0 spec \0 outputKey
const specStats = new Map<SpecKey, Stat>();
const PRIORITY_KEYS = ["next.speed", "next.comAngleDeg", "current.error.impact"] as const;
function specStatFor(design: string, spec: string, key: string): Stat {
  const k = `${design}\0${spec}\0${key}` as SpecKey;
  let s = specStats.get(k);
  if (s === undefined) { s = emptyStat(); specStats.set(k, s); }
  return s;
}

// argmax-disagreement counters, per design
type Argmax = { sweeps: number; disagree: number; bothScored: number };
const argmax = new Map<string, Argmax>();
function argmaxFor(design: string): Argmax {
  let a = argmax.get(design);
  if (a === undefined) { a = { sweeps: 0, disagree: 0, bothScored: 0 }; argmax.set(design, a); }
  return a;
}

// coverage
let sweepsTotal = 0;
const sweepsWithFiniteTruth = new Map<string, number>(); // by design
let evalProbeRides = 0;
let evalRowsGateFailedTruth = 0;
let skippedPairing = 0;
let skippedNoTargets = 0;
let skippedNoNext = 0;
let sims = 0;

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function directShortOutputs(row: JointArcProbeRow, context: JointArcResponseContext): Record<string, number> {
  const reduced = row.latentOutputs === undefined ? {} : reduceLatentJointArcOutputs(row.latentOutputs, context);
  return { ...reduced, ...row.outputs };
}

// Reduce measured latents, then strip latentOutputs → direct architecture rows.
function directArchitectureRows(rows: JointArcProbeRow[], context: JointArcResponseContext): JointArcProbeRow[] {
  return rows.map((r) => ({ knobs: r.knobs, outputs: directShortOutputs(r, context) }));
}

async function yieldMaybe(): Promise<void> {
  sims++;
  if (sims % 40 === 0) {
    (globalThis as { gc?: () => void }).gc?.();
    await new Promise((res) => setImmediate(res));
  }
}

// ---- main sweep -------------------------------------------------------------
for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const t0 = Date.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const track = checkpoint.track as TrackJson;
    const report = checkpoint.report;
    const groups = chainArcGroups(track.lines ?? []);
    const nContacts = report.contacts.length;
    const startX = track.startPosition?.x ?? 0;
    const hasStartArc = groups.length > 0 && groups[0][0].x1 <= startX;
    const offset = hasStartArc ? 1 : 0;
    if (groups.length !== nContacts + offset) {
      skippedPairing++;
      console.error(`  ${specName}/s${seed}: arc pairing not confident (${groups.length} arcs vs ${nContacts} contacts) - skipped`);
      continue;
    }

    const gapReports = new Map<number, { axes?: Record<string, { target?: number }> }>();
    for (const g of report.gaps) gapReports.set(g.gap_index, g);
    const frameOfGap = new Map<number, number>();
    for (const g of report.gaps) frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));
    const contactFrames = [...frameOfGap.values()].sort((a, b) => a - b);

    let gapsDone = 0;
    for (let k = 0; k + 1 < nContacts && gapsDone < maxGapsPerTrack; k++) {
      const currentFrame = frameOfGap.get(k);
      const nextFrame = frameOfGap.get(k + 1);
      if (currentFrame === undefined || nextFrame === undefined) { skippedNoNext++; continue; }
      const targets = targetsFromGapReport(gapReports.get(k));
      if (Object.keys(targets).length === 0) { skippedNoTargets++; continue; }
      const gap: Gap = {
        index: k,
        startFrame: frameOfGap.get(k - 1) ?? 0,
        endFrame: currentFrame,
        endsWithContact: true,
        targets,
      };
      const arc = groups[offset + k];
      const before = groups.slice(0, offset + k).flat();
      const axisMeasureEnd = axisLookaheadEndFrame(gap, contactFrames);
      const context: JointArcResponseContext = { gap, axisMeasureEnd, nextFrame };

      for (const designName of designNames) {
        const probeKnobs = arcProbeDesign(designName);
        const probeKeySet = new Set(probeKnobs.map(arcKnobKey));

        // 1. ride probe rows (short + truth)
        const probeRows: JointArcProbeRow[] = [];
        for (const knobs of probeKnobs) {
          const engine = mkEngine(track, before);
          const probe = evaluateJointArcKnobs(
            engine, arc, knobs, gap, contactFrames, axisMeasureEnd, nextFrame,
            { mode: "short", includeTruth: true },
          );
          probeRows.push({
            knobs,
            outputs: probe.outputs,
            ...(probe.latentOutputs === undefined ? {} : { latentOutputs: probe.latentOutputs }),
          });
          await yieldMaybe();
        }
        if (probeRows.length === 0) continue;

        // 2. fit both architectures from the same rows
        const latentModel = fitJointArcResponseModel(probeRows, designName, "hybrid", { context });
        const directModel = fitJointArcResponseModel(directArchitectureRows(probeRows, context), designName, "hybrid", { context });

        sweepsTotal++;
        let sweepHadFiniteTruth = false;

        // 3. evaluate at held-out knobs
        // For argmax: collect (knob -> |next.speed err|) for latent and direct.
        const latentSpeedErr: Array<{ knob: ArcKnobs; err: number }> = [];
        const directSpeedErr: Array<{ knob: ArcKnobs; err: number }> = [];

        for (const knobs of HELD_OUT_KNOBS) {
          if (probeKeySet.has(arcKnobKey(knobs))) continue; // never collide with probe design
          const engine = mkEngine(track, before);
          const probe = evaluateJointArcKnobs(
            engine, arc, knobs, gap, contactFrames, axisMeasureEnd, nextFrame,
            { mode: "short", includeTruth: true },
          );
          evalProbeRides++;
          await yieldMaybe();
          const truth = probe.truth?.outputs;
          if (truth === undefined || Object.keys(truth).length === 0) { evalRowsGateFailedTruth++; continue; }

          const latentPred = predictJointArcOutputs(latentModel, knobs);
          const directPred = predictJointArcOutputs(directModel, knobs);
          // shortRead of THIS held-out probe row itself:
          //  - latent path: reduce(this row's measured latents)
          //  - direct path: this row's measured latents reduced directly
          const latentShortRead = probe.latentOutputs === undefined
            ? {}
            : reduceLatentJointArcOutputs(probe.latentOutputs, context);
          const directShortRead = directShortOutputs(probe, context);
          const truthVy = truth["next.vy"];
          const predictedVy = latentShortRead["next.vy"];
          const suffixFrame = probe.latentOutputs?.["latent.suffix.frame"];
          const suffixVx = probe.latentOutputs?.["latent.suffix.vx"];
          const suffixVy = probe.latentOutputs?.["latent.suffix.vy"];
          const suffixPose = probe.latentOutputs?.["latent.suffix.sledPoseDeg"];
          const suffixPoseRate = probe.latentOutputs?.["latent.suffix.sledPoseRateDegPerFrame"];
          if (
            Number.isFinite(truthVy) &&
            Number.isFinite(predictedVy) &&
            Number.isFinite(suffixFrame) &&
            Number.isFinite(suffixVx) &&
            Number.isFinite(suffixVy) &&
            Number.isFinite(suffixPose) &&
            Number.isFinite(suffixPoseRate) &&
            Number.isFinite(probe.launchReadFrames)
          ) {
            vyCalibrationRows.push({
              spec: specName,
              seed,
              error: predictedVy - truthVy,
              dt: nextFrame - suffixFrame,
              launchReadFrames: probe.launchReadFrames,
              vx: suffixVx,
              vy: suffixVy,
              sledPoseDeg: suffixPose,
              sledPoseRateDegPerFrame: suffixPoseRate,
            });
          }

          const allKeys = new Set<string>([
            ...NEXT_KEYS, ...EXIT_KEYS, ...currentKeys(),
            ...Object.keys(truth),
          ]);
          for (const key of allKeys) {
            // Truth reference. Full-sim measures next.* and current.* directly.
            // It does NOT measure the exit launch state (exit.* is purely a
            // short-probe construct), so for exit.* keys we use the held-out
            // probe's OWN measured exit (directShortRead = measured latents
            // reduced directly)
            // as the reference — this makes the exit columns a fit-error /
            // architecture-agreement read against the measured launch state,
            // NOT against an independent full-sim truth. Noted in the report.
            const isExit = key.startsWith("exit.");
            const t = isExit ? directShortRead[key] : truth[key];
            if (t === undefined || !Number.isFinite(t)) continue;
            sweepHadFiniteTruth = true;
            const s = statFor(designName, key);
            const lt = absDiff(key, latentPred[key], t);
            const dt = absDiff(key, directPred[key], t);
            const ld = absDiff(key, latentPred[key], directPred[key]);
            // shortRead vs truth — the reduction's own error floor. Prefer the
            // latent reduction (reduce(measured latents)) when present, else the
            // direct short read. For exit.* the reference IS the direct short
            // read, so its shortRead-vs-ref collapses to the latent/direct
            // reduction gap (reported for completeness).
            const shortReadVal = latentShortRead[key] ?? directShortRead[key];
            const st = absDiff(key, shortReadVal, t);
            if (lt !== null) s.latentVsTruth.push(lt);
            if (dt !== null) s.directVsTruth.push(dt);
            if (ld !== null) s.latentVsDirect.push(ld);
            if (st !== null) s.shortReadVsTruth.push(st);
            if (key === "next.vy" && Number.isFinite(latentShortRead[key])) {
              nextVySignedErrors.push(latentShortRead[key] - t);
            }

            if ((PRIORITY_KEYS as readonly string[]).includes(key)) {
              const ss = specStatFor(designName, specName, key);
              if (lt !== null) ss.latentVsTruth.push(lt);
              if (dt !== null) ss.directVsTruth.push(dt);
              if (ld !== null) ss.latentVsDirect.push(ld);
              if (st !== null) ss.shortReadVsTruth.push(st);
            }
          }

          // argmax proxy: |predicted next.speed − truth next.speed| per knob
          const truthSpeed = truth["next.speed"];
          if (Number.isFinite(truthSpeed)) {
            const lp = latentPred["next.speed"];
            const dp = directPred["next.speed"];
            if (Number.isFinite(lp)) latentSpeedErr.push({ knob: knobs, err: Math.abs(lp - truthSpeed) });
            if (Number.isFinite(dp)) directSpeedErr.push({ knob: knobs, err: Math.abs(dp - truthSpeed) });
          }
        }

        if (sweepHadFiniteTruth) bump(sweepsWithFiniteTruth, designName);

        // argmax disagreement: which held-out knob does each architecture rank
        // as lowest |next.speed err|? (proxy for which knob the search would
        // prefer on arrival-speed fit.)
        const a = argmaxFor(designName);
        a.sweeps++;
        if (latentSpeedErr.length > 0 && directSpeedErr.length > 0) {
          a.bothScored++;
          const bestL = latentSpeedErr.reduce((m, x) => (x.err < m.err ? x : m));
          const bestD = directSpeedErr.reduce((m, x) => (x.err < m.err ? x : m));
          if (arcKnobKey(bestL.knob) !== arcKnobKey(bestD.knob)) a.disagree++;
        }
      }
      gapsDone++;
    }
    console.error(`  ${specName}/s${seed} done: ${gapsDone} gaps, ${Date.now() - t0} ms, sweeps=${sweepsTotal}`);
  }
}

// ---- reporting --------------------------------------------------------------
function mean(xs: number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function fmt(x: number): string {
  if (!Number.isFinite(x)) return "n/a";
  const ax = Math.abs(x);
  if (ax >= 1000) return x.toFixed(1);
  if (ax >= 100) return x.toFixed(2);
  return x.toFixed(3);
}
function unit(key: string): string {
  if (key === "next.x" || key === "next.y" || key === "exit.x" || key === "exit.y") return "px";
  if (key.endsWith(".vx") || key.endsWith(".vy") || key.endsWith(".speed")) return "px/f";
  if (key.endsWith(".comAngleDeg") || key.endsWith(".sledPoseDeg")) return "deg";
  if (key.endsWith(".sledPoseRateDegPerFrame")) return "deg/f";
  if (key.startsWith("current.")) return "axis";
  return "";
}

function printTable(design: string): void {
  console.log(`\n================ design=${design} ================`);
  console.log(`sweeps with finite truth: ${sweepsWithFiniteTruth.get(design) ?? 0} / ${argmaxFor(design).sweeps}`);
  const header =
    "output                              n   |lat-truth| |dir-truth| |lat-dir| |short-truth|  unit";
  const printGroup = (title: string, keys: readonly string[]): void => {
    console.log(`\n-- ${title} --`);
    console.log(header);
    for (const key of keys) {
      const s = stats.get(`${design}\0${key}`);
      if (s === undefined) { continue; }
      const n = Math.max(
        s.latentVsTruth.length, s.directVsTruth.length, s.latentVsDirect.length, s.shortReadVsTruth.length,
      );
      console.log(
        `${key.padEnd(35)} ${String(n).padStart(4)}` +
          ` ${fmt(mean(s.latentVsTruth)).padStart(11)}` +
          ` ${fmt(mean(s.directVsTruth)).padStart(11)}` +
          ` ${fmt(mean(s.latentVsDirect)).padStart(9)}` +
          ` ${fmt(mean(s.shortReadVsTruth)).padStart(12)}  ${unit(key)}`,
      );
    }
  };
  printGroup("next.state (rider state at next contact)", NEXT_KEYS);
  printGroup("current axes & errors", currentKeys());
  printGroup("exit.state (launch/suffix state)", EXIT_KEYS);
}

console.log(`\n=== prediction-truth agreement study ===`);
console.log(`specs=${specNames.join(",")} seeds=${seeds.join(",")} budget=${budget}`);
console.log(`designs=${designNames.join(",")}  held-out knobs=${HELD_OUT_KNOBS.map((k) => k.pitchDeg).join(",")} (pitch, rotate=0)`);
console.log(`sweeps=${sweepsTotal} eval probe rides=${evalProbeRides} (gate-failed truth skipped=${evalRowsGateFailedTruth})`);
console.log(`skipped: pairing=${skippedPairing} no_targets=${skippedNoTargets} no_next=${skippedNoNext}`);

for (const design of designNames) printTable(design);

if (nextVySignedErrors.length > 0) {
  const sorted = [...nextVySignedErrors].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(
    `\nmeasured-latent next.vy signed error: mean=${fmt(mean(nextVySignedErrors))}` +
      ` median=${fmt(median)} n=${nextVySignedErrors.length}`,
  );
  console.log("launch vy offset counterfactual       bias      MAE");
  for (const offset of [
    LAUNCH_VY_OFFSET_PX - 0.01,
    LAUNCH_VY_OFFSET_PX - 0.005,
    LAUNCH_VY_OFFSET_PX,
    LAUNCH_VY_OFFSET_PX + 0.005,
    0.043,
    LAUNCH_VY_OFFSET_PX + 0.015,
  ]) {
    const delta = offset - LAUNCH_VY_OFFSET_PX;
    const shifted = nextVySignedErrors.map((error) => error + delta);
    console.log(
      `${offset.toFixed(4).padStart(10)} px/f ${fmt(mean(shifted)).padStart(9)}` +
        ` ${fmt(mean(shifted.map(Math.abs))).padStart(8)}`,
    );
  }
}
printVyFeatureCalibration(vyCalibrationRows);

// per-spec breakdown for priority keys
console.log(`\n================ per-spec breakdown (priority keys) ================`);
console.log("design  spec                 output                    n  |lat-truth| |dir-truth| |lat-dir| |short-truth|");
for (const design of designNames) {
  for (const specName of specNames) {
    for (const key of PRIORITY_KEYS) {
      const s = specStats.get(`${design}\0${specName}\0${key}` as SpecKey);
      if (s === undefined) continue;
      const n = Math.max(s.latentVsTruth.length, s.directVsTruth.length, s.shortReadVsTruth.length);
      if (n === 0) continue;
      console.log(
        `${design.padEnd(7)} ${specName.padEnd(20)} ${key.padEnd(25)} ${String(n).padStart(2)}` +
          ` ${fmt(mean(s.latentVsTruth)).padStart(11)}` +
          ` ${fmt(mean(s.directVsTruth)).padStart(11)}` +
          ` ${fmt(mean(s.latentVsDirect)).padStart(9)}` +
          ` ${fmt(mean(s.shortReadVsTruth)).padStart(12)}`,
      );
    }
  }
}

// argmax disagreement
console.log(`\n================ argmax disagreement (|next.speed err| proxy over held-out pitch grid) ================`);
console.log("design   sweeps  both_scored  disagree  disagree%");
for (const design of designNames) {
  const a = argmaxFor(design);
  const pct = a.bothScored > 0 ? (100 * a.disagree / a.bothScored).toFixed(1) : "n/a";
  console.log(
    `${design.padEnd(8)} ${String(a.sweeps).padStart(6)} ${String(a.bothScored).padStart(12)}` +
      ` ${String(a.disagree).padStart(9)} ${String(pct).padStart(9)}%`,
  );
}
console.log();

function printVyFeatureCalibration(rows: readonly VyCalibrationRow[]): void {
  if (rows.length === 0 || new Set(rows.map((row) => row.seed)).size < 2) return;
  console.log("\nnext.vy measured-latent error by launch-read window");
  console.log("read-frames seed      n     bias      MAE");
  for (const readFrames of [...new Set(rows.map((row) => row.launchReadFrames))].sort((a, b) => a - b)) {
    for (const seed of ["all", ...new Set(rows.map((row) => row.seed))] as const) {
      const errors = rows
        .filter((row) => row.launchReadFrames === readFrames && (seed === "all" || row.seed === seed))
        .map((row) => row.error);
      console.log(
        `${String(readFrames).padStart(11)} ${String(seed).padStart(4)} ${String(errors.length).padStart(6)}` +
          ` ${fmt(mean(errors)).padStart(8)} ${fmt(mean(errors.map(Math.abs))).padStart(8)}`,
      );
    }
  }
  console.log("\nnext.vy one-frame offset counterfactual");
  console.log("one-frame-offset seed      n     bias      MAE");
  for (const oneFrameOffset of [LAUNCH_VY_OFFSET_PX, 0.0265, 0]) {
    for (const seed of ["all", ...new Set(rows.map((row) => row.seed))] as const) {
      const selected = rows.filter((row) => seed === "all" || row.seed === seed);
      const errors = selected.map((row) =>
        row.error + (row.launchReadFrames === 1 ? oneFrameOffset - LAUNCH_VY_OFFSET_PX : 0)
      );
      console.log(
        `${oneFrameOffset.toFixed(4).padStart(16)} ${String(seed).padStart(4)}` +
          ` ${String(errors.length).padStart(6)} ${fmt(mean(errors)).padStart(8)}` +
          ` ${fmt(mean(errors.map(Math.abs))).padStart(8)}`,
      );
    }
  }
  const featureSets = {
    constant: (_row: VyCalibrationRow) => [1],
    read_window: (row: VyCalibrationRow) => [
      1,
      row.launchReadFrames === 2 ? 1 : 0,
      row.launchReadFrames === 3 ? 1 : 0,
      row.launchReadFrames === 4 ? 1 : 0,
    ],
    timing: (row: VyCalibrationRow) => [1, row.dt / 20],
    pose: (row: VyCalibrationRow) => {
      const pose = row.sledPoseDeg * Math.PI / 180;
      return [
        1,
        row.sledPoseRateDegPerFrame / 5,
        Math.sin(pose),
        Math.cos(pose),
      ];
    },
    kinematics: (row: VyCalibrationRow) => {
      const pose = row.sledPoseDeg * Math.PI / 180;
      return [
        1,
        row.dt / 20,
        row.vx / 10,
        row.vy / 5,
        row.sledPoseRateDegPerFrame / 5,
        Math.sin(pose),
        Math.cos(pose),
      ];
    },
  };
  console.log("\nnext.vy feature-correction cross-validation (fit correction on other seeds)");
  console.log("model          test-seed      n  base-MAE corrected-MAE  delta");
  for (const testSeed of [...new Set(rows.map((row) => row.seed))].sort((a, b) => a - b)) {
    const train = rows.filter((row) => row.seed !== testSeed);
    const test = rows.filter((row) => row.seed === testSeed);
    for (const [name, features] of Object.entries(featureSets)) {
      const model = fitLinearLeastSquares(
        train.map((row) => ({ features: features(row), value: -row.error })),
        1e-6,
      );
      if (model === null) continue;
      const baseMae = mean(test.map((row) => Math.abs(row.error)));
      const correctedMae = mean(test.map((row) =>
        Math.abs(row.error + predictLinearModel(model, features(row)))
      ));
      console.log(
        `${name.padEnd(14)} ${String(testSeed).padStart(9)} ${String(test.length).padStart(6)}` +
          ` ${fmt(baseMae).padStart(9)} ${fmt(correctedMae).padStart(13)}` +
          ` ${fmt(correctedMae - baseMae).padStart(7)}`,
      );
    }
  }
}
