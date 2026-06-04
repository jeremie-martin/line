# Arc Placement Design Notes

For the active campaign charter, boundary definition, and workbench commands,
see `../GOAL_LDS_ARC_PLACEMENT.md`.

## Why this exists

The current compiler has an impact-anchored arc placer in
`scripts/v0/arc_placement.ts`. It predicts rider state at a target contact frame,
chooses a point along a sampled arc, translates the whole arc so that point meets
the predicted sled, and then validates the result in the engine.

That is a reasonable first approach, but the recent `impactCenter = 0.6` episode
showed that the current abstraction is too brittle. The real goal is not to tune
one constant. The real goal is an efficient, robust arc-placement algorithm.
Predicting rider/sled state at the intended contact time is still the right core
idea; `impactCenter` is only one possible way to use that information.

## Current default placer

For each candidate catch, the compiler currently:

1. Reads predicted rider state at `gap.endFrame` from the prefix engine.
2. Picks the lowest sled point (`PEG`, `TAIL`, `NOSE`, or `STRING`) as the
   intended contact anchor.
3. Samples a local arc shape: length, segment count, start angle, end angle, and
   curve bias.
4. Samples `impactT` around a global `impactCenter` (`0.6` today).
5. Computes the local point/tangent at that along-arc fraction.
6. Translates the whole arc so the local impact point sits under the predicted
   sled, with small tangent/normal jitter.
7. Rejects candidates that risk pre-target sled contact.
8. Validates the candidate in lr-core: survival margin, owned landing at
   `gap.endFrame +/- 1`, no off-beat landings, then axis measurement/ranking.

This makes placement arc-centered: first sample an arc, then decide where on
that arc the rider should hit.

## Experimental first attempt: impact-frame arc

The first implementation probe was feature-gated behind:

```sh
LR_ARC_PLACEMENT=impact_frame
```

Unset `LR_ARC_PLACEMENT` still uses the current default placer. `uniform` still
opts out to the old wide anchor-box sampler plus anchor-Y bisection path.

`impact_frame` is intentionally a diagnostic bridge, not a replacement API. It
still emits the existing `Arc` type so the rest of the compiler, preclear gate,
direct validation path, and handoff ranking remain unchanged. The difference is
where the sampled degrees of freedom live:

1. Keep the same sampled length and segment count budget as the current placer.
2. Read the predicted sled point, velocity, speed, target axes, and gap duration.
3. Choose an intended contact tangent from incoming velocity and air target.
4. Choose an intended post-contact/exit tangent separately from that contact
   tangent.
5. Choose a small curve bias and a derived `impactT` from local pressure
   signals such as short deadlines and high speed.
6. Solve the arc start/end angles so the polyline segment at the intended
   impact frame has the chosen contact tangent.
7. Translate the arc so the derived local impact point lands at the predicted
   sled point, with small tangent/normal jitter.

That makes `impactT` derived-ish bookkeeping rather than the only knob carrying
tangent, curvature, pre-contact geometry, and support length. The current probe
does not yet expose separate pre-contact and post-contact lengths; it is a
minimal bridge that asks whether moving tangent control into the impact frame
opens a more robust viability basin without changing downstream validation.

The first guarded implementation applies this impact-frame sampler only to the
normal candidate stream. Specialized `brake` and `air_support` streams keep
their existing start/end angle and curve-bias families, then use the current
impact-anchored translation/validation path. This avoids counting generic
impact-frame shapes as brake or air-support work before those stream-specific
impact-frame profiles have explicit physical controls.

In targeted golden probes this was catastrophically worse than the default. It
increased the number of preclear-safe direct attempts, but those attempts mostly
failed to produce the owned landing at the target frame. The useful lesson was
not the specific formula; it was that solving tangent at an `impactT` on a
single arc still leaves pre-contact clearance and post-contact support coupled
through arc length/shape.

## Experimental second attempt: contact-centered lines

The next guarded probe is:

```sh
LR_ARC_PLACEMENT=contact_centered
```

It is normal-stream-only. Steep catch templates still emit their tuned arcs, and
the specialized `brake` and `air_support` streams still use their existing
mode-specific arc families.

`contact_centered` stops pretending that the placement primitive must be an
`Arc`. It samples a small polyline directly around the predicted contact point:

