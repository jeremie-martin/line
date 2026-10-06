/** exp/retrain-v3 research tool: collect labelled planning probes for the
 * arc future-value model from the production compiler under line.strike.v3.
 *
 *   node --import tsx tools/research/value_collect.ts run --out=DIR [--seeds=1] [--jobs=16] [--budget=standard|N] [--limit=N]
 *       [--catalog=v4|v6transfer] [--only=FILE]
 *
 * --only=FILE restricts the work to the `id~seed` compiles listed in FILE (a JSON
 * array), e.g. the sources of an earlier construction artifact, so a later round
 * collects exactly the same compiles with only the searching policies changed.
 *
 * Training data: benchmark/v4 catalog cases, EXCLUDING every group derived from
 * the evaluation songs (luna_bala, amor_na_praia, tiki_tiki, amour_de_ma_vie),
 * so the model is disjoint from the eval panel. Each probe row is an arrival's
 * 57 value features, its local cost, and the continuation label with the
 * learned leaf prior removed (`pureFuture`), using separate native continuation
 * probes from saved physical prefixes (value_probes.ts). The collection meter is
 * independent of compilation; physical dead ends and budget interruption differ. */
import assert from 'node:assert/strict';
import {compilerIdentity} from '../../scripts/lib/compiler_identity.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
import {atomicWrite} from '../eval/records.ts';
import {VALUE_COLLECTION} from './value_probes.ts';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFileSync, readdirSync, mkdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

export const EVAL_GROUPS = ['luna_bala', 'amor_na_praia', 'tiki_tiki', 'amour_de_ma_vie'];
const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

const catalog = arg('catalog', 'v4')!;
async function trainingCases(): Promise<any[]> {
  if (catalog === 'v6transfer') {
    // Explicit V6 plans with transfer rail layouts (rare in automatic plans), from non-evaluation music.
    const {loadCatalog} = await import('../../benchmark/v6/model.ts');
    const c = loadCatalog();
    return c.cases.filter((x: any) => x.layout === 'transfer' && ['arcs', 'fold', 'serpentine'].includes(x.family) && !/luna|amor|tiki|amour/i.test(x.sourceId))
      .map((x: any) => {const music = c.music.find((m: any) => m.id === x.sourceId)!;
        return {...music, id: x.id, group: `v6:${x.family}-transfer:${(music as any).group}`, plans: x.plans};});
  }
  const {loadCases} = await import('../../benchmark/v4/model.ts');
  return loadCases().filter((c: any) => !EVAL_GROUPS.includes(c.group) && !/luna|amor|tiki|amour/i.test(c.id));
}

const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sourceIdentity=()=>digest(['tools/research/value_collect.ts','tools/research/value_probes.ts'].map(p=>[p,readFileSync(p,'utf8')]));
export function readCollectionCell(dir:string,plan:any,w:any){
 const row=JSON.parse(gunzipSync(readFileSync(join(dir,`${w.id}~${w.seed}.json.gz`))).toString());
 assert.equal(row.planSha256,digest(plan),'collection result belongs to another plan');
 assert.equal(row.id,w.id);assert.equal(row.seed,w.seed);assert.equal(row.inputSha256,w.inputSha256);
 assert.ok(Array.isArray(row.construction),'invalid construction observations');
 assert.ok(Array.isArray(row.probes)&&typeof row.collection?.interrupted==='boolean','missing continuation observations');
 assert.ok(row.probes.length>0||!row.complete,'complete compilation has no continuation observations');
 for(const p of row.probes){assert.equal(p.features.length,57);assert.equal(p.geometry.length,16);
  assert.ok([...p.features,...p.geometry].every(Number.isFinite));assert.ok(p.pureFuture===null||Number.isFinite(p.pureFuture));}
 return row;
}
async function worker(id:string,seed:number,dir:string){
 const plan=JSON.parse(readFileSync(join(dir,'plan.json'),'utf8')),w=plan.work.find((w:any)=>w.id===id&&w.seed===seed);
 assert.ok(w,'undeclared collection worker');assert.deepEqual(compilerIdentity('.'),plan.compiler);assert.equal(sourceIdentity(),plan.collector);
 const requested=plan.budget;
  const {caseSpec} = await import('../../benchmark/v4/model.ts');
  const {compileHandoff} = await import('../../scripts/v0/optimizer/handoff.ts');
  const {productionBudget} = await import('../../scripts/v0/optimizer/production_budget.ts');
  const {collectFutureProbes} = await import('./value_probes.ts');
  const c = (await trainingCases()).find((x: any) => x.id === id)!;
  assert.equal(digest(c),w.inputSha256,'training input changed');
  const spec = caseSpec(c);
  const budget = requested === 'standard' ? productionBudget(spec.duration) : Number(requested);
  const began = performance.now();
  const cp = c.plans ? compileHandoff(spec, seed, {budget, constructionPlan: c.plans[seed], impactContract: 'line.strike.v3'})
    : compileHandoff(spec, seed, {budget, creative: {}, impactContract: 'line.strike.v3',
      phraseBoundaries: (c.phases ?? []).map((p: any) => p.start).filter((t: any) => Number.isFinite(t))});
  // Construction demonstrations (as archive build_construction_examples.ts): fulfilled sections' committed controls.
  const {arcConstructionMemoryKey} = await import('../../scripts/v0/optimizer/arc_memory.ts');
  const {constructionStyle} = await import('../../scripts/v0/optimizer/repertoire_policy.ts');
  const {repertoireSearchOptions} = await import('../../scripts/v0/optimizer/repertoire_search.ts');
  const rep: any = cp.repertoire!;
  const options = repertoireSearchOptions(spec, rep.plan, budget, 'line.strike.v3');
  const construction = rep.result.rows.map((row: any, i: number) => {
    const request = rep.plan.requests[i], check = rep.realization?.sections?.[i];
    return {key: request ? arcConstructionMemoryKey({...options, ...constructionStyle(request)}) : null, context: !!request?.context,
      fulfilled: !!check?.fulfilled, control: row.control, incoming: row.incoming, span: row.span, features: row.features};
  });
  const compileMs = performance.now() - began;
  const collection = collectFutureProbes(spec, seed, options, cp.track.lines, rep.result.rows, budget);
  assert.deepEqual(compilerIdentity('.'),plan.compiler);assert.equal(sourceIdentity(),plan.collector);
  atomicWrite(join(dir,`${id}~${seed}.json.gz`), gzipSync(JSON.stringify({planSha256:digest(plan),inputSha256:w.inputSha256,id, group: c.group, seed, budget, compileMs,
    complete: cp.repertoire!.valid, physicalFrames: cp.repertoire!.physicalFrames,
    trackHash: createHash('sha256').update(JSON.stringify(cp.track)).digest('hex'), probes: collection.probes, collection: {...collection, probes: undefined}, construction})));
}

