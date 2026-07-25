# Engine optimization log — L-1034200124

This log is for engine-speed work measured on host `L-1034200124`. Absolute
`ns/physics-frame` values are hardware- and load-sensitive, so do not compare
these standings directly to the older top-level `OPTIMIZATION_LOG.md` entries
from another machine. Use paired A/B on this host for keep/reject decisions.

Metric and gates follow `docs/engine-workflow.md`:

- Correctness: `npm run verify` before speed claims.
- Speed: `npm run perf` for the current standard Rust/WASM engine.
- Decision: paired `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100` (or
  `--js` only for WASM wrapper-boundary changes), keeping only
  correctness-green candidates accepted by the A/B gate.

## Baseline (2026-07-08) — current host standing

Repository state: `8308e06` (`engine-improvement`), clean worktree before local
log creation. Host: Linux x86_64, Node `v24.6.0` / V8 `13.6.233.10-node.24`.

- **Correctness:** `npm run verify` passed:
  - engine trace oracle: 5/5 byte-identical;
  - optimizer output hash: 4/4 byte-identical.
- **Perf:** `npm run perf`
  - mean **19,864.6 ns/physics-frame**
  - median **19,883.6 ns/physics-frame**
  - stddev **1,069.5**
  - frames **51,018**

Objective for this host after the scope discussion: improve the standard
Rust/WASM engine and its WASM wrapper boundary until `npm run perf` reports
**<12,500 ns/physics-frame mean**, without changing compiler behavior or
optimizer internals.

## Attempt 1 (2026-07-08) — unrolled body-average helper, REJECT

Mechanism tested: replace the small `BODY.iter()` accumulation loops in
`engine-rs/src/engine.rs` (`rider_into`, `raw_frame_into`, and
`candidate_window_into`) with one inlined helper that explicitly adds the same six
body entities in the same order. This targeted WASM read-window overhead without
changing physics, optimizer behavior, or ABI shape.

- **Correctness before A/B:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100`
  - base mean **17,850.8 ns/frame**
  - candidate mean **17,862.2 ns/frame**
  - delta median/mean **+0.05% / +0.08%**
  - 95% CI **[-0.26%, +0.33%]**
  - candidate won **49/100** rounds
  - `P(candidate faster)=31.1%`

Verdict: rejected. The candidate failed the probability gate and the median delta
was slightly slower. Source change was reverted and the standard WASM artifact was
rebuilt from the reverted source.

## Attempt 2 (2026-07-08) — direct contact-dedupe index loop, REJECT

Mechanism tested: in `engine-rs/src/engine.rs::candidate_window_into`, replace the
per-frame sled contact-line dedupe scan
`contacts.iter().take(contact_total).skip(contact_start)` with a direct
`for j in contact_start..contact_total` index loop. This targeted WASM iterator
code shape inside the compact candidate-window ABI while preserving the same f64
contact buffer, same line-id order, and same dedupe rule.

- **Correctness before A/B:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100`
  - base mean **18,087.6 ns/frame**
  - candidate mean **18,100.8 ns/frame**
  - delta median/mean **+0.06% / +0.09%**
  - 95% CI **[-0.20%, +0.36%]**
  - candidate won **48/100** rounds
  - `P(candidate faster)=26.9%`

Verdict: rejected. The candidate failed the probability gate and the median delta
was slightly slower. Source change was reverted and the standard WASM artifact was
rebuilt from the reverted source.

## Scope audit (2026-07-08) — current target is dominated by non-engine time

After reverting Attempt 2 and rebuilding the standard WASM artifact, profiled the
current end-to-end metric with:

```bash
node --cpu-prof --cpu-prof-dir=generated/prof \
  --cpu-prof-name=perf-L-1034200124-engine-scope.cpuprofile \
  --max-semi-space-size=64 --import tsx scripts/v0/bench/perf.ts --reps=5 --warmup=1
```

The short profiled run reported **15,412.8 ns/physics-frame mean** (median
**15,340.6**, frames **51,018**). CPU-profile self-time split:

- **Allowed engine/WASM surface:** **27.4%**
  - `wasm`: **26.8%**
  - `scripts/lib/_lr_engine_wasm.ts`: **0.6%**
- **Forbidden by `docs/engine-workflow.md`:** **60.8%**
  - `scripts/v0/optimizer/arc_model.ts`: **46.1%**
  - `scripts/v0/core/candidate.ts`: **6.5%**
  - `scripts/v0/core/measure.ts`: **2.0%**
  - `scripts/v0/optimizer/aim.ts`: **2.0%**
  - `scripts/v0/optimizer/handoff.ts`: **1.2%**
  - `scripts/v0/score.ts`: **1.2%**
  - other optimizer/core/detector pieces: remainder
- Other/native/runtime: **11.8%**

Current full standing after the reverted-source rebuild:

- `npm run perf` (50 runs + 3 warmup): mean **16,463.7 ns/physics-frame**,
  median **16,337.1**, stddev **978.4**, frames **51,018**.

Implication for the original `<10,000 ns/frame` end-to-end target under the
current engine-only scope: on the profiled run, eliminating the allowed
engine/WASM surface entirely would lower **15,412.8 → ~11,190 ns/frame**, still
above that target. Reaching `<10,000` from this workload cannot be proven
achievable by engine/WASM-wrapper edits alone unless a future profile shows a
much larger allowed engine share or a candidate changes the work distribution in
a way not visible in this self-time split.

## Attempt 3 (2026-07-08) — lazy collision-history construction, KEEP

Mechanism kept: `engine-rs/src/engine.rs` now computes public frames/events
without immediately filling the reverse invalidation indexes used by future line
edits. Most candidate branches are read and then discarded; only branches that
are later extended through `addLine` force `ensure_history()` to replay the
missing suffix with history tracking enabled. `removeLine` can still invalidate a
line collision without forcing full replay because it combines the tracked
collision index with a scan of already-computed public events.

