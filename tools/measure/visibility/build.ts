/** Impact-visibility study, step 3: render the clips and publish the manifest for
 * motion-gallery/pairs.html, from a key written by select.ts. Same clips as
 * tools/measure/pair_study.ts (clip_render.ts: the plain look, 1.8 s with the judged
 * moment at 1.0 s); the rides come from the tracks preserved in
 * labels/studies/sources, checked against the key's hashes.
 *
 *   node tools/measure/visibility/build.ts --study=<id> [--jobs=8] */
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join, resolve} from 'node:path';
import assert from 'node:assert/strict';
import {renderClips, momentClip, clipBeats, specBeats, assertReviewSources, CLIP_BEFORE, CLIP_LENGTH, type Clip} from '../clip_render.ts';
import {lockArtifacts} from '../../../scripts/lib/artifact_lock.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study')!, jobs = Number(arg('jobs', '8'));
assert.match(study, /^[a-z0-9-]+$/);
const key = JSON.parse(readFileSync(`labels/studies/${study}.key.json`, 'utf8'));
const PROMPT = 'Which one is the bigger impact? Judge only the moment marked by the light. ' +
  'Some lights mark ordinary riding with no hit at all: if neither lit moment looks like an impact, choose "Neither looks like an impact".';
const CHOICES = [['left', 'A is the bigger impact'], ['right', 'B is the bigger impact'], ['same', 'About the same'], ['neither', 'Neither looks like an impact']];

const out = join('generated/label-studies', study), clips = join(out, 'clips');
mkdirSync(out, {recursive: true});
const release = lockArtifacts(out);
try {
  assert.ok(!existsSync(join(out, 'manifest.json')), 'study already published; use a fresh study id');
  mkdirSync(clips, {recursive: true});
  const sides = key.flatMap((p: any) => [p.left, p.right]);
  const tracks = new Map<string, {song: string; track: any}>();
  for (const h of sides) {
    const id = `heldout~${h.song}~${h.seed}`;
    if (tracks.has(id)) continue;
    const text = gunzipSync(readFileSync(h.source)).toString();
    assert.equal(createHash('sha256').update(text).digest('hex'), h.trackSha256, `${h.source} is not the measured track`);
    tracks.set(id, {song: h.song, track: JSON.parse(text)});
  }
  const passages = new Map<string, Clip>(key.flatMap((p: any) => (['left', 'right'] as const).map(s => {
    const {song, track} = tracks.get(`heldout~${p[s].song}~${p[s].seed}`)!;
    return [`pair${p.pair}-${s}`, momentClip(song, track, p[s].frame)] as const;
  })));
  await renderClips(passages, clips, jobs);

  // Each side's song's authored beats inside its clip (seconds from clip start, requested strength), as pair_study.ts: from the
  // spec its compiled record names (a held-out song may be a variant).
  const specOf = (h: any) => {
    assert.ok(existsSync(h.compiled), `${h.compiled}, the record the key names, is missing`);
    const {case: c} = JSON.parse(readFileSync(h.compiled, 'utf8'));
    assertReviewSources(h.song, c, c.source);
    return c.source as string;
  };
  const specs = new Map<string, string>(sides.map((h: any) => [h.compiled, specOf(h)]));
  const songBeats = new Map(await Promise.all([...new Set(specs.values())].map(async path => [path, await specBeats(path)] as const)));
  const beats = (p: any, s: 'left' | 'right') => clipBeats(passages.get(`pair${p.pair}-${s}`)!, songBeats.get(specs.get(p[s].compiled)!)!);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({study, kind: 'pairs', hitAt: CLIP_BEFORE, length: CLIP_LENGTH, prompt: PROMPT,
    choices: CHOICES, questions: [{id: 'bigger', options: CHOICES.map(c => c[0])}],
    clips: key.map((p: any) => ({id: `pair${p.pair}`,
      left: {src: `/${clips}/pair${p.pair}-left.mp4`, beats: beats(p, 'left')},
      right: {src: `/${clips}/pair${p.pair}-right.mp4`, beats: beats(p, 'right')}}))}, null, 1));
  console.log(`${study}: ${key.length} pairs, ${tracks.size} rides in ${resolve(out)}`);
} finally {release();}
process.exit(0);
