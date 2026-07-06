# Compiler Simplification Opportunities - Second Pass

## Campaign context

This is a second-pass catalog for the live `scripts/v0/` compiler after the
first simplification wave in `docs/simplification-opportunities.md`. The focus
here is not cosmetic cleanup; it is code that still looks tuned to the current
golden grid, current spec population, or concluded study arms:

- exact "M..." profile pockets over contact counts, axis means/ranges, and impact
  prevalence;
- runtime env gates whose defaults have become production policy;
- telemetry and proof instruments left in the hot path after the study they
  served;
- parallel geometry lanes and impact carriers that encode the same concept in
  several places.

Each entry is a candidate to attempt independently. Behavioral changes should be
checked against the canonical golden benchmark with the same simplification
non-inferiority rule used by the first catalog. Byte-identical refactors can use
focused hash probes first, then escalate if needed.

---

## Handoff policy - `scripts/v0/optimizer/handoff.ts`

### 1. Objective current-power override is a portfolio of exact reverse-fit pockets
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** constants `M64_*`, `M87_*`, `M94_*`, `M157_*`, `M178_*` around 381-408; `objectiveBlendCurrentPowerForSpec` 1604-1647; profile helpers 1715-2074.
- **Complexity smell:** A single output, `currentQualityPower`, is selected by a nested cascade of campaign IDs, env gates, target-budget steps, impact-prevalence bands, and spec-shape classifiers. Several helpers match very narrow populations (`contacts 50-60`, median gap <=20, mean/range bands for air/speed/impact/grain). The result is only one of a few powers: default, 1.5, 2.0, or 2.5.
- **Proposed simplification:** Replace the boolean portfolio with one continuous `currentPower = f(budgetMaturity, impactPrevalence, density, verticalTargeted)` curve, backed by a shared spec-profile object. Delete the M-number env gates once the accepted default is frozen; move any A/B arms into a study harness.
- **Risk:** high
- **Generalization note:** Exact prevalence/contact-count pockets can silently miss nearby new specs; a continuous surface at least degrades smoothly.
- **Status:** Accepted - canonical `simplify2-01-continuous-current-power-j32-a01` replaced the current-power reverse-fit pocket portfolio with a continuous profile curve; step Δheadline +17.6, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.6.

### 2. Readiness-power override repeats the same spec-classifier pattern
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** constants `M75_*`, `M108_*` around 409-434; `objectiveBlendReadinessPowerForSpec` 1649-1674; `m75HighAirImpactReadinessProfile` 1682-1713; `m108DenseDrumReadinessProfile` 1800-1860; `m115PositiveCompactReadinessProfile` 1929-1952.
- **Complexity smell:** Readiness power is lowered to 0.75 only when a spec lands inside hand-built high-air-impact, dense-drum, or compact low-impact pockets. The pockets duplicate contact-frame aggregation and use hard bands like mean air 0.62-0.66 or speed range 0.20-0.28.
- **Proposed simplification:** Model readiness emphasis as a scalar pressure from "next-contact fragility" features: air target, impact ask, density, and speed variability. Collapse the three boolean profiles into one pressure-to-power mapping, and keep only a single explicit env override for experiments.
- **Risk:** high
- **Generalization note:** The current named pockets are calibrated to today's spec families, not to a physical readiness concept.
- **Status:** Rejected - canonical `simplify2-02-continuous-readiness-power-j32-a01` collapsed the readiness pockets into a continuous pressure but failed non-inferiority; step Δheadline -1.1, P(Δ≤-0.1)=79.2%, cumulative Δheadline vs campaign-start baseline +17.6.

