/** Measured construction search over connected curves and contact fragments.
 * Entry, turn, release and continuation are corrected by native physics;
 * the seeded arrangement determines which constructions must be realized. */
import { withEngineScope } from '../../lib/native_motion/engine.ts';
import { resetFrameCount, setPhysicsFrameLimit, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import { validateSpec } from '../core/substrate.ts';
export { motionArc, type ArcMotionControl } from './arc_geometry.ts';
import { normalizeCompilerTimeline } from './compiler_input.ts';
import { validateArcOptions, validateSectionStyles, type ArcMotionOptions } from './arc_options.ts';
import { createArcCompileContext } from './arc_compile_context.ts';
import { startSequence, runIntervalSequence } from './arc_sequence.ts';
import { refineCommittedTrack } from './arc_complete_refinement.ts';
import { finalizeArcTrack, disposeJudge } from './arc_finalize.ts';
import { arcAttemptTelemetry } from './arc_attempts.ts';
import type { Spec } from '../types.ts';
export type { ArcMotionOptions, SectionStyle, IntervalOverrides, IntervalOptions } from './arc_options.ts';

/** Compiles `spec` into connected arc geometry within `options.budget`
 * physics frames. The result carries the track, its report, the committed
 * rows and the search telemetry. */
export function compileArcMotion(spec: Spec, seed: number, options: ArcMotionOptions) {
  const result = withEngineScope(() => compileArcMotionOnce(spec, seed, options));
  return {...result, ...arcAttemptTelemetry(result, options), budget: options.budget};
}

/** One complete search: validate, construct interval by interval, refine
 * the complete track when configured, then replay and measure it. Two cold
 * replays are reserved out of the allowance for the final stage. */
function compileArcMotionOnce(spec: Spec, seed: number, options: ArcMotionOptions) {
  validateArcOptions(seed, options);
  spec = normalizeCompilerTimeline(spec);
  validateSpec(spec);
  resetFrameCount();
  const budget = options.budget, duration = Math.round(spec.duration * 40), end = duration + 20;
  if (duration < 1) throw new Error('arc duration must cover at least one frame');
  if (budget <= 2 * (end + 1)) throw new Error('arc budget must cover two complete replays and construction work');
  try {
    const ctx = createArcCompileContext(spec, seed, options);
    const seq = startSequence(ctx);
    setPhysicsFrameLimit(budget - 2 * (end + 1));
    validateSectionStyles(options, ctx.contacts.length);
    try {
      runIntervalSequence(ctx, seq);
      if (!seq.failure && (options.refineAttempts ?? 0) > 0 && seq.rows.length === ctx.contacts.length) refineCommittedTrack(ctx, seq);
    } catch (error) {
      if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
      ctx.work.searchBudgetExhausted = true;
      seq.failure = {reason: 'budget'};
    }
    return finalizeArcTrack(ctx, seq);
  } finally {
    disposeJudge();
    setPhysicsFrameLimit(null);
  }
}
