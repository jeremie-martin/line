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

type Outcome =
  | "alternative_selected"
  | "current_selected"
  | "probe_dead_end"
  | "probe_deferred"
  | "execution_ceiling";

type Checkpoint = {
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
  catchup_checkpoints: Checkpoint[];
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
for (const row of archive.runs ?? []) {
  const stats = row.stats?.handoff_selective_backtracking;
  for (const event of stats?.events ?? []) {
    if (event.catchup_outcome === null) continue;
    events.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      from_gap_index: event.from_gap_index,
      catchup_outcome: event.catchup_outcome,
      catchup_probe_frames: event.catchup_probe_frames,
      catchup_checkpoints: event.catchup_checkpoints ?? [],
    });
  }
}

const earliestAdvances = [2, 3, 4, 5, 6, 8];
const advantages = [0, 0.0025, 0.005, 0.01, 0.02, 0.03, 0.05];
const rules = (["reject_alternative", "accept_alternative"] as const).flatMap((mode) =>
  earliestAdvances.flatMap((earliest) => advantages.map((advantage) =>
    evaluateRule(events, mode, earliest, advantage)
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

const completed = events.filter((event) =>
  event.catchup_outcome === "alternative_selected" || event.catchup_outcome === "current_selected"
);
const stability = earliestAdvances.map((advance) => {
  let observed = 0;
  let signMatchesFinal = 0;
  let alternativeSigns = 0;
  for (const event of completed) {
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

const result = {
  schema: "line.selective-backtracking-offline-guard-analysis.v1",
  source_archive: archivePath,
  source_archive_sha256: verified.artifactSha256,
  scope: {
    runs: archive.runs?.length ?? 0,
    events: events.length,
    events_with_checkpoints: events.filter((event) => event.catchup_checkpoints.length > 0).length,
    completed_tournaments: completed.length,
    outcomes: byOutcome,
  },
  by_source: bySource,
  checkpoint_sign_stability: stability,
  zero_contradiction_rules: zeroContradiction,
  exploratory_rules: exploratory,
  caveat:
    "Offline rules classify the observed full-tournament winner and measured remaining probe work only. " +
    "They do not estimate the score or later frontier/repair effects of actually stopping early.",
};

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
