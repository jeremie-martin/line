# Benchmark V2 Baseline

Label: `segment-refine`. Suite: `d01c8a064a201b08`.

Probe headline: **535.64**. Canonical headline: **532.40**. Qualification monitor: **408.81** (indicative only).

Probe and canonical actual seeds are disjoint at every shared budget. Promotion uses a retained `eval --seeds=N` comparison artifact.

Canonical cache: stable ladder through **300** slots/budget; accepted development evidence covers slots [0, 8).

| Budget | Probe | Valid | Canonical | Valid | Qualification | Valid |
|---:|---:|---:|---:|---:|---:|---:|
| 250k | 510.81 | 121/132 | 509.73 | 322/352 | 400.67 | 40/40 |
| 500k | 545.57 | 129/132 | 528.74 | 342/352 | 409.32 | 40/40 |
| 750k | - | - | 553.60 | 348/352 | 413.37 | 40/40 |

Candidate: `bd312744bdce88acdb0e8df57611378697549fb863ad249cec30b2cffc1368d4`.
Inference rule: `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`.
Decision protocol: `66df2a60541432357fa203e1d45f4377878960f42d47a72a1a153adcf5205d2c`.
Decision calibration: `380bb3c930b98ebb9de394615a0cf1a672a2ec4fd77ede2291b8ccca76bd1cf9`.
