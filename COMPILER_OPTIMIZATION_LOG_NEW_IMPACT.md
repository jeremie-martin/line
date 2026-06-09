# Compiler Optimization Log - Impact Steering

Objective: raise canonical HEADLINE above 700 after per-beat `Contact.impact`
was promoted to a scored target. Keep/promote changes only when the canonical
comparison prints `VERDICT: ACCEPT`.

Canonical commands:

```
LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/<attempt-label>
npm run decide -- generated/golden-runs/<attempt-label>/golden.json generated/golden-runs/<baseline-label>/golden.json
```

Rules: do not edit scorer, golden specs, evaluator fingerprint, seed set,
metric, or budget grid to make scores look better. Impact is a per-beat
qualifier authored on `Contact` (`{ t, impact? }`), not a curve-authored axis;
compiler changes should steer or select existing/generated catches toward the
same normalized normal-impact scale the scorer reports.

## baseline-impact-current

- Baseline used: current HEAD `2b5ffdf` (`ZAddress code-review: dedup impact math, fix stale v1 docs, add determinism test`), equivalent score shape to `baseline-impact-v2` after re-baseline; dirty worktree only from unrelated untracked scratch files before this attempt.
- Baseline archive available: `generated/golden-runs-old3/cand-refactor/golden.json`.
- Baseline result: canonical HEADLINE `472.15`, budgets `50k,100k,200k,300k`; validity `95.21%`, `99.79%`, `99.79%`, `100%`.
- Diagnostics: impact dominates the new miss. From `cand-refactor` reports, impact MAE `0.2550`, signed error `-0.2371`, RMSE `0.3290`; achieved impact averages `0.2916` against target `0.5288`. High target bands are heavily under-hit: `.65-.85` MAE `0.3825`; `.85-1.0` MAE `0.4810`. Other axes are materially smaller (`air` MAE `0.0921`, `speed` `0.1249`, `elevation` `0.1173`, `amplitude` `0.1215`).

## impact-local-cost-w05-01

- Baseline used: `baseline-impact-current` / `generated/golden-runs-old3/cand-refactor/golden.json` at current HEAD `2b5ffdf`.
- Hypothesis: `measureGapAxes` and the scorer now include per-beat impact, but local candidate cost still sorted only curve-authored `TARGET_AXES`, so impact-targeted candidates were invisible to the cheap candidate prefix and to low-budget ranking. Include measured impact in local candidate SSE, but at half weight so mid-budget ranking does not over-prioritize impact over air/speed/elevation/amplitude.
- Code changes made: in `scripts/v0/core/candidate.ts`, changed `axisCost` to iterate all measured `AXES`; added `LOCAL_IMPACT_COST_WEIGHT = 0.5` for the impact term. This does not change target sampling, RNG draws, scorer, specs, or evaluator fingerprint.
- Import smoke: `npx tsx -e "import('./scripts/v0/core/candidate.ts').then(() => console.log('candidate import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-local-cost-w05-slice-01`
- Probe decide result: indicative `VERDICT: ACCEPT`; paired 10-spec slice headline `368.8 -> 383.7`, `Delta=+14.9`, 95% CI `[-2.2, 48.0]`, `P(Delta<=0)=5.1%`. Per-budget deltas: `50k +71.1`, `100k +1.3`, `200k +22.0`, `300k +5.3`.
- Notable probe read: full impact weight had a slightly lower focused headline (`382.2`) and a `100k -16.3` point-estimate regression, while the 0.5 weight kept all budget point estimates non-negative.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-local-cost-w05-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `472.1 -> 481.1`, `Delta=+9.0`, 95% CI `[1.0, 22.9]`, `P(Delta<=0)=1.4%`. Per-budget deltas: `50k +60.6`, `100k -4.0`, `200k +9.2`, `300k +4.6`. Validity moved `95% -> 96%` at `50k` and stayed `100%` for `100k+`.
- Notable improvements: weighted spec means improved most on `drums_pendulum +27.21`, `tiny_dance +26.31`, `drums_tide +25.14`, `verse_chorus +20.52`, `climb_terrace +20.09`, `drums_zigzag +15.41`, `syncopated_switchback +14.48`, `mini_burst +13.99`, `skyline_push +13.43`, and `cold_start +13.06`. Largest `300k` row wins: `dense_echo_climb` seed `11` `+119.11`, `tiny_dance` seed `11` `+112.14`, `leap_cadence` seed `2` `+83.56`, `tiny_dance` seed `0` `+66.08`, and `verse_chorus` seed `9` `+64.26`.
- Notable regressions: weighted spec losses concentrated in `mixed_grade -24.24`, `swoop_dive -23.56`, `rolling_drop -1.95`, and `rolling_hills -1.11`. Largest `300k` row losses: `swoop_dive` seed `6` `-117.81`, `mixed_grade` seed `1` `-80.42`, `mixed_grade` seed `5` `-78.55`, `mixed_grade` seed `0` `-69.72`, and `rhythm_ladder` seed `8` `-61.71`.
- Axis diagnostics: impact MAE improved at every budget: `50k 0.3724 -> 0.2886`, `100k 0.2214 -> 0.2113`, `200k 0.2161 -> 0.2050`, `300k 0.2141 -> 0.2026`; signed impact error improved from `-0.1961 -> -0.1868` at `300k`. The tradeoff was slightly worse air/speed local fit (`300k` air MAE `0.0910 -> 0.0917`, speed `0.1330 -> 0.1393`), but elevation/amplitude nudged better and the canonical decision accepted the net.
- Status: kept; canonical accepted. Commit and use `impact-local-cost-w05-01` as the next baseline.

## impact-angle-steer-slice-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: residual impact errors are still dominated by high-target under-hit. Add a deterministic per-attempt contact-angle span for impact-authored beats, steering some catch tangents toward the angle that would kill the requested normal velocity, capped by `IMPACT.CATCHABLE_NORMAL_FRACTION`.
- Code changes made: temporarily changed `sampleContactCenteredLines(...)` in `scripts/v0/arc_placement.ts` so high-impact targets blended contact angle toward `targetState.angleDeg - asin(targetImpact * CALIB.IMPACT_CAP / speed)`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-angle-steer-slice-01`
- Decide result: indicative `VERDICT: REJECT`; focused headline `383.7 -> 262.6`, `Delta=-121.0`, 95% CI `[-240.8, 19.5]`, `P(Delta<=0)=92.3%`. Per-budget deltas: `50k -45.7`, `100k -113.5`, `200k -135.4`, `300k -126.5`. Validity regressed on the slice (`300k 100% -> 94%`).
- Notable regressions: `drums_pendulum` had multiple invalid high-budget rows; dense drum/support rows such as `drums_signature` and `drums_dropout` collapsed. The catch-angle shift creates hard surfaces but breaks catchability and continuation before the scorer can benefit.
- Status: reverted after focused reject; no canonical run and no commit.

## impact-mature-avg-gate-slice-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: the mature forward ranker only switches from default `greedy:2` to the existing cheaper one-step `avg` variant for amplitude/elevation targets. Since impact is now scored and reported per gap, impact-authored gaps might benefit from the same robust true-score ranker without changing geometry.
- Code changes made: temporarily changed `matureForwardEvalConfig(...)` in `scripts/v0/optimizer/handoff.ts` to activate on targets with `impact !== undefined`, while leaving first-contact ballistic start gating unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-mature-avg-gate-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; focused headline `383.7 -> 384.0`, `Delta=+0.3`, 95% CI `[-12.3, 13.2]`, `P(Delta<=0)=47.5%`. Per-budget deltas: `50k +0.0`, `100k -2.0`, `200k +1.7`, `300k +0.2`. Validity was unchanged on the focused slice.
- Diagnostics: the gate is effectively neutral; it slightly trades `100k` score for tiny high-budget gains. The effect is far too small to justify a canonical run.
- Status: reverted after focused inconclusive; no canonical run and no behavior commit.

## impact-local-cost-asym075-slice-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: residual impact error is overwhelmingly under-hit (`300k` impact signed error `-0.1868`; under-hit contributes `0.1947` MAE vs `0.0079` from overshoot). Raising local impact cost only for under-hit from `0.5` to `0.75` might prioritize harder landings without over-penalizing soft-beat overshoot.
- Code changes made: temporarily changed `axisCost(...)` in `scripts/v0/core/candidate.ts` to use `LOCAL_IMPACT_UNDERHIT_COST_WEIGHT = 0.75` when `target > achieved`, while keeping overshoot at `0.5`.
- Import smoke: `npx tsx -e "import('./scripts/v0/core/candidate.ts').then(() => console.log('candidate import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-local-cost-asym075-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` with negative point estimate; focused headline `383.7 -> 382.9`, `Delta=-0.8`, 95% CI `[-7.2, 5.8]`, `P(Delta<=0)=65.1%`. Per-budget deltas: `50k +1.7`, `100k -0.8`, `200k -1.0`, `300k -1.2`; validity unchanged.
- Diagnostics: the extra under-hit pressure buys a small low-budget gain but consistently hurts high-budget rows, suggesting the accepted `0.5` local weight is near the useful ceiling for this candidate prefix.
- Status: reverted after focused negative signal; no canonical run and no commit.

