# One-terminal adaptive repair experiment

> **Historical experiment record.** The comparison modes described below were
> removed on 2026-08-11 after the one-terminal result was promoted. The active
> controller roadmap is `docs/repair-controller-roadmap.md`; these commands and
> switches are retained here only to explain the frozen artifacts.

## Question

The production repair frontier keeps searching one bounded suffix frontier and
may evaluate several complete alternative tracks before its local ceiling. The
experimental allocator tests a different use of the same known hard budget:

> After one complete alternative suffix is evaluated, should control return to
> the repair allocator so it can choose a fresh affordable anchor and a fresh
> alternative using the work that remains?

This is not an anytime compiler. Every compilation receives its final hard
budget before search begins. The allocator may use that horizon when selecting
anchors, ceilings, and the amount of work reserved for later repair.

## Frozen comparison

`multi-terminal` was the production default and is the frozen reference arm.
It retains the previous repair traversal exactly. After the evidence recorded
in `docs/one-terminal-adaptive-repair-results.md`, one-terminal adaptive repair
with one try per anchor became the production source default.

`one-terminal-adaptive` began as an opt-in study arm. For each repair decision
it:

1. ranks weak gaps on the current incumbent;
2. selects an affordable upstream anchor with the existing completion-cost
   estimator and safety margin;
3. launches a frontier episode with a deterministic fresh search seed;
4. returns immediately after the first complete alternative track is offered
   to the register;
5. records the outcome, remaining hard budget, and estimator evidence;
6. reranks from the new incumbent after an improvement, or tries an untried
   anchor/alternative while the known remaining budget can afford one.

The search seed must change between alternatives. Candidate pools are memoized
by seed; replaying the same prefix and seed would reproduce the same pool rather
than provide a new alternative. The experiment remains deterministic for a
fixed specification, optimizer seed, hard budget, and configuration.

`repairAdaptiveTriesPerAnchor` controls how many deterministic alternatives may
be attempted at one actual anchor before the allocator moves elsewhere. The
first declared arm uses one try. Further values are separate declared arms,
not tuning performed after seeing individual runs.

The experimental frontier mode is rejected when surgical repair is enabled.
This keeps mechanism attribution and the comparison question unambiguous.

## Telemetry contract

Both arms emit strict `line.compile-budget-telemetry.v3`. A frontier repair
episode records `mechanism_detail` as either `multi-terminal` or
`one-terminal-adaptive`.

An adaptive episode has an exact terminal-consider limit of one. A completed
episode therefore satisfies:

```text
terminal_tracks_considered = 1
stop_reason = first_terminal_return
```

An episode that exhausts its local or hard ceiling before a terminal remains a
censored observation. It is never converted into a completion-cost sample.
Episode work, terminal identity, register adoption, anchor distance, seed, and
estimator observations retain their ordinary V3 meanings.

The main interpretation metrics are:

- score and validity by source and hard budget;
- time to the first terminal and post-first-terminal work;
- repair episodes, completed repair episodes, and terminals per episode;
- allocated and spent frames per repair episode;
- anchor distance and distinct repair search seeds;
- repair register-improvement rate and final-output lineage;
- candidate samples, viable candidates, expanded nodes, and children;
- exact compile-global distinct and repeated terminal geometry evaluations;
- estimator error and censoring at selected anchors.

Completion-estimator error is measured only on episodes that actually reach a
terminal. Its signed error is `actual first-terminal work - start estimate`, so
a positive value means the estimator underpredicted work. Censored episodes
remain a separate population. Interval coverage, allocation surplus, and
atomic overrun are reported independently; none is silently converted into an
uncensored point estimate.

No metric is a proxy for the authored score. The Benchmark V2 scorer remains
the optimization outcome, and authored impact is never capped or rewritten by
the feasibility estimator.

## Evaluation protocol

Use the frozen Benchmark V2 multi-budget profile: eight development
specifications, hard budgets from 150k through 4M, identical optimizer seeds in
both arms, and declared looks at 4, 8, and 16 seed curves. Adjacent budget
points are repeated policy variants within a seed curve, not independent
samples.

First create a strict-V3 reference archive with the production mode. Historical
V1/V2 archives remain evidence but cannot support this mechanics comparison.

```bash
npm run benchmark -- scale baseline --seeds=16 \
  --budget-telemetry=summary \
  --out=generated/benchmark-v2/scale/repair-adaptive-v3-reference-16.json
```

Run the first four-seed experimental look:

```bash
npm run benchmark -- scale eval \
  --baseline=generated/benchmark-v2/scale/repair-adaptive-v3-reference-16.json \
  --seeds=4 \
  --repair-mode=one-terminal-adaptive \
  --repair-tries-per-anchor=1 \
  --budget-telemetry=summary \
  --out=generated/benchmark-v2/scale/repair-adaptive-1try-4.json \
  --artifact=generated/benchmark-v2/scale/repair-adaptive-1try-4-comparison.json
```

Promising or mechanistically unresolved arms extend the same candidate archive
to 8 and then 16 seeds. Extensions import completed seed curves and must retain
the exact compiler snapshot, profile, mode, and tries-per-anchor value. A second
tries-per-anchor arm starts from its own four-seed archive and is compared to
the same reference.

The scale headline summarizes broad performance. The paired V3 mechanics
analysis explains how the allocator changed work and outcomes. Promotion to
the production default requires both; a score movement without trustworthy
attribution is not enough.
