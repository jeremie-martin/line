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

- Start candidates are built from continuous raw-velocity offsets around the
  first targeted speed, plus the default start velocity and multiplicative
  probes.
- Before this landed, start candidates used three hard bands split at raw target
  speeds `6` and `9 px/frame`.

What changed:

- This removed the hard `6`/`9 px/frame` start-anchor family switch.
- The default start velocity remains an explicit candidate, so specs that worked
  with the old unpressured start still have that option.

Evidence:

- `20 specs x 3 seeds`, 150k budget: baseline remap `514.09`, start anchors
  `514.60`, both `60/60` valid.
- Mean signed speed error improved from `+0.1430` to `+0.1346`; mean absolute
  speed error improved from `0.1800` to `0.1785`.
- Achieved speeds above authored `1.0` fell from `6.15%` to `5.37%`.
- Broader validation is still pending; the 20x10 run was interrupted before the
  review cleanup, so only the 20x3 evidence should be treated as complete.

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

### Release-State Speed Weight

Current behavior:

- `handoffAxisOvershootPenalty` scores speed overshoot in authored units with
  weight `16`.
- `releaseSpeedPenalty` measures release speed error in authored speed units.
- After the speed remap, one physical px/frame of release-speed error maps to a
  larger authored delta because the authored range is `7.2 px/frame` wide rather
  than the old implicit `12 px/frame` scale.
- `RELEASE_STATE_SPEED_WEIGHT = 0.35` and the handoff speed overshoot weight
  were not re-fit during the remap.

Why this needs care:

- For a fixed physical px/frame error, squared authored-unit penalties are about
  `2.78x` stronger than they were on the old `/12` scale.
- This is a heuristic ranking term, not an evaluator ruler, so changing it
  should be benchmarked instead of bundled into a correctness cleanup.
- `axisCost` also remains equal-weighted in authored axis units. That matches
  the evaluator's equal-axis framing, but it is still part of the same local
  ranking audit if speed keeps dominating candidate choice.

Safer direction:

- Run small sweeps around the old physical-equivalent weights before changing
  the constants. Examples: release-state `0.126`, `0.20`, `0.35`; handoff
  overshoot `5.76`, middle values, and current `16`.
- Compare not only curve score, but start/early-gap speed errors and contract
  stability.

## Suggested Order

1. Reachability grid: useful but more expensive to validate.
2. Steep-catch gate: potentially helpful, but template scheduling is discrete.
3. Contact-centered constants: tune only after the selection policies settle.
4. Handoff/release speed weights: sweep physical-equivalent values before
   retuning ranking constants.
5. Brake ranking/acceptance: revisit only with a narrower design than candidate
   eligibility widening.
6. Start-speed anchors: run a clean 10-seed confirmation pass, but the 20x3
   evidence was good enough to keep the landed continuous-anchor policy.
