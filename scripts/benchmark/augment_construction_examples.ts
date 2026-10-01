/** Add checked canonical demonstrations to an existing construction corpus.
 * All additions use native-fulfilled geometry and physical state/target features.
 * Confirmation data is refused. No case identity enters the runtime examples. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadCatalog} from '../../benchmark/v6/model.ts';
import {constructionStyle} from '../v0/optimizer/repertoire_policy.ts';
import {arcConstructionMemoryKey,type ArcControlExample} from '../v0/optimizer/arc_memory.ts';
const arg=(k:string,d='')=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const checked=(path:string)=>{const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return bytes;};
const base=resolve(arg('base')),run=resolve(arg('run')),out=resolve(arg('out'));
assert.ok(arg('base')&&arg('run')&&arg('out'),'--base=FILE.gz --run=V6_DIRECTORY --out=FILE.gz');
assert.ok(!existsSync(out),'preserve previous corpora');
const maximum=Number(arg('max-error','Infinity'));assert.ok(maximum>0);
const scope=arg('constructors','all');assert.ok(['all','profiled-transfers'].includes(scope));
const excluded=new Set(arg('exclude-parent').split(',').filter(Boolean));
const baseBytes=checked(base),baseData=JSON.parse(gunzipSync(baseBytes).toString());
assert.equal(baseData.schema,'line.construction-examples.v1');
const runBytes=checked(join(run,'run.json')),evaluation=JSON.parse(runBytes.toString());
assert.equal(evaluation.plan.split,'canonical','confirmation must remain reserved');
assert.equal(evaluation.rows.length,evaluation.plan.ids.length*evaluation.plan.seeds.length);
const planHash=sha(checked(join(run,'plan.json'))),catalog=loadCatalog();
const groups:Record<string,ArcControlExample[]>=structuredClone(baseData.groups),seen=new Set<string>();
for(const [key,rows] of Object.entries(groups))for(const row of rows)seen.add(sha(JSON.stringify([key,row])));
const before=seen.size,sources:any[]=[];
for(const cell of evaluation.rows){
 const source:any={id:cell.id,seed:cell.seed,parent:cell.sourceId,valid:cell.valid,accepted:0,duplicates:0,aboveError:0,outsideScope:0};
 sources.push(source);
 assert.equal(cell.split,'canonical');assert.equal(cell.planSha256,planHash);
 if(excluded.has(cell.sourceId)){source.excluded=true;continue;}
 if(!cell.valid||!cell.realization?.fulfilled)continue;
 const c=catalog.cases.find(c=>c.id===cell.id);assert.ok(c&&c.split==='canonical'&&c.sourceId===cell.sourceId);
 const plan=c.plans[cell.seed];assert.ok(plan);
 const path=join(run,'construction',cell.id+'-'+cell.seed+'.json'),bytes=checked(path),construction=JSON.parse(bytes.toString());
 assert.equal(construction.schema,'line.v6-construction-evidence.v1');
 assert.equal(construction.planSha256,planHash);assert.equal(construction.trackHash,cell.trackHash);
 assert.equal(construction.id,cell.id);assert.equal(construction.seed,cell.seed);
 assert.equal(construction.rows.length,plan.requests.length);
 source.path=path;source.sha256=sha(bytes);
 for(const [i,row] of construction.rows.entries()){
  const request=plan.requests[i],check=cell.realization.sections[i];
  assert.equal(request.section,i);assert.equal(check.section,i);
  const style=constructionStyle(request);
  if(scope==='profiled-transfers'&&!style.profile&&style.railLayout!=='transfer'){source.outsideScope++;continue;}
  if(!request.context||!check.fulfilled||!row.control||row.features?.length!==57||
    !row.features.every(Number.isFinite)||!Number.isFinite(row.incoming)||!(row.span>0))continue;
  const observations=[row.impact,row.achieved?.air,row.achieved?.speed,row.achieved?.amplitude];
  const errors=observations.flatMap((value,j)=>row.features[48+j]>=0&&Number.isFinite(value)?[value-row.features[48+j]]:[]);
  const rms=errors.length?Math.sqrt(errors.reduce((n,x)=>n+x*x,0)/errors.length):Infinity;
  if(rms>maximum){source.aboveError++;continue;}
  const example={control:row.control,incoming:row.incoming,span:row.span,features:row.features};
  const key=arcConstructionMemoryKey(style),identity=sha(JSON.stringify([key,example]));
  if(seen.has(identity)){source.duplicates++;continue;}
  seen.add(identity);(groups[key]??=[]).push(example);source.accepted++;
 }
}
assert.ok(seen.size>before,'no new checked demonstrations');
const body=gzipSync(Buffer.from(JSON.stringify({schema:'line.construction-examples.v1',groups})+'\n'),{level:9});
writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
const provenance={schema:'line.canonical-construction-augmentation.v1',base:{path:base,sha256:sha(baseBytes)},
 run:{path:join(run,'run.json'),sha256:sha(runBytes),compiler:evaluation.plan.compiler},
 excludedParents:[...excluded],constructors:scope,maximumPhysicalRms:Number.isFinite(maximum)?maximum:null,
 before,added:seen.size-before,examples:seen.size,groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),sources,
 interpretation:'Canonical development evidence only. Reused music is exposed training data; source and seed identities are absent from runtime features.'};
const record=JSON.stringify(provenance,null,2)+'\n';writeFileSync(out+'.provenance.json',record);writeFileSync(out+'.provenance.json.sha256',sha(record)+'\n');
console.log(JSON.stringify({out,before,added:seen.size-before,examples:seen.size,bytes:body.length}));
