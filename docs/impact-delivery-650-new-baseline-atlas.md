# Impact Delivery 650 Baseline Loss Atlas

Baseline: `value-ranked-startup-expiration`. Archive: `benchmark/v2/runs/value-ranked-startup-expiration-development-750k-N32.json.gz`.

The exact 750k/N=32 replay is **607.2582** across 1,408/1,408 valid runs and 129,792 impact observations. Reducing every retained impact residual to 75% replays to **660.61** (+53.35). These values are nonlinear counterfactual ceilings, not additive forecasts.

The accepted archive retains targets, delivered axes, feasibility, timing, and next-gap score price. Exact incoming tangent/normal state, contacted-frame duration, collision ownership, release state, and continuation outcome require the frozen fresh trace; the atlas names that absence rather than inferring it.

## Authored impact target

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| [0.73,1) | 32,448 | 50.6% | 0.826 | 0.595 | +21.70 | +55.76 |
| [0.55,0.73) | 37,792 | 22.2% | 0.639 | 0.513 | +10.53 | +25.23 |
| [0.28,0.4) | 33,728 | 15.9% | 0.324 | 0.193 | +8.67 | +20.66 |
| [0.4,0.55) | 11,200 | 7.7% | 0.458 | 0.303 | +5.82 | +14.15 |
| [0.2,0.28) | 12,128 | 3.5% | 0.249 | 0.151 | +1.70 | +3.94 |
| [0.12,0.2) | 1,696 | 0.1% | 0.157 | 0.145 | +0.04 | +0.09 |
| [0,0.12) | 800 | 0.0% | 0.092 | 0.106 | +0.01 | +0.02 |

## Feasibility

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| beyond_bound | 63,968 | 74.2% | 0.711 | 0.516 | +34.42 | +95.83 |
| within_bound | 65,824 | 25.8% | 0.379 | 0.270 | +15.95 | +39.43 |

## Delivery ratio

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| [0,0.5) | 33,358 | 58.4% | 0.429 | 0.159 | +24.00 | +62.16 |
| [0.5,0.65) | 17,520 | 21.4% | 0.547 | 0.316 | +11.05 | +26.55 |
| [0.65,0.8) | 24,118 | 14.7% | 0.623 | 0.456 | +9.84 | +23.67 |
| [0.8,0.95) | 34,436 | 4.9% | 0.624 | 0.547 | +3.51 | +8.18 |
| [1.05,1.25) | 3,205 | 0.2% | 0.417 | 0.463 | +0.12 | +0.28 |
| [1.25,∞) | 791 | 0.2% | 0.205 | 0.298 | +0.10 | +0.23 |
| [0.95,1.05) | 16,364 | 0.1% | 0.518 | 0.511 | +0.05 | +0.12 |

## Gap duration

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| [17,25) | 68,832 | 64.5% | 0.549 | 0.369 | +32.07 | +94.38 |
| [25,41) | 39,712 | 11.5% | 0.530 | 0.449 | +9.01 | +22.99 |
| [11,17) | 14,080 | 19.1% | 0.509 | 0.280 | +7.81 | +19.88 |
| [0,11) | 1,312 | 3.2% | 0.708 | 0.383 | +1.04 | +2.44 |
| [41,∞) | 5,856 | 1.7% | 0.584 | 0.527 | +0.79 | +1.83 |

## Mean gap speed quartile

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| Q4 >11.1474 | 32,448 | 34.6% | 0.625 | 0.440 | +13.45 | +33.02 |
| Q3 ≤11.1474 | 32,448 | 26.8% | 0.549 | 0.388 | +13.28 | +32.20 |
| Q2 ≤10.6081 | 32,448 | 21.3% | 0.525 | 0.384 | +11.41 | +27.47 |
| Q1 ≤9.9633 | 32,448 | 17.4% | 0.470 | 0.352 | +9.95 | +24.04 |

## Next-gap axis-price quartile

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| Q4 >0.0741 | 32,096 | 49.5% | 0.598 | 0.370 | +17.69 | +46.10 |
| Q3 ≤0.0741 | 32,096 | 24.4% | 0.586 | 0.425 | +13.19 | +32.02 |
| Q2 ≤0.0318 | 32,096 | 16.7% | 0.531 | 0.398 | +10.89 | +26.28 |
| Q1 ≤0.0111 | 32,096 | 9.4% | 0.467 | 0.377 | +6.77 | +16.16 |
| terminal | 1,408 | 0.0% | 0.254 | 0.250 | +0.01 | +0.03 |

## Cohort

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| representative_candidate | 83,200 | 52.9% | 0.534 | 0.394 | +39.29 | +127.43 |
| capability_candidate | 26,432 | 24.5% | 0.507 | 0.328 | +6.88 | +19.11 |
| regression_candidate | 11,648 | 5.2% | 0.517 | 0.404 | +3.89 | +11.32 |
| development_music_candidate | 8,512 | 17.4% | 0.767 | 0.536 | +3.28 | +11.32 |

## Largest source ceilings

| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |
|---|---:|---:|---:|---:|---:|---:|
| dense_dialogue_impact_contrast_10 | 4,160 | 5.9% | 0.534 | 0.301 | +2.71 | +8.94 |
| dense_dialogue | 4,160 | 5.7% | 0.531 | 0.299 | +2.64 | +8.62 |
| river_reentry_tempo_fast_5 | 2,816 | 2.2% | 0.544 | 0.371 | +2.63 | +8.58 |
| river_reentry | 2,816 | 1.8% | 0.544 | 0.388 | +2.39 | +7.69 |
| loose_pocket | 3,328 | 2.3% | 0.551 | 0.384 | +1.91 | +6.18 |
| loose_pocket_drag_later_20ms | 3,328 | 2.2% | 0.551 | 0.386 | +1.90 | +6.11 |
| countercurrent_impact_contrast_12 | 2,528 | 0.8% | 0.519 | 0.415 | +1.65 | +5.03 |
| frontier_pickup_progression_shifted | 3,520 | 4.8% | 0.546 | 0.320 | +1.64 | +4.52 |
| frontier_pickup_progression | 3,520 | 4.5% | 0.546 | 0.325 | +1.59 | +4.35 |
| regression_transition_mosaic_tempo_fast_5 | 2,912 | 1.9% | 0.520 | 0.381 | +1.58 | +4.62 |
| rising_switch_tempo_fast_5 | 2,816 | 2.6% | 0.561 | 0.392 | +1.55 | +5.04 |
| countercurrent | 2,528 | 0.7% | 0.517 | 0.419 | +1.52 | +4.54 |
| believer_56_6s | 2,688 | 9.0% | 0.830 | 0.461 | +1.43 | +4.73 |
| regression_transition_mosaic | 2,912 | 1.6% | 0.520 | 0.395 | +1.42 | +4.12 |
| rising_switch | 2,816 | 2.2% | 0.561 | 0.409 | +1.42 | +4.60 |
| meter_exchange | 3,072 | 2.3% | 0.550 | 0.405 | +1.40 | +4.54 |

## Historical first-tranche cohorts

These are the original campaign's cohorts, not fresh reservations for a later campaign. First-tranche discovery 700–707; held-out validation 708–715; scale/source-spread 716–731; final confirmation 732–779. Return-cell discovery 780–787; validation 788–795; scale 796–811; final confirmation 812–859. Production 14003–14005.
