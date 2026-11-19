// Films of each song's blend reading under each of its zoom lanes, and the index the comparison page reads.
// node tools/music/lane_films.mjs [jobs=3]   (run from the repository root; resumable: a written film is kept)
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
const out = 'generated/videos/lanes', jobs = Number(process.argv[2] ?? 3);
mkdirSync(out, {recursive: true});
const todo = [], index = {};
for (const song of readdirSync('productions').filter(d => d.startsWith('short_')).sort()) {
  const ride = `generated/dashboard-rides/${song}--blend`, side = `generated/videos/dashboard/${song}--blend.json`;
  if (!existsSync(`productions/${song}/zooms.ts`) || !existsSync(`${ride}/manifest.json`) || !existsSync(side)) {console.log('skipped', song); continue;}
  const lanes = (await import(`${process.cwd()}/productions/${song}/zooms.ts`)).default, theme = JSON.parse(readFileSync(side, 'utf8')).theme;
  index[song] = [];
  for (const lane of lanes) {
    const name = `${song}--blend--${lane.id}-${createHash('sha256').update(JSON.stringify(lane.keyframes) + theme).digest('hex').slice(0, 8)}`;
    index[song].push({...lane, file: name});
    if (!existsSync(`${out}/${name}.mp4`)) todo.push({song, lane: lane.id, name, args: ['scripts/video.ts', `--study=${ride}`, `--look=${theme}`, `--zoom=${lane.id}`, '--review', `--out=${out}/${name}.mp4`]});
  }
}
console.log(`${todo.length} films to make`);
let failed = 0;
await Promise.all(Array.from({length: jobs}, async () => {
  for (let job; (job = todo.shift());) {
    const code = await new Promise(done => spawn(process.execPath, job.args, {stdio: 'ignore'}).once('exit', done));
    if (code !== 0) failed++;
    console.log(code === 0 ? 'made' : 'FAILED', job.name);
  }
}));
for (const song of Object.keys(index)) index[song] = index[song].filter(l => existsSync(`${out}/${l.file}.mp4`))
  .map(({file, ...lane}) => ({...lane, url: `/${out}/${file}.mp4`, madeAt: statSync(`${out}/${file}.mp4`).mtime.toISOString()}));
writeFileSync(`${out}/index.json`, JSON.stringify(index, null, 1) + '\n');
console.log(`index written; ${failed} failed`);
