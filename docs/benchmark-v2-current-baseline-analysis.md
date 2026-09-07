# Benchmark V2 Current Baseline Analysis

Baseline: `normal-motion-feedback`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **662.5889**; target exceeded by **12.5889**.
- Validity: **352/352** (100.00%).
- Run-score median 673.44, IQR 644.43–692.20, 5th–95th percentile 579.24–722.62.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [450,500) | 16 | 4.5% |
| [550,600) | 32 | 9.1% |
| [600,650) | 48 | 13.6% |
| [650,700) | 192 | 54.5% |
| [700,750) | 64 | 18.2% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 681.46 | 222.98 |
| capability | 15% | 630.95 | 55.36 |
| legacy_regression | 10% | 629.25 | 37.08 |
| development_music | 5% | 560.04 | 22.00 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| regular_exceptions | representative | 14.0% | 674.97 | 45.50 |
| subdivision_pickup | representative | 10.5% | 645.55 | 37.22 |
| irregular_microtimed | representative | 10.5% | 692.95 | 32.24 |
| spacious_amplitude | representative | 9.1% | 692.73 | 27.96 |
| cadence_transition | representative | 8.4% | 679.52 | 26.92 |
| rapid_pickup_frontier | capability | 6.0% | 632.15 | 22.07 |
| believer_56s | development_music | 5.0% | 560.04 | 22.00 |
| dense_recovery_frontier | capability | 5.3% | 590.19 | 21.51 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| believer_impact_56s | 468.14 | 8/8 | 0.00 | 0.605 |
| believer_impact_56s_amplitude_plus_5 | 491.86 | 8/8 | 0.00 | 0.621 |
| regression_amplitude_mosaic | 579.24 | 8/8 | 0.00 | 0.724 |
| regression_amplitude_mosaic_contrast_10 | 582.05 | 8/8 | 0.00 | 0.672 |
| frontier_dense_recovery | 587.37 | 8/8 | 0.00 | 0.677 |
| frontier_dense_recovery_240ms_figures | 593.03 | 8/8 | 0.00 | 0.699 |
| pickup_lattice | 626.86 | 8/8 | 0.00 | 0.664 |
| frontier_pickup_progression | 631.11 | 8/8 | 0.00 | 0.673 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| sparse_lowline | 729.84 | 8/8 | 0.00 | 0.728 |
| dense_dialogue_impact_contrast_10 | 723.35 | 8/8 | 0.00 | 0.654 |
| open_hook_amplitude_plus_8 | 722.62 | 8/8 | 0.00 | 0.700 |
| open_hook | 714.63 | 8/8 | 0.00 | 0.688 |
| dense_dialogue | 713.43 | 8/8 | 0.00 | 0.649 |
| sparse_lowline_air_minus_4 | 711.40 | 8/8 | 0.00 | 0.694 |
| wide_breaths_air_plus_5 | 704.98 | 8/8 | 0.00 | 0.678 |
| frontier_low_air_endurance_7s | 701.23 | 8/8 | 0.00 | 0.715 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| believer_impact_56s | 468.14 | 0.00 | 468.14–468.14 |
| believer_impact_56s_amplitude_plus_5 | 491.86 | 0.00 | 491.86–491.86 |
| regression_amplitude_mosaic | 579.24 | 0.00 | 579.24–579.24 |
| regression_amplitude_mosaic_contrast_10 | 582.05 | 0.00 | 582.05–582.05 |
| frontier_dense_recovery | 587.37 | 0.00 | 587.37–587.37 |
| frontier_dense_recovery_240ms_figures | 593.03 | 0.00 | 593.03–593.03 |
| pickup_lattice | 626.86 | 0.00 | 626.86–626.86 |
| frontier_pickup_progression | 631.11 | 0.00 | 631.11–631.11 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.946 | 0.882 | 0.014 |
| amplitude | 96 | 0.489 | 0.497 | 0.179 |
| impact | 352 | 0.664 | 0.666 | 0.102 |
| speed | 352 | 0.615 | 0.603 | 0.122 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.282 | 0.199 |
| headline score ↔ impact RMS error | 352 | -0.290 | -0.198 |
| headline score ↔ air quality | 352 | 0.143 | -0.047 |
| headline score ↔ speed quality | 352 | 0.780 | 0.597 |
| headline score ↔ amplitude quality | 96 | 0.574 | 0.692 |
| headline score ↔ authored contacts | 352 | 0.299 | -0.205 |
| impact quality ↔ air quality | 352 | -0.388 | -0.544 |
| impact quality ↔ speed quality | 352 | 0.455 | 0.427 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.971 (Spearman 0.966). Median absolute error is 0.0623; RMS error is 0.1019.

Mean achieved impulse is 0.602 against a mean target of 0.542. 25.9% of observations are below target; 66.1% land within ±0.10. The descriptive linear fit is achieved ≈ -0.059 + 1.219 × target (R² 0.943).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.126 | -0.010 | 0.027 | 0.034 |
| [0.2,0.4) | 11464 | 0.304 | 0.301 | -0.003 | 0.032 | 0.043 |
| [0.4,0.6) | 5504 | 0.512 | 0.570 | 0.058 | 0.073 | 0.091 |
| [0.6,0.8) | 9872 | 0.697 | 0.815 | 0.118 | 0.126 | 0.141 |
| [0.8,1.0] | 4984 | 0.868 | 0.968 | 0.100 | 0.111 | 0.121 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 662.59 | 44/44 | +0.0000 |
| 1 / 17 | 662.59 | 44/44 | +0.0000 |
| 2 / 18 | 662.59 | 44/44 | +0.0000 |
| 3 / 19 | 662.59 | 44/44 | +0.0000 |
| 4 / 20 | 662.59 | 44/44 | +0.0000 |
| 5 / 21 | 662.59 | 44/44 | +0.0000 |
| 6 / 22 | 662.59 | 44/44 | +0.0000 |
| 7 / 23 | 662.59 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| split_signal → split_signal_impact_relief_12 | -33.69 | -33.69–-33.69 | -33.6944 |
| meter_exchange → meter_exchange_speed_plus_4 | -32.57 | -32.57–-32.57 | -32.5746 |
| sparse_lowline → sparse_lowline_air_minus_4 | -18.45 | -18.45–-18.45 | -18.4452 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -10.94 | -10.94–-10.94 | -10.9383 |
| rising_switch → rising_switch_tempo_fast_5 | -5.28 | -5.28–-5.28 | -5.2761 |
| loose_pocket → loose_pocket_drag_later_20ms | -1.75 | -1.75–-1.75 | -1.7518 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| frontier_low_air_endurance → frontier_low_air_endurance_7s | 26.31 | 26.31–26.31 | +26.3051 |
| believer_impact_56s → believer_impact_56s_amplitude_plus_5 | 23.72 | 23.72–23.72 | +23.7201 |
| high_air_drive → high_air_drive_air_minus_5 | 19.82 | 19.82–19.82 | +19.8227 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 19.73 | 19.73–19.73 | +19.7328 |
| frontier_low_air_endurance → frontier_low_air_endurance_4s | 13.91 | 13.91–13.91 | +13.9150 |
| dense_dialogue → dense_dialogue_impact_contrast_10 | 9.92 | 9.92–9.92 | +9.9151 |

## Practical interpretation

- The active 650-point goal is achieved. Remaining-loss tables use the existing 1000-point score ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
