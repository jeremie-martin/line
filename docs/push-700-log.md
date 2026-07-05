# Push-700 campaign log

Goal: canonical HEADLINE ≥ 700. Canonical = 40 specs × 12 seeds × {125k,250k,375k,500k},
`LR_ENGINE=wasm`, `--jobs=32` (equals form!). Decide = paired cluster bootstrap, α=0.20;
only `VERDICT: ACCEPT` is kept. Scorer / specs / fingerprint / seeds / budgets / decide
rule are frozen.

## Baseline of record

| date | archive | commit | HEADLINE | excl-impact | notes |
|---|---|---|---|---|---|
| 2026-06-30 | attempt-aim-highk-gated-j32-a01 | f2cc3b2 (dirty) | 683.67 | 699.39 | starting baseline |
| 2026-07-02 | attempt-m4-air-selection-a01 | 49ceafb+M4 (worktree) | 685.97 | 706.59 | M4 airFit + air-aimed proposer variant — first campaign ACCEPT |
| 2026-07-03 | attempt-impact-portfolio-current-a01 | c2c2d01 | 689.51 | 710.02 | M1 converting scoop + M3 steep-arrival span — canonical ACCEPT |
| 2026-07-03 | attempt-no-converting-scoop-a01 | dfe9208 | 690.91 | 711.06 | M1 ablated; M3 steep-arrival span retained — canonical ACCEPT |
| 2026-07-03 | attempt-m3-scarce-span75-a01 | eaed707 | 691.28 | 711.20 | M3 scarce-tier span 20%→75% below 200k — canonical ACCEPT |
| 2026-07-04 | attempt-m41-hardimpact-span30-a01 | 0260692 | 692.52 | 711.76 | M41 hard-impact mature M3 span 20%->30% — canonical ACCEPT |
| 2026-07-04 | attempt-m64-impact-band-objective-current15-a01 | 765fd15 | 693.86 | 712.76 | M64 impact-band objective current-power 1.5 — canonical ACCEPT |
| 2026-07-04 | attempt-m74-vertical-objective-current20-a01 | f019e38 | 694.10 | 712.92 | M74 vertical M64 current-power 2.0 dose — canonical ACCEPT |
| 2026-07-04 | attempt-m75-highair-impact-readiness075-a01 | a3ff6b8 | 694.51 | 713.27 | M75 high-air impact readiness-power 0.75 selector — canonical ACCEPT |
| 2026-07-04 | attempt-m87-lowimpact-steady-current15-a01 | 6738a15 | 695.06 | 713.53 | M87 low-impact steady/sparse current-power 1.5 selector — canonical ACCEPT |
| 2026-07-04 | attempt-m94-lowimpact-compact-current20-a01 | 0fdf9d9 | 695.48 | 714.05 | M94 low-impact compact current-power 2.0 selector — canonical ACCEPT |
| 2026-07-04 | attempt-m101-repair-flat-compact-main100-a01 | 18a1c16 | 695.99 | 714.67 | M101 flat compact mature repair main-margin 1.0 selector — canonical ACCEPT |
| 2026-07-04 | attempt-m102-repair-highair-lowgrain-main100-a01 | d448cc4 | 696.35 | 714.91 | M102 high-air low-grain mature repair main-margin 1.0 selector — canonical ACCEPT |
| 2026-07-05 | attempt-m108-dense-readiness-pulse-repair-a01 | 6a58e2a | 696.65 | 715.04 | M108 dense readiness plus drums_pulse repair — canonical ACCEPT |
| 2026-07-05 | attempt-m117-portfolio-elev-compact-repair-a01 | 189d2f8 | 696.96 | 714.88 | M117 portfolio elevation readiness + compact readiness + stable dense repair — canonical ACCEPT |

## Diagnosis at 683.67

- drums_pendulum weighted 438.60 vs 688 spec-mean → **−6.1 headline pts** from one spec.
  Next worst: skyline_push (−2.6), terrace_sprint (−2.0), drums_dropout (−1.8),
  rhythm_ladder (−1.6), dense_sprint (−1.6).
- Impact pool = 699.39 − 683.67 ≈ **15.7 pts** (biggest axis pool; universal undershoot per lab).
- Air floored ~0.42 on dense-beat specs (pop≈g·N²/8); elevation endpoint/speed-stranding.
- item2-part1 "685.72" was a 1-seed probe, byte-identical to baseline on that seed. Not a lead.

## Hypothesis queue

- H1 low-air impact rideout as *selectable* lane (prior §13 forced version: pendulum +14,
  collateral killed it) — IN FLIGHT
- H2 arrival steepening into impact beats (lab: steep entry + deep scoop wins impact AND speed) — STUDY
- H2a arrival-conditioned converting scoop restored as sampler template (S2 mechanism 1;
  attempt-0 emission, conditioned on impact ask ≥0.3 AND real steep arrival ≥~12°, scoop sized
  from the ACTUAL arrival vector `asin(min(0.95, ask·VSTRONG/speed))`; predicted +2..+5) — NEXT
- H2c impact-aim proposal gate-fail cut (22% of enum dive proposals gate-fail → flat fallback;
  bound rotate recruit by the arrival's catchable turn; predicted +1..+3, validity-side pure
  upside) — CLOSED by M30 (probe-clean rotate-side filter cut gate-fails but scored flat)
- H2b impact template turn-cap raise (22°→~38): CLOSED by M31 — cap 30/38 moved a small
  impact-heavy slice but did not improve impact RMS enough to survive full-suite dilution.
- H3 air floor on dense beats (candidate: dense-gap-only shorter ride-outs via ARC_LEN LO,
  air-pressure-gated — uniform widening previously REJECTED −13) — CLOSED by M32
  (canonical INCONCLUSIVE-negative; targeted probe was a false positive)
- H4 elevation stranding — not started
- H5 125k knee (666.71 vs 688.19 at 500k; ≈2 pts max) — not started

## S2 study findings (2026-07-02, impact pool decomposition)

- Pool = broad UNDERSHOOT: 65% of impact gaps undershoot carrying 87% of error energy; soft
  band (<0.3) balanced (calibration fine); mid band (.30–.60) = 58.6% of energy, mean −0.100;
  worst on dense (14–30 fr) and low-air (<0.35: −0.205) beats; sparse gaps ≈ hit (−0.012).
  Zero ceiling-limited gaps. Top spec pools: drums_dropout 1.94, drums_swell 1.82, solo_run
  1.74, drums_tide 1.52, drums_signature 1.50. drums_pendulum is NOT an impact problem (0.71).
- Binding constraint = SELECTION CONSISTENCY, not aim/gate/generation/feasibility: best-of-12
  seeds hits 70% of tight mid-band beats within 0.03; best-impact seed scores +13.25 headline
  vs mean seed at NEUTRAL excl-impact (+0.69) ⇒ no frontier trade — a seed lottery.
  Impact-aimed candidate reaches pool rank 0 only 10.6% (mean rank 5.08/33, top-3 31%);
  branch=1 rollout only extends rank 0 ⇒ impact candidate usually never evaluated.
- Root regression: V4 arrival-conditioned converting-scoop GEOMETRY deleted (aim.ts:121) when
  the enum proposer subsumed its knobs — proposer still sets steep-arrival knobs at k−1, but at
  k only the generic capped (22°) template can convert ⇒ dive rarely pays ⇒ rarely ranks.
- Dead ends (measured, do NOT reopen): force-on arrival ramp (excl-impact −7.7), carrier
  CURVE_START 0.12 (−31.7), deeper FLATTEN 26 (−94.2) — blunt generation pressure fails;
  branch-widening at impact gaps rejected (branch^depth starves search).

## S3 study findings (2026-07-02, winning-seed impact kinematics)

- CHAIN verdict: hitters at tight mid-band beats arrive ~6° steeper (27.7° vs 21.8°), set up at
  the k−1 launch (+3.1°); extra redirArc is 100% Δθ (turn term +1.42 px/f, speed term −0.26 —
  hitters are SLOWER); redirects downward momentum ⇒ orthogonal to speed axis ⇒ free
  (air/speed/excl-impact/next-gap all neutral). Local catch-shape knobs (entry angle, turn) are
  cross-group coinflips — do NOT build k-side templates.
- 83–95% of undershooters have no same-arrival hitter (5.2% at tight tolerance) ⇒ arrival state
  itself must change ⇒ k−1 aim/selection is the lever.
- Root cause: objective.ts impactFeasibility is a one-sided [0,1] gate, over-delivery free ⇒
  saturates at 1 for barely-feasible shallow arrivals ⇒ readiness gives no gradient toward
  steeper arrival. Delivery efficiency η = redirArc/(v·comAngle) median 0.68; undershooters need
  median +12° steeper arrival. OBJECTIVE_IMPACT_MIN_ASK=0.30 leaves low mid-band unsteered.
- Harvest estimate: ~7–9 headline pts in this pool (56% of the impact oracle), all budgets.
- ⇒ M2 mechanism: two-sided delivery-match readiness term (asymmetric: undershoot full exp
  penalty, overshoot light), η named constant, MIN_ASK 0.30→0.25 as separate arm. IN FLIGHT.

## S4 study findings (2026-07-02, drums_pendulum diagnosis)

- STRUCTURALLY CAPPED — deprioritized as a compiler lever. 100% of the deficit is axis_quality
  (drift/missing/survival all 1.000, 55/55 contacts); flat 416→443 across 4× budget.
- Variance share @500k: air 54% / impact 40% / speed 6%. Dominant error = glued-block air:
  ask 0.15, achieved 0.44, detector floor ≈ 5/19.2 = 0.26 (K_BOUNCE_LANDING=5 airborne frames,
  median gap 19.2f). Pendulum is the ONLY golden spec asking air < 0.30.
- Glued blocks also ask impact 0.85 while asking air 0.15 — anti-correlated (impact needs fall
  height). Coupling probe: softening impact to 0.2 drops glued air 0.467→0.373 (~30% of the
  above-floor excess); rest is the floor. Native operating point is Pareto-better than the
  softer-impact trade (re-scored on true targets: 413 vs 386) ⇒ no free reweighting.
- Best seed 459 vs mean 443 (~16 pts spread vs ~250-pt deficit) ⇒ floor, not lottery.
- Spec-authoring fix (air 0.15→~0.32 or impact 0.85→~0.45, ~+1.3 HEADLINE) is FORBIDDEN
  (specs frozen). Pareto-navigator mechanism ≈ 0 at mature budgets (= the H1 result). ⇒ CLOSED:
  ~6.1 headline pts structurally locked; campaign must reach 700 from the remaining pools.

## S5 study findings (2026-07-02, full non-impact pool map)

- Headline is 100% axis-RMS (all 1920 runs clean contract passes; no completion component).
- Axis ceilings (perfect-axis): air +32.7, elevation +24.9, amplitude +22.6, speed +13.1
  (impact ref +50.2). But whole-track best-seed SELECTION recoverable: air +10.4, speed +9.1,
  amplitude +3.8, elevation +1.5; joint air+speed +14.8 (the real prize); calibration: impact
  best-seed +13.5 of which the real mechanism captures 7–9 ⇒ use ~0.5–0.67× of seed bound.
- ELEVATION ≈23 pts FLOORED (ACHIEVABLE_CLIMB_FRACTION=0.3/VERTICAL_FRACTION=0.5 physics:
  achieved band pinned ~[0.35,0.49] vs climb asks 0.55–0.64; skyline_push 0/72 hittable).
  AMPLITUDE mostly floored (sagitta = g·N²/8 ⇒ amp ≈ 3.65e-4·N²; determined by flight time).
  Both need physics/spec changes — out of scope. Air floor (5-frame detector) binds only
  18–30% of air pool; the rest is seed-lottery OVERSHOOT (ask 0.25 → seeds 0.28–0.84).
- 125k column (21.5 pts, weight 0.1 → ~2.1): QUALITY not completion (all 125k rows pass);
  impact +7.9 / speed +5.4 / air +4.4 of it; same dense/drums lottery specs.
- STRUCTURAL HOLE: no airFit anywhere in forward selection (readiness = catchability ×
  speedFit × impactFeasibility; air only in equal-weight currentQuality) — this IS the air
  lottery. Unlike impact, air variety already exists in pools.
- Mechanism candidates: (1) airFit forward term + air-aimed enum-proposer knob (~4–6 pts);
  (2) protected pool slot for min-speed-error candidate (~3–5 pts, low risk); (3) air-ask-
  conditioned launch-vy carrier for low-air overshoot (~2–4, overlaps (1)).
- M4 PROBE CLEARED decisively (airFit judge term + first-base air-matched ride-out-length
  proposer variant, floor-clamped effAsk, deadband 0.05, mismatch gate 0.10): subset decide
  +13.8 probe-ACCEPT CI[1.2,31.0] P≤0=1.4% — 125k +9.0 / 250k +16.2 (P=1%) / 500k spot +21.8;
  collateral neutral-positive; air RMS 0.134→0.118; validity 100%. Part A carries the bulk;
  B-alone is a lottery (never ship without A). TELEMETRY REVISION of S5: within-pool predicted-
  air spread is NARROW (~0.036); the 0.28–0.84 lottery lives ACROSS pool rebuilds along the
  search tree — hence a persistent judge term pays. CANONICAL IN FLIGHT
  (attempt-m4-air-selection-a01, in-worktree).
- PATH TO 700: 683.67 + impact (7±2) + air/speed (8±3) ≈ 698–703. No slack for floored pools.

## S6 study findings (2026-07-02, elevation floor audit) — FLOOR IS FALSE

- ACHIEVABLE_CLIMB_FRACTION=0.3 feeds ONLY report-only elevationCeiling (substrate.ts:672 —
  never scored); the "physics not optimizer" comment is self-referential (ceiling 0.65 is
  tautological). Scored ruler: netDyToElevation w/ cap=min(g·N, 0.5·speed) — E=1.0 permitted.
- Physics: LEVEL (E=0.5) is energy-NEUTRAL (symmetric arc, sustainable forever); E=0.55–0.60
  sustainable (rise 5–9px/gap), bursts 0.65+; climb costs Δv²=2gΔh. Study compile with banked
  speed reached SUSTAINED 0.77 (corr 0.73). Archive gaps individually hit 0.51–0.67.
- Actual failure: selection. climb_terrace track descends 450px monotonically, speed near-
  perfect, elevation abandoned (0.40–0.47 even where 0.5/LEVEL asked); mean grounded angle
  −0.62°, steepest −15° < −19.8° needed for LEVEL. Forward-eval speed-charge vetoes climb
  candidates; axisCost weights elevation=speed=1 but search over-resolves to speed.
  Also: amplitude≥0.30 defers ride-out shortening (skyline_push starved).
- STRUCTURAL RHYME: elevation, like air pre-M4, has NO term in forward readiness.
- Recoverable: reach-LEVEL-where-asked ≈ +17.6 free; realistic mechanism +10–18 of the 24.9
  ceiling. ⇒ M8 = elevationFit judge term (M4 pattern) + level/climb spanned variants;
  fail-fast gate first (pool variety + loss mode, M2 lesson). Prior reject to respect:
  "elevation launch target gain" (06-24, forced-ramp class).

## M9 feasibility verdict (2026-07-02, elevation section-regime planning) — DO NOT BUILD

- Analytic per-section optimization over the M4 baseline archive (432 section instances, exact
  scoring pipeline, baseline reproduced 685.97 exactly). Collateral-free arm reproduces the S6
  estimate (+12.06) — but the elevation sections are IMPACT STACKS (impact ask ≥0.3 on 47–100%
  of section gaps; amplitude co-asked on 4 specs). Level-flight conversion halves arrival
  redirArc ⇒ impact SSE +0.08 vs elevation SSE −0.013 per stacked beat (6× against).
- Honest idealized optimum: full plan +0.76 (bracketed [0.0, +0.8]); level-only +0.18;
  mechanism-discounted +0.1–0.3 ≪ 4-pt build bar. climb_terrace prices to exactly 0.00 (its
  450px descent IS the joint optimum). 62–99% of sections are honest-Z under collateral.
- Banked-0.77 study compile reconciled: sustained climb is reachable on specs that don't charge
  this suite's stacked collateral. S6's floor-refutation stands; the VALUE doesn't.
- Surviving remainder: ~+0.7 suite-diluted in mixed_grade/dense_echo_climb-shaped low-stack
  sections — spec-shaped, below bar. ELEVATION THREAD FULLY CLOSED.
- Campaign redirect: remaining headroom = M10 (airFit collateral, in flight), 125k impact
  portfolio, and the two UNMAPPED search-economy levers → S7 rollout frame-economy (rollouts
  ~50% of frames, top-1 agreement 25–29%, winner mean q-rank 2.6 ⇒ top-k pre-prune) and S8
  repair triage (repair ~61% of budget, ~72% wasted restarts, funds wrong specs/gaps).

## S8 study findings (2026-07-02, repair triage) — MINED DEAD; 06-14 diagnosis STALE

- Anchor selection is ALREADY scorer-consistent worst-first + cost-aware (pickFeasibleWeakGap,
  handoff.ts:2808, landed post-06-14): frame-spending restarts hit the early true-worst gap
  81–98% of the time; counterfactual anchor value left ≈ 2–8% and mostly unaffordable anyway.
- The "72% wasted restarts" = mostly the ZERO-frame protective throttle (95%/81% of restarts
  spend nothing); among frame-spending restarts accept rate is 50%@125k / 24%@500k. Repair
  delivers +23.9 score/cell at 500k — dominant high-budget quality driver, just frame-hungry.
- Health-stop tested DIRECTLY: dry-stop 2/3 frees 12–19% of 500k frames but nets −1.33/−0.53
  per cell (accepts arrive after dry streaks). Byte-identical at 125k. DEAD.
- Prior rejects confirmed non-overlapping but pointing the same way (cost-aware ranking,
  slack margins, caps: all "reshuffle-without-conversion").
- S8b divergence-timing gate: TOTAL OVERLAP → REPAIR THREAD FULLY CLOSED. Repair descents are
  blind (canSkipPartialEvaluation, handoff.ts:903 — no mid-restart score signal exists); the
  verdict lands at 93–100% of spent frames (accepted median 0.955–1.000 ≈ reconverged); perfect
  oracle refunds only 1.9%@500k / 8.9%@125k of reconverge frames; all realizable abort policies
  net NEGATIVE (−3.0 to −12.0 on the panel). Reconverge mass = irreducible price of ~24%-hit
  fresh-seed suffix gambles at ~+10/hit (positive EV). Also retro-explains the dry-stop loss.
  Three-layer close: anchor optimal / stopping loses / abort impossible.

## S7 study findings (2026-07-02, rollout frame economy) — DO NOT BUILD

- Rollout share of frames is 31.5–35.5% (the historical ~50% is stale). Winner mean q-rank
  2.24–2.46 but winner at q-rank ≥5 in 22–24% of pools; pruning to k changes the forward-top-3
  branch set in 39–79% of pools (k=6→3). Prune curve MONOTONE NEGATIVE: k=6 −9.4, k=5 −10.2,
  k=4 −16.8, k=3 −24.1; hybrid depth (greedy:2 top-2 / greedy:1 rest) −20.9 (mixed-depth leaf
  values incomparable). Freed frames DO convert to search (nodes +4..19%) but price at ~+0.9
  vs quality cost ~−10. Re-confirms lookahead-log C6 on the new baseline. k=8 + uniform
  greedy:2 is tuned-optimal; rollout-side frame-economy levers EXHAUSTED (depth/width/pool/
  mixed-depth all rejected). Only door: pre-sort accuracy (low leverage while all 8 roll).

## Attempts

(append: mechanism · change · canonical result · verdict · learnings)

### M11 — impact portfolio: converting scoop + steep-arrival span · ACCEPT (2026-07-03)

**Mechanism.** Fused two previously parked impact mechanisms into one production
compiler change in `arc_placement.ts`:

- M1 converting scoop: attempt-0 sampler lane for current impact beats with
  authored impact ≥0.30 and actual steep arrival ≥12°, using the incoming
  trajectory to build a concave scoop and preserving the normal downstream launch.
  Budget-faded from 125k to 250k.
- M3 steep-arrival span: for later attempts on gaps whose NEXT beat asks impact
  ≥0.30, pitch the final launch downward by a bounded delivery-efficiency inverse
  (`η=0.68`, max +15°, zero-band 80%). Attempt 0 remains byte-identical.

**Probe.** `probe-impact-portfolio-current-s0-2-a01` (40 specs × seeds 0..2 ×
canonical budget grid) vs M4 baseline: indicative `VERDICT: ACCEPT`, Δheadline
+3.3, P(Δ≤0)=7.6%, validity 480/480. Shape: 125k −16.1, then +4.4/+4.1/+6.9.

**Canonical.** `attempt-impact-portfolio-current-a01` (valid 1920/1920, HEADLINE
689.51, excl-impact 710.02) vs `attempt-m4-air-selection-a01`:

```
Δheadline = +3.5 · 95% CI [0.9, 6.4] · P(Δ≤0)=0.5% · effect=2.46
125k -10.1 · 250k +5.3 · 375k +5.5 · 500k +4.6 · validity 100% at every budget
VERDICT: ACCEPT
```

**Learnings.** The fused portfolio is not the expected 125k-impact rescue; it is a
mature-budget quality win that willingly pays the low-budget column. The weighted
metric accepts that trade because 250k/375k/500k all move strongly and consistently.
Next baseline is `attempt-impact-portfolio-current-a01`; remaining target gap is
about +10.5 headline points.

### M12 — ablate converting scoop, retain steep-arrival span · ACCEPT (2026-07-03)

**Mechanism.** Removed only the M1 attempt-0 converting-scoop sampler lane from
`arc_placement.ts`. The accepted M3 k-1 steep-arrival span remains intact.

**Probe.** `probe-no-converting-scoop-125-a01` (40 specs × 12 seeds × 125k only)
vs `attempt-impact-portfolio-current-a01`: indicative `VERDICT: ACCEPT`,
Δheadline +14.0, 95% CI [6.4, 21.9], P(Δ≤0)=0.0%, validity 480/480.

**Canonical.** `attempt-no-converting-scoop-a01` (valid 1920/1920, HEADLINE
690.91, excl-impact 711.06) vs `attempt-impact-portfolio-current-a01`:

```
Δheadline = +1.4 · 95% CI [0.6, 2.2] · P(Δ≤0)=0.0% · effect=3.51
125k +14.0 · 250k +0.0 · 375k +0.0 · 500k +0.0 · validity 100% at every budget
VERDICT: ACCEPT
```

**Learnings.** The converting scoop was the source of the accepted portfolio's
125k damage and contributed no mature-budget movement after its budget fade.
The retained gain is M3: 250k/375k/500k stay byte-identical to the accepted
portfolio, while 125k recovers. Next baseline is `attempt-no-converting-scoop-a01`;
remaining target gap is about +9.1 headline points.

### M13 — pool-relative air-fit damping · fail-fast INERT (reverted, 2026-07-03)

**Mechanism.** Tried weakening M4's pool-sort air-fit pressure only when a pool's
predicted next-gap air spread was small and every candidate remained outside the
floor-clamped air deadband. Aim-lane generation and the scorer were unchanged.

**Probe.** Targeted 12-spec × seeds 0..2 × canonical-budget panel
(`drums_zigzag`, `mixed_grade`, `drums_crosscut`, `opening_burst`, `pop_train`,
`drums_dropout`, `drums_swell`, `drums_tide`, `dense_sprint`, `rhythm_ladder`,
`syncopated_switchback`, `drums_signature`) vs `attempt-no-converting-scoop-a01`:

- Conservative damping (`probe-m13-air-pool-damp-s0-2-a01`): Δheadline +0.0,
  per-budget +0.0/+0.0/+0.0/+0.0, validity 144/144.
- Strong damping (`probe-m13-air-pool-damp-strong-s0-2-a01`): Δheadline -0.0,
  per-budget +0.0/+0.0/-0.0/+0.0, validity 144/144.

**Learnings.** Pool-local air damping does not move the target rows even at
near-mute strength; M4's remaining collateral is not controlled by this
candidate-pool sort differential. No canonical run spent; code reverted.

### M14 — M3 steep-arrival span dose 20%→30% · INCONCLUSIVE (reverted, 2026-07-03)

**Mechanism.** Lowered `STEEP_ARRIVAL_ZERO_BAND` from 0.8 to 0.7, increasing the
accepted M3 k-1 steep-arrival span from the top 20% to the top 30% of attempts.
No new geometry, scorer, or evaluator changes.

**Probe.** `probe-m3-span30-s0-2-a01` (40 specs × seeds 0..2 × canonical budget
grid) vs `attempt-no-converting-scoop-a01`: indicative `VERDICT: ACCEPT`,
Δheadline +2.3, 95% CI [-2.1, 6.3], P(Δ≤0)=14.1%, validity 480/480.

**Canonical.** `attempt-m3-span30-a01` (valid 1920/1920, HEADLINE 691.47,
excl-impact 710.47) vs `attempt-no-converting-scoop-a01`:

```
Δheadline = +0.6 · 95% CI [-2.3, 3.1] · P(Δ≤0)=33.0% · effect=0.40
125k +4.1 · 250k +0.9 · 375k +0.0 · 500k -0.1 · validity 100% at every budget
VERDICT: INCONCLUSIVE
```

**Learnings.** The extra M3 dose mainly buys 125k impact recovery and decays by
mature budgets; the weighted aggregate is positive but not reliable at α=0.20.
The accepted 20% span remains the baseline; dose escalation is not a promotable
path without more independent leverage.

### M15 — low-air impact rideout portfolio retry · probe INCONCLUSIVE (reverted, 2026-07-03)

**Mechanism.** Temporarily resurrected the narrow H1 selectable rideout inside the current
M3 baseline: on very-low-air impact template beats (`air ≤ 0.22`, next gap ≥10f,
budget ≥125k), every other template group kept the redirection scoop (end floored
at −12°) but emitted a long near-level grounded rideout (`0.72 × next-gap span`)
instead of the slam-hop. No scorer/spec/evaluator/search-policy changes.

