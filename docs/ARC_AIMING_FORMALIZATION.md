# Arc Aiming Formalization

Purpose: improve arc placement by adding a local aiming proposer on top of the
ordinary sampled-candidate compiler.

The aiming model is a proposer, not a judge. It predicts which small arc
modifications are worth paying to evaluate, but every emitted aimed variant still
passes through the normal engine simulation, gates, axis measurement, and search
ranking before it can enter a committed track.

## Compiler Flow

The production flow is:

```text
sample ordinary arcs
exactly evaluate sampled arcs
choose the best sampled arc in the local pool as the base
probe small controlled modifications around that base
fit a local response model
scan knob space inside the model
rank predicted variants by current-gap score * next-gap readiness
exactly evaluate the top 2 distinct aimed variants
return a pool containing only exactly simulated candidates
```

Current controllable knobs:

- `pitchDeg`: rotate the exit/tail part of the arc.
- `rotateDeg`: rotate the whole arc.

The top-k model output is only a spending decision: which extra geometries should
be evaluated exactly. The final pool is still sorted and searched from measured
candidate data.

## Objective

For each knob setting, the model predicts:

- current-gap axis values/errors: `air`, `speed`, `elevation`, `amplitude`,
  `impact`, and `grain` when available;
- next-arrival rider state: `x`, `y`, `vx`, `vy`, `speed`, CoM velocity angle,
  sled pose, and pose rate;
- diagnostic compatibility values such as `current.cost`.

The current-gap term reuses the scorer's normal axis-quality definition, applied
to predicted achieved axes:

```text
axis_error_rms = rms(target_axis - predicted_axis)
current_gap_score = exp(-axis_error_rms / AXIS_QUALITY_TOLERANCE)
```

Only axes with both a target and a prediction participate. `impact` participates
when the current gap has an impact target. Undefined axes, including the
currently disabled `grain` target, naturally drop out.

The next-gap term answers whether the predicted arrival state is set up for the
next catch:

```text
next_gap_readiness =
  catchability(predicted next rider state)
  * speed_compatibility(predicted next speed, next speed target)
  * impact_feasibility(predicted next rider state, next impact target)
```

Pose is measured and modeled, but it is not yet a readiness input.

The joint aiming objective is:

```text
objective(knobs) =
  current_gap_score(predicted current axes, current targets)
  * next_gap_readiness(predicted next state, next targets)
```

`current.cost` is not the model objective. It remains useful because the normal
search still uses exact measured `candidate.cost` after simulation, and because
some diagnostics compare predicted cost against full-simulation truth.

## Modeling Choices

There are two independent design axes.

### Response Target

Direct-output response:

```text
knobs -> final output vector
```

The probe produces final quantities of interest, and the model fits those
quantities directly.

Latent response:

```text
knobs -> latent suffix state + prefix summaries
latent state + prefix summaries + fast physics reducer -> final output vector
```

The probe stops near arc exit instead of simulating to the next landing. The
model predicts the rider state at the airborne suffix plus prefix summaries
needed for current-gap span axes. Fast ballistic equations then derive the
next-arrival state and reducer-derived current-gap axes.

### Knob Interaction

Per-knob/additive response:

```text
pitch model + rotation model -> composed prediction
```

Joint response:

```text
(pitchDeg, rotateDeg) -> prediction
```

These are independent choices. Direct-output or latent response can in principle
use either per-knob/additive or joint knob modeling.

Current implementation:

- accepted historical baseline: per-knob/additive response over a smaller output
  set;
- default path: joint knob model with direct final outputs;
- opt-in latent path: joint knob model with suffix/prefix response, enabled by
  `LR_AIM_JOINT_RESPONSE=latent`;
- study harness switch: `--response-mode=outputs|latent`.

## Short-Probe and Latent Scope

Short probes simulate the current landing/catch and continue until the rider is
airborne past the arc-end plane. The observation row can contain:

- `latent.suffix.*`: frame, position, velocity, sled pose, pose rate;
- `latent.prefix.*`: air fraction, mean speed, vertical displacement, entry
  speed, and raw count/sum audit fields;
- direct final outputs for axes and diagnostics available from the probe.

In latent mode, the reducer derives:

- current `air`;
- current `speed`;
- current `elevation`;
- next-arrival `x/y/vx/vy/speed/angle/pose/rate`;
- current-gap score from the final predicted axis vector;
- diagnostic `current.cost` from the final predicted axis vector when targeted
  axes are present.

Some outputs still need direct fallback predictions:

- `amplitude`: depends on the trajectory envelope across the gap, not suffix
  state alone;
- `impact`: is measured during the current landing/catch episode, not during
  post-exit free flight;
- `grain`: is geometry-only.

So the current latent path is not `knobs -> one hidden state -> every output`.
It is:

```text
knobs -> suffix state + prefix summaries -> reducer-derived outputs
plus direct fallback outputs for quantities whose sufficient statistics are not
yet represented in the latent state
```

The study harness may attach full-simulation truth for evaluation, but
production short probes do not need to simulate to the next landing in latent
mode.
