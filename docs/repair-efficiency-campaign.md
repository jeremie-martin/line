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

The bounded depth-six extension is accepted by the scale decision protocol at
N=8. It stopped at the first decisive look; no optional N=16 sampling was used.

- scale headline 571.1644 versus 570.6516, delta +0.5128;
- 99.5397% directional probability versus the predeclared 99.1667% boundary;
- 750k delta +0.3746;
- identical validity, 495/512 in each arm, with no gains or losses; and
- 47,944 repair decision, budget, lineage, diversity, and attribution checks
  across 1,947 repair episodes, with zero violations.

The score result is mechanically credible. Of 1,918 terminal alternatives,
1,902 were globally distinct and only 16 were incumbent-identical; none of the
identical alternatives was accepted and they consumed 0.026% of repair work.
Depths five and six produced no incumbent-identical terminals. The first
divergence occurred at the selected anchor in 95.0% of divergent terminals.

Depth six is therefore the production default. The separate canonical 750k
qualification subsequently reached `ACCEPT` at its N=32 stopping look:

- canonical headline 602.4958 to 602.9306, delta +0.4348;
- 99.20% directional probability versus the 98.88% N=32 boundary;
- one-sided lower bound +0.0164; and
- identical validity, 1,408/1,408 in both arms.

The accepted archive was promoted as campaign baseline
`independent-repair-depth-six`. No N=48 rows were sampled after the N=32 accept
boundary. The scale and canonical decisions, exact identities, behavior audit,
and evidence hashes are bound in
`benchmark/v2/studies/repair-depth-six-promotion.json`.

### Value-aware anchor runway — rejected at N=8

After promotion of the distilled aim-impact controller and a fresh breadth
revisit, the campaign tested whether repair should always restart as early as
affordability permits. The candidate retained the same worst gap, but priced
each affordable parent by direct anchor-to-target SSE plus one target-arrival
opportunity per regenerated parent transition, divided by estimated frames.
Offline replay deliberately selected a sparse arm: only 139/3,839 historical
decisions changed, all toward later anchors.

The live mechanism behaved exactly as intended but did not improve authored
impact:

- N=8 scale headline 579.5054 versus 579.5092, delta -0.0038;
- identical validity, 497/512 in each arm;
- first-terminal frames exactly unchanged;
- mean repair depth -4.3% and mean attempt cost -2.6%;
- repair episodes +4.6% and accepted alternatives +2.6%; but
- aggregate internal repair gain -0.12%.

Seven of eight budget deltas were neutral-to-negative. The 4M cell mean was
positive by only +0.043 points, too small and isolated to retain. The result
answers the causal question: cheaper later restarts buy more terminals, but the
lost parent runway is worth approximately the saved work. The production
deepest-affordable selector remains unchanged. Exact decision semantics,
score, mechanics, invariants, and evidence hashes are recorded in
`benchmark/v2/studies/repair-runway-opportunity-selector.json`.

### Aim-base breadth phase isolation — declared

The promoted distilled proposer reopened the mature aim-base breadth question.
The first arm changes the exponent globally from 1 to 0.875 while retaining the
K=6 anchor at 250k. It is a mechanism experiment, not a candidate-count fit:
the arm measures whether fewer expensive local refinements reach the first
terminal earlier and convert the saved work into useful independent repairs.

If the global arm loses while exhibiting that mechanism, one and only one
phase-isolation follow-up is declared. It applies the same 0.875 law only while
`repairLaneActive` is true. Initial search and the ordinary resumed frontier
remain exactly exponent 1, so first-terminal work and the first incumbent must
be byte-identical. The repair arm asks whether probe savings themselves are
useful after removing the global arm's incumbent-quality confound.

Both arms use the frozen 4/8/16 multi-budget looks, paired source-budget-seed
cells, unchanged validity, and V3 repair mechanics. No canonical run follows a
negative scale result. The repair-only arm is not permission to tune another
exponent: 0.875 is inherited unchanged from the global bracket. The subsequent
anchor-allocation question is conditional on this result; a failed breadth arm
does not reopen already-rejected cheap/later restart selectors.
