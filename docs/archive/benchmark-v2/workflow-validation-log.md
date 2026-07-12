# Benchmark V2 Workflow Validation Log

Started: 2026-07-12 09:20 CEST. Starting commit: `eb38721`.

## Purpose

Validate Benchmark V2 by using it for real compiler development. This is not
only a compiler campaign: the benchmark commands, statistics, records,
diagnostics, timings, and operator decisions are themselves under review.

For every material step, record:

- the command and wall time;
- the observed output and independently checked evidence;
- the inference, including uncertainty and alternative explanations;
- the resulting action;
- any friction, ambiguity, or defect.

The qualification specifications remain indicative and must not drive
candidate selection. A stage-0 probe is screening evidence, not promotion
authority. Only a fresh declared `eval --to-verdict` attempt may change the
baseline.

## Starting State

- Benchmark reliability repair: committed as `eb38721`.
- Baseline: `accept-2026-07-11T22-38-42Z-d7b3f327`.
- Probe headline: `446.0945`; validity `221/252`.
- Era: cap `0.05`, spent `0`, cumulative exposure `0.0588`, no attempt in
  flight, no transition pending.
- Certified menu: improvement depth 48 and simplification margin 5 depth 48;
  each charges `0.0196`.
- Known unrelated working-tree state left untouched:
  `.claude/scheduled_tasks.lock`, the `@openai/codex` package changes,
  `scripts/v0/study_terminal_impact_pair.ts`, and `shelter_impact_sync.ts`.

## Runs And Decisions

Entries are appended chronologically during the campaign.

### 1. Discoverability and retained baseline explanation

Commands:

```text
npm run --silent benchmark -- help --no-resource-stats
npm run --silent benchmark -- explain generated/benchmark-v2/eval/stage0-2026-07-12T07-05-30Z.json
```

Observed:

- Help: exit 0, 0.49 s wall, 119 MB max RSS. It cleanly distinguishes stage-0
  screening, certified `--to-verdict`, rebaseline, and standalone analysis.
- Explain: exit 0, 0.94 s wall, 151 MB max RSS. It independently recomputed the
  retained headline `446.09`, budgets `438.58`/`449.10`, validity `107/126`
  and `114/126`, and wrote checksummed JSON/Markdown explanations.
- All 18 capability rows fail at 250k. At 500k, pickup is 2/3, dense recovery
  1/3, 240 ms dense recovery 2/3, 4 s endurance 1/3, and 5 s endurance 0/3.
- Phase evidence localizes the boundaries: pickup degrades at 180–200 ms;
  dense recovery at three-contact figures/dense stream; endurance at the 5 s
  omission. The 5 s run shown reaches 55/90 contacts and stalls before the
  rideout contact despite predicted budget slack `3.314`.
- Outside capability cases, the weakest valid tracks are
  `believer_56_6s_impact_relief`, `believer_56_6s`, and the dense-dialogue
  pair. Impact is their dominant RMS error (`0.32` to `0.45`).

Interpretation:

- Capability validity is the clearest first target. Improving it can move a
  zero-score stratum while testing the intended frontier semantics.
- The endurance miss is not evidence that simply adding compute works: 500k
  still fails all 5 s seeds, and the compiler spends the full budget while a
  structural traversal predictor claims ample slack.
- A bounded breadth study is justified before changing arc geometry: lowering
  per-node sampling may trade local choice quality for enough traversal
  diversity to find a viable long-gap prefix. This is a falsifiable test, not a
  proposed production default.

Decision: screen `LR_QUALITY_NCAND=24` as candidate round 1.

### 2. Candidate round 1: unified breadth 24

Commands:

```text
LR_QUALITY_NCAND=24 npm run --silent benchmark -- eval --json --jobs=48 --no-resource-stats
npm run --silent benchmark -- decide generated/benchmark-v2/eval/stage0-2026-07-12T07-24-10Z.json
npm run --silent benchmark -- explain generated/benchmark-v2/eval/stage0-2026-07-12T07-24-10Z.json
```

Observed:

- Eval: exit 0, 75.45 s wall, 7.49 GB max aggregate RSS. Headline
  `446.09 -> 450.91`, point delta `+4.82`; outcome `UNRESOLVED`.
- Validity `221 -> 224/252`: five gained and two lost. The 250k arm is
  `+9.62` with interval `[+6.15,+13.10]`; the 500k arm is `+2.89` with a
  very wide `[-32.25,+38.04]` interval.
