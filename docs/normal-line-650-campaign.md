# Normal-line compiler campaign

Opened 2026-09-07 under the owner's new constraint: only normal type-0 lines.
**Completed:** `normal-motion-feedback` is accepted and promoted at **662.5889**,
352/352 valid at 750k/N=8. The chronological research record follows. Benchmark V2 and its score remain fixed. The
607.2582 normal-line baseline and its full canonical cache are restored.

The acceleration campaign is preserved on `archive/native-motion-feedback-761`
(commit `7cb77df1`), with production review on `codex/native-motion-video-review`.
Its 761.9107 score is not a result under the normal-line constraint. The three
full production videos are being generated in an isolated checkout and retained
under `generated/reviews/native-motion-2026-09-07/`.

## Starting hypotheses

The acceleration result demonstrated that exact collision-position observation,
computed-prefix reuse, body-pose feedback, and direct motion planning can work
together. Those ideas are distinct from the acceleration material itself.
Test what normal collision geometry can realize before assuming their control
authority disappears with type 1. Normal collision response changes position
through unilateral projection; its admissible direction and penetration must be
measured with the actual solver and full rider constraints.

First, derive point-local type-0 controls and test sustained physical support,
turning, and timed release/recapture with exact frozen-engine replay. Use the
failure geometry to revise the motion plan and actuator, rather than treating
a direct material swap as a verdict on the approach. Other directions remain
open, including joint passive catches and gravity/heading planning.

The ordinary public entry point currently uses the previous normal compiler.
The packaged exact cache/observation backend remains available for research;
none of its physics differs from the frozen judge. No normal-line candidate
has yet been evaluated or promoted.

## First physical results

A type-0 projection controller sustains 96 contacts across 2,400 fixture frames
in 181,729 charged frames, all intact and exactly reproduced by the frozen judge.
The first flat fixture fails after four frames; projecting inadmissible requested
forces into the actual one-sided normal-collision domain extends it to 300.
These are feasibility checks, not benchmark scores.

The initial full development pass has 41 valid sources, two startup failures,
and one telemetry exception. Counting the exception as a failed source gives a
567.2234 discovery aggregate. The startup failures are aligned rider points:
a horizontal normal plane can project another point up to ten units behind it,
so making a line narrow does not alone isolate it. Small physical tilts separate
the tangent coordinates of nearby points; no masks or engine changes are used.
The two repaired sources score 690.1249 and 684.8488 with all contacts valid.

The telemetry exception occurs when the final full replay completes the authored
track even though the construction loop stopped early. Recording that measured
completion consistently fixes the attribution; the recorder and benchmark
accounting are unchanged. The repaired source scores 722.7296, valid, within
749,774 frames. The new full pass measures all sources under the same correction.

The first four normal-line exploratory scores were 655.8880 (amplitude tides),
586.5796 (dense recovery), 676.8371 (transition mosaic), and 458.0052 (impact
Believer), all valid. Believer's large speed residual makes it a useful case for
studying the motion plan's physical feasibility. These are discovery runs on
seed 260907011, not a canonical comparison. Raw artifacts, checksums, and plans
are under `generated/benchmark-v2/normal-line-650/`.

The corrected full 44-source discovery pass reaches **662.5888**, **44/44 valid**
at actual 750k budgets. All exported lines are type 0. Plan SHA:
`5c0f78771c4b79654d2292c601ffc57734e4ad00a90d4fb882d9b99826f89ffa`.
This remains an exploratory reading until the public implementation passes the
canonical comparison. Public manual-start replay reproduces geometry, reports,
and charged frames exactly. Twelve focused integration/identity/CLI tests and
61 broader optimizer/budget tests pass. Two full tracks also exactly match the
published JavaScript engine, including every raw trajectory frame and event.

The long-tail open-hook case spends most of its budget attempting support after
the last authored impact window even though its retained physical track already
completes the spec. This is a compiler efficiency defect to address before the
canonical comparison. The verified 662.5888 implementation is retained in git.

The completion fix validates and charges a full physical continuation when a
support proposal fails after the final authored impact window. It stops only
if that actual complete output passes the unchanged report contract; otherwise
ordinary backtracking continues. Open-hook amplitude now completes in **103,448
frames**, score **722.6170**, versus 749,774 frames / 722.7296. It makes a small
quality/computation tradeoff rather than claiming track parity. The completed
track still receives its independent frozen-engine cold replay. This change
also passes the public compiler/CLI tests and a physical regression test for
vertically aligned rider points; the latter compares the full trajectory with
the frozen judge and asserts only type-0 output.

All three acceleration production videos are now complete, verified, and
preserved with source, original music, benchmark evidence, and checksums in
`archives/native-motion-feedback-2026-09-07/`. The main workspace has switched
to `codex/normal-line-650`; the video branch and archive remain intact.

## Final governed result and completed goal

The final compiler is frozen at `06680c3c`. The governed command is:

```bash
npm run benchmark -- eval --seeds=48 --jobs=40 \
  --out=generated/benchmark-v2/eval/normal-motion-2026-09-07.json
```

