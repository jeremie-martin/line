# Compiler Improvement Log

Active goal: raise canonical `compileHandoff` HEADLINE to at least 670 without changing the scorer, golden specs, evaluator fingerprint, metric, seed set, budget grid, or acceptance rule.

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
