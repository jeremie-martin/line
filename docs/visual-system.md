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
- **Camera.** Follows the rider's direction, and shows the whole course at the start and at the end, so a video loops from
  its last frame to its first: the ending and the opening are one gesture, up to the course, over it and back down, cut a
  little after its widest view (`ENDS` in `camera.js`; tuned and measured on `/generated/concept-lab/ends.html`). The sun and the title give way to the whole course there;
  the band stays from the first frame to the last.
- **The loop.** A video is made to be played in a loop, and one idea holds it together: the widest view of the
  ending is where the video turns from its end to its start.
  - *Picture.* Rising to that view, the ink returns to pencil and the colours go to the opening's; past it,
    everything drawn is the ride's first moment under the camera's way down (`frameAt.turned`, `picture.js`). So the
    last frame is the first frame: camera, course, rider, colours, sun or title. Only the band stays on the clock.
    A hit's split, boost and movement fade as the camera rises: they belong to the ride's view.
  - *Sound.* A video plays its song's looping recording (`scripts/video/loop_audio.ts`). It ends where the music is
    in step with what leads into its start: up to 3 s before the excerpt's end, where the rhythm of its last six
    seconds matches the rhythm of the full recording's lead-in to the excerpt (the excerpts were cut at round
    seconds, not on a bar line); where nothing matches clearly it ends as cut. Its last half second then fades into
    that lead-in, so the first sample continues it. The video is as long as this recording. A song with no lead-in
    (it starts where its recording starts, or it has no `source.json`, or its full recording is not on this
    machine) ends as cut and fades out over the half second. `tools/music/source.ts` finds an excerpt in its full
    recording and writes that record; recordings are looked for in `recordings/` and in the music library.
  - *Band.* Analysed on that recording as a loop (`make_spectrum.py --loop`), so it is continuous across the cut.
- **Zoom.** Written for the song, not derived from the ride: a song may carry a few zoom lanes
  (`productions/<song>/zooms.ts`), each following one thing in its music, and each video gets one of them from its
  ride's id. A lane is a few points saying how wide the picture is, on one scale shared by every song (0 closest, 1
  widest, the widest showing about 1.37 times more than the closest; never stretched to a lane's own range). The two ends
  are two numbers in `scripts/video/zoom.js`: the magnification at the closest (1.10) and at the widest (0.805), against the
  camera's base picture. `/generated/concept-lab/zoom-range.html` tries other ends on a playing ride. A song without
  lanes keeps one steady zoom, the middle of the scale. The hit movement keeps its size against the scene. No
  camera motion except the movement at strong hits.
- **The line.** Drawn in pencil and inked as the rider passes; some themes ink the whole course or the whole rail on first
  touch.
- **The music.** A band at the bottom, low-middle: bars in most themes, a fork or the Iris contour in a few. The hottest
  bars take the accent, following recent hits.
- **Hits.** A colour split and a colour boost on every hit, which leave the paper and the pencil alone. The split moves
  red into the surface that was hit and blue the opposite way. On strong hits
  the picture also moves: a shake knocks it into the surface that was hit (from strength 0.55, 14 px at 0.85), and
  **carry** moves it back out and lets it settle over about a second (from 0.5, 100 px at 0.85), as if the camera
  carried on for a moment when the rider was stopped. Every amount follows the measured strength of the hit, never the
  spec. In the opening and ending the movement shrinks with the picture.
- **Colour follows the ride.** When the ride is intense, colour grows more vivid: nothing below intensity 0.3, full at
  0.9, the paper at half strength. The calm part of a song is the theme exactly as designed.

## The collection

`scripts/video/collection.js` holds the themes in production, dark and light. Each is the exact specification the owner
chose, with the hash that identifies it.
`tests/video_renderer.test.ts` proves that every production theme draws exactly what was judged. A theme is its colours
(ground, line, pencil, bars, hot bar, sun) plus a few choices: the band, a sun or the song title on top, how the line is
inked, and whether colour follows the ride.

**Choosing a video's look** (`choose.js`): from the ride's id, so the same ride always gets the same look.
- Half of the videos get a light theme, half a dark one.
- Themes too alike to tell apart in a batch (`collection.js` `ALIKE`) are drawn as one, then one of them is picked.
- A theme with approved variants (`VARIANTS`: stars around the moon, a crescent, dots, strands) shows one a quarter of
  the time. `generated/concept-lab/batch.html` shows forty videos drawn this way at three light shares.
- For a light theme whose song has a drop, a drop half the time.
- One of the song's zoom lanes, each equally often (`chooseZoom`).
- On the dark themes picked for it (`collection.js` `LIT`), the whole band takes the hot colour on hits of 0.65 or more,
  while the band is bars. Themes whose hot colour is red or no lighter than their bars are left out: there the band seems to darken.

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
| `scripts/video/choose.js` | a video's theme, drop and zoom lane |
| `scripts/video/zoom.js`, `zooms.ts` | the zoom scale and keyframes; the songs' lanes |
| `scripts/video/palettes.js` | colour schemes; the collection's are named by theme id, pairings `<light id>+<dark id>` |
| `scripts/video/theme.js`, `grade.js` | a frame's colours: drop switch, then the colour response to intensity |
| `scripts/produce/render_repertoire.ts` | a batch: every valid ride of a study, each with its chosen look and a record |
| `generated/concept-lab/` | the lab (`index.html`, `lab.js`), the collection page, the judging site (`rate/`) |

## Films for showing the project

Two tools, both built on ordinary videos so the picture is production's:

