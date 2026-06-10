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

Raw per-variant rows: `generated/analysis/arc_sensitivity_300k.jsonl`
(spec/seed/gap/family/delta → full outcome). Summary tables:
`generated/analysis/arc_sensitivity_300k.txt`.
