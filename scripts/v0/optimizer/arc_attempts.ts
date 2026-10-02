/** Complete-trajectory competition, independent of interval search and engines.
 * The callback owns simulation; subsequent attempts continue its absolute meter. */
import {createHash} from 'node:crypto';
import {normalizeCompilerTimeline} from './compiler_input.ts';
import {validateSpec} from '../core/substrate.ts';
import type {Spec, DriftReport} from '../types.ts';
import type {ArcMotionOptions} from './arc_motion.ts';
import {arcConstructionMemoryKey} from './arc_memory.ts';
import {constructionStyle} from './repertoire_policy.ts';

type Outcome = {
  track: unknown; rows: any[]; report: DriftReport; failure: unknown; trajectoryLoss?: number; selectionLoss?:number;
  impactEvaluation?:{valid:boolean};
  lookaheadStats: unknown; planningDecisions: unknown;
  constructionFrames: number; samples: number; searchBudgetExhausted: boolean;
  stats: {sim_frames: number; viable_candidate_samples: number; gap_commits: number};
};

const complete = (r: Outcome) => r.impactEvaluation ? r.impactEvaluation.valid : r.report.terminus.reason === 'endOfSpec' &&
  !r.report.off_beat_landings.length && r.report.contacts.every(c => c.status === 'hit');

export function runArcAttempts<R extends Outcome>(spec: Spec, seed: number, options: ArcMotionOptions,
  compile: (spec: Spec, seed: number, options: ArcMotionOptions, continueMeter?: boolean) => R) {
  const isComplete=(r:Outcome)=>complete(r)&&(!options.constructionRequests||(!r.failure&&r.rows.length===Object.keys(options.constructionRequests).length));
  const loss=(r:Outcome)=>r.selectionLoss??r.trajectoryLoss??Infinity;
  const results: R[] = [], names: Array<'proposal' | 'completion' | 'search'> = [];
  let proposalDecision: {reason: 'accepted' | 'invalid' | 'above-error-limit' | 'forced-search'; rmsError: number | null; errorLimit: number} | null = null;
  const run = (name: 'proposal' | 'completion' | 'search', opts: ArcMotionOptions) => {
    const result = compile(spec, seed, opts, results.length > 0);
    results.push(result); names.push(name); return result;
  };
  if(options.completionFirstFraction!==undefined){
    const fraction=options.completionFirstFraction;
    if(!Number.isFinite(fraction)||fraction<=0||fraction>=1||options.fork||options.directControls||options.replayControls||options.constructionBudget!==undefined)
      throw new Error('invalid completion-first allocation');
    const end=Math.round(spec.duration*40)+20,allowance=Math.floor(options.budget*fraction);
    if(allowance>4*(end+1)&&options.budget-allowance>4*(end+1)){
      const first=run('completion',{...options,budget:allowance,policyPreview:false,completionFirstFraction:undefined,collectTrajectoryLoss:true});
      const examples={...options.constructionExamples};
      for(const [i,row]of first.rows.entries()){
        const request=options.constructionRequests?.[i];
        const style={...options,...(options.sectionStyles?.[i]??(request?constructionStyle(request):{}))};
        const key=arcConstructionMemoryKey(style);
        examples[key]=[...(examples[key]??[]),{control:row.control,incoming:row.incoming,span:row.span,features:row.features}];
      }
      run('search',{...options,policyPreview:false,completionFirstFraction:undefined,collectTrajectoryLoss:true,
        constructionExamples:examples,warmReferences:first.rows.map(r=>({control:r.control,incoming:r.incoming,span:r.span}))});
    }
  }
  if (!results.length && options.policyPreview && !options.replayControls && !options.directControls && !options.fork) {
    if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(options.budget) || options.budget <= 0)
      throw new Error('invalid arc compiler input');
    spec = normalizeCompilerTimeline(spec); validateSpec(spec);
    const model = typeof options.controlPolicy === 'function' ? options.controlPolicy() : options.controlPolicy;
    options = {...options, controlPolicy: model};
    const end = Math.round(spec.duration * 40) + 20, allowance = Math.floor(options.budget * .05);
    if (model?.rolloutPolicy && allowance > 4 * (end + 1) && options.constructionBudget === undefined) {
      const preview = run('proposal', {...options, budget: allowance, controlPolicy: model.rolloutPolicy,
        policyPreview: false, policyRollout: true, policyRolloutStrict: true,
        lookaheadWidth: 0, qualityRetries: 0, refineAttempts: 0, collectTrajectoryLoss: true});
      const errorLimit = options.previewMaxRmsError ?? .025;
      if (!(errorLimit >= 0)) throw new Error('invalid preview error limit');
      const rmsError = Number.isFinite(preview.trajectoryLoss) ? Math.sqrt(preview.trajectoryLoss!) : null;
      const reason = options.searchAfterPreview === 'always' ? 'forced-search' : !isComplete(preview) ? 'invalid' :
        rmsError === null || rmsError > errorLimit ? 'above-error-limit' : 'accepted';
      proposalDecision = {reason, rmsError, errorLimit};
      if (reason !== 'accepted')
        run('search', {...options, policyPreview: false, policyRollout: false, policyRolloutStrict: false,
        collectTrajectoryLoss: true, controlExamples: [
          ...(options.controlExamples ?? []),
          ...(options.previewMemory ? preview.rows.map(r => ({control: r.control, incoming: r.incoming, span: r.span, features: r.features})) : [])]});
    }
  }
  if (!results.length) run('search', options);
  // A complete physical trajectory always wins over an invalid one. Preserve
  // the established search-wins-ties rule, including when both attempts fail.
  const selected = results.length === 2 && (isComplete(results[0]) !== isComplete(results[1])
    ? isComplete(results[0]) : loss(results[0]) < loss(results[1])) ? 0 : results.length - 1;
  const records = results.map((r, index) => {
    const start = index ? results[index - 1].stats.sim_frames : 0;
    return {name: names[index], selected: index === selected, start, constructionEnd: r.constructionFrames,
      end: r.stats.sim_frames, complete: isComplete(r), loss: r.trajectoryLoss, selectionLoss:loss(r), failure: r.failure,
      trackHash: createHash('sha256').update(JSON.stringify(r.track)).digest('hex'), gapCommits: r.stats.gap_commits,
      exhausted: r.searchBudgetExhausted, samples: r.samples, viableCandidates: r.stats.viable_candidate_samples,
      lookahead: r.lookaheadStats, planning: r.planningDecisions,
      commits: r.rows.map((row, index) => ({index, frame: row.frame, spent: row.spent}))};
  });
  return {results, selected, records, proposalDecision, firstCompletionFrame: records.find(r => r.complete)?.end ?? null};
}
