/**
 * Aerial route: kickers and drops dominate, so the rider spends a lot of
 * time airborne. Landings produce strong discrete events.
 *
 *   npm run compose -- --beats=beats/X.json --template=aerial
 */
import type { Route } from "../scripts/lib/route.ts";

const route: Route = [
  { kind: "descend", degSlope: 18, durationFrames: 60 },
  { kind: "kicker", height: 80, baseLength: 100 },
  { kind: "cruise", degSlope: 4, durationFrames: 40 },
  { kind: "drop", height: 120 },
  { kind: "kicker", height: 100, baseLength: 120 },
  { kind: "descend", degSlope: 14, durationFrames: 60 },
  { kind: "drop", height: 90 },
  { kind: "kicker", height: 80, baseLength: 100 },
  { kind: "halfpipe", depth: 80, halfWidth: 100 },
  { kind: "drop", height: 70 },
  { kind: "descend", degSlope: 10, durationFrames: 80 },
];

export default route;