1. Read the predicted lowest sled/contact point, velocity, speed, target axes,
   and gap duration at `gap.endFrame`.
2. Choose a contact tangent from incoming velocity and target air.
3. Convert authored target speed to raw px/frame when `speed` is targeted, then
   compare it to predicted raw speed. Overspeed becomes explicit brake pressure;
   underspeed becomes explicit acceleration pressure.
4. Choose an explicit short pre-contact clearance/brake length.
5. Choose an explicit post-contact support length.
6. Choose a segment length from target grain when present, otherwise from a
   broad local range.
7. Build pre-contact solid lines that end exactly at the contact point.
8. Build post-contact solid lines that begin exactly at that same point.
9. Validate those lines with the same preclear, owned landing, survival,
   off-beat, axis measurement, and ranking gates as arc-backed candidates.

The first version intentionally consumes the same eight RNG draws as the
non-uniform arc placers on non-steep normal attempts:

- segment length;
- contact tangent;
- pre-contact length;
- post-contact length;
- pre-contact tangent jitter;
- post-contact tangent jitter;
- tangent-axis contact-point jitter;
- normal-axis contact-point jitter.

This makes the local controls more interpretable than `impactCenter`. There is
no arc-local `impactT` in the emitted primitive; the contact seam is literal
geometry. Arc-backed code still records `arc`, while line-native fits record
`arc: null` and `geometry: "lines"`. Catch reuse translates either source arc or
source lines by the stored sled-reference delta and revalidates the candidate.

Line-native candidates also get a release-state ranking term. After a candidate
lands, the evaluator samples rider speed at a release frame shortly after the
contact (normally eight frames later, clipped before the next authored contact).
If `speed` is targeted, the candidate cost converts release speed back into the
authored speed scale and adds a small penalty for being away from the target.
This is deliberately not a
direction-to-next-beat heuristic and not a hard gate. It only says: after the
catch, the rider should be alive and moving at roughly the intended speed. The
shape of the next jump remains the next candidate's job.

The second contact-centered iteration separates absolute raw speed from authored
speed error. Absolute high speed can still shorten clearance-sensitive
pre-contact geometry, but it no longer substitutes for target-aware braking.
When predicted raw speed is above the authored target's raw px/frame mapping, the sampler progressively
lowers the entry/contact tangents and gives the pre-contact section some extra
length to bleed speed. The post-contact tangent does not keep steepening uphill;
it recovers toward a flatter ride-out angle so braking remains local and the
rider can still traverse to the next beat. The response is intentionally soft:
one contact should bias speed, not try to correct the whole speed error at once
and destroy downstream reachability. When predicted speed is below the target,
it permits a more downhill contact. This keeps the control interpretable: it is
not a `solo_run` constant, it is a direct response to the speed axis.

## Why `impactCenter` is overloaded

`impactCenter` is the center of the `impactT` distribution. `impactT` is an
along-arc fraction, not a physical design parameter. In the current arc family,
moving it changes several independent physical properties at once:

- local catch tangent at the beat;
- local curvature/history around the beat;
- how much solid geometry exists before the intended impact;
- how much support remains after impact;
- which parts of the inserted geometry can collide with the rider before the
  beat.

Those are separate placement concerns, but today they are all coupled through one
number. That is why the constant is fragile. A small `impactT` shift can delete a
candidate from the viable pool rather than merely lower its quality, because the
downstream gates are binary.

## What the probes showed

The dense-spec probes showed that `0.6` is not a universal law. It is a viable
basin for the current sampled arc family.

- `0.6` lands the dense seed-0 probes that `0.5` misses.
- `0.5` fails by dropping one or two required contacts on dense rows.
- `0.2` often reduces preclear pressure, but mostly fails the direct landing
  path: the local shape presented at the beat does not produce the owned landing
  and ride-out the gates require.

So the failure is not simply "lower impact point creates early collisions".
Lower impact points can avoid preclear rejects, but with the current arc family
they usually present the wrong local tangent/curvature at the contact frame.

The removed `contact_style` axis also had a hidden generative role:

```text
impactCenter = 0.72 + (0.28 - 0.72) * contact_style
```

Removing that axis collapsed per-gap impact-point variation into one global
constant. That exposed a placement fragility that already existed.

## Better abstraction: impact-centered primitive

