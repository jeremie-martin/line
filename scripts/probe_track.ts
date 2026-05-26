/**
 * Quick metric probe: takes a list of track files and prints one-line
 * geometry/behavior diagnostics for each.
 *
 *   npx tsx scripts/probe_track.ts path/to/a.track.json path/to/b.track.json
 */
import { readFileSync } from "node:fs";
import { evaluateTrack } from "./lib/metrics.ts";
import { type TrackJson } from "./lib/primitive.ts";

for (const path of process.argv.slice(2)) {
  const track = JSON.parse(readFileSync(path, "utf8")) as TrackJson;
  const m = evaluateTrack(track);
  console.log(
    `${path}  lines=${track.lines.length} survived=${m.behav.survived ? "Y" : "N"} ` +
      `angleStd=${m.geom.angleStdDeg.toFixed(1)}° entropy=${m.geom.angleEntropyBits.toFixed(2)} ` +
      `vert=${m.geom.verticalExtentPx.toFixed(0)}px evtRate=${m.behav.eventRatePerSec.toFixed(2)}/s ` +
      `vyFlips=${m.behav.vySignFlips} traj=${m.behav.trajectoryVerticalPx.toFixed(0)}px`,
  );
}