This is engine-only: it changes the Rust/WASM cache bookkeeping and does not
touch optimizer, scorer, detector, compiler policy, specs, or baselines.

- **Correctness before A/B:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100`
  - base mean **17,703.2 ns/frame**
  - candidate mean **17,267.1 ns/frame**
  - delta median/mean **-2.47% / -2.46%**
  - 95% CI **[-2.64%, -2.25%]**
  - candidate won **100/100** rounds
  - `P(candidate faster)=100.0%`
- **Post-comment rebuild and gates:**
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
  - `npm run verify:optimizer:wide` passed: 12/12 wide cases byte-identical.
  - `npm run wasm:all` passed: all regression and Phase-2b gates green.
- **Current standing:** `npm run perf` (50 runs + 3 warmup): mean
  **15,765.6 ns/physics-frame**, median **15,886.6**, stddev **774.9**, frames
  **51,018**.

Verdict: kept. This improves the current-host standing from the last clean
full-perf reading **16,463.7 → 15,765.6 ns/frame** (about **-4.2%** by absolute
single-run standings, with paired A/B showing the reliable local candidate
effect). The `<12,500 ns/frame` objective remains open.

## Attempt 4 (2026-07-08) — candidate-window i32 contact buffer, REJECT

Mechanism tested: add a backward-compatible `contacts_ptr()` export and have
`get_candidate_window` write compact candidate-window contact line ids as `i32`
instead of `f64`, with the JS wrapper falling back to the old `Float64Array`
contact buffer when the base kernel lacks the export. The target was the
high-volume compact-window boundary: one `mini_burst@50k` compile observed
**11,236** candidate-window calls moving **231,594** contact ids.

Because Attempt 3 was not committed yet, this was measured with a temporary
artifact pair that isolated only the contact-buffer change:

- base artifact: lazy collision-history engine with the old `f64` contact buffer;
- candidate artifact: same engine plus the `i32` contact buffer/export;
- same working JS wrapper for both arms, using the fallback path for base and the
  `i32` path for candidate.

- **Correctness before signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, same command shape as
  `perf_ab` but using the temporary artifact pair above.
  - base mean **17,120.0 ns/frame**
  - candidate mean **17,094.0 ns/frame**
  - delta median/mean **-0.09% / -0.13%**
  - 95% CI **[-0.67%, +0.49%]**
  - candidate won **16/30** rounds
  - `P(candidate faster)=65.7%`

Verdict: rejected. The candidate did not approach the keep probability bar and
the CI crossed zero. Source changes were reverted and the standard WASM artifact
was rebuilt from the kept Attempt 3 source.

## Attempt 5 (2026-07-08) — JS wrapper cached last-frame index, REJECT

Mechanism tested: share a tiny lineage cache across forked WASM wrapper instances
so an immediate `getLastFrameIndex()` after a read can return the known
post-read index without another WASM boundary crossing. The target was the
metering surface: one `mini_burst@50k` compile observed about **30,316**
`getLastFrameIndex` wrapper calls.

The cache was conservative: it returned a cached value only when the wrapper knew
the shared cache was currently synced to that handle and the last frame index was
known; line additions invalidated the cached index.

- **Correctness before A/B:**
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
  - `npm run verify:optimizer:wide` passed: 12/12 wide cases byte-identical.
  - `npm run wasm:all` passed: all regression and Phase-2b gates green.
- **A/B signal:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4`
  - base mean **17,245.1 ns/frame**
  - candidate mean **17,307.7 ns/frame**
  - delta median/mean **+0.02% / +0.37%**
  - 95% CI **[-0.16%, +0.84%]**
  - candidate won **14/30** rounds
  - `P(candidate faster)=10.1%`

Verdict: rejected. The wrapper state/branch overhead outweighed the saved calls
on this workload. Source changes were reverted.

## Attempt 6 (2026-07-08) — targeted lazy-history replay for addLine, REJECT

Mechanism tested: after Attempt 3, `addLine` still forced the entire missing
history suffix to be replayed before scanning the new line's cells. This variant
scanned the already-built history prefix first, then replayed the lazy suffix only
until the new line's first collision was found, so an early truncation could avoid
replaying history that would be discarded.

Implementation was engine-only: a frame helper checked the just-appended center
cell frame for collision with the new line, and `addLine` used that during lazy
history replay. No optimizer, scorer, detector, spec, or baseline files were
changed.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 3 WASM artifact against the targeted-replay candidate artifact.
  - base mean **17,172.6 ns/frame**
  - candidate mean **17,194.8 ns/frame**
  - delta median/mean **-0.06% / +0.14%**
  - 95% CI **[-0.43%, +0.65%]**
  - candidate won **16/30** rounds
  - `P(candidate faster)=28.7%`

Verdict: rejected. The extra per-addLine collision checking did not pay for the
saved replay work on the target workload. Source changes were reverted and the
standard WASM artifact was rebuilt from the kept Attempt 3 source.

## Standing check after Attempts 4-6 (2026-07-08)

After reverting the rejected contact-buffer, cached-LFI, and targeted-replay
candidates, rebuilt the standard WASM artifact from the kept Attempt 3 source and
reran the current gates:

