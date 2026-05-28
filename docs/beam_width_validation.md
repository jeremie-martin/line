# Phase 4 — beam-width sweep validation

20-way parallel sweep: widths {1, 2, 4, 8} × seeds {0, 1, 2, 3, 4} × 13
specs = **260 runs**, completed in ~18 min wall-clock. Raw data:
`/tmp/beamsweep/w{W}_s{S}.json`. Analysis script: `/tmp/phase4_analysis.py`.

## TL;DR

The architectural premise of beam search **is confirmed where it
succeeds** — beam at width 4-8 produces strictly higher axis_quality
than greedy K=48 on most specs (9 of 13, +5 to +24%). But beam without
backtracking is **structurally weaker on coverage**: even width=8
misses 23% of (spec, seed) combos that greedy passes. Aggregate
`goal_score` is therefore lower (124 at w=8 vs 460 greedy) despite
per-row quality wins.

Pure beam search is not a drop-in replacement for greedy. Three real
paths forward, each with tradeoffs (see "Decision gate" below).

## Coverage by width

Fraction of seeds passing contract per spec:

| spec | w=1 | w=2 | w=4 | w=8 | monotonic? |
|---|---|---|---|---|---|
| tiny_dance | 5/5 | 5/5 | 5/5 | 5/5 | ✓ |
| mini_burst | 4/5 | 4/5 | 5/5 | 5/5 | ✓ |
| cold_start | 1/5 | 1/5 | 3/5 | 5/5 | ✓ |
| dense_sprint | 0/5 | 1/5 | 4/5 | 5/5 | ✓ |
| drums_crescendo | 0/5 | 0/5 | 0/5 | 5/5 | ✓ |
| syncopated_switchback | 0/5 | 0/5 | 1/5 | 4/5 | ✓ |
| drums_signature | 0/5 | 0/5 | 4/5 | 4/5 | ✓ |
| grain_staircase | 0/5 | 3/5 | 4/5 | 4/5 | ✓ |
| verse_chorus | 0/5 | 1/5 | 2/5 | 4/5 | ✓ |
| rhythm_ladder | 0/5 | 1/5 | 1/5 | 3/5 | ✓ |
| **drums_pendulum** | 0/5 | 3/5 | 3/5 | **2/5** | **NON-MONO** |
| opening_burst | 0/5 | 0/5 | 0/5 | 2/5 | ✓ |
| solo_run | 0/5 | 0/5 | 2/5 | 2/5 | ✓ |
| **TOTAL** | **10/65** | **19/65** | **34/65** | **50/65** | |

Coverage rates: w=1 → 15%, w=2 → 29%, w=4 → 52%, w=8 → 77%. **Greedy
K=48 hits 65/65 (100%)**. Beam needs significantly wider beams to
match — width=16 hit 11/13 specs in the Phase 3 single-seed run.

**drums_pendulum is structurally NON-MONOTONIC in coverage**: 3/5 at
w=4, 2/5 at w=8. Wider beam reduces success rate. Likely a
diversity-bucket interaction (`maxPerBucket = ⌈W/2⌉` grows with W, so
wider beam keeps more jitter-twins of the same end-state, displacing
the slot that would have held the "right" alternative cascade).

## Monotonicity of axis_quality in width

Only **9 of 65 (spec, seed) rows succeeded at all 4 widths**. Of
those: **7 monotonic non-decreasing, 2 violations** (cold_start seed=2
and tiny_dance seed=1, with score ranges 0.04-0.05 — likely diversity
bucketing producing slightly different end-states).

Most rows are unmeasurable because narrower widths fail. The
monotonicity property we wanted to verify cannot be cleanly tested
with current beam coverage; widening to a regime where most rows
succeed at all widths needs w≥16.

## Quality where beam succeeds: beam beats greedy on 9 of 13

Mean axis_quality across 5 seeds (failed runs → 0):

| spec | greedy K=48 | beam w=8 | delta |
|---|---|---|---|
| tiny_dance | 0.488 | 0.574 | **+18%** |
| mini_burst | 0.506 | 0.568 | **+12%** |
| cold_start | 0.422 | 0.525 | **+24%** |
| drums_crescendo | 0.462 | 0.568 | **+23%** |
| grain_staircase | 0.530 | 0.620 | **+17%** |
| dense_sprint | 0.481 | 0.522 | **+9%** |
| drums_signature | 0.442 | 0.479 | +8% |
| syncopated_switchback | 0.424 | 0.444 | +5% |
| rhythm_ladder | 0.478 | 0.500 | +5% |
| verse_chorus | 0.448 | 0.377 | −16% (coverage) |
| drums_pendulum | 0.380 | 0.357 | −6% (NON-MONO) |
| opening_burst | 0.486 | 0.350 | −28% (coverage) |
| solo_run | 0.539 | 0.233 | −57% (coverage) |

