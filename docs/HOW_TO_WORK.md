# How To Work On The Compiler

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

The current cache already covers N=48. A baseline promoted at N=8, N=16, or
N=32 initially retains only that accepted prefix. If a later candidate reaches
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
promotion depth, four-look policy, and cache maximum. The current cache is the fresh accumulated-contacted-frame-
impulse bootstrap archive. It reuses only the historical baseline's literal
seed schedule; it does not project or compare old-ruler scores.

`rebaseline --from=...` verifies the measured snapshot and current committed
compiler identity, retains the candidate 750k development evidence, and starts
the next campaign cache directly from its accepted stopping prefix. The
promotion headline remains tied to that depth. A later completed cache tail is
reported only as a descriptive monitoring headline and never overwrites the
promotion headline. Rebaseline neither compiles
nor changes the deferred 250k/500k evidence.

`benchmark/v2/baseline.json` remains the frozen full-ladder reference. Use
`benchmark baseline` only for an intentional full-suite freeze or restoration.
Its scores predate the active scorer boundary and must not be reported as
deltas against the current campaign.

## Discipline

- Keep one mechanism per candidate where practical.
- Prefer focused tests and bounded panels before expensive runs.
- Do not tune case by case or against qualification monitors.
- Keep compute-dependent mechanisms continuous across at least 150k and
  1M-3M; never key compiler behavior to 750k or benchmark budget identity.
- Keep acceleration/kinematic-line work deferred.
- Preserve resumable outputs for long runs.
- Keep raw/generated archives out of commits.
- Treat old declarations, certification studies, and accounting files as
  historical material, not runnable workflow.
