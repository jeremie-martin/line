# Impact Delivery 650 Baseline Loss Atlas

Baseline: `redraw-dose-law-750k`. Archive: `benchmark/v2/runs/redraw-dose-law-750k-development-750k-N48.json.gz`.

The exact 750k/N=48 replay is **596.9655** across 2,112/2,112 valid runs and 194,688 impact observations. Reducing every retained impact residual to 75% replays to **651.51** (+54.54). These values are nonlinear counterfactual ceilings, not additive forecasts.

The accepted archive retains targets, delivered axes, feasibility, timing, and next-gap score price. Exact incoming tangent/normal state, contacted-frame duration, collision ownership, release state, and continuation outcome require the frozen fresh trace; the atlas names that absence rather than inferring it.

## Authored impact target

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| [0.73,1) | 48,672 | 50.0% | 0.826 | 0.587 | +21.94 | +56.30 |
| [0.55,0.73) | 56,688 | 22.3% | 0.639 | 0.508 | +10.48 | +25.09 |
| [0.28,0.4) | 50,592 | 16.2% | 0.324 | 0.185 | +9.13 | +21.81 |
| [0.4,0.55) | 16,800 | 7.9% | 0.458 | 0.293 | +6.19 | +15.11 |
| [0.2,0.28) | 18,192 | 3.5% | 0.249 | 0.146 | +1.70 | +3.94 |
| [0.12,0.2) | 2,544 | 0.1% | 0.157 | 0.146 | +0.04 | +0.09 |
| [0,0.12) | 1,200 | 0.0% | 0.092 | 0.106 | +0.01 | +0.02 |

## Feasibility

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| beyond_bound | 95,952 | 73.4% | 0.711 | 0.510 | +34.44 | +95.51 |
| within_bound | 98,736 | 26.6% | 0.379 | 0.263 | +16.97 | +42.22 |

## Delivery ratio

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| [0,0.5) | 53,774 | 60.0% | 0.431 | 0.158 | +25.95 | +67.59 |
| [0.5,0.65) | 26,786 | 21.1% | 0.556 | 0.321 | +11.04 | +26.46 |
| [0.65,0.8) | 36,810 | 14.1% | 0.624 | 0.457 | +9.42 | +22.56 |
| [0.8,0.95) | 47,770 | 4.4% | 0.624 | 0.546 | +3.12 | +7.26 |
| [1.05,1.25) | 4,847 | 0.2% | 0.414 | 0.461 | +0.12 | +0.28 |
| [1.25,∞) | 1,189 | 0.2% | 0.215 | 0.311 | +0.11 | +0.24 |
| [0.95,1.05) | 23,512 | 0.1% | 0.530 | 0.523 | +0.05 | +0.12 |

## Gap duration

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| [17,25) | 103,248 | 64.5% | 0.549 | 0.362 | +32.59 | +96.06 |
| [25,41) | 59,568 | 11.9% | 0.530 | 0.443 | +9.54 | +24.42 |
| [11,17) | 21,120 | 18.6% | 0.509 | 0.275 | +7.73 | +19.60 |
| [0,11) | 1,968 | 3.2% | 0.708 | 0.371 | +1.07 | +2.49 |
| [41,∞) | 8,784 | 1.8% | 0.584 | 0.521 | +0.88 | +2.03 |

## Incoming speed quartile

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| Q3 ≤11.1032 | 48,672 | 27.6% | 0.551 | 0.381 | +13.65 | +33.17 |
| Q4 >11.1032 | 48,672 | 32.7% | 0.620 | 0.432 | +13.38 | +32.68 |
| Q2 ≤10.5639 | 48,672 | 22.1% | 0.527 | 0.377 | +11.76 | +28.34 |
| Q1 ≤9.9193 | 48,672 | 17.6% | 0.471 | 0.347 | +10.29 | +24.87 |

## Next-gap axis-price quartile

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| Q4 >0.0797 | 48,144 | 48.9% | 0.597 | 0.361 | +17.82 | +46.32 |
| Q3 ≤0.0797 | 48,143 | 24.4% | 0.589 | 0.421 | +13.30 | +32.29 |
| Q2 ≤0.0347 | 48,145 | 17.0% | 0.535 | 0.396 | +11.13 | +26.86 |
| Q1 ≤0.0123 | 48,144 | 9.7% | 0.461 | 0.366 | +7.27 | +17.40 |
| terminal | 2,112 | 0.0% | 0.254 | 0.248 | +0.02 | +0.04 |

## Cohort

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| representative_candidate | 124,800 | 53.3% | 0.534 | 0.389 | +40.29 | +131.13 |
| capability_candidate | 39,648 | 24.7% | 0.507 | 0.319 | +6.91 | +19.22 |
| regression_candidate | 17,472 | 5.4% | 0.517 | 0.396 | +4.08 | +11.91 |
| development_music_candidate | 12,768 | 16.7% | 0.767 | 0.532 | +3.26 | +11.03 |

## Largest source ceilings

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| river_reentry_tempo_fast_5 | 4,224 | 2.2% | 0.544 | 0.364 | +2.73 | +9.01 |
| dense_dialogue_impact_contrast_10 | 6,240 | 5.9% | 0.534 | 0.292 | +2.71 | +8.82 |
| dense_dialogue | 6,240 | 5.6% | 0.531 | 0.291 | +2.65 | +8.68 |
| river_reentry | 4,224 | 1.8% | 0.544 | 0.383 | +2.45 | +7.96 |
| loose_pocket | 4,992 | 2.3% | 0.551 | 0.380 | +1.96 | +6.36 |
| loose_pocket_drag_later_20ms | 4,992 | 2.3% | 0.551 | 0.381 | +1.94 | +6.27 |
| countercurrent_impact_contrast_12 | 3,792 | 0.9% | 0.519 | 0.410 | +1.72 | +5.28 |
| regression_transition_mosaic_tempo_fast_5 | 4,368 | 1.9% | 0.520 | 0.377 | +1.62 | +4.77 |
| frontier_pickup_progression | 5,280 | 4.6% | 0.546 | 0.313 | +1.61 | +4.44 |
| frontier_pickup_progression_shifted | 5,280 | 4.7% | 0.546 | 0.310 | +1.61 | +4.42 |
| countercurrent | 3,792 | 0.8% | 0.517 | 0.413 | +1.60 | +4.85 |
| rising_switch_tempo_fast_5 | 4,224 | 2.5% | 0.561 | 0.387 | +1.53 | +4.93 |
| regression_transition_mosaic | 4,368 | 1.6% | 0.520 | 0.391 | +1.45 | +4.22 |
| rising_switch | 4,224 | 2.2% | 0.561 | 0.403 | +1.44 | +4.66 |
| believer_56_6s | 4,032 | 8.5% | 0.830 | 0.456 | +1.42 | +4.63 |
| meter_exchange_speed_plus_4 | 4,608 | 2.3% | 0.550 | 0.400 | +1.42 | +4.58 |

## Frozen follow-up cohorts

First-tranche discovery 700–707; held-out validation 708–715; scale/source-spread 716–731; final confirmation 732–779. Return-cell discovery 780–787; validation 788–795; scale 796–811; final confirmation 812–859. Production 14003–14005.
