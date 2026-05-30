# Impact-Anchored Arc Placement

Status: POC, feature-flagged, not the default compiler path.

## Motivation

The old arc sampler spends much of its work on anchors that are geometrically
implausible. It samples an arc in a wide box near the rider, then bisects the
anchor Y until the engine produces a contact near the target frame. That works,
but it asks the physics engine to discover timing from many weak candidates.

For a gap that ends at a required contact frame, we already know the no-new-arc
trajectory from the current engine state. That gives us the rider state at the
target frame before placing the candidate. The impact-anchored idea is:

1. Simulate the current trajectory to the target frame.
2. Pick the sled contact point from that simulated state.
3. Sample an arc shape and an intended impact fraction along that arc.
4. Translate the arc so that intended arc point lies on the predicted sled
   point at the target frame.
5. Reject candidates that look likely to collide before the target.
6. Let the engine validate the candidate directly.

This does not remove physics validation. The math only creates a much better
candidate prior. The engine is still the source of truth for line side,
high-speed crossings, sled geometry, persistence, off-beat contacts, and axis
quality.

## Current Implementation

The implementation is in `scripts/v0/arc_placement.ts`.

The compiler integration points are deliberately small:

- `sampleArcParams(...)` in `scripts/v0/compile.ts` still samples length,
  segment count, start angle, end angle, and curve bias.
- When `LR_ARC_PLACEMENT=impact_anchor`, `sampleArcParams(...)` calls
  `sampleImpactAnchoredArc(...)` instead of sampling a wide anchor box.
- `tryCandidate(...)` validates impact-anchored candidates without anchor-Y
  bisection first.
- `hasPreTargetSledProximity(...)` rejects candidates whose generated lines are
  already close to sled points before `gap.endFrame - 1`.
- `LR_IMPACT_ANCHOR_FALLBACK_BISECT=1` enables the old bisection path only for
  impact-anchored candidates that fail direct validation.

Because `scripts/v0/optimizer/sample.ts` delegates to legacy
`sampleArcParams(...)` and `tryCandidate(...)`, the feature flag affects:

- legacy `compile(...)`;
- greedy_v2 / single-gap solver candidates;
- LDS leaf candidates;
- the default LDS legacy floor, because `compileLDS(...)` still seeds from
  `legacyCompile(...)` unless `floor: "none"` is used.

## Runtime Flags

Default behavior is unchanged.

```sh
LR_ARC_PLACEMENT=impact_anchor npm run golden -- --specs=tiny_dance --seed=0 --details
```

Optional comparison fallback:

```sh
LR_ARC_PLACEMENT=impact_anchor LR_IMPACT_ANCHOR_FALLBACK_BISECT=1 \
  npm run golden -- --specs=tiny_dance,mini_burst --seed=0 --details
```

Single-gap probe:

```sh
npx tsx scripts/v0/optimizer/_probe_impact_anchor.ts tiny_dance 0 32
```

The probe compares uniform placement against impact anchoring on the first
contact gap and reports survivor rate, best cost, simulated frames, wall time,
and impact-specific counters.

## Current Evidence

Fresh probe results after the module split:

| Spec | Mode | Survivors / K | Best Cost | Sim Frames | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| tiny_dance | uniform | 13 / 32 | 0.1431 | 1236 | baseline sampler |
| tiny_dance | impact_anchor | 2 / 32 | 0.3566 | 224 | direct only |
| mini_burst | uniform | 13 / 32 | 0.1115 | 1263 | baseline sampler |
| mini_burst | impact_anchor | 0 / 32 | n/a | 91 | direct only |
| mini_burst | impact_anchor + fallback | 1 / 32 | 0.7336 | 308 | fallback rescued one |

The encouraging signal is work reduction: the direct impact path can reject bad
candidates after a small pre-target check or a short validation. The risk is
survivor starvation: the current sampler still chooses impact fraction, tangent,
line side, and offsets too crudely.

End-to-end smoke results after the module split:

- default sampler on `tiny_dance,mini_burst`: passed 2/2, score 441.48.
- direct impact anchoring on `tiny_dance,mini_burst`: passed 2/2, score
  417.92.
- impact anchoring with bisection fallback on `tiny_dance,mini_burst`: passed
  2/2, score 435.73.
- `LR_ARC_PLACEMENT=impact_anchor npx tsx scripts/v0/golden.ts --lds --specs=tiny_dance --seed=0 --details`
  passed 1/1, score 790.70.

The `tiny_dance` direct golden run reported these impact counters:

```json
{
  "mode": "impact_anchor",
  "sampled": 690,
  "preclear_rejected": 373,
  "direct_attempted": 690,
  "direct_landed": 200,
  "direct_failed": 117,
  "fallback_attempted": 0,
  "fallback_landed": 0
}
```

## Design Direction

The clean production version should treat arc placement as a policy module, not
as more ad hoc branches in `compile.ts`.

The likely final shape:

1. Candidate shape sampling stays independent from candidate placement.
2. Placement policies expose a shared interface:
   `sample(shape, target_trajectory, targets, rng) -> Arc`.
3. Impact anchoring owns target-point choice, impact fraction choice, tangent
   alignment, jitter, and pre-clear checks.
4. `tryCandidate(...)` remains a validation pipeline, not a search algorithm.
5. Bisection becomes a compatibility fallback or ablation, not the main way the
   new policy finds timing.
6. Metrics stay first-class: sampled, pre-clear rejected, direct attempted,
   direct landed, direct failed, fallback attempted, fallback landed.

The next implementation work should improve the prior before widening the
benchmark:

- choose among PEG, TAIL, NOSE, and STRING instead of always using the lowest
  sled point;
- sample impact frame within a small window around the target frame;
- bias arc tangent by target velocity and desired contact style;
- make pre-clear less conservative by using engine-backed line collision
  windows or narrower sled-point checks;
- add per-gap survivor-rate and sim-frame summaries to golden JSON;
- run a fixed small benchmark matrix with direct-only and fallback modes.

## Acceptance Criteria

This should not become default until it satisfies all of these:

- no regression in golden pass rate on the selected smoke matrix;
- materially lower sim-frame cost per candidate or per passing compile;
- enough survivor rate that greedy/LDS search does not become brittle;
- deterministic output for identical `(spec, seed, flags)`;
- clear stats in JSON output for every impact-anchored compile;
- no hidden dependency on bisection for normal success.
