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

## startup-low-air-preline-02

- Baseline used: `amp-elev-pressure-02` at commit `6a5ba50`.
- Hypothesis: after the accepted amplitude/elevation pressure change, the worst
  remaining spec-gaps are still dominated by first-gap low-air overshoot:
  `drums_pendulum` gap 0 averages about `+0.80` air error, while `cold_start`
  and `drums_crescendo` also begin with target air `0.30` and achieved air near
  `0.95`. The previous preline attempt was rejected because it activated on
  medium-air first gaps and perturbed too many rows. Re-try a much narrower
  first-gap support span that only has meaningful pressure below about `0.35`
  authored air, with a lower length cap and segment cap.
- Code changes made: in `scripts/v0/arc_placement.ts`, added first-gap low-air
  preline pressure with scale `0.42`, capped blended startup reach length at
  `180`, and raised the pre-contact segment cap only to `10` while that pressure
  is active.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/startup-low-air-preline-02`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.3 -> 617.6`,
  `Delta=+0.3`, 95% CI `[-2.3, 2.8]`, `P(Delta<=0)=34.0%`.
  Per-budget deltas: `50k +0.3`, `100k +0.5`, `200k +0.2`,
  `300k +0.3`.
- Notable improvements: weighted wins on `drums_signature +6.93`,
  `drums_crescendo +2.82`, `terrace_sprint +2.74`, `ridge_pulse +1.97`,
  `verse_chorus +0.81`, `dense_echo_climb +0.80`, and
  `drums_pendulum +0.68`. Largest `300k` row wins included
  `drums_signature` seed 11 `+56.0`, `drums_pendulum` seed 3 `+53.8`,
  `drums_pendulum` seed 0 `+41.8`, and `drums_signature` seed 8 `+39.6`.
- Notable regressions: weighted losses on `cold_start -3.09`,
  `rhythm_ladder -1.84`, and `tiny_dance -1.12`. Largest `300k` row losses
  included `drums_pendulum` seed 6 `-32.9`, `drums_crescendo` seed 10
  `-27.8`, `tiny_dance` seed 11 `-23.8`, `cold_start` seed 5 `-21.9`,
  and `rhythm_ladder` seed 5 `-19.8`.
- Diagnostics: the targeted first-gap air error did not improve; it worsened
  slightly on `drums_pendulum` (`0.798 -> 0.830`), `drums_crescendo`
  (`0.648 -> 0.656`), `cold_start` (`0.662 -> 0.668`), and `rhythm_ladder`
  (`0.622 -> 0.628`). The score gain came from downstream routing changes, not
  from solving the intended first-gap support problem.
- Status: reverted; positive but not accepted, and the mechanism did not fix
  the targeted failure mode.

## low-target-overshoot-cost-01

- Baseline used: `amp-elev-pressure-02` at commit `6a5ba50`.
- Hypothesis: the worst remaining axes include severe low-target overshoots:
  low-air first gaps (`drums_pendulum`) and low-amplitude gaps
  (`terrace_sprint` gap 17, `big_air_ramp` gap 0) reach achieved values near
  `1.0`. Add a smooth low-target overshoot cost to the candidate pool cost so
  the high-budget forward evaluator sees less pathological local options,
  while undershooting low targets and medium/high targets stay mostly unchanged.
- Code changes made: in `scripts/v0/core/candidate.ts`, temporarily added
  target-gated smooth overshoot multipliers inside `axisCost` for low `air`
  and low `amplitude` targets.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/low-target-overshoot-cost-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.3 -> 617.2`,
  `Delta=-0.2`, 95% CI `[-2.7, 2.4]`, `P(Delta<=0)=60.1%`. Per-budget
  deltas: `50k -1.5`, `100k -0.1`, `200k -0.0`, `300k -0.0`.
- Notable improvements: weighted wins on `terrace_sprint +1.27`,
  `skyline_push +0.99`, `soar_settle +0.96`, and `leap_cadence +0.35`.
  Largest `300k` row wins included `terrace_sprint` seed 1 `+27.9`,
  `soar_settle` seed 1 `+27.8`, `valley_bounce` seed 4 `+22.7`,
  and `syncopated_switchback` seed 9 `+16.4`.
- Notable regressions: weighted losses on `rhythm_ladder -2.66`,
  `rolling_drop -1.42`, `big_air_ramp -1.31`, `pop_train -0.84`,
  `ridge_pulse -0.83`, and `drums_dropout -0.75`. Largest `300k` row
  losses included `rhythm_ladder` seed 0 `-43.2`,
  `syncopated_switchback` seed 2 `-22.4`, `switchback_pop` seed 8
  `-20.6`, and `rolling_drop` seed 4 `-18.9`.
- Diagnostics: aggregate `300k` axis MAE barely moved (`air`
  `0.0782 -> 0.0781`, `amplitude` `0.1368 -> 0.1366`, `elevation`
  `0.0981 -> 0.0979`, `speed` regressed `0.0584 -> 0.0586`), so the pool
  cost was too weak/sparse to solve the targeted failures and still hurt
  low-budget routing.
- Status: reverted; no accepted improvement.

## tail-window-extra-03

- Baseline used: `amp-elev-pressure-02` at commit `6a5ba50`.
- Hypothesis: the accepted baseline's quality phase still converts budget
  through near-tail completion, especially at `300k` where remaining-9-contact
  suffixes produced most tail improvements. Increase the smooth high-budget
  tail-completion window by one contact so the search can evaluate slightly
  earlier suffixes at ample budgets without changing scarce `50k` behavior.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `TAIL_COMPLETION_BUDGET_WINDOW_EXTRA` from `2` to `3`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/tail-window-extra-03`
- Decide result: `VERDICT: ACCEPT`; headline `617.3 -> 617.5`,
  `Delta=+0.2`, 95% CI `[-0.0, 0.6]`, `P(Delta<=0)=6.8%`. Per-budget
  deltas: `50k +0.0`, `100k +0.5`, `200k +0.0`, `300k +0.3`.
- Notable improvements: weighted wins on `drums_tide +2.80`,
  `rhythm_ladder +2.77`, `soar_settle +0.96`, `pop_train +0.71`,
  `ridge_pulse +0.55`, and `drums_signature +0.44`. Largest `300k` row
  wins included `drums_tide` seed 1 `+71.0`, `rhythm_ladder` seed 11
  `+64.9`, `pop_train` seed 5 `+17.7`, and `drums_signature` seed 9
  `+12.4`.
- Notable regressions: weighted losses on `drums_dropout -0.45`,
  `syncopated_switchback -0.43`, `solo_run -0.23`, `big_air_ramp -0.22`,
  and `skyline_push -0.19`. Largest `300k` row losses included
  `solo_run` seed 4 `-11.7`, `drums_breath` seed 4 `-11.0`,
  `drums_dropout` seed 9 `-8.6`, and `syncopated_switchback` seed 3
  `-8.3`.
- Diagnostics: the change was byte-identical at `50k` and `200k` on aggregate.
  At `100k`, tail improvements shifted from remaining-8 to remaining-9
  suffixes (`rem8 300 -> 19`, `rem9 1 -> 287`) and total tail improvements
  rose `1184 -> 1191`. At `300k`, tail improvements shifted from remaining-9
  to remaining-10 suffixes (`rem9 1256 -> 492`, `rem10 0 -> 763`) with small
  aggregate axis changes (`air` MAE `0.0782 -> 0.0780`, `speed`
  `0.0584 -> 0.0582`, elevation flat, amplitude `0.1368 -> 0.1369`).
- Status: kept and committed; accepted by canonical decision gate. New baseline
  archive: `generated/golden-runs/tail-window-extra-03`.

## tail-window-extra-04

- Baseline used: `tail-window-extra-03` at commit `c9bddf1`.
- Hypothesis: `tail-window-extra-03` opened remaining-10 suffix completions at
  `300k` but left `200k` aggregate-identical. Increasing the same smooth
  high-budget extra window from `3` to `4` should cross the remaining-10
  boundary at `200k` while keeping `50k`, `100k`, and `300k` effectively
  unchanged.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `TAIL_COMPLETION_BUDGET_WINDOW_EXTRA` from `3` to `4`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/tail-window-extra-04`
- Decide result: `VERDICT: ACCEPT`; headline `617.5 -> 617.7`,
  `Delta=+0.1`, 95% CI `[-0.0, 0.4]`, `P(Delta<=0)=8.2%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k +0.4`, `300k +0.0`.
- Notable improvements: weighted wins on `drums_tide +1.92`,
  `rhythm_ladder +1.66`, `skyline_push +1.28`, `drums_signature +0.53`,
  `drums_dropout +0.30`, and `drums_pendulum +0.26`. Largest `200k` row
  wins included `drums_tide` seed 1 `+74.2`, `rhythm_ladder` seed 11
  `+66.0`, `skyline_push` seed 10 `+49.9`, and `drums_signature` seed 9
  `+21.5`.
- Notable regressions: weighted losses on `drums_breath -0.40`,
  `syncopated_switchback -0.12`, `ridge_pulse -0.09`,
  `glide_stairs -0.06`, and `soar_settle -0.05`. Largest `200k` row losses
  included `drums_breath` seed 4 `-9.5`, `drums_breath` seed 1 `-6.1`,
  `syncopated_switchback` seed 3 `-4.9`, and `ridge_pulse` seed 9 `-3.5`.
- Diagnostics: `100k` and `300k` tail stats were unchanged. At `200k`, tail
  improvements shifted from remaining-9 to remaining-10 suffixes
  (`rem9 587 -> 28`, `rem10 455 -> 1019`), while total tail attempts fell
  `6276 -> 6221`. Aggregate `200k` axis MAE improved slightly on all four
  targeted axes: `air 0.0809 -> 0.0807`, `speed 0.0613 -> 0.0610`,
  `elevation 0.0990 -> 0.0989`, `amplitude 0.1382 -> 0.1381`.
- Status: kept and committed; accepted by canonical decision gate. New baseline
  archive: `generated/golden-runs/tail-window-extra-04`.

## tail-window-extra-05

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: after opening remaining-10 suffixes at `200k`/`300k`, try one
  more smooth high-budget tail-window increment to let remaining-11 suffixes
  compete at ample budgets. This should reveal whether the tail-completion
  window still has useful headroom or has reached a plateau.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `TAIL_COMPLETION_BUDGET_WINDOW_EXTRA` from `4` to `5`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/tail-window-extra-05`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 617.7`,
  `Delta=+0.0`, 95% CI `[-0.1, 0.1]`, `P(Delta<=0)=35.1%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k -0.0`, `300k +0.0`.
- Notable improvements: weighted wins on `solo_run +0.42`,
  `dense_echo_climb +0.22`, `dense_sprint +0.21`, `big_air_ramp +0.19`,
  and `drums_breath +0.15`. Largest row wins included `drums_breath`
  seed 1 at `200k` `+6.1`, `big_air_ramp` seed 2 at `300k` `+5.6`,
  `dense_sprint` seed 2 at `300k` `+5.0`, and `solo_run` seed 9 at
  `300k` `+4.5`.
- Notable regressions: weighted losses on `drums_crescendo -0.33`,
  `drums_pendulum -0.32`, `drums_swell -0.24`, and `climb_terrace -0.09`.
  Largest row losses included `drums_pendulum` seed 1 at `200k` `-10.5`,
  `drums_crescendo` seed 3 at `300k` `-9.1`, and `drums_swell` seed 5 at
  `300k` `-6.6`.
- Diagnostics: remaining-11 completions did activate, but mostly replaced the
  accepted remaining-10 work rather than increasing score. At `200k`,
  `rem10` improvements fell `1019 -> 485` and `rem11` rose `0 -> 534`;
  total tail improvements were nearly flat `1749 -> 1752`. At `300k`,
  `rem10` fell `763 -> 36` and `rem11` rose `0 -> 724`, while total tail
  improvements fell `2129 -> 2123`. The mechanism plateaued.
- Status: reverted; no accepted improvement.

## elevation-rideout-shortening-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: high-elevation target gaps still systematically undershoot.
  Because the accepted elevation launch steering changes post angle but not
  ride-out length, smoothly shorten post-contact ride-out for high elevation
  targets with air support so more of the gap is airborne climb.
- Code changes made: in `scripts/v0/arc_placement.ts`, temporarily added a
  high-elevation ride-out shortening blend after air-targeted post-length
  sizing. The blend was gated by targeted elevation, supported by air target,
  spanned by the existing launch blend, and capped at `0.45` toward the
  28-pixel post-length floor.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/elevation-rideout-shortening-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 617.3`,
  `Delta=-0.4`, 95% CI `[-2.3, 0.9]`, `P(Delta<=0)=65.4%`. Per-budget
  deltas: `50k -0.4`, `100k -0.9`, `200k -0.1`, `300k -0.4`.
- Notable improvements: weighted wins on `rolling_drop +9.57`,
  `valley_bounce +2.40`, `climb_terrace +1.60`, `swoop_dive +1.45`, and
  `switchback_pop +0.87`. Largest `300k` row wins included `rolling_drop`
  seed 5 `+32.7`, `valley_bounce` seed 1 `+29.1`, `skyline_push` seed 8
  `+27.2`, and `terrace_sprint` seed 5 `+24.7`.
- Notable regressions: weighted losses on `skyline_push -17.96`,
  `canyon_steps -5.30`, `ridge_pulse -1.60`, `mixed_grade -1.23`, and
  `glide_stairs -0.97`. Largest `300k` row losses included `skyline_push`
  seed 5 `-107.3`, `skyline_push` seed 2 `-68.5`, `canyon_steps` seed 1
  `-39.2`, and `skyline_push` seed 10 `-38.8`.
- Diagnostics: timing stayed valid but the shortened ride-out destabilized axis
  fit in key rows. In `skyline_push` seed 5 at `300k`, mean speed error rose
  `0.059 -> 0.131`, amplitude `0.160 -> 0.180`, and elevation
  `0.207 -> 0.219`; the largest gap losses included speed collapse on gaps 5-6
  and elevation collapse on gap 7. In `canyon_steps` seed 1, speed error rose
  `0.049 -> 0.084`, air `0.079 -> 0.101`, and elevation `0.084 -> 0.105`.
  Compile effort was not the bottleneck: at `300k`, unique full evaluations
  rose `9639 -> 9668`, duplicate full evaluations fell `3383 -> 3351`, but
  tail completion improvements fell `2129 -> 2063`.
- Status: reverted; no accepted improvement.

## low-air-rideout-cap-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: low-air target gaps are capped by the fixed post-contact ride-out
  safety factor (`0.55` of the next-contact span), making targets like
  `air=0.15` structurally unreachable after the first contact. Raise that cap
  smoothly only for explicit low-air targets so the search can choose longer
  grounded ride-outs where they score.
- Code changes made: in `scripts/v0/arc_placement.ts`, temporarily added a
  low-air cap pressure (`air <= 0.45`, span `0.30`) and increased the air
  target's safe ride-out cap by up to `+0.25` of the next-contact span.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/low-air-rideout-cap-01`
- Decide result: `VERDICT: REJECT`; headline `617.7 -> 586.9`,
  `Delta=-30.8`, 95% CI `[-83.8, 0.7]`, `P(Delta<=0)=95.6%`. Per-budget
  deltas: `50k -79.6`, `100k -89.4`, `200k -18.4`, `300k -11.3`. Validity
  also regressed: `50k 466/480 -> 452/480`, `100k 480/480 -> 468/480`,
  `200k 480/480 -> 478/480`, `300k 480/480 -> 479/480`.
- Notable improvements: weighted wins on `drums_signature +9.68`,
  `opening_burst +6.72`, `solo_run +6.40`, `valley_bounce +3.73`,
  `drums_dropout +3.62`, and `terrace_sprint +3.48`. Largest `300k` row wins
  included `solo_run` seed 7 `+77.7`, `solo_run` seed 3 `+59.9`,
  `valley_bounce` seed 4 `+49.5`, and `drums_signature` seed 11 `+47.5`.
- Notable regressions: weighted losses on `drums_pendulum -286.98`,
  `drums_crescendo -84.87`, `rhythm_ladder -22.58`, `canyon_steps -5.42`,
  and `dense_sprint -4.90`. Largest `300k` row losses included
  `drums_pendulum` seed 8 `-444.1` (invalid), seed 4 `-181.1`, seed 11
  `-176.3`, seed 9 `-116.9`, and seed 5 `-100.1`.
- Diagnostics: the longer ride-out occasionally reduced early low-air error,
  but it traded that for speed creep and stalls. In `drums_pendulum` seed 4 at
  `300k`, low-air gaps 1-3 improved air error (`0.250 -> 0.150`,
  `0.350 -> 0.200`, `0.550 -> 0.250`), but achieved speed jumped from roughly
  `0.93-0.96` to `0.98-1.15` and later low-air gaps regressed. Seed 8 stalled
  at frame `519`. Aggregate compile stats showed more sampling but fewer viable
  candidates and less full feedback: at `300k`, sampled candidates rose
  `2949782 -> 3015360`, viable candidates fell `1641874 -> 1627134`, unique
  full evaluations fell `9639 -> 9397`, and tail improvements fell
  `2129 -> 2032`.
- Status: reverted; no accepted improvement.

## contract-breadth-fade-early-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: `100k` already has full validity, but the protective contract
  breadth reduction is still fully active whenever the projection fires. Start
  the smooth fade earlier so the `100k` first-complete basin can keep more
  candidate breadth, while `50k` remains protected and `200k+` remain fully
  faded as before.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `CONTRACT_BREADTH_FADE_START_FRAMES` from `100_000` to `75_000`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/contract-breadth-fade-early-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 617.7`,
  `Delta=+0.0`, 95% CI `[-0.1, 0.1]`, `P(Delta<=0)=48.8%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.0`.
- Notable improvements: weighted wins were limited to `solo_run +0.455` and
  `drums_crescendo +0.008`, all from `100k`. Largest `100k` row wins included
  `drums_crescendo` seed 4 `+39.4`, `solo_run` seed 2 `+35.9`,
  `drums_pendulum` seed 4 `+34.6`, and `solo_run` seed 0 `+30.1`.
- Notable regressions: weighted losses were `drums_pendulum -0.182` and
  `rhythm_ladder -0.069`. Largest `100k` row losses included
  `drums_pendulum` seed 1 `-44.6`, `drums_crescendo` seed 8 `-35.0`,
  `solo_run` seed 3 `-22.0`, and `drums_crescendo` seed 11 `-18.3`.
- Diagnostics: only `100k` moved. Candidate sampling rose slightly
  (`958882 -> 959766`), viable candidates rose (`549087 -> 549636`), unique
  full evaluations rose (`3711 -> 3736`), and tail attempts fell
  (`3661 -> 3613`), but tail improvements also fell slightly
  (`1191 -> 1187`). The change redistributed a handful of first-complete
  basins without a score signal.
- Status: reverted; no accepted improvement.

## repair-first-gap-discount-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: gap 0 is the top raw axis-SSE repair target in most high-budget
  rows, but it has no preceding generated ride-out to rebuild. Discount the
  first gap in repair ranking so suffix restarts spend more budget on downstream
  gaps where changing the incoming arc should have more leverage.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily added
  `REPAIR_FIRST_GAP_SSE_WEIGHT = 0.15` and multiplied only gap-0 raw SSE by
  that weight inside `pickFeasibleWeakGap`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/repair-first-gap-discount-01`
- Decide result: `VERDICT: REJECT`; headline `617.7 -> 614.1`,
  `Delta=-3.5`, 95% CI `[-5.5, -1.8]`, `P(Delta<=0)=100.0%`. Per-budget
  deltas: `50k +0.0`, `100k -2.6`, `200k -4.3`, `300k -4.0`.
- Notable improvements: weighted wins on `drums_breath +2.59`,
  `drums_dropout +1.30`, `drums_pendulum +1.12`, `switchback_pop +0.66`,
  and `solo_run +0.53`. Largest `300k` row wins included `solo_run` seed 7
  `+37.1`, `drums_breath` seed 4 `+37.1`, `drums_breath` seed 0 `+34.2`,
  and `valley_bounce` seed 4 `+32.7`.
- Notable regressions: weighted losses on `drums_pulse -12.91`,
  `drums_swell -12.34`, `drums_signature -12.26`, `mixed_grade -11.03`,
  `swoop_dive -10.22`, `drums_zigzag -10.17`, and `drums_tide -9.14`.
  Largest `300k` row losses included `drums_swell` seed 0 `-79.3`,
  `rhythm_ladder` seed 11 `-63.4`, `swoop_dive` seed 6 `-55.4`,
  `drums_crescendo` seed 3 `-53.4`, and `drums_zigzag` seed 10 `-51.6`.
- Diagnostics: the discount increased repair churn but reduced quality. At
  `300k`, full evaluations rose `13022 -> 14035`, unique full evaluations rose
  `9639 -> 10244`, tail improvements rose `2129 -> 2216`, repair restarts rose
  `5466 -> 5900`, and repair accepts rose `1647 -> 1745`, yet the score fell
  sharply. Gap 0's large raw error is noisy but still a useful repair ranking
  signal; discounting it made repair accept worse downstream tradeoffs.
- Status: reverted; no accepted improvement.

## passing-full-score-register-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: the leaf register ranks passing leaves by lexicographic
  `axis_quality` first, while the canonical score also includes smooth on-beat
  drift quality. Ranking passing leaves by `full_score` first might preserve
  hard-contract validity while better matching the decision signal.
- Code changes made: in `scripts/v0/optimizer/register.ts`, temporarily changed
  the passing-leaf comparator to prefer `full_score` before `axis_quality` and
  drift tiebreaks.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/passing-full-score-register-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 617.7`,
  `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget
  deltas were exactly `+0.0` at `50k`, `100k`, `200k`, and `300k`.
- Notable improvements/regressions: none in the canonical aggregate; the
  comparator change did not alter the reported score or validity at any budget.
- Diagnostics: all pass-rate diagnostics were unchanged (`97%` at `50k`,
  `100%` at `100k+`). The no-op outcome indicates that either the register
  rarely sees passing candidates with conflicting full-score and axis-quality
  order, or those differences do not survive to canonical checkpoints.
- Status: reverted; no accepted improvement.

## elevation-target-steer-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: high-elevation target gaps still undershoot, but the rejected
  ride-out-shortening attempt destabilized speed. Keep ride-out length
  unchanged and instead smoothly steer only high elevation targets slightly
  upward inside the existing launch-angle blend.
- Code changes made: in `scripts/v0/arc_placement.ts`, temporarily added
  `HIGH_ELEVATION_STEER_START = 0.54`, `SPAN = 0.18`, and `EXTRA = 0.16`,
  then lerped the elevation launch target toward `1.0` by that smooth pressure
  before calling `elevationToLaunchVy`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/elevation-target-steer-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 617.7`,
  `Delta=+0.0`, 95% CI `[-0.8, 0.8]`, `P(Delta<=0)=46.4%`. Per-budget
  deltas: `50k -0.0`, `100k -0.2`, `200k +0.2`, `300k -0.0`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `rolling_hills +2.84`,
  `switchback_pop +2.10`, `climb_terrace +1.69`, `mixed_grade +1.24`,
  `glide_stairs +0.84`, and `syncopated_lift +0.81`. Largest `300k` row wins
  included `terrace_sprint` seed 5 `+33.6`, `skyline_push` seed 8 `+29.5`,
  `valley_bounce` seed 1 `+28.2`, and `skyline_push` seed 2 `+23.6`.
- Notable regressions: weighted losses on `skyline_push -4.02`,
  `ridge_pulse -2.35`, `rolling_drop -1.51`, `summit_push -1.31`, and
  `terrace_sprint -0.76`. Largest `300k` row losses included `skyline_push`
  seed 3 `-30.3`, `rolling_drop` seed 4 `-30.1`, `skyline_push` seed 1
  `-25.9`, `terrace_sprint` seed 7 `-24.8`, and `rolling_drop` seed 3
  `-23.0`.
- Diagnostics: axis aggregates barely moved. At `300k`, elevation MAE improved
  only `0.0981 -> 0.0980` and speed MAE improved `0.0582 -> 0.0581`, while
  amplitude MAE regressed `0.1369 -> 0.1373` and air MAE regressed
  `0.0780 -> 0.0781`. The launch-only pressure is directionally plausible but
  too noisy at this strength.
- Status: reverted; no accepted improvement.

## amplitude-pressure-lowmid-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: baseline amplitude errors show low/mid target buckets mostly
  undershoot. Lower the amplitude launch pressure start smoothly, but widen the
  span so high-amplitude behavior remains close to the accepted curve.
- Code changes made: in `scripts/v0/arc_placement.ts`, temporarily replaced
  `smoothstep((amp - 0.30) / 0.45)` with constants equivalent to
  `smoothstep((amp - 0.24) / 0.51)`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/amplitude-pressure-lowmid-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 617.2`,
  `Delta=-0.4`, 95% CI `[-2.9, 1.7]`, `P(Delta<=0)=62.6%`. Per-budget
  deltas: `50k +0.2`, `100k -1.0`, `200k -0.3`, `300k -0.4`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `valley_bounce +8.38`,
  `rolling_drop +2.93`, `glide_stairs +2.84`, `switchback_pop +2.78`,
  `syncopated_lift +2.61`, and `soar_settle +1.79`. Largest `300k` row wins
  included `soar_settle` seed 5 `+69.6`, seed 9 `+66.5`, `float_bounds`
  seed 9 `+59.9`, and `skyline_push` seed 11 `+44.9`.
- Notable regressions: weighted losses on `canyon_steps -13.17`,
  `float_bounds -11.30`, `terrace_sprint -5.03`, `skyline_push -2.71`,
  and `big_air_ramp -2.30`. Largest `300k` row losses included
  `terrace_sprint` seed 10 `-109.9`, `rolling_drop` seed 10 `-90.4`,
  `float_bounds` seed 11 `-56.4`, `skyline_push` seed 0 `-50.0`, and
  `pop_train` seed 4 `-47.6`.
- Diagnostics: amplitude RMSE improved slightly (`300k` `0.1754 -> 0.1752`
  and `100k` `0.1814 -> 0.1809`), but amplitude MAE did not improve and the
  extra launch pressure worsened elevation (`300k` MAE `0.0981 -> 0.0992`,
  RMSE `0.1216 -> 0.1239`). Broad low/mid amplitude pressure moves useful
  basins but is not stable enough globally.
- Status: reverted; no accepted improvement.

