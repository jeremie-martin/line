# Arc-state control — the aiming layer

2026-06-10 · branch arc-rewrite · canonical baseline `prefix-cache-lanes-01`
(597.41, HEAD e926f1a). Companion: `IMPACT_PAIR_PLANNING.md` (the impact
diagnosis this campaign answered). Code: `scripts/v0/optimizer/aim.ts` (lanes,
probes, models), `optimizer/node.ts` (pool wiring), `arc_placement.ts`
(`buildArrivalScoopLines`).

The idea (Jérémie): instead of sampling arcs and hoping search finds one whose
simulated next-gap arrival fits, make small controlled modifications to an
arc, learn the local response of the next-gap rider state (CoM angle, speed,
sled pose), and AIM. This document is the canonical statement of the
architecture that idea produced, the evidence behind each design rule, and the
open problems. History lives in §7 and the git log; raw study artifacts in §8.

## 1. Architecture

Two prediction layers sit on one measurement substrate:

```
knobs ──(probe-fit local models)──▶ arrival STATE ──(production evaluator)──▶ axes/score
  │                                      │
  │ exit pitch δ (tail-only)             │ speed, CoM angle at next beat
  ▼                                      ▼
proposal lanes ──────────▶ exact simulation (tryCandidateLines) ──▶ ranking
  ≤1 extra candidate each      survival · landing ±1f · off-beat      local cost +
                               · axis measurement · cost              forward-eval
```

- **Probes** — forked, metered engine rides reading CoM state at a chosen
  frame (`probeRideState`). Crash ⇒ null; never fit through a crash.
- **Local models** — exact quadratics through 3 probe points (the base arc is
  the free δ=0 point), scan-solved over the validated ±10° span. Fitted per
  gap, per arc, at compile time. Never global: local linearity is
  near-perfect while global curvature is real (§4).
- **Lanes** — proposal builders adding at most one extra candidate to a pool:
  speed-aimed launch, angle-aimed launch (impact-ask gaps), and the
  arrival-conditioned scoop. Wired in `node.ts getCandidatesSorted`; lane
  extras are re-applied on prefix-cache hits (fix e926f1a).
- **Selection is untouched** — aimed candidates compete on measured cost and
  forward-eval like any sample; nothing downstream knows they were aimed
  (the `aimed`/`scooped` fit flags are telemetry only).

### Invariants (each bought with a measured failure)

1. **Proposer, never judge.** Predictions only choose what to propose; every
   proposal is simulated exactly; ranking and commits consume only
   measurements. A wrong prediction costs one wasted candidate evaluation,
   never a wrong track.
2. **Determinism.** Lanes consume zero rng draws; lane candidates carry no
   `sampleAttempt` and live outside `sampleOrder`, preserving the
   attempt-prefix property of the candidate cache.
3. **Budget honesty.** Probe frames are metered (`getRiderMetered`).
4. **Tail-only knobs.** Never move the catch surface of a selected arc: ±2°
   of whole-arc rotation breaks the committed on-beat landing at 79% of gaps
   (the coupling law, §4; rot-fallback verdict, §6).
5. **No charged-rollout multiplication.** A lane must not add per-rollout
   eval cost (three falsifications, §6).
6. **Aim within families, don't collapse diversity.** Aiming refines a
   sampled arc; the pool's other families still compete ("aim many, rank as
   before").

### Offline vs online

Offline (studies, `scripts/v0/study_*.ts`): establish smoothness, authority,
model accuracy, coupling — on committed tracks, read-only, falsifiable before
any compiler change. Online (lanes): only the operations the studies
validated, with live accuracy telemetry (`compile_stats.aim`,
lab-queryable) so model error is priced continuously, not assumed.

## 2. Prediction inventory

PREDICTED (local models, fitted from probes at compile time):

| # | quantity | model | probes | solved for | used by | accuracy (live) |
|---|---|---|---|---|---|---|
| 1 | release speed vs exit pitch δ | quadratic | 2 (±6°) + base free | δ hitting NEXT gap's speed target | speed-aimed lane (on) | `aim.pred_abs_err_mean` ≈ 0.03 px/f |
| 2 | CoM arrival angle at next beat vs δ | quadratic | 3 at next beat's frame | δ hitting steep target = asin(ask·REDIR_CAP/speed)+4°, clamp 12–28° | angle-aim mode (on) | `aim.angle_pred_abs_err_mean` |
| 3 | ballistic hop vy = −g·N/2 over N frames | closed form | 0 | scoop exit angle | `buildArrivalScoopLines` (on) | implicit in scoop rates |
| 4 | release speed vs whole-arc rotation | quadratic | 2 (±3°) | residual after pitch clamps | PARKED (−2.2, moves catch) | `aim.rot_fallback` |
| 5 | joint 2-knob additive (pitch+rotate) | sum of single-knob | k+1 | two state targets | NOT in production (median-accurate, tail unreliable) | — |

