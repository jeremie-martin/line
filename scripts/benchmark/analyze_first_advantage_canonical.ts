/**
 * Checksum-bound canonical attribution for Phase O's first-advantage handoff.
 *
 * The governed V2 look remains the only score decision. This reader validates
 * the intervention against raw telemetry and explains its mechanics without
 * loading either deep canonical archive into one giant string.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadVerifiedAnalysisArchive } from "../v0/benchmark_v2/analysis_archive.ts";

const CANDIDATE_POLICY =
  "selective_axis_regret_catchup_value_initial_expire_10_first_advantage_handoff";
const REFERENCE_POLICY = "selective_axis_regret_catchup_value_initial_expire_10";

type Handoff = {
  fromGap: number;
  checkpointGap: number;
  gain: number;
  probeFrames: number;
  selectedAt: number | null;
  resumedAt: number | null;
};

type Work = {
  totalFrames: number;
  firstTerminalFrames: number | null;
  initialFrames: number;
  valueProbeFrames: number;
  repairFrames: number;
  repairAttempts: number;
  repairTerminalReached: number;
  repairAccepted: number;
};

type CompactRun = {
  task: any;
  score: any;
  trackHash: string | null;
  policy: string | null;
  actions: number;
  handoffs: Handoff[];
  work: Work;
};

type Pair = {
  key: string;
  sourceId: string;
  seed: number;
  candidate: CompactRun;
  reference: CompactRun;
  delta: number;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const candidatePath = required(argument("candidate"), "candidate");
  const referencePaths = required(argument("reference"), "reference").split(",")
    .filter((value) => value.length > 0);
  const lookPath = required(argument("look"), "look");
  const outPath = argument("out");
  const look = JSON.parse(readFileSync(resolve(lookPath), "utf8"));
  const diagnostics = look.fixedLookDiagnostics;
  if (diagnostics?.outcomeAttribution === undefined) {
    throw new Error("look artifact has no outcome attribution");
  }

  const candidate = await loadVerifiedAnalysisArchive(candidatePath, {
    archive_sha256: look.candidateArchiveSha256,
    compressed_archive_sha256: look.candidateCompressedArchiveSha256,
  }, (raw, indexed) => projectRun(raw, indexed, true));
  const references = [];
  for (const referencePath of referencePaths) {
    references.push(await loadVerifiedAnalysisArchive(
      referencePath,
      undefined,
      (raw, indexed) => projectRun(raw, indexed, false),
    ));
  }
  const referenceByKey = rowsByKey(references.flatMap(
    (reference) => reference.archive.runs as CompactRun[],
  ));
  const pairs = (candidate.archive.runs as CompactRun[]).map((candidateRun): Pair => {
    const key = runKey(candidateRun);
    const referenceRun = referenceByKey.get(key);
    if (referenceRun === undefined) throw new Error(`reference is missing ${key}`);
    return {
      key,
      sourceId: candidateRun.task.sourceId,
      seed: candidateRun.task.actualSeed,
      candidate: candidateRun,
      reference: referenceRun,
      delta: candidateRun.score.score - referenceRun.score.score,
    };
  });
  if (pairs.length !== referenceByKey.size || pairs.length === 0) {
    throw new Error("candidate/reference canonical scopes differ");
  }

  const handoffs = pairs.flatMap((pair) => pair.candidate.handoffs);
  const inactive = pairs.filter((pair) => pair.candidate.handoffs.length === 0);
  const identityViolations = inactive.filter((pair) =>
    pair.candidate.trackHash !== pair.reference.trackHash || pair.delta !== 0
  );
  if (identityViolations.length > 0) {
    throw new Error(`${identityViolations[0]!.key}: no-handoff run changed`);
  }
  const candidateWork = totalWork(pairs.map((pair) => pair.candidate.work));
  const referenceWork = totalWork(pairs.map((pair) => pair.reference.work));
  const pairedFirstTerminalDeltas = pairs.flatMap((pair) =>
    pair.candidate.work.firstTerminalFrames === null ||
      pair.reference.work.firstTerminalFrames === null
      ? []
      : [pair.candidate.work.firstTerminalFrames - pair.reference.work.firstTerminalFrames]
  );
  const completed = pairs.filter((pair) =>
    pair.candidate.score.valid === true && pair.reference.score.valid === true
  );
  const failed = pairs.filter((pair) => pair.candidate.score.valid !== true).map((pair) => ({
    source_id: pair.sourceId,
    actual_seed: pair.seed,
    candidate_failures: pair.candidate.score.hardFailures,
    reference_score: pair.reference.score.score,
    handoffs: pair.candidate.handoffs,
  }));

  const result = {
    schema: "line.first-advantage-canonical-attribution.v1",
    generated_at: new Date().toISOString(),
    evidence: {
      candidate: candidate.path,
      candidate_archive_sha256: candidate.archiveSha256,
      candidate_artifact_sha256: candidate.artifactSha256,
      references: references.map((reference) => ({
        path: reference.path,
        archive_sha256: reference.archiveSha256,
        artifact_sha256: reference.artifactSha256,
      })),
      governed_look: resolve(lookPath),
      governed_depth: look.decision?.depth,
    },
    scope: {
      cells: pairs.length,
      sources: new Set(pairs.map((pair) => pair.sourceId)).size,
      seeds: new Set(pairs.map((pair) => pair.seed)).size,
      budgets: candidate.archive.identity?.budgets ?? candidate.archive.budgets,
    },
    governed_score: {
      headline: {
        reference: diagnostics.baseHeadline,
        candidate: diagnostics.candidateHeadline,
        delta: diagnostics.delta,
        confidence: diagnostics.confidence,
      },
      validity: diagnostics.validity,
      outcome_attribution: diagnostics.outcomeAttribution,
      interpretation:
        "The authored-impact headline and its both-valid counterfactual come verbatim from the governed look; telemetry cohorts below are descriptive only.",
    },
    invariants: {
      candidate_policy: CANDIDATE_POLICY,
      reference_policy: REFERENCE_POLICY,
      handoffs: handoffs.length,
      handoffs_selected_on_next_frontier_turn: handoffs.filter((row) => row.selectedAt !== null)
        .length,
      no_handoff_cells: inactive.length,
      no_handoff_track_and_score_identity: true,
    },
    handoff_behavior: {
      runs_with_handoff: pairs.length - inactive.length,
      sources_with_handoff: new Set(
        pairs.filter((pair) => pair.candidate.handoffs.length > 0).map((pair) => pair.sourceId),
      ).size,
      suspended_incumbents_resumed: handoffs.filter((row) => row.resumedAt !== null).length,
      suspended_incumbents_not_resumed: handoffs.filter((row) => row.resumedAt === null).length,
      gain: distribution(handoffs.map((row) => row.gain)),
      remaining_gaps_to_equal_depth: histogram(
        handoffs.map((row) => row.fromGap - row.checkpointGap),
      ),
    },
    work: {
      candidate: candidateWork,
      reference: referenceWork,
      delta: subtractWork(candidateWork, referenceWork),
      paired_first_terminal: {
        comparable_cells: pairedFirstTerminalDeltas.length,
        mean_delta_frames: meanOrNull(pairedFirstTerminalDeltas),
      },
    },
    descriptive_run_cohorts: {
      no_handoff: summarizePairs(inactive),
      one_or_two_handoffs: summarizePairs(pairs.filter((pair) =>
        pair.candidate.handoffs.length >= 1 && pair.candidate.handoffs.length <= 2
      )),
      three_to_five_handoffs: summarizePairs(pairs.filter((pair) =>
        pair.candidate.handoffs.length >= 3 && pair.candidate.handoffs.length <= 5
      )),
      six_or_more_handoffs: summarizePairs(pairs.filter((pair) =>
        pair.candidate.handoffs.length >= 6
      )),
      any_unresumed_handoff: summarizePairs(pairs.filter((pair) =>
        pair.candidate.handoffs.some((row) => row.resumedAt === null)
      )),
    },
    completed_pair_descriptive: summarizePairs(completed),
    failed_candidate_cells: failed,
    direct_observations: [
      {
        id: "fallback_is_rarely_exercised",
        statement:
          `${handoffs.filter((row) => row.resumedAt !== null).length}/${handoffs.length} ` +
          "suspended incumbents were later resumed; retaining a node is not the same as a bounded alternative trial.",
      },
      {
        id: "handoff_usually_preempts_one_remaining_comparison_gap",
        statement:
          `${handoffs.filter((row) => row.fromGap - row.checkpointGap === 1).length}/` +
          `${handoffs.length} handoffs occurred one gap before equal depth.`,
      },
      {
        id: "validity_and_completed_quality_are_separate",
        statement:
          "The governed both-valid counterfactual is reported separately from the validity-sensitive headline remainder.",
      },
    ],
    interpretation_limits: [
      "A handoff's local gain is not a counterfactual terminal-score label.",
      "Run cohorts are selected by post-admission execution and are descriptive, not promotion tests.",
      "No threshold or source rule may be fitted from these canonical outcomes.",
    ],
  };

  printResult(result);
  if (outPath !== undefined) {
    const absolute = resolve(outPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`analysis ${absolute}`);
  }
}

function projectRun(raw: any, indexed: any, candidate: boolean): CompactRun {
  const selective = raw.stats?.handoff_selective_backtracking;
  const expected = candidate ? CANDIDATE_POLICY : REFERENCE_POLICY;
  if (selective?.policy !== expected) {
    throw new Error(`${runKey(raw)}: expected ${expected}, got ${String(selective?.policy)}`);
  }
  const events = (selective.events ?? []).filter(
    (event: any) => event.trigger_signal === "value_exploration",
  );
  const handoffEvents = events.filter(
    (event: any) => event.catchup_outcome === "probe_first_advantage_handoff",
  );
  const handoffs = handoffEvents.map((event: any): Handoff => {
    const checkpoint = event.catchup_checkpoints?.[0];
    const probes = event.catchup_probe_results ?? [];
    if (
      !candidate || checkpoint === undefined || event.catchup_checkpoints.length !== 1 ||
      probes.length !== 1 || probes[0].outcome !== "probe_first_advantage_handoff" ||
      !(checkpoint.gap_index < event.from_gap_index) ||
      !(checkpoint.alternative_axis_loss_gain > 0) ||
      probes[0].end_gap_index !== checkpoint.gap_index ||
      probes[0].axis_loss !== checkpoint.alternative_axis_loss ||
      event.catchup_selected_alternative_ordinal !== 1 ||
      event.catchup_selected_route_ordinal !== 1
    ) throw new Error(`${runKey(raw)}: malformed first-advantage handoff`);
    const selectedAt = nullableFinite(event.first_advantage_handoff_total_spent_frames);
    if (selectedAt !== event.trigger_total_spent_frames + event.catchup_probe_frames) {
      throw new Error(`${runKey(raw)}: handoff did not receive the exact next frontier turn`);
    }
    return {
      fromGap: event.from_gap_index,
      checkpointGap: checkpoint.gap_index,
      gain: checkpoint.alternative_axis_loss_gain,
      probeFrames: event.catchup_probe_frames,
      selectedAt,
      resumedAt: nullableFinite(event.resumed_total_spent_frames),
    };
  });
  if (
    handoffs.length !== (selective.catchup_probe_first_advantage_handoffs ?? 0) ||
    handoffs.filter((row) => row.selectedAt !== null).length !==
      (selective.catchup_first_advantage_handoffs_selected ?? 0) ||
    events.length !== selective.value_live_admitted
  ) throw new Error(`${runKey(raw)}: action/handoff aggregate mismatch`);
  if (!candidate && handoffs.length !== 0) {
    throw new Error(`${runKey(raw)}: reference contains a first-advantage handoff`);
  }
  const episodes = raw.budgetTelemetry?.episodes ?? [];
  const repair = episodes.filter((episode: any) => episode.lane === "repair");
  return {
    ...indexed,
    trackHash: typeof raw.trackHash === "string" ? raw.trackHash : null,
    policy: selective.policy,
    actions: events.length,
    handoffs,
    work: {
      totalFrames: raw.stats?.sim_frames ?? 0,
      firstTerminalFrames:
        raw.budgetTelemetry?.compile?.first_terminal_total_spent_frames ?? null,
      initialFrames: sum((raw.budgetTelemetry?.execution_intervals ?? [])
        .filter((interval: any) => interval.kind === "initial_search")
        .map((interval: any) => interval.spent_frames)),
      valueProbeFrames: selective.value_live_probe_frames ?? 0,
      repairFrames: sum(repair.map((episode: any) => episode.outcome?.spent_frames ?? 0)),
      repairAttempts: repair.length,
      repairTerminalReached: repair.filter((episode: any) =>
        episode.outcome?.terminal_reached === true
      ).length,
      repairAccepted: repair.filter((episode: any) =>
        episode.outcome?.accepted_alternative === true
      ).length,
    },
  };
}

function summarizePairs(pairs: Pair[]): any {
  const deltas = pairs.map((pair) => pair.delta);
  return {
    cells: pairs.length,
    valid_pairs: pairs.filter((pair) =>
      pair.candidate.score.valid === true && pair.reference.score.valid === true
    ).length,
    sum_run_score_delta: sum(deltas),
    mean_run_score_delta: meanOrNull(deltas),
    better: deltas.filter((value) => value > 0).length,
    worse: deltas.filter((value) => value < 0).length,
    tied: deltas.filter((value) => value === 0).length,
  };
}

function totalWork(rows: Work[]): any {
  const first = rows.flatMap((row) =>
    row.firstTerminalFrames === null ? [] : [row.firstTerminalFrames]
  );
  return {
    totalFrames: sum(rows.map((row) => row.totalFrames)),
    meanFirstTerminalFrames: meanOrNull(first),
    initialFrames: sum(rows.map((row) => row.initialFrames)),
    valueProbeFrames: sum(rows.map((row) => row.valueProbeFrames)),
    repairFrames: sum(rows.map((row) => row.repairFrames)),
    repairAttempts: sum(rows.map((row) => row.repairAttempts)),
    repairTerminalReached: sum(rows.map((row) => row.repairTerminalReached)),
    repairAccepted: sum(rows.map((row) => row.repairAccepted)),
  };
}

function subtractWork(candidate: any, reference: any): any {
  return {
    totalFrames: candidate.totalFrames - reference.totalFrames,
    initialFrames: candidate.initialFrames - reference.initialFrames,
    valueProbeFrames: candidate.valueProbeFrames - reference.valueProbeFrames,
    repairFrames: candidate.repairFrames - reference.repairFrames,
    repairAttempts: candidate.repairAttempts - reference.repairAttempts,
    repairTerminalReached: candidate.repairTerminalReached - reference.repairTerminalReached,
    repairAccepted: candidate.repairAccepted - reference.repairAccepted,
  };
}

function distribution(values: number[]): any {
  const ordered = [...values].sort((a, b) => a - b);
  return {
    count: ordered.length,
    minimum: ordered[0] ?? null,
    p25: quantile(ordered, 0.25),
    median: quantile(ordered, 0.5),
    p75: quantile(ordered, 0.75),
    maximum: ordered.at(-1) ?? null,
    at_most_0_001: ordered.filter((value) => value <= 0.001).length,
    at_most_0_005: ordered.filter((value) => value <= 0.005).length,
    at_most_0_01: ordered.filter((value) => value <= 0.01).length,
  };
}

function histogram(values: number[]): Array<{ value: number; count: number }> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a - b).map(([value, count]) => ({ value, count }));
}

function rowsByKey(rows: CompactRun[]): Map<string, CompactRun> {
  const result = new Map<string, CompactRun>();
  for (const row of rows) {
    const key = runKey(row);
    if (result.has(key)) throw new Error(`duplicate run ${key}`);
    result.set(key, row);
  }
  return result;
}

function runKey(row: any): string {
  return `${row.task.sourceId}/${row.task.budget}/${row.task.actualSeed}`;
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(
      "usage: --candidate=ARCHIVE --reference=ARCHIVE[,ARCHIVE] --look=JSON [--out=JSON]",
    );
  }
  return value;
}

function nullableFinite(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`expected finite number or null, got ${String(value)}`);
  }
  return value;
}

function quantile(ordered: number[], p: number): number | null {
  if (ordered.length === 0) return null;
  return ordered[Math.floor((ordered.length - 1) * p)]!;
}

function sum(values: number[]): number { return values.reduce((a, b) => a + b, 0); }
function meanOrNull(values: number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}

function printResult(result: any): void {
  const score = result.governed_score;
  console.log(`FIRST-ADVANTAGE CANONICAL  N=${result.scope.seeds}`);
  console.log(
    `headline ${signed(score.headline.delta, 3)} +/- ` +
      `${score.headline.confidence.standardError.toFixed(3)} SE; ` +
      `both-valid ${signed(score.outcome_attribution.both_valid_counterfactual_headline_delta, 3)}`,
  );
  console.log(
    `handoffs ${result.invariants.handoffs}; resumed ` +
      `${result.handoff_behavior.suspended_incumbents_resumed}; ` +
      `one-gap ${result.handoff_behavior.remaining_gaps_to_equal_depth[0]?.count ?? 0}`,
  );
  console.log(
    `valid ${score.validity.candidateValid}/${score.validity.total}; ` +
      `probe frames ${signed(result.work.delta.valueProbeFrames, 0)}; ` +
      `repair attempts ${signed(result.work.delta.repairAttempts, 0)}`,
  );
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
