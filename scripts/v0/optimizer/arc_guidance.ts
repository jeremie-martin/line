import {hypot2} from '../../lib/hypot2.ts';
/** Reduce redundant guidance while retaining one coherent upper curve per arc. */
import type { TrackLine } from '../types.ts';

import {arcRailGroups} from './arc_rail_groups.ts';
export {arcRailGroups} from './arc_rail_groups.ts';

/** `contacts` is the complete replay's all-point contact IDs, indexed from frame zero. Each support's guide, and its
 * main curve too (the untouched lead-in and runout), keep only the stretch the ride touches with a margin. */
export function trimUnusedArcGuides(lines: TrackLine[], contacts: readonly (readonly number[])[], fragmentSections:ReadonlySet<number>=new Set()) {
  // Disconnected contact fragments have no guide rail to trim.
  const groups = arcRailGroups(lines.filter(l=>!fragmentSections.has(Math.floor((l.id-1000)/10000))));
  // A main curve the ride never touches is kept whole: its section's shape stays drawn where the rider flew past it.
  const roofs = [...groups].flatMap(([id, chains]) => [{ id, lines: chains[1] ?? [] }, { id, lines: chains[0] ?? [], main: true }]);
  const roofIds = new Set(roofs.flatMap(g => g.lines.map(l => l.id))), touched = new Set<number>();
  const mainTrim: {group: number; lengthBefore: number; lengthAfter: number}[] = [];
  for (let f = 1; f < contacts.length; f++) for (const id of contacts[f]) {
    if (roofIds.has(id)) touched.add(id);
  }
  const removed = new Set<number>(), spans: any[] = [];
  for (const roof of roofs) {
    const used = roof.lines.map((l, i) => touched.has(l.id) ? i : -1).filter(i => i >= 0);
    if ((roof as {main?: boolean}).main && !used.length) continue;
    let lo = used.length ? Math.max(0, Math.min(...used) - 2) : roof.lines.length;
    let hi = used.length ? Math.min(roof.lines.length, Math.max(...used) + 3) : roof.lines.length;
    const lengths = roof.lines.map(l => hypot2(l.x2 - l.x1, l.y2 - l.y1));
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
    if (!(roof as {main?: boolean}).main) spans.push({ group: roof.id, before: roof.lines.length, after: hi - lo, contacted: used.length, lengthBefore: totalLength, lengthAfter: retainedLength });
    else mainTrim.push({ group: roof.id, lengthBefore: totalLength, lengthAfter: retainedLength });
  }
  return { lines: lines.filter(l => !removed.has(l.id)), stats: {
    originalGuides: roofs.filter(g => g.lines.length).length,
    removedGuides: spans.filter(g => g.before > 0 && g.after === 0).length,
    shortenedGuides: spans.filter(g => g.after > 0 && g.after < g.before).length,
    removedSegments: removed.size,
    lengthBefore: spans.reduce((s, g) => s + g.lengthBefore, 0),
    lengthAfter: spans.reduce((s, g) => s + g.lengthAfter, 0), spans,
    mainLengthBefore: mainTrim.reduce((s, g) => s + g.lengthBefore, 0), mainLengthAfter: mainTrim.reduce((s, g) => s + g.lengthAfter, 0),
  } };
}
