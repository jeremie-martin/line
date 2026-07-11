# Documentation map

**Start here:** [`HOW_TO_WORK.md`](HOW_TO_WORK.md) — the single how-to-work doc (goal,
how to run, how to decide, principles, active campaigns, current baseline).

Tags: **LIVE** = current guidance · **REFERENCE** = stable background · **ARCHIVE** =
historical record, not live guidance.

## Canonical (how to work + contract)

| Doc | Tag | What |
|---|---|---|
| [`HOW_TO_WORK.md`](HOW_TO_WORK.md) | LIVE | The entry point for the Benchmark V2 compiler workflow. |
| [`benchmark-v2-context.md`](benchmark-v2-context.md) | LIVE | Product distribution, scoring, holdout, compute, and governance contract. |
| [`benchmark-v2-decisions.md`](benchmark-v2-decisions.md) | LIVE | Statistical estimand, confidence method, policies, artifacts, and exit codes. |
| [`benchmark-v2.md`](benchmark-v2.md) | LIVE | Benchmark V2 commands and operations. |
| [`compiler_goals.md`](compiler_goals.md) | LIVE | Frozen compiler behavior and budget contract. |
| [`REBASELINE.md`](REBASELINE.md) | LIVE | How to freeze linked probe, canonical, and qualification baseline evidence. |
| [`engine-workflow.md`](engine-workflow.md) | LIVE | Current concise workflow for WASM engine-speed work. |
| [`compiler-speed-workflow.md`](compiler-speed-workflow.md) | LIVE | Behavior-preserving workflow for improving whole compiler wall-clock speed. |
| [`optimizer/12_handoff_prefix_search.md`](optimizer/12_handoff_prefix_search.md) | LIVE | The active compiler's search algorithm. |
| [`ARC_AIMING_FORMALIZATION.md`](ARC_AIMING_FORMALIZATION.md) | LIVE | The aiming model and the shared current-quality × readiness objective. |
| [`READINESS_ROADMAP.md`](READINESS_ROADMAP.md) | LIVE | Readiness design history and current composite readiness semantics. |
| [`ARC_STATE_CONTROL.md`](ARC_STATE_CONTROL.md) | LIVE | Arc-state control, joint model shape, and proposer/search boundary. |

## Live campaigns

The standard campaign and the focused sub-campaigns. Each focused campaign is a triad —
a `*-campaign.md` (scope), a `*-prompt.md` (working prompt), a `*-log.md` (attempt audit
trail) — plus its `scripts/v0/eval_<name>.sh` board.

| Doc | Tag | What |
|---|---|---|
| [`../GOAL_LDS_COMPILER_IMPROVEMENT.md`](../GOAL_LDS_COMPILER_IMPROVEMENT.md) | LIVE | The current standard campaign: raise HEADLINE (budget-value-weighted average) across the compiler. |
| [`geometry-campaign.md`](geometry-campaign.md) | LIVE | Arc shape/placement/aim is the ceiling. Board `eval_geometry.sh`; companions `geometry-prompt.md`, `geometry-log.md`. |
| [`lookahead-campaign.md`](lookahead-campaign.md) | LIVE | Forward-eval / rollout ranking. Companions `lookahead-log.md`, `forward-eval-map.html`. |
| [`planning-campaign.md`](planning-campaign.md) | LIVE | Long-horizon / global planning. Board `eval_planning.sh`; companion `global-planning.md`. |
| [`impact-mission.md`](impact-mission.md) | LIVE | Impact metric + steering (the campaign that produced the current baseline). Board `eval_impact.sh`; companions `impact-campaign.md`, `IMPACT_PAIR_PLANNING.md`. |

## Reference

| Doc | Tag | What |
|---|---|---|
| [`../README.md`](../README.md) | REFERENCE | Repo overview, quick start, architecture, engine choice. |
| [`../PROBLEM.md`](../PROBLEM.md) | REFERENCE | Problem statement and success criteria. |
| [`benchmark-v2-seed-allocation.md`](benchmark-v2-seed-allocation.md) | REFERENCE | Empirical V2 seed-count allocation study. |
| [`benchmark-v2-decision-calibration.md`](benchmark-v2-decision-calibration.md) | REFERENCE | Empirical and simulated V2 decision-rule calibration. |
| [`benchmark-v2-decision-coverage.md`](benchmark-v2-decision-coverage.md) | REFERENCE | Real-block, validity-flip, and hard-zero coverage stress for the formal gate. |
| [`benchmark-v2-responsiveness.md`](benchmark-v2-responsiveness.md) | REFERENCE | Graded and contract-level negative controls for the V2 score and gate. |
| [`benchmark-v2-resources.md`](benchmark-v2-resources.md) | REFERENCE | Measured 48-worker CPU, memory, and wall-time envelope. |
| [`metric_problem_statement.md`](metric_problem_statement.md) | ARCHIVE | Statistical rationale for the retired V1 metric and decision rule. |
| [`creative_workflow.md`](creative_workflow.md) | REFERENCE | Worked song→track→video example, and the `productions/<song>/` pipeline: `analyze_audio.py` → `characterize` → `select.json` → `npm run produce` (`scripts/produce/`). |
| [`engine_speed_methodology.md`](engine_speed_methodology.md) | REFERENCE | Detailed engine-perf statistics and historical method; see `engine-workflow.md` for current workflow. |
| [`impact_contract.md`](impact_contract.md) | REFERENCE | Self-contained per-beat impact contract (the impact metric definition). |
| [`impact_problem_statement.md`](impact_problem_statement.md) | REFERENCE | Impact semantics living doc. |
| [`impact_generation_and_landing_notes.md`](impact_generation_and_landing_notes.md) | REFERENCE | Impact-as-generation analysis + landing-redefinition notes. |
| [`budget-control-design.md`](budget-control-design.md) | REFERENCE | Conceptual contract for difficulty-normalized budget control and validation gates. |
| [`difficulty-model-study.md`](difficulty-model-study.md) | REFERENCE | First-completion cost vs full-score difficulty characterization. |
| [`../TOOLING_NOTES.md`](../TOOLING_NOTES.md) | REFERENCE | Living log of tooling/harness friction + resolutions. |

HTML views: `handoff-compiler.html` is a historical V1 generated view. The V2 baseline of
record is `../benchmark/v2/baseline.json`. `forward-eval-map.html` is **hand-maintained** (no generator); re-verify its
`scripts/v0/*.ts` file:line anchors when that code changes.

## Component READMEs (co-located with code)

[`../scripts/v0/optimizer/README.md`](../scripts/v0/optimizer/README.md) — optimizer
building blocks. Local to its directory; defers to the canonical docs above for the
metric/workflow.

## Archive (`docs/archive/` — historical, not live)

`GOAL_LDS_ARC_PLACEMENT.md`, `FOCUS_FRAGILE_SPECS.md`, `PLATEAU_CAMPAIGN_LOG.md`,
`GOAL_LDS_PLATEAU_BREAKOUT.md`, `GOAL_LDS_LOW_BUDGET.md`, `speed_policy_followups.md`,
`arc_placement.md`, `TODO.md`, `short-leaf-campaign.md`, `short-leaf-campaign-log.md`,
`SEARCH_ALGORITHM_ANALYSIS.md`, `FORWARD_EVAL_EXPERIMENTS.md`, `TRACK_REPAIR_EXPERIMENTS.md`.
Kept for the "don't-retry" record and design rationale; their scores predate the current
budget-aware / weighted-average metric (HEADLINE) and baseline.
