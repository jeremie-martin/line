/** Cold native follow-up of saved experiments; never reuse compiler estimates. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {sha} from '../../benchmark/v4/model.ts';
import {loadCatalog} from '../../benchmark/v6/model.ts';
import {reportedWindows} from '../../benchmark/v6/production_qualification.ts';
import {evaluateDetection} from '../../benchmark/v4/evaluator.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {extractRawTrajectory,detect,resetFrameCount,setPhysicsFrameLimit} from '../lib/detector.ts';
import {motionSamples,summarizeMotion} from '../v0/optimizer/motion_quality.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
 await import(new URL('../lib/_lr_engine_wasm.ts?probe-follow-up',import.meta.url).href);
const dir=resolve(process.argv[2]??'');
if(!process.argv[2])throw new Error('Saved probe directory required');
const catalog=loadCatalog(),rows=[];
for(const filename of readdirSync(dir).filter(p=>/-\d+-\d+\.json$/.test(p)).sort()){
 const bytes=readFileSync(join(dir,filename)),digest=sha(bytes);
 assert.equal(digest,readFileSync(join(dir,filename+'.sha256'),'utf8').trim());
 const r=JSON.parse(bytes.toString()),bc=catalog.cases.find(c=>c.id===r.song);
 const c=bc?catalog.music.find(c=>c.id===bc.sourceId)!:
  (await loadMusicCase({song:r.song,title:r.song,moments:[]},-15)).musicCase;
 resetFrameCount();setPhysicsFrameLimit(null);
 try{
  const engine=new Engine().setStart(r.track.startPosition,r.track.riders[0].startVelocity).addLine(r.track.lines);
  const raw=extractRawTrajectory(engine,c.durationFrames+20),grade=evaluateDetection(c,detect(raw));
  assert.deepEqual(grade.score,r.score,'saved musical score differs from cold replay');
  const samples=motionSamples(raw.frames,1,c.durationFrames),full=summarizeMotion(samples,1);
  assert.deepEqual(full,r.motion.full,'saved motion differs from cold replay');
  const opening=grade.observations.filter(o=>o.axis==='impact'&&o.endFrame<=120);
  rows.push({id:r.id,song:r.song,seed:r.seed,source:filename,sha256:digest,score:grade.score,
   observations:grade.observations,full,opening:summarizeMotion(samples.filter(s=>s.frame<=120),1),
   openingImpactRms:opening.length&&opening.every(o=>o.error!==null)?Math.sqrt(opening.reduce((s,o)=>s+o.error!**2,0)/opening.length):null,
   windows:reportedWindows.filter(w=>w.song===c.id&&w.seed===r.seed).map(w=>({from:w.from,to:w.to,
    summary:summarizeMotion(samples.filter(s=>s.frame>=Math.ceil(w.from*40)&&s.frame<=Math.floor(w.to*40)),0)}))});
 }finally{dispose();setPhysicsFrameLimit(null);}
}
writeGalleryJson(dir,'native-analysis.json',{schema:'line.motion-probe-follow-up.v1',rows});
console.log(JSON.stringify({probes:rows.length}));
