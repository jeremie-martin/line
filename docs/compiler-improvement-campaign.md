# Compiler Improvement Campaign

Target: improve the Benchmark V2 headline through changes that make the normal
compiler more capable and accurate across a broad range of authored scores.
`npm run benchmark -- eval` is the reusable screen; only a fresh certified
`eval --to-verdict` can promote a source-default change. The active baseline
contract is `accept-2026-07-16T02-42-52Z-5fcbfc73` (development headline 503.86;
headline levels are epoch-relative — the certified estimand is the paired
delta of each accept).

This is a decision log, not a research notebook. Detailed earlier material is
preserved in [the 2026-07-12--14 campaign archive](archive/compiler-improvement-campaign-2026-07-12-to-14.md)
and [trajectory synthesis record](compiler-trajectory-synthesis.md).

## Operating Rule

Each active item is a production hypothesis, not an open-ended study. It must
name:

1. the normal compiler boundary it changes;
2. continuous physical/authored inputs only, with no case identity or duration
   category;
3. the expected cross-regime effect;
4. a bounded scope panel and an explicit discard condition.

The scope panel precedes Benchmark V2: dense, dense-240, pickup, 5s low-air,
one representative score, and one development-music score at the V2 jolt and
500k. A candidate with coherent losses on this panel does not proceed to stage
0 merely because it rescues one row. Exact output similarity is diagnostic:
high similarity is acceptable, but a gain concentrated solely in formerly
invalid capability rows is recorded as a repair, not as a general architecture
improvement.

## Operating Lessons

- Large, durable gains come from changing the normal candidate space or
  traversal basis, not from a rescue path keyed to a failing case. Formulate a
  hypothesis in continuous physical and authored inputs, then keep normal
  candidates in the pool so the exact evaluator and ranker decide.
- Separate proposal from judgment. Predictors and local models may spend the
  budget to select candidates, but only engine-measured survival, contact, and
  axis quality may select a committed track.
- Use the funnel deliberately: a small cross-regime scope panel for coherent
  direction, Stage 0 for triage, and one fresh certified epoch for promotion.
  Probe ablations explain attribution; shared seeds cannot choose a winner.
- A promoted change must be read by stratum, not only by headline. Capability
  recovery is valuable, but representative/legacy quality and independent
  monitoring must remain visible. Unresolved monitoring movement is not an
  improvement claim.
- Keep research disposable. Every study must answer a concrete next design
  question and end in a concise retain, revise, or retire decision.

## Current Evidence

- Recovery of invalid capability rows is worthwhile but insufficient by itself:
  the failure atlas projected roughly `509--511` even if all current invalid
  cells were replaced by valid outcomes. Reaching the campaign target also
  requires better quality on already-valid rows.
- **Impact is the dominant valid-row quality pool.** Counterfactually rescoring
  the accepted-baseline canonical archive with the exact headline chain:
  impact RMS ×0.8 → `+41.2`, ×0.7 → `+61.6` (crosses 550); amplitude ×0.7 is
  only `+4.4`. The undershoot is universal (92% of contacts, mean −0.15 at ask
  0.3 rising to −0.38 at 1.0), worst on short (0.3–0.6 s) and low-authored-air
  gaps, and **flat across budgets** (pooled impact RMS 0.242/0.245/0.243 at
  250k/500k/750k) — more compute buys validity and air/speed, never impact.
- **The candidate pools already contain accurate-impact geometry at asks
  ≥0.4 — and the exact evaluator is right to reject it.** A 500k pool probe
  (1,998 impact-targeted pool visits, five sources) found a candidate within
  0.05 of the ask at ~70% of visits (asks 0.4–0.9) sitting at quality rank ~25
  of 32: measured current-gap quality ×1.475 better than the admitted head,
  release speed only ~8% lower, but readiness ×0.041 (speedFit ×0.26,
  impactFeasibility ×0.39). Forcing these candidates in (see the three retired
  probes below) collapses speed RMS serially and kills dense validity — the
  scoop-based impact geometry the sampler produces buys current impact by
  bleeding carried speed, and the search equilibrium correctly refuses it.
  At ask ≈0.3 (the largest single mass) the pool does not even contain the
  geometry: every carrier lever is ask-ramp-gated to ≈zero pressure there.
- Extra support time, local selector changes, wider sampling, and terminal
  continuation repairs are not a general dense solution. They may alter local
  availability, but they do not create a durable earlier trajectory basin.
- The normal contact-centred sampler remains the shared primary source. The
  next source must improve its transition basis rather than add another
  failure-only rescue lane.

## Retired: Three Impact-Selection/Sizing Probes (2026-07-15)

One diagnosis (above), three falsified interventions, each on the fixed
V2-jolt/500k two-seed scope panel (10 sources: dense, dense-240, pickup,
5s low-air, five representative, Believer; `scripts/v0/study_impact_scope_panel.ts`,
~2 min per arm at 48 cores):

1. **Local-cost impact weight** (`LR_IMPACT_LOCAL_W` 2.0 / 0): 2.0 is
   byte-identical on 18/20 rows (the quality re-sort and forward-eval fully
   determine selection at 500k); 0 perturbs bytes but moves impact RMS <0.01.
   The weight is dead as a lever — matches the earlier certified-inert result.
2. **Global readiness softening** (`LR_M75_OBJECTIVE_READINESS_POWER=0.5`):
   impact RMS flat (0.289→0.288), two dense validity kills, mean −39.0/row.
   The readiness sharpness is load-bearing for survival chains; softening the
   prior globally frees nothing the forward evaluator then accepts.
3. **Measured-quality admission reserve** (2 of 8 pool slots by scorer-window
   current quality; source edit, reverted): impact RMS flat (0.289→0.289), two
   dense validity kills, mean −43.6/row; adopted reserves exploded speed RMS
   (e.g. split_signal 0.130→0.258). The exact 2-contact forward evaluation
   confirms the readiness veto: with the current geometry basis these
   candidates are genuine poison pills, not selection victims.

Also retired at the same scope: **error-driven carrier sizing v1** (replacing
the impact-curve ask-ramp with a missing-turn share, unconditionally): mean
−41.6/row, dense validity kills, ask-0.3 undershoot unmoved. Unconditional
sizing removed the unscooped shapes from every pool — the ask-ramp had been
(accidentally) the pool-diversity guard. Any sized-scoop successor must be
attempt-spanned so attempt 0 stays default.

**Decision.** The impact deficit is a candidate-geometry problem, not a
selection problem. The open lever is geometry that buys redirection without
bleeding carried speed — steep ballistic arrivals into the beat (fall energy →
redirection AND exit speed) rather than deeper supported scoops. The
arrival-shaping levers are exactly the ones currently suppressed at mature
budgets (pop-arrival budget-faded off ≥100k; steep-arrival span at 20% of
attempts, 15° cap).

Two follow-up probes on the same panel also fell:

5. **Widened steep-arrival span** (cap 15→28°, zero-band 0.8→0.5, hard-impact
   0.7→0.5): mean −24.5/row, impact RMS flat (0.289→0.290), broad air
   collateral — steep launches were selected (air moved) but landed on
   ask-ramp-gated near-tangent catches, so the turn fell outside the 6-frame
   window. Reproduces the V1 "arrival unfade" negative.
6. **Sized carrier × widened steep-arrival composed**: mean −11.8/row, impact
   RMS 0.289→0.295. Even jointly, blunt sampler pressure does not create
   selected dive-scoop pairs.

Across all five probes the one consistent gainer is Believer (impact-led,
asks 0.6–1.0, +19…+50 per arm): where the carrier already runs at full
pressure, extra arrival steepness composes and pays; representative rows pay
collateral instead. `docs/IMPACT_PAIR_PLANNING.md` (2026-06-10) reached the
identical diagnosis at V1 (funnel: 56% not-generated, 32% ranking-loses-and-
the-ranker-is-right; "turn without steep arrival does not convert"; the
closed greedy:2 loop) and its resolution was the AIMING-LAYER dive-scoop pair
(model-driven joint knob selection, +5.4, default-on) — not sampler
constants. The V2 baseline selects aim-lane candidates on 68/88 gaps yet
undershoots universally, so the open question is the aim lane's impact
coverage and model accuracy, not more pressure.

## Active: Arrival-Harvest Impact Pair (2026-07-15/16)

**Hypothesis.** The dive-scoop pair is representable but invisible end to end
(V1 funnel; five fresh V2 falsifications above): steep launches lose
forward-eval because no converting catch exists downstream, and commanded
catch turn does not convert without arrival steepness. Completing the pair in
the normal candidate space — (a) a second, arrival-conditioned eligibility
path for the existing SLAM-HOP template (fires when the measured incoming
velocity is ≥8° steep into an authored ask ≥0.12, at early attempts so
branch-1 rollouts see it) and (b) more steep-launch attempts on
hard-impact specs (zero-band 0.7→0.5) — should let the unchanged evaluator
and ranker adopt dive-harvest pairs. Boundary: sampler geometry only;
continuous inputs (arrival angle, ask, speed, budget); no case identity.

**Scope panel** (V2-jolt/500k, two seeds, 10 sources): composed form mean
`+2.6`/row with no validity losses; dense `+13.8/+19.0` with impact AND air
AND speed all improved; believer `+33.0/+48.7`; pickup `+31.6`. Probe bug
caught and fixed: every panel source has max ask ≥0.68, so the operative
zero band is the HARD_IMPACT one; the first "composition" arm was
bit-identical to template-only.

**Stage 0 rounds** (reusable screen, ~1 min each):

| Variant | Headline delta | Validity | Notes |
|---|---:|---:|---|
| composed-v1 (bands 0.5/0.6, gates 8°/0.12) | +8.32 | +4/−3 | dense_recovery +318 (invalid cell recovered); low-air ladder +28..+43 at 250k; 500k rep +3.1; costs: 250k rep −9.0, 250k dev-music −12 |
| tightened gates (10°/0.22) | −4.15 | +2/−5 | dense-240 −233: the low-ask arrival firings ARE the dense recovery |
| template-only (default bands) | +4.65 | +3/−5 | pickup_shifted +228 but dense-240 −263, dense_dialogue −106: the pair needs both halves |

Capability rows flip ±230 between variants at 3 probe seeds — governed
family `impact-dive-harvest` declared with members `composed-v1`,
`template-only`, `composed-mild` (bands 0.6/0.7) to rank on a fresh shared
six-seed epoch before any certification.

**Family round 1** (fresh shared 6-seed epoch, ~8 min): composed-mild +6.79
(SE 8.13) observed champion, composed-v1 +6.13 (SE 8.91), template-only
−3.15 — the pair needs both halves on fresh seeds too. Selected
`composed-v1` over the observed champion (recorded reason): pairwise delta
0.66 (SE 10.2) is noise while the composition differs materially —
representative −0.52 vs −4.91, validity +9/−2 vs +8/−5, and composed-mild
carries dense-240 −225 and dense_dialogue_impact_contrast −79.

**Certified attempt 1** (`2026-07-15T22-27-56Z-477daa82`, depth 48, 56 min):
**INCONCLUSIVE at +5.62** — realized SE 2.47 vs envelope 1.30; the 99%
one-sided bound just missed. Positive at every budget (250k +1.87, 500k
+6.21, 750k +7.15); capability interval excludes zero (+41.90 [+2.73,
+81.08]); validity +34/+14/+6 per budget (pickup_shifted 93→110,
dense_recovery 65→82 valid of 144); representative −1.52 [−5.22, +2.19].
Mechanism identity check on the 12,672-compile paired epoch: the ask-bucket
impact undershoot is UNCHANGED (−0.149→−0.146 at ask 0.3) — the candidate's
value is capability completion/validity recovery plus air/speed quality on
recovered rows, not broad impact accuracy. Impact RMS is rigid, now
confirmed at certified scale. The variance came from capability validity
flips (drag rows: rising_switch pays speed at all budgets, loose_pocket
pays air).

**Retired refinement: completion-first forward-eval gating.** All 187
canonical 250k invalid runs are rideStalled first-completion failures (mean
FCF 240–280k frames) and forward-eval charges ~30% of frames, so
pre-completion branch selection was switched to the local proxy: FCF fell
~30% but valid-row quality fell ~20/row (the proxy trunk is permanently
worse — forward-eval is load-bearing pre-completion). A depth-1
pre-completion rollout (exact judge, half charge) was quality-safe on the
250k panel (+3.2/row, FCF −15%) but the full stage-0 composite scored
+3.38 vs composed-v1's +8.32 with countercurrent −34/believer −26 — retired
and reverted; the freed frames do not pay for the trunk-quality loss at any
budget on this suite.

**Certified attempt 2** (`2026-07-15T23-39-46Z-5947d05e`, acknowledged
retry, fresh epoch, era spend 0.0418/0.05): declared for the unchanged
composed-v1 source. Rationale: θ̂ ≈ +5.8 across three independent
estimates vs accept threshold ≈ +6.0 (P(accept) ≈ 45–55%); no refinement
lever above instrument resolution exists (stage-0 SE ~8 cannot resolve ±2
tweaks and every nearby constant flips frontier rows); declining stalls the
campaign with nothing better to spend the slot on.

**Outcome: FUTILITY STOP at k=2** (delta −16.61, SE 1.21, UB95 −13.47).
Identity audit: both attempts carry byte-identical candidate/baseline
fingerprints — only the epoch differs. The k=2 wave shows the mechanism's
knife edge landing badly: frontier validity flips 4-vs-1 against
(pickup_shifted 500k, dense-240 500k, dense_recovery 500k+750k lost;
pickup 250k gained) at ±380 points per run, plus a negative ordinary-row
scatter. Together the two attempts measure a candidate whose per-block
delta variance (σ_b ≈ 17 vs the menu's ~9 envelope) structurally exceeds
the certified operating point: **a mechanism priced by 25–40% Bernoulli
recovery rates cannot pass depth-48 certification regardless of its mean.**

**Decision.** Retain composed-v1 in the development tree (its capability
recovery is real but unreliable; the frozen baseline of record is
unchanged). The era is exhausted for declarations (0.0418 + 0.0209 >
0.05); the next certification will require a ledgered
`--override-era-budget` and must wait for a materially stronger, LOWER
VARIANCE tree. The next mechanism question is therefore reliability, not
breadth: why do recovered capability rows still fail 25–40% of seeds, and
what continuous mechanism makes the dive-harvest recovery deterministic
rather than a per-seed lottery?

## Retired: Pickup-Transition Breadth (2026-07-16)

**Hypothesis.** Pickup rows die almost exclusively at their 180–200ms rungs
(8–10-frame intervals; ~94% complete at 500k, budget-starved at 250k), so a
per-gap breadth law — extra samples where a LONG interval hands into a SHORT
one (long×short smoothstep product on interval frames; dense streams'
short×short scores ~zero by construction) — might make rung completion
reliable at scarce budgets.

**Falsifier.** n≤8 panels flip-flopped (+2/−1, then −1/+1 on recalibration)
— frontier validity at that depth is coin noise. The decisive 24-seed
paired A/B (pickup, dense240, dense, frontier5 at 250k): pickup 14→13
valid (4 gained / 5 lost), dense240 4→3, dense 1→0, frontier5 24→24
byte-identical. Pure churn: more draws from the same candidate distribution
reshuffle which seeds complete without raising the completion rate — the
distribution itself lacks mass on catchable rung entries, matching the
retired-global-breadth precedent.

**Decision.** Retired and reverted. Rung/dense reliability requires a
different generator (a joint two-contact capture-and-continuation
formulation per the trajectory-synthesis program), not more samples.
Certification arithmetic note for the next candidate: with the current
tree's per-block σ≈17, accept at depth 48 needs true θ ≈ +8.5–10, OR a
LOW-VARIANCE quality mechanism (smooth per-gap error reductions rather
than validity Bernoullis) that both adds mean and does not inflate σ.

## Active: Air Mid-Ask Overshoot Is Generation-Limited (2026-07-16)

The air axis is the remaining broad LOW-VARIANCE quality pool (canonical
500k: systematic overshoot +0.32 at ask 0.1 fading through +0.11 at 0.3-0.4
and +0.06 at 0.6 to −0.03..−0.10 at 0.8-0.9; low-ask short-gap mass is
partly detector-floor-forced, the 0.3-0.7 band ≈165k obs is not). The pool
probe (`study_air_pool_coverage.ts`, 1,566 air-targeted pool visits, four
representative sources at 500k) locates it: at asks 0.5/0.6 even the pool
MINIMUM achieved air overshoots (+0.071/+0.026) and the quality winner sits
only ~+0.02 above the pool's closest candidate — no sampled candidate rides
supported long enough; admission and selection are exonerated. Unlike
capability validity, this error is a smooth per-gap quantity: fixing part
of it adds certified mean without inflating block variance. Support-pathway
mechanism map in progress.

**Update (same day): reframed and parked.** The support-pathway map exposed
an ownership subtlety: a gap's air is committed mostly by the PREVIOUS
gap's ride-out (a candidate owns only a ≤44px pre-contact lead-in of its own
gap's air), and by that accounting the pools DO contain ask-matching and
much-longer ride-outs (pool-min next-gap air undershoots by 0.3+). Three
cheap falsifiers then closed the selection-side explanations: the airFit
overshoot deadband removed → air RMS unchanged (0.161→0.162); the ask
shifted −0.07 (prediction-bias theory) → air RMS worse (0.161→0.165,
low-air rows crash); the overshoot is UNIFORM across preceding-impact
context (+0.05..+0.09 everywhere), ruling out hop-exit collateral. All
support-extension lanes are structurally inert on ordinary gaps
(extensionPressure ≡ 0 via the 0.55 safeCap in supportReferenceLength), yet
the exact forward-eval sees the real +0.07 and keeps choosing it — and the
marginal scorer costs are nearly balanced (d wrms²: air 0.084 vs speed
0.060), so the overshoot is plausibly the equilibrium price of speed at the
current geometry, like impact. ARC_LEN_SPAN widening was already certified
-13 historically. **Conclusion: air, like impact, is frontier-limited, not
selection-limited.** The naive +14.5 counterfactual overstates the free
pool; capturing it requires support geometry that holds speed (normal-force
/ hybrid support-release direction in compiler-trajectory-synthesis.md),
not objective nudges. Parked pending a trajectory-basis mechanism; the next
diagnostic if reopened is a trace-level decomposition of each gap's
airborne run (prev ride-out | flight | lead-in) against the committed
candidates' predicted release frames.

## Declared Next Mechanism: Joint Rung Continuation (2026-07-16)

Both broad quality axes (impact, air) are frontier-limited at the exact-
evaluator equilibrium, and certification arithmetic requires either true
θ ≈ +9-10 or collapsed frontier-flip variance. The one target that moves
mean AND variance together is rung/dense-figure reliability: pickup rows
fail only at 180-200ms rungs, dense rows at 12-frame figures, and the
dive-harvest recovery is a 25-40% per-seed lottery exactly there.

**Hypothesis.** At a long→short transition, the two contacts must be closed
JOINTLY: a capture at contact k whose continuation is a constructed
supported rail through contact k+1 (7-12 frames later), where k+1's hit may
be realized as the detector's interval-derived persistent-bounce exception
(a distinct landing is not representable inside so short an interval). The
existing SLAM-HOP template already delivers the joint FLIGHT form (hop
sized to land the next beat); the rung form replaces the hop with a
supported carry-through sized by the rung interval and k+1's ask.

**Constraints inherited from retired studies:** retain an engine-admitted
capture at k (standalone construction: zero valid captures); never screen
the outgoing geometry with current-gap-only gates; composite candidates
enter the ordinary pool and are judged by the unchanged exact evaluator and
ranker at ordinary charge (no multiplied rollouts); unavailability at long
intervals is an ordinary absence. Continuous inputs only: interval frames,
asks, speed, arrival state.

**Falsifiers, in order:** (1) the detector/validity rule must actually
admit a bounce-realized k+1 on 8-10-frame intervals (read the
interval-derived exception's exact bounds first — if 180ms intervals exceed
them, the rail must instead produce a distinct landing, which the six-frame
phase assay says is hard); (2) on fixed rung states, joint candidates must
close both contacts where the normal pool closes neither; (3) 24-seed
250k completion rate on pickup rows +20pp minimum without ordinary-row
damage (n≤8 panels are noise); (4) stage-0 composition, then the
override-certified attempt for the accumulated tree.

**Resolution (same day): the RUNG RELEASE LANE, committed 51defe4.**
Falsifier (1) closed the bounce shortcut immediately: `isAuthoredContactEvent`
admits a bounce only for intervals ≤ MIN_LANDING_AIRBORNE_FRAMES = 6, so
8-10-frame rungs need a distinct landing — which needs ≥6 airborne frames
before it — which leaves ≤ N−7 grounded frames at the previous contact. The
sampled ride-out distribution never drops below ~28-36px (~4+ grounded
frames; an ARC_LEN_FLOOR 28→10 probe was byte-identical — the floor never
binds because the distribution never approaches it), so touch-and-go
geometry was structurally absent from every pool: no joint solver needed,
just the missing family. The lane (attempt-spanned, continuous next-interval
shortness ramp, grounded budget = interval − airborne requirement):

- 24-seed 250k A/B: dense 1→5 valid (5/1), dense240 4→8 (5/1), pickup
  14→16 (5/3), dense_dialogue_impact_contrast 20→24 (4/0); frontier5 and
  non-short ordinaries byte-identical (surgical targeting).
- Stage-0: 483.49 → 499.65 (+16.16), validity +6/−2, twice composed-v1's
  screen. 500k strata: representative +2.6, capability +181.3. The one
  material stage-0 regression (dense_dialogue_ic 250k −350) was 3-seed flip
  noise — the 24-seed instrument shows that exact cell at +66 mean, 4/0
  validity.

The first mechanism of the campaign that moved dense at all, and it moves
mean AND reliability together.

**Certified outcome (`2026-07-16T00-55-56Z-45f7c00c`, era-override 0.07
ledgered): ACCEPT.** Headline `492.10 -> 504.03`, delta `+11.93`, 99%
one-sided lower bound `+6.60` (SE 2.25); every futility look passed
(+20.9/+16.9/+13.7/+11.8/+13.4). Validity `+126/-27`: dense_recovery
71→114/144, dense-240 92→112, pickup_shifted 97→119, pickup 109→129, and
750k reaches 2112/2112. Budgets: 250k `-6.46` (unresolved interval), 500k
`+18.54`, 750k `+13.16`. Strata: capability `+106.85 [+75.62, +138.08]`,
representative `-4.68 [-9.25, -0.11]` (meter_exchange −39.7, dense_dialogue
−26.7), legacy and development music unresolved. Qualification sidecar
388.38. Rebaseline label: `accept-2026-07-16T00-55-56Z-45f7c00c`; era
budget reset.

**Open costs for the next iteration:** the representative interval excludes
zero on the negative side — small but real; the leading regressions
(meter_exchange, dense_dialogue at 250k/500k) and the 250k budget cell are
the first candidates for recovery, likely tied to the lane firing inside
ordinary short-figure passages where the touch-and-go trade is not free.

**Post-accept band ablation (2026-07-16, 24 seeds × 6 sources at 250k, both
arms with the rung lane):** default steep-launch bands vs the accepted
widened ones. Default bands recover dense_dialogue (21→24 valid, +59 mean)
and slightly help believer/pickup, but LOSE half the dense recovery
(dense240 8→4, dense 5→3) — the widened launches compose with the
touch-and-go lane on dense figures. meter_exchange is band-independent
(identical validity, +1) — its certified regression has another source.
The two regimes share the same continuous signature (short figures,
similar asks); they differ only in incumbent validity, which no legitimate
input may condition on. Decision: keep the accepted config; the
representative −4.68 is the recorded price of dense recovery. Next pools:
the 250k budget cell (−6.46 unresolved) and frontier-shifting geometry.
Workflow friction: the in-process panel harness exhausts WASM memory after
~100 compiles (RuntimeError: unreachable in addLine) — keep panel runs
chunked ≤96 compiles per invocation; the benchmark runner's worker
recycling is immune.

## Accepted: Slack-Conditioned Depth-1 Pre-Completion Rollouts (2026-07-16)

**Hypothesis.** The remaining 250k capability invalids sit at the completion
knee (valid first completions 242–260k frames of the 250k budget) and
forward-eval charges ~30% of frames; when the search holds no completion AND
the traversal budget model predicts a tight budget (budgetSlack below the
existing low-slack branch threshold), greedy rollouts shallowed to depth 1
buy the knee without touching mature-phase trunk quality. The unconditional
form had been retired for exactly that mature drag; the slack condition uses
only the measured search state.

**Evidence.** 24-seed 250k A/B: dense 5→13 valid (9/1), dense240 8→10;
pickup/frontier5/500k byte-identical. Stage-0 +7.69 at 95.5% identical
pairing. **Certified accept `2026-07-16T02-42-52Z-5fcbfc73`:** delta +2.34
[LB99 +0.65], realized SE 0.70; 500k/750k exactly +0.00; 250k +11.71
[+2.30, +21.12]; representative +3.30 [+0.59, +6.02] (dense_dialogue_ic
+44.4, validity 136→143) — recovering most of the prior accept's
representative cost; capability +0.21; validity +34/−21. Era reset.

## Roadmap After 504.03 (2026-07-16)

Fresh counterfactuals on the new canonical archive: impact RMS ×0.8 →
`+41.9`; all-invalid recovery → `+12.6` (now concentrated at 250k on the
four dense/pickup capability rows — 500k/750k validity is essentially
complete); air ×0.8 → `+11.9`; speed ×0.8 → `+6.7`; amplitude ×0.8 →
`+3.0`. Arithmetic: everything except impact, taken IN FULL, reaches only
~538. **The 550 target requires breaking the impact frontier** (geometry
that converts steep arrival into windowed redirection while holding carried
speed — the dive-harvest pair moved validity, not the ask-band undershoot).
Order of attack: (1) 250k capability completion (+5-12; the remaining
invalids are first-completion-bounded), (2) partial air/speed via
support-geometry frontier work, (3) the impact-frontier program — the
trajectory-basis build (docs/compiler-trajectory-synthesis.md) is on the
critical path to the goal.

## Declared Next Mechanism: Late Dive-Ramp Impact Family (2026-07-16)

The post-504 roadmap arithmetic stands: impact ×0.8 is +41.9 and everything
else combined caps near ~538, so the impact frontier is on the critical path
to 550. Every selection-side lever is falsified; the achievable envelope at
authored speeds is ballistically bounded; and both accepted mechanisms won
by supplying structurally-absent geometry rather than pressure. The next
structurally-absent family: impact = v·Δθ gains linearly in contact-instant
speed, the speed axis scores the gap MEAN, and the sampler's post-angle
distribution rarely exceeds ~30° — so a LATE steep supported dive ramp
(descending 35-55° over the final quarter of the gap, guided acceleration
beyond the gap-mean speed) feeding the existing arrival-conditioned
converting catch is out of distribution and physically buys redirArc without
paying the mean-speed price the scoop family pays.

**Falsifier chain (declared before implementation):** (1) single-gap oracle
on fixed committed prefixes — does dive-ramp + existing template deliver
measured redirArc ≥ ask where the normal pool undershoots, at equal
survival? If the ramp cannot beat the pool's achieved impact on ≥ half the
probed states, retire before any lane. (2) Attempt-spanned lane with
continuous inputs (ask, speed, gap frames, arrival state); normal candidates
preserved. (3) 24-seed panels (chunked ≤96 compiles per process — WASM
memory), ordinary guards byte-diff checked. (4) Stage-0 composition. (5)
One certified attempt. Era fresh (0/0.05).

## Retired: Late Dive-Ramp / Deep Steep-Launch Frontier Probe (2026-07-16)

Design correction closed the ramp form before implementation: any mid-gap
supported dive ramp registers an off-beat landing (validity kill), so
contact-instant speed can only come from the previous gap's descent and
flight — i.e. the steep-launch family. The composition thesis (steep
launches failed pre-template; the accepted arrival-conditioned template
might now convert them) was probed on the new baseline: cap 15→28°,
hard-impact zero band 0.5→0.35, six sources × two seeds at 500k. Result:
impact RMS 0.300→0.302, mean −3.1/row, high-ask buckets mixed (believer 0.6
improved on one seed, 1.0 worsened), familiar air collateral. **The
ballistic impact frontier holds even with the converting catch present.**
Retired; the +41.9 impact pool now formally requires the trajectory-basis
program (docs/compiler-trajectory-synthesis.md): an engine-measured
transition source that changes the collision-state basis — staged
capture/continuation with replay-proven boundaries — not sampler pressure
in any form. That program's next declared falsifiable steps stand.

## Retired: Pre-Completion Low-Slack Sample Lean (2026-07-16)

The residual 250k knee (dense240 ~58% invalid, dense ~46%, median valid
first completion ≈253-255k of the soft 250k budget) suggested a second
slack-conditioned economy: nCand ×0.75 while no completion exists under low
slack. 24-seed A/B: dense 13→4 valid (3/12), dense240 10→8 (5/7), pickup
and ordinaries byte-identical. Decisively harmful — with rollouts already
depth-1 there, dense completion is bounded by pool BREADTH through the
figure traversal (the samples must contain the touch-and-go catches), not
by per-visit charge. Reverted. The remaining 250k knee, like the impact
pool, now points at the trajectory basis itself: cheaper traversal of dense
figures needs better transition geometry, not thinner search.

## Declared Study: Charged Two-Contact Shooting (2026-07-16)

Calibration-only, WASM/500k, declared before any row is observed. Question:
from an exact committed prefix at a dense/rung state, can a JOINTLY
constructed pair — an engine-admitted catch at contact k and a chained catch
at contact k+1 on the extended engine — close both contacts where the normal
pool fails, at physics-frame cost comparable to what the normal sampler
spends failing?

Protocol: frozen `line.frozen-trajectory-prefix.v3` fixtures (dense g69→70,
9-frame outgoing; dense240 g86→87, 12 frames; ordinary control), which
replay clean on the current tree. Segment 1 = the mirrored 24-control C1
capture-arc screen (the only primitive that closes dense captures: 11/12 and
8/12 in calibration) plus an equal-count raw-normal comparator stream.
Segment 2 = for each admitted segment-1 fit, extend the immutable engine
with its lines and run the same capture-arc screen at contact k+1 from the
new exact probe state; admission at both contacts is the unchanged
`tryCandidateLines` (survival, ±1-frame landings, no off-beat). Every row
retains both fits' outcomes and `getSimFrames()` charges per segment.
Constraints honored: starts from engine-admitted captures (the standalone
primitive is retired); no outgoing-target reads in segment-1 construction;
no case identity/duration buckets; exact replay is the only authority.

Falsifiers: (1) zero jointly-admitted pairs on both dense states within the
fixed screen → retire the joint formulation at this control budget; (2)
joint pairs exist but charge ≫ the raw-normal stream's frames for its own
(failed or successful) attempts → the basin is unaffordable; (3) joint
pairs exist only on one state → capability evidence, no generalization
claim. Success authorizes only a default-off shadow-source design through
normal admission and the V2 funnel.

**Result (2026-07-16, `scripts/v0/study_two_contact_shooting.ts`, artifacts
`generated/studies/two-contact-shooting/v1/`): RETAIN — no falsifier
fires.** Segment-1 admission: dense capture-arc 13/24 vs raw-normal 2/24;
dense240 9/24 vs 1/24; ordinary 9/24 vs 22/24 (raw saturates — the
primitive is unneeded there). Joint two-contact pairs: dense 16 with the
capture-arc as the SOLE source (raw-normal 0 at equal charge); dense240 77
with 9/9 admitted captures chaining; charge comparable (17.2k vs 16.0k
joint-per-M-frames on dense240). The dense-proper knife-edge is the
continuation (1/13 captures chain; 14 rows die not-admitted-k1). This is
the first exact-engine evidence of an affordable two-contact basin at the
dense states. Next: a compact compiler-side capture-arc lane (reimplemented
inside the identity boundary; the study module stays study-only), gated
continuously on short current-interval + authored impact, attempt-spanned,
judged by unchanged tryCandidateLines/ranker, through scope panel → stage 0
→ certified attempt.

## Retired: Capture-Arc Sampler Lane, v1 (replacement) and v2 (composed) (2026-07-16)

The two-contact basin is real, but two integration forms failed the same
declared 24-seed 250k discard condition. v1 (early-return replacement of the
whole geometry on ~1/3 of firing attempts at short-current-interval impact
gaps): dense240 10→3, dense 13→5, pickup 16→13 — the lane's own grounded
extent displaced the touch-and-go continuations both accepted mechanisms
depend on. v2 (composition: capture-arc entry incidence + boundary phase
only, normal post machinery fully preserved, residual turn through the
existing frontload channel): dense240 10→4, dense 13→7, pickup 16→15 —
better, and mildly positive on ordinary short-figure rows (dense_dialogue
+4.3, believer byte-identical 24/24 = surgical gating), but still a net
validity destroyer exactly where it was aimed. Mechanistic residue: the
geometry is exonerated; POOL-SHARE SUBSTITUTION is convicted — at the 250k
knee, dense completion chains need the default entries, and spending any
share of the 32 sampler attempts on capture-incidence entries starves them.
A successor must ADD capacity (extra-candidate lane beyond the sampled 32,
the reuse/brake/startup pattern) or deliver the full joint pair as one
composite candidate. One final delivery form is declared below; if it also
fails the same condition, the compiler integration of this basin is closed
for the campaign and the basin remains calibration evidence.

**v3 (additive extra-candidate lane in handoff, brake-lane pattern, K=2-4,
new RNG stream, believer 24/24 byte-identical = clean gating): the discard
fires hardest — dense −8, dense240 −6, pickup −7, dense_dialogue −7.** The
lane's candidates either win locally into a poor continuation basin or lose
while burning charged admission + rollout sims per short-gap visit, exactly
at the charge-bounded 250k knee (consistent with the retired sample-lean
result). Monotone across three deliveries (replace/compose/add), one
construction. **Direction closed: a standalone capture catch cannot exploit
the two-contact basin in any lane. The basin remains calibration evidence;
the only admissible successor is a JOINT composite candidate — capture +
continuation constructed and admitted as ONE unit — i.e. the staged
transition source of docs/staged-transition-solver-assay.md. That is the
next (and largest) build of the trajectory program.**

## RETAIN: Staged Transition Solver Assay Passes (2026-07-16)

`scripts/v0/study_staged_capture.ts` + `trajectory/staged_capture.ts`
implement docs/staged-transition-solver-assay.md faithfully (declared
deviations: 2-frame engagement lead + 0.6px preload forced by the rider's
body footprint at H; support strictly after H; perpendicular positive
rail). On the 8 frozen v3 fixtures: **no rejection criterion fires.**
Positive rail 8/8; captures close on every state from the head of one
fixed 48-control ordering (indices {0,2,6,0,0,2,2,2}); 40/40 support arms
preserve prefix trace, capture identity, and scored impact; the exact
air-accounting law takes outgoing air residual from +0.94..+0.98 to ≈0.00
across the entire 3-7s ladder; dense240 gains a support-owned next-beat
bounce. Total panel cost ≈17.6k sim frames. Open items the artifacts
expose: (a) capture impact undershoots the ask (first-closed selection
takes the ordering head, never an impact-accurate control); (b)
dense-proper's 9-frame window is consumed by the capture band through H
under the engagement lead; (c) frontier3/4 combined arms each register one
mid-window off-beat landing (admission-relevant, not assay-relevant).

Per the assay's promotion gate, the next declared step is the compact
default-off shadow source: the staged composite (capture + sealed-handoff
support as ONE candidate line-set) admitted by unchanged
`tryCandidateLines`, inert when unavailable, then scope panel → stage 0 →
family/certification. The three capture-arc lane falsifications stand as
the constraint set: the composite must carry its own continuation and add
capacity without displacing normal entries.

## Retired: Staged-Composite Shadow Source (v4) — Direction Closed (2026-07-17)

The assay-validated staged composite (capture + sealed-handoff support as
ONE `tryCandidateLines`-admitted candidate, additive K=1 extra-candidate
lane, charged 8-control closure scan, LR_STAGED_SOURCE=0 escape proven
byte-identical) fails both declared discard conditions on 24-seed panels at
250k AND 500k:

1. **frontier5 air RMS unchanged to four decimals at both budgets** while
   every row is perturbed — the lane fires and charges everywhere, and the
   exact ranker + forward evaluator never select the composite over healthy
   incumbents. Construction-level air accuracy (assay +0.94→0.00) is
   worthless if the option loses the rank.
2. **Capability validity losses at the 250k knee**: dense −7, dense240 −3,
   pickup −3 — where incumbents are scarce the composite IS selected and its
   continuation under-completes; score collapses (dense −108) with sim
   frames flat. Bitter detail: dense air RMS improves (−0.019) while
   completion dies — the geometry does exactly what it was designed to do.

**Four delivery forms, one construction, one conclusion** (v1 sampler
replacement / v2 sampler entry composition / v3 additive standalone catch /
v4 additive assay-validated joint composite): statically-constructed
capture geometry fails full-compile economics in every delivery — where the
pool is healthy the search equilibrium out-ranks it; where the pool is thin
it poisons completion. The staged assay's RETAIN stands as construction
physics; the promotion gate killed the source at its first funnel stage,
as designed. The direction — supplying constructed candidates to the
existing search — is CLOSED for this campaign. Any successor must make the
search VALUE the joint pair's downstream payoff (a judge that sees the
outgoing interval's realized quality at selection time without violating
the falsified readiness-reshape and forward-eval-widening lessons) — a
genuinely open research problem, not an iteration.

