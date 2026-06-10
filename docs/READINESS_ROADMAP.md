# Readiness — roadmap

2026-06-10 · branch arc-rewrite · canonical baseline `scoop-off-price-01`
(600.91; R2 promoted → defer removed → joint multi-knob current instance
promoted → scoop + legacy lanes deleted: ONE proposer remains, per the design
commitment). Prerequisite reading: `ARC_STATE_CONTROL.md` (the aiming layer:
concept, invariants, instance choices — this roadmap is its phase 2);
`IMPACT_PAIR_PLANNING.md` (the impact diagnosis). This is a ROADMAP: rungs
are falsifiable and most later content is contingent on earlier outcomes —
it is written to survive any of those outcomes, not to predict them.

## 0. Origin and discussion outcomes (agreed 2026-06-10)

The idea (Jérémie): introduce **readiness** — a model predicting whether the
rider's arrival state (speed, CoM velocity angle, **sled pose / internal
rotation**) sets the NEXT gap up for success — and use it, together with the
existing local predictive models, inside an **enumerative proposer**:
generate many cheap knob variations *inside the model* (predictions are
~free — quadratic evaluations), score each as predicted current-gap quality
× readiness, and propose only the top few into the candidate pool, where the
unchanged search measures and ranks them.

Why this is the right generalization: the two shipped aimers are special
cases of it, hand-built. Speed-aiming (V3) maximizes the speed-compatibility
component of readiness; the dive-scoop pair (V4) maximizes the
impact-feasibility component when the next beat asks for impact. Readiness
subsumes their *triggers* (the hand-coded if-statements deciding what to aim
for) and adds the component nothing has today: **pose**. Generation
currently conditions the catch surface on where the mass is GOING
(`contactAngleDeg` ≈ arrival velocity angle ± sampled jitter) and is blind
to where the rider is POINTING — a wrong pose is discovered only when the
next gap's samples fail their gates: late, expensive, invisible to
forward-eval.

Decisions made in discussion:

- **Ground truth vs model.** Readiness itself is never measured directly.
  The measurable ground truth is the next gap's REALIZED outcome (catch
  gates passed, impact converted, axis errors). Readiness is a model
  predicting that outcome from the arrival state alone, validated against
  it — same discipline as the aim telemetry pricing prediction error. (This
  resolves "is it an axis? a metric? a model?" — a defined metric IS a
  model with a hand-chosen shape; the study's job is to fit the shape from
  data instead of guessing it.)
- **Scope: next gap only.** Conceptually readiness extends to the rest of
  the track; in practice one gap ahead is the operating definition.
- **Form: smooth, [0,1], multiplicative.** A plateau near 1 over the
  acceptable region, smooth falloff to 0 (not binary — smoothness keeps the
  enumerative ranking well-behaved). Multiplicative with predicted
  current-gap quality (no point maximizing a gap whose successor is
  unreachable), **clamped away from 0** so a wrong readiness model cannot
  silently veto all diversity. Working choice, revisitable.
- **Proof-of-concept component: catchability** = is the pose compatible
  with the arrival velocity direction (intuition: pose roughly tangent to
  the velocity / surface; head pointing down at contact ⇒ uncatchable).
  Exact shape comes from R0 data, not intuition.
- **Joint model shape, current per-knob implementation.** The generic
  proposer is a multi-input model over arc knobs. Today's production
  implementation is the current special case: exit pitch and whole-arc
  rotation each have their own probe-fit model; rotation is recruited lazily;
  and the two responses are additively composed only where pitch is
  exhausted. That keeps the same swappable joint/top-k interface without
  pretending we already have a learned combined knob surface.
- **Proposer side first.** Readiness shapes WHICH candidates are proposed
  and ranks them *inside the proposer* (model-only, no simulation); every
  proposed candidate still passes the exact production evaluation; the
  search's judge (local cost + forward-eval) is untouched. Ranking/judge
  integration is a late, separately gated rung (§R4) — we have a scar there
  (impact local-cost pressure traded 1:1).
- **Top-k proposals.** The thousand variations exist only inside the model;
  the current measured knee is k=2 winners simulated and joined to the pool.
  Replacing or shrinking the random sampler is NOT assumed — it is a late,
  evidence-gated rung (§R4) with a known scar (attempt-0 replacement:
  −29.5).

