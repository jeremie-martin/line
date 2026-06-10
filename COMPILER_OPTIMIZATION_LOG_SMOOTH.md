# Compiler Optimization Log - Smooth Controls

Goal: raise canonical HEADLINE using only canonical-golden validation. One scoped
mechanism at a time; keep only canonical `npm run decide` ACCEPTs after this
first post-rebase baseline.

## baseline-impact-curve-start25-env-rerun-01

- Current baseline: `7ef1471` (`Retune impact curve ramp for envelope-ruler targets`).
- Mechanism already in HEAD after rebase: impact-curve target pressure start
  `0.45 -> 0.25`, so envelope-capped impact targets around `0.45..0.65` get
  continuous curvature authority instead of near-zero pressure.
- Run: `generated/golden-runs/impact-curve-start25-env-rerun-01`.
- Verdict: first smooth-campaign baseline; no `decide` needed per user.
- Canonical: HEADLINE `514.30`; budgets `50k 343.28`, `100k 509.78`,
  `200k 530.13`, `300k 533.76`; validity `1898/1920`, `300k 480/480`;
  fingerprint `4af34575a3f7`.
- Diagnostics: prior same-fingerprint archive `baseline-smooth-8743d21` was
  `494.04` with budgets `330.11/490.86/507.97/513.14`; current run is the
  baseline for the next canonical decision.

## dense-grain-cap-smooth-01

- Mechanism: arc placement dense-grain post-length cap.
- Continuous replacement: boolean `grain >= 0.50 && nextGap <= 14` cap became a
  smooth grain/spacing pressure, lerping from uncapped `220px` to the dense cap.
- Run: `generated/golden-runs/dense-grain-cap-smooth-01`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.3`, all budget deltas
  `+0.0`, validity unchanged.
- Impact: exact no-op on canonical rows; likely no canonical target sits in the
  newly smoothed boundary band.
- Status: rejected and reverted; next try should target an active impact/geometry
  threshold.

## redir-contact-target-pressure-smooth-01

- Mechanism: impact redirection contact-angle target pressure.
- Continuous replacement: old `0.55..0.90` target activation became zero-based
  smooth pressure with full authority by `0.65`.
- Run: `generated/golden-runs/redir-contact-target-pressure-smooth-01`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 513.6`, deltas `50k +0.0`,
  `100k +0.0`, `200k -1.1`, `300k -0.8`; validity unchanged.
- Diagnostics: real but mixed movement; average spec gains included
  `canyon_steps +13.020`, `glide_stairs +7.186`, while losses included
  `dense_echo_climb -8.843`, `ridge_pulse -7.817`.
- Status: rejected; broad zero-based ramp likely over-drove soft targets. Trying
  narrower `0.35..0.65` ramp as `redir-contact-target-pressure-band-02`.

## redir-contact-target-pressure-band-02

- Mechanism: same contact-angle target pressure.
- Continuous replacement: old `0.55..0.90` target activation became a narrower
  `0.35..0.65` smooth ramp.
- Run: `generated/golden-runs/redir-contact-target-pressure-band-02`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.4`, delta `+0.1`,
  CI `[-2.2, 2.2]`, `P(delta<=0)=46.2%`; per-budget deltas `+0.0`, `+0.0`,
  `-0.5`, `+0.5`; validity unchanged.
- Diagnostics: weighted spec gains included `tiny_dance +13.829`,
  `drums_zigzag +7.131`; losses included `float_bounds -11.961`,
  `skyline_push -6.333`.
- Status: rejected; slight positive mean is not an ACCEPT. Trying final tighter
  `0.45..0.65` core-target ramp as `redir-contact-target-pressure-core-03`.

## redir-contact-target-pressure-core-03

- Mechanism: same contact-angle target pressure.
- Continuous replacement: old `0.55..0.90` target activation became a tight
  `0.45..0.65` smooth ramp.
- Run: `generated/golden-runs/redir-contact-target-pressure-core-03`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.1`, delta `-0.2`,
  CI `[-2.0, 1.5]`; per-budget deltas `+0.0`, `+0.0`, `-0.5`, `-0.1`;
  validity unchanged.
- Status: rejected and reverted with the contact-target mechanism dropped.

## arc-len-room-smoothstep-01

- Mechanism: arc-length room gating for long ride-out authority.
- Continuous replacement: linear room ramp between dense/sparse gap frames became
  `smoothstep` with the same `26..46` frame anchors.
- Run: `generated/golden-runs/arc-len-room-smoothstep-01`.
- Decide: `VERDICT: INCONCLUSIVE`; headline `514.3 -> 514.6`, delta `+0.3`,
  CI `[-2.3, 2.3]`; per-budget deltas `-8.8`, `+0.9`, `+0.9`, `+1.2`.
- Diagnostics: high budgets improved, but 50k validity/score regressed
  (`343.3 -> 334.4`, valid `96% -> 95%`).
- Status: rejected; trying budget-smoothed variant that preserves the old linear
  room at 50k and reaches smooth room by 100k.

## arc-len-room-smoothstep-budget-02

- Mechanism: same arc-length room gating.
- Continuous replacement: blend old linear room to smooth room by compile budget;
  50k stays linear, 100k+ gets smooth room.
- Run: `generated/golden-runs/arc-len-room-smoothstep-budget-02`.
- Decide: `VERDICT: ACCEPT`; headline `514.3 -> 515.2`, delta `+0.9`,
  CI `[-0.2, 2.2]`, `P(delta<=0)=5.4%`.
- Per-budget deltas: `50k +0.0`, `100k +0.9`, `200k +0.9`, `300k +1.2`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: accepted; this archive becomes the next official comparison baseline.

## high-air-length-pressure-smooth-01

- Mechanism: high-air length-blend pressure for air-targeted grounded ride-out.
- Continuous replacement: linear clamped high-air pressure became `smoothstep`
  over the same `0.68..0.92` air band.
- Run: `generated/golden-runs/high-air-length-pressure-smooth-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: REJECT`; headline `515.2 -> 513.4`, delta `-1.9`,
  CI `[-4.9, 0.7]`.
- Per-budget deltas: `50k -21.5`, `100k -0.9`, `200k +0.1`, `300k -0.3`;
  50k validity dropped `96% -> 95%`.
- Status: rejected and reverted; smoothing this pressure under-serves scarce
  high-air ride-out length.

## sustained-carry-pressure-smooth-01

- Mechanism: sustained contact-carry pressure for very short next gaps and low air.
- Continuous replacement: linear clamped next-gap and air-fade pressures became
  `smoothstep` over the same bands.
- Run: `generated/golden-runs/sustained-carry-pressure-smooth-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 514.0`, delta `-1.3`,
  CI `[-6.1, 0.8]`.
- Per-budget deltas: `50k -4.2`, `100k -6.3`, `200k +0.1`, `300k +0.0`;
  100k validity dropped `100% -> 99%`.
- Status: rejected; trying budget-gated smooth carry that preserves 50k/100k
  linear behavior and only smooths 200k+.

## sustained-carry-pressure-budget-smooth-02

- Mechanism: same sustained contact-carry pressure.
- Continuous replacement: blend old linear pressure to smooth pressure by compile
  budget; 50k/100k stay linear, 200k+ use smooth pressure.
- Run: `generated/golden-runs/sustained-carry-pressure-budget-smooth-02`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 515.3`, delta `+0.0`,
  CI `[-0.2, 0.3]`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.1`, `300k +0.0`;
  validity unchanged.
- Status: rejected and reverted; high-budget-only effect is too small to keep.

