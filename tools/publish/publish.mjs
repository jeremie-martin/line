// Videos for the upload queue: node tools/publish/publish.mjs --count=N [--jobs=3] [--host=holo@rpi.local] [--keep-local]
// (run from the repository root). Each video: a song of the production set and a seed drawn at random (the look and the zoom
// lane follow from the ride, scripts/video/choose.js), compiled and rendered as any production video (`npm run video`), which
// refuses a ride that misses a landing: another seed is drawn then. The video goes to the uploader's inbox on the host as one
// bundle (the uploader's PROJECT_UPLOAD_CONTRACT.md): copied into a hidden staging folder, then renamed into place, so the
// uploader never sees half of it. Titles, description, tags and cadence are the uploader's (its projects/line.toml); the bundle
// gives the values they use: the song, its artist, how many times the rider lands.
// What was sent is in labels/published.jsonl (one row per video); a song and seed are never sent twice.
import {spawn, execFileSync} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const count = Number(arg('count', 1)), jobs = Number(arg('jobs', 3)), host = arg('host', 'holo@rpi.local'), inbox = arg('inbox', '.local/share/uploader/inbox');
const LEDGER = 'labels/published.jsonl', OUT = 'generated/publish';
if (!Number.isInteger(count) || count < 1) throw new Error('--count must be a positive integer');
mkdirSync(OUT, {recursive: true});
const sent = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const used = new Set(sent.map(r => `${r.song}@${r.seed}`));
const songs = readdirSync('productions').filter(d => d.startsWith('short_') && existsSync(join('productions', d, 'spec.ts'))).sort();
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim();
const run = (cmd, args) => new Promise(done => {const child = spawn(cmd, args, {stdio: ['ignore', 'ignore', 'pipe']}); let err = ''; child.stderr.on('data', d => {err = (err + d).slice(-600);}); child.once('exit', code => done({code, err}));});

// every song once before any song twice, in a random order; among the songs, those sent least so far come first
const times = song => sent.filter(r => r.song === song).length;
const order = [];
while (order.length < count) order.push(...songs.map(song => ({song, at: times(song) + order.filter(o => o === song).length, r: Math.random()})).sort((a, b) => a.at - b.at || a.r - b.r).map(x => x.song).slice(0, count - order.length));

async function one(song) {
  const meta = (await import(`${process.cwd()}/productions/${song}/spec.ts`)), spec = meta.default, {title, artist} = meta.overlayMeta;
  for (let attempt = 0; attempt < 5; attempt++) {
    let seed; do seed = 1 + Math.floor(Math.random() * 999_999); while (used.has(`${song}@${seed}`));
    used.add(`${song}@${seed}`);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), id = `line-${song.replace(/^short_/, '')}-${seed}-${stamp}`, video = join(OUT, `${id}.mp4`);
    const made = await run(process.execPath, ['scripts/video.ts', `--song=${song}`, `--seed=${seed}`, `--out=${video}`]);
    if (made.code !== 0) {console.log(`  ${song} seed ${seed}: no video (${made.err.trim().split('\n').at(-1)?.slice(0, 120)}); another seed`); continue;}
    const side = JSON.parse(readFileSync(video.replace(/\.mp4$/, '.json'), 'utf8')), now = new Date();
    const bundle = `line/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}/${id}`, staging = `${inbox}/.staging-${id}`;
    const upload = {project: 'line', video: 'video.mp4', created_at: now.toISOString(), values: {song: title, artist: artist ?? '', landings: spec.contacts.length},
      meta: {song_id: song, seed, theme: side.theme, partner: side.partner ?? null, zoom: side.zoom ?? null, line_commit: commit, seconds: Number((side.to - side.from).toFixed(2))}};
    const sidecar = join(OUT, `${id}.upload.json`); writeFileSync(sidecar, JSON.stringify(upload, null, 2) + '\n');
    const steps = [['ssh', [host, `mkdir -p '${staging}'`]], ['scp', ['-q', video, `${host}:${staging}/video.mp4`]], ['scp', ['-q', sidecar, `${host}:${staging}/upload.json`]],
      ['ssh', [host, `mkdir -p '${inbox}/${bundle.split('/').slice(0, -1).join('/')}' && mv '${staging}' '${inbox}/${bundle}'`]]];
    for (const [cmd, args] of steps) {const r = await run(cmd, args); if (r.code !== 0) throw new Error(`${cmd} failed for ${id}: ${r.err.trim()}`);}
    appendFileSync(LEDGER, JSON.stringify({at: now.toISOString(), song, seed, bundle, host, title, artist, landings: spec.contacts.length, theme: side.theme, zoom: side.zoom ?? null, line_commit: commit}) + '\n');
    console.log(`sent  ${bundle}  (${title}, ${side.theme}, zoom ${side.zoom ?? 'steady'})`);
    return true;
  }
  console.log(`FAILED ${song}: no complete ride in five seeds`); return false;
}
let ok = 0;
await Promise.all(Array.from({length: Math.min(jobs, count)}, async () => {for (let song; (song = order.shift());) if (await one(song)) ok++;}));
console.log(`${ok} of ${count} videos sent to ${host}`);
