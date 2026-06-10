/**
 * Joint-enumeration scout (R3 multi-knob inner model) — read-only.
 *
 * The R2 enum lane sweeps ONE knob (exit pitch) inside per-knob quadratic
 * models and proposes the top-2 deltas. R3's structural upgrade is a joint
 * inner model over (pitch, rotate). Additivity is already CERTIFIED
 * proposer-grade (study_knob_additivity: median interaction ~10%, p90 ~1×),
 * so the open questions are ECONOMIC, and that is what this scout measures
 * under the PRODUCTION objective (readiness × speed-fit × impact-feasibility):
 *
 *   1. Headroom — at what fraction of gaps does the joint argmax beat the
 *      pitch-only argmax, and by how much (predicted AND achieved)?
 *   2. Where — do the gains concentrate where pitch is boundary-clamped
 *      (the V0 fact: speeding up is authority-limited at 31% of gaps)?
 *   3. Additivity at the argmax — selection bias seeks out model error, so
 *      certify the additive prediction at the chosen point, not at random.
 *   4. Rotate risk — crash rate of joint winners vs pitch winners (rotateArc
 *      moves the landing surface; the old blind fallback died on gates).
 *
 * Verdict gates the Phase B lane implementation (eager 5-probe vs lazy
 * rotate-on-clamp vs not-worth-it).
 *
 *   LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_joint_enum.ts [--specs=..] [--seeds=0,1] [--budget=300000]
 */
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { getRiderMetered } from "../lib/detector.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { readinessCatch } from "./optimizer/readiness.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { authoredSpeedToPx, CALIB, FPS } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DEFAULT_SPECS = "dense_echo_climb,cold_start,rolling_drop,drums_dropout,skyline_push,terrace_sprint";
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1").split(",").map(Number);
const budget = Number(argValue("budget") ?? "300000");
for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}

const DEG = 180 / Math.PI;
type Line = { id: number; type: number; x1: number; y1: number; x2: number; y2: number };
type TrackJson = {
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: Line[];
};

// ── geometry (same knob definitions as aim.ts / study_knob_additivity) ──

