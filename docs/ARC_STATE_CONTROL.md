# Arc-state control — the aiming layer

2026-06-10 · branch arc-rewrite · canonical baseline `scoop-off-price-01`
(600.91). Companion: `IMPACT_PAIR_PLANNING.md` (the impact diagnosis this
work answered). Code: `scripts/v0/optimizer/aim.ts` (probes, models, the
proposer), `optimizer/arc_model.ts` (shared knob/model helpers),
`optimizer/readiness.ts` (the readiness metric), `optimizer/node.ts` (pool
wiring), `scripts/v0/study_joint_arc_model.ts` (read-only local-regression
evaluator).

**There is ONE aiming mechanism** — the enumerative proposer: knob deltas →
inner model predicts the current-gap consequences and the rider's end state
at the next beat → readiness metric on that predicted state → multiplied
with current-gap quality terms → top-k proposals through exact production
evaluation. The current production implementation is narrower: k=2,
per-knob quadratic fits, additive pitch+rotation composition, and only
next-beat speed/CoM-angle outputs in the live objective. Every hand-tuned
predecessor (V3 speed-aim, V4 angle-aim, the arrival-conditioned scoop
lane, the rotate fallback, the climb defer) was subsumed by it and deleted
once its ablation priced at ~zero. This unification is a design commitment
(Jérémie, 2026-06-10): trigger-based special-case lanes do not come back;
new capability goes into the inner model, the readiness metric, the
objective, or the sampler's template family.

The idea (Jérémie): when placing an arc we would ideally CONTROL the rider's
state — speed, trajectory direction, internal rotation — because the
interplay of speed, arrival angle and catch shape is what produces a landing
of the right intensity without losing the speed the next beat needs. Instead
of sampling arcs and hoping search finds one whose simulated arrival fits,
make small controlled modifications, learn the local response, and AIM.

This document separates three things deliberately: **§1 the concept** (the
design the system is built toward), **§2–§3 the current instance** (what is
implemented today — one simple realization of §1, not the architecture
itself), and **§4–§7 the evidence** (what has been validated, falsified, and
remains open — a snapshot, not permanent conclusions).

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
                                   │ invert: solve the knob value
                                   │ that hits a target
                                   ▼
                         PROPOSAL LANES — aimed candidate(s) into the pool
                                   ▼
                EXACT SIMULATION — tryCandidateLines: survival, landing ±1f,
                     off-beat, axis measurement, cost (no model error)
                                   ▼
                RANKING / SEARCH — local cost + forward-eval, unchanged;
                     consumes only measurements
