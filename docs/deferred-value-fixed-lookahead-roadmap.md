# Deferred-value fixed-lookahead continuation roadmap

## Objective

Test a distinct selective-search scheme: buy one fixed preferred-path lookahead
inside the optional post-terminal suffix, compare it once with the known
incumbent at the same authored horizon, and either return the optional frontier
or let the ordinary suffix continue. This is not a fourth persistence threshold
and not an anytime compiler.

The behavior-neutral prefix map showed why the previous family failed. Asking
after every eligible contact prunes trajectories that make a temporary local
investment and recover one contact later. A one-decision tournament gives the
alternative a fixed honest chance before judging it.

## Frozen rule

Use the exact rank-one deferred sibling, 40% allowance, ordinary suffix DFS,
no speculative tail, and atomic admission already implemented by
`selective-axis-regret-catchup-value-deferred-initial`.

Under a new explicit experimental policy:

1. Freeze the first improving terminal and first concrete divergence exactly as
   in the observation map.
2. Follow the ordinary local frontier until the first zero-skipped-contact,
   new-gap-high-water prefix contains six comparable authored contacts from
   that divergence.
3. Before processing that prefix's next atomic node, compare divergent-suffix
   normalized authored-axis loss with the incumbent through the same gap.
4. If the selected suffix is worse by more than 0.05, stop only the optional
   action and return its entire local pass/fallback frontier to the original
   frontier. Otherwise continue the ordinary optional suffix without another
   prefix decision.
5. If no eligible six-contact prefix is reached, preserve the existing action.

Six contacts is twice the established three-contact value maturity and is
already a declared repair-incumbent observation horizon. A 0.05 loss delta is
already the smallest declared axis-regret opportunity threshold. These values
are frozen from existing compiler coordinates, not fitted by adding a threshold
to the closed map. The old map is motivation only; fresh paired score evidence
decides this policy.

## Telemetry contract

Budget Telemetry V11 adds the explicit `prefix_gate_stop` episode stop reason.
It must never call a policy stop a local budget ceiling. Selective telemetry
records one of `not_reached`, `continue`, or `stop`, the six-contact horizon,
loss threshold, checkpoint frame/gap/contact, selected and incumbent axis
count/SSE/loss, loss delta, and the charged work remaining in the optional
allowance at decision time.

For `stop`, the gate checkpoint is a decision observation, not a processed
atomic node. It is therefore separate from `progress_checkpoints`; the latter
must continue to reconcile exactly with `nodes_processed` and atomic work.
All local nodes—including the unprocessed gate node—must be returned. Ordinary
repair then starts from the unchanged best register.

## Mechanical gate

Before score evidence, targeted tests and a small smoke must prove:

- production/unset policy is unchanged;
- first-terminal frame/hash is exact;
- at most one gate decision exists;
- a stop adds no atomic work after its decision frame;
- continue and not-reached preserve the old action path;
- episode, segment, attempt, checkpoint, register, and returned-frontier
  counters reconcile; and
- V11 is a clean break with no fallback interpretation of V10 fields.

## Fresh paired screen

Use the same ten-source compact panel, budgets 750k and 1.25M, and fresh actual
seeds 178-181. Run candidate and reference from the same committed source; only
the candidate receives the new policy environment variable. Four workers per
arm are sufficient and memory-safe. This is mover-grid evidence, never a
headline or canonical promotion by itself.

The exact rule earns one fresh confirmation only if:

- every candidate cell is valid and no reference-valid cell loses completion
  or contract survival;
- first-terminal frame and track hash are exact in every pair;
- total and active-cell paired score means are positive at both budgets;
- at least three of four seed blocks are positive at one budget and at least
  two at the other;
- no cell loses 20 points;
- the optional action runs in at least eight cells/four sources per budget; and
- the gate reaches a decision in at least four cells/three sources per budget,
  so a passing score cannot come from an inert policy.

A pass earns exactly one confirmation on seeds 182-185 under the same contract.
A failure closes this exact six-contact/0.05 rule. Do not change horizon,
threshold, allowance, breadth, repair, or sources on these score cells, and do
not launch canonical V2 inside this campaign.

## Progress ledger

| Date | Milestone | Status | Evidence |
|---|---|---|---|
| 2026-08-15 | Semantics, constants, telemetry, and fresh-screen gates frozen | complete | This document |
| 2026-08-15 | Live mechanism, V11 attribution, and trace smoke | complete | Four 750k cells: three `continue`, one `stop`; the stop returns before atomic node six with five processed/checkpointed/trace nodes, explicit `prefix_gate_stop` episode and segment, and all cells valid |
| 2026-08-15 | Fresh paired two-budget screen | complete, rule closed | 160/160 valid compiles; exact first-terminal identity in all 80 pairs; the rule fails its frozen score, seed-block, and maximum-loss gates |

## Fresh-screen result

Candidate and production reference were compiled from commit `36b68c62` with
the same engine, sources, transforms, budgets, and actual seeds 178-181. The
candidate alone received the explicit fixed-lookahead policy. All 160 compiles
were valid, no completion or contract survival was lost, and first-terminal
frame and track hash match in every pair.

At 750k, the action runs in 35/40 cells and all ten sources. The continuation
gate stops three, continues 30, and is not reached in two. Mean paired score is
-1.5467 per cell (SE 1.2597 over four seed blocks), active mean is -1.7677, one
seed block is positive, and the worst cell is -26.2320. The action displaces
4,667,506 ordinary-repair frames, 23 repair attempts, and 26 accepted repairs.

At 1.25M, the action runs in 29/40 cells and eight sources. It stops four,
continues 23, and is not reached in two. Mean paired score is +0.3314 (SE
0.7113), active mean is +0.4572, and three seed blocks are positive. However,
the worst cell is -20.5564, so even the favorable mean fails the frozen safety
gate. The action displaces 6,361,992 repair frames and 34 attempts, although
only three accepted repairs, which helps explain the more favorable aggregate.

The exact six-contact/0.05 rule is closed. It receives no confirmation and no
canonical V2 run, and it is not promoted.

## Post-screen diagnosis

The one-time axis decision behaves much better than the full optional action,
but does not cover every traversal shape. Stops are nearly neutral: their mean
paired deltas are -0.2965 at 750k and -0.0625 at 1.25M, and they consume only
18,680 and 21,626 frames on average. Continued actions average -0.5919 and
+0.8614 respectively.

The sharp low-budget failure is a separate structural case. Both actions where
the gate is not reached leave the zero-skipped pass path on their second
selection, then spend 222,038 and 198,489 frames following fallback/skip
prefixes. Their paired deltas are -26.2320 and -16.9883, a mean of -21.6102.
At 1.25M the two not-reached cells average -3.1520. This is direct evidence
about these four actions, not a population estimate.

The natural next hypothesis is therefore not another axis threshold. An
optional score-improvement suffix starts after a valid complete incumbent
already exists; completion-rescue fallback work has a different purpose. A
clean next campaign should test a pass-frontier-only optional suffix: when its
zero-skipped pass frontier is exhausted, return all fallback nodes immediately
to ordinary search and repair. It should retain the one-time lookahead decision,
use a new explicit stop reason, and be frozen on fresh seeds. This screen only
identifies that opportunity; its four fallback cases cannot promote the new
rule by themselves.

Supporting evidence:

- `generated/benchmark-v2/mover-grid/deferred-fixed-lookahead-two-budget-n4/mover-grid-report.json`
- `generated/benchmark-v2/mover-grid/deferred-fixed-lookahead-two-budget-n4/analysis.json`
