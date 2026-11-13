// Track geometry prepared once: rail membership, monotone ink times and a spatial index.
// Drawing never mutates the prepared track, so seeking and switching line modes need no replay.
import {W, H} from './camera.js';
import {mixHex} from './colour.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function prepareTrack(source, contacts, centres) {
  const lines = source.map(l => ({id: l.id, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, touchFrame: Infinity}));
  const byId = new Map(lines.map(l => [l.id, l]));
  contacts.forEach((ids, f) => {for (const id of ids) {const l = byId.get(id); if (l && f < l.touchFrame) l.touchFrame = f;}});
  // connected rails: a rail inks up to the furthest point touched so far, so a used rail is solid behind the rider
  {
    const parent = lines.map((_, i) => i), find = i => {while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i;};
    // segments whose ends touch or nearly touch (dotted rails are runs of short pieces a few units apart) form one rail
    const GAP = 6, cells = new Map(), cell = (x, y) => Math.floor(x / GAP) + ',' + Math.floor(y / GAP);
    lines.forEach((l, i) => {for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {const k = cell(x, y); if (!cells.has(k)) cells.set(k, []); cells.get(k).push([x, y, i]);}});
    lines.forEach((l, i) => {for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
      const gx = Math.floor(x / GAP), gy = Math.floor(y / GAP);
      for (let a = gx - 1; a <= gx + 1; a++) for (let b = gy - 1; b <= gy + 1; b++) for (const [px, py, j] of cells.get(a + ',' + b) ?? [])
        if (j !== i && (px - x) ** 2 + (py - y) ** 2 < GAP * GAP) parent[find(i)] = find(j);
    }});
    const chains = new Map(); lines.forEach((l, i) => {const r = find(i); if (!chains.has(r)) chains.set(r, []); chains.get(r).push(l);});
    // A rail inks as the rider passes it, not only where a contact was recorded: on five songs 8–17 % of the course stayed pencil
    // behind the rider, about 90 % of it within 14 units of the body, and a third of used rails ended in a grey tail.
    const cs = centres, reach = []; {let m = -Infinity; for (const c of cs) reach.push(m = Math.max(m, c.x));}
    const firstFrameAt = x => {let a = 0, b = reach.length - 1; while (a < b) {const c = (a + b) >> 1; if (reach[c] >= x) b = c; else a = c + 1;} return reach[a] >= x ? a : Infinity;};
    const riddenNear = l => {
      const dx = l.x2 - l.x1, dy = l.y2 - l.y1, lengthSquared = dx * dx + dy * dy || 1;
      const from = firstFrameAt(Math.min(l.x1, l.x2) - 30);
      const to = Math.min(cs.length - 1, firstFrameAt(Math.max(l.x1, l.x2) + 30));
      if (from === Infinity) return false;
      for (let f = from; f <= to; f++) {
        const c = cs[f], u = clamp(((c.x - l.x1) * dx + (c.y - l.y1) * dy) / lengthSquared, 0, 1);
        if (Math.hypot(c.x - l.x1 - u * dx, c.y - l.y1 - u * dy) < 14) return true;
      }
      return false;
    };
    for (const chain of chains.values()) {
      chain.sort((a, b) => (a.x1 + a.x2) - (b.x1 + b.x2));
      const used = chain.some(l => l.touchFrame < Infinity) || chain.some(riddenNear);
      let nextTouch = Infinity, firstInk = Infinity;
      for (let i = chain.length - 1; i >= 0; i--) {
        const l = chain[i];
        nextTouch = Math.min(nextTouch, l.touchFrame);
        l.inkFrame = used ? Math.min(nextTouch, firstFrameAt(Math.max(l.x1, l.x2))) : Infinity;
        firstInk = Math.min(firstInk, l.inkFrame);
      }
      for (const l of chain) l.railFrame = firstInk; // when the rider first reaches any part of this rail
    }
  }
  const G = 400, grid = new Map();
  for (const l of lines) {
    for (let gx = Math.floor(Math.min(l.x1, l.x2) / G); gx <= Math.floor(Math.max(l.x1, l.x2) / G); gx++)
      for (let gy = Math.floor(Math.min(l.y1, l.y2) / G); gy <= Math.floor(Math.max(l.y1, l.y2) / G); gy++) {
        const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(l);
      }
  }
  function visibleAt(c) {
    const z = c.z, x0 = c.x - c.ax / z - 40, x1 = c.x + (W - c.ax) / z + 40, y0 = c.y - c.ay / z - 40, y1 = c.y + (H - c.ay) / z + 40, out = [];
    const seen = new Set();
    for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++)
      for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++)
        for (const l of grid.get(gx + ',' + gy) ?? []) if (!seen.has(l)) {seen.add(l); out.push(l);}
    return out;
  }
  return {lines, byId, visibleAt};
}

// the course: the inked lines and (with pencil → ink or whole rail) the pencilled ones ahead; `part` draws one of the two
export function drawTrack(ctx, visible, at, z, colours, mode, over, part = 'all') {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = filter => {ctx.beginPath(); for (const l of visible) if (filter(l)) {ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);}};
  const ink = Math.max(2, 3.6 / z);
  if (mode === 'ink') {if (part !== 'pencil') {path(() => true); ctx.strokeStyle = colours.ink; ctx.lineWidth = ink; ctx.stroke();} return;}
  const done = mode === 'rail' ? l => l.railFrame <= at : l => l.inkFrame <= at;
  if (part !== 'ink') {path(l => !done(l)); ctx.strokeStyle = over > 0.02 ? mixHex(colours.pencil, colours.ink, 0.25 * over) : colours.pencil; ctx.lineWidth = Math.max(1.3, (3 + 1.4 * over) / z); ctx.stroke();}
  if (part !== 'pencil') {path(done); ctx.strokeStyle = colours.ink; ctx.lineWidth = ink; ctx.stroke();}
  // in the lab (round 48): the stretch ridden in the last quarter of a second stays in the accent
  if (mode === 'trail' && part !== 'pencil') {path(l => l.inkFrame <= at && l.inkFrame > at - 10); ctx.strokeStyle = colours.accent; ctx.lineWidth = ink * 1.25; ctx.stroke();}
}