```

Properties the concept requires (and the current instance has):

- **One probe ride = the full measurable output vector.** A probe is a
  metered ride of a perturbed candidate on a forked engine. Frame-state
  quantities (position, velocity, speed, CoM angle, pose, pose rate) are
  read from the same ride at no extra cost; a rich current-gap probe can
  also run the existing axis reducers once and get every defined axis and
  impact target together. Probe count therefore scales with the model order
  and knob-space design, not with the number of outputs.
- **Joint model interface; current per-knob implementation**: the
  architecture is a multi-input model over controllable arc knobs and
  predicted outputs. Today's production instance realizes that interface as
  per (knob, frame, quantity) scalar fits sharing rides, then additively
  composes pitch and rotation when the second knob is recruited. That is a
  current special case, not a ceiling: a learned combined surface or richer
  joint model can replace it behind the same proposer boundary. The additive
  instance is certified proposer-grade (~10% median interaction;
  re-verified AT the sweep argmax, 0.041 px/f / 0.63° p50 —
  `study_joint_enum`).
- **Error is priced.** Every emitted production proposal records readiness
  prediction error (`compile_stats.aim.*err*`). Richer model construction is
  evaluated offline by `study_joint_arc_model.ts`: fit on probe rows, then
  predict held-out simulated knob rows and report standard regression error
  per output.
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

| choice | why now | what would change it |
|---|---|---|
| two knobs: exit pitch everywhere + whole-arc rotation recruited lazily | rotation moves the catch surface (37% gate-fail when proposed freely — R3 v1 REJECT Δ−7.9), so it engages only at pitch exhaustion, within its probed span, behind a ≥15% predicted margin, in one non-displacing slot (R3 v2, promoted) | a third knob (e.g. arc depth/length) certified additive; or a model that predicts gate survival so rotation can compete everywhere |
| 3 probes per knob fit (quadratic) | the measured accuracy knee (V0 ladder: 2-probe linear ~3× worse, 5-probe cubic marginal) | telemetry showing model error is the binding constraint |
| top-k proposals, currently k=2 | the measured knee (k=1 −1.1: the 2nd pays; k=3 −4.5: the 3rd starves small budgets) | eval-cost or pool-pricing changes |
| readiness over (speed, comAngle) only | pose parked by R0 (flat to 90°, 4.2% incidence beyond) | new components validated against realized outcomes (R1 pattern) |
| quadratic model, scan sweep | exact through 3 points; 0.25° grid below model error | a quantity whose response is not locally smooth (only pose wrapping qualifies so far) |

### Relationship to the search

The proposer runs during POOL CONSTRUCTION (`node.ts sortWithLaneExtras`),
before ranking: proposals enter the same cost-sorted pool as the samples
and flow through the same local-cost pre-ranking, forward-eval re-ranking,
DFS and repair. The evaluation strategy of the search (greedy depth, branch
width, etc.) is orthogonal and stays swappable. Two coupling points matter:

- **Lookahead sees the proposer through pool membership.** branch=1 rollout
  pools exclude the probe-paying proposer (cost); making lane work visible
  *inside* rollouts at current eval prices was falsified three ways (§6) —
  the constraint is price, not principle.
- **The coupling law constrains knob placement.** Perturbing an arrival
  invalidates any already-evaluated catch behind it in the same prefix
  (±2° breaks the committed on-beat landing at 79% of gaps). So aiming
  lives where catches are still fluid — generation, where each candidate
  re-conditions on the actual probed arrival.

## 2. Prediction inventory — models as inputs → outputs

| # | inputs (knob) | outputs predicted | model | probes | used for | status · accuracy |
|---|---|---|---|---|---|---|
| 1 | exit pitch δp | (speed, CoM angle) at the next beat | quadratic per quantity | 3 (shared: base, ±6°) | the proposer's objective sweep | ON · readiness err mean ~0.012 live |
| 2 | whole-arc rotation δr | (speed, CoM angle) at the next beat | quadratic per quantity | 2 more (±3°; base shared) — paid LAZILY at pitch exhaustion | extends the sweep to 2-D where pitch clamps | ON (R3 v2) · additive composition with #1 |
| 3 | current production composed (δp, δr) | (speed, CoM angle) | additive sum of #1+#2; no pitch×rotation interaction term | shared | 2-D objective sweep where rotation is recruited | CERTIFIED proposer-grade; 0.041 px/f / 0.63° p50 at the argmax (`study_joint_enum`) |
| 4 | joint local-regression study (δp, δr) | current-gap targeted axes/errors/cost/impact + next x/y/vx/vy/speed/CoM angle/pose/pose-rate | configurable linear/additive quadratic/joint quadratic fits | configurable (`cross5`, `grid9`, `grid15`, eval grid/random) | evidence for the next production model | READ-ONLY (`study_joint_arc_model.ts`): fit on probe rows, evaluate on held-out simulated knob rows |
| — | any knob | sled pose (internal rotation) | state output, not readiness input today | free (same rides) | future readiness or aesthetic/rotation steering | SENSOR PLUMBED (`ProbeOutcome.sledPoseDeg`, `CandidateProbe.sledPoseDeg()`); V0: ~40° authority, locally smooth, globally wrapping — unwrap by continuity |
| — | any knob | current-gap axis VALUES and current impact when defined | measured per probe by the existing axis reducers | requires full rich probe simulation | future current-gap quality prediction | VIABLE per V2 for pitch; now included in `study_joint_arc_model.ts` for model-construction evaluation |

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

## 3. The production lane (default-on; `LR_AIM_ENUM=0` ablates)

**The enumerative proposer** (`makeEnumAimedCandidates`): fit speed+angle
next-beat models from 3 shared pitch probes; recruit the rotate knob lazily
(2 more probes) when the pitch sweep is boundary-clamped or empty-handed;
sweep the knob space inside the current additively composed models;
objective = readiness × speed-fit × impact-feasibility; top-k into the pool
(current k=2 measured knee), with at most one rotated proposal that must
clear a ≥15% predicted margin and never displaces the top pitch proposal.

Subsumption record (each predecessor deleted when its ablation priced ~0):
V3 speed-aim + V4 angle-aim triggers (ACCEPT Δ+3.3 → 600.71) · elevation
climb-defer (parity Δ−0.1 → 600.57) · additive two-knob production
instance promoted as lazy rotation (Δ+0.4 → 600.94) · arrival-conditioned
scoop lane (parity Δ−0.0 → 600.91; its
deep-catch geometry can return as a SAMPLER template if the impact axis
wants it back — `arc_placement.ts` SLAM-HOP is the surviving instance of
that family).

Telemetry (`compile_stats.aim`, archived, lab-queryable via `json_extract`):
proposer funnel (considered→emitted), readiness prediction accuracy, the
rotate split (`enum_rot_*`), and the **pool-rank instrument** (`aimed_*`:
`pool_entries`, `rank0`, `top3`, `rank_sum`, `pool_size_sum`) — where
proposals land in their cost-sorted pools, feeding the budget-shift
question (§7). Commit-level: `handoff_aimed_selected`.

## 4. Validated facts (snapshot, as of 2026-06-10)

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
- **Additivity**: 2-knob interactions ~10% of the combined effect at median (fine
  for a proposer), ~1× at p90 (never trust uncommitted).
- **Pose wrapping caveat**: pose is locally smooth but globally wrapping
  (1% of gaps show suspected ±180° wraps); pose models must unwrap by sweep
  continuity and track angular velocity. CoM velocity angle wraps only if
  the rider loops — not observed.

## 5. Score ledger (campaign)

| change | headline | archive |
|---|---|---|
| campaign baseline | 586.53 | aim-launch-on-01 baseline |
| V3 speed-aimed launch | 592.57 | aim-launch-on-01 |
| V4 dive-scoop pair | 597.92 | aim-impact-v4-02 |
| per-node scoop cache | 597.96 | aim-scoopcache-default-01 |
| prefix-cache lane fix | 597.41 | prefix-cache-lanes-01 |
| R2 enumerative proposer | 600.71 | aim-enum-r2-03 |
| climb-defer removed (parity, simplification) | 600.57 | enum-defer-off-01 |
| R3 joint multi-knob inner model (current lazy-additive v2) | 600.94 | aim-joint-r3-02 |
| scoop + legacy lanes deleted (parity, unification) | **600.91 (current)** | scoop-off-price-01 |

Suite: 40 specs × 12 seeds, budgets 50k–300k weighted; α=0.10 via `npm run
decide`. Impact still costs ~55 headline points (`npm run lab -- report
loss`) — the open prize.

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
- **Blanket steep arrivals** (`LR_IMPACT_ARRIVAL_FADE=0`): steep without a
  matched catch dilutes — superseded by the paired V4 design.
- **Sigmoid-reshaped readiness** (`enum-sigmoid-01`, σ((r−0.55)/0.10)):
  REJECT Δ−2.0, negative every budget. The "smooth veto" intuition double-
  counts: the raw surface already vetoes its low end (0.2–0.4) and the
  high-plateau gradient is the signal that pushes steep fast arrivals.
  Don't flatten a fitted surface that ranking depends on.
- **k≠2 proposals** (`enum-k1-01` Δ−1.1, mature budgets −2.1…−2.7;
  `enum-k3-01` Δ−4.5 REJECT, 50k −43.8): the second proposal pays its eval
  cost, the third starves small budgets. k=2 is the knee at current eval
  prices — revisit only if eval cost or pool pricing changes.
- **Eager always-on rotation in the two-knob sweep** (`aim-joint-r3-01`):
  REJECT Δ−7.9. Rotation's predicted-objective wins displaced 92% of pitch
  proposals and failed the on-beat-landing gate 37% of the time (~98k
  wasted evals); commits −34%. The model was accurate — the economics were
  wrong. Lazy recruit + probed span + margin + non-displacing slot (v2) is
  the surviving form.
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
3. **Promote the richer local model only after evidence.**
   `study_joint_arc_model.ts` is the workbench: choose a probe design,
   fit local regressions from knobs to current-gap outputs plus next rider
   state, evaluate on held-out simulated knob rows, and compare additive vs
   true joint surfaces. Production should move beyond next speed/angle only
   when this shows a stable accuracy/economics win.

## 8. Reproducibility

Studies (read-only): `scripts/v0/study_arc_sensitivity.ts`,
`study_aim_replay.ts`, `study_score_smoothness.ts`,
`study_knob_additivity.ts`, `study_impact_funnel.ts`,
`study_catchability.ts`, `study_joint_enum.ts`,
`study_joint_arc_model.ts`; artifacts under `generated/analysis/`.
Decision workflow: `LR_ENGINE=wasm npm run golden --
--jobs=32 --archive-dir=generated/golden-runs/<name>`, then `npm run decide
-- <candidate>/golden.json <baseline>/golden.json` (candidate first). After
any behavior or stats-key change: `LR_ENGINE=wasm npm run verify:optimizer
-- --update` + full test suite.