## Closed: The Joint-Transition Source Program, With Its Successor Requirement (2026-07-17)

The forward-eval diagnostic and the v5 release iteration complete the
elimination chain, each factor measured on frontier5@500k probe data
(841-847 constructed-visit records per arm):

- admission: 37% admit — not binding;
- current-gap measured axes: staged-vs-winner medians identical (air 0.3913
  vs 0.3913, speed 0.7038 vs 0.7038) — the assay-vs-scorer measure mismatch
  is real (+0.102 whole-gap overshoot) but shared with the winner via the
  common pre-contact flight — not binding;
- support extent: dead 95px vs live 90px — not binding;
- release law (v5: the compiler's own SLAM-HOP hop exit, two sizings, the
  remaining-flight form landing a sane −1.2° median launch): continuation
  death 95.3% → 93.8% — not binding;
- **what remains: the grounded support corridor itself. 94-95% of admitted
  staged composites leave an arrival state at the next beat from which the
  normal sampler constructs NOTHING admissible (winners: 2-3%). The normal
  candidate space cannot chain from states it did not itself produce.**

Direction closed. The successor requirement, stated once for the whole
program: before ANY upstream construction (capture, support, rail, ramp,
composite) can pay, the downstream sampler must become competent at
rail-exit/off-corridor arrival states — a generator/aim-model question, not
a delivery/selection/sizing question. The staged assay (RETAIN) and the
two-contact study remain the program's physics evidence; the probe data
(generated/staged-probe.jsonl) characterizes the exact arrival states the
sampler fails on, and is the starting instrument for that successor study.

## Terminal: The Staged-Source Program Ends in the Detector-Floor Identity (2026-07-17)

The arrival-state post-mortem produced perfect separation: 97/103 dead
continuations had fewer than MIN_LANDING_AIRBORNE_FRAMES (6) airborne
frames between the composite's last own-line touch and the next beat —
below which NO landing event can exist for any generator; every chainable
row had ≥6; winners median 7 with zero below. The evidenced one-line fix
(reserve the landing window in the air accounting — the accepted
rung-release law) worked exactly as diagnosed: continuation death 93.8% →
23.4%, chainability 5% → 86%. And the resulting panels closed the program:
frontier5 score −12.2/−2.5 (discard clause 1), dense/dense240 −3 each at
the 250k knee. **The cap removes exactly what made the composite unique:
air-faithful support below the floor is detector-illegal; above the floor
the normal sampler was never starved.**

Durable artifacts: (1) **the floor identity — measured air per gap ≥
MIN_LANDING_AIRBORNE_FRAMES/gapFrames while landings remain admissible.**
The canonical low-ask air overshoot (+0.32 at ask 0.1) is partly this
unbuyable constant, not compiler error; air asks below 6/N are physically
unsatisfiable (an authoring/suite insight — the benchmark contract is
frozen, so this prices the air pool DOWN for compiler purposes rather than
opening a lever). (2) pickup@250k +2 valid/+28.6 from the shortness branch
— RETRACTED: a 48-seed verification fully reversed it (new 24 seeds −4
valid/−68.3; combined −2/−19.9, gained 7/lost 9 churn signature). The
staged ledger is uniformly non-positive on every source and budget. (3) The complete six-form
falsification chain with per-form measured causes, ending every
constructed-geometry route.

## Standing Position After the Program Closure (2026-07-17)

Re-pricing the pools NET of both measured physical bounds (the detector
air floor 6/N and the ballistic impact feasibility bound), on the current
canonical archive: perfect within-bounds delivery of air+impact = **668
(+165)**; capturing HALF the avoidable error = **599 (+95)**; half plus
full invalid recovery = 615. **The 550 target requires only ~28% of the
avoidable, physically-legal error mass.** The campaign's exhaustive
closures therefore establish that the frontier is compiler geometry/search
co-design — every mapped mechanism family is falsified with measured
causes, but the prize is not physics-bounded. Next-session starting
points, in order: (i) the pickup@250k shortness×knee cell (+2 valid/+28.6
banked in the v6 panels); (ii) aim-model accuracy at the modal regimes
(the one lever family with prior positive history not yet exhausted under
V2); (iii) fresh design territory for within-bounds error capture, tested
against the standing falsification chain before any build.

## Retired Hypothesis: Aim-Model Per-Axis Bias (2026-07-17) — Model Exonerated, Two Leads Opened

An observation-only probe (18,406 realized aimed candidates, 4 sources × 2
seeds @500k; decision-surface fidelity proven to 1e-9) measured the aim
lane's fitted model against exact measurements: air bias +0.004 / speed
−0.002 / impact +0.003 — 1-3% of the axis error scales,
sign-inconsistent across sources. The model is accurate and unbiased at
modal regimes (impact RMSE 0.025 vs axis RMS 0.29); the mis-aim hypothesis
is NOT supported and no bias correction is warranted. Two evidence-backed
leads from the same data:

1. **[FALSIFIED same day]** The 0.55 safeCap (generation, existing machinery inert). Gaps with
   air asks 0.3-0.5 achieve ~0.76 (+0.36 overshoot, far above the detector
   floor at those 24-31-frame gaps). The support-extension lanes built for
   exactly this deficit are structurally disabled: `supportReferenceLength`
   = min((1−air)·v·gap, **0.55**·v·gap) forces extensionPressure ≡ 0 for
   every ask < ~0.45 (log-ratio never reaches its threshold). Raising the
   safeCap is a one-constant continuous enablement of EXISTING deficit
   machinery — the scaffolding survey pre-identified it as the one clean
   lever pending deficit confirmation, now confirmed.
2. **[NOT CONFIRMED same day]** Amplitude leak in aim selection (correctness-shaped). The aim
   currentQuality term scores a (poor) amplitude prediction on sources
   where amplitude is not a scored component (split_signal: scored axes on
   target yet currentQuality 0.21) — the aim judge diverges from the
   scorer's axis contract. Alignment fix candidate.

## Retired: SafeCap Enablement; Amplitude Leak Not Confirmed (2026-07-17)

**SafeCap 0.55→0.9: falsified on 9 panels (24 seeds each).** river_reentry
byte-identical at both budgets; frontier5 air RMS WORSE (+0.005/+0.010)
with speed also worse; dense/dense240 lose 5 valid each at 250k. The
causal premise was backwards: raising the cap drives the support-deficit
ratio TOWARD 1 (further below the extension smoothstep start), so the
extension lanes stay inert at any cap ≥ ~0.35; the only real effect is the
direct targetLen lerp lengthening ride-outs, which is neutral-to-harmful.
Engaging the extension machinery would require LOWERING the cap (≤~0.35),
which simultaneously shortens the direct ride-out target — incoherent.

**Amplitude leak: not a leak.** Both the aim quality readout and the V2
scorer contract derive from the same effectiveAxes(); every source that
authors amplitude scores it (10/10); elevation/grain are never authored so
the only structural divergence is dormant. split_signal's low aim
currentQuality is the correct joint quality of genuinely-hard scored axes.
Residual (small): the model-path amplitude PREDICTION is noisy inside the
joint quality — a prediction-quality question on a +3.0-point axis;
deprioritized.

With these, every lead from the aim-accuracy measurement is resolved. The
campaign's mapped mechanism space is exhausted end-to-end; the standing
position (550 needs ~28% of physically-avoidable error; frontier =
geometry/search co-design) is the complete statement of what remains.

## Declared Mechanism: Impact Polish Passes (2026-07-17)

Two code-verified facts converge: (1) the forward-eval leaf pools the whole
prefix into one RMS, so a 0.2 impact fix at gap k moves the leaf by ~147/k
points while a rollout survival/missing difference moves it ~295 — the
judge's axis discrimination decays 1/k and is 44-123× dominated by
downstream survival noise at depth; (2) the clone-and-test polish framework
(terminal leaves only, monotone adoption via the full-track exact score) is
inert solely because its helpers target air-only edits — 2026-07-14 verdict:
"the existing polishers do not mutate the mixed speed/impact objectives."

Mechanism: new impact polisher family (deepen frontload / entry rotation /
scoop extension on undershooting committed impact gaps) inside the existing
framework, with polish flipped default-ON. Atlas compliance: post-terminal
only (no 250k knee charge, no pool displacement), monotone (adopts only
strictly-better exact full-track leaves — where axis marginals are correctly
priced, evading the 1/k dilution), readiness/forward-eval unconsulted,
detector floor and ballistic bound respected by the exact gates.

Declared discard: zero adoptions after one variant-menu iteration; or mean
impact-RMS improvement < 0.005 across believer/dense_dialogue/split_signal/
river_reentry at 500k (24 seeds); or any 250k capability validity loss > 2.

**Outcome (same day): DISCARD, with a new measured law.** The full build
(byte-identity-proven escape, cost-capped probes ≈2.3k frames each) found
the undershoot pool as expected (71/72 believer gaps) but: mid-track catch
edits of ANY size gate-fail — a moved catch vertex changes the exit
trajectory and cascades into downstream ±1-frame contact misses — so only
the final 1-2 gaps are editable, where local accepts do occur (impact error
0.581→0.553 at believer g80) but are worth ~ΔRMS 0.0005 ≈ 1/10 of the
discard floor, while probe charges perturb search lumpily. **Post-hoc
geometry repair is structurally impossible on committed tracks: the impact
deficit is a compile-time geometry commitment.** The polish framework
verdict (inert) now extends to any polish-scale impact residual.

## Retired: Recency-Weighted Forward-Eval Leaf — Dilution Is Load-Bearing (2026-07-17)

The blended leaf (q_all^0.6·q_win^0.4, W=3; β=0 byte-identical; only
objectiveLeafValue touched after a path audit) tripped both discard
criteria: mean 500k −9.65 with uniform speed-RMS worsening
(+0.018..+0.025 on all four sources) and dense 13→9 at the 250k knee. Two
closing lessons: (1) **the 1/k axis dilution is functioning as drift
regularization** — the whole-prefix RMS's weak marginal is what keeps the
charged leaf conservative about accumulated prefix drift; sharpening
current-window discrimination 8× promptly trades prefix speed control for
current-gap fit. (2) **An 8× sharper impact signal at choice time improved
impact on zero sources** — with post-hoc repair separately impossible
(brittleness law), the loop is closed: the pool does not contain better
impact candidates for ANY judge to find. The impact deficit is
generation-side, period — and every generation form tried (scoops, steep
launches, standalone captures, staged composites) is also individually
falsified, each for a measured reason. What no experiment has yet produced:
a catch geometry family that delivers windowed redirection at equilibrium
collateral (holds speed, chains, fits the ±1 contact lattice). That is a
creative physics/geometry problem, not an iteration; the atlas is its
complete constraint set.

## PIVOTAL: The Catch-Frontier Oracle — Collateral Was Prefix-Inherited (2026-07-17)

`study_catch_frontier.ts` (8,400 exact admissions over a 12-parameter raw
catch space, chainability ≥6 airborne frames enforced at design time,
349k frames): **current-gap speed/air collateral is constant to 4 decimals
across every possible catch at dense240 and frontier5 — it is inherited
from the incoming flight the prefix already fixed. There is no
impact↔collateral trade at the catch; the campaign's equilibrium framing
was an attribution error.** Impact is a complete chainable dial 0.001→1.0
at all three states (floor-precise margins at the 12-frame state). The
winning family, consistent across states and UNLIKE every falsified form
(all of which invested in post-contact curvature): **entry incidence** —
signed entry angle ~20-30° rotated into the incoming CoM velocity on one
strongly dominant mirror side (232:3 at ordinary), near-zero net post-turn,
L_pre 18-47px, short low-curvature run-out, contact +1..+2.5px low.
dense240's production sampler is genuinely geometry-limited (max 0.144 vs
ask 0.28; the family reaches |err| 0.0012); ordinary/frontier5 samplers
already emit ask-exact chainable catches (their residual is pool scarcity
and beyond-feasibility asks). Historical note: the existing entry-shift
lever caps at 10° (frontier needs 20-30°), lacks the orientation dimension
and the contact drop, and its V1-era widening test changed the ramp, not
the cap. Caveats: calibration cohort; chainable ≠ chained (composition =
the retained two-contact protocol); frame-precise margins at 12f.

Next: attempt-spanned ENTRY-INCIDENCE lane in the sampler (rotate the
pre-contact entry by a swept signed 12-35° on the dominant side with the
contact drop; post-contact machinery untouched), predicted by the oracle to
win pools on measured merit (better impact at identical inherited
collateral ⇒ strictly better currentQuality).

**Lane-alone outcome: DISCARD (all three criteria).** Impact RMS ±0.001 on
every 500k source (frontier-exact candidates entered pools, were not
selected — the 147/k dilution in action), while the 45% attempt share paid
the standard displacement bill (score −6..−10, dense −7/dense240 −3 at the
knee). The 2×2 is now three-quarters measured: geometry exists (oracle);
post-hoc impossible (brittleness); supply-alone insufficient (this);
valuation-alone insufficient (recency leaf). The composition —
supply+valuation together, the one untested cell — is in test.

## Terminal: The Supply×Valuation 2×2 Is Complete (2026-07-17)

| | default judge | sharpened judge (recency leaf) |
|---|---|---|
| **default supply** | baseline | −9.65, impact flat: dilution is load-bearing drift control |
| **frontier supply (entry lane)** | −7.52, impact +0.0005: supply unvalued, knee −7 | **−13.31, impact +0.0032 WORSE, knee −5/−4: damages compound** |

All four cells at 24 seeds against shared frozen baselines (diffs and
panels preserved in the session scratchpad; reproducible). With the
catch-frontier oracle (geometry exists, compact, zero marginal collateral)
and the polish brittleness law (post-hoc impossible), the impact pool's
status is now fully characterized: **the compiler cannot cash the existing
frontier geometry through any tested combination of supply, valuation, or
repair. The coupling must be structural — a judge that reads the realized
downstream quality of the specific candidate without surrendering the
drift control the diluted aggregate provides.** That judge design is the
campaign's single open problem for the impact pool (~+42 at ×0.8).

**Honest near-term ceiling without it** (counterfactuals on the current
baseline): air ×0.8 +11.9 (partly floor/equilibrium-priced), speed ×0.8
+6.7, amplitude ×0.8 +3.0, remaining invalid recovery +12.6 (dense knee =
breadth-vs-charge bounded) — sum ≈ +34 IF fully captured, most of it
frontier-limited by the same measured constraints. Realistic without the
structural judge: ~510-520. **The 550 goal requires solving the judge
problem.** The campaign's certified gains stand at 492.54 → 503.86.

## Declared Study: Frontier-Catch Continuation Competence (2026-07-17)

Calibration-only, WASM/500k fixtures, declared before any row is observed.
Before any judge build, the 2×2's "supply unvalued" cell needs attribution:
the catch-frontier oracle proved chainability only BALLISTICALLY (≥6
airborne frames, survived to the beat). It never asked whether the NORMAL
sampler can construct an admissible catch from the frontier catch's arrival
state — and the staged program died on exactly that (94-95% foreign
arrivals). If entry-incidence arrivals are similarly foreign, the greedy:2
rollout was RIGHT to reject them and the judge is innocent; building a
judge would cash nothing.

Protocol: the three catch-frontier fixtures (dense240/ordinary/frontier5).
Segment 1 replays retained artifact rows by exact `params` (frontier set =
top chainable rows by |impact err|, N≤24; incumbent control = admitted
raw-normal rows), admits via unchanged `tryCandidateLines`, extends the
engine (two-contact segment-2 protocol). Segment 2 runs the production
raw-normal member stream at the next authored contact from each arrival
and records admissions + achieved axes. All engine touches bracketed by
`getSimFrames()`.

Falsifiers, declared: (F1, generation convicted) frontier seg-2 admission
rate < half the incumbent rate on ≥2 of 3 states → arrival foreignness
explains non-selection; judge exonerated; pivot to arrival-competent
generation. (F2, judge convicted) frontier seg-2 admission and best
achieved quality comparable to incumbents → healthy continuations existed;
non-selection is valuation noise (the 147/k dilution measured directly);
proceed to the judge mechanism. (F3, mixed) → scope any successor by the
continuous arrival features (angle, speed, airborne margin) that predict
chaining.

**Resolution: F3, and the 2×2's terminal framing is corrected**
(`scripts/v0/study_frontier_continuation.ts`, artifacts
`generated/studies/frontier-continuation/v1/`, ~87k frames total; replay
integrity bit-exact on all 96 replayed members). Per state:

- ordinary (25f outgoing): frontier arrivals chain 22/24 vs incumbent
  24/24. But pricing BOTH gaps (impact err at k + best joint wRMS at k+1
  over an equal 24-member raw-normal screen) collapses the frontier's
  advantage: best incumbent two-gap total 0.0049 (impact err −0.052) vs
  best frontier 0.0046 (impact-exact) — TIED. Only 7/24 impact-exact
  frontier rows beat the incumbent-median trade; the rest pay a downstream
  price up to 6× their impact gain. **The catch-frontier oracle's "zero
  marginal collateral" was an accounting-horizon error: collateral was
  priced at the current gap only; the real price appears in the k+1 pool.**
- dense240 (12f): frontier arrivals chain 0/24 vs incumbent 5/7 — fully
  foreign exactly where the sampler is geometry-limited. No impact
  progress is available at the knee without arrival-competent
  continuation; protect it, don't fight it.
