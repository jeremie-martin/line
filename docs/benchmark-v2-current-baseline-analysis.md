# Benchmark V2 Current Baseline Analysis

Baseline: `one-terminal-adaptive-repair-750k`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **602.1261**; target gap: **47.8739**.
- Validity: **352/352** (100.00%).
- Run-score median 613.62, IQR 569.26–651.11, 5th–95th percentile 395.63–767.86.
- Seed-block headline SD: 1.78; case identity explains 99.1% of arithmetic run-score variation, seed identity 0.0%.

The headline is a weighted hierarchical geometric aggregate. Arithmetic means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [300,350) | 1 | 0.3% |
| [350,400) | 19 | 5.4% |
| [400,450) | 13 | 3.7% |
| [450,500) | 18 | 5.1% |
| [500,550) | 26 | 7.4% |
| [550,600) | 52 | 14.8% |
| [600,650) | 131 | 37.2% |
| [650,700) | 42 | 11.9% |
| [700,750) | 18 | 5.1% |
| [750,800) | 32 | 9.1% |

## Suite hierarchy

| Stratum | Weight | Score | Contribution to 47.87-point target gap |
|---|---:|---:|---:|
| representative | 70% | 635.18 | 10.37 (21.7%) |
| capability | 15% | 481.78 | 25.23 (52.7%) |
| legacy_regression | 10% | 604.77 | 4.52 (9.4%) |
| development_music | 5% | 495.14 | 7.74 (16.2%) |

| Largest weighted group gaps | Stratum | Campaign weight | Score | Target-gap contribution |
|---|---|---:|---:|---:|
| dense_recovery_frontier | capability | 5.3% | 413.79 | 12.40 |
| rapid_pickup_frontier | capability | 6.0% | 462.03 | 11.28 |
| dense_musical | representative | 7.0% | 510.55 | 9.76 |
| believer_56s | development_music | 5.0% | 495.14 | 7.74 |
| subdivision_pickup | representative | 10.5% | 589.11 | 6.39 |
| cadence_transition | representative | 8.4% | 608.51 | 3.49 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 586.55 | 2.86 |
| legacy_transition_regression | legacy_regression | 5.5% | 619.68 | 1.67 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| believer_56_6s | 361.92 | 8/8 | 4.63 | 0.189 |
| believer_56_6s_impact_relief | 393.48 | 8/8 | 3.74 | 0.217 |
| frontier_dense_recovery | 412.30 | 8/8 | 30.82 | 0.367 |
| frontier_dense_recovery_240ms_figures | 415.29 | 8/8 | 21.09 | 0.365 |
| frontier_pickup_progression_shifted | 459.31 | 8/8 | 11.30 | 0.346 |
| frontier_pickup_progression | 464.77 | 8/8 | 3.66 | 0.353 |
| dense_dialogue_impact_contrast_10 | 506.30 | 8/8 | 6.64 | 0.333 |
| dense_dialogue | 514.84 | 8/8 | 9.66 | 0.340 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| wide_breaths_air_plus_5 | 787.17 | 8/8 | 2.26 | 0.825 |
| wide_breaths | 780.11 | 8/8 | 4.51 | 0.801 |
| offgrid_conversation | 766.90 | 8/8 | 4.86 | 0.661 |
| offgrid_conversation_answer_early_25ms | 764.03 | 8/8 | 3.57 | 0.656 |
| countercurrent | 726.85 | 8/8 | 3.87 | 0.599 |
| countercurrent_impact_contrast_12 | 715.75 | 8/8 | 5.38 | 0.582 |
| high_air_drive_air_minus_5 | 698.27 | 8/8 | 5.96 | 0.574 |
| high_air_drive | 682.05 | 8/8 | 6.89 | 0.571 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery | 412.30 | 30.82 | 362.17–439.36 |
| sparse_lowline | 633.00 | 27.04 | 589.68–658.83 |
| regression_transition_mosaic | 627.34 | 24.49 | 590.76–654.60 |
| frontier_dense_recovery_240ms_figures | 415.29 | 21.09 | 384.07–434.71 |
| regression_transition_mosaic_tempo_fast_5 | 612.12 | 19.98 | 592.01–643.12 |
| split_signal_impact_relief_12 | 565.21 | 13.29 | 545.15–577.91 |
| frontier_pickup_progression_shifted | 459.31 | 11.30 | 443.76–471.49 |
| sparse_lowline_air_minus_4 | 621.55 | 10.04 | 607.80–632.40 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.797 | 0.750 | 0.057 |
| amplitude | 96 | 0.419 | 0.428 | 0.217 |
| impact | 352 | 0.501 | 0.497 | 0.172 |
| speed | 352 | 0.804 | 0.784 | 0.055 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.892 | 0.851 |
| headline score ↔ impact RMS error | 352 | -0.899 | -0.851 |
| headline score ↔ air quality | 352 | 0.607 | 0.613 |
| headline score ↔ speed quality | 352 | 0.700 | 0.669 |
| headline score ↔ amplitude quality | 96 | 0.430 | 0.150 |
| headline score ↔ authored contacts | 352 | -0.445 | -0.387 |
| impact quality ↔ air quality | 352 | 0.364 | 0.377 |
| impact quality ↔ speed quality | 352 | 0.502 | 0.428 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.824 (Spearman 0.807). Median absolute error is 0.1408; RMS error is 0.2022.