The replacement direction should be an impact-centered primitive, not a better
global `impactCenter` and not necessarily an `Arc`.

The placer should be impact-centered:

```text
given predicted impact state:
  choose local contact geometry
  emit an arc/track primitive around that contact
  validate in the engine
```

Primary inputs:

- predicted sled/contact point at `gap.endFrame`;
- incoming rider velocity at `gap.endFrame`;
- target axes for the gap, especially speed, air, and grain;
- optional local context such as gap duration and recent committed catch shape.

Explicit local controls:

- contact tangent relative to incoming velocity;
- pre-contact clearance length;
- post-contact support length;
- curvature/support shape around and after the beat;
- grain/segment length.

Derived bookkeeping:

- If the emitted geometry still has an arc-local fraction, compute `impactT`
  from the chosen pre/post lengths.
- Do not use `impactT` as the primary generative control.

Validation remains unchanged:

- pre-target proximity rejection;
- owned landing at the target contact frame;
- survival margin;
- no off-beat landings;
- normal axis measurement and handoff ranking.

## Experimental third attempt: continuous (one generator, no density gate)

```sh
LR_ARC_PLACEMENT=continuous
```

This is the first step toward removing the piecewise, threshold-gated family
selection. The default normal stream picks between three families by hard
cutoffs: steep-template arcs (`gapFrames >= 60`), impact-anchored arcs (global
`impactCenter`), and contact-centered lines (`nextGapFrames <= 22`). Those
cutoffs are exactly the gap-density overfitting the campaign warns against, and
no single family's constants can cross between regimes.

`continuous` uses ONE generator for every normal contact gap: the contact-centered
line family, with the `nextGapFrames <= 22` density gate removed. The line family
is the only one whose pre/post extents are decoupled from the contact tangent (so
it escapes the single-arc coupling between firm-landing, pre-impact clearance, and
post support that pins `impact_anchor`'s `impactT` near `0.6`), and its
post-support already scales continuously with the available downstream space. Brake
and air-support streams keep their own families. Steep templates are disabled for
the normal stream in this mode, so every normal attempt consumes the full,
non-template draw budget and the deterministic sample prefix is preserved.

Result (normal diagnostic, seeds 0/1/2): `CURVE 195.9`, `100k 485.5`, 30/30 valid
— slightly above gated `contact_centered` (`183.7`, `476.6`) and the highest
ceiling measured in the campaign (default `impact_anchor` saturates near `388`).
It is NOT promotable as the default: its CURVE is far below `369` because of slow
EARLY-budget convergence (50k `32`, 60k `167`), not poor yield (it finds MORE
viable catches per budget) or a low ceiling.

The remaining sub-problem is forward dependency. A line catch is placed for local
axis fit plus a release-SPEED penalty, but its release TRAJECTORY is not shaped for
WHEN the next beat arrives, so viable local catches chain slowly. The continuous
direction worth pursuing next is forward-aware ride-out: predict the candidate's
ballistic state at the next contact frame and shape/prefer catches that arrive
catchable (descending, moderate speed), continuous in time-to-next-contact rather
than gated by a density threshold. A first cadence-coupled exit shaping (ease the
ride-out toward a clean horizontal launch as the next beat nears) was neutral on
dense specs and was not kept.

## Diagnostic counters

Golden stats expose non-scoring placement counters under `arc_placement`. The
top-level counter and each sample stream (`normal`, `brake`, `air_support`)
record:

- sampled candidates;
- pre-target proximity rejects;
- direct validation attempts and landings;
- direct validation failures split as `survival`, `landing`, and `offbeat`;
- optional bisection fallback attempts and landings.

The direct failure split is the first diagnostic layer for comparing placement
families such as `impact_anchor`, `impact_frame`, and `contact_centered`. It
answers whether a placement family is mostly losing candidates before the beat,
at the owned-contact gate, after contact survival, or through off-beat
contamination. It does not change search behavior or consume extra simulation
work.

## Role of per-gap impact bands

A per-gap feasible `impactT` band is still a plausible incremental probe. It may
be useful as a diagnostic or bridge because it asks, "which along-arc fractions
survive for this gap geometry?"

It should not be treated as the final placement API. It keeps the arc-centered
parameterization and therefore preserves the overloaded knob. The structural fix
is to expose the local physical controls directly and let any `impactT` value be
derived from the chosen geometry.