## 1. Definitions

- **Arrival state** s = (speed, CoM velocity angle, sled pose[, more later —
  e.g. pose angular velocity if wrapping ever binds]). All free reads from
  one probe ride (`ProbeOutcome`) or the gap probe (`CandidateProbe`).
- **Ground truth** y = realized next-gap outcome, measured exactly by the
  pipeline that already exists: landing gates (survival, ±1f window,
  off-beat), achieved impact vs ask (conversion), next-gap axis errors.
- **Readiness model** r(s, next-gap targets) → [0,1], smooth. v0 component:
  catchability r_catch(pose − f(comAngle)). Later components (R3):
  impact-feasibility (physics prior exists: needed turn =
  asin(ask·REDIR_CAP/speed); lab landings: high redirection needs vy_in
  ≈ 4–6), target-speed compatibility.
- **Proposer objective** (R2): maximize predict(current-gap quality) ×
  clamp(r, r_min, 1) over enumerated knob deltas.

## 2. Rungs (each falsifiable before the next)

### R0 — Catchability ground truth (lab study; zero compiler change)

Question: **does pose at arrival predict catch success and impact
conversion, beyond what speed + CoM angle already predict?**

- Data: archives do NOT record pose — two paths, use either/both:
  (a) a dedicated sweep study (`study_arc_sensitivity.ts` pattern): on
  compiled tracks, read pose + CoM state at each gap frame
  (`sledPoseDegFromRider` — already plumbed) and join to the next catch's
  realized gates/conversion; (b) extend the lab's on-demand landings
  re-simulation tier to record pose at contact.
- Analysis: gate-pass rate and conversion residue binned by
  (pose − comAngle), controlling for speed and comAngle (the confound:
  pose may just track comAngle; the question is the RESIDUAL predictive
  power). Compare models cheaply while we're there: (pose, comAngle) vs
  (pose, comAngle, speed).
- Deliverables: the empirical catchability curve (the plateau and falloff
  Jérémie hypothesized — fitted, not guessed); a verdict.
- Falsified if: pose adds no residual predictive power over speed+angle.
  Then readiness proceeds WITHOUT a pose component (impact-feasibility and
  speed-compatibility remain) and pose steering is parked with a verdict —
  the roadmap survives.

**VERDICT (2026-06-10, `study_catchability.ts`, 2,871 arrivals × 8
production re-fits @300k — `generated/analysis/catchability_300k.{jsonl,txt}`):
pose component PARKED; the study delivered the (speed, angle) readiness
surface instead.**

- Tier-B catch rate is FLAT across |pose − comAngle| from 0° to 90°
  (79–82%); only >90° misalignment degrades it (62%) — and that regime is
  4.2% of arrivals, still majority-catchable. OLS ΔR² for pose terms over
  speed+angle: +0.019 (0.333 → 0.353). Stratified pooled Δ: +5%,
  incoherent across strata. Impact conversion equally flat (0.31–0.36
  until >90°: 0.28). Jérémie's directional intuition (backwards pose hurts)
  is CONFIRMED but the magnitude and incidence are too small to carry a
  readiness component at the current operating point. No fast-spin/wrap
  regime observed (pose rate p50 1.0°/frame, 0% >45°/f).
- Why so robust: the production sampler builds the catch FROM the CoM
  arrival; engine contact dynamics tolerate large pose offsets. Pose is
  emergently self-correcting at catch — the filter generation already has
  (gates) suffices.
- **The constructive result — the empirical catchability surface
  r(speed, comAngle), the thing R1 needed**: catch rate spans 20% → 95%
  across the surface, far more structure than pose carried:
  steep+fast arrivals are dramatically more catchable (angle 20–30° ×
  speed 10–12: 92–95%) than shallow/slow (angle 0–5° × speed 6–8: 20%)
  or upward (angle<0: 39%). Monotone in both inputs up to ~30°.
  This vindicates the V3/V4 design post-hoc (speed- and steep-aiming both
  push toward the high-catchability corner) and gives R1 its readiness
  curve from measured data, not intuition.
