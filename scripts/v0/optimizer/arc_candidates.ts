/** Ranking, arrival diversity and restoration of measured interval
 * candidates, shared by prefix expansion and interval commitment. */
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import type { ArcMotionOptions } from './arc_options.ts';
import type {ArcMotionControl} from './arc_geometry.ts';
import type {TrackLine, AxisValues} from '../types.ts';
import type {intervalMotionSummary} from './motion_objective.ts';
import {withGrain} from '../core/measure.ts';
import {arcFutureValue} from './arc_value.ts';

/** Geometry is immutable once it identifies a measured physical prefix. */
export type CandidateGeometry = readonly Readonly<TrackLine>[];
export type Near = {c: ArcMotionControl; deficit: number};
type Motion = ReturnType<typeof intervalMotionSummary>;

/** One owned record for evaluation, ranking and memoization. The list and memo
 * share these facts; only a live evaluation carries an engine. */
export type MeasuredCandidate = Readonly<{
  child?: never;
  lines: CandidateGeometry; c: ArcMotionControl;
  cost: number; localCost: number; residuals: number[]; localResidualCount: number;
  trajectoryAxes: AxisValues; actualImpact?: number; terminalLoss?: number; release?: number;
  railGuides?: number[]; motion?: Motion; motionCost: number;
  contactPositions?: Float64Array;
  headingPrior?: number; heading: number; endSpeed: number; pose: number;
  valueFeatures?: number[];
}>;
export type EvaluatedCandidate = Readonly<{candidate: MeasuredCandidate; child: Engine}>;
export type CandidateMemo =
  | {reason: string; near?: Near}
  | MeasuredCandidate;

/** Grain depends only on geometry and never enters search. Measure it when
 * a selected candidate becomes a report row, preserving all reported axes. */
export function reportedAxes(candidate: MeasuredCandidate): AxisValues {
  return withGrain(candidate.trajectoryAxes, candidate.lines);
}

/** Native candidate cost plus half of what is predicted for the future.
 * The prediction is the heading prior (which prices extras two catches ahead
 * in long floats), the other arrival priors at half their candidate weight
 * (what they charge for the next catch measured about twice its real cost),
 * and the weighted learned estimate. Within a catch, that whole prediction
 * varied about 2.5 times more than the next interval measured, so ranking
 * counts it at half (REWORK.md, November 7: AA; V7.1 +6.2, held out +2.9).
 * "Other priors" is everything measureObjective adds after `localCost`
 * except the heading prior: the arrival speed/angle/upright terms, the small
 * backward-velocity (accessibility) prior and, in repair, the
 * reference-arrival distance. Only this ranking is reweighted; candidate
 * `cost` (local search, refinement) keeps every prior at full weight. */
type Ranked = Pick<MeasuredCandidate, 'localCost' | 'cost' | 'headingPrior' | 'valueFeatures'>;
const FUTURE = .5;
const baseRank = (c: Ranked) => {
  const heading = c.headingPrior ?? 0;
  return c.localCost + FUTURE * (heading + .5 * (c.cost - c.localCost - heading));
};
export function valueRank(options: ArcMotionOptions, c: Ranked) {
  return c.valueFeatures ? baseRank(c) + FUTURE * (options.valueWeight ?? .5) * arcFutureValue(c.valueFeatures, options.futureValueModel) : baseRank(c);
}

/** Arrivals that differ in heading, speed, pose or release frame. */
export function distinctArrival(a: MeasuredCandidate, b: MeasuredCandidate) {
  return Math.abs(a.heading - b.heading) > 4 || Math.abs(a.endSpeed - b.endSpeed) > .4 ||
    Math.abs(a.pose - b.pose) > 7 || a.release !== undefined && b.release !== undefined && Math.abs(a.release - b.release) > 2;
}

/** Up to `width` best-ranked candidates whose arrivals are mutually distinct.
 * A prediction is never negative, so `baseRank` bounds each rank from below: only
 * candidates that could still come next are ranked. Ties keep their original order. */
export function distinctCandidates(options: ArcMotionOptions, candidates: readonly MeasuredCandidate[], width: number) {
  const unranked = candidates.map((candidate, index) => ({candidate, index, bound: baseRank(candidate)})).sort((a, b) => a.bound - b.bound || a.index - b.index);
  const ranked: Array<{candidate: MeasuredCandidate; index: number; rank: number}> = [], result: MeasuredCandidate[] = [];
  const before = (a: {rank: number; index: number}, b: {rank: number; index: number}) => a.rank - b.rank || a.index - b.index;
  let next = 0;
  while (result.length < width && (ranked.length || next < unranked.length)) {
    // The best ranked so far is final once every unranked candidate is bound above it.
    while (next < unranked.length && (!ranked.length || unranked[next].bound <= ranked[0].rank)) {
      const {candidate, index} = unranked[next++], item = {candidate, index, rank: valueRank(options, candidate)};
      const place = ranked.findIndex(other => before(item, other) < 0);
      ranked.splice(place < 0 ? ranked.length : place, 0, item);
    }
    const {candidate} = ranked.shift()!;
    if (result.every(a => distinctArrival(a, candidate))) result.push(candidate);
  }
  return result;
}
