import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  readGridArm,
  type GridArm,
} from "./paired_grid.ts";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";
import {
  BUDGET_EVALUATION_ORIGINS,
  BUDGET_TELEMETRY_SCHEMA,
  type BudgetEpisodeTelemetry,
  type CompileBudgetTelemetry,
} from "../v0/optimizer/budget_telemetry.ts";

export const SCALE_MECHANICS_SCHEMA = "line.benchmark-v2.scale-mechanics.v4" as const;

type RunRow = {
  task: { sourceId: string; budget: number; actualSeed: number };
  elapsedMs?: number;
  trackHash?: string | null;
  score?: { score?: number };
  stats?: Record<string, any>;
  budgetTelemetry?: CompileBudgetTelemetry | null;
};

export type MechanicsMetric = {
  observations: number;
  seedBlocks: number;
  referenceMean: number;
  candidateMean: number;
  delta: number;
  seedBlockStandardError: number;
  relativeDelta: number | null;
};

export type ScaleMechanicsSummary = {
  cells: number;
  changedTracks: number;
  rawScoreDeltaMean: number;
  metrics: Record<string, MechanicsMetric>;
};

const METRICS: Array<[string, (row: RunRow) => number | null]> = [
  ["rankedOptionPoolCalls", (row) => work(row).ranked_option_calls],
  ["requestedNormalProposals", (row) => work(row).requested_normal_proposals],
  ["requestedNormalProposalsPerRankedOptionCall", (row) => {
    const current = work(row);
    return current.ranked_option_calls === 0 ? null : current.requested_normal_proposals / current.ranked_option_calls;
  }],
  ["actualCandidateSamples", (row) => work(row).actual_candidate_samples],
  ["actualCandidateSamplesPerRankedOptionCall", (row) => ratio(
    work(row).actual_candidate_samples,
    work(row).ranked_option_calls,
  )],
  ["normalCandidateSamples", (row) => work(row).candidate_samples_by_stream.normal ?? 0],
  ["brakeCandidateSamples", (row) => work(row).candidate_samples_by_stream.brake ?? 0],
  ["startupCatchCandidateSamples", (row) =>
    work(row).candidate_samples_by_stream.startup_catch ?? 0],
  ["actualCandidateSamplesPerMillionFrames", (row) => perMillion(
    work(row).actual_candidate_samples,
    telemetry(row).compile.total_spent_frames,
  )],
  ["viableCandidates", (row) => work(row).viable_candidates],
  ["viableCandidateRate", (row) => ratio(
    work(row).viable_candidates,
    work(row).actual_candidate_samples,
  )],
  ["nodesProcessed", (row) => work(row).nodes_processed],
  ["nodesExpanded", (row) => work(row).nodes_expanded],
  ["childrenEnqueued", (row) => work(row).children_enqueued],
  ["firstTerminalFrames", (row) => finite(
    telemetry(row).compile.first_terminal_total_spent_frames,
  )],
  ["postFirstTerminalFrames", postFirstTerminalFrames],
  ["registerOffers", (row) => work(row).register_offers],
  ["terminalNodeEvaluations", (row) => work(row).terminal_node_evaluations],
  ["firstTimeTerminalNodeEvaluations", (row) => work(row).first_time_terminal_node_evaluations],
  ["revisitedTerminalNodeEvaluations", (row) => work(row).revisited_terminal_node_evaluations],
  ["distinctTerminalTracks", (row) => work(row).distinct_terminal_tracks],
  ["repeatedTerminalTrackEvaluations", (row) => work(row).repeated_terminal_track_evaluations],
  ["repeatedTerminalTrackRate", (row) => ratio(
    work(row).repeated_terminal_track_evaluations,
    work(row).terminal_node_evaluations,
  )],
  ["registerImprovements", (row) => work(row).register_improvements],
  ["terminalRegisterImprovements", (row) => work(row).terminal_register_improvements],
  ["tailCompletionTerminalEvaluations", (row) =>
    work(row).by_evaluation_origin.tail_completion.terminal_node_evaluations],
  ["tailCompletionRegisterImprovements", (row) =>
    work(row).by_evaluation_origin.tail_completion.register_improvements],
  ["tailCompletionTerminalRegisterImprovements", (row) =>
    work(row).by_evaluation_origin.tail_completion.terminal_register_improvements],
  ["repairEpisodes", (row) => repairEpisodes(row).length],
  ["repairEpisodesWithRegisterImprovement", (row) => repairEpisodes(row)
    .filter((episode) => episode.outcome.register_improved).length],
  ["repairTerminalReachedEpisodes", (row) => repairEpisodes(row)
    .filter((episode) => episode.outcome.terminal_reached).length],
  ["repairAcceptedAlternatives", (row) => repairEpisodes(row)
    .filter((episode) => episode.outcome.accepted_alternative).length],
  ["repairCensoredEpisodes", (row) => repairEpisodes(row)
    .filter((episode) => episode.outcome.terminal_observation_censored).length],
  ["repairCensorRate", (row) => {
    const episodes = repairEpisodes(row);
    return ratio(
      episodes.filter((episode) => episode.outcome.terminal_observation_censored).length,
      episodes.length,
    );
  }],
  ["repairTerminalReachedRate", (row) => {
    const episodes = repairEpisodes(row);
    return ratio(
      episodes.filter((episode) => episode.outcome.terminal_reached).length,
      episodes.length,
    );
  }],
  ["repairFirstTerminalReturnEpisodes", (row) => repairEpisodes(row)
    .filter((episode) => episode.outcome.stop_reason === "first_terminal_return").length],
  ["repairTerminalEvaluationsPerEpisode", (row) => {
    const episodes = repairEpisodes(row);
    return episodes.length === 0
      ? null
      : episodes.reduce(
        (sum, episode) => sum + episode.work.terminal_node_evaluations,
        0,
      ) / episodes.length;
  }],
  ["repairMeanAnchorGap", (row) => episodeMean(repairEpisodes(row), (episode) =>
    episode.anchor.gap_index)],
  ["repairMeanParentDepth", (row) => episodeMean(repairEpisodes(row), (episode) =>
    episode.repair_decision?.parent_depth ?? null)],
  ["repairIdenticalTerminalGeometry", (row) => repairEpisodes(row)
    .filter((episode) => episode.outcome.repair_divergence?.terminal_geometry_identical === true)
    .length],
  ["repairMeanDivergentSuffixGaps", (row) => episodeMean(repairEpisodes(row), (episode) =>
    episode.outcome.repair_divergence?.divergent_suffix_gap_count ?? null)],
  ["repairDistinctAnchorGaps", (row) => new Set(repairEpisodes(row)
    .map((episode) => episode.anchor.gap_index)).size],
  ["repairTotalAllocatedFrames", (row) => sumRepairEpisodes(row, (episode) =>
    episode.allocated_frames)],
  ["repairTotalSpentFrames", (row) => sumRepairEpisodes(row, (episode) =>
    episode.outcome.spent_frames)],
  ["repairSpentWorkShare", (row) => ratio(
    sumRepairEpisodes(row, (episode) => episode.outcome.spent_frames),
    telemetry(row).compile.total_spent_frames,
  )],
  ["repairMeanAllocatedFrames", (row) => episodeMean(repairEpisodes(row), (episode) =>
    episode.allocated_frames)],
  ["repairMeanSpentFrames", (row) => episodeMean(repairEpisodes(row), (episode) =>
    episode.outcome.spent_frames)],
  ["repairMeanFirstTerminalOffsetFrames", (row) => episodeMean(
    repairEpisodes(row),
    (episode) => episode.outcome.first_terminal_offset_frames,
  )],
  ["repairMeanEstimatedCompletionFrames", (row) => episodeMean(
    completedRepairEpisodes(row),
    (episode) => episode.start.estimated_remaining_work_frames,
  )],
  ["repairCompletionEstimateSignedErrorFrames", (row) => episodeMean(
    completedRepairEpisodes(row),
    (episode) => completionEstimateError(episode),
  )],
  ["repairCompletionEstimateAbsoluteErrorFrames", (row) => episodeMean(
    completedRepairEpisodes(row),
    (episode) => {
      const error = completionEstimateError(episode);
      return error === null ? null : Math.abs(error);
    },
  )],
  ["repairCompletionEstimateAbsoluteRelativeError", (row) => episodeMean(
    completedRepairEpisodes(row),
    (episode) => {
      const error = completionEstimateError(episode);
      const actual = episode.outcome.first_terminal_offset_frames;
      return error === null || actual === null ? null : ratio(Math.abs(error), actual);
    },
  )],
  ["repairCompletionEstimateIntervalCoverage", (row) => {
    const episodes = completedRepairEpisodes(row);
    if (episodes.length === 0) return null;
    return episodes.filter((episode) => {
      const actual = episode.outcome.first_terminal_offset_frames!;
      return actual >= episode.start.estimate_lower_frames &&
        actual <= episode.start.estimate_upper_frames;
    }).length / episodes.length;
  }],
  ["repairCompletionAllocationSurplusFrames", (row) => episodeMean(
    completedRepairEpisodes(row),
    (episode) => episode.allocated_frames - episode.outcome.first_terminal_offset_frames!,
  )],
  ["repairCompletionWithinAllocationRate", (row) => {
    const episodes = completedRepairEpisodes(row);
    if (episodes.length === 0) return null;
    return episodes.filter((episode) =>
      episode.outcome.first_terminal_offset_frames! <= episode.allocated_frames
    ).length / episodes.length;
  }],
  ["repairTotalEpisodeOverrunFrames", (row) => sumRepairEpisodes(row, (episode) =>
    Math.max(0, (episode.outcome.spent_frames ?? 0) - episode.allocated_frames))],
  ["repairCalibratedEstimatorRate", (row) => {
    const episodes = repairEpisodes(row);
    return episodes.length === 0
      ? null
      : episodes.filter((episode) => episode.start.estimator_applicability === "calibrated").length /
        episodes.length;
  }],
  ["repairDistinctSearchSeeds", (row) => new Set(repairEpisodes(row).flatMap((episode) =>
    episode.search_seed === null ? [] : [episode.search_seed]
  )).size],
  ["repairEpisodeImprovementRate", (row) => {
    const episodes = repairEpisodes(row);
    return episodes.length === 0
      ? null
      : episodes.filter((episode) => episode.outcome.register_improved).length / episodes.length;
  }],
  ["repairRankedOptionPoolCalls", (row) => sumRepairWork(row, "ranked_option_calls")],
  ["repairActualCandidateSamples", (row) => sumRepairWork(row, "actual_candidate_samples")],
  ["repairViableCandidates", (row) => sumRepairWork(row, "viable_candidates")],
  ["repairNodesProcessed", (row) => sumRepairWork(row, "nodes_processed")],
  ["repairNodesExpanded", (row) => sumRepairWork(row, "nodes_expanded")],
  ["repairRegisterOffers", (row) => sumRepairWork(row, "register_offers")],
  ["repairTerminalNodeEvaluations", (row) => sumRepairWork(row, "terminal_node_evaluations")],
  ["repairWithinEpisodeDistinctTerminalTracks", (row) =>
    sumRepairWork(row, "distinct_terminal_tracks")],
  ["repairRegisterImprovements", (row) => sumRepairWork(row, "register_improvements")],
  ["repairTerminalRegisterImprovements", (row) =>
    sumRepairWork(row, "terminal_register_improvements")],
  ["repairTerminalImprovementPerEvaluation", (row) => ratio(
    sumRepairWork(row, "terminal_register_improvements"),
    sumRepairWork(row, "terminal_node_evaluations"),
  )],
  ["repairTerminalImprovementsPerMillionFrames", (row) => perMillion(
    sumRepairWork(row, "terminal_register_improvements"),
    sumRepairEpisodes(row, (episode) => episode.outcome.spent_frames),
  )],
  ["repairInternalFullScoreDelta", (row) => repairEpisodes(row).reduce(
    (sum, episode) => sum + (episode.outcome.internal_full_score_delta ?? 0),
    0,
  )],
  ["repairInternalFullScoreDeltaPerMillionFrames", (row) => perMillion(
    repairEpisodes(row).reduce(
      (sum, episode) => sum + (episode.outcome.internal_full_score_delta ?? 0),
      0,
    ),
    sumRepairEpisodes(row, (episode) => episode.outcome.spent_frames),
  )],
  ["repairTerminalOfferTargetGapSseImprovement", (row) =>
    sumComparableRepairEpisodes(row, (episode) => {
      const before = episode.incumbent_target_gap_before?.sse;
      const offer = episode.outcome.terminal_offer_target_gap?.sse;
      return before === undefined || offer === undefined ? null : before - offer;
    })],
  ["repairIncumbentTargetGapSseImprovement", (row) =>
    sumComparableRepairEpisodes(row, (episode) => {
      const before = episode.incumbent_target_gap_before?.sse;
      const after = episode.outcome.incumbent_target_gap_after?.sse;
      return before === undefined || after === undefined ? null : before - after;
  })],
  ["repairTerminalOfferTargetGapImprovementRate", (row) => {
    const comparable = repairEpisodes(row).flatMap((episode) => {
      const before = episode.incumbent_target_gap_before?.sse;
      const offer = episode.outcome.terminal_offer_target_gap?.sse;
      return before === undefined || offer === undefined ? [] : [before - offer];
    });
    return comparable.length === 0
      ? null
      : comparable.filter((delta) => delta > 0).length / comparable.length;
  }],
  ["finalOutputFromRepair", (row) => telemetry(row).compile.final_output_lane === "repair" ? 1 : 0],
];

