# How To Work On The Compiler

Benchmark V2 is the default compiler-development workflow.

## Read First

- `benchmark-v2-context.md`: what the benchmark represents and what is held out.
- `benchmark-v2-decisions.md`: estimand, confidence method, outcomes, and limits.
- `benchmark-v2.md`: commands, artifacts, preparation, and diagnostics.
- `compiler_goals.md`: compiler behavior and budget contract.
- `../GOAL_LDS_COMPILER_IMPROVEMENT.md`: active improvement loop.

Historical V1 instructions are in `archive/HOW_TO_WORK_V1.md` and do not apply to the default commands.

## Commands

```bash
# Validate and regenerate deterministic benchmark evidence.
npm run benchmark -- prepare

# Fast development evidence: 42 cases, 250k/500k, 3 seeds per budget.
npm run benchmark -- probe --out=generated/benchmark-v2/candidates/NAME-probe.json

# Compare candidate-first against the frozen baseline for its profile.
npm run decide -- generated/benchmark-v2/candidates/NAME-probe.json

# Confirmation: 42 cases, 250k/500k/750k, 4 seeds per budget,
# followed by the linked five-work qualification monitor.
npm run benchmark -- canonical --label=NAME
npm run decide -- generated/benchmark-v2/canonical-runs/NAME-development.json

# Diagnose failures and weak cases.
npm run benchmark -- explain ARCHIVE.json
```

Public physics runs use WASM, default to 48 workers, cap budgets at 750k, report host/process resources, and retain resumable checkpoints. Use `--jobs=N` when the host is shared.

## Meaning Of Results

Probe outcomes are `advance`, `stop`, or `unresolved`. They are screening evidence only.

Canonical outcomes are `accept`, `reject`, or `inconclusive`. Only `accept` can promote an improvement. The command uses the exact paired scope and formal seed-block confidence bounds; raw headline differences are not decisions.

For a simplification, declare the permitted regression before comparison:

```bash
npm run decide -- CANDIDATE.json --mode=simplification --margin=POINTS
```

An inconclusive non-inferiority result is not permission to accept the simplification.

## Baseline

`benchmark/v2/baseline.json` is the machine-readable baseline pointer. It covers a probe archive, canonical development archive, and linked qualification archive from one compiler identity. `benchmark-v2-baseline.md` is its concise report.

Create a new baseline only through:

```bash
npm run benchmark -- baseline --label=NAME
```

The command freezes checksummed compressed archives and verifies that probe and canonical seeds are disjoint. See `REBASELINE.md`.

## Discipline

- Keep one mechanism per candidate when feasible.
- Run focused tests before a probe and the full test suite before canonical promotion.
- Diagnose invalid runs, validity flips, termini, phases, and case-level deltas before changing policy.
- Never tune against qualification outputs.
- Never edit generated compatibility manifests directly; edit typed cases or `benchmark/v2/policy.ts` and run `prepare`.
- Any suite, scorer, target interpretation, weight, profile, seed-policy, or execution-protocol change requires a new baseline.
- Operational runner changes may preserve the protocol, but must demonstrate output equivalence and retain a new implementation fingerprint.

V1 remains explicitly available for historical reproduction:

```bash
npm run golden:v1 -- --full
npm run decide:v1 -- CANDIDATE/golden.json BASELINE/golden.json
```
