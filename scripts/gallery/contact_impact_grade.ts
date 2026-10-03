/** Experimental music-review grade. The frozen V3–V6 judges are unchanged.
 * Span observations retain their established units; the impact contribution is
 * the shared one-to-one account, including timing and unmatched-event energy. */
import type {ImpactEvaluation as MusicalImpactEvaluation} from '../v0/optimizer/impact_accounts.ts';
import type {evaluateDetection,Score,Observation} from '../../benchmark/v3/evaluator.ts';
export function contactImpactGrade(historical:ReturnType<typeof evaluateDetection>,impact:MusicalImpactEvaluation){
  const {events,targets,account}=impact;
  const observations:Observation[]=historical.observations.filter(o=>o.axis!=='impact');
  const contacts=targets.map((target,i)=>{
    const match=account.matches.find(m=>m.target===i),event=match?events[match.event]:undefined;
    if(target.impact!==undefined)observations.push({gap:i,startFrame:i?targets[i-1].frame:0,endFrame:target.frame,tail:false,
      axis:'impact',target:target.impact,achieved:event?.strength??null,error:match?Math.abs(match.strengthError):null});
    return {targetFrame:target.frame,actualFrame:event?.onset??null,offset:match?.offset??null};
  });
  const failures:string[]=[];
  if(historical.terminus.reason!=='endOfSpec')failures.push(`terminus:${historical.terminus.reason}`);
  if(!impact.valid)failures.push('incomplete_impact_account');
  const components:Score['components']={};let loss=0,mass=1;
  for(const axis of ['air','speed','amplitude'] as const){
    const rows=observations.filter(o=>o.axis===axis);if(!rows.length)continue;
    const importance=axis==='amplitude'?1/3:1,weightSum=rows.reduce((s,o)=>s+o.endFrame-o.startFrame,0);
    if(rows.some(o=>o.error===null||!Number.isFinite(o.error)))failures.push(`missing_measurement:${axis}`);
    const mse=rows.reduce((s,o)=>s+(o.endFrame-o.startFrame)*(o.error??Infinity)**2,0)/weightSum;
    components[axis]={observations:rows.length,weightSum,rmsError:Math.sqrt(mse),weight:importance};
    loss+=importance*mse;mass+=importance;
  }
  loss=(loss+account.loss)/mass;
  components.impact={observations:targets.length,weightSum:targets.length,rmsError:Math.sqrt(account.loss),weight:1};
  for(const component of Object.values(components))component!.weight/=mass;
  const rms=Math.sqrt(loss),valid=!failures.length&&Number.isFinite(rms);
  const score:Score={valid,hardFailures:failures,weightedAxisRms:Number.isFinite(rms)?rms:null,components,
    score:valid?Math.round(1000*Math.exp(-rms/.25)*10000)/10000:0};
  return {contract:impact.contract,score,observations,contacts,
    offBeat:account.unmatchedEvents.map(i=>events[i].onset),terminus:historical.terminus,
    note:'Impact-account quality; not a frozen V6 headline. Impact loss includes strength, timing, missing targets and extra events.'};
}
