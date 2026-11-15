# To do

Short list of agreed next tasks. Details and results go to REWORK.md.

0000. **Open from the night of 2026-11-15** (the compiler agent is paused).
   - **Trimming unused track** (branch `exp/trim-support-ends`, local): the trim of `e06720f9` brought onto
     `foundation-10`, and one commit further a version with no margin (a support ends at the rider's last touch). Rides
     identical on four songs (score and recorded path); drawn length −13 to −22% with the two-piece margin, −25 to −30%
     without. For the owner's eye: `/motion-gallery/video-compare.html?collection=/generated/watch/trim.json` and the side-by-side map
     `/generated/concept-lab/trim-map.html` (data from `trim-prepare.mjs`; the branch reads `TRIM_KEEP=n` for n pieces kept).
     Owner, first look: prefers two pieces kept; the last-touch version is too aggressive (it leaves minuscule pieces, e.g.
     Circus at 37 s) and a few curves stay longer there because a cut that breaks a fulfilled shape is undone. Not adopted:
     needs his choice of margin, then parity references, `npm run parity`, `parity:judge`, and a REWORK entry.
   - **Catches from above, reservations from an independent read** (not a reason to revert): the final code was measured
     at 4 seeds only (16 seeds and V7.1 are the experiment's); explicit result given as −1.9 and −2.9 in two entries;
     shapes 31 → 28% is a loss of variety not named as a cost; `plainFromAbove` draws every receiver met from above
     plain whatever the request allows (then refuses it); a plan supplied whole can carry `catchFromAbove`.
   - **Zoom lanes** to write for the remaining songs (31 have a spec; Petrunko, Trouble, Tiki done).

000. **The look, one layer at a time** (owner, 2026-11-15). Carry is adopted (REWORK.md). Next: the split's direction
   (it points into the surface while the picture now moves out of it; the owner feels it goes the wrong way); then a
   zoom that follows the song or the spec, where carry and the shake should probably scale with the zoom.

00. **Where things stand (2026-11-15).** One compiler on `visual-lab`: gentle exits, terraces and folds parked, the
   arrival law, aimed launches removed, catches from above in shaped phrases (reference `foundation-10`). Next, in order:
   - ~~the owner's review of the 20 handcrafted specs~~ (done 2026-11-15: production specs chosen, REWORK.md). Next: a
     second round of readings for the songs where nothing reached 10 (Valhalla, Amor na Praia, Bones);
   - ~~the compiler's consistency stop ("main construction differs at support N")~~ (fixed 2026-11-15: the check did
     not know the gone-through cleanup shortens main lines; REWORK.md);
   - the long-float trade (the 108 s long spec): a momentum model of today's supports (REWORK.md, November 15): under
     the 0.6 push cap it gives a float before a quiet catch about 0.74 air on these gaps; the rides are at it, the asks
     0.15 above it. A model, not a bound: a different construction may get past it. Open lever: launching floats from the
     strong hit that starts them.

0b. **Rails left by geometry** (2026-11-15). Catches from above in shaped phrases took rails from 39 to 34% of gaps
   on V8 (`foundation-10`, owner's choice; REWORK.md). The rails left mostly hold shaped supports at the release before
   a strong beat (`tools/research/rail_job.ts --census`); which of those jobs another geometry could take over is open.

0. **Quiet asks are better, not done** (owner, 2026-11-15). Adopted on the way: level arrivals before quiet catches
   and quiet misses priced in proportion, then the arrival law (one speed-aware arrival heading for every ask); aimed
   launches were removed under gentle exits (REWORK.md, November 15). Still open: the softest asks on slow passages
   (the owner's Tiki spec), and specs asking much air before quiet beats (the long spec, item 00).

2. **Trouble** (owner's review, 2026-10-31): `contrast-clusters` preferred (spec.ts); lessons in
   docs/music-authoring.md. Open: about half of its seeds failed at the short two-hit pairs then; check against today's
   compiler.
3. **Unwanted impacts** (diagnosis 2026-10-30, docs/research/unwanted-impacts-20261030.md). For the owner: the example
   collection (`/generated/unwanted-impacts-20261030/collection.json`). U1 stopped (worse than v3 on his labels); next
   the visibility study (item 5). No compiler fix (U2, U3) before that.

5. **Owner: answer `impact-visibility-2026-11`** (55 pairs, about 20 min).
6. **Dashboard camera** (agent, 2026-10-31): the viewer follows the sled's peg,
   so spins make the world lurch; check whether videos are affected.
7. **Geometry hygiene diagnosis** (agent, report only): pass-throughs
   (rider crossing a line from its non-colliding side) and untouched geometry.
8. **Circus Minimus `pairs4`** is the intended spec (0 complete in 24 when last tried, before November): a target for
   item 9. (`voice-full` is the default spec since 2026-11-14.)
9. **Compiler work** (branch `compiler`). Benchmark: V8 (`docs/benchmark.md`); reference `foundation-10` (2026-11-15).
   References are local: set one on each machine (`npm run compare -- reference set NAME --from=COMMIT`). Families
   placed where they fit is today's planning approach, open to replacement (`docs/taste-and-the-compiler.md`).
   - Open question: the remaining strong-beat gap on everyday songs (chain setup). Compact sources plateau (more styles, more
     memory moves, more data don't help) and generating moves failed (REWORK.md, "November 11 (night)").
   - Still open from November 1:
     - short re-landings at speed: completion solved on November 1 (every V8 ride completes, Circus `pairs4` included);
       quality there is the same strong-too-soft story as elsewhere;
     - geometry hygiene (G1–G4): G2 adopted 2026-11-13 (lead-ins never rise into the arrival path: −26% crossed,
       score neutral, strong extras −12 to −36%); G1 (untouched curve ends trimmed, rides identical, −13% drawn length)
       built on `exp/trim-untouched-ends` for the owner's eye; G3, G4 open;
     - unwanted impacts (U2, U3; guide touches on beats);
     - the measure (visibility study);
     - benchmark fitness.
11. **Videos: one renderer** (2026-11-08, branch `visual-lab`; REWORK.md).
    Open:
    - ~~**Timing**~~ (`generated/concept-lab/docs/TIMING-DESIGN.md`, all on
      `visual-lab`): stages 1 to 4 done (two clocks, the scene as the single
      source, rides record authored beats and align themselves, a hit happens
      at its strongest frame, R23; the jolt removed by the owner's decision,
      2026-11-11, with the evaluation plans' redundant `authoredTargets`).
    - Done: the review player draws the video picture too (plain by default, any
      theme), with contact inspection as an overlay (owner, 2026-11-08).
    - Kept by the owner's choice (2026-11-08): the specs' `camera` (zoom lanes,
      beat punch) stays as authored, though the renderer does not read it. It
      enters compile identities (`specSha256`). `select.json` (with its `render`
      block) went with the production characterization (2026-11-11).

12. **Direction (owner, 2026-11-13).**
    - **Here, on `visual-lab`:** the look. New themes, better versions of the themes not loved, the painting, the hit
      effects. After that, the specifications (below).
    - **Compiler: another agent, another machine, a branch from `visual-lab`.** The goal is never the score alone: a
      950 compiler once made boring, repetitive tracks. Keep ride character in mind (`ride_character.ts`); it is not a gate on every change.
    - **A harder benchmark** (for that agent; cheap, not a new benchmark from scratch): the current specs made a bit
      faster and shorter, with more contrast or higher asks, plus some held-out specs or variations of them. Keep a few
      specs held out.
    - **Specifications, soon.** The recent ~20 were drafted by agents and reviewed once: good, not production grade.
      Wanted: more ambitious ones like Circus Minimus.
      - Circus Minimus: done 2026-11-14. `voice-full` follows the voice and drums to the last bar and is the default spec;
        four seeds compiled complete. The held-out panel's "Circus preferred" case follows `spec.ts`, so its saved
        results are those of `pairs3`: rerun it before comparing.
      - Next: Believer, from scratch.

## Open questions kept from the retired night report (asked 2026-10-05)

The compiler has changed since. Answer them against current rides.

1. **Strength scale.** Isolated maximal hits can survive, while dense passages
   deliver less. Keep the authored scale as stretch goals, or look at reachability
   per passage before any remapping?
2. **L'amour de ma vie.** Hits of 0.9 or more about 13 frames apart, an intro asking
   for speed the start cannot give, low air with a strong hit on every beat in the
   tail. Re-author, or keep as stretch goals?
3. **Air against impact.** Weighting air 1.5× recovered air accuracy but gave back
   about a third of the strong-beat gain. Which matters more?
4. **Body drag.** Answered (owner, 2026-11-01 and 2026-11-15: "not a huge issue for me"): an unvalidated proxy,
   reported in every comparison, never optimized.
5. **Lines through the rider.** Answered: worth fixing; the gone-through cleanup (2026-11-14) took the cases from 1.6
   to 0.3 per ride on V8.

## Blind studies with no saved answers

Both stay in `labels/studies` and open on `motion-gallery/pairs.html?study=<id>`.
Their clips live under `generated/` and are not on every machine: restore or rebuild
them before answering.

- `night-pairs-2026-10-05-contact`: 22 pairs, the first-contact posture check.
- `impact-visibility-2026-11`: 55 pairs, about 20 minutes (item 5 above).

## Tooling friction noticed while using the repository

Note friction here as it happens; fix what is tiny.

- A compile takes about twice as long in an eight-worker panel as alone (33 s against
  16 s). Expected with shared memory bandwidth; panel throughput was never measured.
- A compile needs the independent judge (`npm run build:wasm`): it replays the final
  track on it twice, as its own check.
- `compare` compiles both arms with this checkout's built engine, so nothing may be rebuilt
  during a 15-minute panel. Separate work happens in another worktree, and a
  `node_modules` symlink there once replaced the real directory on cherry-pick (now ignored).
- `compare` keeps one worktree per compared commit in `generated/eval/worktrees/` and never
  prunes them; it could drop those no saved run needs. (Pruned by hand 2026-11-15, with the saved rides no
  comparison can reuse: every arm's identity includes `tools/eval/compile.ts`.)
- `compare` refuses every ride once the measurement code changes under it (anything `tools/eval/measure.ts` imports,
  compiler geometry included): edit those files only between runs, or in another worktree. A worktree made by hand
  for tests or parity needs `node_modules` linked and the engine's built `lr_engine.wasm` copied.
- Eight-round paired timings resolve about 2%, so changes meant to be neutral come back
  unclear. Accepted: about 8 minutes a run is the right cost.

## From the November 7 engine and tooling review

Each is a simplification to try, kept only if a paired compile and parity allow it.

- Drop the constraint padding in `getUpdatesAtFrame` if `artifacts.ts` and `observe.ts`
  confirm no one reads it.
- When TypeScript 7.1 ships its API, drop `@typescript/typescript6` from `reach`.
- Try Bun soon: 35% less memory at equal speed matters to the owner, but not yet. It
  means a track rebaseline and moving the toolchain.

## Parked idea: motion the music asks for between hits (owner, 2026-11-15)

Today a specification asks for hits, air and speed; everything a shape does between two hits is unasked. Two ideas
that may be one mechanism, both for later, after the unasked-motion work is closed:

- **Features on the beat:** a shape spans several hits and its corners, steps and reversals land on them. Strongest
  in calm passages, where every small movement could be specified; not to be built for calm passages only.
- **Held sounds:** a held, modulated note (a voice, a trumpet) matched by a sustained, undulating ride.

Neither has a measure or a place in the specification yet. The owner is also building a better fold and one more
geometry on other branches.
