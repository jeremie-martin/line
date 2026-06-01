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
policy function of `(spec, seed, prefix)`; it does not read the requested
budgets. Budgets only define checkpoints along the deterministic prefix-node
sequence.

The frontier prioritizes branches with no skipped contacts. Skipped-contact
branches remain available as honest fallback partial outputs, but they cannot
produce a contract-passing track.

Initial conditions are part of the same search. If a spec has `preroll > 0` and
no manual `start`, handoff builds deterministic root velocity alternatives and
orders hard openings with a small first/second-contact feasibility probe.

## Budget Contract

Every scored prefix output is offered to the strict best-so-far register. Larger
budget checkpoints see a prefix superset and cannot return a strictly worse
comparator key.

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
npm run golden -- --jobs=4 --compiler=handoff
```

The command reports `CURVE_SCORE`, per-budget scores, row checkpoint hashes, and
compact checkpoint stats. Targeted probes use the same shape:

```bash
npm run golden -- --specs=tiny_dance,opening_burst --seed=0 --budgets=30000,50000,70000 --verify-checkpoints
```

## Known Frontier

The budget curve separates search-bound rows, budget-bound rows, and early
plateaus. The next useful work is to move improvements earlier on the curve and
raise the plateau without making budget a policy input.

Promising areas:

- long-dense policy for sustained periodic contact chains;
- better handoff-state scoring for catchability;
- cheaper, more informative future-contact previews;
- iterative start-state exploration;
- selective full-duration terminal scoring or cache reuse.