### 3. Sparse-elevation readiness is two exact spec fingerprints
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `objectiveElevationReadinessForSpec` 1676-1679; `m114SparseElevationReadinessProfile` 1862-1927.
- **Complexity smell:** A boolean `elevationReadiness` gate fires only for two near-fingerprints: "rolling hills" and "summit push" style bands over contact count, median gap, mean air, speed range, mean impact, and elevation range. A small boundary change flips the entire readiness mode.
- **Proposed simplification:** Replace this with a direct continuous condition: elevation axis targeted, elevation range above a threshold, sparse enough cadence, and low amplitude conflict. If the boolean is still needed, compute it from a monotone score rather than two rectangular boxes.
- **Risk:** medium
- **Generalization note:** New elevation-heavy specs outside the two boxes get no help even if they express the same underlying difficulty.
- **Status:** Accepted - canonical `simplify2-03-smooth-sparse-elevation-readiness-j32-a01` replaced two exact sparse-elevation fingerprints with a smooth elevation/cadence/amplitude pressure; step Δheadline -0.0, P(Δ≤-0.1)=14.2%, cumulative Δheadline vs campaign-start baseline +17.5.

### 4. Spec-profile statistics are recomputed ad hoc across objective, quality, and repair
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** examples: `m157ScarceDenseCurrentProfile` 1715-1798; `m108DenseDrumReadinessProfile` 1800-1860; `shouldBoostDrumGrainMatureQualityBreadth` 3599-3667; `m108DrumsPulseRepairProfile` 4524-4569.
- **Complexity smell:** Each profile helper rebuilds contact frames, median gaps, axis means, axis ranges, impact means, and vertical ranges from scratch, often with subtly different filters (`>= K_BOUNCE_LANDING` vs all contacts, authored contacts vs resolved gap targets). This makes the classifier layer long and makes drift easy.
- **Proposed simplification:** Build one `HandoffSpecProfile` once per compile from `gaps`, `gapAxisTargets`, and authored contacts. Include contact count, median gap, per-axis mean/range, impact prevalence/mean/range, vertical ranges, and grain coverage. Pass it to all policy functions.
- **Risk:** low for extraction, medium if filters are unified
- **Generalization note:** A shared profile makes later policy changes about model shape, not about subtly different measurement definitions.
- **Status:** Accepted - canonical `simplify2-04-shared-handoff-spec-profile-j32-a01` moved objective/readiness/quality/repair classifiers onto shared spec and target profile aggregates while preserving existing gates; step Δheadline +0.1, P(Δ≤-0.1)=4.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 5. Quality breadth has become a second profile-portfolio over `nCand`
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `qualityHandoffSampleCount` 3457-3506; profile helpers 3539-3835; constants `M132_*`, `M144_*`, `M152_*`, `M165_*`, `HANDOFF_QUALITY_*` around 402-467.
- **Complexity smell:** Candidate breadth is selected by a stack of named overrides: sparse-amp 48, drum-grain 40, canyon 36, residual 28, dense-low-air 34, mature lean relief, short-no-amp, and sparse-amplitude smooth boost. Several branches key on exact rectangular pockets that appear to name individual specs.
- **Proposed simplification:** Replace discrete profile overrides with a single `qualityBreadth(profile, budget)` function returning one integer from a continuous pressure over density, vertical target range, impact range, and residual risk. If exact pockets are kept temporarily, express them as data rows over the shared spec profile rather than bespoke functions.
- **Risk:** high
- **Generalization note:** `nCand` should scale with search difficulty and budget, not with current golden-family fingerprints.
- **Status:** Accepted - canonical `simplify2-05-quality-breadth-rule-table-j32-a01` replaced the priority-ordered quality-breadth cascade with a single shared-profile rule table while preserving current gates; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 6. The all-budget sparse-amp Q48 gate is a brittle exact-match escape hatch
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `LR_M166_SPARSE_AMP_QUALITY48` branch 3465-3469; `shouldBoostSparseAmpQualityBreadthAllBudget` 3669-3790; constants `HANDOFF_QUALITY_SPARSE_AMP_Q48_N_CAND` and related 457-467.
- **Complexity smell:** Four named pockets (`floatBounds`, `soarSettle`, `ridgePulse`, `rollingDrop`) can force breadth to 48 at every budget. Each pocket uses many tight bands across contacts, median gap, axis means/ranges, and null/non-null elevation state.
- **Proposed simplification:** Fold this into the general breadth model from entry 5. If sparse-amplitude specs truly need a large pool, derive it from amplitude range, cadence, impact range, and budget pressure instead of exact spec boxes.
- **Risk:** medium
- **Generalization note:** The current gate is especially brittle because it bypasses the normal budget-aware lean entirely.
- **Status:** Rejected - canonical `simplify2-06-smooth-sparse-amp-q48-j32-a01` replaced the exact all-budget Q48 pockets with a continuous sparse-amplitude pressure but failed non-inferiority; step Δheadline -0.4, P(Δ≤-0.1)=69.7%, cumulative Δheadline vs campaign-start baseline +17.7.

