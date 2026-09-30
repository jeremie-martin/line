/** Public compiler routing and compatibility APIs.
 * Ordinary supported WASM requests use coherent normal arcs. The legacy prefix
 * search remains available for other axes, reference engines and diagnostic
 * options. Existing requests retain exactly the same routing conditions.
 */
import { FPS, type Spec } from "../types.ts";
import type { CompileCheckpoint } from "./types.ts";
import type {CreativePreferences,ProductionPlan} from './repertoire_policy.ts';
import type {compileArcMotion} from './arc_motion.ts';
import type {compileProductionRepertoire} from './production_repertoire.ts';
import {CompileBudgetTelemetryRecorder} from './budget_telemetry.ts';
import {sliceTimeline} from '../core/substrate.ts';
// Reference-engine checkouts need no WASM artifacts or arc models. Load the arc
// graph only for the engine selection that can dispatch to it (as in _lr_engine).
const arcBackend = (process.env.LR_ENGINE ?? "wasm") === "wasm"
  ? await import("./connected_arcs.ts") : undefined;
const repertoireBackend = (process.env.LR_ENGINE ?? "wasm") === "wasm"
  ? await import('./production_repertoire.ts') : undefined;
import { normalizeCompilerTimeline, validateCompilerTelemetry } from "./compiler_input.ts";
import { compileLegacyHandoff, compileHandoffFromSnapshot,
  type CompileHandoffOptions, type HandoffNodeSnapshot } from "./legacy_handoff.ts";

// Preserve diagnostic and snapshot imports used by existing studies. New studies
// of the old search should import legacy_handoff.ts explicitly.
export * from "./legacy_handoff.ts";

export function handoffBackend(userSpec: Spec, opts: CompileHandoffOptions): "arcs" | "legacy" {
  return (process.env.LR_ENGINE ?? "wasm") === "wasm" &&
    Object.entries(opts).every(([key, value]) => value === undefined || key === "budget" || key === "budgetTelemetry") &&
    Object.keys(userSpec.axes).every(axis => ["air", "speed", "amplitude"].includes(axis)) &&
    userSpec.contacts.length > 0 && userSpec.contacts.every(c => Math.round(c.t * FPS) >= 6) &&
    opts.budget > 4 * (Math.round(userSpec.duration * FPS) + 20) ? "arcs" : "legacy";
}

