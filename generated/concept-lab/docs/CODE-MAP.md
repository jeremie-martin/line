# Code map: all the post-processing and visual work, by content

*Prepared on 8 November 2026 for a code review, a simplification pass, and then an alignment pass ("did we build the right thing"). Organised by what the code does, wherever it lives. Line counts are as of today. The branch history is in the appendix.*

## At a glance

| Area | Where | Size | Status | Review |
|---|---|---|---|---|
| A. The concept lab: the current direction | `generated/concept-lab/` | runtime about 2,150 dense lines, tools about 940 | active | **first** |
| B. The production post-processing stack | `remotion/src/`, `scripts/fx_recipe.ts`, `scripts/make_overlay_data.ts`, `scripts/make_spectrum.py` | about 1,330 lines | ships today | **second** |
| C. The video pipeline | `scripts/produce/`, `scripts/video.ts`, `scripts/lib/{export,video_options}.ts`, `scripts/export.ts`, `tools/measure/clip_render.ts` | about 1,500 lines | ships today | second |
| D. The ride renderer | `scripts/gallery/native/`, `scripts/gallery/build_renderer.mjs` | about 240 lines | used by B, C and the lab | second |
| E. The earlier style study (Codex era) | `remotion/src/study/`, hooks in `CurveOverlay.tsx` | about 625 lines plus hooks | **dormant** (`studyLook` only) | decide: keep or remove |
| F. Review players | `motion-gallery/video-compare.*`, `style-catalog.*`, `style-review.html`, `shared/playback.js`, `shared/theme.css` | about 630 lines | used by the rounds | third |
| G. Tests for B–F | `tests/` | about 1,040 lines | in `npm run check` | with their area |
| H. Docs | `generated/concept-lab/docs/`, `LEDGER.md`, `docs/research/postprocessing-style-study-20261102.md`, sections of `ARCHITECTURE.md` and `REWORK.md` | – | – | for context |
| I. Untracked experiments and context | `generated/style-lab*`, `style-study`, `style-review`, `video-workflow-audit`, lab artefacts, transcripts, memory | about 2 GB of old renders, plus 6 GB for the lab | not in git | not for review |

Not part of this work, though it arrived with it:
- **The music-library specs:** `productions/`, `docs/music-authoring.md`, `docs/research/music-library-compiler-20261101.md`, `tests/music_library_specs.test.ts`.
- **The spec dashboard:** `spec-dashboard/`, `scripts/gallery/spec_api.ts`. It's adjacent: we use it to read specs.
- **`scripts/analyze_audio.py`:** nothing in the repository calls it.

## A. The concept lab (`generated/concept-lab/`): the current direction

Everything the owner reviews today is drawn here, live, on a 2D canvas, in the browser.

**Core runtime**, 7 files:

| File | Lines | Role |
|---|---|---|
| `lab.js` | 1,207 | Nearly everything:<br>- data loading and native replay<br>- camera sampling and bookends<br>- hits, in three generations: the original bundles, parts with size controls (R7–R14), per-part responses (v1)<br>- drawing (lines, rider, band, top, Night and the drop switch)<br>- the question mode, the free lab, the bench, the blind test<br>- `QUESTIONS`, `TEST_QUESTIONS`, the `t-*` themes |
| `cam.js` | 398 | Ride signals, placements (Follows direction), tides, measurement helpers |
| `palettes.js` | 265 | Every scheme, variants, `LIBRARY`, `DROPS` |
| `v1.js` | 36 | The settled defaults (one source of truth) |
| `intensity.js` | 61 | The intensity metric |
| `index.html`, `lab.css` | 181 | Page and style |

**Tools**, 25 files, about 940 lines:
- **Data:** `prepare.py` builds `data/` from rides; `recompile.sh` builds rides from the compiler, with Circus Minimus on the voice-drums spec.
- **Films and stills:** `render.mjs`, `strip.mjs`, `shoot.mjs`, `fourup.sh`, `grid12.sh`, `films*.sh`.
- **Measurement:** `camdump.mjs`, `camstats.mjs`, `camcheck.mjs`, `splitmeasure.mjs`.
- **Checks:** `uicheck.mjs` (82 interaction checks), `qcheck.mjs`, `check.mjs`.
- **Round pages:** `gen-morning.py`, `gen-morning6.py`.

