/**
 * probe_impact — a hard-landing staircase for calibrating the `impact` lever
 * (CALIB.IMPACT_CAP / impactCeiling) and validating the measurement.
 *
 * Sparse ~1.0s gaps (so the rider can build tall arcs and steep, fast descents —
 * the conditions for genuinely HARD landings), with speed and amplitude ramped up
 * across the track to sweep the achieved landing-hardness ENVELOPE from soft to
 * hard. Each beat also carries an authored `impact` target ramped 0.2→0.9 via
 * `withImpact` — co-authoring timing and per-beat impact in one file, no external
 * JSON. In v1 impact is report-only and unsteered, so achieved won't track the
 * authored target; the point is to read the achieved range (target/achieved/
 * ceiling per gap) to set IMPACT_CAP, exactly like the probe_amplitude workflow.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/run.ts --spec=scripts/v0/specs/probe_impact.ts
 */
import type { Spec } from "../types.ts";
import { constant, keyframes } from "../core/curves.ts";
import { beats, withImpact } from "../core/beats.ts";

// ~1.0s beat grid from 1.0s to 18s.
const grid: { t: number }[] = [];
for (let t = 1.0; t < 18; t += 1.0) grid.push({ t: Number(t.toFixed(3)) });

// Co-author the per-beat impact target as a ramp 0.2 → 0.9 over the track.
const impactRamp = keyframes([{ t: 0, v: 0.2 }, { t: 9, v: 0.55 }, { t: 18, v: 0.9 }], "smooth");
const contacts = withImpact(beats(grid), (t) => impactRamp(t));

const spec: Spec = {
  duration: 19,
  contacts,
  jitter: 0,
  axes: {
    // Ramp speed and amplitude up so the produced landings sweep soft → hard.
    speed: keyframes([{ t: 0, v: 0.4 }, { t: 18, v: 0.85 }], "smooth"),
    amplitude: keyframes([{ t: 0, v: 0.3 }, { t: 18, v: 0.8 }], "smooth"),
    air: constant(0.6),
  },
};

export default spec;
