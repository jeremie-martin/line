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
