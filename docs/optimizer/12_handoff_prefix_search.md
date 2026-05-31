# Handoff Prefix Search

Status: active default compiler.

`scripts/v0/optimizer/handoff.ts` compiles by searching partial track prefixes
at gap boundaries. A node contains committed fits, prefix engine state, selected
start-state rank, next line id, and skipped-contact count.

## Search Shape

Expansion is one gap at a time. For each contact gap, candidates are
engine-validated arc fits ranked by:

1. local axis cost;
2. first future-contact feasibility, including survivor count;
3. a handoff-state penalty for extreme vertical/angle states;
4. speed/air overshoot penalties where appropriate.

The preview is engine-in-loop and charged in simulated frames. It is also a pure
policy function of `(spec, seed, prefix)`; it does not read the remaining budget.
Budget only truncates how far through the deterministic prefix-node sequence the
compiler gets.

The frontier prioritizes branches with no skipped contacts. Skipped-contact
branches remain available as honest fallback partial outputs, but they cannot
produce a contract-passing track.

Initial conditions are part of the same search. If a spec has `preroll > 0` and
no manual `start`, handoff builds deterministic root velocity alternatives and
orders hard openings with a small first/second-contact feasibility probe.

## Budget Contract

Every scored prefix output is offered to the strict best-so-far register. Larger
budgets see a prefix superset and cannot return a strictly worse comparator key.

Nonterminal prefixes have explicit partial-output semantics: they are evaluated
through their committed horizon plus a short detector margin, include a bounded
window of immediate future contacts marked missing, and force a failing terminus
at the cutoff if the detector reaches the horizon. Terminal prefixes are scored
over the full spec duration.

Run the focused contract tests with:

```bash
npx vitest run tests/optimizer_handoff.test.ts
```

## Campaign Command

```bash
npm run golden -- --jobs=4 --budget=40000 --compiler=handoff
```

Before the cleanup that made handoff the only/default compiler, this command
reported:

- `SCORE 354.55`
- `valid 36/39`
- `contract_pass_rate 92%`

The same result should hold after housekeeping.

## Known Frontier

At the 40k campaign budget, the remaining hard rows are mainly budget-bound
around `solo_run` seed 0 and `opening_burst` seeds 0/2. They improve at higher
budgets, so the next useful work is to reach better complete prefixes sooner
without making budget a policy input.

Promising areas:

- long-dense policy for sustained periodic contact chains;
- better handoff-state scoring for catchability;
- cheaper, more informative future-contact previews;
- iterative start-state exploration;
- selective full-duration terminal scoring or cache reuse.
