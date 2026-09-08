# Benchmark V2 Current Baseline Analysis

Baseline: `arc-guidance-planning`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **744.5000**; target exceeded by **94.5000**.
- Validity: **352/352** (100.00%).
- Run-score median 732.84, IQR 690.20–809.94, 5th–95th percentile 592.43–844.83.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [550,600) | 32 | 9.1% |
| [600,650) | 24 | 6.8% |
| [650,700) | 56 | 15.9% |
| [700,750) | 88 | 25.0% |
| [750,800) | 56 | 15.9% |
| [800,850) | 88 | 25.0% |
| [850,900) | 8 | 2.3% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 780.42 | 153.71 |
| capability | 15% | 613.99 | 57.90 |
| legacy_regression | 10% | 724.12 | 27.59 |
| development_music | 5% | 673.91 | 16.30 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| subdivision_pickup | representative | 10.5% | 749.10 | 26.34 |
| spacious_amplitude | representative | 9.1% | 722.48 | 25.25 |
| rapid_pickup_frontier | capability | 6.0% | 599.85 | 24.01 |
| regular_exceptions | representative | 14.0% | 834.82 | 23.12 |
| dense_recovery_frontier | capability | 5.3% | 569.28 | 22.61 |
| dense_musical | representative | 7.0% | 739.38 | 18.24 |
| irregular_microtimed | representative | 10.5% | 837.06 | 17.11 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 622.45 | 16.99 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 565.33 | 8/8 | 0.00 | 0.687 |
| frontier_dense_recovery | 573.27 | 8/8 | 0.00 | 0.663 |
| believer_impact_56s | 592.43 | 8/8 | 0.00 | 0.503 |
| frontier_pickup_progression | 596.13 | 8/8 | 0.00 | 0.680 |
| frontier_pickup_progression_shifted | 603.59 | 8/8 | 0.00 | 0.684 |
| regression_amplitude_mosaic_contrast_10 | 617.17 | 8/8 | 0.00 | 0.700 |
| regression_amplitude_mosaic | 627.77 | 8/8 | 0.00 | 0.752 |
| believer_impact_56s_amplitude_plus_5 | 671.16 | 8/8 | 0.00 | 0.647 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| countercurrent | 859.14 | 8/8 | 0.00 | 0.863 |
| offgrid_conversation_answer_early_25ms | 845.65 | 8/8 | 0.00 | 0.825 |
| river_reentry_tempo_fast_5 | 844.83 | 8/8 | 0.00 | 0.810 |
| loose_pocket_drag_later_20ms | 842.84 | 8/8 | 0.00 | 0.821 |
| rising_switch | 841.57 | 8/8 | 0.00 | 0.792 |
| rising_switch_tempo_fast_5 | 839.55 | 8/8 | 0.00 | 0.806 |
| loose_pocket | 836.99 | 8/8 | 0.00 | 0.830 |
| regression_transition_mosaic | 833.47 | 8/8 | 0.00 | 0.824 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 565.33 | 0.00 | 565.33–565.33 |
| frontier_dense_recovery | 573.27 | 0.00 | 573.27–573.27 |
| believer_impact_56s | 592.43 | 0.00 | 592.43–592.43 |
| frontier_pickup_progression | 596.13 | 0.00 | 596.13–596.13 |
| frontier_pickup_progression_shifted | 603.59 | 0.00 | 603.59–603.59 |
| regression_amplitude_mosaic_contrast_10 | 617.17 | 0.00 | 617.17–617.17 |
| regression_amplitude_mosaic | 627.77 | 0.00 | 627.77–627.77 |
| believer_impact_56s_amplitude_plus_5 | 671.16 | 0.00 | 671.16–671.16 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.823 | 0.773 | 0.049 |
| amplitude | 96 | 0.429 | 0.428 | 0.211 |
| impact | 352 | 0.736 | 0.737 | 0.077 |
| speed | 352 | 0.802 | 0.795 | 0.055 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.752 | 0.808 |
| headline score ↔ impact RMS error | 352 | -0.732 | -0.808 |
| headline score ↔ air quality | 352 | 0.711 | 0.736 |
| headline score ↔ speed quality | 352 | 0.673 | 0.661 |
| headline score ↔ amplitude quality | 96 | 0.848 | 0.930 |
| headline score ↔ authored contacts | 352 | -0.138 | -0.195 |
| impact quality ↔ air quality | 352 | 0.371 | 0.539 |
| impact quality ↔ speed quality | 352 | 0.532 | 0.560 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.940 (Spearman 0.939). Median absolute error is 0.0185; RMS error is 0.0804.

Mean achieved impulse is 0.516 against a mean target of 0.542. 63.5% of observations are below target; 87.6% land within ±0.10. The descriptive linear fit is achieved ≈ 0.037 + 0.882 × target (R² 0.884).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.152 | 0.016 | 0.034 | 0.071 |
| [0.2,0.4) | 11464 | 0.304 | 0.305 | 0.001 | 0.023 | 0.038 |
| [0.4,0.6) | 5504 | 0.512 | 0.490 | -0.022 | 0.032 | 0.056 |
| [0.6,0.8) | 9872 | 0.697 | 0.656 | -0.040 | 0.053 | 0.087 |
| [0.8,1.0] | 4984 | 0.868 | 0.796 | -0.072 | 0.089 | 0.140 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 744.50 | 44/44 | +0.0000 |
| 1 / 17 | 744.50 | 44/44 | +0.0000 |
| 2 / 18 | 744.50 | 44/44 | +0.0000 |
| 3 / 19 | 744.50 | 44/44 | +0.0000 |
| 4 / 20 | 744.50 | 44/44 | +0.0000 |
| 5 / 21 | 744.50 | 44/44 | +0.0000 |
| 6 / 22 | 744.50 | 44/44 | +0.0000 |
| 7 / 23 | 744.50 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| sparse_lowline → sparse_lowline_air_minus_4 | -57.33 | -57.33–-57.33 | -57.3278 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -51.52 | -51.52–-51.52 | -51.5159 |
| countercurrent → countercurrent_impact_contrast_12 | -50.67 | -50.67–-50.67 | -50.6748 |
| amplitude_tides → amplitude_tides_restrained_10 | -32.16 | -32.16–-32.16 | -32.1588 |
| open_hook → open_hook_amplitude_plus_8 | -14.64 | -14.64–-14.64 | -14.6397 |
| regression_amplitude_mosaic → regression_amplitude_mosaic_contrast_10 | -10.60 | -10.60–-10.60 | -10.6015 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| believer_56_6s → believer_56_6s_impact_relief | 85.05 | 85.05–85.05 | +85.0486 |
| believer_impact_56s → believer_impact_56s_amplitude_plus_5 | 78.73 | 78.73–78.73 | +78.7280 |
| meter_exchange → meter_exchange_speed_plus_4 | 55.76 | 55.76–55.76 | +55.7564 |
| high_air_drive → high_air_drive_air_minus_5 | 53.50 | 53.50–53.50 | +53.5022 |
| wide_breaths → wide_breaths_air_plus_5 | 36.01 | 36.01–36.01 | +36.0065 |
| split_signal → split_signal_impact_relief_12 | 27.94 | 27.94–27.94 | +27.9406 |

## Practical interpretation

- The active 650-point goal is achieved. Remaining-loss tables use the existing 1000-point score ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