## quality-ncand-20-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: the expanded amplitude/elevation golden board may be over-spending
  quality-phase breadth at `24` candidates per gap. A smaller smooth default
  breadth should free budget for more terminal feedback while retaining enough
  geometry diversity for the true-score ranker.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `HANDOFF_QUALITY_N_CAND` from `24` to `20`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/quality-ncand-20-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 616.9`,
  `Delta=-0.7`, 95% CI `[-2.7, 1.1]`, `P(Delta<=0)=78.4%`. Per-budget
  deltas: `50k -0.7`, `100k -0.4`, `200k -1.1`, `300k -0.6`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `rolling_drop +5.36`,
  `rhythm_ladder +4.84`, `solo_run +4.80`, `soar_settle +4.41`,
  `big_air_ramp +4.15`, and `valley_bounce +3.88`. Largest `300k` row wins
  included `solo_run` seed 7 `+96.5`, `drums_crescendo` seed 0 `+66.5`,
  `soar_settle` seed 5 `+60.4`, and `syncopated_switchback` seed 10 `+46.9`.
- Notable regressions: weighted losses on `drums_tide -10.36`,
  `opening_burst -10.23`, `drums_swell -8.56`, `float_bounds -6.81`,
  `drums_crescendo -5.70`, and `drums_zigzag -5.01`. Largest `300k` row
  losses included `drums_crescendo` seed 10 `-81.1`, `drums_tide` seed 1
  `-62.6`, `drums_crescendo` seed 7 `-58.0`, and `opening_burst` seed 2
  `-55.3`.
- Diagnostics: the lower breadth did free terminal feedback but converted it
  poorly. At `300k`, samples fell `2949782 -> 2763405`, unique full evaluations
  rose `9639 -> 10511`, and tail attempts rose `8773 -> 9975`, but tail
  improvements fell `2129 -> 2105` and repair accepts fell `1647 -> 1619`.
  The change helped several hard amplitude/elevation rows, but the reduced
  candidate diversity damaged high-scoring drum/opening basins enough to lose
  the canonical comparison.
- Status: reverted; no accepted improvement.

## quality-ncand-28-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: the filtered hard-slice probes showed that nearby quality breadth
  still affects amplitude/elevation-heavy rows. Try a small step above the
  accepted `24` default, below the known rejected `32`, to expose more geometry
  diversity to the true-score ranker without the full over-spend.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `HANDOFF_QUALITY_N_CAND` from `24` to `28`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/quality-ncand-28-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 618.6`,
  `Delta=+1.0`, 95% CI `[-0.8, 2.7]`, `P(Delta<=0)=14.1%`. Per-budget
  deltas: `50k -0.2`, `100k +0.4`, `200k +1.3`, `300k +1.2`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `drums_crescendo +8.46`,
  `drums_pendulum +7.40`, `syncopated_switchback +6.48`,
  `grain_staircase +6.09`, `leap_cadence +5.64`, and `dense_sprint +5.59`.
  Largest `300k` row wins included `drums_crescendo` seed 0 `+60.9`,
  `drums_pendulum` seed 4 `+52.3`, `dense_sprint` seed 10 `+50.2`, and
  `syncopated_switchback` seed 10 `+44.8`.
- Notable regressions: weighted losses on `drums_signature -6.78`,
  `solo_run -5.10`, `soar_settle -4.81`, `drums_swell -4.57`,
  `pop_train -4.54`, and `drums_tide -4.45`. Largest `300k` row losses
  included `skyline_push` seed 10 `-65.6`, `soar_settle` seed 11 `-58.5`,
  `drums_signature` seed 5 `-54.7`, and `rhythm_ladder` seed 11 `-53.0`.
- Diagnostics: flat extra breadth shifted useful weak-row basins but reduced
  terminal feedback. At `300k`, samples rose `2949782 -> 3081263`, viable
  candidates rose `1641874 -> 1700218`, but unique full evaluations fell
  `9639 -> 8403`, tail improvements fell `2129 -> 2069`, and repair accepts
  fell `1647 -> 1575`. The positive but inconclusive signal suggests extra
  breadth should be concentrated on mature weak incumbents rather than applied
  globally.
- Status: reverted; no accepted improvement.

## quality-weak-breadth-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: flat `28` quality candidates had a positive but inconclusive
  signal because it helped weak rows while globally starving terminal feedback.
  Keep the accepted `24` default, but add up to four deterministic extra
  quality samples only for mature searches with a passing incumbent whose
  `axis_quality` is below a smooth weak-row threshold.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily added a
  `qualitySampleCount` ramp using incumbent `axis_quality`, budget maturity,
  unique full-evaluation pressure, and a node-stable hash; threaded the same
  count through main quality expansion and near-tail completion.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/quality-weak-breadth-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 617.7`,
  `Delta=-0.0`, 95% CI `[-0.1, 0.0]`, `P(Delta<=0)=53.5%`. Per-budget
  deltas: `50k +0.0`, `100k -0.0`, `200k +0.0`, `300k -0.0`. Validity was
  unchanged at all budgets.
- Notable improvements: tiny weighted wins on `big_air_ramp +0.25`,
  `skyline_push +0.16`, `drums_pendulum +0.07`, and `terrace_sprint +0.06`.
  Largest `300k` row wins were `big_air_ramp` seed 2 `+5.6`, `skyline_push`
  seed 11 `+4.1`, and `drums_pendulum` seed 6 `+2.5`.
- Notable regressions: weighted losses on `pop_train -0.68`,
  `canyon_steps -0.12`, `leap_cadence -0.06`, `tiny_dance -0.02`, and
  `syncopated_lift -0.02`. Largest `300k` row loss was `pop_train` seed 5
  `-17.7`.
- Diagnostics: the gate was too narrow/late to materially change the search. At
  `300k`, samples rose only `2949782 -> 2951525`, viable candidates barely moved
  `1641874 -> 1641911`, unique full evaluations slipped `9639 -> 9625`, and
  tail improvements slipped `2129 -> 2126`. This captured neither the useful
  diversity from flat `28` nor enough extra terminal feedback to matter.
- Status: reverted; no accepted improvement.

## low-air-rideout-cap-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: the worst 300k rows show low-air targets, especially
  `drums_pendulum`, consistently over-achieving air. The contact-centered
  generator caps air-targeted ride-out at `55%` of the time to the next contact;
  smoothly raising that cap only for low air might let dense low-air rows stay
  grounded longer without touching high-air behavior.
- Code changes made: in `scripts/v0/arc_placement.ts`, temporarily raised the
  air-targeted post-length safe cap by up to `+0.18` using a smooth pressure from
  `air=0.45` to `air=0.15`.
- Golden command: `GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4,5 LR_ENGINE=wasm npm run golden -- --jobs=12 --specs=drums_pendulum,tiny_dance,pop_train,big_air_ramp,canyon_steps,syncopated_lift,skyline_push --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-low-air-rideout-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`; paired
  slice headline `539.5 -> 488.5`, `Delta=-51.1`, 95% CI `[-113.9, 1.0]`,
  `P(Delta<=0)=88.4%`. Per-budget deltas: `100k -188.8`, `300k -5.2`.
  Validity fell on the slice at `100k` from `100% -> 93%`.
- Notable improvements: none large enough to justify canonical spend.
- Notable regressions: `drums_pendulum` worsened sharply on the live slice
  (`seed 0` around `483 -> 439`, `seed 4` around `477 -> 370` at `300k`), and
  first-complete validity degraded at `100k`.
- Diagnostics: the low-air failure is not just a too-short ride-out cap. Longer
  low-air post lines crowd dense continuations and damage the race to a complete
  track before the scorer can exploit the lower-air geometry.
- Status: reverted after probe; no canonical run and no accepted improvement.

## mature-avg-fwd-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: full `LR_FWD_EVAL=avg:2:6` and `best:2:3` probes showed high-budget
  gains on amplitude/elevation-heavy rows but severe `100k` starvation. Keep the
  accepted default `greedy:2` at low budgets and smoothly switch a deterministic
  fraction of mature nodes to `avg:2:6`, reaching full `avg` near `300k`.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily added a
  mature forward-eval config helper using smooth budget pressure from `150k` to
  `300k` and a node-stable hash to select `avg:2:6` for the default ranker only.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-fwd-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `617.7 -> 616.6`,
  `Delta=-1.0`, 95% CI `[-6.1, 4.1]`, `P(Delta<=0)=66.0%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k -1.7`, `300k -1.1`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `pop_train +30.33`,
  `leap_cadence +27.61`, `float_bounds +21.22`, `big_air_ramp +19.53`,
  `glide_stairs +19.07`, `soar_settle +18.91`, and `rolling_hills +18.12`.
  Largest `300k` row wins included `solo_run` seed 3 `+112.4`, `soar_settle`
  seed 5 `+106.8`, `leap_cadence` seed 3 `+97.3`, and `float_bounds` seed 9
  `+73.2`.
- Notable regressions: weighted losses on `drums_tide -37.13`,
  `drums_pulse -29.55`, `swoop_dive -26.38`, `drums_crosscut -24.59`,
  `drums_dropout -21.19`, and `drums_zigzag -16.66`. Largest `300k` losses
  included `drums_breath` seed 1 `-149.3`, `verse_chorus` seed 7 `-147.5`,
  `drums_signature` seed 1 `-144.8`, and `drums_crosscut` seed 10 `-138.3`.
- Diagnostics: broad `avg` moved the axis errors in the right direction for the
  new axes (`300k` amplitude MAE `0.1369 -> 0.1217`, air MAE `0.0780 -> 0.0719`,
  elevation MAE `0.0981 -> 0.0976`) but worsened speed MAE
  `0.0582 -> 0.0690` and starved search conversion. At `300k`, sampled
  candidates rose `2949782 -> 3064004`, but viable candidates fell
  `1641874 -> 1561035`, unique full evaluations fell `9639 -> 8703`, tail
  successes fell `8657 -> 6555`, and tail improvements fell `2129 -> 1673`.
  The signal is useful only for amplitude/elevation rows, not as a global ranker.
- Status: broad version not kept; superseded by a follow-up axis-gated attempt.

## mature-avg-vertical-01

- Baseline used: `tail-window-extra-04` at commit `78309a3`.
- Hypothesis: the broad mature `avg:2:6` ranker improved air/amplitude/elevation
  axes but regressed drum-only rows by starving terminal feedback. Gate the same
  smooth mature ranker blend to gaps whose resolved targets include `amplitude`
  or `elevation`, so air/speed-only rows keep the accepted `greedy:2` path.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, kept the mature
  budget pressure from `150k` to `300k`, but added an axis gate so the default
  ranker switches a deterministic fraction of nodes to `avg:2:6` only when the
  current gap targets amplitude or elevation. Explicit `LR_FWD_EVAL` overrides
  still bypass this default-only policy.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-vertical-01`
- Decide result: `VERDICT: ACCEPT`; headline `617.7 -> 621.2`,
  `Delta=+3.5`, 95% CI `[0.1, 7.1]`, `P(Delta<=0)=2.2%`. Per-budget deltas:
  `50k +0.0`, `100k +0.0`, `200k +1.0`, `300k +7.0`. Validity was unchanged
  at all budgets.
- Notable improvements: weighted wins on `pop_train +30.33`,
  `leap_cadence +27.61`, `float_bounds +21.22`, `big_air_ramp +19.53`,
  `glide_stairs +19.07`, `soar_settle +18.91`, `rolling_hills +18.12`, and
  `rolling_drop +12.89`. Largest `300k` row wins included `soar_settle` seed 5
  `+106.8`, `leap_cadence` seed 3 `+97.3`, `leap_cadence` seed 8 `+92.9`,
  `float_bounds` seed 9 `+73.2`, and `pop_train` seed 5 `+59.3`.
- Notable regressions: weighted losses on `swoop_dive -26.38`,
  `dense_echo_climb -9.12`, `ridge_pulse -6.89`, `canyon_steps -4.60`,
  `terrace_sprint -3.33`, and `summit_push -2.64`. Largest `300k` losses
  included `swoop_dive` seed 4 `-81.0`, `swoop_dive` seed 10 `-65.6`,
  `canyon_steps` seed 1 `-61.8`, `dense_echo_climb` seed 0 `-54.9`, and
  `ridge_pulse` seed 7 `-38.9`.
- Diagnostics: the axis gate preserved air/speed-only drum rows (`drums_*`
  weighted deltas mostly `0.00`) while retaining the new-axis improvements. At
  `300k`, amplitude MAE improved `0.1369 -> 0.1217`, air MAE improved
  `0.0780 -> 0.0755`, elevation MAE nudged `0.0981 -> 0.0976`, and speed MAE
  only slightly regressed `0.0582 -> 0.0590`. Search conversion still costs
  budget on vertical rows (`300k` unique full evaluations `9639 -> 8866`, tail
  improvements `2129 -> 1857`), but the targeted quality gain outweighs it.
- Status: kept and committed; new baseline for subsequent attempts.

## mature-avg-amplitude-01

- Baseline used: `mature-avg-vertical-01` at commit `8ac5153`.
- Hypothesis: the accepted vertical gate's losses were concentrated in
  elevation-only `swoop_dive`, while many amplitude rows retained their gains.
  Narrow the mature `avg:2:6` blend from amplitude-or-elevation targets to
  amplitude-targeted gaps only, letting pure elevation rows return to the
  default `greedy:2` ranker.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  the axis gate from `targets.amplitude || targets.elevation` to
  `targets.amplitude` only.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-amplitude-01`
- Decide result: `VERDICT: INCONCLUSIVE`; headline `621.2 -> 621.3`,
  `Delta=+0.1`, 95% CI `[-1.5, 1.9]`, `P(Delta<=0)=50.1%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k +0.3`, `300k -0.1`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `swoop_dive +26.38` and
  `summit_push +2.64`. Largest `300k` row wins were mostly `swoop_dive`,
  including seed 4 `+81.0`, seed 10 `+65.6`, seed 8 `+58.1`, seed 3 `+56.3`,
  and seed 5 `+50.5`.
- Notable regressions: weighted losses on `rolling_hills -18.12`,
  `climb_terrace -6.45`, and `mixed_grade -3.81`. Largest `300k` row losses
  included `rolling_hills` seed 10 `-55.6`, `climb_terrace` seed 8 `-55.2`,
  `rolling_hills` seed 0 `-45.1`, seed 2 `-42.6`, and seed 3 `-39.7`.
- Diagnostics: the change mostly swapped pure-elevation winners and losers
  rather than adding a new robust signal. At `300k`, it spent more search on
  fewer sampled candidates relative to the accepted vertical gate: unique full
  evaluations `8866 -> 9333`, duplicate full evaluations `3216 -> 3392`, tail
  completion attempts `7532 -> 8106`, and tail improvements `1857 -> 1897`.
  The extra terminal work was not enough to convert into a reliable headline
  gain.
- Status: reverted; no commit.

## probe-vertical-quality-breadth-01

- Baseline used: `mature-avg-vertical-01` at commit `8ac5153`.
- Hypothesis: flat `HANDOFF_QUALITY_N_CAND=28` previously had a positive but
  inconclusive signal, while the accepted mature vertical ranker now gives
  amplitude/elevation gaps a better way to use extra geometry. Add up to four
  extra quality candidates only on amplitude/elevation-targeted gaps, smoothly
  fading from `150k` to `300k`, and leave explicit `LR_QUALITY_NCAND` overrides
  unchanged.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily threaded
  `handoffQualitySampleCount` through main quality expansion and near-tail
  suffix completion. The helper added deterministic node-hash fractional extra
  candidates for vertical-axis gaps only.
- Golden command: `GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4,5 LR_ENGINE=wasm npm run golden -- --jobs=12 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift,drums_pendulum,drums_crescendo,drums_signature --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-vertical-quality-breadth-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`; paired
  slice headline `602.4 -> 602.0`, `Delta=-0.4`, 95% CI `[-2.9, 1.9]`,
  `P(Delta<=0)=60.2%`. Per-budget deltas: `200k -0.1`, `300k -0.5`.
  Validity was unchanged on the slice.
- Notable improvements: weighted wins on `big_air_ramp +5.92`,
  `ridge_pulse +5.44`, `dense_echo_climb +4.70`, `swoop_dive +4.66`, and
  `canyon_steps +1.20`.
- Notable regressions: weighted losses on `rolling_hills -5.64`,
  `leap_cadence -5.63`, `syncopated_lift -5.55`, `valley_bounce -5.34`,
  `float_bounds -4.63`, and `soar_settle -3.21`.
- Diagnostics: the targeted extra breadth did increase viable candidates on the
  slice (`300k` `378663 -> 390850`) but starved terminal feedback:
  unique full evaluations fell `2709 -> 2383`, tail attempts fell
  `2280 -> 2020`, and tail improvements fell `503 -> 489`. Extra vertical
  geometry is still too expensive unless it is paired with a cheaper evaluation
  or a stronger selection signal.
- Status: reverted after probe; no canonical run and no commit.

## probe-repair-main-margin11-full200-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: `LR_REPAIR_MAIN_MARGIN=1.2` helped severe rows such as
  `pop_train` but starved repair too much. A smaller proportional delay
  (`1.1 * firstCompletionFrame`) might let the main frontier produce a better
  incumbent while preserving most of the repair tail.
- Code changes made: none; probed the existing override
  `LR_REPAIR_MAIN_MARGIN=1.1` against the default `1.0`.
- Golden command: `LR_ENGINE=wasm LR_REPAIR_MAIN_MARGIN=1.1 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-repair-main-margin11-full200-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `642.9 -> 642.8`,
  `Delta=-0.1`, 95% CI `[-0.9, 0.9]`, `P(Delta<=0)=57.3%`.
  Per-budget deltas were `200k -0.2` and `300k +0.0`; validity was unchanged.
- Notable improvements: weighted wins on `soar_settle +5.34`,
  `terrace_sprint +4.59`, `switchback_pop +2.67`,
  `drums_pendulum +2.53`, `pop_train +2.09`, `summit_push +1.98`,
  and `float_bounds +1.15`.
- Notable regressions: weighted losses on `swoop_dive -3.98`,
  `opening_burst -2.96`, `drums_tide -2.71`, `rhythm_ladder -2.15`,
  `rolling_hills -1.95`, `leap_cadence -1.93`,
  `climb_terrace -1.92`, and `solo_run -1.79`.
- Diagnostics: the smaller margin still traded away accepted repair work. At
  `200k`, full evaluations fell `9031 -> 7943`, unique full evaluations fell
  `6640 -> 6023`, and repair accepts fell `1215 -> 984`, even though tail
  improvements rose `1708 -> 1758`. At `300k`, unique full evaluations fell
  `9301 -> 8853` and repair accepts fell `1620 -> 1431`, while tail
  improvements rose `2102 -> 2199`. Delaying repair globally reshapes which
  rows win, but it does not convert budget into enough accepted improvements.
- Status: not kept; env-only probe, no canonical run and no commit.

## probe-mature-avg-divefade-01

- Baseline used: `mature-avg-vertical-01` at commit `8ac5153`.
- Hypothesis: the accepted mature `avg:2:6` gate helps climb/rolling elevation
  rows but hurts dive-heavy elevation rows. Keep amplitude targets unchanged,
  but multiply the mature `avg` pressure for elevation-only targets by a smooth
  elevation pressure so true dives use the default `greedy:2` path.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily replaced
  the boolean vertical-axis gate with `matureForwardEvalAxisPressure`. First
  probe used elevation pressure `smoothstep((elevation - 0.42) / 0.16)`, then a
  narrowed dive-only pressure `smoothstep((elevation - 0.25) / 0.15)`.
- Golden commands:
  - `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade --archive-dir=generated/golden-runs/probe-mature-avg-uphill-02`
  - `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade --archive-dir=generated/golden-runs/probe-mature-avg-divefade-01`
- Decide results: both indicative, non-promotable. Broad pressure:
  `VERDICT: INCONCLUSIVE`, slice headline `635.9 -> 637.9`,
  `Delta=+1.9`, 95% CI `[-8.7, 15.1]`, `P(Delta<=0)=39.3%`.
  Narrow dive-only pressure: `VERDICT: INCONCLUSIVE`, slice headline
  `635.9 -> 638.8`, `Delta=+2.9`, 95% CI `[0.0, 9.0]`,
  `P(Delta<=0)=32.7%`. Both used the five pure-elevation specs across all
  canonical seeds and budgets.
- Notable improvements: the broad pressure recovered `swoop_dive +24.83`
  weighted on the slice but regressed `rolling_hills -12.39` and
  `climb_terrace -7.01`. The narrowed pressure preserved all non-dive
  elevation specs byte-identically and improved only `swoop_dive +13.52`
  weighted (`300k` mean `+19.77`, max row `+54.0`).
- Diagnostics: target-value pressure is a real signal for dive rows, but the
  clean version affects only one canonical spec. Diluted over the full 40-spec
  board, the expected headline gain is too small and too concentrated to justify
  a canonical run by itself.
- Status: reverted after probes; no canonical run and no commit.

## repair-main-margin-01

- Baseline used: `mature-avg-vertical-01` at commit `8ac5153`.
- Hypothesis: immediate repair after first completion may be starving rows where
  the main frontier would find a better complete handoff shortly after the first
  one. Raise the default repair split margin from `1.0` to `1.35`, leaving the
  existing repair budget gate and explicit `LR_REPAIR_MAIN_MARGIN` overrides
  intact.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  the default `LR_REPAIR_MAIN_MARGIN` fallback from `1.0` to `1.35`.
- Golden commands:
  - Probe: `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4,5 npm run golden -- --jobs=12 --specs=drums_pendulum,tiny_dance,big_air_ramp,skyline_push,syncopated_lift,terrace_sprint,switchback_pop,canyon_steps,dense_echo_climb,swoop_dive,drums_crescendo,drums_signature,opening_burst,solo_run --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-repair-main-margin-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/repair-main-margin-01`
- Decide result: canonical `VERDICT: INCONCLUSIVE`; headline
  `621.2 -> 621.3`, `Delta=+0.1`, 95% CI `[-0.8, 1.2]`,
  `P(Delta<=0)=43.9%`. Per-budget deltas: `50k +0.0`, `100k +1.2`,
  `200k +0.1`, `300k -0.2`. Validity was unchanged at all budgets.
- Notable improvements: weighted wins on `drums_pendulum +8.36`,
  `soar_settle +3.28`, `pop_train +3.10`, `terrace_sprint +2.72`,
  `canyon_steps +2.45`, `tiny_dance +2.39`, `skyline_push +2.27`, and
  `big_air_ramp +1.50`.
- Notable regressions: weighted losses on `drums_tide -3.67`,
  `drums_breath -2.88`, `leap_cadence -2.67`, `float_bounds -2.55`,
  `opening_burst -2.10`, `rhythm_ladder -1.83`, `solo_run -1.69`, and
  `drums_pulse -1.66`.
- Diagnostics: the probe signal was real at `100k`, but the constant margin
  hurt high-budget conversion. At `100k`, sampled candidates fell
  `958882 -> 937637`, unique full evaluations fell `3711 -> 3400`, repair
  restarts rose `1619 -> 4147`, accepts fell `646 -> 430`, and reconverged
  repairs fell `973 -> 697`. At `300k`, unique full evaluations fell
  `8866 -> 8024`, repair restarts rose `4086 -> 5403`, accepts fell
  `1355 -> 1098`, and the score slightly regressed.
- Status: not kept; superseded by a budget-faded follow-up.

## repair-main-fade-01

- Baseline used: `mature-avg-vertical-01` at commit `8ac5153`.
- Hypothesis: the `1.35` repair split margin appears useful around `100k`, but
  it wastes too much high-budget search. Apply the larger margin only where the
  low/mid-budget signal exists, fading smoothly from `1.35` at `100k` to the
  accepted `1.0` behavior at `300k`; explicit `LR_REPAIR_MAIN_MARGIN` overrides
  remain constant.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily added a
  default-only `repairMainMargin` helper using `smoothstep` over budget and
  changed the main search stop condition to use that faded value.
- Golden commands:
  - Probe: `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4,5 npm run golden -- --jobs=12 --specs=drums_pendulum,tiny_dance,big_air_ramp,skyline_push,syncopated_lift,terrace_sprint,switchback_pop,canyon_steps,dense_echo_climb,swoop_dive,drums_crescendo,drums_signature,opening_burst,solo_run --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-repair-main-fade-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/repair-main-fade-01`
- Decide result: canonical `VERDICT: INCONCLUSIVE`; headline
  `621.2 -> 621.4`, `Delta=+0.2`, 95% CI `[-0.3, 0.9]`,
  `P(Delta<=0)=21.2%`. Per-budget deltas: `50k +0.0`, `100k +1.2`,
  `200k +0.1`, `300k +0.0`. Validity was unchanged at all budgets.
- Notable improvements: weighted wins on `terrace_sprint +3.23`,
  `pop_train +2.60`, `soar_settle +2.17`, `canyon_steps +1.61`,
  `valley_bounce +1.60`, `big_air_ramp +1.27`, `float_bounds +1.27`, and
  `skyline_push +1.22`.
- Notable regressions: weighted losses on `climb_terrace -1.59`,
  `drums_breath -1.41`, `rolling_drop -1.03`, `leap_cadence -0.85`,
  `grain_staircase -0.79`, `opening_burst -0.78`, and
  `rolling_hills -0.68`.
- Diagnostics: the fade made the intended budgets byte-identical: `50k` and
  `300k` compile stats were unchanged from baseline. At `100k`, it preserved
  the useful extra tail improvements (`1191 -> 1210`) but reduced unique full
  evaluations (`3711 -> 3400`) and repair accepts (`646 -> 430`). At `200k`,
  unique full evaluations fell `6551 -> 6063` while tail improvements rose
  `1623 -> 1712`. The signal was smoother than the constant margin, but still
  not strong enough for canonical acceptance.
- Status: reverted after canonical decide; no commit.

## probe-mature-avg-start75-span125-100k-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: the accepted mature average ranker only affects `200k`; start
  the same smooth ramp earlier so `100k` receives some vertical average
  pressure without changing the already-full `200k`/`300k` behavior.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `MATURE_AVG_FWD_EVAL_START_FRAMES` from `100_000` to `75_000` and
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `100_000` to `125_000`.
  `MATURE_AVG_FWD_EVAL_BRANCH` stayed at `2`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start75-span125-100k-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` against
  `mature-avg-full200-01`; `100k` score `615.1 -> 616.7`, `Delta=+1.5`,
  95% CI `[-1.1, 5.0]`, `P(Delta<=0)=13.4%`. Validity stayed `100%`.
- Notable improvements/regressions: directionally positive but not strong
  enough to promote directly; it suggested that `100k` benefits from earlier
  average-ranker pressure.
- Diagnostics: only the `100k` grid was run. The smooth ramp avoided a hard
  budget threshold, but the pressure at `100k` was light.
- Status: not kept directly; superseded by stronger timing variants.

## probe-mature-avg-start50-span150-100k-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: move the mature average ranker ramp even earlier while keeping a
  long fade, giving `100k` moderate pressure and leaving `200k`/`300k` at full
  pressure.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `MATURE_AVG_FWD_EVAL_START_FRAMES` from `100_000` to `50_000` and
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `100_000` to `150_000`.
  `MATURE_AVG_FWD_EVAL_BRANCH` stayed at `2`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start50-span150-100k-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` against
  `mature-avg-full200-01`; `100k` score `615.1 -> 617.5`, `Delta=+2.3`,
  95% CI `[-1.3, 6.7]`, `P(Delta<=0)=10.1%`. Validity stayed `100%`.
