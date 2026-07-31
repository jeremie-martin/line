# Benchmark V2 Current Baseline Analysis

Baseline: `contact-redir-impulse-v2-750k`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=48 headline: **593.5031**; target gap: **56.4969**.
- Validity: **2111/2112** (99.95%).
- Run-score median 603.88, IQR 566.44–649.47, 5th–95th percentile 391.32–767.52.
- Seed-block headline SD: 3.58; case identity explains 98.5% of arithmetic run-score variation, seed identity 0.1%.

The headline is a weighted hierarchical geometric aggregate. Arithmetic means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [0,50) | 1 | 0.1% |
| [300,350) | 5 | 0.2% |
| [350,400) | 121 | 5.7% |
| [400,450) | 88 | 4.2% |
| [450,500) | 123 | 5.8% |
| [500,550) | 142 | 6.7% |
| [550,600) | 478 | 22.6% |
| [600,650) | 631 | 29.9% |
| [650,700) | 241 | 11.4% |
| [700,750) | 91 | 4.3% |
| [750,800) | 191 | 9.0% |

## Suite hierarchy

| Stratum | Weight | Score | Contribution to 56.50-point target gap |
|---|---:|---:|---:|
| representative | 70% | 627.83 | 15.52 (27.5%) |
| capability | 15% | 463.73 | 27.94 (49.5%) |
| legacy_regression | 10% | 598.83 | 5.12 (9.1%) |
| development_music | 5% | 491.56 | 7.92 (14.0%) |

| Largest weighted group gaps | Stratum | Campaign weight | Score | Target-gap contribution |
|---|---|---:|---:|---:|
| dense_recovery_frontier | capability | 5.3% | 381.36 | 14.10 |
| rapid_pickup_frontier | capability | 6.0% | 455.81 | 11.65 |
| dense_musical | representative | 7.0% | 495.97 | 10.78 |
| believer_56s | development_music | 5.0% | 491.56 | 7.92 |
| subdivision_pickup | representative | 10.5% | 582.48 | 7.09 |
| cadence_transition | representative | 8.4% | 601.75 | 4.05 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 578.60 | 3.21 |
| low_air_frontier | capability | 3.8% | 591.71 | 2.19 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| believer_56_6s | 359.38 | 48/48 | 6.93 | 0.186 |
| frontier_dense_recovery | 359.74 | 47/48 | 60.35 | 0.353 |
| believer_56_6s_impact_relief | 385.70 | 48/48 | 6.49 | 0.211 |
| frontier_dense_recovery_240ms_figures | 404.28 | 48/48 | 16.12 | 0.352 |
| frontier_pickup_progression_shifted | 452.22 | 48/48 | 7.64 | 0.340 |
| frontier_pickup_progression | 459.43 | 48/48 | 5.99 | 0.347 |
| dense_dialogue_impact_contrast_10 | 490.53 | 48/48 | 13.02 | 0.319 |
| dense_dialogue | 501.47 | 48/48 | 8.92 | 0.330 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| wide_breaths_air_plus_5 | 778.18 | 48/48 | 5.41 | 0.814 |
| wide_breaths | 774.37 | 48/48 | 5.30 | 0.791 |
| offgrid_conversation | 763.44 | 48/48 | 4.81 | 0.658 |
| offgrid_conversation_answer_early_25ms | 761.26 | 48/48 | 5.43 | 0.654 |
| countercurrent | 717.52 | 48/48 | 4.11 | 0.586 |
| countercurrent_impact_contrast_12 | 702.95 | 48/48 | 4.46 | 0.565 |
| high_air_drive_air_minus_5 | 694.68 | 48/48 | 5.88 | 0.573 |
| high_air_drive | 677.28 | 48/48 | 6.64 | 0.570 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery | 359.74 | 60.35 | 379.69–425.91 |
| regression_transition_mosaic | 626.25 | 18.96 | 599.35–654.09 |
| split_signal_impact_relief_12 | 569.37 | 17.21 | 547.33–581.91 |
| frontier_dense_recovery_240ms_figures | 404.28 | 16.12 | 381.87–427.80 |
| regression_transition_mosaic_tempo_fast_5 | 604.70 | 14.97 | 579.99–630.21 |
| sparse_lowline_air_minus_4 | 605.51 | 13.20 | 579.98–620.88 |
| dense_dialogue_impact_contrast_10 | 490.53 | 13.02 | 462.93–504.78 |
| split_signal | 562.54 | 11.50 | 542.13–575.73 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 2111 | 0.788 | 0.742 | 0.059 |
| amplitude | 576 | 0.413 | 0.425 | 0.221 |
| impact | 2111 | 0.485 | 0.488 | 0.181 |
| speed | 2111 | 0.800 | 0.782 | 0.056 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 2111 | 0.898 | 0.838 |
| headline score ↔ impact RMS error | 2111 | -0.903 | -0.838 |
| headline score ↔ air quality | 2111 | 0.625 | 0.658 |
| headline score ↔ speed quality | 2111 | 0.695 | 0.685 |
| headline score ↔ amplitude quality | 576 | 0.435 | 0.200 |
| headline score ↔ authored contacts | 2112 | -0.458 | -0.385 |
| impact quality ↔ air quality | 2111 | 0.396 | 0.409 |
| impact quality ↔ speed quality | 2111 | 0.506 | 0.429 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 194,633 authored gap observations, target–achieved Pearson correlation is 0.818 (Spearman 0.798). Median absolute error is 0.1453; RMS error is 0.2072.