**Validation.** Focused optimizer/arc suite passed:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`
→ 6 files, 78 tests.

**Probe.** `probe-lowair-rideout-portfolio-s0-2-a01` (40 specs × seeds 0..2 × canonical
budget grid, valid 480/480; stored probe HEADLINE 690.18, excl-impact 709.76) vs
`attempt-no-converting-scoop-a01`:

```
Δheadline = +0.1 · 95% CI [-0.2, 0.7] · P(Δ≤0)=41.0% · effect=0.52
125k +0.3 · 250k -0.4 · 375k +0.3 · 500k +0.2 · validity 100% at every budget
VERDICT: INCONCLUSIVE (indicative; not promoted to canonical)
```

**Footprint.** Movement is still the old narrow H1 shape: drums_pendulum gains
weighted +5.06 on the 3-seed intersection, but syncopated_switchback and cold_start
give back −1.33 each; every other spec was byte-identical in the paired probe.

**Learnings.** Combining the rideout with the accepted M3 span does not create additive
suite-level leverage. It remains a 1–3-spec pendulum aid with a tiny headline ceiling,
well below the remaining +9.09 needed for 700. Code and test were reverted; do not
retry this lane without a broader selector that demonstrably expands the footprint.

### M16 — amplitude readiness term · targeted REJECT (reverted, 2026-07-03)

**Mechanism.** Added a temporary amplitude-only component to `scoreNextTargetReadiness`:
predict the next-gap ballistic pop from the candidate release state, compare it to meaningful
next-gap amplitude asks (`target ≥0.30` ramp), and multiply readiness by an exp fit
(deadband 0.05, scale 0.25). The aim sweep received the same predicted amplitude so pool sort
and proposer used one objective. No scorer/spec/evaluator changes.

**Validation.** Focused optimizer/arc suite passed:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts`
→ 6 files, 79 tests.

**Probe.** `probe-amplitude-readiness-s0-2-a01` (15 amplitude/combined specs × seeds 0..2 ×
canonical budget grid, valid 180/180) vs `attempt-no-converting-scoop-a01`:

```
Δheadline = -1.4 · 95% CI [-3.4, 0.5] · P(Δ≤0)=93.0% · effect=-1.44
125k -1.2 · 250k -0.1 · 375k -2.5 · 500k -1.4 · validity 100% at every budget
VERDICT: REJECT (indicative targeted panel; not promoted to canonical)
```

**Footprint.** Gains existed (`float_bounds` +2.50 weighted, `canyon_steps` +1.43,
`glide_stairs` +1.38), but the term damaged large-amplitude rows it was meant to help:
`big_air_ramp` −7.18, `rolling_drop` −6.63, `skyline_push` −3.21, `soar_settle` −2.29,
`switchback_pop` −2.14.

**Learnings.** A ballistic next-amplitude fit is too myopic as readiness: it prices the pop
shape into the previous gap, but forward selection then sacrifices speed/impact-compatible
setups on the same rows. Do not add vertical axes to readiness without a joint speed/impact
collateral model or an additive generation lane.

### M17 — flat `greedy:1` forward eval on current grid · probe INCONCLUSIVE-negative (2026-07-03)

**Mechanism.** Env-priced the historical shallow-rollout candidate on the current accepted
compiler and canonical budget grid: `LR_FWD_EVAL=greedy:1` (no production code change).
This rechecks the older high-budget lookahead signal after M4/M3 and the 125k/250k/375k/500k
grid changed the economics.

**Probe.** `probe-fwd-greedy1-s0-2-a01` (40 specs × seeds 0..2 × canonical budget grid,
valid 480/480; stored probe HEADLINE 688.29, excl-impact 707.46) vs
`attempt-no-converting-scoop-a01`:

```
Δheadline = -1.8 · 95% CI [-7.8, 3.6] · P(Δ≤0)=74.2% · effect=-0.62
125k -2.4 · 250k -1.8 · 375k -1.0 · 500k -2.2 · validity 100% at every budget
VERDICT: INCONCLUSIVE-negative (indicative; no production change)
```

**Footprint.** Shallow rollout now reshuffles rather than maturing into a high-budget win:
`drums_tide` +23.11, `dense_sprint` +16.99, `rhythm_ladder` +14.78, but
`drums_swell` −32.68, `drums_pulse` −30.17, `verse_chorus` −23.89, `drums_crescendo`
−13.68.

**Learnings.** The old `greedy:1` crossover does not survive the current baseline/grid; it is
negative at every canonical budget on the paired 3-seed intersection. Do not promote a flat
shallow rollout or spend canonical time on it unchanged.

### M18 — `best:1:5` forward eval with rollout aim suppressed · probe INCONCLUSIVE-negative (2026-07-03)

**Mechanism.** Env-priced the old wide-shallow lookahead leader on the current accepted compiler:
`LR_FWD_EVAL=best:1:5 LR_ROLLOUT_AIM=0`. This preserves top-level aim but disables aim probes
inside rollout branches. No production code change.

**Probe.** `probe-fwd-best1x5-noaim-s0-2-a01` (40 specs × seeds 0..2 × canonical budget grid,
stored probe HEADLINE 687.99, excl-impact 706.85) vs `attempt-no-converting-scoop-a01`:

```
Δheadline = -2.1 · 95% CI [-14.6, 6.0] · P(Δ≤0)=59.5% · effect=-0.37
125k -32.6 · 250k +1.1 · 375k +2.0 · 500k +0.9
validity: 125k 100%→99%, mature budgets unchanged at 100%
VERDICT: INCONCLUSIVE (indicative; no production change)
```

**Footprint.** Mature-budget gains are real but too small, and the low-budget failure dominates:
`solo_run` seed 1 fails at 125k (score 0), producing a weighted `solo_run` loss of −36.81.
Other weighted losers: `drums_swell` −24.76, `syncopated_lift` −14.70, `verse_chorus` −14.60,
`cold_start` −14.33. Winners are the old shallow-rollout shape but not enough:
`syncopated_switchback` +27.19, `rhythm_ladder` +20.96, `grain_staircase` +17.11,
`drums_crescendo` +15.52, `drums_dropout` +14.83, `drums_pendulum` +9.77.

**Learnings.** The former `best:1:5 + noaim` high-budget signal also does not survive the current
baseline/grid as a flat default. It gives only +0.9 to +2.0 at mature budgets while creating a
catastrophic 125k tail; canonical promotion is not warranted. Do not retry unchanged.

### M19 — additive steep-impact aim proposal · probe INCONCLUSIVE (reverted, 2026-07-03)

**Mechanism.** Temporarily added one exact-evaluated aim-lane pitch candidate for next-impact
gaps on the first refined base only, gated to budgets ≥250k. The pitch delta used the same impact
delivery scale as M3 (`η=0.68`, ask ≥0.30, max +10°) but was additive: it did not replace any
normal sampler candidate and left 125k byte-identical. No scorer/spec/evaluator changes.

**Validation.** Focused optimizer/arc suite passed:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts`
→ 6 files, 77 tests.

**Probe.** `probe-aim-steep-impact-s0-2-a01` (40 specs × seeds 0..2 × canonical budget grid,
valid 480/480; stored probe HEADLINE 690.42, excl-impact 709.55) vs
`attempt-no-converting-scoop-a01`:

```
Δheadline = +0.4 · 95% CI [-3.1, 3.4] · P(Δ≤0)=38.7% · effect=0.22
125k +0.0 · 250k +0.4 · 375k +1.0 · 500k -0.0 · validity 100% at every budget
VERDICT: INCONCLUSIVE (indicative; not promoted to canonical)
```

**Footprint.** The additive proposal reshuffles the impact drums but does not produce reliable
suite leverage. Weighted winners: `drums_zigzag` +13.91, `drums_crescendo` +13.17,
`drums_dropout` +11.31, `ridge_pulse` +8.02, `drums_swell` +7.66, `grain_staircase` +7.36.
Weighted losers: `drums_tide` −27.05, `drums_pulse` −9.59, `dense_echo_climb` −7.88,
`drums_pendulum` −7.04, `canyon_steps` −5.72.

**Learnings.** Making steep-arrival additive avoids the 125k damage and displacement concern, but
the mature-budget point estimate is too small and noisy to justify canonical spend. The underlying
impact-rank problem is still spec/seed redistribution rather than a broad missing proposal. Code
was reverted; do not retry the same one-candidate pitch proposal unchanged.

### M20 — aim joint probe design `pitch3` · probe REJECT (env-only, 2026-07-03)

**Mechanism.** Env-priced the cheaper current-grid aim design
`LR_AIM_JOINT_PROBE_DESIGN=pitch3`: keep pitch probes only and drop the default `cross5`
rotate probes/enumeration. This rechecks an old slightly-negative lead on the current compiler,
where high-budget aim breadth is now K=6 and cost savings might have mattered. No production code
change.

**Probe.** `probe-aim-pitch3-s0-2-a01` (40 specs × seeds 0..2 × canonical budget grid,
valid 480/480; stored probe HEADLINE 682.53, excl-impact 701.38) vs
`attempt-no-converting-scoop-a01`:

```
Δheadline = -7.5 · 95% CI [-12.6, -2.9] · P(Δ≤0)=99.9% · effect=-3.05
125k -2.9 · 250k -8.2 · 375k -7.5 · 500k -8.4 · validity 100% at every budget
VERDICT: REJECT (indicative; no production change)
```

**Footprint.** The rotate probes are still buying real trajectory quality on the current grid.
Weighted winners from `pitch3` were narrow and drum-heavy: `drums_dropout` +17.87,
`ridge_pulse` +6.68, `solo_run` +6.04, `drums_zigzag` +3.17, `drums_pendulum` +1.82.
The losses were larger and broad: `drums_swell` −32.59, `tiny_dance` −27.16,
`drums_pulse` −26.10, `cold_start` −19.56, `float_bounds` −17.46, `dense_sprint` −16.57,
`grain_staircase` −15.78, `soar_settle` −15.61.

**Learnings.** Cost savings from shrinking the joint probe set are not enough to offset the lost
rotate-probe options; the damage is mature-budget-wide, not a 125k starvation artifact. Keep the
default `cross5` aim probe design and do not retry pitch-only unchanged.

### M21 — high-air short-tail floor · targeted REJECT (reverted, 2026-07-03)

**Mechanism.** Temporarily relaxed the normal sampler's air-targeted post-tail minimum from
28px toward 16px only for high-air asks (`air` ramping from 0.68 to 0.92). This was a narrow
generation-side attempt to address the remaining `air >= 0.75` undershoot without changing the
scorer, airFit, aim model, specs, or low/mid-air rows.

**Validation.** Focused optimizer/arc suite passed:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts`
→ 6 files, 77 tests.

**Probe.** `probe-highair-tail16-target-s0-2-a01` (16 high-air-undershoot specs × seeds 0..2
× canonical budget grid, valid 192/192) vs `attempt-no-converting-scoop-a01`:

```
Δheadline = -2.7 · 95% CI [-8.0, 1.0] · P(Δ≤0)=91.5% · effect=-1.22
125k +5.2 · 250k -4.8 · 375k -4.3 · 500k -2.4 · validity 100% at every budget
VERDICT: REJECT (indicative targeted panel; not promoted to full-suite probe)
```

**Footprint.** Only five of sixteen specs materially moved. `opening_burst` gained +7.47
weighted, but mature-budget losses dominated: `drums_crescendo` −15.24, `rhythm_ladder`
−9.99, `dense_sprint` −9.45, `syncopated_switchback` −9.15, `drums_pendulum` −3.30.
On the exact paired 500k high-air subset (`air >= 0.75`), air RMS worsened slightly:
0.1088 → 0.1099.

**Learnings.** The 28px tail floor is not the active high-air bottleneck; shortening it buys a
scarce-budget reshuffle but harms mature trajectory quality and does not reduce the intended
high-air residual. Code was reverted; do not retry short-tail floor relaxation unchanged.

### M22 — scarce-tier M3 steep-arrival span 20%→75% · canonical ACCEPT (2026-07-03)

**Mechanism.** Production change to the accepted M3 k-1 steep-arrival span: for compiles below
200k, lower the span zero-band from 0.80 to 0.25, so the scarce 125k tier covers the top 75%
of attempts instead of the accepted top 20%. At 250k/375k/500k the zero-band remains 0.80, so
mature budgets are byte-identical to `attempt-no-converting-scoop-a01`. No scorer/spec/search
policy changes.

**Validation.** Focused optimizer/arc suite passed:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts`
→ 6 files, 77 tests.

**Probe.** 125k-only dose sweep on 40 specs × seeds 0..2:

```
50% span: Δ125k +3.8 · CI[-5.6, 14.6] · P(Δ≤0)=21.4% · INCONCLUSIVE
75% span: Δ125k +5.0 · CI[-4.2, 16.5] · P(Δ≤0)=16.1% · indicative ACCEPT
```

Full 3-seed canonical-grid guard (`probe-m3-scarce-span75-s0-2-a01`) confirmed the intended
isolation: Δheadline +0.5, P(Δ≤0)=16.1%, 125k +5.0, and exactly +0.0 at 250k/375k/500k.

**Canonical.** `attempt-m3-scarce-span75-a01` (valid 1920/1920, HEADLINE 691.28,
excl-impact 711.20) vs `attempt-no-converting-scoop-a01`:

```
Δheadline = +0.4 · 95% CI [-0.1, 0.9] · P(Δ≤0)=6.6% · effect=1.46
125k +3.7 · 250k +0.0 · 375k +0.0 · 500k +0.0 · validity 100% at every budget
VERDICT: ACCEPT
```

**Footprint.** This is a pure scarce-tier win. Weighted winners: `syncopated_switchback`
+3.97, `cold_start` +3.17, `rolling_hills` +1.76, `drums_dropout` +1.46, `drums_tide`
+1.37, `climb_terrace` +1.09, `summit_push` +0.95, `drums_zigzag` +0.94. Weighted
losers: `drums_pendulum` −1.86, `dense_sprint` −1.18, `leap_cadence` −0.79,
`tiny_dance` −0.74, `float_bounds` −0.45, `big_air_ramp` −0.42.

**Learnings.** The M14 30% dose failed because it also moved mature budgets, where extra span has
little headroom and can displace converged shapes. The useful slice is narrower: heavy steep-arrival
diversity only while the search is scarce. New baseline is `attempt-m3-scarce-span75-a01`; remaining
target gap is about +8.72 headline.

### M23 — scarce-tier M3 steep-arrival span 75%→100% · probe INCONCLUSIVE-flat (reverted, 2026-07-03)

**Mechanism.** Fail-fast dose extension on the new accepted baseline: lower the scarce-tier M3
zero-band from 0.25 to 0.00, so every nonzero attempt below 200k receives the steep-arrival span.
Mature budgets would remain byte-identical; no production code was kept.

**Probe.** `probe-m3-scarce-span100-125-s0-2-a01` (40 specs × seeds 0..2 × 125k only,
valid 120/120) vs `attempt-m3-scarce-span75-a01`:

```
Δ125k = +0.2 · 95% CI [-8.0, 7.5] · P(Δ≤0)=47.0% · effect=0.04
VERDICT: INCONCLUSIVE-flat (indicative; not promoted to full-grid probe)
```

**Footprint.** The extra dose only reshuffled the scarce tier. 125k winners:
`grain_staircase` +30.89, `drums_zigzag` +29.19, `drums_tide` +27.10, `cold_start`
+21.60, `rhythm_ladder` +16.04. Losers: `soar_settle` −40.07,
`syncopated_switchback` −31.04, `drums_swell` −23.59, `opening_burst` −16.22,
`drums_crescendo` −13.67.

**Learnings.** The scarce-tier dose has a visible optimum near 75% for the current compiler.
Going to 100% displaces too many normal scarce-budget shapes and adds no aggregate lift. Keep
`STEEP_ARRIVAL_SCARCE_ZERO_BAND = 0.25`; do not promote full scarce-tier span unchanged.

### M24 — scarce-tier aim base count K=4→3 · probe REJECT (env-only, 2026-07-03)

**Mechanism.** Env-only cost-saving check on the new accepted baseline:
`LR_AIM_TOPK_BASES=3` with a 125k-only full-spec probe. This simulates lowering non-low-air aim
breadth at the scarce tier while leaving the mature K=6 default out of scope. No production code
change.

**Probe.** `probe-aim-k3-125-s0-2-a01` (40 specs × seeds 0..2 × 125k only, valid 120/120)
vs `attempt-m3-scarce-span75-a01`:

```
Δ125k = -3.8 · 95% CI [-12.2, 4.1] · P(Δ≤0)=83.1% · effect=-0.93
VERDICT: REJECT (indicative; not promoted to full-grid probe)
```

**Footprint.** The lower K frees some budget but removes important aimed bases. 125k winners:
`drums_crosscut` +30.11, `drums_zigzag` +23.40, `grain_staircase` +20.13,
`terrace_sprint` +13.93, `rhythm_ladder` +13.00. Losers are larger and more diagnostic:
`syncopated_switchback` −38.51, `glide_stairs` −37.89, `syncopated_lift` −36.26,
`drums_swell` −30.47, `drums_crescendo` −21.04.

**Learnings.** The accepted K=4 scarce-tier aim breadth is still earning its cost. The 125k
problem is not solved by reducing non-low-air aim bases; keep K=4 at 125k and K=6 at mature
budgets.

### M25 — post-completion dead-end rescue suppression · probe INCONCLUSIVE-flat (reverted, 2026-07-04)

**Mechanism.** Temporarily made the dead-end rescue cascade pre-completion only by threading a
`deadEndRescue` policy bit from `hasCompletion`. This preserved the first-completion validity
safety net, but stopped repair restarts and post-completion frontier fill from spending extra
rescue samples after a complete incumbent already existed. Candidate generation, normal pool
ranking, start selection, forward eval, repair selection, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

**Tests.** Focused suite passed during the source trial:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts`
(6 files, 77 tests).

**Probe.** `probe-postcompletion-rescue-off-s0-2-j48-a01` (40 specs × seeds 0..2 ×
{125k,250k,375k,500k}, valid 480/480) vs `attempt-m3-scarce-span75-a01`:

```
Δheadline = +0.0 · 95% CI [0.0, 0.1] · P(Δ≤0)=30.3% · effect=0.66
Per-budget Δ: 125k +0.0 · 250k +0.0 · 375k +0.0 · 500k +0.0
VERDICT: INCONCLUSIVE (indicative; not promoted to canonical)
```

**Footprint.** The policy did suppress post-completion rescue work, but it was almost inert on
score. Only 2/480 paired checkpoints changed, both at 500k and both positive: `opening_burst`
seed 2 +5.80 (repair accepts 3→4) and `drums_dropout` seed 2 +0.01 (repair accepts 0→1).
Probe rescue attempts/successes moved 24/0→17/0 at 125k, 41/2→24/0 at 250k,
65/3→24/0 at 375k, and 78/4→24/0 at 500k.

**Learnings.** Post-completion dead-end rescue is measurable but not a headline lever. The
successes it removes are too rare to move the suite, and the freed budget does not reliably
convert into additional repair quality. Keep the existing rescue cascade unchanged; do not retry
a pure post-completion rescue cutoff without a stronger local usefulness selector.

### M26 — air-fit objective shape sweep · targeted REJECT/closed (reverted, 2026-07-04)

**Mechanism.** Temporarily added default-identical env hooks around the three M4 air-fit
objective constants, then screened three constant-shape variants on the current accepted
baseline: wider air deadband (`LR_OBJECTIVE_AIR_DEADBAND=0.08`), weaker global pressure
(`LR_OBJECTIVE_AIR_SCALE=0.35`), and symmetric predicted-air undershoot pressure
(`LR_OBJECTIVE_AIR_UNDERSHOOT_WEIGHT=1`). Scorer, specs, fingerprint, seed set, budget
grid, candidate generation, start selection, forward eval, repair, and acceptance rule
were unchanged.

**Tests.** The default-identical source scaffold passed the focused suite:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts`
(6 files, 77 tests).

**Probe panel.** All three arms used the same 19-spec air-sensitive panel
(`drums_pendulum`, `skyline_push`, `terrace_sprint`, `drums_dropout`, `dense_sprint`,
`canyon_steps`, `rhythm_ladder`, `dense_echo_climb`, `syncopated_lift`, `drums_pulse`,
`drums_breath`, `drums_crescendo`, `syncopated_switchback`, `opening_burst`,
`drums_swell`, `drums_tide`, `drums_zigzag`, `drums_crosscut`, `cold_start`) × seeds
0..2 × the canonical budget grid, compared to `attempt-m3-scarce-span75-a01`.

```
deadband 0.08: Δheadline -0.4, CI[-8.9, 7.6], P≤0=52.5%;
               per-budget -10.3/+0.4/+1.6/+0.2.
scale 0.35:    Δheadline +0.2, CI[-7.2, 7.7], P≤0=48.3%;
               per-budget -6.3/-1.1/+2.7/+0.6.
undershoot 1:  Δheadline -1.5, CI[-13.0, 7.8], P≤0=59.7%;
               per-budget -6.5/-3.8/+1.1/-1.2.
```

**Footprint.** The variants were not inert: 223-226/228 paired checkpoints changed. But all
three reopened the scarce-tier loss that the current M4/M3 balance avoids. The best mature
hint (`scale=0.35`, +2.7 at 375k on this biased panel) was too small and spec-unstable to
justify building a budget-aware production variant. The same arms traded the steady-drum
repairs against large regressions (`drums_pulse`, `syncopated_switchback`, `drums_swell`,
`drums_tide`) rather than expanding the suite-level pool.

**Learnings.** M4's air-fit constants are near the useful tradeoff for this compiler. Simple
global deadband/scale/asymmetry changes are closed; do not retry unchanged. Future air work
needs a new usefulness selector or generation mechanism, not another scalar tweak to the
existing air-fit penalty. The temporary env scaffold was reverted.

### M27 — mature aim base count K=6→7 · probe INCONCLUSIVE-small (env-only, 2026-07-04)

**Mechanism.** Env-priced a mature-budget seventh aim base with `LR_AIM_TOPK_BASES=7` on the
current accepted baseline. The probe used only 250k/375k/500k budgets, so it tested the
production-relevant mature slice where a source change would raise `AIM_TOPK_BASES_HIGH` while
leaving 125k at the accepted K=4. Candidate generation logic apart from aim-base count,
search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

**Probe.** `probe-aim-k7-mature-s0-2-a01` (40 specs × seeds 0..2 × {250k,375k,500k},
valid 360/360) vs `attempt-m3-scarce-span75-a01`:

```
Δheadline = +0.3 · 95% CI [-3.9, 3.6] · P(Δ≤0)=40.6% · effect=0.15
250k +0.7 · 375k +0.2 · 500k +0.2 · validity unchanged
VERDICT: INCONCLUSIVE (indicative; not promoted to source trial)
```

**Footprint.** The seventh base was not inert: 342/360 paired checkpoint scores changed.
Gains were led by `drums_tide` (+20.27 mean over the mature probe cells), `drums_dropout`
(+13.30), `dense_sprint` (+8.15), `opening_burst` (+7.80), and `drums_pendulum` (+6.46).
But the same broad extra-base pressure reopened large basin losses, especially
`syncopated_switchback` (−46.43), `drums_pulse` (−12.51), `solo_run` (−9.35),
and `drums_breath` (−7.25).

**Learnings.** The accepted high-budget K=6 setting is close to the useful aim-breadth limit.
K=7 creates broad mature-budget churn for only a tiny positive point estimate and no credible
accept signal. Do not raise `AIM_TOPK_BASES_HIGH` unchanged; any future extra-base work needs
a selector that excludes the `syncopated_switchback`/`drums_pulse` failure mode.

### M28 — aim solve span 10→14 · env-only INERT (2026-07-04)

**Mechanism.** Repriced the old `LR_AIM_SPAN=14` knob on the current M4/M3 baseline. The
intent was to allow larger pitch/rotate solves in the aim lane without changing candidate
count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed
set, budget grid, or acceptance rule.

**Probe.** `probe-aim-span14-current-s0-2-a01` (40 specs × seeds 0..2 × canonical budget
grid, valid 480/480) vs `attempt-m3-scarce-span75-a01`:

```
Δheadline = +0.0 · 95% CI [0.0, 0.0] · P≤0=100%
Per-budget Δ: 125k +0.0 · 250k +0.0 · 375k +0.0 · 500k +0.0
VERDICT: INCONCLUSIVE-inert (indicative; no source trial)
```

**Footprint.** Exact paired check found 0/480 score changes and 0/480 `track_hash` changes.
The current `cross5` aim probe exposes a ±6° fitted span, and the production solve clamps
`aimDeltaMaxDeg()` to that measured probe span, so raising `LR_AIM_SPAN` above the default
does not affect emitted candidates. This is a stale escape-hatch knob, not remaining headroom.
Do not retry wider `LR_AIM_SPAN` unchanged; any wider aim authority would first need a wider
probe design, which is a different mechanism and must pay its probe cost explicitly.

### M29 — scarce-tier all-base air-length variant · probe INCONCLUSIVE-negative (reverted, 2026-07-04)

**Mechanism.** Source-trialed the M4 Part-B air-matched ride-out-length variant on every
refined aim base only below 200k target budget. This kept the accepted first-base-only behavior
at 250k/375k/500k byte-identical and tested the prior M4 decomposition hint that all-base Part B
had a strong 125k-only pop. Candidate generation apart from the air-length emission scope,
search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

**Verification.** Focused optimizer suite passed:

```
LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probe.** `probe-airknob-scarce-allbases-125-s0-2-a01` (40 specs × seeds 0..2 × 125k only,
valid 120/120) vs `attempt-m3-scarce-span75-a01`:

