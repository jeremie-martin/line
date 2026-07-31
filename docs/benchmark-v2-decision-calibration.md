# Benchmark V2 Decision Calibration

Suite: `7bd878d8aaea08a9`. Inference rule: `56b577326b380cfd`.

Simulation uses 200 formal-gate trials per scenario. Repeated seed schedules for one fixed catalog: shared budget seed-block SD 12 and parent x seed interaction SD 4. Gain/regression scenarios use one fixed heterogeneous parent-effect pattern (SD 12); the null has exactly zero catalog effect.

Repeated-sampling trials skip sensitivity bootstraps because they cannot affect the formal gate. Production decisions still use the policy's full sensitivity iteration count.

## Scorer-bound controls

Scorer-bound controls are deterministic transformations of the fresh checksummed canonical decision index. The index is cryptographically bound to its retained raw archive and carries the current scoring-protocol and suite identities; no old-ruler scores are reused or relabeled.

| Control | Delta | Stress-calibrated interval | One-sided bounds | Outcome |
|---|---:|---:|---:|---|
| identical archive | 0.00 | [0.00, 0.00] | [0.00, 0.00] | inconclusive |
| known broad degradation | -100.14 | [-101.12, -99.17] | [-101.02, -99.27] | reject |
| impact contract failure | -593.50 | [-597.13, -589.87] | [-596.76, -590.24] | reject |
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
| empirical_blocks | 48 | 99.8% | 0.6% | 0.4% |
| symmetric_validity_flips | 48 | 99.1% | 0.9% | 1.3% |
| catalog_wide_hard_zero | 48 | 99.4% | 0.6% | 0.5% |

| Supported alternative | Mode | True delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|
| empirical_score_gain | improvement | 15.00 | 100.0% | 0.0% | 0.0% | 99.6% |
| paired_empirical_noninferiority_inside | simplification (margin 5) | -2.50 | 91.9% | 0.0% | 8.1% | 98.6% |

| Safety boundary | Mode | True delta | False accept | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|
| hard_zero_noninferiority_boundary | simplification (margin 5) | -5.00 | 1.2% | 0.5% | 98.3% | 99.6% |

Known low-power hard-zero diagnostics (not supported power claims):

| Diagnostic | Mode | True delta | Positive | Negative | Unresolved | Coverage |
|---|---|---:|---:|---:|---:|---:|
| hard_zero_validity_gain | improvement | 66.06 | 4.6% | 0.0% | 95.4% | 98.8% |
| hard_zero_noninferiority_inside | simplification (margin 5) | -2.50 | 0.5% | 0.6% | 98.9% | 99.6% |

The repeated-sampling target is the frozen catalog, not a hypothetical random population of authored works. The formal gate uses the seed-block t interval. Parent-preserving catalog and crossed bootstrap intervals are sensitivity diagnostics only.