export function pairedScaleMechanics(
  referenceRows: RunRow[],
  candidateRows: RunRow[],
): {
  schema: typeof SCALE_MECHANICS_SCHEMA;
  overall: ScaleMechanicsSummary;
  perBudget: Array<{ budget: number } & ScaleMechanicsSummary>;
} {
  assertUniqueRows("reference", referenceRows);
  assertUniqueRows("candidate", candidateRows);
  for (const row of [...referenceRows, ...candidateRows]) telemetry(row);
  const reference = new Map(referenceRows.map((row) => [runKey(row), row]));
  const pairs = candidateRows.map((candidate) => {
    const ref = reference.get(runKey(candidate));
    if (ref === undefined) throw new Error(`scale mechanics reference is missing ${runKey(candidate)}`);
    return { ref, candidate };
  });
  const candidateKeys = new Set(candidateRows.map(runKey));
  const unmatchedReference = referenceRows.filter((row) => !candidateKeys.has(runKey(row)));
  if (unmatchedReference.length > 0) {
    throw new Error(`scale mechanics reference contains ${unmatchedReference.length} unpaired cells`);
  }
  const budgets = [...new Set(candidateRows.map((row) => row.task.budget))].sort((a, b) => a - b);
  return {
    schema: SCALE_MECHANICS_SCHEMA,
    overall: summarizePairs(pairs),
    perBudget: budgets.map((budget) => ({
      budget,
      ...summarizePairs(pairs.filter((pair) => pair.candidate.task.budget === budget)),
    })),
  };
}

