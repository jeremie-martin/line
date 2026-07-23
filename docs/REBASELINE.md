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

It then replays the snapshot for the cheap probe baseline and qualification
monitor, retains the canonical development archive, builds a baseline bundle,
and publishes the compact baseline references. The publication journal makes
an interrupted update recoverable by rerunning the same command.

Use `--resume` to resume probe or qualification worker checkpoints.
`--discard-pending` is only for a journal that provably did not publish the
new baseline; otherwise rerun to recover it.

The promoted canonical archive becomes the initial baseline-cache prefix.
Future cache extension computes only missing seed slots.
