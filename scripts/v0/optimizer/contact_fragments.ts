import type {TrackLine} from '../types.ts';
import type {RawTrajectory} from '../../lib/detector.ts';
/** Intervals on each observed collision plane. Merging overlaps prevents duplicate
* coincident planes; disconnected footprints never get silently joined into an arc. */
export function contactFragments(source: TrackLine[], footprints: Map<number, number[]>, width: number): TrackLine[] {
  if (!Number.isFinite(width) || width <= 0)
    throw new Error('positive fragment width required');
  const byId = new Map(source.map(l => [l.id, l])), lines: TrackLine[] = [];
  if (byId.size !== source.length)
    throw new Error('duplicate source line id');
  for (const [id, values] of footprints) {
    const line = byId.get(id);
    if (!line || line.type !== 0)
      throw new Error('normal source line required');
    const dx = line.x2 - line.x1, dy = line.y2 - line.y1, length = Math.hypot(dx, dy);
    if (!(length > 0) || !Number.isFinite(length))
      throw new Error('degenerate source line');
    const half = width / (2 * length), spans: Array<[number, number]> = [];
    for (const t of values.slice().sort((a, b) => a - b)) {
      if (!Number.isFinite(t))
        throw new Error('nonfinite contact location');
      const a = t - half, b = t + half, last = spans.at(-1);
      if (last && a <= last[1] + 1e-8)
        last[1] = Math.max(last[1], b);
      else
        spans.push([a, b]);
    }
    for (const [a, b] of spans)
      lines.push({ ...line, id: lines.length + 1,
        x1: line.x1 + dx * a, y1: line.y1 + dy * a, x2: line.x1 + dx * b, y2: line.y1 + dy * b,
        leftExtended: false, rightExtended: false });
  }
  return lines;
}
export function trajectoryDifference(reference: RawTrajectory, candidate: RawTrajectory) {
  if (reference.frames.length !== candidate.frames.length)
    return Infinity;
  let maximum = 0;
  for (let i = 0; i < reference.frames.length; i++) {
    const a = reference.frames[i], b = candidate.frames[i];
    if (a.riderEjected !== b.riderEjected || a.sledBroken !== b.sledBroken ||
      Boolean(a.sledContacts.length) !== Boolean(b.sledContacts.length))
      return Infinity;
    maximum = Math.max(maximum, Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y), Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y));
  }
  return maximum;
}
