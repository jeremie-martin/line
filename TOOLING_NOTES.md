# Tooling / harness / workflow notes (V1-historical)

> **V1-historical document.** This log covers the retired Benchmark V1
> workflow (`golden:v1` / `decide:v1`); command names and mechanisms below
> may no longer exist. The current system is Benchmark V2 — start at
> `docs/HOW_TO_WORK.md`.

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
  - **RESOLVED 2026-06-05:** `printAxisDiagnostics` now detects compact archives
    (last-budget checkpoints present but no `axes` field) and warns to re-run with
    `--details`/`--json-full` instead of printing nothing.

- **`--json` produces NO output until the run completes** (jsonOnly suppresses the
  progress header). For a ~15-min canonical run there's no liveness signal on
  stdout; you have to watch the `checkpoints/` dir filling up to gauge progress.
  A periodic stderr heartbeat (rows done / total) would help, especially for
  background runs.
  - **RESOLVED 2026-06-05:** under `--json`/`--json-full`, `runRows` now writes a
    `[k/N] compiled` heartbeat (plus a start header) to **stderr**, leaving stdout
    as pure JSON.

- **`--details` can fail to serialize a 24-seed canonical archive.** On 2026-06-06,
  `LR_ENGINE=wasm npm run golden -- --details --jobs=6` completed all 480 headline
  compiles and wrote 33,600 checkpoint artifacts (~1.4 GB), then crashed before
  `golden.json` with `Invalid string length` while building the detailed JSON. This
  makes the documented canonical command unusable as a baseline/candidate archive
  on the current 20 specs x 24 seeds x 35 budgets scope. Workaround: run canonical
  archives in compact mode for `decide`, and use smaller `--details` probes for
  per-axis diagnostics.

- **A max-budget probe can under-exercise end-of-loop mechanisms.** While working
  the archived `GOAL_LDS_COMPILER_IMPROVEMENT_V2.md`, a 5-seed probe capped at 125k reported zero
  prefix-branch work, but the 24-seed canonical baseline had branch forks already
  visible at its 125k checkpoint for the same seeds. The compiler stops as soon as
  the final requested checkpoint is captured, whereas a longer canonical run keeps
  expanding after that checkpoint. This makes max-budget probes a weak screen for
  mechanisms that fire around or just after the probe ceiling; use them for obvious
  regressions, not as proof that late-search mechanisms are inert.

- **`--help` is not a help path.** On 2026-06-06, `npm run golden -- --help`
  ignored the apparent help flag and started a full default canonical run,
  creating an auto-named archive before it was killed. Either wire a real help
  handler or reject unknown flags before starting worker jobs.

## TypeScript verification

- **Repo-wide `npx tsc --noEmit` is currently too noisy to use as a local verifier.**
  On 2026-06-06 it failed immediately on pre-existing project-wide issues
  (`allowImportingTsExtensions`, missing declarations for `lr-core`, and legacy
  scripts), plus unrelated analyzer/polish typing errors. Focused `vitest` and
  golden smoke runs are the practical checks for compiler edits until the TS
  project config is split or cleaned up.

## Decision workflow

- `npm run decide` requires BOTH archives to carry the same `evaluator_fingerprint`,
  the weighted-average `headline.kind`, and a matching budget weighting, else it
  refuses (and refuses legacy pre-weighted-average archives). Good guardrail, but means an interrupted/partial baseline can't be
  compared — you re-run from scratch. (Working as intended; noting for awareness.)
  - **2026-06-05:** left as-is (the guardrail is correct). The related "must I re-run
    the baseline each candidate?" confusion is addressed by the LIVE GUIDANCE note in
    `GOAL_LDS_ARC_PLACEMENT.md`: the baseline is produced once and reused.

## Iteration loop economics

- **A canonical run (20 specs × 12 seeds × 5 budgets {25,50,100,150,200}k, each an
  independent run) takes tens of minutes** at `--jobs=6`; the slow tail is dominated by
  a few long specs (`solo_run` last). The `decide` arbiter requires canonical runs;
  the 12-seed population (down from 24, for the high-gain phase) roughly halves that
  cost per candidate. Meanwhile the brief is explicit that the
  3-seed `GOLDEN_SEEDS_OVERRIDE` smoke is "not a decision basis." That leaves a wide
  gap between "cheap smoke (noisy, can't decide)" and "canonical (1 h/candidate)".
  A documented *middle* tier — e.g. a recommended 6-spec × 8-seed × coarse-budget
  "screen" that's ~10 min and statistically powered enough to pre-filter before the
  full decide — would make the loop much tighter. Right now it's easy to either burn
  an hour on a probe-rejected idea or wrongly reject on an under-powered smoke.
  - **RESOLVED 2026-06-05 (V1; the `screen` tier was retired with V1 — no
    `npm run screen` exists today):** added the `screen` middle tier: `SCREEN_SPECS` (6 representative specs) × full 8 seeds ×
    `SCREEN_BUDGETS` (coarse grid), ~10 min. Strict subset ⇒ `decide` flags it
    INDICATIVE, so it self-labels as a pre-filter, not a promotion.