## dense-contact-pressure-smooth-01

- Mechanism: dense next-contact pressure in the active contact-centered generator.
- Continuous replacement: linear clamped dense pressure over the same next-gap band
  became `smoothstep`.
- Run: `generated/golden-runs/dense-contact-pressure-smooth-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 514.9`, delta `-0.4`,
  CI `[-7.1, 8.1]`.
- Per-budget deltas: `50k -17.4`, `100k +12.0`, `200k -0.9`, `300k -1.3`;
  validity dropped `1898/1920 -> 1896/1920`.
- Status: rejected; trying a budget window because the only useful signal is at
  100k.

## dense-contact-pressure-budget-window-02

- Mechanism: same dense next-contact pressure.
- Continuous replacement: blend linear dense pressure to smooth dense pressure by
  compile budget; 50k and 200k+ remain linear, 100k gets the smooth pressure.
- Run: `generated/golden-runs/dense-contact-pressure-budget-window-02`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 517.1`, delta `+1.8`,
  CI `[-0.5, 7.8]`, `P(delta<=0)=31.4%`.
- Per-budget deltas: `50k +0.0`, `100k +12.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged.
- Status: rejected; positive but not accepted, with effect isolated to one budget.

## dense-contact-pressure-budget-window-boost-03

- Mechanism: same dense next-contact pressure.
- Continuous replacement: same 100k-only budget window, but with a `1.25x` blend
  gain to test whether the 100k signal could be strengthened.
- Run: `generated/golden-runs/dense-contact-pressure-budget-window-boost-03`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 514.1`, delta `-1.2`,
  CI `[-9.6, 6.1]`.
- Per-budget deltas: `50k +0.0`, `100k -7.7`, `200k +0.0`, `300k +0.0`;
  100k validity dropped `100% -> 99%`.
- Status: rejected and reverted; dense-contact smoothing is too unstable to keep.

## deadline-pressure-smooth-01

- Mechanism: short-current-gap deadline pressure in the active contact-centered
  generator.
- Continuous replacement: linear clamped deadline pressure over the same `18..8`
  frame band became `smoothstep`.
- Run: `generated/golden-runs/deadline-pressure-smooth-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 515.3`, delta `+0.0`,
  CI `[-1.2, 1.3]`.
- Per-budget deltas: `50k +0.1`, `100k +0.1`, `200k +0.0`, `300k -0.0`;
  validity unchanged.
- Status: rejected and reverted; effect is too small to keep or tune.

## speed-carry-pressure-smooth-01

- Mechanism: speed-carry pressure rise/fade in the active contact-centered
  generator.
- Continuous replacement: linear clamped target-speed carry rise and high-speed
  fade became `smoothstep` over the same speed bands.
- Run: `generated/golden-runs/speed-carry-pressure-smooth-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 514.6`, delta `-0.7`,
  CI `[-6.5, 5.4]`.
- Per-budget deltas: `50k -21.0`, `100k +4.9`, `200k +0.5`, `300k +0.1`;
  50k validity dropped `96% -> 95%`.
- Status: rejected; trying budget-gated variant to preserve 50k behavior.

## speed-carry-pressure-budget-smooth-02

- Mechanism: same speed-carry pressure.
- Continuous replacement: blend linear carry pressure to smooth carry pressure by
  compile budget; 50k stays linear, 100k+ gets smooth carry.
- Run: `generated/golden-runs/speed-carry-pressure-budget-smooth-02`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 516.2`, delta `+0.9`,
  CI `[-4.3, 7.1]`, `P(delta<=0)=37.3%`.
- Per-budget deltas: `50k +0.0`, `100k +4.9`, `200k +0.5`, `300k +0.1`;
  validity unchanged.
- Status: rejected and reverted; positive but far below accept confidence.

## fwd-eval-rank-budget-blend-01

- Mechanism: handoff candidate ranker transition from local cost to true forward
  score.
- Continuous replacement: replaced the abrupt forward-eval ranker switch with a
  budget `smoothstep` blend from local score to forward score.
- Run: `generated/golden-runs/fwd-eval-rank-budget-blend-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: REJECT`; headline `515.2 -> 508.2`, delta `-7.0`,
  CI `[-9.0, -5.3]`.
- Per-budget deltas: `50k +0.0`, `100k -45.5`, `200k +0.0`, `300k +0.0`;
  validity unchanged.
- Status: rejected and reverted; the partial local/forward blend destroys the
  100k ranker, so the existing hard switch stays.

## speed-error-pressure-smooth-01

- Mechanism: contact-centered speed-error pressure for braking/acceleration bias.
- Continuous replacement: linear clamped brake and acceleration pressures became
  `smoothstep` over the same speed-error band.
- Run: `generated/golden-runs/speed-error-pressure-smooth-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: REJECT`; headline `515.2 -> 506.3`, delta `-9.0`,
  CI `[-17.5, -1.9]`.
- Per-budget deltas: `50k +3.6`, `100k -15.5`, `200k -8.6`, `300k -9.2`;
  100k validity dropped `100% -> 99%`.
- Status: rejected and reverted; smoothing speed-error pressure broadly weakens
  mid/high-budget contact placement.

## cc-span-blend-smoothstep-01

- Mechanism: contact-centered launch/length attempt-span grid.
- Continuous replacement: eased each diagonal/anti-diagonal blend coordinate with
  `smoothstep`, preserving endpoints and the same 16-point grid topology.
- Run: `generated/golden-runs/cc-span-blend-smoothstep-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 515.1`, delta `-0.1`,
  CI `[-4.8, 5.4]`.
- Per-budget deltas: `50k -9.5`, `100k +4.4`, `200k -0.2`, `300k -0.0`;
  50k validity dropped `96% -> 95%`.
- Status: rejected and reverted; eased span positions do not improve the weighted
  curve and hurt scarce-budget completion.

## start-support-offset-pressure-01

- Mechanism: startup support start-speed offsets for low-air first contacts.
- Continuous replacement: replaced the abrupt low-air offset set switch with a
  smooth pressure that fades side speed offsets to the center speed across the
  existing low-air transition band.
- Run: `generated/golden-runs/start-support-offset-pressure-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 515.3`, delta `+0.0`,
  CI `[-0.3, 0.5]`.
- Per-budget deltas: `50k +0.1`, `100k -0.1`, `200k +0.1`, `300k +0.0`;
  validity unchanged.
- Status: rejected and reverted; effect is too small and seed-hungry to keep.

## impact-template-pressure-lanes-01

- Mechanism: impact redirect-catch template lane admission.
- Continuous replacement: made template lanes default-on only through smooth
  impact-pressure, budget, and attempt ramps; deterministic lane density replaced
  the hard pressure/attempt/modulo gate, with 50k/100k protected by budget pressure.
- Run: `generated/golden-runs/impact-template-pressure-lanes-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 516.5`, delta `+1.2`,
  CI `[-0.7, 3.1]`, `P(delta<=0)=10.0%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +2.0`, `300k +1.3`;
  validity unchanged.
- Status: not kept; strong positive miss, tried a denser lane formulation.

## impact-template-pressure-lanes-density-02

- Mechanism: same impact template lane admission.
- Continuous replacement: increased maximum smooth lane density from roughly one
  third to one half of eligible mature pressured attempts.
