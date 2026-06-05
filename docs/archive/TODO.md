> **ARCHIVED** — historical record, not live guidance. Live docs: [`docs/README.md`](../README.md). The one still-open item (`opening_burst` chain-hardening) now lives in [`FOCUS_FRAGILE_SPECS.md`](../../FOCUS_FRAGILE_SPECS.md).

# TODO / parked ideas

## `opening_burst`: RESTORED to the suite; chain-hardening still open

Status: **RESTORED 2026-06-04** to `GOLDEN_SPECS` and the `tests/v0_golden_config.ts`
assertion. The reason it was excluded (a bimodal valid↔all-missing coin-flip that
dragged a fused mean) is now handled honestly by the new metric: validity is a
separate ceiling-focused guardrail (not fused into a bimodal mean), the 8-seed
paired bootstrap averages out the seed-luck, and the headline is ceiling-weighted.
The underlying robustness work below is still open but no longer blocks inclusion.

Why it was fragile: opening_burst is the suite's lone catastrophically-fragile spec. Its
required-contact chain has a knife-edge forward dependency — under the tiniest
placement perturbation it flips from fully valid to ~all-contacts-missing (a
560→0 score swing), and WHICH seed breaks moves randomly run to run (s21, then
s1, then s2…). A valid opening_burst run is therefore essentially luck, not a
signal of placement quality; keeping it in the scored mean makes the benchmark a
coin-flip right next to the improvements we are trying to measure, and masks real
per-axis progress on the other specs.

This is NOT "the spec is wrong" — it is "the compiler is not yet robust to
fragile forward-dependency chains." The fix is chain-aware candidate selection /
multi-gap rollout in the handoff so a locally-cheap catch that dooms a contact two
gaps later is rejected — search/scheduler territory, OUTSIDE the arc-placement
boundary. When that lands and opening_burst is reliably valid across seeds, put it
back in all three places above.

## Metric: reward "score is still climbing (did not plateau)", not just mean-last

Status: **IMPLEMENTED 2026-06-04** (this note is kept for rationale). The headline
metric is now `HEADLINE = α·q(b_max) + (1−α)·logAUC` (α=0.7) in `scripts/v0/metric.ts`:
the ceiling term `q(b_max)` is "how high it gets" and the log-AUC term rewards
monotone diminishing-returns conversion — so a slow-but-higher-ceiling approach is
no longer ranked below an early plateau (the failure this note feared). Decisions use
a paired cluster-bootstrap CI (`analyze_golden_curve.ts decide`), and validity is a
separate ceiling-focused guardrail. The "still-climbing as a guard on where to
measure" idea below is partially realized; the full usage-weighted-budget refinement
is the remaining open piece. Full context: `docs/metric_problem_statement.md`.

Original note (rationale, pre-implementation):

### The idea

Optimize not only the mean score at the last budget, but also reward the fact that
the score is *still climbing* there (i.e. the approach has not plateaued, so it
likely has untapped ceiling). Motivation: the default `impact_anchor` placement is
hard-plateaued (flat from ~60k), while the `continuous` line placement keeps
climbing to a much higher ceiling — and we don't want a metric that treats
"plateaued at X" and "still climbing through X" as equal.

### Why NOT a naive `mean_last + λ·slope` reward

Rewarding a positive final slope **perversely rewards slow convergence**: an
approach is "still climbing at the cutoff" precisely *because* it is slow. A slow
placement that reached 450-and-rising could then outscore a fast one that reached
500-and-flat. That fights the secondary goal (converge faster) and recreates the
same metric artifact that made `CURVE_SCORE` misleading.

### Cleaner formulation if we pick this up

What we actually want is the **ceiling** (asymptotic mean as budget grows).
"Still climbing" only means the measurement budget is before the knee. So:

- Keep ONE primary number: the mean at a budget *past the knee*.
- Treat "still climbing" as a **guard on where to measure**, not a reward term:
  - `headroom = mean@last − mean@(last − 20k)`.
  - `headroom ≈ 0` ⇒ converged ⇒ trust the last-budget mean as the ceiling.
  - `headroom` clearly positive ⇒ cutoff is before the knee ⇒ extend the budget
    and re-measure before claiming a ceiling (or before declaring a rival
    "plateaued").
- Convergence speed stays a separate, opposing secondary objective (reach the same
  ceiling at lower budget).

Observed 2026-06-03 (seeds 0/1/2): default normal headroom `+0.6` (plateaued),
`continuous` normal `+2.2` (converged by ~110k), `continuous` fast@100k `+129`
(still climbing — 100k is before its knee on the dense fast specs, so fast@100k is
a lower bound on its fast ceiling).

### Optional tooling if revisited

Add a `headroom` readout to `scripts/v0/analyze_golden_curve.ts` (last-budget mean
minus the previous-checkpoint mean) so convergence is visible every run.
