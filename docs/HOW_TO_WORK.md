# How To Work On The Compiler

Benchmark V2 is the default compiler-development workflow. One principle
drives it: **never spend compute a cheaper stage could have saved, but
always end with evidence you can trust.**

## Read First

- `benchmark-v2-context.md`: what the benchmark represents and how qualification is interpreted.
- `benchmark-v2-decisions.md`: estimand, confidence method, outcomes, and limits.
- `benchmark-v2.md`: commands, artifacts, preparation, and diagnostics.
- `benchmark-v2-closure-register.md`: the latest adversarial workflow audit and its evidence-backed dispositions.
- `compiler_goals.md`: compiler behavior and budget contract.
- `../GOAL_LDS_COMPILER_IMPROVEMENT.md`: active improvement loop.

Historical V1 instructions are in `archive/HOW_TO_WORK_V1.md` and do not apply to the default commands.

## The chain

Everything is one command, `eval`, used at two intensities.

```bash
# Validate and regenerate deterministic benchmark evidence.
npm run benchmark -- prepare

# READ-ONLY PREFLIGHT: current contract, era capacity, certified cost,
# retained-evidence health, and rebaseline blockers.
npm run benchmark -- status

# STAGE 0 (74 s on the dated 48-worker reference run): informational screen
# baseline probe reference. Repeatable all day; consumes nothing. Explore
# LR_ knobs freely here — e.g. LR_IMPACT_LOCAL_W=0.65 npm run benchmark -- eval
npm run benchmark -- eval

# VARIANT FAMILY (descriptive development evidence): capture each deliberate
# implementation, then compare every arm and the baseline on one fresh shared
# probe epoch. No qualification, promotion verdict, or era spend occurs here.
npm run benchmark -- family capture MECHANISM --variant=MEMBER
npm run benchmark -- family run MECHANISM
npm run benchmark -- family select MECHANISM --variant=MEMBER

# CONFIRMATION (57 min on the dated 48-worker reference run): declare a certified operating
# point, run both frozen snapshots on a fresh paired epoch in waves, take the
# declared futility looks, decide at the declared depth.
npm run benchmark -- eval --to-verdict                          # improve, θ=0
npm run benchmark -- eval --to-verdict --mode=simplify --margin=5

# Exception only: correct a strictly infrastructure-only abort before any
# formal look. This returns its spend but never releases the seed epoch.
npm run benchmark -- eval --correct-aborted-spend --attempt=ID --reason=... --operator=...

# After an accept: light rebaseline (the attempt's archives become the era
# record; one fresh probe becomes the screening reference; minutes).
npm run benchmark -- rebaseline --label=NAME

# Diagnose failures and weak cases.
npm run benchmark -- explain ARCHIVE.json
```

A candidate for confirmation must be an **actual source-default change**
(a real `candidateFingerprint`), never an `LR_` environment override. The
candidate may be uncommitted while it is evaluated, but after an accept the
exact compiler-bound bytes must be committed before `rebaseline`; promotion
refuses staged, unstaged, deleted, or untracked compiler-bound paths.

Use a family before confirmation when one mechanism has several plausible
constants or implementations. `capture` snapshots the exact current compiler;
the default `run` executes up to eight members at six fresh seeds per probe
budget, with one freshly replayed baseline and identical seeds for every arm.
Its paired ranking, uncertainty, validity changes, case/stratum breakdowns,
pairwise contrasts, and early-prefix ranking reversals are deliberately labeled
selection-biased exploration. They cannot enter `decide`, consume era alpha, or
run qualification. `select` requires the working compiler to exactly match the
captured member; an `LR_*`-only member must first be baked into source defaults.
The selected source then enters the ordinary fresh `eval --to-verdict` gate.

If results motivate another adaptive round, select the current champion first.
The next capture carries that member forward automatically and allocates a new
seed epoch. Evidence from viewed rounds is never pooled. Selecting a member
other than the observed leader requires a recorded reason. This is the lean
default for the "+3 first implementation, +4 better implementation" problem:
explore the declared family first, then confirm one frozen winner once.

