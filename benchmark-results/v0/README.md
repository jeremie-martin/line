# v0 Benchmark Results

Golden benchmark snapshots for large compiler improvements.

Each JSON file is generated with:

```sh
npm run golden -- --json-full
```

- `baseline-7fb15b4.json` records the committed baseline before hot-start
  pre-roll optimization.
- `hot-start-preroll-40997.json` records the first hot-start pre-roll proof
  of concept.
- `dense-low-air-lookahead-43658.json` records expanded dense lookahead for
  low-air/moderate-speed sections.
- `prefix-preroll-46267.json` records continuous opening-prefix scoring for
  hot-start pre-roll initial velocity selection.
- `base-relative-repair-bdad204.json` records the standalone-LDS baseline at
  commit `bdad204` (base-relative repair discrepancy, backlog #1):
  `goal_score 339.70`, `contract_pass_rate 87% (34/39)`. The reference for
  the subsequent capability track (forbidSkip / candidate lanes).