function summarizePairs(pairs: Array<{ ref: RunRow; candidate: RunRow }>): ScaleMechanicsSummary {
  return {
    cells: pairs.length,
    changedTracks: pairs.filter((pair) => pair.ref.trackHash !== pair.candidate.trackHash).length,
    rawScoreDeltaMean: round(mean(pairs.map((pair) =>
      (pair.candidate.score?.score ?? 0) - (pair.ref.score?.score ?? 0)
    ))),
    metrics: Object.fromEntries(METRICS.map(([name, read]) => [name, metricSummary(pairs, read)])),
  };
}

function metricSummary(
  pairs: Array<{ ref: RunRow; candidate: RunRow }>,
  read: (row: RunRow) => number | null,
): MechanicsMetric {
  const complete = pairs.flatMap((pair) => {
    const reference = read(pair.ref);
    const candidate = read(pair.candidate);
    return reference === null || candidate === null
      ? []
      : [{ reference, candidate, seed: pair.candidate.task.actualSeed }];
  });
  const referenceMean = mean(complete.map((pair) => pair.reference));
  const candidateMean = mean(complete.map((pair) => pair.candidate));
  const delta = candidateMean - referenceMean;
  const blockDeltas = [...new Set(complete.map((pair) => pair.seed))].map((seed) => {
    const inSeed = complete.filter((pair) => pair.seed === seed);
    return mean(inSeed.map((pair) => pair.candidate - pair.reference));
  });
  return {
    observations: complete.length,
    seedBlocks: blockDeltas.length,
    referenceMean: round(referenceMean),
    candidateMean: round(candidateMean),
    delta: round(delta),
    seedBlockStandardError: round(standardError(blockDeltas)),
    relativeDelta: referenceMean === 0 ? null : round(delta / referenceMean),
  };
}