- Representative point delta is `+1.77`, but its interval crosses zero widely.
  Capability point delta is only `+1.44`: four gained runs are offset by two
  lost runs and lower scores on some survivors.
- Capability movement is mechanistically mixed. It gains shifted pickup 1/3
  at 500k and raises 4 s endurance from 1 total valid run to three, but loses
  the baseline's 500k dense-recovery success. The 5 s rideout remains 0/6.
- Largest case gains include `believer_56_6s_impact_relief +88.00` (validity
  5/6 -> 6/6) and 4 s endurance `+38.85`. Largest losses include
  `split_signal_impact_relief_12 -48.68` and `high_air_drive_air_minus_5
  -34.19`, both without validity changes.
- Standalone decide: exit 2 (`UNRESOLVED`), 12.35 s wall, 258 MB max RSS. It
  recomputed the archive and recommends roughly 12 seeds/budget to resolve an
  effect of this size; the certified menu only offers depth 48.
- Explain: exit 0, 0.94 s. Axis RMS is essentially unchanged, supporting a
  traversal/allocation mechanism rather than a broad quality-model gain.

Interpretation:

- This is promising screening evidence, not an acceptance result. The 250k
  gain is coherent, while 500k and per-stratum uncertainty remain large.
- Lower breadth reallocates work productively in some families, but `24` is not
  uniformly better. A small response curve around it is more informative than
  immediately spending a 48-seed confirmation epoch.

Decision: screen breadth `20` and `28`, then choose whether any source default
is mechanistically justified and worthy of fresh confirmation.

### 3. Candidate round 2: unified breadth 20

Command:

```text
LR_QUALITY_NCAND=20 npm run --silent benchmark -- eval --json --jobs=48 --no-resource-stats
```

Observed: exit 0, 75.55 s wall, 7.27 GB max aggregate RSS. Headline
`447.99`, delta `+1.89`, validity unchanged overall (`4` gained, `4` lost).
The 250k delta is `-10.89` with an extremely wide interval and the 500k delta
is `+7.00`, also unresolved. Representative validity falls by one and legacy
regression point score falls `-10.70`.

Interpretation: the response is not monotone. Breadth 20 over-allocates away
from local candidate quality; its headline masks churn and one development-
music validity gain. Reject this setting without confirmation spend.

Decision: continue the predeclared response check at breadth 28.

### 4. Candidate round 3: unified breadth 28

Command:

```text
LR_QUALITY_NCAND=28 npm run --silent benchmark -- eval --json --jobs=48 --no-resource-stats
```

Observed: exit 0, 74.44 s wall, 7.57 GB max aggregate RSS. Headline
`449.32`, delta `+3.23`; overall validity remains 221/252 with one gain and
one loss. Capability validity falls 6 -> 5 and its point score falls `-3.07`.
Representative score is `+1.21` with unchanged validity.

Interpretation: breadth 28 is inferior to 24 on both headline and frontier
coverage. Together, 20/24/28/current establish a local response: 24 is the
only tested value that improves total validity and does not lose representative
validity, while 20 is too lean and 28 does not recover enough traversal.

Decision: encode unified breadth 24 in source, verify that the source candidate
reproduces the environment study, then use fresh confirmation evidence. The
probe has selected the mechanism; it has not accepted it.

### 5. Source candidate equivalence

Changes: set both unified quality-breadth endpoints to 24 and update the policy
boundary test.

Observed:

- Focused compiler/policy tests: 41/41, 10.03 s wall, 313 MB max RSS.
- Source stage 0: exit 0, 75.07 s wall, 7.05 GB max aggregate RSS. It exactly
  reproduces the environment study: headline `450.912`, delta `+4.8175`,
  validity 224/252.
- Independent archive-row comparison found **252/252 identical** tasks,
  reports, scores, track hashes, and authored contacts between the environment
  study and source candidate. Candidate fingerprints differ, as expected,
  because one identity binds an environment override and one binds source.

Interpretation: the source edit is the mechanism that was screened; there is
no translation drift. Fresh paired evidence is now justified.

Important contamination note: `package.json` and `package-lock.json` contain
pre-existing user changes inside the deliberately broad compiler identity.
The candidate snapshot will therefore bind those bytes as well as the breadth
edit. Earlier zero-delta stage-0 evidence shows those package changes do not
alter these 252 outputs, but an accepted rebaseline cannot proceed until the
package changes are resolved or committed. This is workflow friction and a
governance constraint, not a reason to silently modify the user's files.

### 6. First formal confirmation attempt: infrastructure abort

Command:

