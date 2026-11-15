// node generated/concept-lab/prepare-rides.mjs [--out=DIR] SONG@RIDE_DIR ...
// Scenes for the lab's tuning pages (zoom, hit movement) from rides that are already compiled: each argument names a song (a
// folder of productions/) and the folder holding its compiled ride (*-production.json). The scene is what a video of that ride
// is drawn from (scene.ts), with the song's zoom lanes as they are now: prepare again after editing lanes.
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {buildScene} from '../../scripts/video/scene.ts';
const args = process.argv.slice(2), out = args.find(a => a.startsWith('--out='))?.slice(6) ?? 'generated/lab-rides';
mkdirSync(out, {recursive: true});
for (const arg of args.filter(a => !a.startsWith('--'))) {
  const [song, dir] = arg.split('@');
  if (!song || !dir) throw new Error(`expected SONG@RIDE_DIR, got ${arg}`);
  const name = readdirSync(dir).find(n => n.endsWith('-production.json'));
  if (!name) throw new Error(`no compiled ride in ${dir}`);
  const scene = buildScene(song, JSON.parse(readFileSync(join(dir, name))));
  writeFileSync(join(out, `${song}.json`), JSON.stringify({...scene, provenance: {production: join(dir, name)}}));
  console.log(song, scene.span, `${scene.zooms.length} lanes`, scene.phases.map(p => p.name).join(' | '));
}
