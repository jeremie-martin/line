# Benchmark V2 Current Baseline Analysis

Baseline: `independent-repair-depth-six`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=32 headline: **602.9306**; target gap: **47.0694**.
- Validity: **1408/1408** (100.00%).
- Run-score median 613.51, IQR 570.31–652.78, 5th–95th percentile 396.79–772.64.
- Seed-block headline SD: 1.67; case identity explains 99.2% of arithmetic run-score variation, seed identity 0.0%.

The headline is a weighted hierarchical geometric aggregate. Arithmetic means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [300,350) | 1 | 0.1% |
| [350,400) | 74 | 5.3% |
| [400,450) | 55 | 3.9% |
| [450,500) | 78 | 5.5% |
| [500,550) | 99 | 7.0% |
| [550,600) | 217 | 15.4% |
| [600,650) | 513 | 36.4% |
| [650,700) | 160 | 11.4% |
| [700,750) | 83 | 5.9% |
| [750,800) | 128 | 9.1% |

## Suite hierarchy

| Stratum | Weight | Score | Contribution to 47.07-point target gap |
|---|---:|---:|---:|
| representative | 70% | 635.73 | 9.99 (21.2%) |
| capability | 15% | 481.46 | 25.28 (53.7%) |
| legacy_regression | 10% | 609.71 | 4.03 (8.6%) |
| development_music | 5% | 494.67 | 7.77 (16.5%) |

| Largest weighted group gaps | Stratum | Campaign weight | Score | Target-gap contribution |
|---|---|---:|---:|---:|
| dense_recovery_frontier | capability | 5.3% | 413.97 | 12.39 |
| rapid_pickup_frontier | capability | 6.0% | 462.75 | 11.24 |
| dense_musical | representative | 7.0% | 511.03 | 9.73 |
| believer_56s | development_music | 5.0% | 494.67 | 7.77 |
| subdivision_pickup | representative | 10.5% | 589.35 | 6.37 |
| cadence_transition | representative | 8.4% | 608.30 | 3.50 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 586.21 | 2.87 |
| low_air_frontier | capability | 3.8% | 605.87 | 1.65 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| believer_56_6s | 362.71 | 32/32 | 4.39 | 0.190 |
| believer_56_6s_impact_relief | 390.35 | 32/32 | 6.31 | 0.214 |
| frontier_dense_recovery | 412.36 | 32/32 | 18.75 | 0.360 |
| frontier_dense_recovery_240ms_figures | 415.59 | 32/32 | 17.40 | 0.364 |
| frontier_pickup_progression_shifted | 461.41 | 32/32 | 8.10 | 0.347 |
| frontier_pickup_progression | 464.09 | 32/32 | 6.66 | 0.351 |
| dense_dialogue_impact_contrast_10 | 505.65 | 32/32 | 9.69 | 0.332 |
| dense_dialogue | 516.47 | 32/32 | 10.32 | 0.342 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| wide_breaths_air_plus_5 | 786.90 | 32/32 | 4.01 | 0.826 |
| wide_breaths | 779.09 | 32/32 | 3.88 | 0.798 |
| offgrid_conversation | 767.20 | 32/32 | 4.81 | 0.660 |
| offgrid_conversation_answer_early_25ms | 766.61 | 32/32 | 4.03 | 0.661 |
| countercurrent | 724.36 | 32/32 | 4.53 | 0.596 |
| countercurrent_impact_contrast_12 | 712.64 | 32/32 | 3.83 | 0.578 |
| high_air_drive_air_minus_5 | 701.27 | 32/32 | 4.53 | 0.578 |
| high_air_drive | 682.04 | 32/32 | 6.48 | 0.575 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| regression_transition_mosaic_tempo_fast_5 | 619.84 | 24.65 | 588.34–646.40 |
| frontier_dense_recovery | 412.36 | 18.75 | 386.15–438.24 |
| regression_transition_mosaic | 638.14 | 17.46 | 602.98–662.32 |
| frontier_dense_recovery_240ms_figures | 415.59 | 17.40 | 384.36–436.37 |
| sparse_lowline | 643.32 | 13.32 | 625.34–655.73 |
| frontier_low_air_endurance_7s | 601.76 | 12.99 | 582.34–619.46 |
| frontier_low_air_endurance_6s | 604.32 | 11.72 | 581.07–620.94 |
| dense_dialogue | 516.47 | 10.32 | 499.03–529.07 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 1408 | 0.795 | 0.750 | 0.057 |
| amplitude | 384 | 0.418 | 0.428 | 0.218 |
| impact | 1408 | 0.499 | 0.497 | 0.174 |
| speed | 1408 | 0.805 | 0.787 | 0.054 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 1408 | 0.893 | 0.847 |
| headline score ↔ impact RMS error | 1408 | -0.901 | -0.847 |
| headline score ↔ air quality | 1408 | 0.613 | 0.627 |
| headline score ↔ speed quality | 1408 | 0.707 | 0.665 |
| headline score ↔ amplitude quality | 384 | 0.432 | 0.155 |
| headline score ↔ authored contacts | 1408 | -0.445 | -0.391 |
| impact quality ↔ air quality | 1408 | 0.375 | 0.386 |
| impact quality ↔ speed quality | 1408 | 0.505 | 0.409 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 129,792 authored gap observations, target–achieved Pearson correlation is 0.824 (Spearman 0.806). Median absolute error is 0.1404; RMS error is 0.2024.