```text
npm run --silent benchmark -- eval --to-verdict --json --jobs=48 --no-resource-stats
```

Declaration: attempt `2026-07-12T07-35-24Z-97196f0b`, operating point
`improve-t0-d48`, fresh epoch base `651677207`, 144 declared seed positions,
and era spend `0.0196`. The first baseline and candidate waves each completed
252/252 successful rows (42 sources x 3 budgets x seed slots 0-1).

Observed: exit 1 after 191.57 s wall, 8.29 GiB max aggregate RSS. No
statistical look or verdict was produced. The structured error claimed an
incomplete `k=2` scope with 0/252 rows, contradicting both progress output and
the checkpoint files.

Root cause: `checkpointDecisionRuns` passed nested runner rows directly to the
certified prefix selector. The selector correctly reads top-level `seedSlot`
from a `DecisionRun`, while checkpoints store it at `result.task.seedSlot`.
Thus `undefined < 2` rejected every complete row. Three independent audits
confirmed both checkpoints contain 252 unique successful rows and no worker
failure.

Governance response:

- The attempt was ledger-aborted with the infrastructure reason. Its `0.0196`
  spend stays charged and its seed interval stays reserved; no verdict exists.
- Because the repair changes protocol-bound `eval.ts`, the old declaration
  cannot be resumed or relabeled. A protocol migration and a fresh disjoint
  retry with `--acknowledge-retry` are required.
- Current-era spend is `0.0196/0.05`; a fresh retry will reach `0.0392/0.05`.

Repairs under validation: flatten checkpoint rows before prefix inference;
add an operator-facing `--abort-in-flight --reason=...`; make worker-failure
JSON include reason, attempt, charged spend, retained evidence, and next
command; make global resource flags consistent; list only certified menu rows
in help; label non-menu depth estimates non-runnable; and make `explain`
surface profile, evidence authority, nearest capability boundaries, and weak
fully-valid cases.

### 7. Fresh retry and full formal verdict

Command:

```text
npm run --silent benchmark -- eval --to-verdict --acknowledge-retry --json --jobs=48 --no-resource-stats
```

Declaration: attempt `2026-07-12T07-49-30Z-36432e51`, fresh epoch base
`1896893702`, candidate fingerprint `bfa554f1...`, compound nominal alpha
reported as `0.0199`, and current-era spend raised to `0.0392/0.05`.

Observed looks:

| k | Delta | SE | Futility upper bound | Action |
|---:|---:|---:|---:|---|
| 2 | +2.17 | 5.56 | +18.40 | continue |
| 3 | +2.87 | 5.89 | +14.36 | continue |
| 4 | +2.97 | 4.14 | +10.75 | continue |
| 8 | +2.16 | 4.21 | +9.45 | continue |
| 16 | +0.0028 | 2.56 | +4.31 | continue |

The non-monotone SE curve is real block heterogeneity, not a reporting error.
The rule consistently continued because no one-sided 95% upper bound was below
the improvement threshold. This is conservative and aligned with the certified
`+5` target, but `k=16` continuing from a near-zero estimate incurred most of
the remaining wall time.

Final observed result:

- Exit 2, `INCONCLUSIVE`; 3,445.65 s (57m25.65s) wall and 9.51 GiB maximum
  aggregate RSS.
- Headline `450.4528 -> 453.3585`, delta `+2.9057`, SE `1.5651`, one-sided
  99% lower/upper bounds `[-0.7774,+6.5888]`. Not promotable.
- 250k: `+12.0825`, lower bound `+1.17`, validity `1712 -> 1732/2016`.
- 500k: `+0.9284`, lower bound `-3.5598`, validity `1834 -> 1820/2016`.
- 750k: `+0.0833`, lower bound `-6.9161`, validity `1889 -> 1886/2016`.
- Representative: `+6.4701`, lower bound `+1.8639`, validity
  `4011 -> 4028/4032`. Capability: `-8.2750`, validity `273 -> 259/864`.
  Legacy regression is `-4.4816`; development music is `+1.3194`.

Independent evidence checks:

- Both checkpoints contain 6,048/6,048 unique successful rows: 42 sources,
  budgets 250k/500k/750k, and all seed slots 0-47.
- Generated and retained gzip archives are byte-identical. The decision file's
  SHA-256 equals the verdict ledger event.
- SciPy independently reproduces the headline and per-budget one-sided and
  central t bounds to stored rounding.