### 7. Repair main-margin overrides are another priority-ordered spec classifier
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** repair constants 4413-4432; `defaultRepairMainMargin` 4446-4493; profile helpers 4495-4705.
- **Complexity smell:** `mainMargin` returns exactly `1.0` for five prioritized pockets before falling back to the smooth 1.0->1.1 ramp. The negative guards (`!m101 && !m102 && !m108...`) make ordering part of behavior, and the helpers repeat the same aggregate-stat code as objective and quality.
- **Proposed simplification:** Make repair allocation a continuous function of observed first-completion cost, current score weakness, and spec profile. At minimum, compute all profile booleans once and choose with a small data table so priority and overlap are explicit.
- **Risk:** high
- **Generalization note:** Repair scheduling should respond to actual incumbent weakness and remaining budget; exact spec-family pockets are likely to age badly.
- **Status:** Accepted - canonical `simplify2-07-repair-main-margin-rule-table-j32-a01` replaced the repair main-margin negative-guard cascade with an explicit first-match rule table while preserving current override behavior; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 8. Far-back frontier pulses use a hard axis-quality interval as a scheduler
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** constants `QUALITY_FAR_BACK_*` 619-622; `popNextFrontierNode` 2107-2127; `farBackFrontierPulseInterval` 2129-2144.
- **Complexity smell:** Once a passing incumbent exists, the DFS periodically pops an older pass-frontier node based on `axis_quality` only, interpolating pulse interval between 16 and 128 over axis quality 0.50->0.18. This is an invisible second frontier scheduler layered on top of the main stack.
- **Proposed simplification:** Fold the pulse into a frontier priority score that uses the same `LeafKey` fields as the register, or remove it if it is only compensating for a known repair gap. Emit one `frontierPriority(node)` rather than a modulo-based side channel.
- **Risk:** medium
- **Generalization note:** Axis quality alone ignores missing/survival and can misallocate effort on new score shapes.
- **Status:** Accepted - canonical `simplify2-08-remove-far-back-frontier-pulse-j32-a01` removed the axis-quality-driven far-back frontier pulse side channel so frontier popping is a single stack operation; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

---

## Forward eval and aim - `scripts/v0/optimizer/{handoff,aim}.ts`

