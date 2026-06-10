# Arc → next-state control: sensitivity & predictability study

2026-06-10 · branch arc-rewrite · companion to `IMPACT_PAIR_PLANNING.md`.
Question (Jérémie): instead of sampling arcs and hoping search finds one whose
simulated next-gap arrival fits, can we make small controlled modifications to
an arc, learn the local response of the next-gap state (CoM angle, speed, and
"internal rotation" = sled pose), and AIM?

## Method (reproducible)

```
LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
  scripts/v0/study_arc_sensitivity.ts --budget=300000 \
  --out=generated/analysis/arc_sensitivity_300k.jsonl
```

For every gap k of 12 compiled tracks (6 specs × 2 seeds, 300k): truncate the
track to arcs ≤ k (exactly what generation sees when k is chosen), apply a
perturbation sweep to arc k, re-simulate, and read the FULL rider state at gap
k+1's frame — CoM position/velocity/angle/speed, sled pose angle (TAIL→NOSE
vector via `getSledPointPositionsMetered`), and SLED_INTACT / RIDER_MOUNTED
validity flags. 306 gaps, 6,970 simulations, ~3 s of sim per track (compiles
dominate). Perturbation families, all chain-continuity preserving:

| family | knob | sweep |
|---|---|---|
| `exit_pitch` | rotate last ⅓ of segments about their joint | ±10° |
| `arc_rotate` | rotate whole arc about entry point | ±4° |
| `arc_extend` | lengthen/shorten final segment along itself | −40..+60 px |

Note: sled pose IS readable from the engine (PEG/TAIL/NOSE/STRING points per
frame + crash flags) even though `targetState` doesn't carry it today.

## Results

**1. The map is locally linear almost everywhere.** Secant test (predict each
sweep point from its two neighbors — exactly the "10°→100, 20°→140 ⇒ 15°→~120"
interpolation idea), per-gap median error / controllable range, `exit_pitch`:

| outcome | p50 | p90 | p99 | gaps with ratio > 0.2 |
|---|---|---|---|---|
| CoM arrival angle | 0.006 | 0.017 | 0.032 | 0.0% |
| sled pose angle | 0.031 | 0.097 | 0.185 | 1.0% |

Monotonicity 100% (CoM) / 70% (pose); sweep survival 100% at p10, full ±10°
sweep survives at 97.4% of gaps. The system is chaotic in the large but
SMOOTH in the small: within ±10° of a committed arc there are essentially no
cliffs for CoM state.

**2. Aiming works with ~3 probes; the curve is mildly nonlinear globally.**
Fit one line through (δmin, 0, δmax) and predict every interior point:

| outcome | p50 abs err | p90 | p99 |
|---|---|---|---|
| CoM arrival angle (°) | 0.81 | 2.39 | 4.57 |
| speed (px/f) | 0.14 | 0.25 | 0.41 |
| sled pose (°) | 8.6 | 34 | 103 |

So: CoM angle/speed → one global linear model from 2–3 probes aims within
~1°/0.15 px/f; one local refinement (re-probe near the predicted δ, where the
secant error is ~0.1°) is Newton-step cheap. Sled pose → locally smooth but
globally curved/wrapping: aim by local stepping, not one straight line.

**3. Control authority is real and the most productive knob is exit pitch.**
Median per-gap range over the sweep (exit_pitch): 17° of CoM arrival angle,
1.4 px/f of speed, 40° of sled pose, 56 px of arrival height. Sensitivities
≈ 0.9° arrival / ° pitch, ≈ 1.0° pose / ° pitch. `arc_rotate` is similar per
degree but mostly moves arrival height; `arc_extend` is the weakest and the
noisiest for pose.

**4. Steep arrivals — the dive-scoop precondition — are almost always
creatable.** Baseline CoM arrival angle p50 = 14.2° (64% of gaps ≥12°
already); within the ±10° exit-pitch sweep, **95.1% of gaps can reach ≥12°**,
median reachable max 21.9°, median authority gained +7.5° — at ~100% survival.

**5. Probe-count ladder** (exit_pitch; held-out abs error p50/p90 across the
±10° span; "1 probe" = baseline + population-median slope as prior):

| outcome | 1 probe+prior | 2 (endpoints, lin) | 3 (quad) | 5 (cubic) |
|---|---|---|---|---|
| CoM arrival angle (°) | 0.70 / 2.68 | 0.81 / 2.37 | 0.31 / 1.34 | 0.20 / 0.96 |
| speed (px/f) | 0.11 / 0.39 | 0.14 / 0.25 | 0.02 / 0.07 | 0.01 / 0.06 |
| sled pose (°) | 7.8 / 41.6 | 8.6 / 34.7 | 3.9 / 19.8 | 2.8 / 16.5 |
| arrival height (px) | 4.9 / 17.8 | 2.8 / 8.9 | 1.2 / 4.4 | 0.6 / 3.1 |

