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
  upside) — QUEUED
- H2b impact template turn-cap raise (22°→~38): DEPRIORITIZED by S2 — mid band (asks .30–.60,
  needs ~17° ≤ cap) carries 58.6% of impact energy; high band only 18.4%. Cap binds only the
  high band; revisit after H2a/H2c.
- H3 air floor on dense beats (candidate: dense-gap-only shorter ride-outs via ARC_LEN LO,
  air-pressure-gated — uniform widening previously REJECTED −13) — not started
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
