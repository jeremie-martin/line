# Compiler Simplification Opportunities — Master Catalog

## Campaign context

The `scripts/v0/` compiler grew large and convoluted through an earlier
score-maximization campaign: layered pressure cascades, per-spec reverse-fit
gates, hash-gated stochastic knobs, env-gated study arms left warm, and many
near-duplicate helpers. This file catalogs candidate **simplifications** — dead
code to remove, reverse-fit gates to collapse, duplicates to unify, and
grid-anchored magic constants to generalize.

A separate **execution phase** will attempt these one at a time against the
canonical golden benchmark: **40 specs × 12 seeds × budgets {125k, 250k, 375k,
500k}, `LR_ENGINE=wasm --jobs=32`**. That phase uses explicit decide
simplification mode:

```bash
npm run decide -- --mode=simplification --margin=0.1 --alpha=0.20 CANDIDATE/golden.json BASELINE/golden.json
```

Simplification mode is a paired-bootstrap non-inferiority test on the total
headline: accept when `P(Δheadline ≤ -0.1) < 0.20`. The `0.1` margin is the
declared maximum headline regression worth trading for genuine compiler
simplification; unlike improvement mode, this does not require evidence that the
candidate is better than baseline.

**Hard invariant — do NOT change any of these:** the scorer, the golden spec
set, the evaluator/scoring ruler, the metric definition, the seed set, or the
budget grid. Compiler behavior is allowed to change; the measuring ruler is not.
If a candidate golden archive has a different `evaluator_fingerprint` from the
baseline, the archives are not comparable in this campaign and the item is out
of scope.

**Each entry carries a `Status:` line.** The execution phase must update it in
place — `Not Started` → `Accepted` / `Rejected` / `Abandoned` — with a one-line
outcome note (step headline delta, `P(Δ≤-0.1)`, cumulative headline delta vs the
campaign-start baseline when available, why abandoned, etc.), so this file
becomes the running log. Do not append new sections per attempt; edit the entry.

Entries are grouped by subsystem area. Within reason, dead-code / de-duplication
items (low risk, high generality) are cheapest to attempt first; deep
reverse-fit gate collapses (high risk) should come later.

---

## Handoff core — `scripts/v0/optimizer/handoff.ts`

