# Repair scheme space

## Purpose

This note steps back from tuning the accepted repair controller. It defines a
small set of structurally different but compatible repair schemes, states what
the retained evidence can and cannot tell us, and fixes the order in which they
should be tested.

Production still optimizes the authored specification and Benchmark V2 score.
Incumbent gap SSE and the feasibility/cost estimator are diagnostic decision
inputs; neither may rewrite authored impact or cap the specification.

## Shared repair skeleton

All schemes in the first family retain the accepted mechanism:

1. Reach a complete incumbent.
2. Recompute the incumbent report and measured cost-to-end profile.
3. Use the remaining repair budget and the estimator upper bound to determine
   which restart anchors are affordable.
4. Choose one anchor independently from the current best incumbent.
5. Rebuild its suffix with a fresh deterministic search stream and ordinary
   frontier DFS, stopping after at most one complete alternative.
6. Adopt the alternative only if it strictly improves the global register.
7. Repeat from the current best incumbent while budget remains.

This keeps restart selection separate from suffix search and global acceptance.
It also means a negative result for one selection law is not evidence against
repair as a whole.

## Evidence before execution

The offline replay uses the 1,947 repair decisions in
`generated/benchmark-v2/scale/repair-max-parent-depth-6-8.json.checkpoint.jsonl`.
The generated report is
`generated/benchmark-v2/scale/repair-depth-six-scheme-space-n8.md`.

Direct observations:

- The accepted controller's selected gap contains a median 32.1% of the SSE in
  the suffix its anchor can change (IQR 13.8–73.4%). A single-gap objective is
  therefore often only a partial description of the work exposed by a restart.
- Under the accepted controller, budget-stratified suffix-opportunity density
  has a monotonic association with actual internal-score gain per million
  repair frames: 1.99, 5.05, 8.06, and 13.10 across density quartiles.
- Duplicate or incumbent-identical terminal work is negligible in the accepted
  depth-six evidence, so cursor/tried-anchor machinery is not the first lever.

Counterfactual decision replays, not outcome predictions:

- Maximum suffix opportunity changes 40.9% of anchors, moves only earlier, and
  raises mean estimated cost share from 66.2% to 77.7%. It buys more mutable
  error but slightly lowers opportunity density.
- Suffix opportunity per estimated point cost changes 62.4% of anchors, moves
  both earlier and later, lowers mean estimated cost share to 57.5%, and raises
  mean opportunity density from 12.03 to 14.74 SSE per million point frames.
- Single-gap opportunity per cost collapses to parent depth zero in this
  evidence. That resembles the already weak local-restart regime and is not a
  priority.

The association above is not causal, and an unexecuted anchor's completion,
acceptance, or score cannot be inferred from the incumbent alone. A real paired
compiler arm is required.

## Ranked schemes

### 1. Suffix opportunity per estimated cost

For every affordable anchor `a` in the declared option universe:

```text
opportunity(a) = Σ incumbent target-gap SSE at gaps >= a
density(a) = opportunity(a) / estimated point cost to end from a
```

Choose maximum density; break ties by greater opportunity, then later anchor.
Record the worst target gap in the selected suffix as its explanatory target.
The target-to-anchor `parent_depth` is descriptive and may exceed the
option-generation radius because this is an anchor-first law.

Why first: it directly addresses repair efficiency, makes substantial but
two-sided decisions, and has the strongest pre-execution evidence without adding
a learned model or new tuning parameter.

### 2. Maximum suffix opportunity

Choose the affordable anchor exposing the greatest total suffix SSE, then the
worst target in that suffix. With non-negative SSE this is normally the earliest
affordable reported anchor.

Why second: it is the cleanest expression of “spend the remaining budget on the
largest mutable problem,” but it consumes more of the remaining budget per
attempt and may reduce the number of completed alternatives.

### 3. Target-aware suffix search

Keep an accepted anchor law, but make the suffix DFS explicitly prioritize
improvement of the selected target or suffix before global terminal acceptance.

Why later: current selection telemetry cannot predict this intervention. It
changes search ordering, not only allocation, and requires new telemetry that
separates target-local progress from eventual global adoption.

### 4. Adaptive value model

Estimate expected accepted gain or probability of completion from anchor,
opportunity, cost, iteration, and source structure, then choose expected value
per frame.

Why later: it is potentially powerful but easy to overfit. It should be trained
only after multiple executed policies provide counterfactual coverage, with
source/seed holdouts and explicit budget conditioning.

### 5. Local splice/window repair

Repair a bounded window and reconnect to an incumbent suffix.

Why deferred: the arrival state at the join controls downstream physics, so a
nominally local edit is not locally valid without a robust reconnection
contract. This is a different repair family, not a small controller variant.

## Telemetry contract

Budget Telemetry V5 records `selection_policy`, exact affordable target and
anchor populations, the chosen target/anchor, mutable-suffix SSE, and the cost
interval/source. The recorder replays the named law from `considered_targets`
and rejects a payload that does not reproduce its choice. The behavior analyzer
uses the same replay function.

The initial categorical diagnostic arm is enabled by:

```text
LR_REPAIR_SELECTION_POLICY=suffix-opportunity-per-cost
```

The production default remains `worst_gap_deepest_affordable` until an arm passes
the declared multi-budget and canonical promotion protocols.

## Evaluation order

1. Run paired N=4 across the scale profile's eight specifications and eight
   budgets, using a fresh V5 reference from the same compiler snapshot family.
2. Audit zero telemetry replay violations, validity, terminal completion,
   acceptance, distinct alternatives, opportunity density, cost utilization,
   repair attempts, and score by budget/source.
3. Extend to N=8 only if the effect is not clearly dominated. The scale protocol
   controls sequential inference; adjacent budgets remain deterministic policy
   conditions, not independent samples.
4. Run the canonical 750k promotion protocol only for a favorable scale arm.
5. Regardless of score, retain the result as evidence about the scheme. Do not
   convert it into a parameter sweep or silently promote it.

