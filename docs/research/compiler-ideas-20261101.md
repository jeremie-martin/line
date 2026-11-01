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

## High floats: a reading of the shortfall (report only; no compiler change)
Priority 2 was "high floats fall short of their air ask". What follows
describes how *today's* compiler behaves on `main`'s V7 rides
(`tools/research/float_contacts.ts`, `float_feasibility.ts`), with its current
geometry, timing and search. A compiler with different logic or geometry
could make some of it stop applying.
- **Observed: the extra contact is the launch ride.** The floats that fall
  short ride their catch line about 44 frames (the floats on target ride about
  18), against about 14 allowed. What first looked like mid-float touches is
  the rider still on that line: on a line, the rider's points touch on
  alternate frames. No contact comes from the next catch.
- **Observed: two specs carry most of it.** Amour bench-long has 62% of the
  squared air shortfall, Tiki bench-calm 20%, everything else ≤ 7%.
- **A tension in those two specs, under a simple model.** They ask for long
  high floats (air 0.84–0.95 over 2–4 s), a moderate mean speed (0.3–0.5)
  and soft catches between the floats (0.1–0.4). Model a float as a symmetric
  parabola (lands as high as it took off, mean speed = the ask) and let the
  closing catch do the whole relaunch inside the impact window. That catch
  then turns 70–100° at about 11 px/frame: 11–12 px/frame on the impact
  ruler, against 7.55 for "very strong" and 2–3 asked. This is not a bound.
  The model leaves out:
  - asymmetric floats;
  - a turn split between the catch and a later moment;
  - an upper rail or other geometry carrying part of the redirection;
  - timings and shapes the current catalog doesn't have.
- **How today's compiler resolves it.** It keeps the catches soft and the
  speed on target (0.42 for 0.44) and gives the air up, by riding the launch
  longer. Each gap's air is what its own simulation measured when it chose.
  So, within its current options, this is a choice rather than a misjudgment.
  Whether better options exist is open.
- **What this does and doesn't suggest:**
  - It does not point to a launch mechanism to add now, and reweighting the
    axes to trade differently would be fitting the cost to the scorer.
  - The owner's intuition is that a better compiler, or geometry the catalog
    doesn't have yet (the upper rail is one candidate), could do meaningfully
    better here. Not to be introduced now.
  - Both specs stay in the benchmark as they are. No feasibility report for
    authors.
  - The commit that first recorded this (30227d21) stated it more firmly
    ("asks physics can't meet together") than the evidence supports.

## Impact strength: what the search chooses from (report only)
How today's compiler behaves on `main`'s V7 rides. Tools:
`tools/research/strong_catch_pool.ts`, which compiles with an observe-only hook
(`sequenceObserver`, arc_sequence.ts); all 16 rides scored exactly as saved.
Scratch replays are summarized here.
- **Where the strength loss is.**
  - 78% of the squared strength error comes from asks ≥ 0.6, almost all
    undershoot. Asks 0.8–1.0 average −0.135; asks 0.6–0.8 average −0.060.
  - The search's own measure of a catch's strength equals the scored one.
- **What the hits are made of.** In the scored 2-frame window, a strong hit's
  impulse is about 66% turning, 27% slowing and 7% spin. Arrival speed is
  about 11.8 px/frame either way.
  - Hits that fall short turn less (3.3 against 4.0 px/frame) and arrive
    less steeply (about 29° against 33°).
- **Spacing.** A strong catch soon after another strong catch falls short
  (by > 0.15) more often:
  - 40% under 15 frames;
  - 24% at 15–20 frames;
  - 10% at 20–30 frames;
  - 5% at 30+ frames.

  After a soft beat, short gaps are fine (13%).
- **Two explanations checked and set aside:**
  - **Gravity refilling the heading between catches.** The rotation between
    catches is close to ballistic, and the same whether the next hit falls
    short or not.
  - **A momentum budget.** Between close strong hits the rider is in free
    flight, yet the two scored windows carry about 4× gravity's impulse; the
    rest of each contact gives it back. Neither limits the 2-frame peak in a
    simple way.
- **Earlier work, much of which this matches.** The October history
  (producing-impact-brief-20261004.md, REWORK.md 2026-10-04/05) describes a
  close-beat ceiling near 0.6. It also records levers already tried:
  - steep arrival: adopted;
  - a pressing roof: negative;
  - sharper turns: crash;
  - pose matching: null.