## impact-repair-weight15-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: repair picks the weakest affordable gap using equal reported-axis SSE. Since impact is the newly dominant residual error and repair has many accepted high-budget restarts (`300k` baseline: `5770` restarts, `1608` accepts), weighting impact higher when selecting repair anchors might spend suffix rebuilds on more valuable high-impact under-hits.
- Code changes made: temporarily added `REPAIR_IMPACT_WEAK_GAP_WEIGHT = 1.5` in `pickFeasibleWeakGap(...)`, multiplying only the repair weak-gap score for `impact` errors. This did not change candidate generation, local candidate cost, scorer, specs, or budget grid.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-repair-weight15-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; focused headline `383.7 -> 384.3`, `Delta=+0.6`, 95% CI `[-1.2, 2.2]`, `P(Delta<=0)=17.3%`. Per-budget deltas: `50k +0.0`, `100k +0.3`, `200k +0.5`, `300k +0.8`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-repair-weight15-01`
- Canonical decide result: `VERDICT: INCONCLUSIVE`; headline `481.1 -> 481.4`, `Delta=+0.3`, 95% CI `[-0.9, 1.5]`, `P(Delta<=0)=29.0%`. Per-budget deltas: `50k +0.0`, `100k -0.0`, `200k +0.2`, `300k +0.6`; validity unchanged.
- Diagnostics: strongest weighted spec gains were `rolling_drop +5.73`, `rolling_hills +5.01`, `mixed_grade +4.00`, `grain_staircase +3.59`, and `syncopated_lift +3.21`; losses were led by `skyline_push -6.86`, `climb_terrace -5.67`, `ridge_pulse -3.29`, `float_bounds -1.94`, and `pop_train -1.72`. Impact MAE moved `300k 0.2026 -> 0.2018`, but `100k/200k` were flat to slightly worse.
- Status: reverted after canonical inconclusive; no behavior commit.

## impact-repair-weight20-slice-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: if `1.5x` repair impact weighting was too weak, `2.0x` might make the focused high-budget repair signal clearer.
- Code changes made: temporarily changed `REPAIR_IMPACT_WEAK_GAP_WEIGHT` from `1.5` to `2.0`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-repair-weight20-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; focused headline `383.7 -> 384.0`, `Delta=+0.3`, 95% CI `[-1.5, 1.9]`, `P(Delta<=0)=29.9%`. Per-budget deltas: `50k +0.0`, `100k +0.3`, `200k +0.7`, `300k +0.1`.
- Diagnostics: `2.0x` over-focused repair relative to `1.5x`; the `300k` lift mostly disappeared, so it was not canonical-tested.
- Status: reverted after focused weaker signal; no canonical run and no commit.

## impact-axisq-normal-slice-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: accepted local impact cost can only choose among candidates present in the normal prefix. Add a small `axisq` impact stream during quality search only, using ordinary contact-centered `normal` geometry at a far attempt offset, and offer it only when the current pool still under-hits a high impact target.
- Code changes made: temporarily added a gated `cachedImpactQualityCandidates(...)` path in `rankedOptions(...)`: if `axisQualitySearch` was active, target impact was at least `0.65`, and the current candidate pool under-hit by more than `0.12`, it probabilistically sampled one extra normal candidate with smooth budget pressure and scored it as source `axisq` / axis `impact`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-axisq-normal-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` with negative point estimate; focused headline `383.7 -> 383.6`, `Delta=-0.1`, 95% CI `[-1.7, 1.2]`, `P(Delta<=0)=52.8%`. Per-budget deltas: `50k +0.0`, `100k +0.3`, `200k +0.4`, `300k -0.6`; validity unchanged.
- Diagnostics: the extra normal sample helped mid budgets slightly but stole enough mature search/repair work or introduced enough noisy choices to regress `300k`, so it is not a viable default.
- Status: reverted after focused negative signal; no canonical run and no commit.

## impact-axisq-hard-slice-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: the normal extra `axisq` stream did not create sufficiently different impact geometry. Add a stricter `impact_hard` sample mode as an extra quality-only candidate: contact-centered geometry with a small, capped contact-angle shift toward higher normal impact, gated to high targets whose current pool still under-hit.
- Code changes made: temporarily added `impact_hard` to `CANDIDATE_SAMPLE_MODES`, allowed it through the contact-centered sampler, applied at most a `12deg` extra tangent shift away from incoming velocity for high impact targets, and sampled one gated `axisq`/`impact` candidate from `rankedOptions(...)`.
- Import smoke: `npx tsx -e "Promise.all([import('./scripts/v0/arc_placement.ts'), import('./scripts/v0/optimizer/handoff.ts')]).then(() => console.log('impact hard imports ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-axisq-hard-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` with negative point estimate; focused headline `383.7 -> 383.5`, `Delta=-0.2`, 95% CI `[-1.9, 1.0]`, `P(Delta<=0)=60.1%`. Per-budget deltas: `50k -0.0`, `100k -0.1`, `200k +0.0`, `300k -0.5`; validity unchanged.
- Diagnostics: even a small hard-impact geometry stream fails to pay for its search cost/noise and again regresses mature `300k` quality. The earlier large contact-angle steering failed validity; this smaller extra-only version preserves validity but still loses score.
- Status: reverted after focused negative signal; no canonical run and no commit.

## impact-angle-bias3-01