### 1. Attempt-strata admission machinery is env-gated dead weight
*(sources: handoff-core-rescue, handoff-admission-branch)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** types/config 329-457; `admittedHandoffPool` 2269-2288; `attemptStrataAdmission` 2290-2326; `candidateAdmissionLane` 2328-2334; `recordAdmissionTelemetry` 2336-2354; `snapshotAdmissionStats` 3026-3057; accumulators 339-349, 2978-2997; constants 407-411.
- **Complexity smell:** The default admission path is one line: `sorted.slice(0, poolSize).map(...)`. Everything else — profile parsing, the local/middle/tail quota walker, lane bucketing on `sampleAttempt<8/<24`, the full `HandoffAdmissionAccumulator`, telemetry snapshot, and the `lane`/`sourceLane` argument threaded through `rankedOptions`→`scoreCandidateForHandoff` — exists only to serve `LR_ADMISSION_PROFILE=attempt-strata`, which nothing sets in production (~150 lines + exported types of study scaffolding in the hot ranker).
- **Proposed simplification:** Collapse `admittedHandoffPool` to the default slice; move the strata profile + config parsing + lane classifier + admission telemetry into a study-only module (or delete if the study concluded). Drop the `sourceLane` parameter and the `profile==='default'` branch at ~2389.
- **Risk:** low
- **Generalization note:** Default path is byte-identical without it; lane cutoffs (8/24) assume the current candidate-batch ordering and are meaningless elsewhere anyway.
- **Status:** Accepted — Δheadline +0.0 (INCONCLUSIVE, byte-identical no-op: `LR_ADMISSION_PROFILE=attempt-strata` was never set in production so the default slice was already the sole live path; 683.67→683.67 at every budget, CI [0.0,0.0], fingerprint unchanged; zero-variance bootstrap can't label ACCEPT). Collapsed `admittedHandoffPool` to the slice, removed the strata config/lane-classifier/telemetry/`sourceLane` threading, and deleted the now-obsolete study drivers `study_admission_lookahead.ts` + `run_admission_lookahead_panel.ts`.

### 2. Three near-duplicate dead-end rescue lanes → one rescue helper
*(sources: handoff-core-rescue, handoff-admission-branch incl. HANDOFF_SHORT_RESCUE)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `expandNode` dead-end cascade 2053-2115; gates `shouldAttemptDeadEndRescue` 2130, `shouldAttemptShortDeadlineRescue` 2167, `shouldAttemptStartupDeadEndRescue` 2172; count/pool helpers 2149-2267; `shortDeadlineRescueCandidateCount` 2176-2181; constants 491-506.
- **Complexity smell:** When the pool returns empty, `expandNode` tries three rescue lanes in sequence, each an almost-identical re-call of `rankedOptions`/`startupDeadEndOptions` with its own bespoke `(nCand,poolSize)` pair (base 32/12, short-deadline 80/16 gated `gap<12` frames, startup `MAX_K=24`). The three predicates overlap (`endsWithContact`, gap-length bands, target-speed) and duplicate a ~10-field config literal three times. The short-deadline lane is a hard step (`gap<12 → 80 cand, else 0`).
- **Proposed simplification:** Extract one `rescueOptions(node, gap, {nCand, poolSize})` helper owning the shared config literal + telemetry bump, driven by a small ordered `{predicate, nCand, poolSize}` tier list. Ramp the short-deadline count continuously (reuse the `1/(1+t²)` shape) instead of the 12-frame cliff. Tiers become data, not control flow.
- **Risk:** medium
- **Generalization note:** 12-frame / 80-cand / 32-48-80 counts are absolute frame/sample numbers tuned to current cadence; a shared helper makes them the only spec-specific knobs.
- **Status:** Accepted (partial) — structural extraction only. Extracted a shared `rescueOptions(...)` helper + ordered `rescueTiers` data list (byte-identical, verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). The proposed continuous `1/(1+t²)` ramp replacing the 12-frame short-deadline cliff was tried separately and REJECTED on the full canonical run: Δheadline -0.04, CI [-0.1, 0.0], P(Δ≤0)=92.8% — reverted, the hard cliff stays. Tiers are now data (the simplification goal), even though the cliff itself remains a hard threshold.

### 3. `LR_PLAN_LOOP` closed-loop re-aim + `planning.ts` module is dead-by-default and documented as not paying
*(sources: handoff-core-rescue, misc-small-modules)*
- **Files:** `scripts/v0/optimizer/handoff.ts`, `scripts/v0/optimizer/planning.ts`, `scripts/v0/optimizer/sample.ts`
- **Location:** `runRepairPhase` 1334-1381, 1450-1457; import `maybeReaimImpactGap` 128; `planning.ts` all (`aimTargets`, `plannedFor`, `maybeReaimImpactGap` 30-60); handoff gate `const planLoop = readEnv("LR_PLAN_LOOP") === "1"` 1334-1348.
- **Complexity smell:** The closed-loop impact re-aim path is disabled by default; the in-code comment states it was re-tested and "does NOT pay (Δ −0.7 to −1.7)" and is "now redundant with the re-fit curvature carrier." It threads a `plannedTargets`/`aimTargets` seam through `sample.ts` (`geometryTargets` default = `aimTargets(gap)`) and carries three unused env knobs (`LR_PLAN_LOOP_BUMP` 0.2, `LR_PLAN_IMPACT_AIM_MIN` 0.3, `LR_PLAN_LOOP_DEADBAND` 0.03).
- **Proposed simplification:** Delete `planning.ts` and the `planLoop`/`maybeReaimImpactGap` branch; change `sampleOneCandidate`'s `geometryTargets` default from `aimTargets(gap)` to `gap.targets`; drop `gap.plannedTargets` if unused. Byte-identical on the default path (aimTargets already falls back to `gap.targets`).
- **Risk:** medium
- **Generalization note:** Pure dead-lever removal; makes aim = literal targets everywhere, which generalizes cleanly.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Deleted `planning.ts` entirely (`aimTargets`/`plannedFor`/`maybeReaimImpactGap` + the three env knobs `LR_PLAN_LOOP_BUMP`/`LR_PLAN_IMPACT_AIM_MIN`/`LR_PLAN_LOOP_DEADBAND`); removed the `planLoop`/`maybeReaimImpactGap` branch + `LR_PLAN_LOOP`/`LR_PLAN_LOG` gates + reset/log lines from `runRepairPhase` in `handoff.ts` (and the import); dropped `Gap.plannedTargets` from `types.ts` (outside the fingerprinted `SPEED_RULER`→`SPEED_AXIS` slice). Catalog under-counted `aimTargets` consumers: it was also imported by `objective.ts`, `aim.ts`, and `study_joint_enum.ts`, not just `sample.ts` — all four now read `gap.targets`/`nextGap.targets` directly (byte-identical because `plannedTargets` was only ever set inside the disabled loop, so `aimTargets(gap) ≡ gap.targets` on the default path). `LR_PLAN_LOOP=0` still appears in `eval_impact.sh`/docs but only ever DISABLED the loop, so it becomes an inert env var (no behavioral consumer).

### 4. `smoothSparseAmplitudeQualityBreadth`: four-way smoothstep product for a +2 candidate boost
*(sources: handoff-core-rescue, handoff-admission-branch, handoff-quality-scoring)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `smoothSparseAmplitudeQualityBreadth` 3121-3156; constants `HANDOFF_QUALITY_SPARSE_AMP_*` 475-485.
- **Complexity smell:** Breadth is bumped to exactly 34 via a product of four independent smoothsteps: amplitude-range (0.15/0.20), sparse-median-gap (FPS*0.75/0.40s), a two-sided impact BAND (0.28-0.44 rising × 0.56-0.72 falling), and speed-steadiness (0.10/0.10). ~10 magic constants gating at most +2 candidates — a canonical reverse-fit signature (the band-pass impact term is the tell for fitting one narrow spec). Also double-gated: only called when `usesSparseContactCadence` (median ≥ FPS*0.75) is already true, then re-thresholds sparsePressure at the identical FPS*0.75.
- **Proposed simplification:** Delete the function and its constants; if any boost survives testing, replace the product with a single monotone pressure on contact sparsity alone (shared with `usesSparseContactCadence`, median computed once). Given the +2 payoff, deleting outright is the leading option under the relaxed rule.
- **Risk:** medium
- **Generalization note:** The impact band and amplitude/speed thresholds are absolute target-space coordinates tuned to the current 40-spec population; off-distribution the product silently collapses to ~0.
- **Status:** Rejected — Δheadline -0.1, CI [-0.4, 0.2], P(Δ≤0)=67.6% (full canonical vs attempt-aim-highk-gated-j32-a01). Deleted `smoothSparseAmplitudeQualityBreadth` and its constants outright (the catalog's own recommended option); mostly flat but 375k regressed -0.2. Despite the "reverse-fit signature" framing, the +2-candidate boost is doing real (if small) work on sparse-cadence specs. Code reverted.

### 5. `qualityHandoffSampleCount`: four stacked special-case branches over a 29↔34 range
*(sources: handoff-core-rescue, handoff-admission-branch, handoff-quality-scoring — incl. `shouldBoostShortNoAmpQualityBreadth`, `shouldRelaxMatureQualityLean`)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `qualityHandoffSampleCount` 3074-3089; `shouldRelaxMatureQualityLean` 3111-3114 (`VARIATION_RELIEF_AIR_RANGE=0.50`/`SPEED_RANGE=0.40`); `shouldBoostShortNoAmpQualityBreadth` 3116-3119 (`SHORT_NO_AMP_MAX_CONTACTS=32`, `BOOST_N_CAND=34`); sparse-amp path (entry #4).
- **Complexity smell:** Breadth flows through budget-aware lean (32→29), a mature-lean relief (air≥0.50 OR speed≥0.40 restores 32), a short-no-amp boost (contacts≤32 AND amplitude==0 → 34), then the sparse-amp product (→34). Four special cases each keyed on a hard threshold, whose combined output only ever spans 29..34. `contacts<=32`, `amplitude==0` exact-equality, and the 0.50/0.40 OR-cliff are all population-specific.
- **Proposed simplification:** Replace the branch stack with one continuous `nCand = round(clamp(f(budget, axis-variety scalar, contact count)))`; delete `shouldRelaxMatureQualityLean` and `shouldBoostShortNoAmpQualityBreadth`. Fold any spec-shape term into one shared axis-variety pressure.
- **Risk:** medium
- **Generalization note:** `contacts<=32`, `amplitude==0`, and 0.50/0.40 are quantiles of today's spec distribution; the OR-cliffs are brittle at the boundary.
- **Status:** Rejected — Δheadline -1.0, CI [-3.2, 0.2], P(Δ≤0)=92.5% (full canonical vs attempt-aim-highk-gated-j32-a01). Replaced the four stacked branches with one continuous smoothUnion-based formula (`base + restoreP*(32-base) + boostP*(34-32)`), folding entry #4's sparse-amp mechanism in as a pressure term rather than a stacked override — collapses to the exact old sparse-amp mapping when relief=0, verified numerically pre-run. Regressed mostly at 250k (-1.9): the smoothed relief/boost transitions moved real mass away from the exact old thresholds on enough specs to cost score, despite reproducing the sparse-amp path exactly. Code reverted.

### 6. `budgetAwareQualitySampleCount`: bathtub lean anchored to the canonical grid
*(sources: handoff-core-rescue, handoff-quality-scoring, handoff-admission-branch)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `budgetAwareQualitySampleCount` 3091-3109; constants 465-470 (`N_CAND=32`, `LEAN_N_CAND=29`, scarce start/span 50k, mature start 150k/span 100k).
- **Complexity smell:** `lean = max(scarceLean, matureLean)` returns 32 only in the narrow 50k-150k window and leans to 29 everywhere else — **including all budgets above the grid**, so higher budgets monotonically *reduce* breadth, the opposite of sane scaling. A ~9% swing driven by four grid-boundary magic numbers.
- **Proposed simplification:** Collapse to a single monotone (or flat-above-threshold) budget→nCand curve so high budgets never lean below the mid-grid value; make anchors relative to spec size. Verify the 3-count wobble is inert under relaxed acceptance (candidate: constant 32).
- **Risk:** medium
- **Generalization note:** Misbehaves outside the grid: any budget >250k gets the scarce-budget lean, harmful for the large budgets the campaign must support.
- **Status:** Rejected — Δheadline -0.8, CI [-2.6, 0.7], P(Δ≤0)=84.8% (full canonical vs attempt-aim-highk-gated-j32-a01). Confirmed the bug is real: `nCand=32` only in a ~100k-150k window, leaning to 29 at 250k/375k/500k (higher budget → less breadth, backwards). Replaced with the catalog's suggested simplest fix, a flat `nCand=32` at every budget (125k byte-identical since it was already 32 there). Regressed worst at 500k (-1.5): despite the shape being conceptually backwards, the current bathtub thresholds are net-positive on this specific 40-spec canonical suite — likely because the 29-breadth lean at high budgets frees search budget elsewhere in a way that pays on this population, even though it wouldn't generalize past this grid. Code reverted; the generalization concern stands as a known, deliberately-accepted tradeoff, not a free fix.

### 7. The `150_000`-frame "maturity" scale is duplicated under four names
*(sources: handoff-quality-scoring, handoff-admission-branch)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `HANDOFF_QUALITY_MATURE_LEAN_START_FRAMES` 469; `HANDOFF_RELEASE_VERTICAL_BUDGET_SCALE_FRAMES` 568; `TAIL_COMPLETION_BUDGET_SCALE_FRAMES` 615; `QUALITY_SHALLOW_TAIL_THROTTLE_BUDGET_SCALE_FRAMES` 618 (also `TAIL_COMPLETION` window 3285-3289).
- **Complexity smell:** Four independently-named constants all equal 150_000 and all mean "budget at which the compiler is mature," pinning behavior to the middle of the current grid while looking like four tuned values.
- **Proposed simplification:** Introduce one `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES` referenced by all four sites, or express maturity as a fraction of `targetBudget` (self-scaling off-grid).
- **Risk:** low
- **Generalization note:** Absolute 150k assumes the current grid; a fraction of spec contacts/duration generalizes.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match), full canonical run not needed. Grep turned up two more identically-valued duplicates beyond the four named in this entry (`HANDOFF_REUSE_MATURE_BUDGET_SCALE_FRAMES`, `QUALITY_FUTURE_PREVIEW_BUDGET_SCALE_FRAMES`); all six now point at one `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES = 150_000`. The self-scaling-fraction-of-`targetBudget` alternative was intentionally NOT implemented here (real behavioral change) — see follow-up entry #137.

### 8. `openingBestForwardEvalOpportunity`: dense-contact-band + objective/margin island reverse-fit to specific specs
*(sources: handoff-core-rescue, handoff-admission-branch, handoff-forward-eval-repair)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `openingBestForwardEvalOpportunity` 2484-2520; `openingBestStructuralPressure` 2522-2542; `isOpeningContactNode` 2550-2553; constants `OPENING_BEST_*` 586-601.
- **Complexity smell:** Activates only on the opening contact node, multiplying ~5 pressures. The structural term specials-cases `<=7` contacts OR `38-60` contacts with `DENSE_CONTACT_SPAN=1` making the lower edge a hard step at 38 — 38/60 are the contact counts of specific specs. Objective-magnitude (center 0.04) and inverse relative-margin (0.02-0.12) thresholds have no derivation. Fourteen constants for a single-node, single-band effect.
- **Proposed simplification:** Delete the dense-contact-band arm (keep only the short-spec case, or remove the whole opening-best lane) and let the general slack/branch policy govern; collapse the objective/margin gate to a single "top-two objective gap is small" condition. Measure whether the two-spec gain survives.
- **Risk:** high
- **Generalization note:** `[38,60]` explicitly assumes today's dense specs; any spec with 8-37 or 100 contacts gets zero opening-best pressure.
- **Status:** Accepted — Δheadline +2.2, P(Δ≤-0.1)=7.1%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs `attempt-aim-highk-gated-j32-a01`; valid 1920/1920, fingerprint unchanged). Deleted the dense 38-60-contact opening-best structural arm and its slack gate/constants, plus the now-dead `smoothUnion` helper; kept the short-contact opening-best lane and existing objective/margin gate intact for this focused step.

### 9. `verticalDramaForwardEvalPressure` / `matureForwardEvalConfig`: hash-gated greedy→"avg" swap that is actually a degenerate 1-wide rollout
*(sources: handoff-core-rescue, handoff-forward-eval-repair ×2)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `matureForwardEvalConfig` 4644-4673; `verticalDramaForwardEvalPressure` 4679-4705; constants `MATURE_AVG_FWD_EVAL_*` 577-585 (incl. `BRANCH=1`, `AMPLITUDE_START 0.18`, `ELEVATION_CENTER 0.50/SPAN 0.24`, cadence 20/40 frames).
- **Complexity smell:** A hash-gated stochastic config swap (greedy:2 → `{variant:'avg', depth:2, branch:1}`) for gaps with amplitude>~0.18 or |elevation-0.50|>~0.24 at budget>~35k. But `branch=1` means `forwardAvgNextScore` averages over exactly one 1-deep alternative — a single shallower rollout, **not** an avg and not depth-2. The elevation abs-distance-from-0.5 gate has no principled meaning; cadence uses raw frame counts (20/40) that don't scale with FPS.
- **Proposed simplification:** Either set `BRANCH>=2` so "avg" actually averages, or delete the mature-avg branch and keep greedy:2. Collapse the trigger to one continuous vertical-drama scalar (drop the budget hash gate); express cadence in beats/seconds. If kept, name it honestly.
- **Risk:** medium
- **Generalization note:** Budget anchors 35k/65k and amplitude/elevation/cadence thresholds are tuned to current vertical-drama gaps.
- **Status:** Rejected — Δheadline -4.1, P(Δ≤-0.1)=100.0%, cumulative Δheadline vs campaign-start baseline -2.0 (full canonical vs current #8 baseline `simplify-08-opening-dense-band-a01`; valid 1920/1920, fingerprint unchanged). Deleted the mature vertical-drama `avg` config branch outright, preserving default `greedy:2`; it regressed every budget (-5.5/-4.9/-4.1/-3.4), so the degenerate `avg` branch is doing real work. Source reverted.

### 10. `matureReuseExtraPressure`: full hash + two-smoothstep apparatus to occasionally bump reuse 1→2
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `reuseCandidateLimit` 2604-2613; `matureReuseExtraPressure` 2615-2625; `matureReuseExtraSeed` 2627-2632; constants 511-514.
- **Complexity smell:** `HANDOFF_REUSE_K=1`; adds at most one extra reuse candidate gated by `hash < 0.35 × smoothstep(budget/(budget+150k)) × smoothstep(feedback/(feedback+48))`. A seed function + two smoothsteps + three constants to sometimes turn 1 into 2.
- **Proposed simplification:** Replace with a flat reuse limit (1, or 2 above a single budget threshold); delete `matureReuseExtraPressure`/`Seed` and the three constants.
- **Risk:** low
- **Generalization note:** 150k/48 scales are grid-anchored; off-grid the +1 is never or always granted.
- **Status:** Rejected — Δheadline -0.3, CI [-0.9, 0.2], P(Δ≤0)=87.0% (full canonical vs attempt-aim-highk-gated-j32-a01). Tried flat reuse limit = 1 (dropping the occasional hash-gated bump to 2 entirely, since the extra candidate fires with probability ≤0.30 across the grid). Lost mostly at mature budgets (375k -0.4, 500k -0.4; 125k/250k ~flat), i.e. the occasional extra reuse candidate is doing real, if modest, work at higher budgets. Code reverted. A future attempt could try a flat threshold (K=2 above some budget) instead of flat K=1, but that is a bigger behavioral swing than this conservative try and wasn't attempted here.

### 11. `startupRescuePressure` `1/(1+t²)` with magic `FPS*1.1` feeding three separate count formulas
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `startupRescuePressure` 2162-2165; `deadEndRescueCandidateCount` 2149-2153; `deadEndRescueCandidatePoolSize` 2155-2160; `startupDeadEndCandidateCount` 2260-2267.
- **Complexity smell:** One decay (`t = endFrame/(FPS*1.1)`) drives three rescue-count computations, each with its own EXTRA constant (`STARTUP_EXTRA_N_CAND=48`, `EXTRA_POOL=4`, `STARTUP_DEAD_END_MAX_K=24`). The 1.1 fudge is unexplained; one pressure multiplied into three constant families is redundant surface.
- **Proposed simplification:** Define one `startupBreadth(endFrame)` returning a single sample budget; derive pool/max-k as fixed fractions; drop 1.1 (use a named half-life) and collapse the three EXTRA constants to one.
- **Risk:** medium
- **Generalization note:** Purely absolute-time based; the 1.1 half-life is untied to any spec property.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #8 baseline `simplify-08-opening-dense-band-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Collapsed the three startup-rescue count formulas into one `startupRescueBreadth(endFrame)` profile, named the `FPS*1.1` half-life, and derived pool/startup stream counts from the single +48 rescue breadth without changing output.

### 12. `repairConfig` `maxAttempts=64` + margin ramps reverse-fit to the 1M/100k canonical plateau
*(sources: handoff-core-rescue, handoff-forward-eval-repair)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `repairConfig` 3997-4031; `defaultRepairMainMargin` 3980-3986; `defaultRepairFeasMargin` 3988-3995; `REPAIR_*_RAMP_START/SPAN_FRAMES` 3972-3978.
- **Complexity smell:** Defaults are explicitly grid-calibrated per comments: `minBudget=100_000` ("all specs complete at 100k on the 30-spec board"), `maxAttempts=64` ("the cap, not the budget, was the 1M plateau"). The two margin ramps are structurally identical smoothsteps differing only by endpoints, both anchored START=100k/SPAN=100k.
- **Proposed simplification:** Factor one `rampMargin(budget, lo, hi, start, span)` helper for both; derive `maxAttempts` from budget (never a grid-specific integer cap); express `minBudget` as a function of `predictedFirstCompletionFrames`. Fold the two ramps into one budget-maturity curve.
- **Risk:** high
- **Generalization note:** `minBudget=100k` is false for a harder/longer spec; `maxAttempts=64` silently caps quality above ~1M.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #11 baseline `simplify-11-startup-rescue-breadth-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Factored the duplicate main/feasibility margin smoothstep ramps into one shared `repairRampMargin(...)` over the existing 100k/100k maturity curve; `minBudget=100_000` and `maxAttempts=64` were left unchanged for this focused byte-identical simplification step.

### 13. `maxNodes` backstop `= max(50_000, budget)` calibrated on one canonical spec
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `MAX_NODES_FLOOR` + comment 393-402; `maxNodes` derivation 705.
- **Complexity smell:** Node ceiling tied 1:1 to the frame budget, justified purely from canonical measurements (672 nodes @200k, 0.003 nodes/frame). A spec with many non-contact skip gaps could bind the cap below the intended headroom.
- **Proposed simplification:** Remove the node cap (frame budget is already the stop condition) or base it on an actual per-node frame-charge floor; at minimum document it as a pathology backstop, not a tuning knob.
- **Risk:** low
- **Generalization note:** "300× headroom" is measured on the golden suite; high skip-gap specs break the nodes/frame assumption.
- **Status:** Abandoned — already a minimal, well-justified pathology backstop; removing it deletes real 0-frame-loop protection with no compensating safeguard, and the skip-gap concern is architecturally backwards (dead-end/skip nodes run `rankedOptions`+rescue lanes = the MOST frames/node, so high-skip specs make the cap LESS likely to bind). Measured real headroom is ~1000× (full golden grid worst = 0.00095 nodes/frame, max 437 nodes absolute; cap=budget binds only above 1.0 nodes/frame). No clean low-risk win; not pursued.

### 14. `HANDOFF_AXIS_OVERSHOOT_WEIGHTS`: two-entry named-axis table with over-precise 5.76
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** constant + comment 547-554 (used in `scoreCandidateForHandoff` cost path).
- **Complexity smell:** Hand-populated map `{speed:5.76, air:16}`; 5.76 is suspiciously over-precise (fit residue), and the table hard-codes exactly which two axes get asymmetric overshoot treatment.
- **Proposed simplification:** Derive weights from each axis's scorer sensitivity (or round + document provenance); replace 5.76 with a named derived quantity; test dropping the asymmetry under relaxed acceptance.
- **Risk:** medium
- **Generalization note:** Only speed/air handled; any future axis silently gets symmetric-only treatment.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #12 baseline `simplify-12-repair-margin-ramp-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Replaced the over-precise `speed: 5.76` overshoot weight with the rounded named `HANDOFF_SPEED_OVERSHOOT_WEIGHT = 6`, and derived the `air` weight from the scorer's `AXIS_QUALITY_TOLERANCE` (`1 / 0.25^2 = 16`) while keeping the explicit speed/air policy table.

### 15. Reuse / brake / startup extra-candidate lanes are three parallel generate-cache-score-push copies
*(sources: handoff-core-rescue, handoff-admission-branch)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** reuse push 2424-2442, brake push 2448-2475 in `rankedOptions`; `cachedReuseCatchCandidates` 2588-2602, `reuseCatchCandidates` 2734-2775; `cachedBrakeCatchCandidates` 2634-2654, `brakeCatchCandidates` 2659-2698 (seed +7919); `startupDeadEndCandidates` 2227-2258 (seed 7000+attempt, 0x85ebca6b).
- **Complexity smell:** Three generators share one shape — cache lookup, seeded RNG (own magic multiplier 7919 / 7000 / 1000003 / 0x85ebca6b), generation loop with paired attempt/success telemetry, ref-clearing, `scoreCandidateForHandoff` push with hand-computed `extraRankBase`. Duplicated rather than one helper; the manual `extraRankBase + reuse.length + j` arithmetic is fragile.
- **Proposed simplification:** Introduce one `extraCandidateLane(node, gap, {tag, generate, cacheKey, seedSalt})` owning caching, telemetry, ref handling, and rank offsetting; register reuse/brake/startup as three descriptors. Centralize seed mixing in one documented function.
- **Risk:** low
- **Generalization note:** Distinct-by-accident seed salts make the determinism contract fragile; a shared helper makes it explicit.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Added one shared `extraCandidateLane` lane runner (with `resolveExtraCandidates` for the optional per-node memo slot) that all three lanes register through as descriptors, plus a shared seeded-RNG `sampleSeededCatchCandidates` generator for the brake+startup lanes; the reuse-vs-brake cache-key semantics and the four seed salts (7919 / 7000 / 1000003 / 0x85ebca6b) are preserved verbatim as descriptor parameters. Removed the `cachedReuseCatchCandidates` / `cachedBrakeCatchCandidates` wrappers and the duplicated push/RNG loops.

### 16. Per-node hash-seed formula copied 4-5 ways
*(sources: handoff-admission-branch, handoff-quality-scoring, handoff-forward-eval-repair)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `matureReuseExtraSeed` 2627-2632, `lowSlackTraversalBranchSeed` 2966-2972, `shallowQualityTailThrottleSeed` 3268-3274, `tailCompletionWindowSeed` 3276-3283; fwd-eval seeds `openingBestForwardEvalSeed`/`matureForwardEvalSeed`/`subminForwardEvalSeed` 4613-4642, 4707-4713; startup/brake RNG seeds ~2238, ~2684.
- **Complexity smell:** All are `imul(gapIndex+1, 0x9e3779b1) ^ imul(prefixNextLineId, 0x85ebca6b) [^ ...] ^ SALT`, each paired with `unitHash(seed) < pressure` for fractional-count-via-randomization. One idiom copied many ways; three fwd-eval seeds differ only by one xor constant.
- **Proposed simplification:** Add one `nodeHash(node, ...salts)` and one `stochasticGate(node, salt, pressure)` (or `stochasticRound`); rewrite all gates to call them. Centralizes the hash constants and makes the determinism contract explicit.
- **Risk:** low
- **Generalization note:** Grid-independent pure de-duplication.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Added one shared `nodeHashSeed(node, ...salts)` that reproduces the `imul(gapIndex+1, 0x9e3779b1) ^ imul(prefixNextLineId|0, 0x85ebca6b)` core and XORs in each call site's own salt(s); all seven per-node seed functions (`matureReuseExtraSeed`, `lowSlackTraversalBranchSeed`, `shallowQualityTailThrottleSeed`, `tailCompletionWindowSeed`, `openingBestForwardEvalSeed`, `subminForwardEvalSeed`, `matureForwardEvalSeed`) now delegate to it, preserving every salt constant verbatim. The startup/brake RNG seeds use a different additive `imul(seed,1000003)+gapIndex+seedSalt` idiom already centralized by #15, so they were left untouched. No `stochasticGate` wrapper added — the gates mix `<`/`>=` comparisons and per-call salts, so a wrapper would obscure more than it dedups.

### 17. Branch-width-vs-slack decided in two disjoint places
*(sources: handoff-core-rescue, handoff-admission-branch)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `lowSlackTraversalBranchLimit` 2950-2964 (`LOW_SLACK_BRANCH_FULL=1.25`/`ZERO=2.0`); `openingBestBranch2SlackPressure` via `OPENING_BEST_FWD_SLACK_BRANCH2/3` 586-589 (used at 2494).
- **Complexity smell:** Two constant sets encode "how much slack before we widen/narrow branching" with unrelated numbers. `lowSlackTraversalBranchLimit`'s whole apparatus (smoothstep + seeded coin flip + dedicated seed) exists only to shave *one* branch off some low-slack nodes.
- **Proposed simplification:** Unify branch-width selection into one `slack→branch` function consumed by both the general policy and the opening-best lane, one set of slack thresholds. Consider replacing the ±1 coin flip with a deterministic threshold (`branch = slack < 1.5 ? B-1 : B`).
- **Risk:** medium
- **Generalization note:** `budgetSlack` is model-relative but two disjoint threshold sets guarantee drift as budgets scale.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.1%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #14 baseline `simplify-14-round-overshoot-weight-a01`; valid 1920/1920, fingerprint unchanged; 1914/1920 `track_hash` match, 6 changed). Replaced the low-slack branch-limit smoothstep plus per-node hash coin flip with one deterministic `budgetSlack < 1.5` threshold, removing the dedicated branch seed and the separate 1.25/2.0 pressure constants; the opening-best slack thresholds remain separate for this focused step.

### 18. `forwardEvalMinBudget=75_000` gate + sub-min ramp are grid-anchored and only reachable via non-default override
*(sources: handoff-core-rescue, handoff-forward-eval-repair)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `forwardEvalMinBudget` 4037-4042; `SUBMIN_FORWARD_EVAL_START_FRAMES=20_000` 608; `usesForwardEvalAtBudget`/`subminForwardEvalPressure` 4622-4642.
- **Complexity smell:** Fwd-eval activates at a fixed 75k with a hash-gated linear ramp between 20k and 75k. Both are absolute anchors chosen so "≤50k stays byte-identical." Outside the grid the gate fires immediately with no ramp and the window is meaningless.
- **Proposed simplification:** Anchor the gate to `predictedFirstCompletionFrames`; make fwd-eval simply on/off at `fwdEvalMin` (drop the submin smoothstep + seed), or express the ramp start as a fraction of `fwdEvalMin`.
- **Risk:** high
- **Generalization note:** 75k/20k carry no meaning for a spec whose completion cost differs from the golden distribution.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #17 baseline `simplify-17-deterministic-low-slack-branch-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Replaced the 20k→75k stochastic sub-min forward-eval ramp plus per-node seed with a hard `targetBudget >= fwdEvalMin` gate; below the gate the local proxy ranker is always used.

### 19. Startup-support start seeds + x-delay: hand-enumerated tables gated by a triple-smoothstep product
*(sources: handoff-core-rescue, handoff-start-output)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `startupSupportStartSeeds` 4917-4955; `startupSupportXDelayFrames` 4957-4981; `startupSupportXDelayBudgetPressure` 4983-4988; constants `START_SUPPORT_*` 529-540 (`LOW_AIR_MAX=0.35`, `X_DELAY_AIR_MAX=0.40`, delay table `[0,1,2]`, offsets `[-0.75,0,1.25]`, budget 50k/50k).
- **Complexity smell:** Fires only for a low-air (≤0.35/0.40) first contact with runup and budget>50k, slicing a discrete `[0,1,2]` x-delay table by `airPressure × durationPressure × budgetPressure` and hand-picking speed offsets, a support line at y=5 backtracked 80px, margins `K_BOUNCE_LANDING+2/+3`. Three pressures × several constants to choose between 1-3 delay offsets; the air band [0.35,0.40] is razor-thin.
- **Proposed simplification:** Fold the discrete tables into the continuous pressure (`delayFrames = round(maxDelay × pressure)`), drop the duration/thin-air smoothsteps to a single low-air+budget gate, and evaluate whether the whole low-air support branch can be subsumed by the general ballistic-start generator. Name the geometric line constants.
- **Risk:** high
- **Generalization note:** air≤0.35 and 50k gates assume today's opening-beat air distribution/grid; the branch either never fires or fires everywhere off-distribution.
- **Status:** Rejected — Δheadline -0.1, P(Δ≤-0.1)=45.3%, candidate cumulative Δheadline vs campaign-start baseline +2.1 (accepted cumulative remains +2.2; full canonical vs current #18 baseline `simplify-18-hard-fwd-eval-gate-a01`; valid 1920/1920, fingerprint unchanged; 1768/1920 `track_hash` match, 152 changed). Tested replacing the `[0,1,2]` x-delay table plus air/duration/budget pressure product with a low-air+budget gate that keeps the no-delay support seed and adds one rounded delay; non-inferiority was not established, so the source change was reverted.

### 20. Impact-target resolution inlined in the main compile block
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `compileHandoffInternal` 769-822 (impactOff, feasibility-bound pass, `nextImpact` lookahead pass, three `setImpactCurve*Pressure` global setters).
- **Complexity smell:** ~55 lines mixing three concerns (feasibility capping, arrival-lookahead copy, three curve-pressure globals) inline in the hot setup path, making the entry function hard to read and the global setters easy to desync. Magic `nextGapSeconds` fallback 1.5s (792).
- **Proposed simplification:** Extract `resolveImpactTargets(spec, gaps, gapAxisTargets)` returning mutated gaps + one `ImpactCurvePressures` object set from a single call site. Behavior-preserving.
- **Risk:** low
- **Generalization note:** Three separate global setters are an easy source of reset drift.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Extracted `resolveImpactTargets(spec, gaps, gapAxisTargets, allContactFrames)` owning the feasibility cap, arrival lookahead, and all impact-curve-pressure globals; `compileHandoffInternal` now calls it from one site.

### 21. Tail-completion throttle: 2-seed hash-gated cascade of budget/feedback smoothsteps
*(sources: handoff-admission-branch, handoff-quality-scoring)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `shouldAttemptNearTailCompletion` 3204-3221; `shouldAttemptTailCompletionWindow` 3223-3234; `shouldKeepShallowQualityTailCompletion` 3236-3248; `shallowQualityTailThrottlePressure` 3250-3266; `tailCompletionContactWindow` 3285-3289.
- **Complexity smell:** One boolean ("do we speculatively complete the tail") is decided by two overlapping randomized gates: a `remaining<=2` shallow throttle (budget×feedback smoothstep, own seed, `FEEDBACK_SCALE=6`) plus a window branch (second budget smoothstep, boundary-pressure hash, different seed). Deep nesting; two 150k smoothsteps.
- **Proposed simplification:** Collapse to one acceptance-probability `p(remainingContacts, budget, uniqueFull)` with a single hash draw, folding the shallow throttle and window boundary into one continuous window that shrinks toward 0 as budget/feedback drop. Delete `shallowQualityTailThrottle*` and the `remaining<=2` special case; share the seed helper (entry #16).
- **Risk:** medium
- **Generalization note:** 150k scales + `remaining<=2` + window base 8 assume current tail lengths at grid budgets.
- **Status:** Rejected — Δheadline -0.1, P(Δ≤-0.1)=30.2%, candidate cumulative Δheadline vs campaign-start baseline +2.1 (accepted cumulative remains +2.2; full canonical vs current #18 baseline `simplify-18-hard-fwd-eval-gate-a01`; valid 1920/1920, fingerprint unchanged; 1798/1920 `track_hash` match, 122 changed). Tested collapsing the shallow tail throttle and window-boundary gate into one acceptance probability with one hash draw; non-inferiority was not established, so the source change was reverted.

### 22. `releaseVerticalSetupPenalty`: quadratic gated by three stacked spec+budget+feedback pressures
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `releaseVerticalSetupPenalty` 3426-3443; `releaseVerticalSetupPressure` 3445-3465; constants 567-574.
- **Complexity smell:** `penalty = weight × pressure × excess²` where `pressure = max(lowAir, cadence) × maturity(budget/150k) × fullFeedback(telemetry/48)`, and the safe-velocity threshold itself lerps 8px↔5px by that pressure. Three multiplied gates + a pressure-dependent threshold guarding one quadratic; 8px/5px/`FPS*0.72` look hand-tuned.
- **Proposed simplification:** Flatten to `penalty = weight × setupPressure × excess²` with a fixed safe threshold, dropping the maturity/full-feedback multipliers. Verify they aren't just suppressing the penalty at 50k (grid-fit noise).
- **Risk:** medium
- **Generalization note:** 150k and /48 make the penalty near-inert off-grid regardless of geometry.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #18 baseline `simplify-18-hard-fwd-eval-gate-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Flattened to geometry-only setup pressure with a fixed 8px safe vertical velocity threshold, dropping the maturity/full-feedback multipliers and the 8px↔5px pressure-dependent threshold lerp.

### 23. Leaf-readiness campaign machinery is a default no-op (`LR_LEAF_RDY_LAMBDA=0`)
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `leafReadinessLambda`/`Kind` 3579-3586; `leafFrontierReadiness` 4333-4346; `leafReadinessFromArrival` + 5-way switch 4351-4376; `LEAF_RDY_*` 4331-4332; `objectiveLeafValue` tilt 4288-4290.
- **Complexity smell:** Comment states "NOT a production feature"; lambda defaults 0 so the objective tilt is inert and the 5-way kind switch is only reachable when the campaign env var is set.
- **Proposed simplification:** Delete `leafReadinessLambda`/`Kind`, `leafFrontierReadiness`, `leafReadinessFromArrival`, the `LEAF_RDY_*` constants, and the tilt block; keep the study behind its harness only if still wanted.
- **Risk:** low
- **Generalization note:** Pure campaign scaffolding, no production dependence.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Deleted `leafReadinessLambda`/`leafReadinessKind`, `leafFrontierReadiness`, `leafReadinessFromArrival` (+5-way kind switch), the `LEAF_RDY_*` constants, and the `objectiveLeafValue` tilt block; dropped the now-unused `impactFeasibility`/`predictArrivalAtNextContact` imports. Focused test suite (83 tests) green; no test exercised `LR_LEAF_RDY_LAMBDA`.

### 24. `forwardTerminalReadiness` is exported but has zero call sites
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `forwardTerminalReadiness` 4303-4316.
- **Complexity smell:** Exported diagnostic whose own comment says production fwd-eval intentionally does not use it; repo-wide grep finds no importer.
- **Proposed simplification:** Delete the function.
- **Risk:** low
- **Generalization note:** Dead; removal cannot affect any score.
- **Status:** Abandoned — catalog was wrong: `tests/objective_quality.test.ts` imports `forwardTerminalReadiness` (line 22) and exercises it in the `describe("diagnostic frontier readiness")` block (assertions at lines 173, 192), so the "no importer" premise is false and deleting it would break tests.

### 25. Shadow-leaf agreement/factor telemetry is a large measure-only subsystem gated off by default
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `shadowCapture`/`lastShadow*` globals + `resetShadowLeafState` 3705-3720; `recordFwdEvalShadowAgreement` + `shadow_fx_*` 3832-3930; shadow branches in `forwardRolloutScore`/`forwardAvgNextScore`/`forwardArcValue` 4397-4417, 4458-4497, 4519-4540; `scoreCandidateForHandoff` shadow stamp 3351-3360.
- **Complexity smell:** `LR_FWD_EVAL_LEAF=shadow` threads capture bookkeeping through every rollout function plus a ~15-field `shadow_fx_*` accumulator behind `LR_SHADOW_FACTORS=1`; all non-default, materially complicating the three core rollout functions.
- **Proposed simplification:** If the campaign is finished, delete the shadow leaf mode, plumbing, recorder, and `shadow_fx_*` counters; the three rollout functions collapse back to a single `leafValue` path.
- **Risk:** low
- **Generalization note:** Measure-only; removal loses only a diagnostic.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Deleted the `LR_FWD_EVAL_LEAF=shadow` mode + `LR_SHADOW_FACTORS` factor accumulator: the `shadowCapture`/`lastShadow*`/`LeafFactors` globals, `resetShadowLeafState`, `shadowGapKind`, `recordFwdEvalShadowAgreement`, all `shadow_*`/`shadow_fx_*` counters, and the shadow plumbing/stamp in the three rollout functions + `scoreCandidateForHandoff` (they collapse back to the single `leafValue` path). Removed the feature-only test in `optimizer_handoff.test.ts` and the shadow-only study driver `eval_rollout_ranking.sh`. Verified off-by-default (`forwardEvalLeaf()` returns `objective`; `LR_SHADOW_FACTORS` unset) and no external consumer of the shadow fields (`types.ts` `fwd_eval?` never declared them; `eval_arc_apples/leaf_factors/leaf_window.ts` use only `objectiveLeafValue`).

### 26. `objectiveLeafValue` carries two `void`-ed dead parameters and a never-firing defensive branch
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `objectiveLeafValue` 4217-4292; `void rootGapIndex` 4236, `void missedContacts` 4262, `missingFitCount` branch 4239-4257.
- **Complexity smell:** Two of five parameters are immediately voided ("for signature stability") though every call site is internal; the `missingFitCount` accumulator handles a case the comment flags as defensively impossible (candidate gates guarantee committed catches).
- **Proposed simplification:** Drop `rootGapIndex`/`missedContacts` from signature and callers; if `missingFitCount` is provably always 0, remove the branch (or convert to an assert).
- **Risk:** low
- **Generalization note:** Internal-only signature; no spec/budget assumption.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Dropped the two `void`-ed params (`rootGapIndex`, `missedContacts`) from `objectiveLeafValue` and propagated the removal through the whole dead threading chain (`forwardRolloutScore`/`forwardAvgNextScore` `rootGapIndex`+`missed` args, `forwardArcValue`/`startForwardScore`/`startSupportDelayRobustScore` call sites, plus the eval_arc_apples caller and the handoff unit tests). KEPT the `missingFitCount` branch: it is structurally 0 on the production forward-eval path (contact gaps only ever commit real candidate fits) but the exported function has a dedicated unit test that deliberately feeds a null fit at a contact gap and asserts the `×e^-1` factor — removing/asserting it would break that test, so the defensive branch stays.

### 27. `handoffStatePenalty` uses unexplained physical-magic thresholds (8 px/f, 70°)
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `handoffStatePenalty` 4761-4774; `HANDOFF_STATE_WEIGHT 0.08` 546.
- **Complexity smell:** Hard-codes `verticalExcess = max(0,|v.y|-8)`, `angleExcess = max(0,angleDeg-70)/10`, and a `speed<=1e-6 → weight*8` case, with no derivation. Only runs on the sub-75k local-ranker path (fwd-eval bypasses it), so its tuning is stale.
- **Proposed simplification:** Delete it (fwd-eval already scores state via the true leaf) or re-derive 8/70 from the readiness catch model; at minimum name the constants.
- **Risk:** low
- **Generalization note:** Only active below the 75k gate; absolute physical numbers, not spec-relative.
- **Status:** Accepted — byte-identical, named/documented the magic constants only; did NOT delete the function or re-derive the thresholds — it's the sole local-ranker state-quality term for genuine sub-75k compiles (fwdEvalMin default), a real code path the canonical suite (min budget 125k) cannot verify at all, so removing it would be an unverified behavioral change counter to the campaign's generalize-to-more-budgets goal. Introduced `HANDOFF_STATE_VERTICAL_EXCESS_PX_PER_FRAME=8`, `HANDOFF_STATE_ANGLE_EXCESS_DEG=70`, `HANDOFF_STATE_ANGLE_SCALE_DEG=10`, `HANDOFF_STATE_STALL_WEIGHT_MULTIPLIER=8` with a doc comment; verified byte-identical via 1-seed/40-spec/4-budget track_hash diff (160/160 match).

### 28. `previewFutureContacts` is elaborate accumulator machinery over a forced single iteration (K=1, HORIZON=1)
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `previewFutureContacts` 4715-4758; `HANDOFF_PREVIEW_K=1` 507, `HANDOFF_PREVIEW_HORIZON=1` 515; consumers `scoreCandidateForHandoff` 3363-3390.
- **Complexity smell:** With HORIZON=1/K=1 the loop runs at most once and returns ≤1 candidate, so all struct fields are trivially 0/1; the surrounding scarcity ladder + previewCost weighting is multi-branch apparatus around a one-shot lookahead, only on the sub-75k tier.
- **Proposed simplification:** Collapse to a single "best next candidate cost + survived?" probe (no loop, no multi-field struct), fold scarcity into one term. Consider removing the preview path if the sub-75k tier is being retired.
- **Risk:** medium
- **Generalization note:** Only meaningful on the shrinking sub-75k tier; dead-ish if the fwd-eval gate is lowered.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #22 baseline `simplify-22-flat-release-vertical-setup-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Replaced the `previewFutureContacts` accumulator/HORIZON loop with a direct one-contact `previewNextContact` probe and removed the unused `totalCost` result field while preserving the existing scarcity/cost scoring.

### 29. Impact-ask threshold drift (0.3 vs 0.35) scattered across fwd-eval/readiness
*(cross-ref objective entry #73)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `recordFwdEvalAgreement` `>=0.35` 3791; `shadowGapKind` `>=0.35` 3836; `LEAF_RDY_IMPACT_MIN_ASK 0.3` 4332; `leafReadinessFromArrival` `<0.3` 4364.
- **Complexity smell:** The "is this gap impact-targeted" cutoff is 0.35 in two telemetry classifiers and 0.3 in leaf readiness — the same concept with two undocumented magic values.
- **Proposed simplification:** Define one shared `IMPACT_ASK_MIN` (reuse `objective.ts` `OBJECTIVE_IMPACT_MIN_ASK`); if telemetry 0.35 must differ, document why in one place.
- **Risk:** low
- **Generalization note:** Threshold semantics are spec-agnostic; unifying removes drift risk.
- **Status:** Accepted (byte-identical) — Premise was mostly STALE: 3 of the 4 cited sites were already deleted by this campaign — `shadowGapKind >=0.35` by #25 (shadow-leaf telemetry removal) and both leaf-readiness sites (`LEAF_RDY_IMPACT_MIN_ASK 0.3`, `leafReadinessFromArrival <0.3`) by #23. Only `recordFwdEvalAgreement`'s `>=0.35` remained (now ~3510), and it is pure telemetry (writes only `fwdEvalTotals.*`, returns void, never reaches `track_hash`). Took Option A: import `OBJECTIVE_IMPACT_MIN_ASK` (0.3) from `objective.ts` and use it in place of the inline `0.35`, de-drifting the classifier from the scorer's cutoff. The value moved 0.35→0.3 but only shifts a diagnostic counter split; 1-seed probe (seed=0, 160 rows across 4 budgets) shows all `track_hash` byte-identical vs `attempt-aim-highk-gated-j32-a01`. `objective.ts`'s `OBJECTIVE_IMPACT_MIN_ASK` definition and real call sites (#73) left untouched.

### 30. `fwdRankBucket`/`fwdValueGapBucket` hard-coded telemetry histogram edges
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `fwdRankBucket` 3746-3750; `fwdValueGapBucket` 3752-3759.
- **Complexity smell:** Two if-ladders hard-code histogram edges reused by both the agreement and shadow recorders, tied to value magnitudes on the current board.
- **Proposed simplification:** If telemetry is kept, replace with a shared bucketing helper taking an edges array; if the instrument is no longer read, delete both with the `fwdEvalTotals` histogram fields.
- **Risk:** low
- **Generalization note:** Telemetry only; nothing branches on the edges.
- **Status:** Accepted (byte-identical) — Took the DELETE option: the three histograms these buckets feed (`fwd_winner_quality_rank_hist`, `fwd_quality_top1_fwd_rank_hist`, `fwd_disagree_value_gap_hist`) are write-only. Fresh greps confirm no analysis script reads them — `study_cc_explore.ts`/`study_budget_spend.ts`/`study_difficulty_model.ts` consume only `fwd_eval_frames_charged`/`fwd_eval_calls`/`start_eval_frames_charged` from `fwd_eval`; the only histogram readers were self-referential correctness assertions in `optimizer_handoff.test.ts`. Entry #25 had already removed the shadow recorder, so `fwdRankBucket`/`fwdValueGapBucket` were used only by `recordFwdEvalAgreement`. Deleted both bucket functions, the three histogram fields + their accumulation lines in `fwdEvalTotals`, the spread-copies in `snapshotFwdEvalStats`, the `types.ts` `fwd_eval` histogram declarations, and the now-dead test assertions (scalar sum counters `fwd_rank_of_quality_top1_sum`/`fwd_quality_rank_of_winner_sum` kept — out of scope, no hard-coded edges). Focused tests pass (80/80); 1-seed probe (seed=0, 40 specs × 4 budgets) all 160 `track_hash` byte-identical vs `attempt-aim-highk-gated-j32-a01`.

### 31. Three near-duplicate impact-curve spec-classifier detectors (AND of reverse-fit thresholds)
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `impactCurveElevationRoomPressure` 5244-5265; `impactCurveHighSpeedReliefProfilePressure` 5267-5307; `impactTemplateHoldProfilePressure` 5309-5357.
- **Complexity smell:** All three iterate the same contact gaps, aggregate the same axis means/ranges + median gap, then multiply chains of smoothsteps with bare knees (`contactCount-40`, `meanAir-0.50`, `meanSpeed-0.56`, `meanImpact-0.30`, `verticalFraction-0.02`, `elevationRange` band-pass). `impactTemplateHoldProfilePressure` multiplies SIX low-pressure terms so it is ~1 only for one narrow spec profile. Three copies of one pattern differing only in which knobs they pick; all feed module-global setters into `arc_placement`.
- **Proposed simplification:** Extract one helper taking aggregated stats once + a declarative `{stat, start, span, direction}` table, returning `clamp01(product)`; the three become three data tables. Then evaluate whether all three are needed or collapse to one profile vector.
- **Risk:** medium
- **Generalization note:** `contactCount-40` and the axis thresholds are tuned to today's golden specs; off-distribution they mis-classify.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #28 baseline `simplify-28-one-contact-preview-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Extracted one shared `impactCurveProfileStats(...)` pass for contact count/gap median/axis means/elevation ranges/vertical fraction and rewired all three pressure calculators to consume it, preserving every threshold and pressure formula.

### 32. Duplicated `cadenceRoomPressure` smoothstep across detectors
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `impactCurveElevationRoomPressure` ~5263; `impactCurveHighSpeedReliefProfilePressure` ~5305 (and echoes at `(median-28)/14` etc.).
- **Complexity smell:** `smoothstep((medianGapFrames - 20) / 14)` is written verbatim in ≥2 detectors with bare 20/14.
- **Proposed simplification:** Add `cadenceRoomPressure(gaps)` with two named constants and call from all sites.
- **Risk:** low
- **Generalization note:** The 20/14 knee is implicitly calibrated to current beat densities; naming makes it one tunable point.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Extracted `cadenceRoomPressure(medianGapFrames)` with `CADENCE_ROOM_START_FRAMES=20` / `CADENCE_ROOM_SPAN_FRAMES=14`, called from the 2 verbatim sites (`impactCurveElevationRoomPressure`, `impactCurveHighSpeedReliefProfilePressure`). The `(median-28)/14` echo in `impactTemplateHoldProfilePressure` is a different (inverted, 28-start) knee and was left untouched.

### 33. Start-support and ballistic-start budget pressures hard-wired to the 50k grid
*(sources: handoff-start-output)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `ballisticStartBudgetPressure` 5166-5171 (`START_BALLISTIC_BUDGET_START/SPAN=50k/50k`, 527-528); `startupSupportXDelayBudgetPressure` 4983-4988 (`START_SUPPORT_X_DELAY_BUDGET_START/SPAN=50k/50k`, 537-538).
- **Complexity smell:** Two functions ramp 0→1 over 50k-100k with identical constant pairs, encoding "interesting regime is 50k-100k"; at very low budgets both silently disable their pools.
- **Proposed simplification:** Replace with one shared `budgetPressure(targetBudget, start, span)` (or a shared `BUDGET_RAMP_START/SPAN`); consider expressing as a fraction of `targetBudget`.
- **Risk:** medium
- **Generalization note:** Absolute 50k pivot is meaningless at 10k or 2M.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #31 baseline `simplify-31-impact-profile-stats-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Replaced the duplicate ballistic-start and startup-support x-delay budget pressure functions/constants with one shared `startBudgetPressure(...)` over the unchanged 50k→100k ramp.

### 34. `startSeedForwardScore` blends a "robust" rollout only under an exact greedy/depth2/branch1 config
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `startSeedForwardScore` 4990-5018; `startSupportDelayRobustScore` 5020-5045.
- **Complexity smell:** The robust blend is gated on `cfg.variant==="greedy" && cfg.depth===2 && cfg.branch===1` AND `supportDelayFrames>0` AND `pressure>0` — a narrow conjunction that ties scoring to one exact fwd-eval config; if the default config changes, the path silently disappears.
- **Proposed simplification:** Derive the robust decision from a semantic property ("this seed carries a support-delay to de-risk") independent of the exact tuple, or always blend when `supportDelayFrames>0 && pressure>0`. If support-delay seeds are removed (#19), delete both functions.
- **Risk:** medium
- **Generalization note:** The hard `(greedy,2,1)` tuple is dead the moment the default is retuned.
- **Status:** Rejected — Δheadline +0.0, P(Δ≤-0.1)=32.3%, candidate cumulative Δheadline vs campaign-start baseline +2.2 (accepted cumulative remains +2.2; full canonical vs current #33 baseline `simplify-33-shared-start-budget-pressure-a01`; valid 1920/1920, fingerprint unchanged; 1823/1920 `track_hash` match, 97 changed). Tested keying the robust support-delay blend only to `supportDelayFrames>0 && startBudgetPressure(targetBudget)>0`, independent of the hard `(greedy,2,1)` tuple; non-inferiority was not established under the current default `LR_START_EVAL=best:1:5`, so the source change was reverted.

### 35. Repeated magic `+20` output-duration padding
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `evaluateNode` `durationFrames + 20` 5437; `partialOutputDurationFrames` `horizonFrame + 20` 5481.
- **Complexity smell:** The 20-frame tail padding appears as a bare number at two sites with no named constant; a reader can't tell if the two 20s are the same concept.
- **Proposed simplification:** Introduce `OUTPUT_TAIL_PAD_FRAMES=20` (or reuse an existing rideout margin) at both sites with a one-line comment.
- **Risk:** low
- **Generalization note:** Absolute per-track padding, grid-agnostic; smell is duplication/unexplained constant.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Introduced `OUTPUT_TAIL_PAD_FRAMES=20` and used it at both cited sites (`evaluateNode` `durationFrames + 20`, `partialOutputDurationFrames` `horizonFrame + 20`). Left the third `forwardNodeScore` `+ 20` site for the broader #100 sweep.

### 36. `startHeuristicCost` / `ballisticFirstContactCost` share a copy-pasted speed+angle cost and double-count
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `startHeuristicCost` 5183-5192; `ballisticFirstContactCost` 5194-5210; `targetStartAngle` 5218-5221.
- **Complexity smell:** Both compute `speedCost + 0.35*angleCost` with `angleCost = ((angle-target)/70)²`; `ballisticFirstContactCost` then *also* adds `START_HEURISTIC_WEIGHT*startHeuristicCost`, counting the angle/speed penalty twice with two angle definitions. Bare 70°, 0.35, low-speed cliff (`speed<target*0.45`), and `targetStartAngle` clamps `6 + (0.5-air)*90` into `[-12,24]`.
- **Proposed simplification:** Extract `startAngleSpeedCost(speed, angleDeg, axes)` with named `ANGLE_NORM_DEG`/`ANGLE_WEIGHT`; have `ballisticFirstContactCost` use impact-frame speed/angle directly instead of re-adding `startHeuristicCost` (or document the double count).
- **Risk:** medium
- **Generalization note:** Not grid-dependent, but 70°/0.35/6px bake in current speed-axis scaling.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.2 (full canonical vs current #33 baseline `simplify-33-shared-start-budget-pressure-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Extracted the shared `startAngleSpeedCost(...)` with named angle/low-speed constants; `startHeuristicCost` and `ballisticFirstContactCost` now use the same speed+angle cost path, and the ballistic ranker's retained initial-state bias is documented instead of hidden as a second inline formula.

### 37. `ballisticStartPool` opaque min/max juggling of three fixed pool sizes
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `buildStartOptions` pool computation ~4830-4835.
- **Complexity smell:** `ballisticStartPool = min(4, orderedBallisticStarts.length, floor(4*budgetPressure))`; `baseStartPool = max(0, START_SCORING_POOL-1 - ballisticStartPool)`. The implicit `-1` reserving the default seed slot and nested min/max are hard to read; only ever yields 0-4 ballistic seeds.
- **Proposed simplification:** Explicit allocation: reserve slot 0 for the default start, split the remaining `START_SCORING_POOL-1` between base/ballistic by budget pressure via one documented helper.
- **Risk:** low
- **Generalization note:** `floor(4*budgetPressure)` inherits the 50k assumption (#33).
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Extracted the nested min/max into a documented `splitStartScoringPool(budgetPressure, availableBallisticStarts)` helper framed as "reserve slot 0 for the default start, split the remaining `START_SCORING_POOL-1` between base/ballistic by budget pressure"; arithmetic (min/floor/max) unchanged.

### 38. `meanAuthoredImpactAfterFirstFeasibleContact` silently drops the first contact via `slice(1)`
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `meanAuthoredImpactAfterFirstFeasibleContact` 5235-5242.
- **Complexity smell:** Unconditionally excludes contact 0 on the positional assumption "index 0 is never impactable," rather than using the same feasibility machinery (`impactFeasibilityBound`) used elsewhere. If a spec's first contact is impactable, its impact is dropped from the mean.
- **Proposed simplification:** Compute the mean over contacts whose gap actually received a bounded impact target (the `gap.targets.impact` set at ~782-801), so "first feasible" is defined consistently.
- **Risk:** medium
- **Generalization note:** `slice(1)` reflects today's specs (opener never impactable).
- **Status:** Rejected — Δheadline +0.1, P(Δ≤-0.1)=27.0%, candidate cumulative Δheadline vs campaign-start baseline +2.3 (accepted cumulative remains +2.2; full canonical vs current #36 baseline `simplify-36-start-angle-speed-cost-a01`; valid 1920/1920, fingerprint unchanged; 1824/1920 `track_hash` match, 96 changed). Tested deriving `setImpactTemplateSpecMeanImpact` from resolved bounded `gap.targets.impact` via `impactProfile.meanImpact` and deleting the `slice(1)` authored-impact helper; non-inferiority was not established (notably 125k Δ=-0.7), so the source change was reverted.

### 39. `buildNodeOutput` emits a flat telemetry bag mirroring the same source counts several ways
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** stats block 5533-5585; `selectedCandidateSourceCounts`/`selectedAxisQualitySourceCounts`/`selectedAdmissionLaneCounts` 5589-5626.
- **Complexity smell:** Source counts are emitted both as a nested map AND as five flat scalar mirror fields; three trace-walking helpers each re-iterate `node.rankTrace`. Redundant surface that must stay in sync.
- **Proposed simplification:** Emit the nested map once (lab reads from it), delete the flat mirrors; fold the three `rankTrace` walks into one pass producing `{bySource, byAxis, byLane}`.
- **Risk:** low
- **Generalization note:** Telemetry only, no scoring impact.
- **Status:** Accepted — telemetry-only; 160/160 seed=0 `track_hash` byte-identical vs baseline (no scoring impact). Post-#1 only two trace-walking helpers remained (`selectedAdmissionLaneCounts`/`byLane` were already deleted). Folded `selectedCandidateSourceCounts` + `selectedAxisQualitySourceCounts` into one single-pass `selectedSourceCounts` returning `{bySource, byAxis}`, and deleted the five flat scalar mirror emissions (`handoff_selected_candidate_{pool,reuse,brake,startup,axis_quality}_count`) — the sole consumer `analyze_golden_curve.ts` reads the nested `handoff_selected_candidate_by_source` map first and only falls back to the flat fields via `legacySelectedCandidateSourceStat` for pre-nested-map archives, so the legacy reader + `types.ts` optional defs were kept for old-archive compat while the redundant emission was dropped. Dropped the now-moot flat-mirror consistency/comparison assertions in `optimizer_handoff.test.ts`.

### 40. Readiness-v0 per-gap telemetry reaches into detection internals via `(det as any).measurements`
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `evaluateNode` readiness-per-gap block 5451-5460.
- **Complexity smell:** Pulls velocity via a lint-ignored `(det as any).measurements?.velocity` cast, re-derives speed/angle, and calls `readinessCatch` per gap inline in the hot evaluate path (explicitly "telemetry only"); duplicates speed/angle-from-velocity math from the start cost functions.
- **Proposed simplification:** Expose `measurements.velocity` via a typed accessor; factor speed+angle-from-velocity into a shared helper reused by the start costs. Consider gating the telemetry behind a flag if unconsumed.
- **Risk:** low
- **Generalization note:** Telemetry only; smell is the untyped reach + duplicated math.
- **Status:** Accepted — byte-identical (160/160 seed=0 track_hashes match baseline at all four budgets). Dropped the `(det as any).measurements?.velocity` cast + `deno-lint-ignore`: `detectWindow` already returns `Detection`, so `det.measurements.velocity` is `Vec2[]` directly (element type widened to `| undefined` for the honest out-of-bounds endFrame guard, no `noUncheckedIndexedAccess`). Factored `speedAngleFromVelocity({x,y})` shared by the readiness block and `buildNodeOutput`'s start-state readout (the two truly-identical `hypot`/`atan2*180/π`, no-abs, no-round sites). Left the start-cost math alone — it differs (`handoffStatePenalty` takes `Math.abs`; `startHeuristicCost`/`ballisticFirstContactCost` read `vx/vy`-shaped starts / derived `impactVy`). Did not gate the telemetry: unconsumed by analysis tooling but still part of the emitted archive schema (`types.ts` `readiness_per_gap`/`_mean`/`_min`), so gating would change archive output.

---

## Aim — `scripts/v0/optimizer/aim.ts`

### 41. Budget-grid-keyed maturity/high-K gates hardcode the 100k/200k canonical tiers
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `AIM_TOPK_MATURE_BUDGET_FRAMES`/`AIM_TOPK_HIGH_BUDGET_FRAMES`/`aimTopKBasesEffective` 222-311.
- **Complexity smell:** Two step thresholds (100k, 200k) hard-select aim-base count K (below 100k K=1; above 200k K=`AIM_TOPK_BASES_HIGH=6`), justified in comments by the canonical checkpoints. A compile at 90k/150k/1M falls into buckets reverse-fit to four checkpoints, not any per-frame probe-economics quantity.
- **Proposed simplification:** Replace the two steps with a single continuous smoothstep on `budget / probe-cost-per-base`; fold the three constants into that curve.
- **Risk:** high
- **Generalization note:** The integer thresholds are canonical tier boundaries, meaningless off-grid.
- **Status:** Abandoned — not a clean standalone simplification. The meaningful fix is the broader continuous `K(budget, air, slack)` surface in #49, which explicitly subsumes #41/#42/#43/#53; a #41-only edit either preserves the canonical grid by adding off-grid-only ramps (more machinery, little simplification) or retunes the accepted aim-base economics. Prior canonical evidence for the closest standalone cleanup (`attempt-aim-highk-smooth-pressure-j32-a01`) was reverted as inconclusive, so no fresh source change was pursued here.

### 42. `AIM_EXTRA_TOPK_*` smoothstep pressure cascade is a large reverse-fit constant family
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** constants 246-264; `defaultExtraAimBasePressure`/`SlackPressure`/`AirValleyPressure` 319-381.
- **Complexity smell:** ~18 magic constants multiplied as 6-8 smoothstep pressures to decide whether ONE extra aim base (5 vs 4) fires; comments tie breakpoints to named specs (`drums_tide`, `syncopated_switchback`, air range ~0.38). High-order gate for a single boolean bump.
- **Proposed simplification:** Collapse the AIR_VALLEY sub-cascade and the pressure stack into one smoothstep on a normalized "steady-dense-air" score, or drop the extra-base tier and let it be subsumed by the continuous-K curve (#41) — the code notes the high-K bump already subsumes it at 200k+.
- **Risk:** medium
- **Generalization note:** Every START/SPAN is calibrated to the current air/speed/grain/contact distributions.
- **Status:** Rejected — Δheadline -0.3, P(Δ≤-0.1)=67.9%, candidate cumulative Δheadline vs campaign-start baseline +1.9 (accepted cumulative remains +2.2; full canonical vs current #36 baseline `simplify-36-start-angle-speed-cost-a01`; valid 1920/1920, fingerprint unchanged; 1803/1920 `track_hash` match, 117 changed). Tried deleting the default fifth aim-base tier outright, removing the `AIM_EXTRA_TOPK_*` pressure cascade and its budget-slack wiring; non-inferiority was not established, with the main loss at 375k (-0.6), so the source change was reverted.

### 43. High-K bump gated on per-spec air-target RANGE (`0.38`) separating named specs
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `AIM_TOPK_HIGH_AIR_RANGE_MAX=0.38` + `narrowAirRange` branch 239-296.
- **Complexity smell:** K=6 fires only when air-target range < 0.38, a classifier boundary the comment says was drawn where "the two populations separate cleanly" between named specs — fit through today's spec list, not a physical property.
- **Proposed simplification:** Remove the air-range classifier; govern extra probe cost by continuous budget/probe-cost economics. If search-sensitivity matters, express it as measured probe-vs-search return.
- **Risk:** medium
- **Generalization note:** 0.38 is fit to the current air-range bimodality; a mid-range spec is classified arbitrarily.
- **Status:** Accepted — Δheadline +0.6, P(Δ≤-0.1)=18.6%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #36 baseline `simplify-36-start-angle-speed-cost-a01`; valid 1920/1920, fingerprint unchanged; 1600/1920 `track_hash` match, 320 changed). Removed the `AIM_TOPK_HIGH_AIR_RANGE_MAX=0.38` classifier and the `narrowAirRange` branch, so the K=6 high-budget bump is governed only by compile budget/env override; 125k stayed byte-identical while mature budgets moved +1.1/+0.4/+0.6.

### 44. ~A dozen telemetry fields retained permanently at constant 0
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `AimStats` + `aimTotals` + `snapshotAimStats` 561-604, 632-641, 782-796.
- **Complexity smell:** `rank_readiness_arrival_frames_charged`, `..._capture_free/charged/skipped`, `rank_quality_pred_err_*`, `..._val_bail` are documented as always 0, retained only for archive-query stability after free-capture/bounded-charge paths were deleted.
- **Proposed simplification:** Delete the always-0 fields; have the lab layer coalesce missing columns to 0 at read time.
- **Risk:** low
- **Generalization note:** Historical residue; not grid/spec dependent.
- **Status:** Accepted — byte-identical no-op (160/160 seed-0 track_hashes unchanged vs `attempt-aim-highk-gated-j32-a01`; all 80 focused tests pass). Deleted the 8 always-0 fields (`rank_readiness_arrival_frames_charged`, `rank_readiness_capture_{free,charged,skipped}`, `rank_quality_pred_err_{speed_sum,angle_sum,n}`, `rank_quality_pred_val_bail`) from `AimStats`/`aimTotals`/`snapshotAimStats` in `aim.ts` (catalog said "~a dozen" — actually 8; none were ever incremented). No lab-layer change needed: `types.ts` never declared them, and the only `compile_stats_json` consumer (`analysis/reports.ts reportCompileStats`) is a generic `json_each` top-level-scalar catalog that neither names these fields nor descends into the nested `aim` object, so old archives stay fully queryable and new ones simply omit the columns (coalesce-to-0 is moot).

### 45. Historical field-name mismatch (`rank_readiness_*` for the `LR_RANK_QUALITY` flag)
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `AimStats.rank_readiness_*` + comment 561-573, 630-633.
- **Complexity smell:** A stats block named `rank_readiness_*` though the flag is now `LR_RANK_QUALITY`; readers must constantly translate readiness→quality.
- **Proposed simplification:** Rename to `rank_quality_*` with a one-line alias/view in the lab archive reader rather than freezing misleading names in hot code.
- **Risk:** low
- **Generalization note:** Naming debt only.
- **Status:** Accepted — byte-identical no-op (160/160 seed-0 track_hashes unchanged vs `attempt-aim-highk-gated-j32-a01`; all 80 focused tests pass). Renamed the 5 surviving `rank_readiness_*` fields (`_pools`, `_top3_disagree`, `_top1_disagree`, `_candidates_scored`, `_objective_defined`) to `rank_quality_*` across `AimStats`/`aimTotals`/`snapshotAimStats`/`recordRankQualityPool` in `aim.ts`, so the whole `rank_quality_*` block (incl. the pre-existing `rank_quality_pred_*`) is now uniformly named after the `LR_RANK_QUALITY` flag; dropped the two now-stale "historical name / kept for lab archives" comments. No downstream consumer to update: `rank_readiness_*` appeared nowhere else in `scripts/`/`tests/`, the `types.ts` `aim?` schema never declared these fields (block ends at `enum_current_term_missing`), and the sole `compile_stats_json` reader (`analysis/reports.ts reportCompileStats`) is a generic top-level `json_each` catalog that never descends into the nested `aim` object — so the aliasing suggestion is moot (old archives keep the old key under `aim.rank_readiness_*`, new ones emit `aim.rank_quality_*`, neither is a named lab column).

### 46. `LR_AIM_PROBE_MODE='full'` and `LR_AIM_MODEL_SPACE='direct'` are permanently-off comparison arms in the hot path
*(cross-ref reachability entries #78, #79)*
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `aimProbeMode`/`aimModelSpace` 137-182; fitRows latent-strip branch 940-950.
- **Complexity smell:** Two env-selected A/B arms (full vs short; direct vs latent) — memory records full-sim LOSES (−3.9) and direct is a WASH (+0.6). They add a throw-on-incompatible-combo check, a `directOutputs` latent-strip, mode/space threading through `evaluateJointArcKnobs`, and two `AimStats` fields. CLAUDE.md's minimal-simulation rule forbids `full` ever becoming default.
- **Proposed simplification:** Retire `full` mode and `direct` space to a study harness (or delete); collapse `evaluateJointArcKnobs` call sites to the single short/latent path and remove the incompatibility throw + latent-strip branch. Coordinate with the arc_probe-side duplicates (#78/#79).
- **Risk:** medium
- **Generalization note:** Experiment scaffolding widening the production surface for no shipped behavior.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #43 baseline `simplify-43-remove-air-range-highk-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Retired the hot-path `LR_AIM_PROBE_MODE`/`LR_AIM_MODEL_SPACE` arms from `aim.ts`: deleted the env parsers, incompatible-combo throw, `directOutputs` threading, latent-strip fit branch, and `probe_mode`/`model_space` compile-stat fields in `AimStats`/`types.ts`; left lower-level `arc_probe.ts` direct/full study support intact for the later coordinated arc-probe cleanup (#126).

### 47. `ENUM_TOP_K=2` knee justified by "low-budget compiles" — a grid assumption in a global constant
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `ENUM_TOP_K` 863-867; use at 1001.
- **Complexity smell:** Emitted proposals per base fixed at 2 with rationale tied to the scarce end of the grid; at high budgets a static k=2 leaves value on the table.
- **Proposed simplification:** Derive emitted-proposal count from the same continuous budget/probe-economics signal as K bases (#41), or at minimum document it as a deliberate fixed default with one knob.
- **Risk:** medium
- **Generalization note:** k=2 vs k=3 is tied to today's low-budget checkpoints.
- **Status:** Abandoned — not a clean standalone simplification. The code already documents `k=2` as the measured emitted-proposal knee, and historical evidence says increasing it is not free (`docs/lookahead-log.md` D5: `LR_AIM_TOPK_EMIT=4` REJECT Δ−3.4; `docs/ARC_STATE_CONTROL.md` notes `enum-k3-01` regressed low-budget compiles). Adding a new emit-count env knob would widen the hot-path experiment surface rather than simplify it; any real budget/probe-economics retune belongs with the broader continuous K surface in #49. No source change was pursued.

### 48. `defaultExtraAimBaseSeed` hashes the exact compile budget frame count into the RNG
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `defaultExtraAimBaseSeed` 383-389.
- **Complexity smell:** The per-gap extra-base draw mixes `aimCompileBudgetFrames` into the hash, so 249,999 vs 250,000 frames give uncorrelated per-gap decisions — a probabilistic structural decision coupled to the exact budget integer (discontinuous across arbitrary budgets).
- **Proposed simplification:** Drop `aimCompileBudgetFrames` from the seed (seed on gap identity + spec); let budget affect it only through the continuous pressure term.
- **Risk:** medium
- **Generalization note:** Assumes discrete grid budgets; jumps at every frame count across a continuum.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #46 baseline `simplify-46-retire-aim-probe-arms-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Dropped the exact `aimCompileBudgetFrames` mix from `defaultExtraAimBaseSeed`, so the extra-base draw keys on gap identity only while budget influence remains in the continuous pressure term.

### 49. `aimTopKBasesEffective` is a five-level nested cascade producing one small integer
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `aimTopKBasesEffective` 282-311.
- **Complexity smell:** Chains maturity step → env override → high-budget step → air-range classifier → low-air cap (`min 3`) → extra-base pressure/hash gate, each with its own constants and subtle interactions, to return K∈{1,3,4,5,6}.
- **Proposed simplification:** Reformulate as one continuous `K(budget, air, slack)` surface clamped to an integer, keeping the low-air cap as an explicit `min`. Removes `AIM_LOW_AIR_TOPK_MAX/AIR_MAX`, `AIM_EXTRA_TOPK_BASES_DEFAULT` and the pressure family as distinct knobs. (Subsumes #41, #42, #43, #53.)
- **Risk:** high
- **Generalization note:** All branch boundaries are grid/spec-fit; a continuous surface behaves sanely off-grid.
- **Status:** Accepted (partial) — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #48 baseline `simplify-48-budget-independent-extra-aim-seed-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Did not introduce a speculative continuous K retune; instead deleted the now-dead default fifth-base tier (`AIM_EXTRA_TOPK_*`, `AIM_EXTRA_TOPK_BASES_DEFAULT`, `defaultExtraAimBase*`, and `setAimCompileBudgetSlack`). After accepted #43, default K is already 6 at `>=200k`, while the old fifth-base pressure was zero below 225k and explicit `LR_AIM_TOPK_BASES` disables that path, so the pressure/hash branch was unreachable.

### 50. `objectiveTargetsForGap` duplicated with `targetForGap`
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `targetForGap` 423-426; `objectiveTargetsForGap` 1144-1146.
- **Complexity smell:** Two helpers resolve per-gap targets from `ctx.gapAxisTargets ?? gap.targets` (single-axis vs whole `AxisValues`), living far apart — invites drift.
- **Proposed simplification:** Have `targetForGap` call `objectiveTargetsForGap(gap, ctx)[axis]` (or vice-versa) for one source of truth.
- **Risk:** low
- **Generalization note:** Ordinary duplication.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). `targetForGap` now delegates the `ctx.gapAxisTargets ?? gap.targets` resolution to `objectiveTargetsForGap(gap, ctx)[axis]`, then applies its finite-number null-check.

### 51. `AIM_MIN_DELTA_DEG` / `ENUM_STEP_DEG` / `ENUM_MIN_SEP_DEG` / `distinctJointKnobs` overlap in knob-distinctness logic
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `AIM_MIN_DELTA_DEG` 801; `ENUM_STEP/ROT_STEP/MIN_SEP` 867-874; sweep skip 981; `distinctJointKnobs` 1079-1083.
- **Complexity smell:** Four near-duplicate distance/spacing constants encode one notion ("minimum meaningful knob separation") at two places with two formulas (near-zero skip vs ellipse distinctness test).
- **Proposed simplification:** Define one 2-D knob-distinctness metric (pitch scale, rotate scale) reused for both the base-duplicate skip and inter-proposal separation.
- **Risk:** low
- **Generalization note:** Model-error quantities, currently expressed redundantly.
- **Status:** Accepted (Case B, documentation-only, byte-identical) — the "two formulas" are genuinely different tests, not one notion spelled twice: the near-base skip is an axis-aligned BOX around the base (0,0) with 0.25/0.25 thresholds (`AIM_MIN_DELTA_DEG`, `ENUM_ROT_STEP_DEG/2`), while `distinctJointKnobs` is an ELLIPSE (Mahalanobis) test between two arbitrary proposals with 1.5/0.5 scales (`ENUM_MIN_SEP_DEG`, `ENUM_ROT_STEP_DEG`). Different shape, reference point and scales; `AIM_MIN_DELTA_DEG(0.25)≠ENUM_MIN_SEP_DEG(1.5)` so no alias, and forcing a common formula is not byte-identical (a grid point at (0.2°,0.2°) is inside the box but outside a 0.25-radius ellipse, and grids are step-offset by `pitchSpan`/`rotateSpan` so such points are reachable). Added cross-referencing doc comments at both sites (and at the `AIM_MIN_DELTA_DEG` def) so a reader sees they are related-but-distinct; no merge. All 160 seed=0 track hashes match baseline.

### 52. `AIM_LOW_AIR_TOPK` cap constants are spec-population thresholds inside the K logic
- **Files:** `scripts/v0/optimizer/aim.ts`
- **Location:** `AIM_LOW_AIR_TOPK_MAX=3` / `AIM_LOW_AIR_TOPK_AIR_MAX=0.30` 223-224; used 297-299, 322.
- **Complexity smell:** A low-air gap (target air ≤ 0.30) caps K at 3 ("accepted top-3 behavior"); 0.30 and 3 hardcode a probing-affordability assumption that is really a function of budget.
- **Proposed simplification:** Fold the low-air discount into the continuous K surface (probing a low-air gap yields less → higher probe-cost weight) rather than a hard `air<=0.30 → min(K,3)` branch.
- **Risk:** medium
- **Generalization note:** 0.30/3 tuned to current air distribution; a spec clustering near 0.30 sees a cliff.
- **Status:** Abandoned — not a clean standalone simplification after #49. The direct deletion would remove the low-air cap, broadening mature low-air gaps from K=3 to K=4 at 100k-199k and K=6 at `>=200k`; that is a larger retune than the already-rejected guarded low-air top-4 canonical (`attempt-regular-lowair-aim-top4-after-top4at100-a01`, Δheadline -0.5, P(Δ≤0)=86.6%, source reverted; log conclusion: cadence was not enough and the accepted low-air cap of 3 remained the better default). Folding this into a continuous K surface depends on a broader K redesign that #49 explicitly did not introduce. No source change was pursued.

---

## Arc placement — `scripts/v0/arc_placement.ts`

### 53. Retired sample-mode pressures kept as ×0 dead terms threaded through the whole target_state block
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `targetStateControls` 655-656 declare `speedDragModePressure=0`, `lowAirSettlePressure=0`; multiplied into ~20 downstream terms 673-799.
- **Complexity smell:** The `speed_drag`/`low_air_settle` sample modes are retired and never generated, so both pressures are hard-wired 0. Every occurrence (`- 8 * speedDragModePressure`, `lerp(a, b, 0)`, `lerp(a, b, lowAirSettlePressure)`) is a guaranteed no-op inflating an already dense cascade. Author flagged them foldable.
- **Proposed simplification:** Delete both `=0` constants and constant-fold every term (`lerp(a,b,0)→a`, drop additive `k*pressure`). Byte-identical; roughly halves the size of the postFloor/postLength/safePostCap/contactAngleDeg expressions.
- **Risk:** low
- **Generalization note:** Pure dead-weight removal, byte-identical by construction.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Deleted both `=0` constant declarations and constant-folded all 22 no-op occurrences (`lerp(a,b,0)→a`, `x - k*p → x`, `(1±k*p) → 1` factors dropped) across `brakeLandingUncertainty`/`contactJitter`/`preclearPressure`/`speedControlPressure`/`contactAngleDeg`/`preAngleDeg`/`postAngleMin`/`postAngleDeg`/`preLength`/`sampledPost`/`safePostCap`/`postFloor`/`postLength`; `postAngleMin` folds to the constant `-26` and the now-dead `supportPostFloor` local was removed.

### 54. `contactCenteredNormalEnabled()` is a constant `return true` gating a dead A/B branch
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `contactCenteredNormalEnabled` 317-319; call sites 483, 521.
- **Complexity smell:** Unconditionally returns true (the A/B was won and frozen); reads like a live switch but the `else` (target_state generator for normal mode) is unreachable for `mode==='normal'`.
- **Proposed simplification:** Inline `true`, delete the function, simplify call sites to `if (mode === 'normal')`, remove the dead normal-mode target_state fallthrough.
- **Risk:** low
- **Generalization note:** Removes a permanently-true toggle.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Simplified both call sites `mode === "normal" && contactCenteredNormalEnabled()` → `mode === "normal"` and deleted the function. NOTE: the target_state fallthrough (`sampleTargetStateLines` / `GEOMETRY_RNG_DRAWS`) was NOT removed — it is live for the `brake`/`startup_catch` sample modes (via `sampleOneCandidate`); it is dead only for `mode === "normal"`, which the `if` already excludes.

### 55. Impact bevel / lip machinery is permanently neutralized (shift hard-coded to 0)
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `impactLipShiftDeg=0` 1212, `impactBevelShiftDeg=0` 1232; `buildImpactBevelLines` 1814-1832 (guard returns `[]`); `CONTACT_CENTERED_IMPACT_BEVEL_*` 86-88; `firstPostAngleDeg` 1239; `entryBevelAngleDeg` lip term 1221-1224.
- **Complexity smell:** Both shifts are 0 (redir-metric migration), so `buildImpactBevelLines` always returns `[]`, `firstPostAngleDeg = contactAngleDeg - 0`, and `impactLipShiftDeg * SHIFT_MULT` is always 0; the empty array still threads through preLines/scoop/postLines index math.
- **Proposed simplification:** Delete `impactLipShiftDeg`/`impactBevelShiftDeg`, `buildImpactBevelLines`, the three BEVEL constants, and the splices; fold `firstPostAngleDeg → contactAngleDeg`. Keep only `entryRedirShiftDeg`. Byte-identical.
- **Risk:** low
- **Generalization note:** Dead code from a completed metric migration.
- **Status:** Accepted — byte-identical (all 160 seed=0 checkpoint track_hashes match the baseline across all four budgets; focused vitest suite 80/80 pass). Confirmed via fresh grep that both `impactLipShiftDeg` and `impactBevelShiftDeg` are unconditionally 0 with no other assignment, `buildImpactBevelLines`'s `lipShiftDeg <= 1e-6` guard always returns `[]`, and `impactBevelLines.length === 0` in every index-math / spread site. Deleted `impactLipShiftDeg`/`impactBevelShiftDeg`, `buildImpactBevelLines`, and all three `CONTACT_CENTERED_IMPACT_BEVEL_*`/`_ENTRY_BEVEL_*` constants; removed the always-empty splices; folded `entryBevelAngleDeg` to drop the 0-valued lip term (kept live `entryRedirShiftDeg`) and `firstPostAngleDeg → contactAngleDeg`.

### 56. Three near-duplicate redir angle-shift helpers the log calls marginal (±2)
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `contactCenteredRedirContactAngleShiftDeg` 1406-1441; `contactCenteredRedirEntryAngleShiftDeg` 1443-1490; `impactPostTurnExtraDeg` 1553-1585.
- **Complexity smell:** All three share the identical skeleton (IMPACT_GEOM_OFF guard, mature smoothstep, speedPressure, capped-target, targetPressure, `predictedRedirImpactAtAngleDelta`, `neededTurnDegForImpact`, clamp × gate product × `ccSpanBlends(attempt).launch`), differing only in which gate and MAX_DEG/START constant. Header comments note these are worth only ±2 headline vs the +53 curvature carrier.
- **Proposed simplification:** Extract one `redirMissingTurnDeg(targetState, targetImpact, refAngleDeg, {maxDeg, gates})` returning `clamp(rawMissingDelta,0,maxDeg) × product(gates) × span`; the three call sites pass their distinct gate set + cap. A follow-up could collapse contact+entry into one. Removes ~120 lines.
- **Risk:** medium
- **Generalization note:** Budget gates are absolute frames (see #57); the shared helper is the place to make them budget-fraction-relative.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #49 baseline `simplify-49-retire-dead-extra-aim-topk-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Extracted shared `redirMissingTurnDeg(...)` for the ceiling-clamped target pressure plus missing-turn calculation used by contact-shift, entry-shift, and post-turn; kept each caller's distinct maturity/speed/dense/curve gates, sign, and clamp placement intact. Focused optimizer/arc Vitest suite passed (6 files, 77 tests).

### 57. Pervasive hard-coded absolute-frame budget breakpoints assume the 125k-500k grid
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `CONTACT_CENTERED_REDIR_CONTACT_BUDGET_START/SPAN` 99-100, `REDIR_ENTRY` 104-105, `IMPACT_CURVE_ELEVATION_ROOM` 123-124, `IMPACT_POST_TURN` 148-149, `IMPACT_TEMPLATE_*` 182-190, `POST_CURVE_FADE` 224-225, `ARC_LEN_ROOM_SMOOTH` 267-268; consumers 1310, 1317, 1516, 1141, 1191.
- **Complexity smell:** ≥12 `smoothstep((budget - START)/SPAN)` gates use absolute 50k/100k/125k anchors. Below the grid every mature gate reads 0 (impact templates/post-turn/redir shifts silently disabled); above, every fade saturates — meaningless outside the tuned band.
- **Proposed simplification:** Introduce one `budgetMaturity(startFrac, spanFrac)` helper (map budget to [0,1] via a single reference scale, or express starts/spans as fractions of the compile's own budget) and route all smoothsteps through it.
- **Risk:** high
- **Generalization note:** Directly assumes the grid; the exact scalability target.
- **Status:** Accepted (partial) — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #56 baseline `simplify-56-share-redir-missing-turn-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Added `compileBudgetPressure(...)`/`compileBudgetFade(...)` and routed the existing absolute-frame gates through them, including the previously inline impact-arrival 50k fade; did not retune starts/spans to budget fractions. Focused optimizer/arc Vitest suite passed (6 files, 77 tests).

### 58. Spec-population aggregate (mean impact) gates scoop geometry
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `currentImpactTemplateSpecMeanImpact` + `setImpactTemplateSpecMeanImpact` 286-291; `IMPACT_TEMPLATE_SCOOP_MIN_SPEC_MEAN_IMPACT=0.55` 184; `impactTemplateScoopFrames` 1317-1329.
- **Complexity smell:** Scoop frame count branches on whether the *whole spec's* mean authored impact clears 0.55, making one arc's geometry depend on a global track statistic (0.55 mirrors the redir target-start threshold).
- **Proposed simplification:** Drive scoop frame count from the local gap's own impact/speed target (or a single formula), removing the whole-spec-mean plumbing and 0.55. If the mean is needed, express as a smooth per-gap pressure.
- **Risk:** medium
- **Generalization note:** Assumes the current spec population's impact distribution; a different mean flips the scoop regime for every gap.
- **Status:** Rejected — Δheadline +0.6, P(Δ≤-0.1)=24.8%, candidate cumulative Δheadline vs campaign-start baseline +3.3 (accepted cumulative remains +2.8; full canonical vs current #57 baseline `simplify-57-centralize-budget-pressure-a01`; valid 1920/1920, fingerprint unchanged; 936/1920 `track_hash` match, 984 changed). Tested replacing the whole-spec mean global with a local `targets.impact` scoop gate at the existing redir-contact 0.55 onset and deleting the setter/helper plumbing; non-inferiority was not established, with the 125k budget regressing Δ=-1.1, so the source change was reverted.

### 59. Four externally-set per-compile "profile pressure" globals form a reverse-fit knob layer
- **Files:** `scripts/v0/arc_placement.ts` (set from `optimizer/handoff.ts` ~814)
- **Location:** `setImpactCurveElevationRoomPressure` 293-298, `setImpactCurveHighSpeedReliefPressure` 300-305, `setImpactTemplateHoldProfilePressure` 307-312; consumed in `impactCurveTargetStart` 1514-1528, `impactTemplateHoldPressure` 1331-1360.
- **Complexity smell:** Module-level mutable pressures injected per compile and multiplied with budget/target/room smoothsteps (`elevationRoomPressure*(1-highSpeedRelief*localRelief)*maturePressure`) — opaque action-at-a-distance layered on existing gates. (These are set by the detectors in handoff #31.)
- **Proposed simplification:** Fold the profile pressures into a single named parameter or derive locally from targets; collapse `impactCurveTargetStart` to one continuous onset formula. Verify each is non-default in the canonical set; delete any that is ~always 0/1.
- **Risk:** high
- **Generalization note:** Per-compile values from handoff heuristics tuned to the current set; default 0 gives unset compiles a different onset.
- **Status:** Accepted (partial) — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #57 baseline `simplify-57-centralize-budget-pressure-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match). Verified the three profile pressures are live on canonical spec-seeds (`elevationRoom` nonzero 180/480, `highSpeedRelief` 120/480, `templateHold` 48/480), so none were deleted; bundled them into one `ImpactProfilePressures` object and `setImpactProfilePressures(...)` call while leaving formulas unchanged. Focused optimizer/arc Vitest suite passed (6 files, 77 tests).

### 60. Duplicated speed/dense/deadline pressure derivation in two functions
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `sampleContactCenteredLines` 916-936; `guideContactCenteredRolls` 1606-1618.
- **Complexity smell:** Both recompute the same block (`gapFrames`, `nextGapFrames`, `denseContactPressure=clamp((20-nextGap)/12)`, `deadlinePressure=clamp((18-gap)/10)`, absolute/brake/accel/carry speed pressures) with the same magic constants.
- **Proposed simplification:** Extract `contactCenteredPressures(targetState, targets, gap, allContactFrames)` returning the bundle, called from both sites. One source of truth for 20/12, 18/10, `CC_PRESSURE_*`.
- **Risk:** low
- **Generalization note:** Consolidation reduces drift risk.
- **Status:** Accepted — byte-identical (160/160 track hashes match seed=0 probe vs `attempt-aim-highk-gated-j32-a01` across all 4 budgets). Extracted `contactCenteredPressures(targetState, targets, gap, allContactFrames)` returning the 10 shared derivations (`targetSpeedPx`, `air`, `nextGapFrames`, `gapFrames`, `denseContactPressure`, `deadlinePressure`, `absoluteSpeedPressure`, `brakePressure`, `accelPressure`, `speedCarryPressure`) and called it from both `sampleContactCenteredLines` and `guideContactCenteredRolls`. The site-specific tail terms were left in place (not part of the identical block): `sustainedContactCarryPressure`+`clearancePressure` in the sampler, `scarcity` in the guide.

### 61. Three near-identical "blend toward symmetric pop-arc" launch blocks
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** amplitude block 1113-1126, impact-arrival block 1137-1156, energy/elevation blocks 1037-1070 (in `sampleContactCenteredLines`).
- **Complexity smell:** The amplitude and impact-arrival blocks are the same computation (`vyArc=-0.5*g*nextGapFrames`, `vxArc=max(1,vx)`, `arcLaunchDeg=atan2`, `postAngleDeg=lerp(...,arcLaunchDeg,blend)` clamped, then shorten toward 28), differing only in the blend pressure and shorten factor (1.0 vs 0.6). The comment even says "Same formula as the amplitude arc."
- **Proposed simplification:** Extract `blendPostTowardPopArc(postAngleDeg, postLength, nextGapFrames, vx, blend, shortenFactor)` and call from both; reuse the atan2/clamp for elevation.
- **Risk:** low
- **Generalization note:** The pop-arc formula is gap-relative already.
- **Status:** Accepted — byte-identical (all 160 seed=0 checkpoint track_hashes match baseline). Extracted `blendPostTowardPopArc(postAngleDeg, postLength, nextGapFrames, vx, blend, shortenFactor)` and called it from the confirmed-identical amplitude (shortenFactor 1.0) and impact-arrival (0.6) blocks. Left the energy and elevation blocks alone: they compute a DIFFERENT launch vy (energy-drop / `elevationToLaunchVy`, not the pop-arc `−½·g·N`) and vx (velocity.x / `sqrt(speed²−vy²)`), energy has no clamp and elevation does no ride-out shortening, so only the trivial `atan2·180/π` token is shared — an idiom used at 6 sites file-wide, not worth a helper here.

### 62. Elevation ride-out shortening coupled to amplitude block by a shared magic 0.30
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** elevation shorten gate 1098-1103 (`targets.amplitude < 0.30`); amplitude pressure 1115 (`smoothstep((amp-0.30)/0.45)`).
- **Complexity smell:** The elevation-shorten block is disabled when `amplitude>=0.30`, hand-matched to the amplitude block's onset, coupling the two by a duplicated literal (hard cut, not continuous handoff).
- **Proposed simplification:** Replace the binary gate with `(1 - amplitudePressure)` (reusing the amplitude block's own smoothstep) applied to the elevation-shorten blend; hoist 0.30 into a named onset constant referenced by both.
- **Risk:** medium
- **Generalization note:** The hard 0.30 cut is brittle across specs mixing elevation+amplitude differently.
- **Status:** Rejected — Δheadline -0.0, P(Δ≤-0.1)=39.4%, candidate cumulative Δheadline vs campaign-start baseline +2.7 (accepted cumulative remains +2.8; full canonical vs current #59 baseline `simplify-59-bundle-impact-profile-pressures-a01`; valid 1920/1920, fingerprint unchanged; 1517/1920 `track_hash` match, 403 changed). Tested replacing the binary `amplitude < 0.30` elevation-shortening gate with the amplitude block's own smoothstep fade and hoisting the 0.30/0.45 pressure constants; non-inferiority was not established, so the source change was reverted.

### 63. `LR_CC_EXPLORE` tail-widening machinery is inert at default (study-only)
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `widenContactCenteredTailRolls` 1680-1696, `widenRoll` 1698-1700, `contactCenteredExploreTail` 1702-1707, `contactCenteredExploreFactor`/`readContactCenteredExploreFactor` 1709-1720; constants `EXPLORE_TAIL_*` 76-78; global 79.
- **Complexity smell:** No-op unless `LR_CC_EXPLORE` is set (default returns 1 → rolls unchanged); adds a mutable module global re-read per compile plus 6 constants for a feature that never fires in production.
- **Proposed simplification:** Delete the env knob and widen path (keep in `study_cc_explore.ts` if wanted). Byte-identical with the flag unset.
- **Risk:** low
- **Generalization note:** Pure study scaffolding removal.
- **Status:** Accepted — byte-identical (all 160 seed=0 `track_hash` match `attempt-aim-highk-gated-j32-a01`; focused tests 116/116). At the default the factor-reader returned 1, so `widenContactCenteredTailRolls` returned rolls untouched. Deleted the `LR_CC_EXPLORE` env knob, the mutable global + its per-compile re-read in `resetArcPlacementStats`, the three `CONTACT_CENTERED_EXPLORE_*` constants, and the five widen-path functions (`widenContactCenteredTailRolls`, `widenRoll`, `contactCenteredExploreTail`, `contactCenteredExploreFactor`, `readContactCenteredExploreFactor`); the call site now uses the guided rolls directly. `study_cc_explore.ts` and its companion `analyze_cc_explore.ts` only ever set the env var + ran the normal compiler to characterize this feature (they never imported the machinery), so both were deleted; the `LR_QUALITY_NCAND` axis they also swept stays live via `study_budget_spend.ts`.

### 64. `sampleTargetStateArc` / `sampleArcParams` Arc-emitting path exists only for reachability probes
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `sampleArcParams` 502-513, `sampleTargetStateArc` 580-610, `arcLocalPointAt` 1909-1935; sole consumer `optimizer/reachability.ts:238`.
- **Complexity smell:** The active compiler emits line fragments; this Arc path is a compatibility shim for reachability probes carrying its own curveBias/length/segments math and an arc-sampling function used nowhere else, duplicating `sampleTargetStateLines` geometry in Arc form.
- **Proposed simplification:** If the reachability probe (itself dead — #65) can consume line fragments, delete `sampleArcParams`/`sampleTargetStateArc`/`arcLocalPointAt`. Otherwise mark probe-only and share the controls computation.
- **Risk:** medium
- **Generalization note:** Legacy Arc form diverges from the one-generator "lines" source of truth. Consider bundling with #65.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #59 baseline `simplify-59-bundle-impact-profile-pressures-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match; focused tests 76/76). Deleted the legacy Arc-emitting placement shim (`sampleArcParams`, `sampleTargetStateArc`, `arcLocalPointAt`) and made `ArcPlacementGeometry` line-only; `sampleArcParamsRngDraws` stays because cache replay still uses it. The relocated reachability probe now consumes the line-native sampler via `sampleArcPlacementGeometry`/`tryCandidateGeometry`, and the obsolete Arc-compatibility unit test was removed.

### 65. `impactTemplateVerticalCompatible` uses XOR-of-presence plus a sparse-gap frame threshold
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `impactTemplateVerticalCompatible` 1391-1404; `IMPACT_TEMPLATE_AMP_ONLY_SPARSE_NEXT_GAP_FRAMES=round(FPS*1.25)` 188.
- **Complexity smell:** Returns `hasAmplitude === hasElevation` (allow when both or neither) except an amplitude-only branch requiring `gapFrames` and `nextGapFrames >= FPS*1.25` — a reverse-fit carve-out that silently forbids the slam-hop on any elevation-only impact beat.
- **Proposed simplification:** Replace with an explicit documented predicate (allow the slam-hop when vertical asks don't conflict, via a continuous room/compatibility check), dropping the `===` cleverness and FPS*1.25 in favor of a named minimum-gap-for-hop constant.
- **Risk:** medium
- **Generalization note:** FPS*1.25 assumes current cadence density.
- **Status:** Accepted (partial) — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +2.8 (full canonical vs current #64 baseline `simplify-64-delete-arc-placement-compat-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match; focused tests 76/76). Replaced the opaque `hasAmplitude === hasElevation` return with explicit no-vertical / both-vertical / amplitude-only / elevation-only cases and renamed the sparse-hop threshold to `IMPACT_TEMPLATE_HOP_MIN_ROOM_FRAMES` behind `impactTemplateHasHopRoom(...)`, preserving eligibility exactly. The broader continuous-room/elevation-only retune was not attempted in this low-risk structural pass.

### 66. Slam-hop template lane is a multi-gate cascade (probabilistic + modular + threshold)
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** template lane guard 1247-1255 and body 1256-1301; `impactTemplateBudgetPressure` 1310-1315; constants `IMPACT_TEMPLATE_LANE_MOD/MIN_ATTEMPT/MIN_PRESSURE/TURN_SPAN_SALT/BUDGET_SALT` 172-178.
- **Complexity smell:** Firing depends on the conjunction of `lowDiscrepancyRoll(attempt,BUDGET_SALT) < smoothstep(budget)`, `impactTemplateVerticalCompatible`, `impactCurveP>=0.35`, `attempt>=8`, `((attempt%MOD)+MOD)%MOD === MOD-1` (every 3rd attempt), `targets.impact!==undefined`, then `nextGapFrames>4` and `effectiveTurnDeg>0`. Two independent hash draws + modular phase selector; easy to make silently never-fire off-grid.
- **Proposed simplification:** Collapse to one continuous per-attempt eligibility score (budget maturity × pressure × room) vs a single deterministic low-discrepancy draw; drop the `%MOD` phase gate and the second BUDGET_SALT draw.
- **Risk:** high
- **Generalization note:** `attempt>=8` and `%3` assume the current per-gap attempt-batch size; a smaller batch (low budget) never reaches the firing phase.
- **Status:** Accepted — Δheadline +1.3, P(Δ≤-0.1)=14.9%, cumulative Δheadline vs campaign-start baseline +4.1 (full canonical vs current #65 baseline `simplify-65-explicit-impact-template-vertical-compat-a01`; valid 1920/1920, fingerprint unchanged; 488/1920 `track_hash` match, 1432 changed; focused tests 76/76). Replaced the every-3rd-attempt `%MOD` phase gate plus second budget hash draw with one continuous `impactTemplateLaneEligibility(...)` score (budget × pressure × attempt × room) against a single low-discrepancy roll, and fixed the slam-hop scale to the accepted central value.

### 67. Deep post-length cascade in `targetStateControls` stacks six interdependent floors/caps
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** post-length section 752-799 (`sampledPost`, `targetGroundFrames`, `targetPost`, `safePostCap`, `basePostFloor`, `postFloor`, `supportPostFloor`, `postLength`).
- **Complexity smell:** Post-length is computed through six chained quantities, several nested lerps, and multiple `Math.min` against `safePostCap`, with the retired ×0 modes (#53) still woven in — a dense stack of overlapping clamps hard to verify.
- **Proposed simplification:** After the ×0 fold (#53), restructure into one target length, one safe cap, one floor, then a single final clamp (hoist the `min(., safePostCap)` to one place). Name the 0.72/0.88/0.34/0.26 weights.
- **Risk:** medium
- **Generalization note:** Many raw literals resist reasoning at new cadences.
- **Status:** Accepted — Δheadline +0.0, P(Δ≤-0.1)=0.0%, cumulative Δheadline vs campaign-start baseline +4.1 (full canonical vs current #66 baseline `simplify-66-continuous-template-lane-admission-a01`; valid 1920/1920, fingerprint unchanged; 1920/1920 `track_hash` match; focused tests 76/76). Extracted the target-state post-length ladder into `targetStatePostLength(...)`/`targetStateSafePostCap(...)`, named the target blend, ground-room, sampled-post, safe-cap, and floor constants, and kept the cap-before-lerp semantics byte-identical.

### 68. `needsDenseSpacingPostLengthCap` magic thresholds parallel the arcLenRoom cap
- **Files:** `scripts/v0/arc_placement.ts`
- **Location:** `needsDenseSpacingPostLengthCap` 1737-1744 (`GRAIN_MIN=0.50`, `MAX_NEXT_CONTACT_FRAMES=14`); consumer `spacingPostLengthCap` 985-988; overlaps `arcLenRoom` room-gating 989-1013.
- **Complexity smell:** A binary gate (`grain>=0.50 AND nextGapFrames<=14`) toggles a separate post-length cap that overlaps in intent with the arcLenRoom room ramp a few lines below; two mechanisms throttle post length by next-contact proximity with independent hard thresholds.
- **Proposed simplification:** Unify the dense-spacing cap with the arcLenRoom room ramp into one continuous room-based cap, eliminating the binary grain/14-frame gate.
- **Risk:** medium
- **Generalization note:** 14-frame / grain-0.50 cutoffs assume current beat spacing/grain.
- **Status:** Accepted — Δheadline +0.2, P(Δ≤-0.1)=1.6%, cumulative Δheadline vs campaign-start baseline +4.2 (full canonical vs current #67 baseline `simplify-67-target-state-post-length-helper-a01`; valid 1920/1920, fingerprint unchanged; 1868/1920 `track_hash` match, 52 changed; focused tests 76/76). Deleted the binary `needsDenseSpacingPostLengthCap(...)` grain/14-frame gate and replaced it with continuous `denseSpacingPostLengthCap(...)` pressure (`denseContactPressure × (1 - arcLenRoom)`) blended from the neutral cap to the old dense cap formula.

---

## Objective & readiness — `scripts/v0/optimizer/{objective,readiness}.ts`

### 69. Study-only catchability telemetry (~110 lines) embedded in the production readiness module
- **Files:** `scripts/v0/optimizer/readiness.ts`
- **Location:** 53-163: `CatchabilityTelemetry*` types, module-level mutable state 85-96, `setCatchabilityTelemetryEnabled`/`reset`/`snapshot`/`record`; call site in `readinessCatch` 181/190.
- **Complexity smell:** More than half of `readiness.ts` is histogram telemetry (gated `LR_CATCHABILITY_TELEMETRY=1`, default off) with 9 module-level mutable variables, a module-load env read, and a recorder threaded into the hot `readinessCatch` path — pure instrumentation in a core model file.
- **Proposed simplification:** Extract into a study-only module that wraps/subscribes to `readinessCatch`; leave `readiness.ts` as table + locate + `readinessCatch` + `readinessCatchState` (~90 lines, no mutable state). Delete if the histogram study is defunct.
- **Risk:** low
- **Generalization note:** Dead in production by construction; removal cannot move the headline.
- **Status:** Accepted — byte-identical, fingerprint unchanged (de24a421f751). Extracted the histogram telemetry (types, 9 module-level mutable vars, module-load env read, `setCatchabilityTelemetryEnabled`/`reset`/`snapshot`/`record`) into a new study-only module `scripts/v0/study_catchability_telemetry.ts`, which subscribes to `readinessCatch` via a new 3-line `setCatchabilityObserver` hook; `readiness.ts` is now just table + `locate` + `readinessCatch` + `readinessCatchState` (~105 lines, no telemetry state). The recorder was a proven no-op in production (`record()` early-returns on the default-off flag, and `readinessCatch` computes/returns the clamped value before the observer fires), so the observer stays null in production and the hot path is untouched. Sole consumer `study_catchability_histogram.ts` re-pointed to the new module. Verified via 1-seed/40-spec/4-budget track_hash diff: 160/160 match.

### 70. Hard-coded catchability `RATE_GRID` fitted to one budget (300k) and 12 tracks
- **Files:** `scripts/v0/optimizer/readiness.ts`
- **Location:** 38-51 (`ANGLE_KNOTS`, `SPEED_KNOTS`, `RATE_GRID`) + header docstring 1-32.
- **Complexity smell:** The readiness surface is a frozen 10×7 table of 70 magic numbers fit from 2,871 arrivals across 12 tracks at 300k, shrunk toward a baked mean 0.794. Speed axis spans only 6-12 px/f; opaque and un-reasoned; edge-clamps for higher-speed arrivals.
- **Proposed simplification:** Replace with a small monotone analytic surface (speed-sigmoid × angle-Gaussian near the observed optimum, 3-4 named params) fit to the same ground truth; keep the same `(speed, comAngle)→[0,1]`. Extrapolates sanely past 12 px/f.
- **Risk:** high
- **Generalization note:** Strongly assumes today's specs + 300k; **note this feeds the scored objective — verify the ruler fingerprint / headline output is preserved or treat as out-of-scope.**
- **Status:** Rejected — focused tests failed before canonical; replacing the 10×7 table with the six-param speed-sigmoid × angle-Gaussian fit (`base=0.075`, `range=0.886`, speed mid/scale `8.235/0.579`, angle center/sigma `20.716/18.144`) broke the objective-leaf cost invariant (`tests/optimizer_handoff.test.ts:657`: `fwd_eval_frames_charged` 32854 vs required `<30041.4`). A more table-shaped analytic needed many extra parameters and fit the R0 rows worse than production, so no compact low-risk replacement was kept. Source reverted; no canonical run; accepted cumulative Δheadline vs campaign-start baseline remains +4.2.

### 71. Magic asymmetric-penalty constants in `speedFitFactor`
- **Files:** `scripts/v0/optimizer/objective.ts`
- **Location:** `speedFitFactor` 164-177; `OBJECTIVE_SPEED_SCALE_PXF` 21.
- **Complexity smell:** The too-fast half-penalty 0.5 and exp scale `OBJECTIVE_SPEED_SCALE_PXF=0.75` (which equals the readiness kernel's σ_speed only by undocumented coincidence) are unmotivated; asymmetry justified only by a prose comment.
- **Proposed simplification:** Name the half-penalty as one `ASYMMETRY` constant, tie `OBJECTIVE_SPEED_SCALE_PXF` to a stated tolerance, or collapse to symmetric `exp(-|d|/scale)` if the asymmetry isn't carrying score.
- **Risk:** medium
- **Generalization note:** Fixed 0.75 px/f tolerance silently assumes today's ~6-12 px/f regime. (Objective feeds scoring — verify fingerprint impact.)
- **Status:** Accepted — byte-identical, fingerprint unchanged (de24a421f751); focused tests 76/76; 1-seed/40-spec/4-budget `track_hash` diff 160/160 match vs current #68 baseline `simplify-68-continuous-dense-spacing-post-cap-a01`. Kept the historically accepted asymmetric speed-fit shape (symmetric was already rejected in lookahead H6 / the 2026-06-24 new-grid probe), named the fast-side weight as `OBJECTIVE_SPEED_OVERSHOOT_PENALTY_WEIGHT = 0.5`, and documented `OBJECTIVE_SPEED_SCALE_PXF = 0.75` as the next-gap mean-flight speed e-fold tolerance. No full canonical needed; accepted cumulative Δheadline vs campaign-start baseline remains +4.2.

### 72. `OBJECTIVE_IMPACT_MIN_ASK=0.3` no-constraint gate is a documented reverse-fit lever
*(cross-ref handoff entry #29)*
- **Files:** `scripts/v0/optimizer/objective.ts`
- **Location:** `impactFeasibilityFactor` 179-192; `OBJECTIVE_IMPACT_MIN_ASK` 22.
- **Complexity smell:** Impact asks below 0.3 return 1 (no constraint) — a hard discontinuity flagged in the maintainer's memory as a re-tune lever; a 0.29 ask is free, 0.31 fully gated.
- **Proposed simplification:** Remove the discrete gate (impactFeasibility already returns ~1 for tiny asks) or replace with a smoothstep ramp between ~0.2 and ~0.4.
- **Risk:** medium
- **Generalization note:** Cliff tuned against the current beat-authoring distribution. (Objective feeds scoring — verify fingerprint impact.)
- **Status:** Accepted — Δheadline +0.7, P(Δ≤-0.1)=17.5%, cumulative Δheadline vs campaign-start baseline +5.0 (full canonical vs current #68 baseline `simplify-68-continuous-dense-spacing-post-cap-a01`; valid 1920/1920, fingerprint unchanged; 1171/1920 `track_hash` match, 749 changed; focused tests 77/77). Replaced the hard `OBJECTIVE_IMPACT_MIN_ASK=0.3` no-constraint cliff with `impactAskPressure(...)`, a smooth 0.2→0.4 ask ramp that blends no-constraint readiness into full feasibility, and moved the telemetry-only handoff impact-targeted split to the ramp midpoint.

### 73. `OBJECTIVE_READINESS_MIN=0.1` catchability floor is an unexplained clamp
- **Files:** `scripts/v0/optimizer/objective.ts`
- **Location:** `scoreNextTargetReadiness` 66; constant 20.
- **Complexity smell:** Catchability floored at 0.1 with no rationale, guaranteeing every candidate a minimum readiness; interacts multiplicatively with two other factors; whether 0.1 vs 0.05/0 matters is undocumented.
- **Proposed simplification:** Document as an explicit anti-starvation term with a derived value, or drop it and rely on `readinessCatch`'s own edge-clamped minimum. Test whether removing it changes anything.
- **Risk:** medium
- **Generalization note:** Hard-codes a policy (never fully reject an arrival) that should be named/justified. (Objective feeds scoring — verify fingerprint impact.)
- **Status:** Not Started

### 74. Proliferation of thin gap-vs-targets wrapper pairs
- **Files:** `scripts/v0/optimizer/objective.ts`
- **Location:** `scoreCurrentGapQuality`/`scoreCurrentTargetQuality` 44-50; `scoreNextGapReadiness`/`scoreNextTargetReadiness` 52-75; `scoreGapObjective`/`scoreGapObjectiveForTargets` 77-105; `arrivalStateFromFit`/`predictArrivalAtNextContact` 123-162; `frontierReadinessFromFit` 130-136.
- **Complexity smell:** Nearly every scoring function exists as a Gap-taking wrapper that only calls `aimTargets(gap)` then delegates to a Targets-taking twin — four wrapper/twin pairs plus a one-line pass-through, 10 exported functions for 3-4 operations.
- **Proposed simplification:** Have callers call `aimTargets` at the boundary and keep only the `*ForTargets` forms (or make Gap forms default parameters); inline `arrivalStateFromFit`. Cuts ~5 exports.
- **Risk:** low
- **Generalization note:** Internal API surface reduction.
- **Status:** Accepted — byte-identical, fingerprint unchanged (de24a421f751); 1-seed/40-spec/4-budget track_hash diff 160/160 match. Cut 4 exports: deleted the thin Gap→Targets wrappers `scoreCurrentGapQuality`, `scoreNextGapReadiness`, `scoreGapObjective`, and inlined the trivial pass-through `arrivalStateFromFit` into its sole caller `frontierReadinessFromFit`. External callers now call `aimTargets(gap)` at the boundary and use the Targets forms directly (`aim.ts` 2 sites + new `aimTargets` import; `study_joint_enum.ts` 1 site + import; `tests/objective_quality.test.ts` 5 sites + imports). Kept `frontierReadinessFromFit` (genuine composition, not a pure Gap→Targets wrapper — updated internally) and all twins (`scoreCurrentTargetQuality`, `scoreNextTargetReadiness`, `scoreGapObjectiveForTargets`, `predictArrivalAtNextContact`).

### 75. Duplicated finite/null arrival-state validation across objective & readiness
- **Files:** `scripts/v0/optimizer/objective.ts`, `scripts/v0/optimizer/readiness.ts`
- **Location:** objective guard 63-65; `readinessCatchState` null guard 201-203; `readinessCatch` finite guard 180-183.
- **Complexity smell:** The same "is this arrival state usable" check is implemented three times with different failure encodings (null / 0 / 0+telemetry), inviting drift.
- **Proposed simplification:** Introduce one `isValidArrivalState(state)` predicate used by all three, with a single documented convention for the unusable case.
- **Risk:** low
- **Generalization note:** Correctness-consolidation only. (Touches scoring path — verify unchanged.)
- **Status:** Accepted — byte-identical, fingerprint unchanged (de24a421f751). Extracted `isValidArrivalState(speed, comAngleDeg)` (`Number.isFinite(speed) && Number.isFinite(comAngleDeg)`) in `readiness.ts` and used it at the two sites whose CONDITION is genuinely identical: objective.ts `scoreNextTargetReadiness` (its explicit `comAngleDeg === null` term was redundant — null is already non-finite — so its guard was logically the same finite check; keeps `return null`) and `readinessCatch` (keeps `observer(0)+return 0`). Left `readinessCatchState` alone: its `comAngleDeg === null` guard is a narrower type-narrowing check that delegates the finite test to `readinessCatch`, so folding it in would have dropped the observer side-effect on the NaN-speed path. All 160 seed=0 track hashes identical.

### 76. `impactFeasibility` re-derives the catchability turn cap independently of the readiness table
- **Files:** `scripts/v0/optimizer/objective.ts`
- **Location:** `impactFeasibility` 205-215.
- **Complexity smell:** Deliverable turn is clamped to `asin(IMPACT.CATCHABLE_REDIR_FRACTION)`, a separate ceiling from the `RATE_GRID` catchability surface — two unreconciled notions of "what turn a catch can absorb" that can disagree.
- **Proposed simplification:** Unify the impact turn cap and catchability angle range as one shared "catchable heading-change" quantity so a physics change updates both coherently.
- **Risk:** medium
- **Generalization note:** Independence is a hidden consistency hazard as either is re-tuned. (Scoring path — verify.)
- **Status:** Not Started

---

## Candidate / local cost — `scripts/v0/core/candidate.ts`

### 77. Two near-duplicate window detectors (buffer vs raw)
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `detectCandidateWindowBuffer` 412-528; `detectCandidateWindowRaw` 530-626.
- **Complexity smell:** ~100 lines each, structurally identical state machine (stall/eject/leftWorld/landing-persistence, terminus, output shape), differing ONLY in the per-frame accessor (typed-array offsets vs frame objects). Every constant/branch copy-pasted; any rule change must be made twice.
- **Proposed simplification:** Extract one generic detector parameterized by a small frame-accessor interface; the buffer/raw paths become two ~15-line adapters over the same loop.
- **Risk:** medium
- **Generalization note:** On the hot detection path — byte-identical output must be verified.
- **Status:** Not Started

### 78. Triple-aliased single-bit mode flag (RANK_QUALITY_MODE / RANK_PREDICT_ARRIVAL / RELEASE_EXIT_READ)
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `RANK_QUALITY_MODE` 70-76, `RANK_PREDICT_ARRIVAL` 86, `RELEASE_EXIT_READ` 102.
- **Complexity smell:** Three constants that collapse to the same boolean (`RANK_PREDICT_ARRIVAL = RANK_QUALITY_MODE !== 'off'`, `RELEASE_EXIT_READ = RANK_PREDICT_ARRIVAL`); the 'off' path is a study-only escape hatch never set in production, but downstream gating on three names creates the illusion of independent switches.
- **Proposed simplification:** Collapse to one `POOL_MODE = (env.LR_RANK_QUALITY !== 'off')` referenced everywhere; one comment for the escape hatch. Later, consider making pool-mode unconditional and deleting the catch+8-only branches.
- **Risk:** low
- **Generalization note:** Pure de-aliasing.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Verified the chain really collapses to one bit (`RANK_QUALITY_MODE` is only ever `"off"|"pool"`, checked solely via `!== "off"`; `RANK_PREDICT_ARRIVAL` was imported into `optimizer/aim.ts` but unused there; `RELEASE_EXIT_READ` module-local, one call site; `RankQualityMode` type imported nowhere). Collapsed all three (+ the `RankQualityMode` type) to one exported `POOL_MODE = (env.LR_RANK_QUALITY !== "off")` with one comment documenting the `off` study-only escape hatch; repointed the two candidate.ts capture gates, the exit-read gate, and `aim.ts` `rankQualityEnabled()`. Did NOT implement the "make pool-mode unconditional / delete catch+8-only branches" follow-on (separate, non-byte-identical).

### 79. Study-only landing-window probe apparatus embedded in the hot-path module
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `LANDING_PROBE_MAX_W/RECORD_CAP` 200-201, probe types/WeakMap/enable/disable/drain/`probeArcAngles`/`probeSurvivalFailure`/`probeLandingWindow` 200-363; call sites in `evaluateGapFit` ~1003, 1010-1012, 1058.
- **Complexity smell:** ~170 lines of diagnostic scaffolding disabled in all production runs (`landingProbeRecords===null`), threading null-checks and an eligibility flag through `evaluateGapFit`/`evaluateCandidateLines`; `W=5` sweep reverse-fit to one past investigation (which memory notes was falsified/given up).
- **Proposed simplification:** Move the apparatus into a study module exposing one nullable hook, so candidate.ts carries at most one nullable callback. Or delete if the study is closed.
- **Risk:** low
- **Generalization note:** Off-by-default; removal cannot move the headline.
- **Status:** Accepted — byte-identical (all 160 seed-0 track hashes match baseline `attempt-aim-highk-gated-j32-a01` across every budget; the disabled probe is a pure null-check no-op, HEADLINE unchanged). EXTRACTED, not deleted: two study drivers still consume the apparatus (`study_landing_window.ts`, `study_impact_funnel.ts`) plus `handoff.ts`'s `attachHandoffScoreToProbe`, so deletion was off the table. Moved the ~170-line apparatus (record type, WeakMap, enable/disable/drain, `probeArcAngles`/`probeSurvivalFailure`/`probeLandingWindow`, `LANDING_PROBE_MAX_W`/`RECORD_CAP`) into new shared study module `scripts/v0/landing_probe.ts`; `candidate.ts` now carries only one nullable `LandingProbeHook` (installed via a `setLandingProbeHook` seam; the `attachHandoffScoreToProbe` no-op wrapper is retained so `handoff.ts` is unchanged) and exports `intersectsLineIds` for the study to reuse; dropped the now-unused `normImpact`/`redirArcPxAtLanding`/`wasLastGeometryImpactTemplate` imports; repointed both study drivers' imports to the new module.

### 80. `nextContact−2` "no ballistic flight" bound duplicated in three places
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `releaseStateFrame` 1201-1208; `computeShortGapFitDetection` 893-894; `releaseExitArrivalState` 1173-1174.
- **Complexity smell:** "First contact after `gap.endFrame`, minus 2, is the latest usable ballistic-launch frame" is re-implemented three times with slightly different shapes, each with its own magic `-2`.
- **Proposed simplification:** One `nextContactBound(gap, allContactFrames): {nextContact, latestBallisticFrame}` helper called from all three; the `-2` lives once.
- **Risk:** low
- **Generalization note:** Fixed frame count independent of budget.
- **Status:** Accepted — byte-identical (160/160 seed=0 track hashes match baseline; focused suite green). Extracted `nextContactBound(gap, allContactFrames)` and routed `releaseStateFrame` + `releaseExitArrivalState` through it (both derived nextContact via the SAME `allContactFrames.find(f > gap.endFrame)` and the same `-2`, confirmed identical). LEFT ALONE the third site `computeShortGapFitDetection`/`allContactFramesFor`: it bounds against `axisMeasureEnd` (the lookahead boundary, applied only when `> gap.endFrame`), a genuinely different frame reference — and doesn't even receive `allContactFrames` — so forcing it into the helper would change behavior; noted in the helper doc comment.

### 81. Two near-identical gravity-corrected launch reads
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `ballisticSuffixAtExit` 912-925; `releaseArrivalStateAt` 1106-1141.
- **Complexity smell:** Both read position+velocity, finite-check, then call `gravityCorrectedLaunchAverage` with identical airborne/velocity closures, returning `{vx,vy}`; the velocity computation is byte-identical.
- **Proposed simplification:** Factor into one `readSmoothedLaunch(det, frame)` helper; `ballisticSuffixAtExit` returns frame+vx/vy, `releaseArrivalStateAt` wraps it and attaches pose/grounded/airborne.
- **Risk:** low
- **Generalization note:** Removes the last duplicated wiring around a shared estimator.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Extracted the shared position/velocity read + finite-check + `gravityCorrectedLaunchAverage` call into `readSmoothedLaunch(det, frame)`; `ballisticSuffixAtExit` returns its `{vx,vy}` as `{frame,vx,vy}`, `releaseArrivalStateAt` wraps it with the extra pos-finite guard and pose/grounded/airborne fields.

### 82. Exit-frame finding duplicated between `computeShortGapFitDetection` and `releaseExitArrivalState`
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `computeShortGapFitDetection` 873-898; `releaseExitArrivalState` 1153-1191.
- **Complexity smell:** Both locate the geometric arc-exit via `firstAirborneExitFrame(...)` then apply the `nextContact-2` reject; in a truncated pool-mode eval the exit frame is computed twice and could disagree.
- **Proposed simplification:** Stash the located `exitFrame` in `computeShortGapFitDetection` and thread it into `releaseExitArrivalState` (or a shared `computeBallisticExit`) so `firstAirborneExitFrame` runs once per eval.
- **Risk:** medium
- **Generalization note:** Touches pool-mode arrival state — verify predicted-arrival ranker parity.
- **Status:** Not Started

### 83. Vestigial `continuation` flag in `makeAirPolishCandidates` / `makeContinuationLines`
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `makeAirPolishCandidates` 628-651; `makeContinuationLines` 653-657.
- **Complexity smell:** Returns `{line, continuation}[]` with `continuation:true` on every element; `makeContinuationLines` filters `continuation===true` (always true). Dead flag + always-true filter from a removed lane.
- **Proposed simplification:** Return `TrackLine[]` directly; `makeContinuationLines` becomes an alias or is inlined.
- **Risk:** low
- **Generalization note:** Purely dead flag.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). `makeAirPolishCandidates` now returns `TrackLine[]` directly; `makeContinuationLines` inlined at its single call site and deleted; the twin-dead `continuationOnly` guard/parameter in `polish.ts` `bestAirPolishCandidate` (only ever gated on the always-true flag) removed with it.

### 84. Two overlapping "long airborne gap" thresholds hard-coded to a 60fps/1s grid
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `shouldTryCandidateRideOut` 1226-1235 (`>= 60`); `axisLookaheadEndFrame` 1241-1251 (`>= 60 AND postContactFrames > floor(FPS/2)`).
- **Complexity smell:** Literal 60 encodes "1s at 60fps" as a bare frame count in two functions expressing nearly the same "long air gap" concept, one raw, one mixing raw 60 with FPS/2.
- **Proposed simplification:** Define `LONG_AIR_GAP_FRAMES = round(FPS)` used in both; express the postContactFrames bound in the same FPS-relative unit.
- **Risk:** medium
- **Generalization note:** Bare 60 misbehaves under any non-60fps spec.
- **Status:** Not Started

### 85. Reverse-fit magic weight `RELEASE_STATE_SPEED_WEIGHT = 0.126`
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `RELEASE_STATE_SPEED_WEIGHT` 177; `releaseSpeedPenalty` 1216-1224.
- **Complexity smell:** A 3-sig-fig constant with no derivation scaling a squared authored-speed error; not env-overridable unlike its sibling `LOCAL_IMPACT_COST_WEIGHT`.
- **Proposed simplification:** Tie it to the scorer's speed-weight fraction or expose an env knob to test collapsing toward 0/parity; at minimum document the fit.
- **Risk:** medium
- **Generalization note:** Benchmark-fit; may not transfer off the tuning set.
- **Status:** Not Started

### 86. Verbose hand-rolled telemetry bundles with copy-pasted reset/snapshot
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `releaseExitTotals` + reset/snapshot 109-140; `gapfitShortTotals` + reset/snapshot 147-169.
- **Complexity smell:** Two counter bundles each hand-write a mutable object, a per-field reset (enumerating every field — desync risk), and structurally identical snapshot functions.
- **Proposed simplification:** Add `makeCounterBundle(initial)` returning `{counters, reset, snapshot}`; both bundles become 3 lines + field list.
- **Risk:** low
- **Generalization note:** Pure boilerplate reduction.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Added generic `makeCounterBundle(initial)` returning `{counters, reset, snapshot}` (reset via `Object.assign(counters, initial)` — covers every field automatically, no desync); rewired both `releaseExitTotals`/`gapfitShortTotals` onto it with `*Totals` aliases to `.counters` so mutation sites and the exported reset/snapshot names (bespoke activity gates retained) are unchanged.

### 87. `SURVIVAL_MARGIN=16` / `axisSafeCap` survival constants split across two functions
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `computeShortGapFitDetection` `survivalFloor` 862-871; `evaluateGapFit` `SURVIVAL_MARGIN`/`minSurvival` 998-1002.
- **Complexity smell:** The survival window's 16 is declared independently in two functions (`endFrame+16` twice) plus caps `max(20, IMPACT_WINDOW+2)` and `axisMeasureEnd+2` with bare 20/2; the two 16s must stay in sync or the short-horizon path diverges.
- **Proposed simplification:** Hoist one module const `SURVIVAL_MARGIN=16` referenced by both; name the axisSafeCap offsets.
- **Risk:** low
- **Generalization note:** Frame-count constants independent of grid.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Hoisted module const `SURVIVAL_MARGIN=16` referenced by both `computeShortGapFitDetection`'s `survivalFloor` and `evaluateGapFit`'s survival gate; named the `axisSafeCap` offsets `AXIS_SAFE_CAP_MIN_FRAMES=20` and `AXIS_SAFE_CAP_MEASURE_END_OFFSET=2`. Pure rename/hoist, no value change.

### 88. `achievedAtEnd` dual-window measurement branch is a dense special case
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `evaluateGapFit` 1033-1045.
- **Complexity smell:** A three-way conditional decides whether to measure with a ballistic suffix and whether to compute a SECOND `achievedAtEnd` over `[start,endFrame]`, gated on `(axisMeasureEnd === gap.endFrame && ballisticSuffix === null)`; interplay of lookahead/truncation/coincidence spread across two statements + a long comment, re-running `measureGapAxes` over an overlapping window.
- **Proposed simplification:** Extract `measureAchieved(det, gap, lines, axisMeasureEnd, ballisticSuffix): {achieved, achievedAtEnd?}` owning the window logic, returning `achievedAtEnd` only when windows differ.
- **Risk:** medium
- **Generalization note:** Must preserve exact scorer-window semantics — verify.
- **Status:** Not Started

### 89. Hard-coded ride-out continuation lengths `[50, 300]`
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `AIR_POLISH_CONTINUATION_LENGTHS` 60; `makeAirPolishCandidates` 637.
- **Complexity smell:** Two bare pixel lengths with a 6× gap and no derivation; neither scales with gap size or budget.
- **Proposed simplification:** Document the derivation or express relative to source arc length / expected flight distance; if both rarely win, drop to one.
- **Risk:** medium
- **Generalization note:** Fixed pixels may be meaningless for specs far outside the tuned population.
- **Status:** Not Started

### 90. Trivial single-use helper `allContactFramesFor` with a misleading name
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `allContactFramesFor` 904-906; called once at 893.
- **Complexity smell:** A one-line helper named plural "contactFrames" actually returns a single frame-or-null; used exactly once.
- **Proposed simplification:** Inline the ternary, or fold into the shared `nextContactBound` helper (#80).
- **Risk:** low
- **Generalization note:** Naming/indirection cleanup.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Inlined the ternary at its sole call site in `computeShortGapFitDetection` and deleted the misleadingly-named helper; folded its doc note into the call-site comment. Did NOT pursue the alternate "fold into `nextContactBound` (#80)" suggestion — item #80 (commit 1c524b6) already established that this frame derivation (via `axisMeasureEnd`) is genuinely different from `nextContactBound`'s (via `allContactFrames.find`) and intentionally left them separate to avoid a behavioral change.

### 91. `rideOutSources` magic tail-window of 8 lines
- **Files:** `scripts/v0/core/candidate.ts`
- **Location:** `rideOutSources` 1237-1239.
- **Complexity smell:** `lines.slice(max(0, length-8))` — a bare 8 with no rationale; combined with 2 continuation lengths this drives up to 16 extra full-horizon `evaluateGapFit` re-evals per qualifying candidate.
- **Proposed simplification:** Name `RIDEOUT_SOURCE_TAIL=8` with rationale; reconsider whether all 8×2 combinations are needed vs only the final arc line.
- **Risk:** medium
- **Generalization note:** Fixed count covers a different physical length on specs with many short lines.
- **Status:** Not Started

---

## Polish — `scripts/v0/core/polish.ts`, `scripts/v0/optimizer/polish.ts`

### 92. Nine near-duplicate geometry-search helpers share one hand-inlined skeleton
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `polishExcessContact`/`polishContactEdges`/`polishGrainLength`/`polishEntrySpeed`/`polishEntrySpeedX`/`polishEntrySlope`/`polishEntryLength`/`polishMedianGrainPlateau`/`polishMedianGrainResidual` ~535-1565.
- **Complexity smell:** Every helper repeats the identical rebuild→detect→gate→baseErr→loop-line-IDs→save→mutate→rebuild+detect+gate→keep-if-better→restore→commit skeleton; only the per-candidate mutation differs, with subtly divergent details (accept-first vs best-of, single vs multi-pass) — where reverse-fit drift hides.
- **Proposed simplification:** Extract one `hillClimbGeometry(fits, gaps, spec, contactFrames, durationFrames, {candidateLineIds, mutate, errorFn, passes, acceptMode})` harness owning the loop; each helper becomes a mutation generator + line-selector. Reuse existing `snapshotLines`/`restoreLines`/`applyLengthDelta`.
- **Risk:** medium
- **Generalization note:** Unifying makes behavior uniform across populations.
- **Status:** Not Started

### 93. Single-element tuning arrays are vestigial reverse-fit constants
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** 49-67: `AIR_CONTACT_EXTENSION_LENGTHS=[25]`, `SPEED_POLISH_Y_SHIFTS=[-1]`, `SPEED_POLISH_ROTATIONS=[-4]`, `SPEED_POLISH_X_SHIFT_PASSES=[[4],[1],[0.5]]`.
- **Complexity smell:** Tuning "schedules" are arrays with exactly one element (or arrays of single-element arrays), leftover from removed multi-value sweeps; now magic scalars (25px, -1px, -4°) dressed as arrays.
- **Proposed simplification:** Collapse each to a named scalar and delete the surrounding loop; flatten `X_SHIFT_PASSES` to `[4,1,0.5]`. Where load-bearing, derive from line length / axis resolution instead of fixed pixels/degrees.
- **Risk:** medium
- **Generalization note:** Fixed magnitudes don't scale with spec geometry/budget.
- **Status:** Not Started

### 94. `contactExitLineIds` and `contactEntryLineIds` are identical except `sorted[0]` vs `sorted.at(-1)`
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `contactExitLineIds` 864-892; `contactEntryLineIds` 894-922 (also `briefSingleLineContactEntryIds`, `contactEdgeTrimCandidates`).
- **Complexity smell:** Byte-identical scanners over `det.measurements.airborne`/`contactLineIds` differing only in picking lowest vs highest id per contact range; two more near-copies with slightly different accept conditions.
- **Proposed simplification:** Write one `contactRanges(det): {start,end,ids}[]` scanner and derive entry/exit/brief/edge-trim ids from it. Removes ~120 duplicated lines.
- **Risk:** low
- **Generalization note:** Detector-derived, grid-agnostic.
- **Status:** Accepted — byte-identical (all 160 seed-0 track_hashes match baseline across every budget; fingerprint unchanged). Extracted one shared `contactRanges(det): {start,end,ids}[]` scanner and derived ALL FOUR functions from it: `contactExitLineIds` (`sorted.at(-1)`), `contactEntryLineIds` (`sorted[0]`), `briefSingleLineContactEntryIds` (size===1 & span≤PERSISTENCE_FRAMES accept, insertion-order `ids[0]`), and `contactEdgeTrimCandidates` (span≥5 guard + CONTACT_EDGE_TRIMS). All four shared the exact same range-detection core (same airborne-mask walk, same `contactLineIds` accumulation, same non-flush of a trailing open range) and differed only in the per-range accept/pick applied at close — so none needed to be left alone. Net −34 lines (39 insertions / 73 deletions).

### 95. `polishEntrySpeed` is invoked twice within the `polishExcessContact` cascade
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `polishExcessContact` tail 631-639 (calls at 633 and 638).
- **Complexity smell:** A fixed nine-pass pipeline calls `polishEntrySpeed` at both 633 and 638 — a reverse-fit ordering artifact (re-running entry-speed after grain polish recovered a fraction of a point on some spec); reads as ritual.
- **Proposed simplification:** Iterate the cascade to a fixed point (loop until no sub-polisher improves), calling each once per iteration; or document/justify the double call; if inert on the canonical set, delete the second.
- **Risk:** medium
- **Generalization note:** A hard-coded pass order tuned on 40 specs; a fixed-point loop generalizes.
- **Status:** Not Started

### 96. Two boundary-refinement helpers use arbitrarily different step schedules
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `polishEntrySpeedXBoundary` 732-796; `polishEntrySpeedYBoundary` 798-862.
- **Complexity smell:** Both nudge a brief single-line contact entry, but X uses `dx = direction*(coarseShift + coarseShift/10)` (a single fixed shift despite "refinement") while Y uses a genuine `step /= 2` halving loop; the `coarseShift/10` addend is an unexplained fudge.
- **Proposed simplification:** Unify into one `refineBoundaryShift(axis, ...)` using the Y-style halving for both; delete or justify the `/10` addend.
- **Risk:** medium
- **Generalization note:** Both step size and `/10` are fixed pixels, not resolution-relative.
- **Status:** Not Started

### 97. Air-polish family gated on the narrow `hasOnlyAirSectionTargets` predicate
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `hasOnlyAirSectionTargets` 286-289; guards 76, 360, 425; `shouldPolishExcessContact` 642-646.
- **Complexity smell:** `polishAirRideOut`/`polishAirContactEntry`/`polishAirBriefContacts` run only when a spec targets `air` and no other axis; `polishExcessContact` only when air AND (speed OR grain). Population-shaped switches carving the current set into "air-only" vs "air+companion" buckets; a spec targeting air+elevation falls through all air polish.
- **Proposed simplification:** Replace exclusive-membership predicates with a per-axis "targeted and under-satisfied" driver so each pass activates on the axes it improves. Collapses `hasOnlyAirSectionTargets`/`shouldPolish*` into one axis-driven gate.
- **Risk:** high
- **Generalization note:** Directly assumes today's axis population; new axis combinations are unhandled.
- **Status:** Not Started

### 98. `cloneFits` hand-enumerates every optional GapFit field with spread guards
- **Files:** `scripts/v0/optimizer/polish.ts`
- **Location:** `cloneFits` 40-59.
- **Complexity smell:** The deep-clone manually lists every GapFit field with `...(x===undefined?{}:{x})` guards; any new field is silently dropped, so a polished variant can diverge from its source invisibly until it corrupts a score.
- **Proposed simplification:** Use `structuredClone(fit)` (or one generic deep-copy), keeping only the intentional shallow-share of `geometry` if deliberate.
- **Risk:** medium
- **Generalization note:** Drift risk grows as the campaign bolts fields onto GapFit (see #106).
- **Status:** Not Started

### 99. `polishMedianGrainPlateau` only fires on even line counts and duplicates the residual pass
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `polishMedianGrainPlateau` 1388-1494; `polishMedianGrainResidual` 1496-1565.
- **Complexity smell:** `polishMedianGrainPlateau` bails unless `length >= 2 && length % 2 === 0`, then extends the median plateau; `polishMedianGrainResidual` does essentially the same analytically for any line count. Two overlapping mechanisms, one silently a no-op on odd counts.
- **Proposed simplification:** Drop `polishMedianGrainPlateau` and keep the analytic `polishMedianGrainResidual` (subsumes it, handles odd counts), or merge plateau detection into the residual pass. The `%2` gate should not survive.
- **Risk:** medium
- **Generalization note:** The even-count gate fires based on how many arcs a gap happened to get.
- **Status:** Not Started

### 100. Repeated `durationFrames + 20` simulation-tail literal (~20 call sites)
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** every `extractRawTrajectory` call (79, 165, 362, 395, 428, 463, 546, 592, 698, 776, 842, 969, 1019, 1072, 1103, 1185, 1238, 1271, 1346, 1397, 1455, 1505, 1541).
- **Complexity smell:** The magic tail-frame 20 ("simulate 20 frames past spec end for clean terminus/landing detection") is duplicated ~20 times with no named constant.
- **Proposed simplification:** Introduce `POLISH_SIM_TAIL_FRAMES=20` (or derive from `PERSISTENCE_FRAMES`) used everywhere; ideally wrap the recurring `detect(extractRawTrajectory(rebuildEngine(fits, gaps.length), durationFrames + TAIL))` triple into one `simulateAndDetect(fits, gaps, durationFrames)` helper.
- **Risk:** low
- **Generalization note:** A fixed 20-frame tail may be too short for slow riders/long specs; named/derived makes it adjustable.
- **Status:** Accepted — byte-identical (1-seed/40-spec/4-budget track_hash diff, 160/160 match). Tier 1: introduced `POLISH_SIM_TAIL_FRAMES=20` (commented) and named all 26 `durationFrames + 20` sites in `polish.ts`; also handled the deferred `handoff.ts forwardNodeScore` site by reusing the existing same-file `OUTPUT_TAIL_PAD_FRAMES` (identical output-tail-pad concept, no cross-module import). Tier 2: added a `simulateAndDetect(fits, gaps, durationFrames)` helper and collapsed the 22 genuinely-uniform triples into it — 20 inline `detect(extractRawTrajectory(rebuildEngine(fits, gaps.length), …))` blocks + 2 single-use `const eng = rebuildEngine(…)` two-statement equivalents. The remaining 4 `polish.ts` sites reuse or mutate a pre-built engine variable (`baseEngine`, `baseEngine.addLine(…)`, `candidateEngine`) so they don't fit the helper and stay Tier-1-only (named constant). Net ~-40 lines in `polish.ts`.

### 101. `contactEdgeTrimCandidates` hard-codes a 5-frame minimum contact length
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `contactEdgeTrimCandidates` 1692 (`if (frame - rangeStart < 5)`).
- **Complexity smell:** Contact ranges shorter than 5 frames are skipped via a bare 5, disconnected from `K_BOUNCE_LANDING`/`PERSISTENCE_FRAMES` (used for other frame constants).
- **Proposed simplification:** Replace with a named constant derived from `PERSISTENCE_FRAMES`/`K_BOUNCE_LANDING` so the "too brief to trim" boundary tracks the detector.
- **Risk:** low
- **Generalization note:** Fixed 5 is meaningless if FPS/persistence changes.
- **Status:** Accepted — byte-identical (all 160 seed-0 track hashes match baseline `attempt-aim-highk-gated-j32-a01`). A real derivation was found: both `K_BOUNCE_LANDING` and `PERSISTENCE_FRAMES` are defined as `5` in `scripts/lib/detector.ts`, so the bare `5` now reads `CONTACT_EDGE_TRIM_MIN_FRAMES = PERSISTENCE_FRAMES` (numeric value unchanged). Chose `PERSISTENCE_FRAMES` over `K_BOUNCE_LANDING` for consistency with the sibling `briefSingleLineContactEntryIds`, which already bounds `range.end - range.start` against `PERSISTENCE_FRAMES`.

### 102. `CONTACT_TRIM_FRACTIONS` / `CONTACT_EDGE_TRIMS` are opaque hand-fit fraction tables
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** 55-60: `CONTACT_TRIM_FRACTIONS=[0.25,0.8]`, `CONTACT_EDGE_TRIMS=[{start,start,0.85},{start,end,0.9}]`.
- **Complexity smell:** Discrete fraction tables with no derivation; the 0.25/0.8 pair and near-identical 0.85/0.9 start-edge entries look reverse-fit, and both edge entries only ever trim the entry side.
- **Proposed simplification:** Replace with a continuous trim search (binary-search the fraction against `meanSectionAxisError`, like the Y-boundary halving); if both edge entries touch only the start, collapse to one.
- **Risk:** medium
- **Generalization note:** Discrete fractions tuned on current specs won't be optimal for different geometry.
- **Status:** Not Started

### 103. `currentStartState` module-global with manual save/restore is a reentrancy trap
- **Files:** `scripts/v0/core/polish.ts`, `scripts/v0/optimizer/polish.ts`
- **Location:** `currentStartState` + `setRebuildStartState`/`getRebuildStartState` 1805-1821; `polishLeafVariant` save/restore 101-113.
- **Complexity smell:** `rebuildEngine` reads a module-scoped mutable `currentStartState` every caller must prime; `polishLeafVariant` manually get/set/restores-in-finally around each leaf — a documented reentrancy hazard papered over with try/finally.
- **Proposed simplification:** Thread `startState` explicitly: build a `rebuild = (fits, upTo) => rebuildEngineWith(startState, fits, upTo)` closure (or a `PolishContext`) passed to helpers, removing the module global and all set/get/restore plumbing.
- **Risk:** medium
- **Generalization note:** Hidden global couples all polish helpers and blocks parallel/interleaved compilation.
- **Status:** Not Started

### 104. `airPolishSources` uses a hard-coded first-1 + last-3 line window
- **Files:** `scripts/v0/core/polish.ts`
- **Location:** `airPolishSources` 176-193 (181-184).
- **Complexity smell:** Non-dense sources are `slice(0,1)` + `slice(len-3)` — magic 1 and 3 that assume enough lines and sample nothing extra for 1-4-line gaps; the dense path uses an entirely different air-duration-ranked selection.
- **Proposed simplification:** Replace the first-1/last-3 literals with a selector ranked by the same air-error contribution the dense path computes, so dense/non-dense share one principled ranker.
- **Risk:** medium
- **Generalization note:** first-1/last-3 assumes a typical per-gap line count; degenerate on very short/long gaps.
- **Status:** Not Started

---

## Substrate / measure / spec — `scripts/v0/core/{substrate,measure,spec_modifiers,beats,camera}.ts`

> **Note:** `substrate.ts`/`measure.ts` contain the fingerprinted scoring ruler. Any change here must be verified byte-identical against the evaluator fingerprint or treated as out of scope.

### 105. Legacy impact metrics live in the fingerprinted substrate but are used only by study harnesses
- **Files:** `scripts/v0/core/substrate.ts`
- **Location:** `normalImpactPxAtLanding` ~196-218; `redirImpactPxAtLanding` ~227-247.
- **Complexity smell:** Both are documented LEGACY / not-the-scored-metric; their only callers are `impact_support.ts` and `analysis/simulate.ts` (study tooling). They sit in the fingerprinted slice adding ~50 lines a reader must disambiguate from the one real metric (`redirArcPxAtLanding`).
- **Proposed simplification:** Move both into `impact_support.ts` ("single source for study metrics"), leaving only `redirArcPxAtLanding` in substrate.ts.
- **Risk:** low
- **Generalization note:** Pure relocation of analysis-only code (verify fingerprint slice unchanged).
- **Status:** Accepted — byte-identical, fingerprint unchanged (de24a421f751). Moved `normalImpactPxAtLanding` + `redirImpactPxAtLanding` (verbatim bodies + doc comments) out of `core/substrate.ts` into their sole caller `impact_support.ts` (the study-metrics single source); added `measurementLastFrame` to its substrate import. Confirmed no other importer — `analysis/simulate.ts` only mentions `redirImpactPxAtLanding` in prose and imports the scored `redirArcPxAtLanding`; `measure.ts` (production scorer) uses only `redirArcPxAtLanding`, which stays in substrate. All 160 seed-0 golden `track_hash`es match baseline attempt-aim-highk-gated-j32-a01, 97 focused tests pass.

### 106. `measureFitGrain` duplicates `measureGrain`
- **Files:** `scripts/v0/core/substrate.ts`, `scripts/v0/core/measure.ts`
- **Location:** `measureFitGrain` ~342-345; `measureGrain` ~67-70.
- **Complexity smell:** Both compute median catch-line length clamped by `CALIB.LINE_LENGTH_CAP`; `measureGrain` is the registered `AXIS_MEASURE.grain`, `measureFitGrain` a standalone copy (used only by polish.ts) — the grain reduction defined twice, defeating measure.ts's "exactly one place" goal.
- **Proposed simplification:** Delete `measureFitGrain`; have polish.ts call `measureGrain` via a `GapMeasureCtx` built from `fit.lines` (or a thin adapter). No numeric change.
- **Risk:** low
- **Generalization note:** Same CALIB cap.
- **Status:** Accepted — byte-identical, fingerprint unchanged (de24a421f751). Deleted `measureFitGrain` (and its now-orphaned `CALIB` import) from substrate.ts; polish.ts keeps a thin local adapter that delegates to the already-exported `AXIS_MEASURE.grain` registry (`?? 0` for the empty-gap case). Went through `AXIS_MEASURE` rather than exporting `measureGrain`, because exporting it would edit the fingerprinted measure.ts axis-measurement slice; the registry access leaves measure.ts byte-identical and the substrate.ts edits fall outside its two fingerprint slices. 160/160 seed-0 track hashes match; fingerprint held at de24a421f751.

### 107. `measureAxisOverRange` re-implements the air/speed reductions with an internal switch
- **Files:** `scripts/v0/core/substrate.ts`, `scripts/v0/core/measure.ts`
- **Location:** `measureAxisOverRange` ~802-818; `measureAir` ~49-58 / `measureSpeed` ~61-64.
- **Complexity smell:** Hand-inlines the airborne-fraction loop and mean-speed→authored conversion with an `if (axis==='air') … else speed` branch — a third copy of reductions already in the AXIS_MEASURE registry (polish.ts its only caller).
- **Proposed simplification:** Route `measureAxisOverRange` through `AXIS_MEASURE[axis]` with a `GapMeasureCtx` carrying the desired range; collapse the branch to a registry lookup.
- **Risk:** low
- **Generalization note:** Behavior-identical if it delegates to the same reductions.
- **Status:** Accepted — byte-identical, fingerprint unchanged (de24a421f751), measure.ts untouched. `measureAxisOverRange` now builds a `GapMeasureCtx` (gap.startFrame=f0, rangeEndFrame=f1) and returns `AXIS_MEASURE[axis](ctx) ?? null`, dropping the hand-inlined `if (axis==='air') … else speed` branch (the span reductions clamp the end to `measurementLastFrame` identically). Verified via 1-seed/40-spec/4-budget track_hash diff (160/160 match) vs `attempt-aim-highk-gated-j32-a01`. Also removed the now-dead `speedPxToAuthored` import from substrate.ts.

### 108. Amplitude and elevation vy-integration re-implemented four times
- **Files:** `scripts/v0/core/measure.ts`
- **Location:** `measureElevation` ~81-95, `measureAmplitude` ~110-132, `measureAmplitudeWithSuffix` ~305-326, `integratedDyWithSuffix` ~328-342.
- **Complexity smell:** "Integrate vy for net Δy, and (for amplitude) track peak above the takeoff→landing chord" is written four times; the ballistic-suffix variants duplicate the chord-sagitta loop, differing only in whether vy comes from the detector or `ballisticVyAt`.
- **Proposed simplification:** Introduce one `vyAt(f)` source abstraction (detector ≤ prefixEnd, ballistic beyond) and `chordSagitta(vyAt,a,b)` + `netDy(vyAt,a,b)` helpers; express all four on top. Removes ~40 lines.
- **Risk:** medium
- **Generalization note:** On the candidate hot path — must preserve exact float summation order to stay byte-identical.
- **Status:** Not Started

### 109. `impactFeasibilityBound` duplicates a gravity constant and buries magic default speed/gap fallbacks
- **Files:** `scripts/v0/core/substrate.ts`
- **Location:** `IMPACT_BOUND_GRAVITY_PX_PER_FRAME2` ~512; `impactFeasibilityBound` ~539-550; `buildDriftReport` nextGapSeconds fallback ~755.
- **Complexity smell:** `IMPACT_BOUND_GRAVITY_PX_PER_FRAME2=0.175` is a hand-copied duplicate of `LAUNCH_GRAVITY_PX_PER_FRAME2` (kept in sync by comment); the bound also hardcodes a default speed 0.55 and buildDriftReport substitutes 1.5s for the last gap's "next gap."
- **Proposed simplification:** Import the single LAUNCH_GRAVITY constant (or hoist into `CALIB`); name the 0.55/1.5s fallbacks as documented CALIB constants.
- **Risk:** medium
- **Generalization note:** 1.5s last-gap and 0.55 default silently assume canonical-tempo specs (verify fingerprint impact).
- **Status:** Not Started

### 110. `axisExpand` and `axisCompress` are two exported names for the identical function
- **Files:** `scripts/v0/core/spec_modifiers.ts`
- **Location:** `axisScale` ~190-199, `axisExpand` ~201-203, `axisCompress` ~205-207.
- **Complexity smell:** Both forward to `axisScale` with identical bodies; `axisScale` already derives the verb from the factor, so the name has zero effect. Only `axisExpand` is used; `axisCompress` has no callers.
- **Proposed simplification:** Delete `axisCompress` and export `axisScale` directly.
- **Risk:** low
- **Generalization note:** Offline calibration authoring only.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Note: catalog's "axisCompress has no callers" was stale — it had 2 callers (`elevation`/`amplitude` in `DEFAULT_CALIBRATION_CANDIDATES`). Exported `axisScale` with a `center = 0.5` default, deleted both `axisExpand` and `axisCompress` thin wrappers, and repointed all 5 call sites (3 in `spec_modifiers.ts`, 2 in `specs/drums_0_56s_creative.ts`) to `axisScale` — byte-identical since the wrappers were pure forwards.

### 111. `resolveCalibrationSelection` is a dead exported function
- **Files:** `scripts/v0/core/spec_modifiers.ts`
- **Location:** `resolveCalibrationSelection` ~111-141.
- **Complexity smell:** Exported, returns a rich `CalibrationResolution`, but no caller exists outside the file; the live entry point `applyCalibrationSelection` discards everything but `.spec`.
- **Proposed simplification:** Inline the needed logic into `applyCalibrationSelection`, delete `resolveCalibrationSelection` and the `CalibrationResolution` type if unused.
- **Risk:** low
- **Generalization note:** Dead-export removal.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Confirmed no external caller of `resolveCalibrationSelection`/`CalibrationResolution` (whole-repo grep; the 4 `spec_modifiers.ts` consumers import neither, no wildcard imports); inlined the `.spec`-only logic into `applyCalibrationSelection` and deleted the function plus the now-unused `CalibrationResolution` type.

### 112. Sidecar-JSON calibration subsystem is a large, narrowly-used offline mechanism in `core/`
- **Files:** `scripts/v0/core/spec_modifiers.ts`
- **Location:** whole file, esp. `readCalibrationSelection`/`calibrationSelectionPath` ~143-166, `auditTargetChanges` + Audit types ~53-87, 257-403, `DEFAULT_CALIBRATION_CANDIDATES` ~433-442.
- **Complexity smell:** ~450 lines of calibration machinery (sidecar selection, candidate registry, 800-sample audit with soft/mid/hard bands) in `core/` but exercised only by `calibrate_spec.ts`, `serve.ts`, and one spec. Reverse-fit candidate constants (air floor 0.35, impact bands 0.3/0.7, speed shifts 0.03/0.06).
- **Proposed simplification:** Relocate calibration/audit machinery to a tooling module so `core/` carries only golden-path behavior; drop unused candidate constructors (`impactHighCompress` has no callers).
- **Risk:** low
- **Generalization note:** Inert in the normal golden path; assumes a specific spec population.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Confirmed the golden/production compile path imports NOTHING from this file: the only importers are the offline tools `calibrate_spec.ts` + `serve.ts`, the non-golden spec `specs/drums_0_56s_creative.ts`, and `tests/spec_modifiers.test.ts` (the hot path — handoff.ts/aim.ts/sample.ts — and every `specs/golden/*.ts` import none of it). Since nothing golden-path-relevant remained, relocated the entire ~406-line file out of `core/`: `git mv scripts/v0/core/spec_modifiers.ts → scripts/v0/spec_modifiers.ts` (alongside `calibrate_spec.ts`), fixed its two internal relative imports (`../types.ts`→`./types.ts`, `./substrate.ts`→`./core/substrate.ts`), and repointed all four importers. `impactHighCompress` was NOT deleted — the catalog's "no callers" claim was stale (it is used both by `tests/spec_modifiers.test.ts` and internally by `DEFAULT_CALIBRATION_CANDIDATES`). Pure relocation; no code-body changes.

### 113. `engineLineSignature` appears to be a dead exported duplicate of the engine-line cache key
- **Files:** `scripts/v0/core/substrate.ts`
- **Location:** `engineLineSignature` ~407-419.
- **Complexity smell:** Builds a pipe-joined string key from the same nine geometry fields the Symbol-keyed `ENGINE_LINE_CACHE` compares field-by-field; no caller outside the file — a leftover from a superseded string-keyed cache.
- **Proposed simplification:** Delete `engineLineSignature` (confirm no dynamic reference first).
- **Risk:** low
- **Generalization note:** Dead-export removal.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Thorough whole-repo search confirmed genuinely dead: the only occurrences of `engineLineSignature` are the definition itself, the catalog entry, and two historical profiling mentions in `OPTIMIZATION_LOG.md` (from when the superseded string-keyed cache was live). No call sites, no imports, no quoted-string literal (`"engineLineSignature"`), no dynamic bracket access, no barrel re-export. The live path uses the Symbol-keyed `ENGINE_LINE_CACHE` (field-by-field). Deleted the function (line 333, outside both fingerprinted substrate slices; fingerprint unchanged at `de24a421f751`).

### 114. `GapFit` carries a stack of optional telemetry/diagnostic-only fields threaded through the hot path
*(related: polish `cloneFits` #98)*
- **Files:** `scripts/v0/core/substrate.ts`
- **Location:** `GapFit` type ~30-96: `aimed`, `releaseVelocityY`, `releaseGroundedFrames`, `releaseAirborne`, `releaseArrivalState` (copy sites candidate.ts 820-826, handoff.ts 1591-1598).
- **Complexity smell:** ~15 optional fields, several "Telemetry only — never read by ranking," constructed and copied on every fit through per-field spread guards, inflating the central data structure.
- **Proposed simplification:** Group non-load-bearing fields into one optional `fit.telemetry?: {...}` sub-object (or drop purely-diagnostic ones), collapsing the many spread sites; the core type then states which fields drive ranking.
- **Risk:** medium
- **Generalization note:** `releaseGroundedFrames`/`releaseArrivalState` ARE read by handoff/objective — partition carefully to avoid changing search behavior.
- **Status:** Not Started

### 115. `buildDriftReport` re-derives per-axis ceilings inline instead of via the axis registry
- **Files:** `scripts/v0/core/substrate.ts`
- **Location:** `buildDriftReport` axis loop ~744-783.
- **Complexity smell:** The per-axis reporting loop special-cases each axis by name (impact feasibility-bound + ceiling, elevation ceiling from start-speed, speed raw px/frame block); the comment admits impact is "applied HERE as well as at the compiler's target resolution, so the two cannot drift" — two hand-synced copies.
- **Proposed simplification:** Move per-axis ceiling/bound/raw-projection into an `AXIS_MEASURE`-style registry (axis→report-decoration) so buildDriftReport iterates uniformly and the impact bound is defined once.
- **Risk:** high
- **Generalization note:** This is the fingerprinted scoring ruler — any restructure risks moving the headline; must be byte-identical or out of scope.
- **Status:** Not Started

### 116. Ballistic-suffix span-axis completion re-implements `measureGapAxes` for out-of-window ranges
- **Files:** `scripts/v0/core/measure.ts`
- **Location:** `summarizeBallisticAxisPrefix` ~200-239, `completeBallisticSpanAxesFromSummary` ~241-270, `measureGapAxesWithBallisticSuffix` ~281-303.
- **Complexity smell:** A trio re-derives air-fraction/mean-speed/elevation-Δy over a split prefix+suffix range via a bespoke summary struct — effectively a parallel measurement engine that must stay numerically consistent with the primary reductions; docstring notes analysis scaffolding ("dirty rows deliberately still produce modeled output") baked into a production path.
- **Proposed simplification:** Express suffix completion via the same accumulators the base reductions use (have `measureAir`/`measureSpeed`/`measureElevation` accept a frame-value provider so ballistic frames are "more frames"), removing the summary/complete pair; at minimum unify the per-axis weighting math.
- **Risk:** medium
- **Generalization note:** On candidate.ts/arc_probe.ts air-gap paths; must preserve exact frame-weighting to stay byte-identical.
- **Status:** Not Started

---

## Geometry / reachability / arc model — `scripts/v0/optimizer/{reachability,arc_model,arc_probe,node}.ts`

### 117. Entire `reachability.ts` module is probe-only dead weight on the compile path
- **Files:** `scripts/v0/optimizer/reachability.ts`
- **Location:** whole file (343 lines): `getRegion`/`nextContactRegion`/`bestLocalExit`/`reachabilityPenalty`/`handoffStability`/`velocityGrid`, `resetReachabilityCache` + `registerCompileReset(...)` 92-96.
- **Complexity smell:** Header admits "probe-only (not imported by the handoff compile path)"; the only real importer is `reach_probe.ts` (study tool). An entire backward-reachability subsystem + per-compile memo + lifecycle reset is carried but never influences a compiled track ("for the day reachability is wired in," which never happened).
- **Proposed simplification:** Move the module (and `reach_probe.ts`) into a studies area or delete; at minimum drop the `registerCompileReset(resetReachabilityCache)` so the compile lifecycle stops resetting a cache nothing populates.
- **Risk:** low
- **Generalization note:** Not on the hot path; only coupling is the lifecycle-reset registration.
- **Status:** Accepted — byte-identical (all 160 seed=0 track hashes match baseline; the compile path never imports the module, so relocation cannot move golden output). Confirmed the sole real importer is the study driver `reach_probe.ts` (comments in arc_placement/compile_lifecycle/handoff/types only *mention* reachability; none import it); `reach_probe.ts` is a parked-but-kept probe per docs/archive/PLATEAU_CAMPAIGN_LOG.md, so relocated rather than deleted. Moved `scripts/v0/optimizer/reachability.ts` → `scripts/v0/reachability.ts` (out of the hot-path `optimizer/` dir into the flat study area alongside `reach_probe.ts`), fixed its relative imports, and repointed `reach_probe.ts`. Left the `registerCompileReset(resetReachabilityCache)` call in place: it lives INSIDE the module (not registered from a separate side-effect importer), so it travels with the file and stays a self-contained latent safety net — and it never runs during a golden compile since that path never imports the module (nothing populates the cache to reset). Updated the stale `optimizer/reachability.ts` path in the compile_lifecycle.ts illustrative comment. #118 remains actionable and applies unchanged to the relocated `scripts/v0/reachability.ts` (its "prototype guess" constants still exist).

### 118. Reachability scoring constants are self-described unvalidated "prototype guesses"
- **Files:** `scripts/v0/optimizer/reachability.ts`
- **Location:** `handoffStability` 121-135, `stateDistance` 140-145, `velocityGrid` 282-310, `NEXT_REGION_ACCEPT_DISTANCE` 63, `PROBE_ATTEMPTS` 60, `reachabilityPenalty` cap 165.
- **Complexity smell:** ~15 bare literals the code itself flags as provisional ("Phase A validates which dims carry signal" — which never ran since the module was never wired in).
- **Proposed simplification:** Fold into the delete/quarantine of #117; if any survives as a probe, collapse the smoothExcess/normaliser literals into one config object marked unvalidated.
- **Risk:** low
- **Generalization note:** Absolute px/frame/degree thresholds assume current physics scaling.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Followed #117's relocate-not-delete fallback: consolidated 27 bare numeric literals (in the now-relocated `scripts/v0/reachability.ts`) into one `REACHABILITY_PROTOTYPE_CONFIG` object near the top of the file — `probeAttempts`, `nextRegionAcceptDistance`, the `reachabilityPenalty` cap, 13 `handoffStability` thresholds/weights, 3 `stateDistance` normalisers, and 9 `velocityGrid` parameters — with a comment block flagging them as unvalidated prototype guesses (the never-run "Phase A"). Pure reorganization: no numeric value changed, every use site repointed to the config. Module is dead on the golden path (#117), so the byte-identical guarantee is automatic; confirmed anyway.

### 119. Non-hybrid arc-response model dispatch is dead — production always fits 'hybrid'
- **Files:** `scripts/v0/optimizer/arc_model.ts`
- **Location:** `fitArcResponseOutputModel` switch 323-347; `ARC_RESPONSE_MODEL_NAMES` 145-151; `ArcResponseModelName` 88-93; the standalone linear/additive_quadratic/joint_quadratic/surface arms.
- **Complexity smell:** Every caller passes `modelName='hybrid'`, so the four other switch arms are never reached in production or studies; the five-name enum + export exist to make dead arms look like real options.
- **Proposed simplification:** Inline the hybrid path: call `fitHybridArcOutput` directly, delete the `modelName` parameter, `ArcResponseModelName`, `ARC_RESPONSE_MODEL_NAMES`, and the four standalone arms. Feature functions stay (the hybrid ladder uses them).
- **Risk:** low
- **Generalization note:** Pure dead-branch removal, hybrid behavior bit-identical.
- **Status:** Abandoned — catalog was wrong: `study_joint_arc_model.ts` (the `npm run study:joint-arc` driver) sweeps ALL of `ARC_RESPONSE_MODEL_NAMES` — `for (const modelName of MODEL_SPECS)` at line 516 with `MODEL_SPECS = ARC_RESPONSE_MODEL_NAMES` — through `fitJointArcResponseModel`→`fitArcResponseOutputModel`, so every non-hybrid arm (`linear`/`additive_quadratic`/`joint_quadratic`/`surface`) is exercised for model-form comparison research (`--loss-model=best|linear|additive_quadratic|joint_quadratic|surface|hybrid`; `printModelComparison` compares additive_quadratic vs joint_quadratic). `tests/arc_model.test.ts:592` also fits with `"additive_quadratic"` directly. All four arms plus `ArcResponseModelName` and `ARC_RESPONSE_MODEL_NAMES` are live, and since the study reaches every arm there is no truly-unreachable subset to delete. Production (`aim.ts:919`) and the other two studies (`study_latent_decomposition.ts`, `study_prediction_truth.ts`) do only pass `"hybrid"`, but the "never reached in production or studies" premise is false. Nothing removed.

### 120. `hybridUsesSurface` / `hybridUsesBiquadratic` are hard-coded reverse-fit per-output name lists
- **Files:** `scripts/v0/optimizer/arc_model.ts`
- **Location:** `hybridUsesSurface` 434-452, `hybridUsesBiquadratic` 427-432; consumed in `fitHybridArcOutput` 401-424.
- **Complexity smell:** Which functional form an output gets is decided by string-matching output names against two hand-maintained allow-lists differing by probe design; reads as "whatever form fit each named axis best" and must be kept in sync with axis naming by hand.
- **Proposed simplification:** Replace membership tests with a single per-output policy derived from output category (axis-error vs kinematic-state vs angle) and row count.
- **Risk:** medium
- **Generalization note:** Lists enumerate today's exact axis set; adding an axis silently gets the fallback. A category rule generalizes.
- **Status:** Not Started

### 121. Surface-fit selection for `current.*` axes is dead in production (outputs immediately cleared)
- **Files:** `scripts/v0/optimizer/arc_model.ts`
- **Location:** `hybridUsesSurface` current.* entries 436-449 vs `clearReducerOwnedOutputs` 519-548 (invoked in `predictJointArcOutputs` 512).
- **Complexity smell:** In the production short/latent path, `clearReducerOwnedOutputs` deletes `current.cost`/`current.axis.*`/`current.error.*`/all exit.*/next.* (reducer re-derives them ballistically), yet `fitHybridArcOutput` still fits an expensive surface model for exactly those current.* outputs per pool build — then throws it away.
- **Proposed simplification:** Have `fitJointValueModels` skip fitting any output that `clearReducerOwnedOutputs` will delete when a latent model exists (condition on model space, not unconditional).
- **Risk:** medium
- **Generalization note:** Latent mode is the production default; the direct-outputs full path still needs these.
- **Status:** Not Started

### 122. `predictKnobSurfaceModel`'s four-tier interpolation cascade is near-dead machinery
- **Files:** `scripts/v0/optimizer/arc_model.ts`
- **Location:** `fitKnobSurfaceModel` 772-778, `predictKnobSurfaceModel` 780-807, `surfaceValueAt`/`bounds`/`interpolateAxis`/`nearestSurfaceValue` 809-869.
- **Complexity smell:** ~90 lines of exact-match→bilinear→separable→nearest-neighbour interpolation reachable only when a 'surface' form is fitted — which per #121 is the cleared current-axis outputs plus a couple sled-pose outputs; pitch3 never fits a surface.
- **Proposed simplification:** After #121, evaluate whether `additive_quadratic` suffices for the remaining `next.sledPose*` and delete `fitKnobSurfaceModel`/`predictKnobSurfaceModel` + the four helpers, collapsing to the linear ladder.
- **Risk:** medium
- **Generalization note:** Risk only if grid9 relies on surface interpolation for sled-pose.
- **Status:** Not Started

### 123. `biquadraticFeatures` + grid9 joint_quadratic arm serve a study-only probe design
- **Files:** `scripts/v0/optimizer/arc_model.ts`
- **Location:** `biquadraticFeatures` 317-321, `hybridUsesBiquadratic` 427-432, grid9 push in `fitHybridArcOutput` 415.
- **Complexity smell:** The 9-feature biquadratic + grid9 joint_quadratic entry fire only when `probeDesignName==='grid9'` (`LR_AIM_JOINT_PROBE_DESIGN=grid9`, study-only); production defaults to cross5.
- **Proposed simplification:** Move grid9 + its biquadratic basis + predicate behind studies, or delete grid9 from the production hybrid ladder.
- **Risk:** low
- **Generalization note:** Not part of any production run.
- **Status:** Abandoned — catalog was wrong in the same way #119 was: "study-only" ≠ dead. `study_joint_arc_model.ts` (the `npm run study:joint-arc` driver) DEFAULTS its probe design to `grid9` (`argValue("probe-design") ?? "grid9"` at line 76), and grid9 is a required arm of its documented acceptance loss `max(primary_loss_cross5, primary_loss_grid9)` (`ARC_AIMING_FORMALIZATION.md:60`, `ARC_STATE_CONTROL.md:623-628`). It sweeps `MODEL_SPECS = ARC_RESPONSE_MODEL_NAMES` (incl. `hybrid`) at line 516-517 via `fitJointArcResponseModel(probeRows, "grid9", modelName, ...)`, which reaches `fitHybridArcOutput(rows, output, "grid9")` and exercises `hybridUsesBiquadratic`/`biquadraticFeatures` (415→413) and the grid9 `joint_quadratic` push (415). Production is genuinely `cross5` (`aim.ts:131-135`; the grid9 default was A/B-tested and REJECTED, `compiler-improvement-log.md:2571`) and never evaluates these branches — but the code is NOT dead. It lives inside the shared `fitHybridArcOutput` that the study reaches through the production entry point `fitJointArcResponseModel` (the study does not call `fitHybridArcOutput` directly), so it cannot be deleted (would change the study's grid9-hybrid fits) nor cleanly relocated (injecting the rungs would add a callback seam, not simplify). It is already runtime-isolated behind `probeDesignName === "grid9"` guards. Nothing removed. (`hybridUsesBiquadratic` is separately the subject of still-open #120; untouched here.)

### 124. `clearReducerOwnedOutputs` hard-codes duplicate key lists that must track three other functions
- **Files:** `scripts/v0/optimizer/arc_model.ts`
- **Location:** `clearReducerOwnedOutputs` 519-548 vs `exitStateOutputs` 664-676, `stateOutputs` 678-689, `axisResponseOutputs` 704-717.
- **Complexity smell:** Manually re-lists all nine exit.*, eight next.*, current.axis/error.*, current.cost/releaseSpeedPx/releaseVy — the exact key sets the three producers emit, kept in sync by hand (add one exit.* field and forget → silent double-write).
- **Proposed simplification:** Derive the owned-key set from the producers (expose their key arrays, or clear by 'exit.'/'next.' prefix + a small explicit current.* set) so `clearReducerOwnedOutputs` iterates them.
- **Risk:** low
- **Generalization note:** Correctness-hardening dedup removing a manual-sync trap.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). No behavior-affecting drift: the reducer only reconstructs the ballistic axes (air/speed/elevation, via `completeBallisticSpanAxesFromSummary`), so the 3-axis `current.axis`/`current.error` list already matched the reducer's actual emission — grain/amplitude/impact are fitted model outputs the reducer deliberately never overwrites (a 6-axis clear derived from `axisResponseOutputs`'s full signature would have been a real behavior change, deleting valid predictions). Implemented option (b): prefix-clear `exit.`/`next.` (the ONLY producers of those namespaces are `exitStateOutputs`/`stateOutputs`, so new fields are swept automatically — this removes the genuine 17-key hand-mirrored duplication) plus an explicit small `current.*` set with a named `REDUCER_BALLISTIC_AXES` const.

### 125. Dual short/full probe-horizon mode threads a comparison-only arm through the whole observer
*(cross-ref aim entry #46)*
- **Files:** `scripts/v0/optimizer/arc_probe.ts`
- **Location:** `observeJointArcLines` mode branches 131-209, `fullProbeHorizon` 232-234, `shortProbeHorizon` 236-248, `includeTruth` 113-115.
- **Complexity smell:** Per CLAUDE.md, 'full' mode is a comparison arm that must never be default, yet `observeJointArcLines` forks on `mode==='full'` at nearly every step (horizon, minSurvival, offBeatEnd, suffixFrame, nextStateOk, achieved, trailing arrival read); production only runs short, so ~half the observer branches are dead weight kept for studies.
- **Proposed simplification:** Split into `observeShort` (production, no per-line `if full`) and a thin `observeFull` imported only by studies.
- **Risk:** medium
- **Generalization note:** Must preserve the study tools consuming full + truth rows.
- **Status:** Not Started

### 126. `directOutputs` vs latent model space are two near-duplicate reductions of the same row (empirically a wash)
*(cross-ref aim entry #46)*
- **Files:** `scripts/v0/optimizer/arc_probe.ts`, `scripts/v0/optimizer/arc_model.ts`
- **Location:** arc_probe `directOutputs` block 163-177; arc_model `reduceLatentJointArcOutputs` 565-591.
- **Complexity smell:** `direct` writes `fit(reduce(row))` per row; default `latent` applies `reduce(fit(row))` post-fit — two code paths computing the same physics at different stages, plus the whole `latentOutputs` channel + `suffixStateFromLatent`/`prefixSummaryFromLatent`. Memory records model space as a measured WASH.
- **Proposed simplification:** Pick one space (latent is default) and delete the other: drop the `directOutputs` option + block, keeping the single latent reducer (coordinate with aim #46).
- **Risk:** medium
- **Generalization note:** Neither assumes the grid; affects only aim.ts's `LR_AIM_MODEL_SPACE` switch.
- **Status:** Not Started

### 127. Ad-hoc probe-horizon offset constants (+16/+20/+2, IMPACT_WINDOW+2) scattered in arc_probe.ts
- **Files:** `scripts/v0/optimizer/arc_probe.ts`
- **Location:** `fullProbeHorizon` 232-234, `shortProbeHorizon` 236-248, `minSurvival` 136-138.
- **Complexity smell:** Horizon/survival built from bare additive constants in slightly different combinations per function; no single named "settle margin."
- **Proposed simplification:** Introduce one or two named constants (`SETTLE_MARGIN_FRAMES`, `HORIZON_SLACK_FRAMES`) derived from the detector persistence horizon + IMPACT_WINDOW, express all three sites in terms of them. (Relates to candidate #87.)
- **Risk:** medium
- **Generalization note:** Absolute frame counts tied to physics settle time, not budget; read as magic.
- **Status:** Not Started

### 128. `LR_ROLLOUT_AIM` rollout aim-suppression is niche experiment plumbing in the node module
- **Files:** `scripts/v0/optimizer/node.ts`
- **Location:** `inRolloutContext`/`rolloutAimEnabled`/`setRolloutContext` 44-55; gate in `sortWithLaneExtras` 197; set from handoff.ts 4521.
- **Complexity smell:** A module-level mutable flag + env knob to let a forward-eval rollout drop aim probes ("isolate wide branching from probe cost") — an A/B isolation lever carried as global mutable state threaded through `setRolloutContext`.
- **Proposed simplification:** If the isolation experiment is concluded, delete the flag, `setRolloutContext`, and the `!(inRolloutContext && !rolloutAimEnabled)` clause, leaving the aim lane governed by `aimEnumEnabled + nCand>1`.
- **Risk:** low
- **Generalization note:** Module-global mutable flag is a re-entrancy smell.
- **Status:** Abandoned (catalog was wrong: the isolation experiment is NOT concluded — it is the current active pivot of the lookahead campaign. `LR_ROLLOUT_AIM=0` is set live by two eval scripts: `eval_difficulty.sh:93` bakes it into `CANDIDATE_ENV` for the difficulty-aware A/B (most recent commit `15c1acb` "pivot to difficulty-aware config"), and `eval_rollout_shape.sh:95,100` plumbs it via `CAND_ROLLOUT_AIM`. `docs/lookahead-log.md` §8 calls it "the first broad net-positive of the campaign / promising new-default candidate" with next steps still open, and commit `0443a4a` isolates the rollout-aim suppression as the specific live lever. Production default is byte-identical (`rolloutAimEnabled=true` when unset, `inRolloutContext=false`), but the flag/gate/`setRolloutContext` plumbing is a live A/B knob, not dead experiment plumbing. Do not delete.)

### 129. `GEOM_POOL_TELEM` pool-frontier telemetry is embedded default-off in the pool-build hot path
- **Files:** `scripts/v0/optimizer/node.ts`
- **Location:** `recordPoolImpactTelem` 241-277, called from `sortWithLaneExtras` 237.
- **Complexity smell:** A ~35-line JSON-lines study writer inlined into `sortWithLaneExtras` and invoked on every pool build (guarded only by a cached env check), with its own `appendFileSync`.
- **Proposed simplification:** Extract to a study-only hook or remove; if kept, capture the env boolean once and short-circuit before the call. Better, relocate to the studies that consumed it.
- **Risk:** low
- **Generalization note:** Purely diagnostic; belongs outside the hot sort path.
- **Status:** Accepted — byte-identical (160/160 seed=0 track_hashes match baseline at every budget; production default has env unset → true no-op). Thorough repo-wide search found the ONLY references to `recordPoolImpactTelem`/`GEOM_POOL_TELEM` were in `node.ts` itself plus two docs (geometry-log.md describing concluded studies #2/#9, and this catalog); no study_*.ts/eval_*.sh/test/package.json/orchestration sets the env var or parses its JSON-lines output. The studies that consumed it were ad-hoc command-line runs (concluded verdicts), and the only on-disk `.jsonl` artifact is untracked and referenced by nothing — so there was no committed consumer to relocate to. Deleted the ~35-line inlined writer (`recordPoolImpactTelem`, the `_poolTelemPath` cache, the call site in `sortWithLaneExtras`) and the now-unused `appendFileSync` import from the hot sort path.

### 130. `getCandidatesSorted`'s three-way sample-order cache reconciliation is dense and easy to break
- **Files:** `scripts/v0/optimizer/node.ts`
- **Location:** `getCandidatesSorted` 111-165; `solveAdditionalCandidates`/`advanceCandidateRng` 291-319.
- **Complexity smell:** Three branches keyed on `cached.nCand` vs requested: exact-hit, prefix-filter (larger cache), or RNG-replay-forward (`advanceCandidateRng` re-deriving draw counts via `sampleArcParamsRngDraws`) + append. Correctness depends on the RNG-advance exactly mirroring `solveOneGap`'s internal draw sequence — a subtle coupling to support "ask for a bigger prefix later."
- **Proposed simplification:** Consider always sampling a fixed N per node (the header argues candidate count is budget-independent), removing the grow path (`advanceCandidateRng`, `solveAdditionalCandidates`, the `<nCand` branch); keep only exact-hit + prefix-filter (pure branches).
- **Risk:** high
- **Generalization note:** The grow path exists so a required contact can request a larger deterministic prefix; removing it assumes no gap ever needs more than N — check against the current spec set.
- **Status:** Not Started

---

## Misc small modules — `scripts/v0/optimizer/{budget_model,sample}.ts`, `scripts/v0/core/{beats,camera}.ts`

### 131. `budget_model` coefficients are a regression reverse-fit to one 250k golden archive
- **Files:** `scripts/v0/optimizer/budget_model.ts`
- **Location:** `TRAVERSAL_BUDGET_MODEL_V1` 27-33 (interceptFrames 5848.254347, contactFrames 796.19669, durationFrameScale 29.587736, source '...@250k').
- **Complexity smell:** `predictFirstCompletionFrames`/`traversalBudgetSlack` drive several handoff gate thresholds, but the linear model is fit to a single 250k run on the current specs; the large fixed intercept (~5848) dominates at small budgets so slack ratios become meaningless far below the grid; six-digit coefficients are un-re-derivable in-repo.
- **Proposed simplification:** Collapse to a dimensionless `slack = budgetFrames / (a*contacts + b*durationFrames)` with a small documented intercept refit across ALL budget tiers, or demote to a coarse structural estimate (contacts + duration, no six-digit intercept) and widen the slack gate thresholds it feeds.
- **Risk:** medium
- **Generalization note:** Assumes the current population and the 250k fit point; off-grid budgets/specs get biased slack, mis-triggering the low-slack branch gates.
- **Status:** Not Started

### 132. Dead exported budget helpers: `predictSuffixCompletionFrames` + the `Spec|Inputs` union
- **Files:** `scripts/v0/optimizer/budget_model.ts`
- **Location:** `predictSuffixCompletionFrames` 59-76; `traversalBudgetInputs` 35-40 + `isTraversalInputs` 93-95 + the `Spec|TraversalBudgetInputs` union 42-55.
- **Complexity smell:** `predictSuffixCompletionFrames` has zero consumers; `traversalBudgetInputs` is never called, so the `TraversalBudgetInputs` input form + type guard exist only to support an unused path.
- **Proposed simplification:** Delete all three and narrow `predictFirstCompletionFrames`/`traversalBudgetSlack` to take a `Spec`. Removes ~40 lines, no behavior change.
- **Risk:** low
- **Generalization note:** Pure dead code.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Confirmed dead by whole-repo grep: production `handoff.ts` calls `predictFirstCompletionFrames(spec)`/`traversalBudgetSlack(targetBudget, spec)` only with a `Spec`; the Inputs form + `predictSuffixCompletionFrames` had consumers only in `tests/budget_model.test.ts`. Deleted `predictSuffixCompletionFrames`, `traversalBudgetInputs`, `isTraversalInputs`, and the `TraversalBudgetInputs` type; narrowed both public helpers to `Spec` and inlined the input extraction. Updated the test to drop the removed-symbol coverage.

### 133. Dead telemetry: `getPoolEvalFrames` / `poolEvalFrames` accumulator
- **Files:** `scripts/v0/optimizer/sample.ts`
- **Location:** `poolEvalFrames` global 85, reset 90, `getPoolEvalFrames` 98-100, accumulation in `sampleOneCandidate` 186, 191.
- **Complexity smell:** `getPoolEvalFrames` is exported but has no consumer; the accumulation adds two `getPhysicsFrameCount()` reads + a `Math.max` per candidate evaluation (the hottest loop) purely to maintain an unread counter.
- **Proposed simplification:** Delete `poolEvalFrames`, its reset, the getter, and the two accumulation lines. Removes work from the hot path.
- **Risk:** low
- **Generalization note:** Pure telemetry dead code.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Whole-repo grep confirmed `getPoolEvalFrames`/`poolEvalFrames` had zero consumers outside `sample.ts` itself. Deleted the `poolEvalFrames` global, its reset, the exported getter, and the two accumulation lines in `sampleOneCandidate` — removing two `getPhysicsFrameCount()` reads + a `Math.max` per candidate evaluation from the hottest loop (the now-unused `getPhysicsFrameCount` import was also dropped).

### 134. `CandidateProbe.sledPoseDeg` is a memoized closure no decision consumes
- **Files:** `scripts/v0/optimizer/sample.ts`
- **Location:** `CandidateProbe.sledPoseDeg` type 75 + lazy closure in `getCandidateProbe` 133-137.
- **Complexity smell:** Self-described "an available model output — consumed by no decision yet"; no caller invokes it (all consumers read `.targetState`), so the closure and its `getRiderMetered` call never run.
- **Proposed simplification:** Remove the field and closure; a future pose consumer can read `sledPoseDegFromRider` directly.
- **Risk:** low
- **Generalization note:** Speculative unused output.
- **Status:** Accepted — byte-identical (verified via 1-seed/40-spec/4-budget track_hash diff, 160/160 match). Removed the `sledPoseDeg` type field and its lazy closure from `getCandidateProbe`; the closure's `getRiderMetered`/`sledPoseDegFromRider` call never ran (no `.sledPoseDeg(` invocation exists repo-wide; all five `getCandidateProbe` consumers read only `refX`/`refY`/`targetState`/`preTargetSledTrace`). Also dropped the now-unused `sledPoseDegFromRider` import. Escape hatch for a future pose consumer: `sledPoseDegFromRider` remains a live export in `scripts/lib/detector.ts`.

### 135. Legacy impact-migration branch self-flagged for deletion
- **Files:** `scripts/v0/core/beats.ts`
- **Location:** `migrateImpact` + `MIGRATE_AFFINE`/`MIGRATE_SOFT_OLD`/`MIGRATE_SPAN_OLD` env reads 83-92; `withImpactLegacy` 100-108.
- **Complexity smell:** Carries two schemes selected by `LR_IMPACT_MIGRATE`; the 'legacy' branch is documented "Kept only for A/B against affine; to be deleted once the affine re-bake is frozen," plus two study-only env overrides with a divide-by-zero guard.
- **Proposed simplification:** Inline the affine shift as the sole path: `migrateImpact(a) = clamp((a−0.2)/0.8, 0, 1)`; delete the legacy branch, the `LR_IMPACT_MIGRATE` selector, and the SOFT/SPAN overrides. `withImpactLegacy` stays as a thin affine wrapper (2 specs depend on it).
- **Risk:** medium
- **Generalization note:** Touching it re-resolves impact targets for the 2 legacy specs, which can move their scores — verify.
- **Status:** Not Started

### 136. `denseLinearZoomFromLog2Keyframes` ease parameter is never supplied
- **Files:** `scripts/v0/core/camera.ts`
- **Location:** signature 85-89, ease used at 103; both call sites (40, 61) omit it.
- **Complexity smell:** Takes an `ease` callback defaulting to identity, but both callers pass only `(keyframes, durationFrames)`, so the eased path is never exercised — speculative generalization with no user.
- **Proposed simplification:** Drop the `ease` parameter and inline linear interpolation. If per-segment easing is ever wanted it belongs in the keyframe schema.
- **Risk:** low
- **Generalization note:** Unused flexibility.
- **Status:** Abandoned (catalog was wrong: a third call site exists beyond the two in `camera.ts`. `scripts/export.ts:258` passes `zoomEase` as the third arg on the dense per-frame render path — `zoomEase = EASE[zoomEaseName] ?? EASE.cubic` (export.ts 122-123), a **non-identity** cubic ease by default and selectable via `--zoom-ease` to quad/cosine/expo. The eased path is genuinely exercised, so the parameter is not dead. Location note only counted call sites 40/61 inside `camera.ts` and missed the export.ts caller.)

### 137. Express `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES` as a fraction of `targetBudget` instead of a fixed 150k
*(follow-up to #7)*
- **Files:** `scripts/v0/optimizer/handoff.ts`
- **Location:** `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES` (single shared constant introduced by #7); all six consumers: `qualityFuturePreviewPressure`, `matureReuseExtraPressure`, `budgetAwareQualitySampleCount`, `shallowQualityTailThrottlePressure`, `tailCompletionContactWindow`, `releaseVerticalSetupPressure`.
- **Complexity smell:** Entry #7 consolidated four-then-discovered-six identically-valued `150_000` constants into one, but the value itself is still an absolute frame count pinned to the middle of the canonical `{125k,250k,375k,500k}` grid. Every consumer computes a `budget/(budget+SCALE)`-shaped or `(budget-SCALE)/SPAN`-shaped maturity ramp; off-grid (e.g. a 10k or 2M budget spec) "maturity" saturates or never arrives in a way that has no relationship to how hard that spec actually is to compile.
- **Proposed simplification:** Replace the fixed 150_000 with a maturity scale derived from the spec itself (e.g. a multiple of `predictedFirstCompletionFrames` or contact count), so the same qualitative maturity ramp shape reappears at whatever absolute budget is "enough" for that spec — self-scaling off-grid. This is a real behavioral change (not a rename): every one of the six pressures shifts for any spec whose natural completion cost differs from the current golden population's, so it needs full statistical evaluation against the canonical benchmark, not the byte-identical fast path used for #7.
- **Risk:** medium
- **Generalization note:** Same failure mode as #33/#41/#49/#18 elsewhere in this file — absolute frame-count grid anchors that silently misbehave for specs/budgets outside the 125k-500k canonical range.
- **Status:** Not Started

### 138. Stale shell-harness references to the now-deleted `LR_LEAF_RDY_LAMBDA` study knob
*(follow-up to #23)*
- **Files:** `scripts/v0/eval_readiness_leaf.sh`, `scripts/v0/eval_rollout_shape.sh`
- **Location:** whole file (`eval_readiness_leaf.sh` is entirely dedicated to this study); `LR_LEAF_RDY_LAMBDA` usage as a secondary knob in `eval_rollout_shape.sh`.
- **Complexity smell:** Entry #23 deleted `leafReadinessLambda`/`leafReadinessKind` and all consumers from `handoff.ts` (the env var is now read by nothing), but these two study-driver shell scripts still reference `LR_LEAF_RDY_LAMBDA` as if it does something.
- **Proposed simplification:** Delete `eval_readiness_leaf.sh` (its subject no longer exists) and drop the now-inert `LR_LEAF_RDY_LAMBDA` references from `eval_rollout_shape.sh`.
- **Risk:** low
- **Generalization note:** Tooling-only; no compiler behavior involved, no canonical run needed to verify (grep-confirm the env var is unread, then delete).
- **Status:** Accepted — tooling-only, no canonical run needed. Deleted `eval_readiness_leaf.sh` entirely (its `LR_LEAF_RDY_LAMBDA`/`LR_LEAF_RDY_KIND` subject was removed by #23). In `eval_rollout_shape.sh`, dropped the now-inert `CAND_RDY_KIND`/`CAND_RDY_LAMBDA` sweep axis and its `LR_LEAF_RDY_LAMBDA`/`LR_LEAF_RDY_KIND` env wiring, keeping the still-live `CAND_FWD`/`CAND_ROLLOUT_AIM`/`CAND_AIM_ENUM` knobs untouched (`LR_ROLLOUT_AIM` confirmed live by #128). `bash -n` syntax-checked clean.

---

## How to use this file

- Work **top-to-bottom**, or by **risk** (attempt all `low` first, then `medium`, then `high`) — the low-risk dead-code and de-duplication items are the cheapest wins and least likely to move the headline.
- Attempt **one item at a time.** Make the change on a branch, run the canonical golden benchmark, decide with `npm run decide -- --mode=simplification --margin=0.1 --alpha=0.20 CANDIDATE/golden.json BASELINE/golden.json`, and record the outcome.
- When you attempt an item, **update its `Status:` line in place** — `Not Started` → `Accepted` / `Rejected` / `Abandoned` — with a one-line note (step headline Δ, `P(Δ≤-0.1)`, cumulative Δ vs the campaign-start baseline when available, reason for abandoning, follow-up needed). Do **not** add a new section per attempt; this file is the running log.
- Respect the hard invariant: the scorer, golden specs, evaluator/scoring ruler, headline metric, seed set, and budget grid are fixed. Compiler behavior may change; the measuring ruler may not. If a candidate's `evaluator_fingerprint` differs from the baseline's, mark the item out of scope for this campaign.
- Several entries note **cross-references** (e.g. #29↔#72 impact-ask thresholds; #46↔#125/#126 study arms; #64↔#117 reachability probe). Prefer landing the shared/underlying item first, then revisit its dependents.
