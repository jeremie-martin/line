/** Builds a blind pair study for the dashboard (motion-gallery/pairs.html): plain
 * landscape renders of each ride (spec camera, no overlay or beat punch), a
 * clip around each hit, and the manifest the labels API validates.
 *
 *   node --import tsx tools/measure/pair_study.ts --key=labels/studies/<study>.key.json --study=<study>
 *       [--library=generated/production-repertoire/library-strike-s1] [--jobs=4]
 *
 * The key lists pairs as {pair, left, right, a, b} where left/right name which
 * hit ('body-first' = a, otherwise b) is shown on each side. */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {ensureMirror} from '../../scripts/produce/render.ts';
import {songSpec} from './observe.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study')!, key = JSON.parse(readFileSync(arg('key')!, 'utf8'));
const library = arg('library', 'generated/production-repertoire/library-strike-s1')!, jobs = Number(arg('jobs', '4'));
const out = join('generated/label-studies', study), rides = join(out, 'rides'), clips = join(out, 'clips');
mkdirSync(rides, {recursive: true}); mkdirSync(clips, {recursive: true});
const BEFORE = 1.0, LENGTH = 1.8;

const ids = [...new Set(key.flatMap((p: any) => [p.a, p.b].map((h: any) => `${h.song}-${h.seed}`)))] as string[];
const run = (args: string[]) => new Promise<void>((done, fail) => {
  const child = spawn(process.execPath, ['--import', 'tsx', ...args], {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']});
  child.once('exit', code => code === 0 ? done() : fail(new Error(`${args[0]} exited ${code}`)));
});
const mirror = await ensureMirror();
try {
  const queue = ids.filter(id => !existsSync(join(rides, id + '.mp4')));
  await Promise.all(Array.from({length: jobs}, async () => {
    while (queue.length) {
      const id = queue.shift()!, song = id.replace(/-\d+$/, ''), silent = join(rides, id + '.video.mp4');
      const manifest = JSON.parse(readFileSync(join(library, id, 'manifest.json'), 'utf8'));
      await run(['scripts/export.ts', `--track=${join(library, id, manifest.cells[0].trackPath)}`, `--spec=productions/${song}/spec.ts`,
        '--zoom=action', '--zoom-mult=3.5', '--res=1280x720', `--out=${silent}`]);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', `productions/${song}/audio.mp3`, '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-shortest', join(rides, id + '.mp4')]);
      console.log(`rendered ${id}`);
    }
  }));
} finally {mirror?.kill();}

const side = (p: any, s: 'left' | 'right') => p[s] === 'body-first' ? p.a : p.b;
for (const p of key) for (const s of ['left', 'right'] as const) {
  const h = side(p, s);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(h.frame / 40 - BEFORE), '-i', join(rides, `${h.song}-${h.seed}.mp4`), '-t', String(LENGTH),
    '-vf', 'scale=960:540', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', join(clips, `pair${p.pair}-${s}.mp4`)]);
}
// Each side carries the specification beats inside its clip (seconds from clip
// start, with the requested strength); the judged hit is at hitAt.
const specs = new Map<string, Awaited<ReturnType<typeof songSpec>>>();
for (const song of new Set(key.flatMap((p: any) => [p.a.song, p.b.song]))) specs.set(song as string, await songSpec(song as string));
const beats = (h: any) => {
  const start = h.frame / 40 - BEFORE;
  return specs.get(h.song)!.targets.filter((t: any) => t.frame / 40 >= start && t.frame / 40 <= start + LENGTH)
    .map((t: any) => ({t: +(t.frame / 40 - start).toFixed(4), impact: t.impact ?? null}));
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify({study, kind: 'pairs', hitAt: BEFORE, length: LENGTH,
  prompt: 'Both hits are on beats that ask for a strong hit, and the current measure rates them about equally strong. Which one feels more like the rider slamming into the ground?',
  questions: [{id: 'slam', options: ['left', 'right', 'same', 'neither']}],
  clips: key.map((p: any) => ({id: `pair${p.pair}`,
    left: {src: `/${clips}/pair${p.pair}-left.mp4`, beats: beats(side(p, 'left'))},
    right: {src: `/${clips}/pair${p.pair}-right.mp4`, beats: beats(side(p, 'right'))}}))}, null, 1));
console.log(`${study}: ${key.length} pairs in ${resolve(out)}`);
process.exit(0);
