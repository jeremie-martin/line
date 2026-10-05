/** Candidate impact strength (research; the product account line.strike.v2/v3 adopted it):
 * how much contact changes the rider's whole-body motion, its travel (centre of
 * mass velocity, direction and speed) and its spin (angular momentum about the
 * centre of mass), over a short window.
 *
 * Per frame, the contact impulse is the vector (ΔV − g, ΔL / (N·R)): ΔV is the
 * change of the centre-of-mass velocity, ΔL the change of angular momentum
 * Σ r × v over the N = 10 points, and R the radius of gyration, so the spin part
 * is in the same px/frame units. Both are zero in free flight, up to the
 * solver's sequential-correction residual (median 0.003 px/frame, at most about
 * 0.3, against about 0.2 typical and 1.5 peak in contact).
 *
 * For each strike event (identity and timing from scripts/lib/strike_impact.ts),
 * over the event's own frames from onset (at most 6; before 2026-10-04 evening the
 * window ignored the event's end and could count the next landing, which affected
 * 741 of 4,130 events, including the values shown in impact-pairs-2026-10 and -10b):
 *   strength  = the largest |impulse summed over a WINDOW-frame span| in the
 *               event, ÷ 7.55 like the strike account;
 *   travel    = the same without the spin part;
 *   whole     = |impulse summed over the whole event (≤ 6 frames)| ÷ 7.55;
 *   sharpness = strength / whole (1: everything happened within the window).
 *
 *   node --import tsx tools/measure/motion_change.ts [--sets=july,current,strike] [--out=FILE.jsonl] */
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {OUT} from './observe.ts';
import {strikeFrames, detectStrikes} from './strike.ts';

const G = 0.175, VERY_STRONG = 7.55, N = 10;
export const WINDOW = 2;

type Impulse = {x: number; y: number; s: number};
/** Per-frame contact impulse of the whole body; index f holds the change from f−1 to f. */
export function bodyImpulses(o: any): Impulse[] {
  const state = (f: number) => {
    const P = o.frames[f].points; let cx = 0, cy = 0, vx = 0, vy = 0;
    for (const [x, y, px, py] of P) {cx += x; cy += y; vx += x - px; vy += y - py;}
    cx /= N; cy /= N; vx /= N; vy /= N;
    let L = 0, R2 = 0;
    for (const [x, y, px, py] of P) {const rx = x - cx, ry = y - cy; L += rx * (y - py - vy) - ry * (x - px - vx); R2 += rx * rx + ry * ry;}
    return {vx, vy, L, R: Math.sqrt(R2 / N)};
  };
  const out: Impulse[] = [{x: 0, y: 0, s: 0}];
  let prev = state(0);
  for (let f = 1; f < o.frames.length; f++) {
    const cur = state(f);
    out.push({x: cur.vx - prev.vx, y: cur.vy - prev.vy - G, s: (cur.L - prev.L) / (N * (cur.R + prev.R) / 2)});
    prev = cur;
  }
  return out;
}

const size = (a: Impulse, spin = true) => Math.hypot(a.x, a.y, spin ? a.s : 0);
const sum = (xs: Impulse[]) => xs.reduce((t, a) => ({x: t.x + a.x, y: t.y + a.y, s: t.s + a.s}), {x: 0, y: 0, s: 0});

export type Change = {onset: number; peak: number; strike: number; strength: number; travel: number; whole: number; sharpness: number; spinShare: number};
/** Candidate strength for every strike event of an observation. */
export function motionChanges(o: any): Change[] {
  const imp = bodyImpulses(o), events = detectStrikes(strikeFrames(o));
  return events.map((e: any) => {
    // The event's own frames only (at most 6 from onset): a later landing must not
    // count toward this one. A 1-frame event is its own window.
    const from = Math.max(1, e.onset), to = Math.min(imp.length - 1, e.onset + 5, e.end);
    let best = {x: 0, y: 0, s: 0}, bestTravel = 0, at = from;
    for (let a = from; a + Math.min(WINDOW, to - from + 1) - 1 <= to; a++) {
      const w = sum(imp.slice(a, a + Math.min(WINDOW, to - from + 1)));
      if (size(w) > size(best)) {best = w; at = a;}
      bestTravel = Math.max(bestTravel, size(w, false));
    }
    const whole = sum(imp.slice(from, to + 1)), strength = size(best) / VERY_STRONG;
    return {onset: e.onset, peak: at, strike: e.strength, strength, travel: bestTravel / VERY_STRONG,
      whole: size(whole) / VERY_STRONG, sharpness: size(whole) > 1e-9 ? Math.min(1, size(best) / size(whole)) : 1,
      spinShare: size(best) > 1e-9 ? Math.abs(best.s) / size(best) : 0};
  });
}

if (import.meta.filename === process.argv[1]) {
  const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const sets = arg('sets', 'july,current,strike').split(','), outPath = arg('out', '');
  const index = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')).filter((r: any) => sets.includes(r.set));
  const rows: any[] = [];
  for (const r of index) {
    const o = JSON.parse(gunzipSync(readFileSync(join(OUT, r.id + '.json.gz'))).toString());
    for (const c of motionChanges(o)) rows.push({id: r.id, set: r.set, song: r.song, seed: r.seed, ...c});
  }
  const strong = rows.filter(r => r.strike >= .1);
  const rank = (x: number[]) => {const s = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), out = new Array(x.length);
    for (let a = 0; a < s.length;) {let b = a; while (b + 1 < s.length && s[b + 1][0] === s[a][0]) b++; for (let k = a; k <= b; k++) out[s[k][1]] = (a + b) / 2; a = b + 1;} return out;};
  const corr = (x: number[], y: number[]) => {const mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length; let n = 0, a = 0, b = 0;
    for (let i = 0; i < x.length; i++) {n += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2;} return n / Math.sqrt(a * b);};
  const sp = (k: string) => corr(rank(strong.map(r => r.strike)), rank(strong.map(r => r[k])));
  console.log(`events ${rows.length}, with strike >= 0.1: ${strong.length}`);
  console.log(`rank agreement with strike:  candidate ${sp('strength').toFixed(3)}  travel-only ${sp('travel').toFixed(3)}  whole-event ${sp('whole').toFixed(3)}`);
  const q = (xs: number[], p: number) => {const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))];};
  for (const set of sets) {
    const s = strong.filter(r => r.set === set);
    console.log(`${set.padEnd(8)} n ${String(s.length).padStart(4)}  median strike ${q(s.map(r => r.strike), .5).toFixed(2)}  candidate ${q(s.map(r => r.strength), .5).toFixed(2)}  sharpness ${q(s.map(r => r.sharpness), .5).toFixed(2)}  spin share ${q(s.map(r => r.spinShare), .5).toFixed(2)}`);
  }
  if (outPath) writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  process.exit(0);
}
