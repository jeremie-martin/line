/**
 * Swooping route: gentle descents alternating with halfpipes and small drops.
 * Designed for sustained motion + multiple direction changes (vy flips).
 *
 *   npm run compose -- --beats=beats/X.json --template=swooping
 */
import type { Route } from "../scripts/lib/route.ts";

// Tuned for survivability at the rider's natural speeds (vx ≈ 4-15 px/f).
// Aggressive features eject; these are gentle by design. Verticality
// comes from many shallow undulations rather than a few deep ones.
const route: Route = [
  { kind: "descend", degSlope: 7, durationFrames: 80 },
  { kind: "halfpipe", depth: 40, halfWidth: 200 },
  { kind: "cruise", degSlope: 2, durationFrames: 50 },
  { kind: "descend", degSlope: 9, durationFrames: 70 },
  { kind: "halfpipe", depth: 50, halfWidth: 220 },
  { kind: "climb", degSlope: 3, durationFrames: 50 },
  { kind: "drop", height: 35 },
  { kind: "descend", degSlope: 7, durationFrames: 80 },
  { kind: "halfpipe", depth: 45, halfWidth: 200 },
  { kind: "cruise", degSlope: 2, durationFrames: 60 },
  { kind: "drop", height: 25 },
  { kind: "descend", degSlope: 6, durationFrames: 100 },
];

export default route;
