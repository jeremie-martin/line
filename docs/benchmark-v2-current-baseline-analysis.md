# Benchmark V2 Current Baseline Analysis

Baseline: `readiness-contact-impulse-v3-750k`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=48 headline: **595.8997**; target gap: **54.1003**.
- Validity: **2112/2112** (100.00%).
- Run-score median 605.40, IQR 566.21–650.54, 5th–95th percentile 390.99–767.84.
- Seed-block headline SD: 1.86; case identity explains 98.7% of arithmetic run-score variation, seed identity 0.0%.

The headline is a weighted hierarchical geometric aggregate. Arithmetic means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [300,350) | 4 | 0.2% |
| [350,400) | 124 | 5.9% |
| [400,450) | 82 | 3.9% |
| [450,500) | 138 | 6.5% |
| [500,550) | 134 | 6.3% |
| [550,600) | 453 | 21.4% |
| [600,650) | 645 | 30.5% |
| [650,700) | 240 | 11.4% |
| [700,750) | 102 | 4.8% |
| [750,800) | 190 | 9.0% |

## Suite hierarchy

| Stratum | Weight | Score | Contribution to 54.10-point target gap |
|---|---:|---:|---:|
| representative | 70% | 628.97 | 14.72 (27.2%) |
| capability | 15% | 472.75 | 26.59 (49.1%) |
| legacy_regression | 10% | 601.62 | 4.84 (8.9%) |
| development_music | 5% | 490.88 | 7.96 (14.7%) |

| Largest weighted group gaps | Stratum | Campaign weight | Score | Target-gap contribution |
|---|---|---:|---:|---:|
| dense_recovery_frontier | capability | 5.3% | 406.44 | 12.79 |
| rapid_pickup_frontier | capability | 6.0% | 455.52 | 11.67 |
| dense_musical | representative | 7.0% | 496.17 | 10.77 |
| believer_56s | development_music | 5.0% | 490.88 | 7.96 |
| subdivision_pickup | representative | 10.5% | 584.04 | 6.93 |
| cadence_transition | representative | 8.4% | 600.31 | 4.17 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 576.33 | 3.31 |
| low_air_frontier | capability | 3.8% | 593.14 | 2.13 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| believer_56_6s | 360.17 | 48/48 | 4.45 | 0.187 |
| believer_56_6s_impact_relief | 383.71 | 48/48 | 11.58 | 0.211 |
| frontier_dense_recovery | 405.18 | 48/48 | 15.92 | 0.358 |
| frontier_dense_recovery_240ms_figures | 407.71 | 48/48 | 15.80 | 0.358 |
| frontier_pickup_progression_shifted | 453.50 | 48/48 | 5.57 | 0.342 |
| frontier_pickup_progression | 457.55 | 48/48 | 5.45 | 0.346 |
| dense_dialogue_impact_contrast_10 | 490.18 | 48/48 | 10.40 | 0.318 |
| dense_dialogue | 502.24 | 48/48 | 10.28 | 0.331 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| wide_breaths_air_plus_5 | 783.23 | 48/48 | 5.28 | 0.821 |
| wide_breaths | 775.09 | 48/48 | 6.84 | 0.793 |
| offgrid_conversation | 763.25 | 48/48 | 4.78 | 0.657 |
| offgrid_conversation_answer_early_25ms | 762.61 | 48/48 | 4.20 | 0.656 |
| countercurrent | 722.86 | 48/48 | 4.20 | 0.595 |
| countercurrent_impact_contrast_12 | 708.96 | 48/48 | 4.33 | 0.575 |
| high_air_drive_air_minus_5 | 693.98 | 48/48 | 4.77 | 0.569 |
| high_air_drive | 678.81 | 48/48 | 6.00 | 0.570 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| meter_exchange_speed_plus_4 | 602.40 | 34.73 | 596.05–616.83 |
| regression_amplitude_mosaic | 575.27 | 30.78 | 571.87–586.04 |
| regression_transition_mosaic | 631.69 | 24.76 | 592.95–661.34 |
| regression_transition_mosaic_tempo_fast_5 | 613.04 | 17.94 | 580.39–639.06 |
| sparse_lowline_air_minus_4 | 606.37 | 16.41 | 589.53–620.11 |
| frontier_dense_recovery | 405.18 | 15.92 | 380.97–431.21 |
| frontier_dense_recovery_240ms_figures | 407.71 | 15.80 | 382.43–426.92 |
| sparse_lowline | 631.65 | 13.71 | 612.36–647.84 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 2112 | 0.788 | 0.740 | 0.060 |
| amplitude | 576 | 0.416 | 0.426 | 0.220 |
| impact | 2112 | 0.487 | 0.489 | 0.180 |
| speed | 2112 | 0.806 | 0.784 | 0.054 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 2112 | 0.896 | 0.846 |
| headline score ↔ impact RMS error | 2112 | -0.901 | -0.846 |
| headline score ↔ air quality | 2112 | 0.620 | 0.656 |
| headline score ↔ speed quality | 2112 | 0.695 | 0.664 |
| headline score ↔ amplitude quality | 576 | 0.449 | 0.189 |
| headline score ↔ authored contacts | 2112 | -0.456 | -0.380 |
| impact quality ↔ air quality | 2112 | 0.383 | 0.405 |
| impact quality ↔ speed quality | 2112 | 0.501 | 0.427 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 194,688 authored gap observations, target–achieved Pearson correlation is 0.818 (Spearman 0.800). Median absolute error is 0.1446; RMS error is 0.2064.

