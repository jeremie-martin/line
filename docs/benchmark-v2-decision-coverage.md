# Benchmark V2 Decision Coverage Study

Reference: `benchmark/v2/runs/contact-redir-impulse-v2-750k-development.json.decision-index.json` (artifact `eed94e610a555c3606461ac6e5c48425cec12a426cc28da7ec50671600302007`). 1000 trials per cell.

## Null calibration

| Scenario | Seeds | Mean delta | Coverage | False accept | False reject |
|---|---:|---:|---:|---:|---:|
| empirical_blocks | 48 | 0.10 | 99.8% [99.3, 100.0] | 0.6% [0.3, 1.3] | 0.4% [0.2, 1.0] |
| symmetric_validity_flips | 48 | 0.14 | 99.1% [98.3, 99.5] | 0.9% [0.5, 1.7] | 1.3% [0.8, 2.2] |
| catalog_wide_hard_zero | 48 | -2.05 | 99.4% [98.7, 99.7] | 0.6% [0.3, 1.3] | 0.5% [0.2, 1.2] |

## Supported power claims

| Scenario | Mode | True delta | Mean delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| empirical_score_gain | improvement | 15.00 | 15.02 | 100.0% [99.6, 100.0] | 0.0% [0.0, 0.4] | 0.0% [0.0, 0.4] | 99.6% [99.0, 99.8] |
| paired_empirical_noninferiority_inside | simplification (margin 5) | -2.50 | -2.48 | 91.9% [90.0, 93.4] | 0.0% [0.0, 0.4] | 8.1% [6.6, 10.0] | 98.6% [97.7, 99.2] |

## Safety boundary

| Scenario | Mode | True delta | Mean delta | False accept | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| hard_zero_noninferiority_boundary | simplification (margin 5) | -5.00 | -3.79 | 1.2% [0.7, 2.1] | 0.5% [0.2, 1.2] | 98.3% [97.3, 98.9] | 99.6% [99.0, 99.8] |

## Known power limits

These hard-zero cases are coverage and false-rejection diagnostics. Their positive rate is reported explicitly and is not a supported power claim.

| Scenario | Mode | True delta | Mean delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| hard_zero_validity_gain | improvement | 66.06 | 68.21 | 4.6% [3.5, 6.1] | 0.0% [0.0, 0.4] | 95.4% [93.9, 96.5] | 98.8% [97.9, 99.3] |
| hard_zero_noninferiority_inside | simplification (margin 5) | -2.50 | -4.09 | 0.5% [0.2, 1.2] | 0.6% [0.3, 1.3] | 98.9% [98.0, 99.4] | 99.6% [99.0, 99.8] |

All empirical scores come from a checksummed decision index cryptographically bound to the retained raw scorer-bound archive. Wilson 95% intervals accompany every Monte Carlo rate in the JSON artifact.
