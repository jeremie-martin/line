/** Existing music, additional layouts, score-blind selection and fresh seeds. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {loadCases,caseSpec,sha} from '../../benchmark/v3/model.ts';
import {loadCatalog as loadV5} from '../../benchmark/v5/model.ts';
import {planIntentionalRepertoire} from '../v0/optimizer/intentional_repertoire.ts';
import {validateProductionPlan,type Construction} from '../v0/optimizer/repertoire_policy.ts';
import {policy} from '../../benchmark/v6/policy.ts';
import type {Catalog,RepertoireCase} from '../../benchmark/v6/model.ts';
import {judgeIdentity} from '../../benchmark/v6/contract.ts';
if(existsSync('benchmark/v6/frozen.json'))throw new Error('V6 is already frozen; author a new version instead');
const originals=loadCases(),v5=loadV5(),groups=[...new Set(originals.map(c=>c.group))];
const canonical=groups.map(group=>{
 const source=v5.cases.find(c=>c.split==='canonical'&&c.panel==='automatic'&&c.family===group)!.sourceId;
 return originals.find(c=>c.id===source)!;
});
const known=new Set(v5.music.map(c=>c.id));
const confirmation=groups.map(group=>originals.filter(c=>c.group===group&&!known.has(c.id)).sort((a,b)=>a.id.localeCompare(b.id)).at(-1))
 .filter((c):c is typeof originals[number]=>!!c);
const fixedGroups=['regular_exceptions','cadence_transition','spacious_amplitude','dense_musical','high_air_energy','amor_na_praia','luna_bala','tiki_tiki'];
const confirmationFixedGroups=['subdivision_pickup','irregular_microtimed','low_air_frontier','sparse_transition','legacy_transition_regression'];
const families=['single','arcs','fold','serpentine','scallops','terraces','scattered'];
const music=new Map([...canonical,...confirmation].map(c=>[c.id,c])),cases:RepertoireCase[]=[];
for(const split of ['canonical','confirmation']as const){
 const sources=split==='canonical'?canonical:confirmation,seeds=split==='canonical'?policy.seeds:policy.confirmationSeeds;
 const fixed=sources.filter(c=>(split==='canonical'?fixedGroups:confirmationFixedGroups).includes(c.group));
 for(const c of fixed)for(const family of families)for(const layout of family==='single'||family==='scattered'?['paired']as const:['paired','transfer']as const){
  const row:RepertoireCase={id:`${split}-${c.id}-${family}-${layout}`,sourceId:c.id,panel:'fixed',family,layout,split,plans:{},scoredSections:{}};
  for(const seed of seeds){
   const spec=caseSpec(c),plan=planIntentionalRepertoire(spec,seed),n=plan.requests.length-1,count=Math.min(3,n);
   const fraction=[.05,.35,.65,1][parseInt(sha(c.id+':'+seed).slice(0,8),16)%4],first=1+Math.round((n-count)*fraction);
   for(const r of plan.requests.slice(1)){
    const selected=r.section>=first&&r.section<first+count;
    r.construction=selected?(family==='single'?'arcs':family)as Construction:'arcs';
    r.guidance=selected?(family==='single'?'forbidden':family==='scattered'?'optional':'required'):'optional';
    r.railLayout=selected?layout:'paired';
   }
   plan.phrases=plan.requests.slice(1).map(r=>({first:r.section,count:1,construction:r.construction,guidance:r.guidance,railLayout:r.railLayout}));
   row.plans[seed]=validateProductionPlan(spec,plan);row.scoredSections[seed]=Array.from({length:count},(_,i)=>first+i);
  }
  cases.push(row);
 }
 for(const c of sources){
  const row:RepertoireCase={id:`${split}-${c.id}-automatic`,sourceId:c.id,panel:'automatic',family:c.group,split,plans:{},scoredSections:{}};
  for(const seed of seeds){const plan=planIntentionalRepertoire(caseSpec(c),seed);row.plans[seed]=plan;row.scoredSections[seed]=plan.requests.slice(1).map(r=>r.section);}
  cases.push(row);
 }
}
assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
const catalog:Catalog={schema:'line.benchmark-v6.catalog.v1',music:[...music.values()],cases};
mkdirSync('benchmark/v6',{recursive:true});const bytes=Buffer.from(JSON.stringify(catalog)+'\n');
writeFileSync('benchmark/v6/catalog.json.gz',gzipSync(bytes));
writeFileSync('benchmark/v6/catalog.lock.json',JSON.stringify({schema:'line.benchmark-v6.catalog-lock.v1',sha256:sha(bytes),
 music:music.size,canonical:cases.filter(c=>c.split==='canonical').length,confirmation:cases.filter(c=>c.split==='confirmation').length,
 author:'scripts/benchmark/v6_author.ts',authoring:'No compiler outcomes read. Canonical musical parents preserved; confirmation selects source inputs outside the V5 catalog. All music was exposed in earlier ordinary benchmarks.'},null,2)+'\n');
console.log(JSON.stringify({canonical:cases.filter(c=>c.split==='canonical').length,confirmation:cases.filter(c=>c.split==='confirmation').length,music:music.size}));
if(process.argv.includes('--freeze'))writeFileSync('benchmark/v6/frozen.json',JSON.stringify({schema:'line.benchmark-v6.freeze.v1',judge:judgeIdentity()},null,2)+'\n');
