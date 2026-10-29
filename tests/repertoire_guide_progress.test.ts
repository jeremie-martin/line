import {expect, it} from 'vitest';
import {guideProgress} from '../scripts/v0/optimizer/repertoire_realization.ts';
import {makeRng} from '../scripts/lib/rng.ts';
import type {TrackLine} from '../scripts/v0/types.ts';

const length = (l: TrackLine) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
/** The scan every guide line used to make over every shaped segment. */
function reference(guide: TrackLine[], shaped: TrackLine[], totalLength: number) {
  const out: Array<[number, number]> = [];
  for (const l of guide) {
    const x = (l.x1 + l.x2) / 2, y = (l.y1 + l.y2) / 2; let closest = Infinity, progress = 0, offset = 0;
    for (const m of shaped) {
      const dx = m.x2 - m.x1, dy = m.y2 - m.y1, len = length(m), t = Math.max(0, Math.min(1, ((x - m.x1) * dx + (y - m.y1) * dy) / Math.max(1e-12, len * len)));
      const d = Math.hypot(x - m.x1 - t * dx, y - m.y1 - t * dy);
      if (d < closest) {closest = d; progress = (offset + t * len) / Math.max(1e-12, totalLength);} offset += len;
    }
    if (closest <= 40) out.push([l.id, progress]);
  }
  return out;
}

/** A wandering polyline, with zero-length steps, repeated segments and a parallel rail. */
function rails(seed: number) {
  const rng = makeRng(seed), origin = (rng() - .5) * 2e5, shaped: TrackLine[] = [], guide: TrackLine[] = [];
  let x = origin, y = origin / 3, heading = rng() * 6;
  for (let k = 0; k < 20 + Math.floor(rng() * 200); k++) {
    const step = rng() < .05 ? 0 : 1 + rng() * 15; heading += (rng() - .5) * .8;
    const line = {id: 1000 + k, type: 0, x1: x, y1: y, x2: x + step * Math.cos(heading), y2: y + step * Math.sin(heading)} as TrackLine;
    shaped.push(line); if (rng() < .05) shaped.push({...line, id: 5000 + k});
    x = line.x2; y = line.y2;
    const offset = rng() < .1 ? 0 : (rng() < .5 ? 1 : -1) * rng() * 60, nx = -Math.sin(heading) * offset, ny = Math.cos(heading) * offset;
    if (rng() < .7) guide.push({id: 9000 + k, type: 0, x1: line.x1 + nx, y1: line.y1 + ny, x2: line.x2 + nx, y2: line.y2 + ny} as TrackLine);
  }
  return {shaped, guide, totalLength: shaped.reduce((s, l) => s + length(l), 0)};
}

it('finds the same nearest shaped location as scanning every segment', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const {shaped, guide, totalLength} = rails(seed);
    expect(guideProgress(guide, shaped, totalLength)).toEqual(reference(guide, shaped, totalLength));
  }
});