- Notable improvements/regressions: better than the `75k/125k` ramp, still
  short of acceptance on the `100k` slice.
- Diagnostics: the stronger early pressure improved `100k` more than the
  lighter ramp, indicating the useful part of the timing curve is closer to
  `50k` than `75k`.
- Status: not kept directly; superseded by `start50/span100`.

## mature-avg-start50-span100-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: keep the same smooth mature average ranker ramp shape, but start
  it at `50k` so `100k` gets half pressure, while `200k`/`300k` remain fully
  saturated and `50k` remains unchanged.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_START_FRAMES` from `100_000` to `50_000`.
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` stayed at `100_000`, and
  `MATURE_AVG_FWD_EVAL_BRANCH` stayed at `2`.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start50-span100-100k-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-start50-span100-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `625.9 -> 626.6`,
  `Delta=+0.7`, 95% CI `[0.0, 1.5]`, `P(Delta<=0)=2.5%`. Per-budget
  deltas: `50k +0.0`, `100k +4.6`, `200k +0.0`, `300k +0.0`. Validity was
  unchanged (`50k 97% -> 97%`; `100k`, `200k`, and `300k` stayed
  `100% -> 100%`).
- Notable improvements: the gain was isolated to `100k`, with weighted wins on
  `pop_train +6.39`, `big_air_ramp +4.30`, `leap_cadence +3.32`,
  `rolling_hills +3.22`, `rolling_drop +3.18`, `soar_settle +2.97`,
  `glide_stairs +2.60`, `valley_bounce +2.07`, `syncopated_lift +1.72`,
  and `float_bounds +1.72`.
- Notable regressions: weighted losses on `swoop_dive -4.13`,
  `canyon_steps -2.63`, `dense_echo_climb -0.87`, and `ridge_pulse -0.84`.
  The largest row-level regression was `canyon_steps` at `100k`
  (`min=-147.5`), while the largest row-level improvements included
  `pop_train` (`max=199.3`) and `soar_settle` (`max=128.7`).
- Diagnostics: `50k`, `200k`, and `300k` compile stats were unchanged, as
  expected from the ramp. At `100k`, candidates sampled rose
  `958882 -> 966277`, viable candidates rose `549087 -> 551200`, while full
  evaluations fell slightly `5084 -> 4956`, unique full evaluations fell
  `3711 -> 3631`, tail improvements fell `1191 -> 1166`, and repair accepts
  fell `646 -> 627`. Despite slightly less terminal work, selected vertical
  arcs improved: `100k` MAE improved on air `0.0862 -> 0.0844`, speed
  `0.0658 -> 0.0651`, elevation `0.1016 -> 0.1008`, and amplitude
  `0.1414 -> 0.1339`.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `mature-avg-start50-span100-01`.

## mature-avg-start50-span75-01

- Baseline used: `mature-avg-start50-span100-01` at commit `e6608a2`.
- Hypothesis: the accepted `start50/span100` ramp improved `100k` at half
  mature-ranker pressure. Shorten the smooth span to `75k` so `100k` receives
  stronger pressure, while `50k` remains zero-pressure and `200k`/`300k`
  remain fully saturated.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `100_000` to `75_000`.
  `MATURE_AVG_FWD_EVAL_START_FRAMES` stayed at `50_000`, and
  `MATURE_AVG_FWD_EVAL_BRANCH` stayed at `2`.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start50-span75-100k-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-start50-span75-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `626.6 -> 627.0`,
  `Delta=+0.4`, 95% CI `[-0.2, 1.1]`, `P(Delta<=0)=8.5%`. Per-budget
  deltas: `50k +0.0`, `100k +2.7`, `200k +0.0`, `300k +0.0`. Validity was
  unchanged (`50k 97% -> 97%`; `100k`, `200k`, and `300k` stayed
  `100% -> 100%`).
- Notable improvements: the gain was isolated to `100k`, with weighted wins on
  `pop_train +3.94`, `skyline_push +3.73`, `leap_cadence +3.49`,
  `float_bounds +3.13`, `soar_settle +1.66`, `glide_stairs +1.22`,
  `rolling_hills +1.10`, `big_air_ramp +0.86`, `climb_terrace +0.84`,
  `terrace_sprint +0.84`, and `mixed_grade +0.74`.
- Notable regressions: weighted losses on `canyon_steps -1.89`,
  `swoop_dive -1.37`, `switchback_pop -0.66`, `dense_echo_climb -0.48`,
  `rolling_drop -0.46`, `valley_bounce -0.32`, `ridge_pulse -0.16`, and
  `summit_push -0.15`. Largest row-level movement included `skyline_push`
  max `+142.9`, `soar_settle` max `+130.7` / min `-161.8`, and
  `canyon_steps` min `-115.2`.
- Diagnostics: `50k`, `200k`, and `300k` compile stats were unchanged. At
  `100k`, candidates sampled rose `966277 -> 970476`, viable candidates rose
  `551200 -> 552594`, full evaluations rose `4956 -> 5229`, unique full
  evaluations rose `3631 -> 3806`, tail improvements rose `1166 -> 1188`,
  repair accepts rose `627 -> 650`, and repair reconvergence rose
  `974 -> 1014`. Axis diagnostics at `100k` improved air MAE
  `0.0844 -> 0.0839`, speed MAE `0.0651 -> 0.0650`, elevation MAE
  `0.1008 -> 0.1007`, and amplitude MAE `0.1339 -> 0.1303`.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `mature-avg-start50-span75-01`.

## probe-mature-avg-start50-span50-100k-01

- Baseline used: `mature-avg-start50-span75-01` at commit `f9fcc20`.
- Hypothesis: full mature average ranker pressure at `100k` may continue the
  accepted span trend while still leaving `50k` at zero pressure and
  `200k`/`300k` fully saturated.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `75_000` to `50_000`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start50-span50-100k-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; `100k` score
  `622.4 -> 625.7`, `Delta=+3.3`, 95% CI `[-4.1, 8.7]`,
  `P(Delta<=0)=12.4%`. Validity stayed `100%`.
- Notable improvements: large row wins on `soar_settle` seed `1`
  (`512.7 -> 687.3`, `+174.5`), `soar_settle` seed `4`
  (`499.1 -> 656.4`, `+157.3`), `canyon_steps` seed `2`
  (`441.2 -> 596.8`, `+155.6`), and `float_bounds` seed `2`
  (`475.6 -> 596.5`, `+120.8`).
- Notable regressions: the full-pressure boundary introduced a severe
  `pop_train` seed `3` collapse (`689.8 -> 252.6`, `-437.2`) plus losses on
  `soar_settle` seed `11` (`-116.1`), `pop_train` seed `11` (`-101.3`), and
  `valley_bounce` seed `3` (`-78.8`).
- Diagnostics: positive average but the outlier widened uncertainty beyond the
  accept threshold. Treat this as a useful upper bound rather than a promotable
  default.
- Status: not kept; superseded by intermediate span probing.

## mature-avg-start50-span65-01

- Baseline used: `mature-avg-start50-span75-01` at commit `f9fcc20`.
- Hypothesis: an intermediate span can capture most of the stronger `100k`
  mature-ranker pressure while avoiding the full-pressure `span50` outlier.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `75_000` to `65_000`.
  `MATURE_AVG_FWD_EVAL_START_FRAMES` stayed at `50_000`, and
  `MATURE_AVG_FWD_EVAL_BRANCH` stayed at `2`.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start50-span65-100k-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-start50-span65-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `627.0 -> 627.3`,
  `Delta=+0.3`, 95% CI `[-0.1, 0.7]`, `P(Delta<=0)=4.3%`. Per-budget
  deltas: `50k +0.0`, `100k +1.9`, `200k +0.0`, `300k +0.0`. Validity was
  unchanged (`50k 97% -> 97%`; `100k`, `200k`, and `300k` stayed
  `100% -> 100%`).
- Notable improvements: the gain was isolated to `100k`, with weighted wins on
  `canyon_steps +3.21`, `float_bounds +1.90`, `terrace_sprint +1.11`,
  `leap_cadence +1.03`, `rolling_drop +1.02`, `switchback_pop +1.00`,
  `rolling_hills +0.76`, `climb_terrace +0.63`, `syncopated_lift +0.39`,
  `dense_echo_climb +0.38`, `ridge_pulse +0.36`, and `pop_train +0.35`.
- Notable regressions: weighted losses on `swoop_dive -0.84`,
  `big_air_ramp -0.69`, and `soar_settle -0.22`. Largest row-level
  regression was `big_air_ramp` min `-124.8`, but this was much less damaging
  than the `span50` `pop_train` collapse.
- Diagnostics: `50k`, `200k`, and `300k` compile stats were unchanged. At
  `100k`, candidates sampled rose `970476 -> 972953`, full evaluations rose
  `5229 -> 5263`, unique full evaluations rose `3806 -> 3848`, duplicate full
  evaluations fell `1423 -> 1415`, and repair accepts rose `650 -> 654`.
  Tail improvements fell slightly `1188 -> 1178`, but selected tracks improved
  enough to win. Axis diagnostics at `100k` improved air MAE
  `0.0839 -> 0.0835`, speed MAE `0.0650 -> 0.0645`, elevation MAE
  `0.1007 -> 0.0985`, and amplitude MAE `0.1303 -> 0.1276`.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `mature-avg-start50-span65-01`.

## probe-mature-avg-start50-span60-100k-01

- Baseline used: `mature-avg-start50-span65-01` at commit `576fe54`.
- Hypothesis: `span65` is accepted and `span50` is too noisy; `span60` may be
  close enough to the boundary to capture additional `100k` upside without
  triggering the severe full-pressure outlier.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `65_000` to `60_000`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start50-span60-100k-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; `100k` score
  `624.4 -> 625.8`, `Delta=+1.4`, 95% CI `[-1.8, 5.1]`,
  `P(Delta<=0)=18.6%`. Validity stayed `100%`.
- Notable improvements: row wins on `soar_settle` seed `1` (`+179.7`),
  `big_air_ramp` seed `6` (`+150.6`), `soar_settle` seed `4` (`+145.7`),
  `canyon_steps` seed `2` (`+126.5`), and `soar_settle` seed `10`
  (`+103.3`).
- Notable regressions: the added pressure created a severe `float_bounds` seed
  `4` collapse (`602.3 -> 412.3`, `-190.0`), plus `pop_train` seed `11`
  (`-129.0`) and `soar_settle` seed `11` (`-88.7`).
- Diagnostics: the mean was positive but the new outliers made the paired
  decision too uncertain. This is below the canonical promotion threshold.
- Status: not kept; code reverted to `span65`.

## probe-mature-avg-start50-span62-100k-01

- Baseline used: `mature-avg-start50-span65-01` at commit `576fe54`.
- Hypothesis: a softer interpolation than `span60` might retain some upside
  while reducing boundary outliers.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `65_000` to `62_000`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000 --archive-dir=generated/golden-runs/probe-mature-avg-start50-span62-100k-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE`; `100k` score
  `624.4 -> 625.2`, `Delta=+0.8`, 95% CI `[-2.5, 4.5]`,
  `P(Delta<=0)=31.7%`. Validity stayed `100%`.
- Notable improvements: row wins on `soar_settle` seed `1` (`+179.7`),
  `big_air_ramp` seed `6` (`+150.6`), `soar_settle` seed `4` (`+145.4`),
  `canyon_steps` seed `2` (`+126.5`), and `soar_settle` seed `10`
  (`+103.3`).
- Notable regressions: similar boundary failures remained: `float_bounds` seed
  `4` (`-190.0`), `pop_train` seed `11` (`-125.6`), `soar_settle` seed `11`
  (`-88.7`), and `pop_train` seed `4` (`-76.0`).
- Diagnostics: weaker average than `span60` and worse confidence. The span
  sweep suggests `span65` is the stable point on the current seed grid.
- Status: not kept; code reverted to `span65`.

## mature-avg-branch1-current-01

- Baseline used: `mature-avg-start50-span65-01` at commit `576fe54`.
- Hypothesis: after moving the mature average forward-ranker ramp earlier and
  tightening it, the accepted `branch=2` setting may now be spending too much
  work on sibling forward rollouts. Dropping to `branch=1` should keep the
  mature average ranker active while freeing budget for reuse/brake/tail repair.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_BRANCH` from `2` to `1`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-branch1-current-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `627.3 -> 628.5`,
  `Delta=+1.2`, 95% CI `[-0.6, 3.2]`, `P(Delta<=0)=9.2%`. Per-budget
  deltas: `50k +0.0`, `100k +0.6`, `200k +2.0`, `300k +1.0`. Validity was
  unchanged (`50k 97% -> 97%`; `100k`, `200k`, and `300k` stayed
  `100% -> 100%`).
- Notable improvements: the strongest `300k` spec wins were `summit_push`
  `+11.4`, `syncopated_lift +8.9`, `dense_echo_climb +7.8`, `pop_train +7.6`,
  `swoop_dive +7.1`, `valley_bounce +4.7`, `soar_settle +4.6`, and
  `big_air_ramp +3.6`. Largest row wins were `pop_train` seed `11`
  (`616.98 -> 689.50`, `+72.52`), `syncopated_lift` seed `10` (`+44.48`),
  `valley_bounce` seed `1` (`+42.99`), `swoop_dive` seed `8` (`+36.37`), and
  `climb_terrace` seed `2` (`+32.23`).
- Notable regressions: biggest `300k` spec losses were `terrace_sprint -12.3`,
  `float_bounds -5.3`, `glide_stairs -2.9`, `rolling_hills -2.2`, and
  `mixed_grade -1.9`. Largest row losses were `terrace_sprint` seed `10`
  (`567.69 -> 484.60`, `-83.09`), `float_bounds` seed `2` (`-51.48`),
  `climb_terrace` seed `6` (`-39.76`), `terrace_sprint` seed `7` (`-28.14`),
  and `swoop_dive` seed `5` (`-25.65`).
- Diagnostics: the accepted gain came from smoother work allocation rather than
  a new geometry capability. At `300k`, sampled candidates rose
  `3010844 -> 3033956`, viable candidates rose `1664289 -> 1668288`, full
  evaluations rose `12536 -> 12586`, unique full evaluations rose
  `9301 -> 9416`, duplicate full evaluations fell `3235 -> 3170`, tail
  attempts rose `8658 -> 9356`, tail improvements rose `2102 -> 2174`, reuse
  successes rose `50802 -> 54842`, and brake successes rose `25157 -> 28774`.
  Axis MAE moved mostly through speed: at `300k`, air `0.0749 -> 0.0750`,
  speed `0.0565 -> 0.0552`, elevation `0.0967 -> 0.0964`, and amplitude
  `0.1197 -> 0.1214`. The remaining hard shape is still vertical/amplitude:
  `drums_pendulum` is the lowest `300k` spec, and `terrace_sprint` has the
  largest accepted-regression outlier.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `mature-avg-branch1-current-01`.

## probe-quality-ncand28-branch1-current-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: the accepted `branch=1` mature-ranker change freed high-budget
  terminal/repair capacity. Re-test the previously directionally positive wider
  quality candidate pool to see whether `28` quality candidates can now improve
  selected arc quality without starving completion too much.
- Code changes made: none; probed the existing override `LR_QUALITY_NCAND=28`.
- Golden command: `LR_ENGINE=wasm LR_QUALITY_NCAND=28 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-quality-ncand28-branch1-current-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `644.3 -> 645.0`,
  `Delta=+0.7`, 95% CI `[-1.6, 3.1]`, `P(Delta<=0)=26.8%`. Per-budget
  deltas were `200k +0.3` and `300k +1.0`; validity was unchanged.
- Notable improvements: strongest `300k` spec wins were `drums_pendulum +12.8`,
  `syncopated_switchback +12.5`, `drums_crescendo +11.4`, `drums_pulse +8.9`,
  `ridge_pulse +8.2`, and `float_bounds +7.0`. Largest row wins included
  `swoop_dive` seed `5` (`+61.7`), `drums_crescendo` seed `0` (`+60.9`),
  `float_bounds` seed `2` (`+54.6`), `drums_pendulum` seed `4` (`+52.3`), and
  `dense_sprint` seed `10` (`+50.2`).
- Notable regressions: largest `300k` spec losses were `swoop_dive -10.6`,
  `drums_signature -8.8`, `drums_swell -7.8`, `soar_settle -6.6`, and
  `solo_run -5.8`. Largest row losses were `drums_signature` seed `5`
  (`-54.7`), `rhythm_ladder` seed `11` (`-53.0`), `drums_swell` seed `0`
  (`-50.6`), `swoop_dive` seed `10` (`-48.8`), and `solo_run` seed `4`
  (`-48.1`).
- Diagnostics: the mechanism again traded terminal quantity for selected quality.
  At `300k`, candidates sampled rose `3033956 -> 3163526`, but full evaluations
  fell `12586 -> 10701`, unique full evaluations fell `9416 -> 8529`, and tail
  improvements fell `2174 -> 2153`. Axis MAE improved air
  `0.0750 -> 0.0737` and amplitude `0.1214 -> 0.1198`, but speed regressed
  `0.0552 -> 0.0556` and elevation regressed `0.0964 -> 0.0972`.
- Status: not kept; no code change and not strong enough to promote to a
  canonical run.

## probe-quality-ncand26-branch1-current-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: if `28` candidates over-spends but still has quality upside, a
  smaller midpoint at `26` may preserve the useful breadth with less terminal
  starvation.
- Code changes made: none; probed the existing override `LR_QUALITY_NCAND=26`.
- Golden command: `LR_ENGINE=wasm LR_QUALITY_NCAND=26 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-quality-ncand26-branch1-current-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `644.3 -> 644.4`,
  `Delta=+0.1`, 95% CI `[-2.1, 2.2]`, `P(Delta<=0)=46.8%`. Per-budget
  deltas were `200k -0.2` and `300k +0.3`; validity was unchanged.
- Notable improvements: strongest `300k` spec wins were `solo_run +14.0`,
  `drums_dropout +11.2`, `valley_bounce +9.2`, `drums_zigzag +6.2`, and
  `mixed_grade +5.4`. Largest row wins included `solo_run` seed `3` (`+91.3`),
  `drums_crescendo` seed `0` (`+56.9`), `solo_run` seed `5` (`+55.5`),
  `drums_zigzag` seed `4` (`+45.8`), and `drums_crosscut` seed `1` (`+44.3`).
- Notable regressions: largest `300k` spec losses were `swoop_dive -12.0`,
  `drums_signature -11.9`, `soar_settle -8.8`, `drums_breath -5.7`, and
  `grain_staircase -5.1`. Largest row losses were `rhythm_ladder` seed `11`
  (`-60.7`), `drums_breath` seed `8` (`-56.6`), `drums_signature` seed `5`
  (`-54.7`), `drums_tide` seed `1` (`-50.4`), and `drums_crescendo` seed `3`
  (`-44.0`).
- Diagnostics: `26` reduced the starvation relative to `28` but also washed out
  most of the quality signal. At `300k`, candidates sampled rose
  `3033956 -> 3093745`, full evaluations fell `12586 -> 11497`, unique full
  evaluations fell `9416 -> 8889`, and tail improvements rose only
  `2174 -> 2186`. Axis MAE moved slightly: air `0.0750 -> 0.0747`, speed
  `0.0552 -> 0.0547`, elevation `0.0964 -> 0.0969`, and amplitude
  `0.1214 -> 0.1213`.
- Status: not kept; no code change.

## probe-start-avg6-300k-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: the default start evaluator uses a two-contact greedy rollout,
  which can over-trust one brittle first arc. Try an average over six
  next-contact alternatives so the initial state is chosen for robust local
  continuation rather than one best path.
- Code changes made: none; probed the existing override
  `LR_START_EVAL=avg:2:6`.
- Golden command: `LR_ENGINE=wasm LR_START_EVAL=avg:2:6 npm run golden -- --jobs=32 --budgets=300000 --archive-dir=generated/golden-runs/probe-start-avg6-300k-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `300k` intersection; headline `646.9 -> 645.7`, `Delta=-1.1`,
  95% CI `[-4.7, 2.1]`, `P(Delta<=0)=75.4%`. Validity was unchanged.
- Notable improvements: strongest `300k` wins were `rolling_hills +12.0`,
  `drums_pendulum +11.5`, `float_bounds +7.6`, `rolling_drop +6.4`,
  `terrace_sprint +6.2`, `verse_chorus +6.0`,
  `syncopated_switchback +5.7`, and `rhythm_ladder +5.2`.
- Notable regressions: largest `300k` losses were `soar_settle -25.0`,
  `tiny_dance -10.6`, `dense_sprint -10.4`, `opening_burst -9.6`,
  `drums_signature -9.5`, `drums_swell -6.5`, `swoop_dive -6.2`, and
  `drums_zigzag -5.3`. Large row losses included `soar_settle` seed `8`
  (`-170.0`), `drums_signature` seed `0` (`-101.3`), `cold_start` seed `4`
  (`-84.2`), and `tiny_dance` seed `3` (`-83.2`).
- Diagnostics: the robust start average fixed some hard rows but moved too many
  specs onto weaker initial basins. Axis MAE at `300k` regressed slightly on
  air `0.0750 -> 0.0752`, elevation `0.0964 -> 0.0967`, and amplitude
  `0.1214 -> 0.1224`; speed was flat at `0.0552`.
- Status: not kept; env-only probe, no canonical run and no commit.

## probe-start-greedy1-300k-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: the two-contact start rollout may be overfitting downstream
  chain effects and spending too much startup evaluation. Try a cheaper
  one-contact greedy start evaluator that emphasizes the first controlled catch.
- Code changes made: none; probed the existing override
  `LR_START_EVAL=greedy:1`.
- Golden command: `LR_ENGINE=wasm LR_START_EVAL=greedy:1 npm run golden -- --jobs=32 --budgets=300000 --archive-dir=generated/golden-runs/probe-start-greedy1-300k-01`
- Decide result: indicative, non-promotable `VERDICT: REJECT` on the paired
  `300k` intersection; headline `646.9 -> 643.4`, `Delta=-3.4`, 95% CI
  `[-8.2, 0.5]`, `P(Delta<=0)=95.6%`. Validity was unchanged.
- Notable regressions: the weak-start failure was visible before the decision
  gate: the worst rows at `300k` were `tiny_dance` seed `3` (`424.86`),
  `drums_pendulum` seed `1` (`446.19`), `tiny_dance` seed `4` (`448.03`),
  `tiny_dance` seed `9` (`450.97`), and `tiny_dance` seed `6` (`451.24`).
- Diagnostics: a one-contact start score is too myopic for dense forward-
  dependent chains. It strongly hurt the already-hard low-air startup cases
  instead of solving their first-gap air overshoot, so the next mechanism should
  preserve the accepted `greedy:2` start evaluator.
- Status: not kept; env-only probe, no canonical run and no commit.

## probe-mature-avg-extreme-air-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: the accepted mature average ranker is currently gated to
  amplitude/elevation targets, leaving air-only rows like `drums_pendulum` on
  the brittle greedy forward ranker. Add a smooth target pressure for extreme
  air targets (`low` and `high`) so air-only rows get the robust ranker without
  reopening the broad global `avg` failure mode.
- Code changes made: temporarily replaced the boolean mature forward-eval axis
  gate in `scripts/v0/optimizer/handoff.ts` with a target-pressure helper:
  amplitude/elevation stayed at full pressure, while air-only targets received
  smooth pressure below `0.35` and above `0.65`. The existing smooth budget
  ramp and node-stable hash were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-mature-avg-extreme-air-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `100k`/`200k`/`300k` intersection; headline `641.1 -> 640.0`,
  `Delta=-1.1`, 95% CI `[-3.4, 0.8]`, `P(Delta<=0)=86.3%`. Per-budget
  deltas were `100k -1.1`, `200k -0.9`, and `300k -1.2`; validity was
  unchanged at all shared budgets.
- Notable improvements: the intended target did move in places. At `300k`,
  row wins included `dense_sprint` seed `2` (`+79.6`), `dense_sprint` seed
  `11` (`+65.5`), `drums_crescendo` seed `6` (`+55.2`), `drums_dropout` seed
  `0` (`+51.7`), and several `drums_pendulum` seeds, including seed `6`
  (`+97.6`) and seed `0` (`+40.5`) in the analyzer's curve view.
- Notable regressions: larger drum-chain losses dominated: `drums_crosscut`
  seed `11` (`-78.7`), `drums_breath` seed `7` (`-75.9`), `drums_tide`
  seed `1` (`-69.7`), `drums_crosscut` seed `7` (`-66.8`), and
  `drums_crosscut` seed `5` (`-65.2`).
- Diagnostics: the added pressure raised high-budget work slightly but did not
  convert to quality. At `300k`, sampled candidates rose about `+60` per row,
  viable candidates fell about `-28` per row, full evaluations rose
  `12586 -> 12975`, unique full evaluations rose `9416 -> 9635`, but tail
  improvements slipped `2174 -> 2167`. The failure is ranking churn on dense
  drum chains, not insufficient terminal feedback.
- Status: reverted after probe; no canonical run and no commit.

## probe-mature-reuse-w070-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: the accepted branch-count reduction freed budget and increased
  reuse success. A slightly higher mature reuse probability may give dense
  steady-state rows more cheap, validated catch options without broadening the
  expensive fresh candidate pool.
- Code changes made: temporarily changed
  `HANDOFF_REUSE_MATURE_EXTRA_WEIGHT` in
  `scripts/v0/optimizer/handoff.ts` from `0.35` to `0.70`. The existing smooth
  budget pressure, full-evaluation feedback pressure, and node-stable hash were
  unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-mature-reuse-w070-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `100k`/`200k`/`300k` intersection; headline `641.1 -> 641.0`,
  `Delta=-0.0`, 95% CI `[-0.1, 0.0]`, `P(Delta<=0)=89.8%`. Per-budget
  deltas were `100k +0.0`, `200k -0.0`, and `300k -0.1`; validity was
  unchanged.
- Notable improvements: small `300k` row wins on `ridge_pulse` seed `8`
  (`+4.62`), `opening_burst` seed `8` (`+3.55`), `switchback_pop` seed `8`
  (`+1.13`), and `dense_echo_climb` seed `6` (`+0.92`).
- Notable regressions: small but broader `300k` losses on `summit_push` seed
  `11` (`-9.43`), `mixed_grade` seed `3` (`-8.96`), `leap_cadence` seed `3`
  (`-6.97`), and `dense_sprint` seed `0` (`-3.79`).
- Diagnostics: the higher pressure barely changed work and did not improve
  conversion. At `300k`, full evaluations were unchanged at `12536`, unique
  full evaluations slipped `9416 -> 9388`, reuse successes rose only
  `54842 -> 55496`, tail attempts fell `9000 -> 8985`, and tail improvements
  slipped `2174 -> 2169`.
- Status: reverted after probe; no canonical run and no commit.

## probe-shallow-tail-feedback12-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: after branch `1`, shallow tail completion may keep spending on
  remaining-1/2 suffixes after enough full tracks already exist. Lower the
  smooth full-feedback scale from `24` to `12` so feedback throttles shallow
  tail work sooner while preserving high-remaining tail completion.
- Code changes made: temporarily changed
  `QUALITY_SHALLOW_TAIL_THROTTLE_FULL_FEEDBACK_SCALE` in
  `scripts/v0/optimizer/handoff.ts` from `24` to `12`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-shallow-tail-feedback12-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `100k`/`200k`/`300k` intersection; headline `641.1 -> 641.1`,
  `Delta=+0.0`, 95% CI `[-0.0, 0.0]`, `P(Delta<=0)=11.9%`. Per-budget
  deltas were `100k -0.0`, `200k -0.0`, and `300k +0.0`; validity was
  unchanged.
- Notable improvements/regressions: effects were sub-point and row-local, with
  the strongest signal at `300k` where `P(Delta<=0)=2%`. The change did not
  create broad spec movement, which is expected because it only touches shallow
  suffixes after terminal feedback exists.
- Diagnostics: at `300k`, tail attempts fell `9000 -> 8692`, remaining-1
  attempts fell `1179 -> 985`, remaining-2 attempts fell `755 -> 626`, full
  evaluations rose `12586 -> 12662`, unique full evaluations rose
  `9416 -> 9714`, duplicate full evaluations fell `3170 -> 2948`, and tail
  improvements stayed nearly flat (`2174 -> 2168`).
- Status: not kept directly; tuned to a stronger smooth feedback scale before
  canonical promotion.

## probe-shallow-tail-feedback6-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: the `12` probe showed that shallow-tail feedback moves work in
  the intended direction but is barely large enough. Lower the same smooth scale
  to `6` so shallow suffix throttling activates earlier once a row already has
  terminal feedback.
- Code changes made: temporarily changed
  `QUALITY_SHALLOW_TAIL_THROTTLE_FULL_FEEDBACK_SCALE` in
  `scripts/v0/optimizer/handoff.ts` from `24` to `6`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-shallow-tail-feedback6-01`
