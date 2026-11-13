# The videos: how they look, and how that is decided

The project makes videos in bulk: many songs and specifications, many themes, no one choosing a look by hand. This page
says what every video has in common, how each video's look is chosen, and how the look may change. It is also the brief
for anyone, person or agent, who refines a theme or adds one.

Every settled part was chosen by the owner, comparing versions in the lab. What the owner *likes* is not understood well
enough to be written down as rules (see "What we know about taste" below), so this page records decisions, not a theory.

## One renderer

Every picture comes from `scripts/video/`: finished videos (`npm run render`, `npm run video`), the review player, the
compiler's review clips, the lab, the collection page and the judging stills. A frame is a pure function of song time and
look (`picture.js`). Videos are 1080 × 1920, encoded once, colour-tagged, and checked: frames, size, tags, and audio within
1 ms of the song (`write.ts`). `ARCHITECTURE.md` has the modules.

## What every video has

These are fixed for all themes (`look.js` `V1`):

- **Timing.** Song time and ride time, one offset per ride, derived from the ride's own recorded beats. A hit happens at
  its strongest frame, and everything it triggers runs from there.
- **Camera.** Follows the rider's direction at a steady zoom, and shows the whole course at the start and the end. No
  camera motion except a shake on strong hits.
- **The line.** Drawn in pencil and inked as the rider passes; some themes ink the whole course or the whole rail on first
  touch.
- **The music.** A band at the bottom, low-middle: bars in most themes, a fork or the Iris contour in a few. The hottest
  bars take the accent, following recent hits.
- **Hits.** A colour split and a colour boost on every hit, which leave the paper and the pencil alone. A shake only on
  strong hits, from 0.6, growing to 24 px at 0.85.
- **Colour follows the ride.** When the ride is intense, colour grows more vivid: nothing below intensity 0.3, full at
  0.9, the paper at half strength. The calm part of a song is the theme exactly as designed.

## The collection

`scripts/video/collection.js` holds the themes in production, dark and light. Each is the exact specification the owner
chose, with the hash that identifies it.
`tests/video_renderer.test.ts` proves that every production theme draws exactly what was judged. A theme is its colours
(ground, line, pencil, bars, hot bar, sun) plus a few choices: the band, a sun or the song title on top, how the line is
inked, and whether colour follows the ride.

**Choosing a video's look** (`choose.js`): from the ride's id, so the same ride always gets the same look.
- 75 % of videos get a light theme.
- For a light theme whose song has a drop, a drop half the time.
- These shares are a starting point, not a finding.

**Drops** (`collection.js` `DROPS`): only light to dark. At the drop the picture takes a dark partner's
colours and keeps the light theme's layout, hot note and sun, so nothing moves and the sun never appears or leaves. Each
light theme lists the partners the owner kept, with weights. Paper Print's pure black and white exists only as a drop
partner (`DROP_ONLY`).

**Seeing it:** `/collection` on the review server draws every theme live on any of the lab's eight rides, opens one large
with its colours and choices, and plays a light theme through its drop with any of its partners.

## Changing the look

**A theme is its full specification; change one colour and it is another theme.** It gets a new name. The judging
registry (`generated/concept-lab/rate/themes.jsonl`) binds each name to one specification for good.

**To refine a theme or add one:**
1. Work in the lab: one page per theme, the theme as it is and a few clearly different versions, played as video at the
   same moments, switched live. Many themes per round is fine; one theme per page.
2. The owner picks, grades and writes notes. Iterate a page once or twice, in steps of a few percent once close. Stop when
   the owner would ship it.
3. Freeze the chosen version (`rate/freeze.mjs`: a draft with its scheme and a new name), add its registry entry to
   `collection.js`, and update the theme count in the test. Render its stills by name and check them against the frozen
   ones.

**Judging conditions matter.**
- Colour judgments need a neutral screen. The owner's desktop runs Redshift at 3,500 K at night, which turns white grounds
  tan and greys pale blues, so judgments made through it don't hold.
- Remind the owner before any colour round; the phone is a good default. Judgments of form (the band, a sun, the inking)
  are less affected.

**What a page compares depends on the request.** To settle one point (this bar colour or that one), the versions differ in
that point only. To explore ("a blue theme with some green", or "something is off in this one, I can't say what"), the
versions may differ freely: ten different takes are fine. Each version shows its name on screen.

## What we know about taste, and what we don't

**No agent can stand in for the owner's eye.** Asked to predict 40 of the owner's comparisons blind, Claude matched 65 %,
no better than the rule "the darker theme wins". Agents propose; only the owner judges.

The rest is what the owner has said so far. These are observations and defaults, not laws:
- **The track is a neutral by default,** not a colour. A cream track beat an orange one clearly. A dark navy or similar is
  possible if the owner asks for it.
- **One hot note, vivid like a pigment, never neon.** It stands apart from the bars.
- **No ground that is too red.** None has been liked.
- **The pencil line** (the track before the rider inks it) **is a quiet neutral,** not a hue of its own.
- **The song title on top suits few themes.** Most carry a sun or nothing.

The collection's best themes were found by looking, not derived from rules.

## Parked

- **New kinds of music visualisation.** Today's bars are liked.
- **The collection page's lag.**
- **Batch scheduling**, ordering and parallelism for overnight runs.
- **The shares in `choose.js`**, to be tuned once many videos exist.

## Where things live

| | |
|---|---|
| `scripts/video/look.js` | look options, `V1`, `THEMES` (built from the collection), `PLAIN` for review clips |
| `scripts/video/collection.js` | the themes in production, `DROPS`, `DROP_ONLY` |
| `scripts/video/choose.js` | a video's theme and drop |
| `scripts/video/palettes.js` | colour schemes; the collection's are named by theme id, pairings `<light id>+<dark id>` |
| `scripts/video/theme.js`, `grade.js` | a frame's colours: drop switch, then the colour response to intensity |
| `scripts/produce/render_repertoire.ts` | a batch: every valid ride of a study, each with its chosen look and a record |
| `generated/concept-lab/` | the lab (`index.html`, `lab.js`), the collection page, the judging site (`rate/`) |
