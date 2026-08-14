import { describe, expect, test } from "vitest";
import { summarizePairedOutcomes } from "../scripts/benchmark/paired_outcomes.ts";

describe("paired outcome attribution", () => {
  test("separates completed-track quality from validity movement", () => {
    const summary = summarizePairedOutcomes([
      { reference: { score: 100, valid: true }, candidate: { score: 105, valid: true } },
      { reference: { score: 100, valid: true }, candidate: { score: 96, valid: true } },
      { reference: { score: 80, valid: true }, candidate: { score: 0, valid: false } },
      { reference: { score: 0, valid: false }, candidate: { score: 70, valid: true } },
      { reference: { score: 0, valid: false }, candidate: { score: 0, valid: false } },
    ]);
    expect(summary).toEqual({
      total_pairs: 5,
      both_valid_pairs: 2,
      reference_only_valid_pairs: 1,
      candidate_only_valid_pairs: 1,
      neither_valid_pairs: 1,
      both_valid_score: {
        reference_mean: 100,
        candidate_mean: 100.5,
        sum_delta: 1,
        mean_delta: 0.5,
        improved_pairs: 1,
        regressed_pairs: 1,
        tied_pairs: 0,
      },
      validity_discordant_score_sum_delta: -10,
      neither_valid_score_sum_delta: 0,
      overall_score_sum_delta: -9,
    });
  });

  test("does not invent a conditional mean when no pair is valid in both arms", () => {
    const summary = summarizePairedOutcomes([
      { reference: { score: 0, valid: false }, candidate: { score: 5, valid: true } },
    ]);
    expect(summary.both_valid_score.reference_mean).toBeNull();
    expect(summary.both_valid_score.candidate_mean).toBeNull();
    expect(summary.both_valid_score.mean_delta).toBeNull();
  });
});
