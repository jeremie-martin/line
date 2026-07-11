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

| Profile | Authority | Error target | Critical used | Positive | Negative | Otherwise |
|---|---|---:|---:|---|---|---|
| probe | screening only | 0.10 | 0.05 | `advance` | `stop` | `unresolved` |
| canonical | promotion | 0.05 | 0.01 | `accept` | `reject` | `inconclusive` |

Probe and canonical use the same catalog and scorer but disjoint actual seeds at every shared budget. A probe can never promote a candidate. Its purpose is to decide whether spending canonical compute is justified.

`baseline`, canonical execution, and `decide` mechanically require `benchmark/v2/studies/decision-calibration.json` to match the current suite and complete decision implementation fingerprint. That artifact binds the exact zero-inflated coverage study, its raw reference, every empirical control archive, and the inference fingerprint. The guard also enforces the predeclared calibration policy: at least 1,000 trials per required cell, all named null and non-inferiority scenarios, a Wilson lower coverage bound of 0.93, a Wilson upper false-decision bound of 0.05, and an empirical-gain power lower bound of 0.85. Rates and Wilson intervals are recomputed from integer counts, stored summaries must match, and outcome counts must partition all trials. A missing artifact, inconsistent or inadequate study, or policy/decision-code edit blocks operational use; this is not merely a documentation rule.

Canonical acceptance requires the stress-calibrated lower bound to exceed the policy threshold. Canonical rejection requires the corresponding upper bound to be below it. Everything between those bounds is inconclusive. The retained zero-inflated study uses real 12-seed blocks, symmetric validity flips, and catalog-wide hard-zero blocks; at the selected eight canonical seeds per budget, all studied false-accept rates are below the 5% target.

Two modes are supported:

- `improvement`: threshold `0` headline points.
- `simplification`: threshold `-margin` headline points.

Simplification has no default margin. The acceptable regression must be chosen in headline points before examining the candidate result. Failure to establish non-inferiority is `inconclusive`, not proof of inferiority; `reject` is reserved for a candidate confidently below the margin.

## Commands

Establish a baseline for a frozen suite and compiler:

```bash
npm run benchmark -- baseline --label=NAME
```

This command first requires a complete approved `benchmark/v2/evidence/listening-review.json`. It then runs and retains a probe, canonical development, and linked qualification archive, and snapshots the exact compiler source inventory plus WASM artifact. `benchmark/v2/baseline.json` records those checksummed artifacts and opens one canonical confirmation slot.

Screen an improvement:

```bash
npm run benchmark -- probe --out=generated/benchmark-v2/candidates/NAME-probe.json
npm run benchmark -- decide generated/benchmark-v2/candidates/NAME-probe.json
```

Screen a simplification using the intended canonical margin:

```bash
npm run benchmark -- decide generated/benchmark-v2/candidates/NAME-probe.json \
  --mode=simplification --margin=0.5
```

Confirm a candidate:

```bash
npm run benchmark -- canonical --decision-mode=improvement
# The command prints the generated attempt id and development archive path.
npm run benchmark -- decide GENERATED_DEVELOPMENT_ARCHIVE
```

For simplification, the declaration is created before compilation:

```bash
npm run benchmark -- canonical --decision-mode=simplification --margin=0.5
npm run benchmark -- decide GENERATED_DEVELOPMENT_ARCHIVE \
  --mode=simplification --margin=0.5
```

`benchmark/v2/confirmation-state.json` permits exactly one canonical attempt per baseline. The complete candidate and baseline snapshots, suite, mode, simplification margin, fresh random seed base, and seed-schedule hash are written to an immutable declaration before either paired result exists. A permanent ledger prevents seed-epoch reuse across later baselines. Both snapshots then run the identical schedule in isolated clean worktrees; only the candidate snapshot receives the linked qualification sidecar. The state is consumed by `decide` regardless of outcome. Rebaseline is rejected unless the prior outcome was `accept` for the exact current candidate; `--resume` may only continue the same declaration.

The reusable screening reference in `benchmark/v2/probe-baseline.json` is selected automatically for probes. Canonical `decide` resolves the fresh paired baseline archive from confirmation state. Use `--base=ARCHIVE` only for non-promotable controlled analysis; candidate is always the first positional archive.

## Outcomes And Artifacts

