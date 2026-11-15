# Handoff to the compiler agent (2026-11-15)

Your branch `compiler` (the arrival law, aimed launches, quiet misses priced in proportion) is merged into
`visual-lab`. Start by bringing `compiler` up to `visual-lab` (it fast-forwards), then read the three newest entries of
`REWORK.md`.

## What changed under you

- **Gentle exits** (`arc_geometry.ts`, `EXIT_RADIUS`, `EXIT_PUSH`): from 6 frames after a catch, a support turns no
  faster than a 95 px radius and no faster than keeps the push on the rider under 0.6 px/frame² (radius ≥ speed² ÷
  0.6). The owner saw riders thrown about late in a support, off the beat, and chose this on full rides.
- **Terraces and folds are parked** (`repertoire_policy.ts` `PARKED`): out of the default repertoire, still available
  by name. Their turns sit at fixed places of a section, where the music asks for nothing.
- **A new guard in every comparison:** hard unrecorded pushes per ride (`tools/eval/measure.ts`). The impact account
  reads a renewed strike in the 6 frames after its start, so a hard turn late in a long slide escapes it. V8, 4 seeds:
  0.77 before, 0.25 with gentle exits, 0.15 with your branch merged. Keep it low; it is what the owner's eye objects to.
- **Benchmark of the merge** (V8, 4 seeds, against gentle exits alone): +1.5 [−10.0, +13.0], 33 specs up, 10 down;
  seven categories gain about 5, the long spec loses 25. Set a reference on your machine at the merge
  (`npm run compare -- reference set foundation-8 --from=<visual-lab head>`); references are local.

## Three things to close

1. **The compile stop "main construction differs at support N"** (`scripts/gallery/verify_construction.ts`). After a
   compile, each support is redrawn from its saved control and the rider's state at its frame, with only the earlier
   supports' lines in place, and must equal the lines in the track. When it does not, the ride is refused: about one
   ride in sixty on the handcrafted specs, under every compiler version tried, and a different ride each time. Nothing
   wrong reaches a video, but a ride is lost and the cause is unknown. A likely place to look: something drawn for a
   later support (or removed by a cleanup) changes what the rider does before the checked frame. Last seen at commit
   `af9206ea`: `node scripts/produce/automatic.ts --song=bones_selection --variant=second-hit --seed=303 --out=DIR`
   stops at support 35 (compile inside a worktree of that commit). It does not occur on those rides today, so first find
   one that fails now. A good pool is the handcrafted variants at seeds 101, 202, 303
   (`valhalla_40s`: still-drop, two-voices, words3-revisited; `trouble_50s`: singer, stop-go, contrast-clusters-revisited; `amor_na_praia_46s`: chord-bars, answer, heavy-kicks, v8-revisited; `bones_selection`: turn, singer, second-hit, draft-revisited; `petrunko_selection`: figure, build, low-replies, draft-revisited). Leave out Trouble `cycle` and Valhalla `phrases-climb`: the owner reserved them
   as held-out specs (`tools/eval/inputs.ts` `RESERVED_HELDOUT`). Wanted:
   the cause, and a fix or a clear statement of what the check should accept.
2. **Aimed launches under gentle exits.** They work by turning the exit, which is now limited. The merged compiler
   without them against with them, V8, 4 seeds: +2.8 [−8.3, +13.8], 22 specs up, 21 down, quiet and strong biases
   within 0.003. Measure at 16 seeds, on every row, and give the owner rides to look at. Then keep them, change them
   so they act within what a gentle exit can do, or remove them.
3. **Long floats before quiet catches** (the 108 s long spec, the calm specs). You found that a long float, a whisper
   of a catch and a steady speed cannot all hold; gentle exits add a second cost in the same place, because the old
   rides reached those floats with hard pushes late in the support (7.75 per ride on the long spec, 1.00 now). The
   owner prefers today's look there and accepts the lost air for now, but wants a better answer than the trade. The
   constraint is the guard above: the push that launches a float must be asked for (on the beat, in the hit's own
   frames) or spread so gently that it is not a push. Your own note on receivers that follow the rider's falling path
   and hand gravity over gradually points one way; a longer support before a long float is another. State the
   hypothesis first, as usual.

## Showing the owner something

`WORKING.md`, "Showing work to the owner", lists which page to use. For rides in two or more versions, write a
collection and give one link: `/motion-gallery/video-compare.html?collection=/generated/watch/NAME.json` (one player,
rides as passages with a `description` and an optional `link`, versions switched at the same moment; the format is in
`ARCHITECTURE.md`). Render rides for judging motion in the plain look (`npm run video -- --study=DIR --look=plain`).
Do not hand him lists of loose video links, and do not build a new page before checking that table.

## Not yours

Specifications and the look are being worked on `visual-lab`. The owner's idea of motion the music asks for between
hits is parked (`TODO.md`); do not start it.
