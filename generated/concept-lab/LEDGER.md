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
| Hits: responses | R18 defaults: shake straight to 24 px (kept), flash shifted right (25 % at 0.85, gently on), title a little less | R17: "it was the title that was moving too much… the shake of the rider was great". Cause: the split's overscan zoomed the whole picture about 3 %, so the title in its corner jumped up to 15 px. R18 offers no pulse, or a pulse on the ride only. Earlier: R17 defaults | R16: "a little less of impact" meant less shake: "this is moving too much". Flash: better, but grow a little slower or shift right ~0.05, 25 % around 0.85. Split question skipped, so it stays on the slow start from 0.3. Earlier: R16 defaults | R15: show the split in px, not as % of today's (it looks different). Liked the slow start from 0.3 but wants more split between 0.4 and 0.6. Title: "a little less". Flash: keeps rising, but about 25 % at 0.8 and around 30 % at 1.0, not 50 %. Earlier: R15: each part on its own curve, no ceiling | "I don't want this plateau… if there is a very rare, very powerful hit, let's go for it" (R14). Shake: straight to 24 px, continuing. Split: ends at the 24 px level; near zero below about 0.4 (curve open, R15). Flash: 0.55 → 25 % chosen (R14); a rising version without ceiling is open (R15). Title and sun: "a little less" split, consistent (R15). Earlier: settled (R13): straight, to 24 px; ride-only bigger shake open (R14) | R13: "I like C the best… open to push to 28", unsure how the band would look. R14: the shake (ride only) at 28 or 32 px while the split stays. Earlier: open (R13): straight lines | R12 curves: "start from zero… grow, some shake quite soon… something simple, linear… same for the split". R13 offers straight lines to 15, 20 or 24 px. Earlier: ×1.5 chosen (R11), curve open (R12). Favourite: ×1.5. Curious about something between it and fuller ×1.5. Asked for response curves (R12 page). Default now ×1.5, steep curve. Earlier: | Your set preferred over today's, but should be stronger, the split too (R10). Driven by realised impacts, confirmed. R11 tests a fuller curve and ×1.5. |
| Hits: split coverage | settled (R11): the band too | Earlier: | The owner preferred the split over the whole UI, band, title and sun, well integrated (R10). |
| Hits: the chosen set | settled (R9) | Thud shake, halfway split, flash toward the paper from strength 0.80, each hit on its own. The default in every look since R9. |
| Hits: shake | settled (R9) | Thud. Chosen with the ×1–×4 viewing aid. |
| Hits: split | settled (R9) | Halfway between sideways and the hit's direction, matched to today's average amount. Earlier: | R8: halfway was mis-signed (red at the bottom); fixed. The owner asked whether the split used to touch the band and title: yes, the lab split everything until R8; production splits the ride only. |
| Hits: split (history) | | | The hit-direction split looked "way more prominent" (R7): it crosses the lines, while today's mostly runs along them. Now matched to today's average visible fringe (`splitmeasure.mjs`, ±10 % on four songs), plus a halfway option. Splits the ride only, as in production. |
| Hits: flash | gentle from 0.6 to 30 % default (R13); frequency open (R14) | R13: prefers from 0.6, and suggested 0.55→25 % and 0.5→20 %. Gentle from 0.6 touches about 39 hits a minute faintly and 20 clearly, against 3 clear for R9's sharp one, so R14 adds 0.7→30 % (7 clear a minute). Earlier: open (R13): gentle | R12 curves: the rise is too sharp; "from about 0.5 a slow rise, then basically a sigmoid". R13 offers 0.5→0.85 and 0.6→0.85. Earlier: settled (R9), Toward the paper, opening at strength 0.80 ("let's go for 0.8"). Earlier: | Toward the paper on the hardest hits, "by a wide margin… way better than everything else". It could open lower than 0.82. Its size also follows the hit's strength (R8). |
| Hits: punch, recoil | parked | Built in R6. Not shown, because the owner pointed at the shake. |
| Afterimage | parked | "Better implementation… adds clutter… park it" (R5). |
| Rider less split | settled (R6), restored (R12) | Lost when the hits moved to parts in R9; restored after the R12 defaults audit. Earlier: | The rider keeps half its clean image through the split (R4 remark). |
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
| Kraft | settled (R9): darker paper | "B is the most elegant and aesthetically pleasing." Lighter paper with lighter bars is "correct, but the accent is questionable (maybe something red-ish?)". Earlier: | Bars, accent and line "awesome" (R7). Papers (R8): darker preferred ("much more aesthetic"); as designed and lighter also OK; less colour, almost neutral and lighter-less-colour not liked. With the lighter paper the bars are too contrasted and the white accent works less: "it's the entire theme as a whole". |
| Vegas | weaker (R7) | Like Kraft, but the background is worse. |
| Cyanotype | settled (R9): less colour; siblings indigo and deep | "A little more colour" at the bars' hue doesn't work with the bars. Indigo is good, not the absolute favourite. "It's mostly about the integration… we haven't nailed down the magic." Earlier: | Less colour is "way better" than as designed: lovely bar integration, accent yellow. Almost neutral very bad, lighter hated, darker "something to it". Wants handcrafted papers with a bit more colour, but integrated like less colour (R8). |
| Rothko | settled (R9): less colour; sibling neutral | Less colour and almost neutral liked a lot, darker fine. The original paper with re-tuned bars is not elegant. Earlier: | Less colour great. Almost neutral "very elegant, especially with the bars". Darker good. Darker-less-colour too much contrast. Lighter disliked. "There is a world where the as-designed background works… how do we integrate it with the rest" (R8). |
| Colour method: Wada's dictionary | validated (R10) | "A complete game-changer… one or two orders of magnitude better… the method is validated." Loved: Prussian, Ultramarine, Old Rose, Magenta; Brick's accent too close to the paper (fixed in R11). Wanted: more light papers than cream. Pass 2 (R11): the paper must differ in hue from the bars. Details: | Twelve finalists (`w*` schemes) from 103 combinations that fit the rules; 40 rendered, 12 kept by eye. The rules held: Wada's light colours only work as paper once quietened to about C .02–.03; mid-tone greens and lilacs look like coloured card. |
| Colour method: Wada's dictionary (origin) | | The owner: "maybe we don't have to reinvent the wheel… colour pickers that combine palettes, analogous, complementary". Building from Sanzo Wada's *Dictionary of Color Combinations* (348 proven combinations, open data), assigning colours to our roles with the rules learned here (`agents/wada`). |
| Backgrounds: emerging pattern (R8) | hypothesis, partly held (R9) | Bars carry more colour than the paper: held. Mid-tone papers made neutral look dead, while dark neutral papers are elegant. More colour at the bars' own hue breaks the integration; a small hue shift can work. | The paper should sit with the bars rather than fight them: quieter in colour than the bars, at a moderate lightness distance from them. Not a rule; it predicts the R8 picks and gets tested in R9. |
| Toile | no (R7) | Not enough contrast between the background and the bars. |
| Backgrounds in general | open (R7) | "We need to work on backgrounds and figure out what works to my eyes." R8 keeps a palette's line, bars and accent and moves only the paper. |
| Klein, bottle, salmon | unshown | Klein and salmon fail the band-chroma check. |

