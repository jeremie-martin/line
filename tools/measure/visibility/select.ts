/** Impact-visibility study, step 2: choose the pairs from measured values only
 * (tools/measure/visibility/observe_heldout.ts output), with a recorded seed. No
 * clip is looked at. Writes the study key (every pair's measured values) to
 * labels/studies/<study>.key.json.
 *
 *   node --import tsx tools/measure/visibility/select.ts --observations=FILE.json.gz \
 *       --study=<id> [--seed=20261031]
 *
 * Block A (visibility): a lit moment against a lit blank (plain riding).
 *   D1–D3  unmatched v3 events of 0.05–0.10, 0.10–0.20, 0.20–0.35, light on the onset;
 *   D4–D5  a force maximum outside every event, ≥ 0.3, after a quiet touchdown in the
 *          same contact; light on its strongest 2-frame window. D4: the contact ends
 *          within 2 frames after it (a launch); D5: the contact continues.
 *   anchor a requested hit ≥ 0.5, clean (rule R below).
 * Block R (strength resolution): two clean requested hits at a controlled v3 ratio.
 * Rules are the constants below; docs/research/impact-visibility-study-20261031.md
 * states them in words. */
import {readFileSync, writeFileSync, existsSync, readdirSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study')!, seed0 = Number(arg('seed', '20261031'));
assert.match(study, /^[a-z0-9-]+$/);
const keyPath = `labels/studies/${study}.key.json`;
assert.ok(!existsSync(keyPath), 'key exists; use a fresh study id');
const obs = JSON.parse(gunzipSync(readFileSync(arg('observations')!)).toString());
assert.equal(obs.contract, 'line.strike.v3');

let seed = seed0;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = <T>(xs: T[]) => {const a = [...xs]; for (let i = a.length - 1; i > 0; i--) {const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];} return a;};

// ---- rules (frames are 1/40 s; the light is on from −2 to +4.8 frames, motion-gallery/pairs.js)
const CLIP = {first: 48, beforeEnd: 40, apart: 72};    // judged frame range; distinct clips in one ride
const ISO = [-4, 8];                                    // window around a lit moment that must hold nothing else
const BLANK = {onset: [-4, 8], frames: [-3, 6], contact: [-2, 5], change: [-3, 6], maxChange: .05, beat: 4};
const EXTRA = {D1: [.05, .10], D2: [.10, .20], D3: [.20, .35], beat: 4, otherEvent: .05};
const PUSH = {min: .3, quiet: .15, lag: 4, launchWithin: 2};
const CLEAN = {window: [-8, 8], otherEvent: .1, outsidePush: .1, maxPitch: 90};
const ANCHOR = .5;
const N = {D1: 6, D2: 6, D3: 6, D4: 6, D5: 6, anchor: 4, R: 3};
const BASES: Array<[string, number, number]> = [['0.25', .20, .30], ['0.5', .43, .53]];
const RATIOS = [1.25, 1.5, 2, 3], RATIO_TOL = 1.05;     // accepted ratio: target ÷ 1.05 … target × 1.05
const CELLS = BASES.flatMap(([base, lo, hi]) => RATIOS.filter(r => lo * r / RATIO_TOL < 1).map(r => ({base, lo, hi, ratio: r})));

// ---- sources: only the held-out seeds, never Trouble, never a ride named by an earlier study or report
const earlier = readdirSync('labels/studies').filter(f => f.endsWith('.key.json')).map(f => readFileSync(`labels/studies/${f}`, 'utf8'))
  .concat(['docs/research/unwanted-impacts-20261030.json', 'docs/research/u1-measure-study-20261031.json', 'docs/research/measure-step-back-20261031.json']
    .map(p => readFileSync(p, 'utf8')));
for (const r of obs.rides) {
  assert.ok(r.seed >= 9101 && r.seed <= 9124 && r.song !== 'trouble_50s', `${r.ride} is not a held-out ride`);
  assert.ok(r.valid, `${r.ride} is not a valid compile`);
  for (const text of earlier) assert.ok(!text.includes(`${r.song}~${r.seed}`) && !text.includes(`${r.song}-${r.seed}`) &&
    !new RegExp(`"seed":\\s*${r.seed}\\b`).test(text), `${r.ride} appears in an earlier study or report`);
}

