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

## impact-reuse-mature-extra070-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: selected options still use reuse candidates heavily at mature budgets. Increase the quality-phase mature extra-reuse probability weight from `0.35` to `0.70` so the ranker occasionally sees one more translated catch without changing geometry.
- Code changes made: temporarily changed `HANDOFF_REUSE_MATURE_EXTRA_WEIGHT` from `0.35` to `0.70` in `scripts/v0/optimizer/handoff.ts`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-reuse-mature-extra070-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `472.4 -> 472.5`, `Delta=+0.1`, 95% CI `[-0.2, 0.6]`, `P(Delta<=0)=43.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.2`.
- Diagnostics: the mechanism is active but the payoff is too small and too noisy to justify a canonical run.
- Status: endpoint bracketed upward to `1.0`, then reverted; no canonical run and no behavior commit.

## impact-reuse-mature-extra100-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: if `0.70` is directionally positive but too weak, pushing the mature extra-reuse probability weight to `1.0` may create enough candidate diversity to produce a measurable mature-budget gain.
- Code changes made: temporarily changed `HANDOFF_REUSE_MATURE_EXTRA_WEIGHT` from `0.35` to `1.0` in `scripts/v0/optimizer/handoff.ts`.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-reuse-mature-extra100-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `472.4 -> 472.5`, `Delta=+0.1`, 95% CI `[-0.3, 0.7]`, `P(Delta<=0)=41.9%`. Per-budget deltas: `50k +0.0`, `100k +0.1`, `200k +0.1`, `300k +0.1`.
- Diagnostics: more reuse breadth remains a tiny positive at best, but it is nowhere near the accept bar. The cost/benefit is not competitive with the accepted geometry changes.
- Status: reverted after focused weak-positive signal; no canonical run and no behavior commit.

## impact-angle-sparse-mature-extra05-ramp-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: sparse high-impact gaps still under-hit impact, so add a further `0.5deg` impact angle shift only for sparse-room gaps at mature budgets while preserving the accepted dense mature curve and `50k/100k` behavior.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_SPARSE_MATURE_EXTRA_SHIFT_DEG = 0.5` in `scripts/v0/arc_placement.ts` and blended it by `room * smoothstep((budget - 150k) / 50k)` inside `contactCenteredImpactAngleShiftDeg(...)`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-angle-sparse-mature-extra05-ramp-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `472.4 -> 471.3`, `Delta=-1.1`, 95% CI `[-3.7, 0.9]`, `P(Delta<=0)=83.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -1.2`, `300k -1.5`.
- Diagnostics: unlike the dense mature extra, adding more sparse mature angle over-rotates the successful sparse path. Sparse high-impact under-hit is not improved by pushing the same angle mechanism further.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-quality-dense-hi-extra4-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: residual high-impact error is concentrated in dense next-contact gaps (`<=26` frames). Instead of raising global quality breadth again, add four extra quality candidates only for mature dense high-impact gaps (`impact >= 0.75`) so the ranker can see more hard-catch variants where the residual is largest.
- Code changes made: temporarily added a `denseHighImpactQualitySampleCount(...)` helper in `scripts/v0/optimizer/handoff.ts`, increasing `normalCandidates` by up to `4` after a `150k..200k` budget ramp when the next contact gap is dense.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-quality-dense-hi-extra4-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `472.4 -> 471.9`, `Delta=-0.5`, 95% CI `[-1.8, 0.6]`, `P(Delta<=0)=81.6%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.3`, `300k -1.3`.
- Diagnostics: targeted extra breadth is still dilution. It slightly helps `200k` but spends/redirects enough 300k search to create more regressions, matching the broader `36/40` quality breadth failures.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-fwd-greedy3-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: remaining dense high-impact failures may need one more contact of true-score context than the default charged `greedy:2` forward ranker provides.
- Code changes made: none; ran with `LR_FWD_EVAL=greedy:3`.
- Probe command: `LR_ENGINE=wasm LR_FWD_EVAL=greedy:3 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-fwd-greedy3-slice-01`
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `472.4 -> 449.6`, `Delta=-22.8`, 95% CI `[-40.6, -6.3]`, `P(Delta<=0)=99.7%`. Per-budget deltas: `50k +0.0`, `100k -22.5`, `200k -24.1`, `300k -25.9`.
- Diagnostics: the third charged rollout is far too expensive. It preserves validity but removes enough search budget that quality collapses across non-50k budgets.
- Status: env-only rejected; no canonical run and no behavior commit.

## impact-lowair-dense-length-extra-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: low-air dense high-impact gaps still overshoot air while under-hitting impact. Increase the contact-centered air-targeted grounded ride-out length blend only for mature low-air/dense/high-impact gaps to reduce air overshoot without touching sparse or low-budget behavior.
- Code changes made: temporarily added `LOW_AIR_HIGH_IMPACT_DENSE_LENGTH_BLEND_EXTRA = 0.20` in `scripts/v0/arc_placement.ts` and added it to the post-length blend strength when `impact >= 0.75`, `air <= 0.45`, next-contact spacing is dense, and the `150k..200k` budget ramp is active.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-dense-length-extra-slice-01`
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `472.4 -> 470.9`, `Delta=-1.6`, 95% CI `[-4.5, 0.2]`, `P(Delta<=0)=95.4%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -1.5`, `300k -2.4`.
- Diagnostics: forcing more grounded ride-out in the low-air dense hard-impact corner hurts mature quality. The ranker already balances the air/impact tradeoff better than this local length pressure.
- Status: reverted after focused reject; no canonical run and no behavior commit.

## impact-lowair-dense-angle-floor-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: archived worst-row diagnostics showed many low-air/dense/high-impact landings had enough incoming speed but nearly parallel incoming velocity and fired tangent, with several selected contacts pinned at the current `-14deg` final tangent floor. Instead of exact target-angle steering, lower only the contact-centered negative angle floor for mature low-air dense hard-impact gaps so the accepted impact shift can express a slightly harder catch.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_LOW_AIR_DENSE_BASE_MIN_EXTRA_DEG = 6` and `CONTACT_CENTERED_IMPACT_LOW_AIR_DENSE_FINAL_MIN_EXTRA_DEG = 8` in `scripts/v0/arc_placement.ts`; the base contact-angle clamp and final impact clamp were lowered by high-impact pressure, low-air pressure, dense next-contact pressure, and the existing `150k..200k` mature budget ramp. `50k/100k` were intended to stay byte-equivalent.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-dense-angle-floor-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `472.4 -> 472.4`, `Delta=-0.0`, 95% CI `[-0.9, 1.0]`, `P(Delta<=0)=59.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.1`, `300k -0.2`; validity stayed `100%` at all budgets on the focused intersection.
- Diagnostics: the lowered floor did not cause the validity collapse seen in exact impact-angle steering, but it also did not improve the aggregate. The worst `drums_pendulum` rows remained the bottom 300k cases and the small `200k` lift was given back at `300k`, so the current `-14deg` floor is not the main accepted-path limit.
- Status: reverted after focused neutral/negative signal; no canonical run and no behavior commit.

## impact-lowair-dense-lip12-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: dense low-air hard-impact rows have enough incoming speed but the post-contact ride-out tangent stays too parallel to the incoming velocity. Shift only the first post-contact segment into a small "lip" for mature low-air/dense/high-impact gaps, preserving the rest of the ride-out and leaving `50k/100k` unchanged.
- Code changes made: temporarily added a `12deg` first-post-segment shift in `scripts/v0/arc_placement.ts`, gated by high-impact pressure, low-air pressure `smoothstep((0.45 - air) / 0.30)`, dense next-contact spacing, and the `150k..200k` mature budget ramp.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-dense-lip12-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `472.4 -> 473.5`, `Delta=+1.1`, 95% CI `[-0.9, 3.5]`, `P(Delta<=0)=16.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.6`, `300k +1.2`; validity stayed `100%`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=big_air_ramp,canyon_steps,climb_terrace,cold_start,dense_echo_climb,dense_sprint,drums_breath,drums_crescendo,drums_crosscut,drums_dropout,drums_pendulum,drums_pulse,drums_signature,drums_swell,drums_tide,drums_zigzag,float_bounds,glide_stairs,grain_staircase,leap_cadence,mini_burst,mixed_grade,opening_burst,pop_train,rhythm_ladder,ridge_pulse,rolling_drop,rolling_hills,skyline_push,soar_settle,solo_run,summit_push,switchback_pop,swoop_dive,syncopated_lift,syncopated_switchback,terrace_sprint,tiny_dance,valley_bounce,verse_chorus --archive-dir=generated/golden-runs/impact-lowair-dense-lip12-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: INCONCLUSIVE`; 40-spec scope headline `492.1 -> 492.7`, `Delta=+0.6`, 95% CI `[-0.4, 2.0]`, `P(Delta<=0)=13.5%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.0`, `300k +0.6`; validity unchanged.
- Diagnostics: the first-segment lip is active and directionally positive, but low-air-only gating leaves the aggregate effect below the promotion bar.
- Status: bracketed upward; no canonical run and no behavior commit.

## impact-lowair-dense-lip16-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: if `12deg` is directionally positive but too weak, a stronger `16deg` low-air dense lip may expose more hard-impact candidates without destabilizing high-air specs.
- Code changes made: temporarily changed the low-air dense first-post-segment lip endpoint from `12deg` to `16deg`.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-dense-lip16-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `472.4 -> 473.5`, `Delta=+1.0`, 95% CI `[-1.1, 3.7]`, `P(Delta<=0)=19.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.8`, `300k +1.0`; validity stayed `100%`.
- Diagnostics: stronger than `12deg` at `200k` but weaker at `300k` and noisier overall. `16deg` is past the low-air-only sweet spot.
- Status: reverted/bracketed down; no canonical run and no behavior commit.

## impact-lowair-dense-lip14-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: a midpoint `14deg` low-air dense lip may keep the useful `200k` lift from `16deg` while preserving the stronger `300k` behavior from `12deg`.
- Code changes made: temporarily changed the low-air dense first-post-segment lip endpoint to `14deg`, with the same high-impact, low-air, dense-spacing, and mature-budget gates.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-dense-lip14-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `472.4 -> 473.8`, `Delta=+1.3`, 95% CI `[-0.7, 3.9]`, `P(Delta<=0)=11.4%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.3`, `300k +1.4`; validity stayed `100%`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=big_air_ramp,canyon_steps,climb_terrace,cold_start,dense_echo_climb,dense_sprint,drums_breath,drums_crescendo,drums_crosscut,drums_dropout,drums_pendulum,drums_pulse,drums_signature,drums_swell,drums_tide,drums_zigzag,float_bounds,glide_stairs,grain_staircase,leap_cadence,mini_burst,mixed_grade,opening_burst,pop_train,rhythm_ladder,ridge_pulse,rolling_drop,rolling_hills,skyline_push,soar_settle,solo_run,summit_push,switchback_pop,swoop_dive,syncopated_lift,syncopated_switchback,terrace_sprint,tiny_dance,valley_bounce,verse_chorus --archive-dir=generated/golden-runs/impact-lowair-dense-lip14-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: INCONCLUSIVE`; 40-spec scope headline `492.1 -> 492.8`, `Delta=+0.7`, 95% CI `[-0.4, 2.1]`, `P(Delta<=0)=11.5%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.2`, `300k +0.7`; validity unchanged.
- Diagnostics: `14deg` is the best low-air-only endpoint, but the full-scope signal is still just short of the accept bar. Expanding air coverage while excluding high-air opening rows is the next useful gate to test.
- Status: superseded by the mid-air gated `14deg` variant; no canonical run for this low-air-only version.

