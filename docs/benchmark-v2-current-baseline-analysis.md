# Benchmark V2 Current Baseline Analysis

Baseline: `connected-arc-feedback`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **687.5102**; target exceeded by **37.5102**.
- Validity: **352/352** (100.00%).
- Run-score median 693.42, IQR 597.87–738.81, 5th–95th percentile 529.47–793.89.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [500,550) | 32 | 9.1% |
| [550,600) | 64 | 18.2% |
| [600,650) | 24 | 6.8% |
| [650,700) | 80 | 22.7% |
| [700,750) | 64 | 18.2% |
| [750,800) | 72 | 20.4% |
| [800,850) | 16 | 4.5% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 725.56 | 192.11 |
| capability | 15% | 542.96 | 68.56 |
| legacy_regression | 10% | 668.05 | 33.20 |
| development_music | 5% | 627.42 | 18.63 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| subdivision_pickup | representative | 10.5% | 686.10 | 32.96 |
| regular_exceptions | representative | 14.0% | 794.09 | 28.83 |
| rapid_pickup_frontier | capability | 6.0% | 532.80 | 28.03 |
| spacious_amplitude | representative | 9.1% | 701.94 | 27.12 |
| dense_recovery_frontier | capability | 5.3% | 521.31 | 25.13 |
| irregular_microtimed | representative | 10.5% | 770.18 | 24.13 |
| dense_musical | representative | 7.0% | 673.32 | 22.87 |
| cadence_transition | representative | 8.4% | 746.31 | 21.31 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 513.29 | 8/8 | 0.00 | 0.582 |
| frontier_pickup_progression_shifted | 521.76 | 8/8 | 0.00 | 0.558 |
| frontier_dense_recovery | 529.47 | 8/8 | 0.00 | 0.588 |
| frontier_pickup_progression | 544.08 | 8/8 | 0.00 | 0.607 |
| frontier_low_air_endurance_4s | 583.72 | 8/8 | 0.00 | 0.580 |
| regression_amplitude_mosaic | 584.76 | 8/8 | 0.00 | 0.632 |
| frontier_low_air_endurance_7s | 585.12 | 8/8 | 0.00 | 0.594 |
| believer_impact_56s_amplitude_plus_5 | 587.52 | 8/8 | 0.00 | 0.519 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| river_reentry | 819.61 | 8/8 | 0.00 | 0.814 |
| rising_switch | 815.86 | 8/8 | 0.00 | 0.798 |
| countercurrent | 793.89 | 8/8 | 0.00 | 0.759 |
| river_reentry_tempo_fast_5 | 793.64 | 8/8 | 0.00 | 0.724 |
| loose_pocket_drag_later_20ms | 783.01 | 8/8 | 0.00 | 0.736 |
| offgrid_conversation | 777.27 | 8/8 | 0.00 | 0.779 |
| countercurrent_impact_contrast_12 | 770.01 | 8/8 | 0.00 | 0.705 |
| loose_pocket | 768.25 | 8/8 | 0.00 | 0.723 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 513.29 | 0.00 | 513.29–513.29 |
| frontier_pickup_progression_shifted | 521.76 | 0.00 | 521.76–521.76 |
| frontier_dense_recovery | 529.47 | 0.00 | 529.47–529.47 |
| frontier_pickup_progression | 544.08 | 0.00 | 544.08–544.08 |
| frontier_low_air_endurance_4s | 583.72 | 0.00 | 583.72–583.72 |
| regression_amplitude_mosaic | 584.76 | 0.00 | 584.76–584.76 |
| frontier_low_air_endurance_7s | 585.12 | 0.00 | 585.12–585.12 |
| believer_impact_56s_amplitude_plus_5 | 587.52 | 0.00 | 587.52–587.52 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.795 | 0.742 | 0.057 |
| amplitude | 96 | 0.429 | 0.427 | 0.211 |
| impact | 352 | 0.653 | 0.662 | 0.106 |
| speed | 352 | 0.719 | 0.710 | 0.083 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.799 | 0.838 |
| headline score ↔ impact RMS error | 352 | -0.796 | -0.838 |
| headline score ↔ air quality | 352 | 0.827 | 0.865 |
| headline score ↔ speed quality | 352 | 0.835 | 0.852 |
| headline score ↔ amplitude quality | 96 | 0.857 | 0.797 |
| headline score ↔ authored contacts | 352 | -0.170 | -0.214 |
| impact quality ↔ air quality | 352 | 0.548 | 0.733 |
| impact quality ↔ speed quality | 352 | 0.652 | 0.712 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.896 (Spearman 0.898). Median absolute error is 0.0292; RMS error is 0.1080.

Mean achieved impulse is 0.499 against a mean target of 0.542. 67.6% of observations are below target; 80.7% land within ±0.10. The descriptive linear fit is achieved ≈ 0.048 + 0.831 × target (R² 0.803).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.150 | 0.014 | 0.029 | 0.059 |
| [0.2,0.4) | 11464 | 0.304 | 0.299 | -0.005 | 0.035 | 0.055 |
| [0.4,0.6) | 5504 | 0.512 | 0.480 | -0.032 | 0.047 | 0.078 |
| [0.6,0.8) | 9872 | 0.697 | 0.632 | -0.065 | 0.077 | 0.123 |
| [0.8,1.0] | 4984 | 0.868 | 0.761 | -0.108 | 0.121 | 0.179 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 687.51 | 44/44 | +0.0000 |
| 1 / 17 | 687.51 | 44/44 | +0.0000 |
| 2 / 18 | 687.51 | 44/44 | +0.0000 |
| 3 / 19 | 687.51 | 44/44 | +0.0000 |
| 4 / 20 | 687.51 | 44/44 | +0.0000 |
| 5 / 21 | 687.51 | 44/44 | +0.0000 |
| 6 / 22 | 687.51 | 44/44 | +0.0000 |
| 7 / 23 | 687.51 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| rising_switch → rising_switch_tempo_fast_5 | -49.33 | -49.33–-49.33 | -49.3333 |
| river_reentry → river_reentry_tempo_fast_5 | -25.97 | -25.97–-25.97 | -25.9731 |
| offgrid_conversation → offgrid_conversation_answer_early_25ms | -24.72 | -24.72–-24.72 | -24.7248 |
| countercurrent → countercurrent_impact_contrast_12 | -23.89 | -23.89–-23.89 | -23.8883 |
| frontier_pickup_progression → frontier_pickup_progression_shifted | -22.31 | -22.31–-22.31 | -22.3125 |
| frontier_dense_recovery → frontier_dense_recovery_240ms_figures | -16.18 | -16.18–-16.18 | -16.1757 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| high_air_drive → high_air_drive_air_minus_5 | 69.14 | 69.14–69.14 | +69.1396 |
| believer_56_6s → believer_56_6s_impact_relief | 55.75 | 55.75–55.75 | +55.7509 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 47.99 | 47.99–47.99 | +47.9894 |
| regression_transition_mosaic → regression_transition_mosaic_tempo_fast_5 | 47.66 | 47.66–47.66 | +47.6616 |
| split_signal → split_signal_impact_relief_12 | 34.04 | 34.04–34.04 | +34.0408 |
| wide_breaths → wide_breaths_air_plus_5 | 23.28 | 23.28–23.28 | +23.2816 |

## Practical interpretation

- The active 650-point goal is achieved. Remaining-loss tables use the existing 1000-point score ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
