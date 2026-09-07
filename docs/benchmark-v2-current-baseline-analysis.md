# Benchmark V2 Current Baseline Analysis

Baseline: `value-ranked-startup-expiration`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=32 headline: **607.2582**; target gap: **42.7418**.
- Validity: **1408/1408** (100.00%).
- Run-score median 617.80, IQR 572.28–657.49, 5th–95th percentile 402.68–776.30.
- Seed-block headline SD: 1.95; case identity explains 99.1% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [300,350) | 3 | 0.2% |
| [350,400) | 60 | 4.3% |
| [400,450) | 68 | 4.8% |
| [450,500) | 67 | 4.8% |
| [500,550) | 103 | 7.3% |
| [550,600) | 203 | 14.4% |
| [600,650) | 494 | 35.1% |
| [650,700) | 187 | 13.3% |
| [700,750) | 96 | 6.8% |
| [750,800) | 127 | 9.0% |

## Suite hierarchy

| Stratum | Weight | Score | Contribution to 42.74-point target gap |
|---|---:|---:|---:|
| representative | 70% | 641.09 | 6.24 (14.6%) |
| capability | 15% | 485.76 | 24.64 (57.6%) |
| legacy_regression | 10% | 607.57 | 4.24 (9.9%) |
| development_music | 5% | 497.51 | 7.62 (17.8%) |

| Largest weighted group gaps | Stratum | Campaign weight | Score | Target-gap contribution |
|---|---|---:|---:|---:|
| dense_recovery_frontier | capability | 5.3% | 420.90 | 12.03 |
| rapid_pickup_frontier | capability | 6.0% | 464.41 | 11.14 |
| dense_musical | representative | 7.0% | 516.75 | 9.33 |
| believer_56s | development_music | 5.0% | 497.51 | 7.62 |
| subdivision_pickup | representative | 10.5% | 592.62 | 6.02 |
| cadence_transition | representative | 8.4% | 613.08 | 3.10 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 586.74 | 2.85 |
| low_air_frontier | capability | 3.8% | 610.72 | 1.47 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| believer_56_6s | 363.63 | 32/32 | 12.06 | 0.190 |
| believer_56_6s_impact_relief | 393.44 | 32/32 | 6.15 | 0.215 |
| frontier_dense_recovery_240ms_figures | 420.81 | 32/32 | 14.89 | 0.360 |
| frontier_dense_recovery | 421.00 | 32/32 | 11.48 | 0.363 |
| frontier_pickup_progression_shifted | 460.80 | 32/32 | 9.29 | 0.346 |
| frontier_pickup_progression | 468.04 | 32/32 | 4.92 | 0.356 |
| dense_dialogue_impact_contrast_10 | 514.58 | 32/32 | 11.00 | 0.339 |
| dense_dialogue | 518.93 | 32/32 | 11.82 | 0.345 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| wide_breaths_air_plus_5 | 783.69 | 32/32 | 9.49 | 0.833 |
| wide_breaths | 781.56 | 32/32 | 4.73 | 0.807 |
| offgrid_conversation_answer_early_25ms | 773.81 | 32/32 | 4.78 | 0.670 |
| offgrid_conversation | 773.79 | 32/32 | 4.25 | 0.670 |
| countercurrent | 735.01 | 32/32 | 5.15 | 0.612 |
| countercurrent_impact_contrast_12 | 721.61 | 32/32 | 4.10 | 0.591 |
| high_air_drive_air_minus_5 | 706.63 | 32/32 | 4.62 | 0.583 |
| high_air_drive | 690.73 | 32/32 | 5.11 | 0.583 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_low_air_endurance_7s | 600.25 | 25.43 | 577.91–620.72 |
| regression_transition_mosaic_tempo_fast_5 | 612.41 | 23.95 | 578.82–645.32 |
| regression_transition_mosaic | 637.07 | 19.20 | 609.66–667.12 |
| frontier_dense_recovery_240ms_figures | 420.81 | 14.89 | 393.28–444.95 |
| believer_56_6s | 363.63 | 12.06 | 341.19–375.76 |
| dense_dialogue | 518.93 | 11.82 | 497.55–531.36 |
| frontier_dense_recovery | 421.00 | 11.48 | 402.15–436.27 |
| split_signal | 566.56 | 11.29 | 543.57–580.97 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 1408 | 0.793 | 0.752 | 0.058 |
| amplitude | 384 | 0.418 | 0.429 | 0.218 |
| impact | 1408 | 0.503 | 0.503 | 0.172 |
| speed | 1408 | 0.802 | 0.787 | 0.055 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 1408 | 0.893 | 0.850 |
| headline score ↔ impact RMS error | 1408 | -0.902 | -0.850 |
| headline score ↔ air quality | 1408 | 0.612 | 0.622 |
| headline score ↔ speed quality | 1408 | 0.679 | 0.686 |
| headline score ↔ amplitude quality | 384 | 0.438 | 0.175 |
| headline score ↔ authored contacts | 1408 | -0.441 | -0.394 |
| impact quality ↔ air quality | 1408 | 0.384 | 0.386 |
| impact quality ↔ speed quality | 1408 | 0.484 | 0.418 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 129,792 authored gap observations, target–achieved Pearson correlation is 0.824 (Spearman 0.808). Median absolute error is 0.1367; RMS error is 0.1998.

