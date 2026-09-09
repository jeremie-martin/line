# Benchmark V2 Current Baseline Analysis

Baseline: `arc-control-memory`. Scorer: accumulated contacted-frame redirection impulse. Suite: `7bd878d8aaea08a9`.

**Boundary:** Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.

## Executive read

- Official 750k/N=8 headline: **852.1248**.
- Validity: **352/352** (100.00%).
- Run-score median 868.52, IQR 796.77–912.52, 5th–95th percentile 698.42–935.48.
- Seed-block headline SD: 0.00; case identity explains 100.0% of arithmetic run-score variation, seed identity 0.0%.

The scorer uses shifted geometric aggregation within sources, parents, and groups, then weighted arithmetic aggregation across groups and strata. Run means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.

## Run-score histogram

| Score range | Runs | Share |
|---|---:|---:|
| [600,650) | 16 | 4.5% |
| [650,700) | 8 | 2.3% |
| [700,750) | 24 | 6.8% |
| [750,800) | 48 | 13.6% |
| [800,850) | 40 | 11.4% |
| [850,900) | 104 | 29.5% |
| [900,950) | 112 | 31.8% |

## Suite hierarchy

| Stratum | Weight | Score | Weighted distance from 1000 |
|---|---:|---:|---:|
| representative | 70% | 889.33 | 77.47 |
| capability | 15% | 696.26 | 45.56 |
| legacy_regression | 10% | 820.57 | 17.94 |
| development_music | 5% | 861.90 | 6.90 |

| Largest remaining group losses | Stratum | Campaign weight | Score | Weighted distance from 1000 |
|---|---|---:|---:|---:|
| dense_recovery_frontier | capability | 5.3% | 633.01 | 19.27 |
| rapid_pickup_frontier | capability | 6.0% | 699.26 | 18.04 |
| subdivision_pickup | representative | 10.5% | 830.08 | 17.84 |
| spacious_amplitude | representative | 9.1% | 855.38 | 13.16 |
| legacy_amplitude_regression | legacy_regression | 4.5% | 710.99 | 13.01 |
| regular_exceptions | representative | 14.0% | 930.18 | 9.77 |
| dense_musical | representative | 7.0% | 874.80 | 8.76 |
| low_air_frontier | capability | 3.8% | 780.02 | 8.25 |

## Case behavior

| Lowest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 626.50 | 8/8 | 0.00 | 0.792 |
| frontier_dense_recovery | 639.59 | 8/8 | 0.00 | 0.847 |
| frontier_pickup_progression_shifted | 698.42 | 8/8 | 0.00 | 0.908 |
| frontier_pickup_progression | 700.11 | 8/8 | 0.00 | 0.875 |
| regression_amplitude_mosaic | 710.94 | 8/8 | 0.00 | 0.802 |
| regression_amplitude_mosaic_contrast_10 | 711.03 | 8/8 | 0.00 | 0.837 |
| frontier_low_air_endurance_4s | 776.98 | 8/8 | 0.00 | 0.829 |
| frontier_low_air_endurance_7s | 777.73 | 8/8 | 0.00 | 0.813 |

| Highest cases | Official score | Valid | Run SD | Impact quality |
|---|---:|---:|---:|---:|
| countercurrent | 941.34 | 8/8 | 0.00 | 0.952 |
| countercurrent_impact_contrast_12 | 937.06 | 8/8 | 0.00 | 0.959 |
| offgrid_conversation | 935.48 | 8/8 | 0.00 | 0.958 |
| offgrid_conversation_answer_early_25ms | 933.44 | 8/8 | 0.00 | 0.951 |
| river_reentry | 928.47 | 8/8 | 0.00 | 0.946 |
| rising_switch | 928.37 | 8/8 | 0.00 | 0.954 |
| loose_pocket_drag_later_20ms | 923.90 | 8/8 | 0.00 | 0.943 |
| loose_pocket | 923.45 | 8/8 | 0.00 | 0.945 |

| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |
|---|---:|---:|---:|
| frontier_dense_recovery_240ms_figures | 626.50 | 0.00 | 626.50–626.50 |
| frontier_dense_recovery | 639.59 | 0.00 | 639.59–639.59 |
| frontier_pickup_progression_shifted | 698.42 | 0.00 | 698.42–698.42 |
| frontier_pickup_progression | 700.11 | 0.00 | 700.11–700.11 |
| regression_amplitude_mosaic | 710.94 | 0.00 | 710.94–710.94 |
| regression_amplitude_mosaic_contrast_10 | 711.03 | 0.00 | 711.03–711.03 |
| frontier_low_air_endurance_4s | 776.98 | 0.00 | 776.98–776.98 |
| frontier_low_air_endurance_7s | 777.73 | 0.00 | 777.73–777.73 |

## Components and associations

