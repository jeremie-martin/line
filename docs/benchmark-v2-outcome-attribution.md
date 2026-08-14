# Benchmark V2 Outcome Attribution

Benchmark V2 keeps one optimization and decision target: the authored-impact
headline. Reports additionally separate *why* a paired comparison moved.

Every paired cell belongs to exactly one outcome class:

- both valid: both tracks satisfy the full contract;
- reference-only valid: a lost completion;
- candidate-only valid: a gained completion;
- neither valid.

For both-valid cells, reports give the score sum and mean delta plus counts that
improved, regressed, or tied. Mover-grid and multi-budget reports also expose
the raw score contribution of validity-discordant and neither-valid cells.

Canonical V2 adds a weight-preserving counterfactual. Wherever a pair is not
valid in both arms, the candidate score is replaced by its paired baseline
score; no row is dropped. V2 then recomputes the exact nested headline and the
same seed-block uncertainty on that neutralized panel. Reports call this the
`both_valid_counterfactual_headline_delta`. The overall headline minus that quantity is
the `validity_sensitive_headline_remainder`; because V2 uses nonlinear shifted
geometric aggregation, this remainder also contains the validity interaction
with that aggregate.

This is diagnostic attribution only. It must not become an alternate acceptance
rule, silently remove hard cases, cap authored intent, or renormalize the suite.
It exists so a global regression caused by worse completed tracks is not
confused with one caused by lost completions—and so a promising quality change
with an isolated fragility is visible rather than hand-waved away.

The calibrated decision implementation remains byte-identical. Attribution is
attached after its governed verdict, from the same paired rows.
