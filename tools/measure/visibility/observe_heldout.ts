/** Impact-visibility study, step 1: measure held-out production rides without
 * looking at them. Replays each saved ride, detects line.strike.v3 events and
 * their account exactly as tools/eval does (scripts/lib/strike_impact.ts through
 * tools/measure/strike.ts), and records what pair selection needs:
 *  - every v3 event (onset = half-rise, strength, matched beat and its ask, posture
 *    at first contact);
 *  - every force maximum outside all events (the detector walk of the
 *    unwanted-impacts report, 2026-10-30), with the event it was folded into;
 *  - per frame: contact, inside an event, and the 2-frame whole-body change ÷ 7.55.
 * The saved compile-time v3 events must equal the replayed ones (asserted).
 *
 *   LR_ENGINE=wasm node --import tsx tools/measure/visibility/observe_heldout.ts \
 *       --rides=<dir of <song>-<seed>/ production outputs> --out=FILE.json.gz
 *
 * Lives in a subfolder: evaluatorIdentity hashes only top-level tools/measure files. */
import {readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {observe, songSpec, POINTS} from '../observe.ts';
import {strikeMotionFrames, detectStrikes, accountStrikes, STRIKE_V3_CONTRACT as C} from '../strike.ts';
import {LineRiderEngine as Engine} from '../../../scripts/lib/native_motion/engine.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const dir = arg('rides')!, outPath = arg('out')!;
assert.ok(dir && outPath, 'usage: --rides=DIR --out=FILE.json.gz');
const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
const DEG = 180 / Math.PI, BODY = new Set(['BUTT', 'SHOULDER', 'RHAND', 'LHAND']);
const r3 = (x: number) => Math.round(x * 1000) / 1000;

const rides: any[] = [];
for (const name of readdirSync(dir).filter(d => /^[a-z_0-9]+_\d+s-\d+$/.test(d)).sort()) {
  const [song, seed] = [name.replace(/-\d+$/, ''), Number(name.split('-').at(-1))];
  assert.notEqual(song, 'trouble_50s', 'Trouble is never a study source');
  const path = join(dir, name, `${name}-production.json`);
  assert.ok(existsSync(path), `missing ${path}`);
  const bytes = readFileSync(path), saved = JSON.parse(bytes.toString());
  assert.equal(sha(bytes), readFileSync(path + '.sha256', 'utf8').trim().split(/\s+/)[0], `${path} differs from its recorded sha256`);
  // Beats as compiled: `npm run produce` applies the felt-jolt offset (contacts 15 ms
  // after the audio beat, scripts/produce/jolt.ts), so a beat's frame may be one
  // later than round(t·40). Matching uses the compiled frames, as the saved evaluation did.
  const spec = await songSpec(song), D = spec.durationFrames;
  assert.equal(saved.case.durationFrames, D);
  const targets = saved.case.contacts.map((c: any) => ({frame: c.frame, impact: c.impact ?? undefined}));
  assert.equal(targets.length, spec.targets.length);
  for (const [k, t] of targets.entries()) assert.ok(t.frame - spec.targets[k].frame >= 0 && t.frame - spec.targets[k].frame <= 1 &&
    t.impact === spec.targets[k].impact, 'the ride was compiled against other beats than the current specification');
  const o: any = observe(saved.track, D, targets), frames = strikeMotionFrames(o);
  const events = detectStrikes(frames, C).filter(e => e.onset <= D), account = accountStrikes(events, targets, C);
  // The compile-time evaluation saved beside the ride must be what we replay.
  const savedEvents = saved.impactEvaluation.events.map((e: any) => [e.onset, r3(e.strength)]);
  assert.deepEqual(events.map(e => [e.onset, r3(e.strength)]), savedEvents, `${name}: replayed v3 events differ from the saved evaluation`);

  const rest = (() => {const p = o.frames[0].points; return Math.atan2(p[2][1] - p[1][1], p[2][0] - p[1][0]);})();
  const pitch = (f: number) => {const p = o.frames[f].points; const a = Math.atan2(p[2][1] - p[1][1], p[2][0] - p[1][0]) - rest; return Math.atan2(Math.sin(a), Math.cos(a)) * DEG;};
  const pointsAt = (f: number) => [...new Set(o.frames[f].collisions.map(([, k]: number[]) => POINTS[k]))] as string[];
  const matchOf = new Map<number, number>(account.matches.map((m: any) => [m.event, m.target]));
  const inEvent = frames.map(f => events.some(e => e.contactStart <= f.frame && f.frame <= e.end));
  // Largest 2-frame whole-body change starting at frame a (both frames observed), ÷ veryStrong.
  const change = frames.map((_, a) => {
    if (a + 1 >= frames.length || !frames[a].impulse || !frames[a + 1].impulse) return 0;
    const p = frames[a].impulse!, q = frames[a + 1].impulse!;
    return Math.hypot(p[0] + q[0], p[1] + q[1], p[2] + q[2]) / C.veryStrong;
  });

  const ev = events.map((e, i) => {
    const t = matchOf.get(i), first = pointsAt(e.contactStart);
    return {i, kind: e.kind, contactStart: e.contactStart, onset: e.onset, end: e.end, peak: e.peakFrame, strength: e.strength,
      matched: t ?? null, ask: t === undefined ? null : targets[t].impact ?? null,
      pitchAtContact: Math.round(pitch(e.contactStart)), firstPoints: first.join('+'), bodyFirst: first.some(p => BODY.has(p))};
  });

  // Force maxima outside every event (unwanted-impacts report, missed.ts): the same
  // walk as detectStrikes; strength is the largest 2-frame change over i−2..i+3.
  const pushes: any[] = [];
  for (let first = 0; first < frames.length;) {
    if (!frames[first].contact) {first++; continue;}
    let last = first; while (last + 1 < frames.length && frames[last + 1].contact) last++;
    const S = (i: number) => .25 * frames[Math.max(first, i - 1)].J + .5 * frames[i].J + .25 * frames[Math.min(last, i + 1)].J;
    let peak = first;
    const record = (i: number, reason: string) => {
      const f = frames[i].frame; if (f > D || inEvent[i]) return;
      let a = -1, best = -1;
      for (let k = Math.max(first, i - 2); k <= Math.min(last, i + 3) - 1; k++) if (change[k] > best) {best = change[k]; a = k;}
      const owner = [...events.keys()].filter(k => events[k].contactStart <= f).at(-1);
      pushes.push({frame: f, window: a, reason, strength: Math.min(1, best), owner: owner ?? null,
        engagementStart: first, engagementEnd: last, body: o.frames[f].collisions.some(([, p]: number[]) => p >= 4 && p <= 7)});
    };
    for (let i = first + 1; i <= last; i++) {
      const pa = frames[peak].impulse!, pb = frames[i].impulse!, na = Math.hypot(pa[0], pa[1]), nb = Math.hypot(pb[0], pb[1]);
      if (na >= C.floor && nb >= C.floor && (pa[0] * pb[0] + pa[1] * pb[1]) / (na * nb) < C.reversalCos) {peak = i; continue;}
      const value = S(i);
      if (!(value >= S(i - 1) && (i === last || value > S(i + 1)))) continue;
      let trough = peak; for (let k = peak + 1; k < i; k++) if (S(k) < S(trough)) trough = k;
      if (value >= C.floor && i - peak >= C.spacing && trough > peak && S(trough) <= C.valley * value) {
        let start = i; while (start > trough + 1 && S(start - 1) > S(trough)) start--;
        if (i - start >= C.window) record(i, 'window');
        peak = i;
      } else {
        if (value >= C.floor) record(i, i - peak < C.spacing ? 'spacing' : trough === peak ? 'rising' : 'valley');
        if (value > S(peak)) peak = i;
      }
    }
    first = last + 1;
  }
  rides.push({ride: `${song}~${seed}`, song, seed, origin: path, productionSha256: sha(bytes), trackSha256: sha(JSON.stringify(saved.track)),
    valid: saved.valid, D, terminus: o.terminus, targets, events: ev, pushes,
    contact: frames.map(f => f.contact ? 1 : 0).join(''), inEvent: inEvent.map(x => x ? 1 : 0).join(''), change: change.map(r3)});
  Engine.retainOnly([]);
  console.log(`${name}: ${ev.length} events (${ev.filter(e => e.matched === null).length} unmatched), ${pushes.length} uncounted maxima`);
}
writeFileSync(outPath, gzipSync(JSON.stringify({schema: 'line.visibility-observations.v1', contract: C.id, source: dir, rides})));
console.log(`${rides.length} rides → ${outPath}`);
process.exit(0);