function standardError(values: number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - center) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance / values.length);
}

function telemetry(row: RunRow): CompileBudgetTelemetry {
  const value = row.budgetTelemetry;
  if (value === null || value === undefined) {
    throw new Error(`scale mechanics row ${runKey(row)} has no budget telemetry`);
  }
  if (value.schema !== BUDGET_TELEMETRY_SCHEMA) {
    throw new Error(
      `scale mechanics row ${runKey(row)} has schema ${String(value.schema)}; ` +
        `expected ${BUDGET_TELEMETRY_SCHEMA}`,
    );
  }
  assertMechanicsWork(value.compile.work, `${runKey(row)}:compile`);
  for (const episode of value.episodes) {
    assertMechanicsWork(episode.work, `${runKey(row)}:episode=${episode.episode_id}`);
    if (episode.outcome.terminal_reached !== (episode.work.terminal_node_evaluations > 0)) {
      throw new Error(
        `scale mechanics row ${runKey(row)} episode ${episode.episode_id} has inconsistent terminal outcome`,
      );
    }
    if (episode.outcome.register_improved !== (episode.work.register_improvements > 0)) {
      throw new Error(
        `scale mechanics row ${runKey(row)} episode ${episode.episode_id} has inconsistent register outcome`,
      );
    }
    if (episode.lane === "repair" && episode.repair_decision === null) {
      throw new Error(
        `scale mechanics row ${runKey(row)} episode ${episode.episode_id} has no repair decision`,
      );
    }
    if (episode.lane === "repair" && episode.outcome.terminal_reached &&
        episode.outcome.repair_divergence === null) {
      throw new Error(
        `scale mechanics row ${runKey(row)} episode ${episode.episode_id} has no divergence evidence`,
      );
    }
  }
  assertCompileEpisodeWorkCloses(value, runKey(row));
  return value;
}

