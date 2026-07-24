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
 * core/ballistic_launch.ts). The two call sites differ only in where the per-frame
 * rider position comes from (the metered ENGINE in arc_probe.ts vs the
 * DETECTION arrays in candidate.ts) and in the airborne predicate's source;
 * the float-op sequence of the plane math is identical and lives here.
 *
 * Jérémie's hard requirement: ONE definition of "the rider has exited the arc".
 * That definition is `confirmedArcExitFrame`, and it is a function of the
 * geometry and the trajectory alone — never of how far the caller happened to
 * simulate. The exit frame IS the ballistic launch anchor (see
 * core/ballistic_launch.ts): there is no separate anchor rule, no forward scan,
 * and no second notion of "clean".
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
 * Airborne continuation required to confirm a geometric exit, in frames.
 *
 * A single frame is enough, and it is measured rather than assumed: over
 * 202,752 real production launches (all 44 canonical V2 cases × 3 seeds, the
 * frozen ballistic corpus), only 12 — 0.0059% — took ANY collision update
 * strictly after the launch anchor, and every one of those occurred at exactly
 * anchor+1 on a trailing point (TAIL, LFOOT/RFOOT). One confirming frame
 * catches precisely that failure mode; requiring more would cost simulated
 * frames to defend against something that does not happen.
 */
export const ARC_EXIT_CONFIRM_FRAMES = 1;

/**
 * THE geometric arc exit: the first frame at which the rider is airborne, past
 * the arc-end plane, and STAYS airborne for `ARC_EXIT_CONFIRM_FRAMES` more
 * frames. That trailing frame rejects the one real failure mode — a trailing
 * sled/limb point grazing the arc on the very next frame — without treating a
 * later, unrelated contact as evidence about this exit.
 *
 * SCHEDULE INDEPENDENCE (the property the callers rely on): the answer is the
 * FIRST qualifying frame, and qualification depends only on frames in
 * `[f, f + ARC_EXIT_CONFIRM_FRAMES]`. So once the observed window reaches
 * `exit + ARC_EXIT_CONFIRM_FRAMES`, growing it further can never change the
 * answer, and two callers that grow their detection windows on different
 * schedules necessarily agree. `null` means "not confirmable in this window" —
 * the caller must simulate further, never "there is no exit".
 *
 * This replaced a horizon-relative rule ("the airborne run ending at
 * `endFrame`"), under which the exit frame — and therefore the launch state,
 * the exact/predicted split, and every readiness feature — moved with however
 * far the caller happened to simulate.
 */
export function confirmedArcExitFrame(
  lines: readonly ExitLine[],
  startFrame: number,
  endFrame: number,
  airborneAtFrame: (frame: number) => boolean | undefined,
  positionAtFrame: (frame: number) => Vec2 | null | undefined,
): number | null {
  const exit = arcExitPlane(lines);
  const lastConfirmable = endFrame - ARC_EXIT_CONFIRM_FRAMES;
  for (let frame = startFrame; frame <= lastConfirmable; frame++) {
    if (airborneAtFrame(frame) !== true) continue;
    if (!positionPastArcExit(positionAtFrame(frame), exit)) continue;
    let confirmed = true;
    for (let ahead = 1; ahead <= ARC_EXIT_CONFIRM_FRAMES; ahead++) {
      if (airborneAtFrame(frame + ahead) !== true) {
        confirmed = false;
        break;
      }
    }
    if (confirmed) return frame;
  }
  return null;
}

/**
 * Diagnostic only: the first frame after a confirmed exit's confirmation
 * window at which the rider is observed NOT airborne, within the window the
 * caller already simulated. Null when the flight stays clean.
 *
 * This is the standing measurement of what the confirmation rule gives up. It
 * reads only already-detected frames, so it costs no simulation.
 */
export function arcExitAirborneBreakFrame(
  exitFrame: number,
  endFrame: number,
  airborneAtFrame: (frame: number) => boolean | undefined,
): number | null {
  for (
    let frame = exitFrame + ARC_EXIT_CONFIRM_FRAMES + 1;
    frame <= endFrame;
    frame++
  ) {
    if (airborneAtFrame(frame) === false) return frame;
  }
  return null;
}

/**
 * Detection-window growth for the minimal-simulation principle: the engine
 * simulates only until the rider has demonstrably left the arc; everything
 * after that is ballistic. Grows the window in `GROW_CHUNK_FRAMES` steps from
 * `minExit` to `cap`, stopping as soon as either the rider terminated before
 * the chunk horizon (a ride-out / death the caller must see in full) or the
 * exit was confirmed inside the chunk.
 *
 * THIS IS A COST OPTIMIZATION AND NOTHING ELSE. The chunk size trades detection
 * work (`detectWindow` re-walks the whole window on every call, so growing one
 * frame at a time is quadratic) against wasted simulation past a death. It must
 * not influence any reported quantity: `confirmedArcExitFrame` returns the
 * first frame confirmable within the window, so every schedule that reaches
 * `exit + ARC_EXIT_CONFIRM_FRAMES` yields the same exit, the same anchor, and
 * the same launch state. `tests/exit_read.test.ts` pins that invariant.
 *
 * Returns the chosen stop horizon (≤ `cap`). `cap` is returned when neither
 * stop condition fires within the window.
 */
export const GROW_CHUNK_FRAMES = 4;

export type ShortHorizonProbe = { terminatedEarly: boolean; exitFound: boolean };

export function growShortHorizon(
  minExit: number,
  cap: number,
  probe: (horizon: number) => ShortHorizonProbe,
  chunkFrames: number = GROW_CHUNK_FRAMES,
): number {
  for (
    let horizon = minExit;
    horizon < cap;
    horizon = Math.min(cap, horizon + chunkFrames)
  ) {
    const { terminatedEarly, exitFound } = probe(horizon);
    if (terminatedEarly || exitFound) return horizon;
  }
  return cap;
}
