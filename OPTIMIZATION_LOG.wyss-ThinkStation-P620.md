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