- `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
  output hash 4/4 byte-identical.
- `npm run perf` (50 runs + 3 warmup): mean **16,124.1 ns/physics-frame**,
  median **16,241.8**, stddev **808.0**, frames **51,018**.

The `<12,500 ns/frame` objective remains open.

## Attempt 7 (2026-07-08) — cached per-frame compact-window summaries, KEEP

Mechanism kept: cache per-frame read summaries in `engine-rs/src/engine.rs` when
a frame is computed: BODY average position/velocity, rider/sled bind state, sled
contact mask, and per-frame deduped sled contact line ids. `getCandidateWindow`
then copies those cached values instead of recomputing BODY averages and scanning
collision events on every repeated window read. `getRider` and `getRawFrame` also
reuse the cached body/bind summary.

This targets the read-heavy compact-window surface measured after Attempt 3:
one `mini_burst@50k` compile observed **11,236** candidate-window calls covering
**416,902** frame rows and moving **231,594** contact ids. The work moves from
repeated reads to once-per-computed-frame summary construction.

- **Correctness before A/B:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 3 WASM artifact against the summary-cache candidate artifact.
  - base mean **17,122.8 ns/frame**
  - candidate mean **16,998.7 ns/frame**
  - delta median/mean **-0.81% / -0.70%**
  - 95% CI **[-1.25%, -0.16%]**
  - candidate won **21/30** rounds
  - `P(candidate faster)=99.5%`
- **A/B full gate:** isolated paired run, 100 rounds × 8 reps, same artifact pair.
  - base mean **17,221.9 ns/frame**
  - candidate mean **17,073.2 ns/frame**
  - delta median/mean **-0.92% / -0.85%**
  - 95% CI **[-1.14%, -0.60%]**
  - candidate won **75/100** rounds
  - `P(candidate faster)=100.0%`
- **Post-A/B gates:**
  - `npm run verify:optimizer:wide` passed: 12/12 wide cases byte-identical.
  - `npm run wasm:all` passed: all regression and Phase-2b gates green.
- **Current standing:** `npm run perf` (50 runs + 3 warmup): mean
  **16,874.8 ns/physics-frame**, median **16,670.5**, stddev **654.5**, frames
  **51,018**. This single absolute run was slower/noisier than the prior standing;
  paired A/B is the keep evidence.

Verdict: kept. The `<12,500 ns/frame` objective remains open.

## Attempt 8 (2026-07-08) — batched addLine WASM boundary, REJECT

Mechanism tested: the compiler calls wrapper `addLine` with arrays for almost
every arc, and the wrapper expanded those arrays into one WASM `add_line` call per
line. A one-compile probe after Attempt 7 observed **2,844** wrapper `addLine`
calls expanding to **14,895** individual line additions, i.e. about **12,051**
extra WASM boundary crossings.

Candidate: add an engine ABI batch buffer/export (`add_lines_in_ptr`,
`add_lines`) and have the WASM wrapper write array line data once, then call the
batch export. The Rust side mirrored the old loop and freed transient
intermediate handles, preserving version-tree semantics. The wrapper kept the old
per-line loop as a fallback.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4`
  with the candidate WASM shared by both arms.
  - base mean **17,145.9 ns/frame**
  - candidate mean **17,142.9 ns/frame**
  - delta median/mean **-0.15% / -0.00%**
  - 95% CI **[-0.47%, +0.47%]**
  - candidate won **16/30** rounds
  - `P(candidate faster)=49.0%`

Verdict: rejected. Filling the batch input buffer and running the internal loop
did not produce a measurable win over the existing boundary calls. Source changes
were reverted and the standard WASM artifact was rebuilt from the kept Attempt 7
source.

## Attempt 9 (2026-07-08) — 128-slot line-cell cache, REJECT

Mechanism tested: increase the per-frame direct-mapped `LineCellCache` in
`engine-rs/src/kernel.rs` from 64 to 128 slots. The target was the remaining
physics-step WASM hotspot: fewer direct-map collisions could reduce repeated
grid map lookups during collision checks.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the 128-slot candidate artifact.
  - base mean **17,168.6 ns/frame**
  - candidate mean **17,160.4 ns/frame**
  - delta median/mean **+0.02% / -0.03%**
  - 95% CI **[-0.46%, +0.43%]**
  - candidate won **14/30** rounds
  - `P(candidate faster)=54.0%`

Verdict: rejected. The larger cache was a wash and failed the median/probability
keep gates. Source change was reverted and the standard WASM artifact was rebuilt
from the kept Attempt 7 source.

## Attempt 10 (2026-07-08) — redo version ids instead of cloned Lines, REJECT

Mechanism tested: avoid cloning full `Line` records while `update_computed`
collects target-side redo operations. The candidate changed the redo scratch from
`Vec<Line>` to version ids and made line registration borrow a `Line`, so replay
could read the `Line` directly from the version patch instead of cloning it into
the scratch buffer first.

- **Correctness before A/B:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the redo-id candidate artifact.
  - base mean **17,019.8 ns/frame**
  - candidate mean **16,948.4 ns/frame**
  - delta median/mean **-0.54% / -0.40%**
  - 95% CI **[-0.84%, +0.05%]**
  - candidate won **20/30** rounds
  - `P(candidate faster)=96.0%`
- **A/B full gate:** isolated paired run, 100 rounds × 8 reps, same artifact pair.
  - base mean **17,118.9 ns/frame**
  - candidate mean **17,155.6 ns/frame**
  - delta median/mean **+0.07% / +0.23%**
  - 95% CI **[-0.14%, +0.66%]**
  - candidate won **49/100** rounds
  - `P(candidate faster)=9.6%`

Verdict: rejected. The short signal did not reproduce; the full gate was slightly
slower and failed both keep conditions. Source changes were reverted and the
standard WASM artifact was rebuilt from the kept Attempt 7 source.

## Attempt 11 (2026-07-08) — put GridLine.line first, REJECT

Mechanism tested: reorder `GridLine` fields so the hot collision loop reads the
embedded `Line` at offset zero. `group` is needed only for insertion/removal
ordering, while physics stepping uses only `entry.line`.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the field-order candidate artifact.
  - base mean **17,299.9 ns/frame**
  - candidate mean **17,241.4 ns/frame**
  - delta median/mean **-0.25% / -0.32%**
  - 95% CI **[-0.91%, +0.24%]**
  - candidate won **16/30** rounds
  - `P(candidate faster)=86.0%`

