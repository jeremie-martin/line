# Concept lab (November 8, 2026)

A live browser lab for the videos' visual direction. It plays real rides with their music, and it draws them with the
production video renderer itself (`scripts/video/`): what the owner approves here is exactly what ships.
- The lab owns only the questions, the free mix, the transport and the blind intensity test (`lab.js`, `index.html`, `lab.css`).
- The picture, the camera, the looks, the palettes and the intensity metric are in `scripts/video/` (ARCHITECTURE.md, Review).
- A lab film is written by the production writer (`film.mjs`), so a film of a look is that look.
- The lab is tracked on the `visual-lab` branch.

The rides are **recompiled with the current compiler** (`recompile.sh` writes `rides/`, same songs and seeds); `prepare.mjs`
builds their scenes into `data/` with the production scene builder. `prepare.mjs --old` builds `data-r5/` from the round 1–5
rides, which `?rides=old` (or a question moment marked `old`) plays.

Start at `morning.html` (served by `npm run serve`):

| Entry | What it is |
|---|---|
| `morning.html` | Index of all rounds. Each round page has the films and questions of its day. Rounds 1–5 keep their pages and films; their interactive snapshots were retired on 8 November (git history has them). |
| `?q=1` | The current round's questions (round 21: four), stored in localStorage as `concept-lab-answers-r21` (`STORE` in `lab.js`). |
| `?feel=1` | Blind test of the intensity metric. |
| `./` | The free lab: the looks (`presets.js`: Swatch, Plain and the themes), and every option of a look as a chip. |
| `system.html` | How the pieces fit: signals, elements, schemes, direction. |
| `LEDGER.md` | Every piece by layer, with its status and the owner's words. Verdicts are filed per piece, never per look. |
| `docs/` | Where we are and where we are going (`DIRECTION.md`), how decisions were reached, theme craft, the code map. |

## What a look is

`scripts/video/look.js` holds every option (`OPTIONS`), the settled defaults (`V1`), the themes (`THEMES`) and `plain`, the
compiler's review look. The reasons for each choice are in `LEDGER.md`.

| Option | v1 | Others |
|---|---|---|
| Colour (`scheme`, `palettes.js`) | per theme; library tiers in `LIBRARY` | about 90 schemes: our own, Wada pass 1 (`w*`) and pass 2 (`w2*`), paper and theme variants (`name~x`) |
| Paper | Whisper (tints very slightly with the intensity) | plain |
| Line | pencil → ink | whole rail; all ink |
| Lower band | per theme | bars or fork with the loudest in the accent (`accent`: heat or loudest three), Iris; height low, low-middle (v1), middle |
| Top of the frame | per theme | sun (its height and the rider's with it: round 21), title |
| At the drop | per theme | Night; a switch to the scheme's drop partner |
| Zoom over time | steady | out when quiet |
| Opening and ending | the whole course at both ends | none |
| On each hit | shake, colour split and flash (below) | nothing |

The camera is Follows direction (`camera.js`): the rider's resting point follows the direction of travel, its height the
slope's sine squared, and it never rises on screen while descending (R6–R7). Zoom 6.2, 15 % closer than the first videos.

## Hits (v1)

Each hit on its own, from its first touch, sized by its measured strength s, with no rank and no ceiling (`picture.js`):
- **shake:** a thud, straight from 0 at s 0.2 to 24 px at 0.85, then on.
- **split:** halfway between sideways and the hit's direction, slow start from 0.3 to 12.8 px at 0.85, over the whole picture
  with its zoom pulse.
- **flash:** toward the paper on screen (Night's included), S-curve from 0.6 to 25 % at 0.85, then gently on.

The title gets a little less split and less pulse; the sun gets everything. The rider keeps half its clean image. The
hold-and-fade timing follows w = e^2.2. The rework of the three levers is parked (LEDGER.md, item 0).

## Intensity (`scripts/video/intensity.js`, `intensity/`)

One pure module, knowing nothing about what is drawn with it. Inputs: speed, and impact power (strength per second). Each gets
a 6 s median and σ = 1 s gaussian (zero phase), a fixed scale for every song, and a ceiling on change. `intensity/` holds the
study and the blind passages (`?feel=1`).

## Timing (`timing/`)

`ensemble.py` averages the sound around strong hits, aligned on first touch: the rise sits −6 to +10 ms from the touch on 8
songs. The lab's films and the finished videos are on one clock (song seconds; the audio is checked within 1 ms). The compiler's
−15 ms jolt (`scripts/produce/jolt.ts`) is unchanged, to be judged again by ear.

## Inking

A rail inks at its furthest recorded touch or as the rider passes its right end, whichever is first. Contacts alone left
8–17 % of the course grey behind the rider.

## Signals (`analysis/`)

`characterize.py` and `signals.py` run on 22 saved rides. Neither a loudness step nor a sustained-energy span finds drops
reliably (`night.py`), so each song's drop is placed by hand (`scripts/video/drops.ts`).

## Files

- **Data:** `recompile.sh` (rides), `prepare.mjs` (scenes).
- **Films and stills:** `film.mjs` (`song=`, `c=` a look, `m=` options, `from=`, `to=`, `rides=old`, `width=`) writes through the
  production writer; `films7.sh` writes the round-20 themes. `fourup.sh` and `grid12.sh` assemble films.
  `shoot.mjs` and `strip.mjs` capture stills and frame strips from the lab's shot mode.
- **Checks:**
  - `uicheck.mjs`: 64 interaction checks on a frozen question set (`?qtest=1`); must pass before a round goes out.
  - `qcheck.mjs`: walks the live questions. `check.mjs`: phone size.
  - `fingerprint.mjs`: 116 frames hashed (`analysis/fingerprint-baseline.txt`). Run it before and after a refactor and require
    identical outputs.
- **Reasons and history:** `LEDGER.md` and `ledger-history/`; the round pages; `agents/`, the notes and reports of every helper.
