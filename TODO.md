# To do

What is next and what is open. Results and decisions go to `REWORK.md`.

## Toward closing (owner, 2026-11-16: close the project for a while and use it to make many videos)

His answers of 2026-11-16 are in `REWORK.md` ("the closing decisions"). What remains:

1. **Opening and ending.** He wants the loop from the last frame to the first to flow as one movement, with no
   stop and no rush, and to take little of the video. The gesture is now set by how fast the picture moves on screen
   (`ENDS` in `scripts/video/camera.js`); the zoom and each side's length follow. `/generated/concept-lab/ends.html`
   plays the last five seconds into the first five, with five sliders, six proposals, the camera's path from above,
   and what the page measures (speed of the course on screen, how hard it changes, the slowest moment at the turn).
   That measure is not checked against his eye. Production carries my first proposal until he saves his settings
   (`labels/studies/bookends-2026-11.jsonl`).
2. **Specs: the real work left.** Most library specs were put together quickly for the benchmark and the workflows;
   he has not judged them and some songs may not belong in production at all (rhythm, speed). Seven songs have a spec
   he judged (the five handcrafted, Circus `voice-full`, Believer); Tiki's is the original. To do properly, after
   everything else: which songs are in, then their specs. `/generated/concept-lab/closing/songs.html` shows one video
   of each song and takes his marks (in, rework, out).
3. **`master`** is from May. He merges at the very end: `visual-lab` into it (ask before pushing).
4. **Trimming unused track** is End only. Not closed: the page (`/generated/concept-lab/trim-video.html`) and the
   stronger versions (local branch `exp/trim-dashboard`) stay, for after he has used the project for a while.
5. **Zoom lanes:** the set is accepted as written; a video draws any lane of its song, never the steady zoom. He may
   still mark lanes on `/generated/concept-lab/zoom.html` (`zoom-2026-11b`); a lane marked Cut is to be deleted.

Work that is mine:

- **Videos made before the evening of 2026-11-16** have the earlier zoom (and, before that day, a band fading at the
  end): re-render what is kept. The showcase and then-and-now films already have today's zoom.
- **Branches.** The ten merged ones are deleted (his choice); fifteen with their own commits stay local. Worktrees
  left: two agent worktrees, `compare`'s under `generated/eval/worktrees/` (never pruned), and others outside the
  tree. Four loose notes at the root are untracked (the owner's).
- **The compiler agent** restarts from `docs/compiler-brief.md` (a production sweep first).

## Waiting for the owner's eye

1. **Readings.** A second round for the songs where nothing reached 10 (Valhalla, Amor na Praia, Bones): same songs
   again, or new songs first? Next from scratch: Believer.
2. **`impact-visibility-2026-11`**: 55 pairs, about 20 minutes (clips under `generated/`: rebuild them first on a
   machine that lacks them). Parked until the compiler work reaches unwanted impacts (U2, U3), which it decides.

## The look (this branch)

- One layer at a time (owner, 2026-11-15). Done: carry, the split's direction, the zoom written per song. Not started:
  the hit effects beyond movement (split size, boost), then new themes and better versions of themes not loved.
- The lab's round pages and their data (`generated/concept-lab/round*.html`, `candidates-*.json`, `films*.json`,
  `agents/`) stay in the tree as an archive (owner); their answers are in `LEDGER.md`.
- The spec dashboard does not show a song's zoom lanes; the zoom page does.

## Compiler (branch `compiler`, another agent; paused on the night of 2026-11-15)

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
- **Housekeeping for that agent.**
  - `tools/research/` holds about thirty-five report-only scripts, most cited only by one `REWORK.md` entry.
    `WORKING.md` asks that one-off study code stay on its branch: keep those still in use (`ride_character`,
    `rail_job`, `geometry_catalog`, `validate_uncertainty`, `family_fit`, `rail_squeeze`, `catch_price`) and the
    chain that retrains the shipped models, as one unit.
  - **Policy formats production never loads** (`arc_control_policy.ts`, about 60 of 169 lines: forests, residual and
    proximity models, the 67-feature schema; the matching branch of `arc_interval_state.ts`). The shipped model holds
    only catalogue, network and exemplars. Removing them removes `tests/fixtures/arc_control_policy_legacy.json`
    (11 MB) and about four tests. Parity must stay identical.
  - Options that production always sets exist for tests and research tools only: `goneThroughCleanup` (true),
    `railSupportMargin` (6); `completeBoundary` follows `guidanceSamples > 0`. Twelve test files copy the base options
    by hand instead of spreading `connectedArcOptions`.
  - `tools/eval/harden.ts` no longer reproduces V8; a test imports three of its exports. `v7-confirm` is history.
  - Variants nothing names: Circus `pulse808`, Valhalla `words2`. Studies without answers or use:
    `upper-hits-2026-11-redo`, `hit-curve-2026-11`.

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