type Moment = {ride: any; frame: number; group: string; role: string; [k: string]: any};
const beatsNear = (r: any, j: number, w: number) => r.targets.filter((t: any) => Math.abs(t.frame - j) <= w).map((t: any) => ({dt: t.frame - j, ask: t.impact ?? null}));
const inClip = (r: any, j: number) => j >= CLIP.first && j <= r.D - CLIP.beforeEnd;
const contactAll = (r: any, a: number, b: number) => {for (let f = a; f <= b; f++) if (r.contact[f] !== '1') return false; return true;};
// Largest 2-frame change on contact frames outside every event, starting in [a, b].
const outsidePush = (r: any, a: number, b: number) => {
  let m = 0;
  for (let f = Math.max(0, a); f <= Math.min(r.change.length - 2, b); f++)
    if (r.contact[f] === '1' && r.contact[f + 1] === '1' && r.inEvent[f] === '0' && r.inEvent[f + 1] === '0') m = Math.max(m, r.change[f]);
  return m;
};
const maxChange = (r: any, a: number, b: number) => Math.max(...r.change.slice(Math.max(0, a), b + 1));
const others = (r: any, j: number, lo: number, hi: number, min: number, except?: any) =>
  r.events.filter((e: any) => e !== except && e.onset - j >= lo && e.onset - j <= hi && e.strength >= min);
// What else the viewer sees near the light: strongest event 12 frames before and 8 after (onsets), for the key.
const surroundings = (r: any, j: number, self?: any) => {
  const near = (lo: number, hi: number) => r.events.filter((e: any) => e !== self && e.onset - j >= lo && e.onset - j <= hi)
    .reduce((b: any, e: any) => !b || e.strength > b.strength ? e : b, null);
  const b = near(-12, -1), a = near(1, 8);
  return {strongestBefore12: b ? {dt: b.onset - j, v3: +b.strength.toFixed(3)} : null, strongestAfter8: a ? {dt: a.onset - j, v3: +a.strength.toFixed(3)} : null,
    maxChangeLit: +maxChange(r, j - 2, j + 4).toFixed(3), outsidePushIso: +outsidePush(r, j + ISO[0], j + ISO[1]).toFixed(3), beatsWithin6: beatsNear(r, j, 6)};
};
const eventFields = (e: any) => ({v3: +e.strength.toFixed(4), kind: e.kind, contactStart: e.contactStart, onset: e.onset, peak: e.peak, end: e.end,
  matchedAsk: e.ask, pitchAtContact: e.pitchAtContact, bodyFirst: e.bodyFirst, firstPoints: e.firstPoints});
const clean = (r: any, e: any) => e.matched !== null && e.strength < 1 && Math.abs(e.pitchAtContact) <= CLEAN.maxPitch && !e.bodyFirst &&
  inClip(r, e.onset) && others(r, e.onset, CLEAN.window[0], CLEAN.window[1], CLEAN.otherEvent, e).length === 0 &&
  outsidePush(r, e.onset + CLEAN.window[0], e.onset + CLEAN.window[1]) < CLEAN.outsidePush;