- Tier-A footnote: the fixed committed catch passes only ~14–16% under
  perturbed arrivals — the coupling law measured a third way; re-fit
  (tier B) is the correct ground truth, as designed.
- Caveats: drums_dropout/s1 contributed only 12 gaps (481 engine crashes
  on its perturbed geometry — guarded, logged); pose conclusions hold at
  the CURRENT operating point (no fast-spin regime) and would need
  re-examination if track style ever enters one.

### R1 — Readiness model v0 (code; no behavior change)

- Implement r as a small, swappable module in the §ARC_STATE_CONTROL §1
  sense (inputs → output + the data that justified it), shaped by R0:
  **r(speed, comAngle) from the measured catchability surface** (R0
  verdict: 20%→95% structure; no pose component — parked). The module
  boundary must make adding components (R3) and replacing internals
  (empirical table, learned model — anything) additive.
- Wire as telemetry only: record r(arrival) for committed fits
  (compile_stats; fingerprint-safe, verify re-baseline). This gives live
  validation BEFORE r influences anything: does low committed-r correlate
  with realized next-gap failures in production distribution?
- Falsified if: live correlation contradicts R0 (then the study sampled the
  wrong distribution — fix R0 first).

**DONE — VALIDATION PASS (2026-06-10, `optimizer/readiness.ts` +
per-gap telemetry in evaluateNode/buildNodeOutput; archive
`readiness-v0-telemetry-01`, exact parity 597.41; 14,412 committed gaps
@300k):**

- Committed arrivals concentrate high (readiness p50 0.85, p10 0.68) — the
  search already implicitly selects catchable arrivals via its gates.
- **Low committed readiness predicts worse realized impact conversion,
  monotonically**: |impact err| 0.21 below r=0.5 → 0.115 above 0.85
  (Pearson −0.35). The R0 surface shows up live, on the axis that carries
  the open 55-point prize. Speed/air/amplitude errors mildly better at high
  r; survival is 100% everywhere (selection bias, as expected — gates
  already filter it).
- **Caveat that shapes R2 — readiness must become target-aware**:
  |elevation err| correlates POSITIVELY with readiness (+0.20). Elevation
  gaps legitimately want upward arrivals, which the catchability surface
  scores low. A single unconditioned r would fight climb gaps; R2's
  proposer objective must condition readiness on the next gap's asks
  (e.g. soften/replace the component on elevation-ask gaps) or use it only
  where its ground truth applies (impact/speed-ask gaps first).
- Implementation note (a trap, twice): output-time telemetry must NOT
  touch the shared prefix engines — neither metered reads (charges perturb
  the continuing multi-budget walk) nor "read-only" raw reads (wasm
  frame-cache effects shift later metered charges). Readiness is computed
  from the evaluation's own detection velocity array (pure, already
  charged) in evaluateNode and threaded to buildNodeOutput.

### R2 — Enumerative proposer (flag-gated; the headline rung)

- New proposer: for a base candidate, enumerate per-knob delta sweeps
  inside the fitted models (~hundreds per knob, model-only), predict
  current-gap quality proxies + arrival state per delta, score = predicted
  quality × clamp(r, r_min, 1), propose the top-k variants through the
  unchanged production evaluation into the pool. Current production k=2.
- Subsumption test: ablation matrix vs the V3/V4 lanes (enumerative on/off
  × lanes on/off). Expected: enumerative ≥ lanes; if so the lane triggers
  retire INTO the proposer (geometry like `buildArrivalScoopLines` stays —
  it is a knob/template, not a trigger).
- Judged: canonical + decide vs current baseline; all five invariants hold
  (zero rng draws, metered probes, no charged-rollout multiplication, no
  sampleAttempt, diversity preserved — aimed proposals ADD to the pool).
- Success metric: commits and headline — NOT pool rank0 (a
  readiness-optimized candidate may rightly sacrifice local cost; the
  pool-rank instrument tells us how selection treats them, `aim.aimed_*`).
- Falsified if: no headline gain at any budget with accurate predictions
  (telemetry separates model error from selection rejection).

