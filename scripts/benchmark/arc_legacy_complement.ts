/** Price the old arc compiler on only the actual budget left by each saved new
 * arc construction. This is an exploratory paired portfolio, not promotion. */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {developmentCases} from '../../benchmark/v2/catalog.ts';
import {benchmarkPolicy} from '../../benchmark/v2/policy.ts';
import {applyJolt} from '../produce/seed.ts';
import {compileHandoff} from '../v0/optimizer/handoff.ts';
import {buildAxisContract,scoreV2Report} from '../v0/benchmark_v2/evaluator.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const entry=developmentCases.find(e=>e.case.metadata.id===arg('source'))!;
const prefix=arg('prefix')??'generated/benchmark-v2/arc-motion-650/full-v7';
const priorPath=`${prefix}/${entry.case.metadata.id}.json`,priorBytes=readFileSync(priorPath),prior=JSON.parse(priorBytes.toString());
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
if(hash(priorBytes)!==readFileSync(priorPath+'.sha256','utf8').trim())throw new Error('prior hash');
const budget=750000-prior.stats.sim_frames-40000,seed=260908011,spec=applyJolt(entry.case.spec,benchmarkPolicy.transform.joltMs);
const started=performance.now();
const result=compileHandoff(spec,seed,{budget,searchSeed:seed,budgetTelemetry:'summary'});
if(result.track.lines.some(l=>l.type!==0))throw new Error('non-normal output');
const suite=JSON.parse(readFileSync('benchmark/v2/compat/suite-manifest.json','utf8'));
const score=scoreV2Report(result.report,spec.contacts.length,buildAxisContract(spec,Object.keys(benchmarkPolicy.componentWeights) as any),suite);
if(result.stats.sim_frames+prior.stats.sim_frames>750000)throw new Error(`portfolio budget exceeded: prior=${prior.stats.sim_frames}, legacy=${result.stats.sim_frames}, allocation=${budget}`);
const record={schema:'line.arc-legacy-complement.v1',researchOnly:true,sourceId:entry.case.metadata.id,seed,elapsedMs:performance.now()-started,priorArtifactSha256:hash(priorBytes),priorFrames:prior.stats.sim_frames,priorScore:prior.score,score,...result};
const out=arg('out')!,body=JSON.stringify(record)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');
console.log(JSON.stringify({sourceId:record.sourceId,score:score.score,valid:score.valid,priorScore:prior.score.score,frames:result.stats.sim_frames+prior.stats.sim_frames,budget}));
