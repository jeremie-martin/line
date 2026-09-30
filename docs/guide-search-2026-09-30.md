# Improving the accuracy–guidance tradeoff

The owner authorized improving both the search for arc alternatives and the
matched evaluation of those alternatives. This work keeps the frozen benchmark,
scorer, detector, normal-line physics, and geometry family unchanged. It adds no
artist-facing specification controls and does not treat fewer guides as a
universal aesthetic objective.

## Questions and evaluation plan

The existing exploration follows one complete track, choosing guide count before
accuracy at each fork. In its 204 recorded forks, that choice had worse RMS error
than the best available continuation 150 times; 102 choices worsened accuracy
relative to the source. All alternatives were retained for delivery, but only
one informed subsequent exploration. Of the 408 branch compilations, 82 reported
budget exhaustion. These observations motivate testing both better use of known
controls and a small frontier of different continuations.

Development uses the six existing gallery passages and previously exposed seeds
231/232. The first pilot compares the original traversal, source-control memory,
a two-path traversal retaining the most accurate and least-guided results, and
the combination. Every variant pays for its reference, both sides of every fork,
prefix checks and cold replays inside the same total physics allowance. Independent
fixed-judge observation is recorded separately; wall times on the shared host are
not controlled throughput measurements.

Before final evaluation, select and freeze promising implementations using only
development results. Evaluate on fresh search-jitter seeds 241–248, on all six
passages, at total allowances of 450,000 and 900,000 physics frames. These are
new random search perturbations on reused authored passages, not unseen musical
families. Preserve all attempts, including failures and regressions.

Compare the search portfolios in both directions:

- At a common absolute error ceiling (the baseline's best error plus the same
  fixed allowance), measure guide count, guide length and feasibility.
- At the same guide-count cap, measure best target error and feasibility.
- Separately report best accuracy, unchanged V4 adherence on these research
  passages, actual physics work and compile time.

Use fixed extra-error allowances 0, .005, .010, .020, .040 and .080, and guide-count
caps 0%, 25%, 50%, 75% and 100% of support sections (rounded down). Report missing
feasible choices explicitly; averages over mutually feasible comparisons include
their comparison counts. Comparing each method against its own best error plus
an allowance would change the absolute accuracy requirement and obscure losses.
No new aggregate benchmark score or categorical per-case gate is introduced.

The raw alternatives, unsuccessful experiments and validation artifacts remain
local under `generated/guide-search-20260930/`. Compact evidence and the final
interpretation will be committed with the implementation.

## Frozen candidate for the fresh-seed comparison

Development comprised staged experiments on seeds 231/232, all at 900,000 frames.
The independently reconstructed baseline reproduced all 108 seed-231 alternatives
exactly, including geometry hashes, target error and physics work.

Keeping only the most accurate and least-guided paths exposed a coverage problem
between those extremes. Supplying source controls directly at each continuation
improved some accurate tracks but worsened intermediate guide-count choices.
General source-control memory was also mixed. These remain explicit research
ablations; they are not enabled in the recommended candidate.

The candidate instead:

1. Builds a guided reference and an independently optimized guide-forbidden
   reference, each with the same quarter-budget ceiling (capped at 250,000).
2. Keeps the most accurate complete track and a second path offering the smallest
   measured RMS-error increase per removed guided section. If no track removes a
   guide relative to the accuracy winner, it uses the least-guided alternative.
3. Reconsiders all already measured tracks when selecting those two paths, so an
   intermediate alternative can become useful after the accuracy winner changes.
4. Searches both guide permissions from each selected physical prefix, with equal
   branch ceilings and all work charged to the original total allowance.

The ratio in step 2 is an exploration heuristic. Delivery still applies the same
explicit error ceiling and guide preference; no new scoring function is used.
Independent unguided references expand the measured range to zero guides in all
12 development case/seed combinations, versus 5/12 for the old traversal. The
candidate's best-error mean is 0.032813 versus 0.034161, and corresponding research
adherence is 877.745 versus 873.319. At baseline-best +0.020, mean guide count is
3.00 versus 3.75. At +0.010 it is unchanged at 4.833; the half-guide-cap RMS mean
is slightly worse on mutually feasible comparisons. This is a mixed improvement,
not dominance at every point of the tradeoff.

One compiler coupling was also removed: an explicitly disabled guide's nominal
clearance no longer changes the unguided initialization. A physical regression
check confirms identical tracks and work for channels 0 and 24 when guides are
forbidden. Guided production initialization remains identical.

Freeze this candidate before inspecting seeds 241–248. Compare the original
compiler at `9b824676`, this candidate, and the same candidate with source-control
memory as a declared diagnostic ablation. The candidate without memory is the
preselected recommendation: development memory improved best accuracy but caused
large losses in part of the intermediate guide-count range. Fresh-seed findings
will determine the strength and limits of the recommendation; they will not be
used to tune this implementation.