Three probes (quadratic) is the knee for CoM state; returns diminish after.
Notably, ONE probe plus a global prior already aims arrival angle to ~0.7°
p50 — the population slope (~0.9°/°) generalizes across gaps; per-gap probes
mostly buy tail safety.

**6. Pose wrapping (the full-rotation caveat).** If the rider spins fast,
angle interpolation breaks across ±180° wraps. Diagnostic on this dataset:
adjacent sweep steps (2° apart) move pose by 4.3° p50 / 18.6° p90; only 0.1%
of steps jump >90°, and 3/306 gaps (1.0%) show a suspected wrap. At the
current operating point the rider is not in a fast-spin regime at gap frames,
so wrapping is a tail effect — but any pose-aiming must (a) unwrap by sweep
continuity (fine δ steps), (b) record pose angular velocity (pose at F−1 and
F) to detect spin, and (c) interpolate rotation count separately when |ω| is
high. CoM velocity angle wraps only if the rider loops — not observed.

## Implications

- Generation can move from sample-and-hope to **aim**: 2–3 extra simulations
  per gap (cheap — far less than the dozens of candidate evals already spent)
  buy a local model `next_state(δ)` good to ~1° arrival angle, invertible in
  closed form. This composes with, and de-risks, the arrival-conditioned
  scoop lane (IMPACT_PAIR_PLANNING §5): the steep-arrival precondition can be
  *manufactured* at 95% of gaps, not just exploited where it happens.
- "Internal rotation" is measurable, controllable (~40° authority), and
  locally predictable — modeling it no longer requires guessing; if pose at
  catch predicts conversion residue (open question in §6), we now have both
  the sensor and the actuator.
- The right model is LOCAL (per gap, per arc, fitted from probes at compile
  time), not a global learned model: local linearity is near-perfect while
  global curvature is real.

## Caveats

- "Survival" here = rider intact at gap k+1's frame on the truncated prefix;
  the production gates (landing window ±1 frame, off-beat, downstream
  completion) are stricter. Authority that survives physics may still lose
  score elsewhere — aiming must target the gated quantities.
- Outcomes are read at the next gap's beat frame (pre-catch state), matching
  `readTargetStateFromRider` semantics.
- Perturbing a COMMITTED arc k changes gap k's own achieved axes (the sweep
  doesn't re-score gap k). Any production use must aim within the slack of
  gap k's own targets or re-rank gap k's candidates with the model in hand.

## Validation & integration roadmap (the method)

Principles. The aimer must be a PROPOSER, never a judge: a pure function
(prefix engine, arc lines, knob, target) → adjusted lines, whose output flows
through the existing gates + local cost + forward-eval like any other
candidate. No score path trusts the model. Aiming refines WITHIN an arc
family; it must not collapse pool diversity — aim each sampled family, let
ranking choose among aimed candidates ("aim many, rank as before"). Probes
are metered physics frames (honest budget accounting, getRiderMetered).

Ladder — each rung falsifiable before the next:

- **V0 (this doc)**: open-loop feasibility on state space. DONE.
- **V1 — aim-replay study** (offline, zero compiler change): closed the loop?
  On committed tracks, pick concrete targets (next-gap speed target; arrival
  angle ≥12° on impact gaps), solve with the 3-probe model, apply, and verify
  with PRODUCTION measurement: achieved-vs-aimed error, landing-window ±1f
  compliance, off-beat, and gap k's own axis drift. This converts "the map is
  smooth" into "aiming hits gated quantities".
  **DONE — PASS** (`scripts/v0/study_aim_replay.ts`, 298 gaps × 3 tasks @300k,
  `generated/analysis/aim_replay_300k.{jsonl,txt}`):
  | task | model err p50/p90 | survival | gates (landing ±1f ∧ off-beat) | authority-clamped |
  |---|---|---|---|---|
  | steep (angle → max(base+4°, 12°)) | 0.43° / 1.67° | 100% | 100% | 5% |
  | speed +0.5 px/f | 0.01 / 0.08 px/f | 100% | 99% | 31% |
  | speed −0.5 px/f | 0.02 / 0.06 px/f | 100% | 100% | 1% |
  Gap-k side-effects are ZERO (|landing frame shift| and |landing speed Δ|
  p90 = 0.00): exit pitch rotates the arc's tail, the catch is at its head.
  **On impact-ask gaps (next target ≥0.3): 90% reach a ≥12° arrival with both
  gates held** — the §5 precondition is manufacturable in practice, not just
  in state space. Asymmetry note: speeding UP is authority-limited (31%
  clamped — pitching the exit mostly trades angle), slowing down is nearly
  free; aiming for more speed needs a different/added knob.
