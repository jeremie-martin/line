# Code map: where the visual-direction work lives

*Prepared on 8 November 2026 for a code review, a simplification pass, and then an alignment pass ("did we build the right thing").*

## The branch, and how the work reached `rework/foundations`

**Correction (8 November):** an earlier version of this map said the lab entered foundations in one commit. That was wrong.

**What happened:**
1. At the start of this session (7 November), the old branch `codex/postprocessing-study` was rebased onto `rework/foundations`.
2. Around 11:50 that day, **`rework/foundations` was fast-forwarded onto it.** A fast-forward leaves no merge commit, which is why it doesn't show up as a merge.
3. So **33 commits from the old branch now sit on foundations' own main line**, between `3059a37e` (foundations, 11:06) and `c47272f9` ("Adapt the video command…", 11:50).
4. We then kept working: **29 more commits** on `visual-lab`, rebased twice onto newer foundations. All 29 touch only `generated/concept-lab/`.

**The 33 integrated commits are four strands, and only one is the lab:**

| Strand | When | Commits (examples) | Where |
|---|---|---|---|
| Music-library specs | 1 Nov | `427cf9e4` (22 listening specs), `80873aab`, `b28d6f6d`, `ded01590`, reviews and notes | `productions/`, `docs/` |
| Video pipeline and production overlay | 1 Nov, 7 Nov | `5a0957e6` (measured impacts in overlays), `04af1504` (unified video generation), `b1b6414f` (stream frames to FFmpeg), `67aff6dc` (soft-base vignette), `c47272f9` (video command on foundations) | `scripts/produce/`, `scripts/`, `remotion/src/`, tests |
| The earlier style study (Codex era) | 1–2 Nov | `b8b20c81`, `73e882be`, `44c4d3b6`, `ebbe1e3c`, `f2bdd1c2`, `4180a835` (looks); `90128719`, `68beae79`, `d297a542`, `cedc3d33`, `4e061d49`, `84b56844` (review players); `ec28962d`, `9b48c7cd`, `f8747c4e`, `31a71619` (docs) | `remotion/src/study/`, `remotion/src/CurveOverlay.tsx`, `motion-gallery/`, `docs/research/`, `tests/style_*`, `ARCHITECTURE.md`, `REWORK.md` |
| The concept lab | 7 Nov | `8a440f28` (also the repository `.gitignore` exception and `tools/deps/entries.json`), then the 29 commits on `visual-lab` | `generated/concept-lab/` |

**This changes the review scope.** Visual and study code also lives in the **production tree**, not only in the lab folder:
- **`remotion/src/study/`** (5 files, 625 lines: `looks.ts`, `Layers.tsx`, `SpectrumForms.tsx`, `signals.ts`, `spectrum.ts`) is imported by the production overlay **`remotion/src/CurveOverlay.tsx`** (760 lines). It only activates when a video is rendered with a `studyLook` setting, so it's dormant in normal production. The lab has since replaced that approach.
- **`remotion/src/fx.tsx`** and **`scripts/fx_recipe.ts`** hold the shipped hit recipe and the vignette.
- **`motion-gallery/`**: the review players (`video-compare`, `style-catalog`, `style-review`), used by the lab's early rounds.
- **Tests:** `tests/style_catalog.test.ts`, `tests/style_compositing.test.ts`, `tests/compare.test.ts` and others.
- **The video pipeline** (`scripts/produce/`, `scripts/video.ts`): production.

**For the review:** take the lab folder as it stands now, and treat the production-side visual code (the four bullets above) as its own review area. For the latter, the question is what production keeps once v1 is ported. A commit-by-commit review isn't useful for the lab; the 33 integrated commits can be read by strand.

## What to review in the lab folder (by priority)

### 1. Core runtime: 7 files, about 2,150 lines (dense)
| File | Lines | Role |
|---|---|---|
| `lab.js` | 1,207 | Everything else, in one file: data loading and native replay, camera sampling, hits (three generations), drawing, palettes in use, the question mode, the free lab UI, the bench, the blind test, `QUESTIONS` and `TEST_QUESTIONS`, the `t-*` theme looks |
| `cam.js` | 398 | Camera: ride signals, placements (Follows direction), tides, measurement helpers |
| `palettes.js` | 265 | Every scheme, variants, `LIBRARY`, `DROPS` |
| `v1.js` | 36 | The settled defaults |
| `intensity.js` | 61 | The intensity metric |
| `index.html`, `lab.css` | 181 | Page and style |