## impact-dense-lip14-slice-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: removing the low-air gate might let the `14deg` lip address all dense hard-impact residuals, including mid/high-air dense rows.
- Code changes made: temporarily removed the air-pressure multiplier from the mature dense high-impact first-post-segment lip.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-dense-lip14-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `472.4 -> 477.5`, `Delta=+5.1`, 95% CI `[-19.0, 22.4]`, `P(Delta<=0)=29.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +5.6`, `300k +7.3`; validity stayed `100%`.
- Diagnostics: the broad lip caused huge variance. It improved many dense drum rows but collapsed `opening_burst` quality while remaining valid; worst `300k` rows became `opening_burst` seeds (`242.74`, `255.78`, `258.35`, `264.61`, `265.61`). Row diagnostics showed the high-air opening targets (`air` around `0.82`) fired the broad lip, raised the first impact, then destroyed carry speed on later rows.
- Status: rejected after focused diagnostics; no full preview, no canonical run, and no behavior commit.

## impact-midair-dense-lip14-01

- Baseline used: `impact-angle-dense-mature-extra-ramp-01` behavior at commit `845a08a`.
- Hypothesis: the low-air-only lip was safe but too narrow, while the ungated dense lip was too broad. Use a mid-air gate `smoothstep((0.65 - air) / 0.35)` so the `14deg` lip reaches low/mid-air dense hard-impact rows but stays inactive for high-air opening-burst targets around `0.82`.
- Code changes made: added `CONTACT_CENTERED_IMPACT_DENSE_LIP_SHIFT_DEG = 14` in `scripts/v0/arc_placement.ts`; `sampleContactCenteredLines(...)` now computes a first post-contact segment angle shifted by `contactCenteredImpactLipShiftDeg(...)`, gated by high-impact pressure, the mid-air pressure, dense next-contact spacing, and a `150k..200k` mature budget ramp. `buildPostContactLines(...)` accepts an optional first-segment angle so the lip only changes the contact segment and preserves the remaining ride-out curve.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-midair-dense-lip14-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `472.4 -> 476.0`, `Delta=+3.6`, 95% CI `[0.2, 7.3]`, `P(Delta<=0)=2.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +4.6`, `300k +4.8`; validity stayed `100%`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=big_air_ramp,canyon_steps,climb_terrace,cold_start,dense_echo_climb,dense_sprint,drums_breath,drums_crescendo,drums_crosscut,drums_dropout,drums_pendulum,drums_pulse,drums_signature,drums_swell,drums_tide,drums_zigzag,float_bounds,glide_stairs,grain_staircase,leap_cadence,mini_burst,mixed_grade,opening_burst,pop_train,rhythm_ladder,ridge_pulse,rolling_drop,rolling_hills,skyline_push,soar_settle,solo_run,summit_push,switchback_pop,swoop_dive,syncopated_lift,syncopated_switchback,terrace_sprint,tiny_dance,valley_bounce,verse_chorus --archive-dir=generated/golden-runs/impact-midair-dense-lip14-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: ACCEPT`; 40-spec scope headline `492.1 -> 496.4`, `Delta=+4.3`, 95% CI `[1.8, 7.1]`, `P(Delta<=0)=0.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +5.5`, `300k +5.8`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-midair-dense-lip14-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `492.1 -> 496.4`, `Delta=+4.3`, 95% CI `[1.8, 7.1]`, `P(Delta<=0)=0.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +5.5`, `300k +5.8`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: the mid-air gate preserved the broad probe's mature dense upside while avoiding the high-air opening-burst speed collapse. The improvement is a mature-budget geometry gain, not a validity or budget-allocation trade.
- Status: kept and committed; new canonical baseline is `impact-midair-dense-lip14-01`.

## impact-lowair-room-lip-span4-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: after the accepted mid-air dense lip, the remaining `drums_pendulum` residual is high-impact low-air mid/sparse spacing: impact under-hit around `0.39-0.47`, air overshoot around `0.38-0.40`, and average impact ceiling near `0.98`. Preserve the accepted fixed `14deg` lip but add a small attempt-spanned low-air-only extra so the ranker can see a few harder catch variants without forcing every candidate.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_LOW_AIR_LIP_SPAN_DEG = 4`, passed `attempt` into `contactCenteredImpactLipShiftDeg(...)`, and added up to `4deg * lowAir * lowAirRoom * ccSpanBlends(attempt).launch` on top of the accepted dense lip. The extra was high-impact, low-air, mature-budget gated and faded after sparse-room spacing.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-room-lip-span4-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `476.0 -> 475.0`, `Delta=-1.0`, 95% CI `[-3.9, 1.2]`, `P(Delta<=0)=77.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.7`, `300k -1.7`; validity stayed `100%`.
- Diagnostics: extra low-air lip span worsened the exact residual it targeted: visible `drums_pendulum` 300k scores dropped on several seeds, while high-air opening rows stayed stable. The accepted fixed lip is already near the useful contact-angle boundary; more first-segment angle is not the next lever.
- Status: reverted after focused negative signal; no canonical run and no behavior commit.

## impact-lowair-room-safe-cap63-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: the remaining high-impact low-air mid/sparse rows overshoot air badly while speed stays near target, and the current air-targeted ride-out length is capped at `55%` of the next-contact span. Raise only roomier low-air/high-impact mature gaps toward a `63%` safe cap, avoiding the earlier dense/mid-budget safe-cap failure.
- Code changes made: temporarily added `LOW_AIR_HIGH_IMPACT_ROOM_SAFE_CAP_EXTRA = 0.08` in `scripts/v0/arc_placement.ts`; replaced the fixed `0.55` safe-cap fraction with `0.55 + 0.08 * highImpact * lowAir * lowAirRoom * mature`, where `lowAirRoom` fades in after `24` frames and fades out after `70` frames, and `mature` ramps from `150k..200k`.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-room-safe-cap63-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a neutral point estimate; 20-spec intersection headline `476.0 -> 476.0`, `Delta=+0.0`, 95% CI `[-1.0, 1.1]`, `P(Delta<=0)=51.2%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.3`, `300k -0.2`; validity stayed `100%`.
- Diagnostics: the cap change traded seed-level `drums_pendulum` wins and losses without improving the aggregate; one worst row dropped to `276.89`, while some other seeds recovered. The air overshoot is real, but simply extending ride-out capacity is too volatile.
- Status: reverted after focused neutral signal; no canonical run and no behavior commit.

## impact-highair-dense-lip3-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: the broad ungated `14deg` dense lip collapsed high-air opening rows, but high-impact/high-air dense rows remain a large residual across `opening_burst`, `dense_sprint`, and `rhythm_ladder`. Add only a small `3deg` high-air dense lip after the mature budget ramp to improve impact without destroying carry speed.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_HIGH_AIR_DENSE_LIP_SHIFT_DEG = 3` in `scripts/v0/arc_placement.ts`; added `3deg * smoothstep((air - 0.65) / 0.20)` to the accepted dense lip helper, still gated by high-impact pressure, dense spacing, and the `150k..200k` mature ramp.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-highair-dense-lip3-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `476.0 -> 476.7`, `Delta=+0.6`, 95% CI `[-3.9, 4.4]`, `P(Delta<=0)=32.3%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.2`, `300k +0.6`; validity stayed `100%`.
- Diagnostics: the small high-air lip avoided the catastrophic broad-lip collapse but remained too volatile. It lifted some dense/high-air rows and added high-end pop-train wins, while pushing `opening_burst` seed `5` into the worst rows at `300k`.
- Status: bracketed down to `2deg`; no full preview, no canonical run, and no behavior commit.

## impact-highair-dense-lip2-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: reducing the high-air dense lip from `3deg` to `2deg` may keep the small mature-budget point-estimate gain while reducing opening-burst volatility.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_HIGH_AIR_DENSE_LIP_SHIFT_DEG` from `3` to `2`.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-highair-dense-lip2-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `476.0 -> 476.7`, `Delta=+0.6`, 95% CI `[-4.6, 4.7]`, `P(Delta<=0)=33.9%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.0`, `300k +0.8`; validity stayed `100%`.
- Diagnostics: `2deg` was not cleaner than `3deg`; the point estimate stayed weak-positive but CI widened and several opening/drum seeds still regressed. The high-air dense residual needs a different mechanism than first-segment lip angle.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-local-cost-mature075-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: after the accepted lip geometry, the candidate pool contains better hard-impact shapes, but local selection still weights impact error at `0.5`. Raise the local impact cost weight only at mature budgets from `0.5` to `0.75` so `50k/100k` stay byte-identical while `200k/300k` prefer lower impact error.
- Code changes made: temporarily exported `compileBudgetMaturePressure(...)` from `scripts/v0/arc_placement.ts`; imported it in `scripts/v0/core/candidate.ts`; changed `axisCost(...)` to use `0.5 + 0.25 * maturePressure` for impact.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-local-cost-mature075-slice-01`
- Focused decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `476.0 -> 477.1`, `Delta=+1.1`, 95% CI `[-1.0, 3.2]`, `P(Delta<=0)=15.7%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.1`, `300k +1.6`; validity stayed `100%`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=big_air_ramp,canyon_steps,climb_terrace,cold_start,dense_echo_climb,dense_sprint,drums_breath,drums_crescendo,drums_crosscut,drums_dropout,drums_pendulum,drums_pulse,drums_signature,drums_swell,drums_tide,drums_zigzag,float_bounds,glide_stairs,grain_staircase,leap_cadence,mini_burst,mixed_grade,opening_burst,pop_train,rhythm_ladder,ridge_pulse,rolling_drop,rolling_hills,skyline_push,soar_settle,solo_run,summit_push,switchback_pop,swoop_dive,syncopated_lift,syncopated_switchback,terrace_sprint,tiny_dance,valley_bounce,verse_chorus --archive-dir=generated/golden-runs/impact-local-cost-mature075-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: INCONCLUSIVE`; 40-spec scope headline `496.4 -> 497.2`, `Delta=+0.8`, 95% CI `[-0.7, 2.2]`, `P(Delta<=0)=14.9%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.0`, `300k +0.9`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: mature impact selection pressure is consistently direction-positive but not accepted. It improves the mature budgets without validity movement, but the effect is too small and row-mixed for canonical promotion.
- Status: bracketed upward to `1.0`, then reverted; no canonical run and no behavior commit.

