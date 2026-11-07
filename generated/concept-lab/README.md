# Concept lab (round 12, November 7, 2026)

A live browser lab for the finished videos' visual direction. It plays real rides with their music.
- The native Line Rider rider artwork and the replay worker are reused unchanged.
- The camera (`cam.js`) and every layer are drawn around them on a 2D canvas.
- Nothing here touches production, the compiler or the specs. The lab is tracked on the `visual-lab` branch.
- Rounds 1 to 5 are frozen in `round1/` to `round5/`. Round 5 plays the old rides from `data-r5/`.

Since round 6, the rides are **recompiled with the current compiler**:
- `recompile.sh` writes into `rides/`, with the same songs and seeds.
- `prepare.py` prefers those rides.
- `?rides=old` loads the round 1–5 rides.

The owner is not tied to Remotion or the exporter. A one-pass canvas render is a real option for production, so nothing here is limited to what Remotion can do.

Start at `morning.html` (served by `npm run serve`):

| Entry | What it is |
|---|---|
| `morning.html` | Index of all rounds. Round 12 is `round12.html` (response curves drawn from the lab's formulas; `SIZE`, `LIBRARY`); round 11 `round11.html` (hit size `crv`/`amp`, split over the band `spw`, Wada pass 2 `w2*`); round 10 `round10.html` (Wada palettes `w*`, from `agents/wada`); round 9 `round9.html` (split re-asked, flash gates `flg`, shake with `?shakeX`, whole-theme `VARIANTS`); round 8 `round8.html` (fair split, rare flash, paper study); round 7 `round7.html`: questions in the lab, no films. Round 6 is `round6.html` (`gen-morning6.py`, `films6.json`). |
| `fourup/r6/` | 4K four-ups: the owner's Los Voltaje moments on the old ride, biggest hits, camera, colours, drop switch, band pool. Built by `films6.sh` and `fourup.sh` (set `DIR=films6`). |
| `system.html` | How the pieces fit: signals, elements, schemes, direction. |
| `LEDGER.md` | Every piece by layer, with its status and the owner's words. Verdicts are filed per piece, never per look. |
| `clarify.html` | The clarification round before round 6. Answers in `agents/clarify-answers-r6.md`. |
| `?q=1` | Six questions. Stored in localStorage as `concept-lab-answers-r12`. `uicheck.mjs` (82 interaction checks, on a frozen question set via `?qtest=1`) must pass before a round goes out; `qcheck.mjs` walks the live questions. `splitmeasure.mjs` measures visible split fringe per option; `SPLIT_MATCH` holds the fitted factors; `BG_STUDY` the paper variants. Hits are built by parts (`hit: 'parts'`, `shk`, `spl`, `fls`, `drv`) with today's recipe as the reference. |
| `?feel=1` | Blind test of the intensity metric. |
| `./` | The free lab. |

## The camera (`cam.js`)

The official player's follower (mirror module 560) is a soft elliptical dead zone covering
about 40 % of the frame. Inside it the camera moves 1 % of the gap per frame; at the edge the
rider pushes it. A fast rider therefore rides the leading edge, and its position is a fast
function of velocity. Measured on today's videos: x stays at 0.60–0.62 W, y travels about
10,000 px/min.

Round 3 is defined by the rider's screen position and the zoom, pivoting on the raw body
centre. Placements keep the official shape with an asymmetric response: moving with the
rider's real motion is free, moving against it is limited to `back` px/s.

| Placement | Rest | Reach | Back |
|---|---|---|---|
| official | the follower itself | | |
| loose | 0.50 W, 0.36 H | 0.19 W, 0.15 H | 170 px/s, settling at 2.2/s |
| tamed (default) | 0.50 W, 0.36 H | 0.15 W, 0.11 H | 110 px/s, settling at 1.6/s |
| calm | 0.52 W, 0.38 H | 0.09 W, 0.05 H | 60 px/s, settling at 1.2/s |
| pinnedRight | 0.58 W, 0.40 H | none | 45 px/s |

Round 2's Operator produced a sawtooth: straight climbs at the rate limit, then sharp drops. Returns are now proportional to the distance left, so they curve and settle.
The event count in `measureCamera` cannot see that, so it is a guardrail, not a score; look at
the curve (`camdump.mjs`, `analysis/pos.png`).

Zoom (`TIDES`): steady; out when quiet on intensity (`quietI`); one breath, at most one excursion and only in a true valley; fitted, a fixed zoom per song giving the same on-screen speed. The ride is airborne about 60 % of the time, so the round-3 rule (hold in the air, 4 %/s) chops a tide into dozens of small steps; `calmOut` keeps that for comparison, and the tides in `SMOOTH` ignore the hold and stay under 2.5 %/s.

## Intensity (`intensity.js`, `intensity/`)

One pure module, used by the analysis and the lab, knowing nothing about what is drawn with it. Inputs: speed, and impact power (strength per second). Each gets a 6 s median and σ = 1 s gaussian (zero phase), a shared scale (p5 to p99.5 over 22 rides), the two are averaged, and change is capped at 0.3 per second. `meter` is a causal contrast. `final.mjs` gives the numbers on the page, including injected gaps, slowdowns and bursts. These are guardrails; the blind test (`pairs.mjs`) is the only validation, and it is not yet in.

Findings: strength is not redundant with rate (corr 0.58, varies ×4.7 through a ride against ×3.3). Shaped speed and impact nearly agree (corr 0.65–0.96, largest 5 s disagreement 0.17), so using both is about robustness. Closing stretches peaks; a median does not.

## Timing (`timing/`)

`ensemble.py` averages the sound around strong hits, aligned on first touch, with no detector: the rise sits −6 to +10 ms from the touch on 8 songs. The measured hit time is one physics frame (25 ms) after the touch, and the impact peak is +25 ms typically. Accents fire at the touch. `timeline.py` and `outliers.py` use a flux detector that misreads the Los Voltaje family by about 60 ms: do not rely on their per-song values.

The compiler's −15 ms jolt (`scripts/produce/jolt.ts`) is outside the lab and unchanged.

## Inking

A rail inks at its furthest recorded touch or as the rider passes its right end, whichever is first. Contacts alone left 8–17 % of the course grey behind the rider. `window.__inkAudit()` in shot mode reports what is left.

## Signals (`analysis/`)

`characterize.py` and `signals.py` run on 22 saved rides:

- Speed: median 360–430 u/s everywhere; the rider almost never goes left.
- Impact rate swings per minute, by gaussian σ: 9.5 at 1 s, 3 at 2–3 s, 1 at 4–6 s. So zoom uses σ = 3 s and tones σ = 2 s.
- Impact rate against loudness: correlation 0.69 (0.45–0.92).
- `night.py`: neither a loudness step nor a sustained-energy span finds drops reliably (both miss Petrunko's 22.4 s). Night therefore uses one optional hand-placed cue per song (`NIGHTS`).

Sections are an authoring aid and drive nothing by default. Night's hand-placed cue may become the first line of a per-song sheet.

## Bookends

A view is (rider screen point, ln zoom). The overview and the camera both keep the rider in
frame, so every blend does, for any camera. `ends: closing` drops the opening, and `bandIn` sets how the band arrives (default: there from frame 0).

## Layers

| Layer | Options |
|---|---|
| Colour | graphite, Hokusai, Black, Lagoon, Riso, Dune, Plum, Klein, Bottle (whole print identities, `SCHEMES`) |
| Size | today; 7 %, 15 % (default), 25 % closer |
| Rider in the frame | official; looser; tamed |
| Zoom over time | steady; out when quiet; one breath; fitted |
| Intensity from | speed + impact; speed; impact; meter |
| Paper | plain; whisper; X-ray (test) |
| Night | off; on (hand-placed cue) |
| Top of the frame | nothing; vignette; sun; title |
| Line | pencil → ink; whole rail on first touch; all ink |
| Lower band | today's bars; three-colour bars; blocks; tuning fork; Iris; one accent (fork, bars, blocks) |
| What takes the accent | heat; loudest; standing; follows intensity |
| Band | height: low, low-middle, middle, today's; size: steady or follows intensity; opening: arrives or there from frame 0 |
| On each hit | today (approximated); refined; held; refined + afterimage; held + afterimage |

"Held" sets amplitude and duration from w = e^2.2, holds the peak at least one 60 fps frame, and
ends by 0.25 s at most.

## Files

- `prepare.py`: `data/<song>.json` from the saved record, composition and spectrum.
- `cam.js`: camera, placements (`follow`: the vertical offset follows the slope, and the rider never climbs on screen while descending), tides, measures. `camcheck.mjs`, `camdump.mjs` (song, tag, data dir): measurement. `camstats.mjs`: camera telemetry, saved to `analysis/camstats.txt`.
- `lab.js`, `index.html`, `lab.css`: the lab. `build.mjs`, `src/native.js`: the vendored bundle.
- `shoot.mjs`, `strip.mjs`: stills and frame strips. `render.mjs`, `films5.sh`, `films6.sh`: films (`rides=old`, `from=`, `to=`).
- `recompile.sh`, `rides/`: the lab's rides from the current compiler. `data-r5/`: the old rides.
- `check.mjs`, `qcheck.mjs`: phone-size checks.
- `agents/`: notes from idea, critique, transcript-mining, review and step-back agents.
