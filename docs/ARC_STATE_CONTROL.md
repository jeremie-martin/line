# Arc-state control — the aiming layer

2026-06-11 · branch arc-rewrite · accepted canonical baseline
`scoop-off-price-01` (600.91). The working tree now contains the true joint
probe/model/proposer path described below. Its first full-next-state canonical
run (`joint-model-real-compiler-01`) was a real compiler integration but a
score regression (592.41, verdict REJECT). The current implementation keeps the
same joint output-vector interface but changes probe economics: probes simulate
only through the current catch/exit, then complete span axes and next-arrival
state with a ballistic suffix. Its first canonical archive
(`joint-short-probe-01`) scored 593.60 raw; `decide` refused the formal paired
comparison because the evaluator fingerprint changed when the measurement
module gained the suffix-aware reducer. The follow-up exit-plane suffix rule
(`joint-short-probe-exitplane-01`) scored 593.18 raw. Treat both as real
instrumentation and non-promotions until a same-fingerprint re-baseline says
otherwise. The current response model has one canonical contract: fit short
probe rows into direct auxiliary outputs plus suffix-state/prefix latents, then
reconstruct reducer-owned current axes and next-arrival outputs through the
shared ballistic reducer. Companion: `IMPACT_PAIR_PLANNING.md` (the impact diagnosis this work
answered). Code: `scripts/v0/optimizer/aim.ts` (the
proposer), `optimizer/arc_model.ts` (shared knob/model helpers),
`optimizer/arc_probe.ts` (shared real-engine probe evaluator),
`optimizer/objective.ts` (shared current-quality × readiness objective),
`optimizer/readiness.ts` (catchability component), `optimizer/node.ts` (pool
wiring), `optimizer/handoff.ts` (branch selection), and
`scripts/v0/study_joint_arc_model.ts` (read-only local-regression evaluator).

**There is ONE aiming mechanism** — the enumerative proposer: knob deltas →
inner model predicts the current-gap axes and the rider's end state at the next
beat → current-gap score is computed with the normal scorer's axis-quality
formula → next-gap readiness is computed from the predicted arrival state and
next-gap asks → top-k proposals through exact production evaluation. The shared
objective is `current_gap_quality * next_gap_readiness`, where readiness is one
composite scalar currently decomposed as catchability × speed-fit ×
impact-feasibility. The
accepted baseline instance used per-knob quadratic fits and
on-demand additive pitch+rotation composition. The current working-tree instance
uses the same proposer boundary but fits a shared joint response model from
five or nine short real probe rides and predicts current-gap axes plus the full
next-arrival rider state; `current.cost` remains diagnostic/search compatibility
data. Every hand-tuned predecessor (V3 speed-aim,
V4 angle-aim, the arrival-conditioned scoop lane, the rotate fallback, the
climb defer) was subsumed by the proposer boundary and deleted once its
ablation priced at ~zero. This unification is a design commitment (Jérémie,
2026-06-10): trigger-based special-case lanes do not come back; new capability
goes into the inner model, the readiness metric, the objective, or the
sampler's template family.

The idea (Jérémie): when placing an arc we would ideally CONTROL the rider's
state — speed, trajectory direction, internal rotation — because the
interplay of speed, arrival angle and catch shape is what produces a landing
of the right intensity without losing the speed the next beat needs. Instead
of sampling arcs and hoping search finds one whose simulated arrival fits,
make small controlled modifications, learn the local response, and AIM.

This document separates three things deliberately: **§1 the concept** (the
design the system is built toward), **§2–§3 the realized instances** (the
accepted baseline and the current working-tree joint experiment — realizations
of §1, not the architecture itself), and **§4–§7 the evidence** (what has been
validated, falsified, and remains open — a snapshot, not permanent
conclusions).

## 0. Terminology

- **CoM velocity angle** (`comAngleDeg`, `targetState.angleDeg`): the
  direction the rider's center of mass is MOVING (deg, +down). Says where
  the mass is going.
- **Sled pose / internal rotation** (`sledPoseDeg`, TAIL→NOSE): the
  direction the rider is POINTING. A different quantity: a perfect CoM
  arrival can still crash if the rider is rotated wrongly. Readable for
  free from any simulated frame (`sledPoseDegFromRider`); a first-class
  model output, not yet consumed by any decision.
- **Committed**: an arc in the current search path's prefix
  (`SearchNode.prefixFits`). Per-branch, not global: during forward-eval
  lookahead, a rollout has its own committed prefix. "The committed catch"
  means the catch already fixed in whatever prefix is being extended.
- **Charged rollout cost**: candidate evaluations billed against the compile
  budget inside forward-eval rollouts. The invariant about it (§1) says
  lanes must not silently multiply THAT — it does not say "don't simulate
  more".

## 1. The concept: a local predictive model