Verdict: rejected. The candidate did not meet the probability gate and the CI
crossed zero. Source change was reverted and the standard WASM artifact was
rebuilt from the kept Attempt 7 source.

## Attempt 12 (2026-07-08) — borrowed candidate-window contact ids, REJECT

Mechanism tested: add a fallback-compatible candidate-window ABI variant that
writes the same compact f64 frame rows but leaves sled contact line ids in the
engine's cached per-frame contact vector. The WASM wrapper used the borrowed
contact-id view when the new exports were present and fell back to the old
`EVENTS` copy path for older kernels. The target was the repeated compact-window
contact copy: one `mini_burst@50k` compile moves about **231,594** contact ids
through `getCandidateWindow`.

The change was engine/WASM-wrapper only and did not touch optimizer, scorer,
detector, specs, or baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the borrowed-contact candidate artifact with
  the same fallback-capable JS wrapper.
  - base mean **17,190.6 ns/frame**
  - candidate mean **17,247.6 ns/frame**
  - delta median/mean **+0.42% / +0.36%**
  - 95% CI **[-0.47%, +1.13%]**
  - candidate won **12/30** rounds
  - `P(candidate faster)=17.4%`
- **Post-revert gates:**
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.

Verdict: rejected. Creating and routing the borrowed contact view was slower than
copying the compact contact slice on this workload. Source changes were reverted
and the standard WASM artifact was rebuilt from the kept Attempt 7 source. The
`<12,500 ns/frame` objective remains open.

## Attempt 13 (2026-07-08) — packed internal cell key, REJECT

Mechanism tested: replace the internal Rust grid cell key on hot lookup paths with
a packed `(cx, cy)` coordinate key, while preserving `classicCells` order and line
bucket ordering. The exact lr-core Szudzik cell id is not externally observable in
the Rust engine, so this targeted the repeated `cell_hash` work in physics
collision lookup and history-grid lookup.

The line-cell and active-history direct caches were adjusted to fold both packed
coordinates into their slot calculation. This was engine-only and did not touch
optimizer, scorer, detector, specs, or baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the packed-cell-key candidate artifact.
  - base mean **17,152.3 ns/frame**
  - candidate mean **17,285.3 ns/frame**
  - delta median/mean **+0.73% / +0.81%**
  - 95% CI **[+0.12%, +1.57%]**
  - candidate won **11/30** rounds
  - `P(candidate faster)=0.8%`
- **Post-revert gates:**
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.

Verdict: rejected. The cheaper key construction did not pay for the changed cache
and map behavior; the candidate was a likely regression. Source changes were
reverted and the standard WASM artifact was rebuilt from the kept Attempt 7 source.
The `<12,500 ns/frame` objective remains open.

## Attempt 14 (2026-07-08) — lazy getRider sled-point payload, REJECT

Mechanism tested: split the WASM `get_rider` payload into a hot summary export
and a lazy point export. The JS wrapper used the new summary-only path for
`getRider(frame)` when available, then fetched PEG/TAIL/NOSE/STRING point slots
only if the returned rider object's `.get(point_id)` was actually called. The
old `get_rider` export remained backward-compatible, so the same wrapper could
compare the saved Attempt 7 artifact against the candidate artifact.

The target was the measured `getRider` read surface after Attempt 7: one
`mini_burst@50k` compile observed **3,724** `getRider` calls but only **1,832**
sled-point `.get(id)` reads, so most calls appeared to need only body
position/velocity and bind states.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the lazy-rider-points candidate artifact.
  - base mean **17,262.5 ns/frame**
  - candidate mean **17,294.6 ns/frame**
  - delta median/mean **-0.16% / +0.22%**
  - 95% CI **[-0.47%, +1.00%]**
  - candidate won **16/30** rounds
  - corrected bootstrap `P(candidate faster)=27.5%`

Verdict: rejected. The extra split-export branch and occasional second WASM call
did not pay for the smaller hot `getRider` payload on this workload. Source
changes were reverted and the standard WASM artifact was restored to the saved
kept Attempt 7 snapshot. The `<12,500 ns/frame` objective remains open.

## Attempt 15 (2026-07-08) — slim cached frame state without stored velocities, REJECT

Mechanism tested: reduce the per-frame cache copy size in `Cache::compute_to` by
storing only `px/py/prevx/prevy/fsu` in cached frames instead of full `State`
including `vx/vy`. The live stepping state still kept full `State`; historical
public velocities were reconstructed at read boundaries from the previous cached
frame, matching `step_state`'s velocity calculation. Frame 0 needed the original
start velocity scalars to preserve exact bits.

The target was the remaining WASM profile shape after Attempt 7, where the hot
`compute_to` function showed large state copies into and out of the frame cache.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the slim-frame candidate artifact.
  - base mean **17,141.5 ns/frame**
  - candidate mean **17,160.2 ns/frame**
  - delta median/mean **+0.31% / +0.13%**
  - 95% CI **[-0.52%, +0.82%]**
  - candidate won **14/30** rounds
  - `P(candidate faster)=33.8%`

Verdict: rejected. Shrinking cached frame copies did not overcome the added
reconstruction/code-shape costs on the target workload. Source changes were
reverted and the standard WASM artifact was restored to the saved kept Attempt 7
snapshot. The `<12,500 ns/frame` objective remains open.

## Attempt 16 (2026-07-08) — gate history active-cache reset for TRACK=false, REJECT

Mechanism tested: in `step_state<const TRACK>`, run
`active_cells.begin_frame()` only when `TRACK=true`. Forward reads after Attempt 3
call `step_state::<false>` and never write collision-history cells, so resetting
the history active-cell cache for those frames looked like removable work inside
the dominant WASM `step_state::<false>` function. The normal line-cell cache
reset remained unconditional because forward simulation uses it for line lookup.

