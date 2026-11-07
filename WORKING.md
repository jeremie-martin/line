# Working rules

These rules replace the earlier campaign workflow. They exist so that every
result in this repository can be trusted, compared and reproduced.

## Every change is one of two kinds

**Structural** means refactoring, deleting, moving, tooling or performance work
that must not change what the compiler produces.

- Gate: `npm run parity` (25 cells byte-identical) and `npm run parity:judge`.
- Also: `npm test`, `npm run typecheck` (no errors) and
  `npm run reach` (zero unreachable code).
- `npm run check` combines these gates with native Rust tests,
  `npm run verify:engine` and `npm run check:smoke`, which uses the real tools end
  to end and needs local song audio and a Chromium. Rebuild with `npm run build:native` first when editing
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

- `v7` is the development panel, and `v7-confirm` re-runs it at fresh seeds.
  `npm run eval -- --name=X` compiles one panel with this checkout.
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
- Reusable research tools live in `tools/measure`, `tools/eval` and `tools/research`,
  declared as entries of the reachability guard. One-off study scripts do
  not: a study that matters becomes a short note, and its code stays on its branch.

## Recording decisions

A commit holds the change, its tests and a few lines of record. Never commit raw
results, timing samples, logs, patches or study scripts.

- **Record:** a short entry in `REWORK.md`: what was tried, the number with its
  interval, and the verdict. Rejected ideas get a sentence too, so nobody retries
  them.
- **Longer findings:** one short note in `docs/research/`. Notes are text; a test
  enforces this.
- **Raw results:** stay under `generated/`, which is not committed. If a result
  matters later, it can be measured again; that is what the tools are for.

## Documents

Keep `README.md`, `ARCHITECTURE.md` and this file current with the code. When
they disagree with the code, the documents are the bug. `REWORK.md` holds the
plan and its log.

## Compute

- Check the current machine before choosing concurrency or reading old timings.
- Evaluation, comparison and parity share one worker pool: available CPUs at about
  2 GB each, eight on this 20-thread, 16 GB laptop. `--jobs=N` overrides it.
- The speed goal is in [docs/performance-goal.md](docs/performance-goal.md), and
  `npm run perf:score` is its number. Speed decisions use `npm run perf:engine --
  --against=<ref>` on real compiles, and `npm run perf:profile` shows
  where a compile goes. Never benchmark alongside other heavy work. Protocol and reading the
  result: [docs/engine-validation.md](docs/engine-validation.md).
- Before a trial, declare whether it needs a speedup or permits a resource tradeoff,
  with its bounds. A timing verdict alone is not an adoption decision; weigh it against
  simplicity. Keep a small gain only if the code stays clean: avoid odd optimizations
  that would not survive a later redesign.
- Use the pinned Node and Rust versions. Treat upgrades as explicit requalification,
  particularly for binary64 equality.
- A compile is sequential, in its own process, and in-process compilation rejects
  reentrancy. Parallelism is across rides. Borrowed observation callbacks return owned data.
- Check `REWORK.md` and `docs/research/` for earlier trials of a proposed mechanism.
