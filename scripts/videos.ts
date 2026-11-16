/** A batch of production videos: every chosen song at every chosen seed, each through `npm run video` (a fresh compile, the
 * look and the zoom lane chosen for the ride), several at a time. Run it again with the same folder to continue: written
 * videos are kept, and nothing is ever deleted. It ends with a report of what was made and what failed. */
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, openSync, closeSync} from 'node:fs';
import {basename, join, relative, resolve} from 'node:path';
import {batchPlan, batchStep, type BatchVideo} from './produce/video_batch.ts';

const HELP = `Usage: npm run videos -- --songs=all|SONG,SONG --seeds=N|SEED,SEED --out=DIR [--jobs=6] [video options]

Makes DIR/SONG-SEED.mp4 for every song at every seed (a count N means seeds 1 to N), each with its sidecar and compile
folder, DIR/SONG-SEED.log, and DIR/report.json. Run again with the same DIR to continue; a video whose earlier attempt
failed is left as it is (remove its .assets folder to try it again).
Passed on to every video: --width, --look, --zoom, --set, --budget, --wider-near, --wider-far (npm run video -- --help).
With DIR under generated/videos/, the batch can be watched at
/motion-gallery/video-compare.html?collection=/generated/watch/NAME.json (NAME: the folder's name).`;

type Result = BatchVideo & {state: 'made' | 'kept' | 'failed' | 'failed-earlier'; theme?: string; zoom?: string | null; valid?: boolean; score?: number; seconds?: number; error?: string};

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help')) {console.log(HELP); return;}
  const own: Record<string, string> = {}, passed: string[] = [];
  for (const token of argv) {
    const match = /^--([^=]+)=(.+)$/.exec(token);
    if (!match) throw new Error(`Incomplete option: ${token}. Use --help.`);
    if (['songs', 'seeds', 'out', 'jobs'].includes(match[1])) own[match[1]] = match[2];
    else if (['width', 'look', 'zoom', 'set', 'budget', 'wider-near', 'wider-far'].includes(match[1])) passed.push(token);
    else throw new Error(`Unknown option for a batch: ${token}. Use --help.`);
  }
  if (!own.songs || !own.seeds || !own.out) throw new Error('A batch needs --songs, --seeds and --out. Use --help.');
  const jobs = Number(own.jobs ?? 6);
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error('--jobs must be a positive integer');
  const known = readdirSync('productions').filter(d => existsSync(join('productions', d, 'spec.ts'))).sort();
  const plan = batchPlan(own.songs, own.seeds, known), out = resolve(own.out);
  mkdirSync(out, {recursive: true});
  const at = (v: BatchVideo, ext: string) => join(out, v.name + ext);
  // what a written video says of itself: its look and lane from the sidecar, the ride's completion and score from its record
  const read = (v: BatchVideo): Partial<Result> => {
    const side = JSON.parse(readFileSync(at(v, '.json'), 'utf8'));
    const record = join(at(v, '.assets'), 'production', `${v.song}-${v.seed}-production.json`);
    const ride = existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')) : {};
    return {theme: side.partner ? `${side.theme} → ${side.partner}` : side.theme, zoom: side.zoom, valid: ride.valid, score: ride.score, seconds: side.seconds};
  };
  const results: Result[] = [], queue: BatchVideo[] = [];
  for (const v of plan) {
    const step = batchStep({video: existsSync(at(v, '.mp4')), sidecar: existsSync(at(v, '.json')), assets: existsSync(at(v, '.assets'))});
    if (step === 'make') queue.push(v);
    else results.push(step === 'done' ? {...v, state: 'kept', ...read(v)} : {...v, state: 'failed-earlier', error: `an earlier attempt failed (${v.name}.log); remove ${v.name}.assets to try again`});
  }
  console.log(`Batch · ${plan.length} videos (${queue.length} to make, ${plan.length - queue.length} already there) · ${jobs} at a time\nOutput: ${out}`);
  let finished = 0;
  const make = (v: BatchVideo) => new Promise<void>(done => {
    const fd = openSync(at(v, '.log'), 'w');
    const child = spawn(process.execPath, ['scripts/video.ts', `--song=${v.song}`, `--seed=${v.seed}`, `--out=${at(v, '.mp4')}`, ...passed], {stdio: ['ignore', fd, fd]});
    const end = (failure?: string) => {
      closeSync(fd);
      const error = failure ?? (existsSync(at(v, '.json')) ? undefined : 'no video written');
      results.push(error ? {...v, state: 'failed', error: `${error}: ${readFileSync(at(v, '.log'), 'utf8').trim().split('\n').at(-1) ?? ''}`.slice(0, 300)} : {...v, state: 'made', ...read(v)});
      console.log(`${String(++finished).padStart(String(queue.length).length)}/${queue.length} · ${v.name} · ${error ? 'FAILED' : 'made'}`);
      done();
    };
    child.once('error', e => end(e.message));
    child.once('exit', code => end(code === 0 ? undefined : `exited ${code}`));
  });
  const next = async (): Promise<void> => {for (let v = queue.shift(); v; v = queue.shift()) await make(v);};
  await Promise.all(Array.from({length: Math.min(jobs, queue.length)}, next));

  results.sort((a, b) => plan.findIndex(v => v.name === a.name) - plan.findIndex(v => v.name === b.name));
  writeFileSync(join(out, 'report.json'), JSON.stringify({videos: results}, null, 1) + '\n');
  // a collection for the video comparison page: one passage per song, its seeds side by side
  const root = relative(resolve('generated'), out), written = results.filter(r => r.state === 'made' || r.state === 'kept');
  if (!root.startsWith('..') && written.length) {
    const seeds = [...new Set(plan.map(v => v.seed))];
    mkdirSync('generated/watch', {recursive: true});
    writeFileSync(join('generated/watch', `${basename(out)}.json`), JSON.stringify({title: `Batch ${basename(out)}`,
      description: `${written.length} production videos: each ride with the look and the zoom lane chosen for it.`,
      groups: [{id: 'all', label: 'All', variants: seeds.map(s => `seed-${s}`)}],
      passages: [...new Set(written.map(r => r.song))].map(song => ({id: song, label: song.replace(/_/g, ' '),
        videos: written.filter(r => r.song === song).map(r => ({id: `seed-${r.seed}`, label: `seed ${r.seed} · ${r.theme} · zoom ${r.zoom ?? 'steady'}${r.valid === false ? ' · ride incomplete' : ''}`,
          src: `/generated/${root}/${r.name}.mp4`}))}))}, null, 1) + '\n');
    console.log(`Watch: /motion-gallery/video-compare.html?collection=/generated/watch/${basename(out)}.json`);
  }
  const failed = results.filter(r => r.state === 'failed' || r.state === 'failed-earlier'), incomplete = written.filter(r => r.valid === false);
  console.log(`\n${written.length} of ${plan.length} videos written · ${failed.length} failed · ${incomplete.length} of a ride that did not complete`);
  for (const r of failed) console.log(`  FAILED ${r.name}: ${r.error}`);
  for (const r of incomplete) console.log(`  incomplete ride: ${r.name}`);
  if (failed.length) process.exitCode = 1;
}
await main().catch(error => {console.error(`Batch failed: ${error.message ?? error}`); process.exitCode = 1;});
