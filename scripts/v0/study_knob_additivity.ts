/**
 * Knob-additivity study (multi-knob aiming feasibility) — read-only.
 *
 * The single-knob aimer (V3) generalizes to multi-knob/multi-outcome aiming
 * via a local Jacobian ONLY IF knob effects compose additively:
 *   f(δp, δr) ≈ f(δp, 0) + f(0, δr) − f(0, 0)
 * (no orthogonality required — additivity is the load-bearing assumption).
 * V0 swept knobs one at a time, so this is unmeasured. Here, per gap k of
 * compiled tracks, we simulate base, each single perturbation, and the joint
 * perturbation for pitch×rotate combos, and compare the joint outcome to the
 * additive prediction. Report |interaction residual| vs the joint effect
 * magnitude per outcome (arrival speed / angle / height at gap k+1).
 *
 *   LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_knob_additivity.ts [--specs=..] [--seeds=0,1] [--budget=300000]
 */
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { getRiderMetered } from "../lib/detector.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { FPS } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DEFAULT_SPECS = "dense_echo_climb,cold_start,rolling_drop,drums_dropout";
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

/** knob 1: exit pitch (last third about its joint); knob 2: whole-arc rotate
 *  about entry. Apply rotate FIRST then pitch (order is part of the knob
 *  definition; a Jacobian model fixes one). */
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

type Out = { ok: boolean; speed: number; angle: number; y: number };
function measure(track: TrackJson, lines: Line[], frame: number): Out {
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
  return {
    ok: !broken && Number.isFinite(rider.position?.x ?? NaN),
    speed,
    angle: speed > 0 ? Math.atan2(v.y, v.x) * DEG : 0,
    y: rider.position?.y ?? NaN,
  };
}

const COMBOS: [number, number][] = [[6, 3], [6, -3], [-6, 3], [-6, -3]];
type Sample = { resid: number; joint: number };
const samples: Record<string, Sample[]> = { speed: [], angle: [], y: [] };
let gapsUsed = 0;
let crashes = 0;

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
    for (const g of report.gaps) frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));

    for (let k = 0; k + 1 < nContacts; k++) {
      const frameNext = frameOfGap.get(k + 1);
      if (frameNext === undefined) continue;
      const arcK = groups[offset + k];
      const before = groups.slice(0, offset + k).flat();
      const sim = (p: number, r: number): Out =>
        measure(track, [...before, ...applyKnobs(arcK, p, r)], frameNext);

      const base = sim(0, 0);
      if (!base.ok) continue;
      let usable = false;
      for (const [p, r] of COMBOS) {
        const fp = sim(p, 0);
        const fr = sim(0, r);
        const fj = sim(p, r);
        if (!fp.ok || !fr.ok || !fj.ok) { crashes++; continue; }
        usable = true;
        for (const key of ["speed", "angle", "y"] as const) {
          const additive = fp[key] + fr[key] - base[key];
          samples[key].push({
            resid: Math.abs(fj[key] - additive),
            joint: Math.abs(fj[key] - base[key]),
          });
        }
      }
      if (usable) gapsUsed++;
      if (gapsUsed % 25 === 0) {
        (globalThis as { gc?: () => void }).gc?.();
        await new Promise((res) => setImmediate(res));
      }
    }
    console.error(`  ${specName}/s${seed} done (${gapsUsed} gaps so far)`);
  }
}

const pctl = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
console.log(`\n=== knob additivity (pitch ±6° × rotate ±3°, budget ${budget}) ===`);
console.log(`gaps ${gapsUsed} · combo crashes ${crashes}\n`);
console.log("outcome   |interaction|p50/p90   |joint effect|p50   resid/effect p50/p90");
for (const key of ["speed", "angle", "y"] as const) {
  const rs = samples[key];
  const ratios = rs.filter((s) => s.joint > 1e-6).map((s) => s.resid / s.joint);
  console.log(
    `${key.padEnd(8)} ${pctl(rs.map((s) => s.resid), 0.5).toFixed(3)}/${pctl(rs.map((s) => s.resid), 0.9).toFixed(3)}` +
      `            ${pctl(rs.map((s) => s.joint), 0.5).toFixed(3)}` +
      `            ${pctl(ratios, 0.5).toFixed(3)}/${pctl(ratios, 0.9).toFixed(3)}`,
  );
}
