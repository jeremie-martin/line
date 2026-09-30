/** Bundle the already-vendored v2153 modules unchanged. No editor or remote CDN. */
import {build} from 'esbuild';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(root,'generated/motion-gallery-renderer');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources={};
mkdirSync(out,{recursive:true});
const result=await build({absWorkingDir:root,entryPoints:['scripts/gallery/native/view.js','scripts/gallery/native/worker.js'],outdir:out,
  bundle:true,format:'esm',minify:true,metafile:true,plugins:[{name:'vendored-line-rider',setup(b){
    b.onResolve({filter:/^native:\d+$/},a=>({path:a.path.slice(7),namespace:'native'}));
    b.onResolve({filter:/^\.\/\d+\.js$/,namespace:'native'},a=>({path:a.path.slice(2,-3),namespace:'native'}));
    b.onLoad({filter:/^\d+$/,namespace:'native'},a=>{
      const path=`unpacked/${a.path}.js`,contents=readFileSync(resolve(root,path),'utf8');
      sources[path]=sha(contents);return {contents,loader:'js'};
    });
  }}]});
for(const path of ['scripts/gallery/build_renderer.mjs','scripts/gallery/native/view.js','scripts/gallery/native/worker.js','mirror/_v2153.0/bosh-sprite.svg'])sources[path]=sha(readFileSync(resolve(root,path)));
const outputs=Object.fromEntries(Object.keys(result.metafile.outputs).map(p=>[p,sha(readFileSync(resolve(root,p)))]));
writeFileSync(resolve(out,'identity.json'),JSON.stringify({version:'v2153.0',sources,outputs},null,2)+'\n');
console.log(`Gallery renderer: ${Object.keys(sources).length} pinned local sources; ${Object.values(result.metafile.outputs).reduce((n,o)=>n+o.bytes,0)} bytes.`);
