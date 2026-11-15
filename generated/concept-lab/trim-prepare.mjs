// node generated/concept-lab/trim-prepare.mjs RIDES_DIR
// Data for the trim map: each song's ride as compiled today (base), and the ids of the lines each trimmed version keeps.
// RIDES_DIR holds <version>/<song>/<...>-production.json for versions base, trim, one, exact (branch exp/trim-support-ends).
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {buildScene} from '../../scripts/video/scene.ts';
const rides = process.argv[2], out = 'generated/trim/data'; mkdirSync(out, {recursive: true});
const load = (version, key) => {const dir = `${rides}/${version}/${key}`; return JSON.parse(readFileSync(`${dir}/${readdirSync(dir).find(n => n.endsWith('-production.json'))}`));};
for (const [key, song] of [['petrunko', 'petrunko_selection'], ['trouble', 'trouble_50s'], ['tiki', 'tiki_tiki_48s'], ['circus', 'circus_minimus_77s']]) {
  const base = load('base', key), scene = buildScene(song, base);
  const kept = Object.fromEntries(['trim', 'one', 'exact'].map(v => [v, load(v, key).track.lines.map(l => l.id)]));
  writeFileSync(`${out}/${key}.json`, JSON.stringify({scene: {...scene, spectrum: undefined}, kept}));
  console.log(key, base.track.lines.length, Object.entries(kept).map(([v, ids]) => `${v} ${ids.length}`).join(', '));
}
