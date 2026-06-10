# Arc-state control — the aiming layer

2026-06-10 · branch arc-rewrite · canonical baseline `prefix-cache-lanes-01`
(597.41). Companion: `IMPACT_PAIR_PLANNING.md` (the impact diagnosis this
work answered). Code: `scripts/v0/optimizer/aim.ts` (probes, models, lanes),
`optimizer/node.ts` (pool wiring), `arc_placement.ts`
(`buildArrivalScoopLines`).

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
the committed prefix)          at compile time, from         · rider state (speed, CoM
+ knobs: controllable          a few probe rides             angle, position) at a frame
arc modifications                                            · sled pose (internal rotation)
(exit pitch, rotation, …)                                    · score components (in principle)
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

- **One probe ride = the full output vector.** A probe is a metered ride of
  a perturbed candidate on a forked engine; ALL quantities at that frame
  (position, velocity, speed, CoM angle, pose) are read from the same ride
  at no extra cost. Probe count therefore scales with the model order per
  KNOB, never with the number of outputs — predicting n quantities does not
  need n+1 probes.
- **Per (knob, frame, quantity) fits** (`fitKnobQuantity`): outputs live at
  different frames (release frame vs next beat) and δ=0 points differ
  (sometimes a free existing measurement, sometimes a paid probe), so the
  model is a set of scalar fits sharing rides — not a monolithic predictor.
- **Error is priced, live.** Every emitted proposal records
  |predicted − simulated| (`compile_stats.aim.*err*`), so model quality is
  continuously measured in production, never assumed.
- **Swappable.** Nothing downstream knows a candidate was aimed (the
  `aimed`/`scooped` flags are telemetry). Model order, probe count, knob
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
| tail-only knob (exit pitch) in production | safe-first: whole-arc rotation moves the catch surface, and as a BLIND fallback behind an already-evaluated catch it broke landings (−2.2, §6) | a knob that disturbs the current gap is usable if its disturbance is re-gated/priced — which the mandatory production evaluation already does; needs a lane design that re-fits the disturbed catch |
| 3 probes per fit (quadratic) | the measured accuracy knee (V0 ladder: 2-probe linear ~3× worse, 5-probe cubic marginal) | telemetry showing model error is the binding constraint |
| ≤1 extra candidate per lane | cost control for the first increments | evidence aimed candidates dominate selection (see the pool-rank instrument, §7) — then aim more of the pool |
| single-target solving | one knob aims one scalar; the validated increment | telemetry showing proposals win their target but lose selection on collateral axes — then the joint 2-knob solve (already certified proposer-grade, §4) graduates. A heuristic, not a gate. |
| quadratic model, scan solve | exact through 3 points; 0.1° resolution below model error | a quantity whose response is not locally smooth (only pose wrapping qualifies so far) |

### Relationship to the search

Lanes run during POOL CONSTRUCTION (`node.ts sortWithLaneExtras`), before
ranking: the aimed/scoop candidates enter the same cost-sorted pool as the
samples and flow through the same local-cost pre-ranking, forward-eval
re-ranking, DFS and repair. The evaluation strategy of the search (greedy
depth, branch width, etc.) is orthogonal and stays swappable. Two coupling
points matter:

- **Lookahead sees lanes through pool membership.** branch=1 rollout pools
  currently exclude the probe-paying aimed lane (cost) and include the
  scoop only via its per-node cache; making lane work visible *inside*
  rollouts at current eval prices was falsified three ways (§6) — the
  constraint is price, not principle.
- **The coupling law constrains knob placement.** Perturbing an arrival
  invalidates any already-evaluated catch behind it in the same prefix
  (±2° breaks the committed on-beat landing at 79% of gaps). So aiming
  lives where catches are still fluid — generation, where each candidate
  re-conditions on the actual probed arrival.

## 2. Prediction inventory — models as inputs → outputs

