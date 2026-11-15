// The colour split under study: which way red and blue move apart at a hit, and how far, by measured strength. It replaces
// only the split's `split` and `direction` in the picture's hit effects; production's split.js draws it. Pure: no DOM.
import {split as todaySplit} from '../../scripts/video/hits.js';

/** dir: one of DIRECTIONS; swap: 1 puts red where blue would be; size: multiple of today's curve; start: strength under which
 * there is no split (today 0.3). */
export const SPLIT_DEFAULT = Object.freeze({dir: 'today', swap: 0, size: 1, start: 0.3});
export const DIRECTIONS = Object.freeze(['today', 'into', 'out', 'outHalf', 'side', 'travel', 'turn']);
/** split.js moves each colour HALF × split px (its constant, copied for the charts). */
export const HALF = 0.61;
/** "Into, then out": red into the surface for the shake's first knock (a quarter of its 6 Hz swing), out of it after. s */
export const KNOCK = 1 / 24;

const sg = x => x < 0 ? -1 : 1; // split.js's sideways side: right when the blow is straight down
const unit = (x, y) => {const n = Math.hypot(x, y) || 1; return {x: x / n, y: y / n};};
const ramp = (s, from, full) => (s - from) / (full - from);

/** px before split.js's HALF: today's curve (hits.js `split`) with its start moved, times p.size. */
export function splitAmount(s, p = SPLIT_DEFAULT) {
  const x = ramp(s, p.start, 0.85), rise = x <= 0 ? 0 : x <= 1 ? x * x : 1 + 2 * (x - 1);
  return p.size * 16.8 * Math.min(3, 1.5 * rise);
}

/** Unit vector (screen axes, y down) on which red lies, before the swap. normal: the surface's normal toward the rider (out of
 * the surface); age: s since the hit; travel: the rider's unit direction of travel before the hit, if known. */
export function redSide(dir, normal, age = 0, travel = null) {
  const b = {x: -normal.x, y: -normal.y}, side = sg(b.x);
  switch (dir) {
    case 'into': return unit(b.x, b.y);
    case 'out': return unit(normal.x, normal.y);
    case 'outHalf': return unit(side + normal.x, normal.y); // today's sideways, out of the surface instead of into it
    case 'side': return {x: side, y: 0};
    case 'travel': return travel && Math.hypot(travel.x, travel.y) > 1e-9 ? unit(travel.x, travel.y) : unit(b.x, b.y);
    case 'turn': return age < KNOCK ? unit(b.x, b.y) : unit(normal.x, normal.y);
    default: return unit(b.x + side, b.y); // today: halfway between sideways and the blow
  }
}

/** split.js turns fx.direction d into the red offset ∝ (d.x + sign d.x, d.y). This returns a d whose offset points along the
 * unit vector u, to within a millionth of a radian (an offset with no sideways part cannot be met exactly). */
export function directionFor(u) {
  const L = 1e6, hx = L * u.x;
  return {x: hx >= 1 ? hx - 1 : hx < -1 ? hx + 1 : 0, y: L * u.y};
}
/** What split.js does with fx.direction: the unit vector on which red lies. */
export function offsetOf(d) {
  return unit(d.x + sg(d.x), d.y);
}

// hits.js's envelope and choice of hit, copied so the page knows which hit is live and how old it is (the test holds them equal).
function envelope(age, energy) {
  const weight = Math.pow(energy, 2.2), hold = (1 + 2 * weight) / 60, decay = 0.1 + 0.1 * weight;
  return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / decay), 2);
}
/** {split, direction} for the picture's hit effects at ride time `time` (s). travelOf(hit) gives the rider's unit travel. */
export function splitAt(hits, time, p = SPLIT_DEFAULT, travelOf = null, exaggerate = 1) {
  let best = 0, hit = null, amount = 0, age = 0;
  for (const h of hits) {
    if (h.time > time) break;
    const elapsed = time - h.time, env = envelope(elapsed, h.energy), score = env * (0.01 + h.strength);
    if (score > best) {best = score; hit = h; amount = env; age = elapsed;}
  }
  if (!hit) return {split: 0, direction: {x: 0, y: 0}};
  const split = amount <= 0.002 ? 0 : splitAmount(hit.strength, p) * exaggerate * amount;
  if (p.dir === 'today' && !p.swap) return {split, direction: {x: -hit.normal.x, y: -hit.normal.y}}; // exactly production
  const u = redSide(p.dir, hit.normal, age, p.dir === 'travel' ? travelOf?.(hit) : null);
  return {split, direction: directionFor(p.swap ? {x: -u.x, y: -u.y} : u)};
}

/** The rider's unit direction of travel just before ride time `time` (s): frames 8 to 3 before it. centres: per frame {x, y}. */
export function travelBefore(centres, time, fps) {
  const f = Math.round(time * fps), a = centres[Math.max(0, f - 8)], b = centres[Math.max(0, Math.min(centres.length - 1, f - 3))];
  if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) return null;
  return unit(b.x - a.x, b.y - a.y);
}

export {todaySplit};