**DONE — ACCEPT, PROMOTED DEFAULT-ON (2026-06-10, commit debb766):
597.41 → 600.71, Δ+3.3, P(Δ≤0)=7.3%, positive at every budget (100k +3.3 /
200k +3.2 / 300k +3.0); excl-impact 654.1 → 658.4; commits +45% vs legacy
(3,541 vs 2,446); readiness model error 0.007 — essentially exact.
Archive `aim-enum-r2-03` became the transition baseline; it was later
superseded by the unified `scoop-off-price-01` baseline (600.91).**

Iteration history (each falsifiable, each archived):
- v1 (−0.2): target-awareness used `targets.elevation !== undefined` — too
  broad, but NOT because of any default: undefined axes are genuinely
  ignored end to end (`effectiveAxes`/`sampleGapTargets` emit only authored
  axes; `axisCost` sums only axes with both target and measurement; the
  scorer sees only authored axes). This golden suite simply AUTHORS
  elevation on many specs, including hold-level asks (~0.5, p50 of authored
  elevation targets = 0.53) — so `defined` deferred on "stay level" gaps
  where the enum objective is perfectly safe. Lesson: a funnel-telemetry
  read before interpreting any verdict; and `defined` ≠ `demanding`.
- v2 (+0.3 parity): objective = catchability × speed-fit only. The surface
  barely differentiates 15° from 25° arrivals (0.91 vs 0.92), so nothing
  pushed the steep arrivals impact conversion needs — emissions healthy
  (14.5k), predictions exact (err 0.006), commits +31%, score flat.
- v3 (ACCEPT): added the closed-form impact-feasibility factor
  clamp(speed·sin(angle)/(ask·REDIR_CAP), 0, 1) — R3's component brought
  forward. V4's hand-clamped steep-arrival target dissolves into a smooth
  physics prior the enumeration optimizes against.

Subsumption confirmed, then completed by the follow-up simplification: the
V3 speed solve, V4 angle formula, climb defer, and arrival-conditioned scoop
machinery were deleted once their ablations priced at ~zero under the promoted
proposer. `LR_AIM_ENUM=0` is now only an ablation that disables the enumerative
proposer; it does not resurrect legacy triggers. The objective that won is
exactly the roadmap's shape: predicted quality × clamped, target-aware
readiness — with quality = speed-fit × impact-feasibility in this instance.

### R3 — Evidence-gated extensions (order by what R0–R2 telemetry says)

- **More readiness components**: impact-feasibility, speed-compatibility —
  the dive-scoop trigger fully absorbed here.
- **Joint multi-knob model — DONE, current implementation promoted
  (2026-06-10)**: the architecture is the joint/top-k model shape; the
  shipped special case composes per-knob quadratics over (pitch, rotate)
  additively rather than using a single learned combined surface.
  Scout (`study_joint_enum`, 289 gaps): achieved objective gain p50 +0.035,
  3× larger where pitch clamps; additivity at the argmax 0.041 px/f /
  0.63°. v1 (eager, always-on, ±4° extrapolated) REJECT Δ−7.9 — rotation
  displaced 92% of pitch proposals, 37% on-beat-landing gate-fail, commits
  −34%; the model was right, the economics wrong. v2 (lazy recruit at
  pitch exhaustion, probed span ±3°, ≥15% margin, one non-displacing slot)
  Δ+0.4, positive at mature budgets → promoted as the current instance of
  the architecture
  (`aim-joint-r3-02` = 600.94). Lesson for every future knob: predicted
  objective is not the whole economics — gate risk and displacement of
  proven proposals must be priced into the recruit rule.
- **Pose steering**: aim pose itself (V0: ~40° authority via exit pitch;
  wrapping caveat — unwrap by sweep continuity, track angular velocity).
  REFRAMED after R0 (Jérémie): pose parked as a CATCHABILITY signal does
  not mean pose is uninteresting — upside-down/rotating riders look great
  and are sometimes exactly what the track should do at the right musical
  moment. Pose steering's future justification is AESTHETIC (an
  axis-like rotation/flair target, cf. the elevation/amplitude precedent),
  not readiness. Sensor and actuator both exist; R0 even showed pose is
  cheap to vary without losing catchability up to ~90° — which makes
  intentional pose flair LOW-RISK whenever we want it.
- **Richer per-variation prediction**: predicted axis VALUES (V2: viable;
  needs a rich probe = full evaluation per probe point — expensive,
  architected for in `ProbeOutcome`).

