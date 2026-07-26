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

## Attempt 10 (2026-07-25) — walk the axis targets without materializing pairs, KEEP

Mechanism kept: `scoreProjectedOutgoingAxes` iterated `Object.entries(targets)`,
which allocates one array of `[key, value]` pairs — plus a pair array per axis —
on every one of its ~111,000 calls per compile. `for...in` walks the same own
string keys in the same insertion order with no allocation. The axis objects are
plain literals with no enumerable inherited properties, so the visited key set is
identical, and the error order into `axisQualityFromErrors` is unchanged.

Self time before: 4.20% (371.9 ms of 8,851 ms).

- **Focused correctness:** `npx vitest run tests/objective_quality.test.ts tests/handoff_policy.test.ts`
  passed: 38/38 tests.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36).
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **11,908.9 ns/frame**, candidate mean **11,400.0 ns/frame**
  - delta median/mean **-4.25% / -4.27%**, 95% CI **[-4.48%, -4.01%]**
  - candidate won **99/100** rounds, `P(candidate faster)=100.0%`

Verdict: kept.

## Attempt 11 (2026-07-25) — complete the arc prediction in place, REJECT (large regression)

Mechanism tried: `completeArcPrediction` does `{...directOutputs}` and both of its
callers build that vector immediately before the call and never touch it again,
so the copy looked unobservable and free to delete — a second 25-key
string-keyed record built per knob candidate.

- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36), 45/45
  focused tests.
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **11,403.7 ns/frame**, candidate mean **13,121.0 ns/frame**
  - delta median/mean **+15.16% / +15.07%**, 95% CI **[+14.79%, +15.35%]**
  - candidate won **0/100** rounds, `P(candidate faster)=0.0%`

Verdict: rejected and reverted. **Deleting a whole object copy per prediction
made the compiler 15% SLOWER** — the largest single effect measured in this
campaign, in the wrong direction.

The obvious explanation is wrong. An isolated microbenchmark of the three
shapes says grow-then-clone costs 1,184 ns to build and 260 ns to read back,
grow-only costs **645 ns** to build and 262 ns to read — i.e. in isolation the
candidate is strictly cheaper on both counts, and cloning a pre-built template
is worse still (6,431 ns). So the regression is not "the spread produced a
faster object to read" in any way a standalone benchmark reproduces; the likely
cause is that consumers used to receive an object created at exactly ONE site
and now receive one created at two, which their inline caches see as different
maps — but that is a hypothesis, and the only measured fact is the 15%.

Two things to take from it: the prediction record's *shape discipline* is
load-bearing far beyond the cost of building it, and per-object microbenchmarks
do not predict this code. The way out is not to tune the record but to stop
passing one through the hot path at all.

## Attempt 12 (2026-07-25) — score a knob candidate without a prediction record, INCONCLUSIVE

Mechanism tried: `scoreConfiguredKnobs` predicted ~25 outputs into a string-keyed
record, `completeArcPrediction` copied it, and `scoreCompletedArcPrediction` then
looked twelve of them back up by name. The candidate resolved those twelve keys
to positions in `outputEntries` once per model, predicted positionally into a
per-model scratch buffer, and built the same readout by index — no record, no
copy, no `current.cost` (which that readout never reads).

The target was chosen from the call tree, not by guesswork: **8.32% of the
compile flows through `predictArcVectorOutputs <- scoreConfiguredKnobs`**, and
every other route into it is under 0.02%.

- **Focused correctness:** 63/63 tests.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36) — the
  positional readout reproduces the record path exactly, including the
  `undefined`-reads-as-NaN behavior of a missing output.
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **11,435.2 ns/frame**, candidate mean **11,429.4 ns/frame**
  - delta median/mean **-0.07% / -0.04%**, 95% CI **[-0.42%, +0.24%]**
  - candidate won **52/100** rounds, `P(candidate faster)=65.5%`

Verdict: inconclusive, so reverted. The interval bounds the true effect below
0.42% either way — removing the record is worth essentially nothing.

**This is the third measurement saying the same thing: the prediction record is
not where this code spends its time.** An isolated benchmark says building it
costs 4x the arithmetic that fills it (2,187 ns vs 476 ns); deleting a whole
copy of it made the compiler 15% slower (Attempt 11); and removing it from the
hot path entirely is a wash. Whatever `predictValues`' 8% is, it is not the
record, and per-object microbenchmarks do not predict this compiler. A future
attempt on this vein needs an in-situ measurement — a counter, or a profile of a
deliberately perturbed build — before any code is written.

(The candidate's own implementation had one defect worth noting if anyone
retries: it allocated a small closure per call to read the slots. That is worth
tenths of a percent, not the missing 8%.)

## Attempt 13 (2026-07-25) — stop inferring a readiness component nobody reads, KEEP

Mechanism kept: `scoreReadinessWithArtifact` always inferred the `airFit`
component — a full 200-tree traversal — and then multiplied the product by 1,
because the air factor is deliberately excluded from the readiness product
(documented at length in `readiness_scoring.ts`). The predicted value was kept
as `airFitPredicted` so "nothing observable is lost", but nothing reads it:
production reads `readiness.airFit`, and no study or benchmark reads
`airFitPredicted` at all — the readiness benchmark scores components straight
from the artifact.

