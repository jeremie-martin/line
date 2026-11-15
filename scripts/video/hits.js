// Measured hits on the ride clock. No canvas, song offset, theme or recipe registry here.
// Round 23: fire at the force peak; keep the direction of the line struck at onset.
import {FPS} from './timing.js';
import {smoothstep} from './camera.js';
import {strength} from './intensity.js';

/** Matched events in target order (validated by scene.ts), with a normal pointing toward the rider.
 * Use the first contact frame in onset − 2 … onset + 4, then its closest line. Missing geometry points up. */
export function prepareHits(account, contacts, centres, byId) {
  const matchOf = new Map(account?.matches.map(m => [m.target, m.event]));
  return (account?.targets ?? []).flatMap((_, i) => {
    if (!matchOf.has(i)) return [];
    const e = account.events[matchOf.get(i)], f0 = e.onset; let pos = null, nrm = {x: 0, y: -1}, best = Infinity;
    for (let f = f0 - 2; f <= f0 + 4 && !pos; f++) {
      const ids = contacts[f] ?? []; if (!ids.length) continue;
      const c = centres[Math.min(f, centres.length - 1)];
      for (const id of ids) {
        const l = byId.get(id); if (!l) continue;
        const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L2 = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L2));
        const p = {x: l.x1 + u * dx, y: l.y1 + u * dy}, d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < best) {
          best = d; pos = p;
          const L = Math.sqrt(L2) || 1; let nx = -dy / L, ny = dx / L;
          if (nx * (c.x - p.x) + ny * (c.y - p.y) < 0) {nx = -nx; ny = -ny;}
          nrm = {x: nx, y: ny};
        }
      }
    }
    return [{time: e.peak / FPS, strength: e.strength, energy: strength(e.strength), normal: nrm}];
  });
}

// Approved response (R26): split, colour boost, shake only on strong hits. Values keep growing above
// 0.85; the high caps are safety nets. The rejected flash and rider zoom are recorded in the lab, not options.
const ramp = (s, from, full) => (s - from) / (full - from);
// Quadratic start, continuing on its tangent above the reference strength.
const slowRise = s => {const x = ramp(s, 0.3, 0.85); return x <= 0 ? 0 : x <= 1 ? Math.pow(x, 2) : 1 + 2 * (x - 1);};
// px: nothing below 0.55, an S-curve to 28 px at 0.85, gently on (R26; earlier and higher since round 50: "from 0.55, as the boost")
export const shake = s => Math.min(48, s <= 0.85 ? 28 * smoothstep(ramp(s, 0.55, 0.85)) : 28 + 40 * (s - 0.85));
export const split = s => 16.8 * Math.min(3, 1.5 * slowRise(s)); // px before the direction's match: a slow start from 0.3 (R15), a fifth stronger since round 49
export const boost = s => 1.5 * Math.min(2, s <= 0.85 ? smoothstep(ramp(s, 0.35, 0.85)) : 1 + 1.5 * (s - 0.85)); // from 0.35, full ×1.5 at 0.85, gently on (R24–R26)

/** The response's settings per value of look.hits. v1 is production; in the lab (round 51) the band is lit for as long as a hit of
 * at least `lit` lasts (the owner: "from 0.65", "way better on all the dark themes"). */
export const TUNES = {v1: {}, lit65: {lit: 0.65}, still: {still: true},
  // under review (2026-11-15, the owner's settings on the hit movement page): half the shake, and carry
  carry: {shake: 0.5, carry: {start: 0.5, amount: 100, out: 0.07, back: 0.3}}};
TUNES.carryLit65 = {...TUNES.carry, lit: 0.65}; // for the dark themes whose band lights

