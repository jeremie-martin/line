# Benchmark V2 Baseline

Active campaign label: `postcompletion-aim-center-reuse-750k`. Suite:
`d01c8a064a201b08`.

Official campaign headline: **587.0568** at 750k/N=48, with **2112/2112**
valid runs. Target: **>650**.

The active baseline was created without compilation by projecting the exact
750k rows from the retained `postcompletion-aim-center-reuse` N=48 archive.
The projection verifies the source cache and complete archive before use.

The 250k and 500k budgets are temporarily deferred from the official headline.
They are preserved unchanged in `benchmark/v2/baseline.json`, whose historical
full-ladder headline is **571.0840** and whose budget scores remain:

| Budget | Frozen score | Valid |
|---:|---:|---:|
| 250k | 526.4128 | 2034/2112 |
| 500k | 579.3689 | 2112/2112 |
| **750k (active)** | **587.0568** | **2112/2112** |

Candidate: `aaadaa3969c70a608f539f76ac0962cb0c30ef96e59f426f021d40b9208ff97b`.
Inference rule: `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`.
Decision calibration: `380bb3c930b98ebb9de394615a0cf1a672a2ec4fd77ede2291b8ccca76bd1cf9`.
