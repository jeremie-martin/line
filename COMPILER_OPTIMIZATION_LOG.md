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

## arc-startup-rescue-breadth-16

- Baseline used: `arc-startup-rescue-15` at commit `59197f9`.
- Hypothesis: The remaining 200k failures were still early-contact skips after the accepted startup rescue. Increasing the same smooth startup rescue boost might find the next viable first-contact basin while preserving the successful late-gap behavior.
- Code changes made: Increased `HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND` from `48` to `96` and `HANDOFF_RESCUE_STARTUP_EXTRA_POOL` from `4` to `8`. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-startup-rescue-breadth-16`
- Decide result: `VERDICT: REJECT`; baseline `364.4` -> candidate `362.3`; `Δheadline = -2.1`, 95% CI `[-5.9, 0.6]`, `P(Δ<=0)=91.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.6`, `50k=-16.2`, `100k=-0.5`, `150k=-0.9`, `200k=-0.6`. The broader rescue gained a few extra 25k passes but damaged the 50k transition, including large regressions on `rhythm_ladder` seed 10 and `syncopated_switchback` seed 1; it did not fix the remaining `opening_burst` seed 10 or `drums_crosscut` seeds 7 and 10 failures at 200k.
- Status: Reverted; not committed.

## arc-start-lookahead-breadth-17

- Baseline used: `arc-startup-rescue-15` at commit `59197f9`.
- Hypothesis: Remaining early-contact failures might come from start-basin ordering where a useful first-contact continuation is hidden behind only the first few scored first-contact branches. Scoring five first-contact branches during start feasibility, without changing main search candidate generation, might pick more robust starts.
- Code changes made: Increased `START_FIRST_OPTIONS` from `3` to `5`. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-start-lookahead-breadth-17`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `364.4` -> candidate `363.3`; `Δheadline = -1.1`, 95% CI `[-6.3, 3.2]`, `P(Δ<=0)=68.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-1.6`, `50k=-13.7`, `100k=+1.6`, `150k=-0.1`, `200k=+0.1`. It did not change the three remaining 200k failures and cost too much low-budget validity (`25k 33% -> 29%`, `50k 95% -> 94%`) to promote.
- Status: Reverted; not committed.

## arc-speed-quality-stream-18

- Baseline used: `arc-startup-rescue-15` at commit `59197f9`.
- Hypothesis: With most contract failures fixed, high-weight score is limited by speed-axis overshoot on otherwise valid rows. A single quality-phase brake-mode stream on overspeed gaps should provide speed-bleeding alternatives without changing the pre-validity contract race.
- Code changes made: Added one `speed` axis-quality stream using `mode: "brake"` and attempt offset `3000`, gated to gaps where the rider was above the authored speed target. Reverted after decision because the accepted delta was below the promotion threshold.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-quality-stream-18`
- Decide result: `VERDICT: ACCEPT`; baseline `364.4` -> candidate `364.7`; `Δheadline = +0.3`, 95% CI `[-0.4, 1.2]`, `P(Δ<=0)=16.4%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.4`, `100k=+0.8`, `150k=+0.4`, `200k=+0.1`, with validity unchanged. The stream is directionally positive but far below the required `+5` canonical delta.
- Status: Reverted; not committed.

## arc-startup-landing-jitter-19

- Baseline used: `arc-startup-rescue-15` at commit `59197f9`.
- Hypothesis: Remaining early-contact misses had high normal-sample preclear and landing failures. Adding a small smooth startup-only contact-point jitter for normal samples, gated by target pace and high-air pressure, might widen the first-contact landing basin without extra sample cost.
- Code changes made: Added `startupPlacementPressure(gap.startFrame) * targetPace * highAir` into normal-mode contact jitter with a `0.65` scale. Reverted after decision.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-startup-landing-jitter-19`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `364.4` -> candidate `358.1`; `Δheadline = -6.3`, 95% CI `[-40.4, 14.7]`, `P(Δ<=0)=63.9%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.4`, `50k=-13.8`, `100k=+1.6`, `150k=-7.9`, `200k=-7.9`. It perturbed normal geometry too broadly, creating new high-budget failures including `drums_pendulum` seed 7 and `drums_crosscut` seed 0, and reducing 200k validity from `237/240` to `236/240`.
- Status: Reverted; not committed.

## arc-smooth-farback-quality-20

- Baseline used: `arc-startup-rescue-15` at commit `59197f9`.
- Hypothesis: Additional budget was not converting in moderate-quality passing rows because far-back repair shut off above `axis_quality=0.28`; using a smooth interval through moderate quality should keep deterministic repair pressure alive without changing candidate geometry or contract search.
- Code changes made: Replaced hard `0.24/0.28` far-back pulse thresholds with a smooth interval from 96 frames/selections at `axis_quality=0.36` down to 16 at `axis_quality=0.18`; left suffix repair cutoff at `0.24`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-smooth-farback-quality-20`
- Decide result: `VERDICT: ACCEPT`; baseline `364.4` -> candidate `372.8`; `Δheadline = +8.4`, 95% CI `[3.5, 14.3]`, `P(Δ<=0)=0.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.4`, `100k=+4.0`, `150k=+10.2`, `200k=+12.2`; validity was unchanged at every budget. Largest 200k gains were `drums_crescendo` seed 3, `drums_swell` seed 0, `drums_dropout` seeds 3 and 2, and `drums_zigzag` seed 1. Main 200k regressions were `drums_pendulum` seeds 6, 1, and 5 plus `opening_burst` seed 2, but the canonical paired result cleared the promotion bar.
- Status: Kept and committed as the new baseline.

## arc-farback-moderate-quality-21

- Baseline used: `arc-smooth-farback-quality-20` at commit `4a7de31`.
- Hypothesis: The new baseline still had most valid rows in the `axis_quality=0.36..0.50` band, but far-back repair tapered to zero at `0.36`. Extending the taper into moderate quality, while making the rare end of the interval less frequent, should keep older deterministic pass-frontier branches alive at high budgets without changing candidate geometry or contract search.
- Code changes made: Increased `QUALITY_FAR_BACK_ZERO_AXIS_QUALITY` from `0.36` to `0.50` and increased `QUALITY_FAR_BACK_MAX_INTERVAL` from `96` to `128`, preserving the existing smooth interval down to 16 at `axis_quality=0.18`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-farback-moderate-quality-21`
- Decide result: `VERDICT: ACCEPT`; baseline `372.8` -> candidate `390.5`; `Δheadline = +17.8`, 95% CI `[10.1, 26.9]`, `P(Δ<=0)=0.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.7`, `100k=+11.6`, `150k=+20.4`, `200k=+25.4`; validity was unchanged at every budget. Largest 200k gains were `mini_burst` seed 6, `verse_chorus` seed 2, `mini_burst` seed 9, `verse_chorus` seed 8, and `drums_breath` seed 3. Main 200k regressions were `drums_crescendo` seed 3, `drums_pendulum` seed 8, `mini_burst` seed 4, and `drums_crescendo` seeds 8 and 4. The remaining 200k failures stayed `opening_burst` seed 10 and `drums_crosscut` seeds 7 and 10.
- Status: Kept and committed as the new baseline.

## arc-farback-wide-quality-22

- Baseline used: `arc-farback-moderate-quality-21` at commit `c455b89`.
- Hypothesis: After attempt 21, a smaller set of rows had moved into `axis_quality=0.50..0.65`. Extending the far-back taper from `0.50` to `0.58` with a rarer max interval might keep converting high-budget quality while preserving the accepted cadence around the median row.
- Code changes made: Temporarily increased `QUALITY_FAR_BACK_ZERO_AXIS_QUALITY` from `0.50` to `0.58` and `QUALITY_FAR_BACK_MAX_INTERVAL` from `128` to `160`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-farback-wide-quality-22`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `390.5` -> candidate `390.6`; `Δheadline = +0.1`, 95% CI `[-1.3, 2.1]`, `P(Δ<=0)=50.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.1`, `100k=+0.2`, `150k=+0.5`, `200k=-0.3`; validity was unchanged. The wider taper mostly traded rows, with large 200k gains on `drums_breath` seed 11 and `solo_run` seeds 3/4/7/11 but offsetting regressions on `drums_crescendo` seed 0, `mini_burst` seed 2, `drums_pulse` seed 1, `opening_burst` seed 3, and `drums_swell` seed 5.
- Status: Reverted; not committed.

## arc-speed-quality-pressure-23

- Baseline used: `arc-farback-moderate-quality-21` at commit `c455b89`.
- Hypothesis: Low valid rows were still dominated by speed overshoot, while the existing axis-quality stream only covered low-air support. Adding a quality-phase-only speed stream with a smooth overspeed-pressure sample count should improve speed-limited rows without perturbing the pre-validity contract race.
- Code changes made: Added a `speed` axis-quality stream using brake-mode samples at attempt offset `3000`, capped at two samples and scaled by `smoothstep(normalizedOverspeed / 0.45)`. Added local `smoothstep` and integer-clamp helpers; contract-phase sampling and normal candidate geometry were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-quality-pressure-23`
- Decide result: `VERDICT: ACCEPT`; baseline `390.5` -> candidate `395.7`; `Δheadline = +5.1`, 95% CI `[1.0, 9.6]`, `P(Δ<=0)=0.7%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.9`, `100k=+3.9`, `150k=+5.3`, `200k=+7.4`; validity was unchanged. At 200k the speed stream produced `37796/75813` viable candidates and the selected best prefixes used `625` speed axis-quality candidates. Largest 200k gains were `syncopated_switchback` seed 11, `drums_crescendo` seed 8, `drums_breath` seed 11, `syncopated_switchback` seed 2, and `drums_breath` seed 0. Main 200k regressions were `drums_crescendo` seed 0, `drums_tide` seed 2, `syncopated_switchback` seed 10, `rhythm_ladder` seed 9, and `drums_dropout` seed 2.
- Status: Kept and committed as the new baseline.

## arc-speed-quality-depth-24

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: The accepted speed stream was selected often and many low rows remained speed-limited, so a third brake-mode speed sample under stronger overspeed pressure might add useful diversity without broadening mild-overspeed work.
- Code changes made: Temporarily changed the speed axis-quality stream cap from `2` to `3` and widened the overspeed scale from `0.45` to `0.60`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-quality-depth-24`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `395.9`; `Δheadline = +0.2`, 95% CI `[-1.7, 2.2]`, `P(Δ<=0)=41.9%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.1`, `100k=+1.5`, `150k=+0.6`, `200k=-0.7`; validity was unchanged. The extra depth increased 200k speed-stream work to `42258/92902` viable candidates and selected `684` speed axis-quality candidates, but mostly traded rows. Largest 200k gains were `drums_tide` seed 2, `drums_zigzag` seed 5, `drums_crescendo` seed 1, and `drums_signature` seeds 11 and 3; largest regressions were `drums_pendulum` seed 0, `verse_chorus` seed 3, `drums_crescendo` seed 8, `drums_breath` seed 11, and `drums_dropout` seed 5.
- Status: Reverted; not committed.

## arc-quality-speed-rank-25

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: The accepted speed stream exposed useful speed-bleeding candidates, but low rows remained speed-overshoot dominated. Increasing only the quality-phase speed overshoot ranking pressure should pick better speed tradeoffs without changing the pre-validity contract race.
- Code changes made: Temporarily added a `1.5` multiplier to the speed overshoot penalty only for quality-phase `rankedOptions` calls, including tail and suffix completion. Contract-phase ranking kept the existing weight.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-quality-speed-rank-25`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `395.3`; `Δheadline = -0.4`, 95% CI `[-3.2, 2.0]`, `P(Δ<=0)=60.8%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=+0.2`, `100k=+0.3`, `150k=-0.2`, `200k=-1.1`; validity was unchanged. The multiplier caused broad row churn and hurt high budgets, with 200k regressions including `syncopated_switchback` seed 11, `drums_tide` seed 2, `drums_crosscut` seed 1, `verse_chorus` seed 8, and `drums_zigzag` seed 10; notable gains included `verse_chorus` seed 1, `drums_crosscut` seed 0, `drums_crescendo` seed 3, and `rhythm_ladder` seed 8.
- Status: Reverted; not committed.

## arc-air-support-geometry-26

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: The existing `air_support` stream had a distinct sample mode but no distinct placement controls, so it was mostly just another low-air normal sample. Strengthening low-air geometry only for that quality-phase stream might reduce large air overshoots without changing contract search.
- Code changes made: Temporarily added `airSupportPressure` in `targetStateControls` for `mode === "air_support"`, flattening contact/post angles and extending low-air pre/post/ground targets for those candidates only.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-air-support-geometry-26`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `395.2`; `Δheadline = -0.5`, 95% CI `[-2.3, 0.9]`, `P(Δ<=0)=73.3%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.1`, `100k=-0.2`, `150k=-0.9`, `200k=-0.4`; validity was unchanged. The air stream viability rose at 200k from roughly `1550/5454` to `2430/6021` and selected air candidates from `3` to `12`, but the row tradeoff was negative. Largest 200k gains included `drums_crescendo` seed 9, `drums_dropout` seed 2, `drums_crescendo` seed 1, `cold_start` seed 1, and `syncopated_switchback` seed 6; largest regressions included `drums_crescendo` seeds 8 and 11, `drums_dropout` seed 5, and `drums_pendulum` seeds 0 and 3.
- Status: Reverted; not committed.

## arc-tail-window-9-after-speed-27

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: After the accepted speed-support stream, a slightly earlier speculative tail completion might create cheaper terminal feedback from deep prefixes without changing candidate geometry.
- Code changes made: Temporarily increased `TAIL_COMPLETION_CONTACT_WINDOW` from `8` to `9`.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-tail-window-9-after-speed-27`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `396.5`; `Δheadline = +0.8`, 95% CI `[-1.5, 4.3]`, `P(Δ<=0)=23.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.7`, `50k=+7.2`, `100k=+0.2`, `150k=+0.5`, `200k=-0.2`; validity changed only at 25k from `33%` to `34%`. The new remaining-depth-9 tail work produced `404/647/1257` best/success/attempted counts but did not convert at high budget. Largest 200k gains included `drums_crescendo` seed 1, `dense_sprint` seed 7, `drums_crescendo` seed 3, `opening_burst` seed 9, and `drums_dropout` seed 3; largest regressions included `verse_chorus` seed 3, `drums_crescendo` seed 8, `syncopated_switchback` seed 2, `drums_dropout` seed 8, and `cold_start` seed 0.
- Status: Reverted; not committed.

