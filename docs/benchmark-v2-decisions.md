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

Every cell is paired by source, budget, seed slot, and actual seed. Candidate and baseline must have complete identical scope.

## Confidence Method

An actual seed is shared by every case at one budget, so it is one catalog-wide experimental block. Actual seeds are disjoint across budgets.

For each budget and seed block, the decision model removes that block from both archives, recomputes the complete nonlinear V2 score, and forms a paired jackknife pseudovalue:

```text
p_bi = n_b * delta_b - (n_b - 1) * delta_b(-i)
```

The sample variance of these pseudovalues estimates the paired variance at that budget. Budget variances are combined using the frozen normalized headline weights. Welch-Satterthwaite degrees of freedom and Student-t critical values provide small-sample bounds.

The report contains:

- a 95% two-sided seed-block confidence interval;
- the profile's one-sided lower and upper confidence bounds;
- per-budget and per-stratum seed-block intervals;
- validity gains and losses;
- parent-preserving catalog and crossed seed/catalog bootstrap sensitivity intervals.

The sensitivity bootstraps keep every normative case and its variants inside one parent. They are diagnostics, not the formal gate. The command does not report bootstrap mass as `P(delta <= 0)`, a posterior probability, or a p-value.

## Decision Policies

| Profile | Authority | One-sided alpha | Positive | Negative | Otherwise |
|---|---|---:|---|---|---|
| probe | screening only | 0.10 | `advance` | `stop` | `unresolved` |
| canonical | promotion | 0.05 | `accept` | `reject` | `inconclusive` |

Probe and canonical use the same catalog and scorer but disjoint actual seeds at every shared budget. A probe can never promote a candidate. Its purpose is to decide whether spending canonical compute is justified.

Canonical acceptance requires the lower 95% one-sided confidence bound to exceed the policy threshold. Canonical rejection requires the upper bound to be below it. Everything between those bounds is inconclusive.

Two modes are supported:

- `improvement`: threshold `0` headline points.
- `simplification`: threshold `-margin` headline points.

Simplification has no default margin. The acceptable regression must be chosen in headline points before examining the candidate result. Failure to establish non-inferiority is `inconclusive`, not proof of inferiority; `reject` is reserved for a candidate confidently below the margin.

## Commands

Establish a baseline for a frozen suite and compiler:

```bash
npm run benchmark -- baseline --label=NAME
```

This runs and retains a probe, canonical development, and linked qualification archive. `benchmark/v2/baseline.json` points to their checksummed compressed artifacts.

Screen an improvement:

```bash
npm run benchmark -- probe --out=generated/benchmark-v2/candidates/NAME-probe.json
npm run benchmark -- decide generated/benchmark-v2/candidates/NAME-probe.json
```

Screen a simplification with a predeclared 0.5-point margin:

```bash
npm run benchmark -- decide generated/benchmark-v2/candidates/NAME-probe.json \
  --mode=simplification --margin=0.5
```

Confirm a candidate:

```bash
npm run benchmark -- canonical --label=NAME
npm run benchmark -- decide generated/benchmark-v2/canonical-runs/NAME-development.json
```

The frozen baseline for the candidate's profile is selected automatically. Use `--base=ARCHIVE` only for an explicit controlled comparison. Candidate is always the first positional archive.

## Outcomes And Artifacts

Every valid comparison writes a checksummed decision artifact under `generated/benchmark-v2/decisions/` unless `--out` is supplied. The artifact records the comparison protocol, decision-rule fingerprint, policy, archive hashes, candidate identities, formal confidence result, sensitivity diagnostics, and all breakdowns.

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

Operational changes such as worker cleanup may change implementation bytes without invalidating a comparison. Any semantic change to tasks, scoring, seeds, engine, compiler entry point, sources, transform, or protocol changes the comparison identity. Worker failures are never interpreted as compiler regressions; an archive containing one is ineligible.

Compiler source and non-engine `LR_*` variables define the candidate and may differ. The WASM engine artifact and Node/platform/architecture identity must be identical. Suite, execution protocol, profile, task scope, and scoring identity must match.

Compiler identity uses an explicit versioned protocol. Its content fingerprint covers optimizer and core sources, transitive compiler helpers under `scripts/lib`, arc and scoring code, Rust engine sources, `package.json`, the lockfile, and `tsconfig.json`; the exact file inventory is retained in every archive. `decide` rejects an old protocol or an archive missing required boundary files. The separately hashed WASM artifact ensures that a source/toolchain mismatch cannot silently substitute different physics bytes.

## Interpretation Limits

Canonical inference remains conditional on the frozen catalog. Repeated development against this catalog can overfit its authored cases even though canonical seeds are independent of probe seeds. Qualification is shown beside canonical milestones to expose that risk, but it remains held out and never enters the development decision.

The retained calibration study is `docs/benchmark-v2-decision-calibration.md`. It includes identical-archive, known-degradation, correlated-seed, interval-coverage, and power controls. Policy changes require rerunning that study and establishing a new baseline.
