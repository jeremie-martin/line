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
10. ~~**New benchmark**~~ (2026-10-31): built and baselined (`bench-base-20261031`, `pairs8-base-20261031`).
9. **Compiler work.** Overnight (2026-11-01): the section fallback replaced the 9-frame rule, and guides are offered, never required. Bench 716 → 739, held out 660 → 733 (16/16), stray hits −57%. Next on the list:
   - Short re-landings at speed: Trouble about half, Circus 1/24 and 0/24.
   - Geometry hygiene (G1–G4).
   - Unwanted impacts (U2, U3; guide touches on beats).
   - The measure (visibility study).
   - Benchmark fitness.

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

- A compile takes about twice as long in an eight-worker panel as alone (33 s against
  16 s). This does not affect `perf:score`, but panel throughput was never measured.
- `perf:engine` ends with a long JSON report; a one-line verdict would be easier to read.
- `perf:profile` has no rollup by stage, so stepping, registration, geometry and
  measurement must be summed by hand.
- `compare --candidate` takes commits, not saved reference names.

## From the November 7 engine and tooling review

Each is a simplification to try, kept only if a paired compile and parity allow it.

- Make one `advance` the only call that simulates, with every reader cached only.
  `rider.get()` and `ballisticState()` can still fall back to computing, so an eviction
  could replay physics uncharged. Nothing does today; this would make it impossible.
- Reduce `getRider` to what production reads, and drop the constraint padding in
  `getUpdatesAtFrame` if `artifacts.ts` and `observe.ts` confirm no one reads it.
- Ablate `outside_grid` and its bounds now that near lines make empty sweeps cheap, and
  the `motion` memo, which has no recorded gain.
- Try `IntMap` with a pool of spare buckets in place of `LineGrid`'s own table.
- Slim `perf:engine`: `--mode=engine` repeats `bench:engine`, and warmup and the slowdown
  control serve older workflows. Cwd per arm would remove file swapping.
- When TypeScript 7.1 ships its API, drop `@typescript/typescript6` from `reach`.
- Bun uses 35% less memory at equal speed. Worth revisiting if panel throughput matters.