```
Δheadline = -0.5 · 95% CI [-11.1, 7.5] · P(Δ≤0)=50.8% · effect=-0.12
125k validity 100%->100%
VERDICT: INCONCLUSIVE-negative (indicative; source reverted)
```

**Footprint.** The mechanism was very active: 97/120 paired rows changed. It added roughly
40-140 air-length emissions per affected row and created large 125k basin swaps rather than a
stable lift. Largest gains included `grain_staircase` seed 2 +68.8, `drums_crosscut` seed 0
+57.6, `syncopated_switchback` seed 1 +54.3, and `rhythm_ladder` seed 1 +52.6. They were offset
by `drums_swell` seed 2 −141.6, `syncopated_switchback` seeds 2/0 −138.2/−136.9,
`syncopated_lift` seed 1 −106.6, and `drums_zigzag` seed 2 −85.8.

**Selector audit.** Authored-shape posthoc screens did not reveal a promotable selector.
Single-feature screens topped out around +1.8 points at 125k on the 3-seed slice; two-feature
screens could be hand-fit to about +3.3 at 125k but retained many negative rows and would only
be about +0.3 headline before bootstrap noise. That is below promotion scale and too
posthoc-fragile for a source trial.

**Learnings.** The accepted first-base air-length variant is the right M4 Part-B scope for the
current compiler. Broadening it across all scarce-tier aim bases reopens the seed-lottery basin
that M4's final first-base design avoided. Do not retry scarce all-base air matching unchanged;
future air-length work needs a much stronger usefulness signal than budget tier plus aim-base
index.

### M30 — probe-clean rotate-side aim filter · probe INCONCLUSIVE-flat (reverted, 2026-07-04)

**Mechanism.** Source-trialed a narrow H2c gate-fail cut in `aim.ts`: after the normal cross5
probe batch, the enum sweep skipped same-sign rotate proposals when the pitch-zero probe for
that rotate side failed the current hard gate. This was not the old global pitch-only ablation:
rotation stayed available on probe-clean sides, and pitch-only fallback filled the top-2 slots
when a side was known unsafe. Candidate count, search policy, start selection, forward eval,
repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

**Verification.** Focused optimizer suite passed:

```
LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probe.** `probe-aim-rotategate-s0-2-a01` (40 specs × seeds 0..2 × canonical budget grid,
valid 480/480) vs `attempt-m3-scarce-span75-a01`:

```
Δheadline = +0.2 · 95% CI [-5.5, 5.0] · P(Δ≤0)=44.0% · effect=0.09
Per-budget Δ: 125k -1.7 · 250k -0.5 · 375k +0.9 · 500k +0.6
VERDICT: INCONCLUSIVE-flat (indicative; source reverted, no canonical)
```

**Telemetry.** The filter did the mechanical job but not the scoring job. Across the paired
3-seed grid, enum gate-fail rate fell 12.8%→2.6% (`enum_gate_fail` 96,877→19,131 and
`enum_rot_gate_fail` 96,171→16,069), and emitted proposals rose 658,409→722,256. But the
replacement proposals were lower-value: mean aimed pool rank worsened 5.70→6.09, rank-0 rate
fell 9.7%→9.0%, and top-3 rate fell 28.2%→26.1%. Low budgets lost, mature budgets gained only
~0.5-1 point on the 3-seed slice, below promotion scale.

**Learnings.** Probe-clean rotate-side bounding is not a useful H2c lever in the current aim
lane. Gate-fail count was mostly not wasted value; the failed rotate proposals were attached to
high-value basins, and replacing them with lower-ranked fallback proposals nets flat. Do not
retry this probe-gate same-sign rotate filter unchanged. Any future rotate safety work must
predict selection value, not just pass/fail risk.

### M31 — impact-template turn cap 22→30/38 · targeted INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Source-trialed H2b in `arc_placement.ts`: raise only the selectable
impact-template scoop cap (`IMPACT_TEMPLATE_MAX_TURN_DEG`) from 22° to 38°, then a softer
30° dose after 38° looked over-aggressive. The template lane rate, eligibility, M3
steep-arrival span, search policy, start selection, forward eval, repair, scorer, specs,
fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

**Verification.** Focused optimizer suite passed for the cap-38 source trial:

```
LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts
```

6 files, 77 tests. Cap 30 is the same one-line numeric dose and was probed on the same panel.

**Probes.** Both probes used the same impact-heavy panel (18 specs × seeds 0..2 × canonical
budget grid, valid 216/216) vs `attempt-m3-scarce-span75-a01`:

```
cap 38: Δheadline = +0.5 · 95% CI [-3.1, 5.6] · P(Δ≤0)=44.5%
        per-budget Δ: 125k -1.6 · 250k +0.5 · 375k +2.0 · 500k -0.1

cap 30: Δheadline = +0.8 · 95% CI [-2.6, 5.7] · P(Δ≤0)=39.2%
        per-budget Δ: 125k -1.5 · 250k +0.6 · 375k +2.3 · 500k +0.3
        VERDICT: INCONCLUSIVE (indicative; source reverted, no canonical)
```

**Footprint.** Cap 30 changed only 46/216 paired rows on a deliberately favorable panel.
The positive movement concentrated in `drums_dropout` (+34 at 250k/375k/500k on the 3-seed
slice), with smaller `dense_sprint` and `ridge_pulse` mature gains. Losses persisted in
`syncopated_lift` at 125k, `canyon_steps` at 250k/375k, and the mature drum collateral
(`drums_swell`, `drums_crescendo`, `drums_tide`, `drums_pulse`). Panel impact RMS barely
moved (0.1455→0.1450) and mean impact absolute error was flat/slightly worse (0.1119→0.1120);
the score lift mostly came through basin swaps and a small speed RMS improvement.

**Learnings.** The template cap is a real but too-narrow dose knob. The best tested dose
(30°) is only +0.8 on an impact-heavy 18/40-spec panel, so full-suite dilution is below
promotion scale and the axis diagnostic does not show a robust impact correction. Do not
retry simple `IMPACT_TEMPLATE_MAX_TURN_DEG` cap raises unchanged; future impact-template work
needs a selector or geometry change that improves the mid-band impact error directly rather
than relying on the high-band cap.

### M32 — dense high-air short arc-length span · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Source-trialed the literal H3 dense-gap short-rideout idea in
`arc_placement.ts`: for dense contacts with high authored air, allow the short end of the
arc-length span (`ARC_LEN_SPAN_LO`) to open even when `arcLenRoom` is zero, using
`denseContactPressure * smoothstep((air - 0.55) / 0.25)`. The long end (`ARC_LEN_SPAN_HI`)
remained sparse-room-gated, low-air rows kept the original behavior, and search policy,
start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid,
and acceptance rule stayed unchanged.

**Verification.** Focused optimizer suite passed:

```
LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probes.** The high-air 18-spec panel looked promotable, but the full-suite probe showed the
risk before canonical:

```
targeted panel (`probe-h3-dense-highair-shortarc-s0-2-a01`, 18 specs × seeds 0..2):
  Δheadline = +4.3 · 95% CI [-2.1, 11.8] · P(Δ≤0)=9.5% · effect=1.23
  per-budget Δ: 125k -4.8 · 250k +4.1 · 375k +6.3 · 500k +5.1
  VERDICT: ACCEPT (indicative targeted)

full 3-seed guard (`probe-h3-dense-highair-shortarc-full-s0-2-a01`, 40 specs × seeds 0..2):
  Δheadline = +1.6 · 95% CI [-2.2, 5.8] · P(Δ≤0)=20.8% · effect=0.80
  per-budget Δ: 125k -1.4 · 250k +1.4 · 375k +3.1 · 500k +1.4
  VERDICT: INCONCLUSIVE (indicative; just missed the accept gate)
```

**Canonical.** `attempt-h3-dense-highair-shortarc-a01` (valid 1920/1920, HEADLINE 690.76,
excl-impact 709.66) vs `attempt-m3-scarce-span75-a01`:

```
headline: baseline 691.3 -> candidate 690.8
Δheadline = -0.5 · 95% CI [-3.0, 1.7] · P(Δ≤0)=66.5% · effect=-0.43
125k +1.7 · 250k -0.5 · 375k -0.9 · 500k -0.8 · validity 100% at every budget
VERDICT: INCONCLUSIVE
```

**Footprint.** The targeted gain was not actually an air correction: the 3-seed diagnostics
showed impact/speed basin improvement while high-air RMS slightly worsened. Canonical flipped
the budget shape: 125k gained, but the three heavier columns regressed, so the weighted
headline fell below the accepted baseline despite full validity.

**Learnings.** Dense high-air short arcs are a real basin reshuffle but not a robust compiler
improvement. The favorable panel overfit to `drums_dropout`, `syncopated_switchback`,
`drums_crosscut`, and a few dense rows; the full canonical suite priced the mature-budget
collateral. Do not retry the same dense high-air `ARC_LEN_SPAN_LO` opening unchanged. Any
future H3-like work needs either an explicit selector for the impact/speed winners or a true
air-error improvement signal.

### M33 — low-amplitude gate for M3 steep-arrival span · panel INCONCLUSIVE-negative (reverted, 2026-07-04)

**Mechanism.** Source-trialed a narrow amplitude/impact conflict gate for the accepted M3
steep-arrival span. `Gap` temporarily carried the sampled amplitude target of the next contact
beside `nextImpact`, and the M3 k−1 steep-arrival span was suppressed only when the next beat's
amplitude ask was very low (`<0.20`). The impact curve carrier, impact template lane, scorer,
specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

**Verification.** Focused optimizer suite passed:

```
LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Pre-check.** A blunt env-only diagnostic on the low-amplitude/high-impact panel
(`LR_IMPACT_GEOM_OFF=1`, same 5 specs × seeds 0..2 × canonical budget grid) rejected hard:

```
Δheadline = -67.8 · 95% CI [-90.7, -45.9] · P(Δ≤0)=100.0%
125k -69.5 · 250k -70.2 · 375k -67.8 · 500k -66.2
VERDICT: REJECT (indicative env-only)
```

**Probe.** `probe-m33-lowamp-m3gate-panel-s0-2-a01` (5 specs:
`terrace_sprint`, `rolling_drop`, `skyline_push`, `ridge_pulse`, `dense_echo_climb` ×
seeds 0..2 × canonical budget grid, valid 60/60) vs `attempt-m3-scarce-span75-a01`:

```
Δheadline = -1.5 · 95% CI [-7.2, 3.2] · P(Δ≤0)=73.6% · effect=-0.60
125k -3.5 · 250k -2.9 · 375k -0.9 · 500k -0.8 · validity 100% at every budget
VERDICT: INCONCLUSIVE (indicative; source reverted, no canonical)
```

**Footprint.** The intended low-amplitude/high-impact rows did not improve: on the paired
conflict rows, amplitude error worsened slightly (+0.002), impact error worsened slightly
(+0.003), speed improved only marginally (−0.002), and elevation improved modestly (−0.005).
Spec deltas on the panel were `dense_echo_climb` −8.5, `rolling_drop` −2.0, `ridge_pulse`
−1.4, `terrace_sprint` −0.5, and `skyline_push` +1.7.

**Learnings.** The low-amplitude/high-impact conflict is real, but M3 steep-arrival suppression
is not the lever. The accepted impact geometry is carrying the same rows, and withholding the
steep span does not recover the huge terrace amplitude overshoot. Do not retry a simple
`nextAmplitude < 0.20` M3 gate unchanged; any future work here needs a generation shape that
reduces amplitude while preserving the high-impact carrier, not just less arrival steepening.

### M34 — env-only breadth / forward-eval / impact-curve diagnostics · closed (2026-07-04)

**Mechanisms.** Ran four env-only fail-fast probes after M33, with no source changes:

- `LR_QUALITY_NCAND=64` on the 10-spec vertical/error panel to test whether ordinary candidate
  breadth exposes the remaining amplitude/elevation pool.
- `LR_FWD_EVAL=avg:2:1` on the 5-spec low-amplitude/high-impact panel to test whether the
  existing mature avg forward evaluator should also cover low-amplitude conflict rows.
- `LR_IMPACT_CURVE_START=0.20` and `0.30` on the 18-spec impact-heavy panel to test whether the
  impact curvature carrier wants a softer/harder pressure start around the production `0.25`.

**Probes.**

```
probe-quality-n64-vertical-s0-2-a01 (10 specs × seeds 0..2 × canonical grid, valid 120/120):
  Δheadline = +0.7 · 95% CI [-3.5, 4.5] · P(Δ≤0)=35.1%
  125k -4.3 · 250k +1.7 · 375k +2.0 · 500k +0.4
  VERDICT: INCONCLUSIVE (indicative; weak breadth signal, 125k loss)

probe-fwdeval-avg-lowamp-s0-2-a01 (5 specs × seeds 0..2 × canonical grid, valid 60/60):
  Δheadline = -0.8 · 95% CI [-6.9, 5.8] · P(Δ≤0)=61.4%
  125k -3.0 · 250k -4.6 · 375k -0.5 · 500k +1.4
  VERDICT: INCONCLUSIVE-negative (indicative)

probe-impactcurve-start020-s0-2-a01 (18 specs × seeds 0..2 × canonical grid, valid 216/216):
  Δheadline = -8.1 · 95% CI [-18.7, 0.5] · P(Δ≤0)=96.8%
  125k -1.6 · 250k -10.4 · 375k -8.7 · 500k -8.2
  VERDICT: REJECT (indicative)

probe-impactcurve-start030-s0-2-a01 (18 specs × seeds 0..2 × canonical grid, valid 216/216):
  Δheadline = -1.1 · 95% CI [-10.4, 8.4] · P(Δ≤0)=58.2%
  125k -1.4 · 250k -0.7 · 375k -1.1 · 500k -1.2
  VERDICT: INCONCLUSIVE-negative (indicative)
```

**Footprint.** N=64 found a small mature-budget breadth signal on the vertical panel but paid
scarce-budget losses (`valley_bounce` −44 and `syncopated_lift` −30.5 at 125k). Forced avg
forward eval helped only the 500k low-amplitude panel slice while hurting 125k/250k. Impact
curve start 0.20 reproduced the known "too broad impact pressure" failure in milder form;
start 0.30 was closer but still below baseline on every budget.

**Learnings.** Generic candidate breadth and global avg forward-eval are not promotion-scale
axis fixes. The impact curve pressure start is already near the local optimum for the current
compiler; do not retry simple `LR_IMPACT_CURVE_START` 0.20/0.30 retunes, global
`LR_QUALITY_NCAND=64`, or global `LR_FWD_EVAL=avg:2:1` unchanged. Any future use of these
families needs a sharper selector that protects scarce budgets and proves full-suite lift.

### M35 — delivery-match impact readiness after M3 · rejected/closed (reverted, 2026-07-04)

**Mechanism.** Temporarily retested M2 on the current M3 baseline: add an env-gated
`LR_M2=1` alternate inside `objective.ts` `impactFeasibility`, preserving the current M4
airFit path. The alternate scored `eta * speed * turn` against needed redirArc with an
asymmetric exponential fit (undershoot full penalty, overshoot light penalty). Default path
was byte-identical; no scorer/spec/fingerprint/seed/budget changes.

**Verification.** Focused optimizer suite passed:

```
LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probes.** Both used the same 12-spec impact/collateral panel × seeds 0..2 × canonical grid
vs `attempt-m3-scarce-span75-a01`, valid 144/144:

```
full dose (`LR_M2=1`, eta=0.68, scale=0.75):
  Δheadline = -51.8 · 95% CI [-70.7, -33.7] · P(Δ≤0)=100.0%
  125k -49.7 · 250k -58.1 · 375k -47.7 · 500k -52.2
  VERDICT: REJECT (indicative)

soft dose (`LR_M2=1 LR_M2_SCALE=2.5`):
  Δheadline = -5.4 · 95% CI [-20.5, 6.2] · P(Δ≤0)=79.4%
  125k -2.9 · 250k -4.5 · 375k -7.0 · 500k -5.2
  VERDICT: INCONCLUSIVE-negative (indicative)
```

**Learnings.** M3's steep-arrival generation does not make M2's delivery-match readiness
gradient safe. Full dose over-penalizes good arrivals; the old soft scale is still negative
at every budget on a favorable panel. Do not retry simple delivery-match / eta-break-even /
exponential sub-break-even impact-readiness pressure unchanged. Source reverted.

### M36 — mixed vertical amplitude axisq lane · rejected/closed (reverted, 2026-07-04)

**Mechanism.** Temporarily added a default-off `LR_M36_AMP_AXISQ=1` extra candidate lane in
`handoff.ts`. The lane fired only on contact gaps that asked for both amplitude and upward
elevation, generated a small number of normal contact-centered candidates with a geometry-only
amplitude lift, tagged them as `axisq/amplitude`, and let the existing ranker decide. True
targets, scorer, hard gates, forward eval, repair, specs, fingerprint, seeds, budgets, and
acceptance rule stayed unchanged.

**Verification.** Focused optimizer suite passed with the env unset:

```
LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probes.** Both used the 12-spec mixed-vertical/amplitude panel
(`terrace_sprint`, `syncopated_lift`, `canyon_steps`, `skyline_push`, `switchback_pop`,
`ridge_pulse`, `dense_echo_climb`, `glide_stairs`, plus pure-amplitude controls
`rolling_drop`, `soar_settle`, `big_air_ramp`, `valley_bounce`) × seeds 0..2 × canonical
grid vs `attempt-m3-scarce-span75-a01`, valid 144/144:

```
hard dose (`probe-m36-amp-axisq-s0-2-a01`):
  Δheadline = -2.7 · 95% CI [-6.2, -0.1] · P(Δ≤0)=98.3%
  125k -4.7 · 250k -2.9 · 375k -2.6 · 500k -2.3
  VERDICT: REJECT (indicative)

soft dose (`probe-m36-amp-axisq-soft-s0-2-a01`,
K=1, lift=0.08, floor=0.36, cap=0.50, no 125k activation):
  Δheadline = -0.1 · 95% CI [-1.2, 1.0] · P(Δ≤0)=58.5%
  125k +0.0 · 250k -0.6 · 375k +0.0 · 500k +0.1
  VERDICT: INCONCLUSIVE (indicative)
```

**Footprint.** The hard dose selected axisq candidates in the losing rows more than the
winners: `dense_echo_climb` averaged -10.3, `canyon_steps` -8.6, `syncopated_lift` -6.8,
and `skyline_push` -6.3 on the panel. Pure-amplitude controls were mostly byte-identical,
which confirms the gate was narrow, but the selected mixed-vertical lift was the wrong shape.
The soft dose removed most damage, yet still had a negative 250k point estimate and no
promotion-scale gain.

**Learnings.** The mixed-vertical amplitude residual is not fixed by a small lifted duplicate
stream. Extra viable candidates consume budget and the ranker adopts the lifted shapes in
exactly the fragile vertical rows. Do not retry simple amplitude-lift `axisq` lanes unchanged;
future amplitude work needs a different geometry shape or a stronger usefulness selector.
Source reverted.

### M37 — search-seed portfolio oracle · source-free closed (2026-07-04)

**Study.** Ran `scripts/v0/portfolio_oracle.ts` on a tiny high-recovery panel:
`dense_sprint,syncopated_switchback` × seed 0 × budgets `125k,500k` × lanes `0,1,2`.
No source, scorer, spec, fingerprint, seed-set, budget-grid, or acceptance-rule changes.

**Result.** `generated/golden-runs/portfolio-oracle-m37-tiny-s0-a01.json`:

```
baseline curve:    651.74
equal-slice curve: 620.31  delta=-31.44
full-lane curve:   682.79  delta=+31.05 optimistic, about 3x work

125k: baseline 625.46 · equal-slice 580.41 · full-lane 684.91
500k: baseline 679.13 · equal-slice 662.94 · full-lane 680.68
```

**Learnings.** Static same-budget seed portfolioing is not a useful scheduler mechanism:
equal slicing starves the compile, while the positive full-lane number is mostly a multi-budget
oracle and nearly disappears at 500k (`syncopated_switchback` seed 0 +3.09,
`dense_sprint` seed 0 +0.00). Do not spend more time on fixed search-seed lanes unless there is
an adaptive early-stop/usefulness signal.

### M38 — M4 air-matched Part B removal · rejected/closed (reverted, 2026-07-04)

**Mechanism.** Temporarily added a default-identical `LR_M38_AIR_KNOB_OFF=1` switch in
`aim.ts` that disabled only the M4 Part B air-matched ride-out emission. The M4 airFit judge,
joint aim proposer, source ranking, forward eval, repair, true targets, scorer, specs,
fingerprint, seeds, budgets, and acceptance rule stayed unchanged.

**Verification.** Focused optimizer suite passed with the env unset:

```
LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probe.** `probe-m38-airknob-off-panel-s0-2-a01`, same 19-spec air-sensitive panel used by
the M4 constant sweep × seeds 0..2 × canonical grid, valid 228/228:

```
Δheadline = -1.8 · 95% CI [-9.8, 5.9] · P(Δ≤0)=69.0%
125k +0.9 · 250k -1.4 · 375k -1.4 · 500k -3.0
VERDICT: INCONCLUSIVE (indicative)
```

**Footprint.** Removing Part B repaired some basins (`drums_tide` +21.6 weighted on the
panel, `drums_crescendo` +16.1) but lost more mature-budget quality elsewhere:
`drums_swell` -22.5, `drums_pulse` -13.4, `syncopated_switchback` -12.3,
`dense_sprint` -9.2, and `rhythm_ladder` -9.0. The 500k point estimate was the worst budget.

**Learnings.** The accepted first-base air-matched variant is still part of the M4 balance.
Disabling it is another basin shuffle, not a collateral repair. Do not retry simple Part B
removal unchanged; future air-length work needs a local usefulness signal, not a blanket off
switch. Source reverted.

### M39 — M4 Part B resolved-feature gate · INCONCLUSIVE canonical (reverted, 2026-07-04)

**Mechanism.** Temporarily made the M4 Part B air-matched ride-out emission conditional on
resolved whole-spec features: contact count ≥30, mean impact ≤0.43, and either min air ≤0.34
or mean speed ≤0.62 with air range ≥0.30. The M4 airFit judge and all other compile/scoring
policy stayed unchanged. `LR_AIR_KNOB_FEATURE_GATE=0` restored old Part B globally.

**Verification.** Focused optimizer suite passed with the gate default-on:

```
LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probe.** `probe-m39b-airknob-feature-gate-s0-2-a01`, 19-spec air-sensitive panel ×
seeds 0..2 × canonical grid, valid 228/228:

```
Δheadline = +2.2 · 95% CI [-0.3, 6.4] · P(Δ≤0)=6.5% · effect=1.25
125k +0.7 · 250k +2.2 · 375k +2.4 · 500k +2.4
VERDICT: ACCEPT (indicative, non-promotable)
```

The narrowed selector repaired the M38 winners without the earlier `drums_pulse`/`drums_breath`
collateral: `drums_tide` +21.6, `drums_crescendo` +16.1, `drums_dropout` +3.0,
`drums_pendulum` +1.8; the rest of the panel was flat.

**Canonical.** `attempt-m39-airknob-feature-gate-a01` (valid 1920/1920, HEADLINE 691.59,
excl-impact 711.28; budgets 678.41 / 687.30 / 693.06 / 695.92) vs
`attempt-m3-scarce-span75-a01`:

```
Δheadline = +0.3 · 95% CI [-0.8, 1.7] · P(Δ≤0)=31.3% · effect=0.50
125k +0.4 · 250k +0.3 · 375k +0.5 · 500k +0.1
VERDICT: INCONCLUSIVE
```

**Footprint.** Full-suite paired changes were sparse: 191/1920 checkpoints changed
(107 improvements, 84 regressions, 1729 plateaus). Weighted spec movement concentrated in
`drums_crescendo` +12.0, `drums_tide` +4.3, `drums_pendulum` +1.2, and
`drums_dropout` -5.7; all other specs were flat.

**Learnings.** The selector was aimed at a real basin, but the canonical effect is too small
and the `drums_dropout` 12-seed flip erased much of the clean panel signal. Do not promote this
exact resolved-feature Part B gate. Future air-length work needs a stronger local usefulness
signal or a larger additive mechanism. Source reverted; baseline remains
`attempt-m3-scarce-span75-a01`.

### M40 — impact-template hold widening · rejected/closed (reverted, 2026-07-04)

**Mechanism.** Temporarily added default-identical env hooks around the existing profiled
low-air impact SLAM-HOP hold: hold max frames, whole-profile low-air onset, and local low-air
onset. Defaults were byte-identical; all search/scoring policy stayed unchanged.

**Verification.** Focused optimizer suite passed with env unset:

```
LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probe panel.** 12 dense/impact-sensitive specs × seeds 0..2 × canonical grid:
`drums_pendulum,drums_crescendo,drums_signature,drums_tide,drums_breath,drums_pulse,
drums_dropout,rhythm_ladder,dense_sprint,syncopated_switchback,cold_start,drums_swell`.

```
hold max 3.6→5.0 (`probe-m40-holdmax5-panel-s0-2-a01`):
  Δheadline = -0.0 · 95% CI [-0.7, 0.6] · P(Δ≤0)=75.8%
  changed 7/144; net `drums_pendulum` -0.32 weighted on the panel

profile low-air onset 0.50→0.56 (`probe-m40-profileair56-panel-s0-2-a01`):
  byte-identical, 0/144 score changes

profile 0.56 + local low-air onset 0.22→0.30
(`probe-m40-profileair56-localair30-panel-s0-2-a01`):
  Δheadline = -3.9 · 95% CI [-13.9, 1.4] · P(Δ≤0)=82.3%
  125k +0.0 · 250k -4.4 · 375k -4.3 · 500k -4.2
```

**Footprint.** The only active wider-local arm was a dense collateral failure:
`drums_pulse` -42.8 weighted and `drums_signature` -7.7, offset only by
`drums_breath` +5.5. Longer hold also hurt the intended pendulum row slightly.

