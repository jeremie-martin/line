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

## Free geometry: the trade-off curve (V7, 4 seeds, against `main` 741.0; no ride lost)

| choice scale | headline | 95% interval | support | geometry differs between starts | airtime difference per gap | shapes, % of time |
|---|---|---|---|---|---|---|
| `main` (plan) | — | — | — | 78% | 0.042 | 42.3 |
| 0 (best) | −3.9 | [−21.7, +14.0] | 0.27 | 0% | 0.000 | 18.9 |
| **0.002** | **−3.1** | [−19.5, +13.2] | 0.29 | **69%** | **0.042** | 18.6 |
| 0.005 | −8.3 | [−28.7, +12.2] | 0.14 | 69% | 0.043 | 16.4 |
| 0.02 | −37.6 | [−57.4, −17.8] | < 0.01 | 73% | 0.052 | 18.1 |

- **Variety saturates at the smallest scale tried.** A tiny random choice
  early in a ride sends it down a genuinely different good path. More
  randomness only costs quality, so the choice needs only to break
  near-ties.
- **Scale 0.002 against the plan:**
  - quality is not distinguishable at 4 seeds;
  - variety between starts is about the plan's (69% against 78% of gaps;
    the same airtime difference);
  - no lottery, and no plan;
  - shapes drop to 19% of ride time (from 42%); arcs with the rail and
    scattered fragments double;
  - physics +10%, since seven geometries each keep the sampling floor.
- **Categories at 0.002:**
  - pairs +11.5, words +3.6, ride-outs +3.8;
  - groove −12.1, calm −12.9, the long ride −19.0;
  - explicit requests −14.0, since the free gaps around the requested ones
    changed.
- **Next:** extend 0.002 to 8 seeds, because more seeds could change the
  reading here.

## Free geometry at 0.002, 8 seeds

| | 4 seeds | 8 seeds |
|---|---|---|
| headline | −3.1 [−19.5, +13.2] | **−6.8 [−13.5, −0.0]**, support 0.02 |
| specs up / down | 10 / 12 | 8 / 14 |
| geometry differs between starts | 69% vs 78% | 69% vs 81% |

- **Categories at 8 seeds:**
  - pairs +13.6;
  - groove −12.9, calm −15.6, the long ride −29.1;
  - words, intense, breaks and ride-outs within ±5.
- **Other rulers:**
  - body drag +0.6 s/min, in every category: arcs with the rail and
    scattered fragments are used about twice as much;
  - speed error +0.003;
  - physics +10%;
  - no ride lost, and explicit geometry is all realized.
- **Reading:** as built, free geometry is slightly worse than the plan, by
  about 7 points and with more body contact. It gives comparable variety
  between starts with no lottery, but half the shapes.
- **Likely cause, not yet tested:** dilution. Each of the seven geometries
  gets about a seventh of the gap's search effort (often the 12-sample
  floor), where the plan spends it all on one. Screening every geometry
  cheaply and then spending the effort on the few best would test it.

## Priority 1: how the catch is built (2026-11-01, agreed with the owner)
**Characterisation** (`main`'s V7 rides; catch controls from the saved
compile outputs; 12,592 catches):
- **Early hits rise as the catch's `offset` nears or passes zero:** 7.6%
  below −0.5, 28–40% from −0.5 up. Steep incidence (|entry − incoming|
  ≥ 20°) gives 29–38% early, against 5–8% when shallow. The offset sits at
  its lower bound (−2) for 20% of catches.
- **Sub-frame crossing time of the catch line** (1,786 catches): its median
  is −0.36 to −0.47 (0 = middle of the target frame; −0.5 to +0.5 = on time)
  in every offset and incidence group.
  - The construction places crossings near the start of the beat frame; the
    early hits are the tail tipping over.
  - Offset and incidence only change how often that happens.

**Mechanism:** the catch is anchored at the rider points' positions at the beat
frame's first collision pass, i.e. aimed at the frame boundary rather than its
middle.

**Experiment `exp/catch-midframe`** (hypothesis stated before the run):
- **Change:** place the catch where each point will be half a frame later
  (position + 0.5 × its velocity). It is a law of motion, not a fitted number;
  the search's offset control works on top.