- Run: `generated/golden-runs/impact-template-pressure-lanes-density-02`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 516.1`, delta `+0.8`,
  CI `[-1.2, 2.8]`, `P(delta<=0)=19.9%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.3`, `300k +0.9`;
  validity unchanged.
- Status: not kept; more lanes weakened the signal, tried a tighter impact ramp.

## impact-template-pressure-targeted-03

- Mechanism: same impact template lane admission.
- Continuous replacement: restored one-third maximum lane density and narrowed the
  smooth impact-pressure ramp so marginal impact beats receive fewer lanes.
- Run: `generated/golden-runs/impact-template-pressure-targeted-03`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 516.4`, delta `+1.2`,
  CI `[-0.7, 3.1]`, `P(delta<=0)=10.4%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +1.9`, `300k +1.3`;
  validity unchanged.
- Status: rejected and reverted after three canonical attempts; the mechanism is
  promising but does not meet the accept gate at canonical seed count.

## terminal-polish-budget-ramp-01

- Mechanism: terminal clone-and-test polish admission in handoff search.
- Continuous replacement: default polish admission changed from hard off to a
  budget-ramped smooth deterministic density, off below 150k and reaching full
  density by 300k.
- Run: `generated/golden-runs/terminal-polish-budget-ramp-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: INCONCLUSIVE`; headline `515.2 -> 515.2`, delta `-0.0`,
  CI `[-0.1, 0.0]`, `P(delta<=0)=76.4%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k -0.0`;
  validity unchanged.
- Status: rejected and reverted; the extra terminal polish work is effectively
  neutral and slightly negative at canonical precision.

## quality-far-back-weakness-smooth-01

- Mechanism: far-back quality repair pulse interval after a passing output exists.
- Continuous replacement: eased incumbent axis-weakness pressure with `smoothstep`
  before mapping it to the existing `16..128` frontier pulse interval.
- Run: `generated/golden-runs/quality-far-back-weakness-smooth-01`.
- Decide against accepted baseline `arc-len-room-smoothstep-budget-02`:
  `VERDICT: ACCEPT`; headline `515.2 -> 515.4`, delta `+0.1`,
  CI `[-0.0, 0.3]`, `P(delta<=0)=3.3%`.
- Per-budget deltas: `50k -0.0`, `100k -0.0`, `200k +0.1`, `300k +0.2`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: accepted; this archive becomes the next official comparison baseline.

## short-deadline-rescue-fade-01

- Mechanism: short-deadline rescue candidate count for required contact gaps.
- Continuous replacement: preserved full rescue below the existing 12-frame cutoff
  but replaced the hard cliff with a smooth fade-out through 16 frames.
- Run: `generated/golden-runs/short-deadline-rescue-fade-01`.
- Decide against accepted baseline `quality-far-back-weakness-smooth-01`:
  `VERDICT: REJECT`; headline `515.4 -> 498.9`, delta `-16.5`,
  CI `[-42.2, 0.0]`.
- Per-budget deltas: `50k -33.0`, `100k -49.8`, `200k -20.1`, `300k -0.2`;
  validity dropped `1898/1920 -> 1879/1920`.
- Status: rejected and reverted; widening the near-deadline rescue band burns
  scarce-budget completion and should stay as a hard narrow rescue.

## far-back-lag-pressure-01

- Mechanism: far-back quality frontier lag eligibility.
- Continuous replacement: replaced hard `lag >= 3` admission with smooth
  deterministic lag pressure, keeping lag-3+ fully eligible and admitting lag-2
  at partial density.
- Run: `generated/golden-runs/far-back-lag-pressure-01`.
- Decide against accepted baseline `quality-far-back-weakness-smooth-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.4 -> 515.4`, delta `+0.0`,
  CI `[0.0, 0.0]`.
- Per-budget deltas all `+0.0`; validity unchanged.
- Status: rejected and reverted; canonical rows never used the newly admitted
  lag-2 pulses.

## brake-extra-pressure-01

- Mechanism: brake-catch extra candidate count at high overspeed.
- Continuous replacement: replaced the abrupt base/high brake count step with
  deterministic smooth overspeed density for the one extra brake probe.
- Run: `generated/golden-runs/brake-extra-pressure-01`.
- Decide against accepted baseline `quality-far-back-weakness-smooth-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.4 -> 516.8`, delta `+1.4`,
  CI `[-1.0, 6.2]`, `P(delta<=0)=21.6%`.
- Per-budget deltas: `50k +4.1`, `100k +7.3`, `200k +0.1`, `300k -0.2`;
  validity improved `1898/1920 -> 1900/1920`.
- Status: not kept; strong low-budget signal but high-budget drag, tried a
  low-budget fade.

## brake-extra-low-budget-pressure-02

- Mechanism: same brake extra candidate count.
- Continuous replacement: multiplied the smooth extra-probe density by a budget
  fade, full through 100k and off by 200k.
- Run: `generated/golden-runs/brake-extra-low-budget-pressure-02`.
- Decide against accepted baseline `quality-far-back-weakness-smooth-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.4 -> 516.6`, delta `+1.3`,
  CI `[-0.8, 5.9]`, `P(delta<=0)=20.3%`.
- Per-budget deltas: `50k +4.1`, `100k +7.3`, `200k -0.2`, `300k -0.3`;
  validity improved `1898/1920 -> 1900/1920`.
- Status: not kept; fade accidentally removed the original high-overspeed extra
  at high budgets, tried baseline-preserving formulation.

## brake-extra-low-budget-pressure-03

- Mechanism: same brake extra candidate count.
- Continuous replacement: preserved the original high-overspeed extra probe at
  every budget, and only admitted sub-threshold extra probes through smooth
  low-budget overspeed pressure.
- Run: `generated/golden-runs/brake-extra-low-budget-pressure-03`.
- Decide against accepted baseline `quality-far-back-weakness-smooth-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.4 -> 516.8`, delta `+1.4`,
  CI `[-0.6, 6.1]`, `P(delta<=0)=12.3%`.
- Per-budget deltas: `50k +4.1`, `100k +7.3`, `200k +0.0`, `300k +0.0`;
  validity improved `1898/1920 -> 1900/1920`.
- Status: rejected and reverted after three attempts; this is a promising
  canonical near-miss but not an ACCEPT at current seed count.

## tail-window-boundary-pressure-01

- Mechanism: near-tail completion contact-window admission.
- Continuous replacement: kept all contact counts below the existing
  `tailCompletionContactWindow` fully admitted, but replaced the hard integer
  boundary with deterministic smooth fractional admission for the next remaining
  contact count.
- Run: `generated/golden-runs/tail-window-boundary-pressure-01`.
- Decide against accepted baseline `quality-far-back-weakness-smooth-01`:
  `VERDICT: ACCEPT`; headline `515.4 -> 515.6`, delta `+0.3`,
  CI `[-0.1, 0.7]`, `P(delta<=0)=6.2%`.
- Per-budget deltas: `50k +0.1`, `100k +0.0`, `200k +0.2`, `300k +0.4`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: accepted; this archive becomes the next official comparison baseline.

## tail-quality-branch-pressure-01

- Mechanism: quality near-tail completion branch breadth.
- Continuous replacement: kept the existing two fallback branches by default and
  admitted one extra quality tail-completion branch through a smooth high-budget
  deterministic density, off below 150k and full by 300k.
- Run: `generated/golden-runs/tail-quality-branch-pressure-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.6`, delta `-0.0`,
  CI `[-0.2, 0.1]`, `P(delta<=0)=67.2%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.0`, `300k -0.0`;
  validity unchanged.
- Status: rejected and reverted; extra quality tail branching adds cost without a
  measurable canonical gain after the accepted window-boundary smoothing.

## contract-reuse-scarcity-pressure-01

