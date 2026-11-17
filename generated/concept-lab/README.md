# Concept lab

The pages where the look of the videos is judged and tuned with the owner. Every page draws real rides with their music
through the production renderer (`scripts/video/`), so what is approved here is what a video shows. How the look works
is in [`docs/visual-system.md`](../../docs/visual-system.md); which page to use for what is in `WORKING.md`.

One server serves everything: `HOST=0.0.0.0 PORT=8770 npm run serve`.

## Pages in use

| page | what it is for | answers |
|---|---|---|
| `closing/decisions.html`, `closing/songs.html` | every open decision on one board, every song on another (`closing/decisions.json` holds the decisions; `closing/prepare.mjs` refreshes both) | `labels/studies/closing-2026-11.jsonl` |
| `closing/specs.html` | the second set of specifications (Codex) against each song's current spec: versions switched at the same moment, a mark and a note with video times per song (`generated/watch/astra.json` lists the videos) | `labels/studies/astra-2026-11.jsonl` |
| `closing/cuts.html` | the 30 to 45 seconds of each song that become its short video: the song's loudness and sections, proposed cuts, two handles to drag, the cut played as a loop, and its loop match (`closing/prepare-cuts.mjs` makes its data; proposals in `closing/cuts-a.json`, `cuts-b.json`) | `labels/studies/cuts-2026-11.jsonl` |
| `zoom.html` | a song's zoom lanes on its ride: marks, notes, the owner's own version | `labels/studies/zoom-2026-11b.jsonl` |
| `ends.html` | the loop of a video, camera and sound: the last seconds into the first without a gap, on sliders, with proposals, charts and a choice of sound (`prepare-loops.mjs` makes its recordings; `seam-videos.mjs` renders the last seconds into the first as videos) | `labels/studies/bookends-2026-11.jsonl` |
| `hit-move.html`, `hits.html` | the movement at a hit, on dials; every hit of the rides against the curves | `labels/studies/hit-curve-2026-11.jsonl` |
| `trim-video.html` | how much unused track is trimmed, the same ride in every version | `labels/studies/trim-2026-11.jsonl` |
| `/rate/` (`rate/`) | judging themes: sort and duel, frozen sets | `rate/` data |
| `/collection` (`collection/`) | the themes in production | – |
| `batch.html` | forty videos' looks at three shares of light themes | – |
| `./` (`index.html`, `lab.js`) | the free lab: any look, any option, on the lab's rides | – |

The tuning pages play one ride per song from `generated/lab-rides/` (`prepare-rides.mjs SONG@DIR …`; run it again after
editing a song's lanes).

## Tools

- `showcase.mjs`: one ride with the theme changing on the music. `then-and-now/`: two videos side by side
  (docs/visual-system.md, "Films for showing the project").
- `film.mjs`: a film of a look on a lab ride, through the production writer. `stills.mjs`: stills for the judging site.
- `fingerprint.mjs`: frames hashed across every theme, pairing and option value. Run it before and after a change to the
  renderer that must not move a pixel.
- `uicheck.mjs`: interaction checks of the lab's question mode.

## The record

- `LEDGER.md`: every piece of the look by layer, with its status and the owner's words.
- `docs/`: direction, how decisions were reached, theme craft, taste, timing.
- The round pages (`morning.html`, `round*.html`, `candidates-*.json`, `films*.json`) and `agents/` are the archive of
  the judging rounds. Nothing in production reads them.