- Decide result: indicative, non-promotable `VERDICT: ACCEPT` on the paired
  `100k`/`200k`/`300k` intersection; headline `641.1 -> 641.1`,
  `Delta=+0.0`, 95% CI `[-0.0, 0.1]`, `P(Delta<=0)=6.0%`. Per-budget
  deltas were `100k +0.1`, `200k +0.0`, and `300k +0.0`; validity was
  unchanged.
- Notable improvements/regressions: the probe was intentionally small and
  smooth, with no large spec-specific swing. The positive signal was enough to
  justify a full canonical run, not enough to treat the probe itself as
  promotable.
- Diagnostics: compared with `12`, scale `6` applied the same mechanism more
  consistently across `100k`/`200k`/`300k`, reducing duplicate shallow-tail
  work while preserving the useful deeper tail depths.
- Status: promoted to canonical attempt `shallow-tail-feedback6-01`.

## shallow-tail-feedback6-01

- Baseline used: `mature-avg-branch1-current-01` at commit `dc91502`.
- Hypothesis: make the positive shallow-tail feedback probe the default and let
  the full canonical grid decide whether the work shift remains beneficial when
  `50k` is included.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `QUALITY_SHALLOW_TAIL_THROTTLE_FULL_FEEDBACK_SCALE` from `24` to `6`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/shallow-tail-feedback6-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `628.5 -> 628.5`,
  `Delta=+0.0`, 95% CI `[-0.0, 0.1]`, `P(Delta<=0)=6.0%`. Per-budget deltas:
  `50k +0.0`, `100k +0.1`, `200k +0.0`, `300k +0.0`. Validity was unchanged
  at all budgets (`50k 97% -> 97%`; `100k`, `200k`, and `300k` stayed
  `100% -> 100%`).
- Notable improvements: largest `300k` row wins were `rolling_hills` seed `0`
  (`+5.25`), `syncopated_switchback` seed `7` (`+3.52`),
  `grain_staircase` seed `2` (`+2.01`), `summit_push` seed `0` (`+1.98`),
  and `big_air_ramp` seed `4` (`+1.56`). Top `300k` spec means were
  `rolling_hills +0.43`, `syncopated_switchback +0.29`,
  `grain_staircase +0.17`, `summit_push +0.17`, and `big_air_ramp +0.13`.
- Notable regressions: largest `300k` row losses were `mixed_grade` seed `11`
  (`-2.28`), `drums_pendulum` seed `6` (`-1.12`), `canyon_steps` seed `3`
  (`-0.78`), and `tiny_dance` seed `3` (`-0.31`). Top `300k` spec mean losses
  were small: `mixed_grade -0.19`, `drums_pendulum -0.09`, and
  `tiny_dance -0.03`.
- Diagnostics: at `300k`, the accepted default reduced shallow tail attempts
  and improved terminal uniqueness. Tail bests/attempts changed
  `2174/9000 -> 2143/8389`; remaining-1 attempts fell `1179 -> 827` and
  remaining-2 attempts fell `755 -> 485`. Full evaluations rose
  `12586 -> 12691`, unique full evaluations rose `9416 -> 9957`, duplicate
  full evaluations fell `3170 -> 2734`, and unique full rate improved
  `74.8% -> 78.5%`. Candidate work changed only slightly at the suite level,
  and selected starts were unchanged.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `shallow-tail-feedback6-01`.

## probe-farback-zero62-01

- Baseline used: `shallow-tail-feedback6-01` at commit `0e0e7cb`.
- Hypothesis: the far-back frontier pulse scheduler barely fires under the
  accepted baseline, even on weak-axis incumbents with large lagged frontiers.
  Raise the smooth zero-pressure threshold from axis quality `0.50` to `0.62`
  so older passing branches are revisited earlier when the current incumbent is
  weak, without changing the interval endpoints or adding spec-specific logic.
- Code changes made: temporarily changed
  `QUALITY_FAR_BACK_ZERO_AXIS_QUALITY` in `scripts/v0/optimizer/handoff.ts`
  from `0.50` to `0.62`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,syncopated_lift,skyline_push,switchback_pop,terrace_sprint,cold_start,valley_bounce,canyon_steps,dense_sprint,drums_crescendo,drums_signature,drums_swell,drums_crosscut,drums_breath,drums_tide,rolling_hills,mixed_grade,swoop_dive --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-farback-zero62-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired 20-spec `100k`/`200k`/`300k` slice; headline `613.9 -> 613.9`,
  `Delta=+0.0`, 95% CI `[-1.6, 2.1]`, `P(Delta<=0)=55.5%`. Per-budget
  deltas were `100k +0.0`, `200k +0.2`, and `300k -0.1`; validity stayed
  `100% -> 100%`.
- Notable improvements: the intended target moved on several rows:
  `drums_pendulum` seed `8` improved `+73.98`, seed `3` improved `+43.40`,
  seed `7` improved `+29.79`, seed `5` improved `+18.50`, and
  `valley_bounce` seed `3` improved `+17.94`.
- Notable regressions: the same mechanism caused large ranking churn:
  `drums_signature` seed `1` regressed `-88.16`, `drums_crescendo` seed `3`
  regressed `-62.53`, and `drums_pendulum` seeds `1`, `0`, and `4` regressed
  `-36.53`, `-26.56`, and `-18.03`.
- Diagnostics: far-back pulses on the slice rose from `14` to `41` at `300k`,
  so the threshold did activate. It did not improve conversion: common-row
  `300k` score fell `-0.16`, full evaluations on the slice were `5356`, unique
  full evaluations were `4311`, and the largest changes were seed-specific
  reshuffles rather than broad quality gains. The mechanism is too blunt in this
  form.
- Status: reverted after probe; no canonical run and no commit.

## probe-repair-main-margin11-01

- Baseline used: `shallow-tail-feedback6-01` at commit `0e0e7cb`.
- Hypothesis: the earlier `1.2` repair main-margin probe let the main frontier
  run too long and starved repair. A gentler `1.1 * firstCompletionFrame`
  split might strengthen the terminal pool before repair while preserving most
  of the repair budget.
- Code changes made: none; probed the existing override
  `LR_REPAIR_MAIN_MARGIN=1.1`.
- Golden command: `LR_ENGINE=wasm LR_REPAIR_MAIN_MARGIN=1.1 npm run golden -- --jobs=32 --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-repair-main-margin11-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `100k`/`200k`/`300k` intersection; headline `641.1 -> 641.1`,
  `Delta=+0.0`, 95% CI `[-0.7, 0.8]`, `P(Delta<=0)=49.0%`. Per-budget
  deltas were `100k +0.3`, `200k -0.3`, and `300k +0.1`; validity was
  unchanged.
- Notable improvements: largest `300k` row wins were `skyline_push` seed `10`
  (`+30.35`), `drums_crescendo` seed `6` (`+28.91`), `skyline_push` seed `5`
  (`+27.10`), `float_bounds` seed `2` (`+24.60`), `swoop_dive` seed `5`
  (`+24.21`), and `drums_pendulum` seed `9` (`+23.63`).
- Notable regressions: largest `300k` row losses were `drums_tide` seed `10`
  (`-27.77`), `opening_burst` seed `8` (`-21.12`), `switchback_pop` seed `4`
  (`-20.87`), `mini_burst` seed `0` (`-20.46`), `soar_settle` seed `11`
  (`-19.94`), and `terrace_sprint` seed `5` (`-19.46`).
- Diagnostics: the split reduced terminal quantity but raised uniqueness. At
  `300k`, full evaluations fell `12691 -> 11952`, unique full evaluations fell
  less (`9957 -> 9652`), duplicate full evaluations fell `2734 -> 2300`, and
  unique rate rose `78.5% -> 80.8%`. Tail attempts fell `8389 -> 7990` while
  tail bests rose slightly `2143 -> 2171`. This is a mixed allocation trade:
  more selective terminal work but no aggregate quality conversion, and a clear
  `200k` loss.
- Status: not kept; env-only probe, no canonical run and no commit.

## probe-contract-fade75-01

- Baseline used: `shallow-tail-feedback6-01` at commit `0e0e7cb`.
- Hypothesis: with all `100k` rows valid, the pre-validity contract breadth
  reduction may now be too conservative at `100k`. Move the smooth fade start
  from `100k` to `75k` so `100k` gets partially restored contract breadth while
  `50k` remains mostly protected and `200k+` stays effectively unchanged.
- Code changes made: temporarily changed
  `CONTRACT_BREADTH_FADE_START_FRAMES` in
  `scripts/v0/optimizer/handoff.ts` from `100_000` to `75_000`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=50000,100000,200000 --archive-dir=generated/golden-runs/probe-contract-fade75-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `50k`/`100k`/`200k` intersection; headline `612.8 -> 612.8`,
  `Delta=+0.0`, 95% CI `[-0.2, 0.2]`, `P(Delta<=0)=48.8%`. Per-budget
  deltas were `50k +0.0`, `100k +0.0`, and `200k +0.0`; validity was
  unchanged (`50k 97% -> 97%`, higher budgets `100% -> 100%`).
- Notable improvements/regressions: none at decision scale. The common-row
  comparison showed only `100k +0.03`, with `50k` and `200k` byte-identical at
  aggregate score.
- Diagnostics: the ramp moved work only marginally (`100k` average candidate
  work `+2`, viable `+1`) and did not create a measurable score change. The
  default fade is already near a plateau for the current budget grid.
- Status: reverted after probe; no canonical run and no commit.

## start-option-limit6-01

- Baseline used: `shallow-tail-feedback6-01` at commit `0e0e7cb`.
- Hypothesis: accepted tracks almost always use start rank `0` (only 5/480
  nonzero at `50k`, and 2/480 at `100k+`, never above rank `4`). Reducing the
  start option limit from `10` to `6` should preserve observed winning starts
  while freeing root-level work for deeper search.
- Code changes made: temporarily changed `START_OPTION_LIMIT` in
  `scripts/v0/optimizer/handoff.ts` from `10` to `6`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-option-limit6-01`
- Decide result: canonical `VERDICT: INCONCLUSIVE`; headline `628.5 -> 628.5`,
  `Delta=-0.0`, 95% CI `[-0.1, 0.0]`, `P(Delta<=0)=66.1%`. Per-budget
  deltas were `50k +0.0`, `100k +0.0`, `200k -0.0`, and `300k -0.0`;
  validity was unchanged at all budgets.
- Notable improvements: only sub-point noise, mainly `drums_pendulum` seed `8`
  (`+0.11`) and seed `3` (`+0.03`) at `300k`.
- Notable regressions: the largest `300k` row loss was `rhythm_ladder` seed `6`
  (`-6.64`); aggregate common-row losses were small but consistent enough to
  fail the decision gate.
- Diagnostics: reducing roots did not free meaningful work. Common-row work
  changed only by about `+1` candidate at `300k` and `+1` candidate at `200k`,
  with no validity gain. The unused start options are not a material budget
  sink under the current deferred expansion behavior.
- Status: reverted after canonical decide; no commit.

## shallow-tail-feedback3-01

- Baseline used: `shallow-tail-feedback6-01` at commit `0e0e7cb`.
- Hypothesis: the accepted shallow-tail feedback throttle may still be
  conservative. Lowering
  `QUALITY_SHALLOW_TAIL_THROTTLE_FULL_FEEDBACK_SCALE` from `6` to `3` should
  further reduce remaining-1/2 quality tail completion after unique full
  evaluations exist, shifting more work into main full evaluations.
- Code changes made: temporarily changed
  `QUALITY_SHALLOW_TAIL_THROTTLE_FULL_FEEDBACK_SCALE` in
  `scripts/v0/optimizer/handoff.ts` from `6` to `3`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/shallow-tail-feedback3-01`
- Decide result: canonical `VERDICT: REJECT`; headline `628.5 -> 628.5`,
  `Delta=-0.0`, 95% CI `[-0.1, 0.0]`, `P(Delta<=0)=94.5%`. Per-budget
  deltas were `50k +0.0`, `100k -0.0`, `200k -0.0`, and `300k -0.0`;
  validity was unchanged at all budgets.
- Notable improvements: only small `300k` row wins, led by `canyon_steps` seed
  `3` (`+0.78`) and `tiny_dance` seed `3` (`+0.31`).
- Notable regressions: largest `300k` row losses were `float_bounds` seed `6`
  (`-7.41`), `leap_cadence` seed `2` (`-3.14`), `float_bounds` seed `9`
  (`-1.12`), `drums_dropout` seed `2` (`-0.71`), and `float_bounds` seed `11`
  (`-0.66`).
- Diagnostics: the stronger throttle did shift work, but too far. At `300k`,
  full evaluations rose `12691 -> 12790` and unique full evaluations rose
  `9957 -> 10212`, but tail bests fell `2143 -> 2112`. Remaining-1 attempts
  fell `827 -> 709` and remaining-2 attempts fell `485 -> 373`, indicating
  scale `6` is near the useful floor while scale `3` removes some productive
  shallow suffixes.
- Status: reverted after canonical reject; no commit.

## mature-avg-start35-01

- Baseline used: `shallow-tail-feedback6-01` at commit `0e0e7cb`.
- Hypothesis: the mature vertical average ranker is now useful at `100k`, but
  starts late enough that some vertical-axis rows never get enough robust
  lookahead pressure before the budget is exhausted. Move the smooth ramp start
  from `50k` to `35k` while keeping the same `65k` span and branch count, so
  `100k` receives more of the existing mechanism without changing `200k+`
  saturation behavior.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_START_FRAMES` from `50_000` to `35_000`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-start35-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `628.5 -> 629.1`,
  `Delta=+0.5`, 95% CI `[0.1, 1.2]`, `P(Delta<=0)=0.7%`. Per-budget deltas:
  `50k +0.0`, `100k +3.5`, `200k +0.0`, and `300k +0.0`. Validity was
  unchanged at all budgets (`50k 97% -> 97%`; `100k`, `200k`, and `300k`
  stayed `100% -> 100%`).
- Notable improvements: the gain was isolated to `100k` vertical/drama rows,
  led by spec means `soar_settle +42.63`, `leap_cadence +26.49`,
  `canyon_steps +12.80`, `terrace_sprint +10.52`, `glide_stairs +7.66`,
  `float_bounds +7.14`, `dense_echo_climb +7.08`, `rolling_hills +5.85`,
  `skyline_push +5.11`, `climb_terrace +4.82`, `summit_push +4.72`, and
  `mixed_grade +4.29`.
- Notable regressions: `100k` spec losses were smaller and concentrated in
  `swoop_dive -5.70`, `syncopated_lift -3.30`, `valley_bounce -1.02`, and
  `ridge_pulse -0.16`. Largest row losses included `canyon_steps` seed `9`
  (`-73.52`), `pop_train` seed `11` (`-62.15`), and `canyon_steps` seed `7`
  (`-54.83`), while the largest row wins were larger and broader:
  `soar_settle` seed `1` (`+209.85`), `canyon_steps` seed `2` (`+156.98`),
  and `soar_settle` seed `4` (`+145.90`).
- Diagnostics: common-row score moved only at `100k` (`+3.33`); `50k`,
  `200k`, and `300k` aggregates were unchanged. The `100k` work profile changed
  minimally (`sim -14`, `candidates +11`, viable unchanged), suggesting the
  gain comes from smoother forward-eval choice rather than extra work. At
  `300k`, compile stats were byte-equivalent to the baseline, preserving the
  accepted shallow-tail feedback behavior.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `mature-avg-start35-01`.

## probe-mature-avg-start25-50-100-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: if the accepted `35k` mature vertical average-ranker start was
  still late, moving the smooth ramp start to `25k` could extend the `100k`
  gain without disturbing `50k`.
- Code changes made: temporarily changed
  `MATURE_AVG_FWD_EVAL_START_FRAMES` in `scripts/v0/optimizer/handoff.ts`
  from `35_000` to `25_000`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=50000,100000 --archive-dir=generated/golden-runs/probe-mature-avg-start25-50-100-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `50k`/`100k` intersection; headline `578.3 -> 578.3`,
  `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget
  deltas were `50k +0.0` and `100k +0.0`; validity was unchanged
  (`50k 97% -> 97%`, `100k 100% -> 100%`).
- Notable improvements/regressions: none at decision scale; the paired budget
  subset was byte-equivalent.
- Diagnostics: the `35k` ramp appears already saturated for the budgets it can
  affect under the current deterministic hash gate. Moving the start earlier did
  not alter the selected tracks at `50k` or `100k`, so this mechanism is at a
  local plateau.
- Status: reverted after probe; no canonical run and no commit.

## probe-fwd-first-low-air-relax-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: the worst high-budget rows still show severe first-gap low-air
  overshoot, but previous first-gap geometry changes damaged dense continuations.
  Instead of changing geometry or the scorer, relax only the compiler's internal
  forward-eval target for the first low-air gap, so start/arc lookahead spends
  less pressure chasing a structurally hard first-gap air value and more pressure
  on downstream quality.
- Code changes made: temporarily changed `setForwardEvalContext(...)` in
  `scripts/v0/optimizer/handoff.ts` to pass a relaxed first-air target into
  `forwardNodeScore(...)` only. Low first air targets were smoothly blended up
  toward `0.45` with pressure over the `0.45 -> 0.0` target band. Final scoring,
  drift reports, resolved spec targets, and candidate geometry were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-fwd-first-low-air-relax-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired 20-spec `100k`/`300k` slice; headline `611.6 -> 604.3`,
  `Delta=-7.3`, 95% CI `[-29.5, 0.2]`, `P(Delta<=0)=80.8%`. Per-budget
  deltas were `100k -29.8` and `300k +0.2`. Validity regressed at `100k`
  (`100% -> 99%`) and stayed `100% -> 100%` at `300k`.
- Notable improvements: at `300k`, the intended target moved only weakly:
  `drums_pendulum` seed `7` improved `+29.79`, seed `11` improved `+12.05`,
  and `dense_echo_climb` seed `8` improved `+14.52`. The `300k` spec means
  were small (`drums_pendulum +2.37`, `dense_echo_climb +1.21`).
- Notable regressions: the `100k` first-complete basin broke on
  `drums_pendulum`: seed `7` regressed `506.28 -> 0.00`, seed `4` regressed
  `412.11 -> 0.00`, and seed `11` fell `-13.80`. At `300k`,
  `drums_pendulum` seed `10` regressed `-9.99` and seed `4` regressed `-3.46`.
- Diagnostics: first-gap handling is a real lever, but relaxing the forward
  target is the wrong form. It removes enough low-air pressure from lookahead to
  destabilize `100k` completion, while the high-budget downstream gain is too
  small to matter. A future first-gap attempt should preserve the contract basin
  and add only a bounded startup/first-arc alternative, not relax the internal
  target used by start selection.
- Status: reverted after probe; no canonical run and no commit.

## probe-startup-first-low-air-quality-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: previous first-gap low-air geometry changes were too broad because
  they changed the normal contract search. Add at most two `startup_catch`
  alternatives only after a passing track exists, only on the first low-air
  contact, and only under smooth low-air/budget/full-feedback pressure. This
  should preserve the first-complete basin while giving quality search a bounded
  first-arc alternative.
- Code changes made: temporarily added a quality-phase first-low-air startup
  candidate stream in `scripts/v0/optimizer/handoff.ts`, using existing
  `startup_catch` geometry and deterministic fractional activation.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-startup-first-low-air-quality-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired 20-spec `100k`/`300k` slice; headline `611.6 -> 611.6`,
  `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget
  deltas were `100k +0.0` and `300k +0.0`; validity was unchanged.
- Notable improvements/regressions: none; the paired slice was byte-equivalent
  at score level.
- Diagnostics: the quality-only candidate did not alter selected tracks. By the
  time a passing incumbent exists, the useful first-gap frontier has already
  been consumed, so this mechanism has no practical reach.
- Status: reverted after probe; no canonical run and no commit.

## probe-startup-first-low-air-main-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: since the quality-only startup candidate did not reach live
  first-gap nodes, allow the same bounded `startup_catch` alternative during
  the main first-gap expansion, but keep activation smooth and narrow via
  low-air and budget pressure.
- Code changes made: temporarily changed the startup first-low-air candidate
  stream to run during all first-gap expansions, removed the full-feedback gate,
  and kept the deterministic fractional cap at two candidates.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-startup-first-low-air-main-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired 20-spec `50k`/`100k`/`300k` slice; headline `591.6 -> 591.6`,
  `Delta=+0.0`, 95% CI `[0.0, 0.0]`, `P(Delta<=0)=100.0%`. Per-budget
  deltas were `50k +0.0`, `100k +0.0`, and `300k +0.0`. Validity regressed
  slightly at `50k` (`97% -> 96%`) and was unchanged at higher budgets.
- Notable improvements/regressions: none at score scale.
- Diagnostics: the stream added a small amount of candidate work
  (`300k` slice candidates `1,505,911 -> 1,506,045`, viable
  `794,245 -> 794,315`) but did not change any paired score. The bounded
  `startup_catch` alternatives are either not competitive or not aimed at the
  actual first-gap low-air failure.
- Status: reverted after probe; no canonical run and no commit.

## probe-weak-quality-ncand-extra-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: the fixed `LR_QUALITY_NCAND=28` probe showed that wider quality
  sampling can improve selected arc quality, but it over-spends on every quality
  node. Add extra quality breadth only after a contract-passing incumbent exists,
  and scale it smoothly with budget and weak incumbent axis quality, so weak
  rows get a little more geometry diversity without broadly starving terminal
  and repair work.
- Code changes made: temporarily added `qualitySampleCount(...)` in
  `scripts/v0/optimizer/handoff.ts`, increasing quality breadth by up to `4`
  candidates only when the best incumbent had `axis_quality` below a smooth
  `0.68 -> 0.50` band and budget was in the `100k -> 300k` ramp. Tail
  completion used the same adaptive quality breadth.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-weak-quality-ncand-extra-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `642.9 -> 643.6`,
  `Delta=+0.7`, 95% CI `[-0.6, 2.1]`, `P(Delta<=0)=12.5%`.
  Per-budget deltas were `200k +0.6` and `300k +0.9`; validity was unchanged.
- Notable improvements: weighted wins on `valley_bounce +7.71`,
  `drums_pendulum +6.94`, `soar_settle +5.34`,
  `syncopated_lift +3.85`, `skyline_push +2.84`,
  `syncopated_switchback +2.34`, `drums_signature +2.27`,
  `terrace_sprint +2.02`, and `big_air_ramp +2.01`.
- Notable regressions: weighted losses on `swoop_dive -5.19`,
  `rhythm_ladder -3.01`, `mini_burst -2.38`, `opening_burst -2.33`,
  `rolling_drop -2.32`, `float_bounds -1.94`, and
  `dense_sprint -0.70`.
- Diagnostics: the targeted extra breadth preserved more throughput than fixed
  `28`, but still took budget from terminal/repair conversion. At `200k`, full
  evaluations fell `9031 -> 8767`, unique full evaluations fell
  `6640 -> 6509`, tail improvements fell `1708 -> 1684`, and repair accepts
  fell `1215 -> 1184`. At `300k`, full evaluations fell `12536 -> 11837`,
  unique full evaluations fell `9301 -> 8948`, tail improvements fell
  `2102 -> 2040`, and repair accepts fell `1620 -> 1551`. Axis diagnostics at
  `300k` improved air MAE `0.0749 -> 0.0747`, speed MAE
  `0.0565 -> 0.0558`, and amplitude MAE `0.1197 -> 0.1184`, but worsened
  elevation MAE `0.0967 -> 0.0974`.
- Status: not kept; no canonical run and no commit. Tuned tighter before
  abandoning the mechanism.

## probe-weak-quality-ncand-extra-tight62-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: the `0.68` weak-incumbent threshold gave a positive but
  inconclusive signal while still reducing full-evaluation and repair
  throughput. Tighten the smooth activation band to `0.62 -> 0.50` so only
  clearly weak incumbents receive extra quality breadth.