So one of up to four inferences per readiness call, on the compiler's
second-largest JavaScript cost (`predictReadinessComponent`, 5.97%), produced a
number with no consumer. It is now inferred only when `LR_READINESS_AIR_FIT=1`
puts it back in the product, which keeps the A/B arm intact; with the flag off
`airFitPredicted` reports the neutral 1 that was multiplied in.

- **Focused correctness:** `npx vitest run tests/readiness_model_artifact.test.ts tests/objective_quality.test.ts`
  passed: 23/23 tests.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36,
  repair_cells=36, repair_restarts=493).
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **11,447.7 ns/frame**, candidate mean **11,228.3 ns/frame**
  - delta median/mean **-1.85% / -1.91%**, 95% CI **[-2.11%, -1.69%]**
  - candidate won **97/100** rounds, `P(candidate faster)=100.0%`

Verdict: kept. Unlike the three rejected plumbing attempts, this one removes
work rather than reshaping it — which is the pattern that keeps paying in this
compiler.

### Session standing (2026-07-25, after Attempt 13)

`npm run perf`: mean **11,068.0**, median **10,300.9**, stddev 1,313.4, frames
50,321.

From the session baseline of 13,654.0 / 12,799.5 that is **-18.9% mean, -19.5%
median**, over six accepted mechanisms and three rejected ones, with
`verify:optimizer` and `verify:compiler:behavior` bit-identical at every step.

| attempt | mechanism | Δ at R=100 |
|---|---|---:|
| 5 | env read out of the per-axis loop | -3.60% |
| 6 | flat prediction entries, no Map walk | -4.91% |
| 7 | readiness traversal monomorphized | REJECT +0.17% |
| 8 | feature vectors without intermediates | -4.19% |
| 9 | env flags sampled once per compile | -3.01% |
| 10 | axis targets without entry pairs | -4.25% |
| 11 | prediction completed in place | REJECT **+15.07%** |
| 12 | record-free knob readout | INCONCLUSIVE -0.07% |
| 13 | readiness air component not inferred | -1.85% |

**What the wins have in common:** every accepted mechanism either stopped doing
something (an environment lookup, an inference, an allocation) or removed a data
structure that was being built and thrown away. **Every rejected one reshaped
work that still happened** — and two of the three were bit-identical and
strictly less work on paper, one of them 15% slower in practice.

**Where the remaining time is**, from a profile of the current tree: WASM engine
**35.0%** (`wasm-function[31]` alone 20.6%), optimizer TypeScript 35.5%, core
7.9%, GC 6.1%, `score.ts` 3.5% (untouchable — hashed by `EVALUATOR_FINGERPRINT`),
and roughly 4.5% that is tsx module loading rather than compiling at all. The
identified TypeScript levers that remain — `currentQualityFromAxisValues`'
per-call objects, the detector window buffer, general allocation — total perhaps
5-8%, which would land near 10,300-10,500. Anything below that has to come out
of the Rust kernel.

## Attempt 14 (2026-07-25) — read the axis value from the argument, not a packed object, KEEP

Mechanism kept: `currentQualityFromAxisValues` receives the six axis values as
arguments and immediately packed them into `{ air, speed, grain, elevation,
amplitude, impact }` so the AXES loop could read one back out by name — an
allocation per scored candidate, plus a dynamic key load per axis. The loop now
selects the argument with a switch. An unknown axis falls to NaN, exactly as the
absent object key did, so the `Number.isFinite` rejection is unchanged.

Self time before: 3.37% (279.6 ms of 8,295 ms).

- **Focused correctness:** `npx vitest run tests/arc_model.test.ts tests/optimizer_sample.test.ts`
  passed: 30/30 tests.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36).
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **11,262.7 ns/frame**, candidate mean **11,222.8 ns/frame**
  - delta median/mean **-0.50% / -0.34%**, 95% CI **[-0.65%, -0.06%]**
  - candidate won **63/100** rounds, `P(candidate faster)=99.7%`

Verdict: kept — over the discovery bar, and the interval stays below zero, but
this is the first accepted mechanism under 1%: the cheap allocation removals in
this compiler are running out.

### Session close (2026-07-25)

`npm run perf`: mean **11,013.5**, median **10,212.1**, stddev 1,314.7, frames
50,321. Against the session baseline of 13,654.0 / 12,799.5 that is **-19.3%
mean, -20.2% median**, with seven accepted mechanisms, three rejected, and both
identity gates bit-identical at every single step.

**What is left, ranked, for whoever picks this up.**

1. **The Rust/WASM engine — 35% of the compile**, `wasm-function[31]` alone
   20.6%. The only remaining mass large enough to move the headline. Needs the
   engine gates (`cargo test`, `npm run build:wasm`, `npm run wasm:all`) and
   WASM-mode `perf_ab`, so cycles are much slower than the JS ones used here.
2. **GC, 6.1%.** The obvious per-frame allocation left is
   `detectCandidateWindowBuffer`, which builds a `{x, y}` velocity object per
   frame (and a position object per frame under pool mode). Removing it means
   changing `WindowDetection`'s shape for every consumer — a wide refactor of a
   shared structure, which is precisely the kind of change that has failed here
   three times out of four.
3. **`predictValues`, 8.5%.** Do not attack it by reshaping the prediction
   record; that has now been measured three ways and the record is not the cost
   (Attempts 11 and 12). Find out what the 8.5% actually is first — a counter, or
   a deliberately perturbed build — before writing code.
