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
