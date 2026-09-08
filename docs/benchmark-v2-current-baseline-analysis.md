# Benchmark V2 Current Baseline Analysis

Baseline: `arc-continuation-boundary`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **771.3015**; target exceeded by **121.3015**.
- Validity: **352/352** (100.00%).
- Run-score median 766.73, IQR 715.50–838.39, 5th–95th percentile 631.33–889.28.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [550,600) | 16 | 4.5% |
| [600,650) | 24 | 6.8% |
| [650,700) | 16 | 4.5% |
| [700,750) | 112 | 31.8% |
| [750,800) | 72 | 20.4% |
| [800,850) | 48 | 13.6% |
| [850,900) | 64 | 18.2% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 806.51 | 135.44 |
| capability | 15% | 637.40 | 54.39 |
| legacy_regression | 10% | 746.07 | 25.39 |
| development_music | 5% | 730.54 | 13.47 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| subdivision_pickup | representative | 10.5% | 757.78 | 25.43 |
| spacious_amplitude | representative | 9.1% | 756.38 | 22.17 |
| rapid_pickup_frontier | capability | 6.0% | 631.70 | 22.10 |
| dense_recovery_frontier | capability | 5.3% | 593.43 | 21.34 |
| dense_musical | representative | 7.0% | 737.53 | 18.37 |
| regular_exceptions | representative | 14.0% | 872.46 | 17.86 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 648.52 | 15.82 |
| cadence_transition | representative | 8.4% | 831.07 | 14.19 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 591.26 | 8/8 | 0.00 | 0.702 |
| frontier_dense_recovery | 595.61 | 8/8 | 0.00 | 0.694 |
| frontier_pickup_progression_shifted | 631.33 | 8/8 | 0.00 | 0.746 |
| frontier_pickup_progression | 632.08 | 8/8 | 0.00 | 0.709 |
| regression_amplitude_mosaic | 644.72 | 8/8 | 0.00 | 0.739 |
| regression_amplitude_mosaic_contrast_10 | 652.34 | 8/8 | 0.00 | 0.779 |
| believer_impact_56s_amplitude_plus_5 | 676.77 | 8/8 | 0.00 | 0.615 |
| frontier_low_air_endurance | 701.54 | 8/8 | 0.00 | 0.720 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| countercurrent | 898.29 | 8/8 | 0.00 | 0.915 |
| offgrid_conversation | 889.65 | 8/8 | 0.00 | 0.903 |
| river_reentry | 889.28 | 8/8 | 0.00 | 0.898 |
| offgrid_conversation_answer_early_25ms | 881.82 | 8/8 | 0.00 | 0.904 |
| loose_pocket | 880.19 | 8/8 | 0.00 | 0.893 |
| loose_pocket_drag_later_20ms | 871.51 | 8/8 | 0.00 | 0.882 |
| rising_switch_tempo_fast_5 | 857.19 | 8/8 | 0.00 | 0.880 |
| river_reentry_tempo_fast_5 | 855.91 | 8/8 | 0.00 | 0.861 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 591.26 | 0.00 | 591.26–591.26 |
| frontier_dense_recovery | 595.61 | 0.00 | 595.61–595.61 |
| frontier_pickup_progression_shifted | 631.33 | 0.00 | 631.33–631.33 |
| frontier_pickup_progression | 632.08 | 0.00 | 632.08–632.08 |
| regression_amplitude_mosaic | 644.72 | 0.00 | 644.72–644.72 |
| regression_amplitude_mosaic_contrast_10 | 652.34 | 0.00 | 652.34–652.34 |
| believer_impact_56s_amplitude_plus_5 | 676.77 | 0.00 | 676.77–676.77 |
| frontier_low_air_endurance | 701.54 | 0.00 | 701.54–701.54 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.830 | 0.780 | 0.047 |
| amplitude | 96 | 0.449 | 0.463 | 0.200 |
| impact | 352 | 0.782 | 0.783 | 0.061 |
| speed | 352 | 0.824 | 0.819 | 0.048 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.803 | 0.817 |
| headline score ↔ impact RMS error | 352 | -0.791 | -0.816 |
| headline score ↔ air quality | 352 | 0.730 | 0.752 |
| headline score ↔ speed quality | 352 | 0.694 | 0.680 |
| headline score ↔ amplitude quality | 96 | 0.958 | 0.909 |
| headline score ↔ authored contacts | 352 | -0.237 | -0.255 |
| impact quality ↔ air quality | 352 | 0.492 | 0.644 |
| impact quality ↔ speed quality | 352 | 0.680 | 0.721 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.958 (Spearman 0.956). Median absolute error is 0.0148; RMS error is 0.0669.

Mean achieved impulse is 0.522 against a mean target of 0.542. 62.2% of observations are below target; 91.5% land within ±0.10. The descriptive linear fit is achieved ≈ 0.026 + 0.915 × target (R² 0.918).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.140 | 0.004 | 0.017 | 0.042 |
| [0.2,0.4) | 11464 | 0.304 | 0.304 | -0.000 | 0.020 | 0.034 |
| [0.4,0.6) | 5504 | 0.512 | 0.495 | -0.016 | 0.027 | 0.055 |
| [0.6,0.8) | 9872 | 0.697 | 0.665 | -0.032 | 0.043 | 0.078 |
| [0.8,1.0] | 4984 | 0.868 | 0.818 | -0.050 | 0.063 | 0.104 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 771.30 | 44/44 | +0.0000 |
| 1 / 17 | 771.30 | 44/44 | +0.0000 |
| 2 / 18 | 771.30 | 44/44 | +0.0000 |
| 3 / 19 | 771.30 | 44/44 | +0.0000 |
| 4 / 20 | 771.30 | 44/44 | +0.0000 |
| 5 / 21 | 771.30 | 44/44 | +0.0000 |
| 6 / 22 | 771.30 | 44/44 | +0.0000 |
| 7 / 23 | 771.30 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| open_hook → open_hook_amplitude_plus_8 | -60.26 | -60.26–-60.26 | -60.2565 |
| countercurrent → countercurrent_impact_contrast_12 | -50.88 | -50.88–-50.88 | -50.8794 |
| believer_impact_56s → believer_impact_56s_amplitude_plus_5 | -34.90 | -34.90–-34.90 | -34.9037 |
| river_reentry → river_reentry_tempo_fast_5 | -33.38 | -33.38–-33.38 | -33.3782 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | -29.96 | -29.96–-29.96 | -29.9599 |
| sparse_lowline → sparse_lowline_air_minus_4 | -18.41 | -18.41–-18.41 | -18.4107 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| meter_exchange → meter_exchange_speed_plus_4 | 53.83 | 53.83–53.83 | +53.8329 |
| high_air_drive → high_air_drive_air_minus_5 | 50.59 | 50.59–50.59 | +50.5918 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 45.36 | 45.36–45.36 | +45.3626 |
| frontier_low_air_endurance → frontier_low_air_endurance_6s | 15.23 | 15.23–15.23 | +15.2266 |
| rising_switch → rising_switch_tempo_fast_5 | 9.34 | 9.34–9.34 | +9.3380 |
| frontier_low_air_endurance → frontier_low_air_endurance_7s | 8.82 | 8.82–8.82 | +8.8208 |

## Practical interpretation

- The active 650-point goal is achieved. Remaining-loss tables use the existing 1000-point score ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
