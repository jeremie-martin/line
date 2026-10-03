# Compiler budget and learned artifacts (2026-10-04)

Every run is from `npm run eval` (4 songs × 4 seeds authored, plus 4 × 2
perturbed), in strike mode. Each is paired against the adopted configuration
`strike-h1b-prep2` unless another reference is named. Intervals are 95%
song-bootstrap intervals (n = 4 songs), so they are wide by design. Runs are
in `generated/eval/<name>` (local).

## How the budget is spent

`connectedArcOptions` derives every search width from an "allowance":
0.7 × budget per ride frame. **Every width saturates once the allowance
reaches about 200.** For the 44–48 s panel songs that happens at about
0.52M frames. So every budget from about 0.52M up runs the same
configuration, and the budget acts only as a hard stop. That configuration
really costs 1,200–1,550 frames per ride frame, a mean of 2.35M at 3M.

| run | budget | complete | strike loss | frames used |
|---|---|---|---|---|
| strike-b750000 | 0.75M | 81% (perturbed 88%) | 0.037 | 0.75M (hits the stop) |
| strike-b1500000 | 1.5M | 100% | 0.022 | 1.50M (hits the stop, paced by lookahead) |
| strike-h1b-prep2 | 3M | 100% | 0.016 | 2.35M |

Consequence: a fixed 3M allowance gives a 3-minute song the per-frame room of
a 45 s song at 0.75M, where one compile in five ran out before the end.

## Experiments

| id | change | result | verdict |
|---|---|---|---|
| A1 | no arrival value model | strike loss +0.003 | keep the model |
| A2 | no construction policies | strike strength rms +0.026, +0.3M frames; the benefit persists on perturbed inputs | keep (held-out music untested) |
| R1 | whole-track refinement over every section, 64 attempts (was: last section, 12) | every ruler unchanged within ±0.002, +0.3M frames | rejected: leftover budget at 3M does not buy quality through refinement |
| K1 | allowance ÷ 4 (calibrate to the real cost) | 0.75M: completion 81% → 100%, but only 0.35M used and strike strength rms +0.022 (guidance switches off below allowance 80); 1.5M unchanged; 3M identical | rejected: the width schedule has cliffs, so no single constant calibrates it |
| P1 | per-section fair-share pacing of local search (share of remaining work ∝ ride frames covered; never binds before a valid candidate) | 3M byte-identical; 0.75M: no completion gain, contested +0.019; 1.5M: completion −6 pp authored, −12 pp perturbed | rejected: low-budget failures are not early sections starving later ones |
| L1 | lookahead off | every compile completes on about 0.7M frames (−1.65M, −78 s), but strike loss +0.007, contested beats +2.4 pp (perturbed +3.8 pp), R1 strength rms +0.020 | rejected: lookahead earns its 70% share |
| P2 | planning reserve factor 1.2 (saturated value 0.7, which reserves less than the observed construction rate) | 0.75M: completion +19 pp authored but −12 pp perturbed; standard: contested +1.7 pp, strike loss +0.002 authored | rejected: low-budget completion is chaotic under this knob |
| S1 | default allowance = 1,700 frames per ride frame (`production_budget.ts`), 3.0–3.3M on the panel | neutral within noise on every ruler (largest: perturbed strike loss +0.002 [0.000, 0.004]); compile time unchanged or lower | **adopted** as the length-scaled default, a generalisation fix the fixed panel cannot show |

## What remains open

- The width schedule (`connected_arcs.ts`) is a set of saturating caps with
  mechanism cliffs (guidance, complete-boundary correction, value model all
  switch off below allowance 80). Replacing it needs a measured cost model
  per width, not a constant.
- At the standard allowance about 20–30% of the budget goes unspent, and none
  of R1's extra refinement turned it into quality. Unspent budget is
  therefore saved compile time, not lost quality.
- Robustness below about 1,000 frames per ride frame is unsolved. K1 and L1
  show that the search without lookahead completes reliably on about 380
  frames per ride frame. The failures come from lookahead spending what later
  sections need, but neither the reserve factor (P2) nor fair-share pacing
  (P1) fixes it cleanly. A principled fix would make lookahead strictly
  anytime: run every section once without lookahead first, then spend the
  remainder on lookahead revisions of the complete incumbent.
