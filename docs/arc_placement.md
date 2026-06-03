# Arc Placement Design Notes

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

## Current placer

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

## Better abstraction: impact-frame primitive

The next replacement attempt should be an impact-frame primitive, not a better
global `impactCenter`.

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

## Role of per-gap impact bands

A per-gap feasible `impactT` band is still a plausible incremental probe. It may
be useful as a diagnostic or bridge because it asks, "which along-arc fractions
survive for this gap geometry?"

It should not be treated as the final placement API. It keeps the arc-centered
parameterization and therefore preserves the overloaded knob. The structural fix
is to expose the local physical controls directly and let any `impactT` value be
derived from the chosen geometry.
