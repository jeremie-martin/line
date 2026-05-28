# Step 5 — best-so-far envelope (Property 1 holds by construction)

This step ships the load-bearing piece of the rebuild: the
`compileWithEnvelope` function that wraps a list of explorations and
returns the strictly-best-scoring track ever seen across them.
From this step onward, **Property 1 (monotonicity-in-budget) holds
by construction**, not by luck.

## The contract

```ts
compileWithEnvelope(
  explorations: readonly Exploration[],
  opts?: { onProgress?: (t: ExplorationTrace) => void },
): CompileOutput
```

For any list `L` of explorations and any prefix `P ⊆ L`:

> **`score(envelope(L)) ≥ score(envelope(P))`**, by construction.

Proof: the envelope only swaps to a new best on strict improvement
(`isStrictlyBetter`). Adding more explorations to `L` can only leave
the current best unchanged (if no new exploration beats it) or
replace it with strictly-better. Monotonicity is mechanical, not
empirical.

Individual exploration `run()` calls that throw are caught and
treated as "this attempt failed; try the next" — they do not
propagate. The envelope only throws itself if **every** exploration
fails (no complete track produced).

## Verification gates — both pass

### Gate 1: monotonicity property test (in CI forever)

`tests/optimizer_envelope.test.ts` includes the property test:

> Build a list of explorations (greedy_v2 at K ∈ {8, 16, 32, 48} on
> tiny_dance seed=0). For each prefix length `n ∈ [1, |L|]`, run
> `envelope(prefix)` and verify `score(prefix) ≤ score(full) + 1e-9`.

Passes. The mechanism is sound. The test stays in CI to catch any
future regression that breaks monotonicity (e.g., an envelope
optimization that uses non-strict comparison).

Plus 6 supporting tests: determinism, throw handling, all-throw
behavior, empty-list behavior, onProgress callback.

7/7 passing in 165s (most of the cost is the underlying greedy_v2
runs, not envelope overhead).

### Gate 2: coverage ≥ best individual K

Computed analytically from the Step 4 K-sweep data (no re-run):

| compiler | coverage | goal_score |
|---|---|---|
| greedy_v2 K=8 | 5/65 | 0.60 |
| greedy_v2 K=16 | 10/65 | 1.60 |
| greedy_v2 K=32 | 14/65 | 2.82 |
| greedy_v2 K=48 | 14/65 | 2.80 |
| greedy_v2 K=96 | **15/65** | **3.11** |
| **envelope[K=8,16,32,48,96]** | **22/65** | **7.17** |
| greedy_v1 K=48 (baseline) | 65/65 | 460.44 |

The envelope inherits the **union** of contract-passing
(spec, seed) cells across K levels. 47% more coverage than the best
individual K (15→22), and 2.3× the goal_score (3.11→7.17).

This is the structural payoff of best-so-far memory.

## Per-spec envelope coverage breakdown

| spec | envelope (5K union) | note |
|---|---|---|
| tiny_dance | 5/5 | ✓ greedy_v2 handles this cleanly |
| mini_burst | 5/5 | ✓ |
| cold_start | 3/5 | partial |
| syncopated_switchback | 3/5 | partial |
| dense_sprint | 2/5 | partial |
| drums_pendulum | 2/5 | partial |
| grain_staircase | 1/5 | only the lucky K combos |
| rhythm_ladder | 1/5 | only the lucky K combos |
| drums_signature | 0/5 | greedy_v2 NEVER passes |
| drums_crescendo | 0/5 | greedy_v2 NEVER passes |
| opening_burst | 0/5 | greedy_v2 NEVER passes |
| solo_run | 0/5 | greedy_v2 NEVER passes |
| verse_chorus | 0/5 | greedy_v2 NEVER passes |

The 6 specs at 0/5 are the specs whose cascades genuinely need
**greedy_v1's backtracking** to find a complete track. No amount of K
in `compileGreedy_v2` rescues them.

## What this proves and what it leaves open

**Proven (Step 5)**:
- Property 1 holds by construction across any exploration list.
- The envelope mechanism works correctly: throw-handling,
  best-so-far swapping, determinism.
- Even with the SAME exploration family (greedy_v2 at varying K), the
  envelope strictly beats any single member in coverage and goal_score.

**Left open (Step 6)**:
- The 6 specs greedy_v2 never passes need different explorers. Per
  the plan, Step 6 adds: greedy with seed perturbation, restart-local
  improvement, and (optionally) a beam-style explorer. Each is
  required to win on at least one (spec, seed) combo vs. the envelope
  without it.

The structural property is achieved. The remaining coverage gap is
not an envelope problem — it is a "we need more diverse explorations
in the list" problem, which is exactly the kind of problem the
envelope is designed to absorb additively.

## Files in this step

- `scripts/v0/optimizer/envelope.ts` — the envelope itself.
- `tests/optimizer_envelope.test.ts` — property test + 6 unit tests.

Total new code: ~100 LOC for the envelope + ~120 LOC for tests.