- frontier5 (200f): both families 0/24 through this 24-member instrument —
  uninformative (long-rideout catches need the full production machinery).

Two conclusions. (1) New catch geometry is NOT the impact lever at
ordinary states: the raw-normal family already spans the two-gap optimum.
(2) The two-gap optimum sits at impact err ≈ −0.05 while compiles realize
−0.2..−0.38 — and its winners (e.g. `normal_17`: imp −0.052, k+1 wRMS²
0.0045 vs pool median 0.0115) are ORDINARY pool members. The impact prize
at ordinary states is therefore a SELECTION prize, and today's data
locates the judge's failure precisely: not the 147/k dilution of the
current-gap impact term (the recency-leaf falsification stands, correctly),
but the NOISE of the downstream price estimate — one greedy chain per
candidate, knife-edge-variant, 44–123× the impact signal, where the
two-gap analysis needed best-of-24 at k+1 to see the real price. The judge
problem is now: estimate the k+1 price with less variance at bounded
charge.

## Declared Mechanism: Impact-Pressured Downstream Width (best:1:m) (2026-07-17)

**Hypothesis.** The forward-eval judge prices every candidate's downstream
by ONE sampled attempt at the child's k+1 state (`greedy:2` ⇒
`getCandidatesSorted(branch=1)` ⇒ `solveOneGap(K=1)` = literally attempt
0), and the measured within-state spread of that estimate (two-gap totals
0.0015–0.05 across 24 members at the ordinary fixture) exceeds the
between-candidate differences selection must resolve. Replaying the
continuation study's attempt-ordered data as estimator policies: the
1-sample policy picks the two-gap optimum 8/24 (picked |impact err|
0.094); best-of-3 12/24 (0.082); best-of-24 24/24 (0.052). Widening the
mature-phase estimator to best-of-3 at depth 1 under continuous impact-ask
pressure should let the ordinary ranker select the two-gap-optimal pool
members that already exist, cutting realized impact error on
impact-authored rows without new geometry.

**Boundary:** `matureForwardEvalConfig` in handoff.ts only — the exact
accepted vertical-drama upgrade pattern (unitHash pressure firing;
`{variant:"best", depth:1, branch:3}`); sampler, pool, evaluator, ranker
contract unchanged. Continuous inputs: authored impact ask (smoothstep
from 0.25 over 0.2), target budget (smoothstep 300k over 200k — zero at
250k, so the charge-bounded knee is byte-identical by construction).
Escape hatch `LR_IMPACT_BEST_FWD=0` for byte-identity proof. In-tree
precedent gradient: start-eval best:1:5 (+7.5), opening-best branch-2/3
(accepted), V1 avg-replacement negative (avoid avg).

**Expected cross-regime effect:** impact RMS improvement on
impact-authored representative/dev-music/capability rows at 500k+;
air/speed neutral-or-better (the two-gap optimum holds them by
construction); 250k rows byte-identical; charge +1 admission per rolled
candidate on fired gaps only.

**Scope panel and discard:** byte-identity with the flag off; 250k
byte-identity; V2-jolt/500k two-seed 10-source panel
(`study_impact_scope_panel.ts`). Discard if: mean panel delta negative,
or impact RMS improvement < 0.005 mean across
believer/dense_dialogue/split_signal/river_reentry at 500k (24 seeds),
or any 250k capability validity change (must be zero), or air/speed RMS
collateral exceeding the impact gain in weighted terms. Family
(`impact-best-width`) only if the primary form survives: members best:1:2
(charge parity) and an ask-start variant.

**v1 (depth-1 best:1:3): DISCARD; v2 (first-level width, depth kept):
panel PASS.** The depth-1 form paid the declared speed collateral (mean
dSpeed +0.016, one validity loss, mean −23.2; winners were exactly the
short-figure/impact-contrast rows) — the k+2 hop is load-bearing speed
control, confirming the recency-leaf lesson from the estimator side. The
revision keeps the greedy shape and widens only the first rolled contact
(`firstBranch:3`): sample 3 candidates at k+1 (aim lane suppressed in the
widened build — baseline branch=1 rollout pools never contained aim
candidates, and without suppression every prefix re-sort re-runs the
CHARGED aim lane: 17/24 rideStalled), greedy hop below each, best leaf.
Fixed-form 500k panel (12 sources × 2 seeds): mean **+14.24**, validity
24/24, impact RMS **−0.0118**, air −0.0041, speed −0.0106 (ALL axes
improve; the depth preservation removed the speed price), frames +0.4%;
250k and flag-off byte-identical.

**24-seed gate:** pooled dImpactRMS −0.0049 (se 0.0013) across the four
declared sources — exactly ON the 0.005 bar (dense_dialogue −0.0112
carries; believer/river ≈ −0.0023), pooled dScore +1.74 (se 1.91),
validity 96/96 both arms. Recorded as a borderline miss the instrument
cannot resolve; the four gate sources exclude the rows where the panel
put the mechanism's mass (impact-contrast, capability), so the declared
composite (stage 0) decides, with stage-0-negative as discard.

**Stage 0: +3.11** (507.34 → 510.45), seed-block SE 0.65, validity
262→262 (0/0), pairing 51.1% identical (≈ all of 250k byte-identical as
constructed; the whole effect is the 500k cell ≈ +4.4). Zero validity
movement = the low-variance quality profile the certification arithmetic
requires (contrast composed-v1's validity-Bernoulli futility). Largest
loss (rising_switch_tempo_fast −27.9) is mirrored by its parent's +25.1 —
knife-edge family seed noise, not a coherent regression. Full test suite
813/813. Proceeding to the certified attempt (era 0→0.0209 of 0.05).

**Certified attempt 1 (`2026-07-16T15-08-26Z-f41e5494`): INCONCLUSIVE at
+1.86** [−1.76, +5.49], realized SE 1.36 vs envelope 1.30; all five
futility looks passed. The quality claim is REAL and certified:
representative **+3.94 [+2.64, +5.23]** and development music **+3.03
[+0.98, +5.08]** both exclude zero; 250k exactly +0.00 (2026/2112 valid
identical); 750k +4.38 [−0.26, +9.02]. The headline was sunk by
capability −6.54 [−29.55, +16.47] carrying 5 validity losses
(pickup_shifted −43.1, 3 flips; dense_recovery −30.6, 2 flips at
500k/750k) — pre-completion width charge on knife-edge completion hunts.

**Width/scope iteration (same day, all stage-0/panel-triaged):**
firstBranch 8 ungated → stage-0 −21.94, validity −3, pickup_shifted −276
(more width = more completion-hunt charge; the estimator-sim's monotone
width→quality prediction fails full-compile economics). fb8 gated
post-completion → panel −7.9, impact flat (the value lives in
PRE-completion trunk building, not refinement — gate falsified). fb8
slack-guarded → stage-0 −0.96 (protection works, fb8 still too wide).
**fb3 + slack guard (width pressure × smoothstep(budgetSlack from
2.5/2.0); the accepted slack-depth signal): stage-0 +2.37, validity 0/0;
flip-site proxies at 24 seeds/500k all clean AND positive (dense 24/24
+4.3, pickup 24/24 +4.8, dense240 24/24 +1.1, impact better on all
three).** Constant screens: ask-start 0.15 retired (−0.85); slack 2.0 vs
2.5 within shared-seed noise (+2.84 vs +2.37) — 2.5 chosen for
protection, the revision's purpose. Flag-off and 250k byte-identity
re-proven; suite 813/813. Declaring the second certified attempt (era →
0.0418 of 0.05) for the slack-guarded fb3 source default.

**Certified outcome (`2026-07-16T16-45-07Z-8257f266`): ACCEPT.** Headline
`505.51 -> 510.37`, delta **+4.85**, 99% one-sided lower bound **+1.39**
(SE 1.44); every futility look passed (+14.05/+11.49/+10.29/+6.81/+8.58).
Validity +4/−1. Budgets: 250k exactly +0.00 (2011/2112 identical), 500k
+4.81, 750k **+8.16 [+6.03, +10.28]**. Strata: representative +2.40
[+0.57, +4.23]; capability +19.42 with the slack guard converting attempt
1's worst losses into the largest wins (pickup_shifted **+45.18**, valid
120→122; dense_recovery +28.19, 109→110); legacy +1.99 and dev-music
+1.15 unresolved-positive. Worst case regression −4.16 (trivial, no
validity movement). Qualification monitor 380.83 → **392.62** (+11.8,
held-out post-decision signal). Rebaseline
`accept-2026-07-16T16-45-07Z-8257f266`; era reset; committed c62cb3a;
suite fixture test refreshed. Campaign certified chain: 492.54 → 503.86 →
**510.37**; ~40 to the 550 target.

**Retained iteration lessons:** (1) the estimator-sim's monotone
width→quality prediction fails full-compile economics — fb8 lost at every
scoping (ungated stage-0 −21.9 with pickup_shifted −276; post-completion
gate panel −7.9 impact-flat; slack-guarded −0.96): modest width at the
right scope beats more width. (2) The width's value lives in
pre-completion trunk building at COMFORTABLE slack; budgetSlack is the
continuous signal separating that from the knife-edge completion hunts
its charge damages. (3) `nCand>1` rollout pool builds trigger the charged
aim lane on every prefix re-sort — any future rollout widening must
suppress it (setRolloutAimSuppressed) to preserve branch=1 rollout
semantics.

## Roadmap After 510.37 (2026-07-16)

Exact re-pricing on the accepted 8257f266 canonical archive (reconstruction
reproduces 510.3661 to 4 decimals; per-run recon max diff 0.000000):
impact ×0.8 → **+42.26** (×0.7 → +63.1); air ×0.8 → +11.94; speed ×0.8 →
+6.62; amplitude ×0.8 → +3.08; all-invalid recovery → **+9.49** (102
invalid runs, ALL at the 250k knee except one: dense_recovery 34/48,
dense-240 30/48, pickup_shifted 21/48, pickup 11/48).

Impact ask-band decomposition (signed err, band-only ×0.8 delta): the
buyable mass has SHIFTED UP-ASK — bands ≥0.6 hold ~+27 of the +38.7 band
sum ([0.6,0.7) −0.191/+6.0; [0.7,0.8) −0.223/+8.1; **[0.8,0.9)
−0.296/+8.7**; [0.9,1.0) −0.334/+4.4), while the previously-headlined
low-mid bands hold ~+9 ([0.2,0.3) −0.129/+2.1; [0.3,0.4) −0.149/+4.6;
[0.4,0.5) −0.161/+2.4). Non-monotonic dip at [0.5,0.6) (−0.124, shallower
than both neighbors) — a possibly-exploitable "easy" regime. Air mirror
image: overshoot +0.31→+0.05 decaying over asks 0.0→0.7 (largely the
detector 6/N floor = unbuyable), ~0 at [0.7,0.8), −0.075 at [0.8,0.9).
**Ceiling decomposition (two lenses, per-gap, same archive):** the
catchability ceiling `impactCeiling(v)=clamp01(v·asin(0.9)/7.29)` at
achieved contact speed is NON-BINDING (ceiling < ask on 206 of 572,078
gaps; naive physics-permitted headline 665). The honest limit is the
density-aware `feasibility_bound` (stored per gap): it caps the
physics-permitted headline at **592.6 (+82.2)** and shows the high-ask
tail is mostly UNBUYABLE at authored densities ([0.8,0.9): 0.292 of the
0.296 deficit; [0.9,1.0): 0.301 of 0.334), while the mid bands are
FULLY buyable under both lenses: buyable-only deltas [0.2,0.3) +5.7,
[0.3,0.4) **+13.0**, [0.4,0.5) +6.7, [0.5,0.6) +5.4 ≈ **+31 in-bounds
mid-ask pool** — precisely the band where the carrier's ask-ramp
(`smoothstep((ask−0.25)/0.40)`) gates generation pressure to ≈zero.
Strategic consequence: **550 is arithmetically reachable from the
mid-ask impact pool + knee recovery (+9.5) + partial air/speed without
breaking the high-ask density frontier.** The next mechanism targets
mid-ask supply; high-ask (≥0.7) work is deprioritized as
physics-bounded.

**Post-accept family harvest (2026-07-16, all stage-0-screened and
reverted): the accepted form is the local optimum.** 250k extension
(budget ramp 300k→150k) is BYTE-IDENTICAL — at 250k budgetSlack never
reaches the 2.5 guard, so the slack guard alone already excludes the
scarce budget; the knee is closed to this family by its own protection.
Sample-8/chain-quality-top-3 (best-of-8 selection reach at best-of-3
chain cost): **−1.54** — widening the quality pre-sort's authority over
which continuations get chained is harmful, consistent with the 25–29%
top-1 agreement between the static quality opinion and chained value.
Family closed at the accepted constants; next mechanism must come from a
different pool.

## Declared Mechanism: Attempt-Spanned Mid-Ask Carrier Ramp (2026-07-16)

**Hypothesis.** The mid-ask impact deficit ([0.2,0.6), ≈+31 in-bounds
per the ceiling decomposition) is generation-limited: the carrier
ask-ramp gives ≈zero pressure below ask 0.45, so the pool rarely
contains mid-ask redirection geometry ("at ask ≈0.3 the pool does not
even contain the geometry" — retired probes), and the pool-diversity
lesson from the retired unconditional sizing says the ramp must not be
replaced globally. On a spanned share of attempts
(lowDiscrepancyRoll, the accepted idiom), evaluate the ramp with the
target-start lerped below 0.25 so mid asks get real turn pressure on a
minority of samples; attempt majority (incl. attempt 0's roll region)
stays default. The certified width judge prices each candidate's k+1
consequence at reduced noise, so supplied mid-ask geometry that holds
its continuation can now WIN selection (the missing half of the old
supply falsifications).

**Boundary:** `impactCurvePressure`/its callsite in arc_placement.ts
only; continuous inputs (ask, attempt roll, speed); evaluator, ranker,
width judge unchanged. **Falsifiers:** (1) 500k two-seed panel coherent;
(2) 24-seed knee guard: dense/dense240/pickup validity at 250k no-worse
(sampler changes reach 250k — no byte-identity shield here); (3) 24-seed
mid-ask sources impact RMS −0.008 minimum (dense_dialogue/split_signal/
river_reentry carry the [0.2,0.5) mass); (4) stage-0 positive with
representative not negative; else discard.

**Outcome: DISCARD at falsifier (1)** (share=0 byte-identity to HEAD
proven; attempt-spanned share 0.25, start floor 0.05). Panel 12×2 @500k:
mean −2.71, impact RMS −0.0014 (unmoved), speed +0.0082 (pays), air
+0.0026. Even with the certified width judge pricing the k+1
consequence, deepened-ramp scoop pressure at mid asks does not convert —
the mid-ask deficit is the speed↔impact EQUILIBRIUM price, not a
generation gap the ramp can fill. This closes ramp/scoop pressure at all
ask bands under both judges (the third independent falsification of the
family). The in-bounds mid-ask pool (+31) remains real but requires
geometry that buys redirection without the scoop's speed bleed — the
entry-incidence family delivers exactly that at the CURRENT gap but pays
at k+1 for most parameterizations (frontier-continuation study: 7/24
net-positive with a measurable arrival signature). Reverted.

## Aim: The Mispriced Both-Bad Tail (2026-07-16)

Joint impact↔speed decomposition on the 8257f266 archive: the
speed↔impact equilibrium is CONFIRMED for 87.2% of impact-undershoot
gaps (speed held on/over while impact is sacrificed — correctly priced,
matching every retired scoop probe). Speed itself tracks near-perfectly
(|mean err| ≤0.011 through asks 0.5–0.8; only [0.9,1.0) undershoots
−0.18 on 15k obs — the +6.6 speed pool is diffuse). **The mispriced mass
is the both-bad tail: 51,959 gaps (12.8%) with impact deficit ≥0.15 AND
speed under by >0.1 — mean 21.1 frames (527ms), air ask 0.51, impact ask
0.61, living on believer (10.8k), dense_dialogue family (7.5k),
dense-recovery family (5.8k), pickups (3.8k).** Both-bad = the rider
ARRIVES slow: an upstream carried-energy problem (once slow, impact=v·Δθ
and speed fail together), not an axis trade.

**Pool-probe confirmation** (believer + dense_dialogue @500k×2 seeds,
1,018 high-ask visits, entry-speed gradient): at entry <7.5 px/f the
pool's MAXIMUM achievable impact undershoots the ask by +0.65..0.74 —
physically unreachable at the state; at entry ≥9 the pool contains
ask-exact candidates (bestAll within +0.02) and even exceeds the ask
(maxAll −0.16..−0.18) while winners still undershoot +0.28..0.46 (the
priced equilibrium + judged k+1 cost). The both-bad tail is therefore an
ENERGY-RECOVERY problem: chains that fall below the speed ask stay slow
(mass is budget-invariant 250k↔750k → structural). Declared next study:
trace slow-entry chains on believer — where does the energy leak start,
and do the pools at slow states contain descent/recovery geometry (net
downhill routing) that selection refuses, or none at all? The answer
picks between an aim-lane recovery target (predicted arrival speed
floor from the NEXT gap's impact ask via the exact ceiling formula
v_needed = ask·6.51px/f) and a sampler descent family.

**Resolution (same day): PREVENTION, and the missing family is the
DESCENDING CARRIER.** (1) Recovery is physics-bounded and already
selected: at slow states the winner takes ~the pool's maximum
acceleration (quality rank 0–1; pool max ΔV +0.7–0.9 px/f per ~21f gap ≈
the free-fall envelope) — selection exonerated, recovery closed. (2)
Chain anatomy (believer, 287 runs): slow 46.6% of gaps in sticky
episodes (P(stay)=0.854, mean 6.8 gaps); onset preceded by AIR OVERSHOOT
(+0.123 vs +0.099); episodes anchor at fixed authored passages in
96–99% of seeds (gi 36–37, 68–71: speed asks 0.87–1.0 + air ~0.64 +
impact 0.65–0.96 simultaneously); recovery coincides with the air load
relaxing. (3) The generation gap is precise: at entry ≥11 px/f the
pool's MAXIMUM candidate release-speed delta is **−0.305** — the pool
contains NO speed-holding candidates at fast entries. Holding near-max
speed through 64%-airborne high-impact gaps requires ~80px/gap of
descent (mostly in the ridden portion — downhill support), a family the
flat/rising carrier basis does not produce. **Declared next mechanism
(next session): attempt-spanned DESCENDING-CARRIER variants —
post-contact support pitched downhill, pressure continuous in (next
speed ask − predicted arrival speed) and air ask; normal candidates
preserved; unchanged evaluator/ranker/width-judge; knee guards per the
standing panel discipline.** Sizing: the both-bad tail ≈ 52k gaps
(believer 10.8k, dense_dialogue 7.5k, dense-recovery 5.8k, pickups
3.8k) plus its share of the knee validity pool; estimate +8–15 if the
family converts.

## Declared Mechanism: Deficit-Pressured Energy-Launch Descent (2026-07-16)

**Hypothesis.** The sampler's energy-targeted launch already computes the
descent that converts carried speed into the gap's speed target
(`dh=(vT²−vIn²)/2g`, attempt-spanned via ccSpanBlends.launch), but its
descending clamp (`vy ≤ 0.45·g·N`) caps the drop at ~0.95·g·N² (~73px at
21f ⇒ +~1.1 px/f at entry 11) — LESS than the ~1.2 px/f an impact-0.8
catch costs. That single constant is why the pool contains no
speed-holding candidates at fast entries (max ΔV −0.305) and why the
both-bad passages leak for ~7 gaps. Extending the clamp under continuous
speed-deficit pressure (smoothstep in vT−vIn; extension 0.45→1.0 at full
pressure ⇒ up to ~1.5·g·N² ≈ 115px) enables the EXISTING energy law
exactly where the demand is authored; the unchanged
gates/evaluator/ranker/width-judge decide survival and price the k+1
consequence.

**Boundary:** the one clamp expression in arc_placement.ts's
energy-targeted launch; continuous inputs (vT, vIn, g, N); extension=0
restores byte-identity. **Falsifiers:** (1) believer/dense_dialogue
24-seed 500k: speed RMS must improve ≥0.01 with impact not worse (the
both-bad tail is the target); (2) 24-seed knee guard
(dense/dense240/pickup 250k validity no-worse); (3) 12×2 500k panel
coherent; (4) stage-0 positive. Else discard.

**Outcome: DISCARD at falsifier (1)** (extension=0 byte-identity proven;
24 seeds × 500k): believer speed RMS WORSE +0.0105, score −2.65;
dense_dialogue +3.98 but speed −0.0038 under the bar. **The measured
lesson — the catch-toll identity:** a steeper energy dive arrives faster
but STEEPER, and the catch's redirect cost scales as v·Δθ — the extra
arrival angle consumes what the dive gained. The 0.45 down-clamp was
load-bearing physics, not an accident. Energy can only be banked through
a redirecting chain if it arrives HORIZONTALLY: descend-then-flatten
support (a J-valley carrier — downhill rail curving level before
release, converting drop into vx with no arrival-angle toll) is the
remaining untested geometry for the both-bad tail. That is a
carrier-shape family build (cf. the smooth-continuation-carrier
retirement's constraints: capture-geometry independence must be proven),
declared as the next session's candidate. Reverted.

## Terminal: J-Valley Falsified by the Adhesion Limit; the Levers Merge (2026-07-16)

The J-valley oracle (`scripts/v0/study_jvalley_carrier.ts`, believer36/69
fixtures, 200 raw-normal + 600 J-profiles per state, unchanged
`tryCandidateLines`, artifacts `generated/studies/jvalley-carrier/v1/`)
falsified the support-side energy bank with a measured physical cause:

- The family DOES bank speed (+0.45–0.65 px/f median arrival) — but at
  believer69 every variant arrives ~9° steeper with worse current-gap
  impact/air, and **zero of 581 chained J-candidates dominate the
  raw-normal frontier** (arrival speed ≥ p90 AND angle ≤ median).
- Per-row release data shows why: even "flat-exit" profiles release at
  the pitch-down knee after 3–5 grounded frames with vy +2–4 — the rider
  never reaches the flatten. **The convex-curvature adhesion limit
  (rails push, never pull; κ ≤ g/v² ⇒ turn radius ≥ ~570px at 10 px/f)
  makes local downhill steering impossible inside a 19-frame gap** —
  every J-profile degenerates into a dive, i.e. the catch toll again.
- Energy audit at the hot gaps: air 0.64 mandates ≥12 airborne frames ⇒
  arrival vy ≥ ~2.1 ⇒ arrival angle ≥ ~12° regardless of geometry; the
  measured ~10 px/f equilibrium is where flight-drop + ride-grade gains
  exactly balance the catch toll. Support-side geometry cannot shift it.

**Synthesis: the both-bad-tail lever and the equilibrium-price lever are
the SAME mechanism.** The only remaining route to holding near-max speed
through authored air+impact chains is converting the MANDATED vertical
arrival energy into horizontal exit speed AT THE CATCH — an accelerating
catch — which is exactly the catch-frontier oracle's entry-incidence
family (entry rotated into incoming velocity, contact +1–2.5px low,
near-zero post-turn), whose net-positive-at-k+1 subset carries the
measured arrival signature (arrival speed ≥ ~9.6 px/f, angle +9–14°,
long run-out; frontier-continuation study, 7/24). **Next mechanism, one
build: the signature-gated entry-incidence catch lane** — proposes only
candidates whose ballistically-predicted next-arrival passes the
signature (continuous inputs; zero extra sim via the existing arrival
propagation), modest share, composed with the certified width judge that
can now see the k+1 difference. It targets the equilibrium price AND the
energy chains with the same geometry.

**Outcome: DISCARD — the fourth independent falsification of
frontier-catch supply.** Built as declared (attempt-spanned 18% share ×
ask ramp × 300k budget ramp, arrival-signature gate ≥0.5 from the
closed-form ballistic propagation, entry rotation 12–30° into incoming
velocity + 1–2.5px contact drop, carrier untouched, SHARE=0
byte-identity and 250k identity both proven, 26/26 tests). 24-seed
target check: believer −1.39 with impact WORSE (+0.0022), speed flat;
dense_dialogue +3.88 (speed-driven). Full 12×2 panel: **−9.05 with all
three axis RMS worse**, validity flat, worst rows river_reentry −81 /
dense −67. Reverted. The supply ledger is now: blind 45% share (−7.52),
composed with recency leaf (−13.31), additive standalone catch (v3), and
signature-gated 18% under the certified width judge (−9.05) — four
deliveries, one conclusion: **the frontier catch geometry loses the
exact forward evaluation even when its predicted arrival passes the
measured net-positive signature; the k+1 price the judge sees is real
for the candidates the sampler can actually build.** The merged-lever
route through sampler supply is closed. What remains open for the
impact pool is unchanged in kind but narrower in statement: a judge that
values the realized two-gap outcome exactly (not an m-sample estimate —
harvested; not a sharper window — falsified), or compiler geometry
beyond the entry/carrier parameterization the oracle explored. The
campaign's certified gains stand at 492.54 → 510.37.

## Declared Mechanism: Buyable-Error Repair Targeting (2026-07-16)

**Evidence.** Repair-phase characterization (canonical archive aggregates +
one LR_REPAIR_LOG probe): repair consumes 46.0%/58.8% of the 500k/750k
budgets; of frames actually spent, 57–64% go to failed re-searches; on
believer seed 24 @500k, round 0 attacked a buyable impact gap (err 0.90,
below bound) and banked +21.4, then three rounds burned 132k frames (26%
of the whole budget) failing on gap 67 — inside the authored joint-demand
cluster the energy anatomy proved physically over-constrained.
`pickFeasibleWeakGap` ranks by raw axis-error², which is largest exactly
where the physical bounds bite (high-ask impact, sub-floor air), so
repair systematically buys unbuyable error.

**Hypothesis.** Ranking repair targets by BUYABLE error² — per axis, the
error share below the gap's stored physical bound (impact:
`feasibility_bound`/`ceiling` already in the report; air: the detector
floor `MIN_LANDING_AIRBORNE_FRAMES/gapFrames`; elevation: stored ceiling;
speed/amplitude unbounded) — reallocates the failed-restart frames to
gaps where improvement is physically purchasable, raising repair ROI on
every source with bound-limited weak gaps. Continuous physical inputs
only; traversal policy only (`pickFeasibleWeakGap`); monotone by
construction (repair accepts only strictly-better complete tracks — the
mechanism cannot invalidate a run, only reallocate effort).

**Falsifiers:** (1) believer seed-24 probe must retarget away from the
unbuyable cluster with net repair dScore not lower; (2) 24-seed 500k
believer/dense_dialogue/river_reentry: mean score not worse, impact RMS
improved on believer; (3) 24-seed 250k dense/dense240/pickup validity
no-worse (repair runs at 250k); (4) stage-0 positive. LR_REPAIR_BUYABLE=0
escape restores byte-identity.

**Outcome: DISCARD at falsifier (2).** Falsifier (1) passed vividly
(seed-24: retargeted to a buyable impact gap, net accepted +33.2 vs
+24.1; escape reproduces the old rounds exactly), but the 24-seed panels
are a wash: believer −0.14 (se 1.14) with impact RMS +0.0003 (unmoved),
dense_dialogue −0.31, river_reentry −0.33, knee byte-identical.
Mechanistic residue worth keeping: repair's failed rounds are NOT caused
by unbuyable axis targeting — the weak-gap ranking is dominated by
UNBOUNDED speed errors at the same structurally-hard passages under
either metric, so restarts fail there regardless of which axis flagged
them. The repair-allocation lever, like selection before it, is
equilibrium-tight; its failed-restart frames are the price of searching
hard passages, not a targeting bug. Reverted (total cost ~40 min).

## Terminal: Expansion-Order Regret Is Nil — the Judge Program Closes (2026-07-17)

`scripts/v0/study_expansion_regret.ts` (observation-only hooks, byte-identity
of observation proven exactly; 4 sources × 2 seeds @500k, 366 matched
committed contacts): **the search commits the forward-eval rollout's
rank-0 branch 94.7–100% of the time**; the 8 exceptions are six exact
forward-value ties and two near-ties (0.04/0.29 on a ~500 scale).
Backtracking never overturns the rollout's ordering. With the recency
leaf (sharper valuation) falsified, the width family harvested at its
local optimum, and supply falsified in four deliveries, this closes the
selection axis at every level: pool → rank → expand → commit agree, and
where they differ it is a tie. **The campaign's former single open
problem — "a judge that reads realized downstream quality" — is resolved
negative by measurement: there is no selection prize left at any layer.**
The impact/air residue is therefore entirely a GEOMETRY-CONTENTS question,
and every explored geometry family is individually falsified with a
measured physical cause (catch-toll, adhesion limit, arrival foreignness,
pool-share displacement). The sole remaining route to 550 is the
trajectory-synthesis program: multi-gap-coherent geometry outside the
entry/carrier parameterization — a physics/geometry research build, not
an iteration. Retained instruments for it: the frozen fixtures
(dense240/ordinary/frontier5/believer36/believer69), the catch-frontier
and J-valley oracles, the frontier-continuation protocol, and this
regret study.

**Declared entry point for the program (next session): GRADE CONTINUITY.**
The slow-chain anatomy requires +0.1–0.3 px/f per gap COMPOUNDING across
~7-gap passages; each gap's share is individually legal (well within the
catch-toll and adhesion envelopes — no single-gap physics is violated),
but per-gap INDEPENDENT sampling regresses grades to the mean, so
persistent shallow grades are structurally absent from every chain the
search can build. Mechanism: correlate each gap's sampled post-angle
distribution with the PREVIOUS gap's committed grade (continuous
measured input; attempt-spanned so uncorrelated samples remain; no case
identity; evaluator/ranker/judge untouched — and the regret study now
guarantees the faithful rollout will select realized-better chains if
they exist). Falsifier chain: (1) fixture oracle on believer36/69 —
does a grade-correlated candidate sequence hold speed through the
cluster where independent sampling loses it (replay the two-contact
protocol across 3+ gaps); (2) attempt-spanned sampler form; (3) the
standard panels/knee guards; (4) stage 0; (5) certification.

