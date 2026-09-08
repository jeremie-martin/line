# line

Procedural Line Rider videos synchronized to music.

## What this is

Take an audio file → generate a Line Rider track JSON whose ride lands beats /
events / shapes in sync with the music → render to mp4. The community
equivalent (DoodleChaos's hand-made music tracks) takes a month per video.
Nobody has published an automated pipeline; that's the gap this project fills.

Status: the spec-to-track compiler and full vertical video pipeline are working.
The current compiler uses coherent normal-line arcs with measured trajectory
shaping and adaptive continuation planning. The accepted V2 milestone is
**771.3015 at 750k simulated frames**, with the benchmark and scorer fixed.
The compiler also preserves validated curves when further search exhausts its budget.
See [the current evidence](docs/arc-planning-continuity.md) and
[the compiler map](scripts/v0/optimizer/README.md).

> **Working on the compiler?** Start at [`docs/HOW_TO_WORK.md`](docs/HOW_TO_WORK.md)
> — the single how-to-work doc. The full documentation map is [`docs/README.md`](docs/README.md).

## Quick start

```bash
# one-time setup
npm install
npx playwright install chromium

# in one terminal: serve the local linerider.com mirror
python3 -m http.server 8765 --bind 127.0.0.1
# (run this from your local linerider.com mirror checkout)

# in another: render a track to mp4
npx tsx scripts/export.ts \
  --track=test.track.json \
  --zoom=3 --1080p --hq \
  --out=shakedown/myvideo.mp4

# OR — detect events AND render in one shot, ready for the dashboard
npm run inspect -- --track=test.track.json --1080p --hq

# stress-test the helper (4 scenarios, ~7 min)
npx tsx scripts/stress.ts

# verify lr-core (Node-native physics) still matches the bundle exactly
npm run parity

# Benchmark V2 is the default compiler benchmark.
npm run benchmark -- status
npm run benchmark -- eval --seeds=48 --jobs=48

# Active improvement eval uses strict N=8/16/32/48 looks and compiles only the
# candidate at each reached prefix. After an accept, promote that exact prefix.
npm run benchmark -- rebaseline --from=COMPARISON.json --label=NAME

# Historical/deep fixed-N work is explicit and separate.
npm run benchmark -- baseline-cache status --seeds=300 --baseline=benchmark/v2/baseline.json
npm run benchmark -- eval --seeds=300 --baseline=benchmark/v2/baseline.json

# Bootstrap a new suite, or perform an intentional suite rollover only.
npm run benchmark -- baseline --label=NAME

# Historical V1 reproduction remains explicit.
npm run golden:v1 -- --full
npm run decide:v1 -- CANDIDATE/golden.json BASELINE/golden.json
```

To visually inspect a run (events, plots, video):

```bash
# in a third terminal
npm run dash                                              # serves :8767 (range-aware)
# open http://127.0.0.1:8767/dashboard/?run=test
```

(The dashboard server is `scripts/serve.ts` — a ~70 LoC Node static server
with byte-range support, which `<video>` scrubbing requires. Python's
`http.server` lacks Range support and breaks seek.)

`scripts/export.ts` flags:
- `--track=PATH` (required) — Line Rider JSON track
- `--zoom=N` (default 3; UI's "zoom level N" = `2^N`)
- `--zoom=action` / `--zoom=spec` — use authored `Spec.camera.zoom` from
  `--spec=PATH` or sibling `<track>.camera.json`
- `--camera=PATH` — explicit camera sidecar for spec-driven zoom
- `--1080p` (default 720p) and `--hq` (default off)
- `--origin=URL` (default `http://127.0.0.1:8765`)
- `--out=PATH` (default `shakedown/out.mp4`)
- `--headed` (run the browser visibly)

## Architecture

```
audio file
  → audio analysis and authored production specification
  → compiler      (coherent arcs, exact physical evaluation)
  → JSON track
─────────────── boundary of our code ───────────────
  linerider.com bundle  (vendored as mirror/_v2153.0/, served from localhost)
  + mirror/helper.js    (our window.__lr API on top of the bundle)
  → Playwright drives the browser
  → mp4 file
```

The compiler runs metered physics while searching. Production rendering adds
the authored camera, music and post-processing.

## Repository layout

| Path | What |
|---|---|
| `mirror/_v2153.0/` | Vendored linerider.com static SPA bundle. Untouched. |
| `mirror/helper.js` | Our `window.__lr` API — wraps Redux dispatches + React fiber walks into a clean Promise-based surface. |
| `mirror/index.html` | Upstream HTML + one `<script defer src="/helper.js">` line. |
| `unpacked/` | `webcrack` output of `main.js` — 1069 readable module files, used as a reference when designing the helper. Regenerate with `npm run unpack`. |
| `scripts/export.ts` | The working exporter. JSON track → mp4. |
| `scripts/analyze_music.py` | madmom structural analysis (tempo/meter/energy) — a listening aid for designing creative specs. See `docs/creative_workflow.md`. |
| `scripts/stress.ts` | 4-scenario stress test for the helper. |
| `scripts/probe*.ts` | One-shot discovery scripts kept as history (Redux store shape, fiber walking, network capture, etc.). |
| `test.track.json` | Reference track used as a regression / parity test. |

## window.__lr API surface

Defined in `mirror/helper.js`. Use from the browser DevTools at
`http://localhost:8765/`, or from Playwright via `page.evaluate(() =>
__lr.foo(...))`.

```js
__lr.enterEditor()
__lr.loadTrack(trackJsonOrString)
__lr.setPlaybackZoom(zoom)              // linear; UI shows log2(this)
__lr.openVideoExporter() / closeVideoExporter()
__lr.waitForVideoExporterReady()        // resolves when status==='Config'
__lr.waitForVideoExporterRenderSurface()// resolves when the WebGL canvas is mounted
__lr.setResolution({width, height, preset})
__lr.setHighQuality(bool)               // QP 22 vs 28
__lr.setStartFrom('Beginning' | 'Checkpoint')
__lr.setEncoderSettings({               // beyond UI
  kbps, speed, quantizationParameter, groupOfPictures
})
__lr.render({timeoutMs, stallMs})       // returns blob URL on Postrender
__lr.triggerDownload(url, filename)
__lr.exportVideo({                      // high-level convenience
  track, zoom, resolution, hq, encoderSettings, startFrom, filename
})
__lr.getState()                         // store.getState()
```

Action shapes were extracted from `unpacked/279.js` (view actions) and
`unpacked/493.js` (camera actions). Component-local state field names from
`unpacked/1044.js` (the VideoExporter React component).

## Why this architecture

| Layer | Why |
|---|---|
| **linerider.com** (vs LROverhaul, lr-core, etc.) | Canonical physics + visuals (sledder, scarf, line ink) for free. Closed-source but a static SPA. The "feel" of Line Rider that the community recognizes. |
| **Local mirror** | Reproducibility — pinned to v2153.0; immune to upstream changes. Offline. Foundation for any future bundle patching. |
| **Helper script** (not main.js patch) | Additive, isolated. Re-applies cleanly after re-mirror. Touches only one extra `<script>` tag. |
| **Playwright** | The browser is the renderer. The export feature uses MediaRecorder + h264-mp4-encoder; we don't reimplement either. ~3× real-time render at 1080p HQ. |
| **Redux + fiber walk** | View transitions / track load / zoom are Redux. Modal-local state (resolution / HQ / render trigger) is React component state, reached via fiber walk. Both paths needed; helper hides the difference. |

Alternatives considered:
- `jealouscloud/linerider-advanced` (C#, last release 2018, dormant) — rejected
- `LunaKampling/LROverhaul` (C#, active; would need its own GUI driver, GPLv3 viral if we adopted its assets) — rejected
- `deanveloper/bosh-rs` (Rust port, archived) — rejected
- `conundrumer/lr-core` (JS, physics-only, no rendering) — **adopted for simulation** (see below)

## Which engine to use when

The bundle ships its physics engine (in `mirror/_v2153.0/main.js`) and we
have **`lr-core`** as an npm package (same author, David Lu / Conundrumer).
We've verified they produce **byte-identical trajectories** on the full
test track — same MD5 over 11 sampled frames × position + velocity + 11
contact points. Re-verify any time with `npm run parity`.

The current compiler and benchmark use the WASM engine by default; `lr-core`
remains a reference implementation. See [engine workflow](docs/engine-workflow.md).

| Use case | Engine | Why |
|---|---|---|
| **Procedural generator inner loop** (place candidate lines → simulate → score → iterate) | **WASM** | Metered search and fixed-judge replay. |
| **Headless tests, batch jobs, CI** | **WASM or lr-core reference** | No browser needed for physics. |
| **Quick scripts / one-off rider-position queries** | **lr-core** | Cheaper to spin up; debug in Node. |
| **Rendering a track to mp4** | **bundle** (via Playwright + `__lr.exportVideo`) | lr-core doesn't render. The bundle is the only thing that turns lines + simulator state into pixels. |
| **"Does my generated track look right when rendered?"** | **bundle** | Implicit re-verification of parity on every render. |
| **Regression test after a bundle bump or lr-core update** | **both** | `npm run parity` runs them on the same input and byte-diffs the trajectories. |

Default for any *physics* operation: **lr-core**. Default for *visuals*: **bundle**.

If parity ever breaks, the generator can no longer trust its simulations
will render the same way — that's the moment to either (a) pin to whichever
side stayed correct, (b) extract physics from `unpacked/`, or (c) re-derive
the engine. Today (v2153.0 bundle, lr-core@0.8.2): they match exactly.

## Music sync — two channels worth knowing about

1. **Physical sync** — lines arranged so the sledder lands on a beat at frame T.
   The hard problem; the generator is the open work.
2. **Camera sync** — specs can author `camera.zoom` keyframes. The compiler
   writes a `<out>.camera.json` sidecar, and the render path feeds those
   keyframes into the bundle's native `createZoomer` hook. This is render-only
   intent: it does not affect physics, scoring, or golden benchmarks.

DoodleChaos-style videos mix both.

**Creative workflow (worked example).** `docs/creative_workflow.md` walks the
full song→track→video pipeline end to end: clean the beat grid, use madmom
(`scripts/analyze_music.py`) to read the song's tempo/phrasing/energy, translate
that into an expressive spec, compile with the handoff compiler, iterate against
the achieved per-section axes, and render an mp4 with audio. Uses the first 56s
of *Believer* (`generated/believer_v3.track.json`) as the example.

## What's verified working

- Pixel-deterministic export at 720p/1080p/custom resolutions.
- Custom encoder settings (`quantizationParameter`, `kbps`, etc.).
- Multiple back-to-back renders in one Playwright session, with track
  switching and zoom changes between renders.
- Friendly error when origin is unreachable.
- Forensics dump (screenshot + state.json + console.log + page-errors.log +
  error.txt) under `shakedown/debug/<ISO-timestamp>/` on any failure.
- **lr-core ↔ bundle physics parity** — byte-identical trajectories on the
  test track. `npm run parity` re-runs the check.

## Detect & dashboard

Two scripts complete the substrate for Step 0 of [`PROBLEM.md`](./PROBLEM.md):

- **`scripts/lib/detector.ts`** — pure function over a per-frame trajectory.
  Outputs `{measurements, events, terminus, params}`. Events are `landing`
  (airborne > K=5 frames then re-contact), `bounce` (1..K then re-contact),
  and `kick` (velocity-direction change ≥ θ=20°). Constants live at the top
  of the module so they can be tuned from the dashboard validation loop.
- **`scripts/inspect.ts`** — composite CLI. Builds the lr-core engine for a
  track, runs the detector, copies the track, auto-renders `video.mp4` if
  missing (via the same Playwright + mirror path as `export.ts`), and
  appends the run to `shakedown/runs.json`. Output goes to
  `shakedown/<run-name>/`.

```bash
# any track works — runName defaults to basename
npm run inspect -- --track=mycustom.track.json
# Dashboard → http://127.0.0.1:8767/dashboard/?run=mycustom
```

If the mirror server isn't reachable, `inspect` warns and skips the render
— detection still completes; re-run with `--render` once the server is up.

The **dashboard** (`dashboard/index.html`, served by `npm run dash`) plays
the rendered mp4 alongside time-aligned uPlot charts (speed, airborne,
position.y) with event markers overlaid. Two-way cursor sync: video time
drives the chart cursor; clicking a chart seeks the video. Opening
`http://127.0.0.1:8767/dashboard/` with no query param lists every run
in `shakedown/runs.json`.

## Next directions

The generator side of the pipeline. [`PROBLEM.md`](./PROBLEM.md) pins the
problem statement, definitions (event types: landing / bounce / kick,
speed semantics, units, tolerances, initial conditions), and the
falsifiable success-criterion ladder. Step 0 (detector + dashboard) is
the current iteration — the dashboard is the visual acceptance gate for
any change to detector constants or contact-signal logic.

Background items still open (not blocking the generator):

- **Vendor the h264 encoder** — currently a runtime fetch from
  `unpkg.com/h264-mp4-encoder@1.0.12`. Single external CDN dep.
- **Helper observability** — H6/H7 from the code review are still open
  (fiber-walk could grab a stale instance during the 400 ms remount window;
  `loadTrack` swallows async bundle-side validation errors).

## Notes for future you

- `?forceMillions` URL flag is required for the graphics-card check to pass
  in headless Chromium. The helper assumes it. Chromium must still be able to
  create a WebGL context; extra host flags can be appended with
  `LR_CHROMIUM_ARGS`.
- linerider.com is React 16 (fiber key prefix `__reactInternalInstance$`),
  not React 17/18. The fiber walk handles both prefixes defensively.
- Render is roughly **3× real-time** at 1080p HQ. A 3-min song → ~9 min export.
- Bundle's render IIFE is unawaited — encoder failures leave `status="Rendering"`
  silently. `helper.render()` detects this by polling `state.index` and aborting
  on 15 s of no progress.
- Trademark: "Line Rider" is Boštjan Čadež's. Personal/dev use is fine; any
  public distribution of the mirror or unpacked bundle is a copyright issue
  (linerider.com is not open source).
