# Compiler Optimization Log 2

Goal: raise canonical HEADLINE above 700 by improving arc placement/generation
quality. Promotion rule: canonical golden run followed by `npm run decide`, keep
only changes that print `VERDICT: ACCEPT`.

## baseline-6114005-budgets300

- Baseline commit: `6114005d5a90` (`Update canonical golden budgets`), dirty
  worktree only from unrelated local files.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/baseline-6114005-budgets300`
- Result: canonical `HEADLINE 615.45`, budgets `50k=476.37`, `100k=612.02`,
  `200k=625.90`, `300k=632.80`; validity `466/480` at `50k`, `480/480` at
  `100k+`.
- Worst weighted specs: `drums_pendulum 444.66`, `big_air_ramp 490.89`,
  `tiny_dance 506.63`, `skyline_push 526.97`, `terrace_sprint 534.12`.
- Budget conversion: weak after 100k for several plateaued specs
  (`tiny_dance +0.59`, `ridge_pulse +2.91`, `dense_echo_climb +4.04`,
  `swoop_dive +6.15` from `100k -> 300k`), while some rows still benefit from
  extra budget (`soar_settle +45.16`, `leap_cadence +43.94`).
- Axis shape from checkpoint reports at `300k`: `air` MAE `0.0783`, `speed`
  MAE `0.0594`, `elevation` MAE `0.0992`, `amplitude` MAE `0.1368`.
  Elevation and amplitude are biased low (`elevation` negative in `2518/3300`
  measured gap axes; `amplitude` negative in `2381/3228`), so the first
  placement attempt should broaden physically higher/pop/sustained arc futures
  without spec-name branches.

## amp-elev-pressure-01

- Baseline used: `baseline-6114005-budgets300` at commit `6114005d5a90`.
- Hypothesis: amplitude targets are being treated too linearly: low amplitude
  gets enough launch pressure to overshoot early sparse gaps, while high
  amplitude still undershoots. Use a smooth high-target amplitude pressure curve
  so low targets keep a restrained ride-out and high targets get more full-pop
  launch. Elevation is also biased low; resolve its launch band against the
  larger of current speed and authored target speed so a temporarily slow entry
  does not cap climb futures prematurely.
- Code changes made: in `scripts/v0/arc_placement.ts`, changed contact-centered
  elevation launch speed from current speed to `max(current, targetSpeed)`, and
  changed amplitude launch blend from `span * amplitude` to
  `span * smoothstep((amplitude - 0.30) / 0.45)`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/amp-elev-pressure-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `615.4 -> 616.9`,
  `Delta=+1.5`, 95% CI `[-0.9, 4.1]`, `P(Delta<=0)=10.7%`. Per-budget
  deltas were positive but not gating-strong: `50k +1.3`, `100k +2.6`,
  `200k +1.4`, `300k +1.2`.
- Notable improvements: weighted spec deltas improved `leap_cadence +16.56`,
  `terrace_sprint +9.07`, `canyon_steps +8.61`, `big_air_ramp +8.42`,
  `mixed_grade +6.00`, `float_bounds +5.97`, `dense_echo_climb +5.39`.
  Largest `300k` row wins included `soar_settle` seed 8 `+128.2`,
  `skyline_push` seed 3 `+94.3`, `soar_settle` seed 10 `+69.8`, and
  `terrace_sprint` seed 11 `+54.6`.
- Notable regressions: weighted spec deltas regressed `pop_train -4.87`,
  `glide_stairs -4.34`, `valley_bounce -4.27`, `syncopated_lift -2.72`,
  `summit_push -2.40`. Largest `300k` row losses included `skyline_push`
  seed 8 `-59.3`, `soar_settle` seed 5 `-58.7`, `soar_settle` seed 9
  `-49.7`, `valley_bounce` seed 8 `-49.6`, and `float_bounds` seed 9
  `-41.9`.
- Axis aggregate at `300k`: small diagnostics-only improvements in
  `elevation` MAE `0.0992 -> 0.0982` and `speed` MAE `0.0594 -> 0.0588`;
  `amplitude` MAE was effectively flat `0.1368 -> 0.1369` though RMS improved
  `0.1765 -> 0.1756`; `air` stayed flat `0.0783 -> 0.0784`.
- Status: reverted; positive but not accepted by the canonical decision gate,
  and the broad pressure change produced noisy seed-level losses on the same
  specs it helped.

## axisq-amp-elev-01

- Baseline used: `baseline-6114005-budgets300` at commit `6114005d5a90`.
- Hypothesis: the quality phase has an `axisq` source and stats plumbing, but no
  generator feeding it. Amplitude/elevation-heavy rows are plateauing after the
  first valid track, so add a small deterministic quality-only stream that
  samples contact-centered candidates with high amplitude/elevation targets
  gently boosted. Let the existing true forward evaluator decide whether those
  candidates beat the normal pool; keep contract search unchanged.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, added cached
  quality-phase `axisq` candidates for `elevation` and `amplitude`. Probe
  pressure is smooth in authored target, budget, and node maturity; selected
  candidates are scored by `scoreCandidateForHandoff` with source `axisq` and
  are not reused as steady-state catches.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/axisq-amp-elev-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `615.4 -> 615.3`,
  `Delta=-0.1`, 95% CI `[-0.7, 0.2]`, `P(Delta<=0)=76.3%`. Per-budget
  deltas: `50k +0.0`, `100k -0.2`, `200k -0.2`, `300k -0.1`.
- Notable improvements: small weighted spec wins on `big_air_ramp +0.88`,
  `canyon_steps +0.83`, `climb_terrace +0.18`, `terrace_sprint +0.16`,
  `syncopated_lift +0.14`. Largest `300k` row wins were `canyon_steps`
  seed 4 `+23.9`, `big_air_ramp` seed 1 `+15.6`, `canyon_steps` seed 11
  `+15.0`, and `float_bounds` seed 11 `+11.6`.
- Notable regressions: weighted losses on `skyline_push -3.28`,
  `leap_cadence -1.48`, `switchback_pop -0.90`, `pop_train -0.70`,
  `mixed_grade -0.39`, `valley_bounce -0.38`. Largest `300k` row losses
  were `leap_cadence` seed 1 `-50.9`, `skyline_push` seed 7 `-31.7`,
  `canyon_steps` seed 1 `-14.0`, and `pop_train` seed 10 `-13.8`.
- Axisq diagnostics: at `300k`, the stream attempted `3736` probes and found
  `1527` viable candidates, but only `7` selected candidates (`1` elevation,
  `6` amplitude). At `100k` it attempted `430` for only `4` selections; at
  `200k`, `1852` attempts for `9` selections. The selection rate is too low for
  the charged budget cost.
- Axis aggregate at `300k`: `elevation` MAE improved slightly
  `0.0992 -> 0.0989`, `amplitude` MAE stayed flat `0.1368 -> 0.1368`
  with RMS `0.1765 -> 0.1763`; `speed` and `air` ticked slightly worse.
- Status: reverted; the extra quality stream was correctly wired but too noisy
  and too expensive relative to selected improvements.

## repair-upstream-04

- Baseline used: `baseline-6114005-budgets300` at commit `6114005d5a90`.
- Hypothesis: repair logs on `skyline_push` show several high-value accepted
  suffix rebuilds at the existing upstream cap (`up=3`), which means some weak
  gaps are caused by setup choices farther upstream than the current repair walk
  can touch. Allow one more upstream anchor while keeping the existing measured
  affordability check, so the extra work only runs when the suffix can still
  complete inside the remaining budget.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed the default
  `LR_REPAIR_MAX_UPSTREAM` fallback from `3` to `4`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/repair-upstream-04`
