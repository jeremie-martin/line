/** Before/after clips of the same beat for the night report: two eval runs with
 * saved tracks (dev panel, authored cells), the same song, seed and beat. The
 * selection is honest: the largest improvements, random strong beats, the worst
 * regression and one quiet beat, each labelled by why it was chosen.
 *
 *   node --import tsx tools/report/clips.ts --before=<run> --after=<run> [--out=generated/report/night] [--seed=7] */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {loadRun} from '../eval/summary.ts';
import {renderRides, cutClip, CLIP_BEFORE} from '../measure/clip_render.ts';
import {makeRng} from '../../scripts/lib/rng.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const before = arg('before')!, after = arg('after')!, out = arg('out', 'generated/report/night')!, rng = makeRng(Number(arg('seed', '7')));
const A = loadRun(before), B = loadRun(after);
const TITLES: Record<string, string> = {luna_bala_44s: 'Luna Bala', amor_na_praia_46s: 'Amor na Praia', tiki_tiki_48s: 'Tiki Tiki', amour_de_ma_vie_44s: 'L’amour de ma vie'};

type Beat = {id: string; song: string; seed: number; beat: number; frame: number; requested: number; before: number; after: number; fb: number; fa: number};
const beats: Beat[] = [];
for (const [id, a] of A.cells) {
  const b = B.cells.get(id); if (!b || a.case.perturbation) continue;
  a.impact3.perBeat.forEach((r: any[], j: number) => {
    const s = b.impact3.perBeat[j], frame = a.beats[j]?.frame ?? Math.round(a.beats[j].t * 40);
    if (r[0] == null || r[1] == null || s[1] == null) return;
    beats.push({id, song: a.case.song, seed: a.case.seed, beat: j, frame, requested: r[0], before: r[1], after: s[1], fb: frame + r[2], fa: frame + s[2]});
  });
}
const gain = (x: Beat) => Math.abs(x.before - x.requested) - Math.abs(x.after - x.requested);
const strong = beats.filter(x => x.requested >= .6), picked: Array<Beat & {why: string}> = [];
const take = (x: Beat | undefined, why: string) => {if (x && !picked.some(p => p.id === x.id && p.beat === x.beat)) picked.push({...x, why});};
// Largest improvements (at most one per song), as many random strong beats, the worst regression.
for (const x of [...strong].sort((p, q) => gain(q) - gain(p))) if (picked.filter(p => p.why === 'largest improvement').length < 3 && !picked.some(p => p.song === x.song)) take(x, 'largest improvement');
for (let k = 0; k < 3; k++) take(strong[Math.floor(rng() * strong.length)], 'random strong beat');
take([...strong].sort((p, q) => gain(p) - gain(q))[0], 'worst regression');
take([...beats.filter(x => x.requested < .15)].sort((p, q) => gain(q) - gain(p))[0], 'quiet beat, largest improvement');

const tracks = new Map<string, {song: string; track: any}>();
// Renders are cached by run and case, so another pair of runs never reuses them.
for (const p of picked) for (const [key, run] of [['before', before], ['after', after]]) {
  const rid = `${run}~${p.id}`;
  if (!tracks.has(rid)) tracks.set(rid, {song: p.song, track: JSON.parse(gunzipSync(readFileSync(join('generated/eval', run, 'cells', p.id + '.track.json.gz'))).toString())});
}
await renderRides(tracks, join(out, 'rides'), 8);
mkdirSync(join(out, 'clips'), {recursive: true});
const pairs = picked.map((p, n) => {
  const clip = (key: string, run: string, frame: number) => {const file = join(out, 'clips', `${n + 1}-${key}.mp4`); cutClip(join(out, 'rides', `${run}~${p.id}.mp4`), frame, file); return '/' + file;};
  return {title: `${TITLES[p.song] ?? p.song} · seed ${p.seed} · ${(p.frame / 40).toFixed(2)} s · request ${p.requested.toFixed(2)} (${p.why})`,
    why: p.why, requested: p.requested, before: {src: clip('before', before, p.fb), strength: p.before}, after: {src: clip('after', after, p.fa), strength: p.after}};
});
writeFileSync(join(out, 'clips.json'), JSON.stringify({before, after, beforeLabel: arg('before-label', 'Evening'), afterLabel: arg('after-label', 'Tonight'), hitAt: CLIP_BEFORE, pairs}, null, 1));
console.log(`${pairs.length} clip pairs in ${out}`);
process.exit(0);
