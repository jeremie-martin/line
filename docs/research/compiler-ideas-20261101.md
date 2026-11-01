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

## Seed-variance diagnostic (`tools/research/seed_variance.ts`, 120 rides)
One automatic spec per category. In design A the plan is held at seed 101
and the search seed varies; in design B the search is held at 101 and the
plan seed varies.

| | variance | sd |
|---|---|---|
| search seed varies | 8 | 2.8 |
| plan seed varies | 253 | 15.9 |

- **The search barely uses its seed.** With the plan fixed, 7 of 8 specs give
  identical rides (sd 0.0).
- **The 108 s ride is the exception** (sd 7.8 over search seeds). Its
  "plan 101, search 101" ride also differs from `main`'s (639 against 645);
  this is unexplained, and noted.
- **So the seed-to-seed spread is the plan's draw.** That includes the +23 by
  which a spec's best seed beats its mean.
- **Plan composition explains little of it.** Within each spec, the score's
  correlation is −0.23 with the shape share of ride time, −0.21 with shapes
  on long gaps, −0.16 with distinct families, +0.14 with the scattered share
  and 0.01 with the plain-arcs share.
  - A different plan acts mostly like a restart: early geometry sends the
    ride down a different path.
- **Consequence for idea 2:** keeping the best of several plans is a general
  mechanism, worth about +10 for two plans.
  - It should cost little variety, because composition barely predicts the
    score; the drift toward fewer shapes must still be measured.
  - It costs compute. A cheaper form would stop a plan early once its partial
    ride is clearly behind.

## Idea 1, result: rejected
- **V7, 4 seeds:** −10.6, interval [−15.8, −5.3], support < 0.01. Every
  block is negative (−7.5, −12.2, −8.1, −14.4) and 20 of 22 specs are down.
  The timing loss went up in every category; no ride was lost.
- **Why** (offsets of matched hits, seeds 101–404):

  | | early | on time | late |
  |---|---|---|---|
  | `main` | 15.6% | 80.0% | 4.4% |
  | continuous timing | 6.9% | 70.7% | 22.3% |

  The continuous error cured early hits, but it **under-charged near
  misses**. A hit just past the frame boundary got almost no error in the
  search, while the scorer charges it a full frame. The search exploited
  exactly that and moved hits just past the late edge.
- **Lesson:** a smooth stand-in for a stepped score must never charge less
  than the score does. Fixes that obey this need a smoothing width (a new
  parameter), or belong in construction: catches cross early within their
  frame (median −0.37), so centring the catch itself would be the direct
  fix. Not pursued blindly; see the next steps.

## Free geometry: no plan, every geometry searched, random near-best choice (hypotheses stated before the runs)
**Agreed with the owner, 2026-11-01:**
- The compiler searches for the best track it can, with no plan.
- Where several kinds of geometry are nearly as good, it picks one at random.
- The seed only starts the random generator.

**Branches:**
- `exp/free-geometry`: choice scale 0.02, about missing one hit's strength
  by 0.1;
- `exp/free-geometry-best`: scale 0, always the best.

**Mechanism:**
- Every gap after the start is a neutral free request, searched with every
  geometry:
  - plain arcs without the rail;
  - arcs, fold, S-sweep, ripples, terraces and scattered, each with the rail
    offered.
- The geometries share the gap's sampling effort, and each is checked against
  its own request.
- Offers are ranked with Gumbel noise of the choice scale: kept with
  probability falling as exp(−Δcost / scale). The final whole-ride choice is
  always the best.
- Explicit requests (E) are searched as asked.

**Hypotheses:**
- **Scale 0:** the V7 headline at least `main`'s (B gained when free), with
  fewer shapes. With no plan and no random choice, rides are identical across
  random starts (geometry differs in 0% of gaps): the generator question,
  made visible.
- **Scale 0.02:** the headline between scale 0 and `main`, possibly at or
  above `main`. Rides differ between random starts again (`main`: 78% of
  gaps); geometry is used broadly; shapes are fewer than with the plan.
- **Both:** no ride lost, and compute about constant (the gap's effort is
  shared, not multiplied).

## Free geometry, first results (V7, 4 seeds, against `main` 741.0; no ride lost)

| | headline | 95% interval | support | geometry differs between starts | shapes (fold, S-sweep, ripples, terraces), % of time |
|---|---|---|---|---|---|
| `main` (plan) | — | — | — | 78% | 42.3 |
| free, best (scale 0) | −3.9 | [−21.7, +14.0] | 0.27 | **0%** | 18.9 |
| free, scale 0.02 | **−37.6** | [−57.4, −17.8] | < 0.01 | 73% | 18.1 |

- **Scale 0:** the free search alone matches the plan's quality within
  noise. It gains on pairs, words and ride-outs, and loses on groove, calm and
  the long ride. Every random start gives the same ride.
  - It uses every geometry: arcs with the rail 26% of the time, scattered
    20%, shapes 19%.
- **Scale 0.02 was miscalibrated,** about 10× too coarse. A gap is about 1/70
  of a ride, so a local-cost difference of 0.02 is about 2 headline points
  per gap, and random choices add up over the gaps.
- **Physics** is +0.30M per ride (+10%): seven geometries each keep the
  12-sample floor.

**Next (hypotheses stated first):** scales 0.002 and 0.005, about 0.2 and 0.5
points per gap. Expected:
- variety between starts well above 0%;
- a headline cost of a few points at 0.002 and more at 0.005.

The trade-off curve, quality against variety, is for the owner to read.