## arc-axis-debt-quality-28

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: The current handoff ranker scores each gap locally even though speed/air state bias carries forward. After a passing output exists, tracking a decayed signed residual from committed dynamic axes and nudging quality-phase ranking against that debt might steer future catches toward better global axis quality without changing candidate geometry or contract search.
- Code changes made: Temporarily added a quality-phase-only `axisDebtSearch` ranking adjustment. It tracked decayed signed `air` and `speed` residuals from `prefixFits`, then scored each candidate as if its local dynamic-axis target were shifted against the prefix debt. Main, rescue, tail, and bounded-suffix quality paths used the same deterministic debt signal; contract-phase search and candidate generation were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-axis-debt-quality-28`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `394.8`; `Δheadline = -0.9`, 95% CI `[-4.1, 2.6]`, `P(Δ<=0)=71.5%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=+0.5`, `100k=-0.4`, `150k=-1.3`, `200k=-1.3`; validity was unchanged at every budget. The change created broad valid-row churn rather than a stable quality lift: largest 200k gains included `dense_sprint` seed 11, `drums_pendulum` seed 4, `drums_breath` seed 1, `drums_tide` seed 2, and `rhythm_ladder` seed 10; largest 200k regressions included `drums_crescendo` seed 3, `verse_chorus` seed 2, `drums_zigzag` seed 0, `drums_breath` seed 0, and `drums_crosscut` seed 1. Extra work was roughly neutral at 200k (`sim +90`, `candidates +101`, `viable -14` on common rows), so the failure was ranking quality, not wall-clock starvation.
- Status: Reverted; not committed.

## arc-quality-source-diversity-29

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: The quality ranker collapses pool, reuse, brake, and axis-quality candidates into one scalar list before the frontier sees them. Preserving one branch slot for a not-yet-represented source/axis group after the top scalar choices might improve alternative survival without changing candidate geometry, sample counts, scorer, or contract-phase routing.
- Code changes made: Temporarily added quality-phase-only source-diverse branch selection in `rankedOptions`: keep the top two scalar-ranked options, then use the third branch for the best candidate from a source/axis group not already represented when available. Main, rescue, tail, and bounded-suffix quality paths enabled the selector; contract-phase search was unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-quality-source-diversity-29`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `396.4`; `Δheadline = +0.7`, 95% CI `[-2.0, 3.5]`, `P(Δ<=0)=30.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.2`, `100k=+0.9`, `150k=+1.1`, `200k=+0.5`; validity was unchanged at every budget. Source diversity increased 200k selected axis-quality candidates (`594` -> `688`) and full terminal feedback (`95577` -> `97921`) with a small positive curve, but still mostly traded valid rows. Largest 200k gains included `syncopated_switchback` seed 0, `drums_tide` seed 9, `mini_burst` seed 1, `drums_crescendo` seed 1, and `drums_dropout` seed 2; largest regressions included `syncopated_switchback` seed 11, `drums_dropout` seed 5, `opening_burst` seed 3, `drums_pendulum` seed 0, and `drums_zigzag` seed 10.
- Status: Reverted; not committed.

## arc-report-guided-repair-30

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: Generic far-back pulses are blind to the current best report. When a full passing output improves the register, the compiler can identify the weakest per-gap axis error, rebuild the prefix before that gap, and enqueue that prefix into quality search. This should target actual bad spans with quality streams instead of waiting for undirected frontier scheduling.
- Code changes made: Temporarily threaded the full report through `consider()`, added a de-duplicated `(searchSeed,startRank,gapIndex)` report-repair queue for improved full passing outputs, rebuilt replay prefixes before the weakest reported axis gap, and added temporary compact compile-stat counters for repair enqueues/duplicates. Candidate geometry, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-report-guided-repair-30`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `395.6`; `Δheadline = -0.1`, 95% CI `[-2.6, 2.6]`, `P(Δ<=0)=52.8%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=-1.6`, `100k=+2.3`, `150k=+0.0`, `200k=-0.9`; validity was unchanged at every budget. The mechanism was active (`527` repair enqueues and `988` duplicates at 200k), but it consumed terminal-feedback budget: 200k full offers dropped from roughly `95577` to `81552`, and unique full offers dropped from roughly `58725` to `50235`. Largest 200k gains included `verse_chorus` seed 10, `drums_pendulum` seed 4, `drums_dropout` seed 11, `rhythm_ladder` seed 6, and `dense_sprint` seed 10; largest 200k regressions included `drums_crescendo` seed 3, `verse_chorus` seed 3, `drums_dropout` seed 5, `syncopated_switchback` seed 2, and `grain_staircase` seed 4.
- Status: Reverted; not committed.

## arc-tail-duplicate-avoidance-31

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: Near-tail speculative completion was spending heavily on `remaining=1` and `remaining=2`, where normal DFS is close to a terminal leaf and improvement yield is low. Suppressing those duplicate-prone completions while preserving the wider tail window should free terminal-feedback budget for ordinary quality exploration.
- Code changes made: Temporarily added `TAIL_COMPLETION_MIN_CONTACTS = 3` and changed `shouldAttemptNearTailCompletion()` to run only when remaining required contacts were in `[3, 8]`. Candidate geometry, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-tail-duplicate-avoidance-31`
- Decide result: `VERDICT: ACCEPT`, but below the promotion bar; baseline `395.7` -> candidate `395.9`; `Δheadline = +0.2`, 95% CI `[-0.0, 0.7]`, `P(Δ<=0)=3.7%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.0`, `100k=+0.0`, `150k=+0.0`, `200k=+0.5`; validity was unchanged at every budget. The mechanism did reduce duplicate-prone terminal work: 200k tail attempts dropped from `45395` to `11948`, tail successes from `37792` to `8559`, and full duplicate offers from roughly `36852` to `8254`, while unique full offers were roughly flat-to-up (`58725` -> `60530`). Largest 200k gains included `drums_crescendo` seed 1, `dense_sprint` seed 7, `syncopated_switchback` seed 6, `dense_sprint` seed 4, and `drums_pulse` seed 7; the main 200k regressions were `drums_crescendo` seed 8 and a tiny drop on `drums_breath` seed 6.
- Status: Reverted because the explicit promotion rule requires both `VERDICT: ACCEPT` and canonical `Δheadline > +5`; not committed.

## arc-alt-search-lane-32

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: The current quality search sees only one deterministic candidate-sampling lane per `(spec, seed)`. After a weak passing output exists, enqueueing one alternate search lane with a mixed `searchSeed` should expose genuinely different candidate sequences while keeping the authored target jitter and contract race unchanged.
- Code changes made: Temporarily added one alternate root lane after the first improved full passing output whose quality was weak enough to activate the existing far-back scheduler. The alternate lane reused the same start options but used `alternateQualitySearchSeed(searchSeed)`, with no changes to candidate geometry, scoring, specs, seed set, metric, or budget grid.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-alt-search-lane-32`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `395.5`; `Δheadline = -0.2`, 95% CI `[-2.4, 1.5]`, `P(Δ<=0)=54.4%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.5`, `100k=-0.1`, `150k=-0.0`, `200k=-0.6`; validity was unchanged at every budget. The alternate lane affected returned tracks (`18/240` rows selected a non-public search seed at 200k), but the row tradeoff was negative. Largest 200k gains included `tiny_dance` seed 9, `drums_tide` seed 11, `tiny_dance` seed 4, `tiny_dance` seed 10, and `drums_signature` seed 11; largest regressions included `drums_crosscut` seeds 0, 9, and 6, `dense_sprint` seed 4, and `tiny_dance` seed 1.
- Status: Reverted; not committed.

## arc-tail-high-yield-depths-33

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: Tail diagnostics showed `remaining=1..6` speculative completions were mostly duplicate-prone or low-yield, while `remaining=7..8` had much higher best/success rates. Keeping only the deeper tail completions might preserve the useful terminal-feedback channel while avoiding shallow duplicate work.
- Code changes made: Temporarily added `TAIL_COMPLETION_MIN_CONTACTS = 7` and changed `shouldAttemptNearTailCompletion()` to run only when remaining required contacts were in `[7, 8]`. Candidate geometry, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-tail-high-yield-depths-33`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `395.7`; `Δheadline = +0.0`, 95% CI `[-1.3, 0.9]`, `P(Δ<=0)=43.2%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.3`, `50k=-1.0`, `100k=+0.0`, `150k=-0.0`, `200k=+0.4`. Low-budget validity regressed (`25k 33% -> 31%`) and 50k quality also moved negative, even though the 200k row tradeoff was slightly positive. This confirms that tail duplicate avoidance is real but too small and too budget-shape-sensitive to serve as the next structural mechanism.
- Status: Reverted; not committed.

## arc-improvement-gated-polish-34

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: High-budget rows are mostly valid but speed/air axis quality is still poor, and the compiler already has a geometry polish subsystem that can clone a terminal leaf, mutate local arc geometry, and submit the result through the same best-so-far register. Enabling polish only for terminal leaves that just improved the register should create a structural full-track refinement channel without spending budget on non-improving terminal churn.
- Code changes made: Temporarily changed the default `polish` option from disabled to enabled and gated polish attempts on `main` terminal improvements (`mainResult.event.improved === true`), leaving explicit `opts.polish=false` available. Candidate geometry, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-improvement-gated-polish-34`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `395.7` -> candidate `395.7`; `Δheadline = +0.0`, 95% CI `[0.0, 0.0]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: No score, validity, or row changes occurred. The mechanism was active enough to try `1522` polish variants across the canonical run (`548` at 200k), but `polish_variants_changed=0` and there were no polish evaluations or adoptions. The existing polish helpers do not mutate the current canonical handoff line geometry, so enabling them is structurally inert.
- Status: Reverted; not committed.

## arc-speed-drag-stream-35

- Baseline used: `arc-speed-quality-pressure-23` at commit `8459665`.
- Hypothesis: The current baseline's high-budget valid rows remain dominated by speed error, and the accepted brake stream still uses the same general catch family. Adding a distinct quality-only `speed_drag` placement mode should generate longer, steeper uphill post-contact segments under smooth overspeed pressure, giving the search a real release-speed control mechanism instead of only re-ranking or deepening existing brake samples.
- Code changes made: Added `speed_drag` to candidate sample modes, added speed-drag target-state line controls in `arc_placement.ts`, changed axis-quality stream registration to allow multiple policies per axis, and registered a second speed quality stream using `mode: "speed_drag"`. Normal, brake, and air-support streams remain available; scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-drag-stream-35`
- Decide result: `VERDICT: ACCEPT`; baseline `395.7` -> candidate `401.1`; `Δheadline = +5.5`, 95% CI `[1.1, 9.7]`, `P(Δ<=0)=0.8%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+1.6`, `100k=+6.4`, `150k=+6.8`, `200k=+5.6`; validity was unchanged at every budget. At 200k the new stream added `15671/36411` landed speed-drag samples, speed axis-quality attempts rose from `75813/37796` successful to `109078/52286`, and selected axis-quality candidates rose from `628` to `1023`. Aggregate 200k signed speed error improved (`MAE 0.2590 -> 0.2523`, signed `+0.1928 -> +0.1866`) with tiny air improvement and slight grain MAE regression. Largest 200k gains included `dense_sprint` seed 6, `verse_chorus` seed 8, `drums_crescendo` seed 4, `cold_start` seed 1, and `drums_zigzag` seed 7; largest regressions included `syncopated_switchback` seeds 11 and 2, `drums_crescendo` seed 3, `verse_chorus` seeds 1 and 2, and `dense_sprint` seed 4.
- Status: Kept and committed as the new baseline.

## arc-release-speed-setup-36

- Baseline used: `arc-speed-drag-stream-35` at commit `700e5f0`.
- Hypothesis: Speed is still the dominant high-budget residual, and a contact's most important speed effect often lands in the following gap. Carrying each candidate's release speed and adding a quality-phase-only penalty against the next contact gap's speed target should pick placements that set up the next span, rather than only optimizing the current beat.
- Code changes made: Added optional `releaseSpeed` metadata to `GapFit`, populated it during candidate validation from the existing release-state probe, preserved it through clone paths, and added a quality-search-only release setup penalty in `rankedOptions` using the existing `releaseSpeedPenalty()` against the next contact gap's speed target. Contract-phase search, candidate geometry, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-release-speed-setup-36`
- Decide result: `VERDICT: ACCEPT`; baseline `401.1` -> candidate `406.8`; `Δheadline = +5.6`, 95% CI `[1.8, 10.1]`, `P(Δ<=0)=0.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.9`, `100k=+4.8`, `150k=+7.0`, `200k=+6.9`; validity was unchanged at every budget. At 200k unique full evaluations rose from `60165` to `61063`, selected axis-quality candidates rose from `1023` to `1067`, and aggregate speed error improved again (`MAE 0.2523 -> 0.2439`, signed `+0.1866 -> +0.1783`) with small air/grain tradeoffs. Largest 200k gains included `drums_crescendo` seed 3, `drums_crescendo` seed 11, `drums_dropout` seed 9, `verse_chorus` seed 6, and `drums_breath` seed 6; largest regressions included `dense_sprint` seeds 6 and 3, `drums_pendulum` seed 9, `drums_tide` seed 1, and `drums_crosscut` seed 1.
- Status: Kept and committed as the new baseline.

