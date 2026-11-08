# Code map: where the visual-direction work lives

*Prepared on 8 November 2026 for a code review, a simplification pass, and then an alignment pass ("did we build the right thing").*

## The branch

- **`visual-lab`** is `rework/foundations` plus 29 commits. **All 29 touch only `generated/concept-lab/`.** Nothing else in the repository was changed by the visual work since the last rebase.
- **History:** the lab entered the repository in one commit, `8a440f28` ("Track the concept lab…"), which `rework/foundations` already contains (the round-5 state). That commit also touched two repository files, both needed and small:
  - `.gitignore`: `generated/*` is ignored except `!generated/concept-lab/`;
  - `tools/deps/entries.json`: the lab's entry points for the reachability guard.
- **Earlier visual work** (before the lab) lives in `rework/foundations` already: `remotion/src` (production effects, `fx.tsx`), `scripts/fx_recipe.ts` (today's shipped hit recipe), `motion-gallery/` (the switching player, `video-compare.html`), `tests/style_*.test.ts`, `docs/research/`.
- **For the review,** review the current tree of `generated/concept-lab/`, not commit by commit. Most of the 30 commits are round-by-round iterations of the same files, and the current state is what matters. If a range is wanted: `git diff 8a440f28^ HEAD -- generated/concept-lab`.

## What to review (by priority)

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