```
INPUTS                          MODEL                       OUTPUTS
current state (probe of    →   fitted per gap, per arc,  →  predicted quantities:
the committed prefix)          at compile time, from         · current-gap axis values,
+ knobs: controllable          a few probe rides               errors, impact, cost
arc modifications                                            · rider state (x/y/vx/vy,
(exit pitch, rotation, …)                                      speed, CoM angle) at a frame
                                                             · sled pose + angular rate
                                                             + error/residual estimates
                                                             · current-gap axis_quality,
                                                               computed from predicted axes
                                   │ invert: solve the knob value
                                   │ that hits a target
                                   ▼
                         PROPOSAL LANES — aimed candidate(s) into the pool
                                   ▼
                EXACT SIMULATION — tryCandidateLines: survival, landing ±1f,
                     off-beat, axis measurement, cost (no model error)
                                   ▼
                RANKING / SEARCH — measured handoff score or forward-eval;
                     consumes exact candidate measurements
```

Properties the concept requires (and both realized instances have):

- **One probe ride = the full predicted output vector.** A production probe is
  a metered ride of a perturbed candidate on a forked engine, but it no longer
  has to simulate all the way to the next gap. It simulates through the current
  landing/impact window and until the rider is observed airborne after crossing
  the arc-end plane, then uses that state as the suffix state. Current span axes
  (`air`, `speed`, `elevation`, `amplitude`) are reconstructed from measured
  prefix frames plus a contact-free ballistic suffix; `grain` is geometry-only;
  current `impact` is measured from the simulated landing window. The same
  suffix state is propagated to the next gap to predict
  `x/y/vx/vy/speed/CoM angle/pose/pose rate`. The current-gap objective term is
  then computed from those predicted axes with the same `axis_quality =
  exp(-rms(axis_error) / AXIS_QUALITY_TOLERANCE)` definition used by
  `scoreDriftReport`; only axes with both a target and a prediction participate,
  including `impact` when targeted. Probe count therefore scales with
  model order and knob-space design, not with the number of outputs or the
  next-gap distance.
- **One canonical response path owns probe reduction.** The model fits
  `latent.suffix.*` plus `latent.prefix.*` summaries and reduces them with the
  same ballistic logic as `measureGapAxesWithBallisticSuffix` to write final
  `current.axis.*`/`current.error.*`, `exit.*`, and eligible `next.*` outputs.
  `next.*` is emitted only when the predicted suffix/exit frame is not after
  the next beat. The proposer computes current-gap score from the final
  predicted axis vector; `current.cost` is recomputed from that vector only as
  compatibility/diagnostic data when targeted axes are present. `amplitude`,
  `impact`, and `grain` remain direct
  auxiliary outputs because amplitude depends on the prefix envelope, impact is
  the current landing episode, and grain is geometry.
- **Joint model interface; two concrete instances**: the architecture is a
  multi-input model over controllable arc knobs and predicted outputs. The
  accepted baseline instance realizes that interface as per-knob scalar fits
  sharing rides, then additively composes pitch and rotation when the second
  knob is recruited. The current working-tree instance realizes it as a true
  joint output-vector model fitted from shared pitch/rotation probe rows. Both
  keep the same proposer boundary: model predictions may propose candidates,
  but only exact simulation may validate them; measured candidates are first
  pool-sorted by the shared objective, then branch-ranked by the handoff score
  or by charged forward evaluation.
- **Error is priced.** Every emitted production proposal records readiness
  prediction error (`compile_stats.aim.*err*`). Richer model construction is
  evaluated offline by `study_joint_arc_model.ts`: fit on the same short-probe
  rows production uses, attach full-sim truth only for held-out eval rows, and
  report standard regression error per output. The harness also prints direct
  short-probe-output vs full-sim-truth MAE/p90 for the current axes, impact/cost,
  and next-arrival state.
- **Swappable.** Nothing downstream knows a candidate was aimed (the
  `aimed` flag is telemetry). Model order, probe count, knob
  set, output set, number of aimed candidates, single- vs multi-target
  solving — all are instance parameters. A learned prior, online updates,
  or a richer probe (e.g. full per-probe axis measurement) extend the same
  shape; none requires a rewrite.

### Invariants (architecture rules — each bought with a measured failure)

1. **Proposer, never judge.** Predictions only choose what to propose; every
   proposal is simulated exactly; ranking and commits consume only
   measurements. A wrong prediction costs one wasted candidate evaluation,
   never a wrong track.
2. **Determinism.** Lanes consume zero rng draws; lane candidates carry no
   `sampleAttempt` and live outside `sampleOrder` (the attempt-prefix
   property of the candidate cache stays intact).
3. **Budget honesty.** Probe frames are metered (`getRiderMetered`).
4. **No hidden charged-rollout cost.** A lane must not silently multiply the
   evals billed inside forward-eval rollouts (three falsifications, §6).