**Studies, kept for their findings:**
- `intensity/` (11 files): the metric and the blind test;
- `timing/` (4): sound against contacts;
- `analysis/` (16).

**Not for code review:**
- the frozen rounds 1–5 (`round1/`–`round5/`, about 6,800 lines of copies);
- `agents/` (helper reports, scripts and data, about 23,000 lines);
- the round pages;
- the vendored rider bundle (`src/native.js`, `build.mjs`, `dist/native.js`), a thin wrapper.

**Likely findings** (my reading, to check rather than trust):
- `lab.js` should be split into modules: hits, drawing, questions, the UI, the bench and blind test. That can keep the picture byte-identical using frame fingerprints, which are worth making a lab tool.
- Three generations of hit code coexist. Removing the older ones is the owner's call, since some, like punch and recoil, are parked ideas.
- The round-specific scripts could become one.
- The frozen rounds duplicate code.
- The checks run by hand, outside `npm run check`.
- The renderer build is a silent prerequisite.

## B. The production post-processing stack (ships today)

The finished videos are a pre-rendered ride with a Remotion overlay on top.

| File | Lines | Since | Role |
|---|---|---|---|
| `remotion/src/CurveOverlay.tsx` | 760 | June | The production composition: the spectrum band, labels, layout. Also hosts the dormant style-study hooks (E) |
| `remotion/src/fx.tsx` | 213 | June | The effects: shake, chromatic split, flash, grade, tint, vignette. All driven by impact "trauma" |
| `remotion/src/impact.ts` | 31 | | Impact contract and the trauma accumulator |
| `remotion/src/Root.tsx`, `index.ts` | 30 | | Entry |
| `scripts/fx_recipe.ts` | 17 | June | **The locked production recipe** (shake 10 px at 9 Hz, split 14 px, white flash 0.3, soft-base vignette). The lab's "today's" reproduces it |
| `scripts/make_overlay_data.ts` | 216 | June | The overlay's data: hits, measured impacts |
| `scripts/make_spectrum.py` | 90 | June | The 56-band spectrum the band draws |

**The key fact for the alignment pass:** production today runs the *old* look. The settled v1 exists only in the lab, and porting it (in Remotion, or as a one-pass canvas renderer, which the owner said is fine) is still ahead.

## C. The video pipeline (ships today)

| File | Lines | Role |
|---|---|---|
| `scripts/produce/render.ts` | 290 | Renders a finished video: ride, audio, spectrum, overlay, composition |
| `scripts/lib/video_options.ts` | 282 | Video options and formats |
| `scripts/lib/export.ts`, `scripts/export.ts` | 147 | Exporting the ride video |
| `scripts/video.ts` | 82 | The `npm run video` command |
| `scripts/produce/` (the rest) | about 700 | `automatic.ts` (compile and produce), `video_input`/`video_request`, `render_musical_direction`, `reuse_musical_direction_videos`, `overlay_impact`, `production_library`, `music_artifacts`, `config`, `measure`, `jolt.ts` (the −15 ms timing constant; compiler track) |
| `tools/measure/clip_render.ts` | 75 | Review clips |

## D. The ride renderer