## Retired: Attempt-Spanned Grade Continuity (2026-07-17)

**Hypothesis and boundary.** On a deterministic 25% normal-sampler attempt
span, blend the post-contact terminal grade toward the actual preceding
committed terminal grade when that grade is shallow and measured entry speed
is below the authored speed ask. This changes only the ordinary post-angle
candidate distribution; inputs are continuous (prior grade, speed deficit,
attempt coordinate), normal samples remain, and the unchanged exact gates and
ranker choose every fit. Discard if the fixed V2-jolt/500k panel (dense,
dense-240, pickup, frontier5, representatives, Believer; two seeds) is not
coherently positive or has any knee validity loss.

**Cheapest evidence first.** Fresh current-tree `believer36/69` fixtures were
captured, then `study_grade_continuity.ts --trials=96` ran the exact admission
and local-cost chain oracle (364k simulated frames, 2.4s). It demonstrated a
real but narrow construction: believer36 completed 17/96 five-contact chains
versus 0/96 independent; believer69 was nearly neutral in terminal speed
(−0.076 px/f) despite 45 versus 37 completed chains. The source form then
ran the 12-source × 2-seed V2-jolt/500k panel twice with
`study_impact_scope_panel.ts` (~12.1M frames/arm, about four minutes total).

**Decisive evidence and decision.** The enabled panel averaged **−2.14
points/row** with validity unchanged. It had genuine local gains (e.g.
dense-240 +21.09/+12.70) but material cross-regime losses: Believer seed 25
−44.81, loose_pocket −28.62/−9.98, pickup −25.69, frontier5 −16.16, and
ordinary quality regressions. This fails the declared broad-composition
condition; do not tune shares or gates, run Stage 0, or certify it. The
source experiment was committed then reverted (`5ca8093`, `a007a16`);
`study_grade_continuity.ts` retains the executable oracle. Workflow note:
the panel utility writes its artifact only after every sequential compile, so
partial streamed rows are not evidence. **Next:** grade persistence alone is
closed; a successor must supply multi-gap-coherent geometry beyond copying a
single predecessor grade, with a new fixed-fixture physical oracle before
another compiler lane.

**One bounded implementation check (declared before rerun).** The retained
oracle's construction preserves every line through the contact anchor and
re-realizes only the post-contact tail. The retired source form instead set
the sampler's terminal post-angle, which changes the full contact-to-release
curve and therefore did not implement the oracle's physical intervention.
This is a distinct delivery boundary, not a share/gate retune: test one
tail-preserving implementation with the same 25% span, prior-grade and
speed-deficit laws, normal pool, exact gates, and 12×2 V2-jolt/500k panel.
Discard it if the panel is not coherently positive or any knee validity falls;
then grade continuity closes in all delivery forms without Stage 0.

**Tail-preserving outcome: DISCARD.** The exact oracle-faithful form preserved
the sampled prefix through the contact anchor and altered only the tail; it
ran the same 12-source × 2-seed V2-jolt/500k panel (~12.1M frames, two
minutes). Mean movement was **−9.84 points/row**, validity unchanged. The
construction generated local wins (dense_dialogue_impact_contrast +36.07,
split_signal +12.04) but broad losses were larger: loose_pocket −76.64,
split_signal −39.57, dense_dialogue −37.26, Believer −33.57, pickup −30.43,
and frontier5 −19.38/−25.26. Thus the prior source rejection was not merely
contact-prefix collateral: both full-post-angle and capture-preserving-tail
delivery fail broad composition. Reverted without Stage 0; **grade continuity
is closed in all tested delivery forms.**

## Declared Study: Cumulative Kinetic-Energy Phase (2026-07-17)

Grade continuity copied one predecessor terrain tangent and is closed. The
slow-chain evidence instead suggests a stateful **energy** control: each
committed contact exposes exact entry speed, and the current authored speed
ask defines a continuous signed deficit. A bounded exponentially decayed sum
of those deficits can request a small *distributed post-tail work* adjustment
on a deterministic minority of otherwise normal candidates. This is not a
prior-grade lane: the state is a multi-contact kinematic integral, starts at
zero, decays after every committed contact, and is updated from exact measured
state plus the current authored speed only. The tail realization holds the
contact anchor, segment lengths, and first post tangent fixed while solving a
smooth curvature field for the requested mean gravitational-work grade.

**Cheap decisive test first.** A frozen WASM/500k believer36/69 chain oracle
will compare the fixed controller against independent normal sampling at equal
24 candidates/contact and ordinary exact admission/local-cost selection. It
must improve complete five-contact chains **and** terminal speed on both
fixtures without higher simulated-frame cost. Any split result, or no
improvement over independent sampling on either state, retires this controller
before a source-default implementation. Only a pass would authorize one
attempt-spanned normal-sampler delivery, the fixed V2-jolt/500k scope panel,
then the ordinary funnel; no constants will be selected from oracle output.

**Outcome: RETIRE at the fixture falsifier.** The expanded executable oracle
(`study_grade_continuity.ts`, schema v2) replayed independent, predecessor-
grade, and cumulative-energy streams for 96 trials on each current-tree
fixture (523k simulated frames, 3.3s). The energy stream failed believer36:
**0/96** complete chains versus the grade control's 17/96 and independent
0/96, with terminal speed **−0.041 px/frame**; only three transformed fits
were selected. Believer69 had a narrow local movement (41/96 chains versus
37/96 independent; terminal speed +0.049) but cannot counter the first
fixture. This is the declared split-result discard, not a reason to tune
decay, work magnitude, share, or an initial state. No compiler source,
scope panel, Stage 0, or certification is authorized. **The cumulative
kinetic-energy phase controller is retired.**

## Declared Study: Contact-Phase Continuity (2026-07-17)

The closed grade and energy controllers changed a release surface. A separate
state-history variable remains: the exact terrain contact occurs at a
continuous tangent-frame offset from the predicted sled point. The C1 capture
assay established that bounded phase changes collision closure; normal sampling
still redraws its contact anchor independently at every contact. This study
tests whether retaining that **contact phase** across a committed chain exposes
a stable physical basin without reusing a terrain grade, speed integral, pose,
or future target.

On the same 25% deterministic attempt span, a candidate's whole normal
contact-centered line set is translated only along the current incoming tangent
so its contact vertex blends toward the preceding committed contact's measured
phase in reference-speed frames. Shape, line lengths, collision side, authored
axes, and the ordinary exact gate/ranker are otherwise unchanged. A missing
preceding phase is ordinary absence, never a synthetic zero-phase anchor.

The fixed WASM/500k believer36/69 five-contact oracle compares this stream to
the retained independent control at equal candidate and frame budgets. It must
improve complete chains and terminal speed on **both** fixtures; an absent,
split, or higher-cost result retires the phase mechanism with no share/phase
range tuning, compiler source, scope panel, or V2 funnel.

**Outcome: RETIRE at the fixture falsifier.** The same executable control
oracle (schema v3) replayed all four streams for 96 trials per fixture (685k
simulated frames, 4.5s). Contact phase produced **0/96** complete believer36
chains, unchanged from independent and far below the retained grade control's
17/96. Its partial-terminal speed was +0.370 px/frame, but that readout has no
chain and is therefore not physical evidence of a viable route. Believer69 was
also neutral on completion (37/96 versus 37/96 independent), despite +0.164
terminal speed. This is the declared absent/split discard: do not turn the
partial speed movement into a phase range, a source lane, or a selection
experiment. **Contact-phase continuity is retired.**

## Declared Study: Incoming Airborne-Phase Continuity (2026-07-17)

The three retired continuity controls carried geometry (terminal grade or
contact anchor) or a speed-debt integral. They did not carry the exact
**detector phase** created by the preceding committed geometry: at an incoming
target, `PlanningState.phase.airborneAgeFrames` is the physical number of
consecutive airborne frames already accrued. That state is what separates a
legal return window from the 1--5-frame dense-240 detector-floor failure; it
is not the prior geometric contact phase.

**Hypothesis.** On the same deterministic 25% normal-attempt span, when the
exact incoming airborne age is below six, shorten only the sampled
post-contact tail by a bounded continuous factor. The collision-side geometry
through the contact vertex and its first outgoing segment remain byte-for-byte
unchanged. This uses the actual incoming phase alone—no next target, source,
case, seed, duration branch, outcome, or selection rule—to make the following
release phase less likely to drift into another short/illegal window.

**Cheap decisive test first.** The frozen WASM/500k believer36/69
five-contact oracle will compare this stream with the retained independent
normal stream at equal 24 candidates/contact and ordinary exact
admission/local-cost selection. It must improve complete chains and terminal
speed on both fixtures without higher simulated-frame cost. An absent, split,
or worse result retires the controller with no tail-factor/share sweep, source
lane, scope panel, Stage 0, or certification. A pass authorizes only a
separately declared attempt-spanned sampler form through the standard V2
funnel.

**Outcome: RETIRE at the fixture falsifier.** The expanded executable oracle
(`study_grade_continuity.ts`, schema v4) replayed all five streams for 96
trials on each frozen fixture (845k simulated frames, 5.8s). The airborne
controller completed **0/96** believer36 chains, unchanged from independent,
and **37/96** believer69 chains, again exactly independent; terminal speed was
unchanged to the reported precision on both. This was an active arm, not an
absence artifact: 66 phase-shortfall tail proposals were generated (pressure
0.074--1.0), but **0/66** survived ordinary exact admission. The attempt to
shorten a sampled tail after the preserved first post-contact segment therefore
cannot form a legal competing normal candidate at these exact multi-gap
states. Do not sweep the tail factor/share or make a source lane. **Incoming
airborne-phase continuity is retired.**

## Active Transition Evidence

The read-only [observed transition packet assay](observed-transition-packet-assay.md)
now binds its observations to the final selected normal path rather than a deep
search visit. At WASM/500k it found exact finite capture boundaries in ordinary,
normal/shifted pickup, and every 3--7 second low-air ladder member: two to four
of the selected current fit's lines reproduce the final engine state through
the measured response boundary. Independent ordinary and 5-second
output-neutrality controls were bit-identical with and without observation.

Dense and dense-240 are explicitly unavailable: their final selected paths end
before the declared contact. This is a useful separation. A later
capture-preserving release experiment may use only the observed non-dense
boundary; it must not borrow a different dense visit or grow a dense-specific
fallback. The next mechanism has to compose capture and release jointly for
dense, while testing whether a sealed observed response can improve outgoing
geometry on the covered continuous spectrum.

## Retired: Fixed Global Normal-Pool Breadth (2026-07-15)

**Hypothesis.** At 500k, the normal solver samples 29 candidates per gap.
Increasing that fixed breadth to 36 might let the unchanged exact evaluator
and ranker discover better ordinary trajectory basins across dense, pickup,
low-air, representative, and development-music work, without adding a new
candidate lane or case-specific rule.

**Scope and Stage 0.** The V2-jolt/seed-24 500k scope had four gains: dense
`+22.78`, pickup `+23.50`, low-air `+4.41`, and development music `+38.73`;
dense-240 `-10.07` and Countercurrent `-4.11` lost. At 250k, pickup became
valid (`0 -> 404.16`) and low-air gained `+15.12`, but Countercurrent lost
`-18.45`; dense-240 remained invalid. The full 264-compile Stage 0 resolved
the hidden trade-off: headline `483.49 -> 478.38` (`-5.10`), 250k `-39.39`,
representative `-10.86`, legacy `-15.39`, and validity `+3/-10`. The 500k
cell alone was `+8.61`, but that is not a justification for starving the
scarcer profile or accepting dense/low-air capability losses.

**Decision.** Retire fixed global breadth; do not search nearby constants.
The same charged expansion that improves selected mature rows harms the
broader traversal allocation at 250k. Any future breadth work must use a
measured, budget-aware reason to allocate search effort, not a global count
override.

## Retired: Direct Ballistic State-Transition Slots (2026-07-15)

**Hypothesis.** Four fixed normal sample slots could be replaced, at unchanged
sample count, by a state-relative contact/support polyline. It used incoming
target state, current impact, outgoing air/speed, and the next interval in
frames; it had no case or duration branch. The existing exact evaluator and
ranker remained unchanged.

**Scope result.** V2 jolt (`-15ms`), 500k, fixed development seeds:

| Source | Delta | Outcome |
|---|---:|---|
| dense | -35.67 | valid, worse speed quality |
| dense-240 | -12.17 | valid, worse quality |
| pickup | -3.80 | valid, worse quality |
| 5s low-air | -28.88 | valid, worse air/speed quality |
| Countercurrent | -4.46 | valid, representative regression |
| Believer | +46.83 | speed improvement only |

**Decision.** Retired before stage 0. The isolated Believer gain is not a
license to tune the source toward that score. A ballistic desired launch angle
does not specify the exact collision response, so direct state-to-geometry
mapping is not an adequate normal generator.

## Retired: Capture-to-Continuation Orientation Field (2026-07-15)

**Hypothesis.** Replace the aim lane's permanent whole-arc orientation change
with a capture-oriented field that relaxes through the normal sampled
post-contact carrier. It used the sampler's existing geometry boundary, added
no lines, replay, case identity, or duration category, and left exact
evaluation and ranking unchanged.

**Scope result.** At V2 jolt (`-15ms`), 500k, seed `3000000000`, it improved
dense-240 `+13.78`, pickup `+14.67`, 5s low-air `+6.82`, and Believer `+25.37`;
dense `-3.67` and Countercurrent `-1.35` remained valid but lost quality. Two
alternate formulations were also rejected locally: a pure post-contact bend
lost capture authority, and resampling the carrier introduced collision
boundaries and invalidated five of six scope rows.

**Stage 0.** The comparable 264-compile probe completed against the accepted
baseline: headline `483.49 -> 486.81` (`+3.32`), validity `253 -> 252`.
Representative was `+3.42`, capability `+68.99`, legacy `-7.16`, and
development music `-174.24`. The adverse case movement was concentrated and
material: `believer_56_6s -266.14` (valid `6 -> 4/6`) and
`frontier_dense_recovery_240ms_figures -232.45` (valid `3 -> 2/6`).

**Decision.** Retired without fresh certification. A continuous orientation
field is not enough to decouple capture alignment from outgoing quality at the
current two-knob/probe budget. Keep the result as a constraint on a future
transition source, not as a default or a capability-only repair.

## Retired: Global Impact-Curvature Recalibration (2026-07-15)

**Hypothesis.** The normal sampler's global impact-curvature constants had
been calibrated before the current constrained-traversal baseline. A small,
ordered family could test whether its current centre `(flatten, frontload) =
(18 degrees, 1.6)` should move, without adding a case, duration, or
post-failure branch. The two frozen endpoints were a softer `(12 degrees,
1.2)` law and a stronger `(24 degrees, 2.0)` law; both used the same normal
candidate pipeline and exact evaluator.

**Family result.** A six-seed-per-budget, fresh shared exploration epoch at
250k and 500k compared both endpoints with the unchanged centre. The soft
endpoint was the observed champion but was decisively harmful: headline
`-23.15` (SE `3.98`), validity `-7` (`+3/-10`), representative `+2.24`,
capability `-170.01`, legacy `+6.69`, and development music `+2.26`. The
strong endpoint was worse still: headline `-55.77` (SE `5.72`), validity
`-17`, representative `-35.39`, capability `-164.04`, legacy `-25.15`, and
development music `-77.64`. The soft endpoint led at all 2-, 4-, and 6-seed
prefixes, so this is not an adaptive-selection ambiguity.

**Decision.** Retired without selection or certification. The evidence does
not prove a mathematical optimum, but it rules out these broad global moves
on the current geometry. Retain the centre as the default. Revisit impact
curvature only if a structural transition source changes the measured
collision-state basis, and calibrate that source as a new bounded family.

## Accepted: Constrained Handoff Traversal (2026-07-15)

The committed compiler tree differs from the frozen V2 baseline through the
continuous support work, constrained-contact traversal, and two current
traversal policies. Its first V2 stage-0 screen is `+20.76` headline
(`462.73 -> 483.49`), with 10 validity gains and no losses. It is not a
promotion result: the three probe seed slots have a one-sided lower bound of
`-0.33`, so the certified depth-48 evaluation remains necessary.

Before spending that evaluation, three bounded ablations used the same V2
probe cells. They are attribution diagnostics only: shared seeds mean they
must not be used to select or promote a member. They do establish that the
candidate is not merely a single capability rescue.

| Variant | Headline delta | Validity | Representative | Capability | Legacy | Development music |
|---|---:|---:|---:|---:|---:|---:|
| Current default | +20.76 | +10 / -0 | +6.21 | +84.38 | +8.41 | +58.27 |
| Before the current traversal commit | +12.75 | +8 / -0 | +0.00 | +84.97 | +0.00 | +0.00 |
| Current commit, nearest-anchor repair | +15.23 | +10 / -0 | +0.41 | +84.67 | -0.28 | +45.41 |
| Current commit, full joint aim at all budgets | +18.07 | +8 / -0 | +5.62 | +84.65 | +8.83 | +11.10 |

The continuous support/constrained-contact work supplies the capability
recovery. The older-anchor traversal order supplies the broad representative
and legacy movement, especially at 500k. The scarce-budget pitch-first aim
policy changes only the 250k allocation and adds a smaller complementary gain.
Both policies depend on budget and normal search state, rather than case
identity or a duration bucket. Their full geometry continues through the
ordinary evaluator and ranker.

**Certified outcome.** A fresh depth-48 epoch accepted the default: headline
`469.11 -> 492.54`, delta `+23.43`, with a 99% one-sided lower bound of
`+18.52`. It gained 158 valid rows and lost 26. The effect is not limited to
the capability rows: representative `+7.28` (99% lower `+2.85`) and legacy
`+4.83` (99% lower `+2.57`); capability was `+119.36`. Development music was
unresolved (`-1.19`, wide interval) and remains a monitoring signal rather
than an acceptance claim. The independent 120-row qualification sidecar also
completed before the verdict. Rebaseline label:
`accept-2026-07-15T15-24-50Z-e4890b0e`.

## Historical: Prior Transition Hypothesis

Build a bounded **collision-conditioned transition source** for fixed normal
slots. It must retain a normally generated capture as the collision proposal,
read only the exact response state from that capture, then derive the outgoing
support from that measured state and the immediately outgoing authored axes.
The final full geometry must still be re-evaluated from the original prefix
through the ordinary candidate gates and ranker. It is not a post-failure
repair, a selector override, or a target-specific template.

Before implementation, establish one small executable invariant: response
state extracted from the capture-only geometry must agree with the same prefix
of the final geometry through the response boundary. If the invariant cannot
hold without materially increasing fixed-budget work, retire this direction
rather than adding a hidden two-pass search.

## Retired: Scorer-Window Local Ranking (2026-07-15)

**Hypothesis.** A candidate has two measured axis readouts when its local
lookahead crosses the next contact: `achievedAtEnd`, measured in the completed
gap's scorer window, and `achieved`, measured in the longer lookahead window.
The final handoff scorer already reads `achievedAtEnd ?? achieved`; the pool
ranker and local candidate cost did not. This family tested whether making
those local decisions use the scorer-window readout would make normal search
selection agree with the final contract, while leaving the ballistic
next-contact readiness term intact.

**Family result.** A fresh shared six-seed-per-budget exploration epoch at
250k and 500k compared two frozen forms: `current-window` changed only the
quality ranker's current-axis term, while `all-local` also changed the local
candidate cost. `current-window` was negative (`-2.83`, validity `+4/-8`).
`all-local` was the stable observed family leader at 2-, 4-, and 6-seed
prefixes and beat `current-window` by `+12.53` (95% paired interval
`[-17.57, -7.48]` for current-window minus all-local). Its headline movement
against the accepted source was `+9.70` (SE `7.37`), but its composition was
not acceptable for promotion: representative `-3.97`, legacy `-5.91`,
capability `+83.26`, and validity `+6/-5`. Its largest gains were the two
frontier capability sources; normal sources such as `dense_dialogue` lost
`-36.57`.

**Decision.** Retired without selection or certification. This was a useful
semantic experiment, not evidence that either measurement window alone is a
general local objective. The lookahead readout contains continuation signal
that normal search currently relies on, while the scorer-window readout is the
right measure of completed-contact quality. The next design must represent
those two roles explicitly rather than globally substituting one window for
the other.

## Retired: Dual-Window Pareto Admission (2026-07-15)

**Hypothesis.** The scorer-window study showed existing candidate pools often
contain lower-impact alternatives that are not admitted to the eight-candidate
handoff pool. A priority assay over 3,641 exact-prefix pools found 1,329 such
alternatives at a no-more-than-`2.5%` readiness trade-off; only `80.5%` were
admitted. Rather than weight the two measurement windows or add candidates,
this family kept the pool size fixed and ordered valid candidates by Pareto
layers over two scale-free objectives: scorer-window current quality times
ballistic readiness, and lookahead continuation quality times the same
readiness. The unchanged exact forward evaluator then chose branches.

**Family result.** A fresh shared six-seed-per-budget epoch at 250k and 500k
compared two deterministic within-layer orders. `pareto-extremes` put the best
rank in either objective first; `pareto-balanced` preferred the best worst
rank. The observed final leader was `pareto-balanced` at `+1.60` (SE `4.52`,
90% lower `-6.63`), with representative `+0.63`, capability `+7.15`, legacy
`+3.55`, and development music `-5.45`; validity was `+7/-5`. The leader was
not stable: `pareto-extremes` led at two seeds, while `pareto-balanced` led at
four and six. Their pairwise difference was unresolved (`-1.97` for extremes
minus balanced, 95% interval `[-9.05, +5.11]`).

**Decision.** Retired without selection or certification. The assay was real:
the normal pool has missed local alternatives, but fixed-width rank
permutations alone neither create a stable broad gain nor protect all normal
regimes. Preserve the evidence and move the effort back upstream to a normal
trajectory source that changes the available collision/transition geometry;
future admission work should be evaluated only alongside such a source.

## Retired: Smooth Post-Impact Continuation Carrier (2026-07-15)

**Hypothesis.** The ordinary post-contact carrier currently encodes the
initial collision response and the remaining travel with the same short
polyline. Preserve the response prefix for the continuous distance travelled
in one fixed impact window, then realize the remaining equal-length,
equal-segment tail as a midpoint-chord arc. This changes normal geometry only:
there is no case identity, duration bucket, rescue path, or ranker override.

**Scope result.** At the V2 jolt, 500k, and one fixed seed, the six-source
panel was positive and valid: the two Believer rows gained `+2.13` and `+2.17`,
impact Believer `+11.27`, dense contrast `+23.47`, dense recovery `+35.40`,
and pickup `+4.47`. That was sufficient only to justify an ordinary stage-0
screen, not a promotion claim.

**Stage 0.** The comparable 264-compile probe moved the headline
`483.49 -> 488.92` (`+5.43`), but the composition contradicted the scope
panel: representative was `-6.39`, legacy regression `-10.58`, and validity
was `+5/-4`. The apparent capability gain was volatile (`+72.50`): at 250k
both dense recovery and shifted pickup became wholly invalid. Material normal
losses included dense impact contrast `-97.70`, fast rising switch `-57.30`,
split impact relief `-21.67`, wide breaths `-16.91`, and regression amplitude
mosaic `-16.70`.

**Decision.** Retired without fresh certification and reverted from the
working compiler. A speed-scaled protected length is a reasonable physical
quantity, but it does not make the surviving carrier independent of the
capture geometry. A future source may use an explicit, engine-measured
transition state, but it must establish prefix/final trajectory agreement and
cross-regime stability before it changes the normal generator.

## Retired: Standalone Contact-Phase Primitive (2026-07-15)

**Hypothesis.** A state-relative, six-frame contact phase could replace the
normal capture for short intervals. It was constructed from only the immutable
prefix, current pre-contact state, current impact ask, and one fixed physical
control; later cadence, axes, targets, score, and outcomes were withheld. The
compact 24-control stencil and diagnostic 288-control oracle both crossed
chirality and one-way collision side. An independent detector/ownership
positive control exercised the same guard path.

**Fresh assay.** Under WASM and a fixed 500k prefix budget, the sealed five
state panel completed with the positive control passing and `1,560` observed
rows. It found zero structurally valid local captures in every state: dense,
dense-240, shifted pickup, ordinary representative, and impact-led music.
The result was not caused by a broken observation path: the artifact was
protocol-complete and every row was retained. The failures were principally no
owned capture event, incomplete persistence/impact windows, off-beat landings,
and, for many motion-facing arms, pre-event intrusion.

**Decision.** Retired as a compiler source. A bounded primitive generated
solely from pre-contact state cannot replace a valid collision capture. Do not
turn the oracle into a menu or loosen its guards. Dense work must retain an
already engine-admitted capture rather than invent a new standalone catch.

