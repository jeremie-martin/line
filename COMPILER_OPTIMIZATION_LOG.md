# Compiler Optimization Log

## arc-baseline-d38c3c2-01

- Baseline commit: `d38c3c2`
- Hypothesis: Fresh canonical baseline from the current implementation is needed before evaluating arc placement changes.
- Code changes made: None.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-baseline-d38c3c2-01`
- Decide result: Pending; this is the baseline archive for paired comparisons.
- Notable regressions/improvements: Canonical baseline HEADLINE `290.3`; budget curve scores `25k=9.19`, `50k=207.71`, `100k=292.71`, `150k=315.37`, `200k=326.07`; validity `966/1200` overall and `225/240` at 200k. Worst 200k rows include `drums_pendulum` seeds 8 and 6, `drums_crosscut` seeds 6 and 9, and `opening_burst` seed 10.
- Status: Baseline kept as the paired reference for attempt 1.

## arc-overspeed-brake-01

- Baseline used: `arc-baseline-d38c3c2-01` at commit `d38c3c2`.
- Hypothesis: Baseline 200k rows are speed-overshoot and landing/preclear dominated. The current `brake` candidate stream is only an extra resample because placement ignores `CandidateSampleMode`; making overspeed shorten/flatten risky pre-contact geometry and making `brake` candidates apply extra smooth uphill post-contact pressure should improve speed quality without changing budget policy or search ordering.
- Code changes made: Threaded `CandidateSampleMode` into target-state control generation; added smooth overspeed pressure to preclear handling; added brake-mode pressure that flattens/shortens pre-contact geometry and steepens/shortens post-contact geometry for speed bleed; added a local `smoothstep` helper. No budget, scorer, seed, spec, metric, or evaluator changes.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-overspeed-brake-01`
- Decide result: `VERDICT: ACCEPT`; baseline `290.3` -> candidate `339.7`; `Δheadline = +49.4`, 95% CI `[19.7, 82.0]`, `P(Δ<=0)=0.2%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-2.1`, `50k=+81.6`, `100k=+66.6`, `150k=+46.9`, `200k=+41.2`. Validity improved at 50k-200k (`200k 225/240 -> 231/240`) but regressed at 25k (`91/240 -> 82/240`). Largest 200k validity flips included `drums_crosscut` seed 6, `drums_pendulum` seed 8, `drums_dropout` seed 7, `syncopated_switchback` seed 0, and `dense_sprint` seed 2 becoming pass; `drums_pendulum` seed 7 regressed pass->fail. At 200k, candidate viability rose `31.2% -> 36.2%`, arc direct landing rate rose `32.3% -> 37.2%`, preclear fell `1965 -> 1537` per row, and skips fell `15 -> 9`.
- Verification: `npx tsx -e "import './scripts/v0/arc_placement.ts'; console.log('arc_placement import ok')"` passed. `npx tsc --noEmit` was attempted but is not usable as a repo-wide check because the current project has pre-existing TypeScript configuration/import errors unrelated to this change.
- Status: Kept and committed as the new baseline for the next mechanism.

## arc-brake-angle-floor-02