- **What the search had to choose from** (16 rides, 8 specs × 2 seeds, 515
  strong catches):
  - Pools are large: a median of 167 viable candidates per strong catch.
  - 73% of pools hold a candidate within 0.05 of the ask or above. On
    average: kept 0.66, closest to the ask 0.72, strongest 0.78, ask 0.76.
  - **Where the kept catch falls short by > 0.15** (ask 0.86), the pool's
    best is 0.72. Only 18% of those pools reach the ask: there, the options
    themselves stop short.
  - **The kept candidate is the best by measured local cost only 10% of the
    time.** The best-measured candidate is offered to the beam in only 34%.
    Where it is not kept:
    - measured local cost: 0.019, against the kept 0.028;
    - strength error: 0.079, against the kept 0.102;
    - but it scores worse on the arrival priors (0.081 against 0.029) and on
      the learned future estimate (+0.014).

    The priors are about half of the kept candidate's rank.
  - So at strong catches, selection is led by predictions about the next
    catch. Candidates that measure better now are mostly dropped before the
    next interval's search can measure whether their arrival really costs.
- **Caution:**
  - The priors were validated: the steep arrival is a measured gain.
  - The learned future estimate was found no better than a constant
    (REWORK.md, 2026-10-05).
  - A similar idea, in an earlier compiler (arc-state-control), was
    falsified three times: candidates that won locally were committed 6× less
    often, and making their consequences visible through rollouts did not
    help. This compiler is different, but that history lowers the odds.

### Hypothesis: the beam keeps the best-measured candidate alive one step
- **Change.** At each boundary with beam width ≥ 2, one slot goes to the
  candidate with the lowest accumulated measured cost (parent's local cost +
  its own, no priors, no prediction), if it isn't already kept and its arrival
  is distinct. The other slots are chosen as today. Whether its arrival costs
  the next catch is then measured by the next interval's real search: paths
  already accumulate measured local cost only, and priors enter only for the
  newest interval.
- **General, not impact-specific.** It applies at every boundary and to
  every cost term. There is no threshold beyond "the beam has room for two".
- **Expected if the priors over-predict the next catch's cost:**
  - strength closer to strong asks (strong-ask bias up);
  - other axes unchanged or better;
  - V7 headline up.
- **Expected if they're right:**
  - the extra branch loses downstream;
  - roughly neutral quality, with a compute cost: the allowance is shared,
    so sampling elsewhere may fall. Physics frames are reported.
- **Comparison:**
  - V7, 4 seeds against `main`; then 8 seeds if promising; the held-out panel
    only at a decision point;
  - completion reported separately;
  - every ruler: strength by ask band, timing, extras, air, speed, body
    drag, geometry and diversity lines.

### Result: best-measured beam slot (exp/beam-measured-slot, 9cbe6cb8)
| | change | 95% interval | support |
|---|---|---|---|
| V7, 4 seeds | +3.6 | [−6.5, +13.7] | 0.83 |
| V7, 8 seeds | +2.8 | [−1.2, +6.8] | 0.93 |

- **Completion:** unchanged; no ride gained or lost. Explicit requests
  +4.8.
- **Where the gain comes from** (176 paired automatic cells, contributions
  to rms²):
  - strength −0.71e-4;
  - timing −0.26e-4;
  - span axes −0.24e-4;
  - extras −0.02e-4.
- **Strength error² by ask band:**
  - asks under 0.4: −0.7%;
  - asks 0.4–0.6: **−12%**;
  - asks 0.6–0.8: **−5%** (falling short by > 0.15: 8.4% → 7.7%);
  - asks 0.8+: +0.9%.

  This matches the pool study. It helps where the pools held catches near
  the ask, and does nothing for 0.8+ asks, where the options themselves
  stop short.
  - A first reading called the mechanism "absent". That was wrong: it rested
    on the report's strong-ask *bias* and three-decimal rows, which hide a
    change in error².
- **Body drag worse:** 1.67 → 2.02 s/min (+21%), in 8 of 9 categories.
- **Compute:** physics frames equal (the allowance binds). Compile wall time
  +16 s per ride, but the arms were not compiled side by side, so this is
  indicative only.
- **Held out** (5 specs × 4 seeds): −0.7, 95% interval [−24.5, +23.1],
  support 0.46.
  - 3 specs up, 2 down; one ride −101 (Circus voice-drums, seed 101).
  - Body drag +0.39 s/min here too.
  - Compile time side by side: 102 s against 101 s, so no compute cost.
