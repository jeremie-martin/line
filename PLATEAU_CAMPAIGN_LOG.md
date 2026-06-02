# Plateau campaign log (handoff compiler)

Working log for the LDS plateau-breakout campaign. Charter:
`GOAL_LDS_PLATEAU_BREAKOUT.md`. Philosophy (user): fundamental
candidate-GENERATION changes over parameter tuning; the proven big win was
impact-anchored placement (simulate the rider's landing position, only consider
arcs that actually collide there). Avoid overfitting constants. Log every
attempt; commit compiler changes only if they improve the workbench.

Workbench (diagnostic, 10 specs × 3 seeds × budgets 35k..150k):
`drums_pendulum,drums_crescendo,grain_staircase,rhythm_ladder,
syncopated_switchback,drums_signature,dense_sprint,opening_burst,drums_tide,
drums_dropout`.

## Baseline (commit a4403e1, before campaign)
- 2-spec smoke (`drums_pendulum,opening_burst`; 75k,150k): `CURVE_SCORE 304.02`,
  6/6 valid. Worst rows are AXIS-FIDELITY plateaus, not landing failures:
  - `drums_pendulum`: `air` achieved ~0.90 vs target 0.15 (too airborne).
  - `opening_burst`: `contact_style` achieved 1.00 vs target 0.28 (slides too long).
- Full 10-spec baseline: see `/tmp/baseline_full.json` (running).

## Key structural finding
`contact_style` (= slide-distance-after-contact / median-segment-length) and
`air` (= airborne fraction) are COUPLED through catch geometry, and both are
governed by the contact-region tangent RELATIVE TO the rider's incoming
velocity:
- tangent aligned with velocity → rider slides along → high contact_style, low air;
- tangent angled to velocity → rider deflects/bounces → low contact_style, high air.
The normal sampler picks arc orientation in ABSOLUTE world-frame (`endAngleDeg`
uniform), so it never explores orientation relative to the rider's velocity —
the physical driver of the two stuck axes. Impact-anchor controls WHERE the
catch lands but deliberately leaves HOW (orientation) free.

## Idea 1: contact-shape stream (tangent relative to incoming velocity)
A new opt-in axis-quality candidate mode (`contact_shape`): place a near-straight
short ramp through the simulated landing point, oriented at the rider's incoming
velocity ± a sampled offset. Adds the missing degree of freedom; ranker + hard
gates decide. Additive (existing streams byte-identical), reported via
`by_sample_mode`, removable by subtractive probe.

Risk (from fresh-perspective critique): the contact tangent is ALSO the dominant
driver of the exit hand-off state, and the forward search is chaotically
sensitive to exit state — broad generation changes have collapsed stable rows
before. Mitigations: opt-in stream only (do NOT fold into default sampler), small
fixed K, no value-threshold micro-policy, keep `normal` stream untouched.

Overlap note: a BLUNT version (absolute start/end-angle bias on the contact_style
stream) is in the rejected list. This is the CAUSAL version (tangent relative to
measured `targetState.angleDeg`, anchored at the impact point) — explicitly
distinct, and a sibling of the existing accepted `CATCH_TEMPLATES`/steep-catch
primitive which already controls tangent relative to velocity for high-speed gaps.

### Methodology notes (learned the hard way)
- **golden.ts spawns a fresh worker process per (spec,seed) job**, loading source
  at spawn time. NEVER edit compiler source while a golden run is in progress —
  late jobs pick up half-edited code. A contaminated baseline run crashed all 6
  seed=2 tail jobs (`TypeError reading 'sampled'`) on a mid-edit arc_placement.
- A/B is done from ONE committed binary via `LR_NO_CONTACT_SHAPE=1` (baseline) vs
  default (variant). Verified the gate is purely additive: gated-off 2-spec smoke
  (`drums_pendulum,opening_burst`; 75k,150k) is byte-identical to the clean
  pre-edit baseline — `CURVE_SCORE delta +0.00`, `workΔ(sim=+0 cand=+0 viable=+0)`
  at both checkpoints. So any variant delta is attributable to contact_shape only.
- Clean 2-spec baseline: 75k=303.78, 150k=309.52, 6/6 valid.

### Attempts

#### Exp 1 — contact_shape ungated on contact_style gaps (commit 8fb012e)
2-spec smoke (`drums_pendulum,opening_burst`; 75k,150k) vs verified gated-off baseline:
- 75k 303.78 -> 290.67 (-13.1); 150k 309.52 -> 313.44 (+3.9); CURVE_SCORE 304.02 -> 301.84.
- Row 150k deltas: **opening_burst s1 +59.96** (276.25->336.21), opening_burst s2 +0.58,
  opening_burst s0 flat; **drums_pendulum s2 -14.27, s0 -4.71**, s1 +0.04.
- contact_shape candidates ARE viable (axisq_contact_style gate-survival ~14.6%, like the
  normal contact_style stream) and ARE adopted (axisqSrc=contact_style on winning paths).

Mechanism (placement stats + per-gap targets):
- contact_shape has HIGH preclear-rejection (~50-70%) and low landing rate. Reason: a line
  ALIGNED with the rider's velocity lies along the incoming path → rider hits it pre-target
  → precleared. The catches that SURVIVE are the DEFLECTING ones (offset away from velocity),
  which bounce the rider off → low contact_style + HIGH air.
- So contact_shape is really a **bounce-off / low-contact_style primitive**, geometrically
  poor at the aligned/grounded (low-air) case.
- Per-gap targets confirm the split: opening_burst wants contact_style 0.28 (bounce) + air 0.82
  (airborne) — consistent → big win. drums_pendulum wants air 0.15 (grounded) + contact_style
  0.45 (mid) — deflecting catches raise air → regression.

Verdict: promising, NOT discarded. The ungated stream perturbs air-dominated rows. Refinement:
gate contact_shape to LOW contact_style targets (targetMax ~0.4), where bounce-off is the
unmet need — principled (addresses a broad single-arc geometry limit), keeps the opening_burst
win, should remove the drums_pendulum air perturbation.

#### Exp 1b — full 10-spec workbench A/B (ungated): pending
#### Exp 2 — contact_shape gated to low contact_style targets: pending
