# Engine optimization log — wyss-ThinkStation-P620

This log is for engine-speed work measured on host `wyss-ThinkStation-P620`.
Absolute `ns/physics-frame` values are hardware- and load-sensitive; use paired
A/B on this host for keep/reject decisions.

Metric and gates follow `docs/compiler-speed-workflow.md` and
`docs/engine-workflow.md`:

- Correctness: `npm run verify:compiler:behavior` for compiler behavior, plus
  engine gates for Rust/WASM changes.
- Speed: `npm run perf` for the current standard Rust/WASM path.
- Decision: paired `npx tsx scripts/v0/bench/perf_ab.ts`.

## Baseline (2026-07-09)

Repository state: `aedaca5` (`engine-improvement`), clean source. Host: Linux
x86_64, Node `v22.22.2` / V8 as shipped by that Node build.

- **Correctness:** `npm run verify:compiler:behavior` passed:
  - 48/48 cells byte-identical;
  - repair coverage included 33 repair cells and 676 repair restarts.
- **Perf:** `npm run perf`
  - mean **7,892.1 ns/physics-frame**
  - median **7,571.8 ns/physics-frame**
  - stddev **956.5**
  - frames **50,003**

Objective for this host remains the thread goal: improve the standard compiler
path until `npm run perf` reports **<5,000 ns/physics-frame mean**, without
changing compiler behavior.

## Attempt 1 (2026-07-09) — cheaper FlatIntMap hash, KEEP

Mechanism kept: replace `FlatIntMap::hash`'s two-round fmix-style hash with one
golden-ratio multiply plus xor-fold. `FlatIntMap` is used for the internal Rust
cell-line grid; the hash only changes open-addressing probe order. It does not
change grid keys, line bucket ordering, physics arithmetic, compiler policy,
scorer inputs, specs, or baselines.

- **Correctness before A/B:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify:compiler:behavior` passed: 48/48 cells byte-identical,
    repair_cells=33, repair_restarts=676.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=30 --reps=4 --warmup=1`
  - base artifact `d82ffa0fe166`
  - candidate artifact `433a35ba440b`
  - base mean **7,184.6 ns/frame**
  - candidate mean **7,136.9 ns/frame**
  - delta median/mean **-0.58% / -0.66%**
  - 95% CI **[-1.01%, -0.33%]**
  - candidate won **23/30** rounds
  - `P(candidate faster)=100.0%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100 --reps=4 --warmup=1`
  - base artifact `d82ffa0fe166`
  - candidate artifact `433a35ba440b`
  - base mean **7,217.5 ns/frame**
  - candidate mean **7,156.1 ns/frame**
  - delta median/mean **-0.79% / -0.84%**
  - 95% CI **[-1.12%, -0.52%]**
  - candidate won **83/100** rounds
  - `P(candidate faster)=100.0%`
- **Wider gates after acceptance:**
  - `npm run wasm:all` passed: kernel, stateful engine, trace, numeric diff,
    forking/budget, compile-hash, replay, and low-level bench checks green.
  - `npm run verify:compiler:behavior` passed again after the `wasm:all` rebuild.
  - The measured candidate artifact (`433a35ba440b6c773f3a6c5d4fdcbd91`) was
    restored after `wasm:all` rewrote the local artifact to `dac3ed6a47d4`.
- **Current standing:** `npm run perf`
  - mean **6,884.2 ns/physics-frame**
  - median **6,500.2 ns/physics-frame**
  - stddev **705.0**
  - frames **50,003**

Verdict: kept. The full paired gate cleared the probability and median-delta
thresholds, and the confidence interval stayed below zero. The `<5,000
ns/physics-frame` objective remains open.

## Attempt 2 (2026-07-09) - precompute joint current score axes, KEEP

Mechanism kept: compute the current-axis scoring mask once per joint aimed
candidate set and pass it through to `predictJointArcScoreReadout`. The current
targets are fixed while enumerating pitch/rotate knob candidates, so this avoids
six repeated `shouldScoreCurrentAxis` checks per score readout without changing
the scored axes or model arithmetic.

This is a TypeScript compiler hot-path change only; the accepted Rust/WASM
artifact remains `433a35ba440b6c773f3a6c5d4fdcbd91`.

- **Focused correctness:**
  - `npx vitest run tests/optimizer_sample.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`
    passed: 38/38 tests.
- **Behavior gate:**
  - `npm run verify:compiler:behavior` passed before and after A/B:
    48/48 cells byte-identical, repair_cells=33, repair_restarts=676.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4 --warmup=1`
  - swapped files: `scripts/v0/optimizer/aim.ts`,
    `scripts/v0/optimizer/arc_model.ts`
  - base mean **7,164.7 ns/frame**
  - candidate mean **7,098.4 ns/frame**
  - delta median/mean **-0.82% / -0.91%**
  - 95% CI **[-1.47%, -0.32%]**
  - candidate won **25/30** rounds
  - `P(candidate faster)=99.9%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **7,152.5 ns/frame**
  - candidate mean **7,083.8 ns/frame**
  - delta median/mean **-0.86% / -0.95%**
  - 95% CI **[-1.20%, -0.75%]**
  - candidate won **83/100** rounds
  - `P(candidate faster)=100.0%`
- **Current standing:** `npm run perf`
  - mean **6,861.6 ns/physics-frame**
  - median **6,468.9 ns/physics-frame**
  - stddev **752.4**
  - frames **50,003**

Verdict: kept. The behavior gate remained bit-identical and the full JS paired
gate showed a repeatable win. The `<5,000 ns/physics-frame` objective remains
open.
