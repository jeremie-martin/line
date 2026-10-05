# line

Line Rider tracks composed automatically from music. A spec describes a song:
beat times, the requested impact of each landing, and per-gap targets for air
time, speed and amplitude. The compiler draws normal (type-0) Line Rider lines,
arranged as a seeded variety of constructions (arcs, guided arcs, folds, ripples,
serpentines, terraces, scattered segments). The native Line Rider physics engine
then judges whether the rider lands on the beats with the intended feel.

The repository is being rebuilt on clean foundations; see [REWORK.md](REWORK.md)
for the plan and its current phase.

## Latest results

The overnight report of 2026-10-05 (the impact measure settled with the owner,
compiler changes, evening → tonight on four panels) is
`docs/research/overnight-20261005.md`. Its dashboard: run `npm run serve`, then
open `motion-gallery/night.html`. The running log is `PROGRESS.md`.

## Setup

```sh
npm install
npm run build:wasm      # Rust → WASM physics engine (needs cargo + wasm-opt)
npm run verify:engine   # engine traces must be byte-identical to the reference
```

## Everyday commands

| command | what it does |
|---|---|
| `npm run produce -- --song=luna_bala_44s --seed=101 --out=DIR` | compile one automatic arrangement of a production song (optimizing the strike impact account) |
| `npm run produce -- … --impact-contract=landing` | same with the previous landing objective (kept temporarily for comparison) |
| `npm run serve` | review server on http://127.0.0.1:8767/ (native playback with music) |
| `npm run library` | (re)generate the production review library |
| `npm run render -- --study=DIR` | render vertical videos for a compiled study (optional) |
| `npm run sentinel -- --out=DIR` | run the frozen V6 benchmark as a regression sentinel |
| `npm run eval -- --name=DIR [--mode=strike\|landing]` | song-level behavioural evaluation (~90 s); `npm run eval:report -- --name=DIR [--against=DIR]` |
| `npm run measure` | replay reference rides and compute per-beat measures under every ruler |
| `node --import tsx tools/measure/motion_check.ts --library=DIR --previous=DIR` | motion check of a review library (bursts, reported windows, calm openings) |
| `npm run labels:study` / `labels:analyze` | build a blind labelling study / compare measures with the owner's labels |

## Checks

| command | what it guards |
|---|---|
| `npm run parity` | structural changes leave 63 compiled reference cells byte-identical (all compile modes, plus 150k/750k budgets; ~2.5 min) |
| `npm run parity:judge [-- --all]` | the V6 judge reproduces every stored score (this *is* the V6 freeze) |
| `npm test` | unit and integration tests (~2.5 min) |
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
| `productions/` | the four production songs: spec, audio, render settings |
| `beats/` | music analysis inputs and extraction scripts |
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
