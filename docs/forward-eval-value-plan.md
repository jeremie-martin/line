# Forward-Eval Value Plan

2026-08-03 · base `016dfbe` · baseline of record `redraw-on-empty-750k` = **595.97** @ 750k (promotion surface N=32; monitor 596.05 @ N=48) · campaign target 650.

Successor to `docs/budget-unification-plan.md` and `docs/budget-dividends-plan.md` (both CLOSED). Evidence base: two independent Opus 5 read-only audits of 2026-08-03 — a budget-stack audit and a forward-eval mechanism map (raw reports preserved in the session scratchpad under `audits/`; their load-bearing findings are inlined below and their durable content is promoted into repo docs by Phases 0 and 2). Prior measured ground truth: `docs/rollout-economics-study.md` (198-compile grid, 31,494 ground-truth verdict audits).

## Thesis

Three findings define the campaign:

1. **The budget stack is sound and adopted, but mislabeled in three places.** One live deadline signal, one producer, three consumers, predecessor signals deleted — the architecture landed. But the estimator's `interval.*` layer is live policy (it sizes every repair restart ceiling via `estCostUpperOf`, `handoff.ts:2219`), while three documents and the calibrator's default mode treat it as telemetry-only: `--freeze-point-model` alone still refits the bands. And the deadline signal has zero production telemetry — no archive can say how often the ramp engages.

2. **Forward evaluation's real defect is a one-sample existence test, and its remaining prize is correctness bought with frames.** The quality judge admits 5 of `nCand`; rollouts re-rank those 5 (2 under full pressure). 53.3% of hop-1 dead-end verdicts are false (measured on 31,494 audits); dead-decided disagreements are 5–7% of cases but move 52–66% of the value. The redraw-on-empty fix (+0.72, promoted) bought width+1 only. The frames-saved family is closed: the free-judge ceiling is +1.78 ± 1.31.

3. **The high-budget premise is backwards, which is exactly why the wide shape is the right vehicle.** At 2.5M, scores improve (+11 to +74 per source, mean +40) but the rollout frame share *falls* from 17–28% to 6–11%: the breadth law (`nCand = 27·B/250k`, no ceiling) eats the entire dividend — 3.3× budget buys ~1.1× tree and 3.3× per-gap sampling. Forward-eval does not get less starved at high budget by itself; the budget must be spent on it deliberately. A top-k × wide depth-1 evaluation (k≈3, W≈16–24) costs ~24% of a 2.5M compile and is affordable there precisely because ~90% of frames currently go to sampling that is never rolled out. At 750k the same shape costs >100% of the budget — it is a high-budget shape that must be budget-aware by construction.

The campaign: harden the stack and its labeling (Phase 0), land the visibility and easy wins (Phase 1), stand up the measurement layer (Phase 2), adjudicate the smell with a zero-code falsifier and a high-budget PoC (Phase 3), implement the shape family if licensed (Phase 4), integrate budget-aware and push the headline (Phase 5).

## Standing rules (inherited, unchanged)

