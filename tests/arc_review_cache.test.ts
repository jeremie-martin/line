import {afterEach,beforeEach,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readArcReviewCompile,type ArcReviewIdentity} from '../scripts/produce/arc_review_cache.ts';

let dir:string,path:string,identity:ArcReviewIdentity,record:any;
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
beforeEach(()=>{
  dir=mkdtempSync(join(tmpdir(),'arc-review-cache-test-'));path=join(dir,'compile.json');
  identity={song:'test',seed:17,jolt:-15,specSha256:hash('authored spec'),audioSha256:hash('audio'),
    render:{res:'1080x1920',zoomMult:1.8,beatPunchPct:70},options:{budget:750000},implementation:{'compiler.ts':hash('compiler')}};
  const outputs=Object.fromEntries(['track.json','report.json','research.json','budget-telemetry.json'].map(name=>{
    writeFileSync(join(dir,name),'{}\n');return [name,hash('{}\n')];
  }));
  record={schema:'line.arc-motion-production-review.v1',...identity,outputs,metrics:{contractPassed:true}};
  const bytes=JSON.stringify(record);writeFileSync(path,bytes);writeFileSync(path+'.sha256',hash(bytes)+'\n');
});
afterEach(()=>rmSync(dir,{recursive:true,force:true}));
it('reuses a checksummed compile with exactly matching inputs',()=>{
  expect(readArcReviewCompile(path,identity)).toEqual(record);
});
it.each([
  ['specSha256',hash('edited spec')],['jolt',0],['seed',18],['song','other'],
  ['audioSha256',hash('replacement audio')],['render',{res:'1080x1920',zoomMult:2,beatPunchPct:70}],
  ['options',{budget:1000000}],['implementation',{'compiler.ts':hash('changed compiler')}],
])('rejects a cached compile when %s changes',(key,value)=>{
  expect(()=>readArcReviewCompile(path,{...identity,[key]:value})).toThrow(`saved review ${key} differs`);
});
it('rejects a damaged record before trusting its stored validation',()=>{
  writeFileSync(path,readFileSync(path,'utf8').replace('true','false'));
  expect(()=>readArcReviewCompile(path,identity)).toThrow('corrupt compile record');
});
it('checks the complete artifact set, including a missing output commitment',()=>{
  writeFileSync(join(dir,'track.json'),'changed track');
  expect(()=>readArcReviewCompile(path,identity)).toThrow('corrupt compiler output: track.json');
  record.outputs={};const body=JSON.stringify(record);writeFileSync(path,body);writeFileSync(path+'.sha256',hash(body));
  expect(()=>readArcReviewCompile(path,identity)).toThrow('corrupt compiler output: track.json');
});