- Mechanism: contract-phase catch reuse candidate breadth.
- Continuous replacement: kept the existing one reuse candidate by default and
  admitted one extra contract reuse candidate through a smooth low-budget
  scarcity pressure, strongest at 50k and fading out by 200k.
- Run: `generated/golden-runs/contract-reuse-scarcity-pressure-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.3`, delta `-0.3`,
  CI `[-2.4, 2.1]`, `P(delta<=0)=64.2%`.
- Per-budget deltas: `50k -5.1`, `100k +0.5`, `200k +0.0`, `300k +0.0`;
  validity dropped one row overall (`1898/1920 -> 1897/1920`).
- Status: rejected and reverted; extra low-budget contract reuse can steal scarce
  completion budget even though it gives a small 100k lift.

## dense-spacing-cap-pressure-01

- Mechanism: contact-centered dense-spacing post-length cap in arc placement.
- Continuous replacement: replaced the hard grain/next-contact cap predicate with
  a smooth pressure that blends from no cap to the dense-spacing cap near the
  existing `grain >= 0.50` and `nextGapFrames <= 14` thresholds.
- Run: `generated/golden-runs/dense-spacing-cap-pressure-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.6`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=100.0%`.
- Per-budget deltas all `+0.0`; validity unchanged.
- Status: rejected and reverted; canonical rows do not exercise the marginal
  dense-spacing cap boundary.

## contract-breadth-fractional-count-01

- Mechanism: budget-aware contract candidate count rounding.
- Continuous replacement: kept the existing projected breadth reduction, but
  replaced hard integer rounding with deterministic fractional admission per
  search node.
- Run: `generated/golden-runs/contract-breadth-fractional-count-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 516.0`, delta `+0.4`,
  CI `[-2.4, 5.0]`, `P(delta<=0)=49.1%`.
- Per-budget deltas: `50k -8.5`, `100k +6.5`, `200k +0.0`, `300k +0.0`;
  validity dropped `1898/1920 -> 1897/1920`.
- Status: not kept; promising 100k lift but it harms scarce-budget completion,
  so tried a 50k-protected ramp.

## contract-breadth-fractional-count-02

- Mechanism: same budget-aware contract candidate count rounding.
- Continuous replacement: preserved old rounded counts at 50k and ramped
  fractional-count smoothing from 75k to 125k.
- Run: `generated/golden-runs/contract-breadth-fractional-count-02`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: REJECT`; headline `515.6 -> 487.5`, delta `-28.2`,
  CI `[-55.8, -9.4]`, `P(delta<=0)=100.0%`.
- Per-budget deltas: `50k -127.0`, `100k -71.8`, `200k -13.5`, `300k -6.9`;
  validity dropped `1898/1920 -> 1846/1920`, including one 300k error row.
- Status: rejected and reverted; fractionalizing the contract breadth count is
  too unstable because small count perturbations redirect the DFS basin.

## preview-scarcity-prior-01

- Mechanism: local handoff preview survivor-scarcity scoring.
- Continuous replacement: preserved the zero-survivor penalty exactly but added a
  small deterministic prior to the survivor denominator, smoothing the jump from
  zero survivors to one survivor in the preview ranker.
- Run: `generated/golden-runs/preview-scarcity-prior-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.6`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=100.0%`.
- Per-budget deltas all `+0.0`; validity unchanged.
- Status: rejected and reverted; canonical rows either did not alter selected
  plans or the ranker adjustment was too small to cross any selected boundary.

## rescue-startup-fractional-count-01

- Mechanism: dead-end rescue startup-weighted candidate count and rescue pool.
- Continuous replacement: replaced hard rounded startup rescue extras with
  deterministic fractional admission per rescue node for both candidate count and
  pool size.
- Run: `generated/golden-runs/rescue-startup-fractional-count-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.9`, delta `+0.3`,
  CI `[-0.0, 1.7]`, `P(delta<=0)=58.8%`.
- Per-budget deltas: `50k +4.2`, `100k -0.0`, `200k +0.0`, `300k +0.0`;
  validity improved one row overall (`1898/1920 -> 1899/1920`).
- Status: not kept; the lift came from a very small number of 50k rescue-path
  rows, with a small 100k regression, so tried a scarce-budget-only variant.

## rescue-startup-fractional-count-02

- Mechanism: same dead-end rescue startup-weighted count/pool.
- Continuous replacement: kept fractional rescue admission at 50k but faded back
  to the original rounded counts by 100k, preserving 100k+ behavior.
- Run: `generated/golden-runs/rescue-startup-fractional-count-02`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.9`, delta `+0.3`,
  CI `[-0.0, 1.7]`, `P(delta<=0)=58.8%`.
- Per-budget deltas: `50k +4.2`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity improved one row overall (`1898/1920 -> 1899/1920`).
- Status: rejected and reverted; promising scarce-budget near-miss, but the
  effect is concentrated in too few rows to pass the canonical accept gate.

## brake-high-overspeed-smooth-count-01

- Mechanism: brake-catch high-overspeed extra probe count.
- Continuous replacement: kept the existing brake offer rules but smoothed the
  hard jump from base count to high-overspeed count with deterministic fractional
  admission around the `1.15x` speed-ratio boundary.
- Run: `generated/golden-runs/brake-high-overspeed-smooth-count-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 516.0`, delta `+0.4`,
  CI `[-0.1, 1.6]`, `P(delta<=0)=19.8%`.
- Per-budget deltas: `50k +4.3`, `100k +0.4`, `200k -0.1`, `300k -0.0`;
  validity improved one row overall (`1898/1920 -> 1899/1920`).
- Status: not kept; positive but slight 200k drag, so tried a low-budget fade.

## brake-high-overspeed-smooth-count-02

- Mechanism: same high-overspeed extra probe count.
- Continuous replacement: kept the fractional count smoothing at low budgets and
  faded back to the original hard count by 200k.
- Run: `generated/golden-runs/brake-high-overspeed-smooth-count-02`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 516.0`, delta `+0.4`,
  CI `[-0.0, 1.9]`, `P(delta<=0)=14.4%`.
- Per-budget deltas: `50k +4.3`, `100k +0.4`, `200k +0.0`, `300k +0.0`;
  validity improved one row overall (`1898/1920 -> 1899/1920`).
- Status: not kept; best brake-count near-miss, but still not an ACCEPT, so tried
  one broader offer-gate smoothing.

## brake-high-overspeed-smooth-count-03

- Mechanism: brake high-overspeed offer/count boundary for higher target speeds.
- Continuous replacement: smoothed the higher-target offer gate below `1.15x` and
  the extra count above it, with the same low-budget fade back to baseline by 200k.
- Run: `generated/golden-runs/brake-high-overspeed-smooth-count-03`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.0`, delta `-0.6`,
  CI `[-3.1, 0.1]`, `P(delta<=0)=66.4%`.
- Per-budget deltas: `50k -8.7`, `100k +0.3`, `200k +0.0`, `300k +0.0`;
  validity dropped `1898/1920 -> 1896/1920`.
- Status: rejected and reverted; smoothing the high-target offer gate admits too
  much scarce-budget brake work. The safer count-only low-budget variant remains a
  near-miss but not canonical-accepted.

## quality-pool-extra-pressure-01

- Mechanism: quality-phase normal candidate pool boundary.
- Continuous replacement: kept contract search unchanged, but after a valid
  completion admitted one extra normal candidate into the quality scored pool
  through a smooth budget/full-feedback deterministic density.