## impact-local-cost-mature100-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: if the mature `0.75` endpoint is direction-positive but too weak, ramping impact cost to `1.0` may produce a clearer mature-budget selection gain.
- Code changes made: temporarily changed the mature extra impact cost weight from `0.25` to `0.5`, so local impact cost reached `1.0` by `200k`.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-local-cost-mature100-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `476.0 -> 477.0`, `Delta=+1.0`, 95% CI `[-1.3, 3.4]`, `P(Delta<=0)=20.4%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.2`, `300k +1.4`; validity stayed `100%`.
- Diagnostics: the stronger endpoint was slightly weaker/noisier than `0.75` on the focused slice, indicating over-selection. The `0.75` ramp is the better endpoint but still below the promotion threshold.
- Status: reverted after focused weaker signal; no canonical run and no behavior commit.

## impact-axisq-hard-01-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: local pools sometimes contain better hard-impact catches, but the normal cost-sorted prefix and forward rollout still walk away from them. Add a mature-budget `axisq` impact stream that samples a few extra contact-centered candidates with geometry impact raised to `0.95` and low-air geometry target halved, then let the existing true-score handoff ranker accept or reject them.
- Code changes made: temporarily added an `axisq` impact candidate stream in `scripts/v0/optimizer/handoff.ts`, with up to four extra normal-mode samples per high-impact mature quality-search gap, source-tagged as `axisq/impact`.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-axisq-hard-01-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `476.0 -> 475.7`, `Delta=-0.4`, 95% CI `[-2.4, 1.7]`, `P(Delta<=0)=66.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.7`, `300k -1.3`; validity stayed `100%`.
- Diagnostics: the broad stream helped `200k` slightly but regressed `300k`, consistent with extra hard/low-air candidates pulling the mature search into worse suffixes. The low-air geometry override was too intrusive.
- Status: narrowed to a smaller/no-air-override variant; no canonical run and no behavior commit.

## impact-axisq-hard-02-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: keep only hard-impact diversity by reducing the extra stream to at most two candidates and removing the low-air geometry override, so the ranker sees a few harder catches without changing air intent.
- Code changes made: temporarily changed the impact `axisq` stream to `HANDOFF_IMPACT_AXISQ_MAX_K = 2` and left geometry targets unchanged except for `impact: max(target, 0.95)`.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-axisq-hard-02-slice-01`
- Focused decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `476.0 -> 477.0`, `Delta=+0.9`, 95% CI `[-0.6, 2.8]`, `P(Delta<=0)=12.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.1`, `300k +1.3`; validity stayed `100%`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_signature,drums_pendulum,drums_crescendo,dense_sprint,syncopated_switchback,opening_burst,grain_staircase,rhythm_ladder,cold_start,mini_burst,tiny_dance,solo_run,verse_chorus,drums_swell,drums_crosscut,drums_tide,drums_dropout,drums_breath,drums_pulse,drums_zigzag,climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --archive-dir=generated/golden-runs/impact-axisq-hard-02-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: INCONCLUSIVE`; 40-spec scope headline `496.4 -> 496.7`, `Delta=+0.3`, 95% CI `[-0.8, 1.4]`, `P(Delta<=0)=31.6%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.3`, `300k +0.4`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: the narrowed stream is direction-positive on the focused slice but too small and diluted on full scope. Extra hard-impact samples may be a useful ingredient, but this form does not clear the decision threshold and consumes mature search budget.
- Status: reverted after full-scope inconclusive signal; no canonical run and no behavior commit.

## impact-analytic-angle10-slice-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: fixed high-impact angle shifts are crude; compute the contact tangent that would produce the requested normal-impact component from the incoming velocity, then blend a capped `10deg` mature-budget move toward the nearest analytic solution across the attempt span.
- Code changes made: temporarily added an analytic impact-angle helper in `scripts/v0/arc_placement.ts`, gated by high-impact pressure and a `150k..200k` mature ramp. It capped desired normal speed at `0.56 * enteringSpeed`, picked the closest tangent solution, and blended up to `10deg`.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-analytic-angle10-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a large negative point estimate; 20-spec intersection headline `476.0 -> 465.0`, `Delta=-11.1`, 95% CI `[-55.4, 8.3]`, `P(Delta<=0)=70.2%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -19.8`, `300k -10.8`; validity fell at `200k` (`100% -> 99%`) and stayed nominally `100%` at `300k`.
- Diagnostics: the analytic target was too aggressive for the current line family. It improved some high-pop sparse rows but damaged dense chains, pushed `drums_pendulum` scores lower, degraded opening rows, and made `drums_signature` seed `5` invalid at mature budget. Direct normal-impact targeting needs a more constrained geometry shape than rotating the whole contact tangent.
- Status: reverted after focused negative signal; no full preview, no canonical run, and no behavior commit.

## impact-bevel6x2-01

- Baseline used: `impact-midair-dense-lip14-01` behavior at commit `888da8a`.
- Hypothesis: the accepted mature dense lip improves the first post-contact segment, but the local fired surface can still be too shallow at the exact contact point. Add a tiny bevel line at the contact point only when the accepted lip is active, using twice the lip angle over `6px`, so mature hard-impact catches get a sharper immediate surface without rotating the whole ride-out curve.
- Code changes made: added `CONTACT_CENTERED_IMPACT_BEVEL_LENGTH_PX = 6` and `CONTACT_CENTERED_IMPACT_BEVEL_SHIFT_MULT = 2` in `scripts/v0/arc_placement.ts`; `sampleContactCenteredLines(...)` now inserts `buildImpactBevelLines(...)` between pre-contact and post-contact lines, and offsets subsequent line IDs accordingly. The bevel returns no line when `contactCenteredImpactLipShiftDeg(...)` is zero, so `50k` and `100k` behavior remain unchanged.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-bevel6x2-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `476.0 -> 478.3`, `Delta=+2.3`, 95% CI `[0.0, 5.1]`, `P(Delta<=0)=2.3%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +3.3`, `300k +2.7`; validity stayed `100%`.
- Full-spec preview command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_signature,drums_pendulum,drums_crescendo,dense_sprint,syncopated_switchback,opening_burst,grain_staircase,rhythm_ladder,cold_start,mini_burst,tiny_dance,solo_run,verse_chorus,drums_swell,drums_crosscut,drums_tide,drums_dropout,drums_breath,drums_pulse,drums_zigzag,climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --archive-dir=generated/golden-runs/impact-bevel6x2-fullslice-01`
- Full-spec preview decide result: indicative `VERDICT: ACCEPT`; 40-spec scope headline `496.4 -> 498.2`, `Delta=+1.7`, 95% CI `[0.1, 3.6]`, `P(Delta<=0)=2.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.5`, `300k +2.1`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-bevel6x2-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `496.4 -> 498.2`, `Delta=+1.7`, 95% CI `[0.1, 3.6]`, `P(Delta<=0)=2.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.5`, `300k +2.1`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: the bevel is a clean mature-budget geometry gain: it leaves early budgets byte-identical, keeps validity unchanged, and concentrates the lift at `200k/300k`. Worst canonical `300k` rows remain `drums_pendulum`, so the next impact work should target low-air pendulum residuals without adding more first-segment angle.
- Status: kept and committed; new canonical baseline is `impact-bevel6x2-01`.

## impact-bevel10x2-slice-01

- Baseline used: `impact-bevel6x2-01` behavior at commit `6dfa80c`.
- Hypothesis: extending the accepted mature dense impact bevel from `6px` to `10px` might give the local hard-catch surface enough length to reduce the remaining low-air hard-impact under-hit, while preserving the same activation gate and angle multiplier.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_BEVEL_LENGTH_PX` from `6` to `10` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-bevel10x2-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `478.3 -> 479.8`, `Delta=+1.5`, 95% CI `[-1.2, 5.1]`, `P(Delta<=0)=16.6%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.7`, `300k +1.4`; validity stayed `100%`.
- Diagnostics: the longer bevel is direction-positive but too noisy. It helps some mature dense rows but increases seed-level volatility in `drums_pendulum`; not enough signal to justify a full preview or canonical run.
- Status: bracketed down to `8px`, then reverted; no behavior commit.

## impact-bevel8x2-slice-01

- Baseline used: `impact-bevel6x2-01` behavior at commit `6dfa80c`.
- Hypothesis: if `10px` was direction-positive but too volatile, `8px` might keep the mature-budget lift with less pendulum variance.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_BEVEL_LENGTH_PX` from `6` to `8` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-bevel8x2-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `478.3 -> 477.7`, `Delta=-0.6`, 95% CI `[-3.0, 1.9]`, `P(Delta<=0)=69.9%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -1.1`, `300k -0.5`; validity stayed `100%`.
- Diagnostics: the `8px` midpoint was worse than both `6px` and `10px` on the focused slice, confirming that simply extending the bevel is not a stable residual lever.
- Status: reverted after focused negative signal; no full preview, no canonical run, and no behavior commit.

## impact-bevel6x25-slice-01

- Baseline used: `impact-bevel6x2-01` behavior at commit `6dfa80c`.
- Hypothesis: keep the accepted `6px` bevel length but make its local angle slightly steeper (`2.5x` the lip shift instead of `2x`) so hard-impact rows get a stronger immediate normal without lengthening the fired surface.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_BEVEL_SHIFT_MULT` from `2` to `2.5` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-bevel6x25-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `478.3 -> 473.8`, `Delta=-4.5`, 95% CI `[-21.2, 1.3]`, `P(Delta<=0)=84.0%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -12.5`, `300k -1.5`; validity stayed `100%`.
- Diagnostics: steepening the bevel is too aggressive. It preserves validity but damages mature quality, especially `200k`, so the accepted `2x` bevel angle remains the useful endpoint.
- Status: reverted after focused negative signal; no full preview, no canonical run, and no behavior commit.

## impact-lowair-hard-aircost15-slice-01

- Baseline used: `impact-bevel6x2-01` behavior at commit `6dfa80c`.
- Hypothesis: `drums_pendulum` low-air hard-impact gaps still show large air overshoot before the beat. Give local candidate cost extra `air` weight only when `air <= 0.25` and `impact >= 0.75`, so the existing pool prefers more grounded hard-impact candidates without changing geometry.
- Code changes made: temporarily added `LOCAL_LOW_AIR_HIGH_IMPACT_AIR_COST_WEIGHT = 1.5` in `scripts/v0/core/candidate.ts` and routed `axisCost(...)` through a helper that applied the extra weight only to `air` under the low-air/high-impact gate. The accepted `impact` local cost stayed at `0.5`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/core/candidate.ts').then(() => console.log('candidate import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-hard-aircost15-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `478.3 -> 479.3`, `Delta=+1.0`, 95% CI `[-2.4, 7.4]`, `P(Delta<=0)=39.5%`. Per-budget deltas: `50k -9.0`, `100k +11.0`, `200k +0.0`, `300k -0.1`; validity moved `50k 100% -> 99%` and stayed `100%` otherwise.
- Diagnostics: selection pressure on low-air hard-impact candidates is a noisy budget tradeoff, not a mature residual fix. It helps `100k`, but only by hurting `50k`, and leaves the targeted mature `drums_pendulum` rows essentially unchanged.
- Status: reverted after focused inconclusive signal; no full preview, no canonical run, and no behavior commit.