async function main(){
 const command=process.argv[2];
 if(command==='worker'){await worker(arg('case')!,Number(arg('seed')),arg('out')!);return;}
 assert.equal(command,'run','command is run or worker');assert.ok(arg('out'),'--out is required');
 const dir=resolve(arg('out')!),jobs=Number(arg('jobs','16')),seeds=Number(arg('seeds','1')),budget=arg('budget','standard')!;
 assert.ok(Number.isSafeInteger(jobs)&&jobs>=1&&jobs<=64,'invalid jobs');
 assert.ok(Number.isSafeInteger(seeds)&&seeds>=1,'invalid seed count');
 assert.ok(budget==='standard'||Number.isSafeInteger(Number(budget))&&Number(budget)>0,'invalid budget');
 assert.ok(['v4','v6transfer'].includes(catalog),'unknown training catalog');
 const cases=(await trainingCases()).slice(0,Number(arg('limit','1000')));
 const only=arg('only')?new Set<string>(JSON.parse(readFileSync(arg('only')!,'utf8'))):null;
 const declared=cases.flatMap((c:any)=>Array.from({length:seeds},(_,k)=>({id:c.id,seed:c.plans?Number(Object.keys(c.plans)[k]):101*(k+1),inputSha256:digest(c)})));
 assert.ok(declared.every(w=>Number.isSafeInteger(w.seed)&&w.seed>=0),'missing explicit-plan seed');
 const work=declared.filter(w=>!only||only.has(`${w.id}~${w.seed}`));
 assert.ok(work.length>0,'empty collection');if(only)assert.equal(work.length,only.size,'unknown restricted collection case');
 const plan={schema:'line.value-collection.v2',compiler:compilerIdentity('.'),collector:sourceIdentity(),search:VALUE_COLLECTION,
  excludedGroups:EVAL_GROUPS,catalog,budget,seeds,cases:cases.map((c:any)=>c.id),work};
 mkdirSync(dir,{recursive:true});const release=lockArtifacts(dir);
 try{
  const path=join(dir,'plan.json');
  if(existsSync(path))assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),plan,'collection inputs changed; choose a new directory');
  else atomicWrite(path,JSON.stringify(plan,null,1));
  const wanted=new Set(work.map(w=>`${w.id}~${w.seed}.json.gz`));
  assert.ok(readdirSync(dir).filter(p=>p.endsWith('.json.gz')).every(p=>wanted.has(p)),'undeclared collection record');
  const queue=work.filter(w=>{if(!existsSync(join(dir,`${w.id}~${w.seed}.json.gz`)))return true;readCollectionCell(dir,plan,w);return false;});
  const lengths=new Map(cases.map((c:any)=>[c.id,c.durationFrames]));queue.sort((a,b)=>lengths.get(b.id)!-lengths.get(a.id)!);
  const failures:string[]=[];let done=work.length-queue.length;
  await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{while(queue.length){const w=queue.shift()!;
   try{await new Promise<void>((ok,fail)=>{const p=spawn(process.execPath,['--import','tsx',import.meta.filename,'worker',`--catalog=${catalog}`,`--case=${w.id}`,`--seed=${w.seed}`,`--out=${dir}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore','ignore','inherit']});
    p.once('error',fail);p.once('exit',(code,signal)=>code===0?ok():fail(Error(`worker exited ${code??signal}`)));});
    readCollectionCell(dir,plan,w);console.log(`${++done}/${work.length} ${w.id}~${w.seed}`);
   }catch(e){failures.push(`${w.id}~${w.seed}: ${e}`);}
  }}));
  assert.deepEqual(compilerIdentity('.'),plan.compiler);assert.equal(sourceIdentity(),plan.collector);
  assert.deepEqual(failures,[],'incomplete collection; resume after addressing worker failures');
  const records=work.map(w=>readCollectionCell(dir,plan,w)),probes=records.reduce((n,r)=>n+r.probes.length,0);
  assert.ok(probes>0,'no continuation data collected');console.log(`${records.length} verified records; ${probes} native continuation probes`);
 }finally{release();}
}
if(import.meta.filename===process.argv[1])await main();