## Retained Constraint: Exact Support Is a Low-Air Actuator, Not a General Source (2026-07-15)

The fixed post-impact rail assay was recaptured under the current compiler
before interpretation. It is structurally valid as a local construction:
ordinary had four complete paired rows, dense-240 five, and the correlated
3--7 second low-air family had five to nine per rung. Across the low-air
ladder, a tangent-aligned rail consistently reduced local airborne samples by
about ten while moving mean CoM speed by only about `0.01`; the positive-turn
arm made a smaller air adjustment. That is a real support/occupancy lever.

It is not a general continuation source. The dense 9-frame state has no
post-response measurement horizon, and dense-240 changes only about one local
air sample. Therefore it cannot explain or solve the dense failures, and the
fixed rail stencil supplies neither a whole-gap speed law nor a candidate
selection rule. Keep it as a measured component constraint, not an additive
default.

## Historical: Prior Capture-Preserving Transition Hypothesis

Build a bounded **capture-preserving observed-transition source**. It starts
only from a normal candidate that has already passed exact current-contact
admission. The source then measures that capture's response state, proposes a
small continuation family from literal outgoing axes, and must prove that the
composite replay preserves the original physical trace, owned capture, and
impact response through the measured boundary. The ordinary evaluator and
ranker remain the only admission/selection authorities. A source unavailable
at short horizons is an ordinary absence, not a duration-specific fallback;
dense will require a later joint-capture formulation rather than forcing a
post-response rail into a nine-frame interval.

## Retired: Observed Tail-Surgery Transition Source (2026-07-15)

**Hypothesis.** A normal candidate can supply an exact current-contact capture,
after which its unobserved carrier tail can be replaced by a support segment
derived from the measured response state and the literal outgoing air/speed
axes. This is a continuous physical construction: no case identity, duration
class, or ranker override. Every composite was required to replay the original
position, velocity, airborne state, and owned capture through the response
boundary before ordinary candidate admission and charged forward ranking.

**Initial falsifier.** The append-only version produced 96 current-contact
fits on the 5-second low-air source at 500k/seed 0, but the current-gap
air-coverage gate discarded every one. That was an ownership error, not a
negative physics result: the proposal affects the outgoing interval, so it
must be judged by the existing forward evaluator rather than a current-gap
filter.

**Tail-surgery result.** The corrected form replaced the normal carrier tail
strictly ahead of the measured state and used two fixed response leads with a
small symmetric gravity-grade stencil. On the 5-second ladder, it generated
32 exact-admitted candidates (47 charged rankings) but none beat the normal
pool; the closest score delta was positive `9.6e-9`. A fixed 500k/seed-0
scope panel was unchanged on low-air endurance, dense recovery, pickup
progression, and Believer, while `dense_dialogue` improved `408.34 -> 413.12`
(+4.79, valid) and `open_hook` was unchanged. The dense result shows that the
state-boundary surgery is mechanically possible, but five unchanged sources
and no low-air or capability movement do not establish a broad compiler
source.

**Decision.** Retired before Stage 0 and removed from the compiler tree. Keep
the two constraints: (1) outgoing geometry cannot be screened by a
current-gap-only gate, and (2) an exact response-state continuation can alter
a normal dense trajectory without a target-specific rescue. A future source
must formulate capture and continuation jointly enough to create competitive
geometry on dense and low-air rows, rather than merely swapping the unused
tail of one normal candidate.

## Retired: Outgoing-Target Ownership For Post-Contact Terrain (2026-07-15)

**Hypothesis.** The normal sampler appeared to use the current interval's
target bag for terrain after its terminating contact, rather than the literal
outgoing bag. A source-default hand-off used the next gap's axes only for
post-contact length, launch, speed carry, air, elevation, and amplitude; it
left the evaluator and ranker unchanged.

**Stage 0 falsifier.** The full 44-source, 264-compile screen was unresolved
at only `+0.09`, but its composition is plainly unsuitable: 250k was
`-23.67`, representative `-10.19`, development music `-5.64`, validity
`+4/-6`, and dense musical `-101.43` with two validity losses. Capability
contained real movement (rapid pickup `+172.34`, low-air `+12.74`) but dense
recovery was `-63.31`; this is not a trade-off that the headline can justify.

**Design correction.** Inspecting the generated lines established that the
so-called post line begins *before* the target position and can own the
collision itself. The source therefore did not preserve current-contact
capture as claimed: it changed the capture surface while changing outgoing
controls. Do not tune an interpolation factor around that invalid boundary.
Any successor must locate or construct a genuinely post-capture boundary from
the engine trace, then prove capture ownership and replay agreement through
that boundary before it can reason about the outgoing interval.

## Declared Study: Joint Two-Capture Return Boundary (2026-07-17)

**Hypothesis.** The retained two-contact shooting result exposed an exact
capture→capture basin, while the later staged-support construction failed
because its rail exit was foreign to the downstream normal generator.  Those
are different components.  If both locally admitted capture arcs are
materialized as one candidate line-set from their exact checkpoint, the
component may close the dense transition and hand control back to the ordinary
normal sampler at the following authored contact.  This is neither a
standalone capture lane nor capture-plus-support: its second contact surface
is constructed from the exact first-capture engine state.

**Protocol, declared before new rows.** Calibration-only, WASM/500k, on the
existing frozen `dense`, `dense240`, and `ordinary` fixtures used by charged
two-contact shooting.  The screen is capture→capture only: fixed mirrored
24-control C1 capture arcs at k; for every k-admitted row, a fixed mirrored
24-control C1 screen from its exact k+1 state.  Each admitted pair is then
materialized as one line-set on the immutable k prefix.  At k+2, an equal
24-attempt production-normal stream runs unchanged from the exact pair engine.
All candidate admissions, recovery probes, and return-stream attempts are
charged with `getSimFrames()` and every pair row is retained.

**Falsifiers.** Retire this component boundary if (1) materializing the pair
changes either already-admitted contact; (2) no capture→capture pair restores
at least one normal admission at k+2 on either dense state; (3) its
joint-plus-return charge materially exceeds the equal-count normal stream
without a dense recovery; or (4) the normal control is not structurally
available, in which case the assay is invalid rather than negative.  A
positive calibration result authorizes only a separately declared shadow
source and the ordinary Benchmark V2 funnel; it does not authorize a control
selection or production default.

**Result (2026-07-17, `scripts/v0/study_two_contact_shooting.ts
--return-normal`, artifacts
`generated/studies/two-contact-shooting/return-boundary-v1/`): narrow
component RETAIN; source promotion NOT authorized.** The one-shot
materialization check passed for every pair (no line-set drift) and all
return-stream controls were structurally available. On dense, 5 capture→capture
pairs materialized; 4/5 regained at least one ordinary-normal admission at
k+2 (9 total admissions). This establishes that the two-capture component can
return to the normal generator rather than necessarily creating the foreign
rail-exit state that killed staged support.

It does not generalize to the adjacent dense-240 state: all 55
capture→capture pairs materialized, yet **0/55** produced a normal admission
at k+2. The control was present on every row, so this is not a missing sampler
path. Exact k+2 state telemetry explains it: every dense-240 pair was airborne
for only 1--5 frames (all below `MIN_LANDING_AIRBORNE_FRAMES=6`), whereas the
four returning dense pairs and all 117 ordinary pairs had 13. This is the same
detector-floor identity that closed the supported-composite program: a normal
landing cannot be recovered from this return state by adjusting its aim.
Ordinary was saturated (117/117 pairs with normal return; 2,418 admissions)
and contributes no new capability evidence. Moreover, the complete dense
capture screen cost 11.8k frames against the equal-count raw-normal family's
2.1k before any source-level candidate/ranking charge. The static screen is
therefore not a compact, continuous source control.

**Decision.** Do not integrate or tune a short-gap capture-pair lane. The
result preserves a physical component fact for dense, but the required
dense-240 return boundary is detector-illegal. Restoring it needs a sixth
airborne frame, i.e. a release/reservation architecture rather than a normal
aim residual; that is precisely the capped release form already shown to erase
the composite's unique value. A fixed control-menu source would also repeat
the closed static-capture delivery pattern. Do not pick the fixture's
successful menu entry or branch by case/duration.

## Declared Study: Capture-Preserving Ballistic Release (2026-07-17)

The two-capture return study closes the static-C1 form because its second
capture remains grounded until only 1--5 frames before dense-240's following
contact. The staged-support release cap proved that reserving the landing
window changes that state, but its grounded support corridor was the failed
component. This is a distinct bounded form: preserve the first and second C1
captures, then append a finite concave ballistic-release scoop from the exact
second capture exit; the scoop stops at its launch point. It is the normal
SLAM-HOP physical release law applied after a C1 capture, not a support rail,
tail sizing, or a static capture control.

**Protocol, declared before new rows.** Calibration-only WASM/500k on the
same frozen dense/dense240/ordinary fixtures and fixed mirrored 24-control
capture screens as the two-capture study. For every capture→capture pair,
derive the release angle continuously from exact post-capture speed and the
literal frames to k+2 (`vy = -g*N/2`), realize a fixed finite concave scoop,
and re-admit the complete second line-set through the unchanged exact gate.
Materialize the full pair plus scoop as one line-set, record exact k+2
airborne age, and run the unchanged equal 24-attempt normal stream at k+2.
All admissions and probes are frame-charged; the controller sees no case,
seed, target axes, or target-derived control selection.

**Falsifiers.** Retire if the scoop changes either owned C1 capture; if no
dense-240 pair reaches at least six airborne frames and restores a normal
admission at k+2; if the release arm is structurally unavailable; or if its
charged cost is materially above the normal stream without a dense-240 return.
A calibration pass authorizes only a separately declared source design and
the normal V2 funnel.

**Result (2026-07-17, `scripts/v0/study_two_contact_shooting.ts
--return-normal --ballistic-release`, artifacts
`generated/studies/two-contact-shooting/ballistic-release-v1/`): RETIRED;
no source promotion.** The fixed three-segment scoop re-admitted with
byte-stable second-C1 geometry and retained owned second capture on all 177
materialized capture→capture pairs (5 dense, 55 dense-240, 117 ordinary). The
construction was therefore available and its preservation boundary was tested,
not bypassed.

It does not pass the required dense-240 state boundary: **0/55** pairs restored
an ordinary-normal k+2 admission, and their airborne age remained only **0--4
frames** (zero pairs at the legal six-frame floor). The full dense-240
capture-release screen charged 8,861 frames, versus 814 for its equal-count
raw-normal family, without any return. This is the original detector floor in
the exact post-scoop state, not a missing normal-control path or a failed C1
re-admission.

The form also supplies no compensating component improvement. Dense remained
at 4/5 returning pairs but fell from 9 static-pair normal admissions to 5;
ordinary fell from 117/117 and 2,418 to 116/117 and 2,001. Do not tune scoop
length, segment count, or a fixture-specific turn direction: those would be a
case/control menu around a form that fails its declared dense-240 floor.

**Decision.** The capture-preserving fixed ballistic release is closed. It
proves that preserving both C1 captures is compatible with a post-capture
release geometry, but that geometry still releases too late to create the
legal dense-240 arrival state. No static C1 pair or fixed post-C1 scoop is an
authorized compiler source. A future multi-gap geometry proposal must name a
different state boundary and prove a six-frame dense-240 return before it can
enter the V2 funnel.

## Declared Study: Transient C1-to-Ballistic Bridge (2026-07-17)

The static pair and post-C1 release both commit the second contact to a
six-frame C1 response before terrain can end. Their dense-240 failure may
therefore be a *release-location* boundary, not evidence that the first C1
capture or a ballistic launch is intrinsically incompatible. This study uses a
different second component: retain the exact first C1 capture, but realize the
second event as a one-segment C1 approach into its predicted contact point
followed immediately by a finite concave scoop. The scoop's first tangent is
the approach tangent and its final tangent is the symmetric ballistic launch
for k+2; it stops there. Thus the k+1 collision and release are one transient
geometry, with neither a static C1 runway/response nor a grounded support
corridor after the event.

**Protocol, declared before new rows.** Calibration-only WASM/500k on the
same frozen dense/dense240/ordinary fixtures. Segment k remains the unchanged
fixed mirrored 24-control C1 screen. For each exact k capture, segment k+1
reuses that same fixed control screen only to derive its continuous approach
point and entry tangent from the exact extended-engine state. It emits one
approach segment and a fixed three-segment concave scoop; the launch tangent is
`atan2(-g*N/2, max(1, exact incoming speed))`, where `N` is literal k+2
interval frames. It reads no case, seed, target-gap axis, target outcome, or
control selection. The complete pair is admitted through unchanged
`tryCandidateLines`, materialized as one immutable-k line-set, and the
unchanged equal 24-attempt normal stream is observed at k+2. Every admission,
materialization, probe, and return attempt is frame-charged. The artifact must
retain the contact form and prove the first C1 lines are byte-stable under
one-shot pair admission; the second contact is deliberately transient, so it
is not compared to the retired static second-C1 geometry.

**Falsifiers.** Retire if the exact first C1 capture changes on
materialization; if transient k+1 geometry cannot pass unchanged admission;
if no dense-240 pair both reaches six airborne frames and restores a normal
k+2 admission; if the normal control is unavailable; or if the charged
capture bridge is materially above the equal-count normal stream without that
dense-240 return. A pass is only component evidence: it authorizes neither a
control menu nor a compiler source without a separately declared held-out
study and the ordinary V2 funnel.

**Result (2026-07-17, `scripts/v0/study_two_contact_shooting.ts
--return-normal --transient-bridge`, artifacts
`generated/studies/two-contact-shooting/transient-bridge-v1/`): RETIRED;
no source promotion.** This is not an unavailable construction. All 155
returned pair rows (7 dense, 19 dense-240, 129 ordinary) materialized as their
one-shot complete pair with no first-C1 line drift, and all k+2 normal controls
were structurally available. On dense-240, the transient geometry achieved the
timing objective on every pair: airborne age was **7 or 9 frames**, strictly
above the legal six-frame floor. Yet the unchanged normal stream admitted
**0/19** pairs and 0 normal admissions at k+2. The full dense-240 capture-bridge screen
charged 8,162 frames versus 833 for equal-count raw normal, with no return.

This gives a distinct negative from the retired static/preserve-and-release
forms: reaching a legal airborne age alone is insufficient; the transient
contact's exact speed/angle/state remains outside the normal generator's
arrival basin. Dense locally returned 7/7 pairs (73 normal admissions), while
ordinary returned 125/129 (1,874 admissions), but neither compensates for the
required dense-240 zero. Do not tune the three-segment length, turn direction,
or approach-control entry: those are a fixed-menu search around a component
that has already crossed the timing floor without restoring normal admission.

**Decision.** The fixed transient C1-to-ballistic bridge is closed. Future
work cannot claim detector-floor repair merely from airborne age; it must show
both legal phase and normal-arrival competence at dense-240 under exact pair
materialization. No compiler source, V2 scope panel, or certification is
authorized from this component.

## Declared Observation: Transient-Arrival Normal Gate Diagnosis (2026-07-17)

The transient bridge has isolated a useful state: dense-240 reaches the legal
7--9 airborne-frame arrival window but the unchanged normal stream still has
0/19 returns. Before proposing another geometry, determine which existing
normal admission boundary rejects those attempts. This is observation only;
it changes no candidate, control ordering, gate, ranker, or source default.

**Protocol, declared before rows.** Recreate the fixed transient bridge on the
same dense-240 fixture and retain its 19 materialized first-C1/bridge pairs.
For every unchanged 24-member k+2 raw-normal stream, install the existing
study-only landing-window hook around each individual admission call. Record
exactly one of: pre-target clearance rejection (no engine candidate probe),
survival failure, a first lockstep landing/off-beat acceptance width of 1--5,
or no such acceptance through width 5; retain offset when one exists. The
admitted count must equal the ordinary return study's count, and the hook's
records plus explicit clearance rejections must account for every generated
member. All engine calls remain charged by the existing runner; the hook is a
read-only measurement on its already-created detection.

**Interpretation bound.** This cannot relax the gate. A dominant clearance
failure would identify the target-relative normal placement boundary as the
next state-basis question; dominant survival would identify body-state
compatibility; width-only acceptance would identify timing/off-beat geometry;
no acceptance through width 5 would identify an absent collision/arrival basin.
No outcome authorizes a geometry change by itself.

**Result (2026-07-17, `scripts/v0/study_two_contact_shooting.ts
--case=dense240 --return-normal --transient-bridge --arrival-gates`, artifact
`generated/studies/two-contact-shooting/transient-arrival-gates-v1-smoke/`):
arrival-timing/basin diagnosis only.** The hook accounted for all **456**
generated normal members (19 materialized bridges × 24), and its width-1
admission count exactly matched the prior 0. There were no geometry-unavailable
members and **no survival failures**. Of the attempts, 68 (14.9%) rejected at
pre-target clearance; 81 (17.8%) had a lockstep acceptance only at width 3,
4, or 5 — exactly landing offsets +3 (19), +4 (42), and +5 (20) — while 307
(67.3%) had no lockstep acceptance through width 5. No member was acceptable
at the real width-1 gate.

**Decision.** Do not widen a landing window or infer an outcome-conditioned
anchor shift. The live dense-240 state does not die from body survival; its
ordinary normal placements are mostly late or collision-incompetent even after
the bridge supplies legal airborne phase. A future candidate basis, if any,
must derive an on-time contact geometry from the *pre-candidate exact arrival
state* and prove ordinary width-1 admission. The observed +3--+5 offsets are a
diagnostic, not a tunable target or a source-control menu.

## Declared Study: Recursive Transient-Bridge Continuation (2026-07-17)

The gate diagnosis does not license a normal-anchor adjustment, but it exposes
a sharper basis question: the fixed transient law has created a legal airborne
arrival state which the *normal* sampler cannot close. Test whether the same
state-relative transient C1-to-ballistic law can close one more contact from
that exact state. This is a recurring physical component, not a static pair,
post-C1 release, phase shift, or a normal-control rescue.

**Protocol, declared before rows.** On the frozen dense-240 fixture only,
replay the exact 19 materialized first-C1 + k+1 transient pairs. At k+2, derive
the same fixed mirrored 24-control approach screen from the pair engine's
exact planning state and realize the same one-approach/three-scoop transient
law, with its launch angle derived from literal k+3 interval frames. Admit
each member through unchanged `tryCandidateLines` at k+2. Every admitted third
component must then be re-admitted as the complete first-C1 + transient +
transient line-set on the immutable k prefix with byte-stable geometry. The
existing k+2 raw-normal stream remains an equal-state negative control. Charge
all k+2 and triple-materialization calls. No case, seed, outgoing target axis,
or selected control feeds the repeated law.

**Falsifiers.** Retire recurrence if no k+2 transient member admits on any of
the 19 exact pair states; if any admitted member fails triple materialization
or changes the earlier lines; or if the repeated component costs materially
above normal without admitting a triple. A nonzero triple result authorizes
only a separately declared k+3 normal-return and held-out continuation study;
it does not authorize a compiler source or a control selection.

**Result (2026-07-17, `scripts/v0/study_two_contact_shooting.ts
--case=dense240 --return-normal --transient-bridge --recursive-transient`,
artifact `generated/studies/two-contact-shooting/recursive-transient-v1-smoke/`):
component RETAIN; source promotion NOT authorized.** The 19 prior pairs were
all available and materialized. Their exact k+2 arrivals retained the legal
7-frame (7 rows) or 9-frame (12 rows) phase. The repeated fixed law admitted
**201/456** third components (44.1%; 6--14 of the fixed 24 controls on every
pair state), and every one of those 201 complete triples re-admitted
byte-stably on the immutable k prefix. There were zero recurrence geometry
unavailabilities and zero triple materialization failures. The additional
recursive admission/materialization cost was 14,530 frames; that cost is not a
source economics claim, but it is fully charged in the artifact.

**Decision.** This is the first evidence that the state-relative transient law
is *arrival-competent under its own recurrence* where the normal sampler is
not. It clears exactly the declared component threshold and nothing more. Do
not choose a successful triple control, integrate a lane, or run V2. The only
authorized successor is the predeclared equal-stream normal-return test at k+3.

## Declared Study: Recursive Transient k+3 Normal Return (2026-07-17)

**Question.** Do the 201 byte-stable transient triples return to the ordinary
normal generator after their third ballistic launch, or do they merely move the
foreign-arrival boundary forward one contact?

**Protocol, declared before rows.** Recreate the same dense-240 fixed screen
and retain every complete triple from the preceding assay. For each triple,
read the exact k+3 state, record airborne age, and run an unchanged 24-member
production-normal stream at k+3 from that triple engine. Every probe and
normal admission is charged; the raw-normal stream uses a deterministic seed
of fixture seed, k+3 gap index, first-control row, and third-control index.
No triple is selected or collapsed before the stream, and no current or future
target axis, case, or outcome controls the repeated geometry.

**Falsifiers.** Retire the recurrence form if no materialized triple restores a
normal k+3 admission; if normal control geometry is unavailable; if k+3
airborne phase falls below six on every triple; or if the returned component is
only a charged calibration witness without a held-out ordinary/dense result.
A pass authorizes only a separately declared held-out multi-contact study, not
a compiler source or V2 evaluation.

**Result (2026-07-17, `scripts/v0/study_two_contact_shooting.ts
--case=dense240 --return-normal --transient-bridge --recursive-transient
--recursive-return`, artifact
`generated/studies/two-contact-shooting/recursive-return-v1/`): calibration
component RETAIN; source promotion NOT authorized.** All 201 byte-stable
triples exposed normal control geometry at k+3. **146/201 (72.6%)** restored
at least one unchanged normal admission, for 969 total admissions. Every k+3
arrival was detector-legal: airborne age 6 (18 triples), 7 (35), 8 (88), 9
(59), or 10 (1). The k+3 normal-return probe/stream charged 54,128 frames;
the complete calibration chain is deliberately expensive and is not a
compiler-economics claim.

**Decision.** The dense-240 calibration evidence is now stronger than a local
capture: the same continuous transient law crosses two exact contacts,
re-materializes as one immutable-prefix triple, and returns the resulting
state to ordinary normal generation. It does **not** establish generality,
control selection, a cheap candidate source, or a V2 improvement. The
predeclared next test is a fresh-fixture held-out recurrence study.

## Declared Study: Held-Out Recursive Transient Continuation (2026-07-17)

**Cohort declaration before capture.** Freeze a new prospective V3 validation
fixture cohort from source situations not used by the current dense, dense240,
or ordinary two-contact fixtures: one independent dense impact-authored
passage, one independent ordinary impact-authored passage, and one independent
low-air impact-authored passage. The dedicated registry is
`scripts/v0/trajectory/recursive_transient_heldout_panel.ts`; it does not
import the legacy calibration panel or any quarantined V2 reserve row. The
pre-capture roster is fixed as follows:

- `heldout_open_hook_dense`: `open_hook`, seed 730301, g29, the first
  uninterrupted four-contact 20/19-frame open-response return.
- `heldout_meter_exchange_ordinary`: `meter_exchange`, seed 730303, g34, the
  first regular four-contact compact-meter block after the second exchange.
- `heldout_pickup_low_air`: `frontier_pickup_progression`, seed 730307, g51,
  the first steady four-contact pickup block after authored air falls below
  0.24.

All three selections use only their source timing, authored axis passage, and
impact labels; no current compiler output informed them. Capture with
`LR_ENGINE=wasm npx tsx scripts/v0/capture_recursive_transient_heldout_fixture.ts
--case=all --cohort=validation --budget=500000`, which binds the current
compiler candidate, WASM environment, 500k budget, source-import closure, and
full selected-prefix replay before a study runner reads the fixtures. These are
predictive held-out fixtures for this component only; they are not production
references or an input to V2 validation.

**Capture preflight correction (2026-07-17).** The first declared invocation
halted without writing a fixture because its g29 outgoing-interval assertion
was transcribed as 20 rather than the source's 19 frames. The source, seed,
target gap, and selection rationale did not change. Correct the assertion and
run the same command; the capture entrypoint now validates this structural
field before compiler traversal, so the correction creates no selection row.

**Protocol.** Apply the exact same fixed first-C1 + two recursive transient
components, mirrored 24-control screens, literal next-contact ballistic law,
unchanged admissions, complete triple materialization, and k+3 equal
24-member normal stream. Retain every row and charge every probe/admission.
Report per-fixture pair availability, triple admission/materialization,
k+3 legal-airborne count, normal-control availability, normal-return triples,
and frame cost. No source/case/seed/target-outcome branch, selected control, or
constant from dense-240 calibration may enter the law.

**Falsifiers.** Retire the recurrent component if either independent dense or
ordinary fixture has zero byte-stable triples with normal k+3 return; if the
low-air fixture has a material normal-control/validity failure; if a fixture
requires a new control/menu or contact-form exception; or if the fresh cohort
does not reproduce the combined legal-phase plus normal-arrival boundary. A
pass authorizes only a separately declared compact source-economics design and
standard scope panel, never direct V2 evaluation.

**Result (2026-07-17, 12.2s fixture capture; 8.3s
`scripts/v0/study_two_contact_shooting.ts --held-out --return-normal
--transient-bridge --recursive-transient --recursive-return`, artifacts
`generated/studies/two-contact-shooting/recursive-heldout-v1/`): component
RETAIN; source promotion NOT authorized.** All three V3 fixtures had stable
source/compiler identities and byte-stable prefix replay; their capture source
closure excluded the legacy trajectory panel. Every admitted third component
materialized once on its immutable prefix, and every materialized k+3 state had
an airborne age of 13 frames with normal control geometry available.

- Dense (`open_hook`): 603/1,608 third components admitted and materialized;
  568/603 triples restored normal at k+3 (7,045 admissions).
- Ordinary (`meter_exchange`): 891/3,792 admitted/materialized; 677/891
  restored normal (7,007 admissions).
- Low-air (`frontier_pickup_progression`): 716/2,952 admitted/materialized;
  449/716 restored normal (5,552 admissions), with zero unavailable normal
  controls or validity failures.

Across the fixed cohort that is 2,210/8,352 admitted third components (26.5%),
2,210 byte-stable triples, and 1,694/2,210 normal-return triples (76.7%;
19,604 normal admissions). This passes the predeclared recurrence boundary,
not a compiler-economics boundary: the 24-control study screen remains too
expensive and raw-normal paths were also strong on these source passages.

**Decision.** The continuous transient form now has one calibration result and
a sealed dense/ordinary/low-air replication; it must not be installed as a
24-control rescue menu. The only authorized next work is a source-neutral
compact-control economics audit, followed—only if that form remains
nondegenerate—by a separately declared source-default implementation and scope
panel. No V2 evaluation is authorized.

## Declared Analysis: Central-Six Transient Economics Audit (2026-07-17)

**Question.** Is there any mechanically compact, source-neutral projection of
the repeated transient law worth turning into a compiler implementation
hypothesis, before writing compiler source?

**Protocol, declared before extraction.** Use only immutable rows already
retained by the dense-240 calibration artifact and the just-closed held-out
artifacts. Define the six-control form from geometry, not outcomes: both turn
orientations × the `balanced` (0.5 entry-turn-share) allocation × all three
fixed phase offsets (0, 0.5, 1 reference-speed frames). Filter every stage of
the retained recurrence to this same six-label set: first C1, k+1 transient,
and k+2 transient. Report per artifact the resulting pair count, triple
admission/materialization, k+3 normal-control availability, normal-return
triples, and charged-frame share. This is a post-decision descriptive economy
audit, not new held-out evidence: the fixed projection cannot be revised from
its result and cannot itself promote a candidate.