export type ProductionCompileOptions=CompileHandoffOptions&{creative?:CreativePreferences;constructionPlan?:ProductionPlan;phraseBoundaries?:number[]};
export type ProductionCheckpoint=CompileCheckpoint&{construction?:ReturnType<typeof compileArcMotion>;repertoire?:ReturnType<typeof compileProductionRepertoire>};
export function compileHandoff(userSpec: Spec, seed = 0, opts: ProductionCompileOptions): ProductionCheckpoint {
  userSpec = normalizeCompilerTimeline(userSpec);
  validateCompilerTelemetry(opts.budgetTelemetry);
  if(opts.creative!==undefined||opts.constructionPlan!==undefined){
    if(!repertoireBackend)throw new Error('creative production currently requires the WASM engine');
    if(Object.entries(opts).some(([key,value])=>value!==undefined&&!['budget','budgetTelemetry','creative','constructionPlan','phraseBoundaries'].includes(key)))throw new Error('legacy search options cannot be combined with creative production');
    const repertoire=repertoireBackend.compileProductionRepertoire(userSpec,seed,{budget:opts.budget,creative:opts.creative,plan:opts.constructionPlan,phraseBoundaries:opts.phraseBoundaries});
    const {result,physicalFrames,searchTotals}=repertoire,duration=Math.round(userSpec.duration*FPS);
    const recorder=new CompileBudgetTelemetryRecorder({level:opts.budgetTelemetry??'summary',
      gaps:sliceTimeline(userSpec.contacts.map(c=>Math.round(c.t*FPS)),duration),durationFrames:duration,
      hardBudgetFrames:opts.budget,policyBudgetFrames:opts.budget,
      model:{name:'production-repertoire/v1',source:'production_repertoire.ts',interceptFrames:0,contactFrames:0,durationFrameScale:0}});
    const episode=recorder.startEpisode({lane:'initial',searchSeed:seed,frontierHasFallbackLane:false,anchorGapIndex:0,
      startTotalSpentFrames:0,ceilingTotalSpentFrames:opts.budget,includeStartup:false});
    recorder.setActiveCandidateWork({actualCandidateSamples:searchTotals.samples,viableCandidates:searchTotals.viable,candidateSamplesByStream:{normal:searchTotals.samples}});
    recorder.recordEvaluation({totalSpentFrames:physicalFrames,gapIndex:result.stats.gap_commits,terminal:repertoire.valid,
      origin:'frontier',firstTimeSearchNode:true,terminalTrackKey:'repertoire-final',registerImproved:repertoire.valid});
    recorder.endEpisode(physicalFrames,result.searchBudgetExhausted?'budget_capture':'compile_finished');
    let spent=0;for(const stage of repertoire.work){recorder.recordSegment(stage.stage==='realization-replay'?'finalization':spent?'resumed_search':'initial_search',spent,spent+stage.physicalFrames,stage.stage);spent+=stage.physicalFrames;}
    const costs=result.report.gaps.map(g=>Object.values(g.axes).reduce((n,a)=>n+(a?.error??0)**2,0));
    return {budget:opts.budget,track:result.track,report:result.report,repertoire,
      budgetTelemetry:recorder.snapshot(physicalFrames,result.searchBudgetExhausted,repertoire.valid?physicalFrames:null,repertoire.valid?physicalFrames:null),
      stats:{actual_candidate_samples:searchTotals.samples,viable_candidate_samples:searchTotals.viable,
        engine_rebuilds:searchTotals.rebuilds,gap_commits:result.stats.gap_commits,gap_backtracks:searchTotals.backtracks,
        validation_retries:0,polish_iterations:0,total_committed_cost:costs.reduce((n,c)=>n+c,0),committed_costs_per_gap:costs,sim_frames:physicalFrames,
        ballistic_micro_sim_frames:0,budget_exhausted:result.searchBudgetExhausted,first_completion_frame:repertoire.valid?physicalFrames:null}};
  }
  return handoffBackend(userSpec, opts) === "arcs"
    ? arcBackend!.compileConnectedArcs(userSpec, seed, opts)
    : compileLegacyHandoff(userSpec, seed, opts);
}

/** Build a budget->checkpoint curve as N INDEPENDENT full runs from scratch (no
 *  anytime sharing) — the single place that defines "a curve is one compile per
 *  budget, merging the shared opts". `runOne` is the per-budget compile call. */
function budgetCurve(
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget">,
  runOne: (o: CompileHandoffOptions) => CompileCheckpoint,
): CompileCheckpoint[] {
  return budgets.map((budget) => runOne({ ...opts, budget }));
}

/** Diagnostic helper: a budget->checkpoint curve as N independent `compileHandoff` runs. */
export function compileBudgetCurve(
  userSpec: Spec,
  seed: number,
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget"> = {},
): CompileCheckpoint[] {
  return budgetCurve(budgets, opts, (o) => compileHandoff(userSpec, seed, o));
}

/** Snapshot-resumed variant of `compileBudgetCurve` (N independent suffix runs). */
export function compileBudgetCurveFromSnapshot(
  userSpec: Spec,
  seed: number,
  snapshot: HandoffNodeSnapshot,
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget"> = {},
): CompileCheckpoint[] {
  return budgetCurve(budgets, opts, (o) => compileHandoffFromSnapshot(userSpec, seed, snapshot, o));
}

/** Find the checkpoint for `budget` in a `compileBudgetCurve*` result; throws if
 *  absent. Shared by the diagnostic oracle/probe scripts. */
export function checkpointAt(curve: CompileCheckpoint[], budget: number): CompileCheckpoint {
  const found = curve.find((c) => c.budget === budget);
  if (found === undefined) throw new Error(`missing checkpoint for budget ${budget}`);
  return found;
}