function chainArcGroups(lines: Line[]): Line[][] {
  const groups: Line[][] = [];
  let current: Line[] = [];
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

function rotateAbout(lines: Line[], pivot: { x: number; y: number }, deg: number): Line[] {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const r = (x: number, y: number): [number, number] => [
    pivot.x + (x - pivot.x) * c - (y - pivot.y) * s,
    pivot.y + (x - pivot.x) * s + (y - pivot.y) * c,
  ];
  return lines.map((l) => {
    const [x1, y1] = r(l.x1, l.y1);
    const [x2, y2] = r(l.x2, l.y2);
    return { ...l, x1, y1, x2, y2 };
  });
}

/** Rotate FIRST then pitch — the order certified by the additivity study. */
function applyKnobs(arc: Line[], pitchDeg: number, rotDeg: number): Line[] {
  let out = rotDeg !== 0 ? rotateAbout(arc, { x: arc[0].x1, y: arc[0].y1 }, rotDeg) : arc;
  if (pitchDeg !== 0) {
    const m = Math.max(1, Math.ceil(out.length / 3));
    const head = out.slice(0, out.length - m);
    const tail = out.slice(out.length - m);
    out = [...head, ...rotateAbout(tail, { x: tail[0].x1, y: tail[0].y1 }, pitchDeg)];
  }
  return out;
}

// ── probes & models (production replicas) ──

type Out = { ok: boolean; speed: number; angle: number };
let engineCrashes = 0;
function measure(track: TrackJson, lines: Line[], frame: number): Out | null {
  // EVERY engine interaction guarded: perturbed geometry panics the wasm
  // engine on paths production never feeds it (study lesson, R0).
  try {
    let engine = new LineRiderEngine();
    engine = engine.setStart(
      track.startPosition ?? { x: 0, y: 0 },
      track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
    );
    if (lines.length > 0) engine = engine.addLine(lines.map(createLineFromJson));
    const rider = getRiderMetered(engine, frame);
    let broken = false;
    try {
      broken = rider.get?.("SLED_INTACT")?.isBinded?.() === false ||
        rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false;
    } catch { /* intact */ }
    const v = rider.velocity ?? { x: 0, y: 0 };
    const speed = Math.hypot(v.x, v.y);
    if (broken || !Number.isFinite(rider.position?.x ?? NaN) || !(speed > 0)) return { ok: false, speed: 0, angle: 0 };
    return { ok: true, speed, angle: Math.atan2(v.y, v.x) * DEG };
  } catch {
    engineCrashes++;
    return null;
  }
}

/** Exact quadratic through (−P, lo), (0, mid), (+P, hi) — aim.ts replica. */
function quadModel(lo: number, mid: number, hi: number, P: number): (d: number) => number {
  return (d: number): number =>
    (lo * d * (d - P)) / (2 * P * P) - (mid * (d + P) * (d - P)) / (P * P) +
    (hi * (d + P) * d) / (2 * P * P);
}

// ── production objective replica (aim.ts makeEnumAimedCandidates) ──

const R_MIN = 0.1;
const SPEED_SCALE_PXF = 0.75;
const IMPACT_MIN_ASK = 0.3;
function makeObjective(speedTarget: number | null, impactAsk: number | undefined) {
  const wantImpact = impactAsk !== undefined && impactAsk >= IMPACT_MIN_ASK;
  return (s: number, a: number): number => {
    const r = Math.max(R_MIN, readinessCatch(s, a));
    const fit = speedTarget === null ? 1 : Math.exp(-Math.abs(s - speedTarget) / SPEED_SCALE_PXF);
    const feas = !wantImpact ? 1 : Math.min(
      1,
      Math.max(0, (s * Math.sin((Math.max(0, a) * Math.PI) / 180)) / ((impactAsk as number) * CALIB.REDIR_CAP)),
    );
    return r * fit * feas;
  };
}

// ── sweep parameters ──

const PITCH_PROBE = 6; // AIM_PROBE_DELTA_DEG
const ROT_PROBE = 3; // AIM_ROT_PROBE_DEG
const PITCH_SPAN = 10; // aimDeltaMaxDeg default
const ROT_SPAN = 4; // probe ±3, same ~1.6× extrapolation ratio as pitch (±6 → ±10)
const STEP = 0.25;
const ROT_STEP = 0.5;
const MIN_DELTA = 0.25;

type GapRow = {
  spec: string;
  seed: number;
  k: number;
  obj0: number;
  pitchBest: { dp: number; val: number };
  jointBest: { dp: number; dr: number; val: number };
  pitchAtBoundary: boolean;
  // validation rides at the argmaxes
  pitchAchieved: number | null; // achieved objective (null = ride crashed/broke)
  jointAchieved: number | null;
  jointAddErrSpeed: number | null; // |additive-predicted − achieved| at joint argmax
  jointAddErrAngle: number | null;
};
const rows: GapRow[] = [];
let gapsSeen = 0;
let gapsNoTarget = 0;
let gapsProbeFail = 0;

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const checkpoint = compileHandoff(spec, seed, { budget });
    const track = checkpoint.track as TrackJson;
    const report = checkpoint.report;
    const groups = chainArcGroups((track.lines ?? []) as Line[]);
    const nContacts = report.contacts.length;
    const offset = groups.length > 0 && groups[0][0].x1 <= (track.startPosition?.x ?? 0) ? 1 : 0;
    if (groups.length !== nContacts + offset) continue;
    const frameOfGap = new Map<number, number>();
    const targetsOfGap = new Map<number, Record<string, number>>();
    for (const g of report.gaps) {
      frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));
      const targets: Record<string, number> = {};
      for (const [axis, v] of Object.entries((g as { axes?: Record<string, unknown> }).axes ?? {})) {
        const t = (v as { target?: number | null }).target;
        if (t !== undefined && t !== null) targets[axis] = t;
      }
      targetsOfGap.set(g.gap_index, targets);
    }

    for (let k = 0; k + 1 < nContacts; k++) {
      gapsSeen++;
      const frameNext = frameOfGap.get(k + 1);
      const targetsNext = targetsOfGap.get(k + 1);
      if (frameNext === undefined || targetsNext === undefined) continue;
      const speedTarget = targetsNext.speed !== undefined ? authoredSpeedToPx(targetsNext.speed) : null;
      const impactAsk = targetsNext.impact;
      if (speedTarget === null && (impactAsk === undefined || impactAsk < IMPACT_MIN_ASK)) {
        gapsNoTarget++;
        continue;
      }
      const arcK = groups[offset + k];
      const before = groups.slice(0, offset + k).flat();
      const sim = (p: number, r: number): Out | null =>
        measure(track, [...before, ...applyKnobs(arcK, p, r)], frameNext);

      const base = sim(0, 0);
      const pLo = sim(-PITCH_PROBE, 0);
      const pHi = sim(PITCH_PROBE, 0);
      const rLo = sim(0, -ROT_PROBE);
      const rHi = sim(0, ROT_PROBE);
      if (!base?.ok || !pLo?.ok || !pHi?.ok || !rLo?.ok || !rHi?.ok) {
        gapsProbeFail++;
        continue;
      }
      const psM = quadModel(pLo.speed, base.speed, pHi.speed, PITCH_PROBE);
      const paM = quadModel(pLo.angle, base.angle, pHi.angle, PITCH_PROBE);
      const rsM = quadModel(rLo.speed, base.speed, rHi.speed, ROT_PROBE);
      const raM = quadModel(rLo.angle, base.angle, rHi.angle, ROT_PROBE);
      const predS = (dp: number, dr: number): number => psM(dp) + rsM(dr) - base.speed;
      const predA = (dp: number, dr: number): number => paM(dp) + raM(dr) - base.angle;
      const objective = makeObjective(speedTarget, impactAsk);
      const obj = (dp: number, dr: number): number => objective(predS(dp, dr), predA(dp, dr));

      const obj0 = obj(0, 0);
      const pitchBest = { dp: 0, val: obj0 };
      for (let dp = -PITCH_SPAN; dp <= PITCH_SPAN + 1e-9; dp += STEP) {
        if (Math.abs(dp) < MIN_DELTA) continue;
        const v = obj(dp, 0);
        if (v > pitchBest.val) Object.assign(pitchBest, { dp, val: v });
      }
      const jointBest = { dp: pitchBest.dp, dr: 0, val: pitchBest.val };
      for (let dr = -ROT_SPAN; dr <= ROT_SPAN + 1e-9; dr += ROT_STEP) {
        if (Math.abs(dr) < ROT_STEP / 2) continue;
        for (let dp = -PITCH_SPAN; dp <= PITCH_SPAN + 1e-9; dp += STEP) {
          const v = obj(dp, dr);
          if (v > jointBest.val) Object.assign(jointBest, { dp, dr, val: v });
        }
      }

      // Validation rides at the argmaxes (selection bias check: certify the
      // additive model where the sweep actually lands, not at random).
      const pv = pitchBest.dp !== 0 ? sim(pitchBest.dp, 0) : base;
      const jv = jointBest.dr !== 0 || jointBest.dp !== pitchBest.dp
        ? sim(jointBest.dp, jointBest.dr)
        : pv;
      rows.push({
        spec: specName,
        seed,
        k,
        obj0,
        pitchBest,
        jointBest,
        pitchAtBoundary: Math.abs(pitchBest.dp) >= PITCH_SPAN - STEP / 2,
        pitchAchieved: pv?.ok ? objective(pv.speed, pv.angle) : null,
        jointAchieved: jv?.ok ? objective(jv.speed, jv.angle) : null,
        jointAddErrSpeed: jv?.ok ? Math.abs(predS(jointBest.dp, jointBest.dr) - jv.speed) : null,
        jointAddErrAngle: jv?.ok ? Math.abs(predA(jointBest.dp, jointBest.dr) - jv.angle) : null,
      });
      if (rows.length % 25 === 0) {
        (globalThis as { gc?: () => void }).gc?.();
        await new Promise((res) => setImmediate(res));
      }
    }
    console.error(`  ${specName}/s${seed} done (${rows.length} target gaps so far)`);
  }
}

