/**
 * Calibration sweep for the locked impact metric `redir` (peak ⊥ CoM velocity
 * redirection over a ~6-frame window). Measures redir at EVERY landing across a
 * variety of golden tracks to get its achievable envelope, then proposes an
 * absolute cap so the [0,1] scale is well-distributed and the user's felt
 * "very strong" beats sit near the top.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_calibrate.ts --budget=80000
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_calibrate.ts --budget=80000 --track=path/to/shelter.track.json
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileHandoff } from "./optimizer/handoff.ts";
import { type Spec } from "./types.ts";
import * as SS from "./study_support.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
};
if (argv.includes("--help") || argv.includes("-h")) {
  console.log("usage: LR_ENGINE=wasm npx tsx scripts/v0/study_impact_calibrate.ts [--budget=80000] [--track=path/to/labeled.track.json] [spec ...]");
  console.log("  --track / --label-track is optional and only enables the user-labeled Shelter percentile block.");
  process.exit(0);
}
const budget = Number(arg("budget") ?? "80000");
const W = 6; // locked window
const labelTrackArg = arg("label-track") ?? arg("track");
const names = argv.filter((a) => !a.startsWith("--"));
// Representative variety the gentle Shelter lacks: big air, drops, drums, climbs.
const SPECS = names.length ? names : [
  "big_air_ramp", "swoop_dive", "pop_train", "rolling_drop", "float_bounds", "skyline_push",
  "drums_signature", "drums_pulse", "syncopated_switchback", "dense_sprint", "rolling_hills",
  "climb_terrace", "leap_cadence", "valley_bounce", "soar_settle", "summit_push",
];

async function loadSpec(name: string): Promise<Spec> {
  const p = [resolve(`scripts/v0/specs/${name}.ts`), resolve(`specs/golden/${name}.ts`), resolve(`specs/${name}.ts`)].find(existsSync);
  if (!p) throw new Error(`spec ${name} not found`);
  return (await import(pathToFileURL(p).href)).default as Spec;
}

type Rec = { spec: string; t: number; redir: number; point: number };
const recs: Rec[] = [];
for (const name of SPECS) {
  const spec = await loadSpec(name);
  const { track } = compileHandoff(spec, 0, { budget });
  const sim = SS.simulateTrack(track);
  let n = 0;
  for (const e of sim.det.events) {
    if (e.type !== "landing" || e.frame < 3 || e.frame > sim.last - 2) continue;
    const pt = SS.pointImpactPx(sim, e.frame); if (pt === undefined) continue;
    recs.push({ spec: name, t: e.frame / 40, redir: SS.redirPx(sim, e.frame, W), point: pt });
    n++;
  }
  console.log(`  ${name.padEnd(22)} ${n} landings`);
}

const redir = recs.map((r) => r.redir).sort((a, b) => a - b);
const point = recs.map((r) => r.point).sort((a, b) => a - b);
const P = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
console.log(`\n=== redir envelope across ${recs.length} landings / ${SPECS.length} golden tracks (W=${W}, px/frame) ===`);
console.log(`  redir  p50 ${P(redir, .5).toFixed(2)}  p75 ${P(redir, .75).toFixed(2)}  p90 ${P(redir, .9).toFixed(2)}  p95 ${P(redir, .95).toFixed(2)}  p99 ${P(redir, .99).toFixed(2)}  max ${redir[redir.length - 1].toFixed(2)}`);
console.log(`  point  p50 ${P(point, .5).toFixed(2)}  p75 ${P(point, .75).toFixed(2)}  p90 ${P(point, .9).toFixed(2)}  p95 ${P(point, .95).toFixed(2)}  p99 ${P(point, .99).toFixed(2)}  max ${point[point.length - 1].toFixed(2)}  (current IMPACT_CAP=${SS.IMPACT_CAP})`);

const pctOf = (v: number) => 100 * redir.filter((x) => x <= v).length / redir.length;
if (labelTrackArg !== undefined) {
  const labelTrackPath = resolve(labelTrackArg);
  if (!existsSync(labelTrackPath)) throw new Error(`label track not found: ${labelTrackPath}`);
  // Position the user's labeled Shelter beats within this envelope. The track is
  // explicit because shakedown/ outputs are ignored and absent in clean checkouts.
  const shelter = SS.simulateTrack(JSON.parse(readFileSync(labelTrackPath, "utf8")));
  const LABELS: [number, string][] = [[72.33, "very strong"], [41.13, "pretty strong"], [71.13, "hard"], [51.93, "hard"], [49.53, "a bit less"], [63.93, "a bit less"], [74.13, "a bit less"], [48.33, "soft"]];
  console.log(`\n=== user-labeled Shelter beats — redir@${W} and their percentile in the golden envelope ===`);
  for (const [t, note] of LABELS) {
    const lf = SS.landingNear(shelter, Math.round(t * 40));
    const r = SS.redirPx(shelter, lf, W);
    console.log(`  t=${t.toFixed(2).padStart(6)}  ${note.padEnd(14)} redir ${r.toFixed(2).padStart(5)}  (${pctOf(r).toFixed(0)}th pct of corpus)`);
  }
} else {
  console.log(`\n=== user-labeled Shelter beats skipped (pass --track=path/to/shelter.track.json to include them) ===`);
}

console.log(`\n=== candidate caps (value mapped to 1.0) and resulting distribution ===`);
for (const cap of [P(redir, .95), P(redir, .99), Math.ceil(redir[redir.length - 1])]) {
  const sat = 100 * redir.filter((x) => x >= cap).length / redir.length;
  console.log(`  cap ${cap.toFixed(1).padStart(5)}  → median lands at ${(P(redir, .5) / cap).toFixed(2)},  ${sat.toFixed(1)}% of landings peg at ≥1.0`);
}
console.log(`\n  (a good cap puts the felt "very strong" beats near 1.0 and spreads the rest across [0,1];`);
console.log(`   p95–p99 of the corpus is the usual sweet spot — pick so ~1-5% peg.)`);
