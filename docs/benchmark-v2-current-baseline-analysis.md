# Benchmark V2 Current Baseline Analysis

Baseline: `arc-refinement`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **767.6851**; target exceeded by **117.6851**.
- Validity: **352/352** (100.00%).
- Run-score median 752.34, IQR 719.19–827.08, 5th–95th percentile 612.16–883.28.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [550,600) | 16 | 4.5% |
| [600,650) | 16 | 4.5% |
| [650,700) | 24 | 6.8% |
| [700,750) | 120 | 34.1% |
| [750,800) | 64 | 18.2% |
| [800,850) | 56 | 15.9% |
| [850,900) | 56 | 15.9% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 802.14 | 138.50 |
| capability | 15% | 633.45 | 54.98 |
| legacy_regression | 10% | 749.75 | 25.02 |
| development_music | 5% | 723.92 | 13.80 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| subdivision_pickup | representative | 10.5% | 757.72 | 25.44 |
| rapid_pickup_frontier | capability | 6.0% | 621.23 | 22.73 |
| spacious_amplitude | representative | 9.1% | 759.08 | 21.92 |
| dense_recovery_frontier | capability | 5.3% | 592.83 | 21.38 |
| regular_exceptions | representative | 14.0% | 862.20 | 19.29 |
| dense_musical | representative | 7.0% | 742.05 | 18.06 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 653.76 | 15.58 |
| cadence_transition | representative | 8.4% | 821.80 | 14.97 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| frontier_dense_recovery | 591.54 | 8/8 | 0.00 | 0.692 |
| frontier_dense_recovery_240ms_figures | 594.11 | 8/8 | 0.00 | 0.726 |
| frontier_pickup_progression_shifted | 612.16 | 8/8 | 0.00 | 0.719 |
| frontier_pickup_progression | 630.44 | 8/8 | 0.00 | 0.688 |
| regression_amplitude_mosaic | 653.32 | 8/8 | 0.00 | 0.732 |
| regression_amplitude_mosaic_contrast_10 | 654.21 | 8/8 | 0.00 | 0.772 |
| believer_impact_56s | 670.23 | 8/8 | 0.00 | 0.693 |
| frontier_low_air_endurance | 701.28 | 8/8 | 0.00 | 0.722 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| offgrid_conversation | 890.40 | 8/8 | 0.00 | 0.895 |
| offgrid_conversation_answer_early_25ms | 888.37 | 8/8 | 0.00 | 0.894 |
| river_reentry | 883.28 | 8/8 | 0.00 | 0.892 |
| countercurrent | 881.49 | 8/8 | 0.00 | 0.875 |
| loose_pocket | 866.79 | 8/8 | 0.00 | 0.873 |
| loose_pocket_drag_later_20ms | 865.97 | 8/8 | 0.00 | 0.876 |
| countercurrent_impact_contrast_12 | 858.40 | 8/8 | 0.00 | 0.847 |
| rising_switch | 840.79 | 8/8 | 0.00 | 0.835 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery | 591.54 | 0.00 | 591.54–591.54 |
| frontier_dense_recovery_240ms_figures | 594.11 | 0.00 | 594.11–594.11 |
| frontier_pickup_progression_shifted | 612.16 | 0.00 | 612.16–612.16 |
| frontier_pickup_progression | 630.44 | 0.00 | 630.44–630.44 |
| regression_amplitude_mosaic | 653.32 | 0.00 | 653.32–653.32 |
| regression_amplitude_mosaic_contrast_10 | 654.21 | 0.00 | 654.21–654.21 |
| believer_impact_56s | 670.23 | 0.00 | 670.23–670.23 |
| frontier_low_air_endurance | 701.28 | 0.00 | 701.28–701.28 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.822 | 0.781 | 0.049 |
| amplitude | 96 | 0.433 | 0.461 | 0.209 |
| impact | 352 | 0.770 | 0.780 | 0.065 |
| speed | 352 | 0.827 | 0.813 | 0.048 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.781 | 0.763 |
| headline score ↔ impact RMS error | 352 | -0.774 | -0.763 |
| headline score ↔ air quality | 352 | 0.762 | 0.791 |
| headline score ↔ speed quality | 352 | 0.670 | 0.652 |
| headline score ↔ amplitude quality | 96 | 0.962 | 0.972 |
| headline score ↔ authored contacts | 352 | -0.244 | -0.260 |
| impact quality ↔ air quality | 352 | 0.574 | 0.735 |
| impact quality ↔ speed quality | 352 | 0.734 | 0.737 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.958 (Spearman 0.956). Median absolute error is 0.0161; RMS error is 0.0674.

Mean achieved impulse is 0.521 against a mean target of 0.542. 63.0% of observations are below target; 91.4% land within ±0.10. The descriptive linear fit is achieved ≈ 0.023 + 0.918 × target (R² 0.917).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.137 | 0.001 | 0.010 | 0.017 |
| [0.2,0.4) | 11464 | 0.304 | 0.303 | -0.001 | 0.020 | 0.033 |
| [0.4,0.6) | 5504 | 0.512 | 0.493 | -0.019 | 0.030 | 0.056 |
| [0.6,0.8) | 9872 | 0.697 | 0.664 | -0.033 | 0.046 | 0.082 |
| [0.8,1.0] | 4984 | 0.868 | 0.820 | -0.048 | 0.063 | 0.102 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 767.69 | 44/44 | +0.0000 |
| 1 / 17 | 767.69 | 44/44 | +0.0000 |
| 2 / 18 | 767.69 | 44/44 | +0.0000 |
| 3 / 19 | 767.69 | 44/44 | +0.0000 |
| 4 / 20 | 767.69 | 44/44 | +0.0000 |
| 5 / 21 | 767.69 | 44/44 | +0.0000 |
| 6 / 22 | 767.69 | 44/44 | +0.0000 |
| 7 / 23 | 767.69 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| open_hook → open_hook_amplitude_plus_8 | -74.54 | -74.54–-74.54 | -74.5406 |
| river_reentry → river_reentry_tempo_fast_5 | -56.43 | -56.43–-56.43 | -56.4274 |
| countercurrent → countercurrent_impact_contrast_12 | -23.09 | -23.09–-23.09 | -23.0869 |
| frontier_pickup_progression → frontier_pickup_progression_shifted | -18.28 | -18.28–-18.28 | -18.2785 |
| wide_breaths → wide_breaths_air_plus_5 | -15.41 | -15.41–-15.41 | -15.4145 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -13.28 | -13.28–-13.28 | -13.2770 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| believer_impact_56s → believer_impact_56s_amplitude_plus_5 | 52.31 | 52.31–52.31 | +52.3096 |
| meter_exchange → meter_exchange_speed_plus_4 | 45.92 | 45.92–45.92 | +45.9174 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 41.32 | 41.32–41.32 | +41.3192 |
| believer_56_6s → believer_56_6s_impact_relief | 36.01 | 36.01–36.01 | +36.0058 |
| high_air_drive → high_air_drive_air_minus_5 | 34.80 | 34.80–34.80 | +34.8016 |
| frontier_low_air_endurance → frontier_low_air_endurance_6s | 16.03 | 16.03–16.03 | +16.0273 |

## Practical interpretation

- The active 650-point goal is achieved. Remaining-loss tables use the existing 1000-point score ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
