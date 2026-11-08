// The lab's scenes: node generated/concept-lab/prepare.mjs [--old] [song…]
// Each song's scene is built by the video renderer's own scene builder (scripts/video/scene.ts) from its saved ride, so the lab
// draws exactly what a finished video would. Rides: the recompiled ones (recompile.sh) in rides/; --old uses the music-library
// round-2 rides (rounds 1–5) and writes data-r5/.
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {buildScene} from '../../scripts/video/scene.ts';

const ROOT = resolve(import.meta.dirname, '../..'), LAB = import.meta.dirname;
// lab key → song (a folder of productions/), and the round-2 ride (none for Circus Minimus, which has only recompiled rides)
export const SONGS = {
  petrunko: ['petrunko_selection', 'petrunko_selection-s202'], lua: ['lua_na_praca_selection', 'lua_na_praca_selection-s101'],
  los: ['los_voltaje_selection', 'los_voltaje_selection-s202'], batidao: ['no_batidao_selection', 'no_batidao_selection-s202'],
  burn: ['let_the_world_burn_selection', 'let_the_world_burn_selection-s202'], coma: ['montagem_coma_selection', 'montagem_coma_selection-s202'],
  tomada: ['montagem_tomada_super_slowed_selection', 'montagem_tomada_super_slowed_selection-s202'], circus: ['circus_minimus_77s', null],
};
const args = process.argv.slice(2), old = args.includes('--old'), keys = args.filter(a => !a.startsWith('--'));
const record = dir => {const f = existsSync(dir) && readdirSync(dir).find(f => f.endsWith('-production.json')); return f ? join(dir, f) : null;};
const out = join(LAB, old ? 'data-r5' : 'data');
mkdirSync(out, {recursive: true});
for (const key of keys.length ? keys : Object.keys(SONGS)) {
  const [song, ride] = SONGS[key] ?? [];
  if (!song) throw new Error(`unknown song ${key}`);
  if (old && !ride) continue;
  const path = old ? record(join(ROOT, 'generated/music-library-round2/rides', ride)) : record(join(LAB, 'rides', key));
  if (!path) throw new Error(`${key}: no saved ride${old ? '' : ' (run recompile.sh first)'}`);
  const scene = buildScene(song, JSON.parse(readFileSync(path, 'utf8')));
  writeFileSync(join(out, `${key}.json`), JSON.stringify(scene));
  console.log(key, scene.account?.matches.length ?? 0, 'hits', scene.phases.length, 'phases', scene.drop ? `drop ${scene.drop.join('–')}` : 'no drop', scene.timing.aligned ? `offset ${(scene.timing.offset * 1000).toFixed(1)} ms` : `as compiled (${scene.timing.reason})`);
}