4. **`predictReadinessComponent`, ~5%** after Attempt 13. What remains is the
   real traversal of three 200-tree ensembles per readiness call. Attempt 7 shows
   cheaper node visits do not pay; fewer inferences do.

**The rule this session established, and it held nine times out of ten:** in this
compiler, *stopping work* pays and *reshaping work* does not. Every accepted
mechanism removed something — an environment lookup, an inference, an allocation,
a data structure built and thrown away. Every rejected one rearranged work that
still happened, and two of those were bit-identical and strictly less work on
paper, one of them 15% slower in practice.

## Attempt 15 (2026-07-25) — first engine candidate: stop scanning past the insertion point, REJECT

Named the wasm functions first, rather than guessing from `wasm-function[31]`:
built with `strip = false` and `wasm-opt -g` purely as a **measurement artifact**
(the accepted kernel `433a35ba440b` was saved and restored afterwards). That gives
the engine's real breakdown, 34.76% of the compile in total:

| share | function |
| ---: | --- |
| 23.32% | `kernel::step_state` (both const-generic variants: 20.23% TRACK, 3.09% not) |
| 2.92% | `engine::update_computed` |
| 2.04% | `line::push_line` |
| 1.75% | `engine::Cache::add_line` |
| 1.6% | dlmalloc (malloc/free/realloc/chunk bookkeeping) |
| 0.74% | `engine::Cache::summarize_frame` |
| 0.50% | `frame::add_to_cell` |

Mechanism tried: `insert_grid_line` scans the WHOLE bucket on every insert, even
though the bucket is sorted by (group asc, id desc) — so the duplicate it is
looking for can only sit at the insertion point. The candidate broke out of the
loop there, which is provably order-identical.

