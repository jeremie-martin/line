# Benchmark V2 Baseline

Active campaign label: `readiness-contact-impulse-v3-750k`. Suite:
`7bd878d8aaea08a9`.

Official campaign headline: **595.8997** at 750k/N=48, with **2112/2112**
valid runs. N=48 is this baseline's promotion depth as well as its present
cache coverage. Target: **>650**.

This is the scorer-aligned readiness refit under accumulated contacted-frame
redirection impulse. It was compared against the first current-ruler bootstrap
on the identical literal seed schedule: 16–23 and 608–647. The comparison
point estimate was +2.3966 (593.5031 → 595.8997), with 95% CI
[-1.2805,+6.0737]. Its ordinary verdict remains `inconclusive`. An explicit
owner override promoted the recalibration; the active reference records both
the original verdict and the reason for overriding it.

That comparison predates the current strict sequential policy, so its
historical fixed-look verdict was not retroactively rewritten. The reference
received a protocol-only migration: future improvements declare N=48 once and
use strict N=8/16/32/48 looks with a calibrated symmetric O'Brien-Fleming
Student-t boundary. The one-sided total false-promotion tolerance is 5%; there
is no predictive futility stop. This migration changed no score or archive.

The 250k and 500k budgets are temporarily deferred from the official headline.
Their old-ruler evidence remains unchanged in `benchmark/v2/baseline.json`; it
was neither recomputed nor used to construct this baseline. Those historical
scores are ruler-incompatible and are not deltas or reference points for
**595.8997**.

Identity:

- scoring protocol:
  `c71466608589ae75745608e1a451abe786e835f4ff0fd79314f155747283a3d6`;
- Golden evaluator: `07cf88383150`;
- candidate:
  `55050d5ee766b2b58deebfc5568c529d405cf67cb4e87f0856853f776798b8a2`;
- optimized WASM:
  `12c25081c829506a57b022474174dd3e14b19ff8cd63d87ca467d0519337c9a6`;
- inference rule:
  `56b577326b380cfda55c88aa26dbdbfd3df13b9715b792ad9708585683be485f`;
- decision protocol:
  `02c0b9988f9be71ec17894e741e0d59bd9ea8cb9992d31eca2725f8bdecb8559`;
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
| Raw archive content commitment | `benchmark/v2/runs/readiness-contact-impulse-v3-750k-development-750k.json.gz.archive.sha256` | `ec4f458ea102d42fcf8f48009ad90f4fdf6a92b6edd8fe295846bdf7bf761fc1` |
| Compressed archive | `benchmark/v2/runs/readiness-contact-impulse-v3-750k-development-750k.json.gz` | `7ec567fd0df58e707734afbd99f82731210401c1dbdb04b7bfbe818b1e7edab4` |
| Decision index | `benchmark/v2/runs/readiness-contact-impulse-v3-750k-development-750k.decision-index.json` | `aab430f17a8c5e5e3d493215dbd9ba266f5da05b26652297d613ff44995fdd14` |
| Promoted comparison | `benchmark/v2/runs/readiness-contact-impulse-v3-750k-comparison.json` | `b01448257582b1a309419c8f6a99e6b9b06aef9a04b407623aff4dff967bad2a` |
| Compiler snapshot | `benchmark/v2/runs/readiness-contact-impulse-v3-750k-compiler-snapshot.tar.gz` | `55e99e0002ef46431fd6c949d5ae4ef4f26ef3c95bdb6d092fc06cb983aa1210` |

All 2,112 scores are valid and execution completed with zero worker failures.
See `docs/benchmark-v2-current-baseline-analysis.md` for the within-baseline
distribution, component, seed, target-band, and outlier analysis.