Mean achieved impulse is 0.388 against a mean target of 0.542. 92.9% of observations are below target; 36.9% land within ±0.10. The descriptive linear fit is achieved ≈ -0.050 + 0.808 × target (R² 0.678).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 2496 | 0.136 | 0.133 | -0.003 | 0.028 | 0.045 |
| [0.2,0.4) | 45856 | 0.304 | 0.177 | -0.128 | 0.132 | 0.152 |
| [0.4,0.6) | 22016 | 0.512 | 0.385 | -0.127 | 0.130 | 0.166 |
| [0.6,0.8) | 39488 | 0.697 | 0.539 | -0.157 | 0.161 | 0.211 |
| [0.8,1.0] | 19936 | 0.868 | 0.611 | -0.258 | 0.262 | 0.308 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 29 / 629 | 599.94 | 44/44 | +0.1004 |
| 13 / 613 | 599.99 | 44/44 | +0.0962 |
| 6 / 22 | 600.22 | 44/44 | +0.0911 |
| 30 / 630 | 605.75 | 44/44 | -0.0898 |
| 26 / 626 | 605.69 | 44/44 | -0.0883 |
| 21 / 621 | 605.49 | 44/44 | -0.0816 |
| 17 / 617 | 600.61 | 44/44 | +0.0760 |
| 23 / 623 | 605.23 | 44/44 | -0.0731 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| river_reentry → river_reentry_tempo_fast_5 | -24.59 | -26.44–-22.74 | -24.5860 |
| sparse_lowline → sparse_lowline_air_minus_4 | -21.93 | -27.52–-16.35 | -21.8557 |
| rising_switch → rising_switch_tempo_fast_5 | -21.86 | -25.04–-18.69 | -21.8429 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -18.03 | -29.27–-6.80 | -18.3027 |
| open_hook → open_hook_amplitude_plus_8 | -12.32 | -14.88–-9.77 | -12.3313 |
| countercurrent → countercurrent_impact_contrast_12 | -11.72 | -13.67–-9.77 | -11.7183 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| believer_56_6s → believer_56_6s_impact_relief | 27.67 | 25.22–30.11 | +27.6414 |
| high_air_drive → high_air_drive_air_minus_5 | 19.21 | 16.37–22.06 | +19.2300 |
| wide_breaths → wide_breaths_air_plus_5 | 7.81 | 5.60–10.03 | +7.8122 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 3.43 | 0.77–6.09 | +3.4363 |
| frontier_dense_recovery → frontier_dense_recovery_240ms_figures | 3.16 | -3.85–10.18 | +3.2287 |
| amplitude_tides → amplitude_tides_restrained_10 | 2.21 | -1.16–5.58 | +2.2619 |

## Practical interpretation

- Numeric continuity across the scorer boundary would not establish unchanged quality: this baseline lives in a new score coordinate system and deliberately contains no cross-ruler comparison.
- The compiler is not blind to the promoted ruler. Current-gap candidate cost consumes the shared current impact measurement, while impact target plumbing, geometry steering, and readiness remain active. The strong target–achieved rank association is consistent with partial alignment, not proof that those mechanisms are optimal.
- Capability is the dominant weighted bottleneck. Dense recovery and rapid pickup alone account for nearly half of the gap to 650; development music is low but has only 5% campaign weight.
- The clearest impact-specific defect is systematic under-delivery, especially for 0.8–1.0 asks. That is a better optimization target than the raw scorer-boundary headline resemblance.
- The case ranking and component correlations identify where this compiler struggles under the new ruler; they do not show whether the ruler change improved or worsened the compiler.
- Impact target-band residuals show whether errors grow systematically with authored impulse demand. Those bands are a more useful optimization diagnostic than comparing this headline to the old-ruler headline.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=32.
