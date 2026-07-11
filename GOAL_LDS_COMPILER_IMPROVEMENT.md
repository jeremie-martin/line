# Compiler Improvement Goal

Improve `compileHandoff` against the frozen Benchmark V2 development distribution without changing the ruler, catalog, or qualification references during a candidate comparison.

## Sources Of Truth

- Product and benchmark scope: `docs/benchmark-v2-context.md`
- Statistical decisions and workflow: `docs/benchmark-v2-decisions.md`
- Commands and artifacts: `docs/benchmark-v2.md`
- Current baseline: `benchmark/v2/baseline.json` and `docs/benchmark-v2-baseline.md`
- Compiler contract: `docs/compiler_goals.md`

The former 40-spec V1 campaign is preserved at `docs/archive/GOAL_LDS_COMPILER_IMPROVEMENT_V1.md`. V1 is available only through `npm run benchmark:v1`, `npm run golden:v1`, and `npm run decide:v1`.

## Development Loop

1. Diagnose the current baseline with its summaries and `benchmark explain`.
2. Make one coherent compiler change.
3. Run focused tests and deterministic checks.
4. Produce a candidate probe:

   ```bash
   npm run benchmark -- probe --out=generated/benchmark-v2/candidates/NAME-probe.json
   ```

5. Screen it against the frozen probe baseline:

   ```bash
   npm run decide -- generated/benchmark-v2/candidates/NAME-probe.json
   ```

6. Spend the baseline's single canonical confirmation only after `advance` and after freezing the candidate:

   ```bash
   npm run benchmark -- canonical --decision-mode=improvement
   npm run decide -- GENERATED_DEVELOPMENT_ARCHIVE
   ```

Only canonical `accept` is a promotion. Qualification is produced beside the canonical run as indicative monitoring evidence; it never enters the development headline or decision.

Probe and canonical use disjoint actual seeds. Each canonical attempt declares a fresh, never-reused random seed epoch before freshly executing both the frozen baseline compiler snapshot and candidate. Canonical is not a reusable development set: every result consumes the confirmation state. Only an accepted candidate can establish the next baseline; deleting or editing the ledger invalidates the audit trail.

## Simplification

Choose the largest acceptable headline regression before canonical compilation:

```bash
npm run decide -- generated/benchmark-v2/candidates/NAME-probe.json \
  --mode=simplification --margin=0.5
npm run benchmark -- canonical --decision-mode=simplification --margin=0.5
npm run decide -- GENERATED_DEVELOPMENT_ARCHIVE --mode=simplification --margin=0.5
```

The margin is explicit and has no default. Canonical non-inferiority is required before merging a behavior-changing simplification. Byte-identical refactors should additionally demonstrate matching track hashes.

## Engineering Rules

- Do not branch on case names, source paths, or benchmark membership.
- Keep the benchmark, scorer, weights, budgets, seeds, engine, and execution protocol fixed within a comparison.
- Treat worker failures as invalid evidence, not compiler regressions.
- Use the archived per-case, parent, group, stratum, budget, validity, and compiler-stat breakdowns to explain outcomes.
- Report failed ideas and mechanisms learned, not only accepted candidates.
- Prefer studies that isolate a causal compiler mechanism before large sweeps.
- Re-establish the baseline only when intentionally changing the compiler of record or the frozen benchmark contract.
