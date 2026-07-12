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
4. Run stage-0 screening against the frozen probe reference:

   ```bash
   npm run benchmark -- eval
   ```

5. If the mechanism is worthwhile, declare the certified confirmation before
   inspecting any fresh confirmation evidence:

   ```bash
   npm run benchmark -- eval --to-verdict
   ```

6. After `accept`, execute the verdict artifact's concrete `nextCommand`:

   ```bash
   npm run benchmark -- rebaseline --label=NAME
   ```

Only eval-chain `accept` is a promotion. Qualification is produced as an indicative sidecar after a favorable confirmation; it never enters the development headline or decision.

Stage 0 and confirmation use disjoint actual seeds. Each confirmation declares
a fresh, never-reused epoch before executing both snapshots. Confirmation is
not a reusable development set; retries require acknowledgement and fresh
evidence. Only an accepted candidate can establish the next baseline; deleting
or editing the ledger invalidates the audit trail.

## Simplification

Choose a certified acceptable headline regression before confirmation compilation:

```bash
npm run benchmark -- eval
npm run benchmark -- eval --to-verdict --mode=simplify --margin=5
```

The margin is explicit and has no default. Certified non-inferiority is required before merging a behavior-changing simplification. Byte-identical refactors should additionally demonstrate matching track hashes.

## Engineering Rules

- Do not branch on case names, source paths, or benchmark membership.
- Keep the benchmark, scorer, weights, budgets, seeds, engine, and execution protocol fixed within a comparison.
- Treat worker failures as invalid evidence, not compiler regressions.
- Use the archived per-case, parent, group, stratum, budget, validity, and compiler-stat breakdowns to explain outcomes.
- Report failed ideas and mechanisms learned, not only accepted candidates.
- Prefer studies that isolate a causal compiler mechanism before large sweeps.
- Re-establish the baseline only when intentionally changing the compiler of record or the frozen benchmark contract.