- **Expected:**
  - early hits fall (15.6% → under 8%) without late hits taking their place
    (under 8%);
  - the timing loss falls;
  - strong-ask strength improves, since the early hits are also the weak ones;
  - the V7 headline rises with directional support above 0.9;
  - no ride lost.
- **Risk:** the learned construction memories were recorded with the old
  placement, so their offsets mean something slightly different now.

## Geometry capability map (`tools/research/geometry_map.py`, `main`'s V7 rides; report only)
Per realized geometry and gap length: the catch the gap builds at its start
(strength error, share of hits a frame early), and airtime against its ask.
- **Early catches concentrate in shaped geometry with the rail touched:**
  - fold with rail: 43–60% early at every length;
  - S-sweep with rail: 26–28%;
  - ripples with rail: 17–29%;
  - plain arcs and scattered fragments: 4–15%.
  - Gaps under 12 frames are 20–60% early for every geometry.
- **Catch strength error** is similar across geometries (about −0.02 to
  −0.07 on gaps of 12–40 frames).
- **High-air asks (≥ 0.75) fall short with every geometry,** worst on gaps of
  40+ frames (−0.06 to −0.11, plain arcs −0.075). The float shortfall is
  about launching, not about which geometry is chosen.
- **Reading:** the mid-frame placement addresses the general bias. The
  fold's aligned entry is a candidate second cause, to look at after.

## Mid-frame catches: result (adopted)

| | change | 95% interval | support |
|---|---|---|---|
| V7, 4 seeds | +16.0 | [+7.5, +24.5] | > 0.99 |
| V7, 8 seeds | **+15.5** | [+11.8, +19.3] | > 0.99 |
| V7, half the allowance | +15.0 | [+10.8, +19.1] | > 0.99 |
| held out (5 specs) | +12.7 | [−4.2, +29.6] | 0.95 |

- At 8 seeds all 22 specs are up and every category gains (+13 to +19).
  The explicit cases are +10.5 and all realized. On the held-out panel all
  5 specs are up.
- **Timing:** early hits 15.3% → 4.4%, late 4.0% → 4.1%; on strong asks,
  early 20.9% → 6.3%. The hypothesis held exactly, unlike the continuous
  timing error, which turned early hits into late ones.
- **Other rulers:** strong-ask bias is better, body drag lower, air slightly
  better, speed ±0.005. Head-down or backward strong arrivals are mixed and
  small (+0.015 in groove, −0.015 elsewhere).
- **The ending refinement still works at the real allowance**, with
  proposals and accepted repairs on V7 rides. Small synthetic tests whose
  budgets had been tuned to the old frame use were re-derived; see
  REWORK.md.

## High floats: what the shortfall is (report only; no compiler change)
Priority 2 was "high floats fall short of their air ask". On `main`'s V7
rides (`tools/research/float_contacts.ts`, `float_feasibility.ts`):
- **The extra contact is the launch ride.** The floats that fall short ride
  their catch line about 44 frames (the floats on target ride about 18),
  against about 14 allowed. What looked like mid-float touches is the rider
  still on that line: Line Rider's points touch it on alternate frames. Nothing
  comes from the next catch.
- **Two specs carry most of it:** Amour bench-long 62% of the squared air
  shortfall, Tiki bench-calm 20%, everything else ≤ 7%.
- **Those two ask for three things physics doesn't give together:** long
  high floats (air 0.84–0.95 over 2–4 s), a moderate mean speed (0.3–0.5),
  and soft catches between them (0.1–0.4). A float that high falls about as
  fast as it rose, so its closing catch has to turn the rider 70–100° to
  relaunch. At about 11 px/frame that is a speed × turn of 11–12 px/frame,
  against 7.55 for "very strong" and 2–3 for what is asked. Done softly, the
  turn is spread over a long ride, and the air goes.
- **The compiler's trade is deliberate.** It keeps the catches soft and the
  speed on target (0.42 for 0.44) and gives the air up. Each gap's air is
  measured by the search's own simulation when it chooses.
- **Reading:** this isn't a launching weakness to fix with a mechanism.
  Better trades would mean reweighting the axes, which is fitting the cost to
  the scorer. Two other readings are possible:
  - it is the spec author's choice: a feasibility report could tell authors
    when asks conflict, and leave the choice to them;
  - the benchmark keeps the two specs as a test of how a compiler trades
    asks it can't all meet. The loss is a floor every compiler shares.