## impact-lowair-hard-aircost15-100k-slice-01

- Baseline used: `impact-bevel6x2-01` behavior at commit `6dfa80c`.
- Hypothesis: the ungated `1.5x` low-air/high-impact air-cost probe showed a real `100k` lift but hurt `50k`. Apply the same extra air weight through a triangular budget window that is zero at `50k`, full at `100k`, and zero again by `200k`, so scarce and mature budgets stay unchanged.
- Code changes made: temporarily added a candidate-side compile-budget setter in `scripts/v0/core/candidate.ts`, wired it from `compileHandoffInternal(...)`, and applied `LOCAL_LOW_AIR_HIGH_IMPACT_AIR_COST_EXTRA = 0.5` only through `hundredKPressure()`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "Promise.all([import('./scripts/v0/core/candidate.ts'), import('./scripts/v0/optimizer/handoff.ts')]).then(() => console.log('budgeted air cost imports ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-hard-aircost15-100k-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `478.3 -> 480.0`, `Delta=+1.7`, 95% CI `[-0.0, 9.2]`, `P(Delta<=0)=44.1%`. Per-budget deltas: `50k +0.0`, `100k +11.0`, `200k +0.0`, `300k +0.0`; validity stayed `100%`.
- Diagnostics: the budget window cleanly isolated the `100k` gain and removed the `50k` damage, but it still did not meet the decision bar and does nothing for the mature impact residual.
- Status: bracketed upward to `2.0x`, then reverted; no full preview, no canonical run, and no behavior commit.

## impact-lowair-hard-aircost20-100k-slice-01

- Baseline used: `impact-bevel6x2-01` behavior at commit `6dfa80c`.
- Hypothesis: if the budget-windowed `1.5x` air cost was clean but too weak, raising the active `100k` weight to `2.0x` might make the isolated `100k` signal promotable.
- Code changes made: temporarily changed `LOCAL_LOW_AIR_HIGH_IMPACT_AIR_COST_EXTRA` from `0.5` to `1.0` in the 100k-windowed helper, making the active low-air/high-impact air cost `2.0x` at `100k`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "Promise.all([import('./scripts/v0/core/candidate.ts'), import('./scripts/v0/optimizer/handoff.ts')]).then(() => console.log('budgeted air cost imports ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-hard-aircost20-100k-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `478.3 -> 480.0`, `Delta=+1.7`, 95% CI `[-0.0, 9.2]`, `P(Delta<=0)=38.7%`. Per-budget deltas: `50k +0.0`, `100k +11.2`, `200k +0.0`, `300k +0.0`; validity stayed `100%`.
- Diagnostics: the stronger endpoint barely improved the point estimate over `1.5x` and remained far from acceptance. The selection knob is useful information for future budget-specific work but not worth carrying as a non-mature headline micro-optimization.
- Status: reverted after focused inconclusive signal; no full preview, no canonical run, and no behavior commit.

## impact-lip-bevel-early125-01

- Baseline used: `impact-bevel6x2-01` behavior at commit `6dfa80c`.
- Hypothesis: the accepted dense lip/bevel is zero through `100k` and full only by `200k`, leaving a clean budget hole. Start the same accepted lip/bevel ramp at `75k` and finish by `125k`, so the mechanism is half-active at `100k`, unchanged at `50k`, and unchanged at mature budgets.
- Code changes made: in `scripts/v0/arc_placement.ts`, changed the `contactCenteredImpactLipShiftDeg(...)` mature pressure from `smoothstep((budget - 150k) / 50k)` to `smoothstep((budget - 75k) / 50k)`. The lip/bevel activation gates, angle, length, and mature endpoint are otherwise unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lip-bevel-early125-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `478.3 -> 481.1`, `Delta=+2.8`, 95% CI `[0.4, 10.4]`, `P(Delta<=0)=0.1%`. Per-budget deltas: `50k +0.0`, `100k +18.1`, `200k +0.0`, `300k +0.0`; validity stayed `100%`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-lip-bevel-early125-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `498.2 -> 500.0`, `Delta=+1.9`, 95% CI `[0.5, 6.1]`, `P(Delta<=0)=0.0%`. Per-budget deltas: `50k +0.0`, `100k +12.1`, `200k +0.0`, `300k +0.0`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: this is a clean budget-timing gain, not a new mature geometry gain. It promotes the already accepted dense lip/bevel earlier enough to help `100k`, while leaving `50k` and mature aggregate scores unchanged.
- Status: kept and committed; new canonical baseline is `impact-lip-bevel-early125-01`.

## impact-lip-bevel-early100-slice-01

- Baseline used: `impact-lip-bevel-early125-01` behavior at commit `8448668`.
- Hypothesis: if the accepted early dense lip/bevel ramp helps while half-active at `100k`, making it full-active at `100k` might add another small budget-timing gain while preserving `50k` and mature endpoints.
- Code changes made: temporarily changed the `contactCenteredImpactLipShiftDeg(...)` maturity pressure from `smoothstep((budget - 75k) / 50k)` to `smoothstep((budget - 50k) / 50k)`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lip-bevel-early100-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `481.1 -> 481.3`, `Delta=+0.2`, 95% CI `[-0.3, 0.6]`, `P(Delta<=0)=25.9%`. Per-budget deltas: `50k +0.0`, `100k +1.0`, `200k +0.0`, `300k +0.0`; validity stayed `100%`.
- Diagnostics: the endpoint change only added about one point at `100k` on the focused slice after the accepted half-active ramp had already captured the useful gain. The effect is direction-positive but too small to justify a canonical run.
- Status: reverted after focused inconclusive signal; no full preview, no canonical run, and no behavior commit.

## impact-midair-lip-air72-01

- Baseline used: `impact-lip-bevel-early125-01` behavior at commit `8448668`.
- Hypothesis: the accepted dense lip/bevel air gate (`smoothstep((0.65 - air) / 0.35)`) leaves hard `air ~= 0.60` landings almost untouched even though report diagnostics show near-zero achieved impact on those rows. Raise only the gate's air cutoff to `0.72`, keeping the same span and high-impact/dense/budget gates, so mid-air hard hits get a meaningful local surface shift while high-air opening rows around `0.82` remain inactive.
- Code changes made: added `CONTACT_CENTERED_IMPACT_DENSE_LIP_AIR_MAX = 0.72` and `CONTACT_CENTERED_IMPACT_DENSE_LIP_AIR_SPAN = 0.35` in `scripts/v0/arc_placement.ts`; `contactCenteredImpactLipShiftDeg(...)` now computes air pressure from those constants. Candidate counts, RNG draws, lip angle, bevel length, and budget ramp are otherwise unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-midair-lip-air72-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `481.1 -> 484.6`, `Delta=+3.5`, 95% CI `[0.5, 7.2]`, `P(Delta<=0)=1.1%`. Per-budget deltas: `50k +0.0`, `100k +2.6`, `200k +3.9`, `300k +4.1`; validity stayed `100%`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-midair-lip-air72-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `500.0 -> 505.1`, `Delta=+5.0`, 95% CI `[2.4, 8.1]`, `P(Delta<=0)=0.0%`. Per-budget deltas: `50k +0.0`, `100k +2.7`, `200k +5.8`, `300k +6.1`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: broadening to `0.72` captured the mid-air hard-impact residual without reproducing the earlier high-air broad-lip collapse. The gain is a clean quality lift at every non-50k budget and keeps `50k` byte-equivalent.
- Status: kept and committed; new canonical baseline is `impact-midair-lip-air72-01`.

## impact-midair-lip-air75-slice-01

- Baseline used: `impact-midair-lip-air72-01` behavior at commit `4580a08`.
- Hypothesis: if the accepted `0.72` air cutoff safely broadened the dense lip into mid-air hard-impact rows, a `0.75` cutoff might add more mature-budget lift while still excluding high-air opening targets near `0.82`.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_DENSE_LIP_AIR_MAX` from `0.72` to `0.75` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-midair-lip-air75-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `484.6 -> 485.3`, `Delta=+0.7`, 95% CI `[-6.6, 5.0]`, `P(Delta<=0)=29.5%`. Per-budget deltas: `50k +0.0`, `100k -10.7`, `200k +3.1`, `300k +3.0`; validity was reported unchanged by `decide`.
- Diagnostics: `0.75` does add mature-budget point-estimate lift, but it reintroduces a noisy mid-budget tradeoff and one raw `100k` invalid on the focused archive. The accepted `0.72` endpoint is the cleaner gate.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-midair-lip-air75-mature-01

- Baseline used: `impact-midair-lip-air72-01` behavior at commit `4580a08`.
- Hypothesis: flat `0.75` cutoff added mature-budget gains but hurt `100k`; ramp only the extra `0.03` cutoff from `150k..200k` so `50k/100k` keep the accepted `0.72` behavior and `200k/300k` get the mature lift.
- Code changes made: added mature extra air cutoff constants and a `contactCenteredImpactLipAirMax()` helper; `contactCenteredImpactLipShiftDeg(...)` now uses the budget-ramped air cutoff. Candidate counts, RNG draws, lip angle, bevel length, and the existing lip maturity ramp are otherwise unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-midair-lip-air75-mature-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `484.6 -> 487.0`, `Delta=+2.4`, 95% CI `[0.0, 5.3]`, `P(Delta<=0)=2.4%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +3.1`, `300k +3.0`; validity stayed `100%`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-midair-lip-air75-mature-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `505.1 -> 507.1`, `Delta=+2.1`, 95% CI `[0.4, 4.0]`, `P(Delta<=0)=0.7%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.9`, `300k +2.6`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Diagnostics: the budgeted cutoff keeps the flat `0.75` mature lift while removing the noisy `100k` regression from the ungated bracket. Raw canonical HEADLINE is `507.13`, with budget scores `50k 359.81`, `100k 490.38`, `200k 520.94`, `300k 528.07`.
- Status: kept and committed; new canonical baseline is `impact-midair-lip-air75-mature-01`.

## impact-midair-lip-air78-mature-slice-01

- Baseline used: `impact-midair-lip-air75-mature-01` behavior at commit `30ab8b8`.
- Hypothesis: hard-impact residuals still include a sizable `air=0.75..0.78` band, while the known opening-burst danger rows mostly sit above `0.78`. Increase only the mature extra cutoff from `0.03` to `0.06`, so `50k/100k` stay on the accepted `0.72` behavior and mature budgets reach `0.78`.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_DENSE_LIP_MATURE_AIR_EXTRA` from `0.03` to `0.06`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-midair-lip-air78-mature-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `487.0 -> 486.0`, `Delta=-1.0`, 95% CI `[-4.0, 1.7]`, `P(Delta<=0)=75.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.0`, `300k -2.1`; validity stayed `100%`.
- Diagnostics: the extra high-air reach does not pay after the accepted `0.75` mature endpoint. It keeps early budgets byte-identical but erodes mature quality, with raw focused `300k` dropping from `502.68` to `500.62`.
- Status: reverted after focused inconclusive/negative signal; no canonical run and no behavior commit.