### R4 — Search integration (the dangerous rungs; each separately gated)

- **Sampling-budget rebalance**: shrink the random sampler if model-proposed
  candidates dominate COMMITS (not pool rank). Scars: attempt-0 replacement
  −29.5 (the sampler's guided attempts are load-bearing); diversity
  invariant. Approach: reduce nCand gradually under decide, never replace.
- **Readiness in ranking / forward-eval**: the judge change. Scar: local
  impact-weight pressure traded 1:1. Only with strong R2 telemetry showing
  good proposals losing selection for readiness-shaped reasons.

## 3. Architecture requirements (hold at every rung)

- Readiness and the enumerative proposer are INSTANCES of the
  `ARC_STATE_CONTROL` §1 concept — every interface shaped so model
  internals (empirical curve → richer fit → learned), input sets, knob
  sets, and k are swappable without rewrites; every simplification labeled
  "current instance" in code comments and doc.
- All five invariants of `ARC_STATE_CONTROL` §1 apply verbatim.
- Workflow per rung: studies are read-only scripts with archived artifacts;
  behavior changes are flag-gated, judged by canonical + decide (candidate
  first), `verify:optimizer -- --update` after any behavior/stats change;
  full test suite; fingerprint untouchables never edited; docs +
  `ARC_STATE_CONTROL.md` cross-references updated the same day; memory
  updated at each verdict.

## 4. Open choices (deliberately undecided)

| choice | working position | decided by |
|---|---|---|
| r falloff shape | smooth plateau + fast smooth decay | R0 data |
| clamp floor r_min | TBD (e.g. 0.1) | R2 sweep |
| multiplicative vs additive | multiplicative-clamped | revisit only if R2 shows veto pathologies |
| speed in catchability inputs | compare in R0 (cheap), PoC may stay (pose, comAngle) | R0 |
| k (proposals per gap) | top-k interface; **current k=2 decided** (`enum-k1-01`/`enum-k3-01`) | DONE |
| per-knob enumeration grid | ~hundreds/knob, deterministic sweep | R2 (any dense grid works — model is smooth) |
| readiness sharpening (Jérémie) | **FALSIFIED** (2026-06-10, `enum-sigmoid-01`): σ((r−0.55)/0.10) REJECT Δ−2.0, CI [−6.1, 0.6], negative every budget. Flattening the plateau discards the surface's high-end gradient — the signal that pushes steep fast arrivals (the v2→v3 lesson). The raw surface already vetoes at the low end (0.2–0.4) and its top-end slope is informative, not a tax. | quick A/B vs the promoted v3 — DONE |
| k proposals (1 vs 2 vs 3) | **k=2 is the measured knee** (2026-06-10): k=1 Δ−1.1 (`enum-k1-01`; −2.1…−2.7 at every mature budget, P(Δ≤0) to 96% — the second proposal pays); k=3 Δ−4.5 REJECT (`enum-k3-01`; third proposal starves small budgets: 50k −43.8, validity dip). Stays a constant. | k-sweep A/B — DONE |
| climb-defer threshold / legacy removal | **DONE**: defer removed at exact parity (2026-06-10, `enum-defer-off-01`: Δ−0.1, CI [−0.6, 0.2]); speed-fit + impact-feasibility already cover demanding climbs. The later `scoop-off-price-01` cleanup deleted the remaining scoop/legacy lane machinery, leaving one proposer. `LR_AIM_ENUM=0` only disables that proposer for ablation. | A/B removing the defer and deleting legacy lanes — DONE |

## 5. What would falsify the whole program

Readiness rests on three claims: (1) arrival state carries real information
about next-gap success beyond what current targeting uses (R0 tests pose;
the V3/V4 wins already prove speed and angle); (2) the local models predict
arrival state well enough to rank variations (proven: live pred error ≈
0.03 px/f, 0.4°); (3) better-targeted proposals convert to commits and
score through the unchanged judge (V3/V4 proved it for two hand-built
cases; R2 tests the general mechanism). If R2 fails with (1) and (2)
holding, the bottleneck is selection, not generation — and the program
hands its evidence to the R4 ranking question rather than dying.