Mean achieved impulse is 0.385 against a mean target of 0.542. 92.8% of observations are below target; 35.7% land within ±0.10. The descriptive linear fit is achieved ≈ -0.052 + 0.804 × target (R² 0.670).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 3744 | 0.136 | 0.134 | -0.002 | 0.031 | 0.048 |
| [0.2,0.4) | 68784 | 0.304 | 0.172 | -0.132 | 0.136 | 0.156 |
| [0.4,0.6) | 33024 | 0.512 | 0.385 | -0.127 | 0.130 | 0.167 |
| [0.6,0.8) | 59232 | 0.697 | 0.536 | -0.161 | 0.164 | 0.214 |
| [0.8,1.0] | 29904 | 0.868 | 0.603 | -0.265 | 0.270 | 0.315 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 46 / 646 | 589.82 | 44/44 | +0.1426 |
| 32 / 632 | 590.75 | 44/44 | +0.1184 |
| 3 / 19 | 592.56 | 44/44 | +0.0722 |
| 11 / 611 | 593.16 | 44/44 | +0.0601 |
| 41 / 641 | 598.61 | 44/44 | -0.0569 |
| 23 / 623 | 598.50 | 44/44 | -0.0547 |
| 25 / 625 | 598.46 | 44/44 | -0.0539 |
| 33 / 633 | 598.26 | 44/44 | -0.0492 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| sparse_lowline → sparse_lowline_air_minus_4 | -25.19 | -31.38–-19.01 | -25.2746 |
| river_reentry → river_reentry_tempo_fast_5 | -25.05 | -26.78–-23.32 | -25.0483 |
| rising_switch → rising_switch_tempo_fast_5 | -24.03 | -25.69–-22.38 | -24.0426 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -18.88 | -27.24–-10.52 | -18.6511 |
| countercurrent → countercurrent_impact_contrast_12 | -13.90 | -15.69–-12.12 | -13.9046 |
| dense_dialogue → dense_dialogue_impact_contrast_10 | -12.05 | -16.33–-7.77 | -12.0578 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| believer_56_6s → believer_56_6s_impact_relief | 23.69 | 19.91–27.46 | +23.5331 |
| high_air_drive → high_air_drive_air_minus_5 | 15.16 | 12.87–17.45 | +15.1714 |
| wide_breaths → wide_breaths_air_plus_5 | 8.12 | 5.61–10.63 | +8.1339 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 4.72 | 1.98–7.47 | +4.7025 |
| split_signal → split_signal_impact_relief_12 | 4.66 | 2.00–7.32 | +4.6426 |
| frontier_dense_recovery → frontier_dense_recovery_240ms_figures | 2.55 | -4.17–9.26 | +2.5387 |

## Practical interpretation

- Numeric continuity across the scorer boundary would not establish unchanged quality: this baseline lives in a new score coordinate system and deliberately contains no cross-ruler comparison.
- The compiler is not blind to the promoted ruler. Current-gap candidate cost consumes the shared current impact measurement, while impact target plumbing, geometry steering, and readiness remain active. The strong target–achieved rank association is consistent with partial alignment, not proof that those mechanisms are optimal.
- Capability is the dominant weighted bottleneck. Dense recovery and rapid pickup alone account for nearly half of the gap to 650; development music is low but has only 5% campaign weight.
- The clearest impact-specific defect is systematic under-delivery, especially for 0.8–1.0 asks. That is a better optimization target than the raw scorer-boundary headline resemblance.
- The case ranking and component correlations identify where this compiler struggles under the new ruler; they do not show whether the ruler change improved or worsened the compiler.
- Impact target-band residuals show whether errors grow systematically with authored impulse demand. Those bands are a more useful optimization diagnostic than comparing this headline to the old-ruler headline.
- Future candidates should be compared only against this exact active archive on the literal N=48 seed schedule.