**Falsifiers.** Do not write a source-default form if central-six produces zero
materialized normal-return triples on dense-240, or if it fails on either
fresh dense/ordinary row, or if its retained frame share remains incompatible
with a bounded ordinary candidate budget. A nonzero result authorizes only a
fresh declaration for a tiny source-default candidate and standard scope
panel; it does not authorize V2 evaluation.

**Result (2026-07-17, 0.6s
`scripts/v0/audit_central_six_transient.ts`): RETIRE central-six.** The fixed
six-label projection had six first controls but **zero materialized pairs on
dense-240 calibration**, so no third component or k+3 normal stream existed;
this is the declared decisive falsifier. Its already-observed descriptive rows
on the sealed cohort do not change that decision: dense 16/36 materialized
central triples with 16 normal returns (29.6% recursive-row charge share),
ordinary 12/48 with 9 returns (23.1%), and low-air 13/36 with 7 returns
(34.2%), all without unavailable normal controls. Those numbers are not new
validation evidence because the cohort had been observed before this audit.

**Decision.** Do not implement or scope the balanced central-six form. The
economics constraint remains open. The only permitted successor is a
calibration-only concentration audit of the already retained dense-240 rows;
it may identify whether any compact *shape class* is worth a new, separately
declared fresh-cohort test, but may not select a case, replay the consumed
cohort, or alter the transient law.

## Declared Analysis: Dense-240 Transient Control Concentration (2026-07-17)

**Question.** Within the calibration-only dense-240 recurrence artifact, do
admitted/materialized/normal-return triples concentrate in a source-describable
control class, or is the 24-control screen intrinsically necessary?

**Protocol.** Mechanically tabulate every retained dense-240 triple by its
first C1 label, second transient label, and third transient label, plus the
three marginal label distributions. Count materialized triples, normal-control
availability, normal-return triples, and normal admissions. The artifact is
read-only calibration evidence; no held-out row, V2 case, or compiler result
is read. The audit may report concentration but cannot choose a final control
or source default: any form proposed from it requires a new predeclared V4
fixture cohort before a source implementation is written.

**Falsifiers.** If no individual label or source-describable class carries a
nonzero normal-return triple, retire compact source-default pursuit for this
topology. If concentration is present only in an irreducible multi-control
combination, retain it as a calibration fact but do not write a source form.

**Result (2026-07-17, 0.6s
`scripts/v0/audit_dense240_transient_concentration.ts`): concentration
RETAIN; no source form yet.** The immutable dense-240 rows contain 201
materialized triples, 146 normal-return triples, and 969 normal admissions.
All 146 normal returns begin with one of three `distributed` forward-phase C1
labels: positive/one-frame (98 returns, 773 admissions), negative/one-frame
(26, 130), or negative/half-frame (22, 66). The remaining 44 materialized
triples begin with balanced labels and restore zero normal returns. At the
third component, the four mirrored distributed half/one-frame labels retain
46 normal-return triples (347 admissions). This is a geometry-level
concentration, not a case branch or a source decision.

**Decision.** The calibration result supports one compact class worth a
closed-screen check: `distributed` allocation (zero entry turn) × both bend
orientations × half- or one-frame forward phase. It has four controls, is
defined entirely by the existing local physical basis, and omits the
at-target and entry-loaded/balanced alternatives uniformly. It still needs an
all-stages closure check on the same calibration artifact before new fixtures
are even declared.

## Declared Analysis: Distributed-Forward Four-Control Closure (2026-07-17)

**Question.** If the same four-label distributed-forward class is imposed at
first C1, k+1 transient, and k+2 transient, does dense-240 retain any
byte-stable triple with a k+3 normal return at one-sixth of the original
control-product width?

**Protocol.** Read only the immutable dense-240 calibration rows. Filter all
three component labels to exactly: negative/positive `distributed` with
`half_frame_forward` or `one_frame_forward`. Retain the original admissions,
materializations, normal streams, and row charges; report pair/triple counts,
normal controls/returns, and recursive-row charge share. This is a mechanical
projection of existing calibration evidence. It cannot adapt by contact,
source, outcome, impact magnitude, or held-out result.

**Falsifiers.** Retire the compact class if the all-stages projection has zero
materialized normal-return triples. A pass authorizes only a separately
declared fresh V4 fixture cohort using the unchanged four controls; it does
not authorize compiler source or V2 evaluation.

**Result (2026-07-17, 0.5s
`scripts/v0/audit_central_six_transient.ts --projection=distributed-forward-four
--artifact=...dense240...`): calibration closure RETAIN.** The exact same
four-label filter at all three contacts yields 8 materialized pairs, 28/32
admitted and byte-stable triples, 28/28 normal-return triples, and 272 normal
admissions; all normal control geometry is available. Its retained recursive
row charge is 10,234/37,586 (27.2%). This clears the declared calibration
falsifier but is not fresh evidence or a source candidate.

**Decision.** Freeze a new V4 fixture cohort before changing any compiler
source. The next runner must apply exactly four controls at every C1/transient
stage—distributed allocation, both orientations, half/one-frame forward
phase—and use an equal four-member normal stream at k+3. It may not use the
24-control V3 menu, select a control, or alter the ballistic law.

## Declared Study: Fresh Distributed-Forward Four-Control Recurrence (2026-07-17)

**Cohort declaration before capture.** The isolated V4 registry is
`scripts/v0/trajectory/recursive_transient_four_control_panel.ts`; it imports
neither the legacy trajectory panel nor the previously observed V3 registry.
The source-only roster is fixed as follows:

- `four_control_split_signal_dense`: `split_signal`, seed 730401, g13, a
  compact 16/17-frame impact-authored block.
- `four_control_wide_breaths_ordinary`: `wide_breaths`, seed 730403, g34, a
  regular middle-groove impact-authored block.
- `four_control_pickup_shifted_low_air`:
  `frontier_pickup_progression_shifted`, seed 730407, g59, a stable 24-frame
  shifted low-air (<0.20) impact-authored block. It is a fresh V2 timing
  variant, explicitly not an independence claim from the prior base pickup
  source.

Capture with `LR_ENGINE=wasm npx tsx
scripts/v0/capture_recursive_transient_four_control_fixture.ts --case=all
--cohort=validation --budget=500000`. The runner protocol is the fixed four
controls at first C1, k+1 transient, and k+2 transient; literal next-contact
ballistic law; byte-stable triple materialization; and an equal four-member
normal stream at k+3. No source/case/impact/outcome branch or larger control
menu is permitted.

**Falsifiers.** Retire the distributed-forward class if fresh dense or
ordinary has zero materialized triple with k+3 normal return; if the low-air
variant has unavailable normal control/validity failure; if any required
fixture does not seal under WASM/500k/current compiler; or if four-control
cost is not materially bounded below the 24-control study screen. A pass
authorizes only a separately declared tiny source-default candidate and normal
scope panel, never direct V2 evaluation.

**Result (2026-07-17, 13.5s fixture capture; 0.2s
`scripts/v0/study_two_contact_shooting.ts --distributed-forward-four
--return-normal --transient-bridge --recursive-transient --recursive-return`,
artifacts `generated/studies/two-contact-shooting/recursive-distributed-four-heldout-v1/`):
RETIRE distributed-forward four-control form.** The three V4 fixtures sealed
and replayed exactly, with the four source-neutral controls and equal
four-member normal streams applied at every stage. The compact class then hits
all three falsifiers: fresh dense admitted 3/4 first C1s and 4 materialized
pairs but **0/16** third components; fresh ordinary admitted **0/4** first
C1s; shifted low-air materialized 4/16 third components but restored **0/4**
k+3 normal returns (normal control geometry was available). Its very low frame
cost therefore does not establish a useful source trade-off.

**Decision.** Do not implement, broaden, retune, or scope the transient
bridge topology. The 24-control form is a validated physical component but
not source-economical, and both geometry-derived compact projections are
closed. Resume broad normal-candidate-space diagnosis outside this topology;
no V2 evaluation is authorized from any trajectory result above.

## Declared Observation: Seeded Low-Discrepancy Normal-Pool Basis (2026-07-17)

The contact-centred normal generator consumes exactly eight raw coordinates per
attempt. Its early guided coordinates are deterministic, but its residual
eight-dimensional coverage is an ordinary per-gap PRNG stream. This is a
candidate-basis question rather than another geometry, controller, capacity,
or selector form: at identical candidate count, immutable prefix, attempt
index, authored targets, exact evaluator, and ranker, does a seed-rotated
low-discrepancy coordinate sequence expose a stronger ordinary normal pool?

**Frozen observation cohort.** Use the current compiler, WASM, V2 jolt, 500k
frames, and seeds 24 and 25 on exactly these six development sources:
`frontier_dense_recovery`,
`frontier_dense_recovery_240ms_figures`,
`frontier_pickup_progression_shifted`,
`frontier_low_air_endurance_7s`, `countercurrent`, and
`believer_56_6s`. Before any row is read, take the first ordinary frontier
state at the one-third and two-thirds authored-contact indices of each source.
For each reachable immutable state, replay the production raw-normal stream
with its actual cached candidate count, then replay a seeded
Cranley--Patterson-rotated eight-dimensional Halton stream at the *same*
attempt indices and count. The PRNG replay must reproduce every cached raw
normal candidate by sample attempt and geometry hash before its paired row is
usable. Aim, runway, rescue, reuse, forward evaluation, traversal, and every
source default remain untouched; these are local exact-pool observations, not
a V2 evaluation or an alternate compiler run.

**Recorded quantities.** Per paired state retain the production candidate
count, viable admissions, best exact current-quality-times-readiness objective,
best scorer-axis RMS, best local cost, source/gap identity, and geometry-hash
replay result. Aggregate only paired state deltas; never select a Halton
rotation, a source, a checkpoint, or a candidate from the rows.

**Decision boundary.** Retire this basis if the fixed sequence is not
replay-equivalent on the PRNG arm, if either regime-balanced mean best-objective
or mean best-axis-RMS is no better than PRNG while viable admissions also do
not increase, or if any broad regime suffers a material admission collapse.
A positive observation authorizes only one separately declared, fixed
source-default sampler-basis implementation and ordinary cross-regime scope
panel. It does not authorize V2 Stage 0 or evaluation.

**Instrumentation correction before valid rows (2026-07-17).** The first
execution captured frontier nodes correctly but compared replay hashes to the
candidate objects retained in their later caches. Those objects can be modified
by post-terminal work after their original pool was generated, so 22/24 hash
comparisons failed for an observer-lifecycle reason rather than a PRNG replay
fact. Discard those generated rows. The runner now snapshots each raw-normal
candidate's attempt and geometry hash synchronously at *every* generation or
cache-extension event, before lane sorting, traversal, or later retention;
the stored sequence is then looked up when its state reaches a declared
checkpoint. The frozen cohort, arms, count, coordinates, and decision boundary
above are unchanged. Rerun only with this generation-time sentinel; until it
passes, neither arm is evidence.

**Setup correction before valid rerun (2026-07-17).** The first
generation-time rerun still failed because the observer reconstructed direct
impact targets but omitted the compiler's generation-only `nextImpact`
lookahead field. That field shapes the ordinary post-contact delivery law, so
the replay geometry was not the same normal source. Discard that rerun too.
The observer now reproduces the compiler's literal next-contact impact
propagation before sampling; no frozen cohort member, coordinate, count, arm,
or result-derived choice changed.

**Result (2026-07-17, 12 current-tree WASM/500k compiles plus exact paired
pool replay; artifact `generated/studies/normal-pool-basis/v1/result.json`):
RETIRE seeded Halton basis.** All 24 declared states were captured and every
PRNG replay matched its generation-time raw-normal attempts and geometry hashes
exactly. The fixed Halton stream modestly improved regime-balanced closest-axis
RMS by 0.0041 and added 0.45 viable candidates/state, but its primary exact
quality-times-readiness pool objective fell **0.0092**. The negative was broad:
dense −0.0135, pickup −0.0146, and low-air −0.0282. The low-air regime also
hits the declared admission-collapse boundary at its late checkpoint (−5/29
and −3/29 viable candidates for the two seeds, a 17% and 10% loss). The small
representative/development-objective gains do not offset that broad failure.

**Decision.** Do not implement a Halton source default, rotate/scramble the
sequence, change pool count, or run a V2 scope panel. The current PRNG's raw
coordinate coverage is not the missing normal-candidate basis under this fixed
equal-cost comparison. Retain the generation-time snapshot hook and study
harness as observation infrastructure only; resume diagnosis on a physically
distinct state or transition basis.

## Declared Observation: Lowest-Contact-Point Kinematic Normal Frame (2026-07-17)

The ordinary normal sampler already anchors placement at the lowest exposed
sled point, but it gives the placement law the rider COM velocity, speed, and
heading. This study asks a narrower physical-basis question: with the same
lowest-point anchor, raw PRNG coordinates, attempt count, exact evaluator, and
rank-independent candidate pool, does giving placement the velocity of that
*same* lowest sled point expose a stronger normal pool? It is neither a pose
or catchability predictor nor a trajectory primitive. The point velocity is a
local contact-frame tangent used only to construct proposed geometry; impact
measurement and all candidate scoring remain the present COM law.

**Frozen observation cohort.** Use current compiler/WASM/V2 jolt/500k and
seeds 26 and 27 on exactly six fresh development sources:
`dense_dialogue` (dense), `river_reentry` (representative), `pickup_lattice`
(pickup), `frontier_pickup_progression` (pickup),
`frontier_low_air_endurance_6s` (low-air), and `believer_impact_56s`
(development music). Before reading any rows, capture the first ordinary
frontier state at the one-third and two-thirds authored-contact indices of each
source. At each reachable immutable state, replay the generated production
raw-normal pool at its actual cached count and attempt indices. The comparator
uses the identical PRNG stream and geometry function, replacing only the
placement `velocity`, `speed`, and `angleDeg` with the lowest anchor point's
finite non-zero velocity; if that velocity is unavailable it records the
explicit COM fallback rather than inventing a tangent. Both arms must call the
same normal candidate gate, pre-target trace, lookahead, literal targets, and
post-fit continuation. No rank, traversal, source default, or alternate
compiler run is allowed.

**Recorded quantities.** For every paired state retain candidate count,
production geometry-hash replay outcome, usable point-velocity coverage and
anchor identity, viable admissions, best exact current-quality-times-readiness
objective, best scorer-axis RMS, and best local cost. Aggregate only paired
state deltas, balanced by regime. A COM fallback state is retained as a
coverage row but contributes no arm difference.

**Decision boundary.** Retire the contact-point frame if production raw replay
is not exact, point velocity is unavailable on a material fraction of the
cohort, the regime-balanced primary objective and best-axis RMS do not both
improve while viable admission rises, or dense, pickup, or low-air has a
material admission collapse. A positive observation authorizes only a
separately declared fixed source-default implementation and ordinary
cross-regime scope panel; it does not authorize V2 Stage 0 or evaluation.

**Result (2026-07-17, 12 current-tree WASM/500k compiles plus exact paired
pool replay; artifact
`generated/studies/contact-point-normal-frame/v1/result.json`): RETIRE
lowest-contact-point kinematic frame.** All 24 declared states were captured;
every production PRNG replay matched its generation-time attempts and geometry
hashes; and the selected lowest point exposed a finite non-zero velocity on all
24 rows. The contact tangent modestly improved regime-balanced best objective
(+0.00620) and closest-axis RMS (+0.00227), but violated both pool-strength
conditions: viable admissions fell −0.15/state overall and the low-air late
seed-26 pool fell **4/12** (33%). The development-music late seed-27 pool also
collapsed from 7 viable candidates to zero. Dense's apparent +2.25
admissions/state was not a broad substitute for those losses; pickup's primary
objective was −0.00280 and axis movement was flat (−0.00003).

**Decision.** Do not change the normal sampler's target frame, blend the two
velocities, add an anchor/point-specific lane, or run a V2 scope panel. The
physical contact tangent is a valid observation frame but not an equal-cost
ordinary candidate basis under exact gates. Retain the observer only as
diagnostic infrastructure and resume normal-candidate diagnosis elsewhere.

## Declared Observation: One-Way Collision-Side Normal-Pool Basis (2026-07-17)

Every ordinary normal proposal currently carries the same one-way collision
side (`flipped: false`). The engine, detector, and trajectory primitives make
that side physical rather than cosmetic: otherwise identical line coordinates
may expose a different collision normal. This study asks whether the excluded
side is an equal-cost broad candidate basis. It is not an orientation-field,
pose, anchor, or target-specific lane: each comparator proposal uses the
production PRNG, the same normal geometry coordinates, candidate count,
attempt index, and exact gate, with only every proposed line's collision-side
bit inverted.

**Frozen observation cohort.** Use current compiler/WASM/V2 jolt/500k and
seeds 28 and 29 on exactly six development sources:
`frontier_dense_recovery`, `dense_dialogue_impact_contrast_10`,
`countercurrent`, `offgrid_conversation`, `frontier_low_air_endurance_4s`,
and `believer_56_6s`. Label the two dense sources dense; Countercurrent
representative; Offgrid Conversation pickup; the frontier variant low-air; and
Believer development music. Capture the first ordinary frontier state at the
one-third and two-thirds authored-contact indices. The production raw-normal
replay must reproduce its generation-time attempts and coordinate-plus-side
hashes before a paired row is usable. The comparator then flips every line in
the same raw proposal before the same pre-target trace, lookahead, literal
targets, post-fit continuation, evaluator, and pool metrics. No source
default, candidate mix, rank, traversal, or alternate compiler run is allowed.

**Decision boundary.** Retire the alternate side if raw production replay is
not exact, its equal-count normal pool has no viable broad support, the
regime-balanced objective and closest-axis RMS do not both improve with higher
viable admission, or dense, pickup, or low-air has a material admission
collapse. A positive observation authorizes only a separately declared fixed
source-default implementation and ordinary cross-regime scope panel; never V2
Stage 0 or evaluation directly.

**Result (2026-07-17, 12 current-tree WASM/500k compiles plus exact paired
pool replay; artifact
`generated/studies/collision-side-normal-pool/v1/result.json`): RETIRE
one-way collision-side basis.** All 24 declared states captured and every
production PRNG replay matched the generation-time coordinate-plus-side hashes
exactly. Inverting the whole normal pool's collision side admitted candidates
in only **2/24** rows. Those two rows were not a latent alternative basin:
dense dialogue contrast seed-29 admitted 3 versus 17 production candidates
and low-air seed-29 admitted 1 versus 12, with each comparator's objective,
axis RMS, and cost materially worse. Regime-balanced viable admissions fell
**21.275/state**; representative, pickup, and development music had zero
flipped admissions, while dense and low-air fell 17.125 and 9.25/state.

**Decision.** Do not flip normal lines, add a collision-side mixture, tune an
orientation gate, or run a V2 scope panel. Production's one-way side is not an
arbitrary missing candidate dimension under the exact normal-contact gate.
Retain the coordinate-plus-side snapshot check as generic observer
infrastructure only.

## Declared Diagnosis: Two-Second Authored Joint-Demand Memory (2026-07-17)

The closed grade, energy-debt, contact-phase, and airborne-phase controls all
read committed past state. A genuinely different multi-contact basis would be
*prospective*: a normal candidate at the start of a passage may need to bank a
legal arrival before the authored speed/impact/air combination creates the
slow, both-bad episode. Before adding such future-target memory to any
generator, test whether the demand exists as an out-of-sample descriptive
signal rather than naming the known Believer or dense passages.

**Frozen read-only protocol.** Read only the accepted
`2026-07-16T16-45-07Z-8257f266` canonical development archive's valid 500k
runs. At every contact, define a two-second forward joint-demand integral over
subsequent authored contacts,
`sum(exp(-Δt/1s) * speedTarget * impactTarget * airTarget)`, using the
archive's literal resolved targets and no score, source, seed, phase, or
outcome input. Define a both-bad onset before reading the forward integral as
impact undershoot at least 0.15 and raw speed undershoot above 0.1 px/frame,
following a non-both-bad preceding contact. Report the onset rate in fixed
quartiles of the forward integral, overall and separately for
`dense_dialogue` and `believer_56_6s`; within fixed current-contact-demand
quartiles, retain the high-versus-low forward-demand contrast so a current
hard-contact confound cannot masquerade as preparation signal.

**Decision boundary.** Retire prospective joint-demand memory if the highest
forward-demand quartile does not have at least twice the lowest quartile's
both-bad-onset rate overall *and* on both named independent source families,
or if the within-current-demand contrast disappears. A pass authorizes only a
separately declared immutable-state candidate-pool probe before any source
implementation; it does not authorize a future-target lane, scope panel, or
V2 evaluation.

**Result (2026-07-17, 5.8s read-only archive analysis; artifact
`generated/studies/joint-demand-memory/v1/result.json`): RETIRE prospective
joint-demand memory.** The fixed analysis covered 2,111 valid 500k runs and
194,578 contact rows. Its overall high-versus-low forward-demand onset rate
was only **1.76×** (13.93% versus 7.93%), below the declared 2× gate. More
importantly, the intended independent families reversed the association:
Dense Dialogue was **0.89×** (13.35% versus 14.97%) and Believer **0.46×**
(5.11% versus 11.21%). Forward demand retains a positive contrast within
each global current-demand quartile (1.56--2.37×), but it does not identify
the known slow-episode onsets across sources; a global or family-agnostic
prospective trigger would therefore misfire exactly where it was meant to
prevent energy loss.

**Decision.** Do not add future-target memory, integrate the demand score
into normal generation, tune its horizon/decay/threshold, or run a candidate
pool or V2 panel. The two-second joint demand is a descriptive covariate, not
a cross-source causal state basis. Multi-contact diagnosis must use a
different physical state boundary.

## Declared Observation: Tolerance-Resolved Normal Post Curve (2026-07-17)

The ordinary normal generator samples a continuous post-contact tangent field
but realizes it with a sampled line length alone. Consequently, a high-turn
carrier can be represented by fewer chords than the geometry contract already
uses elsewhere: the trajectory-synthesis resolution rule is a maximum 2px
chord error and 5 degrees of tangent turn per chord. Collinear representation
has already been shown not to be a physical lever; this is a different,
curved-contact claim. Preserve the raw coordinates, targets, PRNG draw count,
attempt index, contact vertex, curve bias, evaluator, and rank. Refine only a
non-template ordinary post curve when its sampled count is below the fixed
geometry tolerance:

`max(nominalCount, adaptiveCurveSegmentCount(postLength, postTurn,
1 + abs(curveBias), {maxChordErrorPx: 2, maxTurnDegPerSegment: 5}))`.

The two constants are an existing trajectory construction contract, not a
new sweep. A template has its own explicitly declared physical form and is
left byte-identical. This is neither a duration branch nor a source/case lane:
the rule applies to every eligible ordinary curve from its sampled physical
shape alone.

**Frozen observation cohort.** Use current compiler/WASM/V2 jolt/500k with
seeds 30 and 31 on exactly six unused-for-this-study development sources:
`frontier_dense_recovery_240ms_figures` (dense),
`open_hook_amplitude_plus_8` (high-air), `rising_switch` (representative),
`pickup_lattice_speed_minus_4` (pickup),
`frontier_low_air_endurance_7s` (low-air), and
`believer_56_6s_impact_relief` (development music). Capture the first
ordinary frontier node at the one-third and two-thirds authored-contact
indices. First replay the production raw-normal pool from each node and
require its generation-time attempt and geometry hashes to match exactly.
Then resample the same candidate count and PRNG stream with only the
tolerance refinement enabled, and retain every exact-gate result, objective,
axis RMS, candidate line count, refinement count, and metered admission
frames. No compiler traversal, source default, ranker, candidate mix, or V2
evaluation is permitted.

**Decision boundary.** Retire if raw production replay is not exact; if the
fixed rule is inert on almost every eligible candidate; if equal-count viable
admissions, regime-balanced objective, and closest-axis RMS are not jointly
positive; if metered admission frames rise materially without a stronger pool;
or if dense, pickup, or low-air has a material admission collapse. A pass
authorizes only a separately declared source-default implementation and
ordinary broad scope panel, never direct V2 evaluation.

**Result (2026-07-17, 12 current-tree WASM/500k compiles plus exact paired
pool replay; artifact
`generated/studies/normal-post-curve-resolution/v1/result.json`): RETIRE
tolerance-resolved normal post curve.** All 24 declared frontier states were
captured and every production replay matched its generation-time normal-pool
attempt and geometry hashes. The fixed construction was active rather than
inert: 591 ordinary non-template curves were eligible, 117 (19.8%) refined,
and the comparator added 579 chords. Exact admission became cheaper on
average by 387 metered physics frames/state because several changed candidates
failed sooner, not because the comparator established more viable alternatives.

The regime-balanced closest-axis RMS and objective movements were superficially
positive (+0.000268 and +0.005437), but the pool-strength condition failed:
viable admission moved only +0.125/state, entirely from high-air (+1.0), while
dense fell −0.25/state (including one 10-to-9 pool). Pickup and low-air were
flat. High-air's objective was itself negative (−0.004461), and the balanced
best-cost movement was also negative (−0.000060). The discrete realization
changes individual trajectories, but it does not expose a coherent broad
normal-candidate basin.

**Decision.** Do not make tolerance refinement a compiler default, mix it
into a candidate lane, alter the 2px/5-degree contract, or run a source scope
panel or V2 evaluation. Retain the default-off resolution observer as generic
diagnostic infrastructure only. Curved normal realization is now closed in
this fixed refine-only form; a successor must name a distinct physical
component rather than sweep chord tolerance or segment caps.

## Declared Diagnosis: Transient Ballistic-Transfer Residual (2026-07-17)

The retired transient C1-to-ballistic bridge selected its launch from exact
incoming speed and the literal k+2 interval only: `vy = -g*N/2`. It therefore
enforces a symmetric vertical flight but never tests whether the bridge's
release is compatible with the next *physical reference position*. A distinct
state-to-state ballistic-transfer component would instead derive its launch
vector from the exact engine state after the first admitted C1, the unforced
k+2 reference at the same immutable prefix, gravity, and `N`; it would still
require exact current and next admission. This diagnosis does not construct
that component or alter a control.

**Cheap decisive audit.** Recreate only the existing frozen dense-240
transient-bridge protocol under WASM/500k, retaining all original materialized
pairs. For each pair, read (a) the k+2 CoM and named lowest-reference state
from the engine containing only the byte-stable first C1, and (b) the exact
k+2 state after the complete bridge. Record both spatial residuals and the
nominal gravity-only transfer velocity from the bridge endpoint to the
pre-bridge reference over literal `N`; no result is supplied to the bridge,
gate, normal stream, or ranker. Charge every new state read. The original
bridge remains the geometry; this is an observation of its state boundary.

**Decision boundary.** Retire the transfer basis if any materialized pair
lacks a finite pre-bridge k+2 target state, if fewer than 75% expose the same
signed reference residual on either physical axis, or if fewer than 75% need a
finite nominal transfer launch angle differing by more than 5 degrees from the
symmetric bridge launch. A pass authorizes only a separately declared fixed
state-to-state component assay on a fresh dense-240 fixture; it authorizes no
control retune, source lane, scope panel, or V2 evaluation.

