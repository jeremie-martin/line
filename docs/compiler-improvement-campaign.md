# Compiler Improvement Campaign

Target: improve the Benchmark V2 headline through changes that make the normal
compiler more capable and accurate across a broad range of authored scores.
`npm run benchmark -- eval` is the reusable screen; only a fresh certified
`eval --to-verdict` can promote a source-default change. The active baseline
contract is `accept-2026-07-15T15-24-50Z-e4890b0e`.

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
