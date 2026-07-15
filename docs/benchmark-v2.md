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
- `benchmark/v2/runs/`: local, ignored canonical archives and bundles. Compact
  contracts, hashes, ledgers, and review evidence remain under version control.

The compatibility manifests are outputs, not editable configuration. Production
references are qualification-only. Benchmark V1 remains available explicitly through
`npm run benchmark:v1` and `npm run golden:v1`.

## Commands

```bash
npm run benchmark -- prepare
npm run benchmark -- eval
npm run benchmark -- eval --out=generated/benchmark-v2/eval/EXPERIMENT.json
npm run benchmark -- family capture MECHANISM --variant=MEMBER
npm run benchmark -- family run MECHANISM
npm run benchmark -- family select MECHANISM --variant=MEMBER
npm run benchmark -- eval --to-verdict
npm run benchmark -- eval --to-verdict --mode=simplify --margin=5
npm run benchmark -- eval --correct-aborted-spend --attempt=ID --reason=TEXT --operator=NAME
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
Stage 0 writes one probe archive via `--out=FILE`; `--archive-dir` and
`--out-dir` are confirmation-only paths and are rejected in stage 0 so an
evidence destination cannot be silently ignored.

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

Family exploration is a separate descriptive lane for choosing one implementation
from a small mechanism family before confirmation. It snapshots arbitrary source
states, runs the production baseline once and every member on the same fresh probe
seeds, and stores an immutable round report under
`generated/benchmark-v2/families/`. The report includes paired uncertainty,
validity changes, all pairwise contrasts, and seed-prefix ranking stability. It
does not run qualification, issue a verdict, spend era alpha, or permit its
archives into `decide`. Adaptive follow-up starts a fresh round and never pools
viewed evidence. Selection records the choice and requires an exact source-default
fingerprint before handing off to `eval --to-verdict`.

## Preparation

Every public run deterministically prepares the suite first:

1. generate compatibility manifests and the catalog lock from TypeScript;
2. load and characterize all 44 development and five qualification cases;
3. run the structural independence and cohort audit;
4. write a compiler-outcome-free selection review and validate the tracked listening review;
5. expose a pending review during development, but block confirmation and baseline execution;
6. validate all evidence again inside the runner.

Listening approval is bound to the musical material: the source-manifest and per-case
fingerprints, deterministic click encoder output, and exact WAV hashes. It therefore
carries across a scorer or execution-only suite rollover when those inputs are unchanged;
catalog or click changes still invalidate it mechanically.

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
npm run benchmark -- status
npm run benchmark -- explain benchmark/v2/runs/ATTEMPT-development.json.gz
```

The explanation identifies invalid sources, failure progress, termini, pooled axis RMS,
and phase completion. Undefined axes remain absent; a missing expected measurement is a
hard run failure. The physical `feasibility_bound` is diagnostic only and never changes
authored impact truth.

`status` is read-only. It reports contract freshness, current era spend and capacity,
exact compile counts, the dated host-specific timing reference, rebaseline blockers,
and retained-evidence references. Active contract inputs (the current probe, compiler
snapshot, calibration controls, and certification references) are retained locally and
validated before status is returned. Large confirmation and qualification archives are
external historical evidence: their hashes remain in the baseline and ledger, but they
are not required to run a fresh snapshot replay. `status --evidence` distinguishes those
unavailable historical references from reviewable unreferenced local files; it never
deletes evidence.

## Changing V2

1. Modify typed cases or policy, not generated compatibility JSON.
2. Regenerate variants when their plans change.
3. Run focused and full tests.
4. Generate and complete listening review without compiler outcomes.
5. Rerun allocation studies if budgets, seeds, or catalog diversity change materially.
6. Perform the required migration/re-certification, then use `baseline` for an
   intentional suite rollover. Ordinary accepted compiler changes use `rebaseline`.
