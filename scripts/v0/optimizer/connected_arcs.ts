/** Public integration of measured, connected normal-line arc construction. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { compileArcMotion, type ArcMotionOptions } from "./arc_motion.ts";
import futureValueModel from "./arc_value_model.json" with { type: "json" };
import { resetPerCompileState } from "../core/compile_lifecycle.ts";
import { sliceTimeline } from "../core/substrate.ts";
import { CompileBudgetTelemetryRecorder, type BudgetTelemetryLevel } from "./budget_telemetry.ts";
import type { CompileCheckpoint, Spec } from "./types.ts";
import { normalizeCompilerTimeline, validateCompilerTelemetry } from "./compiler_input.ts";

// This is a data artifact; reading it directly also avoids expanding the large
// model into generated JavaScript and source maps in development tooling.
let controlPolicy: any;
export function parseArcPolicyArtifact(bytes:Buffer|string,artifactUrl?:URL):any {
  const artifact=JSON.parse(bytes.toString());
  if(artifact.schema!=="line.arc-compressed-policy.v1")return artifact;
  if(artifact.compression!=="gzip-file"||!artifactUrl||typeof artifact.file!=="string"||
    !/^[a-zA-Z0-9_.-]+\.gz$/.test(artifact.file)||!Number.isSafeInteger(artifact.uncompressedBytes)||artifact.uncompressedBytes<=0)
    throw new Error("invalid arc policy archive");
  const compressed=readFileSync(new URL(artifact.file,artifactUrl));
  if(createHash("sha256").update(compressed).digest("hex")!==artifact.compressedSha256)
    throw new Error("arc policy archive checksum mismatch");
  const raw=gunzipSync(compressed,{maxOutputLength:artifact.uncompressedBytes});
  if(raw.length!==artifact.uncompressedBytes||createHash("sha256").update(raw).digest("hex")!==artifact.sha256)
    throw new Error("arc policy archive checksum mismatch");
  return JSON.parse(raw.toString());
}
const policyUrl=new URL("./arc_control_policy_model.json",import.meta.url);
const loadControlPolicy = () => controlPolicy ??= parseArcPolicyArtifact(readFileSync(policyUrl),policyUrl);

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
  const planningBreadth = Math.max(12, Math.min(160, Math.floor(Math.min(80, allowance) + .8 * refinement)));
  // Keep continuation capacity calibrated independently of the construction mix.
  const planningGuidanceSamples = Math.min(96, Math.floor(.8 * refinement));
  // Preserve proposal and continuation calibration while directing more of the
  // construction allowance to joint geometry refinement.
  const proposalGuidanceSamples = Math.min(160, Math.floor(2.25 * refinement));
  const samples = Math.min(80, planningBreadth);
  const guidanceSamples = Math.min(176, Math.floor(1.5 * proposalGuidanceSamples));
  const responseSamples = Math.floor(guidanceSamples * 161 / 176);
  const lookaheadSamples = Math.max(8, Math.round(planningBreadth * .2));
  return { budget, samples,
    authoredHorizon: true, amplitudeOverflow: 'raw', budgetedProposals: true, terminalSelection: true,
    channel: 12, radius: 24, bidirectional: true, impactWeight: 1,
    amplitudeWeight: 1 / 3, arrivalMode: "speed", arrivalWeight: .3,
    headingWeight: .3, qualityRetries: 2, guidance: guidanceSamples ? "clearance" : undefined, guidanceSamples,
    policyPreview: true, previewMemory: true, controlDiversity: "geometry", lookaheadWidth: guidanceSamples ? 3 : 0, lookaheadSamples, lookaheadObjective: "terminal",
    reserveFactor: .7 + .7 * (1 - planningGuidanceSamples / 96), reuseContinuations: true, pruneGuidance: true,
    guidanceJoint: true, expressive: true, preserveTurnTiming: true, responseSamples,
    adaptivePlanning: true, strictHorizon: true, cachePrefixReads: true, memoCandidates: true, reuseEvaluations: true,
    budgetAdaptiveLocal: guidanceSamples > 0,
    // Complete-span correction needs the joint search's room to adjust the
    // approach. Preserve the measured low-allowance curve search otherwise.
    completeBoundary: guidanceSamples > 0,
    memorySamples: Math.round(4 * planningGuidanceSamples / 96),
    memoryResponseSamples: Math.round(4 * planningGuidanceSamples / 96),
    // Resolve only the selected policy. Research can replace this factory with
    // another artifact without retaining an unused copy of the default model.
    controlPolicy: guidanceSamples ? loadControlPolicy : undefined, policySamples: Math.round(32 * proposalGuidanceSamples / 160),
    futureValueModel: guidanceSamples ? futureValueModel : undefined,
    // Rank unprobed arrivals with the model, then use its value at the
    // simulated continuation boundary. Do not blend it into the root twice.
    // Calibrate model influence directly, independently of curve-search allocation.
    valueSelection: false, valueWeight: .45,
    // Let the learned arrival estimate guide geometry refinement before planning.
    valueGuidanceWeight: .25,
    continuationValueWeight: .5 * planningGuidanceSamples / 96 };
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
    model: { name: "connected-arcs/v6", source: "arc_motion.ts learned and measured curve proposals, complete boundaries and adaptive construction",
      interceptFrames: 0, contactFrames: 0, durationFrameScale: samples } });
  for (const [index, attempt] of result.attempts.entries()) {
    const episode = recorder.startEpisode({ lane: "initial", searchSeed: seed, frontierHasFallbackLane: false,
      anchorGapIndex: 0, startTotalSpentFrames: attempt.start, ceilingTotalSpentFrames: options.budget, includeStartup: false });
    recorder.setActiveCandidateWork({ actualCandidateSamples: attempt.samples, viableCandidates: attempt.viableCandidates,
      candidateSamplesByStream: { normal: attempt.samples } });
    for (const commit of attempt.commits) recorder.observeActiveEpisode(Math.min(commit.index, gaps.length), commit.spent);
    recorder.recordEvaluation({ totalSpentFrames: attempt.end, gapIndex: attempt.complete ? gaps.length : attempt.gapCommits,
      terminal: attempt.complete, origin: "frontier", firstTimeSearchNode: true,
      terminalTrackKey: attempt.trackHash, registerImproved: attempt.complete && (index === 0 || attempt.selected) });
    recorder.endEpisode(attempt.end, attempt.exhausted ? "budget_capture" : "compile_finished");
    recorder.recordSegment("initial_search", attempt.start, attempt.constructionEnd, attempt.name + "_construction_complete", episode);
    recorder.recordSegment("finalization", attempt.constructionEnd, attempt.end, "cold_replay_complete", episode);
  }
  const costs = report.gaps.map(g => Object.values(g.axes).reduce((s, a) => s + (a?.error ?? 0) ** 2, 0));
  return { budget: options.budget, track, report,
    budgetTelemetry: recorder.snapshot(total, exhausted, result.firstCompletionFrame, result.firstCompletionFrame),
    stats: { actual_candidate_samples: result.samples, viable_candidate_samples: result.stats.viable_candidate_samples, engine_rebuilds: result.engineRebuilds ?? result.backtracks + 2,
      gap_commits: result.stats.gap_commits, gap_backtracks: result.backtracks,
      validation_retries: 0, polish_iterations: 0, total_committed_cost: costs.reduce((s, c) => s + c, 0),
      committed_costs_per_gap: costs, sim_frames: total, ballistic_micro_sim_frames: 0,
      budget_exhausted: exhausted, first_completion_frame: result.firstCompletionFrame } };
}
