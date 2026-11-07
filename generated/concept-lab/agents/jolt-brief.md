# Brief: timing between the music, the contacts and the visuals

This is for the compiler track: the agent working on `rework/foundations`. It was written by the visual-lab session on 2026-11-07 at the owner's request. The owner wants this **understood and under control**, and doesn't care in which direction it comes out.

## The owner's questions (2026-11-07, paraphrased closely)

- What exactly is "the impact": the first touchdown, or the most impactful frame?
- What should drive the visuals, and what should the compiler aim at?
- Should contacts be synchronised to the **music onset** rather than to the first touchdown? If we sync to the beat, does a fixed jolt make any sense?
- It "affects what we see and feel the most", so calibrate, investigate, characterise and measure before changing anything.

## What the code does today

`scripts/produce/jolt.ts` sets `contact time = authored time − ms/1000`, with a default of **−15 ms**, so contacts are aimed 15 ms *after* the authored time. The owner chose this by ear in June, from 0 / −15 / −25 ms on one song (Tiki). `LR_JOLT_OFFSET_MS` overrides it. The physics runs at 40 fps, so a contact is quantised to 25 ms frames.

## What the lab measured (rounds 4–5, on 8 songs, rides from before the recent compiler changes)

These are time-locked averages of the audio around every strong hit, with no onset detector involved. Scripts are in `generated/concept-lab/timing/` (`ensemble.py` is the reliable one); my flux detector misread one song by about 60 ms, so don't use it.

| Moment | Relative to the rider's first touch |
|---|---|
| The sound's rise (half-way up) | −6 to +10 ms on every song |
| The measured hit time in the saved record | +25 ms, exactly one physics frame |
| The impact's peak | +25 ms typically; +50 ms or later on about 30 % of hits |

So, on average, the first touch already coincides with the audible rise of the sound, within one 60 fps video frame. These averages say nothing about the spread of individual hits.

The lab fires visual accents at the first touch. Since touch and sound rise agree within about 16 ms, "sync to the touch" and "sync to the music onset" are currently the same anchor for the visuals.

## What looks worth doing on the compiler side (not done, and the owner hasn't decided)

1. **Characterise the per-hit error, not only the mean:** touch minus sound rise for every hit on the current panel, with its spread, and whether it varies with impact strength, tempo or "catch" type.
2. **Decide the target explicitly:** the authored time is a music onset; the target is the first touch. The −15 ms constant compensates for something real, either the onset analysis marking the onset early or the physics' frame quantisation. Find out which.
3. **If a replacement is tested:** aim each contact at that hit's measured sound rise, with no constant. Run it as a paired comparison with a stated hypothesis, per `WORKING.md`, and with the owner judging by ear, as in June.
4. Re-run the lab's measurement on the recompiled rides. They are in `generated/concept-lab/rides/` (`recompile.sh`), and `prepare.py` bundles them.
