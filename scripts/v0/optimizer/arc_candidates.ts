/** Ranking, arrival diversity and restoration of measured interval
 * candidates, shared by lookahead planning and interval commitment. */
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import type { ArcMotionOptions } from './arc_options.ts';

/** Candidate cost with its learned future value blended in by `valueWeight`. */
export function valueRank(options: ArcMotionOptions, c: any) {
  return c.predictedFuture === undefined ? c.cost : c.cost + (options.valueWeight ?? .5) * (c.localCost + c.predictedFuture - c.cost);
}

/** Arrivals that differ in heading, speed, pose or release frame. */
export function distinctArrival(a: any, b: any) {
  return Math.abs(a.heading - b.heading) > 4 || Math.abs(a.endSpeed - b.endSpeed) > .4 ||
    Math.abs(a.pose - b.pose) > 7 || Math.abs(a.meta.release - b.meta.release) > 2;
}

/** Up to `width` best-ranked candidates whose arrivals are mutually distinct. */
export function distinctCandidates(options: ArcMotionOptions, candidates: any[], width: number) {
  const result: any[] = [];
  for (const candidate of candidates.slice().sort((a, b) => valueRank(options, a) - valueRank(options, b))) {
    if (result.every(a => distinctArrival(a, candidate))) result.push(candidate);
    if (result.length >= width) break;
  }
  return result;
}

/** A selected continuation must carry its own measured residuals and motion,
 * not inherit those of the previously preferred local geometry. Engine
 * wrappers are rebuilt separately because search cleanup can free them. */
export function restoreCandidate(candidate: any, child: Engine) {
  return {...candidate.measurement, child, lines: candidate.lines, c: candidate.c, cost: candidate.cost, localCost: candidate.localCost};
}
