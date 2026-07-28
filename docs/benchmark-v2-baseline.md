# Benchmark V2 Baseline

Label: `readiness-catch-impact`. Suite: `d01c8a064a201b08`.

Probe headline: **549.10**. Canonical headline: **553.73**. Qualification monitor: **407.20** (indicative only).

Probe and canonical actual seeds are disjoint at every shared budget. Promotion uses a retained `eval --seeds=N` comparison artifact.

Canonical cache: stable ladder through **300** slots/budget; accepted development evidence covers slots [0, 8).

| Budget | Probe | Valid | Canonical | Valid | Qualification | Valid |
|---:|---:|---:|---:|---:|---:|---:|
| 250k | 515.37 | 127/132 | 510.84 | 338/352 | 401.46 | 40/40 |
| 500k | 562.60 | 132/132 | 561.79 | 352/352 | 407.22 | 40/40 |
| 750k | - | - | 568.90 | 352/352 | 410.99 | 40/40 |

Candidate: `ea5fba7467f676ad002d79cfc477b52a37c16e042ca8d17c56865fa780663606`.
Inference rule: `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`.
Decision protocol: `66df2a60541432357fa203e1d45f4377878960f42d47a72a1a153adcf5205d2c`.
Decision calibration: `380bb3c930b98ebb9de394615a0cf1a672a2ec4fd77ede2291b8ccca76bd1cf9`.
