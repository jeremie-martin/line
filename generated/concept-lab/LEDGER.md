# Ledger: every piece, its status, and the owner's words

Pieces are filed by layer (see `system.html`):
- **signals:** what is true about the ride and the song;
- **elements:** the instruments;
- **schemes:** colours only;
- **direction:** the choices for one video.

A look (Paper, Hokusai…) is only a saved direction. Verdicts about a look are split into the pieces they were really about.

Status: **settled** (in v1) · **open** (being decided) · **parked** (kept in code, not used; rejecting an execution is not rejecting the idea) · **gone**.

Round numbers (R1–R6) say when the owner said it. Quotes are the owner's words, from the transcript export.

## Signals

| Piece | Status | Notes |
|---|---|---|
| Hit strength (measured, absolute) | settled | Drives every hit accent. Never a rank or top-N (R1, R5: "adapt to the actual values… the top 20 % could be very small"). A calm song gets less (R6: "Yes, that's right"). |
| Intensity (speed + impact, `intensity.js`) | settled, used lightly | A clean standalone metric (R3). Blind test: direction right (8/8), size not shown. Drives Whisper, the sun and Out when quiet. |
| Drop cue (hand-placed, `NIGHTS`) | settled | Detectors failed twice. One hand cue per song. |
| Rider direction and slope | open (R6) | Feeds the Follows direction camera. |
| Sections as a driver | gone as a default | Hand placement still welcome (R2). |
| Hit source (drums, vocals…) | parked | "Source should not drive this" (R4). |

## Elements

| Piece | Status | Owner's words and notes |
|---|---|---|
| Line: pencil → ink | settled | "Absolutely amazed" (R1). Inks as the rider passes, so no grey is left behind (R5). |
| Line: whole rail, all ink | settled as alternatives | All three are good. Whole rail suits high contrast (R5). Any look, any mode (R6). |
| Bookends: whole course at both ends | settled | "Fantastic" (R1). The band is there from frame 0 (R4). |
| Bookend ring, larger rider | parked | Ring good at the end only. Larger rider "comically big" (R3), then out (R4). |
| Camera placement: Tamed | settled | "Significantly stronger" than Calm (R3). |
| Camera: rider higher | open (R6) | "Above the rider", "more about balance than space" (R6). |
| Camera: steep descents | open (R6) | Los 24.95 and 28.58 s: generic, measurable, "super clean, easy, lean" (R6). Follows direction plus grain are tested. |
| Zoom: Steady | settled default | Kept: Steady, Looser, Out when quiet (R4). Who decides per song: "not sure yet" (R6). |
| Zoom: One breath, fitted, sections | parked | Not picked. |
| Hits: Held | settled | Preferred over Refined in whole songs (R5). Less shaky. |
| Hits: the "oh yeah" on the biggest | open (R6) | "Mostly the shake… all three together… only on the impact." Today's top-10 % gate was "a terrible idea" (R6). |
| Hits: punch, recoil | parked | Built in R6. Not shown, because the owner pointed at the shake. |
| Afterimage | parked | "Better implementation… adds clutter… park it" (R5). |
| Rider less split | settled (R6) | The rider keeps half its clean image through the split (R4 remark). |
| Band forms: bars, fork | settled | Bars over fork (R4). |
| Band forms: Iris, Three colours | open (R6) | "Should stay" (R1–R2). Shown again in R6. |
| Ridge, Score, blocks… | parked or gone | Ridge "promising" (R3), then out (R4). Score out (R4). |
| Red accent logic: loudest or Heat | settled | Standing was the odd one out (R4). |
| Band height: low-middle | settled | "Between Low and Middle" (R3). |
| Top element: sun | settled where the scheme has one | Dune's sun "so inspired, so bold"; it balances the frame (R5). |
| Top element: title | settled, optional per look | Same colour as the line, "tremendous". At most two lines (R5). Optional per look (R6). Line-in-front: lab only. |
| Background: plain or Whisper | settled | Tone by impact went too dark (R3). |
| Night | settled | A hand-placed cue. "Night looks amazing" (R6). |
| Drop scheme switch | open (R6) | "Try a scheme switch… not just invert… intentional, limited" (R5–R6). |
| Grain (world-fixed paper texture) | open (R6) | A motion cue on plain paper. Untested after compression. |
| Vignette | parked | Off by default (R4). |
| Lyrics | parked | Deferred: "for now just the title" (R6). |

## Schemes

| Scheme | Status | Owner's words and notes |
|---|---|---|
| Graphite and red | settled | 5/5 (R5). "Very elegant." |
| Hokusai | settled | 5/5. "The colours look very nice." The owner loves many details of the look (R4); which ones was never asked. |
| Black | settled | 5/5. "Super elegant." |
| Dune | settled | 5/5. "So inspired, so bold." |
| Plum | settled | 3.5, then "so freaking good… wouldn't change it too much" (R5). Shown again in R6. |
| Lagoon | open | 4/5. Judged with the afterimage, so never seen alone. Ink deepened slightly (R6). |
| Riso | open, as a test | 3.5, "less clear, more aggressive". R6 shows a deeper-ink version to test whether lightness was the cause. |
| Slate, olive, mauve, sumi, bauhaus, midnight, espresso, moss | open (R6) | Lightness-first candidates (`agents/colour-r6`). The owner wants 10–20 hand-tuned schemes in all. |
| Klein, bottle, salmon | unshown | Klein and salmon fail the band-chroma check. |

**Principle (R5):** clarity, "does it jump to my eyes". Lightness first is the working hypothesis. The measurement is a guide, not a goal.

## Direction (per video)

| Piece | Status | Notes |
|---|---|---|
| Looks: Paper, Hokusai, Black | settled | The owner would post them (R5). |
| How a song gets its look | later | No full random. Cohesive, weighted toward favourites, a few hand hints. Never biased automatically from sound analysis (R5). |
| Per-song hints | later | The drop cue today. Maybe zoom and tone. The spec must not dictate (R5). |
| Variety across uploads | not yet discussed | Raised in `system.html`. |

## How to work

- Separate idea, driver and execution (R2–R3).
- Whole films decide; loops are provisional (R4).
- Ask before building on a guess.
- Push back in writing.
- Commit and push always (R6).
