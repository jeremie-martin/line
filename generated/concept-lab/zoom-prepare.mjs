// node generated/concept-lab/zoom-prepare.mjs
// Scenes for the zoom page from rides that are already compiled (the handcrafted readings), beside the two of the hit study.
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {buildScene} from '../../scripts/video/scene.ts';
const out = 'generated/hit-effects/data'; mkdirSync(out, {recursive: true});
for (const [key, song, variant] of [['petrunko', 'petrunko_selection', 'build'], ['trouble', 'trouble_50s', 'contrast-clusters-revisited']]) {
  const dir = `generated/handcraft-20261115/${song}/${variant}`, name = readdirSync(dir).find(n => n.endsWith('-production.json'));
  const ride = JSON.parse(readFileSync(`${dir}/${name}`)), scene = buildScene(song, ride);
  const spec = (await import(`../../productions/${song}/variants/${variant}.ts`)).default;
  writeFileSync(`${out}/${key}.json`, JSON.stringify({...scene, provenance: {production: `${dir}/${name}`, specification: `productions/${song}/variants/${variant}.ts`}, authoredCamera: spec.camera ?? null}));
  console.log(key, scene.span, scene.phases.map(p => p.name).join(' | '));
}