Mean achieved impulse is 0.385 against a mean target of 0.542. 92.6% of observations are below target; 36.1% land within ±0.10. The descriptive linear fit is achieved ≈ -0.059 + 0.819 × target (R² 0.669).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 3744 | 0.136 | 0.134 | -0.002 | 0.030 | 0.046 |
| [0.2,0.4) | 68757 | 0.304 | 0.169 | -0.135 | 0.140 | 0.160 |
| [0.4,0.6) | 33022 | 0.512 | 0.383 | -0.129 | 0.133 | 0.170 |
| [0.6,0.8) | 59216 | 0.697 | 0.540 | -0.157 | 0.160 | 0.213 |
| [0.8,1.0] | 29894 | 0.868 | 0.607 | -0.262 | 0.266 | 0.315 |

## Seed stability and the invalid row

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 45 / 645 | 572.61 | 43/44 | +1.3344 |
| 22 / 622 | 599.86 | 44/44 | -0.1329 |
| 30 / 630 | 597.87 | 44/44 | -0.0903 |
| 4 / 20 | 597.50 | 44/44 | -0.0823 |
| 29 / 629 | 597.10 | 44/44 | -0.0740 |
| 0 / 16 | 596.88 | 44/44 | -0.0694 |
| 47 / 647 | 596.73 | 44/44 | -0.0675 |
| 34 / 634 | 596.25 | 44/44 | -0.0574 |

The sole invalid row is `frontier_dense_recovery`, seed 645: terminus:rideStalled, reported_contacts:88/123, missing:55, missing_measurement:air:55[68..122], missing_measurement:impact:55[68..122], missing_measurement:speed:55[68..122]. Its official hard zero is retained.

A diagnostic-only replacement with that case's valid-run median would move the headline by +1.2980 to 594.8011. This is an influence estimate, not an alternate baseline.

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| sparse_lowline → sparse_lowline_air_minus_4 | -27.79 | -32.66–-22.92 | -27.8625 |
| river_reentry → river_reentry_tempo_fast_5 | -24.73 | -26.49–-22.96 | -24.7297 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -21.65 | -28.65–-14.65 | -21.5482 |
| rising_switch → rising_switch_tempo_fast_5 | -20.00 | -22.20–-17.80 | -19.9979 |
| countercurrent → countercurrent_impact_contrast_12 | -14.57 | -16.10–-13.03 | -14.5676 |
| open_hook → open_hook_amplitude_plus_8 | -13.73 | -15.75–-11.70 | -13.7262 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| believer_56_6s → believer_56_6s_impact_relief | 26.31 | 23.42–29.19 | +26.3184 |
| high_air_drive → high_air_drive_air_minus_5 | 17.40 | 14.78–20.01 | +17.4040 |
| split_signal → split_signal_impact_relief_12 | 6.99 | 0.95–13.04 | +6.8364 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 5.66 | 2.75–8.57 | +5.6942 |
| frontier_dense_recovery → frontier_dense_recovery_240ms_figures | 5.00 | -13.41–23.41 | +44.5376 |
| wide_breaths → wide_breaths_air_plus_5 | 3.81 | 1.50–6.12 | +3.8101 |

## Practical interpretation

- Numeric continuity across the scorer boundary would not establish unchanged quality: this baseline lives in a new score coordinate system and deliberately contains no cross-ruler comparison.
- The compiler is not blind to the promoted ruler. Current-gap candidate cost consumes the shared current impact measurement, while impact target plumbing, geometry steering, and readiness remain active. The strong target–achieved rank association is consistent with partial alignment, not proof that those mechanisms are optimal.
- Capability is the dominant weighted bottleneck. Dense recovery and rapid pickup alone account for nearly half of the gap to 650; development music is low but has only 5% campaign weight.
- The clearest impact-specific defect is systematic under-delivery, especially for 0.8–1.0 asks. That is a better optimization target than the raw scorer-boundary headline resemblance.
- The case ranking and component correlations identify where this compiler struggles under the new ruler; they do not show whether the ruler change improved or worsened the compiler.
- Impact target-band residuals show whether errors grow systematically with authored impulse demand. Those bands are a more useful optimization diagnostic than comparing this headline to the old-ruler headline.
- Future candidates should be compared only against this exact active archive on the literal N=48 seed schedule.
