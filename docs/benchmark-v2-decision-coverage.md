# Benchmark V2 Decision Coverage Study

Reference: `benchmark/v2/runs/calibration-v2.4-coverage-reference.json.gz` (artifact `a77a14c3c4a3768226a1aa574d4a7a3ac99f9580eb6a5276c6c46e8f90ff6527`). 1000 trials per cell.

## Null calibration

| Scenario | Seeds | Mean delta | Coverage | False accept | False reject |
|---|---:|---:|---:|---:|---:|
| empirical_blocks | 8 | -0.10 | 99.6% [99.0, 99.8] | 0.5% [0.2, 1.2] | 0.5% [0.2, 1.2] |
| symmetric_validity_flips | 8 | -0.20 | 98.7% [97.8, 99.2] | 2.1% [1.4, 3.2] | 0.5% [0.2, 1.2] |
| catalog_wide_hard_zero | 8 | 1.66 | 96.8% [95.5, 97.7] | 2.0% [1.3, 3.1] | 2.7% [1.9, 3.9] |

## Alternative power and non-inferiority

| Scenario | Mode | True delta | Mean delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| empirical_score_gain | improvement | 12.80 | 12.71 | 92.3% [90.5, 93.8] | 0.0% [0.0, 0.4] | 7.7% [6.2, 9.5] | 99.3% [98.6, 99.7] |
| hard_zero_validity_gain | improvement | 66.34 | 66.62 | 7.0% [5.6, 8.8] | 0.6% [0.3, 1.3] | 92.4% [90.6, 93.9] | 95.6% [94.1, 96.7] |
| noninferiority_inside | simplification (margin 5) | -2.50 | -8.60 | 2.1% [1.4, 3.2] | 2.9% [2.0, 4.1] | 95.0% [93.5, 96.2] | 96.2% [94.8, 97.2] |
| noninferiority_boundary | simplification (margin 5) | -5.00 | -9.98 | 2.9% [2.0, 4.1] | 2.8% [1.9, 4.0] | 94.3% [92.7, 95.6] | 95.6% [94.1, 96.7] |

All stored empirical scores were recomputed from retained raw reports before simulation. Wilson 95% intervals accompany every Monte Carlo rate in the JSON artifact.
