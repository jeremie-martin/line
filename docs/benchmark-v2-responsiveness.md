# Benchmark V2 Responsiveness Calibration

All runs use the same catalog, budgets, seed blocks, scoring, engine, and semantic execution protocol. Only the declared compiler environment changes.
The row named `baseline` is the retained calibration reference, not an approved promotion baseline.

| Case | Environment | Headline | Delta | Valid |
|---|---|---:|---:|---:|
| baseline | {} | 462.73 | 0.00 | 243/264 |
| impact_blindness | {"LR_IMPACT_OFF":"1"} | 0.00 | -462.73 | 0/264 |
| candidate_breadth_1 | {"LR_QUALITY_NCAND":"1"} | 310.87 | -151.86 | 232/264 |

`LR_QUALITY_NCAND=1` is the graded calibration: it lowers every stratum and the probe decision returns `stop` with a 151.86-point headline loss. `LR_IMPACT_OFF=1` is the contract calibration: authored impact measurements disappear, so every run is invalid rather than silently ignoring the axis.