- Run: `generated/golden-runs/quality-pool-extra-pressure-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.6`, delta `-0.0`,
  CI `[-0.2, 0.0]`, `P(delta<=0)=84.8%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.0`, `300k -0.1`;
  validity unchanged (`1898/1920 -> 1898/1920`).
- Status: rejected and reverted; the extra quality pool candidate adds slight
  high-budget drag without a measurable canonical gain.

## short-rescue-boundary-pressure-01

- Mechanism: short-deadline rescue activation boundary.
- Continuous replacement: kept the existing full rescue activation for gaps under
  12 frames, but added a small deterministic pressure for 12-13 frame gaps only
  when ordinary candidates and the first rescue stream were empty.
- Run: `generated/golden-runs/short-rescue-boundary-pressure-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 513.3`, delta `-2.3`,
  CI `[-9.9, 2.0]`, `P(delta<=0)=87.7%`.
- Per-budget deltas: `50k -4.4`, `100k -12.8`, `200k -0.0`, `300k -0.0`;
  validity dropped `1898/1920 -> 1895/1920`.
- Status: rejected and reverted; extending short-deadline rescue beyond the hard
  cutoff destabilizes scarce and mid-budget rows.

## vertical-fwd-avg-pressure-01

- Mechanism: mature forward-eval average-rollout admission for vertical-axis gaps.
- Continuous replacement: replaced the binary amplitude/elevation-axis gate with
  smooth target-strength pressure from authored amplitude and elevation distance
  from flat, multiplied by the existing budget ramp.
- Run: `generated/golden-runs/vertical-fwd-avg-pressure-01`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `515.6 -> 515.9`, delta `+0.3`,
  CI `[-1.6, 2.3]`, `P(delta<=0)=36.2%`.
- Per-budget deltas: `50k +0.0`, `100k +0.1`, `200k +0.5`, `300k +0.3`;
  validity unchanged.
- Status: not kept; sparse vertical specs lost while tight combined vertical
  specs gained, so tried preserving full averaging on sparse cadences.

## vertical-fwd-avg-pressure-02

- Mechanism: same mature forward-eval average-rollout admission.
- Continuous replacement: kept sparse vertical gaps at the old full average-rollout
  pressure, but smoothly applied target-strength pressure as next-contact cadence
  becomes dense (`20..40` frames), preserving the existing budget ramp.
- Run: `generated/golden-runs/vertical-fwd-avg-pressure-02`.
- Decide against accepted baseline `tail-window-boundary-pressure-01`:
  `VERDICT: ACCEPT`; headline `515.6 -> 517.0`, delta `+1.3`,
  CI `[0.2, 3.0]`, `P(delta<=0)=0.9%`.
- Per-budget deltas: `50k +0.0`, `100k +1.3`, `200k +1.6`, `300k +1.4`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: accepted; this archive becomes the next official comparison baseline.

## repair-extra-upstream-pressure-01

- Mechanism: repair upstream blame boundary.
- Continuous replacement: allowed one extra upstream repair anchor beyond
  `LR_REPAIR_MAX_UPSTREAM` only through deterministic smooth pressure from repair
  budget maturity and remaining-frame headroom.
- Run: `generated/golden-runs/repair-extra-upstream-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 516.8`, delta `-0.1`,
  CI `[-0.4, 0.1]`, `P(delta<=0)=88.3%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k -0.0`, `300k -0.3`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; the extra upstream anchor adds slight high-budget
  drag without any canonical gain.

## start-overshoot-speed-pressure-01

- Mechanism: start feasibility high-speed overshoot scoring boundary.
- Continuous replacement: faded start-lookahead overshoot scoring in below the
  existing high-speed cutoff while preserving full scoring at and above the old
  cutoff.
- Run: `generated/golden-runs/start-overshoot-speed-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.0`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=100.0%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; canonical start choices are unchanged by the
  softened boundary on this baseline.

## release-vertical-union-pressure-01

- Mechanism: release-setup vertical pressure combination.
- Continuous replacement: combined low-air and tight-cadence release-setup
  pressures as a smooth union instead of taking the harder `max` boundary.
- Run: `generated/golden-runs/release-vertical-union-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.0`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=100.0%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; canonical selected tracks are unchanged by the
  pressure-combination smoothing.

## preclear-proximity-pressure-01

- Mechanism: arc-placement pre-target sled proximity rejection.
- Continuous replacement: kept deep pre-target overlaps rejected, but replaced
  the fixed `2.5px` cutoff with deterministic smooth rejection pressure across a
  `1.5px..3.5px` near-boundary band.
- Run: `generated/golden-runs/preclear-proximity-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 516.7`, delta `-0.3`,
  CI `[-3.9, 3.5]`, `P(delta<=0)=58.8%`.
- Per-budget deltas: `50k +4.6`, `100k -0.7`, `200k -0.6`, `300k -0.7`;
  validity improved one row overall (`1898/1920 -> 1899/1920`).
- Status: not kept; broad soft admission helps scarce completion but drags
  mature quality, so tried fading the softness out by 100k.

## preclear-proximity-pressure-02

- Mechanism: same pre-target sled proximity rejection.
- Continuous replacement: applied the smooth near-boundary preclear pressure only
  under scarce-budget pressure, fully collapsing back to the old `2.5px` cutoff by
  100k.
- Run: `generated/golden-runs/preclear-proximity-pressure-02`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.3`, delta `+0.4`,
  CI `[-3.0, 4.1]`, `P(delta<=0)=41.8%`.
- Per-budget deltas: `50k +4.6`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity improved one row overall (`1898/1920 -> 1899/1920`).
- Status: rejected and reverted; the only positive signal is isolated to 50k and
  is too underpowered to pass the canonical accept gate.

## far-back-pulse-pressure-01

- Mechanism: far-back quality repair pulse cadence.
- Continuous replacement: replaced the rounded integer modulo interval with a
  deterministic per-selection pulse pressure using the same expected min/max
  cadence rates from smooth axis-quality weakness.
- Run: `generated/golden-runs/far-back-pulse-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 516.8`, delta `-0.1`,
  CI `[-0.5, 0.3]`, `P(delta<=0)=74.2%`.
- Per-budget deltas: `50k -1.6`, `100k +0.2`, `200k +0.1`, `300k -0.1`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: not kept; pressure cadence helps mid budgets slightly but hurts scarce
  and mature budgets, so tried steadier low-discrepancy pulse placement.

## far-back-pulse-pressure-02

- Mechanism: same far-back quality repair pulse cadence.
- Continuous replacement: kept the same smooth pulse pressure, but used a
  low-discrepancy per-selection roll to avoid hash clustering in short runs.
- Run: `generated/golden-runs/far-back-pulse-pressure-02`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: REJECT`; headline `517.0 -> 516.5`, delta `-0.5`,
  CI `[-1.0, -0.1]`, `P(delta<=0)=98.5%`.
- Per-budget deltas: `50k -2.2`, `100k -0.3`, `200k -0.3`, `300k -0.3`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; the accepted periodic far-back cadence is better
  than smooth pressure placement on canonical.

## start-low-speed-penalty-pressure-01

- Mechanism: start heuristic low-speed penalty.
- Continuous replacement: replaced the binary high-target/low-speed start
  penalty with smooth target-speed and speed-ratio pressures over the same
  heuristic cost.
- Run: `generated/golden-runs/start-low-speed-penalty-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.0`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=100.0%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; canonical start ordering is unchanged by this
  smoothed penalty boundary.

## start-angle-shoulder-pressure-01

