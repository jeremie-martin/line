# Benchmark V2

Benchmark V2's active campaign measures the compiler across the 44-case
development catalog at 750k/N=48. The historical frozen contract retains the
250k/500k/750k ladder, but its old-ruler scores are not comparable to the
active accumulated-contacted-frame-impulse scorer. The authoritative product
and scoring contract remains in `benchmark-v2-context.md`.

## Commands

| Command | Purpose |
| --- | --- |
| `benchmark prepare` | Regenerate and validate catalog evidence |
| `benchmark status` | Show the active 750k/N=48 baseline and exact work |
| `benchmark eval --seeds=48` | Candidate-only 750k comparison against the retained N=48 baseline |
| `benchmark baseline-cache status --seeds=48` | Verify the active campaign cache |
| `benchmark baseline-cache extend --seeds=N --baseline=benchmark/v2/baseline.json` | Explicitly extend only the frozen full-ladder cache |
| `benchmark rebaseline --from=FILE --label=LABEL` | Promote one favorable comparison |
| `benchmark bootstrap --label=NAME --budget=750000 --seeds=48 --jobs=48` | Explicit scorer-bound active-baseline bootstrap; governance use only |
| `benchmark explain ARCHIVE` | Diagnose an archive |

All public physics comparisons require the optimized WASM engine. They default
to at most 48 workers and retain resumable checkpoints.

## Cached comparisons

The active campaign baseline owns the retained 750k seed schedule through 48
slots. The current baseline is the exact fresh scorer-bound archive, not a
projection from the old ruler. A campaign comparison:

1. verifies the frozen source cache, archive, and literal 48-slot schedule;
2. freezes the current compiler into a checksummed snapshot;
3. runs only that candidate at N=48;
4. validates suite, engine, runtime, scope, schedule, archive, and cache
   identities;
5. computes one paired comparison and writes a standalone artifact.

No command mutates project state during comparison. N=48 is fixed for this
campaign; lower-depth probes are intentionally disabled.

The candidate output defaults to
`generated/benchmark-v2/eval/cached-N48-<timestamp>.json`. Its neighboring
files are:

- `.request.json`: exact baseline binding, schedule, and compiler snapshot;
- `.checkpoint.jsonl`: resumable worker results;
- `.comparison.json`: compact result and promotion input;
- `.gz`, decision index, summaries, and checksum sidecars.

## Promotion

Campaign promotion is explicit:

```bash
npm run benchmark -- rebaseline --from=...comparison.json --label=...
```

The comparison must report a favorable improvement result. Rebaseline also
requires the checked-out compiler bytes to match the measured snapshot and be
committed. It retains the exact 750k archive and updates
`campaign-baseline.json`; it does not compile or mutate the deferred 250k/500k
reference.

The original full-ladder baseline remains at `benchmark/v2/baseline.json` and
can be inspected explicitly with `--baseline=benchmark/v2/baseline.json`.
It predates scoring protocol `c7146660` and is historical evidence, not a
comparison ruler for the active baseline.

The prior qualification monitor remains preserved with the frozen full-ladder
baseline. Scoped campaign promotion does not refresh it, and it must not be
used for case-specific tuning.

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

The current suite identity explicitly binds impact to accumulated contacted-
frame redirection impulse. Golden evaluation is independently pinned. A
scorer change requires a fresh archive and scorer-bound calibration; changing
the label on old score evidence is invalid.

## JSON and exit behavior

Use:

```bash
npm run --silent benchmark -- eval --seeds=48 --json
```

Stdout contains one JSON value; progress goes to stderr. Eval returns 0 for any
completed scientific result and 1 for invalid execution. Result categories
live in the comparison artifact.