- Decide result: `VERDICT: ACCEPT`; headline `615.4 -> 615.8`,
  `Delta=+0.3`, 95% CI `[-0.2, 0.9]`, `P(Delta<=0)=9.8%`. Per-budget
  deltas: `50k +0.0`, `100k +0.1`, `200k +0.1`, `300k +0.6`.
- Notable improvements: weighted spec wins on `opening_burst +3.32`,
  `dense_sprint +2.67`, `skyline_push +2.17`, `drums_signature +1.70`,
  `mixed_grade +1.20`, `big_air_ramp +1.08`, `canyon_steps +1.02`.
  Largest `300k` row wins were `opening_burst` seed 2 `+79.5`,
  `drums_signature` seed 1 `+39.8`, `dense_sprint` seed 0 `+39.4`,
  `mixed_grade` seed 8 `+31.6`, `skyline_push` seed 3 `+31.1`, and
  `big_air_ramp` seed 4 `+22.1`.
- Notable regressions: weighted losses on `leap_cadence -1.62`,
  `switchback_pop -1.52`, `syncopated_lift -0.77`, `glide_stairs -0.30`,
  `float_bounds -0.28`. Largest `300k` row losses were `mixed_grade` seed 10
  `-24.6`, `leap_cadence` seed 5 `-22.9`, `opening_burst` seed 4 `-21.8`,
  and `leap_cadence` seed 1 `-21.4`.