**Result (2026-07-17, 0.19s `LR_ENGINE=wasm npx tsx
scripts/v0/study_two_contact_shooting.ts --case=dense240 --return-normal
--transient-bridge --transfer-diagnosis`; artifact
`generated/studies/two-contact-shooting/transient-ballistic-transfer-residual-v1/`):
RETIRE ballistic-transfer basis.** The run reproduced the existing 19/19
byte-stable materialized bridge pairs, zero k+2 ordinary-normal returns, and
the prior segment admissions. Every pair exposed a finite unforced k+2 state.
The spatial observation is real: all 19 bridged arrivals were above the
unforced reference (mean `y` residual −11.05px, median −7.80px); 17/19 were
also behind it in `x` (mean −5.60px). This establishes that the symmetric
bridge moves the body away from the unforced continuation, not that a
position-conditioned launch law is coherent.

The declared vector condition fails decisively. Only **9/19 (47.4%)**
materialized pairs had a finite nominal endpoint-to-reference transfer angle
more than 5 degrees from the bridge's actual symmetric launch; the median
absolute difference was only 4.96 degrees. Thus the common vertical residual
does not identify one cross-pair ballistic-vector correction—most pairs retain
the existing launch direction to within the predeclared physical tolerance.

**Decision.** Do not build a target-position ballistic bridge, retune the
launch horizon or endpoint, derive an offset mixture, or run fresh fixtures,
scope, or V2 evaluation. The unforced k+2 reference is a useful diagnostic
but not a universal arrival-control state. Any future multi-contact component
must name a different physical state boundary, not reformulate this rejected
transfer vector.

## Declared Study: Tangential-Impulse Transient Release (2026-07-17)

The transient bridge reaches dense-240's legal airborne phase but lands in no
ordinary-normal arrival basin. Its solid scoop has only gravity and surface
friction to set the release state. The engine exposes a distinct physical
contact component: a type-1 line applies its fixed tangential acceleration on
each collision update. This study uses that engine law only at the release
surface—not as a normal-pool mutation, ranker rule, target frame, or
continuation-control menu.

**Protocol, declared before rows.** On the frozen dense-240 calibration
fixture only, retain the exact first C1 capture and all 24 fixed mirrored
transient approach controls. Realize the same one-segment approach and same
three-segment scoop, but emit each scoop segment as a reversed, flipped type-1
line. Reversal plus the flipped bit preserves the active collision normal of
the original solid start-to-end segment while orienting the type-1 impulse
forward along that segment's physical travel direction. The approach remains a
solid line. No axis, outcome, source, seed, duration class, magnitude, segment
subset, or control is selected; the engine's literal fixed type-1 impulse is
the entire treatment. Admit the k+1 bridge and the complete pair through the
unchanged gates, require one-shot byte-stable materialization on the immutable
k prefix, read exact k+2 airborne age, then run the unchanged equal 24-member
raw-normal stream. Charge every replay and retain every row.

**Falsifiers.** Retire this impulse component if no byte-stable pair both
preserves the required six-frame dense-240 airborne phase and restores a
width-1 ordinary-normal k+2 admission; if the active-normal preservation fails
under exact pair admission; or if its equal-width charged replay cost exceeds
the solid bridge without that return. A pass establishes only an engine-force
component boundary and authorizes a fresh held-out replication, never a source
implementation, scope panel, or V2 evaluation.

**Calibration result (2026-07-17, 0.19s `LR_ENGINE=wasm npx tsx
scripts/v0/study_two_contact_shooting.ts --case=dense240 --return-normal
--transient-bridge --transient-accelerated-release`; artifact
`generated/studies/two-contact-shooting/transient-accelerated-release-v1/`):
component RETAIN; source promotion NOT authorized.** All 22 admitted
first-C1/accelerated-transient pairs re-materialized byte-stably, with no
unavailable normal controls or materialization failures. Their k+2 airborne
ages were all legal: 5 pairs at 7 frames, 5 at 8, and 12 at 9. The unchanged
24-member normal stream restored width-1 returns on **2/22 pairs** (two total
admissions), both from the fixed distributed one-frame-forward bridge labels;
the solid bridge had 0/19. The k+2 normal-return work charged 5,681 frames;
the treatment did not add state reads or control width. This clears the stated
component boundary but is sparse calibration evidence, not a compact source
law or a benchmark candidate.

## Declared Study: Fresh Tangential-Impulse Transient Replication (2026-07-17)

The calibration-only force component has one nonzero normal-return result.
Before any source economics or compiler code, freeze a prospective V3 cohort
that tests the unchanged full 24-control treatment outside every previous
transient fixture roster. The registry is
`scripts/v0/trajectory/accelerated_transient_heldout_panel.ts`; it imports no
legacy, recursive, or four-control registry. Its authored-only selections are:

- `accelerated_transient_dense_dialogue`: `dense_dialogue`, seed 730501, g50,
  the first 13/17/14/17-frame figure after the long-phrase reset.
- `accelerated_transient_countercurrent_ordinary`: `countercurrent`, seed
  730503, g25, the first regular 25-frame figure after the 49-frame break.
- `accelerated_transient_low_air_endurance`: `frontier_low_air_endurance`, seed
  730507, g43, the first 22-frame return after the 200-frame low-air rideout.

Capture before observation with `LR_ENGINE=wasm npx tsx
scripts/v0/capture_accelerated_transient_heldout_fixture.ts --case=all
--cohort=validation --budget=500000`. The replication applies the exact same
first C1 screen and exact same 24 fixed transient controls; at k+1, only the
three post-contact scoop segments become reversed/flipped forward type-1 lines.
It retains every exact admission and one-shot materialization, then runs an
unchanged equal 24-member raw-normal stream at k+2. No source, case, seed,
axis, outcome, impulse magnitude, segment subset, or control selection enters
the construction.

**Observation invocation.** After capture, run only the three emitted fixture
paths through `study_two_contact_shooting.ts` with
`--transient-accelerated-held-out --transient-accelerated-release
--return-normal --transient-bridge` and exactly one `--fixture=PATH` for each
declared roster member. This mode rejects `--case`, all recursion, the
four-control screen, and every diagnostic branch; it fingerprints the sealed
roster and uses the full 24-control screen at both the k+1 bridge and k+2
normal boundary.

**Falsifiers.** Retire the force component if any sealed fixture has no
byte-stable pair with a legal six-frame k+2 state and a width-1 normal return;
if any normal-control path is unavailable; or if its equal-width charged replay
does not remain bounded without that return. A pass authorizes only a separate
source-neutral economics audit; it cannot choose controls, write a compiler
source, scope a candidate, or run Benchmark V2.

**Result (2026-07-17, 1.3s `LR_ENGINE=wasm npx tsx
scripts/v0/study_two_contact_shooting.ts --transient-accelerated-held-out
--transient-accelerated-release --return-normal --transient-bridge` with the
three sealed paths; artifacts
`generated/studies/two-contact-shooting/transient-accelerated-release-heldout-v1/`):
component RETAIN; source promotion NOT authorized.** Every admitted pair
one-shot materialized and every normal-control path was available. All arrival
states exceeded the legal six-frame boundary: dense dialogue's 76 pairs had
airborne ages 10/11/12, countercurrent's 84 pairs had age 13, and low-air's
127 pairs had age 13. The unchanged width-1 normal stream then restored
returns on 75/76 dense pairs (1,370 admissions), 75/84 ordinary pairs (880),
and 95/127 low-air pairs (400), respectively. The fully retained 24-control
normal-boundary charges were 30,040, 61,843, and 53,496 frames, with no extra
state reads, control-width change, unavailable path, or materialization
failure. This replicates legal phase plus normal arrival in all three
prospective source regimes; it is force-component evidence, not a source-law
or economics result.

## Declared Analysis: Tangential-Impulse Control Economics (2026-07-17)

**Question.** Does the retained accelerated-transient evidence contain any
source-neutral control geometry whose normal-return density and charged replay
cost are coherent enough to justify a *fresh* compact-form test, without
writing compiler source or using a V2 score?

**Protocol, declared before extraction.** Read only the immutable dense-240
calibration artifact and the three just-observed accelerated-transient
replication artifacts. Mechanically tabulate every materialized
`capture-arc -> accelerated transient` pair by the fixed first-C1 label and
the fixed accelerated-bridge label. For every label and label pair, retain:
fixture identity; legal-airborne count; normal-control availability;
normal-return pairs and admissions; the complete materialized-pair charge; and
the charged frames per returned pair/admission where defined. The report is a
complete table—no top-N filtering, re-run, resampling, source branch, target
axis, or candidate selection. It is descriptive post-decision evidence only.

**Decision boundary.** Retire compact-form pursuit if no fixed geometric label
or fixed label pair has legal normal returns in calibration and in each of the
fresh dense, ordinary, and low-air artifacts. If such classes exist, name them
all in the result but do not select one, change compiler code, or reuse this
cohort. A pass authorizes only a separately declared fresh compact-form
fixture cohort and paired force/solid observation; it never authorizes source
implementation, scope, or V2 evaluation.

**Result (2026-07-17, 0.6s `scripts/v0/audit_accelerated_transient_economics.ts`):
compact-form pursuit RETAIN; source promotion NOT authorized.** The complete
table retained 22 legal calibration pairs and 76/84/127 legal fresh
dense/ordinary/low-air pairs, respectively, with zero unavailable normal
controls. The four artifacts had 2, 1,370, 880, and 400 normal admissions at
the return boundary. Exactly one first-C1 label had a legal normal-return pair
in every artifact: `negative_distributed_one_frame_forward`. Exactly two
fixed label pairs did so: that same first label followed by either
`negative_distributed_one_frame_forward` or
`positive_distributed_one_frame_forward` at the accelerated bridge. This is a
complete label accounting, not an implementation decision: it identifies a
one-by-two fixed geometric form for a fresh paired test, while the retained
24-control screen remains far too broad to infer source economics.

## Declared Study: Fresh Compact Tangential-Impulse Force Comparison (2026-07-17)

**Cohort declaration before capture.** Freeze a new V3 validation roster that
shares no source with the prior tangential-impulse replication:

- `compact_force_dense_recovery`: `frontier_dense_recovery`, seed 730601, g50,
  the first 9/9/9-frame dense-stream cluster after its preceding ordinary
  recovery pulse.
- `compact_force_amplitude_tides`: `amplitude_tides`, seed 730603, g20, the
  first regular 21/21-frame compact pulse after the authored 42-frame opening.
- `compact_force_sparse_lowline`: `sparse_lowline`, seed 730607, g16, the
  first 25/25-frame return after the authored 50-frame low-air omission.

These selections use source timing, authored impacts, and source air fields
only. Capture at WASM/500k before either arm is observed. The runner will use
one first-C1 control, `negative_distributed_one_frame_forward`; at k+1 it will
use exactly two bridge controls, negative and positive
`distributed_one_frame_forward`; and it will read an equal two-member raw
normal stream at k+2. It runs two arms against each immutable prefix: solid
three-scoop release and reversed/flipped type-1 three-scoop release. The
complete geometry, first control, bridge controls, normal width, seeds,
admissions, one-shot materialization rule, and measurement are identical;
only the fixed engine force law differs. No arm may branch on source, case,
gap, target, impact, outcome, or previous result.

**Falsifiers.** Retire this compact form if either arm loses exact
materialization or normal-control availability; if the accelerated arm has no
legal width-1 normal return on dense or ordinary; if the solid arm matches or
exceeds the accelerated arm's legal normal-return pairs in all three fixtures;
or if the two-control force arm fails to reduce charged normal-boundary work
relative to the retained 24-control treatment. A pass authorizes only a tiny,
separately declared source-default candidate and normal broad scope panel—not
Benchmark V2.

**Result (2026-07-17, paired 0.13s solid and 0.14s type-1 runs of
`study_two_contact_shooting.ts --compact-force-comparison`; artifacts
`generated/studies/two-contact-shooting/transient-compact-force-comparison-*/`):
RETIRE the 1x2 compact force form.** The fixed first C1 admitted on dense
recovery but had zero joint bridge pairs in both arms; it did not admit at all
on amplitude tides, again identically in both arms. On sparse lowline, the
solid arm had no capture-arc materialized pair; the type-1 arm had 2/2
byte-stable pairs, normal controls available, but **0/2** legal normal-return
pairs and zero admissions. Thus the compact treatment fails materialization
on two independent sources and fails the declared dense/ordinary return
boundary; its lower 372-frame low-air normal-boundary charge is not valuable
without a return. The earlier full 24-control result remains physics evidence
only. Do not implement, widen, retune, source-branch, or V2-evaluate this
one-by-two form; a successor must be a distinct source-neutral production
component rather than another subset of the accelerated transient screen.

## Declared Observation: Terminal Endpoint-Continuation Normal Basis (2026-07-17)

The normal generator currently emits every line with both collision endpoints
bounded. The engine has a separate physical line flag: a `rightExtended` line
remains collidable for a bounded fraction beyond its terminal endpoint, with
the cap determined solely by the emitted line length. Unlike a new anchor,
normal frame, side, curve, support topology, or force law, this preserves all
sampled coordinates, segment tangents, active normals, candidate count, and
PRNG draws; it changes only whether the rider can remain on the final
post-contact surface at its physically adjacent endpoint.

**Cheap decisive protocol.** On the exact six-regime, two-seed WASM/500k
frozen-frontier panel used for the collision-side normal-pool observation,
replay each production raw-normal pool bit-for-bit. Then regenerate the same
attempt count and same coordinates, setting `rightExtended` only on the final
post-contact line of every valid proposal. Keep all other line flags,
geometry, normal side, evaluator, ordinary ranker, candidate count, and
charged exact gate unchanged. Retain every proposal's viability, objective,
axis RMS, and gate charge. This is an observation of one engine endpoint
primitive, not a source change or V2 run.

**Falsifiers.** Retire endpoint continuation if production replay is not
exact; if the extension is inert or does not improve both viable-pool strength
and regime-balanced best objective; if dense, pickup, or low-air has a
material viability or objective loss; or if equal-count admission charge rises
without a stronger viable pool. A pass authorizes only a separately declared
source-default implementation and broad scope panel, never direct V2.

**Result (2026-07-17, 56s total in three memory-isolated batches of
`study_collision_side_normal_pool.ts --terminal-end-extension`; artifacts
`generated/studies/terminal-endpoint-normal-pool/v1/`): RETIRE terminal
endpoint continuation.** All 24 declared frozen-frontier rows replayed the
production raw pool exactly. Extending only the final right endpoint produced
no viable-pool gain in dense, pickup, or low-air; representative and
development music each lost 0.25 viable candidates per row. The
regime-balanced best objective fell **−0.007809**, driven especially by
pickup (−0.028946) and low-air (−0.005389), while equal-count best admission
cost increased +0.001009. The endpoint flag changes exact candidate outcomes,
but it supplies no cross-regime basin and spends more to do so. Do not install
or condition endpoint extension, combine it with a side/force lane, or run a
scope/V2 evaluation; a successor must use a distinct normal physical
component, not a different endpoint subset.

## Declared Observation: Forward Tangential Acceleration on Ordinary Normal Curves (2026-07-17)

The compact transient force treatment is retired: its constructed C1 bridge
could not hand a legal state back to the ordinary sampler. That result does
not test the engine's type-1 contact law on an *ordinary* candidate that the
normal pool already knows how to construct and evaluate. A type-1 line applies
the engine's fixed 0.1 px/frame tangential impulse on each collision. Encoding
every raw normal segment in reverse order with its `flipped` bit inverted
preserves its exact geometric segment and active collision normal, while
orienting that impulse forward along the physical travel direction.

**Hypothesis.** Applied uniformly to an ordinary candidate, the impulse can
trade a little local carrier/air fidelity for a faster, less expensive
post-contact state. That is relevant even if one current axis worsens: the
unchanged exact objective includes the next-contact readiness which determines
whether the impact--speed catch toll compounds. This is a source-neutral
engine component, not a subset chosen from a transient control, an impact
threshold, a duration class, a source, or an observed result.

**Cheap decisive protocol.** Reuse the exact six-regime, two-seed WASM/500k
frozen-frontier panel and raw-normal replay used by the endpoint observation.
First require the production replay's attempt and coordinate-plus-side hashes
to match the generation-time snapshot exactly. Then regenerate the same
attempt count, RNG coordinates, line ids, gates, scorer, objective, and
candidate count, replacing every proposed solid normal line with its
reversed/flipped type-1 forward-acceleration equivalent. Record viable
admission, best exact objective (including readiness), axis RMS, best exact
cost, and charge. No compiler source change, source panel, or V2 run is
authorized by this observation.

**Falsifiers.** Retire the full-curve force basis if the raw replay is not
exact; if the accelerated form has no viable broad support; if the
regime-balanced exact objective and viable admission do not both improve; if
dense, pickup, or low-air has a material viable/objective collapse; or if the
additional exact-gate charge has no stronger pool behind it. A pass authorizes
only one separately declared source-default implementation and broad scope
panel. It does not authorize a conditioned subset, a transient combination,
or direct Benchmark V2.

**Result (2026-07-17, three memory-isolated batches of
`study_collision_side_normal_pool.ts --forward-acceleration`; artifacts
`generated/studies/forward-acceleration-normal-pool/v1/`): RETIRE full-curve
forward acceleration.** All 24 frozen-frontier production pools replayed
their generation-time coordinates, sides, and attempts exactly. The type-1
form remained viable in 23/24 rows, so this is a physical negative rather than
an unavailable-component artifact. Its regime-balanced viable-pool movement
was **−1.10 candidates/state** and its continuation-aware exact objective was
**−0.158746**; dense was −0.085623, representative −0.198724, pickup
−0.257894, low-air −0.074997, and development music −0.176493. Only two of
24 rows improved that objective, both at the same dense-dialogue checkpoint;
they cannot justify a source-neutral default or a post-hoc subset.

The acceleration form saved 337.075 exact admission frames/state, but the
cheaper work corresponds to weaker pool survival rather than a usable
impact--speed trade: best exact candidate cost also worsened −0.011579/state.
Axis RMS was essentially flat (+0.000895), confirming that local-axis
compromise did not buy downstream value. Do not install, condition, segment-
subset, or V2-evaluate this full-curve force form. A successor must be a
distinct physical component, not another selection of this rejected force
encoding.

## Declared Observation: Terminal Non-Collidable Release on Ordinary Normal Curves (2026-07-17)

The prior ballistic-release study constructed a new post-C1 scoop and is
closed for that geometry. A different engine component already exists in every
ordinary raw candidate: its terminal post-contact segment. The engine's type-2
line retains the exact visible geometry but has no collision response. Changing
only that final segment from solid to type 2 preserves the normal candidate's
capture surface, preceding support, coordinates, tangents, endpoints, PRNG
stream, and line count, while making the final carrier region a deterministic
release aperture.

**Hypothesis.** Some impact failures are not missing redirection but overlong
support: a candidate can be locally less stable after the target yet leave an
earlier ballistic state that is faster or better phased for the next impact
contact. The exact objective is intentionally allowed to trade current
air/carrier fit against next-contact readiness; no target threshold, source,
duration, impact result, candidate rank, or selected outcome controls this
single terminal-component treatment.

**Cheap decisive protocol.** On the same six-regime, two-seed WASM/500k
frozen-frontier panel, first replay every production normal pool exactly. Then
regenerate the identical raw proposals and change only the final post-contact
line's `type` from 0 to 2. Keep all geometry, flags, line ids, candidate
count, exact gates, scorer, objective, and per-attempt frame metering
unchanged. Record viable admission, continuation-aware best objective, axis
RMS, best cost, and total exact admission frames. This is an observation only:
no compiler source change, scope panel, or V2 evaluation is authorized.

**Falsifiers.** Retire the terminal release aperture if the normal control
does not replay exactly; if the type-2 form is broadly unavailable; if
regime-balanced viable admission and exact objective do not both improve; if
dense, pickup, or low-air materially loses viable/objective support; or if a
frame saving merely reflects earlier rejection without a stronger pool. A pass
authorizes only one separately declared source-default implementation and
broad scope panel—not a duration/source condition, a force combination, or
direct Benchmark V2.

**Result (2026-07-17, three memory-isolated batches of
`study_collision_side_normal_pool.ts --terminal-scenery-release`; artifacts
`generated/studies/terminal-noncollidable-release-normal-pool/v1/`): RETIRE
terminal non-collidable release.** Every one of the 24 production controls
replayed exactly. The aperture was available in 23/24 rows, and notably held
the viable-pool count *exactly unchanged in every row*—it is not rejected for
an availability collapse. It did produce the hypothesized mixed local/global
movement: the regime-balanced downstream objective rose **+0.011450**, driven
by representative (+0.018641) and pickup (+0.038016), while dense was
essentially flat-negative (−0.001308) and every low-air row regressed
(−0.006937 regime mean). Twelve rows improved objective and eight regressed.

That is insufficient under the declared promotion boundary: viable admission
never improved, the local axis RMS regressed −0.000907, and best exact cost
worsened −0.004973/state. It also saved 391.2 admission frames/state, but the
unchanged pool cardinality means this is a cheaper different trajectory, not
additional search capability. Do not relax the fixed pool-strength condition,
condition release by regime/target, combine it with endpoint/force, or run a
scope/V2 evaluation. Any successor must change a distinct physical component,
not choose a subset of this terminal-release aperture.

## Impact Frontier Discovery Probe v1 (2026-07-17)

The V2 archive makes impact the dominant headline lever, but it does **not**
establish a law of the engine. Earlier statements about a speed/impact
frontier were observations of particular geometry sources, prefixes, and
selection rules. They must be challenged whenever the physical transition
basis or its judge changes. The fast probe below is the repeatable starting
point for that challenge; it deliberately asks what the current exact pools
offer across axes rather than assuming that a worse speed score is or is not a
reasonable price for impact.

`npm run impact-probe` runs the immutable V2-jolt/500k panel in about 55
seconds on the campaign host: seeds 28 and 29 for four impact-demanding cases
(`frontier_dense_recovery`, `dense_dialogue_impact_contrast_10`,
`countercurrent`, and `believer_56_6s`) plus two non-impact traversal guards
(`frontier_low_air_endurance_4s` and `offgrid_conversation`). Its compact
accepted reference is
`benchmark/v2/studies/impact-frontier-probe-v1-baseline.json`; add `--detail`
when a proposal needs the per-prefix evidence. The tool performs 12 ordinary
full compiles, reports end-to-end impact/speed/air/validity deltas, and at
every impact-and-speed-authored prefix reports the exact forward-scored
candidate frontier. For each permitted *additional absolute speed error*
(0, .025, .05, .10, .20), it measures the best attainable impact repair, the
air/elevation movement, and the exact continuation-score/readiness price.
It neither changes selection nor authorizes V2 promotion.

The fresh accepted reference makes the distinction concrete. Across 4,054
exact scored pools (31,331 candidates), **42.06%** contain a material
(at least .025) impact repair with *no* added speed error; allowing .025 adds
only 1.83 percentage points, and larger speed allowances add none in this
population. The mean no-speed-sacrifice impact improvement is .03445, but its
mean forward handoff-score price is +9.61 and readiness movement is −.0269.
The four impact cases remain substantially under target (impact RMS .31343,
mean signed −.25197; all 8 runs valid). Thus the current observation does not
support a simple claim that sacrificing speed is the blocked lever. It also
does not prove a physical bound: the available repairs are being priced out by
the present continuation/judgment chain, and a new physical transition source
can alter the set being priced.

**Rule for exploration.** Use the probe to reject or retain broad mechanisms,
not to select a case, a constant, or a single-axis winner. A credible
mechanism may take a measured loss on speed, air, or another axis only when
the paired aggregate gain and both guards justify it; then it proceeds through
the ordinary broader scope panel and V2 funnel. The next physical study must
be independent of this current candidate pool: rebuild the entry-state and
collision-response envelope from frozen engine states, so that “unreachable”
is tested rather than inherited from the existing sampler.

## Impact Suffix Counterfactual v1 (2026-07-17)

`npm run study:impact-suffix` is the corresponding fast causal screen
(roughly 25 seconds on the campaign host), not another score proxy. It makes
one fixed 250k discovery compile for each of the six cross-regime V2-jolt
sources at seed 28, takes the last ordinary winner-prefix parent at one-third
of the authored contacts, and regenerates a fixed 32-proposal normal pool at
that immutable state. It then resumes the *same prefix* for a fresh equal
50k suffix budget. The predeclared arms are the winner-prefix incumbent; the
least-impact-residual candidate with no additional speed residual; a material
impact repair with a deliberately small `.025`–`.100` speed-residual loss, if
one exists; and the unconstrained impact specialist. Identical arms share one
deterministic replay and are marked as aliases. It changes no selector and is
not comparable to a full V2 result.

**First result: reject a speed-sacrifice explanation, but do not promote a
selector change.** All six winner-prefix incumbents were present in their
replayed normal pools. The no-extra-speed arm lowered immediate impact
residual in 5/6 states (4 material repairs); it was also the unconstrained
impact specialist in every state. No state contained the predeclared
small-speed-for-impact trade. So the proposed “accept a little worse speed”
lever was not merely unnecessary here—it was absent from this fixed ordinary
pool population.

The isolated-prefix continuation read is deliberately mixed. Three incumbent
controls and their alternatives completed under the equal 50k suffix: the
impact repair improved `believer_56_6s` by **+2.574** and
`offgrid_conversation` by **+10.251**, while it reduced `countercurrent` by
**−19.875**. Two otherwise valid 250k source runs could not be reproduced by
the prefix-only 50k incumbent control, so they are inconclusive rather than
losses; the fast dense source itself was invalid. This falsifies a universal
claim that an immediate impact repair necessarily harms the whole
continuation, while also falsifying an impact-first ranking rule: the same
fixed intervention can win or lose. The next mechanism must model or enlarge
the **transition state** broadly, not trade speed away or introduce an
impact-only hotfix. A full candidate requires a separately declared,
regime-balanced transition-source assay followed by the normal scope/V2
funnel.

## Impact Response Envelope v1 (2026-07-17)

`npm run study:impact-response` directly tests the physical interpretation
without changing the compiler. It permits only the two fixed `impact-probe`
seeds (28 discovery, 29 held-out); at the same six V2-jolt source families
and one-third winner-prefix boundary, it takes the first eight viable
ordinary raw proposals from attempts 0--31. Every baseline and deformation is
run through the current exact candidate gate with optional ride-out polish
disabled equally. The fixed basis applies `±2px` whole-catch displacement
along the measured incoming normal, plus `±3°` rotation of either branch
about the nearest physical contact vertex. It records current impact/speed/
air residuals and the existing predicted-next-readiness objective; it is not
a candidate source or a selector.

**Result: retain a response-state basis; reject the universal speed-loss
claim.** Discovery seed 28 supplied 48 exact baseline replays and 247 viable
deformations: **44** reduced impact absolute residual by at least `.025` with
no added immediate speed residual; **22** also had non-worse
predicted-next readiness. The fixed held-out seed 29 reproduced the physical
opportunity (48 baselines, 235 viable deformations, **49** material no-speed
repairs, **19** with non-worse readiness). Across both seeds, the strongest
single direction was a small negative post-contact pitch (56 material
no-speed repairs among 89 viable variations), but its mean readiness movement
was negative; the opposite pitch and normal offsets supplied other
non-worse-readiness repairs. Entry pitch was almost inert. The useful sign
varies by raw proposal and source, and simply taking the existing
quality-objective winner across the two post-pitch siblings reduces mean
impact on the discovery panel. Therefore neither a global pitch constant nor
an impact-first local chooser is authorized.