## impact-search-lane1-slice-01

- Baseline used: `impact-midair-lip-air75-mature-01` behavior at commit `30ab8b8`.
- Hypothesis: a single alternate deterministic search lane might provide a budget-honest improvement if the public seed's default candidate stream is unlucky on impact-heavy rows. Use the portfolio oracle's lane-1 seed transform as the default internal `searchSeed`, leaving public golden seeds and target jitter unchanged.
- Code changes made: temporarily added `DEFAULT_SEARCH_LANE = 1` in `scripts/v0/optimizer/handoff.ts` and used a deterministic lane transform when `opts.searchSeed` was not explicitly provided.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-search-lane1-slice-01`
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `487.0 -> 482.7`, `Delta=-4.3`, 95% CI `[-11.4, 2.0]`, `P(Delta<=0)=90.4%`. Per-budget deltas: `50k -27.3`, `100k -3.3`, `200k -2.0`, `300k -2.3`; validity regressed at `50k` (`100% -> 98%`) and stayed `100%` elsewhere.
- Diagnostics: lane 1 produced broad candidate-stream churn but was globally worse than the public-seed lane. A fixed alternate lane is not a useful default; any portfolio benefit would need an actual budget-honest selector rather than replacing lane 0.
- Status: reverted after focused reject; no canonical run and no behavior commit.

## impact-highair-bevel6-01

- Baseline used: `impact-midair-lip-air75-mature-01` behavior at commit `30ab8b8`.
- Hypothesis: previous high-air lip probes rotated the ride-out and caused carry-speed volatility. Add a mature-only high-air bevel line instead, so hard/dense targets in the `air ~= 0.75..0.82` band get a sharper immediate contact surface while `firstPostAngleDeg` remains tied only to the accepted lip shift.
- Code changes made: temporarily added high-air bevel band constants and `contactCenteredImpactHighAirBevelShiftDeg(...)`; `impactBevelShiftDeg` used `max(accepted lip shift, high-air bevel shift)` for the bevel line, while post-contact lip shift stayed unchanged. Endpoint bracketed from `3deg` to `6deg`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- `3deg` focused result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `487.0 -> 487.1`, `Delta=+0.1`, 95% CI `[-1.2, 1.6]`, `P(Delta<=0)=41.3%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.2`; validity stayed `100%`.
- `6deg` focused result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `487.0 -> 488.3`, `Delta=+1.3`, 95% CI `[-0.7, 4.0]`, `P(Delta<=0)=12.4%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.7`, `300k +1.7`; validity stayed `100%`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-highair-bevel6-01`
- Canonical decide result: `VERDICT: INCONCLUSIVE`; headline `507.1 -> 508.0`, `Delta=+0.9`, 95% CI `[-0.4, 2.5]`, `P(Delta<=0)=10.1%`, effect `1.17`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.2`, `300k +1.1`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Raw canonical scores: headline `508.02`, with budget scores `50k 359.81`, `100k 490.38`, `200k 522.12`, `300k 529.21`.
- Diagnostics: bevel-only high-air shaping is direction-positive and preserves validity/early budgets, but canonical `P(Delta<=0)=10.1%` missed the accept threshold. Treat as a live lead for a tighter gate or larger-seed follow-up, but do not promote this source behavior.
- Status: reverted after canonical inconclusive; no behavior commit.

## impact-angle-dense-lowbudget-extra-slice-01

- Baseline used: `impact-midair-lip-air75-mature-01` behavior at commit `30ab8b8`.
- Hypothesis: the old 50k-only extra impact-angle probe predated the accepted sparse-room angle extra. Retest a safer current-baseline version that adds the extra `1deg` only on dense gaps at scarce budget, fading from full at `50k` to zero by `100k`, so sparse gaps stay at the accepted `4deg` instead of jumping to `5deg`.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_DENSE_LOW_BUDGET_EXTRA_SHIFT_DEG = 1` in `scripts/v0/arc_placement.ts` and included `(1 - room) * (1 - smoothstep((budget - 50k) / 50k))` in `contactCenteredImpactAngleShiftDeg(...)`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=solo_run,drums_crescendo,drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,verse_chorus,drums_swell,drums_tide,cold_start,big_air_ramp,pop_train,leap_cadence,skyline_push --archive-dir=generated/golden-runs/impact-angle-dense-lowbudget-extra-slice-01`
- Raw focused scores: headline `460.43`, with budget scores `50k 282.54` valid `228/240`, `100k 441.91` valid `239/240`, `200k 477.99` valid `240/240`, `300k 484.55` valid `240/240`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `459.8 -> 460.4`, `Delta=+0.6`, 95% CI `[-2.8, 4.4]`, `P(Delta<=0)=34.5%`. Per-budget deltas: `50k +7.9`, `100k +0.0`, `200k +0.0`, `300k +0.0`; focused `50k` validity regressed from `97%` to `95%`.
- Diagnostics: dense-only gating removed the previous `100k` regression, but the 50k quality gain is too noisy and comes with a worse pass rate on the focused invalid-heavy slice. This is not worth a canonical run.
- Status: reverted after focused inconclusive/validity-negative signal; no canonical run and no behavior commit.

## impact-high82-bevel6-01

- Baseline used: `impact-midair-lip-air75-mature-01` behavior at commit `30ab8b8`.
- Hypothesis: the broad high-air bevel probe was direction-positive but touched the noisy `.75..78` band. Add a tighter mature-only bevel line that starts after `air=0.80`, preserving the accepted ride-out (`firstPostAngleDeg` still uses only the dense lip shift) and affecting only very high-air dense hard-impact rows.
- Code changes made: added `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_*` constants and `contactCenteredImpactHighAirBevelShiftDeg(...)` in `scripts/v0/arc_placement.ts`; `impactBevelShiftDeg` now uses `max(accepted lip shift, high82 bevel shift)` for the bevel line while post-contact lip shift remains unchanged. Endpoint bracketed from `4deg` to `6deg`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed for both brackets.
- `4deg` focused result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `487.0 -> 487.9`, `Delta=+0.9`, 95% CI `[-1.0, 3.3]`, `P(Delta<=0)=13.2%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.2`, `300k +1.1`; validity stayed `100%`.
- `6deg` focused result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `487.0 -> 488.6`, `Delta=+1.6`, 95% CI `[0.0, 4.4]`, `P(Delta<=0)=2.3%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.7`, `300k +2.4`; validity stayed `100%`.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-high82-bevel6-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `507.1 -> 508.3`, `Delta=+1.2`, 95% CI `[0.1, 2.8]`, `P(Delta<=0)=1.0%`, effect `1.67`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.2`, `300k +1.7`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Raw canonical scores: headline `508.32`, with budget scores `50k 359.81`, `100k 490.38`, `200k 522.18`, `300k 529.80`.
- Diagnostics: the tighter high-air gate keeps the earlier bevel-only mechanism but avoids the low/mid high-air band that made the broad probe noisy. It is a clean mature-budget lift, byte-identical at `50k/100k`, with unchanged validity.
- Status: kept and committed; new canonical baseline is `impact-high82-bevel6-01`.

## impact-lip-room56-mature-slice-01

- Baseline used: `impact-high82-bevel6-01` behavior at commit `9c6696c`.
- Hypothesis: after the high82 bevel, remaining hard-impact residuals concentrate in `26..36` frame next-contact gaps where the accepted dense lip room pressure is already fading. Extend only the dense lip's mature room falloff from sparse `46f` to `56f`, leaving `50k/100k` and the accepted high82 bevel gate unchanged.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_DENSE_LIP_MATURE_SPARSE_FRAMES = 56` in `scripts/v0/arc_placement.ts`; `contactCenteredImpactLipShiftDeg(...)` lerped the dense pressure from the accepted `26..46f` falloff to `26..56f` over the `150k..200k` mature ramp.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lip-room56-mature-slice-01`
- Raw focused scores: headline `488.89`, with budget scores `50k 392.42`, `100k 472.45`, `200k 496.51`, `300k 505.37`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `488.6 -> 488.9`, `Delta=+0.3`, 95% CI `[-1.7, 2.4]`, `P(Delta<=0)=34.6%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.6`, `300k +0.3`; validity unchanged.
- Diagnostics: extending the mature room falloff did move the intended mature budgets slightly, but the effect is far smaller than the accepted high82 bevel and too row-mixed for a canonical run.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-repair-min50-slice-01

- Baseline used: `impact-high82-bevel6-01` behavior at commit `9c6696c`.
- Hypothesis: some 50k invalid rows might have a complete-but-weak incumbent early enough for suffix repair to help. Lower `LR_REPAIR_MIN_BUDGET` from the default `100k` to `50k` as an env-gated probe before considering any source default change.
- Code changes made: none; ran with `LR_REPAIR_MIN_BUDGET=50000`.
- Probe command: `LR_ENGINE=wasm LR_REPAIR_MIN_BUDGET=50000 npm run golden -- --jobs=32 --specs=solo_run,drums_crescendo,drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,verse_chorus,drums_swell,drums_tide,cold_start,big_air_ramp,pop_train,leap_cadence,skyline_push --archive-dir=generated/golden-runs/impact-repair-min50-slice-01`
- Raw focused scores: headline `461.76`, with budget scores `50k 272.05` valid `227/240`, `100k 441.91` valid `239/240`, `200k 480.27` valid `240/240`, `300k 487.66` valid `240/240`.
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `462.0 -> 461.8`, `Delta=-0.2`, 95% CI `[-0.5, 0.0]`, `P(Delta<=0)=96.0%`. Per-budget deltas: `50k -2.5`, `100k +0.0`, `200k +0.0`, `300k +0.0`; focused `50k` validity regressed from `97%` to `95%`.
- Diagnostics: the existing source comment is correct for impact-era behavior too: carving repair budget at `50k` steals from scarce completion and worsens the exact invalid-heavy slice. Keep the repair gate at `100k`.
- Status: rejected after focused signal; no source change and no canonical run.

## impact-high82-bevel8-slice-01

- Baseline used: `impact-high82-bevel6-01` behavior at commit `9c6696c`.
- Hypothesis: the accepted high82 bevel endpoint may still be conservative in the very-high-air dense hard-impact rows. Increase only `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_SHIFT_DEG` from `6` to `8`, leaving the accepted `air=0.80..0.84` gate, mature budget ramp, dense gap gate, and post-contact ride-out unchanged.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_SHIFT_DEG` from `6` to `8` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-high82-bevel8-slice-01`
- Raw focused scores: headline `489.51`, with budget scores `50k 392.42`, `100k 472.45`, `200k 497.38`, `300k 506.13`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `488.6 -> 489.5`, `Delta=+0.9`, 95% CI `[-0.8, 3.9]`, `P(Delta<=0)=21.4%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.4`, `300k +1.1`; validity unchanged.
- Diagnostics: the larger endpoint is direction-positive but less decisive than the accepted `6deg` bracket and shows enough row churn that a canonical run is not justified. Keep the accepted endpoint at `6deg`.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-high78-bevel6-slice-01