function assertCompileEpisodeWorkCloses(value: CompileBudgetTelemetry, context: string): void {
  const fields = [
    "ranked_option_calls",
    "requested_normal_proposals",
    "actual_candidate_samples",
    "viable_candidates",
    "nodes_processed",
    "nodes_expanded",
    "children_enqueued",
    "register_offers",
    "partial_node_evaluations",
    "terminal_node_evaluations",
    "first_time_terminal_node_evaluations",
    "revisited_terminal_node_evaluations",
    "register_improvements",
    "terminal_register_improvements",
  ] as const;
  for (const field of fields) {
    const total = value.episodes.reduce((sum, episode) => sum + episode.work[field], 0);
    if (value.compile.work[field] !== total) {
      throw new Error(`scale mechanics ${context} compile ${field} does not equal episode sum`);
    }
  }
  const modes = new Set([
    ...Object.keys(value.compile.work.candidate_samples_by_stream),
    ...value.episodes.flatMap((episode) => Object.keys(episode.work.candidate_samples_by_stream)),
  ]);
  for (const mode of modes) {
    const total = value.episodes.reduce(
      (sum, episode) => sum + (episode.work.candidate_samples_by_stream[mode] ?? 0),
      0,
    );
    if ((value.compile.work.candidate_samples_by_stream[mode] ?? 0) !== total) {
      throw new Error(`scale mechanics ${context} compile candidate mode ${mode} does not equal episode sum`);
    }
  }
  for (const origin of BUDGET_EVALUATION_ORIGINS) {
    for (const field of [
      "register_offers",
      "terminal_node_evaluations",
      "register_improvements",
      "terminal_register_improvements",
    ] as const) {
      const total = value.episodes.reduce(
        (sum, episode) => sum + episode.work.by_evaluation_origin[origin][field],
        0,
      );
      if (value.compile.work.by_evaluation_origin[origin][field] !== total) {
        throw new Error(
          `scale mechanics ${context} compile evaluation origin ${origin}/${field} ` +
            `does not equal episode sum`,
        );
      }
    }
  }
}