// ---- pools
const pools: Record<string, Moment[]> = {D1: [], D2: [], D3: [], D4: [], D5: [], anchor: [], blank: [], clean: []};
for (const r of obs.rides) {
  for (const e of r.events) {
    const j = e.onset;
    if (!inClip(r, j)) continue;
    if (e.matched === null) {
      const g = (Object.keys(EXTRA) as string[]).find(k => k.startsWith('D') && e.strength >= (EXTRA as any)[k][0] &&
        (k === 'D3' ? e.strength <= (EXTRA as any)[k][1] : e.strength < (EXTRA as any)[k][1]));
      if (g && !beatsNear(r, j, EXTRA.beat).length && !others(r, j, ISO[0], ISO[1], EXTRA.otherEvent, e).length &&
        outsidePush(r, j + ISO[0], j + ISO[1]) < e.strength)
        pools[g].push({ride: r, frame: j, group: g, role: 'event', value: e.strength, measured: {what: 'unmatched v3 event', ...eventFields(e), ...surroundings(r, j, e)}});
    } else if (clean(r, e)) {
      const m = {ride: r, frame: j, group: 'clean', role: 'hit', value: e.strength, measured: {what: 'requested hit (matched v3 event)', ...eventFields(e), ...surroundings(r, j, e)}};
      pools.clean.push(m);
      if (e.strength >= ANCHOR) pools.anchor.push({...m, group: 'anchor', role: 'event'});
    }
  }
  for (const p of r.pushes) {
    if (p.owner === null) continue;
    const o = r.events[p.owner], a = p.window;
    if (p.strength < PUSH.min || o.kind !== 'touchdown' || o.strength > PUSH.quiet || o.contactStart !== p.engagementStart ||
      p.frame - o.contactStart < PUSH.lag || o.onset > a - 3 || !inClip(r, a) || others(r, a, ISO[0], ISO[1], 0, o).length) continue;
    const g = p.engagementEnd - (a + 1) <= PUSH.launchWithin ? 'D4' : 'D5';
    pools[g].push({ride: r, frame: a, group: g, role: 'event', value: p.strength, measured: {what: g === 'D4' ? 'launch push after a quiet touchdown' : 'push within a continuing contact after a quiet touchdown',
      v3: 0, pushStrength: +p.strength.toFixed(4), pushMaxFrame: p.frame, reason: p.reason, contactEndsAfterWindow: p.engagementEnd - (a + 1),
      touchdown: {v3: +o.strength.toFixed(4), contactStart: o.contactStart, onset: o.onset, matchedAsk: o.ask, lagFrames: p.frame - o.contactStart}, body: p.body,
      ...surroundings(r, a)}});
  }
  for (let b = CLIP.first; b <= r.D - CLIP.beforeEnd; b++) {
    if (!contactAll(r, b + BLANK.contact[0], b + BLANK.contact[1]) || beatsNear(r, b, BLANK.beat).length) continue;
    if (r.events.some((e: any) => e.onset - b >= BLANK.onset[0] && e.onset - b <= BLANK.onset[1])) continue;
    if (r.events.some((e: any) => e.contactStart <= b + BLANK.frames[1] && e.end >= b + BLANK.frames[0])) continue;
    if (maxChange(r, b + BLANK.change[0], b + BLANK.change[1]) >= BLANK.maxChange) continue;
    pools.blank.push({ride: r, frame: b, group: 'blank', role: 'blank', value: 0, measured: {what: 'blank: plain riding, nothing at the light', v3: 0,
      maxChangeWindow: +maxChange(r, b + BLANK.change[0], b + BLANK.change[1]).toFixed(3), ...surroundings(r, b)}});
  }
}

// ---- selection
const chosen: Moment[] = [];
const distinct = (m: Moment) => chosen.every(c => c.ride !== m.ride || Math.abs(c.frame - m.frame) >= CLIP.apart);
const take = (m: Moment) => {chosen.push(m); return m;};
const pickBlank = (song: string) => {
  const free = shuffle(pools.blank).filter(distinct);
  return take(free.find(b => b.ride.song === song) ?? free[0] ?? (() => {throw new Error('out of blanks');})());
};
const pairs: any[] = [];
for (const g of ['D5', 'D3', 'anchor', 'D4', 'D2', 'D1']) {
  const perSong = new Map<string, number>(), rides = new Set<any>(), cap = Math.ceil(N[g as keyof typeof N] / 4);
  for (const m of shuffle(pools[g])) {
    if (pairs.filter(p => p.group === g).length >= N[g as keyof typeof N]) break;
    if (rides.has(m.ride) || (perSong.get(m.ride.song) ?? 0) >= cap || !distinct(m)) continue;
    take(m); rides.add(m.ride); perSong.set(m.ride.song, (perSong.get(m.ride.song) ?? 0) + 1);
    pairs.push({block: 'A', group: g, x: m, y: pickBlank(m.ride.song)});
  }
  assert.equal(pairs.filter(p => p.group === g).length, N[g as keyof typeof N], `not enough ${g} candidates (${pools[g].length})`);
}
const rRides = new Set<any>();
for (const c of CELLS) for (let k = 0; k < N.R; k++) {
  let done = false;
  for (const s of shuffle(pools.clean.filter(m => m.value >= c.lo && m.value <= c.hi))) {
    if (rRides.has(s.ride) || !distinct(s)) continue;
    const big = shuffle(pools.clean.filter(m => m.ride !== s.ride && !rRides.has(m.ride) && m.value / s.value >= c.ratio / RATIO_TOL &&
      m.value / s.value <= c.ratio * RATIO_TOL)).find(m => distinct(m) && chosen.every(x => x !== m));
    if (!big) continue;
    take(s); take(big); rRides.add(s.ride); rRides.add(big.ride);
    pairs.push({block: 'R', group: `R base ${c.base} × ${c.ratio}`, base: c.base, ratio: c.ratio, x: {...big, role: 'larger'}, y: {...s, role: 'smaller'}});
    done = true; break;
  }
  assert.ok(done, `no pair for cell ${c.base} × ${c.ratio}`);
}

