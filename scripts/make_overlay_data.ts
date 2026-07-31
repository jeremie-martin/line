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
import { AXES, FPS, secToFrame, type Spec, type DriftReport } from "./v0/types.ts";
import { scoreDriftReport } from "./v0/score.ts";
import * as SS from "./v0/impact_support.ts";

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
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// Per-beat MEASURED landing-impact candidates for the overlay, ALL computed through
// the canonical definitions in scripts/v0/impact_support.ts (one window, one set of
// caps, one rider topology) so the rendered video and the analysis harnesses can
// never silently diverge. See docs/impact_problem_statement.md for what each means:
//   point   pre-impact CoM normal closing speed (the shipped scorer's definition)
//   redir   perpendicular (redirection) component of the CoM velocity change — the
//           converged felt-impact candidate; rotation-immune, excludes slowdown
//   snap    peak PER-FRAME ⊥ velocity change = the redirection FORCE/suddenness — how
//           VIOLENTLY the path is bent (vs redir's how MUCH); the smooth-vs-snappy axis
//   turn    net CoM heading change; dv = total gravity-corrected |Δv| (impulse)
//   jolt/whip/deform/rot = body-motion candidates kept as REJECTED/diagnostic
//           (rotation-confounded — they flag rotation-settles the rider doesn't feel)
//   window  the rejected decayed windowed normal-speed proposal
type BeatImpact = { point: number; window: number; redir: number; snap: number; jolt: number; whip: number; comDecel: number; deform: number; rot: number; turn: number; dv: number };
function impactByFrame(): Map<number, BeatImpact> {
  const out = new Map<number, BeatImpact>();
  if (!track.lines?.length) return out;
  const sim = SS.simulateTrack(track);
  for (const e of sim.det.events) {
    if (e.type !== "landing") continue;
    const f = e.frame;
    const px = SS.pointImpactPx(sim, f);
    if (px === undefined) continue;
    const vc = SS.velChange(sim, f);
    const bj = SS.bodyJolt(sim, f);
    const df = SS.deformStats(sim, f);
    out.set(f, {
      point: SS.norm01(px, SS.IMPACT_CAP),
      window: SS.norm01(SS.windowedNormalPx(sim, f), SS.IMPACT_CAP),
      // [LEGACY LANE] the pre-2026-06-14 `redir = v·sinΔθ` candidate on its own REDIR_CAP
      // scale — NOT the scored impact (that is `contactRedirArcPxAtLanding` → `normImpact`).
      redir: SS.norm01(SS.redirPx(sim, f), SS.REDIR_CAP),
      snap: SS.norm01(SS.snapPx(sim, f), SS.CAPS.snap),   // force/suddenness candidate (under review)
      turn: SS.norm01(SS.turnNetDeg(sim, f), SS.CAPS.turnDeg),
      dv: SS.norm01(vc.dvGrav, SS.IMPACT_CAP),
      jolt: SS.norm01(bj.jolt, SS.CAPS.jolt),
      whip: SS.norm01(bj.whip, SS.CAPS.whip),
      comDecel: SS.norm01(SS.comDecelNormalPx(sim, f), SS.CAPS.comDecel),
      deform: df ? SS.norm01(df.peak, SS.CAPS.deform) : 0,
      rot: SS.norm01(SS.sledRotDeg(sim, f), SS.CAPS.rotDeg),
    });
  }
  return out;
}
const impactFrames = impactByFrame();
/** Measured impact candidates for a beat at time t (nearest landing within ±1 frame). */
function beatImpact(tSec: number): BeatImpact | undefined {
  const f = secToFrame(tSec);
  return impactFrames.get(f) ?? impactFrames.get(f - 1) ?? impactFrames.get(f + 1);
}

type ImpactScore = { target: number; achieved: number; error: number };
const impactScoresByFrame = new Map<number, ImpactScore>();
for (const g of report.gaps) {
  const impact = g.axes.impact;
  if (impact === undefined) continue;
  impactScoresByFrame.set(secToFrame(g.t_end), {
    target: r3(impact.target),
    achieved: r3(impact.achieved),
    error: r3(impact.error),
  });
}
function impactScore(tSec: number): ImpactScore | undefined {
  const f = secToFrame(tSec);
  return impactScoresByFrame.get(f) ?? impactScoresByFrame.get(f - 1) ?? impactScoresByFrame.get(f + 1);
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
  const score = impactScore(c.t_target);
  return {
    t: r3(c.t_target),
    landed: c.status !== "missing",
    impactTarget: score === undefined ? null : score.target,
    impactAchieved: score === undefined ? null : score.achieved,
    impactError: score === undefined ? null : score.error,
    // Measured landing intensity [0,1], three candidate definitions; null if the
    // beat didn't land. Report-only read-outs — see docs/impact_problem_statement.md.
    //   impact       = current one-frame point metric (the solid bar)
    //   impactWindow = proposed decayed-peak windowed metric (ghost outline)
    //   impactRedir  = true CoM velocity redirection (tick)
    impact: imp === undefined ? null : r3(imp.point),
    impactWindow: imp === undefined ? null : r3(imp.window),
    impactRedir: imp === undefined ? null : r3(imp.redir),
    impactSnap: imp === undefined ? null : r3(imp.snap),
    impactJolt: imp === undefined ? null : r3(imp.jolt),
    impactWhip: imp === undefined ? null : r3(imp.whip),
    impactComDecel: imp === undefined ? null : r3(imp.comDecel),
    impactDeform: imp === undefined ? null : r3(imp.deform),
    impactRot: imp === undefined ? null : r3(imp.rot),
    impactTurn: imp === undefined ? null : r3(imp.turn),
    impactDv: imp === undefined ? null : r3(imp.dv),
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