function assertMechanicsWork(
  work: CompileBudgetTelemetry["compile"]["work"],
  context: string,
): void {
  const samples = Object.values(work.candidate_samples_by_stream)
    .reduce((sum, count) => sum + count, 0);
  if (samples !== work.actual_candidate_samples) {
    throw new Error(`scale mechanics ${context} has open candidate-mode accounting`);
  }
  if (work.register_offers !== work.partial_node_evaluations + work.terminal_node_evaluations) {
    throw new Error(`scale mechanics ${context} has open register-offer accounting`);
  }
  if (work.terminal_node_evaluations !==
      work.first_time_terminal_node_evaluations + work.revisited_terminal_node_evaluations) {
    throw new Error(`scale mechanics ${context} has open terminal-node accounting`);
  }
  if (work.terminal_node_evaluations !==
      work.distinct_terminal_tracks + work.repeated_terminal_track_evaluations) {
    throw new Error(`scale mechanics ${context} has open terminal-track accounting`);
  }
  for (const field of [
    "register_offers",
    "terminal_node_evaluations",
    "register_improvements",
    "terminal_register_improvements",
  ] as const) {
    const attributed = BUDGET_EVALUATION_ORIGINS.reduce(
      (sum, origin) => sum + work.by_evaluation_origin[origin][field],
      0,
    );
    if (attributed !== work[field]) {
      throw new Error(`scale mechanics ${context} has open evaluation-origin ${field} accounting`);
    }
  }
}

function work(row: RunRow): CompileBudgetTelemetry["compile"]["work"] {
  return telemetry(row).compile.work;
}

function repairEpisodes(row: RunRow): BudgetEpisodeTelemetry[] {
  return telemetry(row).episodes.filter((episode) => episode.lane === "repair");
}

function completedRepairEpisodes(row: RunRow): BudgetEpisodeTelemetry[] {
  return repairEpisodes(row).filter((episode) =>
    episode.outcome.first_terminal_offset_frames !== null
  );
}

/** Positive means the start estimate underpredicted charged work to completion. */
function completionEstimateError(episode: BudgetEpisodeTelemetry): number | null {
  const actual = episode.outcome.first_terminal_offset_frames;
  return actual === null ? null : actual - episode.start.estimated_remaining_work_frames;
}

