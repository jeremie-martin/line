# Geometry campaign — attempt log

Terse audit trail for the geometry campaign (scope: `docs/geometry-campaign.md`; prompt:
`docs/geometry-prompt.md`).

**Discipline (read once).**
- One entry per attempt or study. Format: **setup · what I did · result · verdict.**
- **Facts only. Never explain a result by a presumed mechanism we have not measured.**
  Write "rotate-span widen paid −1.2 on the board, gate-fails +18%" — not "it lost
  *because* the rider over-rotates." A measured cause is a fact and may be stated; an
  assumed one may not.
- Numbers come from real runs only — all from `./scripts/v0/eval_geometry.sh`
  (12 specs x {150k,300k} x 9 seeds, frozen baseline). The board is the campaign's
  decision instrument; there is no separate canonical gate.
- Studies / telemetry / statistics get entries too: this campaign gathers empirical
  data, it does not try random changes until one sticks. A study entry records what was
  measured and the numbers, not a conclusion beyond them.
- ACCEPT → commit, then `rebuild` the board baseline so it tracks the new HEAD. REJECT →
  revert code, keep the log entry + any scripts.

---

## 0. Baseline at campaign start

Setup: `scripts/v0/eval_geometry.sh` frozen-snapshot, board = 12 specs x {150k,300k} x 9
seeds, `LR_ENGINE=wasm LR_FWD_EVAL=greedy:2`, current committed default geometry
(`arc-rewrite` HEAD `07e220d`). Frozen baseline `baseline-b024ac55cf25`.

```
BOARD HEADLINE (probe tier)   611.24    validity 216/216
  150k  609.8
  300k  619.8
```

This is the board's frozen reference for every geometry edit; the script REUSES it
until specs/budgets/seeds change. North star: board headline up; the board is the
decision instrument (no separate canonical gate).

(Reproduction check: current HEAD vs frozen baseline = Δ+0.0, byte-identical — the
baseline arm reproduces deterministically. Working baseline headline = 611.6.)

---

## 1. STUDY — where the headroom is (per-axis error decomposition)

Setup: parsed the frozen-baseline candidate archive (golden.json + per-gap
report.json), pooled per-axis errors per spec. Score for a passing run ≈
1000·exp(−RMS(axis_err)/0.25); headline 611.6 ⇒ RMS≈0.123; 700 needs RMS≈0.089.

Findings (facts):
- **Impact is the dominant error axis on 11/12 specs** (impact RMS 0.10–0.20).
  Counterfactual (zero the impact error, hold all else): mean spec score jumps to
  ≈700 (climb_terrace 604→718, dense_sprint 577→701, summit_push 593→705,
  solo_run 625→726, drums_crescendo 618→721). Impact is the headline prize.
- **Impact undershoots universally** (achieved−target = −0.06…−0.18 every spec).
- **0% of impact gaps are physics-infeasible** (target>ceiling = 0% everywhere;
  ceilings ≈0.95–1.0). The whole impact shortfall is geometry/selection, not physics.
- Secondary undershoot: **elevation** on every spec that targets it (−0.02…−0.20;
  skyline_push −0.20, summit_push/climb_terrace/terrace_sprint −0.11…−0.13).
- air slightly OVERshoots (+0.03…+0.08); speed/amplitude ≈neutral.

## 2. STUDY — pool-limited vs selection-limited on impact (GEOM_POOL_TELEM)

Setup: added default-off telemetry (node.ts `recordPoolImpactTelem`, env
GEOM_POOL_TELEM=<path>) appending per impact-gap pool: target, sel(=sorted[0])
impact, pool-MAX impact, costs, per-axis errors of each. Ran 5 impact specs
(drums_pendulum/crescendo, solo_run, terrace_sprint, summit_push) seed0 @150k.

Result (real selection pools, poolN≥8, n=477):
- mean target impact 0.482 · **selected (pool winner) 0.333** · **pool-MAX 0.458**.
- The pool reaches the impact target on 40% of gaps; pool-MAX impact (0.458) is
  near target while the selected (0.333) undershoots by 0.149.
- The max-impact candidate costs the SAME (Δcost −0.01) and has the SAME speed
  error (0.064) as the selected, only slightly worse air (0.139 vs 0.129).
