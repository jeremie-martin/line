# Benchmark V2 Baseline

Active campaign label: `one-terminal-adaptive-repair-750k`. Suite:
`7bd878d8aaea08a9`.

Official campaign headline: **602.1261** at 750k/N=8, with **352/352** valid
runs. N=8 is this baseline's promotion depth and present cache coverage;
the declared experiment maximum remains N=48. Target: **>650**.

This is the accepted one-terminal adaptive repair allocator on top of
`outgoing-amplitude-response-750k`. It was compared on the identical literal
N=8 seed prefix 16–23. The point estimate was +0.4378 (601.6883 → 602.1261),
seed-block SE 0.0862, with P(+) 99.93% against the predeclared 99.90% boundary.
The strict sequential action at N=8 was `accept`; all four suite strata moved
positively and validity was unchanged.

Future improvements declare N=48 once and use strict N=8/16/32/48 looks with a
calibrated symmetric O'Brien-Fleming Student-t boundary. The one-sided total
false-promotion tolerance is 5%; there is no predictive futility stop.

The current runner also emits diagnostic per-seed progress after each complete
44-case block. It uses verified matched baseline rows and the same observed
seed-block SE and reference-t probability as the decision model. Only strict
look artifacts have decision authority; the progress log is reconstructable
and does not change scorer, inference, calibration, or baseline evidence.

The separate compact scale campaign compared the repair modes over eight
sources, eight hard budgets from 150k to 4M, and 16 seed curves. Its governed
N=8 decision was +0.4376 in favor of adaptive repair; full-depth
characterization was positive at every budget, with identical validity. This
is broad budget-response evidence, not a replacement for the canonical 750k
promotion result.

The 250k and 500k budgets are temporarily deferred from the official headline.
Their old-ruler evidence remains unchanged in `benchmark/v2/baseline.json`; it
was neither recomputed nor used to construct this baseline. Those historical
scores are ruler-incompatible and are not deltas or reference points for
**602.1261**.

Identity:

- scoring protocol:
  `c71466608589ae75745608e1a451abe786e835f4ff0fd79314f155747283a3d6`;
- Golden evaluator: `07cf88383150`;
- compiler source:
  `72d714452f7983cf252750e64eab6f1d4dfc0c7067724c0bc7ec6c3cbc58eaf2`;
- candidate:
  `2598e3af80a8ad2e6bf331c475d2ececc7442de2d3cdfcb0725f260989fe133e`;
- optimized WASM:
  `12c25081c829506a57b022474174dd3e14b19ff8cd63d87ca467d0519337c9a6`;
- inference rule:
  `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`;
- decision protocol:
  `456f6805f87908d22f62aae0c98d98088d121feba9f6a4acdbbc96e2ece68a9e`;
- decision calibration:
  `b41edd06a6ef3c17254529982404b0aa6a4856350638ad66c847be845f9504d1`.
- sequential policy:
  `274e69af34fc893c3a568d9c027621b7ef7cc4873b8348825c8a60c508891322`;
- sequential inference:
  `2c01c002cdca5f48e2644fb6604285bc0a1e5044cd01d2d9e07500477ae204d8`;
- sequential calibration artifact:
  `4e0b9568bd474405c465640d3957b714a879ed77852c065e966f590985070d9d`.

Retained evidence:

| Artifact | Path | SHA-256 |
|---|---|---|
| Raw archive content commitment | `benchmark/v2/runs/one-terminal-adaptive-repair-750k-development-750k-N8.json.gz.archive.sha256` | `ef3229cdf8d1fa8d32761c15d9d60152ce494a8a04206f4304e8c8448696aaa3` |
| Compressed archive | `benchmark/v2/runs/one-terminal-adaptive-repair-750k-development-750k-N8.json.gz` | `2f070bfabb8128571278220357dd94ad804396a270f515d477371d1874efc78a` |
| Decision index | `benchmark/v2/runs/one-terminal-adaptive-repair-750k-development-750k-N8.decision-index.json` | `0dd125d58d932924a239fd90d080e88b4fb4bcb9db0b64346260f3d44abdfd21` |
| Promoted comparison | `benchmark/v2/runs/one-terminal-adaptive-repair-750k-comparison.json` | `1b4bef026f71043e61563867650496c7c2142123fdc114a3a2eae0ac87bf5bed` |
| Compiler snapshot | `benchmark/v2/runs/one-terminal-adaptive-repair-750k-compiler-snapshot.tar.gz` | `2f6def0436f0ac62253c91f924b06b8d98b9914af61af1a9552389ea466a339b` |

All 352 scores are valid and execution completed with zero worker failures.
See `docs/benchmark-v2-current-baseline-analysis.md` for the within-baseline
distribution, component, seed, target-band, and outlier analysis.