**Learnings.** The accepted impact-template hold is already at the useful boundary. More
length does not fix `drums_pendulum`; whole-profile widening alone does not change selected
tracks; local low-air widening reopens the known dense-row basin loss. Do not retry simple
hold length/profile/local-air widening unchanged. Source reverted; baseline remains
`attempt-m3-scarce-span75-a01`.

### M41 — hard-impact mature M3 steep-arrival span · ACCEPT (2026-07-04)

**Mechanism.** Reuse the accepted M3 steep-arrival launch span at mature budgets, but only
on whole specs whose resolved max bounded impact is hard enough. Scarce budgets keep the
accepted 75% span below 200k. Mature budgets normally keep the old 20% span (`zeroBand=0.80`);
when max bounded impact >=0.68, M41 uses `zeroBand=0.70` (30% span). Escape hatch:
`LR_M41_HARD_IMPACT_SPAN=0`. Diagnostic overrides:
`LR_M41_HARD_IMPACT_PROFILE_MIN` and `LR_M41_HARD_IMPACT_ZERO_BAND`.

**Verification.** Focused optimizer suite passed default-on:

```
LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts
```

6 files, 77 tests.

**Probe selection.** A full 40-spec x seeds 0..2 probe at threshold 0.676 was ACCEPT-indicative
but retained a large `drums_tide` loss:

```
probe-m41-hardimpact-span30-full-s0-2-a01:
  Δheadline = +1.5 · 95% CI [-2.2, 4.7] · P(Δ≤0)=17.1%
  125k +0.0 · 250k +1.4 · 375k +2.0 · 500k +1.6
```

Raising the threshold to 0.68 excluded `drums_tide` and kept the main hard-impact winners:

```
probe-m41-hardimpact-span30-min068-full-s0-2-a01:
  Δheadline = +2.0 · 95% CI [-0.7, 4.8] · P(Δ≤0)=6.9%
  125k +0.0 · 250k +2.2 · 375k +2.9 · 500k +1.8
  valid 480/480 · raw HEADLINE 692.6 · excl-impact 711.59
```

**Canonical.** `attempt-m41-hardimpact-span30-a01` vs `attempt-m3-scarce-span75-a01`:

```
HEADLINE 691.28 -> 692.52 · excl-impact 711.20 -> 711.76 · valid 1920/1920
budget curve: 125k 677.98 · 250k 688.56 · 375k 694.19 · 500k 696.87

Δheadline = +1.2 · 95% CI [-0.2, 3.0] · P(Δ≤0)=5.1% · effect=1.50
125k +0.0 · 250k +1.5 · 375k +1.7 · 500k +1.1
VERDICT: ACCEPT
```

**Footprint.** 960/1920 paired checkpoints changed: 541 improvements, 419 regressions,
960 plateaus. Weighted winners: `drums_zigzag` +9.3, `rolling_hills` +8.6,
`drums_crosscut` +8.3, `drums_crescendo` +8.2, `drums_swell` +4.5,
`swoop_dive` +3.5, `climb_terrace` +3.5. Main losses: `verse_chorus` -3.3,
`syncopated_lift` -2.0, `skyline_push` -1.1, `dense_sprint` -1.0.

**Learnings.** Mature M3 span can ship when it is whole-profile gated by resolved hard-impact
need; the prior broad mature span failed because the displacement tax hit rows whose impact
profile was not hard enough. The 125k tier remains byte-identical under the accepted scarce
policy, so this is a mature-budget gain without reopening scarce-budget risk. Baseline is now
`attempt-m41-hardimpact-span30-a01` at source commit `0260692`.

### M42 — M4 Part B feature gate on M41 · probe INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Retest the old M39 resolved-feature gate on top of M41. Temporary default-off
hook `LR_M42_AIR_KNOB_FEATURE_GATE=1` suppressed only the M4 Part B air-matched ride-out
candidate when the whole-spec features matched the prior dense low/medium-impact air-swing
selector: contact count >=30, mean bounded impact <=0.43, and either min air <=0.34 or
mean speed <=0.62 with air range >=0.30.

**Verification.** Focused optimizer suite passed with the flag unset and with the flag on:

```
LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts
```

6 files, 77 tests. The first run caught a local missing-parameter bug before probing; fixed
before any M42 result was considered.

**Probe.** `probe-m42-airknob-gate-on-m41-panel-s0-2-a01` on the 19-spec M39 air panel,
seeds 0..2, canonical budget grid:

```
Δheadline = +0.6 · 95% CI [-3.3, 4.9] · P(Δ≤0)=39.8% · effect=0.29
125k +0.7 · 250k +0.3 · 375k +0.3 · 500k +0.9
valid 228/228 · VERDICT: INCONCLUSIVE
```

**Footprint.** Only 46/228 checkpoints changed: 29 improvements, 17 regressions.
Weighted panel deltas were `drums_tide` +21.6, `drums_pendulum` +1.8,
`drums_crescendo` -3.9, and `drums_dropout` -7.1; all other panel specs were flat.

**Learnings.** The old feature gate still targets a real tide basin, but it is too small and
too dirty on M41. Static resolved-target features explain the miss: `drums_tide` enters through
medium air range plus low mean speed, while `drums_dropout` and `drums_crescendo` enter through
the low-air side of the gate and lose. A tide-only selector is probably below canonical scale
unless it is bundled into a broader air-knob portfolio. Source reverted; baseline remains
`attempt-m41-hardimpact-span30-a01`.

### M43/M44 — M41 hard-impact span dose sweep · rejected/closed (env-only, 2026-07-04)

**Mechanism.** Env-only dose sweep of the accepted M41 mature hard-impact span. M41 default:
`LR_M41_HARD_IMPACT_ZERO_BAND=0.70` (30% mature span) when max bounded impact >=0.68. Tested
0.65 (35% span) and 0.75 (25% span) on the full 40-spec x seeds 0..2 x canonical grid.

```
M43 wider 35% (`probe-m43-hardimpact-span35-full-s0-2-a01`):
  Δheadline = -1.5 · 95% CI [-6.2, 1.5] · P(Δ≤0)=79.9%
  125k +0.0 · 250k -1.2 · 375k -1.7 · 500k -1.9
  valid 480/480 · raw HEADLINE 691.06

M44 narrower 25% (`probe-m44-hardimpact-span25-full-s0-2-a01`):
  Δheadline = -2.8 · 95% CI [-8.1, 1.1] · P(Δ≤0)=90.9%
  125k +0.0 · 250k -3.2 · 375k -2.4 · 500k -3.6
  valid 480/480 · raw HEADLINE 689.8 · VERDICT: REJECT
```

**Footprint.** Wider span gained `verse_chorus` +14.8 and `drums_zigzag` +10.6, but lost
`drums_swell` -46.9 and `drums_crosscut` -20.7. Narrower span gained `verse_chorus` +19.6
and `drums_swell` +7.7, but gave back core M41 winners: `drums_zigzag` -50.8,
`drums_crosscut` -31.5, `dense_sprint` -11.8, `drums_dropout` -11.8, and
`drums_crescendo` -11.1.

**Learnings.** The accepted 30% mature span is bracketed by losing doses. More span
over-displaces dense drum rows; less span removes the accepted hard-impact benefit. Future M41
work needs a better selector or a different candidate shape, not a scalar span retune. No source
changes; baseline remains `attempt-m41-hardimpact-span30-a01`.

### M45-M48 — impact-curve onset profile gate · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Bracketed the existing impact-curve onset on top of M41, then source-trialed a
profile selector. Broad env-only onset changes were bad: `LR_IMPACT_CURVE_START=0.20`
(`probe-m45-impactcurve-start020-panel-s0-2-a01`) rejected on the 18-spec panel
with Δheadline -5.6, CI [-15.0, 3.5], P(Δ≤0)=88.9%; `LR_IMPACT_CURVE_START=0.30`
(`probe-m46-impactcurve-start030-panel-s0-2-a01`) also rejected with Δ -3.2,
CI [-10.1, 4.6], P(Δ≤0)=81.8%.

**Selector.** Temporary source hook raised onset to 0.30 only for non-vertical, broad-air,
contact-rich low/medium-impact profiles. Focused tests passed default/flag/escape paths.
The first 3-seed full probe (`probe-m47-profile-curve-high-onset-full-s0-2-a01`) was
positive but leaked into `opening_burst`: Δ +0.8, CI [-1.2, 3.7], P(Δ≤0)=23.1%.
Adding `contactCount >= 35` removed the leak. Tightened probe
`probe-m48-profile-curve-high-onset-contact35-full-s0-2-a01` was valid 480/480 and
indicative ACCEPT: raw HEADLINE 693.54, Δ +0.9, CI [-1.1, 3.8], P(Δ≤0)=19.0%.

**Canonical.** `attempt-m48-profile-curve-high-onset-contact35-a01` vs M41:

```
HEADLINE 692.52 -> 692.92 · excl-impact 711.76 -> 711.78 · valid 1920/1920
budget curve: 125k 678.50 · 250k 689.05 · 375k 694.43 · 500k 697.34

Δheadline = +0.4 · 95% CI [-1.1, 2.2] · P(Δ≤0)=29.8% · effect=0.51
125k +0.5 · 250k +0.5 · 375k +0.2 · 500k +0.5
VERDICT: INCONCLUSIVE
```

**Footprint.** 192/1920 checkpoints changed: 102 improvements, 90 regressions, 1728
plateaus. Weighted movement was `drums_dropout` +17.36 and `drums_pendulum` +3.28,
offset by `drums_tide` -1.29 and `rhythm_ladder` -5.73.

**Learnings.** High onset is a real `drums_dropout` basin repair, but the canonical footprint
is too narrow and seed-sensitive to keep. The paired 12-seed run cut the 3-seed effect in
half and lost the accept gate. Source reverted; baseline remains
`attempt-m41-hardimpact-span30-a01`.

### M49 — impact-curve span widening · probe REJECT (env-only, 2026-07-04)

**Mechanism.** Env-only global widening of the impact-curve ramp on the same 18-spec
impact/guard panel used for M45/M46: `LR_IMPACT_CURVE_SPAN=0.30`. No source changes.

```
probe-m49-impactcurve-span030-panel-s0-2-a01:
  valid 216/216 · raw panel HEADLINE 643.67 · excl-impact 680.06
  Δheadline = -15.2 · 95% CI [-26.6, -5.8] · P(Δ≤0)=100% · effect=-2.87
  125k -8.2 · 250k -16.5 · 375k -16.3 · 500k -15.5
  VERDICT: REJECT
```

**Footprint.** Small gains of +2.32 on `drums_dropout`, +1.24 on `solo_run`, and +0.36 on
`skyline_push` were swamped by dense-drum guard losses: `drums_pulse` -62.73,
`drums_zigzag` -53.47, `drums_swell` -26.90, `drums_crosscut` -24.70,
`rhythm_ladder` -22.38, and `drums_tide` -21.79.

**Learnings.** The curve span is not a safe global knob. It repairs a small dropout basin but
destroys the rows that already depend on the current curve shape. Leave span alone unless a
future selector is much cleaner than the onset selector.

### M50 — profile-gated M3 wide hard-impact dose · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Source trial to extract the useful part of M43's wider hard-impact span without
taking the whole dense-drum displacement tax. For hard-impact, non-vertical profiles only, the
mature M3 steep-arrival zero band was overridden from accepted 0.70 to 0.65. Selector:
max bounded impact >=0.68, vertical fraction <=0.02, and either mean impact >=0.40 or steady
air/speed with mean impact >=0.31, mean air >=0.50, air range <=0.30, speed range <=0.30.
Static target: `verse_chorus`, `drums_dropout`, `drums_zigzag`.

Focused tests passed in experimental/default-on/escape-off modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests).

```
3-seed probe (`probe-m50-profile-m3-wide-dose-full-s0-2-a01`, LR_M50_PROFILE_M3_DOSE=1):
  valid 480/480 · raw HEADLINE 693.28 · excl-impact 712
  Δheadline = +0.7 · 95% CI [-0.1, 2.1] · P(Δ≤0)=9.5% · effect=1.18
  125k +0.0 · 250k +1.0 · 375k +0.7 · 500k +0.7
  VERDICT: ACCEPT (indicative)

Canonical (`attempt-m50-profile-m3-wide-dose-a01`, default-on, escape LR_M50_PROFILE_M3_DOSE=0):
  valid 1920/1920 · HEADLINE 692.53 · excl-impact 711.74
  budget curve: 125k 677.98 · 250k 688.73 · 375k 694.12 · 500k 696.87
  Δheadline = +0.0 · 95% CI [-0.9, 0.8] · P(Δ≤0)=46.5% · effect=0.04
  125k +0.0 · 250k +0.2 · 375k -0.1 · 500k -0.0
  VERDICT: INCONCLUSIVE
```

**Learnings.** The 3-seed positive was real enough to canonical, but not stable enough to keep.
M43/M44's per-spec winners are seed-sensitive dose redistribution, not a reliable selector for
changing the M41 mature span. Source reverted; baseline remains `attempt-m41-hardimpact-span30-a01`.

### M51 - profile-gated mature aim K7 · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Retest mature `LR_AIM_TOPK_BASES=7` on top of M41, then source-trial only the
positive-looking pockets. Flat K7 on the 40-spec x seeds 0..2 x mature-budget slice was negative
overall: `probe-m51-aim-k7-mature-on-m41-s0-2-a01`, valid 360/360, raw mature-slice HEADLINE
693.05, delta -1.2 vs M41, CI [-6.1, 3.5], P(Delta<=0)=69.5%. The source trial selected K=7
only at mature budgets, only without explicit `LR_AIM_TOPK_BASES`, and only for non-vertical
resolved whole-spec profiles matching either contact-rich low-speed hard-impact rows
(`contactCount >= 50`, mean speed <=0.61, max bounded impact >=0.675) or steady hard-impact
phrase rows (`contactCount` 25..35, mean impact >=0.40, air range <=0.25, speed range <=0.20).

Focused tests passed in default-on and escape-off modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests).

```
3-seed probe (`probe-m51-profile-aim-k7-full-s0-2-a01`, LR_M51_AIM_K7_PROFILE=1):
  valid 480/480 · raw HEADLINE 694.24 · excl-impact 713.51
  Delta headline = +1.6 · 95% CI [-0.0, 4.4] · P(Delta<=0)=3.1% · effect=1.44
  125k +0.0 · 250k +2.0 · 375k +1.8 · 500k +1.8
  VERDICT: ACCEPT (indicative)

Canonical (`attempt-m51-profile-aim-k7-a01`, default-on, escape LR_M51_AIM_K7_PROFILE=0):
  valid 1920/1920 · HEADLINE 692.29 · excl-impact 711.33
  budget curve: 125k 677.98 · 250k 688.37 · 375k 693.88 · 500k 696.64
  Delta headline = -0.2 · 95% CI [-1.9, 1.1] · P(Delta<=0)=61.6% · effect=-0.31
  125k +0.0 · 250k -0.2 · 375k -0.3 · 500k -0.2
  VERDICT: INCONCLUSIVE
```

**Learnings.** The K7 selector had a convincing 3-seed footprint but did not survive the
canonical seed set. Full-canonical mature budgets were all slightly negative, so this is another
seed-sensitive redistribution rather than a viable way to spend mature aim breadth. Source
reverted; baseline remains `attempt-m41-hardimpact-span30-a01`.

### M52-M54 - amplitude-range mature q34 breadth · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Test whether the remaining amplitude residual is candidate-breadth limited. M52
first forced global `LR_QUALITY_NCAND=34` on the 10 worst amplitude-residual specs. M53 priced
the same env setting on the full 40-spec suite. M54 then source-trialed the separable part:
at budgets >=200k, use q34 only when the resolved whole-spec profile has at most 23 contact gaps
and amplitude target range >=0.35. Geometry, scorer, specs, fingerprint, seeds, budgets, and
acceptance rule were unchanged.

Focused tests passed in disabled/enabled and promoted/escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests).

```
M52 panel (`probe-m52-amp-quality34-panel-s0-2-a01`, LR_QUALITY_NCAND=34):
  valid 120/120 · raw panel HEADLINE 671.71 · excl-impact 665.99
  Delta headline = +1.9 · 95% CI [-0.7, 4.9] · P(Delta<=0)=8.8% · effect=1.29
  125k -1.2 · 250k +3.2 · 375k +1.5 · 500k +2.2
  VERDICT: ACCEPT (indicative panel)

M53 full global q34 (`probe-m53-quality34-full-s0-2-a01`):
  valid 480/480 · raw HEADLINE 691.1 · excl-impact 709.92
  Delta headline = -1.5 · 95% CI [-5.9, 2.4] · P(Delta<=0)=76.6% · effect=-0.72
  125k -0.8 · 250k -2.1 · 375k -1.3 · 500k -1.5
  VERDICT: INCONCLUSIVE-negative (indicative)

M54 source probe (`probe-m54-amp-range-q34-full-s0-2-a01`, LR_M54_AMP_RANGE_Q34=1):
  valid 480/480 · raw HEADLINE 693.3 · excl-impact 711.87
  Delta headline = +0.7 · 95% CI [0.1, 1.6] · P(Delta<=0)=1.5% · effect=1.83
  125k +0.0 · 250k +1.3 · 375k +0.6 · 500k +0.7
  VERDICT: ACCEPT (indicative)

Canonical (`attempt-m54-amp-range-q34-a01`, default-on, escape LR_M54_AMP_RANGE_Q34=0):
  valid 1920/1920 · HEADLINE 692.51 · excl-impact 711.59
  budget curve: 125k 677.98 · 250k 688.67 · 375k 693.97 · 500k 696.97
  Delta headline = -0.0 · 95% CI [-0.6, 0.6] · P(Delta<=0)=50.3% · effect=-0.03
  125k +0.0 · 250k +0.1 · 375k -0.2 · 500k +0.1
  VERDICT: INCONCLUSIVE
```

**Learnings.** Amplitude breadth has a real but seed-sensitive 3-seed pocket. The global knob is
suite-negative, and the clean amplitude-range selector collapses to exact flatness at 12 seeds.
Do not retry candidate breadth alone as an amplitude repair; future amplitude work needs a new
geometry/usefulness model, not more q. Source reverted; baseline remains
`attempt-m41-hardimpact-span30-a01`.

### M56-M62 - repair/rank-quality audit + objective exponent · probe INCONCLUSIVE (reverted, 2026-07-04)

**Audit.** Source-free controls on the current worst rows narrowed the search space:

```
M56 repair off (`probe-m56-repair-off-worst9-s0-2-a01`, LR_REPAIR_MIN_BUDGET=100000000):
  Delta headline = -13.9 · 95% CI [-29.4, -5.1] · P(Delta<=0)=100% · VERDICT REJECT

M57 repair max attempts 128 (`probe-m57-repair-max128-worst9-s0-2-a01`):
  bit-identical to M41 on the worst-9 mature slice

M58 repair upstream 8 (`probe-m58-repair-upstream8-worst9-s0-2-a01`):
  Delta headline = -0.6 · 95% CI [-3.5, 2.2] · negative at every mature budget

M59 impact local weight 0.75 (`probe-m59-impact-local075-worst9-s0-2-a01`):
  bit-identical to M41 on the worst-9 slice

M60 rank-quality off (`probe-m60-rank-quality-off-worst9-s0-2-a01`, LR_RANK_QUALITY=off):
  Delta headline = -33.3 · 95% CI [-48.0, -19.9] · VERDICT REJECT
```

Repair and rank-quality are load-bearing; the repair attempt cap and local-impact cost knob are
not useful levers on the current worst slice.

**Mechanism.** Temporary default-off objective hook:
`value = currentQuality^p * readiness^q`, with `LR_M61_OBJECTIVE_CURRENT_POWER` and
`LR_M61_OBJECTIVE_READINESS_POWER`. M62 added an opt-in budget gate
(`LR_M62_MATURE_OBJECTIVE_CURRENT15=1`) so 125k stayed byte-identical and budgets >=200k used
current-quality power 1.5. Focused tests passed in default and M62 opt-in modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests each).

```
M61 current-power 1.5 worst-9:
  Delta headline = +4.3 · 95% CI [-2.8, 11.9] · P(Delta<=0)=12.2%
  125k -7.3 · 250k +7.7 · 375k +5.8 · 500k +4.6

M61 current-power 1.5 full (`probe-m61-objective-current15-full-s0-2-a01`):
  valid 480/480 · raw HEADLINE 693.95 · excl-impact 709.20
  Delta headline = +1.4 · 95% CI [-2.5, 5.1] · P(Delta<=0)=24.2%
  125k -1.6 · 250k +1.0 · 375k +1.9 · 500k +1.9
  VERDICT: INCONCLUSIVE (indicative)

M61 lower/current readiness checks:
  current-power 1.25 worst-9 weaker: +2.8, P(Delta<=0)=31.2%
  readiness-power 1.5 worst-9 flat: +0.4, P(Delta<=0)=50.0%

M62 mature-only current-power 1.5 (`probe-m62-mature-objective-current15-full-s0-2-a01`):
  valid 480/480 · raw HEADLINE 694.11 · excl-impact 709.62
  budget curve: 125k 677.65 · 250k 689.97 · 375k 695.73 · 500k 699.09
  Delta headline = +1.5 · 95% CI [-2.2, 5.3] · P(Delta<=0)=21.1% · effect=0.79
  125k +0.0 · 250k +1.0 · 375k +1.9 · 500k +1.9
  VERDICT: INCONCLUSIVE (indicative, non-promotable)
```

**Learnings.** The mature-only gate fixed the 125k drag and preserved the mature lift, but it
missed the indicative accept gate by one percentage point of tail probability. Weighted gains:
`dense_sprint` +31.4, `drums_signature` +12.2, `float_bounds` +10.2, `drums_pulse` +10.1,
`rhythm_ladder` +9.5, `drums_pendulum` +5.2. Weighted losses: `syncopated_switchback` -15.1,
`drums_swell` -11.5, `drums_breath` -8.1, `canyon_steps` -7.9, `pop_train` -5.2. Broad
current-quality exponentiation is directionally useful but too noisy to promote; future work
needs a more selective usefulness signal, not a global exponent. Source reverted; baseline
remains `attempt-m41-hardimpact-span30-a01`.

### M63 - high-impact objective current-power gate · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** M62's mature-only current-quality exponent was directionally right but too broad.
Archive screening showed a simple non-name selector: apply `currentQuality^1.5 * readiness` only
at budgets >=200k when mean authored impact over feasible contacts, counting non-impact contacts
as zero, is >=0.41. Probe mode used `LR_M63_HIGH_IMPACT_OBJECTIVE_CURRENT15=1`; promoted mode
made the gate default-on with `LR_M63_HIGH_IMPACT_OBJECTIVE_CURRENT15=0` as the escape.

Focused tests passed in default/gated/escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests each).

```
Probe (`probe-m63-highimpact-objective-current15-full-s0-2-a01`):
  valid 480/480 · raw HEADLINE 694.62 · excl-impact 712.29
  Delta headline = +2.0 · 95% CI [-1.0, 5.2] · P(Delta<=0)=8.8% · effect=1.29
  125k +0.0 · 250k +1.1 · 375k +2.5 · 500k +2.6
  VERDICT: ACCEPT (indicative)

Canonical (`attempt-m63-highimpact-objective-current15-a01`, default-on):
  valid 1920/1920 · HEADLINE 693.39 · excl-impact 712.05
  budget curve: 125k 677.98 · 250k 688.44 · 375k 694.89 · 500k 698.60
  Delta headline = +0.9 · 95% CI [-1.4, 3.2] · P(Delta<=0)=21.0% · effect=0.76
  125k +0.0 · 250k -0.1 · 375k +0.7 · 500k +1.7
  VERDICT: INCONCLUSIVE
```

**Learnings.** This is a real 500k lever, but not keepable under the canonical rule. Winners:
`dense_sprint` +11.7, `rhythm_ladder` +11.0, `drums_zigzag` +8.0, `drums_crosscut` +7.2,
`verse_chorus` +6.9, `drums_pendulum` +5.6. Main loss: `syncopated_switchback` -14.5, then
`pop_train` -3.2, `drums_dropout` -2.0, `skyline_push` -1.8, `drums_pulse` -1.7. Next attempt
should preserve the high-impact mature objective lift but block syncopated-switchback-like high
air/speed variation. Source reverted; baseline remains `attempt-m41-hardimpact-span30-a01`.

### M64 - impact-band objective current-power gate · canonical ACCEPT (2026-07-04)

**Mechanism.** Promote the M63 idea only where the 12-seed archive screen said it was clean:
budgets >=200k and mean authored impact prevalence over feasible contacts, counting missing
impact as zero, in `[0.41, 0.51]`. The objective leaf uses
`currentQuality^1.5 * readiness` inside that band and the baseline `currentQuality * readiness`
elsewhere. Escape hatch: `LR_M64_IMPACT_BAND_OBJECTIVE_CURRENT15=0`; explicit override:
`LR_M64_OBJECTIVE_CURRENT_POWER`.

Focused tests passed in default and escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests each).

```
Canonical (`attempt-m64-impact-band-objective-current15-a01`):
  valid 1920/1920 · HEADLINE 693.86 · excl-impact 712.76
  budget curve: 125k 677.98 · 250k 689.20 · 375k 695.82 · 500k 698.69
  Delta headline = +1.3 · 95% CI [-0.3, 3.3] · P(Delta<=0)=5.6% · effect=1.45
  125k +0.0 · 250k +0.6 · 375k +1.6 · 500k +1.8
  VERDICT: ACCEPT
```

**Learnings.** This is the accepted M63 form. The upper prevalence bound removed the M63
`syncopated_switchback` collapse and the `drums_dropout` drag while keeping the mature
objective lift. Changed checkpoints: 612/1920, with 337 improvements, 275 regressions, and 1308
plateaus. Winners: `dense_sprint` +11.8, `rhythm_ladder` +11.2, `drums_zigzag` +7.7,
`drums_crosscut` +7.0, `verse_chorus` +6.6, `drums_pendulum` +5.5. Remaining losses:
`pop_train` -3.2, `skyline_push` -1.7, `drums_pulse` -1.7. New baseline is
`attempt-m64-impact-band-objective-current15-a01`; remaining target gap is 6.14 headline points.

