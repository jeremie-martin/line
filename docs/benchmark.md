# The benchmark (V7) and `npm run compare`

The everyday way to ask "is this compiler change better, worse, or no
different?". The tool does the bookkeeping and shows the evidence; we decide.
The suite's design and its baseline are in
`docs/research/v7-design-20261101.md`; the words are in
`docs/geometry-catalog.md`.

## The suite (V7.1, extending V7.0)

- **Automatic arrangements** (the plan chooses the geometry, as in
  production). There are 35 specs in 8 categories:
  - G: groove, a song's whole spec (17 specs: V7.0's four, and 13
    music-library specs added in V7.1);
  - P1: short pairs;
  - P2: voice and words;
  - P3: calm floats into a slam;
  - P4: intense;
  - P5: breaks and re-entries;
  - P6: the long ride;
  - P7: ride-outs.

  Their mean, with categories weighted equally, is **the V7 headline**.
  Within a category each spec weighs equally.
- **Explicit requests** (stratum E): 6 specs where a few gaps ask for one
  geometry. They are reported on their own line, never in the headline.
- **Panels:**
  - `v7.1` (the default of `compare` and `eval`): every spec × the first N
    seeds of 101, 202, 303, …; N = 4 unless `--seeds=N`;
  - `v7.1-confirm`: seeds 505–808, the sequence's seeds 5–8;
  - `v7` and `v7-confirm`: V7.0 itself, kept for history and for the parity
    cells that resolve it;
  - `heldout` (`--heldout`, decision points only) and `sealed` (`--sealed`,
    a small reserve that wears out with use).
- **Frozen:** each suite is exactly its list, `tools/eval/suites/v7.0.json`
  (git tag `v7.0`) and `tools/eval/suites/v7.1.json` (git tag `v7.1`). A spec
  file that is not listed is not part of it, whatever its name. Changing a
  list makes a new version, never a silent edit.

### V7.1 and the held-out songs (2026-11-07)

The music library brought 22 listening specs on 14 songs. They were split by
**song**, never by spec, so a song and its slowed versions stay together:
- **Development (V7.1, stratum G):**
  - Amor na Praia and Luna Bala, which were already development songs;
  - the songs with several tempo versions: Passo Bem Solto, Los Voltaje,
    Montagem Tomada and Funk do Bounce.

  Versions of one song are near-duplicates, useful for development (the same
  music at other gaps) but they would count one song several times as
  held-out evidence.
- **Held out (`heldout`, 4 seeds):** the eight single-version songs, Bones,
  Dernière Danse (coral), Funk Estranho, Let the World Burn, Lua na Praça,
  Montagem Coma, No Batidão and Petrunko. That makes 11 independent songs with
  Trouble, Valhalla and Circus. They are sealed from compiler decisions.
- **Long gaps:** the new specs are one-minute songs, denser than V7.0 (mean
  gap 16–26 frames). They spend 0–8% of their time in gaps of 100+ frames,
  against 13–24% for V7.0's float and long-ride specs. So V7.1 does not add
  weight to long gaps (see the open question below).
- **A test guards the split:** no held-out song may appear in a development
  suite, matched by song across tempo and length versions
  (`tests/eval_v7.test.ts`).

## Comparing a change

```
npm run compare -- run --reference=main --candidate=<branch>             # 4 seeds; no --candidate: this checkout as it is
npm run compare -- run --reference=main --candidate=<branch> --seeds=8   # extend: compiles only the missing pairs
npm run compare -- report --reference=main --candidate=<branch>          # saved rides only, compiles nothing
npm run compare -- rides  --reference=main --candidate=<branch>          # most-moved rides, side by side on the dashboard
npm run compare -- review --reference=main --candidate=<branch>          # the passages that differ most, before above after
```

- The panel is V7.1 unless `--panel=…` says otherwise.
- **A comparison has a name** (by default the candidate, the reference and its
  commit, and the panel) and keeps its configuration under it. Running it
  again with more seeds extends it; changing anything else needs `--name=…`.
- **A candidate branch** compiles from its own worktree; this checkout stays
  free.
- **Only missing rides are compiled.** Any ride saved under the same
  compiler, setting and inputs is reused, whatever run produced it.
- **Stop at any time** (Ctrl-C, a termination signal, or `--rounds=N`):
  finished rides are kept, and the report says PARTIAL. The same command
  resumes.
- **Exit status:** 0 when done, 1 if a ride failed to compile (a tool
  failure, not a ride that did not finish), 130 when stopped. A killed run can
  leave a lock in its arm; the message names the PID to check first.
- **Options:**
  - `--only=REGEX`: a subset of cases;
  - `--jobs=N`: parallel rides (default: available CPUs at about 2 GB each);
  - `--budget=standard*F` and `--creative=JSON`: both arms;
  - `--candidate-budget` and `--candidate-creative`: one arm.
- **Agents:** run it as a tracked background task, so its end is noticed at
  once. Do not watch a log with `tail -f | grep`, which does not exit.
- **Branches:** a candidate branch must start from the reference's commit.
  Otherwise the comparison mixes changes.
