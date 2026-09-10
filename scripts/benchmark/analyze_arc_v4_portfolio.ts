/** Hindsight diagnostic only: how much do complete measured strategies differ? */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v4/model.ts';
import {summarize} from '../../benchmark/v4/evaluator.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(b):b).toString());};
const root=arg('root')!,out=arg('out')!,cases=loadCases(),judge=verifyFrozen();
const panels=readdirSync(root).filter(name=>existsSync(`${root}/${name}/run.json.gz`)).map(name=>{
  const path=`${root}/${name}/run.json.gz`,run=checked(path),plan=checked(`${root}/${name}/plan.json`);
  assert.deepEqual(run.plan,plan);assert.deepEqual(plan.judge,judge);assert.equal(plan.budget,750000);assert.equal(plan.seed,16);
  assert.equal(run.rows.length,cases.length);assert.ok(run.rows.every((r:any)=>r.resources.physicalFrames<=750000));
  assert.deepEqual(summarize(run.rows,cases,[16]),run.summary);
  return {name,path,sha256:sha(readFileSync(path)),...run};
});
assert.ok(panels.length>1);
const selected=cases.map(c=>panels.map(panel=>({name:panel.name,row:panel.rows.find((r:any)=>r.sourceId===c.id)!}))
  .sort((a,b)=>b.row.score.score-a.row.score.score)[0]);
const record={schema:'line.arc-v4-portfolio-oracle.v1',
  note:'Hindsight whole-case oracle using already measured outcomes. It is not an executable compiler, a qualification score or evidence that the winner can be predicted before compilation.',
  scriptSha256:sha(readFileSync(import.meta.filename)),suiteFingerprint:sha(JSON.stringify(judge)),
  panels:panels.map(p=>({name:p.name,path:p.path,sha256:p.sha256,headline:p.summary.headline})),
  oracle:summarize(selected.map(s=>s.row),cases,[16]),
  selected:selected.map(s=>({id:s.row.sourceId,strategy:s.name,score:s.row.score.score,trackHash:s.row.trackHash}))};
const body=JSON.stringify(record,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({panels:panels.length,hindsightOracle:record.oracle.headline,note:record.note}));