- Compile-stats shape: repair accepted the same number of improvements at
  `300k` (`1569`) with slightly fewer restarts on average (`11.20 -> 11.13`)
  and fewer duplicate full evaluations (`6.8 -> 6.5`). The extra upstream
  option changes which suffixes are reachable without increasing aggregate
  repair churn.
- Status: kept and committed; accepted by canonical decision gate.

## repair-upstream-05

- Baseline used: `repair-upstream-04` at commit `9b7a0c9`.
- Hypothesis: `repair-upstream-04` was accepted and repair logs showed high-value
  improvements at the previous cap. Test whether one more upstream anchor
  continues to expose useful setup changes, with the existing suffix-cost
  feasibility check limiting unaffordable restarts.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed the default
  `LR_REPAIR_MAX_UPSTREAM` fallback from `4` to `5`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/repair-upstream-05`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `615.8 -> 615.8`,
  `Delta=+0.0`, 95% CI `[-0.2, 0.3]`, `P(Delta<=0)=45.2%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k +0.1`, `300k -0.0`.
- Notable improvements: weighted wins on `opening_burst +1.76`,
  `rolling_hills +1.22`, `leap_cadence +0.84`, `switchback_pop +0.77`.
  Largest `300k` row wins were `opening_burst` seed 4 `+28.6`,
  `leap_cadence` seed 5 `+15.9`, and `switchback_pop` seeds 3/1
  `+15.1`/`+14.4`.
- Notable regressions: weighted losses on `climb_terrace -1.12`,
  `syncopated_switchback -1.02`, `syncopated_lift -0.80`,
  `summit_push -0.75`, `mixed_grade -0.66`. Largest `300k` row losses were
  `climb_terrace` seed 8 `-22.1`, `summit_push` seed 4 `-16.5`,
  `syncopated_switchback` seed 7 `-15.8`, and `switchback_pop` seed 11
  `-15.6`.
- Status: reverted; the fifth upstream step plateaued and redistributed
  repair outcomes without a canonical decision win.

## repair-slack-gap-01

- Baseline used: `repair-upstream-04` at commit `9b7a0c9`.
- Hypothesis: repair currently chooses the largest raw per-gap axis SSE that is
  affordable. When two weak gaps are close, this can spend the remaining repair
  slice on a suffix with little headroom. Add a small smooth slack bonus among
  feasible gaps so raw weakness still dominates, but near-tied gaps prefer
  suffixes that can reconverge more reliably.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `pickFeasibleWeakGap` to filter infeasible gaps up front and rank feasible
  gaps by `sse * (1 + 0.35 * smoothstep(slack))`, with raw SSE as tie-break.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/repair-slack-gap-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `615.8 -> 615.7`,
  `Delta=-0.0`, 95% CI `[-0.4, 0.3]`, `P(Delta<=0)=56.3%`. Per-budget
  deltas: `50k +0.0`, `100k -0.2`, `200k -0.2`, `300k +0.2`.
- Notable improvements: weighted wins on `syncopated_switchback +1.66`,
  `drums_crosscut +1.17`, `mixed_grade +0.60`, `dense_sprint +0.59`,
  `drums_dropout +0.45`. Largest `300k` row wins included
  `syncopated_switchback` seed 2 `+21.1`, `drums_tide` seed 6 `+20.9`,
  and `drums_crosscut` seed 10 `+20.7`.
- Notable regressions: weighted losses on `switchback_pop -2.72`,
  `drums_zigzag -1.23`, `soar_settle -0.74`, `drums_crescendo -0.66`,
  `grain_staircase -0.61`. Largest `300k` row losses included
  `climb_terrace` seed 8 `-17.8`, `drums_crosscut` seed 3 `-15.5`,
  `opening_burst` seed 1 `-14.9`, and `drums_breath` seed 3 `-14.7`.
- Status: reverted; the slack bonus helped some high-budget rows but traded
  against `100k`/`200k` and produced no canonical decision win.

## startup-low-air-preline-01

- Baseline used: `repair-upstream-04` at commit `9b7a0c9`.
- Hypothesis: the worst remaining rows share a first-gap air overshoot: the
  rider is effectively airborne until the first required contact, so low first
  air targets (`drums_pendulum`, `tiny_dance`) and early low-amplitude targets
  (`big_air_ramp`) start with an unrecoverable axis penalty. Add a deterministic
  span of longer pre-contact support lines only on the first gap and only under
  smooth low-air pressure, so some candidates can provide ground before the
  first contact without changing later gap behavior.
- Code changes made: in `scripts/v0/arc_placement.ts`, added first-gap low-air
  preline pressure and blended `preLength` toward a capped startup reach length
  across the existing contact-centered length span; raised the preline segment
  cap to `16` only when this startup pressure is active.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/startup-low-air-preline-01`
