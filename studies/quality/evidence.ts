/** Compact, complete, input-checked evidence; raw tracks remain local. */
import {writeFileSync} from 'node:fs';
import {loadRun,assertPairedRuns} from '../../tools/eval/records.ts';
import {summarize,songValues,bootstrap} from '../../tools/eval/summary.ts';
import {digest} from '../../tools/eval/inputs.ts';
const main='/home/wyss/line',baseline=loadRun(main+'/generated/eval/quality-20261005-baseline');
const paths:any={Q1:['/tmp/line-quality-20261005','q1-response-blocks'],Q2:['/tmp/line-quality-continuation-20261005','q2-continuation-fit'],
 Q3:['/tmp/line-quality-incidence-20261005','q3-impact-incidence'],Q5:['/tmp/line-quality-incidence-20261005','q5-arrival-frame'],
 Q6:['/tmp/line-quality-continuation-20261005','q6-response-rebase'],Q8:['/tmp/line-quality-continuation-20261005','q8-no-value'],
 Q10:['/tmp/line-quality-incidence-20261005','q10-deeper-rollout'],Q11:['/tmp/line-quality-incidence-20261005','q11-fixed-tessellation','q11-baseline-remeasured'],
 Q12:['/tmp/line-quality-continuation-20261005','q12-differential'],Q13:['/tmp/line-quality-20261005','q13-response-trust'],
 Q14:['/tmp/line-quality-steeper-20261006','q14-steeper'],Q15:['/tmp/line-quality-incidence-20261005','q15-consistent-horizon'],
 Q16:['/tmp/line-quality-continuation-20261005','q16-scatter-alternatives'],
 'Q16-confirm':['/tmp/line-quality-continuation-20261005','q16-scatter-confirm','/home/wyss/line/generated/eval/c-c'],
 Q18:['/tmp/line-quality-incidence-20261005','q18-staged-lookahead'],
 Q19:['/tmp/line-quality-steeper-20261006','q19-fragment-incumbent'],
 Q20:['/tmp/line-quality-incidence-20261005','q20-entry-placement','q20-baseline-remeasured'],
 Q21:['/tmp/line-quality-continuation-20261005','q21-scatter-retention'],
 'Q21-confirm':['/tmp/line-quality-steeper-20261006','q21-scatter-confirm','/home/wyss/line/generated/eval/c-c'],
 'Q23-old':['/tmp/line-quality-continuation-20261005','q23-old-rank-only'],
 'Q23-geometry':['/tmp/line-quality-incidence-20261005','q23-geometry-rank-only'],
 'Q23-confirm':['/tmp/line-quality-incidence-20261005','q23-geometry-confirm','/home/wyss/line/generated/eval/c-c'],
 Q24:['/tmp/line-quality-steeper-20261006','q24-budget-six-million'],
 Q25:['/tmp/line-quality-20261005','q25-prefix-beam'],
 Q25b:['/tmp/line-quality-20261005','q25b-prefix-beam-eight'],
 Q25c:['/tmp/line-quality-value-20261005','q25c-beam-geometry-value'],
 'Q25c-confirm':['/tmp/line-quality-value-20261005','q25c-beam-confirm','/home/wyss/line/generated/eval/c-c'],
 'Q25c-reserved48':['/tmp/line-quality-value-20261005','q25c-beam-fresh','/tmp/line-quality-review-20261006/generated/eval/quality-fresh-baseline'],
 Q26:['/tmp/line-quality-continuation-20261005','q26-scatter-model'],
 Q27:['/tmp/line-quality-steeper-20261006','q27-scatter-contract'],
 Q28:['/tmp/line-quality-incidence-20261005','q28-impact-priority'],
 Q30:['/tmp/line-quality-continuation-20261005','q30-authored-spans'],
 Q31:['/tmp/line-quality-incidence-20261005','q31-shared-objective'],
 Q33:['/tmp/line-quality-continuation-20261005','q33-consistent-beam'],
 Q34:['/tmp/line-quality-steeper-20261006','q34-beam-complete-objective'],
 'Q34-confirm':['/tmp/line-quality-steeper-20261006','q34-beam-confirm','/home/wyss/line/generated/eval/c-c'],
 'Q34-high':['/tmp/line-quality-steeper-20261006','q34-beam-six-million'],
 Q35:['/tmp/line-quality-20261005','q35-anytime-beam'],
 'Q35-high':['/tmp/line-quality-20261005','q35-anytime-six-million'],
 Q36:['/tmp/line-quality-incidence-20261005','q36-beam-no-value'],
 Q37:['/tmp/line-quality-continuation-20261005','q37-beam-old-value'],
 Q38:['/tmp/line-quality-review-20261006','q38-rotational-arrivals'],
 Q39:['/tmp/line-quality-value-20261005','q39-beam-capacity'],
 Q40:['/tmp/line-quality-incidence-20261005','q40-boundary-patch'],
 'Q40-high':['/tmp/line-quality-incidence-20261005','q40-boundary-patch-high'],
 Q42:['/tmp/line-quality-continuation-20261005','q42-additive-future'],
 'Q42-confirm':['/tmp/line-quality-continuation-20261005','q42-additive-confirm','/home/wyss/line/generated/eval/c-c'],
 Q43:['/tmp/line-quality-steeper-20261006','q43-whole-response'],
 'Q43-high':['/tmp/line-quality-steeper-20261006','q43-whole-response-high'],
 Q46:['/tmp/line-quality-incidence-20261005','q46-regret-sweep'],
 Q47:['/tmp/line-quality-value-20261005','q47-consistent-sequential'],
 Q48:['/tmp/line-quality-20261005','q48-predicted-arrival'],
 'Q31-confirm':['/tmp/line-quality-foundation-20261006','q31-objective-confirm','/home/wyss/line/generated/eval/c-c'],
 'Q42-recheck48':['/tmp/line-quality-continuation-20261005','q42-additive-recheck48','/tmp/line-quality-review-20261006/generated/eval/quality-fresh-baseline'],
 'Q46-high':['/tmp/line-quality-incidence-20261005','q46-regret-sweep-high'],
 'Q48-confirm':['/tmp/line-quality-20261005','q48-predicted-arrival-confirm','/home/wyss/line/generated/eval/c-c'],
 Q49:['/tmp/line-quality-incidence-20261005','q49-native-arrival'],
 Q50:['/tmp/line-quality-steeper-20261006','q50-sixteen-prefixes'],
 'Q48-high':['/tmp/line-quality-20261005','q48-predicted-arrival-high'],
 Q51:['/tmp/line-quality-native-fragments-20261006','q51-native-fragments','q51-baseline-remeasured'],
 Q52:['/tmp/line-quality-cached-contacts-20261006','q52-cached-contacts','q52-baseline-remeasured'],
 'Q52-confirm':['/tmp/line-quality-cached-contacts-20261006','q52-cached-contacts-confirm','q52-confirm-baseline-remeasured'],
 'Q50-high':['/tmp/line-quality-steeper-20261006','q50-sixteen-prefixes-high'],
 Q55:['/tmp/line-quality-cached-arrivals-20261006','q55-cached-arrivals','q55-baseline-remeasured'],
 'Q55-confirm':['/tmp/line-quality-cached-arrivals-20261006','q55-cached-arrivals-confirm','q55-confirm-baseline-remeasured'],
 Q56:['/tmp/line-quality-cached-no-value-20261006','q56-cached-no-value','/tmp/line-quality-cached-arrivals-20261006/generated/eval/q55-baseline-remeasured'],
 Q44:['/tmp/line-quality-value-20261005','q44-four-prefixes'],
 Q45:['/tmp/line-quality-incidence-20261005','q45-two-prefixes'],
 Q32:['/tmp/line-quality-value-20261005','q32-beam-stack'],
 'Q32-recheck48':['/tmp/line-quality-value-20261005','q32-beam-stack-recheck','/tmp/line-quality-review-20261006/generated/eval/quality-fresh-baseline'],
 'Q4-blind':['/tmp/line-quality-continuation-20261005','q4-value-blind'],
 'Q4-geometry':['/tmp/line-quality-incidence-20261005','q4-value-geometry']};
