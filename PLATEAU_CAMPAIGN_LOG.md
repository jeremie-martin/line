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

#### Exp 2 — contact_shape gated to low contact_style targets (commit 6513fd0)
Full 10-spec workbench (35k..150k) vs verified clean baseline (CURVE_SCORE 330.55,
30/30 valid). Gated: targetMax=0.4 on the contact_shape policy.
- **150k common-row: +2.17** (343.63 -> 345.80), 30/30 valid, positive at nearly
  every checkpoint. CURVE_SCORE 330.40 (-0.15 integral, see dip below).
- **Zero row regressions at 150k.** Largest improvements: opening_burst s1 **+57.99**
  (276.25->334.24), drums_signature s2 **+5.56**, syncopated_switchback s2 **+1.65**,
  drums_signature s0 +0.02.
- The gate worked exactly as predicted: drums_pendulum (contact_style 0.45 > 0.4)
  is now untouched (+0.00), eliminating the ungated air perturbation.
- 75k->150k conversion (the campaign's primary target) improved: 75k +0.26 -> 150k +2.17.

Mid-budget dip: at 65k the common-row delta is -8.99, recovering to +0.26 by 70k.
Cause = quality-phase schedule reordering, NOT a convergence delay (contact_shape
fires only in quality search, never contract). opening_burst s2 reaches its strong
basin a few checkpoints later (65k: 105 vs 372) but both land at ~390 by 150k;
opening_burst s1's +58 is a pure late (post-75k) gain (flat 275.7 through 75k in
both). Budget-prefix contract holds (each config monotone in its own budget). The
-0.15 CURVE_SCORE integral is driven entirely by this transient dip.

Verdict: a genuine fundamental generation win on the primary 150k-conversion metric
with zero 150k regressions; the added candidate machinery earns its keep there. The
mid-budget dip is inherent explore/exploit from adding quality-phase candidates.

#### Exp 1b — ungated K=2 (fire on every contact_style gap)
Full workbench vs baseline: 150k +1.76, but REGRESSIONS — drums_pendulum s2 -14.27,
drums_crescendo s0 -7.65, drums_pendulum s0 -4.71. CURVE_SCORE 329.39 (-1.16).
Keeps opening_burst s1 +59.96. Regressions come from contact_shape sampling on
gaps where it isn't needed: the extra sample budget starves other expansions and
shifts START-basin selection (drums_pendulum start moved r6->r7), forward-fragility.

#### Exp 3 — minimal-machinery check: K=2 -> K=1 (contact_style<=0.4 gate)
Full workbench: CURVE_SCORE 330.75 (+0.20, strictly positive, NO mid-budget dip),
150k +0.24, zero regressions — BUT opening_burst s1 falls back to baseline (the +58
is GONE). The second contact_shape sample is ESSENTIAL for finding that basin. So
K=1 = safe small distributed gain; K=2 = the breakout. (User chose K=2.)

#### Exp 4 — causal air-conflict gate K=2 (skip contact_shape when air target <= 0.25)
Replaces the tuned contact_style<=0.4 threshold with a causal guard reusing the
existing very-low-air constant. RESULT: leaky + regressive. CURVE_SCORE 330.12
(-0.43); 150k +1.60; regressions drums_pendulum s0 -12.89, s2 -10.99, drums_crescendo
s0 -7.65. drums_pendulum still regressed because its gaps target BOTH air (0.15) and
contact_style (0.45), and per-gap jitter lets enough gaps escape the air<=0.25 guard
that contact_shape still fires and shifts the start basin.

#### Threshold-robustness check (overfit audit of the contact_style<=0.4 gate)
Scanned all 30 rows: contact_style targets are quasi-continuous and DENSELY fill
(0.30,0.45) — 123 gap-instances at 0.32/0.35/0.36/0.38/0.42/0.44. So `targetMax=0.4`
is NOT in a clean cluster gap; it is a knife-edge tuned constant. The user's overfit
concern is correct.

### Decision state (the fundamental tradeoff, fully mapped)
| config | CURVE_SCORE | 150k Δ | 150k regressions | gate |
|---|---|---|---|---|
| baseline | 330.55 | — | — | — |
| **contact_style<=0.4 gate, K2** | 330.40 (-0.15) | **+2.17** | **none** | tuned threshold (dense region) |
| air-causal gate, K2 | 330.12 (-0.43) | +1.60 | drums_pendulum -12.89/-10.99, drums_crescendo -7.65 | causal but LEAKY |
| ungated, K2 | 329.39 (-1.16) | +1.76 | drums_pendulum -14.27/-4.71, drums_crescendo -7.65 | none |
| contact_style<=0.4 gate, K1 | 330.75 (+0.20) | +0.24 | none | tuned threshold (no breakout) |

No free lunch: the opening_burst s1 +58 BREAKOUT needs 2 EXTRA contact_shape samples
(added exploration). Added samples cause schedule/start churn → regressions on some
rows. Only a gate that restricts WHERE to add removes the churn, and the only gate
that cleanly excludes the harmed rows (drums_pendulum) is a tuned contact_style
threshold — because drums_pendulum's contact_style cluster (~0.45) sits just above
it while its air/contact_style jitter defeats the causal air gate. So "K=2 clean win"
and "no tuned gate" are in genuine tension under the current single-arc generator.