## arc-air-ground-support-37

- Baseline used: `arc-release-speed-setup-36` at commit `a9b6ea5`.
- Hypothesis: After the speed-focused improvements, low remaining pass rows still have large air residuals, especially low/moderate-air targets in `drums_pendulum`, `cold_start`, and related rows. Giving the existing `air_support` stream real low-air geometry should reduce airborne overshoot by generating longer, flatter post-contact ride-out candidates instead of merely offering another normal RNG lane.
- Code changes made: Temporarily added mode-specific air-support pressure in `targetStateControls`, reducing contact jitter and biasing low-air support candidates toward flatter contact/post angles, longer post-contact lines, higher post floors, and a stronger safe post cap. Widened the air-support quality stream target maximum from `0.25` to `0.45`. Contract-phase search, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-air-ground-support-37`
- Decide result: `VERDICT: ACCEPT`, but below the promotion bar; baseline `406.8` -> candidate `408.6`; `Δheadline = +1.8`, 95% CI `[-0.3, 4.7]`, `P(Δ<=0)=5.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.4`, `100k=+1.1`, `150k=+1.5`, `200k=+3.0`; validity was unchanged at every budget. The stream became active (`air` axis-quality attempts `5363/1562` -> `16408/4060`, selected air axis-quality candidates `2` -> `42`) and helped several rows, including `drums_pendulum` seed 4, `rhythm_ladder` seed 6, `verse_chorus` seed 11, and `dense_sprint` seed 1. Regressions included `dense_sprint` seed 2, `drums_pendulum` seed 3, and `drums_crescendo` seed 0. Directionally useful, but not large enough to promote under the explicit `Δheadline > +5` rule.
- Status: Reverted; not committed.

## arc-speed-push-stream-38

- Baseline used: `arc-release-speed-setup-36` at commit `a9b6ea5`.
- Hypothesis: The accepted speed-drag and release-setup changes address broad overspeed, but several of the remaining low rows still have large speed MAE with signed underspeed on many gaps. A complementary quality-only `speed_push` placement mode, gated by smooth underspeed pressure, should generate longer, more downhill post-contact candidates that recover speed where the new release setup otherwise over-brakes.
- Code changes made: Temporarily added `speed_push` to candidate sample modes, added target-state line controls for push-mode candidates, added speed-pressure direction support to axis-quality stream policies, and registered a third speed quality stream using `mode: "speed_push"` with underspeed gating. Contract-phase search, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-push-stream-38`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `406.8` -> candidate `407.0`; `Δheadline = +0.2`, 95% CI `[-0.8, 1.5]`, `P(Δ<=0)=37.4%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=-0.4`, `150k=-0.2`, `200k=+0.9`; validity was unchanged at every budget. The mode changed several `drums_pendulum` rows and produced no 200k regressions by the run summary, but the paired canonical effect was tiny and high-budget-only, so it did not meet either promotion gate.
- Status: Reverted; not committed.

## arc-next-speed-geometry-39

- Baseline used: `arc-release-speed-setup-36` at commit `a9b6ea5`.
- Hypothesis: Release-speed setup can only choose among candidates generated for the current gap target. A next-speed geometry stream should shape a current catch using the next contact gap's speed target while still scoring and gating against the current gap, exposing structural drag placements that set up the following span instead of merely re-ranking existing geometry.
- Code changes made: Added optional geometry-only targets to `sampleOneCandidate`, added `targetSource` to axis-quality stream policies, and registered a speed-drag quality stream whose geometry target comes from the next required contact gap. Contract-phase search, scorer, golden specs, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-next-speed-geometry-39`
- Decide result: `VERDICT: ACCEPT`; baseline `406.8` -> candidate `412.1`; `Δheadline = +5.3`, 95% CI `[1.3, 9.4]`, `P(Δ<=0)=0.4%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.6`, `100k=+0.4`, `150k=+6.5`, `200k=+8.7`; validity was unchanged at every budget. At 200k selected axis-quality candidates rose from `1067` to `1349` (`speed:1065 -> 1344`), speed-drag placements sampled rose from `35855` to `56247`, and speed error improved (`MAE 0.2439 -> 0.2348`, signed `+0.1783 -> +0.1698`) with small air/grain tradeoffs. Unique full evaluations were essentially flat (`61063 -> 61149`), so the lift came from better high-budget speed geometry rather than more terminal feedback. Largest 200k gains included `drums_dropout` seed 0, `mini_burst` seed 8, `dense_sprint` seed 1, `drums_crescendo` seed 10, and `drums_breath` seed 11; largest 200k regressions included `mini_burst` seeds 9 and 2, `verse_chorus` seed 3, `dense_sprint` seed 11, and `syncopated_switchback` seed 9. Remaining worst rows are unchanged validity failures on `opening_burst` seed 10 and `drums_crosscut` seeds 10 and 7, followed by low `drums_pendulum` pass rows; remaining worst axes are still speed-heavy, especially `drums_pendulum`, `syncopated_switchback`, and `dense_sprint`.
- Status: Kept and committed as the new baseline.

## arc-full-fail-geometry-repair-40

- Baseline used: `arc-next-speed-geometry-39` at commit `9bf1521`.
- Hypothesis: The remaining hard failures and low pass rows show that geometry-repair streams are useful, but they currently require an already-passing contract. After the search has produced any full-duration output, allow axis-quality and release-setup repair streams while keeping the contract-phase budget-aware breadth and preview behavior. This should help failing full tracks repair missing/drifted contacts without turning the pre-validity race into the broader post-pass quality scheduler.
- Code changes made: Temporarily added a `geometryRepairSearch` path in `expandNode` that enables axis-quality and release-setup scoring after the first full evaluation, while preserving contract candidate counts, future preview, and expanded-brake gating until a passing output exists. Scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-full-fail-geometry-repair-40`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `412.1` -> candidate `412.1`; `Δheadline = +0.0`, 95% CI `[-0.0, 0.0]`, `P(Δ<=0)=45.9%`.
- Notable regressions/improvements: Per-budget deltas were effectively flat (`25k=+0.0`, `50k=-0.0`, `100k=+0.0`, `150k=+0.0`, `200k=+0.0`); validity was unchanged at every budget. The mechanism did activate on the remaining failing rows (`opening_burst` seed 10 gained `+0.09`, `drums_crosscut` seed 7 gained `+0.09`, and failed rows reported contract-phase axis-quality attempts), but it did not convert any validity or meaningful quality. Aggregate 200k work and selected candidates were essentially unchanged.
- Status: Reverted; not committed.

## arc-start-release-setup-41

- Baseline used: `arc-next-speed-geometry-39` at commit `9bf1521`.
- Hypothesis: The accepted release-speed setup signal improves quality ranking after a pass exists, but start feasibility still orders root basins by first/second catch local costs without asking whether each catch leaves the rider at the right speed for the next span. Applying the same release-speed setup penalty inside start feasibility should promote starts whose early catch chain is speed-compatible before budget-limited exploration commits to a root basin.
- Code changes made: Temporarily added release-speed setup to `startCandidateCost` and passed the next contact gap's speed target for both the first scored start catch and the previewed second catch. Main search candidate generation, scorer, golden specs, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-start-release-setup-41`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `412.1` -> candidate `412.1`; `Δheadline = +0.1`, 95% CI `[-0.3, 0.5]`, `P(Δ<=0)=33.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.2`, `50k=+0.3`, `100k=+0.4`, `150k=-0.1`, `200k=-0.0`; 25k validity lost one row while 50k+ validity was unchanged. The mechanism only changed a few selected starts; the largest 200k gain was `drums_pulse` seed 5 (`+8.00`), but `grain_staircase` seed 9 regressed `-19.40`, and aggregate work/axis-quality usage stayed essentially flat. Root release setup is not a meaningful structural lever at current weight/order.
- Status: Reverted; not committed.

## arc-cadence-catch-family-42

- Baseline used: `arc-next-speed-geometry-39` at commit `9bf1521`.
- Hypothesis: Remaining hard failures are early-contact misses in tight/startup cadence, and the accepted speed gains came from adding physically distinct candidate futures rather than re-ranking. A contract-phase `cadence` candidate family should provide a short, forgiving approach and controlled post-contact support for startup/tight next-contact spacing, giving the engine a different first-contact future to validate before the search accepts skips.
- Code changes made: Temporarily added `cadence` as a candidate source and sample mode, added mode-specific target-state placement controls for forgiving contact and compact support, and added a cached contract-phase cadence stream gated by smooth startup/deadline/next-contact pressure. Added diagnostic counters and analyzer display for cadence attempts and selected candidates. Scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-cadence-catch-family-42`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `412.1` -> candidate `399.6`; `Δheadline = -12.5`, 95% CI `[-51.0, 10.6]`, `P(Δ<=0)=76.9%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.8`, `50k=-23.3`, `100k=-15.3`, `150k=-15.5`, `200k=-7.7`. Validity improved at 25k (`33% -> 34%`) but regressed at 50k (`95% -> 93%`) and stayed worse at high budgets (`150k 99% -> 98%`, `200k 99% -> 98%`). The cadence stream sampled 827 candidates at 200k with 276 direct landings, but only 10 selected candidates, so the inserted stream mostly displaced useful contract search without winning. It introduced a severe `drums_pendulum` seed 6 200k pass-to-fail (`365.47 -> 5.06`) and broad high-budget regressions (`drums_crescendo`, `dense_sprint`, `syncopated_switchback`, `verse_chorus`, `solo_run`) despite large gains on a few rows (`dense_sprint` seed 10, `drums_pendulum` seed 10, `rhythm_ladder` seed 6). The family was too broad and too early in contract search for the validation/ranking machinery to absorb safely.
- Status: Reverted; not committed.

## arc-startup-deadend-catch-43

- Baseline used: `arc-next-speed-geometry-39` at commit `9bf1521`.
- Hypothesis: The remaining invalid rows are not failing from lack of terminal feedback; their selected traces skip the first required contact (`opening_burst` seed 10 skips contacts 0, 1, and 4; `drums_crosscut` seeds 7 and 10 skip contact 0). The broad cadence-family attempt was too disruptive because it inserted an extra stream into working contract nodes. A narrower startup stream that runs only after ordinary contract/rescue batches find zero options should add missing first-contact landing futures without displacing already viable search.
- Code changes made: Added a named `startup_catch` placement mode and `startup` candidate source. The mode uses wider contact-point coverage, very short pre-contact geometry, and bounded post-contact support under smooth startup pressure. Added a dead-end-only startup rescue stream after the existing normal/brake/short-deadline rescue paths, with separate attempts/successes and selected-source diagnostics. Normal, brake, speed-drag, axis-quality, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-startup-deadend-catch-43`
- Decide result: `VERDICT: ACCEPT`; baseline `412.1` -> candidate `431.8`; `Δheadline = +19.8`, 95% CI `[3.9, 50.7]`, `P(Δ<=0)=0.2%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.9`, `50k=+16.7`, `100k=+22.6`, `150k=+22.8`, `200k=+19.2`; validity improved at every budget (`25k 33% -> 35%`, `50k 95% -> 97%`, `100k 98% -> 100%`, `150k 99% -> 100%`, `200k 99% -> 100%`). The three remaining 200k invalid rows flipped to valid: `opening_burst` seed 10 `16.41 -> 542.17`, `drums_crosscut` seed 7 `134.29 -> 509.96`, and `drums_crosscut` seed 10 `133.20 -> 506.52`. `opening_burst` and `drums_crosscut` are now 12/12 valid at 200k. At 200k the stream sampled `22904` `startup_catch` candidates, landed `1215`, and selected `96`; startup rescue work was concentrated in dead ends (`2433/10592` aggregate rescue successes/attempts). Main 200k regressions were valid-row quality trades, led by `drums_tide` seed 8 (`-63.68`), `drums_zigzag` seed 8 (`-54.31`), `dense_sprint` seed 1 (`-52.27`), `drums_zigzag` seed 10 (`-45.60`), and `drums_swell` seed 7 (`-40.83`). Unique full evaluations dropped (`61149 -> 56818`) because dead-end startup work consumed some budget, but the validity and first-contact gains dominated.
- Status: Kept and committed as the new baseline.

## arc-next-speed-settle-44

