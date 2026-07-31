# Benchmark V2 Baseline

Active campaign label: `contact-redir-impulse-v2-750k`. Suite:
`7bd878d8aaea08a9`.

Official campaign headline: **593.5031** at 750k/N=48, with **2111/2112**
valid runs. Target: **>650**.

This is a fresh scorer-bound bootstrap for accumulated contacted-frame
redirection impulse. It is not a candidate comparison and reports no delta
against the prior net-redirection-arc ruler. The old active baseline supplied
only its literal seed schedule: 16–23 and 608–647.

The 250k and 500k budgets are temporarily deferred from the official headline.
Their old-ruler evidence remains unchanged in `benchmark/v2/baseline.json`; it
was neither recomputed nor used to construct this baseline. Those historical
scores are ruler-incompatible and are not deltas or reference points for
**593.5031**.

Identity:

- scoring protocol:
  `c71466608589ae75745608e1a451abe786e835f4ff0fd79314f155747283a3d6`;
- Golden evaluator: `07cf88383150`;
- candidate:
  `c2f3e2328123898427a68dbcfd78b574e38ae2a6035937728adfd83667e8c800`;
- optimized WASM:
  `12c25081c829506a57b022474174dd3e14b19ff8cd63d87ca467d0519337c9a6`;
- inference rule:
  `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`;
- decision calibration:
  `b41edd06a6ef3c17254529982404b0aa6a4856350638ad66c847be845f9504d1`.

Retained evidence:

| Artifact | Path | SHA-256 |
|---|---|---|
| Raw development archive | `benchmark/v2/runs/contact-redir-impulse-v2-750k-development.json` | `de0aeebc64dc1774902c4aee2b614afe7316ab4dea9d3a54d5065942f5c26f17` |
| Compressed archive | `benchmark/v2/runs/contact-redir-impulse-v2-750k-development.json.gz` | `b4a43b207ef54d303882f55ac887af694d3c568f46a835c47a401a1a46c27516` |
| Decision index | `benchmark/v2/runs/contact-redir-impulse-v2-750k-development.json.decision-index.json` | `eed94e610a555c3606461ac6e5c48425cec12a426cc28da7ec50671600302007` |
| Compiler snapshot | `benchmark/v2/runs/contact-redir-impulse-v2-750k-compiler-snapshot.tar.gz` | `da032252ac71688724062a076f073cf20a26ef4436c466bc3381cd4f95a4aa5a` |
| Bootstrap request | `benchmark/v2/runs/contact-redir-impulse-v2-750k-bootstrap-request.json` | `5ce9183422d19c40bcaaeb8724e8b151248fade8f14bf7780285c3794ccbe903` |

The sole invalid score is `frontier_dense_recovery` at actual seed 645
(`rideStalled`); execution still completed with zero worker failures.
See `docs/benchmark-v2-current-baseline-analysis.md` for the within-baseline
distribution, component, seed, target-band, and outlier analysis.
