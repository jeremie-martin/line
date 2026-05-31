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

If that cheap normal batch finds no viable catch for a required contact, handoff
may spend one larger deterministic rescue batch, but only for a physically
catchable moderate-speed overshoot state. This keeps the common path cheap and
avoids starving very dense runs, while giving late speed-saturation prefixes a
last local chance before becoming skipped-contact fallbacks.

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
npm run golden -- --jobs=60 --budget=50000 --compiler=handoff
```

Current 20-spec result:

- `SCORE 301.21`
- `valid 58/60`
- `contract_pass_rate 97%`

The same budget with report-only timing variants reports `112/120` valid rows.

## Known Frontier

At the 50k campaign budget, the remaining hard rows are `opening_burst` seeds 0
and 1: the hot dense opening misses one early contact before the search has a
clean prefix. The former late-speed frontier rows (`verse_chorus`,
`drums_swell`, `drums_breath`) and the sustained-density `solo_run` row pass
3/3.

Promising areas:

- better handoff-state scoring for catchability;
- cheaper, more informative future-contact previews;
- iterative start-state exploration;
- selective full-duration terminal scoring or cache reuse.