- **Correctness — all green:** `cargo test` 5/5; `LR_ENGINE=wasm npm run verify`
  byte-identical (engine trace oracle + optimizer 4/4);
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36 cells;
  **`npm run wasm:all` ALL GREEN**, including `trace:diff` (every point position
  bit-identical), replay, forking/budget and compile-hash.
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100 --reps=4 --warmup=1`
  (WASM mode, base kernel built from HEAD in a throwaway worktree)
  - base mean **11,177.5 ns/frame**, candidate mean **11,279.9 ns/frame**
  - delta median/mean **+0.67% / +0.92%**, 95% CI **[+0.66%, +1.20%]**
  - candidate won **26/100** rounds, `P(candidate faster)=0.0%`

Verdict: rejected, reverted, accepted artifact `433a35ba440b` restored and
re-verified. The buckets are evidently small enough that scanning to the end is
cheaper than the extra branch needed to stop early — the loop is short and
predictable, and the break made it neither.

This is the fourth time in this campaign that strictly-less-work measured slower.
The engine is not obviously reachable from the outside either: it was already
given a `get_unchecked` pass, a gated sqrt and a lazy sqrt in the 2026-07-09
session, and the remaining mass is `step_state` itself — the bit-faithful
physics, ported verbatim, where the arithmetic is the product.

## Attempt 16 (2026-07-26) — predict only the outputs the readout reads, KEEP (-7.67%)

**The measurement that unlocked it.** Attempts 11 and 12 concluded "the prediction
record is not the cost" and I generalised that to "predictValues is arithmetic,
leave it alone". That generalisation was wrong, and a counter proved it: per
compile `predictValues` runs **75,600 times over 21 outputs each, but only
101.2 multiply-adds per call** — **7.7 ms of arithmetic in a 751 ms compile**,
against a profiled 8.45% (~63 ms). So ~55 ms per compile really was overhead;
the earlier attempts had simply moved it instead of removing it.

Mechanism kept: `scoreConfiguredKnobs` needs at most the 18 `READOUT_KEYS`, of
which ~12 exist in a fitted model — but the full path predicted **all 21**
outputs, built a string-keyed record of them, copied that record in
`completeArcPrediction`, and then looked twelve back up by name.
`predictArcVectorScoreReadout` resolves those keys to entry positions once per
model, predicts **only those entries** into a per-model scratch buffer, and
builds the readout by index. Roughly 40% of the per-output work on the hottest
path simply stops happening, and the record and its copy stop happening at all.

Bit-identity: same entries, same features, same coefficient order, same
`unwrapAngle`. An output the model did not fit has slot -1 and reads as NaN —
exactly what the absent record key already meant, since
`currentQualityFromAxisValues` rejects `undefined` and `NaN` alike through
`Number.isFinite` and the readout fields applied `?? NaN`. `current.cost` is not
computed because this readout never reads it; `predictArcVectorOutputs` still
serves callers that want the whole record.

- **Focused correctness:** 63/63 tests across arc_model, optimizer_sample,
  objective_quality and optimizer_solver.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36 cells,
  repair_cells=36, repair_restarts=493).
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **11,199.8 ns/frame**, candidate mean **10,353.0 ns/frame**
  - delta median/mean **-7.67% / -7.55%**, 95% CI **[-7.80%, -7.23%]**
  - candidate won **99/100** rounds, `P(candidate faster)=100.0%`

Verdict: kept — the largest single win of the campaign, and the rule holds
again: **stop doing the work**. Attempt 12 reshaped the same path and measured
-0.07%; this one deletes 40% of it and measures -7.67%.

### Standing after Attempt 16 (2026-07-26) — target met

`npm run perf`: mean **9,964.0 ns/physics-frame**, median **9,411.3**, stddev
1,006.8, frames 50,321.

Against the session baseline of 13,654.0 / 12,799.5 that is **-27.0% mean,
-26.5% median**, with eight accepted mechanisms and both identity gates
bit-identical at every step.

**The correction worth recording.** After Attempts 11, 12 and 15 all measured
slower-or-neutral, this log concluded the remaining cost was "arithmetic that
produces the answer" and that the TypeScript surface was exhausted. That was
wrong, and it was wrong because it generalised from failed *reshapings* to a
claim about *totals* without ever counting the work. One counter — 75,600 calls,
21 outputs, 101 multiply-adds — showed the arithmetic was 1% of the compile while
the function profiled at 8.45%, and the very next candidate took 7.67%.

The instruction the earlier entries gave ("a future attempt on this vein needs an
in-situ measurement before any code is written") was the right instruction. The
mistake was writing a conclusion about the vein in the same breath, instead of
just doing the measurement.

## Attempt 17 (2026-07-26) — hand the scorer its errors instead of two objects, KEEP (-4.31%)

Counted first, again. `currentQualityFromAxisValues` runs **75,530 times per
compile and scores exactly 3.00 axes per call** — and that call plus the scorer
functions it reaches (`axisErrorsForTargets` 1.27%, `axisQualityFromErrors`
2.70%) came to **7.4% of the compile, about 730 ns to score three numbers**.

Mechanism kept: it built a `scoredTargets` and an `achieved` object and handed
them to `axisQualityForTargets`, which walks AXES a *second* time, re-checks the
report-only set and finiteness, and allocates the errors array itself. The
caller already knows the axes and the values, so it now builds the errors array
directly and calls `axisQualityFromErrors` — the same scorer function
`objective.ts` already calls this way. Two objects, a second pass and a call
layer stop happening per scored candidate.

Bit-identity: same AXES order, same `value - target`, same report-only skip
(`REPORT_ONLY_AXIS_SET` lives in `types.ts` and was already imported here, so no
scorer semantics moved out of `score.ts`), and a scored axis with a non-finite
value still short-circuits to NaN *before* the report-only filter — exactly
where it happened when the filter lived downstream.

- **Focused correctness:** 45/45 tests.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36).
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **10,329.4 ns/frame**, candidate mean **9,882.6 ns/frame**
  - delta median/mean **-4.31% / -4.31%**, 95% CI **[-4.55%, -4.00%]**
  - candidate won **99/100** rounds, `P(candidate faster)=100.0%`

Also counted, and worth recording as closed: **readiness is only 583 calls per
compile with 0.0% repeated (boundary, gap) inputs** — memoisation is not
available and its ~4.8% is 583 x 600 real tree traversals. And **100% of the
75,530 knob candidates are fully scored** — none are rejected after paying for
the readout, so there is no lazy-evaluation win in `scoreConfiguredKnobs`.

## Attempt 18 (2026-07-26) — stop building three objects and a discarded utility per knob candidate, KEEP (-1.16%)

Mechanism kept: `projectedReadoutQuality` packed three scalars into an aggregate
object — with a **conditional spread**, so two hidden shapes — and handed it to
`scoreProjectedOutgoingSurrogate`, which unpacked it into an `achieved` object
for the axis loop to read back out, allocated a `{ readiness: 1 }` argument,
computed a `proposalUtility`, and returned a `{ projectedOutgoingQuality, value }`
object of which the caller **used one field and threw the other away** — while
`scoreConfiguredKnobs` then recomputed `proposalUtility` itself with the real
settled quality. All of that, 75,530 times per compile.

`projectedOutgoingSurrogateQuality` takes the three scalars, builds the errors
directly and returns the number. Identical by construction: the same three
null-returns in the same order (speed, air, elevation), the same `for...in` order
over the targets, the same `recoverabilityWeightedError`, the same
`axisQualityFromErrors`. The old empty-errors fallback went through
`axisQualityForTargets(targets, achieved)`, whose error list is empty in exactly
the same case, so `axisQualityFromErrors([])` is that same value.
`scoreProjectedOutgoingSurrogate` is unchanged for the three studies that use it.

- **Focused correctness:** 63/63 tests.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36).
- **A/B at R=100: INCONCLUSIVE** — median **-1.08%**, 81/100 rounds,
  `P(faster)=94.7%`, CI [-1.17%, +0.20%]. Below the 0.95 bar, with the mean
  dragged by a few slow rounds while the sign test was already decisive.
- **A/B at R=200 (the doc's remedy for exactly this state): KEEP**
  - base mean **9,911.3 ns/frame**, candidate mean **9,792.4 ns/frame**
  - delta median/mean **-1.16% / -1.18%**, 95% CI **[-1.40%, -0.99%]**
  - candidate won **165/200** rounds, `P(candidate faster)=100.0%`

Verdict: kept. Recorded with both runs because the decision changed with rounds:
R=100 was underpowered for a ~1% effect on this noise, not null. Re-running an
inconclusive at higher R is the documented remedy — but it is only honest if the
first result is reported too, which is why it is here.

## Attempt 19 (2026-07-26) — flatten the readiness trees into one cache-line-per-node block, REJECT

Hypothesis, from Attempt 7's failure: `predictReadinessComponent`'s ~5% is not
instructions but **memory latency**. The parsed model is 800 trees as ~4,000
separate JS arrays over ~0.93 MB, and a node visit reads five of them
(`feature`, `threshold`, `childrenLeft`, `childrenRight`, `isLeaf`) — about
3,000 scattered node visits per readiness call, measured at ~17 ns each, which
is L3-latency shaped rather than work shaped.

Mechanism tried: flatten all 23,200 nodes into one `Float64Array` at 8 doubles —
exactly one 64-byte cache line — per node, plus `Int32Array` tree offsets, so a
node visit is a single line instead of five scattered ones.

- **Equivalence, checked before the gates:** 320,000 tree traversals over the
  real production model, comparing the flat traversal against the original
  node-array traversal by raw float64 bit pattern, with 6% of features injected
  non-finite to exercise the missing-value branch — **0 mismatches**.
- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36), 23/23 tests.
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --reps=4 --warmup=1`
  - base mean **9,914.2 ns/frame**, candidate mean **9,992.5 ns/frame**
  - delta median/mean **+0.65% / +0.80%**, 95% CI **[+0.50%, +1.14%]**
  - candidate won **20/100** rounds, `P(candidate faster)=0.0%`

