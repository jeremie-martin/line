/** Passages of a few seconds where two saved rides of one case differ most in
 * what the scores count, for review by eye (`npm run compare -- review`).
 *
 * Each scored item has an error per ride, with the account's own terms:
 *  - a beat: (strength − ask)² + timing error², or 1 if missed (line.strike.v3,
 *    `impact3.perBeat`);
 *  - unasked hits: their account cost (`impact3.extras`);
 *  - a gap's air and speed: (achieved − target)², or 1 if not reached, weighted
 *    by the share of the gap inside the window;
 *  - the end of a ride that did not finish: 1.
 * A window starts `LEAD` seconds before a beat and lasts `LENGTH` seconds; its
 * change is the sum of |candidate error − reference error| over its items, so
 * changes in opposite directions do not cancel. Nothing is weighted beyond that. */
import assert from 'node:assert/strict';

export const LEAD = 1.5, LENGTH = 4;
const FPS = 40;
type Item = {at: number; change: number; error: [number, number]; text: string};
export type Passage = {id: string; from: number; to: number; beat: number; change: number; error: [number, number]; items: Item[]};
const s = (frame: number) => (frame / FPS).toFixed(1) + ' s';
const n = (x: number | null) => x === null ? 'missed' : x.toFixed(2);

/** Every window of one case, `reference` and `candidate` being saved cells. */
export function passages(id: string, reference: any, candidate: any, durationFrames: number): Passage[] {
  const frames: number[] = reference.beats.map((b: any) => b.frame);
  assert.deepEqual(candidate.beats.map((b: any) => b.frame), frames, `${id}: the two rides answer different beats`);
  const pair = (f: (cell: any) => number) => [f(reference), f(candidate)] as [number, number];
  const beats: Item[] = frames.map((frame, j) => {
    const asked = reference.impact3.perBeat[j].requested as number | null;
    const err = (cell: any) => {const hit = cell.impact3.perBeat[j].hit; return hit ? (asked === null ? 0 : (hit.strength - asked) ** 2) + hit.timingError ** 2 : 1;};
    const hit = (cell: any) => cell.impact3.perBeat[j].hit, [a, b] = [hit(reference), hit(candidate)];
    const timing = a && b && a.offset !== b.offset ? `, timing ${a.offset * 25} → ${b.offset * 25} ms` : '';
    return item(frame, pair(err), `beat at ${s(frame)}${asked === null ? '' : `, asked ${asked.toFixed(2)}`}: strength ${n(a?.strength ?? null)} → ${n(b?.strength ?? null)}${timing}`);
  });
  const gapSpan = (g: number) => [g === 0 ? 0 : frames[g - 1], g < frames.length ? frames[g] : durationFrames];
  const gaps: Array<Item & {span: number[]}> = [];
  for (const [g, axis, target] of reference.gaps.filter((o: any) => o[1] === 'air' || o[1] === 'speed')) {
    const achieved = (cell: any) => cell.gaps.find((o: any) => o[0] === g && o[1] === axis)?.[3] ?? null;
    const [a, b] = pair(achieved), span = gapSpan(g);
    gaps.push({...item((span[0] + span[1]) / 2, [a === null ? 1 : (a - target) ** 2, b === null ? 1 : (b - target) ** 2],
      `${axis} ${(span[0] / FPS).toFixed(1)}–${s(span[1])}, asked ${target.toFixed(2)}: ${n(a)} → ${n(b)}`), span});
  }
  // A ride that did not finish: nothing after its end is worth watching.
  const ends = [reference, candidate].map(c => c.complete ? Infinity : c.terminus.frame), last = Math.min(...ends);
  const out: Passage[] = [];
  frames.forEach((beat, j) => {
    const from = Math.max(0, beat - LEAD * FPS), to = Math.min(durationFrames, from + LENGTH * FPS);
    if (from > last) return;
    const inside = (f: number) => f >= from && f < to, items: Item[] = beats.filter(x => inside(x.at));
    for (const g of gaps) {
      const share = Math.max(0, Math.min(to, g.span[1]) - Math.max(from, g.span[0])) / Math.max(1, g.span[1] - g.span[0]);
      if (share > 0) items.push({...g, error: [share * g.error[0], share * g.error[1]], change: share * g.change});
    }
    const extras = pair(cell => cell.impact3.extras.filter((e: any) => inside(e.onset)).reduce((t: number, e: any) => t + e.cost, 0));
    const list = (cell: any) => cell.impact3.extras.filter((e: any) => inside(e.onset)).map((e: any) => e.strength.toFixed(2)).join(', ') || 'none';
    const strongest = [reference, candidate].flatMap(cell => cell.impact3.extras.filter((e: any) => inside(e.onset))).sort((a, b) => b.strength - a.strength)[0];
    if (extras[0] !== extras[1]) items.push(item(strongest.onset, extras, `unasked hits ${list(reference)} → ${list(candidate)}`));
    ends.forEach((end, k) => {
      if (inside(end)) items.push(item(end, k ? [0, 1] : [1, 0], `${k ? 'after' : 'before'} stops at ${s(end)} (${[reference, candidate][k].terminus.reason})`));
    });
    items.sort((x, y) => y.change - x.change);
    const total = (k: 0 | 1) => items.reduce((t, x) => t + x.error[k], 0);
    out.push({id, from, to, beat, change: items.reduce((t, x) => t + x.change, 0), error: [total(0), total(1)], items: items.filter(x => x.change > 0)});
  });
  return out;
}
const item = (at: number, error: [number, number], text: string): Item => ({at, error, change: Math.abs(error[1] - error[0]), text});

/** The `k` largest changes, one per ride and spec while possible, then one per
 * ride, then any that do not overlap a chosen one. */
export function choose(candidates: Array<Passage & {spec: string}>, k: number) {
  const sorted = [...candidates].sort((a, b) => b.change - a.change), chosen: typeof sorted = [];
  const rules = [(p: Passage & {spec: string}) => chosen.every(c => c.spec !== p.spec), (p: Passage) => chosen.every(c => c.id !== p.id),
    (p: Passage) => chosen.every(c => c.id !== p.id || p.to <= c.from || p.from >= c.to)];
  for (const rule of rules) for (const p of sorted) if (chosen.length < k && p.change > 0 && !chosen.includes(p) && rule(p)) chosen.push(p);
  return chosen;
}
