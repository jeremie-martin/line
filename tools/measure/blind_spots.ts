/** Scorecard blind-spot audit: rider behaviours that no `tools/eval` row
 * captures, measured on replayed rides of every era. Research only; nothing
 * here feeds the compiler or the scorecard.
 *
 *   node --import tsx tools/measure/blind_spots.ts [--sets=july,current,strike,strike2] [--runs=s3-base,s3-l1,s3-l9|NAME=DIR,...]
 *        [--rows=FILE.jsonl] [--list]
 *
 * Library sets come from `sources()` in observe.ts (strike2 = the v2 review
 * library, byte-identical to eval run s2-base's authored cells 101/202/303).
 * Eval runs come from generated/eval/<run>/cells/*.track.json.gz, targets from
 * each cell's beats (so perturbed authorings use their own beats). The set
 * table uses seeds 101/202/303 of every source so that every column has the
 * same 12 cases; the paired columns are per-case differences with a 95%
 * song-bootstrap interval (songs are the unit, n = 4, as in tools/eval).
 *
 * Geometry. Screen y points down. Rider rotation φ = angle of the sled's
 * TAIL→NOSE axis (0 in the rest pose); |φ| > 90° is upside down. Centre of mass
 * C = mean of the 10 equal-mass points, V its per-frame velocity (exactly
 * ballistic without contact, as in scripts/lib/strike_impact.ts). Contact is
 * observe.ts's contact flag. Impacts are line.strike.v3 events and matches. */
