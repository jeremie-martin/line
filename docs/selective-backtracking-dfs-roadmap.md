# Selective-backtracking DFS roadmap

## Objective

Generalize the handoff compiler's depth-first frontier traversal so it may
change course before the active path dies. This is a search strategy, not a
repair feature:

```text
ranked branch point
-> follow the preferred child
-> observe realized authored-target quality
-> either keep descending or suspend that continuation
-> promote a causal alternative from the remembered branch point
-> retain the suspended work for later traversal
```

The compiler still receives one fixed budget and optimizes the best track it
can return at that budget. This is not an anytime algorithm. Candidate
generation, candidate ranking, rescue, tail completion, repair, and the global
best-so-far register keep their existing responsibilities.

## Search semantics

- **ordinary DFS**: the current production policy. The most recently enqueued
  viable child is processed first; another branch is selected when the active
  subtree exhausts.
- **selective backtrack**: a policy-requested change of branch before subtree
  exhaustion.
- **branch point**: an expansion that produced at least two ranked viable
  children.
- **leader**: the preferred child selected by the existing ranker.
- **causal alternative**: the next ranked child from that same branch point.
- **suspended continuation**: the current prefix placed immediately behind the
  promoted alternative. It is deferred, not deleted or declared dominated.
- **rewind distance**: committed contact count between the current prefix and
  the remembered branch point. Gap indices are reported separately.

Trigger signal, rewind target, and current-subtree disposition are independent
policy decisions. The shared scheduler must not bake one signal into its
frontier operations.

## Invariants

1. With the policy unset, node order, charged simulation work, output track,
   and serialized telemetry are byte-identical to ordinary DFS.
2. A selective backtrack never changes candidate admission, candidate order,
   authored targets, scoring, or register comparison.
3. The first implementation suspends work; it does not prune it.
4. A promoted alternative is a real queued child of the recorded branch
   point, identified by object identity. It is never regenerated or inferred
   from a seed.
5. Decisions use the compile's fixed-budget deadline signal. Once the compiler
   is under deadline pressure, completion progress wins and the strategy falls
   back to ordinary DFS.
6. The strategy is phase-independent. Initial, repair, snapshot, and resumed
   traversals call the same scheduler; telemetry labels the lane explicitly.
7. Every trigger has direct evidence: branch point, realized loss change,
   contact advance, gap rewind, deadline state, promoted target, and eventual
   resumption of suspended work.
8. Experimental policy state is compile-local. No state or environment read
   may leak between compiles.

## First policy: authored-axis regret V1

`LR_FRONTIER_POLICY=selective-axis-regret` enables the first conservative arm.
The default is ordinary DFS.

At every contact branch point, the controller remembers the leader, its next
ranked sibling, the committed-contact ordinal, and the leader's prefix
authored-axis loss. Descendants of the leader carry that watch point. A watch
may fire once when all of these hold:

1. the leader path has advanced at least two committed contacts;
2. combined authored-axis loss has worsened by at least 0.20 (equivalent to an
   RMS normalized-axis error increase of 0.05 under the canonical tolerance);
3. the remembered sibling is still present in the same live frontier; and
4. the existing deadline estimator's start-event upper interval, evaluated at
   the concrete alternative's gap rather than at the current deeper prefix,
   reports zero pressure; and
5. the traversal's concrete local ceiling has not been reached.

The current prefix is then suspended immediately behind the remembered sibling,
which is promoted to the hot end. The sibling's subtree proceeds under ordinary
DFS; if it exhausts before the budget, the exact suspended prefix resumes before
unrelated alternatives. Resumption starts at expansion and never repeats the
prefix's detector evaluation or register offer. Nested watches remain causal:
each names its own concrete branch point and concrete sibling.

The two constants define this policy version, not the scheduler API. Later
policies may use prediction surprise, equal-depth tournaments, incumbent
comparison, gap-local loss, or a different rewind target without changing the
frontier mechanism.

## Telemetry contract

Telemetry is absent under ordinary DFS, preserving the default artifact. When
enabled it records:

