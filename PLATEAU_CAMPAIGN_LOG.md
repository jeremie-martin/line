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

#### Exp 5 (Direction 3) — constant-budget REPLACE (substitute normal contact_style samples with contact_shape)
Hypothesis: the ungated regressions are pure sample-budget competition, so spending
the SAME budget (replace the 2 normal contact_style samples with 2 contact_shape,
not add) should keep the win without churn. A/B from one binary; off-arm
(LR_NO_CONTACT_SHAPE=1, normal mode) verified byte-identical to the original baseline.
RESULT: **falsified, much worse.** CURVE_SCORE 324.85 (-5.70); 150k -3.52; big
regressions (opening_burst s2 -63.67, drums_crescendo s0 -19.21, s2 -17.79,
syncopated_switchback s1 -15.98, drums_pendulum s0 -14.20) and the opening_burst s1
+58 VANISHED. Starts churned everywhere.

Key correction to the model: budget was held CONSTANT yet it churned MORE. So the
churn is NOT mainly budget competition — it is **candidate-set change**: altering
which candidates exist changes the deterministic best-path sequence → a different
start lineage wins → forward-fragility churn. Removing the normal contact_style
samples also destroyed paths many rows depended on (consistent with the earlier
"removing the contact_style stream is costly" finding). This explains why **ADD beats
REPLACE**: adding preserves every existing good path and only offers new options that
win where strictly better. The opening_burst s1 +58 specifically needs the ADDED
exploration (the normal + contact_shape candidate set together), not contact_shape alone.

#### Direction-3 conclusion (why the tractable no-gate fixes don't work)
- REPLACE (constant budget): worse — candidate-set churn + loss of relied-on normal samples.
- MERIT admission (fire only where contact_shape helps): to decide cheaply BEFORE
  generating (generation is what churns), the only signals are target values
  (threshold = overfit, targets quasi-continuous) or incumbent state (charter-flagged
  risky). Accurate targeting requires generating+measuring = the churn itself. And the
  true discriminator is the contact_style-gain-vs-air-loss trade, which needs the air
  target — the leaky air gate (Exp 4) proved that doesn't separate cleanly.
- drums_pendulum fundamentally does NOT want what contact_shape offers: it wants MID
  contact_style (0.45) at LOW air (0.15) = shorter grounded slide, NOT a bounce-off.
  contact_shape (bounce-off, raises air) is simply the wrong primitive there; the clean
  thing is for it to not touch those gaps — which is exactly what a gate does.
- The genuine structural fix (decouple contact_style from air) is multi-arc /
  backward-reachability (rethink doc direction B/D), a larger project whose shape the
  doc itself defers until reachability is built.

No free lunch: the opening_burst s1 +58 BREAKOUT needs 2 EXTRA contact_shape samples
(added exploration). Added samples cause schedule/start churn → regressions on some
rows. Only a gate that restricts WHERE to add removes the churn, and the only gate
that cleanly excludes the harmed rows (drums_pendulum) is a tuned contact_style
threshold — because drums_pendulum's contact_style cluster (~0.45) sits just above
it while its air/contact_style jitter defeats the causal air gate. So "K=2 clean win"
and "no tuned gate" are in genuine tension under the current single-arc generator.

## Idea 2: margin-based backward reachability (rethink doc §5.B, "the real lever")

Hypothesis: the forward-fragility above is the core problem; the fix is to rank
catches by how DEEP the post-catch exit state sits inside the NEXT contact's
catchable entry region (a robustness margin), not just whether the next contact
barely survives. New module `scripts/v0/optimizer/reachability.ts`: reduced state
`{vx,vy,speed,angleDeg,stability}`; per-gap catchable region built right-to-left
by forward-simulating a 3×3 entry-velocity grid through an isolated-origin local
catch (prefix-independent, memoized by (seed,gapIndex), charged in sim-frames);
`reachabilityPenalty(exit, nextRegion)` = capped min stateDistance to a region
sample. Plan: Phase A probe (byte-identical; handoff.ts untouched) → gate → Phase B
wire into selection. Probe script: `scripts/v0/reach_probe.ts`.

