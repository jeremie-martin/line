/** The compiler's public entry point: a music spec plus either seeded creative
 * preferences (automatic arrangement) or an explicit construction plan. */
import {FPS,type Spec} from '../types.ts';
import type {CompileCheckpoint} from './types.ts';
import type {CreativePreferences,ProductionPlan} from './repertoire_policy.ts';
import type {compileArcMotion} from './arc_motion.ts';
import {compileProductionRepertoire} from './production_repertoire.ts';
import type {ImpactAccountId} from './impact_accounts.ts';
import {CompileBudgetTelemetryRecorder,type BudgetTelemetryLevel} from './budget_telemetry.ts';
import {sliceTimeline} from '../core/substrate.ts';
import {normalizeCompilerTimeline,validateCompilerTelemetry} from './compiler_input.ts';
type CompileHandoffOptions={budget:number;budgetTelemetry?:BudgetTelemetryLevel};

export type ProductionCompileOptions=CompileHandoffOptions&{creative?:CreativePreferences;constructionPlan?:ProductionPlan;phraseBoundaries?:number[];impactContract?:ImpactAccountId};
export type ProductionCheckpoint=CompileCheckpoint&{construction?:ReturnType<typeof compileArcMotion>;repertoire?:ReturnType<typeof compileProductionRepertoire>};
export function compileHandoff(userSpec: Spec, seed = 0, opts: ProductionCompileOptions): ProductionCheckpoint {
  userSpec = normalizeCompilerTimeline(userSpec);
  validateCompilerTelemetry(opts.budgetTelemetry);
  {
    if(opts.creative===undefined&&opts.constructionPlan===undefined)throw new Error('compileHandoff requires creative preferences or an explicit construction plan');
    if(Object.keys(userSpec.axes).some(axis=>!['air','speed','amplitude'].includes(axis)))throw new Error('creative production supports air, speed and amplitude axes');
    if(opts.creative!==undefined&&opts.constructionPlan!==undefined)throw new Error('choose creative preferences or an explicit construction plan');
    if(opts.constructionPlan!==undefined&&opts.phraseBoundaries!==undefined)throw new Error('explicit plans already contain their phrase boundaries');
    if(Object.entries(opts).some(([key,value])=>value!==undefined&&!['budget','budgetTelemetry','creative','constructionPlan','phraseBoundaries','impactContract'].includes(key)))throw new Error('legacy search options cannot be combined with creative production');
    const repertoire=compileProductionRepertoire(userSpec,seed,{budget:opts.budget,creative:opts.creative,plan:opts.constructionPlan,phraseBoundaries:opts.phraseBoundaries,impactContract:opts.impactContract});
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
}