Verdict: **selection-limited, not pool-limited** — high-impact catches exist in the
pool at equal cost; the quality sort (`currentQuality×readiness`) + forward-eval
pick lower-impact ones. The readiness/downstream proxy downranks them.

## 3. STUDY — local-cost impact weight is vestigial at board budgets

Setup: swept LR_IMPACT_LOCAL_W ∈ {0.5,0.75,1.0} over 6 specs ×2 seeds @150k (run.ts).
Result: scores IDENTICAL across weights (1.0 was −16 on one drums_crescendo seed).
Verdict: `axisCost`'s impact weight (0.5) does not drive selection — the quality
sort uses the scorer's `axisQualityForTargets` (impact=1.0) and the ≥75k forward-eval
scores the TRUE score. The 0.5 weight only tiebreaks the pre-sort. Not a lever.

## 4. STUDY — post-contact curvature authority near optimum

Setup: swept IMPACT_CURVE_FLATTEN_DEG / FRONTLOAD (temp env LR_IMP_FLATTEN/FRONTLOAD)
over 4 specs ×2 seeds @150k. Result (mean): 12/1.2=548.1 · 12/2.4=551.9 · 20/1.2=550.9
· 18/2.0=548.0 · 8/0.8=545.6. All within ±4 (noisy n=8). Curvature is near its local
peak; not the impact limiter (the redirection is bounded by arrival steepness, not
post-contact curve). Reverted to 12/1.2.

## 5. REJECT — impact-arrival pop-arc at ALL budgets (remove the >100k fade)

Setup: the steep pop-arc arrival toward the next impact beat (sampleContactCenteredLines,
`gap.nextImpact` block) is faded off >100k; board runs at 150k/300k where it is OFF.
Single-seed study (6 specs ×3 seeds @300k) showed +4.0 mean → made it the production
default (budgetFade removed) and ran the board.
Result: **Δheadline −1.7** (150k −1.3, 300k −2.0; CI[−5.6,3.4], P(Δ≤0)=81%). Mixed:
terrace_sprint +7.7/+6.3, summit_push +1.7/+5.6 (elevation-pressured win) BUT
soar_settle −9.4/−10.7, swoop_dive −7.9/−4.9, skyline_push −6.3/−2.9 (amplitude/dive
lose — the steeper launch fights their air/amplitude arc). The mechanism biases ALL
candidates at a gap (not just adds them), so it dilutes amplitude/air shaping.
Verdict: REJECT, reverted. Lesson: study set must include amplitude/dive specs.

## 6. STUDY — elevation undershoots because the grounded ride-out eats the climb gap

Setup: per-gap elevation feasibility from the frozen archive + the launch model
(types.ts elevationToLaunchVy / netDyToElevation). On the 5 elevation specs:
mean target 0.55, **achieved 0.43 (net DESCENT)**, ceiling ~0.65; only 0–5% of gaps
physics-infeasible; feasible shortfall 0.06–0.19/gap (skyline_push worst). Code trace:
the elevation block sets a steep launch ANGLE but — unlike the amplitude block — does
NOT shorten the grounded ride-out, so the rider rides flat then launches with little
airborne time left ⇒ no net climb. Hypothesis: shorten the climb ride-out.

## 7. ACCEPT — elevation ride-out shortening on climb gaps → +1.4 headline (NEW BASELINE)

