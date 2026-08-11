# Repair efficiency campaign

## Foundation decision

The independent, budget-aware repair controller is the production foundation
for this campaign. It is promoted for its verified semantics, clean
architecture, and useful across-budget behavior. Its N=16 score comparison was
inconclusive, so this decision is deliberately not recorded as a canonical
benchmark `ACCEPT`.

The machine-readable decision is
`benchmark/v2/studies/repair-controller-foundation.json`. The reusable scale
reference is
`generated/benchmark-v2/scale/independent-repair-foundation-16.json`. A
self-comparison over all 1,024 cells is exactly zero and preserves 989/1,024
valid outcomes in both arms.

## Why optimize from here

The controller's correctness and diversity questions are settled well enough
to move the campaign's uncertainty from mechanism to allocation:

- iteration zero produces 3,559.27 of 5,235.02 internal-score points at 12.61
  points per million repair frames;
- efficiency falls to 5.52, 4.06, 3.61, and 2.09 over iterations one through
  four;
- repair consumes 49.53% of charged work at 4M while averaging only 4.88
  iterations per run, because later repairs rebuild long suffixes; and
- incumbent-identical and exact repeated-terminal work is negligible, so a
  duplicate-suppression mechanism is not the primary opportunity.

These are direct measurements or deterministic associations, not proof that a
particular replacement allocation will improve authored impact. In particular,
stopping a later repair is useful only if the resumed ordinary frontier spends
the released budget more effectively.

## Objective and constraints

The optimization target remains authored impact under each declared hard
budget. The feasibility bound remains diagnostic. A candidate must preserve:

1. the full contact/survival contract and validity outcomes;
2. one independent anchor decision and at most one terminal per repair
   iteration;
3. exact budget, incumbent, register, divergence, and attribution telemetry;
4. deterministic behavior for a fixed specification, seed, and budget; and
5. clean recomputation from the current incumbent after every result.

The scale headline is the primary comparison. Per-budget score, validity,
repair gain, repair work, resumed-frontier work, estimator coverage, anchor
depth, suffix length, and accepted alternatives explain the result; they do not
replace it.

## First experiment: three-iteration allocation bracket

The first candidate changes allocation only: cap independent repair at three
iterations, then give any remaining hard budget to the existing
remainder-aware ordinary-frontier resume. It uses the existing declared
`LR_REPAIR_MAX_ATTEMPTS=3` compiler environment, so the frozen foundation and
candidate have explicit, distinct identities without adding a permanent
experimental mode.

This is a diagnostic, not a foregone policy choice. It tests the concrete
counterfactual left open by the audit: whether iterations three and later beat
the work that can resume in their place. The governed progression is N=4, then
N=8 only if the score/mechanics evidence is coherent, and N=16 only for a
predeclared retained candidate. Reading the foundation's N=16 result does not
turn a later exploratory arm into an `ACCEPT`.

## Natural follow-ups

If the cap loses, retain unrestricted repair and study allocation without
cross-iteration exclusion state:

1. a continuous minimum-affordable-suffix/value threshold that can decline
   naturally with remaining budget;
2. target-anchor value per estimated cost, validated against authored global
   gain rather than selected-gap SSE alone; and
3. breadth re-evaluation under the promoted controller, because breadth data
   from the removed repair economy is not authoritative.

Every retained follow-up begins from the foundation record above and receives
a new identity and paired scale artifact.

## Progress

### Three-iteration allocation bracket — rejected at N=4

The complete 256-cell look prefers the unrestricted foundation:

- scale delta -0.1986, with 0.69% directional probability of improvement;
- 750k delta -0.0488;
- identical validity, 246/256 in each arm; and
- every one of 17,040 repair invariant/attribution checks passed.

The mechanism moved work exactly as intended. Relative to the foundation it
removed 289 repairs and 15.81M repair frames. Resumed-frontier work gained
13.00M frames, 4,026 terminal offers, and 22 register improvements, but only
1.93 internal-score points. The removed repair work contained 126 register
improvements and 51.51 internal-score points. The net internal loss closely
matches the paired headline loss.

Conclusion: late repair is inefficient only relative to early repair; it is
still substantially more valuable than the existing resumed frontier. A hard
iteration cap is rejected and will not advance to N=8.

### Next bracket — maximum affordable parent depth

The next bounded question follows the strongest retained signal rather than
the rejected cap: parent depth four is both the current ceiling and the most
frame-efficient observed depth, while 51.2% of foundation decisions hit that
ceiling. Compare maximum depth six at N=4. Affordability remains the hard gate,
so low-budget decisions that cannot fund a deeper suffix remain unchanged.
This is one boundary-extension diagnostic, not an open-ended depth sweep.
