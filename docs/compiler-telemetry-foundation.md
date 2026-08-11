# Compiler telemetry foundation

## Purpose

Compiler decisions must be explainable from one authoritative, versioned
telemetry payload. The payload is part of the experiment contract: names state
exactly what was counted, score domains are explicit, work is attributable to
the execution that caused it, and invalid or older schemas fail closed.

This foundation is deliberately independent of the current repair allocator.
It must describe both the existing bounded multi-terminal suffix traversal and
a possible future allocator that returns after one terminal track and chooses a
new affordable anchor.

## Vocabulary

- **lane**: the compiler control-flow owner of work: `initial`, `repair`,
  `resumed`, or `snapshot`.
- **mechanism**: how an episode executes: `frontier` or `surgical`, with an
  explicit mechanism detail where needed.
- **episode**: one bounded execution allocation. A frontier repair episode has
  one selected weak gap, one actual anchor, one search seed, and one ceiling;
  a surgical episode may have no RNG seed.
- **round**: one repair-policy decision selecting a weak gap. A round may launch
  multiple episodes while walking upstream anchors.
- **pool build**: one actual `rankedOptions` proposal/ranking operation,
  including primary, rescue, and tail-completion builds.
- **requested normal proposals**: the resolved `nCand` passed to the normal
  proposal stream. It is not a branch count and not the number of viable arcs.
- **actual candidate samples**: proposals actually evaluated across all sample
  streams. Stream-specific counts are reported separately.
- **node processed**: one partial track removed from a frontier and handled.
- **node expanded**: a processed nonterminal node whose child alternatives were
  generated.
- **children enqueued**: alternatives returned to the traversal frontier.
- **terminal-node evaluation**: evaluation of a complete search node.
- **first-time/revisited terminal node**: identity of the in-memory `SearchNode`.
  These names never imply distinct geometry.
- **distinct terminal track**: exact canonical track geometry not previously
  evaluated in the stated scope.
- **register improvement**: adoption under the compiler register comparator.
  Internal comparator keys and Benchmark V2 scores are different score domains.

## Authoritative payload

`budgetTelemetry` remains the compile API field because the payload owns hard,
policy, search-policy, repair, local-ceiling, and overrun accounting. Its schema
is a clean break. New readers accept the exact current schema only; no renamed
field aliases and no fallback to `compile_stats` are allowed.

The payload contains:

1. compile budget/accounting and final-output lineage;
2. episodes with lane, parent, anchor, repair decision context, seed, ceiling,
   mechanism, estimator observations, work counters, and outcome;
3. execution intervals whose charged frames close exactly to compile spend;
4. trace-only node events, each attributed to an episode and lane.

`compile_stats` may retain non-overlapping output diagnostics, but it is not a
second repair ledger or a fallback source for search-work metrics.

## Required invariants

- episode IDs are unique, ordered, and referenced by every attributed event;
- at most one episode is active;
- execution intervals are ordered, non-overlapping, and sum to total spend;
- episode spend equals `end - start` and reports local and hard overrun;
- compile work equals the sum of episode work plus explicitly named startup or
  finalization work; unattributed work is an error, not a silent bucket;
- terminal evaluations equal first-time plus revisited terminal-node counts;
- terminal evaluations equal distinct plus repeated terminal-track evaluations;
- actual samples equal the sum of sample-mode attribution;
- evaluation-origin attribution closes to episode offers, terminals, and
  improvements;
- register improvements never exceed register offers;
- requested proposals, actual samples, viable candidates, ranked-option pool
  calls, nodes,
  children, terminals, and frame counters are non-negative integers;
- first-terminal and first-register-improvement offsets lie within episode spend;
- final-output lineage references the last episode that adopted the selected
  register output;
- archived source/budget/seed keys are complete and unique in both arms before
  any pairing or aggregation;
- every reported mean states its observation unit and every inferential result
  states its blocking unit.

## Reporting

The reusable mechanics report presents two funnels per lane and overall:

```text
ranked-option pool calls -> requested proposals -> actual samples -> viable candidates
            -> nodes processed -> nodes expanded -> children enqueued
            -> terminal nodes -> distinct terminal tracks
            -> register improvements -> final selected output
```

Register work is also attributed independently by evaluation origin:
`frontier`, `tail_completion`, `surgical_repair`, and `polish`. Origin is
orthogonal to lane, so repair and resumed work cannot hide inside a phase named
"main".

```text
declared hard budget -> episode allocations -> charged work -> local overrun
                     -> hard overrun -> unused remainder
```

Final Benchmark V2 score remains the optimization outcome. Internal
`axis_quality`, `drift_quality`, and `internal_full_score` are labeled
diagnostics and are never reported as Benchmark V2 score changes.

## Sequencing

Repair-policy changes are out of scope until this foundation is implemented and
verified. The first repair experiment afterward should compare the current
multi-terminal episode with a one-terminal episode that returns to the allocator
for a fresh affordable anchor/alternative decision under the same hard budget.