- exact policy name and frozen V1 constants;
- observed and armed branch points;
- mature watch checks and loss-threshold crossings;
- deadline/local-ceiling-suppressed crossings and missing-target invariant
  failures;
- executed selective backtracks and resumed suspended continuations;
- sums/maxima for loss delta, contact advance, and gap rewind;
- executed backtracks split by initial, snapshot, repair, and resumed lane.
- one event per executed backtrack with its causal branch/current/alternative
  gaps, baseline and trigger loss, alternative-specific conservative deadline
  margin, charged-frame timestamp, and nullable resumption timestamp.

The metric `selective_backtracks` means an actual frontier reorder. A signal
crossing that deadline policy suppresses is not a backtrack.

## Execution plan

1. Add a small, independently tested controller for watch lineage, one-shot
   decisions, and exact telemetry.
2. Give the shared frontier driver explicit operations for membership,
   suspension, and identity-based promotion while preserving its default stack
   behavior.
3. Integrate authored-axis loss and the existing deadline signal at the point
   immediately after node consideration and before tail/pool work.
4. Prove default output/stat byte identity and deterministic enabled behavior.
5. Run a small repair-disabled mechanism probe to verify real backtracks,
   rewinds, alternatives, budget exhaustion, completion, and resumption.
6. Only after mechanism validation, compare the arm on canonical V2 at 750k.
   Do not run a multi-budget sweep unless it is requested again.

## Progress ledger

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-14 | Semantics and V1 policy frozen | complete | This document |
| 2026-08-14 | Controller and shared scheduler | complete | `3859e9b`, `25d7db5`; compile-local causal watch lineage, identity promotion, suspension/resumption, exact opt-in events |
| 2026-08-14 | Deterministic verification | complete | 47 focused controller/deadline/handoff tests pass; unset default equals explicit DFS as a complete serialized checkpoint; enabled runs are deterministic |
| 2026-08-14 | Repair-disabled mechanism probe | complete | One-budget panels below; zero unavailable alternatives and no validity loss after the target-aware deadline correction |

## Initial mechanism evidence

These are deterministic diagnostics, not statistical performance evidence.
They use the production compiler path with repair disabled so the traversal
effect is not confounded with the repair controller.

The first 100k implementation priced deadline pressure at the current deep
prefix. On `believer_impact_56s` seeds 0 and 1 it executed two backtracks per
run and lost both completions. The action actually rewound to an earlier
sibling, so that margin understated the work being admitted. This was an
implementation/design error, not a parameter result.

The corrected controller prices the concrete alternative gap with the budget
estimator artifact's start-event upper interval. Repeating the frozen six-case
x two-seed 100k panel produced:

- 12 paired cells, all byte-identical between DFS and the selective arm;
- 132 loss crossings suppressed by the conservative deadline;
- zero executed backtracks and zero unavailable alternatives;
- validity 6/12 in both arms (the other six baseline runs were also incomplete).

At 750k, a four-case x one-seed active-mechanism panel produced:

| Case | Backtracks | Resumed | First completion DFS -> selective | Score delta | Valid |
|---|---:|---:|---:|---:|---:|
| `river_reentry` | 0 | 0 | 415,584 -> 415,584 | +0.000 | yes/yes |
| `dense_dialogue` | 0 | 0 | 497,212 -> 497,212 | +0.000 | yes/yes |
| `frontier_pickup_progression` | 0 | 0 | 553,934 -> 553,934 | +0.000 | yes/yes |
| `believer_impact_56s` | 7 | 0 | 264,682 -> 557,454 | +5.220 | yes/yes |

All seven events promoted a concrete available sibling; no identity invariant
failed. Their rewinds ranged from 1 to 12 gaps and every conservative target
margin was at least 2.047. The score gain is one deterministic association and
must not be generalized. More importantly, the active row delayed first
completion by 292,772 frames. Production repair begins at first completion, so
the full compiler comparison must measure whether this traversal investment
beats the repair work it displaces.
