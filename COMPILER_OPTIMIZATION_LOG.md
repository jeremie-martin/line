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