const evidence:any={schema:'line.compiler-campaign-evidence.v1',baseline:{plan:baseline.run,planSha256:digest(baseline.run)},runs:{}};
for(const [id,[root,name,baseName]] of Object.entries(paths) as any){
 const run=loadRun(root+'/generated/eval/'+name),base=baseName?loadRun(baseName.startsWith('/')?baseName:root+'/generated/eval/'+baseName):baseline;
 assertPairedRuns(run,base);
 const subsets:any={};
 for(const perturbed of [false,true]){
  const filter=(c:any)=>!!c.case.perturbation===perturbed;
  subsets[perturbed?'perturbed':'authored']=Object.fromEntries(Object.keys(summarize([...run.cells.values()][0])).map(metric=>{
   const perSong=songValues(run,metric,filter,base);
   return [metric,{baseline:bootstrap(songValues(base,metric,filter)),candidate:bootstrap(songValues(run,metric,filter)),paired:bootstrap(perSong),perSong:Object.fromEntries(perSong)}];
  }));
 }
 evidence.runs[id]={name,compiler:run.run.identity,evaluator:run.run.evaluator,planSha256:digest(run.run),baselinePlanSha256:digest(base.run),
  cases:run.run.panel.map(c=>({id:c.id,trackSha256:run.cells.get(c.id).trackHash,baselineTrackSha256:base.cells.get(c.id).trackHash,
    complete:run.cells.get(c.id).complete,fulfilled:run.cells.get(c.id).fulfilled})),subsets};
}
writeFileSync(main+'/docs/research/quality-20261005-evidence.json',JSON.stringify(evidence)+'\n');
console.log(`${Object.keys(paths).length} complete paired comparisons exported`);
