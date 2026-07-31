# Rebaseline

Promote one completed cached comparison:

```bash
npm run benchmark -- rebaseline \
  --from=generated/benchmark-v2/eval/RUN.json.comparison.json \
  --label=accepted-YYYY-MM-DD-description
```

Rebaseline verifies:

- the comparison artifact and checksum;
- a favorable improvement result, unless an explicit forced replacement is declared;
- the candidate raw/gzip archive checksums;
- the exact compiler snapshot;
- the checked-out committed compiler matches that snapshot.
- for an active campaign, the exact N=48 declaration, reached stopping prefix,
  all sequential looks, calibrated boundary identity, and request checksum.

The ordinary path requires a favorable (`accept`) comparison. An explicit
owner override may publish other complete evidence with:

```bash
npm run benchmark -- rebaseline \
  --from=generated/benchmark-v2/eval/RUN.json.comparison.json \
  --label=deliberate-replacement \
  --force \
  --force-reason="why accepting the measured uncertainty is correct"
```

The override is provenance, not a revised statistical result. Publication
retains the comparison's original outcome and records the reason.

For the active 750k campaign, it retains the exact accepted N=8, N=16, N=32,
or N=48 candidate development prefix and snapshot, publishes
`campaign-baseline.json`, and starts the next cache from those same seed slots.
The published headline is permanently labelled with the promotion depth. A
later cache extension may expose a descriptive monitoring headline but cannot
replace it. Rebaseline does not run a probe, qualification, or
the deferred 250k/500k budgets.

Only an explicit full-ladder rebaseline replays the snapshot for the historical
probe and qualification sidecars, builds a full baseline bundle, and publishes
the compact full-ladder references. The publication journal makes an interrupted
update recoverable by rerunning the same command.

Use `--resume` to resume probe or qualification worker checkpoints during an
explicit full-ladder rebaseline; the active campaign path reuses completed
candidate evidence and has no such worker phase.
`--discard-pending` is only for a journal that provably did not publish the
new baseline; otherwise rerun to recover it.

The promoted canonical archive becomes the initial baseline-cache prefix over
the same declared 48-slot ladder. Future cache extension computes only a
missing declared tail and never overwrites covered rows.