Every valid comparison writes a checksummed decision artifact under `generated/benchmark-v2/decisions/` unless `--out` is supplied. The artifact records the comparison protocol, decision-rule fingerprint, policy, archive hashes, candidate identities, runner-compatibility approval if required, formal confidence result, sensitivity diagnostics, and all breakdowns.

Exit codes are stable:

| Exit | Meaning |
|---:|---|
| 0 | `advance` or `accept` |
| 1 | malformed, stale, incomplete, or incomparable evidence |
| 2 | `unresolved` or `inconclusive` |
| 3 | `stop` or `reject` |

`--no-gate-exit` keeps a valid statistical outcome at exit code zero for reporting scripts. It does not alter the artifact.

## Identity Boundary

Archives carry two distinct identities:

- the execution protocol identifies comparison semantics and enters the execution-policy fingerprint;
- the implementation fingerprint records exact runner bytes for audit and reproducibility.

Different runner implementation fingerprints are rejected by default. An operational-only change is eligible only when `benchmark/v2/runner-compatibility.json` contains a reviewed, checksummed, suite-specific bit-identity approval for the exact old and new fingerprints. Any semantic change to tasks, scoring, seeds, engine, compiler entry point, sources, transform, or protocol changes the comparison identity. Worker failures are never interpreted as compiler regressions; an archive containing one is ineligible. Checkpoint plan identity includes Node version, platform, and architecture, so rows cannot be resumed or imported across runtimes and then relabeled. On `--resume`, only the latest successful result for a task is restored; error and timeout rows are retried and a later success supersedes the failed checkpoint row.

Compiler source and non-engine `LR_*` variables define the candidate and may differ. The WASM engine artifact and Node/platform/architecture identity must be identical. Suite, execution protocol, profile, task scope, and scoring identity must match.

Compiler identity uses an explicit versioned protocol. Its content fingerprint covers optimizer and core sources, transitive compiler helpers under `scripts/lib`, arc and scoring code, Rust engine sources, `package.json`, the lockfile, and `tsconfig.json`; the exact file inventory is retained in every archive. `decide` rejects an old protocol or an archive missing required boundary files. The separately hashed WASM artifact ensures that a source/toolchain mismatch cannot silently substitute different physics bytes.

Each compiler snapshot retains that same file inventory, its non-engine `LR_*` environment, and the optimized WASM bytes. Replay removes ambient `LR_*` variables, restores the recorded environment, and runs `npm ci` from the snapshotted lockfile instead of sharing the caller's `node_modules`. Both resulting development archives must reproduce their predeclared candidate fingerprints before they can enter a decision; qualification uses the same candidate snapshot.

`decide` reloads every current canonical specification, rebuilds its transformed axis contract, and recomputes every run score from the archived raw `DriftReport`. Report-free archives and stored-score tampering are ineligible. A neighboring SHA-256 sidecar is an integrity check, not independent provenance. Probe baseline hashes are anchored in the checked-in screening reference. Canonical provenance additionally requires the baseline compiler snapshot, both fresh archive hashes, their shared pre-run declaration and seed schedule, and the one-shot state transition.

## Interpretation Limits

Canonical inference remains conditional on the frozen catalog. Probe evidence may be reused for development, but canonical evidence is a one-shot confirmation and cannot become an adaptive development loop. Fresh, non-reused seed epochs prevent retrying a known canonical draw; executing both compilers after declaration prevents adapting the candidate to visible per-seed baseline outcomes. The five production references are qualification monitors, not untouched statistical holdouts: their scores are displayed at canonical milestones, never enter the headline or decision, and must not be tuned case by case.

The retained calibration studies are `docs/benchmark-v2-decision-calibration.md` and `docs/benchmark-v2-decision-coverage.md`. They include identical-archive, known-degradation, impact-contract, correlated-seed, smooth power, empirical block, validity-flip, hard-zero, alternative-power, non-inferiority, and interval-coverage controls. Their raw probe controls and compressed 12-seed raw-report coverage reference are retained; sidecars and complete identities are checked and every stored reference score is recomputed from its raw report before simulation. The operational guard later rechecks the exact retained artifact hashes and quantitative acceptance limits. A clean clone treats missing, stale, inadequate, or checksum-inconsistent evidence as an error. Policy changes require rerunning both studies and establishing a new baseline.
