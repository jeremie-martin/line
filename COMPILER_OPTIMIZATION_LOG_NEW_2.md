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
