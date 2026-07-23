# Archived Benchmark V2 Era-Workflow Closure Register

> Historical validation record only. The workflow validated here has been
> retired. See `docs/HOW_TO_WORK.md` for current operating instructions.

This is the exhaustive closure list from the two live validation campaigns,
their adversarial reviews, and the current workflow audit. An item is closed
only by code plus evidence, or by an explicit boundary with an owner and a
testable condition for reopening it.

Machine-readable closure evidence is retained at
`benchmark/v2/evidence/workflow-closure-2026-07-12.json`; the subsequent
family-workflow extension and live exercise are recorded at
`benchmark/v2/evidence/family-exploration-validation-2026-07-12.json`.

Status vocabulary:

- **closed**: implemented and verified;
- **active**: implementation or evidence is required now;
- **certification**: statistical behavior cannot ship without fresh retained evidence;
- **suite rollover**: changes benchmark meaning and belongs in the next reviewed suite identity;
- **operator-owned**: external working-tree state, not something tooling may silently change.

## Operator workflow

| ID | Finding | Status | Closure evidence / requirement |
|---|---|---|---|
| OP-01 | `explain` did not prioritize weak valid cases or incomplete capability phases. | closed | It now reports both lists in human and JSON output; CLI tests cover probe authority. |
| OP-02 | Before declaration, operators could not see expected compute, measured wall time, certified spend, remaining era capacity, or rebaseline blockers. | closed | Read-only `benchmark status` reports the contract, era, certified menu/cost, dated host measurements, evidence health, and blockers; human/JSON tests prove no ledger mutation. |
| OP-03 | Global resource flags were rejected by strict subcommands. | closed | Resource flags are stripped at the CLI boundary; integration test covers `decide`. |
| OP-04 | Probe advice presented an unavailable depth estimate as though it were runnable. | closed | The estimate is labeled diagnostic and names the actual certified row. |
| OP-05 | The documented abort action had no supported command. | closed | `eval --abort-in-flight --reason=...` settles the attempt and states that spend remains charged. |
| OP-06 | Invalid/futility JSON could omit attempt, reason, evidence, spend, and recovery action. | closed | Structured failure, futility, and compact verdict envelopes are tested. |
| OP-07 | A sub-second refusal printed meaningless resource summaries. | closed | The monitor suppresses samples below one second. |
| OP-08 | Verdict artifacts were written only under ignored generated output. | closed | New verdicts live beside retained runs; the live inconclusive artifact has an identical retained mirror. |
| OP-09 | Promoting the first workable member of a parameterized mechanism could strand a better nearby implementation, while manual multi-variant work encouraged seed reuse and informal headline picking. | closed | The `family capture/run/select` lane snapshots up to eight deliberate members, uses one fresh shared probe epoch, reports paired and prefix-stability diagnostics, forbids qualification/decision use/alpha spend, requires exact source-default selection, and hands one winner to a fresh certified eval. Adaptive rounds allocate new seeds and never pool viewed evidence. The 504-compile live exercise and boundary checks are recorded in `family-exploration-validation-2026-07-12.json`. |

## Reliability and recovery

| ID | Finding | Status | Closure evidence / requirement |
|---|---|---|---|
| REL-01 | Interim looks passed nested checkpoint rows to a flat-row selector and read 0/252. | closed | Nested-row regression test and successful live looks at k=2/3/4/8/16. |
| REL-02 | `SIGKILL` can leave snapshot workspaces in `$TMPDIR`. | closed | Owner-stamped cleanup removes dead workspaces, preserves live owners, and reserves an absent path for `git worktree add`; live replay exercised the path. |
| REL-03 | Migration recovery lacks a direct process-kill injection test. | closed | A child is killed immediately after the durable journal; recovery publishes exactly once and a second recovery is a no-op. |
| REL-04 | Declaration revalidation lacks a forced scheduler race at the pre-append boundary. | closed | A two-process test forces a serialized baseline mutation ahead of append; the declaration re-reads under lock and refuses. |
| REL-05 | Baseline/migration publication journals were process-recoverable but not fully synced for host power loss. | closed | Atomic/exclusive writes fsync data and parent directories; archives, sidecars, ledger appends, journal transitions, and removals are synced and fault-tested. Hardware that lies about fsync remains outside the software contract. |
| REL-06 | Final linkage validation parsed each full archive twice. | closed | Linkage now validates the already-parsed archive; frozen replay reproduced the exact verdict. |

