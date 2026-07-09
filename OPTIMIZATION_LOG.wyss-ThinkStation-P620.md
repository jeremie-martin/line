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

## Rejected probes (2026-07-09 continuation)

All source candidates below were reverted after the listed speed gate. The
accepted WASM artifact was restored to `433a35ba440b6c773f3a6c5d4fdcbd91`.

- **Candidate ownership check without `Set`: REJECT**
  - Mechanism: replace per-candidate owned-line `Set` allocation in
    `evaluateGapFit` with direct contact-id/line-id scans.
  - Correctness: focused optimizer tests passed; `npm run
    verify:compiler:behavior` passed 48/48 cells, repair_cells=33,
    repair_restarts=676.
  - Screen A/B kept: delta median/mean **-0.65% / -0.91%**, 95% CI
    **[-1.51%, -0.42%]**, `P(candidate faster)=100.0%`.
  - Full JS A/B rejected as too weak: base mean **7,091.9 ns/frame**,
    candidate mean **7,081.8 ns/frame**, delta median/mean **-0.09% / -0.13%**,
    95% CI **[-0.43%, 0.11%]**, `P(candidate faster)=85.9%`.

- **`remove_line` single-position removal: REJECT**
  - Mechanism: replace bucket `retain` with `position` + `remove` in
    `engine-rs/src/line.rs`.
  - Correctness: `cargo test`, `npm run build:wasm`, and `npm run
    verify:compiler:behavior` passed.
  - WASM A/B screen was inconclusive: base mean **7,082.7 ns/frame**,
    candidate mean **7,083.4 ns/frame**, delta median/mean **-0.31% / +0.02%**,
    95% CI **[-0.40%, 0.47%]**, `P(candidate faster)=46.1%`.

- **Joint arc predictor feature precompute: REJECT**
  - Mechanism: store linear-model coefficients and precompute knob features once
    per `predictJointArcScoreReadout` call.
  - Correctness: focused optimizer tests passed; `npm run
    verify:compiler:behavior` passed.
  - Screen A/B kept, but full JS A/B was a regression: base mean
    **7,083.6 ns/frame**, candidate mean **7,103.9 ns/frame**, delta median/mean
    **+0.07% / +0.29%**, 95% CI **[0.01%, 0.57%]**,
    `P(candidate faster)=2.4%`.

- **Unroll `summarize_frame` BODY average: REJECT**
  - Mechanism: replace the six-entity BODY iterator with explicit additions in
    lr-core body order.
  - Correctness: `cargo test`, `npm run build:wasm`, and `npm run
    verify:compiler:behavior` passed.
  - WASM A/B screen was inconclusive: base mean **7,090.6 ns/frame**,
    candidate mean **7,085.2 ns/frame**, delta median/mean **+0.02% / -0.07%**,
    95% CI **[-0.33%, 0.21%]**, `P(candidate faster)=68.9%`.

- **Hoist report-only axis checks: REJECT**
  - Mechanism: precompute the six immutable `REPORT_ONLY_AXIS_SET` checks used by
    current-axis scoring.
  - Correctness: focused optimizer tests passed; `npm run
    verify:compiler:behavior` passed.
  - JS A/B screen was inconclusive: base mean **7,057.8 ns/frame**, candidate
    mean **7,067.8 ns/frame**, delta median/mean **-0.04% / +0.15%**, 95% CI
    **[-0.21%, 0.52%]**, `P(candidate faster)=25.5%`.

## Attempt 3 (2026-07-09) - direct all-axis measurement scan, KEEP

Mechanism kept: specialize `measureGapAxes` for the hot all-axis path so
air/speed/elevation/amplitude share the common frame scan. The per-axis
`AXIS_MEASURE` registry remains available for individual reductions, and
`measureGapAxes` preserves the previous output key order
`air,speed,grain,elevation,amplitude,impact`.

This is a TypeScript compiler hot-path change only; the accepted Rust/WASM
artifact remains `433a35ba440b6c773f3a6c5d4fdcbd91`.