- Baseline used: `impact-local-cost-w05-01` at commit `c081ef2`.
- Hypothesis: the rejected exact impact-angle steering was too large and changed catchability, but residual impact is still under-hit. Apply a much smaller high-impact bias inside the existing contact-centered normal candidate span: shift the contact tangent by at most `3deg` away from the incoming velocity, scaled by target impact pressure and the existing per-attempt launch span. This changes no RNG draws and adds no candidate samples.
- Code changes made: in `scripts/v0/arc_placement.ts`, added `CONTACT_CENTERED_IMPACT_ANGLE_SHIFT_DEG = 3`, changed the local `contactAngleDeg` to `let`, and after the usual contact-centered angle formula subtracted `3 * smoothstep((impact - 0.55) / 0.35) * ccSpanBlends(attempt).launch`, clamped to `[-14, 65]`. In `scripts/v0/types.ts`, refreshed stale comments now that impact is partially steered.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-angle-bias3-slice-01`
- Probe decide result: indicative `VERDICT: ACCEPT`; focused headline `383.7 -> 392.4`, `Delta=+8.7`, 95% CI `[-2.5, 21.2]`, `P(Delta<=0)=5.8%`. Per-budget deltas: `50k +63.2`, `100k +1.1`, `200k +4.8`, `300k +4.7`. Focused validity improved `50k 95% -> 98%` and stayed `100%` at `200k/300k`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-angle-bias3-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `481.1 -> 486.0`, `Delta=+4.9`, 95% CI `[0.0, 10.1]`, `P(Delta<=0)=2.4%`. Per-budget deltas: `50k +16.2`, `100k +2.4`, `200k +3.8`, `300k +4.6`. Validity moved `50k 96% -> 97%` and stayed `100%` for `100k+`.
- Notable improvements: weighted spec means improved most on `mini_burst +16.59`, `rhythm_ladder +15.67`, `swoop_dive +13.60`, `rolling_hills +11.69`, `drums_crescendo +11.33`, `tiny_dance +11.03`, `verse_chorus +10.72`, `opening_burst +9.49`, `syncopated_switchback +9.47`, and `rolling_drop +9.47`. Largest `300k` row wins: `pop_train` seed `8` `+92.61`, `ridge_pulse` seed `6` `+72.94`, `glide_stairs` seed `9` `+62.55`, `soar_settle` seed `1` `+57.52`, and `drums_zigzag` seed `1` `+56.01`.
- Notable regressions: weighted spec losses were `leap_cadence -8.56`, `drums_signature -4.24`, `climb_terrace -3.46`, `soar_settle -3.14`, `skyline_push -1.66`, `dense_echo_climb -1.40`, and `drums_tide -1.22`. Largest `300k` row losses: `leap_cadence` seed `2` `-87.29`, `drums_signature` seed `8` `-80.99`, `dense_sprint` seed `8` `-79.46`, `dense_sprint` seed `11` `-73.29`, and `opening_burst` seed `11` `-69.71`.
- Axis diagnostics: impact MAE improved at `50k` and high budgets (`50k 0.2886 -> 0.2837`, `200k 0.2050 -> 0.2043`, `300k 0.2026 -> 0.2013`) while `100k` ticked worse (`0.2113 -> 0.2133`). Speed improved materially (`300k 0.1393 -> 0.1330`) and elevation improved (`300k 0.1143 -> 0.1127`); air and amplitude moved slightly worse at high budget.
- Status: kept; canonical accepted. Use `impact-angle-bias3-01` as the next baseline.

## impact-angle-bias4-slice-01

- Baseline used: `impact-angle-bias3-01` at commit `f5b1bf8`.
- Hypothesis: the accepted `3deg` high-impact contact-centered angle bias might still be conservative; increasing the same no-extra-samples shift to `4deg` could improve impact under-hit without reintroducing the validity failures from exact angle steering.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_ANGLE_SHIFT_DEG` in `scripts/v0/arc_placement.ts` from `3` to `4`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-angle-bias4-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; focused headline `392.4 -> 392.8`, `Delta=+0.5`, 95% CI `[-12.8, 10.9]`, `P(Delta<=0)=39.1%`. Per-budget deltas: `50k +17.7`, `100k -13.3`, `200k +2.1`, `300k +1.1`.
- Diagnostics: the extra degree mainly lifted `50k` and slightly helped high budgets, but the `100k` regression is too large for promotion and the point estimate is effectively neutral.
- Status: reverted after focused inconclusive; no canonical run and no behavior commit.

## impact-angle-lowbudget-extra-slice-01

- Baseline used: `impact-angle-bias3-01` behavior at commit `5538bf4`.
- Hypothesis: since the global `4deg` probe helped `50k` but hurt `100k`, apply the extra degree only at scarce budget: `4deg` at `50k`, fading back to the accepted `3deg` by `100k`, with no extra samples or RNG changes.
- Code changes made: temporarily added a budget-aware `contactCenteredImpactAngleShiftDeg()` in `scripts/v0/arc_placement.ts`, using `CONTACT_CENTERED_IMPACT_LOW_BUDGET_EXTRA_SHIFT_DEG = 1` and a `50k..100k` fade.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_dropout,syncopated_switchback,drums_pendulum,dense_sprint,rhythm_ladder,dense_echo_climb,drums_signature,opening_burst,drums_pulse,drums_crosscut --archive-dir=generated/golden-runs/impact-angle-lowbudget-extra-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; focused headline `392.4 -> 393.7`, `Delta=+1.4`, 95% CI `[-3.3, 8.1]`, `P(Delta<=0)=26.2%`. Per-budget deltas: `50k +17.7`, `100k +0.0`, `200k +0.0`, `300k +0.0`. Validity moved `50k 98% -> 99%` and was unchanged elsewhere.
- Diagnostics: the mechanism isolated the intended `50k` gain and removed the `100k` failure, but the headline lift was too small/noisy to justify canonical promotion.
- Status: reverted after focused inconclusive; no canonical run and no behavior commit.

## impact-angle-sparse-extra-01

- Baseline used: `impact-angle-bias3-01` at commit `5538bf4`.
- Hypothesis: the rejected global `4deg` bias failed in dense cadence, but sparse/mixed gaps have room for a slightly harder high-impact catch. Keep the accepted `3deg` shift in dense gaps and add up to `1deg` only as the existing arc-length room pressure ramps from dense (`26f`) to sparse (`46f`). This changes no candidate count and no RNG draws.
- Code changes made: in `scripts/v0/arc_placement.ts`, added `CONTACT_CENTERED_IMPACT_SPARSE_EXTRA_SHIFT_DEG = 1`; changed the impact angle shift to call `contactCenteredImpactAngleShiftDeg(nextGapFrames)`, which returns `3deg + 1deg * room`. Dense gaps stay at `3deg`, last/sparse gaps can reach `4deg`. In `scripts/v0/types.ts`, updated the `Contact.impact` comment to mention the sparse-room angle bias.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --archive-dir=generated/golden-runs/impact-angle-sparse-extra-slice-01`
- Probe decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `541.5 -> 544.8`, `Delta=+3.3`, 95% CI `[0.7, 6.4]`, `P(Delta<=0)=0.7%`. Per-budget deltas: `50k -0.0`, `100k +3.1`, `200k +4.3`, `300k +3.3`. Validity was `100%` for the candidate at every budget.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-angle-sparse-extra-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `486.0 -> 487.8`, `Delta=+1.8`, 95% CI `[-0.2, 4.5]`, `P(Delta<=0)=4.1%`. Per-budget deltas: `50k +4.3`, `100k +1.4`, `200k +1.7`, `300k +1.6`. Validity stayed `97%` at `50k` and `100%` for `100k+`.
- Notable improvements: weighted spec means improved most on `big_air_ramp +10.67`, `soar_settle +10.60`, `tiny_dance +8.57`, `rolling_hills +8.09`, `pop_train +7.94`, `glide_stairs +7.58`, `swoop_dive +7.02`, `climb_terrace +5.76`, `leap_cadence +5.54`, and `mixed_grade +4.05`. Largest `300k` row wins: `pop_train` seed `5` `+73.52`, `mixed_grade` seed `5` `+68.07`, `soar_settle` seed `9` `+66.24`, `leap_cadence` seed `0` `+51.83`, and `climb_terrace` seed `2` `+50.57`.
- Notable regressions: weighted spec losses were led by `dense_echo_climb -3.09`, `drums_crescendo -2.77`, `drums_swell -2.63`, `syncopated_switchback -2.38`, `verse_chorus -1.38`, `rolling_drop -1.14`, `drums_pulse -1.05`, `drums_dropout -0.84`, `drums_tide -0.84`, and `dense_sprint -0.62`. Largest `300k` row losses: `pop_train` seed `8` `-50.13`, `climb_terrace` seed `6` `-49.70`, `rolling_drop` seed `4` `-46.59`, `soar_settle` seed `7` `-40.14`, and `rolling_drop` seed `8` `-39.67`.
- Axis diagnostics: impact MAE improved slightly at `50k` and `300k` (`50k 0.2834 -> 0.2832`, `300k 0.2013 -> 0.2010`) while `100k/200k` were essentially flat (`100k 0.2129 -> 0.2133`, `200k 0.2043 -> 0.2044`). Speed improved at mature budgets (`300k 0.1330 -> 0.1321`) and elevation improved slightly (`300k 0.1127 -> 0.1120`); air/amplitude ticked slightly worse.
- Status: kept; canonical accepted. Use `impact-angle-sparse-extra-01` as the next baseline.

## low-air-dense-safe-cap-slice-01

- Baseline used: `impact-angle-sparse-extra-01` at commit `5d01965`.
- Hypothesis: remaining dense failures, especially `drums_pendulum`, still overshoot low-air targets. Expand only the long end of the existing air-targeted ride-out span by raising the `safeCap` fraction from `0.55` toward `0.70`, gated to low-air dense gaps and fading in after `75k`, so short candidates remain available and mature forward-eval can reject crowded continuations.
- Code changes made: temporarily replaced `safeCap = speed * nextGapFrames * 0.55` in `scripts/v0/arc_placement.ts` with `lowAirDenseSafeCapFraction(air, nextGapFrames)`, using `LOW_AIR_DENSE_SAFE_CAP_EXTRA = 0.15`, dense room pressure, low-air pressure, and a `75k..150k` budget fade.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,solo_run,verse_chorus,drums_swell,drums_tide,drums_crescendo,cold_start --archive-dir=generated/golden-runs/low-air-dense-safe-cap-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` with a strongly negative point estimate; 16-spec intersection headline `411.9 -> 401.1`, `Delta=-10.8`, 95% CI `[-38.5, 3.6]`, `P(Delta<=0)=85.2%`. Per-budget deltas: `50k +0.0`, `100k -10.1`, `200k -26.7`, `300k -2.3`. Validity fell at `50k` (`97% -> 93%`) and `100k` (`100% -> 98%`).
- Diagnostics: even a gated, span-preserving cap expansion destabilized dense basins and mainly hurt the middle budgets. The low-air problem is not solved by simply allowing longer post-contact ride-outs under this sampler.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-angle-dense-mature-extra-slice-01

