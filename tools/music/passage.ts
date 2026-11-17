/** Passages of a recording that would loop: where to cut a short song from a long one.
 *
 *   node tools/music/passage.ts --song=montagem_coma_selection [--min=30 --max=45] [--around=27,38] [--top=12]
 *   node tools/music/passage.ts --recording=PATH/TO/FILE [...]
 *
 * A video loops well when the music at its end is in step with the music that leads into its start
 * (scripts/video/loop_audio.ts). For a new, shorter cut that can be chosen instead of found afterwards. This lists passages of
 * the full recording, `min` to `max` seconds long, that start on a strong onset at least six seconds in and whose last six
 * seconds have the rhythm of the six seconds before their start (match 1 = the same rhythm). `--around` keeps only passages
 * that contain those moments; with --song they are seconds of that song and are shown in both clocks. It measures and lists;
 * choosing among them is for whoever knows the music. */
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {COMPARED, HOP, decode, recording, rhythm} from '../../scripts/video/loop_audio.ts';

const ROOT = resolve(import.meta.dirname, '../..'), RATE = 48000, STEP = HOP / RATE;
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);

/** Passages [start, end] (seconds) of a rhythm sampled every STEP seconds, best match first, starts at least `apart` seconds
 * from a better passage's. Pure. */
export function passages(beat: Float64Array, {min = 30, max = 45, compared = COMPARED, apart = 1, contain = [] as number[]} = {}): {start: number; end: number; match: number}[] {
  const n = Math.round(compared / STEP), square = new Float64Array(beat.length + 1); for (let i = 0; i < beat.length; i++) square[i + 1] = square[i] + beat[i] * beat[i];
  const norm = (to: number) => Math.sqrt(square[to] - square[to - n]) || 1;
  // starts: the strongest onsets, taken a moment before each so the first sound is whole
  const level = Float64Array.from(beat).sort()[Math.floor(beat.length * 0.9)], starts: number[] = [];
  for (let i = n; i < beat.length - Math.round(min / STEP); i++) if (beat[i] >= level && beat[i] >= beat[i - 1] && beat[i] > beat[i + 1] && (!starts.length || i - starts.at(-1)! > 0.2 / STEP)) starts.push(i - 2);
  const found: {start: number; end: number; match: number}[] = [];
  for (const s of starts) {
    const first = Math.max(...contain, s * STEP), last = Math.min(...contain, s * STEP);
    if (last < s * STEP) continue;
    let best = {start: s * STEP, end: 0, match: -1};
    for (let e = s + Math.round(Math.max(min, first - s * STEP) / STEP); e <= Math.min(beat.length, s + Math.round(max / STEP)); e++) {
      let dot = 0; for (let i = 1; i <= n; i += 2) dot += beat[e - i] * beat[s - i];
      const match = 2 * dot / (norm(e) * norm(s));
      if (match > best.match) best = {start: s * STEP, end: e * STEP, match};
    }
    if (best.end) found.push(best);
  }
  found.sort((a, b) => b.match - a.match);
  return found.filter((p, i) => !found.slice(0, i).some(q => Math.abs(q.start - p.start) < apart && Math.abs(q.end - p.end) < apart));
}

if (import.meta.main) {
  const song = arg('song'), record = song ? JSON.parse(readFileSync(join(ROOT, 'productions', song, 'source.json'), 'utf8')) : null;
  const path = record ? recording(record.file) : arg('recording') && resolve(arg('recording')!), offset = record?.sourceStartSeconds ?? 0;
  if (!path || !existsSync(path)) throw new Error('Usage: node tools/music/passage.ts --song=SONG (with a source.json and its recording here) or --recording=FILE');
  const around = (arg('around') ?? '').split(',').filter(Boolean).map(Number).map(t => t + offset);
  const list = passages(rhythm(decode(path)), {min: +(arg('min') ?? 30), max: +(arg('max') ?? 45), contain: around}).slice(0, +(arg('top') ?? 12));
  const clock = (t: number) => `${t.toFixed(2).padStart(7)} s`;
  console.log(`${path}${song ? `\n${song} is ${offset}–${record.sourceEndSeconds} s of it; times in brackets are that song's` : ''}\n   start        end     length  match`);
  for (const p of list) console.log(`${clock(p.start)} ${clock(p.end)} ${(p.end - p.start).toFixed(2).padStart(7)} s  ${p.match.toFixed(2)}${song ? `   [${(p.start - offset).toFixed(2)} to ${(p.end - offset).toFixed(2)}]` : ''}`);
  if (!list.length) console.log('none');
}
