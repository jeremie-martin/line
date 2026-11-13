# To do

Short list of agreed next tasks. Details and results go to REWORK.md.

1. ~~**Cheaper candidate geometry**~~ (done and merged 2026-10-30: songs −8
   to −11% CPU, long case −27%, identical tracks).
2. ~~**Owner review of the Trouble spec variants**~~ (rounds 1–4,
   2026-10-31). Preferred: `contrast-clusters` (spec.ts); lessons in
   docs/music-authoring.md. Open: about half of its seeds fail at the short
   two-hit pairs.
3. ~~**Diagnosis of unwanted impacts**~~ (done 2026-10-30:
   docs/research/unwanted-impacts-20261030.md). Next, for the owner:
   - look at the example collection
     (`/generated/unwanted-impacts-20261030/collection.json`);
   - U1 stopped (worse than v3 on his labels); step back done
     (docs/research/measure-step-back-20261031.md). Next: night study, then
     the visibility study it proposes. No compiler fix (U2, U3) before that.
4. ~~**Dashboard playback**~~ (done 2026-10-31: one shared player,
   shared/playback.js).

5. **Owner: answer `impact-visibility-2026-11`** (55 pairs, about 20 min).
6. **Dashboard camera** (agent, 2026-10-31): the viewer follows the sled's peg,
   so spins make the world lurch; check whether videos are affected.
7. **Geometry hygiene diagnosis** (agent, report only): pass-throughs
   (rider crossing a line from its non-colliding side) and untouched geometry.
8. ~~**New songs**~~ (2026-10-31).
   - Valhalla: `words3`, production ready.
   - Circus Minimus: `pairs3` is preferred (realizable: 1 seed in 24).
   - `pairs4` is the intended spec (0 in 24): a target for item 9.
9. **Compiler work** (branch `compiler`). Benchmark: V8 (2026-11-13; `docs/benchmark.md`), reference `nov13` = 762.1 on V8,
   800.8 on V7.1. The archive version (`merged`) scores +14.9 [+6.1, +23.7] above it on V8 (V7.1: +11.7).
   - Open question: the remaining strong-beat gap on everyday songs (chain setup). Compact sources plateau (more styles, more
     memory moves, more data don't help) and generating moves failed (REWORK.md, "November 11 (night)").
   - ~~Delete the ending refinement~~ (done 2026-11-13: −0.2 on V8, −0.1 on V7.1; 424 lines out).
   - Still open from November 1:
     - short re-landings at speed (Trouble about half, Circus 1/24 and 0/24);
     - geometry hygiene (G1–G4);
     - unwanted impacts (U2, U3; guide touches on beats);
     - the measure (visibility study);
     - benchmark fitness.
10. ~~**New benchmark**~~ (2026-10-31): built and baselined (`bench-base-20261031`, `pairs8-base-20261031`).

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
      - Circus Minimus: the passage synchronized to the voice is the favourite (many short gaps). The chorus voice goes
        on 15–20 s longer than the spec follows it: extend it, and try slightly stronger asks there.

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
4. **Body drag.** The rider's body drags along rails more than before (about 1.6 to
   2.1 s/min at the time). Is it visible or objectionable? If so, it becomes a guard.
5. **Lines through the rider.** 6 to 8 per ride at the time. Worth fixing?

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
  prunes them; it could drop those no saved run needs.
- Eight-round paired timings resolve about 2%, so changes meant to be neutral come back
  unclear. Accepted: about 8 minutes a run is the right cost.

## From the November 7 engine and tooling review

Each is a simplification to try, kept only if a paired compile and parity allow it.

- Drop the constraint padding in `getUpdatesAtFrame` if `artifacts.ts` and `observe.ts`
  confirm no one reads it.
- When TypeScript 7.1 ships its API, drop `@typescript/typescript6` from `reach`.
- Try Bun soon: 35% less memory at equal speed matters to the owner, but not yet. It
  means a track rebaseline and moving the toolchain.
