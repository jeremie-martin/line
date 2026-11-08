# Ledger: what is decided, what is open, and why

The current state of every piece of the visual direction after rounds 1–19 (7 November 2026), by layer (see `system.html`):
- **signals:** what is true about the ride and the song;
- **elements:** the instruments;
- **schemes:** colours only;
- **direction:** the choices for one video.

A look (Paper, Hokusai…) is only a saved direction. The owner's verdicts are filed per piece, never per look.

**The settled v1 is `V1` in `scripts/video/look.js`** (since 8 November also production's renderer). It is the single source of truth for the defaults; this file gives the reasons. Formulas are in `scripts/video/picture.js` (the hit curves) and `camera.js` (Follows direction). Palettes are in `scripts/video/palettes.js`.

Statuses:
- **v1:** in the defaults.
- **kept:** chosen, for some looks or as an alternative.
- **open:** still being decided.
- **parked:** kept in code, not used; rejecting an execution is not rejecting the idea.
- **gone:** rejected.

Round numbers (R1–R19) say when the owner said it. The full previous ledger, with every intermediate step, is `ledger-history/LEDGER-r19.md`. The rounds' own pages are `round*/morning.html` and `round6.html`–`round19.html`, and the answers are in the memory notes and `agents/clarify-answers-r6.md`.

## v1 at a glance

| Part | v1 | Rounds |
|---|---|---|
| Camera | Follows direction: the rider's height follows the slope it rides and never climbs on screen while descending. Median height 38 %. 15 % closer. Steady zoom. | R3–R7 |
| Opening and ending | The whole course at both ends; the band there from the first frame | R1, R4 |
| Line | Pencil → ink, inked as the rider passes | R1, R5 |
| Band | Low-middle. Bars with the loudest in red (heat logic) in the questions; looks choose their form | R3–R6 |
| Hits: driver | Each hit on its own, from what the ride actually did (measured strength and onset); no rank, no top-N | R7–R10 |
| Hits: shake | The thud, straight from 0 at strength 0.2 to 24 px at 0.85, and on (no ceiling) | R9, R13, R15 |
| Hits: split | Halfway between sideways and the hit's direction. A slow start from 0.3 to 12.8 px at 0.85, and on. Over the whole picture, the band too, with its zoom pulse | R8–R18 |
| Hits: flash | Toward the paper: an S-curve from 0.6 to 25 % at 0.85, then gently on (about 29 % at 1.0) | R8–R17 |
| Hits: title | A little less split, and less pulse. The sun keeps everything | R15–R19 |
| Hits: rider | Keeps half its clean image through the split | R4, R12 |
| Background | Whisper (a faint tint with intensity) | R3–R4 |
| Top of the frame | Optional per look: the song title (two lines at most, in the line's colour), or the sun where it fits | R4–R6 |
| Colours | Wada's Dictionary of Color Combinations as the method, plus a tiered library (below) | R10–R12 |
| Night | A hand-placed drop cue | R2–R6 |

## Signals

| Piece | Status | The owner's words and notes |
|---|---|---|
| Hit strength (measured, absolute) | v1 | Drives every hit effect, never a rank (R1, R5: "adapt to the actual values… the top 20 % could be very small"). A calm song gets less: "Yes, that's right" (R6). Measured from the ride, never the spec's target (confirmed R11). |
| Hit moment (measured) | v1 | A hit happens at its strongest frame: its effects start there (R23, "C is the best… clearly"), pushed along the line struck at its onset. |
| Intensity (speed + impact, `intensity.js`) | v1, used lightly | A clean standalone metric (R3). Blind test: direction right 8/8, size not shown. It drives Whisper, the sun and Out when quiet. |
| Drop cue (hand-placed, `scripts/video/drops.ts`) | v1 | Detectors failed twice; one hand cue per song. **Open:** where Night *ends* was never reviewed song by song ("I'm not entirely convinced when the night was removed", R4). |
| Rider direction and slope | v1 | Feeds Follows direction. |
| Sections | gone as a driver | Hand placement still welcome (R2). |
| Hit source (drums, vocals…) | parked | "Source should not drive this" (R4). |
| Timing between music, contacts and visuals | v1 (R23) | Each ride aligned from its own hits: its strongest frames meet the authored beats on average (24–33 ms on the lab rides), and the effects start there (`docs/TIMING-DESIGN.md`). The jolt to 0 is the compiler's stage 4. Earlier: "Later felt too late, no fixed offsets" (R4); "calibrate… characterise… under control" (R6). |

## Elements

### Camera
| Piece | Status | Notes |
|---|---|---|
| Follows direction | v1 | "Great job" (R6). False climbs 0 s/min against Tamed's 1.8 and today's 5.1 (`camstats.mjs`). |
| Height 38 % | v1 | The owner skipped the height question (R7); "above the rider… more about balance than space" (R5–R6). |
| Tamed, Higher, steep-ride drop, Looser, official | kept as options | Tamed was v1 in R3–R5. The narrow steep-ride rule climbed back (R6). |
| Zoom: steady | v1 | Kept: Steady, Looser, Out when quiet (R4). **Open:** who decides the zoom per song: "not sure yet" (R6). |
| Zoom: one breath, fitted | parked | Not picked. |
| Grain (world-fixed paper texture) | gone | "Will look bad with the YouTube encoding" (R6). |

### Line
| Piece | Status | Notes |
|---|---|---|
| Pencil → ink | v1 | "Absolutely amazed" (R1). Inks as the rider passes, so no grey is left behind (R5). |
| Whole rail, all ink | kept | All three are good; any look, any mode (R5–R6). Whole rail suits high contrast. Old Rose: all ink, "definitely" (R12). Dark palettes are inked from the start (R21: all ink, then whole rail, then pencil → ink; "for now, this is what we use… we can easily just put it back"). |
| Line in front of the title | parked | The line is behind the title; the in-front rim stays a lab option (R6). |

### Band
| Piece | Status | Notes |
|---|---|---|
| Bars with the loudest in red | v1 | The strongest preference (R6). |
| Fork, Iris, Three colours | kept in the pool | The owner likes all four (R6). Iris is "crazy" in the dark drop. Three colours: the idea is fine, its colours aren't. |
| Accent logic: heat or loudest | v1 | Standing was the odd one out (R4). |
| Height: low-middle | v1 | "Between Low and Middle" (R3), chosen when the rider sat at about 43 %. **Open:** re-check against the rider's 38 %. |
| Ridge, Score, blocks | gone | R3–R4. |

### Hits
| Piece | Status | Notes |
|---|---|---|
| By parts, each hit on its own | v1 | Today's shipped recipe was read in R7: almost every hit at full force, piling up. That is not a top-10 % gate. The owner chose each hit on its own (R7). |
| Shake: thud, straight to 24 px, no ceiling | v1 | Chosen with the ×1–×4 viewing aid (R9). Straight from zero (R13). "The shake of the rider was great" (R17). 28/32 px tried, not picked (R14). |
| Split: halfway, slow start from 0.3, no ceiling | v1 | Halfway (R9), matched to today's average fringe (R8, `splitmeasure.mjs`). In pixels, not as a percentage of today's (R15). The slow start from 0.3 liked, with a wish for a little more between 0.4 and 0.6; the softer slow start was offered in R16, skipped. **Open, minor.** |
| Split over everything, with its pulse | v1 | "I love the effect on the band… on everything except the title… I love it on the sun" (R18). |
| Title: a little less split, less pulse | v1 | "A little less" (R16); "less" pulse (R19). The sun is untouched (R19). |
| Flash: toward the paper, 25 % at 0.85, gently on | v1 | Toward the paper "by a wide margin" (R8). No ceiling, but not 50 %: about 25 % at 0.8–0.85, around 30 % at 1.0 (R15–R17). "Shifted right" (R17). |
| Rider half-clean through the split | v1 | "Slightly less split" (R4), restored in R12. |
| Today's recipe, Held, Refined, the hit bench | kept as options | References and earlier rounds. |
| Punch, recoil, bloom, radial split | parked | Built R6–R8, not chosen. The punch's successor, the zoom (R24–R25), rejected: deleted. |
| Afterimage | parked | "Better implementation… adds clutter… park it" (R5). |

### Top of the frame, background, drop
| Piece | Status | Notes |
|---|---|---|
| Title | v1, optional per look | In the line's colour, "tremendous"; two lines at most (R5); optional (R6). |
| Sun | kept where it fits | Dune's sun "so inspired, so bold"; it balances the frame (R5). An element, not part of a scheme (R6). Midnight's moon: bad. |
| Background: Whisper or plain | v1 | Tone by impact went too dark (R3). |
| Night | v1 | A hand cue; "Night looks amazing" (R6). |
| Drop scheme switch | kept as an idea | A cut to a darker partner at the cue; the accent and sun carry over. Dune→Espresso "very good" (R6). How to choose the partner: **open, later**. |
| Vignette | parked | Off (R4). |
| Lyrics | parked | "For now just the title" (R6). |
| Ring, larger rider (bookends) | parked | R3–R4. |

## Schemes and the palette library

**Method:** Sanzo Wada's *Dictionary of Color Combinations*: "a complete game-changer… the method is validated" (R10). Each palette is a proven combination, assigned to our roles (paper, line, bars, accent) with what the owner's verdicts taught. That method is at its best now; the R11 owner: "no point trying to understand the patterns any more… let's just try stuff". Earlier lessons still hold:
- clarity matters;
- the bars carry more colour than the paper;
- the paper differs in hue from the bars;
- a mid-tone paper made near-neutral looks dead;
- an accent stands apart from the bars in lightness;
- lightness-first generation made candidates homogeneous (R6), so it is used to check, never to generate.

**Library** (`LIBRARY` in `scripts/video/palettes.js`, the latest verdict per palette), for sampling and weighting later:
- **love:** graphite, hokusai, black, dune, plum, lavender; Wada: Prussian, Magenta, Ultramarine, Old Rose, Celadon, Aubergine, Wisteria, Seashell, Aconite.
- **good:** cafe, kraft (darker paper, R9), cyanotype (less colour, R9) with its indigo and deep siblings, rothko (less colour) and rothkoNeutral, lagoon, slate, sumi, ravilious, cahier, kintsugi (for a drop); Wada: Brick (accent fixed, R11), Orchid, Russet, Gilt, Etruscan (accent fixed, R12), Peony, Umber, Hydrangea, Heather, Cobalt, Carmine, Apricot, Grenadine, Aubergine's night.
- **works (not a favourite):** Verdigris, Denim, Viridian, Indigo Teal, Camellia (accent fixed, R12), Blush, Pansy, Saxe, Heather's night, mauve, midnight, vegas.
- **out:** riso and risoDeep, olive, bauhaus, espresso (except as Dune's drop), moss, toile, klein, bottle, salmon.

**Per palette:** Old Rose uses all ink.

## Direction (per video): mostly open

| Piece | Status | Notes |
|---|---|---|
| Looks: Paper, Hokusai, Black | kept | The owner would post them (R5). Built before the R7–R19 hit work, so they now carry the v1 hits. |
| How a song gets its look | open | No full random. Cohesive, weighted toward favourites (the library), a few hand hints. Never biased automatically from sound analysis (R5). |
| Per-song hints | open | The drop cue today; maybe zoom and tone. The spec must not dictate (R5). |
| Variety across uploads | open | Raised in `system.html`. |
| Themes demo (R20) | shown | Twelve complete directions on Circus Minimus, using its latest spec **voice-drums**; `spec.ts` still points to the older pairs3 (`t-*` looks, `films7.sh`, `grid12.sh`, `fourup/r20/circus-themes.mp4`). A showcase toward a theme generator, not settled looks. Circus Minimus's drop cue (37.6–49.6 s) is a guess from the music's energy. |
| Zoom per song | open | "Not sure yet" (R6). |

## Open items, in one place

0. **The hit effects, rethought (rounds 24–26, open).** One table, `picture.js` RECIPES, `look.hits`: `v1` (today: shake, split, flash), `noMotion` (split, colour boost; the frame never moves), `shakeFrom60` and `shakeFrom70` (the same, with the shake on strong hits only, on the flash's S-curve from 0.6 to 24 px at 0.85, or from 0.7 to 24 px at 0.9). Plain names: **shake**, **split**, **flash** (toward the paper), **colour boost** (what is drawn on the paper more saturated and contrasted; the paper unchanged). R25: no camera motion is "a complete game changer" for clarity, and wins on Circus "by a wide margin"; but on the strongest hit today's feels better. **The zoom is rejected (twice: the punch R6–R8, the zoom R24–R25): "I hate seeing the rider become bigger and then smaller… all the geometry".** Round 26 asks whether the strongest hits keep a shake, and from what strength. The lab's "Exaggerate the hit effects" slider is a viewing aid (×1–×4, never in a look). The owner's words that led there (8 November, "should come somewhat soon"): "We have three levers: the camera shake, the split and the flash."
   - **Shake versus pulse:** when the owner spoke of shake, they often meant the **pulse**, the zoom. "The shake makes everything a bit less readable, while a punch, a zoom in or out, may be clearer. We could use both."
   - **Flash:** "play with the vibrance, the saturation, some other effect than the literal flash to the background, or a combination."
   - Plan: rework the flash, the shake and the pulse later, with the curve-first method of R12–R17.

1. Where Night ends, song by song (R4). Rule since R20: cues are placed by hand from the spec's sections (Circus Minimus: the HOOK's first impact at 38.5 s to the RE-ENTRY hit at 51.3 s).
1b. ~~With a sun~~ (R21): the rider 32 px lower, the sun 16 px higher.
2. ~~The layout as a whole~~ (R22): A, as now: the band low-middle, the rider as today; with a sun, the rider 32 px lower and the sun 16 px higher. The other layouts stay as options (`riderLower`, `bandHeight`, `sunLift`).
3. ~~Whether all dark palettes should be inked~~ (R21): yes, all ink.
4. A little more split between 0.4 and 0.6 (R15; the R16 question was skipped).
5. Zoom per song, and the direction layer: how looks are chosen, hints, variety (R5–R6).
6. ~~Timing between music and contacts~~ (R23): aligned rides, effects at the strongest frame (`docs/TIMING-DESIGN.md`). Left: the jolt to 0 (compiler, stage 4).
7. Whole films of v1: not watched since R6. All judgements since have been on loops.
8. Since 8 November, any look can ship: `npm run video -- --study=DIR --look=THEME` draws exactly what the lab shows. Nothing has been published in the v1 look yet.

## How to work

- Separate idea, driver and execution (R2–R3). Keep behaviour and logic separate.
- Whole films decide; loops are provisional (R4).
- Ask before building on a guess, and push back in writing.
- Commit and push always (R6).
- Comparisons go in the lab's switcher: short labelled loops at the owner's moments, one variable at a time. 4K multi-panel films are for showing finished looks (R6).
- Comparisons must be fair: match the amounts when comparing directions or styles (R7).
- Curves before motion when tuning a response (R12).
- No jargon in questions (R7).
- Number the round pages; never overwrite them (R6).
- Never store a list as a joined string (R8).
- Before a round goes out, `uicheck.mjs` and `qcheck.mjs` must pass (R9). A cleanup must keep the rendering byte-identical (frame fingerprints, R20).
