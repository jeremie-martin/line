/** Telemetry for the compiler's single complete search attempt.
 * The record shape is kept stable for the V6 construction evidence and the
 * production gallery artifacts, which store it alongside each track. */
import {createHash} from 'node:crypto';
import type {DriftReport} from '../types.ts';
import type {ArcMotionOptions} from './arc_options.ts';

type Outcome = {
  track: unknown; rows: any[]; report: DriftReport; failure: unknown; trajectoryLoss?: number; selectionLoss?: number;
  impactEvaluation?: {valid: boolean};
  lookaheadStats: unknown; planningDecisions: unknown;
  constructionFrames: number; samples: number; searchBudgetExhausted: boolean;
  stats: {sim_frames: number; viable_candidate_samples: number; gap_commits: number};
  initialProposalWork: unknown; observedReceiverWork: unknown; coupledIntervalWork: unknown;
  transitionRevisionWork: unknown; constructionImprovement: unknown;
};

const complete = (r: Outcome) => r.impactEvaluation ? r.impactEvaluation.valid : r.report.terminus.reason === 'endOfSpec' &&
  !r.report.off_beat_landings.length && r.report.contacts.every(c => c.status === 'hit');

export function arcAttemptTelemetry(result: Outcome, options: ArcMotionOptions) {
  const requests = options.constructionRequests;
  const isComplete = complete(result) && (!requests || (!result.failure && result.rows.length === Object.keys(requests).length));
  const record = {
    name: 'search' as const, selected: true, start: 0, constructionEnd: result.constructionFrames,
    end: result.stats.sim_frames, complete: isComplete, loss: result.trajectoryLoss,
    selectionLoss: result.selectionLoss ?? result.trajectoryLoss ?? Infinity, failure: result.failure,
    trackHash: createHash('sha256').update(JSON.stringify(result.track)).digest('hex'), gapCommits: result.stats.gap_commits,
    exhausted: result.searchBudgetExhausted, samples: result.samples, viableCandidates: result.stats.viable_candidate_samples,
    lookahead: result.lookaheadStats, planning: result.planningDecisions,
    commits: result.rows.map((row, index) => ({index, frame: row.frame, spent: row.spent})),
  };
  const work = {
    name: record.name, initialProposalWork: result.initialProposalWork, observedReceiverWork: result.observedReceiverWork,
    coupledIntervalWork: result.coupledIntervalWork, transitionRevisionWork: result.transitionRevisionWork,
    constructionImprovement: result.constructionImprovement,
  };
  return {attempts: [record], attemptWork: [work]};
}
