# How To Work On The Compiler

Benchmark V2 is the default compiler-development workflow. One principle
drives it: **never spend compute a cheaper stage could have saved, but
always end with evidence you can trust.**

## Read First

- `benchmark-v2-context.md`: what the benchmark represents and how qualification is interpreted.
- `benchmark-v2-decisions.md`: estimand, confidence method, outcomes, and limits.
- `benchmark-v2-review.md`: the eval-chain design, its certified evidence, and the governance contract.
- `benchmark-v2.md`: commands, artifacts, preparation, and diagnostics.
- `compiler_goals.md`: compiler behavior and budget contract.
- `../GOAL_LDS_COMPILER_IMPROVEMENT.md`: active improvement loop.

Historical V1 instructions are in `archive/HOW_TO_WORK_V1.md` and do not apply to the default commands.

## The chain

Everything is one command, `eval`, used at two intensities.

```bash
# Validate and regenerate deterministic benchmark evidence.
npm run benchmark -- prepare

# STAGE 0 (~2 min): informational screen of the current tree vs the stored
# baseline probe reference. Repeatable all day; consumes nothing. Explore
# LR_ knobs freely here — e.g. LR_IMPACT_LOCAL_W=0.65 npm run benchmark -- eval
npm run benchmark -- eval

# CONFIRMATION (~50 min two-arm at depth 48): declare a certified operating
# point, run both frozen snapshots on a fresh paired epoch in waves, take the
# declared futility looks, decide at the declared depth.
npm run benchmark -- eval --to-verdict                          # improve, θ=0
npm run benchmark -- eval --to-verdict --mode=simplify --margin=5

# After an accept: light rebaseline (the attempt's archives become the era
# record; one fresh probe becomes the screening reference; minutes).
npm run benchmark -- rebaseline --label=NAME

# Diagnose failures and weak cases.
npm run benchmark -- explain ARCHIVE.json
```

A candidate for confirmation must be an **actual source-default change**
(a real `candidateFingerprint`), never an `LR_` environment override — an
accepted baseline must be reproducible from the tree alone.

Public physics runs use WASM, default to 48 workers, cap budgets at 750k, report host/process resources, and retain resumable checkpoints. Use `--jobs=N` when the host is shared. `--resume` continues a crashed attempt from its checkpoint; a fired futility stop is durable.

## Meaning of results

Stage 0 prints the observed delta, its seed-block SE, the realized pairing,
and an advice line projecting whether an effect of that size would resolve
at the certified depth (the projection is a labeled heuristic; the certified
quantities are the grid cells). Exit codes: 0 completed, 1 invalid.

A `--to-verdict` attempt ends one of four ways (exit code):

- **accept** (0) — the one-sided 99% lower bound cleared the threshold.
  Only this promotes. `rebaseline` is the next command.
- **inconclusive** (2) — the evidence did not resolve the question. The
  report names the depth that would likely have resolved the observed
  delta. The sanctioned path is an acknowledged retry on a fresh epoch
  (`--acknowledge-retry`; prior evidence is never pooled).
- **reject** (3) — the upper bound fell below the threshold.
- **futility stop** (4) — an interim look showed the attempt cannot
  realistically end in accept; most of the compute was saved. The spend
  stays charged.

For a simplification, the margin is declared before any confirmation
compile; accept means "not worse than −m at 99% confidence". An
inconclusive non-inferiority result is not permission to accept.

## Operating points and the era budget

`eval --to-verdict` only runs **certified operating points** from
`benchmark/v2/eval-policy.ts` — rows whose error rates were measured against
the retained compile references (`menu-certification.json`,
`holdout-validation.json`) and re-verified by the guard at declare time. v1
menu: improve θ=0 at depth 48 (futility looks at 2/3/4/8/16 blocks) and
simplify m=5 at depth 48. Anything else is refused.

Each attempt charges its row's certified worst-case false-accept bound to
the **era α-budget** (cap 0.05, roughly three attempts per era). The budget
resets only on an accepted rebaseline or a suite rollover. Exhaustion blocks
declarations until a ledgered `--override-era-budget=<cap> --reason=…`. The
permanent ledger (`benchmark/v2/attempts.jsonl`) accumulates every attempt
and the project-wide expected-false-accept sum.

## Baseline

`benchmark/v2/probe-baseline.json` is the reusable screening reference. `benchmark/v2/baseline.json` records the compiler of record, its checksummed compiler/WASM snapshot, the era record, and the frozen decision contract (inference, protocol, calibration fingerprints). A confirmation never compares against an already-visible archive: the declaration freezes both snapshots before either arm runs, on a newly allocated seed epoch no prior attempt has seen.

A suite change is an era rollover (new listening review included). A
decision-surface change requires `npm run benchmark -- migrate` (scopes:
protocol / calibration / inference; behavior changes escalate to inference
scope and re-certification). Operational runner changes require a reviewed,
checksummed bit-identity approval for the exact implementation pair.

## Legacy path (until the eval chain's live validation completes)

The one-shot `canonical` + `decide` + `baseline` commands remain fully
operational as the trusted legacy path and retire only after the eval
chain passes its live validation (V1–V7, `benchmark-v2-validation.md`).

```bash
npm run benchmark -- canonical --decision-mode=improvement
npm run decide -- GENERATED_DEVELOPMENT_ARCHIVE
npm run benchmark -- baseline --label=NAME
```

## Discipline

- Keep one mechanism per candidate when feasible.
- Run focused tests before a screen and the full test suite before confirmation.
- Declare before looking: mode, margin, and depth are frozen in the attempt declaration; heed the printed budget and retry warnings.
- Diagnose invalid runs, validity flips, termini, phases, and case-level deltas before changing policy.
- Never tune case by case against qualification monitor outputs; the monitor runs only after an accept.
- Never edit generated compatibility manifests directly; edit typed cases or `benchmark/v2/policy.ts` and run `prepare`.
- Any suite, scorer, target interpretation, weight, profile, seed-policy, execution-protocol, decision-rule, or calibration change requires a migration or a new baseline — the guards name the command.

V1 remains explicitly available for historical reproduction:

```bash
npm run golden:v1 -- --full
npm run decide:v1 -- CANDIDATE/golden.json BASELINE/golden.json
```
