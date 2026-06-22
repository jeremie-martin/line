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