- Baseline used: `arc-overspeed-brake-01` at commit `38060d9`.
- Hypothesis: The accepted brake stream improves viability and speed quality, but brake-mode post angles still clamp at the normal `-26deg` floor. This can prevent high-overspeed brake candidates from expressing enough uphill speed bleed. Lowering contact/pre/post angle floors smoothly as brake pressure rises should improve speed-axis quality while leaving normal candidate geometry unchanged.
- Code changes made: Lowered contact/pre/post angle floors smoothly under brake pressure only. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-brake-angle-floor-02`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `339.7` -> candidate `338.7`; `Δheadline = -1.0`, 95% CI `[-7.6, 6.0]`, `P(Δ<=0)=63.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.9`, `50k=-16.8`, `100k=+7.8`, `150k=-1.4`, `200k=-1.1`. Validity was mostly flat/slightly lower (`200k 231/240 -> 231/240`; `25k 82/240 -> 76/240`). The 100k bump did not offset regressions at 50k and high budgets.
- Status: Reverted; not committed.

## arc-high-overspeed-brake-03

- Baseline used: `arc-overspeed-brake-01` at commit `38060d9`.
- Hypothesis: The accepted baseline still has severe speed overshoot on higher target-speed gaps, while brake candidates are only offered on mild target speeds (`<= authored 0.78`). Offering the existing brake stream on higher target speeds only when local overspeed is already in the high-overspeed band should give the ranker speed-bleeding placements where normal candidates cannot control speed, without changing normal candidate geometry.
- Code changes made: Broadened `shouldOfferBrakeCandidates()` so higher target speeds could receive brake probes in the existing high-overspeed band. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-high-overspeed-brake-03`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `339.7` -> candidate `343.9`; `Δheadline = +4.2`, 95% CI `[-1.0, 12.8]`, `P(Δ<=0)=7.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.2`, `50k=-0.2`, `100k=+6.0`, `150k=+5.6`, `200k=+3.9`. Validity improved slightly (`200k 231/240 -> 232/240`; `100k 229/240 -> 231/240`), but the paired headline delta did not clear the explicit `+5` promotion bar and was not accepted.
- Status: Reverted; not committed.

## arc-adaptive-contact-jitter-04

- Baseline used: `arc-overspeed-brake-01` at commit `38060d9`.
- Hypothesis: Remaining missed first contacts and high-speed landing failures suggest the fixed `3.5px` contact-point jitter is too narrow when the rider is fast or in startup catches. Scaling the same deterministic tangent/normal jitter smoothly with target pace, actual entry pace, high-air pressure, and startup pressure should improve landing coverage without changing sample counts, budget behavior, or candidate ordering.
- Code changes made: Added an adaptive contact jitter value to target-state controls and used it for the existing deterministic tangent/normal contact-point offsets. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-adaptive-contact-jitter-04`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `339.7` -> candidate `341.3`; `Δheadline = +1.5`, 95% CI `[-22.0, 39.7]`, `P(Δ<=0)=53.5%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-2.1`, `50k=-44.7`, `100k=+1.1`, `150k=+10.7`, `200k=+6.9`. High-budget score improved, and the worst `drums_pendulum` failures became valid, but low-budget validity regressed (`25k 82/240 -> 66/240`, `50k 220/240 -> 208/240`) and overall uncertainty was too high.
- Status: Reverted; not committed.

## arc-brake-contact-jitter-05

- Baseline used: `arc-overspeed-brake-01` at commit `38060d9`.
- Hypothesis: Broad adaptive contact jitter improved some high-budget rows but hurt low-budget routing because it perturbed normal contract samples. Applying a smoother, smaller contact-jitter expansion only to brake-mode samples should give overspeed brake placements more landing coverage while leaving the normal deterministic prefix unchanged.
- Code changes made: Added a brake-mode-only contact jitter expansion based on brake pressure, target pace, and high-air pressure. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-brake-contact-jitter-05`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `339.7` -> candidate `346.9`; `Δheadline = +7.2`, 95% CI `[-11.3, 37.7]`, `P(Δ<=0)=30.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.1`, `50k=+3.9`, `100k=+8.2`, `150k=+9.8`, `200k=+6.5`. Validity improved at 50k-200k (`200k 231/240 -> 232/240`) and did not materially hurt 25k, but the paired bootstrap verdict was not accepted.
- Status: Reverted; not committed.

## arc-expanded-brake-jitter-06