function episodeMean(
  episodes: BudgetEpisodeTelemetry[],
  read: (episode: BudgetEpisodeTelemetry) => number | null,
): number | null {
  const values = episodes.flatMap((episode) => {
    const value = read(episode);
    return value === null ? [] : [value];
  });
  return values.length === 0 ? null : mean(values);
}

function sumRepairEpisodes(
  row: RunRow,
  read: (episode: BudgetEpisodeTelemetry) => number | null,
): number {
  return repairEpisodes(row).reduce((sum, episode) => sum + (read(episode) ?? 0), 0);
}

function sumComparableRepairEpisodes(
  row: RunRow,
  read: (episode: BudgetEpisodeTelemetry) => number | null,
): number | null {
  const values = repairEpisodes(row).flatMap((episode) => {
    const value = read(episode);
    return value === null ? [] : [value];
  });
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

function sumRepairWork(
  row: RunRow,
  name: Exclude<
    keyof BudgetEpisodeTelemetry["work"],
    "candidate_samples_by_stream" | "by_evaluation_origin"
  >,
): number {
  return repairEpisodes(row).reduce((sum, episode) => sum + episode.work[name], 0);
}

function postFirstTerminalFrames(row: RunRow): number | null {
  const compile = telemetry(row).compile;
  const total = finite(compile?.total_spent_frames);
  const first = finite(compile?.first_terminal_total_spent_frames);
  return total === null || first === null ? null : Math.max(0, total - first);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function perMillion(value: number, spentFrames: number): number | null {
  const result = ratio(value, spentFrames);
  return result === null ? null : result * 1_000_000;
}

function assertUniqueRows(label: string, rows: RunRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = runKey(row);
    if (seen.has(key)) throw new Error(`scale mechanics ${label} contains duplicate cell ${key}`);
    seen.add(key);
  }
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function runKey(row: RunRow): string {
  return gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function restrictArm(arm: GridArm, keys: Set<string>): GridArm {
  return { ...arm, cells: new Map([...arm.cells].filter(([key]) => keys.has(key))) };
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const referencePath = resolve(argument("reference") ?? "");
  const candidatePath = resolve(argument("candidate") ?? "");
  const outputPath = resolve(argument("out") ?? "");
  if (argument("reference") === undefined || argument("candidate") === undefined || argument("out") === undefined) {
    throw new Error(`usage: analyze_scale_mechanics --reference=ARCHIVE --candidate=ARCHIVE --out=ARTIFACT`);
  }
  const reference = readGridArm("reference", referencePath);
  const candidate = readGridArm("candidate", candidatePath);
  const referencePrefix = restrictArm(reference, new Set(candidate.cells.keys()));
  const comparabilityNotes = assertPairedArms(candidate, referencePrefix);
  const candidateKeys = new Set(candidate.cells.keys());
  const referenceRows = (reference.archive.runs as RunRow[]).filter((row) => candidateKeys.has(runKey(row)));
  const mechanics = pairedScaleMechanics(referenceRows, candidate.archive.runs as RunRow[]);
  const artifact = {
    schema: SCALE_MECHANICS_SCHEMA,
    generatedAt: new Date().toISOString(),
    reference: {
      path: referencePath,
      compilerFingerprint: reference.archive.candidate?.candidateFingerprint,
    },
    candidate: {
      path: candidatePath,
      compilerFingerprint: candidate.archive.candidate?.candidateFingerprint,
      nCandPolicy: candidate.archive.nCandPolicy ?? null,
    },
    comparabilityNotes,
    ...mechanics,
  };
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  writeFileAtomicDurable(outputPath, bytes);
  writeFileAtomicDurable(`${outputPath}.sha256`, `${sha256(bytes)}  ${outputPath}\n`);
  console.log(`Scale mechanics: ${outputPath}`);
}

if (process.argv[1]?.endsWith("analyze_scale_mechanics.ts")) await main();
