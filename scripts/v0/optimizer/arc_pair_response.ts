/** Bounded native-response refinement of two adjacent constructions. The caller
 * owns geometry, validation and physics accounting; invalid pairs are never
 * admitted. Every accepted pair improves the same measured objective. */
import {arcResponseStep} from './arc_response.ts';
export type PairMeasurement<T>={coordinates:number[];residuals:number[];value:number;payload:T};
export function refineArcPair<T>(initial:PairMeasurement<T>,scales:number[],limit:number,
 evaluate:(coordinates:number[])=>PairMeasurement<T>|null){
 let best=initial,proposals=0,viable=0,accepted=0,trust=1;
 const probe=(coordinates:number[])=>{
  proposals++;const measured=evaluate(coordinates);
  if(measured){viable++;if(measured.value<best.value-1e-12){best=measured;accepted++;}}
  return measured;
 };
 while(proposals+2*scales.length+3<=limit){
  const origin=best,jac=origin.residuals.map(()=>scales.map(()=>0));
  for(let d=0;d<scales.length;d++){
   const a=[...origin.coordinates],b=[...origin.coordinates];a[d]+=trust*scales[d];b[d]-=trust*scales[d];
   const plus=probe(a),minus=probe(b);
   for(let r=0;r<jac.length;r++)jac[r][d]=plus&&minus?(plus.residuals[r]-minus.residuals[r])/2:
    plus?plus.residuals[r]-origin.residuals[r]:minus?origin.residuals[r]-minus.residuals[r]:0;
  }
  const delta=arcResponseStep(jac,origin.residuals,.0002);
  if(delta)for(const fraction of [1,.5,.25])probe(origin.coordinates.map((v,d)=>v+fraction*trust*scales[d]*Math.max(-3,Math.min(3,delta[d]))));
  else break;
  if(best===origin)trust*=.5;
 }
 return {best,proposals,viable,accepted};
}
