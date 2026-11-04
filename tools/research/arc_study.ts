/** Owned counterfactual search. No compiler state is rolled back or refunded
 * piecemeal, and no live compiler engine is observed or detached. */
import {getRiderMetered, setPhysicsFrameLimit, withPhysicsFrameProbe} from '../../scripts/lib/detector.ts';
import {withEngineScope, type LineRiderEngine} from '../../scripts/lib/native_motion/engine.ts';
import type {ArcCompileContext} from '../../scripts/v0/optimizer/arc_compile_context.ts';
import type {CandidateGeometry} from '../../scripts/v0/optimizer/arc_candidates.ts';

/** Rebuild a cold prefix and prepare it through the next search's entry frame.
 * Preparation is outside the probe budget. Search starts with the caller's
 * remaining budget, restored on every exit. Return owned data, never engines. */
export function withArcStudy<T>(source: ArcCompileContext, geometry: CandidateGeometry, index: number,
  run: (context: ArcCompileContext, engine: LineRiderEngine) => T & (T extends PromiseLike<unknown> ? never : unknown)): T {
  return withEngineScope(() => withPhysicsFrameProbe(() => {
    const context = source.forkForStudy(), engine = context.lineage.rebuild(geometry);
    withPhysicsFrameProbe(() => {
      setPhysicsFrameLimit(null);
      getRiderMetered(engine, Math.max(0, context.contacts[index].frame - 1));
    });
    return run(context, engine);
  }));
}
