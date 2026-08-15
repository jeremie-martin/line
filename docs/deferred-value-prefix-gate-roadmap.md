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

A fallback node may carry skipped authored contacts, so its selected and
incumbent axis counts can differ. The counts make that non-like-for-like case
explicit; it is retained for structural diagnosis but is ineligible for every
offline rule. A zero-skipped-contact pass checkpoint must have equal counts.

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
| 2026-08-15 | Checkpoint implementation and mechanism smoke | complete | Four 750k cells: checkpoints reconcile with processed nodes; three cells shared with the fixed live panel are exact in score, track, report, first terminal, prior attempt counters, and Budget Telemetry; the fourth is exact against the earlier mechanism archive except for the subsequently added atomic-frame ledger |
| 2026-08-15 | Fixed observation map and offline rule gate | complete, family closed | 80 new compiles compared with the archived live arm; 80/80 exact behavior; no frozen rule passes both budgets |

## Observation result

The one-arm map completed all 80 cells. Against the exact pre-instrumentation
live archive, all 80 preserve validity, final score, final track, report,
first-terminal frame/hash, every prior selective counter, the full Budget
Telemetry ledger, ordinary repair, and final-output attribution. The map
records 1,430 checkpoints over 33 actions at 750k and 1,348 over 29 actions at
1.25M. Thirty-two and 28 actions respectively contain at least two eligible
zero-skipped high-water checkpoints. Every action's first concrete divergence
is exactly one gap before its action start.

No frozen persistence rule clears both budgets. The zero-delta rules have ample
coverage and predicted saved work but trigger eight of 16 improving actions at
750k and nine of 14 at 1.25M. A 0.05 loss delta persisted for three contacts is
the low-budget near miss: it triggers four non-improving actions in four sources,
no improving action, and represents 12.2% of all action work, but at 1.25M it
also triggers one action whose eventual terminal improves the register. A 0.10
delta persisted for three contacts is safe and useful at 1.25M (five
non-improving actions, four sources, 18.9% work) but fires only once at 750k.
The exact repeated-threshold family is therefore closed without a live arm.

This is a useful negative result rather than evidence against prefix comparison
in general. The failed improving action is temporarily worse for the first
three eligible observations and recovers at the next contact. Repeated early
testing therefore confounds temporary trajectory investment with persistent
uncompetitiveness. A distinct future scheme may buy one fixed lookahead horizon
and make one continuation decision, analogous to a small tournament, rather
than repeatedly asking whether to abort. That scheme requires a separate
roadmap and fresh score evidence; it cannot be smuggled into this closed family
by adding a fourth persistence threshold.

Supporting archive and report:

- `generated/benchmark-v2/mover-grid/deferred-prefix-map-two-budget-n4/candidate.json`
- `generated/benchmark-v2/mover-grid/deferred-prefix-map-two-budget-n4/analysis.json`