- Baseline used: `impact-high82-bevel6-01` behavior at commit `9c6696c`.
- Hypothesis: the accepted `air=0.80..0.84` high82 bevel misses much of the worst hard-impact residual bucket at target `air=0.78..0.82`. Start the same mature-only bevel gate at `0.78` while keeping the `0.04` span and `6deg` endpoint, so it reaches full strength by `0.82` without changing the accepted post-contact ride-out.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_START` from `0.80` to `0.78` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-high78-bevel6-slice-01`
- Raw focused scores: headline `489.41`, with budget scores `50k 392.42`, `100k 472.45`, `200k 496.87`, `300k 506.25`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `488.6 -> 489.4`, `Delta=+0.8`, 95% CI `[-0.6, 3.7]`, `P(Delta<=0)=21.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.9`, `300k +1.2`; validity unchanged.
- Diagnostics: lowering the start is direction-positive but no stronger than the rejected `8deg` endpoint bracket, and it reintroduces extra row churn below the accepted high82 gate. Keep the accepted `0.80` start.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-lip-airspan25-mature-01

- Baseline used: `impact-high82-bevel6-01` behavior at commit `9c6696c`.
- Hypothesis: the accepted dense lip air cutoff was broadened to `0.75` at mature budgets, but its `0.35` pressure span still leaves the large `air ~= 0.50..0.65`, dense, hard-impact bucket only partially active. Narrow only the mature dense-lip air-pressure span from `0.35` to `0.25`, preserving `50k/100k` behavior and keeping the accepted high82 bevel unchanged.
- Code changes made: added `CONTACT_CENTERED_IMPACT_DENSE_LIP_MATURE_AIR_SPAN = 0.25` and a `contactCenteredImpactLipAirSpan()` helper in `scripts/v0/arc_placement.ts`; `contactCenteredImpactLipShiftDeg(...)` now lerps the air-pressure span from the accepted `0.35` to `0.25` over the existing `150k..200k` mature ramp. Candidate counts, RNG draws, lip angle, bevel length, air cutoff, and high82 bevel behavior are otherwise unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lip-airspan25-mature-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `488.6 -> 490.2`, `Delta=+1.6`, 95% CI `[-0.8, 4.2]`, `P(Delta<=0)=9.4%`, effect `1.24`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.9`, `300k +2.2`; validity unchanged.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-lip-airspan25-mature-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `508.3 -> 511.3`, `Delta=+3.0`, 95% CI `[0.8, 5.6]`, `P(Delta<=0)=0.3%`, effect `2.43`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +3.8`, `300k +4.0`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Raw canonical scores: headline `511.33`, with budget scores `50k 359.81`, `100k 490.38`, `200k 526.01`, `300k 533.78`.
- Diagnostics: this keeps the accepted early-budget path byte-identical while making the mature dense lip more assertive in the mid-air hard-impact bucket that dominated the residuals. The canonical lift is larger than the high82 bevel and cleanly concentrated at `200k/300k`.
- Status: kept and committed; new canonical baseline is `impact-lip-airspan25-mature-01`.

## impact-lip-airspan20-mature-01

- Baseline used: `impact-lip-airspan25-mature-01` behavior at commit `94d1919`.
- Hypothesis: the accepted mature air-span narrowing helped the largest `air ~= 0.50..0.65` dense hard-impact bucket but left it materially under target. Narrow the same mature-only dense lip air-pressure span one more step, from `0.25` to `0.20`, preserving the accepted cutoff, high82 bevel, and byte-identical `50k/100k` behavior.
- Code changes made: changed `CONTACT_CENTERED_IMPACT_DENSE_LIP_MATURE_AIR_SPAN` from `0.25` to `0.20` in `scripts/v0/arc_placement.ts`. The helper, budget ramp, candidate counts, RNG draws, lip angle, bevel length, and high82 bevel are otherwise unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lip-airspan20-mature-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `490.2 -> 492.0`, `Delta=+1.8`, 95% CI `[-0.7, 4.8]`, `P(Delta<=0)=8.0%`, effect `1.31`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.6`, `300k +2.2`; validity unchanged.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-lip-airspan20-mature-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `511.3 -> 512.7`, `Delta=+1.3`, 95% CI `[-0.5, 3.3]`, `P(Delta<=0)=7.3%`, effect `1.39`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.6`, `300k +1.8`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Raw canonical scores: headline `512.66`, with budget scores `50k 359.81`, `100k 490.38`, `200k 527.62`, `300k 535.60`.
- Diagnostics: the stronger mature pressure keeps early budgets unchanged and adds another accepted mature-budget lift. The confidence is weaker than the first span change but still passes canonical decide; `0.20` becomes the current endpoint until a bracket shows over-tightening.
- Status: kept and committed; new canonical baseline is `impact-lip-airspan20-mature-01`.

## impact-lip-airspan15-mature-slice-01

- Baseline used: `impact-lip-airspan20-mature-01` behavior at commit `a62b965`.
- Hypothesis: the accepted `0.20` mature dense-lip air-pressure span still leaves the largest `air ~= 0.50..0.65` dense hard-impact bucket under target. Tighten the same mature-only span to `0.15` to bracket whether the useful pressure endpoint is still lower.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_DENSE_LIP_MATURE_AIR_SPAN` from `0.20` to `0.15` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lip-airspan15-mature-slice-01`
- Raw focused scores: headline `492.08`, with budget scores `50k 392.42`, `100k 472.45`, `200k 500.57`, `300k 509.58`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `492.0 -> 492.1`, `Delta=+0.1`, 95% CI `[-2.2, 2.4]`, `P(Delta<=0)=46.9%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.1`, `300k +0.2`; validity unchanged.
- Diagnostics: the extra tightening adds churn without aggregate lift. The useful mature air-span endpoint is `0.20` for now; further narrowing is saturated/noisy.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-lip-air77-span20-mature-slice-01

- Baseline used: `impact-lip-airspan20-mature-01` behavior at commit `a62b965`.
- Hypothesis: after the accepted span20 change, the next largest dense hard-impact residual is target `air=0.72..0.75`, which the accepted mature cutoff at `0.75` barely activates. Raise only the mature cutoff extra from `0.03` to `0.05` so the mature lip reaches `air=0.77`, while keeping `50k/100k`, span20, and high82 bevel behavior unchanged.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_DENSE_LIP_MATURE_AIR_EXTRA` from `0.03` to `0.05` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lip-air77-span20-mature-slice-01`
- Raw focused scores: headline `491.63`, with budget scores `50k 392.42`, `100k 472.45`, `200k 500.27`, `300k 508.81`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `492.0 -> 491.6`, `Delta=-0.4`, 95% CI `[-2.9, 2.3]`, `P(Delta<=0)=61.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.2`, `300k -0.6`; validity unchanged.
- Diagnostics: even a smaller current-baseline cutoff extension reintroduces churn without a mature-budget lift. Keep the mature cutoff at `0.75`; the high-air/mid-high residual needs a different mechanism than extending the first-segment lip gate.
- Status: reverted after focused negative/inconclusive signal; no canonical run and no behavior commit.

## impact-mid75-bevel4-slice-01

- Baseline used: `impact-lip-airspan20-mature-01` behavior at commit `a62b965`.
- Hypothesis: the target `air=0.72..0.75` dense hard-impact residual might need bevel-only shaping rather than more first-segment lip rotation. Add a mature-only `4deg` mid-air bevel band that is active around `air=0.72..0.77` and fades before the accepted high82 bevel region, while keeping post-contact ride-out tied to the accepted lip.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_MID_AIR_BEVEL_*` constants and `contactCenteredImpactMidAirBevelShiftDeg(...)` in `scripts/v0/arc_placement.ts`; `impactBevelShiftDeg` used the max of accepted lip, temporary mid-air bevel, and accepted high82 bevel shifts.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-mid75-bevel4-slice-01`
- Raw focused scores: headline `491.68`, with budget scores `50k 392.42`, `100k 472.45`, `200k 500.49`, `300k 508.76`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `492.0 -> 491.7`, `Delta=-0.3`, 95% CI `[-2.7, 2.2]`, `P(Delta<=0)=62.7%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.0`, `300k -0.7`; validity unchanged.
- Diagnostics: the mid-air bevel adds the intended mature-only surface option but does not improve aggregate quality. Combined with the air77 lip result, this suggests the `.72..75` residual is not solved by more local hard-catch geometry.
- Status: reverted after focused negative/inconclusive signal; no canonical run and no behavior commit.

## impact-local-cost-mature075-current-slice-01

- Baseline used: `impact-lip-airspan20-mature-01` behavior at commit `a62b965`.
- Hypothesis: after the accepted lip/bevel/span geometry, the pool may contain better hard-impact mature candidates than the local sort promotes. Re-test the mature-only local impact cost ramp (`0.5 -> 0.75` over `150k..200k`) on the current baseline, preserving `50k/100k` behavior and adding no samples.
- Code changes made: temporarily exported a compile-budget mature pressure helper from `scripts/v0/arc_placement.ts` and used it in `scripts/v0/core/candidate.ts` to add `0.25 * maturePressure` to the local `impact` axis cost weight.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "Promise.all([import('./scripts/v0/arc_placement.ts'), import('./scripts/v0/core/candidate.ts')]).then(() => console.log('imports ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-local-cost-mature075-current-slice-01`
- Raw focused scores: headline `492.89`, with budget scores `50k 392.42`, `100k 472.45`, `200k 501.34`, `300k 510.81`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `492.0 -> 492.9`, `Delta=+0.9`, 95% CI `[-1.5, 3.9]`, `P(Delta<=0)=26.4%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.9`, `300k +1.4`; validity unchanged.
- Diagnostics: the current stronger geometry keeps the mature local-cost pressure direction-positive, but the effect is still too small and noisy to promote. Mature selection pressure is not enough by itself to clear the remaining low-air/impact residual.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-lowair-release-grounded-slice-01

- Baseline used: `impact-lip-airspan20-mature-01` behavior at commit `a62b965`.
- Hypothesis: the worst low-air/high-impact rows need grounded continuity after the catch, not just a harder local surface. Add a mature quality-phase ranking penalty for candidates that have fewer than six grounded frames immediately after a low-air/high-impact tight-cadence landing, using existing release-grounded telemetry.
- Code changes made: temporarily added a `releaseGroundedSetupPenalty(...)` in `scripts/v0/optimizer/handoff.ts`, gated by current gap `air <= 0.35`, `impact >= 0.75`, next-contact cadence, and a `150k..200k` budget ramp. Candidate counts, geometry, scorer, specs, and early budgets were unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-release-grounded-slice-01`
- Raw focused scores: headline `491.99`, with budget scores `50k 392.42`, `100k 472.45`, `200k 500.49`, `300k 509.43`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with exact neutral scoring; 20-spec intersection headline `492.0 -> 492.0`, `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget deltas were `+0.0` at every budget; validity unchanged.
- Diagnostics: the release-grounded penalty did not alter selected scored outputs on the focused slice. The low-air continuity problem is not reachable through this release telemetry term at the tested strength/gate.
- Status: reverted after focused no-op signal; no canonical run and no behavior commit.