This is nevertheless a material revision to the physical diagnosis: the
normal geometry lies near engine-admitted impact directions that do **not**
intrinsically spend speed. The unresolved constraint is response-direction
identification and continuation robustness, not a scalar speed/impact law.
The next admissible mechanism is a separately declared, two-seed
cross-regime **response-rich normal candidate** assay: expose a fixed,
engine-measured local response family to the unchanged evaluator without
preselecting its sign, prove equal-budget traversal economics, then proceed
only if it improves a broad scope panel. Do not add a pitch gate, a target
threshold, a selector weight, or a case-conditioned branch from this
discovery panel.

**Immediate source-boundary smoke: RETIRE replacement projection.** A
default-off experimental branch was tried only on the shared Countercurrent
250k/seed-28 smoke. For every normal proposal it evaluated both post-pitch
siblings and *replaced* the original only when a sibling had strictly lower
impact residual, no worse speed/air/elevation residual, and no worse existing
readiness objective. Despite that local dominance rule, the valid control
(`654.987`, 79 committed gaps) became an early 65-gap `rideStalled` failure
(`0.0004`). The branch was removed without a scope run or commit. This is not
a contradiction of the physical envelope: a locally dominating response can
still erase a branch whose precise downstream geometry the prediction does
not capture. It rules out replacement projection. Retaining an additive raw
fallback is a necessary safety condition, but it is not sufficient evidence
for a response-rich compiler candidate.

**Additive smoke correction: RETIRE the local-prediction additive form too.**
The required raw fallback was then retained and a single response sibling was
added only when the same strict local dominance rule held; the normal handoff
and forward evaluator ranked the enlarged pool unchanged. The identical
Countercurrent 250k/seed-28 smoke still stalled early (60 committed gaps,
`0.000003`) instead of reaching the valid control's 79-gap `654.987` result.
The raw candidate remaining available is insufficient when the current
predicted-readiness/forward chain admits the wrong response transition. This
additive experimental branch was also removed without a scope run or commit.
Do not resurrect it by changing a threshold, pool width, pitch, source rank,
or target subset. The response observation remains physical evidence, but a
future production treatment would first need a genuinely **actual-suffix**
continuation certificate whose cost and search effect are independently
screened; that is a different judge architecture, not a response-pitch
candidate tweak.

**Read-only one-step certificate (both fixed seeds): necessary but still not
sufficient.** The response probe's `--continuation` mode now takes every
strictly locally dominating response sibling and requests the exact
production next-candidate pool at ordinary width 8 from both the original and
response prefix at the actual next contact. Of 44 paired response candidates
across seeds 28 and 29, **35**
preserved or increased next-pool viable width, but only **15** preserved both
that width and the next pool's best exact quality objective. Only **7** of
those 15 were material current-impact repairs; none came from dense recovery.
Thus a physical response direction and even next-contact availability do not
establish a durable two-contact improvement. The observation does explain the
replacement/additive stalls and provides a falsifiable future boundary: do not
build a response source unless an actual-suffix certificate—not a ballistic
or one-step proxy—can retain the original continuation under a declared
equal-budget economics test.

**Actual-suffix result: RETIRE the fixed local response family.** The same
two-seed screen then resumed an independent equal 50k suffix from every pair
that passed the one-step certificate (15 pairs). Only seven base controls and
responses were both valid enough to compare: the response won three and lost
four, with mean score movement **−1.802**; one further response lost validity
against a valid base. The two Countercurrent responses won `+20.545` and
`+19.044`, but Offgrid lost all three comparable pairs (`−44.633`, `−16.464`,
`−6.045`) and Believer was mixed. This is the requested physical trade-off
test in its strict form: even no-speed local repair plus an actual next-pool
certificate does not yield a stable completed continuation. Do not deepen the
certificate, alter its budget, search pitch/offset constants, add a response
lane, or retest a subset. A successor must change the **multi-contact physical
candidate basis** itself rather than locally perturb an already normal catch.

## Declared Audit: Body-Point Collision Contribution in Ordinary Normal Pools (2026-07-17)

The current probe has reopened the physical question: many impact-improving
pool candidates are priced out without a speed-error price, so neither the
existing sampler's speed/impact relationship nor its collision abstraction
should be treated as the engine envelope. The engine resolves contact for four
sled points plus six body points. This audit asks whether ordinary current
normal geometry already obtains a useful first response through a body point,
which would justify a genuinely distinct collision-topology primitive rather
than another slope, scoop, force, or rank variation.

**Read-only protocol.** Freeze the same six-source/two-seed V2-jolt/500k
panel used by `impact-probe`; at the first one-third and two-thirds ordinary
frontier states per run, retain the generation-time raw-normal pool snapshot.
Replay every raw proposal at identical PRNG coordinates through unchanged
`sampleOneCandidate`. For viable candidates only, query the engine's native
collision updates from one frame before the current authored contact through
the current axis horizon, retaining only collisions on candidate-owned line
ids. Report first-collision as well as later sled/body point identities, impact absolute residual, exact
current-quality × predicted-next-readiness objective, and local cost. The
audit changes neither geometry nor selection.

**Predeclared falsifier.** Retire body-point topology before a geometry build
if body-side candidate-line collisions are absent on a material majority of
usable states, or no body-contact candidate weakly dominates a sled-only
candidate on both impact residual (lower) and the exact objective (higher),
with one strict improvement, in any broad regime. A pass authorizes only a
separately declared physical primitive assay; it chooses no body point, source
form, or compiler parameter.

**Outcome: RETIRE point-specific topology; retain the collision fact.**
`scripts/v0/study_body_point_collision_audit.ts` replayed all 24 declared
states exactly (498 viable raw-normal candidates; 24/24 geometry hashes and
attempt prefixes reproduced). Body contact is real rather than absent: 374
candidates have it somewhere in the read window and 189 have it in the first
candidate-owned collision frame. But every first body point is a foot, and
**187/189** first-body events coincide in the same frame with sled contact.
The two body-only first events (both at dense-dialogue seed 29, gap 43) are
poor: impact absolute residual `.536`/`.526`, objective `.0192`/`.0180`.

Coupled foot-and-sled normal candidates do weakly dominate sled-only controls
in two representative-dense states (34 pairwise comparisons), so treating
the rider as a sled-only body would be factually wrong. It does **not** supply
a distinct physical component: the useful events are simultaneous ordinary
normal collisions already present in the pool, while isolated body-first
contact is uncompetitive. Do not build or tune a point-specific line source,
pose gate, or body-contact selector from this signal. A future successor would
need a different multi-point constraint or contact-order mechanism, first
shown to create a useful non-simultaneous response in an exact broad assay.

## Declared Study: Engine-Realized Normal-Pair Endpoint Bridge (2026-07-17)

The fixed response family is closed: a local offset or pitch cannot be revived
as a source. The next assay instead starts from two **sequentially
engine-admitted ordinary normal fits**. It retains their capture geometry and
derives one three-segment cubic-Hermite bridge from the first fit's terminal
endpoint/tangent and the second fit's entry endpoint/tangent. Tangent extent
is a continuous function of those exact engine-realized endpoints, release
speed, and literal inter-contact frames; it has no case, duration, axis,
source, rank, or response-sign branch. The exact next-contact gate evaluates
the bridge plus the second ordinary geometry together. This is a new joint
normal-pair basis, not a response pitch, static C1 capture, transient scoop,
or selector change.

`npm run study:joint-normal-bridge` freezes the six-regime V2-jolt panel
(dense, dense impact, representative, development music, low-air, pickup),
seeds 30 and 31, 250k prefix compilation, and the first four viable ordinary
current fits from raw attempts 0--31. Each current fit receives the first
viable next ordinary fit from a fixed eight-attempt stream. The direct normal
pair is the control; the bridge is one deterministic candidate construction,
not a menu. It records all generated pairs, exact gate results, two-contact
axis RMS, impact residual, and additional simulation frames.

**Discard before source work:** retire if the bridge is unavailable or
joint-invalid on a material share of either seed's broad panel, if it has no
mean two-contact RMS improvement of at least .005 among comparable valid
pairs, or if any dense, pickup, or low-air regime has no comparable valid
bridge pair. A pass is feasibility evidence only: it would authorize a fresh
held-out economics assay, then (only if that is broad and charge-bounded) a
source-default implementation and the ordinary V2 funnel.

**Outcome: RETIRE at the declared feasibility gate.** The sealed 12-state
screen completed in 25.8 seconds (`generated/studies/joint-normal-bridge/v1/`):
all 45 current normal candidates and 40 direct normal pairs were observed, and
the endpoint bridge had finite geometry on all 40. Only **3/40** bridge pairs
passed the unchanged next-contact gate (2 development-music, 1 representative;
0 dense, 0 pickup, 0 low-air). The three surviving bridges had exactly zero
mean two-gap RMS movement and cost 17.67 additional simulated frames on
average. This fails availability, cross-regime coverage, and the `.005` RMS
criterion. Do not tune Hermite extent, segment count, endpoint selection, or
collision side, and do not add a bridge source: appending a collidable surface
between two otherwise valid normal contacts is not a viable physical basis.

## Declared Study: Two-Contact Normal Coordinate Interpolation (2026-07-17)

The bridge failure leaves the ordinary contact geometry itself intact. The
normal sampler has eight continuous raw coordinates per attempt, but it redraws
them independently at each contact. This assay asks whether a locally valid
two-contact normal basin exists **between** ordinary samples, without adding
terrain, a response deformation, a target threshold, or a new judge. At each
frozen prefix it records the raw eight-coordinate vectors for the first eight
viable ordinary current fits. Consecutive pairs `(0,1), (2,3), …` yield one
coordinate midpoint; that midpoint regenerates the current normal contact and
then, from its exact engine state, the next normal contact using the same
midpoint vector. The left ordinary coordinate vector, regenerated at both
contacts, is the equal-width control. Candidate gates and all measured axes
are unchanged; no midpoint is selected by a score in this assay.

`npm run study:joint-normal-coordinates` freezes the V2-jolt/500k six-regime
panel at fresh seeds 32 and 33. It retains every control/midpoint outcome and
the two-contact RMS, impact residual, validity, and charged frames. The
mechanism is a fixed continuous trajectory basis over existing sampler inputs,
not a Halton coverage sequence, a pool-width change, or a predecessor-grade
controller.

**Discard before source work:** retire if midpoint pairs are not valid on a
material share of either seed's panel, have no mean two-contact RMS improvement
of `.005` among comparable pairs, or produce no comparable dense, pickup, or
low-air row. A pass only authorizes a fresh economics comparison that charges
the midpoint as one additional normal proposal; it does not authorize a source
or V2 evaluation.

**Outcome: RETIRE at the aggregate quality gate.** The sealed 12-state
WASM/500k cohort completed as three memory-isolated four-state batches because
the host reclaims a long parent process before it can publish an artifact;
`--aggregate` verifies all twelve frozen state artifacts before reading them.
The result has 35 coordinate pairs: direct normal pairs valid 25 times and
midpoints 28, with 24 comparable two-contact results. That extra local
availability did not convert: mean two-contact RMS movement is **−.001255**
(required `+.005`), with representative **−.012821**; dense `+.001459` and
development music `+.001495` are too small and do not offset it. Mean charged
work also rose 41.60 → 57.63 frames. Do not alter the pairing, midpoint law,
attempt-coordinate inheritance, raw-coordinate span, pool width, or invoke a
source/economics stage. Local interpolation of viable normal coordinates is
not a coherent multi-contact trajectory basis.

## Declared Study: Collision-Incidence Transport in the Normal Basis (2026-07-17)

The two preceding negatives leave one separate state variable untested: the
**measured collision incidence**, i.e. the signed angle from incoming sled
velocity to the candidate segment at an owned contact. This is neither the
previous terrain grade, contact anchor phase, airborne age, energy integral,
nor a post-contact response pitch. At the next contact, a normal proposal is
regenerated from its exact child engine state with all eight ordinary raw
coordinates unchanged except the contact-angle coordinate. That coordinate is
shifted by the continuous first-order correction needed to reproduce the
previous measured incidence in the new incoming velocity frame. The unshifted
same-coordinate normal proposal is the control. No output, target threshold,
case, duration, selector, or exact result chooses the correction; exact gates
and the ordinary ranker would remain the sole authorities for any future lane.

The initial discovery command uses V2 jolt/500k, fresh seed 34, and the fixed
six-regime panel in two memory-isolated batches:
`npm run study:collision-incidence -- --batch=0`, then `--batch=1`, then
`--aggregate`. It uses the first four viable current ordinary proposals from
raw attempts 0--31 and tests every one. The fallback validation seed is 35 and
is frozen now but may run only if the discovery result clears its whole-panel
boundary without changing any coordinate law.

**Discard before source work:** retire if the shifted candidate has no mean
two-contact RMS gain of `.005` across comparable discovery pairs, lacks a
comparable dense, pickup, or low-air row, or carries material validity loss.
Only a discovery pass authorizes the untouched seed-35 replication, then a
separate charge/economics assay; it never authorizes a pitch tweak or source
lane directly.

**Outcome: RETIRE at the declared broad quality gate.** The sealed discovery
screen completed as two memory-isolated V2-jolt/500k batches and retained all
six states, all 24 current-normal rows, and 19 comparable exact next-contact
pairs. Transport neither created nor lost accepted next fits (19/24 in each
arm), but its mean two-gap RMS improvement was only **+.002703**, short of
the required `+.005`. More importantly, it regressed in both required broad
regimes: dense **−.000893** and low-air **−.001108** (pickup was `+.008167`).
No seed-35 replication, charge study, source lane, or coordinate-law tuning
is authorized. Exact preservation of one contact's measured velocity/segment
incidence is not a reliable cross-contact physical invariant in the ordinary
normal basis.

## Declared Study: Velocity-Leading Sled Anchor for the Normal Basis (2026-07-17)

The ordinary sampler positions every catch at the lowest projected sled point
at the target frame. Lowest-in-world-y is a gravity convention, not the
actual leading contact point during an oblique arrival. This study tests one
different physical anchor: among the engine's four sled points at the exact
target state, place the same ordinary contact curve at the point with the
largest projection along the incoming COM velocity. The sampler retains the
COM velocity, all eight raw coordinates, attempt index, candidate count,
collision side, geometry law, exact gate, and pool judge. Thus it changes the
contact location only—not the already-retired point-velocity frame, pose
gate, local response pitch, selection, or a target-specific source. Point
identity follows a continuous physical extremum; no case or outcome is read.

The discovery screen is a fixed V2-jolt/500k seed-36 six-regime panel, with
the first ordinary frontier state at one-third of authored contacts for each
of dense, second dense, representative, development music, low-air, and
pickup. `npm run study:velocity-leading-anchor -- --batch=0`, then
`--batch=1`, then `--aggregate` runs three states per memory-isolated batch.
Before the anchor comparator is read, the ordinary arm must reproduce each
generation-time raw-normal attempt and geometry hash exactly. Seed 37 is
frozen for an unchanged replication only if discovery clears every boundary.

**Discard before source work:** retire if production replay fails; if the
velocity-leading anchor differs from the ordinary lowest anchor in too little
of the panel to be a real alternate physical state; if it does not jointly
improve regime-balanced viable admission, best exact quality-times-readiness
objective, and best-axis RMS; or if dense, pickup, or low-air loses material
pool support. A pass would permit only a seed-37 replication, then one
separate source-default/economics assay. It never authorizes an anchor blend,
point-specific branch, coordinate sweep, or V2 evaluation directly.

**Outcome: RETIRE at the pool-strength boundary.** The two sealed
memory-isolated discovery batches captured all six states and reproduced all
six ordinary generation-time pools exactly. The alternate anchor was active
in every state (ordinary `NOSE`, velocity-leading `STRING`), so the result is
not a same-anchor null. It nevertheless destroyed the cross-regime pool:
regime-balanced viable admission changed **−3.3/state**, dense **−12.5**,
pickup **−3**, and low-air **−5** (the latter's 5 accepted ordinary fits became
zero). Best exact quality-times-readiness also fell **−.035625** overall,
despite small axis-RMS movement in a few surviving rows. Do not reverse the
projection, blend anchors, choose a point identity, alter the sampling frame,
or run seed 37/source work. The ordinary lowest-world-y anchor is not merely
an arbitrary gravity convention under the current exact contact gate.

## Declared Study: Sled-Pose Tangent Frame for the Normal Basis (2026-07-17)

The ordinary sampler derives the contact curve's tangent frame exclusively
from COM travel direction, even though collision is resolved on a sled with a
separate measured TAIL-to-NOSE axis. The rejected lowest-point-velocity and
velocity-leading-anchor studies did not test that axis: one retained COM
heading and changed point velocity, the other retained it and changed
position. This study changes only the normal generator's **tangent reference**
to the exact sled-axis angle, selecting its equivalent direction modulo 180°
that is closest to the incoming COM heading. It retains the ordinary lowest
point anchor, COM velocity/speed, eight raw coordinates, attempt index,
candidate count, collision side, geometry law, exact gates, and pool judge.
It is a state-normalized geometry frame, not a pose gate, pose-conditioned
branch, local response pitch, anchor blend, selector, or source lane.

The fixed discovery screen is V2-jolt/500k, fresh seed 38, and the same six
one-third ordinary frontier states across dense, second dense,
representative, development music, low-air, and pickup. It is run in two
memory-isolated batches with `npm run study:sled-pose-frame -- --batch=0`,
then `--batch=1`, then `--aggregate`. The normal control must first reproduce
each generation-time raw attempt and geometry hash exactly. Seed 39 is
reserved for an unchanged replication only after an all-boundary discovery
pass.

**Discard before source work:** retire if the sled axis is unavailable or
materially aligned with COM in too much of the panel; if the same-coordinate
pose-frame pool does not jointly improve regime-balanced viable admission,
best exact quality-times-readiness, and best-axis RMS; or if dense, pickup,
or low-air materially loses support. A pass authorizes only seed-39
replication followed by a separate source/economics assay. Do not tune a pose
offset, mix frames, choose point identities, or run a V2 evaluation from this
screen.

**Outcome: RETIRE at the broad pool gate.** The two sealed seed-38 batches
captured and exactly replayed all six ordinary pools. The physical axis was
not inert: every row differed from COM, with a mean absolute tangent-frame
shift of **17.852052°**. It still reduced regime-balanced viable admission by
**4.7/state**, best-axis RMS by **−.030436**, and best exact
quality-times-readiness by **−.138211**. Dense lost 6.5 fits/state and the
representative row collapsed 20 accepted ordinary fits to zero; pickup held
count but lost objective. No seed-39 replication or source is authorized. Do
not offset/mix the pose frame, condition it on contact state, or combine it
with a rejected anchor: direct sled-axis orientation is not a viable ordinary
normal basis under the exact gate.

## Declared Audit: Pose-State Relation to Ordinary Multi-Contact Survival (2026-07-17)

Directly substituting the sled-axis tangent for COM travel is closed, but it
does not establish whether the physical pose state matters across a chain. At
each exact ordinary contact state the engine exposes two independent values:
the sled-axis mismatch to COM travel (modulo 180°) and its one-frame angular
rate. This read-only audit replays the frozen WASM/500k believer36 and
believer69 five-contact fixtures using only the ordinary 24-attempt stream
and the ordinary exact local-cost choice. It changes no coordinates, target,
candidate, rank, or traversal. For every reachable state it records pose
mismatch, absolute angular rate, ordinary viable count, and whether the
remaining chain completes; comparisons are made only within fixture and
contact-depth strata so later-chain difficulty cannot masquerade as pose.

`npm run audit:pose-chain-state -- --trials=96` is the entire frozen
calibration. The physical prediction is that the highest quartile of either
pose instability measure has materially lower remaining-chain completion than
the lowest quartile in both fixtures. This is a diagnostic, not a selection
screen: it can authorize only one later, separately declared pose-carried
trajectory construction if a coherent association is present.

**Discard before construction:** retire pose-state trajectory work if either
state cannot be read on a material share of ordinary chain states, if neither
mismatch nor rate has at least a 1.5× high-versus-low remaining-chain loss in
both fixtures after depth stratification, or if either frozen physical-prefix
replay is not exact. Do not turn a descriptive association into a pose gate, tangent
frame, offset, pitch, or selector without a new physical construction and
its own falsifier.

**Outcome: RETIRE pose-state trajectory work at the declared cross-fixture
gate.** Both frozen physical-prefix replays matched exactly and pose was
readable at every observed state (104 believer36 and 416 believer69). The
control itself made believer36 non-identifying: ordinary local-cost sampling
completed **0/96** five-contact chains, so it supplied no high-versus-low
remaining-survival contrast. Believer69 alone did show an association after
depth stratification—low versus high axis-mismatch completion
`.530864/.341176` (**1.556×**) and low versus high absolute angular-rate
completion `.555556/.223529` (**2.485×**). That one-fixture signal cannot
establish a broad causal state, while the independent believer36 fixture
cannot meet the predeclared comparison. No pose-carried construction, gate,
frame blend, pitch/offset law, source lane, or replication is authorized.
Pose remains a descriptive continuation marker, not an evidenced compiler
input.

## Declared Observation: Complete-Body Gravity Support Anchor (2026-07-17)

The ordinary normal source anchors its placement at the lowest sled point even
though the exact engine resolves collisions for four sled and six articulated
body points. The body-collision audit showed useful ordinary events are usually
simultaneous sled-and-foot contact, so this is the narrow remaining
multi-point coordinate question: does the full collision body's physical
gravity support point differ from the sled-only placement anchor often enough
to expose a new source-neutral normal pool?

**Protocol.** Freeze the same six-regime, two-seed V2-jolt/500k frontier
panel used by the normal-pool physical observations. At each one-third and
two-thirds ordinary frontier state, first reproduce the production raw-normal
attempts and geometry hashes. Re-run the identical attempt count and all eight
raw coordinates, COM velocity, target values, normal gates, scorer, and
rank-independent pool measurement; replace only the geometry anchor with the
maximum-y point of all ten engine collision points (`PEG`, `TAIL`, `NOSE`,
`STRING`, `BUTT`, `SHOULDER`, both hands, and both feet) at that exact target
frame. This is the point that first meets a gravity-aligned floor. It names no
body point, adds no pose gate, and cannot branch by source, target, outcome,
or contact order. The existing pre-target and exact candidate gates remain
unchanged.

**Falsifier.** Retire this coordinate form if the full body has the same
gravity support point as the sled at every declared state, or if a nontrivial
anchor movement fails to improve both broad viable-pool strength and the
regime-balanced continuation-aware objective without a dense, pickup, or
low-air collapse. A pass would authorize only a separately declared
source-default implementation and scope panel.

**Result (2026-07-17, three memory-isolated two-source invocations of
`npm run study:all-body-support-anchor -- --case=...`; artifacts
`generated/studies/all-body-support-anchor-normal-pool/v1/batch-{0,1,2}.json`):
RETIRE complete-body gravity support anchoring.** All 24 frozen rows reproduced
their production raw pools exactly. On every row, the existing lowest sled
point was also the complete collision body's maximum-y gravity support point:
all recorded anchor deltas were exactly `(0, 0)`. The alternate construction
therefore regenerated the same geometry and had zero movement in viable count,
best scorer-axis RMS, continuation-aware best objective, and local cost on
every row with viable candidates. One already-empty production pool has no
quality comparison; its different charged termination work is not a physical
effect because both arms have zero viable candidates and identical anchors.

**Decision.** Do not implement an all-body gravity anchor, smooth/weight the
body points, select a foot, or combine this inert coordinate with a pose,
force, or response mechanism. The body audit's simultaneous foot-and-sled
fact does not reveal a different gravity-contact surface. A future multi-point
candidate must change collision order or another exact physical constraint,
not relabel the same support envelope.

## Declared Observation: Candidate-Normal Complete-Body Support Plane (2026-07-17)

The complete-body gravity anchor is inert because the sled is the vertical
support point at every frozen state. That does not settle the physically
different tilted-surface question: an ordinary candidate collides against its
own contact plane, and a foot or another sled point can lead along that
candidate's gravity-facing normal even while it is not vertically lower. This
form therefore constructs a support plane from the full collision body without
selecting a named point or changing a normal control.

**Protocol, declared before rows.** On the same frozen six-regime,
two-seed V2-jolt/500k frontier panel, reproduce the production raw pool first.
For each same-coordinate normal proposal, identify its geometry's closest
contact vertex to the ordinary target anchor and its outgoing surface tangent.
Orient the perpendicular toward gravity; project all ten exact engine
collision points onto it; then translate *every* candidate line by the
continuous difference between the maximum complete-body projection and the
ordinary sled-anchor projection. All tangents, line types, endpoint flags,
raw coordinates, candidate count, COM velocity, targets, gates, scorer, and
rank-independent pool measurement remain unchanged. Record the support-point
identity and translation for every proposal. No body-point selection, pose
gate, source/case branch, target/outcome branch, or collision result informs
the construction.

**Falsifiers.** Retire if any target-state body point is unreadable; if the
candidate contact vertex cannot be read on a material share of proposals; if
the translation is identically zero; or if the exact alternative lacks a
regime-balanced viable-pool and continuation-aware objective improvement with
no material dense, pickup, or low-air loss. A pass authorizes only a new,
separately declared source-default implementation and ordinary scope panel;
it does not authorize V2 evaluation.

**Result (2026-07-17, three memory-isolated two-source invocations of
`npm run study:surface-normal-body-support-anchor -- --case=...`; artifacts
`generated/studies/surface-normal-body-support-anchor-normal-pool/v1/batch-{0,1,2}.json`):
RETIRE candidate-normal complete-body support.** Production raw pools replayed
exactly on all 24 rows; every one of the 720 regenerated geometries exposed a
readable contact vertex and all ten body points. The component is physically
nonzero but far too sparse and small: only **47/720 (6.5%)** proposals moved,
with a maximum normal translation of **0.993 px** and a mean per-row absolute
translation of **0.0161 px**. The leading plane point was `NOSE` on 545
geometries, then `TAIL` (81), `STRING` (80), `RHAND` (8), and `RFOOT` (6);
there is no selected point or hidden policy in that accounting.

That microscopic coordinate change produced **zero viable-pool movement** in
every regime and no objective improvement. The only quality movement was on
pickup: one Offgrid row lost axis RMS `.002790`, and another lost objective
`.000352` (with axis RMS `+.000198`); dense, representative, low-air, and
development music were otherwise exact-quality neutral. A pre-existing empty
Believer pool has no quality comparison, so its different rejection charge is
not a gain. This fails the declared broad-pool/objective boundary.

**Decision.** Do not install, amplify, smooth, point-select, or combine this
candidate-normal support translation with force, pose, or response work. The
full collision body's support plane is almost always already represented by
the ordinary sled placement; rare sub-pixel deviations do not alter the
multi-contact basin. A successor must change collision order through a new
physical component, not rescale this envelope residual.

## Workflow Notes

- Generated scope outputs are ignored under `generated/`; this document retains
  the values needed to understand the decision.
- `npm run verify:optimizer` currently reports divergence from its checked-in
  fixture for this committed candidate. The fixture is an older historical
  output, not a source-bound candidate gate; reconcile it with an explicit
  source identity rather than overwriting it during a compiler experiment.
- The repository-wide `npx tsc --noEmit` is not a supported type gate: its
  compiler options reject the project-wide `.ts` import convention and report
  existing unrelated errors. Use executable focused checks and the benchmark
  funnel until that configuration is separately repaired.
