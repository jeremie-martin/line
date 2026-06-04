# Handoff Prefix Search

Status: active default compiler.

`scripts/v0/optimizer/handoff.ts` compiles by searching partial track prefixes
at gap boundaries. A node contains committed fits, prefix engine state, selected
start-state rank, next line id, and skipped-contact count.

## Search Shape

Expansion is one gap at a time. During contract search, each contact gap's
engine-validated arc fits are ranked by:

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
prefix. Before any passing output exists, normal expansion samples a 14-attempt
prefix; sparse contact cadences use a 13-attempt prefix so they can expose a
complete track earlier. After the register has a passing output, expansion
widens to a 16-attempt prefix for quality search. If rescue escalates to 32 or
80 attempts, the cache burns RNG
state for the already-sampled attempts and simulates only the additional
attempts, preserving the exact full-batch candidate order without paying
duplicate physics work. If a larger prefix is already cached, smaller-K lookahead
requests are answered by filtering the stored sample attempts, so the smaller
deterministic prefix is still exact.

The preview is engine-in-loop and charged in simulated frames. It is also a pure
policy function of `(spec, seed, prefix)`; it does not read the requested
budgets. Budgets only define checkpoints along the deterministic prefix-node
sequence. Future-contact previews use the same extendable per-node candidate
cache as expansion, and expansion carries the previewed child node forward, so
the previewed first future-contact sample can be reused when that branch is
later expanded. The preview's first future local cost is a small ranking signal
for smooth axes, reusing work the probe already performed.

After the register has a full contract-passing incumbent, normal quality search
stops doing future-contact previews. At that point the contract is already
protected by the incumbent, and focused probes showed that the preview rollouts
spent late budget on speculative one-contact checks instead of evaluating more
whole-track alternatives. Quality-phase candidate ranking still uses local axis
cost, handoff-state penalties, overshoot penalties, reuse candidates, and brake
candidates; the saved preview work is spent on expanding and scoring actual
branches.

Near-tail completion is an exception to future previewing inside candidate
ranking: the suffix completion itself is already rolling the future forward. It
ranks local options without nesting another one-contact preview, which avoids
duplicate speculative simulation in the most budget-sensitive part of the
search. The suffix walk starts with up to six remaining contacts, but only
after at least one real catch has already been committed; this prevents a short
four-contact spec from becoming a whole-track greedy solve from the root. The
greedy suffix path remains first, and if it hits a local dead end the completion
can backtrack to the second-ranked local option within the same bounded window.

The frontier prioritizes branches with no skipped contacts. Skipped-contact
branches remain available as honest fallback partial outputs, but they cannot
produce a contract-passing track. Normal selection is LIFO, with one narrow
exception: after a contract-passing output exists but its axis quality is still
very low, handoff periodically pulls an older pass-frontier branch that lags the
deepest seen prefix. This is still a deterministic policy sequence and does not
read the requested budgets; it only keeps a poor early branch from monopolizing
the quality phase. Checkpoint stats record the remaining frontier size,
pass/fallback split, min/max remaining gap, deepest seen gap, oldest-gap lag,
mean lag, count of branches at least three gaps behind, and the number of
far-back pulses used.

Initial conditions are part of the same search. If a spec has `preroll > 0` and
no manual `start`, handoff builds deterministic root velocity alternatives and
orders hard openings with a small first/second-contact feasibility probe. For
high-speed openings, that probe uses the same speed/air overshoot penalty as
handoff candidate ranking, so early root ordering does not seed avoidable speed
creep before normal expansion starts. Lower-speed openings keep the cheaper
symmetric local-cost probe. The selected root nodes carry the first-contact
candidate cache from that probe, so real expansion extends the sampled prefix
instead of replaying it. Repeated extension of the same parent by the same
sampled candidate is cached too, so the second-contact lookahead can seed the
child node later used by preview and expansion. Checkpoint stats also count start
ranks seen versus start ranks that reach a committed catch, which distinguishes
"alternative starts were considered as roots" from "alternative starts actually
received search budget."

Handoff-only extra candidates are cached at the node as well. Reuse catches and
brake catches are deterministic prefix-state probes, so when tail completion and
normal expansion both rank the same node, the compiler reuses the already
validated extra candidates while still recomputing scoring for the current
ranking mode. Brake probes remain local-policy work: speed-targeted gaps at the
authored minimum are excluded, and eligible targets use raw-velocity boundaries
derived from the authored speed ruler (`speed=0.78` for the mild gate and
`speed=1.0` for the hard cap). Once the local rider speed reaches the target,
contract search samples two brake attempts, or three at stronger overspeed; after
a passing output exists, quality search samples one additional local brake
attempt. This adapts to spec/search difficulty, not to the caller's checkpoint
budgets.

Detector evaluation results are cached per search node within one compile call.
The same prefix can be offered to the register from start-option deferral or
near-tail speculative completion; reusing its report/key avoids duplicate
trajectory extraction while preserving the same register offer order.

After a full contract-passing output has reached the register, nonterminal
partial reports are dominated because they still include future missing contacts
and a pre-end terminus. Handoff still expands those nodes and still evaluates
terminal/tail-completed leaves, but it skips the dominated partial detector
offer so the remaining budget is spent on outputs that can improve the passing
incumbent.

## Budget Contract

Every scored prefix output is offered to the strict best-so-far register. Larger
budget checkpoints see a prefix superset and cannot return a strictly worse
comparator key.
The only skipped reports are nonterminal partials after a passing full-duration
incumbent exists; those reports cannot dominate that incumbent under the
register comparator.

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

- better handoff-state scoring for catchability;
- more informative future-contact previews without over-steering brittle
  contact-style catches;
- iterative start-state exploration;
- selective full-duration terminal scoring or cache reuse;
- ancestor repair, but only after the frontier-depth diagnostics show that late
  budget is leaving useful older branches behind.
