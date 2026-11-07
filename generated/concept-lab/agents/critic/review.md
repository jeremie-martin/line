# Concept lab: critic review (2026-11-03)

I reviewed `lab.js`, `index.html` and `lab.css`, and rendered the 8 presets at 11 moments: quiet (Lua 25 s QUIET, LOS 10 s), dense (Petrunko 17.95 ROLL, LOS 21 RAPID PICKUP), section changes (Petrunko 11.55, Lua 29.7, LOS 23.95) and strong hits (Petrunko 45.62, LOS 48.27, Lua 40.15). I also rendered marks and inking at close framing.
- Montages: `agents/critic/m-*.png` (preset order: today, ride, score, skyline, chapters, inking, marks, together).
- Shorts safe-zone overlays: `m-safezones.png`.
- Measurement scripts: `sync.mjs` and `outliers.mjs`.

**Overall:** "Ride first" plus close framing is the right base. Song score is the only new idea with real potential. Skyline, Marks and wide Inking should go. The lab does not yet solve the problem it was built for, which is the empty vertical frame. It also compares the new presets against a "Today" that has had its accents removed.

## Ranked changes (most valuable first)

### 1. Solve the empty vertical frame. No preset currently does.
In every close preset the rider sits at about 0.40–0.47 H. The lower 50% of the frame is blank paper. Score uses only a strip at 8–20% H.

The emptiness is measurable. A rider-centred estimate at close zoom finds no track line anywhere in view in:
- about 22% of Petrunko frames;
- about 11% of Lua frames;
- about 5% of LOS frames.

In those frames the rider floats on white with nowhere to land. The rider is on screen-left and the next landing is usually below-right and off-frame.

Concrete changes:
- Use a zoom between today and close: `z ≈ Z0*1.35`, rider about 1/8 of the width.
- Remove the `*0.5` on the vertical lead in `camera()`, and set `ay ≈ 0.38 H`. Downhill landings then come into view before they happen.
- Give the music layer a home in the **lower-middle band, 0.62–0.82 H**. That is above the 15% UI zone and is where today's bars already work.

Judge success by "is there always something to read below the rider", not by how a single still looks.

### 2. Put hit accents on one clock, and add one crisp accent at the rider.
**Clock.** The score fills at the overlay time (`actualTime`). The native contact onset, where the drawn rider touches the line, is earlier in almost all cases:

| Offset from overlay time | Hits (of 277) |
|---|---|
| 1 frame (25 ms) early | 193 |
| 2 frames (50 ms) early | 33 |
| 3 frames (75 ms) early | 6 |
| 6 frames early (LOS 23.925, a graze then the hit) | 1 |
| on time | 44 |

At 60 fps, 1–3 frames early is 1.5–4.5 video frames. Every visual event should key off the **native contact onset frame**, the one already used for mark positions. The same frame-step check should also confirm which clock matches the audio. Do not let the score, marks and rider each use a different time.

**Accent.** No candidate preset has a hit accent near the rider. The only hit event is a small dot filling in the top-left corner, so the eye has to split between the corner and the rider. The owner said accents "may be bold when they happen" and must clear completely. Suggested accent:
- the contacted segment flashes to about 2× ink weight;
- plus a short source-coloured tick or burst at the contact point;
- both gone within about 150 ms.

The existing `rings` option (500 ms, outline) is close to this; shorten it and make it a preset.

### 3. Make Song score a real candidate (currently too small, line-like and ambiguous).
At phone size the dots are 3–6 pt and the strokes are under 1 pt.

- **Size.** Double the dot radius (8+10s → about 18+20s) and the strip height. The connecting polyline is drawn at 16% alpha. Remove it: it is exactly the "music drawn as a line the rider could ride" the owner flagged.
- **Markers.** The now-line and the section-boundary ticks are near-identical grey verticals. In the LOS 21 s frame there are three, and the eye cannot tell which one is "now". Show sections as a gap or a faint band behind the strip, and make the now-marker distinct.
- **Density.** LOS RAPID PICKUP has 0.125 s gaps, which is 22 px at 175 px/s, smaller than a dot. Dots overlap into a smear. Raise px/s or shrink dots by local density.
- **Colour.** It mostly carries no information:

| Song | Drums | Vocals | Bass | Other |
|---|---|---|---|---|
| Petrunko | 67 | — | — | 12 |
| Lua | 80 | 8 | 1 | 1 |
| LOS | 82 | 26 | — | — |

  The four-colour legend promises amber bass, which appears once in three songs. Either encode strength with one accent hue (monochrome ink plus one colour) or keep source colour and drop the legend claim. In `prepare.py`, "other" is also the fallback when no spec time is within 60 ms, so teal can mean "unmatched".