Decision: do not accept, do not rebaseline, and restore the compiler defaults.
The mechanism is useful specifically at 250k and on representative dense/high-
air work, but a universal breadth of 24 harms capability and does not improve
500k/750k reliably. A future candidate should make allocation difficulty- or
slack-aware rather than globally reducing breadth.

Full-depth workflow refinements after settlement:

- Final declaration linkage now runs on the archives already parsed by the
  decision validator instead of parsing each 361 MiB JSON archive twice.
  Replay of the frozen full evidence reproduced the exact verdict in 157.43 s
  at 1.63 GiB process RSS. The integrity checks remain identical.
- JSON stdout is now a 3.3 KiB actionable envelope instead of the 32.3 KiB
  complete artifact/era projection; the complete checksummed artifact remains
  on disk. Futility and worker-failure exits also carry explicit attempt,
  spend, evidence, and next-command fields.
- Future verdict artifacts are written directly beside retained run evidence.
  This campaign's complete verdict is mirrored at
  `benchmark/v2/runs/2026-07-12T07-49-30Z-36432e51-verdict-inconclusive.json`;
  its SHA-256 is identical to the ledgered generated artifact.
- Compiler defaults were restored; focused compiler tests pass 41/41.
- Final post-migration stage 0 completed in 73.57 s at 6.86 GiB aggregate
  RSS and reproduced the baseline exactly: delta 0, validity 221/252 on both
  sides, no in-flight attempt. This confirms no rejected compiler behavior was
  left active.

## Friction Register

1. `explain` is fast and trustworthy for top-level validity, but its stdout does
   not rank low-scoring valid sources or incomplete capability phases. The JSON
   contains the data but is thousands of lines, requiring an ad hoc query.
2. Help does not show expected wall times or era spend for `--to-verdict`.
   Those facts exist in documentation, but an operator at the command boundary
   cannot estimate the next action's cost.
3. `decide --no-resource-stats` is rejected as an unsupported flag even though
   it is a top-level CLI resource-control flag accepted by eval/migration. The
   rerun without the flag worked.
4. The decide hint estimates that about 12 seeds/budget would resolve this
   screen, but there is no certified depth-12 menu row. It is useful diagnostic
   information, yet the next executable formal step jumps directly to depth 48.
5. A completed two-arm confirmation look failed before inference because a
   private integration boundary had no nested-checkpoint regression test.
6. The workflow told operators to "record an abort" but exposed no supported
   command for doing so; a one-off TypeScript invocation was necessary.
7. Invalid worker exits could degrade to generic JSON with no attempt ID,
   charged spend, evidence paths, reason, or recovery command.
8. The 4-second endurance variant retains the parent phase ID `rideout_5s`.
   Scoring boundaries are intact, but diagnostic output is semantically
   confusing. Renaming it is a future suite change, not an output-layer alias.
9. Final verification parsed both 361 MiB archives twice and produced a large
   stdout record. The duplicate parse and verbose envelope are fixed above.

## Final Assessment

The workflow is now usable as the compiler-development decision system it was
intended to be. It rejected a probe-selected but non-promotable compiler change,
preserved every failed and completed attempt honestly, exposed the mechanism's
budget/stratum tradeoff, and produced enough retained evidence to reproduce the
decision independently. The compiler tree has been restored rather than
silently carrying the inconclusive change.

The live campaign also proved that repository tests alone were insufficient:
the first real wave found a checkpoint-shape integration defect. That defect,
its abort/retry governance, machine output, menu wording, archive diagnostics,
and final parse overhead are now repaired and covered. Three approved protocol
migrations kept the inference and calibration fingerprints unchanged.

Final verification: 56/56 test files and 497/497 tests pass; the last stage-0
smoke is 252/252 successful and bit-equivalent at the score/headline level.

Residual limitations are explicit:

- Certified improvement work has only one depth-48 operating point. It is
  appropriately conservative for `+5`, but can spend roughly an hour when a
  candidate remains plausibly positive through `k=16` and ultimately resolves
  inconclusive around `+3`.
- A new attempt would exceed the current era's 0.05 cap (`0.0392` is already
  spent). Further formal confirmation requires a justified ledgered override
  or an accepted rebaseline; ordinary stage-0 exploration remains free.
- Full archive decision assembly still costs about 157 s and 1.63 GiB process
  RSS even after removing the duplicate parse. A future compact, archive-bound
  decision sidecar could reduce this further, but it needs its own integrity
  design rather than an ad hoc shortcut.
- The held-out qualification monitor correctly did not run for an inconclusive
  candidate, so its accepted-candidate branch was not exercised in this
  campaign; existing conformance tests remain the evidence for that path.