Public physics runs use WASM, default to 48 workers, cap budgets at 750k, report host/process resources, and retain resumable checkpoints. Use `--jobs=N` when the host is shared. `--resume` continues a crashed attempt from its checkpoint; a fired futility stop is durable. The status command distinguishes normative compile counts from dated, host-specific timing and memory measurements.

## Meaning of results

Stage 0 prints the observed delta, its seed-block SE, the realized pairing,
and an advice line projecting whether an effect of that size would resolve
at the certified depth (the projection is a labeled heuristic; the certified
quantities are the grid cells). Exit codes: 0 completed, 1 invalid.

A `--to-verdict` attempt ends one of four ways (exit code):

- **accept** (0) — the one-sided 99% lower bound cleared the threshold.
  Only this promotes. `rebaseline` is the next command.
- **inconclusive** (2) — the evidence did not resolve the question. The
  interval states what remains plausible. A fresh acknowledged retry
  (`--acknowledge-retry`) is permitted but is not automatic: it spends another
  certified era charge, compounds nominal alpha, and never pools prior evidence.
- **reject** (3) — the upper bound fell below the threshold.
- **futility stop** (4) — an interim look showed the attempt cannot
  realistically end in accept; most of the compute was saved. The spend
  stays charged.

For automation, `--json` reserves benchmark stdout for one structured value;
diagnostics go to stderr. Invoke the npm wrapper as
`npm run --silent benchmark -- eval ... --json` so npm's own banner does not
prefix stdout.

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

Each attempt with at least one formal look charges the largest certified false-accept upper bound across
the menu and independent holdout null/stress cells to the **era α-budget**
(cap 0.05). Run `status` for current capacity before declaration. A strictly
infrastructure-only abort before any formal look may be corrected to zero spend
with `eval --correct-aborted-spend --attempt=... --reason=... --operator=...`;
the seed epoch remains permanently reserved. Once a look exists, refunds are
refused. The budget
resets only on an accepted rebaseline or a suite rollover. Exhaustion blocks
declarations until a ledgered `--override-era-budget=<cap> --reason=…`. The
permanent ledger (`benchmark/v2/attempts.jsonl`) accumulates every attempt
and the project-wide expected-false-accept sum.

## Baseline

`benchmark/v2/probe-baseline.json` is the reusable screening reference. `benchmark/v2/baseline.json` records the compiler of record, its checksummed compiler/WASM snapshot, the era record, and the frozen decision contract (inference, protocol, calibration fingerprints). A confirmation never compares against an already-visible archive: the declaration freezes both snapshots before either arm runs, on a newly allocated seed epoch no prior attempt has seen.

A suite change is an era rollover (new listening review included). A
decision-surface change requires `npm run benchmark -- migrate` (scopes:
protocol / calibration / inference). Behavior-changing edits to the shared
eval-chain inference or stopping logic require fresh menu and independent
holdout certification; operational logging and ledger edits do not.
Operational runner changes require a reviewed,
checksummed bit-identity approval for the exact implementation pair.

## Retired interfaces

The pre-eval one-shot `canonical` promotion command is retired and fails
closed. Standalone `decide` remains available only for optional probe archive
analysis; it cannot judge canonical evidence or promote a compiler. Historical
one-shot V2 instructions are preserved under
`archive/benchmark-v2-one-shot/` and are not runnable guidance.

`baseline` is not the normal post-accept command. Use `rebaseline` after an
accepted eval attempt. Use `baseline` only to bootstrap Benchmark V2 or after
an intentional suite-fingerprint rollover with a refreshed listening review
and statistical evidence.

## Discipline

- Keep one mechanism per candidate when feasible.
- For a parameterized mechanism, compare a small deliberate family before promoting any member; do not turn the compiler or benchmark into a parameter-search language.
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