- Baseline used: `arc-startup-deadend-catch-43` at commit `7e8fc45`.
- Hypothesis: With high-budget validity now solved, remaining low rows are dominated by positive speed error (`200k` aggregate speed MAE `0.2280`, signed `+0.1622`; worst rows include `drums_pendulum`, `syncopated_switchback`, and `dense_sprint`). The accepted next-speed geometry stream shapes candidates to the next speed target, but may still miss slower, settling downstream states. A quality-only next-speed settle stream that shapes one extra `speed_drag` candidate below the next speed target should broaden release-speed coverage while engine validation and existing scoring reject over-braked candidates.
- Code changes made: Added an axis-quality policy target bias and registered one additional next-target `speed_drag` policy for `speed` with a below-target geometry bias. Contract search, normal sampling, startup rescue, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-next-speed-settle-44`
- Decide result: `VERDICT: ACCEPT`; baseline `431.8` -> candidate `441.4`; `Δheadline = +9.6`, 95% CI `[2.7, 16.6]`, `P(Δ<=0)=0.4%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+1.7`, `100k=+12.1`, `150k=+9.8`, `200k=+11.3`; validity was unchanged at every budget and remained `240/240` at 200k. The stream improved aggregate 200k speed error (`MAE 0.2280 -> 0.2169`, signed `+0.1622 -> +0.1481`) with small air/grain tradeoffs (`air MAE 0.1067 -> 0.1079`, grain MAE `0.0664 -> 0.0661`). At 200k `speed_drag` sampled `56543 -> 80324`, selected axis-quality candidates rose `1401 -> 1617` (`speed 1385 -> 1602`), and unique full evaluations stayed essentially flat (`56818 -> 56799`). Largest 200k gains included `syncopated_switchback` seed 11 (`+181.63`), `dense_sprint` seed 4 (`+108.98`), `drums_zigzag` seed 2 (`+104.44`), `drums_pendulum` seed 9 (`+93.59`), and `syncopated_switchback` seed 6 (`+90.27`). Largest valid-row regressions were `drums_dropout` seed 7 (`-161.77`), `opening_burst` seed 0 (`-111.81`), `verse_chorus` seed 3 (`-79.32`), `verse_chorus` seed 4 (`-63.68`), and `drums_signature` seed 0 (`-61.54`), but paired canonical score accepted the tradeoff.
- Status: Kept and committed as the new baseline.

## arc-air-grounded-support-45

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: After the next-speed settle stream, remaining worst rows are dominated by `drums_pendulum` and related low-air overshoot: the lowest 200k rows still have air MAE around `0.20..0.26` with positive signed air error, while speed is now mixed between over- and under-speed. The existing `air_support` stream is mostly another normal sample because placement does not give it grounded-support controls. Giving it longer/flatter post-contact support and adding a next-air support stream should broaden grounded-time futures for current and upcoming low-air beats.
- Code changes made: Temporarily added `air_support` target-state controls that reduced contact jitter, flattened contact/pre/post angles, lengthened post-contact support, and raised post floors under smooth low-air pressure. Broadened low-air support target coverage to `<=0.45` and added one next-target `air_support` axis-quality policy. Contract search, startup rescue, speed streams, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid were unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-air-grounded-support-45`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `440.7`; `Δheadline = -0.7`, 95% CI `[-5.4, 4.9]`, `P(Δ<=0)=62.2%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.5`, `100k=-1.3`, `150k=-0.3`, `200k=-0.7`; validity was unchanged at every budget. The stream was active (`air_support` sampled `4882 -> 28604`, landed `1485 -> 12594`, selected air axis-quality candidates `15 -> 163`) and slightly improved aggregate air MAE (`0.1079 -> 0.1067`), but speed/grain tradeoffs offset it (`speed MAE 0.2169 -> 0.2178`, grain MAE `0.0661 -> 0.0674`). Largest 200k gains were `drums_dropout` seed 7 (`+158.40`), `verse_chorus` seed 3 (`+154.24`), `verse_chorus` seed 2 (`+127.11`), and `rhythm_ladder` seed 3 (`+96.42`); largest regressions were `drums_crescendo` seed 6 (`-109.17`), `syncopated_switchback` seed 11 (`-97.62`), `dense_sprint` seed 11 (`-67.08`), `drums_swell` seed 2 (`-63.78`), and `syncopated_switchback` seed 0 (`-62.79`). The mechanism broadened grounded-time coverage but not in a way the canonical score favored.
- Status: Reverted; not committed.

## arc-next-air-level-exit-46

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: The failed grounded-support attempt showed that broad low-air support can improve air MAE but harm speed/grain enough to lose. A narrower quality-only next-air `level_exit` family should add a different future state: post-catch geometry that settles vertical release velocity with moderate support length, while existing engine preview/ranking decides whether the next contact remains workable. Adding release-vertical metadata and selected-release diagnostics should also make future-state coverage visible without changing the scorer.
- Code changes made: Added optional `releaseVy` metadata to `GapFit`, populated it at the release probe frame, preserved it through clone paths, and reported selected release-state summaries in compile stats. Added `level_exit` as a candidate sample mode with separate target-state controls that pull post-contact exit toward a flatter/settled angle and modestly extend support. Registered one quality-only next-air axis stream whose sample count scales smoothly with next low-air pressure. Contract search, startup rescue, speed streams, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-next-air-level-exit-46`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `440.8`; `Δheadline = -0.6`, 95% CI `[-3.4, 2.2]`, `P(Δ<=0)=69.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.3`, `100k=-0.9`, `150k=-1.3`, `200k=-0.2`; validity was unchanged at every budget and remained `240/240` at 200k. The stream was active: `level_exit` sampled `15538` candidates at 200k, landed `5150`, and air axis-quality work increased (`4882/1485` attempts/successes -> `20620/6729`). Selected air axis-quality candidates rose `15 -> 106`, but the extra air futures mostly displaced speed futures (`speed selected 1602 -> 1548`) without improving the paired score. Largest 200k gains were `drums_crescendo` seeds 1 (`+67.91`), 11 (`+65.06`), and 7 (`+47.47`), `drums_dropout` seed 6 (`+46.58`), and `rhythm_ladder` seed 11 (`+45.58`). Largest regressions were `syncopated_switchback` seeds 11 (`-58.75`), 4 (`-52.44`), 1 (`-43.81`), and 7 (`-40.45`), `drums_crescendo` seed 4 (`-42.57`), `drums_dropout` seed 1 (`-41.54`), and `drums_pendulum` seed 9 (`-41.35`). Compact golden output did not include the new selected-release diagnostic fields because `golden.ts` whitelists compile stats, so no release-velocity distribution was available from this run.
- Status: Reverted; not committed.

## arc-preview-scarce-next-speed-47

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: The next-air `level_exit` attempt proved extra futures can be generated, but broad air competition displaced useful speed setup. A more forward-aware contract stream should only add geometry when the current ranked candidates all leave zero one-step preview survivors. In those preview-scarce states, a tiny deterministic next-speed `speed_drag` setup stream may add a physically different current catch that keeps the next required contact catchable, without spending samples in already-workable nodes or changing post-pass quality search.
- Code changes made: Added a contract/rescue-only scarce-next setup stream inside `rankedOptions`. After pool/reuse/brake candidates are scored with the existing one-contact preview, if every viable option has zero preview survivors, the stream samples up to two `speed_drag` candidates shaped to the next contact's speed target with a small below-target bias. Attempts are recorded under the existing speed axis-quality diagnostics; quality-phase axis streams, startup rescue, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-preview-scarce-next-speed-47`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `439.0`; `Δheadline = -2.4`, 95% CI `[-10.6, 6.7]`, `P(Δ<=0)=71.5%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-1.3`, `50k=-36.9`, `100k=-1.1`, `150k=+2.2`, `200k=+2.0`; validity regressed at low budgets (`25k 35% -> 32%`, `50k 97% -> 94%`) and was unchanged at 100k+. The stream increased early speed-drag work (`25k speed_drag sampled 1191 -> 4081`, landed `499 -> 1424`) and selected speed axis-quality candidates (`25k 69 -> 209`), which improved some high-budget hard rows: `drums_dropout` seed 7 `+152.48`, `drums_pendulum` seed 10 `+139.07`, `rhythm_ladder` seed 9 `+73.09`, `drums_zigzag` seed 10 `+58.68`, and `verse_chorus` seed 2 `+50.70`. The low-budget validity hit and severe valid-row regression on `syncopated_switchback` seed 11 (`-157.61`, with start basin changing from rank 6 to rank 0) outweighed those gains. Unique full evaluations fell slightly at 200k (`56799 -> 56393`) despite more previews (`64573 -> 68559`), suggesting the stream spent contract budget and altered start/frontier routing more than it created durable terminal diversity.
- Status: Reverted; not committed.

## arc-speed-cradle-family-48

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Remaining worst high-budget rows are still speed-heavy, but adding more of the same steep `speed_drag` depth previously mostly traded rows. A distinct quality-only `speed_cradle` family should expose a different physical speed-control future: longer, more grounded uphill support with a gentler post angle than `speed_drag`, so the rider can bleed speed without a sharp launch or abrupt downstream state. It should preserve validity because it runs only in the post-pass axis-quality stream.
- Code changes made: Added `speed_cradle` as a candidate sample mode with separate target-state placement controls: modestly more preclear pressure, gentler uphill post angle than `speed_drag`, longer post support, and a higher post-support floor under smooth overspeed pressure. Registered one next-speed quality stream using `speed_cradle` with a small below-target speed bias. Contract search, startup rescue, existing speed streams, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-cradle-family-48`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `442.0`; `Δheadline = +0.6`, 95% CI `[-4.0, 5.3]`, `P(Δ<=0)=39.9%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.1`, `100k=-2.6`, `150k=+0.3`, `200k=+2.6`; validity was unchanged at every budget. The stream was active and physically distinct: at 200k `speed_cradle` sampled `26219`, landed `9110`, speed axis-quality attempts/successes rose `145081/65290 -> 167241/71951`, and selected speed axis-quality candidates rose `1602 -> 1781`. It produced large 200k gains on `drums_dropout` seed 7 (`+212.54`), `verse_chorus` seed 3 (`+99.07`), `drums_dropout` seed 6 (`+77.47`), `opening_burst` seed 0 (`+75.21`), `rhythm_ladder` seed 3 (`+69.27`), `dense_sprint` seed 10 (`+66.01`), and `syncopated_switchback` seed 10 (`+58.08`). Regressions were also large: `syncopated_switchback` seed 11 (`-130.39`), `mini_burst` seed 6 (`-102.90`), `drums_dropout` seeds 5 (`-87.39`), 4 (`-81.95`), and 11 (`-67.63`), `drums_zigzag` seed 2 (`-72.78`), and `dense_sprint` seed 9 (`-56.82`). Unique full evaluations dropped at high budget (`56799 -> 56128`), so the family broadened speed-control futures but caused too much branch churn and did not meet the promotion gate.
- Status: Reverted; not committed.

## arc-scarce-suffix-repair-49

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: The lowest valid 150k/200k rows have very low axis quality, large frontier lag, and often scarce unique full evaluations, but bounded suffix repair is completely inactive because its quality/full-evaluation gates are too narrow (`axis_quality < 0.24`, unique full evaluations `<4`). Widening that existing bounded suffix channel to low-quality/scarce-terminal rows should give the current placement streams more terminal chances without adding geometry, changing contract search, or broadening candidate families.
- Code changes made: Raised `QUALITY_SUFFIX_REPAIR_MAX_AXIS_QUALITY` from `0.24` to `0.34`, raised `QUALITY_SUFFIX_REPAIR_MAX_FULL_EVALUATIONS` from `4` to `16`, and raised `QUALITY_SUFFIX_REPAIR_MAX_ATTEMPTS` from `4` to `6`. The interval, node cap, two-wide branching, candidate generators, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-scarce-suffix-repair-49`
- Decide result: `VERDICT: ACCEPT`, but below the promotion gate; baseline `441.4` -> candidate `443.1`; `Δheadline = +1.7`, 95% CI `[0.0, 5.3]`, `P(Δ<=0)=1.4%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.6`, `100k=+2.3`, `150k=+2.2`, `200k=+1.6`; validity was unchanged at every budget. The widened gate made suffix repair active but still sparse: at 200k it ran in `14/240` rows with `29` attempts, `12` successes/improvements, and `659` suffix nodes. It improved the intended scarce-terminal hard rows `drums_dropout` seed 7 (`+152.48`, unique full evaluations `7 -> 47`) and `drums_pendulum` seed 10 (`+115.58`, suffix `4/2`), plus smaller gains on `rhythm_ladder` seed 4 (`+12.28`) and `dense_sprint` seed 0 (`+7.63`). Most rows were unchanged; notable 200k regressions were `drums_pendulum` seed 4 (`-11.26`, unique full evaluations `31 -> 7`) and `dense_sprint` seed 11 (`-0.57`). Aggregate 200k terminal work was effectively unchanged (`unique full 56799 -> 56792`, full `94727 -> 94711`), so the existing suffix channel helps selected dead rows but is too narrow to constitute a structural placement improvement.
- Status: Reverted; not committed because the canonical `Δheadline` did not exceed `+5`.

## arc-low-air-support-shape-50

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: The current `air_support` stream is a named proposal stream but still uses the normal target-state shape. Worst high-budget rows repeatedly miss low-air targets while remaining valid, especially first/tight low-air catches that become long airborne launches. Giving only the existing low-air `air_support` stream a physically distinct grounded-support shape should add a separable low-air future without broadening sample counts, target coverage, scoring, or contract search.
- Code changes made: Added an `air_support` placement pressure inside `targetStateControls`: it reduces contact jitter, shortens pre-contact lead-in, flattens the contact/post transition, raises the post-support floor, and biases post length toward the existing low-air ground-time target. Existing stream registration, sample counts, target max (`air <= 0.25`), scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-low-air-support-shape-50`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `441.3`; `Δheadline = -0.1`, 95% CI `[-1.2, 0.9]`, `P(Δ<=0)=62.9%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.2`, `100k=+0.6`, `150k=+0.0`, `200k=-0.5`; validity was unchanged at every budget. The shaped stream changed selection without improving the intended axis: at 200k `air_support` sampled/landed fell from `4882/1485` to `4289/1026`, selected air axis-quality candidates rose `15 -> 26`, and aggregate air was flat/slightly worse (`MAE 0.1079 -> 0.1081`, signed `+0.0549 -> +0.0550`). `drums_pendulum` speed improved slightly (`MAE 0.3125 -> 0.3099`) but air and grain worsened. Largest 200k gains were `syncopated_switchback` seed 8 (`+40.18`), `drums_pendulum` seed 0 (`+38.40`), `drums_pendulum` seed 5 (`+20.09`), and `syncopated_switchback` seed 7 (`+16.87`). Largest regressions were `syncopated_switchback` seed 11 (`-69.71`), `drums_pendulum` seed 9 (`-60.45`), `drums_pendulum` seed 7 (`-27.60`), and `drums_pendulum` seed 3 (`-21.63`). The low-air stream became physically distinct but less landable and mostly churned branch choices.
- Status: Reverted; not committed.

## arc-quality-preview-51

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Contract search ranks candidates with a one-contact future preview, but quality search disables that preview while activating the axis-quality streams. The failed air/support and speed/cradle families showed that extra futures can be generated but often churn branch choices or displace useful speed setup. Enabling the same engine-backed next-contact preview during quality search should make axis-specific candidates compete on downstream catchability, not only local current-axis cost and release-speed proxy.
- Code changes made: Changed `handoffUsesFuturePreview` so quality search also uses the existing one-contact preview. Candidate generators, sample counts, preview horizon, preview scoring terms, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-quality-preview-51`
- Decide result: `VERDICT: REJECT`; baseline `441.4` -> candidate `400.5`; `Δheadline = -40.9`, 95% CI `[-55.0, -26.8]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.1`, `50k=-5.2`, `100k=-41.1`, `150k=-48.7`, `200k=-48.9`; validity was unchanged at every budget. The preview did what it was asked to do but starved quality conversion: at 200k previews increased `64573 -> 307555` and preview contacts `19333 -> 86393`, while axis-quality attempts fell `149963 -> 123176`, selected axis-quality candidates fell `1617 -> 981`, unique full evaluations fell `56799 -> 33041`, and tail completions fell `48863/38467 -> 27804/20830`. Some rows improved (`mini_burst` seed 2 `+101.96`, `verse_chorus` seed 3 `+79.07`, `dense_sprint` seed 8 `+61.34`), but broad regressions dominated: `syncopated_switchback` seed 11 `-192.63`, `drums_dropout` seed 5 `-190.35`, `drums_breath` seed 5 `-169.77`, `drums_zigzag` seed 1 `-168.65`, and `drums_tide` seed 2 `-166.14`. Full quality search cannot afford universal preview; future-awareness must be cheaper or limited to candidate generation/ranking signals already produced.
- Status: Reverted; not committed.

