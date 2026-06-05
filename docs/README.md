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

## Live campaigns (root)

| Doc | Tag | What |
|---|---|---|
| [`../GOAL_LDS_ARC_PLACEMENT.md`](../GOAL_LDS_ARC_PLACEMENT.md) | LIVE | Latest in-boundary campaign: catch-geometry placement. |
| [`../FOCUS_FRAGILE_SPECS.md`](../FOCUS_FRAGILE_SPECS.md) | LIVE | Side campaign to stabilize 5 fragile specs (separate harness: seeds 200–209, curve metric). |

## Reference

| Doc | Tag | What |
|---|---|---|
| [`../README.md`](../README.md) | REFERENCE | Repo overview, quick start, architecture, engine choice. |
| [`../PROBLEM.md`](../PROBLEM.md) | REFERENCE | Problem statement and success criteria. |
| [`metric_problem_statement.md`](metric_problem_statement.md) | REFERENCE | Statistical rationale behind the metric (noise floor, seed counts). |
| [`creative_workflow.md`](creative_workflow.md) | REFERENCE | Worked song→track→video example. |
| [`../TOOLING_NOTES.md`](../TOOLING_NOTES.md) | REFERENCE | Living log of tooling/harness friction + resolutions. |

## Component READMEs (co-located with code)

[`../scripts/v0/optimizer/README.md`](../scripts/v0/optimizer/README.md) (optimizer
building blocks) and [`../dashboard-v2/README.md`](../dashboard-v2/README.md) (dashboard
app). Local to their directories; they defer to the canonical docs above for the
metric/workflow.

## Archive (`docs/archive/` — historical, not live)

`PLATEAU_CAMPAIGN_LOG.md`, `GOAL_LDS_PLATEAU_BREAKOUT.md`, `GOAL_LDS_LOW_BUDGET.md`,
`speed_policy_followups.md`, `arc_placement.md`, `TODO.md`. Kept for the "don't-retry"
record and design rationale; their scores predate the 2026-06-04 metric change.
