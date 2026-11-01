# Compiler ideas from the V7 evidence (2026-11-01)

Agreed with the owner on 2026-11-01: idea 1 first; the seed-variance
diagnostic runs alongside; then 2 or 3, by what it shows. Every number here
comes from `main` on V7 at 8 seeds (224 rides).

## What the data shows
- **Share of headline loss:** strength 35%, air 24%, speed 19%, timing 16%.
- **Timing is skewed early:** 15.5% of hits land one frame early and 4.3%
  late. The early share rises with the ask: 6.8% below 0.3, 26.4% at 0.8
  and above.
  - Early hits are also weaker (strength error −0.068, against −0.037 on
    time).
  - Every early strong hit touches the intended catch line: the nose and
    string first, one frame early.
- **On-time hits cross early within their frame:** median −0.37 on a scale
  from −0.5 to +0.5 (the sub-frame estimate below). The catch is placed
  toward the early edge.
- **Seed headroom:** a spec's best seed beats its mean by +23, and best of 2
  would give +10 on the headline. The seed-variance diagnostic separates the
  plan from the search.
- **Air:** high-air asks undershoot, by −0.17 on gaps of 2 s and more.
  Mid-air asks are unbiased.

## Idea 1: the search's timing error, measured continuously
- **Mechanism:** the local search follows smooth error signals, but the
  timing error is a step in whole frames, so it gives no slope.
  - `subframe_contact.ts` estimates when, within its frame, a rider point
    crossed the catch line. It works from the frame before, in free flight;
    validated on saved rides, it is found for 96% of hits and inside the
    registered frame for 99%.
  - The search then uses the account's own timing formula,
    max(0, |offset| − 0.5) / 4, with the continuous offset. It is zero
    inside the target frame, equal on average to the integer error one frame
    off, and continuous.
  - It adds no parameter, keeps the same residual slot, falls back to the
    integer error when no crossing is measured, and leaves the scorer
    unchanged.
- **Hypothesis, stated before the run:**
  - fewer early hits on strong asks;
  - the timing loss down;
  - the V7 headline up, with directional support above 0.9 at 4 or 8 seeds;
  - strong-ask strength not worse (early hits are also the weak ones);
  - no ride lost.
