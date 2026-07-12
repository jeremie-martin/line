# Benchmark V2 Decision Coverage Study

Reference: `benchmark/v2/runs/calibration-v2.5-coverage-reference.json.gz` (artifact `6ff32b57ab3e0c53d78af27ecea4af4014fbf016034901f2cdab63fb74f7b971`). 1000 trials per cell.

## Null calibration

| Scenario | Seeds | Mean delta | Coverage | False accept | False reject |
|---|---:|---:|---:|---:|---:|
| empirical_blocks | 8 | -0.10 | 99.6% [99.0, 99.8] | 0.5% [0.2, 1.2] | 0.5% [0.2, 1.2] |
| symmetric_validity_flips | 8 | -0.91 | 99.0% [98.2, 99.5] | 0.9% [0.5, 1.7] | 1.3% [0.8, 2.2] |
| catalog_wide_hard_zero | 8 | 1.66 | 96.8% [95.5, 97.7] | 2.0% [1.3, 3.1] | 2.7% [1.9, 3.9] |

## Supported power claims

| Scenario | Mode | True delta | Mean delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| empirical_score_gain | improvement | 12.80 | 12.71 | 92.3% [90.5, 93.8] | 0.0% [0.0, 0.4] | 7.7% [6.2, 9.5] | 99.4% [98.7, 99.7] |
| paired_empirical_noninferiority_inside | simplification (margin 5) | -2.50 | -2.51 | 100.0% [99.6, 100.0] | 0.0% [0.0, 0.4] | 0.0% [0.0, 0.4] | 97.4% [96.2, 98.2] |

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