Verdict: rejected and reverted. The layout hypothesis is wrong too — either the
padding to 1.48 MB costs more than the locality buys, or V8's packed-double
arrays were already serving these reads better than an indexed `Float64Array`
with integer coercions.

**This vein is now closed on evidence, not on assumption:** the readiness
traversal has resisted an instruction-level mechanism (Attempt 7, +0.17%) and a
layout-level one (this, +0.65%), and its inputs are 583 calls per compile with
**0.0% repeats**, so there is nothing to memoise. Its ~5% is 583 x 600 real tree
traversals. Cutting it needs fewer trees, which is a model decision, not a speed
refactor.

## Attempt 20 (2026-07-26) — per-model feature scratch on the readout path, INCONCLUSIVE

Mechanism tried: `predictReadoutValuesInto` builds a feature vector per fit form
per call — 75,530 calls per compile, so ~150,000 short-lived arrays — and the
vector never outlives the call. The candidate gave each model a scratch array per
form, filled in place, keeping the allocating builders for fitting and the full
record path.

- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36), 45/45 tests.
- **Full A/B gate:** base **9,897.6**, candidate **9,893.5 ns/frame**;
  delta median/mean **-0.06% / -0.03%**, 95% CI **[-0.27%, +0.20%]**,
  53/100 rounds, `P(candidate faster)=60.4%`.

Verdict: inconclusive and reverted. Unlike Attempt 18 — which was inconclusive at
R=100 with a -1.08% median and 81/100 rounds, and resolved to a clear keep at
R=200 — this one's interval already bounds the effect below 0.27% in both
directions, so more rounds would only buy precision on a number that is zero.
V8's young-generation allocation for a 5-element array is evidently as cheap as
reusing one.

### Where the compile stands at 9,457.9 ns/physics-frame (2026-07-26)

Ten accepted mechanisms, ten rejected or inconclusive, both identity gates
bit-identical at every step. From the session baseline of 13,654.0 that is
**-30.7% mean** (12,799.5 -> 8,894.7 median, -30.5%).

**Every remaining bucket has now been counted, not estimated:**

| bucket | share | what the count says |
| --- | ---: | --- |
| `step_state` | ~30% | ~2,861 ns per BILLED frame against ~2,500 measured isolated at this line density — the billing is honest, there is no hidden re-simulation. Tracking is free (2,853 vs 2,805 ns/frame with it compiled out). Density scaling is weak (10x lines = +15%). |
| engine reconcile + line registration | ~7% | **13,423 line registrations for 33 final lines — 407x** — but that is 2,692 genuinely evaluated candidate arcs, each of which must be in the grid to be simulated. |
| readiness inference | ~5% | 583 calls/compile, **0.0% repeated inputs**, 600 real tree traversals each. Closed: resisted an instruction-level mechanism (Attempt 7) and a layout-level one (Attempt 19). |
| GC | ~5.5% | 94% scavenges; the big per-call allocations on the knob path are gone (Attempts 16, 17, 18) and reusing the last one measured zero (Attempt 20). |
| arc-vector readout | ~4.5% | Now predicts only the ~12 outputs the readout reads. 101 multiply-adds per call is the arithmetic floor. |
| detector window | ~3.4% | `Math.hypot` per frame — required for bit-identity — feeding sums that are genuinely read. |
| `score.ts` | ~2.6% | Untouchable: hashed whole by `EVALUATOR_FINGERPRINT`. |

**The <8,000 target is not reachable bit-identically from here.** It needs
another -15.4%, and no bucket above has that much overhead left in it: the four
most recent attempts were all rejects or nulls, each against a counted
hypothesis rather than a guess. Reaching it would require the compiler to do
less work per candidate — fewer knob candidates than 75,530, fewer than 2,692
evaluated arcs, or smaller models than 3 x 200 trees. Those are compiler-quality
decisions with a benchmark to price them, not speed refactors, and they belong to
`npm run benchmark -- eval` rather than `perf_ab`.

## Attempt 21 (2026-07-26) — build the kernel with wasm SIMD, INCONCLUSIVE

The last untested avenue against the largest bucket. The kernel is built
scalar-only — no `simd128` anywhere in `Cargo.toml` or the build script — so
LLVM cannot vectorise the solver's paired x/y arithmetic, which is the natural
2-wide shape (`dx`/`dy`, `p1x`/`p1y`, ...). Auto-vectorisation is safe here
because LLVM will not reassociate floating point without fast-math flags, so the
per-lane results are IEEE-identical.