### 9. Forward-eval is a near-module hidden behind mutable globals
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** globals `fwdEvalSpec`, `fwdEvalGapAxisTargets`, `fwdEvalCfg`, `fwdEvalMin`, `fwdEvalDefaultConfig` 4202-4212; `setForwardEvalContext` 4373-4378; rollout functions 4823-5268.
- **Complexity smell:** The forward-eval subsystem is already marked as a deferred extraction candidate in the source, but it still depends on module-global per-compile state. External study callers must call `setForwardEvalContext` before using exported helpers, and the state shape blocks parallel/interleaved evaluation.
- **Proposed simplification:** Create an explicit `ForwardEvalContext` object containing spec, gap targets, config, min budget, and stats sink. Pass it through `scoreCandidateForHandoff`, start scoring, and exported study helpers. Then move the subsystem to `optimizer/forward_eval.ts`.
- **Risk:** medium
- **Generalization note:** Removing hidden globals improves reentrancy and makes future multi-worker or nested study calls safer.
- **Status:** Accepted - canonical `simplify2-09-forward-eval-runtime-context-j32-a01` consolidated the forward-eval per-compile globals into an explicit runtime context object and made config resolution return data instead of mutating a side flag; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 10. Forward-eval agreement telemetry still walks every scored pool in production
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `fwdEvalTotals` agreement fields 4253-4270; `recordFwdEvalAgreement` 4298-4372; call site in `rankedOptions` around 2924.
- **Complexity smell:** Histograms were removed in the first cleanup, but the remaining agreement recorder still computes winner, quality top-1, rank sums, impact-target splits, aimed asymmetry, costlier/cheaper split, and best aimed rank on every forward-eval pool. These are diagnostics; no compiler decision reads them.
- **Proposed simplification:** Keep only cost counters (`frames_charged`, `calls`, maybe `rollout_no_candidate`) in production stats. Move agreement characterization behind a study hook or an explicit `LR_FWD_EVAL_AGREEMENT=1` gate.
- **Risk:** low
- **Generalization note:** Telemetry-only code should not grow the default ranking path or archive schema indefinitely.
- **Status:** Accepted - canonical `simplify2-10-gate-forward-eval-agreement-j32-a01` gated forward-eval agreement scans behind `LR_FWD_EVAL_AGREEMENT=1` while leaving cost counters on by default; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 11. Full-leaf dead-rider proof counters remain after objective leaf became default
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `fwd_leaf_*` counters 4237-4252; `GENUINE_DEATH_REASONS` 4865-4871; `recordFwdLeafDeadCheck` 4873-4903; call in `forwardNodeScore` 4861.
- **Complexity smell:** The comments describe a proof instrument for validating that the objective leaf's missing penalty covers dead riders. The default leaf is now objective; the full-leaf path is an escape hatch/study mode, yet the proof fields remain in the public stats structure and the full scorer always records them.
- **Proposed simplification:** If the proof is concluded, delete these counters and `recordFwdLeafDeadCheck`. If still useful, move it behind an explicit validation flag so normal `LR_FWD_EVAL_LEAF=full` runs do not carry proof-specific archive fields.
- **Risk:** low
- **Generalization note:** Removing proof residue makes the live scorer easier to audit; keeping it gated preserves the diagnostic when intentionally requested.
- **Status:** Accepted - canonical `simplify2-11-remove-full-leaf-proof-counters-j32-a01` removed the concluded full-leaf dead-rider proof counters, helper, and test expectations while leaving live forward-eval cost telemetry intact; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 12. Start-eval and candidate forward-eval parse the same DSL but obey different policy rules
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `parseForwardSpec` 4761-4770; `forwardEvalConfig` 4785-4797; `startEvalConfig` 4815-4820; `startForwardScore` 4823-4840.
- **Complexity smell:** Candidate ranking has a min-budget gate and charge refund override; start ranking is always charged, always on by default, and has its own default (`best:1:5`). The same `ForwardEvalConfig` type represents both even though policy semantics differ.
- **Proposed simplification:** Split parsing from policy. Use `parseRolloutShape` for the variant/depth/branch tuple, then define `CandidateForwardPolicy` and `StartForwardPolicy` explicitly. This makes the sanctioned start exception visible without overloading one config type.
- **Risk:** low
- **Generalization note:** Clear policy types reduce accidental reuse of candidate gates for start selection or vice versa.
- **Status:** Accepted - canonical `simplify2-12-split-forward-rollout-policy-j32-a01` split the shared rollout parser from candidate and start forward policies so start ranking no longer carries candidate-only charge semantics; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 13. Aim top-K is still a stepwise budget and low-air cascade
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** constants `AIM_TOPK_MATURE_BUDGET_FRAMES`, `AIM_LOW_AIR_TOPK_*`, `AIM_TOPK_HIGH_BUDGET_FRAMES` 187-201; `aimTopKBasesEffective` 214-227.
- **Complexity smell:** Effective K is `1` below 100k, `4` above 100k, `6` above 200k, capped to `3` for air <=0.30 unless env overrides the base count. This is simpler than the older cascade but still anchored to canonical budget tiers and a hard low-air boundary.
- **Proposed simplification:** Express K as `round(clamp(base + budgetPressure - lowAirPressure))` using probe-cost share or predicted first-completion cost, not raw target-budget tiers. Keep the env override only in study drivers.
- **Risk:** medium
- **Generalization note:** A compile at 199,999 vs 200,000 frames should not get a qualitatively different aim-lane width.
- **Status:** Rejected - canonical `simplify2-13-continuous-aim-topk-pressure-j32-a01` tried a rounded continuous budget/low-air K pressure, but non-inferiority was not established against item 12; source reverted; step Δheadline -0.1, P(Δ≤-0.1)=54.7%, cumulative Δheadline vs campaign-start baseline +17.7.

