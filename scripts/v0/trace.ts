/**
 * Stage-0 trace tool — emit a structured per-frame trace + rotation/spin
 * features for an already-compiled track. The compiler's OBSERVATION layer as a
 * standalone CLI: it reads what was produced, never re-decides anything.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/trace.ts --track=generated/foo.track.json
 *   (compile first: run.ts --out=generated/foo  →  generated/foo.track.json)
 *
 * Writes <stem>.trace.json next to the input (override with --out=) and prints
 * a short human summary. For an end-to-end emit during a single compile, set
 * LR_EMIT_TRACE=1 on run.ts instead.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { TrackJson } from "../lib/primitive.ts";
import { extractTrace } from "./core/trace.ts";
import { FPS } from "./types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const trackPath = arg("track") ?? "track.json";
const outPath = arg("out") ??
  (trackPath.endsWith(".track.json")
    ? `${trackPath.slice(0, -".track.json".length)}.trace.json`
    : `${trackPath.replace(/\.json$/, "")}.trace.json`);

const track = JSON.parse(readFileSync(trackPath, "utf8")) as TrackJson;
const trace = extractTrace(track);
writeFileSync(outPath, JSON.stringify(trace, null, 2));

const ft = trace.features;
const F = trace.durationFrames;
console.log(`\n=== trace: ${trackPath}  (${(F / FPS).toFixed(1)}s, ${F}f) ===`);
console.log(
  `  body rotation: net ${ft.netRotationDeg.toFixed(0)}°  travel ${ft.totalBodyRotationDeg.toFixed(0)}° ` +
    `(${ft.revolutions.toFixed(2)} rev)  FLIPS ${ft.flipCount}  peak ${ft.peakAngularSpeedDegPerFrame.toFixed(1)}°/f`,
);
console.log(
  `  airborne arcs ${ft.airborneArcs}  airtime ${ft.totalAirtimeFrames}f (${(ft.totalAirtimeFrames / FPS).toFixed(1)}s)  ` +
    `peak height ${(-ft.peakHeightPx).toFixed(0)}px  max speed ${ft.maxSpeed.toFixed(1)}px/f`,
);
console.log(`  → ${outPath}\n`);
