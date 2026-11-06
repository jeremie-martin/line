# Working rules

These rules replace the earlier campaign workflow. They exist so that every
result in this repository can be trusted, compared and reproduced.

## Every change is one of two kinds

**Structural** means refactoring, deleting, moving, tooling or performance work
that must not change what the compiler produces.

- Gate: `npm run parity` (63 cells byte-identical) and `npm run parity:judge`.
- Also: `npm test`, `npm run typecheck` (the count must not rise) and
  `npm run reach` (zero unreachable code).
- `npm run check` combines these gates with native Rust tests and
  `npm run verify:engine`. Rebuild with `npm run build:native` first when editing
  the packaged backend; stale source manifests fail the tests.
- A structural commit that changes any track hash is a bug.

**Behavioural** means anything that changes tracks.

1. State the hypothesis and the measure **before** running it.
2. Compare paired, song by song, against the current default.
3. Require the complete declared panel and identical resolved inputs before
   paired comparisons. Report completion separately from quality, with an interval over songs
   (dev, confirm) or per-spec seed sign counts (stratified panels), not a point
   estimate over seeds that reproduce the same track.
4. Report the result under **every** ruler, not only the one optimized, so
   self-grading is visible. Disclose any ruler the change makes worse.
5. If accepted, update the parity references in the same commit with
   `npm run parity -- --update` and say why they changed.

## Panels

- `npm run eval -- --panel=bench` is the stratified dev panel; `bench-confirm`
  re-runs it at fresh seeds; `bench-pairs8` re-runs the P1 and P2 specs at
  8 seeds before any completion claim. `dev` and `confirm` stay runnable for
  history. `npm run eval -- --name=X` with no `--panel` still runs `dev`.
- To compare a change: `npm run compare -- run --reference=main
  --candidate=<branch> --panel=v7` (`docs/benchmark.md`). Stop it once the
  evidence reads clearly; the same command resumes. Agents run it as a
  tracked background task.
- Bench specs are variants named `bench-<pattern>.ts` with a `bench` export
  (see ARCHITECTURE.md). Adding one changes the panel: compare only runs with
  identical resolved inputs (the report refuses otherwise).
- `--panel=sealed --sealed` only to confirm an adopted candidate.
  `--panel=heldout --heldout` only at decision points; the held-out songs
  never inform a compiler decision, and their results are not tuned on.
- A bench report opens with the headline score (section 0): the production
  grade, failures at 0, per stratum and overall, as the headline has been
  formed for months. Then read completion first. Quality there covers only cells
  complete in both arms; judge it by per-spec seed signs across strata, not by
  one number.
- Section 4 of a bench report, Geometry, shows how the rides use the geometry
  families: shares of ride time and of sections by family × guidance, the
  transfer share of guided sections, distinct families per ride, sections
  shorter than the shaped `minFrames`, and on complete cells the realization
  facts (fulfilled, guide never touched, shaped turns realized). A/B shows
  A→B per stratum, then A, B and A − B over strata. It is descriptive: variety
  is part of taste, not a number to maximize, and nothing in it is a target.
  Runs compiled before these facts were recorded say "not recorded"; the facts
  are compiler output, so remeasuring cannot recover them.

## Measures before objectives

- A measure becomes something the compiler optimizes only after it agrees with
  the owner's blind judgments on held-out passages.
- Until then it is a diagnostic. Changing a measure means a new contract
  identity and a remeasured baseline.

## Lean by default

- Delete rather than flag off. Experiments live on branches, not as options in
  production modules.
- Evidence keeps compiler provenance separate from measurement provenance.
  Remeasure saved tracks explicitly; do not relabel old measurements or silently
  reuse a run after changing its timing offset. Preserve published blind studies
  and answers under their original IDs.
- Every learned artifact needs its provenance, its size and an ablation, and it
  must be trained on data disjoint from what evaluates it.
- Reusable research and report tools live in `tools/measure`, `tools/eval` and
  `tools/report` (entries of the reachability guard). One-off study scripts do
  not: a study that matters becomes a dated document in `docs/research/` with
  its evidence, and its code stays on its branch.

## Documents

Keep `README.md`, `ARCHITECTURE.md` and this file current with the code. When
they disagree with the code, the documents are the bug. `REWORK.md` holds the
plan and its log.

## Compute

- The earlier timing records used a 64-core, 62 GB host. Check the current
  machine before choosing concurrency or interpreting those timings.
- Evaluation, comparison and parity share a default limited by available CPUs and roughly 4 GB per worker
  (at most 23). On the November 3 laptop (20 threads, 16 GB), this is four
  workers; `--jobs=N` overrides it. Do not benchmark alongside
  parity or other heavy checks. Engine performance decisions use
  `npm run perf:engine`: fixed paired rounds, a frozen candidate, and fresh
  confirmation under the same protocol. `--mode=compile` measures real compiles
  at the standard allowance with exact track/work parity; `bench:engine` is a
  workload diagnostic. `npm run perf:profile` shows where a real compile goes.
  When a change shifts work between registration and simulation, report isolated
  stepping cost alongside the combined workloads and compiler timings.
  For cache/allocation changes, also report WASM linear-memory high-water size;
  it is distinct from live allocations or process RSS.
  Paired protocol v3 uses a fixed, balanced randomized process-pair experiment,
  with every warmup retained and one exact median-change confidence interval.
  Live medians and pair counts are descriptive. A losing trial may be abandoned
  early with its partial evidence retained; it cannot qualify a candidate or be
  presented as a completed verdict. Promising runs still need the declared full
  experiment and fresh confirmation.
  Declare the practical speed/non-regression margin before measuring. An
  inconclusive interval is not equivalence. Null and injected-slowdown controls
  check the experiment; they cannot qualify a candidate. Separate fresh processes
  collect resources. See `docs/engine-validation.md` for the current workflow.
  Historical v1/v2 timing and decisions retain their original meanings; do not
  compare different warmup policies as if they were code improvements. Quality
  probabilities from V7 seed blocks are not performance evidence.
- Do not rerun the full sentinel for structural changes; parity is the gate.
- Use the pinned Node and Rust versions. Treat runtime/toolchain upgrades as
  explicit requalification work, particularly for binary64 equality. Preserve
  isolated workers for concurrent compiles; in-process compilation is synchronous
  and rejects reentrancy. Borrowed observation callbacks return owned data.
- Before a new optimization trial, declare whether adoption requires a speedup
  or permits a resource tradeoff, with explicit regression bounds and separate
  correctness/design gates. A timing verdict alone is not an adoption decision.
  The tool's default 2% margin is not a universal minimum benefit: weigh a
  supported smaller improvement against simplicity and resource gains. Keep
  the fixed experiment and its reported verdict intact; record any owner-led
  change to the adoption policy explicitly.
- Check both research narratives and JSON evidence for earlier trials of a
  proposed mechanism. Declare resource bounds at a meaningful scale: WASM
  capacity grows in 64 KiB pages and is distinct from live allocation size.
