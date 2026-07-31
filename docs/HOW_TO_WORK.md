# How To Work On The Compiler

The active compiler campaign compares the current compiler with a retained
750k-only baseline at N=48, then explicitly promotes a convincing result. The
frozen 250k/500k/750k V2 baseline remains intact for later restoration.

## Normal loop

```bash
# Regenerate and validate deterministic benchmark metadata when needed.
npm run benchmark -- prepare

# Read-only: verify the official 750k/N=48 baseline and exact work.
npm run benchmark -- status

# Official comparison: 44 cases x 48 seeds = 2,112 candidate compiles.
npm run benchmark -- eval --seeds=48 --jobs=48

# Promote a favorable comparison artifact.
npm run benchmark -- rebaseline \
  --from=generated/benchmark-v2/eval/RUN.json.comparison.json \
  --label=descriptive-label
```

The active campaign accepts only N=48. There is no N=2/N=4 probe and no
adaptive depth sequence. Its baseline cache is the checksummed exact fresh
N=48/750k scorer-bound archive, so every comparison compiles only the 2,112
candidate cells.

The frozen full-ladder machinery is still inspectable with
`--baseline=benchmark/v2/baseline.json`. It is not the campaign acceptance
surface while 250k and 500k are deferred.

`eval --seeds=48` always exits 0 after a completed comparison. The artifact
contains the statistical result; an inconclusive or negative scientific result
is not a process failure. `--resume --out=SAME_PATH` resumes the exact frozen
candidate snapshot and checkpoint.

## What to inspect

- headline delta, seed-block SE, and interval;
- movement at 750k;
- representative, capability, regression, and development-music strata;
- validity gains and losses;
- largest case regressions and improvements;
- whether the result matches the proposed physical mechanism.

The confidence calculation is a useful common ruler, not a permission system.
Multiple inspected candidates or repeated runs create selection effects;
record them honestly and use a sufficiently clear final comparison for
promotion.

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

`benchmark/v2/campaign-baseline.json` names the active 750k compiler snapshot
and N=48 cache. The current cache is the fresh accumulated-contacted-frame-
impulse bootstrap archive. It reuses only the historical baseline's literal
seed schedule; it does not project or compare old-ruler scores.

`rebaseline --from=...` verifies the measured snapshot and current committed
compiler identity, retains the candidate 750k development evidence, and starts
the next campaign cache directly from that N=48 archive. It neither compiles
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
