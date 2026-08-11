# Repair controller clean-break roadmap

## Objective

Replace the historical frontier-repair family with one production repair
controller whose unit of work is a self-contained iteration:

```text
current incumbent
→ remaining hard budget
→ current cost-to-end profile
→ affordable target/anchor under explicit headroom
→ one complete alternative suffix
→ register decision
→ recompute from scratch
```

The controller knows the compile's hard budget. It is not an anytime
algorithm. The authored specification and ordinary compiler register remain
the optimization contract; the completion estimator is diagnostic and sizes
work but never rewrites authored targets.

## Settled terminology and semantics

- **incumbent**: current best complete track under the compiler register;
- **repair iteration**: one anchor decision and at most one complete suffix;
- **target gap**: incumbent gap selected for improvement;
- **anchor gap**: prefix position from which the suffix is regenerated;
- **parent depth**: fixed target-to-anchor distance for one declared policy;
- **repair headroom**: explicit multiplier applied to the estimator's upper
  completion-cost bound;
- **terminal reached**: a complete alternative was evaluated; this says
  nothing about validity or adoption;
- **accepted alternative**: the register replaced the incumbent.

Do not use `allocator`, `adaptive`, `repair completed`, `unique terminal`, or
`candidate count` without the population being named precisely.

## Non-negotiable invariants

1. Production has one repair architecture and no mode switch.
2. One repair iteration evaluates at most one terminal alternative.
3. Every iteration recomputes its target and anchor from the current incumbent,
   current remaining budget, and current cost profile.
4. No ancestor walk, failed-anchor fallback chain, or exhaustion state carries
   policy decisions between iterations.
5. The actual anchor—not merely the target gap—must pass affordability.
6. Censored iterations are never estimator-completion observations.
7. Every charged frame, candidate sample, node evaluation, register offer, and
   terminal evaluation belongs to an exact lane and iteration.
8. A fresh seed is not treated as evidence of geometric diversity. Diversity
   is measured from incumbent, offer, arc, and suffix identities.
9. V1–V3 telemetry artifacts remain immutable historical evidence. Semantic
   changes use V4; no compatibility aliases or fallback interpretations.
10. Cleanup and observability changes must preserve current production output
    exactly before the new anchor policy changes behavior.

## Milestone 1 — behavior-preserving architectural cleanup

- Extract the repair policy primitives from the large handoff implementation.
- Remove the `multi-terminal` production/study branch, frontier-mode parsing,
  adaptive-tries surface, and mode-dependent scale-runner scaffolding.
- Audit default-off surgical and legacy repair branches. Remove code that
  cannot participate in the new controller and retain historical conclusions
  in documentation rather than executable production code.
- Rename the surviving one-terminal path as ordinary repair.
- Temporarily isolate the four-ancestor strategy so it can be replaced in one
  subsequent behavioral commit.
- Prove byte-identical outputs for the production default and pass all focused
  and repository tests.

Exit gate: a single one-terminal code path, no live old-mode switch, current
baseline behavior unchanged.

## Milestone 2 — repair-native telemetry V4 and reporting

V4 records one exact repair-decision object and one exact execution episode per
iteration. It adds:

- incumbent track hash at start;
- remaining hard budget;
- estimator profile identity and headroom;
- considered target/anchor candidates with affordability and rejection reason;
- selected target gap, anchor gap, parent depth, weakness, point/upper cost;
- search seed and candidate-stream work by lane;
- terminal-offer track hash;
- equality with incumbent, first divergent gap, and changed suffix-arc count;
- terminal reached separately from accepted alternative;
- register keys before/after, work, censoring, and final-output lineage.

Metric audit:

| Historical term | Exact V4 term/handling |
|---|---|
| `policyCandidateCount` | `meanRequestedNormalProposalsPerRankedOptionCall`, reported by lane |
| `candidatesSampled` | `actualCandidateSamples`, split by stream and lane |
| `fullTerminalEvaluations` | `terminalNodeEvaluations` |
| `uniqueFullTerminalEvaluations` | `firstTimeTerminalNodeEvaluations`; never trajectory diversity |
| `duplicateFullTerminalEvaluations` | `revisitedTerminalNodeEvaluations` |
| `repair completed` | `terminalReached`; never implies valid or accepted |
| `accepted_improvement` | `acceptedAlternative`, defined by register adoption |

Reporting adds a reproducible source×budget matrix and plots for score effect,
repair work, path divergence, duplicates, and estimator calibration.

Exit gate: schema/accounting identities close on golden fixtures and a compact
multi-budget diagnostic; every important report claim is reproducible from a
named V4 field.

## Milestone 3 — independent budget-aware repair iterations

For every iteration:

1. Read the incumbent and remaining hard budget.
2. Rebuild/update cost-to-end measurements when the incumbent changed.
3. For fixed parent depth `d`, map each target `g` to anchor `g - d`.
4. Require
   `repairHeadroom × estimatedUpperCompletionCost(anchor) <= remaining`.
5. Among eligible target gaps, select the largest axis-error SSE.
6. Regenerate one suffix from its anchor and return after one terminal.
7. Offer it to the register, record the result, discard iteration-local policy
   state, and return to step 1 whether accepted or rejected.

The first production candidate uses parent depth 1. Parent depth 2 and other
headroom values are separate declared arms, never hidden fallbacks.

Exit gate: no ancestor walk or cross-iteration failed-anchor state remains;
tests prove recomputation after accepted and rejected alternatives.

## Milestone 4 — diversity evidence and intervention

Measure same-anchor frequency, incumbent-identical offers, candidate-stream
overlap, first divergent gap, changed suffix arcs, repeated terminal geometry,
and accepted divergent alternatives across budgets.

If fresh deterministic sampling does not provide adequate diversity, compare
one explicit mechanism: a deterministic alternative cursor or exclusion of the
incumbent's first regenerated arc. Do not infer diversity from seeds alone.

Exit gate: direct empirical evidence supports the retained diversity mechanism.

## Milestone 5 — governed evaluation and follow-ups

1. Focused determinism, semantic, accounting, and estimator tests.
2. Four-seed multi-budget mechanism diagnostic.
3. Governed 4/8/16 scale comparison with paired seed curves.
4. Complete statistical report and plots.
5. Canonical 750k evaluation only for a broadly favorable scale candidate.

After this controller is stable, revisit suffix-DFS policy and candidate
breadth. Breadth evidence collected under the removed repair economy is not
authoritative for the new controller.

## Progress ledger

| Date | Milestone | Status | Evidence / commit |
|---|---|---|---|
| 2026-08-11 | Roadmap frozen | complete | This document; commit pending |
| 2026-08-11 | Architectural cleanup | pending | — |
| 2026-08-11 | Telemetry V4/reporting | pending | — |
| 2026-08-11 | Independent repair loop | pending | — |
| 2026-08-11 | Diversity validation | pending | — |
| 2026-08-11 | Governed evaluation | pending | — |