## impact-high78-bevel8-localcost075-01

- Baseline used: `impact-lip-airspan20-mature-01` behavior at commit `a62b965`.
- Hypothesis: two current-baseline mechanisms were direction-positive but too small alone: a mature local impact-cost ramp and a stronger very-high-air impact bevel. Combine them, and widen the bevel gate only to the adjacent `air=0.78..0.82` band, so `50k/100k` stay byte-identical while mature hard-impact candidates get both better surface options and slightly stronger local selection.
- Code changes made: changed `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_SHIFT_DEG` from `6` to `8` and `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_START` from `0.80` to `0.78` in `scripts/v0/arc_placement.ts`; added a candidate-side compile-budget setter in `scripts/v0/core/candidate.ts` and wired it from `compileHandoffInternal(...)`; local impact cost now ramps smoothly from `0.5` to `0.75` over `150k..200k`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "Promise.all([import('./scripts/v0/arc_placement.ts'), import('./scripts/v0/core/candidate.ts'), import('./scripts/v0/optimizer/handoff.ts')]).then(() => console.log('combo imports ok'))"` passed.
- Bracket probe: `impact-bevel8-localcost075-slice-01` kept the accepted `air=0.80..0.84` bevel gate. Focused decide was indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `492.0 -> 493.3`, `Delta=+1.3`, 95% CI `[-1.6, 5.0]`, `P(Delta<=0)=21.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.8`, `300k +1.7`; validity unchanged.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-high78-bevel8-localcost075-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `492.0 -> 494.6`, `Delta=+2.6`, 95% CI `[-0.9, 7.2]`, `P(Delta<=0)=9.0%`, effect `1.24`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +3.2`, `300k +3.5`; validity unchanged.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-high78-bevel8-localcost075-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `512.7 -> 514.8`, `Delta=+2.2`, 95% CI `[-0.0, 5.0]`, `P(Delta<=0)=2.7%`, effect `1.73`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +3.0`, `300k +2.7`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Raw canonical scores: headline `514.85`, with budget scores `50k 359.81`, `100k 490.38`, `200k 530.62`, `300k 538.33`.
- Diagnostics: the accepted lift is entirely mature-budget quality, not validity. The `0.80` gate bracket was too weak; adding the adjacent high-air band made the combined mechanism promotable without changing low budgets. Worst `300k` rows remain `drums_pendulum`, so the next residual still needs a larger low-air/high-impact search or trajectory lever.
- Status: kept and committed; new canonical baseline is `impact-high78-bevel8-localcost075-01`.

## impact-high78-bevel10-localcost075-slice-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: after the `8deg` high78 bevel endpoint accepted canonically, a `10deg` endpoint might continue the same mature high-air hard-impact lift without changing the accepted gate, local cost ramp, or early budgets.
- Code changes made: temporarily changed `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_SHIFT_DEG` from `8` to `10` in `scripts/v0/arc_placement.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "Promise.all([import('./scripts/v0/arc_placement.ts'), import('./scripts/v0/core/candidate.ts'), import('./scripts/v0/optimizer/handoff.ts')]).then(() => console.log('bevel10 imports ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-high78-bevel10-localcost075-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `494.6 -> 494.8`, `Delta=+0.2`, 95% CI `[-2.6, 2.8]`, `P(Delta<=0)=38.8%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.6`, `300k +0.1`; validity unchanged.
- Diagnostics: the stronger endpoint adds churn without meaningful aggregate lift. The accepted `8deg` endpoint remains the current high78 bevel setting.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-high78-bevel8-localcost100-slice-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: after the combined high78 bevel plus local impact-cost ramp accepted, increasing the mature local impact-cost endpoint from `0.75` to `1.0` might promote more hard-impact candidates without additional geometry.
- Code changes made: temporarily changed `LOCAL_IMPACT_COST_MATURE_EXTRA` from `0.25` to `0.5` in `scripts/v0/core/candidate.ts`, so mature local impact cost reached `1.0`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "Promise.all([import('./scripts/v0/arc_placement.ts'), import('./scripts/v0/core/candidate.ts'), import('./scripts/v0/optimizer/handoff.ts')]).then(() => console.log('localcost100 imports ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-high78-bevel8-localcost100-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `494.6 -> 494.9`, `Delta=+0.3`, 95% CI `[-1.6, 2.3]`, `P(Delta<=0)=39.1%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.7`, `300k +0.1`; validity unchanged.
- Diagnostics: the stronger local selection endpoint creates broad row churn with almost no mature headline gain. Keep the accepted `0.75` endpoint.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-repair-upstream8-current-slice-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: remaining `drums_pendulum` failures have known alternate search-lane headroom, and the default repair upstream walk of `4` gaps may not restart early enough to escape the first-complete basin. As an env-only probe, raise `LR_REPAIR_MAX_UPSTREAM` to `8` to let suffix repair walk farther upstream when a weak gap reconverges.
- Code changes made: none; ran with `LR_REPAIR_MAX_UPSTREAM=8`.
- Probe command: `LR_ENGINE=wasm LR_REPAIR_MAX_UPSTREAM=8 npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-repair-upstream8-current-slice-01`
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with a negative point estimate; 20-spec intersection headline `494.6 -> 494.4`, `Delta=-0.2`, 95% CI `[-1.5, 1.0]`, `P(Delta<=0)=60.6%`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.1`, `300k -0.3`; validity unchanged.
- Diagnostics: broader upstream repair did not expose the full-lane pendulum headroom and slightly hurt mature aggregate quality. The default upstream walk stays at `4`.
- Status: env-only inconclusive/negative; no source change and no canonical run.

## impact-next-lowair-release-grounded-slice-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: the previous release-grounded probe was current-gap gated and did not alter selections. Reframe the same continuity idea causally: penalize candidates with fewer than eight grounded frames after the current catch only when the next contact asks for both low air and high impact, using mature/full-feedback pressure so early budgets and unrelated rows stay untouched.
- Code changes made: temporarily added a `releaseGroundedSetupPenalty(...)` in `scripts/v0/optimizer/handoff.ts`, gated by next-gap low-air pressure, next-gap high-impact pressure (`impact` from `0.75..0.90`), an eight-frame grounded target, and the existing `150k` mature/full-feedback fades. Candidate counts, geometry, scorer, specs, and budget grid were unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-next-lowair-release-grounded-slice-01`
- Raw focused scores: headline `494.59`, with budget scores `50k 392.42`, `100k 472.45`, `200k 503.71`, `300k 512.91`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE` with exact neutral scoring; 20-spec intersection headline `494.6 -> 494.6`, `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget deltas were `+0.0` at every budget; validity unchanged.
- Diagnostics: even the next-gap low-air/high-impact gate with a higher grounded-frame target did not alter selected scored outputs on the focused slice. This release telemetry path appears selection-inert at the tested deterministic strength/gate, so the remaining impact residual likely needs a non-release-grounded lever.
- Status: reverted after focused no-op signal; no canonical run and no behavior commit.

## impact-highimpact-speedboost055-slice-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: accepted canonical reports show both impact and speed are one-sided under target, and hard impact is physically speed-limited. Add a mature high-impact geometry-only speed boost of up to `0.55 px/frame` inside the contact-centered target speed used by energy launch and its roll guide, leaving the scorer and local authored speed targets unchanged so over-fast candidates can still lose ranking.
- Code changes made: temporarily added `contactCenteredImpactTargetSpeedPx(...)` in `scripts/v0/arc_placement.ts`, gated by `impact` from `0.65..0.90` and a `150k..200k` budget ramp, capped at `authoredSpeedToPx(1) + 0.45`. The boosted target speed was used only in `sampleContactCenteredLines(...)` and `guideContactCenteredRolls(...)`. Candidate counts, RNG draws, scorer, specs, and budget grid were unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "Promise.all([import('./scripts/v0/arc_placement.ts'), import('./scripts/v0/core/candidate.ts'), import('./scripts/v0/optimizer/handoff.ts')]).then(() => console.log('speedboost imports ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-highimpact-speedboost055-slice-01`
- Raw focused scores: headline `485.70`, with budget scores `50k 392.42`, `100k 472.45`, `200k 492.99`, `300k 500.80`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `494.6 -> 485.7`, `Delta=-8.9`, 95% CI `[-14.1, -3.9]`, `P(Delta<=0)=99.9%`, effect `-3.40`. Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -10.7`, `300k -12.1`; validity unchanged.
- Diagnostics: simply over-targeting speed for hard-impact geometry destroys mature quality even though speed/impact residuals are one-sided. The energy-launch speed target is too coupled to continuation quality; do not repeat this direction without a much narrower gate or a selection mechanism that proves the faster candidates help locally and survive downstream.
- Status: reverted after focused reject; no canonical run and no behavior commit.

## impact-high78-bevel8-early125-localcost075-slice-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: the accepted high78 high-air bevel is still zero through `100k` and full only at `200k+`, unlike the older dense lip/bevel ramp that accepted an earlier `75k..125k` timing. Move only the high-air bevel ramp to `75k..125k`, leaving `50k`, mature endpoints, the air gate, bevel endpoint, local impact cost, scorer, specs, and budget grid unchanged.
- Code changes made: temporarily added `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_START_FRAMES = 75_000` and `CONTACT_CENTERED_IMPACT_HIGH_AIR_BEVEL_SPAN_FRAMES = 50_000` in `scripts/v0/arc_placement.ts`; `contactCenteredImpactHighAirBevelShiftDeg(...)` used those constants instead of the accepted inline `150k..200k` ramp.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('highair bevel timing import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-high78-bevel8-early125-localcost075-slice-01`
- Raw focused scores: headline `494.67`, with budget scores `50k 392.42`, `100k 472.99`, `200k 503.71`, `300k 512.91`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `494.6 -> 494.7`, `Delta=+0.1`, 95% CI `[-0.3, 0.5]`, `P(Delta<=0)=30.6%`, effect `0.39`. Per-budget deltas: `50k +0.0`, `100k +0.5`, `200k +0.0`, `300k +0.0`; validity unchanged.
- Diagnostics: the earlier high-air bevel timing isolates a tiny `100k` point-estimate lift, but the effect is too small to promote and has no mature-budget value. Keep the accepted `150k..200k` high-air bevel ramp.
- Status: reverted after focused inconclusive signal; no canonical run and no behavior commit.