## arc-next-speed-carry-52

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Existing speed-specific futures mostly brake or drag when the rider is over the current/next target. Several low-quality valid rows still have large speed undershoot runs, and a catch placed now controls the next speed span. Add a small next-target `speed_carry` family that is only sampled under smooth underspeed pressure, producing a cleaner downhill release/carry-speed future without changing contract search, scoring, or existing speed-drag streams.
- Code changes made: Added `speed_carry` to `CANDIDATE_SAMPLE_MODES`, added target-state controls for underspeed pressure that open contact/post angles, shorten pre-contact lead-in, and keep post support lighter for a clean carry release. Added one quality-only next-speed stream with `underspeedScale`, plus generalized speed stream sampling so overspeed and underspeed policies are gated separately. Contract search, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-next-speed-carry-52`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `441.6`; `Δheadline = +0.2`, 95% CI `[-0.6, 1.2]`, `P(Δ<=0)=39.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.0`, `100k=+0.2`, `150k=+0.2`, `200k=+0.2`; validity was unchanged at every budget. The stream was active but low-yield: at 200k `speed_carry` sampled `8513` candidates but landed only `149`; speed axis-quality attempts rose `145081 -> 153543`, selected speed axis-quality candidates rose `1602 -> 1614`, and aggregate speed improved slightly (`MAE 0.2169 -> 0.2167`, signed `+0.1481 -> +0.1479`). Unique full evaluations dipped (`56799 -> 56710`). The main 200k gain was `drums_pendulum` seed 8 (`+58.53`), with a smaller `cold_start` seed 8 gain (`+12.23`); main regressions were `verse_chorus` seed 4 (`-28.75`) and `drums_pendulum` seed 0 (`-22.06`). The underspeed carry future is directionally plausible but too rarely landable to move the canonical result.
- Status: Reverted; not committed.

## arc-next-speed-carry-normal-53

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: The `speed_carry` attempt showed mild positive speed signal but very poor landability (`149/8513` at 200k). The useful part may be the underspeed next-target setup, not the new shape. Reusing normal target-state geometry with a next-speed target under smooth underspeed pressure should provide a more landable carry-speed future at the same small quality-only cost.
- Code changes made: Added `underspeedScale` support to speed axis-quality policies and registered one quality-only next-speed stream using `mode: "normal"` with the existing candidate generator and a next-speed target. No new sample mode or geometry formula was added. Contract search, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-next-speed-carry-normal-53`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `441.4`; `Δheadline = +0.0`, 95% CI `[-1.3, 1.3]`, `P(Δ<=0)=49.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.2`, `100k=+0.1`, `150k=-0.2`, `200k=+0.2`; validity was unchanged at every budget. The normal next-speed stream was more landable than custom `speed_carry`: at 200k normal samples/landings moved `1706209/439395 -> 1709021/438991`, speed axis-quality attempts/successes rose `145081/65290 -> 153355/65439`, and unique full evaluations were flat/slightly up (`56799 -> 56825`). It still mostly traded rows and selected speed axis-quality candidates fell slightly (`1602 -> 1598`). Largest 200k gains were `drums_crescendo` seed 9 (`+68.47`), `grain_staircase` seed 10 (`+61.37`), `drums_signature` seed 2 (`+37.42`), and `drums_pendulum` seed 7 (`+15.94`); largest regressions were `drums_pendulum` seed 9 (`-60.45`), `syncopated_switchback` seed 9 (`-27.27`), `drums_pendulum` seed 5 (`-12.34`), and `drums_pendulum` seed 3 (`-9.83`). The next-speed underspeed target added coverage but did not create enough distinct durable improvements.
- Status: Reverted; not committed.

## arc-low-air-rideout-extension-54

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: The evaluator measures air over a frame span, so low-air quality often depends on sustained support after the catch. Candidate validation already has an engine-tested ride-out continuation, but it only runs for air-only targets. Allowing low-air multi-axis candidates to try the same continuation should expose grounded-support futures without adding search streams; because `evaluateCandidateLines` only adopts the continuation when the full multi-axis candidate cost improves, speed/grain remain part of the local acceptance decision.
- Code changes made: Broadened `shouldTryCandidateRideOut` so it still applies to air-only targets and also applies when `air <= 0.35` on a multi-axis gap. Candidate generation, handoff ranking, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-low-air-rideout-extension-54`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `441.4`; `Δheadline = +0.0`, 95% CI `[0.0, 0.0]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: The run was behaviorally inert: 200k changed track hashes `0/240`, score diffs `0/240`, and aggregate counters were identical at every checked budget. At 200k both runs had `2094150` candidates sampled, `594208` viable candidates, `48006581` sim frames, `56799` unique full evaluations, and `94727` full evaluations. The low-air multi-axis condition did not exercise because the existing ride-out guard also requires long gaps (`>=60` frames), while the canonical low-air failures are mostly tighter cadence spans.
- Status: Reverted; not committed.

## arc-low-air-lookahead-55

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Attempt 54 was inert because low-air tight-cadence candidates are measured only to the current contact frame, so post-contact support cannot improve local candidate cost even though it controls the next gap's air. For low-air targets, candidate validation should measure through the next contact and allow shorter ride-out continuations, making grounded support visible to local selection while still relying on engine validation and the existing multi-axis candidate cost.
- Code changes made: Changed `axisLookaheadEndFrame` to extend low-air (`air < 0.45`) candidate measurement through the next contact, and changed `shouldTryCandidateRideOut` to allow low-air multi-axis ride-out continuations with a cadence-scaled minimum gap floor. Candidate generation, handoff ranking, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-low-air-lookahead-55`
- Decide result: `VERDICT: REJECT`; baseline `441.4` -> candidate `125.6`; `Δheadline = -315.8`, 95% CI `[-391.0, -137.4]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-3.1`, `50k=-244.2`, `100k=-325.3`, `150k=-347.5`, `200k=-344.2`; validity collapsed (`25k 35% -> 28%`, `50k 97% -> 75%`, `100k 100% -> 78%`, `150k 100% -> 79%`, `200k 100% -> 80%`). At 200k the candidate had only `193/240` valid rows. Many failures were exactly the low-air/tight-cadence rows the change touched (`drums_pendulum` seeds 0-11 mostly failed, plus `syncopated_switchback`, `cold_start`, `drums_dropout`, and `drums_tide` failures). The mechanism made local candidate selection chase post-contact air/support too early and broke contract completion; low-air future awareness cannot be introduced by broadly extending the measured span used for hard candidate ranking.
- Status: Reverted; not committed.

## arc-axisq-branch-diversity-56

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Several failed proposal-family attempts generated useful futures but did not survive top-three branch selection consistently, while universal preview starved quality search. In quality search, preserve one engine-validated axis-quality representative in the branch set when one exists outside the score-sorted top three. This broadens physically distinct futures already sampled without adding candidate generation, changing scoring, or spending preview work.
- Code changes made: Factored `rankedOptions` sorting into a helper and changed quality-search branch selection so the returned three options include the best axis-quality candidate when the ordinary top three contain none. Contract search, candidate generation, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-axisq-branch-diversity-56`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `440.9`; `Δheadline = -0.5`, 95% CI `[-2.7, 1.4]`, `P(Δ<=0)=70.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=+0.2`, `100k=-0.1`, `150k=-0.6`, `200k=-0.9`; validity was unchanged at every budget. The diversity rule had only a small coverage effect: at 200k selected axis-quality candidates rose `1617 -> 1649`, but unique full evaluations fell `56799 -> 55693`, full evaluations fell `94727 -> 93448`, and axis-quality successes fell `66775 -> 66003`. Largest 200k gains were `drums_pendulum` seed 8 (`+77.17`), `drums_zigzag` seed 10 (`+59.16`), `dense_sprint` seed 2 (`+52.83`), and `drums_dropout` seed 8 (`+47.48`); largest regressions were `drums_pendulum` seed 4 (`-82.74`), `drums_zigzag` seed 2 (`-60.10`), `drums_crosscut` seed 7 (`-56.30`), and `opening_burst` seed 6 (`-53.69`). Preserving an axis-quality representative broadened branch source coverage slightly but mostly caused row churn and reduced terminal search throughput.
- Status: Reverted; not committed.

## arc-grain-focus-stream-57

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: The current quality streams expose speed and air futures, but grain has no named proposal stream even though some low rows have large high-grain undershoot. Add a high-grain-pressure quality-only stream that generates geometry with less segment-length jitter and post-contact support sized so the median line length can physically reach the authored grain target. This should broaden line-grain futures without changing contract search, scoring, golden specs, evaluator fingerprint, seed set, metric, or budget grid.
- Code changes made: Added `grain_focus` as a candidate sample mode, added one smooth target-pressure grain axis-quality stream, and made `grain_focus` damp segment-length/contact jitter while flooring post support near two target-length segments and using floor-based post segmentation. Existing speed/air streams and candidate validation are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-grain-focus-stream-57`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `441.4`; `Δheadline = -0.0`, 95% CI `[-1.3, 1.0]`, `P(Δ<=0)=50.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=+0.1`, `150k=-0.4`, `200k=+0.1`; validity was unchanged at every budget. The stream was active and landable but did not improve the intended axis: at 200k `grain_focus` sampled `15080` candidates and landed `3039`, axis-quality attempts/successes rose `149963/66775 -> 163217/69359`, and selected axis-quality candidates rose `1617 -> 1678`. Aggregate grain slightly worsened (`MAE 0.0661 -> 0.0664`, signed `-0.0171 -> -0.0172`), while unique full evaluations fell `56799 -> 56392` and tail completions fell `48863/38467 -> 48341/38148`. Largest 200k gains were `drums_crescendo` seed 6 (`+45.57`), `syncopated_switchback` seed 10 (`+44.40`), `drums_signature` seed 3 (`+32.30`), and `syncopated_switchback` seed 1 (`+31.81`); largest regressions were `dense_sprint` seed 7 (`-42.80`), `syncopated_switchback` seed 11 (`-32.98`), `drums_crescendo` seed 1 (`-27.89`), and `opening_burst` seed 9 (`-20.81`). The generator added a physically distinct grain family, but branch churn and lower terminal throughput offset the isolated row gains.
- Status: Reverted; not committed.

## arc-next-low-air-support-58

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Low-air quality is often created by support placed before the low-air gap, so a current low-air stream is misaligned for tight cadences. Add a next-target low-air support stream that shapes the current catch for the next beat's low-air target, and make `air_support` physically distinct in a narrow post-contact way: longer ride-out capacity and a flatter/less launchy post angle under low-air pressure while leaving contact jitter, pre-contact geometry, hard validation, scoring, golden specs, evaluator fingerprint, seed set, metric, and budget grid unchanged.
- Code changes made: Added a second air axis-quality policy using `targetSource: "next"` and `mode: "air_support"` for next low-air targets. Added post-only `air_support` controls in `targetStateControls`: smooth low-air support pressure raises post support capacity/floor and offsets part of the low-air post-angle drop. Existing current low-air stream now uses the same narrow post-support shape.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-next-low-air-support-58`
- Decide result: `VERDICT: REJECT`; baseline `441.4` -> candidate `440.2`; `Δheadline = -1.2`, 95% CI `[-4.3, 1.4]`, `P(Δ<=0)=81.5%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.0`, `100k=-0.3`, `150k=-1.6`, `200k=-1.8`; validity was unchanged at every budget. The next-air support stream was active and did slightly reduce aggregate air error (`MAE 0.1079 -> 0.1076`, signed `+0.0549 -> +0.0538`), but it damaged speed and grain (`speed MAE 0.2169 -> 0.2182`, `grain MAE 0.0661 -> 0.0675`) and reduced terminal throughput (`unique full evaluations 56799 -> 56438`, tail successes `38467 -> 38220`). At 200k `air_support` samples/landings rose `4882/1485 -> 12371/3368`, but selected axis-quality candidates rose only `1617 -> 1654`, indicating most added support futures did not survive ranking. Largest 200k gains were `verse_chorus` seed 11 (`+83.87`), `syncopated_switchback` seed 2 (`+81.49`), `drums_pendulum` seed 8 (`+64.08`), and `drums_crescendo` seed 6 (`+62.09`); largest regressions were `drums_crescendo` seed 3 (`-138.20`), `drums_dropout` seed 4 (`-84.23`), `syncopated_switchback` seed 11 (`-82.60`), and `drums_pendulum` seed 9 (`-60.45`). Next-beat low-air support is real coverage, but without stronger speed/grain coupling it creates too much branch churn.
- Status: Reverted; not committed.

