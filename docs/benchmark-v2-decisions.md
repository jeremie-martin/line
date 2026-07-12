# Benchmark V2 Decisions

This document is the statistical and operational contract for comparing compiler candidates. The benchmark product contract remains `docs/benchmark-v2-context.md`.

## Estimand

The primary estimand is:

> candidate minus baseline V2 development headline for the frozen catalog, averaged over the compiler's seed distribution under the frozen profile.

The authored catalog is a fixed, deliberately weighted benchmark. It is not claimed to be a random sample of every future musical work. Formal confidence therefore concerns new compiler seeds for this catalog. Qualification results and parent-family sensitivity provide evidence about broader behavior, but neither is represented as a probability of production generalization.

The point estimate always uses the exact V2 scorer:

1. shifted geometric mean over seeds for each case;
2. shifted geometric mean over a normative case and its variants within each parent;
3. shifted geometric mean over parents within a coverage group;
4. frozen arithmetic weights over groups and strata;
5. frozen arithmetic weights over budgets, renormalized for the profile.

Every cell is paired by source, budget, seed slot, and actual seed. Candidate and baseline must have complete identical scope. The canonical baseline side is freshly executed from the checksummed compiler snapshot after the candidate, mode, margin, and seed epoch have been declared; previously visible milestone scores are never canonical comparison evidence.

## Confidence Method

An actual seed is shared by every case at one budget, so it is one catalog-wide experimental block. Actual seeds are disjoint across budgets.

For each budget and seed block, the decision model removes that block from both archives, recomputes the complete nonlinear V2 score, and forms a paired jackknife pseudovalue:

```text
p_bi = n_b * delta_b - (n_b - 1) * delta_b(-i)
```

The sample variance of these pseudovalues estimates the paired variance at that budget. Budget variances are combined using the frozen normalized headline weights. Welch-Satterthwaite degrees of freedom and Student-t critical values provide small-sample bounds. Because hard-zero invalidity is discrete and zero-inflated, the advertised coverage target is deliberately more conservative than a nominal small-sample t interval: the 95% interval uses a 99% t critical.

The report contains:

- a stress-calibrated interval targeting at least 95% two-sided coverage;
- the profile's one-sided lower and upper confidence bounds;
- per-budget and per-stratum seed-block intervals;
- validity gains and losses;
- parent-preserving catalog and crossed seed/catalog bootstrap sensitivity intervals.

The sensitivity bootstraps keep every normative case and its variants inside one parent. They are diagnostics, not the formal gate. The command does not report bootstrap mass as `P(delta <= 0)`, a posterior probability, or a p-value.

## Decision Policies

Stage 0 is reusable, informational screening against the stored probe
reference. It reports the observed delta, paired uncertainty, and a labeled
resolution heuristic, but cannot promote or spend era budget.

`eval --to-verdict` is the promotion authority. It accepts only certified rows
from `benchmark/v2/eval-policy.ts`. The mode, margin, depth, stopping schedule,
fresh paired seed epoch, candidate and baseline snapshots, certification
fingerprint, and era spend are frozen in an immutable declaration before
either arm executes. Acceptance requires the stress-calibrated lower bound to
exceed the declared threshold; rejection requires the upper bound to be below
it; otherwise the result is inconclusive. Certified futility looks may stop a
clearly unpromising attempt without converting failure into a verdict.

The calibration and certification guards recompute outcome counts and
quantitative bars from retained evidence and bind them to the current suite,
decision implementation, eval policy, and shared eval-chain inference
implementation. Behavior-changing edits to inference, interim looks, futility,
or final evidence selection require fresh menu and independent holdout
certification. Operational logging and ledger edits do not. Missing, stale,
inconsistent, or inadequate evidence blocks declaration rather than weakening
the rule.

Two modes are supported:

- `improvement`: threshold `0` headline points.
- `simplification`: threshold `-margin` headline points.

Simplification has no default margin. The acceptable regression must be chosen
from a certified operating point before examining confirmation evidence.
Failure to establish non-inferiority is `inconclusive`, not permission to
promote and not proof of inferiority.

## Commands

Run stage 0 and confirm an improvement:

```bash
npm run benchmark -- eval
npm run benchmark -- eval --to-verdict
```

Confirm a simplification with the currently certified margin:

```bash
npm run benchmark -- eval --to-verdict --mode=simplify --margin=5
```

After `accept`, execute the artifact's concrete `nextCommand`, equivalent to:

```bash
npm run benchmark -- rebaseline --label=NAME
```

`rebaseline` requires the accepted candidate to match the working compiler and
promotes the retained attempt; it does not rerun confirmation. Use the heavier
baseline command only for initial bootstrap or an intentional suite rollover:

```bash
npm run benchmark -- baseline --label=NAME
```

`benchmark/v2/attempts.jsonl` records declarations, looks, stops, verdicts,
transitions, and era budget. Fresh epochs are never reused. `--resume` may only
continue the in-flight declaration, and `--acknowledge-retry` creates a fresh
declared epoch after an inconclusive result; prior evidence is not pooled and
the new certified spend is charged. An infrastructure abort before any formal
look can receive a ledgered zero-spend accounting correction, but its seed epoch
remains reserved. Any post-look refund is refused.
Standalone `decide` remains available only for optional probe archive analysis
and cannot judge canonical evidence.