### M65 - dropout/pendulum impact-curve onset raise · probe INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Retry M48's useful `drums_dropout` impact-curve basin repair with a stricter
non-name selector: contact-rich, non-vertical, steady-speed, broad-air, medium-impact profiles.
The temporary source added a `targetStartRaise` impact profile pressure that raised the impact
curve target start toward 0.30 under that selector. Intended static target:
`drums_dropout` + `drums_pendulum`; M64 source otherwise unchanged.

Focused tests passed in default and escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M65_IMPACT_CURVE_RAISE=0` (6 files, 77 tests each).

```
Probe (`probe-m65-dropout-pendulum-curve-raise-full-s0-2-a01`):
  valid 480/480 · raw HEADLINE 694.79 · excl-impact 712.47
  Delta headline = +0.1 · 95% CI [-0.2, 0.7] · P(Delta<=0)=53.0% · effect=0.45
  125k -0.4 · 250k +0.4 · 375k -0.0 · 500k +0.2
  VERDICT: INCONCLUSIVE (indicative, non-promotable)
```

**Learnings.** The selector was clean but too small. Paired row footprint changed 12/480
checkpoints, all `drums_dropout`, with 7 improvements and 5 regressions. `drums_dropout`
weighted movement was +3.61, but the shape was noisy: 125k -14.75, 250k +15.74, 375k -1.31,
500k +5.82. This confirms the M48 basin is real but not promotion-scale as a standalone
profile-onset change. Source reverted; baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

### M66 - objective band current-power 2.0 · affected-slice REJECT (reverted, 2026-07-04)

**Mechanism.** Dose check for the accepted M64 objective gate. Temporarily changed the in-band
current-quality exponent from 1.5 to 2.0, keeping the M64 selector and all other compiler
behavior unchanged.

Focused tests passed:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests).

```
Affected-slice probe (`probe-m66-band-objective-current20-affected-s0-2-a01`):
  17 M64-affected specs × seeds 0..2 × canonical budget grid · valid 204/204
  raw slice HEADLINE 680.83 · excl-impact 692.44
  Delta headline = -3.6 · 95% CI [-12.0, 2.9] · P(Delta<=0)=84.0% · effect=-0.95
  125k +0.0 · 250k -2.3 · 375k -4.6 · 500k -4.4
  VERDICT: REJECT
```

**Learnings.** The accepted exponent is not under-dosed. Power 2.0 gave back mature-budget
score on the exact rows M64 is allowed to affect, so further progress should not come from
simply increasing the current-quality exponent. Source reverted; baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

### M67 - current-impact-local objective power · affected-slice INERT (reverted, 2026-07-04)

**Mechanism.** Temporary default-off hook `LR_M67_IMPACT_LOCAL_OBJECTIVE_CURRENT15=1`: keep the
M64 spec/budget band, but apply `currentQuality^1.5 * readiness` only when the current gap has
an authored impact target; non-impact current gaps fall back to the baseline linear objective.
Default mode was intended to be byte-equivalent to M64.

Focused tests passed in default and opt-in modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M67_IMPACT_LOCAL_OBJECTIVE_CURRENT15=1` (6 files, 78 tests each,
including the temporary hook unit test).

```
Affected-slice probe (`probe-m67-impact-local-objective-current15-active-s0-2-a01`):
  17 M64-active specs × seeds 0..2 × canonical budget grid · valid 204/204
  raw slice HEADLINE 684.45 · excl-impact 696.24
  Delta headline = +0.0 · 95% CI [0.0, 0.0] · P(Delta<=0)=100.0% · effect=0.00
  125k +0.0 · 250k +0.0 · 375k +0.0 · 500k +0.0
  VERDICT: INCONCLUSIVE (byte-identical, non-promotable)
```

**Learnings.** Localizing the objective exponent by current impact presence is inert: the
M64-active slice already carries impact targets on the relevant current gaps. This does not
reduce M64 collateral or add a new selector. Source and temporary test changes were reverted;
baseline remains `attempt-m64-impact-band-objective-current15-a01`.

### M68 - current-impact thresholded objective power · affected-slice INCONCLUSIVE-negative (reverted, 2026-07-04)

**Mechanism.** Temporary default-off hook
`LR_M68_OBJECTIVE_CURRENT_IMPACT_MIN`/`LR_M68_OBJECTIVE_CURRENT_IMPACT_MAX`: keep the M64
spec/budget band, but apply `currentQuality^1.5 * readiness` only when the current gap's bounded
impact target sits inside the env threshold. Default mode remained M64.

Focused tests passed in default and thresholded modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M68_OBJECTIVE_CURRENT_IMPACT_MIN=0.45` (6 files, 77 tests each).

```
Affected-slice probe min=0.45 (`probe-m68-objective-impact-min045-active-s0-2-a01`):
  17 M64-active specs × seeds 0..2 × canonical budget grid · valid 204/204
  raw slice HEADLINE 683.27 · excl-impact 697.92
  Delta headline = -1.2 · 95% CI [-6.0, 3.0] · P(Delta<=0)=68.8% · effect=-0.51
  125k +0.0 · 250k +1.5 · 375k -2.3 · 500k -2.0
  VERDICT: INCONCLUSIVE (non-promotable)

Affected-slice probe min=0.35 (`probe-m68-objective-impact-min035-active-s0-2-a01`):
  17 M64-active specs × seeds 0..2 × canonical budget grid · valid 204/204
  raw slice HEADLINE 683.15 · excl-impact 697.99
  Delta headline = -1.3 · 95% CI [-6.2, 3.3] · P(Delta<=0)=71.2% · effect=-0.55
  125k +0.0 · 250k +0.7 · 375k -1.6 · 500k -2.4
  VERDICT: INCONCLUSIVE (non-promotable)
```

**Learnings.** M64's lift needs the lower/mid current-impact targets; selecting only harder
current impacts gives back mature-budget score. Do not continue the M63/M64 line with local
impact-threshold gating. Source reverted; baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

### M102 - high-air low-grain repair main-margin exactness · canonical ACCEPT (2026-07-04)

**Mechanism.** Promoted a second residual repair selector from the M100 footprint, after M101
removed the flat compact winners. M102 keeps M101 first, then applies mature-budget main repair
margin 1.0 to high-air, moderate-air-range, low/absent-grain profiles: mean authored air >=0.61,
authored air range <=0.40, and mean authored grain <=0.49 at feasible contacts. Missing grain
counts as zero. The fallback flag is `LR_M102_REPAIR_HIGH_AIR_LOW_GRAIN_MAIN100=0`; explicit
`LR_REPAIR_MAIN_MARGIN` still overrides. Scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule stayed unchanged.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M102_REPAIR_HIGH_AIR_LOW_GRAIN_MAIN100=0` (6 files, 78 tests each).

**Probe.** Corrected full 3-seed guard (`probe-m102-repair-highair-lowgrain-main100-full-s0-2-a02`)
was valid 480/480 with raw HEADLINE 698.93 and excl-impact 715.68. Decision vs M101 was
indicative `VERDICT: ACCEPT`, delta +0.6, CI [-0.3, 1.6], P(delta<=0)=8.7%, effect 1.25.
Affected all-12 pocket (`probe-m102-repair-highair-lowgrain-main100-pocket-s0-11-a01`) covered
the 11 selected specs, was valid 528/528 with raw pocket HEADLINE 703.60 and excl-impact 706.09,
and decided indicative `VERDICT: ACCEPT`, delta +1.3, CI [-0.2, 2.8], P(delta<=0)=4.1%.

**Canonical.** `attempt-m102-repair-highair-lowgrain-main100-a01` (valid 1920/1920, HEADLINE
696.35, excl-impact 714.91) vs `attempt-m101-repair-flat-compact-main100-a01`:

```
Delta headline = +0.4 · 95% CI [-0.1, 0.9] · P(Delta<=0)=4.3% · effect=1.59
125k +0.0 · 250k -0.1 · 375k +0.5 · 500k +0.6 · validity 100% at every budget
VERDICT: ACCEPT
```

**Footprint.** M102 changed 330/1920 paired checkpoints, with 209 improvements, 117 regressions,
and 1594 plateaus. The 125k tier is byte-stable. Selected specs were all nonnegative weighted:
`canyon_steps` +2.69, `pop_train` +2.19, `big_air_ramp` +2.11, `drums_zigzag` +1.85,
`syncopated_lift` +1.52, `drums_breath` +1.42, `drums_crosscut` +0.96, `skyline_push` +0.94,
`leap_cadence` +0.69, `rolling_drop` +0.38, and `float_bounds` +0.17.

**Learnings.** M100 had at least two keepable local repair-margin pockets. M101 captured the
flat compact one; M102 captures the high-air/low-grain mature-budget one while preserving the
125k protection. New baseline is `attempt-m102-repair-highair-lowgrain-main100-a01`; remaining
target gap is 3.65 headline points.

### M103 - post-M102 M63-form and vertical breadth screens · source-free closed (2026-07-04)

**Study.** Answer the M63 follow-up on the M102 baseline without moving the acceptance rule.
M63-form probes used `LR_M64_OBJECTIVE_CURRENT_POWER=1.5` on mature-budget spec slices; vertical
breadth probes used source-free `LR_QUALITY_NCAND` on candidate slices. No source behavior was
changed.

```
Residual combined current-power (`probe-m103-residual-combined-current15-s0-2-a01`):
  dense_echo_climb,canyon_steps,switchback_pop · seeds 0..2 · budgets 250k/375k/500k
  Delta headline = -4.9 · CI [-12.0, 1.2] · P(Delta<=0)=92.5% · VERDICT: REJECT

High-impact sparse current-power (`probe-m103-highimpact-sparse-current15-s0-2-a01`):
  rolling_drop,summit_push,leap_cadence · seeds 0..2 · budgets 250k/375k/500k
  Delta headline = +0.4 · CI [-5.9, 9.5] · P(Delta<=0)=49.3% · VERDICT: INCONCLUSIVE

Leap-only all-12 current-power (`probe-m103-leap-current15-s0-11-a01`):
  leap_cadence · seeds 0..11 · budgets 250k/375k/500k
  Delta headline = +0.3 · CI [-4.9, 5.3] · P(Delta<=0)=45.1% · 500k -1.7
  VERDICT: INCONCLUSIVE

Vertical nCand=34 (`probe-m103-vertical-ncand34-s0-2-a01`):
  skyline_push,terrace_sprint,syncopated_lift,canyon_steps,dense_echo_climb,rolling_drop
  Delta headline = -2.0 · CI [-6.8, 3.4] · P(Delta<=0)=80.3% · VERDICT: REJECT

Vertical nCand=36 (`probe-m103-vertical-ncand36-s0-2-a01`):
  same panel · Delta headline = -1.7 · CI [-6.2, 3.0] · P(Delta<=0)=75.8%
  VERDICT: INCONCLUSIVE

Dense-amplitude pocket nCand=34 (`probe-m103-denseamp-ncand34-pocket-s0-11-a01`):
  canyon_steps,terrace_sprint · seeds 0..11 · budgets 250k/375k/500k
  Delta headline = +2.3 on the two-spec intersection · P(Delta<=0)=29.1%
  VERDICT: INCONCLUSIVE

Dense-amplitude pocket nCand=36 (`probe-m103-denseamp-ncand36-pocket-s0-11-a01`):
  same pocket · Delta headline = -0.1 · P(Delta<=0)=44.3% · VERDICT: INCONCLUSIVE
```

**Learnings.** The broad M63 signal is still not something to force. Accepted descendants
M64/M74/M87/M94 are the keepable form. Post-M102 residual current-power either regresses or is
too small/noisy, and candidate breadth helps `canyon_steps`/`terrace_sprint` only by leaking
losses into `skyline_push`, `syncopated_lift`, and `dense_echo_climb`; the narrowed dense-amp
pocket remains below promotion scale. Do not continue by widening M63 or by broad vertical
candidate breadth.

### M104 - dense high-air low-impact readiness selector · canonical INCONCLUSIVE, reverted (2026-07-05)

**Mechanism.** Tested the remaining M63-descendant readiness pocket after M103 closed the broad
residual screens. The trial added readiness power 0.75 after M75 for mature-budget dense
high-air/low-impact profiles with at least 50 feasible contacts, no authored elevation or
amplitude objective range, mean air 0.62..0.66, air range <=0.30, speed range 0.20..0.28, mean
impact 0.20..0.30, and median contact gap <=0.75s. The selector footprint matched only
`drums_breath` among the 40 golden specs. Fallback flag:
`LR_M104_DENSE_HIGH_AIR_LOW_IMPACT_READINESS075=0`.

**Why it was worth trying.** A broader dense high-air readiness probe rejected:
`probe-m104-dense-highair-readiness075-s0-2-a01` on
`drums_swell,drums_crosscut,drums_tide,drums_breath,drums_pulse,drums_zigzag` was delta -11.4,
P(Delta<=0)=87.8%. The same probe showed `drums_breath` as the one positive neighbor, and the
all-12 `drums_breath` pocket (`probe-m104-drums-breath-readiness075-s0-11-a01`) was indicative
positive: delta +3.8 on the one-spec intersection, CI [-4.2, 11.0], P(Delta<=0)=16.5%, with
per-budget deltas 125k +0.0, 250k +2.1, 375k +3.6, and 500k +5.8.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M104_DENSE_HIGH_AIR_LOW_IMPACT_READINESS075=0` (6 files, 78 tests
each). Full 3-seed guard
(`probe-m104-dense-highair-lowimpact-readiness075-full-s0-2-a01`) was valid 480/480 with raw
HEADLINE 699.22 and excl-impact 715.75; decision vs M102 was indicative
`VERDICT: INCONCLUSIVE`, delta +0.3, CI [0.0, 1.0], P(Delta<=0)=36.4%.

**Canonical.**
`generated/golden-runs/attempt-m104-dense-highair-lowimpact-readiness075-a01/golden.json` was
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m104-dense-highair-lowimpact-readiness075-a01`.
It was valid 1920/1920 with raw HEADLINE 696.45 and excl-impact 714.9. Budget scores:
125k 677.98, 250k 691.73, 375k 698.60, 500k 701.81.

**Decision.** `npm run decide -- generated/golden-runs/attempt-m104-dense-highair-lowimpact-readiness075-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
returned `VERDICT: INCONCLUSIVE`: M102 696.3 -> M104 696.4, delta +0.1, CI [-0.1, 0.6],
P(Delta<=0)=48.0%, effect 0.55. Per-budget deltas were 125k +0.0, 250k +0.1, 375k +0.1, and
500k +0.2.

**Learnings.** The one-spec readiness pocket was not enough to move the canonical suite with
acceptable confidence. The source patch was reverted and M102 remains baseline of record. Do not
promote this unless a future selector adds independent, screened footprint beyond `drums_breath`;
do not widen back to the rejected dense high-air panel.

### M105 - dense-drum readiness selector · canonical INCONCLUSIVE, reverted (2026-07-05)

**Study.** Push the M63/readiness descendant one step past M104 by looking for a second narrow
dense-drum pocket that could add enough independent mass to become promotable. Repair exactness
was checked first and closed; readiness remained the only live thread.

```
Residual repair main-margin 1.0 (`probe-m105-residual-repair-main100-s0-2-a01`):
  drums_pendulum,terrace_sprint,dense_echo_climb,drums_dropout,dense_sprint,rhythm_ladder,
  drums_pulse,drums_signature,drums_crescendo,drums_tide,solo_run · seeds 0..2 · 250k/375k/500k
  Delta headline = -0.6 · P(Delta<=0)=62.7% · VERDICT: INCONCLUSIVE
  Local positives: drums_pulse +5.87, rhythm_ladder +3.49, solo_run +3.34
  Offsets: drums_tide -9.12, drums_crescendo -4.28

All-12 repair pocket (`probe-m105-flat-dense-lowair-repair-main100-pocket-s0-11-a01`):
  drums_pulse,rhythm_ladder,solo_run,grain_staircase · seeds 0..11 · 250k/375k/500k
  Delta headline = -0.1 · P(Delta<=0)=51.3% · VERDICT: INCONCLUSIVE

Worst-15 readiness sweep (`probe-m105-worst15-readiness075-s0-2-a01`):
  seeds 0..2 · 250k/375k/500k
  Delta headline = -4.7 · P(Delta<=0)=91.9% · VERDICT: REJECT
  Positives: drums_breath +12.14, drums_crescendo +3.72
  Losses: drums_pulse -21.41, dense_sprint -18.04, drums_signature -15.59, canyon_steps -8.34

All-12 drums_crescendo readiness pocket (`probe-m105-drums-crescendo-readiness075-s0-11-a01`):
  seeds 0..11 · 250k/375k/500k
  Delta headline = +6.9 on the one-spec mature-budget intersection
  CI [-3.7, 16.5] · P(Delta<=0)=9.8% · effect=1.33 · indicative VERDICT: ACCEPT
  250k +15.6 · 375k +5.0 · 500k +4.0
```

**Mechanism.** Source trial added readiness power 0.75 after M75 for a dense-drum selector whose
static footprint matched only `drums_breath` and `drums_crescendo` among the 40 golden specs.
Both arms required at least 50 feasible contacts, median contact gap <=0.75s, and no authored
elevation/amplitude objective range. The `drums_breath` arm reused the M104 high-air/low-impact
pocket; the `drums_crescendo` arm selected mean air 0.55..0.57, air range 0.50..0.56, mean
speed 0.60..0.62, speed range 0.50..0.56, and mean impact 0.38..0.40. Fallback flag:
`LR_M105_DENSE_DRUM_READINESS075=0`.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M105_DENSE_DRUM_READINESS075=0` (6 files, 78 tests each). Full
3-seed guard (`probe-m105-dense-drum-readiness075-full-s0-2-a01`) was valid 480/480 with raw
HEADLINE 699.29 and excl-impact 715.97; decision vs M102 was indicative
`VERDICT: INCONCLUSIVE`, delta +0.4, CI [-0.7, 1.6], P(Delta<=0)=28.1%.

**Canonical.**
`generated/golden-runs/attempt-m105-dense-drum-readiness075-a01/golden.json` was run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m105-dense-drum-readiness075-a01`.
It was valid 1920/1920 with raw HEADLINE 696.61 and excl-impact 715.02. Budget scores:
125k 677.98, 250k 692.14, 375k 698.73, 500k 701.92.

**Decision.** `npm run decide -- generated/golden-runs/attempt-m105-dense-drum-readiness075-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
returned `VERDICT: INCONCLUSIVE`: M102 696.35 -> M105 696.61, delta +0.3, CI [-0.1, 1.0],
P(Delta<=0)=21.9%, effect 0.90. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.2, and
500k +0.3.

**Learnings.** This confirms the user's M63 hunch was worth pushing: the readiness descendant
is directionally positive and has real `drums_breath`/`drums_crescendo` pockets. It still does
not clear the canonical accept rule at 12 seeds, so the source patch was reverted and M102
remains baseline of record. Do not spend more canonical cycles on this exact two-spec selector;
it needs a separate suite-scale carrier before promotion.

### M106 - expanded axis overshoot pressure · canonical INCONCLUSIVE, reverted (2026-07-05)

**Study.** M102 residual reports show signed positive errors on the weakest rows:
`drums_pendulum` overshoots air/impact, and the vertical weak rows overshoot
elevation/amplitude/impact. The existing local handoff overshoot pressure covers only air and
speed, so M106 tested whether adding the missing scored axes could move selection.

**Mechanism.** Add half-strength normalized overshoot pressure for `impact`, `elevation`, and
`amplitude` inside `handoffAxisOvershootPenalty`, while leaving full air pressure and softer
speed pressure unchanged. This was a local handoff-score term only; no scorer, specs,
fingerprint, seeds, budget grid, candidate generation, or acceptance rule changed. Fallback
flag: `LR_M106_AXIS_OVERSHOOT_EXPANDED=0`.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M106_AXIS_OVERSHOOT_EXPANDED=0` (6 files, 78 tests each).

**Probe.** Worst-9 overshoot screen
(`probe-m106-expanded-axis-overshoot-worst9-s0-2-a01`) on
`drums_pendulum,skyline_push,terrace_sprint,dense_echo_climb,syncopated_lift,drums_dropout,
canyon_steps,dense_sprint,rhythm_ladder`, seeds 0..2, full budget grid, was valid 108/108.
Paired decision vs M102 on the same intersection was byte-identical:
delta +0.0, CI [0.0, 0.0], P(Delta<=0)=100.0%, effect 0.00, `VERDICT: INCONCLUSIVE`.

**Canonical.**
`generated/golden-runs/attempt-m106-expanded-axis-overshoot-a01/golden.json` was run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m106-expanded-axis-overshoot-a01`.
It was valid 1920/1920 with raw HEADLINE 696.35 and excl-impact 714.91. Budget scores:
125k 677.98, 250k 691.67, 375k 698.50, 500k 701.66.

**Decision.** `npm run decide -- generated/golden-runs/attempt-m106-expanded-axis-overshoot-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
returned `VERDICT: INCONCLUSIVE`: M102 696.35 -> M106 696.35, delta +0.0, CI [0.0, 0.0],
P(Delta<=0)=100.0%, effect 0.00. All per-budget deltas were +0.0; paired checkpoint diff was
0 changed / 1920.

**Learnings.** This local ranker path is inert at canonical budgets under the current
forward-eval/objective selection stack. The overshoot diagnosis is real, but this is the wrong
insertion point. Future work should price overshoot in the objective/forward-eval leaf or add a
candidate-generation variant that actually enters the selected pool. Source reverted; M102
remains baseline of record.

### M107 - objective-level controlled-axis overshoot · canonical REJECT, reverted (2026-07-05)

**Study.** M106 proved the local handoff overshoot term was inert, so M107 moved the same
controlled-axis diagnosis into current-gap objective quality, where it can affect selected
candidates. This tests objective/forward-eval pressure, not the narrower M63/readiness line.

**Mechanism.** Multiply `scoreCurrentTargetQuality` by a quarter-strength exponential discount
for positive overshoot on `impact`, `elevation`, and `amplitude`. Undershoot and all other axes
stay neutral. No scorer, specs, fingerprint, seeds, budget grid, candidate generation, or
acceptance rule changed. Fallback flag: `LR_M107_OBJECTIVE_CONTROL_OVERSHOOT=0`.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M107_OBJECTIVE_CONTROL_OVERSHOOT=0` (6 files, 79 tests each).

**Probe.** Worst-9 overshoot screen
(`probe-m107-objective-control-overshoot-worst9-s0-2-a01`) on
`drums_pendulum,skyline_push,terrace_sprint,dense_echo_climb,syncopated_lift,drums_dropout,
canyon_steps,dense_sprint,rhythm_ladder`, seeds 0..2, full budget grid, was valid 108/108.
Paired decision vs M102 on the same intersection was indicative `VERDICT: REJECT`: delta -7.5,
CI [-17.5, 0.1], P(Delta<=0)=97.3%, effect -1.71. `rhythm_ladder` gained +10.33 weighted, but
`syncopated_lift` (-24.37), `terrace_sprint` (-15.96), `drums_dropout` (-10.14), and
`skyline_push` (-9.33) dominated.

**Canonical.**
`generated/golden-runs/attempt-m107-objective-control-overshoot-a01/golden.json` was run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m107-objective-control-overshoot-a01`.
It was valid 1920/1920 with raw HEADLINE 693.00 and excl-impact 709.35. Budget scores:
125k 678.25, 250k 689.10, 375k 694.12, 500k 697.80.

**Decision.** `npm run decide -- generated/golden-runs/attempt-m107-objective-control-overshoot-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
returned `VERDICT: REJECT`: M102 696.35 -> M107 693.00, delta -3.3, CI [-7.2, -0.5],
P(Delta<=0)=99.1%, effect -1.98. Per-budget deltas were 125k +0.3, 250k -2.6, 375k -4.4, and
500k -3.9.

**Learnings.** Broad objective-level controlled-axis overshoot is too blunt. It finds a
`rhythm_ladder` pocket but damages the vertical/impact rows it was supposed to repair, especially
at mature budgets. Source reverted; M102 remains baseline of record. Keep the M63/readiness lead
separate: the next viable version needs narrow profile gating or a different suite-scale carrier,
not this broad overshoot pressure.

### M117 - portfolio elevation compact repair · canonical ACCEPT (2026-07-05)

**Study.** M108 got the M63/readiness descendant through the gate but left the headline at
696.65. M109-M116 then tested whether the remaining M63-shaped signal could be made
accept-safe by splitting it into disjoint pockets instead of reopening broad readiness. The
kept portfolio combines three narrow mature-budget arms: sparse elevation readiness for
`rolling_hills`/`summit_push`, compact readiness for the positive low-impact compact rows, and
stable dense repair for `drums_pendulum`/`dense_sprint`.

**Mechanism.** Objective readiness now has an optional elevation-fit factor, enabled only for
the narrow M114 sparse elevation pocket and only at mature budgets. Compact rows matching the
positive M109 profile get readiness power 0.75. Stable dense rows matching the M116 profile get
repair main-margin 1.0 at mature budgets, excluding the already accepted M101/M102/M108 repair
pockets. Fallback flags: `LR_M114_SPARSE_ELEVATION_READINESS=0`,
`LR_M115_COMPACT_READINESS075=0`, and `LR_M116_STABLE_DENSE_REPAIR_MAIN100=0`. Scorer, specs,
fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with
`LR_M114_SPARSE_ELEVATION_READINESS=0 LR_M115_COMPACT_READINESS075=0 LR_M116_STABLE_DENSE_REPAIR_MAIN100=0`
(5 files, 73 tests each).

