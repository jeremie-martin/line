/** Builds a blind pair study for the dashboard (motion-gallery/pairs.html): a clip of
 * each hit in the plain look (clip_render.ts) and the manifest the labels API validates.
 *
 *   node tools/measure/pair_study.ts --key=labels/studies/<study>.key.json --study=<study>
 *       [--jobs=4] [--prompt=TEXT]
 *
 * The key lists pairs as {pair, left, right}, each side a hit {set, song, seed,
 * frame} from tools/measure/observe.ts sources (July, previous library, strike
 * library), `eval:<run>` (a track saved by tools/eval) or `arm:<arm id>` with `cell` (a ride saved by
 * `npm run compare`, generated/eval/arms). The first study's key names sides instead ({left: 'body-first' |
 * 'clean-sled', a, b}, a being the body-first hit, all from the strike library). */
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join, resolve} from 'node:path';
import {renderClips, momentClip, clipBeats, specBeats, assertReviewSources, CLIP_BEFORE, CLIP_LENGTH, type Clip} from './clip_render.ts';
import assert from 'node:assert/strict';
import {loadRun} from '../eval/records.ts';
import {readArmTrack} from '../eval/arms.ts';
import {digest} from '../eval/inputs.ts';
import {sources} from './observe.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study')!, key = JSON.parse(readFileSync(arg('key')!, 'utf8'));
const jobs = Number(arg('jobs', '4'));
const out = join('generated/label-studies', study), clips = join(out, 'clips');
assert.match(study, /^[a-z0-9-]+$/);
mkdirSync(out, {recursive: true});
const release = lockArtifacts(out);
try {
  assert.ok(!existsSync(join(out, 'manifest.json')), 'study already published; use a fresh study id');

  const side = (p: any, s: 'left' | 'right') => typeof p[s] === 'object' ? p[s] : p[s] === 'body-first' ? {set: 'strike', ...p.a} : {set: 'strike', ...p.b};
  const rideId = (h: any) => h.cell ? `${h.set}~${h.cell}` : `${h.set ?? 'strike'}~${h.song}~${h.seed}`;
  const hits = key.flatMap((p: any) => [side(p, 'left'), side(p, 'right')]);
  const ids = [...new Set(hits.map(rideId))] as string[];
  // A set 'eval:<run>' reads the track an eval run saved beside its cell.
  const tracks = new Map<string, any>(sources([...new Set(hits.map((h: any) => h.set ?? 'strike').filter((x: string) => !/^(eval|arm):/.test(x)))] as string[]).map(s => [`${s.set}~${s.song}~${s.seed}`, s.track]));
  const evalRuns = new Map<string, ReturnType<typeof loadRun>>();
  // the spec each ride was compiled from: an eval cell's own (its variant), otherwise the song's spec.ts
  const specs = new Map<string, string>();
  for (const h of hits) if ((h.set ?? '').startsWith('eval:')) {
    const run = h.set.slice(5); if (!evalRuns.has(run)) evalRuns.set(run, loadRun(run));
    const cell = evalRuns.get(run)!.cells.get(`${h.song}~${h.seed}`)!;
    assert.equal(h.trackHash, cell.trackHash, 'blind key names another track');
    assert.equal(h.inputHash, digest(cell.case.input), 'blind key names different authoring');
    const spec = cell.case.variant ? `productions/${h.song}/variants/${cell.case.variant}.ts` : `productions/${h.song}/spec.ts`;
    assertReviewSources(h.song, cell.case.input, spec); specs.set(rideId(h), spec);
    const hit = cell.impact3.perBeat[h.beat]?.hit;
    assert.ok(hit && hit.onset === h.frame && hit.strength === h.strength, 'blind key names another impact');
    if (!tracks.has(rideId(h))) tracks.set(rideId(h), JSON.parse(gunzipSync(readFileSync(join(evalRuns.get(run)!.dir, 'cells', `${h.song}~${h.seed}.track.json.gz`))).toString()));
  }
  // A set 'arm:<id>' reads a ride `npm run compare` saved (its cell `h.cell`).
  for (const h of hits) if ((h.set ?? '').startsWith('arm:')) {
    const dir = join('generated/eval/arms', h.set.slice(4)), cell = JSON.parse(readFileSync(join(dir, 'cells', `${h.cell}.json`), 'utf8'));
    assert.equal(h.trackHash, cell.trackHash, 'blind key names another track');
    assert.equal(h.inputHash, digest(cell.case.input), 'blind key names different authoring');
    const spec = cell.case.variant ? `productions/${h.song}/variants/${cell.case.variant}.ts` : `productions/${h.song}/spec.ts`;
    assertReviewSources(h.song, cell.case.input, spec); specs.set(rideId(h), spec);
    const hit = cell.impact3.perBeat[h.beat]?.hit;
    assert.ok(hit && hit.onset === h.frame && hit.strength === h.strength, 'blind key names another impact');
    if (!tracks.has(rideId(h))) tracks.set(rideId(h), readArmTrack({dir}, h.cell));
  }
  for (const id of ids) if (!tracks.has(id)) throw new Error(`no source ride ${id}`);
  const passages = new Map<string, Clip>(key.flatMap((p: any) => (['left', 'right'] as const).map(s => {
    const h = side(p, s);
    return [`pair${p.pair}-${s}`, momentClip(h.song, tracks.get(rideId(h)), h.frame)] as const;
  })));
  await renderClips(passages, clips, jobs);
  // Each side carries its song's authored beats inside its clip (seconds from clip start, with the requested strength); the
  // judged moment is at hitAt.
  const specOf = (h: any) => specs.get(rideId(h)) ?? `productions/${h.song}/spec.ts`;
  const songBeats = new Map(await Promise.all([...new Set(key.flatMap((p: any) => [specOf(side(p, 'left')), specOf(side(p, 'right'))]))]
    .map(async path => [path, await specBeats(path as string)] as const)));
  const beats = (p: any, s: 'left' | 'right') => clipBeats(passages.get(`pair${p.pair}-${s}`)!, songBeats.get(specOf(side(p, s)))!);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({study, kind: 'pairs', hitAt: CLIP_BEFORE, length: CLIP_LENGTH,
    prompt: arg('prompt', 'Which one is the bigger impact?'),
    choices: JSON.parse(arg('choices', '[["left","A is bigger"],["right","B is bigger"],["same","About the same"]]')!),
    questions: [{id: arg('question', 'bigger')!, options: JSON.parse(arg('choices', '[["left"],["right"],["same"]]')!).map((c: string[]) => c[0])}],
    clips: key.map((p: any) => ({id: `pair${p.pair}`,
      left: {src: `/${clips}/pair${p.pair}-left.mp4`, beats: beats(p, 'left')},
      right: {src: `/${clips}/pair${p.pair}-right.mp4`, beats: beats(p, 'right')}}))}, null, 1));
  console.log(`${study}: ${key.length} pairs in ${resolve(out)}`);
} finally {release();}
process.exit(0);