- **Why body drag rises:** the search's cost has no body-drag term
  (`motion_objective.ts`: bursts and calm corrections only). The slot keeps
  candidates that are best on what the search measures. The arrival priors
  (upright arrival among them) were apparently holding drag down indirectly.
- **Decision: not adopted for now, and not rejected.** Parked to revisit or
  refine later (owner, 2026-11-01). The gain on V7 is a reason to come back to
  it.
  - The mechanism is general and small, and it works through the predicted
    channel on V7.
  - But the held-out panel does not confirm the gain, and body drag
    regresses on both panels.
  - Body drag is a proxy the owner has only judged by eye, useful mainly as a
    sign of roof and control-rail use. It is reported, not a veto and not an
    objective. The owner loves upper receivers. He finds the control rail, as
    used today, often boring, and thinks a better use of upper receivers could
    replace some of it.
  - Branch kept: `exp/beam-measured-slot`.

## What a stronger catch costs the next one (same-state test; report only)
`tools/research/catch_price.ts`. 16 rides (8 specs × seeds 101, 202) and 506
strong catches.

**Method.** From the prefix of the beam's first kept candidate (K), the tool
commits each of two alternatives from the same measured pool, then runs the
next interval's own search from each:
- S, the candidate closest to the ask;
- M, the one with the lowest measured local cost.

The probes are isolated: the physics meter is refunded, and the search memos,
control memory and work counters are restored. **All 16 compiled tracks are
identical to the saved rides.**

| X against kept | this catch: strength | this catch: local cost | next interval: charged by ranking | next interval: measured | two steps measured | X better over two steps |
|---|---|---|---|---|---|---|
| S, closest to ask | +0.054 | +0.063 | +0.093 | +0.042 (median +0.012) | +0.104 | 18% |
| M, lowest measured | +0.017 | −0.006 | +0.053 | +0.024 (median +0.007) | +0.018 | 35% |

- **The coupling is real.** A catch closer to its strong ask costs the next
  catch about 0.06 of strength (0.566 → 0.502 for the best-cost candidate;
  next asks average 0.65). It also costs this catch's own interval (+0.063
  local, mostly other terms).
- **The ranking's price is about twice the measured next-step price,** with
  a correlation of only 0.33–0.45. But the measurement covers one interval;
  the priors may also stand for consequences further on, which this does not
  measure.
- **Even at the measured price, the kept choice wins over two steps** in
  82% (against S) and 65% (against M) of probes. This is consistent with the
  beam slot's small, unconfirmed gain: there is a little room in ranking, not
  a lot.
