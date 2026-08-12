/**
 * golden.json embeds one budget-telemetry payload per checkpoint. The full
 * payload carries trace observations and node events, so the archive keeps a
 * reduced form: whole compile/model/interval account, per-episode identity,
 * work funnel, register lineage and outcome, and
 * start/end estimates cut to point, interval and applicability.
 *
 * These tests pin the two properties that make the reduction safe: it never
 * invents a field the payload did not have, and it is marked as reduced so a
 * reader cannot mistake a stripped observation for a missing one.
 */

import { describe, expect, test } from "vitest";
import { compactBudgetTelemetry } from "../scripts/v0/golden.ts";
import {
  BUDGET_TELEMETRY_SCHEMA,
  type CompileBudgetTelemetry,
} from "../scripts/v0/optimizer/budget_telemetry.ts";

const OBSERVATION = {
  event: "start",
  total_spent_frames: 10,
  hard_remaining_frames: 740,
  hard_overrun_frames: 0,
  episode_spent_frames: 0,
  episode_remaining_frames: 740,
  episode_overrun_frames: 0,
  high_water: {
    gap_index: 3,
    anchor_frame: 77,
    remaining_gaps: 5,
    remaining_contacts: 4,
    remaining_duration_frames: 123,
  },
  structural_startup_included: true,
  estimator_applicability: "calibrated",
  structural_progress_fraction: 0.25,
  structural_work_prior_frames: 500,
  incumbent_path_work_estimate_frames: 400,
  episode_pace_work_estimate_frames: 450,
  estimated_remaining_work_frames: 376,
  estimate_lower_frames: 300,
  estimate_upper_frames: 450,
  estimate_uncertainty_frames: 75,
  hard_completion_margin: 1.97,
  hard_completion_surplus_frames: 364,
  episode_completion_margin: 1.97,
  episode_completion_surplus_frames: 364,
};

const WORK = {
  ranked_option_calls: 2,
  requested_normal_proposals: 80,
  actual_candidate_samples: 77,
  viable_candidates: 30,
  candidate_samples_by_stream: { normal: 77 },
  by_evaluation_origin: {
    frontier: { register_offers: 3, terminal_node_evaluations: 2, register_improvements: 2, terminal_register_improvements: 1 },
    tail_completion: { register_offers: 0, terminal_node_evaluations: 0, register_improvements: 0, terminal_register_improvements: 0 },
    polish: { register_offers: 0, terminal_node_evaluations: 0, register_improvements: 0, terminal_register_improvements: 0 },
  },
  nodes_processed: 4,
  nodes_expanded: 3,
  children_enqueued: 8,
  register_offers: 3,
  partial_node_evaluations: 1,
  terminal_node_evaluations: 2,
  first_time_terminal_node_evaluations: 2,
  revisited_terminal_node_evaluations: 0,
  distinct_terminal_tracks: 2,
  repeated_terminal_track_evaluations: 0,
  register_improvements: 2,
  terminal_register_improvements: 1,
};

const PAYLOAD = {
  schema: BUDGET_TELEMETRY_SCHEMA,
  level: "trace",
  model: { traversal_model: "m", traversal_source: "s", estimator_model: "e", estimator_fingerprint: "f", calibrated: true },
  compile: {
    hard_budget_frames: 750,
    policy_budget_frames: 750,
    total_spent_frames: 750,
    hard_remaining_frames: 0,
    hard_overrun_frames: 0,
    budget_exhausted: true,
    initial_structural_work_prior_frames: 500,
    initial_structural_slack: 1.5,
    work: WORK,
  },
  execution_intervals: [{
    kind: "startup",
    episode_id: 0,
    start_total_spent_frames: 0,
    end_total_spent_frames: 10,
    spent_frames: 10,
    stop_reason: "search_ready",
  }],
  episodes: [{
    episode_id: 0,
    lane: "initial",
    parent_episode_id: null,
    search_seed: 0,
    frontier_has_fallback_lane: false,
    repair_decision: null,
    anchor: {
      gap_index: 0,
      anchor_frame: 0,
      remaining_gaps: 8,
      remaining_contacts: 7,
      remaining_duration_frames: 200,
    },
    start_total_spent_frames: 0,
    ceiling_total_spent_frames: 750,
    available_hard_budget_frames: 750,
    allocated_frames: 750,
    work: WORK,
    register_key_at_start: null,
    register_key_at_end: {
      contract_passed: true,
      axis_quality: 0.9,
      internal_full_score: 900,
      drift_quality: 0.8,
    },
    start: OBSERVATION,
    end: { ...OBSERVATION, event: "end", total_spent_frames: 750 },
    observations: [OBSERVATION, { ...OBSERVATION, event: "high_water" }, { ...OBSERVATION, event: "end" }],
    outcome: {
      stop_reason: "budget_capture",
      end_total_spent_frames: 750,
      spent_frames: 750,
      terminal_reached: true,
      first_terminal_offset_frames: 400,
      register_improved: true,
      accepted_alternative: false,
      first_register_improvement_offset_frames: 20,
      final_register_improvement_offset_frames: 400,
      first_terminal_register_improvement_offset_frames: 400,
      internal_full_score_delta: null,
      working_to_offer_divergence: null,
      rejected_local_improvement_followup: "not_rejected_local_improvement",
      terminal_observation_censored: false,
    },
  }],
} as unknown as CompileBudgetTelemetry;

