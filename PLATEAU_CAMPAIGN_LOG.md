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

### Attempts
(to be filled in)
