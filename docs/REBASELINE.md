# Rebaseline

Promote one completed cached comparison:

```bash
npm run benchmark -- rebaseline \
  --from=generated/benchmark-v2/eval/RUN.json.comparison.json \
  --label=accepted-YYYY-MM-DD-description
```

Rebaseline verifies:

- the comparison artifact and checksum;
- a favorable improvement result;
- the candidate raw/gzip archive checksums;
- the exact compiler snapshot;
- the checked-out committed compiler matches that snapshot.

For the active 750k/N=48 campaign, it retains the exact candidate development
archive and snapshot, publishes `campaign-baseline.json`, and starts the next
cache from those same 48 seed slots. It does not run a probe, qualification, or
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

The promoted canonical archive becomes the initial baseline-cache prefix.
Future cache extension computes only missing seed slots.
