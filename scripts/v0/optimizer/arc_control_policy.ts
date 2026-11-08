import {hypot2} from '../../lib/hypot2.ts';
/** Learned proposals for coherent arcs; every output is checked by physical search. */
import {arcArrivalFeatures, arcFeatureDistance} from './arc_value.ts';
import type {ArcMotionControl} from './arc_geometry.ts';
export const ARC_POLICY_SCHEMA='line.arc-control-policy-features.v1';
import {arcReferencedControl, arcControlsSimilar} from './arc_motion_control.ts';
export {arcReferencedControl} from './arc_motion_control.ts';
export const ARC_HORIZON_POLICY_SCHEMA='line.arc-horizon-control-policy-features.v1';
// Loaded model artifacts stay immutable during compilation: index their leaf
// memberships once.
const partitionIndices=new WeakMap<object,Map<number,number[]>[]>();
function partitionMatches(model:any,leaves:number[]):Uint32Array{
  let index=partitionIndices.get(model);
  if(!index){
    const buckets=leaves.map(()=>new Map<number,number[]>());
    for(let row=0;row<model.exemplars.length;row++){
      const memberships=model.exemplars[row].proximityLeaves;
      if(memberships?.length!==leaves.length)throw new Error('arc policy proximity mismatch');
      for(let tree=0;tree<leaves.length;tree++){
        const leaf=memberships[tree],members=buckets[tree].get(leaf);
        if(members)members.push(row);else buckets[tree].set(leaf,[row]);
      }
    }
    partitionIndices.set(model,index=buckets);
  }
  const counts=new Uint32Array(model.exemplars.length);
  for(let tree=0;tree<leaves.length;tree++)for(const row of index[tree].get(leaves[tree])??[])counts[row]++;
  return counts;
}
export function arcPolicyArrival(state:any,velocity:{x:number;y:number}):number[]{
  const tail=state.points.TAIL,nose=state.points.NOSE,dx=nose.x-tail.x,dy=nose.y-tail.y;
  const angular=(dx*(nose.vy-tail.vy)-dy*(nose.vx-tail.vx))/Math.max(1,dx*dx+dy*dy);
  return arcArrivalFeatures(state,Math.atan2(velocity.y,velocity.x)*180/Math.PI,
    hypot2(velocity.x,velocity.y),Math.atan2(dy,dx)*180/Math.PI,angular,0);
}
export function arcControlProposals(features:number[],incoming:number,span:number,model:any,count:number):ArcMotionControl[]{
  const expected=model.featureSchema===ARC_POLICY_SCHEMA?57:model.featureSchema===ARC_HORIZON_POLICY_SCHEMA?67:0;
  if(!expected||model.featureCount!==expected||![57,67].includes(features.length)||features.length<expected||features.some(v=>!Number.isFinite(v)))throw new Error('arc policy feature mismatch');
  if(features.length!==expected)features=features.slice(0,expected);
  if(!Number.isSafeInteger(count)||count<0)throw new Error('invalid arc policy count');
  if(count===0)return [];
  if(model.proximityCorrection)throw new Error('proximityCorrection requires the archived analogy runtime; unsupported by this compiler');
  if(model.models && (!model.models.length || model.proposalWeights && (model.proposalWeights.length!==model.models.length || model.proposalWeights.some((w:number)=>!Number.isFinite(w)||w<0) || !model.proposalWeights.some((w:number)=>w>0))))throw new Error('invalid arc policy mixture weights');
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
  if(model.catalogue)return catalogueProposals(model.catalogue,features,incoming,span,count);
  if(model.exemplars){
    const input=model.proximityTrees?features.map(Math.fround):undefined;
    const queryLeaves=model.proximityTrees?.map((tree:any)=>{
      let n=0;while(tree.left[n]>=0)n=input![tree.feature[n]]<=tree.threshold[n]?tree.left[n]:tree.right[n];
      return n;
    });
    const weights:number[]|undefined=model.featureWeights;
    if(weights&&(weights.length!==features.length||weights.some(w=>!Number.isFinite(w)||w<0)))throw new Error('arc policy distance weights mismatch');
    const nearest:Array<{distance:number;value:number[];reference?:{control:ArcMotionControl;incoming:number;span:number}}>=[],limit=Math.max(24,count*8);
    const matches=queryLeaves?partitionMatches(model,queryLeaves):undefined;
    let ordered=true;
    for(let index=0;index<model.exemplars.length;index++){
      const row=model.exemplars[index];
      let partitionDistance=0;
      if(queryLeaves){
        partitionDistance=queryLeaves.length-matches![index];
        // Physical distance adds a nonnegative tie-breaker. A partition lower
        // bound already beyond the retained neighborhood cannot enter it.
        if(nearest.length===limit&&partitionDistance>nearest[nearest.length-1].distance)continue;
      }
      let distance=arcFeatureDistance(features,row.features,weights);
      if(queryLeaves){
        // Shared supervised partitions provide the primary neighborhood;
        // continuous physical distance breaks ties without case identities.
        distance=partitionDistance+distance/(1+distance);
      }
      if(nearest.length===limit&&distance>=nearest[nearest.length-1].distance)continue;
      const entry={distance,value:row.target,reference:row.controlReference};
      ordered=ordered&&!Number.isNaN(distance);
      if(ordered){
        // Insert after equal distances to preserve the exemplar order on ties.
        let low=0,high=nearest.length;
        while(low<high){
          const middle=(low+high)>>>1;
          if(distance<nearest[middle].distance)high=middle;else low=middle+1;
        }
        nearest.splice(low,0,entry);
      }else{
        // NaN does not define an ordering; retain the original stable sort.
        nearest.push(entry);nearest.sort((a,b)=>a.distance-b.distance);
      }
      if(nearest.length>limit)nearest.pop();
    }
    const selected:ArcMotionControl[]=[];
    for(const {value:v,reference} of nearest){
      const c=reference?arcReferencedControl(reference,incoming,span):{entry:incoming+30*v[0],turn:60*v[1],exit:incoming+60*v[2],support:span*v[3],bias:v[4],offset:v[5],clearance:12*v[6],turnFraction:v[7],bend:30*v[8],guideFlare:8*v[9]};
      if(selected.some(p=>arcControlsSimilar(c,p)))continue;
      selected.push(c);if(selected.length>=count)break;
    }
    return selected;
  }
  if(!model.trees?.length)throw new Error('arc policy forest must contain a tree');
  // ExtraTrees validates prediction inputs as float32 before tree traversal.
  const input=features.map(Math.fround);
  const leaves=model.trees.map((tree:any)=>{
    let n=0;while(tree.left[n]>=0)n=input[tree.feature[n]]<=tree.threshold[n]?tree.left[n]:tree.right[n];
    return tree.value[n] as number[];
  });
  const mean=(rows:number[][])=>{if(!rows.length)rows=leaves;return rows[0].map((_,j)=>rows.reduce((sum,row)=>sum+row[j],0)/rows.length);};
  const vectors=[mean(leaves),mean(leaves.filter((_:any,i:number)=>i%2===0)),mean(leaves.filter((_:any,i:number)=>i%2===1)),...leaves];
  return vectors.slice(0,count).map(v=>({entry:incoming+30*v[0],turn:60*v[1],exit:incoming+60*v[2],
    support:span*v[3],bias:v[4],offset:v[5],clearance:12*v[6],turnFraction:v[7],bend:30*v[8],guideFlare:8*v[9]}));
}