### 2. Tools: 25 files, about 940 lines
- **Data:** `prepare.py` builds `data/` from rides; `recompile.sh` builds rides from the compiler.
- **Film and image making:** `render.mjs`, `strip.mjs`, `shoot.mjs`, `fourup.sh`, `grid12.sh`, `films*.sh`.
- **Measurement:** `camdump.mjs`, `camstats.mjs`, `camcheck.mjs`, `splitmeasure.mjs`.
- **Checks:** `uicheck.mjs` (82 interaction checks), `qcheck.mjs`, `check.mjs`.
- **Round pages:** `gen-morning.py`, `gen-morning6.py`.

### 3. Studies, kept for their findings
- `intensity/` (11 files): the metric's design and the blind test.
- `timing/` (4): sound against contact timing.
- `analysis/` (16, mostly measurement data).

### 4. Not for code review
- **The vendored rider bundle:** `src/native.js`, `build.mjs`, `dist/native.js`. A thin wrapper around the repository's gallery code.
- **Frozen rounds 1–5:** `round1/`–`round5/`, 28 files and about 6,800 lines. Copies of the lab as it was, kept so the old pages still play.
- **Round pages:** `round6.html`–`round21.html`, `morning.html`, `clarify.html`, `system.html`.
- **Film lists:** `films*.json`.
- **`agents/`:** 83 files, about 23,000 lines. Helper reports, scripts and data (palettes, Wada, audits). They are history; their results were merged into the runtime.
- **Docs:** `docs/`, `LEDGER.md`, `README.md`, `ledger-history/`.

## Outside its folder, the lab depends on

| What | Tracked? | Notes |
|---|---|---|
| `shared/playback.js` | yes | Music playback and display time |
| `generated/motion-gallery-renderer/worker.js` | **no, a build output** | The native physics replay worker. Rebuild with `npm run gallery:renderer`; on a fresh clone the lab won't run until this is built |
| `motion-gallery/video-compare.html` | yes | The switching player (films lists) |
| `productions/<song>/` (audio, spec, composition, music) | yes | Audio and sections |
| `scripts/produce/automatic.ts`, `scripts/make_spectrum.py` | yes | Used by `recompile.sh` and `prepare.py` |
| `generated/style-lab-v5/*-approved-full.mp4` | **no** | The "Today (shipped)" reference films, linked from old rounds |

**Servers:** port 8770 is a plain file server from the repository root, which every round link uses. Port 8767 is the repository's own server (`npm run serve`), needed for the spec dashboard. The lab would also run on 8767.

## Untracked artefacts (all regenerable)

| What | Size | Made by |
|---|---|---|
| `data/` (current rides, 8 songs), `data-r19/`, `data-r5/` | about 45 MB each | `prepare.py` |
| `rides/`, `rides-r6/`, `rides-variants/` | – | `recompile.sh`, `scripts/produce/automatic.ts` |
| `films*/` | 0.3–1.1 GB each, about 4 GB in total | `render.mjs` via `films*.sh` |
| `fourup/` | – | `fourup.sh`, `grid12.sh` |
| `analysis/pos-*.json` | about 3 MB | `camdump.mjs` |
| `docs/owner-answers/` | 250 KB | Kept local until decided: a verbatim archive in a public repository |

Outside the repository there is also context:
- the two conversation exports at the repository root (`2026-11-02-*.md`, untracked);
- Claude's memory notes;
- this session's transcript.

## What a review will likely find (my own reading, to check rather than trust)

0. **The production overlay carries the old style study** (`remotion/src/study/`, wired into `CurveOverlay.tsx` behind `studyLook`). It's a candidate for removal or parking when v1 is ported, since the lab supersedes it.

1. **`lab.js` does too much in one file,** and many lines hold several statements. Natural splits:
   - hits;
   - drawing;
   - the question mode and its questions;
   - the free lab UI;
   - the bench and the blind test.

   Splitting can keep the picture byte-identical: the frame fingerprint is 35 frames in this session's scratchpad, worth turning into a lab tool.
2. **Three generations of hit code** coexist:
   - the original bundles (Refined, Held…);
   - parts with the size and curve controls (R7–R14);
   - per-part responses (R15+, v1).

   The older ones only replay earlier rounds' options, and those rounds' questions are not replayable anyway (only rounds 1–5 are frozen). Removing them is a decision for the owner. Some, like punch and recoil, are parked ideas rather than dead code.
3. **Round-specific scripts** (`films2.sh`…`films7.sh`, `fourups5.sh`, `gen-morning*.py`) could become one parametrised film script plus a page template.
4. **Frozen rounds 1–5** duplicate 6,800 lines. Git tags or commit links could replace them if the old pages don't need to stay playable.
5. **The lab's checks** (`uicheck`, `qcheck`, frame fingerprints) are outside `npm run check`, need a running server and a browser, and are run by hand.
6. **The untracked renderer build** is a silent prerequisite.
7. **Two file servers:** one could do.
