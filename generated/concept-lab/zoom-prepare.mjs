// node generated/concept-lab/zoom-prepare.mjs [--out=DIR] [KEY=SONG@RIDE_DIR[#VARIANT] ...]
// Scenes for the zoom page from rides that are already compiled. Each argument names the page's key for a song, the song, the
// folder holding its compiled ride (*-production.json), and the variant it was compiled from (spec.ts when left out). The scene
// carries the song's zoom lanes (scripts/video/zooms.ts). Without songs it prepares the two handcrafted readings it was written
// for; without --out it writes beside the hit study's scenes (generated/hit-effects/data).
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {buildScene} from '../../scripts/video/scene.ts';
const args = process.argv.slice(2), out = args.find(a => a.startsWith('--out='))?.slice(6) ?? 'generated/hit-effects/data';
const jobs = args.filter(a => !a.startsWith('--')).map(a => {
  const m = /^([\w-]+)=(\w+)@([^#]+)(?:#([\w-]+))?$/.exec(a);
  if (!m) throw new Error(`expected KEY=SONG@RIDE_DIR[#VARIANT], got ${a}`);
  return {key: m[1], song: m[2], dir: m[3], variant: m[4] ?? null};
});
if (!jobs.length) for (const [key, song, variant] of [['petrunko', 'petrunko_selection', 'build'], ['trouble', 'trouble_50s', 'contrast-clusters-revisited']])
  jobs.push({key, song, dir: `generated/handcraft-20261115/${song}/${variant}`, variant});
mkdirSync(out, {recursive: true});
for (const {key, song, dir, variant} of jobs) {
  const name = readdirSync(dir).find(n => n.endsWith('-production.json'));
  if (!name) throw new Error(`no compiled ride in ${dir}`);
  const ride = JSON.parse(readFileSync(join(dir, name))), scene = buildScene(song, ride);
  const specification = variant ? `productions/${song}/variants/${variant}.ts` : `productions/${song}/spec.ts`;
  const spec = (await import(`../../${specification}`)).default;
  writeFileSync(join(out, `${key}.json`), JSON.stringify({...scene, provenance: {production: join(dir, name), specification}, authoredCamera: spec.camera ?? null}));
  console.log(key, scene.span, `${scene.zooms.length} lanes`, scene.phases.map(p => p.name).join(' | '));
}
