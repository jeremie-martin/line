# Compiler speed workflow

Use this document as the working prompt for behavior-preserving speed work on the
whole standard compiler path: TypeScript compiler driver, optimizer/search,
detector/extraction work, WASM engine integration, JS/WASM boundary, and the
Rust/WASM engine itself.

For engine-only kernel work, prefer `docs/engine-workflow.md`; it is deliberately
narrower. This workflow is for cases where profiling shows wall-clock compile
time is dominated by compiler orchestration, detector/extraction, search policy
overhead, or engine/compiler integration rather than the raw physics kernel.

## Goal

Improve end-to-end compile wall-clock time while preserving compiler behavior.

The standard path is still Rust/WASM. `LR_ENGINE=wasm` and an unset `LR_ENGINE`
both select the standard engine. `LR_ENGINE=js` and `LR_ENGINE=official` are
references, not optimization targets.

Behavior-preserving means the same `(spec, seed, budget)` produces the same
track, report, deterministic stats, and validity result. A speed change that
alters compiler output is not a speed refactor; it belongs in the compiler-quality
workflow and must be judged with golden/canonical scoring.

## Right to modify

Compiler-speed work may modify:

- `engine-rs/**` and the WASM ABI when the speed issue is in the engine or the
  engine/compiler interface;
- `scripts/lib/_lr_engine_wasm.ts` and `scripts/lib/_lr_engine.ts` when the
  change is about standard WASM engine integration or routing;
- compiler-driver, detector/extraction, optimizer/search, and core helper code
  under `scripts/v0/**` and `scripts/lib/**`, when the change is intended to be
  behavior-preserving and is tied to measured compile-time cost;
- benchmark, profiling, verification, and analysis helpers under `scripts/v0/bench/**`;
- docs and the relevant optimization log.

Do not modify scorer, golden specs, evaluator fingerprint, budget grid, seed
policy, baseline artifacts, accepted metric definitions, or production tracks to
make a speed result look better. Do not change compiler-quality policy as a
"speed" shortcut unless the task has explicitly moved to the compiler-quality
workflow.

## Measure First

Start with whole-compile profiling, not speculation:

```bash
npm run cbench -- --spec=mini_burst --seed=0 --budget=50000
npm run cbench:prof -- --spec=mini_burst --seed=0 --budget=50000
```

Use other representative specs and budgets when the suspected cost is
profile-specific:

```bash
npm run cbench -- --spec=drums_signature --seed=2 --budget=150000
npm run cbench -- --spec=skyline_push --seed=7 --budget=200000
```

Use `npm run perf` and paired `perf_ab` when the candidate is primarily about
per-physics-frame engine or JS/WASM boundary cost. Use `cbench` profiles when the
candidate is about compile orchestration, detector/extraction, search overhead,
or one-time per-candidate work that is not well explained by raw physics frames.

## Correctness Gates

Fast gate for serious compiler-speed candidates:

```bash
npm run verify:compiler:behavior
```

This checks 12 representative spec/seed cases across `61k`, `100k`, `150k`, and
`200k` budgets against recorded behavior hashes. It fails fast by default. Use:

```bash
npm run verify:compiler:behavior -- --all
```

when you need the full difference list. Use:

```bash
npm run verify:wide
```

when the change also needs the engine trace oracle.

For engine or WASM-boundary changes, also run the relevant engine gates from
`docs/engine-workflow.md` (`cargo test`, `npm run build:wasm`, and `npm run
wasm:all` for boundary/replay-sensitive work).

For high-risk compiler refactors, run a probe or canonical golden archive and
compare track hashes before treating the change as behavior-preserving. Use
golden `decide` only when behavior intentionally changes and the work has moved
to compiler-quality evaluation.

## Speed Decision

Use one mechanism at a time.

1. Profile and state the measured hot path.
2. Explain why the candidate should reduce wall-clock work without changing
   behavior.
3. Implement the smallest version that tests that mechanism.
4. Run `npm run verify:compiler:behavior`.
5. Run the appropriate speed comparison.
6. Keep only candidates that pass behavior gates and show a repeatable speed win.
7. Revert rejected candidates and record the result.

For engine-only or JS/WASM-boundary candidates, use the paired `perf_ab` gates
from `docs/engine-workflow.md`.

For broader compiler-path candidates, collect paired or repeated `cbench` results
on the profiled representative specs and budgets. Do not accept a candidate from
a single timing run; compare medians across repeated runs and make sure the
profile moved in the expected place.

## Suggested Prompt

Improve whole-compiler speed while preserving compiler behavior.

Start from `cbench`/CPU profiles and identify whether the current cost is in the
Rust/WASM engine, JS/WASM boundary, detector/extraction, compiler orchestration,
or optimizer/search overhead. Modify only the measured hot path. Verify behavior
with `npm run verify:compiler:behavior` before accepting speed evidence. Use
engine gates for engine or boundary changes. Keep only behavior-green candidates
with repeatable speed wins; revert and log rejected candidates.
