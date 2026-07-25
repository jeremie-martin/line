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

- **Direct measurement array reads: REJECT**
  - Mechanism: in `measureGapAxes` and `summarizeBallisticAxisPrefix`, preserve
    frame-offset semantics but read `det.measurements` arrays directly inside
    the hot span loops instead of calling `airborneAt`, `speedAt`, and
    `velocityAt` per frame.
  - Correctness: focused optimizer tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen was inconclusive: base mean **6,986.5 ns/frame**, candidate
    mean **6,983.2 ns/frame**, delta median/mean **-0.33% / -0.04%**, 95% CI
    **[-0.88%, 1.13%]**, candidate won **18/30** rounds,
    `P(candidate faster)=56.6%`.

- **Candidate contact-frame scan cleanup: REJECT**
  - Mechanism: cache the next-contact bound once per `evaluateGapFit` call for
    the release-frame and release-exit checks, and replace the off-beat
    `contactFrames.some(...)` callback with an equivalent explicit loop.
  - Correctness: focused optimizer/handoff tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen rejected: base mean **7,002.4 ns/frame**, candidate mean
    **7,018.8 ns/frame**, delta median/mean **+0.06% / +0.24%**, 95% CI
    **[-0.07%, 0.55%]**, candidate won **13/30** rounds,
    `P(candidate faster)=7.0%`.

- **Single-pass joint fit rows: REJECT**
  - Mechanism: in `fitJointValueModels`, build finite fit rows in one pass
    instead of allocating `finiteRows`, re-reading row values, and mapping a
    second array for every output key.
  - Correctness: focused optimizer tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen was inconclusive: base mean **7,016.2 ns/frame**, candidate
    mean **7,006.5 ns/frame**, delta median/mean **-0.08% / -0.14%**, 95% CI
    **[-0.37%, 0.11%]**, candidate won **17/30** rounds,
    `P(candidate faster)=84.4%`.

- **Single-contact line-id array cache: REJECT**
  - Mechanism: in `detectCandidateWindowBuffer`, reuse one `[lineId]` array per
    integer line id for single-contact frames, instead of allocating a fresh
    one-element `contactLineIds` array for each frame. A survey of
    `mini_burst@50k` saw **72,494** single-contact frames across **43** line ids.
  - Correctness: focused optimizer/handoff tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen was inconclusive: base mean **6,998.3 ns/frame**, candidate
    mean **6,988.8 ns/frame**, delta median/mean **-0.30% / -0.13%**, 95% CI
    **[-0.65%, 0.45%]**, candidate won **17/30** rounds,
    `P(candidate faster)=66.8%`.

- **Single/pair contact line-id array cache: REJECT**
  - Mechanism: extend the contact-array cache to cover both one-id and two-id
    contact frames in `detectCandidateWindowBuffer`. A survey of `mini_burst@50k`
    saw all **103,638** contact frames at count 1 or 2, with only **106** distinct
    id combinations.
  - Correctness: focused optimizer/handoff tests passed; quick `npm run cbench -- --spec=mini_burst --seed=0 --budget=50000 --reps=5 --warmup=1`
    kept result signature `6143:34`; `npm run verify:compiler:behavior` passed
    48/48 cells, repair_cells=33, repair_restarts=676.
  - JS A/B screen was flat/inconclusive: base mean **6,999.9 ns/frame**,
    candidate mean **7,001.6 ns/frame**, delta median/mean **-0.01% / +0.03%**,
    95% CI **[-0.46%, 0.58%]**, candidate won **15/30** rounds,
    `P(candidate faster)=48.3%`.

## Baseline (2026-07-25) — new compiler identity after the ballistic-cost campaign

Repository state: `4a2a69f` (`codex/engine-improvement-research-handoff`), clean
source. Host: Linux x86_64, Node `v22.22.2`. Everything below this line is
measured against THIS compiler; the 2026-07-09 standings above describe a
compiler that no longer exists and must not be compared to.

**Why a re-baseline.** The compiler changed intentionally between 2026-07-09 and
now (closed-form ballistic projection shipped by default, readiness retrained
twice, review fixes). Both recorded identity baselines were therefore stale:
`verify:optimizer` diverged on 4/4 cases and `verify:compiler:behavior` on its
first cell.

**The 61k rung is deliberately excluded.** A full-grid `--update` refuses to
record, correctly, because `opening_burst|seed1|budget61000` is INVALID at HEAD
(`sync:0drift/19missing; died:rideStalled@160`) — the known low-budget
regression traced in `7f14e49` / `docs/compiler-improvement-campaign.md`. Forcing
it would freeze an invalid track as the reference and destroy the only signal
below the benchmark's 250k floor. So the speed-campaign identity gate is the
three valid rungs:

