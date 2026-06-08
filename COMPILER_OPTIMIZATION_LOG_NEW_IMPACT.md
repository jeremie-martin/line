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