5. **Don't collapse pool diversity.** Aiming refines sampled families; the
   rest of the pool still competes ("aim many, rank as before").

### Current-instance choices — explicitly NOT invariants

| choice                                                           | why now                                                                                                                                                                                 | what would change it                                                                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| two knobs: exit pitch + whole-arc rotation                       | they are the available local actuators: exit pitch mostly changes the departure/arrival state, while whole-arc rotation also moves the catch surface and therefore has higher gate risk | a third knob (e.g. arc depth/length) certified by held-out probe studies and production economics |
| probe design: default five-point cross, optional nine-point grid | five probes are the cheapest joint design that identifies both knob axes; nine probes can estimate richer interaction/surface terms                                                     | telemetry showing model error, not eval cost or gate risk, is the binding constraint              |
| three refined bases, top-2 proposals per base                    | current production defaults; the model ranks many virtual variants before exact validation, then spends only the measured knee per base                                                  | eval-cost or pool-pricing changes                                                                 |
| catchability over (speed, comAngle); composite readiness adds target-aware speed/impact factors | pose parked by R0 (flat to 90°, 4.2% incidence beyond)                                                                                                                                  | new components validated against realized outcomes (R1 pattern)                                   |
| local response model + deterministic scan sweep                  | the model is only a proposer; the final candidate is still measured exactly                                                                                                             | a quantity whose response is not locally smooth or whose proposal economics regress               |

### Relationship to the search

The proposer runs during POOL CONSTRUCTION (`node.ts sortWithLaneExtras`),
before branch selection: proposals enter the same pool as the samples. The pool
is ranked by the shared current-quality × readiness objective; handoff branch
selection then uses the measured handoff score, or charged forward evaluation at
mature budgets. DFS and repair consume only exact candidate measurements. The
evaluation strategy of the search (greedy depth, branch width, etc.) is
orthogonal and stays swappable. Two coupling points matter:

- **Probe spending is target-gated.** The shared objective can score a
  catchability-only next gap, but the expensive aim proposer currently runs only
  when the next contact asks for speed or impact. Removing that gate is a budget
  policy change, not a refactor.

- **Lookahead sees the proposer through pool membership.** branch=1 rollout
  pools exclude the probe-paying proposer (cost); making lane work visible
  _inside_ rollouts at current eval prices was falsified three ways (§6) —
  the constraint is price, not principle.
- **The coupling law constrains knob placement.** Perturbing an arrival
  invalidates any already-evaluated catch behind it in the same prefix
  (±2° breaks the committed on-beat landing at 79% of gaps). So aiming
  lives where catches are still fluid — generation, where each candidate
  re-conditions on the actual probed arrival.

### Current compiler algorithm

This is the ordering in the real compiler. The names are load-bearing:

- **Sampled candidate**: an ordinary arc from the sampler, simulated and
  measured immediately.
- **Probe ride**: a temporary modified copy of the current best candidate,
  simulated only to collect model rows. Probe rides are not candidate-pool
  entries.
- **Aimed candidate**: a model-proposed modification, then simulated through
  the normal production gates. It enters the pool only if that exact
  simulation passes.

```text
build_candidate_pool(prefix_engine, current_gap):

  sample_order = []

  for attempt in deterministic_attempt_prefix:
    sampled_lines = sample_arc_family_candidate(...)
    candidate = tryCandidateLines(prefix_engine, current_gap, sampled_lines)

    if candidate passes survival, landing, off-beat, axis measurement:
      sample_order.append(candidate)

  sorted_pool = sort_by_exact_measured_cost(sample_order)

  if sorted_pool is empty:
    return []

  base = sorted_pool[0]

  probe_rows = []

  for knobs in joint_probe_design:
    # knobs = { pitchDeg, rotateDeg }
    # apply order = whole-arc rotation first, then exit-tail pitch
    probed_lines = applyArcKnobs(base.lines, knobs)
    row = evaluateJointArcKnobs(prefix_engine, probed_lines, current_gap)

    # row may include:
    #   mode=short, horizonFrame, suffixFrame, cleanAirborneSuffix
    #   current.cost
    #   current.axis.air/speed/grain/elevation/amplitude/impact where measured
    #   current.error.<axis> only for axes targeted by current_gap
    #   current.releaseSpeedPx/current.releaseVy
    #   next.x/y/vx/vy/speed/comAngleDeg/sledPoseDeg/sledPoseRateDegPerFrame
    #   latent.suffix.* and latent.prefix.* when a short suffix is available
    probe_rows.append(row)

  model = fitJointArcResponseModel(probe_rows, context)

  base_score = score_model_prediction(model, pitch=0, rotate=0)
  scored_knobs = []

  for pitch in dense_pitch_grid_inside_probe_span:
    for rotate in dense_rotate_grid_inside_probe_span:
      prediction = model({ pitch, rotate })
      predicted_next_state = predictedArrivalState(prediction)
      predicted_current_axes = predictedCurrentAxes(prediction)
      current_gap_score =
        axis_quality(current_gap.targets, predicted_current_axes)
      next_gap_readiness =
        max(r_min, catchability(predicted_next_state))
        * next_speed_target_fit(predicted_next_state.speed)
        * next_impact_feasibility(predicted_next_state, next_gap)

      value =
        current_gap_score
        * next_gap_readiness

      if value > base_score:
        scored_knobs.append({ pitch, rotate, value })

  chosen = top_2_distinct(scored_knobs)
  aimed = []

  for knobs in chosen:
    aimed_lines = applyArcKnobs(base.lines, knobs)
    candidate = tryCandidateLines(prefix_engine, current_gap, aimed_lines)

    if candidate passes the exact production gates:
      aimed.append(candidate)

  return sort_by_exact_measured_cost(sample_order + aimed)
```