## arc-quality-family-budget-59

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Failed semantic streams repeatedly produced real candidates but reduced terminal search throughput when simply added on top of the normal sampler. During quality search, reserve a small amount of normal sample depth when existing semantic axis-quality streams are active, so the candidate pool becomes more of a balanced family mixture at roughly the same cost instead of normal samples plus extra work. This changes quality-phase proposal allocation only; contract search, candidate geometry, validation, scoring, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Code changes made: Added a cheap deterministic estimate of active axis-quality sample count per node and reduced quality normal sample count by up to three samples, bounded below by the ranked pool size. Existing axis-quality streams, branch count, scoring, and candidate generators are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-quality-family-budget-59`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `441.4` -> candidate `442.1`; `Δheadline = +0.7`, 95% CI `[-4.6, 5.7]`, `P(Δ<=0)=38.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=+1.5`, `100k=+1.6`, `150k=-0.6`, `200k=+1.0`; validity was unchanged at every budget. The family-budget allocation produced the clearest throughput improvement in this block: at 200k unique full evaluations rose `56799 -> 59537`, full evaluations rose `94727 -> 99399`, tail successes rose `38467 -> 40372`, and tail improvements rose `1393 -> 1481`. It also shifted the proposal mix toward semantic/brake futures (`selected pool 5069 -> 4946`, selected axis-quality `1617 -> 1684`, selected brake `1238 -> 1282`) while normal candidate landings fell `439395 -> 414580`. Aggregate speed and air improved slightly (`speed MAE 0.2169 -> 0.2164`, air MAE `0.1079 -> 0.1072`) but grain worsened (`0.0661 -> 0.0668`). Largest 200k gains were `drums_dropout` seed 7 (`+162.10`), `verse_chorus` seed 3 (`+118.52`), `drums_zigzag` seed 10 (`+63.73`), and `opening_burst` seed 0 (`+61.53`); largest regressions were `drums_tide` seed 2 (`-166.14`), `dense_sprint` seed 4 (`-70.12`), `drums_breath` seed 3 (`-59.81`), and `drums_breath` seed 5 (`-59.70`). The mechanism is promising for terminal throughput but too volatile and far below the `+5` promotion gate.
- Status: Reverted; not committed.

## arc-scarce-family-budget-60

- Baseline used: `arc-next-speed-settle-44` at commit `3e630e1`.
- Hypothesis: Attempt 59 showed that reserving normal sample depth for semantic families can improve terminal throughput, but applying it throughout quality search churned too many healthy rows. Gate the same family-budget reservation by smooth terminal-feedback scarcity so rows with few unique full evaluations get the mixture, while rows already receiving enough full-track feedback keep the baseline normal depth.
- Code changes made: Reintroduced the semantic sample-count estimate, but multiplied the reservation by `1 / (1 + (unique_full_evaluations / 48)^2)` and kept the same cap of three reserved normal samples with the ranked-pool floor. Candidate geometry, stream definitions, validation, scoring, contract search, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-scarce-family-budget-60`
- Decide result: `VERDICT: ACCEPT`; baseline `441.4` -> candidate `443.3`; `Δheadline = +1.9`, 95% CI `[-1.8, 5.9]`, `P(Δ<=0)=14.8%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=+0.6`, `100k=+2.8`, `150k=+2.1`, `200k=+1.9`; validity was unchanged at every budget. The scarce-feedback allocation kept the useful terminal-throughput signal from attempt 59 while reducing volatility: at 200k unique full evaluations rose `56799 -> 58113`, full evaluations rose `94727 -> 97002`, tail successes rose `38467 -> 39414`, and tail improvements rose `1393 -> 1440`. Candidate mix shifted only where feedback was scarce (`selected pool 5069 -> 4979`, selected reuse `2270 -> 2331`, selected brake `1238 -> 1248`, selected axis-quality `1617 -> 1632`). Aggregate air and speed improved (`air MAE 0.1079 -> 0.1066`, speed MAE `0.2169 -> 0.2158`), while grain worsened slightly (`0.0661 -> 0.0668`). Largest 200k gains were `drums_dropout` seed 7 (`+155.71`), `drums_swell` seed 7 (`+86.38`), `drums_zigzag` seed 10 (`+75.81`), and `drums_signature` seed 0 (`+46.88`); largest regressions were `drums_crescendo` seed 5 (`-66.26`), `drums_pendulum` seed 9 (`-60.45`), `drums_tide` seed 5 (`-58.01`), and `drums_crescendo` seed 0 (`-38.99`).
- Status: Kept after removing the additional `Δheadline > +5` promotion rule; committed as the new baseline.

## arc-scarce-suffix-on-family-61

- Baseline used: `arc-scarce-family-budget-60` at commit `daa0eae`.
- Hypothesis: The current worst rows are valid but still low-quality, and many have scarce unique full evaluations despite the accepted family-budget allocation. Bounded suffix repair should convert more physically distinct candidate prefixes into full-track evidence in those weak/scarce rows, letting existing placement streams be judged by downstream workability rather than only immediate local cost.
- Code changes made: Widened the existing quality suffix repair eligibility from `axis_quality < 0.24`, unique full evaluations `<4`, and at most `4` attempts to `axis_quality < 0.34`, unique full evaluations `<16`, and at most `6` attempts. The interval, node cap, two-wide suffix branching, candidate generators, validation, scoring, contract search, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-scarce-suffix-on-family-61`
- Decide result: `VERDICT: ACCEPT`; baseline `443.3` -> candidate `444.4`; `Δheadline = +1.0`, 95% CI `[-0.0, 3.5]`, `P(Δ<=0)=5.2%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.8`, `100k=+2.0`, `150k=+0.9`, `200k=+0.8`; validity was unchanged at every budget. The mechanism stayed sparse and targeted: at 200k it ran `20` suffix repair attempts with `9` successes, `8` improvements, and `569` suffix nodes. The largest 200k gains were `drums_pendulum` seed 10 (`+115.58`), `drums_dropout` seed 7 (`+12.83`), `drums_tide` seed 9 (`+5.65`), and `drums_pendulum` seed 4 (`+2.97`); the rest of the 200k rows were effectively unchanged. Aggregate speed improved slightly (`MAE 0.2158 -> 0.2148`) with air essentially flat/slightly better and grain essentially flat/slightly worse. Unique full evaluations and tail successes were slightly lower because the sparse suffix channel displaced a little ordinary terminal work, but the accepted paired result shows the added scarce-row terminal evidence was useful.
- Status: Kept and committed as the new baseline.

## arc-budget-aware-suffix-62

- Baseline used: `arc-scarce-suffix-on-family-61` at commit `8231cc9`.
- Hypothesis: The accepted suffix repair should scale with available budget instead of using one fixed effort envelope at every budget. Low budgets should spend a tighter suffix repair envelope, while larger budgets can afford broader weak-row eligibility, more attempts, more nodes per bounded suffix, and a shorter interval. The scaling should be smooth and deterministic in the scalar budget rather than tied to canonical budget rows.
- Code changes made: Passed `targetBudget` into suffix repair eligibility and bounded suffix completion. Replaced fixed suffix repair caps with smooth functions of `sqrt(targetBudget / (targetBudget + 100000))` anchored around the accepted attempt-61 constants: axis-quality cap, unique-full-evaluation scarcity cap, max attempts, repair interval, and max suffix nodes now scale with budget. Candidate generators, validation, scoring, contract search, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-aware-suffix-62`
- Decide result: `VERDICT: REJECT`; baseline `444.4` -> candidate `0.0`; `Δheadline = -444.4`, 95% CI `[-470.1, -415.4]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: The canonical run collapsed because the new suffix gate referenced an undefined `lerp` helper once larger-budget rows reached a passing key: checkpoint errors reported `ReferenceError: lerp is not defined`. Validity went to `0%` at every budget. At 25k, before the helper was exercised broadly, rows still failed by budget exhaustion; at 50k+ compile stats were generally absent because the checkpoint errored. Aggregate diagnostics showed unique full evaluations dropping to `0` and suffix repair attempts staying at `0`, so this was an implementation failure rather than a meaningful placement result.
- Status: Reverted; not committed.

## arc-budget-aware-suffix-schedule-63

- Baseline used: `arc-scarce-suffix-on-family-61` at commit `8231cc9`.
- Hypothesis: Suffix repair should be budget-aware, but the accepted weak/scarce eligibility should stay stable. Scale only the repair effort envelope with a smooth function of scalar budget: lower budgets try repairs less often and with smaller bounded suffix searches, while larger budgets can spend more repair attempts and deeper suffix completion. This makes the physical future-generation effort budget-aware without changing candidate geometry, scorer, or the semantic definition of a weak prefix.
- Code changes made: Passed `targetBudget` into suffix repair scheduling and bounded suffix completion. Added a deterministic `smoothstep(targetBudget / (targetBudget + 50000))` pressure that scales max attempts from `4` to `8`, interval from `40` down to `28`, and max suffix nodes from `96` to `176`. Kept the accepted axis-quality threshold, unique-full-evaluation scarcity cap, branching, candidate generators, validation, scoring, contract search, golden specs, evaluator fingerprint, seed set, metric, and budget grid unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-aware-suffix-schedule-63`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.4` -> candidate `444.3`; `Δheadline = -0.0`, 95% CI `[-0.3, 0.4]`, `P(Δ<=0)=63.3%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.4`, `100k=+0.0`, `150k=+0.3`, `200k=-0.2`; validity was unchanged at every budget. The smoother schedule behaved as intended but did not convert into quality: at 200k suffix repair rose from `20/9/8/569` attempts/successes/improvements/nodes to `23/12/11/640`, while unique full evaluations were essentially flat/slightly lower (`241.61 -> 241.53` per row) and tail successes dipped slightly (`39331 -> 39323`). The largest 200k gain was `drums_pendulum` seed 7 (`+5.14`), but regressions in `drums_pendulum` seed 4 (`-20.83`), `rhythm_ladder` seed 4 (`-12.28`), and `syncopated_switchback` seed 10 (`-3.41`) offset it. At 50k, lower repair effort reduced suffix attempts (`9 -> 7`) and lost more than it saved, mainly `drums_crescendo` seed 8 (`-73.72`) and `drums_pendulum` seed 1 (`-32.22`) against one `dense_sprint` seed 0 gain (`+27.89`).
- Status: Reverted; not committed.

## arc-speed-settle-mode-64

- Baseline used: `arc-scarce-suffix-on-family-61` at commit `8231cc9`.
- Hypothesis: The current worst valid rows, especially `drums_pendulum`, are dominated by repeated speed overshoot after contact. Existing next-speed-settle sampling uses the same steep `speed_drag` geometry as the other drag streams, so it may not expose a distinct grounded-support future. Reusing the existing one-sample next-speed-settle stream but giving it a separate `speed_settle` geometry mode should broaden speed-control futures at roughly the same cost: less launchy contact, longer post-contact support, and a grounded ride-out that can physically bleed speed before the next beat.
- Code changes made: Added `speed_settle` to `CANDIDATE_SAMPLE_MODES`, changed only the existing next-speed-settle axis-quality stream to use that mode, and added `speed_settle` controls in `targetStateControls`. The mode scales smoothly with overspeed pressure and biases contact/pre/post angles modestly uphill while increasing post-support length/floor/cap and post-target blending. Sample counts, stream gating, candidate validation, scoring, contract search, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-speed-settle-mode-64`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.4` -> candidate `442.5`; `Δheadline = -1.8`, 95% CI `[-7.5, 4.0]`, `P(Δ<=0)=74.5%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=+1.1`, `100k=-4.1`, `150k=-2.0`, `200k=-1.5`; validity was unchanged at every budget. The new family was active and landable: at 200k `speed_settle` sampled `28354` candidates and landed `11566`, replacing part of the old `speed_drag` stream (`81686/33083 -> 53808/22727` sampled/landed for `speed_drag`). It increased axis-quality successes (`67269 -> 68990`) and selected axis-quality candidates (`1635 -> 1722`), and unique full evaluations rose slightly (`241.61 -> 243.00` per row), but tail successes fell (`39331 -> 38899`) and row churn dominated. Largest 200k gains were `verse_chorus` seed 2 (`+89.41`), `verse_chorus` seed 5 (`+87.89`), `verse_chorus` seed 11 (`+81.07`), `drums_dropout` seed 10 (`+77.50`), and `opening_burst` seed 0 (`+76.58`); largest regressions were `drums_dropout` seed 5 (`-104.48`), `opening_burst` seed 11 (`-84.98`), `drums_breath` seed 5 (`-82.04`), `verse_chorus` seed 8 (`-80.36`), `mini_burst` seed 8 (`-72.41`), and `grain_staircase` seed 5 (`-70.07`). The mode broadened coverage but displaced too much useful terminal/tail work and did not reliably improve the pendulum overspeed problem.
- Status: Reverted; not committed.

## arc-release-coverage-diagnostics-65

- Baseline used: `arc-scarce-suffix-on-family-61` at commit `8231cc9`.
- Hypothesis: Before adding more candidate families, the compiler needs cheap visibility into whether viable candidates actually cover distinct downstream states. Release-speed spread, grounded support through the release probe, and airborne-at-release counts can identify whether the pool is missing braking/settling/grounded futures. This should be collected from existing engine validations and archived in compile stats without changing generation, ranking, scoring, golden specs, evaluator fingerprint, seed set, metric, or budget grid.
- Code changes made: Added diagnostic-only release metadata to viable `GapFit`s (`releaseGroundedFrames` and `releaseAirborne`) using the existing candidate detection window. Added handoff telemetry that summarizes scored viable candidates by release count, authored release-speed mean/min/max/std, grounded-frame mean/min/max, zero-grounded count, and airborne-at-release count, and included those fields in compact golden compile stats. Candidate generation, ranking, validation gates, scorer, and search policy are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-release-coverage-diagnostics-65`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.4` -> candidate `444.4`; `Δheadline = +0.0`, 95% CI `[0.0, 0.0]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: The run was behaviorally neutral at every budget: all per-budget deltas were `+0.0`, validity was unchanged, and the 200k worst rows were identical. The new release coverage fields showed that raw speed-state variety is not obviously absent: at 200k scored viable candidates averaged `4555.6` release observations per row, authored release-speed mean `0.895`, min `-0.225`, max `1.602`, and std `0.249`. Worst rows such as `drums_pendulum` still had wide release-speed ranges (for example seed 8 `-0.238..1.964`, std `0.455`) while remaining low-quality, suggesting the missing signal is next-state workability or selection among futures rather than simple release-speed range. Release grounded frames were tightly clustered around `6.60` frames and zero-grounded releases were absent, while airborne-at-release counts were high, so more detailed next-contact survivor diagnostics are needed.
- Status: Extended with next-preview coverage diagnostics in `arc-release-preview-diagnostics-66`; not committed standalone.

