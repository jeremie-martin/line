# Benchmark V2 Sequential Evaluation Calibration

The active improvement experiment uses strict looks at N=8/16/32/48 and one-sided total alpha 5.0% in each direction. Its calibrated O'Brien-Fleming constant is **1.96392337**.

At look N, accept when `T_N >= c / sqrt(N / 48)`, reject clear harm at the symmetric negative boundary, continue otherwise, and report an uncrossed N=48 as inconclusive. There is no predictive-futility stop. `totalAlpha` is the only operator-facing tolerance; per-look cutoffs are derived.

The paired seed-block jackknife supplies the estimate, SE, and effective degrees of freedom, so the measured seed variation enters every directional probability. That displayed probability is a reference Student-t summary; the calibrated crossing boundary controls repeated-look error.

Calibration uses 10,000 studentized paths per stress and an independent 10,000-path validation set per stress. The stresses are Gaussian observations, standardized Student-t(5) observations, and 20% zero-inflated Gaussian observations. The selected boundary must put every calibration Wilson-95 upper bound at or below 4.0%, leaving validation headroom.

## Independent validation

| Stress | False promote | False harm |
|---|---:|---:|
| gaussian | 3.47% [3.13, 3.85] | 3.37% [3.03, 3.74] |
| heavy_tailed | 3.11% [2.79, 3.47] | 2.99% [2.67, 3.34] |
| zero_inflated | 3.30% [2.97, 3.67] | 3.31% [2.98, 3.68] |

Every Wilson-95 upper bound is at most 5.0%. The two directional caps are separate; this is not a 5% cap on their union.

## Readiness comparison replay

| N | Base | Candidate | Delta | SE | P(delta>0) | Required | Action |
|---:|---:|---:|---:|---:|---:|---:|---|
| 8 | 594.6832 | 595.0875 | +0.4043 | 0.5578 | 75.396% | 99.903% | continue |
| 16 | 594.4035 | 595.1915 | +0.7880 | 0.4568 | 94.747% | 99.803% | continue |
| 32 | 594.7050 | 596.0050 | +1.3000 | 0.3562 | 99.952% | 98.884% | accept |
| 48 | 593.5031 | 595.8997 | +2.3966 | 1.3697 | 95.665% | 97.227% | inconclusive |

This replay did not choose the policy and does not revise the historical owner override. Under the live strict queue, N=32 would have accepted and N=48 would never have been run; the N=48 row is shown only because the completed historical archive already exists.

## Identity and reproduction

Suite: `7bd878d8aaea08a92c112bf1e1f5869b1583aebb84593e6f268f7ec2576d7849`. Scoring protocol: `c71466608589ae75745608e1a451abe786e835f4ff0fd79314f155747283a3d6`. Policy: `274e69af34fc893c3a568d9c027621b7ef7cc4873b8348825c8a60c508891322`. Inference: `2c01c002cdca5f48e2644fb6604285bc0a1e5044cd01d2d9e07500477ae204d8`. Generator: `75ca2fbe1ecd90a3ba748bc08ddddb0e1380c41794b10ed8dfa596f4a7d111df`.

Regenerate deterministically with `node --import tsx scripts/benchmark/calibrate_sequential_eval.ts`. A new scorer bootstrap may supply `--base-index=... --candidate-index=...`; the replay is diagnostic, so the same current-scorer index may be used twice when no comparison exists yet. Preparation and paid active eval fail closed if the artifact, implementation, policy, scorer, suite, generator, or retained reference indexes no longer match.
