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
