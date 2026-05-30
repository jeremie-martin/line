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
3. a small handoff-state penalty for extreme vertical/angle states.

The preview is engine-in-loop and charged in simulated frames. It is also a pure
policy function of `(spec, seed, prefix)`: it does not read the remaining budget.
The budget only truncates how far through the deterministic prefix-node sequence
the compiler gets.

The preview candidate pool is spec-shape dependent but budget-independent:
medium-dense specs with 30-60 contacts score the top 5 local candidates, while
sparse specs and long dense specs score the top 8. The narrower pool gives the
drum frontier more prefix depth; the broader pool preserves quality on sparse
tracks and avoids dead-ending the long `solo_run` contact chain.

Medium-dense prefixes with no skipped contacts also get a small near-tail
completion step: once only the final three contacts remain, the compiler greedily
closes that suffix and offers the resulting terminal track to the register before
the normal soft-budget stop. This is still part of the fixed node-processing
sequence and is bounded by the same hard in-operation guard; it exists to avoid
throwing away a 53/55 prefix solely because the soft budget trips before two
ordinary expansions can run.

The frontier is split into pass-capable nodes and fallback nodes. A node remains
pass-capable while it has skipped no contacts; once a contact is skipped, that
branch is still deterministic and available as a fallback partial, but it cannot
produce a contract-passing track. The search therefore drains pass-capable nodes
before scoring or expanding skipped-contact fallback nodes. This is a
contract-level rule rather than a spec-shape rule: a skipped authored contact is
a hard failure on every spec.

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
quality carries the "how far through the spec did this prefix get?" signal.
Partial reports only score sections whose `t1` has been reached. This avoids
letting a tiny, unstable slice of a newly entered section make a deeper prefix
look worse than an earlier one. Once all contact gaps have been processed, the
same node becomes terminal and is scored over the full spec duration.

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
- deferred start/fallback nodes stop at the soft budget before they are
  requeued for expansion.

## Initial evidence

Targeted probes after removing the legacy optimized-preroll pre-pass, adding
explicit root/start alternatives, adding partial-prefix report semantics,
narrowing per-node branching to reduce suffix explosion, and replacing the
two-contact rollout with a one-contact/two-sample future feasibility probe.
The latest slice also narrows the preview candidate pool only on medium-dense
specs and adds a medium-dense near-tail completion step. Dense-opening start
feasibility is gated, so it does not affect these control rows:

| command | result |
|---|---|
| `npm run golden -- --compiler=handoff --specs=tiny_dance --seed=0 --budget=5000 --jobs=1 --json` | PASS, score 612.67, 4/4 contacts, 5.5k sim frames |
| `npm run golden -- --compiler=handoff --specs=mini_burst --seed=0 --budget=15000 --jobs=1 --json` | PASS, score 557.45, 7/7 contacts, 15.8k sim frames |
| `npm run golden -- --compiler=handoff --specs=cold_start --seed=0 --budget=30000 --jobs=1 --json` | PASS, score 411.59, 15/15 contacts, 30.6k sim frames |
| `npm run golden -- --compiler=handoff --specs=cold_start --seed=0 --budget=60000 --jobs=1 --json` | PASS, score 411.59, 15/15 contacts, 60.5k sim frames |

The `cold_start` 30k row is the important shape: explicit partial-prefix
semantics cut enough full-duration rescoring out of the early path that the same
budget now reaches a complete contract-passing track. The 60k row then shows the
cheaper preview preserving the completed track while exploring more alternatives.

Current frontier probes at the 40k campaign budget:

| command | result |
|---|---|
| `npm run golden -- --compiler=handoff --specs=drums_pendulum --seed=0 --budget=40000 --jobs=1 --json` | PASS, score 384.11, 55/55 hits, 40.5k sim frames |
| `npm run golden -- --compiler=handoff --specs=drums_crescendo --seed=0 --budget=40000 --jobs=1 --json` | PASS, score 337.43, 55/55 hits, 43.1k sim frames, 1/1 tail completion |
| `npm run golden -- --compiler=handoff --specs=solo_run --seed=1 --budget=40000 --jobs=1 --json` | FAIL, partial 52/72 hits, score ~0, 40.1k sim frames, 118 scored prefixes |

The same frontier at 60k:

| command | result |
|---|---|
| `npm run golden -- --compiler=handoff --specs=drums_pendulum --seed=0 --budget=60000 --jobs=1 --json` | PASS, score 390.77, 55/55 hits |
| `npm run golden -- --compiler=handoff --specs=drums_crescendo --seed=0 --budget=60000 --jobs=1 --json` | PASS, score 340.86, 55/55 hits |
| `npm run golden -- --compiler=handoff --specs=solo_run --seed=1 --budget=60000 --jobs=1 --json` | PASS, score 448.21, 77/77 hits |

The medium-dense drum frontier now passes at 40k. The latest change is the
near-tail completion: `drums_crescendo@40k` was already reaching a no-skip 53/55
prefix, but the soft budget stopped before the last two ordinary expansions. The
tail completion closes that deterministic suffix inside the existing hard
operation guard. The remaining measured 40k miss is `solo_run`, which is still
not near the tail at the soft stop; it needs a different long-dense policy, not
tangency or arc placement.

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
- The one-step preview is still a local heuristic. It clears the measured 60k
  frontier rows and the medium-dense drum rows at 40k, but not `solo_run@40k`.
- Full-duration terminal scoring is still expensive, and larger budgets can
  spend many evaluations on complete prefixes whose quality does not improve.
  Later slices should cache or score more selectively without changing the budget
  contract.
- The long dense `solo_run` row still misses contacts at 40k; it is too far from
  the tail for near-tail completion to help.
- Pass-capable/fallback frontier ordering cuts wasted skipped-contact prefix
  scoring on `solo_run@40k` and preserves the 60k pass, but candidate generation
  and preview work still dominate before the 77-contact pass is reached.
- Rejected long-dense probes: lowering the preview sample count, sparse partial
  scoring cadence, broad suffix completion from the final third, and reducing the
  long-dense candidate solve list all either regressed `solo_run@40k` reachability
  or lowered the 60k passing quality. The remaining lever is not simply "make each
  node cheaper"; it needs a better long-dense mainline policy.
- Additional trace on `solo_run@40k seed=1`: the search does reach no-skip
  prefixes through 54 contacts before the soft stop, but the strict failing-score
  comparator keeps an earlier 51-hit prefix because later prefixes lose enough
  axis quality to offset survival progress. A cheap cost-greedy suffix from that
  region also failed, so the missing policy is not just "try a greedy tail".
- Completed-section partial reports address part of that trace by not scoring a
  newly entered section until its end has been reached; this moves the returned
  `solo_run@40k seed=1` prefix from 51/71 to 52/72, but does not solve the long
  dense row by itself.
- Root alternatives are currently only a cheap heuristic top set. They make the
  search structure right, but have not yet delivered a measured quality win over
  the default start on the probe rows.
- Full golden-suite parity and the `GOAL_LDS_LOW_BUDGET.md` stop conditions are
  not met yet.

## Next work

1. Add a long-dense policy for `solo_run@40k`, likely by making the mainline
   completion cheaper before it reaches the tail.
2. Make start-state exploration iterative rather than a fixed small top set.
3. Measure the budget curve on the current frontier specs before tuning constants.
4. Only consider default cutover after full compiler-goal acceptance sweeps pass.
