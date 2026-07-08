# Lookahead campaign — working prompt

**Read first.** `docs/lookahead-campaign.md` (scope) and `docs/lookahead-log.md` (every attempt + result — don't repeat a logged dead end; leading un-promoted candidate is `greedy:1`, a high-budget win with a ~300k crossover). `docs/forward-eval-map.html` (the verified pool → rank → rollout → leaf → DFS map). Production code: `optimizer/handoff.ts` (`parseForwardSpec`, `forwardRolloutScore`, `objectiveLeafValue`, `rankedOptions`), `optimizer/node.ts` (`getCandidatesSorted`), `optimizer/aim.ts` (`candidateQualityObjective`), `optimizer/{objective,readiness}.ts`. `CLAUDE.md` (minimal-simulation rule — never violate).

**Goal.** Push the golden headline **up** by improving the forward-eval lookahead — anything in scope: rollout config (variant/depth/branch, aim in rollout vs top-level, budget-adaptive), candidate count / pool size, ranking, how the leaf scores a branch (whole-branch today / per-gap / readiness), and where readiness is used (today only the per-gap pool sort — leaf? first pool only? a better metric?). New approaches welcome. **North star: headline ≥ 700**; every accepted change moves it up.

**Measure with the standard golden suite (not a probe script).**
- Baseline = latest committed production. Establish from a *clean committed HEAD*, full canonical run (never stale or seed-subset): `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/baseline`.
- Per attempt: `LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/cand`, then `npx tsx scripts/v0/analyze_golden_curve.ts decide generated/cand/golden.json generated/baseline/golden.json` (candidate first). On accept, that golden.json becomes the new baseline.
- Gotchas: `--jobs=32` (equals form — a space silently runs jobs=6); workers import the tree per task, so never edit code mid-run; numbers only from real runs. (May subset seeds via `GOLDEN_SEEDS_OVERRIDE` to explore, but decide on the full run.)

**Workflow — modify production directly; keep only wins.**
1. Hypothesis from the log + evidence. Free to add (default-off) telemetry, write analysis scripts, do exploratory runs first.
2. Smallest change to the **production default** — no flag, no A/B knob hiding it.
3. Run golden; `decide` vs baseline.
4. ACCEPT (headline up, no real regression) → commit + promote its golden.json to baseline. REJECT → revert the code (keep the log entry + any scripts), baseline unchanged.
5. Terse, objective log entry: hypothesis · change · result (headline Δ + per-budget) · verdict. Facts only — no mechanistic "why."

**Keep it simple.** One production path, accumulating only accepted wins. No flag-gating the change under test, no unnecessary A/B, no dead knobs. Clean minimal diffs; the log records everything.