Therefore the model is never the judge. It can only decide which two extra
geometries are worth paying to evaluate. The final sorted pool contains only
exactly simulated candidates.

### Short-probe observation

`evaluateJointArcKnobs` / `evaluateJointArcLines` is the shared source of
truth used by production and by `study_joint_arc_model.ts`. Production uses
`mode="short"` by default. The harness uses the same short row, and only adds
`includeTruth` full simulation beside it for scoring diagnostics.

Short mode is:

```text
full_horizon = max(gap.endFrame + 20, axisMeasureEnd + 20, nextFrame + 2)
min_exit     = gap.endFrame + max(16, IMPACT_WINDOW)
cap          = max(min_exit, nextFrame - 1)

for horizon in min_exit, min_exit+8, ... cap:
  det = detectWindow(prefix_engine + probed_lines, gap.startFrame, horizon)

  if probe crashed before horizon:
    stop at horizon

  if rider is airborne and past the arc-end plane at any frame >= min_exit:
    stop at horizon

arc_exit_plane =
  endpoint = last point of the last arc segment
  direction = normalized vector from the first arc point to endpoint
  # left-to-right reduces to rider.x > endpoint.x; other directions use dot

suffix_frame =
  first frame in [min_exit, horizon] where rider is airborne and
  dot(rider.position - endpoint, direction) > 0
suffix_state = read rider state at suffix_frame
cleanAirborneSuffix =
  true  if every observed frame suffix_frame..horizon is airborne
  false if suffix_frame exists but later contact appears before horizon
  null  if no suffix_frame exists

current impact:
  measured directly from simulated current-landing frames

current span axes:
  prefix frames come from the detector through min(axisMeasureEnd, suffix_frame)
  air/speed/elevation/amplitude after suffix_frame use contact-free ballistic
  propagation from suffix velocity until axisMeasureEnd; dirty suffix rows still
  emit this modeled output, but are separated in harness diagnostics
  grain remains geometry-only

next rider state:
  ballistic propagation from suffix_state to nextFrame
  including x/y/vx/vy/speed/CoM angle and sled pose if pose rate is available

telemetry:
  horizonFrame, suffixFrame, cleanAirborneSuffix
  plus compile_stats.aim aggregate rows/clean/horizon/full-horizon/saved frames
```

This is deliberately conservative about authority: it still simulates the
current landing and enough post-catch frames to observe an airborne suffix. A
"dirty" suffix is not a failed probe; it means the stop chunk found an airborne
frame but also observed later contact before the chunk ended. Production still
uses the modeled ballistic row, while the harness prints all-row and
clean-suffix error separately so this approximation is visible. The model does
not guess the catch impact, and it never lets a suffix prediction enter the
committed track without exact `tryCandidateLines` evaluation.

### Canonical response contract

`fitJointArcResponseModel` has one public prediction contract: return the final
output vector consumed by the proposer and the study harness. Internally it
always fits suffix state (`latent.suffix.frame/x/y/vx/vy/pose/rate`) and
normalized prefix summaries (`latent.prefix.airFraction`,
`latent.prefix.speedMeanPx`, `latent.prefix.dy`, `latent.prefix.v0SpeedPx`;
raw count/sum fields are also emitted for audit). Prediction reconstructs a
`BallisticAxisPrefixSummary`, calls the same pure reducer used by
`measureGapAxesWithBallisticSuffix`, and exposes the modeled exit state as
`exit.*`. If the predicted exit/suffix frame is after the next beat, `next.*`
is intentionally absent and aiming records `enum_next_before_exit` instead of
treating the model as a probe crash.

