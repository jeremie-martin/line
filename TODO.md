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
9. **Compiler work.** Short re-landings fixed: a 9-frame rule on 2026-10-31, replaced overnight by a section fallback with no threshold (held-out 16/16). Next on the list:
   - Short re-landings at speed: Trouble about half, Circus 1/24 and 0/24.
   - Geometry hygiene (G1–G4).
   - Unwanted impacts (U2, U3; guide touches on beats).
   - The measure (visibility study).
   - Benchmark fitness.