## impact-air-overshoot24-slice-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: accepted reports show very low-air targets still overshoot air while hard impact under-hits. Increase the existing handoff asymmetric air overshoot penalty from `16` to `24` so already-generated candidates with achieved air above target lose more ranking pressure, without changing geometry, candidate counts, scorer, specs, or budget grid.
- Code changes made: temporarily changed `HANDOFF_AXIS_OVERSHOOT_WEIGHTS.air` from `16` to `24` in `scripts/v0/optimizer/handoff.ts`.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-air-overshoot24-slice-01`
- Raw focused scores: headline `494.36`, with budget scores `50k 389.48`, `100k 472.45`, `200k 503.71`, `300k 512.91`; validity stayed `239/240` at `50k` and `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `494.6 -> 494.4`, `Delta=-0.2`, 95% CI `[-0.6, 0.1]`, `P(Delta<=0)=90.7%`, effect `-1.23`. Per-budget deltas: `50k -2.9`, `100k +0.0`, `200k +0.0`, `300k +0.0`; validity unchanged.
- Diagnostics: the stronger air overshoot penalty did not affect mature selected outputs and only hurt scarce-budget ranking. Keep the accepted `air: 16` handoff overshoot weight.
- Status: reverted after focused reject; no canonical run and no behavior commit.

## impact-entry-bevel20-01

- Baseline used: `impact-high78-bevel8-localcost075-01` behavior at commit `8446817`.
- Hypothesis: worst accepted reports showed low-air/high-impact contacts often landed on the final pre-contact approach line, whose tangent was nearly parallel to the incoming velocity; the accepted post-contact lip/bevel could not help when that pre-contact line was the fired impact surface. Reuse the accepted mature dense lip gate to angle only the final pre-contact segment, preserving the post-contact ride-out and candidate count while making the measured landing surface harder.
- Code changes made: added `CONTACT_CENTERED_IMPACT_ENTRY_BEVEL_SHIFT_MULT = 2` in `scripts/v0/arc_placement.ts`; `sampleContactCenteredLines(...)` now computes `impactLipShiftDeg` before pre-line construction and passes `contactAngleDeg - 2 * impactLipShiftDeg` as the final pre-contact segment angle. `buildPreContactLines(...)` accepts an optional final segment angle, defaulting to the old end angle, so callers outside the gated contact-centered impact path remain unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('entry bevel2 import ok'))"` passed.
- Bracket probe: `impact-entry-bevel15-slice-01` used the same mechanism with `CONTACT_CENTERED_IMPACT_ENTRY_BEVEL_SHIFT_MULT = 1.5`. Focused decide was indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `494.6 -> 496.6`, `Delta=+2.0`, 95% CI `[-1.6, 5.9]`, `P(Delta<=0)=13.9%`. Per-budget deltas: `50k +0.0`, `100k +1.6`, `200k +3.0`, `300k +1.8`; validity unchanged.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-entry-bevel20-slice-01`
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `494.6 -> 498.3`, `Delta=+3.7`, 95% CI `[-0.6, 9.2]`, `P(Delta<=0)=5.7%`, effect `1.45`. Per-budget deltas: `50k +0.0`, `100k +4.0`, `200k +4.2`, `300k +3.9`; validity unchanged.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-entry-bevel20-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `514.8 -> 519.1`, `Delta=+4.3`, 95% CI `[1.0, 8.4]`, `P(Delta<=0)=0.5%`, effect `2.27`. Per-budget deltas: `50k +0.0`, `100k +4.2`, `200k +4.9`, `300k +4.7`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Raw canonical scores: headline `519.15`, with budget scores `50k 359.81`, `100k 494.55`, `200k 535.48`, `300k 543.01`.
- Diagnostics: this is a mature/medium-budget geometry gain, not a validity change. It fixes a distinct surface-selection failure mode from the previous post-contact lip/bevel work: the actual fired landing surface is now allowed to be hard when the landing happens on the approach line.
- Status: kept and committed; new canonical baseline is `impact-entry-bevel20-01`.

## impact-fwd-nextlowair-grounded32-slice-01

- Baseline used: `impact-entry-bevel20-01` behavior at commit `8adeaa1`.
- Hypothesis: the earlier release-grounded penalties were selection-inert because the `100k+` forward-eval path returns before local release penalties are applied. Apply the same causal setup idea inside forward-eval ranking: when the next contact asks for low air and high impact, penalize candidates whose current catch has fewer than ten grounded release frames, with smooth target and budget pressure.
- Code changes made: temporarily added `forwardEvalReleaseSetupPenalty(...)` in `scripts/v0/optimizer/handoff.ts`; the fwd-eval score became `-value + setupPenalty`. The penalty was gated by next-gap low-air pressure, next-gap high-impact pressure (`impact` from `0.75..0.90`), a `10` frame grounded target, a `150k` budget scale, and a score-point weight of `32`. Candidate counts, geometry, RNG draws, scorer, specs, seed set, and budget grid were unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-fwd-nextlowair-grounded32-slice-01`
- Raw focused scores: headline `494.13`, with budget scores `50k 392.42`, `100k 471.89`, `200k 502.78`, `300k 512.72`; validity improved at `50k` (`239/240 -> 240/240`) and stayed `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: REJECT`; 20-spec intersection headline `498.3 -> 494.1`, `Delta=-4.2`, 95% CI `[-10.7, 0.3]`, `P(Delta<=0)=96.0%`, effect `-1.43`. Per-budget deltas: `50k +0.0`, `100k -4.5`, `200k -5.2`, `300k -4.0`; validity improved at `50k` and was unchanged elsewhere.
- Diagnostics: making the forward ranker prefer longer grounded release into low-air/high-impact beats hurts the focused aggregate and worsens several `drums_pendulum` rows. The causal setup term is active, but it steers away from better true-score continuations; do not repeat this grounded-release direction without new geometry evidence.
- Status: reverted after focused reject; no canonical run and no behavior commit.

## impact-lowair-speed-recovery8-slice-01

- Baseline used: `impact-entry-bevel20-01` behavior at commit `8adeaa1` plus log-only commit `221f05f`.
- Hypothesis: post-entry diagnostics on `drums_pendulum` showed later low-air/high-impact beats becoming speed-limited: incoming speed decayed to `5..7 px/frame`, so even steeper catch surfaces could not reach the authored `impact=0.85`. Add a narrow, mature, low-air/high-impact/dense post-contact ride-out angle bias that only activates when the rider is below the authored speed target, preserving the hard first lip while letting later ride-out segments recover speed.
- Code changes made: temporarily added `contactCenteredLowAirImpactSpeedRecoveryDeg(...)` in `scripts/v0/arc_placement.ts`, adding up to `8deg` to `postAngleDeg` under low-air pressure, high-impact pressure, dense next-contact pressure, speed-deficit pressure, a `75k..125k` budget ramp, and the existing per-attempt launch span. Candidate counts, RNG draws, scorer, specs, seed set, and budget grid were unchanged.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-lowair-speed-recovery8-slice-01`
- Raw focused scores: headline `497.96`, with budget scores `50k 392.42`, `100k 476.66`, `200k 507.00`, `300k 516.62`; validity improved at `50k` (`239/240 -> 240/240`) and stayed `240/240` for `100k+`.
- Probe decide result: indicative `VERDICT: INCONCLUSIVE`; 20-spec intersection headline `498.3 -> 498.0`, `Delta=-0.3`, 95% CI `[-2.2, 1.0]`, `P(Delta<=0)=63.3%`, effect `-0.40`. Per-budget deltas: `50k +0.0`, `100k +0.3`, `200k -0.9`, `300k -0.1`; validity improved at `50k` and was unchanged elsewhere.
- Diagnostics: the bias is active but seed-unstable. It lifted some rows (`rhythm_ladder seed10 +60`, `drums_pendulum seed0 +29`, `dense_sprint seed2 +23`) while causing large regressions (`drums_pendulum seed7 -60`, `dense_sprint seed11 -37`, `drums_pendulum seed6 -30`). The aggregate is not promotable; speed recovery needs a more stable selector or geometry family.
- Status: reverted after focused inconclusive/negative signal; no canonical run and no behavior commit.

## impact-moderate-lip20-01

- Baseline used: `impact-entry-bevel20-01` behavior at commit `8adeaa1`, with log-only commits `221f05f` and `42ed9ce` on top.
- Hypothesis: post-entry diagnostics showed many remaining hard-impact failures around authored `impact=0.75` and `air=0.60..0.75`, but the accepted dense impact lip starts at `impact=0.75` and is effectively zero at the exact boundary. Add a smooth moderate-impact lip that is active around `impact=0.70..0.78`, fades before the existing high-impact lip, and is gated by medium/low air, dense next-gap pressure, and the existing mature budget window.
- Code changes made: added a `CONTACT_CENTERED_IMPACT_MODERATE_LIP_SHIFT_DEG = 20` helper in `scripts/v0/arc_placement.ts`, gated by `impact 0.68..0.76`, fadeout `0.78..0.82`, `air` under `0.84`, dense next-gap pressure, and a `75k..125k` mature ramp. `sampleContactCenteredLines(...)` now uses the maximum of the accepted dense lip and the new moderate lip, so the accepted high-impact behavior remains dominant where it already applies.
- Import smoke: `LR_ENGINE=wasm npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Focused probe command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,syncopated_switchback,rhythm_ladder,drums_signature,dense_sprint,drums_dropout,drums_crosscut,opening_burst,drums_pulse,drums_zigzag,big_air_ramp,pop_train,soar_settle,leap_cadence,climb_terrace,swoop_dive,rolling_hills,glide_stairs,dense_echo_climb,skyline_push --archive-dir=generated/golden-runs/impact-moderate-lip20-slice-01`
- Raw focused scores: headline `521.74`, with budget scores `50k 392.42`, `100k 500.41`, `200k 533.17`, `300k 542.78`; validity was `239/240` at `50k` and `240/240` for `100k+`.
- Focused decide result: indicative `VERDICT: ACCEPT`; 20-spec intersection headline `498.3 -> 521.7`, `Delta=+23.5`, 95% CI `[7.5, 43.9]`, `P(Delta<=0)=0.0%`, effect `2.52`. Per-budget deltas: `50k +0.0`, `100k +24.0`, `200k +25.2`, `300k +26.0`; validity improved at `50k` and was unchanged elsewhere.
- Canonical command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/impact-moderate-lip20-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `519.1 -> 533.0`, `Delta=+13.9`, 95% CI `[5.1, 25.4]`, `P(Delta<=0)=0.0%`, effect `2.66`. Per-budget deltas: `50k +0.0`, `100k +14.4`, `200k +14.8`, `300k +15.3`; validity unchanged (`50k 97%`, `100k+ 100%`).
- Raw canonical scores: headline `533.00`, with budget scores `50k 359.81`, `100k 508.97`, `200k 550.30`, `300k 558.34`.
- Diagnostics: this promotes the boundary case left by the accepted dense lip gate. It is a mature geometry gain that leaves `50k` unchanged, lifts the dense hard-impact specs broadly, and preserves the accepted high-impact lip/entry-bevel path by using a max-composition rather than retuning the existing gate.
- Status: kept and committed; new canonical baseline is `impact-moderate-lip20-01`.