```bash
npm run verify:compiler:behavior -- --budgets=100000,150000,200000
```

recorded green at 36/36 cells, repair_cells=36, repair_restarts=493. The
pre-rework 4-rung reference is preserved unmodified at
`generated/verify-compiler-behavior/baseline.2026-07-09-pre-rework.json`.
`npm run verify:optimizer` was re-recorded on the same tree (4 cases @ 40k).

- **Perf:** `npm run perf`
  - mean **13,654.0 ns/physics-frame**
  - median **12,799.5 ns/physics-frame**
  - stddev **1,406.0**
  - frames **50,321**

Roughly double the 2026-07-09 standing of ~7,000 — and that is *after* the
closed form removed the shadow simulation that used to run unbilled beside the
real one. The added per-candidate machinery more than paid that back.

**Where the time goes now** (`npm run cbench:prof -- --spec=mini_burst --seed=0
--budget=50000 --reps=10 --warmup=1`, self time, 8,660 ms sampled). The
2026-07-09 profile in `docs/engine_speed_methodology.md` (41% `step_state`, 26%
other WASM, 21% JS detector) no longer describes this compiler:

| share | bucket |
| ---: | --- |
| 46.6% | optimizer (`scripts/v0/optimizer/**`) |
| 29.2% | WASM engine |
| 6.3% | core (`scripts/v0/core/**`) |
| 5.7% | GC |
| 3.5% | other `scripts/v0` (scorer helpers) |
| 3.4% | node builtins (module loading — harness, not compile) |

Top self-time functions: `wasm-function[31]` 16.7%, `predictValues`
(`arc_vector_model.ts`) 11.3%, `projectedRecoverabilityEnabled`
(`objective.ts`) 7.1%, GC 5.7%, `predictReadinessComponent`
(`readiness_model_artifact.ts`) 4.9%, `scoreProjectedOutgoingAxes` 3.1%,
`currentQualityFromAxisValues` 2.5%.

The engine is no longer the majority of the compile. The optimizer's own
TypeScript is.

## Attempt 5 (2026-07-25) — hoist the recoverability env read out of the axis loop, KEEP

Mechanism kept: `scoreProjectedOutgoingAxes` called `recoverabilityWeightedError`
per axis, and that function opened with `projectedRecoverabilityEnabled()`, which
reads `process.env.LR_PROJECTED_RECOVERABILITY`. The flag is now read once per
scoring call and passed in.

Measured on this host, a `process.env` read costs **268.3 ns** against **0.81 ns**
for a cached boolean — **330x**. At one read per axis error that single
environment variable was **7.11% of the entire compile** (615.8 ms of 8,660 ms
sampled). All env-flag getters in the compile path together were 7.63%, so this
one call site is essentially the whole pattern.

The flag is still sampled per call, so a caller that flips it between calls sees
the change exactly as before; only the redundant reads within one call are gone.
No arithmetic changed.

- **Focused correctness:**
  - `npx vitest run tests/objective_quality.test.ts tests/handoff_policy.test.ts`
    passed: 38/38 tests.
- **Identity gates:** both bit-identical.
  - `npm run verify:optimizer`: 4/4 cases byte-identical.
  - `npm run verify:compiler:behavior -- --budgets=100000,150000,200000`:
    36/36 cells byte-identical, repair_cells=36, repair_restarts=493.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4 --warmup=1`
  - swapped file: `scripts/v0/optimizer/objective.ts`
  - base mean **14,023.1 ns/frame**, candidate mean **13,481.2 ns/frame**
  - delta median/mean **-3.93% / -3.85%**, 95% CI **[-4.53%, -3.09%]**
  - candidate won **29/30** rounds, `P(candidate faster)=100.0%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **13,917.3 ns/frame**, candidate mean **13,432.6 ns/frame**
  - delta median/mean **-3.60% / -3.47%**, 95% CI **[-3.76%, -3.17%]**
  - candidate won **99/100** rounds, `P(candidate faster)=100.0%`
- **Current standing:** `npm run perf`
  - mean **13,260.2 ns/physics-frame**
  - median **12,362.2 ns/physics-frame**
  - stddev **1,405.9**
  - frames **50,321**

Verdict: kept. Both identity gates stayed bit-identical and the full paired gate
cleared the thresholds with the interval well below zero.

