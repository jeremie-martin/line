# Legacy attempt-ledger retirement

The stateful attempt/alpha-budget workflow was removed on 2026-07-23. Its
implementation and tracked data remain recoverable from repository history;
they are not inputs to any current benchmark command.

Last working-tree checksums before removal:

- `benchmark/v2/attempts.jsonl`:
  `442c58f8422754a5e5abd21688a3e54eeab47f47a69c9ba67e8121ed4a2bd3f5`
- `benchmark/v2/era-state.json`:
  `0c7ce15af2d922e9fa2ae421d0f4a7144d078219c512caf5d8d741a1ca7304a0`

The last log entry settled the accidentally launched baseline-identical
N=100 candidate as aborted before any decision look. No current comparison
or promotion behavior depends on this historical accounting.
