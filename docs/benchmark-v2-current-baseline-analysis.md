# Benchmark V2 Current Baseline Analysis

Baseline: `native-motion-feedback`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **761.9107**; target exceeded by **111.9107**.
- Validity: **352/352** (100.00%).
- Run-score median 767.99, IQR 734.98–806.97, 5th–95th percentile 675.05–832.11.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [600,650) | 16 | 4.5% |
| [650,700) | 56 | 15.9% |
| [700,750) | 48 | 13.6% |
| [750,800) | 120 | 34.1% |
| [800,850) | 112 | 31.8% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 784.05 | 151.16 |
| capability | 15% | 682.53 | 47.62 |
| legacy_regression | 10% | 729.65 | 27.04 |
| development_music | 5% | 754.61 | 12.27 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| subdivision_pickup | representative | 10.5% | 747.02 | 26.56 |
| regular_exceptions | representative | 14.0% | 833.23 | 23.35 |
| spacious_amplitude | representative | 9.1% | 770.09 | 20.92 |
| dense_recovery_frontier | capability | 5.3% | 625.90 | 19.64 |
| irregular_microtimed | representative | 10.5% | 816.13 | 19.31 |
| rapid_pickup_frontier | capability | 6.0% | 679.53 | 19.23 |
| dense_musical | representative | 7.0% | 749.68 | 17.52 |
| cadence_transition | representative | 8.4% | 793.83 | 17.32 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| frontier_dense_recovery | 625.89 | 8/8 | 0.00 | 0.716 |
| frontier_dense_recovery_240ms_figures | 625.91 | 8/8 | 0.00 | 0.706 |
| high_air_drive | 675.05 | 8/8 | 0.00 | 0.512 |
| frontier_pickup_progression_shifted | 678.12 | 8/8 | 0.00 | 0.720 |
| regression_amplitude_mosaic | 680.05 | 8/8 | 0.00 | 0.652 |
| regression_amplitude_mosaic_contrast_10 | 680.46 | 8/8 | 0.00 | 0.664 |
| frontier_pickup_progression | 680.94 | 8/8 | 0.00 | 0.725 |
| split_signal | 686.29 | 8/8 | 0.00 | 0.583 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| countercurrent_impact_contrast_12 | 842.22 | 8/8 | 0.00 | 0.746 |
| countercurrent | 837.50 | 8/8 | 0.00 | 0.738 |
| river_reentry_tempo_fast_5 | 832.11 | 8/8 | 0.00 | 0.731 |
| offgrid_conversation_answer_early_25ms | 830.87 | 8/8 | 0.00 | 0.729 |
| sparse_lowline | 823.33 | 8/8 | 0.00 | 0.736 |
| river_reentry | 821.26 | 8/8 | 0.00 | 0.715 |
| offgrid_conversation | 817.93 | 8/8 | 0.00 | 0.709 |
| rising_switch_tempo_fast_5 | 816.53 | 8/8 | 0.00 | 0.707 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery | 625.89 | 0.00 | 625.89–625.89 |
| frontier_dense_recovery_240ms_figures | 625.91 | 0.00 | 625.91–625.91 |
| high_air_drive | 675.05 | 0.00 | 675.05–675.05 |
| frontier_pickup_progression_shifted | 678.12 | 0.00 | 678.12–678.12 |
| regression_amplitude_mosaic | 680.05 | 0.00 | 680.05–680.05 |
| regression_amplitude_mosaic_contrast_10 | 680.46 | 0.00 | 680.46–680.46 |
| frontier_pickup_progression | 680.94 | 0.00 | 680.94–680.94 |
| split_signal | 686.29 | 0.00 | 686.29–686.29 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.946 | 0.882 | 0.014 |
| amplitude | 96 | 0.573 | 0.551 | 0.139 |
| impact | 352 | 0.699 | 0.679 | 0.089 |
| speed | 352 | 0.982 | 0.968 | 0.005 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.464 | 0.577 |
| headline score ↔ impact RMS error | 352 | -0.465 | -0.576 |
| headline score ↔ air quality | 352 | 0.543 | 0.304 |
| headline score ↔ speed quality | 352 | 0.355 | 0.227 |
| headline score ↔ amplitude quality | 96 | 0.915 | 0.888 |
| headline score ↔ authored contacts | 352 | -0.371 | -0.444 |
| impact quality ↔ air quality | 352 | -0.342 | -0.203 |
| impact quality ↔ speed quality | 352 | 0.391 | 0.550 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.980 (Spearman 0.976). Median absolute error is 0.0756; RMS error is 0.1003.

Mean achieved impulse is 0.623 against a mean target of 0.542. 5.2% of observations are below target; 67.6% land within ±0.10. The descriptive linear fit is achieved ≈ 0.007 + 1.136 × target (R² 0.961).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.150 | 0.014 | 0.021 | 0.027 |
| [0.2,0.4) | 11464 | 0.304 | 0.349 | 0.045 | 0.049 | 0.058 |
| [0.4,0.6) | 5504 | 0.512 | 0.589 | 0.077 | 0.078 | 0.090 |
| [0.6,0.8) | 9872 | 0.697 | 0.811 | 0.115 | 0.116 | 0.132 |
| [0.8,1.0] | 4984 | 0.868 | 0.978 | 0.110 | 0.110 | 0.119 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 761.91 | 44/44 | +0.0000 |
| 1 / 17 | 761.91 | 44/44 | +0.0000 |
| 2 / 18 | 761.91 | 44/44 | +0.0000 |
| 3 / 19 | 761.91 | 44/44 | +0.0000 |
| 4 / 20 | 761.91 | 44/44 | +0.0000 |
| 5 / 21 | 761.91 | 44/44 | +0.0000 |
| 6 / 22 | 761.91 | 44/44 | +0.0000 |
| 7 / 23 | 761.91 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| open_hook → open_hook_amplitude_plus_8 | -50.83 | -50.83–-50.83 | -50.8323 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -42.26 | -42.26–-42.26 | -42.2551 |
| believer_impact_56s → believer_impact_56s_amplitude_plus_5 | -21.39 | -21.39–-21.39 | -21.3929 |
| sparse_lowline → sparse_lowline_air_minus_4 | -21.08 | -21.08–-21.08 | -21.0832 |
| amplitude_tides → amplitude_tides_restrained_10 | -16.66 | -16.66–-16.66 | -16.6556 |
| wide_breaths → wide_breaths_air_plus_5 | -11.30 | -11.30–-11.30 | -11.3018 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| high_air_drive → high_air_drive_air_minus_5 | 43.13 | 43.13–43.13 | +43.1336 |
| believer_56_6s → believer_56_6s_impact_relief | 23.09 | 23.09–23.09 | +23.0911 |
| rising_switch → rising_switch_tempo_fast_5 | 21.86 | 21.86–21.86 | +21.8635 |
| meter_exchange → meter_exchange_speed_plus_4 | 19.93 | 19.93–19.93 | +19.9329 |
| dense_dialogue → dense_dialogue_impact_contrast_10 | 15.39 | 15.39–15.39 | +15.3945 |
| loose_pocket → loose_pocket_drag_later_20ms | 15.13 | 15.13–15.13 | +15.1310 |

## Practical interpretation

- The active 650-point goal is achieved. Remaining-loss tables use the existing 1000-point score ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
