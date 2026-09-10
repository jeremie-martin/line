# Current benchmark: frozen V4

The current public canonical result is **952.4115**, with all **352/352** runs
valid across **176 specifications × seeds 16/17**, at **750,000 actual physics
frames per run**. The normal, coherent arc constraint remains in force. Follow
[`goal.md`](../goal.md), the [V4 contract](../benchmark/v4/README.md), and the
[current campaign evidence](arc-v4-940-campaign.md). The V2 workflow and campaign
status below are historical; they do not replace the V4 evaluation contract.

# Current owner constraint — 2026-09-08

The active compiler campaign uses coherent, visible arc primitives made from
normal type-0 lines. The owner rejected the constellation of tiny control
segments in the video review. Arc shapes and control may evolve, but the
physical track must satisfy that visual requirement. Full production videos
are part of evaluating the result. Acceleration output
is preserved on a separate branch for video review. `goal.md` and
`arc-motion-650-campaign.md` supersede the earlier unrestricted-material
campaign status below; other compiler research restrictions remain removed.
The active baseline is `arc-control-memory`, **852.1248**, accepted at N=8
with 352/352 valid canonical runs (44 cases, seeds 16–23). All three full
vertical production videos are archived locally. Code and compact evidence
are pushed; large archives stay local at the owner's request. See
[`arc-850-campaign.md`](arc-850-campaign.md) for the accepted result,
and [`compiler-foundations.md`](compiler-foundations.md) for the cleanup audit.
The headline is the campaign decision metric. Qualification is a disclosed
diagnostic, with invalid runs scored normally; an individual regression does
not create an additional perfection veto. This follows the owner's clarification.

# How To Work On The Compiler

Compiler research scope is open within the owner's material and arc-geometry
requirements in `goal.md`. The benchmark and score stay fixed. Historical
mechanism closures, deferrals, and study caps are evidence to reconsider, not
permission barriers. The current performance campaign is `arc-850-campaign.md`;
the preceding audit is `compiler-integrity-audit.md`.

The active compiler campaign compares the current compiler with a retained
750k-only baseline at strict N=8/16/32/48 looks, then explicitly promotes an
accepted result. The
frozen 250k/500k/750k V2 baseline remains intact for later restoration.

## Normal loop

```bash
# Regenerate and validate deterministic benchmark metadata when needed.
npm run benchmark -- prepare

# Read-only: verify the official 750k baseline, first look, and maximum work.
npm run benchmark -- status

# Official experiment: at most 44 cases x 48 seeds = 2,112 candidate compiles.
npm run benchmark -- eval --seeds=48 --jobs=48

# Promote a favorable comparison artifact.
npm run benchmark -- rebaseline \
  --from=generated/benchmark-v2/eval/RUN.json.comparison.json \
  --label=descriptive-label
```

`--seeds=48` declares the maximum; it does not queue all 2,112 compiles at
once. The runner completes every case for seed slots `[0,8)`, publishes and
decides that prefix, and only then may resume the same checkpoint through
N=16, N=32, and N=48. Workers are spread across cases and seed slots within a
wave rather than exhausting 48 seeds for one case first. The one-sided total
false-promotion tolerance is 5%; one calibrated O'Brien-Fleming Student-t
boundary derives every look threshold. The symmetric boundary can reject
clear harm early. There is no predictive futility stop.

The terminal prints one concise line only after a complete 44-case seed block
exists, even when workers finish individual cases out of order. Each line shows
that round's validity and paired delta, the cumulative candidate headline,
paired delta, measured seed-block SE and directional Student-t probability,
worker failures, throughput, and ETA. At N=8/16/32/48 it also prints `LOOK`
with the calibrated requirement and action. Probabilities on intervening rounds
are descriptive feedback, never additional stopping opportunities.

The neighboring `.progress.jsonl` is an append-friendly, diagnostic-only copy
of those exact round summaries. It is rebuilt from the verified baseline
reference and successful checkpoint rows on resume, so it neither changes the
checkpoint identity nor becomes promotion evidence. The checksummed
`.round-progress-reference.json` binds the baseline rows used for the display.