### Exp 6 (Phase A probe) — VERDICT: STOP at gate. Signal too weak, cost too high.
10-spec × 3-seed, 150k. The probe compiles each row normally (compiler unchanged →
byte-identical by construction), captures the winning full-duration node via
`onNode`, then OUTSIDE the metered loop computes regions and the winning track's
per-catch exit margin into the next region.
- **§5.B premise (per-track): null.** `Pearson(axisQuality, meanMargin) = -0.065`.
  Bottom vs top quality half: meanMargin 0.321 vs 0.346 (slightly WRONG direction).
  Higher-quality tracks do NOT have deeper margins.
- **Per-contact pooled (n=1314, decisive): weak.** `Pearson(margin, nextContactError)
  = 0.238`. Quartile next-error is FLAT (~0.24) across the lowest 75% of margins;
  only the extreme top quartile (margin>0.5) is modestly worse (0.283). Margin
  barely predicts downstream difficulty.
- **Per-dim:** none strong; vy weakly largest (low/high 0.147/0.176).
- **Cost: prohibitive.** Region build ~22.6k frames/row mean (max ~30k) = 15-20%
  of the 150k budget. The grid keeps ~45% of entries → region is permissive → low
  discrimination. Margin also varies by source-gap duration (0.319/0.340/0.416 by
  bucket), confirming the velocity-only region ignores the contact-frame-budget
  axis (the load-bearing prefix-independence approximation is the wrong slice).

Decision (per plan gate): do NOT build Phase B. A ~0.24-correlation signal costing
15-20% of exploration cannot net-help a search this fragile to candidate-set change
(any selection change churns ±; the steer here is far weaker than the churn). The
probe-first design paid off — it prevented a wasted, near-certainly-negative Phase B
workbench run.

This is a documented NEGATIVE for THIS realization of §5.B (isolated-origin
velocity-slice region as a graded ranking term), not a refutation of the feasibility
thesis. The diagnosis points at the approximation (permissive coarse region; wrong
cross-section — needs (velocity, gapFrames) at minimum) and the fragile-search cost
ceiling. Artifacts (`reachability.ts`, `reach_probe.ts`) kept on `work-new` for any
refined retry. Plausible next directions: (a) a sharper/cheaper region keyed on the
contact-frame budget, only if a probe shows a much stronger correlation; (b) pivot to
direction D (multi-arc bounce-off) which decouples contact_style from air and is the
structural answer the rethink doc defers; (c) accept that forward feasibility (the
existing 1-contact preview) is already capturing most of the cheaply-available
feasibility signal, and look elsewhere for the plateau lever.

## Idea 3: feasible-band axis remapping (specs author [0,1] -> engine maps to achievable band)

Reframe (user): the plateau is largely chasing INFEASIBLE targets. Let specs author
in [0,1] (intuitive) and remap each axis under the hood to its achievable band, so
the optimizer never chases impossible points. Needs the achievable envelope per axis.

### Axis correlation (n=1014 gaps targeting both air & contact_style, baseline)
- corr(air_target, cs_target)=+0.30; corr(air_achieved, cs_achieved)=**-0.05**;
  corr(air_error, cs_error)=+0.27. air & contact_style are EMPIRICALLY ORTHOGONAL
  in achievement -> no merge case; keep both. The plateau is NOT axis coupling.

### Calibration (achievable envelope) — `scripts/v0/calibrate_axes.ts`
Axes split by nature: air/speed are span/accumulated (multi-catch-context dependent)
-> use REAL-context baseline achieved; contact_style/grain are local catch properties
-> use the isolated-sweep probe (per gap, sweep entry velocities x random target
vectors, pool achieved of every viable landing catch; no compiler change).

Results (2011 viable isolated catches + baseline real-context):
- **air**: isolated single-catch floor **0.82-0.95** (RISES with gap duration);
  real-context floor **0.29**, p05 0.48, p50 0.73, p95 0.86. The 0.9->0.29 gap is
  ENTIRELY neighbor/support geometry -> air's low end needs support spanning the gap;
  the air plateau is STRUCTURAL (multi-arc/support), not a relabel. Band (real):
  author[0,1] -> ~[0.35, 0.90], ideally context-aware (floor rises with duration).