The important caveat is scope. The canonical path is not yet a pure
`knobs -> full hidden state -> all outputs` architecture: it intentionally
direct-fits `amplitude`, `impact`, and `grain` as auxiliary outputs. It then
computes current-gap score from the final predicted axis vector with the normal
scorer's axis-quality formula. `current.cost` may also be recomputed from that
vector for diagnostics/search compatibility, but it is not the model objective.
That is accurate to the current definitions: amplitude needs the prefix
trajectory envelope, impact is the simulated current landing episode, and grain
is geometry. Promoting more of those into the reducer requires adding the
missing latent sufficient statistics, not pretending suffix state alone is
enough.

## 2. Prediction inventory — models as inputs → outputs

| #   | inputs (knob)                             | outputs predicted                                                                                | model                                                                      | probes                                                      | used for                                                                  | status · accuracy                                                                                                                                         |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | exit pitch δp                             | (speed, CoM angle) at the next beat                                                              | quadratic per quantity                                                     | 3 (shared: base, ±6°)                                       | accepted-baseline proposer sweep                                          | ACCEPTED BASELINE · readiness err mean ~0.012 live                                                                                                        |
| 2   | whole-arc rotation δr                     | (speed, CoM angle) at the next beat                                                              | quadratic per quantity                                                     | 2 more (±3°; base shared) — paid on demand at pitch exhaustion | accepted-baseline 2-D sweep where pitch clamps                         | ACCEPTED BASELINE (R3 v2) · additive composition with #1                                                                                                  |
| 3   | accepted-baseline composed (δp, δr)       | (speed, CoM angle)                                                                               | additive sum of #1+#2; no pitch×rotation interaction term                  | shared                                                      | 2-D objective sweep where rotation is recruited                           | CERTIFIED proposer-grade; 0.041 px/f / 0.63° p50 at the argmax (`study_joint_enum`)                                                                       |
| 4   | current working-tree joint model (δp, δr) | current-gap axes/errors/impact when defined + diagnostic cost + exit state + eligible next x/y/vx/vy/speed/CoM angle/pose/pose-rate | shared hybrid response model with canonical suffix reducer | default five-point cross; optional 3×3 grid; short probe + ballistic suffix | production proposer in this branch: model sweep scored as current axis-quality × next readiness → top 2 exact evaluations per refined base | HOOKED INTO REAL COMPILER · full-next-state rejected 592.41; short-probe 593.60; exit-plane suffix 593.18; canonical suffix implementation awaits same-fingerprint promotion |
| 5   | joint local-regression study (δp, δr)     | same output vector as #4, plus full-sim truth diagnostics                                        | same canonical `fitJointArcResponseModel` as production                    | five-point cross or 3×3 grid; eval grid/random              | workbench for the production model                                        | READ-ONLY (`study_joint_arc_model.ts`): fit on short probe rows, evaluate on held-out full-sim truth rows                                                  |
| —   | any knob                                  | sled pose (internal rotation)                                                                    | state output, not readiness input today                                    | free (same rides)                                           | future readiness or aesthetic/rotation steering                           | SENSOR PLUMBED (`ProbeOutcome.sledPoseDeg`, `CandidateProbe.sledPoseDeg()`); V0: ~40° authority, locally smooth, globally wrapping — unwrap by continuity |
| —   | any knob                                  | current-gap axis VALUES and current impact when defined                                          | measured from prefix frames plus ballistic suffix where needed              | same short probe                                            | current-gap quality prediction                                            | ACTIVE in the joint output-vector model; direct short-vs-full truth errors printed by the harness                                                         |

MEASURED EXACTLY (simulation, never modeled): every candidate's axis vector,
gates and cost (`tryCandidateLines`); the arrival state at each gap from the
committed prefix (`getCandidateProbe`, cached); forward-eval ranking;
everything the scorer sees.

Current-gap **impact** can be measured and modeled when the current gap has
an impact target, because the modified arc is the catch that produces it.
The quantity that cannot be predicted from arc k alone is the NEXT gap's
impact: that redirection happens at a not-yet-chosen catch, and
arrival+catch are a coupled pair (coupling law). The other span axes of gap
k+1 are determined by arc k's exit + ballistics and are probe-predictable
without the next catch.

## 3. The production lane

**The enumerative proposer** (`makeEnumAimedCandidates`) is the single lane.
It has two realized inner-model instances:

- **Accepted baseline (`scoop-off-price-01`)**: fit speed+angle next-beat
  models from three shared pitch probes; recruit whole-arc rotation on demand
  with two additional probes only when pitch is exhausted; sweep the additive
  model; objective = composite readiness (catchability × speed-fit ×
  impact-feasibility); top-k into the pool.