// Carry: after a hit the picture moves out of the surface that was hit and settles back, as if the camera carried on for a
// moment when the rider was stopped. The shake knocks into the surface, fast; carry answers it, slower.
// c = {start: strength under which there is none; amount: px at strength 0.85; out, back: seconds out and settling back}.
/** px: nothing up to c.start, an S-curve to c.amount at 0.85, then growing as the shake does, at most 1.7 × c.amount. */
export function carryAmount(s, c) {
  if (s <= c.start) return 0;
  if (s <= 0.85) return c.amount * smoothstep(ramp(s, c.start, 0.85));
  return Math.min(1.7 * c.amount, c.amount * (1 + 40 / 28 * (s - 0.85)));
}
/** 0 at the hit, 1 at the peak (soon after c.out), back toward 0 over a few c.back. */
export function carryShape(age, c) {
  if (age <= 0 || age > 6 * c.back + 1) return 0;
  const out = Math.min(c.out, c.back * 0.9), f = t => Math.exp(-t / c.back) - Math.exp(-t / out);
  return f(age) / f(Math.log(c.back / out) * c.back * out / (c.back - out));
}
/** Every recent hit's carry along its surface normal (toward the rider), together at most 1.7 × c.amount. px, screen axes. */
export function carryAt(hits, time, c) {
  let x = 0, y = 0;
  for (const h of hits) {
    if (h.time > time) break;
    const a = carryAmount(h.strength, c) * carryShape(time - h.time, c);
    if (a) {x += a * h.normal.x; y += a * h.normal.y;}
  }
  const d = Math.hypot(x, y), cap = 1.7 * c.amount, k = d > cap ? cap / d : 1;
  return {x: x * k, y: y * k};
}

// Hold the peak for at least one 60 fps frame, then recover within 0.25 seconds.
function envelope(age, energy) {
  const weight = Math.pow(energy, 2.2), hold = (1 + 2 * weight) / 60, decay = 0.1 + 0.1 * weight;
  return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / decay), 2);
}

/** One live hit drives all three effects, chosen by strength × remaining envelope; never added together.
 * Output: shake dx/dy and split distance in 1080-wide design pixels, blow direction, colour boost amount.
 * Exaggeration is the lab's viewing aid; it changes amplitudes, never timing or the winning hit. */
export function hitEffectsAt(hits, time, exaggerate = 1, tune = TUNES.v1) {
  let best = 0, hit = null, amount = 0, age = 0;
  for (const h of hits) {
    if (h.time > time) break;
    const elapsed = time - h.time, env = envelope(elapsed, h.energy), score = env * (0.01 + h.strength);
    if (score > best) {best = score; hit = h; amount = env; age = elapsed;}
  }
  // carry outlasts the winning hit's envelope, so it is added whether or not a hit is live
  const carried = tune.carry ? carryAt(hits, time, tune.carry) : null, cx = carried ? carried.x * exaggerate : 0, cy = carried ? carried.y * exaggerate : 0;
  if (!hit) return {dx: cx, dy: cy, split: 0, direction: {x: 0, y: 0}, boost: 0, lit: false};
  const x = -hit.normal.x, y = -hit.normal.y;
  const a = amount < 0.002 || tune.still ? 0 : shake(hit.strength) * (tune.shake ?? 1) * exaggerate * amount * Math.cos(2 * Math.PI * 6 * age);
  return {dx: a * x + cx, dy: a * y + cy,
    split: amount <= 0.002 ? 0 : split(hit.strength) * exaggerate * amount,
    direction: {x, y},
    boost: amount < 0.003 ? 0 : boost(hit.strength) * exaggerate * amount,
    // lab: the band lights on hits above a strength, for as long as the hit's own effects last
    lit: !!tune.lit && hit.strength >= tune.lit && amount > 0.1};
}

/** The band's heat accumulates recent energy, unlike the single-hit visual response. */
export function hitHeatAt(hits, time) {
  let heat = 0;
  for (const h of hits) {if (h.time > time) break; heat += h.energy * Math.exp(-(time - h.time) / 0.8);}
  return heat;
}
