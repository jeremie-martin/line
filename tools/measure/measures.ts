/** Candidate impact measures, computed per authored beat on observed rides.
 * These are instruments for choosing a definition, not compiler objectives.
 *
 *   node --import tsx tools/measure/measures.ts      # writes generated/measure/beats.json + summary
 *
 * For each beat: the frozen landing impact (V6), line.contact-impact.v1, v1 with
 * the renewal fix (R1: a new strike needs a valley relative to the NEW peak only),
 * onset / peak / impulse-centroid timing, the 10-point external impulse (zero in
 * free flight, sees sled-only and body-only hits), clarity, and descriptive flags. */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {CONTACT_IMPACT_CONTRACT as C, accountContactImpacts, type ContactImpactEvent} from '../../scripts/lib/contact_impact.ts';
import {OUT} from './observe.ts';

const G = 0.175, FPS = 40, VERY_STRONG = 7.55;
type Obs = any;
type Frame = {frame: number; contact: boolean; bend: number; response: number};

/** detectContactImpacts with the renewal rule as a parameter. 'min' reproduces v1
 * exactly; 'new' compares the valley with the new peak only (audit fix R1). */
export function detectEvents(frames: Frame[], renewal: 'min' | 'new'): ContactImpactEvent[] {
  const events: ContactImpactEvent[] = [];
  for (let first = 0; first < frames.length;) {
    if (!frames[first].contact) {first++; continue;}
    let last = first;
    while (last + 1 < frames.length && frames[last + 1].contact) last++;
    const emit = (onset: number, contactStart: number) => {
      const end = Math.min(last, onset + C.responseFrames - 1);
      let raw = 0, peak = onset;
      for (let i = onset; i <= end; i++) {raw += frames[i].bend; if (frames[i].response > frames[peak].response) peak = i;}
      events.push({contactStart: frames[contactStart].frame, onset: frames[onset].frame, end: frames[end].frame,
        peakFrame: frames[peak].frame, raw, strength: Math.min(1, raw / C.veryStrong), responsePeak: frames[peak].response,
        complete: end - onset + 1 === C.responseFrames || last + 1 < frames.length});
      return {end, peak};
    };
    const leadingEnd = Math.min(last, first + C.responseFrames - 1);
    let peak = first;
    for (let i = first + 1; i <= leadingEnd; i++) if (frames[i].response > frames[peak].response) peak = i;
    let onset = first;
    while (onset < peak && frames[onset].response < C.onsetFraction * frames[peak].response) onset++;
    let prior = emit(onset, first), trough = prior.peak;
    for (let i = prior.peak + 1; i <= last; i++) {
      if (frames[i].response < frames[trough].response) trough = i;
      const value = frames[i].response;
      if (i <= prior.end || value <= 1e-9 || value < frames[i - 1].response || (i < last && value <= frames[i + 1].response)) continue;
      const reference = renewal === 'min' ? Math.min(frames[prior.peak].response, value) : value;
      if (frames[trough].response > C.renewalValley * reference) continue;
      let start = i;
      while (start > Math.max(prior.end + 1, trough + 1) && frames[start - 1].response >= C.onsetFraction * value) start--;
      prior = emit(start, first); trough = prior.peak; i = prior.peak;
    }
    first = last + 1;
  }
  return events;
}

/** Per-frame external impulse on the 10-point centre of mass (gravity removed):
 * exactly zero in free flight, so it sees every contact force including sled-only
 * and body-only hits. Also the largest single-point jolt. */
function impulses(o: Obs) {
  const n = o.frames.length, com: number[][] = [], jolt: number[] = new Array(n).fill(0), impulse: number[] = new Array(n).fill(0);
  for (const fr of o.frames) {
    let x = 0, y = 0;
    for (const [px, py, qx, qy] of fr.points) {x += px - qx; y += py - qy;}
    com.push([x / 10, y / 10]);
  }
  for (let f = 0; f + 1 < n; f++) {
    impulse[f] = Math.hypot(com[f + 1][0] - com[f][0], com[f + 1][1] - com[f][1] - G);
    let worst = 0;
    for (let p = 0; p < 10; p++) {
      const [a, b, c, d] = o.frames[f].points[p], [e, g, h, i] = o.frames[f + 1].points[p];
      worst = Math.max(worst, Math.hypot((e - h) - (a - c), (g - i) - (b - d) - G));
    }
    jolt[f] = worst;
  }
  return {impulse, jolt};
}

