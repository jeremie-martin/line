/**
 * Staccato route: lots of stairs and small drops. High discrete-event
 * density — many landings per second, good for high-tempo drum tracks.
 *
 *   npm run compose -- --beats=beats/X.json --template=staccato
 */
import type { Route } from "../scripts/lib/route.ts";

// Staircases create discrete landings — good for high-tempo drums — but
// sharp riser angles eject the rider at speed. Stages here use wide steps
// and small risers so each landing is gentle.
const route: Route = [
  { kind: "descend", degSlope: 7, durationFrames: 60 },
  { kind: "stair", steps: 5, stepLength: 140, stepHeight: 12 },
  { kind: "cruise", degSlope: 2, durationFrames: 40 },
  { kind: "drop", height: 25 },
  { kind: "stair", steps: 6, stepLength: 120, stepHeight: 10 },
  { kind: "halfpipe", depth: 30, halfWidth: 200 },
  { kind: "stair", steps: 8, stepLength: 110, stepHeight: 9 },
  { kind: "drop", height: 20 },
  { kind: "stair", steps: 5, stepLength: 130, stepHeight: 11 },
  { kind: "descend", degSlope: 6, durationFrames: 60 },
];

export default route;
