# Benchmark V2 Decision Calibration

Suite: `b118882720a96854`. Decision rule: `752eb26e92f834cf`.

Simulation uses 200 trials and 100 bootstrap iterations per trial. Repeated seed schedules for one fixed catalog: shared budget seed-block SD 12 and parent x seed interaction SD 4. Gain/regression scenarios use one fixed heterogeneous parent-effect pattern (SD 12); the null has exactly zero catalog effect.

Bootstrap iterations only exercise sensitivity diagnostics; the formal seed-block gate and its coverage do not depend on them.

## Empirical controls

| Control | Delta | 95% interval | One-sided bounds | Outcome |
|---|---:|---:|---:|---|
| identical archive | 0.00 | [0.00, 0.00] | [0.00, 0.00] | unresolved |
| known broad degradation | -141.18 | [-216.65, -65.70] | [-176.02, -106.33] | stop |
| catalog-wide correlated seed adversary | 2.99 | [-31.78, 37.75] | [-14.14, 20.11] | unresolved |

## Repeated-sampling simulation

| Profile | Scenario | Injected shift | True catalog delta | Mean observed | Positive | Negative | Unresolved | 95% coverage |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| probe | null | 0.0 | 0.00 | 0.16 | 8.5% | 8.0% | 83.5% | 95.0% |
| probe | small_gain | 5.0 | 5.00 | 4.94 | 30.0% | 2.5% | 67.5% | 95.5% |
| probe | clear_gain | 15.0 | 15.00 | 14.97 | 86.0% | 0.0% | 14.0% | 91.5% |
| probe | small_regression | -5.0 | -5.00 | -4.77 | 2.0% | 30.0% | 68.0% | 94.5% |
| canonical | null | 0.0 | 0.00 | 0.28 | 5.5% | 2.5% | 92.0% | 95.0% |
| canonical | small_gain | 5.0 | 5.00 | 5.14 | 33.5% | 0.5% | 66.0% | 96.0% |
| canonical | clear_gain | 15.0 | 15.00 | 15.21 | 96.0% | 0.0% | 4.0% | 96.0% |
| canonical | small_regression | -5.0 | -5.00 | -4.78 | 0.0% | 28.0% | 72.0% | 96.0% |

The repeated-sampling target is the frozen catalog, not a hypothetical random population of authored works. The formal gate uses the seed-block t interval. Parent-preserving catalog and crossed bootstrap intervals are sensitivity diagnostics only.
