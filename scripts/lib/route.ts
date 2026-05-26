/**
 * Route language: compose-then-place phase 1.
 *
 * A `Route` is a sequence of `RouteStage`s — high-level geometric shapes
 * (descend, kicker, halfpipe, cruise, drop, stair…). `materializeRoute`
 * chains stages end-to-end into explicit line geometry — explicit angles,
 * not auto-tangent-matched-to-incoming-velocity. This is where verticality
 * gets locked in.
 *
 * The contrast with `Move` (in scripts/lib/moves.ts): a `Move` is placed
 * relative to rider physics by an adapter that historically tangent-matched
 * everything into one curve. A `Route` is placed deterministically in
 * world-space, with each stage's angles chosen by the route author, not
 * the adapter. The rider has to deal with whatever geometry is there.
 *
 * Beat fitting is deliberately out of scope here; routes produce explicit
 * geometry that can be simulated and inspected.
 */
import { type TrackJson, type TrackLine } from "./primitive.ts";
import { simulateTrack } from "./metrics.ts";

// ────────── Route stages ──────────

export type RouteStage =
  /** Gentle downhill slope. degSlope is downward (positive = descending). */
  | { kind: "descend"; degSlope: number; durationFrames: number }
  /** Up-ramp that launches rider into air. height = how high above current y. */
  | { kind: "kicker"; height: number; baseLength: number }
  /** Deep V-shape dip. */
  | { kind: "halfpipe"; depth: number; halfWidth: number }
  /** Flat-ish stretch. degSlope can be tiny (cruise) or 0. */
  | { kind: "cruise"; degSlope: number; durationFrames: number }
  /** Sudden ledge — small horizontal segment, then a step down. */
  | { kind: "drop"; height: number }
  /** N stepped descents, each step is `stepLength` wide and drops `stepHeight`. */
  | { kind: "stair"; steps: number; stepLength: number; stepHeight: number }
  /** Upward climb. degSlope is upward (positive = climbing). */
  | { kind: "climb"; degSlope: number; durationFrames: number };

export type Route = RouteStage[];

// ────────── Materialization ──────────

/**
 * Cursor through world-space as stages append their geometry. (x, y) is
 * the current endpoint; subsequent stages start from here.
 */
type Cursor = { x: number; y: number };

/** Speed (px per frame) approximation used to convert frame-duration to x-extent. */
const APPROX_SPEED_PX_PER_FRAME = 8;

