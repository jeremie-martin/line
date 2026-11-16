# To do

What is next and what is open. Results and decisions go to `REWORK.md`.

## Toward closing (owner, 2026-11-16: close the project for a while and use it to make many videos)

Decisions that are his:

1. **The overall zoom.** A trial only (`--wider-near`, `--wider-far`, the zoom page's sliders); his proposal is 7.5%
   more at the closest zoom and 5% more at the widest. Production is unchanged until he says.
2. **Zoom lanes.** 7 of 31 songs have marks on the second set. Until the rest are marked, a video may draw any of a
   song's lanes, liked or not. Either he marks them, or production uses only marked lanes, or the set is accepted.
3. **Specs.** Seven songs have a spec he has judged (the five handcrafted, Circus `voice-full`, Believer); Tiki's is the
   original. The other songs carry library specs nobody has marked; `/generated/watch/all-songs.json` shows one video of
   each. Which songs are in the first batches?
4. **`master`** is from May. When he calls it closed: merge `visual-lab` into it (ask before pushing).
5. **The lab's round pages** (about fifty): archive in the tree, or leave it with a tag.

Work that is mine:

- **One command for a batch of videos** (songs × seeds, look and lane chosen per ride, a report of what failed). Today
  it is one `npm run video` per video.
- **Videos made before 2026-11-16** fade the band at the end: re-render what is kept.
- **Branches and worktrees.** Local experiment branches (`exp/trim-*`, `exp/believer-on-compiler`, the November 11
  experiments, old backups), agent worktrees, and `compare`'s worktrees under `generated/eval/worktrees/` (never
  pruned; `generated/` is 22 GB). Four loose notes at the root are untracked (the owner's).
- **The compiler agent** restarts from `docs/compiler-brief.md` (a production sweep first).

## Waiting for the owner's eye

1. **Trimming unused track, further or not.** End only is in the compiler (his choice for now, `REWORK.md`). On
   `/generated/concept-lab/trim-video.html` the stronger versions remain to compare (seven songs, same ride in every
   version); they live on the local branch `exp/trim-dashboard`.
2. **The second set of zoom lanes** (`/generated/concept-lab/zoom.html`; marks in `zoom-2026-11b`). Written on
   2026-11-16 for 30 songs from his notes on the first set (Petrunko's three lanes are unchanged): moves sit in the
   music's own lead-in (the fill, break, swell or pickup read from the recording) and finish as the change lands;
   mostly smooth shapes with a sharp move only at a real drop; sizes follow the size of the event. His notes are a
   direction, not rules. His marks decide which stay.
3. **Opening and ending faster** (`/motion-gallery/video-compare.html?collection=/generated/watch/bookends.json`).
4. **Readings.** A second round for the songs where nothing reached 10 (Valhalla, Amor na Praia, Bones): same songs
   again, or new songs first? Next from scratch: Believer.
5. **`impact-visibility-2026-11`**: 55 pairs, about 20 minutes (clips under `generated/`: rebuild them first on a
   machine that lacks them). `night-pairs-2026-10-05-contact` (22 pairs) is also unanswered.

## The look (this branch)

- One layer at a time (owner, 2026-11-15). Done: carry, the split's direction, the zoom written per song. Not started:
  the hit effects beyond movement (split size, boost), then new themes and better versions of themes not loved.
- The lab holds about fifty round pages and their data (`generated/concept-lab/round*.html`, `candidates-*.json`,
  `films*.json`, `agents/`). They still load. The owner wants to work toward closing the visual lab: decide whether
  the rounds stay as an archive or leave the tree (their answers are in `LEDGER.md`).
- The spec dashboard does not show a song's zoom lanes; the zoom page does.

## Compiler (branch `compiler`; production review in progress)

Benchmark: V8, with V7.1 beside it (`docs/benchmark.md`); reference `foundation-12`.
The goal is never the score alone: keep ride character in mind (`tools/research/ride_character.ts`).

- **Catches from above, reservations from an independent read** (not a reason to revert): the final code was measured
  at 4 seeds only (16 seeds and V7.1 are the experiment's); the explicit result is given as −1.9 and −2.9 in two
  entries; shapes 31 → 28% is a loss of variety not named as a cost; `plainFromAbove` draws every receiver met from
  above plain whatever the request allows (then refuses it); a plan supplied whole can carry `catchFromAbove`.
- **Rails left by geometry.** Rails are 34% of gaps on V8; those left mostly hold shaped supports at the release
  before a strong beat (`tools/research/rail_job.ts --census`). Which of those jobs another geometry could take over
  is open.
- **Quiet asks are better, not done.** Open: the softest asks on slow passages (the owner's Tiki spec), and specs
  asking much air before quiet beats.
- **The long-float trade** (the 108 s spec): a momentum model of today's supports gives a float before a quiet catch
  about 0.74 air on these gaps; the rides are at it, the asks 0.15 above. A model, not a bound. Open lever: launching
  floats from the strong hit that starts them.
- **The remaining strong-beat gap on everyday songs** (chain setup). Compact sources plateau and generating moves
  failed (`REWORK.md`, "November 11 (night)").
- **Geometry hygiene:** G3 and G4 open. **Unwanted impacts:** U2, U3 (guide touches on beats), after the visibility
  study. **Trouble:** about half of `contrast-clusters`' seeds failed at the short two-hit pairs on 2026-10-31; check
  against today's compiler. **Circus `pairs4`** is the intended spec and a target.
- **Production review:** 248/248 default-spec rides complete and qualified; diagnostics and plain review collection
  in `docs/research/production-sweep-20261116.md`. Visual prioritization and final-code catches audit remain in progress.
- **Housekeeping for that agent.**
  - Five obsolete instrumented-study scripts removed; retained in Git at `2279c1f8`.
  - Legacy policy decoder fixture compressed without changing its contents (11 MB → 4.3 MB).
  - Options that production always sets (`goneThroughCleanup`, `railSupportMargin`, `completeBoundary`) exist as
    options for tests and research tools only.

## Open questions

1. **Strength scale.** Isolated maximal hits can survive, while dense passages deliver less. Keep the authored scale
   as stretch goals, or look at reachability per passage before any remapping?
2. **L'amour de ma vie.** Hits of 0.9 or more about 13 frames apart, an intro asking for speed the start cannot give,
   low air with a strong hit on every beat in the tail. Re-author, or keep as stretch goals?
3. **Air against impact.** Weighting air 1.5× recovered air accuracy but gave back about a third of the strong-beat
   gain. Which matters more?

## Tooling friction

Note friction here as it happens; fix what is tiny.

- A compile takes about twice as long in a full panel as alone. Expected with shared memory bandwidth; panel
  throughput was never measured.
- A compile needs the independent judge (`npm run build:wasm`): it replays the final track on it twice, as its own
  check.
- `compare` refuses every ride once the measurement code changes under it (anything `tools/eval/measure.ts` imports,
  the judge's files and compiler geometry included): edit those files only between runs, or in another worktree. A
  worktree made by hand needs `node_modules` linked, the engine's built `lr_engine.wasm` copied, and the songs'
  recordings (git-ignored) linked.
- `compare` keeps one worktree per compared commit in `generated/eval/worktrees/` and never prunes them.
- A lab page's scene (`generated/lab-rides/<song>.json`) holds the song's lanes as they were when it was prepared:
  run `prepare-rides.mjs` again after editing lanes.
- Eight-round paired timings resolve about 2%, so changes meant to be neutral come back unclear. Accepted.

## Simplifications to try (kept only if a paired compile and parity allow)

- Drop the constraint padding in `getUpdatesAtFrame` if `artifacts.ts` and `observe.ts` confirm no one reads it.
- When TypeScript 7.1 ships its API, drop `@typescript/typescript6` from `reach`.
- Bun: 35% less memory at equal speed matters to the owner, but not yet. It means a track rebaseline and moving the
  toolchain.

## Parked idea: motion the music asks for between hits (owner, 2026-11-15)

Today a specification asks for hits, air and speed; everything a shape does between two hits is unasked. Two ideas
that may be one mechanism, both for later, after the unasked-motion work is closed:

- **Features on the beat:** a shape spans several hits and its corners, steps and reversals land on them. Strongest
  in calm passages, where every small movement could be specified; not to be built for calm passages only.
- **Held sounds:** a held, modulated note (a voice, a trumpet) matched by a sustained, undulating ride.

Neither has a measure or a place in the specification yet. The owner is also building a better fold and one more
geometry on other branches.
