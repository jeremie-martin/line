/** Publish recorded control variants, including failures, in the existing native
 * gallery. Duplicate reruns and fixed-suffix probes remain in the study evidence.
 * This never recompiles or selects a winner. Input checksums remain attached. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study')&&arg('source'));
const root=resolve(arg('study')!),source=resolve(arg('source')!);
function read(path:string){const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(bytes.toString());}
const original=read(join(source,'manifest.json'));
const cases=original.plan.cases.filter((c:any)=>['luna_bala_44s','amor_na_praia_46s'].includes(c.id));
const variants:ReadonlyArray<readonly [string,string,string,number]>=arg('variants')?read(resolve(arg('variants')!)):[
  ['inherited','Inherited late two-wave','probe-ripple',0],
  ['early-two','Earlier two-wave, strength 1','probe-ripple',1],
  ['early-one','Earlier one-wave, strength 1','probe-ripple',2],
  ['broad-one','One wave from start, strength 0.6','probe-ripple',3],
  ['strong-one','One wave from start, strength 1','probe-round2-ripple',0],
  ['broad-two','Two waves from start, strength 0.6','probe-round2-ripple',1],
  ['medium-one','One wave from start, strength 0.8','probe-medium-ripple',1],
  ['adapted-strong','Strength 1, starting from gentle ripple controls','probe-adapted-ripple',0],
  ['adapted-medium','Strength 0.8, starting from gentle ripple controls','probe-adapted-ripple',1],
  ['fine-dots','Fragments, width 0.0003','probe-return-fragments',0],
  ['dots','Fragments, width 0.003','probe-return-fragments',1],
  ['wide-dots','Fragments, width 0.03','probe-return-fragments',2],
  ['flecks','Fragments, width 0.3','probe-return-fragments',3],
];
assert.ok(variants.length&&new Set(variants.map(v=>v[0])).size===variants.length);
for(const v of variants)assert.ok(v.length===4&&v.slice(0,3).every(x=>typeof x==='string'&&x.length>0)&&Number.isSafeInteger(v[3])&&v[3]>=0);
const loaded=cases.flatMap((c:any)=>variants.map(([method,title,dir,index])=>{
  const path=join(root,dir,`${c.id}-${index}.json`),record=read(path);
  return {c,method,title,path,sha256:sha(readFileSync(path)),record};
}));
const out=join(root,'controls');mkdirSync(out,{recursive:true});
const plan={schema:'line.repertoire-control-gallery.v1',cases,seeds:[351],budgets:[1000000],methods:variants.map(v=>v[0]),
  compiler:{head:'development',label:'Development trials (working-tree snapshots)',frozenSuccessor:arg('frozen-successor')},
  variantsSource:arg('variants')?{path:resolve(arg('variants')!),sha256:sha(readFileSync(resolve(arg('variants')!)))}:null,
  methodDetails:Object.fromEntries(variants.map(([id,title,dir])=>[id,{title,description:dir==='probe-return-fragments'?
    'Recorded fragment realization with a searched return. Invalid outcomes remain visible.':'Recorded connected-geometry experiment; fixed authored music. Invalid outcomes remain visible.'}])),
  sources:loaded.map(({path,sha256}:any)=>({path,sha256})),sourceManifest:{path:join(source,'manifest.json'),sha256:sha(readFileSync(join(source,'manifest.json')))},
  toolSha256:sha(readFileSync(import.meta.filename)),note:'Preserved development trials. Zero authored jitter; this is a control comparison, not seed robustness or a musical-video panel.'};
const planSha256=writeGalleryJson(out,'plan.json',plan),cells:any[]=[];
for(const {c,method,record:r}of loaded){
  const composition=r.result,result=composition.result,track=result.track,replay=r.replay;
  const changedSections=Object.keys(r.styles).map(Number),fragmentSections=composition.fragmentSections??[];
  const id=`${c.id}-351-${method}`,path=id+'.json';
  const cell={id,caseId:c.id,method,seed:351,jitter:0,budget:1000000,allowance:1000000,
    score:replay.grade.score,valid:replay.grade.score.valid,qualityRms:replay.grade.score.valid?replay.grade.score.weightedAxisRms:null,
    compileMs:r.seconds*1000,physicalFrames:r.physicalFrames,lines:track.lines.length,trackHash:sha(JSON.stringify(track)),
    observations:replay.grade.observations,contacts:replay.grade.contacts,offBeat:replay.grade.offBeat,terminus:replay.grade.terminus,
    railLayout:fragmentSections.length?'mixed':'connected',railGuides:composition.railGuides,
    construction:{styles:r.styles,changedSections,fragmentSections,choice:r.choice},
    sections:result.rows.map((row:any,i:number)=>({section:i,start:row.frame/40,end:(result.rows[i+1]?.frame??c.durationFrames)/40})),
    collisionSha256:sha(JSON.stringify(replay.collisionIds))};
  const digest=writeGalleryJson(out,path,{schema:'line.motion-gallery-cell.v1',planSha256,...cell,case:c,track,trace:replay.trace});
  cells.push({...cell,path,sha256:digest});
}
const summary=plan.methods.map(method=>{const rows=cells.filter(c=>c.method===method);return {method,budget:1000000,runs:rows.length,
  valid:rows.filter(c=>c.valid).length,meanScore:rows.reduce((s,r)=>s+r.score.score,0)/rows.length,
  totalPhysicalFrames:rows.reduce((s,r)=>s+r.physicalFrames,0),totalCompileMs:rows.reduce((s,r)=>s+r.compileMs,0)};});
writeGalleryJson(out,'manifest.json',{schema:'line.motion-gallery.v1',planSha256,plan,cells,summary});
console.log(JSON.stringify({out,tracks:cells.length,valid:cells.filter(c=>c.valid).length}));
