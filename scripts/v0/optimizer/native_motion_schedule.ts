import type { Gap } from "../types.ts";

/** Choose actual contact times inside the existing one-frame tolerance, leaving
 * enough room for a persistent catch and the detector's required airborne run. */
export function scheduleNativeContacts(gaps: readonly Gap[]): Gap[] {
  const contacts = gaps.filter(g => g.endsWithContact);
  let states = new Map<number, { cost: number; frames: number[] }>([[0, { cost: 0, frames: [] }]]);
  for (const gap of contacts) {
    const next = new Map<number, { cost: number; frames: number[] }>();
    const minimum = gap.endFrame - gap.startFrame > 6 ? 9 : 4;
    for (const offset of [0, -1, 1]) {
      const frame = gap.endFrame + offset;
      for (const [previous, path] of states) {
        if (frame - previous < minimum) continue;
        const cost = path.cost + offset * offset;
        if (!next.has(frame) || cost < next.get(frame)!.cost) next.set(frame, { cost, frames: [...path.frames, frame] });
      }
    }
    if (!next.size) return gaps.map(g => ({ ...g }));
    states = next;
  }
  const best = [...states.values()].sort((a, b) => a.cost - b.cost)[0];
  if (!best) return gaps.map(g => ({ ...g }));
  let cursor = 0, index = 0;
  return gaps.map(g => {
    const end = g.endsWithContact ? best.frames[index++] : g.endFrame;
    const result = { ...g, startFrame: cursor, endFrame: end }; cursor = end;
    return result;
  });
}
