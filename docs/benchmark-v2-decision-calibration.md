# Benchmark V2 Decision Calibration

Suite: `517e044103a5fef3`. Decision rule: `ae72a898f0c774d2`.

Simulation uses 200 formal-gate trials per scenario. Repeated seed schedules for one fixed catalog: shared budget seed-block SD 12 and parent x seed interaction SD 4. Gain/regression scenarios use one fixed heterogeneous parent-effect pattern (SD 12); the null has exactly zero catalog effect.

Repeated-sampling trials skip sensitivity bootstraps because they cannot affect the formal gate. Production decisions still use the policy's full sensitivity iteration count.

## Empirical controls

| Control | Delta | Stress-calibrated interval | One-sided bounds | Outcome |
|---|---:|---:|---:|---|
| identical archive | 0.00 | [0.00, 0.00] | [0.00, 0.00] | unresolved |
| known broad degradation | -150.20 | [-224.09, -76.32] | [-173.53, -126.87] | stop |
| impact contract failure | -446.09 | [-462.14, -430.05] | [-453.24, -438.95] | stop |
| catalog-wide correlated seed adversary | 2.99 | [-64.93, 70.90] | [-22.13, 28.10] | unresolved |

## Repeated-sampling simulation

| Profile | Scenario | Injected shift | True catalog delta | Mean observed | Positive | Negative | Unresolved | 95% coverage |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| probe | null | 0.0 | 0.00 | 0.16 | 3.5% | 5.0% | 91.5% | 100.0% |
| probe | small_gain | 5.0 | 5.00 | 4.94 | 18.5% | 0.5% | 81.0% | 99.0% |
| probe | clear_gain | 15.0 | 15.00 | 14.97 | 66.0% | 0.0% | 34.0% | 97.5% |
| probe | small_regression | -5.0 | -5.00 | -4.77 | 0.5% | 16.5% | 83.0% | 99.5% |
| canonical | null | 0.0 | 0.00 | 0.09 | 1.0% | 1.0% | 98.0% | 100.0% |
| canonical | small_gain | 5.0 | 5.00 | 4.90 | 25.5% | 0.0% | 74.5% | 99.0% |
| canonical | clear_gain | 15.0 | 15.00 | 15.41 | 100.0% | 0.0% | 0.0% | 99.5% |
| canonical | small_regression | -5.0 | -5.00 | -4.96 | 0.0% | 26.5% | 73.5% | 99.5% |

## Zero-inflated fixed-catalog stress

Retained study: `benchmark/v2/studies/decision-coverage.json` (1000 trials per cell).

| Scenario | Seeds / budget | Coverage target | False accept | False reject |
|---|---:|---:|---:|---:|
| empirical_blocks | 8 | 99.6% | 0.5% | 0.5% |
| symmetric_validity_flips | 8 | 98.7% | 2.1% | 0.5% |
| catalog_wide_hard_zero | 8 | 96.8% | 2.0% | 2.7% |

| Supported alternative | Mode | True delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|
| empirical_score_gain | improvement | 12.80 | 92.3% | 0.0% | 7.7% | 99.3% |
| paired_empirical_noninferiority_inside | simplification (margin 5) | -2.50 | 100.0% | 0.0% | 0.0% | 97.3% |

| Safety boundary | Mode | True delta | False accept | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|
| hard_zero_noninferiority_boundary | simplification (margin 5) | -5.00 | 2.9% | 2.6% | 94.5% | 96.4% |

Known low-power hard-zero diagnostics (not supported power claims):

| Diagnostic | Mode | True delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|
| hard_zero_validity_gain | improvement | 66.34 | 7.0% | 0.6% | 92.4% | 95.6% |
| hard_zero_noninferiority_inside | simplification (margin 5) | -2.50 | 2.8% | 3.1% | 94.1% | 96.4% |

The repeated-sampling target is the frozen catalog, not a hypothetical random population of authored works. The formal gate uses the seed-block t interval. Parent-preserving catalog and crossed bootstrap intervals are sensitivity diagnostics only.