The current cache covers its accepted N=8 prefix. A baseline promoted at N=8,
N=16, or N=32 initially retains only that accepted prefix. If a later candidate reaches
a missing look, eval pauses without queuing candidate tail work and prints the
exact `baseline-cache extend` plus `eval --resume` commands. Extension appends
only the missing frozen-baseline rows.

The frozen full-ladder machinery is still inspectable with
`--baseline=benchmark/v2/baseline.json`. It is not the campaign acceptance
surface while 250k and 500k are deferred.

`eval --seeds=48` always exits 0 after a completed comparison. The artifact
contains the statistical result; an inconclusive or negative scientific result
is not a process failure. `--resume --out=SAME_PATH` resumes the exact frozen
candidate snapshot and checkpoint. Eval preserves any original `--artifact`
destination in the frozen request and printed resume command, and refuses a
concurrent process targeting that same attempt output.

## What to inspect

- headline delta, seed-block SE, and interval;
- movement at 750k;
- representative, capability, regression, and development-music strata;
- validity gains and losses;
- largest case regressions and improvements;
- whether the result matches the proposed physical mechanism.

The directional Student-t probability is an interpretable summary, and its SE
uses the measured paired seed-block variation. The unadjusted probability is
not the gate: the calibrated repeated-look boundary is. At a declared look,
crossing the positive boundary means `accept`, crossing the negative boundary
means `reject`, and an uncrossed N=48 means `inconclusive`.
Multiple inspected candidates or repeated runs create selection effects;
record them honestly and use a sufficiently clear final comparison for
promotion.

Ordinary `rebaseline` accepts only a comparison whose governed outcome is
`accept`. A deliberate owner decision may override that gate with
`--force --force-reason="..."`. This does not change the measured outcome:
the published reference records the original verdict, `forced: true`, and the
reason. Use it for an explicit policy decision, never to make an inconclusive
interval look conclusive.

## The low-budget reading — after an eval

The acceptance surface is 750k only. Run the standing low-budget reading after
an eval, whichever way the eval went:

```bash
npm run benchmark:v2:low-budget-reading -- --jobs=16 --label=after-<your-eval>
```

It compiles the capability mini manifest — all three frontier groups whole plus
one back-filled control per remaining stratum, 11 sources — at **250k x 48
seeds**, in two arms: the working tree, and the promoted campaign baseline's
compiler. Roughly ten to twenty minutes for 1,056 compiles. `--dry-run` prints
the plan and the resolved baseline without compiling anything.

**Why it is a separate step and not part of eval.** It is *tracked but never
promoting* — the owner's answer to the acceptance-surface question
(`budget-dividends-plan.md` Phase 0b). It writes nothing to governance state,
appears in no comparison artifact, and cannot accept or reject anything. What
it does is make a class of result visible that the promoting instrument
structurally cannot see: at 750k on the promotion ladder's own seeds the
capability sources are already all valid, so a mechanism whose value is
*rescuing compiles that fail* has nothing to rescue and can only lose
(`budget-aware-map.md` §6.2). At 250k the failures exist.

**Why 250k.** It is the measured rescue budget, not a calibration boundary: it
is where the Phase-1 rescue-class reading was taken, it is a member of the
canonical suite's own budget profiles, and it is one of the two budgets the
campaign deferred rather than deleted — so if the reading is ever converted
into a promoting tier it reuses this operating point instead of inventing one.
300k was the edge of the remaining-work estimator's calibrated domain, which is
an argument about a model; evidence wants the regime where completions are
actually at risk. That model question has since resolved the same way — the
estimator's floor moved to 250k on 2026-08-03 — so this operating point reads
calibrated margins rather than nulls.
The historical prefix-search reading had **118 of 528 baseline
cells invalid at 250k** — `dense_recovery_frontier` valid on 17 of 96,
`rapid_pickup_frontier` on 57 of 96 — on the promotion ladder's own seeds,
where 750k had none. The accepted arc-refinement compiler now completes
**528/528** in this standing 250k reading; its track outputs match the prior
arc-guidance baseline exactly. Keep the reading to detect future regressions.

