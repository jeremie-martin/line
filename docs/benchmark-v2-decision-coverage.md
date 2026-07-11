# Benchmark V2 Decision Coverage Study

Reference: `benchmark/v2/runs/calibration-v2.4-coverage-reference.json.gz` (artifact `842c66d8d1dc4aaad2b5c07c395f9d35d9e9f63deb920f2d792f30c5be71630a`). 1000 trials per cell.

## Null calibration

| Scenario | Seeds | Mean delta | Coverage | False accept | False reject |
|---|---:|---:|---:|---:|---:|
| empirical_blocks | 8 | -0.10 | 99.6% [99.0, 99.8] | 0.5% [0.2, 1.2] | 0.5% [0.2, 1.2] |
| symmetric_validity_flips | 8 | -0.20 | 98.7% [97.8, 99.2] | 2.1% [1.4, 3.2] | 0.5% [0.2, 1.2] |
| catalog_wide_hard_zero | 8 | 1.66 | 96.8% [95.5, 97.7] | 2.0% [1.3, 3.1] | 2.7% [1.9, 3.9] |

## Supported power claims

| Scenario | Mode | True delta | Mean delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| empirical_score_gain | improvement | 12.80 | 12.71 | 92.3% [90.5, 93.8] | 0.0% [0.0, 0.4] | 7.7% [6.2, 9.5] | 99.3% [98.6, 99.7] |
| paired_empirical_noninferiority_inside | simplification (margin 5) | -2.50 | -2.51 | 100.0% [99.6, 100.0] | 0.0% [0.0, 0.4] | 0.0% [0.0, 0.4] | 97.3% [96.1, 98.1] |

## Safety boundary

| Scenario | Mode | True delta | Mean delta | False accept | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| hard_zero_noninferiority_boundary | simplification (margin 5) | -5.00 | -5.50 | 2.9% [2.0, 4.1] | 2.6% [1.8, 3.8] | 94.5% [92.9, 95.8] | 96.4% [95.1, 97.4] |

## Known power limits

These hard-zero cases are coverage and false-rejection diagnostics. Their positive rate is reported explicitly and is not a supported power claim.

| Scenario | Mode | True delta | Mean delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| hard_zero_validity_gain | improvement | 66.34 | 66.62 | 7.0% [5.6, 8.8] | 0.6% [0.3, 1.3] | 92.4% [90.6, 93.9] | 95.6% [94.1, 96.7] |
| hard_zero_noninferiority_inside | simplification (margin 5) | -2.50 | -4.63 | 2.8% [1.9, 4.0] | 3.1% [2.2, 4.4] | 94.1% [92.5, 95.4] | 96.4% [95.1, 97.4] |

All stored empirical scores were recomputed from retained raw reports before simulation. Wilson 95% intervals accompany every Monte Carlo rate in the JSON artifact.
