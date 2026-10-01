/** Calibration on the preserved collection, never on a selected new candidate. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {motionSamples,summarizeMotion,MOTION_BANDS,MOTION_OBSERVATION_VERSION} from '../v0/optimizer/motion_quality.ts';
const source='generated/motion-quality-20261001/frames.json.gz';
const bytes=readFileSync(source),sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(bytes),readFileSync(source+'.sha256','utf8').trim());
const tracks=JSON.parse(gunzipSync(bytes).toString());
let maxEffectiveError=0,maxGainError=0;
const rows=tracks.map((t:any)=>{
  const raw=t.frames.map((f:any)=>({frame:f.f,velocity:{x:f.incoming[0],y:f.incoming[1]}})),last=t.frames.at(-1);
  const samples=motionSamples(raw,1,last.f,{x:last.effective[0],y:last.effective[1]});
  for(const s of samples){const f=t.frames[s.frame];
    maxEffectiveError=Math.max(maxEffectiveError,Math.abs(s.effective.x-f.effective[0]),Math.abs(s.effective.y-f.effective[1]));
    maxGainError=Math.max(maxGainError,Math.abs(s.solverGain-f.gain));
  }
  const sections=[...new Set<number>(t.frames.map((f:any)=>f.section))].map(section=>{
    const fs=samples.filter(f=>t.frames[f.frame].section===section),first=t.frames[fs[0]?.frame];
    return {section,construction:first?.construction,impact:first?.targetImpact,
      summary:summarizeMotion(fs,fs[0]?.frame??1)};
  });
  return {id:t.id,song:t.song,seed:t.seed,method:t.method,trackHash:t.trackHash,
    summary:summarizeMotion(samples,1),opening:summarizeMotion(samples.filter(f=>f.frame<=120),1),sections};
});
assert.ok(maxEffectiveError<1e-10&&maxGainError<1e-10);
const cited=[{song:'amour_de_ma_vie_44s',seed:303,from:9.1,to:9.7},
  {song:'tiki_tiki_48s',seed:101,from:15.05,to:15.65},{song:'amour_de_ma_vie_44s',seed:101,from:5.7,to:6.25}].map(c=>{
  const t=tracks.find((t:any)=>t.song===c.song&&t.seed===c.seed&&t.method==='production');
  const raw=t.frames.map((f:any)=>({frame:f.f,velocity:{x:f.incoming[0],y:f.incoming[1]}}));
  const summary=summarizeMotion(motionSamples(raw,Math.ceil(c.from*40),Math.floor(c.to*40)),0);
  assert.ok(summary.bursts.find(b=>b.frames===4)!.maxExcess>0);
  return {...c,summary};
});
const out='generated/intentional-motion/calibration';mkdirSync(out,{recursive:true});
const result={schema:'line.motion-calibration.v1',observation:MOTION_OBSERVATION_VERSION,bands:MOTION_BANDS,
  sourceSha256:sha(bytes),maxEffectiveError,maxGainError,
  interpretation:'Pilot severity bands identify the reported bursts. Passing is not proof of artistic quality; controls include provisional energetic examples, not new owner approvals.',cited,rows};
const serialized=JSON.stringify(result,null,2)+'\n';writeFileSync(out+'/baseline.json',serialized);writeFileSync(out+'/baseline.json.sha256',sha(serialized)+'\n');
console.log(JSON.stringify({maxEffectiveError,maxGainError,cited:cited.map(c=>({song:c.song,seed:c.seed,bursts:c.summary.bursts})),
  tracks:rows.map((r:any)=>({song:r.song,seed:r.seed,method:r.method,episodes:r.summary.bursts.map((b:any)=>b.episodes)}))}));