// ---- key: shuffled order across blocks, random sides
// Each ride's track is preserved in labels/studies/sources (the held-out compiles live in another worktree).
const sourceOf = (r: any) => `labels/studies/sources/heldout~${r.song}~${r.seed}.track.json.gz`;
const side = (m: Moment) => ({song: m.ride.song, seed: m.ride.seed, ride: m.ride.ride, frame: m.frame, role: m.role, source: sourceOf(m.ride),
  compiled: m.ride.origin.slice(m.ride.origin.indexOf('generated/')), productionSha256: m.ride.productionSha256, trackSha256: m.ride.trackSha256, ...m.measured});
const key = shuffle(pairs).map((p, n) => {
  const flip = rnd() < .5, left = flip ? p.y : p.x, right = flip ? p.x : p.y;
  return {pair: n + 1, block: p.block, group: p.group, ...(p.block === 'R' ? {base: p.base, ratio: p.ratio,
    measuredRatio: +(p.x.value / p.y.value).toFixed(3)} : {}),
  [p.block === 'A' ? 'eventSide' : 'largerSide']: flip ? 'right' : 'left', left: side(left), right: side(right)};
});
writeFileSync(keyPath, JSON.stringify(key, null, 1) + '\n');
const index = JSON.parse(readFileSync('labels/studies/sources/index.json', 'utf8'));
for (const r of new Set(pairs.flatMap(p => [p.x.ride, p.y.ride]))) {
  const track = JSON.parse(readFileSync(r.origin, 'utf8')).track, text = JSON.stringify(track);
  assert.equal(createHash('sha256').update(text).digest('hex'), r.trackSha256, `${r.ride}: track changed since it was measured`);
  const id = `heldout~${r.song}~${r.seed}`;
  if (!existsSync(sourceOf(r))) writeFileSync(sourceOf(r), gzipSync(text, {level: 9}));
  if (!index.some((x: any) => x.id === id)) index.push({id, origin: `${r.origin.slice(r.origin.indexOf('generated/'))} (branch worktree-agent-a1f12a7790eda8a3d, compiled at 475ad6bf)`});
}
writeFileSync('labels/studies/sources/index.json', JSON.stringify(index, null, 1) + '\n');
const summary = {study, seed: seed0, poolSizes: Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length])),
  pairs: key.length, byGroup: Object.fromEntries([...new Set(key.map(k => k.group))].map(g => [g, key.filter(k => k.group === g).length])),
  rides: new Set(key.flatMap(k => [k.left.ride, k.right.ride])).size};
console.log(JSON.stringify(summary, null, 1));
for (const k of key) console.log(k.pair, k.group, '| L', k.left.ride, k.left.frame, k.left.role, (k.left as any).v3 ?? '', (k.left as any).pushStrength ?? '',
  '| R', k.right.ride, k.right.frame, k.right.role, (k.right as any).v3 ?? '', (k.right as any).pushStrength ?? '');