- Code changes made: kept the temporary adaptive `qualitySampleCount(...)`
  mechanism but changed `HANDOFF_QUALITY_WEAK_EXTRA_OFF_AXIS_QUALITY` from
  `0.68` to `0.62`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-weak-quality-ncand-extra-tight62-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `642.9 -> 643.4`,
  `Delta=+0.5`, 95% CI `[-0.6, 1.7]`, `P(Delta<=0)=18.8%`.
  Per-budget deltas were `200k +0.1` and `300k +0.7`; validity was unchanged.
- Notable improvements: weighted wins on `drums_pendulum +7.85`,
  `soar_settle +4.96`, `valley_bounce +4.00`, `syncopated_lift +2.25`,
  `terrace_sprint +2.21`, `dense_sprint +2.14`, `drums_signature +1.80`,
  and `big_air_ramp +1.52`.
- Notable regressions: weighted losses on `swoop_dive -4.10`,
  `rhythm_ladder -3.13`, `rolling_drop -1.60`, `opening_burst -1.05`,
  `syncopated_switchback -0.92`, `canyon_steps -0.90`, and
  `cold_start -0.51`.
- Diagnostics: tightening reduced the broad throughput cost but also weakened
  the score signal. At `200k`, full evaluations fell only `9031 -> 8897`, but
  tail improvements still fell `1708 -> 1677` and repair accepts fell
  `1215 -> 1187`; at `300k`, full evaluations fell `12536 -> 12349`, tail
  improvements fell `2102 -> 2045`, and repair accepts fell `1620 -> 1577`.
  Axis diagnostics at `300k` improved air MAE `0.0749 -> 0.0742`, speed MAE
  `0.0565 -> 0.0561`, and amplitude MAE `0.1197 -> 0.1194`, but again
  worsened elevation MAE `0.0967 -> 0.0973`.
- Status: reverted after probe; no canonical run and no commit. The smoother
  quality-breadth family is directionally interesting but not strong enough
  against the current baseline because it spends the same scarce frames that
  tail completion and repair convert into accepted improvements.

## probe-amp-elev-contrast-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: baseline signed-error diagnostics show elevation is over-achieved
  for low targets and under-achieved for high targets, while amplitude remains
  slightly biased low across bands. Smoothly expand elevation targets away from
  neutral before converting them to launch velocity, and move amplitude launch
  pressure's onset lower so mid-amplitude targets get some pop without changing
  specs that do not target those axes.
- Code changes made: temporarily added a `0.35` smooth elevation target contrast
  in `scripts/v0/arc_placement.ts` and changed amplitude pressure from
  `smoothstep((amp - 0.30) / 0.45)` to a lower-onset
  `smoothstep((amp - 0.24) / 0.50)`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-amp-elev-contrast-01`
- Decide result: indicative, non-promotable `VERDICT: REJECT` on the paired
  `200k`/`300k` intersection; headline `642.9 -> 640.8`, `Delta=-2.1`,
  95% CI `[-5.3, 1.0]`, `P(Delta<=0)=91.4%`. Per-budget deltas were
  `200k -2.4` and `300k -1.8`; validity was unchanged.
- Notable improvements: weighted wins on `pop_train +19.32`,
  `syncopated_lift +5.25`, `big_air_ramp +1.65`, `summit_push +1.24`,
  `switchback_pop +0.41`, and `climb_terrace +0.21`.
- Notable regressions: large weighted losses on `canyon_steps -24.95`,
  `soar_settle -15.29`, `rolling_drop -13.38`, `leap_cadence -12.66`,
  `swoop_dive -11.20`, `skyline_push -8.54`, and `float_bounds -6.86`.
- Diagnostics: the change did not starve search; it actually increased
  terminal/repair conversion (`300k` unique full `9301 -> 9552`, tail
  improvements `2102 -> 2176`, repair accepts `1620 -> 1688`). The problem was
  quality: at `300k`, speed MAE worsened `0.0565 -> 0.0574`, elevation MAE
  worsened `0.0967 -> 0.0974`, and amplitude MAE worsened
  `0.1197 -> 0.1206`; `200k` showed the same pattern. The simple target
  exaggeration improves a few rows, especially `pop_train`, but perturbs the
  coupled speed/elevation/amplitude dynamics enough to lose globally.
- Status: reverted after probe; no canonical run and no commit.

## probe-low-air-brake-shape-01

- Baseline used: `mature-avg-vertical-01` at commit `8ac5153`.
- Hypothesis: the rejected low-air cap change made low-air rows stay grounded
  longer but traded that for speed creep and stalls. Instead of reopening the
  cap, bias contact-centered geometry only when a gap is both explicitly low-air
  and overspeeding, making the catch more uphill/brake-shaped while keeping the
  existing ride-out cap.
- Code changes made: in `scripts/v0/arc_placement.ts`, temporarily added a
  smooth `lowAirBrakePressure` to contact-centered normal placement, nudging
  contact angle and brake ride-out angle uphill and slightly increasing raw
  post length inside the existing cap.
- Golden command: `LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4,5 npm run golden -- --jobs=12 --specs=drums_pendulum,tiny_dance,summit_push,cold_start,swoop_dive,canyon_steps,climb_terrace,rolling_hills,terrace_sprint,glide_stairs,dense_echo_climb,skyline_push,drums_breath,drums_tide,drums_dropout,dense_sprint --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-low-air-brake-shape-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`; paired
  slice headline `610.0 -> 598.2`, `Delta=-11.7`, 95% CI `[-40.4, 2.5]`,
  `P(Delta<=0)=68.1%`. Per-budget deltas: `100k -72.0`, `200k -0.4`,
  `300k +0.8`. Validity regressed on the slice at `100k` from `100% -> 98%`.
- Notable improvements: at `300k`, slice wins included
  `dense_echo_climb +8.4`, `terrace_sprint +6.5`, `dense_sprint +6.0`,
  `drums_dropout +5.2`, and `cold_start +2.6`.
- Notable regressions: `drums_pendulum` fell sharply at `100k`
  (`mean -164.2`, row min `-465.8`) and still regressed at `200k/300k`;
  `canyon_steps` also regressed at `300k` (`mean -8.8`, row min `-52.9`).
- Diagnostics: the shape helped a few high-budget rows, but the low-budget
  first-complete basin is too fragile. The useful `300k` signal is too small
  and too concentrated to justify a budget-faded canonical run.
- Status: reverted after probe; no canonical run and no commit.

## mature-avg-branch4-01

- Baseline used: `mature-avg-vertical-01` at commit `8ac5153`.
- Hypothesis: the accepted mature vertical `avg:2:6` ranker improves
  amplitude/elevation rows but spends enough budget to reduce terminal
  conversion. A smaller default average branch might preserve the vertical
  selection signal while freeing budget for more tail completions and repair.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_BRANCH` from `6` to `4`. The existing smooth budget
  pressure (`150k -> 300k`), vertical-axis gate, default-only behavior, and
  explicit `LR_FWD_EVAL` override semantics are unchanged.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-mature-avg-branch4-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-branch4-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `621.2 -> 622.2`,
  `Delta=+1.0`, 95% CI `[0.2, 1.7]`, `P(Delta<=0)=1.0%`. Per-budget deltas:
  `50k +0.0`, `100k +0.0`, `200k +0.8`, `300k +1.6`. Validity was unchanged
  at all budgets.
- Notable improvements: weighted wins on `ridge_pulse +4.99`,
  `dense_echo_climb +3.88`, `float_bounds +3.88`, `swoop_dive +3.79`,
  `skyline_push +3.34`, `canyon_steps +2.79`, `leap_cadence +2.66`,
  `rolling_drop +2.21`, and `pop_train +2.17`.
- Notable regressions: only small weighted losses on `climb_terrace -0.59`,
  `syncopated_lift -0.30`, and `valley_bounce -0.03`; non-vertical drum rows
  remained byte-identical.
- Diagnostics: the smaller average is cheaper and converts better. At `300k`,
  sampled candidates fell `3023940 -> 2997113`, viable candidates rose
  `1657954 -> 1668216`, unique full evaluations rose `8866 -> 8966`, tail
  improvements rose `1857 -> 1954`, repair accepts rose `1355 -> 1460`, and
  repair reconvergence rose `2731 -> 3025`. Axis diagnostics improved
  `300k` speed MAE `0.0590 -> 0.0578`, amplitude MAE `0.1217 -> 0.1209`, and
  air MAE `0.0755 -> 0.0752`; elevation MAE ticked up
  `0.0976 -> 0.0983` but the score gain dominated.
- Status: kept; committed as the next baseline.

## mature-avg-branch3-01

- Baseline used: `mature-avg-branch4-01` at commit `349c6b2`.
- Hypothesis: branch `4` proved that the mature vertical average was
  over-broad at branch `6`. Try one more smooth reduction to branch `3` to see
  whether the signal remains while candidate ranking becomes cheaper and less
  noisy.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_BRANCH` from `4` to `3`. The existing budget fade,
  vertical-axis gate, default-only behavior, and explicit `LR_FWD_EVAL`
  override semantics remain unchanged.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-mature-avg-branch3-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-branch3-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `622.2 -> 622.7`,
  `Delta=+0.5`, 95% CI `[-0.1, 1.5]`, `P(Delta<=0)=5.4%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k +0.3`, `300k +0.9`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `terrace_sprint +7.31`,
  `syncopated_lift +2.69`, `soar_settle +2.54`, `climb_terrace +1.99`,
  `canyon_steps +1.63`, `valley_bounce +1.25`, `ridge_pulse +0.89`, and
  `big_air_ramp +0.75`.
- Notable regressions: weighted losses on `summit_push -0.98`,
  `dense_echo_climb -0.72`, `switchback_pop -0.46`, `leap_cadence -0.44`,
  `float_bounds -0.04`, and `pop_train -0.02`; non-vertical rows remained
  byte-identical.
- Diagnostics: branch `3` improved aggregate axes but reduced some full
  evaluation diversity. At `300k`, sampled candidates fell
  `2997113 -> 2994329`, viable candidates rose `1668216 -> 1670279`, unique
  full evaluations fell `8966 -> 8588`, tail improvements rose
  `1954 -> 1978`, repair accepts rose `1460 -> 1486`, and repair reconvergence
  rose `3025 -> 3235`. Axis diagnostics improved `300k` speed MAE
  `0.0578 -> 0.0577`, elevation MAE `0.0983 -> 0.0969`, and amplitude MAE
  `0.1209 -> 0.1206`; air stayed flat at `0.0752`.
- Status: kept; committed as the next baseline.

## mature-avg-branch2-01

- Baseline used: `mature-avg-branch3-01` at commit `9d2dfd0`.
- Hypothesis: branch `3` still looked slightly over-broad at mature vertical
  budgets. Try one more smooth reduction to branch `2` so the averaged ranker
  keeps the amplitude/elevation signal while spending less duplicate ranking
  work and leaving more budget for completion and repair.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_BRANCH` from `3` to `2`. The existing budget fade
  (`150k -> 300k`), vertical-axis gate, default-only behavior, and explicit
  `LR_FWD_EVAL` override semantics remain unchanged.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-mature-avg-branch2-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-branch2-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `622.7 -> 623.4`,
  `Delta=+0.7`, 95% CI `[-0.1, 1.5]`, `P(Delta<=0)=4.4%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k +0.1`, `300k +1.4`. Validity was
  unchanged at all budgets.
- Notable improvements: weighted wins on `soar_settle +4.26`,
  `switchback_pop +3.50`, `climb_terrace +3.25`,
  `dense_echo_climb +3.12`, `canyon_steps +2.95`, `mixed_grade +2.62`,
  `float_bounds +2.62`, `summit_push +2.61`, and `swoop_dive +1.48`.
- Notable regressions: weighted losses on `pop_train -1.80`,
  `syncopated_lift -1.58`, `glide_stairs -1.27`, `leap_cadence -0.18`, and
  `ridge_pulse -0.07`; non-vertical rows remained byte-identical.
- Diagnostics: the gain is concentrated where the smooth pressure is active.
  At `300k`, unique full evaluations rose `8588 -> 9301`, duplicate full
  evaluations rose `3077 -> 3235`, tail improvements rose `1978 -> 2102`,
  repair accepts rose `1486 -> 1620`, and repair reconvergence rose
  `3235 -> 3635`. At `200k`, the effect was much smaller: unique full
  evaluations rose `6330 -> 6424`, tail improvements rose `1646 -> 1650`,
  and repair accepts rose `1134 -> 1144`. Axis diagnostics at `300k` improved
  speed MAE `0.0577 -> 0.0565`, air MAE `0.0752 -> 0.0749`, elevation MAE
  `0.0969 -> 0.0967`, and amplitude MAE `0.1206 -> 0.1197`; `200k`
  amplitude was slightly worse (`0.1344 -> 0.1354`). Contact timing stayed
  effectively unchanged (`300k` contact MAE `0.71 -> 0.72`, all contacts
  `hit`). Largest row regressions were concentrated in a few unstable vertical
  rows, especially `terrace_sprint` seed `1` at `200k` and `pop_train` seed
  `11` at `300k`, while the accepted aggregate signal came from better
  high-budget conversion.
- Status: kept; committed as the next baseline.

## mature-avg-branch1-01

- Baseline used: `mature-avg-branch2-01` at commit `026ff3f`.
- Hypothesis: branch `2` might still be over-broad for the mature vertical
  average. Test the minimum branch count to see whether even cheaper ranking
  preserves the amplitude/elevation signal and converts more high-budget search
  into full completions.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `MATURE_AVG_FWD_EVAL_BRANCH` from `2` to `1`.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-mature-avg-branch1-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-branch1-01`
- Decide result: canonical `VERDICT: INCONCLUSIVE`; headline
  `623.4 -> 623.9`, `Delta=+0.5`, 95% CI `[-0.4, 1.4]`,
  `P(Delta<=0)=13.2%`. Per-budget deltas: `50k +0.0`, `100k +0.0`,
  `200k +0.1`, `300k +1.0`. Validity was unchanged at all budgets.
- Notable improvements: weighted wins on `summit_push +6.59`,
  `syncopated_lift +4.60`, `dense_echo_climb +4.00`, `pop_train +2.83`,
  `valley_bounce +2.28`, `swoop_dive +2.11`, `climb_terrace +1.78`,
  `canyon_steps +1.72`, and `big_air_ramp +1.68`.
- Notable regressions: weighted losses on `terrace_sprint -6.04`,
  `glide_stairs -2.26`, `leap_cadence -1.04`, `float_bounds -0.90`,
  `rolling_hills -0.43`, `switchback_pop -0.40`, and
  `mixed_grade -0.32`.
- Diagnostics: branch `1` did convert more budget into work, but not
  decisively into score. At `300k`, unique full evaluations rose
  `9301 -> 9416`, duplicate full evaluations fell `3235 -> 3170`, tail
  improvements rose `2102 -> 2174`, repair accepts rose `1620 -> 1685`, and
  repair reconvergence rose `3635 -> 4287`. Axis diagnostics improved `300k`
  speed MAE `0.0565 -> 0.0552` and elevation MAE `0.0967 -> 0.0964`, but
  amplitude regressed `0.1197 -> 0.1214` and air ticked up
  `0.0749 -> 0.0750`. The largest losses were unstable vertical rows:
  `terrace_sprint` seed `10` at `300k` (`-83.1`), `float_bounds` seed `2` at
  `300k` (`-51.5`), and `climb_terrace` seed `6` at `300k` (`-39.8`).
- Status: reverted after canonical decide; no commit.

## probe-tail-window-extra5-branch2-01

- Baseline used: `mature-avg-branch2-01` at commit `026ff3f`.
- Hypothesis: branch2 increased high-budget completion and repair conversion,
  but the quality tail-completion window still only reaches remaining-10 suffixes
  at `200k`/`300k`. Increase the smooth high-budget tail window by one contact
  to let remaining-11 suffixes compete under the newer ranker.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `TAIL_COMPLETION_BUDGET_WINDOW_EXTRA` from `4` to `5`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-tail-window-extra5-branch2-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `639.6 -> 639.5`,
  `Delta=-0.1`, 95% CI `[-0.2, 0.0]`, `P(Delta<=0)=81.0%`. Per-budget
  deltas were `200k -0.1`, `300k -0.0`; validity was unchanged.
- Notable improvements: only small weighted wins on `solo_run +0.53`,
  `dense_sprint +0.27`, `syncopated_lift +0.24`, `drums_breath +0.20`, and
  `mixed_grade +0.08`.
- Notable regressions: weighted losses on `float_bounds -1.07`,
  `drums_crescendo -0.46`, `drums_pendulum -0.42`,
  `dense_echo_climb -0.40`, `drums_swell -0.32`, and
  `rolling_hills -0.22`.
- Diagnostics: opening remaining-11 suffixes displaced productive remaining-10
  work instead of adding useful terminal diversity. At `300k`, rem10 tail
  attempts fell `2326 -> 326` and rem11 attempts rose `0 -> 2202`, but total
  tail improvements fell `2102 -> 2092`, full evaluations fell
  `12536 -> 12497`, and unique full evaluations fell `9301 -> 9271`. At
  `200k`, rem10 improvements fell `994 -> 482` while rem11 produced `512`
  improvements, leaving total tail improvements effectively flat
  (`1650 -> 1651`) and score slightly worse.
- Status: reverted after probe; no canonical run and no commit.

## probe-repair-upstream5-branch2-01

- Baseline used: `mature-avg-branch2-01` at commit `026ff3f`.
- Hypothesis: branch2 improved repair accepts and reconvergence, so one more
  upstream parent in the repair walk might now pay by exposing better setup
  choices for high-budget rows without changing the main search.
- Code changes made: none; probed the existing override
  `LR_REPAIR_MAX_UPSTREAM=5` against the default `4`.
- Golden command: `LR_ENGINE=wasm LR_REPAIR_MAX_UPSTREAM=5 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-repair-upstream5-branch2-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `639.6 -> 639.7`,
  `Delta=+0.1`, 95% CI `[-0.3, 0.7]`, `P(Delta<=0)=32.9%`. Per-budget
  deltas were `200k +0.1`, `300k +0.1`; validity was unchanged.
- Notable improvements: weighted wins on `opening_burst +3.28`,
  `syncopated_lift +2.30`, `terrace_sprint +2.19`,
  `climb_terrace +1.51`, and `skyline_push +0.93`.
- Notable regressions: weighted losses on `switchback_pop -3.56`,
  `syncopated_switchback -1.18`, `dense_echo_climb -0.55`,
  `leap_cadence -0.30`, `mini_burst -0.28`, and `mixed_grade -0.25`.
- Diagnostics: the fifth upstream parent slightly reshuffled repair but did not
  create a stronger terminal pool. At `300k`, repair accepts fell
  `1620 -> 1613`, tail improvements fell `2102 -> 2094`, full evaluations fell
  `12536 -> 12475`, and unique full evaluations fell `9301 -> 9292`. At `200k`
  repair accepts rose only `1144 -> 1150` while full and unique full
  evaluations both fell.
- Status: not kept; env-only probe, no canonical run and no commit.

## probe-repair-feas10-branch2-01

- Baseline used: `mature-avg-branch2-01` at commit `026ff3f`.
- Hypothesis: the accepted branch2 baseline frees enough budget that repair's
  `1.1` feasibility headroom might now be slightly conservative. Try a tighter
  `1.0` margin so earlier/high-value repair gaps are considered affordable.
- Code changes made: none; probed the existing override
  `LR_REPAIR_FEAS_MARGIN=1.0` against the default `1.1`.
- Golden command: `LR_ENGINE=wasm LR_REPAIR_FEAS_MARGIN=1.0 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-repair-feas10-branch2-01`
- Decide result: indicative `VERDICT: REJECT` on the paired `200k`/`300k`
  intersection; headline `639.6 -> 638.1`, `Delta=-1.5`, 95% CI
  `[-3.2, -0.3]`, `P(Delta<=0)=99.5%`. Per-budget deltas were `200k -1.3`
  and `300k -1.6`; validity was unchanged.
- Notable improvements: small weighted wins on `valley_bounce +2.19`,
  `verse_chorus +0.89`, `drums_signature +0.85`, `glide_stairs +0.84`,
  `climb_terrace +0.71`, and `mini_burst +0.69`.
- Notable regressions: large weighted losses on `drums_tide -13.21`,
  `drums_swell -12.63`, `drums_pulse -10.37`, `drums_zigzag -8.22`,
  `drums_breath -7.97`, `solo_run -5.49`, and `rhythm_ladder -5.13`.
- Diagnostics: the tighter margin starved terminal diversity. At `300k`,
  full evaluations fell `12536 -> 10685`, unique full evaluations fell
  `9301 -> 8398`, tail improvements fell `2102 -> 2073`, and repair accepts
  fell `1620 -> 1583` despite more repair restarts. At `200k`, unique full
  evaluations fell `6424 -> 5952` and repair accepts fell `1144 -> 1134`.
- Status: not kept; env-only probe, no canonical run and no commit.

## mature-avg-full200-01

- Baseline used: `mature-avg-branch2-01` at commit `026ff3f`.
- Hypothesis: branch count is now at the useful floor, but the mature vertical
  average ranker may start too late. Move its smooth budget ramp earlier so
  200k rows get full pressure while 300k behavior remains unchanged.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, changed
  `MATURE_AVG_FWD_EVAL_START_FRAMES` from `150_000` to `100_000` and
  `MATURE_AVG_FWD_EVAL_SPAN_FRAMES` from `150_000` to `100_000`.
  `MATURE_AVG_FWD_EVAL_BRANCH` stayed at `2`.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=200000 --archive-dir=generated/golden-runs/probe-mature-avg-full200-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/mature-avg-full200-01`
- Decide result: canonical `VERDICT: ACCEPT`; headline `623.4 -> 625.9`,
  `Delta=+2.5`, 95% CI `[0.8, 4.3]`, `P(Delta<=0)=0.3%`. Per-budget
  deltas: `50k +0.0`, `100k +0.0`, `200k +8.3`, `300k +0.0`. Validity was
  unchanged at all budgets (`50k 97% -> 97%`; `100k`, `200k`, and `300k`
  stayed `100% -> 100%`).
- Notable improvements: the score gain was isolated to 200k, with weighted
  wins on `leap_cadence +16.90`, `float_bounds +15.34`,
  `soar_settle +9.41`, `rolling_hills +9.36`, `glide_stairs +8.85`,
  `big_air_ramp +8.43`, `terrace_sprint +6.73`, `skyline_push +6.59`,
  `rolling_drop +5.72`, `canyon_steps +5.71`, `climb_terrace +4.16`, and
  `mixed_grade +4.14`.
- Notable regressions: weighted losses on `swoop_dive -5.93` and
  `dense_echo_climb -1.22`. Largest 200k row regressions were
  `pop_train` seed `3` (`650.4 -> 378.2`, `-272.3`),
  `soar_settle` seed `11` (`663.9 -> 553.2`, `-110.7`), and
  `swoop_dive` seeds `4`, `6`, `11`, `8`, and `2`.
- Diagnostics: the earlier ramp converted budget into more 200k terminal work
  without moving other budgets. At `200k`, candidates sampled rose
  `1966082 -> 1997808`, unique full evaluations rose `6424 -> 6640`,
  duplicate full evaluations were effectively flat (`2389 -> 2391`), tail
  improvements rose `1650 -> 1708`, and repair accepts rose `1144 -> 1215`.
  At `50k`, `100k`, and `300k`, compile stats and scores were unchanged. Axis
  diagnostics at `200k` improved air MAE `0.0799 -> 0.0775`, speed MAE
  `0.0607 -> 0.0596`, elevation MAE `0.0979 -> 0.0973`, and amplitude MAE
  `0.1354 -> 0.1219`; `300k` axes were unchanged. Contact diagnostics were
  unchanged except for slightly lower 200k mean absolute frame error
  (`0.722 -> 0.707`), with all 200k/300k contacts still hit and no drift or
  missing contacts. Worst remaining candidate axes are `pop_train` seed `3`
  speed at 200k, persistent `drums_pendulum` first-gap air, and
  `terrace_sprint` amplitude.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `mature-avg-full200-01`.

## probe-repair-main-margin12-full200-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: after the accepted 200k mature-ranker improvement, repair may be
  starting from the first complete incumbent too eagerly. Letting the main
  frontier run to `1.2 * firstCompletionFrame` before the repair handoff might
  produce a stronger incumbent and cost profile while remaining smooth in each
  row's measured completion cost.
- Code changes made: none; probed the existing override
  `LR_REPAIR_MAIN_MARGIN=1.2` against the default `1.0`.
- Golden command: `LR_ENGINE=wasm LR_REPAIR_MAIN_MARGIN=1.2 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-repair-main-margin12-full200-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `642.9 -> 643.1`,
  `Delta=+0.2`, 95% CI `[-0.9, 2.1]`, `P(Delta<=0)=43.1%`. Per-budget
  deltas were `200k +0.7` and `300k -0.1`; validity was unchanged.
- Notable improvements: weighted wins on `pop_train +12.52`,
  `soar_settle +5.34`, `terrace_sprint +4.59`, `drums_pendulum +3.27`,
  `switchback_pop +2.67`, and `summit_push +1.98`.
- Notable regressions: weighted losses on `drums_tide -4.31`,
  `swoop_dive -3.98`, `solo_run -3.19`, `opening_burst -2.96`,
  `rhythm_ladder -2.30`, `drums_breath -2.02`, `rolling_hills -1.95`,
  `leap_cadence -1.93`, and `climb_terrace -1.92`.
- Diagnostics: the margin helped the severe `pop_train` 200k outlier but
  starved broad terminal conversion. At `200k`, full evaluations fell
  `9031 -> 7770`, unique full evaluations fell `6640 -> 5804`, repair accepts
  fell `1215 -> 983`, and repair frames fell by about `8.3M`; at `300k`, full
  evaluations fell `12536 -> 11648`, unique full fell `9301 -> 8641`, and
  repair accepts fell `1620 -> 1423`. Tail improvements rose slightly, but not
  enough to offset lost repair/full-eval work. Axis MAE changed only marginally.
- Status: not kept; env-only probe, no canonical run and no commit.

## probe-quality-ncand20-full200-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: after the mature-ranker timing change, 24 quality candidates per
  contact may over-spend per node. Reducing quality breadth to 20 might convert
  more budget into full tracks and repairs while preserving enough arc variety.
- Code changes made: none; probed the existing override
  `LR_QUALITY_NCAND=20` against the default `24`.