| File | Lines | Role |
|---|---|---|
| `scripts/gallery/native/` | 216 | `view.js`, `video.js`, `worker.js` (the native physics replay), `camera.js` (today's official follower), `sprites.js` |
| `scripts/gallery/build_renderer.mjs` | 24 | Builds them into `generated/motion-gallery-renderer/` (**untracked**). The lab imports `worker.js` from there, so on a fresh clone run `npm run gallery:renderer` first |

## E. The earlier style study (Codex era, 1–2 November): dormant

| File | Lines | Role |
|---|---|---|
| `remotion/src/study/looks.ts` | 291 | The study's looks (palettes, forms, effects per look) |
| `remotion/src/study/SpectrumForms.tsx` | 177 | Alternative band forms (weave, terraces, caps…) |
| `remotion/src/study/Layers.tsx` | 88 | Study ride, ripples, atmosphere |
| `remotion/src/study/signals.ts`, `spectrum.ts` | 69 | Helpers |
| Hooks in `CurveOverlay.tsx` | – | `studyLook` input; `look?.…` branches in the band and layers |

It activates only when a video is rendered with a `studyLook` setting. The lab replaced this approach in rounds 1–5. **Question for the review:** remove it, or keep it until v1 is ported. Its tests (G) and doc (`docs/research/postprocessing-style-study-20261102.md`) go with it.

## F. Review players

| File | Lines | Role |
|---|---|---|
| `motion-gallery/video-compare.*` | 291 | The switching player (films lists), used in rounds 1–6 |
| `motion-gallery/style-catalog.*`, `style-review.html` | 225 | The style study's catalogue and review home |
| `shared/playback.js`, `shared/theme.css` | 193 | Music playback and display time; also used by the lab |
| `motion-gallery/player-shortcuts.js` | 9 | Keyboard shortcuts |

The rest of `motion-gallery/` (pairs, production, contact-impact review, replay) is the compiler's ride review, not this work.

## G. Tests for B–F (in `npm run check`)

| Group | Files | Lines |
|---|---|---|
| Style study (E) | `style_study`, `style_spectrum_forms`, `style_catalog`, `style_compositing` | 464 |
| Players (F) | `video_compare` | 282 |
| Pipeline and effects (B, C) | `video_export`, `video_workflow`, `vignette`, `overlay_impact`, `overlay_saved_impact`, `production_render_concurrency` | 298 |

The lab's own checks are separate (A).

## H. Docs

- **The lab:**
  - `docs/DIRECTION.md` (read first), `docs/DECISIONS.md`, `docs/THEME-CRAFT.md`, this map;
  - `LEDGER.md` (every piece, the open items), `README.md`, `system.html`;
  - `docs/owner-answers/` (verbatim, local only for now).
- **Repository:** `docs/research/postprocessing-style-study-20261102.md` (446 lines, the Codex-era study), and the style-study entries in `ARCHITECTURE.md` and `REWORK.md`.

## I. Untracked: experiments and context (not in git)

| What | Size | What it is |
|---|---|---|
| `generated/style-lab`, `-v2` … `-v5`, `style-study`, `style-review`, `video-workflow-audit` | about 2 GB | The Codex-era style labs: check scripts, pages, about 280 films. `style-lab-v5` holds the "Today (shipped)" films linked from rounds 1–6 |
| `generated/concept-lab/` (ignored parts) | about 6 GB | `data/`, `data-r5/`, `data-r19/`, `rides*/`, `films*/`, `fourup/`; all regenerable. (The nine `analysis/pos-*.json` camera dumps, about 3 MB, are regenerable with `camdump.mjs` but tracked: the lab's `.gitignore` covers only `agents/review-r6/pos-*.json`.) |
| `generated/motion-gallery-renderer/` | – | Build output (D) |
| Repository root: `2026-11-02-video-post-processing-dashboard-rethink.md`, `2026-11-02-style-post-processing-context.md` | – | The owner's conversation exports (rounds 1–6 and earlier context) |
| Claude's memory notes, this session's transcript | – | Outside the repository |

## Suggested review order

1. **A, the lab:** its correctness, then its simplification (the `lab.js` split, the hit generations, the scripts).
2. **B–D, production:** effects, overlay, pipeline, renderer. They ship today, and they're what v1 will replace or extend.
3. **E, the dormant style study:** a keep-or-remove decision, with its tests and doc.
4. **F, the players,** and the tests (G) alongside their areas.

## Appendix: how the work reached `rework/foundations`

Organised by content above; the history is here for completeness:
1. The old branch `codex/postprocessing-study` was rebased onto `rework/foundations` on 7 November, and **foundations was fast-forwarded onto it** around 11:50. A fast-forward leaves no merge commit.
2. So **33 commits** sit on foundations' main line between `3059a37e` and `c47272f9`. They form four strands: the music-library specs, the video pipeline, the Codex-era style study (`remotion/src/study`, `motion-gallery`, style tests and docs), and the lab's first commit (`8a440f28`).
3. Since then, **29 commits** on `visual-lab`, all inside `generated/concept-lab/`, rebased twice onto newer foundations.
4. The production stack (B) predates all this: `fx.tsx`, `CurveOverlay.tsx`, `make_overlay_data.ts` and `make_spectrum.py` date from June.
