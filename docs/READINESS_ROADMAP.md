# Readiness — roadmap

2026-06-10 · branch arc-rewrite · canonical baseline `prefix-cache-lanes-01`
(597.41). Prerequisite reading: `ARC_STATE_CONTROL.md` (the aiming layer:
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
- **v1 proposer enumerates per-knob, no additivity.** Two knob families
  exist (exit pitch; whole-arc rotation), each with its own probe-fit
  model. v1 sweeps each knob independently (e.g. ~500 deltas per knob —
  free, inside the model) and ranks the union. Joint multi-knob variation
  is R3, explicitly: today's per-knob models ARE the current instance of a
  more general multi-input model (document this at every layer).
- **Proposer side first.** Readiness shapes WHICH candidates are proposed
  and ranks them *inside the proposer* (model-only, no simulation); every
  proposed candidate still passes the exact production evaluation; the
  search's judge (local cost + forward-eval) is untouched. Ranking/judge
  integration is a late, separately gated rung (§R4) — we have a scar there
  (impact local-cost pressure traded 1:1).
- **Top-k proposals.** The thousand variations exist only inside the model;
  k=1–3 winners get simulated and join the pool. Replacing or shrinking the
  random sampler is NOT assumed — it is a late, evidence-gated rung (§R4)
  with a known scar (attempt-0 replacement: −29.5).

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

### R2 — Enumerative proposer (flag-gated; the headline rung)

- New proposer: for a base candidate, enumerate per-knob delta sweeps
  inside the fitted models (~hundreds per knob, model-only), predict
  current-gap quality proxies + arrival state per delta, score = predicted
  quality × clamp(r, r_min, 1), propose top-k (1–3) through the unchanged
  production evaluation into the pool.
- Subsumption test: ablation matrix vs the V3/V4 lanes (enumerative on/off
  × lanes on/off). Expected: enumerative ≥ lanes; if so the lane triggers
  retire INTO the proposer (geometry like `buildArrivalScoopLines` stays —
  it is a knob/template, not a trigger).
- Judged: canonical + decide vs current baseline; all five invariants hold
  (zero rng draws, metered probes, no charged-rollout multiplication, no
  sampleAttempt, diversity preserved — top-k ADDS to the pool).
- Success metric: commits and headline — NOT pool rank0 (a
  readiness-optimized candidate may rightly sacrifice local cost; the
  pool-rank instrument tells us how selection treats them, `aim.aimed_*`).
- Falsified if: no headline gain at any budget with accurate predictions
  (telemetry separates model error from selection rejection).

### R3 — Evidence-gated extensions (order by what R0–R2 telemetry says)

- **More readiness components**: impact-feasibility, speed-compatibility —
  the dive-scoop trigger fully absorbed here.
- **Joint multi-knob model**: one model over (pitch, rotate[, …]) — the
  additivity study certifies the simple sum as proposer-grade at median
  (~10% interaction, p90 ~1×: never trust uncommitted — production eval
  catches the tail). Enables true joint enumeration.
- **Pose steering**: aim pose itself (V0: ~40° authority via exit pitch;
  wrapping caveat — unwrap by sweep continuity, track angular velocity).
  Only if R0 shows pose matters AND R2 shows arrivals are pose-limited.
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
| k (proposals per gap) | 1–3 | R2 |
| per-knob enumeration grid | ~hundreds/knob, deterministic sweep | R2 (any dense grid works — model is smooth) |

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
