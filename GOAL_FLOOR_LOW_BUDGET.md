# Goal - floor campaign for low-budget optimizer

> This is the operating contract for work on the optimizer floor only.
> It complements `GOAL_LDS_LOW_BUDGET.md`; it does not replace the compiler
> goals in `docs/compiler_goals.md`.

---

## 0. Why this exists

The low-budget LDS campaign identified the active bottleneck: the current
`d=0` floor can consume the entire useful budget before repair or deviation
search runs. That means the whole compiler can satisfy monotonicity on paper
while still failing the practical goal: a small budget should buy meaningful
work.

This document isolates that problem. The floor is not sacred. It is one design
choice among several ways to give the optimizer an initial result and a search
coordinate system.

## 1. What the current floor is

The current LDS floor is `buildBacktrackingLeaf(...)` in
`scripts/v0/optimizer/lds.ts`.

It is a deterministic completion descent:

- sample the fixed `N_CAND=32` candidates at a contact gap;
- sort viable candidates by local cost;
- commit the cheapest untried candidate;
- if a later gap dead-ends, backtrack to an earlier contact gap and try its next
  candidate;
- if the per-failure backtrack allowance is exhausted, skip that contact and
  continue;
- return the first full leaf that reaches the end of the gap list.

`enumerateLeaves(...)` yields this floor first. Guided repair and LDS
deviations only start after the floor leaf exists.

The current floor is budget-exempt at the soft boundary: the base call passes no
`budgetUnits` cutoff. In a full `compileLDS` run, however, the global hard guard
still applies, so a very low budget can throw before the floor completes.

## 2. The design question

Do not assume the answer is "make the current completion floor faster." The real
question is which floor contract the new optimizer should have.

### Option A: completion floor

The floor must return a full end-of-spec leaf before any optional search runs.

Strengths:

- simple best-so-far story;
- LDS deviations can be defined relative to a complete base path;
- the register always has a full-track incumbent if the floor fits under the
  hard guard.

Weaknesses:

- low budgets are often not meaningful on hard rows;
- a whole-track descent remains the prerequisite for local search;
- expensive backtracking is hidden in the mandatory prelude;
- failures are all-or-nothing if the hard guard trips before the first leaf.

### Option B: progressive floor

The floor may return a prefix or explicit best-effort partial result, and the
search owns completion.

Strengths:

- the budget can buy useful prefix progress immediately;
- failure is incremental instead of all-or-nothing;
- the optimizer can reason at the same per-gap granularity as candidate
  generation.

Weaknesses:

- LDS's current base-relative coordinate system no longer applies unchanged;
- partial-output comparator semantics must be explicit;
- a full-track incumbent is no longer guaranteed at tiny budgets;
- acceptance tests must prove monotonicity against the new prefix sequence.

The scaffolding for this campaign should make both options measurable. It should
not encode completion-floor assumptions into every metric.

## 3. What to measure

For every floor experiment, collect these fields per `(spec, seed)`:

- `floor_contract`: e.g. `completion`, later possibly `progressive`;
- `guard`: whether a compile-style hard guard was installed;
- `budget_units` and hard-guard limit when present;
- `status`: `ok`, `physics_limit`, or `error`;
- `floor_sim_frames`;
- wall-clock milliseconds;
- contact count, committed contact fits, skipped contact gaps;
- first skipped contact gap;
- floor backtracks;
- candidate-cache hits and misses;
- output hard-contract status after scoring the floor result;
- hits, missing, drift, off-beat, survival terminus, and axis quality.

Useful derived signals:

- floor sim frames as a multiple of the campaign budget;
- whether repair/deviation search would have any budget left;
- whether the floor lands all contacts but still fails assembled-track contract;
- whether cost goes into candidate generation, backtracking, or scoring.

## 4. Probe harness

Use the committed floor-only probe:

```
npx tsx scripts/v0/optimizer/floor_probe.ts --specs=drums_pendulum,drums_crescendo,solo_run --seeds=0,1,2 --budget=40000 --json
```

Useful modes:

```
npx tsx scripts/v0/optimizer/floor_probe.ts --specs=solo_run --seeds=1 --budget=40000 --guard=hard --json
  # Current compileLDS-like behavior: soft-exempt floor with the +20% hard guard.

npx tsx scripts/v0/optimizer/floor_probe.ts --specs=solo_run --seeds=1 --guard=none --json
  # Intrinsic completion-floor cost with no hard guard.
```

The probe intentionally measures the floor directly rather than going through
`golden.ts`, so the output is about the floor and not about repair, LDS
deviations, polish, worker timeouts, or suite aggregation.

## 5. Rules for floor changes

- Keep determinism: same `(spec, seed, floor mode)` must produce byte-identical
  floor output and identical floor stats.
- Do not move the scorer, specs, detector contract, or physics engine.
- Do not hide work outside the sim-frame budget unit.
- Do not tune by spec name.
- Prefer mechanisms that change the floor contract explicitly over accidental
  partial behavior.
- Record rejected probes in this document or `docs/optimizer/low_budget_findings.md`
  with numbers.

## 6. Known evidence

From `docs/optimizer/low_budget_findings.md`:

- Lowering `N_CAND` was catastrophic for completion.
- Early-stop/adaptive sampling was net negative because it caused more
  backtracking.
- Cheaper bisection and cheap-fail bailouts did not preserve completion.
- Radius widening improved some rows but regressed the suite.
- Lazy first-viable completion was chaotic and often increased floor cost.

The repeated pattern is that cost-best-of-32 is stabilizing, but the resulting
whole-track floor is too expensive to be the mandatory prelude for low budgets.

## 7. Current best hypotheses

Most promising completion-floor improvement:

- residual-aware candidate ranking/targets, especially grain residuals first,
  so the cost-best candidate becomes more downstream-compatible without changing
  the floor's deterministic completion contract.

Most promising architectural improvement:

- replace the mandatory whole-track floor with a progressive floor and a
  prefix-search coordinate system, while preserving the best-so-far monotonic
  budget contract.

The probe harness is deliberately neutral between those paths.
