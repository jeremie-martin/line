/** Ranking, arrival diversity and restoration of measured interval
 * candidates, shared by prefix expansion and interval commitment. */
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import type { ArcMotionOptions } from './arc_options.ts';
import type {ArcMotionControl} from './arc_geometry.ts';
import type {TrackLine, AxisValues} from '../types.ts';
import type {intervalMotionSummary} from './motion_objective.ts';
import {withGrain} from '../core/measure.ts';

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
  valueFeatures?: number[]; predictedFuture?: number;
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

/** Native candidate cost plus a weighted future estimate. The arrival priors
 * count half: what they charge for the next catch measured about twice its
 * real cost. The heading prior counts fully: it prices a cost two catches
 * ahead (extras in long floats) that the next interval alone does not show
 * (docs/research/compiler-ideas-20261101.md). "Half" applies to everything
 * measureObjective adds after `localCost` except the heading prior: the arrival
 * speed/angle/upright terms, and also the small backward-velocity
 * (accessibility) prior and, in repair, the reference-arrival distance. Only
 * this ranking is reweighted; candidate `cost` (local search, refinement)
 * keeps every prior at full weight. */
export function valueRank(options: ArcMotionOptions, c: Pick<MeasuredCandidate, 'localCost' | 'cost' | 'headingPrior' | 'predictedFuture'>) {
  const heading = c.headingPrior ?? 0, cost = c.localCost + heading + .5 * (c.cost - c.localCost - heading);
  return c.predictedFuture === undefined ? cost : cost + (options.valueWeight ?? .5) * c.predictedFuture;
}

/** Arrivals that differ in heading, speed, pose or release frame. */
export function distinctArrival(a: MeasuredCandidate, b: MeasuredCandidate) {
  return Math.abs(a.heading - b.heading) > 4 || Math.abs(a.endSpeed - b.endSpeed) > .4 ||
    Math.abs(a.pose - b.pose) > 7 || a.release !== undefined && b.release !== undefined && Math.abs(a.release - b.release) > 2;
}

/** Up to `width` best-ranked candidates whose arrivals are mutually distinct. */
export function distinctCandidates(options: ArcMotionOptions, candidates: readonly MeasuredCandidate[], width: number) {
  const result: MeasuredCandidate[] = [];
  for (const candidate of candidates.slice().sort((a, b) => valueRank(options, a) - valueRank(options, b))) {
    if (result.every(a => distinctArrival(a, candidate))) result.push(candidate);
    if (result.length >= width) break;
  }
  return result;
}

/** A selected continuation must carry its own measured residuals and motion,
 * not inherit those of the previously preferred local geometry. Engine
 * wrappers are rebuilt separately because search cleanup can free them. */
export function restoreCandidate(candidate: MeasuredCandidate, child: Engine): EvaluatedCandidate {
  return {candidate, child};
}