type Archived = {
  archive_form: string;
  compile: object;
  execution_intervals: object[];
  episodes: Array<Record<string, unknown>>;
};

describe("golden archive form of budget telemetry", () => {
  test("keeps the compile account whole and marks itself as reduced", () => {
    const archived = compactBudgetTelemetry(PAYLOAD) as Archived;

    expect(archived.archive_form).toBe("observations_reduced");
    expect(archived.compile).toEqual(PAYLOAD.compile);
    expect(archived.execution_intervals).toEqual(PAYLOAD.execution_intervals);
    expect((archived as { model: object }).model).toEqual(PAYLOAD.model);
    expect((archived as { schema: string }).schema).toBe(PAYLOAD.schema);
  });

  test("keeps episode identity, work, lineage and outcome; drops the observation array", () => {
    const episode = (compactBudgetTelemetry(PAYLOAD) as Archived).episodes[0];

    expect(episode.episode_id).toBe(0);
    expect(episode.lane).toBe("initial");
    expect(episode.anchor).toEqual(PAYLOAD.episodes[0].anchor);
    expect(episode.ceiling_total_spent_frames).toBe(750);
    expect(episode.allocated_frames).toBe(750);
    expect(episode.work).toEqual(WORK);
    expect(episode.register_key_at_end).toEqual(PAYLOAD.episodes[0].register_key_at_end);
    expect(episode.outcome).toEqual(PAYLOAD.episodes[0].outcome);
    expect(episode).not.toHaveProperty("observations");
  });

  test("reduces start and end to point, interval, applicability and high-water gap", () => {
    const episode = (compactBudgetTelemetry(PAYLOAD) as Archived).episodes[0];

    expect(episode.start).toEqual({
      event: "start",
      total_spent_frames: 10,
      // The analyzer's per-observation hard-budget identity needs these two.
      hard_remaining_frames: 740,
      hard_overrun_frames: 0,
      estimated_remaining_work_frames: 376,
      estimate_lower_frames: 300,
      estimate_upper_frames: 450,
      estimator_applicability: "calibrated",
      high_water: { gap_index: 3 },
    });
    expect(episode.end).toMatchObject({ event: "end", total_spent_frames: 750 });
  });

  test("fails closed on old or structurally incomplete payloads", () => {
    expect(() => compactBudgetTelemetry({
      schema: "line.compile-budget-telemetry.v2",
      episodes: [],
      execution_intervals: [],
    } as unknown as CompileBudgetTelemetry)).toThrow(/expected line\.compile-budget-telemetry\.v8/);
    expect(() => compactBudgetTelemetry({
      schema: BUDGET_TELEMETRY_SCHEMA,
      episodes: [],
    } as unknown as CompileBudgetTelemetry)).toThrow(/requires complete V7/);
  });

  test("is materially smaller than the payload it archives", () => {
    const full = JSON.stringify(PAYLOAD, null, 2).length;
    const archived = JSON.stringify(compactBudgetTelemetry(PAYLOAD), null, 2).length;

    expect(archived).toBeLessThan(full * 0.6);
  });

  test("passes null through", () => {
    expect(compactBudgetTelemetry(null)).toBeNull();
  });
});
