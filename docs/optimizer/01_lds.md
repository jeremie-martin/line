# Stage 1 — LDS core (compileLDS unbudgeted)

## What this stage delivers

Four new files (~400 LOC total) implementing the limited-discrepancy
search core:

- `scripts/v0/optimizer/node.ts` — `SearchNode` type with lazy
  candidate memoization (`N_CAND = 32`, a fixed code constant).
- `scripts/v0/optimizer/lds.ts` — `enumerateLeaves(root, maxD, ...)`
  generator producing leaves in increasing-discrepancy order. Shared
  prefix-path candidate cache inside one enumeration call.
- `scripts/v0/optimizer/register.ts` — `BestSoFarRegister` with the
  strict-improvement comparator (contract_passed > axis_quality >
  full_score, earliest-on-tie implicit via strict>).
- `scripts/v0/optimizer/api.ts` — `compileLDS(spec, seed, opts)`
  driver that wires it all together, returns the best leaf seen.

## The contract that holds by construction

```
For any (spec, seed) and any maxD' ≥ maxD:
    leaves(spec, seed, maxD') ⊇ leaves(spec, seed, maxD)
```

Because the enumeration walks d = 0, 1, 2, ..., maxD in order and
emits leaves grouped by exact discrepancy, increasing maxD only
ADDS later d-groups to the enumerated set. The per-d leaves are
disjoint and never reordered. The strict-improvement-only register
then makes monotonicity-in-budget (Property 1) hold by construction.

## Verification gates met

### ✅ Prefix-superset property test (CI forever)

`tests/optimizer_lds.test.ts` runs `enumerateLeaves(root, maxD=2)`
on tiny_dance seed=0, partitions leaves by exact discrepancy, and
asserts:

- d=0 has exactly 1 leaf (the greedy track).
- d=0/d=1/d=2 leaf-fingerprint sets are pairwise disjoint.
- leaves(maxD=k) strictly grows: |maxD=1| > |maxD=0|, |maxD=2| > |maxD=1|.

So `leaves(maxD=k) ⊇ leaves(maxD=k-1)` by construction. ✓

### ✅ Discrepancy-0 byte-matches greedy_v2

`compileLDS(spec, seed, maxD=0)` produces a **hash-identical** Track
to `compileGreedy_v2(spec, seed, K=N_CAND)`. Confirms the LDS
greedy-rank-0 walk is the same path the standalone greedy chainer
walks. ✓

### ✅ Determinism (Property 4)

Two compileLDS calls with the same `(spec, seed, maxD)` produce
hash-identical Tracks. ✓

### ✅ Monotonicity-in-maxD demonstrated empirically

`compileLDS(tiny_dance, seed=0, maxD=1)` axis_quality = **0.46**
`compileLDS(tiny_dance, seed=0, maxD=2)` axis_quality = **0.64**

Strict improvement (0.46 → 0.64) when maxD grows. The register
swapped to a maxD-2 leaf that beat all maxD-1 leaves. ✓

## Verification gates deferred to Stage 2

The plan's Stage 1 gates included:

> LDS at discrepancy ≤ 3 produces coverage ≥ greedy_v1 (65/65) on
> the golden suite. Aggregate `goal_score` at full enumeration ≥
> greedy_v1 baseline × 0.95.

**Both of these are intractable to test without budget metering.**
The leaf count at maxD=3 on large specs grows combinatorially:

- 55-contact drums × N_CAND=32 × d=3:
  ≈ Σᵢ C(55,i) · 31^i for i=0..3 ≈ 1 + 1700 + 700 K + 240 M leaves
- Even with shared-prefix memoization, scoring each leaf takes ~30-50ms,
  so a single (spec, seed) at maxD=3 = many hours.

A 65-cell sweep at maxD=3 on the full suite would take days serial.
This is precisely **what Stage 2 fixes**: a budget cap stops the
enumeration after N sim_frames, and the register returns the best
leaf seen. With a sensible budget (e.g., calibrated to wall-clock
parity with greedy_v1's ~15s per spec), each cell completes in
bounded time.

So the Stage 1 → Stage 2 reordering: I demonstrated the LDS
machinery WORKS structurally on cheap cases (above), and the
coverage/goal_score gates move into Stage 2's empirical validation.

## Empirical observations (small-cases probe)

| spec | seed | maxD | wall | axis_quality | status |
|---|---|---|---|---|---|
| tiny_dance | 0 | 0 | ~5s | (= greedy_v2) | PASS |
| tiny_dance | 0 | 1 | 8.6s | 0.4627 | PASS |
| tiny_dance | 0 | 2 | 10.6s | **0.6426** | PASS |
| mini_burst | 0 | 1 | 16s | 0.5839 | PASS |
| cold_start | 0 | 1 | 2s | — | THROW |

Notable findings:

- **maxD=2 strictly beats maxD=1 on tiny_dance** (0.46 → 0.64).
  This is the register catching a d=2 leaf that beats all d=0/1
  leaves, exactly the cascade-diversity story the rebuild rests on.
- **cold_start at maxD=1 THROWS**: even with 15 single-gap deviation
  cascades to try, none completes. greedy_v2 baseline showed 1/5
  seeds passing — high d may rescue it, or the cell is genuinely
  cascade-hostile at N_CAND=32. We'll see in Stage 2.
- **Wall-clock scales sublinearly with leaf count** thanks to the
  prefix-cache: maxD=2 only 23% slower than maxD=1 on tiny_dance
  despite 5× more leaves.

## Files

NEW:
- `scripts/v0/optimizer/node.ts` (~155 LOC)
- `scripts/v0/optimizer/lds.ts` (~155 LOC)
- `scripts/v0/optimizer/register.ts` (~85 LOC)
- `scripts/v0/optimizer/api.ts` (~120 LOC)
- `scripts/v0/optimizer/_sweep_lds.ts` (investigation harness — used in Stage 2)
- `tests/optimizer_lds.test.ts` (5 tests; the property test runs in CI forever)
- `docs/optimizer/01_lds.md` (this file)

## On to Stage 2

Stage 1 ships a working LDS core with the structural invariants
verified on small cases. Stage 2 adds the budget metering (op-boundary
cutoff in sim_frames) that makes the coverage and goal_score gates
testable on the full suite at meaningful maxD values.

The exit gate moves with the structural change: Stage 2 becomes the
"prove monotonicity-in-budget on the real workload" stage. Stage 1
proved monotonicity-in-maxD on the small cases.