This was engine-only and did not touch optimizer, scorer, detector, specs, or
baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the active-cache-gate candidate artifact.
  - base mean **17,131.0 ns/frame**
  - candidate mean **17,182.8 ns/frame**
  - delta median/mean **-0.03% / +0.31%**
  - 95% CI **[-0.35%, +1.00%]**
  - candidate won **15/30** rounds
  - `P(candidate faster)=18.7%`

Verdict: rejected. Removing the unused reset from the false-tracking monomorph
did not translate into a speed win, likely due to code-layout/noise offsetting the
tiny saved work. Source change was reverted and the standard WASM artifact was
restored to the saved kept Attempt 7 snapshot. The `<12,500 ns/frame` objective
remains open.

## Attempt 17 (2026-07-08) — split step loop into bindings then points, REJECT

Mechanism tested: replace the top-of-frame `for i in 0..NENT` step loop's static
`IS_POINT[i]` branch with two straight loops: update binding counters for entity
indices `0..2`, then integrate point entities `2..NENT`. This preserves the
original entity order because indices 0 and 1 are the two bindings and all
remaining entities are points, while removing a data-table branch from every
`step_state` call.

This was engine-only and did not touch optimizer, scorer, detector, specs, or
baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the split-step-loop candidate artifact.
  - base mean **16,988.0 ns/frame**
  - candidate mean **17,023.5 ns/frame**
  - delta median/mean **+0.28% / +0.23%**
  - 95% CI **[-0.58%, +1.02%]**
  - candidate won **12/30** rounds
  - `P(candidate faster)=25.3%`

Verdict: rejected. The split loop changed code shape in the dominant
`step_state` function but did not improve the target workload. Source change was
reverted and the standard WASM artifact was restored to the saved kept Attempt 7
snapshot. The `<12,500 ns/frame` objective remains open.

## Attempt 18 (2026-07-08) — reserve per-lineage cache vectors, REJECT

Mechanism tested: preallocate the main per-lineage cache vectors around observed
target-workload sizes: frame cache/summaries/event offsets for the candidate
window's ~221-frame maximum, collision events/contact ids for compact read
payloads, and lineage version ids for the many forked candidate branches. This
aimed to remove repeated `Vec` growth work while preserving the exact shared-cache
semantics.

This was engine-only and did not touch optimizer, scorer, detector, specs, or
baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the cache-reserve candidate artifact.
  - base mean **17,000.2 ns/frame**
  - candidate mean **16,939.9 ns/frame**
  - delta median/mean **-0.25% / -0.33%**
  - 95% CI **[-0.97%, +0.35%]**
  - candidate won **16/30** rounds
  - `P(candidate faster)=80.8%`

Verdict: rejected. The mean moved slightly in the right direction, but the
confidence interval crossed zero and the corrected probability was below the
keep threshold. Source change was reverted and the standard WASM artifact was
restored to the saved kept Attempt 7 snapshot. The `<12,500 ns/frame` objective
remains open.

Current accepted standing after restoring the Attempt 7 artifact:

- `npm run perf` (50 runs + 3 warmup): mean **15,657.3 ns/physics-frame**,
  median **15,603.4**, stddev **787.0**, frames **51,018**.

## Attempt 19 (2026-07-08) — dedicated public step_state entry point, REJECT

Mechanism tested: split the hot no-history forward simulation from the
history-tracking replay path. The public path used a dedicated `step_state_public`
with no history-grid/collision-index arguments and no tracking branches; lazy
history replay used a separate tracked function. This targeted the dominant
`step_state::<false>` WASM surface after Attempt 7 while preserving the same
physics arithmetic and collision-event output.

This was engine-only and did not touch optimizer, scorer, detector, specs, or
baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the public-step candidate artifact.
  - base mean **16,867.0 ns/frame**
  - candidate mean **16,888.5 ns/frame**
  - delta median/mean **-0.16% / +0.19%**
  - 95% CI **[-0.65%, +1.08%]**
  - candidate won **17/30** rounds
  - `P(candidate faster)=35.6%`

Verdict: rejected. The typical round was barely faster, but the mean moved slower
and the confidence interval crossed zero; the split also increased code size/shape
enough to erase any argument-removal benefit. Source changes were reverted and the
standard WASM artifact was restored to the saved kept Attempt 7 snapshot. The
`<12,500 ns/frame` objective remains open.

## Attempt 20 (2026-07-08) — lazy line-position predicate in collision loop, REJECT

Mechanism tested: in the hot collision predicate, delay computing
`line_pos = dot(line_vec, point_offset) * inv_len_sq` until after the direction
and perpendicular-force gates pass. For non-colliding line checks that fail those
earlier gates, this would skip one dot product and multiply while computing the
same `line_pos` value before any collision response that needs it.

This was engine-only and did not touch optimizer, scorer, detector, specs, or
baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the lazy-line-position candidate artifact.
  - base mean **16,829.4 ns/frame**
  - candidate mean **16,970.1 ns/frame**
  - delta median/mean **+1.06% / +0.86%**
  - 95% CI **[+0.05%, +1.68%]**
  - candidate won **10/30** rounds
  - `P(candidate faster)=2.1%`

Verdict: rejected. Short-circuiting the predicate changed the hot code shape into
a measurable regression on this target workload. Source change was reverted and
the standard WASM artifact was restored to the saved kept Attempt 7 snapshot. The
`<12,500 ns/frame` objective remains open.

## Attempt 21 (2026-07-08) — cheaper direct-map slot hash for line-cell cache, REJECT

Mechanism tested: replace the `LineCellCache` direct-map slot function's
golden-ratio multiply with a cheaper xor/shift fold. The line-cell cache is only a
per-frame lookup accelerator; a miss falls back to the same grid map, so this
cannot affect correctness. The intended win was lower per-collision-lookup hash
cost if the simpler fold did not materially increase cache conflicts.

