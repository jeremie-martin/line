/**
 * Probe: compose a template with beat fitting, print before/after metrics.
 *
 *   npx tsx scripts/probe_fit.ts <template> <beats.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { composeWithBeats, materializeRoute, type Route } from "./lib/route.ts";
import {
  evaluateTrack,
  musicMetrics,
  simulateTrack,
  geometricMetrics,
  behavioralMetrics,
  coolScore,
} from "./lib/metrics.ts";

const [tpl, beatsPath] = process.argv.slice(2);
if (!tpl || !beatsPath) {
  console.error("usage: npx tsx scripts/probe_fit.ts <template-name> <beats.json>");
  process.exit(1);
}

const mod = await import(resolve(`templates/${tpl}.ts`));
const route = mod.default as Route;

const raw = JSON.parse(readFileSync(beatsPath, "utf8"));
const onsets: number[] = raw.onsets.map((o: any) => typeof o === "number" ? o : o.t);
const beatFrames = onsets.map((t) => Math.round(t * 40)).sort((a, b) => a - b);

console.log(`Template: ${tpl}`);
console.log(`Beats:    ${beatFrames.length} from ${beatsPath}`);

// Unfitted (route only)
const unfit = materializeRoute(route, { label: tpl, durationFrames: 1200 });
const unfitM = evaluateTrack(unfit);
const unfitMusic = musicMetrics(simulateTrack(unfit), beatFrames, 2);

// Fitted
const { track: fitTrack, fit } = composeWithBeats(route, beatFrames, { label: `${tpl}_fit`, durationFrames: 1200 });
const fitGeom = geometricMetrics(fitTrack);
const fitDet = simulateTrack(fitTrack);
const fitBehav = behavioralMetrics(fitDet);
const fitCool = coolScore({ ...fitGeom, ...fitBehav });
const fitMusic = musicMetrics(fitDet, beatFrames, 2);

console.log("");
console.log(`                  unfitted  →  fitted`);
console.log(`  lines:          ${unfit.lines.length.toString().padStart(4)}      →  ${fitTrack.lines.length}`);
console.log(`  bumps placed:   ${"-".padStart(4)}      →  ${fit.placedBeats.length} of ${fit.attemptedBeats.length} beats`);
console.log(`  survived:       ${unfitM.behav.survived ? "Y" : "N"}         →  ${fitBehav.survived ? "Y" : "N"} (terminus ${fitDet.terminus.reason} @ ${fitDet.terminus.frame})`);
console.log(`  contactFrac:    ${unfitM.behav.contactFractionLive.toFixed(2)}      →  ${fitBehav.contactFractionLive.toFixed(2)}`);
console.log(`  slowSlide:      ${unfitM.behav.slowSlideFraction.toFixed(2)}      →  ${fitBehav.slowSlideFraction.toFixed(2)}`);
console.log(`  meanVxSliding:  ${unfitM.behav.meanVxSliding.toFixed(2)}      →  ${fitBehav.meanVxSliding.toFixed(2)}`);
console.log(`  events:         ${unfitM.behav.eventRatePerSec.toFixed(2)}/s    →  ${fitBehav.eventRatePerSec.toFixed(2)}/s`);
console.log(`  coverage:       ${unfitMusic.eventCoveragePct.toFixed(1)}%     →  ${fitMusic.eventCoveragePct.toFixed(1)}%`);
console.log(`  onBeat:         ${unfitMusic.onBeatAdherencePct.toFixed(1)}%     →  ${fitMusic.onBeatAdherencePct.toFixed(1)}%`);
console.log(`  meanBeatOffset: ${unfitMusic.meanBeatOffsetFrames.toFixed(1)}f     →  ${fitMusic.meanBeatOffsetFrames.toFixed(1)}f`);
console.log(`  coolScore:      ${unfitM.cool.toFixed(0).padStart(4)}      →  ${fitCool.toFixed(0)}`);

// Save fitted track for inspection
const outPath = resolve(`generated/${tpl}_fit.track.json`);
writeFileSync(outPath, JSON.stringify(fitTrack, null, 2));
console.log("");
console.log(`wrote ${outPath}`);
