# Benchmark V2

Benchmark V2's active campaign measures the compiler across the 44-case
development catalog at 750k, with a predeclared N=48 maximum and strict
N=8/16/32/48 looks. The historical frozen contract retains the
250k/500k/750k ladder, but its old-ruler scores are not comparable to the
active accumulated-contacted-frame-impulse scorer. The authoritative product
and scoring contract remains in `benchmark-v2-context.md`.

## Commands

| Command | Purpose |
| --- | --- |
| `benchmark prepare` | Regenerate and validate catalog evidence |
| `benchmark status` | Show the active 750k promotion headline, first look, cache coverage, and maximum work |
| `benchmark eval --seeds=48` | Candidate-only strict N=8/16/32/48 improvement experiment |
| `benchmark baseline-cache status --seeds=LOOK` | Verify one declared active-campaign prefix |
| `benchmark baseline-cache extend --seeds=LOOK` | Explicitly append only a missing active-campaign prefix |
| `benchmark baseline-cache extend --seeds=N --baseline=benchmark/v2/baseline.json` | Explicitly extend the historical full-ladder cache |
| `benchmark rebaseline --from=FILE --label=LABEL` | Promote one favorable comparison |
| `benchmark bootstrap --label=NAME --budget=750000 --seeds=48 --jobs=48` | Explicit scorer-bound active-baseline bootstrap; governance use only |
| `benchmark explain ARCHIVE` | Diagnose an archive |

All public physics comparisons require the optimized WASM engine. They default
to at most 48 workers and retain resumable checkpoints.

The [alignment review](benchmark-v2-alignment-review.md) examines the current
baseline's measurement limits, product coverage, and a proposed future pilot.
It does not change this benchmark or its acceptance protocol.

## Cached comparisons

The active campaign baseline owns one literal 750k seed ladder through 48
slots. The current `arc-control-memory` baseline was promoted at N=8;
accepted baselines initially contain their stopping prefix and may later
receive explicit cache extensions. The baseline is exact scorer-bound evidence, not a
projection from the old ruler. A campaign improvement comparison:

1. verifies the frozen source cache, available shards, and literal 48-slot ladder;
2. freezes the current compiler into a checksummed snapshot;
3. queues only candidate slots `[0,8)`, with all 44 cases represented;
4. publishes a checksummed, self-consistent N=8 prefix and applies the
   calibrated sequential boundary;
5. after `continue`, resumes the same request and checkpoint through N=16,
   N=32, and N=48, never queuing a later wave before the earlier decision;
6. validates suite, scorer, engine, runtime, scope, literal schedule, archive,
   cache, policy, calibration, and candidate identities;
7. writes one standalone comparison artifact with every completed look.

Within each wave, tasks are queued seed-major: all 44 development cases for one
seed slot precede the next slot. Workers may overlap the boundary, so progress
is emitted from completed cells rather than the queue position. A round line
appears only when the full 44-case block and every earlier block are complete.
It uses the same paired headline, jackknife seed-block SE, and reference-t
probability as the decision layer. Only the four lines marked `LOOK` have
stopping authority; intervening probabilities are descriptive.

No command mutates project state during comparison. The declared maximum stays
N=48; the four looks are one experiment, not independently selected probes.
Explicit simplification and historical/deep comparisons remain fixed-N and do
not inherit this improvement rule.

If the baseline cache lacks the next declared prefix, eval writes a structured
pause artifact and exits before candidate tail work enters the queue. Run the
printed `baseline-cache extend --seeds=LOOK`, then resume the identical request.
The request persists the comparison-artifact destination, and every printed
resume command reproduces it. Existing shards are immutable; only a
checksummed tail can be appended. One attempt-wide lock covers the shared
request, checkpoint, all look artifacts, and final publication, so a second
process cannot resume the same `--out` concurrently.

The candidate output defaults to
`generated/benchmark-v2/eval/cached-N48-<timestamp>`. Its neighboring
files are:

- `.request.json`: exact baseline binding, schedule, and compiler snapshot;
- `.checkpoint.jsonl`: resumable worker results;
- `.round-progress-reference.json`: checksummed verified baseline rows for the
  current wave's diagnostic display;
- `.progress.jsonl`: reconstructable per-seed paired summaries; diagnostic
  only and rewritten coherently from the checkpoint on resume;
- `.N8.json`, `.N16.json`, `.N32.json`, `.N48.json`: only the completed,
  published look prefixes (later files exist only when reached);
- `.look-N.json`: fixed-look diagnostics plus the authoritative
  sequential probability, boundary, and action;
- `.comparison.json`: compact result and promotion input;
- `.gz`, decision index, summaries, and checksum sidecars.

## Promotion

Campaign promotion is explicit:

```bash
npm run benchmark -- rebaseline --from=...comparison.json --label=...
```

The ordinary path requires the sequential outcome `accept`. Rebaseline also
requires the checked-out compiler bytes to match the measured snapshot and be
committed. It retains the exact 750k archive and updates
`campaign-baseline.json`; then regenerate the current-baseline analysis from
that exact accepted prefix with
`node --import tsx scripts/benchmark/analyze_campaign_baseline.ts`. Rebaseline
does not compile or mutate the deferred 250k/500k reference. It may promote at
N=8, N=16, N=32, or N=48. The accepted prefix and
its headline become the new promotion reference; a later cache extension may
report a descriptive monitoring headline but cannot revise it.

A deliberate owner decision can override only the favorable-result gate with
`--force --force-reason="..."`. All identity, checksum, completeness, snapshot,
and committed-source checks still apply. The published baseline preserves the
comparison's original outcome plus the override reason; force never relabels
inconclusive evidence as an ordinary acceptance.

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
