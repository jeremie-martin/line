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