### 14. `AimStats` remains a large always-on study archive
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `AimStats` 263-375; `aimTotals` 377-413; snapshot around 529-641.
- **Complexity smell:** The default compile emits a very broad aim telemetry object: proposer funnel, rotate split, pool ranks, short-probe horizon economics, fit degradation, quality-rank disagreement, air-substrate spread, and air-matched variant funnel. Much of it is campaign-analysis surface rather than production diagnostics.
- **Proposed simplification:** Split stats into a compact production block and optional study blocks. For example: production keeps `enum_considered/emitted/gate_fail` and probe frames; study hooks own rotate, model-degradation, rank-air, and pool-rank detail.
- **Risk:** low
- **Generalization note:** Smaller stats reduce archive schema churn and make real production regressions easier to spot.
- **Status:** Accepted - canonical `simplify2-14-gate-aim-study-stats-j32-a01` split default aim stats into a compact production block and gated the broader rotate/rank/air/model-fit study archive behind `LR_AIM_STUDY_STATS=1`; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 15. Aim still exposes many runtime experiment gates in the production module
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `aimDeltaMaxDeg` 103-115; `aimEnumEnabled` 117-133; `aimJointProbeDesign` 143-147; `AIM_TOPK_BASES_RAW` and override parsing 149-165.
- **Complexity smell:** Some comments record that alternatives were rejected or are ablation-only, but the production module still reads `LR_AIM_SPAN`, `LR_AIM_ENUM`, `LR_AIM_JOINT_PROBE_DESIGN`, and `LR_AIM_TOPK_BASES` directly. These knobs widen the supported behavioral surface and force tests to account for many combinations.
- **Proposed simplification:** Freeze accepted defaults in production code and move variant selection into explicit study entry points. Keep at most one documented top-level ablation switch if it is still used by CI or benchmark harnesses.
- **Risk:** medium
- **Generalization note:** Retiring warm env arms makes behavior easier to reproduce and lowers accidental configuration risk.
- **Status:** Accepted - canonical `simplify2-15-freeze-aim-runtime-knobs-j32-a01` froze production aim span/probe/top-K policy to accepted defaults, leaving only the documented `LR_AIM_ENUM=0` ablation switch live; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

---

## Geometry and impact - `scripts/v0/arc_placement.ts`

### 16. Impact geometry retune env knobs are still live in the generator
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** impact env constants 126-147; `STEEP_ARRIVAL_HARD_IMPACT_*` env reads 224-230; `IMPACT_GEOM_OFF` 314-320; consumers in `impactCurvePressure` 1668-1683 and `steepArrivalMatureZeroBand` 1535-1543.
- **Complexity smell:** The code documents accepted retunes for impact curve start/span, flatten, frontload, and hard-impact zero band, yet the production generator still exposes runtime env knobs. There is also a global all-or-nothing `LR_IMPACT_GEOM_OFF` ablation switch.
- **Proposed simplification:** Freeze the accepted constants in production; move impact geometry ablations into eval scripts or a study wrapper. If `LR_IMPACT_GEOM_OFF` is still useful, centralize it as a study-only option outside the sampler.
- **Risk:** medium
- **Generalization note:** Runtime geometry knobs make compile output depend on untracked shell state unless every run captures environment faithfully.
- **Status:** Accepted - canonical `simplify2-16-freeze-impact-geometry-knobs-j32-a01` froze accepted impact-geometry retune constants in production and removed sampler-local runtime ablation/env knobs; step Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +17.7.

### 17. Non-normal sample modes still use a legacy target-state sampler
- **Files:** `scripts/v0/arc_placement.ts`, `scripts/v0/types.ts`
- **Location:** `CANDIDATE_SAMPLE_MODES` 291-295 in `types.ts`; mode dispatch 520-538 in `arc_placement.ts`; `sampleTargetStateLines` and `targetStateControls` 563-760; post-length helpers 777-834.
- **Complexity smell:** Normal candidates use the newer contact-centered sampler, while `brake` and `startup_catch` use a separate older target-state generator with different RNG draw count, guided rolls, pressure terms, angle formulas, length caps, and telemetry mode handling. This keeps two geometry systems alive.
- **Proposed simplification:** Port brake and startup catch behavior into descriptor parameters on the contact-centered sampler, then delete `sampleTargetStateLines`, `targetStateControls`, `PlacementRolls`, and `GEOMETRY_RNG_DRAWS`. The candidate sample mode would select a pressure profile, not a second geometry engine.
- **Risk:** high
- **Generalization note:** One sampler with mode descriptors scales better than maintaining parallel geometry formulas.
- **Status:** Not Started

