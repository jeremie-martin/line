# Empirical study: budget → quality, wall-clock, monotonicity, overshoot

Methodical investigation of the LDS compiler under the
budget axis. 13 specs × 5 seeds × 10 budget levels = 650 planned
cells, 502 actually collected (77% coverage; large specs hit the
90-minute timeout). Budget axis: log-spaced from 50k to 12M
sim_frames. Greedy_v1 baseline overlaid for reference.

Raw data: `/tmp/study_budget/*.json` (one file per spec).
Analysis: `/tmp/analyze_study.py`.

## Headline findings

**Good news (architecture validates):**
- **Property 1 (monotonicity) holds in 449/449 evaluable transitions.**
  Contract-gated quality (`= passed ? axis_quality : 0`) is monotonic
  in budget on every observed (spec, seed) cell. Zero violations.
- **Property 4 (determinism) holds.** Already CI-tested; this study
  did not exercise it directly but no observed inconsistencies.
- **Per-spec wall-clock predictability holds.** Within-spec ms/frame
  cv ranges 0.04-0.25, almost all under 0.20.

**Bad news (implementation limits — surfaced ONLY because we
methodically studied curves rather than just running pass/fail
gates):**
- **Overshoot is enormous on large specs.** Budget is honored to
  within 1-2× on tiny specs, but **solo_run** shows up to 802×
  overshoot (and 222× mean); drums and opening_burst routinely
  see 10-260× overshoot. The "one-op overshoot ≤ durationFrames"
  claim from the design is empirically wrong for cascading-cache
  paths.
- **LDS at currently-feasible budgets does NOT match greedy_v1 on
  most specs.** Only tiny_dance and mini_burst reliably match or
  beat greedy_v1. The other 11 specs underperform by 10-60% at
  every budget we tested.
- **Pooled wall-clock cv = 0.262**, just above the 0.25 gate. The
  per-spec ms/frame mean varies 0.019 (opening_burst) → 0.035
  (cold_start), so the spec-level offset is what pushes pooled cv
  over. Within-spec it's fine.

## Monotonicity — Property 1 verified empirically

449 evaluable budget transitions across 502 cells. **0 violations.**
The contract-gated metric (passing ? axis_quality : 0) is monotonic
non-decreasing in budget on every cell where we have data.

This is the load-bearing property. The architecture delivers it.

## Wall-clock cv — Property 2 partial

Per-spec breakdown (n = cells, ms/frame is `wall_ms / sim_frames`):

| spec | n | min | mean | max | cv |
|---|---|---|---|---|---|
| cold_start | 50 | 0.025 | 0.035 | 0.059 | 0.200 |
| dense_sprint | 50 | 0.015 | 0.019 | 0.029 | 0.137 |
| drums_crescendo | 9 | 0.039 | 0.042 | 0.047 | 0.065 |
| drums_pendulum | 31 | 0.023 | 0.029 | 0.048 | 0.183 |
| drums_signature | 28 | 0.017 | 0.023 | 0.036 | 0.157 |
| grain_staircase | 43 | 0.016 | 0.028 | 0.054 | 0.252 |
| mini_burst | 50 | 0.022 | 0.027 | 0.035 | 0.111 |
| opening_burst | 39 | 0.012 | 0.019 | 0.029 | 0.194 |
| rhythm_ladder | 50 | 0.017 | 0.022 | 0.031 | 0.127 |
| solo_run | 7 | 0.017 | 0.018 | 0.019 | 0.037 |
| syncopated_switchback | 50 | 0.019 | 0.024 | 0.033 | 0.121 |
| tiny_dance | 50 | 0.018 | 0.027 | 0.034 | 0.141 |
| verse_chorus | 45 | 0.024 | 0.028 | 0.042 | 0.126 |
| **POOLED** | **502** | 0.012 | 0.026 | 0.059 | **0.262** |

Per-spec cv: 12 of 13 under 0.25, one at 0.252 (grain_staircase).
Pooled cv 0.262 fails the gate. The cross-spec variation is dominated
by **spec-level mean ms/frame**: opening_burst is ~2× faster per
frame than cold_start. Reasonable interpretations:

- This is OK if budget is calibrated per-spec (`budgetFor(spec)` in
  Stage 4). Within a spec the predictability is solid.
- This is NOT OK if we want a single user-facing budget knob that
  works the same across all specs.

The Property 2 acceptance check needs to be restated: "per-spec cv
< 0.25" (which holds for 12 of 13) is the operationally meaningful
form. The pooled metric conflates spec difficulty with per-frame
predictability.

## Overshoot — the critical finding

