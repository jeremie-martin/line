/** Finalize retained study cells after checking executable identity, not unrelated Git status. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v3/model.ts';
import {summarize} from '../../benchmark/v3/evaluator.ts';
import {compilerCandidateIdentity} from '../v0/benchmark_v2/compiler_identity.ts';
const out=resolve(process.argv[2]);
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse((p.endsWith('.gz')?gunzipSync(b):b).toString());};
const plan=read(resolve(out,'plan.json'));
const normalized=({trackedChanges,...identity}:any)=>identity;
assert.deepEqual(normalized(compilerCandidateIdentity('wasm')),normalized(plan.compiler));
assert.equal(sha(readFileSync('scripts/benchmark/arc_v3_study.ts')),plan.scriptSha256);
for(const [p,h] of Object.entries(plan.judgeFiles))assert.equal(sha(readFileSync(p)),h);
const rows=plan.sources.map((id:string)=>read(resolve(out,id+'.json.gz')));
for(const r of rows){assert.equal(r.planSha256,sha(readFileSync(resolve(out,'plan.json'))));assert.equal(r.trackHash,sha(JSON.stringify(r.track)));assert.ok(r.stats.sim_frames<=plan.budget);assert.equal(r.seed,plan.seed);}
const cases=loadCases(),summary=rows.length===cases.length?summarize(rows,cases,[plan.seed]):{pilot:true,cases:rows.map((r:any)=>({id:r.sourceId,score:r.score.score,valid:r.score.valid})),mean:rows.reduce((s:number,r:any)=>s+r.score.score,0)/rows.length};
const body=gzipSync(JSON.stringify({plan,summary,rows:rows.map(({track,report,rows,...r}:any)=>r),
  finalizationRecovery:{reason:'The original final identity assertion included repository-wide Git status. Added tests/analysis scripts changed that metadata; all compiler bytes, compiler diff, engine, environment, HEAD and judge identities still match.',scriptSha256:sha(readFileSync(import.meta.filename))}})+'\n');
const path=resolve(out,'run.json.gz');assert.ok(!existsSync(path));writeFileSync(path,body);writeFileSync(path+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({out,summary}));