Built with `RUSTFLAGS="-C target-feature=+simd128"` and `wasm-opt --enable-simd`.
**292 v128/f64x2 instructions** appear in the artifact, so the vectoriser did
fire.

- **Correctness — everything green, including the strongest check available:**
  `cargo test` 5/5; `LR_ENGINE=wasm npm run verify` byte-identical;
  **`npm run verify:engine -- --diff` bit-identical over every point position on
  all five fixtures, max err 0** (1220/1220/2260/740 frames);
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36 cells;
  `npm run wasm:all` ALL GREEN.
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100 --reps=4 --warmup=1`
  - base mean **9,775.5 ns/frame**, candidate mean **9,792.1 ns/frame**
  - delta median/mean **+0.01% / +0.17%**, 95% CI **[-0.12%, +0.50%]**
  - candidate won **49/100** rounds, `P(candidate faster)=15.8%`

Verdict: inconclusive, reverted, accepted artifact `433a35ba440b` restored and
re-verified. Vectorising bought nothing because these loops are
**dependency-chain bound, not throughput bound**: each constraint solve feeds the
next through the same two points, and the collision test is a short predicate per
line. Two-wide f64 cannot shorten a serial chain.

**With this the engine has no accessible headroom left, on evidence:** tracking
is free, the sorted-bucket scan is already optimal for its size, density scaling
is weak, there is no hidden re-simulation, and the arithmetic will not vectorise
profitably.

## Attempt 22 (2026-07-26) — `wasm-opt -O4` instead of `-O3`, REJECT

The last build-config lever: the kernel is optimised at `-O3`, and wasm-opt's
higher levels are semantics-preserving (it does not reassociate floating point),
so the level is free to change if it pays.

- **Correctness:** `LR_ENGINE=wasm npm run verify` byte-identical.
- **Full A/B gate:** base (`-O3`, same source) mean **9,842.5 ns/frame**,
  candidate (`-O4`) mean **9,878.3 ns/frame**; delta median/mean
  **+0.16% / +0.37%**, 95% CI **[+0.03%, +0.74%]**, 41/100 rounds,
  `P(candidate faster)=1.8%`.

Verdict: rejected; accepted artifact `433a35ba440b` restored. `-O4` also produced
a slightly *larger* binary (79,752 vs 79,556 bytes), which is consistent with
more aggressive inlining hurting rather than helping here.

**Noted while doing this, for whoever builds next:** a clean `-O3` build from
source produces `dac3ed6a47d4`, but the deployed accepted artifact is
`433a35ba440b`. That is not drift — `npm run build:wasm` runs `wasm-opt` **in
place**, so the accepted artifact is a double-optimised binary and a fresh build
is not byte-comparable to it. The engine workflow already warns about this; it is
recorded here with the two hashes so nobody re-derives it.

### What reaching <8,000 would cost, priced on the speed axis (2026-07-26)

The bit-identical surface is exhausted at **9,457.9**. Reaching 8,000 needs
**-15.4%**, and the counts say exactly where it would have to come from. Recorded
so the decision can be made on numbers rather than a fresh investigation.

**The one lever big enough is evaluating fewer candidate arcs.** The compile
evaluates **2,692 arcs**, registering 13,423 lines, to keep 33. Engine time is
~37% of the compile and scales with the frames those candidates cost, and the
knob-scoring path on top of them (readout + `currentQualityFromAxisValues` +
surrogate + the scorer they call) is another ~13%. So candidate count drives
roughly **half the compile**:

| lever | rough speed value | what it costs |
| --- | ---: | --- |
| halve evaluated arcs (2,692 -> ~1,350) | **~-25%** -> ~7,100 ns/frame | fewer arcs tried per gap; straight quality loss, sized by the benchmark |
| halve knob candidates (75,530 -> ~37,800) | ~-7% | coarser knob search per arc |
| halve readiness ensembles (3 x 200 -> 3 x 100 trees) | ~-2.5% | a less accurate readiness model |

Only the first reaches the target alone, and all three are **compiler-quality
decisions**: they change what the compiler produces, so they are priced by
`npm run benchmark -- eval` against the accepted baseline, not by `perf_ab`.
None of them belongs in this log's workflow, which exists to keep output
bit-identical.

**The honest summary of this campaign:** the compiler was 13,654 ns/frame and is
now 9,457.9 with byte-identical output, and everything still being spent is work
the compiler needs in order to produce that output. What remains is not overhead
to remove; it is a question about how much search and model the compiler should
run — which is the other campaign's question, and the user's call.

## Attempt 23 (2026-07-26) — share fitted feature vectors across outputs, INCONCLUSIVE

Mechanism tried: a probe row's feature vector depends only on its values, the fit
form and the spans — never on which output is being fitted — yet each of the ~21
outputs rebuilt them, and a compile fits ~2,692 models. The candidate memoised
them per (form, row) inside one model fit; sharing is safe because
`fitLinearLeastSquares` only reads `features`.

- **Identity gates:** both bit-identical (`verify:optimizer` 4/4,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36), 45/45 tests.
- **Full A/B gate:** base **9,871.5**, candidate **9,856.2 ns/frame**; delta
  median/mean **-0.30% / -0.15%**, 95% CI **[-0.42%, +0.18%]**, 59/100 rounds,
  `P(candidate faster)=84.6%`.

Verdict: inconclusive, reverted. The interval bounds the effect below 0.42%,
which is under this host's ~0.5% minimum detectable effect — the fitting path is
simply not big enough for a 21x redundancy in it to matter.

### Final: the bit-identical surface is exhausted at 9,457.9 ns/physics-frame

Twenty-three attempts: **ten accepted (-30.7% cumulative), thirteen rejected or
inconclusive.** Every one of the last seven attempts failed, each against a
*counted* hypothesis rather than a guess:

| # | attempt | result |
|---|---|---|
| 17 | scorer errors direct | **-4.31% KEEP** |
| 18 | three objects + discarded utility | **-1.16% KEEP** (R=200) |
| 19 | readiness trees flattened to cache lines | +0.65% |
| 20 | per-model feature scratch | -0.06%, null |
| 21 | **wasm SIMD** (292 v128 instrs, `--diff` max err 0) | +0.01%, null |
| 22 | **wasm-opt -O4** | +0.16% |
| 23 | fitted features shared across outputs | -0.30%, under the noise floor |

**The remaining 9,457.9 is work the compiler needs.** The immovable share alone —
engine 37% (closed on six probes), `score.ts` 2.6% (fingerprinted), readiness 5%
(closed on two), detector 3.2% (`Math.hypot`-bound) — is ~48% of the compile, and
the accessible remainder no longer contains a 15.4% overhead to remove. Reaching
<8,000 requires the compiler to evaluate fewer than 2,692 candidate arcs, which
changes its output and is priced by `npm run benchmark -- eval`.

### Measured, not attempted: the collision caches are already effective (2026-07-26)

Before sizing `LineCellCache` (64 slots) or `ActiveCellCache` (128), which would
be bit-identical, the hit rate was measured with counters exported through a
throwaway ABI on a measurement build (reverted; accepted artifact `433a35ba440b`
restored and re-verified):

```
LineCellCache lookups : 3,489,000   (69 per billed frame)
LineCellCache hits    : 3,244,180   93.0% hit rate
misses (FlatIntMap)   : 244,820
```

At 93% there is no room worth taking: eliminating **every** miss saves on the
order of 0.5% of a compile, well inside this host's noise floor. The 3.49M
lookups themselves are the collision path doing its job — 10 points x 6
iterations per frame — not overhead around it.

Recorded so nobody spends a build cycle on cache sizing.

### The last countable redundancy: candidate windows repeat 5.1% (2026-07-26)

`getCandidateWindow` runs 6,896 times per compile for 2,692 candidate arcs — 2.56
per arc — which looked like it might hide repeat extractions worth memoising
(bit-identically, since the same version and range yield the same bytes).
Counted by `(engine handle, startFrame, endFrame)`:

```
calls    : 6,896
distinct : 6,546
repeats  :   350   (5.1%)
```

Worth roughly 0.16% of a compile. Not a candidate.

**Redundancy is now exhausted as a hypothesis class.** Every place the compiler
might have been doing the same work twice has been counted: readiness inputs
repeat **0.0%**, knob candidates are **100%** used, candidate windows repeat
**5.1%**, fitted feature vectors were 21x redundant but the whole fitting path is
under the noise floor, and the 407x line-registration churn is 2,692 genuinely
distinct arcs. What is left is singular work.

### The one remaining class with headroom: the compile is single-threaded (2026-07-26)

A correction to the conclusion two entries above. That conclusion was about
making the *same sequential work* cheaper, and it holds: redundancy is exhausted,
the engine is closed on six probes, and nine consecutive attempts came back inside
the noise floor.

But the compile does not use the machine:

```
Percent of CPU this job got: 152%      (on a 64-core host)
User 3.91s / System 0.31s / Elapsed 2.77s   — 3 compiles + warmup
```

~1.5 cores, and most of the half is V8's background JIT/GC. **The compiler
evaluates 2,692 candidate arcs strictly one after another**, and each is an
independent (add lines -> simulate window -> detect -> score) unit given its
parent engine state.

**This is the only untested class that is big enough to reach <8,000**, and it can
be bit-identical: candidate evaluation is deterministic, so evaluating a gap's
pool concurrently and merging the results **in the original order** produces the
same ranking and the same track. The engine work is ~40% of the compile; even
modest fan-out takes the headline well below 8,000.

**Why it is not attempted here.** It is a re-architecture, not a speed refactor:
per-worker engine instances, replaying the track prefix to the parent version on
every sync, structured-clone of candidate geometry and results across threads,
and a deterministic merge — with the failure mode being *subtle* non-determinism
that the identity gates would catch only sometimes. It is days of work with a
real chance of ending in a revert, and it cannot be landed as one gated mechanism
in the style of the twenty-three attempts above. It needs to be a named project
with its own plan, not the next entry in this log.

So the honest statement of the ceiling is narrower than "unreachable": **<8,000 is
unreachable by making this sequential compiler cheaper, and plausibly reachable by
making it concurrent.**

### Parallel candidate evaluation is FEASIBLE — measured break-even (2026-07-26)

Before proposing the project, the thing that would kill it was measured: the cost
of standing a worker's engine up at a parent state, against the work it could
take off the main thread.

```
WebAssembly.Module compile   : 0.10 ms   (once per worker process)
WebAssembly.Instance create  : 0.04 ms   each
replay 33 lines into engine  : 0.06 ms
simulate prefix to frame 400 : 0.96 ms
-> per-sync cost             : ~1.02 ms
per-candidate engine work    : ~0.104 ms   (engine share / 2,692 arcs)
=> break-even                : ~10 candidates per sync
```

**A gap's pool is ~80 candidates** (2,692 arcs over ~33 gaps), which is 8x
break-even, so the class pays even with naive per-sync replay. Sync cost scales
with prefix length (~2.4 us/frame), so later gaps are more expensive; persistent
workers that advance with the search and sync only the delta avoid that entirely.

**Design, if it is taken up:**
1. A determinism harness FIRST — compile the same (spec, seed, budget) N times
   under fan-out and compare track/report/stats hashes. Nothing is trusted before
   this exists, because the failure mode is intermittent.
2. Batch at the **pool boundary**: a gap's candidate list is generated on the main
   thread, evaluated across workers, and merged **in the original index order** —
   ranking then sees exactly the sequence it sees today.
3. Persistent workers, each with its own engine instance, advancing along the
   search's accepted prefix so a sync is a delta, not a replay.
4. Gate exactly as here: `verify:optimizer`, `verify:compiler:behavior` at the
   three rungs, then `perf_ab`.

**Why it was not started in this session.** It is days of work whose failure mode
is *intermittent* non-determinism — the one thing the identity gates catch only
sometimes — and a half-landed worker pool is worse than none. It needs to be a
named project, which is what this entry makes it.

**Bottom line for the speed goal:** <8,000 is out of reach for the sequential
compiler (23 gated attempts, redundancy exhausted, engine closed on six probes),
and in reach for a concurrent one (engine is ~40% of the compile; break-even is
8x clear). The remaining question is not "is there speed left" but "should this
compiler be made concurrent", which is a project decision.

### Why the concurrent path is probably the WRONG thing to do (2026-07-26)

The mechanics are cheap — cheaper than expected:

```
worker startup (bare)                : 31.5 ms   (once, amortised over a process)
synchronous round-trip via Atomics   : 12.4 us
per-candidate engine work            : ~104 us
=> break-even                        : 1 candidate per handoff
```

A synchronous worker handoff costs 12% of a single candidate's work, and the
earlier probe put engine sync at ~1 ms against ~80-candidate pools. Fanned out,
the engine's ~40% of the compile would fall to roughly 10%, which lands the
headline near **6,600 ns/frame — comfortably under the 8,000 target.**

**And it would still be the wrong change**, because of what the compiler actually
runs as: `scripts/benchmark/cli.ts` defaults to
`--jobs=min(48, availableParallelism())`. **The benchmark already runs up to 48
compiles in parallel on this 64-core host.** Intra-compile workers would put
48 x N threads on 64 cores — oversubscription — so the throughput of
`npm run benchmark -- eval`, which is how this compiler is actually exercised,
would very likely get *worse* while `npm run perf` got better.

`npm run perf` measures **one compile's latency**. That is the right instrument
for "is this code cheaper", which is what every mechanism in this log was. It is
the wrong instrument for "should this compiler be concurrent", because the answer
there depends on a workload the metric does not contain.

So the conclusion is stronger than "not reached": **the remaining route to <8,000
optimises the measurement while likely degrading the thing the measurement stands
in for.** Recorded here rather than implemented, because that distinction is
exactly what this log exists to protect.

## Attempt 24 (2026-07-26) — build the fit-candidate ladder once per model, KEEP (-0.40%)

Mechanism kept: `fitArcVectorOutput` rebuilt its ladder of forms to try — an
array plus three or four capturing closures — on **every output**, though it
depends only on `spans` and `trainingKind`, both fixed for a model. That is ~21
outputs x ~2,692 models per compile, so roughly 200,000 closure allocations and
as many esbuild `__name` wrapper calls (`__name` measured at 1.10% of the
compile). Built once per model now; same forms, same order, same feature
functions.

- **Focused correctness:** 45/45 tests.
- **Identity gates:** `verify:optimizer` 4/4 byte-identical,
  `verify:compiler:behavior -- --budgets=100000,150000,200000` 36/36, and the new
  **`verify:determinism`** 3/3 identical compiles.
- **Full A/B gate:** base **9,723.2**, candidate **9,692.0 ns/frame**; delta
  median/mean **-0.40% / -0.31%**, 95% CI **[-0.62%, +0.05%]**, 67/100 rounds,
  `P(candidate faster)=95.7%`.

Verdict: kept — over the discovery bar, if barely. Small, but it is the eleventh
accepted mechanism and it came from the same question as the big ones: what is
being rebuilt that never changes?

### Standing after Attempt 24, and a note on reading standings

`npm run perf`: mean **9,605.7**, median **9,097.4**, stddev 890.9.

That reads *higher* than the 9,457.9 recorded two entries ago, after a kept
-0.40% mechanism. It is not a regression: a 50-rep `perf` run has sd ~890, so
SE ~126 and a 95% interval of roughly +-250 ns. **9,457.9 and 9,605.7 are the
same quantity measured twice.** This is exactly why the workflow decides on
paired `perf_ab` — which holds the machine, the process and the interleaving
constant — and treats a bare standing as informational. Anyone reading this log
for "the number" should read the A/B deltas, not the standings.

Session total: eleven accepted mechanisms, thirteen rejected or inconclusive,
from a 13,654.0 baseline — **about -30%**, byte-identical at every step.
