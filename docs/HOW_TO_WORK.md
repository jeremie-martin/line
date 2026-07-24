# How To Work On The Compiler

Benchmark V2 has one development loop: compare the current compiler with the
accepted baseline at whatever depth is useful, then explicitly promote a
convincing result.

## Normal loop

```bash
# Regenerate and validate deterministic benchmark metadata when needed.
npm run benchmark -- prepare

# Read-only: does the cache already cover the comparison you want?
npm run benchmark -- status --seeds=100

# Smallest canonical cached comparison: 264 candidate compiles.
npm run benchmark -- eval

# Heavy comparison. Only the candidate is compiled; baseline slots are reused.
npm run benchmark -- eval --seeds=100 --jobs=48

# Only if status says some baseline slots are missing:
npm run benchmark -- baseline-cache extend --seeds=100 --jobs=48

# Promote a favorable comparison artifact.
npm run benchmark -- rebaseline \
  --from=generated/benchmark-v2/eval/RUN.json.comparison.json \
  --label=descriptive-label
```

`eval` is exactly `eval --seeds=2`; there is no separate quick/probe
comparison. `N` is an ordinary compute choice in `1..300`. N=1 is a descriptive
pipeline diagnostic: it reports scores, validity, regimes, and telemetry, but
seed-block inference is unavailable and the result is never promotable. Choose
larger N from the importance and uncertainty of the question. Running N=100
simply because spare compute is available is valid. The cache uses one stable
seed ladder, so N=100 is the prefix of N=300 and does not recompute baseline
evidence.

`eval --seeds=N` always exits 0 after a completed comparison. The artifact
contains the statistical result; an inconclusive or negative scientific result
is not a process failure. `--resume --out=SAME_PATH` resumes the exact frozen
candidate snapshot and checkpoint.

## What to inspect

- headline delta, seed-block SE, and interval;
- movement at 250k, 500k, and 750k;
- representative, capability, regression, and development-music strata;
- validity gains and losses;
- largest case regressions and improvements;
- whether the result matches the proposed physical mechanism.

The confidence calculation is a useful common ruler, not a permission system.
Multiple inspected candidates or repeated depths create selection effects;
record them honestly and use a sufficiently clear final comparison for
promotion.

## Variant families

When one mechanism has several credible implementations:

```bash
npm run benchmark -- family capture NAME --variant=MEMBER
npm run benchmark -- family run NAME
npm run benchmark -- family select NAME --variant=MEMBER
```

Family evidence is shared-seed exploration. Bake the selected behavior into
source defaults before a normal cached comparison.

## Baselines

`benchmark/v2/baseline.json` names the accepted compiler snapshot and canonical
cache. Cache shards are immutable, checksummed, contiguous seed-slot ranges.
`baseline-cache extend` is the only normal operation that compiles baseline
work, and it compiles only a missing tail.

`rebaseline --from=...` verifies the measured snapshot and current committed
compiler identity, retains the candidate development evidence, refreshes
compatibility reference material, runs qualification, and starts the new
baseline cache from the promoted canonical archive.

Use `benchmark baseline` only for an intentional full freeze such as bootstrap
or suite replacement.

## Discipline

- Keep one mechanism per candidate where practical.
- Prefer focused tests and bounded panels before expensive runs.
- Do not tune case by case or against qualification monitors.
- Preserve resumable outputs for long runs.
- Keep raw/generated archives out of commits.
- Treat old declarations, certification studies, and accounting files as
  historical material, not runnable workflow.
