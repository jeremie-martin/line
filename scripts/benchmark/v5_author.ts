/** Score-blind authoring: existing musical targets and explicit construction coverage. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {loadCases,caseSpec,sha} from '../../benchmark/v3/model.ts';
import {planRepertoire,validateProductionPlan,type Construction} from '../v0/optimizer/repertoire_policy.ts';
import {policy} from '../../benchmark/v5/policy.ts';
import type {Catalog,RepertoireCase} from '../../benchmark/v5/model.ts';
import {judgeIdentity} from '../../benchmark/v5/contract.ts';
if(existsSync('benchmark/v5/frozen.json'))throw new Error('V5 is already frozen; author a new version instead');
const originals=loadCases();
const groupNames=[...new Set(originals.map(c=>c.group))];
// One source per musical group for automatic coverage; no compiler outcomes are read.
const canonical=groupNames.map(g=>originals.filter(c=>c.group===g).sort((a,b)=>a.id.localeCompare(b.id))[0]);
const fixedGroups=['regular_exceptions','cadence_transition','spacious_amplitude','dense_musical','high_air_energy','amor_na_praia','luna_bala','tiki_tiki'];
const fixed=canonical.filter(c=>fixedGroups.includes(c.group));assert.equal(fixed.length,8);
const confirmation=groupNames.filter(g=>['subdivision_pickup','irregular_microtimed','low_air_frontier','shelter','amour_de_ma_vie'].includes(g))
  .map(g=>originals.filter(c=>c.group===g).sort((a,b)=>a.id.localeCompare(b.id)).at(-1)!);
const families=['single','arcs','fold','serpentine','scallops','terraces','scattered'];
const cases:RepertoireCase[]=[],music=new Map([...canonical,...confirmation].map(c=>[c.id,c]));
for(const split of ['canonical','confirmation']as const){
  const sources=split==='canonical'?fixed:confirmation,seeds=split==='canonical'?policy.seeds:policy.confirmationSeeds;
  for(const c of sources)for(const family of families){
    const row:RepertoireCase={id:`${split}-${c.id}-${family}`,sourceId:c.id,panel:'fixed',family,split,plans:{},scoredSections:{}};
    for(const seed of seeds){
      const spec=caseSpec(c),plan=planRepertoire(spec,seed),n=plan.requests.length-1;
      // Includes early entry, middle-track replacement and endings over the panel.
      const fraction=[.05,.35,.65,1][parseInt(sha(c.id+':'+seed).slice(0,8),16)%4];
      const count=Math.min(3,n),first=1+Math.round((n-count)*fraction);
      const construction=(family==='single'?'arcs':family) as Construction;
      const guidance=family==='single'?'forbidden':family==='scattered'?'optional':'required';
      for(const r of plan.requests)if(r.section>0){r.construction=r.section>=first&&r.section<first+count?construction:'arcs';r.guidance=r.section>=first&&r.section<first+count?guidance:'optional';}
      plan.phrases=[];
      for(const r of plan.requests.slice(1)){
        const p=plan.phrases.at(-1);
        if(p&&p.construction===r.construction&&p.guidance===r.guidance)p.count++;
        else plan.phrases.push({first:r.section,count:1,construction:r.construction,guidance:r.guidance});
      }
      row.plans[seed]=validateProductionPlan(spec,plan);row.scoredSections[seed]=Array.from({length:count},(_,i)=>first+i);
    }
    cases.push(row);
  }
  for(const c of split==='canonical'?canonical:confirmation){
    const row:RepertoireCase={id:`${split}-${c.id}-automatic`,sourceId:c.id,panel:'automatic',family:c.group,split,plans:{},scoredSections:{}};
    for(const seed of seeds){const plan=planRepertoire(caseSpec(c),seed);row.plans[seed]=plan;row.scoredSections[seed]=plan.requests.slice(1).map(r=>r.section);}
    cases.push(row);
  }
}
const catalog:Catalog={schema:'line.benchmark-v5.catalog.v1',music:[...music.values()],cases};
assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
mkdirSync('benchmark/v5',{recursive:true});
const bytes=Buffer.from(JSON.stringify(catalog)+'\n');writeFileSync('benchmark/v5/catalog.json.gz',gzipSync(bytes));
writeFileSync('benchmark/v5/catalog.lock.json',JSON.stringify({schema:'line.benchmark-v5.catalog-lock.v1',sha256:sha(bytes),
  music:music.size,canonical:cases.filter(c=>c.split==='canonical').length,confirmation:cases.filter(c=>c.split==='confirmation').length,
  author:'scripts/benchmark/v5_author.ts',authoring:'No compiler outcomes read; targets copied unchanged from V4.'},null,2)+'\n');
console.log(JSON.stringify({canonical:cases.filter(c=>c.split==='canonical').length,confirmation:cases.filter(c=>c.split==='confirmation').length,music:music.size}));
if(process.argv.includes('--freeze'))writeFileSync('benchmark/v5/frozen.json',JSON.stringify({schema:'line.benchmark-v5.freeze.v1',judge:judgeIdentity()},null,2)+'\n');
