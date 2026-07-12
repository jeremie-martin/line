# Re-baselining Benchmark V2

The live workflow has two deliberately different baseline operations.

## Promote An Accepted Candidate

After `npm run benchmark -- eval --to-verdict` returns `accept`, run the
artifact's concrete `nextCommand` or provide a preferred label:

```bash
npm run benchmark -- rebaseline --label=NAME
```

This is the ordinary compiler-development path. It requires the latest settled
attempt to be accepted, the working compiler identity to equal the accepted
candidate snapshot, every compiler-bound byte to be committed, complete
retained confirmation evidence, and the accepted qualification sidecar. It
promotes that attempt as the era record, refreshes the reusable stage-0 probe
reference, and opens a new era. It does not rerun the expensive paired
confirmation.

Reject, inconclusive, futility-stop, aborted, and in-flight attempts cannot be
promoted. Do not bypass those outcomes with `baseline`.

## Bootstrap Or Roll Over A Suite

The heavier command is reserved for initial setup or an intentional suite
fingerprint change:

```bash
npm run benchmark -- baseline --label=NAME
```

It requires the approved listening review and all current decision,
calibration, certification, audit, and catalog evidence. It snapshots the exact
committed compiler boundary and WASM artifact and runs the complete baseline surfaces.
Within an unchanged suite, accepted compiler changes use `rebaseline` instead.

Before a suite rollover, regenerate the suite evidence and complete the new
human listening review without consulting compiler outcomes. Decision-surface
changes use the explicit `migrate` workflow and any required re-certification;
they are not silently absorbed by baseline creation.

## Verification

```bash
npm test
npm run benchmark -- prepare
sha256sum -c benchmark/v2/runs/LABEL-*.json.gz.sha256
```

Do not hand-edit `benchmark/v2/baseline.json`, `probe-baseline.json`, retained
archive pointers, declarations, `attempts.jsonl`, or `era-state.json`.

Historical procedures are preserved in `archive/REBASELINE_V1.md` and
`archive/benchmark-v2-one-shot/README.md`; neither is live guidance.