- **Current working tree (`joint-short-probe-01` family)**: evaluate the
  shared short joint probe design around the best sampled candidate; fit a
  per-output response model for current axes plus full next-arrival rider
  state; sweep the 2-D knob grid inside the probed span; score =
  current-axis-quality × next-gap-readiness, where next-gap-readiness currently
  decomposes into catchability × speed-fit × next-impact-feasibility; simulate
  the top two distinct knob pairs per refined base through `tryCandidateLines`;
  add only exact passing candidates to the pool. The probe/model/proposer path is hooked into
  the real compiler; the previous full-next-state observation variant was
  rejected (592.41 vs 600.91), the first short-probe variant scored 593.60 raw
  in `joint-short-probe-01`, and the exit-plane suffix rule scored 593.18 raw
  in `joint-short-probe-exitplane-01`. Because the evaluator fingerprint
  changed, these are not formal `decide` verdicts; because they are still below
  600.91 raw, they are not promotions.

Subsumption record (each predecessor deleted when its ablation priced ~0):
V3 speed-aim + V4 angle-aim triggers (ACCEPT Δ+3.3 → 600.71) · elevation
climb-defer (parity Δ−0.1 → 600.57) · additive two-knob production
instance promoted as on-demand rotation (Δ+0.4 → 600.94) · arrival-conditioned
scoop lane (parity Δ−0.0 → 600.91; its
deep-catch geometry can return as a SAMPLER template if the impact axis
wants it back — `arc_placement.ts` SLAM-HOP is the surviving instance of
that family).

Telemetry (`compile_stats.aim`, archived, lab-queryable via `json_extract`):
proposer funnel (considered→emitted), readiness prediction accuracy, the
rotate split (`enum_rot_*`), and the **pool-rank instrument** (`aimed_*`:
`pool_entries`, `rank0`, `top3`, `rank_sum`, `pool_size_sum`) — where
proposals land in their cost-sorted pools, feeding the budget-shift
question (§7). The short-probe path also reports `joint_probe_rows`,
`joint_probe_clean_suffix`, `joint_probe_horizon_mean`,
`joint_probe_suffix_mean`, `joint_probe_full_horizon_mean`, and
`joint_probe_saved_frames_mean`, so canonical archives show where probes
stopped and the estimated per-row frame savings. Commit-level:
`handoff_aimed_selected`.

## 4. Validated facts (snapshot, as of 2026-06-11)

From V0 (`study_arc_sensitivity.ts`, 306 gaps × 3 knobs @300k), V1
(`study_aim_replay.ts`, closed-loop with production gates), V2
(`study_score_smoothness.ts`, production axis measurement),
`study_knob_additivity.ts`:

- **Locally linear map.** Within ±10° of a committed arc, arc→next-state has
  essentially no cliffs (secant err p50 0.6% of range for CoM state);
  ±10° sweeps survive at 97%+ of gaps. Chaotic in the large, smooth in the
  small — hence LOCAL models, fitted per gap per arc, no global model.
- **3 probes are the empirical knee.** Quadratic: arrival angle 0.31°/1.34°
  p50/p90 held-out, speed 0.02/0.07 px/f. One probe + population prior
  already aims to ~0.7° — per-gap probes mostly buy tail safety.
- **Closed loop verified with production gates** (V1): speed to 0.01–0.08
  px/f, steep-arrival to 0.43°/1.67°, ~100% survival + landing/off-beat
  compliance; gap k's own landing shifts exactly 0.00 under exit pitch.
- **Authority** (exit pitch): ~17° arrival angle, 1.4 px/f speed, ~40° pose
  per gap; steep arrivals (≥12°) reachable at 95% of gaps. Speeding up is
  authority-limited (31% clamped); slowing down nearly free.
- **The coupling law**: ±2° of arrival change breaks the committed next
  catch's on-beat landing at 79% of gaps (98% at ±10°).
- **Axis values are probe-predictable too** (V2): within-gap secant err ≤1%
  of range where the knob has authority; cross-gap span axes 1–6%. Gap k's
  own impact range under exit pitch is exactly 0.000.
- **Short probes now price their own approximation error.**
  `study_joint_arc_model.ts` fits on the same short rows production uses and
  compares held-out short outputs against full-sim truth. A broad six-spec,
  two-seed smoke (`cross5`, 306 groups, 30,600 held-out eval rows) reported
  short-vs-full truth errors of current speed MAE 0.001 axis units, elevation
  0.001, amplitude 0.004, impact 0.000, next-speed 0.048 px/f,
  next-CoM-angle 0.374 deg, and next-pose 2.957 deg.
- **The canonical suffix response is mechanically aligned, not yet promoted by
  a same-fingerprint baseline.** On the earlier broad harness slice, the suffix
  reducer path matched the previous direct-output path at `primary_loss=0.004` with 100%
  priority-output coverage. Its selected-model MAE was current air 0.009, speed
  0.001, elevation 0.002, amplitude 0.011, impact 0.009, current cost 0.014,
  next-speed 0.062 px/f, next-CoM-angle 0.684 deg, and next-pose 9.525 deg.