**The baseline arm** is resolved from `benchmark/v2/campaign-baseline.json`'s
`compiler_snapshot` — the checksum-verified tarball the promotion itself
verified — extracted over a detached worktree carrying the *current* benchmark
framework, exactly as the eval machinery does it. It is deliberately not a git
checkout of the promoting commit: the snapshot survives history edits, and
holding the framework fixed across arms means only the compiler differs.
(`mover_grid.ts --ref` is the right tool when you genuinely want to compare two
commits; a baseline is not a commit.)

**Reading the output.** One block: who versus whom, the verdict, the capability
group table, the paired delta blocked by seed, and the action-set power footer
(always, never optional). The verdict vocabulary is fixed and its criteria live
in the instrument's header — `PARITY`, `RESCUE-POSITIVE`, `SCORE-POSITIVE`,
`ADVERSE`, `UNDERPOWERED`. `UNDERPOWERED` is the honest common case for a small
action set and is not a failure; the footer states what action set the
observation would have needed.

Every run writes `generated/benchmark-v2/low-budget/<timestamp>-<label>.json`
with a checksum sidecar — full per-cell records for both arms, the derived
tables, the power statement, and both compilers' fingerprints — and appends one
line to `index.jsonl`, so readings accumulate into a history that a later study
can consume without re-running anything. The two arm archives are kept gzipped
under `arms/` (~17 MB rather than ~195 MB; `--keep-raw-arms` opts out) and
`--report=<tree.json.gz>,<baseline.json.gz>` re-derives a reading from them.

The aggregate the reading prints is a renormalized subset score. It is not the
suite headline and must never be quoted as one; per-cell scores and
complete-group scores are exact.

## Variant families

When one mechanism has several credible implementations:

```bash
npm run benchmark -- family capture NAME --variant=MEMBER
npm run benchmark -- family run NAME
npm run benchmark -- family select NAME --variant=MEMBER
```

Family evidence is shared-seed exploration. Bake the selected behavior into
source defaults before a normal cached comparison.

## Baselines

`benchmark/v2/campaign-baseline.json` names the active 750k compiler snapshot,
promotion depth, four-look policy, and cache maximum. The current cache is the
`compiler-integrity` archive under the accumulated contacted-frame impulse scorer,
accepted at N=8 with a 777.8193 headline. It retains the canonical seed schedule
and makes no cross-ruler score comparison.

`rebaseline --from=...` verifies the measured snapshot and current committed
compiler identity, retains the candidate 750k development evidence, and starts
the next campaign cache directly from its accepted stopping prefix. The
promotion headline remains tied to that depth. A later completed cache tail is
reported only as a descriptive monitoring headline and never overwrites the
promotion headline. After rebaseline, refresh the tracked current-baseline
analysis from that exact prefix, including when acceptance stops before N=48:

```bash
node --import tsx scripts/benchmark/analyze_campaign_baseline.ts
```

Rebaseline neither compiles
nor changes the deferred 250k/500k evidence.

`benchmark/v2/baseline.json` remains the frozen full-ladder reference. Use
`benchmark baseline` only for an intentional full-suite freeze or restoration.
Its scores predate the active scorer boundary and must not be reported as
deltas against the current campaign.

## Discipline

When a physical component study resumes ordinary compiler search from a
directly admitted fit, local axis and geometry equality is insufficient.
`tryCandidateLines` does not attach the `ref` that ordinary sampling adds for
future catch reuse. Restore the current probe's reference for a reusable
source candidate and preserve applicable provenance while keeping freshly
measured physical fields. Before interpreting continuation deltas, require
an unchanged readmitted fit to reproduce the original control's track,
report, and charged frames through the ordinary snapshot API. The September
interrupted-support study verifies this distinction on 22 exact prefixes.

- Keep one mechanism per candidate where practical.
- Prefer focused tests and bounded panels before expensive runs.
- Do not tune case by case or against qualification monitors.
- Keep compute-dependent mechanisms continuous across at least 150k and
  1M-3M; never key compiler behavior to 750k or benchmark budget identity.
- Kinematic planning, new normal-line geometry, and other compiler mechanisms
  are authorized by `goal.md`; acceleration materials are excluded from the
  active normal-line campaign.
- Preserve resumable outputs for long runs.
- Keep raw/generated archives out of commits.
- Treat old declarations, certification studies, and accounting files as
  historical material, not runnable workflow.