This was engine-only and did not touch optimizer, scorer, detector, specs, or
baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the simplified-slot-hash candidate artifact.
  - base mean **16,978.0 ns/frame**
  - candidate mean **17,039.5 ns/frame**
  - delta median/mean **+0.31% / +0.38%**
  - 95% CI **[-0.30%, +1.10%]**
  - candidate won **11/30** rounds
  - `P(candidate faster)=12.7%`

Verdict: rejected. The cheaper hash did not offset its worse cache distribution
and/or code shape on the target workload. Source change was reverted and the
standard WASM artifact was restored to the saved kept Attempt 7 snapshot. The
`<12,500 ns/frame` objective remains open.

## Attempt 22 (2026-07-09) — wrapper cache for same-frame sled point reads, REJECT

Mechanism tested: cache the sled-point position scalars copied by
`getRider(frame)` on the immutable JS wrapper instance, and let
`getSledPointPositionsAtFrame(frame)` reuse them when it is called for the same
frame. This targeted a wrapper-boundary pattern where scoring code reads the
rider summary and then asks for sled pose on the same engine/frame; a hit avoids
one `get_rider` WASM call and scratch-buffer read.

This was within the allowed WASM wrapper boundary and did not touch optimizer,
scorer, detector, specs, or baselines.

- **Correctness before A/B signal:**
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B signal:** paired JS-wrapper run,
  `npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=30 --reps=4 --warmup=1`,
  sharing the accepted Attempt 7 WASM artifact and swapping only
  `scripts/lib/_lr_engine_wasm.ts`.
  - base mean **16,877.3 ns/frame**
  - candidate mean **16,902.4 ns/frame**
  - delta median/mean **+0.18% / +0.18%**
  - 95% CI **[-0.54%, +0.90%]**
  - candidate won **14/30** rounds
  - `P(candidate faster)=30.4%`

Verdict: rejected. The cache did not produce enough same-frame hits to overcome
the added wrapper object fields and branch/code shape. Source change was reverted;
the accepted Attempt 7 WASM artifact remained in place. The `<12,500 ns/frame`
objective remains open.

## Scope profile refresh (2026-07-09) — accepted Attempt 7 state

Profiled the current accepted state with:

```bash
node --cpu-prof --cpu-prof-dir=generated/prof \
  --cpu-prof-name=perf-L-1034200124-20260709.cpuprofile \
  --max-semi-space-size=64 --import tsx scripts/v0/bench/perf.ts --reps=5 --warmup=1
```

The short profiled run reported **15,033.4 ns/physics-frame mean** (median
**14,990.7**, frames **51,018**). CPU-profile self-time split:

- **Allowed engine/WASM surface:** **26.6%**
  - `wasm`: **25.95%**
  - `scripts/lib/_lr_engine_wasm.ts`: **0.61%**
- **Forbidden by `docs/engine-workflow.md`:** **62.7%**
  - `scripts/v0/optimizer/arc_model.ts`: **47.18%**
  - `scripts/v0/core/candidate.ts`: **7.04%**
  - `scripts/v0/core/measure.ts`: **2.42%**
  - `scripts/v0/optimizer/aim.ts`: **1.48%**
  - `scripts/v0/optimizer/handoff.ts`: **1.33%**
  - `scripts/v0/score.ts`: **1.09%**
  - other optimizer/core/detector pieces: remainder
- Other/native/runtime: **10.7%**

Implication: wrapper-only changes have a very small ceiling on the current
headline metric. The remaining plausible engine-only path is still Rust/WASM work
inside the dominant `wasm-function[30]`/`step_state::<false>` surface; the
`<12,500 ns/frame` objective remains theoretically reachable only if a large
fraction of that allowed WASM cost is removed.

## Attempt 23 (2026-07-09) — iterate collidable point range directly, REJECT

Mechanism tested: replace the hot collision loop's static table iteration
`for &i in COLLIDABLES.iter()` with the equivalent contiguous range `for i in
PEG..NENT`, because the collidable points are exactly entity indices 2 through 11
in the same order. This targeted `step_state::<false>` by removing a repeated
static-array load in the 6×10 collision-check loop while preserving point order.

This was engine-only and did not touch optimizer, scorer, detector, specs, or
baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B screen:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the collidable-range candidate artifact.
  - base mean **16,951.3 ns/frame**
  - candidate mean **16,868.0 ns/frame**
  - delta median/mean **-0.64% / -0.45%**
  - 95% CI **[-1.18%, +0.29%]**
  - candidate won **16/30** rounds
  - `P(candidate faster)=86.9%`
- **Full A/B gate:** isolated paired run, 100 rounds × 4 reps, same artifacts.
  - base mean **17,268.2 ns/frame**
  - candidate mean **17,237.7 ns/frame**
  - delta median/mean **-0.38% / -0.16%**
  - 95% CI **[-0.53%, +0.21%]**
  - candidate won **59/100** rounds
  - `P(candidate faster)=77.1%`

Verdict: rejected. The 30-round screen was promising, but the required full gate
did not clear the probability threshold and the confidence interval crossed zero.
Source change was reverted and the standard WASM artifact was restored to the
saved kept Attempt 7 snapshot. The `<12,500 ns/frame` objective remains open.

## Attempt 24 (2026-07-09) — monomorphize collision point loop, KEEP

Mechanism kept: replace the hot `for &i in COLLIDABLES.iter()` collision loop with
an inlined `collide_point<const I, const TRACK>` helper called once for each
collidable point in the exact original order. The point index and friction are now
compile-time constants at each call site, removing the repeated collidable-index
and `FRIC[i]` table loads in the 6×10 collision-check loop. Collision order,
arithmetic order, event order, and history recording semantics are unchanged.

