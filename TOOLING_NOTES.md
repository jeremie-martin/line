# Tooling / harness / workflow notes

Running log of friction points hit while working the arc-placement campaign
(`GOAL_LDS_ARC_PLACEMENT.md`). Newest at the bottom of each section.

## golden.ts CLI

- **`--json` omits the per-axis `axes` diagnostics that `analyze_golden_curve.ts`
  needs.** `compactJsonCheckpoint` (used under `--json`) drops the `axes` array and
  uses `compactStats`, so `printAxisDiagnostics` silently prints nothing. You must
  add `--details` to get the per-axis signed-error breakdown. `decide` only needs
  the compact fields, so the two consumers of `golden.json` want different flags.
  Mildly surprising; easy to produce a baseline that can't be diagnosed without a
  re-run. Suggestion: have `analyze` warn "no per-axis data — re-run with --details"
  instead of silently skipping.

- **`--json` produces NO output until the run completes** (jsonOnly suppresses the
  progress header). For a ~15-min canonical run there's no liveness signal on
  stdout; you have to watch the `checkpoints/` dir filling up to gauge progress.
  A periodic stderr heartbeat (rows done / total) would help, especially for
  background runs.

## Decision workflow

- `npm run decide` requires BOTH archives to carry the same
  `evaluator_fingerprint`, `headline.alpha`, and `headline.score_budgets`, else it
  refuses. Good guardrail, but means an interrupted/partial baseline can't be
  compared — you re-run from scratch. (Working as intended; noting for awareness.)

## Iteration loop economics

- **A canonical run (20 specs × 8 seeds × 35 budgets, measure-once) takes ~45–55 min**
  even at `--jobs=32` on a 64-core box, and the slow tail is dominated by a few long
  dense specs (`solo_run` 25 s last). The `decide` arbiter requires canonical runs,
  but each candidate therefore costs ~1 h. Meanwhile the brief is explicit that the
  3-seed `GOLDEN_SEEDS_OVERRIDE` smoke is "not a decision basis." That leaves a wide
  gap between "cheap smoke (noisy, can't decide)" and "canonical (1 h/candidate)".
  A documented *middle* tier — e.g. a recommended 6-spec × 8-seed × coarse-budget
  "screen" that's ~10 min and statistically powered enough to pre-filter before the
  full decide — would make the loop much tighter. Right now it's easy to either burn
  an hour on a probe-rejected idea or wrongly reject on an under-powered smoke.
- **You cannot run two `--jobs=32` canonical runs in parallel** on a 62 GB box
  (~1 GB+/worker ⇒ 64 workers OOM), so candidates must be confirmed serially even
  though half the cores sit idle during a single run. A built-in "compare two
  configs in one run" mode (alternating env per worker) would halve wall-clock for
  A/B decisions.

## Decision resolution vs effect size

- The 8-seed paired bootstrap resolves ~10-pt headline gains (per the variance
  study). A genuine but smaller gain (I measured a real **+5.7** with P(Δ≤0)=10.9%,
  effect 1.18, both ceiling and logAUC up) lands as **INCONCLUSIVE** (CI lower
  bound just below 0) — indistinguishable, at the verdict level, from "no effect,"
  even though P(positive)=89%. That's correct statistics, but it means a real
  improvement below the resolution floor cannot be committed without either
  (a) strengthening it past ~10 pt, or (b) more seeds. A `decide` hint when a
  result is "positive but under-powered — N more seeds would resolve it" would help
  distinguish "promising lead" from "true null." (Worked around by amplifying the
  mechanism.)

## Docs

- `GOAL_LDS_ARC_PLACEMENT.md` is ~725 lines with several **retracted/superseded**
  sections interleaved with live guidance (the metric banner at line ~190 supersedes
  the "last-budget mean" framing below it; an "infeasibility" verdict is explicitly
  retracted mid-section). The top banner flags this, but it's easy to act on a stale
  paragraph. The historical record is valuable; a short "LIVE GUIDANCE" digest at the
  very top (separate from the archive) would reduce the chance of chasing a retracted
  conclusion.