## Statistics and governance

| ID | Finding | Status | Closure evidence / requirement |
|---|---|---|---|
| STAT-01 | The only improvement row is depth 48: strong for +5, roughly 50% power at +3, and expensive when k=16 remains plausible. | certification | Design deeper and/or alternative-risk rows, then certify with fresh holdout evidence before adding them to the menu. |
| STAT-02 | A 95% promotion rule would increase power but breached retained stress bars. | closed | Keep 99% promotion. Any change is an inference migration with new calibration and holdout evidence, never a runtime flag. |
| STAT-03 | There is no retrospective deep era audit for accumulated accepted deltas. | certification | Specify the estimand and schedule, then certify an audit row; it may diagnose shortfall but cannot retroactively repair false accepts. |
| STAT-04 | Early-success stopping is absent, so large wins can overpay. | certification | Add only with optional-stopping simulation and independent holdout validation. |
| GOV-01 | Infrastructure aborts with no formal look consume a full era charge. | closed | Spend may be corrected only to zero for an aborted attempt with exactly zero formal looks; the real no-look abort was corrected append-only and its seed epoch remains reserved. |
| GOV-02 | Same-candidate retries compound nominal alpha even after a pre-look infrastructure abort. | closed | Retry counting uses positive-spend attempts. A corrected no-look abort does not add nominal alpha; any looked attempt does. Tests refuse post-look refunds. |
| GOV-03 | Current compiler-bound package changes prevent rebaseline. | operator-owned | Tooling must continue to name the dirty paths and refuse. The operator must commit or resolve them deliberately. |

## Performance and evidence

| ID | Finding | Status | Closure evidence / requirement |
|---|---|---|---|
| PERF-01 | Final decision assembly took about 157 s and 1.63 GiB RSS. | closed | New raw archives commit to checksummed decision-index payloads; exact headline-only bootstrap evaluation preserves the retained result byte-for-byte. Measured depth-48 assembly is 9.61 s / 198 MiB. Raw/index replay is part of the full probe runner-compatibility check (currently 264 rows). |
| PERF-02 | Depth-48 retained evidence adds about 200 MiB per two-arm attempt. | closed | `status` inventories retention units and `status --evidence` lists reviewable unreferenced files. At closure: 67/73 referenced, zero missing, 11.7 KiB unreferenced. Nothing is auto-deleted. |
| PERF-03 | Confirmation cost is hard to estimate from compile count alone at the command boundary. | closed | Status prints exact 12,096 development compiles plus 120 accept-only qualification compiles and labels 74 s / 57 min / 9.51 GiB as a dated host reference. |

## Suite and qualification

| ID | Finding | Status | Closure evidence / requirement |
|---|---|---|---|
| SUITE-01 | The 4-second endurance variant retains phase ID `rideout_5s`. | suite rollover | Rename in source/materializer at the next intentional suite rollover; refresh lock, evidence, listening review, calibration identity, and baseline together. Do not alias it only in output. |
| QUAL-01 | The latest inconclusive campaign did not execute qualification. | closed | Qualification is accept-only by design. The retained accepted branch is checksum-valid with 120/120 successful runs and monitor 383.0495. Depth 48 applies to development; qualification uses 8 seeds/budget. |

## Documentation

| ID | Finding | Status | Closure evidence / requirement |
|---|---|---|---|
| DOC-01 | Too many overlapping Markdown files mix current guidance, RFCs, and historical validation. | closed | The live map points to `HOW_TO_WORK.md` plus context, decision, and benchmark contracts. Completed RFC/reliability/validation logs moved under `docs/archive/benchmark-v2/`. |
| DOC-02 | Some live wording still describes unavailable retries/depths or pre-fix behavior. | closed | Live docs now match the certified menu, exit/retry/refund contract, status output, V9 identity, decision indexes, qualification count, and measured costs. |

## Completion rule

The immediate cleanup is complete when every **active** item above is either
closed with tests/evidence or deliberately moved to **certification**, **suite
rollover**, or **operator-owned** with a concrete reopening condition. Compiler
optimization resumes only after that audit is internally consistent.
