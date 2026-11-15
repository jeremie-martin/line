// node generated/concept-lab/hit-motion-prepare.mjs
// Compile inputs first into generated/hit-effects/rides/{tiki,circus} with npm run produce.
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildScene} from '../../scripts/video/scene.ts';
import {build} from 'esbuild';
const out = 'generated/hit-effects/data'; mkdirSync(out, {recursive: true});
for (const [key, song] of [['tiki', 'tiki_tiki_48s'], ['circus', 'circus_minimus_77s']]) {
  const dir = `generated/hit-effects/rides/${key}`, name = readdirSync(dir).find(n => n.endsWith('-production.json'));
  const bytes = readFileSync(`${dir}/${name}`), ride = JSON.parse(bytes);
  const scene = buildScene(song, ride);
  const spec = (await import(`../../productions/${song}/spec.ts`)).default;
  const plan = JSON.parse(readFileSync(`${dir}/plan.json`));
  writeFileSync(`${out}/${key}.json`, JSON.stringify({...scene, provenance: {production: `${dir}/${name}`, sha256: createHash('sha256').update(bytes).digest('hex'), compiler: plan.compiler,
    seed: 101, specification: `productions/${song}/spec.ts`}, authoredCamera: spec.camera ?? null, authoredContacts: spec.contacts.map(({t, impact}) => ({t, impact}))}));
  console.log(key, scene.span, scene.account.matches.length, scene.timing);
}
// Exact vendored follower, repackaged for the browser; not another rendering stack.
writeFileSync('generated/hit-effects/follower.cjs', readFileSync('unpacked/560.js'));
await build({entryPoints: ['generated/hit-effects/follower.cjs'], outfile: 'generated/hit-effects/follower.js', bundle: true, format: 'esm', platform: 'browser'});
