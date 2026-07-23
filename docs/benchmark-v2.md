# Benchmark V2

Benchmark V2 measures the compiler across the 44-case development catalog and
the canonical 250k/500k/750k budget ladder. The authoritative product and
scoring contract is in `benchmark-v2-context.md`.

## Commands

| Command | Purpose |
| --- | --- |
| `benchmark prepare` | Regenerate and validate catalog evidence |
| `benchmark status --seeds=N` | Show cache coverage and exact work for N |
| `benchmark eval` | Smallest canonical cached comparison (N=2) |
| `benchmark eval --seeds=N` | Candidate-only canonical comparison against cached baseline prefix |
| `benchmark baseline-cache status --seeds=N` | Verify cache and show its plan |
| `benchmark baseline-cache extend --seeds=N` | Compile only a missing baseline tail |
| `benchmark rebaseline --from=FILE --label=LABEL` | Promote one favorable comparison |
| `benchmark explain ARCHIVE` | Diagnose an archive |

All public physics comparisons require the optimized WASM engine. They default
to at most 48 workers and retain resumable checkpoints.

## Cached comparisons

The canonical baseline owns a stable, budget-disjoint seed ladder through 300
slots per budget. Cache shards cover contiguous ranges such as `[0,48)` and
`[48,300)`. `benchmark eval` is exactly
`benchmark eval --seeds=2`; there is no separate probe screen. A comparison at N:

1. verifies every baseline shard and the literal N-slot schedule;
2. freezes the current compiler into a checksummed snapshot;
3. runs only that candidate at N;
4. validates suite, engine, runtime, scope, schedule, archive, and cache
   identities;
5. computes one paired comparison and writes a standalone artifact.

No command mutates project state during comparison. Running N=37 after N=100
uses the first 37 cached slots. Running N=100 after N=48 adds candidate work
only; it does not pool earlier candidate output.

The candidate output defaults to
`generated/benchmark-v2/eval/cached-N<N>-<timestamp>.json`. Its neighboring
files are:

- `.request.json`: exact baseline binding, schedule, and compiler snapshot;
- `.checkpoint.jsonl`: resumable worker results;
- `.comparison.json`: compact result and promotion input;
- `.gz`, decision index, summaries, and checksum sidecars.

## Promotion

Promotion is explicit:

```bash
npm run benchmark -- rebaseline --from=...comparison.json --label=...
```

The comparison must report a favorable improvement result. Rebaseline also
requires the checked-out compiler bytes to match the measured snapshot and be
committed. It then refreshes compatibility reference material and runs the qualification sidecar,
builds a baseline bundle, and publishes `baseline.json`,
`probe-baseline.json`, and the baseline summary through a recoverable journal.

The qualification monitor is linked reporting evidence. It never changes the
development result and must not be used for case-specific tuning.

## Identity boundary

The suite fingerprint covers case membership, authored targets, scoring,
aggregation, seed policy, and relevant evaluation helpers. Compiler snapshots
cover compiler/core/optimizer sources, transitive helpers, engine sources,
package/lock/configuration files, optimized WASM bytes, and non-engine `LR_*`
environment values.

Runner implementation fingerprints remain provenance. Ordinary comparison is
not blocked solely by an operational runner-fingerprint change; it still
requires matching suite, execution protocol, engine artifact, runtime,
literal schedule, complete row scope, and content checksums. A note in the
result makes differing runner provenance visible.

## JSON and exit behavior

Use:

```bash
npm run --silent benchmark -- eval --seeds=100 --json
```

Stdout contains one JSON value; progress goes to stderr. Eval returns 0 for any
completed scientific result and 1 for invalid execution. Result categories
live in the comparison artifact.