### 18. Impact template lane plus hold sub-lane is a dense multi-gate cascade
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** constants `IMPACT_TEMPLATE_*` 181-211; template block 1360-1422; `impactTemplateBudgetPressure` 1431-1435; `impactTemplateScoopFrames` 1438-1450; `impactTemplateHoldPressure` 1452-1480; `buildImpactTemplateHoldLines` 1483-1510; `impactTemplateLaneEligibility` 1545-1569.
- **Complexity smell:** A stochastic low-discrepancy lane is controlled by budget pressure, impact pressure, attempt pressure, room pressure, vertical-compatibility booleans, spec mean impact, and a separate hold-line pressure product. The lane either replaces the whole post profile or does nothing.
- **Proposed simplification:** Represent impact template generation as one deterministic candidate-family descriptor with explicit `eligibility`, `scoop`, and optional `hold` phases. Consider removing the hold sub-lane unless telemetry shows it is selected often; otherwise derive hold length from the same needed-turn geometry as the scoop.
- **Risk:** high
- **Generalization note:** The current gate product is hard to reason about off-grid and makes one template family look like several independent policies.
- **Status:** Not Started

### 19. Steep-arrival span overlaps with impact-arrival launch and post-turn correction
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** constants `STEEP_ARRIVAL_*` 213-230; application block 1273-1305; `steepArrivalDeltaMaxDeg` 1512-1532; `steepArrivalMatureZeroBand` 1535-1543; `impactPostTurnExtraDeg` 1753-1783.
- **Complexity smell:** Three impact-delivery levers modify the launch/post angle: impact-arrival pop, steep-arrival span for next-beat impact, and post-turn extra degrees. They use different thresholds, budget gates, zero bands, salts, and delivery-efficiency assumptions while all trying to create redirection-ready arrival geometry.
- **Proposed simplification:** Collapse these into one `impactDeliveryAdjustment` that computes the needed turn/arrival angle once and allocates it between launch angle, ride-out length, and post-turn. Keep one budget pressure and one attempt span.
- **Risk:** high
- **Generalization note:** A single impact-delivery model is easier to scale to harder impact specs than three partially overlapping levers.
- **Status:** Not Started

### 20. Contact and entry redir shifts are marginal twin helpers around the main curve carrier
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** constants `CONTACT_CENTERED_REDIR_*` 96-112; call sites 1049-1060 and 1342-1357; `contactCenteredRedirContactAngleShiftDeg` 1591-1619; `contactCenteredRedirEntryAngleShiftDeg` 1621-1661.
- **Complexity smell:** The source comments say the angle-shift mechanisms were marginal compared with the curvature carrier. Yet two helpers still compute similar mature-budget/speed/target pressures, one for contact angle and one for entry bevel, using different target ramps and caps.
- **Proposed simplification:** Either delete both shifts and rely on the curvature/impact-template carriers, or replace them with one `redirAngleShift(kind, config)` descriptor that shares pressure calculation and makes the marginal contribution explicit.
- **Risk:** medium
- **Generalization note:** If a lever is only a small correction, its implementation should be proportionally small and easy to disable for evidence.
- **Status:** Not Started

---

## Use notes

- Attempt one entry at a time. Start with low-risk extraction/telemetry items
  before changing policy surfaces.
- Prefer byte-identical structure changes first: shared `HandoffSpecProfile`,
  forward-eval context object, telemetry gating, and descriptor tables.
- Treat entries that change scorer-facing output or selected geometry as full
  behavior trials, not refactors.
- Keep the measuring ruler fixed. If a candidate changes the evaluator
  fingerprint, it is not comparable under the simplification campaign.