- **A showcase** (`generated/concept-lab/showcase.mjs`): one ride with the theme changing on the music. `cuts=T:THEME,…`
  names each change in song seconds; each part is a video of that theme over its span, and the parts are joined without
  re-encoding. What made the Tiki film work, by the owner's reaction: cuts on the spec's own phrase beats (every eight
  beats, every four toward the end of a drop); light themes outside the drops and dark ones inside; only themes with a
  sun or a moon, so the rider and the band hold their place across every cut; no near-duplicate themes; no names on
  screen.
- **Then and now** (`generated/concept-lab/then-and-now/`): two videos side by side at their full size under a frame
  (`frame.py`: ground and rounded windows; `join.ts`). The word on the new video is a caption drawn by the renderer in
  the theme's ink (`--caption`, `scripts/video/caption.js`), so it follows every change of theme; the word on a video
  the renderer did not draw is the same caption as a picture (`caption.mjs`).

A video that goes into a composition is written as a lossless master (`--master=yes`, `showcase.mjs master=yes`) and
encoded once, in the composition. Never shrink or re-encode an encoded video: the first then-and-now did both and showed
bands on flat colour. Before handing a composition over, compare a still with its master and look at a brightened flat
area.

## The hit movement: how it was found, and how to change it

`docs/research/hit-movement-20261115.md` is the record. The owner missed the weight of older videos; measuring showed
that today's camera holds the rider still at a hit, and comparing versions led to carry. To change the movement, open
`/generated/concept-lab/hit-move.html`: the song plays with the production response held or beside, the curves of
strength are drawn with every hit of the song on them, and the settings can be dragged and saved. The production values
are `MOVEMENT` in `scripts/video/hits.js`; the page opens on them. `/generated/concept-lab/hits.html` draws every hit
curve. A page that tunes the movement hands the picture its own settings (`createPicture`'s last argument); everything else
is production's. The split (red into the surface) is `split` in `hits.js` and `split.js`.

## Writing a song's zoom lanes

A lane is a reading of the song, like a spec: a few moves that each have a reason in the music, holding still otherwise.
Two or three lanes per song, each following a different thing (Petrunko: the build, its tension, the bars the bass
answers). A spec holds no camera: the zoom is the song's lanes (`productions/<song>/zooms.ts`), and the hit movement
keeps its size against the scene at any zoom. Nothing goes in the last three seconds.

**How to write one.**

1. Read the song: its `music.ts` or `composition.json` (sections, what leads where), the idea of its production spec,
   and `python3 tools/music/lead_ins.py SONG`, which prints the recording's level over the song and the three seconds
   before every section change. A lead-in (a fill, a pause where the drums stop, a swell, a pickup) shows as the level
   changing before the bar line. The tool measures; the author decides.
2. Decide what each lane follows, in one sentence, before placing a point. That sentence is the lane's `about`.
3. Place each move in the music's own lead-in, by hand, song by song. A shift applied to every lane alike is not a
   reading; use one only for a small correction the owner asked for everywhere.
4. Run `prepare-rides.mjs` and look at the lanes on `/generated/concept-lab/zoom.html`; the owner marks them there
   (love, keep, unsure, cut, a note per lane and per song, his own version if he moves points). Marks are in
   `labels/studies/zoom-2026-11b.jsonl`; those on the first set, with his first notes, in `zoom-2026-11.jsonl`.
   `npm run video -- … --zoom=ID` renders one lane.

**What the owner's marks and notes have taught so far** (two rounds on 2026-11-16, about a dozen songs heard). He
asked that these stay a direction to weigh, not rules; each is given with what it rests on.

- **The most intense passages are not the closest.** Wide where the song is full, near where it is exposed. (His
  statement before any lane was written; every lane he has kept follows it.)
- **A move belongs to the lead-in, not to the moment after.** A zoom-out centred on a drop reads as late: half of it
  happens after the hit. He asked for Believer's opening "before the huge drop, not right after" and said the point
  applies to other songs. The second set, written this way, he found "much better overall".
- **A sharp zoom-out ends a touch inside the sound it arrives for,** about a tenth of a second after the sound starts,
  not exactly on it ("let's not overdo it"). Smoother moves can sit a little later still. (His notes on Tiki and Amor
  na Praia.)
- **Smooth long shapes are the base; a sharp move is for a moment that earns it.** He prefers the smoother lanes "with
  maybe a few relatively sharp stuff when it makes sense": a clear expression of the music.
- **A gimmick works as one event inside a clean lane,** not as the lane. Petrunko's lean-in for the bass is kept;
  Believer's breath at every stop was "more confusing than anything". There is little room for a zoom-in gimmick when
  the picture is already at the steady zoom or nearer.
- **The size of a move matches the size of the event.** No Batidão slowed has no big drop, so its dramatic pull-back
  was wrong, while the same idea on the faster version, where the bass really arrives, is the one lane he has marked
  love. Versions of one song need their own sizes.
- **Be careful with sharp zoom-ins.** A zoom-out reads as the picture opening; a fast zoom-in reads oddly, "almost the
  radar that becomes bigger". Not forbidden; today's lanes let a zoom-in take about a second per tenth of the scale.
  A move must also sit on something: a zoom-out on no event (Trouble, 45.5 s) was "a bit weird".
- **Not yet known:** what a good lane is for a song with a long quiet middle (both first lanes of Lua na Praça were
  unsure, with no note), and how many of the unheard songs hold up.

A formula over sections or over a signal such as intensity carries no intention, and the lanes that came closest to
one (a step at every section, the same shape copied across versions of a song) are the ones he marked down.
