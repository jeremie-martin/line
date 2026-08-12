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
  `generated/benchmark-v2/scale/independent-repair-deepest-affordable-16.json`
- Recovery/audit checkpoint:
  `generated/benchmark-v2/scale/independent-repair-deepest-affordable-16.json.checkpoint.jsonl`
- Behavioral artifact:
  `generated/benchmark-v2/scale/independent-repair-deepest-affordable-behavior-n16.{json,md}`
- Behavioral plots use the same prefix and the suffixes `.budget.svg`,
  `.iteration.svg`, and `.parent-depth.svg`; each has a SHA-256 sidecar.
- Governed paired comparison:
  `generated/benchmark-v2/scale/independent-repair-deepest-affordable-16.comparison.json`
- Retained reference:
  `generated/benchmark-v2/scale/repair-controller-v4-reference-16-current-scorer.json`
- Scope: eight specifications × eight budgets × sixteen shared seeds = 1,024
  paired cells.

## Direct observations

### Decision and attribution integrity

- All 97,976 replayable invariant and attribution checks pass across 3,974
  repair iterations.
- All 3,974 target/anchor decisions replay exactly from the retained option set.
- Remaining-budget and headroom arithmetic, affordability, parent-to-anchor
  geometry, one-terminal execution, register adoption, score deltas, and fresh
  search seeds agree with their recorded outcomes.
- After acceptance, the next incumbent hash equals the accepted terminal-offer
  hash. After rejection, the next incumbent hash remains unchanged.
- No hidden ancestor fallback execution or cross-iteration failed-anchor state
  is required to explain any decision.

### Budget-aware anchor behavior

- 2,035/3,974 decisions use maximum parent depth four.
- The other 1,939 decisions go shallower because deeper structurally valid
  anchors exceed the remaining usable budget; the telemetry records 6,278 such
  rejected deeper options.
- Mean parent depth by iteration is 3.66, 3.13, 2.06, 1.27, and 0.76 for
  iterations zero through four. The anchor therefore moves later as repair
  budget is consumed, as designed.
- The first iteration contributes 3,559.27 of the total 5,235.02 internal-score
  gain. Depth-four iterations contribute 4,668.54. Expensive early repairs are
  doing most of the useful work rather than merely consuming most of the work.

### Completion and acceptance

- 3,919/3,974 iterations (98.62%) reach a terminal; 1,765 are accepted.
- 95.64% of reached terminals finish within the estimator's selected upper
  allocation. Fifty-five iterations are censored before a terminal.
- Accepted alternatives improve the selected weak gap 88.10% of the time.
  The 198 accepted alternatives that worsen that one gap still improve the
  global compiler register. This is expected: authored global impact is the
  optimization target, while the selected gap is an anchor-selection signal.

### Behavior across hard budgets

- Repair iterations rise from 2.05 per run at 150k to 4.88 at 4M, while repair
  work rises from 12.86% to 49.53% of charged work.
- The mean completed repair costs 9,653 frames at 150k and 417,409 frames at
  4M. Higher budgets buy substantially earlier/longer suffix searches rather
  than a proportional explosion in repair count.
- Mean remaining suffix size at the anchor rises from 9.11 gaps at 150k to
  26.16 at 4M. This is the intended reason the iteration count grows slowly
  even though much more budget is assigned to repair.
- Internal-score gain per million repair frames falls from 115.05 at 150k to
  2.20 at 4M. This is a deterministic association with stronger initial
  incumbents, longer suffixes, and score saturation; it is not an isolated
  causal estimate of budget waste.

### Direct diversity

- 3,881 of 3,919 terminal-offer hashes are globally distinct.
- Only four offers repeat against the same incumbent and anchor, costing 9,813
  frames in total.
- Forty-eight terminals are geometry-identical to their incumbent. All occur
  at parent depth zero and consume 241,499 frames, 0.038% of repair work. None
  is accepted.
- Of non-identical terminals, the first geometry change occurs at the selected
  anchor 96.49% of the time. A later first change is valid: the regenerated
  search may select the incumbent arc at the anchor and diverge downstream.

### Recomputed same-anchor decisions

- After a rejection, 373 next iterations independently select the same target
  and anchor. They are not duplicate traversals: 363 reach a terminal, only
  four repeat the exact prior offer, and 150 alternatives are accepted.
- These same-decision retries add 336.55 internal-score points. Their lower
  frame efficiency is associated with their earlier, longer suffixes and must
  not be interpreted as an isolated causal penalty.

## Paired policy associations

Relative to the retained reference over the same 1,024 cells, the candidate:

- uses 0.19% more repair frames;
- attempts 5.20% fewer repairs and accepts 4.85% fewer alternatives;
- selects parents 8.19% deeper and changes suffixes 6.13% longer;
- produces 0.55% more internal repair-score gain, at 1.88% lower gain per
  million repair frames; and
- changes no validity outcome.

The final scale headline is +0.0316, with 62.94% directional probability of
improvement. The 750k slice is +0.2904. The governed 16-seed result is
inconclusive: the behavior change is approximately score-neutral at this
resolution, not established as a benchmark improvement.

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
as a causal treatment. The behavioral conclusions are direct execution facts;
the score comparison remains uncertain and should not be overstated.

## Large-evidence reliability

The 1,024-cell trace archive is approximately 992 MiB. Its first finalization
attempt reached all cells but exceeded V8's single-string limit while building
one monolithic JSON string. No compiler evidence was lost: the checksummed
JSONL checkpoint retained all cells. The scale writer and checkpoint reader now
stream records, the comparison consumes a checksummed compact analysis
projection, and full-archive verification hashes bytes incrementally. This is
an evidence-tooling correction, not a compiler-policy change.

Trace workers also no longer retain completed result objects while later cells
are running. Each result is durably appended to the checkpoint, only its task
key remains live, and the complete rows are reloaded after all workers exit for
scoring and streaming finalization. A resumed target checkpoint does not reload
its already-imported source prefix. This removes the memory growth observed at
972/1,024 cells in the late-repair anchor-reserve study while preserving the
checkpoint and archive formats. A 44-cell fresh/resume runner smoke test
reproduced the same score and validity summary and passed both raw and gzip
checksum verification.