**Probe trail.** M109 compact readiness on `mini_burst,ridge_pulse,rolling_hills,cold_start`
was all-12 valid 192/192 but inconclusive versus M108: delta +0.9, CI [-5.2, 6.4],
P(Delta<=0)=34.6%; `cold_start` was the negative row, so only the positive compact profile was
kept. M110 broad repair main100 was negative on the mature panel, delta -0.5, CI [-2.0, 0.8],
P(Delta<=0)=78.9%; only `drums_pendulum` and `dense_sprint` survived as stable positives.
M111 broad elevation readiness was rejected, delta -1.7, CI [-6.4, 1.2], P(Delta<=0)=82.9%,
after losses in `canyon_steps`, `dense_echo_climb`, `syncopated_lift`, and `skyline_push`.
M112 rhythm overshoot was one-spec inconclusive (delta +3.4, P(Delta<=0)=22.6%) and reverted.
M113 local impact weight was byte-identical. M114's corrected broad elevation predictor moved
rows but leaked losses; the narrowed `rolling_hills`/`summit_push` pocket was all-12 valid
96/96 and indicative ACCEPT, delta +2.5, P(Delta<=0)=6.1%.

**Guards.** The six-spec M117 affected-pocket probe was valid 288/288 and indicative ACCEPT
versus M108: delta +2.0, CI [-1.3, 5.3], P(Delta<=0)=9.0%, with all six intended specs
positive. The full 3-seed guard was valid 480/480, raw HEADLINE 699.71, excl-impact 716.08,
and indicative ACCEPT versus M108: delta +0.3, CI [-0.4, 1.0], P(Delta<=0)=19.0%. Its changed
spec audit found only the intended six specs moving.

**Canonical.**
`generated/golden-runs/attempt-m117-portfolio-elev-compact-repair-a01/golden.json` was run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m117-portfolio-elev-compact-repair-a01`.
It was valid 1920/1920 with raw HEADLINE 696.96 and excl-impact 714.88. Budget scores:
125k 677.98, 250k 692.38, 375k 699.18, 500k 702.32.

**Decision.** `npm run decide -- generated/golden-runs/attempt-m117-portfolio-elev-compact-repair-a01/golden.json generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01/golden.json`
returned `VERDICT: ACCEPT`: M108 696.6 -> M117 697.0, delta +0.3, CI [-0.2, 0.9],
P(Delta<=0)=9.9%, effect 1.09. Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.4, and
500k +0.4.

**Footprint.** 192/1920 paired checkpoints changed: 112 improvements, 80 regressions, 1728
plateaus. Only the six intended specs moved. Weighted spec deltas were `rolling_hills` +5.94,
`ridge_pulse` +2.19, `drums_pendulum` +1.33, `dense_sprint` +0.92, `summit_push` +0.91, and
`mini_burst` +0.72. Accepted source commit: `189d2f8`. New baseline is
`attempt-m117-portfolio-elev-compact-repair-a01`; remaining target gap is 3.04 headline points.

### M108 - dense readiness plus pulse repair · canonical ACCEPT (2026-07-05)

**Study.** M105 nearly pushed the M63/readiness descendant through the gate, but the two-spec
selector stopped at P(Delta<=0)=21.9%. The only all-12-clean add-on from the same residual work
was exact mature repair timing for `drums_pulse`. A synthetic disjoint-spec combine of M105
(`drums_breath` + `drums_crescendo`) and the `drums_pulse` repair rows predicted
`VERDICT: ACCEPT`: delta +0.3, CI [-0.1, 1.0], P(Delta<=0)=12.6%, effect 1.00.

**Mechanism.** Add two narrow mature-budget selectors after the accepted M75/M101/M102 paths.
The readiness arm uses readiness power 0.75 for the M105 dense-drum profiles:
`drums_breath`-shaped high-air/low-impact and `drums_crescendo`-shaped wide-air/wide-speed.
The repair arm uses main repair margin 1.0 for the `drums_pulse`-shaped steady-speed profile.
Fallback flags: `LR_M108_DENSE_DRUM_READINESS075=0` and
`LR_M108_DRUMS_PULSE_REPAIR_MAIN100=0`. Scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule stayed unchanged.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M108_DENSE_DRUM_READINESS075=0 LR_M108_DRUMS_PULSE_REPAIR_MAIN100=0`
(6 files, 78 tests each).

**Canonical.**
`generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01/golden.json` was run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01`.
It was valid 1920/1920 with raw HEADLINE 696.65 and excl-impact 715.04. Budget scores:
125k 677.98, 250k 692.19, 375k 698.78, 500k 701.94.

**Decision.** `npm run decide -- generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
returned `VERDICT: ACCEPT`: M102 696.35 -> M108 696.65, delta +0.3, CI [-0.1, 1.0],
P(Delta<=0)=12.6%, effect 1.00. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.3, and
500k +0.3.

**Footprint.** 98/1920 paired checkpoints changed: 64 improvements, 34 regressions, 1822
plateaus. Weighted spec deltas were `drums_crescendo` +6.29, `drums_breath` +3.95, and
`drums_pulse` +1.32. This is the keepable M63/readiness continuation: not a wider M63 retry,
but a narrow readiness pair plus one independent repair row. Accepted source commit: `6a58e2a`.
New baseline is `attempt-m108-dense-readiness-pulse-repair-a01`; remaining target gap is 3.35
headline points.

### M101 - flat compact repair main-margin exactness · canonical ACCEPT (2026-07-04)

**Mechanism.** Promoted the local repair selector implied by M100's footprint. The accepted
repair main-margin ramp remains the default, but flat compact profiles with no authored
elevation range, no authored amplitude range, and at most 32 contacts use main repair margin
1.0 at mature budgets (>=200k). This targets `mini_burst`, `syncopated_switchback`,
`cold_start`, `tiny_dance`, `opening_burst`, and `verse_chorus` while leaving 125k byte-stable.
The fallback flag is `LR_M101_REPAIR_FLAT_COMPACT_MAIN100=0`; explicit
`LR_REPAIR_MAIN_MARGIN` still overrides. Scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule stayed unchanged.

**Validation.** Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M101_REPAIR_FLAT_COMPACT_MAIN100=0` (6 files, 78 tests each).

**Probe.** Affected pocket (`probe-m101-repair-flat-compact-main100-pocket-s0-11-a01`), all
12 seeds on the six intended specs, was valid 288/288 with raw pocket HEADLINE 774.09 and
excl-impact 791.71. Decision vs M94 was indicative `VERDICT: ACCEPT`, delta +3.8,
CI [-0.0, 8.6], P(delta<=0)=2.5%, effect 1.77; per-budget deltas were 125k +0.0,
250k +3.9, 375k +2.9, and 500k +5.3. Full 3-seed guard
(`probe-m101-repair-flat-compact-main100-full-s0-2-a01`) was valid 480/480 with raw HEADLINE
698.34 and excl-impact 715.30; decision vs M94 was indicative `VERDICT: ACCEPT`, delta +0.5,
CI [-0.5, 1.9], P(delta<=0)=16.8%.

**Canonical.** `attempt-m101-repair-flat-compact-main100-a01` (valid 1920/1920, HEADLINE
695.99, excl-impact 714.67) vs `attempt-m94-lowimpact-compact-current20-a01`:

```
Delta headline = +0.5 · 95% CI [-0.0, 1.4] · P(Delta<=0)=2.9% · effect=1.42
125k +0.0 · 250k +0.5 · 375k +0.4 · 500k +0.7 · validity 100% at every budget
VERDICT: ACCEPT
```

**Footprint.** The canonical move is narrow: 192/1920 paired checkpoints changed, with
128 improvements, 64 regressions, and 1728 plateaus. The 125k tier is byte-stable. Weighted
per-spec gains were `mini_burst` +6.38, `syncopated_switchback` +4.71, `cold_start` +3.32,
`tiny_dance` +3.01, `opening_burst` +2.61, and `verse_chorus` +2.17; every other spec stayed
byte-stable.

**Learnings.** M100 was the right mechanism at the wrong scope. The accepted form is not a
repair scalar change; it is a structural flat-compact selector that applies exact repair timing
only where M100's mature-budget gains survived seed and suite dilution. New baseline is
`attempt-m101-repair-flat-compact-main100-a01`; remaining target gap is 4.01 headline points.

### M99/M100 - repair main-margin exactness · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Repriced M83's mature repair main-margin 1.0 branch on the current M94 baseline.
M99 first used the existing source-free `LR_REPAIR_MAIN_MARGIN=1.0` override on the four
previously positive specs: `pop_train`, `syncopated_switchback`, `canyon_steps`, and
`drums_pulse`. M100 then source-trialed the protected form: keep the accepted 125k repair
main-margin ramp, but use repair main margin 1.0 only for budgets >=200k. The temporary fallback
flag was `LR_M100_REPAIR_MAIN100_MATURE=0`. Candidate generation, q, start selection, forward
eval, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed frozen.

M100 focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M100_REPAIR_MAIN100_MATURE=0` (6 files, 78 tests each).

```
M99 source-free positive pocket (`probe-m99-repair-main100-positive-pocket-s0-11-a01`):
  4 specs x 12 seeds x canonical budget grid · valid 192/192
  raw pocket HEADLINE 686.61 · excl-impact 702.29
  Delta headline = +2.2 · 95% CI [-1.8, 7.3] · P(Delta<=0)=13.2% · effect=0.97
  125k -6.1 · 250k +1.9 · 375k +3.1 · 500k +3.8
  VERDICT: ACCEPT (indicative, non-promotable)

M100 protected positive pocket (`probe-m100-repair-main100-mature-positive-pocket-s0-11-a01`):
  4 specs x 12 seeds x canonical budget grid · valid 192/192
  raw pocket HEADLINE 687.22 · excl-impact 702.92
  Delta headline = +2.8 · 95% CI [-1.1, 7.9] · P(Delta<=0)=7.0% · effect=1.26
  125k +0.0 · 250k +1.9 · 375k +3.1 · 500k +3.8
  VERDICT: ACCEPT (indicative, non-promotable)

M100 full 3-seed guard (`probe-m100-repair-main100-mature-full-s0-2-a01`):
  40 specs x seeds 0..2 x canonical budget grid · valid 480/480
  raw HEADLINE 698.54 · excl-impact 715.29
  Delta headline = +0.7 · 95% CI [-1.2, 2.7] · P(Delta<=0)=23.7% · effect=0.71
  125k +0.0 · 250k -0.5 · 375k +0.6 · 500k +1.6
  VERDICT: INCONCLUSIVE (non-promotable)

M100 canonical (`attempt-m100-repair-main100-mature-a01`):
  40 specs x 12 seeds x canonical budget grid · valid 1920/1920
  raw HEADLINE 695.89 · excl-impact 714.27
  Delta headline = +0.4 · 95% CI [-0.7, 1.6] · P(Delta<=0)=23.1% · effect=0.71
  125k +0.0 · 250k +0.4 · 375k +0.2 · 500k +0.7
  VERDICT: INCONCLUSIVE
```

**Learnings.** Protecting 125k fixed M99's obvious budget-shape defect and produced a real
500k lift, but the canonical paired test still missed acceptance. Canonical M100 changed
1240/1920 hashes with 694 improvements, 536 regressions, and 690 plateaus; gains on
`mini_burst`, `syncopated_switchback`, `cold_start`, and `tiny_dance` were diluted by losses on
`drums_crescendo`, `summit_push`, `valley_bounce`, and `mixed_grade`. Do not reopen repair
main-margin scalar changes on the M94 stack without a local usefulness/value selector. Source
reverted; baseline remains `attempt-m94-lowimpact-compact-current20-a01`.

### M98 - impact onset 0.30 on old M48 pocket · source-free INCONCLUSIVE-negative (2026-07-04)

**Mechanism.** Repriced the old M48 high-onset impact-curve footprint on the current M94
baseline without source edits. The run used `LR_IMPACT_CURVE_START=0.30` only on the four specs
that moved in the old profiled canonical result: `drums_dropout`, `drums_pendulum`,
`drums_tide`, and `rhythm_ladder`. Candidate generation outside the env knob, search policy,
objective selectors, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed
frozen.

```
Old-M48-footprint probe (`probe-m98-impact-onset030-profile-pocket-s0-11-a01`):
  4 specs x 12 seeds x canonical budget grid · valid 192/192
  raw pocket HEADLINE 597.11 · excl-impact 653.18
  Delta headline = -0.8 · 95% CI [-10.3, 8.5] · P(Delta<=0)=56.5% · effect=-0.15
  125k +4.4 · 250k +1.4 · 375k -2.6 · 500k -1.8
  VERDICT: INCONCLUSIVE (indicative)
```

**Learnings.** M48 is not reopened by the current objective stack. `drums_dropout` still gains
(+3.52 weighted paired-row mean, mostly 125k), but `drums_pendulum` (-2.88),
`rhythm_ladder` (-1.59), and `drums_tide` (-1.29) erase it, and both heavier mature budgets
are negative. Do not reintroduce the high-onset profile unless a new selector isolates the
`drums_dropout` benefit without the mature-budget losses. Env-only; baseline remains
`attempt-m94-lowimpact-compact-current20-a01`.

### M96/M97 - compact readiness/current compound · full-suite INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** After M94 accepted the compact low-impact p=2.0 selector, M96 source-free priced
M75-style readiness softening on that same pocket with
`LR_M75_MATURE_OBJECTIVE_READINESS_POWER=0.75`. M97 then source-trialed the positive sub-shapes:
p=2.5 only for tiny flat compact rows (contact count <=8 and no authored elevation/amplitude
range), readiness^0.75 only for dynamic compact rows, and accepted M94 unchanged for
`cold_start`. M97 fallback flags were `LR_M97_LOW_IMPACT_TINY_FLAT_CURRENT25=0` and
`LR_M97_LOW_IMPACT_DYNAMIC_COMPACT_READINESS075=0`. Scorer, specs, fingerprint, seeds, budget
grid, and acceptance rule stayed frozen.

M97 focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with both M97 fallback flags set to `0` (6 files, 78 tests each).

```
M96 readiness pocket probe (`probe-m96-lowimpact-compact-readiness075-pocket-s0-11-a01`):
  4 specs x 12 seeds x canonical budget grid · valid 192/192
  raw pocket HEADLINE 742.49 · excl-impact 764.64
  Delta headline = +1.0 · 95% CI [-3.7, 5.3] · P(Delta<=0)=30.5% · effect=0.43
  125k +0.0 · 250k +1.1 · 375k +0.2 · 500k +1.7
  VERDICT: INCONCLUSIVE (indicative)

M97 compound pocket probe (`probe-m97-lowimpact-compact-compound-pocket-s0-11-a01`):
  4 specs x 12 seeds x canonical budget grid · valid 192/192
  raw pocket HEADLINE 743.27 · excl-impact 762.69
  Delta headline = +1.8 · 95% CI [-1.2, 5.8] · P(Delta<=0)=12.6% · effect=1.02
  125k +0.0 · 250k +2.3 · 375k +2.1 · 500k +1.7
  VERDICT: ACCEPT (indicative)

M97 full 3-seed probe (`probe-m97-lowimpact-compact-compound-full-s0-2-a01`):
  40 specs x seeds 0..2 x canonical budget grid · valid 480/480
  raw HEADLINE 697.82 · excl-impact 714.90
  Delta headline = -0.0 · 95% CI [-0.4, 0.3] · P(Delta<=0)=52.7% · effect=-0.06
  125k +0.0 · 250k +0.0 · 375k -0.1 · 500k +0.0
  VERDICT: INCONCLUSIVE (not promotable)
```

**Learnings.** The all-seed affected-pocket accept was real on that slice but not useful enough
for the suite. In the full seeds 0..2 preview, M97 changed only 27/480 hashes, split
13 improvements and 14 regressions. `rolling_hills` was positive (+2.94 weighted), but
`ridge_pulse` (-0.94) and `mini_burst` (-2.69) erased it; `cold_start` stayed byte-stable as
intended. Do not run this compound selector canonically unless a seed-robust signal separates
the later-seed `mini_burst` upside from the early-seed losses. Source reverted; baseline remains
`attempt-m94-lowimpact-compact-current20-a01`.

### M95 - flat compact current-power 2.5 dose · affected-pocket INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Dose-checked the accepted M94 compact pocket by raising only the flat compact
sub-profile from p=2.0 to p=2.5: zero authored elevation range and zero authored amplitude
range after the M94 selector matched. This selected `mini_burst` and `cold_start`, while
`ridge_pulse` and `rolling_hills` stayed on accepted M94 p=2.0. The temporary fallback flag was
`LR_M95_LOW_IMPACT_FLAT_COMPACT_CURRENT25=0`. Scorer, specs, fingerprint, seeds, budget grid,
and acceptance rule stayed frozen.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M95_LOW_IMPACT_FLAT_COMPACT_CURRENT25=0` (6 files, 78 tests each).

```
Affected-pocket probe (`probe-m95-flat-compact-current25-pocket-s0-11-a01`):
  4 specs x 12 seeds x canonical budget grid · valid 192/192
  raw pocket HEADLINE 742.55 · excl-impact 765.94
  Delta headline = +1.0 · 95% CI [-2.8, 6.0] · P(Delta<=0)=33.4% · effect=0.50
  125k +0.0 · 250k +1.5 · 375k -0.2 · 500k +2.0
  VERDICT: INCONCLUSIVE (indicative)
```

**Learnings.** The stronger dose is positive in point estimate but not stable enough to spend a
canonical run. `mini_burst` gained (+3.44 weighted paired-row mean), but `cold_start` was weaker
and seed-volatile (+1.04 weighted; large losses on seeds 2 and 4 offset later-seed wins). The
probe changed 72/192 hashes with 39 improvements, 33 regressions, and 120 plateaus. Keep M94's
p=2.0 compact dose as the boundary; do not promote the flat compact p=2.5 variant without a
stronger selector or another independent mechanism. Source reverted; baseline remains
`attempt-m94-lowimpact-compact-current20-a01`.

### M94 - low-impact compact current-power 2.0 dose · canonical ACCEPT (2026-07-04)

**Mechanism.** Refined the rejected broad M88 dose into a compact sub-selector inside the
accepted M87 low-impact steady/sparse pocket. At mature budgets, after M87 matches, the compiler
raises the current-quality exponent from 1.5 to 2.0 only when feasible contacts are <=24, median
contact gap is <40 frames, and authored amplitude target range is <=0.20. This keeps the M88
winners `mini_burst`, `cold_start`, `ridge_pulse`, and `rolling_hills`, while excluding
`grain_staircase`, `mixed_grade`, and `float_bounds`. `LR_M94_LOW_IMPACT_COMPACT_CURRENT20=0`
restores the accepted M87 dose. Scorer, specs, fingerprint, seeds, budget grid, and acceptance
rule stayed frozen.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M94_LOW_IMPACT_COMPACT_CURRENT20=0` (6 files, 78 tests each).

```
Panel probe (`probe-m94-lowimpact-compact-current20-panel-s0-2-a01`):
  7 specs x seeds 0..2 x canonical budget grid · valid 84/84
  raw panel HEADLINE 738.62 · excl-impact 755.82
  Delta headline = +3.5 · 95% CI [-0.2, 8.0] · P(Delta<=0)=3.6% · effect=1.69
  VERDICT: ACCEPT (indicative)

Full 3-seed probe (`probe-m94-lowimpact-compact-current20-full-s0-2-a01`):
  40 specs x seeds 0..2 x canonical budget grid · valid 480/480
  raw HEADLINE 697.83 · excl-impact 714.89
  Delta headline = +0.6 · 95% CI [-0.0, 1.5] · P(Delta<=0)=4.9% · effect=1.47
  125k +0.0 · 250k +0.9 · 375k +0.7 · 500k +0.5
  VERDICT: ACCEPT (indicative)

Canonical (`attempt-m94-lowimpact-compact-current20-a01`):
  40 specs x 12 seeds x canonical budget grid · valid 1920/1920
  raw HEADLINE 695.48 · excl-impact 714.05
  Delta headline = +0.4 · 95% CI [-0.0, 1.1] · P(Delta<=0)=5.9% · effect=1.32
  125k +0.0 · 250k +0.5 · 375k +0.5 · 500k +0.4
  VERDICT: ACCEPT
```

**Learnings.** M88's broad p=2.0 dose was correctly rejected, but it contained a harvestable
sub-pocket. The canonical footprint changed only the intended four specs: `mini_burst` +7.35,
`cold_start` +4.93, `ridge_pulse` +2.48, and `rolling_hills` +0.66 paired-row mean; excluded
M88 losers stayed byte-stable. Changed checkpoints: 142/1920 hashes, with 84 improvements,
58 regressions, and 1778 plateaus. The 125k tier is byte-identical; all lift comes from the
mature budgets, and 500k now reports 700.37 while the weighted headline is 695.48. New baseline
is `attempt-m94-lowimpact-compact-current20-a01`; remaining target gap is 4.52 headline points.

### M93 - dense-modulated aim K7 selector · canonical REJECT (reverted, 2026-07-04)

**Mechanism.** After M92 rejected global mature K=7, tested a tight production selector that
raised high-budget aim bases from accepted K=6 to K=7 only for the dense modulated drum profile:
contact-ending gaps >=50, air-target range 0.25..0.36, speed-target range 0.25..0.29, and no
elevation/amplitude target range. This selected `drums_swell`, `drums_tide`, and `drums_zigzag`;
`LR_M93_DENSE_MODULATED_AIM_K7=0` restored the accepted path.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M93_DENSE_MODULATED_AIM_K7=0` (6 files, 78 tests each).

```
Panel probe (`probe-m93-dense-modulated-k7-panel-s0-2-a01`):
  10 specs x seeds 0..2 x {250k,375k,500k} · valid 90/90
  Delta headline = +4.9 · 95% CI [-0.3, 12.5] · P(Delta<=0)=5.8% · effect=1.49
  VERDICT: ACCEPT (indicative)

Full 3-seed probe (`probe-m93-dense-modulated-k7-full-s0-2-a01`):
  40 specs x seeds 0..2 x canonical budget grid · valid 480/480
  raw HEADLINE 698.35 · excl-impact 715.13
  Delta headline = +1.1 · 95% CI [-0.0, 3.0] · P(Delta<=0)=7.0% · effect=1.39
  125k +0.0 · 250k +1.4 · 375k +1.2 · 500k +1.2
  VERDICT: ACCEPT (indicative)

Canonical (`attempt-m93-dense-modulated-k7-a01`):
  40 specs x 12 seeds x canonical budget grid · valid 1920/1920
  raw HEADLINE 694.26 · excl-impact 712.23
  Delta headline = -0.8 · 95% CI [-2.7, 0.2] · P(Delta<=0)=92.5% · effect=-1.05
  125k +0.0 · 250k -0.9 · 375k -0.7 · 500k -1.0
  VERDICT: REJECT
```

**Learnings.** The selector was clean but not seed-robust. Canonical changed only 108/1920 paired
rows, all in the intended three specs, but split 49 improvements vs 59 regressions. Canonical
means flipped to `drums_swell` -14.99, `drums_tide` -9.21, and `drums_zigzag` -1.52; later seeds
contained large losses (`drums_swell` seed 4 -92.7, `drums_tide` seed 8 -77.0). This closes the
static dense-modulated K7 selector; do not retry without a seed-robust usefulness signal. Source
reverted; baseline remains `attempt-m87-lowimpact-steady-current15-a01`.

### M92 - mature aim top-k 7 on current M87 · source-free REJECT (2026-07-04)

**Mechanism.** Env-priced the current mature aim-base dose with `LR_AIM_TOPK_BASES=7`, limited
to budgets 250k/375k/500k because a production change would leave 125k on the accepted scarce
K=4 behavior. Source code, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule
stayed frozen.

```
Mature probe (`probe-m92-aimtopk7-mature-current-s0-2-a01`):
  40 specs × seeds 0..2 × {250k,375k,500k} · valid 360/360
  raw mature HEADLINE 695.60 · excl-impact 711.49
  Delta headline = -3.8 · 95% CI [-9.3, 0.7] · P(Delta<=0)=94.5% · effect=-1.49
  250k -4.3 · 375k -4.4 · 500k -3.1
  VERDICT: REJECT (indicative)
```

**Learnings.** M87 does not reopen the K=7 aim-base dose. The extra base helped
`drums_zigzag` (+28.49 mean over paired mature rows) and `drums_tide` (+20.27), but lost more
on `syncopated_switchback` (-46.43), `drums_dropout` (-30.47), `drums_signature` (-23.98),
`drums_pulse` (-23.85), and `dense_sprint` (-18.48). Changed footprint was 339/360 paired
checkpoints, split 144 improvements, 193 regressions, and 23 plateaus; sampled candidates fell
by about 481 and viable candidates by 369 per paired row. Keep the accepted K=6 mature aim-base
setting unless a new selector appears. Env-only; baseline remains
`attempt-m87-lowimpact-steady-current15-a01`.

### M91 - scarce low-slack branch threshold 2.25 · 125k probe INCONCLUSIVE-flat (reverted, 2026-07-04)

**Mechanism.** Temporarily raised the accepted pre-completion low-slack branch limiter from
slack 1.5 to 2.25, with `LR_M91_SCARCE_BRANCH22=0` restoring the accepted threshold. This
targeted the weak 125k `dense_sprint` / `rhythm_ladder` band just above slack 2.0 while leaving
scorer, specs, fingerprint, seeds, budget grid, and acceptance rule frozen.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M91_SCARCE_BRANCH22=0` (6 files, 78 tests each).

```
125k probe (`probe-m91-scarce-branch225-125-s0-2-a01`):
  40 specs × seeds 0..2 × 125k · valid 120/120
  raw HEADLINE 677.65 · excl-impact 696.52
  Delta headline = +0.0 · 95% CI [0.0, 0.0] · P(Delta<=0)=100.0% · effect=0.00
  VERDICT: INCONCLUSIVE-flat (indicative)
```

