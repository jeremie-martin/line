/** Challenge the unresolved strength/clarity cases with a geometry-independent
 * whole-body response hypothesis. Research only; no scoring or search changes. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {sha} from '../../benchmark/v3/model.ts';
import {CONTACT_IMPACT_CONTRACT,accountContactImpacts} from '../lib/contact_impact.ts';
import {writeGalleryJson} from './artifacts.ts';
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const out=arg('out','generated/general-impact-20261002/coherence-study');mkdirSync(out,{recursive:true});
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(p.endsWith('.gz')?gunzipSync(b).toString():b.toString());};
const studyPath='generated/general-impact-20261002/definition-baseline-v1/audit.json.gz',study=read(studyPath),sources=read('generated/beat-salience-20261001/audit.json');
const definitions=[{id:'working',power:0},...['l1','rms'].flatMap(norm=>[.5,1,2].map(power=>({id:`${norm}-${power}`,norm,power})))];
const plan={schema:'line.impact-coherence-study.v1',sourceSha256:sha(readFileSync(studyPath)),harnessSha256:sha(readFileSync(import.meta.filename)),definitions,
  hypothesis:'A response shared by the body points may communicate a clearer strike than predominantly internal/rotational deformation. Test mean-vector over mean-length or RMS-length of per-point solver velocity changes. Do not gate on rider orientation or contact role.',
  decision:'Inspect the rejected head-first passage against both positive lower landing and preferred inverted passage, and all 90 historical labels. A favorable named example alone cannot select the formula.'};
writeGalleryJson(out,'plan.json',plan);
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=await import(new URL('../lib/_lr_engine_wasm.ts?impact-coherence',import.meta.url).href);
const body=['BUTT','SHOULDER','RHAND','LHAND','LFOOT','RFOOT'];
const data=[...study.runs.map((r:any)=>({row:r,source:sources.runs.find((s:any)=>`${s.version}-${s.song}-${s.seed}`===r.id).path})),
  ...study.historical.map((h:any)=>({row:{...h,id:h.name},source:h.trackPath,historical:true}))];
const results:any[]=[];
for(const item of data){
  const record=item.historical?JSON.parse(readFileSync(item.source,'utf8')):read(item.source),track=item.historical?record:record.track;
  const end=item.historical?track.duration:record.case.durationFrames+20;
  try{
    const engine=new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines);engine.getRider(end);
    const factors=Array.from({length:end+1},(_,frame)=>{
      const points=engine.getRider(frame).ballisticState().points;
      const ds=body.map(id=>({x:points[id].x-points[id].prevX-points[id].vx,y:points[id].y-points[id].prevY-points[id].vy}));
      const mean=ds.reduce((m,d)=>({x:m.x+d.x/6,y:m.y+d.y/6}),{x:0,y:0}),length=Math.hypot(mean.x,mean.y);
      const l1=ds.reduce((s,d)=>s+Math.hypot(d.x,d.y)/6,0),rms=Math.sqrt(ds.reduce((s,d)=>s+(d.x*d.x+d.y*d.y)/6,0));
      return {l1:l1>1e-10?Math.min(1,length/l1):1,rms:rms>1e-10?Math.min(1,length/rms):1};
    });
    const base=item.row.working,targets=item.row.beats;
    const variants=definitions.map(d=>{
      const events=base.events.map((e:any)=>{
        // Weight the bounded engagement uniformly for this explanatory assay;
        // a subsequent definition would need a fully specified frame measure.
        const coherence=factors.slice(e.onset,e.end+1).reduce((s,f)=>s+(d.power?f[(d as any).norm as 'l1'|'rms']**d.power:1),0)/(e.end-e.onset+1);
        const raw=e.raw*coherence;return {...e,coherence,raw,strength:Math.min(1,raw/CONTACT_IMPACT_CONTRACT.veryStrong)};
      });
      const account=accountContactImpacts(events,targets);return {id:d.id,events,account};
    });
    results.push({id:item.row.id,historical:!!item.historical,source:item.source,sourceSha256:sha(readFileSync(item.source)),targets,variants});
  }finally{dispose();}
}
const bytes=gzipSync(JSON.stringify({plan,results})+'\n');writeFileSync(out+'/results.json.gz',bytes);writeFileSync(out+'/results.json.gz.sha256',sha(bytes)+'\n');
console.log(JSON.stringify({out,tracks:results.length,variants:definitions.length}));
