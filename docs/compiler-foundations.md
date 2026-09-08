# Compiler foundations, September 2026

The accepted reference is arc-refinement at **767.6851**, commit `6215f0c2`.
Work branch: `codex/compiler-foundations`. The owner requested careful cleanup
before further experiments, preserving useful old mechanisms. Large archives
remain local; source and compact evidence are pushed.

## Audit and cleanup

The public entry point previously shared a 13,180-line module with the older
prefix-search implementation. `handoff.ts` now exposes routing and compatibility
APIs; `legacy_handoff.ts` retains that implementation and its diagnostic exports.
Routing conditions are unchanged, including explicit diagnostic options and
fallback for reference engines, unsupported axes, early/absent contacts and very
small allowances. Snapshot studies remain available. Static compatibility exports
still load the legacy code, so this is not a startup-speed optimization.

`arc_geometry.ts` separates pure coherent-curve construction from search.
The initial audit suspected a geometry/refinement cycle; direct import inspection
disproved that suspicion in this revision. The actual benefit is that geometry
studies can import curve construction without loading the engine and optimizer.
Existing `motionArc` imports remain compatible through a re-export.

`connectedArcOptions(spec, budget)` supplies the actual production settings.
The study command accepts `--defaults=production` and then explicit JSON
overrides, avoiding another independently maintained configuration. Historical
command defaults are preserved. Public studies now exercise `compileHandoff`.

The optimizer README, project status, engine table and workflow now describe
the current arc implementation. Historical readiness and prefix-search documents
are explicitly scoped to legacy research. Superseded campaign entries retain
their evidence but no longer claim to be the active baseline.

## What remains, and why

| Mechanism | Current role | Reason to retain / revisit |
|---|---|---|
| Legacy prefix search, readiness, deadlines and repair | Compatible fallback and explicit research | Supports additional axes and diagnostics; measured work and incumbent preservation remain useful principles. Old fitted coefficients are not evidence for current arcs. |
| Completed-track arc repair | Implemented, off in production | Prior pilots found weak returns from suffix rebuilding. Better boundary matching or cheaper continuation reuse could alter that result. |
| Native/normal point-control compilers | Archived proofs, no public route | Reproduces the capability evidence. Geometry violates the current product requirement; transfer physical-control principles instead. |
| Legacy estimator and telemetry schema | Shared reporting; old planner policy | Arc allocation uses measured construction work. Separating reporting metadata is useful future work but must preserve accounting semantics. |
| Earlier CLI study aliases and models | Historical reproduction | Removing them merely because they are old would break reproducibility without improving current search. |

No benchmark, scorer, authored target, detector, physics or accounting contract
is changed. Production remains normal type-0 substantial physical curves.

## Verification

**All 264 cells pass exact equality**, including the six inherited 150k
failures. All 154 focused tests pass across nine files. A structural check
confirms all 638 retained legacy top-level statements are unchanged.

The cleanup is checked against retained outputs from all 44 development cases
at 150k, 250k, 500k, 750k, 1M and 3M: 264 cells with seed 260908011. Equality
covers track geometry, complete reports, statistics, budget telemetry and score.
This is a behavior-preservation check, not new independent seed evidence.
The inherited six 150k failures must also remain identical.

Reproduction: `python3 scripts/benchmark/arc_cleanup_parity.py --jobs=16`.
It requires the retained local research outputs. Compact evidence records both
reference and candidate hashes; full tracks remain under `generated/`.
Focused current and legacy tests additionally cover routing and snapshot APIs.
Repository-wide TypeScript checking remains red: both reference and cleanup
have the same 251 diagnostics with TypeScript import extensions enabled.
There are no added diagnostics. See the [compact validation record](../benchmark/v2/studies/compiler-foundations-validation.json).

## Research directions after cleanup

1. **Value at the continuation boundary.** The learned physical-arrival model
   currently ranks root candidates and blends the final root decision. Deeper
   search still terminates with a hand-built arrival prior. Test using the model
   at that simulated boundary, where unresolved future behavior actually begins.
   Start with modest blending and preserve exact simulation of every candidate.
2. **Measured response reliability.** Central differences can straddle a contact
   transition. Study whether predicted versus achieved improvement should govern
   trust radius or the fraction of work spent on coupled response proposals.
   Do not assume all locally smooth fits justify equal trust.
3. **Cost and value together.** The current planner observes construction cost
   but allocates extra search mainly by affordability. Retained difficulty and
   repair work suggests measuring marginal improvement as well. Gather this on
   current arcs before reusing any previous fitted model or adding policy.

These are hypotheses, not promised score improvements. Explore paired panels,
retain adverse outcomes, and expand promising candidates to the full fixed suite.
Only a normal governed acceptance can change the canonical headline.