- Baseline used: `arc-overspeed-brake-01` at commit `38060d9`.
- Hypothesis: Two brake-specific mechanisms were positive but inconclusive independently: high-overspeed brake offers improved validity and high-budget score, while brake-only contact jitter improved brake landing coverage. Combining them should let newly offered high-overspeed brake placements land often enough to improve speed quality more consistently, while still leaving normal candidate geometry unchanged.
- Code changes made: Combined the high-overspeed brake offer predicate with the brake-mode-only contact jitter expansion. Initially reverted after the old 5% decision gate reported inconclusive; reapplied after the user-requested 20% decision gate accepted the canonical archive.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-expanded-brake-jitter-06`
- Decide result: With the old 5% gate, `VERDICT: INCONCLUSIVE`; baseline `339.7` -> candidate `353.1`; `Δheadline = +13.4`, 95% CI `[-6.6, 43.7]`, `P(Δ<=0)=11.3%`. After the user-requested decision policy change to `α=0.20`, reran `npm run decide -- generated/golden-runs/arc-expanded-brake-jitter-06/golden.json generated/golden-runs/arc-overspeed-brake-01/golden.json`; result `VERDICT: ACCEPT` with the same paired headline delta and probability.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.7`, `50k=+22.9`, `100k=+15.3`, `150k=+14.5`, `200k=+11.0`. Validity improved at 50k-200k (`200k 231/240 -> 233/240`) while 25k validity moved `34% -> 33%`.
- Status: Kept and committed as the new baseline after the 20% decision-gate rerun.

## decide-alpha-20-policy

- Baseline used: `arc-overspeed-brake-01` at commit `38060d9`; policy applied to the canonical `arc-expanded-brake-jitter-06` archive above.
- Hypothesis: The existing paired bootstrap signal is useful, but the old 5% one-sided probability gate is too conservative for this design loop. A 20% gate should allow positive canonical improvements with `Δheadline > +5` to promote while still using paired 12-seed golden results and `npm run decide` as the signal.
- Code changes made: Changed `DECISION_ALPHA` in `scripts/v0/metric.ts` from `0.05` to `0.20`, exported it, and printed the active alpha in the `decide` CLI output. No scorer, golden spec, evaluator fingerprint, seed set, metric formula, or budget-grid changes.
- Golden command: No new golden run; reused canonical archive `generated/golden-runs/arc-expanded-brake-jitter-06/golden.json`.
- Decide result: `npm run decide -- generated/golden-runs/arc-expanded-brake-jitter-06/golden.json generated/golden-runs/arc-overspeed-brake-01/golden.json` printed `VERDICT: ACCEPT`; baseline `339.7` -> candidate `353.1`; `Δheadline = +13.4`, 95% CI `[-6.6, 43.7]`, `P(Δ<=0)=11.3%`, active `α=0.20`.
- Notable regressions/improvements: This policy change does not alter golden scores; it changes only the accept/reject probability threshold used by `decide`.
- Status: Kept and committed with the accepted `arc-expanded-brake-jitter-06` implementation.

## arc-speed-brake-breadth-07

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: A small detailed diagnostic run on hard speed rows (`diag-current-hardrows-01`) showed the remaining worst axes were dominated by speed overshoot, often `+0.7` to `+1.5` authored speed, with several contract misses following early acceleration. Letting severe overspeed receive more deterministic brake candidates should expose more speed-bleeding placements without changing the normal sample prefix.
- Code changes made: Replaced the fixed high-overspeed brake candidate count with a smooth overspeed-pressure count up to a small contract/quality cap. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-brake-breadth-07`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `353.1` -> candidate `352.5`; `Δheadline = -0.6`, 95% CI `[-10.0, 8.7]`, `P(Δ<=0)=54.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.4`, `50k=-35.2`, `100k=+3.3`, `150k=+3.5`, `200k=+3.0`. The extra brake breadth helped high budgets slightly but starved/perturbed the 50k pass/quality transition (`50k` validity `94% -> 91%`), so the weighted headline did not improve.
- Status: Reverted; not committed.

## arc-speed-overshoot-rank-08

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: Since extra brake samples were too expensive at 50k, improve speed control per existing sample by making the continuous handoff speed-overshoot ranking penalty stronger. This should prefer already-viable slower catches without changing sample counts, generation order, or budget behavior.
- Code changes made: Increased `HANDOFF_AXIS_OVERSHOOT_WEIGHTS.speed` from `5.76` to `8`. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-overshoot-rank-08`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `353.1` -> candidate `352.0`; `Δheadline = -1.1`, 95% CI `[-7.6, 4.5]`, `P(Δ<=0)=63.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.1`, `50k=-14.2`, `100k=+1.0`, `150k=+0.1`, `200k=+0.2`. The stronger overshoot ranking was mostly neutral at high budgets but regressed the 50k transition (`50k` validity `94% -> 93%`).
- Status: Reverted; not committed.