- Decide result: `VERDICT: REJECT`; headline `615.8 -> 611.7`,
  `Delta=-4.0`, 95% CI `[-9.3, 0.8]`, `P(Delta<=0)=95.3%`.
  Per-budget deltas: `50k -23.9`, `100k -1.5`, `200k -2.6`,
  `300k -2.5`.
- Notable improvements: weighted wins on `big_air_ramp +4.56`,
  `drums_zigzag +4.38`, `rolling_drop +1.33`, `solo_run +1.14`,
  and `valley_bounce +1.09`. Largest `300k` row wins included
  `solo_run` seed 4 `+55.5`, `drums_pendulum` seed 3 `+50.8`,
  `valley_bounce` seed 11 `+39.2`, and `drums_signature` seed 3
  `+38.7`.
- Notable regressions: weighted losses on `drums_swell -15.56`,
  `rolling_hills -10.10`, `drums_signature -8.62`,
  `climb_terrace -8.22`, `drums_crescendo -8.09`, and
  `tiny_dance -6.03`. Largest `300k` row losses included `drums_swell`
  seed 6 `-82.4`, `terrace_sprint` seed 8 `-71.1`, `drums_swell`
  seed 0 `-58.0`, and `drums_signature` seed 4 `-56.4`.
- Status: reverted; the first-gap support line helped some early-air rows but
  consumed search/changed geometry too broadly, especially at `50k`, and did
  not pass the canonical decision gate.

## amp-elev-pressure-02

- Baseline used: `repair-upstream-04` at commit `9b7a0c9`.
- Hypothesis: after the accepted repair-upstream change, the remaining `300k`
  axis distribution is still biased low for elevation and amplitude overall
  (`elevation` signed `-0.0662`, `amplitude` signed `-0.0559`), while the
  previous `amp-elev-pressure-01` mechanism was positive but just short of the
  canonical decision gate. Re-test the same smooth high-target pressure against
  the current accepted baseline: high amplitude/elevation targets get stronger
  physically reachable launch futures, while low amplitude targets no longer
  receive linear pop pressure.
- Code changes made: in `scripts/v0/arc_placement.ts`, changed contact-centered
  elevation launch speed from current speed to `max(current, targetSpeed)`, and
  changed amplitude launch blend from `span * amplitude` to
  `span * smoothstep((amplitude - 0.30) / 0.45)`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/amp-elev-pressure-02`
- Decide result: `VERDICT: ACCEPT`; headline `615.8 -> 617.3`,
  `Delta=+1.6`, 95% CI `[-0.7, 4.1]`, `P(Delta<=0)=8.8%`.
  Per-budget deltas: `50k +1.3`, `100k +2.5`, `200k +1.5`,
  `300k +1.3`.
- Notable improvements: weighted wins on `leap_cadence +17.74`,
  `terrace_sprint +11.12`, `canyon_steps +7.49`, `big_air_ramp +6.65`,
  `float_bounds +6.14`, `dense_echo_climb +4.88`, and
  `mixed_grade +4.73`. Largest `300k` row wins included `soar_settle`
  seed 8 `+128.2`, `soar_settle` seed 10 `+69.8`, `skyline_push`
  seed 3 `+63.2`, `float_bounds` seed 11 `+47.4`, and `pop_train`
  seed 4 `+46.8`.
- Notable regressions: weighted losses on `glide_stairs -4.03`,
  `summit_push -3.31`, `pop_train -2.66`, `valley_bounce -2.01`,
  `syncopated_lift -1.73`, and `skyline_push -0.65`. Largest `300k`
  row losses included `skyline_push` seed 8 `-59.3`, `soar_settle`
  seed 5 `-58.7`, `soar_settle` seed 9 `-49.7`, `valley_bounce`
  seed 8 `-49.6`, and `float_bounds` seed 9 `-43.2`.
- Axis aggregate at `300k`: `speed` MAE improved `0.0593 -> 0.0584`,
  `elevation` MAE improved `0.0987 -> 0.0981`, `amplitude` MAE improved
  `0.1373 -> 0.1368` and RMS improved `0.1766 -> 0.1755`; `air` stayed
  flat at `0.0782`.
- Status: kept and committed; accepted by canonical decision gate. New baseline
  archive: `generated/golden-runs/amp-elev-pressure-02`.