import {readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {makeRng} from '../../scripts/lib/rng.ts';
import {observe, sources, songSpec, SONGS} from './observe.ts';
import {strikeMotionFrames, detectStrikes, accountStrikes, STRIKE_V3_CONTRACT} from './strike.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const G = .175, FPS = 40, DEG = 180 / Math.PI;
const [PEG, TAIL, NOSE, STRING, BUTT, SHOULDER, RHAND, LHAND] = [0, 1, 2, 3, 4, 5, 6, 7];
const BODY = [BUTT, SHOULDER, RHAND, LHAND];   // feet sit on the sled, so they are not body contact
const wrap = (a: number) => ((a + 540) % 360) - 180;

type Ride = {set: string; id: string; song: string; seed: number; perturbation: number | null; track: any;
  durationFrames: number; targets: Array<{frame: number; impact?: number}>};
type Example = {metric: string; ride: string; frame: number; note: string};

/** Frames where a rider point ends a frame on the far side of a solid line it
 * did not collide with that frame: the drawn line passes through the rider.
 * Spatial hash over the lines; strict side test with a 0.5 px margin; `depth`
 * is how far past the line the point ends. */
export function passThroughs(track: any, o: any, last: number) {
  const cell = 64, grid = new Map<string, any[]>();
  for (const l of track.lines) {
    if (l.type === 2) continue;   // scenery never collides
    for (let i = Math.floor(Math.min(l.x1, l.x2) / cell); i <= Math.floor(Math.max(l.x1, l.x2) / cell); i++)
      for (let j = Math.floor(Math.min(l.y1, l.y2) / cell); j <= Math.floor(Math.max(l.y1, l.y2) / cell); j++) {
        const k = `${i},${j}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(l);
      }
  }
  const out: Array<{frame: number; point: number; depth: number}> = [];
  for (let f = 1; f <= last; f++) {
    const hit = new Set<number>(o.frames[f].collisions.map((c: number[]) => c[0]));
    o.frames[f].points.forEach(([x, y, px, py]: number[], p: number) => {
      const seen = new Set<any>();
      for (let i = Math.floor(Math.min(x, px) / cell); i <= Math.floor(Math.max(x, px) / cell); i++)
        for (let j = Math.floor(Math.min(y, py) / cell); j <= Math.floor(Math.max(y, py) / cell); j++)
          for (const l of grid.get(`${i},${j}`) ?? []) {
            if (seen.has(l) || hit.has(l.id)) continue; seen.add(l);
            const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1;
            const side = (u: number, v: number) => ((u - l.x1) * dy - (v - l.y1) * dx) / len;
            const a = side(px, py), b = side(x, y);
            if (a * b >= 0 || Math.abs(a) < .5 || Math.abs(b) < .5) continue;
            const s = a / (a - b), cx = px + s * (x - px), cy = py + s * (y - py);
            const t = ((cx - l.x1) * dx + (cy - l.y1) * dy) / (len * len);
            if (t >= 0 && t <= 1) out.push({frame: f, point: p, depth: Math.abs(b)});
          }
    });
  }
  return out;
}

/** First frame after the authored end where the rider is off the sled or the
 * sled is broken, within `tail` frames (null if it survives). */
function crashAfterEnd(track: any, end: number, tail: number) {
  const engine = new Engine().setStart(track.startPosition ?? track.riders[0].startPosition, track.riders[0].startVelocity).addLine(track.lines);
  for (let f = end + 1; f <= end + tail; f++) {
    const s = engine.getRider(f).ballisticState();
    if (!s.riderMounted || !s.sledIntact) return f - end;
  }
  return null;
}

const runs = (frames: boolean[]) => {
  const out: Array<[number, number]> = []; let start = -1;
  frames.forEach((x, f) => {if (x && start < 0) start = f; if (!x && start >= 0) {out.push([start, f - 1]); start = -1;}});
  if (start >= 0) out.push([start, frames.length - 1]);
  return out;
};

export function blindSpots(r: Ride, examples: Example[] = []) {
  const D = r.durationFrames, o: any = observe(r.track, D, r.targets);
  const last = Math.min(D, o.frames.length - 1), minutes = last / FPS / 60;
  const complete = o.frames.length - 1 >= D && o.frames.slice(0, D + 1).every((f: any) => f.mounted && f.intact);
  const P = (f: number, p: number) => o.frames[f].points[p];
  const phi = (f: number) => Math.atan2(P(f, NOSE)[1] - P(f, TAIL)[1], P(f, NOSE)[0] - P(f, TAIL)[0]) * DEG;
  const V = (f: number) => {let x = 0, y = 0; for (const [a, b, c, d] of o.frames[f].points) {x += a - c; y += b - d;} return [x / 10, y / 10];};
  const C = (f: number) => {let x = 0, y = 0; for (const [a, b] of o.frames[f].points) {x += a; y += b;} return [x / 10, y / 10];};
  const contact = Array.from({length: last + 1}, (_, f) => !!o.observed[f]?.[0]);
  const ang = Array.from({length: last + 1}, (_, f) => phi(f));
  const dphi = ang.map((a, f) => f ? wrap(a - ang[f - 1]) : 0);
  const speed = Array.from({length: last + 1}, (_, f) => Math.hypot(...V(f)));
  const ex = (metric: string, frame: number, note: string) => examples.push({metric, ride: `${r.set}~${r.id}`, frame, note});
  const nearBeat = (f: number, w: number) => r.targets.some(t => Math.abs(t.frame - f) <= w);

  // Orientation: upside-down time, in flight and in contact.
  const inverted = ang.map(a => Math.abs(a) > 90);
  const invertedRuns = runs(inverted).map(([a, b]) => b - a + 1);
  // Spin: total rotation in flight, and full loops (a flight turning ≥ 360°).
  let flightTurn = 0, loops = 0, maxFlightTurn = 0;
  for (const [a, b] of runs(contact.map(c => !c))) {
    let net = 0; for (let f = Math.max(1, a); f <= b; f++) {flightTurn += Math.abs(dphi[f]); net += dphi[f];}
    maxFlightTurn = Math.max(maxFlightTurn, Math.abs(net));
    if (Math.abs(net) >= 360) {loops++; ex('loop', a, `${net.toFixed(0)}° over ${b - a + 1} frames`);}
  }
  // Wobble: rotation reversals of ≥ 15° that turn back within 8 frames (zigzag on φ).
  let wobbles = 0, extremum = 0, extremumAt = 0, dir = 0, cum = 0, lastReversal = -99;
  for (let f = 1; f <= last; f++) {
    cum += dphi[f];
    if (dir === 0) {if (Math.abs(cum) >= 15) {dir = Math.sign(cum); extremum = cum; extremumAt = f;} continue;}
    if (dir * (cum - extremum) > 0) {extremum = cum; extremumAt = f; continue;}
    if (dir * (extremum - cum) < 15) continue;
    if (extremumAt - lastReversal <= 8) {wobbles++; if (wobbles <= 3) ex('wobble', extremumAt, contact[extremumAt] ? 'in contact' : 'in flight');}
    lastReversal = extremumAt; dir = -dir; extremum = cum; extremumAt = f;
  }
  // Body contact (butt, shoulder, hands) and body-drag runs of ≥ 6 frames.
  const body = Array.from({length: last + 1}, (_, f) => o.frames[f].collisions.some((c: number[]) => BODY.includes(c[1])));
  const sledTouch = (f: number) => o.frames[f].collisions.some((c: number[]) => !BODY.includes(c[1]));
  // Which way the touched line faces the body point: a roof pushes it down (screen +y).
  const lineById = new Map<number, any>(r.track.lines.map((l: any) => [l.id, l]));
  let roofFrames = 0;
  for (let f = 1; f <= last; f++) if (o.frames[f].collisions.some(([id, p]: number[]) => {
    if (!BODY.includes(p)) return false;
    const l = lineById.get(id), [, , px, py] = o.frames[f].points[p], dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1;
    const sgn = Math.sign((px - l.x1) * dy - (py - l.y1) * dx) || 1;   // normal toward the side the point came from
    return sgn * -dx / len > .5;
  })) roofFrames++;
  const drags = runs(body).filter(([a, b]) => b - a + 1 >= 6);
  for (const [a, b] of drags.slice(0, 2)) ex('body drag', a, `${b - a + 1} frames`);
  // Stalls and long contact runs (after the first second's launch).
  const slow = speed.map((s, f) => f >= FPS && s < 2), stallRuns = runs(slow).map(([a, b]) => b - a + 1);
  const contactRuns = runs(contact).map(([a, b]) => b - a + 1);
  // One-frame speed kicks of the centre of mass (solver speed gain beyond gravity),
  // with the motion check's 1-frame band: gain > max(0.75, 10% of speed).
  const kicks: number[] = [];
  for (let f = 1; f <= last; f++) {
    const [px, py] = V(f - 1), before = Math.hypot(px, py + G), gain = speed[f] - before;
    if (gain > Math.max(.75, .1 * before)) kicks.push(f);
  }
  for (const f of kicks.filter(f => !nearBeat(f, 4)).slice(0, 2)) ex('off-beat kick', f, `+${(speed[f] - Math.hypot(V(f - 1)[0], V(f - 1)[1] + G)).toFixed(2)} px/frame`);
  const through = passThroughs(r.track, o, last), throughEpisodes = runs(Array.from({length: last + 1}, (_, f) => through.some(t => t.frame === f)));
  const deepEpisodes = runs(Array.from({length: last + 1}, (_, f) => through.some(t => t.frame === f && t.depth >= 3)));
  for (const [a] of deepEpisodes.slice(0, 2)) ex('pass-through ≥3 px', a, `points ${through.filter(t => t.frame === a).map(t => t.point).join(',')}`);
  const postEnd = complete ? crashAfterEnd(r.track, D, 120) : null;
  if (postEnd !== null) ex('crash after end', D + postEnd, `${postEnd} frames after the end`);

  // Strong matched hits (requested ≥ 0.6): pose and first touch.
  const events = detectStrikes(strikeMotionFrames(o), STRIKE_V3_CONTRACT).filter(e => e.onset <= D);
  const account = accountStrikes(events, r.targets, STRIKE_V3_CONTRACT);
  const lines = new Map<number, any>(r.track.lines.map((l: any) => [l.id, l]));
  const strong = account.matches.filter((m: any) => (r.targets[m.target].impact ?? 0) >= .6).map((m: any) => {
    const e = events[m.event], f0 = e.contactStart, touched = new Set<number>(), first = o.frames[f0]?.collisions[0];
    for (const f of [f0, f0 + 1]) for (const [, p] of o.frames[f]?.collisions ?? []) touched.add(p);
    const kind = BODY.some(p => touched.has(p)) ? 'body' : touched.has(TAIL) && touched.has(NOSE) ? 'flat'
      : touched.has(NOSE) || touched.has(STRING) ? 'front' : touched.has(TAIL) || touched.has(PEG) ? 'back' : 'other';
    let pitch = NaN;
    const l = first && lines.get(first[0]);
    if (l) {const a = Math.abs(wrap(ang[f0] - Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * DEG)); pitch = Math.min(a, 180 - a);}
    const [vx, vy] = V(Math.max(0, f0 - 1)), ax = P(f0, NOSE)[0] - P(f0, TAIL)[0], ay = P(f0, NOSE)[1] - P(f0, TAIL)[1];
    const row = {frame: f0, requested: r.targets[m.target].impact!, strength: e.strength, kind, pitch,
      inverted: Math.abs(ang[f0]) > 90, flipped: Math.abs(ang[f0]) > 120, backward: ax * vx + ay * vy < 0};
    if (row.inverted || row.backward) ex('head-down/backward strong hit', f0, `${row.inverted ? 'inverted ' : ''}${row.backward ? 'backward ' : ''}req ${row.requested.toFixed(2)} got ${e.strength.toFixed(2)}`);
    return row;
  });

  // Quiet passages: half-gaps around beats requested ≤ 0.15.
  let quietBeats = 0, quietExtras = 0, quietTurn = 0, quietFrames = 0, quietKicks = 0, quietBody = 0;
  r.targets.forEach((t, i) => {
    if ((t.impact ?? 1) > .15) return;
    const lo = i ? Math.floor((r.targets[i - 1].frame + t.frame) / 2) : 0, hi = Math.min(last, i + 1 < r.targets.length ? Math.ceil((t.frame + r.targets[i + 1].frame) / 2) : D);
    quietBeats++;
    quietExtras += account.unmatchedEvents.filter((k: number) => events[k].onset >= lo && events[k].onset < hi && events[k].strength >= .1).length;
    for (let f = Math.max(1, lo); f < hi; f++) {quietTurn += Math.abs(dphi[f]); quietFrames++; if (body[f]) quietBody++;}
    quietKicks += kicks.filter(f => f >= lo && f < hi).length;
  });

  // Repetition: consecutive inter-beat gaps of equal length (±1 frame, ≥ 12)
  // whose centre-of-mass paths, relative to the gap start, differ by RMS < 2 px
  // (9 samples at equal time).
  let comparable = 0, repeats = 0;
  for (let i = 2; i < r.targets.length; i++) {
    const [a0, a1, b1] = [r.targets[i - 2].frame, r.targets[i - 1].frame, r.targets[i].frame];
    const la = a1 - a0, lb = b1 - a1;
    if (Math.abs(la - lb) > 1 || la < 12 || b1 > last) continue;
    comparable++;
    let sse = 0;
    for (let k = 0; k <= 8; k++) {
      const fa = a0 + Math.round(k * la / 8), fb = a1 + Math.round(k * lb / 8);
      const pa = [C(fa)[0] - C(a0)[0], C(fa)[1] - C(a0)[1]], pb = [C(fb)[0] - C(a1)[0], C(fb)[1] - C(a1)[1]];
      sse += (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2;
    }
    if (Math.sqrt(sse / 9) < 2) repeats++;
  }

  const share = (xs: boolean[]) => xs.length ? xs.filter(Boolean).length / xs.length : NaN;
  return {
    complete: complete ? 1 : 0,
    'inverted % of ride': 100 * share(inverted.slice(1)),
    'inverted in contact %': 100 * share(inverted.map((x, f) => x && contact[f]).slice(1)),
    'longest inverted s': Math.max(0, ...invertedRuns) / FPS,
    'flight spin rev/min': flightTurn / 360 / minutes,
    'loops (≥360° flights)': loops,
    'max flight turn °': maxFlightTurn,
    'wobbles / min': wobbles / minutes,
    'body contact s/min': body.filter(Boolean).length / FPS / minutes,
    'body drags ≥6f': drags.length,
    'body drag s/min': drags.reduce((n, [a, b]) => n + b - a + 1, 0) / FPS / minutes,
    'body contact on a roof s/min': roofFrames / FPS / minutes,
    'body-only contact s/min': body.filter((b, f) => b && !sledTouch(f)).length / FPS / minutes,
    'stall frames (<2 px/f) %': 100 * share(slow.slice(FPS)),
    'longest stall s': Math.max(0, ...stallRuns) / FPS,
    'min speed px/f (after 1 s)': Math.min(...speed.slice(FPS)),
    'longest contact s': Math.max(0, ...contactRuns) / FPS,
    'contact runs > 2 s': contactRuns.filter(n => n > 2 * FPS).length,
    '1-frame kicks': kicks.length,
    '1-frame kicks off-beat': kicks.filter(f => !nearBeat(f, 4)).length,
    'pass-through episodes': throughEpisodes.length,
    'pass-through ≥3 px episodes': deepEpisodes.length,
    'crash ≤0.5 s after end': complete ? (postEnd !== null && postEnd <= 20 ? 1 : 0) : NaN,
    'crash ≤3 s after end': complete ? (postEnd !== null ? 1 : 0) : NaN,
    'strong hits matched': strong.length,
    'strong: flat %': 100 * share(strong.map(h => h.kind === 'flat')),
    'strong: front tip %': 100 * share(strong.map(h => h.kind === 'front')),
    'strong: back tip %': 100 * share(strong.map(h => h.kind === 'back')),
    'strong: body-first %': 100 * share(strong.map(h => h.kind === 'body')),
    'strong: sled-surface pitch° p50': median(strong.map(h => h.pitch)),
    'strong: inverted %': 100 * share(strong.map(h => h.inverted)),
    'strong: |φ|>120° %': 100 * share(strong.map(h => h.flipped)),
    'strong: inverted body-first %': 100 * share(strong.map(h => h.inverted && h.kind === 'body')),
    'strong: backward %': 100 * share(strong.map(h => h.backward)),
    'strong: inverted or backward %': 100 * share(strong.map(h => h.inverted || h.backward)),
    'quiet: extras ≥0.1 / quiet beat': quietBeats ? quietExtras / quietBeats : NaN,
    'quiet: turn °/frame': quietFrames ? quietTurn / quietFrames : NaN,
    'quiet: kicks / quiet beat': quietBeats ? quietKicks / quietBeats : NaN,
    'quiet: body contact %': quietFrames ? 100 * quietBody / quietFrames : NaN,
    'repeated gap pairs %': comparable ? 100 * repeats / comparable : NaN,
    'comparable gap pairs': comparable,
  };
}

const median = (xs: number[]) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN;};
const mean = (xs: number[]) => {const s = xs.filter(Number.isFinite); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN;};

/** Mean of per-song means of per-case values, with a 95% song-bootstrap interval. */
function songBootstrap(values: Array<{song: string; v: number}>, draws = 4000) {
  const perSong = SONGS.map(s => mean(values.filter(x => x.song === s).map(x => x.v))).filter(Number.isFinite);
  if (!perSong.length) return [NaN, NaN, NaN];
  const rng = makeRng(7), out: number[] = [];
  for (let d = 0; d < draws; d++) {let s = 0; for (let i = 0; i < perSong.length; i++) s += perSong[Math.floor(rng() * perSong.length)]; out.push(s / perSong.length);}
  out.sort((a, b) => a - b);
  return [mean(perSong), out[Math.floor(.025 * draws)], out[Math.floor(.975 * draws)]];
}

async function loadRides(sets: string[], evalRuns: string[]): Promise<Ride[]> {
  const rides: Ride[] = [];
  for (const s of sources(sets)) {
    const {durationFrames, targets} = await songSpec(s.song);
    rides.push({set: s.set, id: `${s.song}~${s.seed}`, song: s.song, seed: s.seed, perturbation: null, track: s.track, durationFrames, targets});
  }
  for (const spec of evalRuns) {
    const [run, path] = spec.includes('=') ? spec.split('=') : [spec, join('generated/eval', spec)], dir = join(path, 'cells');
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      const cell = JSON.parse(readFileSync(join(dir, f), 'utf8')), trackPath = join(dir, f.replace(/\.json$/, '.track.json.gz'));
      if (!existsSync(trackPath)) throw new Error(`${run}: no saved track for ${cell.case.id}`);
      const {durationFrames} = await songSpec(cell.case.song);
      rides.push({set: run, id: cell.case.id, song: cell.case.song, seed: cell.case.seed, perturbation: cell.case.perturbation,
        track: JSON.parse(gunzipSync(readFileSync(trackPath)).toString()), durationFrames,
        targets: cell.beats.map((b: any) => ({frame: b.frame, impact: b.requested ?? undefined}))});
    }
  }
  return rides;
}

if (import.meta.filename === process.argv[1]) {
  const sets = arg('sets', 'july,current,strike,strike2').split(',').filter(Boolean);
  const evalRuns = arg('runs', 's3-base,s3-l1,s3-l9').split(',').filter(Boolean), runNames = evalRuns.map(r => r.split('=')[0]);
  const rides = await loadRides(sets, evalRuns), examples: Example[] = [];
  const rows = rides.map(r => ({set: r.set, id: r.id, song: r.song, seed: r.seed, perturbation: r.perturbation, ...blindSpots(r, examples)}));
  const rowsPath = arg('rows', '');
  if (rowsPath) writeFileSync(rowsPath, rows.map(x => JSON.stringify(x)).join('\n') + '\n');
  const metrics = Object.keys(rows[0]).filter(k => !['set', 'id', 'song', 'seed', 'perturbation'].includes(k));
  const columns = [...sets, ...runNames];
  // Set table: the same 12 cases per column (authored seeds 101/202/303). July uses its own seeds.
  const base = (set: string) => rows.filter(x => x.set === set && x.perturbation === null && (set === 'july' || [101, 202, 303].includes(x.seed)));
  const paired = (a: string, b: string, all: boolean) => rows.filter(x => x.set === a && (all || (x.perturbation === null && [101, 202, 303].includes(x.seed))))
    .flatMap(x => {const y = rows.find(z => z.set === b && z.id === x.id); return y ? [{x, y}] : [];});
  // Paired: each eval run against the previous one on all its cases; the first and
  // the last run against the strike2 library on the 12 shared authored cases.
  const pairs: Array<[string, string, string, boolean]> = runNames.slice(1).map((r, i) => [`${r}−${runNames[i]} (24)`, r, runNames[i], true]);
  if (sets.includes('strike2')) for (const r of new Set([runNames[0], runNames.at(-1)!].filter(Boolean))) pairs.push([`${r}−strike2 (12)`, r, 'strike2', false]);
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(Math.abs(v) >= 100 ? 0 : 2) : '—').padStart(8);
  console.log('per-ride mean over the same 12 cases (seeds 101/202/303; July: its 12 rides)');
  console.log(`${'metric'.padEnd(34)}${columns.map(c => c.padStart(8)).join('')}`);
  for (const m of metrics) console.log(`${m.padEnd(34)}${columns.map(c => fmt(mean(base(c).map((x: any) => x[m])))).join('')}`);
  console.log('\npaired: mean per-case difference [95% song bootstrap]');
  console.log(`${'metric'.padEnd(34)}${pairs.map(p => p[0].padStart(28)).join('')}`);
  for (const m of metrics) console.log(`${m.padEnd(34)}${pairs.map(([, a, b, all]) => {
    const [d, lo, hi] = songBootstrap(paired(a, b, all).map(({x, y}: any) => ({song: x.song, v: x[m] - y[m]})));
    return `${fmt(d)} [${lo.toFixed(2)}, ${hi.toFixed(2)}]`.padStart(28);
  }).join('')}`);
  console.log('\nevent totals over each column\'s 12 cases (the observation power of each row):');
  for (const m of ['loops (≥360° flights)', 'body drags ≥6f', '1-frame kicks', '1-frame kicks off-beat', 'pass-through episodes', 'pass-through ≥3 px episodes', 'crash ≤3 s after end', 'strong hits matched', 'contact runs > 2 s', 'comparable gap pairs'])
    console.log(`  ${m.padEnd(32)}${columns.map(c => String(base(c).reduce((s, x: any) => s + (Number.isFinite(x[m]) ? x[m] : 0), 0)).padStart(8)).join('')}`);
  if (process.argv.includes('--list')) {
    console.log('\nexamples (ride, frame, seconds):');
    for (const e of examples) console.log(`  ${e.metric.padEnd(30)} ${e.ride.padEnd(36)} f${String(e.frame).padStart(5)}  ${(e.frame / FPS).toFixed(2).padStart(6)} s  ${e.note}`);
  }
  process.exit(0);
}