Mean achieved impulse is 0.388 against a mean target of 0.542. 93.0% of observations are below target; 36.8% land within ±0.10. The descriptive linear fit is achieved ≈ -0.051 + 0.809 × target (R² 0.679).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.131 | -0.004 | 0.028 | 0.045 |
| [0.2,0.4) | 11464 | 0.304 | 0.177 | -0.127 | 0.132 | 0.152 |
| [0.4,0.6) | 5504 | 0.512 | 0.384 | -0.128 | 0.131 | 0.167 |
| [0.6,0.8) | 9872 | 0.697 | 0.539 | -0.157 | 0.160 | 0.210 |
| [0.8,1.0] | 4984 | 0.868 | 0.612 | -0.257 | 0.262 | 0.308 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 4 / 20 | 604.74 | 44/44 | -0.3688 |
| 2 / 18 | 604.06 | 44/44 | -0.2709 |
| 1 / 17 | 603.93 | 44/44 | -0.2504 |
| 6 / 22 | 600.55 | 44/44 | +0.2415 |
| 7 / 23 | 600.51 | 44/44 | +0.2350 |
| 0 / 16 | 600.85 | 44/44 | +0.1930 |
| 3 / 19 | 600.89 | 44/44 | +0.1899 |
| 5 / 21 | 601.89 | 44/44 | +0.0393 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| river_reentry → river_reentry_tempo_fast_5 | -24.84 | -28.84–-20.84 | -24.8318 |
| rising_switch → rising_switch_tempo_fast_5 | -24.43 | -27.87–-20.99 | -24.4233 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -15.36 | -45.36–14.64 | -15.2170 |
| open_hook → open_hook_amplitude_plus_8 | -14.49 | -19.08–-9.91 | -14.4821 |
| sparse_lowline → sparse_lowline_air_minus_4 | -11.90 | -38.76–14.95 | -11.4519 |
| countercurrent → countercurrent_impact_contrast_12 | -11.10 | -17.27–-4.92 | -11.1037 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| believer_56_6s → believer_56_6s_impact_relief | 31.55 | 26.80–36.30 | +31.5615 |
| high_air_drive → high_air_drive_air_minus_5 | 16.22 | 9.77–22.67 | +16.2242 |
| wide_breaths → wide_breaths_air_plus_5 | 7.05 | 2.44–11.66 | +7.0591 |
| meter_exchange → meter_exchange_speed_plus_4 | 5.30 | -1.99–12.59 | +5.2923 |
| amplitude_tides → amplitude_tides_restrained_10 | 4.00 | -3.31–11.32 | +4.0345 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 2.89 | -0.24–6.03 | +2.8986 |

## Practical interpretation

- Numeric continuity across the scorer boundary would not establish unchanged quality: this baseline lives in a new score coordinate system and deliberately contains no cross-ruler comparison.
- The compiler is not blind to the promoted ruler. Current-gap candidate cost consumes the shared current impact measurement, while impact target plumbing, geometry steering, and readiness remain active. The strong target–achieved rank association is consistent with partial alignment, not proof that those mechanisms are optimal.
- Capability is the dominant weighted bottleneck. Dense recovery and rapid pickup alone account for nearly half of the gap to 650; development music is low but has only 5% campaign weight.
- The clearest impact-specific defect is systematic under-delivery, especially for 0.8–1.0 asks. That is a better optimization target than the raw scorer-boundary headline resemblance.
- The case ranking and component correlations identify where this compiler struggles under the new ruler; they do not show whether the ruler change improved or worsened the compiler.
- Impact target-band residuals show whether errors grow systematically with authored impulse demand. Those bands are a more useful optimization diagnostic than comparing this headline to the old-ruler headline.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
