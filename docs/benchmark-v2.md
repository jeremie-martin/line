# Benchmark V2 Operations

The product and evidence contract is `docs/benchmark-v2-context.md`.

## Source of truth

- `benchmark/v2/cases/`: typed normative, variant, and qualification case modules.
- `benchmark/v2/catalog.ts`: static case membership.
- `benchmark/v2/policy.ts`: strata, parents, weights, profiles, and transform.
- `benchmark/v2/catalog.lock.json`: generated content-addressed catalog snapshot.
- `benchmark/v2/compat/`: generated JSON adapter for the proven runner.
- `benchmark/v2/evidence/`: generated characterization, audit, and selection review.
- `benchmark/v2/studies/`: retained allocation-study summaries.
- `benchmark/v2/runs/`: retained compressed canonical archives and bundles.

The compatibility manifests are outputs, not editable configuration. Production
references are qualification-only. Benchmark V1 remains available explicitly through
`npm run benchmark:v1` and `npm run golden:v1`.

## Commands

```bash
npm run benchmark -- prepare
npm run benchmark -- baseline --label=NAME
npm run benchmark -- probe
npm run benchmark -- canonical --decision-mode=improvement
npm run benchmark -- explain ARCHIVE.json
npm run benchmark -- decide CANDIDATE.json
npm run benchmark:v2:clicks
```

`npm run benchmark`, `npm run golden`, and `npm run goal` default to the V2 probe.
Probe and canonical use the same 42 development cases. Probe performs 252 compiles:
250k/500k with three disjoint seeds per budget. A canonical confirmation performs two
paired 1,008-compile development runs at 250k/500k/750k with eight fresh seeds per budget:
one from the frozen baseline compiler snapshot and one from the predeclared candidate
snapshot. Both execute after declaration in isolated clean `npm ci` worktrees. It then
runs 120 candidate-snapshot qualification compiles as a linked sidecar (2,136 total).

The default engine is WASM and public commands use 48 workers on this host. Override with
`--jobs=N` when appropriate. Process CPU, host CPU, RSS, heap, system memory, and load are
sampled every five seconds; use `--resource-interval=N` or `--no-resource-stats` to adjust
that diagnostic output. The reference 48-worker measurements are recorded in
`docs/benchmark-v2-resources.md`. Use `--resume` with unchanged output and checkpoint paths;
each completed result is appended to a run-plan-fingerprinted JSONL checkpoint.
The plan fingerprint includes Node version, platform, and architecture. Failed and
timed-out tasks are scheduled again on resume; only the latest successful row
for each task is restored.

## Preparation

Every public run deterministically prepares the suite first:

1. generate compatibility manifests and the catalog lock from TypeScript;
2. load and characterize all 42 development and five qualification cases;
3. run the structural independence and cohort audit;
4. write a compiler-outcome-free selection review and validate the tracked listening review;
5. expose a pending review during development, but block baseline and canonical execution;
6. validate all evidence again inside the runner.

`scripts/benchmark/materialize_normative.ts` is a migration/reproducibility utility.
`scripts/benchmark/materialize_variants.ts` materializes deliberate variant modules; it
uses no runtime randomness.

## Output

Progress is reported once per complete catalog pass with completion, validity,
throughput, ETA, and provisional budget means. Final artifacts include full and gzip
archives, SHA-256 sidecars, compact summaries, per-budget/stratum/group/parent/case data,
per-seed scores, component errors, phase completion, raw reports, and track hashes.

Qualification archives contain the development archive hash. `probe-baseline.json`
records the reusable screening reference. `baseline.json` records probe and milestone
canonical execution policies, implementation bytes, compiler, engine, the versioned
compiler-source inventory, dependency and TypeScript configuration, checksummed
compiler/WASM snapshot, compressed archives, independent seed schedules, and qualification
linkage. Confirmation state additionally retains the never-reused seed ledger and both
fresh paired archive identities.

## Comparison

The decision command requires checksummed development archives with identical semantic
execution policies and complete paired scope. It reconstructs every stored score from the
raw report and current transformed axis contract. Probe decisions screen; only the one-shot,
predeclared canonical decision can promote. Improvement and explicit-margin simplification
policies use stress-calibrated paired budget seed-block jackknife Student-t bounds.
Parent-preserving bootstraps are reported as catalog sensitivity, not as posterior
probabilities. The complete contract and exit codes are in `docs/benchmark-v2-decisions.md`.
Baseline, canonical, and decision commands refuse to operate when retained calibration or
its zero-inflated coverage evidence is stale for the current suite or decision code.

## Diagnostics

```bash
npm run benchmark -- explain generated/benchmark-v2/canonical-runs/NAME-development.json
```

The explanation identifies invalid sources, failure progress, termini, pooled axis RMS,
and phase completion. Undefined axes remain absent; a missing expected measurement is a
hard run failure. The physical `feasibility_bound` is diagnostic only and never changes
authored impact truth.

## Changing V2

1. Modify typed cases or policy, not generated compatibility JSON.
2. Regenerate variants when their plans change.
3. Run focused and full tests.
4. Generate and complete listening review without compiler outcomes.
5. Rerun allocation studies if budgets, seeds, or catalog diversity change materially.
6. Establish a new canonical baseline before comparing compiler candidates.
