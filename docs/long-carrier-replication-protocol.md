# Long-Carrier Transfer Protocol

## Scope

This is a prospective, validation-only transfer study of the fixed straight
post-impact long-carrier assay. It is not a Benchmark V2 case, production
qualification, compiler candidate, or support planner. Its scope string is
`long_carrier_duration_replication.v3` and is bound into every declared panel
row and frozen fixture.

The fixed implementation is the committed five-fraction stencil
`[0, 0.25, 0.5, 0.75, 1]`, its target-blind capture closure, its scalar
outgoing-endpoint handoff, and its first-safe shared phase ladder. No source,
seed, phase, fraction, geometry, threshold, runtime setting, capture source,
or assay source may change after the immutable declaration is written and
before the cohort completes.

## Cohort

The six study-only source files live under
`scripts/v0/trajectory/validation_specs/`; none imports a benchmark,
production, or legacy authoring source. Every source is literal/manual,
positive-impact at its selected event, and has `jitter: 0`. Each source is run
under both public seeds `730201` and `730203` at WASM/500k.

| Source | Outgoing interval | Role |
| --- | ---: | --- |
| `syncopated_low_air_425` | 4.25s / 170 frames | primary low-air |
| `accelerating_low_air_475` | 4.75s / 190 frames | primary low-air |
| `decelerating_low_air_625` | 6.25s / 250 frames | primary low-air |
| `sparse_low_air_725` | 7.25s / 290 frames | primary low-air |
| `ordinary_partial_axes_115` | 1.15s / 46 frames | scope control; amplitude undefined |
| `ramped_high_air_reentry_195` | 1.95s / 78 frames | scope control; high air |

The exact source path, materialized target-gap index, expected outgoing frame
count, and source-only rationale are declared in
`long_carrier_replication_protocol.ts` before capture. The dedicated registry,
materializer, capture entrypoint, controller, verifier, and record writer have
no static import of Benchmark V2 or the broad legacy trajectory panel. The
fixed `{ kind: "production_felt_jolt", joltMs: -15 }` transform is part of the
declaration and fixture validation, rather than borrowed at runtime from the
benchmark policy. `scripts/v0/core/curves.ts` is pinned as an authored-input
definition file: its keyframe interpolation semantics define these six manual
specs and cannot be changed as mutable compiler behavior within a cohort. The
capture selects the greatest unskipped observed compiler path, retaining the
earliest callback on ties, and projects its exact physical prefix to the
preregistered current contact. The rule does not inspect the target, score, or
candidate quality. This handles ordinary traversal and batched tail completion
under one rule: the donor ancestry is rebuilt with the compiler's root-plus-
extend transition, then its planning state, probe state, and pre-target trace
must equal the serialized prefix replay at the declared contact before it can
be sealed. A tail donor's final engine is never used as target evidence because
future terrain is installed from frame zero. The old V2 reserve rows remain
quarantined and cannot enter this cohort.

## Execution

V1 was retired before it generated a declaration, fixture, assay, or ledger:
its exact-callback capture rule could not observe target boundaries inside
normal tail completion. V2 was likewise retired before execution when its
initially high-air control failed the required mechanical review. The active
V3 declaration uses the projection rule above. A full capture-feasibility
sweep must pass for every fixed row at WASM/500k before any V3 efficacy cohort
is declared; an unreachable row is a
roster-design failure, not a negative assay observation. The current
`open_high_air_195` source was retired because its initially high-air,
five-second opening had no viable first contact at 500k. V3 instead uses the
manual `ramped_high_air_reentry_195` source: it retains the rhythm, impacts,
speed, amplitude, and later 1.95-second high-air segment while using an
ordinary opening that ramps into that segment.

Run only through the replication controller after the V3 roster code and the
compiler candidate are committed in a clean worktree, and a fresh sealed
feasibility record has qualified that exact compiler/runtime epoch. The
generated record is evidence and belongs outside the workspace (not merely
outside Git); the CLIs reject repository-contained output paths. The controller
embeds it in its immutable declaration before any execution. It captures
each fixture once, runs the fixed assay once, and writes planned/result events
plus one immutable ledger. Qualification verifies both the feasibility/capture
source closures and the entire compiler boundary before loading compiler code;
the controller then binds that same candidate identity before every child
invocation. An occupied output root is rejected. A failed capture is invalid
unless a future protocol adds a sealed
structured unavailability record; it is never replaced, retried in place, or
allowed to move its target contact. A capture that detects source/compiler
identity drift publishes its deterministic sibling fixture as invalid forensic
evidence, and the ledger inventories that sibling rather than silently losing
it.