Setup: `sampleContactCenteredLines`, after postLength is finalized — for an upward ask
(`targets.elevation > 0.5`) lerp postLength toward the airborne minimum (28) by
`attempt-blend × climbP × ELEVATION_RIDEOUT_SHORTEN(=1.0)`, so the climb arc has the
gap to express. Gated to DEFER when a meaningful amplitude pop is also asked
(`amplitude ≥ 0.30`, the amplitude block's own pressure threshold) — that ask needs the
airborne time the shortening would steal.
- v1 (ungated): board Δ+0.2 — terrace_sprint +9/+11, summit +2, BUT skyline_push
  −11/−12 (its 0.35 amplitude ask collapses when the ride-out is stolen). Net wash.
- v2 (amplitude-gated, SHIPPED): board **Δheadline +1.4** (150k +1.6, 300k +1.0;
  CI[−0.5,5.6], P(Δ≤0)=13%, effect 0.87). terrace_sprint **+11.4/+9.7**, summit_push
  +1.6/+2.4, skyline_push −1.3/+1.4 (regression fixed), climb_terrace/swoop_dive noise.
  All 7 non-elevation specs byte-identical (+0.0) — gate is clean.
Verdict: ACCEPT. Headline 611.6 → 612.9. Committed; baseline rebuilt to new HEAD.
(Also landed: default-off pool-impact telemetry node.ts `recordPoolImpactTelem`,
GEOM_POOL_TELEM=<path>, used by studies 2 above — no-op in production.)

## 8. STUDY+REJECT — soften the impact-gap readiness multiplier (selection slack test)

Setup: the pool quality sort ranks `currentQuality(scorer)×readiness`; the forward-eval
rolls out the top-8 of that order. Hypothesis from study 2: high-impact catches are
buried below rank 8 by the readiness multiplier. Test: on impact-targeted gaps replace
the multiplier with `readiness^soft` (soft<1 surfaces high-currentQuality/impact
catches). Aim.ts `candidateQualityObjective`, study env LR_IMPACT_READY_SOFT.
- run.ts study (6 specs ×3 seeds @300k): the slack IS real — soft=0.5 moved
  big_air_ramp +12, dense_sprint +7, drums_pendulum +12, BUT solo_run −17,
  swoop_dive −12. Net +2 with high variance.
- board (soft=0.5, full 12×9): **Δheadline −0.6** (150k +0.8, 300k −1.6). Helps at
  scarce budget (big_air_ramp +10@150k, drums_pendulum +5, skyline +4) but regresses
  converged 300k (pop_train −11.7, drums_crescendo −6, summit −3). The 2× weight on
  300k makes it net-negative.
Verdict: REJECT, reverted. CONCLUSION: the impact undershoot is mostly NOT pre-sort
slack — the readiness term is doing real downstream work; surfacing impact catches
trades 150k completion for 300k quality and washes. Impact is bound by real multi-gap
coupling, not a fixable selection bug.

## 9. STUDY — drums_pendulum is POOL-limited (the generalized pool-frontier instrument)

Setup (reframing credit: Jérémie — the 1M-budget invariance of drums_pendulum ≈465 is
the signature of a GEOMETRY/pool limit, not a search/budget one; the campaign's target,
not a wall). Generalized node.ts `recordPoolImpactTelem` → per gap, per targeted axis:
target, SELECTED value, pool-BEST (closest to target), pool [min,max] RANGE. Ran
drums_pendulum ×3 seeds @300k.

Result (real pools, poolN≥8):
- AIR  low gaps  target 0.16 · selected 0.47 · pool-BEST 0.45 · pool RANGE [0.45,0.51]
- AIR  high gaps target 0.83 · selected 0.70 · pool-BEST 0.71 · pool RANGE [0.64,0.71]
- SPEED          target 0.54 · pool RANGE [0.58,0.58]  (ZERO diversity — energy launch pins it)
The pool's reachable air band is ~[0.45,0.71]; the targets span [0.15,0.83]. The
generator literally cannot OFFER a grounded (low-air) or high-pop catch on these gaps —
**pool-limited, not selection- or budget-limited.** That is why budget doesn't move it.

## 10. STUDY — the achievable air range is bounded by the contact-landing mechanism

drums gaps are ~19 frames. Two boundaries:
- LOW-air FLOOR = minimum detectable bounce / N. A catch must register as a
  bounce-landing (~5 frames aloft) ⇒ air ≥ ~5/19 ≈ 0.26. Target 0.15 is BELOW the floor.
- HIGH-air CEILING (measured: achieved-air vs gap length N over all specs): for short
  gaps achieved ≈ (N−6)/N (per-contact grounded OVERHEAD ~6 frames), for long gaps it
  falls below (launch-height limited). At N=19 ⇒ ceiling ≈ 0.68–0.71. Target 0.85 is ABOVE it.
So the achievable air range at 19-frame beat density is ≈[0.26,0.71]; the spec asks
[0.15,0.85]. High-air gaps already sit AT the ceiling (achieved 0.71); low-air gaps have
~0.17 of theoretical headroom (0.43→0.26) but it is gated by landing robustness (#11).

## 11. REJECT ×2 — naive pool-widening on drums (both board-confirmed)

- Gap-length-aware grounding cap (`safeCap`=1−minBounce/N, minBounce=6): a 6-seed study
  showed drums_crescendo +14; the **9-seed board REVERSED it to −16.6** (Δheadline −1.8).
  Deeper grounding → short bounces that trip landing gates (off-beat/drift) catastrophically
  on unlucky seeds. The 0.45 pool floor is the RELIABLE-landing floor for straight-line
  geometry, not an arbitrary cap. LESSON: drums specs are pathologically seed-variant
  (±20+); few-seed studies are worthless there — board (9 seeds) only.
- High-air launch steepening (mirror of the elevation fix; continuous ramp above air
  0.60): board **Δheadline −2.9 REJECT**. Did NOT help drums (high-air is OVERHEAD-limited
  at N=19, not launch-limited) and broadly hurt specs with no headroom (dense_sprint −15.6,
  pop_train −9.3, big_air_ramp −8.0 — steeper launch overshot their already-on-target air
  and bled next-gap speed). "Continuous/general" still disrupts specs that have no headroom.

CONCLUSION (drums): genuinely pool/geometry-limited (Jérémie's reframing holds), but the
achievable air range is tightly walled by the contact-landing mechanism. High-air is
maxed; low-air's ~0.17 theoretical headroom is mostly blocked by landing robustness — the
ROBUST reducible headroom is small with straight-line geometry. Cracking more would need a
precise low-air landing construction (deterministic bounce timing) that lands reliably
across seeds — a real, project-scale effort with modest expected payoff (~+3 headline).

## 12. STUDY+REJECT — off-tangent "slam" landing (Jérémie's idea): a real lever, but on AIR not impact

Setup: hypothesis (Jérémie) — land the rider OFF-tangent (flatten the landing segment
below the arrival heading) so it hits the surface at an angle; the engine kills a big
normal component ⇒ a large velocity REDIRECTION at the landing frame, which IS in the
scored metric (`redirImpactPxAtLanding` = peak |v⊥incoming-heading| over the 6-frame
window; the engine smears the collision over frames). Added `LR_IMPACT_SLAM` (flatten the
entry bevel by N°×pressure). Confirmed the metric mechanism is real.

Findings:
- **Impact axis does NOT move** (drums |err| 0.16→0.15, flat) — the engine absorbs/smears
  the slam's contribution; achieved impact stays. So the lever does not raise impact.
- It DOES reduce the **airborne fraction** (the flatter landing keeps the rider grounded a
  touch longer around the contact): drums_pendulum air 0.22→0.19. So it pays on LOW-air
  asks (which overshoot air — drums' biggest error) and hurts air-WANTING gaps.
- v1 (gated on impact pressure): board **Δ−3.1** — drums_pendulum +13.7/+3.8 BUT
  soar_settle −17.7/−24.3, pop_train −6, dense −5 (air-wanting specs wrecked).
- v2 (re-gated on LOW air, `(0.40−air)/0.25`): cleanly protected every air-wanting spec
  (all byte-identical) and helped both dense guards (dense_sprint +0.8/+3.2, solo_run
  +1.3/+0.8). BUT board **Δ−0.8**: drums REVERSED again — drums_crescendo −11.3/−5.2,
  drums_pendulum −0.6/−2.1 — vs a 4-seed study that showed +11.9/+4.7. The recurring
  drums seed-variance trap; the slam reduces drums air on lucky seeds and degrades other
  axes on unlucky ones (9/9 valid throughout — it's axis quality, not deaths).
Verdict: REJECT, reverted. The off-tangent landing is a GENUINE lever (credit: Jérémie)
and a clean robustness win on the dense guards, but it routes through air, not impact, and
the drums air prize stays walled — every robust attempt to cut drums' low-air overshoot
(grounding cap #11, slam #12) helps on some seeds and degrades on others. Open: a gentler
slam gated to moderate-low-air (dense/solo) while skipping drums-extreme-low could bank
the guard gain, but the EV is small and drums-variance makes it hard to tune.

## State after these runs

Headline 612.9 (one accepted win: elevation ride-out shortening, #7). Studies show the
geometry-capped specs sit near a multi-axis Pareto frontier: impact (study 2/8), air
(#5 air-bias REJECT; grounded-cap washes), and elevation (climb bleeds speed, ceiling
~0.65) all trade against neighbours rather than add. air OVERSHOOT correlates NEGATIVELY
with impact (−0.36) yet forcing air down still regresses — the overshoot is part of the
optimum. Remaining clean levers look localized (per-spec axis biases), not headline-sized.
