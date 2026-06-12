# Arc Aiming Formalization

Purpose: improve arc placement by adding a local aiming proposer on top of the
ordinary sampled-candidate compiler.

The aiming model is a proposer, not a physics judge. It predicts which small arc
modifications are worth paying to evaluate, but every emitted aimed variant still
passes through the normal engine simulation, gates, axis measurement, and search
ranking before it can enter a committed track.

The production objective has one source of truth:
`scripts/v0/optimizer/objective.ts`. It is always:

```text
gap_objective = current_gap_quality * next_gap_readiness
```

`current_gap_quality` is the scorer's axis-quality value for the current gap,
including `impact` when the current gap asks for impact. `next_gap_readiness`
is one scalar. Its current implementation is the product of three components:
catchability, next speed fit, and next impact feasibility.

## Compiler Flow

The production flow is:

```text
sample ordinary arcs
exactly evaluate sampled arcs
rank the exact pool by the shared objective
choose the best exact pool arc as the aim base
probe small controlled modifications around that base
fit a local response model
scan knob space inside the model
rank predicted variants by current-gap quality * next-gap readiness
exactly evaluate the top 2 distinct aimed variants per refined base
return a pool containing only exactly simulated candidates
rank/search those candidates from measured data
```

Current controllable knobs:

- `pitchDeg`: rotate the exit/tail part of the arc.
- `rotateDeg`: rotate the whole arc.

The top-k model output is only a spending decision: which extra geometries should
be evaluated exactly. Production refines up to three distinct pool bases at
mature budgets (`LR_AIM_TOPK_BASES=3`), and emits up to two aimed variants per
base. Once a candidate exists in the pool, the same objective is computed from
measured current axes and a measured or ballistic next-arrival state.
Predictions do not bypass the exact candidate gates.

The expensive aim proposer is still target-gated: it only runs when the next
contact has a speed ask or an impact ask. Catchability-only next gaps remain
scoreable by the shared objective for pool ordering, but they do not currently
pay joint-probe cost.

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

The next-gap readiness term answers whether the predicted arrival state is set
up for the next catch:

```text
next_gap_readiness =
  catchability(predicted next rider state)
  * speed_compatibility(predicted next speed, next speed target)
  * impact_feasibility(predicted next rider state, next impact target)
```

This whole product is called readiness in the current code and docs. The
subcomponents are kept visible for diagnostics and future replacement, but the
ranking API consumes the composite scalar. Pose is measured and modeled, but it
is not yet a readiness input. The catchability factor is clamped below at
`R_MIN = 0.1`, so a wrong catchability surface can rank variants down but never
veto everything. If the next gap has no speed ask or no meaningful impact ask,
that missing component contributes `1`, so readiness still scores catchability.

The shared gap objective is:

```text
objective(knobs) =
  current_gap_score(predicted current axes, current targets)
  * next_gap_readiness(predicted next state, next targets)
```

`current.cost` is not the model objective. It remains useful for diagnostics and
legacy compatibility, but the production quality ranking uses
`current_gap_quality * next_gap_readiness`.

The same objective is used in two production ranking places:

- model-only aiming sweep, with predicted current axes and predicted arrival;
- candidate-pool sorting, with exact achieved axes and a free or ballistic
  next-arrival state.

Non-forward handoff branch selection intentionally remains the older measured
handoff score: candidate local cost plus future-contact preview scarcity/cost,
state, overshoot, and release-setup penalties. Mature forward-eval branch
selection remains the true simulated partial-track score. Multiplying that
partial score by terminal frontier readiness was empirically rejected on
2026-06-12 (`debug-forward-readiness-off-slice-01` restored the focused slice to
parity with `stack-predict-topk3-01`), so readiness is not currently a
forward-eval judge term.

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
- canonical path: joint knob model fits direct auxiliary outputs plus
  suffix/prefix latents, then reconstructs reducer-owned outputs through the
  shared ballistic reducer;
- no response-mode switch remains in production or the study harness.

## Short-Probe and Latent Scope

Short probes simulate the current landing/catch and continue until the rider is
airborne past the arc-end plane. The observation row can contain:

- `latent.suffix.*`: frame, position, velocity, sled pose, pose rate;
- `latent.prefix.*`: air fraction, mean speed, vertical displacement, entry
  speed, and raw count/sum audit fields;
- direct final outputs for axes and diagnostics available from the probe.

In the canonical path, the reducer derives:

- current `air`;
- current `speed`;
- current `elevation`;
- next-arrival `x/y/vx/vy/speed/angle/pose/rate`;
- current-gap score from the final predicted axis vector;
- diagnostic `current.cost` from the final predicted axis vector when targeted
  axes are present.

Some outputs still need direct auxiliary predictions:

- `amplitude`: depends on the trajectory envelope across the gap, not suffix
  state alone;
- `impact`: is measured during the current landing/catch episode, not during
  post-exit free flight;
- `grain`: is geometry-only.

So the current canonical path is not `knobs -> one hidden state -> every output`.
It is:

```text
knobs -> suffix state + prefix summaries -> reducer-derived outputs
plus direct auxiliary outputs for quantities whose sufficient statistics are not
yet represented in the latent state
```

The study harness may attach full-simulation truth for evaluation; production
short probes never simulate to the next landing.

## Exit-State Readout and Calibrated Free Fall

The launch state the ballistic completion starts from is a READOUT, not the
ideal physical state. Measured on real free-flight stretches
(study_exit_readout.ts): the engine's `rider.velocity` oscillates frame to
frame with internal constraint dynamics (rms ~0.02 px/f per increment), and
the launch read after a catch systematically UNDERESTIMATES vy by a roughly
constant amount (a post-impact transient of the constrained body). Two
corrections, both validated out-of-sample on disjoint specs (together −10%
|dv| / −17% angle vs the raw single read):

- the short probe's launch velocity is a gravity-corrected average of up to
  4 consecutive airborne velocity reads (arc_probe.ts `readLaunchState`;
  engine states combined — no position differencing; zero extra charged
  frames, the averaged frames are already simulated);
- a constant launch-vy offset (`LAUNCH_VY_OFFSET_PX = +0.0345`, fitted on
  22.7k probe rows / 6 specs, +0.043 on the disjoint validation set, flat
  across dt buckets).

A cautionary negative result, kept on purpose: an "effective gravity"
correction (+0.0084 px/f² per frame, measured on committed-track airborne
stretches) was implemented first and FALSIFIED on probe trajectories — the
signed vy error there is constant in dt, not linear, so the deviation is a
launch-read transient, not an acceleration. The committed-track study's
per-run mean of `dvy − g` telescopes to an endpoint difference, which makes
a decaying transient masquerade as a per-frame bias. Next-arrival
propagation therefore uses PURE readout gravity; the span-axis completion in
measure.ts is untouched (fingerprinted evaluator surface; bias contribution
≤0.001 axis units).

Open question for later (deliberately not pursued yet): the readout we treat
as "the rider state" is one particular aggregate of a multi-point body. The
most USEFUL launch quantity is whichever best predicts next-catch readiness —
not necessarily the truest center of mass. Candidates when this is revisited:
a mass-weighted CoM over all body points, rotation-state-corrected velocity
(the residual free-fall deviation is rotation-dependent, and pose rate is
already a latent), or directly learning the readiness-relevant projection.

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
to 1, the sweep objective silently degraded to next-gap readiness only
(measured on the golden suite: 41% of gaps for cross5,
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
