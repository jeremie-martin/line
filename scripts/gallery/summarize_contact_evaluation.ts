/** Final complete-panel evidence; refuses partial panels or missing trials. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson} from './artifacts.ts';
const arg=(k:string,d?:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const root=resolve(arg('root','generated/general-impact-20261002')!);
const checked=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim(),p);return JSON.parse(b.toString());};
const originalPath=resolve('generated/intentional-motion/v6-candidate-8/run.json'),compatPath=join(root,'v6-compatibility/run.json'),experimentalPath=join(root,'complete-contact-panel/run.json');
const original=checked(originalPath),compat=checked(compatPath),experimental=checked(experimentalPath);
function complete(run:any){
 const expected=run.plan.ids.flatMap((id:string)=>run.plan.seeds.map((seed:number)=>`${id}:${seed}`));
 assert.equal(expected.length,460,'complete canonical inputs required');
 const actual=run.rows.map((r:any)=>`${r.id}:${r.seed}`);assert.deepEqual([...actual].sort(),expected.sort());
}
complete(original);complete(compat);complete(experimental);
const key=(r:any)=>`${r.id}:${r.seed}`,old=new Map(original.rows.map((r:any)=>[key(r),r]));
const changes=compat.rows.flatMap((r:any)=>{const b:any=old.get(key(r));return r.trackHash===b.trackHash&&r.score===b.score?[]:[{id:r.id,seed:r.seed,before:b.score,after:r.score,trackChanged:r.trackHash!==b.trackHash}];});
const mean=(a:number[])=>a.reduce((n,x)=>n+x,0)/Math.max(1,a.length);
const quantile=(a:number[],p:number)=>{const sorted=[...a].sort((a,b)=>a-b);return sorted[Math.round((sorted.length-1)*p)]??null;};
function summary(rows:any[]){
 const paired=rows.filter(r=>!r.executionError);
 return {scheduled:rows.length,distinctMusicalInputs:new Set(rows.map(r=>r.sourceId)).size,
  distinctCandidateTracks:new Set(rows.map(r=>r.trackHash).filter(Boolean)).size,
  validFulfilled:rows.filter(r=>r.candidate.valid&&r.candidate.fulfilled).length,
  executionErrors:rows.filter(r=>r.executionError).length,
  baselineValid:rows.filter(r=>r.baseline.valid).length,
  meanExperimentalQuality:mean(rows.map(r=>r.candidate.quality)),meanBaselineExperimentalQuality:mean(rows.map(r=>r.baseline.quality)),
  qualityP10:quantile(rows.map(r=>r.candidate.quality),.1),qualityMinimum:Math.min(...rows.map(r=>r.candidate.quality)),
  pairedMeasurementCount:paired.length,
  meanImpactLoss:{baseline:mean(paired.map(r=>r.baseline.loss)),candidate:mean(paired.map(r=>r.candidate.loss))},
  meanStrengthMse:{baseline:mean(paired.map(r=>r.baseline.strengthMse)),candidate:mean(paired.map(r=>r.candidate.strengthMse))},
  meanTimingMse:{baseline:mean(paired.map(r=>r.baseline.timingMse)),candidate:mean(paired.map(r=>r.candidate.timingMse))},
  meanExtraMse:{baseline:mean(paired.map(r=>r.baseline.extraMse)),candidate:mean(paired.map(r=>r.candidate.extraMse))},
  gainExcess:{baseline:mean(paired.map(r=>r.baseline.gainExcessSum)),candidate:mean(paired.map(r=>r.candidate.gainExcessSum))},
  missingRequests:paired.reduce((n,r)=>n+r.candidate.missing,0),
  meanCompilerFrames:mean(paired.map(r=>r.physicalFrames)),maximumCompilerFrames:Math.max(...paired.map(r=>r.physicalFrames)),
  medianCompileMs:quantile(paired.map(r=>r.compileMs),.5)};
}
const group=(field:string)=>Object.fromEntries([...new Set<string>(experimental.rows.map((r:any)=>r[field]))].sort().map(k=>[k,summary(experimental.rows.filter((r:any)=>r[field]===k))]));
const failures=experimental.rows.filter((r:any)=>!r.candidate.valid||!r.candidate.fulfilled||r.executionError).map((r:any)=>({id:r.id,seed:r.seed,executionError:r.executionError,failure:r.failure,constructionFailure:r.constructionFailure,candidate:r.candidate}));
const result={schema:'line.contact-impact-final-evaluation.v1',compiler:experimental.plan.compiler,contract:experimental.plan.contract,
 sourceArtifacts:[originalPath,compatPath,experimentalPath].map(path=>({path,sha256:sha(readFileSync(path))})),
 compatibility:{summary:compat.summary,scheduled:compat.rows.length,executionErrors:compat.executionErrors,identicalTracksAndScores:compat.rows.length-changes.length,changes,
  nativePhysicsFingerprint:compat.plan.compiler.engineArtifactFingerprint,frozenJudge:compat.plan.judge},
 experimental:{summary:summary(experimental.rows),byPanel:group('panel'),byFamily:group('family'),failures,
  rows:experimental.rows.map((r:any)=>({id:r.id,seed:r.seed,sourceId:r.sourceId,panel:r.panel,family:r.family,
   baseline:r.baseline,candidate:r.candidate,physicalFrames:r.physicalFrames,compileMs:r.compileMs,trackHash:r.trackHash,executionError:r.executionError}))},
 interpretation:['The compatibility run uses the unchanged historical V6 task; the experimental run does not produce comparable V6 headline scores.',
  'Experimental quality is an unweighted descriptive mean over these 460 runs, not a newly frozen benchmark aggregation. Invalid/unfulfilled outcomes contribute zero.',
  'Inputs are known catalog music and fixed construction requests. These post-selection outcomes did not tune the candidate. The separately reserved eight arrangements are reported in the production evidence.',
  'Shared event accounting improves measurable musical control but does not establish complete perceptual calibration. Retain head-first clarity and quiet/strong error exceptions for artistic review.',
  'The validated production default remains unchanged. The new contract and search profile are explicitly experimental.'],harnessSha256:sha(readFileSync(import.meta.filename))};
const output=resolve(arg('out','docs/evidence/general-impact-final-evaluation-20261002.json')!);
writeGalleryJson(dirname(output),basename(output),result);
console.log(JSON.stringify({compatibility:result.compatibility.scheduled,identical:result.compatibility.identicalTracksAndScores,experimental:result.experimental.summary,failures:failures.length}));
