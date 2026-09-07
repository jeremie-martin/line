# Compiler improvement campaign

The active goal is **above 650 using normal type-0 lines only**, under the
unchanged 750k Benchmark V2 score. Current normal-line baseline:
`value-ranked-startup-expiration`, **607.2582** at N=32; N=48 cache retained.

The acceleration-line result, 761.9107 with 352/352 valid runs, is shelved on
`archive/native-motion-feedback-761` (`7cb77df1`). The owner requested full
production videos for later review before pursuing the normal-line goal.
`codex/native-motion-video-review` preserves that work; generated videos and
compiler outputs live at `generated/reviews/native-motion-2026-09-07/`.

Research continues on `codex/normal-line-650`. Exact collision observation,
physical prefix reuse, and motion/pose feedback are being investigated with
normal collision geometry. All mechanisms except acceleration materials remain
open; the benchmark and score stay fixed. See
[the active campaign](normal-line-650-campaign.md) and [goal.md](../goal.md).