- Baseline used: `impact-angle-sparse-extra-01` at commit `f8bb3ee`.
- Hypothesis: the global `4deg` impact angle probe mainly failed at `100k`, while its high-budget dense deltas were slightly positive. Keep dense gaps at the accepted `3deg` through `100k`, but add the extra `1deg` only as a dense mature-budget pressure reaches full strength at `200k+`.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_DENSE_MATURE_EXTRA_SHIFT_DEG = 1` in `scripts/v0/arc_placement.ts`; `contactCenteredImpactAngleShiftDeg(...)` became `3deg + sparseRoomExtra + denseMatureExtra`, where `denseMatureExtra` used `(1 - room) * smoothstep((budget - 150k) / 50k)`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,solo_run,verse_chorus,drums_swell,drums_tide,drums_crescendo,cold_start --archive-dir=generated/golden-runs/impact-angle-dense-mature-extra-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; 16-spec intersection headline `411.9 -> 413.0`, `Delta=+1.2`, 95% CI `[-1.8, 4.4]`, `P(Delta<=0)=23.3%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.4`, `300k +1.0`.
- Diagnostics: the mature dense extra isolated the intended high-budget movement and avoided the large `100k` score regression, but the effect is too small/noisy for canonical promotion. Validity diagnostics also moved at `50k/100k` in the focused archive, so the mechanism is not clean enough to stack.
- Status: reverted after focused inconclusive; no canonical run and no behavior commit.

## impact-local-cost-target-scaled-slice-01

- Baseline used: `impact-angle-sparse-extra-01` at commit `aa50e9d`.
- Hypothesis: a flat local impact cost weight may spend too much local selection pressure on soft landings and too little on hard landings. Scale the local impact weight smoothly from `0.35` for soft targets to `0.65` for hard targets, preserving the same candidate pool and scorer.
- Code changes made: temporarily replaced `LOCAL_IMPACT_COST_WEIGHT = 0.5` in `scripts/v0/core/candidate.ts` with `LOCAL_IMPACT_COST_WEIGHT_SOFT = 0.35`, `LOCAL_IMPACT_COST_WEIGHT_HARD = 0.65`, and `localImpactCostWeight(target)`.
- Import smoke: `npx tsx -e "import('./scripts/v0/core/candidate.ts').then(() => console.log('candidate import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-local-cost-target-scaled-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `467.4 -> 467.4`, `Delta=-0.1`, 95% CI `[-5.8, 6.1]`, `P(Delta<=0)=48.4%`. Per-budget deltas: `50k -25.6`, `100k +11.2`, `200k +0.8`, `300k -0.1`.
- Diagnostics: the target-scaled cost exposed a real `100k` tradeoff, but the soft-end downweighting cost too much scarce-budget quality and did not improve high budgets.
- Status: reverted after focused neutral/negative signal; no canonical run and no behavior commit.

## impact-local-cost-hard065-slice-01

- Baseline used: `impact-angle-sparse-extra-01` at commit `aa50e9d`.
- Hypothesis: preserve the accepted `0.5` weight for soft impact targets and only raise hard targets to `0.65`, keeping the apparent `100k` benefit while avoiding the large `50k` loss from the `0.35..0.65` scaling probe.
- Code changes made: temporarily changed the soft endpoint of `localImpactCostWeight(target)` to `0.5` while leaving the hard endpoint at `0.65`.
- Import smoke: `npx tsx -e "import('./scripts/v0/core/candidate.ts').then(() => console.log('candidate import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-local-cost-hard065-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` with negative point estimate; 20-spec intersection headline `467.4 -> 467.3`, `Delta=-0.2`, 95% CI `[-4.7, 7.4]`, `P(Delta<=0)=67.4%`. Per-budget deltas: `50k -9.4`, `100k +10.5`, `200k -1.1`, `300k -1.5`.
- Diagnostics: keeping soft targets at `0.5` reduced the `50k` loss but converted high budgets negative. The accepted flat `0.5` local impact cost remains the better default.
- Status: reverted after focused neutral/negative signal; no canonical run and no behavior commit.

## impact-angle-spread-slice-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: the accepted high-impact angle bias still under-hits hard targets, but stronger uniform shifts destabilized dense cadence. Widen only the guided `contactAngleRoll` span for high-impact targets so the existing candidate sorter can choose harder catch orientations without adding samples or RNG draws.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_ANGLE_SPREAD_EXTRA = 0.16` and a `0.50..1.00` room-scaled spread multiplier in `scripts/v0/arc_placement.ts`; `guideContactCenteredRolls(...)` passed that spread into the existing `ccGuidedRoll(...)` call for `contactAngleRoll`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-spread-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` with negative point estimate; 20-spec intersection headline `467.4 -> 465.0`, `Delta=-2.4`, 95% CI `[-9.6, 3.8]`, `P(Delta<=0)=78.2%`. Per-budget deltas: `50k -35.5`, `100k +10.3`, `200k -1.3`, `300k -2.0`.
- Diagnostics: the spread exposed a real `100k` upside, but the same broader early guided geometry caused a large `50k` loss and small mature-budget regressions. This is not a promotable default.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-angle-spread-midbudget-slice-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: isolate the useful part of the full-spread probe by enabling the same high-impact guided angle spread only around the `100k` budget band: fade in from `75k..100k`, fade out from `150k..200k`, and keep `50k/200k/300k` byte-equivalent.
- Code changes made: temporarily added budget-pressure gating around the `0.16` spread extra while retaining the `0.50..1.00` room-scaled spread multiplier.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-spread-midbudget-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `467.4 -> 469.0`, `Delta=+1.6`, 95% CI `[-0.7, 9.0]`, `P(Delta<=0)=34.3%`. Per-budget deltas: `50k +0.0`, `100k +10.3`, `200k +0.0`, `300k +0.0`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: per-spec `100k` gains were concentrated in dense drum specs (`drums_pendulum +22.04`, `dense_sprint +14.37`, `drums_signature +9.47`), while sparse/mixed losses remained (`swoop_dive -10.77`, `big_air_ramp -6.52`, `rhythm_ladder -6.24`, `leap_cadence -6.12`). The headline lift is too small/noisy for a canonical run.
- Status: reverted after focused inconclusive; no canonical run and no behavior commit.

## impact-angle-spread-dense-midbudget-slice-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: because the midbudget spread's positive signal came from dense drum specs and its losses came from sparse/mixed specs, apply the `100k`-band spread only as next-contact room becomes dense (`1 - room`).
- Code changes made: temporarily replaced the `0.50..1.00` room multiplier with a dense-only multiplier, `1 - contactCenteredRoomPressure(nextGapFrames)`, while keeping the same `0.16` spread extra and `75k..200k` budget gate.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-spread-dense-midbudget-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` with negative point estimate; 20-spec intersection headline `467.4 -> 465.7`, `Delta=-1.7`, 95% CI `[-11.9, 4.8]`, `P(Delta<=0)=69.7%`. Per-budget deltas: `50k +0.0`, `100k -11.2`, `200k +0.0`, `300k +0.0`; `100k` validity moved `100% -> 99%`.
- Diagnostics: the dense-only multiplier removed the sparse exposure but doubled the effective spread in the fragile dense region, converting the prior `100k` upside into a loss. Dense impact misses are not fixed by simply widening contact-angle diversity.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-angle-lowair-span-floor-slice-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: low-air impact-authored gaps are the worst remaining impact bucket (`300k` low-air impact MAE `0.2823` vs mid-air `0.1867`). The accepted impact angle bias is tied to the launch span, so low-launch/low-air candidates receive little hard-catch angle shift. Add a small low-air floor to that span so ride-out candidates can still land harder without adding samples.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_LOW_AIR_SPAN_FLOOR = 0.35` and replaced the impact shift span with a low-air lerp toward `max(launchSpan, 0.35)`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-lowair-span-floor-slice-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `467.4 -> 468.0`, `Delta=+0.6`, 95% CI `[-4.7, 7.0]`, `P(Delta<=0)=35.9%`. Per-budget deltas: `50k -18.8`, `100k +12.2`, `200k +0.7`, `300k -0.2`.
- Diagnostics: the low-air floor created a clean `100k` improvement but made scarce-budget candidates too hard, causing a large `50k` loss. Tested a budget-gated derivative instead of promoting.
- Status: reverted after derivative testing; no canonical run and no behavior commit.