- Golden command: `LR_ENGINE=wasm LR_QUALITY_NCAND=20 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-quality-ncand20-full200-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `642.9 -> 641.6`,
  `Delta=-1.3`, 95% CI `[-3.7, 1.0]`, `P(Delta<=0)=87.6%`. Per-budget
  deltas were `200k -1.3` and `300k -1.4`; validity was unchanged.
- Notable improvements: weighted wins on `solo_run +6.01`,
  `rhythm_ladder +4.41`, `syncopated_lift +4.29`, `skyline_push +4.27`,
  `ridge_pulse +4.25`, `pop_train +4.23`, and `dense_echo_climb +2.80`.
- Notable regressions: weighted losses on `drums_tide -13.41`,
  `rolling_drop -10.75`, `opening_burst -10.66`, `drums_swell -10.51`,
  `drums_crescendo -7.16`, `drums_crosscut -5.87`, `drums_zigzag -5.67`,
  `swoop_dive -5.33`, `dense_sprint -4.94`, and
  `drums_signature -4.88`.
- Diagnostics: narrower quality breadth generated more terminal work but not
  more useful terminal work. At `200k`, full evaluations rose `9031 -> 9738`
  and unique full evaluations rose `6640 -> 6841`, but duplicate full
  evaluations rose `2391 -> 2897`, tail improvements fell `1708 -> 1646`, and
  repair accepts fell `1215 -> 1147`. At `300k`, full evaluations rose
  `12536 -> 13998` and unique full rose `9301 -> 9936`, but duplicates rose
  `3235 -> 4062`, tail improvements fell `2102 -> 2010`, and repair accepts
  fell `1620 -> 1534`.
- Status: not kept; env-only probe, no canonical run and no commit.

## probe-quality-ncand28-full200-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: the `20`-candidate probe showed that more terminal quantity can
  be low value. Try the other side of quality breadth: a slightly wider
  candidate pool may reduce completion volume but improve selected arc quality
  enough to lift 200k/300k.
- Code changes made: none; probed the existing override
  `LR_QUALITY_NCAND=28` against the default `24`.
- Golden command: `LR_ENGINE=wasm LR_QUALITY_NCAND=28 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-quality-ncand28-full200-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `642.9 -> 644.0`,
  `Delta=+1.1`, 95% CI `[-1.1, 3.3]`, `P(Delta<=0)=15.4%`. Per-budget
  deltas were `200k +0.9` and `300k +1.3`; validity was unchanged.
- Notable improvements: weighted wins on `drums_crescendo +10.42`,
  `drums_pendulum +10.14`, `syncopated_switchback +8.14`,
  `drums_pulse +6.82`, `dense_sprint +6.69`, `valley_bounce +6.11`,
  `grain_staircase +5.81`, `skyline_push +4.42`, `drums_dropout +3.59`,
  `terrace_sprint +3.18`, `dense_echo_climb +2.98`, and
  `drums_breath +2.80`.
- Notable regressions: weighted losses on `drums_signature -8.11`,
  `drums_tide -6.21`, `solo_run -6.15`, `drums_swell -5.69`,
  `soar_settle -4.20`, `rolling_drop -3.90`, `mini_burst -3.81`,
  and `rolling_hills -2.72`.
- Diagnostics: wider quality breadth reduced terminal quantity but improved the
  quality of selected arcs. At `200k`, candidates sampled rose
  `1997808 -> 2076859`, but full evaluations fell `9031 -> 7338`, unique full
  evaluations fell `6640 -> 5598`, tail improvements fell `1708 -> 1645`, and
  repair accepts fell `1215 -> 1129`. At `300k`, candidates sampled rose
  `3010844 -> 3127891`, full evaluations fell `12536 -> 10451`, unique full
  fell `9301 -> 8074`, and repair accepts fell `1620 -> 1522`. Axis MAE
  improved air `0.0775 -> 0.0760` and amplitude `0.1219 -> 0.1210` at `200k`,
  and air `0.0749 -> 0.0736` and amplitude `0.1197 -> 0.1187` at `300k`, with
  small elevation regression at `300k`.
- Status: not kept yet; promoted to a code-level canonical attempt because the
  probe was directionally positive and mechanically plausible.

## quality-ncand28-01

- Baseline used: `mature-avg-full200-01` at commit `4757f8d`.
- Hypothesis: make the directionally positive `LR_QUALITY_NCAND=28` probe the
  default and let the full canonical grid determine whether the higher-quality,
  lower-volume candidate stream is worth keeping.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily changed
  `HANDOFF_QUALITY_N_CAND` from `24` to `28`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/quality-ncand28-01`
- Decide result: canonical `VERDICT: INCONCLUSIVE`; headline
  `625.9 -> 626.8`, `Delta=+0.9`, 95% CI `[-0.9, 2.6]`,
  `P(Delta<=0)=15.5%`. Per-budget deltas: `50k -0.2`, `100k +0.4`,
  `200k +0.9`, `300k +1.3`. Validity was unchanged at all budgets.
- Notable improvements: weighted wins on `drums_crescendo +8.22`,
  `drums_pendulum +7.55`, `syncopated_switchback +6.47`,
  `grain_staircase +6.07`, `drums_pulse +5.65`, `dense_sprint +5.53`,
  `valley_bounce +4.86`, `skyline_push +3.97`,
  `terrace_sprint +3.27`, and `drums_dropout +2.97`.
- Notable regressions: weighted losses on `drums_signature -6.72`,
  `soar_settle -5.05`, `solo_run -4.76`, `drums_swell -4.52`,
  `drums_tide -4.52`, `mini_burst -3.07`, `rolling_drop -2.40`,
  `rhythm_ladder -1.71`, and `pop_train -1.56`.
- Diagnostics: broader quality sampling increased raw candidate work and
  viability but reduced terminal/repair conversion at every budget. At `300k`,
  candidates sampled rose `3010844 -> 3127891` and viable candidates rose
  `1664289 -> 1723538`, but full evaluations fell `12536 -> 10451`, unique
  full evaluations fell `9301 -> 8074`, tail improvements fell
  `2102 -> 2015`, and repair accepts fell `1620 -> 1522`. At `200k`, full
  evaluations fell `9031 -> 7338`, unique full fell `6640 -> 5598`, tail
  improvements fell `1708 -> 1645`, and repair accepts fell `1215 -> 1129`.
  Low budgets showed the same throughput reduction (`50k` unique full
  `17019 -> 13954`, `100k` unique full `3711 -> 3336`), explaining the small
  `50k` drag and weak canonical confidence.
- Status: reverted after canonical decide; no commit.

## probe-elev-high-launch125-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: high-elevation targets in the `0.5..0.75` band were still
  undershooting at high budget. Add a small smooth extra launch blend only for
  high elevation so the contact-centered line family can reach real climbs
  without introducing a hard budget threshold.
- Code changes made: in `scripts/v0/arc_placement.ts`, temporarily multiplied
  the energy-launch blend by up to `1.25x` as target elevation rose from `0.50`
  to `0.75`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-elev-high-launch125-01`
- Decide result: indicative, non-promotable `VERDICT: REJECT` on the paired
  `100k`/`200k`/`300k` intersection; headline `618.0 -> 504.8`,
  `Delta=-113.2`, 95% CI `[-190.4, -43.5]`, `P(Delta<=0)=99.9%`.
  Per-budget deltas were `100k -114.7`, `200k -112.7`, and `300k -113.0`.
  Validity stayed `100% -> 100%` at all three budgets.
- Notable improvements: tiny weighted wins on `dense_echo_climb +1.6`,
  `rolling_drop +1.3`, `skyline_push +1.3`, `climb_terrace +1.1`, and
  `rolling_hills +0.9`.
- Notable regressions: catastrophic weighted losses on `pop_train -374.0`,
  `soar_settle -368.9`, `leap_cadence -342.7`, `float_bounds -331.9`, and
  `big_air_ramp -329.4`. Worst rows included `soar_settle` seed `5`
  (`726.7 -> 302.3`), `soar_settle` seed `7` (`729.6 -> 313.5`),
  `pop_train` seed `1` (`692.7 -> 296.9`), and `big_air_ramp` seed `7`
  (`549.9 -> 156.9`).
- Diagnostics: direct launch amplification preserved validity but destroyed the
  amplitude/elevation family. This argues against making high starts/climbs by
  globally increasing launch angle; the selected arcs become physically valid
  but score poorly on other axes. A beginning-of-track mechanism should change
  the initial state/candidate framing or allocation, not simply push more launch
  into the existing geometry.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-start-firstbeat-roundrobin-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: start choice may still be too path-dependent. The compiler ranks
  ten start states but the DFS usually lets only one start lane commit a first
  contact before the search dives to completion. Try a qualitatively different
  beginning strategy: after any start lane places its first contact, defer its
  second-contact expansion once so other start lanes also get a first-beat
  placement before one lane owns the frontier.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, temporarily set
  first-contact children from multi-start roots to `deferExpansion: true` when
  the parent had no committed contact fits.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-firstbeat-roundrobin-01`
- Decide result: indicative, non-promotable `VERDICT: REJECT` on the paired
  `50k`/`100k`/`300k` intersection; headline `591.6 -> 565.3`,
  `Delta=-26.4`, 95% CI `[-53.1, -3.4]`, `P(Delta<=0)=100.0%`.
  Per-budget deltas were `50k -118.7`, `100k -53.8`, and `300k -1.8`.
  Validity fell at low budgets (`50k 97% -> 91%`, `100k 100% -> 99%`) and
  stayed `100% -> 100%` at `300k`.
- Notable improvements: a few hard rows did improve, including
  `drums_pendulum` seed `8` (`+42.5` weighted), `drums_signature` seed `1`
  (`+21.6`), `drums_crescendo` seed `1` (`+14.9`), and `rhythm_ladder` seeds
  `6`, `11`, and `8` (`+11..13`).
- Notable regressions: largest weighted losses were `drums_crescendo -48.7`,
  `drums_pendulum -38.4`, `drums_signature -12.7`, `soar_settle -9.4`,
  `drums_swell -5.9`, and `float_bounds -5.7`. Worst rows included
  `drums_crescendo` seed `0` (`569.9 -> 382.9`) and `drums_pendulum` seed `6`
  (`434.8 -> 332.1`).
- Diagnostics: the mechanism did what it was designed to do but at the wrong
  time. Mean `handoff_start_ranks_with_fits` moved from about `1.0` to
  `7.6..9.7`, so alternate start lanes really did reach first-beat fits.
  However, pre-contract diversity starved completion: at `50k`, unique full
  evaluations fell `34.4 -> 13.8`; at `100k`, unique full evaluations were flat
  to slightly down (`8.3 -> 8.0`) while partial evaluations almost doubled
  (`38.4 -> 70.5`). At `300k`, unique full evaluations rose (`21.1 -> 25.0`)
  but not enough to overcome the early losses. Future start-lane work should be
  quality/repair-phase or incumbent-driven, not in the first-complete race.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-start-repair-alt2-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: the first-beat round-robin proved alternate start lanes can reach
  real first-contact fits, but doing so before a valid incumbent starves the
  contract race. Move the same idea into repair: when the weakest feasible
  repair gap is the first contact, try rebuilding the whole track from the top
  two alternate start states with a fresh deterministic seed, accepted only by
  the existing best-so-far register.
- Code changes made: temporarily added a repair-phase alternate-start restart in
  `scripts/v0/optimizer/handoff.ts`, sharing the existing charged
  `runFrontierFrom(...)` path and recording the restart as a repair record with
  `worst=-1` when repair logging is enabled.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-start-repair-alt2-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `100k`/`300k` intersection; headline `611.6 -> 610.0`,
  `Delta=-1.6`, 95% CI `[-4.9, 1.7]`, `P(Delta<=0)=83.7%`. Per-budget deltas
  were `100k -0.2` and `300k -2.0`; validity stayed `100% -> 100%`.
- Notable improvements: weighted wins on `float_bounds +10.9`,
  `swoop_dive +4.7`, `drums_pendulum +3.1`, and `tiny_dance +2.7`.
  Largest row wins included `drums_pendulum` seed `8` (`+50.4`),
  `swoop_dive` seed `5` (`+41.7`), `float_bounds` seed `2` (`+33.5`),
  and `drums_pendulum` seed `10` (`+30.8`).
- Notable regressions: weighted losses on `rhythm_ladder -14.4`,
  `soar_settle -10.5`, `drums_crescendo -10.5`, `cold_start -7.1`,
  `drums_signature -3.6`, and `drums_swell -3.5`. Largest row losses included
  `drums_crescendo` seed `3` (`-49.5`), `drums_crescendo` seed `10`
  (`-47.9`), `soar_settle` seed `3` (`-34.0`), and `soar_settle` seed `7`
  (`-33.5`).
- Diagnostics: the repair-phase version preserved the contract basin and did
  increase alternate start reach (`handoff_start_ranks_with_fits` mean
  `1.01 -> 1.85` at `100k`, `1.01 -> 3.06` at `300k`), but it displaced more
  productive normal repair work. At `300k`, unique full evaluations fell
  `21.10 -> 16.60`, repair restarts fell `12.46 -> 10.45`, and repair accepts
  fell `3.39 -> 2.74`; at `100k`, unique full evaluations fell `8.35 -> 7.16`.
  Alternate-start repair has some row-level merit, but the simple "try top two
  starts when gap 0 is weak" policy is too expensive and not selective enough.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-start-gap-axes-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: the start candidate pool is shaped from axes at exactly `t=0`,
  even though the first controlled state is the first contact gap. For curved
  openings, `t=0` can be a poor representative of the first beat. Shape start
  speed/angle candidates from the first contact gap's averaged axes, then let
  the existing charged start evaluator pick normally.
- Code changes made: temporarily passed `gapAxisTargets` into
  `buildStartOptions(...)` and used the first contact gap's effective axes
  instead of `firstAxes(rawSpec)` when generating start candidates.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-gap-axes-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `50k`/`100k`/`300k` intersection; headline `591.6 -> 592.2`,
  `Delta=+0.6`, 95% CI `[-2.4, 3.7]`, `P(Delta<=0)=33.7%`. Per-budget
  deltas were `50k +0.5`, `100k +0.8`, and `300k +0.6`. Validity changed only
  at `50k` (`97% -> 96%`).
- Notable improvements: weighted wins on `swoop_dive +10.7`,
  `drums_tide +7.0`, `terrace_sprint +6.9`, `big_air_ramp +6.6`,
  `float_bounds +3.8`, and `dense_echo_climb +3.5`.
- Notable regressions: weighted losses on `leap_cadence -15.5`,
  `drums_swell -8.8`, `syncopated_lift -2.7`, and `canyon_steps -1.7`.
- Diagnostics: the mechanism had real signal but the full replacement was too
  sensitive to tiny first-gap-vs-`t=0` differences. For example,
  `leap_cadence` differed by only about `0.0014` on speed and `drums_swell` by
  less than `0.001` on air/speed, yet selected tracks changed and regressed.
  This motivated a smooth drift-gated blend instead of unconditional
  replacement.
- Status: not kept; refined into `probe-start-gap-blend-01`.

## start-gap-blend-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: keep the useful part of first-gap-aware start shaping while
  avoiding microscopic perturbations. Smoothly blend from `t=0` axes toward the
  first contact gap average only when their max axis distance exceeds `0.01`,
  fading in over a `0.03` span.
- Code changes made: temporarily added `startSelectionAxes(...)` in
  `scripts/v0/optimizer/handoff.ts`, with a smooth max-axis-distance gate and
  a linear blend between `firstAxes(rawSpec)` and the first contact gap's
  effective axes.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-gap-blend-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-gap-blend-01`
- Decide results:
  - Probe: indicative `VERDICT: ACCEPT` on the paired 20-spec slice; headline
    `591.6 -> 592.9`, `Delta=+1.2`, 95% CI `[-0.1, 3.6]`,
    `P(Delta<=0)=7.4%`. Per-budget deltas were `50k -0.1`, `100k +1.6`,
    and `300k +1.3`; validity changed only at `50k` (`97% -> 96%`).
  - Canonical: `VERDICT: INCONCLUSIVE`; headline `629.1 -> 629.4`,
    `Delta=+0.3`, 95% CI `[-1.0, 1.8]`, `P(Delta<=0)=34.7%`. Per-budget
    deltas were `50k +0.8`, `100k +0.5`, `200k +0.4`, and `300k +0.1`.
    Validity was unchanged at every budget (`50k 97% -> 97%`, higher budgets
    `100% -> 100%`).
- Notable improvements: canonical weighted wins on `drums_tide +11.9`,
  `swoop_dive +11.9`, and `float_bounds +6.6`. Largest row wins included
  `drums_tide` seed `5` (`+75.1`), `swoop_dive` seed `3` (`+65.1`),
  `drums_breath` seed `4` (`+50.0`), and `float_bounds` seed `2` (`+46.6`).
- Notable regressions: canonical weighted losses on `pop_train -11.8`,
  `drums_breath -6.0`, and `drums_zigzag -0.7`. Largest row losses included
  `drums_breath` seed `6` (`-38.9`), `drums_tide` seed `2` (`-30.5`),
  `float_bounds` seed `3` (`-29.2`), `drums_breath` seed `2` (`-27.8`), and
  `pop_train` seed `7` (`-27.5`).
- Diagnostics: this is the strongest beginning-of-track mechanism so far: it is
  budget-neutral, preserves validity, and improves a coherent set of curved
  openings without changing search breadth. However the canonical effect is too
  small and noisy to keep. The main blocker is selectivity: `pop_train` and
  `float_bounds` have similar first-gap air/amplitude drift but move in opposite
  directions, so there is no robust obvious rule to keep the wins and drop the
  losses without overfitting.
- Status: reverted after canonical decide; no commit.

## probe-fwd-vertical-overshoot-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: the remaining failure shape is strongly over-target on amplitude
  and elevation, and the old launch-side amplitude/elevation probe coupled the
  geometry too hard. Try a selection-only mechanism instead: inside the
  high-budget forward-eval ranker, add a small smooth local overshoot penalty
  for candidates that already exceed targeted amplitude/elevation, without
  changing candidate generation or geometry.
- Code changes made: temporarily added `HANDOFF_FWD_AXIS_OVERSHOOT_WEIGHTS`
  (`elevation: 8`, `amplitude: 16`) plus budget/full-feedback pressure in
  `scripts/v0/optimizer/handoff.ts`, and ranked forward-eval candidates by
  `-forwardScore + penalty`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift,drums_pendulum,tiny_dance,drums_tide,drums_swell,drums_breath --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-fwd-vertical-overshoot-01`
- Decide result: indicative, non-promotable `VERDICT: REJECT` on the paired
  `100k`/`300k` intersection; headline `619.2 -> 614.5`, `Delta=-4.7`,
  95% CI `[-7.6, -2.1]`, `P(Delta<=0)=100.0%`. Per-budget deltas were
  `100k -2.9` and `300k -5.3`; validity stayed `100% -> 100%` at both
  budgets.
- Notable improvements: weighted wins on `climb_terrace +2.62`,
  `float_bounds +1.83`, and `terrace_sprint +1.05`. Largest row wins included
  `float_bounds` seed `2` at `100k` (`+95.3`), `float_bounds` seed `2` at
  `300k` (`+55.4`), and `terrace_sprint` seed `2` at `300k` (`+25.0`).
- Notable regressions: weighted losses on `soar_settle -16.16`,
  `rolling_drop -14.34`, `pop_train -14.31`, `big_air_ramp -10.69`,
  `swoop_dive -9.98`, and `skyline_push -7.31`. Largest row losses included
  `leap_cadence` seed `7` at `100k` (`-58.9`), `pop_train` seed `11` at
  `300k` (`-57.1`), `canyon_steps` seed `1` at `300k` (`-47.4`), and
  `pop_train` seed `4` at `300k` (`-47.3`).
- Diagnostics: the mechanism did not lose validity, and it did move some
  low-amplitude outliers in the intended direction. But the local vertical
  overshoot proxy was not globally reliable: it damaged pop/settle/dive rows
  where the forward rollout's true score was already the better signal. On the
  paired slice, `300k` viable candidates fell `2877.32 -> 2844.32`, repair
  accepts fell `3.77 -> 3.48`, and tail improvements fell `4.66 -> 4.35`.
  This argues against tuning amplitude/elevation weights in the forward ranker;
  a better beginning mechanism should change what starts are represented or
  when they are revisited, not add another local axis proxy over true score.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-start-support-smoke-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: first-gap low-air targets are structurally hard because the rider
  begins airborne unless the compiler creates support from frame `0`. Try a
  genuinely different beginning model: prepend a short support line under the
  actual starting sled point to first-gap low-air candidates, end it early
  enough to leave the minimum airborne run required for a landing event, then
  let the normal first-contact catch validate.
- Code changes made: temporarily changed `scripts/v0/optimizer/sample.ts` so
  first-gap low-air candidate sampling reserved the first line id for a support
  line, shifted the normal catch geometry by one id, and supplied a trimmed
  pre-target trace so the intentional initial support did not trigger the
  generic preclear rejection.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=16 --specs=drums_pendulum,tiny_dance,cold_start,opening_burst,drums_crescendo,drums_tide,big_air_ramp,terrace_sprint --budgets=50000,100000 --archive-dir=generated/golden-runs/probe-start-support-smoke-01`
- Decide result: indicative, non-promotable `VERDICT: REJECT` on the paired
  `50k`/`100k` intersection; headline `479.4 -> 92.5`, `Delta=-386.8`,
  95% CI `[-460.9, -192.9]`, `P(Delta<=0)=100.0%`. Per-budget deltas were
  `50k -252.6` and `100k -453.9`.
- Notable regressions: validity collapsed from `97% -> 57%` at `50k` and
  `100% -> 57%` at `100k`. `drums_pendulum` and `drums_crescendo` frequently
  scored `0`, while `cold_start`, `terrace_sprint`, and some `tiny_dance` rows
  also became invalid.
- Notable improvements: none worth promoting; some unaffected higher-air rows
  still passed, but the target first-gap rows regressed catastrophically.
- Diagnostics: the concept is distinct from prior first-gap rank/preline probes,
  but bolting physical start support into every low-air first fit overwhelms the
  landing/off-beat contract and changes the first-catch basin too aggressively.
  A future grounded-start approach would need to be represented as a separate
  initial-condition lane with its own validation semantics, not as an extra line
  inside the normal first-candidate fit.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-start-vertical-angle-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: the current start candidate angle center is driven by `air` only,
  so amplitude/elevation starts must be discovered by the forward evaluator from
  a pool that may not represent enough vertical intent. Change the
  initial-condition representation, not geometry: smoothly nudge the start
  angle center upward for high elevation/high amplitude and slightly downward
  for very low amplitude.
- Code changes made: temporarily changed `targetStartAngle(...)` in
  `scripts/v0/optimizer/handoff.ts`, adding smooth elevation/amplitude angle
  terms and modestly widening the center clamp before the existing
  `[-26,-13,0,13,26]` offsets.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift,drums_pendulum,tiny_dance,drums_tide,drums_swell,drums_breath --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-vertical-angle-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `50k`/`100k`/`300k` intersection; headline `604.0 -> 604.8`,
  `Delta=+0.8`, 95% CI `[-6.9, 9.9]`, `P(Delta<=0)=48.0%`. Per-budget
  deltas were `50k +17.3`, `100k -3.1`, and `300k -0.7`. Validity moved
  `97% -> 98%` at `50k` and stayed `100% -> 100%` at higher budgets.
- Notable improvements: weighted wins on `drums_pendulum +14.18`,
  `rolling_drop +11.49`, `big_air_ramp +11.27`, `rolling_hills +10.99`,
  `switchback_pop +9.16`, and `terrace_sprint +5.48`. Largest row wins
  included `drums_pendulum` seed `11` at `50k` (`+456.8`, validity rescued),
  `drums_pendulum` seed `8` at `50k` (`+423.7`, validity rescued),
  `drums_pendulum` seed `7` at `50k` (`+310.9`, validity rescued), and
  `terrace_sprint` seed `10` at `300k` (`+112.3`).
- Notable regressions: weighted losses on `canyon_steps -37.46`,
  `skyline_push -20.88`, `soar_settle -5.79`, `dense_echo_climb -4.70`,
  `valley_bounce -4.61`, and `pop_train -3.06`. Largest row losses included
  `drums_pendulum` seed `5` at `50k` (`-487.4`, validity lost),
  `drums_pendulum` seed `4` at `50k` (`-362.3`, validity lost),
  `pop_train` seed `4` at `100k` (`-237.5`), and `soar_settle` seed `2` at
  `100k` (`-181.8`).
- Diagnostics: the mechanism proves start representation matters: it increased
  `50k` score and rescued several low-budget rows without changing first-fit
  physics. But the effect is too unstable and gives back quality at `100k` and
  `300k`. On the paired slice, `300k` viable candidates rose
  `2877.32 -> 2909.69` and repair accepts rose `3.77 -> 3.84`, but the selected
  basin shifted enough to hurt `canyon_steps`/`skyline_push`/`soar_settle`.
  A future version should likely add vertical starts as extra alternatives
  rather than moving the whole start-angle center for every vertical target.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-start-vertical-alt-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: the center-shift version proved that vertical start
  representation can move score, but it was too destructive because it moved the
  whole angle pool. Preserve the existing air-based start angles and add a small
  secondary vertical-angle family for amplitude/elevation starts, letting the
  existing charged start evaluator choose without removing the old basin.
- Code changes made: temporarily changed `startAngles(...)` in
  `scripts/v0/optimizer/handoff.ts` to append three vertical-centered angles
  when amplitude/elevation targets moved the center by at least `4` degrees, and
  changed `startHeuristicCost(...)` to score angle distance against the nearest
  represented center.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift,drums_pendulum,tiny_dance,drums_tide,drums_swell,drums_breath --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-vertical-alt-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `50k`/`100k`/`300k` intersection; headline `604.0 -> 602.4`,
  `Delta=-1.6`, 95% CI `[-5.0, 1.1]`, `P(Delta<=0)=86.6%`. Per-budget
  deltas were `50k -1.4`, `100k -2.4`, and `300k -1.3`. Validity moved
  `97% -> 98%` at `50k` and stayed `100% -> 100%` at higher budgets.
- Notable improvements: weighted wins on `rolling_drop +8.42` and
  `syncopated_lift +3.30`. Largest row wins included `skyline_push` seed `0`
  at `50k` (`+121.2`), `canyon_steps` seed `9` at `100k` (`+76.6`),
  `rolling_drop` seed `9` at `50k` (`+76.3`), and `rolling_drop` seed `11` at
  `100k` (`+67.4`).
- Notable regressions: weighted losses on `soar_settle -13.76`,
  `dense_echo_climb -10.10`, `terrace_sprint -10.08`, `ridge_pulse -8.83`,
  and `skyline_push -8.54`. Largest row losses included `skyline_push` seed `3`
  at `100k` (`-198.7`), `soar_settle` seed `7` at `100k` (`-121.8`),
  `soar_settle` seed `7` at `300k` (`-103.4`), and `terrace_sprint` seed `1`
  at `300k` (`-97.2`).