## arc-brake-attempt-spread-09

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: The brake-breadth attempt helped high budgets but paid too much work at 50k, suggesting later brake sample attempts contain useful geometry. Remapping severe-overspeed brake attempts to a wider deterministic low-discrepancy stride should expose some of that geometry without changing brake sample counts or normal samples.
- Code changes made: For brake candidates only, remapped the attempt index by a smooth severe-overspeed pressure before sampling placement geometry. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-brake-attempt-spread-09`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `353.1` -> candidate `351.5`; `Δheadline = -1.6`, 95% CI `[-10.6, 10.6]`, `P(Δ<=0)=67.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.1`, `50k=-22.5`, `100k=+8.2`, `150k=-6.2`, `200k=+2.0`. The 100k/200k movement confirmed useful brake geometry exists later in the sequence, but the 50k and 150k regressions made the change non-promotable.
- Status: Reverted; not committed.

## arc-tail-completion-window-10

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: The accepted baseline's 50k failures often had zero full evaluations and large frontier lag, while tail-depth diagnostics showed the existing 7-8-contact completions were higher-yield than shallower completions. Letting the same deterministic tail completer start one contact earlier should create terminal feedback sooner without changing scorer, specs, seeds, or candidate geometry.
- Code changes made: Increased `TAIL_COMPLETION_CONTACT_WINDOW` from `8` to `9`. Reverted after decision because it missed the explicit `+5` promotion bar.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-tail-completion-window-10`
- Decide result: `VERDICT: ACCEPT`; baseline `353.1` -> candidate `355.1`; `Δheadline = +2.0`, 95% CI `[0.4, 5.4]`, `P(Δ<=0)=0.7%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.7`, `50k=+7.0`, `100k=+1.4`, `150k=+1.6`, `200k=+1.7`; validity improved at 25k (`33% -> 34%`) and held elsewhere. The result was directionally good and accepted by `decide`, but below the required `+5` canonical delta for promotion.
- Status: Reverted; not committed.

## arc-tail-completion-window-11

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: Since the 9-contact tail window was accepted but too small to promote, a 10-contact window might cross the `+5` bar by producing even earlier terminal feedback for low-budget rows.
- Code changes made: Increased `TAIL_COMPLETION_CONTACT_WINDOW` from `8` to `10`. Reverted after decision because it missed the explicit `+5` promotion bar.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-tail-completion-window-11`
- Decide result: `VERDICT: ACCEPT`; baseline `353.1` -> candidate `355.3`; `Δheadline = +2.2`, 95% CI `[-1.1, 4.4]`, `P(Δ<=0)=6.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+3.0`, `50k=-5.4`, `100k=+3.2`, `150k=+3.0`, `200k=+2.8`. The larger window improved 25k and high-budget quality more than the 9-contact version, but started hurting 50k validity/score (`50k` validity `94% -> 93%`), keeping the headline gain below the promotion threshold.
- Status: Reverted; not committed.

## arc-greedy-early-tail-12

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: A 10-contact tail window helped 25k/high budgets but hurt 50k, likely from the two-wide suffix branching at the extra outer depths. Keeping the added 9-10 contact region greedy while preserving the original two-wide branching for the inner 8 contacts should create some earlier terminal feedback with less 50k work pressure.
- Code changes made: Set `TAIL_COMPLETION_CONTACT_WINDOW` to `10`, added an inner full-branch window of `8`, and used one branch for the added outer tail depths. Reverted after decision because it missed the explicit `+5` promotion bar.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-greedy-early-tail-12`
- Decide result: `VERDICT: ACCEPT`; baseline `353.1` -> candidate `354.8`; `Δheadline = +1.7`, 95% CI `[-1.5, 3.9]`, `P(Δ<=0)=8.9%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+1.3`, `50k=-6.8`, `100k=+2.8`, `150k=+2.7`, `200k=+2.7`. Greedy outer completion reduced but did not remove the 50k regression, and total headline gain remained subthreshold.
- Status: Reverted; not committed.

