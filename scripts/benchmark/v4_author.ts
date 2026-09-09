/** Author the entire V4 catalog without loading any compiler result or model. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {loadCases as loadV3,caseGaps,caseSpec,sampledCurve,sha,type Case} from '../../benchmark/v3/model.ts';
import {policy} from '../../benchmark/v4/policy.ts';
import {validateSpec,effectiveAxes} from '../v0/core/substrate.ts';

const output='benchmark/v4';mkdirSync(output,{recursive:true});
assert.ok(!existsSync(output+'/catalog.lock.json'),'V4 already authored; a frozen catalog is not regenerated during optimization.');
const originals=loadV3(),companions:Case[]=[],design:any[]=[];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const ordinal=new Map<string,number>();
for(const source of originals){
  const order=ordinal.get(source.group)??0;ordinal.set(source.group,order+1);
  const variant=order%3,group=source.group,gaps=caseGaps(source),last=gaps.length-1;
  const low=group==='low_air_frontier',sparse=group==='sparse_transition';
  const pickup=group==='rapid_pickup_frontier'||group==='subdivision_pickup';
  const dense=group==='dense_musical'||group==='dense_recovery_frontier';
  const micro=group==='irregular_microtimed',cadence=group==='cadence_transition';
  const music=source.stratum==='development_music';
  const tempo=music?[.96,.94,.95][variant]:[.94,.91,.96][variant];
  const section=(frame:number)=>Math.min(5,Math.floor(6*frame/source.durationFrames));
  const lengths=gaps.map((g,i)=>{
    const old=g.endFrame-g.startFrame;
    if(i===0)return old; // Preserve the initial lead-in.
    if(i===last)return Math.max(3,Math.round(old*tempo));
    const phase=section((g.startFrame+g.endFrame)/2);
    const factor=cadence?[1,.89,1.08,.93,1.04,1][phase]:1;
    return old<7?old:Math.max(7,Math.round(old*tempo*factor));
  });
  const redistribution:string[]=[];
  for(let i=1;i+1<last;i++){
    if(lengths[i]<7||lengths[i+1]<7)continue;
    const total=lengths[i]+lengths[i+1];
    if(micro&&i%2===1){
      const delta=Math.round(total*.035)*(Math.floor(i/8)%2?-1:1);
      const first=clamp(lengths[i]+delta,7,total-7);lengths[i+1]=total-first;lengths[i]=first;
      if(!redistribution.length)redistribution.push('paired 25–50ms-scale played offsets, preserving each pair duration');
    }else if(pickup&&i%12===4){
      const first=clamp(Math.round(total*[.28,.35,.31][variant]),7,total-7);
      lengths[i]=first;lengths[i+1]=total-first;
      if(!redistribution.length)redistribution.push('short anticipation and compensating answer at phrase positions');
    }else if(dense&&i%12===4&&i+2<last&&lengths[i+2]>=7){
      const sum=total+lengths[i+2],short=Math.max(7,Math.round(sum*.24));
      lengths[i]=short;lengths[i+1]=short;lengths[i+2]=sum-2*short;
      if(!redistribution.length)redistribution.push('two short contacts followed by a longer recovery, preserving figure duration');
    }
  }
  const supported=new Set<number>();
  if(low){
    const intervals=gaps.map((g,i)=>({i,n:g.endFrame-g.startFrame})).filter(x=>x.i>0&&x.i<last&&x.n>=80)
      .sort((a,b)=>b.n-a.n).slice(0,3).sort((a,b)=>a.i-b.i);
    const seconds=[[7,9,12],[8,10,11],[9,12,15]][variant];
    intervals.forEach((x,j)=>{lengths[x.i]=40*seconds[j];supported.add(x.i);});
  }
  let endingSeconds=lengths[last]/40;
  if(sparse)endingSeconds=[7,9,12,8,10][order%5];
  else if(low&&variant===2)endingSeconds=15;
  else if(!music&&variant===2)endingSeconds=[7,8,9][Math.floor(order/3)%3];
  lengths[last]=Math.max(lengths[last],Math.round(endingSeconds*40));
  const bounds=[0];for(const length of lengths)bounds.push(bounds.at(-1)!+length);
  const durationFrames=bounds.at(-1)!,longEnding=lengths[last]>=7*40;
  const inverse=(frame:number)=>{
    let i=0;while(i<last&&frame>bounds[i+1])i++;
    return gaps[i].startFrame+(frame-bounds[i])/lengths[i]*(gaps[i].endFrame-gaps[i].startFrame);
  };
  const forward=(frame:number)=>{
    let i=0;while(i<last&&frame>gaps[i].endFrame)i++;
    return bounds[i]+(frame-gaps[i].startFrame)/(gaps[i].endFrame-gaps[i].startFrame)*lengths[i];
  };
  const impactValues=source.contacts.flatMap(c=>c.impact===undefined?[]:[c.impact]);
  const impactCenter=mean(impactValues),impactContrast=music?1.12:[1.16,1.20,1.14][variant];
  const contacts=source.contacts.map((c,i)=>({frame:bounds[i+1],...(c.impact===undefined?{}:
    {impact:clamp(impactCenter+impactContrast*(c.impact-impactCenter),.06,.96)})}));
  const airCenter=mean(source.air.map(a=>a.target));
  const air:Case['air']=source.air.map((a,i)=>{
    const phase=section((gaps[i].startFrame+gaps[i].endFrame)/2);
    let requested=i===0?a.target:clamp(airCenter+1.10*(a.target-airCenter)+[0,.02,-.02,.015,0,-.015][phase],.02,.93);
    if(supported.has(i))requested=[.04,.055,.07][variant];
    if(i===last&&longEnding)requested=low||sparse?[.06,.09,.12][variant]:Math.min(requested,.18+.04*variant);
    const n=lengths[i]+1,min=i===last?0:lengths[i]>6?6:1,max=n-2;
    const airborneFrames=clamp(Math.round(requested*n),min,max);
    return {gap:i,airborneFrames,samples:n,requested,target:airborneFrames/n,
      adjustment:requested<min/n?'landing_floor':requested>max/n?'contact_support_ceiling':'quantization'};
  });
  const samples:Case['samples']={};
  for(const axis of ['speed','amplitude'] as const){
    const original=source.samples[axis];if(!original)continue;
    const defined=original.filter((x):x is number=>x!==null),center=mean(defined),curve=sampledCurve(original);
    const contrast=axis==='speed'?(music?1.08:1.12):(music?1.12:1.22);
    const lag=axis==='amplitude'?(variant-1)*.65*40:0;
    samples[axis]=Array.from({length:durationFrames+1},(_,f)=>{
      const old=inverse(f),value=curve(clamp(old+lag,0,source.durationFrames)/40);
      if(value===undefined)return null;
      const phrase=axis==='speed'&&!music?.025*Math.sin(2*Math.PI*old/source.durationFrames):0;
      return clamp(center+contrast*(value-center)+phrase,axis==='speed'?.18:.02,.90);
    });
  }
  const addedAmplitude=!samples.amplitude&&variant===2&&['regular_exceptions','high_air_energy'].includes(group);
  if(addedAmplitude)samples.amplitude=Array.from({length:durationFrames+1},(_,f)=>.08+.12*(.5-.5*Math.cos(4*Math.PI*f/durationFrames)));
  const id='stretch_'+source.id;
  const phases=source.phases.map(p=>({...p,start:forward(Math.round(p.start*40))/40,end:forward(Math.round(p.end*40))/40}));
  if(!phases.length)phases.push({id:'derived_program',start:0,end:durationFrames/40,intent:'Synthetic companion of an exposed production reference; not synchronized to the source audio.'});
  const c:Case={...source,id,title:source.title+' — V4 companion',durationFrames,contacts,samples,air,phases,
    provenance:{kind:'new_program',source:source.id,grammar:group,
      brief:`Matched companion: tempo factor ${tempo}; impact contrast ${impactContrast}; stronger phrase-level speed/height variation${addedAmplitude?'; moderate amplitude added':''}. ${redistribution.join('; ')}. Supported interior spans ${[...supported].map(i=>lengths[i]/40).join(', ')||'unchanged'}s; ending ${(lengths[last]/40).toFixed(3)}s. Related development material, not an independent musical work.`}};
  validateSpec(caseSpec(c));
  for(const g of caseGaps(c))assert.ok(Math.abs(effectiveAxes(g,caseSpec(c)).air!-c.air[g.index].target)<1e-10);
  companions.push(c);
  design.push({source:source.id,companion:id,parentId:c.parentId,group,variant,tempo,impactContrast,
    speedContrast:music?1.08:1.12,amplitudeContrast:music?1.12:1.22,addedAmplitude,redistribution,
    supportedSeconds:[...supported].map(i=>lengths[i]/40),endingBefore:(source.durationFrames-source.contacts.at(-1)!.frame)/40,
    endingAfter:lengths[last]/40,durationBefore:source.durationFrames/40,durationAfter:durationFrames/40});
}
const cases=[...originals,...companions];assert.equal(cases.length,176);
const raw=Buffer.from(JSON.stringify(cases)+'\n'),compressed=gzipSync(raw,{level:9});
writeFileSync(output+'/specifications.json.gz',compressed);
const lock={schema:'line.benchmark-v4.catalog-lock.v1',status:'authored-before-compiler-evaluation',specifications:176,
  unchangedV3:88,companions:88,aggregationParents:new Set(cases.map(c=>c.parentId)).size,
  specificationsSha256:sha(raw),compressedSha256:sha(compressed),v3CatalogSha256:sha(readFileSync('benchmark/v3/specifications.json.gz')),
  authoringSourceSha256:sha(readFileSync(import.meta.filename)),policySha256:sha(readFileSync('benchmark/v4/policy.ts')),
  compilerOutcomesConsulted:false,expectedDropIsNotADesignRequirement:true};
for(const [name,value] of [['catalog.lock.json',lock],['catalog-design.json',design]] as const){
  const body=JSON.stringify(value,null,2)+'\n';writeFileSync(output+'/'+name,body);writeFileSync(output+'/'+name+'.sha256',sha(body)+'\n');
}
console.log(JSON.stringify(lock,null,2));
