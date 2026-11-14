# Concept lab (November 8, 2026)

A live browser lab for the videos' visual direction. It plays real rides with their music, and it draws them with the
production video renderer itself (`scripts/video/`): what the owner approves here is exactly what ships.
- The lab owns only the questions, the free mix, the transport and the blind intensity test (`lab.js`, `index.html`, `lab.css`).
- The picture, the camera, the looks, the palettes and the intensity metric are in `scripts/video/` (ARCHITECTURE.md, Review).
- A lab film is written by the production writer (`film.mjs`), so a film of a look is that look.
- The lab is tracked on the `visual-lab` branch.

The rides are **recompiled with the current compiler** (`recompile.sh` writes `rides/`, the songs, seeds and variants of `rides.js`; last on 8 November,
identical tracks, now with their authored beats, so aligned); `prepare.mjs` builds their scenes into `data/` with the production
scene builder. The other ride set (`rides.js`): `prepare.mjs --old` builds `data-r5/` from the round 1–5 rides (as compiled). `?rides=NAME`
plays a set; in a question, a moment, an option or the question can name one (a moment's wins), and switching options between
sets keeps the moment and the music.

Start at `morning.html`. One server serves the lab, the review pages and their APIs, and builds the renderer bundle as it starts:
`HOST=0.0.0.0 PORT=8770 npm run serve` (the lab's tools expect port 8770; the owner reviews at `http://10.77.77.1:8770/generated/concept-lab/morning.html`).

| Entry | What it is |
|---|---|
| `morning.html` | Index of all rounds. Each round page has the films and questions of its day. Rounds 1–5 keep their pages and films; their interactive snapshots were retired on 8 November (git history has them). |
| `?set=NAME&q=1` | A round's questions: the drafts of `candidates-NAME.json` (format in `lab.js`), stored in localStorage as `concept-lab-answers-NAME`. Round 51 (`closing`, `round51.mjs`) is open. Round 50 (`refine4`, `round50.mjs`) is answered; `hits.html` draws the hit curves over the measured hits (`analysis/lab-hits.json`) and `batch.html` (`batch.mjs`) forty videos as the chooser draws them. Round 49 (`master`, `round49.mjs`) is answered; its pages that used values since removed no longer open. Rounds 48 (`ideas1`, `round48.mjs`; answered, and the pages using values since removed from `scripts/video/look.js` no longer open) and 47 (`refine3`) are answered, rounds 46 (`refine2`) and 45 (`refine1`) are answered; `round47.mjs`, `round46.mjs` and `round45.mjs` write their files (`lab-colour.mjs`: colours in OKLCH, the round writer). The candidate files of rounds 29–44 were retired on 11 November (git history has them). The slider under the transport exaggerates the hit effects (a viewing aid, ×1–×4, not saved). |
| `?feel=1` | Blind test of the intensity metric. |
| `./` | The free lab: the looks (`presets.js`: Swatch, Plain and the themes), and every option of a look as a chip. |
| `system.html` | How the pieces fit: signals, elements, schemes, direction. |
| `LEDGER.md` | Every piece by layer, with its status and the owner's words. Verdicts are filed per piece, never per look. |
| `docs/` | Where we are and where we are going (`DIRECTION.md`), how decisions were reached, theme craft, the code map. |

## What a look is

`scripts/video/look.js` holds every option (`OPTIONS`), the settled defaults (`V1`), the themes (`THEMES`, the collection) and
`plain`, the compiler's review look. Each option keeps only the values production uses (11 November); the alternatives of earlier
rounds are in git history, and the reasons for each choice in `LEDGER.md`. A new round compares new colours as candidate schemes
(`?set=`), and a new option value is added to `look.js` with the drawing it needs.

| Option | v1 | Others |
|---|---|---|
| Colour (`scheme`, `palettes.js`) | graphite; each theme its own (named by its id) | the drop pairings `<light id>+<dark id>` |
| Colour response (`paper`, `grade.js`) | vibrance on the soft-start curve, the paper half | plain |
| Line | pencil → ink | whole rail; all ink |
| Lower band | per theme | bars or fork with the loudest in the accent (`accent`: heat or loudest three), Iris (thin or bold); height low-middle |
| Top of the frame | per theme | sun (the rider 32 px lower, the sun 16 px higher: round 21), title |
| At the drop | nothing | a switch to the scheme's drop partner |
| Zoom over time | steady | out when quiet |
| Opening and ending | the whole course at both ends | none |
| On each hit | split, colour boost, and a shake on strong hits (below) | nothing |

The camera is Follows direction (`camera.js`): the rider's resting point follows the direction of travel, its height the
slope's sine squared, and it never rises on screen while descending (R6–R7). Zoom 6.2, 15 % closer than the first videos.

## Hits (v1)

Each hit on its own, from its strongest frame (R23), sized by its measured strength s, with no rank and no ceiling (`picture.js`):
- **shake** (the whole frame knocked along the hit, springing back): nothing below strength 0.6, then an S-curve (like the old flash's) to 24 px at 0.85, and gently on; no camera motion otherwise (R26).
- **split:** halfway between sideways and the hit's direction, slow start from 0.3 to 12.8 px at 0.85, over the whole picture
  with its zoom pulse.
- **colour boost:** what is drawn on the paper gets more saturated and more contrasted for an instant, the paper unchanged; from 0.35, full at 0.85 (saturation +45 %, contrast +38 %), gently on (R24–R26).
- Set aside: a shake on every hit and the flash toward the paper (R7–R19), and the zoom on the rider (R24–R25).

The title gets a little less split and less pulse; the sun gets everything. The rider keeps half its clean image. The
hold-and-fade timing follows w = e^2.2. The rework of the three levers is parked (LEDGER.md, item 0).

## Intensity (`scripts/video/intensity.js`, `intensity/`)

One pure module, knowing nothing about what is drawn with it. Inputs: speed, and impact power (strength per second). Each gets
a 6 s median and σ = 1 s gaussian (zero phase), a fixed scale for every song, and a ceiling on change. `intensity/` holds the
study and the blind passages (`?feel=1`).

## Timing (`timing/`)

`ensemble.py` averages the sound around strong hits, aligned on first touch: the rise sits −6 to +10 ms from the touch on 8
songs; `attack.py` places the attack against touch, onset and strongest frame on the current rides (`docs/IMPACT-TIMING.md`).
The design that follows (`docs/TIMING-DESIGN.md`): two clocks, song and ride, one relation r = s + offset
(`scripts/video/timing.js`), and a per-ride offset from strongest frames against authored beats. A hit happens at its strongest
frame (round 23), so its effects meet the beat on average. Rides record their beats since 8 November and are aligned; the lab's
were recompiled then (24–33 ms). The compiler's −15 ms jolt (`scripts/produce/jolt.ts`) is unchanged; jolt 0 is stage 4.

## Inking

A rail inks at its furthest recorded touch or as the rider passes its right end, whichever is first. Contacts alone left
8–17 % of the course grey behind the rider.

## Signals (`analysis/`)

`characterize.py` and `signals.py` run on 22 saved rides. Neither a loudness step nor a sustained-energy span finds drops
reliably (`night.py`), so each song's drop is placed by hand (`scripts/video/drops.ts`).

## Files

- **Data:** `recompile.sh` (rides), `prepare.mjs` (scenes).
- **Films and stills:** `film.mjs` (`song=`, `c=` a look, `m=` options, `from=`, `to=`, `rides=old`, `width=`) writes through the
  production writer. `fourup.sh` and `grid12.sh` assemble films.
  `shoot.mjs` and `strip.mjs` capture stills and frame strips from the lab's shot mode.
- **Checks:**
  - `uicheck.mjs`: 76 interaction checks on a frozen question set (`?qtest=1`); must pass before a round goes out.
  - `qcheck.mjs`: walks the live questions. `check.mjs`: phone size.
  - `fingerprint.mjs`: 182 frames hashed across production (every collection theme, drop pairings, every option value, plain,
    the old rides; `analysis/fingerprint-baseline.txt`). Run it before and after a refactor and require identical outputs.
- **Reasons and history:** `LEDGER.md` and `ledger-history/`; the round pages; `agents/`, the notes and reports of every helper.
