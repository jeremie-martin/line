import {hypot2} from '../../lib/hypot2.ts';
/** Reduce redundant guidance while retaining one coherent upper curve per arc. */
import type { TrackLine } from '../types.ts';

import {arcRailGroups} from './arc_rail_groups.ts';
export {arcRailGroups} from './arc_rail_groups.ts';

/** Keep the touched span with two neighboring segments and a substantial length.
 * The margin retains a curve rather than isolated collision points. */
function retainedSpan(lines: readonly TrackLine[], touched: ReadonlySet<number>) {
  const used = lines.map((l, i) => touched.has(l.id) ? i : -1).filter(i => i >= 0);
  let lo = used.length ? Math.max(0, Math.min(...used) - 2) : lines.length;
  let hi = used.length ? Math.min(lines.length, Math.max(...used) + 3) : lines.length;
  const lengths = lines.map(l => hypot2(l.x2 - l.x1, l.y2 - l.y1));
  const totalLength = lengths.reduce((a, b) => a + b, 0);
  let retainedLength = lengths.slice(lo, hi).reduce((a, b) => a + b, 0);
  const minimumLength = Math.min(totalLength, Math.max(24, totalLength * .2));
  while (used.length && (retainedLength < minimumLength || hi - lo < Math.min(3, lines.length)) && (lo > 0 || hi < lines.length)) {
    if (lo > 0) retainedLength += lengths[--lo];
    if (hi < lines.length) retainedLength += lengths[hi++];
  }
  return {lo, hi, contacted: used.length, totalLength, retainedLength};
}

/** Shorten only the ends of touched main curves. Untouched supports stay drawn;
 * fragments are separate constructions, and guides have their own pruning pass. */
export function trimUnusedArcSupports(lines: TrackLine[], contacts: readonly (readonly number[])[], fragmentSections: ReadonlySet<number> = new Set()) {
  const groups = arcRailGroups(lines.filter(l => !fragmentSections.has(Math.floor((l.id - 1000) / 10000))));
  const touched = new Set(contacts.slice(1).flat()), removed = new Set<number>();
  for (const chains of groups.values()) {
    const main = chains[0], span = retainedSpan(main, touched);
    if (!span.contacted) continue;
    main.forEach((l, i) => {if (i < span.lo || i >= span.hi) removed.add(l.id);});
  }
  return lines.filter(l => !removed.has(l.id));
}

/** `contacts` is the complete replay's all-point contact IDs, indexed from frame zero. */
export function trimUnusedArcGuides(lines: TrackLine[], contacts: readonly (readonly number[])[], fragmentSections:ReadonlySet<number>=new Set()) {
  // Disconnected contact fragments have no guide rail to trim.
  const groups = arcRailGroups(lines.filter(l=>!fragmentSections.has(Math.floor((l.id-1000)/10000))));
  const roofs = [...groups].map(([id, chains]) => {
    return { id, lines: chains[1] ?? [] };
  });
  const roofIds = new Set(roofs.flatMap(g => g.lines.map(l => l.id))), touched = new Set<number>();
  for (let f = 1; f < contacts.length; f++) for (const id of contacts[f]) {
    if (roofIds.has(id)) touched.add(id);
  }
  const removed = new Set<number>(), spans: any[] = [];
  for (const roof of roofs) {
    const {lo, hi, contacted, totalLength, retainedLength} = retainedSpan(roof.lines, touched);
    roof.lines.forEach((l, i) => { if (i < lo || i >= hi) removed.add(l.id); });
    spans.push({ group: roof.id, before: roof.lines.length, after: hi - lo, contacted, lengthBefore: totalLength, lengthAfter: retainedLength });
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