- Mechanism: start angle target clamp.
- Continuous replacement: replaced the hard `[-12, 24]` start-angle clamp with
  smooth six-degree shoulders near both caps while preserving the same far-out
  limits.
- Run: `generated/golden-runs/start-angle-shoulder-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 516.5`, delta `-0.4`,
  CI `[-1.5, 0.1]`, `P(delta<=0)=91.5%`.
- Per-budget deltas: `50k +0.0`, `100k -0.5`, `200k -0.5`, `300k -0.4`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; the hard capped start-angle anchors are better
  on canonical than softened near-cap shoulders.

## target-segment-count-pressure-01

- Mechanism: target-state arc/contact segment-count quantization.
- Continuous replacement: replaced `Math.round(length / segmentLength)` with
  deterministic smooth fractional admission of the extra segment, using
  low-discrepancy attempt rolls.
- Run: `generated/golden-runs/target-segment-count-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 516.4`, delta `-0.5`,
  CI `[-2.2, 1.0]`, `P(delta<=0)=79.2%`.
- Per-budget deltas: `50k -4.5`, `100k -0.4`, `200k -0.3`, `300k -0.1`;
  validity lost one row overall (`1898/1920 -> 1897/1920`).
- Status: not kept; broad segment-count smoothing damages scarce-budget
  validity/score, so tried preserving old rounding until mature budget.

## target-segment-count-pressure-02

- Mechanism: same target-state segment-count quantization.
- Continuous replacement: kept old rounding through 200k and faded smooth
  fractional extra-segment admission in by 300k.
- Run: `generated/golden-runs/target-segment-count-pressure-02`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 516.9`, delta `-0.0`,
  CI `[-0.3, 0.2]`, `P(delta<=0)=61.7%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k -0.1`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; even mature-only segment-count smoothing has no
  reliable positive signal.

## sparse-contract-pressure-01

- Mechanism: sparse-contract breadth cutoff from median contact cadence.
- Continuous replacement: replaced the hard median-gap sparse switch with a
  centered smooth pressure that deterministically mixes 13/14 contract samples
  near the cutoff.
- Run: `generated/golden-runs/sparse-contract-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.1`, delta `+0.1`,
  CI `[-0.3, 0.8]`, `P(delta<=0)=29.7%`.
- Per-budget deltas: `50k +0.1`, `100k +0.3`, `200k +0.1`, `300k +0.1`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: not kept; positive but below accept confidence, so tried one-sided
  ramps to isolate which side of the cutoff helped.

## sparse-contract-pressure-02

- Mechanism: same sparse-contract breadth cutoff.
- Continuous replacement: kept old normal breadth below the cutoff and smoothed
  only the ramp into sparse breadth above the cutoff.
- Run: `generated/golden-runs/sparse-contract-pressure-02`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 516.8`, delta `-0.2`,
  CI `[-0.7, 0.3]`, `P(delta<=0)=81.4%`.
- Per-budget deltas: `50k +0.4`, `100k -0.1`, `200k -0.2`, `300k -0.3`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: not kept; above-cutoff smoothing helps scarce budget but drags the
  higher-weight mature budgets.

## sparse-contract-pressure-03

- Mechanism: same sparse-contract breadth cutoff.
- Continuous replacement: kept old sparse breadth at and above the cutoff and
  smoothed only the lower-side approach into sparse breadth.
- Run: `generated/golden-runs/sparse-contract-pressure-03`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.1`, delta `+0.1`,
  CI `[-1.9, 1.8]`, `P(delta<=0)=36.8%`.
- Per-budget deltas: `50k +0.1`, `100k +0.5`, `200k +0.0`, `300k +0.1`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted after three variants; centered smoothing is the
  best shape but not reliable enough to accept.

## start-support-release-fraction-01

- Mechanism: startup support release-line geometry.
- Continuous replacement: replaced the rounded target airborne frame used for
  support release placement with the fractional `firstGap.endFrame * air` value,
  smoothing the support-line endpoint instead of stepping it by whole frames.
- Run: `generated/golden-runs/start-support-release-fraction-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.9`, delta `+1.0`,
  CI `[-0.9, 3.9]`, `P(delta<=0)=19.7%`.
- Per-budget deltas: `50k -4.4`, `100k +6.7`, `200k +0.4`, `300k +0.3`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: not kept; positive mean was driven by 100k but 50k regressed, so
  tried preserving 50k rounded behavior with a budget fade.

## start-support-release-fraction-budget-02

- Mechanism: same startup support release-line geometry.
- Continuous replacement: kept rounded release placement at 50k and faded to
  fractional release placement by 100k+, preserving scarce-budget behavior.
- Run: `generated/golden-runs/start-support-release-fraction-budget-02`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 518.3`, delta `+1.3`,
  CI `[-0.8, 5.6]`, `P(delta<=0)=18.9%`.
- Per-budget deltas: `50k +0.0`, `100k +6.7`, `200k +0.4`, `300k +0.3`;
  validity improved one row overall (`1898/1920 -> 1899/1920`), `300k` stayed
  `480/480`.
- Status: not kept; strongest variant but still below accept confidence, so
  tried isolating the smooth value to line geometry while keeping the old
  integer release frame for admission.

## start-support-release-line-fraction-03

- Mechanism: same startup support release-line geometry.
- Continuous replacement: kept the old rounded release frame for runup/admission
  and used the budget-faded fractional release only for the support-line endpoint.
- Run: `generated/golden-runs/start-support-release-line-fraction-03`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 518.3`, delta `+1.3`,
  CI `[-0.8, 5.6]`, `P(delta<=0)=18.9%`.
- Per-budget deltas: `50k +0.0`, `100k +6.7`, `200k +0.4`, `300k +0.3`;
  validity improved one row overall (`1898/1920 -> 1899/1920`), `300k` stayed
  `480/480`.
- Status: rejected and reverted after three variants; the 100k gain is real but
  too underpowered for canonical acceptance at 12 seeds.

## quality-tail-throttle-boundary-01

- Mechanism: quality near-tail shallow-throttle contact cutoff.
- Continuous replacement: kept full shallow-tail throttle for one or two
  remaining contacts, and admitted a fractional deterministic throttle at the
  next integer boundary (`remaining == 3`).
- Run: `generated/golden-runs/quality-tail-throttle-boundary-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: INCONCLUSIVE`; headline `517.0 -> 517.0`, delta `+0.0`,
  CI `[-0.0, 0.1]`, `P(delta<=0)=30.6%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: rejected and reverted; the boundary throttle is active but produces
  only negligible canonical movement, so no follow-up variant was tried.

## quality-preview-pressure-01

- Mechanism: quality-phase future-preview ranking gate.
- Continuous replacement: kept contract preview unchanged, but replaced the hard
  quality-preview disable with a small smooth preview-score pressure from compile
  budget and accumulated full-search feedback.
- Run: `generated/golden-runs/quality-preview-pressure-01`.
- Decide against accepted baseline `vertical-fwd-avg-pressure-02`:
  `VERDICT: ACCEPT`; headline `517.0 -> 517.1`, delta `+0.1`,
  CI `[-0.0, 0.3]`, `P(delta<=0)=6.3%`.
- Per-budget deltas: `50k +1.4`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: accepted; this archive becomes the next official comparison baseline.

## quality-preview-pressure-02

- Mechanism: same quality-phase future-preview ranking gate.
- Continuous replacement: same budget/full-feedback pressure shape, but raised
  max quality-preview score pressure from `0.25` to `0.50`.
