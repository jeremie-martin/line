/**
 * Build the Remotion overlay data bundle for a curve-based v0 run.
 *
 * The new overlay is a TIME-SERIES instrument, not a per-section nameplate: it
 * draws each axis's authored TARGET curve as a smooth line, the per-gap MEASURED
 * value as dots, and the error as the band between them — so this emits exactly
 * that shape as a static JSON the React component renders.
 *
 *   npx tsx scripts/make_overlay_data.ts \
 *     --spec=scripts/v0/specs/believer_curves.ts \
 *     --report=generated/believer_curves_2m.report.json \
 *     --track=generated/believer_curves_2m.track.json \
 *     --out=remotion/public/believer_curves.overlay.json
 *
 * Phases are soft, human-readable energy labels (from the madmom analysis); the
 * axes themselves are continuous and owe nothing to these boundaries.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { AXES, FPS, type Spec, type DriftReport } from "./v0/types.ts";
import { scoreDriftReport } from "./v0/score.ts";

const argv = process.argv.slice(2);
const arg = (name: string, def?: string): string => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  if (m) return m.slice(name.length + 3);
  if (def !== undefined) return def;
  throw new Error(`missing --${name}=`);
};

const specPath = arg("spec", "scripts/v0/specs/believer_curves.ts");
const reportPath = arg("report", "generated/believer_curves_2m.report.json");
const trackPath = arg("track", "generated/believer_curves_2m.track.json");
const outPath = arg("out", "remotion/public/believer_curves.overlay.json");

const spec: Spec = (await import(resolve(specPath))).default;
const report: DriftReport = JSON.parse(readFileSync(resolve(reportPath), "utf8"));
const track = JSON.parse(readFileSync(resolve(trackPath), "utf8")) as { duration: number };

const durationS = track.duration / FPS;

// Per-axis color identity (cyan air / amber speed / violet grain).
const AXIS_META: Record<string, { label: string; color: string }> = {
  air: { label: "AIR", color: "#38d6c8" },
  speed: { label: "SPEED", color: "#f0b429" },
  grain: { label: "GRAIN", color: "#b07cf2" },
};

// Dense sample of each authored target curve (the smooth line). 0.05s ≈ 1131 pts
// over 56.5s — plenty to read the shape, trivially small JSON once rounded.
const SAMPLE_DT = 0.05;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

const axesOut = AXES.filter((a) => spec.axes[a]).map((axis) => {
  const curve = spec.axes[axis]!;
  const target: { t: number; v: number }[] = [];
  for (let t = 0; t <= durationS + 1e-9; t += SAMPLE_DT) {
    const v = curve(t);
    if (v !== undefined) target.push({ t: r3(t), v: r3(v) });
  }
  // Per-gap measured points (one per gap that received a catch and targets this axis).
  const measured = report.gaps
    .filter((g) => g.axes[axis] !== undefined)
    .map((g) => {
      const a = g.axes[axis]!;
      return { t: r3(g.t_end), target: r3(a.target), achieved: r3(a.achieved), error: r3(a.error) };
    });
  return { axis, ...AXIS_META[axis], target, measured };
});

// Contacts with landed status, for the tick row (lit = landed).
const contacts = report.contacts.map((c) => ({
  t: r3(c.t_target),
  landed: c.status !== "missing",
}));

// Soft energy phases (madmom onset-activation contour, beats/audio.mp3).
const phases = [
  { name: "INTRO", t0: 0.0, t1: 7.69, color: "#5b8def" },
  { name: "BUILD", t0: 7.69, t1: 15.36, color: "#3fb6a8" },
  { name: "VERSE", t0: 15.36, t1: 23.04, color: "#7bd44b" },
  { name: "PRE-CHORUS", t0: 23.04, t1: 38.42, color: "#f0b429" },
  { name: "CHORUS", t0: 38.42, t1: 53.78, color: "#f24f4f" },
  { name: "WIND-DOWN", t0: 53.78, t1: durationS, color: "#a06cf2" },
];

const score = scoreDriftReport(report, { totalFrames: track.duration });

const bundle = {
  title: "BELIEVER",
  artist: "IMAGINE DRAGONS",
  tempo: "125 BPM · 4/4",
  durationS: r3(durationS),
  fps: FPS,
  score: Math.round(score.score * 10) / 10,
  axisRms: r3(score.axis_error_rms),
  contactsHit: contacts.filter((c) => c.landed).length,
  contactsTotal: contacts.length,
  offBeat: report.off_beat_landings.length,
  reachedEnd: report.terminus.reason === "endOfSpec",
  axes: axesOut,
  contacts,
  phases,
};

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(resolve(outPath), JSON.stringify(bundle));
console.log(
  `wrote ${outPath}  ${durationS.toFixed(1)}s  score ${bundle.score}  ` +
    `${bundle.contactsHit}/${bundle.contactsTotal} hit  axes=[${axesOut.map((a) => `${a.axis}:${a.measured.length}pts`).join(", ")}]`,
);