- The 48-seed benchmark V2 eval (`npm run benchmark -- eval --seeds=48 --jobs=32`) is the gold standard for every behavior change. **The headline is the sole promotion arbiter.**
- Decide output (P(+), CI) is an input to the promotion call, never a hard gate. Default-promote on inconclusive via `rebaseline --force --force-reason=…` when the change is internally sound.
- Intermediate metrics (Phase 2's M-set) are diagnosis, experiment readouts, and falsification devices — never acceptance gates. The anti-gaming annotations travel with the metric definitions.
- Budget-dependent knobs are scale-free laws (`ref · (B/refB)^α`), never per-budget thresholds or benchmark-operating-point ramps. Throttle a magnitude, never trigger a mode.
- Every grid reports its action-set power footer (rule of three on unchanged cells).
- The drift ledger continues (`scratchpad/drift-ledger.txt`); a new era opens at 0 with the standing floor of −3.0.
- Minimal-simulation rule (repo `CLAUDE.md`): rollouts inside DFS forward-eval are the sanctioned exception; any *new* probing reads ballistic exits. Full-path probe modes stay explicitly-flagged comparison arms and never become defaults.
- `compiler_scale_contract` (campaign-baseline scope): compiler mechanisms must remain continuous and meaningful beyond the measured budget, including 150k and 1M–3M; benchmark budget identity must not enter compiler behavior. High-budget work in this plan operates under that contract, not against it.
- Composition rule: sequential same-family candidates re-probe against the current tree before their eval.

## Closed — do not reopen

- The **generation branch** of the dead-end smell: verdict rate and truth are flat across pool rank — falsified (study §4.3).
- **Cheaper rollouts as a family**: capped by the free-judge arm at +1.78 ± 1.31 (study §7). Never chase the frame share down.
- **Global rollout branch widening as a default**: −34.6 (branch 3), −258 (branch 5) — in-code record at `handoff.ts:5577-5585`. Width is only affordable where budget is, and only with the aim lane suppressed.
- **Depth axis** of the capability-debt lane; **repair-acceptance prediction** (both closed in the dividends campaign).
- The 150k regime, except via the named 1.185 corrected-path bias mechanism (thrice-closed).

## Phase 0 — Truth-in-labeling and correctness of the budget stack

**Goal.** Every document and code header states what the code actually does; the calibrator cannot silently change compiler behavior; the two untested promoted mechanisms get tests. No behavior changes in this phase — everything validates as byte-identical output or is doc/test-only.

**Why.** The interval-layer misclassification is the one defect that can cause an unnoticed behavior change through a process everyone believes is safe. The doc bifurcation (`budget-control-design.md` asserts the pre-campaign world) misdirects exactly the reader most likely to act on it.

Work items (file:line references are at base `016dfbe`):

- **0.1 Calibrator safety.** `--freeze-point-model` implies `--freeze-intervals` (`calibrate_budget_estimator.ts:194-212, 612`); an explicit `--refit-intervals` opt-out restores the old behavior with a loud promotion-class warning. Validation: re-run the shipped calibration under the frozen arm; artifact byte-identical.
- **0.2 Reclassify `interval.*` as policy-bound** everywhere it is called telemetry-only: `docs/compile-budget-telemetry.md` layer table and freeze recipe (`:831-841, :852-860, :1371-1375, :1411`), `docs/budget-aware-map.md` PLB-03 (`:1922`), `budget_estimator.ts:1` header. Name the `estCostUpperOf` read (`handoff.ts:2219` → restart choice `:2257`, anchor skip `:2349`, per-restart ceiling `:2372`) in the artifact's consumer list. Note the fingerprint already agrees (artifact ∈ `COMPILER_SOURCE_PATHS`).
- **0.3 `paceSchedule` divergence guard.** `deadline.ts:190-196` overrides the artifact's `"none"` to `"linear_progress"` silently. Add a load-time assert that the artifact still says `"none"` (mirroring `handoff.ts:929-935`) plus a unit test, so a future calibration selecting a third schedule fails fast.
- **0.4 Type-level trap removal.** Drop the default from `structuralRemainingWork`'s `model` parameter (`budget_telemetry.ts:725`) — the default is V1 and taking it silently cost an era once already.
- **0.5 Tests for promoted-but-untested mechanisms.** `redrawFirstHopOnEmpty` (4 call sites, memo-interaction contract, currently zero tests) and the `estCostUpperOf` zero-ceiling guard (`handoff.ts:2223-2231`, failure mode = every repair restart sized at zero frames).
- **0.6 Doc repairs**, per the audit's line-by-line tables: rewrite `budget-control-design.md`'s *Current Implementation* section (it omits `deadline.ts`, says the law is "telemetry only" and that no controller is installed); `scripts/v0/optimizer/README.md:16` ("still budget-oblivious") + Components list; `compile-budget-telemetry.md` coefficient table (`:672-674`), "drives all live policy" (`:676-682`), v1-schema note (`:895-897`, also `budget_estimator.ts:20-21`), artifact name/domain (`:1143`), three-readers (`:411-418`), fitted-kinds (`:620-623`); `budget-aware-map.md` §2g RETIRED re-stamp, the four stale CONFIRMED bullets (`:434-448`), PLB-04's "last binary thresholds", H2's renamed flag (`aimLaneDeadlineThrottled`), the missing `05cc801`/`69d71a8` ledger entries, the machine-enforced same-share rule; the three overtaken unification-register rows (`:416, :417, :421`); the dividends-register `:698` premise; `rollout-economics-study.md` 46.7% residues at `:629`/`:724`.
- **0.7 File, don't fix here:** the five scale-free offenders (d1 `HANDOFF_LOW_SLACK_BRANCH_THRESHOLD` binary gate; d2 opening slack ramps; d3 `IMPACT_BEST_FWD_START_FRAMES=300k` benchmark-point ramp; d4 dead mature ramp; d5 aim gates) and the two coordinate contaminations (c1 double-counted B in `impactBestForwardEvalConfig:6422-6428`; c2 tail-completion lane at `budgetSlack=0`, `handoff.ts:4747-4757`). d1/d3/c1 are rollout-shaped and belong to Phase 4; c2 is Phase 1's one behavior candidate; d2/d4/d5 get register rows with the fix shape named. Also update the `handoff.ts:18-49` group-inventory header to cover d3/d4.

**Exit criteria.** All named edits landed; `npm test` green; one 750k compile diffed byte-identical on track JSON (compiler-source edits change the fingerprint — expected — but not the output); frozen-arm calibration byte-identical; no doc asserts the opposite of shipped architecture.

## Phase 1 — Deadline visibility and easy wins

**Goal.** The deadline signal becomes visible in every archive; the latent margin defect is fixed before anything consumes it; the mechanical wins land. One behavior decision (c2) goes through the gold standard.

Work items:

- **1.1 Deadline telemetry in `compile_stats`.** Accumulate at the consumer read (`handoff.ts:3939`): pool builds, builds with pressure > 0, builds at full pressure, mean/min margin, plus a **terminal-without-improvement counter** (the two-counters window: structural terminals that did not improve the register, `handoff.ts:1678-1682` vs `register.ts:74-80`) so the frequency of the estimator-target/controller-phase divergence is finally measured. Counters-only ⇒ byte-identical tracks. This unblocks the parked `1.25/2.0` re-bracket and pace re-price, and gives Phase 3 its M9 companion.
- **1.2 Fix the pre-repair post-completion margin.** `handoff.ts:1891` passes `costToEnd: null` until `runRepairPhase` assigns `incumbentCostToEnd` (`:2141`), so between first completion and repair the pace term projects compile-global spend over per-node progress and the margin collapses on healthy nodes. Supply the incumbent cost at adoption time (or an explicit documented fallback). Latent today (no post-completion consumers), so validation = unit test + byte-identical; mandatory before Phase 5 wires any post-completion consumer.
- **1.3 `describe_budget_telemetry` completeness.** Add the three always-present repair fields to `KNOWN_ATTEMPT`; render (not just recognize) `hard_remaining_frames` and `structural_progress_fraction` — the margin's numerator and the pace-blend weight; label the two differently-defined slack lines. Extend the tests.
- **1.4 Hot-path hygiene.** Bind the four per-node/per-pool `process.env` reads via `compileScopedEnv` (`onlineContinuationEnabled`, `LR_POST_COMPLETION_FWD_STAGE_TOP`, `LR_PRECOMPLETION_FWD_EVAL`, `LR_IMPACT_BEST_FWD`; ~268 ns each). **Do not delete `stagedForwardEval`** (the audit's win #9 is superseded): its two-pass plumbing is Phase 4's k-mechanism.
- **1.5 Naming and small fixes.** Rename `arc_placement.ts`'s unrelated `deadlinePressure` (→ authored-frames scarcity name) and the `shortDeadlineRescue*` helpers; restore-not-clear in `forwardFirstWidenedScore:6196-6202`; robust CLI-entry check + `--jobs` guard in `low_budget_reading.ts`; npm alias for the calibrator; stale `300k` comments; move `structuralRemainingWork` out of the recorder module. All byte-identical.
- **1.6 The behavior candidate: c2.** Decide the tail-completion `budgetSlack` omission (bug or undocumented policy). If changed: 48-seed gold standard, standard promotion posture. If kept: a comment stating why the first-completion lane sees a maximally-starved compile.

**Exit criteria.** Deadline + terminal-window counters present in `.stats.json` and v2 archives (verified on one real eval shard); 1.2 unit-tested; c2 decided with its eval verdict recorded here; everything else byte-identical; `npm test` green.

## Phase 2 — The measurement layer

**Goal.** A documented, standing metric set for forward-eval quality, extractable from any archive with one command; the study instrumentation committed and compiling; the L3 residue numbers collected. Headline remains the only promotion metric — this layer exists for deep understanding.

Work items:

- **2.1 Metrics reference.** New `docs/forward-eval-metrics.md`: the M-set (M0 headline · M1 rollout frame share · M2 frames/rollout by shape · M3 redraw refutation rate · M4 redraw trigger + residual dead-end rate · M5 top-1 agreement + winner quality-rank · M6 disagreement value gap · M7 decisions changed per kiloframe · M8 budget conversion: nodes expanded, first-completion/B, nCand · M9 continuation-filter firing rate · M10 ground-truth verified-true rate), each with definition, question answered, cost tier, and failure modes. The ⚠ annotations are part of the contract: M1 down is capped at +1.78, M5 has no good direction, M6's currency has no exchange rate to headline points — flagged so nobody optimizes a proxy.
- **2.2 The thermometer.** `fwd_rollout_redraw_refuted / fwd_rollout_redraws` is a free, always-on, per-compile estimate of verdict falsity at width+1 that already ships and has never been read — spot-checked at 2.5M it reproduces the study's terrain ordering (capability lowest, representative highest) with zero probe cost. Build the Tier-1 reader: a small analyzer (npm script) over `.stats.json` / `golden.json` / v2 run archives printing M1–M8 per (source, budget, arm), with the DX bar of the low-budget reading: clear terminal output, a written record, an append-only history.
- **2.3 Recommit the study instrumentation.** `scripts/v0/study_rollout_economics.ts` is committed but does not compile at HEAD — it imports `setHandoffRolloutProbeHook`/`setHandoffExpansionProbeHook`, which were never committed on any branch. Rebase the observation-hooks patch (base pre-dates redraw-on-empty; 4 hunks conflict) with the required semantic upgrade: post-L1 outcome classes must distinguish *empty-at-base-width* / *refuted-by-redraw* / *still-empty* (`dead_hop1_refuted`). Commit hooks + study together; re-verify identity 198/198 on trackHash + full_score + sim_frames.
- **2.4 L3 residue.** `setHandoffDeadlineProbeHook` already carries `onlineContinuationApplied` — run the hooked grid: continuation-filter firing rate × stratum × budget, and verified-true rate restricted to verdicts the filter acts on. Observation only; files the register row.

**Exit criteria.** `docs/forward-eval-metrics.md` merged; the Tier-1 reader runs against an existing archive and the standing thermometer's numbers are in the record; the study compiles at HEAD with identity re-verified; L3 numbers filed in the metrics doc.

## Phase 3 — Falsifier and high-budget proof of concept

**Goal.** Adjudicate the smell before writing shape code: test the sharp prediction the false-verdict story makes, and characterize what 2M+ budgets actually buy. Indicative, never promotable — 3 seeds is far below the eval-slot floor, and nothing in this phase changes a default.

Work items:

- **3.1 The zero-code falsifier.** `eval_rollout_shape.sh` with `CAND_FWD=best:1:8 CAND_ROLLOUT_AIM=0`, `BUDGETS=750000,2500000`, `SEEDS=0,1,2`, on the six-source panel: `frontier_dense_recovery` (64.4% verdicts true — the control that should *not* improve), `frontier_low_air_endurance` (78.1% dead-end rate), `high_air_drive` (5.3% true — should improve most), `sparse_lowline` (19.0%), `dense_dialogue` (45.5%), `regression_transition_mosaic` (legacy composition check). W=8 is the current clamp, so this needs no code and spans a 4× width increase (~4 min at jobs=16). Third arm: `LR_IMPACT_BEST_FWD=0` on baseline, because any `LR_FWD_EVAL` override silently drops the adaptive arms including the +4.59 impact widening — the confound must be priced, not ignored.
  **The prediction is one-sided and falsifiable:** representative sources gain, the capability frontier does not, and M3 (redraw refutation) falls in the wide arm because width absorbs the empties before the redraw sees them. If the sign-split does not appear — helps everywhere, nowhere, or capability most — the one-sample-artifact story is not what width exploits: stop, record, re-diagnose before any clamp lift.
- **3.2 The high-budget PoC grid.** Same panel, budgets {750k, 2.5M}, baseline vs wide arms (~72 compiles, ~4 min at jobs=16, RSS ~0.6 GB/compile — cap jobs accordingly). Readout: M0 (indicative) + M8 (does the budget reach the search?) + M1 (did the arm buy rollout frames?) + M3/M4 (did width kill the false verdicts?), M5/M6 as colour. Power footer on the grid even though it is indicative.
- **3.3 The budget-conversion account.** Write down, with numbers from 3.2, where a 2M+ budget goes at HEAD: nCand growth (81 → 270 at 2.5M) vs nodes expanded (~flat) vs first-completion frame (~linear in B) vs rollout share (falls to 6–11%). Also characterize the regime the PoC runs in: deadline pressure is structurally dormant at high budget (margin ∝ B^0.175 — expected under the law, document it); slack 14–17 saturates the impact/opening ramps and half-opens opening-branch3, i.e. 2M+ activates adaptive arms never measured together; the estimator extrapolates cleanly outside [250k, 1.5M] (labeled EXT, no clamp, verified). Spot-bound the known 1M non-monotonicity on the panel sources.
- **3.4 If a width dose-response is needed beyond W=8**, the clamp lift is a Phase 4 enabler — pull it forward only for the study arm, flagged, never as a default.

**Exit criteria.** The falsifier's outcome recorded in this file (sign-split present/absent, with the three-arm decomposition); the budget-conversion account written; a go/no-go for Phase 4 stated with its evidence. Wall-clock planning uses the measured 13–17 µs/frame end-to-end rate, not the 9,458 ns/frame harness figure.

## Phase 4 — Shape implementation and trials (licensed by Phase 3)

**Goal.** Implement the top-k × wide depth-1 family properly and run the shape trials at the budgets where the shape is affordable. Candidates come out ranked with paired-grid pricing; the best go to Phase 5.

Work items:

- **4.1 Enablers**, in dependency order, all inside the declared forward-eval fence (`handoff.ts:5507-5517`):
  (a) branch clamp 8 → 64 in `parseRolloutShape:5849`;
  (b) scoped aim suppression (save/restore, mirroring `:6196-6202`) around the wide `getCandidatesSorted` in `forwardRolloutScore` and `forwardAvgNextScore` — non-optional: the aim lane is 4.6× cost and zero refutation value, and unsuppressed width is the documented −34.6/−258 failure;
  (c) the k-mechanism: generalize `stagedForwardEval`'s two-pass plumbing (`:3969-3994`) — cheap pass over the admitted pool, promote top-k to the expensive shape — lifting its post-completion restriction; never edit `HANDOFF_FORWARD_EVAL_TOP` itself (load-time share assert);
  (d) aggregation reducers (median, top-m-mean) beside mean/max at `:6243-6245`;
  (e) composability: a shape override must not silently disable the adaptive arms — either make the override compose with `defaultConfig` gating or have every arm state explicitly which regime it ran.
- **4.2 Trials.** k × W × aggregation grid on the Phase 3 panel at {750k, 2.5M}; then the register candidates that are the same mechanism spent differently, priced against the shape family rather than separately: **L2 impact-widening re-scope** (the 62.8%-of-rollout-frames arm — narrow it and spend the frames on width where verdicts are false), the **dose ladder** (redraw widths 3/5), **hop-2 verdicts** (5.6% of calls, same construction). The d1/d3/c1 offenders are re-shaped here where the winning mechanism touches them (d3's 300k ramp is exactly the impact-widening gate).
- **4.3 Constraints.** Magnitudes, not modes; k and W enter as laws — of the deadline margin / affordability machinery or of B scale-free — never as per-budget constants (d3's own docstring is the named anti-pattern). Stale-sweep rule: a shape change re-prices its neighbours (`HANDOFF_CANDIDATE_POOL`, `HANDOFF_BRANCHING`, `HANDOFF_FORWARD_EVAL_TOP` brackets are stale where the mechanism changed what they mean — re-probe only those).

**Exit criteria.** Ranked candidate list with paired pricing, power footers, and each arm's regime (adaptive arms on/off) stated; 1–3 candidates nominated for Phase 5 with predicted headline effect and cost; negative results recorded with the same care.

## Phase 5 — Budget-aware production integration and promotion

**Goal.** The winning shape wired into the compiler as a budget-aware law, taken through the gold standard, promoted; the campaign closed with the docs and the map re-reconciled.

Work items:

- **5.1 Production wiring.** Rollout spend becomes an affordability decision read from the one deadline/budget coordinate system (the shape's k/W throttled by margin or by the scale-free law — Phase 4 decides which formulation the evidence supports), continuous 150k–3M per the scale contract. Pre-requisite 1.2 (margin validity post-completion) already landed. No benchmark-point constants.
- **5.2 Promotion ladder.** Per candidate: composition re-probe → 48-seed eval → promotion call under the standing posture (default-promote on inconclusive; investigate-not-reject on implementation doubts). Standard promotion routine: `rebaseline` (with `--force` where inconclusive), test pins (headline ×2 + display string), promotionSeeds pin, canary re-stamp if runner-adjacent files moved, `baseline-cache extend --seeds=48` after mid-ladder accepts, drift-ledger entry, low-budget standing reading era stamp.
- **5.3 Close-out.** Re-reconcile `budget-aware-map.md` (new SC/PLB entries for the shape family) and `forward-eval-metrics.md` against what shipped; verdict per success criterion; follow-up register for what remains.

**Exit criteria.** ≥1 shape-family candidate through the gold standard with its verdict recorded; headline ≥ baseline of record or the ledger explains why the accepted trade is right; all five success criteria scored; register written.

## Success criteria

1. **Truth-in-labeling closed.** `interval.*` classified policy-bound everywhere; calibrator safe-by-default (frozen arm byte-identical); `budget-control-design.md` and the optimizer README describe the shipped architecture; the two untested promoted mechanisms have tests.
2. **The deadline signal is visible.** Every eval archive carries deadline pressure/margin counters and the terminal-without-improvement counter; the parked `1.25/2.0` re-bracket and pace re-price have data to run on.
3. **The measurement layer stands.** M-set documented with anti-gaming contracts; Tier-1 metrics one command from any archive; the committed study compiles with identity re-verified 198/198; L3's firing-rate numbers filed.
4. **The smell is adjudicated with evidence.** The sign-split prediction tested three-armed and its outcome recorded; the budget-conversion account written (where 2M+ frames actually go); the false-verdict mechanism either confirmed as exploitable by width or the story revised.
5. **The headline moved through the gold standard.** At least one shape-family candidate evaluated at N=48 with the campaign ledger closing ≥ −3.0, every arm's verdict recorded — including the negatives.
6. **The continuation mandate is met**: the campaign does not close below a headline of **620** (see the final section).

## Hazards (priced up front)

- **The breadth law eats the dividend** (measured): high-budget arms must spend frames on the rollout deliberately; hoping starvation relaxes by itself is refuted.
- **Free-judge ceiling +1.78 ± 1.31**: any candidate whose story is "saves rollout frames" is capped there — reject the framing early.
- **Leaf value has no exchange rate to headline points** (study's own refusal): M6 movement is colour, never evidence.
- **Aim lane in wide builds = 4.6× cost, zero refutation value**: every wide arm suppresses it scoped; the historical −34.6/−258 was unsuppressed width.
- **`LR_FWD_EVAL` set at all disables all three adaptive arms** (including the +4.59 impact widening): every arm states its regime; production integration must compose, not env-override.
- **1M is non-monotone per source** (67/176 cells worse than 750k): the PoC brackets it, and no high-budget conclusion extrapolates through it untested.
- **Clamps**: rollout width hard-capped at 8 (`parseRolloutShape`), `LR_QUALITY_NCAND` capped at 64 (pinning nCand ≥ 81 needs code) — both are Phase 4 enablers, neither may move silently.
- **Harness bounds**: worker timeout caps at 600 s (binds above ~8M frames); ~0.6 GB RSS per 2M compile — size `--jobs` to memory; `eval_rollout_shape.sh`'s frozen baseline is fingerprinted — rebuild it after any compiler edit; `--flag=value` equals-form only.
- **Two-counters window** (terminal-without-improvement): until 1.1 measures its frequency, high-budget pacing conclusions near completion carry that caveat.

## Continuation mandate — keep pushing to 620

The phases above are the route, not the destination. **The campaign does not close below a headline of 620** (baseline of record 595.97, so ≥ +24 through the gold standard). If the shape family alone doesn't get there, keep iterating in the spirit of the plan — understand → falsify cheaply → implement as a law → 48-seed eval → promote — cycling Phases 3→4→5 with new hypotheses rather than declaring done after one pass. Every arm's verdict, including negatives, keeps getting recorded here; the drift-ledger floor and the standing posture (default-promote on inconclusive, investigate-not-reject) stay in force throughout.

Veins to mine when the current one thins, in rough order of evidence-backed promise:

- **Spend where the verdict decides.** Dead-decided disagreements are 5–7% of cases but move 52–66% of the value, and literal dead-end verdicts are only 13–20% of rollout calls — so width targeted at *would-be dead verdicts only* buys most of the correction at a fraction of blanket-wide cost. The dose ladder (redraw widths 3/5) and hop-2 verdicts (same construction, 5.6% of calls) are the same vein.
- **Re-split the budget between breadth and rollouts as a law.** The uncapped linear breadth law is why high budgets starve forward-eval. A scale-free re-bracket of the breadth exponent (sublinear `nCand ∝ B^α`, α < 1) against a rollout-width law spending the freed frames is the direct fix for the measured conversion failure — one law traded against another, both continuous 150k–3M, never a threshold.
- **L2 impact-widening re-scope**, already priced at +4.59 ± 2.20: the `firstBranch=3` arm is 62.8% of all rollout frames at 750k; narrowing it and spending the frames where verdicts are false buys ~20× per frame.
- **Turn on the post-completion consumers.** ~46% of frames are spent post-completion and unpaced; once 1.2 (margin validity) and 1.1 (telemetry) have landed, the deadline signal can throttle post-completion spend the same way it throttles pre-completion — the dividends campaign left this door open deliberately.
- **The two-counters window.** If 1.1 measures the terminal-without-improvement window as frequent, aligning the controller's phase flip with the estimator's target event is a correctness fix with headline upside near the completion knee.
- **The parked re-brackets** once deadline telemetry exists: `1.25/2.0` margin anchors, the pace-term re-price, the `N_CAND_FLOOR` bracket — each cheap, each currently blocked only on data.
- **If the search-side pool runs dry before 620**, the largest known adjacent pool is the scoring-axis error budget (impact-axis bias ≈ 54% of weighted SSE, historically worth ~+67 at the then-baseline; `docs/` + the error-budget memory). It was deliberately kept out of this campaign's scope — escalating to it is an owner decision, flagged here so the option is never forgotten rather than silently taken.

The stop condition is a headline ≥ 620 on the promoted baseline of record, or an owner decision to redirect. Nothing else — not a dry falsifier, not a rejected candidate, not an exhausted phase list — ends the campaign.
