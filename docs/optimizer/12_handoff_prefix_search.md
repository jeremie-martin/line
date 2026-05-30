# Handoff prefix search

Status: first implementation slice, not cut over.

## What changed

`scripts/v0/optimizer/handoff.ts` adds a new compiler path that does not use LDS
whole-track leaves. A search node is a partial prefix at a gap boundary:

- prefix fits committed so far;
- prefix engine state;
- selected start-state rank;
- next line id;
- skipped-contact count.

Expansion is one gap at a time. For each contact gap, candidates are still the
existing engine-validated arc fits, but the search order is no longer "cheapest
local fit only" or "full-track LDS discrepancy from a greedy spine". Each
candidate is ranked by:

1. local axis cost;
2. first future-contact feasibility: whether the next contact has any survivors,
   how many survivors it has, and the cheapest survivor cost;
3. a small two-contact rollout tiebreak, so candidates that keep landing beyond
   the first preview contact get a slight preference;
4. a small handoff-state penalty for extreme vertical/angle states.

The preview is engine-in-loop and charged in simulated frames. It is also a pure
policy function of `(spec, seed, prefix)`: it does not read the remaining budget.
The budget only truncates how far through the deterministic prefix-node sequence
the compiler gets.

Initial conditions are now part of the same search. If a spec has `preroll > 0`
and no manual `start`, `compileHandoff` generates a small deterministic set of
root velocity alternatives (default plus the top heuristic starts from the first
section's speed/air targets). These are ordinary root nodes, scored before normal
gap expansion, and capped at 4 options so they do not consume the low-budget run
before the first track can complete. Manual `start` and `preroll=0` specs expose
one root option.

For dense, hard openings, the root alternatives are ordered with a small
engine-in-loop first/second-contact feasibility probe. Easy openings keep the
cheap heuristic order so the start probe cannot consume the tiny-spec budget.
The gate is based on local timing and axes only: early first contact, short
second interval, and opening speed/air/contact pressure.

## Budget contract

The handoff path uses the same register comparator as LDS. Every scored prefix
output is offered to the strict best-so-far register, so larger budgets see a
prefix superset and cannot return a strictly worse comparator key.

Nonterminal prefixes have explicit partial-output semantics. They are evaluated
only through their committed horizon plus a short detector margin, their track
duration includes that short margin, and their report contains contacts up to
the processed horizon plus a bounded window of immediate future contacts marked
missing. If the truncated detector reaches the horizon, the report terminus is
forced to a failing `rideStalled` terminus at the cutoff. The bounded future
window keeps partial prefixes honest without letting a long-spec tail of
unreached contacts annihilate the score below the comparator epsilon; survival
quality carries the "how far through the spec did this prefix get?" signal. Once
all contact gaps have been processed, the same node becomes terminal and is
scored over the full spec duration.

The handoff test now points the architecture-agnostic contract harness at
`compileHandoff`:

```
npx vitest run tests/optimizer_handoff.test.ts
```

Covered in that test:

- determinism for same `(spec, seed, budget)`;
- monotonic comparator key across budgets;
- freeze above fixed `maxNodes` full-search cost;
- honest partial/failing output at a budget as small as 1 simulated frame.

## Initial evidence

Targeted probes after removing the legacy optimized-preroll pre-pass, adding
explicit root/start alternatives, demoting the two-contact rollout to a
tiebreak, adding partial-prefix report semantics, and narrowing per-node
branching to reduce suffix explosion. Dense-opening start feasibility is gated,
so it does not affect these control rows:

| command | result |
|---|---|
| `npm run golden -- --compiler=handoff --specs=tiny_dance --seed=0 --budget=5000 --jobs=1 --json` | PASS, score 612.67, 4/4 contacts, 5.0k sim frames, 4 start options |
| `npm run golden -- --compiler=handoff --specs=mini_burst --seed=0 --budget=15000 --jobs=1 --json` | PASS, score 500.29, 7/7 contacts, 15.2k sim frames, 4 start options |
| `npm run golden -- --compiler=handoff --specs=cold_start --seed=0 --budget=30000 --jobs=1 --json` | PASS, 15/15 contacts, score 218.66 |
| `npm run golden -- --compiler=handoff --specs=cold_start --seed=0 --budget=60000 --jobs=1 --json` | PASS, 15/15 contacts, score 270.91 |

The `cold_start` 30k row is the important shape: explicit partial-prefix
semantics cut enough full-duration rescoring out of the early path that the same
budget now reaches a complete contract-passing track. The 60k row then shows the
narrower branch factor spending follow-up budget on better prefixes rather than
late suffix variants of the first passing path.

Current frontier probes at the 40k campaign budget:

| command | result |
|---|---|
| `npm run golden -- --compiler=handoff --specs=drums_pendulum --seed=0 --budget=40000 --jobs=1 --json` | FAIL, partial 20/42 hits, 2 in-horizon missing + 20 future-window missing, horizon frame 423 |
| `npm run golden -- --compiler=handoff --specs=drums_crescendo --seed=0 --budget=40000 --jobs=1 --json` | FAIL, partial 34/55 hits, 1 in-horizon skip plus later skips, horizon frame 788 |
| `npm run golden -- --compiler=handoff --specs=solo_run --seed=1 --budget=40000 --jobs=1 --json` | FAIL, terminal 57/77 hits, 20 missing |

The frontier rows are still failures, but the failure mode has moved from
"budget-exempt floor prevents search" to budget-subject prefix progress with
clear skip ownership. The next lever is candidate/backtracking policy around
the skipped contact gaps, not tangency or arc placement.
The `drums_crescendo` opening specifically moved from 4/25 partial hits to
34/55 partial hits after gated root-start feasibility ordering.

## Deliberate differences from LDS

- No budget-exempt d=0 floor.
- No leaf equals "regenerate a full track from scratch".
- No hidden optimized-preroll pass before the search. Initial conditions are
  explicit root alternatives in the handoff search.
- No arc-placement/tangency changes.

## Known gaps

- This is not yet the default compiler.
- Partial report semantics are pinned only for `compileHandoff`; the legacy LDS
  path still evaluates whole-track leaves.
- The rollout preview is still a local heuristic. As a tiebreak it preserves
  low-budget contact completion on the probe rows, but it has not improved
  `cold_start` quality by itself after the first passing track is found.
- Full-duration terminal scoring is still expensive, and larger budgets can
  spend many evaluations on complete prefixes whose quality does not improve.
  Later slices should cache or score more selectively without changing the budget
  contract.
- Frontier dense specs still miss contacts at 40k; handoff currently records the
  skipped gaps but does not repair them with targeted local backtracking.
- Root alternatives are currently only a cheap heuristic top set. They make the
  search structure right, but have not yet delivered a measured quality win over
  the default start on the probe rows.
- Full golden-suite parity and the `GOAL_LDS_LOW_BUDGET.md` stop conditions are
  not met yet.

## Next work

1. Replace the heuristic rollout with a cheap backward catchability table or
   measured multi-gap feasibility estimate.
2. Make start-state exploration iterative rather than a fixed small top set.
3. Measure the budget curve on the current frontier specs before tuning constants.
4. Only consider default cutover after full compiler-goal acceptance sweeps pass.
