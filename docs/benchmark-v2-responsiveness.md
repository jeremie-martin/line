# Benchmark V2 Responsiveness Calibration

All runs use the same catalog, budgets, seed blocks, scoring, engine, and semantic execution protocol. Only the declared compiler environment changes.

| Case | Environment | Headline | Delta | Valid |
|---|---|---:|---:|---:|
| baseline | {} | 443.00 | 0.00 | 220/252 |
| impact_blindness | {"LR_IMPACT_OFF":"1"} | 0.00 | -443.00 | 0/252 |
| candidate_breadth_1 | {"LR_QUALITY_NCAND":"1"} | 301.82 | -141.18 | 210/252 |

`LR_QUALITY_NCAND=1` is the graded calibration: it lowers every stratum and the probe decision returns `stop` with a 141.18-point headline loss. `LR_IMPACT_OFF=1` is the contract calibration: authored impact measurements disappear, so every run is invalid rather than silently ignoring the axis.