- **Placement (worth trying).** Put the now-column at the rider's smoothed screen x so that "fill" and "land" sit in one glance. This becomes viable once item 1 places the strip in the lower band.
- **Labelling.** Height is the *measured* strength, not the spec's asked strength, and values below 0.25 clamp to the floor (LOS has 0.128). Say "measured" in the preset caption so the owner does not read it as his spec.

### 4. Bring back the spectra the owner actually liked. Drop Skyline.
The owner liked Cobalt, tuning fork, mirrored spectra and the flowing, continuous lower Iris. The lab offers only today's bars and Skyline.

Skyline is the weakest preset:
- its mass sits mostly inside the bottom-15% Shorts UI zone (see `m-safezones.png`);
- it reads as a soft grey-blue atmospheric field, the "Aurora" kind of thing he disliked.

Replace it with 2–3 ports of the liked spectra as `music` options in the lower band from item 1. Then the score is compared against the best existing answer, not against a straw man.

### 5. Make the "Today" baseline honest.
"Today" leaves out the shake, RGB split and white flash. Every candidate therefore looks calmer only because the reference lost its accents. That would mislead the owner.

Either:
- add today's accent (even approximated), or
- rename it "Today, no accents" and add a "Today, as shipped" entry that links to the real film at the same moment.

### 6. Chapters: give the colour a meaning, or drop it.
- **No meaning.** The tint cycles by index through 6 colours. Petrunko has 8 sections, so DECAY gets the same tint as UPPER FIGURE.
- **Too faint, and pink/green read as dirty.** The tints differ by a few RGB levels. On a phone, pink `#f8edf1` and green `#e7f3ee` read as off-white, close to the "not quite white" paper the owner rejected.
- **Boundaries are correct.** The colour changes at `t0` with a 0.45 s ease.

If chapters stay:
- derive the tint from the section's `air`/`speed`, for example a cooler, lighter tint for high air and a slightly deeper cool grey for fast sections;
- keep to the cool family only;
- or carry the section on the score band instead of the whole paper.

### 7. Inking and Marks: keep the useful part and drop the rest.
- **Wide framing is the wrong zoom.** Wide (`Z0*0.62`) makes the rider about 1/16 of the width, smaller than today. That goes directly against the finding that the frame is already too empty.
- **Pencil is unreadable on a phone.** At wide zoom, pencil lines are about 1.6 px grey.
- **The concept does not survive close framing.** The inked history leaves the frame within about 0.2–0.3 s, so you mostly see grey track (`m-closeink.png`).
- **Marks can't land either.** They are world-anchored, so they leave just as fast. At close zoom a mark appears 160–260 px behind the rider.

**Keep:** the pencil/ink split as a decluttering device at the item-1 zoom. Untouched guide rails drawn pale remove the black "dotted debris" rails visible ahead of the rider (LOS 48.27, Petrunko today).

**Drop:** Marks as a preset.

### 8. Review experience on a phone.
- **Preset switching.** The preset chips are below the fold (`phone.png`), so switching means scrolling away from the stage. Put a single horizontal chip strip directly under the stage. Swipe left/right on the stage changes preset; tap plays or pauses.
- **Size.** The stage is about 80% of a real Short (313×557 on a 390-wide phone). Add a full-screen/true-size toggle.
- **Safe zones.** Add a "Shorts UI" overlay toggle covering the bottom 15% and right 12%.
- **Moments.** Add 4 chips per song (quiet / dense / section change / big hit) and a 4 s A–B loop. The owner already said synchronized loops are what he wants.
- **Context outside the frame.** Under the stage, show the current section name and the next hit (time, measured/asked strength, source). This is UI, not video text, and it lets him judge chapters and sync.
- **Verdicts.** Add keep / maybe / drop and a note per preset × song, saved in localStorage, with a "copy all" button. Otherwise his verdicts arrive as long transcripts again.
- **Hint text.** Hide the keyboard hint on touch devices.

### 9. Small correctness items
- **Opening frame.** With the lead camera, at t = 0 the rider is off-screen left (x = −38 px Petrunko, −41 Lua, −27 LOS) for the first ~0.1 s. That is the first frame of a Short. Ramp the lead in from zero.
- **"Together" caption.** "My current pick" is the lab author's opinion. Keep it, but it should not be the default preset a busy owner lands on before seeing Today and Ride first.