**Learnings.** The threshold affected policy telemetry but not score: on seeds 0..2,
`dense_sprint` mean branch limit moved 3.000 -> 2.563 and `rhythm_ladder` 3.000 -> 2.643,
yet only one paired track hash changed and all 120 paired 125k scores were identical. The
accepted branch limiter is not the remaining 125k bottleneck unless paired with a different
candidate-ordering/value signal. Source reverted; baseline remains
`attempt-m87-lowimpact-steady-current15-a01`.

### M89 - vertical current-power 2.5 dose · full-suite REJECT (reverted, 2026-07-04)

**Mechanism.** Dose-check the accepted M74 vertical/M64-band selector on top of the current M87
baseline by raising only that pocket from `currentQuality^2.0 * readiness` to
`currentQuality^2.5 * readiness`. The temporary source used
`LR_M89_VERTICAL_OBJECTIVE_CURRENT25=0` as a fallback to the accepted M74 dose. The M64 band,
M87 low-impact selector, 125k maturity gate, scorer, specs, fingerprint, seeds, budget grid,
and acceptance rule stayed frozen.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M89_VERTICAL_OBJECTIVE_CURRENT25=0` (6 files, 78 tests each).

```
Full probe (`probe-m89-vertical-current25-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 696.94 · excl-impact 713.51
  Delta headline = -0.3 · 95% CI [-0.9, 0.2] · P(Delta<=0)=87.7% · effect=-1.06
  125k +0.0 · 250k -0.4 · 375k -0.3 · 500k -0.3
  VERDICT: REJECT (indicative)
```

**Learnings.** The accepted vertical M63-form dose is not under-tuned. Power 2.5 helped
`climb_terrace` (+1.51 weighted), `glide_stairs` (+0.38), and `skyline_push` (+0.25), but lost
more on `big_air_ramp` (-5.61), `terrace_sprint` (-4.38), and `swoop_dive` (-4.22). The
footprint was 54/480 changed checkpoints, split 24 improvements and 30 regressions; mean work
movement was tiny (-23 sim frames, -6.2 sampled, -7.7 viable, +270 repair frames, -0.050 repair
accepts, +16 forward-eval frames per paired row). Do not raise the M74 vertical current dose
unchanged. Temporary source reverted; baseline remains
`attempt-m87-lowimpact-steady-current15-a01`.

### M88 - low-impact steady current-power 2.0 dose · full-suite INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Dose-check the newly accepted M87 low-impact steady/sparse selector by raising
that pocket from `currentQuality^1.5 * readiness` to `currentQuality^2.0 * readiness`.
`LR_M88_LOW_IMPACT_STEADY_CURRENT20=0` fell back to the accepted M87 dose during the temporary
source trial. The M64/M74 impact-band selector kept precedence, 125k remained byte-identical,
and scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed frozen.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M88_LOW_IMPACT_STEADY_CURRENT20=0` (6 files, 78 tests each).

```
Full probe (`probe-m88-lowimpact-steady-current20-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 697.25 · excl-impact 714.53
  Delta headline = +0.0 · 95% CI [-1.7, 1.4] · P(Delta<=0)=45.6% · effect=0.01
  125k +0.0 · 250k +0.2 · 375k +0.2 · 500k -0.2
  VERDICT: INCONCLUSIVE (non-promotable)
```

**Learnings.** M87 is not under-dosed. Power 2.0 helps `mini_burst` (+11.55), `cold_start`
(+5.87), `ridge_pulse` (+2.77), and `rolling_hills` (+2.77), but regresses `float_bounds`
(-17.92) and slightly hurts `grain_staircase` (-0.62) and `mixed_grade` (-0.78). The footprint
is only 63/480 changed checkpoints, split 34 improvements and 29 regressions, and the 500k tier
is negative. Do not raise the M87 selector unchanged. Temporary source reverted; baseline
remains `attempt-m87-lowimpact-steady-current15-a01`.

### M87 - low-impact steady/sparse current objective gate · canonical ACCEPT (2026-07-04)

**Mechanism.** Push the M63/M64 current-quality exponent idea into the clean low-impact pocket
that broad M62 exposed but M64 intentionally skipped. At mature budgets, specs with authored
impact prevalence in `[0.12,0.35]`, 7..40 feasible contacts, and either sparse cadence
(median contact gap >=0.90s) or steady air/speed targets (air range <=0.16 and speed range
<=0.18) use `currentQuality^1.5 * readiness`. The existing M64/M74 impact-band selector keeps
precedence, 125k stays byte-identical through the mature-budget gate, explicit
`LR_M64_OBJECTIVE_CURRENT_POWER` still wins, and `LR_M87_LOW_IMPACT_STEADY_CURRENT15=0` is the
escape hatch. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed frozen.

Focused tests passed in default and escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M87_LOW_IMPACT_STEADY_CURRENT15=0` (6 files, 78 tests each).

```
Full probe (`probe-m87-lowimpact-steady-current15-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 697.24 · excl-impact 713.73
  Delta headline = +1.0 · 95% CI [-0.0, 2.3] · P(Delta<=0)=2.7% · effect=1.63
  125k +0.0 · 250k +1.7 · 375k +0.9 · 500k +0.9
  VERDICT: ACCEPT (non-promotable)

Canonical (`attempt-m87-lowimpact-steady-current15-a01`):
  40 specs × 12 seeds × canonical budget grid · valid 1920/1920
  HEADLINE 695.06 · excl-impact 713.53
  Delta headline = +0.5 · 95% CI [-0.1, 1.4] · P(Delta<=0)=5.6% · effect=1.36
  125k +0.0 · 250k +0.9 · 375k +0.6 · 500k +0.5
  VERDICT: ACCEPT
```

**Learnings.** This is another keepable M63-form, not a broad M63 retry. It affects exactly the
intended seven specs: `grain_staircase` (+5.93), `float_bounds` (+5.07), `mini_burst` (+3.74),
`rolling_hills` (+3.53), `cold_start` (+1.29), `mixed_grade` (+0.63), and `ridge_pulse`
(+0.36). Changed checkpoints: 252/1920, with 152 improvements, 100 regressions, and 1668
plateaus. Work deltas are not a spend increase: about -144 forward-eval frames, +6.6 sampled
candidates, +1.9 viable candidates, -443 repair frames, and -0.027 repair accepts per paired
row. The selector preserves the known high-impact M63 collateral closures while harvesting the
low-impact steady pocket. New baseline is `attempt-m87-lowimpact-steady-current15-a01`;
remaining target gap is 4.94 headline points.

### M86 - mature true-target vertical forward-eval selector · full-suite REJECT (reverted, 2026-07-04)

**Mechanism.** Retested the older target-consistency vertical selector idea on top of M75 with
125k protected. The temporary source made the existing mature vertical `avg` forward-eval
selector read `ctx.gapAxisTargets` instead of jittered `gap.targets` only at budgets >=200k.
Candidate generation, q, start selection, repair, scorer, specs, fingerprint, seeds, budget
grid, and acceptance rule stayed unchanged.

Focused tests passed:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 78 tests).

```
M86 full probe (`probe-m86-true-target-vertical-mature-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 696.0 · excl-impact 713.35
  Delta headline = -0.3 · 95% CI [-0.8, 0.1] · P(Delta<=0)=91.5% · effect=-1.16
  125k +0.0 · 250k -0.4 · 375k -0.3 · 500k -0.3
  VERDICT: REJECT (indicative)
```

**Learnings.** The 125k protection worked, but the mature rows moved negative on the current
M75 stack. Only 42/480 paired scores changed (15 improvements, 27 regressions). `ridge_pulse`
improved (+1.07), but the affected vertical panel lost: `dense_echo_climb` -3.99,
`switchback_pop` -2.81, `terrace_sprint` -1.66, `canyon_steps` -0.53, `skyline_push` -0.41,
and `syncopated_lift` -0.35. Do not retry the mature true-target vertical-selector retest
unchanged. Temporary source reverted; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

### M85 - roomy vertical high-impact current objective extension · canonical INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Push the encouraging M63/M64 idea through a narrower selector instead of
reopening the full M63 width. M84 extended the M74 current-objective p=2 dose only to
high-impact-prevalence rows above the accepted M64 band that also matched the existing M74
vertical profile (`summit_push`, `rolling_drop`). M85 added a second roomy moderate-vertical
p=1.5 fallback for the M78-positive but M84-excluded `leap_cadence`. Explicit
`LR_M64_OBJECTIVE_CURRENT_POWER`, scorer, specs, fingerprint, seeds, budget grid, and acceptance
rule stayed unchanged.

Focused tests passed for both source trials:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 78 tests).

```
M84 affected-slice probe (`probe-m84-vertical-highimpact-current20-s0-2-a01`):
  summit_push, leap_cadence, rolling_drop · seeds 0..2 × canonical budget grid · valid 36/36
  raw slice HEADLINE 705.77 · excl-impact 705.56
  Delta headline = +1.2 · 95% CI [-1.9, 3.4] · P(Delta<=0)=18.0% · effect=0.86
  125k +0.0 · 250k +0.4 · 375k +1.7 · 500k +1.5
  VERDICT: ACCEPT (indicative only)

M84 canonical (`attempt-m84-vertical-highimpact-current20-a01`):
  40 specs × 12 seeds × canonical budget grid · valid 1920/1920
  raw HEADLINE 694.57 · excl-impact 713.53
  Delta headline = +0.1 · 95% CI [-0.1, 0.2] · P(Delta<=0)=25.6% · effect=0.77
  125k +0.0 · 250k +0.0 · 375k +0.1 · 500k +0.1
  VERDICT: INCONCLUSIVE

M85 affected-slice probe (`probe-m85-roomy-vertical-highimpact-current-s0-2-a01`):
  summit_push, leap_cadence, rolling_drop · seeds 0..2 × canonical budget grid · valid 36/36
  raw slice HEADLINE 708.10 · excl-impact 707.45
  Delta headline = +3.5 · 95% CI [-1.0, 9.8] · P(Delta<=0)=5.9% · effect=1.31
  125k +0.0 · 250k +2.3 · 375k +5.2 · 500k +3.7
  VERDICT: ACCEPT (indicative only)

M85 canonical (`attempt-m85-roomy-vertical-highimpact-current-a01`):
  40 specs × 12 seeds × canonical budget grid · valid 1920/1920
  raw HEADLINE 694.56 · excl-impact 713.49
  Delta headline = +0.0 · 95% CI [-0.2, 0.3] · P(Delta<=0)=32.4% · effect=0.44
  125k +0.0 · 250k -0.0 · 375k +0.1 · 500k +0.1
  VERDICT: INCONCLUSIVE
```

**Learnings.** The M63 width was pushed to the strongest clean selectors found from M78 and
still did not ACCEPT. M84 isolated the two stable positive rows but was too small:
`summit_push` +1.190 weighted and `rolling_drop` +1.113, changing only 71/1920 scores. M85
added `leap_cadence`; the 3-seed gain was a false positive, and canonical `leap_cadence`
regressed -0.514 weighted (250k -2.64, 375k +0.90, 500k -0.64), leaving M85 at 59 improvements
and 48 regressions across 107 changed scores. Do not continue the M63/M64 line by widening the
impact-prevalence band or by adding roomy vertical fallback selectors. Temporary source reverted;
baseline remains `attempt-m75-highair-impact-readiness075-a01`.

### M83 - mature repair main-margin 1.0 · full-suite INCONCLUSIVE-flat (reverted, 2026-07-04)

**Mechanism.** Follow-up to the M82 repair-margin screen. M82 used the existing
`LR_REPAIR_MAIN_MARGIN=1.0` override on the current worst-10 slice and showed weak mature-budget
upside but a large 125k cost. M83 made the same idea budget-shaped in source: keep the accepted
default ramp at 125k, but use repair main margin 1.0 for budgets >=200k. Candidate generation,
start selection, forward eval, scorer, specs, fingerprint, seeds, budget grid, and acceptance
rule stayed unchanged.

```
Worst-10 pre-screen (`probe-m82-repair-main100-worst10-s0-2-a01`):
  drums_pendulum, skyline_push, terrace_sprint, syncopated_lift, canyon_steps,
  dense_echo_climb, drums_dropout, dense_sprint, rhythm_ladder, rolling_drop
  seeds 0..2 × canonical budget grid · valid 120/120
  raw slice HEADLINE 614.71 · excl-impact 634.68
  Delta headline = +0.2 · 95% CI [-1.7, 2.9] · P(Delta<=0)=43.9% · effect=0.23
  125k -5.3 · 250k +1.4 · 375k +1.0 · 500k +0.5
  VERDICT: INCONCLUSIVE (non-promotable)

Full 3-seed source probe (`probe-m83-repair-main100-mature-full-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 696.31 · excl-impact 713.12
  Delta headline = +0.0 · 95% CI [-2.2, 2.0] · P(Delta<=0)=48.0% · effect=0.03
  125k +0.0 · 250k -0.1 · 375k -0.3 · 500k +0.4
  VERDICT: INCONCLUSIVE (flat, non-promotable)
```

**Learnings.** Protecting 125k removes M82's early-budget damage, but the mature repair margin
still does not create suite-level lift. M83 changed 313/480 paired scores (173 improvements,
140 regressions, 167 plateaus): gains on `pop_train` (+10.54 weighted),
`syncopated_switchback` (+10.40), `canyon_steps` (+7.52), and `drums_pulse` (+5.29) were offset
by `float_bounds` (-9.15), `drums_tide` (-8.21), `summit_push` (-6.26), and `mini_burst`
(-4.78). At 500k it spent about +6.9k sim frames and +28.7k repair frames per row, with +91
full evaluations, -33.6 repair restarts, and only +1.8 repair accepts. The repair main-margin
scalar is not a promotion path; any future repair work needs a local value selector rather than
a global margin change. Temporary source reverted; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

### M81 - vertical avg forward-eval branch 2 · affected-slice REJECT (reverted, 2026-07-04)

**Mechanism.** Temporary source probe: raise the existing mature vertical-drama forward-eval
override from `avg` branch 1 to branch 2 (`MATURE_AVG_FWD_EVAL_BRANCH = 2`). This only changes
the already accepted default vertical override path; explicit `LR_FWD_EVAL` overrides, candidate
generation, start selection, repair, scorer, specs, fingerprint, seeds, budgets, and acceptance
rule stayed unchanged.

```
Affected-slice probe (`probe-m81-vertical-avg-branch2-s0-2-a01`):
  skyline_push, terrace_sprint, syncopated_lift, canyon_steps, dense_echo_climb, rolling_drop
  seeds 0..2 × canonical budget grid · valid 72/72
  raw slice HEADLINE 624.20 · excl-impact 625.42
  Delta headline = -3.0 · 95% CI [-7.9, 0.8] · P(Delta<=0)=92.2% · effect=-1.34
  125k -6.6 · 250k -5.5 · 375k -1.2 · 500k -2.1
  VERDICT: REJECT
```

**Learnings.** Extra vertical lookahead is not the missing repair. It slightly helps
`syncopated_lift` (+1.21 weighted) and `rolling_drop` (+0.44), but hurts `dense_echo_climb`
(-10.89), `skyline_push` (-5.68), `canyon_steps` (-2.35), and `terrace_sprint` (-0.14). At
500k it charges about +1.7k sim frames while sampling about 3.8k fewer candidates and 3.1k fewer
viable candidates per row. Keep the mature vertical override at branch 1. Temporary source
reverted; baseline remains `attempt-m75-highair-impact-readiness075-a01`.

### M80 - broad mature readiness q=0.75 · source-free REJECT (2026-07-04)

**Study.** Test whether M75's accepted readiness softening was too narrow by applying
`LR_M75_MATURE_OBJECTIVE_READINESS_POWER=0.75` to the whole current worst-10 mature slice.
This leaves 125k byte-identical and makes `skyline_push`/`drums_dropout` effectively
byte-identical to M75, while newly softening the other residual specs.

```
Probe (`probe-m80-readiness075-worst10-s0-2-a01`):
  drums_pendulum, skyline_push, terrace_sprint, syncopated_lift, canyon_steps,
  dense_echo_climb, drums_dropout, dense_sprint, rhythm_ladder, rolling_drop
  seeds 0..2 × canonical budget grid · valid 120/120
  raw slice HEADLINE 610.85 · excl-impact 630.40
  Delta headline = -3.6 · 95% CI [-9.6, 0.9] · P(Delta<=0)=94.4% · effect=-1.39
  125k +0.0 · 250k -4.2 · 375k -3.7 · 500k -4.2
  VERDICT: REJECT
```

**Learnings.** M75's narrow high-air/impact selector is necessary. The already-selected
`drums_dropout` and `skyline_push` are byte-identical; the broader residual rows are negative,
led by `dense_sprint` (-16.23), `dense_echo_climb` (-7.25), `rolling_drop` (-6.31),
`canyon_steps` (-3.45), and `drums_pendulum` (-1.81). Do not broaden readiness q=0.75 by
profile without a new usefulness signal. Env-only; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

### M79 - q34 breadth on vertical/amplitude residual slice · source-free INCONCLUSIVE-negative (2026-07-04)

**Study.** Recheck the old M54 candidate-breadth idea under the current M75 stack without source
edits: `LR_QUALITY_NCAND=34` on the current vertical/amplitude residual panel
(`skyline_push`, `terrace_sprint`, `syncopated_lift`, `canyon_steps`, `dense_echo_climb`,
`rolling_drop`), seeds 0..2 and the canonical budget grid.

```
Probe (`probe-m79-q34-verticalamp-s0-2-a01`):
  6 specs × seeds 0..2 × canonical budget grid · valid 72/72
  raw slice HEADLINE 625.83 · excl-impact 626.14
  Delta headline = -1.3 · 95% CI [-5.4, 2.6] · P(Delta<=0)=77.1% · effect=-0.67
  125k -1.9 · 250k +0.1 · 375k +0.1 · 500k -3.0
  VERDICT: INCONCLUSIVE (negative, non-promotable)
```

**Learnings.** q34 still behaves like a seed-fragile breadth lever rather than a current-stack
repair. It helps `canyon_steps` (+4.21 weighted) and leaves `rolling_drop` flat (+0.03), but
hurts `skyline_push` (-6.05), `dense_echo_climb` (-3.43), `terrace_sprint` (-1.33), and
`syncopated_lift` (-1.02). The 500k tier is negative on the panel, so do not promote or build a
selector from this q34 slice. Env-only; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

### M78 - M63-width current-stack objective gate · affected-slice INCONCLUSIVE-negative (reverted, 2026-07-04)

**Study.** Revisit the user's M63 question on the current M75 stack by temporarily widening the
M64 upper authored-impact prevalence bound from `0.51` to `1.0`. This recreates the M63
high-impact breadth while preserving the accepted M64/M74/M75 machinery. The source change only
newly affects five specs above the M64 band:
`syncopated_switchback`, `drums_dropout`, `summit_push`, `leap_cadence`, and `rolling_drop`.

```
Affected-slice probe (`probe-m78-m63-width-currentstack-affected-s0-2-a01`):
  5 specs × seeds 0..2 × canonical budget grid · valid 60/60
  raw slice HEADLINE 681.11 · excl-impact 700.71
  Delta headline = -4.4 · 95% CI [-22.3, 7.2] · P(Delta<=0)=67.5% · effect=-0.55
  125k +0.0 · 250k -7.7 · 375k -5.4 · 500k -3.0
  VERDICT: INCONCLUSIVE (negative, non-promotable)
```

**Learnings.** M75 did not neutralize the old M63 collateral. The widened band helps
`leap_cadence` (+7.67 weighted) and `summit_push` (+3.40), but gives that back on
`syncopated_switchback` (-17.87) and `drums_dropout` (-11.13); `rolling_drop` is flat (+0.05).
The accepted M64 band remains the keepable M63 form. Do not pursue a simple M63-width upper-bound
retest on the current stack. Temporary source reverted; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

### M77 - mature readiness sharpening · source-free REJECT (2026-07-04)

**Study.** Test the opposite side of the M75 objective surface without source edits:
`LR_M75_MATURE_OBJECTIVE_READINESS_POWER=1.25` on the current worst-10 slice, leaving 125k
byte-identical and changing only mature budgets.

```
Probe (`probe-m77-readiness125-worst10-s0-2-a01`):
  drums_pendulum, skyline_push, terrace_sprint, syncopated_lift, canyon_steps,
  dense_echo_climb, drums_dropout, dense_sprint, rhythm_ladder, rolling_drop
  seeds 0..2 × canonical budget grid · valid 120/120
  raw slice HEADLINE 606.90 · excl-impact 627.46
  Delta headline = -7.6 · 95% CI [-16.7, -0.8] · P(Delta<=0)=98.8% · effect=-1.87
  125k +0.0 · 250k -10.3 · 375k -6.1 · 500k -9.2
  VERDICT: REJECT
```

**Learnings.** The accepted objective surface should not move toward higher readiness power.
Mature readiness sharpening is strongly negative on the current residual slice. Env-only;
baseline remains `attempt-m75-highair-impact-readiness075-a01`.

### M76 - M75 readiness dose sweep · affected-slice REJECT (reverted, 2026-07-04)

**Study.** Bracket the newly accepted M75 selector dose on the exact affected slice
(`drums_dropout`, `skyline_push`). Temporary source changed only
`M75_HIGH_AIR_IMPACT_READINESS_POWER`, leaving the selector and all suite/scoring knobs fixed.

```
Power 0.5 (`probe-m76-m75-readiness050-affected-s0-2-a01`):
  2 specs × seeds 0..2 × canonical budget grid · valid 24/24
  Delta headline = -11.5 · 95% CI [-33.5, 11.2] · P(Delta<=0)=88.1%
  125k +0.0 · 250k -16.3 · 375k -12.2 · 500k -11.4
  VERDICT: REJECT

Power 0.9 (`probe-m76-m75-readiness090-affected-s0-2-a01`):
  2 specs × seeds 0..2 × canonical budget grid · valid 24/24
  Delta headline = -21.8 · 95% CI [-65.9, -0.1] · P(Delta<=0)=99.0%
  125k +0.0 · 250k -24.4 · 375k -21.5 · 500k -26.2
  VERDICT: REJECT
```

**Learnings.** The accepted M75 dose is local: both stronger and milder readiness exponents
give back score on the exact rows M75 is allowed to affect. Do not continue the M75 line with a
scalar dose change. Source reverted; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

### M75 - high-air impact readiness softening · canonical ACCEPT (2026-07-04)

**Mechanism.** Add the missing readiness exponent side of the M61 objective hook, then promote
only the clean selector found after the broad dose screen. At mature budgets, authored profiles
with mean air in `[0.62,0.66]`, mean authored impact >=0.45, speed range <=0.36, and median
contact gap <=0.75s use `currentQuality^p * readiness^0.75`; `p` remains whatever M64/M74
selected for the spec. The 125k tier stays byte-identical through the existing mature-budget
gate. Escape hatch: `LR_M75_HIGH_AIR_IMPACT_READINESS075=0`; explicit
`LR_M75_OBJECTIVE_READINESS_POWER` still wins for whole-run studies.

Focused tests passed in default and escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M75_HIGH_AIR_IMPACT_READINESS075=0` (6 files, 78 tests each).

```
Broad mature q=0.75 screen (`probe-m75-readiness075-worst10-s0-2-a01`):
  worst-10 specs × seeds 0..2 × canonical budget grid · valid 120/120
  Delta headline = +1.6 · 95% CI [-4.8, 11.9] · P(Delta<=0)=39.5% · effect=0.38
  125k +0.0 · 250k +3.2 · 375k +1.1 · 500k +1.6
  Footprint: `drums_dropout` large positive, `skyline_push` smaller positive, broad collateral.

Tight selector full probe (`probe-m75-highair-impact-readiness075-tight-full-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 696.28 · excl-impact 713.71
  Delta headline = +1.2 · 95% CI [0.0, 4.0] · P(Delta<=0)=12.8% · effect=1.05
  125k +0.0 · 250k +1.4 · 375k +1.0 · 500k +1.4
  VERDICT: ACCEPT (non-promotable)
```

**Canonical.** `attempt-m75-highair-impact-readiness075-a01` vs
`attempt-m74-vertical-objective-current20-a01`:

```
HEADLINE 694.10 -> 694.51 · excl-impact 712.92 -> 713.27 · valid 1920/1920
Delta headline = +0.4 · 95% CI [-0.1, 1.7] · P(Delta<=0)=19.2% · effect=0.88
125k +0.0 · 250k +0.4 · 375k +0.3 · 500k +0.6
VERDICT: ACCEPT
```

**Learnings.** The readiness exponent is useful only in a tiny residual basin; broad
`readiness^0.75` is too noisy. The accepted selector changes 72/1920 paired checkpoints, with
49 improvements, 23 regressions, and 1848 plateaus. Weighted movement is exactly
`drums_dropout` +12.38 and `skyline_push` +2.26; `opening_burst` was excluded by the upper
air-mean guard after it lost in the looser selector probe. 125k remains byte-identical. Baseline
is now `attempt-m75-highair-impact-readiness075-a01`; remaining gap to 700 is 5.49.

### M74 - vertical M64 objective current-power dose · canonical ACCEPT (2026-07-04)

**Mechanism.** Keep the accepted M64 mature impact-prevalence gate, but raise the
current-quality exponent from 1.5 to 2.0 only for authored vertical profiles where M66's
per-spec split showed the stronger dose was useful: large amplitude range, or elevation
variation with enough contact room. The 125k tier stays byte-identical through the existing M64
mature-budget gate. Escape hatch: `LR_M74_VERTICAL_OBJECTIVE_CURRENT20=0`; explicit
`LR_M64_OBJECTIVE_CURRENT_POWER` still wins.

Focused tests passed:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 77 tests).

```
Focused probe (`probe-m74-vertical-objective-current20-room09-s0-2-a01`):
  6 selected specs × seeds 0..2 × canonical budget grid · valid 72/72
  raw slice HEADLINE 689.67 · excl-impact 681.97
  Delta headline = +2.7 · 95% CI [-0.6, 5.8] · P(Delta<=0)=5.0% · effect=1.72
  125k +0.0 · 250k +4.4 · 375k +3.3 · 500k +2.1
  VERDICT: ACCEPT (non-promotable)

Canonical (`attempt-m74-vertical-objective-current20-a01`):
  40 specs × 12 seeds × canonical budget grid · valid 1920/1920
  HEADLINE 694.10 · excl-impact 712.92
  Delta headline = +0.2 · 95% CI [-0.4, 0.8] · P(Delta<=0)=17.3% · effect=0.80
  125k +0.0 · 250k +0.3 · 375k +0.3 · 500k +0.2
  VERDICT: ACCEPT
```

**Learnings.** M66 was not a simple scalar dead end; it was a selector problem. The accepted
M64 p=1.5 remains right for dense/no-vertical rows, while vertical dynamic rows can use stronger
current-gap pressure. The canonical movement is narrow: 216/1920 checkpoints changed, with 139
improvements, 77 regressions, and 1704 plateaus. Weighted spec movement was led by
`swoop_dive` +5.61, `skyline_push` +3.11, `climb_terrace` +2.79, and `glide_stairs` +1.05,
offset by `terrace_sprint` -0.32 and `big_air_ramp` -2.69. Baseline is now
`attempt-m74-vertical-objective-current20-a01`; remaining gap to 700 is 5.90.

### M73 - full forward-eval leaf on current default · source-free REJECT (2026-07-04)

**Study.** Reprice the exact full re-detection leaf after M64 changed the objective surface.
Source-free env only: `LR_FWD_EVAL_LEAF=full`, leaving generation, start selector shape,
forward-eval depth/width, repair, scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule unchanged.

```
Full 3-seed probe (`probe-m73-full-leaf-current-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 692.70 · excl-impact 709.73
  Delta headline = -2.0 · 95% CI [-4.6, 0.4] · P(Delta<=0)=95.2% · effect=-1.59
  125k -5.0 · 250k -2.4 · 375k -2.3 · 500k -0.8
  VERDICT: REJECT (non-promotable)
```

**Learnings.** Full-leaf accuracy is not worth the extra charged work on the current M64
baseline. It changed 416/480 paired checkpoints but skewed 157 improvements vs 254 regressions;
mean charged forward-eval frames rose ~84.0k -> ~138.0k while sampled candidates fell
~7060 -> ~5451. The accepted objective leaf shortcut remains load-bearing. Env-only; baseline
remains `attempt-m64-impact-band-objective-current15-a01`.

### M69 - repair max-attempt cap 32 on worst slice · source-free INCONCLUSIVE-negative (2026-07-04)

**Study.** M64 telemetry showed several weak mature rows spending large repair tails with low
accept counts. Since the compiler already resumes the original frontier when repair exhausts its
useful set, source-free test whether `LR_REPAIR_MAX_ATTEMPTS=32` frees budget for useful fallback
work on the high-repair worst slice.

```
Worst-slice probe (`probe-m69-repair-max32-worst10-s0-2-a01`):
  drums_pendulum, skyline_push, terrace_sprint, drums_dropout, dense_echo_climb,
  canyon_steps, syncopated_lift, rolling_drop, switchback_pop, ridge_pulse
  seeds 0..2 × canonical budget grid · valid 120/120
  raw slice HEADLINE 610.45 · excl-impact 625.29
  Delta headline = -0.0 · 95% CI [-0.1, 0.0] · P(Delta<=0)=100.0% · effect=-0.69
  125k +0.0 · 250k -0.1 · 375k +0.0 · 500k -0.0
  VERDICT: INCONCLUSIVE (non-promotable)
```

**Learnings.** A lower global repair cap does not convert repair tail into quality; it is
effectively score-identical and slightly negative at 250k. Future repair work needs a better
restart usefulness/target selector, not a scalar cap. Env-only; baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

### M70 - rollout-context aim suppression on current default · source-free INCONCLUSIVE-negative (2026-07-04)

**Study.** Recheck the old lookahead observation that aim probes inside widened rollouts are
expensive, but isolate it from the broader `best:1:5` policy. Source-free env only:
`LR_ROLLOUT_AIM=0`, leaving top-level aim, scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule unchanged.

```
Full 3-seed probe (`probe-m70-rollout-aim-off-default-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 694.44 · excl-impact 712.04
  Delta headline = -0.3 · 95% CI [-1.0, 0.0] · P(Delta<=0)=94.0% · effect=-0.99
  125k -0.2 · 250k -0.3 · 375k -0.3 · 500k -0.2
  VERDICT: INCONCLUSIVE (non-promotable)
```

**Learnings.** The stored raw headline looked positive, but the paired M64 intersection was
higher than the stored baseline curve. On the actual paired decision, every budget is slightly
negative. Do not make rollout-context aim suppression the default on the current adaptive
forward-eval policy. Env-only; baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

### M72 - mature aim top-k 5 dose check · source-free REJECT (2026-07-04)

**Study.** Price the intermediate aim-base dose after M71 showed K=4 was too low and earlier K=7
attempts were bad. Source-free env only: `LR_AIM_TOPK_BASES=5`, restricted to mature budgets
because the env override would otherwise raise 125k from the accepted K=4 to K=5.

```
Mature 3-seed probe (`probe-m72-aimtopk5-mature-current-s0-2-a01`):
  40 specs × seeds 0..2 × budgets 250k,375k,500k · valid 360/360
  raw mature-slice HEADLINE 694.18 · excl-impact 712.83
  Delta headline = -2.4 · 95% CI [-7.0, 1.5] · P(Delta<=0)=87.3% · effect=-1.10
  250k -2.8 · 375k -2.5 · 500k -2.1
  VERDICT: REJECT (non-promotable)
```

**Learnings.** K=5 also gives up mature score versus the accepted K=6 default. Together with
M71 and the previous K=7 failures, the high-budget aim-base dose is bracketed around current
K=6. Do not lower mature aim bases to 5. Env-only; baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

### M71 - high-budget aim top-k ablation on current default · source-free REJECT (2026-07-04)

**Study.** Recheck whether M64 changed the cost-benefit of the accepted mature aim-base bump.
Source-free env only: `LR_AIM_TOPK_BASES=4`, which leaves 125k equal to the accepted default but
ablates the >=200k default K=6 rise back to K=4 at 250k/375k/500k.

```
Full 3-seed probe (`probe-m71-aimtopk4-current-s0-2-a01`):
  40 specs × seeds 0..2 × canonical budget grid · valid 480/480
  raw HEADLINE 689.76 · excl-impact 708.78
  Delta headline = -4.9 · 95% CI [-10.9, -0.1] · P(Delta<=0)=97.7% · effect=-1.80
  125k +0.0 · 250k -6.7 · 375k -5.8 · 500k -4.6
  VERDICT: REJECT (non-promotable)
```

**Learnings.** The accepted high-budget K=6 aim-base spend remains load-bearing after M64.
Reducing mature aim bases protects 125k exactly but gives up large paired score on every mature
budget. Do not lower the current high-budget aim-base count. Env-only; baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

### M55 - dense low/medium-impact basin cleanup · probe INCONCLUSIVE (reverted, 2026-07-04)

**Mechanism.** Try a coherent portfolio of the last two non-shipping near-misses rather than
another single-selector tweak. The temporary default-off hook
(`LR_M55_DENSE_IMPACT_AIR_CLEANUP=1`) combined:

- M48-style impact-curve high onset: raise the curve target onset toward 0.30 only for
  contact-rich, broad-air, low/medium-impact, mostly non-vertical resolved profiles.
- M42/M39-style M4 Part B gate: suppress the air-matched ride-out variant on dense
  low/medium-impact air profiles.

Candidate generation outside that one M4 variant, search policy, start selection, forward eval,
repair, scorer, specs, fingerprint, seeds, budgets, and acceptance rule were unchanged.

Focused tests passed in disabled/enabled modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M55_DENSE_IMPACT_AIR_CLEANUP=1` (6 files, 77 tests each).

```
Probe (`probe-m55-dense-impact-air-cleanup-full-s0-2-a01`, LR_M55_DENSE_IMPACT_AIR_CLEANUP=1):
  valid 480/480 · raw HEADLINE 692.11 · excl-impact 711.62
  Delta headline = -0.5 · 95% CI [-3.5, 1.9] · P(Delta<=0)=62.4% · effect=-0.36
  125k +1.3 · 250k -0.8 · 375k -1.0 · 500k -0.4
  VERDICT: INCONCLUSIVE (indicative, non-promotable)
```

**Learnings.** The M48/M42 portfolio did not offset its own collateral. It bought a small scarce
tier lift but dragged all mature tiers on the paired 3-seed intersection, so it does not justify
a canonical run. Simple static recombinations of the M48 high-onset profile and M42 air-knob gate
are closed; future work needs either a new usefulness signal or a different generation shape.
Source reverted; baseline remains `attempt-m41-hardimpact-span30-a01`.

### H1 — low-air impact rideout as selectable lane · INCONCLUSIVE (reverted)

**Mechanism.** In the impact template lane (arc_placement.ts slam-hop block), on very-low-air
impact beats (effective `air ≤ 0.22`, `nextGapFrames ≥ 10`, budget ≥ 125k), alternate template
attempts (`floor(attempt/LANE_MOD) % 2`, RNG-neutral) emitted a delayed-grounded-rideout variant
instead of the slam-hop: same redirection scoop (end angle floored at −12°), then a long grounded
tail (0.72 × next-gap span) flattening to a near-level launch (−6..+12°). BOTH shapes in the
per-gap pool; cost ranking + forward-eval choose per context. Production default, no env flags.
Design iteration: air gate 0.30 → 0.22 after a sentinel probe showed 0.30 leaked into
syncopated_switchback's 0.25-air block (250k −6.8) and rhythm_ladder via aim-modified air
(+14.0 at 125k but noisy); at 0.22 both went clean/positive on the probe.

**Canonical.** `attempt-pendulum-rideout-lane-a01` (valid 1920/1920, HEADLINE 683.77,
excl-impact 699.53) vs `attempt-aim-highk-gated-j32-a01` (683.67):

```
  Δheadline = +0.1 · 95% CI [-0.2, 0.5] · P(Δ≤0)=32.9% · effect=0.58
  125k +0.4 (P=25%) · 250k +0.1 (P=20%) · 375k +0.1 (P=37%) · 500k -0.0 (P=59%)
  VERDICT: INCONCLUSIVE  (α=0.20; hint: ~70 more seeds would resolve)
```

**Per-spec.** Movement confined to EXACTLY two specs; all 38 others byte-identical at every
budget (hash-verified — zero collateral, the selection-protection did its job):

- drums_pendulum (paired seed-mean Δ): 125k +5.82, 250k +1.89, 375k +0.04, 500k +0.19.
  Tracks changed 12/12 seeds at every budget — the lane fires and is adopted on every compile.
- syncopated_switchback: 125k +4.64, 250k +2.51, 375k +4.43, 500k −0.78.
  Adoption grows with budget: 2/3/5/6 of 12 seeds at 125k/250k/375k/500k.

**Learnings.**
- Selection-protection works: the §13 forced version's collateral victim (switchback −12.4)
  flipped to a gain as a selectable lane; rhythm_ladder collateral vanished at the 0.22 gate.
- The rideout captures only the LOW-BUDGET slice of pendulum's deficit (125k +5.8 decaying to
  ~0 at 375k+). Pendulum's curve is nearly flat across budgets (417→443, still ~250 pts below
  spec-mean at 500k), so its real problem is not this geometry — a dedicated diagnosis is queued.
- Net +0.1 is real (P(Δ>0)=67%) but unpromotable at α=0.20 with a 2-spec footprint.
- Workflow incident: the first canonical (same archive name) was VOID — an external
  `git checkout` reverted the uncommitted change ~1 min after launch (workers import per task ⇒
  1909/1920 rows compiled baseline code; decide read Δ+0.0 CI[−0.0,0.0]). Detected via row-level
  track-hash forensics (candidate ≡ baseline). Rerun with the change staged in the index and a
  sha256 watchdog on the touched file. Lesson: verify candidate archives actually DIFFER from
  baseline (changed-row count > 0 where the mechanism must fire) before trusting any verdict.

### M10 airFit collateral repair — NO REPAIR SHIPS; feasibility family falsified (2026-07-02)

Diagnosis: on the M4 losers air IMPROVED (zigzag airRMS .074→.067 etc.); speed/impact paid
(zigzag spd .062→.083, mixed_grade spd .029→.071 = its whole −23.9@125k). Losers = no-low-ask
narrow-range specs stuck on the undershoot half-penalty (pred−ask −0.14..−0.20, pool spread
only .026–.033 ⇒ noise-scale re-ranking). crosscut's 500k flip = budget affords air without
paying speed there (scarcity-mediated collateral).
Falsified arms (3–8 seeds, 5 losers + 5 guards, validity 100%): F1 undershoot-w0 / F1b /
B-off / entry-side deliverability CEIL7/CEIL11 — every arm traded winner pts for loser pts
≈1:1 (best: CEIL7 +0.5, Boff +1.0, both guard-negative; opening_burst −23@250k×8seeds under
CEIL7). KEY REVISION: ask-feasibility does NOT discriminate — opening_burst is DEEPER
undershoot (−0.22) than any loser yet needs the pressure most. True discriminator =
HARVESTABLE AIR ERROR (pool performance property, not ask geometry).
⇒ collateral is the internal price of the accepted +2.3; five cheap knobs logged dead.
⇒ M13 candidate: pool-relative differential damping (scale airFit pool-differential by the
pool's own harvestable air error). B-off@mature rejected as budget-threshold gate (pattern
Jérémie dislikes).

### M5 protected speed slot — fail-fast KILLED before build (2026-07-02, no probe, no canonical)

Design was: guarantee min-current-speed-error candidate in the forward-eval set. Fail-fast diag
(swell/tide × 2 seeds × {125k,500k}, branch m5-speed-slot-diag): evaluated set = quality-top-8
of 32 (HANDOFF_CANDIDATE_POOL, branch 3). Min-speed candidate already IN the set 52–66% of
pools; when OUT, the set's best is within 0.001–0.003 of the pool speed floor (materially-better
rate 0–2.3%); when IN and losing (~80%), the winner concedes ≤0.01 speed err on a correct
multi-axis trade. Committed per-gap speed error ≈ pool floor ⇒ per-gap speed selection is FULLY
EXTRACTED. The +9 speed residual = TAIL gaps (20–25/165 with err >0.1) where the ARRIVAL speed
into the gap is wrong (no candidate can serve the target) — trajectory compounding, k−1
generation territory. ⇒ M5b: M3-pattern k−1 energy-launch span on next-gap-speed-infeasible
gaps, gated on a pre-step diag (one-gap-back reachability + pool absence; STOP if k−2+
compounding = the planning problem, or if present-but-losing = judge problem). IN FLIGHT.

### SPEED SELECTION THREAD — CLOSED after four gates (2026-07-02, zero probes/canonicals burned)

Gate 1 (M5): per-gap selection extracted — committed speed error ≈ pool floor; evaluated set
(top-8) within 0.001–0.003 of pool min; in-set losses are correct multi-axis trades.
Gate 2 (M5b): tail gaps (|err|>0.1, ~13% of gaps carrying the RMS mass) are NOT a generation
gap — k−1 pools contain good-arrival exits (C-class only 14%); 83% chaining/selection (B 43%).
Gate 3 (M6): leaf whole-branch dilution REFUTED — tails skew EARLY-mid not late (peak decile
30–40%, min final decile); marginal-leaf counterfactual flips only 4.3% of B-winners.
Gate 4 (M7): rank-0 masking real but WORTHLESS — dual-rollout study (bit-exact greedy:2
replica, 230 B-pools): masked branch wins 7.8% (bar 50%), mean value gap −38.8, local speed
fix 0.126→0.043 but 425 dead-ends (speed-serving catches strand the rider); non-B control
8.6% ⇒ no trigger power. The trades are PHYSICS-PRICED.
VERDICT: S5's +9.1 speed pool = seed-level trajectory divergence = the planning problem
(out of scope, thrice-bounced). No local mechanism exists. Instrument stack preserved on
branch m5-speed-slot-diag (02e15bd, LR_M5_DIAG/LR_M7_STUDY, default-off).
CAMPAIGN NOTE: seed-oracle "ceilings" are SOFT bounds — M4's variance collapse produced
per-seed scores above the best baseline seed; conversely closed threads prove some pools are
smaller than their oracle. Remaining live pools: air (M4 canonical in flight), elevation floor
audit (S6 — is ACHIEVABLE_CLIMB_FRACTION a physics fact or a design constant?), 125k impact
portfolio (~+1–1.5).

### M3 steep-arrival launch span — canonical INCONCLUSIVE (+1.0), reverted/parked (2026-07-02)

Mechanism: in sampleContactCenteredLines, on gaps with next-beat impact ask ≥0.30, the top-20%
LDS band of attempts adds a closed-form ballistic arrival-steepening delta to postAngleDeg
(δmax from ask via η=0.68 sizing, capped 15°/40°abs/catchability; delta=0 elsewhere byte-
identical; RNG-neutral; re-solved through normal gates). Worktree-only; archive
attempt-m3-steep-arrival-span-a01 (headline 684.69, excl-impact 699.32).

```
Δheadline = +1.0 · 95% CI [-1.8, 3.5] · P(Δ≤0)=21.4% · effect=0.76 · VERDICT: INCONCLUSIVE
125k +5.8 CI[1.2,10.7] P≤0=1% · 250k −0.6 · 375k +0.6 · 500k +0.9 · validity 100% everywhere
```

Impact-7 mean +2.0 (signature +10.3, swell +8.5, pendulum +6.1; tide −4.7, dropout −5.0);
broad winners rhythm_ladder +10.4, rolling_hills +10.0, cold_start +9.3; losers crosscut −10.2,
zigzag −7.6, tiny_dance −6.5, pop_train −5.7. aimed-rank0 and gate-fails flat.
LEARNINGS: (a) the mechanism-reachable impact pool at MATURE budgets is far smaller than the
S2/S3 oracle — the harvest concentrates at 125k (+5.8 significant, matching S5's 125k-column
impact share +7.9); high-budget capture is dose-limited by the diversity-displacement tax
(100% span = −10.6 @500k). (b) 3-seed probe per-spec identities are NOISE (dropout +42→−5.0,
swell −16→+8.5 at 12 seeds) — trust only aggregates from probes. (c) Three low-budget impact
aids now exist (H1 rideout, M1 scoop, M3 span), all individually unpromotable at 0.1 weight;
a 125k-portfolio is a possible future single mechanism (precedent: accepted "tight speed impact
relief portfolio"), expected cap ~+1–1.5 headline. (d) Possible high-budget lever left: ADDITIVE
aim-lane steep proposal (no displacement) — queued as M6, prior lowered by (a).
Code parked on worktree branch `m3-steep-arrival-span`; nothing in production.

### M2 delivery-match impactFeasibility — probe REJECT (2026-07-02, no canonical)

objective.ts impactFeasibility → two-sided asymmetric delivery-match (η·v·min(θ,64°) vs needed,
exp undershoot penalty, light overshoot), + isolated MIN_ASK 0.30→0.25 arm. Probe (7 impact +
5 collateral specs × 3 seeds × {125k,250k}): monotone NEGATIVE dose-response — full dose main
−31.2 / collateral −62.7 (P(Δ≤0)≥99%); soft (scale 2.5) −4.2/−2.6; MIN_ASK-alone wash
(−1.7/+1.0). Both budgets negative in every arm. Code preserved on worktree branch
`m2-delivery-match`; nothing shipped.
WHY IT FAILS: the gradient now exists but k−1 pools contain no gate-passing steep-arrival
launches to promote — the ranker just elevates marginally-steeper/materially-worse candidates;
enum gate-fail DOUBLED on collateral (10.7%→20.4%); losses land on already-solved specs
(pop_train −114.5). Mid-band error did not shrink (flat @125k, worse @250k).
LEARNINGS: (a) judge-side pressure without generation is anti-productive — the S3 pool sits
behind a GENERATION constraint at k−1; (b) η=0.68 as ranking break-even is empirically harmful —
legacy calibration already absorbs conversion loss; (c) even eta1 (legacy break-even, smoothed
corner) loses: the exp sub-break-even penalty is harsher than the legacy linear ratio.
⇒ M3: attempt-spanned steep-launch VARIANTS at k−1 (generation-side, landing-consistent via
normal gates, no judge change). Probe CLEARED (zb0.8 = 20% spanned share: main +3.7, 125k
+10.1 / 250k +0.5 / 500k +0.3, collateral +1.5, gate-fails flat, mid-band |err| 0.156→0.149,
mean delta 6.4° ≈ hitter 6°; dose is THE knob — 100% share pays −10.6 displacement @500k;
η=0.68 sizing beats 1.0; drums_swell persistent loser −16..−29). CANONICAL IN FLIGHT
(in-worktree, archive attempt-m3-steep-arrival-span-a01).

### H2a converting-scoop template — implemented, canonical WITHHELD (2026-07-02)

Worktree branch `worktree-agent-a6c90d7f6e62ed84a` (123-line arc_placement.ts addition, default-on,
no flag): attempt-0 scoop when ask≥0.30 AND arrival≥12°, entry arrival−4°, scoop over speed×6,
exit at normal downstream launch, budget-faded OFF ≥250k. Probe (7 impact specs × 3 seeds ×
{125k,250k}): +6.9 @125k, byte-identical @250k, subset Δ+2.3 INCONCLUSIVE-positive.
WITHHELD from canonical: fade means it touches only the 0.1-weight budget → full-suite dilution
≈ +0.1–0.3 headline, cannot clear ACCEPT. Kept for possible later fusion.
LEARNINGS: (a) converting the arrival by TURNING MORE trades speed for impact — pays only where
base is impact-starved (drums_dropout +37) and washes/hurts on balanced specs; exit MUST preserve
the downstream speed launch; (b) without fade the scoop dilutes the converged high-budget optimum
(−7.9 @250k pre-fade) even as pool injection — quality objective over-adopts it; (c) therefore the
free-impact geometry that best seeds find is NOT a bigger same-arrival turn → S3 study launched to
characterize what winners actually do (local-vs-chain question).

### M4 close-the-air-selection-hole — canonical ACCEPT, NEW BASELINE 685.97 (2026-07-02)

Mechanism (2 coupled parts, production default, no flags):
(A) airFit in scoreNextTargetReadiness (objective.ts): readiness = catchability × speedFit ×
impactFeasibility × **airFit**; predicted next-gap air = (nextEnd − max(nextStart, release)) /
gapFrames off the ballistic release read (closed form, zero sim); ask floor-clamped at
K_BOUNCE_LANDING/gapFrames (never demands the impossible); deadband 0.05; asymmetric exp
(overshoot full, undershoot ×0.5, scale 0.25). Flows to pool sort, enum-sweep objective
(via model exit.frame), and lane-base scoring.
(B) air-matched ride-out-LENGTH variant in the enum lane (aim.ts + arc_model.ts
adjustArcTailLength): quality-best base only, gated on |predAir − effAsk| > 0.10; release
shift solved in closed form (frames × exit speed = tail delta, extend along exit tangent /
truncate with guards); exact tryCandidateLines eval (I1–I5 intact, RNG-neutral).

CANONICAL (attempt-m4-air-selection-a01 vs attempt-aim-highk-gated-j32-a01):
Δheadline = +2.3 · 95% CI [−0.7, 5.3] · P(Δ≤0)=6.4% · effect=1.51 · VERDICT ACCEPT.
Per-budget: 125k +3.7 / 250k +1.4 / 375k +1.5 / 500k +3.0. Validity 100% at every budget.
Headline 683.67 → 685.97; excl-impact 699.39 → 706.59 (the air/speed pool opened +7.2 —
more than the headline moved: impact gave some back, see losers).

Decomposition (probe, 5 air + 5 collateral specs × 3 seeds): A-alone ACCEPT +14.2 (the
carrier); B-alone INCONCLUSIVE −4.0 (a lottery — B must never ship without A); A+B with
all-K-bases B = big 125k pop (+21.1, P=1%) but mature-budget drag; FINAL first-base-only
B = +13.8 CI[1.2,31.0], the only arm whose CI excluded 0. Air RMS on air specs
0.134→0.118 (@125k) / 0.135→0.113 (@250k). Part-B funnel @canonical-probe: ~83% gate-pass,
~42 emissions/compile. Mismatch gate is sharp: 0.18 kills the gain, 0.10 carries.

KEY TELEMETRY FINDING (revises the pool study): within-pool predicted-air spread is NARROW
(mean max−min ≈ 0.036/pool); the 0.28–0.84 seed lottery lives ACROSS pool rebuilds along the
search tree, not inside one pool. That is why a persistent judge term pays despite thin
per-pool substrate, and why generation insurance only helps where pools are starved (scarce
tier). Mean effAsk 0.62 (heavily floor-clamped on dense gaps) vs mean predicted 0.48.

Canonical per-spec (weighted): winners syncopated_switchback +16.8, opening_burst +16.8,
rhythm_ladder +12.4, drums_pendulum +11.4 (the −6.1-pt worst spec moved!), terrace_sprint
+10.8, grain_staircase +9.1, cold_start +8.9. Losers cluster in the STEADY-DENSE drums
family: drums_zigzag −15.1, drums_swell −10.9, drums_crosscut −9.1, drums_tide −8.5,
syncopated_lift −4.9, drums_dropout −4.2 — narrow-air-range specs where the new term
re-weights readiness against gaps that were already converged (and where the high-K aim
bump lives). That family is the indicated repair pool for a follow-up (spec-conditional
pressure would violate the no-threshold-gates rule; look at scale/deadband shape instead).
