/** Export native-validated construction demonstrations, with source provenance.
 * Runtime lookup uses physical state, musical targets and constructor identity;
 * it has no song, seed, section number or benchmark-case lookup. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {arcConstructionMemoryKey,type ArcControlExample} from '../v0/optimizer/arc_memory.ts';
import {constructionStyle} from '../v0/optimizer/repertoire_policy.ts';
const arg=(k:string,d='')=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const studies=arg('studies').split(','),sourceManifest=arg('sources'),excluded=new Set(arg('exclude').split(','));
assert.ok((!!sourceManifest!==!!arg('studies'))&&arg('out'),
 '--studies=DIR,... OR --sources=PROVENANCE.json; --out=FILE.gz [--exclude=song,...]');
const groups:Record<string,ArcControlExample[]>={},sources:any[]=[],seen=new Set<string>();
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const sourceBytes=sourceManifest?readFileSync(sourceManifest):undefined;
if(sourceBytes)assert.equal(sha(sourceBytes),readFileSync(sourceManifest+'.sha256','utf8').trim());
const frozenSources=sourceBytes?JSON.parse(sourceBytes.toString()):undefined;
if(frozenSources){assert.equal(frozenSources.schema,'line.construction-examples.provenance.v1');
 for(const song of frozenSources.excluded)excluded.add(song);}
const paths:Array<{path:string;sha256?:string}>=frozenSources?.sources??studies.flatMap(directory=>
 readdirSync(directory).filter(n=>n.endsWith('.json')).sort().map(name=>({path:resolve(directory,name)})));
for(const input of paths){
 const path=resolve(input.path),bytes=readFileSync(path);
 if(input.sha256)assert.equal(sha(bytes),input.sha256,'frozen example source changed');
 const r=JSON.parse(bytes.toString());
 if(!r.rows||!r.plan||!r.realization||excluded.has(r.song))continue;
 let accepted=0;
 for(const [i,row]of r.rows.entries()){
  const request=r.plan.requests[i],check=r.realization.sections[i];
  if(!request?.context||!check?.fulfilled||!row.control||row.features?.length!==57||
    !row.features.every(Number.isFinite)||!Number.isFinite(row.incoming)||!(row.span>0))continue;
  const features=row.features.slice();
  if(arg('relabel','false')==='true'){
    // A demonstration describes what this control actually achieved, not the
    // target it missed. Keep absent axes and later musical context unchanged.
    for(const [j,value]of [row.impact,row.achieved?.air,row.achieved?.speed,row.achieved?.amplitude].entries())
      if(features[48+j]>=0&&Number.isFinite(value))features[48+j]=value;
  }
  const example={control:row.control,incoming:row.incoming,span:row.span,features};
  const key=arcConstructionMemoryKey({...r.changes,...constructionStyle(request)}),identity=sha(JSON.stringify([key,example]));
  if(seen.has(identity))continue;seen.add(identity);
  (groups[key]??=[]).push(example);accepted++;
 }
 sources.push({path,sha256:sha(bytes),song:r.song,seed:r.seed,valid:r.valid,accepted});
}
const result={schema:'line.construction-examples.v1',groups};
assert.ok(seen.size,'no validated examples');
const out=resolve(arg('out')),bytes=gzipSync(Buffer.from(JSON.stringify(result)+'\n'),{level:9});
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,bytes);writeFileSync(out+'.sha256',sha(bytes)+'\n');
const evidence={schema:'line.construction-examples.provenance.v1',relabel:arg('relabel','false')==='true',excluded:[...excluded].filter(Boolean),
 ...(sourceBytes?{sourceManifest:{path:resolve(sourceManifest),sha256:sha(sourceBytes)}}:{}),
 corpusSha256:sha(bytes),examples:seen.size,groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),sources};
const body=JSON.stringify(evidence,null,2)+'\n';writeFileSync(out+'.provenance.json',body);writeFileSync(out+'.provenance.json.sha256',sha(body)+'\n');
console.log(JSON.stringify({out,examples:seen.size,groups:Object.keys(groups).length,bytes:bytes.length}));