It accepts at N=8 with **662.5889**, **352/352 valid**, and **+55.3569 paired
points** (SE 0.9294) over the matching old normal-line prefix, 607.2320.
Observed t=59.56197547 exceeds the unchanged 4.81061015 boundary. All 44
sources are evaluated at the actual 750k budget on seeds 16–23. Later looks
are not queued. The new compiler is deterministic on these zero-jitter specs;
paired variation comes from the old compiler. The run completes in 1m32s;
its 48,458,976 physical frames range from 60,775 to 238,882 per compile,
median 122,733.5. No old canonical baseline rows are recompiled.

Candidate fingerprint:
`3ce6b356f9bcd18041e8e0818fd727683019f14859ca6144922c570f24eab1e1`.
Source fingerprint:
`2149de41ba31b88500eabc8cfd5ccf8d83123339722b0ffa3e9f1dad7ec9944f`.
Snapshot SHA:
`53e30857d3fb440b31584b1ee5f7e4cd37b7bd1dc20ced39936c7e3d51c8ca30`.
The suite, scorer, evaluator, judge, listening review, and decision identities
all match the pre-campaign baseline. The physical regression test and public
compiler enforce only type-0 geometry. Two full tracks audited against the
published JavaScript engine have hashes identical to all eight corresponding
canonical outputs, so those audits also cover the final candidate's geometry.

| Stratum | Old paired prefix | Final normal compiler |
|---|---:|---:|
| Representative | 640.8936 | 681.4566 |
| Capability | 484.4946 | 630.9487 |
| Legacy regression | 609.6639 | 629.2496 |
| Development music | 499.3183 | 560.0406 |

Fourteen source averages regress, despite all four stratum gains. The largest
are impact Believer (−183.5657), its amplitude variant (−162.1426), and the
original/shifted off-grid conversation (−85.3468 / −84.9558). They remain valid.
The validation index retains every regressed source. This is an aggregate
improvement, not a claim that every specification improves or that the new
fine-grained normal geometry is visually preferable.

After this evaluation, the standing 250k arm completes **528/528 valid**.
The exact old-baseline arm from the earlier acceleration comparison is reused:
its compiler fingerprint, seed grid, scorer, and archive hashes match. The
initial orchestrator is deliberately stopped after the complete new arm is
written and verified, before it can duplicate the old baseline's 528 compiles.
The unmodified report command then derives the comparison:

```bash
npm run benchmark:v2:low-budget-reading -- \
  --report=generated/benchmark-v2/low-budget/arms/2026-09-07T21-32-44-423Z-after-normal-motion-eval/tree.json.gz,generated/benchmark-v2/low-budget/arms/2026-09-07T19-17-25-334Z-after-native-motion-initial-eval/baseline.json.gz \
  --label=after-normal-motion-eval-reused-baseline
```

The verdict is `RESCUE-POSITIVE`: **63 rescued, zero lost**, versus 465/528
baseline validity. Its renormalized subset score is **670.9793 versus 552.3198**;
its arithmetic per-cell seed-blocked gain is **191.6936**, SE **4.9870**.
Neither is the suite headline. The old arm's 135,019,423 physical frames are
retained evidence, not newly executed work in this normal-line reading.

Frozen-candidate qualification uses:

```bash
LR_ENGINE=wasm node --import tsx scripts/v0/benchmark_v2/run_benchmark.ts \
  --runner-mode=qualification --profile=canonical \
  --development-archive=generated/benchmark-v2/eval/normal-motion-2026-09-07.N8.json \
  --jobs=24 --out=generated/benchmark-v2/eval/normal-motion-qualification.json
```

All **120/120** qualification runs are valid. Per-budget monitor scores are
645.8415, 646.4513, and 641.4508 at 250k/500k/750k, respectively; the weighted
monitor is **644.8292**, not a headline. This sidecar costs 10,403,960 physical
frames, maximum 147,272 per compile. No compiler changes or tuning follow this
monitor. Its results do not alter the deferred lower-budget governance fields.

Final budget-range audits cover three sources at 150k, 750k, 1M, and 3M:
all twelve tracks are valid and within budget. River reentry scores 680.2066
in 122,273 frames at all four budgets. Long low-air endurance scores 676.7553
in 125,031 frames at 150k, and 701.2336 in 238,882 frames at larger budgets.
Open-hook amplitude scores 722.6170 in 103,448 frames at all four budgets,
confirming the completion fix removes the earlier wasted tail search.
The 1M/3M outputs and counts match 750k exactly on all three audits.

Promotion uses the ordinary accepted-comparison path:

```bash
npm run benchmark -- rebaseline \
  --from=generated/benchmark-v2/eval/normal-motion-2026-09-07.json.comparison.json \
  --label=normal-motion-feedback
node --import tsx scripts/benchmark/analyze_campaign_baseline.ts
```

The active baseline now retains the **662.5889 / N=8** prefix and its measured
compiler snapshot. The normal-line above-650 objective, acceleration-branch
preservation, and requested production videos are all complete. The concise
campaign, `goal.md`, and current-baseline analysis record the outcome.
`benchmark/v2/studies/normal-motion-feedback-validation.json` indexes the evidence,
checksums, line-type enforcement, regressions, and preserved video gallery.
