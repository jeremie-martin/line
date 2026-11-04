# line

Line Rider tracks composed automatically from music. A spec describes a song:
beat times, the requested impact at each beat, and per-gap targets for air
time, speed and amplitude. The compiler draws normal (type-0) Line Rider lines,
arranged as a seeded variety of constructions (arcs, guided arcs, folds, ripples,
serpentines, terraces, scattered segments). The native Line Rider physics engine
then measures whether the physical contacts match the requested beats and strengths.
Upper contacts can count as impacts too; visual review remains essential.

The repository is being rebuilt on clean foundations; see [REWORK.md](REWORK.md)
for the plan and its current phase.

## Returning to the project

The latest completed compiler campaign ended on **October 6, 2026**, on
`rework/foundations`. Codex integrated the selected compiler in `abdad07e`;
`c22e8df4` records the final verification and archive closure. This followed
Claude Code's October 3–5 foundations rework and overnight compiler campaign.

Start the review server with `npm run serve`, then open:

- **Latest compiler review:** http://127.0.0.1:8767/generated/report/quality-20261005/
  — full-song comparisons, scorecards and counterexamples for the October 5–6 campaign.
- **Earlier overnight review:** http://127.0.0.1:8767/motion-gallery/night.html
  — the preceding campaign, its blind study and unanswered questions.
- **Production library:** http://127.0.0.1:8767/motion-gallery/production.html
  — saved October 5 rides and controls to generate a ride with the current compiler.
  The saved collection predates the latest compiler adoption.

For other devices on the same network, use `HOST=0.0.0.0 npm run serve`
and replace `127.0.0.1` in these links with this machine's LAN address.

**Still open:** visual acceptance of body contact and individual hit regressions,
the trade between impact and air, the authored impact scale and difficult song
requests, and generalization to new music. The next major direction has not been
chosen. Start with the latest review's full-song pairs and counterexamples.

`REWORK.md` holds the latest campaign log; `PROGRESS.md` describes the earlier
October 4–5 overnight campaign. The two reports use different baselines, so their
percentage improvements should not be compared directly.

## Latest results

The October 5 evening compiler campaign has its own review at
`generated/report/quality-20261005/`, with complete paired scorecards, strength
curves, physical examples and a ledger in `docs/research/quality-20261005.json`.
The selected compiler keeps multiple physically tested continuations and uses
cached native contacts for scattered geometry. On a fresh 48-case panel, v3 impact
loss falls 24.5% on authored inputs and 13.5% on perturbations; the 336-case catalog
keeps 318 completions, with one recovery and one regression. Six matched production
cases cost 6.9% more CPU; long supported rides can cost substantially more.
Body-contact and individual-impact regressions remain visible in the review.
See `docs/research/quality-20261005-decision.json` for the decision and limits.
The earlier report, blind study and unanswered questions below are preserved.

The overnight report of 2026-10-05 (the impact measure settled with the owner,
compiler changes, evening → tonight on four panels) is
`docs/research/overnight-20261005.md`. Its dashboard: run `npm run serve`, then
open `motion-gallery/night.html`. The running log is `PROGRESS.md`.

## Setup

The qualified toolchain is Node 22.22.2 (`.nvmrc`) and Rust 1.95.0
(`rust-toolchain.toml`). Runtime upgrades need fresh physics and compiler parity;
floating-point equality is qualified against this Node/V8 version.

