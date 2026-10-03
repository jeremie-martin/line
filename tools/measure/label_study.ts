/** Build a blind impact-labelling study from measured beats.
 *
 *   node --import tsx tools/measure/label_study.ts --id=impact-2026-10 [--clips=120] [--seed=1]
 *
 * Writes generated/label-studies/<id>/{manifest.json, key.json, records/*.json}.
 * The page (motion-gallery/label.html) loads only manifest.json: clips in a
 * fixed shuffled order with no source, set or measurement shown. key.json keeps
 * each clip's selection reason, measures and design/holdout split for analysis.
 * Half the clips are uniformly random beats, so selection cannot bias the
 * agreement statistics; the rest oversample where candidate measures disagree. */
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {makeRng} from '../../scripts/lib/rng.ts';
import {sources, songSpec, POINTS} from './observe.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory} from '../../scripts/lib/detector.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const id = arg('id', 'impact-2026-10'), total = Number(arg('clips', '120')), rng = makeRng(Number(arg('seed', '1')));
if (!/^[a-z0-9-]+$/.test(id)) throw new Error('study id must be lowercase letters, digits and dashes');
const dir = join('generated/label-studies', id);
if (existsSync(join(dir, 'manifest.json'))) throw new Error('study already exists; choose a new id (labels refer to its clips)');
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const rows: any[] = JSON.parse(readFileSync('generated/measure/beats.json', 'utf8')).filter((r: any) => r.requested != null && r.frame > 40);

const categories: Array<[string, (r: any) => boolean]> = [
  ['strong-low-clarity', r => r.requested >= .6 && (r.impulse.clarity ?? 99) < 2],
  ['strong-high-clarity', r => r.requested >= .6 && (r.impulse.clarity ?? 0) > 6],
  ['extra-hit-nearby', r => r.extrasR1.some((e: any) => e.strength >= .25)],
  ['hidden-contact-bend', r => r.hiddenBend > 1.5],
  ['body-only-hit', r => r.bodyOnlyHit],
  ['backward-arrival', r => r.backward],
  ['quiet-request', r => r.requested <= .1],
  ['late-peak', r => r.r1 && r.r1.peak >= 4],
  ['frozen-vs-r1-disagree', r => r.frozen != null && r.r1 && Math.abs(r.frozen - r.r1.strength) > .2],
];
const pick = (pool: any[], chosen: Map<string, any>) => {
  const fresh = pool.filter(r => !chosen.has(r.source + '#' + r.beat));
  return fresh.length ? fresh[Math.floor(rng() * fresh.length)] : undefined;
};
const chosen = new Map<string, any>(), reasons = new Map<string, string>();
const randomCount = Math.round(total / 2), perCategory = Math.floor((total - randomCount) / categories.length);
for (const [name, test] of categories) for (let k = 0; k < perCategory; k++) {
  const r = pick(rows.filter(test), chosen); if (!r) break;
  chosen.set(r.source + '#' + r.beat, r); reasons.set(r.source + '#' + r.beat, name);
}
while (chosen.size < total) {const r = pick(rows, chosen)!; chosen.set(r.source + '#' + r.beat, r); reasons.set(r.source + '#' + r.beat, 'random');}

mkdirSync(join(dir, 'records'), {recursive: true});
const bySource = new Map(sources(['july', 'current', 'experimental']).map(s => [`${s.set}~${s.song}~${s.seed}`, s]));
const recordFor = new Map<string, {path: string; sha256: string}>();
for (const sourceId of new Set([...chosen.values()].map(r => r.source))) {
  const s = bySource.get(sourceId)!, {durationFrames} = await songSpec(s.song);
  const engine = new Engine().setStart(s.track.startPosition ?? s.track.riders[0].startPosition, s.track.riders[0].startVelocity).addLine(s.track.lines);
  const raw = extractRawTrajectory(engine, durationFrames + 20);
  const frames = raw.frames.map((f: any) => {const st = engine.getRider(f.frame).ballisticState(); return POINTS.flatMap(p => [st.points[p].x, st.points[p].y]);});
  const body = JSON.stringify({track: s.track, trace: {fps: 40, pointIds: POINTS, frames}});
  const name = sha(sourceId).slice(0, 16) + '.json';
  writeFileSync(join(dir, 'records', name), body);
  recordFor.set(sourceId, {path: `/${dir}/records/${name}`, sha256: sha(body)});
}
const audio = new Map<string, {path: string; sha256: string}>();
const order = [...chosen.values()];
for (let i = order.length - 1; i > 0; i--) {const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];}
const clips = [], key = [];
for (const [index, r] of order.entries()) {
  if (!audio.has(r.song)) {const path = `productions/${r.song}/audio.mp3`; audio.set(r.song, {path: '/' + path, sha256: sha(readFileSync(path))});}
  const clipId = `c${String(index + 1).padStart(3, '0')}`, rec = recordFor.get(r.source)!, a = audio.get(r.song)!;
  const start = Math.max(0, r.t - 0.75), end = r.t + 0.75, {targets} = await songSpec(r.song);
  clips.push({id: clipId, record: rec.path, recordSha256: rec.sha256, audio: a.path, audioSha256: a.sha256,
    beat: r.t, start, end, beats: targets.map((x: any) => x.t).filter((t: number) => t >= start - 1e-9 && t <= end + 1e-9)});
  key.push({clip: clipId, source: r.source, set: r.set, song: r.song, seed: r.seed, beat: r.beat, frame: r.frame, t: r.t,
    requested: r.requested, reason: reasons.get(r.source + '#' + r.beat), split: rng() < .7 ? 'design' : 'holdout', measures: r});
}
const manifest = {schema: 'line.label-study.v1', id, created: new Date().toISOString(),
  instructions: 'Each clip loops 1.5 s around one beat of the specification. The timeline shows every specified beat in the clip; judge only the marked one. Leave "n/a" when unsure.',
  questions: [
    {id: 'hits', text: 'How many distinct hits do you see in the clip?', options: ['0', '1', '2', '3+']},
    {id: 'strength', text: 'How hard is the hit on the beat?', options: ['none', 'very soft', 'soft', 'medium', 'hard', 'very hard']},
    {id: 'clarity', text: 'How clean is it?', options: ['clean', 'a bit messy', 'messy']},
    {id: 'timing', text: 'When does the hit land relative to the beat?', options: ['early', 'on the beat', 'late', 'no hit']},
  ], clips};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
writeFileSync(join(dir, 'key.json'), JSON.stringify(key));
const counts: Record<string, number> = {};
for (const k of key) counts[`${k.set}/${k.reason}`] = (counts[`${k.set}/${k.reason}`] ?? 0) + 1;
console.log(`study ${id}: ${clips.length} clips from ${recordFor.size} rides`, counts);
