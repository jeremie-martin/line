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

### Objective Calibration

Future work should distinguish two related but different problems:

- **Component calibration**: whether a component's numeric value means what its
  name says. For example, catchability should be checked against empirical catch
  success with reliability curves / Brier or log loss; speed fit and impact
  feasibility should likewise be checked against their realized next-gap
  outcomes.
- **Utility shaping**: how much a calibrated component should influence search.
  In the multiplicative objective, power transforms are the clean first family:
  `component^gamma`. In log-objective space this is just a coefficient
  `gamma * log(component)`, so `gamma` is an interpretable search weight rather
  than an ad hoc squashing function.

This is broader than catchability. The candidate objective is a product of
current quality, catchability, speed fit, and impact feasibility; any one of
those terms may need separate calibration and a separate search-weight exponent.
The first safe study is offline, not a behavior change: log each scoreable
candidate-pool row with `currentQuality`, raw component values, cost/source
rank, selected rank, and later realized gap outcomes, then replay alternative
`gamma` vectors and monotone calibrators (identity, power, sigmoid/logit
temperature, isotonic) against rank flips and outcome proxies before spending a
golden A/B.

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

### Knob-model campaign (2026-06-12)

Six A/B arms vs baseline 611.7 (`LR_AIM_JOINT_PROBE_DESIGN` × `LR_AIM_MODEL_SPACE` ×
`LR_AIM_PROBE_MODE`). Δ is paired-bootstrap headline; model err is mean
`enum_readiness_err_mean`; probe frames is total charged.

| arm | Δ | model err | probe frames | verdict |
|---|---|---|---|---|
| latent × cross5 (baseline) | — | 0.0649 | 27.1M | — |
| latent × pitch3 | −0.8 | 0.0487 | 16.8M | INCONCLUSIVE |
| direct × cross5 | +0.6 | 0.0592 | 27.2M | INCONCLUSIVE (tightest CI [−2.9, 5.3]) |
| direct × pitch3 | −0.6 | 0.0481 | 16.8M | INCONCLUSIVE |
| fullsim × cross5 | −3.9 | 0.0286 | 68.1M | REJECT (P(Δ≤0)=96.5%, neg every budget) |
| fullsim × pitch3 | −1.2 | 0.0140 | 45.5M | INCONCLUSIVE |

Aim-off ablation (`LR_AIM_ENUM=0`): **REJECT Δ−7.8** CI[−14.2, −0.5]
(−9.8 / −7.0 / −7.2 at 100k/200k/300k, P≥99%). Funnel: aimed proposals land at
mean pool rank 2.5, 22% at rank 0, and ~60% of committed selections
(`handoff_aimed_selected`).

Truth study (`study_prediction_truth.ts`): error is **reduction-dominated, not
fit-dominated** — next.speed 0.079 px/f total vs 0.070 reduction floor; comAngle
0.85° vs 0.63° floor. Worst output is sled pose (~16°, reduction-limited).
latent ≈ direct everywhere except next.x (0.89 vs 1.60 px).

Conclusions:

- The lane is worth ~8 pts but is **saturated w.r.t. its prediction brain**:
  4× better model accuracy (fullsim) buys no score, so accuracy is not the
  binding constraint today.
- Full simulation **loses despite 4× accuracy** — empirical proof of the
  minimal-simulation rule: the extra physics frames cost more completion than
  the sharper aim returns.
- Future leverage lives in **proposal reach** (spans / knobs / bases), the
  **aim ↔ forward-eval interface**, and the **pose / reduction floor** (after
  which model accuracy may start to matter again).

Historical V1 reproduction (these archives are not V2 promotion evidence):

```text
# arms — vary the flags, archive, then decide vs baseline
LR_ENGINE=wasm LR_AIM_JOINT_PROBE_DESIGN=pitch3 npm run golden:v1 -- --jobs=32 --json --archive-dir=generated/golden-runs/pitch3-canon-01
LR_ENGINE=wasm LR_AIM_MODEL_SPACE=direct      npm run golden:v1 -- --jobs=32 --json --archive-dir=generated/golden-runs/direct-cross5-canon-01
LR_ENGINE=wasm LR_AIM_MODEL_SPACE=direct LR_AIM_JOINT_PROBE_DESIGN=pitch3 npm run golden:v1 -- --jobs=32 --json --archive-dir=generated/golden-runs/direct-pitch3-canon-01
LR_ENGINE=wasm LR_AIM_PROBE_MODE=full         npm run golden:v1 -- --jobs=32 --json --archive-dir=generated/golden-runs/fullsim-cross5-canon-01
LR_ENGINE=wasm LR_AIM_PROBE_MODE=full LR_AIM_JOINT_PROBE_DESIGN=pitch3 npm run golden:v1 -- --jobs=32 --json --archive-dir=generated/golden-runs/fullsim-pitch3-canon-01
LR_ENGINE=wasm LR_AIM_ENUM=0                  npm run golden:v1 -- --jobs=32 --json --archive-dir=generated/golden-runs/aim-off-canon-01
# decide each against baseline-shorthorizon-61175-20260612
npm run decide:v1 -- <cand>/golden.json <base>/golden.json
# truth study
LR_ENGINE=wasm npx tsx scripts/v0/study_prediction_truth.ts
```

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
  across dt buckets). A later two-seed prediction-truth recalibration rejected
  timing-, pose-, and kinematics-dependent corrections because their gains did
  not replicate across seeds. It also retested the disjoint-set `+0.043`
  constant as a source default. The old probe screen moved `-5.72` points
  (`506.24 -> 500.51`), while the canonical cached N=100 comparison moved
  `+0.97` (`512.82 -> 513.79`, SE `1.03`, interval `[-1.71, +3.65]`).
  Capability moved `-2.74`, including `-29.54` on the 7s low-air case. This
  was not convincing evidence of an improvement, so the compiler retained
  `+0.0345`. Lower isolated next-`vy` MAE did not reliably improve branch
  selection.

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

The multi-point readout question was subsequently tested. The equal aggregate
of the ten constrained body-and-sled points follows the discrete ballistic law
to floating-point precision during collision-free flight, whereas the public
six-body-point `rider.position` oscillates around it with the articulated
rotation. That aggregate is a useful physics oracle, but it is not a drop-in
production readout: ordinary "airborne" intervals can still contain body
collisions, and the response model and readiness targets are defined in the
six-point rider frame. Assembly-center and rotation-corrected production
variants reduced clean-flight error but worsened fitted next-state prediction
on the cross-regime panel. They were therefore retired rather than changing
the model's state definition.

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