export function beatRows(o: Obs) {
  const frames: Frame[] = o.observed.map((r: number[], frame: number) => ({frame, contact: !!r[0], bend: r[1], response: r[2]}));
  const v1 = detectEvents(frames, 'min'), r1 = detectEvents(frames, 'new');
  const duration = o.durationFrames, targets = o.targets.map((t: any) => ({frame: t.frame, impact: t.impact}));
  const accV1 = accountContactImpacts(v1.filter(e => e.onset <= duration), targets);
  const r1Kept = r1.filter(e => e.onset <= duration), accR1 = accountContactImpacts(r1Kept, targets);
  const {impulse, jolt} = impulses(o);
  const covered = new Array(frames.length).fill(false);
  for (const e of r1) for (let f = e.onset; f <= e.end; f++) covered[f] = true;
  const rows = [];
  for (const [i, t] of targets.entries()) {
    const F = t.frame, prev = i ? targets[i - 1].frame : 0, next = i + 1 < targets.length ? targets[i + 1].frame : duration;
    const lo = Math.floor((prev + F) / 2), hi = Math.ceil((F + next) / 2);
    const landing = o.landings.filter((l: any) => l.type === 'landing' && Math.abs(l.frame - F) <= 2).sort((a: any, b: any) => Math.abs(a.frame - F) - Math.abs(b.frame - F))[0];
    const timing = (e: ContactImpactEvent | undefined) => {
      if (!e) return null;
      let peak = e.onset, sum = 0, weighted = 0;
      for (let f = e.onset; f <= e.end; f++) {if (frames[f].bend > frames[peak].bend) peak = f; sum += frames[f].bend; weighted += f * frames[f].bend;}
      const front = (frames[e.onset]?.bend ?? 0) + (frames[e.onset + 1]?.bend ?? 0);
      return {onset: e.onset - F, peak: peak - F, centroid: sum ? weighted / sum - F : null, frontShare: e.raw ? front / e.raw : null, strength: e.strength};
    };
    const matched = (acc: any, events: ContactImpactEvent[]) => {const m = acc.matches.find((m: any) => m.target === i); return m ? events[m.event] : undefined;};
    const m1 = matched(accV1, v1), mR = matched(accR1, r1Kept);
    // Window around the beat for the hit itself, and the half-gaps around it for competitors.
    const near = [F - 2, F + 6], max = (a: number, b: number) => {let w = 0, at = -1; for (let f = Math.max(0, a); f <= Math.min(impulse.length - 1, b); f++) if (impulse[f] > w) {w = impulse[f]; at = f;} return {w, at};};
    const hit = max(near[0], near[1]), before = max(lo, near[0] - 1), after = max(near[1] + 1, hi);
    const competitor = Math.max(before.w, after.w);
    const extrasR1 = r1Kept.filter((e, k) => accR1.unmatchedEvents.includes(k) && e.onset >= lo && e.onset < hi);
    let hidden = 0;
    for (let f = lo; f < hi; f++) if (frames[f]?.contact && !covered[f]) hidden += frames[f].bend;
    const window = m1 ?? mR;
    const contactPoints = new Set<number>();
    if (window) for (let f = window.onset; f <= window.end; f++) for (const [, p] of o.frames[f]?.collisions ?? []) contactPoints.add(p);
    const pts = o.frames[Math.max(0, F)]?.points, axis = pts ? [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]] : [1, 0];
    const vel = o.frames[Math.max(0, F)]?.v ?? [1, 0];
    rows.push({source: o.id, set: o.set, song: o.song, seed: o.seed, beat: i, frame: F, t: o.targets[i].t, requested: t.impact ?? null,
      frozen: landing?.raw == null ? null : Math.min(1, landing.raw / VERY_STRONG), frozenLanding: landing ? landing.frame - F : null,
      v1: timing(m1), r1: timing(mR),
      impulse: {hit: hit.w, at: hit.at < 0 ? null : hit.at - F, competitor, clarity: competitor > 1e-9 ? hit.w / competitor : null, maxJolt: Math.max(...jolt.slice(Math.max(0, near[0]), near[1] + 1))},
      extrasR1: extrasR1.map(e => ({onset: e.onset - F, strength: e.strength})), hiddenBend: hidden,
      sledInHit: [...contactPoints].some(p => p < 4), bodyOnlyHit: contactPoints.size > 0 && [...contactPoints].every(p => p >= 4),
      backward: axis[0] * vel[0] + axis[1] * vel[1] < 0});
  }
  return rows;
}

if (import.meta.filename === process.argv[1]) {
  const rows = [];
  for (const file of readdirSync(OUT).filter(f => f.endsWith('.json.gz')))
    rows.push(...beatRows(JSON.parse(gunzipSync(readFileSync(join(OUT, file))).toString())));
  writeFileSync('generated/measure/beats.json', JSON.stringify(rows));
  const quantile = (xs: number[], q: number) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;};
  const ms = (x: number) => (x * 1000 / FPS).toFixed(0);
  console.log('set           beats  peak-late med/p90 ms  centroid med  onset med  contested strong  extras>=.25/beat  hidden bend/beat  |r1-req| strong');
  for (const set of ['july', 'current', 'experimental']) {
    const s = rows.filter(r => r.set === set), strong = s.filter(r => (r.requested ?? 0) >= .6);
    const peaks = s.map(r => r.r1?.peak).filter((x): x is number => x != null);
    console.log(set.padEnd(13), String(s.length).padStart(5),
      `${ms(quantile(peaks, .5))}/${ms(quantile(peaks, .9))}`.padStart(16),
      ms(quantile(s.map(r => r.r1?.centroid ?? NaN), .5)).padStart(12),
      ms(quantile(s.map(r => r.r1?.onset ?? NaN), .5)).padStart(10),
      (strong.filter(r => r.impulse.competitor >= .5 * r.impulse.hit).length / strong.length).toFixed(2).padStart(16),
      (s.reduce((n, r) => n + r.extrasR1.filter(e => e.strength >= .25).length, 0) / s.length).toFixed(2).padStart(17),
      (s.reduce((n, r) => n + r.hiddenBend, 0) / s.length).toFixed(2).padStart(17),
      quantile(strong.map(r => r.r1 ? Math.abs(r.r1.strength - r.requested) : NaN), .5).toFixed(3).padStart(16));
  }
}