MEASURED EXACTLY (simulation, no model error): every candidate's axis vector,
gates and cost (`tryCandidateLines`/`measureGapAxes`); the arrival state at
each gap from the committed prefix (`getCandidateProbe`, cached); forward-eval
ranking; everything the scorer sees.

NOT modeled, deliberately: **impact from knobs directly** — it is the
redirection at the NEXT gap's not-yet-chosen catch; arrival and catch are a
coupled pair (§4), so impact cannot be scored against a stale catch. The
other span axes of gap k+1 (air/speed/elevation/amplitude over beat k→k+1)
ARE determined by arc k's exit + ballistics and are probe-predictable without
the next catch (V2 cross-gap rows: err/range 1–6%) — direct axis-VALUE aiming
is an open option, not yet a needed one. **Sled pose** — sensor and actuator
both validated (§4), waiting for evidence it is the residual bottleneck.
**Any global/learned model** — fit per gap, per arc, from probes.

Graduation rule for #5: multi-target prediction enters production only when
telemetry shows single-target proposals winning their own target but losing
selection on collateral axes. Until then one scalar per proposal + exact
evaluation has captured the value (+6.0, +5.4) at zero collateral cost.

## 3. Production lanes (all default-on; flags are ablations)

| lane | flag | what it does | promoted result |
|---|---|---|---|
| speed-aimed launch | `LR_AIM_LAUNCH=0` | aim pool's best at next gap's speed target via exit pitch | 586.53→592.57, Δ+6.0, CI [1.4, 11.2], positive every budget |
| angle-aim mode | `LR_AIM_IMPACT=0` | on impact-ask (≥0.3) gaps, the launch targets a STEEP arrival instead | shipped with scoop (below) |
| arrival-conditioned scoop | `LR_AIM_IMPACT=0` | deterministic catch built from the ACTUAL arrival vector; turn sized to a next-beat hop, 8–40°; one eval per node, memoized (`_scoopCache`) | together: 592.57→597.92, Δ+5.4, P(Δ≤0)=3.6%; 50k +43; impact \|err\| 0.1468→0.1430 |

The angle-aim + scoop pair must ship together: a steep arrival without its
matched catch is the failed arrival-unfade experiment; a deep scoop without a
steep arrival does not convert to redirection (funnel evidence,
`IMPACT_PAIR_PLANNING.md` §3).

Telemetry: `compile_stats.aim` (funnels considered→emitted for both lanes +
prediction accuracy + base-vs-aimed target miss), `handoff_aimed_selected`,
`handoff_scoop_selected` (selection-level win rates). Whitelisted in
`golden.ts compactStats` — archives keep it; the lab queries it via
`json_extract`.

## 4. Validated facts (the evidence the design rests on)

From V0 (`study_arc_sensitivity.ts`, 306 gaps × 3 knob families @300k),
V1 (`study_aim_replay.ts`, closed-loop, production gates), V2
(`study_score_smoothness.ts`, production axis measurement), and
`study_knob_additivity.ts`:

- **Locally linear map.** Within ±10° of a committed arc the arc→next-state
  map has essentially no cliffs (secant err p50 0.6% of range for CoM state);
  monotone; ±10° sweeps survive at 97%+ of gaps. Chaotic in the large,
  smooth in the small.
- **3 probes are the knee.** Quadratic fit: arrival angle 0.31°/1.34°
  (p50/p90 held-out), speed 0.02/0.07 px/f. One probe + population prior
  already aims to ~0.7° — per-gap probes mostly buy tail safety.
- **Closed loop verified with production gates** (V1): aim-and-apply hits
  speed to 0.01–0.08 px/f and steep-arrival to 0.43°/1.67° at ~100%
  survival + landing/off-beat compliance; gap k's own landing shifts by
  exactly 0.00 under exit pitch (tail-only knob is truly free).
- **Authority.** Exit pitch: ~17° of arrival angle, 1.4 px/f of speed, ~40°
  of sled pose (median per-gap range); steep arrivals (≥12°) reachable at
  95% of gaps. Speeding UP is authority-limited (31% clamped); slowing down
  nearly free.
- **The coupling law** (the central structural fact): perturbing arc k's exit
  by ±2° makes the COMMITTED catch at k+1 lose its on-beat landing at 79% of
  gaps (98% at ±10°). Arrival and catch are a pair; aiming must live where
  catches are still fluid (generation), and arrival-changing knobs must never
  be applied behind a frozen catch.
- **Scores are probe-predictable too** (V2): within-gap axes where the knob
  has authority, secant err ≤1% of range; cross-gap span axes err/range
  1–6%. Gap k's own impact range under exit pitch is exactly 0.000.
