/** Bundle the vendored v2153 modules the browser needs, unchanged, into generated/renderer/: the picture's rider artwork and
 * replay (scripts/video/native.js, worker.js) and the review players' view. No editor or remote CDN. */
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(root, process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'generated/renderer');
const result = await build({absWorkingDir: root, entryPoints: {native: 'scripts/video/native.js', worker: 'scripts/video/worker.js', view: 'scripts/gallery/native/view.js'}, outdir: out,
  bundle: true, format: 'esm', minify: true, metafile: true, plugins: [{name: 'vendored-line-rider', setup(b) {
    b.onResolve({filter: /^native:\d+$/}, a => ({path: a.path.slice(7), namespace: 'native'}));
    b.onResolve({filter: /^\.\/\d+\.js$/, namespace: 'native'}, a => ({path: a.path.slice(2, -3), namespace: 'native'}));
    b.onLoad({filter: /^\d+$/, namespace: 'native'}, a => ({contents: readFileSync(resolve(root, `unpacked/${a.path}.js`), 'utf8'), loader: 'js'}));
  }}]});
console.log(`Renderer bundle: ${Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0)} bytes in ${out}.`);
