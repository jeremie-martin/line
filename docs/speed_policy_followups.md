# Speed Policy Follow-Ups

## Baseline Evidence

The speed-axis remap made authored `speed` map to a raw velocity range:

```text
authored 0.0 -> 5.4 px/frame
authored 1.0 -> 12.6 px/frame
```

This improved the 150k three-seed headline run, but the score is not strictly
comparable to older campaigns because the evaluator ruler changed.

Recent remap campaigns:

| Campaign | Scope | Score | Valid |
| --- | ---: | ---: | ---: |
| `/tmp/line-speed-axis-remap-20x3-b150k` | 20 specs x 3 seeds | 514.09 | 60/60 |
| `/tmp/line-speed-axis-remap-20x10-b150k` | 20 specs x 10 seeds | 467.26 | 197/200 |

The broader 10-seed run found three contract failures:

- `opening_burst`, seed 4: stalled at frame 100, 20 missing contacts.
- `rhythm_ladder`, seed 3: stalled at frame 506, 11 missing contacts.
- `solo_run`, seed 5: stalled at frame 490, 20 missing contacts.

Speed diagnostics over the 10-seed run:

- Mean authored target: 0.627.
- Mean achieved speed: 0.771.
- Mean signed speed error: +0.144.
- Mean absolute speed error: 0.179.
- Overshoot rate: 81.9%.
- Authored targets in `[0.25, 0.5)` achieved 0.629 on average.
- Authored targets in `[0.75, 1.0]` achieved 0.833 on average.

Interpretation: the new mapping is a better baseline, but low-speed targets are
still usually too fast. The remaining issue is more likely compiler policy than
axis definition.

## Candidate Policy Cleanups

### Brake Candidate Gate

Current behavior:

- Brake candidates are offered only when authored target speed is at or below
  `0.78`, mapped to raw velocity with `authoredSpeedToPx(0.78)`.
- Candidate count jumps from 2 to 3 when `speedRatio >= 1.15`.
- Quality search jumps from 3 to 4 at the same ratio.

Why this looks overfit:

- Authored `0.78` is still a hard boundary, even though it is now mapped through
  the calibrated raw speed range.
- A target just below the boundary can get brake probes while a target just above
  it gets none.
- The system still has positive speed error on many rows, so a hard moderate-
  target cutoff may suppress useful brake alternatives.

Safer direction:

- Keep brake work local and bounded.
- Replace the target cutoff with a continuous target pressure that tapers from
  full brake work near authored `0.78` to no extra brake work near authored
  `1.0`.
- Replace the ratio jump with a continuous overspeed pressure, then quantize the
  final pressure to a small integer candidate count.

Experiment results:

These experiments predate the threshold-preservation review fix that restored
authored brake/carry boundaries after the speed remap.

| Variant | Archive | Score | Valid | Brake Attempts | Selected Brake |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline remap | `/tmp/line-speed-axis-remap-20x3-b150k` | 514.09 | 60/60 | 11,656 | 144 |
| target taper to `12.0` | `/tmp/line-speed-brake-taper-20x3-b150k` | 511.88 | 60/60 | 30,147 | 405 |
| bounded target taper | `/tmp/line-speed-brake-taper-round0-20x3-b150k` | 511.05 | 60/60 | 30,080 | 403 |
| ratio-only smoothing | `/tmp/line-speed-brake-ratio-smooth-20x3-b150k` | 513.60 | 60/60 | 12,230 | 145 |

Interpretation:

- Widening target-speed eligibility is not a clean win. It slightly reduced mean
  absolute speed error (`0.1800 -> 0.1776`) but increased signed overspeed,
  increased `>1.0` achieved speeds, roughly tripled selected brake candidates,
  and lowered the headline score.
- Rounding tiny target pressure to zero did not fix the target-taper problem.
- Smoothing only the `1.15` overspeed-ratio jump was much less disruptive, but
  still missed the baseline (`513.60` vs `514.09`) and slightly worsened speed
  absolute error (`0.1800 -> 0.1812`).
- Recommendation: do not land a brake candidate policy change yet. If we revisit
  braking, bias toward ranking/acceptance pressure for already-generated brake
  candidates rather than widening candidate eligibility.

### Start-Speed Anchors

Current behavior:

- The current experiment builds start candidates from continuous offsets around
  the raw target speed, plus the default start velocity and multiplicative
  probes.
- Before this experiment, start candidates used three hard bands split at raw
  target speeds `6` and `9 px/frame`.

Why this looks overfit:

- A tiny target-speed change can switch the anchor family.
- The remap changed how often specs land near those boundaries.

Safer direction:

- Build anchors as continuous offsets around the raw target speed instead of
  picking one of three bands.
- Keep the default start velocity as an explicit candidate.

### Reachability Velocity Grid

Current behavior:

- Region probes use `[target - 3, target, target + 3]`, clamped to `[1.5, 16]`.

Why this looks overfit:

- The same +/-3 px/frame span is used for low, moderate, and high targets.
- It may under-sample low-speed braking states and over-sample irrelevant fast
  states.

Safer direction:

- Make the span depend on target speed and gap duration.
- Keep the grid small, but bias extra coverage toward physically hard low-speed
  targets.

### Steep-Catch Template Gate

Current behavior:

- Steep catch templates are used only when `gapFrames >= 60` and either raw
  speed is at least `10 px/frame` or angle is at least `55 deg`.

Why this looks overfit:

- It is a hard on/off template switch.
- The speed threshold is physical, but still arbitrary.

Safer direction:

- Turn the condition into a pressure and allow sparse template attempts near the
  boundary, with full template use only at clearly steep/high-speed states.

### Contact-Centered Pressure Constants

Current behavior:

- Speed pressure starts at `7.8 px/frame` and spans `6.6 px/frame`.
- Carry pressure peaks around old preserved raw thresholds.

Why this looks overfit:

- These are preserved old physical thresholds after the remap.
- They may still be reasonable, but they have not been re-fit to the new target
  semantics.

Safer direction:

- Keep the continuous shape.
- Re-test pressure start/span values empirically against a 10-seed or larger
  panel before changing them.

## Suggested Order

1. Start-speed anchors: likely affects contract stability and early speed.
2. Reachability grid: useful but more expensive to validate.
3. Steep-catch gate: potentially helpful, but template scheduling is discrete.
4. Contact-centered constants: tune only after the selection policies settle.
5. Brake ranking/acceptance: revisit only with a narrower design than candidate
   eligibility widening.
