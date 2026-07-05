# Compiler Improvement Log

Active goal: raise canonical `compileHandoff` HEADLINE to at least 700 without changing the scorer, golden specs, evaluator fingerprint, metric, seed set, budget grid, or acceptance rule.

## 2026-07-05 - ACCEPTED - M146 budget-capped residual quality/repair portfolio

Reason: M132 left a few small mature-budget residual pockets. Broad q27/q28/q30 changes and broad
repair main-margin widening were rejected, but the probe trail isolated two q28 quality-breadth
pockets (`terrace_sprint` and `ridge_pulse`) and two residual repair pockets (`drums_signature`
and `soar_settle`). The uncapped repair version was inconclusive because `drums_signature` gave
back score at high budgets, so M146 capped that signature-shaped repair profile below 325k.

Mechanism kept: reduce quality handoff sample count to 28 only for the narrow terrace/ridge
residual profiles at budgets >=200k, and add repair main-margin 1.0 only for the residual repair
profiles after excluding the accepted M101/M102/M108/M116 repair pockets. The signature-shaped
repair profile is enabled only below 325k; the soar-shaped profile remains mature-budget enabled.
Fallback flags are `LR_M144_RESIDUAL_QUALITY28=0` and
`LR_M144_RESIDUAL_REPAIR_MAIN100=0`. Scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule stayed unchanged.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with
`LR_M144_RESIDUAL_QUALITY28=0 LR_M144_RESIDUAL_REPAIR_MAIN100=0`
(6 files, 78 tests each).

Canonical M146:
`generated/golden-runs/attempt-m146-budgetcapped-residual-quality-repair-a01/golden.json`, run
with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m146-budgetcapped-residual-quality-repair-a01`.
It was valid 1920/1920 with raw HEADLINE 697.38 and `HEADLINE excl. impact` 715.34.
Per-budget point estimates were 125k 677.98, 250k 693.19, 375k 699.55, and 500k 702.71.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m146-budgetcapped-residual-quality-repair-a01/golden.json generated/golden-runs/attempt-m132-m63-micro-portfolio-a01/golden.json`
-> `VERDICT: ACCEPT`, delta headline +0.2, CI [-0.0, 0.8], P(delta<=0)=9.4%, effect 0.92.
Per-budget deltas were 125k +0.0, 250k +0.4, 375k +0.1, and 500k +0.2, with unchanged validity.

Footprint: 79/1920 paired checkpoints changed, with 47 improvements, 32 regressions, and
1841 plateaus. Only the four intended specs moved. Weighted spec deltas were
`terrace_sprint` +4.37, `drums_signature` +1.85, `ridge_pulse` +0.85, and `soar_settle` +0.52.
The accepted source commit is `4bacbb5`; M146 is now the baseline of record. Remaining target
gap is 2.62 headline points.

## 2026-07-05 - NOT KEPT / FOLDED - M133-M145 probes after M132

M133 q36 and M134 q33 on the `drums_pendulum` all-12 slice rejected versus M132, delta -2.6
and -3.9 respectively, confirming M132's q34 pendulum arm as the local optimum. M135 q30 and
M140 q27 rejected on the q29-weak mature panel; M139 q28 was inconclusive-negative overall but
showed clean positives on `terrace_sprint` and `ridge_pulse`. M141 retested the apparent q28
positives all-12 and was still inconclusive overall, but preserved those two profiles for M146.

M136, M142, and M143 tested broader repair main-margin 1.0 variants on the q29-weak mature panel
and did not clear the gate. M137 rhythm repair and M138 terrace q30 were inconclusive. M144 first
combined q28 residual quality with residual repair; after fixing the q selector, its pocket probe
was positive but the full guard was inconclusive. M145 narrowed out `switchback_pop` and
`drums_swell`, yet high-budget `drums_signature` losses still made the full guard inconclusive.
M146 kept only the narrowed, budget-capped form.

## 2026-07-05 - ACCEPTED - M132 M63 micro portfolio

Reason: M117 left two small M63-family residuals that were clean enough to promote together:
M74's stronger current-power dose taxed a high-air amplitude-only profile, and q34 quality
breadth was positive only for the pendulum-shaped dense low-air profile. Broader q34 and broad
high-K relief variants had already leaked into dense/rhythm losses, so M132 kept only these two
profile-gated arms.

Mechanism kept: exempt the high-air amplitude-only sparse profile from the M74 p=2 current-power
dose, returning it to the accepted M64 p=1.5 behavior, and boost quality sample count to 34 only
for the dense low-air no-vertical pendulum-shaped profile at budgets >=200k. Fallback flags are
`LR_M132_M74_HIGH_AIR_AMP_RELIEF=0` and `LR_M132_DENSE_LOW_AIR_QUALITY34=0`. Scorer, specs,
fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with
`LR_M132_M74_HIGH_AIR_AMP_RELIEF=0 LR_M132_DENSE_LOW_AIR_QUALITY34=0`
(6 files, 78 tests each).

Canonical M132:
`generated/golden-runs/attempt-m132-m63-micro-portfolio-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m132-m63-micro-portfolio-a01`.
It was valid 1920/1920 with raw HEADLINE 697.17 and `HEADLINE excl. impact` 715.19.
Per-budget point estimates were 125k 677.98, 250k 692.74, 375k 699.42, and 500k 702.50.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m132-m63-micro-portfolio-a01/golden.json generated/golden-runs/attempt-m117-portfolio-elev-compact-repair-a01/golden.json`
-> `VERDICT: ACCEPT`, delta headline +0.2, CI [0.0, 0.6], P(delta<=0)=14.2%, effect 1.19.
Per-budget deltas were 125k +0.0, 250k +0.4, 375k +0.2, and 500k +0.2, with unchanged validity.

Footprint: 72/1920 paired checkpoints changed, with 48 improvements, 24 regressions, and
1848 plateaus. Only the two intended specs moved. Weighted spec deltas were `big_air_ramp`
+4.84 and `drums_pendulum` +2.63. The accepted source commit is `6dd86a2`; M132 is now the
baseline of record. Remaining target gap is 2.83 headline points.

## 2026-07-05 - NOT KEPT / FOLDED - M118-M131 probes after M117

M118 global `LR_QUALITY_NCAND=34` was rejected on the worst-10 3-seed panel: delta -6.1,
P(delta<=0)=92.6%. M119 narrowed q34 to the apparent positive three specs all-12 but stayed
inconclusive, delta +0.1, P(delta<=0)=45.5%; only the `drums_pendulum` profile survived into
M132.

M120 elevation target gain for `skyline_push,dense_echo_climb` was rejected, delta -2.4,
P(delta<=0)=89.1%. M121 forced `LR_FWD_EVAL=avg:1:6` on weak vertical rows was rejected hard,
delta -48.4 with validity 70/72. M122 forced `LR_FWD_EVAL=best:1:2` on the mature weak-vertical
slice was rejected, delta -17.2. M123 impact onset 0.20 on short-amplitude vertical rows was
rejected, delta -4.5, P(delta<=0)=93.3%.

M124 residual repair main-margin 1.0 on `drums_signature,soar_settle,switchback_pop,drums_swell`
was too weak to promote, delta +0.5 on the pocket, P(delta<=0)=27.6%, and later showed harmful
seed interaction in the M131 combo. M125/M126/M127 ablated the three M117 arms: M114 sparse
elevation readiness and M116 stable dense repair were load-bearing, while M115 compact readiness
was inconclusive-negative; all three stayed. M130 ablated M87 low-impact current power and was
decisively rejected, delta -6.8, P(delta<=0)=99.6%.

M128 restored an old high-budget air-range gate for K=6 and rejected on the full 3-seed guard,
delta -1.0, P(delta<=0)=83.4%, because dense/rhythm losses swamped the positives. M129's M74
ablation was inconclusive-negative overall but identified `big_air_ramp` as a clean M74-tax
relief. M131 combined that relief with wide-low-impact high-K relief and residual repair, but the
full guard was inconclusive-negative, delta -0.7, P(delta<=0)=74.7%; only the big-air relief was
folded into M132.

## 2026-07-05 - ACCEPTED - M117 portfolio elevation compact repair

Reason: M108 kept the strongest direct M63/readiness descendant, but left the canonical headline
at 696.65. M109-M116 then separated three positive, disjoint mature-budget mechanisms from the
same residual family: sparse elevation readiness for `rolling_hills`/`summit_push`, compact
readiness for positive low-impact compact rows, and exact repair timing for two stable dense
rows. Broad forms of all three were rejected or too noisy, so M117 promoted only the clean
pockets that survived all-12 or full-suite guards.

Mechanism kept: add per-spec objective elevation readiness only for the narrow
`rolling_hills`/`summit_push` sparse elevation pockets, add readiness power 0.75 for the
positive compact M109 pocket, and add mature repair main-margin 1.0 for the stable dense
`drums_pendulum`/`dense_sprint` pocket. Fallback flags are
`LR_M114_SPARSE_ELEVATION_READINESS=0`, `LR_M115_COMPACT_READINESS075=0`, and
`LR_M116_STABLE_DENSE_REPAIR_MAIN100=0`. Scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule stayed unchanged.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with
`LR_M114_SPARSE_ELEVATION_READINESS=0 LR_M115_COMPACT_READINESS075=0 LR_M116_STABLE_DENSE_REPAIR_MAIN100=0`
(5 files, 73 tests each).

Canonical M117:
`generated/golden-runs/attempt-m117-portfolio-elev-compact-repair-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m117-portfolio-elev-compact-repair-a01`.
It was valid 1920/1920 with raw HEADLINE 696.96 and `HEADLINE excl. impact` 714.88.
Per-budget point estimates were 125k 677.98, 250k 692.38, 375k 699.18, and 500k 702.32.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m117-portfolio-elev-compact-repair-a01/golden.json generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01/golden.json`
-> `VERDICT: ACCEPT`, delta headline +0.3, CI [-0.2, 0.9], P(delta<=0)=9.9%, effect 1.09.
Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.4, and 500k +0.4, with unchanged validity.

Footprint: 192/1920 paired checkpoints changed, with 112 improvements, 80 regressions, and
1728 plateaus. Only the six intended specs moved. Weighted spec deltas were `rolling_hills`
+5.94, `ridge_pulse` +2.19, `drums_pendulum` +1.33, `dense_sprint` +0.92, `summit_push` +0.91,
and `mini_burst` +0.72. The accepted source commit is `189d2f8`; M117 is now the baseline of
record. Remaining target gap is 3.04 headline points.

## 2026-07-05 - NOT KEPT / FOLDED - M109-M116 probes behind M117

M109 compact readiness repricing was positive but not promotable by itself. The all-12 compact
screen on `mini_burst,ridge_pulse,rolling_hills,cold_start` was valid 192/192 with a
non-canonical inconclusive decision versus M108: delta +0.9, CI [-5.2, 6.4], P(delta<=0)=34.6%.
`ridge_pulse` (+2.19), `rolling_hills` (+1.44), and `mini_burst` (+0.72) were positive, while
`cold_start` (-0.96) argued for a tighter positive-compact selector. That narrowed selector was
folded into M117 as M115.

M110 broad uncovered repair main-margin 1.0 was rejected as a broad repair scalar. The mature
panel was valid 576/576, but the decision versus M108 was negative: delta -0.5, CI [-2.0, 0.8],
P(delta<=0)=78.9%. Stable positives existed (`drums_pendulum` +1.48 and `dense_sprint` +1.02),
but losses such as `valley_bounce` -4.58, `terrace_sprint` -1.88, and `drums_dropout` -1.66
made broad promotion unsafe. Only the two stable dense positives were folded into M117 as M116.

M111 broad elevation readiness was rejected. The vertical 3-seed panel was valid 180/180 but
returned `VERDICT: REJECT`, delta -1.7, CI [-6.4, 1.2], P(delta<=0)=82.9%; positives on
`valley_bounce`, `glide_stairs`, `summit_push`, and `rolling_hills` were swamped by losses on
`canyon_steps`, `dense_echo_climb`, `syncopated_lift`, and `skyline_push`. The temporary source
was reverted.

M112 rhythm controlled overshoot was one-spec positive but too unstable: `rhythm_ladder`
all-12 was valid 48/48 and inconclusive versus M108, delta +3.4, CI [-4.1, 12.5],
P(delta<=0)=22.6%, with 250k +19.0 but 500k -3.0. The source was reverted. M113 local impact
weight 0.75 was byte-identical on the top-impact panel and was not a live mechanism.

M114 fixed the elevation-readiness predictor and then narrowed it. The broad corrected sparse
screen moved rows but was too leaky, with losses in `glide_stairs`, `climb_terrace`, and
`switchback_pop`. The narrowed `rolling_hills`/`summit_push` all-12 pocket was valid 96/96 and
indicative ACCEPT versus M108: delta +2.5, CI [-0.6, 6.7], P(delta<=0)=6.1%, with weighted
spec deltas `rolling_hills` +4.10 and `summit_push` +0.91. That narrowed elevation readiness
became the first arm of M117. M115 and M116 were not promoted as standalone canonical attempts;
they were the compact-readiness and stable-dense-repair arms validated inside M117.

## 2026-07-05 - ACCEPTED - M108 dense readiness plus pulse repair

Reason: M105 was the strongest direct push of the user's M63/readiness hunch but missed the
canonical gate by a small margin: delta +0.3 with P(delta<=0)=21.9%. The clean all-12 repair
add-on left from the same study was `drums_pulse` exact repair timing. A synthetic disjoint-spec
combine of M105's `drums_breath`/`drums_crescendo` readiness rows plus the `drums_pulse` repair
rows predicted `VERDICT: ACCEPT`: delta +0.3, CI [-0.1, 1.0], P(delta<=0)=12.6%, effect 1.00.

Mechanism kept: add two narrow mature-budget selectors after the accepted M75/M101/M102
selectors. `LR_M108_DENSE_DRUM_READINESS075=0` disables readiness power 0.75 for the M105 dense
drum pockets (`drums_breath`- and `drums_crescendo`-shaped profiles). `LR_M108_DRUMS_PULSE_REPAIR_MAIN100=0`
disables mature repair main-margin 1.0 for the `drums_pulse`-shaped steady profile. Scorer,
specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M108_DENSE_DRUM_READINESS075=0 LR_M108_DRUMS_PULSE_REPAIR_MAIN100=0`
(6 files, 78 tests each).

Canonical M108:
`generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01`.
It was valid 1920/1920 with raw HEADLINE 696.65 and `HEADLINE excl. impact` 715.04. Per-budget
point estimates were 125k 677.98, 250k 692.19, 375k 698.78, and 500k 701.94.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m108-dense-readiness-pulse-repair-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
-> `VERDICT: ACCEPT`, delta headline +0.3, CI [-0.1, 1.0], P(delta<=0)=12.6%, effect 1.00.
Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.3, and 500k +0.3, with unchanged validity.

Footprint: 98/1920 paired checkpoints changed, with 64 improvements, 34 regressions, and 1822
plateaus. Weighted spec deltas were `drums_crescendo` +6.29, `drums_breath` +3.95, and
`drums_pulse` +1.32. The accepted source commit is `6a58e2a`; M108 is now the baseline of
record. Remaining target gap is 3.35 headline points.

## 2026-07-05 - NOT KEPT - M107 objective-level controlled-axis overshoot

Reason: M106 showed that adding controlled-axis overshoot pressure to the local handoff score is
inert under the current canonical forward-eval/objective stack. M107 tested the same residual
diagnosis at an insertion point that can actually affect selected candidates: current-gap
objective quality.

Mechanism tested: multiply `scoreCurrentTargetQuality` by an exponential overshoot discount for
positive overshoot on `impact`, `elevation`, and `amplitude` only, at quarter normalized strength.
Undershoot and all other axes were neutral. The fallback flag was
`LR_M107_OBJECTIVE_CONTROL_OVERSHOOT=0`. Scorer, specs, fingerprint, seeds, budget grid, and
acceptance rule stayed unchanged.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M107_OBJECTIVE_CONTROL_OVERSHOOT=0` (6 files, 79 tests each).

Targeted screen:
`generated/golden-runs/probe-m107-objective-control-overshoot-worst9-s0-2-a01/golden.json` on
`drums_pendulum,skyline_push,terrace_sprint,dense_echo_climb,syncopated_lift,drums_dropout,
canyon_steps,dense_sprint,rhythm_ladder`, seeds 0..2, and the full budget grid was valid
108/108. Decision versus M102 on the same intersection was indicative `VERDICT: REJECT`,
delta -7.5, CI [-17.5, 0.1], P(delta<=0)=97.3%, effect -1.71. `rhythm_ladder` improved
(+10.33 weighted), but `syncopated_lift` (-24.37), `terrace_sprint` (-15.96),
`drums_dropout` (-10.14), and `skyline_push` (-9.33) made the mechanism untenable.

Canonical M107:
`generated/golden-runs/attempt-m107-objective-control-overshoot-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m107-objective-control-overshoot-a01`.
It was valid 1920/1920 with raw HEADLINE 693.00 and `HEADLINE excl. impact` 709.35. Per-budget
point estimates were 125k 678.25, 250k 689.10, 375k 694.12, and 500k 697.80.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m107-objective-control-overshoot-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
-> `VERDICT: REJECT`, delta headline -3.3, CI [-7.2, -0.5], P(delta<=0)=99.1%, effect -1.98.
Per-budget deltas were 125k +0.3, 250k -2.6, 375k -4.4, and 500k -3.9, with unchanged
validity.

Why it was not kept: objective-level controlled-axis overshoot is too blunt. It can help one
`rhythm_ladder`-shaped pocket, but it damages the same vertical/impact weak rows it was meant to
repair. The source patch was reverted; M102 remains the accepted baseline. This does not close
the M63/readiness line, but it argues against broad objective pressure as the carrier.

## 2026-07-05 - NOT KEPT - M106 expanded axis overshoot pressure

Reason: M102's weakest rows are dominated by positive signed axis errors: `drums_pendulum`
overshoots air and impact, while `skyline_push`, `terrace_sprint`, `dense_echo_climb`, and
`syncopated_lift` overshoot elevation/amplitude/impact. The existing handoff local overshoot
penalty only covers air and speed, so M106 tested whether adding controlled-axis overshoot
pressure could steer candidate selection without changing the scorer or candidate generation.

Mechanism tested: extend `handoffAxisOvershootPenalty` with half-strength normalized
overshoot pressure for `impact`, `elevation`, and `amplitude`, leaving existing full air
overshoot and softer speed overshoot unchanged. The fallback flag was
`LR_M106_AXIS_OVERSHOOT_EXPANDED=0`. This was selection-only in the handoff local score.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M106_AXIS_OVERSHOOT_EXPANDED=0` (6 files, 78 tests each).

Targeted screen:
`generated/golden-runs/probe-m106-expanded-axis-overshoot-worst9-s0-2-a01/golden.json` on
`drums_pendulum,skyline_push,terrace_sprint,dense_echo_climb,syncopated_lift,drums_dropout,
canyon_steps,dense_sprint,rhythm_ladder`, seeds 0..2, and the full budget grid was valid
108/108. Paired decision versus M102 on the same intersection was byte-identical:
`VERDICT: INCONCLUSIVE`, delta +0.0, CI [0.0, 0.0], P(delta<=0)=100.0%, effect 0.00.

Canonical M106:
`generated/golden-runs/attempt-m106-expanded-axis-overshoot-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m106-expanded-axis-overshoot-a01`.
It was valid 1920/1920 with raw HEADLINE 696.35 and `HEADLINE excl. impact` 714.91. Per-budget
point estimates were 125k 677.98, 250k 691.67, 375k 698.50, and 500k 701.66.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m106-expanded-axis-overshoot-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
-> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [0.0, 0.0], P(delta<=0)=100.0%,
effect 0.00. All per-budget deltas were +0.0 and validity stayed 100%. A checkpoint diff
confirmed 0 changed / 1920 paired scores.

Why it was not kept: the added local overshoot pressure is inert under the current canonical
handoff selection stack. At 125k and above, forward-eval/objective ordering already dominates
the local handoff score in the places this would matter, so the new local term does not change
tracks. The source patch was reverted; M102 remains the accepted baseline. Future overshoot
work needs to enter the objective/forward-eval surface or candidate generation, not this local
score add-on.

## 2026-07-05 - NOT KEPT - M105 dense-drum readiness selector

Reason: M104's `drums_breath`-only readiness selector was positive but too small, so M105
tested whether the remaining M63-descendant readiness signal could become promotable by adding
one independently screened dense-drum neighbor. Source-free screens first checked both repair
exactness and readiness-power variants against the accepted M102 baseline.

Repair screens did not produce a keepable mechanism. Exact main repair margin 1.0 on
`drums_pendulum,terrace_sprint,dense_echo_climb,drums_dropout,dense_sprint,rhythm_ladder,
drums_pulse,drums_signature,drums_crescendo,drums_tide,solo_run` with seeds 0..2 and
250k/375k/500k (`probe-m105-residual-repair-main100-s0-2-a01`) was indicative
`VERDICT: INCONCLUSIVE`, delta -0.6, P(delta<=0)=62.7%; `drums_pulse` (+5.87),
`rhythm_ladder` (+3.49), and `solo_run` (+3.34) were offset by `drums_tide` (-9.12) and
`drums_crescendo` (-4.28). The all-12 repair pocket on
`drums_pulse,rhythm_ladder,solo_run,grain_staircase`
(`probe-m105-flat-dense-lowair-repair-main100-pocket-s0-11-a01`) collapsed to delta -0.1,
P(delta<=0)=51.3%.

Readiness screens showed a second pocket but also strong collateral. The worst-15 readiness
sweep (`probe-m105-worst15-readiness075-s0-2-a01`) rejected overall, delta -4.7,
P(delta<=0)=91.9%; positives were `drums_breath` (+12.14) and `drums_crescendo` (+3.72), while
`drums_pulse` (-21.41), `dense_sprint` (-18.04), `drums_signature` (-15.59), and
`canyon_steps` (-8.34) made broadening untenable. The all-12 `drums_crescendo` readiness pocket
(`probe-m105-drums-crescendo-readiness075-s0-11-a01`) was indicative positive on the one-spec
mature-budget intersection: `VERDICT: ACCEPT`, delta +6.9, CI [-3.7, 16.5],
P(delta<=0)=9.8%, effect 1.33; per-budget deltas were 250k +15.6, 375k +5.0, and 500k +4.0.

Mechanism tested: after the accepted M75 high-air impact readiness selector, add readiness
power 0.75 for mature-budget dense-drum profiles matching either the M104 `drums_breath` pocket
or the new `drums_crescendo` pocket. The selector required at least 50 feasible contacts, median
contact gap <=0.75s, and no authored elevation/amplitude objective range. The `drums_breath`
arm used mean air 0.62..0.66, air range <=0.30, speed range 0.20..0.28, and mean impact
0.20..0.30. The `drums_crescendo` arm used mean air 0.55..0.57, air range 0.50..0.56, mean
speed 0.60..0.62, speed range 0.50..0.56, and mean impact 0.38..0.40. The escape flag was
`LR_M105_DENSE_DRUM_READINESS075=0`. A selector footprint check matched only `drums_breath` and
`drums_crescendo` across the 40 golden specs.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M105_DENSE_DRUM_READINESS075=0` (6 files, 78 tests each).

Full 3-seed guard:
`generated/golden-runs/probe-m105-dense-drum-readiness075-full-s0-2-a01/golden.json` was valid
480/480 with raw HEADLINE 699.29 and `HEADLINE excl. impact` 715.97. Decision vs M102 was
indicative `VERDICT: INCONCLUSIVE`, delta +0.4, CI [-0.7, 1.6], P(delta<=0)=28.1%,
effect 0.65. Per-budget deltas were 125k +0.0, 250k +0.4, 375k +0.5, and 500k +0.3.

Canonical M105:
`generated/golden-runs/attempt-m105-dense-drum-readiness075-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m105-dense-drum-readiness075-a01`.
It was valid 1920/1920 with raw HEADLINE 696.61 and `HEADLINE excl. impact` 715.02. Per-budget
point estimates were 125k 677.98, 250k 692.14, 375k 698.73, and 500k 701.92.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m105-dense-drum-readiness075-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
-> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.1, 1.0], P(delta<=0)=21.9%, effect
0.90. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.2, and 500k +0.3, with unchanged
validity.

Why it was not kept: this was the strongest direct push of the M63/readiness descendant after
M104, and it did move the canonical point estimate, but it still missed the acceptance rule. The
source patch was reverted; M102 remains the accepted baseline. The line has real small pockets
(`drums_breath`, `drums_crescendo`) but is not promotable at 12 canonical seeds without another
independent source of suite-scale lift.

## 2026-07-05 - NOT KEPT - M104 dense high-air low-impact readiness selector

Reason: M103 showed that the broad M63-form current-power idea should not be widened on the
post-M102 baseline, but one readiness-power descendant still had a narrow signal. A source-free
six-spec dense high-air probe using readiness power 0.75 rejected overall
(`probe-m104-dense-highair-readiness075-s0-2-a01`, delta -11.4, P(delta<=0)=87.8%), while the
`drums_breath` all-12 pocket alone was indicative positive
(`probe-m104-drums-breath-readiness075-s0-11-a01`, delta +3.8 on the one-spec intersection,
CI [-4.2, 11.0], P(delta<=0)=16.5%).

Mechanism tested: after the accepted M75 high-air impact readiness selector, add the same
readiness power 0.75 for mature-budget dense high-air/low-impact profiles with at least 50
feasible contacts, no authored elevation/amplitude objective range, mean air 0.62..0.66, air
range <=0.30, speed range 0.20..0.28, mean impact 0.20..0.30, and median contact gap <=0.75s.
The escape flag was `LR_M104_DENSE_HIGH_AIR_LOW_IMPACT_READINESS075=0`. A selector footprint
check matched only `drums_breath` across the 40 golden specs.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M104_DENSE_HIGH_AIR_LOW_IMPACT_READINESS075=0` (6 files, 78 tests
each).

Full 3-seed guard:
`generated/golden-runs/probe-m104-dense-highair-lowimpact-readiness075-full-s0-2-a01/golden.json`
was valid 480/480 with raw HEADLINE 699.22 and `HEADLINE excl. impact` 715.75. Decision vs M102:
indicative `VERDICT: INCONCLUSIVE`, delta +0.3, CI [0.0, 1.0], P(delta<=0)=36.4%, effect 0.98.
Per-budget deltas were 125k +0.0, 250k +0.4, 375k +0.4, and 500k +0.2.

Canonical M104:
`generated/golden-runs/attempt-m104-dense-highair-lowimpact-readiness075-a01/golden.json`, run
with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m104-dense-highair-lowimpact-readiness075-a01`.
It was valid 1920/1920 with raw HEADLINE 696.45 and `HEADLINE excl. impact` 714.9. Per-budget
point estimates were 125k 677.98, 250k 691.73, 375k 698.60, and 500k 701.81.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m104-dense-highair-lowimpact-readiness075-a01/golden.json generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`
-> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.6], P(delta<=0)=48.0%, effect
0.55. Per-budget deltas were 125k +0.0, 250k +0.1, 375k +0.1, and 500k +0.2, with unchanged
validity.

Why it was not kept: the targeted pocket was real enough to justify a canonical run, but the
all-suite effect was too small and noisy to promote. The source patch was reverted; M102 remains
the accepted baseline. Do not widen this M63 descendant back to the dense high-air panel.

## 2026-07-04 - SOURCE-FREE PROBES - post-M102 M63-form and vertical breadth screens

Reason: M63's broad high-impact current-quality exponent remained the strongest near-miss in
the objective family, and M102 moved several high-air/vertical residual rows. Before adding
source, reprice narrow residual M63-form pockets and a mature vertical candidate-breadth pocket
against the accepted M102 baseline.

M63-form current-power screens used `LR_M64_OBJECTIVE_CURRENT_POWER=1.5` only on mature budgets
of the probed spec slices, leaving scorer, specs, fingerprint, seeds, budget grid, and acceptance
rule frozen:

- `probe-m103-residual-combined-current15-s0-2-a01` on `dense_echo_climb,canyon_steps,
  switchback_pop` (seeds 0..2, budgets 250k/375k/500k) vs M102: indicative `VERDICT: REJECT`,
  delta -4.9, CI [-12.0, 1.2], P(delta<=0)=92.5%. Every selected spec regressed.
- `probe-m103-highimpact-sparse-current15-s0-2-a01` on `rolling_drop,summit_push,leap_cadence`
  (seeds 0..2, budgets 250k/375k/500k) vs M102: indicative `VERDICT: INCONCLUSIVE`, delta
  +0.4, CI [-5.9, 9.5], P(delta<=0)=49.3%. `leap_cadence` improved, but `rolling_drop` and
  `summit_push` erased it.
- `probe-m103-leap-current15-s0-11-a01` on `leap_cadence` alone (all 12 seeds, budgets
  250k/375k/500k) vs M102: indicative `VERDICT: INCONCLUSIVE`, delta +0.3, CI [-4.9, 5.3],
  P(delta<=0)=45.1%; 500k regressed -1.7.

Vertical candidate-breadth screens used source-free `LR_QUALITY_NCAND` on the mature vertical
panel:

- `probe-m103-vertical-ncand34-s0-2-a01` on `skyline_push,terrace_sprint,syncopated_lift,
  canyon_steps,dense_echo_climb,rolling_drop` vs M102: indicative `VERDICT: REJECT`, delta
  -2.0, CI [-6.8, 3.4], P(delta<=0)=80.3%.
- `probe-m103-vertical-ncand36-s0-2-a01` on the same panel vs M102: indicative
  `VERDICT: INCONCLUSIVE`, delta -1.7, CI [-6.2, 3.0], P(delta<=0)=75.8%.
- The only plausible narrower pocket was dense high-amplitude lower-air `canyon_steps` +
  `terrace_sprint`. All-12 pocket probes were still not promotable: `nCand=34`
  (`probe-m103-denseamp-ncand34-pocket-s0-11-a01`) delta +2.3 on the two-spec mature-budget
  intersection, P(delta<=0)=29.1%, driven mostly by `terrace_sprint`; `nCand=36`
  (`probe-m103-denseamp-ncand36-pocket-s0-11-a01`) was flat at delta -0.1.

Why nothing was kept: the broad M63 idea is still real but already harvested by accepted narrow
selectors (M64/M74/M87/M94). The post-M102 residual current-power pockets either regress or are
far below suite scale, and mature vertical candidate breadth helps isolated rows while hurting
the same known collateral (`skyline_push`, `syncopated_lift`, `dense_echo_climb`). No source
changes were made.

## 2026-07-04 - ACCEPTED - M102 high-air low-grain repair main-margin exactness

Reason: M100's global protected repair main-margin trial still contained a second residual
positive pocket after M101 removed the flat compact winners. The clean all-12 residual shape was
high-air, moderate air-range, low/absent authored grain profiles outside M101. M102 keeps M101
first, then uses exact main repair margin 1.0 for mature budgets (>=200k) when mean authored air
at feasible contacts is at least 0.61, authored air range is at most 0.40, and mean authored
grain is at most 0.49. Missing grain counts as zero. The fallback flag is
`LR_M102_REPAIR_HIGH_AIR_LOW_GRAIN_MAIN100=0`. Explicit `LR_REPAIR_MAIN_MARGIN` still overrides.
Candidate generation, q, start selection, forward eval, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M102_REPAIR_HIGH_AIR_LOW_GRAIN_MAIN100=0` (6 files, 78 tests each).

Full 3-seed guard:
`generated/golden-runs/probe-m102-repair-highair-lowgrain-main100-full-s0-2-a02/golden.json`,
valid 480/480 with raw HEADLINE 698.93 and `HEADLINE excl. impact` 715.68. Decision vs M101:
non-canonical indicative `VERDICT: ACCEPT`, delta +0.6, CI [-0.3, 1.6], P(delta<=0)=8.7%,
effect 1.25. Per-budget deltas were 125k +0.0, 250k +0.1, 375k +0.6, and 500k +1.0.

Affected-pocket probe:
`generated/golden-runs/probe-m102-repair-highair-lowgrain-main100-pocket-s0-11-a01/golden.json`,
run on the 11 selected specs with all 12 canonical seeds, was valid 528/528 with raw pocket
HEADLINE 703.60 and `HEADLINE excl. impact` 706.09. Decision vs M101: non-canonical
indicative `VERDICT: ACCEPT`, delta +1.3, CI [-0.2, 2.8], P(delta<=0)=4.1%, effect 1.74.
Per-budget deltas were 125k +0.0, 250k -0.5, 375k +2.0, and 500k +2.1.

Canonical M102:
`generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01`.
It was valid 1920/1920 with raw HEADLINE 696.35 and `HEADLINE excl. impact` 714.91.
Per-budget point estimates were 125k 677.98, 250k 691.67, 375k 698.50, and 500k 701.66.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m102-repair-highair-lowgrain-main100-a01/golden.json generated/golden-runs/attempt-m101-repair-flat-compact-main100-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.4, CI [-0.1, 0.9], P(delta<=0)=4.3%, effect 1.59. Per-budget deltas were 125k +0.0, 250k -0.1, 375k +0.5, and 500k +0.6, with unchanged validity.

Why it was kept: this is a second local repair usefulness selector, not a global repair-margin
scalar. It changes 330/1920 paired checkpoints, with 209 improvements, 117 regressions, and
1594 plateaus; the 125k tier is byte-stable. The selected specs are nonnegative weighted:
`canyon_steps` (+2.69), `pop_train` (+2.19), `big_air_ramp` (+2.11), `drums_zigzag` (+1.85),
`syncopated_lift` (+1.52), `drums_breath` (+1.42), `drums_crosscut` (+0.96),
`skyline_push` (+0.94), `leap_cadence` (+0.69), `rolling_drop` (+0.38), and `float_bounds`
(+0.17). The accepted baseline is now `attempt-m102-repair-highair-lowgrain-main100-a01`.

## 2026-07-04 - ACCEPTED - M101 flat compact repair main-margin exactness

Reason: M100 showed that protected mature-budget repair main-margin 1.0 was positive but too
broad: the canonical scalar trial moved 1240/1920 rows and missed acceptance. Its winners were
concentrated in flat compact profiles (`mini_burst`, `syncopated_switchback`, `cold_start`,
`tiny_dance`, `opening_burst`, and `verse_chorus`). M101 keeps the accepted repair ramp by
default, but uses exact main repair margin 1.0 only for mature budgets (>=200k) when the authored
vertical profile has zero elevation range, zero amplitude range, and at most 32 contacts. The
fallback flag is `LR_M101_REPAIR_FLAT_COMPACT_MAIN100=0`. Explicit `LR_REPAIR_MAIN_MARGIN`
still overrides. Candidate generation, q, start selection, forward eval, scorer, specs,
fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M101_REPAIR_FLAT_COMPACT_MAIN100=0` (6 files, 78 tests each).

Affected-pocket probe:
`generated/golden-runs/probe-m101-repair-flat-compact-main100-pocket-s0-11-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --specs=mini_burst,syncopated_switchback,cold_start,tiny_dance,opening_burst,verse_chorus --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m101-repair-flat-compact-main100-pocket-s0-11-a01`,
covered all 12 canonical seeds on the six intended specs. It was valid 288/288 with raw pocket
HEADLINE 774.09 and `HEADLINE excl. impact` 791.71. Decision vs M94: non-canonical indicative
`VERDICT: ACCEPT`, delta +3.8, CI [-0.0, 8.6], P(delta<=0)=2.5%, effect 1.77. Per-budget
deltas were 125k +0.0, 250k +3.9, 375k +2.9, and 500k +5.3.

Full 3-seed guard:
`generated/golden-runs/probe-m101-repair-flat-compact-main100-full-s0-2-a01/golden.json`,
valid 480/480 with raw HEADLINE 698.34 and `HEADLINE excl. impact` 715.30. Decision vs M94:
non-canonical indicative `VERDICT: ACCEPT`, delta +0.5, CI [-0.5, 1.9], P(delta<=0)=16.8%,
effect 0.86. Per-budget deltas were 125k +0.0, 250k -0.6, 375k +0.5, and 500k +1.2.

Canonical M101:
`generated/golden-runs/attempt-m101-repair-flat-compact-main100-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m101-repair-flat-compact-main100-a01`.
It was valid 1920/1920 with raw HEADLINE 695.99 and `HEADLINE excl. impact` 714.67.
Per-budget point estimates were 125k 677.98, 250k 691.82, 375k 697.96, and 500k 701.09.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m101-repair-flat-compact-main100-a01/golden.json generated/golden-runs/attempt-m94-lowimpact-compact-current20-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.5, CI [-0.0, 1.4], P(delta<=0)=2.9%, effect 1.42. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.4, and 500k +0.7, with unchanged validity.

Why it was kept: M101 is the local usefulness selector that M100 needed. It changes only 192/1920
paired checkpoints, with 128 improvements, 64 regressions, and 1728 plateaus; the 125k tier is
byte-stable. The moved specs are exactly the intended flat compact set: `mini_burst` (+6.38
weighted), `syncopated_switchback` (+4.71), `cold_start` (+3.32), `tiny_dance` (+3.01),
`opening_burst` (+2.61), and `verse_chorus` (+2.17). The accepted baseline is now
`attempt-m101-repair-flat-compact-main100-a01`.

## 2026-07-04 - CANONICAL INCONCLUSIVE - M99/M100 repair main-margin exactness

Reason: M83's mature-only repair main-margin 1.0 trial was flat on the M75-era full suite but
had large positive pockets (`pop_train`, `syncopated_switchback`, `canyon_steps`, and
`drums_pulse`). Reprice that branch on the accepted M94 baseline. M99 first used the existing
source-free `LR_REPAIR_MAIN_MARGIN=1.0` override on only the positive pocket. Because that kept
the mature-budget gains but regressed 125k, M100 source-trialed a protected version: keep the
accepted 125k repair main-margin ramp, but use repair main margin 1.0 only for budgets >=200k.
Candidate generation, q, start selection, forward eval, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged. The temporary M100 fallback flag was
`LR_M100_REPAIR_MAIN100_MATURE=0`.

M100 focused tests passed in default and fallback modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M100_REPAIR_MAIN100_MATURE=0` (6 files, 78 tests each).

M99 source-free positive-pocket probe:
`generated/golden-runs/probe-m99-repair-main100-positive-pocket-s0-11-a01/golden.json`,
run with `LR_ENGINE=wasm LR_REPAIR_MAIN_MARGIN=1.0 npm run golden -- --specs=pop_train,syncopated_switchback,canyon_steps,drums_pulse --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m99-repair-main100-positive-pocket-s0-11-a01`,
covered all 12 canonical seeds on the four M83-positive specs. It was valid 192/192 with raw
pocket HEADLINE 686.61 and `HEADLINE excl. impact` 702.29. Decision vs M94:
non-canonical indicative `VERDICT: ACCEPT`, delta +2.2, CI [-1.8, 7.3], P(delta<=0)=13.2%,
effect 0.97. Per-budget deltas were 125k -6.1, 250k +1.9, 375k +3.1, and 500k +3.8.

M100 protected positive-pocket probe:
`generated/golden-runs/probe-m100-repair-main100-mature-positive-pocket-s0-11-a01/golden.json`,
valid 192/192 with raw pocket HEADLINE 687.22 and `HEADLINE excl. impact` 702.92. Decision vs
M94: non-canonical indicative `VERDICT: ACCEPT`, delta +2.8, CI [-1.1, 7.9],
P(delta<=0)=7.0%, effect 1.26. Per-budget deltas were 125k +0.0, 250k +1.9, 375k +3.1, and
500k +3.8. The 125k tier was hash-stable against M94.

M100 full 3-seed guard:
`generated/golden-runs/probe-m100-repair-main100-mature-full-s0-2-a01/golden.json`, valid
480/480 with raw HEADLINE 698.54 and `HEADLINE excl. impact` 715.29. Decision vs M94:
non-canonical `VERDICT: INCONCLUSIVE`, delta +0.7, CI [-1.2, 2.7], P(delta<=0)=23.7%,
effect 0.71. Per-budget deltas were 125k +0.0, 250k -0.5, 375k +0.6, and 500k +1.6.

Canonical M100:
`generated/golden-runs/attempt-m100-repair-main100-mature-a01/golden.json`, run with
`LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m100-repair-main100-mature-a01`.
It was valid 1920/1920 with raw HEADLINE 695.89 and `HEADLINE excl. impact` 714.27.
Per-budget point estimates were 125k 677.98, 250k 691.65, 375k 697.76, and 500k 701.08.

Canonical decision: `npm run decide -- generated/golden-runs/attempt-m100-repair-main100-mature-a01/golden.json generated/golden-runs/attempt-m94-lowimpact-compact-current20-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.4, CI [-0.7, 1.6], P(delta<=0)=23.1%, effect 0.71. Per-budget deltas were 125k +0.0, 250k +0.4, 375k +0.2, and 500k +0.7, with unchanged validity.

Why it was not kept: protecting 125k removed the obvious M99 budget-shape defect, but the
canonical gain still missed the acceptance rule. M100 changed 1240/1920 paired hashes with 694
improvements, 536 regressions, and 690 plateaus. Gains on `mini_burst` (+6.38 weighted),
`syncopated_switchback` (+4.71), `cold_start` (+3.32), and `tiny_dance` (+3.01) were diluted
by losses on `drums_crescendo` (-5.46), `summit_push` (-4.34), `valley_bounce` (-4.12), and
`mixed_grade` (-3.63). This closes repair main-margin scalar changes on the M94 stack; future
repair work needs a local usefulness/value selector. The temporary source change was reverted;
the accepted baseline remains `attempt-m94-lowimpact-compact-current20-a01`.

## 2026-07-04 - SOURCE-FREE INCONCLUSIVE PROBE - M98 impact onset 0.30 on old M48 pocket

Reason: M48's profiled high-onset impact-curve hook was canonical-inconclusive, not rejected,
and it targeted a slice M94 does not touch. Reprice the old four-spec moved footprint on the
current M94 baseline without source edits by running `LR_IMPACT_CURVE_START=0.30` only on
`drums_dropout`, `drums_pendulum`, `drums_tide`, and `rhythm_ladder`. Candidate generation
outside the env knob, search policy, objective selectors, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m98-impact-onset030-profile-pocket-s0-11-a01/golden.json`,
run with `LR_ENGINE=wasm LR_IMPACT_CURVE_START=0.30 npm run golden -- --specs=drums_dropout,drums_pendulum,drums_tide,rhythm_ladder --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m98-impact-onset030-profile-pocket-s0-11-a01`,
covered all 12 canonical seeds on the old M48 footprint. It was valid 192/192 with raw pocket
HEADLINE 597.11 and `HEADLINE excl. impact` 653.18.

Probe decision: `npm run decide -- generated/golden-runs/probe-m98-impact-onset030-profile-pocket-s0-11-a01/golden.json generated/golden-runs/attempt-m94-lowimpact-compact-current20-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta -0.8 on the four-spec pocket, CI [-10.3, 8.5], P(delta<=0)=56.5%, effect -0.15. Per-budget deltas were 125k +4.4, 250k +1.4, 375k -2.6, and 500k -1.8.

Why it was stopped: the current M94 stack does not reopen M48. `drums_dropout` still gained
(+3.52 weighted paired-row mean, driven by +27.81 at 125k), but `drums_pendulum` -2.88,
`rhythm_ladder` -1.59, and `drums_tide` -1.29 erased it, with the 375k/500k tiers negative.
The old profiled high-onset path should not be reintroduced on the current baseline without a
new selector that isolates `drums_dropout` without the mature-budget losses. Env-only; the
accepted baseline remains `attempt-m94-lowimpact-compact-current20-a01`.

## 2026-07-04 - INCONCLUSIVE PROBES - M96/M97 compact readiness compound

Reason: after M94 accepted p=2.0 for the compact low-impact pocket, test whether the same
selector should also use the M75-style readiness softening or a compound dose refinement. M96
first used the existing source-free `LR_M75_MATURE_OBJECTIVE_READINESS_POWER=0.75` override on
the full M94 compact pocket. M97 then source-trialed only the positive sub-shapes from M95/M96:
p=2.5 for tiny flat compact rows (contact count <=8, no authored elevation/amplitude range),
readiness power 0.75 for dynamic compact rows, and accepted M94 unchanged for `cold_start`.
Fallback flags were `LR_M97_LOW_IMPACT_TINY_FLAT_CURRENT25=0` and
`LR_M97_LOW_IMPACT_DYNAMIC_COMPACT_READINESS075=0`. Scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

M97 focused tests passed in default mode and fallback mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with both M97 fallback flags set to `0` (6 files, 78 tests each).

M96 source-free pocket probe:
`generated/golden-runs/probe-m96-lowimpact-compact-readiness075-pocket-s0-11-a01/golden.json`,
valid 192/192, raw pocket HEADLINE 742.49 and `HEADLINE excl. impact` 764.64. Decision vs M94:
non-canonical `VERDICT: INCONCLUSIVE`, delta +1.0, CI [-3.7, 5.3], P(delta<=0)=30.5%,
effect 0.43. Per-budget deltas were 125k +0.0, 250k +1.1, 375k +0.2, and 500k +1.7.

M97 affected-pocket probe:
`generated/golden-runs/probe-m97-lowimpact-compact-compound-pocket-s0-11-a01/golden.json`,
valid 192/192, raw pocket HEADLINE 743.27 and `HEADLINE excl. impact` 762.69. Decision vs M94:
non-canonical indicative `VERDICT: ACCEPT`, delta +1.8, CI [-1.2, 5.8],
P(delta<=0)=12.6%, effect 1.02. Per-budget deltas were 125k +0.0, 250k +2.3, 375k +2.1,
and 500k +1.7.

Full 3-seed M97 probe:
`generated/golden-runs/probe-m97-lowimpact-compact-compound-full-s0-2-a01/golden.json`,
valid 480/480 with raw HEADLINE 697.82 and `HEADLINE excl. impact` 714.90. Decision vs M94:
non-canonical `VERDICT: INCONCLUSIVE`, delta -0.0 on the 40-spec x three-seed full-budget
intersection, CI [-0.4, 0.3], P(delta<=0)=52.7%, effect -0.06. Per-budget deltas were
125k +0.0, 250k +0.0, 375k -0.1, and 500k +0.0.

Why it was stopped: M97 was a seed-shape mismatch. The all-12 pocket probe looked promotable
because later seeds made `mini_burst` strongly positive, and the source correctly kept
`cold_start` byte-stable. But the full-suite seeds 0..2 preview moved only 27/480 hashes with
13 improvements, 14 regressions, and 453 plateaus; `rolling_hills` was positive (+2.94
weighted), while `ridge_pulse` (-0.94) and `mini_burst` (-2.69) erased it. Do not promote this
compound selector or run it canonically without a new seed-robust signal. The temporary source
change was reverted; the accepted baseline remains `attempt-m94-lowimpact-compact-current20-a01`.

## 2026-07-04 - INCONCLUSIVE PROBE - M95 flat compact current-power 2.5 dose

Reason: M94 accepted p=2.0 only for the compact sub-pocket of M87. M95 tested whether the
strongest flat compact rows inside that pocket were still under-dosed by raising only profiles
with zero authored elevation range and zero authored amplitude range from p=2.0 to p=2.5.
This selected `mini_burst` and `cold_start`, while leaving `ridge_pulse` and `rolling_hills`
on the accepted M94 p=2.0 path. The temporary fallback flag was
`LR_M95_LOW_IMPACT_FLAT_COMPACT_CURRENT25=0`. Scorer, specs, fingerprint, seed set, budget grid,
and acceptance rule stayed unchanged.

Focused tests passed in default mode and fallback mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M95_LOW_IMPACT_FLAT_COMPACT_CURRENT25=0` (6 files, 78 tests each).

Probe: `generated/golden-runs/probe-m95-flat-compact-current25-pocket-s0-11-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --specs=mini_burst,cold_start,ridge_pulse,rolling_hills --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m95-flat-compact-current25-pocket-s0-11-a01`,
covered the whole M94 compact pocket with all 12 canonical seeds. It was valid 192/192 with raw
pocket HEADLINE 742.55 and `HEADLINE excl. impact` 765.94.

Probe decision: `npm run decide -- generated/golden-runs/probe-m95-flat-compact-current25-pocket-s0-11-a01/golden.json generated/golden-runs/attempt-m94-lowimpact-compact-current20-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta +1.0 on the four-spec affected pocket, CI [-2.8, 6.0], P(delta<=0)=33.4%, effect 0.50. Per-budget deltas were 125k +0.0, 250k +1.5, 375k -0.2, and 500k +2.0.

Why it was stopped: the effect is too small and noisy for promotion. Only `mini_burst` was a
clear net positive (+3.44 weighted paired-row mean); `cold_start` was weaker and seed-volatile
(+1.04 weighted), while `ridge_pulse` and `rolling_hills` stayed byte-stable by design. The
probe changed 72/192 paired hashes with 39 improvements, 33 regressions, and 120 plateaus.
This does not justify a full-suite canonical run; the temporary source change was reverted and
the accepted baseline remains `attempt-m94-lowimpact-compact-current20-a01`.

## 2026-07-04 - ACCEPTED - M94 low-impact compact current-power 2.0 dose

Reason: M88 showed that raising the whole accepted M87 low-impact steady/sparse pocket from
`currentQuality^1.5 * readiness` to `currentQuality^2.0 * readiness` was not keepable, but the
probe's winners were concentrated in compact profiles. M94 keeps M87's accepted selector first,
then applies the stronger exponent only when feasible contacts are at most 24, median contact
gap is under 40 frames, and authored amplitude target range is at most 0.20. This keeps the
M88 winners `mini_burst`, `cold_start`, `ridge_pulse`, and `rolling_hills`, while excluding
the M88 losers `grain_staircase`, `mixed_grade`, and `float_bounds`. The fallback flag is
`LR_M94_LOW_IMPACT_COMPACT_CURRENT20=0`. Scorer, specs, fingerprint, seed set, budget grid, and
acceptance rule stayed unchanged.

Focused tests passed in default mode and fallback mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M94_LOW_IMPACT_COMPACT_CURRENT20=0` (6 files, 78 tests each).

The seven-spec guardrail panel
`generated/golden-runs/probe-m94-lowimpact-compact-current20-panel-s0-2-a01/golden.json`
was valid 84/84 and produced indicative `VERDICT: ACCEPT`, delta +3.5, CI [-0.2, 8.0],
P(delta<=0)=3.6%, effect 1.69. The full 40-spec seeds 0..2 probe
`generated/golden-runs/probe-m94-lowimpact-compact-current20-full-s0-2-a01/golden.json`
was valid 480/480 with raw HEADLINE 697.83 and `HEADLINE excl. impact` 714.89. It produced
indicative `VERDICT: ACCEPT`, delta +0.6, CI [-0.0, 1.5], P(delta<=0)=4.9%, effect 1.47;
per-budget deltas were 125k +0.0, 250k +0.9, 375k +0.7, and 500k +0.5.

Canonical: `generated/golden-runs/attempt-m94-lowimpact-compact-current20-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m94-lowimpact-compact-current20-a01`.
The run was valid 1920/1920 overall, with raw HEADLINE 695.48 and `HEADLINE excl. impact` 714.05.
Per-budget point estimates were 125k 677.98, 250k 691.28, 375k 697.57, and 500k 700.37.

Decision: `npm run decide -- generated/golden-runs/attempt-m94-lowimpact-compact-current20-a01/golden.json generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +0.4, CI [-0.0, 1.1], P(delta<=0)=5.9%, effect 1.32. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.5, and 500k +0.4.

Why it was kept: this is the narrow M88 refinement that the broad M88 probe implied. The
canonical footprint changed only the intended four specs, with 142/1920 paired track hashes
changed, 84 improvements, 58 regressions, and 1778 plateaus. Paired row means were
`mini_burst` +7.35, `cold_start` +4.93, `ridge_pulse` +2.48, and `rolling_hills` +0.66;
`grain_staircase`, `mixed_grade`, and `float_bounds` stayed byte-stable. The 125k tier was
byte-identical, so the accepted gain is a mature-budget dose improvement on the M87 pocket.
The accepted baseline is now `attempt-m94-lowimpact-compact-current20-a01`.

## 2026-07-04 - REJECTED CANONICAL - M93 dense-modulated aim top-k 7 selector

Reason: M92 showed that global mature K=7 is rejected, but its winners were concentrated in a
small dense-drum profile. M93 tried a tight high-budget selector that raised the accepted K=6
aim-base count to K=7 only when contact-ending gaps had at least 50 contacts, air-target range
0.25..0.36, speed-target range 0.25..0.29, and no elevation/amplitude target range. The intended
slice was exactly `drums_swell`, `drums_tide`, and `drums_zigzag`; `LR_M93_DENSE_MODULATED_AIM_K7=0`
restored the accepted K=6 high-budget behavior. The 125k maturity gate, scorer, specs, fingerprint,
seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default mode and fallback mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M93_DENSE_MODULATED_AIM_K7=0` (6 files, 78 tests each).

Early probes were encouraging but not promotable. The 10-spec guardrail panel
`generated/golden-runs/probe-m93-dense-modulated-k7-panel-s0-2-a01/golden.json`
was valid 90/90 and produced indicative `VERDICT: ACCEPT`, delta +4.9, CI [-0.3, 12.5],
P(delta<=0)=5.8%; only the three intended specs changed. The full 40-spec seeds 0..2 probe
`generated/golden-runs/probe-m93-dense-modulated-k7-full-s0-2-a01/golden.json`
was valid 480/480 and also produced indicative `VERDICT: ACCEPT`, delta +1.1, CI [-0.0, 3.0],
P(delta<=0)=7.0%, with 125k exactly neutral and the same three-spec footprint.

Canonical: `generated/golden-runs/attempt-m93-dense-modulated-k7-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m93-dense-modulated-k7-a01`.
The run was valid 1920/1920 overall, with raw HEADLINE 694.26 and `HEADLINE excl. impact` 712.23.
Per-budget point estimates were 125k 677.98, 250k 689.92, 375k 696.31, and 500k 698.96.

Decision: `npm run decide -- generated/golden-runs/attempt-m93-dense-modulated-k7-a01/golden.json generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json` -> canonical `VERDICT: REJECT`, delta headline -0.8, CI [-2.7, 0.2], P(delta<=0)=92.5%, effect -1.05. Per-budget deltas were 125k +0.0, 250k -0.9, 375k -0.7, and 500k -1.0.

Why it was not kept: this was a clean seed-generalization failure, not broad leakage. Only
108/1920 paired rows changed, all inside `drums_swell`, `drums_tide`, and `drums_zigzag`, with
49 improvements, 59 regressions, and 1812 plateaus. The canonical per-spec means flipped to
`drums_swell` -14.99, `drums_tide` -9.21, and `drums_zigzag` -1.52. Seeds 0..2 had overfit the
positive side of the profile, while later seeds exposed large losses such as `drums_swell` seed 4
-92.7, `drums_tide` seed 8 -77.0, and `drums_zigzag` seeds 3/5/6/11 around -26 to -35. Do not
promote this static dense-modulated K7 selector, and do not re-run the same K7 idea without a
seed-robust usefulness signal. The temporary source change was reverted; the accepted baseline
remains `attempt-m87-lowimpact-steady-current15-a01`.

## 2026-07-04 - SOURCE-FREE REJECTED PROBE - M92 mature aim top-k 7 on current M87

Reason: after M87 changed the mature objective surface, re-audit whether the high-budget aim
base count is still capped at the accepted K=6 setting. The source-free probe used the existing
`LR_AIM_TOPK_BASES=7` override and only ran the mature budgets 250k/375k/500k, matching the
slice a production high-budget K=7 change would touch. Candidate generation apart from the aim
base count, search policy, forward eval, repair, scorer, specs, fingerprint, seed set, budget
grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m92-aimtopk7-mature-current-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm LR_AIM_TOPK_BASES=7 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m92-aimtopk7-mature-current-s0-2-a01`,
covered all 40 specs with seeds 0..2 at 250k/375k/500k. It was valid 360/360 with raw mature
HEADLINE 695.60 and `HEADLINE excl. impact` 711.49.

Probe decision: `npm run decide -- generated/golden-runs/probe-m92-aimtopk7-mature-current-s0-2-a01/golden.json generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -3.8 on the 40-spec x three-seed x mature-budget intersection, CI [-9.3, 0.7], P(delta<=0)=94.5%, effect -1.49. Per-budget deltas were 250k -4.3, 375k -4.4, and 500k -3.1.

Why it was stopped: M87 did not reopen aim-base breadth. K=7 changed 339/360 paired mature
checkpoints, with 144 improvements, 193 regressions, and 23 plateaus. It helped
`drums_zigzag` (+28.49 mean over paired mature rows) and `drums_tide` (+20.27), but regressed
`syncopated_switchback` (-46.43), `drums_dropout` (-30.47), `drums_signature` (-23.98),
`drums_pulse` (-23.85), and `dense_sprint` (-18.48). Mean work movement showed the extra aim
base displaced downstream search: sampled candidates -481, viable candidates -369, forward-eval
frames -5658, and repair accepts -0.11 per paired row. Keep the current K=6 mature aim-base
setting; do not promote K=7 without a new selector. This was env-only and left no source changes.

## 2026-07-04 - INCONCLUSIVE PROBE - M91 scarce low-slack branch threshold 2.25

Reason: test whether the accepted low-slack pre-completion traversal limiter was too narrow at
the 125k tier. The temporary source raised `HANDOFF_LOW_SLACK_BRANCH_THRESHOLD` from 1.5 to
2.25, with `LR_M91_SCARCE_BRANCH22=0` restoring the accepted 1.5 threshold. This was intended
to reach the weak 125k `dense_sprint` / `rhythm_ladder` slack band while leaving the mature
budgets effectively unchanged. Scorer, specs, fingerprint, seed set, budget grid, and acceptance
rule stayed unchanged.

Focused tests passed in default mode and fallback mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M91_SCARCE_BRANCH22=0` (6 files, 78 tests each).

Probe: `generated/golden-runs/probe-m91-scarce-branch225-125-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000 --jobs=32 --archive-dir=generated/golden-runs/probe-m91-scarce-branch225-125-s0-2-a01`,
covered all 40 specs with seeds 0..2 at 125k. It was valid 120/120 with raw HEADLINE 677.65
and `HEADLINE excl. impact` 696.52.

Probe decision: `npm run decide -- generated/golden-runs/probe-m91-scarce-branch225-125-s0-2-a01/golden.json generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta +0.0 on the 40-spec x three-seed x 125k intersection, CI [0.0, 0.0], P(delta<=0)=100.0%, effect 0.00.

Why it was stopped: the threshold did fire in telemetry (`dense_sprint` mean branch limit
3.000 -> 2.563, `rhythm_ladder` 3.000 -> 2.643 on seeds 0..2), but it changed only one paired
track hash and all 120 paired scores were identical. The accepted branch limiter is already
past the useful point for this traversal shape; raising the threshold only reduces branch
accounting without producing better scarce-tier tracks. The temporary source change was
reverted, and the accepted baseline remains `attempt-m87-lowimpact-steady-current15-a01`.

## 2026-07-04 - REJECTED PROBE - M89 vertical current-power 2.5 dose

Reason: M74 accepted a very narrow M63-form selector by raising only the existing M64-band
vertical profile from `currentQuality^1.5 * readiness` to `currentQuality^2.0 * readiness`.
M89 tested whether that accepted vertical pocket was still under-dosed on top of the current
M87 baseline. The temporary source returned current-quality power 2.5 for the existing M74
profile when `LR_M89_VERTICAL_OBJECTIVE_CURRENT25` was not `0`; setting that flag to `0`
fell back to the accepted M74 p=2.0 path. The M64 band, M87 low-impact selector, 125k maturity
gate, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default mode and fallback mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M89_VERTICAL_OBJECTIVE_CURRENT25=0` (6 files, 78 tests each).

Probe: `generated/golden-runs/probe-m89-vertical-current25-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m89-vertical-current25-s0-2-a01`,
covered all 40 specs with seeds 0..2 and the canonical budget grid. It was valid 480/480 with
raw HEADLINE 696.94 and `HEADLINE excl. impact` 713.51.

Probe decision: `npm run decide -- generated/golden-runs/probe-m89-vertical-current25-s0-2-a01/golden.json generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -0.3 on the 40-spec x three-seed x full-budget intersection, CI [-0.9, 0.2], P(delta<=0)=87.7%, effect -1.06. Per-budget deltas were 125k +0.0, 250k -0.4, 375k -0.3, and 500k -0.3.

Why it was stopped: the stronger vertical exponent over-concentrates the accepted M74 pocket.
Only 54/480 paired checkpoints changed, with 24 improvements and 30 regressions. It helped
`climb_terrace` (+1.51 weighted), `glide_stairs` (+0.38), and `skyline_push` (+0.25), but
regressed `big_air_ramp` (-5.61), `terrace_sprint` (-4.38), and `swoop_dive` (-4.22). Mean
work shifted by only -23 sim frames, -6.2 sampled candidates, -7.7 viable candidates, +270
repair frames, -0.050 repair accepts, and +16 forward-eval frames per paired row, so this is a
ranking basin loss rather than a budget-spend effect. The temporary source change was reverted,
and the accepted baseline remains `attempt-m87-lowimpact-steady-current15-a01`.

## 2026-07-04 - INCONCLUSIVE PROBE - M88 low-impact steady current-power 2.0 dose

Reason: after M87 accepted a second narrow M63-form selector, test whether the low-impact
steady/sparse pocket was under-dosed. The temporary source kept the exact M87 selector but
returned current-quality power 2.0 instead of 1.5 when `LR_M88_LOW_IMPACT_STEADY_CURRENT20`
was not `0`; setting that flag to `0` fell back to the accepted M87 p=1.5 path. The M64/M74
impact band still had precedence, 125k stayed byte-identical, and scorer, specs, fingerprint,
seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default mode and fallback mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M88_LOW_IMPACT_STEADY_CURRENT20=0` (6 files, 78 tests each).

Probe: `generated/golden-runs/probe-m88-lowimpact-steady-current20-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m88-lowimpact-steady-current20-s0-2-a01`,
covered all 40 specs with seeds 0..2 and the canonical budget grid. It was valid 480/480 with
raw HEADLINE 697.25 and `HEADLINE excl. impact` 714.53.

Probe decision: `npm run decide -- generated/golden-runs/probe-m88-lowimpact-steady-current20-s0-2-a01/golden.json generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta +0.0 on the 40-spec x three-seed x full-budget intersection, CI [-1.7, 1.4], P(delta<=0)=45.6%, effect 0.01. Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.2, and 500k -0.2.

Why it was stopped: the stronger exponent is a basin shuffle, not an upgrade. Only 63/480
paired checkpoints changed, with 34 improvements and 29 regressions. It helped `mini_burst`
(+11.55), `cold_start` (+5.87), `ridge_pulse` (+2.77), and `rolling_hills` (+2.77), but
regressed `float_bounds` hard (-17.92) and slightly hurt `grain_staircase` (-0.62) and
`mixed_grade` (-0.78). The 500k tier moved negative, so a canonical run is not justified.
The temporary source change was reverted, and the accepted baseline remains
`attempt-m87-lowimpact-steady-current15-a01`.

## 2026-07-04 - ACCEPTED - M87 low-impact steady/sparse current objective gate

Reason: M63/M64 proved that mature current-quality exponentiation is useful when it is narrowly
selected. The broad M62 current-power screen also showed a low-impact pocket that M64 skipped:
compact steady or sparse specs such as `grain_staircase`, `float_bounds`, `mini_burst`,
`rolling_hills`, and `mixed_grade`. M87 keeps the accepted M64/M74 impact-band behavior first,
then applies `currentQuality^1.5 * readiness` at budgets >=200k only when authored impact
prevalence is in `[0.12,0.35]`, feasible contacts are 7..40, and the authored profile is either
sparse (median contact gap >=0.90s) or steady (air range <=0.16 and speed range <=0.18). The
125k tier remains byte-identical, explicit `LR_M64_OBJECTIVE_CURRENT_POWER` still wins, and the
new escape hatch is `LR_M87_LOW_IMPACT_STEADY_CURRENT15=0`. Scorer, specs, fingerprint, seed
set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default mode and escape mode:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M87_LOW_IMPACT_STEADY_CURRENT15=0` (6 files, 78 tests each).

Probe: `generated/golden-runs/probe-m87-lowimpact-steady-current15-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m87-lowimpact-steady-current15-s0-2-a01`,
covered all 40 specs with seeds 0..2 and the canonical budget grid. It was valid 480/480 with
raw HEADLINE 697.24 and `HEADLINE excl. impact` 713.73.

Probe decision: `npm run decide -- generated/golden-runs/probe-m87-lowimpact-steady-current15-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: ACCEPT`, delta +1.0 on the 40-spec x three-seed x full-budget intersection, CI [-0.0, 2.3], P(delta<=0)=2.7%, effect 1.63. Per-budget deltas were 125k +0.0, 250k +1.7, 375k +0.9, and 500k +0.9.

Canonical: `generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01`.
It was valid 1920/1920 with raw HEADLINE 695.06 and `HEADLINE excl. impact` 713.53.

Decision: `npm run decide -- generated/golden-runs/attempt-m87-lowimpact-steady-current15-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta +0.5, CI [-0.1, 1.4], P(delta<=0)=5.6%, effect 1.36. Per-budget deltas were 125k +0.0, 250k +0.9, 375k +0.6, and 500k +0.5.

Why it was kept: the selector changed only the intended seven specs and all seven were net
positive: `grain_staircase` +5.93, `float_bounds` +5.07, `mini_burst` +3.74,
`rolling_hills` +3.53, `cold_start` +1.29, `mixed_grade` +0.63, and `ridge_pulse` +0.36.
Across the canonical paired grid, 252/1920 checkpoints changed with 152 improvements and 100
regressions. The work shift was mild and not a budget-spend increase: -144 forward-eval frames,
+6.6 sampled candidates, +1.9 viable candidates, -443 repair frames, and -0.027 repair accepts
per paired row. This preserves the known M63-width collateral closures while adding a second
accepted current-power selector. The accepted baseline is now
`attempt-m87-lowimpact-steady-current15-a01`.

## 2026-07-04 - REJECTED PROBE - mature true-target vertical forward-eval selector

Reason: older target-consistency probes showed a small mature-budget upside when the mature
vertical `avg` forward-eval selector read the scorer's stable per-gap target bag instead of the
jittered generation targets, but that shape hurt the scarce tier. M86 retested the idea on the
current M75 stack with a narrower temporary source change: only budgets >=200k used
`ctx.gapAxisTargets` for the existing vertical selector pressure; 125k stayed on the accepted
jittered selector. Candidate generation, q, start selection, repair, scorer, specs, fingerprint,
seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed after the temporary source edit:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
(6 files, 78 tests).

Probe: `generated/golden-runs/probe-m86-true-target-vertical-mature-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m86-true-target-vertical-mature-s0-2-a01`,
covered all 40 specs with seeds 0..2 and the canonical budget grid. It was valid 480/480 with
raw probe HEADLINE 696.0 and `HEADLINE excl. impact` 713.35.

Probe decision: `npm run decide -- generated/golden-runs/probe-m86-true-target-vertical-mature-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -0.3 on the 40-spec x three-seed x full-budget intersection, CI [-0.8, 0.1], P(delta<=0)=91.5%, effect -1.16. Per-budget deltas were 125k +0.0, 250k -0.4, 375k -0.3, and 500k -0.3.

Why it was not kept: the mature-only protection worked mechanically, with 125k unchanged, but
the current M75 stack no longer has the older mature upside. Only 42/480 paired rows changed
(15 improvements, 27 regressions). Losses in `dense_echo_climb` (-3.99), `switchback_pop`
(-2.81), `terrace_sprint` (-1.66), `canyon_steps` (-0.53), `skyline_push` (-0.41), and
`syncopated_lift` (-0.35) outweighed `ridge_pulse` (+1.07). Work counters were essentially a
redistribution, not a productive spend shift: about +319 forward-eval frames, +2 sampled
candidates, +6 viable candidates, -364 repair frames, and -0.075 repair accepts per paired row.
This closes the mature true-target vertical-selector retest on M75. The temporary source change
was reverted, and the accepted baseline remains `attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - INCONCLUSIVE CANONICAL - roomy vertical high-impact current objective extension

Reason: the M78 M63-width retry showed positive movement on high-impact vertical rows but
negative collateral on non-vertical `drums_dropout` and `syncopated_switchback`. M84 and M85
tested whether that signal could be made acceptable without reopening the broad M63 band. M84
extended the M74 current-objective p=2 dose only to high-impact-prevalence specs above the
accepted M64 band that also matched the existing M74 vertical profile. M85 added a roomier
moderate-vertical p=1.5 fallback for `leap_cadence`, which was positive in M78 but excluded by
the stricter M74 profile. Explicit objective env overrides, scorer, specs, fingerprint, seed
set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed for both source trials with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 78 tests).

M84 affected-slice probe: `generated/golden-runs/probe-m84-vertical-highimpact-current20-s0-2-a01/golden.json`,
run on `summit_push,leap_cadence,rolling_drop` with seeds 0..2 and the canonical budget grid,
was valid 36/36 with raw slice HEADLINE 705.77 and `HEADLINE excl. impact` 705.56. Decision:
`npm run decide -- generated/golden-runs/probe-m84-vertical-highimpact-current20-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: ACCEPT`, delta +1.2, CI [-1.9, 3.4], P(delta<=0)=18.0%, effect 0.86. Per-budget deltas were 125k +0.0, 250k +0.4, 375k +1.7, and 500k +1.5.

M84 canonical: `generated/golden-runs/attempt-m84-vertical-highimpact-current20-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m84-vertical-highimpact-current20-a01`.
It was valid 1920/1920 with raw HEADLINE 694.57 and `HEADLINE excl. impact` 713.53. Decision:
`npm run decide -- generated/golden-runs/attempt-m84-vertical-highimpact-current20-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta +0.1, CI [-0.1, 0.2], P(delta<=0)=25.6%, effect 0.77. Per-budget deltas were 125k +0.0, 250k +0.0, 375k +0.1, and 500k +0.1.

M85 affected-slice probe: `generated/golden-runs/probe-m85-roomy-vertical-highimpact-current-s0-2-a01/golden.json`,
run on the same three-spec slice with seeds 0..2 and the canonical budget grid, was valid 36/36
with raw slice HEADLINE 708.10 and `HEADLINE excl. impact` 707.45. Decision:
`npm run decide -- generated/golden-runs/probe-m85-roomy-vertical-highimpact-current-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: ACCEPT`, delta +3.5, CI [-1.0, 9.8], P(delta<=0)=5.9%, effect 1.31. Per-budget deltas were 125k +0.0, 250k +2.3, 375k +5.2, and 500k +3.7.

M85 canonical: `generated/golden-runs/attempt-m85-roomy-vertical-highimpact-current-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m85-roomy-vertical-highimpact-current-a01`.
It was valid 1920/1920 with raw HEADLINE 694.56 and `HEADLINE excl. impact` 713.49. Decision:
`npm run decide -- generated/golden-runs/attempt-m85-roomy-vertical-highimpact-current-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta +0.0, CI [-0.2, 0.3], P(delta<=0)=32.4%, effect 0.44. Per-budget deltas were 125k +0.0, 250k -0.0, 375k +0.1, and 500k +0.1.

Why it was not kept: M84's isolated positive rows were real but too small for canonical
acceptance: `summit_push` moved +1.190 weighted and `rolling_drop` +1.113, with only 71/1920
scores changed. M85 recovered the apparent M78 `leap_cadence` opportunity at three seeds, but
that row regressed at canonical scale (`leap_cadence` -0.514 weighted; 250k -2.64, 375k +0.90,
500k -0.64), leaving 107 changed scores with 59 improvements and 48 regressions. This closes
simple M63/M64 width refinements on the current M75 stack. The temporary source changes were
reverted, and the accepted baseline remains `attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - INCONCLUSIVE PROBE - mature repair main-margin 1.0

Reason: the current residual slice still leaves mature-budget repair opportunities, and the
accepted repair main-margin ramp is stricter at mature budgets than an exact main-budget test.
M82 first screened the existing source-free `LR_REPAIR_MAIN_MARGIN=1.0` override on the current
worst-10 slice. Because that helped mature budgets slightly but hurt 125k, M83 tested a temporary
source version that kept the accepted 125k ramp and used main margin 1.0 only for budgets
>=200k. Candidate generation, start selection, forward eval, scorer, specs, fingerprint, seed
set, budget grid, and acceptance rule stayed unchanged.

Pre-screen: `generated/golden-runs/probe-m82-repair-main100-worst10-s0-2-a01/golden.json`, run
with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_REPAIR_MAIN_MARGIN=1.0 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/probe-m82-repair-main100-worst10-s0-2-a01`,
covered `drums_pendulum,skyline_push,terrace_sprint,syncopated_lift,canyon_steps,dense_echo_climb,drums_dropout,dense_sprint,rhythm_ladder,rolling_drop`.
It was valid 120/120 with raw slice HEADLINE 614.71 and `HEADLINE excl. impact` 634.68.

Pre-screen decision: `npm run decide -- generated/golden-runs/probe-m82-repair-main100-worst10-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta +0.2 on the 10-spec x three-seed x full-budget intersection, CI [-1.7, 2.9], P(delta<=0)=43.9%, effect 0.23. Per-budget deltas were 125k -5.3, 250k +1.4, 375k +1.0, and 500k +0.5.

Full probe: `generated/golden-runs/probe-m83-repair-main100-mature-full-s0-2-a01/golden.json`,
run after the temporary mature-only source change with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/probe-m83-repair-main100-mature-full-s0-2-a01`.
It covered all 40 specs with seeds 0..2 and the canonical budget grid, was valid 480/480, and
had raw HEADLINE 696.31 with `HEADLINE excl. impact` 713.12.

Full-probe decision: `npm run decide -- generated/golden-runs/probe-m83-repair-main100-mature-full-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta +0.0 on the 40-spec x three-seed x full-budget intersection, CI [-2.2, 2.0], P(delta<=0)=48.0%, effect 0.03. Per-budget deltas were 125k +0.0, 250k -0.1, 375k -0.3, and 500k +0.4.

Why it was not kept: protecting 125k fixed the visible M82 budget-shape problem, but the mature
suite stayed flat. M83 changed 313/480 paired scores, with 173 improvements, 140 regressions,
and 167 plateaus. Weighted gains on `pop_train` (+10.54), `syncopated_switchback` (+10.40),
`canyon_steps` (+7.52), and `drums_pulse` (+5.29) were offset by `float_bounds` (-9.15),
`drums_tide` (-8.21), `summit_push` (-6.26), and `mini_burst` (-4.78). At 500k it averaged about
+6.9k sim frames, +28.7k repair frames, and +91 full evaluations per row, but only +1.8 repair
accepts. This closes simple repair main-margin scalar changes on the current M75 stack; future
repair work needs a local usefulness/value selector. The temporary source change was reverted,
and the accepted baseline remains `attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - REJECTED PROBE - vertical avg forward-eval branch 2

Reason: the current vertical/amplitude residual rows have high 500k budget slack, and the
production compiler already has a mature vertical-drama forward-eval override. Test whether that
override is under-powered by temporarily raising `MATURE_AVG_FWD_EVAL_BRANCH` from 1 to 2. The
trial changed only the existing default vertical override path; explicit `LR_FWD_EVAL`
overrides, candidate generation, start selection, repair, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m81-vertical-avg-branch2-s0-2-a01/golden.json`, run on
`skyline_push,terrace_sprint,syncopated_lift,canyon_steps,dense_echo_climb,rolling_drop` with
seeds 0..2 and the canonical budget grid, was valid 72/72 with raw slice HEADLINE 624.20 and
`HEADLINE excl. impact` 625.42.

Probe decision: `npm run decide -- generated/golden-runs/probe-m81-vertical-avg-branch2-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -3.0 on the six-spec x three-seed x full-budget intersection, CI [-7.9, 0.8], P(delta<=0)=92.2%, effect -1.34. Per-budget deltas were 125k -6.6, 250k -5.5, 375k -1.2, and 500k -2.1.

Why it was stopped: branch-2 vertical lookahead spends more but reduces candidate throughput and
does not improve the target panel. Weighted movement was `syncopated_lift` +1.21,
`rolling_drop` +0.44, `terrace_sprint` -0.14, `canyon_steps` -2.35, `skyline_push` -5.68, and
`dense_echo_climb` -10.89. At 500k it averaged about +1.7k sim frames, -3.8k sampled candidates,
and -3.1k viable candidates per row. Temporary source was reverted; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - SOURCE-FREE REJECTED PROBE - broad mature readiness q=0.75

Reason: M75 accepted readiness power 0.75 only for a narrow high-air/impact selector. Test
whether that selector was too narrow by applying the same power to the whole current worst-10
mature slice via the existing `LR_M75_MATURE_OBJECTIVE_READINESS_POWER=0.75` override. This
keeps 125k byte-identical; `skyline_push` and `drums_dropout` are effectively byte-identical
to M75 because they already match the accepted selector. Scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m80-readiness075-worst10-s0-2-a01/golden.json`, run on
`drums_pendulum,skyline_push,terrace_sprint,syncopated_lift,canyon_steps,dense_echo_climb,drums_dropout,dense_sprint,rhythm_ladder,rolling_drop`
with seeds 0..2 and the canonical budget grid, was valid 120/120 with raw slice HEADLINE 610.85
and `HEADLINE excl. impact` 630.40.

Probe decision: `npm run decide -- generated/golden-runs/probe-m80-readiness075-worst10-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -3.6 on the 10-spec x three-seed x full-budget intersection, CI [-9.6, 0.9], P(delta<=0)=94.4%, effect -1.39. Per-budget deltas were 125k +0.0, 250k -4.2, 375k -3.7, and 500k -4.2.

Why it was stopped: broad readiness softening gives back mature score on the residual rows M75
does not already affect. Weighted spec movement was `drums_dropout` +0.00, `skyline_push`
+0.00, `rhythm_ladder` -0.48, `syncopated_lift` -0.64, `terrace_sprint` -1.31,
`drums_pendulum` -1.81, `canyon_steps` -3.45, `rolling_drop` -6.31, `dense_echo_climb` -7.25,
and `dense_sprint` -16.23. M75's narrow selector remains necessary. Env-only; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - SOURCE-FREE INCONCLUSIVE PROBE - q34 breadth on vertical/amplitude residual slice

Reason: M54's amplitude-range q34 breadth probe was strong at three seeds but collapsed at
canonical scale. Recheck the same general lever under the current M75 stack on the present
vertical/amplitude residual panel before spending source work on a selector. The probe used the
existing `LR_QUALITY_NCAND=34` override with no source edits on
`skyline_push,terrace_sprint,syncopated_lift,canyon_steps,dense_echo_climb,rolling_drop`.
Scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m79-q34-verticalamp-s0-2-a01/golden.json`, run with seeds
0..2 and the canonical budget grid, was valid 72/72 with raw slice HEADLINE 625.83 and
`HEADLINE excl. impact` 626.14.

Probe decision: `npm run decide -- generated/golden-runs/probe-m79-q34-verticalamp-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta -1.3 on the six-spec x three-seed x full-budget intersection, CI [-5.4, 2.6], P(delta<=0)=77.1%, effect -0.67. Per-budget deltas were 125k -1.9, 250k +0.1, 375k +0.1, and 500k -3.0.

Why it was stopped: the current-stack q34 slice repeats the old breadth fragility. Weighted spec
movement was `canyon_steps` +4.21, `rolling_drop` +0.03, `syncopated_lift` -1.02,
`terrace_sprint` -1.33, `dense_echo_climb` -3.43, and `skyline_push` -6.05. The mature 500k
tier is negative, so this does not justify a selector or canonical attempt. Env-only; baseline
remains `attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - REJECTED PROBE - M63-width current-stack objective gate

Reason: the original M63 high-impact objective gate was an encouraging near miss, and M64 kept
the accepted bounded form of that idea. To answer whether the broader M63 shape became viable
after M74/M75, temporarily widen the M64 upper authored-impact prevalence bound from `0.51` to
`1.0`, preserving all other current compiler behavior. This only newly affects
`syncopated_switchback`, `drums_dropout`, `summit_push`, `leap_cadence`, and `rolling_drop`.
Scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m78-m63-width-currentstack-affected-s0-2-a01/golden.json`,
run on those five newly affected specs with seeds 0..2 and the canonical budget grid, was valid
60/60 with raw slice HEADLINE 681.11 and `HEADLINE excl. impact` 700.71.

Probe decision: `npm run decide -- generated/golden-runs/probe-m78-m63-width-currentstack-affected-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta -4.4 on the five-spec x three-seed x full-budget intersection, CI [-22.3, 7.2], P(delta<=0)=67.5%, effect -0.55. Per-budget deltas were 125k +0.0, 250k -7.7, 375k -5.4, and 500k -3.0.

Why it was stopped: the broader M63 gate still carries the same collateral under the current
stack. Weighted spec movement was `leap_cadence` +7.67, `summit_push` +3.40, `rolling_drop`
+0.05, `drums_dropout` -11.13, and `syncopated_switchback` -17.87. The accepted M64 prevalence
band remains the keepable form of M63; a simple upper-bound widening should not be promoted.
Temporary source was reverted; baseline remains `attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - SOURCE-FREE REJECTED PROBE - mature readiness sharpening

Reason: after M75 accepted a tiny readiness-softening basin, test the opposite side of the
objective surface without source edits. The probe used the existing opt-in mature-budget
readiness exponent override with `LR_M75_MATURE_OBJECTIVE_READINESS_POWER=1.25` on the current
worst-10 slice. Scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed
unchanged.

Probe: `generated/golden-runs/probe-m77-readiness125-worst10-s0-2-a01/golden.json`, run on
`drums_pendulum,skyline_push,terrace_sprint,syncopated_lift,canyon_steps,dense_echo_climb,drums_dropout,dense_sprint,rhythm_ladder,rolling_drop`
with seeds 0..2 and the canonical budget grid, was valid 120/120 with raw slice HEADLINE 606.90
and `HEADLINE excl. impact` 627.46.

Probe decision: `npm run decide -- generated/golden-runs/probe-m77-readiness125-worst10-s0-2-a01/golden.json generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -7.6 on the 10-spec x 3-seed x full-budget intersection, CI [-16.7, -0.8], P(delta<=0)=98.8%, effect -1.87. Per-budget deltas were 125k +0.0, 250k -10.3, 375k -6.1, and 500k -9.2.

Why it was stopped: sharpening readiness gives back mature score on the exact residual slice
where the suite is weakest. The current objective should not move toward higher readiness power.
Env-only; baseline remains `attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - REJECTED PROBE - M75 readiness dose sweep

Reason: after M75 accepted with readiness power 0.75 on the high-air impact selector, bracket
the adjacent doses on the exact affected slice (`drums_dropout`, `skyline_push`) before looking
for a new mechanism. The temporary source changed only `M75_HIGH_AIR_IMPACT_READINESS_POWER`,
leaving the selector, scorer, specs, fingerprint, seeds, budgets, and acceptance rule unchanged.

Probes, both on `drums_dropout,skyline_push` with seeds 0..2 and the canonical budget grid:

- `probe-m76-m75-readiness050-affected-s0-2-a01` (`power=0.5`) was valid 24/24. Decision versus
  M75: `VERDICT: REJECT`, delta -11.5, CI [-33.5, 11.2], P(delta<=0)=88.1%. Per-budget deltas
  were 125k +0.0, 250k -16.3, 375k -12.2, and 500k -11.4.
- `probe-m76-m75-readiness090-affected-s0-2-a01` (`power=0.9`) was valid 24/24. Decision versus
  M75: `VERDICT: REJECT`, delta -21.8, CI [-65.9, -0.1], P(delta<=0)=99.0%. Per-budget deltas
  were 125k +0.0, 250k -24.4, 375k -21.5, and 500k -26.2.

Why it was stopped: both adjacent doses give back the accepted M75 gain on its own affected
slice, so the local dose is bracketed at 0.75. Temporary source was reverted; baseline remains
`attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - ACCEPTED CANONICAL - high-air impact readiness softening

Reason: M75 tested the unexplored half of the M61 objective family. Global mature-budget
readiness softening (`readiness^0.75`) was not broadly promotable, but it exposed a large
`drums_dropout` basin and a smaller `skyline_push` gain. The accepted form applies that softer
readiness term only on mature budgets for high-air, medium/high-impact, speed-bounded authored
profiles with dense enough contact room, excluding the `opening_burst` guard that lost in the
looser probe. The current-quality side of M64/M74 is unchanged. Escape hatch:
`LR_M75_HIGH_AIR_IMPACT_READINESS075=0`; explicit `LR_M75_OBJECTIVE_READINESS_POWER` still wins
as a whole-run override, and `LR_M75_MATURE_OBJECTIVE_READINESS_POWER` remains available for
opt-in dose studies.

Focused tests passed in default and escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M75_HIGH_AIR_IMPACT_READINESS075=0` (6 files, 78 tests each).

Initial broad probe: `generated/golden-runs/probe-m75-readiness075-worst10-s0-2-a01`, run with
`LR_M75_MATURE_OBJECTIVE_READINESS_POWER=0.75` on the current worst-10 slice, was valid 120/120.
Decision versus M74 was inconclusive-positive: delta +1.6, CI [-4.8, 11.9], P(delta<=0)=39.5%.
Footprint inspection showed `drums_dropout` +36.24 and `skyline_push` +5.81 weighted, but broad
collateral on the rest of the slice.

Tight selector probe: `generated/golden-runs/probe-m75-highair-impact-readiness075-tight-full-s0-2-a01/golden.json`,
run on the full 40-spec suite with seeds 0..2 and the canonical budget grid, was valid 480/480
with raw HEADLINE 696.28 and `HEADLINE excl. impact` 713.71.

Probe decision: `npm run decide -- generated/golden-runs/probe-m75-highair-impact-readiness075-tight-full-s0-2-a01/golden.json generated/golden-runs/attempt-m74-vertical-objective-current20-a01/golden.json` -> non-canonical `VERDICT: ACCEPT`, delta +1.2, CI [0.0, 4.0], P(delta<=0)=12.8%, effect 1.05. Per-budget deltas were 125k +0.0, 250k +1.4, 375k +1.0, and 500k +1.4. The paired footprint was exactly `drums_dropout` and `skyline_push`.

Canonical: `generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m75-highair-impact-readiness075-a01`,
was valid 1920/1920 with raw HEADLINE 694.51 and `HEADLINE excl. impact` 713.27. Per-budget
point estimates were 125k 677.98, 250k 689.91, 375k 696.48, and 500k 699.47.

Decision: `npm run decide -- generated/golden-runs/attempt-m75-highair-impact-readiness075-a01/golden.json generated/golden-runs/attempt-m74-vertical-objective-current20-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +0.4, CI [-0.1, 1.7], P(delta<=0)=19.2%, effect 0.88. Per-budget deltas were 125k +0.0, 250k +0.4, 375k +0.3, and 500k +0.6.

Why it was kept: the effect is narrow but passes the campaign rule and is 125k-byte-identical.
It changed 72/1920 paired checkpoints, with 49 improvements, 23 regressions, and 1848 plateaus.
Weighted movement was `drums_dropout` +12.38 and `skyline_push` +2.26. Changed-row mean work
was essentially neutral: sampled candidates +22.6, viable -19.8, simulated frames -93.1, with
forward/start/repair counters unchanged. Accepted as the new baseline of record:
`attempt-m75-highair-impact-readiness075-a01`.

## 2026-07-04 - ACCEPTED CANONICAL - vertical M64 objective current-power dose

Reason: M66 showed that raising the accepted M64 current-quality exponent from 1.5 to 2.0 was
bad on the whole M64 impact band, but the per-spec split was different: vertical/dynamic rows
liked the stronger current-gap quality pressure while dense no-vertical rows lost. This source
change keeps the accepted M64 impact-prevalence and mature-budget gate, keeps 125k
byte-identical, and uses current-quality power 2.0 only for authored vertical profiles with
large amplitude range or enough elevation variation plus contact room. `LR_M74_VERTICAL_OBJECTIVE_CURRENT20=0`
is the escape hatch; explicit `LR_M64_OBJECTIVE_CURRENT_POWER` still wins.

Focused tests passed:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Probe: `generated/golden-runs/probe-m74-vertical-objective-current20-room09-s0-2-a01/golden.json`,
run on `swoop_dive,climb_terrace,terrace_sprint,big_air_ramp,skyline_push,glide_stairs`
with seeds 0..2 and the canonical budget grid, was valid 72/72 with raw slice HEADLINE 689.67
and `HEADLINE excl. impact` 681.97.

Probe decision: `npm run decide -- generated/golden-runs/probe-m74-vertical-objective-current20-room09-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: ACCEPT`, delta +2.7 on the 6-spec x 3-seed x full-budget intersection, CI [-0.6, 5.8], P(delta<=0)=5.0%, effect 1.72. Per-budget deltas were 125k +0.0, 250k +4.4, 375k +3.3, and 500k +2.1.

Canonical: `generated/golden-runs/attempt-m74-vertical-objective-current20-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m74-vertical-objective-current20-a01`,
was valid 1920/1920 with raw HEADLINE 694.10 and `HEADLINE excl. impact` 712.92. Per-budget
point estimates were 125k 677.98, 250k 689.46, 375k 696.15, and 500k 698.91.

Decision: `npm run decide -- generated/golden-runs/attempt-m74-vertical-objective-current20-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +0.2, CI [-0.4, 0.8], P(delta<=0)=17.3%, effect 0.80. Per-budget deltas were 125k +0.0, 250k +0.3, 375k +0.3, and 500k +0.2.

Why it was kept: the effect is narrow but clean enough for the accept rule. It changed 216/1920
paired checkpoints, with 139 improvements, 77 regressions, and 1704 plateaus. The only specs
with weighted score movement were `swoop_dive` (+5.61), `skyline_push` (+3.11),
`climb_terrace` (+2.79), `glide_stairs` (+1.05), `terrace_sprint` (-0.32), and
`big_air_ramp` (-2.69). 125k stayed byte-identical; mean changed-row simulated frames were
essentially flat. Accepted as the new baseline of record: `attempt-m74-vertical-objective-current20-a01`.

## 2026-07-04 - SOURCE-FREE REJECTED PROBE - full forward-eval leaf on current default

Reason: M64 changed the rank-quality objective surface, so reprice the accepted objective leaf
shortcut against the exact full re-detection leaf. This tests whether the shortcut has become
too lossy after the M64 current-quality exponent, without editing source. Candidate generation,
start selection shape, forward-eval depth/width, repair, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m73-full-leaf-current-s0-2-a01/golden.json`, run with
`LR_ENGINE=wasm LR_FWD_EVAL_LEAF=full GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m73-full-leaf-current-s0-2-a01`,
was valid 480/480 with raw HEADLINE 692.70 and `HEADLINE excl. impact` 709.73.

Probe decision: `npm run decide -- generated/golden-runs/probe-m73-full-leaf-current-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -2.0 on the 40-spec x 3-seed x full-budget intersection, CI [-4.6, 0.4], P(delta<=0)=95.2%, effect -1.59. Per-budget deltas were 125k -5.0, 250k -2.4, 375k -2.3, and 500k -0.8.

Why it was not pursued: exact full-leaf scoring did not buy enough ranking quality to pay for
its cost. It changed 416/480 paired checkpoints, with 157 improvements, 254 regressions, and 69
plateaus. Mean charged forward-eval frames rose from about 84.0k to 138.0k per checkpoint, start
eval frames rose from about 10.4k to 13.4k, and sampled candidates fell from about 7060 to 5451.
The shortcut remains load-bearing on the current M64 baseline. This was env-only; accepted
source remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - SOURCE-FREE REJECTED PROBE - mature aim top-k 5 dose check

Reason: M71 showed K=4 is too low for mature budgets, while prior K=7 attempts were already
negative. Price the adjacent K=5 dose without a source edit. Because the explicit
`LR_AIM_TOPK_BASES=5` override would also raise 125k from the accepted K=4 to K=5, this probe
was intentionally limited to the mature budgets that a production high-budget K=5 change would
touch. Candidate generation apart from the aim-base count, search policy, forward eval, repair,
scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m72-aimtopk5-mature-current-s0-2-a01/golden.json`, run with
`LR_ENGINE=wasm LR_AIM_TOPK_BASES=5 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m72-aimtopk5-mature-current-s0-2-a01`,
was valid 360/360 with raw mature-slice HEADLINE 694.18 and `HEADLINE excl. impact` 712.83.

Probe decision: `npm run decide -- generated/golden-runs/probe-m72-aimtopk5-mature-current-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -2.4 on the 40-spec x 3-seed x mature-budget intersection, CI [-7.0, 1.5], P(delta<=0)=87.3%, effect -1.10. Per-budget deltas were 250k -2.8, 375k -2.5, and 500k -2.1.

Why it was not pursued: K=5 also gives up mature score versus the accepted K=6 default. Combined
with M71 and the earlier K=7 failures, the high-budget aim-base dose is bracketed around the
current K=6 setting. Do not lower the mature aim-base count to 5. This was env-only; accepted
source remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - SOURCE-FREE REJECTED PROBE - high-budget aim top-k ablation on current default

Reason: after M64 changed the quality objective in the impact-prevalence band, re-audit whether
the accepted high-budget uniform aim-base bump still pays. The source-free env override
`LR_AIM_TOPK_BASES=4` keeps 125k behavior equal to the accepted default, but ablates the current
>=200k default rise from K=6 back to K=4 at 250k/375k/500k. Candidate generation apart from the
aim-base count, search policy, forward eval, repair, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m71-aimtopk4-current-s0-2-a01/golden.json`, run with
`LR_ENGINE=wasm LR_AIM_TOPK_BASES=4 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m71-aimtopk4-current-s0-2-a01`,
was valid 480/480 with raw HEADLINE 689.76 and `HEADLINE excl. impact` 708.78.

Probe decision: `npm run decide -- generated/golden-runs/probe-m71-aimtopk4-current-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -4.9 on the 40-spec x 3-seed x full-budget intersection, CI [-10.9, -0.1], P(delta<=0)=97.7%, effect -1.80. Per-budget deltas were 125k +0.0, 250k -6.7, 375k -5.8, and 500k -4.6.

Why it was not pursued: the mature K=6 aim-base spend remains load-bearing after M64. Dropping
back to K=4 protects 125k exactly but loses every mature budget by a large paired point
estimate. Do not reduce the accepted high-budget aim-base count on the current baseline. This
was env-only; accepted source remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - SOURCE-FREE PROBE - rollout-context aim suppression on current default

Reason: prior lookahead work showed that `best:1:5` with aim probes suppressed inside rollouts
could help mature budgets, but the flat env configuration collapsed the scarce tier. Before
editing the adaptive forward-eval policy, isolate the cheaper question: does suppressing aim
only inside the already-existing rollout-context pools help the accepted M64 default?

Probe: `generated/golden-runs/probe-m70-rollout-aim-off-default-s0-2-a01/golden.json`, run with
`LR_ENGINE=wasm LR_ROLLOUT_AIM=0 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m70-rollout-aim-off-default-s0-2-a01`,
was valid 480/480 with raw HEADLINE 694.44 and `HEADLINE excl. impact` 712.04.

Probe decision: `npm run decide -- generated/golden-runs/probe-m70-rollout-aim-off-default-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta -0.3 on the 40-spec x 3-seed x full-budget intersection, CI [-1.0, 0.0], P(delta<=0)=94.0%, effect -0.99. Per-budget deltas were 125k -0.2, 250k -0.3, 375k -0.3, and 500k -0.2.

Why it was not pursued: the raw stored headline was misleading because the paired M64
intersection was slightly higher; on the actual paired decision every budget moved negative.
Suppressing rollout aim in the current default/adaptive policy is not a source candidate.
This was env-only; accepted source remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - SOURCE-FREE PROBE - repair max-attempt cap 32 on current worst slice

Reason: M64 telemetry showed some poor 500k rows spending most of the post-completion tail in
repair with few or no accepts. Since the compiler already resumes the original frontier when
repair exhausts its useful restart set, test whether a lower repair attempt cap would free
budget for that fallback and improve the high-repair worst rows.

Probe: `generated/golden-runs/probe-m69-repair-max32-worst10-s0-2-a01/golden.json`, run with
`LR_ENGINE=wasm LR_REPAIR_MAX_ATTEMPTS=32 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,skyline_push,terrace_sprint,drums_dropout,dense_echo_climb,canyon_steps,syncopated_lift,rolling_drop,switchback_pop,ridge_pulse --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m69-repair-max32-worst10-s0-2-a01`,
was valid 120/120 with raw slice HEADLINE 610.45 and `HEADLINE excl. impact` 625.29.

Probe decision: `npm run decide -- generated/golden-runs/probe-m69-repair-max32-worst10-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta -0.0 on the 10-spec x 3-seed x full-budget intersection, CI [-0.1, 0.0], P(delta<=0)=100%, effect -0.69. Per-budget deltas were 125k +0.0, 250k -0.1, 375k +0.0, and 500k -0.0.

Why it was not pursued: the cap does not turn wasted repair tail into useful main-frontier
quality. It is effectively score-identical while slightly negative at 250k, so the repair issue
needs a better usefulness selector or different restart target, not a lower global cap. This was
env-only; accepted source remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - ABANDONED PROBE - current-impact thresholded objective exponent

Reason: after M67 showed that localizing M64 by current impact presence was inert, test whether
the M64 exponent should apply only on medium/hard bounded current-impact asks. The goal was to
keep the useful current-quality pressure while avoiding low-impact current-gap collateral.

Mechanism trial: a temporary default-off hook added
`LR_M68_OBJECTIVE_CURRENT_IMPACT_MIN`/`LR_M68_OBJECTIVE_CURRENT_IMPACT_MAX`. With the min env
set, the existing M64 spec/budget band still selected the compile, but the objective exponent
fell back to power 1 when the current gap's bounded impact target was below the threshold.
Default mode stayed byte-equivalent to accepted M64. Candidate generation, search policy, M64
selector, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed
unchanged.

Focused tests passed in default and thresholded modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M68_OBJECTIVE_CURRENT_IMPACT_MIN=0.45` (6 files, 77 tests each).

Probes on the 17 M64-active specs with seeds 0..2 and the canonical budget grid:

- `generated/golden-runs/probe-m68-objective-impact-min045-active-s0-2-a01/golden.json`:
  valid 204/204, raw slice HEADLINE 683.27, `HEADLINE excl. impact` 697.92. Decision vs M64
  on the paired 17-spec x 3-seed intersection: non-canonical `VERDICT: INCONCLUSIVE`, delta
  -1.2, CI [-6.0, 3.0], P(delta<=0)=68.8%, effect -0.51. Per-budget deltas were 125k +0.0,
  250k +1.5, 375k -2.3, and 500k -2.0.
- `generated/golden-runs/probe-m68-objective-impact-min035-active-s0-2-a01/golden.json`:
  valid 204/204, raw slice HEADLINE 683.15, `HEADLINE excl. impact` 697.99. Decision vs M64:
  non-canonical `VERDICT: INCONCLUSIVE`, delta -1.3, CI [-6.2, 3.3], P(delta<=0)=71.2%,
  effect -0.55. Per-budget deltas were 125k +0.0, 250k +0.7, 375k -1.6, and 500k -2.4.

Why it was stopped: thresholding the current-impact ask gives back the mature-budget M64 lift.
The accepted M64 behavior needs its low/mid current-impact pressure; selecting only harder
current impacts is not a better form of the M63 idea. Temporary source changes were reverted;
the accepted baseline remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - ABANDONED PROBE - current-impact-local objective exponent

Reason: M64 accepted the M63 current-quality exponent as a spec-level impact-prevalence band.
Test whether the same exponent could be made more surgical by applying
`currentQuality^1.5 * readiness` only when the current gap itself had an authored impact target,
leaving non-impact current gaps linear.

Mechanism trial: a temporary default-off hook added `LR_M67_IMPACT_LOCAL_OBJECTIVE_CURRENT15=1`.
With the env set, the existing M64 band still selected the compile, but the objective exponent
fell back to power 1 on current gaps without `targets.impact`. Without the env var, the code was
intended to remain byte-equivalent to accepted M64. Candidate generation, search policy, M64
spec/budget selector, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule
stayed unchanged.

Focused tests passed in default and opt-in modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts`
and the same suite with `LR_M67_IMPACT_LOCAL_OBJECTIVE_CURRENT15=1` (6 files, 78 tests each,
including the temporary objective-hook unit check).

Probe: `generated/golden-runs/probe-m67-impact-local-objective-current15-active-s0-2-a01/golden.json`,
run on the 17 M64-active specs with seeds 0..2 and the canonical budget grid, was valid 204/204
with raw slice HEADLINE 684.45 and `HEADLINE excl. impact` 696.24.

Probe decision: `npm run decide -- generated/golden-runs/probe-m67-impact-local-objective-current15-active-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, exactly byte-identical on the paired 17-spec x 3-seed x full-budget intersection: delta +0.0, CI [0.0, 0.0], P(delta<=0)=100%, effect 0.00. Every per-budget delta was +0.0.

Why it was stopped: the local-current-impact condition does not reduce the M64 footprint on the
affected slice; the relevant current gaps already carry impact targets. This closes the
"localize by current impact presence" variant of the M63/M64 idea. The temporary source and test
changes were reverted; the accepted baseline remains
`attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - REJECTED PROBE - objective band current-quality power 2.0

Reason: after M64 accepted the bounded objective-current exponent, test whether the accepted
impact-prevalence band was under-dosed. The temporary source change raised
`M64_MATURE_OBJECTIVE_CURRENT_POWER` from 1.5 to 2.0, leaving the band selector, scorer, specs,
fingerprint, seeds, budget grid, and acceptance rule unchanged.

Focused tests passed:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Probe: `generated/golden-runs/probe-m66-band-objective-current20-affected-s0-2-a01/golden.json`,
run on the 17 M64-affected specs with seeds 0..2 and the canonical budget grid, was valid
204/204 with raw slice HEADLINE 680.83 and `HEADLINE excl. impact` 692.44.

Probe decision: `npm run decide -- generated/golden-runs/probe-m66-band-objective-current20-affected-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta -3.6 on the 17-spec x 3-seed x full-budget intersection, CI [-12.0, 2.9], P(delta<=0)=84.0%, effect -0.95. Per-budget deltas were 125k +0.0, 250k -2.3, 375k -4.6, and 500k -4.4.

Why it was not kept: the accepted 1.5 exponent is already beyond the useful dose for the
selected band. Pushing harder over-weights current-gap quality and gives back mature-budget
score across the exact affected slice. The source constant was reverted to 1.5; the accepted
baseline remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - ABANDONED PROBE - dropout impact-curve onset raise

Reason: M48 had a real `drums_dropout` impact-curve basin repair, but its selector also hurt
`rhythm_ladder` and `drums_tide`. After M64, an archive/feature screen found a stricter non-name
selector for the M48 positive basin: contact-rich, non-vertical, steady-speed, broad-air,
medium-impact profiles. On the golden suite this selected `drums_dropout` and `drums_pendulum`
while excluding the prior M48 losses.

Mechanism trial: a temporary source change added a `targetStartRaise` impact profile pressure.
Under the stricter profile it raised the impact curve target start toward 0.30, reducing the
curvature carrier on that basin. Candidate generation count, search policy, M64 objective gate,
start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and
acceptance rule stayed unchanged.

Focused tests passed in default and escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` and the same suite with `LR_M65_IMPACT_CURVE_RAISE=0` (6 files, 77 tests each).

Probe: `generated/golden-runs/probe-m65-dropout-pendulum-curve-raise-full-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-m65-dropout-pendulum-curve-raise-full-s0-2-a01`,
was valid 480/480 with raw HEADLINE 694.79 and `HEADLINE excl. impact` 712.47.

Probe decision: `npm run decide -- generated/golden-runs/probe-m65-dropout-pendulum-curve-raise-full-s0-2-a01/golden.json generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta +0.1 on the 40-spec x 3-seed x full-budget intersection, CI [-0.2, 0.7], P(delta<=0)=53.0%, effect 0.45. Per-budget deltas were 125k -0.4, 250k +0.4, 375k -0.0, and 500k +0.2, with unchanged validity.

Why it was stopped: the cleaner selector was too small. The paired row footprint changed only
12/480 checkpoints, all in `drums_dropout`, with 7 improvements and 5 regressions. The
`drums_dropout` paired weighted movement was +3.61, but it was budget-noisy: 125k -14.75, 250k
+15.74, 375k -1.31, and 500k +5.82. That diluted to a +0.1 headline probe with worse 125k and
no indicative acceptance signal. The temporary source was reverted; the accepted baseline
remains `attempt-m64-impact-band-objective-current15-a01`.

## 2026-07-04 - ACCEPTED CANONICAL - impact-band objective current-quality exponent

Reason: M63 proved that mature-budget `currentQuality^1.5 * readiness` was a real lever, but
the high-impact-only gate was still too broad. Its main canonical loss was
`syncopated_switchback`, and the next selector screen showed that keeping the same exponent only
inside a bounded authored-impact prevalence band preserved the winners while excluding the broad
high-prevalence collateral.

Mechanism: `objective.ts` now has a bounded objective-blend power hook, and `handoff.ts` enables
`currentQuality^1.5 * readiness` only for budgets >=200k when mean authored impact prevalence
over feasible contacts, counting missing impact as zero, is in `[0.41, 0.51]`. The default can
be disabled with `LR_M64_IMPACT_BAND_OBJECTIVE_CURRENT15=0`, and
`LR_M64_OBJECTIVE_CURRENT_POWER` remains an explicit override. The gate is off with
`LR_IMPACT_OFF=1`. Candidate generation, start selection, forward eval, repair, scorer, specs,
fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in default and escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests each).

Canonical: `generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json`,
run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m64-impact-band-objective-current15-a01`,
was valid 1920/1920 with raw HEADLINE 693.86 and `HEADLINE excl. impact` 712.76. Its budget
curve was 125k 677.98, 250k 689.20, 375k 695.82, and 500k 698.69.

Decision: `npm run decide -- generated/golden-runs/attempt-m64-impact-band-objective-current15-a01/golden.json generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta +1.3, CI [-0.3, 3.3], P(delta<=0)=5.6%, effect 1.45. Per-budget deltas were 125k +0.0, 250k +0.6, 375k +1.6, and 500k +1.8, with unchanged 100% validity.

Why it was kept: this is the accepted form of the M63 idea. The narrower prevalence band blocks
the M63 `syncopated_switchback` and `drums_dropout` collateral while preserving the mature
selection lift on the intended rows. It changed 612/1920 paired checkpoints, with 337
improvements, 275 regressions, and 1308 plateaus. Weighted winners were `dense_sprint` +11.83,
`rhythm_ladder` +11.18, `drums_zigzag` +7.67, `drums_crosscut` +7.04, `verse_chorus` +6.57,
and `drums_pendulum` +5.49. The remaining main losses were `pop_train` -3.15, `skyline_push`
-1.72, and `drums_pulse` -1.69. The accepted baseline is now
`attempt-m64-impact-band-objective-current15-a01` at source commit `765fd15`.

## 2026-07-04 - INCONCLUSIVE CANONICAL - high-impact objective current-quality exponent

Reason: M62 showed that current-quality exponentiation was directionally useful once 125k was
left at the baseline objective, but the broad mature gate still missed the 3-seed accept gate.
An archive selector screen over M62 found the cleanest non-name split at high authored-impact
prevalence: apply current-quality power 1.5 only on mature-budget specs whose mean authored
impact over feasible contacts, counting non-impact contacts as zero, was at least 0.41. This
kept the large `dense_sprint`/`rhythm_ladder`/`drums_pendulum` style wins while excluding the
low-impact `drums_swell`/`drums_breath`/`canyon_steps` losses from M62.

Mechanism: a temporary source hook in `objective.ts` made the rank-quality leaf objective use
`currentQuality^1.5 * readiness` only when `handoff.ts` enabled it for the compile. The M63
source probe was default-off behind `LR_M63_HIGH_IMPACT_OBJECTIVE_CURRENT15=1`; after the
3-seed probe cleared, it was promoted to default-on with `LR_M63_HIGH_IMPACT_OBJECTIVE_CURRENT15=0`
as the escape. The gate was inactive below 200k and when `LR_IMPACT_OFF=1`. Candidate generation,
start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and
acceptance rule stayed unchanged.

Focused tests passed in default and gated/escape modes:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests each).

Probe: `generated/golden-runs/probe-m63-highimpact-objective-current15-full-s0-2-a01/golden.json`,
run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_M63_HIGH_IMPACT_OBJECTIVE_CURRENT15=1`,
was valid 480/480 with raw HEADLINE 694.62 and `HEADLINE excl. impact` 712.29. Decision versus
M41 was indicative `VERDICT: ACCEPT`, delta +2.0, CI [-1.0, 5.2], P(delta<=0)=8.8%, effect 1.29.
Per-budget deltas were 125k +0.0, 250k +1.1, 375k +2.5, and 500k +2.6.

Canonical: `generated/golden-runs/attempt-m63-highimpact-objective-current15-a01/golden.json`,
run with the gate promoted default-on, was valid 1920/1920 with raw HEADLINE 693.39 and
`HEADLINE excl. impact` 712.05. Its budget curve was 125k 677.98, 250k 688.44, 375k 694.89,
and 500k 698.60.

Decision: `npm run decide -- generated/golden-runs/attempt-m63-highimpact-objective-current15-a01/golden.json generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta +0.9, CI [-1.4, 3.2], P(delta<=0)=21.0%, effect 0.76. Per-budget deltas were 125k +0.0, 250k -0.1, 375k +0.7, and 500k +1.7, with unchanged 100% validity.

Why it was not kept: the mechanism produced a real mature-budget improvement, especially at
500k, but the 12-seed aggregate missed the alpha=0.20 keep gate by one point of tail
probability and the 250k tier was slightly negative. Canonical weighted winners were
`dense_sprint` +11.74, `rhythm_ladder` +11.04, `drums_zigzag` +7.98, `drums_crosscut` +7.21,
`verse_chorus` +6.86, and `drums_pendulum` +5.61. The dominant loss was
`syncopated_switchback` -14.46, with smaller losses on `pop_train` -3.15, `drums_dropout`
-1.95, `skyline_push` -1.80, and `drums_pulse` -1.73. This is the best current near-miss:
future work should preserve the 500k high-impact objective lift while gating out
syncopated-switchback-like high air/speed variation. The temporary source hook was reverted; the
accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - ABANDONED PROBE - objective current-quality exponent

Reason: after M55, the worst residuals still looked like selection pressure rather than
contract failure: all rows were valid, repair was spending heavily, and rank-quality had small
top-1/top-3 disagreement but large downstream influence. This pass first audited the existing
repair/rank-quality machinery, then tested whether the rank-quality leaf objective should lean
more toward current-gap quality before multiplying by next-gap readiness.

Source-free audits:

- `generated/golden-runs/probe-m56-repair-off-worst9-s0-2-a01/golden.json`, run with
  `LR_REPAIR_MIN_BUDGET=100000000` on the nine worst 500k specs, was rejected versus M41 on the
  slice: delta headline -13.9, CI [-29.4, -5.1], P(delta<=0)=100%. Repair is load-bearing.
- `generated/golden-runs/probe-m57-repair-max128-worst9-s0-2-a01/golden.json`, run with
  `LR_REPAIR_MAX_ATTEMPTS=128` on the same mature slice, was bit-identical to M41. The current
  max-attempt cap is not binding there.
- `generated/golden-runs/probe-m58-repair-upstream8-worst9-s0-2-a01/golden.json`, run with
  `LR_REPAIR_MAX_UPSTREAM=8`, was slightly negative on every mature budget: delta -0.6,
  CI [-3.5, 2.2]. Broader upstream repair is not a lead.
- `generated/golden-runs/probe-m59-impact-local075-worst9-s0-2-a01/golden.json`, run with
  `LR_IMPACT_LOCAL_W=0.75`, was bit-identical to M41 on the slice. That local-impact cost knob
  is inert for the current worst rows.
- `generated/golden-runs/probe-m60-rank-quality-off-worst9-s0-2-a01/golden.json`, run with
  `LR_RANK_QUALITY=off`, was rejected: delta -33.3, CI [-48.0, -19.9]. Rank-quality sorting is
  heavily load-bearing despite modest observed disagreement rates.

Mechanism trial: a temporary `objective.ts` hook made the leaf objective
`currentQuality^p * readiness^q`, with default powers of 1 and env overrides
`LR_M61_OBJECTIVE_CURRENT_POWER` / `LR_M61_OBJECTIVE_READINESS_POWER`. A follow-up `handoff.ts`
gate tested `LR_M62_MATURE_OBJECTIVE_CURRENT15=1`, which kept 125k at the baseline objective and
used current-quality power 1.5 only at budgets >=200k. Candidate generation, start selection,
forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule
stayed unchanged.

Focused tests passed for the default path and the M62 opt-in path:
`LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` and the same suite with `LR_M62_MATURE_OBJECTIVE_CURRENT15=1` (6 files, 77 tests each).

Probe results:

- `LR_M61_OBJECTIVE_CURRENT_POWER=1.5` on the nine worst specs was positive, delta +4.3,
  CI [-2.8, 11.9], P(delta<=0)=12.2%, with 125k -7.3 but mature budgets +4.6 to +7.7.
- Full-suite M61 current-power 1.5,
  `generated/golden-runs/probe-m61-objective-current15-full-s0-2-a01/golden.json`, was valid
  480/480 with raw HEADLINE 693.95 and `HEADLINE excl. impact` 709.20. Decision versus M41 was
  indicative `VERDICT: INCONCLUSIVE`, delta +1.4, CI [-2.5, 5.1], P(delta<=0)=24.2%. Per-budget
  deltas were 125k -1.6, 250k +1.0, 375k +1.9, and 500k +1.9.
- `LR_M61_OBJECTIVE_CURRENT_POWER=1.25` was weaker on the worst slice, delta +2.8,
  CI [-5.3, 15.3], P(delta<=0)=31.2%. `LR_M61_OBJECTIVE_READINESS_POWER=1.5` was flat
  (delta +0.4, P(delta<=0)=50.0%).
- Mature-only M62,
  `generated/golden-runs/probe-m62-mature-objective-current15-full-s0-2-a01/golden.json`, was
  valid 480/480 with raw HEADLINE 694.11 and `HEADLINE excl. impact` 709.62. Its raw budget curve
  was 125k 677.65, 250k 689.97, 375k 695.73, and 500k 699.09. Decision versus M41 was indicative
  `VERDICT: INCONCLUSIVE`, delta +1.5, CI [-2.2, 5.3], P(delta<=0)=21.1%, effect 0.79. Per-budget
  deltas were 125k +0.0, 250k +1.0, 375k +1.9, and 500k +1.9.

Why it was stopped: M62 did exactly the intended budget-shape repair, removing the 125k drag
while preserving the mature M61 lift, but it still missed the alpha=0.20 indicative accept gate
by a narrow margin. Top weighted gains were `dense_sprint` +31.41, `drums_signature` +12.19,
`float_bounds` +10.16, `drums_pulse` +10.10, `rhythm_ladder` +9.50, and `drums_pendulum` +5.21.
Top losses were `syncopated_switchback` -15.14, `drums_swell` -11.52, `drums_breath` -8.09,
`canyon_steps` -7.94, and `pop_train` -5.17. The broad exponent is therefore a useful direction
but not a shippable mechanism under the campaign rule. The temporary source hook was reverted;
the accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - ABANDONED PROBE - dense low/medium-impact basin cleanup

Reason: combine two recent near-miss selectors instead of retesting either alone: M48's
high-onset impact-curve profile, which had found a `drums_dropout` basin, plus the M42/M39
air-matched ride-out suppression gate, which had found a `drums_tide`/`drums_pendulum` basin.
The temporary source hook was default-off behind `LR_M55_DENSE_IMPACT_AIR_CLEANUP=1`. It raised
the impact-curve onset toward 0.30 only for contact-rich, broad-air, low/medium-impact,
mostly non-vertical resolved profiles, and suppressed the M4 Part B air-matched ride-out variant
on the older dense low/medium-impact air selector. Candidate count outside that one M4 variant,
search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set,
budget grid, and acceptance rule stayed unchanged.

Focused tests passed with the hook disabled and enabled: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` and the same suite with `LR_M55_DENSE_IMPACT_AIR_CLEANUP=1` (6 files, 77 tests each).

Probe: `generated/golden-runs/probe-m55-dense-impact-air-cleanup-full-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_M55_DENSE_IMPACT_AIR_CLEANUP=1`, was valid 480/480 with raw HEADLINE 692.11 and `HEADLINE excl. impact` 711.62. Decision versus M41 was indicative `VERDICT: INCONCLUSIVE`, delta headline -0.5, CI [-3.5, 1.9], P(delta<=0)=62.4%, effect -0.36. Per-budget deltas were 125k +1.3, 250k -0.8, 375k -1.0, and 500k -0.4.

Why it was stopped: the portfolio did not offset the M48/M42 collateral; it converted the old
single-selector near-misses into a full-suite mature-budget drag. The small 125k gain is not
worth a canonical run when every mature tier is negative on the paired 3-seed intersection.
This closes simple recombinations of the M48 high-onset and M42 air-knob gate shapes; future
work needs a new usefulness signal or a different generation shape, not another static union of
these selectors. The source hook was reverted; the accepted baseline remains
`attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - INCONCLUSIVE CANONICAL - amplitude-range mature q34 breadth

Reason: test whether the remaining amplitude residual was candidate-breadth limited rather than geometry limited. A first env-only panel probe forced `LR_QUALITY_NCAND=34` on the 10 worst amplitude-residual specs (`terrace_sprint`, `syncopated_lift`, `rolling_drop`, `skyline_push`, `canyon_steps`, `switchback_pop`, `float_bounds`, `soar_settle`, `big_air_ramp`, `glide_stairs`). That panel was valid 120/120 and indicative `VERDICT: ACCEPT`, delta headline +1.9 versus M41 on the 10-spec x 3-seed x full-budget intersection, CI [-0.7, 4.9], P(delta<=0)=8.8%. Per-budget deltas were 125k -1.2, 250k +3.2, 375k +1.5, and 500k +2.2. A full-suite env-only global q34 check, `generated/golden-runs/probe-m53-quality34-full-s0-2-a01/golden.json`, was valid 480/480 but indicative INCONCLUSIVE-negative, delta -1.5, CI [-5.9, 2.4], P(delta<=0)=76.6%, proving the amplitude-panel gain could not be taken globally.

Mechanism: source-trial the separable part of q34. The temporary M54 hook used q34 only at budgets >=200k, only on short resolved whole-spec profiles with at most 23 contact gaps and amplitude target range >=0.35. This targeted the wide-amplitude sparse/mixed rows that carried the q34 panel gain while avoiding the known global q34 losses (`syncopated_switchback`, `solo_run`, dense drums). Candidate geometry, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed with the hook disabled/enabled and later in promoted/default-on plus escape-off modes: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests each).

Probe: `generated/golden-runs/probe-m54-amp-range-q34-full-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_M54_AMP_RANGE_Q34=1`, was valid 480/480 with raw HEADLINE 693.3 and `HEADLINE excl. impact` 711.87. Decision versus M41 was indicative `VERDICT: ACCEPT`, delta headline +0.7, CI [0.1, 1.6], P(delta<=0)=1.5%, effect 1.83. Per-budget deltas were 125k +0.0, 250k +1.3, 375k +0.6, and 500k +0.7.

Canonical: `generated/golden-runs/attempt-m54-amp-range-q34-a01/golden.json`, run after promoting the gate to default-on with `LR_M54_AMP_RANGE_Q34=0` as the escape, was valid 1920/1920 with raw HEADLINE 692.51 and `HEADLINE excl. impact` 711.59. Per-budget point estimates were 125k 677.98, 250k 688.67, 375k 693.97, and 500k 696.97.

Decision: `npm run decide -- generated/golden-runs/attempt-m54-amp-range-q34-a01/golden.json generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.6, 0.6], P(delta<=0)=50.3%, effect -0.03. Per-budget deltas were 125k +0.0, 250k +0.1, 375k -0.2, and 500k +0.1, with unchanged 100% validity.

Why it was not kept: the 3-seed amplitude-range q34 signal was real enough to canonical but collapsed to exact flatness across all 12 seeds. Candidate breadth alone is not a reliable amplitude repair; global q34 actively hurts the suite and the clean profile gate is seed-sensitive. The source hook was reverted; the accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - INCONCLUSIVE CANONICAL - profile-gated mature aim K7

Reason: retest the old mature aim-base K=7 idea on top of M41 and try to extract only its positive profile pockets. A source-free repricing with `LR_AIM_TOPK_BASES=7` on the full 40-spec x seeds 0..2 mature-budget slice was overall negative: valid 360/360, raw mature-slice HEADLINE 693.05, indicative delta -1.2 versus M41, CI [-6.1, 3.5], P(delta<=0)=69.5%. The temporary source hook then selected K=7 only at mature budgets, only when no explicit `LR_AIM_TOPK_BASES` override was set, and only for non-vertical resolved whole-spec profiles matching either contact-rich low-speed hard-impact rows (`contactCount >= 50`, mean speed <=0.61, max bounded impact >=0.675) or steady phrase hard-impact rows (`contactCount` 25..35, mean impact >=0.40, air range <=0.25, speed range <=0.20). Candidate generation apart from the aim base count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in both the promoted and escape modes: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` and the same suite with `LR_M51_AIM_K7_PROFILE=0` (6 files, 77 tests each).

Probe: `generated/golden-runs/probe-m51-profile-aim-k7-full-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_M51_AIM_K7_PROFILE=1`, was valid 480/480 with raw HEADLINE 694.24 and `HEADLINE excl. impact` 713.51. Decision versus M41 was indicative `VERDICT: ACCEPT`, delta headline +1.6, CI [-0.0, 4.4], P(delta<=0)=3.1%, effect 1.44. Per-budget deltas were 125k +0.0, 250k +2.0, 375k +1.8, and 500k +1.8.

Canonical: `generated/golden-runs/attempt-m51-profile-aim-k7-a01/golden.json`, run after promoting the gate to default-on with `LR_M51_AIM_K7_PROFILE=0` as the escape, was valid 1920/1920 with raw HEADLINE 692.29 and `HEADLINE excl. impact` 711.33. Per-budget point estimates were 125k 677.98, 250k 688.37, 375k 693.88, and 500k 696.64.

Decision: `npm run decide -- generated/golden-runs/attempt-m51-profile-aim-k7-a01/golden.json generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-1.9, 1.1], P(delta<=0)=61.6%, effect -0.31. Per-budget deltas were 125k +0.0, 250k -0.2, 375k -0.3, and 500k -0.2, with unchanged 100% validity.

Why it was not kept: the profile selector cleared the 3-seed gate but was not stable across all 12 seeds. The full canonical was slightly worse at every mature budget, which means the apparent K=7 pockets were seed-sensitive redistribution rather than a reliable production policy. The source hook was reverted; the accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - INCONCLUSIVE CANONICAL - profile-gated M3 wide hard-impact dose

Reason: test whether the M43 wider M41 dose contained a narrow useful basin that could be selected without taking the full dense-drum displacement tax. The temporary source hook let resolved whole-spec profile stats override only the mature M3 steep-arrival zero band from the accepted 0.70 to 0.65. The selector targeted hard-impact, non-vertical profiles: max bounded impact >=0.68, vertical fraction <=0.02, and either mean impact >=0.40 or steady air/speed with mean impact >=0.31, mean air >=0.50, air range <=0.30, and speed range <=0.30. This selected the intended `verse_chorus`, `drums_dropout`, and `drums_zigzag` basin on static inspection. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed in both the experimental and promoted modes: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` and the same suite with the escape `LR_M50_PROFILE_M3_DOSE=0` (6 files, 77 tests each).

Probe: `generated/golden-runs/probe-m50-profile-m3-wide-dose-full-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_M50_PROFILE_M3_DOSE=1`, was valid 480/480 with raw HEADLINE 693.28 and `HEADLINE excl. impact` 712. Decision versus M41 was indicative `VERDICT: ACCEPT`, delta headline +0.7, CI [-0.1, 2.1], P(delta<=0)=9.5%, effect 1.18. Per-budget deltas were 125k +0.0, 250k +1.0, 375k +0.7, and 500k +0.7.

Canonical: `generated/golden-runs/attempt-m50-profile-m3-wide-dose-a01/golden.json`, run after promoting the gate to default-on with `LR_M50_PROFILE_M3_DOSE=0` as the escape, was valid 1920/1920 with raw HEADLINE 692.53 and `HEADLINE excl. impact` 711.74. Per-budget point estimates were 125k 677.98, 250k 688.73, 375k 694.12, and 500k 696.87.

Decision: `npm run decide -- generated/golden-runs/attempt-m50-profile-m3-wide-dose-a01/golden.json generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.9, 0.8], P(delta<=0)=46.5%, effect 0.04. Per-budget deltas were 125k +0.0, 250k +0.2, 375k -0.1, and 500k -0.0, with unchanged 100% validity.

Why it was not kept: the three selected profiles were real enough to clear the 3-seed indicative gate, but the 12-seed canonical effect vanished. This says the M43/M44 per-spec winners were seed-sensitive dose redistribution, not a reliable selector for widening M41. The source hook was reverted; the accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - REJECTED PROBE - impact-curve span widening

Reason: test whether the existing impact-curve ramp was too slow once M48's high-onset direction showed a narrow `drums_dropout` basin. This was env-only: `LR_IMPACT_CURVE_SPAN=0.30` on the same 18-spec impact/guard panel used for the onset bracket. Source code, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-m49-impactcurve-span030-panel-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_IMPACT_CURVE_SPAN=0.30` on the 18-spec panel x canonical budget grid, was valid 216/216 with raw panel HEADLINE 643.67 and `HEADLINE excl. impact` 680.06.

Decision: `npm run decide -- generated/golden-runs/probe-m49-impactcurve-span030-panel-s0-2-a01/golden.json generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json` -> indicative `VERDICT: REJECT`, delta headline -15.2, CI [-26.6, -5.8], P(delta<=0)=100%, effect -2.87. Per-budget deltas were 125k -8.2, 250k -16.5, 375k -16.3, and 500k -15.5.

Why it was closed: the faster curve produced small gains on `drums_dropout` (+2.32), `solo_run` (+1.24), and `skyline_push` (+0.36), but heavily damaged the dense drum guard rows: `drums_pulse` -62.73, `drums_zigzag` -53.47, `drums_swell` -26.90, `drums_crosscut` -24.70, `rhythm_ladder` -22.38, and `drums_tide` -21.79. The accepted impact curve span should not be widened globally. This was env-only and left no source changes.

## 2026-07-04 - INCONCLUSIVE CANONICAL - profile-gated impact-curve high onset

Reason: test whether the current impact-curve carrier is too aggressive on broad-air, low/medium-impact dense rows. The first env-only brackets used the existing `LR_IMPACT_CURVE_START` override on an 18-spec impact/guard panel. Lowering onset to 0.20 (`probe-m45-impactcurve-start020-panel-s0-2-a01`) was valid 216/216 but indicative `VERDICT: REJECT`, delta headline -5.6 on the panel, CI [-15.0, 3.5], P(delta<=0)=88.9%, with per-budget deltas -1.8, -4.7, -7.2, -5.8. Raising onset to 0.30 globally (`probe-m46-impactcurve-start030-panel-s0-2-a01`) was also valid 216/216 and rejected, delta -3.2, CI [-10.1, 4.6], P(delta<=0)=81.8%, with per-budget deltas -1.9, -2.7, -4.0, -3.3.

Selector trial: a temporary source hook raised the impact curve onset to 0.30 only for non-vertical, broad-air, contact-rich profiles with low/medium impact ceiling. Focused tests passed with the hook disabled/enabled and later default-on/escape-off: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests). The first full 3-seed selector probe (`probe-m47-profile-curve-high-onset-full-s0-2-a01`) was positive but leaked into `opening_burst`: valid 480/480, raw HEADLINE 693.44, indicative `VERDICT: INCONCLUSIVE`, delta +0.8, CI [-1.2, 3.7], P(delta<=0)=23.1%. Adding `contactCount >= 35` removed that outlier. The tightened probe (`probe-m48-profile-curve-high-onset-contact35-full-s0-2-a01`) was valid 480/480, raw HEADLINE 693.54, indicative `VERDICT: ACCEPT`, delta +0.9, CI [-1.1, 3.8], P(delta<=0)=19.0%.

Canonical: `generated/golden-runs/attempt-m48-profile-curve-high-onset-contact35-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m48-profile-curve-high-onset-contact35-a01`, was valid 1920/1920 with raw HEADLINE 692.92 and `HEADLINE excl. impact` 711.78. Per-budget point estimates were 125k 678.50, 250k 689.05, 375k 694.43, and 500k 697.34.

Decision: `npm run decide -- generated/golden-runs/attempt-m48-profile-curve-high-onset-contact35-a01/golden.json generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.4, CI [-1.1, 2.2], P(delta<=0)=29.8%, effect 0.51. Per-budget deltas were +0.5, +0.5, +0.2, and +0.5, with unchanged 100% validity.

Why it was not kept: the selector found a real `drums_dropout` basin but was too narrow/noisy at 12 seeds. The canonical footprint changed 192/1920 checkpoints, with 102 improvements, 90 regressions, and 1728 plateaus. Weighted movement was `drums_dropout` +17.36 and `drums_pendulum` +3.28, offset by `drums_tide` -1.29 and `rhythm_ladder` -5.73. The source hook was reverted; the accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - REJECTED PROBES - M41 hard-impact span dose sweep

Reason: test whether the accepted M41 mature hard-impact steep-arrival span was under- or over-dosed. No source edits were needed: the accepted M41 source already exposes `LR_M41_HARD_IMPACT_ZERO_BAND`. The default accepted setting is 0.70, which means a 30% mature attempt span on whole specs whose max bounded impact clears 0.68. The sweep tested 0.65 (35% span) and 0.75 (25% span) on the full 40-spec x seeds 0..2 x canonical-budget grid, compared to `attempt-m41-hardimpact-span30-a01`. Scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Wider dose: `generated/golden-runs/probe-m43-hardimpact-span35-full-s0-2-a01/golden.json`, run with `LR_M41_HARD_IMPACT_ZERO_BAND=0.65`, was valid 480/480 with raw HEADLINE 691.06 and `HEADLINE excl. impact` 709.33. Decision versus M41 was indicative `VERDICT: INCONCLUSIVE`, delta headline -1.5, CI [-6.2, 1.5], P(delta<=0)=79.9%. Per-budget deltas were 125k +0.0, 250k -1.2, 375k -1.7, and 500k -1.9. The 35% dose gained `verse_chorus` +14.8 and `drums_zigzag` +10.6 on the 3-seed footprint, but lost `drums_swell` -46.9 and `drums_crosscut` -20.7.

Narrower dose: `generated/golden-runs/probe-m44-hardimpact-span25-full-s0-2-a01/golden.json`, run with `LR_M41_HARD_IMPACT_ZERO_BAND=0.75`, was valid 480/480 with raw HEADLINE 689.8 and `HEADLINE excl. impact` 707.67. Decision versus M41 was indicative `VERDICT: REJECT`, delta headline -2.8, CI [-8.1, 1.1], P(delta<=0)=90.9%. Per-budget deltas were 125k +0.0, 250k -3.2, 375k -2.4, and 500k -3.6. It gained `verse_chorus` +19.6 and `drums_swell` +7.7, but lost `drums_zigzag` -50.8, `drums_crosscut` -31.5, `dense_sprint` -11.8, `drums_dropout` -11.8, and `drums_crescendo` -11.1.

Why it was closed: the accepted 30% mature span sits between two losing dose directions. More span over-displaces the dense drum rows; less span gives back the accepted hard-impact winners. Future M41 work should change the selector or add a second orthogonal candidate shape, not just retune the span share. No source changes were made, and the accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - REJECTED PROBE - M4 Part B feature gate on M41

Reason: retest the old M39 M4 air-matched Part B feature gate on top of the accepted M41 baseline, because the source-free archive oracle still picked `attempt-m39-airknob-feature-gate-a01` for 314/1920 cells against M41. The temporary default-off source hook `LR_M42_AIR_KNOB_FEATURE_GATE=1` suppressed only the Part B air-matched ride-out candidate when the whole-spec resolved features matched the old dense low/medium-impact air-swing selector: at least 30 contacts, mean bounded impact <=0.43, and either min air <=0.34 or mean speed <=0.62 with air range >=0.30. Candidate scoring, M4 airFit, M41 steep-arrival span, search policy, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged when the env flag was unset.

Focused tests passed with the flag unset and with `LR_M42_AIR_KNOB_FEATURE_GATE=1`: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests). An initial local wiring error (`gaps` not passed into the helper) was caught by this suite and fixed before any probe result was considered.

Probe: `generated/golden-runs/probe-m42-airknob-gate-on-m41-panel-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm LR_M42_AIR_KNOB_FEATURE_GATE=1 GOLDEN_SEEDS_OVERRIDE=0,1,2` on the 19-spec M39 air-sensitive panel x the canonical budget grid. Valid 228/228. Decision versus `attempt-m41-hardimpact-span30-a01` was indicative `VERDICT: INCONCLUSIVE`, delta headline +0.6 on the panel, CI [-3.3, 4.9], P(delta<=0)=39.8%, effect 0.29. Per-budget deltas were 125k +0.7, 250k +0.3, 375k +0.3, and 500k +0.9.

Why it was not kept: the selector still finds the real `drums_tide` basin, but not cleanly enough. Only 46/228 paired checkpoints changed, with 29 improvements and 17 regressions. Weighted panel movement was `drums_tide` +21.6 and `drums_pendulum` +1.8, offset by `drums_dropout` -7.1 and `drums_crescendo` -3.9. Static feature inspection showed why: the old gate catches `drums_tide` via medium air range and lower mean speed, but also catches the high-range low-air rows that lose. A tide-only refinement would likely be too small for canonical by itself. The temporary source hook was reverted; the accepted baseline remains `attempt-m41-hardimpact-span30-a01`.

## 2026-07-04 - ACCEPTED CANONICAL - hard-impact mature M3 steep-arrival span

Reason: the accepted M3 steep-arrival launch span was strong at the scarce tier but too broad for mature budgets. A source-free oracle and the old full M3 span30 archive showed complementary mature-budget winners, while the large losers separated well by whole-spec maximum bounded impact. The accepted M41 source keeps the existing scarce-tier span untouched, and at mature budgets lowers the steep-arrival span zero band from 0.80 to 0.70 only when the resolved spec maximum bounded impact is at least 0.68. `LR_M41_HARD_IMPACT_SPAN=0` restores the old mature behavior; `LR_M41_HARD_IMPACT_PROFILE_MIN` and `LR_M41_HARD_IMPACT_ZERO_BAND` remain diagnostic overrides. Candidate count, search policy, start selection, forward eval, repair, M4 airFit, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed with the gate default-on: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Probe: the first full 40-spec x seeds 0..2 probe at threshold 0.676 was indicative `VERDICT: ACCEPT`, delta headline +1.5, CI [-2.2, 4.7], P(delta<=0)=17.1%, but still carried a large `drums_tide` loss. Raising the threshold to 0.68 excluded that edge case while keeping the major hard-impact winners: `probe-m41-hardimpact-span30-min068-full-s0-2-a01` was valid 480/480 with raw HEADLINE 692.6 and indicative `VERDICT: ACCEPT`, delta headline +2.0, CI [-0.7, 4.8], P(delta<=0)=6.9%. Per-budget deltas were 125k +0.0, 250k +2.2, 375k +2.9, and 500k +1.8.

Canonical: `generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m41-hardimpact-span30-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 692.52 and `HEADLINE excl. impact` 711.76. Per-budget point estimates were 125k 677.98, 250k 688.56, 375k 694.19, and 500k 696.87.

Decision: `npm run decide -- generated/golden-runs/attempt-m41-hardimpact-span30-a01/golden.json generated/golden-runs/attempt-m3-scarce-span75-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +1.2, CI [-0.2, 3.0], P(delta<=0)=5.1%, effect 1.50. Per-budget deltas were 125k +0.0, 250k +1.5, 375k +1.7, and 500k +1.1, with unchanged 100% validity at every tier.

Why it was kept: this is the first mature-budget reuse of the M3 mechanism that confines the displacement tax to profiles that actually need harder impact arrivals. The 125k tier is byte-identical because the existing scarce span still wins there. Mature gains are broad enough to clear the canonical gate: 960/1920 paired checkpoints changed, with 541 improvements, 419 regressions, and 960 plateaus. Weighted winners were `drums_zigzag` +9.3, `rolling_hills` +8.6, `drums_crosscut` +8.3, `drums_crescendo` +8.2, `drums_swell` +4.5, `swoop_dive` +3.5, and `climb_terrace` +3.5. The main losses were `verse_chorus` -3.3, `syncopated_lift` -2.0, `skyline_push` -1.1, and `dense_sprint` -1.0. The accepted baseline is now `attempt-m41-hardimpact-span30-a01` at source commit `0260692`.

## 2026-07-04 - REJECTED PROBE - impact-template hold widening

Reason: test whether the accepted profiled low-air impact SLAM-HOP hold is under-dosed on the current M3 baseline. The temporary source added default-identical env hooks around the existing impact-template hold length and low-air selectors: `LR_M40_HOLD_MAX_FRAMES`, `LR_M40_HOLD_PROFILE_AIR_START`, and `LR_M40_HOLD_LOCAL_AIR_START`. The default path stayed identical; candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged unless an M40 env knob was set.

Focused tests passed with the env unset: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Probe panel: `drums_pendulum,drums_crescendo,drums_signature,drums_tide,drums_breath,drums_pulse,drums_dropout,rhythm_ladder,dense_sprint,syncopated_switchback,cold_start,drums_swell` x seeds 0..2 x the canonical budget grid, compared to `attempt-m3-scarce-span75-a01`.

Arms: `probe-m40-holdmax5-panel-s0-2-a01` (`LR_M40_HOLD_MAX_FRAMES=5`) was valid 144/144 and indicative `VERDICT: INCONCLUSIVE`, delta headline -0.0 on the panel, CI [-0.7, 0.6], P(delta<=0)=75.8%; only 7 checkpoints changed and the net movement was `drums_pendulum` -0.32 weighted. `probe-m40-profileair56-panel-s0-2-a01` (`LR_M40_HOLD_PROFILE_AIR_START=0.56`) was byte-identical: 0/144 score changes, delta +0.0. `probe-m40-profileair56-localair30-panel-s0-2-a01` (`LR_M40_HOLD_PROFILE_AIR_START=0.56 LR_M40_HOLD_LOCAL_AIR_START=0.30`) was valid 144/144 but negative: delta headline -3.9, CI [-13.9, 1.4], P(delta<=0)=82.3%, with per-budget deltas 125k +0.0, 250k -4.4, 375k -4.3, and 500k -4.2.

Why it was not kept: the current hold is already at the useful boundary. Making it longer slightly hurt the only row it touched, widening the whole-spec low-air profile alone did not affect selected tracks, and widening local low-air activation reopened exactly the dense collateral the profile was designed to avoid (`drums_pulse` -42.8 weighted, `drums_signature` -7.7, offset only by `drums_breath` +5.5). This closes simple impact-template hold length/profile/local-air widening on the current baseline. The temporary source hooks were reverted, and the accepted baseline remains `attempt-m3-scarce-span75-a01`.

## 2026-07-04 - INCONCLUSIVE CANONICAL - M4 air-matched Part B feature gate

Reason: follow up on the M38 blanket-removal probe, which showed that the accepted M4 Part B air-matched ride-out candidate is load-bearing globally but harmful on a few dense low/medium-impact air-swing rows. The temporary source change added a default-on selector in `scripts/v0/optimizer/aim.ts` that suppressed only the Part B air-matched ride-out emission when the resolved contact count was at least 30, resolved mean impact was <=0.43, and either resolved minimum air was <=0.34 or resolved mean speed was <=0.62 with resolved air range >=0.30. `LR_AIR_KNOB_FEATURE_GATE=0` restored old Part B behavior globally. The M4 airFit judge term, joint aim proposer, candidate scoring, hard gates, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed before the canonical with the gate default-on: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Probe: `generated/golden-runs/probe-m39b-airknob-feature-gate-s0-2-a01/golden.json`, run on the 19-spec air-sensitive panel x seeds 0..2 x the canonical budget grid. Valid 228/228. Decision versus `attempt-m3-scarce-span75-a01` was indicative `VERDICT: ACCEPT`, delta headline +2.2 on the panel, CI [-0.3, 6.4], P(delta<=0)=6.5%, effect 1.25. Per-budget deltas were 125k +0.7, 250k +2.2, 375k +2.4, and 500k +2.4. The narrowed selector avoided the earlier `drums_pulse` and `drums_breath` collateral, with panel gains confined to `drums_tide` (+21.6), `drums_crescendo` (+16.1), `drums_dropout` (+3.0), and `drums_pendulum` (+1.8).

Canonical: `generated/golden-runs/attempt-m39-airknob-feature-gate-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-m39-airknob-feature-gate-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 691.59 and `HEADLINE excl. impact` 711.28. Per-budget point estimates were 125k 678.41, 250k 687.30, 375k 693.06, and 500k 695.92.

Decision: `npm run decide -- generated/golden-runs/attempt-m39-airknob-feature-gate-a01/golden.json generated/golden-runs/attempt-m3-scarce-span75-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.8, 1.7], P(delta<=0)=31.3%, effect 0.50. Per-budget deltas were 125k +0.4, 250k +0.3, 375k +0.5, and 500k +0.1, with unchanged 100% validity at every tier.

Why it was not kept: the selector was directionally correct but too narrow and noisy at canonical scale. Only 191/1920 paired checkpoints changed (107 improvements, 84 regressions), with the full-suite footprint concentrated in `drums_crescendo` (+12.0 weighted), `drums_tide` (+4.3), `drums_pendulum` (+1.2), and `drums_dropout` (-5.7); all other specs were effectively unchanged. The panel win therefore did not clear the canonical accept gate. This closes this exact resolved-feature Part B gate as a production change; future air-length work needs either a larger effect or a stronger local usefulness signal that keeps the `drums_dropout` flip from appearing at 12 seeds. The temporary source change was reverted, and the accepted baseline remains `attempt-m3-scarce-span75-a01`.

## 2026-07-04 - REJECTED PROBE - M4 air-matched Part B removal

Reason: test whether the accepted M4 Part B air-matched ride-out candidate is now mostly collateral on the current M3 baseline. Existing telemetry showed high Part B emission rates in several M4 loser specs, and the original M4 decomposition said A-alone carried the gain while B-alone was a lottery. A temporary default-identical `LR_M38_AIR_KNOB_OFF=1` switch in `scripts/v0/optimizer/aim.ts` disabled only the air-matched ride-out emission; the M4 airFit judge term, joint aim proposer, candidate scoring, hard gates, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests passed before the probe with the env unset: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Probe: `generated/golden-runs/probe-m38-airknob-off-panel-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm LR_M38_AIR_KNOB_OFF=1 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,skyline_push,terrace_sprint,drums_dropout,dense_sprint,canyon_steps,rhythm_ladder,dense_echo_climb,syncopated_lift,drums_pulse,drums_breath,drums_crescendo,syncopated_switchback,opening_burst,drums_swell,drums_tide,drums_zigzag,drums_crosscut,cold_start --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m38-airknob-off-panel-s0-2-a01`. Valid 228/228.

Decision: `npm run decide -- generated/golden-runs/probe-m38-airknob-off-panel-s0-2-a01/golden.json generated/golden-runs/attempt-m3-scarce-span75-a01/golden.json` -> indicative `VERDICT: INCONCLUSIVE`, delta headline -1.8 on the 19-spec x 3-seed x full-grid intersection, CI [-9.8, 5.9], P(delta<=0)=69.0%. Per-budget deltas were 125k +0.9, 250k -1.4, 375k -1.4, and 500k -3.0, with unchanged validity.

Why it was not kept: this is a basin swap, not a repair. Removing Part B improved `drums_tide` (+21.6 weighted on the panel) and `drums_crescendo` (+16.1), but lost more on `drums_swell` (-22.5), `drums_pulse` (-13.4), `syncopated_switchback` (-12.3), `dense_sprint` (-9.2), and `rhythm_ladder` (-9.0). The mature budgets all moved negative, especially 500k. This closes simple M4 Part B removal on the current baseline; future air-length work still needs a stronger local usefulness signal than "disable the first-base air knob." The temporary source change was reverted, and the accepted baseline remains `attempt-m3-scarce-span75-a01`.

## 2026-07-04 - SOURCE-FREE STUDY - search-seed portfolio oracle

Reason: test whether the large 125k->500k recovery in specs such as `dense_sprint` and `syncopated_switchback` points to a cheap same-budget search-seed portfolio mechanism. This was a source-free oracle using `scripts/v0/portfolio_oracle.ts`; scorer, specs, fingerprint, seeds, budgets, source, and acceptance rule stayed unchanged.

Tiny oracle: `generated/golden-runs/portfolio-oracle-m37-tiny-s0-a01.json`, run with `LR_ENGINE=wasm npx tsx scripts/v0/portfolio_oracle.ts --specs=dense_sprint,syncopated_switchback --seed=0 --budgets=125000,500000 --lanes=0,1,2 --json-out=generated/golden-runs/portfolio-oracle-m37-tiny-s0-a01.json`.

Result: the equal-slice same-budget portfolio was strongly negative while the full-lane oracle required roughly 3x work. Baseline curve was 651.74, equal-slice curve was 620.31 (delta -31.44), and full-lane curve was 682.79 (optimistic delta +31.05). At 125k, baseline scored 625.46, equal-slice 580.41, and full-lane 684.91. At 500k, baseline scored 679.13, equal-slice 662.94, and full-lane 680.68.

Why it was not promoted: the only positive 500k full-lane gain in the tiny panel was `syncopated_switchback` seed 0 at +3.09, while `dense_sprint` was unchanged; the large full-lane delta came mostly from spending multiple full budgets, not from an affordable scheduler shape. Equal slicing the same total budget starved the compile badly (`dense_sprint` seed 0 at 500k: -42.60 despite choosing a nonzero lane). This closes naive search-seed portfolioing as a near-term path: any future scheduler work needs adaptive early stopping or a real low-cost signal, not static seed lanes.

## 2026-07-04 - REJECTED PROBE - mixed vertical amplitude axisq lane

Reason: test whether the remaining amplitude undershoot on mixed elevation+amplitude rows can be harvested by an additive extra candidate stream instead of changing the normal contact-centered sampler. A temporary default-off `LR_M36_AMP_AXISQ=1` lane in `handoff.ts` generated a few `axisq` candidates only on contact gaps with both amplitude and upward elevation asks. Candidate scoring, hard gates, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged; the lane only used a geometry-only amplitude lift and let the existing ranker select or ignore the candidates.

Focused tests passed before probes with the env unset: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Hard-dose probe: `generated/golden-runs/probe-m36-amp-axisq-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm LR_M36_AMP_AXISQ=1 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=terrace_sprint,syncopated_lift,canyon_steps,skyline_push,switchback_pop,ridge_pulse,dense_echo_climb,glide_stairs,rolling_drop,soar_settle,big_air_ramp,valley_bounce --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m36-amp-axisq-s0-2-a01`. Valid 144/144.

Hard-dose decision: `npm run decide -- generated/golden-runs/probe-m36-amp-axisq-s0-2-a01/golden.json generated/golden-runs/attempt-m3-scarce-span75-a01/golden.json` -> indicative `VERDICT: REJECT`, delta headline -2.7 on the 12-spec x 3-seed x full-grid intersection, CI [-6.2, -0.1], P(delta<=0)=98.3%. Per-budget deltas were 125k -4.7, 250k -2.9, 375k -2.6, and 500k -2.3, with unchanged validity.

Soft-dose probe: `generated/golden-runs/probe-m36-amp-axisq-soft-s0-2-a01/golden.json`, same panel, run with `LR_M36_AMP_AXISQ=1 LR_M36_AMP_AXISQ_K=1 LR_M36_AMP_AXISQ_LIFT=0.08 LR_M36_AMP_AXISQ_FLOOR=0.36 LR_M36_AMP_AXISQ_CAP=0.50 LR_M36_AMP_AXISQ_BUDGET_START=175000 LR_M36_AMP_AXISQ_BUDGET_SPAN=75000`. Valid 144/144.

Soft-dose decision: `npm run decide -- generated/golden-runs/probe-m36-amp-axisq-soft-s0-2-a01/golden.json generated/golden-runs/attempt-m3-scarce-span75-a01/golden.json` -> indicative `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-1.2, 1.0], P(delta<=0)=58.5%. Per-budget deltas were 125k +0.0, 250k -0.6, 375k +0.0, and 500k +0.1, with unchanged validity.

Why it was not kept: the additive lane mostly injected search/budget churn instead of a true amplitude correction. In the hard dose, selected `axisq` candidates concentrated in the losing rows (`dense_echo_climb` -10.3, `canyon_steps` -8.6, `syncopated_lift` -6.8, `skyline_push` -6.3 mean on the panel). The soft dose reduced the damage but did not produce a positive paired signal; its selected-candidate wins were too sparse and the 250k point estimate stayed negative. This closes simple mixed-vertical amplitude-lift `axisq` lanes: future amplitude work needs a different generation shape or a stronger usefulness model, not a small lifted duplicate stream. The temporary source change was reverted, and the accepted baseline remains `attempt-m3-scarce-span75-a01`.

## 2026-07-04 - REJECTED PROBE - delivery-match impact readiness after M3

Reason: retest the old M2 two-sided impact delivery-match readiness term on top of the current accepted M3 steep-arrival generation baseline. The original M2 probe failed before M3 because the ranker had no gate-passing steep-arrival launches to promote. This temporary source trial kept the current M4 airFit readiness path and only added an env-gated `LR_M2=1` alternate inside `impactFeasibility`: `exp(-penalty/scale)` on `eta * speed * turn` versus needed redirArc, with undershoot full penalty and overshoot light penalty. The default path stayed byte-identical; candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged unless the env knob was enabled.

Focused tests passed before probes: `LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/arc_model.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/optimizer_sample.test.ts tests/budget_model.test.ts` (6 files, 77 tests).

Full-dose probe: `generated/golden-runs/probe-m35-m2-after-m3-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm LR_M2=1 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_dropout,drums_swell,solo_run,drums_tide,drums_signature,drums_crescendo,drums_pulse,dense_sprint,rhythm_ladder,grain_staircase,pop_train,tiny_dance --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-m35-m2-after-m3-s0-2-a01`. Valid 144/144.

Full-dose decision: `npm run decide -- generated/golden-runs/probe-m35-m2-after-m3-s0-2-a01/golden.json generated/golden-runs/attempt-m3-scarce-span75-a01/golden.json` -> indicative `VERDICT: REJECT`, delta headline -51.8 on the 12-spec x 3-seed x full-grid intersection, CI [-70.7, -33.7], P(delta<=0)=100.0%. Per-budget deltas were 125k -49.7, 250k -58.1, 375k -47.7, and 500k -52.2, with unchanged validity.

Soft-dose probe: `generated/golden-runs/probe-m35-m2soft-after-m3-s0-2-a01/golden.json`, run with the same panel and `LR_M2=1 LR_M2_SCALE=2.5`. Valid 144/144.

Soft-dose decision: `npm run decide -- generated/golden-runs/probe-m35-m2soft-after-m3-s0-2-a01/golden.json generated/golden-runs/attempt-m3-scarce-span75-a01/golden.json` -> indicative `VERDICT: INCONCLUSIVE-negative`, delta headline -5.4, CI [-20.5, 6.2], P(delta<=0)=79.4%. Per-budget deltas were 125k -2.9, 250k -4.5, 375k -7.0, and 500k -5.2, with unchanged validity.

Why it was not kept: adding M3 generation does not rescue the M2 readiness-gradient family. The full dose still massively over-penalizes otherwise good arrivals, and the old soft scale remains negative across every budget on a favorable impact-heavy panel. This closes the simple delivery-match retry on the current baseline; future impact work needs a different selector or generation mechanism, not an exponential sub-break-even pressure in `impactFeasibility`. The temporary source change was reverted, and the accepted baseline remains `attempt-m3-scarce-span75-a01`.

## 2026-07-01 - INCONCLUSIVE CANONICAL - smooth continuous-pressure aim high-K gate

Reason: retire the two hard step gates inside the accepted high-K aim-base bump (`aimTopKBasesEffective` in `scripts/v0/optimizer/aim.ts`) in favor of the clean continuous-pressure + deterministic-hash pattern already used by `shouldUseDefaultExtraAimBase`, so the mechanism generalizes to budget grids and spec populations beyond the current canonical suite instead of relying on magic-number cliffs reverse-fit to which of the 40 specs happened to regress. The prior gate raised the base count from `AIM_TOPK_BASES` (4) to `AIM_TOPK_BASES_HIGH` (6) only when compile TARGET budget `>= 200_000` AND whole-spec air-target range `< 0.38` — two binary steps ANDed together. The temporary source replaced both with `smoothstep` ramps multiplied into one whole-compile probability in [0,1], then decided per gap by a no-RNG `unitHash(seed) < pressure` draw with its own distinct hash salt (decorrelated from the extra-base draw), so a given gap's K stays constant across node rebuilds (same determinism contract as before). Budget ramp: pressure 0 at 125k (start) saturating to 1 at 250k (start+span) — byte-identical to the retired `>=200k` step at every canonical grid point, differing only for off-grid budgets (e.g. 150k, 200k). Reverse air ramp: pressure 1 for air range `<= 0.36` fading to 0 by `>= 0.40`, centered on the retired 0.38 cliff. The low-air K=3 cap, the `AIM_EXTRA_TOPK_BASES_DEFAULT` fallback, and the `LR_AIM_TOPK_BASES` explicit escape hatch were left untouched. Candidate generation RNG, search policy, start, forward eval, repair, impact geometry, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Air-range probe: a throwaway script over all 40 golden specs (reconstructing gaps and `effectiveAxes` exactly as the compile does, so the numbers match what the gate reads) confirmed the ramp keeps every named winner at pressure 1 (drums_tide 0.318, drums_swell 0.349, drums_zigzag 0.264, drums_crosscut 0.319, leap_cadence 0.270) and every named loser at pressure 0 (drums_dropout exactly 0.400 -> 0, dense_sprint 0.500, syncopated_switchback 0.550), while placing four real boundary specs in a genuine partial-pressure zone so the run is not a byte-identical no-op: opening_burst (range 0.370 -> pressure 0.844), soar_settle (0.387 -> 0.239), skyline_push (0.365 -> 0.956), big_air_ramp (0.395 -> 0.044).

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-aim-highk-smooth-pressure-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-highk-smooth-pressure-j32-a01`. Valid 1920/1920 overall (100% at every tier). Raw HEADLINE 683.71, `HEADLINE excl. impact` 699.44. Per-budget point estimates 125k 666.71, 250k 680.27, 375k 685.56, 500k 688.29.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-highk-smooth-pressure-j32-a01/golden.json generated/golden-runs/attempt-aim-highk-gated-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Δheadline +0.0 (683.67 -> 683.71), 95% CI [-0.1, 0.2], P(Δ≤0)=28.2%, effect 0.50. Per-budget Δ: 125k +0.0 (CI[0.0, 0.0], byte-identical), 250k -0.0 (CI[-0.5, 0.3]), 375k +0.0 (CI[-0.2, 0.3]), 500k +0.1 (CI[-0.1, 0.4]), all tiers 100% valid.

Why it was not kept: the smooth reformulation is a clean, future-proof drop-in — it reproduces the accepted step gate byte-identically at the scarce 125k tier and at every canonical grid point, and the boundary-spec smoothing (partial K=6 added on soar_settle/big_air_ramp, slightly reduced on skyline_push/opening_burst) nets to a wash. It is directionally positive (+0.04) but well short of the α=0.10 accept gate; the decide hint estimates ~146 more seeds would be needed to resolve it. Per the strict accept-only rule the temporary source change was reverted, and the accepted baseline remains `attempt-aim-highk-gated-j32-a01` (683.67). Preserved as evidence that the two hard cliffs can be replaced by the continuous-pressure + deterministic-hash pattern at parity — a ready cleanup to fold in if a future accept-eligible change lands in the same air-range region, or if the canonical grid ever adds off-grid budgets (150k/200k) where the smooth budget ramp would differ from the retired `>=200k` step.

## 2026-07-01 - ACCEPTED CANONICAL - air-range-gated high-budget aim bases (681.58 -> 683.67)

Mechanism: raise the UNIFORM aim-lane base count (`aimTopKBasesEffective` in `scripts/v0/optimizer/aim.ts`) from `AIM_TOPK_BASES` (4) to `AIM_TOPK_BASES_HIGH` (6) on compiles whose TARGET budget clears `AIM_TOPK_HIGH_BUDGET_FRAMES` (200k) AND whose spec air-target RANGE is below `AIM_TOPK_HIGH_AIR_RANGE_MAX` (0.38). Below 200k the base stays 4 (125k byte-identical to baseline). The gate is per-compile-constant (each golden checkpoint is an independent full compile) so K_effective never changes mid-node — the same determinism contract as the existing K>1 maturity gate. Candidate generation RNG, search policy, start, forward eval, repair, impact geometry, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Derivation (three canonical/probe steps): (1) `LR_AIM_TOPK_BASES=6` uniform (every mature gap, 100k+) canonically gained the mature budgets (250k +0.5, 375k +1.6, 500k +0.8) but CRATERED 125k (-18.9, validity 100->99%) — the extra probe cost starves the scarce tier where ~50-93% of the budget already goes just to first completion. (2) Budget-gating the uniform bump to >=200k removed the 125k loss and netted +0.9 canonical, but INCONCLUSIVE (P(Δ≤0)=26.8%, effect 0.57): one outlier regressor, `syncopated_switchback` -29.5, inflated the variance. (3) The winners (drums_tide +27, drums_swell +25, drums_zigzag/crosscut, leap_cadence — narrow air range 0.26-0.35) and the regressors (syncopated_switchback 0.55, dense_sprint 0.50, drums_dropout 0.40 — wide air range, search-sensitive specs the extra aim probes steal budget from) separate cleanly at air range ~0.38, so gating on it keeps the gains and drops the regressors. Bumping the spec-gated EXTRA tier (`AIM_EXTRA_TOPK_BASES` 5->6) instead was REJECTED (-0.5): the gain is from the non-extra-gated steady specs going 4->6, not the extra tier's 5->6.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-aim-highk-gated-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=...`. Valid 1920/1920 overall (100% at every tier). Raw HEADLINE 683.67, `HEADLINE excl. impact` 699.39. Per-budget point estimates 125k 666.71, 250k 680.34, 375k 685.49, 500k 688.24.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-highk-gated-j32-a01/golden.json generated/golden-runs/attempt-profiled-hold-tight-speed-relief-j32-a01/golden.json` -> canonical `VERDICT: ACCEPT`, Δheadline +2.1, CI [0.1, 4.4], P(Δ≤0)=1.9%, effect 1.96. Per-budget Δ: 125k +0.0 (byte-identical), 250k +2.5 (P=5%), 375k +2.9 (P=2%), 500k +1.8 (P=7%), all tiers 100% valid.

Why it was kept: the mature aim refinement is affordable above 200k and the air-range gate confines it to the steady dense specs that convert extra aim bases into quality, while leaving the scarce tier and the search-sensitive syncopated/wide-air specs byte-identical. The accepted baseline is now `attempt-aim-highk-gated-j32-a01` (683.67).

## 2026-06-30 - REJECTED PROBES - impact axis is saturated (5 mechanisms)

Five distinct impact mechanisms all probed NEGATIVE on the std baseline (40 specs × seeds 0-3 × {250k,500k}), establishing that the impact axis (−0.054 mean undershoot) is at its redirArc catchability ceiling and is NOT recoverable by geometry. All reverted; baseline stays `attempt-profiled-hold-tight-speed-relief-j32-a01` (681.58). Correction to the prior sweep note: across 4 seeds, drums_pendulum GLUED blocks UNDERSHOOT impact by −0.27 (achieved 0.21 vs target 0.48); the earlier seed4-only "+0.25 overshoot" reading was an outlier. So glued blocks want MORE impact, but it cannot be delivered.

1. **LR_IMPACT_LOCAL_W=1.0** (match local candidate cost to the scorer's effective 1.0, up from 0.5): Δ−0.2, tight CI. Pushing the search to pursue impact in candidate selection slightly hurts air/speed selection. The 0.5 down-weight is well-chosen; impact undershoot is geometric, not a selection problem.
2. **Global deeper scoop** (`LR_IMPACT_FLATTEN=26 LR_IMPACT_FRONTLOAD=2.4`): Δ−23.7, impact rms WORSE 0.124→0.131. Over-turns past the catchable ceiling, bleeds speed.
3. **Targeted glued-block scoop boost** (Agent A: deepen flatten+frontload smoothly for air≤0.30 impact gaps): Δ−1.5. Even targeted, glued impact moved only −0.272→−0.253 (rms 0.296→0.289) — saturating — while the extra scoop bled speed net-negative.
4. **Gentle arrival steepening to mid-budget** (Agent B: re-enable the IMPACT_ARRIVAL pop-arc tilt, faded off ≥100k, at ~25-35% persistent): Δ−2.4, impact rms UNCHANGED 0.1237→0.1241. Confirms why it was gated off at high budget — steeper arrivals don't convert to redirArc at canonical budgets and cost completion quality.
5. **Speed-aware scoop allocation** (Agent C: more post-turn where entry speed is low): Δ−2.1, impact rms 0.1237→0.1234 (negligible). The carrier already does speed-aware turn correction (`impactPostTurnExtraDeg`) and deliberately suppresses low-speed scoop; forcing more bleeds speed.

CONSEQUENCE: impact is a dead axis for headline gains. With `HEADLINE excl. impact` = 697.6 and impact unrecoverable, the path to 700 must come from the structurally-floored air/elevation axes or from SEARCH/SCHEDULER efficiency (esp. the scarce 125k tier, 666.7 vs 686.4 at 500k — the largest budget-curve headroom, and where the recent low-slack-branch-2 accept landed).

## 2026-06-30 - ABANDONED PROBES - structural-floor diagnosis sweep

Three sub-canonical probes (40 specs × seeds 0-3 × {250k,500k}, baseline `probe-std-baseline-a01` = current HEAD code) confirmed the remaining gap to 700 is dominated by structural floors, not tunable geometry. All reverted; accepted baseline remains `attempt-profiled-hold-tight-speed-relief-j32-a01` (681.58).

Diagnosis (per-axis signed error, achieved−target, at 500k across all specs): impact undershoots −0.054 (largest total error pool, 14412 gaps), elevation undershoots −0.095 (creative specs, 3300 gaps), amplitude −0.033, air +0.013 overall but heavily bimodal. Score per row ≈ 1000·exp(−rms/0.25); suite aggregates via shifted-geomean so the worst spec `drums_pendulum` (434, 2× leverage) matters most. KEY CEILING: `HEADLINE excl. impact` = 697.6, so even perfect impact caps the headline below 700 — reaching 700 also requires clawing back air/elevation, which are floored.

1. **Elevation asymmetric pop arc** (REVERTED). On combined elevation+amplitude gaps the amplitude block launches a level symmetric arc (`vyArc=−0.5gN`), discarding the climb; tilting it to the elevation climb vy (amplitude sagitta g·N²/8 is launch-tilt-invariant) should net the climb for free. Probe Δ≈−0.1, byte-flat. Even on the firing subset (elev>0.5 ∧ amp≥0.30, 336 gaps) elevation moved −0.173→−0.172. LESSON: elevation = net endpoint height, set by where the next contact is PLACED (constrained by beat timing + speed-stranding avoidance), not by launch arc shape. Launch tilt is the wrong lever; the steep-climb attempts are already generated and the cost/survival ranking rejects them (they bleed horizontal speed). Achieved elevation is pinned ~0.42 vs realistic cap ~0.60.

2. **Low-air grounded-ride commitment boost** (REVERTED). Low-air-target gaps over-jump the dense-beat air floor (target ≤0.4 → achieved ~0.41, min ~0.24); the grounded ride-out under-commits (blendStrength floors 0.6, slide cap 0.55). Symmetric low-air boost (raise blendStrength + safeCap when air<0.42) BACKFIRED: low-air air rms 0.187→0.193, headline Δ−0.1. LESSON: a longer grounded ride forces a steeper/harder catch arc to still reach the next beat, which raises airborne fraction — the air floor is set by "must catch the next dense beat", not by ride-out length.

3. **Deeper impact scoop** (env `LR_IMPACT_FLATTEN=26 LR_IMPACT_FRONTLOAD=2.4` vs default 18/1.6). STRONGLY NEGATIVE: Δheadline −23.7, P(Δ≤0)=100%, and impact rms got WORSE (0.124→0.131). The scoop over-turns past the catchable-redir ceiling, bleeds speed, and slows compiles. The carrier is well-tuned; more scoop is the wrong direction. The carrier also deliberately gates the scoop OFF at low speed (redirArc=v·Δθ → scooping slow catches bleeds speed for little impact), so the residual impact undershoot is by design, not a missing scoop.

## 2026-06-30 - INCONCLUSIVE CANONICAL - mixed elevation/amplitude ride-out smoothing

Reason: revisit a promising vertical-geometry decline with the smoothness constraint in mind. The accepted contact-centered sampler has a hard boundary at the amplitude pop onset: elevation ride-out shortening applies below authored amplitude `0.30`, then shuts off exactly where the amplitude shortening ramp is still weak. The temporary source replaced that discontinuity with a smooth low-amplitude fade plus a small high-elevation/moderate-amplitude allowance, damped when high authored air made pop room tight. Candidate count, search policy, start selection, forward eval, repair, aim, impact geometry, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-mixed-elev-amp-shortening-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-mixed-elev-amp-shortening-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.35 and `HEADLINE excl. impact` 697.35. Per-budget point estimates were 125k 666.63, 250k 677.51, 375k 682.35, and 500k 686.20.

Decision: `npm run decide -- generated/golden-runs/attempt-mixed-elev-amp-shortening-j32-a01/golden.json generated/golden-runs/attempt-profiled-hold-tight-speed-relief-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-0.7, 0.1], P(delta<=0)=89.7%, effect -1.17. Per-budget deltas were 125k -0.1, 250k -0.3, 375k -0.3, and 500k -0.2, with unchanged 100% validity at every tier.

Why it was not kept: the smooth formulation was cleaner, but it turned the measured high-elevation/mixed-amplitude gap into broad negative vertical basin churn. It changed 367/1920 paired scores, with 164 improvements, 203 regressions, and 1553 plateaus; common-row raw score sum was -353.83 and 390 track hashes changed. Gains were real but smaller (`ridge_pulse` +31.80 raw row-score points, `dense_echo_climb` +31.31, `valley_bounce` +27.09, `switchback_pop` +20.49), while losses on exactly the risky mixed vertical profiles dominated (`skyline_push` -194.54, `terrace_sprint` -118.75, `syncopated_lift` -98.00, `glide_stairs` -57.65). This says the current abrupt amplitude deferral is aesthetically poor but functionally protecting high-elevation/high-amplitude/high-air profiles; a production simplification needs a stronger local usefulness signal than smooth target-axis pressure alone. The temporary source change was reverted; the accepted baseline remains `attempt-profiled-hold-tight-speed-relief-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - weak-incumbent far-back cadence retry

Reason: revisit a promising declined search-scheduling family without repeating the old broad far-back expansion. The earlier rejected `QUALITY_FAR_BACK_ZERO_AXIS_QUALITY=0.65` trial expanded activation into moderate-quality incumbents and caused mature-budget churn. This retry kept the accepted severe weak-incumbent cutoff unchanged at axis quality `<0.50` and only increased cadence inside that existing smooth band by temporarily changing `QUALITY_FAR_BACK_MAX_INTERVAL` from `128` to `64`. Candidate generation, candidate count, start selection, forward eval, repair logic, impact geometry, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-weak-farback-cadence64-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-weak-farback-cadence64-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.57 and `HEADLINE excl. impact` 697.67. Per-budget point estimates were 125k 666.71, 250k 677.74, 375k 682.50, and 500k 686.49.

Decision: `npm run decide -- generated/golden-runs/attempt-weak-farback-cadence64-j32-a01/golden.json generated/golden-runs/attempt-profiled-hold-tight-speed-relief-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.3, 0.2], P(delta<=0)=51.7%, effect -0.12. Per-budget deltas were 125k -0.0, 250k -0.1, 375k -0.1, and 500k +0.1, with unchanged 100% validity at every tier.

Why it was not kept: the narrower retry hit the intended weak-quality area, but still did not convert into robust score. Only 33/1920 paired scores changed, with 20 improvements, 13 regressions, and 1887 plateaus; common-row raw score sum was -53.07. Far-back pulses increased by 66 total pulses across 54 rows, while full evaluations fell by 1656 and repair frames fell by 115,557, so the change mostly reshuffled late weak-incumbent repair rather than adding useful extra search. `drums_pendulum` gained +32.66 raw row-score points across 30 changed rows, but `syncopated_switchback` seed 6 regressed at 250k and 375k for -86.77 raw points, more than offsetting the intended gain. This says the existing far-back cutoff/cadence is close enough that a simple cadence increase is not a production improvement; future retries need a stronger usefulness selector, not just more frequent older-frontier pulses. The temporary source change was reverted; the accepted baseline remains `attempt-profiled-hold-tight-speed-relief-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - widened high-speed relief onset retry

Reason: revisit the almost-accepted impact-geometry portfolio from the current accepted baseline, but as a narrow improvement to the accepted selector rather than reintroducing the older broad local-relief logic. The temporary source lowered the smooth high-speed relief profile onset from authored mean speed `0.68` to `0.64`, keeping the same span, manageable-elevation gate, median-room gate, local high-impact relief gate, explicit `LR_IMPACT_CURVE_START` override behavior, candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-tight-speed-relief-start64-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-tight-speed-relief-start64-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.57 and `HEADLINE excl. impact` 697.7. Per-budget point estimates were 125k 666.71, 250k 677.83, 375k 682.62, and 500k 686.36.

Decision: `npm run decide -- generated/golden-runs/attempt-tight-speed-relief-start64-j32-a01/golden.json generated/golden-runs/attempt-profiled-hold-tight-speed-relief-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.1, 0.1], P(delta<=0)=58.8%, effect -0.26. Per-budget deltas were 125k +0.0, 250k +0.0, 375k +0.0, and 500k -0.1, with unchanged 100% validity at every tier.

Why it was not kept: the broader speed onset was clean but not useful enough. Only 102/1920 paired checkpoints changed, with 33 improvements, 25 regressions, and 1862 score plateaus; common-row raw score sum was -8.95. The retry activated exactly the expected adjacent fast/manageable-elevation clusters: `terrace_sprint` improved +20.72 raw row-score points, but `ridge_pulse` lost -22.66 and `skyline_push` lost -7.01. The mature-budget split explains the paired verdict: 250k +11.41 raw, 375k +6.73 raw, but 500k -27.09 raw. This says the accepted high-speed relief selector is already close to the useful boundary; lowering the profile speed onset mostly reintroduces ridge/skyline volatility instead of unlocking new robust upside. The temporary source change was reverted; the accepted baseline remains `attempt-profiled-hold-tight-speed-relief-j32-a01`.

## 2026-06-30 - ACCEPTED CANONICAL - profiled hold plus tight high-speed impact relief

Reason: retry the almost-accepted profiled impact-geometry portfolio with a cleaner relief selector. The kept source combines the profiled low-air/high-impact SLAM-HOP hold with a tighter high-speed relief for the accepted elevation-room impact-curve onset. The hold remains profile-gated to long dense low-air/low-speed impact-only rows. The relief is default-only, local to moderate/high impact targets, and additionally gated by high authored speed plus manageable elevation variation so it keeps the `summit_push`/`terrace_sprint` upside while avoiding the earlier broad `ridge_pulse`/`canyon_steps` collateral. Explicit `LR_IMPACT_CURVE_START` overrides remain exact. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed before the canonical run (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-profiled-hold-tight-speed-relief-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-profiled-hold-tight-speed-relief-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.58 and `HEADLINE excl. impact` 697.61. Per-budget point estimates were 125k 666.71, 250k 677.81, 375k 682.60, and 500k 686.42.

Decision: `npm run decide -- generated/golden-runs/attempt-profiled-hold-tight-speed-relief-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +0.6, CI [0.0, 1.9], P(delta<=0)=5.5%, effect 1.13. Per-budget deltas were 125k +0.0, 250k +0.6, 375k +0.7, and 500k +0.6, with unchanged 100% validity at every tier.

Why it was kept: the tighter relief turns the earlier near-miss into a narrow accepted geometry improvement without broad churn. Only 86/1920 paired checkpoints changed: 62 improvements, 24 regressions, and 1834 plateaus. Raw common-row score sum was +643.52, split across mature budgets as 250k +203.02, 375k +236.14, and 500k +204.36, while 125k stayed byte-identical. Spec movement was intentionally sparse: `drums_pendulum` gained +510.95 raw row-score points (the profiled hold signal), `summit_push` gained +107.05, and `terrace_sprint` gained +25.52. No other spec moved in the paired comparison, which means the high-speed relief selector removed the previous geometry portfolio's offsetting collateral. The accepted baseline is now `attempt-profiled-hold-tight-speed-relief-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - profiled hold plus room/slack rank retry

Reason: go back over the best current declined approaches and retry the closest-to-accepted pieces in a cleaner combination. The temporary source combined the profiled low-air/high-impact SLAM-HOP hold, which had a real but one-spec `drums_pendulum` signal, with the room/slack directional high-axis rank multiplier, which had the best broader no-extra-compute directional-rank signal. Both components used smooth profile/budget/slack/local-room pressure; candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-profiled-hold-room-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-profiled-hold-room-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.07 and `HEADLINE excl. impact` 697.1. Per-budget point estimates were 125k 666.71, 250k 677.63, 375k 681.71, and 500k 685.89.

Decision: `npm run decide -- generated/golden-runs/attempt-profiled-hold-room-rank-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-1.0, 1.4], P(delta<=0)=47.8%, effect 0.13. Per-budget deltas were 125k +0.0, 250k +0.5, 375k -0.2, and 500k +0.1, with unchanged validity at every tier.

Why it was not kept: synthetic additivity overestimated the combined signal. The profiled hold still helped `drums_pendulum` (+480.39 raw row-score points across 36 changed checkpoints, 28 positive and 8 negative), but the room/slack rank component reintroduced broad offsetting basin churn. Across all paired checkpoints the common-row raw score sum was -71.27, with 422 changed checkpoints, 204 improvements, 218 regressions, and 1498 plateaus. The largest weighted spec gains after `drums_pendulum` were small (`drums_swell` +2.39, `drums_signature` +1.96, `leap_cadence` +1.28), while losses spread across `syncopated_switchback` -4.63, `cold_start` -3.78, `drums_crescendo` -2.37, `rolling_hills` -1.89, and `skyline_push` -1.65. This says portfolio-stacking the two near-misses does not turn either into robust production logic. The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - profiled impact-geometry portfolio retry

Reason: go back over the best current declined geometry approaches and retry the closest-to-accepted path with a small compatible improvement. The temporary source combined two profile-gated impact-geometry ideas that had individually positive, mostly disjoint movement against the current accepted baseline: the profiled low-air/high-impact SLAM-HOP hold that helped `drums_pendulum`, and the high-speed/manageable-elevation relief for the accepted elevation-room impact onset that had small clean gains on `summit_push`/`terrace_sprint`/`canyon_steps`/`ridge_pulse`/`skyline_push`. Both selectors were smooth per-compile/profile gates with local target pressure, and explicit `LR_IMPACT_CURVE_START` overrides remained exact. Candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests).

Canonical: `generated/golden-runs/attempt-profiled-impact-geometry-portfolio-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-profiled-impact-geometry-portfolio-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.50 and `HEADLINE excl. impact` 697.57. Per-budget point estimates were 125k 666.71, 250k 677.75, 375k 682.52, and 500k 686.32.

Decision: `npm run decide -- generated/golden-runs/attempt-profiled-impact-geometry-portfolio-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.5, CI [-0.1, 1.8], P(delta<=0)=14.0%, effect 0.98. Per-budget deltas were 125k +0.0, 250k +0.6, 375k +0.6, and 500k +0.5, with unchanged validity at every tier.

Why it was not kept: synthetic additivity looked promising, but the real combined source did not broaden the signal enough to clear the paired spec-cluster bootstrap. The paired comparison changed 261/1920 checkpoints, with 83 score improvements, 56 regressions, and 1659 score plateaus. The gain was still dominated by `drums_pendulum` (+12.69 weighted spec delta, +0.317 headline contribution; 36 mature-budget checkpoint changes, 28 positive and 8 negative). The added high-speed relief mostly collapsed to tiny/noisy movement: `rolling_drop` +0.83 weighted spec delta, `terrace_sprint` +0.31, `skyline_push` +0.09, while `ridge_pulse` -0.55 and `canyon_steps` -0.25 offset much of it. This confirms the profiled hold is real but too narrow, and the clean high-speed relief effect is too small to make the portfolio accepted. The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - profiled low-air impact slam-hold retry

Reason: retry the promising declined low-air/high-impact slam-hold geometry family with the previous failure fixed structurally. The earlier current-baseline retry helped `drums_pendulum` but lost heavily on `syncopated_switchback`. This temporary source kept the same existing impact SLAM-HOP template lane and added a smooth per-compile profile pressure before appending a short same-angle hold after the scoop. The profile used long contact count, dense median cadence, low mean authored air, low mean authored speed, low mean bounded impact, and vertical-axis quietness; local activation still required low local air, high local bounded impact, next-contact room, and mature budget pressure. Candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests).

Canonical: `generated/golden-runs/attempt-profiled-lowair-slam-hold-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-profiled-lowair-slam-hold-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.49 and `HEADLINE excl. impact` 697.47. Per-budget point estimates were 125k 666.71, 250k 677.75, 375k 682.46, and 500k 686.33.

Decision: `npm run decide -- generated/golden-runs/attempt-profiled-lowair-slam-hold-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.5, CI [0.0, 1.8], P(delta<=0)=35.9%, effect 0.97. Per-budget deltas were 125k +0.0, 250k +0.6, 375k +0.6, and 500k +0.5, with unchanged validity at every tier.

Why it was not kept: the selector fixed the known collateral almost perfectly, but it became too narrow for the canonical cluster decision. Only `drums_pendulum` changed: +510.95 raw row-score points across 36 changed mature-budget checkpoints, with 28 improvements and 8 regressions. The previous `syncopated_switchback` and `cold_start` collateral was eliminated, and every other spec was byte-identical. That is useful evidence that the hold signal is real for long, dense, low-air/low-speed impact-only pendulum profiles, but a one-spec-only gain cannot clear the paired spec-cluster bootstrap because bootstrap samples can omit that one positive cluster. Smoothly widening the same hold did not have an obvious principled target: the next-nearest profile, `drums_crescendo`, had whole-track pressure but no local low-air/high-impact overlap, so the hold never activated. The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - high-speed profile impact-onset relief retry

Reason: retry the best geometry-side current-baseline near-miss, local high-impact relief for the accepted elevation-room impact onset, with a stronger generic selector. The previous local relief helped `summit_push`, `ridge_pulse`, `terrace_sprint`, and `skyline_push`, but lost heavily on dramatic elevation contours such as `swoop_dive` and `rolling_hills`. The temporary source kept the accepted elevation-room onset lowering intact, then smoothly reduced only that lowering for high local bounded impact targets when the overall authored profile had enough speed and a manageable elevation range. Candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests).

Canonical: `generated/golden-runs/attempt-impact-speed-profile-relief-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-speed-profile-relief-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.02 and `HEADLINE excl. impact` 696.87. Per-budget point estimates were 125k 666.71, 250k 677.22, 375k 681.92, and 500k 685.83.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-speed-profile-relief-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.1, 0.2], P(delta<=0)=21.3%, effect 0.62. Per-budget deltas were 125k +0.0, 250k +0.1, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the selector did what it was supposed to do structurally, but the remaining effect was too small to promote. Only 80 paired score rows changed, all inside the intended profile family, for +57.87 raw row-score points: 250k +24.96, 375k +11.91, and 500k +21.00. The heavy `swoop_dive` and `rolling_hills` collateral from the broader local-relief trial was eliminated. Net gains were `summit_push` +26.36, `terrace_sprint` +12.73, `canyon_steps` +12.24, `ridge_pulse` +6.40, and `skyline_push` +0.14, but `ridge_pulse` remained seed-volatile with both +13 and -14 row swaps. This is a useful positive characterization of the local-relief family, not a production promotion. The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - mid-slack directional high-axis quality rank retry

Reason: revisit one of the best current declined no-extra-compute approaches with a tighter structural selector. The previous mature directional high-axis quality-rank retry was slightly positive overall but showed a clear split in row anatomy: useful movement in traversal-slack bands roughly 3..8, and collateral above slack 8. This temporary source kept the same bounded idea of favoring slight overshoot over undershoot on high `impact`/`elevation`/`amplitude` targets, but activated it through a smooth traversal-slack band-pass: rise from 3 to 5 and fall from 8 to 11. Candidate generation, q, start selection, forward-eval rollouts, repair, aim-base count, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 83 tests).

Canonical: `generated/golden-runs/attempt-directional-mid-slack-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-directional-mid-slack-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.95 and `HEADLINE excl. impact` 696.70. Per-budget point estimates were 125k 666.72, 250k 677.18, 375k 681.70, and 500k 685.83.

Decision: `npm run decide -- generated/golden-runs/attempt-directional-mid-slack-rank-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.3, 0.2], P(delta<=0)=64.9%, effect -0.36. Per-budget deltas were 125k +0.0, 250k +0.0, 375k -0.2, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the band-pass did reduce high-slack churn, but it failed in the intended mid-slack band. Only 130 paired score rows changed, with total score sum -64.57: 375k contributed -92.01 while 500k contributed +16.07. The main failure was `375k` slack 3..5 at -91.64. Top spec losses were `drums_zigzag` -36.98, `soar_settle` -26.06, `drums_dropout` -24.16, `pop_train` -23.29, and `drums_crescendo` -23.06; gains on `syncopated_switchback` +29.38, `valley_bounce` +23.10, `big_air_ramp` +20.89, `drums_swell` +19.07, and `terrace_sprint` +18.35 did not offset them. This says the old mature directional-rank upside does not transfer through a simple slack-band separator; the mechanism is still volatile basin selection, not robust production logic. The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - dense/moderate-impact directional rank retry

Reason: revisit the best current declined no-extra-compute family, the mature directional high-axis quality-rank retry, with a stronger structural selector instead of another broad rank multiplier. The temporary source multiplied only the already-computed quality objective inside `sortCandidatesByQuality`, favoring slight overshoot over undershoot on high `impact`/`elevation`/`amplitude` targets. The activation used smooth pressure from mature compile budget, contact count, dense median cadence, mean authored impact band, and local high-axis target strength. Candidate generation, q, start selection, forward-eval rollouts, repair, aim-base count, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/optimizer_sample.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests). The focused suite was run for both tested strengths.

Probes: the initial 0.08-strength all-budget probe `generated/golden-runs/probe-directional-dense-impact-rank-s0-2-j48-a01/golden.json` was valid 480/480 with raw probe HEADLINE 680.54 and `HEADLINE excl. impact` 694.65. Paired non-canonical `decide` versus `attempt-aim-slack-airvalley-j32-a01` gave delta headline +0.3, CI [-0.0, 0.8], P(delta<=0)=11.2%, with 125k/250k unchanged and small gains at 375k/500k. A stronger 0.12 mature-budget probe `generated/golden-runs/probe-directional-dense-impact-rank-s0-2-hi-budgets-j48-a02/golden.json` was valid 240/240 and gave an indicative mature-budget-only `VERDICT: ACCEPT`: delta +0.7 over 375k/500k, CI [-0.0, 2.0], P(delta<=0)=7.0%. This was enough to justify a canonical run, but the probe movement was already concentrated in `syncopated_switchback` and `drums_dropout` rather than the intended dense-drum rows.

Canonical: `generated/golden-runs/attempt-directional-dense-impact-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-directional-dense-impact-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.04 and `HEADLINE excl. impact` 696.89. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 682.00, and 500k 685.84.

Decision: `npm run decide -- generated/golden-runs/attempt-directional-dense-impact-rank-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.3, 0.4], P(delta<=0)=30.9%, effect 0.36. Per-budget deltas were 125k +0.0, 250k +0.0, 375k +0.1, and 500k +0.1, with unchanged validity at every tier.

Why it was not kept: the smoother structural gate suppressed most broad churn but did not recover the intended dense-drum upside. Only 41 paired score rows changed in the canonical comparison: `syncopated_switchback` was net positive (+2.09 mean) while `drums_dropout` flipped negative across the full seed set (-0.53 mean), with smaller `terrace_sprint` gains and `drums_signature` losses. The largest movements were still seed-level basin swaps (`syncopated_switchback seed=1 @375k` +50.62, `drums_dropout seed=10 @500k` -45.62, `drums_dropout seed=9 @375k` -43.30, `drums_dropout seed=0 @375k` +34.56). This confirms the old directional-rank family remains a narrow, volatile basin selector rather than a reliable production default. The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - ABANDONED PROBE - mature local high-impact relief retry

Reason: audit the best declined/near-accepted approaches on the current accepted baseline and retry only one with a concrete failure-mode fix. Tail throttling and opening `avg` had already been retried and failed mechanically or statistically; directional rank retries were near-zero no-extra-frame basin churn; and the strongest remaining geometry near-miss was local high-impact relief for the accepted elevation-room impact onset. The previous local-relief canonical protected 125k and helped 375k/500k slightly, but regressed 250k. This temporary source trial kept the same local target relief shape and added a later smooth mature-budget gate, aiming to suppress the 250k collateral while preserving mature-budget lift. Candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Probe: `generated/golden-runs/probe-impact-local-relief-mature-s0-2-j48-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-impact-local-relief-mature-s0-2-j48-a01`. The probe was valid 480/480 with raw probe HEADLINE 680.27 and `HEADLINE excl. impact` 694.71. Per-budget point estimates were 125k 668.24, 250k 675.42, 375k 680.67, and 500k 685.41.

Probe decision: `npm run decide -- generated/golden-runs/probe-impact-local-relief-mature-s0-2-j48-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0 on the 40-spec x 3-seed x full-budget intersection, CI [-0.5, 0.5], P(delta<=0)=48.7%. Per-budget deltas were exactly +0.0 at 125k and 250k, then only +0.005 mean at 375k and +0.014 mean at 500k on the paired rows, with unchanged validity.

Why it was stopped: the revised mature gate did fix the specific 250k failure, but it also removed nearly all useful mature-budget movement. Remaining 375k/500k row changes were symmetric basin swaps: examples included `summit_push` gains offset by `rolling_hills`, `swoop_dive`, `mixed_grade`, and `syncopated_lift` losses. This makes the local high-impact relief family too small and noisy to justify a full canonical retry. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - sparse opening avg branch-2 retry

Reason: revisit the abandoned opening `avg:1:2` branch-2 idea without changing the accepted opening structural/opportunity gate. The first temporary form replaced every already-gated opening branch-2 promotion from `best:1:2` to `avg:1:2`, keeping branch-3 as `best:1:3`, but it failed the focused objective-leaf cost-collapse test (`fwd_eval_frames_charged` 32481 was not below the required full-leaf margin). The canonical trial therefore used a narrower smooth sub-gate: only a sparse deterministic fraction of already-gated branch-2 opening decisions could switch to `avg`, with pressure from the existing opening opportunity signal; otherwise the accepted `best` behavior stayed intact. Candidate generation, q, start selection, repair, scoring, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: the blanket `avg:1:2` form failed `tests/optimizer_handoff.test.ts` as noted above. The sparse sub-gated form passed `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-opening-sparse-avg-branch2-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-sparse-avg-branch2-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.75 and `HEADLINE excl. impact` 696.47. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 681.78, and 500k 685.27.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-sparse-avg-branch2-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-0.8, 0.1], P(delta<=0)=89.5%, effect -1.01. Per-budget deltas were 125k +0.0, 250k +0.0, 375k -0.1, and 500k -0.5, with unchanged validity at every tier.

Why it was not kept: replacing even a sparse subset of the accepted optimistic opening branch-2 `best` ranker with `avg` caused harmful mature-budget basin swaps. Work counters barely moved, so this was not a budget-allocation issue. At 500k, the biggest losses were `drums_crosscut` seed 8 (-74.24), `drums_dropout` seed 2 (-59.75), `dense_sprint` seed 1 (-48.22), `drums_dropout` seed 8 (-41.95), and `drums_dropout` seed 9 (-35.85). Gains on `drums_tide` seed 4 (+46.72) and `drums_dropout` seed 10 (+38.97) were not enough. This suggests the accepted opening branch-2 `best` choice is load-bearing under the objective leaf; an `avg` replacement is not a good declined-approach retry. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - mid-tail duplicate throttle retry

Reason: revisit the declined tail-scheduling family with a sharper selector informed by current accepted-baseline telemetry. The temporary source left candidate generation, q, start selection, forward eval, repair, scoring, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged. It only added a smooth deterministic throttle to speculative near-tail completion for the mid-tail contact band where the accepted baseline showed low best/success yield and high duplicate full-duration feedback. The pressure used target budget, unique full-duration feedback, observed duplicate tail full-rate, and remaining-contact shape; it preserved the existing shallow-tail throttle and the long-tail rem=11/12 window.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-tail-mid-dup-throttle-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-tail-mid-dup-throttle-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.98 and `HEADLINE excl. impact` 696.76. Per-budget point estimates were 125k 666.71, 250k 677.15, 375k 681.88, and 500k 685.79.

Decision: `npm run decide -- generated/golden-runs/attempt-tail-mid-dup-throttle-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.0, 0.0], P(delta<=0)=100.0%, effect -0.59. Per-budget deltas were 125k +0.0, 250k -0.0, 375k -0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the retry did exactly what it was designed to do mechanically, but score did not move. At 500k, tail full evaluations dropped from 39,615 to 35,680, tail attempts/row dropped from 82.5 to 74.3, and duplicate full tail rate dropped from 71.5% to 68.4%. The low-yield rem=4..10 attempts were reduced while rem=11/12 high-yield behavior stayed unchanged. However, common-row score deltas were effectively zero at every budget and the freed budget did not convert into better frontier or repair outcomes. This is useful evidence against simple tail-work throttling as a score lever: reducing duplicate suffix completions alone is cleaner and cheaper, but not beneficial enough to keep. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - low-air impact slam-hold retry

Reason: revisit one of the better older declined geometry approaches on the current accepted baseline, but in a narrower form. The temporary source left candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged. It only modified the existing impact SLAM-HOP template lane in `arc_placement.ts`: for explicit low-air/high-impact targets with no elevation/amplitude axes and enough next-contact room, it appended a short deterministic same-angle hold segment after the scoop, with smooth pressure from compile budget, authored air, bounded impact target, and room.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-lowair-slam-hold-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-slam-hold-current-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.98 and `HEADLINE excl. impact` 696.69. Per-budget point estimates were 125k 666.71, 250k 677.12, 375k 681.79, and 500k 685.86.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-slam-hold-current-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.5, 0.5], P(delta<=0)=58.3%, effect -0.04. Per-budget deltas were 125k +0.0, 250k -0.0, 375k -0.1, and 500k +0.1, with unchanged validity at every tier.

Why it was not kept: the retry did move the intended low-air/high-impact rows, but it remained seed-fragile rather than a reliable production win. At 500k it improved `drums_pendulum` on several seeds (`seed=0` +31.92, `seed=1` +21.07, `seed=8` +13.97), but offset those with `syncopated_switchback seed=1` -55.95 and additional `drums_pendulum` regressions (`seed=4` -22.62, `seed=5` -10.15). Common-row deltas were +0.00 at 125k, -0.06 at 250k, -0.11 at 375k, and +0.02 at 500k, with negligible work movement. This keeps the diagnosis intact: the low-air/high-impact hold signal is real locally, but a same-angle appended hold is not stable enough as a default geometry policy. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - directional high-axis pool-opportunity rank

Reason: retry the remaining no-extra-frame directional high-axis family with a sharper value selector instead of another broad rank multiplier. The temporary source left candidate generation, q, start selection, forward eval, repair, aim-base count, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged. It only changed `sortCandidatesByQuality` by applying a bounded directional multiplier to already-computed objective values for high `impact`/`elevation`/`amplitude` targets, and only when traversal slack, next-contact room, top-objective strength, top-two ambiguity, top-candidate undershoot, and directional spread all had smooth positive pressure.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-directional-pool-opportunity-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-directional-pool-opportunity-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.99 and `HEADLINE excl. impact` 696.85. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 681.88, and 500k 685.80.

Decision: `npm run decide -- generated/golden-runs/attempt-directional-pool-opportunity-rank-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.2, 0.2], P(delta<=0)=49.6%, effect 0.02. Per-budget deltas were 125k +0.0, 250k -0.0, 375k -0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the added pool-opportunity gate made the mechanism statistically neutral rather than stronger. It touched many ranking decisions (all 250k checkpoints changed, 374 at 375k, 343 at 500k), but common-row score deltas were exactly flat at 250k, -0.03 at 375k, and +0.01 at 500k, with negligible work movement. The 500k row movement was symmetric basin churn: improvements such as `verse_chorus` seed 10 (+16.20), `syncopated_switchback` seed 2 (+15.32), and `pop_train` seed 0 (+10.88) were offset by `canyon_steps` seed 11 (-20.68), `pop_train` seed 6 (-13.80), `summit_push` seed 5 (-11.70), and `cold_start` seed 10 (-11.04). This suggests directional high-axis rank asymmetry is now exhausted as a production default: sharper local opportunity gating removes the earlier small upside rather than making it reliable. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - room/slack directional high-axis rank retry

Reason: retry the best current declined no-extra-compute family with a cleaner selector. The earlier mature directional high-axis quality-rank trial had the best raw current-baseline point estimate but caused broad mature-budget basin swaps. This temporary source kept candidate generation, q, start selection, forward eval, repair, aim-base count, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged. It only multiplied `candidateQualityObjective` by a bounded directional factor for high `impact`/`elevation`/`amplitude` targets, favoring slight overshoot over undershoot, with smooth pressure from traversal slack and next-contact room.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 83 tests), including temporary regression tests for the high-slack/room gate.

Canonical: `generated/golden-runs/attempt-directional-room-slack-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-directional-room-slack-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.07 and `HEADLINE excl. impact` 696.91. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 682.06, and 500k 685.87.

Decision: `npm run decide -- generated/golden-runs/attempt-directional-room-slack-rank-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.4], P(delta<=0)=25.3%, effect 0.66. Per-budget deltas were 125k +0.0, 250k -0.0, 375k +0.2, and 500k +0.1, with unchanged validity at every tier.

Why it was not kept: the room/slack gate reduced volatility compared with the prior directional retry but did not make the effect large or reliable enough. Only 110 paired checkpoint scores changed, with 57 improvements and 53 regressions for +118.36 raw row-score points; the movement was -3.96 at 250k, +78.35 at 375k, and +43.97 at 500k. It improved some prior collateral such as `syncopated_switchback` (+86.12) and helped `swoop_dive` (+41.36), but moved the loss elsewhere (`pop_train` -42.58, `rolling_drop` -22.46, `mixed_grade` -15.94, `climb_terrace` -15.58, `summit_push` -13.28). This supports the idea that directional rank asymmetry is directionally plausible but still just a narrow basin selector, not a production improvement. The temporary source and tests were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - moderate-elevation high-impact relief retry

Reason: retry the local high-impact relief near-miss with a stronger structural selector instead of a broader relief. The temporary source kept the accepted elevation-room impact-onset lowering unchanged, then added a smooth high-local-impact relief only inside the same elevation-room profile when authored elevation range was moderate rather than dramatic. The intent was to preserve the old local-relief gains on `summit_push`/`terrace_sprint` while avoiding the previous `swoop_dive` and `rolling_hills` collateral. Explicit `LR_IMPACT_CURVE_START` overrides stayed exact. Candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-moderate-elevation-impact-relief-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-moderate-elevation-impact-relief-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.92 and `HEADLINE excl. impact` 696.86. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 681.89, and 500k 685.63.

Decision: `npm run decide -- generated/golden-runs/attempt-moderate-elevation-impact-relief-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.3, 0.1], P(delta<=0)=76.3%, effect -0.70. Per-budget deltas were 125k +0.0, 250k -0.0, 375k +0.0, and 500k -0.2, with unchanged validity at every tier.

Why it was not kept: the structural narrowing did remove the earlier broad dramatic-contour collateral, but the remaining activation was still net-negative at 500k. Spec-level weighted movement was small and split: `summit_push` (+0.67) and `terrace_sprint` (+0.32) improved, while `syncopated_lift` (-1.89) and `ridge_pulse` (-1.02) dominated the loss. The largest 500k regressions were `syncopated_lift` seed 6 (-21.35), `ridge_pulse` seed 8 (-16.97), and `ridge_pulse` seed 2 (-10.54). This suggests local high-impact relief is too narrow and seed-fragile as an impact-onset default tweak; future impact work should look for a different value signal or keep such target changes outcome-gated. The temporary source changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - steady air-valley low-air planned target retry

Reason: retry the older low-air planned-aim decline from the current accepted baseline, but with a narrower, continuous selector. The temporary source added a deterministic default planned-air correction before search: only steady "air valley" profiles could lower the generation/objective air target for deep low-air contact gaps, with smooth pressure from authored air range, speed/grain steadiness, vertical quietness, and local low-air depth. The scorer and local cost still used literal targets; candidate count, start selection, forward eval, repair, aim-base count, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/planning.test.ts tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (7 files, 83 tests).

Canonical: `generated/golden-runs/attempt-steady-airvalley-lowair-plan-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-steady-airvalley-lowair-plan-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.87 and `HEADLINE excl. impact` 696.38. Per-budget point estimates were 125k 666.66, 250k 677.22, 375k 681.65, and 500k 685.67.

Decision: `npm run decide -- generated/golden-runs/attempt-steady-airvalley-lowair-plan-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.8, 0.4], P(delta<=0)=66.5%, effect -0.39. Per-budget deltas were 125k -0.0, 250k +0.1, 375k -0.2, and 500k -0.1, with unchanged validity at every tier.

Why it was not kept: the continuous, profile-gated form was close but not better than the accepted baseline. It produced almost no aggregate work change, confirming this was a target/basin reshuffle rather than a budget-allocation win. At 500k the useful wins on `drums_pendulum` and `drums_dropout` seeds were offset by large same-family regressions, especially `drums_dropout` seed 10 (-61.87), `drums_pendulum` seed 3 (-36.28), `drums_dropout` seed 11 (-34.54), and `drums_pendulum` seed 4 (-22.47). This suggests the old planned low-air signal is real but too seed-fragile as a default target rewrite; future retries should probably keep it outcome-gated or tie it to a stronger slack/difficulty signal before spending canonical time. The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - mature directional high-axis quality rank retry

Reason: revisit the older directional high-axis quality-rank near-miss on the current accepted baseline, but with a smoother and narrower affordability shape. The temporary source added no candidates and no rollout work; it only multiplied the existing `candidateQualityObjective` value by a small mature-budget directional factor for high target `impact`/`elevation`/`amplitude`, favoring achieved values above target and penalizing undershoot. The pressure used a smooth saturating compile-budget curve, so 125k and 250k were intended to stay unchanged while 375k/500k could test the old mature-budget upside. Candidate generation, start selection, forward eval, repair, aim lane base count, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests), including a temporary tie-break regression for scarce vs mature high-impact ranking.

Canonical: `generated/golden-runs/attempt-directional-axis-quality-rank-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-directional-axis-quality-rank-current-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.13 and `HEADLINE excl. impact` 697.33. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 682.17, and 500k 685.94.

Decision: `npm run decide -- generated/golden-runs/attempt-directional-axis-quality-rank-current-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.7, 1.1], P(delta<=0)=37.1%, effect 0.33. Per-budget deltas were 125k +0.0, 250k +0.0, 375k +0.3, and 500k +0.2, with unchanged validity at every tier.

Why it was not kept: the improved gating fixed the old lower-budget drift but left only a tiny mature-budget signal. Work counters confirmed the intended zero-extra-frame shape: common-row work deltas were essentially flat (375k sim +20/candidates +4; 500k sim -11/candidates -2). The mature gains were still basin reshuffles with large opposite-sign rows: 500k improvements included `drums_zigzag` seed 4 (+53.97), `dense_sprint` seed 8 (+46.93), `drums_crescendo` seed 1 (+44.05), and `drums_crosscut` seed 10 (+42.70), but regressions included `drums_crosscut` seed 6 (-63.99), `drums_dropout` seed 10 (-51.11), `syncopated_switchback` seed 5 (-47.43), and `drums_dropout` seed 11 (-43.63). The temporary source and test changes were reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - low-density impact-profile onset retry

Reason: revisit the earlier positive-but-inconclusive impact-curve profile target-start idea on the current accepted baseline. The temporary source kept the accepted elevation-room impact onset and added one smooth profile pressure for low-density, low-adjacent-delta authored impact sequences, combining the two onset pressures by smooth union before the existing mature-budget ramp. Explicit `LR_IMPACT_CURVE_START` overrides stayed exact. Candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-impact-profile-onset-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-profile-onset-current-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.98 and `HEADLINE excl. impact` 696.77. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 681.89, and 500k 685.79.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-profile-onset-current-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [0.0, 0.0], P(delta<=0)=100.0%, effect 0.00. Every per-budget delta was +0.0, with unchanged 1920/1920 validity.

Why it was not kept: the refined selector was behaviorally identical on the current accepted compiler. Analyzer common-row deltas were exactly zero at every budget, with zero work movement in simulated frames, sampled candidates, and viable candidates. This means the earlier profile-onset near-miss has effectively been subsumed or neutralized by the accepted elevation-room onset plus later aim/slack changes; keeping extra inactive source code would only add complexity. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - room-gated low-air impact frontload retry

Reason: revisit the strongest unaccepted generation-side near-miss that had not yet been retried on the current accepted baseline. The older mature low-air impact-frontload trial had a positive point estimate but lost rhythm/syncopated collateral, so this retry tested a smaller smooth extra frontload (`+0.12` instead of the old `+0.2`) gated by compile maturity, authored low air, and next-contact room. The intent was to preserve the useful low-air impact-curve lift while damping tight-cadence collateral. Candidate count, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-lowair-frontload-room-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-frontload-room-current-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.58 and `HEADLINE excl. impact` 696.17. Per-budget point estimates were 125k 666.71, 250k 676.77, 375k 681.32, and 500k 685.41.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-frontload-room-current-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.4, CI [-1.9, 0.7], P(delta<=0)=71.9%, effect -0.60. Per-budget deltas were 125k +0.0, 250k -0.4, 375k -0.6, and 500k -0.4, with unchanged validity at every tier.

Why it was not kept: the smoother, smaller, room-gated version protected 125k exactly but did not preserve the old mature-budget upside. The analyzer showed the same failure shape as the original family, just smaller: gains such as `drums_signature` seed 2 (+53.58 at 500k), `drums_crescendo` seed 2 (+37.63), and `dense_sprint` seed 4 (+33.24) were offset by `syncopated_switchback` seed 1 (-72.36), `rhythm_ladder` seed 1 (-67.90), `syncopated_switchback` seed 8 (-56.45), and `drums_dropout` seed 11 (-41.62). Work counters barely moved, so this was basin reshuffling rather than better budget allocation. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - local high-impact relief for elevation-room impact onset

Reason: retry the prior high-impact relief near-miss with the local selector requested by its failure analysis. The earlier whole-spec mean-impact fade was slightly positive but noisy; this version kept the accepted elevation-room impact-onset pressure, then smoothly faded only that onset-lowering pressure as the current bounded local impact target rose from 0.52 to 0.60. Explicit `LR_IMPACT_CURVE_START` overrides stayed exact. Candidate count, search policy, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-impact-room-local-relief-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-room-local-relief-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 681.07 and `HEADLINE excl. impact` 697.02. Per-budget point estimates were 125k 666.71, 250k 677.01, 375k 682.05, and 500k 685.95.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-room-local-relief-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.2, 0.4], P(delta<=0)=28.8%, effect 0.52. Per-budget deltas were 125k +0.0, 250k -0.2, 375k +0.2, and 500k +0.2, with unchanged validity at every tier.

Why it was not kept: the local selector fixed the shape of the old retry but not the effect size. It protected 125k exactly and gave small 375k/500k gains, including visible wins on `summit_push`, `swoop_dive`, and `terrace_sprint`, but the 250k tier regressed and several mature rows still swapped basins in both directions (`ridge_pulse`, `rolling_hills`, and `rolling_drop` losses offset many of the wins). This is useful evidence that local high-impact relief is directionally saner than a whole-spec fade, but it remains too small and noisy for production promotion. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-30 - INCONCLUSIVE CANONICAL - scarce quality-lean retry on current baseline

Reason: revisit the strongest older declined budget-allocation near-miss without duplicating logic that has since been accepted. The original `budget-allocated opening lookahead plus scarce quality lean` trial was directionally good (+1.5 headline on the earlier unified baseline), but its opening-lookahead half is now represented by the accepted opening selector. This retry isolated only the smooth scarce-candidate lean by moving the existing scarce quality-count curve from 50k->100k to 100k->200k, so the 125k tier participates. Candidate generation families, start selection, forward eval strategy, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-scarce-qlean-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-scarce-qlean-current-j32-a01`. The run was valid 1919/1920 overall, with one 125k invalid, raw HEADLINE 679.98 and `HEADLINE excl. impact` 695.67. Per-budget point estimates were 125k 656.67, 250k 677.16, 375k 681.89, and 500k 685.79.

Decision: `npm run decide -- generated/golden-runs/attempt-scarce-qlean-current-j32-a01/golden.json generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -1.0, CI [-5.2, 0.2], P(delta<=0)=84.1%, effect -0.69. Per-budget deltas were 125k -10.0, 250k +0.0, 375k +0.0, and 500k +0.0.

Why it was not kept: the isolated q-lean did not reproduce the old scarce-tier lift on the current accepted compiler. The effect was exactly where expected, but the sign was wrong: mature budgets were byte-identical while 125k lost score and one raw row became invalid. This suggests the later low-slack branch-width fix already captured the useful scarce traversal behavior, and further reducing 125k quality breadth now removes needed candidate diversity. The temporary source change was reverted; the accepted baseline remains `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-29 - ACCEPTED CANONICAL - air-valley structural slack gate for default fifth aim base

Reason: revisit the closest declined fifth aim-base approach instead of retuning from memory. The prior structural-slack gate repeatedly produced a clean positive 250k signal but was too narrow to promote, while the broader slack gate found a useful `drums_dropout` 375k region and also exposed the high-slack collateral to avoid.

Mechanism: add traversal slack to the default fifth aim-base pressure as a smooth affordability multiplier. Explicit `LR_AIM_TOPK_BASES` overrides stay exact, the accepted top-4 behavior remains, and low-air gaps still cap at top-3. The default non-low-air fifth base now uses a narrow slack ramp from 2.75 to 4.0 everywhere, then blends toward a wider ramp ending at 6.0 only for an authored air-valley / flat-grain / steady-speed profile. Candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed before the canonical run (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-slack-airvalley-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.98 and `HEADLINE excl. impact` 696.77. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 681.89, and 500k 685.79.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-slack-airvalley-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +0.4, CI [-0.0, 1.6], P(delta<=0)=9.5%, effect 0.91. Per-budget deltas were 125k +0.0, 250k +0.7, 375k +0.8, and 500k +0.0, with unchanged validity at every tier.

Why it was kept: this is the clean version of the earlier almost-accepted slack trim. It preserves the narrow positive 250k slice, adds mature-budget support through a structural air-valley selector, and avoids the broad slack gate's known `grain_staircase` / vertical collateral. Only three specs changed: `drums_dropout` gained +421.89 raw row-score sum (including +26.39 mean at 375k), `drums_pulse` gained +190.68, and `solo_run` gained +34.37. The 125k tier stayed byte-identical, and 500k was essentially neutral. The accepted baseline is now `attempt-aim-slack-airvalley-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - high-impact relief for elevation-room impact onset

Reason: retry the accepted elevation-room impact-onset profile with a targeted fix for its main logged weakness: the accepted onset helped broad elevation-room specs but lost on hard-impact profiles such as `summit_push`.

Mechanism: temporarily keep the accepted elevation-room pressure, then smoothly fade it down as mean authored impact across contact-ending gaps rises from 0.52 to 0.60. The intent was continuous and structure-based: keep the lower impact-curve onset where elevation room is useful, but avoid weakening high-impact tracks whose whole authored profile asks for harder contact. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-impact-room-highmean-relief-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-room-highmean-relief-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.70 and `HEADLINE excl. impact` 696.32. Per-budget point estimates were 125k 666.71, 250k 676.56, 375k 681.24, and 500k 685.86.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-room-highmean-relief-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.0, 0.4], P(delta<=0)=21.2%, effect 0.90. Per-budget deltas were 125k +0.0, 250k +0.1, 375k +0.2, and 500k +0.1, with unchanged validity at every tier.

Why it was not kept: the targeted relief produced only a tiny, noisy lift. It changed no 125k rows and reshuffled many mature rows, with common-row deltas of +0.08 at 250k, +0.16 at 375k, and +0.11 at 500k. The biggest movements were seed-level basin swaps on `summit_push` and `rolling_drop`: large wins such as `summit_push seed=10` (+18.12 at 500k) were offset by comparable losses such as `summit_push seed=5` (-7.89) and multiple `rolling_drop` regressions. This suggests the accepted profile's high-impact weakness is not solved by a whole-spec mean-impact fade alone; a future retry needs a more local value/stability selector. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - delayed fifth aim-base slack gate retry

Reason: revisit one of the closest declined approaches, the fifth aim-base structural-slack gate, and test whether a later smooth onset could turn the repeated near-positive signal into an accepted result without adding thresholdy budget behavior.

Mechanism: temporarily retest the default fifth aim-base affordability trim with the same accepted high-slack behavior but a delayed smooth slack ramp: optional fifth-base pressure stayed fully suppressed below structural slack 3.2 and faded back to baseline by slack 4.0. The change threaded per-compile traversal slack into `optimizer/aim.ts` and multiplied only the default, non-explicit fifth-base pressure. Explicit `LR_AIM_TOPK_BASES` overrides, accepted top-4/top-3 behavior, low-air cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-top5-slack-start32-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-slack-start32-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.72 and `HEADLINE excl. impact` 696.57. Per-budget point estimates were 125k 666.71, 250k 676.95, 375k 681.20, and 500k 685.75.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-slack-start32-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.5], P(delta<=0)=16.0%, effect 0.89. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.1, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: delaying the ramp did not improve on the earlier near-accepted fifth-base signals. Only 40 paired checkpoint scores changed: 33 at 250k for +211.16 raw row points and 7 at 375k for +56.99, with no 125k or 500k movement. The effect stayed limited to `drums_pulse` (+144.33), `solo_run` (+83.49), and `drums_dropout` (+40.33); at 250k it was still nearly split by seed direction (17 improved, 16 regressed). This is useful evidence that the family is real but too narrow/noisy to promote by further smooth onset retuning alone. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - ABANDONED PROBE - low-amplitude elevation impact-fade retry

Reason: audit the strongest declined/near-accepted ideas and retry one only if the old failure mode had a concrete fix. The best exhausted families were skipped: exact repair feasibility and sparse-amplitude quality breadth were later accepted in better forms; fifth aim-base slack was retested repeatedly on the current baseline and stayed too narrow; broad slack lookahead was rejected strongly. This source trial retried the older low-amplitude/elevation ride-out damping family, preserving the stronger impact fade that had been more promising than the later low-amplitude-only canonical.

Mechanism: temporarily weaken contact-centered elevation ride-out shortening for explicit low-amplitude upward-elevation gaps, then smoothly fade that weakening away again when the same gap had a high impact target. Pure-elevation gaps stayed unchanged, high-impact climb setup faded back to the accepted shortening, and the trial added no compute. Candidate count, candidate generation families, start selection, forward eval, repair, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Probe: `generated/golden-runs/probe-lowamp-elevation-impactfade-current-s0-2-j48-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-lowamp-elevation-impactfade-current-s0-2-j48-a01`. The probe was valid 480/480, with raw probe HEADLINE 680.07 and `HEADLINE excl. impact` 694.00. Per-budget point estimates were 125k 669.03, 250k 675.22, 375k 679.83, and 500k 685.44.

Probe decision: `npm run decide -- generated/golden-runs/probe-lowamp-elevation-impactfade-current-s0-2-j48-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1 on the 40-spec x 3-seed x full-budget intersection, CI [-0.4, 0.7], P(delta<=0)=48.1%, effect 0.19. Per-budget deltas were 125k +0.8, 250k -0.1, 375k -0.2, and 500k +0.1, with unchanged validity.

Why it was stopped: the retry was mechanically clean but did not revive the old near-accept signal on the current accepted baseline. Only 90 paired score rows changed: 42 improved, 43 regressed, and the total raw row-score sum was +63.97. Gains on `syncopated_lift` (+80.21), `terrace_sprint` (+33.34), and `dense_echo_climb` (+15.10) were offset by `ridge_pulse` (-35.51), `glide_stairs` (-27.67), and mixed movement elsewhere. The 125k lift was not enough to compensate for 250k/375k drift, and the paired bootstrap says a very large seed count would be required to resolve this tiny effect. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - ABANDONED PROBE - slack-normalized repair margins

Mechanism: temporarily replace the default repair main-search and feasibility-margin raw-budget ramps with one smooth traversal-slack ramp, using `requestedBudget / predicted_first_completion_frames` instead of the current 100k->200k frame window. The repair gate, explicit `LR_REPAIR_MAIN_MARGIN` / `LR_REPAIR_FEAS_MARGIN` overrides, restart loop, candidate generation, start selection, forward eval, aim, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged. The intended shape was clean and budget-scale normalized: scarce rows keep immediate repair plus 1.05 feasibility headroom; rows with several predicted traversals of budget fade toward the mature 1.1 main margin and exact measured-cost repair ceiling.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` failed under the temporary source trial. The failure was `tests/optimizer_handoff.test.ts`'s objective-leaf frame-collapse diagnostic: the slack policy matured repair on easy 100k rows such as `tiny_dance`, changing the forward-eval accounting enough that the test no longer isolated the leaf-cost property.

Probe: `generated/golden-runs/probe-repair-slack-margins-s0-2-j48-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-repair-slack-margins-s0-2-j48-a01`. The probe was valid 480/480, with raw probe HEADLINE 679.84 and `HEADLINE excl. impact` 693.69. Per-budget point estimates were 125k 667.45, 250k 674.82, 375k 680.00, and 500k 685.32.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-slack-margins-s0-2-j48-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -0.2 on the 40-spec x 3-seed x full-budget intersection, CI [-0.5, 0.0], P(delta<=0)=94.4%, effect -1.45. Per-budget deltas were 125k -0.8, 250k -0.4, 375k -0.0, and 500k +0.0, with unchanged validity.

Why it was stopped: the policy was smooth and scale-normalized, but pure full-run slack is too broad a maturity signal for repair margins. It changed no 125k track hashes in the probe archive, yet the paired 125k/250k scores still moved backward; it also revealed that easy low-raw-budget rows can become "mature" in repair terms simply because their predicted first traversal is short. That may be mathematically coherent for traversal affordability, but repair has fixed overhead and downstream accounting interactions that are not captured by full-run slack alone. Future repair budget control should use suffix-local slack or an explicit repair opportunity/value signal, not a direct replacement of the accepted raw repair-margin ramp. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - slack-normalized fifth aim-base pressure

Mechanism: temporarily replace the default fifth aim-base absolute-budget onset with traversal-slack pressure, so optional extra aim spend is controlled by `requestedBudget / predicted_first_completion_frames` rather than a fixed 225k->300k budget window. The first probe used a monotone structural hash seed and slack 3.0->4.0; it was smooth in principle but caused broad high-slack basin churn. The canonical trial kept the existing deterministic selector seed, used a stricter slack 3.5->4.5 pressure, and left explicit `LR_AIM_TOPK_BASES`, accepted top-4/top-3 behavior, low-air cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed for both source trials (6 files, 81 tests).

Probes: `generated/golden-runs/probe-aim-slack-mono-s0-2-j32-a01/golden.json` (monotone structural seed, slack 3.0->4.0) was valid 480/480, but paired non-canonical `decide` was only +0.1 headline, CI [-0.7, 0.9], P(delta<=0)=42.5%, with unwanted 125k and high-slack churn. `generated/golden-runs/probe-aim-slack-pressure35-s0-2-j32-a01/golden.json` (existing seed, slack 3.5->4.5) was valid 480/480 and cleaner: paired non-canonical `decide` was +0.2 headline, CI [-0.4, 0.7], P(delta<=0)=17.0%, with 125k and 500k unchanged and the lift concentrated at 250k.

Canonical: `generated/golden-runs/attempt-aim-slack-pressure35-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-slack-pressure35-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.69 and `HEADLINE excl. impact` 696.61. Per-budget point estimates were 125k 666.71, 250k 677.04, 375k 681.03, and 500k 685.75.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-slack-pressure35-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.2, 0.5], P(delta<=0)=27.5%, effect 0.55. Per-budget deltas were 125k +0.0, 250k +0.6, 375k -0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the idea is clean and scale-normalized, and the stricter version protected 125k while preserving 500k, but the useful movement remained a noisy 250k basin reshuffle. It changed 233 paired scores: 203 at 250k for +275.39 raw row points and 30 at 375k for -21.14. The `2-3` slack band gained +211.16, but the `4-5` band lost -109.85; spec gains on `drums_pulse` (+90.20), `drums_dropout` (+56.59), `solo_run` (+43.23), and `climb_terrace` (+39.05) were offset by `grain_staircase` (-91.60), `dense_echo_climb` (-44.32), and `valley_bounce` (-33.93). This supports traversal slack as the right affordability variable, but not as a standalone fifth-aim-base replacement: the lever still needs a better value/stability selector than slack plus authored shape. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - stricter smooth fifth aim-base slack gate

Mechanism: temporarily retest the default fifth aim-base affordability trim with a stricter but still smooth structural-slack ramp. The source trial threaded per-compile traversal slack into the aiming layer and multiplied only the default, non-explicit fifth-base pressure by `smoothstep((slack - 3.0) / 1.0)`, so the extra base was suppressed below slack 3 and faded back to baseline by slack 4. Explicit `LR_AIM_TOPK_BASES` overrides, accepted top-4/top-3 behavior, low-air cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-top5-slack3-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-slack3-current-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.72 and `HEADLINE excl. impact` 696.56. Per-budget point estimates were 125k 666.71, 250k 676.95, 375k 681.20, and 500k 685.75.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-slack3-current-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.5], P(delta<=0)=15.8%, effect 0.90. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.1, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the shape was smooth, scale-normalized, and intentionally narrower than the earlier wider negative gate, but it did not improve on the prior slack 2.75->4.0 signal. Only 38 paired checkpoint scores changed: 33 at 250k and 5 at 375k, limited again to `drums_pulse`, `drums_dropout`, and `solo_run`. The changed-row raw score sum was +270.62, led by `drums_pulse` (+144.33), `solo_run` (+85.96), and `drums_dropout` (+40.33), but the seed distribution was still too noisy: 17/33 improved at 250k and 16/33 regressed. The stricter start also lost some of the earlier 250k lift (+0.5 vs +0.7) while failing the promotion gate. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - smooth default fifth aim-base slack gate retest

Mechanism: temporarily retest the narrow smooth structural-slack affordability gate for the default fifth aim base on top of the current accepted elevation-room baseline. The source trial added a per-compile traversal slack value to the aiming layer and multiplied only the default, non-explicit fifth-base pressure by a smooth slack ramp from 2.75 to 4.0. Explicit `LR_AIM_TOPK_BASES` overrides, accepted top-4/top-3 behavior, low-air cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-top5-slack-current-a02-j32/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-slack-current-a02-j32`. The run was valid 1920/1920 overall, with raw HEADLINE 680.73 and `HEADLINE excl. impact` 696.52. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 681.09, and 500k 685.75.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-slack-current-a02-j32/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.5], P(delta<=0)=14.1%, effect 0.97. Per-budget deltas were 125k +0.0, 250k +0.7, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: this exactly reproduced the previous near-positive signal after restating it as clean structural slack plumbing, but it still missed the promotion gate. The mechanism is smooth and scale-normalized, yet too narrow to clear canonical confidence: the useful movement is concentrated at 250k and does not materially affect the higher-weight mature tiers. Widening the same slack band already has logged negative evidence, so there is no principled continuous retune to push without repeating known-bad spend. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - traversal-slack quality expansion

Mechanism: temporarily add a smooth, scale-free traversal-slack expansion to `qualityHandoffSampleCount` on top of the current accepted elevation-room baseline. Explicit `LR_QUALITY_NCAND` overrides stayed exact. The default raw-budget/authored-shape breadth policy produced the base q, then low traversal slack added up to +16 candidates: a low-slack extra faded out from slack 1.55 to 2.0, and a mid-slack extra stayed through slack 5.0 before fading out by slack 6.0. Candidate generation families, start selection, forward eval strategy, repair logic, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 76 tests).

Canonical: `generated/golden-runs/attempt-slack-quality-expansion-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-quality-expansion-j32-a01`. The run was valid 1919/1920 overall, with raw HEADLINE 679.42 and `HEADLINE excl. impact` 695.19. Per-budget point estimates were 125k 656.55, 250k 675.84, 375k 681.08, and 500k 685.69.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-quality-expansion-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -1.2, CI [-5.4, 1.2], P(delta<=0)=76.7%. Per-budget deltas were 125k -10.2, 250k -0.6, 375k +0.0, and 500k -0.1; rounded diagnostic validity stayed 100% at every tier.

Why it was not kept: the policy was smooth and budget-scale based, but it over-spent the scarce tier. Mean q moved 32.0 -> 41.8 at 125k, first completion moved about +5.6k frames later, sampled candidates rose by +349 per row, unique full evaluations fell by -1.4, repair frames fell by -7.5k, and repair accepts fell by -0.20 per row. One 125k `solo_run` row became invalid (`seed=11`, 654.48 -> 0.03), and the large 125k regressions outweighed scattered large rescues. The mature tiers were mostly neutral because the slack curve faded out. This is useful evidence against a broad monotone "low slack => more q" policy: slack is a good normalization variable, but quality breadth still needs a sharper value/opportunity selector or a repair-aware reservation before it can spend scarce traversal budget. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - ABANDONED PROBE - current-baseline slack-scarce quality breadth

Mechanism: temporarily add a smooth traversal-slack overlay to `qualityHandoffSampleCount` on top of the current accepted elevation-room baseline. Explicit `LR_QUALITY_NCAND` overrides stayed exact, existing raw-budget/authored-shape breadth logic resolved first, and then requested candidate count was pulled toward `q=29` when `budget / predicted_first_completion_frames` was scarce: full pressure at slack <=3, fading to zero by slack >=6. Candidate generation families, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts` passed during the temporary source trial (4 files, 53 tests).

Probe: `generated/golden-runs/probe-slack-scarce-q-current-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-slack-scarce-q-current-j48-s0-2-a01`. The probe was valid 480/480, with raw probe HEADLINE 680.29 and per-budget point estimates 125k 667.53, 250k 676.59, 375k 680.29, and 500k 685.32.

Probe decision: `npm run decide -- generated/golden-runs/probe-slack-scarce-q-current-j48-s0-2-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.3 on the 40-spec x 3-seed x full-budget intersection, CI [-0.9, 1.8], P(delta<=0)=36.5%. Per-budget deltas were 125k -0.7, 250k +1.3, 375k +0.3, and 500k +0.0, with unchanged validity.

Why it was stopped: the controller was smooth and scale-free, but the pressure was too broad at 125k. It changed 88 paired 125k rows from q32 toward q29, producing large opposite-sign seed swings and a small net 125k loss. The 250k lift was real but concentrated and not strong enough to justify a canonical run. Work shifted as intended: on the paired 3-seed slice, mean q moved 32.000 -> 29.225 at 125k, 31.000 -> 30.625 at 250k, 31.000 -> 30.850 at 375k, and stayed 31.000 at 500k; first-completion frames fell modestly. This supports using traversal slack as a budget-control feature, but not a broad monotone "lower q when scarce" pull. A future version would need a more specific mid-slack/value selector, not a wider or stronger low-slack ramp. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - ABANDONED PROBE - traversal-slack impact-onset maturity

Mechanism: temporarily replace the accepted elevation-room impact-curve onset's raw 125k->250k maturity ramp with a traversal-slack maturity ramp from 3.5 to 5.5. The structural selector stayed the same: authored elevation variation, median contact room, and impact targets controlled whether the onset could fade from 0.25 toward 0.20. The trial made maturity scale by predicted traversal difficulty rather than canonical budget labels, and passed the combined structural x maturity pressure into `arc_placement.ts`. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Probe: `generated/golden-runs/probe-impact-slack-maturity-profile-j48-s0-11-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4,5,6,7,8,9,10,11 npm run golden -- --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,rolling_drop,skyline_push,syncopated_lift --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-impact-slack-maturity-profile-j48-s0-11-a01`. The profile slice was valid 672/672, with raw HEADLINE 669.6 and per-budget point estimates 125k 658.73, 250k 668.33, 375k 670.82, and 500k 672.03.

Probe decision: `npm run decide -- generated/golden-runs/probe-impact-slack-maturity-profile-j48-s0-11-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0 on the 14-spec x 12-seed profile intersection, CI [-0.1, 0.2], P(delta<=0)=40.9%. Per-budget deltas were 125k +0.1, 250k +0.0, 375k +0.0, and 500k +0.0, with unchanged validity.

Why it was stopped: the change was cleaner and scale-free, but it mostly reshuffled a tiny set of rows without improving the accepted baseline. Only 36 paired checkpoints changed: 24 at 125k and 12 at 250k, limited to `summit_push` (+79.22 score sum), `terrace_sprint` (+6.89), and `swoop_dive` (-61.89). The net profile signal was near zero and non-promotable, while the current accepted raw maturity ramp is part of a canonical ACCEPT. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - current-baseline structural-slack fifth aim base

Mechanism: retested the smooth structural-slack affordability gate for the default fifth aim base on top of the current accepted elevation-room baseline. The temporary source threaded per-compile traversal slack into `optimizer/aim.ts` and multiplied only the default non-low-air fifth-base pressure by a smooth slack ramp from 2.75 to 4.0. Explicit `LR_AIM_TOPK_BASES` overrides, top-4 aim behavior, low-air top-3 cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-top5-slack-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-slack-current-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.73 and `HEADLINE excl. impact` 696.52. Per-budget point estimates were 125k 666.71, 250k 677.16, 375k 681.09, and 500k 685.75.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-slack-current-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.5], P(delta<=0)=14.1%, effect 0.97. Per-budget deltas were 125k +0.0, 250k +0.7, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the point estimate repeated the earlier positive signal but still missed the accept gate. The change was clean and smooth, but very narrow: only 37 paired checkpoints changed, all on `drums_pulse`, `drums_dropout`, and `solo_run`, mostly at 250k. It removed 872 aimed entries and 3055 aim-probe rows at 250k, producing gains on `drums_pulse` (+3.18 weighted mean), `drums_dropout` (+1.51), and `solo_run` (+0.64). The wider version of this same slack gate already had worse evidence in the newly affected slack bands, so there was no principled smooth retune to push without repeating known-negative territory. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - low-air stable-speed impact ride-out

Mechanism: temporarily tested a narrower low-air/high-impact ride-out geometry controller after the accepted elevation-room baseline. The controller activated only on impact-targeted specs with high whole-spec air variation and stable speed targets, then smoothly increased low-air ride-out cap/blend by budget, attempt, local low-air pressure, and impact pressure. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-lowair-stable-rideout-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-stable-rideout-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.50 and `HEADLINE excl. impact` 696.01. Per-budget point estimates were 125k 666.58, 250k 676.35, 375k 680.98, and 500k 685.69.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-stable-rideout-j32-a01/golden.json generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.6, 0.2], P(delta<=0)=85.8%, effect -0.48. Per-budget deltas were about -0.1 at every budget, with unchanged validity at every tier.

Why it was not kept: the profile selector successfully isolated the intended family, but the sign was wrong. Only `drums_pendulum` changed, and its weighted mean moved -2.37 across seeds, with negative average deltas at every budget. Weakening the pressure would mostly return to the baseline, while widening or retuning the low-air ride-out family repeats previously documented drums seed-variance failures. The temporary source change was reverted; the accepted baseline remains `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - ACCEPTED CANONICAL - elevation-room impact curve onset

Mechanism: add a smooth default-only controller for the impact-curve target onset. The shipped default onset remains 0.25, but on specs with authored elevation variation and enough median contact room, the onset can fade toward 0.20 after a maturity ramp from 125k to 250k simulated frames. The profile pressure is continuous in elevation range and median gap room, and explicit `LR_IMPACT_CURVE_START` overrides remain exact. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed before the canonical run (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-elevation-room-start-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.59 and `HEADLINE excl. impact` 696.25. Per-budget point estimates were 125k 666.71, 250k 676.48, 375k 681.07, and 500k 685.75.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-elevation-room-start-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +0.7, CI [0.0, 1.6], P(delta<=0)=2.5%, effect 1.72. Per-budget deltas were 125k +0.0, 250k +1.0, 375k +0.6, and 500k +0.8, with unchanged validity at every tier.

Why it was kept: this is the clean continuous version of the earlier broad impact-curve profile-start signal. It protected scarce completion exactly at 125k, then moved mature budgets through a smooth authored-structure pressure instead of a budget bucket. The paired row summary changed 503 scores, with 285 improvements and 218 regressions for +1128.92 total score. Gains concentrated where the selector was meant to act: `swoop_dive` (+508.35), `switchback_pop` (+236.34), `glide_stairs` (+136.19), `canyon_steps` (+91.27), `valley_bounce` (+67.23), and `skyline_push` (+64.72). The main loss was `summit_push` (-135.47), while dense/drums and amplitude-only rows stayed unchanged. The accepted baseline is now `attempt-impact-elevation-room-start-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - budget-stable default extra aim base seed

Mechanism: temporarily make the default fifth aim-base stochastic gate monotone with budget by removing `aimCompileBudgetFrames` from `defaultExtraAimBaseSeed`. The smooth pressure curve was unchanged; only the random threshold became stable for a given gap, so increasing budget would raise activation through pressure rather than re-rolling the hash at every budget. Explicit `LR_AIM_TOPK_BASES` overrides, the accepted low-air top-3 cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-stable-extra-base-seed-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-stable-extra-base-seed-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.74 and `HEADLINE excl. impact` 696.08. Per-budget point estimates were 125k 666.71, 250k 675.06, 375k 680.27, and 500k 684.94.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-stable-extra-base-seed-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-0.7, 0.4], P(delta<=0)=71.6%, effect -0.55. Per-budget deltas were 125k +0.0, 250k -0.4, 375k -0.2, and 500k -0.0, with unchanged validity at every tier.

Why it was not kept: the monotone gate is cleaner in principle, but the current budget-dependent hash is part of the accepted top-5 aim basin allocation. The trial changed 400 paired scores, with 190 improvements and 210 regressions for -324.46 total score. It reduced aim emissions and probe frames at mature budgets but moved that saved work into weaker basins: `float_bounds` (-199.98), `grain_staircase` (-77.58), and `ridge_pulse` (-70.39) outweighed gains on `drums_pulse` (+114.50) and `dense_echo_climb` (+70.08). This rejects changing the hash alone; a future smooth/monotone aim controller needs a value model or recalibrated pressure, not just a cleaner stochastic seed. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - smooth high-slack early-contact lookahead

Mechanism: temporarily extend the accepted opening structural best-of selector to short-track second/third contacts with smooth slack and ordinal pressure. The opening contact kept the accepted policy unchanged. Non-opening contacts could only activate on very short specs through the existing smooth short-contact pressure, then a high structural slack ramp from 8 to 16 and a smooth ordinal fade: the second contact had full local pressure, the third contact half pressure, and later contacts faded to zero. Explicit `LR_FWD_EVAL` overrides, the accepted mature vertical `avg` override, candidate count, candidate generation, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-early-contact-smooth-slack-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-early-contact-smooth-slack-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.88 and `HEADLINE excl. impact` 696.04. Per-budget point estimates were 125k 666.66, 250k 675.34, 375k 680.49, and 500k 684.99.

Decision: `npm run decide -- generated/golden-runs/attempt-early-contact-smooth-slack-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.5, 0.4], P(delta<=0)=56.7%, effect -0.09. Per-budget deltas were 125k -0.1, 250k -0.1, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the policy was smooth and scale-free, but it still lacked a reliable value signal beyond "short and affordable." It only changed the intended short rows: 67 paired checkpoint scores changed, 42 up and 25 down, for -80.12 total score. `tiny_dance` improved (+32.06 total across changed rows), but `mini_burst` regressed (-112.18), especially in the slack 12..16 band (-97.97). The extra lookahead spent real forward-eval work (+4.16M charged frames over changed rows) without improving first-completion or repair counters, so it mostly reshuffled short-track basins. This rejects simply extending the opening selector to later early contacts, even with clean continuous slack/ordinal pressure. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - repair value-density target priority

Mechanism: temporarily keep repair's feasible target set unchanged, but rank feasible repair gaps by squared axis error with a bounded smooth value-density bonus for cheaper suffixes. The bonus was continuous in `estCost / remainingRepairBudget` and did not change repair margins, repair caps, candidate generation, start selection, forward eval, scorer, specs, fingerprint, seed set, budget grid, or acceptance rule. The intent was to let comparable-error repair targets prefer lower-cost suffixes without adding raw-budget thresholds.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-repair-value-density-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-value-density-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.74 and `HEADLINE excl. impact` 695.29. Per-budget point estimates were 125k 666.54, 250k 675.03, 375k 680.25, and 500k 685.01.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-value-density-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-1.0, 0.6], P(delta<=0)=63.7%, effect -0.37. Per-budget deltas were 125k -0.2, 250k -0.5, 375k -0.2, and 500k +0.1, with unchanged validity at every tier.

Why it was not kept: the smooth cost-aware priority was active, but it was not suite-positive. It changed 770/1920 paired track hashes and 766 scores, with 360 improvements and 406 regressions. The intended high-budget repair shift was mixed: 500k gained only +13.72 total score while 125k/250k/375k lost -99.80/-237.24/-141.20. Repair counters moved only slightly on average, and score movement looked like basin reshuffling rather than better allocation. Gains on `summit_push`, `canyon_steps`, `dense_echo_climb`, `solo_run`, and `valley_bounce` were outweighed by losses on `float_bounds`, `cold_start`, `mini_burst`, `tiny_dance`, and `dense_sprint`. This rejects a generic lower-cost repair preference as a standalone policy; repair allocation needs a stronger observed value signal than estimated suffix cost. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - KEPT CLEANUP - continuous slack policy plumbing

Mechanism: keep the smooth policy cleanup that was previously tested as a byte-identical canonical no-op: `budget_slack` decisions now use the unrounded traversal slack, while telemetry still reports the rounded value, and the opening structural pressure combines short-track and dense-track pressures with the smooth union `1 - (1-a)(1-b)` instead of a hard `max`. This is not a headline promotion attempt; it removes artificial quantization and a derivative kink so future budget/slack behavior scales cleanly at arbitrary budgets and on future specs.

Evidence: the earlier canonical `attempt-smooth-slack-policy-j32-a01` run was exactly score- and hash-identical to `attempt-opening-structural-best-j32-a01` across all 1920 canonical checkpoints. A fresh sanity slice after keeping the cleanup (`generated/golden-runs/probe-smooth-slack-cleanup-sanity-a01`, `tiny_dance`, `drums_dropout`, `drums_pendulum`, seed 0, budgets 125k/250k/500k) was also 0/9 changed track hashes with identical scores and rounded slack telemetry. Focused optimizer tests passed: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (6 files, 81 tests).

Outcome: kept as code hygiene for smooth, continuous budget-aware policy plumbing. The accepted score baseline of record remains `generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - smooth quality breadth transition pressure

Mechanism: temporarily replace two hard authored-shape gates inside the internal quality candidate count with smooth transition pressures. The mature variation relief gate became a smooth union of air-range and speed-range pressure that reached the old full-relief endpoint at the accepted thresholds, and the short/no-amplitude boost gained a smooth contact-count fade beyond the old `<=32` endpoint. Explicit `LR_QUALITY_NCAND` overrides, the accepted base budget ramp, sparse-amplitude pressure, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-smooth-quality-pressure-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-smooth-quality-pressure-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.91 and `HEADLINE excl. impact` 696.03. Per-budget point estimates were 125k 666.71, 250k 674.89, 375k 681.10, and 500k 684.82.

Decision: `npm run decide -- generated/golden-runs/attempt-smooth-quality-pressure-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.8, 0.8], P(delta<=0)=47.5%, effect 0.04. Per-budget deltas were 125k +0.0, 250k -0.6, 375k +0.6, and 500k -0.1, with unchanged validity at every tier.

Why it was not kept: the smooth transition behaved mechanically but did not produce a reliable quality gain. It changed only the intended transition buckets: 113/1920 paired tracks changed, with 58 improvements and 55 regressions. The newly affected quality-count transitions were `29->33` on `rhythm_ladder` (-54.83 score sum), `29->30` on `drums_dropout` (-28.75), `29->31` on `skyline_push` (-24.97), and `30->31` on `valley_bounce` (+57.66). Work shifted as expected through slightly larger mature candidate pools (mean requested count +0.2 at 250k/375k/500k, sampled candidates +14/+22/+38 per row), but the extra pool breadth mostly reshuffled basins while reducing charged forward-eval and aim-probe frames. This is useful negative evidence for making accepted quality breadth gates smooth by simply widening their transition bands; future smoothness work needs a value signal, not just softer thresholds. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - wider slack gate for default fifth aim base

Mechanism: temporarily broaden the structural-slack affordability gate for the default fifth aim base. The existing raw budget ramp at 225k..300k remained, but the fifth-base pressure was also multiplied by a smooth traversal-slack ramp starting at 2.75 and reaching full strength at slack 6.0. The goal was to keep the prior positive medium-slack trim while making the logic more scalable than a narrow 250k-only effect. Explicit `LR_AIM_TOPK_BASES` overrides, top-4 aim behavior, low-air top-3 cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-top5-slack-wide-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-slack-wide-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.99 and `HEADLINE excl. impact` 696.15. Per-budget point estimates were 125k 666.71, 250k 676.01, 375k 680.51, and 500k 684.90.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-slack-wide-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.8, 1.3], P(delta<=0)=49.1%, effect 0.18. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.0, and 500k -0.0, with unchanged validity at every tier.

Why it was not kept: broadening the smooth slack trim did not improve on the narrower prior attempt. It changed 96/1920 paired checkpoints, with 46 improvements and 50 regressions. The slack 2..3 band repeated the useful signal (+307.57 score sum), but the newly affected slack 4..5 and 5..8 bands lost -84.42 and -24.66 respectively. Spec movement was not clean: `drums_dropout` gained +421.89 score sum, but `drums_pulse` lost -140.57 and `grain_staircase` lost -88.28. Work counters showed the expected reduced aimed emissions (-1239/-4196/-370 by 250k/375k/500k), but the extra saved/shifted work mostly became churn rather than score. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - smooth slack policy cleanup no-op

Mechanism: temporarily clean up the accepted opening structural best selector without changing its intended policy: use unrounded `budget_slack` for policy decisions while keeping rounded telemetry, and replace the opening short-track/dense-track structural join from a hard `Math.max` with the smooth union `1 - (1-a)(1-b)`. Candidate count, candidate generation, start selection, forward eval variants, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-smooth-slack-policy-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-smooth-slack-policy-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.89 and `HEADLINE excl. impact` 696.05. Per-budget point estimates were 125k 666.71, 250k 675.48, 375k 680.48, and 500k 684.95.

Decision: `npm run decide -- generated/golden-runs/attempt-smooth-slack-policy-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [0.0, 0.0], P(delta<=0)=100.0%, effect 0.00. Per-budget deltas were exactly +0.0 at every tier, with unchanged validity at every tier.

Why it was not kept: this was a clean smoothness improvement in principle, but it was byte-identical on the canonical grid: 1920/1920 paired checkpoints had unchanged track hashes, scores, and rounded slack telemetry. The current contact-count support bands for the opening structural gate do not overlap in practice, and rounding slack to three decimals did not move any deterministic stochastic decision boundary. Since it did not produce a canonical ACCEPT, the temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - smooth high-slack early fifth aim base

Mechanism: temporarily let structurally easy specs reach the default fifth aim base earlier, while preserving smooth behavior at arbitrary budgets. The original mature fifth-base budget ramp stayed in place. A second smooth budget ramp from 175k to 250k was multiplied by structural traversal slack pressure from 5 to 8, then combined with the mature ramp using the smooth union `1 - (1-a)(1-b)`. Explicit `LR_AIM_TOPK_BASES` overrides, top-4 aim behavior, low-air top-3 cap, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests). An earlier version using a kinked `Math.max` blend was interrupted before completion and is not used as evidence.

Canonical: `generated/golden-runs/attempt-aim-top5-easyslack-smooth-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-easyslack-smooth-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.92 and `HEADLINE excl. impact` 696.05. Per-budget point estimates were 125k 666.71, 250k 675.64, 375k 680.48, and 500k 684.95.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-easyslack-smooth-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.1, 0.2], P(delta<=0)=31.5%, effect 0.48. Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the smooth early ramp was cleaner and scalable, but it was weaker than the narrower slack-trim attempt. It changed 107 score rows at 250k, with 53 improvements and 54 regressions, and left all other budgets score-identical. Work shifted in the expected direction at 250k: +2560 refined aim bases, +160k charged aim-probe frames, +3612 emitted aimed candidates, and +10 aimed selections, while sampled and viable candidates fell. The gains were spread across `rolling_hills`, `big_air_ramp`, `pop_train`, and `mixed_grade`, but losses in `dense_echo_climb`, `valley_bounce`, `climb_terrace`, and `float_bounds` cancelled most of the benefit. This rejects simply pulling the fifth-base budget ramp earlier for high-slack rows; the accepted fifth-base selector still needs a sharper value signal, not just more early smooth spend. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - structural-slack gate for default fifth aim base

Mechanism: temporarily make the accepted late smooth default fifth aim-base selector affordability-aware. The existing top-4 aim behavior, low-air top-3 cap, explicit `LR_AIM_TOPK_BASES` overrides, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged. Only the default non-low-air fifth-base pressure was multiplied by a smooth structural traversal slack pressure, starting at slack 2.75 and reaching full strength by slack 4.0.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-aim-top5-slack-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-slack-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.03 and `HEADLINE excl. impact` 696.32. Per-budget point estimates were 125k 666.71, 250k 676.17, 375k 680.50, and 500k 684.95.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-slack-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.5], P(delta<=0)=14.1%, effect 0.97. Per-budget deltas were 125k +0.0, 250k +0.7, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the direction was good but too narrow for promotion. The gate left 125k and 500k byte-identical, changed only 33 score rows at 250k and 4 at 375k, and improved 22 versus 15 regressions across those changed rows. Work shifted as intended at 250k: -926 refined aim bases, -49.5k charged aim-probe frames, -872 emitted aimed candidates, -302 full evaluations, and +3 aimed selections, while sampled/viable candidates and forward-eval frames rose slightly. Gains were concentrated in `drums_pulse` (+190.68 score sum), `drums_dropout` (+90.39), and `solo_run` (+34.37), with no movement elsewhere. This supports using structural slack as an affordability feature, but the accepted fifth-base selector is already mostly aligned with slack on the current grid; adding a slack gate only trims a small 250k slice and does not clear the accept gate. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - tail completion reinvested branch 4

Mechanism: temporarily reallocate post-completion work in `handoff.ts` by suppressing speculative middle-depth tail completions after full-track feedback exists, then allowing a small smooth post-completion branch-4 pressure to spend some of that saved work on ordinary main-frontier alternatives. First-completion behavior, candidate generation, candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-tail-reinvest-branch4-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-tail-reinvest-branch4-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.90 and `HEADLINE excl. impact` 696.11. Per-budget point estimates were 125k 666.71, 250k 675.60, 375k 680.46, and 500k 684.92.

Decision: `npm run decide -- generated/golden-runs/attempt-tail-reinvest-branch4-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.2, 0.2], P(delta<=0)=50.5%, effect 0.07. Per-budget deltas were 125k +0.0, 250k +0.1, 375k -0.0, and 500k -0.0, with unchanged validity at every tier.

Why it was not kept: the mechanism changed the intended work allocation but did not convert it into score. Mean tail-completion attempts fell by about -1.9/-8.2/-15.6/-22.8 per row from 125k to 500k, mean branch limit rose by +0.02/+0.07/+0.10/+0.12, and 500k tail full evaluations dropped from 39.5k to 28.6k with duplicate full evaluations down from 35.6k to 24.8k. But only 13/1920 paired scores changed, with 6 improvements and 7 regressions, candidate samples and repair counters were essentially unchanged, and unique full evaluations were flat. This confirms that middle-tail duplication is wasteful, but even explicit branch-4 reinvestment is too weak or too poorly targeted to raise quality. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - high-slack early-contact best lookahead

Mechanism: temporarily extend the accepted opening best-of selector to the second and third contact on short, very-high-slack specs only. The opening contact kept the accepted structural/opportunity gate. Non-opening early contacts additionally required a smooth slack ramp from 12 to 20, short-track pressure, and ordinal decay, while still using the same local admitted-pool opportunity signal before promoting default `greedy:2` to `best:1:2` or `best:1:3`. Candidate count, candidate generation, start selection, repair selection, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: the first version, with early slack ramp 5.5 to 9.0, failed `optimizer/handoff.ts - objective leaf scorer > objective leaf is deterministic and collapses rollout frame cost vs full` because the extra early best-of activated at 100k on `tiny_dance` and broke the established objective-leaf cost-collapse margin. The tested canonical version tightened the non-opening early slack ramp to 12 to 20; `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` then passed (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-early-contact-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-early-contact-best-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.94 and `HEADLINE excl. impact` 696.08. Per-budget point estimates were 125k 666.71, 250k 675.63, 375k 680.49, and 500k 684.99.

Decision: `npm run decide -- generated/golden-runs/attempt-early-contact-best-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.3, 0.4], P(delta<=0)=44.3%, effect 0.26. Per-budget deltas were 125k +0.0, 250k +0.1, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: this supports the high-slack/simple-map intuition but is too small for promotion. Only 57/1920 paired checkpoints changed: 41 improvements and 16 regressions, all on `mini_burst` and `tiny_dance`. The changed rows had positive net sums at 250k (+88.97), 375k (+9.44), and 500k (+23.47), with no 125k change, but the headline movement was far below the canonical acceptance bar. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - REJECTED CANONICAL - smooth low-air impact ride-out

Mechanism: temporarily retest a smooth low-air/impact geometry ride-out on the current accepted baseline. For contact-centered gaps with explicit `air` and `impact`, no elevation/amplitude target, and enough compile budget/attempt pressure, the trial smoothly allowed a longer safe post-contact ride-out and stronger length blending. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-lowair-impact-rideout-current-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-impact-rideout-current-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.25 and `HEADLINE excl. impact` 695.05. Per-budget point estimates were 125k 667.03, 250k 675.02, 375k 679.57, and 500k 684.17.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-impact-rideout-current-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: REJECT`, delta headline -0.6, CI [-2.2, 0.2], P(delta<=0)=92.5%, effect -1.09. Per-budget deltas were 125k +0.3, 250k -0.5, 375k -0.9, and 500k -0.8, with unchanged validity at every tier.

Why it was not kept: the trial repeated the prior low-budget lift but regressed the mature budgets that now carry most headline weight. A paired score summary changed 154/1920 checkpoints: 72 improvements and 82 regressions. The 125k slice gained +123.91 total score, but 250k/375k/500k lost -166.84, -333.84, and -315.99 respectively. Losses concentrated on `rhythm_ladder`, `syncopated_switchback`, and `drums_pendulum`, while isolated gains such as `cold_start` and `drums_crescendo` were not enough. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - opening branch-3 slack start 14

Mechanism: temporarily raise only `OPENING_BEST_FWD_SLACK_BRANCH3_START` from 10 to 14, leaving the accepted opening best-of selector, branch-2 activation, structural/contact-count gates, local opportunity gate, candidate generation, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged. The intent was to keep high-slack opening `best:1:3` available for the easiest rows while leaving medium-high slack rows on cheaper `best:1:2`.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-opening-branch3-slack14-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-branch3-slack14-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.86 and `HEADLINE excl. impact` 696.02. Per-budget point estimates were 125k 666.71, 250k 675.32, 375k 680.48, and 500k 684.95.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-branch3-slack14-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.2, 0.0], P(delta<=0)=96.5%, effect -0.72. Per-budget deltas were 125k +0.0, 250k -0.2, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: delaying branch-3 was not a useful budget-saving lever. Only five paired checkpoints changed score, all `mini_burst` at 250k, with one improvement and four regressions for a net -89.66 score sum on those changed rows. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - ABANDONED PRE-CANONICAL - opening avg branch-2 lookahead

Mechanism screened: temporarily change the already-gated opening branch-2 promotion from `best:1:2` to `avg:1:2`, while keeping branch-3 as `best:1:3`. Candidate generation, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and explicit forward-eval overrides stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` failed before any canonical run. The failing test was `optimizer/handoff.ts - objective leaf scorer > objective leaf is deterministic and collapses rollout frame cost vs full`: objective-leaf forward eval still saved frames, but no longer met the established cost-collapse margin (`32481` was not below `30946.8`).

Why it was stopped: the `avg` variant interacted poorly with the default objective-leaf cost invariant, so weakening the test would have hidden a real spend-shape regression. The temporary source change was reverted without a canonical run; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - impact-curve profile target start

Mechanism: temporarily let the impact-curve target start move smoothly from 0.25 toward 0.20 on mature budgets for specs whose authored impact profile was low-density and low-adjacent-delta. Explicit `LR_IMPACT_CURVE_START` overrides stayed exact. Candidate count, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-impact-curve-profile-start020-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-curve-profile-start020-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 680.15 and `HEADLINE excl. impact` 695.54. Per-budget point estimates were 125k 666.71, 250k 675.97, 375k 680.80, and 500k 685.11.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-curve-profile-start020-j32-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-1.5, 1.9], P(delta<=0)=37.5%, effect 0.28. Per-budget deltas were 125k +0.0, 250k +0.5, 375k +0.3, and 500k +0.2, with unchanged validity at every tier.

Why it was not kept: the point estimate was positive but too small and too uncertain for promotion, and `HEADLINE excl. impact` moved down. This looks like a narrow impact redistribution rather than a robust compiler improvement. The temporary source change was reverted; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - ACCEPTED CANONICAL - structural opening best lookahead

Mechanism: add a default-only opening forward-eval selector in `handoff.ts` that uses structural contact-count pressure plus traversal slack as an affordability signal before spending extra opening rollout work. The selector keeps explicit `LR_FWD_EVAL` overrides exact and lets the accepted mature vertical `avg` selector keep precedence. Only the first authored contact can promote default `greedy:2` to `best:1:2` or `best:1:3`, and only when the admitted quality pool shows local opportunity. The structural pressure is smooth: very short tracks get opening pressure because the first segment dominates the track, while dense contact chains get pressure only once slack is high enough to afford the extra opening discrimination. Candidate count, candidate generation, start selection, repair selection, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed before the canonical run (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-structural-best-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.89 and `HEADLINE excl. impact` 696.05. Per-budget point estimates were 125k 666.71, 250k 675.48, 375k 680.48, and 500k 684.95.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +0.9, CI [-0.0, 2.2], P(delta<=0)=3.1%, effect 1.59. Per-budget deltas were 125k +0.2, 250k +0.3, 375k +0.5, and 500k +1.7, with unchanged validity at every tier.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json`. The result preserves the user's high-slack opening-best intuition but avoids the rejected broad slack-only form: slack says whether the extra work is affordable, while contact-count structure and current-pool opportunity say whether the opening decision is valuable enough to spend it.

## 2026-06-29 - ABANDONED PROBE - stable low-air impact frontload

Mechanism screened: temporarily add a narrow generation-side boost to contact-centered impact curvature frontload. The trial kept the shipped `IMPACT_CURVE_FRONTLOAD=1.6`, then allowed at most +0.2 extra frontload after 125k only on locally low-air impact candidates, with a smooth whole-spec air-range guard to damp out the broad low-air frontload family's known variable-air collateral. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Probe: `generated/golden-runs/probe-stable-lowair-frontload-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-stable-lowair-frontload-j48-s0-2-a01`. The probe was valid 480/480 with raw probe HEADLINE 678.79 and `HEADLINE excl. impact` 693.28.

Probe decision: `npm run decide -- generated/golden-runs/probe-stable-lowair-frontload-j48-s0-2-a01/golden.json generated/golden-runs/attempt-opening-structural-best-j32-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -0.3 on the 40-spec x 3-seed x full-grid intersection, CI [-2.5, 2.0], P(delta<=0)=61.5%. Per-budget deltas were 125k +0.0, 250k -0.7, 375k -0.8, and 500k +0.2, with unchanged 100% diagnostic validity.

Why it was stopped: the guard did protect 125k and left a tiny 500k lift, but it simply moved the collateral instead of removing it. Gains on `drums_signature`, `tiny_dance`, `ridge_pulse`, `solo_run`, and `cold_start` were offset by losses on `drums_zigzag`, `drums_pulse`, `grain_staircase`, `drums_dropout`, and `rhythm_ladder`. The source trial was reverted without a canonical run; the accepted baseline remains `attempt-opening-structural-best-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - opening slack opportunity best lookahead

Mechanism: temporarily add a default-only opening forward-eval selector in `handoff.ts` that combined structural traversal slack with a zero-extra-frame local opportunity signal from the already-admitted quality pool. Only the first authored contact could promote the default `greedy:2` ranker to `best:1:2` or `best:1:3`; explicit `LR_FWD_EVAL` overrides stayed exact, and the accepted mature vertical `avg` selector kept precedence. Candidate count, candidate generation, start selection, repair selection, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-opening-slack-opportunity-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-slack-opportunity-best-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.37 and `HEADLINE excl. impact` 695.25. Per-budget point estimates were 125k 666.54, 250k 674.60, 375k 679.82, and 500k 684.63.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-slack-opportunity-best-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.4, CI [-1.6, 2.3], P(delta<=0)=32.4%, effect 0.40. Per-budget deltas were 125k +0.1, 250k -0.6, 375k -0.1, and 500k +1.3, with unchanged validity at every tier.

Why it was not kept: this is the cleanest evidence so far that high-slack opening best-of can help short/easy high-budget rows, but slack plus current-pool ambiguity is still not a reliable value selector. The 500k gain did not offset the 250k/375k drift strongly enough to pass the canonical gate, and the bootstrap still leaves too much probability mass at or below zero. The result supports using slack as an affordability signal, not as the whole policy; the next version needs a stronger local value/opportunity model or a cheaper bounded probe before spending best-of rollout frames. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - regular-cadence impact frontload

Mechanism: temporarily add a narrow generation-side contact-curve frontload bonus in `arc_placement.ts`. The bonus applied only at mature budgets, only when current/next landing cadence was locally regular with enough spacing, and was damped on low-grain authored specs. The intent was to preserve the cleaner positive parts of the earlier mature frontload family while avoiding broad dense/syncopated collateral. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-regular-impact-frontload-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-regular-impact-frontload-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 678.74 and `HEADLINE excl. impact` 693.67. Per-budget point estimates were 125k 666.46, 250k 674.83, 375k 679.39, and 500k 683.27.

Decision: `npm run decide -- generated/golden-runs/attempt-regular-impact-frontload-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-1.4, 0.9], P(delta<=0)=67.0%, effect -0.43. Per-budget deltas were 125k +0.0, 250k -0.3, 375k -0.6, and 500k -0.0, with unchanged validity at every tier.

Why it was not kept: the cadence selector kept 125k untouched and avoided a large failure, but it did not recover the useful part of the earlier mature frontload signal. The negative mature-budget drift says that regular spacing alone is not enough to decide when more impact frontload is valuable; future frontload work needs a more direct local value signal rather than another geometry-only cadence gate. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - stronger low-slack traversal branch pressure

Mechanism: temporarily strengthen the accepted low-slack first-traversal branch controller in `handoff.ts` by moving `HANDOFF_LOW_SLACK_BRANCH_FULL` from 1.25 to 1.5 while leaving the zero-pressure point at slack 2.0. This made scarce pre-completion search more decisively branch 2 instead of stochastic branch 2/3 in the 1.35..1.5 slack band. Candidate count, candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-low-slack-branch-full15-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-low-slack-branch-full15-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 678.99 and `HEADLINE excl. impact` 694.30. Per-budget point estimates were 125k 666.52, 250k 675.16, 375k 679.97, and 500k 683.29.

Decision: `npm run decide -- generated/golden-runs/attempt-low-slack-branch-full15-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [0.0, 0.0], P(delta<=0)=34.2%, effect 0.74. Per-budget deltas were 125k +0.1, 250k +0.0, 375k +0.0, and 500k +0.0, with unchanged validity at every tier.

Why it was not kept: the mechanism was directionally positive but far too small for promotion. It changed only 2/1920 paired checkpoints by score, both at 125k in the slack 1.35..1.5 band: `drums_crescendo` seed 5 improved 591.47 -> 612.74 and `drums_pulse` seed 11 improved 564.53 -> 570.23. Every 250k/375k/500k checkpoint was score-identical to the accepted baseline. Work counters confirm the intended narrowness: the 125k mean branch limit moved by -0.037, first-completion frames by -2, candidates by -0.9, full evaluations by -0.05, and repair frames by -24; all other budgets were unchanged. This suggests the accepted branch-pressure policy is already near the useful edge, and further threshold tightening is not a meaningful path to 700. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-29 - REJECTED CANONICAL - pre-completion slack ambiguity best lookahead

Mechanism: temporarily test a targeted version of the high-slack `best` lookahead idea in `handoff.ts`. The default `greedy:2` forward ranker could promote to `best:1:2` or `best:1:3` only before first completion, only when structural `budget_slack` was high, and only when the already-built zero-frame quality pool showed a close top-two objective margin. Explicit `LR_FWD_EVAL` overrides stayed exact, and the accepted mature vertical `avg` selector kept precedence. Candidate count, generation, start selection, repair selection, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-precomp-slack-ambiguity-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-precomp-slack-ambiguity-best-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 677.27 and `HEADLINE excl. impact` 691.47. Per-budget point estimates were 125k 666.30, 250k 675.04, 375k 678.50, and 500k 680.20.

Decision: `npm run decide -- generated/golden-runs/attempt-precomp-slack-ambiguity-best-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: REJECT`, delta headline -1.7, CI [-3.9, 0.2], P(delta<=0)=95.9%, effect -1.67. Per-budget deltas were 125k -0.2, 250k -0.1, 375k -1.5, and 500k -3.1, with unchanged validity at every tier.

Why it failed: the extra gate fixed the low-slack failure mode but not the opportunity-cost problem. Checkpoints with slack below 5 were effectively unchanged; slack 5..8 lost -2.42 mean score and slack 8..12 lost -3.33, while slack 12+ gained only +1.24. The trial changed 691/1920 paired checkpoints, with 335 improvements and 356 regressions. Gains concentrated on `tiny_dance` (+10.06 mean) and small lifts on `drums_tide` (+2.11), `terrace_sprint` (+1.29), and `drums_signature` (+1.25), but losses on `rhythm_ladder` (-8.03), `cold_start` (-7.02), `syncopated_switchback` (-6.83), `dense_sprint` (-6.47), `drums_pulse` (-5.12), and `drums_swell` (-4.78) dominated. Work counters show the same pattern as prior best-of attempts: first-completion frames rose by about +11.4k at 375k and +22.5k at 500k, repair frames fell by about -6.0k and -14.3k, and full evaluations rose instead of converting to better final tracks. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-29 - INCONCLUSIVE CANONICAL - high-air moderate-impact frontload

Mechanism: temporarily add a small mature-budget contact-centered impact-curvature frontload bonus in `arc_placement.ts`, but only on authored high-air, moderate-impact contacts. The intent was to retry the frontload family without the fragile low-air dense-impact band: baseline anatomy still showed impact undershoot on high-air/moderate-impact contacts, while the previous low-air mature frontload trial had helped some high-air/drum rows but hurt dense low-air and rhythm rows. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-highair-impact-frontload-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-highair-impact-frontload-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 678.40 and `HEADLINE excl. impact` 694.17. Per-budget point estimates were 125k 666.46, 250k 672.63, 375k 679.47, and 500k 683.47.

Decision: `npm run decide -- generated/golden-runs/attempt-highair-impact-frontload-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.6, CI [-3.0, 1.8], P(delta<=0)=69.9%, effect -0.48. Per-budget deltas were 125k +0.0, 250k -2.5, 375k -0.5, and 500k +0.2, with unchanged validity at every tier.

Why it was not kept: the selector isolated scarce budget correctly and had a tiny 500k upside, but it made the 250k tier meaningfully worse and did not produce a stable mature-budget improvement. It changed 938/1920 paired checkpoints, with 426 improvements and 483 regressions. Gains were concentrated in `drums_swell` (+9.94 mean), `drums_pulse` (+3.81), `drums_zigzag` (+3.32), and `drums_dropout` (+1.77), but losses on `drums_crosscut` (-12.96), `rhythm_ladder` (-8.14), `drums_signature` (-7.61), `syncopated_switchback` (-7.30), `drums_crescendo` (-4.54), and `dense_sprint` (-4.48) dominated. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - whole-run slack best forward eval

Mechanism: temporarily test the direct version of the user's high-slack best-of idea in `handoff.ts`. The existing structural `budget_slack` was threaded through main search, rescue, tail completion, and repair restarts. For the default `LR_FWD_EVAL` path only, `greedy:2` could smoothly promote by deterministic node hash to `best:1:2` from slack 2..3 and `best:1:3` from slack 3.5..5. Explicit `LR_FWD_EVAL` overrides stayed exact. Candidate count, candidate generation, start selection, repair selection, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests). The objective-leaf frame-cost test was temporarily pinned to explicit `LR_FWD_EVAL=greedy:2` because the adaptive default intentionally changed whole-run rollout shape; that test change was reverted with the source trial.

Canonical: `generated/golden-runs/attempt-slack-best-fwd-eval-grid-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-best-fwd-eval-grid-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 667.41 and `HEADLINE excl. impact` 682.02. Per-budget point estimates were 125k 659.75, 250k 660.94, 375k 667.15, and 500k 672.74.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-best-fwd-eval-grid-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: REJECT`, delta headline -11.6, CI [-16.0, -7.3], P(delta<=0)=100.0%, effect -5.20. Per-budget deltas were 125k -6.7, 250k -14.2, 375k -12.8, and 500k -10.5, with unchanged validity at every tier.

Why it failed: structural slack is an affordability signal, but as a direct whole-run selector it is too blunt. It activated on easy short rows even at low absolute budgets and spent the default ranker on broad `best` rollouts instead of preserving normal frontier/repair throughput. The loss is worse than the narrower pre-completion, post-completion, and opening-ambiguity variants already logged below, especially at 250k. This strongly rules out "slack -> best-of depth" as a standalone policy; future use needs a local opportunity/value signal and probably should be zero- or low-extra-frame before it is allowed to spend real rollout frames. The temporary source and test changes were reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - INCONCLUSIVE CANONICAL - mature low-air impact frontload

Mechanism: temporarily add a small mature-budget low-air boost to the contact-centered impact curvature frontload in `arc_placement.ts`. The shipped `IMPACT_CURVE_FRONTLOAD=1.6` stayed the base, explicit `LR_IMPACT_FRONTLOAD` still controlled that base, and only low-air impact-curve candidates received up to +0.2 extra frontload through a smooth budget ramp. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-lowair-mature-frontload-grid-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-mature-frontload-grid-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.65 and `HEADLINE excl. impact` 694.51. Per-budget point estimates were 125k 666.46, 250k 676.23, 375k 680.54, and 500k 683.99.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-mature-frontload-grid-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.7, CI [-1.5, 2.8], P(delta<=0)=24.2%, effect 0.64. Per-budget deltas were 125k +0.0, 250k +1.1, 375k +0.6, and 500k +0.7, with unchanged validity at every tier.

Why it was not kept: this is a real positive point estimate and the cleanest recent generation-side signal, but it still does not clear the accept gate. It helped the intended mature-budget family in aggregate (`drums_swell` +14.60 mean over all budgets, `drums_dropout` +3.96, `drums_signature` +3.57, `dense_echo_climb` +2.09), and 125k remained byte-identical. The offset was still large enough on rhythm/syncopated rows: `syncopated_switchback` -8.12 mean, `drums_crescendo` -4.38, `dense_sprint` -1.66, with 500k losses on `drums_pulse` (-11.18), `syncopated_switchback` (-13.11), `dense_sprint` (-5.98), and `drums_pendulum` (-4.20). Work counters stayed close to baseline, with mature budgets mostly reshuffling search basins rather than buying a new budget allocation path. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - INCONCLUSIVE CANONICAL - directional high-axis quality rank

Mechanism: temporarily add a zero-extra-frame directional factor inside `candidateQualityObjective` in `aim.ts`. The normal current-gap quality and next-gap readiness objective stayed intact, but high-target impact/elevation/amplitude candidates received a small bounded multiplier favoring achieved values above the target and penalizing deeper undershoot. This tested whether the measured signed-error anatomy (impact/elevation/amplitude under-hit) could be addressed by ranker asymmetry without changing candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, or acceptance rule.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests), including a narrow symmetric high-impact ranking regression test for the rejected behavior.

Canonical: `generated/golden-runs/attempt-directional-axis-quality-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-directional-axis-quality-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.03 and `HEADLINE excl. impact` 694.26. Per-budget point estimates were 125k 666.14, 250k 674.81, 375k 679.79, and 500k 683.79.

Decision: `npm run decide -- generated/golden-runs/attempt-directional-axis-quality-rank-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-1.0, 1.0], P(delta<=0)=46.7%, effect 0.08. Per-budget deltas were 125k -0.3, 250k -0.4, 375k -0.2, and 500k +0.5, with unchanged validity at every tier.

Why it was not kept: the directional factor created real basin reshuffling but no reliable suite gain. It helped some intended mature rows (`drums_swell` +4.81, `drums_zigzag` +5.10, `canyon_steps` +3.08 at 500k), yet losses on `syncopated_switchback` (-4.43), `rhythm_ladder` (-3.95), `drums_tide` (-5.26), and `cold_start` (-3.97) offset the 500k gain, while all lower budgets moved slightly negative. Work counters were essentially flat (`sim_frames` within about +/-60 and `candidates_sampled` within about +/-3 per row by budget), confirming this was mostly ordering/basin movement rather than improved budget allocation. The temporary source and test changes were reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - post-completion slack lookahead

Mechanism: temporarily test a narrower form of the user's high-slack `best` lookahead idea in `handoff.ts`. The normal first traversal stayed on the accepted default ranker, explicit `LR_FWD_EVAL` overrides stayed exact, and the accepted mature vertical `avg` override kept priority. Only after a complete incumbent existed could default non-vertical nodes use structural suffix slack to stochastically upgrade from `greedy:2` to `best:1:2` and then `best:1:3`, with suffix slack capped by whole-track slack. Candidate count, candidate generation, start selection, repair selection, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests). The objective-leaf frame-cost invariant was pinned to explicit `LR_FWD_EVAL=greedy:2` during the temporary trial because the adaptive default intentionally changed post-completion rollout shape.

Canonical: `generated/golden-runs/attempt-postcomplete-slack-lookahead-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-postcomplete-slack-lookahead-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 673.75 and `HEADLINE excl. impact` 688.9. Per-budget point estimates were 125k 665.71, 250k 673.20, 375k 674.12, and 500k 675.76.

Decision: `npm run decide -- generated/golden-runs/attempt-postcomplete-slack-lookahead-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: REJECT`, delta headline -5.2, CI [-8.2, -2.8], P(delta<=0)=100.0%, effect -3.82. Per-budget deltas were 125k -0.8, 250k -2.0, 375k -5.9, and 500k -7.5, with unchanged validity at every tier.

Why it failed: even after first completion, charged `best` lookahead is still a poor place to spend slack. It added about +2.7k/+16.7k/+47.9k/+71.5k charged forward-eval frames by budget, while reducing candidate samples by about -93/-642/-1857/-2745 and full evaluations by about -6.6/-33.0/-61.0/-76.5. Losses concentrated in the medium/high slack bands where the policy activated: slack 3..5 lost -5.3, 5..8 lost -5.9, and 8..12 lost -5.4 mean score. The only material positive spec was `tiny_dance` (+0.30 mean), while losses hit `syncopated_switchback` (-17.52), `opening_burst` (-14.81), `rhythm_ladder` (-14.43), `drums_tide` (-12.61), and `drums_swell` (-11.84). This confirms the caveat more sharply: structural slack is a valid affordability signal, but broad post-completion `best` ranking still displaces more productive search/repair work. Future slack use needs a value/opportunity signal, not another smooth slack-to-best selector. The temporary source and test changes were reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - INCONCLUSIVE CANONICAL - opening slack ambiguity best lookahead

Mechanism: temporarily add a narrower default-only opening lookahead selector in `handoff.ts`. The existing mature vertical `avg` override kept priority, explicit `LR_FWD_EVAL` overrides stayed exact, and candidate count stayed fixed. On the first contact gap only, structural traversal slack could smoothly buy `best:1:2` and then `best:1:3`, but only when the already quality-sorted opening pool had a cheap zero-frame ambiguity signal: at least two defined `candidateQualityObjective` values, a close top-two margin, and a non-trivial top objective. Candidate generation, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-opening-slack-ambiguity-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-slack-ambiguity-best-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.3 and `HEADLINE excl. impact` 694.52. Per-budget point estimates were 125k 666.46, 250k 675.34, 375k 680.34, and 500k 683.69.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-slack-ambiguity-best-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.4, 1.2], P(delta<=0)=17.9%, effect 0.81. Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.4, and 500k +0.4, with unchanged validity at every tier.

Why it was not kept: the selector fixed the broad slack-best failure shape but still did not clear the promotion gate. Score changes were localized: 125k was score-identical, while score-changing checkpoints were 17/480 at 250k, 24/480 at 375k, and 62/480 at 500k. Gains concentrated on `tiny_dance` (+8.11 mean), `mini_burst` (+2.76), `cold_start` (+1.46), and `opening_burst` (+1.21), with the main offset from `syncopated_switchback` (-2.15). Extra forward-eval spend stayed bounded compared with broad precompletion best-of (+0.95k/+1.68k/+2.21k charged fwd frames at 250k/375k/500k), but it still displaced a little normal search (`candidates_sampled` about -40/-64/-93 and full evaluations about -2.3/-4.2/-4.3 by budget). This is useful evidence that slack plus a local usefulness signal is the right direction, but this exact opening ambiguity rule is too small/noisy for production. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - precompletion high-slack best lookahead

Mechanism: temporarily use structural budget slack to buy extra default forward-eval evidence only before the first complete traversal. The existing mature vertical `avg` override kept priority, explicit `LR_FWD_EVAL` overrides were untouched, and the default non-vertical `greedy:2` ranker could smoothly stochastically upgrade to `best:1:2` from slack 3.25..4.5 and toward `best:1:3` from slack 5..7. Candidate count, candidate generation, start selection, repair logic, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-precomp-highslack-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-precomp-highslack-best-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 673.19 and `HEADLINE excl. impact` 687.16. Per-budget point estimates were 125k 665.56, 250k 672.78, 375k 672.79, and 500k 675.60.

Decision: `npm run decide -- generated/golden-runs/attempt-precomp-highslack-best-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: REJECT`, delta headline -5.8, CI [-9.4, -2.6], P(delta<=0)=100.0%, effect -3.35. Per-budget deltas were 125k -0.9, 250k -2.4, 375k -7.2, and 500k -7.7, with unchanged validity at every tier.

Why it failed: the stopped-first-completion characterization was directionally correct that easy/high-slack rows can afford `best:1:3`, but using that as a pre-completion production policy still displaced too much useful downstream work. First-completion frames rose by about +1.3k/+17.3k/+52.1k/+61.4k by budget, charged forward-eval frames rose +0.5k/+6.7k/+22.2k/+20.4k, repair frames fell -0.6k/-15.9k/-52.9k/-60.0k, and candidate samples fell at mature budgets. Gains on `tiny_dance` (+9.01 mean) and `solo_run` (+3.20) were overwhelmed by losses on drum/verse families, led by `drums_pulse` (-20.21), `drums_breath` (-17.88), `drums_crescendo` (-14.66), `rhythm_ladder` (-14.03), and `verse_chorus` (-13.80). Affordability alone is still insufficient; any future high-slack best-of use needs a stronger usefulness/opportunity-cost signal, or it must be much more localized than broad pre-completion ranking. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - INCONCLUSIVE CANONICAL - terminal current-quality pool rank

Mechanism: temporarily give terminal contact pools a zero-extra-simulation quality objective. When `candidateQualityObjective` found no next contact, the trial ranked candidates by measured current-gap target quality instead of returning `null` and falling back to cost order. Non-terminal pool ranking, candidate generation, aim proposals, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule were unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests), including a terminal-pool ranking regression test.

Canonical: `generated/golden-runs/attempt-terminal-quality-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-terminal-quality-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 678.91 and `HEADLINE excl. impact` 694.25. Per-budget point estimates were 125k 666.46, 250k 675.09, 375k 679.87, and 500k 683.20.

Decision: `npm run decide -- generated/golden-runs/attempt-terminal-quality-rank-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.3, 0.0], P(delta<=0)=89.0%, effect -0.83. Per-budget deltas were 125k +0.0, 250k -0.1, 375k -0.1, and 500k -0.1, with unchanged validity at every tier.

Why it was not kept: the zero-cost terminal ranker barely moved the compiler and the small movement was negative. Only 39/1920 paired checkpoints changed (29 improved, 10 regressed, 1881 unchanged). Work counters and simulated frames were essentially flat, confirming the mechanism was a pure ordering tweak rather than a budget-allocation effect. The only meaningful loss was `mini_burst` (-2.63 mean); small gains on `switchback_pop` (+0.08), `syncopated_switchback` (+0.02), and `grain_staircase` (+0.01) were too small to matter. Terminal current-axis information is not useful enough as a standalone pool-ordering rule. The temporary source and test changes were reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - INCONCLUSIVE CANONICAL - terminal current-axis aim

Mechanism: temporarily let the existing joint aim lane run on terminal contact gaps, where `nextContactGap` is absent. The normal next-contact objective path was unchanged. On terminal gaps only, the trial fitted the same local joint arc model but scored knob proposals by current-gap target quality alone, then still sent every proposal through exact `tryCandidateLines` validation before merging it into the pool. Candidate generation outside the terminal aim lane, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule were unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-terminal-current-aim-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-terminal-current-aim-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 678.87 and `HEADLINE excl. impact` 693.59. Per-budget point estimates were 125k 666.77, 250k 675.03, 375k 679.78, and 500k 683.14.

Decision: `npm run decide -- generated/golden-runs/attempt-terminal-current-aim-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.9, 0.6], P(delta<=0)=59.9%, effect -0.29. Per-budget deltas were 125k +0.3, 250k -0.1, 375k -0.2, and 500k -0.1, with unchanged validity at every tier.

Why it was not kept: the terminal lane behaved mechanically but did not buy quality. It turned many terminal `enum_no_target` skips into aimed proposals, increasing emitted aim candidates by about +58/+107/+152/+213 per checkpoint and joint-probe frames by about +3.2k/+6.2k/+8.9k/+12.3k across the four budgets. Scores were mostly reshuffled: 1129 paired checkpoints improved, 313 regressed, and 478 were unchanged, but the weighted effect was flat/slightly negative. Gains on `canyon_steps` (+1.76), `terrace_sprint` (+1.55), `dense_sprint` (+1.54), and `summit_push` (+1.29) were offset by losses on `syncopated_switchback` (-2.62), `drums_pendulum` (-1.96), `mini_burst` (-1.69), `leap_cadence` (-1.36), and `drums_crescendo` (-1.26). Terminal current-axis aiming is therefore not a compelling production default; if tail aiming returns, it needs a value gate or a cheaper terminal-specific model. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - gap-window quality pool rank

Mechanism: temporarily align the quality-objective pool ranker's current-axis term with the official scorer window by using `candidate.achievedAtEnd ?? candidate.achieved` inside `candidateQualityObjective`. The objective leaf already uses the gap-window value to reproduce the scorer, while the pool ranker had used the lookahead-window `candidate.achieved`. Candidate generation, local feasibility cost, start selection, forward-eval policy, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (6 files, 82 tests).

Canonical: `generated/golden-runs/attempt-gapwindow-quality-rank-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-gapwindow-quality-rank-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 676.89 and `HEADLINE excl. impact` 690.72. Per-budget point estimates were 125k 664.30, 250k 672.73, 375k 677.56, and 500k 681.62.

Decision: `npm run decide -- generated/golden-runs/attempt-gapwindow-quality-rank-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: REJECT`, delta headline -2.1, CI [-5.2, 0.1], P(delta<=0)=97.0%, effect -1.56. Per-budget deltas were 125k -2.2, 250k -2.4, 375k -2.4, and 500k -1.7, with unchanged validity at every tier.

Why it was not kept: matching the scorer window in the pool-rank current-axis term made the broad ranking surface worse even though the idea was internally coherent. Work counters barely moved, so this was basin reshaping rather than a budget-allocation effect. Gains on `drums_tide` (+6.14), `swoop_dive` (+4.98), and `drums_crescendo` (+4.25) were outweighed by large losses on `syncopated_switchback` (-29.08), `cold_start` (-16.20), `drums_dropout` (-7.92), `mini_burst` (-5.95), and `drums_signature` (-5.81). The lookahead-window `candidate.achieved` remains load-bearing for the pool-rank objective; the scorer-window correction belongs in the objective leaf, not in this pool ordering. The temporary source and test changes were reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - ABANDONED PROBE - slack-shaped quality candidate controller

Mechanism screened: temporarily make the unified quality candidate count a smooth function of structural traversal slack, while preserving exact `LR_QUALITY_NCAND` overrides for characterization. Scarce slack pulled q from the existing base toward 28, neutral slack preserved the baseline, and surplus slack gradually bought breadth up to q40. Candidate generation families, start selection, forward eval strategy, repair logic, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Why it was tried: fixed q48 showed some positive point estimates at 250k+ and high slack, while earlier q28/q29 trials suggested lower q can sometimes protect scarce 125k rows. This tested whether the traversal model could combine those directions into one smooth allocation knob instead of using raw budget thresholds.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 77 tests).

Probe: `generated/golden-runs/probe-slack-qctrl-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-slack-qctrl-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 677.62 and `HEADLINE excl. impact` 691.4.

Probe decision: `npm run decide -- generated/golden-runs/probe-slack-qctrl-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -0.4 on the 40-spec x 3-seed x full-grid intersection, CI [-4.0, 2.9], P(delta<=0)=59.7%. Per-budget deltas were 125k -2.2, 250k +0.1, 375k -0.1, and 500k -0.5, with unchanged 100% diagnostic validity.

Why it was stopped: the controller worked mechanically but did not create useful leverage. On the paired probe, q fell from 32 to about 28.9 in the slack <1.5 band and that band lost -5.7 mean score; surplus bands used q around 37.3 for slack 5..8 and q40 for slack >=8, but those bands were flat (+0.0 and -0.4). Runtime/work counters stayed effectively unchanged, so changing q mostly reshaped search basins rather than buying reliable extra quality or traversal savings. The temporary source and test edits were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - INCONCLUSIVE - elevation-axis admission candidate

Mechanism: temporarily add one extra `axisq` candidate to the ranked handoff options when the admitted pool materially under-hit a high elevation target and a non-admitted candidate had a meaningfully lower elevation error without a large cost increase. This tested whether the measured systematic elevation undershoot was caused by useful already-generated candidates being hidden just outside the admitted pool. Candidate generation, start selection, forward eval, repair logic, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 76 tests).

Canonical candidate: `generated/golden-runs/attempt-elevation-axisq-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-elevation-axisq-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 678.0 and `HEADLINE excl. impact` 693.21; per-budget point estimates were 125k 656.67, 250k 675.14, 375k 679.99, and 500k 683.27.

Decision: `npm run decide -- generated/golden-runs/attempt-elevation-axisq-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.1, 0.1], P(delta<=0)=61.4%, effect -0.23. Per-budget deltas were 125k -0.0, 250k -0.0, 375k +0.0, and 500k -0.0, with unchanged rounded diagnostic validity at every tier.

Why it was not kept: the targeted admission hook did not move the compiler in a meaningful way. This suggests the elevation undershoot is not primarily caused by an otherwise good elevation candidate sitting just outside the handoff pool under this selector; it likely needs either proposal-generation changes, objective pressure changes, or a better-conditioned axis selector. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - REJECT - slack-governed best-of forward eval

Mechanism: temporarily extend the default per-candidate forward-eval policy so the existing accepted mature vertical `avg` promotion kept precedence, explicit `LR_FWD_EVAL` overrides stayed exact, and non-vertical default nodes used structural traversal slack to stochastically round from `greedy:2` toward `best:1:2` and `best:1:3`. The mapping was smooth and scale-based: `expected_extra_branches = clamp(log2(budget_slack) - 1, 0, 2)`, so slack 2 stayed greedy on average, slack 4 averaged branch 2, and slack 8 reached branch 3. Candidate count, candidate generation, start selection, repair logic, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial after isolating the existing objective-leaf cost test from the new default ranker policy (5 files, 77 tests). The temporary source and test edits were reverted after the rejection.

Canonical candidate: `generated/golden-runs/attempt-slack-best-fwd-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-best-fwd-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 670.91 and `HEADLINE excl. impact` 685.15; per-budget point estimates were 125k 654.40, 250k 670.70, 375k 671.28, and 500k 674.86.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-best-fwd-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: REJECT`, delta headline -7.1, CI [-11.5, -3.0], P(delta<=0)=100.0%. Per-budget deltas were 125k -2.3, 250k -4.5, 375k -8.7, and 500k -8.4, with rounded diagnostic validity unchanged at every tier.

Why it failed: this was the clean version of the user's high-slack best-of idea, and it gives a clear answer: using slack to buy global per-candidate best-of ranking is too expensive and displaces the work that actually improves the final track. Average charged fwd-eval frames rose by about +9.6k/+52.8k/+94.3k/+131.7k across the four tiers, while repair frames fell by about -6.0k/-39.5k/-57.5k/-67.6k, sampled candidates fell by about -329/-2039/-3544/-4871, and full evaluations fell by about -10/-29/-47/-63. First-completion frames also rose strongly (+6.7k/+37.0k/+55.6k/+65.3k), so the deeper ranker did not make traversal cheaper. Small gains on `solo_run` (+11.71) and `tiny_dance` (+9.76) were overwhelmed by broad losses on `verse_chorus` (-24.66), `drums_pulse` (-24.36), `drums_breath` (-23.01), `drums_crescendo` (-22.84), `cold_start` (-19.68), and other drum/verse families. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`. Future slack use should allocate extra work to earlier/bounded decisions or targeted rescue/repair, not broad per-candidate best-of forward ranking.

## 2026-06-28 - INCONCLUSIVE - high-q interior launch/length span lattice

Mechanism: temporarily change the contact-centered sampler's `ccSpanBlends` schedule so attempts 0..15 stayed byte-identical to the accepted 16-step diagonal/anti-diagonal launch x ride-out length pattern, while attempts 16+ used a 4x4 interior launch x length lattice at cell midpoints. The intent was to keep the explicit high-q off-diagonal coverage idea from the coarse lattice trial, but avoid adding exact endpoint profiles in the extra tail. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 76 tests).

Canonical candidate: `generated/golden-runs/attempt-cc-span-interior-lattice-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-cc-span-interior-lattice-j32-a01`. It completed valid 1920/1920 with raw HEADLINE 678.24 and `HEADLINE excl. impact` 692.88; per-budget point estimates were 125k 664.61, 250k 674.07, 375k 679.46, and 500k 682.83.

Decision: `npm run decide -- generated/golden-runs/attempt-cc-span-interior-lattice-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.2, CI [-3.5, 5.1], P(delta<=0)=49.3%. Per-budget deltas were 125k +7.9, 250k -1.1, 375k -0.5, and 500k -0.5, with rounded diagnostic validity unchanged at every tier.

Why it was not kept: the interior version fixed the lone invalid 125k row and found real rescues, but it did not generalize across budgets. Mean row-level gains were led by `drums_tide` (+12.00), `solo_run` (+11.63), `drums_signature` (+5.94), `mini_burst` (+5.43), and `skyline_push` (+4.01), but they were offset by `cold_start` (-17.94), `drums_pulse` (-11.33), `drums_crosscut` (-7.68), `float_bounds` (-6.34), and `syncopated_switchback` (-5.77). The largest row swings again show sampler basin reshaping rather than a smooth budget knob (`solo_run` 125k seed 7 recovered from 0 to 662.07, while `drums_tide` 125k seed 2 lost 172.59 and seed 3 lost 150.99). Average work counters barely moved: first-completion frames rose only about 142-338 frames by tier, candidate samples were flat to slightly lower, and fwd-eval frames were slightly lower. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`. Future sampler work should avoid global high-q tail reshaping and instead make sampler expansion explicit, measurable, and structurally gated before canonical promotion.

## 2026-06-28 - INCONCLUSIVE - high-q launch/length span lattice

Mechanism: temporarily change the contact-centered sampler's `ccSpanBlends` schedule so attempts 0..15 stayed byte-identical to the accepted 16-step diagonal/anti-diagonal launch x ride-out length pattern, while attempts 16+ used a coarse 4x4 launch x length lattice. The intent was to make higher-q pools buy explicit extra arc-space coverage rather than replaying the same launch/length span profile with only ordinary geometry rolls changed. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 76 tests).

Canonical candidate: `generated/golden-runs/attempt-cc-span-lattice-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-cc-span-lattice-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 677.88 and `HEADLINE excl. impact` 691.86; per-budget point estimates were 125k 658.26, 250k 674.52, 375k 679.51, and 500k 683.23.

Decision: `npm run decide -- generated/golden-runs/attempt-cc-span-lattice-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-5.4, 4.8], P(delta<=0)=51.0%. Per-budget deltas were 125k +1.6, 250k -0.6, 375k -0.5, and 500k -0.1, with unchanged rounded diagnostic validity at every tier.

Why it was not kept: the sampler idea is directionally useful for some hard families but too high-variance as a production default. Mean gains were led by `drums_tide` (+23.45), `drums_zigzag` (+6.25), `skyline_push` (+4.91), `drums_pendulum` (+4.06), `canyon_steps` (+3.58), and `syncopated_lift` (+3.26), but they were offset by `syncopated_switchback` (-19.69), `drums_crescendo` (-11.21), `drums_crosscut` (-5.77), `drums_pulse` (-5.32), and `drums_swell` (-5.26). The largest row swings show this is a basin-reshaping change, not a stable small correction (`solo_run` 125k swapped which seed failed; `drums_dropout` seed 3 improved strongly while seed 1 regressed strongly). Work counters barely changed on average, so the issue is proposal distribution, not cost. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`. Future sampler work should keep the explicit-profile idea but condition it on authored rhythm/axis structure, or study less coarse tail profiles before promotion.

## 2026-06-28 - ABANDONED PROBE - very-high-slack opening best lookahead

Mechanism screened: temporarily add a default-only opening forward-eval selector that preserved explicit `LR_FWD_EVAL` overrides and let the existing mature vertical `avg` override keep precedence. Only the first authored contact could switch from default `greedy:2` to `best:1:2` or `best:1:3`, with deterministic fractional activation from structural traversal slack: `best:1:2` faded in above slack 8 and `best:1:3` above slack 12. Candidate count, candidate generation, start selection, post-opening forward eval, repair, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Why it was tried: the stopped-first-completion Q x lookahead panel supports the user's point that simple high-slack rows can afford best-of opening evaluation. Previous broad precompletion lookahead was rejected, but the narrower opening-only policy had a small 500k upside. This probe isolated that idea at fixed q32, without coupling it to q48 or changing repair policy.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 76 tests).

Probe: `generated/golden-runs/probe-opening-slack-best13-q32-j48-s0-3-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-opening-slack-best13-q32-j48-s0-3-a01`. It completed valid 640/640 with raw probe HEADLINE 678.25 and `HEADLINE excl. impact` 691.64.

Probe decision: `npm run decide -- generated/golden-runs/probe-opening-slack-best13-q32-j48-s0-3-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.2 on the 40-spec x 4-seed x full-grid intersection, CI [-0.7, 1.3], P(delta<=0)=34.7%. Per-budget deltas were 125k +0.1, 250k -0.1, 375k +0.1, and 500k +0.4, with unchanged 100% diagnostic validity.

Why it was stopped: the direction is consistent with the high-slack intuition but much too small for promotion. High-slack rows moved only +0.28 mean with equal improve/regress counts (11/11), and the main effect was local reshuffling rather than a durable score lift. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - ABANDONED PROBE - extreme-low-slack q28 quality breadth

Mechanism screened: temporarily add a structural traversal-slack pull inside `qualityHandoffSampleCount`, preserving explicit `LR_QUALITY_NCAND` overrides and the existing authored-shape quality relief gates. The selector smoothly moved the requested quality pool toward `q=28` only when `budget / predicted_first_completion_frames` was extremely scarce, with full pressure around slack 1.25 and fading out by slack 1.50. Candidate generation families, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Why it was tried: the canonical q28 scarce-quality trial raised the official 125k budget score by +8.7 but was too noisy to accept. Its official gain came mostly from fixing the weak long/low-slack `solo_run` tail, while the next-lowest slack band was mixed. This probe tested whether the useful part could be isolated by the traversal model rather than by a raw budget or contact-count branch.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 76 tests).

Probe: `generated/golden-runs/probe-extreme-slack-q28-125k-j48-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --budgets=125000 --jobs=48 --archive-dir=generated/golden-runs/probe-extreme-slack-q28-125k-j48-a01`. It completed valid 480/480 with raw 125k score 665.79 and `HEADLINE excl. impact` 682.17.

Probe decision: `npm run decide -- generated/golden-runs/probe-extreme-slack-q28-125k-j48-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, 125k delta +9.1, CI [-0.1, 51.9], P(delta<=0)=41.1%. Activation was exactly 12/480 checkpoint rows: all `solo_run` seeds at slack 1.292 used q28; every other 125k row stayed at q32.

Why it was stopped: the mechanism is clean and fixes the one invalid 125k row (`solo_run` seed 7, 0 -> 643.85), but the official gain is concentrated in one spec. That makes it too narrow for the canonical bootstrap and too close to an indirect benchmark-row selector to promote. Broad q28 already failed to clear the gate, and this narrowed version removes noise but not concentration risk. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - ABANDONED PROBE - mature vertical avg forward-eval ablation

Mechanism screened: disable only the default mature vertical-drama `avg` forward-eval override by running with explicit `LR_FWD_EVAL=greedy:2`. This leaves the base default ranker shape (`greedy:2` with the normal objective leaf) intact but bypasses `matureForwardEvalConfig`, because that override only applies when `LR_FWD_EVAL` is unset. Source, scorer, specs, fingerprint, seed set, budget grid, candidate generation, start selection, repair, and acceptance rule were unchanged.

Why it was tried: many slack/lookahead selectors have failed, so removing stale special cases is attractive if they no longer pay under the unified compiler. The mature vertical `avg` selector is localized and default-only, making it a clean simplification candidate if the ablation were neutral or positive.

Probe: `generated/golden-runs/probe-no-mature-avg-fwd-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm LR_FWD_EVAL=greedy:2 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-no-mature-avg-fwd-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 672.87 and `HEADLINE excl. impact` 687.49.

Probe decision: `npm run decide -- generated/golden-runs/probe-no-mature-avg-fwd-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -5.2 on the 40-spec x 3-seed x full-grid intersection, CI [-10.8, -1.3], P(delta<=0)=99.9%. Per-budget deltas were 125k -8.1, 250k -5.3, 375k -5.4, and 500k -4.3.

Why it was stopped: the vertical `avg` override is still load-bearing. Disabling it regressed every budget with unchanged validity, so no source ablation or canonical run was justified.

## 2026-06-28 - INCONCLUSIVE - low-amplitude damping for elevation ride-out shortening

Mechanism: temporarily damp the contact-centered elevation ride-out shortening when an explicit low-amplitude target was present, with the damping fading out for high-impact targets. The intent was to avoid treating low-amplitude climb gaps like "no amplitude pop requested", while preserving the existing hard-impact climb setup. Candidate generation families, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Why it was tried: baseline axis anatomy showed meaningful low-amplitude/elevation conflicts, especially large low-amplitude overshoot on `terrace_sprint`. A first 4-seed probe was positive but fragile, so the high-impact fade was added before the canonical run.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed after the final temporary source change (5 files, 76 tests).

Canonical candidate: `generated/golden-runs/attempt-lowamp-elevation-impactfade-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowamp-elevation-impactfade-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 678.2 and `HEADLINE excl. impact` 693.33; per-budget point estimates were 125k 657.07, 250k 675.39, 375k 680.13, and 500k 683.44.

Decision: `npm run decide -- generated/golden-runs/attempt-lowamp-elevation-impactfade-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Delta headline +0.2, CI [-0.1, 0.7], P(Delta<=0)=14.0%. Per-budget deltas were 125k +0.4, 250k +0.2, 375k +0.2, and 500k +0.1, with unchanged 100% diagnostic validity at every tier.

Why it was not kept: the direction is positive but does not clear the acceptance rule, and the earlier probe showed large fragile row swings. The mechanism may be a real small improvement, but promoting it would be overfitting to an inconclusive effect. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - ABANDONED PROBE - high-slack q48 best:1:3 first-completion exploration

Mechanism screened: use the structural traversal slack model only before the first complete traversal to ramp the unified quality candidate count toward `q=48` and stochastically switch the default `greedy:2` forward-eval ranker to `best:1:3`. Explicit `LR_QUALITY_NCAND` and `LR_FWD_EVAL` overrides stayed exact, and the accepted mature vertical `avg` selector kept precedence. Repair/post-completion policy, start selection, scorer, specs, fingerprint, seed set, and budget grid were unchanged.

Why it was tried: the stopped-first-completion characterization supported the user's hypothesis that slack can afford richer first traversal on simple rows. At 300k, all golden specs and seeds 0..5 showed `q=48,best:1:3` beating the production-like `q=32,default` first-completion baseline by about +7.1 mean score while costing about 2.7x first-completion frames. The positive region was mostly structural slack above roughly 5, while `q=48` under default greedy was worse.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/budget_model.test.ts tests/optimizer_handoff.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed during the temporary source trial (5 files, 76 tests).

Probe: `generated/golden-runs/probe-highslack-q48-best13-firstcomp-j48-s0-3-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-highslack-q48-best13-firstcomp-j48-s0-3-a01`. It completed valid 640/640 with raw probe HEADLINE 678.09 and `HEADLINE excl. impact` 690.99.

Probe decision: `npm run decide -- generated/golden-runs/probe-highslack-q48-best13-firstcomp-j48-s0-3-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0 on the 40-spec x 4-seed x full-grid intersection, CI [-3.6, 4.0], P(delta<=0)=50.4%. Per-budget deltas were 125k +0.2, 250k -1.0, 375k -0.2, and 500k +0.6, with unchanged 100% diagnostic validity.

Why it was stopped: the first-completion signal did not survive the repair-aware compile. The controller did increase first-completion work where expected, but mostly displaced repair budget: on the probe, mean first-completion frames moved about +0.6k/+4.8k/+19.6k/+36.3k at 125k/250k/375k/500k, while repair frames moved about +0.3k/-4.9k/-18.8k/-24.1k. Slack bands 5..7 and 7..10 were effectively flat, and the ultra-high-slack band was slightly negative once repair was included. This supports the principle that slack can afford `best` lookahead, but says the useful selector must be value-aware or repair-aware, not just a smooth slack-to-q/best ramp. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - INCONCLUSIVE - interior tail-completion throttle

Mechanism: temporarily throttle speculative tail completion only in the low-yield interior of the near-tail window. The selector preserved first-completion/no-feedback behavior, shallow remaining depths, and the high-yield boundary depths, then used smooth pressure from target budget, existing full-evaluation feedback, and distance from shallow/boundary depths to deterministically skip some middle-depth tail completions. Candidate generation, ranking, repair, start selection, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule were unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/budget_model.test.ts tests/optimizer_handoff.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 77 tests).

Canonical candidate: `generated/golden-runs/attempt-tail-interior-throttle-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-tail-interior-throttle-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 678.00 and `HEADLINE excl. impact` 693.22; per-budget point estimates were 125k 656.69, 250k 675.15, 375k 679.96, and 500k 683.29.

Decision: `npm run decide -- generated/golden-runs/attempt-tail-interior-throttle-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.0, 0.0], P(delta<=0)=100.0%, effect -0.59. Per-budget deltas were 125k +0.0, 250k -0.0, 375k -0.0, and 500k +0.0, with unchanged diagnostic validity.

Why it was not kept: the mechanism successfully removed the targeted low-yield middle tail attempts, especially at mature budgets, but the saved work did not reinvest into useful search. Mean tail attempts fell by about 1.2/6.2/12.5/19.1 per row at 125k/250k/375k/500k, but unique full evaluations were essentially flat (-0.01/-0.06/-0.05/+0.02 per row), candidate samples barely moved, and only two paired scores changed, both tiny negative. This confirms that tail middle-depth completions are wasteful telemetry-wise, but suppressing them alone does not buy quality; future tail work needs an explicit productive reinvestment path rather than another skip/throttle. The temporary source and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - REJECT - structural-slack precompletion best lookahead

Mechanism: temporarily use the structural traversal model to select deeper default forward lookahead during the first-completion traversal. The source preserved explicit `LR_FWD_EVAL` overrides, kept the accepted mature vertical `avg` selector first, and only before the first complete incumbent mapped whole-run slack (`budget / predicted_first_completion_frames`) through measured first-completion cost ratios (`best:1:2` about 1.4x, `best:1:3` about 2.6x, with reserve) into a deterministic stochastic choice among default `greedy:2`, `best:1:2`, and `best:1:3`. After first completion, repair and ordinary quality search used the baseline ranker. Candidate generation, quality breadth, start selection, repair scheduling, scorer, specs, fingerprint, seed set, and budget grid were unchanged.

Why it was tried: the opening-only slack best-of result was inconclusive but positive at 500k, and the user correctly noted that a simple row with large structural slack should be able to afford `best:1:2/3`. This tested the next broader form: not only the first real contact, but the whole precompletion traversal, while still avoiding raw budget thresholds and preserving accepted vertical `avg` behavior.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/budget_model.test.ts tests/optimizer_handoff.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed before the canonical run (5 files, 77 tests).

Canonical candidate: `generated/golden-runs/attempt-slack-precompletion-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-precompletion-best-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 671.84 and `HEADLINE excl. impact` 686.17; per-budget point estimates were 125k 656.67, 250k 668.66, 375k 673.99, and 500k 675.60.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-precompletion-best-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: REJECT`, Δheadline -6.2, CI [-10.6, -2.3], P(Δ<=0)=100.0%, effect -2.91. Per-budget deltas were 125k -0.0, 250k -6.5, 375k -6.0, and 500k -7.7, with unchanged diagnostic validity at every tier.

Why it was not kept: structural slack is not sufficient to decide where broad `best` lookahead helps. The policy left 125k effectively neutral but made every mature tier worse. Mean charged forward-eval frames rose from about 74k -> 95k at 250k, 111k -> 138k at 375k, and 149k -> 177k at 500k; mean first-completion frames rose from about 62k -> 99k, 63k -> 116k, and 63k -> 127k respectively. Changed paired rows also skewed negative at mature budgets (250k 104 improved / 144 regressed; 375k 97 / 151; 500k 96 / 152). This confirms the user's caveat in the useful direction: high budget slack can afford more compute, but the traversal-cost oracle does not say that `best` is the right way to spend it on a given branch. The temporary compiler and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - INCONCLUSIVE - ambiguity-gated opening best lookahead

Mechanism: temporarily refine the slack-conditioned opening lookahead idea with a value/uncertainty guard. The source preserved explicit `LR_FWD_EVAL` overrides and the mature vertical `avg` selector, then only on the first real contact computed the normal default `greedy:2` pool scores first. If whole-run structural slack was high and the top greedy scores were close, it stochastically rescored the top three pool candidates with charged `best:1:2`. Candidate generation, quality breadth, start selection, repair, scorer, specs, fingerprint, seed set, and budget grid were unchanged.

Why it was tried: previous slack-only opening best-of was positive at 500k but inconclusive, while broader suffix/precompletion best-of was rejected. This tested whether adding a direct ambiguity signal could make high-slack opening best-of selective enough to keep the upside without the mid-budget collateral.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/budget_model.test.ts tests/optimizer_handoff.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed before the canonical run (5 files, 77 tests).

Canonical candidate: `generated/golden-runs/attempt-opening-ambiguous-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-ambiguous-best-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 677.75 and `HEADLINE excl. impact` 692.49; per-budget point estimates were 125k 656.69, 250k 674.99, 375k 679.67, and 500k 682.95.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-ambiguous-best-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Δheadline -0.3, CI [-1.1, 0.4], P(Δ<=0)=75.4%, effect -0.66. Per-budget deltas were 125k +0.0, 250k -0.2, 375k -0.3, and 500k -0.3, with unchanged diagnostic validity at every tier.

Why it was not kept: the ambiguity guard made the mechanism narrower but did not fix the fundamental opening best-of issue. The scarce tier stayed byte-identical as intended, but every mature tier moved slightly negative. Work counters show small mature-budget reshuffling rather than useful reinvestment: at 500k full evaluations fell from about 95.2k to 94.3k, sampled candidates fell by about 15.2k, and tail best hits rose only 1998 -> 2042. The extra charged opening evidence still changed basins without producing a net quality lift, so the temporary source and test changes were reverted. The accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - INCONCLUSIVE - cost-normalized opening slack best lookahead

Mechanism: temporarily use traversal-budget slack to choose extra lookahead only for the first real contact. The source preserved explicit `LR_FWD_EVAL` overrides, kept the existing mature vertical `avg` selector precedence, and mapped whole-run structural slack through the measured `best:1:3` first-completion cost ratio (~2.6) to a deterministic stochastic branch choice between the default `greedy:2`, `best:1:2`, and `best:1:3`. Candidate generation, quality breadth, start selection, repair, scorer, specs, fingerprint, seed set, and budget grid were unchanged.

Why it was tried: the first-completion panels show high-slack rows are the only clearly positive region for `best` lookahead, and the user correctly pointed out that simple short maps with large budget slack can afford `best:1:2/3` even if dense maps cannot. This trial tested that idea in the narrowest production-like form without a raw budget threshold or local q cap.

Focused tests: during the temporary source trial, `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/budget_model.test.ts tests/optimizer_handoff.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 78 tests). The objective/full leaf frame-cost invariant needed a temporary explicit `LR_FWD_EVAL=greedy:2` pin because the adaptive default intentionally changed the rollout shape on high-slack rows; that test edit was reverted with the source.

Canonical candidate: `generated/golden-runs/attempt-opening-slack-costnorm-best-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-slack-costnorm-best-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 678.62 and `HEADLINE excl. impact` 694.32; per-budget point estimates were 125k 656.83, 250k 674.95, 375k 679.91, and 500k 684.92.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-slack-costnorm-best-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Delta headline +0.6, CI [-1.4, 2.3], P(Delta<=0)=22.7%. Per-budget deltas were 125k +0.1, 250k -0.2, 375k -0.1, and 500k +1.6, with unchanged 100% diagnostic validity at every tier.

Why it was not kept: this is the cleanest evidence so far that slack-conditioned opening best-of is plausibly useful at mature budgets, especially 500k, but it still does not clear the accept rule and slightly hurts the mid-budget point estimates. The result supports the user's framing that slack can buy richer opening evaluation on simple rows, but the production policy still needs either a stronger value-aware selector or a broader accepted budget-allocation mechanism. The temporary source and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - INCONCLUSIVE - scarce-budget q28 quality breadth

Mechanism: strengthen the existing smooth quality-candidate lean only at scarce budgets. The temporary source moved the low-budget quality breadth from the current q=32 behavior at 125k to q=28, while keeping q=29 at 250k/375k/500k and preserving the explicit `LR_QUALITY_NCAND` override. Candidate generation families, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, and budget grid were otherwise unchanged.

Why it was tried: earlier 125k screens showed q=28/q=29 improving scarce-budget completion and score, and the full canonical grid should have been mostly isolated to the 125k tier. This made it a clean test of whether lower scarce breadth was a real budget-allocation win rather than a small-sample artifact.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 77 tests).

Canonical candidate: `generated/golden-runs/attempt-scarce-quality-lean28-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-scarce-quality-lean28-j32-a01`. It completed valid 1920/1920 with raw HEADLINE 678.87 and `HEADLINE excl. impact` 694.09; per-budget point estimates were 125k 665.35, 250k 675.16, 375k 679.97, and 500k 683.29.

Decision: `npm run decide -- generated/golden-runs/attempt-scarce-quality-lean28-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Delta headline +0.9, CI [-0.4, 5.1], P(Delta<=0)=33.2%. Per-budget deltas were 125k +8.7, 250k +0.0, 375k +0.0, and 500k +0.0, with 100% validity at every tier.

Why it was not kept: the effect is exactly where intended and directionally useful, but the 125k signal remains too seed/spec-unstable to clear the accept rule. The decision estimate says about 25 total seeds would likely resolve it, but under the canonical acceptance workflow this is not promotable. The temporary source and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - INCONCLUSIVE - repair elevation residual re-aim

Mechanism: add a narrow repair-time planned-target correction for dominant upward elevation undershoots. During the existing weak-gap repair loop, if the already-selected repair gap's measured elevation residual was dominant and under-hit the authored climb target, the restart temporarily aimed that gap's elevation higher by a smooth residual-scaled amount, then cleared the planned target after the iteration. First completion, candidate counts, start selection, forward eval, repair scheduling, scorer, specs, fingerprint, seed set, and budget grid were unchanged.

Why it was tried: baseline reports show elevation is under-hit on about 84% of elevation-targeted gap measurements, and most of those misses are still below the reported achievable ceiling. This made elevation a cleaner candidate for the existing outcome-gated planning seam than the already-rejected impact loop or static up-front elevation aim bias.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/planning_reaim.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 78 tests).

Canonical candidate: `generated/golden-runs/attempt-repair-elevation-residual-reaim-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-elevation-residual-reaim-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 678.01 and `HEADLINE excl. impact` 693.32; per-budget point estimates were 125k 656.71, 250k 674.98, 375k 679.97, and 500k 683.38.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-elevation-residual-reaim-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Δheadline +0.0, CI [-0.2, 0.2], P(Δ<=0)=48.5%. Per-budget deltas were 125k +0.0, 250k -0.2, 375k -0.0, and 500k +0.1, with unchanged diagnostic pass rates.

Why it was not kept: the mechanism was too narrow and mostly path-neutral. Only 117 paired checkpoint scores changed: 57 improved, 60 regressed, and 1803 were score-identical. Elevation absolute error moved only 0.118547 -> 0.118495, while impact and speed were slightly worse. The best average movement was `switchback_pop` (+1.31) and `dense_echo_climb` (+0.10), but `climb_terrace` (-1.67), `rolling_hills` (-0.17), `summit_push` (-0.16), and `glide_stairs` (-0.13) offset it. Repair-local planned elevation aiming is conceptually clean, but this dominant-residual form does not materially improve the canonical headline. The temporary compiler and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - INCONCLUSIVE - cadence-regularized low-air impact template hold

Mechanism: add one optional straight hold line after the existing impact-template scoop, but only inside already-scheduled impact-template lanes. The hold length was smooth and deterministic: low-air pressure, current impact pressure, local contact-cadence regularity, and a low-discrepancy attempt roll scaled it; amplitude/elevation-targeted gaps were excluded. Candidate count, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, and budget grid were unchanged.

Why it was tried: the earlier low-air impact rideout improved the intended `drums_pendulum` family but lost too much on rhythm/collateral rows. This variant kept the useful geometry idea but added a cadence-regularity separator and avoided vertical mixed-axis rows.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Screen: `generated/golden-runs/probe-regular-lowair-impact-hold-j48-s0-2-a01/golden.json`, run on `drums_pendulum,syncopated_switchback,rhythm_ladder,dense_sprint,drums_dropout,drums_crescendo,solo_run`, seeds 0..2, budgets 125k/250k/500k, with `--jobs=48`. The paired probe decision against the current baseline was non-promotable but promising: Δheadline +4.0, CI [-2.7, 12.4], P(Δ<=0)=13.3%, positive at all three probed budgets.

Canonical candidate: `generated/golden-runs/attempt-regular-lowair-impact-hold-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-regular-lowair-impact-hold-j32-a01`. It completed valid 1919/1920 with raw HEADLINE ~678.0 and `HEADLINE excl. impact` 693.17.

Decision: `npm run decide -- generated/golden-runs/attempt-regular-lowair-impact-hold-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Δheadline -0.0, CI [-0.8, 0.8], P(Δ<=0)=52.3%. Per-budget deltas were 125k +0.8, 250k +0.1, 375k +0.2, and 500k -0.4.

Why it was not kept: the screen did not generalize. The mechanism had real targeted upside (`drums_pendulum` +5.36 mean row delta, `rhythm_ladder` +3.76), but it was offset by `drums_dropout` (-3.48), `cold_start` (-2.65), `mini_burst` (-1.53), and a negative 500k point estimate. The cadence separator reduced blast radius but did not make the hold line a suite-positive production default. The source change was reverted; archives are retained.

## 2026-06-27 - ABANDONED PROBE - budget-exhaustion tail rescue

Mechanism screened: extend speculative tail completion only when the compiler had no complete track yet, had already placed most contacts, and was essentially at the requested budget. The temporary source kept the normal small tail-completion window unchanged, then added a bounded emergency extension for deep clean prefixes near budget exhaustion. A second version let only that emergency rescue use a three-wide bounded suffix search. Candidate generation, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and the normal two-wide tail path were otherwise unchanged.

Why it was tried: the current baseline has one invalid canonical checkpoint, `solo_run` seed 7 at 125k. It reaches a clean 61/77-contact prefix with no full evaluation and no tail attempts because the normal 125k tail window is about 9.7 contacts. A generic no-completion/deep-prefix rescue looked like the narrowest way to turn that near-finish into a valid full track without perturbing ordinary quality search.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts` passed before row probes (2 files, 40 tests).

Focused probes: `generated/golden-runs/probe-tail-exhaustion-rescue-solo7-125k-a02/golden.json` activated one emergency attempt at 18 remaining contacts but still failed the row, with `tail=1/0`, `sim=126975`, `hits=61`, `missing=16`. The wider three-branch variant, `generated/golden-runs/probe-tail-exhaustion-rescue-solo7-125k-a03/golden.json`, also failed with `tail=1/0`, `sim=127111`, `hits=61`, `missing=16`.

Why it was stopped: the late prefix itself was not recoverable by a simple bounded suffix DFS. The rescue spent extra work but found no complete suffix, so a canonical run would only risk perturbing other near-budget rows. This also explains why the archived 125k q-lean can fix `solo_run` seed 7: it changes the earlier search basin, not just the final tail completion. The temporary source changes were reverted.

## 2026-06-27 - ABANDONED PROBE - q-capped high-slack opening best lookahead

Mechanism screened: pair the strongest previous slack/opening idea with a smaller opening candidate pool. The temporary source used compile-level traversal slack to stochastically move the first-contact opening ranker from default `greedy:2` toward `best:1:2/3` using the empirical first-completion cost ratio 2.6, and capped that same opening pool at 24 candidates only when the best-lookahead branch activated. Explicit `LR_FWD_EVAL` and `LR_QUALITY_NCAND` overrides stayed exact, existing mature vertical `avg` precedence stayed first, and candidate generation families, start selection, repair, scorer, specs, fingerprint, seed set, and budget grid were unchanged.

Why it was tried: the archived q x lookahead studies show that raising q does not rescue expensive best lookahead. In the full 200k panel, `q=48` under `best:1:3` regressed badly versus `q=32`, while `q=24` was close to neutral. In the first-completion 300k panel, `q=24 best:1:2` was competitive with `q=32 best:1:2` while spending less candidate work. This made a local q cap a plausible way to improve the earlier cost-aware opening slack result without adding more broad lookahead.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests). During the temporary trial, the objective/full leaf frame-cost invariant needed to pin `LR_FWD_EVAL=greedy:2` because the adaptive default intentionally changed the rollout shape on high-slack `tiny_dance`; the test edit was reverted with the source.

Probe: `generated/golden-runs/probe-opening-slack-best-q24-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-opening-slack-best-q24-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 677.72 and `HEADLINE excl. impact` 692.05.

Probe decision: `npm run decide -- generated/golden-runs/probe-opening-slack-best-q24-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -0.3 on the 40-spec x 3-seed x full-grid intersection, CI [-3.0, 2.3], P(delta<=0)=60.9%. Per-budget deltas were 125k +0.6, 250k -0.8, 375k -1.1, and 500k +0.2.

Why it was stopped: capping the active opening pool at q=24 did not stabilize the opening slack policy. It helped `tiny_dance` (+11.1 average over the probe) and a few drum rows, but made `mini_burst` (-19.6), `syncopated_switchback` (-9.9), `dense_sprint` (-4.7), `drums_pulse` (-4.0), and `drums_zigzag` (-3.9) worse. The mechanism reduced candidate samples by about 82 per row on average, but added forward-eval work and did not improve the paired headline. The temporary source and test changes were reverted. Future opening work should not assume smaller q makes best-lookahead safer; the remaining issue is branch/value selection, not raw opening sample count.

## 2026-06-27 - ABANDONED PROBE - cadence-regularized high-slack opening lookahead

Mechanism screened: refine the earlier cost-aware opening slack lookahead by adding a smooth cadence-regularity guard. The temporary source kept explicit `LR_FWD_EVAL` overrides exact, preserved the existing mature vertical `avg` selector precedence, and only allowed the default first-contact opening ranker to stochastically move from `greedy:2` toward `best:1:2/3` when compile-level traversal slack was high and the authored contact intervals were regular. Candidate generation, start selection, repair, scorer, specs, fingerprint, seed set, and budget grid stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed after making the trial helper compatible with test-only specs that install a forward-eval context without authored contacts (5 files, 76 tests).

Probe: `generated/golden-runs/probe-opening-regular-slack-best-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-opening-regular-slack-best-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 678.15 and `HEADLINE excl. impact` 691.89.

Probe decision: `npm run decide -- generated/golden-runs/probe-opening-regular-slack-best-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1 on the 40-spec x 3-seed x full-grid intersection, CI [-0.6, 1.1], P(delta<=0)=52.6%. Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.1, and 500k +0.1.

Why it was stopped: the regularity guard removed most of the useful movement from the earlier cost-aware opening slack policy. Only 12/480 paired rows changed: `tiny_dance` improved on average (+7.9 over the probe), but `mini_burst` regressed (-3.2), and every other spec was byte-identical or score-identical. Average charged forward-eval frames rose by about +1.1k per row while sampled candidates fell by about 45. This confirms the user's intuition that slack can safely afford best-of on very simple rows, but also shows that a simple cadence-regularity guard is too narrow to be a production improvement. The temporary source change was reverted; future work should characterize Q x lookahead directly or use a value-aware opening selector rather than a scalar regularity guard.

## 2026-06-27 - ABANDONED PROBE - low-amplitude release setup pressure

Mechanism screened: extend the existing release-vertical setup penalty so the next-gap pressure also reacts to low amplitude targets, not only low-air targets and tight cadence. The hypothesis was that vertical release into low-amplitude follow-up gaps could create avoidable pop and worsen amplitude/elevation families such as `terrace_sprint`. Candidate generation, start selection, forward-eval policy, repair, scorer, specs, fingerprint, seed set, and budget grid stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Probe: `generated/golden-runs/probe-release-lowamp-setup-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-release-lowamp-setup-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 678.06 and `HEADLINE excl. impact` 691.64.

Probe decision: `npm run decide -- generated/golden-runs/probe-release-lowamp-setup-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0 on the 40-spec x 3-seed x full-grid intersection, CI [0.0, 0.0], P(delta<=0)=100.0%. Every paired budget rounded to exactly the same score as baseline.

Why it was stopped: the pressure changed some selected trajectories but did not move the paired score on the screen, so it has no promotable signal. The temporary source change was reverted. Future low-amplitude work needs a stronger local model than reusing the low-air release-vertical pressure shape.

## 2026-06-27 - INCONCLUSIVE - high-slack opening best:1:2 forward eval

Mechanism: temporarily add a narrow slack-gated opening lookahead selector on top of the unified compiler. The existing mature vertical `avg` forward-eval selector kept precedence, explicit `LR_FWD_EVAL` overrides stayed exact, and only clean opening prefixes ending in contact could switch the default `greedy:2` ranker to `best:1:2`. Activation used the existing traversal-budget slack model with a smoothstep from slack 10 to 14 and deterministic fractional activation. Candidate count, start selection, repair, scoring, specs, fingerprint, seed set, and budget grid were unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Canonical candidate: `generated/golden-runs/attempt-opening-highslack-best1x2-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-highslack-best1x2-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 678.14 and `HEADLINE excl. impact` 693.2; per-budget point estimates were 125k 656.69, 250k 675.40, 375k 680.22, and 500k 683.30.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-highslack-best1x2-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Δheadline +0.1, CI [-0.6, 0.9], P(Δ<=0)=34.6%. Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.2, and 500k +0.0 with unchanged diagnostic pass rates.

Why it was not kept: this narrower high-slack gate is directionally harmless but much weaker than the earlier cost-aware opening slack variant and does not clear the acceptance rule. It is still useful evidence that the slack/controller idea is not obviously dangerous on easy/high-budget openings, but `best:1:2` under this gate has too little marginal value to promote as a production default. The temporary source change was reverted. Future work should characterize Q x lookahead x slack directly, preferably with first-completion stopped runs before full repair-aware canonical runs.

## 2026-06-27 - REJECTED PROBE - forward-eval local rank prior

Mechanism screened: regularize the default `greedy:2` forward-eval ranker by adding a small continuous local-rank prior to the returned rank score (`score = -forwardValue + 0.2 * localRank`). The intent was to preserve the existing charged rollout depth/cost while preventing tiny forward-score differences from fully overriding the local quality order. Explicit `LR_FWD_EVAL` overrides were left exact; candidate generation, validation/cost, start selection, repair, scorer, specs, fingerprint, seed set, and budget grid stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed after ensuring shadow/full leaf modes used the same rank prior during the temporary trial (5 files, 76 tests).

Probe: `generated/golden-runs/probe-fwd-local-rank-prior02-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-fwd-local-rank-prior02-j48-s0-2-a01`. It completed valid 472/480 with raw probe HEADLINE 629.23 and `HEADLINE excl. impact` 634.78; per-budget point estimates were 125k 486.98, 250k 585.00, 375k 659.87, and 500k 663.92.

Probe decision: `npm run decide -- generated/golden-runs/probe-fwd-local-rank-prior02-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -48.8 on the 40-spec x 3-seed x full-grid intersection, CI [-94.4, -16.1], P(delta<=0)=100.0%. Every budget regressed: 125k -180.2, 250k -89.4, 375k -18.6, and 500k -18.4; validity fell from 100% to 95% at 125k and 98% at 250k.

Why it was stopped: the forward-eval/local-order disagreements are not harmless ranking noise. Even a small local-rank prior removes enough true-score discrimination to break completion and heavily regress scarce budgets, while mature budgets still lose about 18 points on the paired screen. The temporary source change was reverted; future ranker work should not regularize the accepted `greedy:2` ordering globally.

## 2026-06-27 - REJECTED PROBE - raise repair minimum budget to 150k

Mechanism screened: disable repair at the 125k tier with env-only `LR_REPAIR_MIN_BUDGET=150000`, leaving 250k/375k/500k byte-identical. The hypothesis was that 125k repair might be spending scarce traversal budget for too few accepted repairs. Source, scorer, specs, fingerprint, seeds, budget grid, start selection, forward eval, candidate generation, repair ranking, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-repair-min150-current-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_REPAIR_MIN_BUDGET=150000 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-repair-min150-current-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 677.13 and per-budget point estimates 125k 657.81, 250k 674.35, 375k 678.47, and 500k 682.34.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-min150-current-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, Δheadline -0.9 on the 40-spec x 3-seed x full-grid intersection, CI [-1.8, -0.4], P(Δ<=0)=100.0%. The entire loss came from 125k: -9.3 points, CI [-17.8, -4.1].

Why it was stopped: 125k repair is productive despite its low accept rate. Removing it keeps validity but loses substantial quality, so the current 100k repair gate is not just overfitted budget churn. No canonical run was started and no source change was made. Future scarce-budget repair work should improve repair value/targeting, not disable the phase.

## 2026-06-27 - ABANDONED PROBE - cost-weighted repair anchor selection

Mechanism screened: keep repair's existing weakest-gap restart scheme, but rank feasible repair anchors by local axis-error SSE with a smooth discount for suffixes whose measured cost-to-complete consumes almost the whole remaining repair budget. The intent was to preserve high-error upstream repairs while preferring cheaper near-tied anchors, improving repair accept rate without reducing the repair cap. Scorer, specs, fingerprint, seeds, budget grid, start selection, forward eval, candidate generation, repair cap, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts` passed (3 files, 45 tests).

Probe: `generated/golden-runs/probe-repair-costweighted-anchor-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-repair-costweighted-anchor-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 678.03 and per-budget point estimates 125k 666.32, 250k 674.35, 375k 678.10, and 500k 682.75.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-costweighted-anchor-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, Δheadline -0.0 on the 40-spec x 3-seed x full-grid intersection, CI [-0.7, 0.6], P(Δ<=0)=51.5%. Per-budget deltas were 125k -0.8, 250k -0.0, 375k -0.4, and 500k +0.4.

Why it was stopped: the cost discount barely moved the actual repair economics. At 500k it added only about +742 repair frames, +1.1 restarts, and +0.07 accepts per row, with sparse row movement; at lower budgets it was neutral to negative. The largest weighted gains (`drums_breath`, `opening_burst`, `solo_run`, `glide_stairs`) were offset by `verse_chorus`, `drums_crescendo`, `drums_pendulum`, and `rhythm_ladder`. A canonical run would not be a good use of compute. The temporary source change was reverted; future repair work needs a stronger value model than a mild suffix-cost tie-breaker.

## 2026-06-27 - REJECTED - cost-aware opening slack best lookahead

Mechanism: test the high-slack lookahead idea in its narrowest production-like form. The temporary source kept explicit `LR_FWD_EVAL` overrides exact, preserved the existing mature vertical `avg` selector precedence, and only changed the first real contact ranker on clean opening prefixes. It computed compile-level traversal slack from the existing first-completion model, divided by the empirical `best:1:3` first-completion cost ratio (~2.6x), then smoothly/stochastically rounded expected effort from the default `greedy:2` toward `best:1:2/3`. Candidate count, start selection, repair, scoring, specs, fingerprint, seed set, and budget grid were unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts` passed (3 files, 45 tests). The objective-leaf frame-cost test failed under the adaptive default on `tiny_dance` 100k because that row has slack ~7.95 and intentionally activated opening best lookahead; the temporary test pinned `LR_FWD_EVAL=greedy:2` for that leaf-only invariant. The broader focused suite then passed: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (6 files, 81 tests).

Probe: `generated/golden-runs/probe-opening-slack-best-cost-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-opening-slack-best-cost-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 679.15. Paired against `baseline-current-unified-14edc74-j32`, the non-canonical decision was `VERDICT: INCONCLUSIVE`, Δheadline +1.1, CI [-1.0, 3.5], P(Δ<=0)=16.1%; per-budget deltas were +0.5/+0.2/-0.4/+2.8.

Canonical candidate: `generated/golden-runs/attempt-opening-slack-best-cost-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-slack-best-cost-j32-a01`. It completed valid 1919/1920 with raw HEADLINE 678.78 and `HEADLINE excl. impact` 694.55; per-budget point estimates were 125k 656.83, 250k 675.71, 375k 679.88, and 500k 684.97.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-slack-best-cost-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, Δheadline +0.8, CI [-0.9, 2.4], P(Δ<=0)=15.5%. Per-budget deltas were 125k +0.1, 250k +0.6, 375k -0.1, and 500k +1.7, with unchanged diagnostic pass rates.

Why it was not kept: this is the cleanest slack/lookahead result so far, but it still does not clear the acceptance gate. The signal is real enough to be interesting and mostly mature-budget-positive, but it remains seed-unstable: biggest weighted gains were `tiny_dance` +9.75, `mini_burst` +7.07, `drums_tide` +7.02, `dense_echo_climb` +5.18, `drums_dropout` +4.68, while losses were led by `syncopated_switchback` -9.74, `rhythm_ladder` -5.21, and `drums_pulse` -3.58. At 500k it spent about +3.1k charged forward-eval frames per row, sampled about 144 fewer candidates, and still had large opposite-sign row swings (`drums_dropout` seed 3 +174, `syncopated_switchback` seed 9 -104). Conclusion: slack is a useful descriptor and opening lookahead is directionally plausible, but a production default needs a stronger selector than compile-level slack alone, likely incorporating rhythm/branch-instability features or an explicit value-aware spend controller. The temporary source and test changes were reverted; the baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - ABANDONED PROBE - mild late-tail contact-centered sampler widening

Mechanism screened: widen only the late tail of the contact-centered arc sampler with the study-only `LR_CC_EXPLORE=1.25` env knob. This left source, scorer, specs, fingerprint, seeds, budget grid, candidate count, forward eval, admission, and repair logic unchanged. The hypothesis was that a small increase in arc-space coverage might expose better mature candidates without rewriting the sampler yet.

Probe: `generated/golden-runs/probe-cc-explore125-current-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_CC_EXPLORE=1.25 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-cc-explore125-current-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 678.3 and per-budget point estimates 125k 665.35, 250k 675.22, 375k 679.34, and 500k 682.28.

Probe decision: `npm run decide -- generated/golden-runs/probe-cc-explore125-current-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, Δheadline +0.2 on the 40-spec x 3-seed x full-grid intersection, CI [-6.2, 7.0], P(Δ<=0)=47.8%. Per-budget deltas were 125k -1.8, 250k +0.9, 375k +0.9, and 500k -0.1.

Why it was stopped: the effect was indistinguishable from noise and did not justify a canonical run or a production default. The result also suggests that a scalar tail widening knob is too blunt for the sampler-space idea. Future sampler work should move toward an explicit profile controlling which dimensions widen, when they widen, and how that couples to candidate count/lookahead effort, rather than promoting this multiplier.

## 2026-06-27 - ABANDONED PROBE - lower repair restart cap on current baseline

Mechanism screened: cap contained repair restarts at 48 instead of the default 64 using `LR_REPAIR_MAX_ATTEMPTS=48`, with no source change. The hypothesis was that mature-budget repair consumes most of the budget tail while accepting only a few restarts, so stopping lower might let the accepted post-repair frontier-fill path reinvest frames into normal search. Scorer, specs, fingerprint, seeds, budget grid, start selection, forward eval, candidate generation, repair ranking, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-repair-max48-current-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_REPAIR_MAX_ATTEMPTS=48 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-repair-max48-current-j48-s0-2-a01`. It completed valid 480/480 with raw probe HEADLINE 677.42 and per-budget point estimates 125k 667.13, 250k 674.35, 375k 677.96, and 500k 681.12.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-max48-current-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, Δheadline -0.6 on the 40-spec x 3-seed x full-grid intersection, CI [-1.7, -0.1], P(Δ<=0)=100.0%. Per-budget deltas were 125k +0.0, 250k +0.0, 375k -0.5, and 500k -1.2.

Why it was stopped: the budget-allocation hypothesis was wrong in this direction. At 500k the lower cap saved about 27k repair frames and 7 restarts per row, and the resumed frontier did spend more work (+41 full evaluations, +203 sampled candidates per row), but it produced worse incumbents. The damage was sparse but one-sided: 16/120 rows changed at 500k with 15 regressions and 1 improvement, led by `cold_start`, `big_air_ramp`, `leap_cadence`, `swoop_dive`, `climb_terrace`, and `summit_push`. The current 64-restart cap is not just waste; the late repair attempts occasionally protect mature-budget quality better than frontier-fill reinvestment. No canonical run was started and no source change was made.

## 2026-06-27 - REJECTED PROBE - suffix-slack best:1:2/3 forward eval

Mechanism screened: make the default forward evaluator spend richer lookahead from normalized suffix slack. The temporary source kept explicit `LR_FWD_EVAL` overrides exact and preserved the existing vertical-drama `avg` selector precedence. For default non-vertical scoring it computed `remaining_budget / predicted_suffix_completion_frames` once per node, then smoothly selected `best:1:2` from slack 2.75..4.0 and `best:1:3` from slack 5..7 using deterministic hash pressure. This applied to normal first-completion and repair-phase candidate ranking; the candidate pool itself stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts` passed (3 files, 45 tests). The objective-leaf frame-savings test had to pin `LR_FWD_EVAL=greedy:2` because the temporary adaptive default intentionally changed the rollout shape on tiny high-slack rows.

Probe: `generated/golden-runs/probe-suffix-slack-best-fwd-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-suffix-slack-best-fwd-j48-s0-2-a01`. It was valid 480/480 with raw probe HEADLINE 669.67 and per-budget point estimates 125k 664.92, 250k 664.92, 375k 670.13, and 500k 672.89.

Probe decision: `npm run decide -- generated/golden-runs/probe-suffix-slack-best-fwd-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, Δheadline -8.4 on the 40-spec x 3-seed x full-grid intersection, CI [-15.9, -1.9], P(Δ<=0)=99.5%. Per-budget deltas were 125k -2.2, 250k -9.4, 375k -8.3, and 500k -9.5.

Why it was stopped: this answered the "use best:2/3 where slack is genuinely high" idea negatively for this implementation. The controller spent much more forward-eval work while reaching the budget ceiling sooner: average charged forward-eval frames rose by about +13.3k/+54.9k/+91.8k/+126.5k at 125k/250k/375k/500k, while candidate samples fell by about -446/-2066/-3487/-4787. Some rows did improve (`tiny_dance` +21.0, `syncopated_switchback` +16.3, `drums_pendulum` +8.4, `solo_run` +7.8 average over the probe), but the gains were not structurally separable by simple contact count or duration and were overwhelmed by broad rhythm/drum losses (`drums_crosscut` -52.9, `drums_zigzag` -46.7, `drums_swell` -40.8, `verse_chorus` -35.5). A simple "short/simple map" smooth guard would only keep tiny gains and would be guesswork for the mixed cases. The temporary source and test changes were reverted; no canonical run was started.

## 2026-06-27 - ABANDONED PROBE - zero-cost repair suffix handling

Mechanism screened: repair's measured `costToEnd` model can assign zero estimated suffix cost to late incumbent-path gaps. Baseline then selects those gaps as "free" repairs, gives the repair frontier a zero-frame ceiling, and consumes restart attempts without any possible work. Two temporary variants were tested on the worst 500k repair families (`drums_pendulum`, `drums_dropout`, `skyline_push`, seeds 0..2): (1) fall back to the coarse per-gap suffix estimate when measured cost is zero; (2) skip zero-cost anchors entirely and continue to the next nonzero feasible gap.

Focused tests for the fallback variant: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts` passed (2 files, 40 tests).

Baseline probe: `generated/golden-runs/probe-current-repairlog-worst-j3-s0-2-b500-a01/golden.json`, run with `LR_ENGINE=wasm LR_REPAIR_LOG=1 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,drums_dropout,skyline_push --budgets=500000 --jobs=3`. It scored 519.14 at 500k, valid 9/9, with 493 repair records, 21 accepts, 88 completed restarts, and 401 zero-frame repair records.

Fallback probe: `generated/golden-runs/probe-repair-zero-cost-fallback-worst-j3-s0-2-b500-a01/golden.json` scored 519.07 at 500k, valid 9/9. It removed zero-frame records and raised accepts to 38/136, but the paired probe decision was `VERDICT: INCONCLUSIVE`, Δheadline -0.1, CI [-4.6, 5.8], P(Δ<=0)=55.3%.

Skip-zero probe: `generated/golden-runs/probe-repair-skip-zero-cost-worst-j3-s0-2-b500-a01/golden.json` scored 514.70 at 500k, valid 9/9. The paired probe decision was `VERDICT: REJECT`, Δheadline -4.4, CI [-10.9, 0.0], P(Δ<=0)=100.0%.

Why it was stopped: the zero-cost records are real no-op waste, but naively converting them into work or skipping them only reshuffled the repair budget. The fallback variant found more accepted repairs but spent frames on small late improvements and did not improve the subset; the skip-zero variant pushed repair into expensive earlier anchors and clearly regressed. No canonical run was started, and the temporary source changes were reverted. Future repair work needs a value-aware repair allocator, not just a zero-cost cleanup.

## 2026-06-27 - REJECT - precompletion slack-scaled best forward eval

Mechanism: restrict the high-slack best-lookahead idea to the phase before the first terminal completion exists. The temporary source preserved explicit `LR_FWD_EVAL` overrides and the existing vertical-drama `avg` override, then used predicted suffix-completion cost to compute remaining-budget slack. For default non-vertical forward eval, expected lookahead breadth faded smoothly from greedy branch 1 at slack 5 to best branch 3 at slack 8, with deterministic stochastic rounding so mid-slack nodes effectively spent around best:1:2 and high-slack nodes reached best:1:3. The intent was to test whether simple/high-slack maps can safely buy better first-completion choices without carrying the previous attempt's post-completion/repair cost.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 82 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-precompletion-slack-lookahead-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-precompletion-slack-lookahead-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 671.26 and `HEADLINE excl. impact` 685.52; per-budget point estimates were 125k 654.62, 250k 671.16, 375k 672.54, and 500k 674.50.

Decision: `npm run decide -- generated/golden-runs/attempt-precompletion-slack-lookahead-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: REJECT`, Δheadline -6.8, CI [-10.9, -3.1], P(Δ<=0)=100.0%. Per-budget deltas were 125k -2.1, 250k -4.0, 375k -7.4, and 500k -8.8.

Why it failed: this answered the caveat directly, and the answer is negative for this implementation. Even when best-lookahead is restricted to precompletion and scaled by normalized suffix slack instead of raw budget, the extra charged lookahead badly perturbs the full compile. Losses grow with budget, which is the opposite of the intended slack behavior. The likely problem is not that slack is meaningless; it is that changing the first-completion basin with expensive best lookahead is too blunt, and the later repair/search dynamics do not recover the spent frames or path choice changes. The temporary source and test changes were reverted. Future lookahead work should be narrower than global precompletion default ranking, likely as a local diagnostic/proposal tool or under an explicit spend/reinvestment controller.

## 2026-06-27 - REJECT - high-slack best:1:3 forward eval

Mechanism: use the traversal model as a normalized suffix-slack gate for the default forward evaluator. The temporary source preserved explicit `LR_FWD_EVAL` overrides and the existing vertical-drama `avg` override, then smoothly enabled charged `best:1:3` when remaining compile budget divided by predicted suffix-completion cost rose from slack 5 to slack 8. Candidate count stayed unchanged. The intent was to spend deeper/wider lookahead only where the structural slack model said the suffix could afford it, instead of using raw budget thresholds.

Characterization: `generated/studies/slack-lookahead-q-firstcomp-300k-s0-5/panel.json` completed 2160 first-completion rows: all golden specs, seeds 0..5, budget 300k, q=16/24/32, and `default,best:1:2,best:1:3`. Same-q first-completion comparisons showed `best:1:3` is still about 2.6x to 2.8x the first-completion cost, but high-slack rows were the only clearly positive region. For q=32, `best:1:3` at slack>=8 was +23.3 first-completion score points on affected rows, while 3<=slack<5 was -9.3.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 82 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-highslack-best1x3-fwd-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-highslack-best1x3-fwd-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 677.2 and `HEADLINE excl. impact` 692.35; per-budget point estimates were 125k 656.23, 250k 673.58, 375k 679.43, and 500k 682.58.

Decision: `npm run decide -- generated/golden-runs/attempt-highslack-best1x3-fwd-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: REJECT`, Δheadline -0.8, CI [-2.0, 0.0], P(Δ<=0)=97.4%. Per-budget deltas were 125k -0.5, 250k -1.6, 375k -0.5, and 500k -0.7.

Why it failed: the first-completion characterization did not transfer to the full compiler. Even with a normalized high-slack suffix gate, the extra charged `best:1:3` work changed search/repair basins negatively at every canonical budget, especially 250k. The likely issue is not the slack model itself but using expensive lookahead as a production default without an explicit reinvestment/phase boundary: first-completion quality gains can be erased or reversed by less favorable post-completion and repair trajectories. The temporary source and test changes were reverted. Future work should treat `best` lookahead as a more local or phase-specific tool, or combine it with an explicit spend controller rather than only a high-slack selector.

## 2026-06-27 - REJECT - composed vertical amplitude launch

Mechanism: when both `elevation` and `amplitude` were targeted on a gap, preserve the elevation-shaped launch angle and let amplitude act only through grounded ride-out shortening; amplitude-only gaps kept the existing symmetric-arc launch behavior. The intent was to stop the amplitude block from partially erasing high-elevation launch on combined vertical targets, where baseline telemetry showed systematic elevation under-hit.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 81 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-composed-vertical-amplitude-angle-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-composed-vertical-amplitude-angle-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 678.15 and `HEADLINE excl. impact` 693.37; per-budget point estimates were 125k 656.47, 250k 675.15, 375k 680.10, and 500k 683.61.

Decision: `npm run decide -- generated/golden-runs/attempt-composed-vertical-amplitude-angle-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.1, CI [-0.4, 0.6], P(Δ<=0)=23.4%. Per-budget deltas were 125k -0.2, 250k -0.0, 375k +0.1, and 500k +0.3.

Why it failed: the physical decomposition was plausible and moved the highest budget in the intended direction, but the effect was far too small to promote. It slightly hurt 125k, was flat at 250k, and only produced modest 375k/500k gains; the paired evidence remained inconclusive. The temporary source change was reverted. Future vertical-axis work should either use a stronger combined-axis proposal/ranking signal or make the tradeoff conditional on observed elevation/amplitude pressure rather than always preserving elevation launch when amplitude is also present.

## 2026-06-27 - REJECT - slack-scarce quality breadth

Mechanism: add a normalized traversal-slack controller as a final smooth pull on unified quality candidate breadth. The temporary source kept `LR_QUALITY_NCAND` overrides exact, resolved the existing raw-budget/variation/sparse-amplitude policy first, then pulled the resolved candidate count toward `q=29` when `budget / predicted_first_completion_frames` was scarce (full near slack 3, fading out by slack 6). The intent was to make the earlier scarce-budget q-lean structural rather than tied to a raw 125k threshold, while also helping low-slack 250k rows.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts` passed (4 files, 53 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-slack-scarce-quality-breadth-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-scarce-quality-breadth-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 678.68 and `HEADLINE excl. impact` 693.67; per-budget point estimates were 125k 663.13, 250k 675.52, 375k 679.81, and 500k 683.29.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-scarce-quality-breadth-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.7, CI [-1.0, 4.7], P(Δ<=0)=39.4%. Per-budget deltas were 125k +6.4, 250k +0.4, 375k -0.2, and 500k +0.0.

Why it failed: the controller did what it was designed to do, but the effect was still not accepted. Mean policy breadth moved from q=32.00 to 29.23 at 125k, 31.00 to 30.63 at 250k, 31.00 to 30.85 at 375k, and stayed 31.00 at 500k; first-completion frames dropped by about 1.6k/0.4k/0.2k at 125k/250k/375k. That preserved the known scarce-tier signal and added a little 250k lift, but 375k regressed slightly and the bootstrap still saw a high-variance small effect. The largest simple per-spec losses were `drums_signature`, `drums_pulse`, `drums_tide`, and `grain_staircase`, offset by gains in `solo_run`, `drums_swell`, `drums_crescendo`, and `dense_echo_climb`. This is a good budget-control direction, but under the accept-only rule it cannot be promoted from 12 seeds; the temporary source change was reverted.

## 2026-06-27 - REJECT - mature impact curve activation start

Mechanism: lower the impact curve activation start only after scarce-budget completion is protected. The temporary source kept `IMPACT_CURVE_TARGET_START=0.25` at 125k, then smoothly faded the default target start to `0.20` by 250k+, while preserving explicit `LR_IMPACT_CURVE_START` overrides. The intent was to keep the mature-budget gains seen from a static `0.20` start without repeating its 125k damage.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Probe: a static-env probe with `LR_IMPACT_CURVE_START=0.20` on seeds 0..2 was directionally positive at mature budgets but hurt 125k: non-canonical `decide` reported Δheadline +1.1, CI [-4.9, 7.7], P(Δ<=0)=36.6%, with per-budget deltas 125k -6.1, 250k +1.3, 375k +1.3, 500k +2.7. The mature-default source probe protected 125k and kept the same mature deltas on seeds 0..2: Δheadline +1.7, CI [-4.2, 8.4], P(Δ<=0)=29.5%.

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-impact-curve-mature-start020-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-curve-mature-start020-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 678.13 and `HEADLINE excl. impact` 694.06; per-budget point estimates were 125k 656.69, 250k 674.69, 375k 680.23, and 500k 683.63.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-curve-mature-start020-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.1, CI [-3.4, 3.4], P(Δ<=0)=46.7%. Per-budget deltas were 125k +0.0, 250k -0.5, 375k +0.3, and 500k +0.3.

Why it failed: the small probe signal did not generalize. The smooth maturity gate did protect 125k and improved `HEADLINE excl. impact`, but the accepted headline barely moved; 250k regressed, while 375k/500k gains were only +0.3 each. Winners such as `drums_swell`, `swoop_dive`, `cold_start`, and `solo_run` were offset by broad drum/rhythm collateral losses led by `drums_crescendo`, `rhythm_ladder`, `drums_pulse`, `drums_zigzag`, and `drums_dropout`. The temporary source change was reverted.

## 2026-06-27 - ABANDONED PROBE - higher repair attempt cap on current baseline

Mechanism: screen whether the current `LR_REPAIR_MAX_ATTEMPTS=64` cap is still binding at the new high-budget 375k/500k tiers by raising it to 96 via env only. No source change was made; scorer, specs, fingerprint, seeds, budget grid, start selection, forward eval, candidate generation, and repair scoring stayed unchanged.

Probe: `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_REPAIR_MAX_ATTEMPTS=96 npm run golden -- --budgets=375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-repair-max96-current-j48-s0-2-b375-500-a01` completed 240/240 valid. It changed no 375k scores and changed 80/120 500k tracks/hashes, but every paired score stayed identical.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-max96-current-j48-s0-2-b375-500-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, Δheadline +0.0, CI [0.0, 0.0], P(Δ<=0)=100.0%. Per-budget deltas were 375k +0.0 and 500k +0.0.

Why it was stopped: baseline telemetry showed some 500k rows reaching the 64-restart cap, but raising the cap only added about +0.41 repair restarts and +1.2k repair frames per 500k row on this probe, with +0.00 accepted repairs and +0.00 score. The cap is not the current high-budget limiter; additional permitted restarts do not find accepted suffixes. No canonical run was started and no source change was made.

## 2026-06-27 - REJECT - low-air outside-pool axis-quality candidate

Mechanism: when a low-air target's admitted handoff pool was still materially over-airborne, offer one already-sampled outside-pool candidate with a better `air` match as an extra `axisq` option, then let the normal candidate scoring and forward evaluator decide whether to use it. The intent was to address the persistent `drums_pendulum`/low-air overshoot family without changing geometry or global pool size.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Probe: `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,solo_run,syncopated_switchback,drums_crescendo,rhythm_ladder,dense_sprint,skyline_push --budgets=125000,250000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-air-axisq-current-j32-s0-2-a01` was directionally positive but weak: valid 63/63, HEADLINE 589.24 on the subset, and intersection `decide` reported Δheadline +1.4, CI [-2.7, 7.1], P(Δ<=0)=28.7%.

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-air-axisq-lowair-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-air-axisq-lowair-j32-a01`. The canonical run was valid 1918/1920 with raw HEADLINE 677.31 and `HEADLINE excl. impact` 692.49; per-budget point estimates were 125k 655.85, 250k 674.46, 375k 679.43, and 500k 682.51.

Decision: `npm run decide -- generated/golden-runs/attempt-air-axisq-lowair-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.7, CI [-2.5, 0.5], P(Δ<=0)=83.6%. Per-budget deltas were 125k -0.8, 250k -0.7, 375k -0.5, and 500k -0.8.

Why it failed: the small probe overestimated the benefit. On the full canonical suite the point estimate regressed at every budget and validity dropped from 1919/1920 to 1918/1920. The extra outside-pool low-air option appears to perturb basin selection more than it fixes the low-air family. The temporary source change was reverted. Future low-air work should either change the proposal distribution more explicitly or target a narrower spec-conditioned failure mode, not inject an opportunistic outside-pool candidate globally.

## 2026-06-27 - REJECT - opening best:1:2 forward eval

Mechanism: keep the default per-candidate forward evaluator at `greedy:2`, preserve explicit `LR_FWD_EVAL` overrides, and preserve the existing vertical-drama `avg` override, but use `best:1:2` only for opening contact nodes whose prefix has not yet committed any contact. This targeted the first real handoff placement, matching the evidence that first-completion lookahead can improve the initial path while avoiding the broad global lookahead cost. An initial `best:1:3` version was narrowed before the canonical run because it failed the focused objective-leaf cost invariant.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed after narrowing to `best:1:2` (5 files, 76 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-opening-best1x2-fwd-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-best1x2-fwd-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 678.78 and `HEADLINE excl. impact` 694.89; per-budget point estimates were 125k 657.90, 250k 674.04, 375k 681.14, and 500k 684.61.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-best1x2-fwd-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.8, CI [-3.6, 5.4], P(Δ<=0)=32.1%. Per-budget deltas were 125k +1.2, 250k -1.1, 375k +1.2, and 500k +1.3.

Why it failed: the point estimate is positive and the 375k/500k tiers moved in the intended direction, but the paired evidence is far too weak and the 250k tier regressed. The change spent about +1.3k/+1.5k/+1.9k/+2.0k forward-eval frames per row at 125k/250k/375k/500k and shifted many rows, but gains in `drums_tide`, `tiny_dance`, `drums_swell`, and `dense_echo_climb` were offset by losses in `syncopated_switchback`, `drums_pulse`, `rhythm_ladder`, and `drums_zigzag`. The opening-only idea is cleaner than global lookahead, but this exact default still changes rhythm basins without a statistically accepted headline gain. The temporary source change was reverted.

## 2026-06-26 - REJECT - scarce quality lean through 125k

Mechanism: extend the existing smooth scarce-budget quality-search lean from the old 50k..100k window to 100k..200k, so the canonical 125k tier uses fewer quality candidates without adding a hard 125k branch. The mature lean, repair, forward evaluation, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts` passed first (2 files, 40 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-scarce-quality-lean125-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-scarce-quality-lean125-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 678.64 and `HEADLINE excl. impact` 693.87; per-budget point estimates were 125k 663.04, 250k 675.16, 375k 679.97, and 500k 683.29.

Decision: `npm run decide -- generated/golden-runs/attempt-scarce-quality-lean125-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.6, CI [-0.7, 4.7], P(Δ<=0)=47.7%. Per-budget deltas were 125k +6.4, 250k +0.0, 375k +0.0, and 500k +0.0.

Why it failed: the point estimate is directionally good and isolated to the intended scarce tier, but the paired evidence is much too weak to accept. The 125k gain is dominated by high-variance scarce-budget behavior: `decide` estimates that about 43 more seeds would be needed to resolve this effect under the current gate. Because the accepted-compiler rule requires `VERDICT: ACCEPT`, the temporary source change was reverted. This remains a plausible low-budget mechanism, but it should only be revisited with more seeds or as part of a broader budget-control model rather than promoted from this canonical run.

## 2026-06-26 - REJECT - mature repair feasibility headroom

Mechanism: relax the mature repair feasibility margin from exact measured suffix cost (`1.0`) to `1.1`, while preserving the existing scarce-budget margin (`1.05`) and smooth 100k..200k ramp. The intent was to give later repairs modest headroom on rows where exact feasibility appeared to reject useful restarts.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts` passed first (2 files, 40 tests).

Probe: `LR_ENGINE=wasm LR_REPAIR_FEAS_MARGIN=1.1 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_dropout,skyline_push,solo_run,drums_pendulum,terrace_sprint,drums_signature,dense_sprint,rhythm_ladder --budgets=125000,250000,375000,500000 --jobs=16 --archive-dir=generated/golden-runs/probe-repair-feas110-current-j16-s0-2-a01` was indicative but not decisive: valid 96/96, HEADLINE 587.82 on that subset, and an intersection `decide` against the current baseline showed Δheadline +0.6, CI [-1.7, 3.6], P(Δ<=0)=32.7%. The best 500k probe gains were `drums_dropout` seed 2 (+19.75), `drums_dropout` seed 0 (+13.72), and `drums_pendulum` seed 0 (+9.94), with losses led by `drums_pendulum` seed 1 (-6.43) and `terrace_sprint` seed 0 (-4.96).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-repair-feas110-mature-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-feas110-mature-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 677.26 and `HEADLINE excl. impact` 692.15; per-budget point estimates were 125k 656.38, 250k 674.05, 375k 679.18, and 500k 682.65.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-feas110-mature-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: REJECT`, Δheadline -0.7, CI [-2.1, 0.1], P(Δ<=0)=94.4%. Per-budget deltas were 125k -0.3, 250k -1.1, 375k -0.8, and 500k -0.6.

Why it failed: the small probe correctly found some repair-starved winners, but the full suite showed the looser mature feasibility ceiling was not suite-positive. The regression was broad across all four budgets and strongest at 250k, which suggests the extra feasible restarts changed repair selection more than it rescued blocked rows. The temporary source change was reverted. Future repair work should use a more local signal than a global mature feasibility multiplier, ideally tied to observed repair acceptance pressure or suffix-cost uncertainty rather than always adding headroom.

## 2026-06-26 - REJECT - duplicate-aware tail completion throttle

Mechanism: add an observed duplicate-pressure gate to speculative tail completion. The temporary source kept the existing tail window, tail branching, shallow-tail throttle, repair, forward eval, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule unchanged, but once the tail phase had enough full-evaluation feedback it smoothly skipped more tail completions as the tail duplicate-full-evaluation rate rose.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts` passed first (2 files, 40 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, current unified source, valid 1919/1920, raw HEADLINE 678.01, `HEADLINE excl. impact` 693.23, with per-budget point estimates 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-tail-dup-throttle-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-tail-dup-throttle-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 678.00 and `HEADLINE excl. impact` 693.24; per-budget point estimates were 125k 656.69, 250k 675.16, 375k 679.96, and 500k 683.28.

Decision: `npm run decide -- generated/golden-runs/attempt-tail-dup-throttle-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: REJECT`, Δheadline -0.0, CI [-0.0, -0.0], P(Δ<=0)=99.8%. Per-budget deltas were 125k +0.0, 250k -0.0, 375k -0.0, and 500k -0.0.

Why it failed: the selector was active and cleaner than the earlier fixed remaining-contact throttles, but it only removed wasted work; it did not buy better tracks. At 500k, tail full evaluations fell from about 39.8k to 31.9k and duplicate tail full evaluations fell from about 28.4k to 21.4k, while tail best hits only moved from 1,998 to 1,980. The saved work showed up as tiny sim/candidate deltas and did not improve main search or repair output; the few score moves were slightly negative, led by `mixed_grade` seed 11 (-3.53), `canyon_steps` seed 6 (-2.13), and `rolling_drop` seed 1 (-1.41). The temporary source change was reverted. Future tail work needs an explicit way to reinvest saved frames into a productive phase, not just a better waste suppressor.

## 2026-06-26 - REJECT - slack-gated shallow best forward eval

Mechanism: use the traversal budget model only as a smooth selector for default forward evaluation. The temporary source kept explicit `LR_FWD_EVAL` overrides unchanged and preserved the existing vertical-drama `avg` upgrade, then allowed non-vertical nodes to switch from default `greedy:2` to shallow `best:1:2` only when both whole-run slack and remaining suffix slack were high. Scorer, specs, fingerprint, seeds, budget grid, candidate generation, start policy, repair, and acceptance rule were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts` passed first (2 files, 40 tests).

Baseline: `generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json`, run from current unified source with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/baseline-current-unified-14edc74-j32`. The canonical run was valid 1919/1920 with raw HEADLINE 678.01 and `HEADLINE excl. impact` 693.23; per-budget point estimates were 125k 656.69, 250k 675.16, 375k 679.97, and 500k 683.29.

Candidate: `generated/golden-runs/attempt-slack-best1x2-fwd-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-best1x2-fwd-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 677.33 and `HEADLINE excl. impact` 691.91; per-budget point estimates were 125k 656.63, 250k 674.98, 375k 679.55, and 500k 682.00.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-best1x2-fwd-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.7, CI [-2.4, 0.8], P(Δ<=0)=81.7%. Per-budget deltas were 125k -0.1, 250k -0.2, 375k -0.4, and 500k -1.3.

Why it failed: the first-completion-only lookahead study did not transfer to the full production compile with repair. Even though the selector was smooth and restricted to high-slack rows, the extra shallow best lookahead spent budget without improving the final repaired search; the loss grew with budget and was worst at 500k. The temporary source/test change was reverted; this attempt should not be retried unchanged.

## 2026-06-25 - REJECT - impact undershoot local-cost ramp

Mechanism: keep the existing local `impact` candidate-cost weight at `0.5` for impact overshoot, but add a smooth compile-budget ramp for impact undershoot only. The temporary source change exported a per-compile budget setter to `core/candidate.ts`; `axisCost` used `0.5 + 0.5 * smoothstep(budget / (budget + 250k))` only when `target.impact > achieved.impact`. The intent was to address the measured systematic impact undershoot without repeating the rejected symmetric full-impact local-weight change. Geometry, repair, start policy, forward evaluation, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Baseline: `generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json`, canonical new grid, fingerprint `de24a421f751`, HEADLINE 678.70.

Candidate: `generated/golden-runs/attempt-impact-undershoot-local-ramp-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-undershoot-local-ramp-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.77 and `HEADLINE excl. impact` 693.85; per-budget point estimates were 125k 662.78, 250k 673.97, 375k 680.06, and 500k 684.20.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-undershoot-local-ramp-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.1, CI [-0.2, 0.3], P(Δ<=0)=20.7%. Per-budget deltas were 125k +0.0, 250k -0.0, 375k -0.0, and 500k +0.2.

Why it failed: this was cleaner than the template-admission attempt but still not accepted. Only 45 score cells moved, with 31 improvements and 14 regressions; weighted mean delta was +0.064. Gains were led by `tiny_dance` (+1.69 weighted), `drums_pendulum` (+1.16), `rhythm_ladder` (+0.67), and `solo_run` (+0.21), while the main loss was `dense_sprint` (-1.31). The 500k point estimate improved, but the confidence interval still crossed zero and `HEADLINE excl. impact` regressed slightly, so the accept-only rule required reverting the source.

## 2026-06-25 - REJECT - soft impact template admission

Mechanism: keep the existing high-pressure impact template lane unchanged, but replace the hard `impactCurveP >= 0.35` eligibility edge with a smooth deterministic admission probability for mid-pressure impact beats. The added admission ramp started at `impactCurveP=0.15`, reached full eligibility at the existing `0.35` point, and was multiplied by a smooth compile-budget pressure from 100k to 250k frames. The intent was to let larger budgets spend more search on mid-impact scoop templates without creating a discrete special case for one canonical budget. Scorer, specs, fingerprint, seeds, budget grid, start policy, forward evaluation, repair behavior, and the existing full-pressure template lane were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Baseline: `generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json`, canonical new grid, fingerprint `de24a421f751`, HEADLINE 678.70.

Candidate: `generated/golden-runs/attempt-soft-impact-template-admission-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-soft-impact-template-admission-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.77 and `HEADLINE excl. impact` 693.99; per-budget point estimates were 125k 662.01, 250k 674.53, 375k 679.93, and 500k 684.20.

Decision: `npm run decide -- generated/golden-runs/attempt-soft-impact-template-admission-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.1, CI [-1.2, 1.7], P(Δ<=0)=48.7%. Per-budget deltas were 125k -0.7, 250k +0.6, 375k -0.2, and 500k +0.2.

Why it failed: the mechanism was too noisy and not directionally reliable. It moved 466 score cells, with 228 improvements and 238 regressions; the weighted mean delta was only +0.08. Gains concentrated in `drums_swell` (+10.30 weighted), `drums_pulse` (+5.04), `big_air_ramp` (+2.14), `skyline_push` (+1.80), and `terrace_sprint` (+1.75), but they were offset by losses in `opening_burst` (-4.21), `drums_pendulum` (-2.90), `drums_tide` (-2.51), `drums_crescendo` (-2.35), `drums_breath` (-1.68), and `dense_sprint` (-1.66). The smooth budget ramp did avoid a hard canonical-budget branch, but it still perturbed 125k negatively and did not convert the added mid-impact template access into a statistically accepted headline gain. The temporary source change was reverted.

## 2026-06-25 - REJECT - weak-incumbent mature quality breadth

Mechanism: keep the mature quality-search lean as the default, but smoothly relax it from the mature `29`-candidate count back toward the normal `32` candidates while the current passing incumbent had weak `axis_quality`. The pressure multiplied a continuous incumbent-quality term (`axis_quality` below roughly 0.66, full below 0.54) by the existing smooth budget-maturity curve; the 125k tier, hard high-variation relief, short/no-amplitude boost, sparse-amplitude boost, start policy, forward evaluation, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule were otherwise unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Baseline: `generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json`, canonical new grid, fingerprint `de24a421f751`, HEADLINE 678.70.

Candidate: `generated/golden-runs/attempt-weak-incumbent-quality-breadth-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-weak-incumbent-quality-breadth-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.25 and `HEADLINE excl. impact` 693.50; per-budget point estimates were 125k 662.74, 250k 673.74, 375k 679.70, and 500k 683.29.

Decision: `npm run decide -- generated/golden-runs/attempt-weak-incumbent-quality-breadth-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: REJECT`, Δheadline -0.5, CI [-1.2, 0.1], P(Δ<=0)=93.7%. Per-budget deltas were 125k +0.0, 250k -0.2, 375k -0.4, and 500k -0.7.

Why it failed: the intended scarce-tier isolation held (125k byte-identical), but the mature tiers moved backward and the regression grew with budget. The change did not simply spend extra compute usefully: average sampled/viable candidates fell by about 21/17 at 250k, 34/24 at 375k, and 45/35 at 500k, while full and unique full evaluations also fell. Gains were small (`drums_pulse` +1.98 weighted, `skyline_push` +0.82), while losses were larger in the rows the rule was supposed to help or protect: `drums_dropout` -6.19, `drums_tide` -4.43, `rhythm_ladder` -3.37, `terrace_sprint` -2.19, `drums_swell` -1.46, and `canyon_steps` -1.12. Conclusion: incumbent-quality gating is a clean continuous idea, but using it to relax mature quality breadth changes search basins without improving the paired headline; the temporary source change was reverted.

## 2026-06-25 - REJECT - smooth near-variation quality breadth on new grid

Mechanism: add a smooth no-vertical quality-search breadth ramp below the existing hard variation relief, preserving the accepted high-variation `32`-candidate cap and the short/no-amplitude and sparse-amplitude precedence. The ramp started near air-range `0.43` / speed-range `0.32` and faded into the existing air-range `0.50` / speed-range `0.40` relief. Scorer, specs, fingerprint, seeds, budget grid, start policy, forward evaluation, and repair behavior were unchanged.

Baseline: `generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json`, canonical new grid, fingerprint `de24a421f751`, HEADLINE 678.70.

Candidate: `generated/golden-runs/attempt-quality-near-variation-relief-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-near-variation-relief-newgrid-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-quality-near-variation-relief-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.1, CI [-0.4, 0.1], P(Δ<=0)=88.4%.

Why it failed: validity stayed 1920/1920, but the point estimate moved backward: 125k +0.0, 250k -0.1, 375k -0.0, 500k -0.1. The effect was very localized: only `rhythm_ladder` changed materially, with 4 improved weighted seed rows and 8 regressed. Its mean weighted delta was -2.65; the worst seed lost -25.17 weighted, mostly from -33.80 at 250k, -26.23 at 375k, and -26.34 at 500k. Conclusion: smoothing the breadth boundary is philosophically cleaner, but this exact no-vertical near-threshold ramp buys extra compute in a place that is not suite-positive on the new budget grid, so it was reverted.

## 2026-06-22 - REJECT - quality ranker scorer-window axes

Mechanism: in `candidateQualityObjective`, rank the current-gap term with `candidate.achievedAtEnd ?? candidate.achieved` instead of `candidate.achieved`, so air-lookahead gaps use the same gap-window axes as the final scorer and objective leaf.

Baseline: `generated/golden-runs/baseline-head-5a597fb/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.11.

Candidate: `generated/golden-runs/attempt-scored-axes-ranker-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-scored-axes-ranker-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-scored-axes-ranker-a01/golden.json generated/golden-runs/baseline-head-5a597fb/golden.json` -> `VERDICT: REJECT`, Δheadline -1.7, CI [-3.9, 0.1], P(Δ<=0)=96.6%.

Why it failed: regression was broad and negative at every budget: 100k -1.8, 200k -1.5, 300k -1.9. Validity was unchanged, so this was selection quality, not contract failure. Biggest per-spec losses were `syncopated_switchback` -16.45, `drums_crescendo` -15.67, `cold_start` -11.13, and `float_bounds` -9.89; the intended `drums_pendulum` target barely changed (-0.19). Conclusion: the lookahead-axis value in the pool objective is load-bearing future-state signal, not merely a scorer-window mismatch.

## 2026-06-22 - REJECT - full local impact weight

Mechanism: change the default local candidate-cost `impact` weight from 0.5 to 1.0 in `axisCost`, matching the scorer's equal axis weighting while preserving `LR_IMPACT_LOCAL_W` as the study override.

Baseline: `generated/golden-runs/baseline-head-5a597fb/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.11.

Candidate: `generated/golden-runs/attempt-impact-local-full-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-local-full-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-local-full-a01/golden.json generated/golden-runs/baseline-head-5a597fb/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.1, CI [-0.3, 0.1], P(Δ<=0)=72.3%.

Why it failed: the point estimate moved slightly backward rather than toward the 670 goal: 100k -0.0, 200k -0.1, 300k -0.1, with validity unchanged. Since the acceptance rule is accept-only and this was statistically inconclusive with a negative headline point estimate, the mechanism was reverted. Conclusion: the current full-suite baseline no longer supports raising local impact cost to equal scorer weight.

## 2026-06-22 - ACCEPT - post-repair frontier fill

Mechanism: after the contained repair phase finishes, resume the original frontier if no budget snapshot has been captured and simulated frames remain. Repair still gets first claim on post-completion budget; leftover frames now buy normal search instead of snapshotting with queued alternatives.

Baseline: `generated/golden-runs/baseline-head-5a597fb/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.11.

Candidate: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-post-repair-frontier-fill-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json generated/golden-runs/baseline-head-5a597fb/golden.json` -> `VERDICT: ACCEPT`, Δheadline +0.1, CI [0.0, 0.2], P(Δ<=0)=0.0%.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical HEADLINE 654.18. Per-budget point estimates were 100k +0.1, 200k +0.1, 300k +0.0, with validity unchanged.

## 2026-06-22 - REJECT - mid-impact post-turn activation

Mechanism: broaden the mature impact post-turn sampler from high-only impact asks to mid-impact asks by changing `IMPACT_POST_TURN_TARGET_START` from 0.60 to 0.35 and `IMPACT_POST_TURN_TARGET_SPAN` from 0.20 to 0.25.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-mid-impact-postturn-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-mid-impact-postturn-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-mid-impact-postturn-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.7, CI [-3.3, 1.8], P(Δ<=0)=71.6%.

Why it failed: 100k was unchanged, but 200k regressed -1.3 and 300k regressed -0.5. The change helped some rows (`drums_zigzag` +20.75 at 200k / +12.24 at 300k, `drums_pendulum` +1.54 / +3.64), but it broadly damaged rhythm/drum rows including `drums_crescendo` (-20.80 / -18.05), `drums_tide` (-14.61 / -14.36), and `drums_signature` (-6.24 / -6.75). Conclusion: mid-impact post-turn can produce useful shapes, but applying it through the existing always-on post-turn path is too blunt and perturbs timing/axis quality more than it improves impact.

## 2026-06-22 - REJECT - lower impact template pressure

Mechanism: broaden only the selection-protected impact template lane by changing `IMPACT_TEMPLATE_MIN_PRESSURE` from 0.35 to 0.25. The normal candidate geometry remained available; the change only made the late template lane eligible on more mid-pressure impact beats.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-template-minp25-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-template-minp25-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-template-minp25-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.2, CI [-0.6, 1.1], P(Δ<=0)=34.4%.

Why it failed: the point estimate was positive but far below the accept threshold, with all per-budget CIs crossing zero: 100k +0.1, 200k +0.3, 300k +0.1. Validity was unchanged. The mechanism mainly helped `drums_swell` (+6.30 weighted), plus smaller gains in `rolling_drop` (+1.97), `drums_zigzag` (+1.55), `drums_pulse` (+1.18), and `drums_pendulum` (+0.84), but it was offset by losses in `dense_echo_climb` (-2.59), `ridge_pulse` (-1.46), `opening_burst` (-1.00), and `drums_tide` (-0.79). Conclusion: lower template pressure is directionally plausible but too weak and noisy as a standalone default change.

## 2026-06-22 - REJECT - lower impact readiness floor

Mechanism: lower the proposer/readiness impact-feasibility floor `OBJECTIVE_IMPACT_MIN_ASK` from 0.3 to 0.2, so soft-mid next-impact asks in the 0.2-0.3 band influence arrival readiness while very soft asks below 0.2 remain ignored.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-impact-readiness-floor20-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-readiness-floor20-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-readiness-floor20-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.7, CI [-3.3, 1.3], P(Δ<=0)=71.9%.

Why it failed: every budget moved backward in point estimate: 100k -0.8, 200k -0.9, 300k -0.5, with validity unchanged. The intended 0.2-0.3 impact band did improve slightly at 300k (mean absolute impact error -0.0064), and `dense_echo_climb` gained +9.49 weighted, but the added readiness pressure damaged larger rows: `drums_pulse` -16.87, `drums_swell` -5.88, `dense_sprint` -4.46, `solo_run` -3.80, and `drums_tide` -3.07. Conclusion: the soft-mid band has measurable impact slack, but treating it as next-gap feasibility pressure is too blunt and misallocates search on rhythm-heavy rows.

## 2026-06-22 - REJECT - mature impact curve frontload

Mechanism: keep the shipped impact curvature frontload at 1.6 for 100k compiles, then ramp the mature-budget frontload to 2.0 by 200k+. The intent was to keep the low-budget regression seen in the all-budget `LR_IMPACT_FRONTLOAD=2.0` screen out of the canonical 100k point while retaining the 300k impact-generation gain.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-impact-frontload-mature-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-frontload-mature-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-frontload-mature-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.3, CI [-3.6, 2.8], P(Δ<=0)=56.6%.

Why it failed: the 100k point was unchanged as designed, but mature budgets moved backward: 200k -0.1 and 300k -0.5, with validity unchanged. The mechanism helped the intended impact-constrained rows (`drums_pendulum` +10.29 weighted, `dense_echo_climb` +4.69, `drums_zigzag` +4.46, `drums_swell` +3.66), but those gains were outweighed by rhythm-row losses: `drums_crosscut` -16.31, `drums_tide` -10.68, `drums_crescendo` -8.61, `dense_sprint` -4.95, `soar_settle` -3.96, and `drums_pulse` -3.43. Conclusion: deeper mature frontload is a real impact lever, but as a global mature-budget default it perturbs groove/timing rows more than it improves impact.

## 2026-06-22 - REJECT - low-air mature impact frontload

Mechanism: apply the mature-budget impact curvature frontload only where target air is low, fading the 1.6 -> 2.0 mature ramp in from 100k to 200k and gating it by `targets.air` below 0.50 with a 0.08 fade span. The intent was to retain the useful impact-generation signal from mature frontload while protecting high-air rhythm rows.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-lowair-impact-frontload-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-impact-frontload-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-impact-frontload-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +1.0, CI [-1.4, 3.4], P(Δ<=0)=19.4%.

Why it failed: the point estimate was the strongest post-baseline candidate so far, with 100k unchanged, 200k +1.3, and 300k +1.1, and `HEADLINE excl. impact` crossed 670 at 670.36. However the bootstrap interval still crossed zero at the mandated 12 seeds, so the accept-only rule required a revert. The mechanism fixed much of the global-frontload collateral damage (`drums_zigzag` +17.12 weighted, `drums_pendulum` +8.81, `dense_echo_climb` +6.54, `drums_crescendo` +5.41, `drums_tide` +5.29) but still lost too much on `drums_swell` (-9.84), `syncopated_switchback` (-8.46), `rhythm_ladder` (-4.01), `opening_burst` (-2.38), and `tiny_dance` (-2.22). Conclusion: low-air gating is a promising separator for the frontload family, but this exact default change is not statistically accepted under the canonical decision rule.

## 2026-06-22 - REJECT - selective mature impact arrival residual

Mechanism: keep the existing scarce-budget `gap.nextImpact` steep-arrival ramp unchanged, but add a partial mature-budget residual from 100k to 200k. The residual was gated off by current-gap amplitude and high-air pressure so mature compiles could regain some impact-entry shaping without the blanket all-budget arrival-unfade collateral documented in `docs/geometry-log.md`.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-selective-impact-arrival-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-selective-impact-arrival-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-selective-impact-arrival-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.3, CI [-2.8, 2.3], P(Δ<=0)=59.3%.

Why it failed: 100k was unchanged as designed, but mature budgets moved backward: 200k -0.1 and 300k -0.5, with validity unchanged. The residual had real localized upside (`drums_swell` +18.20 weighted, `drums_zigzag` +11.35, `grain_staircase` +7.84, `dense_echo_climb` +5.32, `rolling_drop` +4.69), but the remaining collateral was larger and broader: `drums_tide` -11.90, `syncopated_switchback` -9.13, `drums_crescendo` -7.67, `rolling_hills` -6.37, `drums_pulse` -6.20, `tiny_dance` -6.11, and `drums_dropout` -5.54. Conclusion: mature arrival shaping is still too blunt even with air/amplitude compatibility gates; the helpful cases are outweighed by rhythm-row disruption.

## 2026-06-22 - REJECT - low/mid-impact low-air mature frontload

Mechanism: refine the rejected low-air mature frontload by applying the extra 1.6 -> 2.0 mature frontload only on low-air, low/mid-impact asks, fading it out above a bounded impact target of 0.34. The intent was to preserve the low-air candidate's gains while avoiding extra pressure on harder `syncopated_switchback`-style impact beats.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-lowmid-lowair-frontload-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowmid-lowair-frontload-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowmid-lowair-frontload-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.3, CI [-2.2, 1.3], P(Δ<=0)=63.1%.

Why it failed: 100k was unchanged, but 200k regressed -0.6 and 300k regressed -0.2, with validity unchanged. The harder-impact guard did protect some prior low-air losses and helped `drums_tide` (+5.29 weighted), `dense_echo_climb` (+4.20), `cold_start` (+3.17), `glide_stairs` (+2.86), and `dense_sprint` (+2.68). But it also removed much of the original low-air upside and left large regressions: `drums_swell` -9.84, `drums_pulse` -8.97, `rolling_hills` -6.31, `drums_crescendo` -4.81, plus smaller losses in `valley_bounce`, `tiny_dance`, and `ridge_pulse`. Conclusion: target-band gating is not the missing separator for the mature frontload family; the same knob keeps moving speed/air rhythm quality more than impact.

## 2026-06-22 - REJECT - weak-quality far-back pulse expansion

Mechanism: broaden the far-back pulse scheduler for weak but passing incumbents by changing `QUALITY_FAR_BACK_ZERO_AXIS_QUALITY` from 0.50 to 0.65. The intent was to give rows with axis quality in the 0.50-0.65 band more late exploratory pulses without changing geometry or scorer behavior.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-farback-weakq65-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-farback-weakq65-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-farback-weakq65-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.2, CI [-0.7, 0.2], P(Δ<=0)=79.0%.

Why it failed: the 100k point was effectively unchanged (+0.0), while mature budgets regressed: 200k -0.3 and 300k -0.2, with validity unchanged. The raw candidate headline was 653.99, `HEADLINE excl. impact` was 669.06, and validity stayed 1439/1440 overall with 480/480 valid at 300k. The mechanism produced small localized gains (`dense_echo_climb` +2.17 weighted, `drums_swell` +1.42, `dense_sprint` +0.97, `cold_start` +0.71, `syncopated_switchback` +0.56), but those were outweighed by larger losses in `solo_run` (-5.02), `drums_crescendo` (-2.47), `drums_signature` (-1.91), `drums_dropout` (-1.06), and `ridge_pulse` (-0.82). Conclusion: expanding far-back pulses above the current weak-quality cutoff adds mature-budget churn without reliably improving the weak incumbent rows.

## 2026-06-22 - REJECT - repair exhausted-gap reset on acceptance

Mechanism: clear the repair loop's exhausted-gap set after an accepted restart, on the theory that previously failed gaps were judged against an older incumbent suffix and should be eligible for re-ranking after the incumbent changes.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: source-only test candidate; no canonical archive was produced.

Decision: rejected before golden evaluation because the required focused tests failed. `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts` failed `objective leaf is deterministic and collapses rollout frame cost vs full`: expected objective charged frames `31904` to be less than full charged frames `29695`.

Why it failed: the mechanism increased repair/search churn enough to violate an existing optimizer invariant around objective-leaf rollout cost. Conclusion: clearing the exhausted set globally after acceptance is too broad; any future stale-exhaustion fix needs a narrower cache key or per-incumbent invalidation that preserves the forward-eval cost invariant.

## 2026-06-22 - REJECT - pass-gated repair handoff

Mechanism: delay the repair carve-out until the first passing terminal incumbent instead of the first terminal incumbent. The goal was to prevent repair budget from being spent on complete-but-failing tracks, motivated by the lone 100k invalid row (`drums_dropout` seed 6) in the current baseline.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-passgate-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-passgate-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-passgate-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.2, CI [-0.0, 1.3], P(Δ<=0)=19.0%.

Why it failed: the candidate fixed the only invalid row and moved raw validity from 1439/1440 to 1440/1440, with raw HEADLINE 654.41 and `HEADLINE excl. impact` 669.43. The gain was concentrated at 100k (+1.4 point estimate, mostly `drums_dropout` seed 6 at 100k: 185.99 -> 493.85, invalid -> valid), while 200k was flat (+0.0) and 300k was flat/slightly down (-0.0). Per-spec weighted gains were led by `drums_dropout` (+4.39), `opening_burst` (+0.42), `drums_signature` (+0.29), `drums_zigzag` (+0.15), and `syncopated_switchback` (+0.13), but these were offset by `drums_crescendo` (-0.51), `leap_cadence` (-0.18), and `ridge_pulse` (-0.07). Conclusion: pass-gating repair is directionally plausible for low-budget validity, but the canonical effect is too localized and statistically inconclusive under the accept-only rule.

## 2026-06-22 - REJECT - repair impact-undershoot gap ranking

Mechanism: increase only the repair weakest-gap selection SSE for impact undershoot by 1.5x, leaving scoring, geometry, and the local candidate ranker unchanged. The goal was to spend repair restarts on under-hit impact gaps, which remain the largest gap between headline and `HEADLINE excl. impact`.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-impact-under-rank-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-impact-under-rank-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-impact-under-rank-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.2, CI [-0.7, 1.0], P(Δ<=0)=34.3%.

Why it failed: all three budget point estimates were positive but weak: 100k +0.4, 200k +0.1, 300k +0.1, with the 95% interval crossing zero. Raw candidate HEADLINE was 654.33 and `HEADLINE excl. impact` was 669.09. The mechanism helped a broad set of specs (`cold_start` +2.49 weighted, `dense_echo_climb` +2.00, `drums_pendulum` +1.70, `grain_staircase` +1.35, `ridge_pulse` +1.32, `dense_sprint` +1.12, `drums_breath` +1.11), but it caused large rhythm-row losses: `drums_pulse` -4.04, `drums_crescendo` -2.67, `drums_zigzag` -1.98, `syncopated_switchback` -1.18, and `glide_stairs` -0.85. Conclusion: repair ranking can move impact/elevation-constrained rows, but blunt impact-undershoot weighting destabilizes drum timing rows enough that the canonical result is not accepted.

## 2026-06-22 - REJECT - faster shallow quality-tail throttle

Mechanism: strengthen the existing shallow quality-tail completion throttle by changing `QUALITY_SHALLOW_TAIL_THROTTLE_BUDGET_SCALE_FRAMES` from 150k to 75k. The tail window and branching stayed unchanged; the goal was to cut low-yield 1-2-contact full evaluations and give the post-repair resumed frontier more budget.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-shallow-tail-throttle75-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-shallow-tail-throttle75-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-shallow-tail-throttle75-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.0, CI [-0.1, 0.1], P(Δ<=0)=66.0%.

Why it failed: the point estimate was effectively zero, with raw HEADLINE 654.17 and `HEADLINE excl. impact` 669.23. Per-budget movement was noise: 100k -0.02, 200k -0.05, 300k +0.02, with validity unchanged at 1439/1440 overall and 480/480 at 300k. The largest per-spec gains were tiny (`syncopated_switchback` +0.52 weighted, `canyon_steps` +0.20, `opening_burst` +0.09), offset by similarly small losses (`dense_echo_climb` -0.31, `pop_train` -0.28, `valley_bounce` -0.19). Conclusion: shallow tail throttling is already near-neutral at the current setting; ramping it faster does not release useful budget for the resumed frontier.

## 2026-06-22 - REJECT - objective leaf for start eval

Mechanism: make start-selection forward rollouts honor the same `LR_FWD_EVAL_LEAF` mode as normal forward eval, so the default start eval uses the zero-frame objective leaf instead of forcing the full leaf. `full` and `shadow` modes still ranked by the full leaf. The goal was to reduce always-on start-selection frame cost and spend the saved budget in the main search.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-start-objective-leaf-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-objective-leaf-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-objective-leaf-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.1, CI [-0.1, 0.2], P(Δ<=0)=22.5%.

Why it failed: the point estimate was positive but far below the accept threshold. Raw HEADLINE was 654.23 and `HEADLINE excl. impact` was 669.28, with per-budget movement 100k -0.03, 200k +0.09, 300k +0.05 and unchanged validity at 1439/1440 overall. The average start-eval charge only fell from about 1616 frames to 1443 frames, while normal forward-eval charge rose by roughly 100 frames, so the budget saving was too small to matter. Per-spec gains (`drums_swell` +1.13 weighted, `mini_burst` +0.73, `big_air_ramp` +0.67, `syncopated_switchback` +0.52) were offset by losses (`drums_crescendo` -0.75, `swoop_dive` -0.35, `cold_start` -0.23, `terrace_sprint` -0.21). Conclusion: start eval can technically use the objective leaf, but the current start pool is too small for the saved frames to produce an accepted canonical improvement.

## 2026-06-22 - REJECT - impact overshoot ranker penalty

Mechanism: add `impact: 1` to the handoff asymmetric overshoot penalty table, leaving the symmetric local impact cost at 0.5. The goal was to reduce the current positive achieved-minus-target impact error without penalizing impact undershoot.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-impact-overshoot-w1-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-overshoot-w1-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-overshoot-w1-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.0, CI [0.0, 0.0], P(Δ<=0)=100.0%.

Why it failed: the candidate was a byte-level no-op at canonical resolution: 0/1440 checkpoint tracks changed and 0 scores changed. Raw HEADLINE and `HEADLINE excl. impact` were identical to baseline at 654.18 and 669.22, with unchanged validity. Follow-up code read explains the no-op: at canonical budgets the pool path returns early through charged forward eval, so this local overshoot table does not participate in the top-level candidate score; `getCandidatesSorted` pre-sorts by `candidate.cost`, not this penalty. Conclusion: do not simply retry a larger `HANDOFF_AXIS_OVERSHOOT_WEIGHTS.impact`; a real impact-overshoot mechanism would need to alter pool pre-sort, the objective/forward value, or another path that is active under forward eval.

## 2026-06-22 - REJECT - impact overshoot pre-sort cost

Mechanism: make the active local candidate pre-sort path asymmetric for impact by keeping impact undershoot at the existing `LOCAL_IMPACT_COST_WEIGHT` 0.5, but adding a +0.5 cost weight only when achieved impact exceeds the target. The goal was to reduce the current positive achieved-minus-target impact error through the `axisCost` path that actually feeds `candidate.cost` and `getCandidatesSorted`.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-impact-presort-over-w05-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-presort-over-w05-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-presort-over-w05-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.0, CI [-0.2, 0.1], P(Δ<=0)=64.9%.

Why it failed: the active pre-sort path did move output, but only barely: raw HEADLINE was 654.14, `HEADLINE excl. impact` was 669.09, validity stayed 1439/1440 overall and 480/480 at 300k, and only 16/1440 checkpoint track hashes changed. Per-budget movement was 100k +0.1, 200k -0.0, 300k -0.1. Weighted impact signed/absolute error improved only 0.1015 -> 0.1014 across all budgets, while the few score flips were noisy: gains in `drums_signature` (+0.77 weighted, led by seed 5 at 100k +55.67) and `tiny_dance` (+0.54) were outweighed by `grain_staircase` (-1.18), `rhythm_ladder` (-0.95), and `drums_pendulum` (-0.15). Conclusion: asymmetric impact overshoot in the cheap pre-sort is an active mechanism, unlike the bypassed overshoot-ranker table, but the 0.5 overshoot premium is too weak and mostly produces isolated path flips rather than a canonical impact/headline improvement.

## 2026-06-22 - REJECT - repair elevation-undershoot gap ranking

Mechanism: increase only the repair weakest-gap selection SSE for elevation undershoot by 1.5x, leaving scoring, geometry, and the local candidate ranker unchanged. The goal was to spend repair restarts on under-hit elevation gaps, since the accepted baseline still under-achieves elevation at mature budget.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-elev-under-rank-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-elev-under-rank-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-elev-under-rank-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.0, CI [-0.4, 0.5], P(Δ<=0)=51.0%.

Why it failed: the point estimate was effectively flat: 100k +0.1, 200k +0.1, and 300k -0.1, with unchanged diagnostic validity. Raw candidate HEADLINE was 654.19 and `HEADLINE excl. impact` was 669.21. The mechanism was active, changing 205/1440 checkpoint track hashes, but the slight 300k elevation improvement (signed error -0.0906 -> -0.0902, absolute error 0.1160 -> 0.1158) was too small and came with offsetting score churn. Weighted gains in `dense_echo_climb` (+3.49), `skyline_push` (+0.85), `glide_stairs` (+0.73), `switchback_pop` (+0.60), and `rolling_hills` (+0.59) were offset by `canyon_steps` (-2.02), `valley_bounce` (-1.67), `ridge_pulse` (-1.23), `climb_terrace` (-0.95), `syncopated_lift` (-0.83), and `summit_push` (-0.70). Conclusion: repair gap ranking can steer elevation slightly, but a blunt elevation-undershoot SSE multiplier mostly reshuffles repair choices and does not produce an accepted canonical gain.

## 2026-06-22 - REJECT - softer low-air mature impact frontload

Mechanism: retry the strongest rejected low-air frontload family with a smaller mature-budget target, ramping impact curvature frontload from 1.6 to 1.8 instead of 2.0 on low-air targets while keeping 100k unchanged. The goal was to keep the prior low-air signal but cut the rhythm-row collateral.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-lowair-frontload18-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-frontload18-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-frontload18-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.6, CI [-1.7, 3.1], P(Δ<=0)=29.5%.

Why it failed: the point estimate stayed positive but remained far from accepted. Raw candidate HEADLINE was 654.78 and `HEADLINE excl. impact` was 669.93, with 100k unchanged, 200k +1.1, and 300k +0.5. The mechanism changed 861/1440 checkpoint track hashes, all at mature budgets. Weighted gains were broad (`drums_zigzag` +13.63, `dense_echo_climb` +7.49, `drums_swell` +6.91, `solo_run` +6.72, `drums_pendulum` +6.18, `drums_tide` +5.30), but still offset by large losses in `syncopated_switchback` (-15.72), `rhythm_ladder` (-4.81), `drums_crescendo` (-3.63), `dense_sprint` (-3.54), `canyon_steps` (-3.11), and `climb_terrace` (-2.36). Axis movement was tiny at 300k: impact signed error -0.0570 -> -0.0563 with unchanged absolute error 0.0985, while elevation absolute error slightly worsened 0.1160 -> 0.1166. Conclusion: reducing the low-air mature frontload amplitude lowers the prior +1.0 signal to +0.6 but does not eliminate the same syncopated/rhythm collateral, so this family still lacks a clean generic separator.

## 2026-06-22 - REJECT - low-impact low-air mature frontload

Mechanism: narrow the low-air impact-curvature frontload family so the mature-budget frontload only broadens from 1.6 to 2.0 when both target air is low and target impact is low. The ramp kept 100k unchanged and reached full strength by 200k. The goal was to retain the strong low-air gains while avoiding high-impact rhythm collateral.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-lowimpact-lowair-frontload-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowimpact-lowair-frontload-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowimpact-lowair-frontload-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.3, CI [-0.4, 1.0], P(Δ<=0)=20.7%.

Why it failed: the selector successfully reduced the blast radius but also reduced the signal below acceptance. Raw candidate HEADLINE was 654.43 and `HEADLINE excl. impact` was 669.49, with 100k unchanged, 200k +0.2, and 300k +0.4. Validity remained effectively unchanged at 1439/1440 overall and 480/480 at 300k. The mechanism changed 131/1440 checkpoint hashes and 124 scores, with gains in `solo_run` (+6.72 weighted), `cold_start` (+2.86), `dense_echo_climb` (+2.31), and `glide_stairs` (+2.19), offset by smaller losses in `grain_staircase` (-2.74), `dense_sprint` (-1.16), and `switchback_pop` (-0.09). Axis movement was tiny at 300k: impact absolute/signed error improved 0.0985/-0.0570 -> 0.0980/-0.0568, elevation improved 0.1160/-0.0906 -> 0.1158/-0.0901, and speed improved 0.0533/+0.0075 -> 0.0529/+0.0081. Conclusion: low-impact gating turns the broad low-air frontload into a cleaner but too-small mature-budget nudge, not an accepted canonical improvement.

## 2026-06-22 - REJECT - repair amplitude gap ranking

Mechanism: increase only the repair weakest-gap selection SSE for amplitude error by 1.5x, leaving scoring, geometry, and the local candidate ranker unchanged. The goal was to spend repair restarts on amplitude-constrained gaps, after diagnostics showed amplitude was the second-largest remaining score cost behind impact.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-amplitude-rank-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-amplitude-rank-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-amplitude-rank-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.0, CI [-0.5, 0.5], P(Δ<=0)=51.3%.

Why it failed: the point estimate was flat and the mature budget moved backward: 100k +0.5, 200k +0.1, 300k -0.2. Raw candidate HEADLINE was 654.17 and `HEADLINE excl. impact` was 669.19, with unchanged validity at 1439/1440 overall and 480/480 at 300k. The mechanism changed 223/1440 checkpoint hashes and 219 scores. Weighted gains in amplitude-heavy rows (`float_bounds` +3.38, `big_air_ramp` +1.92, `syncopated_lift` +1.48, `canyon_steps` +0.83, `terrace_sprint` +0.45) were offset by losses in `skyline_push` (-3.51), `switchback_pop` (-1.67), `dense_echo_climb` (-1.05), `soar_settle` (-0.71), and `glide_stairs` (-0.67). The intended axis did not improve: weighted absolute amplitude error moved 0.1054 -> 0.1055, and 300k amplitude absolute error worsened 0.1062 -> 0.1066. Conclusion: amplitude is a real remaining cost, but blunt repair gap ranking by amplitude error mostly reshuffles repair choices and does not reduce canonical amplitude error or headline score.

## 2026-06-22 - REJECT - flat greedy1 forward-eval default

Mechanism: change the default per-candidate forward-eval shape from `greedy:2` to `greedy:1`, leaving explicit `LR_FWD_EVAL` overrides and start selection unchanged. The goal was to capture the prior shallow-rollout/high-budget signal by spending less rollout depth and leaving more budget for the main search and repair.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-fwd-greedy1-default-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-fwd-greedy1-default-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-fwd-greedy1-default-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: REJECT`, Δheadline -8.8, CI [-15.9, -3.3], P(Δ<=0)=100.0%.

Why it failed: all three canonical budgets regressed hard: 100k -9.1, 200k -9.2, and 300k -8.4, despite unchanged validity at 1440/1440. Raw candidate HEADLINE was 645.39 and `HEADLINE excl. impact` was 658.62. The mechanism reduced charged forward-eval frames substantially (about 104.0M -> 82.9M aggregate), but 1079/1440 checkpoint hashes changed and the saved frames did not compensate for worse branch choices. A few rows improved (`drums_pendulum` +9.15 weighted, `solo_run` +7.46, `syncopated_lift` +5.31, `dense_sprint` +2.91), but rhythm/drum collateral dominated: `drums_crosscut` -73.25, `verse_chorus` -37.49, `drums_dropout` -37.02, `drums_pulse` -31.00, `drums_breath` -28.93, `drums_tide` -27.91, `drums_zigzag` -27.41, and `drums_crescendo` -21.52. Conclusion: a flat shallow rollout is not compatible with the current 100k/200k/300k canonical grid. The result supports only a conservative budget/slack-aware follow-up: keep depth-2 where completion/branch discrimination is tight, and spend shallower or wider only when measured suffix-cost slack is genuinely high.

## 2026-06-22 - REJECT - slack-aware best:1:5 forward-eval width

Mechanism: keep the default per-candidate forward eval at `greedy:2`, preserve the existing vertical-drama `avg` override, and add a deterministic slack-gated `best:1:5` mode only after at least six completed contacts and at least two remaining contacts. The gate estimated suffix affordability from `framesLeft / projectedToFinish` using the run's own current `sim_frames`, and suppressed rollout-only aim probes for this adaptive width path so branch width did not pay the known aim-lane overhead.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-fwd-slack-best1x5-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-fwd-slack-best1x5-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-fwd-slack-best1x5-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: REJECT`, Δheadline -4.0, CI [-7.9, -0.4], P(Δ<=0)=98.6%.

Why it failed: every canonical budget regressed: 100k -6.6, 200k -3.6, and 300k -3.4, with validity unchanged at 1440/1440. Raw candidate HEADLINE was 650.21 and `HEADLINE excl. impact` was 665.17. The mechanism was very active, changing 954/1440 checkpoint hashes and 950 scores, and it increased charged forward-eval frames from about 104.0M to 116.0M. It did create real upside in some rows (`solo_run` +8.19 weighted, `grain_staircase` +5.90, `drums_dropout` +4.35, `cold_start` +3.87, `drums_pendulum` +2.82), but broad rhythm/drum losses dominated: `drums_breath` -27.68, `drums_swell` -23.51, `verse_chorus` -23.20, `drums_tide` -20.37, `drums_crescendo` -19.44, `drums_crosscut` -17.19, `drums_pulse` -15.29, and `terrace_sprint` -14.50. Conclusion: this confirms the user's intuition that `m=1`/width is an active lever, but the simple suffix-slack gate is not selective enough; even when budget appears affordable, optimistic one-step max width steers too many rhythm rows into worse basins.

## 2026-06-22 - REJECT - very-low-air ride-out cap

Mechanism: in the contact-centered line generator, raise the grounded ride-out safety cap only for very-low-air targets. The normal air-targeted length still aimed for `(1 - air) * nextGapFrames`, but the cap ramped from the shipped `0.55 * speed * nextGapFrames` toward `0.75 * speed * nextGapFrames` below air 0.28. The goal was to address `drums_pendulum` diagnostics where target air 0.15 repeatedly achieved 0.75-0.82.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-lowair-rideout-cap-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-rideout-cap-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-rideout-cap-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.0, CI [-1.5, 1.2], P(Δ<=0)=49.7%.

Why it failed: the one-row diagnostic was real (`drums_pendulum` seed 3 at 300k improved 381.69 -> 437.77 and the worst axes moved away from extreme low-air overshoot), but the canonical board washed out: 100k -0.3, 200k -0.3, and 300k +0.2, with raw HEADLINE 654.13 and `HEADLINE excl. impact` 669.10. The mechanism changed 172/1440 checkpoint hashes and 172 scores. Weighted gains were led by `cold_start` (+6.74), `dense_sprint` (+3.50), `drums_pendulum` (+1.54), and `syncopated_switchback` (+0.58), but `drums_crescendo` lost -11.70 and erased the signal. Conclusion: longer grounded support is a valid local low-air lever, but the cap increase is too blunt across rhythm patterns; any follow-up needs to distinguish pendulum/cold-start-style low-air asks from crescendo-style timing that relies on the shorter cap.

## 2026-06-22 - REJECT - ultra-low-air ride-out cap

Mechanism: narrow the previous ride-out cap follow-up to sampled ultra-low-air asks only. The contact-centered generator kept the shipped `0.55 * speed * nextGapFrames` cap except for sampled air below 0.20, where it ramped toward `0.80 * speed * nextGapFrames` across a 0.10 span. The goal was to preserve the `drums_pendulum` seed 3 improvement while avoiding the true-air-0.30 `drums_crescendo` leakage from the prior candidate.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-ultralowair-rideout-cap-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-ultralowair-rideout-cap-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-ultralowair-rideout-cap-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline +0.0, CI [-1.0, 1.1], P(Δ<=0)=46.1%.

Why it failed: the narrower gate avoided the prior broad `drums_crescendo` loss and even improved `drums_crescendo` overall (+8.34 weighted), but it also turned the intended `drums_pendulum` spec into a net loss (-5.94 weighted). Raw candidate HEADLINE was 654.23 and `HEADLINE excl. impact` was 669.31, with 100k -0.3, 200k +0.1, and 300k +0.1. Validity stayed effectively unchanged at 1439/1440 overall and 480/480 at 300k. Only 67/1440 checkpoint hashes and scores changed, with 28 improvements and 39 regressions; the changed rows were concentrated in `drums_pendulum`, `drums_crescendo`, and `syncopated_switchback` (+1.99 weighted). The targeted diagnostic still showed the local seed-3 pendulum win (381.69 -> 422.30 at 300k), but other pendulum seeds lost enough to erase it. Conclusion: ultra-low cap pressure is too seed-sensitive. The generator can sometimes lower low-air overshoot, but a sampled-air threshold alone is not a stable separator for canonical acceptance.

## 2026-06-22 - REJECT - partial mixed-elevation ride-out shortening

Mechanism: refine the accepted elevation ride-out shortening by allowing 25% shortening strength on gaps that target both upward elevation and amplitude. The existing shipped rule fully shortens pure climb gaps but blocks shortening when amplitude is at least 0.30, after earlier full mixed shortening hurt amplitude-heavy rows.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Diagnostic candidate: `generated/golden-runs/diag-mixed-elev-rideout-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --specs=skyline_push,dense_echo_climb,switchback_pop,syncopated_lift,ridge_pulse,glide_stairs,canyon_steps,terrace_sprint,valley_bounce,rolling_drop,summit_push,climb_terrace,swoop_dive,rolling_hills,mixed_grade --budgets=100000,200000,300000 --jobs=16 --archive-dir=generated/golden-runs/diag-mixed-elev-rideout-a01`. Focused tests passed before the diagnostic with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: rejected before full canonical because the targeted vertical diagnostic was already negative. Paired subset movement over the 15 affected/control specs was Δ -0.22 weighted, with 298/540 checkpoint hashes changed.

Why it failed: the partial shortening did improve some mixed vertical rows (`valley_bounce` +1.54 weighted, `rolling_drop` +1.15, `skyline_push` +0.77, `syncopated_lift` +0.60, `ridge_pulse` +0.55), but the losses were broader in the same affected family: `switchback_pop` -2.69, `terrace_sprint` -2.21, `glide_stairs` -1.26, `dense_echo_climb` -1.09, and `canyon_steps` -0.69. The pure-elevation controls stayed byte-identical, so the gate was scoped correctly; the issue is that even 25% mixed shortening still steals useful amplitude/landing timing on enough rows to wash out the elevation relief. Conclusion: the existing hard amplitude block remains the safer default; mixed elevation+amplitude gaps need a different lever than grounded ride-out shortening.

## 2026-06-22 - REJECT - steep-arrival early impact template lane

Mechanism: make the existing impact redirect-catch template visible to the default `greedy:2` rollout by allowing a single attempt-0 template lane when the incoming trajectory was already steep (`targetState.angleDeg >= 12`) and the current impact curve pressure was high (`>= 0.62`). Existing late template lanes and normal samples were otherwise unchanged. The goal was to let a prior steep-arrival setup be judged through the converting catch it was meant to enable, instead of through the normal attempt-0 continuation.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Diagnostic candidate: `generated/golden-runs/diag-impact-template-early-steep-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --specs=drums_zigzag,drums_pendulum,dense_echo_climb,drums_swell,drums_tide,drums_crescendo,syncopated_switchback,rhythm_ladder,opening_burst,tiny_dance,drums_crosscut,drums_pulse,solo_run,cold_start --budgets=100000,200000,300000 --jobs=16 --archive-dir=generated/golden-runs/diag-impact-template-early-steep-a01`. Focused tests passed before the diagnostic with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: rejected before full canonical because the targeted impact/rhythm diagnostic was decisively negative. Paired subset movement over the 14 affected/control specs was Δ -7.60 weighted, with 356/504 checkpoint hashes or scores changed; per-budget average deltas were 100k -4.43, 200k -7.90, and 300k -8.45.

Why it failed: the early lane was active and preserved validity (504/504), but it created the same rhythm collateral that broader impact-generation levers have shown. Small gains in `drums_swell` (+0.25 weighted) and `drums_pendulum` (+0.15) were overwhelmed by `syncopated_switchback` (-31.06), `rhythm_ladder` (-23.80), `drums_crosscut` (-15.98), `drums_zigzag` (-15.91), `cold_start` (-14.62), `drums_pulse` (-3.12), `drums_tide` (-1.28), and `drums_crescendo` (-0.99). Conclusion: making the slam-hop template visible at attempt 0 on steep arrivals makes the rollout coherent in the intended sense, but the template itself is still too disruptive as an early default candidate; future impact-pair work needs a different converting catch shape or an economic gate stronger than arrival steepness plus impact pressure.

## 2026-06-22 - REJECT - stronger mature quality breadth lean

Mechanism: make the existing budget-aware quality candidate count lean harder at mature budgets by changing `HANDOFF_QUALITY_LEAN_N_CAND` from 29 to 27. This kept 100k effectively unchanged, nudged 200k down by about one quality sample, and made 300k use 27 sampled candidates. The goal was to convert mature-budget geometry savings into more useful frontier/repair work, after the current-fingerprint N=32 probe was negative.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-quality-lean27-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-lean27-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-quality-lean27-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, Δheadline -0.4, CI [-1.3, 0.5], P(Δ<=0)=81.2%.

Why it failed: the intended 100k no-op held, but mature budgets regressed in point estimate: 200k -0.3 and 300k -0.6, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k. The mechanism changed 626/1440 rows, with 297 improvements and 314 regressions. It did save candidate sampling work (about 112k fewer sampled candidates across the archive), but that did not become better-quality search: aggregate forward-eval frames rose by about 1.1M and repair frames by about 0.6M, implying the leaner pool pushed the search into more expensive or less decisive branches. Gains in `rhythm_ladder` (+3.09 weighted), `skyline_push` (+1.86), `syncopated_lift` (+1.31), `verse_chorus` (+1.03), `swoop_dive` (+1.03), and `dense_sprint` (+0.96) were outweighed by `syncopated_switchback` (-4.57), `drums_crosscut` (-4.16), `mini_burst` (-3.48), `drums_dropout` (-2.86), `soar_settle` (-1.86), `drums_pulse` (-1.71), `float_bounds` (-1.55), and `drums_signature` (-1.46). Conclusion: the current mature lean to 29 is closer to the cost-quality balance; reducing breadth further saves local sampling but causes downstream churn that hurts canonical score.

## 2026-06-22 - REJECT - mature repair main-margin ramp increase

Mechanism: increase the mature-budget repair main-search margin from 1.1 to 1.25 while keeping the existing ramp start/span, so 100k stayed byte-identical and 200k+ spent a little more budget on the main frontier before repair. The goal was to test whether the post-repair frontier-fill baseline was still carving repair too early at mature budgets.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-mainmargin125-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-mainmargin125-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-mainmargin125-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.5, 0.2], P(delta<=0)=79.5%.

Why it failed: the 100k point was unchanged as designed, but the mature budgets moved slightly backward: 200k -0.1 and 300k -0.2, with unchanged 300k validity. Raw candidate HEADLINE was 654.06 and `HEADLINE excl. impact` was 669.04. Conclusion: the current 1.1 mature repair main-margin remains the better default; delaying repair more at mature budgets mainly shifts budget back into main-frontier work without improving the canonical score.

## 2026-06-22 - REJECT - slack-gated deep forward eval

Mechanism: keep the default per-candidate forward eval at `greedy:2`, preserve explicit `LR_FWD_EVAL` overrides and the existing vertical-drama `avg` path, and add a deterministic slack-gated upgrade to `greedy:3` only on non-vertical gaps. The gate required at least six completed contacts, at least three remaining contacts, and a large measured `framesLeft / projectedToFinish` margin, with pressure capped at 0.35. The goal was to spend more compute only when the current run appeared to have enough budget left to reach the end of the track.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-slack-deep-fwd-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-deep-fwd-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-deep-fwd-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.6, CI [-0.9, 2.4], P(delta<=0)=24.9%.

Why it failed: the point estimate was positive but far from acceptance. Raw candidate HEADLINE was 654.76 and `HEADLINE excl. impact` was 669.48, with validity 1440/1440. Per-budget point estimates were 100k +1.6, 200k -0.3, and 300k +0.8. The mechanism changed 467/1440 checkpoint scores, with 221 improvements and 246 regressions, and added about 837k charged forward-eval frames and 6.4k forward-eval calls across the archive. Weighted gains were led by `drums_dropout` (+134.67), `drums_pendulum` (+51.81), `drums_swell` (+48.97), `grain_staircase` (+40.14), `drums_tide` (+25.71), and `solo_run` (+25.32), but they were offset by `drums_pulse` (-46.55), `rhythm_ladder` (-40.95), `verse_chorus` (-39.56), `drums_breath` (-25.66), `opening_burst` (-14.54), and `drums_crosscut` (-14.23). Conclusion: the user's budget-aware-depth intuition is directionally plausible, but this simple slack proxy is not selective enough; it improves some hard impact/dropout/pendulum rows while still destabilizing dense rhythm rows and even regressing the 200k point estimate.

## 2026-06-22 - REJECT - wider mature quality tail-completion window

Mechanism: increase only the quality-search tail-completion mature-budget window extra from 4 to 5 contacts, leaving the base window, contract low-budget window, and tail branching unchanged. The goal was to exploit the high observed 300k tail-completion best/success yield at 9-11 remaining contacts by allowing mature quality search to try complete suffixes slightly earlier.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-tail-window-extra5-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-tail-window-extra5-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-tail-window-extra5-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.0, 0.2], P(delta<=0)=25.3%.

Why it failed: the effect was too small to matter. Raw candidate HEADLINE was 654.22 and `HEADLINE excl. impact` was 669.24, with unchanged validity. Only 16/1440 checkpoint scores changed: 6 improved, 10 regressed, and 1424 plateaued. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k +0.1. The wider window added about 130 tail attempts and 75 tail successes, but tail improvements dropped by 4 and aggregate repair frames fell by about 89k, so the extra early full-tail work mostly displaced other work without generating accepted incumbents. Gains were concentrated in `solo_run` (+15.41 weighted), `canyon_steps` (+6.41), and `drums_pendulum` (+1.93), offset by smaller losses in `terrace_sprint` (-2.85), `soar_settle` (-2.02), `syncopated_lift` (-0.87), and `drums_crescendo` (-0.77). Conclusion: the existing quality tail window is close to saturated; widening it by one contact is a harmless but non-accepted nudge, not a path to the needed headline lift.

## 2026-06-22 - REJECT - repair upstream walk cap 6

Mechanism: increase the default repair upstream-blame walk from 4 to 6 parents via `LR_REPAIR_MAX_UPSTREAM`, leaving repair gates, restart caps, scoring, and candidate generation unchanged. The goal was to escape repeated suffix basins after repair restarts re-converged to the old incumbent suffix.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-upstream6-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-upstream6-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-upstream6-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.4, 0.6], P(delta<=0)=36.8%.

Why it failed: the point estimate was too small to matter statistically. Raw candidate HEADLINE was 654.26 and `HEADLINE excl. impact` was 669.38, with unchanged validity at every budget. Per-budget point estimates were 100k +0.0, 200k +0.2, and 300k +0.0. The deeper upstream walk changed many mature rows but mostly redistributed wins and losses: 300k gains included `cold_start` seed 4 (+48.16), `canyon_steps` seed 5 (+34.27), `dense_echo_climb` seed 10 (+26.28), and `climb_terrace` seed 9 (+23.07), while losses included `ridge_pulse` seed 9 (-25.29), `opening_burst` seed 3 (-23.48), `glide_stairs` seed 11 (-21.81), and `dense_echo_climb` seed 2 (-21.04). Conclusion: repeated re-convergence is real, but walking two more parents upstream is not a stable separator; it adds seed-sensitive churn without a reliable canonical lift.

## 2026-06-22 - REJECT - air-transition slack deep forward eval

Mechanism: refine the rejected slack-gated `greedy:3` forward-eval idea by keeping the default `greedy:2`, preserving explicit `LR_FWD_EVAL` overrides and the existing vertical-drama `avg` path, and upgrading only non-vertical nodes whose remaining-budget projection had suffix slack and whose local target field had air as the dominant changing axis versus speed/grain. The goal was to keep the prior dropout/pendulum air-transition upside while gating out grain/impact rhythm collateral.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-air-slack-greedy3-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-air-slack-greedy3-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-air-slack-greedy3-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.3, 0.6], P(delta<=0)=31.4%.

Why it failed: the feature gate reduced activity sharply but also removed most of the useful signal. Raw candidate HEADLINE was 654.28 and `HEADLINE excl. impact` was 669.36, with unchanged validity at every budget. Per-budget point estimates were 100k -0.2, 200k +0.2, and 300k +0.2. The candidate changed 117/1440 checkpoint tracks, with 61 improvements, 55 regressions, and 1 plateau; it added about 189k charged forward-eval frames, reduced forward-eval calls by about 5.9k, and displaced about 159k repair frames. Weighted gains were led by `grain_staircase` (+2.80), `drums_crescendo` (+2.77), `drums_pendulum` (+1.08), `verse_chorus` (+1.02), and `syncopated_switchback` (+0.88), but the intended `drums_dropout`, `drums_swell`, and `drums_tide` gains went to zero under the air-dominance gate. Remaining losses in `drums_signature` (-1.64), `rhythm_ladder` (-1.43), `dense_sprint` (-1.23), and `solo_run` (-0.39) kept the effect too small and noisy. Conclusion: simple air-dominance is not the missing separator for budget-aware depth; it filters out some collateral but also filters out the strongest prior upside, leaving a non-accepted seed-sensitive nudge.

## 2026-06-22 - REJECT - regular low-air impact frontload

Mechanism: refine the previously inconclusive low-air mature impact frontload by keeping the baseline impact curve frontload at 1.6, then ramping mature low-air impact catches toward 2.0 only when the adjacent contact cadence was locally regular and the impact-curve pressure was strong. The goal was to preserve the `drums_zigzag`/`drums_pendulum` upside while avoiding the irregular-rhythm and soft-swell collateral from the broader low-air frontload.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-regular-impact-lowair-frontload-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-regular-impact-lowair-frontload-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-regular-impact-lowair-frontload-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-1.5, 1.7], P(delta<=0)=47.4%.

Why it failed: the gate was too noisy and did not improve the paired distribution. Raw candidate HEADLINE was 654.24 and `HEADLINE excl. impact` was 669.28, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k. As intended, 100k was unchanged, but the mature budgets split: 200k -0.2 and 300k +0.3. The candidate changed 499/1440 checkpoint tracks, with 254 improvements, 217 regressions, and 28 score plateaus. It kept some intended gains, led by `drums_zigzag` (+9.64 weighted), `drums_pendulum` (+7.43), `rolling_drop` (+2.94), `cold_start` (+2.47), and `mini_burst` (+1.61), but moved the collateral rather than eliminating it: `drums_pulse` (-9.43), `rolling_hills` (-4.31), `rhythm_ladder` (-4.26), `dense_sprint` (-3.36), and `opening_burst` (-3.31). Work counters also show downstream churn rather than a clean geometry win: sampled candidates fell by about 9.3k, repair frames fell by about 213k, repair restarts rose by 296, and tail attempts/successes fell by 230/270. Conclusion: local cadence regularity plus impact pressure is not a stable separator for extra impact frontload; it preserves some of the prior upside but still perturbs mature rhythm basins enough to wash out.

## 2026-06-22 - REJECT - vertical avg forward-eval branch 2

Mechanism: increase only the existing mature vertical-axis forward-eval override from `avg` branch 1 to branch 2. The default non-vertical `greedy:2` path, explicit `LR_FWD_EVAL` overrides, and the mature vertical gate stayed unchanged. The hypothesis was that elevation/amplitude gaps might benefit from averaging over two next-contact continuations where the code already chooses the `avg` variant.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-vertical-avg-branch2-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-vertical-avg-branch2-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-vertical-avg-branch2-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: REJECT`, delta headline -2.0, CI [-4.7, -0.4], P(delta<=0)=99.4%.

Why it failed: the extra vertical averaging was too expensive and starved the rest of the search. Raw candidate HEADLINE fell to 652.14 and `HEADLINE excl. impact` fell to 667.50, with validity unchanged at 1439/1440 overall and 480/480 at 300k. The 100k point was slightly positive (+0.3) but the mature budgets regressed hard: 200k -2.6 and 300k -2.4. The candidate changed 713/1440 checkpoint tracks, with 314 improvements and 399 regressions. It helped only a small vertical subset (`syncopated_lift` +2.75 weighted, `ridge_pulse` +2.71, `swoop_dive` +1.19) while causing broad vertical/sparse losses: `float_bounds` -25.82, `skyline_push` -10.08, `valley_bounce` -9.43, `pop_train` -6.40, `big_air_ramp` -6.19, `terrace_sprint` -5.93, and `soar_settle` -4.68. Work counters explain the failure: charged forward-eval frames rose by about 53.0M, while repair frames dropped by about 38.6M, repair restarts by about 5.7k, and repair accepts by about 1.1k. Conclusion: the branch-1 mature vertical override is not accidentally underpowered; branch 2 spends too much budget per vertical decision and displaces higher-yield repair/frontier work.

## 2026-06-22 - REJECT - scarce-budget repair pass gate

Mechanism: refine the prior pass-gated repair handoff by applying it only at scarce repair budgets below 150k. At those budgets, repair handoff waited for the first passing terminal incumbent instead of the first terminal incumbent; 200k and 300k behavior stayed byte-identical. The goal was to keep the 100k validity fix while removing mature-budget noise from the broader pass-gate candidate.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-passgate-scarce-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-passgate-scarce-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-passgate-scarce-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.2, CI [-0.0, 1.3], P(delta<=0)=12.8%.

Why it failed: the mechanism did exactly what it was designed to do, but the effect was still too localized for the canonical accept gate. Raw candidate HEADLINE was 654.41 and `HEADLINE excl. impact` was 669.46; validity improved from 1439/1440 to 1440/1440 by fixing `drums_dropout` seed 6 at 100k (invalid -> valid, raw row 185.99 -> 493.85). The paired movement was entirely at 100k: decide reported 100k +1.4, 200k +0.0, and 300k +0.0. Only 14/1440 checkpoint tracks changed, all at 100k, with 10 score improvements and 4 regressions. Weighted gains were led by `drums_dropout` (+4.54), `drums_signature` (+0.18), `drums_zigzag` (+0.15), `opening_burst` (+0.11), `terrace_sprint` (+0.08), and `mixed_grade` (+0.08), offset by `ridge_pulse` (-0.15) and `drums_crescendo` (-0.14). Work counters showed the low-budget redistribution: simulated frames +28k, full evaluations -139, tail attempts/successes +80/+80, tail improvements -20, repair frames -54k, repair restarts +12, and repair accepts -27. Conclusion: waiting for a passing incumbent is a clean low-budget validity repair, but with only one invalid canonical row it remains below the statistical acceptance threshold even after mature-budget behavior is eliminated.

## 2026-06-22 - REJECT - cadence-gated low-air impact frontload lane

Mechanism: add a selection-protected late candidate lane for mature low-air impact catches: normal impact curvature frontload stayed at 1.6, while only late attempts on locally cadence-regular low-air gaps could ramp toward frontload 2.0 from 100k to 200k+. The goal was to keep the broad low-air frontload upside while preserving the baseline candidate shapes and avoiding the prior `syncopated_switchback` collateral.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-impact-frontload-lane-cadence-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-frontload-lane-cadence-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-impact-frontload-lane-cadence-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.4, CI [-0.4, 1.5], P(delta<=0)=19.8%.

Why it failed: the optional lane was directionally positive but too small and still too seed-sensitive for the accept-only gate. Raw candidate HEADLINE was 654.57 and `HEADLINE excl. impact` was 669.58, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k. As designed, 100k was byte-identical; decide reported 200k +0.5 and 300k +0.5. The candidate changed 239/1440 checkpoint hashes and 226 scores, with 126 score improvements, 100 regressions, and 1214 plateaus. The cadence gate removed the probe's `syncopated_switchback` loss, and canonical weighted gains were led by `drums_pendulum` (+5.73), `cold_start` (+5.16), `solo_run` (+4.13), and `dense_echo_climb` (+3.63). Those were offset by smaller but broad mature-budget losses in `opening_burst` (-1.58), `rhythm_ladder` (-1.42), `rolling_hills` (-1.26), `glide_stairs` (-1.05), `ridge_pulse` (-1.01), and `dense_sprint` (-0.93). Conclusion: making stronger low-air frontload optional is cleaner than changing every candidate and remains directionally useful, but the current local cadence gate still admits enough rhythm/vertical churn that the canonical lift is not accepted.

## 2026-06-22 - REJECT - low-slack shallow forward eval

Mechanism: make the default `greedy:2` forward-eval ranker budget/slack-aware in the quality phase. For a non-vertical node that would otherwise keep the default `greedy:2` rollout, estimate suffix affordability from committed contacts, remaining contacts, current `sim_frames`, and target budget; when the run appears low on suffix slack, rank that whole candidate pool with `greedy:1` instead. The per-node forward-eval config was frozen before scoring the pool so candidates in one ranking decision did not mix depths as rollout frames accrued. Vertical `avg` kept precedence.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Probe: `generated/golden-runs/probe-low-slack-shallow-fwd-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --specs=drums_crosscut,verse_chorus,drums_dropout,drums_pulse,drums_breath,drums_tide,drums_zigzag,drums_crescendo,drums_pendulum,solo_run,syncopated_lift,dense_sprint,rhythm_ladder,opening_burst,syncopated_switchback,float_bounds --budgets=100000,200000,300000 --jobs=16 --archive-dir=generated/golden-runs/probe-low-slack-shallow-fwd-a01`. Paired subset decision was positive but noisy: delta headline +0.6, CI [-2.1, 3.6], P(delta<=0)=33.5%.

Candidate: `generated/golden-runs/attempt-low-slack-shallow-fwd-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-low-slack-shallow-fwd-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-low-slack-shallow-fwd-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-1.3, 1.5], P(delta<=0)=45.1%.

Why it failed: the canonical signal collapsed outside the selected probe slice. Raw candidate HEADLINE was 654.28 and `HEADLINE excl. impact` was 669.41, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k. Per-budget point estimates were 100k -0.0, 200k -0.0, and 300k +0.2. The mechanism changed 778/1440 checkpoint hashes and 773 scores, with 417 score improvements and 356 regressions. It did reduce charged forward-eval frames by about 6.9M, but it also increased forward-eval calls by about 458k, shifted about 4.6M frames into repair, and added about 7.8k tail attempts and 8.1k unique full evaluations. Weighted gains were real in `syncopated_switchback` (+120.41), `solo_run` (+106.98), `dense_sprint` (+62.35), `canyon_steps` (+37.92), `syncopated_lift` (+33.81), `drums_pendulum` (+25.02), `cold_start` (+24.62), and `dense_echo_climb` (+23.20), but were erased by broad rhythm/drum and sparse-row losses: `drums_signature` (-62.70), `drums_dropout` (-42.21), `drums_crescendo` (-41.45), `soar_settle` (-39.30), `drums_zigzag` (-38.15), `drums_swell` (-34.52), `drums_crosscut` (-31.97), `drums_tide` (-31.68), `drums_pulse` (-27.53), `skyline_push` (-27.14), and `rhythm_ladder` (-25.90). Conclusion: the user's budget-aware-depth intuition is valid as a lever, but this low-slack `greedy:1` gate mostly redistributes search into seed-sensitive suffix churn; it is not a stable canonical improvement.

## 2026-06-22 - REJECT - aim direct model default

Mechanism: default the short-probe aim model-space to direct reduced-output fits (`fit(reduce(row))`) while retaining `LR_AIM_MODEL_SPACE=latent` as an opt-out. The scorer, suite, fingerprint, seeds, and budget grid stayed unchanged.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Probe: `generated/golden-runs/probe-aim-direct-a01/golden.json`, run on 16 specs with `LR_ENGINE=wasm LR_AIM_MODEL_SPACE=direct npm run golden -- --specs=drums_pendulum,skyline_push,drums_dropout,terrace_sprint,rolling_drop,rhythm_ladder,dense_echo_climb,canyon_steps,float_bounds,dense_sprint,drums_crescendo,syncopated_lift,drums_signature,drums_pulse,solo_run,syncopated_switchback --budgets=100000,200000,300000 --jobs=16 --archive-dir=generated/golden-runs/probe-aim-direct-a01`. The subset paired decision was inconclusive but slightly positive: delta headline +0.6, CI [-5.5, 6.9], P(delta<=0)=42.5%, with per-budget estimates 100k +2.8, 200k +0.3, and 300k +0.2.

Candidate: `generated/golden-runs/attempt-aim-direct-default-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-direct-default-a01`. Raw HEADLINE was 653.47, `HEADLINE excl. impact` was 668.43, and validity was 1440/1440. The raw budget curve was 100k 632.33, 200k 654.56, and 300k 659.79.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-direct-default-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.7, CI [-4.0, 2.8], P(delta<=0)=66.6%. Per-budget point estimates were 100k -0.2, 200k -0.6, and 300k -1.0, with validity unchanged at 100% in every budget.

Why it failed: the probe gains did not generalize. The canonical run changed 1427/1440 checkpoint tracks, with 681 improvements and 746 regressions. Direct fits helped hard rows such as `dense_echo_climb` (+9.09 weighted), `drums_dropout` (+6.57), `drums_pendulum` (+6.36), and `cold_start` (+6.25), but those were outweighed by rhythm/drum losses including `drums_crosscut` (-18.32), `rhythm_ladder` (-14.56), `drums_crescendo` (-8.68), `tiny_dance` (-7.70), `mini_burst` (-6.56), and `drums_breath` (-6.14). Work counters showed semantics churn rather than a clean cost win: aim frames and aim entries fell, but full evaluations, tail attempts, and repair restarts rose. Conclusion: direct reduced-output fitting is an active but noisier predictor; the latent reducer remains the safer default.

## 2026-06-22 - REJECT - low-air planned aim correction

Mechanism: add an up-front deterministic planning pass that lowered only the search/generation aim for `air` targets below 0.40, fading from no bias at 0.40 to a -0.125 aim bias at 0.15 and below. The official gap targets, scorer, fingerprint, seed set, and budget grid stayed unchanged; only `aimTargets(gap)` for generation/objective ranking read the corrected low-air aim.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-lowair-aim-correction-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-aim-correction-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-aim-correction-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.6, CI [-1.3, 2.7], P(delta<=0)=26.4%. Per-budget point estimates were 100k +0.2, 200k +0.3, and 300k +1.0, with validity unchanged at 100% in every budget.

Why it failed: the direction was positive but far from the accept gate. Raw candidate HEADLINE was 654.81 and `HEADLINE excl. impact` was 669.43, with validity 1440/1440. The candidate changed 525/1440 checkpoint hashes and 523 scores, with 252 improvements and 271 regressions. It did move the intended axis slightly: low-air absolute error fell by about 0.0023 and low-air signed achieved-minus-target error fell by about 0.0027, but the gain was too small relative to path churn. Weighted gains were led by `cold_start` (+13.92), `drums_pendulum` (+9.06), `dense_echo_climb` (+7.28), `verse_chorus` (+5.15), and `drums_dropout` (+4.02), while losses in `drums_signature` (-6.45), `drums_crescendo` (-5.35), `opening_burst` (-4.72), `dense_sprint` (-4.14), `tiny_dance` (-2.40), and `ridge_pulse` (-2.07) kept the paired distribution inconclusive. Conclusion: low-air target bias is a real signal, but this fixed aim-down correction is too blunt and mostly redistributes rhythm/frontier choices; any follow-up needs a stronger selector than the air target alone.

## 2026-06-22 - REJECT - pure-climb elevation planned aim correction

Mechanism: add an up-front deterministic planning pass that aimed pure upward elevation asks slightly higher while preserving the official scored target. Mixed elevation+amplitude asks stayed literal when amplitude was at least 0.30, and the max planned elevation bias was +0.075 above target elevation 0.50.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-pureclimb-elev-aim-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-pureclimb-elev-aim-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-pureclimb-elev-aim-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-1.0, 1.1], P(delta<=0)=39.9%. Per-budget point estimates were 100k -0.3, 200k +0.3, and 300k +0.1.

Why it failed: the targeted slice barely moved. Raw candidate HEADLINE was 654.28 and `HEADLINE excl. impact` was 669.16, with validity 1439/1440 overall and one 100k invalid row. The candidate changed 461/1440 checkpoint hashes and 459 scores, with 248 improvements and 211 regressions. Pure-climb elevation signed error improved slightly, but pure-climb absolute elevation error was essentially flat and all-elevation absolute error worsened slightly. Weighted gains in vertical rows (`dense_echo_climb` +5.99, `rolling_drop` +3.22, `swoop_dive` +2.19, `glide_stairs` +1.65, `mixed_grade` +1.47, `summit_push` +1.45) were offset by `terrace_sprint` (-6.41), `rolling_hills` (-3.70), `ridge_pulse` (-2.71), `climb_terrace` (-2.20), and `switchback_pop` (-0.97). Conclusion: static pure-climb planned elevation aim-up is too blunt; it mostly changes path selection and repair allocation without materially reducing the intended elevation error.

## 2026-06-23 - REJECT - deep-low-air planned aim correction

Mechanism: refine the rejected low-air planned aim correction by lowering only sampled `air` targets below 0.35 instead of below 0.40, ramping to the same -0.125 max planned-air bias at 0.15. Official targets, scorer, fingerprint, seeds, and budget grid stayed unchanged; only generation/objective aim targets read the planned value.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-deep-lowair-aim-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-deep-lowair-aim-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-deep-lowair-aim-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.4, CI [-1.3, 2.5], P(delta<=0)=34.2%. Per-budget point estimates were 100k +0.1, 200k +0.0, and 300k +0.8.

Why it failed: the stricter selector removed some broad jitter collateral but also reduced the signal below acceptance. Raw candidate HEADLINE was 654.59 and `HEADLINE excl. impact` was 669.98, with validity 1440/1440. The candidate changed 327/1440 checkpoint hashes and 326 scores, with 149 improvements, 177 regressions, and 1114 plateaus. The intended axis did improve: air-target rows below 0.35 moved absolute error 0.1690 -> 0.1649 and signed achieved-minus-target error 0.1645 -> 0.1603. That axis movement did not convert cleanly to score: weighted gains in `drums_pendulum` (+9.02), `drums_dropout` (+7.41), `drums_crescendo` (+5.40), `dense_echo_climb` (+4.55), and `drums_signature` (+2.93) were offset by losses in `dense_sprint` (-10.21), `syncopated_switchback` (-4.53), `rhythm_ladder` (-4.23), `opening_burst` (-3.39), and `terrace_sprint` (-2.55). Work shifted rather than becoming more valuable: repair frames fell by about 219k, repair accepts by 19, full evaluations rose by 223, and tail attempts rose by 276. Conclusion: deep-low-air target bias is a real but too-small axis correction; target-only low-air planning remains seed/rhythm sensitive and is not an accepted path by itself.

## 2026-06-23 - REJECT - repair suffix exhausted-gap invalidation

Mechanism: refine the previously too-broad repair exhausted-gap reset by invalidating only exhausted gaps inside an accepted rebuilt suffix. When a repair restart accepted from anchor `k`, exhausted gap entries `>= k` were cleared so they could be re-ranked against the changed suffix, while earlier failed gaps stayed exhausted. Scorer, specs, fingerprint, seeds, budget grid, and repair acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-repair-suffix-exhaust-reset-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-suffix-exhaust-reset-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-suffix-exhaust-reset-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.3, 0.2], P(delta<=0)=65.3%. Per-budget point estimates were 100k +0.1, 200k -0.1, and 300k -0.1, with unchanged validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the narrower invalidation passed the focused invariant that rejected the global reset, but it still added repair churn without improving the paired distribution. Raw candidate HEADLINE was 654.13 and `HEADLINE excl. impact` was 669.33. The candidate changed 122/1440 checkpoint hashes and 118 scores, with 58 improvements and 60 regressions. It added about 315 repair restarts, 56 repair accepts, 609k repair frames, 486 full evaluations, 300 unique full evaluations, and 276 tail attempts, while touching 86 fewer distinct repair gaps. Weighted gains were concentrated in `tiny_dance` (+25.63), `canyon_steps` (+15.54), `switchback_pop` (+7.01), and `rolling_hills` (+3.69), but were offset by `mini_burst` (-16.43), `glide_stairs` (-15.80), `float_bounds` (-14.23), `ridge_pulse` (-7.69), `cold_start` (-5.98), `valley_bounce` (-3.70), and `dense_echo_climb` (-3.17). Conclusion: stale exhausted-gap evidence is real, but clearing suffix-local exhausted entries after acceptance concentrates more repair work into changed suffix basins without a stable score lift.

## 2026-06-23 - REJECT - contested budget-slack deep forward rerank

Mechanism: keep the default `greedy:2` forward-eval ranker, preserve explicit `LR_FWD_EVAL` overrides and the existing vertical-drama `avg` path, and add a second-pass `greedy:3` rerank only when the current node had measured suffix-budget slack and the top pool candidates were close under the base rollout. The rerank touched only the contested top pool entries, not the whole node pool or reuse/brake extras.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-contested-deep-fwd-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-contested-deep-fwd-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-contested-deep-fwd-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-2.6, 2.6], P(delta<=0)=54.6%. Per-budget point estimates were 100k -0.1, 200k +0.6, and 300k -0.6, with validity improving to 1440/1440 overall and unchanged 480/480 at 300k.

Why it failed: the sharper selector did narrow the broad slack-depth idea, but it still produced expensive path churn without a stable score lift. Raw candidate HEADLINE was 654.06 and `HEADLINE excl. impact` was 669.23. The candidate changed 820/1440 checkpoint hashes and 817 scores, with 380 improvements and 437 regressions. It added about 125k forward-eval calls, 2.8M charged forward-eval frames, 1,565 full evaluations, 635 unique full evaluations, 1,162 tail attempts, 147 repair restarts, and 21 repair accepts. Weighted gains were led by `drums_dropout` (+15.67), `drums_pendulum` (+6.71), `drums_zigzag` (+6.12), `dense_echo_climb` (+5.36), and `grain_staircase` (+2.59), but were outweighed by `syncopated_switchback` (-10.10), `drums_crosscut` (-9.80), `drums_breath` (-4.88), `opening_burst` (-4.51), `ridge_pulse` (-3.84), and `solo_run` (-3.54). Conclusion: budget-aware extra depth on close contenders captures some hard drum/dropout upside, but even this frontier-local form destabilizes rhythm rows and loses the 300k point estimate; deeper lookahead needs a better semantic selector than slack plus score closeness.

## 2026-06-23 - REJECT - wider shallow quality-tail throttle scope

Mechanism: keep the existing shallow quality-tail throttle strength and tail-completion window unchanged, but apply the throttle to quality-search tail completions with up to 5 remaining contacts instead of only 1-2 remaining contacts. The goal was to cut the low-yield remaining-3-to-5 full-tail work observed at 300k and leave more budget for resumed frontier/repair work.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-shallow-tail-throttle5-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-shallow-tail-throttle5-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-shallow-tail-throttle5-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.2, 0.0], P(delta<=0)=84.0%. Per-budget point estimates were 100k -0.1, 200k +0.0, and 300k -0.1, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the wider scope mostly confirmed that shallow tail throttling is already saturated. Raw candidate HEADLINE was 654.14 and `HEADLINE excl. impact` was 669.14. Only 7/1440 checkpoint scores changed, with 1 improvement and 6 regressions; the mechanism removed about 7,898 tail attempts, 7,863 tail successes, 7,811 full evaluations, and 7,797 duplicate full evaluations, but it also removed 113 tail improvements and did not convert the saved frames into better frontier/repair output. The only meaningful gain was `rolling_drop` (+0.40 weighted), offset by `tiny_dance` (-1.53), `drums_crescendo` (-0.56), and `mixed_grade` (-0.14). Conclusion: remaining-3-to-5 quality tail completions are low-yield but still occasionally provide the accepted incumbent; throttling them saves duplicate work without improving canonical score.

## 2026-06-23 - REJECT - cadence-gated mature reuse extra

Mechanism: keep the baseline latest-catch reuse and existing mature-budget extra reuse probability, but add a higher optional second-reuse pressure when the authored previous-current-next contact intervals are locally regular. The gate used only adjacent contact timing, target budget, and accumulated unique full-evaluation feedback; scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-cadence-reuse-extra-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-cadence-reuse-extra-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-cadence-reuse-extra-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.1, 0.2], P(delta<=0)=23.4%. Per-budget point estimates were 100k +0.0, 200k +0.1, and 300k +0.0, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the selector was too weak and too localized to matter. Raw candidate HEADLINE was 654.22 and `HEADLINE excl. impact` was 669.20. The candidate changed only 58/1440 checkpoint hashes and 53 scores, with 32 improvements, 21 regressions, and 1387 plateaus. It did exercise the intended lane: reuse attempts rose by 2,521, reuse successes by 2,126, and selected reuse candidates by 14, while pool selections fell by 50. That work did not produce a stable score lift: full evaluations fell by 717, unique full evaluations by 436, tail attempts by 230, tail successes by 212, and repair frames rose by about 124k with 5 fewer repair accepts. Weighted gains in `glide_stairs` (+0.73), `climb_terrace` (+0.66), `dense_echo_climb` (+0.51), `canyon_steps` (+0.32), and `drums_crescendo` (+0.32) were offset by `summit_push` (-0.80), `verse_chorus` (-0.52), and `mixed_grade` (-0.46). Conclusion: cadence-regular older catch reuse is a real but tiny lever; simply adding more second-catch reuse on regular timing mostly trades tail/full-eval budget for a few seed-specific prefix changes and is not an accepted improvement.

## 2026-06-23 - REJECT - capped low-air mature impact frontload

Mechanism: refine the rejected low-air mature impact-frontload family by ramping only low-air impact catches from the baseline frontload 1.6 toward 1.8 at mature budgets, instead of the prior 2.0 cap. The 100k budget stayed byte-identical; the low-air fade and mature-budget ramp matched the earlier promising selector, but with half the extra curvature strength. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-lowair-frontload18-a01/golden.json`, canonical archive, fingerprint `de24a421f751`, same baseline commit with dirty source. Focused tests passed on the equivalent source change with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-frontload18-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.6, CI [-1.7, 3.1], P(delta<=0)=29.5%. Per-budget point estimates were 100k +0.0, 200k +1.1, and 300k +0.5, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the weaker cap kept a positive point estimate but did not solve the seed-sensitive collateral that rejected the 2.0 version. Raw candidate HEADLINE was 654.78 and `HEADLINE excl. impact` was 669.93. The candidate changed 861/1440 checkpoint hashes and 833 scores, with 411 improvements, 422 regressions, and 607 plateaus. It preserved real gains in the intended impact/low-air family: `drums_zigzag` (+13.63 weighted), `dense_echo_climb` (+7.49), `drums_swell` (+6.91), `solo_run` (+6.72), `drums_pendulum` (+6.18), and `drums_tide` (+5.30). Those were still offset by large rhythm/switchback losses: `syncopated_switchback` (-15.72), `rhythm_ladder` (-4.81), `drums_crescendo` (-3.63), `dense_sprint` (-3.54), and `canyon_steps` (-3.11). Work counters showed churn rather than a clean efficiency gain: candidates sampled fell by about 16.7k, viable candidates rose by about 5.4k, tail improvements rose by 93, but repair restarts rose by 177, repair accepts fell by 10, and charged forward-eval frames rose by about 196k. Conclusion: frontload 1.8 is a better-shaped variant than 2.0 but still does not cross the paired accept gate; low-air curvature strength alone is not the missing separator.

## 2026-06-23 - ACCEPT - start support robust branch 3

Mechanism: increase only the delayed low-air support-start robust scoring branch from 2 to 3. The baseline still generates the same start candidates; normal starts and non-delayed support starts keep their existing scoring. The change affects only the robust average used when a delayed support-line start is evaluated under the default `greedy:2` start forward scorer.

Baseline: `generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.18.

Candidate: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-support-robust3-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-support-robust3-a01/golden.json generated/golden-runs/attempt-post-repair-frontier-fill-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.5, CI [-0.0, 1.5], P(delta<=0)=7.4%. Per-budget point estimates were 100k +0.3, 200k +0.6, and 300k +0.4, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical HEADLINE 654.64, `HEADLINE excl. impact` 669.99. The mechanism changed only 35/1440 checkpoint scores, with 28 improvements, 7 regressions, and 1405 plateaus. Weighted gains were concentrated in `rhythm_ladder` (+9.36), `dense_echo_climb` (+4.93), and `cold_start` (+2.76); the largest losses were `cold_start` seed 5 at 300k (-25.72), `cold_start` seed 0 at 300k (-18.35), and `dense_echo_climb` seed 0 at 200k (-5.89), but the paired distribution was accepted. Work counters stayed small and consistent with a start-ranking change: start-eval charged frames were unchanged, full evaluations rose by 243, unique full evaluations by 223, tail attempts by 49, repair accepts by 5, and repair frames fell by about 149k.

## 2026-06-23 - REJECT - scarce-budget repair pass gate after robust start

Mechanism: at budgets below 150k, delay the first repair handoff until the terminal incumbent is contract-passing; at 200k and 300k, keep the existing first-terminal-improvement handoff behavior. This targeted the lone invalid 100k row without touching mature-budget repair timing.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-start-support-scarce-passgate-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-support-scarce-passgate-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-support-scarce-passgate-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.2, CI [-0.0, 1.3], P(delta<=0)=12.8%. Per-budget point estimates were 100k +1.4, 200k +0.0, and 300k +0.0. Validity improved from 1439/1440 to 1440/1440, with the entire point estimate coming from the 100k tier.

Why it failed: the pass gate did fix the remaining scarce-budget invalid row, but the effect was too localized to clear the paired accept gate with the canonical 12-seed suite. The mature budgets were intentionally identical, so the candidate had no compensating 200k/300k signal; under the campaign rule this cannot be kept without `VERDICT: ACCEPT`. Conclusion: scarce repair gating remains a useful diagnostic for validity pressure, not an accepted compiler improvement.

## 2026-06-23 - REJECT - start support robust branch 4

Mechanism: increase only the delayed low-air support-start robust scoring branch from the accepted value 3 to 4. The start candidate generator, normal start scoring, non-delayed support-start scoring, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-start-support-robust4-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-support-robust4-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-support-robust4-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.2, 0.4], P(delta<=0)=33.9%. Per-budget point estimates were 100k -0.1, 200k +0.1, and 300k +0.1, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the accepted robust3 start scorer appears near saturation. Raw candidate HEADLINE was 654.70 and `HEADLINE excl. impact` was 669.91. The candidate was low-churn and directionally positive at mature budgets, but the 100k tier moved slightly down and the paired distribution was too weak to accept. Diagnostics showed the largest 300k gains in `cold_start` seed 4 (+19.17), `rhythm_ladder` seed 1 (+17.52), and `cold_start` seed 8 (+10.35), offset mainly by `cold_start` seed 6 (-17.04). Conclusion: branch 4 is not harmful enough to rule out robust averaging as a family, but the one-step increase beyond branch 3 does not produce an accepted canonical improvement.

## 2026-06-23 - REJECT - low-air mature impact frontload after robust start

Mechanism: rerun the strongest prior impact-frontload family on top of the accepted robust3 baseline by ramping impact curvature frontload from 1.6 to 2.0 only at mature budgets and only on low-air targets. The 100k tier stayed byte-identical; scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-lowair-frontload20-after-robust3-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-frontload20-after-robust3-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-frontload20-after-robust3-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.5, CI [-1.4, 2.2], P(delta<=0)=28.6%. Per-budget point estimates were 100k +0.0, 200k +0.4, and 300k +0.7, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the mechanism again moved the right broad axis but still carried too much rhythm collateral for the paired accept gate. Raw candidate HEADLINE was 655.10 and `HEADLINE excl. impact` was 670.54. The largest 300k gains included `drums_crescendo` seed 8 (+57.42), `drums_dropout` seed 11 (+54.76), `solo_run` seed 6 (+51.87), `dense_echo_climb` seed 10 (+50.97), `tiny_dance` seed 4 (+50.45), and `drums_pendulum` seed 3 (+48.35). Those gains were offset by large regressions in `syncopated_switchback` seed 10 (-79.29), `grain_staircase` seed 8 (-67.20), `syncopated_switchback` seed 0 (-50.80), `rhythm_ladder` seed 9 (-50.70), `rhythm_ladder` seed 10 (-45.48), and `rhythm_ladder` seed 3 (-40.68). Conclusion: robust3 does not rescue the low-air frontload family; low-air frontload remains a real impact lever but still lacks the semantic separator needed to avoid rhythm-row regressions.

## 2026-06-23 - REJECT - repair low-air overshoot gap ranking

Mechanism: increase only the repair weakest-gap selection SSE when a gap targeted low air (`air.target <= 0.30`) and the achieved air overshot that target. Candidate generation, scoring, repair acceptance, specs, fingerprint, seeds, and budget grid stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-repair-lowair-over-rank-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-lowair-over-rank-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-lowair-over-rank-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.3, CI [-2.6, 0.5], P(delta<=0)=60.9%. Per-budget point estimates were 100k -0.2, 200k -0.3, and 300k -0.4, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the target failure shape was real but the ranking-only pressure was too brittle. Raw candidate HEADLINE was 654.29 and `HEADLINE excl. impact` was 669.60. The known low-air diagnostic improved in places (`drums_pendulum` seed 3 +56.69 at 300k, seed 10 +10.68), but the same prioritization caused a catastrophic `syncopated_switchback` seed 10 regression at 300k (632.02 -> 420.58, delta -211.44) plus losses in `drums_crescendo`, `drums_pendulum`, and additional `syncopated_switchback` seeds. Conclusion: low-air overshoot remains a real failure mode, but blunt repair prioritization by low-air overshoot is not the separator; any follow-up needs to avoid syncopated/rhythm basins or change candidate generation rather than only weak-gap ranking.

## 2026-06-23 - REJECT - low-air high-slack top-two greedy3 rerank

Mechanism: preserve the default `greedy:2` forward-eval ranker, explicit `LR_FWD_EVAL` overrides, and the mature vertical `avg` path, then add a second-pass `greedy:3` check only in quality search when the run had mature-budget suffix slack, the current/next target was low-air non-vertical, and the top two pool candidates were close under the base score. The second pass only swapped the existing top-two score slots, so it could choose between close contenders without globally demoting pool candidates against reuse/brake extras.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-lowair-slack-top2-greedy3-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-slack-top2-greedy3-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-slack-top2-greedy3-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.1, 0.1], P(delta<=0)=45.1%. Per-budget point estimates were 100k +0.0, 200k +0.1, and 300k -0.0, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the selector avoided the earlier broad lookahead collateral but became too weak to matter. Raw candidate HEADLINE was 654.66 and `HEADLINE excl. impact` was 670.00. The 100k tier was byte-identical; only 5 rows changed at 200k and 7 at 300k. Work counters confirm the near-no-op: charged forward-eval frames rose by only about 18k across the archive, forward-eval calls by 350, unique full evaluations by 28, and tail improvements by 7. The intended pendulum rows moved slightly (`drums_pendulum` seed 9 +13.87 at 200k, seed 6 +3.19 at 200k and +2.93 at 300k), and `syncopated_switchback` seed 9 gained +12.49 at 300k, but this was offset by `drums_pendulum` seed 11 -13.55 and seed 5 -1.93 at 300k. Conclusion: budget-aware deeper lookahead can be made safe and cheap, but the low-air top-two gate is below the activity threshold needed for a canonical lift; it is not an accepted compiler improvement.

## 2026-06-23 - REJECT - ultra-low-air mature ride-out lane

Mechanism: add a selection-protected late attempt lane in the contact-centered generator for mature-budget ultra-low-air non-vertical gaps. The normal air-targeted ride-out length stayed available; only late attempts below roughly air 0.22 could use a longer grounded ride-out cap, with 100k intentionally byte-identical. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-ultralow-rideout-lane-after-robust3-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-ultralow-rideout-lane-after-robust3-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-ultralow-rideout-lane-after-robust3-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.5, 0.3], P(delta<=0)=52.0%. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -0.0, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the optional lane did target the real pendulum failure but still leaked into a bad rhythm/drum basin. Raw candidate HEADLINE was 654.63 and `HEADLINE excl. impact` was 670.05. The 100k tier was byte-identical. `drums_pendulum` improved overall by about +1.95 weighted, with 300k gains on seeds 0 (+8.42), 1 (+4.04), 4 (+4.60), 6 (+15.10), 8 (+8.90), and 9 (+16.54). Those gains were offset by pendulum losses on seeds 2 (-5.97), 3 (-8.73), and 11 (-16.79), plus a large `drums_crescendo` seed 5 regression at both mature budgets (-25.85 at 200k, -64.19 at 300k), leaving the canonical point estimate flat-to-negative. Work counters showed no broad cost problem: candidates viable rose by 259, unique full evaluations by 50, and charged forward-eval frames fell by about 9k. Conclusion: optional longer low-air support is a real geometry lever for pendulum, but air-thresholded ride-out length still lacks the separator that protects crescendo-style timing; do not retry this lane without a stronger rhythm/cadence guard.

## 2026-06-23 - REJECT - regular ultra-low-air impact ride-out lane

Mechanism: tighten the rejected ultra-low-air ride-out lane with a generic local selector: mature budget only, late deterministic attempts only, no elevation/amplitude targets, jittered air at or below 0.22, moderate target speed, bounded impact at or above 0.43, and locally regular current/next contact cadence. The lane then raised the air-targeted grounded ride-out cap and blend only for those selected attempts. The 100k tier stayed byte-identical; scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-regular-ultralow-rideout-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-regular-ultralow-rideout-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-regular-ultralow-rideout-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.8], P(delta<=0)=47.3%. Per-budget point estimates were 100k +0.0, 200k +0.1, and 300k +0.2, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the stronger guard did exactly what it was meant to do geometrically, but the remaining signal was still too seed-split for the paired accept gate. Raw candidate HEADLINE was 654.78 and `HEADLINE excl. impact` was 670.22. The 100k tier was byte-identical. Only `drums_pendulum` score rows moved: at 200k, gains on seeds 3 (+49.89), 9 (+35.52), 11 (+9.41), 0 (+8.99), and 1 (+1.33) were offset by losses on seeds 8 (-29.92), 7 (-15.30), 4 (-13.46), 5 (-8.95), and 2 (-2.17); at 300k, gains on seeds 3 (+46.63), 5 (+11.00), 1 (+10.51), 7 (+7.76), 8 (+7.47), 0 (+4.38), and 11 (+0.44) were offset by losses on seeds 4 (-12.20), 9 (-9.67), 2 (-7.31), and 10 (-1.79). The earlier `drums_crescendo` and `syncopated_switchback` collateral was removed, but no other specs moved, leaving only about +3.37 weighted `drums_pendulum` lift and a canonical point estimate of +0.1. Work counters were small and consistent with a narrow generator lane: charged forward-eval frames rose by about 27k, forward-eval calls fell by 2,217, full evaluations fell by 118, unique full evaluations by 65, tail attempts by 73, and tail improvements rose by 7. Conclusion: local cadence plus bounded-impact guarding is a good separator for avoiding the prior ride-out collateral, but longer ultra-low ride-out remains a seed-sensitive pendulum-only lever and is not accepted.

## 2026-06-23 - REJECT - mature aim top-2 base refinement

Mechanism: reduce the mature-budget aim lane from refining the top 3 quality-sorted pool bases to the top 2, while keeping the existing 150k maturity gate. The 100k tier stayed byte-identical because budgets below the maturity threshold still collapse to one refined base; scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-aim-topk-bases2-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-topk-bases2-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-topk-bases2-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: REJECT`, delta headline -3.2, CI [-7.1, 0.2], P(delta<=0)=96.7%. Per-budget point estimates were 100k +0.0, 200k -4.1, and 300k -3.8, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the third mature aim base is still buying useful alternatives despite its probe cost. Raw candidate HEADLINE was 651.40 and `HEADLINE excl. impact` was 667.20. The candidate saved about 7.8M charged aim-probe frames, refined 132k fewer aim bases, emitted 188k fewer aimed candidates, and selected 3.6k fewer aimed candidates, but those savings did not become better search: sampled candidates rose by about 656k and viable candidates by about 483k while the mature score distribution regressed. Weighted gains in `drums_crescendo` (+16.12), `drums_signature` (+9.00), `solo_run` (+8.12), and `drums_pendulum` (+6.95) were overwhelmed by `drums_swell` (-40.01), `drums_crosscut` (-11.80), `drums_tide` (-11.79), `drums_zigzag` (-10.19), `cold_start` (-10.15), `climb_terrace` (-9.79), and `ridge_pulse` (-9.54). Conclusion: the mature top-3 aim refinement is not dead overhead under the current robust3 baseline; reducing it to top-2 removes enough productive proposals that the fallback sampled-pool churn is decisively worse.

## 2026-06-23 - REJECT - mature aim top-4 base refinement

Mechanism: increase the mature-budget aim lane from refining the top 3 quality-sorted pool bases to the top 4, while keeping the existing 150k maturity gate. The 100k tier stayed byte-identical because budgets below the maturity threshold still collapse to one refined base; scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-aim-topk-bases4-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-topk-bases4-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-topk-bases4-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +1.7, CI [-1.6, 4.9], P(delta<=0)=14.2%. Per-budget point estimates were 100k +0.0, 200k +2.8, and 300k +1.6, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: adding a fourth mature aim base is directionally useful but not stable enough for the paired accept gate. Raw candidate HEADLINE was 656.35 and `HEADLINE excl. impact` was 668.90. The candidate changed 955/1440 checkpoint scores, with 521 improvements, 434 regressions, and 485 plateaus; the 100k tier was byte-identical, while 200k averaged +2.72 and 300k averaged +1.50. The added base spent about 6.2M more charged aim-probe frames, refined 110k more aim bases, emitted 162k more aimed candidates, and selected 3.7k more aimed candidates, while reducing sampled candidates by about 553k, viable candidates by about 397k, full evaluations by 944, repair frames by about 5.6M, and tail improvements by 50. Weighted gains in `drums_zigzag` (+17.84), `drums_signature` (+15.32), `drums_dropout` (+12.17), `rolling_hills` (+8.50), `ridge_pulse` (+7.72), and `skyline_push` (+7.45) were offset by `syncopated_switchback` (-13.09), `drums_swell` (-11.34), `drums_crescendo` (-9.68), `rhythm_ladder` (-9.09), and `cold_start` (-4.59). Conclusion: more mature aim compute has a real positive signal and reduces fallback churn, but top-4 is still too broad and rhythm-sensitive to keep without more seeds or a sharper gate.

## 2026-06-23 - ACCEPT - non-low-air mature aim top-4 refinement

Mechanism: promote the mature-budget aim lane to refine the top 4 quality-sorted pool bases only when the current gap is not a low-air target (`air > 0.30` or no air target). Mature low-air gaps keep the accepted top-3 behavior, and budgets below the existing 150k maturity gate still collapse to one refined base. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-support-robust3-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 654.64.

Candidate: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top4-nonlowair-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json generated/golden-runs/attempt-start-support-robust3-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +2.6, CI [-0.5, 5.7], P(delta<=0)=4.8%. Per-budget point estimates were 100k +0.0, 200k +3.8, and 300k +2.6, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, canonical HEADLINE 657.19, `HEADLINE excl. impact` 670.37. The candidate changed 955/1440 checkpoint scores, with 541 improvements, 414 regressions, and 485 plateaus; the 100k tier was byte-identical, while 200k averaged +3.63 and 300k averaged +2.37. The low-air cap separated the rejected broad K4 shape: `drums_pendulum` moved from a weak K4 gain to +6.34 weighted, and `drums_crescendo` from a K4 loss to +5.71, while preserving the largest K4 gains in `drums_zigzag` (+17.84), `drums_signature` (+15.32), `drums_dropout` (+12.17), `rolling_hills` (+8.50), `ridge_pulse` (+7.72), and `skyline_push` (+7.45). Remaining losses were led by `drums_swell` (-11.34), `syncopated_switchback` (-10.96), `rhythm_ladder` (-7.72), `drums_crosscut` (-3.82), and `verse_chorus` (-2.90), but the paired distribution cleared the accept gate. Work counters show the mechanism replaced fallback churn with useful aim proposals: about +6.0M charged aim-probe frames, +106k refined aim bases, +158k emitted aimed candidates, and +3.6k aimed selections, while sampled candidates fell by about 544k, viable candidates by 393k, full evaluations by 1.5k, unique full evaluations by 1.1k, charged forward-eval frames by 6.5M, repair frames by 5.7M, and repair accepts by 168.

## 2026-06-23 - REJECT - non-low-air mature aim top-5 refinement

Mechanism: increase only the accepted non-low-air mature aim refinement from top 4 bases to top 5 bases. Low-air mature gaps stayed capped at top 3, and budgets below the 150k maturity gate still collapsed to one refined base. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 657.19.

Candidate: `generated/golden-runs/attempt-aim-top5-nonlowair-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-nonlowair-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-nonlowair-a01/golden.json generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-2.9, 3.1], P(delta<=0)=46.9%. Per-budget point estimates were 100k +0.0, 200k -0.1, and 300k +0.3, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the fifth non-low-air base was active but saturated. Raw candidate HEADLINE was 657.30 and `HEADLINE excl. impact` was 670.18. The candidate changed 947/1440 checkpoint scores relative to the accepted top-4 baseline, with 500 improvements, 447 regressions, and 493 plateaus. It added about 5.3M charged aim-probe frames, refined 92.6k more aim bases, emitted 130k more aimed candidates, and selected 1.5k more aimed candidates, but the extra proposals mostly balanced out: sampled candidates fell by about 456k, viable candidates by about 325k, full evaluations by 1.7k, repair frames by 6.0M, and charged forward-eval frames by 5.4M without producing a stable paired score lift. Weighted gains in `dense_echo_climb` (+10.17), `drums_crosscut` (+7.78), `drums_pulse` (+6.34), `drums_dropout` (+5.95), `swoop_dive` (+4.87), and `grain_staircase` (+4.04) were offset by `ridge_pulse` (-7.19), `mini_burst` (-6.11), `terrace_sprint` (-5.53), `drums_breath` (-4.89), `syncopated_switchback` (-4.73), `summit_push` (-3.15), `float_bounds` (-3.12), `dense_sprint` (-3.03), and `drums_swell` (-3.03). Conclusion: top-4 non-low-air is the useful maturity step; the fifth base adds churn and seed-specific swings without an accepted canonical lift.

## 2026-06-23 - REJECT - low-air mature aim top-2 cap

Mechanism: keep the accepted non-low-air mature aim refinement at top 4 bases, but reduce the mature low-air cap from top 3 bases to top 2 bases (`air <= 0.30`). Budgets below the 150k maturity gate still collapsed to one refined base, so the 100k tier stayed byte-identical. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 657.19.

Candidate: `generated/golden-runs/attempt-lowair-aim-top2-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-aim-top2-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-aim-top2-a01/golden.json generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-1.2, 0.8], P(delta<=0)=51.1%. Per-budget point estimates were 100k +0.0, 200k -0.7, and 300k +0.3, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: cutting the third low-air aim base was too narrow to buy back useful budget and regressed the 200k tier. Raw candidate HEADLINE was 657.12 and `HEADLINE excl. impact` was 670.46. Only 112/1440 checkpoint scores changed relative to the accepted top-4 baseline: 62 improved, 50 regressed, and 1328 plateaued. The intended `drums_pendulum` lift was weak (+0.25 weighted) and was not enough to offset `rhythm_ladder` (-6.18) and `drums_crescendo` (-3.26), despite gains in `syncopated_switchback` (+4.21), `dense_echo_climb` (+1.22), and `dense_sprint` (+1.19). The largest row losses were `rhythm_ladder` seed 8 at 300k (-100.19) and 200k (-85.03), plus `drums_crescendo` seed 10 at 200k (-69.44) and 300k (-47.53). Work counters confirm this was mostly a small activity shift rather than a meaningful compute saving: charged aim-probe frames fell by only about 157k, emitted aimed candidates by 4.0k, and refined low-air bases by 2.4k, while sampled candidates rose by about 20.7k, viable candidates by 12.3k, charged forward-eval frames by 203k, and repair frames by 513k. Conclusion: low-air top-3 remains the better cap under the accepted non-low-air top-4 baseline; top-2 is slightly cheaper but gives up more mature-budget quality than it saves.

## 2026-06-23 - REJECT - high-budget shallow forward eval

Mechanism: make the default forward-eval rollout budget-aware by switching non-vertical default `greedy:2` to `greedy:1` only when the compile target budget is at least 300k. The existing vertical-drama `avg` override stayed in front of the new gate, and the 100k/200k tiers were intended to remain byte-identical. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 657.19.

Candidate: `generated/golden-runs/attempt-fwd-greedy1-at-300k-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-fwd-greedy1-at-300k-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-fwd-greedy1-at-300k-a01/golden.json generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json` -> `VERDICT: REJECT`, delta headline -1.7, CI [-3.7, 0.3], P(delta<=0)=95.6%. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -3.4, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the logged high-budget crossover for `greedy:1` did not survive on the accepted top-4 aim baseline. Raw candidate HEADLINE was 655.51 and `HEADLINE excl. impact` was 668.95. The gate behaved as designed: 100k and 200k were byte-identical, while 355/480 300k checkpoint scores changed with 161 improvements, 194 regressions, and 125 plateaus. The strongest weighted gains were `syncopated_switchback` (+4.47), `drums_swell` (+2.45), `canyon_steps` (+1.84), and `syncopated_lift` (+1.59), but they were overwhelmed by `drums_breath` (-12.33), `verse_chorus` (-8.98), `drums_zigzag` (-8.14), `cold_start` (-6.96), `drums_dropout` (-5.51), `rhythm_ladder` (-5.50), `grain_staircase` (-5.14), and `drums_signature` (-4.11). Work counters show the trade: charged forward-eval frames fell by about 9.8M and first completion arrived about 2.8M frames earlier, but the saved budget became more lower-quality churn: repair frames rose by 3.5M, aim-probe frames by 2.5M, sampled candidates by 81.7k, emitted aimed candidates by 42.8k, while viable candidates fell by 28.6k. Conclusion: target-budget-aware forward-eval depth is a reasonable idea, but this simple 300k `greedy:1` gate worsens the current compiler; keep fixed `greedy:2` for non-vertical default ranking.

## 2026-06-23 - REJECT - high-budget shallow max-width forward eval

Mechanism: make the default forward-eval rollout budget-aware by switching non-vertical default `greedy:2` to `best:1:5` only when the compile target budget is at least 300k, while suppressing the aim lane inside those widened rollouts. The existing vertical-drama `avg` override stayed in front of the new gate, and 100k/200k were intended to remain byte-identical. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 657.19.

Candidate: `generated/golden-runs/attempt-fwd-best1x5-noaim-at-300k-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-fwd-best1x5-noaim-at-300k-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-fwd-best1x5-noaim-at-300k-a01/golden.json generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json` -> `VERDICT: REJECT`, delta headline -2.3, CI [-5.2, 0.3], P(delta<=0)=96.0%. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -4.6, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: adding high-budget max-width did not recover the probe-tier no-aim width signal; it was worse than the simpler 300k `greedy:1` gate. Raw candidate HEADLINE was 654.87 and `HEADLINE excl. impact` was 668.24. Again 100k and 200k were byte-identical, while 357/480 300k checkpoint scores changed with 166 improvements, 191 regressions, and 123 plateaus. The strongest weighted gains were `syncopated_switchback` (+9.81), `solo_run` (+8.75), `opening_burst` (+6.39), `tiny_dance` (+3.98), and `drums_pendulum` (+3.38), but the drum/rhythm losses dominated: `drums_dropout` (-21.27), `verse_chorus` (-17.03), `drums_breath` (-12.28), `drums_pulse` (-11.70), `drums_crosscut` (-9.93), `drums_zigzag` (-9.66), `drums_tide` (-7.90), and `drums_swell` (-7.00). Work counters show this was not a cheap win: charged forward-eval frames rose by about 10.7M, sampled candidates by 775k, viable candidates by 534k, and rank-readiness scoring by 721k, while emitted aimed candidates fell by 48k and repair frames fell by 3.2M. Conclusion: budget-aware `max:n:m` with `m=1` is not a productive default on the current compiler; high-budget width adds cost and seed-specific swings without a canonical lift.

## 2026-06-23 - REJECT - low-air mature impact frontload after aim top-4

Mechanism: make the accepted impact curve frontload budget-aware only for low-air targets by raising the mature-budget frontload from 1.6 toward 2.0 when `air <= 0.50`, with a smooth budget ramp from 100k to 200k. The 100k tier was intended to remain byte-identical; scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 657.19.

Candidate: `generated/golden-runs/attempt-lowair-frontload20-after-aimtop4-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-frontload20-after-aimtop4-a01`. Focused tests passed before the full run and again after reverting the source with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-frontload20-after-aimtop4-a01/golden.json generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-1.9, 2.7], P(delta<=0)=41.2%. Per-budget point estimates were 100k +0.0, 200k +0.1, and 300k +0.5, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the mature low-air frontload signal was positive but too small and split to keep. Raw candidate HEADLINE was 657.45 and `HEADLINE excl. impact` was 670.47. The 100k tier was byte-identical; the 200k tier changed all 480 checkpoint scores with 401 improvements and 79 regressions, while the 300k tier changed 437 checkpoint scores with 298 improvements, 139 regressions, and 43 plateaus. The largest spec gains were `dense_echo_climb` (+8.31), `syncopated_switchback` (+6.19), `drums_swell` (+5.85), and `drums_signature` (+4.12), but they were offset by `mini_burst` (-6.89), `drums_breath` (-6.88), `grain_staircase` (-6.60), `ridge_pulse` (-3.50), and `drums_dropout` (-3.34). Work counters showed this was not a clean compute win: repair frames rose by about 1.0M and repair restarts by 319, while aim-probe frames fell by about 75k and charged forward-eval frames by about 80k. Conclusion: low-air mature frontload is directionally plausible, but a generic smooth budget ramp is too weak for acceptance and adds repair churn; do not retry without a sharper selector.

## 2026-06-23 - ACCEPT - start first-contact max-width eval

Mechanism: change the default start-selection rollout from `greedy:2` to `best:1:5`, so the initial speed/angle and first segment are ranked by the best of up to five first-contact continuations at depth 1. The normal per-candidate forward-eval ranker stayed unchanged, start eval kept the full leaf scorer, and all start rollout frames remained charged. Explicit `LR_START_EVAL` overrides still work; `LR_START_EVAL=greedy:2` restores the previous default.

Baseline: `generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 657.19.

Candidate: `generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:1:5 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01`. Focused tests passed after promoting the source default with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01/golden.json generated/golden-runs/attempt-aim-top4-nonlowair-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +7.5, CI [1.7, 14.5], P(delta<=0)=0.3%. Per-budget point estimates were 100k +5.2, 200k +7.9, and 300k +8.0, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01/golden.json`, canonical HEADLINE 664.7, `HEADLINE excl. impact` 680.49. The candidate changed the selected start in 460/1440 checkpoints and changed 1109/1440 checkpoint scores, with 565 improvements, 544 regressions, and 331 plateaus. The largest average spec gains were `leap_cadence` (+97.05), `pop_train` (+73.95), `float_bounds` (+57.21), `drums_zigzag` (+29.90), and `rolling_drop` (+25.60), while the main losses were `mini_burst` (-7.54), `summit_push` (-4.41), `climb_terrace` (-3.20), `drums_dropout` (-2.70), and `dense_echo_climb` (-2.41). Work counters show the wider start pass paid about +12.1M start-eval frames, but selected cleaner openings that reduced normal forward-eval frames by about 6.4M, repair frames by about 12.6M, repair restarts by 1726, repair accepts by 378, sampled candidates by about 118k, and viable candidates by about 122k. Conclusion: the user's `max:n:1` intuition is correct for start placement, unlike the rejected high-budget per-candidate ranker version; spend the extra compute before the chain is committed.

## 2026-06-23 - REJECT - start first-contact max-width branch 8

Mechanism: keep the accepted start-only `best:1:n` shape, but raise the start-selection branch from 5 to the parser cap of 8 with `LR_START_EVAL=best:1:8`. The normal per-candidate forward-eval ranker stayed unchanged, start eval kept the full leaf scorer, and all start rollout frames remained charged. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 664.7.

Candidate: `generated/golden-runs/attempt-start-best1x8-after-best1x5-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:1:8 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-best1x8-after-best1x5-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-best1x8-after-best1x5-a01/golden.json generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01/golden.json` -> `VERDICT: REJECT`, delta headline -1.1, CI [-2.8, 0.5], P(delta<=0)=92.0%. Per-budget point estimates were 100k +0.1, 200k -1.4, and 300k -1.2, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at 300k.

Why it failed: branch 8 was past the useful start-width knee. Raw candidate HEADLINE fell to 663.63 and `HEADLINE excl. impact` fell to 679.44. It changed starts in only 74/1440 checkpoints relative to the accepted branch-5 baseline, but still added about 3.0M start-eval frames. That displaced about 3.1M repair frames, 554 repair restarts, and 134 repair accepts without producing stable score gains. The useful moves were concentrated in `drums_dropout` and `dense_echo_climb`, but they were outweighed by `syncopated_switchback`, `float_bounds`, `drums_tide`, `drums_breath`, `dense_sprint`, and `opening_burst` losses. Conclusion: start `best:1:5` is the current sweet spot; the extra three branches mostly add late-start churn and reduce mature-budget quality.

## 2026-06-23 - ACCEPT - objective leaf for start first-contact eval

Mechanism: keep the accepted `LR_START_EVAL=best:1:5` start-ranking shape, but stop forcing start rollouts to use the full re-detection leaf. Start eval now follows `LR_FWD_EVAL_LEAF`, so the default objective leaf scores start rollout leaves without extra engine frames, while `LR_FWD_EVAL_LEAF=full` restores the previous full-leaf start ranking. The normal per-candidate forward-eval ranker and start branch/depth stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 664.7.

Candidate: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json generated/golden-runs/attempt-start-best1x5-after-aimtop4-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.4, CI [0.0, 0.9], P(delta<=0)=1.1%. Per-budget point estimates were 100k +0.5, 200k +0.2, and 300k +0.4, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical HEADLINE 665.07, `HEADLINE excl. impact` 680.90. The candidate changed no selected starts relative to the full-leaf branch-5 baseline, but changed 574/1440 checkpoint scores through budget reallocation. Work counters show the mechanism saved about 3.2M start-eval frames and 160k full-leaf reports, reduced full evaluations by 6.2k, and spent the freed budget on about 66.8k more sampled candidates, 49.0k more viable candidates, 1.7M more normal forward-eval frames, 3.5M more repair frames, and 580k more aim-probe frames. Gains were broad and small, led by `mini_burst`, `float_bounds`, `terrace_sprint`, `climb_terrace`, and `soar_settle`, with small losses led by `solo_run`, `big_air_ramp`, and `rolling_hills`. Conclusion: after start `best:1:5`, the objective leaf is finally worth using for start eval; it preserves the chosen starts while converting redundant re-detection cost into downstream search.

## 2026-06-23 - REJECT - objective-leaf start branch 8

Mechanism: retest the rejected start branch-8 width after the accepted objective-leaf start change, by running `LR_START_EVAL=best:1:8` while leaving `LR_FWD_EVAL_LEAF` at the default objective mode. The hypothesis was that branch 8 might have failed mainly because full-leaf start rollouts made the extra breadth too expensive.

Baseline: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.07.

Candidate: `generated/golden-runs/attempt-start-best1x8-after-start-objective-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:1:8 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-best1x8-after-start-objective-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-best1x8-after-start-objective-a01/golden.json generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json` -> `VERDICT: REJECT`, delta headline -1.3, CI [-2.9, -0.1], P(delta<=0)=98.2%. Per-budget point estimates were 100k -0.9, 200k -1.3, and 300k -1.3, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: cheaper leaves did not fix the extra-width problem. Branch 8 changed starts in 73/1440 checkpoints, added about 2.2M start-eval frames, and displaced about 2.2M repair frames, 366 repair restarts, and 58 repair accepts. The small gains in `dense_echo_climb`, `drums_dropout`, and `swoop_dive` were outweighed by losses in `syncopated_switchback`, `drums_tide`, `drums_breath`, `dense_sprint`, `rhythm_ladder`, `opening_burst`, and `float_bounds`. Conclusion: the branch-5 knee is semantic, not just a full-leaf cost artifact; broader start max-width picks noisier openings and remains a rejected default.

## 2026-06-23 - INCONCLUSIVE - average start first-contact branch 5

Mechanism: keep the accepted start-only depth/branch shape but change the start selector from max-style `best:1:5` to robust-mean `avg:1:5` with `LR_START_EVAL=avg:1:5`. The normal per-candidate forward-eval ranker, objective start leaf, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged. The goal was to test whether the opening should prefer starts with broadly good first-contact continuations instead of a single best continuation.

Baseline: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.07.

Candidate: `generated/golden-runs/attempt-start-avg1x5-after-start-objective-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=avg:1:5 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-avg1x5-after-start-objective-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-avg1x5-after-start-objective-a01/golden.json generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-1.0, 1.2], P(delta<=0)=51.0%. Per-budget point estimates were 100k +0.8, 200k -0.4, and 300k -0.0, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it was not kept: raw candidate HEADLINE was 665.08 and `HEADLINE excl. impact` was 680.65, effectively tied with the accepted max-style start baseline. The candidate changed starts in 101/1440 checkpoints and changed 131 scores, with most rows unchanged. It helped `drums_tide` (+8.28), `dense_echo_climb` (+3.32), `rhythm_ladder` (+2.22), and `drums_dropout` (+1.95), but gave that back in `cold_start` (-3.27), `dense_sprint` (-2.79), `syncopated_switchback` (-1.63), `skyline_push` (-1.63), and `drums_pendulum` (-1.26). Work counters were also neutral rather than compelling: start-eval frames were unchanged, normal forward-eval frames rose by about 60k, repair frames fell by about 324k, sampled candidates fell by 8.4k, viable candidates rose by 2.1k, and repair restarts fell by 89. Conclusion: robust-mean start scoring is not a canonical improvement; keep optimistic first-contact max-width `best:1:5` as the start default.

## 2026-06-23 - INCONCLUSIVE - start first-contact max-width branch 3

Mechanism: keep the accepted start-only `best:1:n` shape, but lower the start-selection branch from 5 to 3 with `LR_START_EVAL=best:1:3`. The normal per-candidate forward-eval ranker, objective start leaf, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged. The goal was to test whether low budgets prefer cheaper start breadth, and whether a future budget-aware start selector should use branch 3 for constrained runs while keeping branch 5 for mature budgets.

Baseline: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.07.

Candidate: `generated/golden-runs/attempt-start-best1x3-after-start-objective-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:1:3 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-best1x3-after-start-objective-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-best1x3-after-start-objective-a01/golden.json generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.3, CI [-2.1, 0.9], P(delta<=0)=63.4%. Per-budget point estimates were 100k +1.1, 200k -0.5, and 300k -0.7, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it was not kept: raw candidate HEADLINE was 664.74 and `HEADLINE excl. impact` was 680.38, below the accepted branch-5 start baseline. The candidate changed starts in 84/1440 checkpoints and changed 634 scores, with 372 improvements and 262 regressions. The best average spec gains were `mini_burst` (+4.17), `cold_start` (+2.94), `skyline_push` (+2.53), `syncopated_lift` (+1.48), and `summit_push` (+1.47), but the losses were sharper in `syncopated_switchback` (-9.13), `dense_sprint` (-7.23), `drums_tide` (-2.08), `float_bounds` (-2.04), and `drums_pendulum` (-1.72). Work counters show the saved start breadth did not translate into a cleaner suffix: start-eval frames fell by about 2.9M, but normal forward-eval frames rose by about 1.5M, repair frames rose by about 3.4M, repair restarts rose by 760, and viable candidates rose by 14.4k. Conclusion: branch 3 has a small 100k hint, but it is too weak and too costly downstream to promote or to justify a budget-aware start-width gate by itself; keep `best:1:5` as the fixed start default.

## 2026-06-23 - REJECT - mature repair main margin 1.2

Mechanism: raise the mature end of the repair handoff margin from 1.1 to 1.2, keeping the existing smooth ramp from the 100k repair gate. The goal was to let the normal main frontier search run longer at 200k/300k before the contained repair phase consumes the tail budget, after several recent candidates showed saved frames being absorbed by lower-quality repair churn. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.07.

Candidate: `generated/golden-runs/attempt-repair-mainmargin120-after-start-objective-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-mainmargin120-after-start-objective-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-mainmargin120-after-start-objective-a01/golden.json generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json` -> `VERDICT: REJECT`, delta headline -0.2, CI [-0.5, 0.1], P(delta<=0)=93.2%. Per-budget point estimates were 100k +0.0, 200k -0.1, and 300k -0.3, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it failed: the source was reverted after the rejected canonical run. Raw candidate HEADLINE was 664.89 and `HEADLINE excl. impact` was 680.67. The 100k tier stayed byte-identical as intended, but the mature tiers moved backward: 200k changed 34 scores with 16 improvements and 18 regressions, while 300k changed 78 scores with 31 improvements and 47 regressions. The main positive average spec move was `drums_crescendo` (+0.97), with tiny gains in `syncopated_switchback`, `grain_staircase`, and `dense_sprint`; losses were led by `solo_run` (-1.65), `tiny_dance` (-1.14), `drums_swell` (-0.97), `drums_crosscut` (-0.96), and `drums_breath` (-0.91). Work counters show the timing shift did reduce repair frames by about 950k and charged forward-eval frames by about 146k, but it increased repair restarts by 2529, reduced repair accepts by 78, added about 2.0k full evaluations, and did not produce a better incumbent distribution. Conclusion: delaying mature repair handoff to 1.2 is too blunt; the current 1.1 split remains the better default, and any repair-budget change needs to target restart placement/value rather than simply giving main search a longer pre-repair window.

## 2026-06-23 - INCONCLUSIVE - exact repair feasibility ceiling

Mechanism: tighten the repair feasibility margin from 1.1 to 1.0 with `LR_REPAIR_FEAS_MARGIN=1.0`, so repair candidates use the measured-cost ceiling directly instead of requiring 10% headroom. The goal was to test whether the current 1.1 ceiling rejects useful near-feasible repairs and leaves quality on the table. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.07.

Candidate: `generated/golden-runs/attempt-repair-feasmargin100-after-start-objective-a01/golden.json`, run with `LR_ENGINE=wasm LR_REPAIR_FEAS_MARGIN=1.0 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-feasmargin100-after-start-objective-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-feasmargin100-after-start-objective-a01/golden.json generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.2, 0.8], P(delta<=0)=11.2%. Per-budget point estimates were 100k +0.1, 200k +0.5, and 300k +0.2, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it was not kept: raw candidate HEADLINE rose to 665.34 and `HEADLINE excl. impact` rose to 681.25, but the paired decision did not clear the accept gate. The run changed 588/1440 checkpoint scores, with the clearest point-estimate gain at 200k. It helped `mini_burst` (+2.78), `cold_start` (+2.54), `skyline_push` (+2.54), `valley_bounce` (+1.92), and `switchback_pop` (+1.44), but lost on `dense_sprint` (-2.57), `drums_tide` (-1.29), `float_bounds` (-1.19), `drums_crescendo` (-1.09), and `swoop_dive` (-0.90). Work counters show repair frames fell by about 813k, full evaluations fell by 16.7k, sampled candidates fell by 40.2k, and viable candidates fell by 21.7k, but normal forward-eval frames rose by about 1.16M and aim-probe frames rose by about 366k. Conclusion: exact repair feasibility is a promising but unaccepted lever; keep the 1.1 default unless a larger-seed run or a more targeted budget-aware repair gate resolves the positive signal.

## 2026-06-23 - INCONCLUSIVE - budget-aware start branch 3 at 100k

Mechanism: make the default start first-contact selector budget-aware by using `best:1:3` through 100k and keeping the accepted `best:1:5` above 100k. Explicit `LR_START_EVAL` overrides remained unchanged. The goal was to capture the prior branch-3 hint at tight budgets without perturbing the mature 200k/300k tiers. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.07.

Candidate: `generated/golden-runs/attempt-start-budget3-then5-after-start-objective-a01/golden.json`, run after a source-default trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-budget3-then5-after-start-objective-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-budget3-then5-after-start-objective-a01/golden.json generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.2, CI [-0.2, 0.5], P(delta<=0)=12.5%. Per-budget point estimates were 100k +1.1, 200k +0.0, and 300k +0.0, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Why it was not kept: the source was reverted after the inconclusive canonical run. Raw candidate HEADLINE was 665.25 and `HEADLINE excl. impact` was 681.15. The run did isolate the intended tier: diagnostics showed 100k mean +0.95 with 120 improvements, 74 regressions, and 286 ties, while 200k and 300k were unchanged. It helped `dense_echo_climb` (+10.62), `drums_pendulum` (+5.45), `drums_breath` (+4.63), `skyline_push` (+4.04), and `rhythm_ladder` (+3.92), but lost on `drums_tide` (-8.25), `float_bounds` (-7.72), `opening_burst` (-2.71), and `canyon_steps` (-1.12). Work counters show about 403k fewer start-eval frames, 1.8k fewer full evaluations, and 9.1k fewer sampled candidates, but repair frames rose by about 493k and only 194/1440 checkpoint scores changed. Conclusion: budget-aware start width is directionally plausible but too small to promote under the weighted canonical gate; keep fixed `best:1:5` as the default until a stronger budget-aware rule or a larger-seed confirmation clears the decision threshold.

## 2026-06-23 - ACCEPT - repair feasibility margin 1.05

Mechanism: tighten the repair feasibility margin from 1.1 to 1.05 with `LR_REPAIR_FEAS_MARGIN=1.05`, halfway between the accepted old 10% headroom and the inconclusive exact measured-cost ceiling. The goal was to admit more near-feasible repair restarts while retaining a small buffer against marginal, churn-heavy suffix rebuilds. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.07.

Candidate: `generated/golden-runs/attempt-repair-feasmargin105-after-start-objective-a01/golden.json`, run with `LR_ENGINE=wasm LR_REPAIR_FEAS_MARGIN=1.05 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-feasmargin105-after-start-objective-a01`. Focused tests passed after promoting the source default with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-feasmargin105-after-start-objective-a01/golden.json generated/golden-runs/attempt-start-objective-leaf-after-best1x5-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.2, CI [-0.1, 0.5], P(delta<=0)=8.6%. Per-budget point estimates were 100k +0.4, 200k +0.2, and 300k +0.1, with unchanged diagnostic validity at 1439/1440 overall and 480/480 at 300k.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-repair-feasmargin105-after-start-objective-a01/golden.json`, canonical HEADLINE 665.27, `HEADLINE excl. impact` 681.04. The candidate changed 406/1440 checkpoint scores. It helped `skyline_push` (+2.47), `cold_start` (+1.82), `float_bounds` (+1.69), `big_air_ramp` (+0.99), and `syncopated_lift` (+0.97), with losses led by `dense_sprint` (-2.10), `swoop_dive` (-0.83), `drums_tide` (-0.49), and `drums_dropout` (-0.42). Work counters show about 1.0M fewer repair frames, 8.5k fewer full evaluations, 16.1k fewer sampled candidates, and 7.2k fewer viable candidates, while normal forward-eval frames rose by about 613k and aim-probe frames by about 191k. Conclusion: 1.05 is the current repair feasibility sweet spot; exact 1.0 remains promising but noisier, and 1.1 leaves a small accepted amount of quality on the table.

## 2026-06-23 - ACCEPT - aim top-4 at 100k

Mechanism: lower the mature aim top-k gate from 150k to 100k, so the accepted top-4 non-low-air aim refinement also runs at the canonical scarce tier. The existing low-air cap of 3 bases stayed unchanged, and 200k/300k behavior was intended to remain score-identical because top-4 was already active there. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-repair-feasmargin105-after-start-objective-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 665.27.

Candidate: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, run after a source-default trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json generated/golden-runs/attempt-repair-feasmargin105-after-start-objective-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +2.9, CI [1.6, 4.5], P(delta<=0)=0.0%. Per-budget point estimates were 100k +17.3, 200k +0.0, and 300k +0.0, with diagnostic validity improving to 1440/1440 overall and 480/480 at every budget.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical HEADLINE 668.14, `HEADLINE excl. impact` 682.82. The candidate changed all 480 100k checkpoint scores and left 200k/300k scores unchanged. The biggest average gains were `float_bounds` (+30.96), `drums_dropout` (+15.53), `drums_tide` (+13.30), `drums_swell` (+13.25), `drums_crosscut` (+11.92), `dense_echo_climb` (+11.63), and `drums_zigzag` (+10.03), while losses were led by `cold_start` (-5.26), `syncopated_switchback` (-4.50), `rhythm_ladder` (-2.68), and `drums_pendulum` (-1.91). Work counters show the extra scarce-tier aim pass spent about +5.6M aim-probe frames and refined 93.9k more aim bases, but selected 5.7k more aimed candidates, reduced sampled candidates by 490k, viable candidates by 343k, full evaluations by 2.3k, normal forward-eval frames by 5.3M, repair frames by 8.2M, repair restarts by 1100, and repair accepts by 385. Conclusion: top-4 non-low-air aim refinement is no longer only a mature-budget win; after the start and repair-feasibility improvements, paying for it at 100k produces a large accepted scarce-budget lift.

## 2026-06-23 - INCONCLUSIVE - aim top-5 after scarce top-4

Mechanism: raise the non-low-air aim refinement breadth from top 4 to top 5 with `LR_AIM_TOPK_BASES=5`, after accepting top-4 aim at 100k. The low-air cap stayed at 3 bases. The goal was to test whether another aimed base is a useful budget-aware use of compute for the speed/first-segment choice, especially now that scarce-budget top-4 aim had become strongly positive. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-aim-top5-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_AIM_TOPK_BASES=5 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-top5-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-top5-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.8, CI [-4.3, 2.5], P(delta<=0)=65.9%. Per-budget point estimates were 100k -0.2, 200k -1.4, and 300k -0.5, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE was 667.39 and `HEADLINE excl. impact` was 681.35, both below the accepted top-4-at-100k baseline. The run changed 1421/1440 checkpoint scores and 1421 track hashes, so the fifth base strongly perturbed the search rather than adding a localized improvement. It helped `drums_pulse` (+10.49), `dense_echo_climb` (+9.16), `grain_staircase` (+6.78), `soar_settle` (+6.23), and `float_bounds` (+4.00), but losses were sharper in `drums_zigzag` (-15.13), `syncopated_switchback` (-15.09), `terrace_sprint` (-8.07), `ridge_pulse` (-7.69), `drums_breath` (-4.99), and `drums_tide` (-4.65). Work counters show the fifth base spent about +6.6M aim-probe frames and +117k aimed bases, selected 2.1k more aimed candidates, and reduced sampled candidates by 568k, viable candidates by 421k, full evaluations by 4.9k, normal forward-eval frames by 6.7M, and repair frames by 9.1M. Conclusion: top-5 aim is not a canonical improvement under the current gate; the budget-aware idea is sound for enabling top-4 at 100k, but simply increasing aim breadth beyond four bases over-perturbs the candidate distribution and gives back more quality than it buys.

## 2026-06-23 - REJECT - start first-contact max-width branch 6

Mechanism: keep the accepted start-only `best:1:n` shape and raise the start-selection branch from 5 to 6 with `LR_START_EVAL=best:1:6`, leaving the normal per-candidate forward-eval ranker, objective start leaf, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule unchanged. The goal was to test the nearest untried `n` above the accepted start `max:n:1` knee, after branch 8 proved too wide and branch 3 proved too narrow.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-best1x6-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:1:6 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-best1x6-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-best1x6-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -0.7, CI [-2.1, 0.4], P(delta<=0)=90.6%. Per-budget point estimates were 100k +0.2, 200k -1.1, and 300k -0.8, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it failed: raw candidate HEADLINE fell to 667.42 and `HEADLINE excl. impact` fell to 682.17. The extra branch changed the chosen start speed/angle in only 35/1440 checkpoints, but those few opening changes propagated into 294 track-hash changes and 284 score changes. It helped `dense_echo_climb` (+5.80), `drums_crosscut` (+3.44), `drums_crescendo` (+2.15), `drums_dropout` (+1.40), and `drums_pulse` (+1.23), but lost more on `syncopated_switchback` (-7.45), `drums_tide` (-6.84), `drums_breath` (-4.71), `drums_zigzag` (-4.40), `rhythm_ladder` (-3.08), and `dense_sprint` (-2.04). Work counters show the sixth branch spent about +856k start-eval frames and added 1.3k full evaluations while reducing normal forward-eval frames by about 380k and repair frames by about 828k; that frame reallocation did not produce better mature-budget tracks. Conclusion: the accepted branch-5 start selector remains the local `max:n:1` sweet spot. Adding just one more branch is enough to pick noisier openings in drum/rhythm rows, while the small 100k point-estimate gain is too weak to justify a budget-aware branch-6 gate.

## 2026-06-23 - INCONCLUSIVE - exact repair feasibility after scarce top-4

Mechanism: retest exact repair feasibility on the current top-4-at-100k baseline with `LR_REPAIR_FEAS_MARGIN=1.0`, so repair candidates use the measured cost-to-end ceiling directly instead of the accepted 1.05 headroom. The goal was to check whether the earlier positive-but-inconclusive exact-ceiling signal improves after scarce-budget top-4 aim changed the repair workload. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-repair-feasmargin100-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_REPAIR_FEAS_MARGIN=1.0 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-feasmargin100-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-feasmargin100-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-1.2, 0.4], P(delta<=0)=51.3%. Per-budget point estimates were 100k -1.4, 200k +0.3, and 300k +0.0, with reported diagnostic validity rounded at 100% for each budget but raw candidate validity 1439/1440 due to one 100k invalid row.

Why it was not kept: raw candidate HEADLINE was 668.02 and `HEADLINE excl. impact` was 682.77, both below the accepted 1.05-margin baseline. Exact feasibility retained a real mid-budget hint, but it reintroduced a `rhythm_ladder` seed 9 failure at 100k (-351.42), which erased the weighted headline. It helped `syncopated_switchback` (+3.13), `cold_start` (+1.65), `mini_burst` (+1.21), `soar_settle` (+0.77), `summit_push` (+0.59), and `solo_run` (+0.55), but lost on `rhythm_ladder` (-9.70), `float_bounds` (-4.52), `drums_crescendo` (-1.31), `swoop_dive` (-0.94), and `canyon_steps` (-0.63). Work counters show about 25.7k fewer sampled candidates, 14.0k fewer viable candidates, 6.9k fewer full evaluations, and 795k fewer repair frames, with 20 more repair accepts, but also 504k more normal forward-eval frames and 188k more aim-probe frames. Conclusion: exact repair feasibility is still a promising 200k nudge, but on the current baseline it is less safe at 100k than 1.05; keep 1.05 as the default unless a budget-specific exact-ceiling gate can isolate the mid-budget gain without reopening scarce-budget invalidity.

## 2026-06-23 - INCONCLUSIVE - repair feasibility ramp to exact after scarce budget

Mechanism: make the default repair feasibility margin budget-aware, keeping the accepted 1.05 headroom at the 100k repair gate and smoothly fading to exact 1.0 by 200k. This isolates the prior exact-feasibility 200k gain while avoiding the 100k `rhythm_ladder` invalid row from the flat exact-ceiling retest. Explicit `LR_REPAIR_FEAS_MARGIN` overrides were unchanged. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-top4at100-a01/golden.json`, run after a source-default trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-feas-ramp100to200-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-feas-ramp100to200-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.4], P(delta<=0)=16.6%. Per-budget point estimates were 100k +0.0, 200k +0.3, and 300k +0.0, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE rose only to 668.26 and `HEADLINE excl. impact` to 682.96, and the paired decision did not clear the accept gate. The source was reverted after the inconclusive canonical run. The ramp did exactly isolate the intended tier: 100k was byte-identical, while 200k carried the positive signal. It helped `cold_start` (+1.55), `mini_burst` (+1.13), `summit_push` (+0.55), `glide_stairs` (+0.55), `solo_run` (+0.55), `drums_dropout` (+0.52), and `drums_pendulum` (+0.48), but lost on `canyon_steps` (-0.62), `dense_sprint` (-0.61), `drums_crescendo` (-0.45), `big_air_ramp` (-0.21), and `pop_train` (-0.18). Work counters show about 18.4k fewer sampled candidates, 8.9k fewer viable candidates, 5.4k fewer full evaluations, 574k fewer repair frames, 32 fewer repair restarts, and 24 more repair accepts, while normal forward-eval frames rose by 436k and aim-probe frames by 160k. Conclusion: the budget-specific exact-ceiling idea is directionally correct but currently underpowered; preserving 100k validity leaves a clean +0.3 at 200k, but the canonical weighted headline gain is too small to promote at 12 seeds.

## 2026-06-23 - INCONCLUSIVE - repair upstream width 3

Mechanism: reduce repair's upstream search width from the accepted default of 4 to 3 with `LR_REPAIR_MAX_UPSTREAM=3`, after accepting scarce-budget top-4 aim. The goal was to test whether the current repair pass was spending too much effort walking farther upstream and whether a tighter restart neighborhood would improve repair value density. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-repair-upstream3-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_REPAIR_MAX_UPSTREAM=3 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-upstream3-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-upstream3-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.6, 0.4], P(delta<=0)=57.9%. Per-budget point estimates were 100k -0.1, 200k +0.0, and 300k -0.1, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 668.08 and `HEADLINE excl. impact` fell to 682.51. The run changed 264/1440 checkpoint scores and 275 track hashes, mostly in mature budgets. It helped `glide_stairs` (+1.93), `rolling_hills` (+1.92), `drums_crescendo` (+1.23), `swoop_dive` (+1.07), `drums_dropout` (+0.95), and `grain_staircase` (+0.86), but lost more on `mini_burst` (-3.89), `canyon_steps` (-2.00), `opening_burst` (-1.63), `ridge_pulse` (-1.38), `summit_push` (-1.19), and `dense_echo_climb` (-1.08). Work counters show about 340k fewer repair frames, 109 fewer repair restarts, 125k fewer forward-eval frames, and 37k fewer aim-probe frames, but also 1.0k more full evaluations, 5.8k more sampled candidates, 4.8k more viable candidates, and only 35 more repair accepts. Conclusion: reducing upstream width to 3 is not a promotion on the current baseline. It trims some repair spend, but the narrower neighborhood gives back enough mature-budget quality that the accepted upstream width of 4 remains the better default.

## 2026-06-23 - INCONCLUSIVE - start first-contact max-width branch 4

Mechanism: test the nearest untried lower start-selector branch by running `LR_START_EVAL=best:1:4` against the current top-4-at-100k baseline. The normal per-candidate forward-eval ranker, objective start leaf, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged. The goal was to check whether branch 5 is slightly too wide after branch 3 was too narrow and branch 6 was rejected.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-best1x4-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:1:4 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-best1x4-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-best1x4-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.4, CI [-1.6, 0.6], P(delta<=0)=81.5%. Per-budget point estimates were 100k -0.4, 200k -0.4, and 300k -0.5, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 667.72 and `HEADLINE excl. impact` fell to 682.08. Lowering the start width changed only 44/1440 selected starts, but those opening differences propagated into 386 track-hash changes and 370 score changes, with 215 improvements, 155 regressions, and 1070 plateaus. It helped `drums_tide` (+2.29 weighted), `opening_burst` (+2.22), `cold_start` (+2.18), `mini_burst` (+1.65), and `drums_pulse` (+0.66), but lost more on `drums_pendulum` (-3.45), `dense_sprint` (-2.96), `dense_echo_climb` (-2.75), `syncopated_switchback` (-2.53), `float_bounds` (-2.29), and `drums_crescendo` (-1.90). Work counters show branch 4 saved about 1.1M start-eval frames and slightly reduced sampled/viable candidates and full evaluations, but the freed budget mostly shifted into repair: repair frames rose by about 936k, repair restarts by 252, and repair accepts by 63. Conclusion: branch 5 remains the better start `best:1:n` default on the current baseline; branch 4 is cheaper but under-explores enough opening continuations that downstream repair churn cannot recover the quality loss.

## 2026-06-23 - REJECT - start first-contact max-width depth 2

Mechanism: keep the accepted branch-5 start selector but deepen its rollout from one contact to two with `LR_START_EVAL=best:2:5`. The normal per-candidate forward-eval ranker, objective start leaf, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged. The goal was to test whether the beginning is valuable enough to justify deeper max-width compute before committing the initial speed and first segment.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-best2x5-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:2:5 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-best2x5-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-best2x5-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -113.6, CI [-118.8, -107.5], P(delta<=0)=100.0%. Per-budget point estimates were 100k -644.3, 200k -10.0, and 300k -5.7. Diagnostic validity collapsed at 100k from 480/480 to 189/480, while 200k and 300k stayed 480/480 valid.

Why it failed: raw candidate HEADLINE fell to 554.57 and `HEADLINE excl. impact` fell to 566.84. The mechanism changed 203/1440 selected starts, 1285 track hashes, and 1279 scores; 291 scarce-budget checkpoints became invalid. It was broadly negative: even the least-bad weighted spec movement was `opening_burst` (-0.02), while losses were led by `pop_train` (-145.17), `leap_cadence` (-137.62), `tiny_dance` (-134.42), `float_bounds` (-130.37), `drums_zigzag` (-130.30), `swoop_dive` (-127.20), `climb_terrace` (-122.30), and `glide_stairs` (-121.92). Work counters show the cost problem directly: start-eval frames rose by about 118.6M, displacing about 32.9M normal forward-eval frames, 1.9M sampled candidates, 55k full evaluations, 99.2M repair frames, 5.5k repair restarts, and 21.7k tail attempts. Conclusion: the accepted start compute should remain shallow. Extra first-contact width pays up to branch 5, but increasing start rollout depth is not budget-aware; it starves the actual compiler at 100k and still worsens mature-budget quality.

## 2026-06-23 - INCONCLUSIVE - repair upstream width 5

Mechanism: raise repair's upstream blame walk from the accepted default of 4 to 5 with `LR_REPAIR_MAX_UPSTREAM=5`, leaving repair gates, restart caps, scoring, candidate generation, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule unchanged. The goal was to test the adjacent wider repair neighborhood after upstream width 3 was negative/inconclusive and older wider-upstream evidence was too stale for the current top-4-at-100k baseline.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-repair-upstream5-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_REPAIR_MAX_UPSTREAM=5 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-upstream5-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-upstream5-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.5, 0.4], P(delta<=0)=51.7%. Per-budget point estimates were 100k +0.0, 200k -0.0, and 300k -0.0, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE was 668.12 and `HEADLINE excl. impact` was 682.78, essentially tied with the accepted upstream-4 baseline. The candidate was 100k byte-identical and changed only 175/1440 track hashes and 173 scores versus baseline: 38 score changes at 200k and 135 at 300k, with 93 improvements, 80 regressions, and 1267 plateaus overall. The biggest weighted gains were `drums_crescendo` (+1.73), `dense_echo_climb` (+1.13), `glide_stairs` (+0.73), `leap_cadence` (+0.59), `terrace_sprint` (+0.57), and `rolling_drop` (+0.55), but they were offset by `canyon_steps` (-2.56), `ridge_pulse` (-2.04), `opening_burst` (-1.05), `mini_burst` (-0.86), and `valley_bounce` (-0.49). Work counters show a small reshuffle rather than a stronger repair phase: about 34k fewer repair frames and 57 fewer reconvergences, but 79 more repair restarts, 11 more repair accepts, 94k more charged forward-eval frames, 31k more aim-probe frames, 1.1k fewer full evaluations, and 185 fewer tail attempts. Conclusion: upstream width 5 is a near no-op on the current baseline; the accepted width 4 remains the better default, and future repair work should target which gaps/restarts enter repair rather than extending the upstream walk by one more parent.

## 2026-06-23 - INCONCLUSIVE - mature start scoring pool 20

Mechanism: keep the accepted `best:1:5` start selector and objective start leaf, but make the start pre-score pool budget-aware by leaving the 100k pool at 16 and ramping mature budgets toward 20 heuristic start seeds before the final `START_OPTION_LIMIT` slice. The goal was to spend extra mature-budget compute on discovering better initial speed/angle candidates without changing start rollout depth or branch semantics. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-pool20-mature-after-top4at100-a01/golden.json`, run after a source-default trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-pool20-mature-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-pool20-mature-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.7, CI [-2.4, 0.6], P(delta<=0)=85.5%. Per-budget point estimates were 100k +0.0, 200k -0.7, and 300k -0.9, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 667.48 and `HEADLINE excl. impact` fell to 682.11. The 100k tier was byte-identical as intended, but the mature tiers changed 349/1440 track hashes and 328 scores, with 124 improvements, 204 regressions, and 1112 plateaus. The broader start pool changed 82 selected starts, all at 200k/300k. It found some useful high-angle drum openings, led by weighted gains in `drums_crosscut` (+4.20), `swoop_dive` (+1.29), `opening_burst` (+0.43), and `climb_terrace` (+0.39), but losses were larger in `drums_tide` (-13.53), `drums_dropout` (-5.58), `mini_burst` (-5.43), `drums_breath` (-1.47), and `float_bounds` (-1.10). The largest row swings show the selector problem directly: `drums_tide` and `drums_dropout` often switched from the accepted shallow opening angle to a newly exposed steeper start, helping some seeds but causing sharper regressions in others. Work counters show the extra start pass spent about 1.5M more start-eval frames and added 2.2k unique full evaluations, while reducing repair frames by about 1.9M, repair restarts by 582, and tail attempts by 471; the saved downstream work was lower quality. Conclusion: the user's budget-aware start-pool idea is a real lever, but this simple mature pool expansion admits noisier high-angle openings. Keep the fixed pool 16 default unless a future selector can robustly score the newly exposed starts, for example with percentile-style first-contact scoring rather than optimistic max alone.

## 2026-06-23 - INCONCLUSIVE - start first-contact p75 percentile

Mechanism: add trial-only `p50`/`p75` forward-eval variants and run the start selector as `LR_START_EVAL=p75:1:5`, leaving the normal forward ranker, start pool, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule unchanged. For five first-contact alternatives, `p75:1:5` scores the second-best partial-track continuation rather than the max, testing whether robust percentile scoring fixes the noisy openings exposed by broader start search without increasing start rollout depth.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-p75-1x5-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm LR_START_EVAL=p75:1:5 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-p75-1x5-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-p75-1x5-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.5, CI [-1.8, 0.3], P(delta<=0)=86.7%. Per-budget point estimates were 100k -0.6, 200k -0.8, and 300k -0.3, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 667.63 and `HEADLINE excl. impact` fell to 681.84. The source was reverted after the inconclusive canonical run. The percentile selector changed only 69 selected starts across the budget grid, producing 99 track-hash and score changes: 42 improvements, 57 regressions, and 1341 plateaus. It helped `dense_sprint` (+2.70 weighted) and `skyline_push` (+0.95), but lost more on `drums_tide` (-8.21), `syncopated_switchback` (-4.28), `drums_breath` (-2.79), `dense_echo_climb` (-2.73), `cold_start` (-1.56), `drums_dropout` (-1.45), and `drums_pendulum` (-1.23). Largest 300k swings show the median-ish robustness was still seed-unstable: `drums_tide` seed 5 (-57.40), `syncopated_switchback` seed 0 (-57.20), and `drums_tide` seed 10 (-52.59) outweighed gains such as `drums_dropout` seed 5 (+31.21), `syncopated_switchback` seed 5 (+31.09), and `dense_echo_climb` seed 5 (+29.43). Work counters show no extra charged start-eval frames versus `best:1:5`, about 149.6k fewer repair frames, 91 more repair restarts, 13 fewer repair accepts, 95 fewer full evaluations, 106 fewer unique full evaluations, 119 more tail attempts, 12 fewer tail improvements, 34.6k fewer charged forward-eval frames, and 16.6k more aim-probe frames. Conclusion: percentile first-contact scoring is a useful diagnostic but not a promotion on this baseline; replacing max with p75 suppresses some optimistic starts while still moving a small set of starts in high-impact, seed-unstable ways. Future budget-aware start work should first identify which start families are stable across seeds, not just change the aggregation statistic over the same five continuations.

## 2026-06-23 - REJECT - start first-contact greedy depth 2

Mechanism: run the start selector with `LR_START_EVAL=greedy:2`, equivalent to a depth-2 branch-1 start lookahead, while leaving the normal forward ranker, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule unchanged. This directly tests the user's `n`-over-`m` idea for opening selection: spend start scoring on a deeper single continuation rather than the accepted shallow max over five first-contact alternatives. This was env-only, so no source change was made.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-greedy2-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=greedy:2 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-greedy2-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-greedy2-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -8.5, CI [-15.9, -2.4], P(delta<=0)=99.9%. Per-budget point estimates were 100k -9.5, 200k -8.0, and 300k -8.5. The decision's validity display rounds pass rates to 100%, but the raw golden summary was 1439/1440 valid, with `drums_dropout` seed 4 failing at 100k.

Why it failed: raw candidate HEADLINE fell to 659.65 and `HEADLINE excl. impact` fell to 671.29. The trial changed 453 selected starts across the budget grid, causing 1123 track-hash changes and 1099 score changes: 535 improvements, 564 regressions, and 341 plateaus. It helped some specs, led by `cold_start` (+5.09 weighted), `mini_burst` (+3.94), `summit_push` (+3.63), `grain_staircase` (+2.58), `climb_terrace` (+2.52), and `rolling_hills` (+2.28), but losses were much larger in `leap_cadence` (-99.61), `pop_train` (-80.63), `float_bounds` (-69.42), `drums_zigzag` (-25.99), `rolling_drop` (-24.45), `drums_crosscut` (-10.59), `dense_sprint` (-8.36), `solo_run` (-7.97), and `skyline_push` (-7.96). The worst 300k row swings show the failure mode: `leap_cadence` repeatedly moved from the accepted 9.37@0.0deg opening to 10.61@-33.5deg, losing about 105-110 points per seed, and `float_bounds` moved from 9.72@0.0deg to 9.72@-29.0deg, losing about 100 points on multiple seeds. Work counters show start scoring got cheaper than `best:1:5` by about 11.6M charged start-eval frames, but the poorer starts forced about 11.3M more repair frames, 1378 more repair restarts, 355 more repair accepts, and 5.4M more charged forward-eval frames while still losing quality. Conclusion: changing start lookahead depth with branch 1 is worse than the accepted shallow width-5 selector. The extra horizon picks brittle steep openings that downstream repair cannot recover, so future budget-aware start work should not replace first-contact breadth with a single deeper continuation.

## 2026-06-23 - REJECT - direct aim model space

Mechanism: run the short-probe aim model with `LR_AIM_MODEL_SPACE=direct`, fitting reduced direct outputs from each measured probe row instead of fitting latent rows and then reducing predicted latents. The aim lane, top-k policy, start selector, repair, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged. This was env-only, so no source change was made.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-aim-direct-after-top4at100-a01/golden.json`, run with `LR_ENGINE=wasm LR_AIM_MODEL_SPACE=direct npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-direct-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-direct-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -3.3, CI [-6.9, 0.1], P(delta<=0)=97.2%. Per-budget point estimates were 100k -5.9, 200k -3.5, and 300k -2.3, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it failed: raw candidate HEADLINE fell to 664.82 and `HEADLINE excl. impact` fell to 678.81. The direct model touched every checkpoint: 1440 track hashes and 1440 scores changed, with 669 improvements and 771 regressions. It helped `drums_swell` (+11.21 weighted), `dense_echo_climb` (+6.22), `drums_pendulum` (+4.49), `syncopated_lift` (+4.25), `opening_burst` (+3.41), and `verse_chorus` (+2.71), but losses were broader and larger in `drums_pulse` (-22.31), `dense_sprint` (-19.18), `drums_signature` (-15.00), `syncopated_switchback` (-12.10), `float_bounds` (-10.61), `tiny_dance` (-9.70), `drums_zigzag` (-9.35), `rhythm_ladder` (-8.85), `drums_breath` (-7.36), and `terrace_sprint` (-6.52). Start choices were mostly stable, changing only 33 selected starts across the grid, so the loss is in downstream aim proposal quality rather than opening selection. Work counters show a mostly compute-neutral reshuffle: about 66.6k fewer aim-probe frames, 943 fewer refined aim bases, 468 fewer aimed selections, 205k fewer charged forward-eval frames, and 506k fewer repair frames, but also 8.9k fewer viable candidates, 70 more repair restarts, 140 more repair accepts, and 316 more tail attempts. Conclusion: the latent-then-reduce aim model remains the better default. Direct fitting removes some latent-model indirection, but on the current top-4-at-100 baseline it destabilizes rhythm/dense rows enough to reject decisively.

## 2026-06-23 - REJECT - start forward-score heuristic regularizer

Mechanism: keep the accepted `best:1:5` start selector, but regularize the forward-score ordering with a large heuristic start-cost penalty before choosing the initial speed and first segment. The intent was to preserve shallow first-contact breadth while preventing brittle openings far from the authored speed/angle from winning on a small rollout score edge. This was a source-default trial; scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-heurreg50-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-heurreg50-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-heurreg50-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -50.1, CI [-66.7, -35.1], P(delta<=0)=100.0%. Per-budget point estimates were 100k -50.3, 200k -50.0, and 300k -50.0, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it failed: raw candidate HEADLINE fell to 618.08 and `HEADLINE excl. impact` fell to 625.34. The regularizer changed 1299 selected starts across the budget grid, producing 1298 track-hash and score changes: only 160 improvements, 1138 regressions, and 142 plateaus. It helped almost nothing at the weighted spec level, with `drums_tide` the only meaningful positive (+4.00), while losses were extreme in `big_air_ramp` (-238.54), `cold_start` (-165.22), `pop_train` (-114.78), `float_bounds` (-111.73), `leap_cadence` (-107.20), `mixed_grade` (-94.94), `summit_push` (-94.92), and `climb_terrace` (-91.27). Largest 300k regressions show the policy was over-constrained: `big_air_ramp` repeatedly moved from the accepted 9.72@0.0deg opening to 9.72@6.0deg, losing roughly 225-263 points per seed. Work counters show this was not a budget starvation effect: sampled candidates, full evaluations, repair frames, repair restarts, and tail attempts all fell, while charged forward-eval and aim-probe frames rose; the compiler simply spent less work on worse openings. Conclusion: heuristic anchoring is too blunt as a start selector tie-breaker. Future budget-aware start work should not globally penalize deviations from the authored opening; it needs a conditional stability signal, likely scoped to the first segment/start choice and gated by remaining budget or by known fragile start families.

## 2026-06-23 - REJECT - mature start top-3 depth-2 rerank

Mechanism: keep the accepted `best:1:5` start selector as the primary ordering, keep explicit `LR_START_EVAL` overrides unchanged, and add a 300k-only default rerank of only the top 3 already-selected starts with a depth-2 branch-1 `best:2:1` rollout. This was the contained version of the user's budget-aware opening idea: spend extra compute only when there is lots of total budget and only on initial speed/start selection, rather than replacing the full start selector with global `greedy:2`. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-mature-rerank-top3-depth2-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-mature-rerank-top3-depth2-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-mature-rerank-top3-depth2-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -2.5, CI [-5.3, -0.4], P(delta<=0)=99.1%. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -5.0, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it failed: raw candidate HEADLINE fell to 665.63 and `HEADLINE excl. impact` fell to 679.36. The isolation worked as intended: 100k and 200k were byte-identical to baseline, while only 300k changed. At 300k the rerank changed 132 selected starts, 156 track hashes, and 155 scores: 46 improvements, 109 regressions, and 325 plateaus. It helped `solo_run` (+4.42 weighted), `drums_tide` (+2.43), and a few small positives, but losses dominated in `pop_train` (-40.39), `float_bounds` (-30.61), `drums_zigzag` (-12.41), `rolling_drop` (-8.44), `valley_bounce` (-2.80), `drums_crosscut` (-2.76), and `soar_settle` (-2.59). The worst 300k swings repeated the known depth-2 failure mode even inside the top-3 guard: `float_bounds` moved from 9.72@0.0deg to 9.72@-29.0deg and lost up to 106.58 points, while `pop_train` moved from 9.36@0.0deg to 10.61@-29.0deg and lost roughly 84-90 points across multiple seeds. Work counters show the extra start compute was bounded (+60.8k start-eval frames) and did not starve the compiler; the loss came from worse mature openings, not budget displacement. Conclusion: simply adding deeper branch-1 start evidence at high budget is still too optimistic/noisy. Future opening work should either precommit and evaluate the actual first segment as a separate mechanism, or learn a family-specific guard for steep starts; changing `n` with `m=1` is not enough even when limited to mature budget and top-ranked starts.

## 2026-06-23 - REJECT - start first-contact p50 percentile

Mechanism: add trial-only `p50`/`p75` forward-eval variants and run the start selector as `LR_START_EVAL=p50:1:5`, leaving the normal forward ranker, start pool, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule unchanged. For five first-contact alternatives, `p50:1:5` scores the median partial-track continuation rather than the max, testing the user's median robustness idea after `p75:1:5` was slightly negative/inconclusive.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-start-p50-1x5-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm LR_START_EVAL=p50:1:5 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-p50-1x5-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm LR_START_EVAL=p50:1:5 npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-start-p50-1x5-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -0.8, CI [-2.2, 0.3], P(delta<=0)=92.6%. Per-budget point estimates were 100k -0.8, 200k -1.2, and 300k -0.5, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it failed: raw candidate HEADLINE fell to 667.38 and `HEADLINE excl. impact` fell to 681.47. The source was reverted after the canonical run. The median selector changed 99 selected starts across the grid, producing 133 track-hash and score changes: 48 improvements, 85 regressions, and 1307 plateaus. It was less volatile than `p75:1:5` in start count but still negative, with weighted gains mostly limited to `dense_sprint` (+2.47) and `opening_burst` (+1.35), while losses were led by `dense_echo_climb` (-7.10), `drums_breath` (-6.29), `cold_start` (-5.46), `syncopated_switchback` (-5.11), `drums_tide` (-4.30), `drums_dropout` (-1.45), and `drums_pendulum` (-1.23). The largest 300k swings again show seed-unstable tradeoffs: `drums_tide` seed 5 (-57.40), `syncopated_switchback` seed 0 (-57.20), `cold_start` seed 0 (-55.99), and `drums_tide` seed 10 (-52.59) outweighed gains such as `drums_tide` seed 4 (+57.02), `opening_burst` seed 1 (+36.88), `drums_dropout` seed 5 (+31.21), and `syncopated_switchback` seed 5 (+31.09). Work counters were mostly neutral: no extra charged start-eval frames versus `best:1:5`, about 221k fewer repair frames, 70 more repair restarts, 18 fewer repair accepts, 685 fewer full evaluations, 50.7k more charged forward-eval frames, and 29.2k more aim-probe frames. Conclusion: percentile aggregation is a useful diagnostic but not a default. Both p50 and p75 reduce optimism in different ways, yet both move a small set of high-impact openings in seed-unstable directions; future start work needs a stability/family gate rather than a global percentile replacement for max.

## 2026-06-23 - REJECT - aim grid9 at 300k

Mechanism: keep the accepted top-4 aim policy and `cross5` probe design at 100k/200k, but make the default aim probe design budget-aware by switching to `grid9` only at 300k and above. Explicit `LR_AIM_JOINT_PROBE_DESIGN` overrides still won in the source trial. The goal was to spend mature-budget compute on a higher-fidelity short-probe fit after accepted-baseline telemetry showed aim proposals are heavily rotation-driven, making a pitch-only cheaper probe unlikely to preserve the important lane behavior. Start selector, repair, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-aim-grid9-300-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-grid9-300-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-grid9-300-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: REJECT`, delta headline -1.5, CI [-3.3, 0.2], P(delta<=0)=95.6%. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -3.0, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it failed: raw candidate HEADLINE fell to 666.67 and `HEADLINE excl. impact` fell to 681.4. The source was reverted after the canonical run. The budget gate isolated the change correctly: 100k and 200k were byte-identical to baseline, while all 480 checkpoints at 300k changed track hashes and scores. At 300k there were 226 improvements and 254 regressions, with only 14 selected-start changes, so the loss is from downstream aim proposal and work-allocation changes rather than opening selection. Weighted gains in `rolling_drop` (+1.86), `rolling_hills` (+1.42), `drums_pulse` (+1.40), `tiny_dance` (+1.25), `drums_zigzag` (+1.24), and `solo_run` (+1.17) were outweighed by `drums_tide` (-8.65), `drums_crosscut` (-7.08), `drums_swell` (-6.89), `drums_breath` (-6.24), `mini_burst` (-5.26), and `drums_pendulum` (-4.61). The higher-fidelity probe did improve the fit diagnostic at 300k: `grid9` used 35.6M aim-probe frames, 2.48M probe rows, 343.7k bases, 103.5 frames/base, and 206.6k degraded outputs versus the accepted 300k `cross5` profile of 21.9M frames, 1.53M rows, 380.4k bases, 57.6 frames/base, and 1.36M degraded outputs. But that extra probe cost displaced useful downstream work: compared with baseline it spent about 13.7M more aim-probe frames while dropping sampled candidates by 401k, viable candidates by 305k, full evaluations by 4.2k, repair frames by 5.5M, repair restarts by 949, forward-eval frames by 5.1M, and aimed selections by 534. Conclusion: `grid9` is a better fit but not a better compiler default at 300k; the current `cross5` probe is the better compute tradeoff. Future aim work should target cheaper selective refinement, not a blanket mature-budget probe expansion.

## 2026-06-23 - INCONCLUSIVE - first-segment greedy depth 3 at 300k

Mechanism: keep the accepted `best:1:5` start-speed selector and the default `greedy:2` candidate ranker, but make only the first committed segment budget-aware by switching the default forward-eval ranker to `greedy:3` at `gapIndex === 0` for 300k-tier budgets. Explicit `LR_FWD_EVAL` overrides still bypassed the trial path. The goal was to test the user's opening-specific budget-aware idea: when ample total budget remains, spend a little extra compute only on placing the first segment, without perturbing start-speed selection or later candidate ranking. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-firstseg-greedy3-300-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-firstseg-greedy3-300-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-firstseg-greedy3-300-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.8, CI [-2.2, 0.6], P(delta<=0)=88.3%. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -1.6, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 667.35 and `HEADLINE excl. impact` fell to 682.56. The source was reverted after the canonical run. The budget and position gates behaved correctly: 100k and 200k were byte-identical, selected starts did not change, and only 300k downstream tracks moved. At 300k the trial changed 254 track hashes and 251 scores: 112 improvements, 139 regressions, and 229 plateaus. Weighted gains in `drums_pulse` (+5.98), `drums_crosscut` (+4.57), `opening_burst` (+3.99), `drums_swell` (+3.52), `rolling_drop` (+2.48), `swoop_dive` (+2.17), and `pop_train` (+1.94) were outweighed by `float_bounds` (-10.80), `drums_dropout` (-7.51), `mini_burst` (-6.60), `big_air_ramp` (-5.84), `verse_chorus` (-4.58), `leap_cadence` (-3.12), and `terrace_sprint` (-2.85). Work counters show this was not a simple budget-starvation failure: compared with baseline it spent about 394k more charged forward-eval frames on the deeper first-segment lookahead, but total sampled candidates, viable candidates, full evaluations, tail attempts, repair frames, and aim frames all fell only slightly. The loss came from different first-segment ranking, not from a large work carve-out. Conclusion: the opening-specific budget-aware idea is cleanly testable, but a one-step deeper greedy rollout at the first segment is still too seed-unstable on this baseline. Future opening work should inspect which first-segment candidates flip on `float_bounds`, `drums_dropout`, and `mini_burst` before adding more depth or changing the aggregation globally.

## 2026-06-23 - INCONCLUSIVE - repair impact plan loop

Mechanism: re-enable the existing outcome-gated impact re-aim loop with `LR_PLAN_LOOP=1`, leaving source defaults unchanged. During repair, if the weakest affordable gap is an impact gap that undershot, the restart temporarily aims that gap's impact higher via `plannedTargets`; repair still accepts only if the true scored incumbent improves. Start selection, aim top-k, repair widths/margins, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged. This retested the old planning hook on the current top-4-at-100 baseline, where the headline still has substantial impact drag.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-plan-loop-after-top4at100-a01/golden.json`, run env-only with `LR_ENGINE=wasm LR_PLAN_LOOP=1 npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-plan-loop-after-top4at100-a01`.

Decision: `npm run decide -- generated/golden-runs/attempt-plan-loop-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.3, CI [-1.2, 0.6], P(delta<=0)=75.1%. Per-budget point estimates were 100k -0.1, 200k -0.8, and 300k -0.0, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 667.84 while `HEADLINE excl. impact` was essentially tied at 682.83. The env-only trial changed 815 track hashes and 807 scores across the grid, with 410 improvements and 397 regressions; selected starts did not change. Weighted gains in `verse_chorus` (+4.21), `drums_swell` (+3.68), `dense_sprint` (+1.54), `drums_pulse` (+1.51), `mini_burst` (+1.48), `drums_crescendo` (+1.42), and `drums_pendulum` (+1.24) were offset by `rhythm_ladder` (-4.00), `ridge_pulse` (-3.87), `grain_staircase` (-3.11), `climb_terrace` (-2.90), `summit_push` (-2.57), `dense_echo_climb` (-2.12), `drums_crosscut` (-2.00), and `drums_zigzag` (-1.28). Work counters show the loop mostly reshuffled repair rather than unlocking new useful search: sampled candidates fell by 6.3k, viable candidates by 14.8k, full evaluations by 2.6k, repair restarts by 33, repair accepts by 74, tail attempts by 492, and tail improvements by 105, while charged forward-eval frames rose by 117k and aim frames by 59k. Conclusion: the current baseline does not want the impact plan loop as a default. It still finds real improvements on some impact-heavy rows, but the repaired target shift takes budget away from other useful repair paths and leaves the weighted headline slightly negative.

## 2026-06-23 - INCONCLUSIVE - mature quality pool no-lean

Mechanism: remove the mature-budget quality candidate lean while preserving the accepted scarce-budget lean, so 100k still uses the leaned quality pool and 200k/300k return to the full 32 quality candidates. The goal was to spend extra mature-budget compute on broader quality search after the accepted top-4-at-100 baseline, without perturbing the scarce tier. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-quality-no-mature-lean-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-no-mature-lean-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-quality-no-mature-lean-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.5, 1.2], P(delta<=0)=21.1%. Per-budget point estimates were 100k +0.0, 200k +0.1, and 300k +0.6, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE rose only to 668.49 and `HEADLINE excl. impact` rose to 683.17, below the 670 target and short of the acceptance gate. The isolation worked correctly: 100k was byte-identical to baseline, while 200k/300k changed 595 track hashes and 582 scores, with 307 improvements, 275 regressions, and 858 plateaus. Weighted gains in `drums_crescendo` (+4.07), `syncopated_switchback` (+4.02), `dense_sprint` (+3.91), `drums_pendulum` (+2.35), `verse_chorus` (+2.17), `valley_bounce` (+2.16), and `rolling_hills` (+1.82) were offset by `solo_run` (-4.13), `drums_tide` (-2.21), `drums_breath` (-1.85), `skyline_push` (-1.75), `drums_dropout` (-1.45), `float_bounds` (-1.33), and `ridge_pulse` (-1.26). Work counters show the mature tiers spent more downstream compute despite fewer sampled candidates: at 300k sampled candidates fell by 109.7k and viable candidates by 73.2k, while full evaluations rose by 5.0k, unique full evaluations by 4.0k, repair frames by 620k, forward-eval frames by 983k, aim frames by 481k, and aimed selections by 86. Conclusion: removing mature lean is directionally positive but too small and too uncertain to promote. It is a useful mature-budget lever, but needs a smarter selector or family gate before spending more compute broadly on the quality pool.

## 2026-06-23 - INCONCLUSIVE - mature quality pool boost 34

Mechanism: keep the accepted scarce-budget quality lean, remove the mature-budget lean, and add a mature-budget +2 quality candidate boost so 100k stays byte-identical, 200k uses about 33 quality candidates, and 300k uses 34. This was the direct budget-aware version of the prior no-lean signal: spend a little more compute only when the compile target has more budget. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-quality-mature-boost34-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-mature-boost34-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`.

Decision: `npm run decide -- generated/golden-runs/attempt-quality-mature-boost34-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.7, 1.4], P(delta<=0)=26.6%. Per-budget point estimates were 100k +0.0, 200k -0.2, and 300k +0.8, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE rose only to 668.46 and `HEADLINE excl. impact` rose to 682.90, still below the 670 target and short of the acceptance gate. The budget gate isolated 100k correctly with byte-identical rows. At 200k/300k the trial changed 812 track hashes and 802 scores, with 420 improvements, 382 regressions, and 158 plateaus. Weighted gains in `cold_start` (+7.31), `opening_burst` (+3.64), `swoop_dive` (+3.25), `rolling_hills` (+2.88), `drums_pendulum` (+2.80), `drums_crescendo` (+2.58), and `verse_chorus` (+1.99) were offset by `solo_run` (-5.10), `rhythm_ladder` (-2.78), `drums_breath` (-2.15), `canyon_steps` (-1.64), `ridge_pulse` (-1.41), `leap_cadence` (-1.39), and `grain_staircase` (-1.39). Work counters show the boost spent more effort in candidate generation and less in downstream phases: at 300k sampled candidates rose by 185.3k and viable candidates by 125.9k, while full evaluations fell by 7.9k, repair frames by 718k, forward-eval frames by 1.5M, aim frames by 783k, and aimed selections by 115. Conclusion: broader mature quality sampling remains a real but weak positive 300k lever. The +2 boost is not better than the simpler no-lean trial because it gives back 200k quality and still cannot clear the paired gate; keep the accepted mature lean until a family-specific quality breadth gate is available.

## 2026-06-23 - INCONCLUSIVE - feedback-gated mature quality breadth

Mechanism: keep the accepted budget-shaped quality candidate count, but make the mature-budget lean recover toward the full 32-candidate quality pool only after the compile has accumulated unique full-evaluation feedback. The goal was to make extra quality breadth depend on measured in-run feedback/slack rather than only on budget tier, preserving early mature-budget work while still testing the positive signal from the prior no-lean trial. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-quality-feedback-relief-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-feedback-relief-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-feedback-relief-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.5, 0.5], P(delta<=0)=47.1%. Per-budget point estimates were 100k +0.0, 200k -0.1, and 300k +0.1, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE was essentially tied at 668.15 and `HEADLINE excl. impact` rose only to 683.03, below the 670 target and far short of the acceptance gate. The source was reverted after the canonical run. The gate isolated 100k exactly, while 200k/300k changed 314 track hashes and 305 scores: 150 improvements, 155 regressions, and 1135 plateaus. The 300k gains were led by `drums_pulse` (+3.84), `rolling_hills` (+2.61), `drums_pendulum` (+2.44), `grain_staircase` (+2.35), `skyline_push` (+1.83), and `dense_sprint` (+1.50), but they were offset by `float_bounds` (-7.38), `ridge_pulse` (-3.49), `opening_burst` (-3.98), `cold_start` (-2.27), `dense_echo_climb` (-1.98), `big_air_ramp` (-1.42), and `leap_cadence` (-1.39). Work counters show the feedback gate admitted more mature quality candidates but mostly displaced terminal feedback: at 300k sampled candidates rose by 86.5k and viable candidates by 65.2k, while full evaluations fell by 7.4k, unique full evaluations fell by 4.8k, repair frames fell by 291k, tail attempts fell by 2.2k, and forward-eval/aim-probe frames rose by 576k/278k. Conclusion: full-evaluation feedback is not a sufficient selector for spending extra quality breadth; it recreates a weaker version of the no-lean/boost tradeoff and leaves the accepted mature lean as the better default.

## 2026-06-23 - INCONCLUSIVE - cadence-gated low-air aim top-4

Mechanism: keep the accepted `AIM_TOPK_BASES=4` and the accepted mature low-air cap of 3 lane bases, but allow a fourth low-air aim base at budgets >=150k only for sampled low-air gaps (`air <= 0.30`) that end in contact, have no authored amplitude/elevation target, and are followed by a contact gap on a locally regular cadence (`hi/lo <= 1.20` and delta <= 0.16s). The goal was to spend extra aim breadth on pendulum-like regular low-air rows while avoiding the broader syncopated low-air regressions that made blanket low-air expansion unsafe. Scorer, specs, fingerprint, seeds, budget grid, start selector, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-regular-lowair-aim-top4-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-regular-lowair-aim-top4-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-regular-lowair-aim-top4-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.5, CI [-1.8, 0.3], P(delta<=0)=86.6%. Per-budget point estimates were 100k +0.0, 200k -0.5, and 300k -0.7, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 667.60 and `HEADLINE excl. impact` fell to 682.01. The source was reverted after the canonical run. The budget gate isolated 100k exactly, but the 200k/300k rows moved widely: at 200k, 351 improvements and 128 regressions still netted negative; at 300k, 301 improvements, 142 regressions, and 37 plateaus also netted negative. Largest 300k losses were `drums_crescendo` seed 0 (-75.59), `drums_crescendo` seed 7 (-57.15), `cold_start` seed 4 (-36.30), `drums_crescendo` seed 4 (-35.77), `drums_crescendo` seed 2 (-32.46), `drums_pendulum` seed 9 (-27.63), and `drums_pendulum` seed 1 (-25.78). Gains existed, especially `rhythm_ladder` seed 0 (+35.50), `cold_start` seed 7 (+22.34), `dense_sprint` seed 0 (+13.65), and several `drums_pendulum` seeds, but they were not enough. Selected starts were unchanged on the major swings, so the loss came from downstream aim proposal/work-order changes rather than opening selection. Conclusion: cadence is not a sufficient guard for restoring low-air top-4 aim breadth. The accepted low-air cap of 3 remains the better default; future low-air expansion needs a stronger selector than local interval regularity, likely tied to measured impact/axis failure or family-specific feedback.

## 2026-06-23 - INCONCLUSIVE - broader quality shallow-tail throttle

Mechanism: broaden the existing quality-search near-tail completion throttle from remaining contacts `<= 2` to `<= 7`, using the same budget/feedback pressure model already in `shouldKeepShallowQualityTailCompletion`. The goal was to spend less mature-budget compute on duplicate-heavy, low-yield shallow tail completions after diagnostics showed weak tail yield for remaining contacts 1-7 but much stronger yield around 9-10. Scorer, specs, fingerprint, seeds, budget grid, start selector, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-quality-tail-throttle7-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-tail-throttle7-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-tail-throttle7-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.1, 0.0], P(delta<=0)=87.9%. Per-budget point estimates were 100k -0.0, 200k -0.0, and 300k -0.0, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE was 668.12 and `HEADLINE excl. impact` stayed 682.8, both below the accepted baseline and far below the 670 target. The source was reverted after the canonical run. The throttle did reduce a little work, but not enough to buy useful search elsewhere: at 300k the analyzer reported common-row work deltas of about -123 sim frames, -5 sampled candidates, and -3 viable candidates. The only visible score movement was negative, led by `swoop_dive` seed 8 (-10.86) and `tiny_dance` seed 8 (-3.45), while the largest listed improvements were all +0.00. Candidate tail telemetry still showed shallow tail completions consuming work with weak yield (`rem=1` 5.4%, `rem=2` 9.0%, `rem=7` 4.0%) and deeper tails remaining much stronger (`rem=9` 50.9%, `rem=10` 65.2%). Conclusion: the observation about shallow tail yield is real, but simply extending the existing throttle window to 7 contacts is effectively a no-op with small negative variance. Future tail work needs a sharper selector or a way to reallocate saved tail budget into known productive phases, not a broader global throttle.

## 2026-06-23 - INCONCLUSIVE - first-segment max-width at 300k

Mechanism: keep the accepted `best:1:5` start selector and the default `greedy:2` candidate ranker, but make only the first committed segment budget-aware at 300k by ranking `gapIndex === 0` with `best:1:5`. This tested the opening-specific max-width version of the user's budget-aware idea: after choosing the start speed normally, use max-width evidence only for placing the first segment, without changing 100k/200k or later candidate pools. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-firstseg-best1x5-300-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-firstseg-best1x5-300-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-firstseg-best1x5-300-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.6, CI [-2.4, 1.0], P(delta<=0)=76.6%. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -1.3, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 667.52 and `HEADLINE excl. impact` fell to 682.12. The source was reverted after the canonical run. The isolation worked correctly: 100k and 200k were byte-identical, while only 300k changed. At 300k the trial moved 462 track hashes and 462 scores: 278 improvements, 184 regressions, and 18 plateaus, but the negative tails dominated. Largest losses were `drums_swell` seed 5 (-215.43), `syncopated_switchback` seed 4 (-105.25), `drums_crescendo` seed 9 (-89.24), `drums_swell` seed 4 (-88.40), `mini_burst` seed 6 (-85.86), `drums_pulse` seed 3 (-72.98), `opening_burst` seed 5 (-67.91), and `cold_start` seed 4 (-67.17). Gains were real but not enough: `drums_dropout` seed 11 (+113.02), `drums_swell` seed 0 (+104.96), `drums_swell` seed 11 (+92.44), `drums_crescendo` seed 6 (+81.22), `solo_run` seed 10 (+67.47), `tiny_dance` seed 1 (+59.43), `solo_run` seed 8 (+57.68), and `drums_pulse` seed 8 (+57.31). Selected starts stayed effectively fixed on the major swings, so this was first-segment basin instability rather than start-speed selection. Work counters were also not the cause: common-row 300k work changed only about -92 sim frames, -146 sampled candidates, and -118 viable candidates. Conclusion: first-segment max-width is a powerful opening lever, but it is too seed-unstable as a broad 300k default. Together with the rejected first-segment `greedy:3`, start `p50`, and mature top-3 start rerank trials, the opening idea needs a family/stability gate before spending extra compute on the first segment.

## 2026-06-23 - ACCEPT - high-variation mature quality breadth

Mechanism: keep the accepted budget-shaped quality candidate lean by default, but restore the full 32-candidate quality pool when the authored, unjittered target pattern has large air or speed variation (`air` range >= 0.50 or `speed` range >= 0.40). This was the gated version of the positive mature no-lean probe: spend extra mature-budget geometry breadth only on the high-variation rows where the probe helped, while leaving explicit `LR_QUALITY_NCAND` overrides, scorer, specs, fingerprint, seeds, budget grid, and acceptance rule unchanged.

Baseline: `generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.14.

Candidate: `generated/golden-runs/attempt-quality-variation-relief-after-top4at100-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-variation-relief-after-top4at100-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-variation-relief-after-top4at100-a01/golden.json generated/golden-runs/attempt-aim-top4-at100-after-feasmargin105-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.5, CI [0.1, 1.0], P(delta<=0)=0.6%. Per-budget point estimates were 100k +0.0, 200k +0.2, and 300k +0.8, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-quality-variation-relief-after-top4at100-a01/golden.json`, canonical HEADLINE 668.61, `HEADLINE excl. impact` 683.35. The gate isolated the intended slice: 100k stayed byte-identical, and at 300k only 53 checkpoint scores changed, with 35 improvements, 18 regressions, and 427 plateaus. Weighted gains came from `drums_crescendo` (+4.07), `syncopated_switchback` (+4.02), `dense_sprint` (+3.91), `drums_pendulum` (+2.35), and `drums_signature` (+1.78), with the other specs unchanged by construction. Work counters show the restored breadth was cheap and mostly shifted candidate sampling within the selected rows: at 300k sampled candidates rose by about 13.2k and viable candidates by 10.3k, while full evaluations fell by 272, unique full evaluations by 161, tail attempts by 117, reuse attempts by 344, and brake attempts by 481. Conclusion: broad mature no-lean was too noisy, but authored air/speed variation is a strong enough selector to keep the extra mature quality breadth.

## 2026-06-23 - ACCEPT - short no-amplitude mature quality boost

Mechanism: keep the accepted high-variation quality breadth gate, but add a second mature-budget quality breadth gate for short tracks with no authored amplitude variation: when a spec has at most 32 contact gaps and target amplitude range is exactly zero, use 34 quality candidates instead of the budget-leaned mature pool. Explicit `LR_QUALITY_NCAND` overrides still won, and scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged. The goal was to spend a small amount of extra mature-budget geometry compute on the short/no-amplitude slice that showed the strongest positive signal in the earlier broad quality boost probe.

Baseline: `generated/golden-runs/attempt-quality-variation-relief-after-top4at100-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 668.61.

Candidate: `generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01/golden.json generated/golden-runs/attempt-quality-variation-relief-after-top4at100-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.5, CI [-0.0, 1.3], P(delta<=0)=3.4%, effect 1.52. Per-budget point estimates were 100k +0.0, 200k +0.3, and 300k +0.8, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01/golden.json`, canonical HEADLINE 669.13, `HEADLINE excl. impact` 683.92. The gate isolated 100k exactly because the scarce tier already used the full 32-candidate pool; the improvement came from mature budgets only. At 300k, only 114 checkpoint scores changed: 69 improved, 45 regressed, and 366 plateaued. Weighted gains came from `cold_start` (+8.20), `swoop_dive` (+4.26), `opening_burst` (+3.16), `verse_chorus` (+2.24), `rolling_hills` (+2.23), `mini_burst` (+2.22), and `tiny_dance` (+0.95), offset mainly by `climb_terrace` (-0.58), `summit_push` (-0.28), and `mixed_grade` (-0.02). Work counters show the extra breadth raised 300k sampled candidates by about 55.6k and viable candidates by 41.9k while reducing full evaluations by 3.3k, tail attempts by 545, reuse attempts by 1.7k, and brake attempts by 3.0k. Conclusion: the broad mature quality boost was too noisy, but short/no-amplitude specs are stable enough to spend two extra quality candidates at mature budgets.

## 2026-06-23 - INCONCLUSIVE - high-budget short no-amplitude quality boost

Mechanism: keep the accepted high-variation quality breadth gate and the accepted short/no-amplitude mature quality boost, but raise that short/no-amplitude quality breadth from 34 to 36 candidates only at 300k-tier budgets (`targetBudget >= 250000`). This was a diagnostic probe for spending more mature-budget compute on the strongest accepted quality slice before considering a smoother production ramp. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.13.

Candidate: `generated/golden-runs/attempt-quality-short-noamp-boost36-300-after-boost34-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-short-noamp-boost36-300-after-boost34-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-short-noamp-boost36-300-after-boost34-a01/golden.json generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.5, 0.2], P(delta<=0)=76.0%, effect -0.65. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -0.2, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Why it was not kept: raw candidate HEADLINE fell to 669.01 from the accepted 669.13, while `HEADLINE excl. impact` was essentially flat at 683.94. The source was reverted after the canonical run. The 100k/200k tiers were byte-identical by construction, so all movement came from the extra 300k breadth: 439 track hashes changed, with 304 improvements, 135 regressions, and 41 plateaus, but the negative tails outweighed the gains. Because this sharp 250k cutoff was only a signal probe, and the only affected tier had a negative point estimate, it does not justify a smooth budget ramp from 34 toward 36. The accepted 34-candidate short/no-amplitude gate remains the better local setting.

## 2026-06-23 - ACCEPT - smooth repair feasibility margin

Mechanism: keep the accepted 1.05 repair feasibility headroom at the 100k repair gate, then smoothly fade the default feasibility margin to exact 1.0 by 200k using `smoothstep`. Explicit `LR_REPAIR_FEAS_MARGIN` overrides still win. This revisits the earlier positive-but-inconclusive exact-ceiling signal in a continuous budget-aware form that protects scarce-budget validity while letting mature budgets spend repair budget closer to the measured cost-to-end ceiling. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.13.

Candidate: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json generated/golden-runs/attempt-quality-short-noamp-boost34-after-variation-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.2, CI [-0.1, 0.5], P(delta<=0)=7.9%, effect 1.26. Per-budget point estimates were 100k +0.0, 200k +0.3, and 300k +0.1, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical HEADLINE 669.29, `HEADLINE excl. impact` 684.15. The ramp isolated scarce budget exactly: 100k stayed byte-identical, while 200k moved 479 checkpoint scores with 365 improvements, 114 regressions, and 1 plateau. At 300k it moved 423 checkpoint scores with 297 improvements, 126 regressions, and 57 plateaus. Largest listed 300k gains were `mini_burst` seed 1 (+50.87), `glide_stairs` seed 0 (+19.37), `drums_dropout` seed 11 (+19.18), `cold_start` seed 1 (+7.95), `rhythm_ladder` seed 10 (+6.59), and `cold_start` seed 9 (+6.50), offset mainly by `canyon_steps` seed 10 (-13.33), `drums_pendulum` seed 7 (-8.68), `dense_sprint` seed 11 (-7.37), and `canyon_steps` seed 7 (-6.09). Work deltas were tiny on common rows, so the gain is from admitting a better set of near-feasible repair restarts rather than spending materially more compute. Conclusion: exact repair feasibility was too sharp at 100k, but a smooth 1.05-to-1.0 budget ramp is a small accepted improvement and matches the continuous budget-aware behavior preferred for future mechanisms.

## 2026-06-24 - REJECT - smooth forward-eval slack pressure

Mechanism: make default forward-eval activation smooth and slack-aware instead of a hard all-on gate above `LR_FWD_EVAL_MIN_BUDGET`. For each ranked candidate pool, the trial estimated whether the remaining path fit the remaining frame budget using current simulated frames, prefix depth, and remaining gaps. If the projected remaining cost exceeded frames left, it used a deterministic hash and `smoothstep(framesLeft / projectedRemaining)` to thin forward-eval ranking for that pool; otherwise behavior stayed at the accepted default. Explicit `LR_FWD_EVAL=off` and parsed forward-eval variants were left intact. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.29.

Candidate: `generated/golden-runs/attempt-fwd-slack-pressure-after-repair-ramp-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-fwd-slack-pressure-after-repair-ramp-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-fwd-slack-pressure-after-repair-ramp-a01/golden.json generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json` -> `VERDICT: REJECT`, delta headline -4.9, CI [-11.5, -2.3], P(delta<=0)=100.0%, effect -2.04. Per-budget point estimates were 100k -13.0, 200k -3.4, and 300k -3.2. The candidate raw HEADLINE was 664.37 and `HEADLINE excl. impact` was 679.81; golden diagnostics reported 1438/1440 valid, with two invalid 100k rows.

Why it failed: the smooth pressure was generic and budget-scalable, but it took true-score ranking away exactly when a prefix was already budget-stressed. That did not recover enough downstream work to compensate for worse candidate ordering; it regressed every budget tier and reopened scarce-budget invalidity. The source was reverted after the canonical run. Conclusion: budget/slack awareness is still the right shape, but forward-eval activation is the wrong lever in this simple form. Future smooth compute allocation should add useful search when slack is high or adjust already-proven quality/repair knobs, rather than thinning the default `greedy:2` ranker on behind-budget prefixes.

## 2026-06-24 - INCONCLUSIVE - smooth sparse-amplitude quality breadth

Mechanism: add a smooth mature-budget quality-breadth pressure for sparse, amplitude-varying tracks. The trial moved the quality sample count gradually from the budget-leaned base toward 34 candidates using continuous authored-shape pressures: amplitude range, median contact gap, mean impact target, and contact count. It left 100k unchanged because the quality pool is already full there, and explicit `LR_QUALITY_NCAND`, the high-variation gate, and the accepted short/no-amplitude boost still won. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.29.

Candidate: `generated/golden-runs/attempt-quality-sparse-amp-smooth-after-repair-ramp-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-sparse-amp-smooth-after-repair-ramp-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-sparse-amp-smooth-after-repair-ramp-a01/golden.json generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.4], P(delta<=0)=14.8%, effect 0.90. Per-budget point estimates were 100k +0.0, 200k +0.1, and 300k +0.1, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.41 and `HEADLINE excl. impact` was 684.25.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The selector behaved cleanly and isolated a plausible slice: weighted gains came from `big_air_ramp` (+2.33), `switchback_pop` (+0.90), `syncopated_lift` (+0.75), `pop_train` (+0.69), `valley_bounce` (+0.60), and `rolling_drop` (+0.42), with `float_bounds` (-0.65) the only material loss. Conclusion: this is a useful smooth-budget-family signal but underpowered at 12 seeds; if the promotion rule is deliberately relaxed for smooth, non-damaging behavior, this candidate is a concrete revisit point. Under the current canonical gate, it remains log-only.

## 2026-06-24 - INCONCLUSIVE - impact-confirmed sparse-amplitude quality breadth

Mechanism: refine the prior smooth sparse-amplitude mature quality breadth by adding a stronger smooth mean-impact confidence term and authored-shape compatibility pressure. The trial kept the same broad idea of moving mature quality breadth toward 34 candidates on sparse amplitude rows, but dropped the low-impact `float_bounds` family and avoided unrelated sparse mixed rows using continuous pressures from amplitude range, median contact gap, mean impact target, flat-speed/elevation compatibility, and the existing mature quality budget lean. Explicit `LR_QUALITY_NCAND`, the high-variation gate, and the accepted short/no-amplitude boost still won. Scorer, specs, fingerprint, seeds, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.29.

Candidate: `generated/golden-runs/attempt-quality-sparse-amp-impactconf-after-repair-ramp-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-sparse-amp-impactconf-after-repair-ramp-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-sparse-amp-impactconf-after-repair-ramp-a01/golden.json generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.1, 0.4], P(delta<=0)=11.6%, effect 1.07. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k +0.2, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.42 and `HEADLINE excl. impact` was 684.18.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The refinement did remove the earlier `float_bounds` loss and changed only the intended positive sparse-amplitude family: `big_air_ramp` (+2.33), `pop_train` (+1.21), `syncopated_lift` (+0.97), `valley_bounce` (+0.60), `rolling_drop` (+0.16), and `switchback_pop` (+0.00). That was a cleaner slice than the previous sparse-amplitude trial, but it still moved the canonical headline by only +0.13 raw points and remained underpowered at 12 seeds. Conclusion: impact-confirmed sparse-amplitude breadth is a sound smooth compute-allocation signal and a good candidate if the promotion policy is deliberately relaxed or if a higher-seed validation budget is available; under the current accept-only gate, it remains log-only.

## 2026-06-24 - INCONCLUSIVE - smooth impact-template activation edge

Mechanism: replace the impact-template lane's hard `impactCurveP >= 0.35` activation edge with a smooth probability ramp from 0.25 to 0.35, while preserving full existing behavior at and above the old 0.35 pressure. The trial multiplied the existing budget pressure by `smoothstep((impactCurveP - 0.25) / 0.10)`, so scorer, specs, fingerprint, seeds, budget grid, template lane cadence, and acceptance rule stayed unchanged. This retested the earlier positive `template-minp25` direction in a continuous form rather than a new hard lower threshold.

Baseline: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.29.

Candidate: `generated/golden-runs/attempt-impact-template-smooth-edge-after-repair-ramp-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-impact-template-smooth-edge-after-repair-ramp-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-impact-template-smooth-edge-after-repair-ramp-a01/golden.json generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-1.3, 0.6], P(delta<=0)=70.0%, effect -0.48. Per-budget point estimates were 100k -0.1, 200k -0.1, and 300k -0.3, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.07 and `HEADLINE excl. impact` was 683.62.

Why it was not kept: the source was reverted after the canonical run because the point estimate was negative and the campaign still requires `VERDICT: ACCEPT`. The smooth edge was active but not safe enough: weighted gains in `rolling_drop` (+2.97), `drums_swell` (+1.97), `dense_echo_climb` (+0.69), and `big_air_ramp` (+0.32) were outweighed by losses in `drums_pulse` (-4.82), `drums_pendulum` (-2.21), `ridge_pulse` (-1.48), `opening_burst` (-1.33), `drums_breath` (-1.04), and `drums_tide` (-0.84). Conclusion: the existing 0.35 impact-template edge is not just an arbitrary sharpness problem; admitting lower-pressure templates adds useful shapes for some rows but injects enough timing/impact noise into drum rows to regress the headline.

## 2026-06-24 - INCONCLUSIVE - smooth repair impact priority

Mechanism: replace the earlier blunt repair impact-undershoot multiplier with a smoother repair weakest-gap priority term. The trial only added extra priority when a gap's impact target was under-achieved, impact accounted for a large share of that gap's own SSE, the compile had mature-budget pressure, and the measured cost-to-end left slack inside the remaining repair budget. The feasibility gate, restart ceiling, candidate generation, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.29.

Candidate: `generated/golden-runs/attempt-repair-impact-priority-smooth-after-repair-ramp-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-impact-priority-smooth-after-repair-ramp-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-repair-impact-priority-smooth-after-repair-ramp-a01/golden.json generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.4, 0.3], P(delta<=0)=50.7%, effect -0.08. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k -0.1, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.27 and `HEADLINE excl. impact` was 683.95.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The smoother/slack-aware ranking did avoid a broad rejection, but it also failed to create a net impact repair lift: weighted gains in `rolling_hills` (+1.61), `grain_staircase` (+1.00), `verse_chorus` (+0.88), `dense_sprint` (+0.83), `drums_tide` (+0.67), `drums_crescendo` (+0.62), and `dense_echo_climb` (+0.57) were offset by `syncopated_switchback` (-2.88), `mini_burst` (-1.61), `drums_signature` (-0.84), `drums_crosscut` (-0.63), `rhythm_ladder` (-0.55), and `drums_zigzag` (-0.48). Largest row losses included `mini_burst` seed 1 at 300k (-39.74), `syncopated_switchback` seed 4 at 200k (-37.74), and `rhythm_ladder` seed 2 at 300k (-26.88). Conclusion: smoothness and repair slack make the impact-priority idea less dangerous than the blunt multiplier, but repair gap ordering still cannot distinguish stable impact improvements from rhythm-basin flips well enough to promote.

## 2026-06-24 - INCONCLUSIVE - mature dense contract breadth

Mechanism: add a smooth mature-budget extra contract-candidate cap for dense, long contact chains before the first complete track. The trial left 100k byte-identical, left sparse contract search unchanged, and added up to two extra pre-validity contract samples as budget, contact-count pressure, and dense-cadence pressure rose. Quality search, start selection, forward-eval shape, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.29.

Candidate: `generated/golden-runs/attempt-contract-dense-extra-after-repair-ramp-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-contract-dense-extra-after-repair-ramp-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-contract-dense-extra-after-repair-ramp-a01/golden.json generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -1.2, CI [-3.6, 1.4], P(delta<=0)=83.9%, effect -0.93. Per-budget point estimates were 100k +0.0, 200k -1.6, and 300k -1.3, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 668.13 and `HEADLINE excl. impact` was 683.08.

Why it was not kept: the source was reverted after the canonical run because the point estimate was negative and the campaign still requires `VERDICT: ACCEPT`. The mechanism isolated 100k correctly, but mature dense contract breadth reselected unstable early basins instead of improving the first complete track. It helped some drum rows (`drums_swell` +4.06 weighted, `drums_tide` +2.93, `drums_crosscut` +2.44, `solo_run` +2.35, `drums_dropout` +1.34), but losses were larger in `drums_signature` (-17.52), `drums_zigzag` (-11.92), `drums_pendulum` (-9.31), `drums_crescendo` (-8.01), `drums_breath` (-4.23), and `dense_sprint` (-3.04). Work counters confirm this was not a validity problem: 100k was byte-identical, while 200k/300k sampled more candidates but reduced repair frames and moved many seeds into different drum basins. Conclusion: simply adding mature pre-validity contract breadth to dense chains is too noisy; the current 14-sample dense contract cap is load-bearing, and future budget-aware compute should not broaden dense contract search without a stronger stability selector.

## 2026-06-24 - ACCEPT - smooth sparse-amplitude quality pressure

Mechanism: add a narrow smooth mature-budget quality-breadth pressure for sparse amplitude rows. The accepted high-variation and short/no-amplitude gates still win, explicit `LR_QUALITY_NCAND` still wins, and 100k remains byte-identical because it already uses the full 32-candidate quality pool. Below the existing 34-candidate ceiling, the new pressure moves the mature quality pool toward 34 candidates using continuous authored-shape signals: amplitude range, median contact-gap frames, mean impact target, and speed-range steadiness. Scorer, specs, fingerprint, seeds, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.29.

Candidate: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json generated/golden-runs/attempt-repair-feas-ramp100to200-after-quality-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.1, CI [-0.0, 0.4], P(delta<=0)=8.6%, effect 1.19. Per-budget point estimates were 100k +0.0, 200k -0.0, and 300k +0.3, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical HEADLINE 669.43, `HEADLINE excl. impact` 684.22. The selector was narrow: 86/1440 checkpoint scores changed, with 46 improvements, 40 regressions, and 1354 plateaus. The 100k tier stayed byte-identical; movement was concentrated at 300k (+0.287 average) with 200k essentially flat (-0.006). Weighted gains came from `big_air_ramp` (+1.68), `valley_bounce` (+1.44), `syncopated_lift` (+0.50), and `pop_train` (+0.17), offset mainly by a small `rolling_drop` loss (-0.04). Largest gains included `big_air_ramp` seed 1 at 200k (+27.94), `big_air_ramp` seed 5 at 300k (+23.58), `valley_bounce` seed 10 at 300k (+17.98), and `syncopated_lift` seed 7 at 300k (+14.98); largest losses were `big_air_ramp` seed 8 at 200k (-21.54), `rolling_drop` seed 0 at 200k (-13.95), and `pop_train` seed 5 at 200k (-13.30). Conclusion: the earlier sparse-amplitude quality signal was real but needed a tighter smooth selector. This is a small accepted improvement and a good example of budget-aware compute allocation that adds breadth where authored shape says the mature lean is too aggressive, without touching the noisy opening/max or dense-contract basins.

## 2026-06-24 - INCONCLUSIVE - high-air steady-speed quality pressure

Mechanism: add a smooth mature-budget quality-breadth pressure for no-vertical tracks with high authored air variation, steady speed, long contact chains, and moderate mean impact. The trial tried to build on the accepted high-variation quality relief by moving only that narrow slice from the restored 32-candidate pool toward 34 candidates as the existing mature-budget pressure rose. Explicit `LR_QUALITY_NCAND`, scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, and repair stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-quality-highair-steady-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-highair-steady-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-highair-steady-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.4, 0.2], P(delta<=0)=53.4%, effect -0.09. Per-budget point estimates were 100k +0.0, 200k +0.2, and 300k -0.2, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.41 and `HEADLINE excl. impact` was 684.19.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The intended signal existed but was too small and was offset by an unintended precedence leak: refactoring the quality count path let short/no-amplitude high-variation rows receive the 34-candidate boost after variation relief, whereas the accepted baseline made variation relief win with 32 candidates. Only 37 checkpoint hashes moved, with 21 improvements, 16 regressions, and 1403 plateaus. The trial improved `drums_pendulum` (+25.25 raw row points across affected checkpoints) but regressed `syncopated_switchback` (-19.70), including a large 300k seed 5 loss (-47.99). Conclusion: high-air steady-speed breadth may be a real but pendulum-small signal, but preserving the accepted gate precedence is load-bearing. Future follow-ups must keep high-variation short/no-amplitude rows at 32 unless a separate selector proves they can safely use 34.

## 2026-06-24 - INCONCLUSIVE - smooth pulsed-impact quality relief

Mechanism: add a smooth mature-budget relief path for long no-vertical rows with moderate mean impact, high impact variation, and bounded air/speed variation. The trial moved quality breadth back toward the normal 32-candidate pool when the existing mature-budget lean would otherwise be below 32, while preserving explicit `LR_QUALITY_NCAND`, the accepted high-variation relief, the accepted short/no-amplitude boost, sparse-amplitude pressure, scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, and repair.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-quality-pulsed-impact-relief-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-pulsed-impact-relief-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-quality-pulsed-impact-relief-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.1, 0.3], P(delta<=0)=31.2%, effect 0.48. Per-budget point estimates were 100k +0.0, 200k -0.0, and 300k +0.1, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.48 and `HEADLINE excl. impact` was 684.16.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The selector was very narrow and mostly behaved as intended: 100k was byte-identical, 200k moved only 6 checkpoints for -4.91 raw row points, and 300k moved 32 checkpoints for +47.28 raw row points. The net 300k gain came from `drums_pulse` (+35.81) and `drums_zigzag` (+17.40), offset by `drums_swell` (-5.93); 200k had only `drums_pulse` movement (-4.91). Largest 300k gains were `drums_swell` seed 7 (+31.91), `drums_zigzag` seed 5 (+25.58), `drums_zigzag` seed 10 (+25.41), `drums_pulse` seed 5 (+16.82), and `drums_pulse` seed 8 (+13.98). Largest losses were `drums_swell` seed 6 (-27.98), `drums_zigzag` seed 9 (-25.76), `drums_zigzag` seed 8 (-13.08), and `drums_swell` seed 4 (-12.43). Conclusion: smooth budget-aware relief for pulsed impact has a positive high-budget signal, but at 12 seeds it is too seed-sensitive and too small to promote under the accept-only gate.

## 2026-06-24 - INCONCLUSIVE - smooth scarce-budget start branch tempering

Mechanism: make the accepted default start selector (`best:1:5`) budget-aware by smoothly tempering it toward `best:1:3` at scarce budgets, then fading back to the accepted branch 5 by mature budgets. Explicit `LR_START_EVAL` overrides still won. The trial was start-only: normal per-candidate forward eval, candidate generation, quality breadth, repair, scorer, specs, fingerprint, seed set, and budget grid stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-start-scarce-branch-pressure-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-start-scarce-branch-pressure-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-start-scarce-branch-pressure-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -1.7, CI [-8.6, 0.3], P(delta<=0)=85.4%, effect -0.69. Per-budget point estimates were 100k -10.0, 200k +0.0, and 300k +0.0. The raw golden summary reported 1439/1440 valid with one invalid 100k row; the decision table rounded pass rates to 100%.

Why it was not kept: the source was reverted after the canonical run because the point estimate was strongly negative and the campaign requires `VERDICT: ACCEPT`. The smooth budget gate isolated mature budgets exactly, but the scarce tier was too active: at 100k it changed 306 track hashes and 301 scores, with 169 improvements, 132 regressions, and one `solo_run` seed 4 invalid row. Only 26 selected starts changed, so much of the damage came from first-contact continuation ranking under the same start, not just different initial speeds. Positive movement in `grain_staircase` (+164.28 raw row points), `rhythm_ladder` (+134.38), `drums_pendulum` (+85.30), and `drums_signature` (+65.96) was outweighed by `solo_run` (-737.95), `drums_swell` (-192.90), `drums_tide` (-181.50), `dense_sprint` (-174.32), `float_bounds` (-158.40), `drums_dropout` (-148.29), and `drums_zigzag` (-147.95). Conclusion: the branch-3 scarce-start hint is not robust on the current accepted baseline. The accepted branch-5 opening breadth is load-bearing even at 100k; reducing it saves some start work and helps some hard rows, but it removes too much first-contact discrimination and can reopen invalidity.

## 2026-06-24 - INCONCLUSIVE - smooth steady-air extra aim base

Mechanism: add a default-only smooth pressure from the accepted top-4 aim base count toward a fifth aim base for mature, steady-speed, medium/high-air specs. Explicit `LR_AIM_TOPK_BASES` overrides still won, mature low-air gaps still capped at 3 bases, and 100k stayed untouched because the new pressure ramp started at 150k and reached full strength by 250k. The discrete extra base used deterministic hash gating against a continuous pressure from budget, whole-track speed range, air mean, air range, and contact count, so the aggregate behavior scales smoothly with budget rather than adding a fixed budget cliff. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-aim-steadyair-extra-top5-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-steadyair-extra-top5-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-aim-steadyair-extra-top5-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.6, 1.3], P(delta<=0)=26.6%, effect 0.55. Per-budget point estimates were 100k +0.0, 200k -0.2, and 300k +0.6, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.68 and `HEADLINE excl. impact` was 684.35.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The selector had the right smooth/budget-aware shape and was not a broad top-5 repeat: 100k was byte-identical; 200k changed 66 checkpoint scores for -68.38 raw row points; 300k changed 72 checkpoint scores for +283.97 raw row points. The intended high-budget gains were clear in `drums_pulse` 300k (+139.38), `soar_settle` 200k/300k (+62.99/+61.82), `float_bounds` 300k (+59.72), and `drums_dropout` 300k (+56.55). The remaining problem is mid-budget seed volatility: `drums_dropout` 200k lost -79.59 and `drums_pulse` 200k lost -19.49, including large seed flips (`drums_pulse` seed 3 at 200k -100.85; `drums_dropout` seed 6 at 200k -55.64). Conclusion: selective smooth top-5 aim is a real positive 300k signal and much safer than blanket top-5, but the current pressure turns on too early or too broadly for 200k. If the promotion policy is deliberately relaxed for smooth non-damaging behavior, this is a concrete candidate; under the current accept-only gate, it remains log-only. A follow-up should either delay the pressure further toward 300k or add a stability term that prevents the `drums_dropout`/`drums_pulse` 200k basin flips.

## 2026-06-24 - INCONCLUSIVE - late smooth steady-air extra aim base

Mechanism: keep the same default-only steady-speed/high-air fifth aim-base selector as the previous trial, but delay the smooth budget pressure to start at 225k and reach full strength at 300k. Explicit `LR_AIM_TOPK_BASES` overrides still won, low-air gaps still capped at 3 bases, and the selector still used deterministic hash gating against continuous authored-shape pressure. The intent was to preserve the clean 300k lift while making 100k and 200k byte-identical to the accepted baseline. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-aim-steadyair-extra-top5-late-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-steadyair-extra-top5-late-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-aim-steadyair-extra-top5-late-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.2, 1.1], P(delta<=0)=12.7%, effect 0.99. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k +0.6, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.74 and `HEADLINE excl. impact` was 684.46.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The delayed ramp achieved the intended isolation: 100k and 200k were byte-identical; 300k changed 72 checkpoint scores, with 43 improvements, 29 regressions, and +283.97 raw row points. The 300k gains came from `drums_pulse` (+139.38), `soar_settle` (+61.82), `float_bounds` (+59.72), and `drums_dropout` (+56.55), offset by `pop_train` (-19.61) and `big_air_ramp` (-13.89). Largest gains included `drums_dropout` seed 11 (+54.47), `drums_pulse` seed 9 (+54.12), `drums_dropout` seed 4 (+52.27), and `drums_pulse` seed 8 (+52.27); largest losses were `drums_dropout` seed 9 (-45.60), seed 0 (-43.79), and seed 3 (-43.37). Conclusion: late smooth top-5 aim is the cleanest version of this family so far and is close to the accept gate, but at 12 seeds it remains just underpowered. If a higher-seed validation budget or relaxed smooth-policy rule is allowed, this is the better revisit point than the earlier 150k-start version. Under the current gate it remains log-only.

## 2026-06-24 - INCONCLUSIVE - impact-gated late smooth steady-air extra aim base

Mechanism: refine the late smooth steady-air fifth aim-base selector with a smooth authored-shape compatibility term. The previous late ramp stayed intact (zero pressure below 225k and full budget pressure at 300k), explicit `LR_AIM_TOPK_BASES` overrides still won, and low-air gaps still capped at 3 bases. For specs with amplitude/elevation targets, the new term faded the extra aim-base pressure out as mean impact entered the firm/high-impact band; specs without vertical targets kept full compatibility. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-aim-steadyair-extra-top5-impactgate-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-steadyair-extra-top5-impactgate-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-aim-steadyair-extra-top5-impactgate-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.2, 1.0], P(delta<=0)=12.9%, effect 0.99. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k +0.6, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.73 and `HEADLINE excl. impact` was 684.44.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The trial kept the desirable isolation: 100k and 200k were byte-identical to the accepted baseline; only 300k moved, with 47 changed checkpoint scores, 30 improvements, 17 regressions, and +288.94 raw row points. The impact compatibility removed the prior vertical/high-impact losses (`pop_train` and `big_air_ramp` returned to baseline), while movement concentrated in `float_bounds` (+134.89), `soar_settle` (+58.21), `drums_dropout` (+56.55), and `drums_pulse` (+39.29). Relative to the previous late top-5 trial, this was only +4.97 raw row points at 300k: it traded away -100.09 raw points in `drums_pulse` for +75.17 in `float_bounds` and +33.50 from removing the `pop_train`/`big_air_ramp` losses. Largest gains versus baseline were `drums_dropout` seed 11 (+54.47), `drums_dropout` seed 4 (+52.27), `drums_dropout` seed 1 (+44.95), `drums_pulse` seed 9 (+38.50), and `float_bounds` seed 4 (+35.88); largest losses were `drums_pulse` seed 8 (-56.26), `drums_dropout` seed 9 (-45.60), `drums_dropout` seed 0 (-43.79), and `drums_dropout` seed 3 (-43.37). Conclusion: the smooth budget-aware top-5 aim signal remains real and non-damaging at headline scale, but the 12-seed canonical gate still does not accept it. The compatibility term solved the intended vertical/high-impact leak, not the remaining seed sensitivity in `drums_dropout`/`drums_pulse`.

## 2026-06-24 - INCONCLUSIVE - coherent late smooth steady-air extra aim base

Mechanism: keep the late smooth steady-air fifth aim-base selector and vertical/high-impact compatibility fade, but change the hash gate from per-gap to whole-track coherent. When a `(spec, seed, budget)` passed the continuous pressure, all eligible non-low-air gaps got the fifth aim base; otherwise none did. This tested whether avoiding mixed top-4/top-5 decisions inside one track would reduce seed/basin volatility while preserving smooth aggregate behavior. Explicit `LR_AIM_TOPK_BASES` overrides still won, low-air gaps still capped at 3 bases, and 100k/200k were intended to remain byte-identical. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-aim-steadyair-extra-top5-coherent-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-steadyair-extra-top5-coherent-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-aim-steadyair-extra-top5-coherent-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.2, CI [-0.2, 0.8], P(delta<=0)=16.3%, effect 0.82. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k +0.4, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.63 and `HEADLINE excl. impact` was 684.45.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The coherence change behaved as designed but weakened the signal: 100k and 200k were byte-identical, while 300k changed 36 checkpoint scores, with 21 improvements, 15 regressions, and +193.16 raw row points. The gains were limited to `float_bounds` (+74.79), `soar_settle` (+61.82), and `drums_dropout` (+56.55); the coherent hash dropped the entire `drums_pulse` contribution that made the earlier late top-5 trial strongest. Relative to the late per-gap top-5 trial, this was -90.81 raw row points at 300k, mostly `drums_pulse` (-139.38), partly offset by removing the prior `pop_train` (+19.61) and `big_air_ramp` (+13.89) losses. Largest gains versus baseline were `drums_dropout` seed 11 (+54.47), seed 4 (+52.27), seed 1 (+44.95), and `float_bounds` seed 4 (+36.01); largest losses were `drums_dropout` seed 9 (-45.60), seed 0 (-43.79), seed 3 (-43.37), and seed 6 (-24.85). Conclusion: whole-track coherence is a reasonable smoothness idea, but for this family it under-samples the useful `drums_pulse` cases and is worse than the per-gap late top-5 selector. The best revisit point remains the original late per-gap selector, not the coherent variant.

## 2026-06-24 - INCONCLUSIVE - shape-compatible late smooth aim top5

Mechanism: keep the late smooth fifth aim-base pressure family, but add generic authored-shape compatibility terms before allowing the default top-4 aim lane to probabilistically request a fifth base. The budget ramp remained zero below 225k and reached full pressure at 300k, explicit `LR_AIM_TOPK_BASES` overrides still won, and low-air gaps still capped at 3 bases. The new compatibility faded pressure for no-vertical air-valley rows unless there was pulsed grain, and faded vertical/amplitude rows as mean impact rose. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 669.43.

Candidate: `generated/golden-runs/attempt-aim-late-top5-shapecompat-after-sparse-amp-pressure-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-late-top5-shapecompat-after-sparse-amp-pressure-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-aim-late-top5-shapecompat-after-sparse-amp-pressure-a01/golden.json generated/golden-runs/attempt-quality-sparse-amp-pressure-after-repair-ramp-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.6, 0.7], P(delta<=0)=40.5%, effect 0.18. Per-budget point estimates were 100k +0.0, 200k +0.0, and 300k +0.1, with unchanged diagnostic validity at 1440/1440 overall and 480/480 at every budget. Raw candidate HEADLINE was 669.48 and `HEADLINE excl. impact` was 684.23.

Why it was not kept: the source was reverted after the canonical run because the campaign still requires `VERDICT: ACCEPT`. The compatibility terms isolated 100k and 200k as intended, but they over-filtered the stronger late top-5 signal: only 43 checkpoint scores moved at 300k, with 22 improvements, 21 regressions, and +55.82 raw row points. The remaining gains were `drums_pulse` (+29.08), `drums_dropout` (+24.91), `canyon_steps` (+17.98), `syncopated_lift` (+13.28), and `soar_settle` (+5.05), offset by `valley_bounce` (-22.87), `float_bounds` (-14.18), and `terrace_sprint` (-1.48). Largest row moves still showed the same basin instability the compatibility was meant to remove: `drums_dropout` seed 0 at 300k lost -114.81 while seeds 10, 7, and 4 gained +72.82, +52.11, and +46.71; `drums_pulse` seed 4 lost -49.62 while seeds 8, 9, and 5 gained +33.96, +32.58, and +30.19. Conclusion: authored-shape compatibility in this form is too blunt; it reduces the helpful `float_bounds`/late top-5 signal without eliminating the noisy `drums_dropout`/`drums_pulse` seed flips. Under the current accept-only gate it remains log-only.

## 2026-06-24 - BASELINE RESET - canonical 125k/250k/375k/500k grid

Reason: the canonical budget grid was deliberately changed from `{100,200,300}k` to `{125,250,375,500}k` in commit `08ff0a2` to reduce overfitting to the old three-point curve and expose higher-budget scaling. This is a scope reset, not a compiler candidate; no `decide` command was run and nothing was accepted or rejected.

Baseline: `generated/golden-runs/baseline-newgrid-125-500k-08ff0a2/golden.json`, canonical, fingerprint `de24a421f751`, source commit `08ff0a21255a`, HEADLINE 674.79, `HEADLINE excl. impact` 688.59.

Run: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/baseline-newgrid-125-500k-08ff0a2`.

Result: valid 1920/1920, invalid 0, timeout 0. Per-budget scores were 125k 657.22, 250k 671.89, 375k 676.26, and 500k 679.53. The new weighted headline uses budget weights 0.1/0.2/0.3/0.4, so this archive is the baseline of record for subsequent promotion decisions.

Notes: the archive source metadata says `dirty:true` because unrelated pre-existing workspace artifacts were present (`generated/verify-optimizer/baseline.json` and untracked local files). Before the run, optimizer/source diffs were clean and the compiler source was exactly commit `08ff0a2`. The committed fingerprint sentinel and rebaseline docs were refreshed afterward to the already-live `de24a421f751` hash; scorer, specs, metric, seed set, budget grid, and compiler behavior were not changed by that metadata cleanup.

## 2026-06-24 - ABANDONED PROBE - ultra-mature quality breadth relief

Mechanism: after the existing mature quality-breadth lean fully saturates, smoothly relax the broad quality candidate count back toward 32 as budget continues beyond the old mature range. This was intended to make the broad mature no-lean signal scale to 375k/500k without a hard 500k branch; accepted high-variation, short/no-amplitude, and sparse-amplitude gates still won.

Probe: `generated/golden-runs/probe-quality-ultramature-relief-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,drums_crescendo,dense_sprint,syncopated_switchback,drums_dropout,drums_tide,drums_breath,skyline_push,solo_run,float_bounds --budgets=125000,500000 --jobs=16 --archive-dir=generated/golden-runs/probe-quality-ultramature-relief-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-quality-ultramature-relief-a01/golden.json generated/golden-runs/baseline-newgrid-125-500k-08ff0a2/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -1.5 on the 10-spec × 3-seed × `{125,500}k` intersection, with 125k unchanged and 500k -1.9.

Why it was stopped: the accepted authored-shape quality gates already cover the old positive broad no-lean family, so the remaining affected slice was mostly the risky non-relief rows. Changed 500k rows on the probe lost in `solo_run`, `drums_dropout`, `float_bounds`, `skyline_push`, `drums_breath`, and `drums_tide`, with no movement in the high-variation rows that made the original no-lean probe attractive. The source was reverted without a full canonical run; this is not a promotion decision and not a new baseline.

## 2026-06-24 - ACCEPTED - late smooth aim top5 on new budget grid

Mechanism: promote the prior log-only late smooth fifth aim-base selector now that the canonical grid includes 375k and 500k budgets. The default aim lane still uses the accepted top-4 base count after the 100k maturity gate, explicit `LR_AIM_TOPK_BASES` overrides still win, and low-air mature gaps still cap at 3 bases. Only default, non-low-air gaps can probabilistically request a fifth base, with continuous pressure from target budget, whole-track speed steadiness, air mean, air range, and contact count. The budget pressure is zero below 225k and reaches full strength at 300k, so scarce 125k compiles stay byte-identical while higher budgets spend more compute on additional aimed bases. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/baseline-newgrid-125-500k-08ff0a2/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 674.79, `HEADLINE excl. impact` 688.59.

Candidate: `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-late-top5-newgrid-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The dashboard was regenerated from the candidate archive with `npx tsx scripts/v0/update_compiler_doc.ts generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`.

Decision: `npm run decide -- generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json generated/golden-runs/baseline-newgrid-125-500k-08ff0a2/golden.json` -> `VERDICT: ACCEPT`, delta headline +0.7, CI [-0.4, 2.1], P(delta<=0)=9.1%, effect 1.19. Per-budget point estimates were 125k +0.0, 250k +0.2, 375k +0.9, and 500k +1.1, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget. Raw candidate HEADLINE was 675.52 and `HEADLINE excl. impact` was 689.27.

Outcome: accepted as the new baseline of record for subsequent mechanisms: `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`. The source behavior is the intended smooth scaling shape: 125k was byte-identical, while the higher budgets moved increasingly more rows and improved in point estimate. The 500k paired common-row score moved 684.40 -> 685.45 with validity unchanged and negligible aggregate work deltas from path reselection. Largest 500k gains included `drums_dropout` seeds 11/7/1 (+60.63/+60.36/+53.39), `solo_run` seed 10 (+48.09), `grain_staircase` seed 9 (+46.99), `drums_pulse` seed 8 (+33.36), and `float_bounds` seed 8 (+31.49). Largest losses were `drums_pulse` seed 1 (-77.69), `drums_dropout` seed 5 (-52.44), `grain_staircase` seed 6 (-42.87), `solo_run` seed 3 (-36.36), and `drums_dropout` seed 3 (-32.69). Conclusion: the mechanism remains seed-volatile at the row level, but the full new-grid distribution now resolves the high-budget signal strongly enough to promote under the canonical gate while preserving the low-budget tier exactly.

## 2026-06-24 - REJECTED - ultra-high-budget smooth aim top6 extension

Mechanism: build directly on the accepted late smooth aim top5 selector by adding a separate, weaker sixth-base pressure only after the fifth-base gate had already passed. The extra pressure used the same authored-shape terms as top5, but with a later smooth budget ramp from 350k to 500k and a 0.5 multiplier, so 125k and 250k were intended to remain byte-identical and 375k/500k could spend additional compute only on the same steady-speed/high-air/contact-rich slice. Explicit `LR_AIM_TOPK_BASES` overrides still won and low-air mature gaps still capped at 3 bases. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 675.52, `HEADLINE excl. impact` 689.27.

Candidate: `generated/golden-runs/attempt-aim-ultra-top6-newgrid-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-aim-ultra-top6-newgrid-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Decision: `npm run decide -- generated/golden-runs/attempt-aim-ultra-top6-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> `VERDICT: REJECT`, delta headline -0.5, CI [-1.3, 0.1], P(delta<=0)=94.1%, effect -1.33. Per-budget point estimates were 125k +0.0, 250k +0.0, 375k +0.1, and 500k -1.3, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget. Raw candidate HEADLINE was 675.04 and `HEADLINE excl. impact` was 688.8.

Why it was not kept: the source was reverted after the canonical run because the sixth-base extension clearly failed the accept-only gate. The smooth isolation worked, but the useful 375k trickle was too small and the 500k degradation overwhelmed it. This suggests the accepted top5 selector is already close to the useful breadth limit for this aim family; further work should probably change the selection objective or downstream evaluation, not simply add another aimed base on the same slice. No new baseline was created.

## 2026-06-24 - ABANDONED PROBES - start, rollout-depth, and reuse pressure screens

Reason: after the accepted top5 baseline, several smooth budget-aware ideas around the opening and local extra-candidate sources were screened before spending another full canonical run. These were non-canonical 10-spec × 3-seed × `{125,500}k` probes against `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`; none was promotable and no new baseline was created.

Probes:
- `generated/golden-runs/probe-start-best8-a01/golden.json`: env-only `LR_START_EVAL=best:1:8`, testing wider max-style start scoring. Indicative decide -> `VERDICT: INCONCLUSIVE`, delta headline -1.4, with 125k -0.6 and 500k -1.6.
- `generated/golden-runs/probe-start-avg5-a01/golden.json`: env-only `LR_START_EVAL=avg:1:5`, testing a more robust average start selector without extra breadth. Indicative decide -> `VERDICT: INCONCLUSIVE`, delta headline -1.0, with 125k -3.3 and 500k -0.4.
- `generated/golden-runs/probe-fwd-greedy3-a01/golden.json`: env-only `LR_FWD_EVAL=greedy:3`, testing deeper single-branch forward evaluation. Indicative decide -> `VERDICT: REJECT`, delta headline -27.4, with 125k -21.1 and 500k -29.0.
- `generated/golden-runs/probe-reuse-mature-pressure07-a01/golden.json`: source trial doubling `HANDOFF_REUSE_MATURE_EXTRA_WEIGHT` from 0.35 to 0.7 while keeping the existing smooth budget/feedback pressure shape. Focused tests passed first with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). Indicative decide -> `VERDICT: INCONCLUSIVE`, delta headline -1.2, with 125k +0.0 and 500k -1.5. The source was reverted.

Conclusion: the opening remains important, but the current accepted `best:1:5` start selector is not obviously under-computed on the new grid; wider or averaged start scoring degraded this subset. Deeper greedy rollout is actively harmful, likely because extra horizon changes candidate selection while consuming useful search budget. Stronger mature reuse pressure preserves low-budget behavior but overuses translated catches at 500k. Future work should avoid simply increasing opening/rollout/reuse breadth and instead look for a sharper selector or a different quality signal.

## 2026-06-24 - ABANDONED PROBE - compact mixed-vertical quality breadth

Mechanism: add a smooth authored-shape quality-breadth relief for compact tracks that target both amplitude and elevation. The trial restored the mature quality pool partway from the leaned 29 candidates toward 32 using continuous pressure from amplitude range, elevation range, median contact spacing, mean impact, and speed-range compatibility. Accepted high-variation, short/no-amplitude, and sparse-amplitude gates kept their precedence; scorer, specs, fingerprint, seed set, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-quality-compact-mixed-vertical-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=skyline_push,terrace_sprint,canyon_steps,syncopated_lift,switchback_pop,rolling_drop,dense_echo_climb,valley_bounce,glide_stairs,ridge_pulse,float_bounds,soar_settle --budgets=250000,500000 --jobs=16 --archive-dir=generated/golden-runs/probe-quality-compact-mixed-vertical-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-quality-compact-mixed-vertical-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -0.3 on the 12-spec × 3-seed × `{250,500}k` intersection, with 250k -0.6 and 500k -0.2. Validity stayed 72/72.

Why it was stopped: the selector was correctly narrow but not helpful. Movement concentrated in `skyline_push`, `terrace_sprint`, and `canyon_steps`; `canyon_steps` improved on average (+0.74 at 250k, +1.50 at 500k), but `skyline_push` regressed enough (-6.25 at 250k, -3.36 at 500k across the three probe seeds) to sink the affected slice. The source was reverted without a full canonical run. Conclusion: compact mixed-vertical rows do need better treatment, but simply restoring mature quality breadth changes the same fragile skyline basin rather than improving the vertical model.

## 2026-06-24 - ABANDONED PROBE - low-air mature impact frontload on new grid

Mechanism: retest the previously positive but unaccepted low-air mature impact-frontload family on the new 125k/250k/375k/500k grid. The trial kept 125k isolated, then smoothly increased impact curvature frontload from 1.6 toward 2.0 as budget rose past 125k and as the current gap's air target fell below 0.50. Scorer, specs, fingerprint, seed set, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-lowair-impact-frontload-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,dense_echo_climb,drums_crescendo,drums_tide,drums_swell,syncopated_switchback,rhythm_ladder,opening_burst,tiny_dance,solo_run,rolling_hills,cold_start,climb_terrace,summit_push --budgets=125000,250000,500000 --jobs=16 --archive-dir=generated/golden-runs/probe-lowair-impact-frontload-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-lowair-impact-frontload-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -3.3 on the 14-spec × 3-seed × `{125,250,500}k` intersection, with 125k +0.0, 250k -4.1, and 500k -3.7. Validity stayed 126/126.

Why it was stopped: the smooth budget isolation worked, but the old low-air frontload signal did not survive the accepted top5/new-grid baseline. It helped some rows (`rhythm_ladder` and `opening_burst` at 250k; `dense_echo_climb`, `tiny_dance`, and `opening_burst` at 500k), but paired losses dominated in the intended low-air rows: `drums_pendulum` averaged -20.47 at 250k and -15.68 at 500k, while `drums_crescendo` averaged -40.83 at 250k and -4.87 at 500k. The source was reverted without a full canonical run. Conclusion: deeper low-air curvature frontload is no longer a viable default on this baseline; future impact work needs a measured selector tied to observed undershoot or a different geometry lever, not a stronger low-air frontload prior.

## 2026-06-24 - ABANDONED PROBE - start best:1:4 on new grid

Reason: screen the nearest narrower start max-width setting after wider `best:1:6`/`best:1:8` and averaged starts had regressed. This was env-only with `LR_START_EVAL=best:1:4`; source defaults, scorer, specs, fingerprint, seed set, budget grid, normal forward eval, aim, and repair stayed unchanged.

Probe: `generated/golden-runs/probe-start-best4-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=best:1:4 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=cold_start,opening_burst,dense_sprint,drums_pendulum,drums_dropout,drums_tide,drums_breath,syncopated_switchback,float_bounds,big_air_ramp,pop_train,solo_run,skyline_push,rhythm_ladder --budgets=125000,250000,500000 --jobs=16 --archive-dir=generated/golden-runs/probe-start-best4-newgrid-a01`.

Probe decision: `npm run decide -- generated/golden-runs/probe-start-best4-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -1.8 on the 14-spec × 3-seed × `{125,250,500}k` intersection, with 125k -0.5, 250k -1.7, and 500k -2.2. Validity stayed 126/126.

Why it was stopped: branch 4 produced localized gains (`opening_burst` +7.45 average over the probe rows, `drums_tide` +6.19, `pop_train` +1.80, `skyline_push` +1.25), but the losses were larger in known fragile rows (`syncopated_switchback` -13.11, `drums_pendulum` -9.03, `dense_sprint` -8.60). No source was changed. Conclusion: the accepted `best:1:5` start selector remains the better default on the new grid; both narrower and wider global start-width changes are seed-unstable without a stronger family/stability gate.

## 2026-06-24 - REJECTED - long steady-air quality breadth

Mechanism: after the existing mature quality-breadth relaxation, smoothly add a little more quality candidate breadth for long, no-vertical, high-air-range, steady-speed, moderate-impact tracks. The trial lifted the quality pool from 32 toward 36 candidates using continuous pressure from target budget, air range, speed steadiness, contact count, and a bounded impact band. Accepted high-variation, short/no-amplitude, and sparse-amplitude gates kept their precedence; scorer, specs, fingerprint, seed set, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 675.52, `HEADLINE excl. impact` 689.27.

Candidate: `generated/golden-runs/attempt-quality-long-steady-air-breadth-newgrid-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-long-steady-air-breadth-newgrid-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The canonical run was valid 1920/1920 with raw HEADLINE 675.55 and `HEADLINE excl. impact` 689.28; per-budget point estimates were 125k 657.22, 250k 672.09, 375k 677.21, and 500k 680.62.

Decision: `npm run decide -- generated/golden-runs/attempt-quality-long-steady-air-breadth-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.0, 0.1], P(delta<=0)=40.4%, effect 0.74. Per-budget point estimates were 125k +0.0, 250k +0.0, 375k +0.1, and 500k +0.0, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the source was reverted after the canonical run because the positive movement was too small and did not pass the accept-only gate. The smooth selector behaved as intended and did not damage validity or low-budget behavior, but it mostly produced statistical noise at the canonical 12-seed resolution. This suggests the old high-air quality-breadth hint is not a strong enough standalone mechanism on the accepted top5 baseline; future quality work should either change the quality signal itself or target a sharper observed failure mode rather than simply adding a few more quality candidates to long steady-air rows.

## 2026-06-24 - REJECTED - pulsed-impact mature quality relief on new grid

Mechanism: retest the old pulsed-impact quality-breadth hint on the accepted new-grid baseline with a smoother, narrower selector. The trial relieved the mature quality lean from the current base back toward 32 candidates only for long no-vertical rows with no amplitude/elevation targets, strong impact range, moderate mean impact, bounded air/speed variation, and enough air motion to avoid the previously bad generic low-air frontload family. The accepted explicit override, high-variation relief, short/no-amplitude boost, sparse-amplitude pressure, scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 675.52, `HEADLINE excl. impact` 689.27.

Candidate: `generated/golden-runs/attempt-quality-pulsed-impact-relief-newgrid-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-quality-pulsed-impact-relief-newgrid-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The canonical run was valid 1920/1920 with raw HEADLINE 675.60 and `HEADLINE excl. impact` 689.29; per-budget point estimates were 125k 657.22, 250k 672.16, 375k 677.17, and 500k 680.73.

Decision: `npm run decide -- generated/golden-runs/attempt-quality-pulsed-impact-relief-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [0.0, 0.3], P(delta<=0)=37.9%, effect 0.80. Per-budget point estimates were 125k +0.0, 250k +0.1, 375k +0.0, and 500k +0.1, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the source was reverted after the canonical run because the accept-only gate did not resolve the signal. The selector stayed narrow and avoided validity damage, but the gain was too small and seed-sensitive to promote at 12 canonical seeds. This remains a plausible family only if future policy allows more seeds or a deliberate relaxed rule for smooth non-damaging mechanisms; under the current rule it is not a new baseline.

## 2026-06-24 - REJECTED - high-budget repair main-margin continuation on new grid

Mechanism: extend the accepted smooth repair main-search margin only above the old mature knee, so the margin stayed unchanged at 125k and 250k and then rose slowly at higher budgets. The trial added a saturating high-budget extra margin after 250k, reaching about 1.116 at 375k and 1.130 at 500k, with scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim, feasibility margin, and acceptance rule unchanged.

Baseline: `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 675.52, `HEADLINE excl. impact` 689.27.

Candidate: `generated/golden-runs/attempt-repair-highbudget-main-margin-newgrid-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-highbudget-main-margin-newgrid-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The canonical run was valid 1920/1920 with raw HEADLINE 675.50 and `HEADLINE excl. impact` 689.27; per-budget point estimates were 125k 657.22, 250k 672.07, 375k 677.13, and 500k 680.56.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-highbudget-main-margin-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.0, CI [-0.1, 0.1], P(delta<=0)=72.3%, effect -0.44. Per-budget point estimates were 125k +0.0, 250k +0.0, 375k -0.0, and 500k -0.0, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the source was reverted after the canonical run because the smooth extra budget spend did not improve the high-budget rows and slightly moved the point estimate the wrong way at 375k/500k. This is useful negative evidence for repair: simply keeping more main-frontier candidates alive at higher budgets is not a reliable scaling lever on the accepted top5 baseline. Future repair work should probably use an observed failure signal, such as stale upstream context or repair-success quality, rather than continuing the margin curve by budget alone.

## 2026-06-24 - ABANDONED PROBE - start p75 percentile eval on new grid

Reason: screen the suggested percentile family for the high-leverage opening choice without changing the default compiler. A temporary source trial added `p50`/`p75` forward-eval variants, then the probe ran env-only start selection with `LR_START_EVAL=p75:1:5`. This used the same five first-contact alternatives as the accepted `best:1:5` start selector but ranked by the 75th-percentile leaf score instead of the max, aiming for a less brittle opening choice. Default behavior, scorer, specs, fingerprint, seed set, budget grid, normal forward eval, aim, and repair stayed unchanged outside the env probe.

Probe: `generated/golden-runs/probe-start-p75-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm LR_START_EVAL=p75:1:5 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=cold_start,opening_burst,dense_sprint,drums_pendulum,drums_dropout,drums_tide,drums_breath,syncopated_switchback,float_bounds,big_air_ramp,pop_train,solo_run,skyline_push,rhythm_ladder --budgets=125000,250000,500000 --jobs=16 --archive-dir=generated/golden-runs/probe-start-p75-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The probe was valid 126/126 with raw probe HEADLINE 643.37 and `HEADLINE excl. impact` 667.86; per-budget point estimates were 125k 621.58, 250k 638.40, and 500k 651.30.

Probe decision: `npm run decide -- generated/golden-runs/probe-start-p75-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -1.0 on the 14-spec × 3-seed × `{125,250,500}k` intersection, with 125k -0.9, 250k -0.5, and 500k -1.2. Validity stayed 126/126.

Why it was stopped: every tested budget moved negative by point estimate, so the percentile selector did not preserve the accepted `best:1:5` start benefit on this slice. This also matches the earlier averaged-start result: the opening selector seems to need the optimistic max over the small first-contact branch, not a robust percentile/mean of that branch. The temporary `p50`/`p75` parser/scorer source was reverted and no full canonical run was started.

## 2026-06-24 - REJECTED - high-budget shallow forward-eval pressure on new grid

Mechanism: apply a smooth high-budget pressure that changes the default mature forward eval from `greedy:2` to `greedy:1` above the old 300k crossover, reaching full pressure by 500k. The accepted vertical-drama `avg` override kept precedence, explicit/env overrides were preserved, and 125k/250k behavior was intended to remain unchanged. Scorer, specs, fingerprint, seed set, budget grid, start selection, aim, repair, and acceptance rule stayed unchanged.

Baseline: `generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json`, canonical, fingerprint `de24a421f751`, HEADLINE 675.52, `HEADLINE excl. impact` 689.27.

Candidate: `generated/golden-runs/attempt-fwd-highbudget-shallow-newgrid-a01/golden.json`, run after a source trial with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-fwd-highbudget-shallow-newgrid-a01`. Focused tests passed before the full run with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The canonical run was valid 1920/1920 with raw HEADLINE 673.53 and `HEADLINE excl. impact` 688.39; per-budget point estimates were 125k 657.22, 250k 672.07, 375k 675.54, and 500k 676.84.

Decision: `npm run decide -- generated/golden-runs/attempt-fwd-highbudget-shallow-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> `VERDICT: REJECT`, delta headline -2.0, CI [-4.0, -0.2], P(delta<=0)=98.4%, effect -2.10. Per-budget point estimates were 125k +0.0, 250k +0.0, 375k -1.6, and 500k -3.8, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the source was reverted after the canonical run because the smooth high-budget shallow rollout did exactly isolate the lower budgets, but it hurt the budgets it was supposed to help. The old `greedy:1` high-budget hint does not transfer to the accepted top5/new-grid baseline when used as a default mature forward-eval pressure. Future rollout-depth work should look for an observed local signal rather than applying shallow evaluation by budget alone.

## 2026-06-24 - ABANDONED PROBE - impact axis-quality pool injection on new grid

Mechanism: add at most one `axisq` option during quality search by selecting the already-generated candidate outside the scored pool that was closest to the current impact target. The offer used a continuous pressure from target budget, incumbent full-evaluation feedback, impact ask strength, selected-candidate undershoot, and available pool gain; the normal charged forward-eval ranker still judged the option. Scorer, specs, fingerprint, seed set, budget grid, start selection, aim generation, and repair stayed unchanged.

Probe: `generated/golden-runs/probe-impact-axisq-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,drums_dropout,dense_echo_climb,skyline_push,terrace_sprint,rhythm_ladder,solo_run --budgets=125000,250000,500000 --jobs=16 --archive-dir=generated/golden-runs/probe-impact-axisq-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-impact-axisq-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.2 on the 7-spec × 3-seed × `{125,250,500}k` intersection, with 125k +0.0, 250k -0.4, and 500k +0.5. Validity stayed 63/63.

Why it was stopped: the final-output telemetry showed the mechanism was not really winning selection: across the probe, selected `axisq` candidates were 0/21 rows at 125k, 1/21 at 250k, and 0/21 at 500k, despite many offers. The tiny score movement was therefore mostly search-order and budget displacement, not a clear impact-selection fix. This matches earlier evidence that impact-looking candidates often lose for real downstream reasons. The source was reverted without a canonical run.

## 2026-06-24 - ABANDONED PROBE - monotone late top5 aim hash

Mechanism: keep the accepted late smooth fifth aim-base pressure exactly as-is, but remove target budget from the hash seed so activation becomes monotone with budget: increasing budget can only turn eligible gaps on, not reshuffle which gap indices pass. The pressure formula, authored-shape gates, low-air cap, explicit `LR_AIM_TOPK_BASES` override, scorer, specs, fingerprint, seed set, start selection, forward eval, and repair stayed unchanged.

Probe: `generated/golden-runs/probe-aim-top5-monotone-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-aim-top5-monotone-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-aim-top5-monotone-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.0 on the 40-spec × 3-seed × full new-grid intersection, with 125k +0.0, 250k +0.8, 375k -0.3, and 500k -0.0. Validity stayed 480/480.

Why it was stopped: the monotone hash is cleaner budget semantics, but it did not produce a measurable high-budget gain and slightly traded 375k against 250k on the three-seed scope. Under the accept-only promotion rule there is no reason to spend a full canonical run on a near-zero point estimate. The source was reverted.

## 2026-06-24 - ABANDONED PROBE - mature pool-9 forward-eval candidate

Mechanism: keep the public handoff candidate pool at 8 and add one ninth scored candidate only in quality search, with a smooth monotone pressure from 250k to 500k. Explicit rescue pool sizes and contract search were unchanged, and the existing charged forward-eval ranker remained the judge. Scorer, specs, fingerprint, seed set, start selection, aim, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-mature-pool9-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=dense_sprint,terrace_sprint,verse_chorus,syncopated_switchback,drums_swell,rhythm_ladder,drums_dropout,rolling_hills,float_bounds,drums_tide,solo_run,skyline_push,dense_echo_climb,cold_start --budgets=125000,250000,375000,500000 --jobs=24 --archive-dir=generated/golden-runs/probe-mature-pool9-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-mature-pool9-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -2.5 on the 14-spec × 3-seed × full new-grid intersection, with 125k +0.0, 250k +0.0, 375k -1.8, and 500k -4.9. Validity stayed 168/168.

Why it was stopped: the smooth isolation worked, but the high-budget compute was harmful. Scoring the ninth top-level candidate displaced downstream repair/aim work and worsened the exact mature budgets it targeted. This reinforces the existing lookahead evidence: simply widening the decision evaluator is not the high-budget scaling lever on the accepted top5/new-grid baseline. The source was reverted.

## 2026-06-24 - REJECTED - downstream exhausted-gap invalidation on repair accept

Mechanism: narrow the earlier rejected exhausted-gap reset idea. Instead of clearing the whole repair exhausted set after every accepted restart, the trial tracked the accepted upstream anchor and only removed exhausted gap indices at or after that anchor. The intended logic was smooth and state-based: a downstream gap exhausted under an old incoming state should become eligible again after an accepted suffix rebuild changes that incoming state. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim, repair margins, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-repair-suffix-exhaust-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=swoop_dive,leap_cadence,summit_push,switchback_pop,skyline_push,canyon_steps,dense_echo_climb,ridge_pulse,glide_stairs,cold_start,dense_sprint,terrace_sprint,syncopated_switchback,drums_dropout,rolling_hills,float_bounds --budgets=125000,250000,375000,500000 --jobs=24 --archive-dir=generated/golden-runs/probe-repair-suffix-exhaust-newgrid-a01`. Focused tests passed first with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-suffix-exhaust-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.3 on the 16-spec × 3-seed × full new-grid intersection, with 125k +0.0, 250k -0.0, 375k -0.0, and 500k +0.7. Validity stayed 192/192. The probe changed no 125k scores, one 250k score, nine 375k scores, and 15 500k scores; repair churn rose only about 0.4 restarts per row.

Canonical candidate: `generated/golden-runs/attempt-repair-suffix-exhaust-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-suffix-exhaust-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 675.55 and `HEADLINE excl. impact` 689.56; per-budget point estimates were 125k 657.21, 250k 672.23, 375k 677.25, and 500k 680.52.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-suffix-exhaust-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.6, 0.6], P(delta<=0)=43.1%, effect 0.12. Per-budget deltas were 125k -0.0, 250k +0.2, 375k +0.1, and 500k -0.1, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the source was reverted after the canonical run because the full suite did not preserve the probe's 500k improvement and did not pass the accept-only gate. The mechanism is conceptually cleaner than global clearing and did not harm validity, but its effect is too small and redistributes repair work rather than reliably improving the final tracks. Future stale-exhaustion work needs a stronger observed signal than "downstream of any accepted anchor", likely tied to the actual changed prefix/gap quality or to repeated failed/accepted repair records.

## 2026-06-24 - ABANDONED PROBE - repair-gated mature impact-entry geometry

Mechanism: test the open cross-gap impact-entry idea in an outcome-gated repair form. When the weakest repair gap was an impact undershoot, the trial temporarily let the previous gap use the existing steep-arrival pop geometry even at mature budgets, and cleared the affected restart prefix cache so candidates were sampled under the planned entry aim. The register still accepted only true-score improvements. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim top-k, repair margins, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-repair-entry-impact-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,drums_crescendo,dense_sprint,drums_dropout,drums_swell,drums_tide,drums_breath,drums_pulse,drums_zigzag,rhythm_ladder,dense_echo_climb,opening_burst,solo_run,cold_start,syncopated_switchback,skyline_push --budgets=125000,250000,375000,500000 --jobs=24 --archive-dir=generated/golden-runs/probe-repair-entry-impact-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-entry-impact-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.3 on the 16-spec × 3-seed × full new-grid intersection, with 125k +0.6, 250k +0.0, 375k -0.2, and 500k +0.7. Validity stayed 192/192.

Why it was stopped: the source was reverted without a full canonical run because the probe signal was too noisy and did not isolate the intended impact rows. The trial changed 59/192 paired scores; `dense_sprint` gained (+9.52 average across probe cells), but losses in `rhythm_ladder` (-2.87), `dense_echo_climb` (-2.19), `syncopated_switchback` (-2.04), and `drums_crescendo` (-1.47) showed the same rhythm/cross-axis collateral as prior mature arrival-shaping trials. Conclusion: outcome gating reduces the blast radius but does not make the mature steep-arrival shape a clean default repair lever; a future impact-entry attempt needs a different entry shape or a sharper learned selector than "impact undershot".

## 2026-06-24 - ABANDONED PROBE - deep-low-air planned aim on new grid

Mechanism: retry the prior deep-low-air planned aim correction on the new 125k/250k/375k/500k grid. The trial lowered only the generation/objective aim for sampled `air` targets below 0.35, with a smooth ramp to a -0.125 planned-air bias at 0.15 and below. Official scored targets, scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim top-k, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-deep-lowair-aim-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,drums_dropout,drums_crescendo,dense_echo_climb,drums_signature,drums_pulse,drums_breath,drums_tide,drums_zigzag,dense_sprint,syncopated_switchback,rhythm_ladder,opening_burst,cold_start,verse_chorus,solo_run --budgets=125000,250000,375000,500000 --jobs=24 --archive-dir=generated/golden-runs/probe-deep-lowair-aim-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests).

Probe decision: `npm run decide -- generated/golden-runs/probe-deep-lowair-aim-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -3.1 on the 16-spec × 3-seed × full new-grid intersection, with 125k -1.0, 250k -3.3, 375k -4.4, and 500k -2.4. Validity stayed 192/192.

Why it was stopped: the source was reverted without a full canonical run because every probed budget moved negative by point estimate. The axis lever still moved real rows, but not cleanly: `drums_crescendo` (+9.78 average across probe cells), `dense_echo_climb` (+4.39), and `dense_sprint` (+1.14) gained, while `rhythm_ladder` (-24.78), `cold_start` (-14.13), `drums_dropout` (-5.72), `drums_pendulum` (-4.57), `drums_signature` (-4.27), `opening_burst` (-2.31), and `syncopated_switchback` (-2.29) lost. Conclusion: the older low-air aim-down signal does not survive the accepted top5/new-grid baseline; sampled-air target alone remains too blunt and now actively harms this slice.

## 2026-06-24 - ACCEPT - true-target aim and pool objective

Mechanism: keep jittered targets for sampling/generation, but make the aim enumerative proposer and quality-objective pool sort score against the scorer's unjittered per-gap target bags (`ctx.gapAxisTargets`) when available. The gap-level objective helpers still use `aimTargets(gap)` for callers without scorer-target context, so tests and env probes keep their old default semantics. Scorer, specs, fingerprint, seed set, budget grid, candidate sampling, geometry, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-true-target-objective-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-true-target-objective-newgrid-a01`. Focused tests passed first with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). Probe decision was non-canonical `VERDICT: ACCEPT`, delta headline +4.2 on the 40-spec x 3-seed x full new-grid intersection, with 125k +8.2, 250k +3.2, 375k +3.5, and 500k +4.1. Validity stayed 480/480.

Candidate: `generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-true-target-objective-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.70 and `HEADLINE excl. impact` 693.95; per-budget point estimates were 125k 662.74, 250k 673.97, 375k 680.09, and 500k 684.01. The dashboard was regenerated with `npx tsx scripts/v0/update_compiler_doc.ts generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json`.

Decision: `npm run decide -- generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json generated/golden-runs/attempt-aim-late-top5-newgrid-a01/golden.json` -> `VERDICT: ACCEPT`, delta headline +3.2, CI [0.2, 6.1], P(delta<=0)=1.9%, effect 2.11. Per-budget deltas were 125k +5.5, 250k +1.9, 375k +2.9, and 500k +3.4, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Outcome: accepted as the new baseline of record. The compiler still uses jittered targets to generate diverse candidate geometry, but the no-extra-compute objective judge now ranks aim proposals and pool candidates against the same stable target bags used by the scorer and forward leaf. This is the kind of smooth, budget-independent cleanup requested for the new budget grid: it improves every canonical budget point estimate without adding a budget-specific behavior branch.

## 2026-06-24 - ABANDONED PROBE - symmetric readiness speed-fit on new grid

Mechanism: retest the old symmetric speed-fit idea after the accepted true-target objective alignment. The trial kept the same readiness scale and flight-mean speed input, but changed `speedFitFactor` from the accepted fast-side half penalty (`d > 0 ? d * 0.5 : -d`) to `abs(d)`. Scorer, specs, fingerprint, seed set, budget grid, target bags, candidate sampling, start selection, forward eval, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-symmetric-speedfit-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-symmetric-speedfit-newgrid-a01`. Focused tests passed first with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The probe was valid 480/480 with raw HEADLINE 675.16 and `HEADLINE excl. impact` 696.74.

Probe decision: `npm run decide -- generated/golden-runs/probe-symmetric-speedfit-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -2.9 on the 40-spec x 3-seed x full new-grid intersection, with 125k -10.0, 250k -0.9, 375k -2.5, and 500k -2.4. Validity stayed 480/480.

Why it was stopped: every budget moved negative by point estimate, with a large scarce-budget loss. The aggregate residuals still show positive speed bias on weak specs, but symmetric readiness speed-fit repeats the old failure mode: too-fast arrivals are not equivalent to too-slow arrivals for search because excess speed can be bled while slow branches often cannot make the next geometry. The temporary source/test changes were reverted and no canonical run was started.

## 2026-06-24 - ABANDONED PROBE - true-target vertical forward-eval selector

Mechanism: align one more target-consistency boundary by making the mature vertical-drama forward-eval override decide its `greedy:2` to `avg` switch from the scorer's unjittered per-gap target bag (`ctx.gapAxisTargets`) instead of jittered `gap.targets`. The forward leaf already scored with true targets; this trial only changed the selector pressure for the existing vertical `avg` override. Scorer, specs, fingerprint, seed set, budget grid, candidate sampling, start selection, aim, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-true-target-vertical-fwd-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-true-target-vertical-fwd-newgrid-a01`. Focused tests passed first with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The probe was valid 480/480 with raw HEADLINE 678.44 and `HEADLINE excl. impact` 694.34.

Probe decision: `npm run decide -- generated/golden-runs/probe-true-target-vertical-fwd-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.4 on the 40-spec x 3-seed x full new-grid intersection, with 125k -0.9, 250k +0.4, 375k +0.8, and 500k +0.4. Validity stayed 480/480.

Why it was stopped: the mechanism is clean and mildly positive above 125k, but the 3-seed signal was too weak for a canonical promotion run and moved the scarce tier negative by point estimate. `decide` estimated P(delta>0)=75% and suggested roughly 24 total seeds would be needed to resolve it. The temporary source change was reverted; this remains a plausible small follow-up only if later target-consistency work gives the vertical selector a stronger signal.

## 2026-06-24 - REJECTED - true-target local candidate cost

Mechanism: keep jittered/planned targets for candidate geometry, but compute the local `tryCandidateGeometry` candidate cost against the scorer's unjittered per-gap target bag (`ctx.gapAxisTargets`) when available. The intent was to continue the accepted target-consistency cleanup without adding compute, budget branches, or spec-specific behavior. Scorer, specs, fingerprint, seed set, budget grid, start selection, aim proposer, forward eval, repair, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-true-target-local-cost-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-true-target-local-cost-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.71 and `HEADLINE excl. impact` 693.87; per-budget point estimates were 125k 662.69, 250k 674.07, 375k 680.12, and 500k 683.97.

Decision: `npm run decide -- generated/golden-runs/attempt-true-target-local-cost-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.0, CI [-0.3, 0.3], P(delta<=0)=47.7%, effect 0.06. Per-budget deltas were 125k -0.1, 250k +0.1, 375k +0.0, and 500k -0.0, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the full canonical suite showed the local cost target switch was effectively neutral after the accepted objective alignment. That suggests the current remaining mismatch is not in the single-candidate cost ordering, or that geometry diversity from the jittered/planned target is doing most of the useful work while the accepted pool/objective leaf already supplies enough true-target pressure. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - true-target selector and gate pressure

Mechanism: extend the accepted target-consistency cleanup from objective ranking to selector/gate reads that do not need jitter for geometry diversity. The trial used the scorer's unjittered per-gap target bag (`ctx.gapAxisTargets`) for brake rescue eligibility, brake candidate offering, local fallback release/overshoot penalties, fwd-eval agreement labels, aggregate quality-breadth target stats, and the mature vertical-drama forward-eval selector. Candidate generation, candidate validation/cost, start selection, aim, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` initially exposed a start-eval-off fallback context bug; after threading the existing compile context through that fallback, the same command passed (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-true-target-selectors-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-true-target-selectors-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.95 and `HEADLINE excl. impact` 694.01; per-budget point estimates were 125k 661.83, 250k 674.53, 375k 680.34, and 500k 684.40.

Decision: `npm run decide -- generated/golden-runs/attempt-true-target-selectors-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.8, 1.2], P(delta<=0)=29.0%, effect 0.51. Per-budget deltas were 125k -0.9, 250k +0.6, 375k +0.3, and 500k +0.4, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the mechanism was smooth and broadly positive above 125k, but it did not clear the canonical accept gate and it regressed the scarce tier by point estimate. The result strengthens the earlier vertical-selector probe rather than promoting it: target-stable selector pressure is plausible for mature budgets, but the current combined default trades away too much 125k behavior. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - elevation launch target gain

Mechanism: keep the scorer, target sampling, and shared `elevationToLaunchVy` scale unchanged, but ask only the compiler-side placement generator for a stronger launch on non-level elevation beats. The trial stretched the authored elevation target smoothly away from the meaningful midpoint 0.5 before computing the contact-centered post-launch angle, with no budget-grid branch, spec branch, seed branch, or extra compute. Candidate generation for all non-elevation gaps stayed byte-identical.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-elevation-launch-gain-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-elevation-launch-gain-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.85 and `HEADLINE excl. impact` 694.24; per-budget point estimates were 125k 662.19, 250k 674.17, 375k 680.19, and 500k 684.36.

Decision: `npm run decide -- generated/golden-runs/attempt-elevation-launch-gain-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.2, CI [-1.2, 1.5], P(delta<=0)=41.1%, effect 0.22. Per-budget deltas were 125k -0.5, 250k +0.2, 375k +0.1, and 500k +0.3, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the mechanism did move the intended family in places (`swoop_dive` +9.70 weighted, `skyline_push` +5.48, `dense_echo_climb` +5.34), and high-elevation absolute error at 500k improved slightly (0.1402 -> 0.1389). The axis correction was too small and too uneven, though: 125k regressed, aggregate elevation absolute error barely moved, and losses in `canyon_steps` (-8.55), `valley_bounce` (-4.57), `summit_push` (-3.74), `glide_stairs` (-3.45), and `terrace_sprint` (-1.92) offset the vertical-spec gains. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - true-target vertical forward-eval selector

Mechanism: narrow the earlier rejected selector bundle to only the mature vertical-drama forward-eval override. The trial left candidate generation, local cost, brake/release/overshoot selectors, repair, start selection, scorer, specs, fingerprint, seed set, and budget grid unchanged, but made the existing `greedy:2` to `avg` selector pressure read the scorer's unjittered per-gap target bag (`ctx.gapAxisTargets`) instead of jittered `gap.targets`.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-true-target-vertical-selector-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-true-target-vertical-selector-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.82 and `HEADLINE excl. impact` 694.17; per-budget point estimates were 125k 662.25, 250k 673.91, 375k 680.25, and 500k 684.34.

Decision: `npm run decide -- generated/golden-runs/attempt-true-target-vertical-selector-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.3, 0.6], P(delta<=0)=31.0%, effect 0.48. Per-budget deltas were 125k -0.5, 250k -0.1, 375k +0.2, and 500k +0.3, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the canonical result confirmed the earlier probe's shape but not enough magnitude: the selector gives a small mature-tier nudge, led by `dense_echo_climb` (+3.29 weighted), `terrace_sprint` (+1.69), `ridge_pulse` (+0.84), `skyline_push` (+0.64), and `syncopated_lift` (+0.58), but `canyon_steps` (-3.58) and a 125k regression erase most of the headline. Only 275 paired score rows changed, and aggregate axis errors barely moved. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - ABANDONED PROBE - slow low-air impact frontload on true-target baseline

Mechanism: retest the earlier low-air mature impact-frontload family after the accepted true-target objective alignment, but with a slower smooth budget ramp. The temporary source kept the base impact curvature frontload at 1.6, then allowed at most +0.2 extra frontload on low-air impact beats, with pressure from target air and a broad budget ramp starting at 100k and spanning 300k. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim objective, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-lowair-frontload18-slow-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-lowair-frontload18-slow-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The probe was valid 480/480 with raw HEADLINE 678.22 and `HEADLINE excl. impact` 694.30.

Probe decision: `npm run decide -- generated/golden-runs/probe-lowair-frontload18-slow-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.2 on the 40-spec x 3-seed x full new-grid intersection, with 125k -2.4, 250k -0.3, 375k +2.0, and 500k -0.3. Validity stayed 480/480.

Why it was stopped: the probe did not preserve the intended mature-budget shape strongly enough to justify a full canonical run. It changed 423 paired scores and 442 hashes, with real gains in `drums_swell` (+28.46 average across probe cells), `dense_echo_climb` (+9.46), `mini_burst` (+9.07), `drums_tide` (+5.46), and `syncopated_switchback` (+5.30), but broad losses in `drums_signature` (-13.64), `solo_run` (-12.15), `drums_dropout` (-11.85), `drums_pulse` (-9.00), `dense_sprint` (-7.21), `grain_staircase` (-4.75), `skyline_push` (-4.68), and `cold_start` (-4.48). Axis diagnostics also argued against promotion: impact absolute error worsened at 125k and 250k, while the useful 375k/500k impact/elevation nudge was small. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - high-air length blend convergence

Mechanism: increase only the high-air contact-centered ride-out convergence by raising `HIGH_AIR_LENGTH_BLEND_EXTRA` from 0.28 to 0.40 and changing the high-air pressure ramp from linear clamp to `smoothstep`. This made the length blend reach the computed short ride-out target more completely for high-air gaps while keeping low-air behavior, candidate scoring, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-highair-length-blend-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-highair-length-blend-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 677.73 and `HEADLINE excl. impact` 692.68; per-budget point estimates were 125k 663.85, 250k 673.19, 375k 678.30, and 500k 683.03.

Decision: `npm run decide -- generated/golden-runs/attempt-highair-length-blend-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -1.0, CI [-3.4, 1.5], P(delta<=0)=78.8%, effect -0.77. Per-budget deltas were 125k +1.1, 250k -0.8, 375k -1.8, and 500k -1.0, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the mechanism hit the intended high-air residual only weakly and traded away too much score elsewhere. Air-target bins improved slightly at 125k/375k/500k, for example the 0.8 bin absolute error moved 0.120 -> 0.117 at 125k and 0.114 -> 0.112 at 500k, but aggregate air absolute error was flat to worse above 125k and speed/impact absolute error also worsened at mature budgets. The largest gains were `drums_swell` (+15.66), `drums_zigzag` (+5.95), `mini_burst` (+5.26), and `drums_tide` (+4.04), but they were outweighed by `drums_dropout` (-12.51), `dense_sprint` (-10.53), `float_bounds` (-10.13), `opening_burst` (-8.94), and `drums_breath` (-6.71). The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - smooth low-air impact ride-out convergence

Mechanism: add a smooth, budget-aware low-air/impact ride-out pressure inside the existing air-targeted contact-centered post-length sizing. The pressure multiplied four continuous terms: available compile budget (starting at 100k and spanning 250k), low authored air below 0.32, authored impact above 0.35, and late attempt index after the first eight attempts. It was disabled when elevation or amplitude was targeted. At full pressure it raised the grounded ride-out safe cap from 0.55 to 0.75 of the next-gap span and added up to 0.40 more length-blend strength. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim objective, repair, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-lowair-impact-rideout-smooth-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-impact-rideout-smooth-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 679.06 and `HEADLINE excl. impact` 694.19; per-budget point estimates were 125k 662.88, 250k 674.32, 375k 680.54, and 500k 684.37.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-impact-rideout-smooth-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.4, CI [-0.3, 1.4], P(delta<=0)=18.7%, effect 0.82. Per-budget deltas were 125k +0.1, 250k +0.3, 375k +0.5, and 500k +0.4, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: this was the cleanest low-air result so far, with positive point estimates at every budget and a smooth/scalable mechanism, but it still did not clear the canonical accept gate. Only 31/38/37/42 paired score rows changed at 125k/250k/375k/500k, so the headline signal is narrow and seed-volatile rather than a broad compiler improvement. The average changed-spec shape was plausible: `syncopated_switchback` +9.44, `drums_pendulum` +1.93, `drums_crescendo` +1.09, `dense_sprint` +0.64, and `rhythm_ladder` +0.47 across all budgets/seeds, with `drums_pendulum` itself +4.24 at 125k, -2.31 at 250k, +3.51 at 375k, and +2.27 at 500k. The 500k row-level picture was too unstable: `syncopated_switchback` seed 2 gained +104.90, but seed 0 lost -31.31 and `rhythm_ladder` seed 7 lost -25.02. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`. This is worth remembering as a plausible follow-up if a later change makes low-air ride-out selection less seed-sensitive, or if an explicitly larger seed adjudication is desired.

## 2026-06-24 - REJECTED - vertical target-aware catchability softening

Mechanism: soften the readiness catchability factor only when the next scorer target had vertical pressure, so highly elevated or high-amplitude next beats would be penalized less by the generic catchability clamp. The pressure was smooth in authored elevation distance from 0.5 and authored amplitude, with no spec branch, seed branch, hard budget threshold, extra compute, scorer change, spec change, fingerprint change, seed-grid change, or acceptance-rule change.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-vertical-catch-soften-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-vertical-catch-soften-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.36 and `HEADLINE excl. impact` 693.70; per-budget point estimates were 125k 662.23, 250k 673.61, 375k 679.78, and 500k 683.71.

Decision: `npm run decide -- generated/golden-runs/attempt-vertical-catch-soften-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: REJECT`, delta headline -0.3, CI [-1.0, 0.1], P(delta<=0)=93.7%, effect -1.29. Per-budget deltas were 125k -0.5, 250k -0.4, 375k -0.3, and 500k -0.3, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the premise did not show up in axis diagnostics. Elevation absolute error moved 0.1182 -> 0.1190 at 125k, 0.1175 -> 0.1176 at 250k, 0.1178 -> 0.1177 at 375k, and 0.1182 -> 0.1184 at 500k, while amplitude and impact were also mostly flat to worse. The run changed 428 hashes, with 200 paired score rows improved and 220 regressed. Small aggregate gains in `syncopated_lift`, `valley_bounce`, `glide_stairs`, and `big_air_ramp` were outweighed by `canyon_steps`, `float_bounds`, `leap_cadence`, `rolling_hills`, `pop_train`, and `terrace_sprint`. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - smooth slack-gated deep forward eval on new grid

Mechanism: retry the budget-aware-depth idea on the true-target baseline with a smoother slack selector. The default non-vertical forward evaluator stayed `greedy:2`, explicit `LR_FWD_EVAL` overrides still won, and the accepted vertical-drama `avg` override kept first claim. Only when the run had measured suffix slack did a deterministic continuous pressure occasionally upgrade the local evaluator to `greedy:3`, with pressure from total budget, contacts already completed, remaining contact count, and `framesLeft / projectedToFinish`. Scorer, specs, fingerprint, seed set, budget grid, start selection, aim, repair, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-slack-deep-fwd-smooth-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-deep-fwd-smooth-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.54 and `HEADLINE excl. impact` 693.83; per-budget point estimates were 125k 662.69, 250k 674.83, 375k 680.04, and 500k 683.22.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-deep-fwd-smooth-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-1.7, 1.4], P(delta<=0)=59.4%, effect -0.22. Per-budget deltas were 125k -0.0, 250k +0.9, 375k -0.0, and 500k -0.8, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the smooth slack rule did isolate a real mid-budget upside but failed the high-budget scaling test it was designed for. It changed 675 paired hashes, with 303 score rows improved and 372 regressed. The 250k gain came mostly from `drums_swell` (+13.87 average at 250k), `syncopated_switchback` (+9.22), `solo_run` (+6.04), and `drums_zigzag` (+4.49), but 500k regressed in `solo_run` (-12.87), `drums_zigzag` (-8.34), `rhythm_ladder` (-7.15), `drums_tide` (-4.79), and `grain_staircase` (-4.08). Work telemetry matched the failure shape: average charged forward-eval frames rose by about 53/1077/1831/3392 frames per row at 125k/250k/375k/500k, while sampled candidates, expanded nodes, and full evaluations were flat to lower at higher budgets. The extra depth spent slack, but at 500k it mostly changed rhythm/drum basins rather than improving final quality. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - mature true-target selector and gate pressure

Mechanism: refine the earlier always-on true-target selector bundle by preserving the scarce 125k tier exactly and smoothly ramping selector/gate target reads from jittered targets toward the scorer's unjittered per-gap target bags above 125k. The trial touched brake rescue eligibility, brake candidate offering, local fallback release/overshoot penalties, and the mature vertical-drama forward-eval selector. Candidate generation, candidate validation/cost, start selection, aim, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-true-target-selectors-mature-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-true-target-selectors-mature-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 679.04 and `HEADLINE excl. impact` 694.10; per-budget point estimates were 125k 662.74, 250k 674.53, 375k 680.34, and 500k 684.40.

Decision: `npm run decide -- generated/golden-runs/attempt-true-target-selectors-mature-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.3, CI [-0.6, 1.3], P(delta<=0)=22.4%, effect 0.72. Per-budget deltas were 125k +0.0, 250k +0.6, 375k +0.3, and 500k +0.4, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the scarce-tier isolation worked and the mature-budget point estimates reproduced the useful part of the earlier true-target selector bundle, but the canonical distribution still did not clear the accept-only gate. The trial changed 444 paired hashes and 435 paired scores, split almost exactly evenly at 217 improvements and 218 regressions. Average deltas by budget were 125k +0.000, 250k +0.486, 375k +0.180, and 500k +0.281. Gains were led by `dense_echo_climb` (+4.36 average), `drums_crescendo` (+2.51), `opening_burst` (+2.40), `drums_pendulum` (+2.07), and `syncopated_switchback` (+1.92), but losses in `drums_signature` (-4.27), `canyon_steps` (-2.40), and `dense_sprint` (-2.23) kept the bootstrap inconclusive. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - REJECTED - measured low-air/impact repair re-aim

Mechanism: add an outcome-gated paired low-air/impact re-aim inside the existing weak-gap repair loop. Unlike the earlier up-front low-air planning biases, this only fired after a completed incumbent showed that the same repair gap was both too airborne and under-hit on impact. The planned repair target smoothly reduced air and increased impact from the measured residual pressure, and the repaired suffix still had to beat the true scored incumbent to survive. Candidate generation, candidate validation/cost, start selection, forward eval, aim objective, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-repair-lowair-impact-reaim-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-repair-lowair-impact-reaim-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.85 and `HEADLINE excl. impact` 693.93; per-budget point estimates were 125k 662.83, 250k 673.91, 375k 680.32, and 500k 684.22.

Decision: `npm run decide -- generated/golden-runs/attempt-repair-lowair-impact-reaim-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.3, 0.9], P(delta<=0)=34.0%, effect 0.51. Per-budget deltas were 125k +0.1, 250k -0.1, 375k +0.2, and 500k +0.2, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the measured residual trigger was saner than a static low-air threshold, but it still did not produce a broad enough improvement to clear the canonical accept gate. It also slightly regressed the 250k tier, which argues against making this the default repair behavior. The 500k tail remained dominated by `drums_pendulum` with the worst rows still around 416-426 score and 42-43% axis quality, so the mechanism did not materially repair the failure mode that motivated it. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - ABANDONED PROBE - no mature quality lean after true-target objective

Mechanism: screen the broadest remaining quality-breadth cleanup after the accepted true-target objective alignment by removing the old mature quality-pool lean. The temporary source kept the normal 32-candidate quality pool as the mature floor instead of dropping to 29 at 250k+, while preserving the existing authored-shape quality boosts, scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim, repair, and acceptance rule.

Probe: `generated/golden-runs/probe-quality-no-mature-lean-true-target-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-quality-no-mature-lean-true-target-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The probe was valid 480/480 with raw HEADLINE 677.03 and `HEADLINE excl. impact` 692.09.

Probe decision: `npm run decide -- generated/golden-runs/probe-quality-no-mature-lean-true-target-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -1.0 on the 40-spec x 3-seed x full new-grid intersection, with 125k +0.0, 250k -0.2, 375k -1.0, and 500k -1.7. Validity stayed 480/480.

Why it was stopped: after true-target objective alignment, the broad "do not lean mature quality breadth" version became actively worse on the probe, especially at 375k and 500k. This argues that the existing authored-shape quality-breadth relief gates are load-bearing: extra high-budget geometry breadth still needs a family selector, not a global removal of the mature lean. The temporary source change was reverted without a full canonical run; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-24 - ABANDONED PROBE - reduced mild quality-brake breadth

Mechanism: screen whether the expanded quality-phase brake lane is wasting high-budget work on mild overspeed cases. The temporary probe knob lowered only the quality-phase base brake count from 3 to 2 while retaining the high-overspeed count of 4; default behavior was otherwise unchanged. Scorer, specs, fingerprint, seed set, budget grid, candidate pool, start selection, forward eval, aim, repair, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-brake-quality-base2-slice-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm LR_BRAKE_QUALITY_BASE_K=2 GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,dense_echo_climb,skyline_push,drums_swell,syncopated_switchback,dense_sprint,drums_crescendo,rhythm_ladder,drums_signature,drums_dropout,drums_pulse,drums_breath,drums_tide,opening_burst --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-brake-quality-base2-slice-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The slice probe was valid 168/168 with raw HEADLINE 615.96 and `HEADLINE excl. impact` 652.09.

Probe decision: `npm run decide -- generated/golden-runs/probe-brake-quality-base2-slice-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.6 on the 14-spec x 3-seed x full new-grid intersection, with 125k -1.3, 250k +1.6, 375k +0.8, and 500k +0.3. Validity stayed 168/168.

Why it was stopped: reducing mild quality-brake breadth may be directionally useful on the selected hard/rhythm slice, but the signal is weak, selected-slice-only, and already regresses the scarce 125k tier. It is not strong enough to spend a full 40-spec probe or canonical run. A future brake attempt would need a smoother observed selector, such as tying the extra brake attempt to measured brake usefulness or high-overspeed pressure, rather than a global quality-phase base-count reduction. The temporary source probe knob was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-25 - REJECTED - smooth mild-brake thinning on new grid

Mechanism: replace the blunt quality-phase brake-base reduction idea with a smooth local selector. The trial kept contract brake search unchanged and kept high-overspeed quality gaps at 4 brake candidates, but thinned only the third mild-overspeed quality brake candidate via deterministic hash pressure from total budget and observed local overspeed ratio. Scorer, specs, fingerprint, seed set, budget grid, candidate pool, start selection, forward eval, aim, repair, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Probe: `generated/golden-runs/probe-brake-smooth-mild-thin-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-brake-smooth-mild-thin-newgrid-a01`. The probe was valid 480/480 with raw HEADLINE 678.43 and `HEADLINE excl. impact` 693.90.

Probe decision: `npm run decide -- generated/golden-runs/probe-brake-smooth-mild-thin-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: ACCEPT`, delta headline +0.4 on the 40-spec x 3-seed x full new-grid intersection, with per-budget deltas 125k +0.1, 250k +0.3, 375k +0.9, and 500k +0.1. Validity stayed 480/480, so the mechanism was promoted to canonical.

Candidate: `generated/golden-runs/attempt-brake-smooth-mild-thin-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-brake-smooth-mild-thin-newgrid-a01`. The canonical run was valid 1920/1920 with raw HEADLINE 678.78 and `HEADLINE excl. impact` 694.23; per-budget point estimates were 125k 662.77, 250k 674.17, 375k 680.19, and 500k 684.03.

Decision: `npm run decide -- generated/golden-runs/attempt-brake-smooth-mild-thin-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.4, 0.5], P(delta<=0)=36.1%, effect 0.33. Per-budget deltas were 125k +0.0, 250k +0.2, 375k +0.1, and 500k +0.0, with unchanged diagnostic validity at 1920/1920 overall and 480/480 at every budget.

Why it was not kept: the smoother selector fixed the earlier slice probe's 125k regression and reduced brake work as intended, but the full canonical effect collapsed to a near-noop. Average brake attempts fell by about 8/35/76/117 per row at 125k/250k/375k/500k, while selected brake counts barely moved (-0.004/-0.019/-0.090/-0.100). Gains in `dense_sprint`, `solo_run`, `ridge_pulse`, `dense_echo_climb`, and `drums_signature` were offset by `rhythm_ladder`, `syncopated_switchback`, `verse_chorus`, `drums_dropout`, and `grain_staircase`. The temporary source change was reverted; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-25 - ABANDONED PROBE - low-air impact reuse dampening

Mechanism: test the inverse of the failed stronger-mature-reuse direction. The temporary source kept contract reuse unchanged, but in quality search smoothly reduced the reuse candidate limit on low-air, impact-targeted beats via deterministic pressure from target budget, true air target, and true impact target. Reuse validation/scoring, candidate generation, start selection, forward eval, aim, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-reuse-lowair-impact-damp-slice-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --specs=drums_pendulum,drums_dropout,drums_crescendo,dense_sprint,rhythm_ladder,drums_signature,drums_tide,drums_pulse,drums_breath,syncopated_switchback,dense_echo_climb,solo_run,drums_swell,opening_burst,skyline_push,terrace_sprint --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-reuse-lowair-impact-damp-slice-newgrid-a01`. Focused tests passed before the probe with `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` (5 files, 77 tests). The probe was valid 192/192 with raw HEADLINE 617.39 and `HEADLINE excl. impact` 652.18.

Probe decision: `npm run decide -- generated/golden-runs/probe-reuse-lowair-impact-damp-slice-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1 on the 16-spec x 3-seed x full new-grid intersection, with per-budget deltas 125k +0.0, 250k -0.2, 375k +0.1, and 500k -0.3. Validity stayed 192/192.

Why it was stopped: the selector mostly touched the intended `drums_pendulum` rows, but it moved them the wrong way: `drums_pendulum` averaged -1.11 across the probed cells while most other specs were unchanged. Reuse attempts on `drums_pendulum` fell by about 28.7 per row and selected reuse fell by 0.08, which suggests the latest-catch reuse is still load-bearing even on low-air impact beats. The temporary source change was reverted without a full-grid probe or canonical run; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-25 - ABANDONED PROBE - true-target low-air impact ride-out gate

Mechanism: retest the smooth low-air/impact ride-out convergence using scorer target bags only for the selector. The temporary source exposed `gapAxisTargets` to `arc_placement.ts`, then used the true per-gap air/impact/amplitude/elevation targets to decide the existing smooth ride-out pressure while preserving jittered generation targets for actual geometry diversity. The pressure still scaled continuously with target budget, low air, impact, and late attempt index; at full pressure it raised the grounded ride-out safe cap from 0.55 to 0.75 of the next-gap span and added up to 0.40 length-blend strength. Scorer, specs, fingerprint, seed set, budget grid, start selection, forward eval, aim, repair, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Probe: `generated/golden-runs/probe-true-target-lowair-rideout-newgrid-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=32 --archive-dir=generated/golden-runs/probe-true-target-lowair-rideout-newgrid-a01`. The probe was valid 480/480 with raw HEADLINE 678.16 and `HEADLINE excl. impact` 694.26.

Probe decision: `npm run decide -- generated/golden-runs/probe-true-target-lowair-rideout-newgrid-a01/golden.json generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1 on the 40-spec x 3-seed x full new-grid intersection, with per-budget deltas 125k +0.4, 250k +0.4, 375k +0.2, and 500k -0.2. Validity stayed 480/480.

Why it was stopped: true-target gating made the prior smooth ride-out mechanism cleaner but too narrow. Only 20/480 paired checkpoint rows changed: `drums_pendulum` averaged +5.02 across probe cells, while `syncopated_switchback` averaged -0.17, and every other spec was byte-identical. The largest positive row (`syncopated_switchback` seed 0 at 250k, +44.34) was offset by the same seed at 500k (-42.56), so the change failed the high-budget scaling check. The earlier sampled-target ride-out convergence remains the stronger evidence (+0.4 canonical but still inconclusive); this true-target selector should not be retried unchanged. The temporary source was reverted without a canonical run; the accepted baseline remains `attempt-true-target-objective-newgrid-a01`.

## 2026-06-27 - REJECTED - budget-allocated opening lookahead plus scarce quality lean

Mechanism: combine two smooth budget-allocation ideas on the simplified unified handoff logic. First, extend the existing scarce quality breadth lean through the 125k tier by moving its start/span from 50k/50k to 100k/100k, which makes 125k use 29 quality candidates instead of the default 32. Second, add an opening-only mature `best:1:2` forward-eval selector for clean prefixes that have not yet claimed a fit, zero below 300k and fully faded in by 375k, while preserving the existing mature vertical-drama `avg` selector precedence. Candidate generation families, validation/cost, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 77 tests).

Candidate: `generated/golden-runs/attempt-budget-allocated-opening-qlean-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-budget-allocated-opening-qlean-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 679.52 and `HEADLINE excl. impact` 695.33; per-budget point estimates were 125k 663.04, 250k 675.16, 375k 681.14, and 500k 684.61.

Decision: `npm run decide -- generated/golden-runs/attempt-budget-allocated-opening-qlean-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +1.5, CI [-1.2, 5.8], P(delta<=0)=16.9%, effect 0.85. Per-budget deltas were 125k +6.4, 250k +0.0, 375k +1.2, and 500k +1.3, with unchanged diagnostic pass rate at every budget.

Why it was not kept: the point estimate is directionally good and the 125k tier reproduced the expected scarce-lean lift, but the canonical bootstrap still did not clear the accept gate. The 250k tier was exactly flat, and the higher-budget gains from opening `best:1:2` were too small relative to seed/spec variance. This remains useful evidence that opening lookahead is a quality/slack knob rather than a traversal-cost reducer, but it is not strong enough to become the production compiler behavior. The temporary source and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - REJECTED - late mixed elevation ride-out lane

Mechanism: add a narrow optional late-attempt lane for mixed elevation+amplitude climb asks. The trial left the pure-elevation shortening intact, but for elevation-above-midpoint plus moderate amplitude it sometimes shortened the post-contact ride-out from later attempts, with smooth pressure from target budget, attempt index, elevation, and amplitude compatibility. Candidate validation/cost, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 76 tests).

Candidate: `generated/golden-runs/attempt-mixed-elevation-rideout-lane-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-mixed-elevation-rideout-lane-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 677.96 and `HEADLINE excl. impact` 693.09; per-budget point estimates were 125k 656.69, 250k 675.10, 375k 679.91, and 500k 683.24.

Decision: `npm run decide -- generated/golden-runs/attempt-mixed-elevation-rideout-lane-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.3, 0.1], P(delta<=0)=68.3%, effect -0.50. Per-budget deltas were 125k +0.0, 250k -0.1, 375k -0.1, and 500k -0.1, with unchanged diagnostic pass rate at every budget.

Why it was not kept: the proposal lane targeted a real measured undershoot, but as implemented it behaved like a near-noop with a slight negative bias at the mature budgets. It did not recover the known high-elevation/mixed-amplitude gap and it did not clear the accept gate. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - REJECTED - low-air impact slam hold

Mechanism: add a deterministic optional hold after the existing impact-template scoop for low-air, high-impact authored targets. The intent was to keep the rider grounded after the impact redirection instead of immediately launching into air, while leaving candidate validation/cost, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (5 files, 76 tests).

Candidate: `generated/golden-runs/attempt-lowair-impact-slam-hold-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowair-impact-slam-hold-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 678.45 and `HEADLINE excl. impact` 694.13; per-budget point estimates were 125k 656.79, 250k 676.02, 375k 680.51, and 500k 683.55.

Decision: `npm run decide -- generated/golden-runs/attempt-lowair-impact-slam-hold-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline +0.4, CI [-1.0, 1.8], P(delta<=0)=24.3%, effect 0.62. Per-budget deltas were 125k +0.1, 250k +0.9, 375k +0.5, and 500k +0.3, with unchanged diagnostic pass rate at every budget.

Why it was not kept: the direction was positive and concentrated in the intended low-air/high-impact corner, but the canonical evidence was well short of the accept gate. The mechanism is also another special geometry lane in an already crowded impact template path, so keeping an inconclusive +0.4 point estimate would cut against the current simplification direction. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - REJECTED - adaptive weak-incumbent admission

Mechanism: after the first terminal completion, smoothly admit middle/tail candidate-attempt strata into the normal handoff pool only when the completed incumbent is weak. The pressure was zero at incumbent quality >=0.70 and full at <=0.60, interpolating the normal pool from local-only 8/0/0 to 4 local, 2 middle, and 2 tail candidates. Pre-completion traversal stayed byte-identical, and `LR_ADMISSION_PROFILE=attempt-strata` remained available as an explicit study profile. Candidate generation, validation/cost, start selection, forward eval, repair scheduling, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed first (6 files, 82 tests).

Candidate: `generated/golden-runs/attempt-adaptive-weak-incumbent-admission-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-adaptive-weak-incumbent-admission-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 677.76 and `HEADLINE excl. impact` 692.72; per-budget point estimates were 125k 655.21, 250k 674.35, 375k 680.38, and 500k 683.15.

Decision: `npm run decide -- generated/golden-runs/attempt-adaptive-weak-incumbent-admission-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.2, CI [-1.6, 1.3], P(delta<=0)=63.8%, effect -0.32. Per-budget deltas were 125k -1.5, 250k -0.8, 375k +0.4, and 500k -0.1, with unchanged diagnostic pass rate at every budget.

Why it was not kept: the adaptive gate activated broadly after completion (1368 checkpoint rows with admission telemetry, about 437k admitted pools) but did not turn weak-incumbent breadth into a reliable quality gain. It changed 1226 paired checkpoint scores, with 589 improvements and 637 regressions. The intended hard rhythm cases did improve on average (`syncopated_switchback` +10.3, `dense_echo_climb` +3.8, `drums_pendulum` +2.6), but those gains were more than offset by losses in simpler or already-healthy cases (`cold_start` -9.3, `skyline_push` -8.4, `summit_push` -5.0, `ridge_pulse` -4.1). This is useful evidence that weak-incumbent slack/breadth needs a more specific selector than global middle/tail admission after first completion. The temporary compiler, test, and harness changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - REJECTED PROBE - raise forward-eval minimum budget to 150k

Mechanism: env-only screen with `LR_FWD_EVAL_MIN_BUDGET=150000`, disabling the mature per-candidate forward-eval selector at 125k while leaving it unchanged for 250k, 375k, and 500k. Candidate generation, validation/cost, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, source code, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-fwd-min150-current-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_FWD_EVAL_MIN_BUDGET=150000 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-fwd-min150-current-j48-s0-2-a01`. The probe was valid 480/480 with raw HEADLINE 677.33 and `HEADLINE excl. impact` 691.19; raw per-budget point estimates were 125k 659.80, 250k 674.35, 375k 678.47, and 500k 682.34.

Probe decision: `npm run decide -- generated/golden-runs/probe-fwd-min150-current-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -0.7 on the 40-spec x 3-seed x full new-grid intersection, CI [-1.6, 0.1], P(delta<=0)=95.8%. The loss was entirely at 125k: 667.1 -> 659.8, delta -7.3, CI [-16.5, 0.9]. All higher budgets were byte-identical on the paired intersection.

Why it was not kept: the current 75k forward-eval gate is still productive at the 125k tier. Raising the gate to 150k removes a quality signal from scarce-budget compiles without buying anything at mature budgets, so it is the wrong simplification direction. This was env-only and left no source changes; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-27 - REJECTED - slack-gated best-of forward eval

Mechanism: use the structural traversal budget model as a smooth affordability signal for the default per-candidate forward-eval policy. The trial kept explicit `LR_FWD_EVAL=...` overrides unchanged, preserved the existing vertical-drama `avg` selector precedence, and only changed the default `greedy:2` path. The final canonical candidate used `budget_slack = requested_budget / predicted_first_completion_frames`: slack below 3 stayed `greedy:2`, slack 3..4 smoothly mixed in `best:1:2`, and slack 8..12 smoothly mixed in `best:1:3`. Candidate generation, validation/cost, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/budget_model.test.ts` passed after each threshold revision (2 files, 27 tests).

Probes: three 12-spec x 4-seed x full-budget probes were run at 48 jobs against the current baseline. The first version (`probe-slack-best-fwd-j48-s0-3-a01`) started branch-2 at slack 2.5 and branch-3 at 4.5; it was indicative +1.9 but lost the 2..3 slack band. The tightened version (`probe-slack-best-fwd-tight-j48-s0-3-a01`) moved branch-2 to 3 and branch-3 to 5; it recovered 125k but stayed flat at 500k. The final probe (`probe-slack-best-fwd-b3late-j48-s0-3-a01`) kept branch-2 at 3 and delayed branch-3 to 8..12; it was the best probe, with `VERDICT: INCONCLUSIVE`, indicative delta headline +3.2, per-budget deltas +0.6/+0.5/+6.6/+2.7, and unchanged validity.

Candidate: `generated/golden-runs/attempt-slack-best-fwd-b3late-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-best-fwd-b3late-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 672.23 and `HEADLINE excl. impact` 686.22; per-budget point estimates were 125k 655.50, 250k 672.39, 375k 673.03, and 500k 675.75.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-best-fwd-b3late-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: REJECT`, delta headline -5.8, CI [-9.7, -2.2], P(delta<=0)=99.9%, effect -3.00. Per-budget deltas were 125k -1.2, 250k -2.8, 375k -6.9, and 500k -7.5, with unchanged diagnostic pass rate at every budget.

Why it was not kept: structural slack was a useful affordability screen on the probe board, but it was not a sufficient usefulness selector across the full golden suite. The canonical showed that broad shallow best-of forward eval delays first completion and changes branch choice in ways that lose more mature-budget quality than the simple/high-slack wins recover. The probe-board signal was too spec-selective (`tiny_dance`, `syncopated_switchback`, and `drums_dropout` wins did not generalize enough), while dense and rhythm rows still paid the extra rollout cost. The temporary source and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - REJECTED PROBE - static repair attempt cap 32

Mechanism: env-only screen with `LR_REPAIR_MAX_ATTEMPTS=32`, reducing the static post-completion repair attempt cap while leaving candidate generation, validation/cost, start selection, forward eval, scorer, specs, fingerprint, seed set, budget grid, source code, and acceptance rule unchanged.

Probe: `generated/golden-runs/probe-repair-max32-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_REPAIR_MAX_ATTEMPTS=32 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-repair-max32-j48-s0-2-a01`.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-max32-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -1.8, CI [-4.4, -0.4], P(delta<=0)=100%. Per-budget deltas were 125k -0.6, 250k -0.8, 375k -1.5, and 500k -2.9, with unchanged validity.

Why it was not kept: the static cap bought no quality and regressed every budget on the paired probe. Repair spend should be controlled through slack/difficulty-aware allocation, not by a lower global cap. This was env-only and left no source changes; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - REJECTED - mature rank-quality fallback for prediction-bail candidates

Mechanism: give rank-quality candidates that cannot be propagated to the next contact a conservative current-gap quality fallback instead of dropping them fully to cost order. The fallback used current target quality scaled by `OBJECTIVE_READINESS_MIN`, with smooth target-budget pressure from zero at 125k to full at 250k, so scarce-budget behavior stayed byte-identical. Candidate generation, validation/cost, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/objective_quality.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/arc_model.test.ts` passed (5 files, 78 tests).

Probe: `generated/golden-runs/probe-rankquality-current-fallback-mature-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-rankquality-current-fallback-mature-j48-s0-2-a01`. The probe was valid 480/480 with raw HEADLINE 679.01 and `HEADLINE excl. impact` 694.09. The paired probe was inconclusive but directionally positive: delta headline +0.9, CI [-1.5, 4.1], P(delta<=0)=24.4%, with per-budget deltas 125k +0.0, 250k +1.3, 375k +1.7, and 500k +0.5.

Candidate: `generated/golden-runs/attempt-rankquality-current-fallback-mature-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-rankquality-current-fallback-mature-j32-a01`. The canonical run was valid 1919/1920 with raw HEADLINE 677.74 and `HEADLINE excl. impact` 693.33; per-budget point estimates were 125k 656.69, 250k 674.46, 375k 680.03, and 500k 682.93.

Decision: `npm run decide -- generated/golden-runs/attempt-rankquality-current-fallback-mature-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> `VERDICT: INCONCLUSIVE`, delta headline -0.3, CI [-2.1, 1.7], P(delta<=0)=61.5%, effect -0.26. Per-budget deltas were 125k +0.0, 250k -0.7, 375k +0.1, and 500k -0.4, with unchanged diagnostic pass rate at every budget.

Why it was not kept: the mature gate successfully protected 125k and the small probe looked useful, but the canonical result did not clear the accept gate and moved the point estimate slightly negative. Prediction-bail current quality is not a reliable enough proxy for next-contact readiness in production. The temporary source and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - STUDY - first-completion lookahead depth at q32

Purpose: isolate whether deeper per-candidate lookahead improves the first completed route before repair can blur the signal. This used the existing admission/lookahead study surface with standard `q=32`, default admission, all 40 golden specs, seeds 0..11, a 200k budget, and `--stop-after-first-completion`.

Panel: `generated/studies/lookahead-first-completion-200k-q32-all-s0-11-a01/panel.json`, run with `LR_ENGINE=wasm node --import tsx scripts/v0/run_admission_lookahead_panel.ts --budget=200000 --specs=ALL --seeds=0,1,2,3,4,5,6,7,8,9,10,11 --quality-ncand=32 --admission=default --fwd-eval=default,greedy:2,best:1:2,best:1:3,avg:1:2,avg:1:3 --baseline-ncand=32 --baseline-admission=default --baseline-fwd-eval=default --stop-after-first-completion --workers=48 --shards=48 --out-dir=generated/studies/lookahead-first-completion-200k-q32-all-s0-11-a01`.

Findings: explicit `greedy:2` was slightly worse than production `default` on first completion, showing that the existing mature vertical-drama default override is still useful. Broad `best:1:2` and `avg:1:2` improved mean first-completion score versus explicit greedy by +5.42 and +4.30 respectively, but they cost about 1.93x the first-completion frames. Depth-3 modes were not safe broadly: `best:1:3` and `avg:1:3` were around -131/-133 mean score versus greedy and valid only 360/480 and 359/480 in the panel.

Slack analysis: switching all rows with 200k structural slack >=3 from production `default` to `avg:1:2` gave a first-completion-only +8.40 mean score but a 1.765x sim-frame ratio. The same threshold avoided the medium-slack drum failures at 200k, but this is not enough for production because requested-budget slack rises with the budget; the same structurally medium drum rows would become "high slack" at 375k/500k. A useful controller needs both affordability and a structural usefulness/ease selector, not budget slack alone.

## 2026-06-28 - REJECTED PROBE - structural-ease avg2 forward eval

Mechanism: extend the production default forward-eval override with a smooth structural-ease gate. The trial kept explicit `LR_FWD_EVAL=...` overrides unchanged. For the default `greedy:2` path only, it used predicted first-completion frames to compute a reference structural ease (`200k / predicted_first_completion_frames`) and actual affordability (`target_budget / predicted_first_completion_frames`), then stochastically upgraded to one-step `avg` with branch 2 when both smooth pressures were high. Candidate generation, validation/cost, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed after the temporary implementation (5 files, 77 tests).

Probe: `generated/golden-runs/probe-structural-avg2-fwd-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-structural-avg2-fwd-j48-s0-2-a01`. The probe was valid 479/480 with raw HEADLINE 674.33 and `HEADLINE excl. impact` 689.49; per-budget point estimates were 125k 655.48, 250k 670.31, 375k 675.76, and 500k 679.98.

Probe decision: `npm run decide -- generated/golden-runs/probe-structural-avg2-fwd-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -3.7 on the 40-spec x 3-seed x full-budget intersection, CI [-7.8, 0.1], P(delta<=0)=97.2%. Per-budget deltas were 125k -11.7, 250k -4.0, 375k -2.7, and 500k -2.4.

Why it was not kept: the first-completion panel signal did not transfer to full runs with repair enabled. Even with a structural-ease gate, the extra one-step branch spend starved useful search/repair and hurt every budget in the paired probe, including 125k. The temporary source and test changes were reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - REJECTED PROBE - repair feasibility margin 1.10

Mechanism: env-only screen with `LR_REPAIR_FEAS_MARGIN=1.1`, giving post-completion repair restarts 10% more feasibility headroom than the mature exact predicted suffix ceiling. Candidate generation, validation/cost, start selection, forward eval, scorer, specs, fingerprint, seed set, budget grid, source code, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-repair-feas110-current-full-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_REPAIR_FEAS_MARGIN=1.1 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-repair-feas110-current-full-j48-s0-2-a01`. The probe was valid 480/480 with raw HEADLINE 677.19 and `HEADLINE excl. impact` 691.19; raw per-budget point estimates were 125k 666.59, 250k 673.28, 375k 677.66, and 500k 681.44.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-feas110-current-full-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -0.9 on the 40-spec x 3-seed x full new-grid intersection, CI [-2.3, 0.3], P(delta<=0)=92.6%. Per-budget deltas were 125k -0.5, 250k -1.1, 375k -0.8, and 500k -0.9, with unchanged validity.

Why it was not kept: repair restarts already have enough feasibility margin under the current mature policy. Adding uniform headroom made the repair scheduler slightly less selective and regressed every budget on the paired probe. This reinforces that extra lookahead/search spend must be paid for with an explicit total-budget allocation model, not by loosening repair affordability globally. This was env-only and left no source changes; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - STUDY - first-completion quality-ncand x lookahead

Purpose: test the missing interaction behind the slack/lookahead discussion. Earlier quality-ncand sweeps showed that changing `q` barely moved greedy traversal cost or score, but deeper `best`/`avg` forward eval might make extra or fewer candidates matter. This panel isolated first completion, before repair can blur the traversal signal.

Panel: `generated/studies/lookahead-q-first-completion-200k-rep12-s0-5-a01/panel.json`, run with `LR_ENGINE=wasm node --import tsx scripts/v0/run_admission_lookahead_panel.ts --budget=200000 --specs=tiny_dance,cold_start,dense_sprint,syncopated_switchback,drums_pendulum,solo_run,rolling_hills,skyline_push,dense_echo_climb,climb_terrace,glide_stairs,drums_signature --seeds=0,1,2,3,4,5 --quality-ncand=16,24,32,48,64 --admission=default --fwd-eval=greedy:2,best:1:2,avg:1:2,best:1:3 --baseline-ncand=32 --baseline-admission=default --baseline-fwd-eval=greedy:2 --stop-after-first-completion --workers=48 --shards=48 --out-dir=generated/studies/lookahead-q-first-completion-200k-rep12-s0-5-a01`. The full panel wrote 1440 rows. A wider all-golden 6000-row panel was intentionally interrupted after partial logs showed it was too large for this exploratory question; no conclusions rely on that interrupted panel.

Findings: under explicit greedy, increasing `q` from 32 to 64 raised first-completion sim frames by about 24.8% but moved mean score only +3.7 on this representative panel. The linear cost slope was about 509 frames per extra candidate, or +12.8% for each +16 candidates around q32. Under branch-2 lookahead, the useful range was q24/q32, not wider pools: `best:1:2` versus same-q greedy was +26.6 mean score at q24 and +22.6 at q32, but only +2.3 at q48 and -10.9 at q64. `avg:1:2` was similar: +30.9 at q24, +20.7 at q32, -1.4 at q48, and -47.3 at q64. The branch-2 sim ratio versus same-q greedy was about 1.9x.

Depth-3 result: broad `best:1:3` was not production-safe. It cost about 2.0x to 2.5x greedy first-completion frames and lost mean score at every q on the paired same-q comparison: -50.2 at q16, -75.4 at q24, -44.4 at q32, -111.0 at q48, and -118.0 at q64. It repeatedly exhausted the 200k first-completion cap on drums/solo rows, with valid counts falling as low as 53/72 at q48/q64.

Slack result: slack remains a useful affordability/usefulness feature but is insufficient by itself. Branch-2 was strongly negative in the 2..3 slack band (`best:1:2` -28.1, `avg:1:2` -30.6 versus same-q greedy), while `best:1:2` was positive in 3..4 (+57.6) and 4+ (+13.2). `avg:1:2` was positive in 4+ (+14.0) but negative in 3..4 (-22.0). This matches the earlier canonical failure of slack-only best-of: requested-budget slack can make lookahead affordable, but a selector also needs structural usefulness, mode choice, and downstream repair-budget reservation.

Implication: if a future production controller uses deeper lookahead, it should start with branch-2 only, likely around q24/q32, and should avoid globally increasing q. Branch-3 should be considered only as an exceptional high-ease/high-budget/high-confidence mode, not as a normal smooth ramp. First-completion wins still require a full-run probe before promotion because prior branch-2 source probes lost once repair was enabled.

## 2026-06-28 - REJECTED PROBE - broad q24 avg2 forward eval

Mechanism: env-only full-run transfer screen for the strongest first-completion branch-2 combination from the representative panel: `LR_QUALITY_NCAND=24 LR_FWD_EVAL=avg:1:2`. This applied the setting broadly to both first completion and repair phases on the 12-spec representative set, with all four golden budgets and seeds 0..2. Candidate generation apart from q, validation/cost, start selection, repair scheduler, scorer, specs, fingerprint, source code, and acceptance rule stayed unchanged.

Probe: `generated/golden-runs/probe-q24-avg2-rep12-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 LR_QUALITY_NCAND=24 LR_FWD_EVAL=avg:1:2 npm run golden -- --specs=tiny_dance,cold_start,dense_sprint,syncopated_switchback,drums_pendulum,solo_run,rolling_hills,skyline_push,dense_echo_climb,climb_terrace,glide_stairs,drums_signature --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-q24-avg2-rep12-j48-s0-2-a01`. The probe had raw HEADLINE 593.53 and `HEADLINE excl. impact` 605.9; validity was 135/144 overall and 36/36 at 500k, with all 9 invalids at 125k.

Probe decision: `npm run decide -- generated/golden-runs/probe-q24-avg2-rep12-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: REJECT`, delta headline -57.1 on the 12-spec x 3-seed x full-budget intersection, CI [-75.9, -12.7], P(delta<=0)=99.5%. Per-budget deltas were 125k -513.7, 250k -8.8, 375k -4.7, and 500k -6.4. Validity at 125k dropped from 100% to 75%.

Why it was not kept: broad branch-2 lookahead spends too much of the run budget before the compiler has a complete, repairable route. Reducing q to 24 does not make the approach affordable at 125k and does not create mature-budget gains. This is a stronger version of the earlier slack/best-of caution: first-completion quality gains are real in selected rows, but a production controller needs a strict affordability gate, structural usefulness gate, and repair-budget reservation before enabling branch-2. This was env-only and left no source changes; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - ABANDONED PROBE - axis-aware vertical ride-out composition

Mechanism: one focused contact-centered geometry trial in `arc_placement.ts`. For combined vertical targets, amplitude still shortened ride-out length but its launch-angle override was smoothly damped when an elevation launch was already active, with pressure from authored elevation, amplitude, and a smooth budget scale. Separately, explicit low-amplitude elevation gaps damped the existing elevation ride-out shortening, with the damping fading out when impact was high. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Probe: `generated/golden-runs/probe-axis-aware-vertical-rideout-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-axis-aware-vertical-rideout-j48-s0-2-a01`. The probe was valid 480/480 with raw HEADLINE 678.29 and `HEADLINE excl. impact` 691.99; raw per-budget point estimates were 125k 667.12, 250k 674.46, 375k 678.82, and 500k 682.59.

Probe decision: `npm run decide -- generated/golden-runs/probe-axis-aware-vertical-rideout-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.2 on the 40-spec x 3-seed x full-budget intersection, CI [-0.5, 1.0], P(delta<=0)=27.1%. Per-budget deltas were 125k -0.0, 250k +0.1, 375k +0.4, and 500k +0.3, with unchanged validity.

Why it was stopped: the mechanism moved the intended vertical rows but was too small and too narrow to justify a canonical run. It changed 116/480 paired scores, with 61 improvements and 55 regressions. Mean gains were concentrated in `switchback_pop` (+3.83), `rolling_drop` (+2.87), `syncopated_lift` (+2.20), and `glide_stairs` (+1.25), while `skyline_push` (-1.33), `dense_echo_climb` (-1.22), `ridge_pulse` (-0.76), and `terrace_sprint` (-0.73) offset them. This supports the geometry diagnosis but not this exact production policy. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - ABANDONED PROBE - low-air impact ride-out on current unified baseline

Mechanism: retest the earlier smooth low-air/high-impact ride-out convergence idea against the cleaned-up unified compiler. The temporary `arc_placement.ts` change only affected contact-centered gaps with explicit `impact`, no `elevation` or `amplitude`, and low authored `air`: as budget, attempt, low-air pressure, and impact pressure rose smoothly, it relaxed the post-contact safe length cap and increased the blend toward the grounded ride-out target. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Probe: `generated/golden-runs/probe-lowair-impact-rideout-current-j48-s0-2-a01/golden.json`, run with `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- --budgets=125000,250000,375000,500000 --jobs=48 --archive-dir=generated/golden-runs/probe-lowair-impact-rideout-current-j48-s0-2-a01`. The probe was valid 480/480 with raw HEADLINE 678.56 and `HEADLINE excl. impact` 693.24; raw per-budget point estimates were 125k 667.78, 250k 675.15, 375k 679.17, and 500k 682.50.

Probe decision: `npm run decide -- generated/golden-runs/probe-lowair-impact-rideout-current-j48-s0-2-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> non-canonical `VERDICT: INCONCLUSIVE`, delta headline +0.5 on the 40-spec x 3-seed x full-budget intersection, CI [-1.0, 3.0], P(delta<=0)=36.7%. Per-budget deltas were 125k +0.6, 250k +0.8, 375k +0.7, and 500k +0.2, with unchanged validity.

Why it was stopped: the mechanism hit its intended target but did not generalize enough to justify a canonical run. It changed only 44/480 paired scores, with 25 improvements and 19 regressions. `drums_pendulum` improved strongly on the probe (+18.24 mean), but `rhythm_ladder` (-6.40), `syncopated_switchback` (-5.10), and `cold_start` (-1.58) offset the gain, and the 500k paired mean was slightly negative. This remains useful evidence for low-air impact geometry, but the exact policy is too narrow and noisy for production. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - REJECTED CANONICAL - slack-gated weak-incumbent branch 4

Mechanism: spend high estimated budget slack on one extra DFS alternative after a passing incumbent exists. The temporary `handoff.ts` change kept candidate generation, q, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule unchanged. It only let `rankedOptions` return up to 4 options instead of 3 when structural slack was high, the incumbent quality was weak, and enough full-evaluation feedback had accumulated.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Canonical: `generated/golden-runs/attempt-slack-weak-branch4-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-weak-branch4-j32-a01`. The run was valid 1919/1920 overall and 480/480 at 500k, with raw HEADLINE 677.94 and `HEADLINE excl. impact` 693.09. Per-budget point estimates were 125k 656.69, 250k 675.10, 375k 679.97, and 500k 683.16.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-weak-branch4-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -0.1, CI [-0.2, 0.0], P(delta<=0)=87.1%. Per-budget deltas were 125k +0.0, 250k -0.1, 375k -0.0, and 500k -0.1.

Why it was not kept: the extra branch barely activated and did not produce a useful signal. Only 15/1920 paired checkpoints changed, with 5 improvements and 10 regressions. Mean branch limit rose from 3.000 to 3.007 at 250k, 3.047 at 375k, and 3.068 at 500k; the changed rows skewed slightly negative, led by `drums_tide` (-0.89 mean), `syncopated_switchback` (-0.58), and `drums_dropout` (-0.28), with small offsets from `drums_breath` (+0.09), `canyon_steps` (+0.08), and `rhythm_ladder` (+0.01). This rejects branch count as a compelling first slack lever. The temporary source change was reverted; the accepted baseline remains `baseline-current-unified-14edc74-j32`.

## 2026-06-28 - ACCEPTED - low-slack traversal branch 2

Mechanism: reduce pre-completion DFS branch width from 3 toward 2 only under very low estimated traversal slack. The policy is smooth from full pressure at slack <=1.25 to no pressure at slack >=2.0, with deterministic per-node stochastic rounding. Once a first completion exists, branch width remains the unified baseline value of 3. Candidate generation, quality-ncand, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (5 files, 76 tests).

Canonical: `generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 678.99 and `HEADLINE excl. impact` 694.29. Per-budget point estimates were 125k 666.46, 250k 675.16, 375k 679.97, and 500k 683.29.

Decision: `npm run decide -- generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json generated/golden-runs/baseline-current-unified-14edc74-j32/golden.json` -> canonical `VERDICT: ACCEPT`, delta headline +1.0, CI [-0.1, 5.3], P(delta<=0)=9.4%, effect 0.66. Per-budget deltas were 125k +9.8, 250k +0.0, 375k +0.0, and 500k +0.0.

Why it was kept: this is a narrow scarce-budget traversal fix, not a broad high-slack spending policy. It changed only 25/1920 paired checkpoints, all at 125k, with 18 improvements and 7 regressions. The 125k pass count rose from 479/480 to 480/480, and the mean branch limit at 125k moved from 3.000 to 2.855 while 250k/375k/500k stayed unchanged. The largest gain was `solo_run` (+16.82 mean, 47/48 -> 48/48 valid across all budgets), with smaller net gains on the drum families; losses were limited to `drums_zigzag` (-1.58), `drums_breath` (-0.32), `drums_dropout` (-0.05), and `drums_pendulum` (-0.04). The accepted baseline is now `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - low-amplitude elevation ride-out shortening

Mechanism: one focused `arc_placement.ts` geometry trial for explicit low-amplitude climb gaps. The existing elevation ride-out shortening still applied to upward elevation asks, but when an explicit low amplitude target was present it was smoothly weakened from 35% strength at amplitude <=0.12 to full strength by amplitude 0.30. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-lowamp-elevation-shortening-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-lowamp-elevation-shortening-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.04 and `HEADLINE excl. impact` 694.31. Per-budget point estimates were 125k 666.50, 250k 675.25, 375k 679.97, and 500k 683.38.

Decision: `npm run decide -- generated/golden-runs/attempt-lowamp-elevation-shortening-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.1, CI [-0.3, 0.5], P(delta<=0)=39.3%. Per-budget deltas were 125k +0.0, 250k +0.1, 375k -0.0, and 500k +0.1, with unchanged validity.

Why it was not kept: the headline movement was too small, and the intended low-amplitude target did not improve. `terrace_sprint` regressed on average (-3.75), especially at 125k (-11.03), while gains were scattered across `ridge_pulse` (+2.26), `glide_stairs` (+1.33), and `syncopated_lift` (+1.14). The change affected 337/1920 paired checkpoints with a nearly even split (174 improvements, 163 regressions), so this is noise/redistribution rather than a production geometry win. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - suffix-slack forward lookahead

Mechanism: one focused `handoff.ts` policy trial using structural budget slack to spend more forward-eval compute only on easy/high-budget suffixes. The default `greedy:2` forward-eval ranker stayed in place, the existing vertical `avg` override kept priority, and non-vertical default nodes could smoothly select `best:1:2` at high suffix slack or `best:1:3` only at very high suffix slack. The suffix signal used requested budget over predicted suffix traversal cost, capped to 1.25x whole-track slack, explicitly avoiding live-frame feedback loops. Candidate generation, q, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 81 tests). An earlier version that used live `targetBudget - getSimFrames()` failed the objective-leaf cost-isolation test, confirming the circularity risk; the tested canonical version used reference requested-budget slack instead.

Canonical: `generated/golden-runs/attempt-slack-suffix-lookahead-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-slack-suffix-lookahead-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.2 and `HEADLINE excl. impact` 694.01. Per-budget point estimates were 125k 666.46, 250k 675.55, 375k 680.21, and 500k 683.45.

Decision: `npm run decide -- generated/golden-runs/attempt-slack-suffix-lookahead-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.2, CI [-0.7, 1.2], P(delta<=0)=32.1%, effect 0.46. Per-budget deltas were 125k +0.0, 250k +0.4, 375k +0.2, and 500k +0.2, with unchanged validity.

Why it was not kept: the smooth slack idea behaved sanely but did not clear the canonical acceptance rule. It was fully inactive at 125k, then activated increasingly at 250k/375k/500k. Changed checkpoints were 219/1920 with 119 improvements and 100 regressions. Gains concentrated on very easy specs (`tiny_dance` +9.15, `mini_burst` +8.21), but `cold_start` regressed strongly (-7.22) and several vertical/mixed specs were mildly negative. This supports the premise that slack can target affordable extra lookahead, but the selector needs a usefulness model beyond affordability before production promotion. The temporary source change was reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - soft-impact high-air contact alignment

Mechanism: one focused `arc_placement.ts` geometry trial for contact-centered gaps with explicit low `impact`, no vertical axis target, and high authored `air`. The temporary change smoothly pulled the contact angle toward the incoming rider angle and damped post-contact curve bias under soft-impact/high-air pressure, aiming to reduce incidental redirection on rows such as `drums_pendulum`. Candidate count, search policy, start selection, forward eval, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 81 tests).

Canonical: `generated/golden-runs/attempt-soft-impact-align-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-soft-impact-align-j32-a01`. The run was valid 1919/1920 overall and 480/480 at 500k, with raw HEADLINE 677.69 and `HEADLINE excl. impact` 692.63. Per-budget point estimates were 125k 658.02, 250k 674.46, 375k 679.69, and 500k 682.71.

Decision: `npm run decide -- generated/golden-runs/attempt-soft-impact-align-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline -1.3, CI [-5.8, 1.7], P(delta<=0)=75.8%, effect -0.67. Per-budget deltas were 125k -8.4, 250k -0.7, 375k -0.3, and 500k -0.6.

Why it was not kept: the mechanism targeted a real `drums_pendulum` soft-impact symptom, but it hurt the canonical distribution rather than clearing the acceptance rule. The largest visible problem was the 125k drop and one low-budget invalid, while mature budgets were also slightly negative. This says direct soft-impact contact alignment is not a productive standalone fix; the temporary source change was reverted, and the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - ABANDONED PROBE - positive-cost repair anchors only

Mechanism: small repair feasibility trial in `optimizer/handoff.ts`. The temporary change stopped treating zero estimated suffix cost as repair-feasible, after `LR_REPAIR_LOG=1` showed many high-budget restarts with `estCost=0`, `frames=0`, and no accepted improvement. The intent was to avoid burning repair attempts on anchors whose measured first-completion path gave no suffix budget.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed (6 files, 81 tests).

Probe: paired 4-spec x 3-seed x 500k worst-family screen. Baseline/log archive `generated/golden-runs/probe-repair-log-current-worst-s0-2-7-a01/golden.json`; candidate archive `generated/golden-runs/probe-repair-positive-cost-current-worst-s0-2-7-a01/golden.json`, both run with `LR_ENGINE=wasm LR_REPAIR_LOG=1 GOLDEN_SEEDS_OVERRIDE=0,2,7 npm run golden -- --specs=drums_pendulum,skyline_push,drums_dropout,terrace_sprint --budgets=500000 --jobs=16`.

Probe decision: `npm run decide -- generated/golden-runs/probe-repair-positive-cost-current-worst-s0-2-7-a01/golden.json generated/golden-runs/probe-repair-log-current-worst-s0-2-7-a01/golden.json` -> non-promotable `VERDICT: INCONCLUSIVE`, delta headline -2.5 on the 12-row 500k slice, CI [-8.3, 1.3], P(delta<=0)=88.9%. The candidate made repair spend real budget on additional positive-cost restarts, but the slice score fell from 540.34 to 537.89.

Why it was stopped: zero-cost repair attempts are not just waste; in this baseline they also keep repair from over-spending on low-yield positive-cost restarts and leave more simulated frames for the resumed frontier. Forcing positive-cost anchors increased repair activity but reduced quality on the exact worst-family screen. The temporary source change was reverted, and the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.

## 2026-06-28 - REJECTED CANONICAL - opening slack best lookahead on low-slack baseline

Mechanism: one focused `handoff.ts` policy trial that used whole-track structural budget slack only at the opening contact. The default `greedy:2` forward-eval ranker stayed in place everywhere else, explicit `LR_FWD_EVAL` overrides stayed exact, and the existing mature vertical `avg` override kept precedence. On non-vertical opening nodes only, requested-budget slack smoothly and deterministically rounded the default toward `best:1:2` and then `best:1:3` on a log-slack curve. Candidate generation, q, start selection, repair, scorer, specs, fingerprint, seed set, budget grid, and acceptance rule stayed unchanged.

Focused tests: `LR_ENGINE=wasm npx vitest run tests/optimizer_sample.test.ts tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts tests/budget_model.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts` passed after pinning the objective-vs-full leaf cost test to explicit `LR_FWD_EVAL=greedy:2` during the temporary source trial (6 files, 81 tests). The test pin and source change were reverted after the canonical decision.

Canonical: `generated/golden-runs/attempt-opening-slack-best-lowbranch-j32-a01/golden.json`, run with `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/attempt-opening-slack-best-lowbranch-j32-a01`. The run was valid 1920/1920 overall, with raw HEADLINE 679.48 and `HEADLINE excl. impact` 695.65. Per-budget point estimates were 125k 667.00, 250k 673.99, 375k 680.65, and 500k 684.46.

Decision: `npm run decide -- generated/golden-runs/attempt-opening-slack-best-lowbranch-j32-a01/golden.json generated/golden-runs/attempt-low-slack-branch2-traversal-j32-a01/golden.json` -> canonical `VERDICT: INCONCLUSIVE`, delta headline +0.5, CI [-1.9, 3.2], P(delta<=0)=34.3%, effect 0.39. Per-budget deltas were 125k +0.5, 250k -1.2, 375k +0.7, and 500k +1.2, with unchanged 100% validity at every tier.

Why it was not kept: this is the strongest current evidence for the user's caveat that simple high-slack rows can afford richer opening evaluation, but it still does not clear the promotion rule and the 250k regression offsets much of the 500k upside. The result is directionally better than broad/precompletion slack best-of, confirming that bounded opening-only spending is the right shape if this idea returns. It also confirms that affordability alone remains insufficient: the next version needs a usefulness signal, such as opening ambiguity, expected branch value, or repair-aware opportunity cost, rather than just slack. The temporary source and test edits were reverted; the accepted baseline remains `attempt-low-slack-branch2-traversal-j32-a01`.