This is engine-only: it changes Rust/WASM kernel code and removes now-dead
`FRIC`/`COLLIDABLES` constants, without touching optimizer, scorer, detector,
specs, or baselines.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B screen:** isolated paired run, 30 rounds × 4 reps, comparing the saved
  Attempt 7 WASM artifact against the collision-point-monomorph candidate
  artifact.
  - base mean **16,905.4 ns/frame**
  - candidate mean **16,844.3 ns/frame**
  - delta median/mean **-0.44% / -0.34%**
  - 95% CI **[-0.89%, +0.17%]**
  - candidate won **16/30** rounds
  - `P(candidate faster)=91.1%`
- **Full A/B gate:** isolated paired run, 100 rounds × 4 reps, same artifacts.
  - base mean **17,299.1 ns/frame**
  - candidate mean **17,183.1 ns/frame**
  - delta median/mean **-0.82% / -0.65%**
  - 95% CI **[-0.98%, -0.30%]**
  - candidate won **67/100** rounds
  - `P(candidate faster)=100.0%`
- **Wider gates after acceptance:**
  - `npm run verify:optimizer:wide` passed: 12/12 compiler-output hashes
    byte-identical.
  - `npm run wasm:all` passed: kernel, stateful engine, trace, numeric diff,
    forking/budget, compile-hash, replay, and low-level bench checks green.

Verdict: kept. The full gate cleared the probability and median-delta thresholds,
and the confidence interval stayed below zero. After `wasm:all`, the measured
source-triggered candidate artifact was restored because repeated `wasm-opt` can
rewrite already-optimized bytes without representing a source change. Accepted
artifact hash: `6a85083044f906e5417a8cfdf546797f`.

Current accepted standing after restoring the measured Attempt 24 artifact:

- `npm run perf` (50 runs + 3 warmup): mean **15,707.9 ns/physics-frame**,
  median **15,528.7**, stddev **658.8**, frames **51,018**.

The `<12,500 ns/frame` objective remains open.

## Attempt 25 (2026-07-09) — const-bit friction parameter, REJECT

Mechanism tested: encode each collision point's friction as a `u64` const generic
inside `collide_point` instead of passing `fric: f64` as a runtime helper
argument. The goal was to make the hot `step_state::<false>` collision monomorphs
carry the exact same f64 friction constants with less argument/constant plumbing.
The arithmetic expression itself was unchanged (`f64::from_bits` reconstructed
the original `0.0`, `0.1`, and `0.8` values), and collision order/event semantics
were unchanged.

This was engine-only: it touched only `engine-rs/src/kernel.rs` and did not change
optimizer, scorer, detector, specs, baselines, or compiler policy code.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=30`
  - base artifact `6a85083044f9`
  - candidate artifact `373e11bc3b28`
  - base mean **16,520.2 ns/frame**
  - candidate mean **16,537.0 ns/frame**
  - delta median/mean **+0.38% / +0.12%**
  - 95% CI **[-0.38%, +0.61%]**
  - candidate won **14/30** rounds
  - `P(candidate faster)=29.3%`

Verdict: rejected. The candidate moved both median and mean slower and did not
justify a full 100-round gate. Source change was reverted and the accepted
Attempt 24 WASM artifact (`6a85083044f906e5417a8cfdf546797f`) was restored to both
standard artifact paths. The `<12,500 ns/frame` objective remains open.

## Attempt 26 (2026-07-09) — pre-cast compact summary fields, REJECT

Mechanism tested: store `FrameSummary`'s rider bind state, sled bind state, and
sled contact mask as f64 values when each frame is first summarized, instead of
storing them as integer fields and casting them back to f64 on every
`getCandidateWindow`, `getRider`, and `getRawFrame` read. The goal was to move
repeated compact-window read casts out of the hot read path and into the
once-per-computed-frame summary construction.

This was engine-only: it touched only `engine-rs/src/engine.rs` and did not
change optimizer, scorer, detector, specs, baselines, wrapper behavior, ABI shape,
or compiler policy code.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=30`
  - base artifact `6a85083044f9`
  - candidate artifact `10ea3a6318d9`
  - base mean **16,584.6 ns/frame**
  - candidate mean **16,516.0 ns/frame**
  - delta median/mean **-0.41% / -0.40%**
  - 95% CI **[-0.94%, +0.17%]**
  - candidate won **17/30** rounds
  - `P(candidate faster)=91.2%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100`
  - base artifact `6a85083044f9`
  - candidate artifact `10ea3a6318d9`
  - base mean **16,816.6 ns/frame**
  - candidate mean **16,822.3 ns/frame**
  - delta median/mean **-0.07% / +0.05%**
  - 95% CI **[-0.30%, +0.34%]**
  - candidate won **52/100** rounds
  - `P(candidate faster)=42.8%`

Verdict: rejected. The 30-round screen was promising, but the required 100-round
gate did not hold: mean regressed, the confidence interval crossed zero, and the
probability gate failed. Source change was reverted and the accepted Attempt 24
WASM artifact (`6a85083044f906e5417a8cfdf546797f`) was restored to both standard
artifact paths. The `<12,500 ns/frame` objective remains open.

## Profile refresh (2026-07-09) — after Attempt 24 plus rejected Attempts 25-26

Profiled the restored accepted engine state with:

```bash
node --cpu-prof --cpu-prof-dir=generated/prof \
  --cpu-prof-name=perf-L-1034200124-after-attempt26.cpuprofile \
  --max-semi-space-size=64 --import tsx scripts/v0/bench/perf.ts --reps=5 --warmup=1
```

The short profiled run reported **14,884.5 ns/physics-frame mean** (median
**14,966.0**, frames **51,018**). CPU-profile self-time split:

