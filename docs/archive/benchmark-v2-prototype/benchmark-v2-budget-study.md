# Benchmark V2 Budget and Failure Study

Date: 2026-07-10. Candidate: `44bac2ac3d88ad27`.

This study explains the revised baseline and tests budget scaling without changing the
canonical suite. The source archive is the checksummed `baseline-revised-v2` development
run. Two additional paired-seed studies are retained under
`generated/benchmark-v2/studies/`.

## Canonical baseline failures

| Budget | Headline | Valid runs | First completions | Mean progress of invalid runs |
|---:|---:|---:|---:|---:|
| 125k | 1.09 | 3 / 63 | 3 / 63 | 64.3% |
| 250k | 423.52 | 53 / 63 | 53 / 63 | 60.8% |
| 375k | 455.38 | 56 / 63 | 56 / 63 | 57.5% |
| 500k | 478.50 | 57 / 63 | 57 / 63 | 58.2% |

All 83 invalid runs terminate as `rideStalled`. Missing contacts and missing axis
measurements are consequences of the incomplete suffix, not independent evaluator
failures. At 125k, every representative, capability, and regression run is invalid;
only the three `believer_impact_56s` runs complete. This budget is therefore a saturated
completion test rather than a useful quality measurement for one-minute scores.

At 500k all 42 representative, all six regression, and all six development-music runs
are valid. The six invalid runs are the three `frontier_dense_recovery` and three
`frontier_low_air_endurance` capability runs.

## Quality after completion

Pooled RMS errors over valid 500k runs are air 0.124, speed 0.111, impact 0.246, and
amplitude 0.231. Impact is the dominant error for 15 of the 19 sources that complete;
amplitude dominates the other four. A weighted RMS near 0.17 maps to about 500 on the
`1000 * exp(-rms / 0.25)` scale, so scores around 450-600 are expected even when every
contact succeeds.

## Paired budget scaling

The confirmation study uses the same seeds 0, 1, and 2 at every budget, removing seed
schedule as a confounder.

| Budget | Exploratory score | Valid runs | Representative | Capability |
|---:|---:|---:|---:|---:|
| 200k | 300.76 | 45 / 63 | 416.31 | 0.00 |
| 250k | 444.47 | 54 / 63 | 531.86 | 0.00 |
| 500k | 476.43 | 59 / 63 | 537.01 | 171.07 |
| 1M | 499.19 | 60 / 63 | 543.99 | 285.28 |

At 1M, the median first-completion cost is 211k frames, the 90th percentile is 345k,
and the maximum is 945k. The maximum is `frontier_dense_recovery` seed 2; the other two
seeds first complete at 345k and 455k. Most representative quality has already plateaued
by 250-500k.

`frontier_low_air_endurance` is unchanged from 200k through 1M for every seed: 55 of 90
contacts hit, with the control, 2-second rideout, and 3-second rideout phases complete,
then failure on the first 5-second low-air rideout. More compute does not cross this
boundary. It is a compiler search or representation problem.

## Recommendation

Remove 125k from the next canonical revision. It contributes almost no discriminating
quality information and encourages tuning around a completion cliff that is below real
production use.

Use 250k, 500k, and 1M as the next headline candidates, provisionally weighted 20%, 50%,
and 30%. This spans a fourfold budget range, keeps 500k as the production center, retains
an efficiency pressure at 250k, and gives high-budget tail search a meaningful role. A
three-seed full run would cost about 40% more simulated frames than the current four-budget
profile, so this weighting and compute increase should be frozen only after one candidate
comparison confirms acceptable statistical stability.

Track 100k outside the headline as a scale diagnostic using completion depth and phase
progress, not the binary valid score. At present its headline is saturated near zero.
The paired `study-scale` command should remain separate from candidate optimization and
be rerun periodically to detect narrow budget tuning.
