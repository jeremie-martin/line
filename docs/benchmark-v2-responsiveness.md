# Benchmark V2 Responsiveness Calibration

All runs use the same catalog, budgets, disjoint seeds, scoring, engine, and harness. Only the declared compiler environment changes.

| Case | Environment | Headline | Delta | Valid |
|---|---|---:|---:|---:|
| baseline | {} | 441.61 | 0.00 | 221/252 |
| impact_blindness | {"LR_IMPACT_OFF":"1"} | 0.00 | -441.61 | 0/252 |
| candidate_breadth_1 | {"LR_QUALITY_NCAND":"1"} | 281.98 | -159.63 | 208/252 |

`LR_QUALITY_NCAND=1` is the graded calibration: it lowers every stratum and the paired decision rejects it with a 159.63-point headline loss. `LR_IMPACT_OFF=1` is the contract calibration: authored impact measurements disappear, so every run is invalid rather than silently ignoring the axis.
