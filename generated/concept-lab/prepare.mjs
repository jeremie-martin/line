// The lab's scenes: node generated/concept-lab/prepare.mjs [--old] [song…]
// Each song's scene is built by the video renderer's own scene builder (scripts/video/scene.ts) from its saved ride, so the lab
// draws exactly what a finished video would. Sets (rides.js): the lab's rides (recompile.sh) in rides/ → data/; --old, the
// music-library round-2 rides (rounds 1–5) → data-r5/.
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {buildScene} from '../../scripts/video/scene.ts';
import {describeTiming} from '../../scripts/video/timing.js';
import {SONGS, rideSet} from './rides.js';

const ROOT = resolve(import.meta.dirname, '../..'), LAB = import.meta.dirname;
const args = process.argv.slice(2), keys = args.filter(a => !a.startsWith('--'));
const set = args.includes('--old') ? 'old' : '';
const record = dir => {const f = existsSync(dir) && readdirSync(dir).find(f => f.endsWith('-production.json')); return f ? join(dir, f) : null;};
const out = join(LAB, rideSet(set).dir);
mkdirSync(out, {recursive: true});
for (const key of keys.length ? keys : Object.keys(SONGS)) {
  if (!Object.hasOwn(SONGS, key)) throw new Error(`unknown song ${key}`);
  const {song, round5} = SONGS[key];
  if (set === 'old' && !round5) continue;
  const path = set === 'old' ? record(join(ROOT, 'generated/music-library-round2/rides', round5)) : record(join(LAB, 'rides', key));
  if (!path) throw new Error(`${key}: no saved ride${set === 'old' ? '' : ' (run recompile.sh first)'}`);
  const scene = buildScene(song, JSON.parse(readFileSync(path, 'utf8')));
  writeFileSync(join(out, `${key}.json`), JSON.stringify(scene));
  console.log(key, scene.account?.matches.length ?? 0, 'hits', scene.phases.length, 'phases', scene.drop ? `drop ${scene.drop.join('–')}` : 'no drop', describeTiming(scene.timing));
}
