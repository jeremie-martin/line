// Bundle src/native.js with the same vendored-module resolution as the gallery renderer.
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
await build({absWorkingDir: root, entryPoints: ['generated/concept-lab/src/native.js'], outdir: 'generated/concept-lab/dist',
  bundle: true, format: 'esm', minify: true, plugins: [{name: 'vendored-line-rider', setup(b) {
    b.onResolve({filter: /^native:\d+$/}, a => ({path: a.path.slice(7), namespace: 'native'}));
    b.onResolve({filter: /^\.\/\d+\.js$/, namespace: 'native'}, a => ({path: a.path.slice(2, -3), namespace: 'native'}));
    b.onLoad({filter: /^\d+$/, namespace: 'native'}, a => ({contents: readFileSync(resolve(root, `unpacked/${a.path}.js`), 'utf8'), loader: 'js'}));
  }}]});
console.log('concept lab bundle built');