- Diagnostics: preserving the old angle pool avoided the large validity churn
  from the center-shift probe, but it did not create a productive new start
  basin. Average selected start rank and ranks-with-fits were unchanged, while
  candidate/repair conversion ticked down (`300k` unique full
  `23.81 -> 23.73`, repair accepts `3.77 -> 3.74`). Extra represented starts
  mostly perturb root scoring rather than delivering better selected starts.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-start-ballistic-firstcontact-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: current start candidates treat the target start angle as the
  frame-0 velocity angle, then gravity steepens the rider before the first
  controlled contact. Add a qualitatively different initial-condition family:
  compute candidate frame-0 velocities whose free-fall velocity at the first
  contact matches the intended first-contact speed/angle, and let the existing
  charged start evaluator pick or reject them.
- Code changes made: temporarily reserved part of the existing start scoring
  pool for ballistic first-contact velocities on all first gaps, ranked by
  predicted first-contact speed/angle.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-ballistic-firstcontact-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `50k`/`100k`/`300k` intersection; headline `591.6 -> 592.0`,
  `Delta=+0.4`, 95% CI `[-6.9, 7.4]`, `P(Delta<=0)=46.1%`. Per-budget
  deltas were `50k +0.7`, `100k +0.1`, and `300k +0.4`.
- Notable improvements: the mechanism materially improved first-gap speed error
  (`300k` first-gap speed abs error `0.088 -> 0.056`) and produced large row
  wins such as `drums_pendulum` seed `7` at `50k` (`+468.3`) and
  `drums_signature` seed `1` at `100k` (`+161.1`).
- Notable regressions: it worsened first-gap air slightly and first-gap
  elevation clearly (`300k` elevation abs error `0.061 -> 0.113`), with large
  losses on `drums_crescendo` seed `7` at `50k` (`-522.6`) and
  `terrace_sprint` seed `1` at `300k` (`-97.2`).
- Diagnostics: first-contact ballistic starts are a real representation lever,
  but applying them to vertical-axis first gaps fights elevation/amplitude
  placement. The next form should exclude first gaps that target elevation or
  amplitude rather than moving those rows with a velocity-only model.
- Status: reverted/refined; no canonical run and no commit.

## start-ballistic-air-speed-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: the ballistic first-contact model should help starts governed by
  air/speed, but vertical first gaps need the existing start basin because the
  velocity-only correction worsened elevation/amplitude. Gate the ballistic
  start family off when the first contact gap targets `elevation` or
  `amplitude`, and keep the same start scoring pool size.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, added
  air/speed-only ballistic first-contact start candidates, kept manual `start`
  and `preroll: 0` specs unchanged, and restored the old base-start pool when no
  ballistic candidates are active.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-ballistic-air-speed-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-ballistic-air-speed-01`
- Decide results:
  - Probe: indicative `VERDICT: INCONCLUSIVE`; headline `591.6 -> 593.2`,
    `Delta=+1.6`, 95% CI `[-5.1, 7.9]`, `P(Delta<=0)=28.2%`.
  - Canonical: `VERDICT: INCONCLUSIVE`; headline `629.1 -> 630.0`,
    `Delta=+0.9`, 95% CI `[-3.0, 4.3]`, `P(Delta<=0)=28.2%`.
- Notable improvements: canonical gains were strongest at `100k`/`200k`
  (`+1.7`/`+1.9` reported). Spec means improved on `cold_start +27.33`,
  `drums_signature +13.76`, `drums_pendulum +10.25`, `drums_zigzag +4.26`,
  and `dense_sprint +3.84`.
- Notable regressions: `50k` regressed by `-5.8` canonical despite unchanged
  validity, with large scarce-budget losses on `solo_run` seed `8` and
  `drums_crescendo` seed `7`. Spec means also fell on `solo_run -10.40`,
  `drums_crescendo -6.31`, `drums_swell -5.65`, and `rhythm_ladder -5.06`.
- Diagnostics: the mechanism is useful after the first-complete basin has
  enough budget, but it perturbs the scarce `50k` contract race. A smooth budget
  ramp should keep 50k byte-equivalent to baseline while retaining the
  higher-budget gains.
- Status: not kept directly; refined into `start-ballistic-air-speed-ramp-01`.

## start-ballistic-air-speed-ramp-01

- Baseline used: `mature-avg-start35-01` at commit `101eab1`.
- Hypothesis: preserve the accepted first-complete basin at scarce budget while
  keeping the air/speed ballistic-start gains at mature budgets. Fade the number
  of ballistic start candidates in smoothly from `50k` to `100k`; when the
  pressure is zero, restore the original base start pool exactly.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, passed the compile
  budget into `buildStartOptions(...)`, added a smooth
  `ballisticStartBudgetPressure(...)`, and used it to allocate up to four
  first-contact ballistic starts only for non-vertical first gaps.
- Golden commands:
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-ballistic-air-speed-ramp-01`
  - Canonical: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-ballistic-air-speed-ramp-01`
- Decide results:
  - Probe: indicative `VERDICT: INCONCLUSIVE`; headline `591.6 -> 593.2`,
    `Delta=+1.5`, 95% CI `[-1.4, 5.1]`, `P(Delta<=0)=16.9%`.
  - Canonical: `VERDICT: ACCEPT`; headline `629.1 -> 630.4`,
    `Delta=+1.3`, 95% CI `[-0.5, 3.7]`, `P(Delta<=0)=9.2%`.
    Per-budget deltas were `50k +0.0`, `100k +1.7`, `200k +1.9`,
    and `300k +1.1`; validity stayed unchanged at all budgets.
- Notable improvements: the ramp removed the `50k` drag from
  `start-ballistic-air-speed-01` while preserving the higher-budget gains.
  Canonical accepted because the improvement was smooth across `100k`/`200k`/
  `300k` and did not rely on a single budget.
- Notable regressions: remaining reported high-budget uncertainty is concentrated
  in noisy air/speed rows such as `rhythm_ladder`, `drums_swell`, and
  `drums_crescendo`, but the canonical cluster decision accepted the net effect.
- Diagnostics: this is a genuinely different beginning mechanism: it changes the
  represented initial conditions from desired frame-0 velocity to desired
  first-contact velocity, without adding prelines or changing traversal order.
  The vertical-axis gate is important because a velocity-only ballistic start
  worsened first-gap elevation/amplitude.
- Status: kept; accepted by canonical decision gate. New baseline for subsequent
  attempts is `start-ballistic-air-speed-ramp-01`.

## probe-vertical-curve-residual-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: high-budget vertical specs underachieve elevation/amplitude because
  the contact-centered post-contact curvature span is faded out by mature
  budgets. Reintroduce a small residual curvature only for `elevation`/
  `amplitude` targets, scaled by available arc-length room, to add vertical shape
  diversity without globally amplifying launches.
- Code changes made: temporarily restored up to `28%` of the faded
  post-contact curve-bias span for vertical-target gaps, ramping in from `75k`
  to `150k` frames.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-vertical-curve-residual-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `100k`/`200k`/`300k` intersection; headline `618.0 -> 615.6`,
  `Delta=-2.3`, 95% CI `[-7.8, 1.8]`, `P(Delta<=0)=83.6%`. Per-budget deltas
  were `100k -5.7`, `200k -1.6`, and `300k -1.7`; validity stayed
  `100% -> 100%` at all measured budgets.
- Notable improvements: `terrace_sprint` seed `10` improved by `+88.0` at
  `300k`, `float_bounds` seed `2` by `+46.5`, `swoop_dive` seed `4` by
  `+46.2`, and `climb_terrace` seed `8` by `+22.7`.
- Notable regressions: `soar_settle` took broad losses, including seeds `3`
  (`-60.9`), `6` (`-60.5`), `9` (`-55.3`), and `7` (`-53.7`) at `300k`.
  `swoop_dive` seed `10` also lost `-46.4`.
- Diagnostics: work deltas were essentially neutral, so this was not a budget
  starvation effect. The added curvature changes selection basins and helps a
  few underpowered vertical rows, but it dilutes already-good vertical ride-outs
  and is especially bad at `100k`.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-vertical-start-kinematic-03

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: vertical first gaps need a different initial-condition primitive
  than the accepted air/speed first-contact velocity correction. Add a few
  compiler-owned start velocities for first gaps targeting `elevation` or
  `amplitude`, with `vy` chosen from the same first-gap kinematic band used by
  the vertical axis model, and ramp the candidates in smoothly after scarce
  budgets.
- Code changes made: temporarily added up to four vertical first-contact start
  candidates, ramping from `75k` to `150k`, while preserving the accepted
  air/speed ballistic starts for non-vertical first gaps.
- Golden commands:
  - Broken implementation runs: `probe-vertical-start-kinematic-01` and `-02`
    both failed before simulation (`elevationToLaunchVy` import, then missing
    local `lerp` helper); no decision was taken from them.
  - Smoke after fixes: `LR_ENGINE=wasm npm run golden -- --jobs=1 --specs=climb_terrace --seed=0 --budgets=100000 --archive-dir=generated/golden-runs/probe-vertical-start-kinematic-smoke-03`
  - Probe: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=climb_terrace,swoop_dive,rolling_hills,summit_push,mixed_grade,big_air_ramp,pop_train,soar_settle,leap_cadence,float_bounds,canyon_steps,ridge_pulse,valley_bounce,switchback_pop,terrace_sprint,glide_stairs,dense_echo_climb,rolling_drop,skyline_push,syncopated_lift --budgets=100000,200000,300000 --archive-dir=generated/golden-runs/probe-vertical-start-kinematic-03`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `100k`/`200k`/`300k` intersection; headline `618.0 -> 617.2`,
  `Delta=-0.7`, 95% CI `[-6.2, 3.6]`, `P(Delta<=0)=60.2%`. Per-budget deltas
  were `100k -4.8`, `200k -0.5`, and `300k +0.5`; validity stayed
  `100% -> 100%`.
- Notable improvements: weighted spec wins on `terrace_sprint +10.35`,
  `big_air_ramp +8.87`, `mixed_grade +8.86`, and `rolling_drop +6.75`.
  Largest row wins at `300k` included `terrace_sprint` seed `10` (`+95.7`),
  `swoop_dive` seed `1` (`+34.3`), and `rolling_drop` seed `6` (`+30.1`).
- Notable regressions: weighted losses on `soar_settle -37.14`,
  `leap_cadence -14.99`, `pop_train -7.78`, and `swoop_dive -4.52`.
  Largest `300k` row losses included `soar_settle` seed `3` (`-49.7`),
  `soar_settle` seed `11` (`-41.7`), and `swoop_dive` seed `8` (`-30.1`).
- Diagnostics: this was a real beginning mechanism and selected different start
  basins, but the effect was not robust. The tiny `300k` gain does not pay for
  the `100k` loss, and high-air vertical openings are especially fragile when
  their start is re-kinematicized.
- Status: reverted after indicative decide; no canonical run and no commit.

## probe-quality-ncand28-current-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: the accepted ballistic start baseline may make the old broader
  quality-candidate signal worth revisiting. Retest `LR_QUALITY_NCAND=28` as an
  environment-only probe before converting it into source behavior.
- Code changes made: none; used `LR_QUALITY_NCAND=28`.
- Golden command: `LR_ENGINE=wasm LR_QUALITY_NCAND=28 npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-quality-ncand28-current-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` intersection; headline `645.7 -> 646.7`, `Delta=+1.0`,
  95% CI `[-1.5, 3.5]`, `P(Delta<=0)=20.5%`. Per-budget deltas were
  `200k +0.4` and `300k +1.4`; validity stayed `100% -> 100%`.
- Notable improvements: `swoop_dive` seed `5` improved `+61.7` at `300k`,
  `float_bounds` seed `2` `+54.6`, `solo_run` seed `11` `+54.0`, and
  `drums_pendulum` seed `4` `+52.3`.
- Notable regressions: `drums_signature` seed `5` lost `-63.9`,
  `drums_signature` seed `6` `-56.1`, `swoop_dive` seed `10` `-48.8`,
  `drums_breath` seed `8` `-43.9`, and `drums_tide` seed `1` `-43.7`.
- Diagnostics: extra quality breadth was directionally positive but noisy, with
  high duplicate-full pressure (`300k` unique full rate `83.5%`) and broad
  row-level volatility. Treated as a signal for a narrower adaptive source
  attempt, not as a direct source change.
- Status: not kept directly; no canonical run and no commit.

## probe-weak-quality-breadth-current-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: keep the measured quality breadth sweet spot at `24`, but add up
  to four deterministic extra candidates only after a passing incumbent exists
  and its `axis_quality` is weak, ramped smoothly by budget and terminal
  feedback. This should capture part of the `LR_QUALITY_NCAND=28` upside without
  globally taxing already-good rows.
- Code changes made: temporarily added an adaptive `qualitySampleCount` wrapper
  in `scripts/v0/optimizer/handoff.ts`, threaded `bestKey` into quality and
  near-tail sampling, and preserved the `LR_QUALITY_NCAND` override as an escape
  hatch.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-weak-quality-breadth-current-01`
- Decide result: indicative `VERDICT: REJECT` on the paired
  `200k`/`300k` intersection; headline `645.7 -> 645.5`, `Delta=-0.2`, 95% CI
  `[-0.6, 0.0]`, `P(Delta<=0)=97.4%`. Per-budget deltas were `200k -0.3` and
  `300k -0.2`; validity stayed `100% -> 100%`.
- Notable improvements: small `300k` row wins on `drums_pendulum` seed `6`
  (`+3.6`), `leap_cadence` seed `9` (`+2.8`), `skyline_push` seed `6`
  (`+2.1`), and `switchback_pop` seed `3` (`+2.0`).
- Notable regressions: larger `300k` losses on `swoop_dive` seed `8`
  (`-28.6`), `leap_cadence` seed `2` (`-26.6`), `summit_push` seed `2`
  (`-7.4`), and `leap_cadence` seed `3` (`-7.0`).
- Diagnostics: the change increased full terminal feedback (`300k` full/row
  `25.5`, unique full/row `20.1`) but duplicate fulls rose and the extra work
  did not convert into quality. The stable selected starts in the worst
  regressions show the damage was later placement/ranking volatility, not a
  better beginning mechanism.
- Status: reverted after indicative reject; no canonical run and no commit.

## probe-start-repair-smoke-02

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: first-gap/root work still has merit if represented as a separate
  beginning lane rather than a local first-arc tweak. After the main search has
  a complete incumbent, run a bounded alternate-start repair from non-incumbent
  start roots when the incumbent's first contact owns a large share of axis SSE,
  and accept only through the existing full-score register.
- Code changes made: temporarily added a smooth first-gap-SSE/budget gated
  alternate-start repair pass in `scripts/v0/optimizer/handoff.ts`, with up to
  two deterministic non-incumbent start-root restarts before normal suffix
  repair.
- Golden commands:
  - Broken smoke: `LR_ENGINE=wasm LR_REPAIR_LOG=1 npm run golden -- --jobs=1 --specs=tiny_dance,cold_start,big_air_ramp --seed=0 --budgets=300000 --archive-dir=generated/golden-runs/probe-start-repair-smoke-01` failed before simulation due to a missing local interpolation helper; no decision was taken from it.
  - Fixed smoke: `LR_ENGINE=wasm LR_REPAIR_LOG=1 npm run golden -- --jobs=1 --specs=tiny_dance,cold_start,big_air_ramp --seed=0 --budgets=300000 --archive-dir=generated/golden-runs/probe-start-repair-smoke-02`
- Decide result: indicative `VERDICT: REJECT` on the paired
  `tiny_dance,cold_start,big_air_ramp` seed `0` at `300k`; headline
  `559.8 -> 557.6`, `Delta=-2.2`, 95% CI `[-7.0, 0.0]`,
  `P(Delta<=0)=100.0%`. Validity stayed `100% -> 100%`.
- Notable behavior: the new start lane did fire and could improve the live
  incumbent locally (`cold_start` alternate rank `1` accepted at `+3.25`
  internal full-score, `big_air_ramp` rank `1` accepted at `+61.19`), but the
  spend displaced normal suffix repair and final paired scores were lower.
- Diagnostics: root/first-start work is real, but spending a reserved slice
  before the proven repair pass is the wrong budget shape. A separate physical
  supported-start sweep also found no quiet support configuration under strict
  event criteria and hit a wasm `RuntimeError: unreachable` on a broader support
  geometry sweep, reinforcing that arbitrary initial support can violate engine
  stability or detector semantics unless represented with much more care.
- Status: reverted after indicative reject; no canonical run and no commit.

## start-gap-blend-current-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: retest the strongest prior beginning mechanism on the current
  ballistic-start baseline. Shape start candidates from a smooth blend of the
  raw `t=0` axes toward the first-contact gap-averaged axes only when the first
  gap has meaningful axis distance. This changes the represented start state
  without adding physical pre-support or reserving repair budget.
- Code changes made: temporarily imported `TARGET_AXES` in
  `scripts/v0/optimizer/handoff.ts`, added smooth distance constants, routed
  `buildStartOptions` through `startSelectionAxes(firstAxes(rawSpec),
  firstContactAxes)`, and added the blend helper. The import smoke passed.
- Focused golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-gap-blend-current-01`
- Focused decide result: indicative, non-promotable `VERDICT: ACCEPT` on the
  focused slice; headline `593.2 -> 594.4`, `Delta=+1.2`, 95% CI
  `[-0.1, 3.6]`, `P(Delta<=0)=7.4%`. Per-budget deltas were `50k -0.1`,
  `100k +1.6`, and `300k +1.3`; validity moved `97% -> 96%` at `50k` and
  stayed `100% -> 100%` at larger budgets.
- Canonical golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-gap-blend-current-01`
- Canonical decide result: `VERDICT: INCONCLUSIVE`; headline `630.4 -> 630.7`,
  `Delta=+0.3`, 95% CI `[-1.0, 1.9]`, `P(Delta<=0)=32.9%`. Per-budget deltas
  were `50k +0.8`, `100k +0.6`, `200k +0.5`, and `300k +0.1`; validity stayed
  unchanged at `97%` for `50k` and `100%` for the larger budgets.
- Notable improvements at `300k`: `swoop_dive` seed `3` `+68.64`,
  `drums_breath` seed `4` `+58.44`, `drums_tide` seed `5` `+53.93`,
  `swoop_dive` seed `11` `+43.16`, `drums_tide` seed `4` `+42.32`,
  `float_bounds` seed `2` `+39.26`, `drums_tide` seed `6` `+38.78`, and
  `swoop_dive` seed `1` `+35.31`.
- Notable regressions at `300k`: `drums_tide` seed `2` `-41.59`,
  `drums_breath` seed `10` `-40.11`, `drums_breath` seed `6` `-36.79`,
  `swoop_dive` seed `10` `-34.66`, `pop_train` seed `6` `-31.31`,
  `pop_train` seed `7` `-27.38`, `drums_breath` seed `9` `-26.31`, and
  `pop_train` seed `3` `-25.13`.
- Diagnostics: this remains the strongest beginning signal seen recently:
  budget-neutral, validity-preserving, and directionally positive on every
  canonical budget. It was not promoted because the canonical effect was too
  small and noisy, with `300k` nearly flat and large seed-level variance from
  tiny start shifts.
- Status: reverted after canonical inconclusive; no commit.

## probe-first-contact-pool-current-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: the first committed contact is still prefiltered by local
  first-gap candidate cost before the true forward evaluator can rank it. Since
  first-gap air can be structurally misleading, score a larger first-contact
  pool as budget matures while leaving start states and candidate generation
  unchanged.
- Code changes made: temporarily added a smooth budget ramp in
  `scripts/v0/optimizer/handoff.ts` so nodes with no committed contact scored
  a larger pool, growing from the default `8` toward the sampled candidate
  prefix after `50k` over a `100k` span, with deterministic fractional
  activation.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-first-contact-pool-current-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`; paired
  headline `593.2 -> 592.7`, `Delta=-0.4`, 95% CI `[-1.9, 0.6]`,
  `P(Delta<=0)=76.5%`. Per-budget deltas were `50k +0.0`, `100k -0.1`, and
  `300k -0.6`. Validity moved `97% -> 96%` at `50k` and stayed
  `100% -> 100%` at larger budgets.
- Notable improvements at `300k`: `drums_tide` seed `6` `+27.86`,
  `rhythm_ladder` seed `3` `+20.87`, `drums_tide` seed `3` `+18.91`,
  `float_bounds` seed `10` `+12.24`, `tiny_dance` seed `5` `+8.52`, and
  `tiny_dance` seed `8` `+7.82`.
- Notable regressions at `300k`: `opening_burst` seed `11` `-87.02`,
  `canyon_steps` seed `7` `-42.61`, `canyon_steps` seed `11` `-37.68`,
  `rhythm_ladder` seed `8` `-16.34`, `opening_burst` seed `8` `-12.65`, and
  `rolling_hills` seed `4` `-11.58`.
- Diagnostics: first-arc prefiltering is a real lever, but the broad pool
  expansion let the forward evaluator select locally cost-worse first arcs that
  destabilized fragile continuations. The change preserved high-budget
  validity, improved some first-gap/short-row cases, and kept total work nearly
  neutral, but it reduced `300k` score on the focused slice and was not worth a
  canonical run.
- Status: reverted after indicative negative result; no commit.

## probe-leftover-start-repair-02

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: short/opening-heavy rows such as `tiny_dance` exhaust normal
  weakest-gap suffix repair long before the frame budget. Spend only the
  otherwise-unused tail after normal repair on full root-level restarts from
  represented start options, with fresh deterministic search seeds, so the
  compiler can reconsider initial conditions and the first arc without
  displacing productive main/repair work.
- Code changes made: temporarily added a post-repair `runLeftoverStartPhase`
  in `scripts/v0/optimizer/handoff.ts`. The first version skipped the incumbent
  start root; the second version included every start option, including the
  incumbent root with a fresh seed. Both accepted results only through the
  existing monotonic register.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Golden commands:
  - `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=tiny_dance,drums_pendulum,big_air_ramp,terrace_sprint,skyline_push,syncopated_lift,switchback_pop,valley_bounce,canyon_steps,rhythm_ladder,cold_start,dense_echo_climb,swoop_dive,rolling_drop,float_bounds,mini_burst,summit_push,leap_cadence,glide_stairs,pop_train --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-leftover-start-repair-01`
  - `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=tiny_dance,drums_pendulum,big_air_ramp,terrace_sprint,skyline_push,syncopated_lift,switchback_pop,valley_bounce,canyon_steps,rhythm_ladder,cold_start,dense_echo_climb,swoop_dive,rolling_drop,float_bounds,mini_burst,summit_push,leap_cadence,glide_stairs,pop_train --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-leftover-start-repair-02`
  - `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=tiny_dance,drums_pendulum,big_air_ramp,terrace_sprint,skyline_push,syncopated_lift,switchback_pop,valley_bounce,canyon_steps,rhythm_ladder,cold_start,dense_echo_climb,swoop_dive,rolling_drop,float_bounds,mini_burst,summit_push,leap_cadence,glide_stairs,pop_train --budgets=200000 --archive-dir=generated/golden-runs/probe-leftover-start-repair-02-200k`
- Decide results:
  - Incumbent-skip version: indicative `VERDICT: INCONCLUSIVE` on the paired
    `100k`/`300k` slice; headline `591.4 -> 591.5`, `Delta=+0.0`, 95% CI
    `[0.0, 0.2]`, `P(Delta<=0)=42.9%`. Per-budget deltas were `100k +0.0`
    and `300k +0.1`.
  - Incumbent-included version: indicative `VERDICT: INCONCLUSIVE` on the same
    slice; headline `591.4 -> 591.5`, `Delta=+0.1`, 95% CI `[0.0, 0.4]`,
    `P(Delta<=0)=14.1%`. Per-budget deltas were `100k +0.0` and `300k +0.1`.
  - `200k` check: indicative `VERDICT: INCONCLUSIVE`; headline
    `590.2 -> 590.2`, `Delta=+0.0`, 95% CI `[0.0, 0.0]`,
    `P(Delta<=0)=58.1%`.
- Notable improvements: the incumbent-included version improved `tiny_dance`
  seed `8` at `300k` by `+16.28`, `mini_burst` seed `9` at `100k` by
  `+3.36`, `leap_cadence` seed `0` at `100k` by `+2.79`, and `tiny_dance`
  seed `0` at `300k` by `+1.64`. It drove `tiny_dance` `300k` runs from
  roughly `80k-110k` sim frames to about `300k`, confirming the leftover tail
  was being used.
- Notable regressions: no paired score regressions were observed on the probed
  slice; the effect was simply too sparse to matter.
- Diagnostics: leftover-only root repair is safe as a concept, but not strong
  enough. It mainly helps rare `tiny_dance` seeds and leaves `200k` flat, so a
  canonical run would almost certainly be diluted. Future beginning work needs
  a better root/prefix objective, not just more full-root restarts after repair
  exhaustion.
- Status: reverted after indicative checks; no canonical run and no commit.

## probe-amplitude-feasible-targets-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: final report diagnostics show short-gap amplitude targets that
  exceed the ballistic sagitta available in the gap. The scorer must keep the
  authored target, but the compiler's local sampled `gap.targets` might do
  better if candidate generation/ranking stops chasing physically impossible
  amplitude and preserves air/speed/elevation instead.