- Run: `generated/golden-runs/quality-preview-pressure-02`.
- Decide against accepted baseline `quality-preview-pressure-01`:
  `VERDICT: INCONCLUSIVE`; headline `517.1 -> 517.1`, delta `+0.0`,
  CI `[-0.0, 0.1]`, `P(delta<=0)=14.0%`.
- Per-budget deltas: `50k +0.5`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: not kept; positive 50k signal but still below accept confidence, so
  tried full pressure authority while retaining the same smooth ramps.

## quality-preview-pressure-03

- Mechanism: same quality-phase future-preview ranking gate.
- Continuous replacement: same budget/full-feedback pressure shape, with max
  quality-preview score pressure raised to `1.0`.
- Run: `generated/golden-runs/quality-preview-pressure-03`.
- Decide against accepted baseline `quality-preview-pressure-01`:
  `VERDICT: ACCEPT`; headline `517.1 -> 517.2`, delta `+0.1`,
  CI `[-0.0, 0.3]`, `P(delta<=0)=2.6%`.
- Per-budget deltas: `50k +1.5`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1898/1920`, `300k 480/480`).
- Status: accepted; this archive becomes the next official comparison baseline.

## submin-fwd-eval-pressure-01

- Mechanism: forward-eval ranking budget admission below the default 75k gate.
- Continuous replacement: preserved the old full forward-eval ranker at and above
  `fwdEvalMin`, but admitted deterministic smooth sub-min forward-eval ranking
  from `40k` to `75k` based on budget pressure and node hash.
- Run: `generated/golden-runs/submin-fwd-eval-pressure-01`.
- Decide against accepted baseline `quality-preview-pressure-03`:
  `VERDICT: INCONCLUSIVE`; headline `517.2 -> 517.3`, delta `+0.1`,
  CI `[-3.2, 3.2]`, `P(delta<=0)=43.8%`.
- Per-budget deltas: `50k +1.1`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity changed from `1898/1920` to `1896/1920`, with `300k 480/480`.
- Status: not kept; positive but very weak, so tried stronger 50k admission.

## submin-fwd-eval-pressure-02

- Mechanism: same sub-min forward-eval ranking admission.
- Continuous replacement: same deterministic pressure shape, but started the
  sub-min ramp at `30k` instead of `40k`.
- Run: `generated/golden-runs/submin-fwd-eval-pressure-02`.
- Decide against accepted baseline `quality-preview-pressure-03`:
  `VERDICT: INCONCLUSIVE`; headline `517.2 -> 518.1`, delta `+0.9`,
  CI `[-3.1, 4.3]`, `P(delta<=0)=27.9%`.
- Per-budget deltas: `50k +11.4`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity changed from `1898/1920` to `1896/1920`, with `300k 480/480`.
- Status: not kept; stronger scarce-budget signal but still below accept
  confidence, so tried one final stronger pressure variant.

## submin-fwd-eval-pressure-03

- Mechanism: same sub-min forward-eval ranking admission.
- Continuous replacement: same deterministic pressure shape, with the sub-min
  ramp starting at `20k` to give 50k enough forward-eval admission to matter.
- Run: `generated/golden-runs/submin-fwd-eval-pressure-03`.
- Decide against accepted baseline `quality-preview-pressure-03`:
  `VERDICT: ACCEPT`; headline `517.2 -> 520.4`, delta `+3.2`,
  CI `[-1.0, 7.0]`, `P(delta<=0)=5.7%`.
- Per-budget deltas: `50k +41.6`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity improved from `1898/1920` to `1901/1920`, with `300k 480/480`.
- Status: accepted; this archive becomes the next official comparison baseline.

## arc-rewrite-baseline-01

- Baseline refresh after rebasing `work-new-smooth` onto `origin/arc-rewrite`.
- Run: `generated/golden-runs/arc-rewrite-baseline-01`.
- Result: headline `580.8`; per-budget scores `50k 425.2`, `100k 580.0`,
  `200k 593.2`, `300k 598.8`; validity `1903/1920`, `300k 480/480`.
- Status: new official comparison baseline for post-arc-rewrite attempts
  (`evaluator_fingerprint eede9661bba6`).

## start-support-speed-offset-pressure-01

- Mechanism: startup support low-air speed-offset boundary.
- Continuous replacement: replaced the hard `air <= 0.35` switch from three
  support speeds to one speed with a smooth offset-magnitude fade over air span
  `0.10`.
- Run: `generated/golden-runs/start-support-speed-offset-pressure-01`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.9`, delta `+0.2`,
  CI `[-0.5, 1.1]`, `P(delta<=0)=37.8%`.
- Per-budget deltas: `50k +0.3`, `100k +0.3`, `200k +0.1`, `300k +0.1`;
  validity unchanged (`1903/1920`, `300k 480/480`).
- Status: not kept; positive but weak, so tried a wider fade span.

## start-support-speed-offset-pressure-02

- Mechanism: same startup support speed-offset boundary.
- Continuous replacement: same smooth offset-magnitude fade, with air span
  widened to `0.20`.
- Run: `generated/golden-runs/start-support-speed-offset-pressure-02`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 581.6`, delta `+0.8`,
  CI `[-0.8, 3.0]`, `P(delta<=0)=17.6%`.
- Per-budget deltas: `50k +6.5`, `100k -0.5`, `200k +0.4`, `300k +0.6`;
  validity improved one row overall (`1903/1920 -> 1904/1920`), `300k 480/480`.
- Status: not kept; strongest positive miss, but wider fade hurt some
  start-sensitive rows and remained below accept confidence.

## start-support-speed-offset-pressure-03

- Mechanism: same startup support speed-offset boundary.
- Continuous replacement: same smooth offset-magnitude fade, with intermediate
  air span `0.15`.
- Run: `generated/golden-runs/start-support-speed-offset-pressure-03`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 581.1`, delta `+0.3`,
  CI `[-0.8, 1.5]`, `P(delta<=0)=30.1%`.
- Per-budget deltas: `50k +0.7`, `100k -0.0`, `200k +0.5`, `300k +0.2`;
  validity unchanged (`1903/1920`, `300k 480/480`).
- Status: rejected and reverted after three variants; the boundary is genuinely
  active, but canonical confidence is too low to keep.

## submin-repair-pressure-01

- Mechanism: repair admission below the hard `repair.minBudget` gate.
- Continuous replacement: enabled repair below `100k` by deterministic smooth
  pressure from `25k` to `100k`, preserving full repair at and above `100k`.
- Run: `generated/golden-runs/submin-repair-pressure-01`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.8`, delta `-0.0`,
  CI `[-0.1, 0.1]`, `P(delta<=0)=57.6%`.
- Per-budget deltas: `50k -0.2`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1903/1920`, `300k 480/480`).
- Status: not kept; sub-min repair admission was effectively flat and slightly
  negative at 50k.

## submin-repair-pressure-02

- Mechanism: same repair admission below the hard `repair.minBudget` gate.
- Continuous replacement: same deterministic smooth pressure, with the ramp
  starting at `0` so 50k gets 50% repair admission.
- Run: `generated/golden-runs/submin-repair-pressure-02`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.7`, delta `-0.1`,
  CI `[-0.3, 0.0]`, `P(delta<=0)=88.6%`.
- Per-budget deltas: `50k -1.1`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1903/1920`, `300k 480/480`).
- Status: rejected and reverted after two variants; repair appears to spend
  scarce 50k budget without improving validity or quality.

## start-low-speed-penalty-pressure-01

- Mechanism: start heuristic low-speed penalty.
- Continuous replacement: replaced the binary `targetSpeed >= 6` and
  `speed < 45% target` penalty with smooth target-speed and speed-ratio
  pressures in the same start-ordering heuristic.
