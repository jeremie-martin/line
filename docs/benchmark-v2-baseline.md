# Benchmark V2 Baseline

Label: `span-handover`. Suite: `d01c8a064a201b08`.

Probe headline: **558.31**. Canonical headline: **559.75**. Qualification monitor: **405.41** (indicative only).

Probe and canonical actual seeds are disjoint at every shared budget. Promotion uses a retained `eval --seeds=N` comparison artifact.

Canonical cache: stable ladder through **300** slots/budget; accepted development evidence covers slots [0, 8).

| Budget | Probe | Valid | Canonical | Valid | Qualification | Valid |
|---:|---:|---:|---:|---:|---:|---:|
| 250k | 539.88 | 130/132 | 526.50 | 344/352 | 398.70 | 40/40 |
| 500k | 565.68 | 132/132 | 565.64 | 352/352 | 406.73 | 40/40 |
| 750k | - | - | 572.10 | 352/352 | 407.68 | 40/40 |

Candidate: `9dc54379dd092ce7f48a2efc7dd9fbef43f49935844111b7300943c75e7a04de`.
Inference rule: `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`.
Decision protocol: `66df2a60541432357fa203e1d45f4377878960f42d47a72a1a153adcf5205d2c`.
Decision calibration: `380bb3c930b98ebb9de394615a0cf1a672a2ec4fd77ede2291b8ccca76bd1cf9`.