## impact-angle-lowair-budget-span-floor-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: keep the useful low-air span-floor effect only where it scored: fade in from `75k..100k`, fade out from `220k..300k`, leaving `50k` and mature `300k` effectively unchanged.
- Code changes made: temporarily kept `CONTACT_CENTERED_IMPACT_LOW_AIR_SPAN_FLOOR = 0.35` and added `contactCenteredImpactLowAirSpanBudgetPressure()` to multiply the low-air span floor.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-lowair-budget-span-floor-slice-01`
- Probe decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `467.4 -> 469.5`, `Delta=+2.1`, 95% CI `[-0.0, 9.1]`, `P(Delta<=0)=2.9%`. Per-budget deltas: `50k +0.0`, `100k +12.2`, `200k +0.7`, `300k +0.0`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-angle-lowair-budget-span-floor-01`
- Canonical decide result: `VERDICT: INCONCLUSIVE`; headline `487.8 -> 488.9`, `Delta=+1.0`, 95% CI `[-0.1, 4.9]`, `P(Delta<=0)=10.2%`. Per-budget deltas: `50k +0.0`, `100k +6.3`, `200k +0.2`, `300k +0.0`.
- Diagnostics: this was close but missed the canonical acceptance threshold. The `100k` gain generalized only halfway across the full suite, and the `200k` gain was too small to carry the weighted headline.
- Status: reverted after canonical inconclusive; no behavior commit.

## impact-angle-lowair-budget-span-floor045-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: the `0.35` low-air floor was close to canonical acceptance; raising the same smooth budget-gated floor to `0.45` might strengthen the `100k/200k` effect without touching `50k/300k`.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_LOW_AIR_SPAN_FLOOR` from `0.35` to `0.45`; all budget gates and target gates were unchanged.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-lowair-budget-span-floor045-slice-01`
- Probe decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `467.4 -> 469.8`, `Delta=+2.3`, 95% CI `[-0.0, 9.8]`, `P(Delta<=0)=2.9%`. Per-budget deltas: `50k +0.0`, `100k +12.2`, `200k +1.5`, `300k +0.0`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-angle-lowair-budget-span-floor045-01`
- Canonical decide result: `VERDICT: INCONCLUSIVE`; headline `487.8 -> 488.1`, `Delta=+0.3`, 95% CI `[-4.4, 4.9]`, `P(Delta<=0)=34.7%`. Per-budget deltas: `50k +0.0`, `100k +0.3`, `200k +0.8`, `300k +0.0`.
- Diagnostics: the stronger floor improved the focused `200k` point estimate but collapsed the canonical `100k` gain. The mechanism is too suite-sensitive to keep without an accepted canonical verdict.
- Status: reverted after canonical inconclusive; no behavior commit.

## impact-prelength-lowair-shrink-slice-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: low-air high-impact catches may under-hit because long pre-contact approach segments soften the contact tangent before the accepted angle bias. Shrink only `preLength` for low-air high-impact targets so the catch geometry is more local, without changing the post-contact ride-out.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_LOW_AIR_PRE_LENGTH_SHRINK = 0.16` in `scripts/v0/arc_placement.ts` and multiplied the existing `preLength` by a high-impact and low-air pressure.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-prelength-lowair-shrink-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a slightly negative point estimate; 20-spec intersection headline `467.4 -> 467.1`, `Delta=-0.3`, 95% CI `[-6.8, 6.2]`, `P(Delta<=0)=50.7%`. Per-budget deltas: `50k -26.9`, `100k +11.0`, `200k +0.2`, `300k +0.0`; validity improved at `50k` (`97% -> 98%`) and stayed `100%` elsewhere.
- Diagnostics: shortening low-air high-impact approaches created the same `100k` upside pattern seen in other low-air geometry probes, but it again made scarce-budget quality much worse. The effect is not robust enough for canonical testing.
- Status: reverted after focused inconclusive/negative signal; no canonical run and no behavior commit.

## impact-angle-midpressure-slice-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: residual impact under-hit is not limited to very hard targets; mid targets (`0.35..0.75`) are also consistently under-hit, but the accepted angle pressure is zero until `impact=0.55`. Lower the contact-angle pressure curve from `0.55..0.90` to `0.40..0.85` while keeping the same maximum `3deg + sparse room` shift.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_ANGLE_PRESSURE_START = 0.40` and `CONTACT_CENTERED_IMPACT_ANGLE_PRESSURE_SPAN = 0.45` in `scripts/v0/arc_placement.ts`, replacing the accepted `smoothstep((impact - 0.55) / 0.35)` pressure.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-midpressure-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `467.4 -> 468.0`, `Delta=+0.5`, 95% CI `[-8.2, 7.8]`, `P(Delta<=0)=40.4%`. Per-budget deltas: `50k -8.5`, `100k +2.7`, `200k +1.5`, `300k +0.7`; validity improved at `50k` (`97% -> 99%`) and stayed `100%` elsewhere.
- Diagnostics: lowering the pressure threshold did expose small `100k+` upside, but it lost scarce-budget score and the mature gains were small/noisy. Tested a budget-gated derivative instead of promoting.
- Status: reverted after derivative testing; no canonical run and no behavior commit.

## impact-angle-midpressure-budget-slice-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965`.
- Hypothesis: keep the useful part of the mid-pressure probe by leaving the accepted pressure curve unchanged below `75k` and fading to the lower `0.40..0.85` pressure curve by `100k`.
- Code changes made: temporarily added `contactCenteredImpactAnglePressure(impact)` in `scripts/v0/arc_placement.ts`, lerping from the accepted `0.55..0.90` pressure to the lower `0.40..0.85` pressure using a `75k..100k` compile-budget gate.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-midpressure-budget-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `467.4 -> 468.6`, `Delta=+1.2`, 95% CI `[-6.1, 8.2]`, `P(Delta<=0)=34.3%`. Per-budget deltas: `50k +0.0`, `100k +2.7`, `200k +1.5`, `300k +0.7`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: the budget gate cleanly removed the `50k` loss, but per-row comparison showed large seed-level swaps and almost no mature mean gain (`300k` common-row delta about `+0.1`). The effect is too noisy and too small for canonical promotion.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-quality-ncand32-01