**The transferable lesson:** `process.env` is not a property read, it is a ~268 ns
interceptor call. Any feature flag consulted inside a per-candidate or per-axis
loop is a measurable tax. The remaining getters (`aim.ts` x7,
`ballisticClosedFormEnabled`, `kinematicSupportEnabled`, `detectorRunwayEnabled`,
`supportGeometryMode`, `readinessAirFitEnabled`) are each under 0.25% today
because they sit on coarser paths — worth a look only if one moves onto a hot
loop.

## Attempt 6 (2026-07-25) — flatten the arc-vector prediction loop, KEEP

Mechanism kept: `predictValues` walked a `ReadonlyMap<string, FittedOutputEntry>`
with array destructuring, and consulted a `Map<form, number[]>` feature cache —
allocated fresh per call and both `get` and `set` on every output — before doing
the dot product through two levels of indirection (`entry.model.coefficients`).
It is called once per knob candidate over every fitted output, so all of that
plumbing is paid per output per candidate.

Now `fitArcVectorResponseModel` also stores `outputEntries`: the same outputs
flattened, in Map insertion order, to `{key, angle, ref, form, coefficients}`.
Prediction walks that array by index, and the per-call feature memo is four
locals — one per fit form — instead of a Map. Each form is still built on first
use by the same function, the coefficients are read in the same order, and the
dot product is unchanged, so every prediction is bit-identical. `outputModels`
is unchanged and still serves the form/degraded counts in `aim.ts`.

`predictValues` was 11.33% of the profiled compile (980.9 ms of 8,660 ms), the
largest JavaScript cost in the compiler.

- **Focused correctness:**
  - `npx vitest run tests/arc_model.test.ts tests/optimizer_sample.test.ts tests/objective_quality.test.ts`
    passed: 45/45 tests.
- **Identity gates:** both bit-identical.
  - `npm run verify:optimizer`: 4/4 cases byte-identical.
  - `npm run verify:compiler:behavior -- --budgets=100000,150000,200000`:
    36/36 cells byte-identical, repair_cells=36, repair_restarts=493.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4 --warmup=1`
  - swapped file: `scripts/v0/optimizer/arc_vector_model.ts`
  - base mean **13,434.6 ns/frame**, candidate mean **12,805.0 ns/frame**
  - delta median/mean **-4.75% / -4.68%**, 95% CI **[-5.02%, -4.34%]**
  - candidate won **30/30** rounds, `P(candidate faster)=100.0%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **13,440.7 ns/frame**, candidate mean **12,777.1 ns/frame**
  - delta median/mean **-4.91% / -4.93%**, 95% CI **[-5.14%, -4.70%]**
  - candidate won **100/100** rounds, `P(candidate faster)=100.0%`
- **Current standing:** `npm run perf`
  - mean **12,567.7 ns/physics-frame**
  - median **11,694.1 ns/physics-frame**
  - stddev **1,410.1**
  - frames **50,321**

Verdict: kept. Every round favored the candidate and the interval is far from
zero. Session total so far: **13,654.0 -> 12,567.7 ns/frame**, -8.0%, both
identity gates bit-identical throughout.

## Attempt 7 (2026-07-25) — monomorphize the readiness tree traversal, REJECT

Mechanism tried: `predictTree` ran `"isLeaf" in tree` on every node visit to tell
an ordinary tree from a histogram tree, and read all six node arrays through
`tree.x[index]` — polymorphic loads across the two tree shapes, ~1,000 node
visits per component prediction, four components per readiness call. The
candidate attached the parse-time-derived `isLeaf` to every tree (the parser
already computes it for ordinary trees and then discards it), so the shape test
disappeared and the absent `missingGoToLeft` became the `histogram &&` guard,
and hoisted all six array references to locals read once per traversal.

