# Independent repair behavior audit

## Question

Does the production repair controller behave like the intended independent,
budget-aware mechanism, and does its actual use of repair work make sense?

This is distinct from asking whether the policy wins a benchmark. A controller
can be implemented correctly but choose low-value work; conversely, a noisy
score win does not prove that its decisions are sound.

## Declared behavior

For each repair iteration, production must:

1. read the current incumbent, hard budget remaining, and current cost profile;
2. price every target and parent depth from zero through four;
3. keep only anchors whose estimated upper completion cost fits the usable
   remaining budget;
4. select the worst affordable target, then its deepest affordable anchor;
5. run one independent suffix search to at most one terminal;
6. offer that terminal to the ordinary authored-impact register; and
7. discard iteration-local decision state and recompute after either acceptance
   or rejection.

The implementation is in `scripts/v0/optimizer/handoff.ts`. The retained
decision, work, register, geometry, and identity evidence is defined and
validated in `scripts/v0/optimizer/budget_telemetry.ts`. The independent audit
is `scripts/benchmark/analyze_repair_behavior.ts`.

## Evidence

- Candidate archive:
  `generated/benchmark-v2/scale/independent-repair-deepest-affordable-8.json`
- Behavioral artifact:
  `generated/benchmark-v2/scale/independent-repair-deepest-affordable-behavior-n8.{json,md}`
- Behavioral plots use the same prefix and the suffixes `.budget.svg`,
  `.iteration.svg`, and `.parent-depth.svg`; each has a SHA-256 sidecar.
- Governed paired comparison:
  `generated/benchmark-v2/scale/independent-repair-deepest-affordable-8.comparison.json`
- Retained reference:
  `generated/benchmark-v2/scale/repair-controller-v4-reference-16-current-scorer.json`
- Scope: eight specifications × eight budgets × eight shared seeds = 512 cells.

## Direct observations

### Decision and attribution integrity

- All 49,380 replayable invariant and attribution checks pass across 2,003
  repair iterations.
- All 2,003 target/anchor decisions replay exactly from the retained option set.
- Remaining-budget and headroom arithmetic, affordability, parent-to-anchor
  geometry, one-terminal execution, register adoption, score deltas, and fresh
  search seeds agree with their recorded outcomes.
- After acceptance, the next incumbent hash equals the accepted terminal-offer
  hash. After rejection, the next incumbent hash remains unchanged.
- No hidden ancestor fallback execution or cross-iteration failed-anchor state
  is required to explain any decision.

### Budget-aware anchor behavior

- 1,048/2,003 decisions use maximum parent depth four.
- The other 955 decisions go shallower because deeper structurally valid
  anchors exceed the remaining usable budget; the telemetry records 3,081 such
  rejected deeper options.
- Mean parent depth by iteration is 3.68, 3.19, 2.09, 1.35, and 0.83 for
  iterations zero through four. The anchor therefore moves later as repair
  budget is consumed, as designed.
- The first iteration contributes 1,508.60 of the total 2,377.92 internal-score
  gain. Depth-four iterations contribute 2,101.87. Expensive early repairs are
  doing most of the useful work rather than merely consuming most of the work.

### Completion and acceptance

- 1,973/2,003 iterations (98.50%) reach a terminal; 900 are accepted.
- 95.79% of reached terminals finish within the estimator's selected upper
  allocation. Thirty iterations are censored before a terminal.
- Accepted alternatives improve the selected weak gap 87.44% of the time.
  The 109 accepted alternatives that worsen that one gap still improve the
  global compiler register. This is expected: authored global impact is the
  optimization target, while the selected gap is an anchor-selection signal.

### Direct diversity

- 1,951 of 1,973 terminal-offer hashes are globally distinct.
- Only three offers repeat against the same incumbent and anchor, costing 8,455
  frames in total.
- Twenty-seven terminals are geometry-identical to their incumbent. All occur
  at parent depth zero and consume 143,020 frames, 0.044% of repair work. None
  is accepted.
- Of non-identical terminals, the first geometry change occurs at the selected
  anchor 96.71% of the time. A later first change is valid: the regenerated
  search may select the incumbent arc at the anchor and diverge downstream.

### Recomputed same-anchor decisions

- After a rejection, 196 next iterations independently select the same target
  and anchor. They are not duplicate traversals: 189 reach a terminal, only
  three repeat the exact prior offer, and 81 alternatives are accepted.
- These same-decision retries add 185.52 internal-score points. Their lower
  frame efficiency is associated with their earlier, longer suffixes and must
  not be interpreted as an isolated causal penalty.

## Paired policy associations

Relative to the retained reference over the same 512 cells, the candidate:

- uses 0.17% more repair frames;
- attempts 5.65% fewer repairs and accepts 5.56% fewer alternatives;
- selects parents 9.38% deeper and changes suffixes 6.53% longer;
- produces 1.35% less internal repair-score gain; and
- changes no validity outcome.

The scale headline is -0.0524 at the eight-seed look, with 36.35% directional
probability of improvement. The 750k slice is +0.3428. These estimates are
uncertain and the governed result says to continue to 16 seeds.

## Interpretation

The repair controller is behaving as designed. Its changed economy is visible
and internally coherent: almost the same repair budget buys fewer, deeper,
longer alternatives. The current uncertainty is policy value, not execution,
accounting, stale-incumbent use, accidental fallback, or duplicate-terminal
pathology.

The depth-zero identical terminals are real but economically negligible. The
evidence does not justify adding an incumbent-arc exclusion or alternative
cursor yet. Such an intervention should be reconsidered only if repeated
same-incumbent work becomes material under a later breadth or repair policy.

Across-budget changes remain deterministic policy associations. Budget also
changes the initial search and incumbent, so the sweep does not isolate repair
as a causal treatment. The final 16-seed paired comparison is the next score
decision; the behavioral audit remains valid independently of its outcome.