- Baseline used: `impact-angle-sparse-extra-01` behavior at commit `5d01965` (later commits before this attempt were log-only).
- Hypothesis: the pre-impact board found `HANDOFF_QUALITY_N_CAND = 24` was the breadth sweet spot, but impact scoring changes the candidate value curve: harder catch geometry can sit later in the deterministic sample batch, and the true-score forward ranker should be able to exploit the larger quality pool.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed `HANDOFF_QUALITY_N_CAND` from `24` to `32` and updated the stale comment. This changes only the post-completion quality-phase breadth; contract breadth, scorer, specs, fingerprint, seed set, and budget grid are unchanged.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm LR_QUALITY_NCAND=32 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-quality-ncand32-slice-01`
- Probe decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `467.4 -> 469.5`, `Delta=+2.1`, 95% CI `[-0.9, 5.0]`, `P(Delta<=0)=7.8%`. Per-budget deltas: `50k +0.9`, `100k +2.5`, `200k +2.3`, `300k +2.1`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-quality-ncand32-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `487.8 -> 489.8`, `Delta=+1.9`, 95% CI `[-0.0, 3.9]`, `P(Delta<=0)=2.7%`. Per-budget deltas: `50k +1.5`, `100k +1.9`, `200k +1.5`, `300k +2.3`; validity stayed `97%` at `50k` and `100%` for `100k+`.
- Notable improvements: weighted spec means improved most on `mini_burst +12.32`, `big_air_ramp +11.17`, `dense_echo_climb +9.61`, `opening_burst +7.86`, `syncopated_lift +7.27`, `summit_push +6.55`, `dense_sprint +6.15`, `rhythm_ladder +5.10`, `switchback_pop +4.89`, and `syncopated_switchback +4.58`. Largest `300k` row wins: `pop_train` seed `10` `+79.07`, `mini_burst` seed `1` `+58.46`, `ridge_pulse` seed `7` `+52.59`, `mixed_grade` seed `6` `+52.36`, and `big_air_ramp` seed `9` `+49.60`.
- Notable regressions: weighted spec losses were led by `float_bounds -6.64`, `glide_stairs -6.23`, `swoop_dive -4.77`, `skyline_push -4.41`, `mixed_grade -3.98`, `ridge_pulse -3.19`, `solo_run -2.15`, and `pop_train -1.43`. Largest `300k` row losses: `glide_stairs` seed `9` `-66.80`, `skyline_push` seed `3` `-63.51`, `climb_terrace` seed `2` `-49.27`, `leap_cadence` seed `0` `-48.87`, and `grain_staircase` seed `5` `-45.53`.
- Axis diagnostics: impact MAE improved at `100k` and `300k` (`100k 0.2133 -> 0.2113`, `300k 0.2010 -> 0.1999`), with signed impact under-hit also slightly better (`300k -0.1853 -> -0.1841`). Speed improved (`300k 0.1321 -> 0.1299`), air improved (`300k 0.0927 -> 0.0911`), and amplitude improved slightly; elevation ticked worse.
- Status: kept; canonical accepted. Use `impact-quality-ncand32-01` as the next baseline.

## impact-quality-ncand40-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: since quality breadth `32` became canonical-accepted under impact scoring, the new optimum might be higher than `32`. Test `40` as an env-only step before changing the default.
- Code changes made: none; ran with `LR_QUALITY_NCAND=40`.
- Probe command: `LR_ENGINE=wasm LR_QUALITY_NCAND=40 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-quality-ncand40-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 468.7`, `Delta=-0.8`, 95% CI `[-4.0, 2.3]`, `P(Delta<=0)=67.5%`. Per-budget deltas: `50k -1.5`, `100k -0.1`, `200k -1.1`, `300k -0.7`.
- Diagnostics: `40` over-spends/dilutes relative to the newly accepted `32`; all budget point estimates were negative. Keep `32` as the current quality breadth default.
- Status: env-only rejected; no canonical run and no behavior commit.

## impact-quality-ncand36-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: interpolate between accepted `32` and rejected `40`; `36` might preserve most of the extra geometry without the full dilution seen at `40`.
- Code changes made: none; ran with `LR_QUALITY_NCAND=36`.
- Probe command: `LR_ENGINE=wasm LR_QUALITY_NCAND=36 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-quality-ncand36-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 469.2`, `Delta=-0.3`, 95% CI `[-2.8, 2.0]`, `P(Delta<=0)=58.5%`. Per-budget deltas: `50k +0.0`, `100k -0.1`, `200k +0.3`, `300k -0.8`.
- Diagnostics: `36` was less harmful than `40`, but still regressed the high-weight `300k` budget. The current breadth peak remains `32`.
- Status: env-only rejected; no canonical run and no behavior commit.

## impact-quality-pool10-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: quality search now samples `32` candidates but still sends only the top local-cost `8` normal candidates to the true-score ranker. Expanding that pool to `10` might expose harder catches that local cost underranks but forward scoring can exploit.
- Code changes made: temporarily changed `HANDOFF_CANDIDATE_POOL` from `8` to `10` in `scripts/v0/optimizer/handoff.ts`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-quality-pool10-slice-01`
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `469.5 -> 462.3`, `Delta=-7.2`, 95% CI `[-24.2, 3.5]`, `P(Delta<=0)=90.2%`. Per-budget deltas: `50k -27.5`, `100k -2.3`, `200k -13.5`, `300k -1.3`.
- Diagnostics: forwarding a wider local-cost pool to true-score ranking starved/diluted the search instead of finding better global catches. The accepted `32` breadth works through a better top-8 pool, not by widening the pool passed downstream.
- Status: reverted after focused reject; no canonical run and no behavior commit.

## impact-repair-upstream6-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: repair telemetry shows many reconverged restarts at `300k`; allowing the upstream blame walk to reach 6 parents instead of 4 might escape repeated suffix convergence on impact-heavy gaps.
- Code changes made: none; ran with `LR_REPAIR_MAX_UPSTREAM=6`.
- Probe command: `LR_ENGINE=wasm LR_REPAIR_MAX_UPSTREAM=6 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-upstream6-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with neutral/slightly negative point estimate; 20-spec intersection headline `469.5 -> 469.5`, `Delta=-0.1`, 95% CI `[-1.0, 0.9]`, `P(Delta<=0)=56.9%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.1`, `300k -0.0`.
- Diagnostics: deeper upstream walking barely changes the focused run, so the accepted repair depth is not the current bottleneck.
- Status: env-only neutral/rejected; no canonical run and no behavior commit.

## impact-repair-main125-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: repair acceptance may be too conservative after impact-aware local cost and wider quality breadth. Raising the main-score repair margin from `1.0` to `1.25` might let suffix repair keep locally rougher but globally better impact catches.
- Code changes made: none; ran with `LR_REPAIR_MAIN_MARGIN=1.25`.
- Probe command: `LR_ENGINE=wasm LR_REPAIR_MAIN_MARGIN=1.25 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb --archive-dir=generated/golden-runs/impact-repair-main125-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `469.5 -> 470.4`, `Delta=+0.9`, 95% CI `[-1.1, 3.2]`, `P(Delta<=0)=19.1%`. Per-budget deltas: `50k +0.0`, `100k +0.5`, `200k +1.4`, `300k +0.9`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: the higher main margin produces a small positive mature-budget point estimate, but the signal is too weak for canonical promotion and exactly neutral at `50k`. Treat it as a possible future fine-tuning lead rather than a default change.
- Status: env-only inconclusive; no canonical run and no behavior commit.

## impact-repair-feas10-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: impact-aware search may benefit from more aggressive repair anchoring. Lowering the feasibility margin from `1.1` to `1.0` admits earlier weak gaps and gives each restart an exact measured-cost ceiling rather than 10% headroom.
- Code changes made: none; ran with `LR_REPAIR_FEAS_MARGIN=1.0`.
- Probe command: `LR_ENGINE=wasm LR_REPAIR_FEAS_MARGIN=1.0 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-feas10-slice-01`
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `469.5 -> 467.8`, `Delta=-1.8`, 95% CI `[-3.9, -0.1]`, `P(Delta<=0)=98.5%`. Per-budget deltas: `50k +0.0`, `100k +0.3`, `200k -1.3`, `300k -3.1`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: exact-cost ceilings improve neither score nor maturity. The small `100k` gain is outweighed by clear `200k/300k` losses, so the existing `1.1` margin is not too conservative for impact scoring.
- Status: env-only rejected; no canonical run and no behavior commit.

## impact-repair-feas125-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: if exact-cost repair ceilings are too tight, a slightly looser feasibility margin (`1.25`) might let suffix rebuilds complete more often without drifting as far as the old bad `1.5` setting.
- Code changes made: none; ran with `LR_REPAIR_FEAS_MARGIN=1.25`.
- Probe command: `LR_ENGINE=wasm LR_REPAIR_FEAS_MARGIN=1.25 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-feas125-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 469.3`, `Delta=-0.2`, 95% CI `[-1.4, 0.7]`, `P(Delta<=0)=66.9%`. Per-budget deltas: `50k +0.0`, `100k -1.0`, `200k -0.1`, `300k -0.1`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: extra headroom does not produce a mature-budget lift and costs `100k`. Together with the rejected `1.0` probe, this brackets the current `1.1` default as still the best repair feasibility margin.
- Status: env-only inconclusive/negative; no canonical run and no behavior commit.