- Run: `generated/golden-runs/start-low-speed-penalty-pressure-01`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.8`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=100.0%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1903/1920`, `300k 480/480`).
- Status: rejected and reverted after one variant; canonical output was
  byte-stable, so this hard branch is not active on the current baseline.

## dead-end-rescue-gap-pressure-01

- Mechanism: dead-end rescue gap-duration cutoff.
- Continuous replacement: replaced the hard `gapFrames >= 16` rescue gate with
  a smooth candidate-count and pool-size ramp from `12` to `16` frames, keeping
  full rescue behavior at `16+` frames.
- Run: `generated/golden-runs/dead-end-rescue-gap-pressure-01`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.8`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=43.8%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity unchanged (`1903/1920`, `300k 480/480`).
- Status: not kept; slightly positive but far too small to accept, so tried a
  wider bridge.

## dead-end-rescue-gap-pressure-02

- Mechanism: same dead-end rescue gap-duration cutoff.
- Continuous replacement: same smooth candidate-count and pool-size ramp, widened
  to start at `8` frames and reach full rescue at `16` frames.
- Run: `generated/golden-runs/dead-end-rescue-gap-pressure-02`.
- Decide against accepted baseline `arc-rewrite-baseline-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.0`, delta `-0.8`,
  CI `[-3.7, 1.0]`, `P(delta<=0)=68.7%`.
- Per-budget deltas: `50k -10.8`, `100k +0.0`, `200k +0.0`, `300k +0.0`;
  validity regressed overall (`1903/1920 -> 1901/1920`), with `300k 480/480`.
- Status: rejected and reverted after two variants; the narrow bridge was too
  weak to keep and the wider bridge spent scarce 50k budget badly.

## start-support-xdelay-fractional-01

- Mechanism: startup support x-delay count boundary.
- Continuous replacement: kept the existing smooth air/duration/budget pressure,
  but replaced rounded delay-count selection with deterministic fractional
  admission of the next delay.
- Run: `generated/golden-runs/start-support-xdelay-fractional-01`.
- Baseline rerun: `generated/golden-runs/arc-rewrite-baseline-rerun-01`
  because logged `arc-rewrite-baseline-01` archive was missing locally.
- Decide: `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.9`, delta `+0.1`,
  CI `[0.0, 0.3]`, `P(delta<=0)=38.5%`.
- Per-budget deltas: `50k +0.0`, `100k +0.0`, `200k +0.1`, `300k +0.1`;
  validity unchanged (`1903/1920`, `300k 480/480`).
- Status: rejected and reverted; smoothing this boundary is active but too small
  and high-budget-only to meet the canonical accept gate.

## rescue-startup-fractional-count-postarc-01

- Mechanism: dead-end rescue startup-weighted candidate count and rescue pool.
- Continuous replacement: kept the existing startup pressure but replaced rounded
  extra candidate/pool counts with deterministic fractional admission.
- Run: `generated/golden-runs/rescue-startup-fractional-count-postarc-01`.
- Decide against baseline rerun `arc-rewrite-baseline-rerun-01`:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 580.8`, delta `+0.0`,
  CI `[0.0, 0.0]`, `P(delta<=0)=58.5%`.
- Per-budget deltas all `+0.0`; validity unchanged (`1903/1920`,
  `300k 480/480`).
- Status: rejected and reverted; canonical rows are effectively unchanged by
  fractionalizing this post-arc rescue count.

## contract-branch-warmup-pressure-01..03

- Mechanism: contract-failed handoff branching limit.
- Continuous replacement: replaced the hard warmup/rounded scarcity clamp with a
  smooth depth pressure and deterministic fractional admission of the third
  handoff branch.
- Baseline rerun: `generated/golden-runs/arc-rewrite-baseline-rerun-01`
  because logged `arc-rewrite-baseline-01` archive was missing locally.
- Variant 01 (`generated/golden-runs/contract-branch-warmup-pressure-01`):
  depth pressure started before the old warmup boundary. Decide:
  `VERDICT: INCONCLUSIVE`; headline `580.8 -> 581.7`, delta `+0.9`,
  CI `[-0.0, 3.6]`, `P(delta<=0)=25.9%`; per-budget deltas
  `50k +11.4`, `100k +0.0`, `200k +0.0`, `300k +0.0`; validity improved
  (`1903/1920 -> 1905/1920`, `300k 480/480`).
- Variant 02 (`generated/golden-runs/contract-branch-warmup-pressure-02`):
  preserved the old full-branch warmup through gap `12`, then ramped depth
  pressure over later gaps. Decide: `VERDICT: INCONCLUSIVE`; headline
  `580.8 -> 581.7`, delta `+0.9`, CI `[-0.0, 3.2]`,
  `P(delta<=0)=24.8%`; per-budget deltas `50k +11.4`, `100k +0.0`,
  `200k +0.0`, `300k +0.0`; validity again improved to `1905/1920`.
- Variant 03 (`generated/golden-runs/contract-branch-warmup-pressure-03`):
  kept the same depth ramp but left a `25%` deep-prefix third-branch floor at
  scarce budgets. Decide: `VERDICT: ACCEPT`; headline `580.8 -> 583.0`,
  delta `+2.2`, CI `[-0.1, 5.7]`, `P(delta<=0)=9.3%`; per-budget deltas
  `50k +28.5`, `100k +0.0`, `200k +0.0`, `300k +0.0`; validity improved
  (`1903/1920 -> 1908/1920`, `300k 480/480`).
- Status: variant 03 kept as the new working baseline.

## contract-sample-count-fractional-01

- Mechanism: budget-aware contract candidate count integerization.
- Continuous replacement: kept the existing projected-budget and fade pressures,
  but replaced rounded candidate-count boundaries with deterministic fractional
  admission from the current search node.
- Run: `generated/golden-runs/contract-sample-count-fractional-01`.
- Decide against accepted baseline `contract-branch-warmup-pressure-03`:
  `VERDICT: INCONCLUSIVE`; headline `583.0 -> 582.6`, delta `-0.4`,
  CI `[-3.9, 3.6]`, `P(delta<=0)=59.4%`.
- Per-budget deltas: `50k -5.2`, `100k -0.0`, `200k +0.0`,
  `300k +0.0`; validity regressed slightly (`1908/1920 -> 1907/1920`,
  `300k 480/480`).
- Status: rejected and reverted; the old rounded cap is noisy but better for
  the scarce-budget validity/score tradeoff after the branch-warmup accept.

## brake-high-overspeed-fractional-01

- Mechanism: brake-candidate high-overspeed count threshold.
- Continuous replacement: left the existing target-speed eligibility gates alone,
  but replaced the `1.15x` overspeed jump from base brake probes to one extra
  probe with a short smooth ratio band and deterministic per-node admission.
- Run: `generated/golden-runs/brake-high-overspeed-fractional-01`.
- Decide against accepted baseline `contract-branch-warmup-pressure-03`:
  `VERDICT: INCONCLUSIVE`; headline `583.0 -> 581.7`, delta `-1.3`,
  CI `[-5.1, 0.9]`, `P(delta<=0)=78.0%`.
- Per-budget deltas: `50k -17.6`, `100k +0.2`, `200k -0.0`,
  `300k +0.1`; validity regressed (`1908/1920 -> 1905/1920`,
  `300k 480/480`).
- Status: rejected and reverted; adding/removing the extra brake probe around
  the threshold spends scarce budget badly despite tiny high-budget gains.
