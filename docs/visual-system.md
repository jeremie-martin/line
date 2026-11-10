# The videos: how they look, and how that is decided

The project makes videos in bulk: many songs and specifications, many themes, no one choosing a look by hand. This page
says what every video has in common, how each video's look is chosen, and how the look may change. It is also the brief
for anyone, person or agent, who refines a theme or adds one.

The settled parts were each chosen by the owner, comparing versions in the lab: rounds 1 to 44, October and November 2026.
The owner's answers are kept verbatim outside the repository; commits and `REWORK.md` record what changed and why. What
the owner *likes* is not understood well enough to be written down as rules (see "What we know about taste" below), so
this page records decisions and evidence, not a theory.

## One renderer

Every picture comes from `scripts/video/`: finished videos (`npm run render`, `npm run video`), the review player, the
compiler's review clips, the lab, the collection page and the judging stills. A frame is a pure function of song time and
look (`picture.js`). Videos are 1080 × 1920, encoded once, colour-tagged, and checked: frames, size, tags, and audio within
1 ms of the song (`write.ts`). `ARCHITECTURE.md` has the modules.

## What every video has

These are fixed for all themes (`look.js` `V1`; round numbers in brackets):

- **Timing.** Song time and ride time, one offset per ride, derived from the ride's own recorded beats. A hit happens at
  its strongest frame, and everything it triggers runs from there [R23]. Contacts are compiled at the authored times; the
  old 15 ms "jolt" is gone (11 November).
- **Camera.** Follows the rider's direction, 15 % closer than the first videos, a steady zoom, and the whole course shown
  at the start and the end [R1–R7]. No camera motion except a shake on strong hits.
- **The line.** Drawn in pencil and inked as the rider passes [R1, R5]; some themes ink the whole course or the whole rail
  on first touch.
- **The music.** A band at the bottom, low-middle [R3]: bars in most themes, a fork or the Iris contour in a few. The
  hottest bars take the accent, following recent hits (heat) [R4].
- **Hits.** A colour split and a colour boost on every hit, which leave the paper and the pencil alone. A shake only on
  strong hits, from 0.6, growing to 24 px at 0.85 [R23–R26].
- **Colour follows the ride.** When the ride is intense, colour grows more vivid: vibrance on a soft-start curve, nothing
  below intensity 0.3, full at 0.9, the paper at half strength [R33–R37]. The calm part of a song is the theme exactly as
  designed. How the intensity is measured: commit 711cb0dc (round 36).
- **No names on screen.** A theme's name is never shown in a video. Only the collection's demonstration film shows names.

## The collection

`scripts/video/collection.js` holds the themes in production: 24 on 11 November, 13 dark and 11 light. Each is the exact
specification judged under its name, copied from the judging registry, with the hash that identifies it.
`tests/video_renderer.test.ts` proves that every production theme draws exactly what was judged. A theme is its colours
(ground, line, pencil, bars, hot bar, sun) plus a few choices: the band, a sun or the song title on top, how the line is
inked, and whether colour follows the ride.

**Choosing a video's look** (`choose.js`): from the ride's id, so the same ride always gets the same look.
- 75 % of videos get a light theme.
- For a light theme whose song has a drop, a drop half the time.
- These shares are the owner's starting point (11 November), not a finding.

**Drops** (`collection.js` `DROPS`, rounds 43–44): only light to dark. At the drop the picture takes a dark partner's
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

**The judging site** (`/rate/<set>`, pairwise comparisons with a Bradley–Terry fit) ranks many themes at once. It was useful
for learning what works. It is the wrong tool for fixing a theme, and it is not needed to add one.

**Judging conditions matter.**
- Colour judgments need a neutral screen. The owner's desktop runs Redshift at 3,500 K at night, which turns white grounds
  tan and greys pale blues. All of round 38 and the first answers of round 40 were made through it.
- On a neutral screen, dark against light is about even: the dark theme won 57 % of mixed pairs on desktop by day and 44 %
  on the phone, against 70 % at night.
- Remind the owner before any colour round; the phone is a good default. Judgments of form (the band, a sun, the inking)
  are less affected.

**Comparisons ask one question at a time.** A version differs in what the question is about and nothing else, and the
lab shows its name on screen. Four-up films are for showing finished looks, not for comparing.

## What we know about taste, and what we don't

Two things are measured.
- **No agent can stand in for the owner's eye.** On 40 of the owner's comparisons, held out and predicted blind, Claude
  matched 65 % [50, 78]. The rule "the darker theme wins" scores the same; where Claude departed from it, it was right 8
  times in 16. Agents propose; only the owner judges.
- **One-variable pairs in the comparisons:** a cream track instead of an orange one (Negoro), about +1.1 in strength, about
  three comparisons in four.

The rest is the owner's own words, which are decisions or observations, not laws:
- **The track is never a colour.** A coloured track "just doesn't feel right".
- **One hot note, vivid like a pigment, never neon.** It stands apart from the bars.
- **A muted theme has to be exceptional to earn its place.**
- **A new theme must bring something the collection lacks.** Themes were declined for repeating one already in.
- **Red grounds**, said through Redshift, are unconfirmed on a neutral screen.
- **Pencil is a quiet neutral, never a hue of its own.**
- **Titles are a minority** ("I like it, but don't love it").

Earlier write-ups (`generated/concept-lab/docs/TASTE.md`, `THEME-CRAFT.md`) drew correlations from a few dozen graded looks.
Read them as history, not as a recipe. The collection's best themes were found by looking, not derived.

## Parked

- **New kinds of music visualisation**, an open idea the owner raised on 11 November. Today's bars are liked.
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
