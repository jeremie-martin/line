# Documentation map

**Start here:** [`HOW_TO_WORK.md`](HOW_TO_WORK.md) — the single how-to-work doc (goal,
how to run, how to decide, principles, active campaigns, current baseline).

Tags: **LIVE** = current guidance · **REFERENCE** = stable background · **ARCHIVE** =
historical record, not live guidance.

## Canonical (how to work + contract)

| Doc | Tag | What |
|---|---|---|
| [`HOW_TO_WORK.md`](HOW_TO_WORK.md) | LIVE | The entry point. Workflow, run tiers, decision rule, principles. |
| [`compiler_goals.md`](compiler_goals.md) | LIVE | Frozen contract + the **HEADLINE metric** definition (the metric's single source of truth). |
| [`REBASELINE.md`](REBASELINE.md) | LIVE | How to record a new baseline from a canonical golden run. |
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
| [`metric_problem_statement.md`](metric_problem_statement.md) | REFERENCE | Statistical rationale behind the metric (noise floor, seed counts). |
| [`creative_workflow.md`](creative_workflow.md) | REFERENCE | Worked song→track→video example, and the `productions/<song>/` pipeline: `analyze_audio.py` → `characterize` → `select.json` → `npm run produce` (`scripts/produce/`). |
| [`engine_speed_methodology.md`](engine_speed_methodology.md) | REFERENCE | Engine-perf method; cites the running `OPTIMIZATION_LOG.md` ledger. |
| [`impact_contract.md`](impact_contract.md) | REFERENCE | Self-contained per-beat impact contract (the impact metric definition). |
| [`impact_problem_statement.md`](impact_problem_statement.md) | REFERENCE | Impact semantics living doc. |
| [`impact_generation_and_landing_notes.md`](impact_generation_and_landing_notes.md) | REFERENCE | Impact-as-generation analysis + landing-redefinition notes. |
| [`../TOOLING_NOTES.md`](../TOOLING_NOTES.md) | REFERENCE | Living log of tooling/harness friction + resolutions. |

HTML views: `handoff-compiler.html` is **generated** — its baseline-of-record regions are
spliced in by `scripts/v0/update_compiler_doc.ts` (edit the data via the generator, the
prose by hand). `forward-eval-map.html` is **hand-maintained** (no generator); re-verify its
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