/** A readable move catalogue (research). Per contact side, a smooth table over the
 * requested strength of the beat this arc lands on and the arrival heading gives the
 * typical entry, turn and exit relative to the arrival (bilinear on a small grid).
 * Each style is a real demonstration: its residual from that table and its free
 * fields (support relative to the span, bias, offset, guide and shape fields). */
function catalogueProposals(cat:any,features:number[],incoming:number,span:number,count:number):ArcMotionControl[]{
  const ask=Math.max(0,features[48]),heading=Math.atan2(features[0],features[1])*180/Math.PI;
  const cell=(axis:number[],x:number)=>{
    const v=Math.min(axis.at(-1)!,Math.max(axis[0],x));let i=0;
    while(i<axis.length-2&&v>axis[i+1])i++;
    return [i,(v-axis[i])/(axis[i+1]-axis[i])];
  };
  const [i,u]=cell(cat.ask,ask),[j,v]=cell(cat.heading,heading),n=cat.heading.length;
  const core=(side:number)=>{
    const t=cat.cores[String(side)];if(!t)return undefined;
    return [0,1,2].map(o=>(1-u)*(1-v)*t[i*n+j][o]+(1-u)*v*t[i*n+j+1][o]+u*(1-v)*t[(i+1)*n+j][o]+u*v*t[(i+1)*n+j+1][o]);
  };
  const cores=new Map<number,number[]|undefined>();
  const selected:ArcMotionControl[]=[];
  for(const style of cat.styles){
    if(!cores.has(style.side))cores.set(style.side,core(style.side));
    const c0=cores.get(style.side);if(!c0)continue;
    const {support,...free}=style.control;
    const c={...free,entry:incoming+c0[0]+style.residual[0],turn:c0[1]+style.residual[1],exit:incoming+c0[2]+style.residual[2],support:span*support} as ArcMotionControl;
    if(selected.some(p=>arcControlsSimilar(c,p)))continue;
    selected.push(c);if(selected.length>=count)break;
  }
  return selected;
}