- **Additivity** (2-knob): median interaction residual 9–11% of the joint
  effect — fine for a proposer; p90 ~1× — never trust uncommitted.
- **Pose wrapping caveat.** Sled pose is readable (TAIL→NOSE vector),
  locally smooth, but globally curved/wrapping (1% of gaps show a suspected
  ±180° wrap; pose-aiming must unwrap by sweep continuity and track angular
  velocity). CoM velocity angle wraps only if the rider loops — not observed.

## 5. Score ledger (campaign)

| change | headline | archive |
|---|---|---|
| campaign baseline | 586.53 | aim-launch-on-01 baseline |
| V3 speed-aimed launch | 592.57 | aim-launch-on-01 |
| V4 dive-scoop pair | 597.92 | aim-impact-v4-02 |
| per-node scoop cache | 597.96 | aim-scoopcache-default-01 |
| prefix-cache lane fix | **597.41 (current)** | prefix-cache-lanes-01 |

Suite: 40 specs × 12 seeds, budget-weighted 50k–300k; α=0.10 via
`npm run decide`. Impact still costs ~55 headline points
(`npm run lab -- report loss`) — the open prize.

## 6. Falsified & parked (don't re-run without new conditions)

- **Whole-arc rotation as fallback** (`LR_AIM_ROT_FALLBACK=1`): best speed
  miss, but gate_fail 1.2%→10.9% and Δ−2.2 — it moves the catch surface
  (coupling law). Tail-only knobs are the safe family.
- **Wider solve span** (`LR_AIM_SPAN=14`): clamp 27%→17%, Δ+0.3
  INCONCLUSIVE. Speed-aiming is SATURATED: the clamp was the mechanism's
  bottleneck, not the score's. Lesson: saturate-then-stop — a mechanism
  limit in telemetry does not imply score upside behind it.
- **Rollout visibility for the scoop, falsified three ways**: fresh eval per
  rollout pool (v4-01, −3.8), per-node cached eval in rollout pools
  (`LR_AIM_SCOOP_ROLLOUT=1`, −9.0 — rollout nodes are distinct prefixes, the
  cache cannot amortize), attempt-0 replacement (`LR_AIM_SCOOP_ATTEMPT0=1`,
  −29.5 — attempt 0 is the guided best sample, replacing it starves
  everything). CLOSED. Any future visibility idea must add ~zero charged
  evals AND not displace guided samples.
- **Blanket steep arrivals** (`LR_IMPACT_ARRIVAL_FADE=0`, pre-campaign):
  steep without a matched catch dilutes — superseded by the paired V4 design.
- **Joint 2-knob aimer**: certified median-accurate, tail-unreliable; parked
  behind the graduation rule in §2.

## 7. Open problems (in rough order of leverage)

1. **Selection (the C-share).** Post-V4 funnel (477 impact gaps @300k,
   `generated/analysis/funnel_after_v4.txt`): A_not_generated 56%→35% (the
   scoop fixed generation), C_ranking_loses 32%→54%, D_works flat 8%. Deep
   candidates now exist and still lose forward-eval — and rollout visibility
   is NOT the answer (§6). Next instrument: compare emitted-scoop local cost
   and forward-eval rank percentiles vs the winners on impact gaps
   (`scoop_emitted` 28k vs `handoff_scoop_selected` ~416 at 300k) — is the
   scoop losing on collateral axes (graduation trigger for the joint aimer),
   on local cost weighting, or genuinely worse?
2. **Sled pose at landing.** If scoops still under-deliver after the
   selection question: record pose (TAIL→NOSE) at landing, check it predicts
   conversion residue. Sensor + actuator validated; mind the wrap caveat.
3. **Direct axis-value aiming** for span axes (V2 says viable without the
   next catch). Becomes interesting if state proxies are shown to be the
   accuracy bottleneck.

## 8. Reproducibility

Studies (read-only diagnostics): `scripts/v0/study_arc_sensitivity.ts`,
`study_aim_replay.ts`, `study_score_smoothness.ts`,
`study_knob_additivity.ts`, `study_impact_funnel.ts`. Artifacts under
`generated/analysis/` (`arc_sensitivity_300k.*`, `aim_replay_300k.*`,
`score_smoothness_300k.*`, `funnel_after_v4.txt`). Typical invocation:

```
LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
  scripts/v0/study_arc_sensitivity.ts --budget=300000 --out=generated/analysis/...
```

Decision workflow: `LR_ENGINE=wasm npm run golden -- --jobs=32
--archive-dir=generated/golden-runs/<name>`, then `npm run decide --
<candidate>/golden.json <baseline>/golden.json` (candidate first). After any
behavior or stats-key change: `LR_ENGINE=wasm npm run verify:optimizer --
--update` + full test suite.