- **Profile basis:** fresh `npm run cbench:prof -- --spec=mini_burst --seed=0 --budget=50000 --reps=10 --warmup=2`
  showed `scripts/v0/core/measure.ts` at **100.8 ms / 2.2%** self time, with
  repeated axis-reduction loops in the measured hot path.
- **Focused correctness:**
  - `npx vitest run tests/optimizer_sample.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`
    passed: 38/38 tests.
  - Quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`.
- **Behavior gate:**
  - `npm run verify:compiler:behavior` passed before and after A/B:
    48/48 cells byte-identical, repair_cells=33, repair_restarts=676.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4 --warmup=1`
  - swapped file: `scripts/v0/core/measure.ts`
  - base mean **7,097.2 ns/frame**
  - candidate mean **7,057.2 ns/frame**
  - delta median/mean **-0.36% / -0.55%**
  - 95% CI **[-1.03%, -0.17%]**
  - candidate won **22/30** rounds
  - `P(candidate faster)=99.9%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **7,092.2 ns/frame**
  - candidate mean **7,068.6 ns/frame**
  - delta median/mean **-0.35% / -0.32%**
  - 95% CI **[-0.63%, -0.02%]**
  - candidate won **65/100** rounds
  - `P(candidate faster)=98.2%`
- **Current standing:** `npm run perf`
  - mean **6,747.6 ns/physics-frame**
  - median **6,348.1 ns/physics-frame**
  - stddev **713.0**
  - frames **50,003**

Verdict: kept. The behavior gate remained bit-identical and the full JS paired
gate cleared the probability and median-delta criteria. The `<5,000
ns/physics-frame` objective remains open.

## Attempt 4 (2026-07-09) - inline grain median in all-axis measurement, KEEP

Mechanism kept: in the hot `measureGapAxes` all-axis path, compute grain line
lengths with a direct loop and sort that array in place instead of using
`gapLines.map(...)` followed by the generic `median(...)` helper, which copies
before sorting. The `Math.hypot` length arithmetic, numeric sort order, median
formula, output key order, and standalone `AXIS_MEASURE.grain` reducer are
unchanged.

This is a TypeScript compiler hot-path change only; the accepted Rust/WASM
artifact remains `433a35ba440b6c773f3a6c5d4fdcbd91`.

- **Profile basis:** after Attempt 3, the fresh compile profile still showed
  `scripts/v0/core/measure.ts` at about **101.7 ms / 2.2%** self time, with
  `measureGapAxes` at about **52.6 ms** aggregate self time and generic
  `median` at about **21.3 ms** aggregate self time.
- **Focused correctness:**
  - `npx vitest run tests/optimizer_sample.test.ts tests/objective_quality.test.ts tests/arc_model.test.ts`
    passed: 38/38 tests.
  - Quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34` with median **334.11 ms**.
- **Behavior gate:**
  - `npm run verify:compiler:behavior` passed before and after A/B:
    48/48 cells byte-identical, repair_cells=33, repair_restarts=676.
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - swapped file: `scripts/v0/core/measure.ts`
  - base mean **7,062.0 ns/frame**
  - candidate mean **7,044.2 ns/frame**
  - delta median/mean **-0.31% / -0.24%**
  - 95% CI **[-0.46%, 0.05%]**
  - candidate won **58/100** rounds
  - `P(candidate faster)=95.1%`
- **Current standing:** `npm run perf`
  - mean **6,828.2 ns/physics-frame**
  - median **6,397.9 ns/physics-frame**
  - stddev **778.7**
  - frames **50,003**

Verdict: kept. The behavior gate remained bit-identical and the full JS paired
gate barely cleared the probability threshold with a negative median delta. The
single `npm run perf` standing remains noisy and above the `<5,000
ns/physics-frame` objective, so the goal remains open.

## Rejected probes (2026-07-09 after Attempt 4)

All source candidates below were reverted after the listed speed gate. The
accepted WASM artifact remained `433a35ba440b6c773f3a6c5d4fdcbd91`.