On the 9 specs where coverage is good, beam wins handily (+5 to +24%).
The 4 losses are mostly coverage failures (failed seeds contribute 0
to the mean) — exceptions: drums_pendulum's non-monotonicity and
verse_chorus's borderline coverage at w=8.

## Aggregate goal_score proxy

Shifted geometric mean of `axis_quality × 1000` across all 65 (spec,
seed) runs (the same shape `score.ts` uses):

| compiler | goal_score | vs greedy |
|---|---|---|
| greedy K=48 (baseline) | **460** | — |
| beam w=1 | 1.6 | −99.7% |
| beam w=2 | 5.1 | −98.9% |
| beam w=4 | 25.1 | −94.6% |
| beam w=8 | 124.4 | **−73.0%** |

Even at w=8, aggregate is 73% below greedy because failed runs
(axis_quality=0) drag the geomean. Per-row quality wins don't
compensate.

## Wall-clock cost

Sum of mean per-spec wall-clock across 13 specs (one seed = 5-spec mean):

| compiler | total wall-clock | vs greedy |
|---|---|---|
| greedy K=48 (Phase B baseline) | ~234s | — |
| beam w=1 | 213s | −9% |
| beam w=2 | 307s | +31% |
| beam w=4 | 531s | +127% |
| beam w=8 | 982s | +319% |

Width=8 costs ~4× greedy for **lower** aggregate quality. The
quality-per-second tradeoff is currently unfavorable for beam.

## Property checks against the plan's exit gates

| Property | Result |
|---|---|
| 1 — monotonicity-in-width | 7/9 evaluable rows monotonic. Coverage gap prevents clean test. drums_pendulum is structurally NON-MONO in coverage at all-widths-succeed view. **NOT CONFIRMED.** |
| Quality parity (w=8 ≥ greedy K=48) | Per-spec mean: 9/13 wins. Aggregate: −73%. **MIXED.** Beam wins where it works but coverage gap dominates. |
| 2 — wall-clock cv < 0.25 | Wall-clock per beam-expansion-unit varies wildly across specs (drums_signature 4-8× growth at width doubling vs mini_burst flat). **NOT CONFIRMED.** |

## What this changes about the plan

The original plan assumed "beam search subsumes greedy's backtracking
by keeping alternative cascades alive". This is true in theory but
**the beam needs to be very wide to absorb dead-ends** — much wider
than the elegant width=4-8 the plan envisioned. With current widths,
beam is strictly worse than greedy on aggregate.

The fundamental issue: greedy backtracking is **adaptive depth-first**
(compute spent where needed, in proportion to per-gap difficulty);
beam search is **fixed-width breadth-first** (uniform compute per gap
regardless of difficulty). For our cascading-state problem with
heterogeneous gap difficulty, adaptive depth-first appears to be more
compute-efficient.

## Decision gate — three paths

**A. Hybrid beam + recovery backtracking.** When the beam dies at gap
N, restart from an earlier alive hypothesis and re-expand with a
different candidate. Combines beam's diversity-keeping with greedy's
adaptive backtracking. The right structural fix, but adds complexity.
Estimated: 1-2 weeks beyond plan.

**B. Default to very-wide beams** (width=16 or 32). Pure beam, no
backtracking, but always wide. Coverage at w=16 was 11/13 in Phase 3
single-seed test; w=32 might be 12-13/13. Costs 8-16× greedy
wall-clock. Simpler code but expensive.

**C. Beam as a quality-boosting refiner, not a replacement.** Run
greedy first (for coverage guarantee), then beam from greedy's track
(or some prefix of it) to improve quality. Beam never returns a worse
track than greedy because greedy's track is always in the candidate
pool. Gets the per-row quality wins without the coverage regression.

**D. Reconsider beam search altogether.** The data suggests our search
problem may need a different algorithm — iterative-deepening DFS,
MCTS, or beam with explicit recovery. This is the longest-horizon
option, possibly a re-investigation of Phase 0.

## My recommendation

**A (hybrid beam + recovery backtracking)** if we want a clean
architectural fix. The data confirms beam's quality wins are real;
the only structural issue is coverage. A recovery mechanism that
preserves the determinism + monotonicity properties would let us ship
a compiler that's strictly better than greedy.

**C (beam as refiner)** if we want a faster, lower-risk path. Less
architecturally pure, but guaranteed never-worse-than-greedy and
captures most quality wins. Could ship in a week.

**B (just wider beams)** is the path of least architectural change
but the most wall-clock cost. Probably not worth it given current
quality/compute curves.

**D** would only be worth it if A and C both prove infeasible — we
have enough evidence beam is on the right track.