## arc-release-preview-diagnostics-66

- Baseline used: `arc-scarce-suffix-on-family-61` at commit `8231cc9`.
- Hypothesis: Release-state spread alone does not tell whether a candidate leaves the next contact workable. Record next-contact survivor counts from previews the search already computes, so future budget-aware proposal streams can scale coverage where candidates leave few or zero next-contact options. This should remain metadata-only: no new previews, no new simulations, and no changes to generation, ranking, scoring, golden specs, evaluator fingerprint, seed set, metric, or budget grid.
- Code changes made: Kept the release coverage diagnostics from attempt 65 and added handoff telemetry for existing previewed candidates: preview count, zero-next-survivor count, and first-survivor mean/min/max. Included these fields in compact golden compile stats. Candidate generation, ranking, validation gates, scorer, and search policy are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-release-preview-diagnostics-66`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.4` -> candidate `444.4`; `Δheadline = +0.0`, 95% CI `[0.0, 0.0]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: The run was behaviorally neutral at every budget with unchanged validity. The preview diagnostics showed that existing previewed candidates frequently leave no next-contact survivor: across canonical rows the zero-next-survivor rate was about `69.5%` at 25k and stayed near `70.1%` at 200k. Worst rows frequently had both low quality and high next-survivor scarcity; for example `drums_pendulum` seed 7 at 200k previewed `1007` candidates with `741` zero-next previews (`73.6%`), and `rhythm_ladder` seed 6 previewed `978` with `799` zero-next previews (`81.7%`). Release-speed range exists, but many viable current candidates are not catchable one beat later. Universal quality preview was previously too expensive, so a sparse budget/feedback-aware preview is the next mechanism to test.
- Status: Extended into the sparse quality-preview mechanism in `arc-budget-sparse-quality-preview-67`; not committed standalone.

## arc-budget-sparse-quality-preview-67

- Baseline used: `arc-scarce-suffix-on-family-61` at commit `8231cc9`.
- Hypothesis: The diagnostics show many viable current candidates have zero next-contact survivors, but universal quality preview starved search in an earlier attempt. Add only sparse quality-phase preview of the locally best candidates, with effort scaled smoothly by available budget and terminal-feedback scarcity. Low budgets and rows with enough unique full evaluations spend little or no extra preview work; higher budgets in scarce rows get one or two previewed top candidates so ranking can reject futures that immediately dead-end.
- Code changes made: Added `previewTopK` support to `rankedOptions`: after local scoring, the top K options can be rescored with the existing one-contact engine preview and then resorted. In quality expansion, K is `round(2 * smoothstep(targetBudget / (targetBudget + 150000)) * (1 / (1 + (unique_full_evaluations / 48)^2)))`, clamped to `0..2`. Existing contract preview behavior is unchanged. The release/preview diagnostic fields from attempts 65-66 remain in compile stats. Candidate generators, validation gates, scorer, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-sparse-quality-preview-67`
- Decide result: `VERDICT: REJECT`; baseline `444.4` -> candidate `424.1`; `Δheadline = -20.3`, 95% CI `[-28.5, -12.1]`, `P(Δ<=0)=100.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=-26.4`, `150k=-25.2`, `200k=-21.1`; validity was unchanged at every budget. The mechanism spent far less than universal quality preview but still starved terminal conversion: at 200k previewed candidates rose from no quality-preview diagnostics to `353.86` per row with `73.4%` zero-next previews, but unique full evaluations fell `241.61 -> 201.10` per row, full evaluations fell `403.31 -> 317.55` per row, and tail successes fell `39331 -> 31027`. Selected axis-quality candidates also fell slightly (`1635 -> 1584`). Largest 200k gains were `mini_burst` seed 4 (`+65.40`), `mini_burst` seed 2 (`+52.28`), `verse_chorus` seed 11 (`+48.88`), `dense_sprint` seed 10 (`+47.73`), and `verse_chorus` seed 2 (`+44.33`); broad regressions dominated, including `drums_swell` seed 7 (`-169.55`), `dense_sprint` seed 11 (`-165.15`), `drums_crescendo` seed 3 (`-142.14`), `drums_zigzag` seed 9 (`-139.68`), `drums_crosscut` seed 5 (`-135.87`), `drums_pendulum` seed 10 (`-115.60`), and `drums_crescendo` seed 8 (`-110.33`). Previewing even one or two top quality options changes branch ordering enough to reduce full-track evidence; next-contact workability likely needs to be addressed through proposal coverage or terminal scheduling, not extra preview ranking.
- Status: Reverted; not committed.

## arc-budget-tail-window-68

