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
