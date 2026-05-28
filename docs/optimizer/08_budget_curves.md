# Budget → quality → time: the equation, and budgetFor calibration

What the compute dial actually buys, measured on the honest physics-frame unit
(Stage D0). Backs the `budgetFor(spec)` constants in `golden_suite.ts`. Aligned
with `docs/compiler_goals.md` (P1 monotonicity, P2 wall-clock predictability).

## The measurements

`_sweep_curve.ts`, seed 0, contract-gated score (= `passed ? 1000·axis : 0`),
budget in physics frames:

| spec | greedy_v1 (s0) | 80k | 200k | 500k | ms/physframe |
|---|---|---|---|---|---|
| tiny_dance | 414.8 | 680.5 | 769.2 | 769.5 | 0.29–0.32 |
| mini_burst | 469.9 | 577.7 | 615.1 | 700.6 | 0.25–0.26 |
| cold_start | 367.0 | 367.0 | 367.0 | 415.4 | 0.25–0.27 |
| rhythm_ladder | 460.5 | 532.5 | — | — | 0.27 |

Parity run (budget ≈ 520k physics), hard specs:

| spec | greedy_v1 (per-spec) | LDS @520k | note |
|---|---|---|---|
| drums_signature | 423.2 | 556.9 (s0) | = floor; LDS deviations dead-end on dense gaps |
| drums_pendulum | 379.5 | 368.5 (s0) | = floor |

## The equation (three clean facts)

1. **Quality rises with budget, then saturates (diminishing returns).** Below
   the floor (the greedy descent cost), you get exactly the greedy floor
   (cold_start@80k = 367.0 = greedy, identically). Above it, LDS + polish climb
   and then plateau at a spec-dependent **knee**: tiny_dance saturates by ~200k;
   mini_burst and cold_start are still climbing at 500k. The knee scales with
   spec complexity (more gaps → more cascades to explore → later knee).

2. **Wall-clock is linear and predictable in the budget unit.**
   `ms/physframe ≈ 0.25–0.32` across every spec measured (P2 holds — the honest
   unit is also the wall-clock-predictive one). So `wall ≈ 0.27 ms × budget`:
   the dial converts to real time with a stable, spec-independent constant. This
   is exactly the meaningful-currency property P2 asks for.

3. **The floor is the greedy result, and it is the minimum at any budget.**
   Because the mandatory-prelude floor leaf is the legacy greedy descent
   (Stage C), `contract_gated_quality ≥ greedy_v1` for all budgets — parity is
   not a function of the budget; the budget only buys the bonus above greedy.

## Where LDS exceeds greedy, and where it only matches

- **Solvable specs (most):** LDS + polish substantially exceed greedy —
  tiny_dance +86%, mini_burst +49%, rhythm_ladder +16%, cold_start +13%
  (at the budgets above). The discrepancy deviations find better cascades and
  polish refines them.
- **Dense/hard specs (drums family):** the rank-0 LDS descent has no
  backtracking, so deviation leaves dead-end (a gap with 0 viable candidates,
  e.g. drums_signature gap 36). LDS adds nothing beyond the floor, so the result
  equals greedy (= parity). Crucially, budget spent above the floor here is
  **wasted wall-clock** (≈127 s of dead-end exploration at 520k for no quality
  gain). Making LDS itself complete on dense specs (a backtracking leaf builder)
  is the path to exceeding greedy there — deferred (it is the "exceed on big
  specs" upside, not required for parity).

## budgetFor calibration

`budgetFor(spec) = 120_000 + 4_000·contacts + 150·frames` physics frames
(`golden_suite.ts`). Rationale:

- **Parity-safe by construction:** any value ≥ 0 yields ≥ greedy_v1 (floor), so
  the constants are a quality/time tradeoff, not a correctness lever.
- **Above the floor for the bonus:** small specs land ~150–250k (past the early
  climb, near the knee for tiny_dance); medium specs ~300–500k.
- **Honest about the cost:** large dense specs get large budgets (drums ≈ 475k,
  solo_run ≈ 540k) which, because they dead-end, mostly buys wall-clock not
  quality. Tightening budgetFor for dead-end-prone specs is a speed optimization
  for later (point 6 of the remaining-work charter); it must not reduce quality
  or break any spec, so it waits until the backtracking-LDS question is settled.

## Parity verdict (seed 0, apples-to-apples)

Seed-0 run at `budgetFor` (`_parity_lds.ts`), LDS-s0 vs greedy_v1-s0 (the correct
comparison — greedy_v1's per-spec 460.44 is a 5-seed geomean, not seed-0):

| | LDS s0 | greedy_v1 s0 |
|---|---|---|
| goal_score (shifted-geomean) | **503.93** | 462.24 |
| contract-pass | **13/13** | 13/13 |
| specs below greedy_v1 | **none** | — |

8 specs match greedy_v1 exactly (floor; LDS deviations dead-end or don't beat it);
5 improve — tiny_dance +354, mini_burst +145, rhythm_ladder +107, syncopated +13,
verse_chorus matches. The floor=legacy construction guarantees LDS ≥ greedy_v1 per
(spec, seed), so the same holds for all 5 seeds; the seed-0 run confirms it
empirically (exact-match where LDS doesn't help, strict gain where it does — never
below). `golden.ts --lds` reproduces this (tiny_dance 769.19, time_multiplier=1).

## Open items this surfaces

- **Knees beyond 500k** (mini_burst, cold_start still climbing): a higher
  budgetFor would extract more quality at more wall-clock. The current constants
  favor reasonable compile time; revisit if quality headroom matters more than
  speed for a use case.
- **Dead-end waste on dense specs**: the real fix is LDS completion via
  backtracking (lets deviations complete and exceed greedy on drums), which also
  removes the wasted budget. Tracked as the big-spec item.
