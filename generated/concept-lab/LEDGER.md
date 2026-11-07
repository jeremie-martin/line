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
| Line: whole rail, all ink | settled as alternatives | All three are good. Whole rail suits high contrast (R5). Any look, any mode (R6). A thought, not a ruling: dark schemes may read better always inked (R6). |
| Bookends: whole course at both ends | settled | "Fantastic" (R1). The band is there from frame 0 (R4). |
| Bookend ring, larger rider | parked | Ring good at the end only. Larger rider "comically big" (R3), then out (R4). |
| Camera placement: Tamed | settled | "Significantly stronger" than Calm (R3). |
| Camera: placement height | open, parked | "Above the rider", "more about balance than space" (R6). It is its own setting (R6). Skipped in R7, so it stays at 38 %. |
| Camera: Follows direction | settled (R6) | Preferred: "great job". The rider's height follows the slope (sine squared), and the rider never climbs on screen while descending. It is independent of placement height, so test it at Tamed's height too. |
| Zoom: Steady | settled default | Kept: Steady, Looser, Out when quiet (R4). Who decides per song: "not sure yet" (R6). |
| Zoom: One breath, fitted, sections | parked | Not picked. |
| Hits: Held | settled | Preferred over Refined in whole songs (R5). Less shaky. |
| Hits: today's recipe (reference) | read in R7 | `scripts/fx_recipe.ts`: not a top-10 % gate. Almost every hit adds to a decaying, capped trauma, so an ordinary hit reaches full force and dense passages pile up. Shake ±10 px at 9 Hz on two axes plus 0.4° rotation; split 14 px sideways on the ride only; flash white 0.3. |
| Hits: driver | settled (R7) | Each hit on its own (Held's logic), not piling up. |
| Hits: shake | open (R9) | Can't tell them apart at today's size. The owner asked for a temporary ×1–×4 viewing multiplier (R8). |
| Hits: split | open (R9) | R8: halfway was mis-signed (red at the bottom); fixed. The owner asked whether the split used to touch the band and title: yes, the lab split everything until R8; production splits the ride only. |
| Hits: split (history) | | | The hit-direction split looked "way more prominent" (R7): it crosses the lines, while today's mostly runs along them. Now matched to today's average visible fringe (`splitmeasure.mjs`, ±10 % on four songs), plus a halfway option. Splits the ride only, as in production. |
| Hits: flash | settled direction (R8) | Toward the paper on the hardest hits, "by a wide margin… way better than everything else". It could open lower than 0.82. Its size also follows the hit's strength (R8). |
| Hits: punch, recoil | parked | Built in R6. Not shown, because the owner pointed at the shake. |
| Afterimage | parked | "Better implementation… adds clutter… park it" (R5). |
| Rider less split | settled (R6) | The rider keeps half its clean image through the split (R4 remark). |
| Band forms: bars, fork | settled | Bars over fork (R4). |
| Band forms: Iris, Three colours | settled, in the pool | The owner likes all four (R6). Bars with red emphasis are the strongest, then fork. Iris "crazy" in the dark drop. Three colours: the idea is fine, its colours aren't. |
| Ridge, Score, blocks… | parked or gone | Ridge "promising" (R3), then out (R4). Score out (R4). |
| Red accent logic: loudest or Heat | settled | Standing was the odd one out (R4). |
| Band height: low-middle | settled | "Between Low and Middle" (R3). |
| Top element: sun | settled where it fits | Dune's sun "so inspired, so bold"; it balances the frame (R5). The sun is an element, not part of a scheme: never judge a scheme by it (R6). Midnight's moon is bad (R6). |
| Top element: title | settled, optional per look | Same colour as the line, "tremendous". At most two lines (R5). Optional per look (R6). Line-in-front: lab only. |
| Background: plain or Whisper | settled | Tone by impact went too dark (R3). |
| Night | settled | A hand-placed cue. "Night looks amazing" (R6). |
| Drop scheme switch | settled as an idea (R6) | Loved as a proof of concept. Dune→Espresso "very good". Lagoon→Moss quite good. Hokusai→Midnight: the moon is bad. How to choose the switch comes later. |
| Grain (world-fixed paper texture) | gone (R6) | "I don't like the fine paper grain… will look bad with the YouTube encoding." |
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
| Slate | liked (R6) | The mustard accent goes well with the blue. |
| Mauve | promising (R6) | Better than Olive. Try a slightly desaturated, less pink paper. |
| Sumi | liked (R6) | Mostly for the bars and red. The paper could be better. |
| Midnight | half (R6) | The bars and accent are great. Its moon is bad (a sun issue, not a scheme issue). |
| Olive | no (R6) | The orange/red accent doesn't sit with the olive bars. |
| Bauhaus, Riso-deep, Espresso, Moss | no (R6) | Espresso's verdigris accent is "very bad", though Espresso works with Dune's accent at the drop. Moss: green paper disliked. |
| All R6 candidates | | They felt homogeneous ("is the line always near-black on purpose?"): good, not coup de cœur. The metric-led approach narrowed them. Next: a creative approach from scratch. |
| Lavender | loved (R7) | "Love it." |
| Café | loved (R7) | "Love it, extremely tasteful." |
| Ravilious | very good (R7) | The background and bars could pair better. |
| Kintsugi | very good (R7) | "Would be amazing for a drop." |
| Cahier | good (R7) | The background and bars could pair better. |
| Kraft | good (R7) | Bars, accent and line "awesome" (R7). Papers (R8): darker preferred ("much more aesthetic"); as designed and lighter also OK; less colour, almost neutral and lighter-less-colour not liked. With the lighter paper the bars are too contrasted and the white accent works less: "it's the entire theme as a whole". |
| Vegas | weaker (R7) | Like Kraft, but the background is worse. |
| Cyanotype | promising (R8) | Less colour is "way better" than as designed: lovely bar integration, accent yellow. Almost neutral very bad, lighter hated, darker "something to it". Wants handcrafted papers with a bit more colour, but integrated like less colour (R8). |
| Rothko | promising (R8) | Less colour great. Almost neutral "very elegant, especially with the bars". Darker good. Darker-less-colour too much contrast. Lighter disliked. "There is a world where the as-designed background works… how do we integrate it with the rest" (R8). |
| Backgrounds: emerging pattern (R8) | hypothesis | The paper should sit with the bars rather than fight them: quieter in colour than the bars, at a moderate lightness distance from them. Not a rule; it predicts the R8 picks and gets tested in R9. |
| Toile | no (R7) | Not enough contrast between the background and the bars. |
| Backgrounds in general | open (R7) | "We need to work on backgrounds and figure out what works to my eyes." R8 keeps a palette's line, bars and accent and moves only the paper. |
| Klein, bottle, salmon | unshown | Klein and salmon fail the band-chroma check. |

**Principle (R5):** clarity, "does it jump to my eyes". Lightness first was a weak hypothesis (7 ratings), and it made R6's candidates homogeneous. Use it to check, never to generate.

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
- Comparisons go in the lab's switcher: short labelled loops at the owner's moments, one variable at a time. 4K four-ups are only for showing finished looks (R6).
- Number the round pages; never overwrite them (R6).
- Comparisons must be fair: match the amounts when comparing directions or styles, otherwise the bigger one wins (R7).
- No jargon in questions ("blow") (R7).
- Never store a list as a joined string: picks with commas broke voting for four rounds (R8).
- Before a round goes out: `uicheck.mjs` (interaction suite, frozen questions) and `qcheck.mjs` (live questions) must pass (R9).