// ── analysis ──

const pctl = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const f3 = (x: number): string => x.toFixed(3);

console.log(`\n=== joint-enum scout (pitch ±${PITCH_SPAN}° × rotate ±${ROT_SPAN}°, probes 5/gap, budget ${budget}) ===`);
console.log(
  `gaps seen ${gapsSeen} · no-target ${gapsNoTarget} · probe-fail ${gapsProbeFail} · ` +
    `usable ${rows.length} · engine crashes ${engineCrashes}\n`,
);

const rotEngaged = rows.filter((r) => r.jointBest.dr !== 0);
console.log(`joint argmax uses rotate: ${rotEngaged.length}/${rows.length} (${(100 * rotEngaged.length / rows.length).toFixed(0)}%)`);

const predGain = rows.map((r) => r.jointBest.val - r.pitchBest.val);
const predGainRel = rows.filter((r) => r.pitchBest.val > 1e-6).map((r) => r.jointBest.val / r.pitchBest.val - 1);
console.log(`predicted joint−pitch objective gain: p50 ${f3(pctl(predGain, 0.5))} · p90 ${f3(pctl(predGain, 0.9))} · rel p50 ${f3(pctl(predGainRel, 0.5))} · rel p90 ${f3(pctl(predGainRel, 0.9))}`);
for (const thr of [0.05, 0.15]) {
  const n = predGainRel.filter((g) => g > thr).length;
  console.log(`  gaps with predicted rel gain > ${thr}: ${n}/${rows.length} (${(100 * n / rows.length).toFixed(0)}%)`);
}

