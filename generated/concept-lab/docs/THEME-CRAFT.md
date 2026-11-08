# Crafting a theme

*Toward a golden set of 18–32 hand-crafted themes. Written after round 20, from the twelve themes on Circus Minimus.*

A **theme** is a complete direction for one video: everything that isn't the ride itself. All themes share the settled v1 (camera, line behaviour, hits, opening and ending). A theme chooses only these:

| Choice | Options | Where |
|---|---|---|
| Palette | a scheme from the library | `scripts/video/palettes.js` (`SCHEMES`, `LIBRARY`) |
| Band | bars with the loudest in red, fork, Iris, Three colours | `music` (+ `redBy`) |
| Top of the frame | nothing, the title, the sun | `top` |
| Line | pencil → ink, whole rail, all ink | `ink` |
| The drop | nothing, Night, a switch to a partner scheme | `night` (+ `DROPS`) |
| Zoom over time | steady, out when quiet | `tide` |
| Paper | Whisper, plain | `bg` |

A theme is an entry of `THEMES` in `scripts/video/look.js`: a few options on top of `V1`, which supplies everything else. The lab shows each one, and `npm run video -- --look=NAME` ships it.

## The rules we've learned

### Palette
- **Take a proven combination, don't invent one.** Wada's dictionary was "a complete game-changer". A palette is a Wada combination (or one of our loved ones) with its colours assigned to roles: paper, ink (the line), mass (the bars), accent (the loudest bars), plus a sun if it has one.
- **The bars carry more colour than the paper.** Light papers are quietened to chroma about 0.02–0.03.
- **The paper differs in hue from the bars.** Warm bars on ice blue or celadon, cool bars on blush. A pale paper in the bars' own hue looks weak.
- **A mid-tone paper turned near-neutral looks dead.** A dark near-neutral paper is elegant.
- **The accent stands apart from the bars in lightness, not only in hue.** Warm accents over cool or neutral bars work repeatedly.
- **The line must read on a phone.** Strong lightness contrast with the paper; colour alone does not survive YouTube's encoding.
- **The sun is not part of a palette:** never judge a palette by its sun.

### Band
- Bars with the loudest in red are the strongest preference. Fork and Iris add variety: Iris is "crazy" in the dark, faint on mid-dark plum. A fork on a pale paper is delicate (Wisteria).
- Three colours: the idea is liked, its colours are not yet.

### Top of the frame
- **The title:** the song's name in the line's colour, two lines at most, "maybe not all the time". It suits quiet papers (Paper, Prussian, Plum, Old Rose).
- **The sun:** a bold disc that balances the frame (Dune: "so inspired"). It takes the palette's sun colour or its accent. With a sun, the rider sits 32 px lower and the sun 16 px higher (round 21; `sunRider`, `sunLift`).
- One top element at a time.

### Line
- Pencil → ink is the default on light papers. **Dark palettes are inked from the start** (round 21: all ink over whole rail over pencil → ink; Old Rose: "definitely", R12). Whole rail stays an option.

### The drop
- **Night** for the classic (Paper).
- **A switch to a darker partner from the same family**, carrying the accent and the sun: Dune → Espresso ("very good"), Aubergine → its own night (both from Wada combination 307).
- Partners are in `DROPS`. The cue is placed by hand from the spec's sections; Circus Minimus runs from the hook to the re-entry.
- Use it sparingly: three of twelve themes in round 20.

### Balance across a set
- Mix light and dark (7 and 5 in round 20). Spread the top elements (four titles, three suns, five with nothing). Vary the band forms, and keep any one palette family from dominating.

## The twelve themes of round 20, as worked examples

| Theme | Palette | Band | Top | Line | Drop | Why it works |
|---|---|---|---|---|---|---|
| Paper Night | graphite | fork, loudest in red | title | pencil → ink | Night | The classic: elegant white and graphite, Night at the drop |
| Hokusai | hokusai | bars, heat | sun | pencil → ink | (eases out when quiet) | Washi and indigo with a red sun: a loved, iconic look |
| Dune to Espresso | dune | bars | sun | pencil → ink | switch to Espresso | Sand turns to coffee at the drop, keeping its sun |
| Prussian | Wada 343 | bars | title | pencil → ink | – | Ivory with a deep teal band: "super elegant" |
| Celadon | Wada 171 | bars | sun | pencil → ink | – | Maroon bars on celadon; the marigold sun echoes the accent |
| Aubergine | Wada 307 | bars | – | pencil → ink | its own night | Lilac to wine-black, from one combination |
| Wisteria | Wada 197 | fork | – | pencil → ink | – (plain paper) | The quietest: a violet fork on near-white |
| Black Iris | black | Iris | – | all ink | – | Iris lives in the dark (whole rail until R21) |
| Plum | plum | bars | title | all ink | – | Lilac bars and amber on plum |
| Old Rose | Wada 265 | bars | title | all ink | – | "So freaking elegant" |
| Ultramarine | Wada 295 | bars | – | all ink | – | A pure blue band on violet-black (whole rail until R21) |
| Aconite | Wada 344 | bars | – | all ink | – | Midnight and aconite violet |

From the contact sheet, two choices moved: Iris went from Plum, where it was faint, to Black, and Ultramarine's barely visible fork became bars.

## Adding a theme

1. Pick a palette from the library (`love` first), or derive a new one from a Wada combination with the palette rules above.
2. Choose its band, top element, line and drop for the palette's character, not in isolation. Ask whether it reads clearly on a phone, and whether it is distinct from the themes already in the set.
3. Add it as a `t-*` look in `PRESETS`, with a one-line description of why it works.
4. Look at a contact sheet with the rest of the set, at two moments (one inside the drop), and adjust.
5. Render it in a multi-panel film with its neighbours (`films7.sh`, `grid12.sh`), and watch the whole song.
