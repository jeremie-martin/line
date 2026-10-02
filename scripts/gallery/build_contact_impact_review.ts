/** Publish a native, same-ruler comparison from complete paired evidence.
 * Original production records remain untouched. Derived baseline records carry
 * their original source identity and an independently measured new account. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson} from './artifacts.ts';
const arg=(k:string,d?:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const inputs=arg('pairs')!.split(',').map(p=>resolve(p)),out=resolve(arg('out')!);mkdirSync(out,{recursive:true});
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const paired=read(inputs[0]),entries:any[]=[],web=(p:string)=>'/'+relative(process.cwd(),resolve(p));
const passagePath=arg('passages'),passages=passagePath?read(resolve(passagePath)):undefined;
for(const input of inputs){
 const group=read(input);assert.deepEqual(group.contract,paired.contract,'comparison definitions differ');
 for(const pair of group.pairs){
  const source=read(pair.baselinePath),originalPlan=read(join(dirname(pair.baselinePath),'plan.json'));
  const baselineOut=join(out,`baseline-${pair.song}-${pair.seed}`);mkdirSync(baselineOut,{recursive:true});
  const plan={...originalPlan,impactContract:paired.contract.id,comparison:{kind:'unchanged automatic baseline under experimental measurement',
    sourceRecord:web(pair.baselinePath),sourceSha256:sha(readFileSync(pair.baselinePath)),pairedEvidenceSha256:sha(readFileSync(input))}};
  const planSha256=writeGalleryJson(baselineOut,'plan.json',plan),grade=pair.baselineGrade,impactEvaluation=pair.baselineEvaluation;
  const {schema:oldSchema,planSha256:oldPlan,...fields}=source;
  const cell={...fields,impactContract:paired.contract.id,impactEvaluation,score:grade.score,observations:grade.observations,
    contacts:grade.contacts,offBeat:grade.offBeat,valid:grade.score.valid,qualityRms:grade.score.weightedAxisRms,
    historicalGrade:{score:source.score,contacts:source.contacts,offBeat:source.offBeat,observations:source.observations,terminus:source.terminus},
    production:{...source.production,valid:grade.score.valid,qualified:grade.score.valid&&source.production.realization.fulfilled},
    sourceRecord:plan.comparison,trackPath:relative(baselineOut,resolve(dirname(pair.baselinePath),source.trackPath)),
    reportPath:relative(baselineOut,resolve(dirname(pair.baselinePath),source.reportPath))};
  const path=source.id+'.json',digest=writeGalleryJson(baselineOut,path,{schema:'line.motion-gallery-cell.v1',planSha256,...cell});
  const {track,trace,case:music,...metadata}=cell;
  writeGalleryJson(baselineOut,'manifest.json',{schema:'line.motion-gallery.v1',planSha256,plan,cells:[{...metadata,path,sha256:digest}],
    summary:[{method:'production',valid:Number(cell.valid),runs:1,meanScore:grade.score.score}]});
  const candidate=read(pair.candidatePath);
  entries.push({title:candidate.case.title,seed:pair.seed,song:pair.song,manifest:web(join(dirname(pair.candidatePath),'manifest.json')),
    moments:passages?.cases.find((c:any)=>c.song===pair.song&&c.seed===pair.seed)?.moments,
    priorManifest:web(join(baselineOut,'manifest.json')),status:pair.candidate.valid&&pair.candidate.fulfilled?'Experimental candidate · complete and fulfilled':'Experimental candidate · inspect saved failures'});
 }
}
assert.equal(new Set(entries.map(e=>`${e.song}:${e.seed}`)).size,entries.length,'duplicate review track');
writeGalleryJson(out,'collection.json',{schema:'line.contact-impact-review-collection.v1',contract:paired.contract,
  description:'Experimental automatic tracks using one shared impact account. Compare against the unchanged automatic baseline measured with the same ruler. This quality scale is provisional and is not the V6 headline. Generation controls above still use the validated production compiler.',
  pairedEvidence:inputs.map(input=>({path:web(input),sha256:sha(readFileSync(input))})),
  ...(passagePath?{passagesSha256:sha(readFileSync(resolve(passagePath)))}:{}),entries});
console.log(JSON.stringify({out,tracks:entries.length,url:`/motion-gallery/production.html?collection=${web(join(out,'collection.json'))}&compare=previous`}));
