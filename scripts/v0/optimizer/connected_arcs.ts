/** Public integration of measured, connected normal-line arc construction. */
import { createHash } from "node:crypto";
import { compileArcMotion } from "./arc_motion.ts";
import { resetPerCompileState } from "../core/compile_lifecycle.ts";
import { sliceTimeline } from "../core/substrate.ts";
import { CompileBudgetTelemetryRecorder, type BudgetTelemetryLevel } from "./budget_telemetry.ts";
import type { CompileCheckpoint, Spec } from "./types.ts";

export function compileConnectedArcs(spec: Spec, seed: number,
  options: { budget: number; budgetTelemetry?: BudgetTelemetryLevel }): CompileCheckpoint {
  resetPerCompileState();
  const duration = Math.round(spec.duration * 40), end = duration + 20;
  // Reserve construction capacity for revisiting difficult approaches. This
  // scales with actual ride length and budget, without benchmark-tier gates.
  const samples = Math.max(12, Math.min(160, Math.floor(.6 * (options.budget - 2 * (end + 1)) / Math.max(1, end))));
  const result = compileArcMotion(spec, seed, { budget: options.budget, samples,
    channel: 12, radius: 24, bidirectional: true, impactWeight: 1,
    amplitudeWeight: 1 / 3, arrivalMode: "speed", arrivalWeight: .3,
    headingWeight: .3, qualityRetries: 2 });
  const { track, report } = result, total = result.stats.sim_frames;
  const gaps = sliceTimeline(spec.contacts.map(c => Math.round(c.t * 40)), duration);
  const valid = report.contacts.every(c => c.status === "hit") &&
    !report.off_beat_landings.length && report.terminus.reason === "endOfSpec";
  const exhausted = result.failure?.reason === "budget";
  const recorder = new CompileBudgetTelemetryRecorder({ level: options.budgetTelemetry ?? "summary",
    gaps, durationFrames: duration, hardBudgetFrames: options.budget, policyBudgetFrames: options.budget,
    model: { name: "connected-arcs/v1", source: "arc_motion.ts measured full-interval proposals",
      interceptFrames: 0, contactFrames: 0, durationFrameScale: samples } });
  const episode = recorder.startEpisode({ lane: "initial", searchSeed: seed, frontierHasFallbackLane: false,
    anchorGapIndex: 0, startTotalSpentFrames: 0, ceilingTotalSpentFrames: options.budget, includeStartup: false });
  recorder.setActiveCandidateWork({ actualCandidateSamples: result.samples,
    candidateSamplesByStream: { normal: result.samples } });
  for (const row of result.rows) {
    const gap = gaps.findIndex(g => g.endFrame >= row.frame);
    if (gap >= 0) recorder.observeActiveEpisode(gap, row.spent);
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
    stats: { actual_candidate_samples: result.samples, engine_rebuilds: result.backtracks + 2,
      gap_commits: result.stats.gap_commits, gap_backtracks: result.backtracks,
      validation_retries: 0, polish_iterations: 0, total_committed_cost: costs.reduce((s, c) => s + c, 0),
      committed_costs_per_gap: costs, sim_frames: total, ballistic_micro_sim_frames: 0,
      budget_exhausted: exhausted, first_completion_frame: valid ? total : null } };
}
