/** Complete-trajectory competition, independent of interval search and engines.
 * The callback owns simulation; subsequent attempts continue its absolute meter. */
import {createHash} from 'node:crypto';
import {normalizeCompilerTimeline} from './compiler_input.ts';
import {validateSpec} from '../core/substrate.ts';
import type {Spec, DriftReport} from '../types.ts';
import type {ArcMotionOptions} from './arc_motion.ts';

type Outcome = {
  track: unknown; rows: any[]; report: DriftReport; failure: unknown; trajectoryLoss?: number;
  lookaheadStats: unknown; planningDecisions: unknown;
  constructionFrames: number; samples: number; searchBudgetExhausted: boolean;
  stats: {sim_frames: number; viable_candidate_samples: number; gap_commits: number};
};

export function runArcAttempts<R extends Outcome>(spec: Spec, seed: number, options: ArcMotionOptions,
  compile: (spec: Spec, seed: number, options: ArcMotionOptions, continueMeter?: boolean) => R) {
  const results: R[] = [], names: Array<'proposal' | 'search'> = [];
  const run = (name: 'proposal' | 'search', opts: ArcMotionOptions) => {
    const result = compile(spec, seed, opts, results.length > 0);
    results.push(result); names.push(name); return result;
  };
  if (options.policyPreview && !options.replayControls && !options.directControls) {
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
      run('search', {...options, policyPreview: false, policyRollout: false, policyRolloutStrict: false,
        collectTrajectoryLoss: true, trajectoryControls: options.previewWarmStart
          ? preview.rows.map(r => ({control: r.control, incoming: r.incoming, span: r.span}))
          : options.trajectoryControls});
    }
  }
  if (!results.length) run('search', options);
  // A complete physical trajectory always wins over an invalid one. Preserve
  // the established search-wins-ties rule, including when both attempts fail.
  const selected = results.length === 2 && results[0].trajectoryLoss! < results[1].trajectoryLoss! ? 0 : results.length - 1;
  const records = results.map((r, index) => {
    const complete = r.report.terminus.reason === 'endOfSpec' && !r.report.off_beat_landings.length &&
      r.report.contacts.every(c => c.status === 'hit');
    const start = index ? results[index - 1].stats.sim_frames : 0;
    return {name: names[index], selected: index === selected, start, constructionEnd: r.constructionFrames,
      end: r.stats.sim_frames, complete, loss: r.trajectoryLoss, failure: r.failure,
      trackHash: createHash('sha256').update(JSON.stringify(r.track)).digest('hex'), gapCommits: r.stats.gap_commits,
      exhausted: r.searchBudgetExhausted, samples: r.samples, viableCandidates: r.stats.viable_candidate_samples,
      lookahead: r.lookaheadStats, planning: r.planningDecisions,
      commits: r.rows.map((row, index) => ({index, frame: row.frame, spent: row.spent}))};
  });
  return {results, selected, records, firstCompletionFrame: records.find(r => r.complete)?.end ?? null};
}
