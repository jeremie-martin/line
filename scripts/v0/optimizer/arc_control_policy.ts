/** Learned proposals for coherent arcs; every output is checked by physical search. */
import {arcArrivalFeatures} from './arc_value.ts';
import type {ArcMotionControl} from './arc_geometry.ts';
export const ARC_POLICY_SCHEMA='line.arc-control-policy-features.v1';
// Loaded model artifacts stay immutable during compilation. Index their leaf
// memberships once; replacing either source array rebuilds the index.
const partitionIndices=new WeakMap<object,{exemplars:any[];trees:any[];buckets:Map<number,number[]>[]}>();
function partitionMatches(model:any,leaves:number[]):Uint32Array{
  let index=partitionIndices.get(model);
  if(!index||index.exemplars!==model.exemplars||index.trees!==model.proximityTrees){
    const buckets=leaves.map(()=>new Map<number,number[]>());
    for(let row=0;row<model.exemplars.length;row++){
      const memberships=model.exemplars[row].proximityLeaves;
      if(memberships?.length!==leaves.length)throw new Error('arc policy proximity mismatch');
      for(let tree=0;tree<leaves.length;tree++){
        const leaf=memberships[tree],members=buckets[tree].get(leaf);
        if(members)members.push(row);else buckets[tree].set(leaf,[row]);
      }
    }
    index={exemplars:model.exemplars,trees:model.proximityTrees,buckets};partitionIndices.set(model,index);
  }
  const counts=new Uint32Array(model.exemplars.length);
  for(let tree=0;tree<leaves.length;tree++)for(const row of index.buckets[tree].get(leaves[tree])??[])counts[row]++;
  return counts;
}
export function arcPolicyArrival(state:any,velocity:{x:number;y:number}):number[]{
  const tail=state.points.TAIL,nose=state.points.NOSE,dx=nose.x-tail.x,dy=nose.y-tail.y;
  const angular=(dx*(nose.vy-tail.vy)-dy*(nose.vx-tail.vx))/Math.max(1,dx*dx+dy*dy);
  return arcArrivalFeatures(state,Math.atan2(velocity.y,velocity.x)*180/Math.PI,
    Math.hypot(velocity.x,velocity.y),Math.atan2(dy,dx)*180/Math.PI,angular,0);
}
export function arcControlProposals(features:number[],incoming:number,span:number,model:any,count:number):ArcMotionControl[]{
  if(model.featureSchema!==ARC_POLICY_SCHEMA||features.length!==model.featureCount||features.some(v=>!Number.isFinite(v)))throw new Error('arc policy feature mismatch');
  if(!Number.isSafeInteger(count)||count<0)throw new Error('invalid arc policy count');
  if(count===0)return [];
  if(model.residualBase){
    const base=arcControlProposals(features,incoming,span,model.residualBase,1)[0];
    const residual=arcControlProposals(features,0,span,model.residualModel,count);
    const strength=model.residualStrength??1;
    if(!Number.isFinite(strength)||strength<0)throw new Error('invalid residual policy strength');
    return residual.map(delta=>Object.fromEntries(Object.keys(base).map(key=>[key,
      base[key as keyof ArcMotionControl]!+strength*delta[key as keyof ArcMotionControl]!])) as ArcMotionControl);
  }
  if(model.models){
    const weights=model.proposalWeights??model.models.map(()=>1),sum=weights.reduce((a:number,b:number)=>a+b,0);
    const counts=weights.map((w:number)=>Math.floor(count*w/sum));
    for(let j=0;counts.reduce((a:number,b:number)=>a+b,0)<count;j++)counts[j%counts.length]++;
    return model.models.flatMap((m:any,j:number)=>counts[j]?arcControlProposals(features,incoming,span,m,counts[j]):[]);
  }
  if(model.exemplars){
    const input=model.proximityTrees?features.map(Math.fround):undefined;
    const queryLeaves=model.proximityTrees?.map((tree:any)=>{
      let n=0;while(tree.left[n]>=0)n=input![tree.feature[n]]<=tree.threshold[n]?tree.left[n]:tree.right[n];
      return n;
    });
    const weights:number[]|undefined=model.featureWeights;
    if(weights&&(weights.length!==features.length||weights.some(w=>!Number.isFinite(w)||w<0)))throw new Error('arc policy distance weights mismatch');
    const nearest:Array<{distance:number;value:number[]}>=[],limit=Math.max(24,count*8);
    const matches=queryLeaves?partitionMatches(model,queryLeaves):undefined;
    for(let index=0;index<model.exemplars.length;index++){
      const row=model.exemplars[index];
      let partitionDistance=0;
      if(queryLeaves){
        partitionDistance=queryLeaves.length-matches![index];
        // Physical distance adds a nonnegative tie-breaker. A partition lower
        // bound already beyond the retained neighborhood cannot enter it.
        if(nearest.length===limit&&partitionDistance>nearest[nearest.length-1].distance)continue;
      }
      let distance=0;for(let k=0;k<features.length;k++)distance+=(features[k]-row.features[k])**2*(weights?.[k]??(k>=47?4:k<7?2:1));
      if(queryLeaves){
        // Shared supervised partitions provide the primary neighborhood;
        // continuous physical distance breaks ties without case identities.
        distance=partitionDistance+distance/(1+distance);
      }
      if(nearest.length===limit&&distance>=nearest[nearest.length-1].distance)continue;
      nearest.push({distance,value:row.target});nearest.sort((a,b)=>a.distance-b.distance);if(nearest.length>limit)nearest.pop();
    }
    const selected:ArcMotionControl[]=[];
    for(const {value:v} of nearest){
      const c={entry:incoming+30*v[0],turn:60*v[1],exit:incoming+60*v[2],support:span*v[3],bias:v[4],offset:v[5],clearance:12*v[6],turnFraction:v[7],bend:30*v[8],guideFlare:8*v[9]};
      if(selected.some(p=>Math.abs(c.turn-p.turn)<4&&Math.abs(c.entry-p.entry)<2&&Math.abs(c.exit-p.exit)<4&&Math.abs(c.support-p.support)<1))continue;
      selected.push(c);if(selected.length>=count)break;
    }
    return selected;
  }
  // ExtraTrees validates prediction inputs as float32 before tree traversal.
  const input=features.map(Math.fround);
  const leaves=model.trees.map((tree:any)=>{
    let n=0;while(tree.left[n]>=0)n=input[tree.feature[n]]<=tree.threshold[n]?tree.left[n]:tree.right[n];
    return tree.value[n] as number[];
  });
  const mean=(rows:number[][])=>rows[0].map((_,j)=>rows.reduce((sum,row)=>sum+row[j],0)/rows.length);
  const vectors=[mean(leaves),mean(leaves.filter((_:any,i:number)=>i%2===0)),mean(leaves.filter((_:any,i:number)=>i%2===1)),...leaves];
  return vectors.slice(0,count).map(v=>({entry:incoming+30*v[0],turn:60*v[1],exit:incoming+60*v[2],
    support:span*v[3],bias:v[4],offset:v[5],clearance:12*v[6],turnFraction:v[7],bend:30*v[8],guideFlare:8*v[9]}));
}
