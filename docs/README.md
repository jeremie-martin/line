# Documentation map

**Start here:** [`HOW_TO_WORK.md`](HOW_TO_WORK.md) — the single how-to-work doc (goal,
how to run, how to decide, principles, active campaigns, current baseline).

A tag here never outranks a file's own banner: if a document opens by calling
itself historical, it is ARCHIVE regardless of what this table once said. That
inversion is how three superseded campaigns stayed indexed as LIVE.

Tags: **LIVE** = current guidance · **REFERENCE** = stable background · **ARCHIVE** =
historical record, not live guidance.

## Canonical (how to work + contract)

| Doc | Tag | What |
|---|---|---|
| [`HOW_TO_WORK.md`](HOW_TO_WORK.md) | LIVE | Current frozen V4 workflow, product constraints and design/performance tradeoffs. |
| [`benchmark-v2-context.md`](benchmark-v2-context.md) | REFERENCE | Product distribution, scoring, holdout, compute, and governance contract. |
| [`benchmark-v2-decisions.md`](benchmark-v2-decisions.md) | REFERENCE | Statistical estimand, confidence method, policies, artifacts, and exit codes. |
| [`benchmark-v2.md`](benchmark-v2.md) | REFERENCE | Benchmark V2 commands and operations. |
| [`compiler_goals.md`](compiler_goals.md) | LIVE | Frozen compiler behavior and budget contract. |
| [`compiler-improvement-campaign.md`](compiler-improvement-campaign.md) | REFERENCE | The append-only campaign log. Dated entries; the header names the accepted baseline. |
| [`BALLISTIC_READINESS_DECISIONS.md`](BALLISTIC_READINESS_DECISIONS.md) | REFERENCE | Why the ballistic/readiness contract says what it says: settled decisions, evidence, and ten falsified hypotheses. |
| [`benchmark-v2-baseline.md`](benchmark-v2-baseline.md) | REFERENCE | Generated summary of the currently accepted baseline. |
| [`benchmark-v2-multi-budget.md`](benchmark-v2-multi-budget.md) | REFERENCE | Frozen compact multi-budget profile, paired scale decision, and execution workflow. |
| [`compiler-telemetry-foundation.md`](compiler-telemetry-foundation.md) | LIVE | Strict compile telemetry semantics, identities, invariants, and trust boundary. |
| [`benchmark-v2-audit.md`](benchmark-v2-audit.md) | REFERENCE | Suite audit and case provenance. |
| [`REBASELINE.md`](REBASELINE.md) | REFERENCE | Accepted-attempt rebaseline and initial/suite-rollover bootstrap semantics. |
| [`engine-workflow.md`](engine-workflow.md) | LIVE | Current concise workflow for WASM engine-speed work. |
| [`compiler-speed-workflow.md`](compiler-speed-workflow.md) | LIVE | Behavior-preserving workflow for improving whole compiler wall-clock speed. |
| [`../scripts/v0/optimizer/README.md`](../scripts/v0/optimizer/README.md) | LIVE | Current arc compiler and retained fallback map. |
| [`compiler-design-audit-2026-09-11.md`](compiler-design-audit-2026-09-11.md) | LIVE | Behavioral audit, shared arc controls, physical-state transfer and measured tradeoffs. |
| [`compiler-v2-workflow.md`](compiler-v2-workflow.md) | ARCHIVE | Superseded V2 workflow and sequential-promotion instructions. |
| [`compiler-review-fixes-2026-09-11.md`](compiler-review-fixes-2026-09-11.md) | LIVE | Engine ownership, reference imports, legacy diagnostics, review cache and baseline-test corrections; exact 952.4115 V4 parity. |
| [`compiler-integrity-audit.md`](compiler-integrity-audit.md) | REFERENCE | Earlier 777.82 compiler: implementation audit, measured inefficiencies, corrections and validation. |
| [`arc-planning-continuity.md`](arc-planning-continuity.md) | REFERENCE | Preserved 771 compiler and first budget-interruption correction. |
| [`compiler-foundations.md`](compiler-foundations.md) | REFERENCE | Cleanup audit, exact parity and research follow-up. |
| [`arc-continuation-boundary-study.md`](arc-continuation-boundary-study.md) | REFERENCE | Adopted continuation-value research, higher-budget gains and the initially observed qualification regression. |
| [`optimizer/12_handoff_prefix_search.md`](optimizer/12_handoff_prefix_search.md) | REFERENCE | Retained legacy prefix-search algorithm. |
| [`BALLISTIC_READINESS_CONTRACT.md`](BALLISTIC_READINESS_CONTRACT.md) | REFERENCE | Pre-implementation source of truth for ballistic projection, gap composition, readiness, and proposal-utility boundaries. |
| [`ARC_AIMING_FORMALIZATION.md`](ARC_AIMING_FORMALIZATION.md) | ARCHIVE | The aiming model and the shared current-quality × readiness objective. |
| [`READINESS_ROADMAP.md`](READINESS_ROADMAP.md) | REFERENCE | Historical readiness experiments and former composite semantics; not the current contract. |
| [`ARC_STATE_CONTROL.md`](ARC_STATE_CONTROL.md) | ARCHIVE | Arc-state control, joint model shape, and proposer/search boundary. |

