/**
 * Single source of truth for the GEOMETRIC ARC-EXIT detector: "has the rider
 * left the placed arc?" — the rider is past the arc-end plane (the chord
 * start→end direction, falling back to the last segment's direction) in the
 * arc's travel direction.
 *
 * This module is intentionally DEPENDENCY-FREE (no imports) so that both call
 * sites can share it without an import cycle: optimizer/arc_probe.ts imports
 * `axisCost` from core/candidate.ts, so candidate.ts cannot import from
 * arc_probe.ts (same constraint the launch-read dedup hit — see
 * core/launch_read.ts). The two call sites differ only in where the per-frame
 * rider position comes from (the metered ENGINE in arc_probe.ts vs the
 * DETECTION arrays in candidate.ts) and in the airborne predicate's source;
 * the float-op sequence of the plane math is identical and lives here.
 *
 * Jérémie's hard requirement: ONE definition of "the rider has exited the arc".
 */

export type Vec2 = { x: number; y: number };

/** Minimal arc-end-plane line shape: only the endpoints the detector reads. */
export type ExitLine = { x1: number; y1: number; x2: number; y2: number };

export type ArcExitPlane = {
  end: Vec2;
  dir: Vec2;
};

function normalizeVec(x: number, y: number): Vec2 | null {
  const length = Math.hypot(x, y);
  return length <= 1e-9 ? null : { x: x / length, y: y / length };
}

/**
 * The arc-end plane: anchored at the last line's end point, oriented along the
 * chord from the first line's start to the last line's end. Falls back to the
 * last segment's own direction when the chord degenerates, and to null when
 * even that degenerates (or no lines). Float ops match the former private
 * `arcExitPlane` in arc_probe.ts exactly.
 */
export function arcExitPlane(lines: readonly ExitLine[]): ArcExitPlane | null {
  if (lines.length === 0) return null;
  const first = lines[0];
  const last = lines[lines.length - 1];
  const start = { x: first.x1, y: first.y1 };
  const end = { x: last.x2, y: last.y2 };
  const chord = normalizeVec(end.x - start.x, end.y - start.y);
  if (chord !== null) return { end, dir: chord };
  const tail = normalizeVec(last.x2 - last.x1, last.y2 - last.y1);
  return tail === null ? null : { end, dir: tail };
}

/**
 * True iff `pos` is past the arc-end plane in the arc's travel direction.
 * A null plane (degenerate arc) is treated as "past" (the former
 * `riderPastArcExit` returned true on a null exit). An unreadable position
 * is "not past". Float ops match the former private `riderPastArcExit`.
 */
export function positionPastArcExit(pos: Vec2 | null | undefined, exit: ArcExitPlane | null): boolean {
  if (exit === null) return true;
  if (pos === undefined || pos === null || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  const along = (pos.x - exit.end.x) * exit.dir.x + (pos.y - exit.end.y) * exit.dir.y;
  return along > 0;
}

/**
 * First frame in [startFrame, endFrame] (inclusive, ascending) at which the
 * rider is BOTH airborne AND past the arc-end plane in the travel direction;
 * null when no such frame exists in the window.
 *
 * Parametrized over the two per-frame sources so the engine and detection call
 * sites share the exact iteration order and short-circuit (`airborne === true`
 * checked first, then the plane test). `airborneAtFrame` should return the
 * tri-state airborne read (true / false / undefined); only `true` qualifies.
 */
export function firstAirborneExitFrame(
  lines: readonly ExitLine[],
  startFrame: number,
  endFrame: number,
  airborneAtFrame: (frame: number) => boolean | undefined,
  positionAtFrame: (frame: number) => Vec2 | null | undefined,
): number | null {
  const exit = arcExitPlane(lines);
  for (let frame = startFrame; frame <= endFrame; frame++) {
    if (airborneAtFrame(frame) === true && positionPastArcExit(positionAtFrame(frame), exit)) return frame;
  }
  return null;
}

/**
 * Single source of truth for the SHORT-HORIZON detection window growth loop
 * (the minimal-simulation principle: the engine simulates only inside arcs;
 * after a clean airborne arc exit everything is ballistic). Grows the detection
 * window in 4-frame chunks from `minExit` up to `cap`, stopping as soon as
 * either the rider terminated before the chunk horizon (a ride-out / death the
 * caller must see in full) or a clean airborne arc-exit was found in the chunk.
 *
 * Parametrized over a single `probe(horizon)` callback so both call sites
 * (optimizer/arc_probe.ts on the metered ENGINE, core/candidate.ts on the
 * DETECTION arrays) share the exact chunk schedule and stop condition; the
 * caller's `probe` re-detects to `horizon` and reports whether the rider
 * terminated before it and/or a clean exit was found. The float-free chunk
 * arithmetic (start at `minExit`, step `min(cap, horizon + 4)`, while
 * `horizon < cap`) lives here so the window growth cannot fork.
 *
 * Returns the chosen stop horizon (≤ `cap`). `cap` is returned when neither
 * stop condition fires within the window.
 */
export type ShortHorizonProbe = { terminatedEarly: boolean; exitFound: boolean };

export function growShortHorizon(
  minExit: number,
  cap: number,
  probe: (horizon: number) => ShortHorizonProbe,
): number {
  for (let horizon = minExit; horizon < cap; horizon = Math.min(cap, horizon + 4)) {
    const { terminatedEarly, exitFound } = probe(horizon);
    if (terminatedEarly || exitFound) return horizon;
  }
  return cap;
}