- **You cannot run two `--jobs=32` canonical runs in parallel** on a 62 GB box
  (~1 GB+/worker ⇒ 64 workers OOM), so candidates must be confirmed serially even
  though half the cores sit idle during a single run. A built-in "compare two
  configs in one run" mode (alternating env per worker) would halve wall-clock for
  A/B decisions.
  - **2026-06-05 — won't do:** the premise doesn't hold. When memory caps usable
    cores, two configs at N/2 cores each ≈ two serial runs at N cores — no wall-clock
    win. And the baseline doesn't need re-running per candidate (run once, reuse).
    Documented the reuse workflow in `GOAL_LDS_ARC_PLACEMENT.md` instead.

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
  - **RESOLVED 2026-06-05:** `decide` now prints a `hint:` on positive INCONCLUSIVE
    results — `Δ positive … but under-powered — ~N more seeds (~M total) would likely
    resolve it`, estimating N from the current CI width (~1/√seeds). Output-only; the
    verdict logic is unchanged.

## Docs

- `GOAL_LDS_ARC_PLACEMENT.md` is ~725 lines with several **retracted/superseded**
  sections interleaved with live guidance (the metric banner at line ~190 supersedes
  the "last-budget mean" framing below it; an "infeasibility" verdict is explicitly
  retracted mid-section). The top banner flags this, but it's easy to act on a stale
  paragraph. The historical record is valuable; a short "LIVE GUIDANCE" digest at the
  very top (separate from the archive) would reduce the chance of chasing a retracted
  conclusion.
  - **RESOLVED 2026-06-05:** added a `## LIVE GUIDANCE (read this first)` digest at the
    top of `GOAL_LDS_ARC_PLACEMENT.md` (metric, decision rule, the three run tiers,
    baseline reuse, jobs, the `--details` axis gotcha) that flags the subsections below
    as historical/partly-retracted.

## suite_probe.ts single-process OOM ceiling (2026-06-06)
A single-process probe that runs many compiles (e.g. 20 specs × 3 seeds × 5
budgets = 300 compiles, including 150k/200k) silently drops later high-budget
rows: the run exits 0 but the 150k/200k suite lines never print. Almost
certainly the WASM-engine memory ceiling after 100+ in-process compiles (the
golden harness sidesteps this with one worker process per job). Keep ad-hoc
in-process probes SMALL (few specs/seeds, or split budgets across invocations),
or shell out per (spec,seed,budget). Single-seed sweeps were fine; 3-seed×5-budget
was not. Also: single-seed suite numbers are NOT representative — warmup=1 looked
like a +160 win at 50k seed-0 but was a regression across 3 seeds. Always
multi-seed before forming a hypothesis.

## current-fingerprint baseline drift (2026-06-06)
`npm run golden:v1` currently prints live evaluator fingerprint `816c00d44528`
while `scripts/v0/golden_suite.ts` still records `9b9776df145f`. The focused
optimizer tests pass and a fresh canonical baseline completed, but historical
archives with the old fingerprint correctly refuse `decide` comparison. Treat
`generated/golden-runs/baseline-current-plan/golden.json` as the current local
baseline for compiler probes until the fingerprint tripwire is reconciled in a
separate ruler/baseline cleanup.

Fresh canonical reruns on 2026-06-06 also showed the same drift. The clean-reset
baseline comparison anchor before the reset was
`generated/golden-runs/baseline-7f91ce8/golden.json`; the first target-state-only
reset archive was `generated/golden-runs/attempt-target-state-reset-a01/golden.json`.

During planning, the first identical
`tiny_dance,opening_burst × seeds 0,1,2 × budgets 25k,200k` archive landed at
HEADLINE `41.76`, while repeated runs immediately afterward were stable at
`531.50` with matching row hashes. The later repeated archives and direct
single-spec runs agree, so the first archive is best treated as a stale/anomalous
probe artifact. When a tiny probe shows a very large swing, repeat the same
archive before using it as a failure-shape diagnosis.
