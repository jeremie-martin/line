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

Probe designs: production defaults to the 5-row cross (`cross5`; pitch and
rotation probed separately around the base), with a 9-row grid opt-in
(`LR_AIM_JOINT_PROBE_DESIGN=grid9`). The study harness defaults to `grid9` —
when comparing study output against production behavior, pin the design
explicitly.

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

Pose is measured and modeled, but it is not yet a readiness input. The
catchability factor is clamped below at `R_MIN = 0.1`, so a wrong
catchability surface can rank variants down but never veto everything.

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

Both response targets share the SAME short probe (see the next section) and
identical probe cost. The choice is only where the fast physics reducer sits
relative to the fit.

Direct-output response (reduce-then-fit):

```text
knobs -> final output vector
```

Each probe row's final quantities are computed first — the reducer completes
the row's span axes and next-arrival state from the observed suffix — and the
model fits those final quantities directly.

Latent response (fit-then-reduce):

```text
knobs -> latent suffix state + prefix summaries
latent state + prefix summaries + fast physics reducer -> final output vector
```

The model fits the latent quantities instead — the rider state at the airborne
suffix plus prefix summaries needed for current-gap span axes — and the same
reducer runs at prediction time on the fitted latents to derive the
next-arrival state and reducer-derived current-gap axes.

Measured decomposition (study_latent_decomposition.ts over a
study_joint_arc_model dump; 153 golden gaps, both designs, 2026-06-11): the
reducer applied to MEASURED latents is near-exact (current axes ≤0.001,
next-state ≤0.6 px / 0.34°), so latent-mode error is dominated by the
knobs→latent fit layer — the same difficulty the direct fit faces. Net per
output: `elevation` is a ~5× latent win (reconstructing from fitted net-dy
beats fitting the normalized final directly); `next.x/y` is a latent loss
(~+30% MAE — two fitted quantities compound through vx·dt; position is not
an objective input); everything else is parity. Probe cost is identical by
construction and small: ~25 charged frames per probe row (the engine fork
shares the prefix; `aim.joint_probe_frames_charged` meters it), ~4% of a
100k compile, with ≤0.5% of budget left in further early-stopping.

The latent path has one structural robustness advantage: latents are
trajectory measurements, defined for every probe row whose airborne suffix
exists, including rows that fail the current-gap hard gates. Direct
current-gap outputs exist only for gate-passing rows. So under gate-failed
probe rows, the latent path keeps fitting its reducer-derived current axes
from full-rank data while the direct path loses rows (see "Gates,
Identifiability, and Degraded Sweeps" below). The corresponding caveat: latent
fits deliberately include gate-failed rows, whose reduced axes assume a
gate-clean ride; a wrong prediction there still costs only one wasted exact
evaluation, never a wrong track.

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

The study harness may attach full-simulation truth for evaluation; production
short probes never simulate to the next landing in either response mode.

## Gates, Identifiability, and Degraded Sweeps

Probe rows carry hard-gate outcomes (survival, on-beat landing within ±1
frame, no off-beat landings). Current-gap final outputs are only defined for
rows that pass these gates — the gate marks where the measured axes describe
an acceptable ride. Latent outputs are defined whenever the airborne suffix
exists, and next-arrival outputs whenever the suffix reaches the next frame.

Each per-output fit uses the richest functional form the gate-filtered rows
can identify: the design's first-choice form (surface / biquadratic /
quadratic, as historically validated per output), falling down a fixed ladder
to a linear floor at 3 rows. The floor guarantees by construction that a
single gate-failed probe row cannot erase an output model. Without it, the
zero-slack 5-row cross design lost every current-axis model whenever one row
failed a gate — and because axis quality over an empty error set defaults
to 1, the sweep objective silently degraded to readiness × speed-fit ×
impact-feasibility (measured on the golden suite: 41% of gaps for cross5,
~5% for grid9, whose 9 rows have slack).

When even the linear floor cannot fit (fewer than 3 usable rows), the sweep
runs without the missing outputs. Degradation is always recorded, never
silent (`compile_stats.aim`):

- `joint_probe_current_ok` / `joint_probe_next_state_ok`: per-row hard-gate
  pass counts over short probe rows — the upstream cause;
- `joint_fit_degraded_outputs`: output models fitted below their first-choice
  form;
- `enum_current_axes_targeted` / `enum_current_axes_modeled` /
  `enum_current_term_missing`: per-sweep targeted-axis model coverage, and
  the count of sweeps whose objective lost the current-gap term entirely.