- **Additivity**: 2-knob interactions ~10% of the combined effect at median (fine
  for a proposer), ~1× at p90 (never trust uncommitted).
- **Pose wrapping caveat**: pose is locally smooth but globally wrapping
  (1% of gaps show suspected ±180° wraps); pose models must unwrap by sweep
  continuity and track angular velocity. CoM velocity angle wraps only if
  the rider loops — not observed.

## 5. Score ledger (campaign)

| change                                                      | headline                       | archive                      |
| ----------------------------------------------------------- | ------------------------------ | ---------------------------- |
| campaign baseline                                           | 586.53                         | aim-launch-on-01 baseline    |
| V3 speed-aimed launch                                       | 592.57                         | aim-launch-on-01             |
| V4 dive-scoop pair                                          | 597.92                         | aim-impact-v4-02             |
| per-node scoop cache                                        | 597.96                         | aim-scoopcache-default-01    |
| prefix-cache lane fix                                       | 597.41                         | prefix-cache-lanes-01        |
| R2 enumerative proposer                                     | 600.71                         | aim-enum-r2-03               |
| climb-defer removed (parity, simplification)                | 600.57                         | enum-defer-off-01            |
| R3 joint multi-knob inner model (accepted on-demand additive v2) | 600.94                         | aim-joint-r3-02              |
| scoop + legacy lanes deleted (parity, unification)          | **600.91 (accepted baseline)** | scoop-off-price-01           |
| true joint output-vector model in real compiler             | 592.41 (REJECT)                | joint-model-real-compiler-01 |
| short-probe joint output-vector model                       | 593.60 raw; no formal verdict  | joint-short-probe-01         |
| exit-plane short-probe suffix                               | 593.18 raw; no formal verdict  | joint-short-probe-exitplane-01 |

Suite: 40 specs × 12 seeds, budgets 100k/200k/300k weighted; α=0.10 via `npm run
decide`. Impact still costs ~55 headline points (`npm run lab -- report
loss`) — the open prize. A real compiler integration is not a promotion until
it beats the accepted baseline under `decide`. The short-probe archives changed
the evaluator fingerprint, so `decide` correctly refused to compare them to
`scoop-off-price-01`; the raw headlines are still useful for triage but not for
acceptance.

## 6. Falsified & parked (don't re-run without new conditions)

- **Whole-arc rotation as BLIND fallback** (`LR_AIM_ROT_FALLBACK=1`): best
  speed miss but gate_fail 1.2%→10.9%, Δ−2.2 — it moved the catch surface
  behind already-evaluated catches (coupling law). The knob itself is not
  banned; the blind use is.
- **Wider solve span** (`LR_AIM_SPAN=14`): Δ+0.3 INCONCLUSIVE. Speed-aiming
  is SATURATED — the clamp was the mechanism's bottleneck, not the score's.
  Lesson: a mechanism limit in telemetry does not imply score upside.
- **Rollout visibility for the scoop, three ways**: fresh eval per rollout
  pool (−3.8), per-node cached eval in rollout pools (−9.0 — rollout nodes
  are distinct prefixes, the cache cannot amortize), attempt-0 replacement
  (−29.5 — attempt 0 is the guided best sample). CLOSED at current eval
  prices; any revival must add ~zero charged evals AND not displace guided
  samples.
- **Blanket steep arrivals** (former arrival-fade override): steep without a
  matched catch dilutes — superseded by the paired V4 design.
- **Sigmoid-reshaped readiness** (`enum-sigmoid-01`, σ((r−0.55)/0.10)):
  REJECT Δ−2.0, negative every budget. The "smooth veto" intuition double-
  counts: the raw surface already vetoes its low end (0.2–0.4) and the
  high-plateau gradient is the signal that pushes steep fast arrivals.
  Don't flatten a fitted surface that ranking depends on.
- **k proposal sweeps** (`enum-k1-01`, `enum-k3-01`): current production emits
  two variants per refined base. The 2026-06-12 canonical replay showed the
  third emitted proposal regresses low-budget compiles while k=2 is
  bit-equivalent to `stack-predict-topk3-01`.
- **Eager always-on rotation in the two-knob sweep** (`aim-joint-r3-01`):
  REJECT Δ−7.9. Rotation's predicted-objective wins displaced 92% of pitch
  proposals and failed the on-beat-landing gate 37% of the time (~98k
  wasted evals); commits −34%. The model was accurate — the economics were
  wrong. On-demand recruit + probed span + margin + non-displacing slot (v2) is
  the surviving form.
- **True joint output-vector production lane, first attempt**
  (`joint-model-real-compiler-01`): HOOKED INTO REAL COMPILER but REJECT
  600.91 → 592.41, 95% CI [-15.4, -3.0]. The flow is architecturally correct
  (probe rows fit a joint model; model proposes; exact simulation judges), but
  the economics are wrong at current prices, especially at 50k. Do not treat
  "more predicted outputs" as automatically useful; it must either emit better
  candidates, spend fewer probes/evals, or avoid displacing the accepted
  baseline's cheap wins.
