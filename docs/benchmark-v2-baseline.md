# Benchmark V2 Baseline

Label: `paced-forward-eval-width`. Suite: `d01c8a064a201b08`.

Probe headline: **537.74**. Canonical headline: **541.57**. Qualification monitor: **408.81** (indicative only).

Probe and canonical actual seeds are disjoint at every shared budget. Promotion uses a retained `eval --seeds=N` comparison artifact.

Canonical cache: stable ladder through **300** slots/budget; accepted development evidence covers slots [0, 8).

| Budget | Probe | Valid | Canonical | Valid | Qualification | Valid |
|---:|---:|---:|---:|---:|---:|---:|
| 250k | 511.64 | 122/132 | 508.13 | 321/352 | 400.67 | 40/40 |
| 500k | 548.17 | 131/132 | 538.38 | 347/352 | 409.32 | 40/40 |
| 750k | - | - | 569.17 | 352/352 | 413.37 | 40/40 |

Candidate: `fd5db82821d9a2b2ba1eb04f8bc5608625342aa127c639bd93e398306b31bf81`.
Inference rule: `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`.
Decision protocol: `66df2a60541432357fa203e1d45f4377878960f42d47a72a1a153adcf5205d2c`.
Decision calibration: `380bb3c930b98ebb9de394615a0cf1a672a2ec4fd77ede2291b8ccca76bd1cf9`.