- Baseline used: `arc-scarce-suffix-on-family-61` at commit `8231cc9`.
- Hypothesis: Tail completion is the cheapest way the current search turns a locally viable prefix into a full-track future, but its fixed eight-contact window is budget-oblivious. Scale only the tail-completion contact window smoothly with scalar budget so low budgets remain essentially unchanged while larger budgets can complete slightly earlier prefixes. This should increase full-track evidence without adding preview ranking cost or changing candidate geometry/scoring.
- Code changes made: Added a smooth budget pressure `smoothstep(targetBudget / (targetBudget + 150000))` that expands the tail-completion contact window by up to two contacts, and used the same dynamic window to keep suffix repair from overlapping the tail-completion region. Candidate generators, validation gates, ranking/scoring, suffix repair caps, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged. The neutral release/preview diagnostic compile-stat fields from attempts 65-66 remain present.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-tail-window-68`
- Decide result: `VERDICT: ACCEPT`; baseline `444.4` -> candidate `444.8`; `Δheadline = +0.5`, 95% CI `[-0.4, 1.8]`, `P(Δ<=0)=18.9%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=+0.0`, `150k=+1.3`, `200k=+0.2`; validity was unchanged at every budget. The smooth window preserved the lower budgets and added the intended 9-contact tail completion only at larger budgets: at 150k tail attempts/successes rose `141.91/109.80 -> 145.16/111.70` per row, and at 200k `208.44/163.88 -> 212.08/165.93`. Unique full evaluations rose slightly (`158.11 -> 158.48` at 150k, `241.61 -> 242.24` at 200k), while duplicate full evaluations also rose (`107.78 -> 109.51` at 150k, `161.70 -> 163.56` at 200k), so some added work is redundant but the register still found better futures. The new 9-contact completions supplied most tail improvements at the affected budgets (`392` aggregate improvements at 150k, `429` at 200k), while reducing 7/8-contact improvement counts; this is a real scheduling shift rather than broad sampler churn. Largest 200k gains were `drums_tide` seed 4 (`+40.27`), `drums_crescendo` seed 6 (`+26.08`), `drums_dropout` seed 2 (`+18.55`), `dense_sprint` seed 7 (`+17.36`), and `drums_pendulum` seed 8 (`+15.37`). Largest 200k regressions were `verse_chorus` seed 3 (`-38.77`), `drums_pulse` seed 5 (`-37.01`), `drums_crescendo` seed 3 (`-16.05`), `drums_crosscut` seed 1 (`-13.90`), and `rhythm_ladder` seed 7 (`-13.89`). Aggregate axis shape was small and favorable on speed (`speed MAE 0.2148 -> 0.2142` at 200k), neutral on air/grain, and contact timing at 200k remained fully valid with worst rows still only `1` frame off. Additional-budget conversion still stalls on many rows: from 150k to 200k the candidate improved `92` rows, left `147` flat, and regressed `1`; worst rows remain `drums_pendulum` seeds with axis quality around `30-35%`. Preview diagnostics at 200k still show high next-contact scarcity (`~63.8%` zero-next among existing previews), so budget-aware terminal scheduling helps but does not solve missing downstream-workable proposal coverage.
- Status: Kept and committed as the new baseline.

## arc-quadratic-tail-window-69

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: Attempt 68 showed that a smooth budget-aware tail window can convert larger-budget work into better full-track evidence, but 200k still leaves many rows flat from 150k. Use a second-stage quadratic budget pressure so the mechanism remains unchanged through 100k, keeps the 9-contact region at 150k, and exposes 10-contact completion only when budget is high enough. This spends additional effort on full-track futures rather than preview ranking or local score penalties.
- Code changes made: Changed the dynamic tail-completion window from `base + 2 * pressure` to `base + 6 * pressure^2`, with the same smooth scalar pressure `smoothstep(targetBudget / (targetBudget + 150000))`. Candidate generators, validation gates, ranking/scoring, suffix repair caps, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-quadratic-tail-window-69`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.8` -> candidate `444.8`; `Δheadline = -0.1`, 95% CI `[-0.7, 0.4]`, `P(Δ<=0)=58.0%`.
- Notable regressions/improvements: The run was unchanged through 150k and only moved 200k (`493.0 -> 492.8`, `Δ=-0.2`), with validity unchanged. The extra 10-contact tail layer worked mechanically but displaced useful nearer-tail work: at 200k tail attempts/successes rose `212.08/165.93 -> 215.29/167.05` per row, but unique full evaluations fell `242.24 -> 241.20`, duplicate full evaluations rose `163.56 -> 164.62`, candidates sampled fell `8676.75 -> 8646.64`, and viable candidates fell `2454.81 -> 2445.59`. Aggregate 10-contact completions produced `565` successes and `413` improvements, but 9-contact improvements dropped `429 -> 143` and 8-contact improvements dropped `137 -> 37`, so the broader window mostly reordered terminal evidence rather than adding net quality. Largest 200k gains were `drums_pulse` seed 5 (`+37.01`), `verse_chorus` seed 3 (`+33.21`), `drums_signature` seed 8 (`+17.94`), and `syncopated_switchback` seed 2 (`+16.15`); largest regressions were `drums_swell` seed 7 (`-86.38`), `cold_start` seed 9 (`-27.45`), `drums_crescendo` seed 8 (`-15.94`), `drums_pendulum` seed 0 (`-15.31`), and `drums_tide` seed 2 (`-12.78`).
- Status: Reverted; not committed.

## arc-air-support-mode-70

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: The compiler has an `air_support` quality stream for low-air targets, but the mode currently uses the same geometry controls as normal sampling. Worst rows, especially `drums_pendulum`, show simultaneous positive air, speed, and grain error, so a low-air stream needs to expose a physically distinct settled-support future rather than just another random normal candidate.
- Code changes made: Added narrow `air_support` controls in `targetStateControls`: under low-air pressure the mode uses shorter segment length, modestly more speed-control pressure, slightly more uphill contact/pre/post angles, and a small grounded post-support floor/blend. Sample counts, stream eligibility, ranking/scoring, validation gates, budget scheduling, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-air-support-mode-70`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.8` -> candidate `444.3`; `Δheadline = -0.5`, 95% CI `[-3.2, 1.3]`, `P(Δ<=0)=66.1%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=-0.1`, `150k=-0.4`, `200k=-1.1`; validity was unchanged at every budget. The mode was active and made the stream physically distinct: at 200k `air_support` sampled/landed `4696/1414 -> 4823/1751`, with preclear rejects lower (`2939 -> 2718`). However it did not improve the intended aggregate axes: 200k air MAE worsened `0.1066 -> 0.1068`, speed MAE worsened `0.2142 -> 0.2149`, and only grain moved slightly better `0.0669 -> 0.0668`. Full-track throughput dipped (`full evaluations 405.80 -> 404.75`, unique full `242.24 -> 241.73`, tail successes `165.93 -> 165.42` per row). Largest 200k gains were real but isolated: `syncopated_switchback` seed 5 (`+77.71`), `drums_pendulum` seed 5 (`+38.37`), `syncopated_switchback` seed 8 (`+36.41`), and `syncopated_switchback` seed 2 (`+33.09`). Large regressions dominated: `syncopated_switchback` seed 11 (`-133.09`), `drums_pendulum` seed 10 (`-115.58`), `syncopated_switchback` seed 4 (`-42.04`), and `drums_pendulum` seed 7 (`-40.30`). The physical support family increased landability but created too much row-specific branch churn and made speed/air slightly worse overall.
- Status: Reverted; not committed.

## arc-budget-cadence-reuse-71

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: The worst rows are valid but often stuck in periodic/cadence patterns where a recent sled-relative catch may remain physically reusable. The compiler currently reuses only the latest catch. Let quality search occasionally validate one additional recent catch when scalar budget and repeated-cadence similarity are high, so the candidate pool gets a small, deterministic set of steady-state futures without changing geometry formulas or candidate scoring.
- Code changes made: Replaced fixed reuse depth with a base depth of one and a max depth of two. In quality search, a deterministic fractional scheduler computes `smoothstep(targetBudget / (targetBudget + 150000)) * repeated_cadence_pressure` and uses a node-stable hash to activate the second reuse candidate at that aggregate rate. Contract search keeps depth one. Candidate generation, validation gates, ranking/scoring, tail/suffix scheduling, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-cadence-reuse-71`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.8` -> candidate `443.6`; `Δheadline = -1.3`, 95% CI `[-4.8, 2.2]`, `P(Δ<=0)=77.0%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=-0.4`, `100k=-3.5`, `150k=-1.1`, `200k=-0.6`; validity was unchanged at every budget. The added reuse futures were active but too costly and disruptive: reuse attempts/successes rose `193.55/103.67 -> 227.84/121.95` at 100k, `294.98/155.27 -> 383.10/199.83` at 150k, and `392.12/203.92 -> 547.63/284.43` at 200k. That extra validation reduced terminal evidence instead of improving it: unique full evaluations fell `81.73 -> 79.41` at 100k, `158.48 -> 152.65` at 150k, and `242.24 -> 233.38` at 200k; tail successes also fell at all those budgets. Selected reuse rose only modestly (`9.64 -> 10.54` selected catches per row at 200k), while selected axis-quality fell (`6.77 -> 6.45`), indicating the extra reuse mostly displaced other futures. Largest 200k gains were large but unstable: `verse_chorus` seed 4 (`+122.81`), `opening_burst` seed 0 (`+119.17`), `drums_tide` seed 1 (`+81.68`), and `rhythm_ladder` seed 3 (`+71.08`). Regressions were similarly large: `syncopated_switchback` seed 11 (`-117.54`), `dense_sprint` seed 11 (`-76.76`), `verse_chorus` seed 10 (`-75.66`), `drums_swell` seed 2 (`-73.77`), and `drums_breath` seed 11 (`-73.44`). Older catch reuse is a real future family, but even deterministic budget/cadence activation over-locks rows and starves terminal/axis-quality search.
- Status: Reverted; not committed.

## arc-prune-air-support-stream-72

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: The current `air_support` quality stream is a semantic family that rarely survives selection but still consumes candidate attempts and participates in the scarce-family normal-sample reservation. In the accepted baseline at 200k it produced `4696` attempts and `1414` landings but only `12` selected axis-quality candidates across all canonical rows. Pruning this underused family should free quality search capacity for normal/speed futures and terminal conversion without changing scoring or validation.
- Code changes made: Removed the `air` entry from `HANDOFF_AXIS_QUALITY_STREAMS` and removed the now-unused air-support stream constants. The `air_support` sample mode remains defined for diagnostics/compatibility, but no quality stream currently emits it. Candidate geometry formulas, speed quality streams, validation gates, ranking/scoring, tail/suffix scheduling, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-prune-air-support-stream-72`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.8` -> candidate `444.4`; `Δheadline = -0.4`, 95% CI `[-2.9, 1.2]`, `P(Δ<=0)=63.2%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=-0.4`, `150k=+0.3`, `200k=-1.1`; validity was unchanged at every budget. The hypothesis was half right: pruning the stream reduced axis-quality attempts (`635.76 -> 616.85` per row at 200k) and slightly increased full-track evidence (`full evaluations 405.80 -> 406.45`, unique full `242.24 -> 242.66`, tail successes `165.93 -> 166.15`). However, aggregate quality got worse on every axis at 200k (`air MAE 0.1066 -> 0.1067`, speed `0.2142 -> 0.2151`, grain `0.0669 -> 0.0670`), and the rare useful air-support futures mattered in several rows. Largest 200k gains were `syncopated_switchback` seed 5 (`+77.71`), `drums_pendulum` seed 9 (`+21.12`), and `syncopated_switchback` seed 2 (`+19.01`); largest regressions were `drums_pendulum` seed 10 (`-115.58`), `syncopated_switchback` seed 11 (`-94.77`), and `drums_pendulum` seed 7 (`-40.30`). The stream is inefficient, but removing it loses some high-impact futures; a better mechanism would need to preserve rare useful low-air candidates while reducing their broad sampling cost.
- Status: Reverted; not committed.

## arc-air-support-additive-73

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: Attempt 72 showed that the `air_support` stream is inefficient but occasionally important. Instead of pruning it, keep the rare low-air futures but stop counting that one-sample stream when reserving normal candidate depth in scarce-feedback quality search. The speed streams, which dominate selected axis-quality candidates, should continue to reserve normal depth; air support becomes a small additive family that does not displace the normal/speed coverage that terminal search uses.
- Code changes made: Added `reserveNormalBudget?: boolean` to axis-quality stream policy and set the current `air_support` stream to `reserveNormalBudget: false`. `estimateAxisQualitySampleCount` now skips such streams when computing the scarce-family normal-sample reservation, while candidate generation still emits and scores the air-support candidates exactly as before. Candidate geometry formulas, stream eligibility, validation gates, ranking/scoring, tail/suffix scheduling, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-air-support-additive-73`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.8` -> candidate `445.0`; `Δheadline = +0.2`, 95% CI `[0.0, 1.2]`, `P(Δ<=0)=58.7%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=+0.0`, `150k=+0.7`, `200k=+0.0`; validity was unchanged at every budget. The mechanism was very narrow: 150k full evaluations were essentially flat (`267.99 -> 268.02` per row), axis-quality attempts were essentially flat (`446.86 -> 447.09`), and 200k was effectively unchanged. The entire visible score gain came from `drums_crescendo` seed 3 at 150k (`308.44 -> 435.57`, `+127.13`), with no meaningful 200k movement. Aggregate 150k axes moved slightly better on air/speed (`air MAE 0.1077 -> 0.1076`, speed `0.2205 -> 0.2200`) and flat on grain, but the paired decision did not accept the change. The result suggests the allocation tweak can unlock a rare terminal future, but the signal is too isolated to promote.
- Status: Reverted; not committed.

## arc-budget-farback-pulses-74

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: Far-back frontier pulses are an existing structural control for revisiting older valid prefixes once a weak passing output exists, but the pulse interval is budget-oblivious. At scarce budgets, frequent far-back pulses can steal work from terminal conversion; at larger budgets, the search can afford more revisit work. Scale the weakness-driven pulse frequency smoothly by scalar budget so low/mid budgets pulse less aggressively while high budgets retain most of the current behavior.
- Code changes made: Passed `targetBudget` into `farBackFrontierPulseInterval` and multiplied incumbent weakness by `0.55 + 0.45 * smoothstep(targetBudget / (targetBudget + 150000))` before mapping to the existing interval range. Candidate generation, validation gates, ranking/scoring, tail/suffix scheduling, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-farback-pulses-74`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.8` -> candidate `444.2`; `Δheadline = -0.6`, 95% CI `[-3.4, 2.2]`, `P(Δ<=0)=66.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=-0.4`, `100k=-0.5`, `150k=-1.0`, `200k=-0.4`; validity was unchanged at every budget. The smooth dampening reduced useful quality pressure instead of freeing work: at 200k axis-quality attempts/successes fell by about `2.9/2.3` per row, candidates sampled/viable fell by about `41.9/11.4`, and far-back pulses fell only `0.08` per row. Full evaluations rose slightly (`+1.6` per row at 200k) but did not convert into better quality, and aggregate 200k axis MAE was effectively unchanged. Largest 200k gains were `syncopated_switchback` seed 5 (`+77.71`), `drums_pendulum` seed 8 (`+52.68`), `drums_pendulum` seed 0 (`+42.03`), and `drums_pendulum` seed 9 (`+33.14`); largest regressions were `syncopated_switchback` seed 11 (`-94.77`), `drums_swell` seed 7 (`-86.38`), `drums_pendulum` seed 4 (`-70.30`), and `drums_tide` seed 4 (`-40.83`). Worst 200k candidate rows remained `drums_pendulum` seeds, with simultaneous air/speed error, so simply reducing revisit cadence is not the missing structural coverage.
- Status: Reverted; not committed.

## arc-budget-deep-next-speed-settle-75

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: The accepted next-speed settle stream helped by generating current catches shaped for the following speed target, but worst valid rows still overshoot speed and air on nearly every beat. Add a second, deeper next-speed settle proposal that targets a lower next-speed geometry state and is activated by the product of smooth overspeed pressure and smooth scalar-budget pressure. Use deterministic fractional activation per node so aggregate coverage scales smoothly with budget instead of appearing at one hard budget threshold.
- Code changes made: Added `budgetScaleFrames` to axis-quality stream policies, threaded `targetBudget` through quality candidate generation and the semantic sample-count estimate, and added deterministic fractional sample activation for budget-scaled policies only. Registered one budget-scaled next-speed `speed_drag` stream with a stronger below-target next-speed bias. Existing non-budget-scaled stream sample counts, candidate validation, ranking/scoring, contract search, tail/suffix scheduling, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-deep-next-speed-settle-75`
- Decide result: `VERDICT: INCONCLUSIVE`; baseline `444.8` -> candidate `445.8`; `Δheadline = +1.0`, 95% CI `[-3.7, 5.1]`, `P(Δ<=0)=31.3%`.
- Notable regressions/improvements: Per-budget deltas were `25k=-0.0`, `50k=-0.5`, `100k=-2.7`, `150k=+0.7`, `200k=+3.5`; validity was unchanged at every budget. The added family was active and directionally useful at high budget, but came on too early: speed-drag samples/landings rose by `+4,539/+1,520` at 100k, `+10,694/+3,450` at 150k, and `+17,428/+5,472` at 200k. Terminal evidence dropped as the stream grew (`unique full evaluations -2.90` per row at 100k, `-9.29` at 150k, `-13.75` at 200k), with the 200k score still improving but 100k regressing. Largest 200k gains were `syncopated_switchback` seed 2 (`+100.59`), `verse_chorus` seed 2 (`+75.95`), `mini_burst` seed 5 (`+72.96`), `drums_tide` seed 7 (`+72.44`), and `dense_sprint` seed 0 (`+72.15`); largest 200k regressions were `drums_swell` seed 7 (`-118.94`), `syncopated_switchback` seed 11 (`-67.14`), `drums_dropout` seed 5 (`-63.93`), and `drums_tide` seed 6 (`-62.31`). Largest 100k regressions were full-feedback starvation rows such as `drums_dropout` seed 5 (`-196.14`), `drums_swell` seed 0 (`-190.85`), and `drums_tide` seed 6 (`-171.58`). The next variant should keep the high-budget future but gate it on terminal-feedback maturity, not budget alone.
- Status: Not kept; modified into the narrower `arc-budget-mature-deep-settle-76` attempt.

## arc-budget-mature-deep-settle-76

- Baseline used: `arc-budget-tail-window-68` at commit `4de083d`.
- Hypothesis: Attempt 75 showed the deeper next-speed settle future is useful at 200k but harmful when it starts before enough terminal evidence exists. Keep the same structural proposal, but require smooth terminal-feedback maturity using unique full evaluations, so the extra future appears only when the row has enough full-track evidence for quality search to absorb another semantic stream.
- Code changes made: Added `fullFeedbackScale` to axis-quality stream policies and multiplied the budget-scaled deep-settle activation by `smoothstep(unique_full_evaluations / (unique_full_evaluations + 48))`. The new maturity gate applies only to the deep next-speed settle policy. Existing non-budget-scaled stream sample counts, candidate validation, ranking/scoring, contract search, tail/suffix scheduling, diagnostics, golden specs, evaluator fingerprint, seed set, metric, and budget grid are unchanged.
- Golden command: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/arc-budget-mature-deep-settle-76`
- Decide result: `VERDICT: ACCEPT`; baseline `444.8` -> candidate `445.9`; `Δheadline = +1.1`, 95% CI `[-1.0, 3.6]`, `P(Δ<=0)=15.6%`.
- Notable regressions/improvements: Per-budget deltas were `25k=+0.0`, `50k=+0.0`, `100k=+0.1`, `150k=+0.1`, `200k=+2.8`; validity was unchanged at every budget. The maturity gate preserved the high-budget effect while removing attempt 75's mid-budget damage: speed-drag samples/landings rose by only `+1,560/+521` at 100k, `+4,870/+1,421` at 150k, and `+8,718/+2,556` at 200k. Terminal evidence still dropped at high budget (`unique full evaluations -6.31` per row at 150k and `-10.50` at 200k), but the row tradeoff improved enough for the paired decision to accept. At 200k, raw score moved `496.25 -> 499.15`, changed rows were `108/240`, and only `2` rows regressed in the run summary. Largest 200k gains were `verse_chorus` seed 3 (`+144.29`), `syncopated_switchback` seed 5 (`+75.79`), `mini_burst` seed 5 (`+72.96`), `dense_sprint` seed 0 (`+72.15`), `drums_tide` seed 1 (`+65.76`), and `syncopated_switchback` seed 2 (`+52.78`). Largest 200k regressions were `syncopated_switchback` seed 11 (`-74.80`), `drums_swell` seed 7 (`-65.80`), `drums_tide` seed 11 (`-64.09`), and `drums_dropout` seed 4 (`-45.01`). Weighted-row gains were led by `syncopated_switchback` seed 2 (`+59.66`), `verse_chorus` seed 3 (`+54.97`), and `syncopated_switchback` seed 5 (`+44.92`); weighted regressions were led by `drums_tide` seed 11 (`-42.73`) and `opening_burst` seed 9 (`-40.81`). Aggregate axis means barely moved after rounding, so the win is from a small number of better high-budget futures rather than a global axis distribution shift.
- Status: Kept and committed as the new baseline.