Sim_frames consumed divided by budget requested, for cells where
the budget exhausted:

| spec | n | min× | mean× | median× | max× |
|---|---|---|---|---|---|
| cold_start | 50 | 1.0 | **2.1** | 1.1 | 10.6 |
| dense_sprint | 50 | 1.0 | **12.8** | 2.4 | 109.5 |
| drums_crescendo | 9 | 1.7 | **58.3** | 13.4 | 267.9 |
| drums_pendulum | 31 | 1.0 | **21.9** | 3.3 | 211.9 |
| drums_signature | 28 | 1.0 | **23.4** | 4.7 | 249.8 |
| grain_staircase | 43 | 1.0 | **10.2** | 2.4 | 62.0 |
| mini_burst | 50 | 1.0 | **3.6** | 1.0 | 17.4 |
| opening_burst | 39 | 1.0 | **23.7** | 4.3 | 197.6 |
| rhythm_ladder | 50 | 1.0 | **8.7** | 1.4 | 102.0 |
| **solo_run** | 7 | 13.4 | **222.5** | 80.2 | **802.1** |
| syncopated_switchback | 50 | 1.0 | **7.1** | 1.7 | 39.1 |
| tiny_dance | 46 | 1.0 | **2.4** | 1.0 | 10.2 |
| verse_chorus | 45 | 1.0 | **9.1** | 2.2 | 76.3 |

This breaks the meaningful-budget claim for large specs.

**Why this happens.** The op-boundary cutoff in `compileLDS` checks
budget AFTER each leaf is scored. One "op" is supposed to be cheap.
But to score a leaf at deep discrepancy on a large spec, the
enumerator must visit many internal nodes; each uncached internal
node triggers `solveOneGap` which samples N_CAND=32 candidates
through `tryCandidate`, each candidate doing bisection + evaluation
that itself extracts trajectories. On a 55-gap drums spec, the
first leaf to visit a new prefix can trigger 50+ uncached gap
visits × ~100k frames each = millions of frames in a "single op".

**Why we didn't see this in Stage 0b/2 verification.** Stage 0b
measured pure trajectory extraction. Stage 2 cross-spec sweep used
mostly tiny specs (tiny_dance, mini_burst, cold_start). The first
real exposure to large-spec cascade-of-cache-misses is here.

**Implications.**
- The Stage 5 acceptance sweep ("every cell monotonic in budget")
  would pass — monotonicity does hold. But the BUDGET AXIS would
  be meaningless on large specs.
- A user requesting budget=50k on drums_signature gets
  ~12M sim_frames of work, taking ~5 minutes. They cannot
  meaningfully control compile time.
- This is exactly the situation the rebuild was supposed to fix.

**Fix options (need to be designed before Stage 3+):**

1. **Finer-grained op boundary.** Check budget INSIDE `solveOneGap`
   or per per-candidate evaluation, not just per leaf. Reduces
   overshoot to ~one-tryCandidate worth (~thousands of frames vs
   millions). Implementation: thread a budget-check callback into
   `generateRankedCandidates` and `tryCandidate`. Moderate
   complexity.

2. **Pre-flight cost estimate before each leaf.** Track running
   sim_frames, predict the cost of generating the next leaf from
   cached state, refuse if predicted-total > budget. Hard to
   estimate accurately.

3. **Greedy-floor-only-on-low-budget mode.** If budget < some
   threshold, run only the d=0 path and return. Avoids the
   cascade-of-cache-misses entirely. Crude but works.

4. **Cap the per-leaf op cost.** If a leaf's "warm-up" cost
   (uncached prefix visits) exceeds N frames, bail and try the
   next leaf in the enumeration. Could break determinism if not
   careful.

## Quality vs budget — the curves

Contract-gated quality (= 0 if !passed else axis_quality), mean
across seeds. Greedy_v1's frozen contract-gated quality as
reference column.

