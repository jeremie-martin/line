# TODO / parked ideas

## ⚠️ HUGE TODO: restore `opening_burst` once fragile chains are hardened

Status: **opening_burst is temporarily EXCLUDED from the headline benchmark**
(removed from `GOLDEN_SPECS` in `scripts/v0/golden_suite.ts`, from the workbench
`--specs` in `GOAL_LDS_ARC_PLACEMENT.md`, and from the assertion in
`tests/v0_golden_config.test.ts`).

Why: opening_burst is the suite's lone catastrophically-fragile spec. Its
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

Status: parked. Current decision is that the **last-budget mean score** alone is
probably good enough as the optimization metric (150k for the normal diagnostic,
100k for the fast loop). This note records a refinement to revisit if mean-last
turns out to under-reward high-ceiling approaches.

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
