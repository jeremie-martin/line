# Compiler Optimization Log

## arc-baseline-d38c3c2-01

- Baseline commit: `d38c3c2`
- Hypothesis: Fresh canonical baseline from the current implementation is needed before evaluating arc placement changes.
- Code changes made: None.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-baseline-d38c3c2-01`
- Decide result: Pending; this is the baseline archive for paired comparisons.
- Notable regressions/improvements: Canonical baseline HEADLINE `290.3`; budget curve scores `25k=9.19`, `50k=207.71`, `100k=292.71`, `150k=315.37`, `200k=326.07`; validity `966/1200` overall and `225/240` at 200k. Worst 200k rows include `drums_pendulum` seeds 8 and 6, `drums_crosscut` seeds 6 and 9, and `opening_burst` seed 10.
- Status: Baseline kept as the paired reference for attempt 1.

## arc-overspeed-brake-01

- Baseline used: `arc-baseline-d38c3c2-01` at commit `d38c3c2`.
- Hypothesis: Baseline 200k rows are speed-overshoot and landing/preclear dominated. The current `brake` candidate stream is only an extra resample because placement ignores `CandidateSampleMode`; making overspeed shorten/flatten risky pre-contact geometry and making `brake` candidates apply extra smooth uphill post-contact pressure should improve speed quality without changing budget policy or search ordering.
- Code changes made: Threaded `CandidateSampleMode` into target-state control generation; added smooth overspeed pressure to preclear handling; added brake-mode pressure that flattens/shortens pre-contact geometry and steepens/shortens post-contact geometry for speed bleed; added a local `smoothstep` helper. No budget, scorer, seed, spec, metric, or evaluator changes.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-overspeed-brake-01`
- Decide result: `VERDICT: ACCEPT`; baseline `290.3` -> candidate `339.7`; `Δheadline = +49.4`, 95% CI `[19.7, 82.0]`, `P(Δ<=0)=0.2%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-2.1`, `50k=+81.6`, `100k=+66.6`, `150k=+46.9`, `200k=+41.2`. Validity improved at 50k-200k (`200k 225/240 -> 231/240`) but regressed at 25k (`91/240 -> 82/240`). Largest 200k validity flips included `drums_crosscut` seed 6, `drums_pendulum` seed 8, `drums_dropout` seed 7, `syncopated_switchback` seed 0, and `dense_sprint` seed 2 becoming pass; `drums_pendulum` seed 7 regressed pass->fail. At 200k, candidate viability rose `31.2% -> 36.2%`, arc direct landing rate rose `32.3% -> 37.2%`, preclear fell `1965 -> 1537` per row, and skips fell `15 -> 9`.
- Verification: `npx tsx -e "import './scripts/v0/arc_placement.ts'; console.log('arc_placement import ok')"` passed. `npx tsc --noEmit` was attempted but is not usable as a repo-wide check because the current project has pre-existing TypeScript configuration/import errors unrelated to this change.
- Status: Kept and committed as the new baseline for the next mechanism.