- **Candidate-window single-contact array reuse: REJECT**
  - Mechanism: in `detectCandidateWindowBuffer`, reuse the previous one-element
    `contactLineIds` array for consecutive frames with the same single contact
    line id, mirroring the existing shared empty-contact singleton.
  - Correctness: focused optimizer tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen was inconclusive: base mean **7,046.1 ns/frame**, candidate
    mean **7,023.5 ns/frame**, delta median/mean **-0.23% / -0.31%**, 95% CI
    **[-0.79%, 0.13%]**, candidate won **19/30** rounds,
    `P(candidate faster)=90.2%`.

- **Candidate-window detector constant hoist: REJECT**
  - Mechanism: hoist `DEFAULT_PARAMS` values out of
    `detectCandidateWindowBuffer`'s per-frame loop and replace
    `Math.abs(pos) > worldEnvelope` with equivalent direct bound comparisons.
  - Correctness: focused optimizer tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen kept: base mean **7,104.5 ns/frame**, candidate mean
    **7,040.3 ns/frame**, delta median/mean **-0.66% / -0.88%**, 95% CI
    **[-1.54%, -0.29%]**, `P(candidate faster)=99.9%`.
  - Full JS A/B rejected as inconclusive/regressive: base mean
    **7,069.5 ns/frame**, candidate mean **7,079.5 ns/frame**, delta
    median/mean **+0.11% / +0.16%**, 95% CI **[-0.16%, 0.57%]**,
    candidate won **47/100** rounds, `P(candidate faster)=19.2%`.

- **Line-cell cache 128 slots: REJECT**
  - Mechanism: increase the per-frame `LineCellCache` from 64 to 128 slots in
    the Rust collision lookup path.
  - Correctness: `cargo test`, `npm run build:wasm`, and `npm run
    verify:compiler:behavior` passed. Candidate artifact:
    `483463b97d04259c677b3d6ebc6d8c19`.
  - WASM A/B screen was inconclusive: base mean **7,017.8 ns/frame**,
    candidate mean **6,985.7 ns/frame**, delta median/mean **-0.11% / -0.45%**,
    95% CI **[-1.06%, 0.11%]**, candidate won **16/30** rounds,
    `P(candidate faster)=94.0%`.

- **Line-cell cache direct slot hash: REJECT**
  - Mechanism: keep `LineCellCache` at 64 slots but replace its extra
    golden-ratio slot multiply with direct low-bit masking of the already-encoded
    cell key.
  - Correctness: `cargo test`, `npm run build:wasm`, and `npm run
    verify:compiler:behavior` passed. Candidate artifact:
    `070177b2f3c9bd5dcad6e6ab9586ce64`.
  - WASM A/B screen kept: base mean **7,039.8 ns/frame**, candidate mean
    **6,985.1 ns/frame**, delta median/mean **-0.77% / -0.75%**, 95% CI
    **[-1.56%, 0.05%]**, candidate won **23/30** rounds,
    `P(candidate faster)=96.8%`.
  - Full WASM A/B rejected as inconclusive/regressive: base mean
    **6,999.6 ns/frame**, candidate mean **7,006.8 ns/frame**, delta
    median/mean **+0.13% / +0.11%**, 95% CI **[-0.10%, 0.36%]**,
    candidate won **46/100** rounds, `P(candidate faster)=17.2%`.

- **Shared latent speed/elevation suffix loop: REJECT**
  - Mechanism: in `predictJointArcScoreReadout`, when latent ballistic
    reconstruction needed both current speed and elevation, share the same
    suffix-frame loop instead of walking the same `[prefixEnd+1, rangeEndFrame]`
    range twice.
  - Correctness: focused optimizer tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen was inconclusive: base mean **7,020.2 ns/frame**, candidate
    mean **6,992.1 ns/frame**, delta median/mean **-0.22% / -0.39%**, 95% CI
    **[-0.83%, 0.07%]**, candidate won **20/30** rounds,
    `P(candidate faster)=94.7%`.
  - Full JS A/B rejected as inconclusive: base mean **7,003.0 ns/frame**,
    candidate mean **6,999.4 ns/frame**, delta median/mean **-0.09% / -0.04%**,
    95% CI **[-0.26%, 0.20%]**, candidate won **53/100** rounds,
    `P(candidate faster)=63.6%`.