## impact-lowair-avg-gate-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: the current mature `avg` forward-eval gate is limited to elevation/amplitude gaps. Since low-air hard-impact targets are the worst reachable impact bucket (`300k` target `0.837`, achieved `0.378`, ceiling `0.996`), use the same mature avg ranker only when `impact >= 0.75` and `air <= 0.45`, without adding candidates or changing geometry.
- Code changes made: temporarily added `targetsLowAirHardImpact(...)` in `scripts/v0/optimizer/handoff.ts` and allowed `matureForwardEvalConfig(...)` to use the existing avg path for vertical-drama gaps or low-air hard-impact gaps.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-avg-gate-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 469.1`, `Delta=-0.4`, 95% CI `[-6.7, 5.9]`, `P(Delta<=0)=60.3%`. Per-budget deltas: `50k +0.0`, `100k +0.1`, `200k -0.5`, `300k -0.7`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: the narrower avg gate avoids the broad failure mode but still regresses mature budgets. The issue is not solved by swapping the true-score ranker variant on this subset.
- Status: reverted after focused inconclusive/negative signal; no canonical run and no behavior commit.

## impact-lowair-span-floor-ncand32-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: the earlier budget-gated low-air impact span floor nearly accepted canonically before the quality breadth change. Re-test the same mechanism under the accepted `HANDOFF_QUALITY_N_CAND = 32`, where the forward ranker sees a larger altered candidate batch.
- Code changes made: temporarily reintroduced `CONTACT_CENTERED_IMPACT_LOW_AIR_SPAN_FLOOR = 0.35` in `scripts/v0/arc_placement.ts`, lerping low-air impact spans toward `max(launchSpan, 0.35)` with a `75k..100k` fade-in and `220k..300k` fade-out.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-span-floor-ncand32-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 467.7`, `Delta=-1.9`, 95% CI `[-11.3, 4.7]`, `P(Delta<=0)=77.3%`. Per-budget deltas: `50k +0.0`, `100k -10.8`, `200k -0.6`, `300k +0.0`; validity regressed at `100k` (`100% -> 99%`).
- Diagnostics: the accepted `32` breadth flips the prior close mechanism negative. The larger altered pool no longer preserves the `100k` gain; it adds a validity loss and small `200k` regression.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-curve-fade-off-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: pre-impact experiments saw noisy upside from keeping contact-centered ride-out curvature diversity active at mature budgets (`LR_CURVE_FADE_OFF=1`). With impact scoring and `32` quality candidates, the forward ranker might exploit that extra geometry instead of being diluted by it.
- Code changes made: none; ran with `LR_CURVE_FADE_OFF=1`.
- Probe command: `LR_ENGINE=wasm LR_CURVE_FADE_OFF=1 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-curve-fade-off-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 468.9`, `Delta=-0.6`, 95% CI `[-8.8, 7.4]`, `P(Delta<=0)=57.4%`. Per-budget deltas: `50k +0.0`, `100k -0.5`, `200k -0.2`, `300k -1.0`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: mature curvature diversity is still dilution under impact scoring. It improves some sparse rows, but the focused aggregate and all non-50k budget point estimates are negative.
- Status: env-only inconclusive/negative; no canonical run and no behavior commit.

## impact-fwd-min150k-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: impact scoring might make the charged `greedy:2` forward-eval ranker too expensive at exactly `100k`. Raise `LR_FWD_EVAL_MIN_BUDGET` from the default `75k` to `150k`, leaving `200k/300k` behavior unchanged while returning `100k` to the cheap local ranker.
- Code changes made: none; ran with `LR_FWD_EVAL_MIN_BUDGET=150000`.
- Probe command: `LR_ENGINE=wasm LR_FWD_EVAL_MIN_BUDGET=150000 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-fwd-min150k-slice-01`
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `469.5 -> 463.7`, `Delta=-5.8`, 95% CI `[-10.6, 1.9]`, `P(Delta<=0)=95.2%`. Per-budget deltas: `50k +0.0`, `100k -37.9`, `200k +0.0`, `300k +0.0`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: the current `75k` forward-eval gate remains essential under impact scoring; the local ranker loses a large amount of `100k` quality even though it preserves validity.
- Status: env-only rejected; no canonical run and no behavior commit.

## impact-fwd-best300-b2-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: the old free-ceiling work favored `best` forward rollouts, but charged cost was too high globally. Try a charged `best:2:2` only at the largest canonical budget (`300k`), leaving `50k/100k/200k` byte-identical to the accepted default.
- Code changes made: temporarily added a high-budget branch in `matureForwardEvalConfig(...)` in `scripts/v0/optimizer/handoff.ts`, switching the default `greedy:2` config to `best:2:2` only when `targetBudget >= 300000`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-fwd-best300-b2-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 467.6`, `Delta=-1.9`, 95% CI `[-5.0, 1.3]`, `P(Delta<=0)=88.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k -4.1`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: the extra optimistic rollout cost does not buy enough 300k quality. It changed almost every 300k row but doubled regressions (`103` regressions vs `136` improvements) and lowered the weighted score.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-contract-full-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: the budget-aware contract breadth reduction may now be too lean for impact-aware local ranking. Disable it with `LR_BUDGET_AWARE_CONTRACT=0` so the contract phase keeps full sampling at scarce budgets.
- Code changes made: none; ran with `LR_BUDGET_AWARE_CONTRACT=0`.
- Probe command: `LR_ENGINE=wasm LR_BUDGET_AWARE_CONTRACT=0 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-contract-full-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `469.5 -> 467.2`, `Delta=-2.3`, 95% CI `[-14.0, 7.6]`, `P(Delta<=0)=68.0%`. Per-budget deltas: `50k -8.4`, `100k -10.9`, `200k +0.0`, `300k +0.0`; validity regressed at `100k` (`100% -> 99%`) and improved at `50k` (`97% -> 99%`).
- Diagnostics: full contract sampling spends scarce budget without improving impact quality. The accepted budget-aware reduction remains the right completion/quality tradeoff.
- Status: env-only inconclusive/negative; no canonical run and no behavior commit.