| spec | gv1 | 50k | 100k | 200k | 500k | 1M | 2M | 3M | 5M | 8M | 12M |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cold_start | 0.422 | 0.343 | 0.343 | 0.343 | 0.354 | 0.364 | 0.375 | 0.376 | 0.386 | **0.481** | 0.483 |
| dense_sprint | 0.481 | 0.305 | 0.305 | 0.305 | 0.305 | 0.305 | 0.322 | 0.322 | 0.335 | 0.344 | 0.372 |
| drums_crescendo | 0.462 | 0.411 | 0.411 | 0.411 | 0.411 | 0.411 | 0.411 | 0.411 | 0.411 | 0.411 | · |
| drums_pendulum | 0.380 | 0.351 | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 | 0.345 | 0.354 |
| drums_signature | 0.442 | 0.294 | 0.294 | 0.294 | 0.294 | 0.294 | 0.294 | 0.294 | 0.294 | **0.441** | 0.455 |
| grain_staircase | 0.530 | 0.293 | 0.293 | 0.293 | 0.232 | 0.232 | 0.232 | 0.237 | 0.259 | 0.422 | **0.589** |
| mini_burst | 0.506 | **0.534** | 0.534 | 0.534 | 0.534 | 0.582 | 0.602 | 0.620 | 0.638 | 0.643 | 0.657 |
| opening_burst | 0.486 | 0.359 | 0.359 | 0.359 | 0.359 | 0.359 | 0.359 | 0.359 | **0.499** | 0.518 | 0.583 |
| rhythm_ladder | 0.478 | 0.284 | 0.284 | 0.284 | 0.284 | 0.284 | 0.382 | 0.385 | 0.385 | 0.393 | 0.399 |
| solo_run | 0.539 | 0.267 | 0.267 | 0.267 | 0.267 | 0.267 | 0.267 | 0.267 | · | · | · |
| syncopated_switchback | 0.424 | 0.347 | 0.347 | 0.347 | 0.347 | 0.347 | 0.359 | 0.396 | 0.424 | **0.455** | 0.455 |
| tiny_dance | 0.488 | 0.422 | 0.422 | 0.422 | **0.525** | 0.630 | 0.700 | 0.700 | 0.708 | 0.708 | 0.710 |
| verse_chorus | 0.448 | 0.446 | 0.446 | 0.446 | 0.446 | 0.446 | 0.460 | 0.467 | 0.471 | 0.482 | 0.485 |

**Bold cells**: smallest budget where LDS matches or beats greedy_v1.

Curve shapes observed:
- **Flat-then-step**: most specs sit at d=0 quality (the greedy
  floor) for many budgets, then jump as a higher-d leaf becomes
  reachable. Examples: drums_signature (0.294→0.441 at 8M),
  opening_burst (0.359→0.499 at 5M), cold_start (0.354→0.481 at 8M).
- **Smooth growth**: tiny_dance shows monotone improvement at most
  budget steps (small spec → small per-op cost → budget axis is
  meaningful).
- **Non-improvement**: solo_run stuck at 0.267 the entire range —
  too few cells (only 7 successful) due to runtime timeout.
  drums_crescendo similarly stuck near 0.411.
- **Anomaly**: grain_staircase quality DROPS from 0.293 (50k-200k)
  to 0.232 (500k-3M) then recovers to 0.589 (12M). Looking more
  carefully: 0.293 is from cells where some seeds happened to
  hit a passing leaf at low budget; 0.232 is the contract-passing
  cells (a subset) at intermediate budgets — the mean drops because
  more failing cells were averaged in. Monotonicity holds PER
  (spec, seed), not necessarily per-spec-mean. The "drop" is an
  averaging artifact, NOT a property violation.

## Coverage (contract-passing rate) vs budget

| spec | gv1 | 50k | 100k | 200k | 500k | 1M | 2M | 3M | 5M | 8M | 12M |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cold_start | 5/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 5/5 | 5/5 |
| dense_sprint | 5/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 |
| drums_crescendo | 5/5 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | · |
| drums_pendulum | 5/5 | 4/4 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| drums_signature | 5/5 | 2/3 | 2/3 | 2/3 | 2/3 | 2/3 | 2/3 | 2/3 | 2/3 | 2/2 | 2/2 |
| grain_staircase | 5/5 | 3/5 | 3/5 | 3/5 | 2/4 | 2/4 | 2/4 | 2/4 | 2/4 | 3/4 | 4/4 |
| mini_burst | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| opening_burst | 5/5 | 3/4 | 3/4 | 3/4 | 3/4 | 3/4 | 3/4 | 3/4 | 4/4 | 4/4 | 3/3 |
| rhythm_ladder | 5/5 | 3/5 | 3/5 | 3/5 | 3/5 | 3/5 | 4/5 | 4/5 | 4/5 | 4/5 | 4/5 |
| solo_run | 5/5 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | · | · | · |
| syncopated_switchback | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| tiny_dance | 5/5 | 4/5 | 4/5 | 4/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| verse_chorus | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 |

Greedy_v1 hits 65/65 contract-pass. LDS at 12M budget where data
exists: ~45/52 on observed cells. **The coverage gap is not closing
within feasible budgets.** Multiple specs have stuck failing cells
(cold_start s2, dense_sprint s2, drums_pendulum s4, etc.) that no
amount of budget rescues.

