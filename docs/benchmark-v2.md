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
npm run benchmark -- eval
npm run benchmark -- eval --to-verdict
npm run benchmark -- eval --to-verdict --mode=simplify --margin=5
npm run benchmark -- rebaseline --label=NAME       # after accept only
npm run benchmark -- baseline --label=NAME         # bootstrap/suite rollover only
npm run benchmark -- explain ARCHIVE.json
npm run benchmark:v2:clicks
```

Inspect every development and qualification specification in the existing timeline
dashboard, including contacts, gaps, axes, authored phases, and review-click playback:

```bash
HOST=0.0.0.0 PORT=8080 npm run dash
# http://127.0.0.1:8080/spec-dashboard/?collection=v2
```

`npm run benchmark`, `npm run golden`, and `npm run goal` default to eval
stage 0. Stage 0 runs the probe allocation against the stored screening
reference and is informational. `eval --to-verdict` selects a certified
operating point, declares its mode, margin, depth, fresh seed epoch, snapshots,
and era spend before execution, then runs candidate and baseline in paired
waves. A favorable final verdict runs qualification as an indicative sidecar.

The default engine is WASM and public commands use 48 workers on this host. Override with
`--jobs=N` when appropriate. Process CPU, host CPU, RSS, heap, system memory, and load are
sampled every five seconds; use `--resource-interval=N` or `--no-resource-stats` to adjust
that diagnostic output. The reference 48-worker measurements are recorded in
`docs/benchmark-v2-resources.md`. Use `--resume` with unchanged output and checkpoint paths;
each completed result is appended to a run-plan-fingerprinted JSONL checkpoint.
The plan fingerprint includes Node version, platform, architecture, complete
candidate fingerprint, compiler-source fingerprint, compiler environment, and
WASM artifact fingerprint. Failed and timed-out tasks are scheduled again on
resume; only the latest successful row for each task is restored.

## Preparation

Every public run deterministically prepares the suite first:

1. generate compatibility manifests and the catalog lock from TypeScript;
2. load and characterize all 42 development and five qualification cases;
3. run the structural independence and cohort audit;
4. write a compiler-outcome-free selection review and validate the tracked listening review;
5. expose a pending review during development, but block confirmation and baseline execution;
6. validate all evidence again inside the runner.

`scripts/benchmark/materialize_normative.ts` is a migration/reproducibility utility.
`scripts/benchmark/materialize_variants.ts` materializes deliberate variant modules; it
uses no runtime randomness.

## Output

Progress is reported once per complete catalog pass with completion, validity,
throughput, ETA, and provisional budget means. Final artifacts include full and gzip
archives, SHA-256 sidecars, compact summaries, per-budget/stratum/group/parent/case data,
per-seed scores, component errors, phase completion, raw reports, and track hashes.

With `--json`, the CLI reserves stdout for exactly one JSON object and sends
preparation, progress, resource, and error diagnostics to stderr. Automation
using the npm entry point must suppress npm's own script banner:

```bash
npm run --silent benchmark -- eval --json
```

Qualification archives contain the development archive hash. `probe-baseline.json`
records the reusable screening reference. `baseline.json` is the compiler and
decision contract of record, including the checksummed compiler/WASM snapshot.
`attempts.jsonl` is the authoritative append-only attempt and era ledger;
`era-state.json` is its rebuildable projection. Immutable declarations and
retained archives bind each confirmation's snapshots, seed epoch, operating
point, and decision evidence.

## Comparison

The eval verdict requires checksummed development archives with identical
semantic execution policies and complete paired scope. It reconstructs every
stored score from the raw report and current transformed axis contract. Stage
0 cannot promote; only a predeclared certified confirmation can. Improvement
and explicit-margin simplification policies use stress-calibrated paired budget
seed-block jackknife Student-t bounds.
Parent-preserving bootstraps are reported as catalog sensitivity, not as posterior
probabilities. The complete contract and exit codes are in `docs/benchmark-v2-decisions.md`.
Confirmation and baseline commands refuse to operate when certification,
calibration, suite, or decision identities are stale. Standalone `decide` is
retained for optional probe archive analysis only and rejects canonical evidence.

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
6. Perform the required migration/re-certification, then use `baseline` for an
   intentional suite rollover. Ordinary accepted compiler changes use `rebaseline`.
