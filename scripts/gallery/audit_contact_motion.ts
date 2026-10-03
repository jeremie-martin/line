/** Cold replay of the existing motion criteria after the impact-contract freeze.
 * The historical qualification also judges the OLD impact task. Keep that result
 * intact and report its physical subchecks separately, without relabeling a pass.
 */
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {sha} from '../../benchmark/v4/model.ts';
import {verifyFrozen} from '../../benchmark/v6/contract.ts';
import {evaluateDetection} from '../../benchmark/v4/evaluator.ts';
import {qualifyProductionMotion, reportedWindows, type ProductionObservation} from '../../benchmark/v6/production_qualification.ts';
import {extractRawTrajectory, detect, resetFrameCount, setPhysicsFrameLimit} from '../lib/detector.ts';
import {motionSamples, summarizeMotion} from '../v0/optimizer/motion_quality.ts';
import {inspectRepertoireLayout} from '../v0/optimizer/repertoire_layout.ts';
import {writeGalleryJson} from './artifacts.ts';

const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../lib/_lr_engine_wasm.ts?contact-motion-audit',import.meta.url).href);
const arg=(key:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const pairPath=resolve(arg('pairs','generated/general-impact-20261002/final-production/development/comparison/pairs.json'));
const ordinaryPath=resolve(arg('ordinary','generated/beat-salience-20261001/audit.json'));
const out=resolve(arg('out','generated/general-impact-20261002/motion-qualification'));mkdirSync(out,{recursive:true});
const read=(path:string)=>{const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim(),path);
  return {value:JSON.parse(bytes.toString()),sha256:sha(bytes)};};
const pairs=read(pairPath),ordinary=read(ordinaryPath),judge=verifyFrozen();
const baselinePaths=[...pairs.value.pairs.map((p:any)=>p.baselinePath),
  ...ordinary.value.runs.filter((r:any)=>r.version==='ordinary').map((r:any)=>r.path)];
const candidatePaths=pairs.value.pairs.map((p:any)=>p.candidatePath);
const sets:Record<string,ProductionObservation[]>={},checks:any[]=[];
for(const [name,paths] of Object.entries({baseline:baselinePaths,candidate:candidatePaths})){
  const rows:ProductionObservation[]=[];
  for(const path of paths){
    const saved=read(path),r=saved.value,c=r.case;
    assert.equal(sha(JSON.stringify(r.track)),r.trackHash);assert.ok(r.track.lines.every((l:any)=>l.type===0));
    resetFrameCount();setPhysicsFrameLimit(null);
    try{
      const engine=new Engine().setStart(r.track.startPosition,r.track.riders[0].startVelocity).addLine(r.track.lines);
      const raw=extractRawTrajectory(engine,c.durationFrames+20),grade=evaluateDetection(c,detect(raw));
      assert.deepEqual(grade.score,r.historicalGrade?.score??r.score,'saved historical grade differs from cold replay');
      let maxTraceError=0;
      for(let f=0;f<r.trace.frames.length;f++){
        const points=engine.getRider(f).ballisticState().points;
        r.trace.pointIds.forEach((id:string,i:number)=>{maxTraceError=Math.max(maxTraceError,
          Math.abs(points[id].x-r.trace.frames[f][2*i]),Math.abs(points[id].y-r.trace.frames[f][2*i+1]));});
      }
      assert.ok(maxTraceError<1e-8,'saved trace differs from cold native replay');
      let fulfilled=true;
      if(r.production){
        const collisions=raw.frames.map(f=>engine.getUpdatesAtFrame(f.frame).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id));
        const actual=inspectRepertoireLayout(r.production.plan,r.track.lines,r.production.railGuides,collisions,raw.frames.map(f=>f.position));
        assert.equal(actual.fulfilled,r.production.realization.fulfilled);fulfilled=actual.fulfilled;
      }
      const samples=motionSamples(raw.frames,1,c.durationFrames),errors=grade.observations.filter(o=>o.axis==='impact'&&o.endFrame<=120);
      const openingImpactRms=errors.length&&errors.every(o=>o.error!==null&&Number.isFinite(o.error))?
        Math.sqrt(errors.reduce((n,o)=>n+o.error!**2,0)/errors.length):null;
      rows.push({song:c.id,seed:r.seed,method:r.method,valid:grade.score.valid,fulfilled,trackHash:r.trackHash,durationFrames:c.durationFrames,
        full:summarizeMotion(samples,1),opening:summarizeMotion(samples.filter(s=>s.frame<=120),1),openingImpactRms,
        windows:reportedWindows.filter(w=>w.song===c.id&&w.seed===r.seed).map(w=>({from:w.from,to:w.to,
          summary:summarizeMotion(samples.filter(s=>s.frame>=Math.ceil(w.from*40)&&s.frame<=Math.floor(w.to*40)),0)}))});
      checks.push({set:name,path,artifactSha256:saved.sha256,maxTraceError,fulfilled,
        historicalValid:grade.score.valid,experimentalValid:r.impactEvaluation?.valid??null});
    }finally{dispose();setPhysicsFrameLimit(null);}
  }
  sets[name]=rows;console.log(JSON.stringify({set:name,tracks:rows.length}));
}
const historicalQualification=qualifyProductionMotion(sets.baseline,sets.candidate);
const physicalChecks={bursts:historicalQualification.bursts,quiet:historicalQualification.quiet,
  windows:historicalQualification.windows.map(({passed:historicalTaskPassed,...w})=>({...w,
    physicalBandPassed:w.maxExcess<=1e-9,historicalTaskPassed}))};
const harnessPaths=['scripts/gallery/audit_contact_motion.ts','scripts/v0/optimizer/motion_quality.ts','benchmark/v6/production_qualification.ts'];
writeGalleryJson(out,'audit.json',{schema:'line.contact-impact-motion-audit.v1',judge,
  sources:{pairs:{path:pairPath,sha256:pairs.sha256},ordinary:{path:ordinaryPath,sha256:ordinary.sha256}},
  harness:Object.fromEntries(harnessPaths.map(p=>[p,sha(readFileSync(p))])),
  interpretation:'Independent native replay of all 12 paired development songs plus 12 ordinary references. The unchanged historical qualifier includes old impact validity/strength requirements, so it is a historical-task diagnostic, not qualification of the new impact contract. Physical burst and calm-motion criteria retain their frozen values. No compiler retuning follows this audit.',
  historicalQualification,physicalChecks,checks,observations:sets});
console.log(JSON.stringify({historicalQualificationPassed:historicalQualification.passed,physicalChecks}));
