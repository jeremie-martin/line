# Benchmark V2 Capability Screen

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
| capability_low_air_rideouts | 75000 | 3 / 0 | 0.0% | 63.6% | 8.0 | 0.0 | 0.11 [0.11, 0.12] | 0.2652 | air 0.307, speed 0.125, impact 0.148 | 0.45s |
| capability_low_air_rideouts | 200000 | 3 / 0 | 0.0% | 63.6% | 8.0 | 0.0 | 0.13 [0.12, 0.13] | 0.2346 | air 0.254, speed 0.097, impact 0.167 | 1.22s |
| capability_low_air_rideouts | 500000 | 3 / 0 | 0.0% | 63.6% | 8.0 | 0.0 | 0.13 [0.12, 0.13] | 0.2331 | air 0.259, speed 0.090, impact 0.163 | 2.78s |
| capability_short_pickups | 75000 | 3 / 0 | 0.0% | 51.5% | 21.3 | 0.0 | 0.00 [0.00, 0.00] | 0.2038 | air 0.179, speed 0.059, impact 0.248 | 0.62s |
| capability_short_pickups | 200000 | 3 / 0 | 0.0% | 63.6% | 16.0 | 0.0 | 0.00 [0.00, 0.00] | 0.2109 | air 0.222, speed 0.039, impact 0.230 | 1.48s |
| capability_short_pickups | 500000 | 3 / 0 | 0.0% | 54.5% | 20.0 | 0.0 | 0.00 [0.00, 0.00] | 0.2119 | air 0.191, speed 0.048, impact 0.243 | 3.32s |

## Failure frontiers

Contact times include the declared production jolt transform.

| Source | Budget | Seed | Terminus | Last hit | First missing |
|---|---:|---:|---|---|---|
| capability_short_pickups | 75000 | 0 | rideStalled@465 | #19 @ 11.615s | #20 @ 11.815s |
| capability_short_pickups | 75000 | 1 | rideStalled@625 | #27 @ 15.615s | #28 @ 16.215s |
| capability_short_pickups | 75000 | 2 | rideStalled@465 | #19 @ 11.615s | #20 @ 11.815s |
| capability_short_pickups | 200000 | 0 | rideStalled@465 | #19 @ 11.615s | #20 @ 11.815s |
| capability_short_pickups | 200000 | 1 | rideStalled@706 | #31 @ 17.655s | #32 @ 17.835s |
| capability_short_pickups | 200000 | 2 | rideStalled@706 | #31 @ 17.655s | #32 @ 17.835s |
| capability_short_pickups | 500000 | 0 | rideStalled@465 | #19 @ 11.615s | #20 @ 11.815s |
| capability_short_pickups | 500000 | 1 | rideStalled@465 | #19 @ 11.615s | #20 @ 11.815s |
| capability_short_pickups | 500000 | 2 | rideStalled@706 | #31 @ 17.655s | #32 @ 17.835s |
| capability_low_air_rideouts | 75000 | 0 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 75000 | 1 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 75000 | 2 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 200000 | 0 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 200000 | 1 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 200000 | 2 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 500000 | 0 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 500000 | 1 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |
| capability_low_air_rideouts | 500000 | 2 | rideStalled@441 | #13 @ 11.015s | #14 @ 16.015s |

Heldout references were not compiled. The archive is suitable for capability feasibility and variance decisions only.
