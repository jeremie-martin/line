# Deferred-value prefix-competitiveness roadmap

## Question

The first deferred-value suffix rule is closed: it spends useful work often
enough to expose better terminals, but a completed suffix that does not improve
the register displaces too much ordinary repair. The next question is narrower
and distinct from retuning its 40% allowance:

> While the isolated suffix is running, can its authored-axis progress against
> the already known first-terminal incumbent identify an uncompetitive route
> early enough to preserve useful fixed-budget work?

The first stage is observation-only. It does not prune a node, stop an attempt,
change ranking, regenerate a candidate, or alter any budget decision. Production
defaults remain untouched. Authored impact and the full authored score remain
the optimization target; feasibility and prefix-axis observations are
diagnostics only.

## Exact comparison

At the beginning of the existing
`selective-axis-regret-catchup-value-deferred-initial` action, freeze the exact
first improving terminal as the comparison incumbent. Its identity cannot
change during the observation.

For every node selected by the isolated local frontier, before that node is
evaluated or expanded:

1. Find the first gap whose concrete `prefixFits` object differs from the frozen
   incumbent. Object identity is intentional: this is the exact generated path,
   not a reconstructed geometric approximation.
2. Compare the selected prefix and incumbent through the selected node's gap.
   Use only scorer-authored axes, scorer target values, and already settled
   incoming fits. Report-only axes are excluded exactly as in the scorer.
3. Record both whole-prefix and divergent-suffix axis count, squared error,
   normalized axis loss, and loss delta (`selected - incumbent`). Also record
   per-axis divergent-suffix squared-error deltas and the latest comparable
   authored-contact loss delta.
4. Record selection order, charged work since action start, estimated-work
   fraction, gap/contact advance, pass/fallback state, and whether this is a new
   selected-depth high-water mark.
5. After the attempt ends, label whether the selected prefix belongs to the
   exact terminal path actually offered by the action. This label is analysis
   only and is unavailable to a live decision.

These calculations must not call the engine, evaluate an output, offer a
register candidate, or increment charged simulation work.

## Trust gate

Re-run the same 80 cells used by the closed live screen: ten compact-panel
sources, actual seeds 174-177, and budgets 750k and 1.25M. Compare them against
the archived pre-instrumentation live arm. Every pair must preserve:

- validity, final track hash, and final score;
- first-terminal frame and track hash;
- deferred selection, outcome, work, node, proposal, geometry, frontier-return,
  and register-improvement counters;
- every Budget Telemetry episode, segment, and atomic-node ledger;
- every ordinary-repair episode and final-output lane.

Any mismatch closes the map until its cause is understood. The map needs only
80 new compiles because the pre-instrumentation arm is the exact fixed
reference; it must not rerun that reference.

## Frozen offline rule family

The map may characterize the following eight rules and no fitted threshold.
Each rule reads only new-high-water, zero-skipped-contact selections, begins
after at least three comparable authored contacts beyond the first divergent
gap, and fires when divergent-suffix normalized axis loss is worse than the
incumbent by more than a fixed delta for consecutive eligible checkpoints:

| Loss delta | Persistence |
|---:|---:|
| 0.00 | 2 or 3 contacts |
| 0.05 | 2 or 3 contacts |
| 0.10 | 2 or 3 contacts |
| 0.20 | 2 or 3 contacts |

For an observation-only counterfactual, firing means ending the optional action
before that selected atomic node and returning all of its local frontier. It
does not claim to know the downstream repair result. Estimated saved work is
only the action's observed remaining charged work.

Select the earliest-firing rule, with ties favoring the larger loss delta and
then greater persistence, only if at each budget it:

- fires on no action whose observed terminal improved the internal register;
- fires on at least four non-improving/yielded actions across at least three
  sources;
- saves at least 10% of observed action work in aggregate; and
- has at least two eligible checkpoints in at least eight actions, so the rule
  is not inferred from a tiny structural corner.

This selection cannot read paired final score, final output lane, or downstream
repair acceptance. Those fields may be reported later only as descriptive
context. If no frozen rule clears, close this early-stop family. Do not invent
another threshold from the same cells.

## Fresh live gate

If and only if the offline gate clears, implement the selected rule under a new
explicit experimental policy. Freeze its semantics before fresh seeds. The
live arm must return every local frontier node, attribute saved work explicitly,
and then run ordinary repair unchanged.

Use the same ten sources, both budgets, and four fresh seeds. Promotion requires
all candidate cells valid; exact first-terminal identity; positive total and
active means at both budgets; at least three positive seed blocks at one budget
and two at the other; no 20-point loss; actions in eight runs/four sources per
budget; and no regression in completion or contract survival. A pass earns one
fresh confirmation panel before any canonical V2 run. A failure closes the
exact rule without threshold adjustment.

## Progress ledger

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Question, observation semantics, frozen rule family, and gates | complete | This document |
