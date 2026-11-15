# To do

What is next and what is open. Results and decisions go to `REWORK.md`.

## Waiting for the owner's eye

1. **Trimming unused track.** `/generated/concept-lab/trim-video.html`: seven songs, seven versions from nothing
   trimmed to touch-to-touch, on one slider. Every version leaves the ride identical (score and rider path, 49
   compiles). His first look: two pieces kept is preferred, touch-to-touch is too aggressive (tiny pieces, e.g. Circus
   at 37 s). The versions live on the local branch `exp/trim-dashboard` (rule: `retainedSpan` in
   `scripts/v0/optimizer/arc_guidance.ts`, chosen by `TRIM_KEEP`). Adopting one means: the chosen rule without the
   switch, parity references updated, `npm run parity`, `parity:judge`, a `REWORK.md` entry.
2. **Zoom lanes of the 28 songs written on 2026-11-15** (`/generated/concept-lab/zoom.html`, every song in the menu).
   He has marked Petrunko, Trouble and Tiki only. Known from measuring them: no lane is among the closest during the
   most intense fifth of its song; several lanes hold one value for the last 30 to 45 s of their song (Amor na Praia
   selection, Funk Estranho, the three Los Voltaje "held", Luna Bala slowed); "Held breath" recurs in nine songs.
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

## Compiler (branch `compiler`, another agent; paused on the night of 2026-11-15)

Benchmark: V8, with V7.1 beside it (`docs/benchmark.md`); reference `foundation-11` (same tracks as `foundation-10`).
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
- **Housekeeping for that agent.**
  - `tools/research/` holds about forty report-only scripts; five need an instrumented compiler branch to run
    (`apex_work`, `quiet_work`, `ridable_work`, `upper_work`, `upper_candidates`). `WORKING.md` asks that one-off
    study code stay on its branch.
  - `tests/fixtures/arc_control_policy_legacy.json` is 11 MB and feeds one test of the policy decoder.
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
