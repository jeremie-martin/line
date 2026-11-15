/** Readings of the ground the rider touches, for analysis (REWORK.md, November 15). Not used by the compiler.
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