## Outcomes And Artifacts

Every valid comparison writes a checksummed decision artifact under `generated/benchmark-v2/decisions/` unless `--out` is supplied. The artifact records the comparison protocol, decision-rule fingerprint, policy, archive hashes, candidate identities, runner-compatibility approval if required, formal confidence result, sensitivity diagnostics, and all breakdowns.

Exit codes are stable:

| Exit | Meaning |
|---:|---|
| 0 | stage 0 completed, or confirmation `accept` |
| 1 | malformed, stale, incomplete, or incomparable evidence |
| 2 | confirmation `inconclusive` |
| 3 | confirmation `reject` |
| 4 | certified futility stop |

`--no-gate-exit` keeps a valid statistical outcome at exit code zero for reporting scripts. It does not alter the artifact.

## Identity Boundary

Archives carry two distinct identities:

- the execution protocol identifies comparison semantics and enters the execution-policy fingerprint;
- the implementation fingerprint records exact runner bytes for audit and reproducibility.

Different runner implementation fingerprints are rejected by default. An operational-only change is eligible only when `benchmark/v2/runner-compatibility.json` contains a reviewed, checksummed, suite-specific bit-identity approval for the exact old and new fingerprints. Any semantic change to tasks, scoring, seeds, engine, compiler entry point, sources, transform, or protocol changes the comparison identity. Worker failures are never interpreted as compiler regressions; an archive containing one is ineligible. Checkpoint plan identity includes Node version, platform, architecture, the complete candidate fingerprint, compiler-source fingerprint, compiler environment, and WASM artifact fingerprint, so rows cannot be resumed under a different runtime or compiler and then relabeled. On `--resume`, only the latest successful result for a task is restored; error and timeout rows are retried and a later success supersedes the failed checkpoint row.

Compiler source and non-engine `LR_*` variables define the candidate and may differ. The WASM engine artifact and Node/platform/architecture identity must be identical. Suite, execution protocol, profile, task scope, and scoring identity must match.

Compiler identity uses an explicit versioned protocol. Its content fingerprint covers optimizer and core sources, transitive compiler helpers under `scripts/lib`, arc and scoring code, Rust engine sources, `package.json`, the lockfile, and `tsconfig.json`; the exact file inventory is retained in every archive. `decide` rejects an old protocol or an archive missing required boundary files. The separately hashed WASM artifact ensures that a source/toolchain mismatch cannot silently substitute different physics bytes.

Each compiler snapshot retains that same file inventory, its non-engine `LR_*` environment, and the optimized WASM bytes. Replay first removes the entire ambient compiler-source boundary from the isolated worktree, then extracts the snapshot; candidate-only added files therefore cannot leak into baseline replay. It removes ambient `LR_*` variables, restores the recorded environment, and runs `npm ci` from the snapshotted lockfile instead of sharing the caller's `node_modules`. Both resulting development archives must reproduce their predeclared candidate fingerprints before they can enter a decision; qualification uses the same candidate snapshot.

Eval inference reloads every current canonical specification and rebuilds its
transformed axis contract. New runner archives include a checksummed decision
index bound to both raw and compressed archive hashes. It contains the complete
task/source/score scope and a hash of every raw `DriftReport`; the decision path
validates identities, contracts, scope, and row completeness from that index.
The index is generated by the fingerprinted runner and its projection is covered
by runner-compatibility replay against raw reports. Historical archives without
an index fall back to full raw-report rescoring. Raw archives remain the audit
source. A neighboring SHA-256 sidecar is an integrity check, not independent provenance.
Confirmation provenance additionally requires the baseline compiler snapshot,
both fresh archive hashes, and their shared pre-run declaration and seed schedule.

## Interpretation Limits

Confirmation inference remains conditional on the frozen catalog. Stage-0
evidence may be reused for development, but confirmation evidence cannot become
an adaptive loop. Fresh, non-reused seed epochs prevent retrying a known draw;
executing both compilers after declaration prevents adapting the candidate to
visible per-seed baseline outcomes. The five production references are
qualification monitors: they never enter the headline or decision and must not
be tuned case by case.

The retained calibration studies are `docs/benchmark-v2-decision-calibration.md` and `docs/benchmark-v2-decision-coverage.md`. They include identical-archive, known-degradation, impact-contract, correlated-seed, empirical-block, validity-flip, hard-zero, supported-power, safety-boundary, known-power-limit, non-inferiority, and interval-coverage controls. Their raw probe controls and compressed 12-seed raw-report coverage reference are retained; sidecars and complete identities are checked and every stored reference score is recomputed from its raw report before simulation. The operational guard later rechecks the exact retained artifact hashes and quantitative acceptance limits. A clean clone treats missing, stale, inadequate, or checksum-inconsistent evidence as an error. Policy or decision changes require the governed migration path, regenerated evidence at the required scope, and a baseline contract whose inference, protocol, and calibration fingerprints match.