- Code changes made: temporarily capped only the compiler-local sampled
  `gap.targets.amplitude` by `g * frames^2 / (8 * CALIB.AMPLITUDE_CAP)`, leaving
  `gapAxisTargets` and final report/scoring targets unchanged.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=switchback_pop,syncopated_lift,big_air_ramp,terrace_sprint,skyline_push,valley_bounce,canyon_steps,leap_cadence,float_bounds,summit_push,rolling_drop,dense_echo_climb,climb_terrace,swoop_dive,rolling_hills,mixed_grade,pop_train,soar_settle,tiny_dance,drums_pendulum --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-amplitude-feasible-targets-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` on the paired
  `100k`/`300k` slice; headline `601.6 -> 600.9`, `Delta=-0.7`, 95% CI
  `[-2.4, 0.7]`, `P(Delta<=0)=84.5%`. Per-budget deltas were `100k -1.1`
  and `300k -0.6`; validity stayed `100% -> 100%`.
- Notable improvements at `300k`: `terrace_sprint` seed `10` `+52.6`,
  `canyon_steps` seed `3` `+24.6`, `skyline_push` seed `9` `+22.3`,
  `skyline_push` seed `3` `+20.0`, `terrace_sprint` seed `7` `+17.7`,
  and `canyon_steps` seed `8` `+13.7`.
- Notable regressions at `300k`: `terrace_sprint` seed `1` `-70.1`,
  `switchback_pop` seed `7` `-31.8`, `skyline_push` seed `6` `-30.3`,
  `switchback_pop` seed `4` `-24.3`, `skyline_push` seed `7` `-22.3`,
  and `switchback_pop` seed `6` `-20.7`. At `100k`, spec-level losses on
  `switchback_pop`, `syncopated_lift`, `valley_bounce`, and `terrace_sprint`
  dominated the small canyon/skyline wins.
- Diagnostics: the physical observation is real, but capping impossible
  amplitude is too blunt. It changes selection basins and helps some rows whose
  local amplitude pressure was damaging, but it badly hurts the very short
  amplitude specs it was meant to stabilize. Future amplitude work needs a
  better representation or scorer-facing feasibility model, not a local target
  clamp.
- Status: reverted after indicative negative result; no canonical run and no
  commit.

## probe-amplitude-feasible-targets-ramp-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: the blunt amplitude feasibility cap helped some `22-28` frame
  canyon/skyline rows but hurt `20` frame switchback/syncopated rows where the
  cap was too severe. Keep the same scorer-preserving local target idea, but
  fade the cap in smoothly from `0` at `20` frames to full pressure at `28`
  frames.
- Code changes made: temporarily replaced the hard local amplitude cap with
  `amplitude = lerp(target, cap, smoothstep((frames - 20) / 8))` when the cap
  was below the sampled target. Final `gapAxisTargets` and report/scorer
  targets remained unchanged.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=switchback_pop,syncopated_lift,big_air_ramp,terrace_sprint,skyline_push,valley_bounce,canyon_steps,leap_cadence,float_bounds,summit_push,rolling_drop,dense_echo_climb,climb_terrace,swoop_dive,rolling_hills,mixed_grade,pop_train,soar_settle,tiny_dance,drums_pendulum --budgets=100000,300000 --archive-dir=generated/golden-runs/probe-amplitude-feasible-targets-ramp-01`
- Decide result: indicative `VERDICT: INCONCLUSIVE` on the paired
  `100k`/`300k` slice; headline `601.6 -> 601.0`, `Delta=-0.7`, 95% CI
  `[-2.3, 0.3]`, `P(Delta<=0)=90.2%`. Per-budget deltas were `100k -0.9`
  and `300k -0.6`; validity stayed `100% -> 100%`.
- Diagnostics: removing the full cap from the `20` frame cases avoided some of
  the blunt version's worst switchback churn, but the remaining capped `22-28`
  frame cases still did not convert broadly enough. This confirms that local
  amplitude target feasibility is not a good lever on the current compiler.
- Status: reverted after indicative negative result; no canonical run and no
  commit.

## probe-terminal-polish-ramp-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: the existing clone-and-test terminal polish helpers may recover
  air/speed contact errors at mature budgets if enabled with a smooth
  deterministic budget ramp instead of the current opt-in-only default.
- Code changes made: temporarily changed `scripts/v0/optimizer/handoff.ts` so
  terminal polish is sampled by a smooth pressure ramp from `150k` to `300k`
  frames, with deterministic node-level hashing. Explicit `polish: true/false`
  still overrode the default.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,drums_crescendo,drums_signature,drums_swell,drums_tide,drums_breath,drums_crosscut,drums_dropout,drums_zigzag,opening_burst,cold_start,mini_burst,dense_sprint,solo_run,big_air_ramp,terrace_sprint,skyline_push,syncopated_lift,canyon_steps --budgets=200000,300000 --archive-dir=generated/golden-runs/probe-terminal-polish-ramp-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `200k`/`300k` slice; headline `638.3 -> 637.8`, `Delta=-0.5`, 95% CI
  `[-2.1, 0.0]`, `P(Delta<=0)=79.0%`. Per-budget deltas were `200k -0.3` and
  `300k -0.6`; validity stayed `100% -> 100%`.
- Notable behavior: terminal polish changed many `300k` rows, but some
  big-air/skyline rows overspent badly, with several `300k` runs in the
  `380k-530k` simulated-frame range. That makes the negative score result worse:
  the extra work was not merely unhelpful, it was also not budget-disciplined.
- Diagnostics: this confirms the disabled polish path is not a free source of
  high-budget quality. Its helpers can perturb terminal tracks, but the cost is
  irregular and the row-level score effect is negative on this slice.
- Status: reverted after indicative negative result; no canonical run and no
  commit.

## probe-start-eval-avg-current-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: instead of treating the initial condition as a single best greedy
  future, rank starts by average shallow future quality so the beginning prefers
  a wider reachable corridor.
- Code changes made: none; used existing `LR_START_EVAL=avg` override.
- Golden command: `LR_ENGINE=wasm LR_START_EVAL=avg npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-eval-avg-current-01`
- Decide result: indicative `VERDICT: REJECT` on the paired
  `50k`/`100k`/`300k` slice; headline `593.2 -> 578.0`, `Delta=-15.2`, 95% CI
  `[-41.6, 1.8]`, `P(Delta<=0)=94.2%`. Per-budget deltas were `50k -63.4`,
  `100k -35.9`, and `300k -0.3`; validity moved `97% -> 94%` at `50k`,
  `100% -> 99%` at `100k`, and stayed `100% -> 100%` at `300k`.
- Diagnostics: averaging shallow alternatives is not the right notion of
  beginning robustness. It delays or weakens scarce-budget completion and loses
  the greedy start scorer's ability to quickly find a complete basin.
- Status: not kept; environment-only probe, no source change and no commit.

## start-support-low-air-01

- Baseline used: `start-ballistic-air-speed-ramp-01` at commit `98b21cc`.
- Hypothesis: low-air first gaps are structurally impossible when the first
  physical contact is also the first required beat. Add a compiler-owned
  startup support option for low-air first gaps: the rider starts on a short
  emitted support line, releases before the first beat, and still must land on
  normal first-gap candidate geometry for the contact to be credited.
- Code changes made: added `startLines` to handoff start/root nodes, cloned and
  emitted those lines in outputs, advanced root line ids after startup geometry,
  and added low-air startup support start seeds gated by first-gap `air <= 0.35`
  and enough frames to release before the first landing. The optional polish path
  is skipped for support-start nodes because polish rebuilds do not yet carry
  root support geometry. Added `handoff_start_lines` diagnostic stats.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Diagnostic smoke: `LR_ENGINE=wasm npm run golden -- --details --jobs=1 --specs=drums_pendulum --seed=3 --budgets=300000 --archive-dir=generated/golden-runs/probe-start-support-smoke-01`
  improved `drums_pendulum` seed `3` at `300k` from `440.04` to `525.04`.
  First-gap air error dropped from `+0.802` (`achieved 0.95` vs target `0.15`)
  to `+0.183` (`achieved 0.33`), and the selected start used one support line.
- Focused golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,tiny_dance,big_air_ramp,cold_start,drums_crescendo,rhythm_ladder,drums_signature,drums_swell,drums_tide,opening_burst,canyon_steps,terrace_sprint,skyline_push,syncopated_lift,rolling_hills,soar_settle,leap_cadence,float_bounds,dense_echo_climb,swoop_dive --budgets=50000,100000,300000 --archive-dir=generated/golden-runs/probe-start-support-01`
- Focused decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`;
  headline `593.2 -> 605.9`, `Delta=+12.8`, 95% CI `[-8.1, 40.8]`,
  `P(Delta<=0)=13.5%`. The effect was concentrated at `300k` (`+18.6`, CI
  `[2.1, 45.1]`, `P(Delta<=0)=1%`).
- Canonical golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-support-low-air-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `630.4 -> 638.1`,
  `Delta=+7.7`, 95% CI `[-2.0, 21.7]`, `P(Delta<=0)=8.5%`. Per-budget deltas
  were `50k -0.1`, `100k +1.0`, `200k +9.9`, and `300k +9.7`; validity stayed
  `97% -> 97%` at `50k` and `100% -> 100%` for `100k+`.
- Notable improvements at `300k`: `cold_start` seeds `11` (`+285.87`), `2`
  (`+275.89`), `8` (`+270.39`), `10` (`+265.01`), `5` (`+261.46`), `0`
  (`+257.80`), `4` (`+256.66`), and `6` (`+246.38`). `drums_pendulum` also
  gained broadly, including seed `3` (`+84.99`) and several `+30` to `+50`
  improvements.
- Notable regressions at `300k`: `drums_crescendo` seed `10` `-35.96`,
  `drums_pendulum` seed `11` `-27.51`, `drums_crescendo` seed `5` `-20.10`,
  `rhythm_ladder` seed `3` `-13.11`, and `drums_pendulum` seed `7` `-10.14`.
- Diagnostics: this is the first kept beginning change that uses actual
  compiler-owned pre-beat geometry instead of only changing start velocity or
  first-contact ranking. Work stayed budget-disciplined (`300k` common-row
  average sim frames slightly lower than baseline), terminal feedback diversity
  stayed essentially flat, and the gains come from making low-air first gaps
  physically representable.
- Status: kept; accepted by canonical decision gate. New baseline for subsequent
  attempts is `start-support-low-air-01`.

## start-support-midair-01

- Baseline used: `start-support-low-air-01` at commit `eb6c5d6`.
- Hypothesis: the accepted low-air startup support is too narrowly gated.
  Several first gaps with target air around `0.36-0.55` still start effectively
  airborne for most of the gap, producing first-contact air near `0.9`. Extend
  startup support to medium-low air targets, but shape the release frame by the
  requested first-gap air so these starts do not collapse into the low-air case.
- Code changes made: raised startup support eligibility from `air <= 0.35` to
  `air <= 0.55`; computed support release as
  `firstGap.endFrame - max(releaseMargin, round(firstGap.endFrame * air))`;
  kept the existing three speed offsets for low-air starts and used only the
  target speed for medium-air starts to avoid widening start-eval work.
- Focused golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,cold_start,drums_crescendo,rhythm_ladder,tiny_dance,terrace_sprint,ridge_pulse,rolling_hills,verse_chorus,drums_signature,drums_swell,canyon_steps,syncopated_lift,switchback_pop,summit_push,climb_terrace,mixed_grade,solo_run,drums_pulse,big_air_ramp,dense_echo_climb --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-start-support-midair-01`
- Focused decide result: indicative, non-promotable `VERDICT: ACCEPT` on the
  paired `21` spec intersection; headline `616.5 -> 675.3`, `Delta=+58.8`,
  95% CI `[27.5, 101.7]`, `P(Delta<=0)=0.0%`. Per-budget deltas were
  `50k -0.0`, `100k +60.9`, `200k +63.0`, and `300k +65.1`.
- Canonical golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-support-midair-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `638.1 -> 670.7`,
  `Delta=+32.6`, 95% CI `[13.9, 57.1]`, `P(Delta<=0)=0.0%`. Per-budget deltas
  were `50k +1.4`, `100k +34.2`, `200k +34.6`, and `300k +35.9`; validity moved
  `97% -> 96%` at `50k` and stayed `100% -> 100%` for `100k+`.
- Notable improvements at `300k`: `tiny_dance` gained massively across seeds,
  including seed `8` `+438.87`, seed `9` `+433.53`, seed `10` `+428.00`, seed
  `5` `+425.71`, seed `6` `+425.08`, seed `7` `+424.41`, seed `1` `+423.17`,
  and seed `4` `+414.53`. Medium-air starts also lifted broad rows such as
  `rolling_hills`, `verse_chorus`, and `big_air_ramp`.
- Notable regressions at `300k`: `rhythm_ladder` seed `11` `-99.12`,
  `solo_run` seed `2` `-75.96`, `cold_start` seed `2` `-64.78`,
  `drums_zigzag` seed `5` `-57.69`, `rhythm_ladder` seed `5` `-53.88`,
  `rhythm_ladder` seed `8` `-45.50`, `drums_zigzag` seed `7` `-36.59`, and
  `cold_start` seed `10` `-33.43`.
- Diagnostics: this confirms the beginning is a high-leverage area when the
  representation changes, not just the ranking or scoring of existing starts.
  The wins come from making medium-low first-gap air physically representable
  with compiler-owned support geometry and a target-shaped release. The main
  residual cost is that a few specs prefer the old ballistic start basin, so the
  next start work should preserve multiple start families more deliberately
  rather than only expanding support eligibility.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `start-support-midair-01`.

## probe-low-amplitude-damped-launch-01

- Baseline used: `start-support-midair-01` at commit `cb73791`.
- Hypothesis: several weak amplitude rows overshoot low or medium-low amplitude
  targets because the contact-centered generator only actively shapes high
  amplitude. Add a spanned low-amplitude damping path that blends steep
  elevation/energy launches back toward the ordinary post angle and keeps a
  longer grounded ride-out.
- Code changes made: temporarily added low-amplitude constants to
  `scripts/v0/arc_placement.ts`; when `amplitude` was below roughly `0.48`, the
  amplitude block blended `postAngleDeg` toward `angledPostAngleDeg`, limited
  steep upward launch angles, and raised `postLength` toward the air-targeted
  grounded length.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=terrace_sprint,skyline_push,valley_bounce,syncopated_lift,switchback_pop,drums_zigzag,rhythm_ladder,drums_pendulum,cold_start,solo_run,rolling_hills,verse_chorus,tiny_dance,big_air_ramp,dense_echo_climb,canyon_steps,climb_terrace,mixed_grade,summit_push,drums_signature --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-low-amplitude-damped-launch-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `20` spec intersection; headline `662.2 -> 661.0`, `Delta=-1.2`,
  95% CI `[-7.5, 4.2]`, `P(Delta<=0)=65.3%`. Per-budget deltas were
  `50k -3.8`, `100k -6.4`, `200k -0.9`, and `300k +0.7`.
- Diagnostics: the broad damping helped some intended rows (`terrace_sprint`,
  `dense_echo_climb`) but caused a large `skyline_push` seed `7` regression
  (`-110.64`) and hurt several `valley_bounce`/`big_air_ramp` rows. The idea
  was too broad for medium-low amplitude targets.
- Status: reverted; no canonical run and no commit.

## probe-low-amplitude-damped-launch-narrow-01

- Baseline used: `start-support-midair-01` at commit `cb73791`.
- Hypothesis: the damping representation may still be useful if restricted to
  genuinely low amplitude targets, avoiding the medium-amplitude skyline cases
  that regressed in the broad version.
- Code changes made: temporarily narrowed the damping ramp to start around
  `amplitude < 0.36` with a `0.24` span, preserving the same spanned launch/length
  damping behavior for very low amplitude targets.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=terrace_sprint,skyline_push,valley_bounce,syncopated_lift,switchback_pop,drums_zigzag,rhythm_ladder,drums_pendulum,cold_start,solo_run,rolling_hills,verse_chorus,tiny_dance,big_air_ramp,dense_echo_climb,canyon_steps,climb_terrace,mixed_grade,summit_push,drums_signature --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-low-amplitude-damped-launch-narrow-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `20` spec intersection; headline `662.2 -> 663.7`, `Delta=+1.5`,
  95% CI `[-3.2, 6.1]`, `P(Delta<=0)=26.4%`. Per-budget deltas were `50k -1.9`,
  `100k +1.4`, `200k +1.5`, and `300k +2.1`.
- Notable improvements at `300k`: `dense_echo_climb` seed `5` `+65.50`,
  `terrace_sprint` seed `2` `+52.57`, `terrace_sprint` seed `6` `+47.12`,
  `switchback_pop` seed `8` `+46.26`, and several additional
  `dense_echo_climb`/`terrace_sprint` gains.
- Notable regressions at `300k`: `valley_bounce` seed `1` `-65.78`,
  `terrace_sprint` seed `11` `-37.66`, `valley_bounce` seed `4` `-37.05`,
  `valley_bounce` seed `10` `-36.50`, and `valley_bounce` seed `8` `-32.27`.
- Diagnostics: the narrower representation is directionally positive at mature
  budgets but not decisive and still unstable on low-amplitude first/early gaps.
  This is not strong enough to stack onto the accepted baseline. Future amplitude
  work should probably distinguish first-gap support/air coupling from ordinary
  low-amplitude launch damping.
- Status: reverted; no canonical run and no commit.

## start-support-air-062-01

- Baseline used: `start-support-midair-01` at commit `cb73791`.
- Hypothesis: after the accepted medium-air start support, the remaining
  first-gap over-air cases include targets just above the `0.55` eligibility
  cutoff. Let the same target-shaped support representation compete up to
  `air <= 0.62`, still with only one medium-air support speed.
- Code changes made: raised `START_SUPPORT_MID_AIR_MAX` from `0.55` to `0.62`
  in `scripts/v0/optimizer/handoff.ts`. Release timing and speed offsets stayed
  unchanged.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Focused golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=terrace_sprint,skyline_push,valley_bounce,syncopated_lift,switchback_pop,drums_zigzag,rhythm_ladder,drums_pendulum,cold_start,solo_run,rolling_hills,verse_chorus,tiny_dance,big_air_ramp,dense_echo_climb,canyon_steps,climb_terrace,mixed_grade,summit_push,drums_signature --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-start-support-air-062-01`
- Focused decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`;
  headline `662.2 -> 664.5`, `Delta=+2.3`, 95% CI `[0.0, 7.6]`,
  `P(Delta<=0)=35.6%`. The effect was concentrated in `valley_bounce`; the
  slice showed no negative changed rows at `300k`, but cluster uncertainty was
  high because many specs were unchanged.
- Canonical golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-support-air-062-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `670.7 -> 680.8`,
  `Delta=+10.1`, 95% CI `[1.6, 22.5]`, `P(Delta<=0)=0.5%`. Per-budget deltas
  were `50k +5.7`, `100k +9.9`, `200k +10.4`, and `300k +10.7`; validity stayed
  `96% -> 96%` at `50k` and `100% -> 100%` for `100k+`.
- Notable improvements at `300k`: `mini_burst` gained massively across seeds,
  including seed `11` `+251.10`, seed `5` `+244.48`, seed `9` `+242.34`, seed
  `7` `+240.43`, seed `2` `+239.66`, seed `1` `+233.24`, seed `6` `+223.30`,
  and seed `10` `+220.91`. `valley_bounce`, `grain_staircase`,
  `rolling_drop`, and `swoop_dive` also improved where the first-gap air target
  sat just above the previous cutoff.
- Notable regressions at `300k`: none in the canonical paired analyzer's largest
  rows; the largest listed deltas were unchanged `0.00` rows. The change is
  narrow enough that most specs are byte-identical.
- Diagnostics: extending support eligibility confirms that the beginning was
  still representation-limited above the previous `0.55` cutoff. The accepted
  change is simple and deterministic, but the threshold is now carrying more
  semantic weight; future start work should consider a smoother family that
  covers first-gap air continuously instead of widening constants one step at a
  time.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `start-support-air-062-01`.

## probe-low-air-grounded-cap-01

- Baseline used: `start-support-air-062-01` at commit `01869b4`.
- Hypothesis: very low-air dense gaps may be structurally blocked by the
  contact-centered ride-out cap. Smoothly raising the safe cap only when the
  air target is low could let the optimizer produce longer grounded ride-outs
  without changing moderate/high-air behavior.
- Code changes made: temporarily added a smooth low-air pressure term in
  `scripts/v0/arc_placement.ts`, increasing the air-targeted grounded ride-out
  cap from `0.55` up toward `0.83` of the next gap as the air target falls below
  roughly `0.45`.
- Import smoke: `npx tsx -e "import('./scripts/v0/arc_placement.ts').then(() => console.log('arc placement import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=drums_pendulum,rhythm_ladder,grain_staircase,mini_burst,valley_bounce,rolling_drop,skyline_push,switchback_pop,syncopated_lift,terrace_sprint,canyon_steps,swoop_dive,drums_signature,drums_crescendo,cold_start,tiny_dance --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-low-air-grounded-cap-01`
- Decide result: indicative, non-promotable `VERDICT: REJECT` on the paired
  `16` spec intersection; headline `650.9 -> 575.9`, `Delta=-75.0`, 95% CI
  `[-167.4, 2.5]`, `P(Delta<=0)=93.6%`. Per-budget deltas were `50k -75.2`,
  `100k -239.4`, `200k -90.3`, and `300k -9.9`.
- Notable regressions at `300k`: `drums_pendulum` seed `10` `-190.25`,
  seed `6` `-171.63`, seed `4` `-111.12`, seed `5` `-98.41`, seed `1`
  `-96.70`, plus `drums_crescendo` seed `0` `-112.27` and seed `11` `-94.27`.
- Notable improvements at `300k`: a few guardrail rows improved, including
  `drums_crescendo` seed `5` `+78.96`, `drums_crescendo` seed `4` `+43.66`,
  `canyon_steps` seed `8` `+42.75`, and `grain_staircase` seed `0` `+40.21`.
- Diagnostics: the low-air cap change made the intended `drums_pendulum` target
  substantially worse, so the issue is not simply insufficient local grounded
  ride-out length. The modified early contacts changed selected starts and
  downstream recoverability, suggesting that first/early placement work needs a
  representation or ranking signal that preserves reachable state across the
  following high-air transitions, not just a larger local cap.
- Status: reverted; no canonical run and no commit.

## probe-start-support-continuous-air-01

- Baseline used: `start-support-air-062-01` at commit `01869b4`.
- Hypothesis: the accepted startup support line should be a continuous
  first-gap-air representation instead of stopping at a hard authored-air
  cutoff. High-air sparse openings can need a short controlled run-in before
  release; the target-shaped release timing can decide whether support is useful.
- Code changes made: temporarily removed the `air <= 0.62` startup-support
  eligibility cutoff in `scripts/v0/optimizer/handoff.ts` and allowed support
  whenever the first gap had an air target and at least a minimal two-frame
  run-up before release.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=skyline_push,leap_cadence,soar_settle,big_air_ramp,opening_burst,mini_burst,valley_bounce,drums_pendulum,cold_start,terrace_sprint,dense_echo_climb,canyon_steps,ridge_pulse,glide_stairs,switchback_pop,syncopated_lift,drums_crescendo,rhythm_ladder,tiny_dance,rolling_drop --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-start-support-continuous-air-01`
- Decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE` on the
  paired `20` spec intersection; headline `652.0 -> 656.9`, `Delta=+4.9`,
  95% CI `[-0.0, 14.7]`, `P(Delta<=0)=12.9%`. Per-budget deltas were
  `50k +1.9`, `100k +4.7`, `200k +5.2`, and `300k +5.3`.
- Notable improvements at `300k`: `leap_cadence` improved across all seeds,
  including seed `7` `+126.50`, seed `3` `+111.97`, seed `4` `+111.08`,
  seed `2` `+110.47`, seed `9` `+109.14`, seed `11` `+106.39`, seed `10`
  `+99.90`, and seed `0` `+99.64`.
- Notable regressions at `300k`: `opening_burst` seed `7` `-20.95`, seed `2`
  `-13.07`, and seed `0` `-12.00`; dense high-air openings were selecting a
  support run-in that was too short to be physically meaningful.
- Diagnostics: removing the air cutoff exposed a real high-air support basin, but
  the two-frame minimum allowed support starts on dense high-speed openings with
  only about four frames of run-up. This was refined into the guarded run-up
  version below.
- Status: refined; no canonical run and no commit.

## start-support-runup-min-01

- Baseline used: `start-support-air-062-01` at commit `01869b4`.
- Hypothesis: startup support should be available continuously across authored
  air when there is enough physical run-up before release, but not when a dense
  high-air opening leaves only a few frames of support. Replace the hard air
  cutoff with a release/run-up feasibility condition.
- Code changes made: in `scripts/v0/optimizer/handoff.ts`, removed
  `START_SUPPORT_MID_AIR_MAX`, computed the target-shaped `releaseFrame`
  directly, and skipped startup support unless `releaseFrame >=
  K_BOUNCE_LANDING + 3`. Existing low-air multi-speed support seeds are
  unchanged.
- Import smoke: `npx tsx -e "import('./scripts/v0/optimizer/handoff.ts').then(() => console.log('handoff import ok'))"` passed.
- Focused golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=skyline_push,leap_cadence,soar_settle,big_air_ramp,opening_burst,mini_burst,valley_bounce,drums_pendulum,cold_start,terrace_sprint,dense_echo_climb,canyon_steps,ridge_pulse,glide_stairs,switchback_pop,syncopated_lift,drums_crescendo,rhythm_ladder,tiny_dance,rolling_drop --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-start-support-runup-min-01`
- Focused decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`;
  headline `652.0 -> 656.4`, `Delta=+4.4`, 95% CI `[-0.0, 14.2]`,
  `P(Delta<=0)=35.7%`. Per-budget deltas were `50k +1.4`, `100k +3.9`,
  `200k +4.5`, and `300k +5.0`. The guard removed the opening-burst regressions;
  largest listed `300k` regression was `soar_settle` seed `10` `-2.00`.
- Extra focused golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --specs=pop_train,float_bounds,drums_tide,drums_breath,drums_crosscut,dense_sprint,drums_dropout,syncopated_switchback,swoop_dive,climb_terrace,mixed_grade,summit_push,solo_run,verse_chorus,drums_zigzag --budgets=50000,100000,200000,300000 --archive-dir=generated/golden-runs/probe-start-support-runup-min-extra-01`
- Extra focused decide result: indicative, non-promotable `VERDICT: INCONCLUSIVE`;
  headline `695.8 -> 709.0`, `Delta=+13.1`, 95% CI `[0.0, 32.9]`,
  `P(Delta<=0)=11.1%`. Per-budget deltas were `50k +1.7`, `100k +12.8`,
  `200k +14.1`, and `300k +14.5`.
- Canonical golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/start-support-runup-min-01`
- Canonical decide result: `VERDICT: ACCEPT`; headline `680.8 -> 687.9`,
  `Delta=+7.1`, 95% CI `[0.0, 15.7]`, `P(Delta<=0)=4.5%`. Per-budget deltas
  were `50k +1.4`, `100k +6.7`, `200k +7.5`, and `300k +7.9`; validity stayed
  `96% -> 96%` at `50k` and `100% -> 100%` at `100k+`.
- Notable improvements at `300k`: `float_bounds` seed `1` `+150.20`, seed `10`
  `+147.69`, seed `2` `+146.74`, seed `7` `+144.79`, seed `8` `+118.92`;
  `leap_cadence` seed `7` `+126.50`; `pop_train` seed `2` `+124.96` and seed
  `5` `+118.31`.
- Notable regressions at `300k`: `float_bounds` seed `6` `-21.82` and
  `soar_settle` seed `10` `-2.00`; the remaining largest entries were unchanged
  rows.
- Diagnostics: the initial-condition problem was not lack of freedom but lack of
  the right represented entry primitive. Sparse air+amplitude openings wanted a
  supported run-in that releases into the first airborne span, while dense
  high-speed openings should keep their ballistic/default starts. The run-up
  guard expresses that distinction through physical feasibility rather than a
  spec-name branch.
- Status: kept; accepted by canonical decision gate. New baseline for
  subsequent attempts is `start-support-runup-min-01`.
