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
import { AXES, FPS, CALIB, secToFrame, type Spec, type DriftReport } from "./v0/types.ts";
import { scoreDriftReport } from "./v0/score.ts";
import { LineRiderEngine, createLineFromJson } from "./lib/_lr_engine.ts";
import { extractRawTrajectory, detect } from "./lib/detector.ts";
import { normalImpactPxAtLanding } from "./v0/core/substrate.ts";

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

const specMod = await import(resolve(specPath));
const spec: Spec = specMod.default;
const report: DriftReport = JSON.parse(readFileSync(resolve(reportPath), "utf8"));
const track = JSON.parse(readFileSync(resolve(trackPath), "utf8")) as {
  duration: number;
  lines?: { id: number; x1: number; y1: number; x2: number; y2: number }[];
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
};

const durationS = track.duration / FPS;

// Per-beat MEASURED landing impact (normal impact speed ⊥ catch line / IMPACT_CAP,
// [0,1]) for the overlay's beat-impact row. Re-simulate the track and measure at
// every landing — UNGATED (the scored `measureImpact` only runs where a beat
// authored impact; here we want the achieved value on every beat as a read-out).
// Same math as core/measure.ts measureImpact: pre-impact velocity ⊥ the fired
// catch line's tangent.
function impactByFrame(): Map<number, number> {
  const out = new Map<number, number>();
  if (!track.lines?.length) return out;
  let eng: any = new LineRiderEngine().setStart(
    { x: track.startPosition?.x ?? 0, y: track.startPosition?.y ?? 0 },
    { x: track.riders?.[0]?.startVelocity?.x ?? 0.4, y: track.riders?.[0]?.startVelocity?.y ?? 0 },
  );
  const lineById = new Map<number, { x1: number; y1: number; x2: number; y2: number }>();
  for (const ln of track.lines) { eng = eng.addLine(createLineFromJson(ln)); lineById.set(ln.id, ln); }
  const det = detect(extractRawTrajectory(eng, track.duration));
  for (const e of det.events) {
    if (e.type !== "landing") continue;
    const px = normalImpactPxAtLanding(det, e.frame, (id) => lineById.get(id));
    if (px !== undefined) out.set(e.frame, Math.min(1, px / CALIB.IMPACT_CAP));
  }
  return out;
}
const impactFrames = impactByFrame();
/** Measured impact [0,1] for a beat at time t (nearest landing within ±1 frame). */
function beatImpact(tSec: number): number | undefined {
  const f = secToFrame(tSec);
  return impactFrames.get(f) ?? impactFrames.get(f - 1) ?? impactFrames.get(f + 1);
}

// Per-song overlay metadata (title/artist/tempo + soft energy phases). Specs may
// `export const overlayMeta = {...}`; otherwise fall back to a neutral default.
type OverlayMeta = {
  title?: string; artist?: string; tempo?: string;
  phases?: { name: string; t0: number; t1: number; color: string }[];
};
const meta: OverlayMeta = specMod.overlayMeta ?? {};

// Per-axis color identity. Only axes the spec actually targets get plotted
// (the AXES.filter below), so e.g. a spec with no grain never shows a grain chart.
const AXIS_META: Record<string, { label: string; color: string }> = {
  air: { label: "AIR", color: "#38d6c8" },
  speed: { label: "SPEED", color: "#f0b429" },
  grain: { label: "GRAIN", color: "#b07cf2" },
  elevation: { label: "ELEV", color: "#7bd44b" },
  amplitude: { label: "AMP", color: "#f06bd0" },
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
const contacts = report.contacts.map((c) => {
  const imp = beatImpact(c.t_target);
  return {
    t: r3(c.t_target),
    landed: c.status !== "missing",
    // Measured landing intensity [0,1] (normal impact speed / IMPACT_CAP); null if
    // the beat didn't land. Report-only read-out — see core/measure.ts measureImpact.
    impact: imp === undefined ? null : r3(imp),
  };
});

// Soft energy phases (madmom onset-activation contour). Per-spec via overlayMeta;
// fall back to a single span covering the whole track.
const phases = meta.phases ?? [{ name: "TRACK", t0: 0, t1: durationS, color: "#5b8def" }];

const score = scoreDriftReport(report, { totalFrames: track.duration });

const bundle = {
  title: meta.title ?? "TRACK",
  artist: meta.artist ?? "",
  tempo: meta.tempo ?? "",
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
