/** Reduce redundant guidance while retaining one coherent upper curve per arc. */
import type { TrackLine } from '../types.ts';

import {arcRailGroups} from './arc_rail_groups.ts';
export {arcRailGroups} from './arc_rail_groups.ts';

export function trimUnusedArcGuides(lines: TrackLine[], engine: any, duration: number, fragmentSections:ReadonlySet<number>=new Set()) {
  // Collision inspection must use an already metered complete replay.
  if (engine.getLastFrameIndex() < duration) throw new Error('guidance reduction requires a metered full replay');
  // Disconnected contact fragments have no guide rail to trim.
  const groups = arcRailGroups(lines.filter(l=>!fragmentSections.has(Math.floor((l.id-1000)/10000))));
  const roofs = [...groups].map(([id, chains]) => {
    return { id, lines: chains[1] ?? [] };
  });
  const roofIds = new Set(roofs.flatMap(g => g.lines.map(l => l.id))), touched = new Set<number>();
  for (let f = 1; f <= duration; f++) for (const update of engine.getUpdatesAtFrame(f)) {
    if (update.type === 'CollisionUpdate' && roofIds.has(update.id)) touched.add(update.id);
  }
  const removed = new Set<number>(), spans: any[] = [];
  for (const roof of roofs) {
    const used = roof.lines.map((l, i) => touched.has(l.id) ? i : -1).filter(i => i >= 0);
    let lo = used.length ? Math.max(0, Math.min(...used) - 2) : roof.lines.length;
    let hi = used.length ? Math.min(roof.lines.length, Math.max(...used) + 3) : roof.lines.length;
    const lengths = roof.lines.map(l => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
    const totalLength = lengths.reduce((a, b) => a + b, 0);
    let retainedLength = lengths.slice(lo, hi).reduce((a, b) => a + b, 0);
    // Preserve substantial curves around the contact span, never scattered
    // collision points. Short source curves are retained in their entirety.
    const minimumLength = Math.min(totalLength, Math.max(24, totalLength * .2));
    while (used.length && (retainedLength < minimumLength || hi - lo < Math.min(3, roof.lines.length)) && (lo > 0 || hi < roof.lines.length)) {
      if (lo > 0) retainedLength += lengths[--lo];
      if (hi < roof.lines.length) retainedLength += lengths[hi++];
    }
    roof.lines.forEach((l, i) => { if (i < lo || i >= hi) removed.add(l.id); });
    spans.push({ group: roof.id, before: roof.lines.length, after: hi - lo, contacted: used.length, lengthBefore: totalLength, lengthAfter: retainedLength });
  }
  return { lines: lines.filter(l => !removed.has(l.id)), stats: {
    originalGuides: roofs.filter(g => g.lines.length).length,
    removedGuides: spans.filter(g => g.before > 0 && g.after === 0).length,
    shortenedGuides: spans.filter(g => g.after > 0 && g.after < g.before).length,
    removedSegments: removed.size,
    lengthBefore: spans.reduce((s, g) => s + g.lengthBefore, 0),
    lengthAfter: spans.reduce((s, g) => s + g.lengthAfter, 0), spans,
  } };
}
