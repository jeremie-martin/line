/** Small-scale roughness of the ground the rider touches (experiment, REWORK.md November 15).
 * Along each connected chain of lines: the heading as a function of distance. At every point where the bend
 * changes direction, the degrees undone within `reach` px on each side (the smaller of the two). A smooth arc
 * gives 0, a long S a few degrees, bumps and corners many. Only turning points within `reach` / 2 of a touched
 * line count: geometry the rider never rides is not judged. Returns the worst such reversal, in degrees. */
export type GroundLine = Readonly<{id: number; x1: number; y1: number; x2: number; y2: number}>;
export function roughestReversal(lines: readonly GroundLine[], touched: ReadonlySet<number>, reach = 60): number {
  let worst = 0;
  for (let first = 0; first < lines.length;) {
    let last = first;
    while (last + 1 < lines.length && lines[last + 1].x1 === lines[last].x2 && lines[last + 1].y1 === lines[last].y2) last++;
    const h: number[] = [], d: number[] = [], on: boolean[] = [];
    let along = 0;
    for (let k = first; k <= last; k++) {
      const l = lines[k], length = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
      let heading = Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
      if (h.length) {while (heading - h.at(-1)! > 180) heading -= 360; while (heading - h.at(-1)! < -180) heading += 360;}
      h.push(heading); d.push(along + length / 2); on.push(touched.has(l.id)); along += length;
    }
    let bend = 0;   // the sign of the last change of heading, across straight stretches
    for (let i = 0; i + 1 < h.length; i++) {
      const next = Math.sign(h[i + 1] - h[i]), turns = next !== 0 && bend !== 0 && next !== bend;
      if (next !== 0) bend = next;
      if (!turns) continue;
      let ridden = false, before = 0, after = 0;
      for (let k = i; k >= 0 && d[i] - d[k] <= reach; k--) {before = Math.max(before, Math.abs(h[i] - h[k])); if (d[i] - d[k] <= reach / 2 && on[k]) ridden = true;}
      for (let k = i; k < h.length && d[k] - d[i] <= reach; k++) {after = Math.max(after, Math.abs(h[k] - h[i])); if (d[k] - d[i] <= reach / 2 && on[k]) ridden = true;}
      if (ridden) worst = Math.max(worst, Math.min(before, after));
    }
    first = last + 1;
  }
  return worst;
}
/** The sharpest turning of touched ground: the largest spread of heading within `window` px centred on a touched
 * line, in degrees, whatever its direction. A gentle arc gives `window` / radius; a lip or a corner many degrees. */
export function sharpestTurn(lines: readonly GroundLine[], touched: ReadonlySet<number>, window = 30): number {
  let worst = 0;
  for (let first = 0; first < lines.length;) {
    let last = first;
    while (last + 1 < lines.length && lines[last + 1].x1 === lines[last].x2 && lines[last + 1].y1 === lines[last].y2) last++;
    const h: number[] = [], d: number[] = [];
    let along = 0;
    for (let k = first; k <= last; k++) {
      const l = lines[k], length = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
      let heading = Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
      if (h.length) {while (heading - h.at(-1)! > 180) heading -= 360; while (heading - h.at(-1)! < -180) heading += 360;}
      h.push(heading); d.push(along + length / 2); along += length;
    }
    for (let i = 0; i < h.length; i++) {
      if (!touched.has(lines[first + i].id)) continue;
      let low = h[i], high = h[i];
      for (let k = i; k >= 0 && d[i] - d[k] <= window / 2; k--) {low = Math.min(low, h[k]); high = Math.max(high, h[k]);}
      for (let k = i; k < h.length && d[k] - d[i] <= window / 2; k++) {low = Math.min(low, h[k]); high = Math.max(high, h[k]);}
      worst = Math.max(worst, high - low);
    }
    first = last + 1;
  }
  return worst;
}

/** The rule (experiment, on with LINE_GROUND=on or built): after a hit's own frames, the ground the rider touches is
 * gentle. HIT_FRAMES is the account's event window; what the ground does within it belongs to the hit, on the beat.
 * After it, on the lines touched until the next hit:
 *  - no turning of more than LATE_TURN_LIMIT degrees within 30 px (a lip at the end of a support, a corner);
 *  - no reversal of more than REVERSAL_LIMIT degrees within 60 px (bumps, zigzags).
 * Fitted to the owner's 41 answers of 2026-11-15: it flags 15 stretches (2 of them clean) and passes 26 (21 clean;
 * of the 5 others, 2 are folds and 3 are scallops marked "a little"). Judging the hit's frames too flagged 6 clean
 * stretches and refused twice as many candidates. LINE_GROUND_PART=all restores that wider form for comparison. */
export const GROUND_RULE = process.env.LINE_GROUND === 'on' || process.env.LINE_GROUND === 'built', REVERSAL_LIMIT = 10, LATE_TURN_LIMIT = 10, HIT_FRAMES = 6;
/** LINE_GROUND=built: supports are also drawn to meet the second part. From HIT_FRAMES after the catch, a support's
 * heading changes no faster than this radius allows (30 px of ground turn 9°, inside the 10° limit), so the search
 * is offered gentle exits instead of lips it would have to refuse. The rule above stays the check. */
export const LATE_RADIUS = process.env.LINE_GROUND === 'built' ? 30 / (9 * Math.PI / 180) : 0;
export function groundIsSmooth(lines: readonly GroundLine[], contactLineIds: (frame: number) => readonly number[], hit: number, to: number): boolean {
  const all = new Set<number>(), late = new Set<number>();
  for (let f = hit; f <= to; f++) for (const id of contactLineIds(f)) {all.add(id); if (f >= hit + HIT_FRAMES) late.add(id);}
  return roughestReversal(lines, process.env.LINE_GROUND_PART === 'all' ? all : late) <= REVERSAL_LIMIT && sharpestTurn(lines, late) <= LATE_TURN_LIMIT;
}
