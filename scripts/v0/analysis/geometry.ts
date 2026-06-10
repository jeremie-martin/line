/**
 * Track-geometry extraction for the lab arcs tier.
 *
 * A track.json `lines` array is a sequence of segments in placement order;
 * consecutive segments whose endpoints touch form one arc (a placed catch
 * surface). Arc start-x is monotonically increasing in id order (tracks
 * progress rightward), so arc order = chronological order.
 *
 * Pairing arcs to contacts (validated on a full canonical run, 99.1% clean):
 *   - first arc starting at/before startPosition.x is the start support →
 *     arc k+1 catches contact k
 *   - otherwise arc k catches contact k
 *   - any other count relationship → pair best-effort in order, but flag the
 *     checkpoint arc_pairing_confident = 0 (early-death / repaired tracks)
 *
 * Angles are in degrees with positive = descending (LR screen +y is down).
 */

type TrackLine = { x1: number; y1: number; x2: number; y2: number };

export type ArcFeatures = {
  arc_index: number;
  contact_index: number | null;
  is_start: 0 | 1;
  n_segments: number;
  x_start: number;
  y_start: number;
  x_end: number;
  y_end: number;
  path_len: number;
  chord_len: number;
  straightness: number | null;
  entry_angle_deg: number | null;
  exit_angle_deg: number | null;
  turn_deg: number | null;
  drop: number;
};

export type TrackArcs = {
  arcs: ArcFeatures[];
  pairing_confident: 0 | 1;
};

const DEG = 180 / Math.PI;

function segmentAngleDeg(l: TrackLine): number | null {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  if (dx === 0 && dy === 0) return null;
  return Math.atan2(dy, dx) * DEG;
}

/** Wrap an angle delta into (-180, 180]. */
function wrapDeg(delta: number): number {
  let d = delta % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function chainArcs(lines: TrackLine[]): TrackLine[][] {
  const arcs: TrackLine[][] = [];
  let current: TrackLine[] = [];
  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev !== undefined && line.x1 === prev.x2 && line.y1 === prev.y2) {
      current.push(line);
    } else {
      if (current.length > 0) arcs.push(current);
      current = [line];
    }
  }
  if (current.length > 0) arcs.push(current);
  return arcs;
}

function arcFeatures(segments: TrackLine[], arcIndex: number): ArcFeatures {
  const first = segments[0];
  const last = segments[segments.length - 1];
  let pathLen = 0;
  let entry: number | null = null;
  let exit: number | null = null;
  let turn = 0;
  let hasTurn = false;
  let prevAngle: number | null = null;
  for (const seg of segments) {
    pathLen += Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    const angle = segmentAngleDeg(seg);
    if (angle === null) continue;
    if (entry === null) entry = angle;
    if (prevAngle !== null) {
      turn += wrapDeg(angle - prevAngle);
      hasTurn = true;
    }
    prevAngle = angle;
    exit = angle;
  }
  const chordLen = Math.hypot(last.x2 - first.x1, last.y2 - first.y1);
  return {
    arc_index: arcIndex,
    contact_index: null,
    is_start: 0,
    n_segments: segments.length,
    x_start: first.x1,
    y_start: first.y1,
    x_end: last.x2,
    y_end: last.y2,
    path_len: pathLen,
    chord_len: chordLen,
    straightness: pathLen > 0 ? chordLen / pathLen : null,
    entry_angle_deg: entry,
    exit_angle_deg: exit,
    turn_deg: hasTurn ? turn : segments.length > 0 ? 0 : null,
    drop: last.y2 - first.y1,
  };
}

export function extractTrackArcs(
  track: { startPosition?: { x: number }; lines?: TrackLine[] },
  nContacts: number,
): TrackArcs {
  const lines = track.lines ?? [];
  const startX = track.startPosition?.x ?? 0;
  const arcs = chainArcs(lines).map(arcFeatures);
  if (arcs.length === 0) return { arcs, pairing_confident: 0 };

  const hasStartArc = arcs[0].x_start <= startX;
  const offset = hasStartArc ? 1 : 0;
  if (hasStartArc) arcs[0].is_start = 1;
  for (let i = offset; i < arcs.length; i++) {
    const contact = i - offset;
    arcs[i].contact_index = contact < nContacts ? contact : null;
  }
  const confident =
    (hasStartArc && arcs.length === nContacts + 1) ||
    (!hasStartArc && arcs.length === nContacts);
  return { arcs, pairing_confident: confident ? 1 : 0 };
}
