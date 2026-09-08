/** Public integration of measured, connected normal-line arc construction. */
import { createHash } from "node:crypto";
import { compileArcMotion, type ArcMotionOptions } from "./arc_motion.ts";
import futureValueModel from "./arc_value_model.json" with { type: "json" };
import { resetPerCompileState } from "../core/compile_lifecycle.ts";
import { sliceTimeline } from "../core/substrate.ts";
import { CompileBudgetTelemetryRecorder, type BudgetTelemetryLevel } from "./budget_telemetry.ts";
import type { CompileCheckpoint, Spec } from "./types.ts";
import { normalizeCompilerTimeline, validateCompilerTelemetry } from "./compiler_input.ts";

/** Production allocation from ride length and frame budget. Research can spread
 * this configuration and override a mechanism without duplicating shipped defaults. */
export function connectedArcOptions(spec: Pick<Spec, "duration">, budget: number): ArcMotionOptions {
  const duration = Math.round(spec.duration * 40), end = duration + 20;
  // Reserve construction capacity for revisiting difficult approaches. This
  // scales with actual ride length and budget, without benchmark-tier gates.
  // Give the base curve search its initial breadth before adding independent
  // guide variables. The allocation depends on available work per ride frame,
  // including the two cold replays, rather than named benchmark budgets.
  const allowance = .7 * (budget - 2 * (end + 1)) / Math.max(1, end);
  const refinement = Math.max(0, allowance - 80);
  const samples = Math.max(12, Math.min(160, Math.floor(Math.min(80, allowance) + .8 * refinement)));
  const guidanceSamples = Math.min(96, Math.floor(.8 * refinement));
  const responseSamples = Math.floor(guidanceSamples * 70 / 96);
  const lookaheadSamples = Math.max(8, Math.round(samples * .2));
  return { budget, samples,
    channel: 12, radius: 24, bidirectional: true, impactWeight: 1,
    amplitudeWeight: 1 / 3, arrivalMode: "speed", arrivalWeight: .3,
    headingWeight: .3, qualityRetries: 2, guidance: guidanceSamples ? "clearance" : undefined, guidanceSamples,
    lookaheadWidth: guidanceSamples ? 3 : 0, lookaheadSamples, lookaheadObjective: "terminal",
    reserveFactor: .7, reuseContinuations: true, pruneGuidance: true,
    guidanceJoint: true, expressive: true, responseSamples,
    adaptivePlanning: true, strictHorizon: true, cachePrefixReads: true, memoCandidates: true, reuseEvaluations: true,
    futureValueModel: guidanceSamples ? futureValueModel : undefined,
    // Rank unprobed arrivals with the model, then use its value at the
    // simulated continuation boundary. Do not blend it into the root twice.
    valueSelection: false, valueWeight: .25 * guidanceSamples / 96,
    continuationValueWeight: .5 * guidanceSamples / 96 };
}

export function compileConnectedArcs(spec: Spec, seed: number,
  options: { budget: number; budgetTelemetry?: BudgetTelemetryLevel }): CompileCheckpoint {
  spec = normalizeCompilerTimeline(spec);
  validateCompilerTelemetry(options.budgetTelemetry);
  resetPerCompileState();
  const searchOptions = connectedArcOptions(spec, options.budget);
  const duration = Math.round(spec.duration * 40);
  const samples = searchOptions.samples!;
  const result = compileArcMotion(spec, seed, searchOptions);
  const { track, report } = result, total = result.stats.sim_frames;
  const gaps = sliceTimeline(spec.contacts.map(c => Math.round(c.t * 40)), duration);
  const valid = report.contacts.every(c => c.status === "hit") &&
    !report.off_beat_landings.length && report.terminus.reason === "endOfSpec";
  const exhausted = result.searchBudgetExhausted || result.failure?.reason === "budget";
  const recorder = new CompileBudgetTelemetryRecorder({ level: options.budgetTelemetry ?? "summary",
    gaps, durationFrames: duration, hardBudgetFrames: options.budget, policyBudgetFrames: options.budget,
    model: { name: "connected-arcs/v3", source: "arc_motion.ts expressive curves, measured planning and learned arrival value",
      interceptFrames: 0, contactFrames: 0, durationFrameScale: samples } });
  const episode = recorder.startEpisode({ lane: "initial", searchSeed: seed, frontierHasFallbackLane: false,
    anchorGapIndex: 0, startTotalSpentFrames: 0, ceilingTotalSpentFrames: options.budget, includeStartup: false });
  recorder.setActiveCandidateWork({ actualCandidateSamples: result.samples, viableCandidates: result.stats.viable_candidate_samples,
    candidateSamplesByStream: { normal: result.samples } });
  for (const [index, row] of result.rows.entries()) {
    // Interval zero is startup; committing interval i reaches authored contact i.
    // Use that identity, since scheduling can shift its frame by one in either direction.
    recorder.observeActiveEpisode(Math.min(index, gaps.length), row.spent);
  }
  recorder.recordEvaluation({ totalSpentFrames: total, gapIndex: valid ? gaps.length : result.stats.gap_commits,
    terminal: valid, origin: "frontier", firstTimeSearchNode: true,
    terminalTrackKey: createHash("sha256").update(JSON.stringify(track)).digest("hex"), registerImproved: valid });
  recorder.endEpisode(total, exhausted ? "budget_capture" : "compile_finished");
  recorder.recordSegment("initial_search", 0, result.constructionFrames, "construction_complete", episode);
  recorder.recordSegment("finalization", result.constructionFrames, total, "cold_replay_complete", episode);
  const costs = report.gaps.map(g => Object.values(g.axes).reduce((s, a) => s + (a?.error ?? 0) ** 2, 0));
  return { budget: options.budget, track, report,
    budgetTelemetry: recorder.snapshot(total, exhausted, valid ? total : null, valid ? total : null),
    stats: { actual_candidate_samples: result.samples, viable_candidate_samples: result.stats.viable_candidate_samples, engine_rebuilds: result.backtracks + 2,
      gap_commits: result.stats.gap_commits, gap_backtracks: result.backtracks,
      validation_retries: 0, polish_iterations: 0, total_committed_cost: costs.reduce((s, c) => s + c, 0),
      committed_costs_per_gap: costs, sim_frames: total, ballistic_micro_sim_frames: 0,
      budget_exhausted: exhausted, first_completion_frame: valid ? total : null } };
}
