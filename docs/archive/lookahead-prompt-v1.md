# Lookahead campaign — working prompt

> **ARCHIVE (Benchmark V1).** Do not follow this workflow for current compiler
> decisions. Use `docs/HOW_TO_WORK.md`. Historical commands below require the
> explicit `golden:v1` and `decide:v1` aliases.

**Read first.** `docs/archive/lookahead-campaign-v1.md` (scope) and `docs/archive/lookahead-log-v1.md` (attempt record).

**Goal.** Push the golden headline **up** by improving the forward-eval lookahead — anything in scope: rollout config (variant/depth/branch, aim in rollout vs top-level, budget-adaptive), candidate count / pool size, ranking, how the leaf scores a branch (whole-branch today / per-gap / readiness), and where readiness is used (today only the per-gap pool sort — leaf? first pool only? a better metric?). New approaches welcome. **North star: headline ≥ 700**; every accepted change moves it up.

**Measure with the standard golden suite (not a probe script).**
- Baseline = latest committed production. Historical command: `LR_ENGINE=wasm npm run golden:v1 -- --jobs=32 --archive-dir=generated/baseline`.
- Per attempt: `LR_ENGINE=wasm npm run golden:v1 -- --jobs=32 --archive-dir=generated/cand`, then `npm run decide:v1 -- generated/cand/golden.json generated/baseline/golden.json` (candidate first).
- Gotchas: `--jobs=32` (equals form — a space silently runs jobs=6); workers import the tree per task, so never edit code mid-run; numbers only from real runs. (May subset seeds via `GOLDEN_SEEDS_OVERRIDE` to explore, but decide on the full run.)

**Workflow — modify production directly; keep only wins.**
1. Hypothesis from the log + evidence. Free to add (default-off) telemetry, write analysis scripts, do exploratory runs first.
2. Smallest change to the **production default** — no flag, no A/B knob hiding it.
3. Run golden; `decide` vs baseline.
4. ACCEPT (headline up, no real regression) → commit + promote its golden.json to baseline. REJECT → revert the code (keep the log entry + any scripts), baseline unchanged.
5. Terse, objective log entry: hypothesis · change · result (headline Δ + per-budget) · verdict. Facts only — no mechanistic "why."

**Keep it simple.** One production path, accumulating only accepted wins. No flag-gating the change under test, no unnecessary A/B, no dead knobs. Clean minimal diffs; the log records everything.
