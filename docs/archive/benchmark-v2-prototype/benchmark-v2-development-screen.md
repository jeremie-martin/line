# Benchmark V2 Development Screen

Historical diagnostic: this report predates the selected V2 suite and uses a stale
characterization fingerprint. It is not current benchmark evidence.

Status: diagnostic-not-suite-result. This is not a Benchmark V2 score.

Characterization: `baece09228ab77b4`. Harness: `f65d5726ce25`.

Git HEAD: `a0b7aa221d1d`. Compiler diff: `16bccdba1b19`. Whole tracked diff: `3f2700c997d2`.

Engine: wasm. Production jolt parameter: -15ms (effective contact shift 15ms).

Budgets: 75000, 200000, 500000. Seeds: 0, 1, 2.

The score column uses the existing V1 `scoreDriftReport` only as a diagnostic. V2 aggregation and weights are not defined.

| Source | Budget | Runs / errors | End-of-spec | Hit rate | Missing | Off-beat | Legacy score mean [min, max] | Axis RMS | Mean axis absolute error | Wall time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| believer_56_6s | 75000 | 3 / 0 | 0.0% | 53.2% | 39.3 | 0.0 | 0.00 [0.00, 0.00] | 0.1402 | air 0.086, speed 0.055, impact 0.173 | 0.65s |
| believer_56_6s | 200000 | 3 / 0 | 100.0% | 100.0% | 0.0 | 0.0 | 562.16 [552.87, 571.79] | 0.1440 | air 0.091, speed 0.075, impact 0.146 | 1.89s |
| believer_56_6s | 500000 | 3 / 0 | 100.0% | 100.0% | 0.0 | 0.0 | 581.57 [573.91, 595.56] | 0.1355 | air 0.086, speed 0.063, impact 0.148 | 4.40s |
| believer_impact_56s | 75000 | 3 / 0 | 0.0% | 79.6% | 10.0 | 0.0 | 0.04 [0.01, 0.07] | 0.1456 | air 0.044, speed 0.052, amplitude 0.179, impact 0.096 | 0.54s |
| believer_impact_56s | 200000 | 3 / 0 | 100.0% | 100.0% | 0.0 | 0.0 | 545.70 [507.08, 566.63] | 0.1517 | air 0.045, speed 0.057, amplitude 0.201, impact 0.083 | 1.55s |
| believer_impact_56s | 500000 | 3 / 0 | 100.0% | 100.0% | 0.0 | 0.0 | 569.23 [563.82, 571.98] | 0.1409 | air 0.044, speed 0.039, amplitude 0.200, impact 0.078 | 3.29s |

## Failure frontiers

Contact times include the declared production jolt transform.

| Source | Budget | Seed | Terminus | Last hit | First missing |
|---|---:|---:|---|---|---|
| believer_56_6s | 75000 | 0 | rideStalled@1172 | #43 @ 29.305s | #44 @ 29.795s |
| believer_56_6s | 75000 | 1 | rideStalled@1192 | #44 @ 29.795s | #45 @ 30.755s |
| believer_56_6s | 75000 | 2 | rideStalled@1192 | #44 @ 29.795s | #45 @ 30.755s |
| believer_impact_56s | 75000 | 0 | rideStalled@1614 | #38 @ 40.345s | #39 @ 42.265s |
| believer_impact_56s | 75000 | 1 | rideStalled@1691 | #39 @ 42.265s | #40 @ 44.065s |
| believer_impact_56s | 75000 | 2 | rideStalled@1537 | #37 @ 38.435s | #38 @ 40.345s |

Heldout references were not compiled. The archive is suitable for development feasibility and variance decisions only.
