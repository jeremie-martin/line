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
may spend a larger deterministic rescue batch at true local dead-ends. Two
rescues are currently enabled:

- a moderate-speed overshoot rescue for physically catchable braking states;
- a short-deadline rescue for clean prefixes at sub-0.3s required-contact gaps.

Both keep the common path cheap and budget-independent: they run only after the
normal batch has no viable catch, and the policy is a pure function of the local
gap/prefix state, not remaining budget.

Candidate sampling is memoized per search node as an extendable deterministic
prefix. If rescue escalates from the normal 16 attempts to 32 or 80, the cache
burns RNG state for the already-sampled attempts and simulates only the
additional attempts, preserving the exact full-batch candidate order without
paying duplicate physics work. If a larger prefix is already cached, smaller-K
lookahead requests are answered by filtering the stored sample attempts, so the
smaller deterministic prefix is still exact.

The preview is engine-in-loop and charged in simulated frames. It is also a pure
policy function of `(spec, seed, prefix)`; it does not read the remaining budget.
Budget only truncates how far through the deterministic prefix-node sequence the
compiler gets. Future-contact previews use the same extendable per-node
candidate cache as expansion, and expansion carries the previewed child node
forward, so the previewed first future-contact sample can be reused when that
branch is later expanded.

Greedy near-tail completion is an exception to future previewing inside
candidate ranking: the suffix completion itself is already rolling the future
forward. It ranks local options without nesting another one-contact preview,
which avoids duplicate speculative simulation in the most budget-sensitive part
of the search.

The frontier prioritizes branches with no skipped contacts. Skipped-contact
branches remain available as honest fallback partial outputs, but they cannot
produce a contract-passing track.

Initial conditions are part of the same search. If a spec has `preroll > 0` and
no manual `start`, handoff builds deterministic root velocity alternatives and
orders hard openings with a small first/second-contact feasibility probe. The
selected root nodes carry the first-contact candidate cache from that probe, so
real expansion extends the sampled prefix instead of replaying it. Repeated
extension of the same parent by the same sampled candidate is cached too, so the
second-contact lookahead can seed the child node later used by preview and
expansion.

Handoff-only extra candidates are cached at the node as well. Reuse catches and
brake catches are deterministic prefix-state probes, so when tail completion and
normal expansion both rank the same node, the compiler reuses the already
validated extra candidates while still recomputing scoring and previews for the
current ranking mode.

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

- `SCORE 312.15`
- `valid 60/60`
- `contract_pass_rate 100%`

The same budget with report-only timing variants reports `120/120` valid rows
with `variant_report_score 304.36`.

## Known Frontier

At the 50k campaign budget, all base rows pass the hard contract. The remaining
frontier is robustness and quality.

The former late-speed frontier rows (`verse_chorus`, `drums_swell`,
`drums_breath`), the hot opening row (`opening_burst`), and the sustained-density
`solo_run` row all pass 3/3 in the base suite.

Promising areas:

- better handoff-state scoring for catchability;
- cheaper, more informative future-contact previews;
- iterative start-state exploration;
- selective full-duration terminal scoring or cache reuse.