## Campaigns

The current result is [952.5191 on frozen V4](compiler-design-audit-2026-09-11.md),
following the 940 campaign and subsequent integrity and design audits.
Earlier framework-specific campaigns remain historical references.

| Doc | Tag | What |
|---|---|---|
| [`arc-refinement-campaign.md`](arc-refinement-campaign.md) | REFERENCE | Accepted 767 milestone, higher-budget results and full evidence. |
| [`../goal.md`](../goal.md) | LIVE | Current compiler result, goal status and retained campaign history. |
| [`impact-delivery-650-campaign.md`](impact-delivery-650-campaign.md) | ARCHIVE | Frozen-evaluator campaign contract for passive contact-transition geometry, the 620 checkpoint, and the >650 target. |
| [`impact-delivery-650-baseline-atlas.md`](impact-delivery-650-baseline-atlas.md) | ARCHIVE | Exact current-baseline impact loss slices and counterfactual ceilings used to aim the 650 campaign. |
| [`shelter-budget-sweep-four-priority-implementation.md`](shelter-budget-sweep-four-priority-implementation.md) | ARCHIVE | Evidence and implementation record for budget identity, breadth, repair, persistent gaps, and the accepted outgoing-amplitude response law. |
| [`one-terminal-adaptive-repair-results.md`](one-terminal-adaptive-repair-results.md) | ARCHIVE | Frozen evidence that selected the clean-break one-terminal starting point. |
| [`impact-mission.md`](impact-mission.md) | LIVE | Current impact mission, ownership boundaries, and change discipline. |

## Reference

