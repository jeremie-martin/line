# line

Music videos of Line Rider tracks composed automatically from music.

- A **spec** describes a song: beat times, the requested impact at each beat, and targets for air time, speed and
  amplitude between beats (`productions/<song>/`, written from the music: [docs/music-authoring.md](docs/music-authoring.md)).
- The **compiler** draws normal (type-0) Line Rider lines, arranged as a seeded variety of constructions (arcs with or without a
  guide rail, serpentines, scallops, scattered segments; folds and terraces are parked). The native Line Rider
  physics engine then measures whether the physical contacts match the requested beats and strengths.
- The **renderer** (`scripts/video/`) draws the ride as a 9:16 video over the song: a theme chosen for the ride, hits
  that move the picture by their measured strength, and a zoom written for the song
  ([docs/visual-system.md](docs/visual-system.md)).

## Where things stand

The compiler optimizes one definition of a hit, `line.strike.v3`. Compiler decisions read the V8 panel, with V7.1
beside it. The current compiler is named by the newest `foundation-N` entry of `REWORK.md`; references are local, so
set it on each machine (`npm run compare -- reference set foundation-N --from=COMMIT`), then compare any change with
`npm run compare -- run --reference=foundation-N --panel=v8`. `TODO.md` holds the next work and open questions,
`REWORK.md` the decision log, newest first.

Start the review server with `npm run serve` (`HOST=0.0.0.0` to reach it from other devices), then see
[WORKING.md](WORKING.md) for which page shows what.

## Setup

Use Node 26 (`.nvmrc`; `engines` allows newer), Rust 1.95.0
(`rust-toolchain.toml`, through rustup) and ffmpeg. `npm run check` proves a runtime: parity compares every track.
CLI and worker
scripts run directly with Node’s built-in TypeScript stripping. Typechecking
enforces erasable syntax and explicit type imports; no runtime transpiler is needed.

```sh
npm ci
npm run check:physics  # packaged engine vs saved physics; no judge build needed
npm run build:wasm     # independent judge for live/full checks (cargo + wasm-opt)
```

The compiler backend is packaged separately. After editing its Rust or TypeScript sources, use
`npm run build:native`; the independent reference build stays unchanged. See
[`scripts/lib/native_motion/README.md`](scripts/lib/native_motion/README.md) for
compiler-engine ownership and build details. The concise
[validation workflow](docs/engine-validation.md) covers the correctness layers,
paired timing protocol and interpretation of resource measurements.

`npm run check:physics` is the quick saved-reference check. `npm run check` runs
the complete structural gate: types, reachability, JavaScript and Rust tests,
live physics verification, compiler parity and judge parity. Evaluation,
comparison and parity use a conservative CPU/memory worker count; `--jobs=N`
overrides it (the default follows the machine: [WORKING.md](WORKING.md), Compute). `npm run perf:engine` answers
whether a change is faster, `npm run perf:profile` shows where a real compile spends
its time, and `npm run bench:engine` is a workload diagnostic.

Compiler throughput is full compile time per charged physics frame, including
search and observation work. It is distinct from isolated solver time. Structural
optimizations preserve exact output and charged work.

With `npm run serve` running, `node tests/browser/async-loading.mjs` checks
concurrent gallery loading, cancellation, and audio-failure recovery using
synthetic artifacts. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an existing
Chromium installation instead of Playwright's default browser.

## Everyday commands

| command | what it does |
|---|---|
| `npm run produce -- --song=luna_bala_44s --seed=101 --out=DIR` | compile one automatic arrangement of a production song (optimizing the strike impact account) |
| `npm run serve` | review server on http://127.0.0.1:8767/ (native playback with music); `HOST=0.0.0.0` to reach it from other machines |
| `/spec-dashboard/?spec=productions/<song>/spec.ts` | spec dashboard: spectrogram, measured events by instrument, requested impacts and axes, clicks at landings, owner notes |
| `npm run library` | (re)generate the production review library |
| `npm run render -- --study=DIR [--look=THEME]` | render a compiled study's videos, excerpts and upload bundles |
| `npm run compare -- run --reference=NAME` | compare this checkout with a saved reference on a panel, V8 for decisions ([docs/benchmark.md](docs/benchmark.md)) |
| `npm run eval -- --name=DIR [--panel=v8\|v8-confirm\|v7.1]` | compile one panel with this checkout |
| `node tools/measure/motion_check.ts --library=DIR --previous=DIR` | motion check of a review library (bursts, reported windows, calm openings) |
| `npm run video -- --song=petrunko_selection --seed=404 --look=hokusai` | compile a fresh ride and make its video |
| `npm run video -- --study=DIR --look=plain --from=20 --to=35` | make a video of a saved production, whole or a span (`--id=CELL` for a study with several rides) |
| `npm run videos -- --songs=all --seeds=4 --out=generated/videos/NAME` | a batch: every song at every seed, each a fresh compile with its look and zoom lane chosen; continues where it stopped, and reports what failed |
| `npm run labels:analyze` | compare measures with the owner's blind labels |
| `tools/music/*` | music → spec authoring: stems, drum transcription, events, sheets, coverage ([docs/music-authoring.md](docs/music-authoring.md)) |