- **Other builds:** a commit is compiled with this checkout's built engine and
  `node_modules`. A commit with another engine source or lockfile is refused
  rather than compiled with the wrong build.
- Several comparisons against the same saved reference can run at once.
- **Review by eye** (`review`): from the saved rides that moved most, the
  `--passages=6` windows of 4 s (1.5 s before a beat) where the scored
  quantities changed most. A window's change is the sum, over its beats, its
  unasked hits and the share of its gaps' air and speed inside it, of
  |after − before| squared error, as the accounts count them; a ride that did
  not finish counts its end and nothing after. One passage per spec, then per
  ride, before repeating. Each is one plain clip, reference above candidate,
  same time window, the reference's sound, the largest change tagged; the
  `video-compare` collection lists what changed with the numbers. Library songs
  (`*_selection`) are left out unless `--all-songs`. Whole rides are rendered
  once (`review-rides/`, reused) and cut; `--jobs=N` renders at a time (4).

## Reading a report

The console shows the summary (items 1–3) and the path of the full report,
`generated/eval/compare/<name>/report.txt`, which adds the detail (item 4).
`report --detail` prints everything.

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
   - how different the rides of different random starts are, for each arm:
     the share of gaps whose geometry differs (family, and whether the upper
     rail was touched) and the mean per-gap airtime difference. This is a
     property of the generator to watch, never a target;
   - physics frames and compile seconds per ride, with the relative change;
   - costs and guards that no headline counts: body drag, strong extra
     impacts per 100 beats, and the share of strong arrivals head-down or
     backward. Both arms' values and the relative change are shown, with the
     detail section's definitions;
   - the uncertainty line (below).

   On a PARTIAL run, the evidence on complete rounds (the suite evenly) comes
   first.
3. **Most-moved rides.**
4. **Detail:** the stratified report on the matched pairs, with completion,
   quality under every ruler with per-spec seed signs, and geometry use.

**The uncertainty line.** It is computed on complete seed blocks: one seed of
every spec. Each block gives one headline difference, with the headline's own
weights. From 3 blocks on, the report shows:
- their mean;
- a 95% interval (t, n − 1 degrees of freedom);
- the directional support P(mean change > 0) under that model, shown as
  "> 0.99" or "< 0.01" at the extremes.

It describes the mean change **on this fixed suite across seeds**, not on new
music. The interval assumes the blocks are independent replicates.
- **Validated** (`tools/research/validate_uncertainty.ts`):
  - in simulation without a true change, support exceeds 0.95 in 5% of
    comparisons (about 4% with heavy-tailed blocks);
  - on real rides of one compiler split into two pretend arms, 5.1%, with
    interval coverage 94.4%.
  - The arms that real-ride check used were deleted in a cleanup; to repeat
    it, pass any arm with 8 complete seed blocks.
- **Not valid under arbitrary stopping:** reading it after every round and
  stopping when it looks good makes it optimistic.
- **More seeds when they could change the decision,** not as a reflex. The
  report never announces a winner.

What to keep in mind:
- **Single rides are noisy:** a seed moves one ride by 15–40 points. Look at
  the categories, at specs up and down, and at the uncertainty line, not one
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
| `generated/eval/compare/<name>/comparison.json` | the comparison's configuration |
| `generated/compare/<name>/` | rides for the dashboard: the saved rides, written from the compile's own outputs (no second compile) |
| `generated/eval/worktrees/` | checkouts of compared commits; remove one with `git worktree remove <dir>` |

## What makes two rides comparable

- **Compile adapter:** the bytes of `tools/eval/compile.ts`, which turns a case
  into compile options. A change there is a different arm.
- **Compiler content:** the committed trees of what the compiler loads
  (`scripts/v0`, `scripts/lib`, `vendor`, `engine-rs/src`, the lockfile,
  `tsconfig.json`), plus uncommitted changes and the engine bytes. A commit
  that touches only documents or tools changes nothing.
- **Inputs:** each case's resolved spec, music and timing. A spec edit
  recompiles that case.
- **Measurement code:** the import closure of `tools/eval/measure.ts`. If only
  it changed, saved tracks are remeasured, not recompiled, and the report says
  so.

## Open questions

- **V7 may over-weight long gaps (raised 2026-11-01, undecided).** V7.1 does
  not add to it: its 13 new specs are dense songs.
  - Categories weigh equally, so the single long-ride spec (Amour
    bench-long, P6) is 1/8 of the headline. The float (P3) and ride-out (P7)
    categories also favour long gaps.
  - Gap-length weighting of the search's span errors was tested in three
    versions. Each gained on V7 (+4.5 to +7.4) and lost on the held-out
    panel (−4.0, −9.9, −5.8; `docs/research/compiler-ideas-20261101.md`,
    experiments F and F′).
  - Ideas that help long gaps are therefore amplified on V7 in a way new
    music did not reward.
  - **Options:** keep V7 as is, rebalance the category weights, or add more
    long-ride specs so P6 is not a single spec. A change would be a new
    frozen suite version (V7.1), not an edit of v7.0.
  - **Until then:** treat a V7 gain concentrated in P3/P6/P7 with caution,
    and check it on the held-out panel before deciding.