First generate the score-free all-row mechanical qualification from that clean
committed worktree. It runs every declared case at WASM/500k, checks the
root-plus-extend physical-prefix replay,
and writes only structural witnesses or typed availability failures:

```sh
LR_ENGINE=wasm npx tsx scripts/v0/run_long_carrier_replication_feasibility.ts \
  --out=/tmp/long-carrier-replication-YYYYMMDD.feasibility.json
```

Then run the non-executing preflight. It validates that sealed record against
the current roster, implementation source closures, candidate, panel files,
and host/loader runtime without launching another compiler or writing cohort
evidence:

```sh
LR_ENGINE=wasm npx tsx scripts/v0/run_long_carrier_replication.ts \
  --out-dir=/tmp/long-carrier-replication-YYYYMMDD \
  --feasibility=/tmp/long-carrier-replication-YYYYMMDD.feasibility.json \
  --check
```

Only after that preflight succeeds may the one-shot cohort be declared:

```sh
LR_ENGINE=wasm npx tsx scripts/v0/run_long_carrier_replication.ts \
  --out-dir=/tmp/long-carrier-replication-YYYYMMDD \
  --feasibility=/tmp/long-carrier-replication-YYYYMMDD.feasibility.json
```

The controller requires exactly `LR_ENGINE=wasm`, a clean committed
qualification/capture/compiler closure, and the shared 500k capture protocol.
It records the actual compiler/worktree identity and verifies it before every
child invocation. It rejects Node/tsx loader overrides and passes children
only a small operational environment allowlist plus `LR_ENGINE=wasm`, so an
unrecorded loader setting cannot alter capture or assay semantics. Its runtime
identity content-hashes the installed `tsx`, TypeScript, esbuild, and
platform-esbuild package closure, not just manifest versions. The declaration
also freezes the Node executable, exact
capture/assay argument templates, source revision/tree, and every planned
artifact path. It records both the original absolute publication root and
root-relative artifact identities, so a completed evidence directory can be
moved without changing what the child processes originally received. The
verifier checks those templates against every plan, result, fixture `argv`,
assay `argv`, assay fixture path, and the exact structural witness from the
embedded qualification. A completed controller also invokes that
read-only verifier itself: the ledger must have no abort reason, account for
every event file and every fixture/assay publication, and attest a clean child
completion before the controller reports its verdict. Generated evidence
belongs outside the workspace, for example under `/tmp`; verify a completed cohort
without re-running a compiler using:

```sh
LR_ENGINE=wasm npx tsx scripts/v0/verify_long_carrier_replication.ts \
  --out-dir=/tmp/long-carrier-replication-YYYYMMDD
```

That default verifies a sealed historical declaration and artifacts without
consulting the current compiler candidate. A materially different protocol
requires a new scope/schema rather than an edit to the declared cohort. Add
`--require-current-identity` when the question is specifically
whether the current controller, verifier, capture entrypoint, compiler
candidate, assay source, and replay runtime still match the cohort's scoped
execution identity. Unrelated repository files are diagnostic-only and do not
make a completed cohort incompatible.

## Decision Rule

For every primary low-air source and both of its seed fixtures:

1. Fixture and assay provenance must be stable and all protocol counters must
   be zero. Any identity, roster, boundary, or runtime failure invalidates the
   fixture rather than becoming a negative observation.
2. Each seed must contain at least one complete five-arm row. Every complete
   row must meet the source-declared one-sample non-increasing-air predicate.
3. Each seed must have at least one complete row with no confirmed or
   unresolved off-beat landing on any of its five arms and with
   `air(f=0) - air(f=1)` greater than two measurement samples.

A completed non-monotone primary row falsifies the fixed duration ordering.
Missing eligible rows make the source unavailable/inconclusive. The ordinary
and high-air controls must each produce a structurally valid complete reported
row before the cohort can support the relation; otherwise it is inconclusive.
Controls gate support, not a completed primary falsification: their absence
cannot erase a direct failed monotonicity observation. Their outcome cannot
substitute for a primary result or be counted as benefit.

The controller and verifier use exit status `0` for the narrow supported
result, `2` for invalid evidence, `3` for falsification, and `4` for a valid
inconclusive cohort. Malformed records are verifier errors rather than verdicts.

Terminal named-reference speed is recorded as a secondary diagnostic. It is
not an acceptance threshold because this scalar assay has no release or
next-contact model. Therefore even a supported transfer result authorizes only
reuse of the straight rail as a bounded physical leaf in a later study. It does
not establish target fit, continuation feasibility, or a compiler change.