| Component | Runs | Quality median | Quality mean | RMS-error median |
|---|---:|---:|---:|---:|
| air | 352 | 0.872 | 0.832 | 0.034 |
| amplitude | 96 | 0.634 | 0.612 | 0.114 |
| impact | 352 | 0.920 | 0.903 | 0.021 |
| speed | 352 | 0.894 | 0.890 | 0.028 |

| Relationship | N | Pearson r | Spearman ρ |
|---|---:|---:|---:|
| headline score ↔ impact quality | 352 | 0.813 | 0.844 |
| headline score ↔ impact RMS error | 352 | -0.812 | -0.844 |
| headline score ↔ air quality | 352 | 0.865 | 0.919 |
| headline score ↔ speed quality | 352 | 0.698 | 0.788 |
| headline score ↔ amplitude quality | 96 | 0.985 | 0.979 |
| headline score ↔ authored contacts | 352 | -0.334 | -0.318 |
| impact quality ↔ air quality | 352 | 0.665 | 0.823 |
| impact quality ↔ speed quality | 352 | 0.645 | 0.731 |

Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.

## Contacted-frame impact observations

Across 32,448 authored gap observations, target–achieved Pearson correlation is 0.991 (Spearman 0.988). Median absolute error is 0.0081; RMS error is 0.0293.

Mean achieved impulse is 0.539 against a mean target of 0.542. 56.6% of observations are below target; 98.8% land within ±0.10. The descriptive linear fit is achieved ≈ 0.009 + 0.978 × target (R² 0.983).

| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |
|---|---:|---:|---:|---:|---:|---:|
| [0.0,0.2) | 624 | 0.136 | 0.137 | 0.001 | 0.008 | 0.018 |
| [0.2,0.4) | 11464 | 0.304 | 0.306 | 0.002 | 0.012 | 0.021 |
| [0.4,0.6) | 5504 | 0.512 | 0.510 | -0.002 | 0.014 | 0.029 |
| [0.6,0.8) | 9872 | 0.697 | 0.690 | -0.007 | 0.016 | 0.031 |
| [0.8,1.0] | 4984 | 0.868 | 0.856 | -0.012 | 0.025 | 0.041 |

## Seed stability

| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |
|---|---|---:|---:|---:|
| 0 / 16 | 852.12 | 44/44 | +0.0000 |
| 1 / 17 | 852.12 | 44/44 | +0.0000 |
| 2 / 18 | 852.12 | 44/44 | +0.0000 |
| 3 / 19 | 852.12 | 44/44 | +0.0000 |
| 4 / 20 | 852.12 | 44/44 | +0.0000 |
| 5 / 21 | 852.12 | 44/44 | +0.0000 |
| 6 / 22 | 852.12 | 44/44 | +0.0000 |
| 7 / 23 | 852.12 | 44/44 | +0.0000 |

## Parent/variant diagnostics

Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.

| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| sparse_lowline → sparse_lowline_air_minus_4 | -36.32 | -36.32–-36.32 | -36.3168 |
| open_hook → open_hook_amplitude_plus_8 | -20.05 | -20.05–-20.05 | -20.0547 |
| river_reentry → river_reentry_tempo_fast_5 | -14.38 | -14.38–-14.38 | -14.3840 |
| frontier_dense_recovery → frontier_dense_recovery_240ms_figures | -13.09 | -13.09–-13.09 | -13.0935 |
| dense_dialogue → dense_dialogue_impact_contrast_10 | -10.45 | -10.45–-10.45 | -10.4501 |
| rising_switch → rising_switch_tempo_fast_5 | -5.05 | -5.05–-5.05 | -5.0532 |

| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |
|---|---|---:|---:|---:|
| high_air_drive → high_air_drive_air_minus_5 | 47.63 | 47.63–47.63 | +47.6329 |
| amplitude_tides → amplitude_tides_restrained_10 | 10.80 | 10.80–10.80 | +10.8024 |
| meter_exchange → meter_exchange_speed_plus_4 | 6.95 | 6.95–6.95 | +6.9502 |
| believer_56_6s → believer_56_6s_impact_relief | 5.30 | 5.30–5.30 | +5.3035 |
| frontier_low_air_endurance → frontier_low_air_endurance_6s | 4.20 | 4.20–4.20 | +4.1974 |
| pickup_lattice → pickup_lattice_speed_minus_4 | 3.21 | 3.21–3.21 | +3.2114 |

## Practical interpretation

- The baseline metadata retains a 650-point campaign reference; it does not identify the current user goal. Remaining-loss tables use 1000 as the numerical score maximum, not a demonstrated attainable ceiling.
- These are measurements of the exact promoted prefix. Component correlations and target-band residuals identify remaining errors, but do not establish the cause or prove a proposed optimization will work.
- The report makes no comparison across different score definitions. Candidate improvement requires the retained paired comparison on the same ruler.
- Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=8.