function mkLine(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

function appendStage(stage: RouteStage, cursor: Cursor, nextId: () => number): TrackLine[] {
  const lines: TrackLine[] = [];

  switch (stage.kind) {
    case "descend":
    case "cruise":
    case "climb": {
      // Single sloped segment. Climb has negative dy (going up = smaller y).
      const sign = stage.kind === "climb" ? -1 : 1;
      const dxApprox = stage.durationFrames * APPROX_SPEED_PX_PER_FRAME;
      const slopeRad = (stage.degSlope * Math.PI) / 180;
      const dx = dxApprox;
      const dy = sign * dx * Math.tan(slopeRad);
      // Smooth long segments by splitting into chunks so the rider doesn't take
      // one giant straight line (and so vy can flip across natural sub-slopes).
      const CHUNK = 80;
      const nChunks = Math.max(1, Math.ceil(dx / CHUNK));
      for (let i = 0; i < nChunks; i++) {
        const x1 = cursor.x + (dx * i) / nChunks;
        const y1 = cursor.y + (dy * i) / nChunks;
        const x2 = cursor.x + (dx * (i + 1)) / nChunks;
        const y2 = cursor.y + (dy * (i + 1)) / nChunks;
        lines.push(mkLine(nextId(), x1, y1, x2, y2));
      }
      cursor.x += dx;
      cursor.y += dy;
      return lines;
    }

    case "kicker": {
      // Smoothly-curving ramp up (sine taper) into a launch angle, then a
      // crest. Sub-divided into many short segments so per-segment angle
      // change stays small enough to not eject the rider at speed.
      const N = 12;
      const totalLen = stage.baseLength;
      for (let i = 0; i < N; i++) {
        const t0 = i / N;
        const t1 = (i + 1) / N;
        // y(t) descends as a half-sine from 0 to -height across t∈[0,1]
        const y0 = -stage.height * 0.5 * (1 - Math.cos(Math.PI * t0));
        const y1 = -stage.height * 0.5 * (1 - Math.cos(Math.PI * t1));
        lines.push(mkLine(nextId(),
          cursor.x + totalLen * t0, cursor.y + y0,
          cursor.x + totalLen * t1, cursor.y + y1,
        ));
      }
      cursor.x += totalLen;
      cursor.y += -stage.height;
      return lines;
    }

    case "halfpipe": {
      // Smooth U-shape via cosine. Many segments → small per-segment angle
      // change → rider survives. Total x-extent = 2*halfWidth + FLAT; depth =
      // stage.depth at the bottom.
      const FLAT = 40;
      const totalDown = stage.halfWidth;
      const totalUp = stage.halfWidth;
      const N = 16; // segments per side
      // Down side: y(t) = depth * 0.5 * (1 - cos(π t)), for t in [0,1]
      for (let i = 0; i < N; i++) {
        const t0 = i / N;
        const t1 = (i + 1) / N;
        const y0 = cursor.y + stage.depth * 0.5 * (1 - Math.cos(Math.PI * t0));
        const y1 = cursor.y + stage.depth * 0.5 * (1 - Math.cos(Math.PI * t1));
        lines.push(mkLine(nextId(),
          cursor.x + totalDown * t0, y0,
          cursor.x + totalDown * t1, y1,
        ));
      }
      const dipY = cursor.y + stage.depth;
      // Flat bottom:
      lines.push(mkLine(nextId(), cursor.x + totalDown, dipY, cursor.x + totalDown + FLAT, dipY));
      // Up side: mirror of the down side
      const upX0 = cursor.x + totalDown + FLAT;
      for (let i = 0; i < N; i++) {
        const t0 = i / N;
        const t1 = (i + 1) / N;
        const y0 = dipY - stage.depth * 0.5 * (1 - Math.cos(Math.PI * t0));
        const y1 = dipY - stage.depth * 0.5 * (1 - Math.cos(Math.PI * t1));
        lines.push(mkLine(nextId(),
          upX0 + totalUp * t0, y0,
          upX0 + totalUp * t1, y1,
        ));
      }
      cursor.x += totalDown + FLAT + totalUp;
      // cursor.y unchanged (returned to original level)
      return lines;
    }

    case "drop": {
      // Brief flat then a sloped step down (not vertical — that would eject)
      // then continue flat. Produces an airborne phase + landing event.
      const PRE = 40;
      const POST = 60;
      lines.push(mkLine(nextId(), cursor.x, cursor.y, cursor.x + PRE, cursor.y));
      // Step is a moderately-steep ramp (~45°), not vertical, with chamfers.
      const stepRunX = stage.height * 0.7;
      const stepEndX = cursor.x + PRE + stepRunX;
      const stepEndY = cursor.y + stage.height;
      // Chamfer top: brief shallow segment before the steep drop
      const CHAMF = 8;
      lines.push(mkLine(nextId(), cursor.x + PRE, cursor.y, cursor.x + PRE + CHAMF, cursor.y + CHAMF * 0.3));
      lines.push(mkLine(nextId(),
        cursor.x + PRE + CHAMF, cursor.y + CHAMF * 0.3,
        stepEndX - CHAMF, stepEndY - CHAMF * 0.3,
      ));
      lines.push(mkLine(nextId(),
        stepEndX - CHAMF, stepEndY - CHAMF * 0.3,
        stepEndX, stepEndY,
      ));
      lines.push(mkLine(nextId(), stepEndX, stepEndY, stepEndX + POST, stepEndY));
      cursor.x = stepEndX + POST;
      cursor.y = stepEndY;
      return lines;
    }

    case "stair": {
      // N steps, each a flat top then a tiny down-slope to the next.
      for (let i = 0; i < stage.steps; i++) {
        lines.push(mkLine(nextId(),
          cursor.x, cursor.y,
          cursor.x + stage.stepLength * 0.7, cursor.y,
        ));
        lines.push(mkLine(nextId(),
          cursor.x + stage.stepLength * 0.7, cursor.y,
          cursor.x + stage.stepLength, cursor.y + stage.stepHeight,
        ));
        cursor.x += stage.stepLength;
        cursor.y += stage.stepHeight;
      }
      return lines;
    }
  }
}

/**
 * Materialize a route into an explicit TrackJson. Includes the standard
 * track wrapper (rider start, layer, duration).
 *
 * The first stage starts at (-50, 10) so the rider (start position (0, 0))
 * falls onto it after a few frames.
 *
 * `durationFrames` defaults to 1200 (30 s at 40 fps). Long routes may
 * need more.
 */
export function materializeRoute(route: Route, opts: { label?: string; durationFrames?: number } = {}): TrackJson {
  const cursor: Cursor = { x: -50, y: 10 };
  let id = 0;
  const nextId = () => ++id;
  const lines: TrackLine[] = [];
  for (const stage of route) {
    lines.push(...appendStage(stage, cursor, nextId));
  }
  const durationFrames = opts.durationFrames ?? 1200;
  const label = opts.label ?? "route";
  return {
    label,
    creator: "line/route.ts",
    description: "Materialized from a Route",
    duration: durationFrames,
    version: "6.2",
    audio: null,
    startPosition: { x: 0, y: 0 },
    riders: [
      { startPosition: { x: 0, y: 0 }, startVelocity: { x: 0.4, y: 0 }, remountable: 1 },
    ],
    layers: [
      { id: 0, type: 0, name: "Base Layer", visible: true, editable: true, folderId: -1 },
    ],
    script: "",
    lines,
  };
}

// ────────── Beat fitting ──────────
//
// Compose-then-place, phase 2. Given a materialized route + beat frames,
// produce a track where each beat fires a detector event near its frame.
//
// Approach (one-shot, non-iterative for first commit):
//   1. Simulate the route alone to get rider position + velocity per frame.
//   2. For each beat frame F:
//      - Look up rider position at frame F − LEAD_FRAMES. (Events fire ~6-20
//        frames after the stub is hit; LEAD_FRAMES=8 is the median we
//        measured on the swooping template.)
//      - Place a short horizontal stub 2 px BELOW rider center, parallel to
//        the rider's velocity vector at that frame. The sled's lower points
//        graze the stub for 1-2 frames → bounce or landing event, depending
//        on the surrounding contact pattern.
//   3. Concatenate route lines + stubs.
//
// We tried several other geometries (see scripts/probe_single_stub.ts):
//   - Bumps rotated 25° from velocity below rider → ejected the rider.
//   - Bumps rotated 8° from velocity → too gentle, no event.
//   - Ceiling stubs above the rider at various offsets → ejected the rider.
//   - Vertical "speed bump" lines ahead of the rider → no event.
// Only horizontal-parallel-just-below configuration produced events
// without ejecting. The 6-20 frame lag is the cost of this approach —
// future iteration could measure lag per beat and re-place, or use a
// completely different mechanism.
//
// Skipped: beats where the rider is airborne, before firstBeatFrame, or
// too close to another stub (prevents stacking).

export type FitOpts = {
  /** Half-length of each stub line in px. Default 4. */
  bumpHalfLengthPx?: number;
  /** Distance to place stubs BELOW the rider's center (positive = down).
   *  Default 2 — close enough for sled-bottom points (PEG / TAIL) to graze
   *  briefly without ejecting. */
  bumpOffsetDownPx?: number;
  /** Beats < this distance to another already-placed stub are skipped (px). */
  minBumpSpacingPx?: number;
  /** Skip beats earlier than this frame. Default 60 — gives the rider time
   *  to settle on the route before stub placement starts. */
  firstBeatFrame?: number;
  /** Place stub at rider position at frame F − leadFrames so the event fires
   *  approximately AT frame F. Default 8 (median measured event-fire lag
   *  on the swooping template; individual events fire 6-20 frames later). */
  leadFrames?: number;
};

export type FitResult = {
  /** All track lines (route + bumps). */
  lines: TrackLine[];
  /** Bump lines only (subset of lines). */
  bumps: TrackLine[];
  /** Beat frames the fitter attempted. */
  attemptedBeats: number[];
  /** Beat frames that produced a bump (others were skipped — airborne, out of range, too close). */
  placedBeats: number[];
};

export function fitBeatsToRoute(
  routeTrack: TrackJson,
  beatFrames: number[],
  opts: FitOpts = {},
): FitResult {
  // halfLen=3 default is conservative: it keeps the route bumps small enough
  // to avoid ejecting the rider on the current templates.
  const halfLen = opts.bumpHalfLengthPx ?? 3;
  const offsetDown = opts.bumpOffsetDownPx ?? 2;
  const minSpacing = opts.minBumpSpacingPx ?? 12;
  const firstBeat = opts.firstBeatFrame ?? 60;
  const leadFrames = opts.leadFrames ?? 8;

  const det = simulateTrack(routeTrack);
  const positions = det.measurements.position;
  const airborne = det.measurements.airborne;

  const routeLines = routeTrack.lines.slice();
  const bumps: TrackLine[] = [];
  const placedBeats: number[] = [];
  const lastBumpPos: { x: number; y: number } | null = null;
  let lastX = -Infinity;

  let nextId = 1;
  for (const l of routeLines) if (l.id >= nextId) nextId = l.id + 1;

  for (const f of beatFrames) {
    // Lead: place stub at rider's earlier position so event fires near F.
    const placeF = f - leadFrames;
    if (placeF < firstBeat || placeF >= positions.length || placeF > det.terminus.frame) continue;
    if (airborne[placeF]) continue;

    const pos = positions[placeF];
    const prev = positions[placeF - 1];
    // Velocity direction (unit vector).
    let dx = pos.x - prev.x;
    let dy = pos.y - prev.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.1) continue; // rider not moving
    dx /= mag; dy /= mag;

    // Stub is parallel to velocity, placed just below the rider's center.
    // In y-down coords, "below" = larger y = add offsetDown.
    const cx = pos.x;
    const cy = pos.y + offsetDown;

    const x1 = cx - dx * halfLen;
    const y1 = cy - dy * halfLen;
    const x2 = cx + dx * halfLen;
    const y2 = cy + dy * halfLen;

    // Skip if too close to the last bump (prevents stacking).
    if (Math.abs(cx - lastX) < minSpacing) continue;
    lastX = cx;

    bumps.push({
      id: nextId++,
      type: 0,
      x1, y1, x2, y2,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    });
    placedBeats.push(f);
  }

  return {
    lines: [...routeLines, ...bumps],
    bumps,
    attemptedBeats: beatFrames,
    placedBeats,
  };
}

/**
 * Helper: materialize a route + fit beats in one call, return a TrackJson.
 */
export function composeWithBeats(
  route: Route,
  beatFrames: number[],
  opts: FitOpts & { label?: string; durationFrames?: number } = {},
): { track: TrackJson; fit: FitResult } {
  const routeTrack = materializeRoute(route, { label: opts.label, durationFrames: opts.durationFrames });
  const fit = fitBeatsToRoute(routeTrack, beatFrames, opts);
  return {
    track: { ...routeTrack, lines: fit.lines },
    fit,
  };
}