- **Short-probe joint lane, first archive** (`joint-short-probe-01`): the
  probe economics improved, but not enough. At the 300k checkpoint the archive
  recorded 314,500 joint probe rows, 97.28% clean airborne suffixes, mean short
  horizon 553.01f, former full horizon 573.61f, and 20.60 saved frames per
  probe row. Raw headline was 593.60, so the richer lane still has an economic
  problem even after avoiding most next-gap simulation.
- **Exit-plane suffix rule** (`joint-short-probe-exitplane-01`): requiring the
  airborne suffix to be past the arc-end plane was sound geometrically, but did
  not improve canonical economics. Raw headline moved 593.60 → 593.18; at 300k
  clean suffixes moved 97.275% → 97.218%, mean horizon 553.01f → 554.08f, and
  saved frames 20.60 → 20.41. It remains useful as a clearer definition of
  "outside the arc", not as a measured score win.
- **The scoop and legacy lanes as separate machinery**: not falsified —
  SUBSUMED. Their ablations under the promoted proposer priced at ~0
  (scoop Δ−0.0; legacy unreachable), and the design commitment (§ header)
  retires trigger-based lanes permanently. Any future catch-shaping value
  belongs in the sampler's template family or the readiness/objective side.

## 7. Open problems (rough leverage order)

0. **The readiness program R3+/R4** — `READINESS_ROADMAP.md`: richer
   readiness components validated against realized outcomes (the R1
   pattern); pose flair as an aesthetic steering target (low-risk per R0);
   the impact prize (~55 pts) via the objective/readiness side now that
   the scoop is gone.
1. **Selection (the C-share) + the budget-shift question.** Deep candidates
   exist and lose forward-eval — and rollout visibility is not the answer
   (§6). The pool-rank instrument (§3) measures where proposals land in
   their pools; commits via `handoff_aimed_selected`. If proposals dominate
   commits, budget should shift from sampling toward the proposer (fewer
   samples, more proposals) — R4, gated by the attempt-0 scar.
2. **Sled pose at landing.** Sensor plumbed and free; record pose at
   landing and test whether it predicts conversion residue if impact
   conversion stalls.
3. **Make the richer local model earn its eval cost.**
   `study_joint_arc_model.ts` remains the workbench for held-out model error,
   but `joint-model-real-compiler-01` and `joint-short-probe-01` proved that
   low prediction loss and cheaper observation are not enough by themselves.
   The next model iteration must report both model accuracy and production
   economics: probe cost, gate-fail rate, emitted candidate count, pool rank,
   commit rate, and budget-by-budget score. Production should move beyond the
   accepted additive baseline only when that whole package wins.

   Working prompt for the next model iteration: improve the local
   knob-response model and its proposal economics by editing
   `optimizer/arc_model.ts`, `optimizer/arc_probe.ts`, `optimizer/aim.ts`, and
   `study_joint_arc_model.ts`.

   Run both commands on the broader suite:
   `npm run study:joint-arc -- --specs=dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout --seeds=0,1 --budget=300000 --max-gaps=0 --probe-design=cross5 --eval-design=random --eval-samples=1000 --details=0`
   and the same command with `--probe-design=grid9`.
   The study uses the same canonical suffix-state/prefix-summary architecture
   as production.

   Optimize one scalar:
   `acceptance_loss = max(primary_loss_cross5, primary_loss_grid9)`.
   `primary_loss` is weighted held-out eval nMAE over current errors/cost
   and next rider state plus missing-output coverage penalty. Aim for
   `acceptance_loss < 0.01`; aspirational target `< 0.005`. `--max-gaps`
   limits gaps per compiled track; `0` means all confidently paired gaps.
   Commit only validated improvements that lower the acceptance loss without
   hiding worse gate coverage or fit-coverage gaps, then confirm with a real
   compiler golden/decide run. Include the two `primary_loss` values and the
   canonical verdict in the commit message or notes.

## 8. Reproducibility

Studies (read-only): `scripts/v0/study_arc_sensitivity.ts`,
`study_aim_replay.ts`, `study_score_smoothness.ts`,
`study_knob_additivity.ts`, `study_impact_funnel.ts`,
`study_catchability.ts`, `study_joint_enum.ts`,
`study_joint_arc_model.ts`; artifacts under `generated/analysis/`.
Decision workflow: use `npm run benchmark -- eval` for stage-0 screening and
`npm run benchmark -- eval --to-verdict` for certified confirmation. After
any behavior or stats-key change: `LR_ENGINE=wasm npm run verify:optimizer
-- --update` + full test suite.
