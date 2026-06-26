# Arc Sampling Control

This note tracks the proposal-distribution work for the handoff compiler. The
goal is not merely to spend more candidates. The goal is to make the sampled arc
space explicit, controllable, and measurable so budget allocation can choose
between conservative local search and wider exploratory geometry.

## Current Sampler Shape

The production normal stream is the contact-centered sampler in
`scripts/v0/arc_placement.ts`. It is not one simple distribution. Each contact
candidate is built from several coupled mechanisms:

- **Candidate count**: `LR_QUALITY_NCAND` controls how many deterministic
  attempts from the per-gap candidate stream are considered.
- **Guided prefix**: early attempts are pulled toward target-conditioned centers
  for segment length, contact angle, pre/post lengths, pre/post angles, and
  contact-point jitter.
- **Attempt tail**: the guide weight decays with attempt index, so later attempts
  are already less centered than early attempts.
- **Low-discrepancy spans**: launch shaping and ride-out length use a 16-attempt
  low-discrepancy grid over `{launch, length}`.
- **Physical transforms**: speed, air, elevation, amplitude, impact, dense-gap
  pressure, and next-gap spacing reshape the sampled rolls into actual geometry.
- **Room/budget gates**: long ride-outs, impact arrival shaping, impact templates,
  and curvature behavior are gated by spacing and/or budget.
- **Extra streams**: reuse, brake, startup-catch, impact templates, and aim
  pitch/rotate proposals are additional lanes, not just wider normal samples.

Because of this, a single scalar "width" cannot characterize the true proposal
space. It can be useful as a probe, but it is not the final design.

## First Probe

`LR_CC_EXPLORE` is a study-only knob added as the first narrow probe. Default
`LR_CC_EXPLORE=1` is production behavior. Values above 1 widen only late
contact-centered attempts around roll center 0.5:

```text
tail = smoothstep((attempt - 16) / 16)
roll' = 0.5 + (roll - 0.5) * (1 + (LR_CC_EXPLORE - 1) * tail)
```

This deliberately keeps low-q prefixes conservative. In the smoke test, `q=16`
is unchanged across explore factors, while `q=32` changes.

Pilot archive:

```text
generated/studies/cc-explore-pilot-150k-s0-5
budget: 150k
specs: 12 representative golden specs
seeds: 0..5
q: 16,24,32,48
LR_CC_EXPLORE: 1,1.25,1.5,1.75
rows: 1,152
analysis: generated/studies/cc-explore-pilot-150k-s0-5/analysis.json
```

The result should be read as a weak characterization of one mechanism, not a
production decision:

- `q=16` is effectively unchanged, as designed.
- `q=24` improved on this pilot with mild widening: around +2.9 score at
  `x=1.25`, with first-completion and candidate ratios essentially unchanged.
- `q=32` regressed under this scalar widening on the aggregate pilot.
- `q=48` was mixed: `x=1.75` improved mean score versus `q=48,x=1`, but the
  gain was spec-sensitive and viability fell.
- Spec-level effects are large. For example, `syncopated_switchback` strongly
  benefited at `q=48,x=1.75`, while `dense_sprint` and `dense_echo_climb`
  regressed there.

Do not infer that "widening is bad" or "widening is good" from this probe. The
probe only says that a blanket late-tail roll multiplier is high-variance and
spec-dependent.

## Cleaner Control Model

A better sampler should separate count from proposal profile:

```text
budget/slack/difficulty -> q count
budget/slack/difficulty -> proposal profile
attempt index + profile -> named proposal lane + parameter vector
```

The proposal profile should expose named axes rather than one scalar:

| Axis | What It Controls | Why It Matters |
|---|---|---|
| landing pose | contact point jitter, entry angle, contact angle | Tight gaps are sensitive to landing misses and offbeat failures. |
| local catch geometry | segment length, pre length, pre angle | Controls catchability and pre-clearance. |
| ride-out length | post length, room-gated arc-length factor, air-targeted length | This is the main way to trade grounded time against airborne time. |
| launch shape | energy/elevation/amplitude/impact-arrival launch blend | Controls speed, elevation, amplitude, and next-beat impact setup. |
| curvature | post curve bias, impact front-load, impact post-turn | Controls through-window redirection and ride-out stability. |
| lane mix | normal, reuse, brake, startup, impact-template, aim pitch/rotate | Some useful arcs are categorically different, not merely wider samples. |

The attempt schedule should also be explicit. For example, a high-q pool could be
partitioned as:

```text
prefix: conservative target-centered samples
middle: standard low-discrepancy launch/length coverage
tail: named exploratory lanes with controlled widths
```

This keeps the deterministic prefix property while making the extra candidates
we buy with higher q intentional.

## Study Rules

Future probes should follow these rules:

- Keep production defaults byte-identical unless a study env var is set.
- Preserve deterministic prefix behavior whenever possible.
- Vary one or two named axes at a time; avoid opaque global multipliers as final
  policy.
- Use 150k for quick first-completion probes; use 200k when edge clipping could
  hide the response.
- Always analyze paired deltas against the same q and against `q=32,x=1`.
- Always include per-spec breakdowns. Aggregate score can hide large opposite
  effects.
- Track viability rate, first-completion ratio, candidate ratio, repair frames,
  and score delta together.

## Next Probes

The most useful follow-ups are:

1. **Ride-out/launch-only span**: vary only the `ccSpanBlends` influence on
   post length and launch shape. This tests the actual "arc space" dimension more
   directly than widening every roll.
2. **Landing-only span**: vary contact point jitter and contact/pre angles
   separately. This tests whether failures come from missing the landing surface
   versus from poor downstream trajectory.
3. **Curvature/template lane rate**: vary the late impact-template and curve-bias
   lane mix independently from ordinary geometry width.
4. **Profile schedules**: compare smooth tail schedules, fixed low-discrepancy
   strata, and lane partitions for the same q.

The likely final controller should not be `q -> wider range` directly. It should
estimate slack/difficulty, choose q, and choose an explicit proposal profile for
the extra candidates.
