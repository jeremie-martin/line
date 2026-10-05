# Working rules

These rules replace the earlier campaign workflow. They exist so that every
result in this repository can be trusted, compared and reproduced.

## Every change is one of two kinds

**Structural** means refactoring, deleting, moving, tooling or performance work
that must not change what the compiler produces.

- Gate: `npm run parity` (63 cells byte-identical) and `npm run parity:judge`.
- Also: `npm test`, `npm run typecheck` (the count must not rise) and
  `npm run reach` (zero unreachable code).
- A structural commit that changes any track hash is a bug.

**Behavioural** means anything that changes tracks.

1. State the hypothesis and the measure **before** running it.
2. Compare paired, song by song, against the current default.
3. Require the complete declared panel and identical resolved inputs before
   paired comparisons. Report completion separately from quality, with an interval over songs,
   not a point estimate over seeds that reproduce the same track.
4. Report the result under **every** ruler, not only the one optimized, so
   self-grading is visible. Disclose any ruler the change makes worse.
5. If accepted, update the parity references in the same commit with
   `npm run parity -- --update` and say why they changed.

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

- The machine has 64 cores and 62 GB of RAM.
- Parity uses 23 parallel compiles, and a full sentinel run takes about 30
  minutes at 24 jobs.
- Do not rerun the full sentinel for structural changes; parity is the gate.