`video` also accepts `--track=FILE --music=SONG` for a bare track over a song's
recording. Each video's look is chosen for its ride (`scripts/video/choose.js`): a theme
of the collection (`scripts/video/collection.js`), half light and half dark, for a light
theme on a song with a drop, sometimes a dark partner at the drop, and one of the song's
zoom lanes (`productions/<song>/zooms.ts`). `--look=THEME` or `plain` names the look,
`--zoom=ID` or `steady` the zoom, and
`--set=key:value,…` changes single options; `--width=N` sets the size (1080 by
default; videos are 9:16). `--help` lists the interface. Without a seed, a fresh
seed is recorded. The video's `.json` sidecar says what it is of; compilation
artifacts live in the adjacent `.assets` directory. Existing outputs are never
overwritten.

Every video, these and the concept lab's films and the study clips, is drawn by
one renderer (`scripts/video/`) and written in one pass: each frame goes once to
FFmpeg with the song's own audio, under one encoding standard (BT.709, all colour
tags), and is checked after writing (frames, tags, and the audio within 1 ms of the
song). Rendering requires local Chromium, ffmpeg/ffprobe and, for an uncached
spectrum, Python with numpy (`LR_SPECTRUM_PYTHON` can select it).

## Checks

| command | what it guards |
|---|---|
| `npm run check:physics` | fast saved-reference physics, including seeded stress cases |
| `npm run verify:engine` | live independent physics and derived-observation parity |
| `npm run parity` | structural changes leave 25 compiled reference cells byte-identical, chosen by measured coverage: every construction family, recovery, fallback, exhausted allowances and a failed ride |
| `npm run check:smoke` | a timing comparison, a production compile and the review pages in real Chromium |
| `npm run check` | complete structural gate, including both parity suites and the smoke check |
| `npm run parity:judge` | the independent judge reproduces every stored score |
| `npm test` | unit and integration tests |
| `npm run typecheck` | TypeScript, no errors |
| `npm run reach` | no tracked code is unreachable from `tools/deps/entries.json` |

## Layout

| path | contents |
|---|---|
| `scripts/v0/optimizer/` | the compiler (entry: `handoff.ts` → `production_repertoire.ts` → `arc_motion.ts`) |
| `scripts/lib/` | engines (`_lr_engine*.ts`, `native_motion/`), detector, the strike impact account |
| `scripts/v0/` | spec types, measurement and scoring shared with the judge |
| `scripts/produce/` | production CLI, the saved record of a ride, batch rendering |
| `scripts/video/` | the renderer: picture, camera, hits, zoom, themes, the video writer |
| `scripts/gallery/`, `motion-gallery/` | review server API and the native production player |
| `productions/` | production songs: spec and variants, measured events and analysis, zoom lanes |
| `labels/` | the owner's felt-impact labels and blind labelling studies (perceptual ground truth) |
| `engine-rs/` | the Rust physics engine (judge); `vendor/lr-core` is the JS reference |
| `tools/` | parity harness, reachability guard, measurement instruments, behavioural evaluation |
| `docs/research/` | the investigations and owner feedback the next phases build on |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the compiler works and
[WORKING.md](WORKING.md) for the rules of changing it. Everything removed during
the rework remains available at tag `archive/pre-rework-2026-10-03`.

Evaluation evidence is a complete declared panel. `npm run eval` records the
resolved authoring identity and measurement code before compiling;
resuming validates those inputs and every saved track. Worker failures return a
nonzero exit status. Reports refuse missing cells and comparisons with different
inputs or measurement code. An incomplete *ride* remains a measured outcome.

To remeasure saved tracks under current diagnostics, preserve the old directory
and use `node tools/eval/remeasure.ts --from=OLD --name=NEW`. This does not
recompile or alter tracks. Runs compiled before 2026-11-11, with every contact
moved 15 ms later, are refused: recompile them. It checks saved beat
requests and frozen axis observations before accepting current authoring. Runs
without saved tracks remain historical tables, not current comparable evidence.

Evaluation, production batches and blind-study generation allow one writer per output directory. A hard
interruption leaves `.generation.lock` with its owner PID; verify that process
has stopped before removing the lock and resuming.
