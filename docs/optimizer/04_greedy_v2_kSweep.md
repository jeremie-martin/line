# Step 4 — greedy_v2 K-sweep: cataloguing the non-monotonicity

This step is the **problem-statement** step. It produces empirical
evidence that the minimal greedy chainer (Step 3) violates Property 1
(monotonicity-in-budget). The evidence motivates Step 5's
best-so-far envelope — the structural fix.

## Sweep parameters

- Compiler: `compileGreedy_v2` (from `scripts/v0/optimizer/greedy.ts`)
- K levels: **{8, 16, 32, 48, 96}**
- Seeds: **{0, 1, 2, 3, 4}**
- Specs: all 13 in `GOLDEN_SPECS`
- Total: 5 × 5 × 13 = **325 runs**
- Wall-clock: ~8 min, 25-way parallel
- Raw data: `/tmp/greedy_v2_ksweep/K{K}_s{S}.json`

## Result 1: coverage is non-monotonic in K

For each spec, count seeds passing contract at each K:

| spec | K=8 | K=16 | K=32 | K=48 | K=96 | trend |
|---|---|---|---|---|---|---|
| tiny_dance | 4/5 | 5/5 | **4/5** | 4/5 | 4/5 | drops at K=32 |
| mini_burst | 1/5 | 3/5 | 5/5 | **4/5** | 5/5 | drops at K=48 |
| cold_start | 0/5 | 1/5 | 3/5 | **2/5** | 2/5 | drops at K=48 |
| syncopated_switchback | 0/5 | 0/5 | 0/5 | 1/5 | 2/5 | monotonic |
| rhythm_ladder | 0/5 | 0/5 | 1/5 | **0/5** | 0/5 | drops at K=48 |
| grain_staircase | 0/5 | 0/5 | 1/5 | 1/5 | **0/5** | drops at K=96 |
| dense_sprint | 0/5 | 0/5 | 0/5 | 2/5 | **1/5** | drops at K=96 |
| drums_pendulum | 0/5 | 1/5 | **0/5** | 0/5 | 1/5 | drops at K=32 |
| drums_signature | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | (never passes) |
| drums_crescendo | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | (never passes) |
| opening_burst | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | (never passes) |
| solo_run | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | (never passes) |
| verse_chorus | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | (never passes) |
| **TOTAL** | **5/65** | **10/65** | **14/65** | **14/65** | **15/65** | |

**7 of 13 specs show coverage drops when K grows.** A wider candidate
pool can produce a *worse* commit choice that derails the cascade.

(For reference: greedy_v1 at K=48 passes 65/65. The five specs that
greedy_v2 never passes — drums × 3, opening_burst, solo_run,
verse_chorus — are the specs whose cascades require greedy_v1's
backtracking; without it, no K we tested rescues them.)

## Result 2: pure quality is non-monotonic in K (every evaluable row)

Among rows where greedy_v2 passed contract at ALL 5 K levels (only
4 such rows across the entire 65-row matrix), **0 of 4 are
monotonic** in axis_quality:

| spec | seed | K=8 | K=16 | K=32 | K=48 | K=96 | worst drop |
|---|---|---|---|---|---|---|---|
| tiny_dance | 0 | 0.595 | 0.415 | 0.398 | 0.398 | 0.493 | −0.18 |
| tiny_dance | 2 | 0.398 | 0.623 | 0.605 | 0.605 | 0.451 | −0.15 |
| tiny_dance | 4 | 0.327 | 0.498 | 0.517 | 0.465 | 0.520 | −0.05 |
| mini_burst | 4 | 0.567 | 0.617 | 0.591 | 0.591 | 0.664 | −0.03 |

Every single one regresses by at least 3% somewhere in the K sweep.
Wider sampling produces a different lowest-cost candidate, which
cascades into a different (sometimes worse) downstream trajectory.

## Result 3: aggregate goal_score barely moves with K

| compiler / K | goal_score | coverage | throws |
|---|---|---|---|
| greedy_v2 K=8 | **0.60** | 5/65 | 60 |
| greedy_v2 K=16 | 1.60 | 10/65 | 55 |
| greedy_v2 K=32 | 2.82 | 14/65 | 50 |
| greedy_v2 K=48 | 2.80 | 14/65 | 48 |
| greedy_v2 K=96 | **3.11** | 15/65 | 49 |
| greedy_v1 K=48 (baseline) | **460.44** | 65/65 | 0 |

greedy_v2 at K=96 is **150× worse** than greedy_v1 by goal_score.
The dominant driver is coverage — most cells get axis_quality=0
because greedy_v2 threw, and the geomean is brutal on zeros.

## Result 4: pure quality is roughly flat in K (where greedy_v2 succeeds)

Mean axis_quality among the (few) contract-passing rows:

| K | mean axis_quality among passing runs | n |
|---|---|---|
| 8 | 0.470 | 5 |
| 16 | 0.504 | 10 |
| 32 | 0.510 | 14 |
| 48 | 0.499 | 14 |
| 96 | 0.470 | 15 |

Adding more samples does NOT meaningfully improve the quality of
successful runs. The optimizer is finding roughly-equal-quality
local optima at every K. The variance comes from the
cascade-divergence dice, not from "better search yielding higher
quality".

## Interpretation

These findings empirically confirm what we hypothesized in
`docs/anytime_budget_design.md`:

- The per-gap greedy commit is **local optimization on a cascading
  state**. The lowest-cost candidate at gap N may produce a rider
  state from which gap N+1 (and onward) becomes structurally worse.
- More compute (larger K) gives the optimizer access to more
  candidates per gap, but **it doesn't help it choose among
  cascades** — only among candidates at a single gap.
- When more K reveals a marginally-better-cost candidate at gap N,
  the cascade diverges and the downstream gaps can score worse —
  sometimes catastrophically worse, including failing the contract
  entirely.

This is not noise. It is the structural property of greedy
optimization with cascading state. **It cannot be fixed inside the
chainer.** Any per-gap-local fix preserves the cascade.

## Why Step 5's envelope is the fix

The best-so-far envelope (Step 5) absorbs this entirely:

```
for each exploration in [greedy_v2(K=8), greedy_v2(K=16), ..., greedy_v2(K=96)]:
    result = exploration.run()
    if score(result) > score(best_so_far):
        best_so_far = result
return best_so_far
```

By construction:

- For any subset S' ⊃ S of explorations,
  `score(envelope(S')) ≥ score(envelope(S))`.
- We can NEVER return worse than the best of any single exploration.
- Property 1 (monotonicity-in-budget) holds trivially: more budget
  means more explorations tried, which can only ratchet the
  best-so-far upward.

For specs greedy_v2 never passes at any K (drums, opening_burst,
solo_run, verse_chorus), Step 6 will add additional explorers
beyond the K-sweep — seed perturbation, restart-local, etc. — until
the coverage gap vs greedy_v1 is closed.

## Verification gate (Step 4)

Per the plan: "Sweep harness exists, doc written, non-monotonicities
catalogued precisely." ✓

The data files at `/tmp/greedy_v2_ksweep/` are not committed
(investigation artifacts); the summary above captures the
load-bearing findings.

Proceeding to Step 5.