- **speed**: achievable ~[0.21, 1.57] (real), EXCEEDS 1.0 (rider outruns SPEED_CAP=12);
  floor ~0.2. Band: author[0,1] -> ~[0.25, 1.25], or recalibrate SPEED_CAP up (~16-18).
- **contact_style**: BIMODAL — isolated 36% near0 / **1% mid** / 63% near1 (real 10% mid).
  A band remap does NOT help; mid stays unreachable. Needs the MEASURE redefined
  (current min(1, slide/segLen) saturates -> binary). Highest-value single change.
- **grain**: continuous; isolated & real agree ~[0.07, 0.80]. Cleanest remap.

### Sequence / implication
- grain, speed: clean band remaps (speed via band or SPEED_CAP recalibration).
- air: remap makes the optimizer HONEST (stops chasing 0.15 -> removes infeasible
  plateau) but does NOT add low-air capability -> still needs support geometry.
- contact_style: re-measure first (a band can't fix bimodality).
Big change: re-baselines all benchmark numbers (targets move into engine space).

### Comprehensive re-measurements (`analyze_feasibility.ts`, `measure_contact_style.ts`)

INFEASIBILITY AUDIT (% of current spec targets in an unreachable zone, baseline):
- **contact_style: 99.1% infeasible** (1005/1014; targets [0.20,0.85] all land in the
  bimodal dead zone). The axis is almost entirely unhittable as defined.
- **air: 11.6%** (targets < ~0.30, i.e. drums_pendulum low-air gaps). Structural.
- **speed: 0%** and **grain: 0%** — all targets already feasible. NO remap needed for
  these two. (Speed achieved can exceed 1.0 but no spec asks for it.)
=> The [0,1]->band remap only materially helps AIR; the real prize is contact_style,
which is a broken MEASURE, not a band problem.

REAL-CONTEXT bands by gap duration:
- air floor (p02) ~0.40-0.49 across <0.4s / 0.4-0.8s / 0.8-1.2s (weaker duration
  dependence than the isolated probe; a global air floor ~0.45 is defensible). Band
  ~[0.45, 0.90].
- speed ~[0.35, 1.30] real; covers all targets [0.35,0.95]. No action needed.

CONTACT_STYLE RE-MEASURE (n=813 viable catches, 6 specs): candidate continuous defs
vs continuity (mid%), controllability (corr with realized contact angle = the
steerable quantity), intent (corr with old_cs):
- old_cs:          mid= 1%  ctrl=0.85  intent=1.00   (bimodal, broken)
- **contactAngle/90: mid=50%  ctrl=1.00  intent=0.85  <- WINNER**
- contactFrac:      mid=78%  ctrl=0.31  intent=0.16   (continuous but not steerable)
- slideSegFrac:     mid=41%  ctrl=0.79  intent=0.76   (decent middle option)
- speedRetain:      mid=100% ctrl=-0.50 intent=-0.21  (continuous, wrong axis)

DECISION: redefine contact_style as the normalized contact ANGLE between the rider's
incoming velocity and the catch-line tangent at contact. Continuous (50% mid vs 1%),
directly controllable (the contact_shape primitive sets the tangent), intent-preserving
(corr 0.85; the old measure is essentially a binarized angle). Direction confirmed:
steeper/head-on contact -> stickier (high cs); glancing/parallel -> bounce-through (low
cs). Achievable angle range ~[0deg, 69deg]; map author cs [0,1] onto it.

NET PRIORITY (reordered by evidence):
1. **contact_style angle re-measure** — fixes a 99%-infeasible axis (highest value).
2. **air band remap [~0.45,0.90]** — makes the optimizer honest on the 11.6% low-air
   targets; pair later with support geometry to actually extend the low end.
3. speed/grain — no change needed (0% infeasible).
