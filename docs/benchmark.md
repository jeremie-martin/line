# The benchmark (V7) and `npm run compare`

The everyday way to ask "is this compiler change better, worse, or no
different?". The tool does the bookkeeping and shows the evidence; we decide.
The suite's design and its baseline are in
`docs/research/v7-design-20261101.md`; the words are in
`docs/geometry-catalog.md`.

## The suite (V7.0)

- **Automatic arrangements** (the plan chooses the geometry, as in
  production). There are 22 specs in 8 categories:
  - G: groove;
  - P1: short pairs;
  - P2: voice and words;
  - P3: calm floats into a slam;
  - P4: intense;
  - P5: breaks and re-entries;
  - P6: the long ride;
  - P7: ride-outs.

  Their mean, with categories weighted equally, is **the V7 headline**.
- **Explicit requests** (stratum E): 6 specs where a few gaps ask for one
  geometry. They are reported on their own line, never in the headline.
- **Panels:**
  - `v7`: every spec × seeds 101–404, so 4 rounds of 28 rides;
  - `v7-confirm`: seeds 505–808;
  - `heldout` (`--heldout`, decision points only) and `sealed` (`--sealed`,
    a small reserve that wears out with use) are as before.

  The older `bench*` panels still run.
- **Frozen** as git tag `v7.0`. Changing the suite makes a new version
  (V7.1), never a silent edit.

## Comparing a change

```
npm run compare -- run --reference=main --candidate=<branch>   # or no --candidate: this checkout as it is
npm run compare -- report --reference=main --candidate=<branch> # saved rides only, compiles nothing
npm run compare -- rides  --reference=main --candidate=<branch> # most-moved rides, side by side on the dashboard
```

- `--panel=v7` is what to use. The default, `bench`, is kept for older runs.
- **A candidate branch** compiles from its own worktree; this checkout stays
  free.
- **Only missing rides are compiled.** Any ride saved under the same
  compiler, setting and inputs is reused, whatever run produced it.
- **Stop at any time** (Ctrl-C, or `--rounds=N`): finished rides are kept and
  the report says PARTIAL. The same command resumes.
- **Options:**
  - `--only=REGEX`: a subset of cases;
  - `--jobs=N`: parallel rides (default 44);
  - `--budget=standard*F` and `--creative=JSON`: both arms;
  - `--candidate-budget` and `--candidate-creative`: one arm.
- **Agents:** run it as a tracked background task, so its end is noticed at
  once. Do not watch a log with `tail -f | grep`, which does not exit.
- Several comparisons against the same saved reference can run at once.

## Reading a report

1. **Header:**
   - provenance: commits, compiler content, engine, measurement code and
     allowance (it says THE SAME COMPILER when both arms are identical);
   - what was reused, remeasured and compiled;
   - coverage: matched pairs, complete rounds, per category.
2. **Evidence:**
   - the V7 headline of each arm and the difference, overall and per
     category;
   - specs up and down, with the lowest and highest;
   - rides gained and lost;
   - the explicit-request line;
   - physics frames and compile seconds per ride.

   On a PARTIAL run, the evidence on complete rounds (the suite evenly) comes
   first.
3. **Most-moved rides.**
4. **Detail:** the stratified report on the matched pairs, with completion,
   quality under every ruler with per-spec seed signs, and geometry use.

What to keep in mind:
- **No verdict, no interval, no probability.** Seeds move a single ride by
  15–40 points, so look at the categories and at specs up and down, not one
  number alone.
- **Completion and geometry realization are near 100%** for today's compiler.
  The quality numbers carry the signal. "Realized" is the compiler's own
  shape check.
- **Compile seconds** are comparable only between runs that did not share the
  machine. Physics frames always are.

## After a decision

```
npm run compare -- reference set main --from=<commit> --note="why"
npm run compare -- reference list
```

A reference names a commit; it changes only when we decide.

## Where things live

| path | what |
|---|---|
| `generated/eval/arms/<key>/` | saved rides of one compiler under one setting |
| `generated/eval/references/` | named references |
| `generated/eval/compare/<name>/report.txt` | the last report of each comparison |
| `generated/compare/<name>/` | rides for the dashboard |
| `generated/eval/worktrees/` | checkouts of compared commits; remove one with `git worktree remove <dir>` |

`npm run compare -- import --from=<eval run>` brings an older `npm run eval`
run into the store when its compiler can be identified exactly.

## What makes two rides comparable

- **Compiler content:** the committed trees of what the compiler loads
  (`scripts/v0`, `scripts/lib`, `vendor`, `engine-rs/src`, the lockfile,
  `tsconfig.json`), plus uncommitted changes and the engine bytes. A commit
  that touches only documents or tools changes nothing.
- **Inputs:** each case's resolved spec, music and timing. A spec edit
  recompiles that case.
- **Measurement code:** the import closure of `tools/eval/measure.ts`. If only
  it changed, saved tracks are remeasured, not recompiled, and the report says
  so.
