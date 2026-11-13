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
// px: nothing below `from` (0.6), an S-curve to 24 px at `full` (0.85), gently on (R26)
export const shake = (s, from = 0.6, full = 0.85) => Math.min(48, s <= full ? 24 * smoothstep(ramp(s, from, full)) : 24 + 40 * (s - full));
export const split = s => 14 * Math.min(3, 1.5 * slowRise(s)); // px before the direction's match: a slow start from 0.3 (R15)
export const boost = s => 1.5 * Math.min(2, s <= 0.85 ? smoothstep(ramp(s, 0.35, 0.85)) : 1 + 1.5 * (s - 0.85)); // from 0.35, full ×1.5 at 0.85, gently on (R24–R26)

/** The response's settings per value of look.hits. v1 is production; the others are in the lab (round 49): the split a quarter
 * stronger; the shake starting a little later (`from`, `full`: the strengths where it starts and reaches 24 px); shakes spaced
 * (seconds); the band lit on hits of at least `lit`. */
export const TUNES = {
  v1: {},
  split125: {split: 1.25},
  shakeLater: {from: 0.63, full: 0.88},
  shakeLatest: {from: 0.66, full: 0.91},
  shakeSpaced: {spaced: 1},
  tuned: {split: 1.25, spaced: 1},
  lit: {lit: 0.8},
  litOften: {lit: 0.6},
};

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
  if (!hit) return {dx: 0, dy: 0, split: 0, direction: {x: 0, y: 0}, boost: 0, lit: false};
  const x = -hit.normal.x, y = -hit.normal.y;
  // spaced (lab): a shake that follows, within `spaced` seconds, another at least three quarters its size is reduced in proportion
  // to the gap, never below a quarter: a run of like hits is calmed, a hit stronger than the ones before it keeps its shake
  let room = 1;
  if (tune.spaced) {
    const own = shake(hit.strength, tune.from, tune.full);
    for (const h of hits) {
      if (h.time >= hit.time) break;
      if (shake(h.strength, tune.from, tune.full) >= Math.max(4, 0.75 * own)) room = Math.max(0.25, Math.min(1, (hit.time - h.time) / tune.spaced));
    }
  }
  const a = amount < 0.002 ? 0 : shake(hit.strength, tune.from, tune.full) * room * exaggerate * amount * Math.cos(2 * Math.PI * 6 * age);
  return {dx: a * x, dy: a * y,
    split: amount <= 0.002 ? 0 : split(hit.strength) * (tune.split ?? 1) * exaggerate * amount,
    direction: {x, y},
    boost: amount < 0.003 ? 0 : boost(hit.strength) * exaggerate * amount,
    // lab: the band lights on the strongest hits only, for as long as the hit's own effects last
    lit: !!tune.lit && hit.strength >= tune.lit && amount > 0.1};
}

/** The band's heat accumulates recent energy, unlike the single-hit visual response. */
export function hitHeatAt(hits, time) {
  let heat = 0;
  for (const h of hits) {if (h.time > time) break; heat += h.energy * Math.exp(-(time - h.time) / 0.8);}
  return heat;
}