- **V2 — score-smoothness study**: same sweep, but record gap k's achieved
  axis values (air/speed/elevation/amplitude/impact) and local cost per
  variant. Are SCORES probe-predictable too? (Model achieved values, not
  gated cost — gates are step functions by construction.) If yes, aiming can
  target score directly, which generalizes far beyond impact.
  **DONE** (`scripts/v0/study_score_smoothness.ts`, 306 gaps @300k, production
  `measureGapAxes`/`axisCost`/`axisLookaheadEndFrame`;
  `generated/analysis/score_smoothness_300k.{jsonl,txt}`). Three results:
  1. *Within-gap axes are smooth and probe-predictable* where the knob has
     authority (speed/elevation/amplitude: secant err ≤1% of range; 3-probe
     held-out ≤0.001 axis units p50). Gap k's own impact has range exactly
     0.000 — exit pitch never touches the catch head. Score-aiming is viable.
  2. *Cross-gap span axes* (k+1's air/speed/elevation/amplitude measured with
     the committed catch in place) are larger-ranged and still usable
     (err/range 1–6%, monotonic 40–90%) — noisier than state, as expected.
  3. **Arrival and catch are a tightly coupled pair**: perturbing arc k's
     exit by just ±2° makes the COMMITTED catch at k+1 lose its on-beat
     landing (±1 frame) at 79% of gaps; 98% at ±10°. So next-gap impact
     cannot be scored against a stale catch — an aimer at k−1 with a frozen
     k catch is useless for impact. Integration MUST live at generation
     time, where gap k+1's catch is re-fit to the aimed arrival (which the
     architecture already does: candidates re-condition on the probe).
     This validates the ladder ordering: V3 integrates the aimer where
     catches are still fluid, and V4 pairs aim+scoop explicitly.
- **V3 — first integration**: ONE aimed-attempt lane behind a default-off env
  flag: for each surviving candidate family at gap k−1 (or the top few),
  probe-fit exit pitch and emit one aimed variant targeting what gap k wants.
  Smallest possible production surface; judged by canonical + decide.
  **DESIGN DECIDED — target = arrival SPEED into gap k+1, aimed at k+1's
  speed target.** Why this and not impact/all-axes: (a) one knob aims one
  scalar — multi-axis needs multiple knobs, defer; (b) aiming steep-for-
  impact alone re-enters the closed loop (steep arrival without a matched
  scoop = the failed arrival-unfade experiment; V2 proved arrival+catch must
  ship as a pair — that pair is V4); (c) speed is targeted on EVERY gap
  (statistical power), pays through any re-fitted catch (no pool
  prerequisite), is our most accurate aim (V1: 0.01–0.08 px/f), and is the
  lab's designated impact lever (landing speed predicts impact achieved);
  (d) it closes the loop on the EXISTING energy launch shaper — smallest
  honest change. Mechanics: for the top admitted candidate(s) at gap k,
  2 extra probes → fit → solve exit pitch δ for the arrival speed k+1 wants
  → emit ONE aimed variant through the unchanged evaluation path. No rng()
  draws (determinism contract); probes metered; LR_AIM_LAUNCH=1 default-off,
  byte-identical off; judged canonical + decide. Falsifiable: speed-axis
  error drops suite-wide; headline up or neutral; neutral-but-accurate still
  validates the mechanism V4 builds on.
  **DONE — ACCEPT, PROMOTED DEFAULT-ON** (`optimizer/aim.ts`, lane wired in
  `node.ts getCandidatesSorted`; `LR_AIM_LAUNCH=0` = ablation):
  586.53 → 592.57, **Δ+6.0, 95% CI [1.4, 11.2], P(Δ≤0)=0.9%, ACCEPT** —
  positive at every budget (100k +5.7, 200k +4.6, 300k +4.4, all CI>0;
  50k +22.1 noisy), validity 50k 97%→98%, held 100% elsewhere. Excl-impact
  headline rose 648.1→653.1 while the impact gap stayed ~61 — the win came
  from the non-impact axes (speed conditioning), exactly as predicted.
  Implementation notes: aimed candidate lives OUTSIDE `sampleOrder` (attempt
  prefix property untouched; no `sampleAttempt`, so cache-shrink reads
  exclude it); lane gated `nCand > 1` so branch=1 rollout pools never pay
  probe cost (the branch-widening lesson); the base candidate's own
  `releaseSpeed` is the free δ=0 probe point; flag-off parity verified
  (586.53 reproduced), 248/248 tests, verify:optimizer re-baselined.
- **V4 — dive-scoop on the aimer**: aim the k−1 exit to manufacture the steep
  arrival, size the scoop at k from the (now reliable) arrival vector
  (IMPACT_PAIR_PLANNING §5). The aimer turns §5's precondition from
  "exploited where it happens" (64% of gaps) into "manufactured" (95%).

Why not start at dive-scoop directly: V1/V3 validate exactly the operation
the study measured (perturb a committed/selected arc, hit a next-gap state),
one mechanism at a time; the scoop adds a second coupled mechanism and
should land on a validated aimer.

Raw per-variant rows: `generated/analysis/arc_sensitivity_300k.jsonl`
(spec/seed/gap/family/delta → full outcome). Summary tables:
`generated/analysis/arc_sensitivity_300k.txt`.