- **Allowed engine/WASM surface:** **26.3%**
  - `wasm`: **25.82%**
  - `scripts/lib/_lr_engine_wasm.ts`: **0.47%**
- **Forbidden by `docs/engine-workflow.md`:** **63.0%**
  - optimizer/core/scorer/detector paths dominated by `arc_model.ts`,
    `candidate.ts`, `measure.ts`, `aim.ts`, and related handoff code
- Other/native/runtime: **10.8%**

The top allowed node was `wasm-function[31]`, mapped by `wasm-dis` to the large
7-argument internal solver helper matching the current `step_state` kernel
shape. Smaller sampled WASM helpers included function ids 28, 25, and 22. The
wrapper-only ceiling remains very small; remaining engine-only attempts should
target the Rust/WASM kernel or cache behavior.

## Attempt 27 (2026-07-09) — persist line-cell cache across frames, REJECT

Mechanism tested: stop flushing `LineCellCache` at the start of every
`step_state` call, keeping center-cell lookup entries across consecutive simulated
frames while the line grid is unchanged. To keep pointers valid when the grid is
mutated, the candidate invalidated `LineCellCache` after `add_line` pushes new
grid buckets and after `remove_line` removes buckets. The intended win was fewer
`FlatIntMap` lookups for rider points that revisit the same grid cells across
adjacent frames, plus removing the per-frame line-cache epoch bump.

This was engine-only: it touched only `engine-rs/src/kernel.rs` and
`engine-rs/src/engine.rs`, without changing optimizer, scorer, detector, specs,
baselines, wrapper behavior, ABI shape, or compiler policy code.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=30`
  - base artifact `6a85083044f9`
  - candidate artifact `f189657784b1`
  - base mean **16,537.2 ns/frame**
  - candidate mean **16,501.5 ns/frame**
  - delta median/mean **-0.48% / -0.20%**
  - 95% CI **[-0.65%, +0.28%]**
  - candidate won **20/30** rounds
  - `P(candidate faster)=80.0%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100`
  - base artifact `6a85083044f9`
  - candidate artifact `f189657784b1`
  - base mean **16,777.3 ns/frame**
  - candidate mean **16,751.6 ns/frame**
  - delta median/mean **-0.36% / -0.14%**
  - 95% CI **[-0.48%, +0.21%]**
  - candidate won **58/100** rounds
  - `P(candidate faster)=80.9%`

Verdict: rejected. The full gate showed a small favorable median/mean, but the
confidence interval crossed zero and the probability gate failed. Source change
was reverted and the accepted Attempt 24 WASM artifact
(`6a85083044f906e5417a8cfdf546797f`) was restored to both standard artifact
paths. The `<12,500 ns/frame` objective remains open.

## Attempt 28 (2026-07-09) — specialize zero-friction collision response, KEEP

Mechanism kept: specialize the hot collision helper for the five collidable points
whose friction is exactly `0.0` (`TAIL`, `NOSE`, `STRING`, `LFOOT`, `RFOOT`).
For those point monomorphs, the candidate skips the friction-vector construction,
sign flip, and add-back math and directly carries `prevx/prevy` into the optional
acceleration-line adjustment. The nonzero-friction point monomorphs keep the
original operation order. This targets the dominant `step_state` kernel surface:
half of the per-iteration collidable point calls no longer execute friction math
whose mathematical value is zero.

The only semantic risk is signed-zero behavior in the skipped zero-friction
floating-point operations. The engine trace oracle, optimizer hashes, wide
optimizer hashes, and replay-sensitive WASM gates all remained byte-identical on
the exercised corpus.

This is engine-only: it changes only `engine-rs/src/kernel.rs`, without touching
optimizer, scorer, detector, specs, baselines, wrapper behavior, ABI shape, or
compiler policy code.

- **Correctness before A/B signal:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` passed (5/5).
  - `npm run build:wasm` passed.
  - `npm run verify` passed: engine trace oracle 5/5 byte-identical and optimizer
    output hash 4/4 byte-identical.
- **A/B screen:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=30`
  - base artifact `6a85083044f9`
  - candidate artifact `c056beca785c`
  - base mean **16,622.5 ns/frame**
  - candidate mean **16,513.5 ns/frame**
  - delta median/mean **-0.61% / -0.64%**
  - 95% CI **[-1.24%, -0.09%]**
  - candidate won **19/30** rounds
  - `P(candidate faster)=98.8%`
- **Full A/B gate:** `npx tsx scripts/v0/bench/perf_ab.ts --rounds=100`
  - base artifact `6a85083044f9`
  - candidate artifact `c056beca785c`
  - base mean **16,806.4 ns/frame**
  - candidate mean **16,743.4 ns/frame**
  - delta median/mean **-0.30% / -0.37%**
  - 95% CI **[-0.63%, -0.12%]**
  - candidate won **59/100** rounds
  - `P(candidate faster)=99.4%`
- **Wider gates after acceptance:**
  - `npm run verify:optimizer:wide` passed: 12/12 compiler-output hashes
    byte-identical.
  - `npm run wasm:all` passed: kernel, stateful engine, trace, numeric diff,
    forking/budget, compile-hash, replay, and low-level bench checks green.

Verdict: kept. The full gate cleared the probability and median-delta thresholds,
and the confidence interval stayed below zero. After `wasm:all`, the measured
source-triggered candidate artifact was restored because repeated `wasm-opt`
rewrote the artifact to `e36e65f2aa42e4a73bca30c0e9f6fb9f` without representing a
source change. Accepted artifact hash: `c056beca785c2607b874ef6008cc10a0`.

Current accepted standing after restoring the measured Attempt 28 artifact:

- `npm run perf` (50 runs + 3 warmup): mean **15,992.4 ns/physics-frame**,
  median **15,783.4**, stddev **645.2**, frames **51,018**.

The `<12,500 ns/frame` objective remains open.
