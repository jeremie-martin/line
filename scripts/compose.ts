/**
 * Compose CLI — phase 1 of compose-then-place: materialize a route
 * template into a TrackJson, simulate it, score it.
 *
 *   npm run compose -- --template=swooping
 *   npm run compose -- --template=swooping --beats=beats/drums_0_30s_60_125.json
 *   npm run compose -- --template=staccato --out=generated/my.track.json
 *
 * If --beats is given, music-specific metrics (coverage, on-beat) are
 * reported alongside cool score. (At this stage the route is NOT beat-
 * aligned — coverage and adherence are diagnostic only.)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { materializeRoute, type Route } from "./lib/route.ts";
import {
  geometricMetrics,
  behavioralMetrics,
  simulateTrack,
  coolScore,
  musicMetrics,
} from "./lib/metrics.ts";

const argv = process.argv.slice(2);
const arg = (n: string) => {
  const m = argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : null;
};

const templateName = arg("template");
if (!templateName) {
  console.error("usage: npm run compose -- --template=<name> [--beats=PATH] [--out=PATH] [--duration=FRAMES]");
  console.error("templates: swooping, staccato, aerial (in templates/<name>.ts)");
  process.exit(1);
}

const templatePath = resolve(`templates/${templateName}.ts`);
if (!existsSync(templatePath)) {
  console.error(`template not found: ${templatePath}`);
  process.exit(1);
}

const mod = await import(templatePath);
const route = mod.default as Route;
if (!Array.isArray(route)) {
  console.error(`template ${templateName} must default-export a Route (RouteStage[])`);
  process.exit(1);
}

const duration = arg("duration") !== null ? parseInt(arg("duration")!, 10) : 1200;
const track = materializeRoute(route, { label: templateName, durationFrames: duration });

console.error(`composed: ${route.length} stages → ${track.lines.length} lines, duration=${duration}`);

const det = simulateTrack(track);
const geom = geometricMetrics(track);
const behav = behavioralMetrics(det);
const cool = coolScore({ ...geom, ...behav });

console.log("");
console.log(`Compose result for template=${templateName}`);
console.log(`  survived:        ${behav.survived ? "YES" : "NO"} (terminus: ${det.terminus.reason} @ frame ${det.terminus.frame})`);
console.log(`  coolScore:       ${cool.toFixed(0)}`);
console.log(`  angleStdDeg:     ${geom.angleStdDeg.toFixed(1)}°`);
console.log(`  angleEntropy:    ${geom.angleEntropyBits.toFixed(2)} bits`);
console.log(`  verticalExtent:  ${geom.verticalExtentPx.toFixed(0)} px (track) / ${behav.trajectoryVerticalPx.toFixed(0)} px (rider)`);
console.log(`  vySignFlips:     ${behav.vySignFlips}`);
console.log(`  eventRate:       ${behav.eventRatePerSec.toFixed(2)}/s (${det.events.length} events)`);

// Music metrics if beats provided.
const beatsPath = arg("beats");
if (beatsPath) {
  if (!existsSync(beatsPath)) {
    console.error(`beats file not found: ${beatsPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(beatsPath, "utf8")) as {
    onsets: Array<number | { t: number }>;
  };
  const onsets = raw.onsets.map((o) => (typeof o === "number" ? o : o.t));
  const beatFrames = onsets.map((t) => Math.round(t * 40)).sort((a, b) => a - b);
  const mm = musicMetrics(det, beatFrames, 2);
  console.log("");
  console.log(`Music metrics (vs ${beatsPath})`);
  console.log(`  beatCount:       ${mm.beatCount}`);
  console.log(`  eventCoverage:   ${mm.eventCoveragePct.toFixed(1)}%`);
  console.log(`  onBeatAdherence: ${mm.onBeatAdherencePct.toFixed(1)}% (±2 frames)`);
  console.log(`  meanBeatOffset:  ${mm.meanBeatOffsetFrames.toFixed(2)} frames`);
}

// Output track JSON.
const beatsId = beatsPath ? basename(beatsPath, ".json") : "noBeats";
const outPath = arg("out") ?? resolve(`generated/${beatsId}.${templateName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(track, null, 2));
console.log("");
console.log(`track:       ${outPath}`);
console.log(`next:        npm run inspect -- --track=${outPath}`);
