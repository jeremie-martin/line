# Benchmark V2 Current Baseline Analysis

Baseline: `compiler-integrity`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **777.8193**; target exceeded by **127.8193**.
- Validity: **352/352** (100.00%).
- Run-score median 780.23, IQR 724.70–838.94, 5th–95th percentile 634.32–878.97.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [550,600) | 8 | 2.3% |
| [600,650) | 24 | 6.8% |
| [650,700) | 16 | 4.5% |
| [700,750) | 104 | 29.5% |
| [750,800) | 64 | 18.2% |
| [800,850) | 72 | 20.4% |
| [850,900) | 64 | 18.2% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 811.70 | 131.81 |
| capability | 15% | 638.67 | 54.20 |
| legacy_regression | 10% | 759.26 | 24.07 |
| development_music | 5% | 758.05 | 12.10 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| subdivision_pickup | representative | 10.5% | 767.55 | 24.41 |
| rapid_pickup_frontier | capability | 6.0% | 634.60 | 21.92 |
| dense_recovery_frontier | capability | 5.3% | 590.94 | 21.48 |
| spacious_amplitude | representative | 9.1% | 766.63 | 21.24 |
| regular_exceptions | representative | 14.0% | 869.59 | 18.26 |
| dense_musical | representative | 7.0% | 748.58 | 17.60 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 658.71 | 15.36 |
| irregular_microtimed | representative | 10.5% | 869.78 | 13.67 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 573.49 | 8/8 | 0.00 | 0.690 |
| frontier_dense_recovery | 608.91 | 8/8 | 0.00 | 0.744 |
| frontier_pickup_progression_shifted | 634.32 | 8/8 | 0.00 | 0.740 |
| frontier_pickup_progression | 634.88 | 8/8 | 0.00 | 0.754 |
| regression_amplitude_mosaic_contrast_10 | 658.52 | 8/8 | 0.00 | 0.801 |
| regression_amplitude_mosaic | 658.90 | 8/8 | 0.00 | 0.749 |
| frontier_low_air_endurance | 708.53 | 8/8 | 0.00 | 0.722 |
| frontier_low_air_endurance_4s | 709.54 | 8/8 | 0.00 | 0.735 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| countercurrent | 896.66 | 8/8 | 0.00 | 0.899 |
| offgrid_conversation_answer_early_25ms | 879.66 | 8/8 | 0.00 | 0.878 |
| loose_pocket_drag_later_20ms | 878.97 | 8/8 | 0.00 | 0.879 |
| river_reentry | 876.05 | 8/8 | 0.00 | 0.877 |
| offgrid_conversation | 873.96 | 8/8 | 0.00 | 0.882 |
| rising_switch | 872.07 | 8/8 | 0.00 | 0.870 |
| countercurrent_impact_contrast_12 | 869.50 | 8/8 | 0.00 | 0.869 |
| regression_transition_mosaic | 851.65 | 8/8 | 0.00 | 0.842 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 573.49 | 0.00 | 573.49–573.49 |
| frontier_dense_recovery | 608.91 | 0.00 | 608.91–608.91 |
| frontier_pickup_progression_shifted | 634.32 | 0.00 | 634.32–634.32 |
| frontier_pickup_progression | 634.88 | 0.00 | 634.88–634.88 |
| regression_amplitude_mosaic_contrast_10 | 658.52 | 0.00 | 658.52–658.52 |
| regression_amplitude_mosaic | 658.90 | 0.00 | 658.90–658.90 |
| frontier_low_air_endurance | 708.53 | 0.00 | 708.53–708.53 |
| frontier_low_air_endurance_4s | 709.54 | 0.00 | 709.54–709.54 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.829 | 0.784 | 0.047 |
| amplitude | 96 | 0.457 | 0.474 | 0.196 |
| impact | 352 | 0.800 | 0.799 | 0.056 |
| speed | 352 | 0.833 | 0.823 | 0.046 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.770 | 0.808 |
| headline score ↔ impact RMS error | 352 | -0.765 | -0.807 |
| headline score ↔ air quality | 352 | 0.770 | 0.774 |
| headline score ↔ speed quality | 352 | 0.700 | 0.673 |
| headline score ↔ amplitude quality | 96 | 0.979 | 0.909 |
| headline score ↔ authored contacts | 352 | -0.293 | -0.281 |
| impact quality ↔ air quality | 352 | 0.593 | 0.675 |
| impact quality ↔ speed quality | 352 | 0.736 | 0.728 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.966 (Spearman 0.963). Median absolute error is 0.0141; RMS error is 0.0607.

Mean achieved impulse is 0.524 against a mean target of 0.542. 63.7% of observations are below target; 92.8% land within ±0.10. The descriptive linear fit is achieved ≈ 0.022 + 0.925 × target (R² 0.933).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.136 | -0.000 | 0.009 | 0.017 |
| [0.2,0.4) | 11464 | 0.304 | 0.304 | -0.000 | 0.019 | 0.032 |
| [0.4,0.6) | 5504 | 0.512 | 0.497 | -0.015 | 0.025 | 0.049 |
| [0.6,0.8) | 9872 | 0.697 | 0.665 | -0.031 | 0.040 | 0.074 |
| [0.8,1.0] | 4984 | 0.868 | 0.826 | -0.043 | 0.057 | 0.090 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 777.82 | 44/44 | +0.0000 |
| 1 / 17 | 777.82 | 44/44 | +0.0000 |
| 2 / 18 | 777.82 | 44/44 | +0.0000 |
| 3 / 19 | 777.82 | 44/44 | +0.0000 |
| 4 / 20 | 777.82 | 44/44 | +0.0000 |
| 5 / 21 | 777.82 | 44/44 | +0.0000 |
| 6 / 22 | 777.82 | 44/44 | +0.0000 |
| 7 / 23 | 777.82 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| open_hook → open_hook_amplitude_plus_8 | -64.83 | -64.83–-64.83 | -64.8303 |
| river_reentry → river_reentry_tempo_fast_5 | -38.85 | -38.85–-38.85 | -38.8534 |
| frontier_dense_recovery → frontier_dense_recovery_240ms_figures | -35.41 | -35.41–-35.41 | -35.4143 |
| countercurrent → countercurrent_impact_contrast_12 | -27.15 | -27.15–-27.15 | -27.1537 |
| rising_switch → rising_switch_tempo_fast_5 | -26.64 | -26.64–-26.64 | -26.6426 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -20.11 | -20.11–-20.11 | -20.1100 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| high_air_drive → high_air_drive_air_minus_5 | 51.62 | 51.62–51.62 | +51.6194 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 38.64 | 38.64–38.64 | +38.6409 |
| loose_pocket → loose_pocket_drag_later_20ms | 32.02 | 32.02–32.02 | +32.0231 |
| believer_impact_56s → believer_impact_56s_amplitude_plus_5 | 22.31 | 22.31–22.31 | +22.3133 |
| dense_dialogue → dense_dialogue_impact_contrast_10 | 15.44 | 15.44–15.44 | +15.4374 |
| meter_exchange → meter_exchange_speed_plus_4 | 10.22 | 10.22–10.22 | +10.2167 |

## Practical interpretation

- The active 650-point goal is achieved. Remaining-loss tables use the existing 1000-point score ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
