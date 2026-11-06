/** Impact-visibility study, step 3: render the clips and publish the manifest for
 * motion-gallery/pairs.html, from a key written by select.ts. Same renders and clips
 * as tools/measure/pair_study.ts (plain landscape, spec camera, 1.8 s with the
 * judged moment at 1.0 s); the rides come from the tracks preserved in
 * labels/studies/sources, checked against the key's hashes.
 *
 *   node tools/measure/visibility/build.ts --study=<id> [--jobs=8] */
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join, resolve} from 'node:path';
import assert from 'node:assert/strict';
import {renderRides, cutClip, CLIP_BEFORE, CLIP_LENGTH} from '../clip_render.ts';
import {songSpec} from '../observe.ts';
import {lockArtifacts} from '../../../scripts/lib/artifact_lock.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study')!, jobs = Number(arg('jobs', '8'));
assert.match(study, /^[a-z0-9-]+$/);
const key = JSON.parse(readFileSync(`labels/studies/${study}.key.json`, 'utf8'));
const PROMPT = 'Which one is the bigger impact? Judge only the moment marked by the light. ' +
  'Some lights mark ordinary riding with no hit at all: if neither lit moment looks like an impact, choose "Neither looks like an impact".';
const CHOICES = [['left', 'A is the bigger impact'], ['right', 'B is the bigger impact'], ['same', 'About the same'], ['neither', 'Neither looks like an impact']];

const out = join('generated/label-studies', study), rides = join(out, 'rides'), clips = join(out, 'clips');
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
  await renderRides(tracks, rides, jobs);
  for (const p of key) for (const s of ['left', 'right'] as const)
    cutClip(join(rides, `heldout~${p[s].song}~${p[s].seed}.mp4`), p[s].frame, join(clips, `pair${p.pair}-${s}.mp4`));

  // Beats of the specification inside each clip (seconds from clip start, requested strength), as pair_study.ts.
  const specs = new Map<string, Awaited<ReturnType<typeof songSpec>>>();
  for (const h of sides) if (!specs.has(h.song)) specs.set(h.song, await songSpec(h.song));
  const beats = (h: any) => {
    const start = h.frame / 40 - CLIP_BEFORE;
    return specs.get(h.song)!.targets.filter((t: any) => t.frame / 40 >= start && t.frame / 40 <= start + CLIP_LENGTH)
      .map((t: any) => ({t: +(t.frame / 40 - start).toFixed(4), impact: t.impact ?? null}));
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({study, kind: 'pairs', hitAt: CLIP_BEFORE, length: CLIP_LENGTH, prompt: PROMPT,
    choices: CHOICES, questions: [{id: 'bigger', options: CHOICES.map(c => c[0])}],
    clips: key.map((p: any) => ({id: `pair${p.pair}`,
      left: {src: `/${clips}/pair${p.pair}-left.mp4`, beats: beats(p.left)},
      right: {src: `/${clips}/pair${p.pair}-right.mp4`, beats: beats(p.right)}}))}, null, 1));
  console.log(`${study}: ${key.length} pairs, ${tracks.size} rides in ${resolve(out)}`);
} finally {release();}
process.exit(0);