- **Reading (today's compiler and geometry):** the stronger options in the
  pool are mostly paid for by the next catch. More strength at close strong
  beats likely needs options where a hard hit doesn't spoil the next arrival
  (geometry, not ranking). Possible ranking refinements (a better-calibrated
  future estimate; the parked beam slot) look small.

## Hits from a surface above, in today's rides (report only)
`tools/research/upper_hits.ts` on `main`'s V7 rides (12,592 matched hits).
"From above" means the hit's scored push points down. The clip the owner
loved (`ripple-receiver`: Luna seed 202, about 15.8 s) is of this kind. A
floor catch, then about 5 frames later the shoulder and hands meet the line
above while the rider travels almost level (vertical speed about +1
px/frame). The rider's centre of mass is not rising.

- **They are common: 15% of matched hits.**
  - About half are on arcs entered from the opposing side.
  - The touching points are shoulder, hands and sled together, all on the
    arc's own lines.
  - They are used mostly on soft and mid asks (17–22% of those bands, against
    8–10% of strong asks).
- **On strong asks they deliver much less than floor hits:**

  | | asks 0.6–0.8: mean error | short by > 0.15 | late | asks 0.8+: short by > 0.15 |
  |---|---|---|---|---|
  | floor | −0.05 | 6% | 3% | 33% |
  | from above | −0.12 | 33% | 25% | 90% |

  - Their pushes build more slowly (onset 1.15 frames after contact, peak
    0.9 frames after onset, against 0.9 and 0.6 for floor hits).
  - The gap they open has a slightly larger air error (0.048 against 0.039).
  - At close strong spacing (< 15 frames) they fall short 73% of the time
    (floor: 19%).
- **No beat is hit by a rising rider.** Only 0.14% of matched hits arrive
  with the centre of mass rising, and none steeper than 15°.
  - At every boundary of 8 rides, 0.67% of the 750k viable candidates arrive
    rising, at a median of −3°: barely rising.
  - Those candidates measure far worse locally (0.159 against 0.019) and
    carry heavy arrival priors (0.27 against 0.017). The steep-arrival prior
    aims at 20–70° downward; the heading prior charges outside −15° to +45°.
  - So rising into a surface above is essentially outside today's catalog,
    by generation first and priors second. This is a different pattern from
    the loved clip.
- **Reading, within today's compiler:**
  - Hits from above are already a large part of the rides, but they don't
    yet answer strong asks on time or at strength.
  - The owner's note on the loved clip ("especially appealing if
    intentionally aligned to the beat and requested impact; the current
    example is not") fits this exactly.
  - Making these hits deliver (timing and strength) is a candidate lever
    that matches the owner's taste. It also bears on the close-spacing
    coupling found above: a push from above turns the rider downward, which
    a floor catch cannot do.
  - Not yet known: why they are late and weak. Candidates include catch
    construction placing the line by sled points while the body touches
    first, and slower-building body contacts.

## Experiments after the studies (autonomous iterations, 2026-11-01)
Checked first: a catch on an upper surface already uses all ten rider points
as receivers (`buildGeometry`, `contactSide === -1`). Receivers are not why
hits from above are late.

### A. Ranking charges the arrival priors at half weight
- **Basis.** The same-state probes measured the next interval's real cost
  change at about 0.45 of what ranking charges (0.042 against 0.093; 0.024
  against 0.053).
- **Change.** In `valueRank` only (prefix choice and beam ranking), the
  arrival-prior part of a candidate's cost counts ½. Local search keeps the
  priors in full, so proposals are still steered the same way.
- **Hypothesis:**
  - more catches closer to their asks are kept;
  - strength error² on mid and strong asks falls;
  - the next catches lose a little (the probes say less than ranking
    assumed);
  - V7 headline up.
- **Risk.** The priors may also stand for consequences beyond the next
  interval (not measured). Then the next catches lose more than expected,
  and air or speed could suffer.

### Result A (adopted): ranking counts the arrival priors at half weight
| | change | 95% interval | support |
|---|---|---|---|
| V7, 4 seeds | +8.1 | [−1.8, +18.0] | 0.96 |
| V7, 8 seeds | **+7.2** | [+3.4, +10.9] | > 0.99 |
| held out (5 specs × 4 seeds) | +8.1 | [−1.7, +18.0] | 0.96, all 5 specs up |

- **The hypothesis held.** Strength error² fell on mid and strong asks:
  - 0.4–0.6: −21%;
  - 0.6–0.8: −11% (short by > 0.15: 8.4% → 7.2%);
  - 0.8+: −3%.

  The next catches did not visibly pay: air and speed were slightly better,
  and strong extras and contested beats fewer.
- **Head-down or backward strong arrivals:** −1.3 points.
- **Body drag:** +0.22 s/min.
- **Amour bench-long:** −8.8. It is the long-float spec, where the priors'
  steering for the next arrival may matter more.
- **Compared with the parked beam slot:** this does the same job (letting
  measured quality count for more against the prediction) more evenly, and
  it confirms on held-out music. The slot stays parked; trying it on top of
  this is possible later.

### B. The parked beam slot, on top of A
- **Change:** the beam-slot code of `exp/beam-measured-slot` applied to the
  new `main`.
- **Hypothesis:** A already lets measured quality weigh more, so the slot
  adds less than before, perhaps nothing. If something remains, it shows as
  strength error² falling further on mid and strong asks, with body drag
  rising again.

### C. Without the learned future estimate (ablation)
- **Basis.** Ranking adds 0.45 × a learned prediction of the next intervals
  (`arc_value_model.json`, 73 features). In October it was found no better
  than a constant: old, retrained, constant and none landed within about
  0.01. Removing it then was "slightly worse" on an older compiler.
- **Change:** `futureValueModel` off (`connected_arcs.ts`). Ranking is then
  measured cost + ½ arrival priors.
- **Hypothesis.** In today's compiler it adds little beyond noise.
  - Removing it is neutral to slightly positive. If so, it is a
    simplification: the model, its features and its training artifact can
    go.
  - If clearly negative, it carries real information and stays.
- **Result B (4 seeds; parked again):**
  - +3.4, 95% interval [−4.9, +11.7], support 0.86;
  - 17 of 22 specs up; explicit requests −2.8;
  - body drag +0.17 s/min; strength bias and air/speed flat.

  About the same as the slot alone, so possibly additive on top of A, but
  not established. To re-test after the learned models are retrained, since
  that changes the compiler underneath.
- **Result C (4 seeds): the learned estimate stays.**
  - −2.7, 95% interval [−9.5, +4.1], support 0.15; 13 of 22 specs down;
    explicit requests −5.0.
  - Without it: strong-ask bias −0.005, strong arrivals head-down or
    backward +3.3 points, body drag +0.30 s/min.
  - Even trained on an October compiler, it carries information.
  - Next (owner's suggestion): retrain the learned artifacts on today's
    compiler before judging any of them. Collection from the current
    compiler started (`generated/value-v4/collect-1`, 176 training cases
    disjoint from the evaluation and held-out songs).

### Studies agent (report-only; branch `research/studies-20261101`)
Full report kept in the session scratchpad. Summary:
- **Hits from above.**
  - They touch on time (first contact one frame before the beat, like floor
    hits), but the push builds over about 4 frames: one or two sled points,
    then the back follows.
  - Strength stays flat (0.54–0.57) at any approach speed.
  - Their candidates are rarely timely and strong: the best on-time upper
    candidate averages 0.40, against 0.75 for the other side.
  - So construction is the lever, not ranking.
- **Amour bench-long under A** (−8.8, interval about [−18.5, +0.9]): extra
  hits inside long floats doubled.
  - More soft catches that open a float are reached steeper than 45° (56%
    against 40%), and those produce the extras.
  - 45° is where the heading prior starts charging. That prior was pricing a
    real cost two catches ahead, which the one-interval probes did not see.
  - Across specs, gaps of 100+ frames lose under A and every band under 60
    frames gains.
- **Remaining loss (current arm, headline 766.2):**
  - strength 35%, air 29%, speed 21%, timing 7%, extras 7%;
  - largest pools: strength on asks 0.6–0.8 at gaps of 15–30 frames (9.7%),
    and air on asks 0.8+ at gaps of 100+ frames (7.8%).

### D. Heading prior at full weight in ranking; arrival priors stay at ½
- **Change.** The candidate records its heading-prior cost separately.
  `valueRank` counts that part fully and the other arrival priors at ½.
- **Hypothesis.** The long-float specs recover their extras (Amour
  bench-long back near main), while A's strong-ask gains remain. The headline
  is at least A's.

### History agent (read-only; ideas from the last three months)
Full report kept in the session scratchpad. Top three, for testing in turn:
1. **Air and speed weighted by gap length in the interval search** (the old
   `timeObjective`, deleted as dead code on 2026-10-03).
   - Today the whole-ride objective and the headline weigh span errors by
     gap length, but the interval search and beam ranking weigh every gap
     equally. Long gaps (9% of gaps) hold 44% of the scorer's air loss but
     18% of the search's.
   - Earlier results: +3.4 on a pilot, −10 on the full suite (V2 bridge
     specs −54), and rejected without numbers on Oct 4, all on older rulers
     and compilers.
2. **Search where the guide starts and ends** (`guideStart`/`guideEnd`):
   these controls exist but nothing proposes them. 77% of the extras cost
   sits in guided sections, half of it 5–12 frames after the catch (the body
   meeting the roof on the rebound).
3. **More search effort before strong asks** (the October L9, lost when the
   beam replaced lookahead).

### E. The search chooses where the guide starts and ends
- **Change.** `guideStart`/`guideEnd` join the guidance search: the broad
  sweep draws them again (the sweep removed in bc24bca5: start in [0, 0.7),
  end up to 1), and they join the coordinate keys.
- **Hypothesis:**
  - fewer extras in guided sections (the body meeting the roof on the
    rebound, 5–12 frames after the catch);
  - shorter guides where a full roof isn't needed;
  - headline +1 to +4;
  - more partial upper rails, toward upper receivers.
- **Risk.** Shapes lose the guide's holding job, and the fixed guidance
  samples spread over two more keys.

### F. Span errors weighted by gap length in the interval search
- **Change.** Each gap's air, speed and amplitude residuals get
  √(gap length / mean gap length) in the interval search. The same weight
  applies in the prior-gap correction (`arcSpanLoss`,
  `arcBoundaryCorrection`), and the memory's response weights carry it. The
  mean weight is 1, so the cost's overall scale is kept. This makes the
  search consistent with the whole-ride objective and the headline; no new
  parameter.
- **Hypothesis:**
  - air rms down, mostly on long gaps (the high floats fall less short);
  - long-gap speed better;
  - strong-ask strength up in dense passages (short gaps' span terms count
    less there);
  - short-gap air and speed slightly worse;
  - headline up in P3/P6/P7 and the dense strata, groove about neutral.
- **Risks:**
  - It was rejected twice on older compilers (−10 on the full suite in
    September; again on Oct 4, numbers not recorded).
  - The learned future estimate was trained on unweighted costs.

### Results D, E, F
- **D, heading prior at full weight in ranking: adopted.**
  - V7, 4 seeds: +1.3 [+0.1, +2.5], 0.98.
  - V7, 8 seeds: +0.9 [−1.1, +3.0], 0.85. Amour bench-long +9.1 (it lost
    8.8 under A); every other category within ±2.4.
  - Held out: **+4.7 [+2.8, +6.6], > 0.99**, 4 of 5 specs up.
- **E, guide start and end searched: parked.**
  - V7, 4 seeds: +0.7 [−1.9, +3.2], 0.77; 11 specs up, 11 down.
  - The hypothesis failed: strong extra hits rose (+0.009 per beat) instead
    of falling.
  - Amour bench-long +18.4 and Tiki ride-out +20.5, but the dense specs lose
    (P2 −14.1).
- **F, span errors weighted by gap length:** V7, 4 seeds, against the main
  before D: **+7.4 [−1.0, +15.8], 0.97**.
  - Air rms −0.007 overall, −0.035 on P6.
  - Long-gap categories gain: P6 +47.1, P7 +12.6, P1 +10.3, P4 +8.4.
  - Dense ones lose: G −9.4, P2 −10.9, P5 −3.7; explicit requests −5.5.
  - Strong extra hits +0.007 per beat.
  - Next: rebuild on top of D, compare at 8 seeds, and look at the dense
    specs' losses.

### Retraining the learned models on today's compiler
- **Collection.** `value_collect.ts`, run from a worktree frozen at fc9a428a
  (the compiler of `main` with A), into `generated/value-v4/collect-3`. That
  gives 168 records from training cases disjoint from the evaluation and
  held-out songs.
- **Value model** (`generated/value-v4/model-1`), validated on held-out
  training groups:
  - mean regret 0.072, against 0.074 for the October model and 0.096 for
    measured cost only;
  - best chosen 45% against 47%; rank correlation 0.70 against 0.71;
  - level: mean prediction 0.156 against a label mean of 0.172. The October
    model predicts 0.122, about 30% low.
  - So the October model still generalizes; the new one mainly corrects the
    level.

### G. Retrained value model
- **Change:** `arc_value_model.json` replaced by the retrained one.
- **Hypothesis.** Roughly neutral on ranking order (same regret). Because
  its level is about 30% higher, the future term weighs a little more
  against measured cost. A small effect either way; adopted only if not
  negative, so the artifact matches the compiler it serves.
- **F rebuilt on D (`exp/gap-weighted-on-d`): not adopted (parked).**
  - V7, 8 seeds: **+6.3 [+3.8, +8.8], > 0.99**; 17 of 22 specs up.
    - Air rms −0.007 (P6 −0.028).
    - Categories: P6 +25.0, P7 +11.1, P1 +7.8, but groove −8.0 (Amor spec
      −18.1). Explicit requests −4.9. Strong extra hits +0.010 per beat.
  - Groove and explicit losses are strength first (+5.3e-4 of rms²), then
    speed (+2.0e-4), against air −2.0e-4.
  - **Held out: −4.0 [−6.6, −1.4], < 0.01; 4 of 5 specs down**
    (voice-drums −10.8, Trouble −8.5).
  - Reading: the V7 gain comes from the long-gap categories; new music
    behaves like the groove specs and loses. The weighting matches the
    headline's own exactly (span against impact = gap length against mean),
    so the loss likely comes from parts tuned on unweighted costs: the
    learned future estimate and the arrival priors' scale.
  - To revisit with a value model retrained under this weighting.

### J. More search effort at catches with strong asks (October's L9, restored smoothly)
- **Change.** An interval's local sample counts are scaled by
  1 + 0.3 × steepArrival(its catch's ask): the same smooth step from ask 0.4
  to 0.8 that the steep-arrival prior uses. The construction-rate estimate
  accounts for it. The allowance is shared, so other intervals pace down.
- **Hypothesis:**
  - strength error on asks 0.6+ falls (the pool's best rises with more
    samples where the options stop short);
  - headline +1 to +3;
  - no ride lost.
- **Risks:**
  - It starves later intervals (the 108 s ride).
  - 0.3 is carried over from October, not re-derived.