## Best-leaf discrepancy distribution (at largest available budget)

| spec | s0 | s1 | s2 | s3 | s4 |
|---|---|---|---|---|---|
| cold_start | 9 | 6 | 3 | 3 | 2 |
| dense_sprint | 7 | 3 | 2 | 7 | 6 |
| drums_crescendo | 8 | · | · | · | · |
| drums_pendulum | 2 | 3 | 2 | 2 | · |
| drums_signature | 2 | 2 | 2 | · | · |
| grain_staircase | 2 | 2 | 2 | 2 | 0 |
| mini_burst | 4 | 3 | 5 | 4 | 5 |
| opening_burst | 15 | 7 | 10 | 4 | · |
| rhythm_ladder | 1 | 2 | 5 | 1 | 1 |
| solo_run | 0 | 0 | 1 | 0 | 1 |
| syncopated_switchback | 4 | 3 | 5 | 0 | 5 |
| tiny_dance | 8 | 7 | 5 | 6 | 5 |
| verse_chorus | 1 | 0 | 2 | 1 | 0 |

The winning leaf is at d=2-15 on most successful cells. d=0 wins
only when no deviation produced strictly-better quality (verse_chorus s1,
grain_staircase s4, syncopated s3, solo_run several). Empirically:
**discrepancy matters; the budget cap is what determines how much
exploration LDS does in practice**.

## What this means for Stage 3+

This study fundamentally changes the priorities for the remaining
stages. Honest assessment:

1. **The overshoot fix is now the highest-leverage work.** Without it,
   the budget axis is meaningless on large specs and the "anytime"
   promise breaks down. Implementations 1 (finer-grained op boundary)
   or 4 (cap per-leaf cost) are the candidates; option 1 is cleaner.

2. **Polish-as-leaf (Stage 3b) is critical for closing the
   greedy_v1 gap.** Without polish, LDS only matches greedy_v1 on
   3 of 13 specs. The work branch's `polishLeafVariant`
   pattern (clone fits + run existing mutating polish + accept if
   fingerprint changed) is the right design — adopt it.

3. **Property 1 (monotonicity) is empirically confirmed.** The
   architectural promise of the rebuild is delivered.

4. **Property 2 needs restatement.** Per-spec cv is the meaningful
   form (12/13 under 0.25); pooled cv conflates spec difficulty.
   Per-spec calibration of `budgetFor(spec)` in Stage 4 naturally
   addresses this.

5. **The structural cap on quality** observed for some seeds (the
   coverage gap that doesn't close with more budget) is informative:
   greedy_v1 has additional mechanisms (bounded backtracking,
   validation retries, in-place polish) that LDS doesn't replicate.
   The polish refactor (Stage 3b) should close most of that gap.
   If a gap remains, additional explorer types in `E` (e.g., a
   greedy-with-perturbed-seed branch) can be added without changing
   the LDS core.

## Revised stage plan after this study

- **Stage 2.5 (new) — Overshoot fix.** Thread a budget-check
  callback into `tryCandidate` (or `generateRankedCandidates`).
  Re-run the budget study; verify overshoot bounded at <2× on
  median, <10× on max. Estimated 2-3 days.

- **Stage 3a-b** — polish-as-leaf-variant via clone-and-test
  (adopt the work-branch pattern). Estimated 2-3 days.

- **Stage 4 — Scoring + harness cleanup; per-spec
  `budgetFor(spec)`.** Calibrate budget so quality matches or
  beats greedy_v1 on every spec (with overshoot bounded, this
  becomes achievable).

- **Stage 5 — Acceptance sweep** (re-run after fixes; current
  results would show the bugs the fixes addressed).

## Investigation files

- `scripts/v0/optimizer/_study_budget.ts` — sweep harness (per-spec).
- `/tmp/study_budget/*.json` — raw cell data (not committed).
- `/tmp/analyze_study.py` — analysis script (not committed; the
  tabular output is in this doc).

## Property summary post-study

| Property | Status | Evidence |
|---|---|---|
| 1 (monotonicity) | **PASSES** | 0 violations / 449 transitions |
| 2 (wall-clock cv) | **PARTIAL** | per-spec cv < 0.25 on 12/13; pooled = 0.262 |
| 3 (cheat-resistance) | **PASSES** (design audit pending) | sim_frames at engine boundary; can't be inflated |
| 4 (determinism) | **PASSES** | CI-tested; no observed inconsistencies |
| Parity with greedy_v1 | **FAILS** at current budgets without polish | only 3 of 13 specs match |

The structural pieces work. The implementation needs the overshoot
fix and the polish refactor before the parity gate can be re-attempted.