| # | inputs (knob) | outputs predicted | model | probes | inverted for | status · accuracy |
|---|---|---|---|---|---|---|
| 1 | exit pitch δ | release speed (px/f) at release frame | quadratic | 2 (δ=0 free: candidate's own releaseSpeed) | δ hitting NEXT gap's speed target | ON (V3) · `aim.pred_abs_err_mean` ≈ 0.03 px/f |
| 2 | exit pitch δ | CoM velocity angle (deg) at next beat | quadratic | 3 | δ hitting steep-arrival target = asin(ask·REDIR_CAP/speed)+4°, clamp 12–28° | ON (V4) · `aim.angle_pred_abs_err_mean` |
| 3 | scoop exit angle | hop apex reaching next beat (vy = −g·N/2) | closed-form ballistics | 0 | scoop exit geometry | ON (V4 scoop) |
| 4 | whole-arc rotation δ | release speed | quadratic | 2 | residual after pitch clamps | PARKED (−2.2 as blind fallback, §6) |
| 5 | (pitch, rotate) jointly | (speed, angle) | additive sum of single-knob fits | shared | two simultaneous targets | CERTIFIED proposer-grade, median 10% interaction, p90 tail ~1× — not in production (§1 heuristic) |
| — | any knob | sled pose (internal rotation) | — | free (same rides) | — | SENSOR PLUMBED (`ProbeOutcome.sledPoseDeg`, `CandidateProbe.sledPoseDeg()`); V0: ~40° authority, locally smooth, globally wrapping — model when evidence demands (§7) |
| — | exit pitch | current-gap + span axis VALUES | — | needs full evaluation per probe (expensive) | — | VIABLE per V2 (secant err ≤1% of range within gap, 1–6% cross-gap); architected for (a richer probe extends `ProbeOutcome`), not wired |

MEASURED EXACTLY (simulation, never modeled): every candidate's axis vector,
gates and cost (`tryCandidateLines`); the arrival state at each gap from the
committed prefix (`getCandidateProbe`, cached); forward-eval ranking;
everything the scorer sees.

The one quantity that CANNOT be predicted without its catch: **impact** — it
is the redirection at the next gap's not-yet-chosen catch, and arrival+catch
are a coupled pair (coupling law). The other span axes of gap k+1 are
determined by arc k's exit + ballistics and are probe-predictable without it.

## 3. Production lanes (all default-on; flags are ablations)

| lane | flag | what it does | promoted result |
|---|---|---|---|
| speed-aimed launch | `LR_AIM_LAUNCH=0` | aim pool's best at next gap's speed target via exit pitch | 586.53→592.57, Δ+6.0, CI [1.4, 11.2] |
| angle-aim mode | `LR_AIM_IMPACT=0` | on impact-ask (≥0.3) gaps the launch targets a STEEP arrival instead | shipped with scoop |
| arrival-conditioned scoop | `LR_AIM_IMPACT=0` | deterministic catch built from the ACTUAL arrival vector; turn sized to a next-beat hop, 8–40°; one eval per node, memoized (`_scoopCache`) | together: 592.57→597.92, Δ+5.4; 50k +43; impact \|err\| 0.1468→0.1430 |

Angle-aim + scoop ship together: a steep arrival without its matched catch
is the failed arrival-unfade experiment; a deep scoop without a steep
arrival does not convert to redirection (`IMPACT_PAIR_PLANNING.md` §3).

Telemetry (`compile_stats.aim`, archived, lab-queryable via `json_extract`):
per-lane funnels (considered→emitted), prediction accuracy, base-vs-aimed
target miss, and the **pool-rank instrument** (`aimed_*`/`scoop_*`:
`pool_entries`, `rank0`, `top3`, `rank_sum`, `pool_size_sum`) — where lane
candidates land in their cost-sorted pools, feeding the budget-shift
question (§7). Commit-level: `handoff_aimed_selected`,
`handoff_scoop_selected`.

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
- **Additivity**: 2-knob interactions ~10% of joint effect at median (fine
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
| prefix-cache lane fix | **597.41 (current)** | prefix-cache-lanes-01 |

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

## 7. Open problems (rough leverage order)

0. **The readiness program** — `READINESS_ROADMAP.md` (phase 2 of this
   document): a model predicting whether the arrival state (speed, CoM
   angle, POSE) sets the next gap up for success, used inside an
   enumerative proposer (sweep knob deltas inside the fitted models — free
   — propose the top few). Subsumes the V3/V4 lane triggers as special
   cases and adds the pose dimension generation is currently blind to.
   First rung: the catchability ground-truth study (R0).

1. **Selection (the C-share) + the budget-shift question.** Post-V4 funnel:
   A_not_generated 56%→35%, C_ranking_loses 32%→54%, D_works 8%. Deep
   candidates exist and lose forward-eval — and rollout visibility is not
   the answer (§6). The new pool-rank instrument (§3) now measures where
   aimed/scoop candidates land in their pools: if they dominate (high
   rank0/top3 share), budget should shift from sampling toward aiming
   (fewer samples, more aimed variants); if scoops rank poorly, the
   question becomes collateral-axes cost (the §1 multi-target trigger) vs
   genuine geometry quality.
2. **Sled pose at landing.** Sensor plumbed and free; if scoops
   under-deliver after the selection question, record pose at landing and
   test whether it predicts conversion residue (the catchability hypothesis:
   right CoM arrival, wrong internal rotation → crash or weak conversion).
3. **Direct axis-value aiming** for current-gap and span axes (V2: viable).
   Needs a rich probe (full evaluation per probe point) — architected for;
   becomes interesting if state proxies prove to be the accuracy
   bottleneck.

## 8. Reproducibility

Studies (read-only): `scripts/v0/study_arc_sensitivity.ts`,
`study_aim_replay.ts`, `study_score_smoothness.ts`,
`study_knob_additivity.ts`, `study_impact_funnel.ts`; artifacts under
`generated/analysis/`. Decision workflow: `LR_ENGINE=wasm npm run golden --
--jobs=32 --archive-dir=generated/golden-runs/<name>`, then `npm run decide
-- <candidate>/golden.json <baseline>/golden.json` (candidate first). After
any behavior or stats-key change: `LR_ENGINE=wasm npm run verify:optimizer
-- --update` + full test suite.
