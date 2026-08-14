/**
 * Descriptive attribution for paired benchmark cells.
 *
 * The benchmark's authored-impact aggregate remains the decision target. This
 * summary answers a different diagnostic question without silently changing
 * weights: did movement come from score changes where both arms completed, or
 * from discordant validity?
 */

export type PairedScoredOutcome = {
  reference: { score: number; valid: boolean };
  candidate: { score: number; valid: boolean };
};

export type PairedOutcomeSummary = {
  total_pairs: number;
  both_valid_pairs: number;
  reference_only_valid_pairs: number;
  candidate_only_valid_pairs: number;
  neither_valid_pairs: number;
  both_valid_score: {
    reference_mean: number | null;
    candidate_mean: number | null;
    sum_delta: number;
    mean_delta: number | null;
    improved_pairs: number;
    regressed_pairs: number;
    tied_pairs: number;
  };
  validity_discordant_score_sum_delta: number;
  neither_valid_score_sum_delta: number;
  overall_score_sum_delta: number;
};

export function summarizePairedOutcomes(
  pairs: readonly PairedScoredOutcome[],
): PairedOutcomeSummary {
  let bothValidPairs = 0;
  let referenceOnlyValidPairs = 0;
  let candidateOnlyValidPairs = 0;
  let neitherValidPairs = 0;
  let bothValidReferenceSum = 0;
  let bothValidCandidateSum = 0;
  let bothValidScoreSumDelta = 0;
  let validityDiscordantScoreSumDelta = 0;
  let neitherValidScoreSumDelta = 0;
  let overallScoreSumDelta = 0;
  let improvedPairs = 0;
  let regressedPairs = 0;
  let tiedPairs = 0;

  for (const pair of pairs) {
    const delta = pair.candidate.score - pair.reference.score;
    overallScoreSumDelta += delta;
    if (pair.reference.valid && pair.candidate.valid) {
      bothValidPairs++;
      bothValidReferenceSum += pair.reference.score;
      bothValidCandidateSum += pair.candidate.score;
      bothValidScoreSumDelta += delta;
      if (delta > 0) improvedPairs++;
      else if (delta < 0) regressedPairs++;
      else tiedPairs++;
    } else if (pair.reference.valid) {
      referenceOnlyValidPairs++;
      validityDiscordantScoreSumDelta += delta;
    } else if (pair.candidate.valid) {
      candidateOnlyValidPairs++;
      validityDiscordantScoreSumDelta += delta;
    } else {
      neitherValidPairs++;
      neitherValidScoreSumDelta += delta;
    }
  }

  return {
    total_pairs: pairs.length,
    both_valid_pairs: bothValidPairs,
    reference_only_valid_pairs: referenceOnlyValidPairs,
    candidate_only_valid_pairs: candidateOnlyValidPairs,
    neither_valid_pairs: neitherValidPairs,
    both_valid_score: {
      reference_mean: bothValidPairs === 0 ? null : bothValidReferenceSum / bothValidPairs,
      candidate_mean: bothValidPairs === 0 ? null : bothValidCandidateSum / bothValidPairs,
      sum_delta: bothValidScoreSumDelta,
      mean_delta: bothValidPairs === 0 ? null : bothValidScoreSumDelta / bothValidPairs,
      improved_pairs: improvedPairs,
      regressed_pairs: regressedPairs,
      tied_pairs: tiedPairs,
    },
    validity_discordant_score_sum_delta: validityDiscordantScoreSumDelta,
    neither_valid_score_sum_delta: neitherValidScoreSumDelta,
    overall_score_sum_delta: overallScoreSumDelta,
  };
}
