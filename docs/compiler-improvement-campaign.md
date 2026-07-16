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
