/** Learned proposals for coherent arcs; every output is checked by physical search. */
import {arcArrivalFeatures} from './arc_value.ts';
import type {ArcMotionControl} from './arc_geometry.ts';
export const ARC_POLICY_SCHEMA='line.arc-control-policy-features.v1';
export function arcPolicyArrival(state:any,velocity:{x:number;y:number}):number[]{
  const tail=state.points.TAIL,nose=state.points.NOSE,dx=nose.x-tail.x,dy=nose.y-tail.y;
  const angular=(dx*(nose.vy-tail.vy)-dy*(nose.vx-tail.vx))/Math.max(1,dx*dx+dy*dy);
  return arcArrivalFeatures(state,Math.atan2(velocity.y,velocity.x)*180/Math.PI,
    Math.hypot(velocity.x,velocity.y),Math.atan2(dy,dx)*180/Math.PI,angular,0);
}
export function arcControlProposals(features:number[],incoming:number,span:number,model:any,count:number):ArcMotionControl[]{
  if(model.featureSchema!==ARC_POLICY_SCHEMA||features.length!==model.featureCount||features.some(v=>!Number.isFinite(v)))throw new Error('arc policy feature mismatch');
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
