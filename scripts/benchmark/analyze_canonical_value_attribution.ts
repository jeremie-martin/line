/**
 * Checksum-bound descriptive attribution of the promoted Phase-D value-ranked
 * search policy against its canonical paired reference.
 *
 * This deliberately separates deterministic intervention identity from
 * statistical association. It does not turn telemetry-selected cohorts into a
 * new promotion test and it does not infer counterfactual scores for actions
 * that did not run.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadVerifiedAnalysisArchive } from "../v0/benchmark_v2/analysis_archive.ts";

type CompactRun = {
  status: string;
  task: any;
  source: any;
  authoredContacts: number;
  score: any;
  trackHash: string | null;
  policy: string | null;
  value: ValueSummary;
  work: WorkSummary;
};

type ValueSummary = {
  crossings: number;
  admitted: number;
  rankedOut: number;
  progressExpired: number;
  terminalReserveSuppressed: number;
  explorationAllowanceSuppressed: number;
  probeFrames: number;
  actions: number;
  reachedTarget: number;
  alternativeSelected: number;
  stableAlternativeSelected: number;
  lateFlipAlternativeSelected: number;
  currentSelected: number;
  deadEnds: number;
  budgetYields: number;
  deferred: number;
  otherOutcomes: number;
  positiveLocalGain: number;
  summedLocalGain: number;
  firstActionProgress: number | null;
  firstActionDensity: number | null;
  selectedGainMargins: number[];
  selectedMinimumCheckpointGains: number[];
};

type WorkSummary = {
  totalFrames: number;
  firstTerminalFrames: number | null;
  postFirstTerminalFrames: number | null;
  repairFrames: number;
  repairAttempts: number;
  repairTerminalReached: number;
  repairAccepted: number;
  resumedFrames: number;
  candidateSamples: number;
  nodesExpanded: number;
  terminalNodeEvaluations: number;
  distinctTerminalTracks: number;
  registerImprovements: number;
  terminalRegisterImprovements: number;
};

type Pair = {
  key: string;
  sourceId: string;
  stratum: string;
  seedSlot: number;
  actualSeed: number;
  scoreDelta: number;
  candidateScore: number;
  referenceScore: number;
  valid: boolean;
  sameTrack: boolean;
  value: ValueSummary;
  workDelta: WorkSummary;
};

const EXPECTED_CANDIDATE_POLICY =
  "selective_axis_regret_catchup_value_initial_expire_10";
const EXPECTED_REFERENCE_POLICY = "selective_axis_regret_catchup";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const candidatePath = required(argument, "candidate");
  const referencePath = required(argument, "reference");
  const comparisonPath = required(argument, "comparison");
  const outPath = argument("out");
  const comparison = JSON.parse(readFileSync(resolve(comparisonPath), "utf8"));

  const candidate = await loadVerifiedAnalysisArchive(
    candidatePath,
    {
      archive_sha256: comparison.candidate?.archiveSha256,
      compressed_archive_sha256: comparison.candidate?.compressedArchiveSha256,
    },
    projectRun,
  );
  const reference = await loadVerifiedAnalysisArchive(referencePath, undefined, projectRun);
  if (comparison.decision?.result?.outcome !== "accept") {
    throw new Error("comparison is not an accepted canonical decision");
  }
  if (comparison.decision?.candidate?.archiveSha256 !== candidate.archiveSha256) {
    throw new Error("candidate archive is detached from the accepted decision");
  }
  if (candidate.archive.profile !== "canonical" || reference.archive.profile !== "canonical") {
    throw new Error("attribution requires canonical archives");
  }

  const candidateRows = candidate.archive.runs as CompactRun[];
  const referenceByKey = rowsByKey(reference.archive.runs as CompactRun[]);
  const pairs = candidateRows.map((candidateRow): Pair => {
    const key = runKey(candidateRow);
    const referenceRow = referenceByKey.get(key);
    if (referenceRow === undefined) throw new Error(`reference is missing ${key}`);
    if (
      candidateRow.task.actualSeed !== referenceRow.task.actualSeed ||
      candidateRow.authoredContacts !== referenceRow.authoredContacts
    ) throw new Error(`${key}: paired identity mismatch`);
    if (candidateRow.policy !== EXPECTED_CANDIDATE_POLICY) {
      throw new Error(`${key}: unexpected candidate policy ${candidateRow.policy}`);
    }
    if (referenceRow.policy !== EXPECTED_REFERENCE_POLICY) {
      throw new Error(`${key}: unexpected reference policy ${referenceRow.policy}`);
    }
    return {
      key,
      sourceId: candidateRow.task.sourceId,
      stratum: roleToStratum(candidateRow.source.role),
      seedSlot: candidateRow.task.seedSlot,
      actualSeed: candidateRow.task.actualSeed,
      scoreDelta: candidateRow.score.score - referenceRow.score.score,
      candidateScore: candidateRow.score.score,
      referenceScore: referenceRow.score.score,
      valid: candidateRow.score.valid && referenceRow.score.valid,
      sameTrack: candidateRow.trackHash !== null &&
        candidateRow.trackHash === referenceRow.trackHash,
      value: candidateRow.value,
      workDelta: subtractWork(candidateRow.work, referenceRow.work),
    };
  });
  if (pairs.length === 0) throw new Error("attribution has no paired cells");

  const inactive = pairs.filter((pair) => pair.value.actions === 0);
  const active = pairs.filter((pair) => pair.value.actions > 0);
  const inactiveIdentityViolations = inactive.filter((pair) =>
    !pair.sameTrack || pair.scoreDelta !== 0 || !zeroWork(pair.workDelta)
  );
  if (inactiveIdentityViolations.length > 0) {
    throw new Error(
      `${inactiveIdentityViolations[0]!.key}: no-action cell differs from reference`,
    );
  }

  const byStratum = groupedSummary(pairs, (pair) => pair.stratum);
  const bySource = groupedSummary(pairs, (pair) => pair.sourceId);
  const byActionOutcome = {
    no_action: summarizePairs(inactive),
    action_without_alternative_selection: summarizePairs(active.filter(
      (pair) => pair.value.alternativeSelected === 0,
    )),
    alternative_selected: summarizePairs(active.filter(
      (pair) => pair.value.alternativeSelected > 0,
    )),
  };
  const byActionCount = groupedSummary(pairs, (pair) => actionBucket(pair.value.actions));
  const associations = associationTable(pairs);
  const activeAssociations = associationTable(active);
  const scoredDecision = {
    headline: {
      base: comparison.decision.result.baseHeadline,
      candidate: comparison.decision.result.candidateHeadline,
      delta: comparison.decision.result.delta,
    },
    by_stratum: Object.fromEntries(comparison.decision.result.perStratum.map((row: any) => [
      row.stratum,
      row,
    ])),
    by_source: Object.fromEntries(comparison.decision.result.perCase.map((row: any) => [
      row.sourceId,
      row,
    ])),
    interpretation:
      "Authoritative Benchmark V2 scores pool scored observations before applying the nonlinear quality transform; these values, not means of per-run scores, define the accepted headline.",
  };

  const result = {
    schema: "line.canonical-value-attribution.v1",
    generated_at: new Date().toISOString(),
    evidence: {
      candidate: candidate.path,
      candidate_archive_sha256: candidate.archiveSha256,
      candidate_artifact_sha256: candidate.artifactSha256,
      reference: reference.path,
      reference_archive_sha256: reference.archiveSha256,
      reference_artifact_sha256: reference.artifactSha256,
      accepted_comparison: resolve(comparisonPath),
      accepted_delta: comparison.decision.result.delta,
      accepted_look: comparison.decision.result.confidence?.degreesOfFreedom + 1,
    },
    scope: {
      cells: pairs.length,
      sources: new Set(pairs.map((pair) => pair.sourceId)).size,
      seed_slots: [...new Set(pairs.map((pair) => pair.seedSlot))].sort((a, b) => a - b),
      budget: candidate.archive.identity?.budgets?.[0],
      all_pairs_valid: pairs.every((pair) => pair.valid),
      interpretation:
        "Descriptive post-promotion attribution of an already accepted paired canonical run; not a new decision or a source-selection rule.",
      run_level_score_delta_semantics:
        "Telemetry cohorts below use matched per-run score differences. They are descriptive and need not equal the nonlinear pooled Benchmark V2 headline or stratum deltas.",
    },
    invariants: {
      candidate_policy: EXPECTED_CANDIDATE_POLICY,
      reference_policy: EXPECTED_REFERENCE_POLICY,
      no_action_cells: inactive.length,
      no_action_cells_track_score_and_work_identical: true,
      action_cells: active.length,
      action_cells_with_changed_track: active.filter((pair) => !pair.sameTrack).length,
    },
    scored_decision: scoredDecision,
    overall: summarizePairs(pairs),
    by_action_outcome: byActionOutcome,
    by_action_count: byActionCount,
    alternative_selection_diagnostics: summarizeAlternativeSelections(active),
    by_stratum: byStratum,
    by_source: bySource,
    associations: {
      interpretation:
        "Pearson and rank associations are descriptive. Source-centered values remove between-source means but do not make action admission random or causal.",
      all_cells: associations,
      active_cells: activeAssociations,
    },
    direct_observations: buildDirectObservations(
      pairs,
      byActionOutcome,
      scoredDecision,
    ),
    hypotheses: [
      {
        id: "selection_not_admission",
        statement:
          "Remaining losses may come from which locally winning alternatives are committed, rather than from whether value exploration is admitted at all.",
        discriminating_evidence:
          "Compare final paired return and downstream work for alternative-selected tournaments versus reached-target tournaments that retain the current route.",
      },
      {
        id: "local_global_misalignment",
        statement:
          "The equal-depth axis-loss comparator may be locally correct but weakly aligned with terminal authored score in the losing sources.",
        discriminating_evidence:
          "Relate checkpoint-local gain and remaining suffix length to terminal paired gain within source; do not tune on source identity.",
      },
      {
        id: "opportunity_cost_shape",
        statement:
          "Probe cost may matter through which repair/tail opportunities it displaces, not through raw probe frames alone.",
        discriminating_evidence:
          "Use paired first-terminal, repair, terminal-track, and accepted-repair deltas, separated by local tournament outcome.",
      },
    ],
    recommended_next_mechanisms: [
      "Test a categorical commit rule that requires a stronger or more durable local win before replacing the current route; preserve score-blind admission and avoid source exceptions.",
      "Test progressive checkpoint confirmation inside an already admitted tournament, so weak early wins must survive one additional gap before route replacement.",
      "Only revisit admission density or candidate breadth if canonical attribution says probe cost, rather than route selection, explains the losing return.",
    ],
  };

  printSummary(result);
  if (outPath !== undefined) {
    const absolute = resolve(outPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`analysis ${absolute}`);
  }
}

function projectRun(raw: any, indexed: any): CompactRun {
  const stats = raw.stats ?? {};
  const selective = stats.handoff_selective_backtracking;
  const value = summarizeValue(raw, selective);
  return {
    ...indexed,
    trackHash: typeof raw.trackHash === "string" ? raw.trackHash : null,
    policy: typeof selective?.policy === "string" ? selective.policy : null,
    value,
    work: summarizeWork(raw),
  };
}

function summarizeValue(raw: any, stats: any): ValueSummary {
  if (stats === undefined) return emptyValue();
  const opportunities: any[] = stats.value_live_opportunities ?? [];
  const events: any[] = (stats.events ?? []).filter(
    (event: any) => event.trigger_signal === "value_exploration",
  );
  const counts = countBy(opportunities, (row) => row.outcome);
  if (stats.policy === EXPECTED_CANDIDATE_POLICY) {
    const expectedCounters: Record<string, string> = {
      admitted: "value_live_admitted",
      ranked_out: "value_live_ranked_out",
      production_priority: "value_live_production_priority",
      progress_expired: "value_live_progress_expired_watches",
      alternative_unavailable: "value_live_alternative_unavailable",
      execution_ceiling: "value_live_execution_ceiling_suppressed",
      terminal_reserve: "value_live_terminal_reserve_suppressed",
      exploration_allowance: "value_live_exploration_allowance_suppressed",
    };
    if (stats.value_live_crossings !== opportunities.length) {
      throw new Error(`${runKey(raw)}: value opportunity ledger mismatch`);
    }
    for (const [outcome, counter] of Object.entries(expectedCounters)) {
      if ((counts[outcome] ?? 0) !== (stats[counter] ?? 0)) {
        throw new Error(`${runKey(raw)}: ${outcome} counter mismatch`);
      }
    }
    if (
      events.length !== stats.value_live_admitted ||
      events.length !== stats.selective_backtracks_by_signal?.value_exploration
    ) throw new Error(`${runKey(raw)}: value action ledger mismatch`);
    const admittedByWatch = new Map(opportunities
      .filter((opportunity: any) => opportunity.outcome === "admitted")
      .map((opportunity: any) => [opportunity.watch_id, opportunity]));
    for (const event of events) {
      const opportunity: any = admittedByWatch.get(event.watch_id);
      if (
        opportunity === undefined ||
        event.lane !== "initial" ||
        event.repair_attempt_index !== null ||
        event.value_budget?.admitted !== true ||
        !(opportunity.point.gap_progress >= 0.10) ||
        !(opportunity.point.value_density_per_10k_estimated_frames >= 0.02)
      ) throw new Error(`${runKey(raw)}: invalid admitted value action`);
    }
    const eventFrames = sum(events.map((event: any) => event.catchup_probe_frames ?? 0));
    if (eventFrames !== stats.value_live_probe_frames) {
      throw new Error(`${runKey(raw)}: value probe frame attribution mismatch`);
    }
  }
  const gains: number[] = events.map((event: any) => finite(event.catchup_axis_loss_gain));
  const selected = events.filter(
    (event: any) => event.catchup_outcome === "alternative_selected",
  );
  const selectedMinimumCheckpointGains: number[] = selected.map((event: any) => {
    const checkpointGains = (event.catchup_checkpoints ?? [])
      .map((checkpoint: any) => finite(checkpoint.alternative_axis_loss_gain));
    return checkpointGains.length === 0
      ? finite(event.catchup_axis_loss_gain)
      : Math.min(...checkpointGains);
  });
  const firstOpportunity = events.length === 0
    ? undefined
    : opportunities.find((row: any) => row.watch_id === events[0].watch_id);
  return {
    crossings: finite(stats.value_live_crossings),
    admitted: finite(stats.value_live_admitted),
    rankedOut: finite(stats.value_live_ranked_out),
    progressExpired: finite(stats.value_live_progress_expired_watches),
    terminalReserveSuppressed: finite(stats.value_live_terminal_reserve_suppressed),
    explorationAllowanceSuppressed: finite(stats.value_live_exploration_allowance_suppressed),
    probeFrames: finite(stats.value_live_probe_frames),
    actions: events.length,
    reachedTarget: events.filter((event: any) =>
      (event.catchup_probe_results ?? []).some((probe: any) => probe.outcome === "reached_target")
    ).length,
    alternativeSelected: events.filter(
      (event: any) => event.catchup_outcome === "alternative_selected",
    ).length,
    stableAlternativeSelected: selectedMinimumCheckpointGains.filter((gain) => gain > 0).length,
    lateFlipAlternativeSelected: selectedMinimumCheckpointGains.filter((gain) => gain <= 0).length,
    currentSelected: events.filter(
      (event: any) => event.catchup_outcome === "current_selected",
    ).length,
    deadEnds: events.filter((event: any) => event.catchup_outcome === "probe_dead_end").length,
    budgetYields: events.filter(
      (event: any) => event.catchup_outcome === "probe_budget_yield",
    ).length,
    deferred: events.filter((event: any) => event.catchup_outcome === "probe_deferred").length,
    otherOutcomes: events.filter((event: any) => ![
      "alternative_selected",
      "current_selected",
      "probe_dead_end",
      "probe_budget_yield",
      "probe_deferred",
    ].includes(event.catchup_outcome)).length,
    positiveLocalGain: sum(gains.filter((gain) => gain > 0)),
    summedLocalGain: sum(gains),
    firstActionProgress: firstOpportunity?.point?.gap_progress ?? null,
    firstActionDensity: firstOpportunity?.point?.value_density_per_10k_estimated_frames ?? null,
    selectedGainMargins: selected.map((event: any) => finite(event.catchup_axis_loss_gain)),
    selectedMinimumCheckpointGains,
  };
}

function summarizeWork(raw: any): WorkSummary {
  const compile = raw.budgetTelemetry?.compile ?? {};
  const work = compile.work ?? {};
  const episodes = raw.budgetTelemetry?.episodes ?? [];
  const intervals = raw.budgetTelemetry?.execution_intervals ?? [];
  const repairs = episodes.filter((episode: any) => episode.lane === "repair");
  const totalFrames = finite(compile.total_spent_frames ?? raw.stats?.sim_frames);
  const firstTerminalFrames = nullableFinite(
    compile.first_terminal_total_spent_frames ?? raw.stats?.first_completion_frame,
  );
  return {
    totalFrames,
    firstTerminalFrames,
    postFirstTerminalFrames: firstTerminalFrames === null
      ? null
      : Math.max(0, totalFrames - firstTerminalFrames),
    repairFrames: sum(repairs.map((episode: any) => episode.outcome?.spent_frames ?? 0)),
    repairAttempts: repairs.length,
    repairTerminalReached: repairs.filter(
      (episode: any) => episode.outcome?.terminal_reached === true,
    ).length,
    repairAccepted: repairs.filter(
      (episode: any) => episode.outcome?.accepted_alternative === true,
    ).length,
    resumedFrames: sum(intervals.filter((interval: any) =>
      interval.kind === "resumed_search"
    ).map((interval: any) => interval.spent_frames ?? 0)),
    candidateSamples: finite(work.actual_candidate_samples ?? raw.stats?.actual_candidate_samples),
    nodesExpanded: finite(work.nodes_expanded ?? raw.stats?.search_nodes_expanded),
    terminalNodeEvaluations: finite(work.terminal_node_evaluations),
    distinctTerminalTracks: finite(work.distinct_terminal_tracks),
    registerImprovements: finite(work.register_improvements ?? raw.stats?.improvements),
    terminalRegisterImprovements: finite(work.terminal_register_improvements),
  };
}

function summarizePairs(rows: Pair[]): any {
  if (rows.length === 0) return { cells: 0 };
  const deltas = rows.map((row) => row.scoreDelta);
  const seedBlocks = [...group(rows, (row) => String(row.seedSlot)).entries()]
    .map(([seedSlot, block]) => ({ seed_slot: Number(seedSlot), mean_delta: mean(
      block.map((row) => row.scoreDelta),
    ) }))
    .sort((a, b) => a.seed_slot - b.seed_slot);
  return {
    cells: rows.length,
    active_cells: rows.filter((row) => row.value.actions > 0).length,
    changed_tracks: rows.filter((row) => !row.sameTrack).length,
    mean_score_delta: mean(deltas),
    total_score_delta: sum(deltas),
    standard_error_by_seed_block: standardError(seedBlocks.map((block) => block.mean_delta)),
    improved: deltas.filter((delta) => delta > 0).length,
    regressed: deltas.filter((delta) => delta < 0).length,
    tied: deltas.filter((delta) => delta === 0).length,
    minimum_delta: Math.min(...deltas),
    maximum_delta: Math.max(...deltas),
    value: sumValue(rows.map((row) => row.value)),
    mean_work_delta: meanWork(rows.map((row) => row.workDelta)),
  };
}

function sumValue(rows: ValueSummary[]): any {
  const numeric = [
    "crossings", "admitted", "rankedOut", "progressExpired",
    "terminalReserveSuppressed", "explorationAllowanceSuppressed", "probeFrames",
    "actions", "reachedTarget", "alternativeSelected", "stableAlternativeSelected",
    "lateFlipAlternativeSelected", "currentSelected", "deadEnds", "budgetYields", "deferred",
    "otherOutcomes", "positiveLocalGain", "summedLocalGain",
  ] as const;
  return Object.fromEntries(numeric.map((key) => [key, sum(rows.map((row) => row[key]))]));
}

function summarizeAlternativeSelections(rows: Pair[]): any {
  const margins = rows.flatMap((row) => row.value.selectedGainMargins);
  const minimumCheckpointGains = rows.flatMap(
    (row) => row.value.selectedMinimumCheckpointGains,
  );
  const withStable = rows.filter((row) => row.value.stableAlternativeSelected > 0);
  const withLateFlip = rows.filter((row) => row.value.lateFlipAlternativeSelected > 0);
  return {
    selected_routes: margins.length,
    final_gain_margin: distribution(margins),
    minimum_checkpoint_gain: distribution(minimumCheckpointGains),
    stable_positive_routes: minimumCheckpointGains.filter((value) => value > 0).length,
    routes_with_nonpositive_earlier_checkpoint:
      minimumCheckpointGains.filter((value) => value <= 0).length,
    cells_with_stable_selection: summarizePairs(withStable),
    cells_with_late_flip_selection: summarizePairs(withLateFlip),
    interpretation:
      "A late flip wins at the equal-depth endpoint after being nonpositive at an earlier checkpoint. Cohorts can overlap when a run has multiple selections.",
  };
}

function meanWork(rows: WorkSummary[]): WorkSummary {
  const numeric = Object.keys(emptyWork()) as Array<keyof WorkSummary>;
  return Object.fromEntries(numeric.map((key) => {
    const values = rows.flatMap((row) => row[key] === null ? [] : [row[key] as number]);
    return [key, values.length === 0 ? null : mean(values)];
  })) as WorkSummary;
}

function subtractWork(candidate: WorkSummary, reference: WorkSummary): WorkSummary {
  const result = emptyWork();
  for (const key of Object.keys(result) as Array<keyof WorkSummary>) {
    const left = candidate[key];
    const right = reference[key];
    (result as any)[key] = left === null || right === null ? null : left - right;
  }
  return result;
}

function zeroWork(work: WorkSummary): boolean {
  return (Object.values(work) as Array<number | null>).every((value) => value === null || value === 0);
}

function associationTable(rows: Pair[]): any {
  const variables: Record<string, (row: Pair) => number> = {
    actions: (row) => row.value.actions,
    alternative_selected: (row) => row.value.alternativeSelected,
    probe_frames: (row) => row.value.probeFrames,
    positive_local_gain: (row) => row.value.positiveLocalGain,
    first_terminal_frames_delta: (row) => row.workDelta.firstTerminalFrames ?? 0,
    post_first_terminal_frames_delta: (row) => row.workDelta.postFirstTerminalFrames ?? 0,
    repair_frames_delta: (row) => row.workDelta.repairFrames,
    repair_attempts_delta: (row) => row.workDelta.repairAttempts,
    repair_accepted_delta: (row) => row.workDelta.repairAccepted,
    terminal_tracks_delta: (row) => row.workDelta.distinctTerminalTracks,
    candidate_samples_delta: (row) => row.workDelta.candidateSamples,
  };
  return Object.fromEntries(Object.entries(variables).map(([name, getter]) => {
    const x = rows.map(getter);
    const y = rows.map((row) => row.scoreDelta);
    const centeredX = centerWithinSource(rows, getter);
    const centeredY = centerWithinSource(rows, (row) => row.scoreDelta);
    return [name, {
      pearson: correlation(x, y),
      spearman: correlation(ranks(x), ranks(y)),
      source_centered_pearson: correlation(centeredX, centeredY),
    }];
  }));
}

function buildDirectObservations(
  pairs: Pair[],
  byOutcome: any,
  scoredDecision: any,
): any[] {
  const active = pairs.filter((pair) => pair.value.actions > 0);
  const sources = Object.entries(scoredDecision.by_source).sort(
    (a: any, b: any) => b[1].delta - a[1].delta,
  );
  return [
    {
      kind: "direct",
      statement: "Every cell with no admitted value action is exactly unchanged.",
      support: {
        cells: pairs.length - active.length,
        identical_track_score_and_work: pairs.length - active.length,
      },
    },
    {
      kind: "direct",
      statement: "All observed score movement is confined to cells where the new policy intervened.",
      support: {
        action_cells: active.length,
        action_cell_mean_delta: active.length === 0 ? null : mean(active.map((row) => row.scoreDelta)),
        action_cell_total_delta: sum(active.map((row) => row.scoreDelta)),
      },
    },
    {
      kind: "descriptive_cohort",
      statement: "Local route replacement and mere probing have separable terminal returns.",
      support: {
        action_without_alternative_selection: byOutcome.action_without_alternative_selection,
        alternative_selected: byOutcome.alternative_selected,
      },
    },
    {
      kind: "direct",
      statement: "The accepted aggregate contains heterogeneous stratum effects.",
      support: scoredDecision.by_stratum,
    },
    {
      kind: "direct",
      statement: "The strongest source gains and losses are explicit rather than hidden by the headline.",
      support: {
        strongest_gains: sources.slice(0, 5).map(([source, summary]) => ({ source, ...summary })),
        strongest_losses: sources.slice(-5).reverse().map(([source, summary]) => ({ source, ...summary })),
      },
    },
  ];
}

function printSummary(result: any): void {
  console.log("CANONICAL VALUE ATTRIBUTION");
  console.log(
    `${result.scope.cells} paired cells; accepted ${signed(result.evidence.accepted_delta, 4)}; ` +
      `${result.invariants.action_cells} action cells, ${result.invariants.no_action_cells} exact no-action identities`,
  );
  for (const [name, row] of Object.entries(result.by_action_outcome) as any) {
    console.log(
      `${name}: ${row.cells} cells, run mean ${row.cells === 0 ? "n/a" : signed(row.mean_score_delta, 4)}, ` +
        `${row.cells === 0 ? 0 : row.value.actions} actions`,
    );
  }
  console.log("authoritative scored strata:");
  for (const [name, row] of Object.entries(result.scored_decision.by_stratum) as any) {
    const telemetry = result.by_stratum[name];
    console.log(
      `  ${name}: ${signed(row.delta, 4)}, ${telemetry.active_cells}/${telemetry.cells} active, ` +
        `${telemetry.value.alternativeSelected}/${telemetry.value.actions} alternatives selected`,
    );
  }
}

function rowsByKey(rows: CompactRun[]): Map<string, CompactRun> {
  return new Map(rows.map((row) => [runKey(row), row]));
}

function runKey(row: any): string {
  const task = row.task ?? row.result?.task;
  return `${task.sourceId}/${task.budget}/${task.seedSlot}`;
}

function roleToStratum(role: string): string {
  const mapping: Record<string, string> = {
    representative_candidate: "representative",
    capability_candidate: "capability",
    regression_candidate: "legacy_regression",
    development_music_candidate: "development_music",
  };
  const stratum = mapping[role];
  if (stratum === undefined) throw new Error(`unknown benchmark role ${role}`);
  return stratum;
}

function actionBucket(actions: number): string {
  if (actions === 0) return "0";
  if (actions === 1) return "1";
  if (actions <= 3) return "2-3";
  return "4+";
}

function groupedSummary(
  rows: Pair[],
  key: (row: Pair) => string,
): Record<string, any> {
  return Object.fromEntries([...group(rows, key).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, values]) => [name, summarizePairs(values)]));
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const name = key(row);
    const bucket = result.get(name) ?? [];
    bucket.push(row);
    result.set(name, bucket);
  }
  return result;
}

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const name = key(row);
    result[name] = (result[name] ?? 0) + 1;
  }
  return result;
}

function centerWithinSource(rows: Pair[], getter: (row: Pair) => number): number[] {
  const means = new Map([...group(rows, (row) => row.sourceId)].map(([source, values]) => [
    source,
    mean(values.map(getter)),
  ]));
  return rows.map((row) => getter(row) - means.get(row.sourceId)!);
}

function ranks(values: number[]): number[] {
  const ordered = values.map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const result = new Array<number>(values.length);
  for (let start = 0; start < ordered.length;) {
    let end = start + 1;
    while (end < ordered.length && ordered[end]!.value === ordered[start]!.value) end++;
    const rank = (start + end - 1) / 2;
    for (let index = start; index < end; index++) result[ordered[index]!.index] = rank;
    start = end;
  }
  return result;
}

function correlation(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index++) {
    const x = left[index]! - leftMean;
    const y = right[index]! - rightMean;
    numerator += x * y;
    leftSquare += x * x;
    rightSquare += y * y;
  }
  const denominator = Math.sqrt(leftSquare * rightSquare);
  return denominator === 0 ? null : numerator / denominator;
}

function standardError(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  const variance = sum(values.map((value) => (value - average) ** 2)) / (values.length - 1);
  return Math.sqrt(variance / values.length);
}

function distribution(values: number[]): any {
  if (values.length === 0) return { count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    min: sorted[0],
    p10: quantile(sorted, 0.10),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.50),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.90),
    max: sorted[sorted.length - 1],
    mean: mean(values),
  };
}

function quantile(sorted: number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const fraction = position - lower;
  return sorted[lower]! * (1 - fraction) + sorted[upper]! * fraction;
}

function emptyValue(): ValueSummary {
  return {
    crossings: 0,
    admitted: 0,
    rankedOut: 0,
    progressExpired: 0,
    terminalReserveSuppressed: 0,
    explorationAllowanceSuppressed: 0,
    probeFrames: 0,
    actions: 0,
    reachedTarget: 0,
    alternativeSelected: 0,
    stableAlternativeSelected: 0,
    lateFlipAlternativeSelected: 0,
    currentSelected: 0,
    deadEnds: 0,
    budgetYields: 0,
    deferred: 0,
    otherOutcomes: 0,
    positiveLocalGain: 0,
    summedLocalGain: 0,
    firstActionProgress: null,
    firstActionDensity: null,
    selectedGainMargins: [],
    selectedMinimumCheckpointGains: [],
  };
}

function emptyWork(): WorkSummary {
  return {
    totalFrames: 0,
    firstTerminalFrames: 0,
    postFirstTerminalFrames: 0,
    repairFrames: 0,
    repairAttempts: 0,
    repairTerminalReached: 0,
    repairAccepted: 0,
    resumedFrames: 0,
    candidateSamples: 0,
    nodesExpanded: 0,
    terminalNodeEvaluations: 0,
    distinctTerminalTracks: 0,
    registerImprovements: 0,
    terminalRegisterImprovements: 0,
  };
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return sum(values) / values.length;
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function required(
  argument: (name: string) => string | undefined,
  name: string,
): string {
  const value = argument(name);
  if (value === undefined || value === "") {
    throw new Error(
      "usage: --candidate=ARCHIVE --reference=ARCHIVE --comparison=ARTIFACT [--out=JSON]",
    );
  }
  return value;
}

if (process.argv[1]?.endsWith("analyze_canonical_value_attribution.ts")) await main();
