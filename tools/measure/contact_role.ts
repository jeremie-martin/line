/** How the rider meets the track: one definition of a contact's kind, shared by measurement, reports and studies.
 *
 * A line is a *guide* (a rail laid beside a support; the compile records their ids per section) or a *main* line
 * (everything else: supports, receivers, scattered fragments' own lines). The engine (engine-rs line.rs) gives a line
 * the normal (−dy, dx) / length, negated when flipped, and pushes a colliding point against it: a plain line drawn left
 * to right holds the rider up. Screen y points down, so the push is *down* when its y component exceeds 0.2 of its
 * length, *up* below −0.2, and a *wall* in between. (The compiler's contactSide −1 receivers are exactly the main lines
 * that push down.)
 *
 * A hit is classified by what touches in its first frames (its contact start and the two after: the strike's own
 * 50 ms window, scripts/lib/strike_impact.ts):
 *   floor        a main line pushes up; no guide touched
 *   floor+rail   a main line pushes up and a guide is touched
 *   upper        a main line pushes down; no guide touched: a clean upper hit, the beat caught on a line's underside
 *   upper+rail   a main line pushes down and a guide is touched
 *   rail         only guides touched
 *   other        walls only
 * Which rider points touch does not matter: a catch made with the body is still a floor or an upper hit. */

export type Line = {id: number; x1: number; y1: number; x2: number; y2: number; flipped?: boolean};
export type Push = 'down' | 'up' | 'wall';
export type ContactKind = 'floor' | 'floor+rail' | 'upper' | 'upper+rail' | 'rail' | 'other';
export const CONTACT_KINDS: readonly ContactKind[] = ['floor', 'floor+rail', 'upper', 'upper+rail', 'rail', 'other'];
/** The frames a hit is classified over, from its contact start. */
export const HIT_FRAMES = 3;

export function pushSide(line: Line): Push {
  const dx = line.x2 - line.x1, dy = line.y2 - line.y1, length = Math.hypot(dx, dy) || 1;
  const y = -(line.flipped ? -1 : 1) * dx / length;
  return y > .2 ? 'down' : y < -.2 ? 'up' : 'wall';
}

/** Guide ids from the compact ranges geometry facts keep ([first, last] per run of consecutive ids). */
export function guideIds(sections: ReadonlyArray<{guides?: ReadonlyArray<readonly [number, number]>}>): Set<number> {
  const ids = new Set<number>();
  for (const s of sections) for (const [lo, hi] of s.guides ?? []) for (let id = lo; id <= hi; id++) ids.add(id);
  return ids;
}
/** Consecutive ids as [first, last] ranges (guide ids are contiguous within a section). */
export function idRanges(ids: Iterable<number>): Array<[number, number]> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b), out: Array<[number, number]> = [];
  for (const id of sorted) {
    const last = out.at(-1);
    if (last && id === last[1] + 1) last[1] = id; else out.push([id, id]);
  }
  return out;
}

/** The kind of a set of contacts (line ids touched), given the track's lines and the guide ids. */
export function contactKind(touched: Iterable<number>, lines: ReadonlyMap<number, Line>, guides: ReadonlySet<number>): ContactKind {
  let guide = false, down = false, up = false;
  for (const id of touched) {
    if (guides.has(id)) { guide = true; continue; }
    const line = lines.get(id);
    if (!line) continue;
    const side = pushSide(line);
    if (side === 'down') down = true; else if (side === 'up') up = true;
  }
  if (down) return guide ? 'upper+rail' : 'upper';
  if (up) return guide ? 'floor+rail' : 'floor';
  return guide ? 'rail' : 'other';
}

/** The kind of a hit whose contact starts at `start`, from per-frame collisions ([line id, point index] pairs). */
export function hitKind(collisions: ReadonlyArray<ReadonlyArray<readonly number[]>>, start: number, lines: ReadonlyMap<number, Line>,
  guides: ReadonlySet<number>): ContactKind {
  const touched: number[] = [];
  for (let f = start; f < start + HIT_FRAMES && f < collisions.length; f++) for (const [id] of collisions[f] ?? []) touched.push(id);
  return contactKind(touched, lines, guides);
}