| Doc | Tag | What |
|---|---|---|
| [`../README.md`](../README.md) | REFERENCE | Repo overview, quick start, architecture, engine choice. |
| [`../PROBLEM.md`](../PROBLEM.md) | REFERENCE | Problem statement and success criteria. |
| [`benchmark-v2-seed-allocation.md`](benchmark-v2-seed-allocation.md) | REFERENCE | Empirical V2 seed-count allocation study. |
| [`benchmark-v2-decision-calibration.md`](benchmark-v2-decision-calibration.md) | REFERENCE | Empirical and simulated V2 decision-rule calibration. |
| [`benchmark-v2-decision-coverage.md`](benchmark-v2-decision-coverage.md) | REFERENCE | Real-block, validity-flip, and hard-zero coverage stress for the formal gate. |
| [`benchmark-v2-sequential-eval-calibration.md`](benchmark-v2-sequential-eval-calibration.md) | LIVE | Scorer-bound N=8/16/32/48 boundary calibration, validation, and retrospective replay. |
| [`benchmark-v2-responsiveness.md`](benchmark-v2-responsiveness.md) | REFERENCE | Graded and contract-level negative controls for the V2 score and gate. |
| [`benchmark-v2-resources.md`](benchmark-v2-resources.md) | REFERENCE | Measured 48-worker CPU, memory, and wall-time envelope. |
| [`metric_problem_statement.md`](metric_problem_statement.md) | ARCHIVE | Statistical rationale for the retired V1 metric and decision rule. |
| [`creative_workflow.md`](creative_workflow.md) | REFERENCE | Worked song→track→video example, and the `productions/<song>/` pipeline: `analyze_audio.py` → `characterize` → `select.json` → `npm run produce` (`scripts/produce/`). |
| [`engine_speed_methodology.md`](engine_speed_methodology.md) | REFERENCE | Detailed engine-perf statistics and historical method; see `engine-workflow.md` for current workflow. |
| [`impact_definition.md`](impact_definition.md) | LIVE | Concise production formula, exact frame semantics, ruler, and legacy policy. |
| [`impact_contract.md`](impact_contract.md) | LIVE | Self-contained per-beat impact contract across authoring, scoring, and generation. |
| [`budget-control-design.md`](budget-control-design.md) | REFERENCE | Conceptual contract for difficulty-normalized budget control and validation gates. |
| [`difficulty-model-study.md`](difficulty-model-study.md) | REFERENCE | First-completion cost vs full-score difficulty characterization. |
| [`../TOOLING_NOTES.md`](../TOOLING_NOTES.md) | ARCHIVE | V1-era tooling notes; its own banner warns the commands may no longer exist. |

HTML views: `archive/handoff-compiler-v1.html` is a historical V1 generated view. The active V2 campaign baseline of
record is `../benchmark/v2/campaign-baseline.json`; `../benchmark/v2/baseline.json` is the frozen historical full ladder. `forward-eval-map.html` is **hand-maintained** (no generator); re-verify its
`scripts/v0/*.ts` file:line anchors when that code changes.

## Component READMEs (co-located with code)

[`../scripts/v0/optimizer/README.md`](../scripts/v0/optimizer/README.md) — optimizer
building blocks. Local to its directory; defers to the canonical docs above for the
metric/workflow.

## Archive (`docs/archive/` — historical, not live)

`GOAL_LDS_COMPILER_IMPROVEMENT_V2.md`, `GOAL_LDS_ARC_PLACEMENT.md`, `FOCUS_FRAGILE_SPECS.md`, `PLATEAU_CAMPAIGN_LOG.md`,
`GOAL_LDS_PLATEAU_BREAKOUT.md`, `GOAL_LDS_LOW_BUDGET.md`, `speed_policy_followups.md`,
`arc_placement.md`, `short-leaf-campaign.md`, `short-leaf-campaign-log.md`,
`lookahead-campaign-v1.md`, `lookahead-prompt-v1.md`, `lookahead-log-v1.md`,
`push-700-log-v1.md`, `compiler-improvement-log-v1.md`,
`compiler-baseline-evolution-v1.csv`, `handoff-compiler-v1.html`,
`SEARCH_ALGORITHM_ANALYSIS.md`, `FORWARD_EVAL_EXPERIMENTS.md`, `TRACK_REPAIR_EXPERIMENTS.md`.
Kept for the "don't-retry" record and design rationale; their scores predate the current
budget-aware / weighted-average metric (HEADLINE) and baseline.

`archive/benchmark-v2-one-shot/` preserves the retired pre-eval V2 promotion
procedure. Its commands are historical records, not live operational guidance.
`archive/benchmark-v2/` preserves the completed eval-chain RFC and validation
campaigns; they are evidence history, not current operating instructions.
This includes the retired
[`closure register`](archive/benchmark-v2/closure-register-era-workflow.md) and
[`era operating points`](archive/benchmark-v2/operating-points-era-workflow.md).

The retired impact campaigns are preserved as
`archive/impact-mission-2026-06-15.md` and
`archive/impact-generation-and-landing-notes-2026-06-09.md`.