Mean achieved impulse is 0.391 against a mean target of 0.542. 92.9% of observations are below target; 38.0% land within ±0.10. The descriptive linear fit is achieved ≈ -0.044 + 0.802 × target (R² 0.679).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 2496 | 0.136 | 0.133 | -0.003 | 0.028 | 0.044 |
| [0.2,0.4) | 45856 | 0.304 | 0.182 | -0.123 | 0.127 | 0.148 |
| [0.4,0.6) | 22016 | 0.512 | 0.388 | -0.124 | 0.127 | 0.163 |
| [0.6,0.8) | 39488 | 0.697 | 0.540 | -0.157 | 0.160 | 0.209 |
| [0.8,1.0] | 19936 | 0.868 | 0.613 | -0.255 | 0.260 | 0.306 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 4 / 20 | 602.97 | 44/44 | +0.1401 |
| 2 / 18 | 603.51 | 44/44 | +0.1231 |
| 27 / 627 | 604.04 | 44/44 | +0.1055 |
| 14 / 614 | 604.58 | 44/44 | +0.0881 |
| 26 / 626 | 609.94 | 44/44 | -0.0856 |
| 0 / 16 | 609.95 | 44/44 | -0.0853 |
| 10 / 610 | 604.90 | 44/44 | +0.0800 |
| 15 / 615 | 609.62 | 44/44 | -0.0745 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| river_reentry → river_reentry_tempo_fast_5 | -28.38 | -31.96–-24.79 | -28.4408 |
| sparse_lowline → sparse_lowline_air_minus_4 | -28.32 | -32.37–-24.26 | -28.3392 |
| rising_switch → rising_switch_tempo_fast_5 | -26.03 | -29.30–-22.75 | -26.0097 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -24.48 | -34.31–-14.64 | -24.6594 |
| open_hook → open_hook_amplitude_plus_8 | -15.41 | -17.95–-12.87 | -15.4044 |
| frontier_low_air_endurance → frontier_low_air_endurance_7s | -14.24 | -23.56–-4.91 | -14.7835 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| believer_56_6s → believer_56_6s_impact_relief | 29.65 | 24.85–34.46 | +29.8101 |
| high_air_drive → high_air_drive_air_minus_5 | 15.89 | 13.85–17.93 | +15.8965 |
| split_signal → split_signal_impact_relief_12 | 11.26 | 6.75–15.77 | +11.3499 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 3.96 | 0.17–7.76 | +3.9550 |
| loose_pocket → loose_pocket_drag_later_20ms | 2.36 | 0.00–4.71 | +2.3604 |
| wide_breaths → wide_breaths_air_plus_5 | 2.17 | -1.35–5.69 | +2.1310 |

## Practical interpretation

- The active target remains 42.7418 points away. The hierarchy shows how each group contributes under the fixed weights.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=32.