## arc-deep-brake-shape-13

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: The remaining hard detailed rows were speed-overshoot dominated, and attempts that added more brake samples helped high budgets but cost too much. Adding a smooth severe-overspeed pressure inside brake-mode placement should make existing brake samples bleed speed more effectively without changing sample counts.
- Code changes made: Added `deepBrakePressure` for brake-mode severe overspeed, steepened/shortened post-contact geometry under that pressure, and lowered the brake post-length floor. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-deep-brake-shape-13`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `353.1` -> candidate `352.4`; `Δheadline = -0.7`, 95% CI `[-10.5, 11.2]`, `P(Δ<=0)=57.7%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.6`, `50k=-31.5`, `100k=+8.0`, `150k=+1.5`, `200k=+0.9`. Like the other speed-heavy changes, it found useful 100k geometry but damaged the 50k transition (`50k` validity `94% -> 92%`).
- Status: Reverted; not committed.

## arc-enable-polish-14

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: The existing clone-and-test polish path directly refines placed geometry but is default-off. Enabling it by default might improve terminal leaf quality under the same deterministic budget policy.
- Code changes made: Changed the handoff optimizer polish default from `opts.polish ?? false` to `opts.polish ?? true`. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-enable-polish-14`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `353.1` -> candidate `353.1`; `Δheadline = +0.0`, 95% CI `[0.0, 0.0]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: Budget curves and validity were identical to the baseline at every canonical budget, so the polish path produced no canonical effect in this configuration.
- Status: Reverted; not committed.

## arc-startup-rescue-15

- Baseline used: `arc-expanded-brake-jitter-06` at commit `e50393d`.
- Hypothesis: Several high-budget contract failures were first-contact skips after true dead-end rescue, while one deep row had no full terminal output before budget. Increase rescue effort only at required-contact dead ends, with a smooth startup pressure that gives early contacts more deterministic samples and decays back to the existing 32-sample rescue later, so ordinary successful nodes keep their normal sample path.
- Code changes made: Replaced the fixed dead-end rescue count with `deadEndRescueCandidateCount(gap) = 32 + round(48 * startupPressure)` and a matching smoothly expanded rescue pool, where `startupPressure = 1 / (1 + (gap.endFrame / (FPS * 1.1))^2)`. Short-deadline rescue and ordinary candidate sampling were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-startup-rescue-15`
- Decide result: `VERDICT: ACCEPT`; baseline `353.1` -> candidate `364.4`; `Δheadline = +11.3`, 95% CI `[-0.2, 38.0]`, `P(Δ<=0)=3.4%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.2`, `50k=+1.4`, `100k=+5.9`, `150k=+14.9`, `200k=+15.1`. Validity improved from `233/240 -> 237/240` at 200k and `225/240 -> 227/240` at 50k. Largest 200k validity flips were `drums_pendulum` seed 7, `drums_dropout` seed 6, and `drums_crosscut` seeds 0 and 9 becoming pass. Main regressions included `drums_dropout` seeds 3 and 4 quality drops at high budgets and `verse_chorus` seed 0 regressing at 50k, but these did not overcome the accepted paired headline gain.
- Status: Kept and committed as the new baseline for the next mechanism.