```sh
nvm use
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
overrides it (four by default on this 16 GB host). `npm run perf:engine -- --help`
shows the paired experiment options; `npm run bench:engine` is a workload diagnostic.

Compiler throughput is full compile time per charged physics frame, including
search and observation work. It is distinct from isolated solver time. Structural
optimizations preserve exact output and charged work; an absolute speed target
also requires fresh confirmation and the declared regression guards.

With `npm run serve` running, `node tests/browser/async-loading.mjs` checks
concurrent gallery loading, cancellation, and audio-failure recovery using
synthetic artifacts. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an existing
Chromium installation instead of Playwright's default browser.

## Everyday commands

| command | what it does |
|---|---|
| `npm run produce -- --song=luna_bala_44s --seed=101 --out=DIR` | compile one automatic arrangement of a production song (optimizing the strike impact account) |
| `npm run produce -- … --impact-contract=landing` | same with the previous landing objective (kept temporarily for comparison) |
| `npm run serve` | review server on http://127.0.0.1:8767/ (native playback with music); `HOST=0.0.0.0` to reach it from other machines |
| `/spec-dashboard/?spec=productions/<song>/spec.ts` | spec dashboard: spectrogram, measured events by instrument, requested impacts and axes, clicks at landings, owner notes |
| `npm run library` | (re)generate the production review library |
| `npm run render -- --study=DIR` | render vertical videos for a compiled study (optional) |
| `npm run sentinel -- --out=DIR` | run the frozen V6 benchmark as a regression sentinel |
| `npm run eval -- --name=DIR [--panel=dev\|confirm\|bench\|bench-confirm\|bench-pairs8] [--mode=strike3\|strike2\|strike\|landing]` | behavioural evaluation (`sealed` and `heldout` need `--sealed` / `--heldout`; `npm run eval` with no `--name` lists the panels); `npm run eval:report -- --name=DIR [--against=DIR]` |
| `npm run measure` | replay reference rides and compute per-beat measures under every ruler |
| `node --import tsx tools/measure/motion_check.ts --library=DIR --previous=DIR` | motion check of a review library (bursts, reported windows, calm openings) |
| `npm run labels:analyze` | compare measures with the owner's blind labels |
| `tools/music/*` | music → spec authoring: stems, drum transcription, events, sheets, coverage ([docs/music-authoring.md](docs/music-authoring.md)) |

## Checks

| command | what it guards |
|---|---|
| `npm run check:physics` | fast saved-reference physics, including seeded stress cases |
| `npm run verify:engine` | live independent physics and derived-observation parity |
| `npm run parity` | structural changes leave 63 compiled reference cells byte-identical (all compile modes, plus 150k/750k budgets) |
| `npm run check` | complete structural compiler/engine gate, including both parity suites |
| `npm run parity:judge [-- --all]` | the V6 judge reproduces every stored score (this *is* the V6 freeze) |
| `npm test` | unit and integration tests |
| `npm run typecheck` | TypeScript; the error count may only go down |
| `npm run reach` | no tracked code is unreachable from `tools/deps/entries.json` |

## Layout

| path | contents |
|---|---|
| `scripts/v0/optimizer/` | the compiler (entry: `handoff.ts` → `production_repertoire.ts` → `arc_motion.ts`) |
| `scripts/lib/` | engines (`_lr_engine*.ts`, `native_motion/`), detector, the strike impact account |
| `scripts/v0/` | spec types, measurement and scoring shared with the judge |
| `scripts/produce/` | production CLI, music artifacts, video rendering |
| `scripts/gallery/`, `motion-gallery/` | review server API and the native production player |
| `benchmark/v6/` | frozen V6 judge (+ the V3–V5 modules it is built from) |
| `productions/` | production songs: spec, measured events and analysis, render settings (the four evaluation songs, plus new music held out from compiler tuning) |
| `labels/` | the owner's felt-impact labels and blind labelling studies (perceptual ground truth) |
| `engine-rs/` | the Rust physics engine (judge); `vendor/lr-core` is the JS reference |
| `tools/` | parity harness, reachability guard, measurement instruments, behavioural evaluation |
| `docs/research/` | the investigations and owner feedback the next phases build on |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the compiler works and
[WORKING.md](WORKING.md) for the rules of changing it. Everything removed during
the rework remains available at tag `archive/pre-rework-2026-10-03`.

Evaluation evidence is a complete declared panel. `npm run eval` records the
resolved timing offset, authoring identity and measurement code before compiling;
resuming validates those inputs and every saved track. Worker failures return a
nonzero exit status. Reports refuse missing cells and comparisons with different
inputs or measurement code. An incomplete *ride* remains a measured outcome.

To remeasure saved tracks under current diagnostics, preserve the old directory
and use `node --import tsx tools/eval/remeasure.ts --from=OLD --name=NEW
--jolt-ms=-15`. This does not recompile or alter tracks. It checks saved beat
requests and frozen axis observations before accepting current authoring. Runs
without saved tracks remain historical tables, not current comparable evidence.

Evaluation, production batches and blind-study generation allow one writer per output directory. A hard
interruption leaves `.generation.lock` with its owner PID; verify that process
has stopped before removing the lock and resuming.