## impact-repair-main11-slice-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: the `1.25` repair main margin probe gave a small mature-budget lift but was too noisy. A smaller `1.1` margin might keep the useful suffix-repair tolerance while avoiding the `100k` churn risk from a wider acceptance band.
- Code changes made: none; ran with `LR_REPAIR_MAIN_MARGIN=1.1`.
- Probe command: `LR_ENGINE=wasm LR_REPAIR_MAIN_MARGIN=1.1 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-main11-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `469.5 -> 470.5`, `Delta=+1.0`, 95% CI `[-1.0, 3.2]`, `P(Delta<=0)=16.9%`. Per-budget deltas: `50k +0.0`, `100k -0.5`, `200k +1.4`, `300k +1.3`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: the smaller margin is slightly better than `1.25` on point estimate and avoids a large low-budget failure, but it still regresses `100k` and does not clear the focused accept bar. Treat as a live lead, not a default change.
- Status: env-only inconclusive; no canonical run and no behavior commit.

## impact-repair-main11-ramp-01

- Baseline used: `impact-quality-ncand32-01` behavior at commit `331c127`.
- Hypothesis: flat `LR_REPAIR_MAIN_MARGIN=1.1` improved mature budgets but cost `100k`. Make the default margin budget-aware: keep `1.0` at the 100k repair gate and ease to `1.1` by `200k`, preserving low-budget behavior while keeping the mature repair allocation gain.
- Code changes made: `scripts/v0/optimizer/handoff.ts` now passes `targetBudget` into `repairConfig(...)` and computes the default repair `mainMargin` with a smooth `100k..200k` ramp. Explicit `LR_REPAIR_MAIN_MARGIN` overrides remain unchanged.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-main11-ramp-slice-01`
- Focused decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `469.5 -> 470.6`, `Delta=+1.0`, 95% CI `[-0.9, 3.3]`, `P(Delta<=0)=14.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.4`, `300k +1.3`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=big_air_ramp,canyon_steps,climb_terrace,cold_start,dense_echo_climb,dense_sprint,drums_breath,drums_crescendo,drums_crosscut,drums_dropout,drums_pendulum,drums_pulse,drums_signature,drums_swell,drums_tide,drums_zigzag,float_bounds,glide_stairs,grain_staircase,leap_cadence,mini_burst,mixed_grade,opening_burst,pop_train,rhythm_ladder,ridge_pulse,rolling_drop,rolling_hills,skyline_push,soar_settle,solo_run,summit_push,switchback_pop,swoop_dive,syncopated_lift,syncopated_switchback,terrace_sprint,tiny_dance,valley_bounce,verse_chorus --archive-dir=generated/golden-runs/impact-repair-main11-ramp-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: ACCEPT`; 40-spec scope headline `489.8 -> 490.7`, `Delta=+1.0`, 95% CI `[-0.5, 2.5]`, `P(Delta<=0)=9.5%`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-repair-main11-ramp-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `489.8 -> 490.7`, `Delta=+1.0`, 95% CI `[-0.5, 2.5]`, `P(Delta<=0)=9.5%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.7`, `300k +0.9`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: the ramp isolates the mature-budget improvement from the low-budget churn seen in the flat margin probe. It raises the canonical baseline by spending a little more main-search budget before repair at mature budgets, without changing the scarce-budget completion path.
- Status: kept and committed; new canonical baseline is `impact-repair-main11-ramp-01`.

## impact-repair-main115-ramp-slice-01

- Baseline used: `impact-repair-main11-ramp-01` behavior at commit `5e69472`.
- Hypothesis: the accepted `1.1` mature repair main-margin ramp may still be conservative. Raising only the ramp endpoint to `1.15` keeps `50k/100k` byte-identical while giving mature budgets slightly more main-search context before repair.
- Code changes made: temporarily changed `REPAIR_MAIN_MARGIN_MATURE` from `1.1` to `1.15` in `scripts/v0/optimizer/handoff.ts`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-main115-ramp-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `470.6 -> 470.6`, `Delta=+0.0`, 95% CI `[-0.0, 0.1]`, `P(Delta<=0)=21.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.0`, `300k +0.1`.
- Diagnostics: the extra endpoint is essentially neutral. It changes some rows but does not produce a useful point estimate beyond the accepted `1.1` ramp, so the mature repair split is already near the local plateau.
- Status: reverted after focused neutral signal; no canonical run and no behavior commit.

## impact-repair-weight15-ramp-slice-01

- Baseline used: `impact-repair-main11-ramp-01` behavior at commit `5e69472`.
- Hypothesis: the accepted repair main-margin ramp reduces the number of suffix restarts, so weighting impact errors higher when choosing repair anchors might concentrate the remaining repair budget on the dominant residual without changing geometry or scoring.
- Code changes made: temporarily added `REPAIR_IMPACT_WEAK_GAP_WEIGHT = 1.5` inside `pickFeasibleWeakGap(...)`, multiplying only `impact` error when ranking repair anchors.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-weight15-ramp-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `470.6 -> 471.0`, `Delta=+0.4`, 95% CI `[-1.0, 1.9]`, `P(Delta<=0)=27.0%`. Per-budget deltas: `50k +0.0`, `100k +1.0`, `200k +0.8`, `300k +0.1`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: this remains a small noisy positive, consistent with the earlier pre-ramp canonical inconclusive result. It is not strong enough to spend a canonical run or change the default repair anchor ranking.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-angle-dense-mature-extra-ramp-01

- Baseline used: `impact-repair-main11-ramp-01` behavior at commit `5e69472`.
- Hypothesis: the accepted sparse-room high-impact angle bias leaves dense low-air hard-impact rows as the dominant residual, especially at mature budgets. Add one extra degree only for dense contact-centered gaps after `150k`, reaching the full extra degree by `200k`, so `50k/100k` stay byte-identical while mature dense catches get a slightly harder approach.
- Code changes made: added `CONTACT_CENTERED_IMPACT_DENSE_MATURE_EXTRA_SHIFT_DEG = 1` in `scripts/v0/arc_placement.ts` and blended it by dense-room pressure `(1 - room)` times a `150k..200k` smooth budget ramp inside `contactCenteredImpactAngleShiftDeg(...)`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-dense-mature-extra-ramp-slice-01`
- Focused decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `470.6 -> 472.4`, `Delta=+1.9`, 95% CI `[-1.2, 5.2]`, `P(Delta<=0)=11.5%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.3`, `300k +2.5`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=big_air_ramp,canyon_steps,climb_terrace,cold_start,dense_echo_climb,dense_sprint,drums_breath,drums_crescendo,drums_crosscut,drums_dropout,drums_pendulum,drums_pulse,drums_signature,drums_swell,drums_tide,drums_zigzag,float_bounds,glide_stairs,grain_staircase,leap_cadence,mini_burst,mixed_grade,opening_burst,pop_train,rhythm_ladder,ridge_pulse,rolling_drop,rolling_hills,skyline_push,soar_settle,solo_run,summit_push,switchback_pop,swoop_dive,syncopated_lift,syncopated_switchback,terrace_sprint,tiny_dance,valley_bounce,verse_chorus --archive-dir=generated/golden-runs/impact-angle-dense-mature-extra-ramp-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: ACCEPT`; 40-spec scope headline `490.7 -> 492.1`, `Delta=+1.4`, 95% CI `[-0.6, 3.4]`, `P(Delta<=0)=8.3%`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-angle-dense-mature-extra-ramp-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `490.7 -> 492.1`, `Delta=+1.4`, 95% CI `[-0.6, 3.4]`, `P(Delta<=0)=8.3%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.8`, `300k +1.7`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: the focused and full-spec signals agree that the extra dense mature angle helps only where intended. It preserves all scarce-budget scores and pass rates while lifting both mature budgets, so the new baseline isolates a geometry gain rather than a budget-allocation trade.
- Status: kept and committed; new canonical baseline is `impact-angle-dense-mature-extra-ramp-01`.

## impact-angle-dense-mature-extra15-ramp-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: since the accepted dense mature extra degree improved low-air high-impact achievement but left the bucket far under target, a `1.5deg` endpoint might continue the same mature-budget gain without touching `50k/100k`.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_DENSE_MATURE_EXTRA_SHIFT_DEG` from `1` to `1.5` in `scripts/v0/arc_placement.ts`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-dense-mature-extra15-ramp-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a neutral point estimate; 20-spec intersection headline `472.4 -> 472.4`, `Delta=-0.0`, 95% CI `[-3.2, 3.1]`, `P(Delta<=0)=51.3%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.5`, `300k -0.4`; validity improved at `50k` (`97% -> 100%`) and stayed `100%` elsewhere.
- Diagnostics: the extra half degree is past the local useful point. It slightly lifts `200k` but gives that back at `300k`, so the accepted `1deg` mature dense angle bias is the better endpoint.
- Status: reverted after focused neutral/negative signal; no canonical run and no behavior commit.

## impact-start-angle-mature-bias3-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: the worst low-air high-impact errors often occur on the first contact, where the start-angle generator still targets only air. Shift high-impact start angles by up to `3deg` after `150k`, reaching full strength by `200k`, to mirror the accepted contact-angle bias while leaving `50k/100k` unchanged.
- Code changes made: temporarily threaded `targetBudget` through start-option generation in `scripts/v0/optimizer/handoff.ts` and subtracted a high-impact, mature-budget angle shift inside `targetStartAngle(...)`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-start-angle-mature-bias3-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with an exactly neutral result; 20-spec intersection headline `472.4 -> 472.4`, `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget deltas were `+0.0` at every budget.
- Diagnostics: the new start candidates did not alter the selected outputs on the focused slice. The first-contact failure mode is not reachable by a small mature-only shift of the existing start-angle lattice.
- Status: reverted after focused no-op signal; no canonical run and no behavior commit.

## impact-release-vertical-w065-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: low-air high-impact gaps still overshoot air and speed while under-hitting impact. Increase the existing quality-phase release-vertical setup penalty from `0.045` to `0.065` so candidates entering upcoming low-air or tight-cadence contacts prefer less vertical excess.
- Code changes made: temporarily changed `HANDOFF_RELEASE_VERTICAL_WEIGHT` from `0.045` to `0.065` in `scripts/v0/optimizer/handoff.ts`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-release-vertical-w065-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with an exactly neutral result; 20-spec intersection headline `472.4 -> 472.4`, `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget deltas were `+0.0` at every budget.
- Diagnostics: the stronger setup penalty did not alter the selected outputs on the focused slice. This penalty is not currently on the active decision boundary for the remaining impact failures.
- Status: reverted after focused no-op signal; no canonical run and no behavior commit.
