/**
 * golden.json embeds one budget-telemetry payload per checkpoint. The full
 * payload is ~2.7 KB per attempt, so the archive keeps a reduced form: whole
 * compile/model/segment account, per-attempt identity + counters + outcome, and
 * start/end estimates cut to point, interval and applicability.
 *
 * These tests pin the two properties that make the reduction safe: it never
 * invents a field the payload did not have, and it is marked as reduced so a
 * reader cannot mistake a stripped observation for a missing one.
 */

import { describe, expect, test } from "vitest";
import { compactBudgetTelemetry } from "../scripts/v0/golden.ts";
import type { CompileBudgetTelemetry } from "../scripts/v0/optimizer/budget_telemetry.ts";

const OBSERVATION = {
  event: "start",
  total_spent_frames: 10,
  hard_remaining_frames: 740,
  hard_overrun_frames: 0,
  attempt_spent_frames: 0,
  attempt_remaining_frames: 740,
  attempt_overrun_frames: 0,
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
  attempt_completion_margin: 1.97,
  attempt_completion_surplus_frames: 364,
};

const PAYLOAD = {
  schema: "line.compile-budget-telemetry.v1",
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
  },
  segments: [{
    kind: "startup",
    attempt_id: 0,
    start_total_spent_frames: 0,
    end_total_spent_frames: 10,
    spent_frames: 10,
    stop_reason: "search_ready",
  }],
  attempts: [{
    attempt_id: 0,
    kind: "initial",
    parent_attempt_id: null,
    search_seed: 0,
    has_fallback: false,
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
    local_budget_frames: 750,
    start: OBSERVATION,
    end: { ...OBSERVATION, event: "end", total_spent_frames: 750 },
    observations: [OBSERVATION, { ...OBSERVATION, event: "high_water" }, { ...OBSERVATION, event: "end" }],
    outcome: {
      stop_reason: "budget_capture",
      end_total_spent_frames: 750,
      spent_frames: 750,
      completed: true,
      first_terminal_offset_frames: 400,
      accepted_improvement: null,
      censored: false,
    },
  }],
} as unknown as CompileBudgetTelemetry;

type Archived = {
  archive_form: string;
  compile: object;
  segments: object[];
  attempts: Array<Record<string, unknown>>;
};

describe("golden archive form of budget telemetry", () => {
  test("keeps the compile account whole and marks itself as reduced", () => {
    const archived = compactBudgetTelemetry(PAYLOAD) as Archived;

    expect(archived.archive_form).toBe("observations_reduced");
    expect(archived.compile).toEqual(PAYLOAD.compile);
    expect(archived.segments).toEqual(PAYLOAD.segments);
    expect((archived as { model: object }).model).toEqual(PAYLOAD.model);
    expect((archived as { schema: string }).schema).toBe(PAYLOAD.schema);
  });

  test("keeps attempt identity, counters and outcome; drops the observation array", () => {
    const attempt = (compactBudgetTelemetry(PAYLOAD) as Archived).attempts[0];

    expect(attempt.attempt_id).toBe(0);
    expect(attempt.kind).toBe("initial");
    expect(attempt.anchor).toEqual(PAYLOAD.attempts[0].anchor);
    expect(attempt.ceiling_total_spent_frames).toBe(750);
    expect(attempt.local_budget_frames).toBe(750);
    expect(attempt.outcome).toEqual(PAYLOAD.attempts[0].outcome);
    expect(attempt).not.toHaveProperty("observations");
  });

  test("reduces start and end to point, interval, applicability and high-water gap", () => {
    const attempt = (compactBudgetTelemetry(PAYLOAD) as Archived).attempts[0];

    expect(attempt.start).toEqual({
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
    expect(attempt.end).toMatchObject({ event: "end", total_spent_frames: 750 });
  });

  test("omits absent fields instead of writing undefined or null holes", () => {
    const sparse = {
      schema: "line.compile-budget-telemetry.v1",
      attempts: [{ attempt_id: 0, start: { event: "start" }, end: null }],
    } as unknown as CompileBudgetTelemetry;

    const archived = compactBudgetTelemetry(sparse) as Archived;

    expect(archived).not.toHaveProperty("segments");
    expect(archived).not.toHaveProperty("model");
    expect(archived.attempts[0]).not.toHaveProperty("kind");
    expect(archived.attempts[0].start).toEqual({ event: "start" });
    expect(archived.attempts[0].end).toBeNull();
  });

  test("is materially smaller than the payload it archives", () => {
    const full = JSON.stringify(PAYLOAD, null, 2).length;
    const archived = JSON.stringify(compactBudgetTelemetry(PAYLOAD), null, 2).length;

    expect(archived).toBeLessThan(full / 2);
  });

  test("passes null through", () => {
    expect(compactBudgetTelemetry(null)).toBeNull();
  });
});
