# How To Work On The Compiler

Benchmark V2 is the default compiler-development workflow.

## Read First

- `benchmark-v2-context.md`: what the benchmark represents and how qualification is interpreted.
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

# One-shot paired confirmation: frozen baseline and candidate each run 42 cases,
# 250k/500k/750k, 8 fresh seeds per budget; candidate qualification follows.
npm run benchmark -- canonical --decision-mode=improvement
npm run decide -- GENERATED_DEVELOPMENT_ARCHIVE

# Diagnose failures and weak cases.
npm run benchmark -- explain ARCHIVE.json
```

Public physics runs use WASM, default to 48 workers, cap budgets at 750k, report host/process resources, and retain resumable checkpoints. Use `--jobs=N` when the host is shared.
Resume retries prior error/timeout tasks and restores only successful rows.

## Meaning Of Results

Probe outcomes are `advance`, `stop`, or `unresolved`. They are screening evidence only.

Canonical outcomes are `accept`, `reject`, or `inconclusive`. Only `accept` can promote an improvement. The command uses the exact paired scope and formal seed-block confidence bounds; raw headline differences are not decisions.

For a simplification, declare the permitted regression before canonical compilation:

```bash
npm run benchmark -- canonical --decision-mode=simplification --margin=POINTS
npm run decide -- GENERATED_DEVELOPMENT_ARCHIVE --mode=simplification --margin=POINTS
```

An inconclusive non-inferiority result is not permission to accept the simplification.

## Baseline

`benchmark/v2/probe-baseline.json` is the reusable screening reference. `benchmark/v2/baseline.json` records the compiler of record, its checksummed compiler/WASM snapshot, baseline milestone evidence, and frozen decision/calibration contract. A canonical decision does not compare against that already-visible milestone run: before either outcome exists it freezes both baseline and candidate, then executes both snapshots in clean isolated worktrees on one newly allocated seed epoch. A suite, decision, or calibration change requires a new baseline. A provisional promotion baseline cannot promote candidates.

Create a new baseline only through:

```bash
npm run benchmark -- baseline --label=NAME
```

The command requires an approved tracked listening review, freezes checksummed compressed archives and the measured compiler snapshot, verifies seed separation, and opens exactly one canonical confirmation slot. Within one suite, rebaseline is allowed initially or after the current candidate receives canonical `accept`; rejection and inconclusive evidence cannot be reset into another attempt. A changed suite fingerprint is a new benchmark contract. See `REBASELINE.md`.

## Discipline

- Keep one mechanism per candidate when feasible.
- Run focused tests before a probe and the full test suite before canonical promotion.
- Treat canonical as a final one-shot confirmation. Any outcome consumes the slot; only an accepted candidate may establish the next baseline.
- Diagnose invalid runs, validity flips, termini, phases, and case-level deltas before changing policy.
- Never tune case by case against qualification monitor outputs.
- Never edit generated compatibility manifests directly; edit typed cases or `benchmark/v2/policy.ts` and run `prepare`.
- Any suite, scorer, target interpretation, weight, profile, seed-policy, execution-protocol, decision-rule, or calibration change requires a new baseline.
- Operational runner changes require a reviewed, checksummed bit-identity approval for the exact implementation pair.

V1 remains explicitly available for historical reproduction:

```bash
npm run golden:v1 -- --full
npm run decide:v1 -- CANDIDATE/golden.json BASELINE/golden.json
```