**Principle (R5):** clarity, "does it jump to my eyes". Lightness first was a weak hypothesis (7 ratings), and it made R6's candidates homogeneous. Use it to check, never to generate.

## Open items surfaced by the R12 defaults audit

- **When Night ends:** "I'm not entirely convinced when the night was removed… for all the music" (R4). The end times of `NIGHTS` were never reviewed song by song.
- **Timing (jolt):** "Later felt too late, no fixed offsets" (R4); "we probably want to at least work on this, calibrate… characterise" (R6). This is the compiler track's work; the brief is `agents/jolt-brief.md`.
- **Band height against the new rider height:** low-middle was chosen in R3 to balance Tamed at about 43 %. The rider now sits at 38 %, and the pair hasn't been re-checked.
- **Dark palettes always inked:** a thought in R6. R12: Old Rose "definitely" all ink, but not sure about all dark palettes. Recorded per palette.

## Palette library (R12)

The owner's latest verdict per scheme, for sampling and weighting later. It mirrors `LIBRARY` in `lab.js`. Rows above give the words.

- **Per-palette line mode:** wOldRose → all ink (R12).
- **love:** graphite, hokusai, black, dune, plum, lavender, wPrussian, wMagenta, wUltramarine, wOldRose, w2Celadon, w2Aubergine, w2Wisteria, w2Seashell, w2Aconite
- **good:** cafe, kraft, cyanotype, cyanotypeIndigo, cyanotypeDeep, rothko, rothkoNeutral, lagoon, slate, sumi, ravilious, cahier, kintsugi, wBrick, wOrchid, wRusset, wGilt, w2Etruscan, w2Peony, w2Umber, w2Hydrangea, w2Heather, w2Cobalt, w2Carmine, w2Apricot, w2Grenadine, w2AubergineNight
- **works:** wVerdigris, wDenim, wViridian, wIndigoTeal, w2Camellia, w2Blush, w2Pansy, w2Saxe, w2HeatherNight, mauve, midnight, vegas
- **out:** riso, risoDeep, olive, bauhaus, espresso, moss, toile, klein, bottle, salmon, cyanotype~a

The owner (R11): "No point trying to understand the patterns any more… we can produce so many high-quality ones; let's just try stuff", and "note which ones I absolutely like most and which are good enough… for the library, sampling, combining".

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