const byBoundary = (b: boolean) => rows.filter((r) => r.pitchAtBoundary === b);
for (const b of [true, false]) {
  const rs = byBoundary(b);
  const g = rs.filter((r) => r.pitchBest.val > 1e-6).map((r) => r.jointBest.val / r.pitchBest.val - 1);
  const eng = rs.filter((r) => r.jointBest.dr !== 0).length;
  console.log(
    `pitch ${b ? "AT boundary" : "interior  "} (${rs.length} gaps): rel gain p50 ${f3(pctl(g, 0.5))} p90 ${f3(pctl(g, 0.9))} · rotate engaged ${rs.length > 0 ? (100 * eng / rs.length).toFixed(0) : "—"}%`,
  );
}

const both = rows.filter((r) => r.pitchAchieved !== null && r.jointAchieved !== null);
const achGain = both.map((r) => (r.jointAchieved as number) - (r.pitchAchieved as number));
console.log(`\nachieved (validation rides, ${both.length} gaps): joint−pitch objective p50 ${f3(pctl(achGain, 0.5))} · p90 ${f3(pctl(achGain, 0.9))} · mean ${f3(achGain.reduce((a, x) => a + x, 0) / Math.max(1, achGain.length))}`);
const winners = both.filter((r) => r.jointBest.dr !== 0);
const wGain = winners.map((r) => (r.jointAchieved as number) - (r.pitchAchieved as number));
console.log(`  rotate-engaged subset (${winners.length}): achieved gain p50 ${f3(pctl(wGain, 0.5))} · p90 ${f3(pctl(wGain, 0.9))} · positive ${wGain.filter((g) => g > 0).length}/${wGain.length}`);

const errS = rows.map((r) => r.jointAddErrSpeed).filter((x): x is number => x !== null);
const errA = rows.map((r) => r.jointAddErrAngle).filter((x): x is number => x !== null);
console.log(`\nadditive model error AT JOINT ARGMAX: speed p50 ${f3(pctl(errS, 0.5))} p90 ${f3(pctl(errS, 0.9))} px/f · angle p50 ${f3(pctl(errA, 0.5))} p90 ${f3(pctl(errA, 0.9))} deg`);

const jointCrash = rows.filter((r) => r.jointBest.dr !== 0 && r.jointAchieved === null).length;
const pitchCrash = rows.filter((r) => r.pitchBest.dp !== 0 && r.pitchAchieved === null).length;
const nJointRides = rows.filter((r) => r.jointBest.dr !== 0).length;
const nPitchRides = rows.filter((r) => r.pitchBest.dp !== 0).length;
console.log(`argmax ride break rate: joint(rot≠0) ${jointCrash}/${nJointRides} · pitch-only ${pitchCrash}/${nPitchRides}`);
