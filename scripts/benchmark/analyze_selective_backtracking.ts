/**
 * Offline counterfactuals for bounded selective-backtracking catch-ups.
 *
 * One behavior-neutral compile archive records like-for-like loss checkpoints
 * along every alternative probe. This tool replays a grid of simple stopping
 * rules over those observations. It does not claim the unexecuted continuation
 * score; it answers the narrower questions we can know exactly:
 *
 *   - how many full-tournament decisions would an early sign have contradicted?
 *   - how much already-measured probe work lay after that sign?
 *   - how stable was the sign at different contact advances?
 *
 * A rule is only a design lead. A compiler arm must still run the real paired
 * cells, because saved work changes subsequent frontier and repair behavior.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readVerifiedArtifact } from "./study_lib.ts";
import {
  summarizeSelectiveTriggerOpportunities,
  type SelectiveTriggerOpportunityRun,
} from "./selective_trigger_opportunities.ts";

type Outcome =
  | "alternative_selected"
  | "current_selected"
  | "probe_dead_end"
  | "probe_deferred"
  | "execution_ceiling";

type Checkpoint = {
  alternative_ordinal?: number;
  gap_index: number;
  contact_advance: number;
  probe_nodes_processed: number;
  probe_frames: number;
  current_axis_loss: number;
  alternative_axis_loss: number;
  alternative_axis_loss_gain: number;
};

type Event = {
  sourceId: string;
  seed: number;
  from_gap_index: number;
  catchup_outcome: Outcome;
  catchup_probe_frames: number;
  alternative_conservative_deadline_margin: number;
  catchup_alternatives_requested: number;
  catchup_selected_alternative_ordinal: number | null;
  catchup_probe_results: ProbeResult[];
  catchup_checkpoints: Checkpoint[];
};

type ProbeResult = {
  alternative_ordinal: number;
  outcome: "reached_target" | "probe_dead_end" | "probe_deferred" | "execution_ceiling";
  end_gap_index: number;
  probe_nodes_processed: number;
  probe_frames: number;
  axis_loss: number | null;
};

type RuleMode = "reject_alternative" | "accept_alternative";

type RuleResult = {
  mode: RuleMode;
  earliest_contact_advance: number;
  minimum_axis_loss_advantage: number;
  actions: number;
  aligned_actions: number;
  contradictory_actions: number;
  contradiction_rate: number | null;
  measured_probe_frames_after_action: number;
  mean_measured_frames_after_action: number | null;
  affected_sources: string[];
};

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const archivePath = argument("archive");
if (archivePath === undefined) {
  throw new Error(`usage: --archive=<scale-study.json[.gz]> [--out=<analysis.json>]`);
}

const verified = readVerifiedArtifact(resolve(archivePath));
const archive = JSON.parse(verified.bytes.toString("utf8"));
const events: Event[] = [];
const triggerRuns: SelectiveTriggerOpportunityRun[] = [];
for (const row of archive.runs ?? []) {
  const stats = row.stats?.handoff_selective_backtracking;
  validateTournamentTelemetry(stats, `${row.task.sourceId}/seed-${row.task.actualSeed}`);
  if (stats?.regret_opportunities_by_min_axis_loss_delta !== undefined) {
    triggerRuns.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      stats,
    });
  }
  for (const event of stats?.events ?? []) {
    if (event.catchup_outcome === null) continue;
    events.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      from_gap_index: event.from_gap_index,
      catchup_outcome: event.catchup_outcome,
      catchup_probe_frames: event.catchup_probe_frames,
      alternative_conservative_deadline_margin:
        event.alternative_conservative_deadline_margin,
      catchup_alternatives_requested: event.catchup_alternatives_requested ?? 1,
      catchup_selected_alternative_ordinal:
        event.catchup_selected_alternative_ordinal ?? null,
      catchup_probe_results: event.catchup_probe_results ?? [],
      catchup_checkpoints: event.catchup_checkpoints ?? [],
    });
  }
}

const earliestAdvances = [2, 3, 4, 5, 6, 8];
const advantages = [0, 0.0025, 0.005, 0.01, 0.02, 0.03, 0.05];
// A checkpoint rule predicts one alternative's eventual binary disposition.
// Multi-sibling tournaments contain several checkpoint streams and one final
// winner, so feeding them through the old rule would silently change meaning.
const guardEvents = events.filter((event) => event.catchup_alternatives_requested === 1);
const rules = (["reject_alternative", "accept_alternative"] as const).flatMap((mode) =>
  earliestAdvances.flatMap((earliest) => advantages.map((advantage) =>
    evaluateRule(guardEvents, mode, earliest, advantage)
  ))
);
const zeroContradiction = rules
  .filter((rule) => rule.actions > 0 && rule.contradictory_actions === 0)
  .sort(ruleOrder);
const exploratory = rules
  .filter((rule) => rule.actions > 0)
  .sort((a, b) =>
    a.contradiction_rate! - b.contradiction_rate! || ruleOrder(a, b)
  );

const completedTournaments = events.filter((event) =>
  event.catchup_outcome === "alternative_selected" || event.catchup_outcome === "current_selected"
);
const guardCompleted = guardEvents.filter((event) =>
  event.catchup_outcome === "alternative_selected" || event.catchup_outcome === "current_selected"
);
const stability = earliestAdvances.map((advance) => {
  let observed = 0;
  let signMatchesFinal = 0;
  let alternativeSigns = 0;
  for (const event of guardCompleted) {
    const checkpoint = checkpointAt(event, advance);
    if (checkpoint === undefined) continue;
    observed++;
    const predictsAlternative = checkpoint.alternative_axis_loss_gain > 0;
    if (predictsAlternative) alternativeSigns++;
    if (predictsAlternative === (event.catchup_outcome === "alternative_selected")) {
      signMatchesFinal++;
    }
  }
  return {
    contact_advance: advance,
    observed,
    alternative_signs: alternativeSigns,
    sign_matches_final: signMatchesFinal,
    agreement_rate: observed === 0 ? null : signMatchesFinal / observed,
  };
});

const byOutcome = Object.fromEntries(
  [...new Set(events.map((event) => event.catchup_outcome))].sort().map((outcome) => [
    outcome,
    events.filter((event) => event.catchup_outcome === outcome).length,
  ]),
);
const bySource = [...new Set(events.map((event) => event.sourceId))].sort().map((sourceId) => {
  const sourceEvents = events.filter((event) => event.sourceId === sourceId);
  return {
    source_id: sourceId,
    events: sourceEvents.length,
    probe_frames: sourceEvents.reduce((sum, event) => sum + event.catchup_probe_frames, 0),
    outcomes: Object.fromEntries(
      [...new Set(sourceEvents.map((event) => event.catchup_outcome))].sort().map((outcome) => [
        outcome,
        sourceEvents.filter((event) => event.catchup_outcome === outcome).length,
      ]),
    ),
  };
}).sort((a, b) => b.events - a.events || a.source_id.localeCompare(b.source_id));

const admissionMarginCounterfactuals = [2, 2.1, 2.2, 2.25, 2.3, 2.4, 2.5].map(
  (minimumMargin) => {
    const suppressed = events.filter(
      (event) => event.alternative_conservative_deadline_margin < minimumMargin,
    );
    const countOutcome = (outcome: Outcome): number =>
      suppressed.filter((event) => event.catchup_outcome === outcome).length;
    return {
      minimum_conservative_margin: minimumMargin,
      suppressed_events: suppressed.length,
      suppressed_alternative_selected: countOutcome("alternative_selected"),
      suppressed_current_selected: countOutcome("current_selected"),
      suppressed_probe_dead_ends: countOutcome("probe_dead_end"),
      suppressed_probe_deferred: countOutcome("probe_deferred"),
      suppressed_execution_ceiling: countOutcome("execution_ceiling"),
      measured_probe_frames_in_suppressed_events: suppressed.reduce(
        (sum, event) => sum + event.catchup_probe_frames,
        0,
      ),
      affected_sources: [...new Set(suppressed.map((event) => event.sourceId))].sort(),
    };
  },
);

const multiSiblingEvents = events.filter((event) => event.catchup_alternatives_requested > 1);
const multiSiblingProbes = multiSiblingEvents.flatMap((event) => event.catchup_probe_results);
const multiSiblingSummary = {
  tournaments: multiSiblingEvents.length,
  probes: multiSiblingProbes.length,
  target_reaches: multiSiblingProbes.filter((probe) => probe.outcome === "reached_target").length,
  dead_ends: multiSiblingProbes.filter((probe) => probe.outcome === "probe_dead_end").length,
  deferred: multiSiblingProbes.filter((probe) => probe.outcome === "probe_deferred").length,
  execution_ceiling: multiSiblingProbes.filter((probe) => probe.outcome === "execution_ceiling").length,
  current_selected: multiSiblingEvents.filter(
    (event) => event.catchup_outcome === "current_selected",
  ).length,
  any_alternative_selected: multiSiblingEvents.filter(
    (event) => event.catchup_outcome === "alternative_selected",
  ).length,
  additional_alternative_selected: multiSiblingEvents.filter(
    (event) => (event.catchup_selected_alternative_ordinal ?? 0) > 1,
  ).length,
  probe_frames: multiSiblingEvents.reduce((sum, event) => sum + event.catchup_probe_frames, 0),
};

const result = {
  schema: "line.selective-backtracking-offline-guard-analysis.v1",
  source_archive: archivePath,
  source_archive_sha256: verified.artifactSha256,
  scope: {
    runs: archive.runs?.length ?? 0,
    events: events.length,
    events_with_checkpoints: events.filter((event) => event.catchup_checkpoints.length > 0).length,
    single_alternative_events_for_checkpoint_rules: guardEvents.length,
    completed_tournaments: completedTournaments.length,
    single_alternative_completed_tournaments_for_checkpoint_rules: guardCompleted.length,
    outcomes: byOutcome,
  },
  by_source: bySource,
  multi_sibling: multiSiblingSummary,
  admission_margin_counterfactuals: admissionMarginCounterfactuals,
  trigger_opportunities: triggerRuns.length === 0 ? null : {
    coverage: {
      archive_runs: archive.runs?.length ?? 0,
      telemetry_runs: triggerRuns.length,
    },
    ...summarizeSelectiveTriggerOpportunities(triggerRuns),
  },
  checkpoint_sign_stability: stability,
  zero_contradiction_rules: zeroContradiction,
  exploratory_rules: exploratory,
  caveat:
    "Offline rules classify the observed full-tournament winner and measured remaining probe work only. " +
    "They do not estimate the score or later frontier/repair effects of actually stopping early. " +
    "Admission-margin rows likewise describe observed tournaments; they are not causal replay. " +
    "Checkpoint rules exclude multi-sibling tournaments because their winner label is not binary.",
};

function validateTournamentTelemetry(stats: any, runKey: string): void {
  if (stats === undefined || !Array.isArray(stats.events)) return;
  const instrumented = stats.events.filter(
    (event: any) => Array.isArray(event.catchup_probe_results),
  );
  if (instrumented.length === 0) return;
  const probes: ProbeResult[] = [];
  for (let eventIndex = 0; eventIndex < instrumented.length; eventIndex++) {
    const event = instrumented[eventIndex];
    const label = `${runKey}/event-${eventIndex}`;
    const requested = event.catchup_alternatives_requested;
    if (!Number.isSafeInteger(requested) || requested < 1) {
      throw new Error(`${label} has invalid catchup_alternatives_requested`);
    }
    const results = event.catchup_probe_results as ProbeResult[];
    if (event.catchup_outcome !== null && results.length === 0) {
      throw new Error(`${label} completed without a probe result`);
    }
    const ordinals = new Set<number>();
    for (const probe of results) {
      if (
        !Number.isSafeInteger(probe.alternative_ordinal) ||
        probe.alternative_ordinal < 1 ||
        probe.alternative_ordinal > requested ||
        ordinals.has(probe.alternative_ordinal)
      ) {
        throw new Error(`${label} has invalid or duplicate probe ordinal`);
      }
      ordinals.add(probe.alternative_ordinal);
      probes.push(probe);
    }
    const nodes = results.reduce((sum, probe) => sum + probe.probe_nodes_processed, 0);
    const frames = results.reduce((sum, probe) => sum + probe.probe_frames, 0);
    if (nodes !== event.catchup_probe_nodes_processed || frames !== event.catchup_probe_frames) {
      throw new Error(`${label} probe aggregates disagree with probe_results`);
    }
    const reached = results.filter((probe) => probe.outcome === "reached_target");
    const bestAlternativeLoss = reached.length === 0
      ? null
      : Math.min(...reached.map((probe) => probe.axis_loss as number));
    if (!sameNullableNumber(bestAlternativeLoss, event.catchup_axis_loss)) {
      throw new Error(`${label} best alternative loss disagrees with probe_results`);
    }
    const selected = event.catchup_selected_alternative_ordinal ?? null;
    if (event.catchup_outcome === "alternative_selected") {
      const selectedProbe = reached.find((probe) => probe.alternative_ordinal === selected);
      if (selectedProbe === undefined || !(selectedProbe.axis_loss! < event.trigger_axis_loss)) {
        throw new Error(`${label} selected alternative is not a strict completed winner`);
      }
      if (selectedProbe.axis_loss !== bestAlternativeLoss) {
        throw new Error(`${label} did not select the lowest-loss alternative`);
      }
    } else if (selected !== null) {
      throw new Error(`${label} non-alternative outcome names a selected alternative`);
    } else if (
      event.catchup_outcome === "current_selected" &&
      bestAlternativeLoss !== null &&
      event.trigger_axis_loss > bestAlternativeLoss
    ) {
      throw new Error(`${label} retained current despite a lower-loss completed alternative`);
    }
    for (const checkpoint of event.catchup_checkpoints ?? []) {
      const ordinal = checkpoint.alternative_ordinal ?? 1;
      if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > requested) {
        throw new Error(`${label} checkpoint has invalid alternative ordinal`);
      }
    }
  }

  const count = (outcome: ProbeResult["outcome"]): number =>
    probes.filter((probe) => probe.outcome === outcome).length;
  const assertStat = (name: string, expected: number): void => {
    if (stats[name] !== expected) {
      throw new Error(`${runKey} ${name}=${stats[name]} disagrees with event total ${expected}`);
    }
  };
  assertStat("catchup_probe_attempts", probes.length);
  assertStat("catchup_probe_target_reaches", count("reached_target"));
  assertStat(
    "catchup_additional_probe_attempts",
    probes.filter((probe) => probe.alternative_ordinal > 1).length,
  );
  assertStat(
    "catchup_additional_probe_target_reaches",
    probes.filter(
      (probe) => probe.alternative_ordinal > 1 && probe.outcome === "reached_target",
    ).length,
  );
  assertStat(
    "catchup_tournaments_with_additional_probe",
    instrumented.filter((event: any) => event.catchup_probe_results.length > 1).length,
  );
  assertStat(
    "catchup_additional_alternative_selected",
    instrumented.filter((event: any) =>
      (event.catchup_selected_alternative_ordinal ?? 0) > 1
    ).length,
  );
  assertStat("catchup_probe_dead_ends", count("probe_dead_end"));
  assertStat("catchup_probe_deferred", count("probe_deferred"));
  assertStat("catchup_execution_ceiling_stops", count("execution_ceiling"));
  assertStat(
    "catchup_probe_nodes_processed",
    probes.reduce((sum, probe) => sum + probe.probe_nodes_processed, 0),
  );
  assertStat("catchup_probe_frames", probes.reduce((sum, probe) => sum + probe.probe_frames, 0));
}

function sameNullableNumber(left: number | null, right: unknown): boolean {
  return left === null ? right === null : typeof right === "number" && Math.abs(left - right) < 1e-12;
}

print(result);
const out = argument("out");
if (out !== undefined) {
  const absolute = resolve(out);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nanalysis ${absolute}`);
}

function checkpointAt(event: Event, earliest: number): Checkpoint | undefined {
  return event.catchup_checkpoints.find((checkpoint) =>
    checkpoint.contact_advance >= earliest &&
    checkpoint.gap_index < event.from_gap_index &&
    checkpoint.probe_frames < event.catchup_probe_frames
  );
}

function evaluateRule(
  sourceEvents: Event[],
  mode: RuleMode,
  earliest: number,
  advantage: number,
): RuleResult {
  let actions = 0;
  let aligned = 0;
  let contradictory = 0;
  let frames = 0;
  const sources = new Set<string>();
  for (const event of sourceEvents) {
    const checkpoint = event.catchup_checkpoints.find((candidate) => {
      if (
        candidate.contact_advance < earliest ||
        candidate.gap_index >= event.from_gap_index ||
        candidate.probe_frames >= event.catchup_probe_frames
      ) return false;
      return mode === "reject_alternative"
        ? candidate.alternative_axis_loss_gain <= -advantage
        : candidate.alternative_axis_loss_gain >= advantage;
    });
    if (checkpoint === undefined) continue;
    actions++;
    sources.add(event.sourceId);
    const agrees = mode === "reject_alternative"
      ? event.catchup_outcome !== "alternative_selected"
      : event.catchup_outcome === "alternative_selected";
    if (agrees) aligned++;
    else contradictory++;
    frames += Math.max(0, event.catchup_probe_frames - checkpoint.probe_frames);
  }
  return {
    mode,
    earliest_contact_advance: earliest,
    minimum_axis_loss_advantage: advantage,
    actions,
    aligned_actions: aligned,
    contradictory_actions: contradictory,
    contradiction_rate: actions === 0 ? null : contradictory / actions,
    measured_probe_frames_after_action: frames,
    mean_measured_frames_after_action: actions === 0 ? null : frames / actions,
    affected_sources: [...sources].sort(),
  };
}

function ruleOrder(a: RuleResult, b: RuleResult): number {
  return b.measured_probe_frames_after_action - a.measured_probe_frames_after_action ||
    b.actions - a.actions ||
    a.earliest_contact_advance - b.earliest_contact_advance ||
    a.minimum_axis_loss_advantage - b.minimum_axis_loss_advantage ||
    a.mode.localeCompare(b.mode);
}

function print(analysis: typeof result): void {
  console.log(`SELECTIVE BACKTRACKING OFFLINE GUARD ANALYSIS`);
  console.log(
    `  ${analysis.scope.runs} runs; ${analysis.scope.events} events; ` +
    `${analysis.scope.events_with_checkpoints} with checkpoints; ` +
    `${analysis.scope.completed_tournaments} completed tournaments`,
  );
  console.log(`  outcomes ${JSON.stringify(analysis.scope.outcomes)}`);
  if (analysis.multi_sibling.tournaments > 0) {
    console.log(
      `  multi-sibling ${analysis.multi_sibling.tournaments} tournaments; ` +
      `${analysis.multi_sibling.probes} probes; ` +
      `${analysis.multi_sibling.additional_alternative_selected} selected sibling #2+`,
    );
  }
  console.log(`\nCONSERVATIVE-MARGIN ADMISSION COUNTERFACTUALS`);
  for (const row of analysis.admission_margin_counterfactuals) {
    console.log(
      `  margin ${row.minimum_conservative_margin.toFixed(2)}: suppress ` +
      `${String(row.suppressed_events).padStart(3)} events; alternative/current/other ` +
      `${row.suppressed_alternative_selected}/${row.suppressed_current_selected}/` +
      `${row.suppressed_probe_dead_ends + row.suppressed_probe_deferred +
        row.suppressed_execution_ceiling}; measured frames ` +
      `${String(row.measured_probe_frames_in_suppressed_events).padStart(9)}`,
    );
  }
  if (analysis.trigger_opportunities !== null) {
    console.log(`\nTRIGGER OPPORTUNITIES (PRODUCTION TRAVERSAL)`);
    console.log(
      `  telemetry coverage ${analysis.trigger_opportunities.coverage.telemetry_runs}/` +
      `${analysis.trigger_opportunities.coverage.archive_runs} runs`,
    );
    for (const row of analysis.trigger_opportunities.thresholds) {
      console.log(
        `  delta ${row.min_axis_loss_delta.toFixed(2)}: crossed ${String(row.crossed_watches).padStart(4)}, ` +
        `admissible ${String(row.admissible_watches).padStart(4)}, ` +
        `additional vs 0.20 ${String(row.additional_admissible_vs_production).padStart(4)}; ` +
        `${row.runs_with_admissible_watch} runs / ${row.sources_with_admissible_watch} sources`,
      );
    }
    console.log(`  leading sources at 0.15:`);
    for (const row of analysis.trigger_opportunities.by_source
      .filter((entry) => entry.thresholds["0.15"]!.additional_admissible_vs_production > 0)
      .slice(0, 12)) {
      const threshold = row.thresholds["0.15"]!;
      console.log(
        `    ${row.source_id.padEnd(56)} ` +
        `admissible ${String(threshold.admissible_watches).padStart(4)}, ` +
        `additional ${String(threshold.additional_admissible_vs_production).padStart(4)}, ` +
        `runs ${threshold.runs_with_admissible_watch}/${row.runs}`,
      );
    }
  }
  console.log(`\nCHECKPOINT SIGN VS FULL-DEPTH WINNER`);
  for (const row of analysis.checkpoint_sign_stability) {
    console.log(
      `  advance ${String(row.contact_advance).padStart(2)}: ${String(row.observed).padStart(4)} observed; ` +
      `${row.agreement_rate === null ? "-" : `${(100 * row.agreement_rate).toFixed(1)}%`} agreement`,
    );
  }
  console.log(`\nBEST ZERO-CONTRADICTION RULES`);
  for (const rule of analysis.zero_contradiction_rules.slice(0, 12)) printRule(rule);
  console.log(`\nLOWEST-CONTRADICTION EXPLORATORY RULES`);
  for (const rule of analysis.exploratory_rules.slice(0, 12)) printRule(rule);
  console.log(`\n  ${analysis.caveat}`);
}

function printRule(rule: RuleResult): void {
  console.log(
    `  ${rule.mode.padEnd(18)} after ${String(rule.earliest_contact_advance).padStart(2)} ` +
    `margin ${rule.minimum_axis_loss_advantage.toFixed(4)}: actions ${String(rule.actions).padStart(4)}, ` +
    `contradictions ${String(rule.contradictory_actions).padStart(3)}, ` +
    `measured tail ${String(Math.round(rule.measured_probe_frames_after_action)).padStart(9)} frames`,
  );
}
