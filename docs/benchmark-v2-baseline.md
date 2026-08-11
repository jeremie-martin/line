# Benchmark V2 Baseline

Active campaign label: `independent-repair-depth-six`. Suite:
`7bd878d8aaea08a9`.

Official campaign headline: **602.9306** at 750k/N=32, with
**1,408/1,408** valid runs. N=32 is this baseline's promotion depth and cache
coverage; the declared experiment maximum remains N=48. Target: **>650**.

This baseline promotes the independent, budget-aware repair controller with a
maximum affordable parent depth of six. Against the preceding
`one-terminal-adaptive-repair-750k` controller on the identical N=32 prefix,
the canonical headline moved 602.4958 → 602.9306: delta +0.4348, seed-block SE
0.1706, P(+) 99.2007% against the predeclared 98.8842% N=32 boundary, and a
one-sided lower bound of +0.0164. The strict action was `accept`; validity was
unchanged. No N=48 rows were sampled after acceptance.

The compact scale campaign independently accepted the same depth-six operating
point at N=8 across eight sources and eight hard budgets from 150k to 4M. Its
headline delta was +0.5128, with P(+) 99.5397% above the 99.1667% boundary,
750k delta +0.3746, and unchanged 495/512 validity. The associated repair audit
replayed 47,944 invariants over 1,947 episodes with zero violations. Scale is
the budget-response authority; the canonical run above is the promotion
authority.

Future improvements declare N=48 once and use strict N=8/16/32/48 looks with a
calibrated symmetric O'Brien-Fleming Student-t boundary. The one-sided total
false-promotion tolerance is 5%; there is no predictive futility stop. Matching
prefixes of this N=32 cache are reusable for later comparisons.

The 250k and 500k budgets remain deferred from the official headline. Their
old-ruler evidence is unchanged in `benchmark/v2/baseline.json`; it was neither
recomputed nor used to construct this baseline.

Identity:

- scoring protocol:
  `c71466608589ae75745608e1a451abe786e835f4ff0fd79314f155747283a3d6`;
- Golden evaluator: `07cf88383150`;
- compiler source:
  `ba88c852bfb73b1846d387b4b7df97378353eef6a5b048ab875c4dd796e43b35`;
- candidate:
  `c87125e9f9e9b330a89a96a0c5683e92d323dd14882dc2f262aba902ebf8d167`;
- optimized WASM:
  `12c25081c829506a57b022474174dd3e14b19ff8cd63d87ca467d0519337c9a6`;
- inference rule:
  `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`;
- decision protocol:
  `799f49d3f17bc1f545cefe1e5774b28b0ffe315a4ee58b4cfea17e38a6b58fd3`;
- decision calibration:
  `b41edd06a6ef3c17254529982404b0aa6a4856350638ad66c847be845f9504d1`;
- sequential policy:
  `274e69af34fc893c3a568d9c027621b7ef7cc4873b8348825c8a60c508891322`;
- sequential inference:
  `2c01c002cdca5f48e2644fb6604285bc0a1e5044cd01d2d9e07500477ae204d8`;
- sequential calibration:
  `4e0b9568bd474405c465640d3957b714a879ed77852c065e966f590985070d9d`.

Retained evidence:

| Artifact | Path | SHA-256 |
|---|---|---|
| Raw archive content commitment | `benchmark/v2/runs/independent-repair-depth-six-development-750k-N32.json.gz.archive.sha256` | `179834f7d707491d51b3073ad3336f3f38bf440958043c3c709ef977b973aa8a` |
| Compressed archive | `benchmark/v2/runs/independent-repair-depth-six-development-750k-N32.json.gz` | `a5418ac51b3a929b9841575cbb4f337253477c152619db9e96872c72bf61b583` |
| Decision index | `benchmark/v2/runs/independent-repair-depth-six-development-750k-N32.decision-index.json` | `e8205ceb90ae7f63c5fb3a15fa69f6eddb3099a3616b23e77348e6a41c06e905` |
| Promoted comparison | `benchmark/v2/runs/independent-repair-depth-six-comparison.json` | `aae6ca9467d3643d880d4d3eb500620ca1e30957538990b4dd1836ec5ef5eda3` |
| Compiler snapshot | `benchmark/v2/runs/independent-repair-depth-six-compiler-snapshot.tar.gz` | `2a17a74b18fbd9efb7ffb12140395c25a4f280dc97ecb38860dd5ed354978eb8` |

All 1,408 scores are valid and execution completed with zero worker failures.
See `docs/benchmark-v2-current-baseline-analysis.md` for the regenerated
within-baseline distribution, component, seed, target-band, and outlier
analysis.
