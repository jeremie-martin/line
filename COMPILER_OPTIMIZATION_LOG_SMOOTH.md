# Compiler Optimization Log - Smooth Controls

Goal: raise canonical HEADLINE using only canonical-golden validation. One scoped
mechanism at a time; keep only canonical `npm run decide` ACCEPTs after this
first post-rebase baseline.

## baseline-impact-curve-start25-env-rerun-01

- Current baseline: `7ef1471` (`Retune impact curve ramp for envelope-ruler targets`).
- Mechanism already in HEAD after rebase: impact-curve target pressure start
  `0.45 -> 0.25`, so envelope-capped impact targets around `0.45..0.65` get
  continuous curvature authority instead of near-zero pressure.
- Run: `generated/golden-runs/impact-curve-start25-env-rerun-01`.
- Verdict: first smooth-campaign baseline; no `decide` needed per user.
- Canonical: HEADLINE `514.30`; budgets `50k 343.28`, `100k 509.78`,
  `200k 530.13`, `300k 533.76`; validity `1898/1920`, `300k 480/480`;
  fingerprint `4af34575a3f7`.
- Diagnostics: prior same-fingerprint archive `baseline-smooth-8743d21` was
  `494.04` with budgets `330.11/490.86/507.97/513.14`; current run is the
  baseline for the next canonical decision.

## dense-grain-cap-smooth-01

- Mechanism: arc placement dense-grain post-length cap.
- Continuous replacement: boolean `grain >= 0.50 && nextGap <= 14` cap became a
  smooth grain/spacing pressure, lerping from uncapped `220px` to the dense cap.
- Run: `generated/golden-runs/dense-grain-cap-smooth-01`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.3`, all budget deltas
  `+0.0`, validity unchanged.
- Impact: exact no-op on canonical rows; likely no canonical target sits in the
  newly smoothed boundary band.
- Status: rejected and reverted; next try should target an active impact/geometry
  threshold.

## redir-contact-target-pressure-smooth-01

- Mechanism: impact redirection contact-angle target pressure.
- Continuous replacement: old `0.55..0.90` target activation became zero-based
  smooth pressure with full authority by `0.65`.
- Run: `generated/golden-runs/redir-contact-target-pressure-smooth-01`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 513.6`, deltas `50k +0.0`,
  `100k +0.0`, `200k -1.1`, `300k -0.8`; validity unchanged.
- Diagnostics: real but mixed movement; average spec gains included
  `canyon_steps +13.020`, `glide_stairs +7.186`, while losses included
  `dense_echo_climb -8.843`, `ridge_pulse -7.817`.
- Status: rejected; broad zero-based ramp likely over-drove soft targets. Trying
  narrower `0.35..0.65` ramp as `redir-contact-target-pressure-band-02`.

## redir-contact-target-pressure-band-02

- Mechanism: same contact-angle target pressure.
- Continuous replacement: old `0.55..0.90` target activation became a narrower
  `0.35..0.65` smooth ramp.
- Run: `generated/golden-runs/redir-contact-target-pressure-band-02`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.4`, delta `+0.1`,
  CI `[-2.2, 2.2]`, `P(delta<=0)=46.2%`; per-budget deltas `+0.0`, `+0.0`,
  `-0.5`, `+0.5`; validity unchanged.
- Diagnostics: weighted spec gains included `tiny_dance +13.829`,
  `drums_zigzag +7.131`; losses included `float_bounds -11.961`,
  `skyline_push -6.333`.
- Status: rejected; slight positive mean is not an ACCEPT. Trying final tighter
  `0.45..0.65` core-target ramp as `redir-contact-target-pressure-core-03`.

## redir-contact-target-pressure-core-03

- Mechanism: same contact-angle target pressure.
- Continuous replacement: old `0.55..0.90` target activation became a tight
  `0.45..0.65` smooth ramp.
- Run: `generated/golden-runs/redir-contact-target-pressure-core-03`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.1`, delta `-0.2`,
  CI `[-2.0, 1.5]`; per-budget deltas `+0.0`, `+0.0`, `-0.5`, `-0.1`;
  validity unchanged.
- Status: rejected and reverted with the contact-target mechanism dropped.

## arc-len-room-smoothstep-01

- Mechanism: arc-length room gating for long ride-out authority.
- Continuous replacement: linear room ramp between dense/sparse gap frames became
  `smoothstep` with the same `26..46` frame anchors.
- Run: `generated/golden-runs/arc-len-room-smoothstep-01`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.6`, delta `+0.3`,
  CI `[-2.3, 2.3]`; per-budget deltas `-8.8`, `+0.9`, `+0.9`, `+1.2`.
- Diagnostics: high budgets improved, but 50k validity/score regressed
  (`343.3 -> 334.4`, valid `96% -> 95%`).
- Status: rejected; trying budget-smoothed variant that preserves the old linear
  room at 50k and reaches smooth room by 100k.

## arc-len-room-smoothstep-budget-02

- Mechanism: same arc-length room gating.
- Continuous replacement: blend old linear room to smooth room by compile budget;
  50k stays linear, 100k+ gets smooth room.
- Run: `generated/golden-runs/arc-len-room-smoothstep-budget-02`.
- Decide: `VERDICT: ACCEPT`; headline `514.3 -> 515.2`, delta `+0.9`,
  CI `[-0.2, 2.2]`, `P(delta<=0)=5.4%`.
- Per-budget deltas: `50k +0.0`, `100k +0.9`, `200k +0.9`, `300k +1.2`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: accepted; this archive becomes the next official comparison baseline.
