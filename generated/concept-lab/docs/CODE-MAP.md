# Code map: the videos and the lab, by content

*As of 8 November 2026, after the move to one video renderer (REWORK.md, November 8). Organised by what the code does,
wherever it lives. Line counts are as of today.*

## At a glance

| Area | Where | Size | Role |
|---|---|---|---|
| A. The video renderer | `scripts/video/` | about 1,380 lines | Draws and writes every video: the finished ones, the lab's films, the review clips |
| B. Its commands | `scripts/video.ts`, `scripts/produce/{render_repertoire,video_input,video_request}.ts`, `tools/measure/clip_render.ts` | about 270 lines | `npm run video`, study renders and bundles, review clips |
| C. The concept lab | `generated/concept-lab/` | runtime about 570 lines | The owner's questions, the free mix, the blind test; draws through A |
| D. Review players | `motion-gallery/`, `shared/playback.js`, `scripts/gallery/inspect.js` | – | The compiler's ride review and the video players |
| E. Tests | `tests/video_renderer.test.ts`, `tests/video_write.test.ts`, the lab's checks | – | – |

## A. The video renderer (`scripts/video/`)

| File | Lines | Role |
|---|---|---|
| `look.js` (+ `look.d.ts`) | 66 | Every option, the settled defaults `V1`, the `THEMES`, `PLAIN` (review clips), `resolveLook` (refuses anything unknown) |
| `timing.js` (+ `timing.d.ts`) | 29 | The two clocks and their one relation, r = s + offset; a ride's alignment from its account |
| `picture.js` | 405 | The frame at song time t for a look: the ride prepared once (rails, hits from the account, intensity on ride time, drop), then the ride at r, camera, paper, top, band, lines, rider, and each hit's shake, split and flash from its effect time (`effectsAt`) |
| `camera.js` | 72 | Follows direction and its two zoom tides |
| `palettes.js` | 267 | Every scheme, its variants, `LIBRARY` (the owner's tiers), `DROP_SCHEMES` |
| `intensity.js` | 62 | The intensity metric and its measures |
| `scene.ts` | 109 | A ride and its song → what every consumer reads: the impact account as recorded (physics frames), the timing, the song span, spectrum (cached), drop, title |
| `drops.ts` | 13 | Each song's drop, placed by hand |
| `write.ts` | 172 | Scene + look → MP4 in one pass, then checked (frames, tags, audio within 1 ms) |
| `encoding.ts` | 11 | The one encoding standard (BT.709, all four tags) |
| `native.js`, `worker.js`, `sprites.js` | 82 | The vendored rider artwork and native replay, bundled into `generated/renderer/` (`npm run gallery:renderer`) |
| `scene_api.ts` | 32 | The review server's scene endpoint: a saved record's scene, for the review player |

## B. Commands

- **`npm run video`** (`scripts/video.ts`, `video_request.ts`): a fresh compile, a saved study or a bare track; any look,
  whole or a span; a `.json` sidecar says what the video is of.
- **`npm run render -- --study=DIR`** (`render_repertoire.ts`): a study's valid rides, each with its excerpt, its publication
  bundle (`upload.json`) and a record; `video_input.ts` verifies a saved cell (the record, its account, the recording).
- **Review clips** (`tools/measure/clip_render.ts`): passages in the plain look, 540 × 960, for `pair_study`, the visibility
  study and `compare review`; reused only for identical inputs.

## C. The concept lab (`generated/concept-lab/`)

| File | Lines | Role |
|---|---|---|
| `lab.js` | 407 | Loading, the question mode, the free lab, the transport, the blind test; `QUESTIONS`, `TEST_QUESTIONS` |
| `presets.js` | 8 | The lab's looks: Swatch, Plain, the themes |
| `rides.js` | 16 | The ride sets by name (the lab's rides, the same as compiled, the round 1–5 rides) and where their scenes live |
| `index.html`, `lab.css` | 158 | Page and style |

**Tools:** `prepare.mjs` (scenes, through `scene.ts`), `recompile.sh` (rides), `film.mjs` and `films7.sh` (films, through
`write.ts`), `fourup.sh` and `grid12.sh` (compositions, in the standard), `shoot.mjs` and `strip.mjs` (stills),
`uicheck.mjs` (69 checks), `qcheck.mjs`, `check.mjs`, `fingerprint.mjs` (116 frames; a ride set as third argument).

**Studies, kept for their findings:** `intensity/`, `timing/`, `analysis/`. **Not for code review:** `agents/` (helper reports
and data), the round pages.

## D. Review players

- `motion-gallery/video-compare.*` plays rendered videos side by side in one player (the lab's films, compare's review).
- `motion-gallery/production.html` (`production.js`, `ride.js`) is the compiler's ride review. It draws the video picture
  (A) from the scene the review server builds (`/api/scene`, `scripts/video/scene_api.ts`), plain by default or in any theme,
  with contact inspection as an overlay (`scripts/gallery/inspect.js`).
- `motion-gallery/pairs.*` plays the blind pair studies (clips from B).
- `shared/playback.js` is the music clock of every live player, the lab's included.

## Untracked (not in git)

| What | What it is |
|---|---|
| `generated/renderer/` | The bundle (A) |
| `generated/spectrum/` | Cached spectra, one per recording |
| `generated/concept-lab/` (ignored parts) | `data/`, `data-compiled/`, `data-r5/`, `data-r19/`, `rides*/`, `films*/`, `fourup/`; all regenerable |
| `generated/style-lab*`, `style-study`, `style-review`, `video-workflow-audit` | The Codex-era style labs and their films (rounds 1–6 linked some); their code was deleted on 8 November |
| Repository root: `2026-11-02-*.md` | The owner's conversation exports (rounds 1–6 and earlier context) |

## History

- The work reached `rework/foundations` when the old branch `codex/postprocessing-study` was fast-forwarded onto it on
  7 November: 33 commits between `3059a37e` and `c47272f9` (music-library specs, video pipeline, the style study, the lab's
  first commit). The lab's own commits followed on `visual-lab`.
- On 8 November the production video chain of June (Remotion, the LOCKED_FX recipe, the overlay data, the native exporter, the
  beat punch) and the Codex-era style study were replaced by A, the lab's renderer made production (REWORK.md).
