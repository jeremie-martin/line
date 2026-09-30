import {shiftedGeometricMean} from '../../scripts/v0/score.ts';
import {policy} from './policy.ts';
import type {RepertoireCase} from './model.ts';
export type V5Row={id:string;seed:number;score:number;musicalScore:number;valid:boolean;fulfilled:number;requested:number;trackHash:string};
export function requestScore(musicalScore:number,valid:boolean,fulfilled:boolean[]){
  if(!fulfilled.length)throw new Error('V5 requires scored construction requests');
  if(!Number.isFinite(musicalScore)||musicalScore<0||musicalScore>1000)throw new Error('invalid musical score');
  return valid?musicalScore*fulfilled.filter(Boolean).length/fulfilled.length:0;
}
export function summarize(rows:V5Row[],cases:RepertoireCase[],seeds:readonly number[]){
  if(!cases.length||!seeds.length||new Set(seeds).size!==seeds.length||rows.length!==cases.length*seeds.length)throw new Error('incomplete V5 panel');
  const mean=(xs:number[])=>{if(!xs.length)throw new Error('empty V5 aggregation group');return xs.reduce((n,x)=>n+x,0)/xs.length;};
  const aggregate=(key:'score'|'musicalScore')=>{
    const scores=new Map(cases.map(c=>{
      const selected=rows.filter(r=>r.id===c.id);
      if(selected.length!==seeds.length||seeds.some(s=>selected.filter(r=>r.seed===s).length!==1))throw new Error('missing or duplicate V5 seed');
      return [c.id,shiftedGeometricMean(selected.map(r=>r[key]))];
    }));
    const panels=Object.fromEntries((['fixed','automatic']as const).map(panel=>{
      const members=cases.filter(c=>c.panel===panel);
      const families=[...new Set(members.map(c=>c.family))].map(family=>{
        const selected=members.filter(c=>c.family===family),parents=[...new Set(selected.map(c=>c.sourceId))];
        return {family,score:mean(parents.map(parent=>mean(selected.filter(c=>c.sourceId===parent).map(c=>scores.get(c.id)!))))};
      });
      return [panel,{score:mean(families.map(f=>f.score)),families}];
    }));
    return {headline:panels.fixed.score*policy.panelWeights.fixed+panels.automatic.score*policy.panelWeights.automatic,panels};
  };
  const qualified=aggregate('score'),musical=aggregate('musicalScore');
  return {...qualified,musical,runs:rows.length,valid:rows.filter(r=>r.valid).length,
    fullyRealized:rows.filter(r=>r.valid&&r.fulfilled===r.requested).length,
    realizedRequests:rows.reduce((n,r)=>n+(r.valid?r.fulfilled:0),0),requested:rows.reduce((n,r)=>n+r.requested,0),
    distinctTracks:new Set(rows.map(r=>r.trackHash)).size};
}
