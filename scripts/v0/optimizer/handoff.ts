/** The compiler's public entry point: a music spec plus either seeded creative
 * preferences (automatic arrangement) or an explicit construction plan. */
import type {Spec} from '../types.ts';
import type {CompileCheckpoint} from './types.ts';
import type {CreativePreferences, ProductionPlan} from './repertoire_policy.ts';
import {compileProductionRepertoire} from './production_repertoire.ts';
import {normalizeCompilerTimeline} from './compiler_input.ts';
import {wasm} from '../../lib/native_motion/wasm.ts';
import {probedNativeFrames} from '../../lib/detector.ts';

export type ProductionCompileOptions = {
  budget: number;
  creative?: CreativePreferences;
  constructionPlan?: ProductionPlan;
  phraseBoundaries?: number[];
};
export type ProductionCheckpoint = CompileCheckpoint & {repertoire: ReturnType<typeof compileProductionRepertoire>};
const OPTIONS = ['budget', 'creative', 'constructionPlan', 'phraseBoundaries'];

export function compileHandoff(userSpec: Spec, seed = 0, opts: ProductionCompileOptions): ProductionCheckpoint {
  const spec = normalizeCompilerTimeline(userSpec);
  if (opts.creative === undefined && opts.constructionPlan === undefined)
    throw new Error('compileHandoff requires creative preferences or an explicit construction plan');
  if (opts.creative !== undefined && opts.constructionPlan !== undefined) throw new Error('choose creative preferences or an explicit construction plan');
  if (opts.constructionPlan !== undefined && opts.phraseBoundaries !== undefined) throw new Error('explicit plans already contain their phrase boundaries');
  if (Object.keys(spec.axes).some(axis => !['air', 'speed', 'amplitude'].includes(axis))) throw new Error('the compiler supports air, speed and amplitude axes');
  const unknown = Object.entries(opts).filter(([key, value]) => value !== undefined && !OPTIONS.includes(key)).map(([key]) => key);
  if (unknown.length) throw new Error(`unknown compile options: ${unknown.join(', ')}`);
  const simulated = wasm.simulated_frames(), probed = probedNativeFrames();
  const repertoire = compileProductionRepertoire(spec, seed, {budget: opts.budget, creative: opts.creative, plan: opts.constructionPlan,
    phraseBoundaries: opts.phraseBoundaries});
  const {result, physicalFrames, searchTotals, judgeFrames} = repertoire;
  // Every frame the compiler simulates must be charged. The judge's replays are charged
  // too, but simulated outside this engine. A budget refusal may charge frames it never
  // simulates, so only an excess is an error. Research probes (withPhysicsFrameProbe) are not compile work.
  const uncharged = wasm.simulated_frames() - simulated - (probedNativeFrames() - probed) - (physicalFrames - judgeFrames);
  if (uncharged > 0) throw new Error(`the compiler simulated ${uncharged} frames it did not charge`);
  const costs = result.report.gaps.map(g => Object.values(g.axes).reduce((n, a) => n + (a?.error ?? 0) ** 2, 0));
  return {
    budget: opts.budget, track: result.track, report: result.report, repertoire,
    work: {schema: 'line.compile-work.v1', allowance: opts.budget, physicalFrames, exhausted: result.searchBudgetExhausted, stages: repertoire.work},
    stats: {actual_candidate_samples: searchTotals.samples, viable_candidate_samples: searchTotals.viable, engine_rebuilds: searchTotals.rebuilds,
      gap_commits: result.stats.gap_commits, gap_backtracks: searchTotals.backtracks, total_committed_cost: costs.reduce((n, c) => n + c, 0),
      committed_costs_per_gap: costs, sim_frames: physicalFrames, budget_exhausted: result.searchBudgetExhausted},
  };
}
