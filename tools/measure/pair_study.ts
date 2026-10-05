/** Builds a blind pair study for the dashboard (motion-gallery/pairs.html): plain
 * landscape renders of each ride (spec camera, no overlay or beat punch), a
 * clip around each hit, and the manifest the labels API validates.
 *
 *   node --import tsx tools/measure/pair_study.ts --key=labels/studies/<study>.key.json --study=<study>
 *       [--jobs=4] [--prompt=TEXT]
 *
 * The key lists pairs as {pair, left, right}, each side a hit {set, song, seed,
 * frame} from tools/measure/observe.ts sources (July, previous library, strike
 * library) or `eval:<run>` (a track saved by tools/eval). The first study's key names sides instead ({left: 'body-first' |
 * 'clean-sled', a, b}, a being the body-first hit, all from the strike library). */
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join, resolve} from 'node:path';
import {renderRides, cutClip, assertReviewSources, CLIP_BEFORE, CLIP_LENGTH} from './clip_render.ts';
import assert from 'node:assert/strict';
import {loadRun} from '../eval/records.ts';
import {digest} from '../eval/inputs.ts';
import {songSpec, sources} from './observe.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study')!, key = JSON.parse(readFileSync(arg('key')!, 'utf8'));
const jobs = Number(arg('jobs', '4'));
const out = join('generated/label-studies', study), rides = join(out, 'rides'), clips = join(out, 'clips');
assert.match(study, /^[a-z0-9-]+$/);
mkdirSync(out, {recursive: true});
const release = lockArtifacts(out);
try {
  assert.ok(!existsSync(join(out, 'manifest.json')), 'study already published; use a fresh study id');
  mkdirSync(rides, {recursive: true}); mkdirSync(clips, {recursive: true});
  const BEFORE = CLIP_BEFORE, LENGTH = CLIP_LENGTH;

  const side = (p: any, s: 'left' | 'right') => typeof p[s] === 'object' ? p[s] : p[s] === 'body-first' ? {set: 'strike', ...p.a} : {set: 'strike', ...p.b};
  const rideId = (h: any) => `${h.set ?? 'strike'}~${h.song}~${h.seed}`;
  const hits = key.flatMap((p: any) => [side(p, 'left'), side(p, 'right')]);
  const ids = [...new Set(hits.map(rideId))] as string[];
  // A set 'eval:<run>' reads the track an eval run saved beside its cell.
  const tracks = new Map<string, any>(sources([...new Set(hits.map((h: any) => h.set ?? 'strike').filter((x: string) => !x.startsWith('eval:')))] as string[]).map(s => [`${s.set}~${s.song}~${s.seed}`, s.track]));
  const evalRuns = new Map<string, ReturnType<typeof loadRun>>();
  for (const h of hits) if ((h.set ?? '').startsWith('eval:')) {
    const run = h.set.slice(5); if (!evalRuns.has(run)) evalRuns.set(run, loadRun(run));
    const cell = evalRuns.get(run)!.cells.get(`${h.song}~${h.seed}`)!;
    assert.equal(h.trackHash, cell.trackHash, 'blind key names another track');
    assert.equal(h.inputHash, digest(cell.case.input), 'blind key names different authoring');
    assertReviewSources(h.song, cell.case.input);
    const hit = cell.impact3.perBeat[h.beat]?.hit;
    assert.ok(hit && hit.onset === h.frame && hit.strength === h.strength, 'blind key names another impact');
    if (!tracks.has(rideId(h))) tracks.set(rideId(h), JSON.parse(gunzipSync(readFileSync(join(evalRuns.get(run)!.dir, 'cells', `${h.song}~${h.seed}.track.json.gz`))).toString()));
  }
  await renderRides(new Map(ids.map(id => {
    if (!tracks.has(id)) throw new Error(`no source ride ${id}`);
    return [id, {song: id.split('~')[1], track: tracks.get(id)}];
  })), rides, jobs);

  for (const p of key) for (const s of ['left', 'right'] as const) {
    const h = side(p, s);
    cutClip(join(rides, rideId(h) + '.mp4'), h.frame, join(clips, `pair${p.pair}-${s}.mp4`));
  }
  // Each side carries the specification beats inside its clip (seconds from clip
  // start, with the requested strength); the judged hit is at hitAt.
  const specs = new Map<string, Awaited<ReturnType<typeof songSpec>>>();
  for (const song of new Set(hits.map((h: any) => h.song))) specs.set(song as string, await songSpec(song as string));
  const beats = (h: any) => {
    const start = h.frame / 40 - BEFORE;
    return specs.get(h.song)!.targets.filter((t: any) => t.frame / 40 >= start && t.frame / 40 <= start + LENGTH)
      .map((t: any) => ({t: +(t.frame / 40 - start).toFixed(4), impact: t.impact ?? null}));
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({study, kind: 'pairs', hitAt: BEFORE, length: LENGTH,
    prompt: arg('prompt', 'Which one is the bigger impact?'),
    choices: JSON.parse(arg('choices', '[["left","A is bigger"],["right","B is bigger"],["same","About the same"]]')!),
    questions: [{id: arg('question', 'bigger')!, options: JSON.parse(arg('choices', '[["left"],["right"],["same"]]')!).map((c: string[]) => c[0])}],
    clips: key.map((p: any) => ({id: `pair${p.pair}`,
      left: {src: `/${clips}/pair${p.pair}-left.mp4`, beats: beats(side(p, 'left'))},
      right: {src: `/${clips}/pair${p.pair}-right.mp4`, beats: beats(side(p, 'right'))}}))}, null, 1));
  console.log(`${study}: ${key.length} pairs in ${resolve(out)}`);
} finally {release();}
process.exit(0);