- **Focused correctness:** `npx vitest run tests/readiness_model_artifact.test.ts`
  passed: 8/8 tests.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36).
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4 --warmup=1`
  - base mean **12,741.7 ns/frame**, candidate mean **12,813.2 ns/frame**
  - delta median/mean **+0.17% / +0.57%**, 95% CI **[+0.16%, +1.05%]**
  - candidate won **12/30** rounds, `P(candidate faster)=0.4%`

Verdict: rejected and reverted, despite being bit-identical and strictly less
work on paper. `predictReadinessComponent`'s 4.94% is the traversal arithmetic
itself, not the shape test — V8 already handles a two-shape `in` check and
repeated packed-array loads about as well as hoisted locals, and the added
`missingGoToLeft !== undefined` test per node paid for the rest. The lesson for
this vein: the readiness cost is real work, so cutting it needs fewer node
visits or fewer inferences, not cheaper node visits.

## Attempt 8 (2026-07-25) — build feature vectors without intermediates, KEEP

Mechanism kept: the three feature builders composed their result out of
temporary arrays. `normalized` allocated a mapped copy; `linearFeatures` spread
it into a new array; `additiveQuadraticFeatures` allocated the normalized copy,
a squared copy, and the spread result — three arrays per vector;
`tensorQuadraticFeatures` rebuilt the whole vector with `flatMap` per dimension,
allocating a fresh array and `d` small basis arrays per pass. All of it runs per
fit form per knob candidate, and the same builders run again during fitting.

Each now writes one pre-sized array. The tensor basis expands in place, back to
front, so every prefix is read before anything overwrites it — processing prefix
`p` writes `3p..3p+2`, which never reaches below `p` — preserving the same
prefix-major order, with `prefix * 1` replaced by `prefix` (exact in IEEE-754).
`normalized` is gone; its length-and-finiteness assertion is now made by each
builder, so invalid input still fails identically.

Equivalence was checked numerically before the gates: 240,000 random vectors
across 1-4 dimensions, all three builders, compared by raw float64 bit pattern —
**zero mismatches**.

- **Focused correctness:** `npx vitest run tests/arc_model.test.ts tests/optimizer_sample.test.ts`
  passed: 30/30 tests.
- **Identity gates:** both bit-identical.
  - `npm run verify:optimizer`: 4/4 cases byte-identical.
  - `npm run verify:compiler:behavior -- --budgets=100000,150000,200000`:
    36/36 cells byte-identical, repair_cells=36, repair_restarts=493.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4 --warmup=1`
  - base mean **12,806.6 ns/frame**, candidate mean **12,246.7 ns/frame**
  - delta median/mean **-4.25% / -4.37%**, 95% CI **[-4.75%, -3.97%]**
  - candidate won **30/30** rounds, `P(candidate faster)=100.0%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **12,790.0 ns/frame**, candidate mean **12,265.3 ns/frame**
  - delta median/mean **-4.19% / -4.10%**, 95% CI **[-4.42%, -3.79%]**
  - candidate won **99/100** rounds, `P(candidate faster)=100.0%`
- **Current standing:** `npm run perf`
  - mean **11,828.5 ns/physics-frame**
  - median **10,985.0 ns/physics-frame**
  - stddev **1,327.0**
  - frames **50,321**

Verdict: kept. Session total: **13,654.0 -> 11,828.5 ns/frame mean**
(**12,799.5 -> 10,985.0** median), **-13.4%**, with three accepted mechanisms,
one rejected, and both identity gates bit-identical at every step.

## Attempt 9 (2026-07-25) — sample environment flags once per compile, KEEP

Mechanism kept: Attempt 5 moved `LR_PROJECTED_RECOVERABILITY` from once per axis
to once per scoring call, and the re-profile showed it *still* costing **4.39%**
(388.3 ms) — because `scoreProjectedOutgoingAxes` runs about **111,000 times per
compile**, and 111,000 x 268 ns is 30 ms of pure environment lookup per compile.
Per-call was still far too often.

New `scripts/v0/env_flags.ts` gives a flag a compile-scoped reader:
`compileScopedEnv(name)` returns a closure that re-reads `process.env` only when
the epoch has moved, and `compileHandoffInternal` — the single funnel behind
both `compileHandoff` and `compileHandoffFromSnapshot` — bumps the epoch when a
compile begins. A compile is the coarsest scope that still honors how tests,
studies and scripts use these flags: set the variable, then run a compile. The
value cannot change *during* a compile in any case, since compilation is
synchronous.

Applied to the one flag that is measurably hot. The remaining getters sit on
coarse paths and stay as they are.

- **Focused correctness:** `npx vitest run tests/objective_quality.test.ts tests/handoff_policy.test.ts tests/optimizer_handoff.test.ts`
  passed: 57/57 tests, including the cases that flip other flags between compiles.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36,
  repair_cells=36, repair_restarts=493).
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - swapped files: `scripts/v0/env_flags.ts`, `scripts/v0/optimizer/objective.ts`,
    `scripts/v0/optimizer/handoff.ts`
  - base mean **12,264.1 ns/frame**, candidate mean **11,905.9 ns/frame**
  - delta median/mean **-3.01% / -2.92%**, 95% CI **[-3.13%, -2.66%]**
  - candidate won **98/100** rounds, `P(candidate faster)=100.0%`

Verdict: kept. The mechanism is now available for any other flag that lands on a
hot path.
