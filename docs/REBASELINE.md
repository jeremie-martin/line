# Re-baselining Benchmark V2

A baseline is a single compiler identity measured on three linked surfaces:

- probe development evidence;
- canonical development evidence;
- canonical qualification monitoring evidence.

Do not hand-edit baseline scores or pointers.

## Create

```bash
npm run benchmark -- baseline --label=NAME
```

The command prepares the typed catalog, runs the probe, runs canonical development and qualification, verifies complete worker-success scope, retains compressed archives under `benchmark/v2/runs/`, writes a combined baseline bundle, and regenerates:

- `benchmark/v2/baseline.json`
- `docs/benchmark-v2-baseline.md`

Use `--resume` after an interrupted run with the same label. Use `--jobs=N` to reduce host pressure.

## Verify

```bash
npm test
npm run benchmark -- prepare
npm run decide -- PATH_TO_BASELINE_PROBE --no-gate-exit
npm run decide -- PATH_TO_BASELINE_CANONICAL --no-gate-exit
```

The two self-comparisons must be exactly zero and unresolved/inconclusive. Check that archive and compressed hashes match the baseline reference and that probe/canonical actual seeds do not overlap at 250k or 500k.

## When Required

Establish a new baseline after intentionally changing any of:

- typed cases, catalog membership, parents, groups, strata, or weights;
- scoring, measurements, target interpretation, or transform;
- budgets, seed counts, seed ranges, or profile authority;
- engine artifact or semantic execution protocol;
- the promoted compiler of record.

An operational-only runner change may retain semantic comparability when the explicit execution protocol is unchanged and output equivalence is demonstrated. It still receives a new implementation fingerprint.

The archived V1 procedure is `archive/REBASELINE_V1.md`.
